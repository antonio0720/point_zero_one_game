/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/tension/TensionEngine.ts
 * Core Tension Engine orchestrator. Public API surface.
 * Instantiates and coordinates: AnticipationQueue, ThreatVisibilityManager,
 * TensionDecayController, and TensionUXBridge.
 *
 * Called by EngineOrchestrator each tick at Step 3 (after PressureEngine Step 2,
 * before CardEngine Step 4).
 *
 * NEVER imports: TimeEngine, PressureEngine class, BattleEngine, CascadeEngine,
 * ShieldEngine, SovereigntyEngine. All inter-engine data arrives as arguments.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import {
  VisibilityState,
  PressureTier,
  TensionSnapshot,
  TensionReader,
  TENSION_CONSTANTS,
  VISIBILITY_CONFIGS,
} from './types';
import { AnticipationQueue, EnqueueInput } from './AnticipationQueue';
import { ThreatVisibilityManager } from './ThreatVisibilityManager';
import { TensionDecayController } from './TensionDecayController';
import { TensionUXBridge } from './TensionUXBridge';
import type { EventBus } from '../core/EventBus';

const SCORE_HISTORY_DEPTH = 20;
const TREND_WINDOW = 3;

export class TensionEngine implements TensionReader {

  // ── Sub-components ─────────────────────────────────────────────────────
  private readonly queue:      AnticipationQueue;
  private readonly visibility: ThreatVisibilityManager;
  private readonly decay:      TensionDecayController;
  private readonly uxBridge:   TensionUXBridge;

  // ── Score state ────────────────────────────────────────────────────────
  private currentScore: number = 0.0;
  private scoreHistory: number[] = [];
  private lastSnapshot: TensionSnapshot | null = null;
  private tickNumber: number = 0;

  // ── Pulse state ────────────────────────────────────────────────────────
  private isPulseActive: boolean = false;
  private pulseTicksActive: number = 0;

  // ── Construction ───────────────────────────────────────────────────────

  constructor(eventBus: EventBus) {
    this.queue      = new AnticipationQueue();
    this.visibility = new ThreatVisibilityManager();
    this.decay      = new TensionDecayController();
    this.uxBridge   = new TensionUXBridge(eventBus);
  }

  // ══ Public API — called by EngineOrchestrator ══════════════════════════

  /**
   * Main tick computation. Called at Step 3 of every tick.
   *
   * Execution order (invariant — do not reorder):
   *   Step 1: Process queue arrivals and expirations
   *   Step 2: Emit arrival/expiry events via UX bridge
   *   Step 3: Update visibility state based on pressure tier
   *   Step 4: Compute tension delta via DecayController
   *   Step 5: Apply delta to running score, clamp to [0.0, 1.0], update history
   *   Step 6: Check pulse threshold (>= 0.90)
   *   Step 7: Build snapshot, emit score update, return snapshot
   *
   * @param pressureTier               Just-computed by PressureEngine at Step 2
   * @param isNearDeath                net worth < 25% of bankruptcy threshold
   * @param currentTick                Current tick number from TimeEngine
   * @param sovereigntyMilestoneReached One-time freedom milestone flag (default: false)
   */
  public computeTension(
    pressureTier: PressureTier,
    isNearDeath: boolean,
    currentTick: number,
    sovereigntyMilestoneReached: boolean = false
  ): TensionSnapshot {
    this.tickNumber = currentTick;

    // ── Step 1: Process queue arrivals and expirations ─────────────────
    const arrivalResult = this.queue.processArrivalTick(currentTick);

    // ── Step 2: Emit arrival and expiry events ─────────────────────────
    for (const arrived of arrivalResult.newArrivals) {
      this.uxBridge.emitThreatArrived(arrived, currentTick);
      this.uxBridge.emitQueueUpdated(
        this.queue.getQueueLength(),
        this.queue.getArrivedEntries().length,
        currentTick
      );
    }
    for (const expired of arrivalResult.newExpirations) {
      this.uxBridge.emitThreatExpired(expired, currentTick);
    }

    // ── Step 3: Update visibility state ───────────────────────────────
    const visResult = this.visibility.update(pressureTier, isNearDeath);
    if (visResult.changed && this.visibility.getPreviousState() !== null) {
      this.uxBridge.emitVisibilityChanged(
        this.visibility.getPreviousState()!,
        visResult.state,
        currentTick
      );
    }

    // ── Step 4: Compute tension delta ──────────────────────────────────
    const visConfig = VISIBILITY_CONFIGS[visResult.state];
    const deltaResult = this.decay.computeDelta({
      activeEntries:             arrivalResult.activeQueue,
      expiredEntries:            this.queue.getExpiredEntries(),
      mitigatingEntries:         arrivalResult.mitigatingEntries,
      pressureTier,
      visibilityAwarenessBonus:  visConfig.tensionAwarenessBonus,
      queueIsEmpty:              this.queue.getQueueLength() === 0,
      sovereigntyMilestoneReached,
    });

    // ── Step 5: Apply delta, clamp, update history ─────────────────────
    this.currentScore = Math.max(
      TENSION_CONSTANTS.MIN_SCORE,
      Math.min(
        TENSION_CONSTANTS.MAX_SCORE,
        this.currentScore + deltaResult.amplifiedDelta
      )
    );
    this.scoreHistory.push(this.currentScore);
    if (this.scoreHistory.length > SCORE_HISTORY_DEPTH) {
      this.scoreHistory.shift();
    }

    // ── Step 6: Check pulse threshold ─────────────────────────────────
    if (this.currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      this.isPulseActive = true;
      this.pulseTicksActive++;
    } else {
      this.isPulseActive = false;
      this.pulseTicksActive = 0;
    }

    // ── Step 7: Build snapshot, emit, return ──────────────────────────
    const sortedQueue = this.queue.getSortedActiveQueue();
    const dominantEntryId = sortedQueue.length > 0
      ? (sortedQueue[0]?.entryId ?? null)
      : null;

    const snapshot: TensionSnapshot = {
      score:                 this.currentScore,
      rawScore:              deltaResult.rawDelta,
      amplifiedScore:        this.currentScore,
      visibilityState:       visResult.state,
      queueLength:           this.queue.getQueueLength(),
      arrivedCount:          this.queue.getArrivedEntries().length,
      queuedCount:           this.queue.getQueuedEntries().length,
      expiredCount:          this.queue.getTotalExpiredCount(),
      isPulseActive:         this.isPulseActive,
      pulseTicksActive:      this.pulseTicksActive,
      scoreHistory:          Object.freeze([...this.scoreHistory]),
      isEscalating:          this.computeIsEscalating(),
      dominantEntryId,
      pressureTierAtCompute: pressureTier,
      tickNumber:            currentTick,
      timestamp:             Date.now(),
    };

    this.lastSnapshot = snapshot;
    this.uxBridge.emitScoreUpdated(snapshot);
    if (this.isPulseActive) {
      this.uxBridge.emitPulseFired(snapshot);
    }

    return snapshot;
  }

