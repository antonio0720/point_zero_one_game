/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION ENGINE
 * /backend/src/game/engine/tension/TensionEngine.ts
 * ====================================================================== */

import {
  createEngineHealth,
  type EngineHealth,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { AnticipationQueue } from './AnticipationQueue';
import { TensionDecayController } from './TensionDecayController';
import { TensionThreatProjector } from './TensionThreatProjector';
import { TensionThreatSourceAdapter } from './TensionThreatSourceAdapter';
import { ThreatVisibilityManager } from './ThreatVisibilityManager';
import { TensionUXBridge } from './TensionUXBridge';
import {
  TENSION_CONSTANTS,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  type QueueUpsertInput,
  type TensionRuntimeSnapshot,
  type TensionVisibilityState,
} from './types';

const SCORE_HISTORY_DEPTH = 20;
const TREND_WINDOW = 3;

export class TensionEngine implements SimulationEngine {
  public readonly engineId = 'tension' as const;

  private readonly queue = new AnticipationQueue();
  private readonly visibility = new ThreatVisibilityManager();
  private readonly decay = new TensionDecayController();
  private readonly projector = new TensionThreatProjector();
  private readonly sourceAdapter = new TensionThreatSourceAdapter();

  private currentRunId: string | null = null;
  private currentScore = 0;
  private scoreHistory: number[] = [];
  private pulseTicksActive = 0;
  private lastRuntimeSnapshot: TensionRuntimeSnapshot | null = null;
  private health: EngineHealth = createEngineHealth(
    'tension',
    'HEALTHY',
    Date.now(),
    Object.freeze(['initialized']),
  );

  public reset(): void {
    this.queue.reset();
    this.visibility.reset();
    this.decay.reset();
    this.currentRunId = null;
    this.currentScore = 0;
    this.scoreHistory = [];
    this.pulseTicksActive = 0;
    this.lastRuntimeSnapshot = null;
    this.health = createEngineHealth(
      'tension',
      'HEALTHY',
      Date.now(),
      Object.freeze(['reset']),
    );
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    if (snapshot.outcome !== null) {
      return snapshot;
    }

    this.hydrateRun(snapshot);

    const bridge = new TensionUXBridge(context.bus as unknown as any);
    const currentTick = snapshot.tick;

    this.queue.upsertMany(this.sourceAdapter.discover(snapshot));

    const queueResult = this.queue.processTick(currentTick);
    const nearDeath = this.computeNearDeath(snapshot);
    const visibilityUpdate = this.visibility.update(
      snapshot.pressure.tier,
      nearDeath,
      snapshot.modeState.counterIntelTier,
    );

    const sortedActiveEntries = this.queue.getSortedActiveQueue();
    const visibleThreats = this.projector.toThreatEnvelopes(
      sortedActiveEntries,
      visibilityUpdate.state,
      currentTick,
    );

    for (const entry of queueResult.newArrivals) {
      bridge.emitThreatArrived(entry, currentTick);
    }

    for (const entry of queueResult.newExpirations) {
      bridge.emitThreatExpired(entry, currentTick);
    }

    if (
      visibilityUpdate.changed &&
      visibilityUpdate.previousState !== null &&
      visibilityUpdate.previousState !== visibilityUpdate.state
    ) {
      bridge.emitVisibilityChanged(
        visibilityUpdate.previousState,
        visibilityUpdate.state,
        currentTick,
      );
    }

    const breakdown = this.decay.computeDelta({
      activeEntries: queueResult.activeEntries,
      expiredEntries: this.queue.getExpiredEntries(),
      relievedEntries: queueResult.relievedEntries,
      pressureTier: snapshot.pressure.tier,
      visibilityAwarenessBonus:
        VISIBILITY_CONFIGS[visibilityUpdate.state].tensionAwarenessBonus,
      queueIsEmpty: this.queue.getQueueLength() === 0,
      sovereigntyMilestoneReached:
        snapshot.economy.freedomTarget > 0 &&
        snapshot.economy.netWorth >= snapshot.economy.freedomTarget,
    });

    const previousScore = this.currentScore;
    this.currentScore = this.clampScore(
      this.currentScore + breakdown.amplifiedDelta,
    );
    this.scoreHistory.push(this.currentScore);
    if (this.scoreHistory.length > SCORE_HISTORY_DEPTH) {
      this.scoreHistory.shift();
    }

    const isPulseActive = this.currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD;
    this.pulseTicksActive = isPulseActive ? this.pulseTicksActive + 1 : 0;

    const runtimeSnapshot: TensionRuntimeSnapshot = {
      score: this.currentScore,
      previousScore,
      rawDelta: breakdown.rawDelta,
      amplifiedDelta: breakdown.amplifiedDelta,
      visibilityState: visibilityUpdate.state,
      queueLength: this.queue.getQueueLength(),
      arrivedCount: this.queue.getArrivedEntries().length,
      queuedCount: this.queue.getQueuedEntries().length,
      expiredCount: this.queue.getExpiredCount(),
      relievedCount: queueResult.relievedEntries.length,
      visibleThreats,
      isPulseActive,
      pulseTicksActive: this.pulseTicksActive,
      isEscalating: this.computeIsEscalating(),
      dominantEntryId: this.computeDominantEntryId(sortedActiveEntries),
      lastSpikeTick:
        this.currentScore > previousScore
          ? currentTick
          : snapshot.tension.lastSpikeTick,
      tickNumber: currentTick,
      timestamp: context.nowMs,
      contributionBreakdown: breakdown.contributionBreakdown,
    };

    this.lastRuntimeSnapshot = runtimeSnapshot;
    this.updateHealth(runtimeSnapshot);

    bridge.emitQueueUpdated(
      runtimeSnapshot.queueLength,
      runtimeSnapshot.arrivedCount,
      runtimeSnapshot.queuedCount,
      runtimeSnapshot.expiredCount,
      currentTick,
    );
    bridge.emitScoreUpdated(runtimeSnapshot);

    if (runtimeSnapshot.isPulseActive) {
      bridge.emitPulseFired(runtimeSnapshot);
    }

    return {
      ...snapshot,
      tension: {
        score: runtimeSnapshot.score,
        anticipation: runtimeSnapshot.queueLength,
        visibleThreats: runtimeSnapshot.visibleThreats,
        maxPulseTriggered: runtimeSnapshot.isPulseActive,
        lastSpikeTick: runtimeSnapshot.lastSpikeTick,
      },
    };
  }

  public enqueueThreat(
    input: Omit<QueueUpsertInput, 'runId'> & { readonly runId?: string },
  ): string {
    const runId = input.runId ?? this.currentRunId ?? 'adhoc-run';
    const entry = this.queue.upsert({
      ...input,
      runId,
    });
    return entry.entryId;
  }

  public enqueueThreats(
    inputs: ReadonlyArray<Omit<QueueUpsertInput, 'runId'> & { readonly runId?: string }>,
  ): readonly string[] {
    const entryIds: string[] = [];
    for (const input of inputs) {
      entryIds.push(this.enqueueThreat(input));
    }
    return Object.freeze(entryIds);
  }

  public mitigateThreat(
    entryId: string,
    currentTick: number,
    bus?: TickContext['bus'],
  ): boolean {
    const entry = this.queue.mitigateEntry(entryId, currentTick);
    if (entry === null) {
      return false;
    }

    if (bus !== undefined) {
      const bridge = new TensionUXBridge(bus as unknown as any);
      bridge.emitThreatMitigated(entry, currentTick);
      bridge.emitQueueUpdated(
        this.queue.getQueueLength(),
        this.queue.getArrivedEntries().length,
        this.queue.getQueuedEntries().length,
        this.queue.getExpiredCount(),
        currentTick,
      );
    }

    return true;
  }

  public nullifyThreat(
    entryId: string,
    currentTick: number,
    bus?: TickContext['bus'],
  ): boolean {
    const entry = this.queue.nullifyEntry(entryId);
    if (entry === null) {
      return false;
    }

    if (bus !== undefined) {
      const bridge = new TensionUXBridge(bus as unknown as any);
      bridge.emitQueueUpdated(
        this.queue.getQueueLength(),
        this.queue.getArrivedEntries().length,
        this.queue.getQueuedEntries().length,
        this.queue.getExpiredCount(),
        currentTick,
      );
    }

    return true;
  }

  public getRuntimeSnapshot(): TensionRuntimeSnapshot {
    return this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
  }

  public getCurrentScore(): number {
    return this.currentScore;
  }

  public getVisibilityState(): TensionVisibilityState {
    return this.visibility.getCurrentState();
  }

  public getQueueLength(): number {
    return this.queue.getQueueLength();
  }

  public isAnticipationPulseActive(): boolean {
    return this.pulseTicksActive > 0;
  }

  public getSortedQueue() {
    return this.queue.getSortedActiveQueue();
  }

  public getHealth(): EngineHealth {
    return this.health;
  }

  private hydrateRun(snapshot: RunStateSnapshot): void {
    if (this.currentRunId === snapshot.runId) {
      return;
    }

    this.reset();
    this.currentRunId = snapshot.runId;
    this.currentScore = this.clampScore(snapshot.tension.score);
    if (this.currentScore > 0) {
      this.scoreHistory.push(this.currentScore);
    }
  }

  private computeNearDeath(snapshot: RunStateSnapshot): boolean {
    const bankruptcyProxy = Math.max(
      1,
      Math.abs(snapshot.economy.expensesPerTick) * 4,
    );
    if (snapshot.economy.netWorth <= 0) {
      return true;
    }
    return snapshot.economy.netWorth / bankruptcyProxy <= 0.25;
  }

  private computeDominantEntryId(
    entries: readonly {
      readonly entryId: string;
      readonly state: string;
      readonly severityWeight: number;
      readonly arrivalTick: number;
    }[],
  ): string | null {
    if (entries.length === 0) {
      return null;
    }

    const ranked = [...entries].sort((left, right) => {
      if (left.state !== right.state) {
        return left.state === 'ARRIVED' ? -1 : 1;
      }
      if (left.severityWeight !== right.severityWeight) {
        return right.severityWeight - left.severityWeight;
      }
      return left.arrivalTick - right.arrivalTick;
    });

    return ranked[0]?.entryId ?? null;
  }

  private computeIsEscalating(): boolean {
    if (this.scoreHistory.length < TREND_WINDOW) {
      return false;
    }

    const recent = this.scoreHistory.slice(-TREND_WINDOW);
    for (let index = 1; index < recent.length; index += 1) {
      if (recent[index] <= recent[index - 1]) {
        return false;
      }
    }
    return true;
  }

  private clampScore(score: number): number {
    return Math.max(
      TENSION_CONSTANTS.MIN_SCORE,
      Math.min(TENSION_CONSTANTS.MAX_SCORE, score),
    );
  }

  private updateHealth(runtimeSnapshot: TensionRuntimeSnapshot): void {
    if (
      runtimeSnapshot.queueLength >= 24 ||
      runtimeSnapshot.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS
    ) {
      this.health = createEngineHealth(
        'tension',
        'DEGRADED',
        Date.now(),
        Object.freeze([
          `queue=${runtimeSnapshot.queueLength}`,
          `pulseTicks=${runtimeSnapshot.pulseTicksActive}`,
        ]),
      );
      return;
    }

    this.health = createEngineHealth(
      'tension',
      'HEALTHY',
      Date.now(),
      Object.freeze([`score=${runtimeSnapshot.score.toFixed(3)}`]),
    );
  }

  private buildEmptyRuntimeSnapshot(): TensionRuntimeSnapshot {
    return {
      score: 0,
      previousScore: 0,
      rawDelta: 0,
      amplifiedDelta: 0,
      visibilityState: TENSION_VISIBILITY_STATE.SHADOWED,
      queueLength: 0,
      arrivedCount: 0,
      queuedCount: 0,
      expiredCount: 0,
      relievedCount: 0,
      visibleThreats: Object.freeze([]),
      isPulseActive: false,
      pulseTicksActive: 0,
      isEscalating: false,
      dominantEntryId: null,
      lastSpikeTick: null,
      tickNumber: 0,
      timestamp: Date.now(),
      contributionBreakdown: {
        queuedThreats: 0,
        arrivedThreats: 0,
        expiredGhosts: 0,
        mitigationDecay: 0,
        nullifyDecay: 0,
        emptyQueueBonus: 0,
        visibilityBonus: 0,
        sovereigntyBonus: 0,
      },
    };
  }
}