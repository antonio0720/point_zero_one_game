/**
 * FILE: pzo-web/src/engines/pressure/PressureEngine.ts
 * Core Pressure Engine. Owns the tick computation loop.
 * Implements PressureReader interface for TimeEngine consumption.
 * EngineOrchestrator calls computeScore() at Step 2 of every tick.
 */
import {
  PressureTier,
  PressureSnapshot,
  PressureReadInput,
  PressureReader,
  PressureSignalWeights,
  PressureTuning,
  IEventBus,
  DEFAULT_SIGNAL_WEIGHTS,
  PRESSURE_TUNING_DEFAULTS,
  PRESSURE_TIER_BOUNDS,
  TrendMode,
} from './types';
import { PressureSignalCollector } from './PressureSignalCollector';
import { PressureDecayController } from './PressureDecayController';
import { PressureEventEmitter } from './PressureEventEmitter';
import type { ClockSource } from '../core/ClockSource';

/** Max ticks retained in scoreHistory. */
const SCORE_HISTORY_MAX = 20;

export class PressureEngine implements PressureReader {

  // ── Sub-components ────────────────────────────────────────────────────
  private readonly collector: PressureSignalCollector;
  private readonly decay:     PressureDecayController;
  private readonly emitter:   PressureEventEmitter;
  private readonly tuning:    PressureTuning;
  private readonly clock:     ClockSource | null;

  // ── State ─────────────────────────────────────────────────────────────
  private currentTier:    PressureTier = PressureTier.CALM;
  private previousTier:   PressureTier | null = null;
  private scoreHistory:   number[] = [];
  private lastSnapshot:   PressureSnapshot | null = null;
  private tickNumber:     number = 0;
  private criticalEntered: boolean = false;

  /**
   * @param eventBus  EventBus instance for emitting pressure events.
   * @param weights   Optional custom signal weights (defaults to DEFAULT_SIGNAL_WEIGHTS).
   * @param tuning    Optional tuning params: trendWindow, trendMode, threatCardSlope.
   * @param clock     Optional ClockSource for deterministic timestamps (tests / replay).
   */
  constructor(
    eventBus?: IEventBus,
    weights?:  PressureSignalWeights,
    tuning?:   PressureTuning,
    clock?:    ClockSource,
  ) {
    this.tuning    = tuning   ?? PRESSURE_TUNING_DEFAULTS;
    this.clock     = clock    ?? null;
    this.collector = new PressureSignalCollector(weights ?? DEFAULT_SIGNAL_WEIGHTS, this.tuning);
    this.decay     = new PressureDecayController(0.0);
    this.emitter   = new PressureEventEmitter(
      eventBus ?? { emit: () => undefined }
    );
  }

  // ── Main entry point ──────────────────────────────────────────────────

  /**
   * Called at Step 2 of each tick by EngineOrchestrator.
   * Reads game state → computes score → updates tier → fires events.
   * @returns New pressure score [0.0, 1.0].
   */
  public computeScore(input: PressureReadInput): number {
    this.tickNumber++;

    // 1. Collect raw signal score + per-signal breakdown
    const { rawScore, breakdown, dominantSignal } = this.collector.compute(input);

    // 2. Apply decay (pressure cannot drop more than 0.05/tick)
    const score = this.decay.applyDecay(rawScore);

    // 3. Resolve new tier
    const newTier   = this.getTierForScore(score);
    const tierChanged = newTier !== this.currentTier;

    // 4. Update score history (rolling window, most recent last)
    this.scoreHistory.push(score);
    if (this.scoreHistory.length > SCORE_HISTORY_MAX) this.scoreHistory.shift();

    // 5. Compute trend
    const isEscalating = this._computeIsEscalating();
    const isDecaying   = this._computeIsDecaying();

    // 6. Timestamp
    const timestamp = this.clock ? this.clock.now() : Date.now();

    // 7. Build snapshot
    const snapshot: PressureSnapshot = {
      score,
      rawScore,
      tier:               newTier,
      previousTier:       this.currentTier,
      tierChangedThisTick: tierChanged,
      scoreHistory:       Object.freeze([...this.scoreHistory]),
      isEscalating,
      isDecaying,
      dominantSignal,
      signalBreakdown:    Object.freeze({ ...breakdown }),
      tickNumber:         this.tickNumber,
      timestamp,
    };

    // 8. Update tier state and emit tier-change event
    if (tierChanged) {
      const prev       = this.currentTier;
      this.previousTier = prev;
      this.currentTier  = newTier;
      this.emitter.emitTierChanged(prev, newTier, snapshot);
    }

    // 9. Always emit score update
    this.emitter.emitScoreUpdated(snapshot);

    // 10. Emit CRITICAL_ENTERED on first entry into CRITICAL per run
    if (newTier === PressureTier.CRITICAL) {
      this.emitter.emitCriticalEntered(snapshot);
    }

    this.lastSnapshot = snapshot;
    return score;
  }

