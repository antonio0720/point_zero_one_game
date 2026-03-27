// backend/src/game/engine/core/OrchestratorDiagnostics.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/OrchestratorDiagnostics.ts
 *
 * Timing-based orchestration diagnostics layer for the Engine Core.
 *
 * Doctrine:
 * - observes tick lifecycle timing via explicit lifecycle hooks
 * - emits structured alerts when thresholds are crossed
 * - never writes engine state; purely observational
 * - deterministic relative to the clocks provided (injectable for tests)
 * - minimum history floor of 32 samples regardless of requested size
 *
 * Lifecycle hooks (call in order per tick):
 *   onTickScheduled(tickIndex, scheduledDurationMs, tier)
 *   onTickStarted()
 *   onStepCompleted(step, durationMs)       ← once per step
 *   onEventEmitted(count)                   ← once per emission batch
 *   onDecisionWindowCountUpdated(count)
 *   onFlushStarted()
 *   onTickCompleted()                       → returns TickDiagnosticsSample
 *
 *   onTierChanged(from, to)                 ← called any time tier changes
 *
 * Snapshot:
 *   getSnapshot()                           → DiagnosticsSnapshot
 *   getLastTickCompletedAtMs()              → number | null
 *   reset()
 *
 * Alert codes:
 *   SLOW_STEP           — single step exceeded maxAllowedSingleStepMs
 *   RUNAWAY_EVENT_VOLUME — event count exceeded RUNAWAY_EVENT_THRESHOLD (128)
 *   WINDOW_BACKLOG      — open decision windows exceeded threshold
 *   HIGH_TICK_DRIFT     — actualDurationMs - scheduledDurationMs > maxAllowedDriftMs
 *   SLOW_FLUSH          — flushDurationMs exceeded maxAllowedFlushMs
 *   TIER_OSCILLATION    — tier changed >= tierOscillationTripCount times in last
 *                         tierOscillationWindow samples
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum history floor — enforced even when a smaller size is requested. */
const MIN_HISTORY_FLOOR = 32;

/** Event volume threshold above which RUNAWAY_EVENT_VOLUME alert fires. */
const RUNAWAY_EVENT_THRESHOLD = 128;

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configurable thresholds for alert evaluation.
 * All fields are required; use `createDefaultThresholds()` or spread overrides.
 */
export interface OrchestratorDiagnosticThresholds {
  /** Max allowed drift between scheduled and actual tick duration (ms). */
  readonly maxAllowedDriftMs: number;
  /** Max allowed flush phase duration (ms). */
  readonly maxAllowedFlushMs: number;
  /** Max allowed duration for any single step (ms). */
  readonly maxAllowedSingleStepMs: number;
  /** Max allowed count of open decision windows at tick completion. */
  readonly maxAllowedOpenDecisionWindows: number;
  /** Number of recent tier values to inspect for oscillation. */
  readonly tierOscillationWindow: number;
  /** Number of tier changes within the window required to fire TIER_OSCILLATION. */
  readonly tierOscillationTripCount: number;
}

/** Default production thresholds. */
const DEFAULT_THRESHOLDS: OrchestratorDiagnosticThresholds = Object.freeze({
  maxAllowedDriftMs: 150,
  maxAllowedFlushMs: 32,
  maxAllowedSingleStepMs: 24,
  maxAllowedOpenDecisionWindows: 8,
  tierOscillationWindow: 8,
  tierOscillationTripCount: 4,
});

/** Alert severity codes. */
export type DiagnosticsAlertCode =
  | 'SLOW_STEP'
  | 'RUNAWAY_EVENT_VOLUME'
  | 'WINDOW_BACKLOG'
  | 'HIGH_TICK_DRIFT'
  | 'SLOW_FLUSH'
  | 'TIER_OSCILLATION';