  // ── Threat Management API ──────────────────────────────────────────────

  /**
   * Enqueue a threat from CardEngine or BattleEngine.
   * Called by EngineOrchestrator when a threat is generated.
   * Returns the entryId of the created AnticipationEntry.
   */
  public enqueueThreat(input: EnqueueInput): string {
    const entry = this.queue.enqueue(input);
    this.uxBridge.emitQueueUpdated(
      this.queue.getQueueLength(),
      this.queue.getArrivedEntries().length,
      input.currentTick
    );
    return entry.entryId;
  }

  /**
   * Mark a threat as mitigated by the player.
   * Called by EngineOrchestrator after player plays a mitigation card.
   * Returns false if threat is not in ARRIVED state (cannot mitigate QUEUED or EXPIRED).
   */
  public mitigateThreat(entryId: string, currentTick: number): boolean {
    const entry = this.queue.getEntry(entryId);
    const success = this.queue.mitigateEntry(entryId, currentTick);
    if (success && entry) {
      this.uxBridge.emitThreatMitigated(entryId, entry.threatType, currentTick);
      this.uxBridge.emitQueueUpdated(
        this.queue.getQueueLength(),
        this.queue.getArrivedEntries().length,
        currentTick
      );
    }
    return success;
  }

  /**
   * Remove a threat via card effect (not player mitigation).
   * Valid for QUEUED or ARRIVED entries. Grants partial tension relief only.
   */
  public nullifyThreat(entryId: string, currentTick: number): boolean {
    const success = this.queue.nullifyEntry(entryId, currentTick);
    if (success) {
      this.uxBridge.emitQueueUpdated(
        this.queue.getQueueLength(),
        this.queue.getArrivedEntries().length,
        currentTick
      );
    }
    return success;
  }

  // ── TensionReader Interface ────────────────────────────────────────────

  public getCurrentScore(): number {
    return this.currentScore;
  }

  public getVisibilityState(): VisibilityState {
    return this.visibility.getCurrentState();
  }

  public getQueueLength(): number {
    return this.queue.getQueueLength();
  }

  public isAnticipationPulseActive(): boolean {
    return this.isPulseActive;
  }

  public getSnapshot(): TensionSnapshot {
    return this.lastSnapshot ?? this.buildEmptySnapshot();
  }

  /** Returns sorted active queue for store sync. Called by EngineOrchestrator after computeTension(). */
  public getSortedQueue(): ReturnType<AnticipationQueue['getSortedActiveQueue']> {
    return this.queue.getSortedActiveQueue();
  }

  // ── Trend Computation ─────────────────────────────────────────────────

  private computeIsEscalating(): boolean {
    if (this.scoreHistory.length < TREND_WINDOW) return false;
    const recent = this.scoreHistory.slice(-TREND_WINDOW);
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] <= recent[i - 1]) return false;
    }
    return true;
  }

  // ── Reset & Force ──────────────────────────────────────────────────────

  /**
   * Full reset. Clears all state. Called at run start.
   * Must clear: queue, visibility, decay, score, history, pulse tracking.
   * Leaving any partial state will corrupt the next run.
   */
  public reset(): void {
    this.queue.reset();
    this.visibility.reset();
    this.decay.reset();
    this.currentScore = 0.0;
    this.scoreHistory = [];
    this.lastSnapshot = null;
    this.tickNumber = 0;
    this.isPulseActive = false;
    this.pulseTicksActive = 0;
  }

  /**
   * Force-set the score directly. Used by admin tooling and tutorial sequences.
   * Bypasses all delta logic. Score is still clamped to [0.0, 1.0].
   */
  public forceScore(score: number): void {
    this.currentScore = Math.max(
      TENSION_CONSTANTS.MIN_SCORE,
      Math.min(TENSION_CONSTANTS.MAX_SCORE, score)
    );
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private buildEmptySnapshot(): TensionSnapshot {
    return {
      score: 0,
      rawScore: 0,
      amplifiedScore: 0,
      visibilityState: VisibilityState.SHADOWED,
      queueLength: 0,
      arrivedCount: 0,
      queuedCount: 0,
      expiredCount: 0,
      isPulseActive: false,
      pulseTicksActive: 0,
      scoreHistory: Object.freeze([]),
      isEscalating: false,
      dominantEntryId: null,
      pressureTierAtCompute: PressureTier.CALM,
      tickNumber: 0,
      timestamp: Date.now(),
    };
  }
}