  // ── PressureReader interface ──────────────────────────────────────────

  public getCurrentTier(): PressureTier {
    return this.currentTier;
  }

  public getCurrentScore(): number {
    return this.decay.getCurrentScore();
  }

  public getScoreHistory(): readonly number[] {
    return Object.freeze([...this.scoreHistory]);
  }

  public isEscalating(): boolean {
    return this._computeIsEscalating();
  }

  public getSnapshot(): PressureSnapshot {
    if (!this.lastSnapshot) {
      return {
        score: 0, rawScore: 0,
        tier: PressureTier.CALM, previousTier: null,
        tierChangedThisTick: false,
        scoreHistory: Object.freeze([]),
        isEscalating: false, isDecaying: false,
        dominantSignal: null,
        signalBreakdown: Object.freeze({
          cashflowNegative: 0, lowCashBalance: 0, haterHeatHigh: 0,
          activeThreatCards: 0, lowShieldIntegrity: 0,
          stagnationTax: 0, activeCascadeChains: 0,
          prosperityBonus: 0, fullSecurityBonus: 0,
        }),
        tickNumber: 0,
        timestamp: this.clock ? this.clock.now() : Date.now(),
      };
    }
    return this.lastSnapshot;
  }

  // ── Tier Resolution ───────────────────────────────────────────────────

  public getTierForScore(score: number): PressureTier {
    for (const tier of [
      PressureTier.CRITICAL,
      PressureTier.HIGH,
      PressureTier.ELEVATED,
      PressureTier.BUILDING,
      PressureTier.CALM,
    ]) {
      const [min] = PRESSURE_TIER_BOUNDS[tier];
      if (score >= min) return tier;
    }
    return PressureTier.CALM;
  }

  // ── Trend Analysis ────────────────────────────────────────────────────

  private _computeIsEscalating(): boolean {
    const w = this.tuning.trendWindow;
    if (this.scoreHistory.length < w) return false;
    const recent = this.scoreHistory.slice(-w);

    if (this.tuning.trendMode === TrendMode.SLOPE) {
      // SLOPE: net delta across window must be positive (tolerates flat ticks)
      let delta = 0;
      for (let i = 1; i < recent.length; i++) delta += recent[i] - recent[i - 1];
      return delta > 0;
    }

    // STRICT (default): each tick must be strictly greater than previous
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] <= recent[i - 1]) return false;
    }
    return true;
  }

  private _computeIsDecaying(): boolean {
    const w = this.tuning.trendWindow;
    if (this.scoreHistory.length < w) return false;
    const recent = this.scoreHistory.slice(-w);

    if (this.tuning.trendMode === TrendMode.SLOPE) {
      let delta = 0;
      for (let i = 1; i < recent.length; i++) delta += recent[i] - recent[i - 1];
      return delta < 0;
    }

    for (let i = 1; i < recent.length; i++) {
      if (recent[i] >= recent[i - 1]) return false;
    }
    return true;
  }

  // ── Reset & Force ─────────────────────────────────────────────────────

  /** Called by EngineOrchestrator on run start. Resets all state to CALM baseline. */
  public reset(): void {
    this.currentTier     = PressureTier.CALM;
    this.previousTier    = null;
    this.scoreHistory    = [];
    this.lastSnapshot    = null;
    this.tickNumber      = 0;
    this.criticalEntered = false;
    this.decay.reset();
    this.emitter.reset();
  }

  /**
   * Force score to specific value (admin/tutorial/test only).
   * Hard jump — no decay applied. Does NOT fire tier-change events.
   */
  public forceScore(score: number): void {
    this.decay.forceScore(score);
    this.currentTier = this.getTierForScore(score);
  }

  // ── Balance Tooling ───────────────────────────────────────────────────

  /** Update signal weights at runtime (admin/balance tools only). */
  public setWeights(weights: Partial<PressureSignalWeights>): void {
    this.collector.setWeights(weights);
  }

  /**
   * How many ticks until score drops to targetTier (assuming all signals cleared).
   * Used by UI to display "X ticks to recover" tooltip.
   */
  public ticksToRecover(targetTier: PressureTier = PressureTier.CALM): number {
    const [minBound] = PRESSURE_TIER_BOUNDS[targetTier];
    return this.decay.ticksToReach(minBound);
  }
}