/** Structured alert emitted when a threshold is crossed. */
export interface DiagnosticsAlert {
  readonly code: DiagnosticsAlertCode;
  readonly tickIndex: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Diagnostic sample produced by `onTickCompleted()` for a single tick.
 */
export interface TickDiagnosticsSample {
  readonly tickIndex: number;
  readonly tier: string | null;
  readonly scheduledDurationMs: number;
  readonly actualDurationMs: number;
  readonly driftMs: number;
  readonly stepDurationsMs: Readonly<Record<string, number>>;
  readonly flushDurationMs: number;
  readonly emittedEventCount: number;
  readonly openDecisionWindowCount: number;
  readonly timestamp: number;
}

/**
 * Aggregated diagnostics snapshot produced by `getSnapshot()`.
 */
export interface DiagnosticsSnapshot {
  readonly generatedAt: number;
  readonly totalTicksObserved: number;
  readonly lastTickIndex: number;
  readonly currentTier: string | null;
  readonly avgScheduledDurationMs: number;
  readonly avgActualDurationMs: number;
  readonly avgDriftMs: number;
  readonly maxDriftMs: number;
  readonly avgFlushDurationMs: number;
  readonly maxFlushDurationMs: number;
  readonly maxSingleStepMs: number;
  readonly totalEventsObserved: number;
  readonly avgEventsPerTick: number;
  readonly maxOpenDecisionWindowCount: number;
  readonly tierTransitionCount: number;
  readonly recentTierSequence: readonly string[];
  readonly alerts: readonly DiagnosticsAlert[];
  readonly lastTick: TickDiagnosticsSample | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function avg(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function safeMax(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY CLASS: OrchestratorDiagnostics (Core timing layer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core timing-based orchestration diagnostic observer.
 *
 * Usage:
 * ```typescript
 * const diag = new OrchestratorDiagnostics(thresholds, 256);
 * diag.onTickScheduled(tick, durationMs, tier);
 * diag.onTickStarted();
 * diag.onStepCompleted('STEP_03_PRESSURE', 12);
 * diag.onFlushStarted();
 * const sample = diag.onTickCompleted();
 * const snap = diag.getSnapshot();
 * ```
 */
export class OrchestratorDiagnostics {
  private readonly _thresholds: OrchestratorDiagnosticThresholds;

  private readonly _maxHistory: number;

  // ── Tick-in-progress state ─────────────────────────────────────────────────

  /** performance.now() captured at onTickStarted(). */
  private _tickStartPerf: number | null = null;

  /** performance.now() captured at onFlushStarted(). */
  private _flushStartPerf: number | null = null;

  /** Tick index set by onTickScheduled(). */
  private _currentTickIndex = 0;

  /** Tier set by onTickScheduled(). */
  private _currentTier: string | null = null;

  /** Scheduled duration set by onTickScheduled(). */
  private _scheduledDurationMs = 0;

  /** Step durations accumulated during current tick. */
  private _stepDurationsMs: Record<string, number> = {};

  /** Event count accumulated during current tick. */
  private _emittedEventCount = 0;

  /** Open decision window count at last update. */
  private _openDecisionWindowCount = 0;

  // ── History ────────────────────────────────────────────────────────────────

  private _tickSamples: TickDiagnosticsSample[] = [];

  private _alerts: DiagnosticsAlert[] = [];

  private _lastTickCompletedAtMs: number | null = null;

  // ── Tier tracking ──────────────────────────────────────────────────────────

  /** All tier values in sequence (newest last). Bounded to tierOscillationWindow. */
  private _recentTierSequence: string[] = [];

  private _tierTransitionCount = 0;

  // ── Session totals ─────────────────────────────────────────────────────────

  private _totalEventsObserved = 0;

  public constructor(
    thresholds: OrchestratorDiagnosticThresholds = DEFAULT_THRESHOLDS,
    maxHistory = 256,
  ) {
    this._thresholds = thresholds;
    this._maxHistory = Math.max(MIN_HISTORY_FLOOR, maxHistory);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE HOOKS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Call at the beginning of tick scheduling, before any engine runs.
   * Records the scheduled parameters for this tick.
   */
  public onTickScheduled(
    tickIndex: number,
    scheduledDurationMs: number,
    tier: string | null,
  ): void {
    this._currentTickIndex = tickIndex;
    this._scheduledDurationMs = scheduledDurationMs;
    this._currentTier = tier;
    this._stepDurationsMs = {};
    this._emittedEventCount = 0;
    this._openDecisionWindowCount = 0;
  }

  /**
   * Call immediately before tick execution begins.
   * Captures the performance timer start.
   */
  public onTickStarted(): void {
    this._tickStartPerf = performance.now();
    this._flushStartPerf = null;
  }

  /**
   * Call each time a step completes during tick execution.
   * Accumulates step timing for per-step analysis and SLOW_STEP alerts.
   */
  public onStepCompleted(step: string, durationMs: number): void {
    this._stepDurationsMs[step] = durationMs;
  }

  /**
   * Call when events are emitted during tick execution.
   * Accumulates toward RUNAWAY_EVENT_VOLUME threshold.
   */
  public onEventEmitted(count: number): void {
    this._emittedEventCount += count;
    this._totalEventsObserved += count;
  }

  /**
   * Call when the open decision window count changes.
   * Records the current count for WINDOW_BACKLOG evaluation.
   */
  public onDecisionWindowCountUpdated(count: number): void {
    this._openDecisionWindowCount = count;
  }

  /**
   * Call immediately before the flush phase begins.
   * Captures the flush timer start.
   */
  public onFlushStarted(): void {
    this._flushStartPerf = performance.now();
  }

  /**
   * Call when the tick fully completes (after flush).
   * Computes the TickDiagnosticsSample, evaluates alerts, and stores the sample.
   *
   * @returns The completed TickDiagnosticsSample.
   */
  public onTickCompleted(): TickDiagnosticsSample {
    const nowPerf = performance.now();
    const nowWall = Date.now();

    const tickStart = this._tickStartPerf ?? nowPerf;
    const flushStart = this._flushStartPerf ?? nowPerf;

    const actualDurationMs = nowPerf - tickStart;
    const driftMs = actualDurationMs - this._scheduledDurationMs;
    const flushDurationMs = nowPerf - flushStart;

    const sample: TickDiagnosticsSample = Object.freeze({
      tickIndex: this._currentTickIndex,
      tier: this._currentTier,
      scheduledDurationMs: this._scheduledDurationMs,
      actualDurationMs,
      driftMs,
      stepDurationsMs: Object.freeze({ ...this._stepDurationsMs }),
      flushDurationMs,
      emittedEventCount: this._emittedEventCount,
      openDecisionWindowCount: this._openDecisionWindowCount,
      timestamp: nowWall,
    });

    // ── Evaluate and record alerts ──────────────────────────────────────────
    this._evaluateAlerts(sample);

    // ── Store sample ────────────────────────────────────────────────────────
    this._tickSamples.push(sample);
    if (this._tickSamples.length > this._maxHistory) {
      this._tickSamples.shift();
    }

    this._lastTickCompletedAtMs = nowWall;

    return sample;
  }

  /**
   * Call when the engine's pressure tier changes.
   * Tracks tier transitions and evaluates TIER_OSCILLATION.
   */
  public onTierChanged(from: string | null, to: string): void {
    this._tierTransitionCount += 1;
    this._recentTierSequence.push(to);

    const window = this._thresholds.tierOscillationWindow;
    if (this._recentTierSequence.length > window) {
      this._recentTierSequence.shift();
    }

    this._evaluateTierOscillation();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ SURFACE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the last tick completed timestamp (wall clock, ms) or null.
   */
  public getLastTickCompletedAtMs(): number | null {
    return this._lastTickCompletedAtMs;
  }

  /**
   * Build and return the current aggregated diagnostics snapshot.
   */
  public getSnapshot(): DiagnosticsSnapshot {
    const samples = this._tickSamples;
    const count = Math.min(samples.length, this._maxHistory);

    const scheduledDurations = samples.map((s) => s.scheduledDurationMs);
    const actualDurations = samples.map((s) => s.actualDurationMs);
    const drifts = samples.map((s) => s.driftMs);
    const flushDurations = samples.map((s) => s.flushDurationMs);
    const stepMaxes = samples.map((s) =>
      Object.values(s.stepDurationsMs).length > 0
        ? Math.max(...Object.values(s.stepDurationsMs))
        : 0,
    );

    const lastSample = samples.length > 0 ? samples[samples.length - 1] ?? null : null;
    const lastTickIndex = lastSample?.tickIndex ?? 0;

    return Object.freeze({
      generatedAt: Date.now(),
      totalTicksObserved: count,
      lastTickIndex,
      currentTier: this._currentTier,
      avgScheduledDurationMs: avg(scheduledDurations),
      avgActualDurationMs: avg(actualDurations),
      avgDriftMs: avg(drifts),
      maxDriftMs: safeMax(drifts),
      avgFlushDurationMs: avg(flushDurations),
      maxFlushDurationMs: safeMax(flushDurations),
      maxSingleStepMs: safeMax(stepMaxes),
      totalEventsObserved: this._totalEventsObserved,
      avgEventsPerTick: count > 0 ? this._totalEventsObserved / count : 0,
      maxOpenDecisionWindowCount: safeMax(samples.map((s) => s.openDecisionWindowCount)),
      tierTransitionCount: this._tierTransitionCount,
      recentTierSequence: Object.freeze([...this._recentTierSequence]),
      alerts: Object.freeze([...this._alerts]),
      lastTick: lastSample,
    });
  }

  /**
   * Reset all history, counters, alerts, and transient state.
   * Registry/bus references are not affected.
   */
  public reset(): void {
    this._tickSamples = [];
    this._alerts = [];
    this._lastTickCompletedAtMs = null;
    this._tickStartPerf = null;
    this._flushStartPerf = null;
    this._currentTickIndex = 0;
    this._currentTier = null;
    this._scheduledDurationMs = 0;
    this._stepDurationsMs = {};
    this._emittedEventCount = 0;
    this._openDecisionWindowCount = 0;
    this._recentTierSequence = [];
    this._tierTransitionCount = 0;
    this._totalEventsObserved = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ALERT EVALUATION (PRIVATE)
  // ─────────────────────────────────────────────────────────────────────────

  private _evaluateAlerts(sample: TickDiagnosticsSample): void {
    const { maxAllowedSingleStepMs, maxAllowedDriftMs, maxAllowedFlushMs, maxAllowedOpenDecisionWindows } =
      this._thresholds;

    // SLOW_STEP
    for (const [step, durationMs] of Object.entries(sample.stepDurationsMs)) {
      if (durationMs > maxAllowedSingleStepMs) {
        this._alerts.push(
          Object.freeze({
            code: 'SLOW_STEP',
            tickIndex: sample.tickIndex,
            metadata: Object.freeze({ step, durationMs }),
          }),
        );
      }
    }

    // RUNAWAY_EVENT_VOLUME
    if (sample.emittedEventCount > RUNAWAY_EVENT_THRESHOLD) {
      this._alerts.push(
        Object.freeze({
          code: 'RUNAWAY_EVENT_VOLUME',
          tickIndex: sample.tickIndex,
          metadata: Object.freeze({ currentEventCount: sample.emittedEventCount }),
        }),
      );
    }

    // WINDOW_BACKLOG
    if (sample.openDecisionWindowCount > maxAllowedOpenDecisionWindows) {
      this._alerts.push(
        Object.freeze({
          code: 'WINDOW_BACKLOG',
          tickIndex: sample.tickIndex,
          metadata: Object.freeze({
            openDecisionWindowCount: sample.openDecisionWindowCount,
            threshold: maxAllowedOpenDecisionWindows,
          }),
        }),
      );
    }

    // HIGH_TICK_DRIFT
    if (sample.driftMs > maxAllowedDriftMs) {
      this._alerts.push(
        Object.freeze({
          code: 'HIGH_TICK_DRIFT',
          tickIndex: sample.tickIndex,
          metadata: Object.freeze({
            scheduledDurationMs: sample.scheduledDurationMs,
            actualDurationMs: sample.actualDurationMs,
            driftMs: sample.driftMs,
          }),
        }),
      );
    }

    // SLOW_FLUSH
    if (sample.flushDurationMs > maxAllowedFlushMs) {
      this._alerts.push(
        Object.freeze({
          code: 'SLOW_FLUSH',
          tickIndex: sample.tickIndex,
          metadata: Object.freeze({
            flushDurationMs: sample.flushDurationMs,
            threshold: maxAllowedFlushMs,
          }),
        }),
      );
    }
  }

  private _evaluateTierOscillation(): void {
    const seq = this._recentTierSequence;
    if (seq.length < 2) return;

    const { tierOscillationTripCount } = this._thresholds;
    let changes = 0;

    for (let i = 1; i < seq.length; i++) {
      if (seq[i] !== seq[i - 1]) changes += 1;
    }

    if (changes >= tierOscillationTripCount) {
      this._alerts.push(
        Object.freeze({
          code: 'TIER_OSCILLATION',
          tickIndex: this._currentTickIndex,
          metadata: Object.freeze({
            recentTiers: Object.freeze([...seq]),
            changes,
          }),
        }),
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the default production thresholds.
 * Use spread to override specific fields.
 */
export function createDefaultOrchestratorDiagnosticThresholds(
  overrides: Partial<OrchestratorDiagnosticThresholds> = {},
): OrchestratorDiagnosticThresholds {
  return Object.freeze({ ...DEFAULT_THRESHOLDS, ...overrides });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export { DEFAULT_THRESHOLDS as ORCHESTRATOR_DIAGNOSTIC_DEFAULT_THRESHOLDS };
export { RUNAWAY_EVENT_THRESHOLD };
export { MIN_HISTORY_FLOOR };
