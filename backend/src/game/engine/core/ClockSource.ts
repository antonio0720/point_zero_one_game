/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/ClockSource.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation surface
 * - deterministic clocks drive replayable simulation
 * - wall clock is allowed only at the edge, never as authoritative state
 * - every tick boundary is a first-class event with ML context
 * - clock drift between simulation and wall time is a telemetry signal
 * - registry enables multi-run orchestration and parallel simulation
 * - phase and pressure tier crossings are clock-anchored events
 */

// ---------------------------------------------------------------------------
// Core clock interfaces
// ---------------------------------------------------------------------------

export interface ClockSource {
  now(): number;
}

export interface MutableClockSource extends ClockSource {
  set(nextMs: number): void;
  advance(deltaMs: number): number;
  clone(): MutableClockSource;
}

// ---------------------------------------------------------------------------
// Clock precision and policy types
// ---------------------------------------------------------------------------

/**
 * Precision level controls how a clock handles sub-millisecond values.
 * MILLISECOND is the default and the only safe level for deterministic replay.
 * MICROSECOND is available for profiling and telemetry surfaces only.
 */
export type ClockPrecision = 'MILLISECOND' | 'MICROSECOND';

/**
 * Sync behavior when a deterministic clock receives a new external reference.
 * - STRICT: reject any external time that would move the clock backwards
 * - TOLERANT: silently clamp backwards movement to current value
 * - RESET: allow backwards movement (only valid in test/replay contexts)
 */
export type ClockSyncMode = 'STRICT' | 'TOLERANT' | 'RESET';

/**
 * Direction of a tier or phase crossing relative to the simulation timeline.
 */
export type ClockCrossingDirection = 'UP' | 'DOWN' | 'STABLE';

/**
 * Clock boundary type — what triggered a boundary event.
 */
export type ClockBoundaryKind =
  | 'PHASE_FOUNDATION'
  | 'PHASE_ESCALATION'
  | 'PHASE_SOVEREIGNTY'
  | 'TIER_T0'
  | 'TIER_T1'
  | 'TIER_T2'
  | 'TIER_T3'
  | 'TIER_T4'
  | 'TICK_MILESTONE'
  | 'TIME_MILESTONE'
  | 'ENDGAME'
  | 'RUN_START'
  | 'RUN_END';

/**
 * Tick rate classification derived from the interval between consecutive ticks.
 */
export type TickRateClass =
  | 'FAST'       // < 5s avg
  | 'STANDARD'   // 5–10s avg
  | 'SLOW'       // 10–20s avg
  | 'STALLED'    // > 20s avg or no ticks
  | 'UNKNOWN';

// ---------------------------------------------------------------------------
// Clock snapshot — serializable for replay and proof chains
// ---------------------------------------------------------------------------

export interface ClockSnapshotState {
  readonly currentMs: number;
  readonly advanceCount: number;
  readonly totalAdvancedMs: number;
  readonly lastAdvanceDeltaMs: number;
  readonly minDeltaMs: number;
  readonly maxDeltaMs: number;
  readonly avgDeltaMs: number;
  readonly createdAtMs: number;
  readonly precision: ClockPrecision;
}

// ---------------------------------------------------------------------------
// Clock boundary event
// ---------------------------------------------------------------------------

export interface ClockBoundaryEvent {
  readonly kind: ClockBoundaryKind;
  readonly simulationMs: number;
  readonly wallMs: number;
  readonly tick: number;
  readonly driftMs: number;
  readonly direction: ClockCrossingDirection;
  readonly label: string;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

// ---------------------------------------------------------------------------
// Clock drift record — emitted when drift exceeds threshold
// ---------------------------------------------------------------------------

export interface ClockDriftRecord {
  readonly simulationMs: number;
  readonly wallMs: number;
  readonly driftMs: number;
  readonly driftRatio: number;
  readonly capturedAtMs: number;
  readonly severity: 'OK' | 'WARN' | 'CRITICAL';
  readonly notes: readonly string[];
}

// ---------------------------------------------------------------------------
// Tick rate sample — used by TickRateAnalyzer
// ---------------------------------------------------------------------------

export interface TickRateSample {
  readonly tick: number;
  readonly simulationMs: number;
  readonly wallMs: number;
  readonly intervalMs: number;
  readonly expectedIntervalMs: number;
  readonly deltaFromExpected: number;
}

export interface TickRateReport {
  readonly sampleCount: number;
  readonly avgIntervalMs: number;
  readonly minIntervalMs: number;
  readonly maxIntervalMs: number;
  readonly stdDevMs: number;
  readonly rateClass: TickRateClass;
  readonly outlierCount: number;
  readonly recentSamples: readonly TickRateSample[];
}

// ---------------------------------------------------------------------------
// Clock telemetry — comprehensive per-run clock health report
// ---------------------------------------------------------------------------

export interface ClockTelemetry {
  readonly runId: string;
  readonly mode: string;
  readonly totalTicks: number;
  readonly totalSimulationMs: number;
  readonly totalWallMs: number;
  readonly avgTickDurationMs: number;
  readonly minTickDurationMs: number;
  readonly maxTickDurationMs: number;
  readonly peakDriftMs: number;
  readonly avgDriftMs: number;
  readonly driftWarningCount: number;
  readonly driftCriticalCount: number;
  readonly boundaryEvents: readonly ClockBoundaryEvent[];
  readonly driftRecords: readonly ClockDriftRecord[];
  readonly tickRateReport: TickRateReport;
  readonly mlVector: ClockMLVector;
}

// ---------------------------------------------------------------------------
// Clock ML vector — 16 features for downstream ML/DL consumers
// ---------------------------------------------------------------------------

export interface ClockMLVector {
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly capturedAtSimMs: number;
  readonly capturedAtWallMs: number;
}

export const CLOCK_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'tick_rate_normalized',
  'avg_delta_normalized',
  'min_delta_normalized',
  'max_delta_normalized',
  'drift_ratio',
  'drift_severity_normalized',
  'boundary_rate',
  'elapsed_ratio',
  'advance_count_normalized',
  'total_drift_normalized',
  'phase_crossing_rate',
  'tier_crossing_rate',
  'tick_milestone_rate',
  'endgame_proximity',
  'outlier_tick_ratio',
  'clock_health_score',
] as const);

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------

function assertFiniteTimestamp(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number. Received: ${String(value)}`);
  }
}

function assertFiniteDelta(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Clock delta must be a finite non-negative number. Received: ${String(value)}`);
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function roundTo(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ---------------------------------------------------------------------------
// Core clock implementations
// ---------------------------------------------------------------------------

/**
 * SystemClock is for adapters, API edges, logging, and operational timestamps.
 * It must never be treated as the authoritative simulation clock for a run.
 */
export class SystemClock implements ClockSource {
  public now(): number {
    return Date.now();
  }

  public toISOString(): string {
    return new Date(this.now()).toISOString();
  }

  public sinceMs(fromMs: number): number {
    return Math.max(0, this.now() - fromMs);
  }

  public isBefore(otherMs: number): boolean {
    return this.now() < otherMs;
  }

  public isAfter(otherMs: number): boolean {
    return this.now() > otherMs;
  }
}

/**
 * DeterministicClock is the canonical simulation clock.
 * It only moves when the runtime advances it.
 */
export class DeterministicClock implements MutableClockSource {
  private current: number;
  private _advanceCount = 0;
  private _totalAdvancedMs = 0;
  private _lastAdvanceDeltaMs = 0;
  private _minDeltaMs = Number.POSITIVE_INFINITY;
  private _maxDeltaMs = 0;
  private readonly _createdAtMs: number;
  private readonly _precision: ClockPrecision;
  private readonly _syncMode: ClockSyncMode;

  public constructor(
    initialMs = 0,
    options: {
      precision?: ClockPrecision;
      syncMode?: ClockSyncMode;
    } = {},
  ) {
    assertFiniteTimestamp(initialMs, 'DeterministicClock.initialMs');
    this.current = Math.trunc(initialMs);
    this._createdAtMs = Math.trunc(initialMs);
    this._precision = options.precision ?? 'MILLISECOND';
    this._syncMode = options.syncMode ?? 'STRICT';
  }

  public now(): number {
    return this.current;
  }

  public set(nextMs: number): void {
    assertFiniteTimestamp(nextMs, 'DeterministicClock.set(nextMs)');

    const normalized = Math.trunc(nextMs);

    if (normalized < this.current) {
      if (this._syncMode === 'STRICT') {
        throw new Error(
          `DeterministicClock cannot move backwards. Current=${this.current}, next=${normalized}`,
        );
      }

      if (this._syncMode === 'TOLERANT') {
        return; // silent clamp
      }

      // RESET mode: allow backwards movement (test/replay only)
    }

    this.current = normalized;
  }

  public advance(deltaMs: number): number {
    assertFiniteDelta(deltaMs);

    if (deltaMs === 0) {
      return this.current;
    }

    const delta = Math.trunc(deltaMs);
    this.current += delta;
    this._advanceCount += 1;
    this._totalAdvancedMs += delta;
    this._lastAdvanceDeltaMs = delta;
    if (delta < this._minDeltaMs) this._minDeltaMs = delta;
    if (delta > this._maxDeltaMs) this._maxDeltaMs = delta;

    return this.current;
  }

  public clone(): MutableClockSource {
    return new DeterministicClock(this.current, {
      precision: this._precision,
      syncMode: this._syncMode,
    });
  }

  /** Number of times advance() has been called. */
  public get advanceCount(): number {
    return this._advanceCount;
  }

  /** Total milliseconds advanced across all advance() calls. */
  public get totalAdvancedMs(): number {
    return this._totalAdvancedMs;
  }

  /** The delta applied in the most recent advance() call. */
  public get lastAdvanceDeltaMs(): number {
    return this._lastAdvanceDeltaMs;
  }

  /** Minimum observed advance delta. */
  public get minDeltaMs(): number {
    return this._minDeltaMs === Number.POSITIVE_INFINITY ? 0 : this._minDeltaMs;
  }

  /** Maximum observed advance delta. */
  public get maxDeltaMs(): number {
    return this._maxDeltaMs;
  }

  /** Average advance delta across all calls. */
  public get avgDeltaMs(): number {
    return this._advanceCount === 0 ? 0 : roundTo(this._totalAdvancedMs / this._advanceCount, 2);
  }

  /** Configured clock precision. */
  public get precision(): ClockPrecision {
    return this._precision;
  }

  /** Configured sync mode. */
  public get syncMode(): ClockSyncMode {
    return this._syncMode;
  }

  /** Serialize clock state for snapshot/replay. */
  public snapshot(): ClockSnapshotState {
    return Object.freeze({
      currentMs: this.current,
      advanceCount: this._advanceCount,
      totalAdvancedMs: this._totalAdvancedMs,
      lastAdvanceDeltaMs: this._lastAdvanceDeltaMs,
      minDeltaMs: this.minDeltaMs,
      maxDeltaMs: this._maxDeltaMs,
      avgDeltaMs: this.avgDeltaMs,
      createdAtMs: this._createdAtMs,
      precision: this._precision,
    });
  }

  /** Restore clock from snapshot (RESET mode required for backwards movement). */
  public restoreSnapshot(state: ClockSnapshotState): void {
    this.current = state.currentMs;
    this._advanceCount = state.advanceCount;
    this._totalAdvancedMs = state.totalAdvancedMs;
    this._lastAdvanceDeltaMs = state.lastAdvanceDeltaMs;
    this._minDeltaMs = state.minDeltaMs === 0 ? Number.POSITIVE_INFINITY : state.minDeltaMs;
    this._maxDeltaMs = state.maxDeltaMs;
  }

  /** Human-readable diagnostics string. */
  public diagnostics(): string {
    return [
      `DeterministicClock{`,
      `  current=${this.current}ms`,
      `  advances=${this._advanceCount}`,
      `  total=${this._totalAdvancedMs}ms`,
      `  last=${this._lastAdvanceDeltaMs}ms`,
      `  min=${this.minDeltaMs}ms`,
      `  max=${this._maxDeltaMs}ms`,
      `  avg=${this.avgDeltaMs}ms`,
      `  precision=${this._precision}`,
      `  syncMode=${this._syncMode}`,
      `}`,
    ].join('\n');
  }
}

/**
 * OffsetClock is useful when an adapter wants a stable simulation-relative view
 * over another clock source without mutating the underlying source.
 */
export class OffsetClock implements ClockSource {
  private readonly _offsetMs: number;

  public constructor(
    private readonly baseClock: ClockSource,
    offsetMs: number,
  ) {
    assertFiniteTimestamp(offsetMs, 'OffsetClock.offsetMs');
    this._offsetMs = offsetMs;
  }

  public now(): number {
    return Math.trunc(this.baseClock.now() + this._offsetMs);
  }

  public get offsetMs(): number {
    return this._offsetMs;
  }

  public withOffset(additionalOffsetMs: number): OffsetClock {
    return new OffsetClock(this.baseClock, this._offsetMs + additionalOffsetMs);
  }

  public withZeroOffset(): ClockSource {
    return this.baseClock;
  }
}

/**
 * FrozenClock is a read-only fixed-time source for snapshotting, tests,
 * and deterministic verification paths where mutation is forbidden.
 */
export class FrozenClock implements ClockSource {
  private readonly timestampMs: number;

  public constructor(timestampMs: number) {
    assertFiniteTimestamp(timestampMs, 'FrozenClock.timestampMs');
    this.timestampMs = Math.trunc(timestampMs);
  }

  public now(): number {
    return this.timestampMs;
  }

  public isFrozen(): boolean {
    return true;
  }

  public sinceMs(referenceMs: number): number {
    return Math.max(0, this.timestampMs - referenceMs);
  }
}

/**
 * SteppedClock advances automatically on a fixed interval — useful for
 * deterministic test scenarios where time progresses tick-by-tick without
 * explicit advance() calls.
 */
export class SteppedClock implements MutableClockSource {
  private current: number;
  private readonly stepMs: number;
  private stepCount = 0;

  public constructor(initialMs = 0, stepMs = 8_000) {
    assertFiniteTimestamp(initialMs, 'SteppedClock.initialMs');
    assertFiniteDelta(stepMs);
    this.current = Math.trunc(initialMs);
    this.stepMs = Math.trunc(stepMs);
  }

  public now(): number {
    return this.current;
  }

  public set(nextMs: number): void {
    assertFiniteTimestamp(nextMs, 'SteppedClock.set(nextMs)');
    this.current = Math.trunc(nextMs);
  }

  public advance(deltaMs?: number): number {
    const delta = deltaMs !== undefined ? Math.trunc(deltaMs) : this.stepMs;
    assertFiniteDelta(delta);
    this.current += delta;
    this.stepCount += 1;
    return this.current;
  }

  public clone(): MutableClockSource {
    const cloned = new SteppedClock(this.current, this.stepMs);
    cloned.stepCount = this.stepCount;
    return cloned;
  }

  public step(): number {
    return this.advance(this.stepMs);
  }

  public get totalSteps(): number {
    return this.stepCount;
  }

  public get configuredStepMs(): number {
    return this.stepMs;
  }
}

// ---------------------------------------------------------------------------
// ClockBoundaryTracker — records phase/tier/milestone crossings
// ---------------------------------------------------------------------------

export class ClockBoundaryTracker {
  private readonly events: ClockBoundaryEvent[] = [];
  private readonly maxEvents: number;
  private lastWallMs = 0;

  public constructor(maxEvents = 500) {
    this.maxEvents = maxEvents;
    this.lastWallMs = Date.now();
  }

  public record(event: ClockBoundaryEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  public recordPhase(
    phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    simulationMs: number,
    tick: number,
    previousPhase: string,
    tickDurationMs: number,
  ): ClockBoundaryEvent {
    const wallMs = Date.now();
    const driftMs = Math.abs(simulationMs - (wallMs - this.lastWallMs));
    const kind: ClockBoundaryKind =
      phase === 'FOUNDATION' ? 'PHASE_FOUNDATION' :
      phase === 'ESCALATION' ? 'PHASE_ESCALATION' :
      'PHASE_SOVEREIGNTY';

    const event: ClockBoundaryEvent = {
      kind,
      simulationMs,
      wallMs,
      tick,
      driftMs,
      direction: 'UP',
      label: `Phase crossed: ${previousPhase} → ${phase}`,
      metadata: {
        phase,
        previousPhase,
        tick,
        tickDurationMs,
        wallMs,
      },
    };

    this.record(event);
    return event;
  }

  public recordTier(
    tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4',
    simulationMs: number,
    tick: number,
    previousTier: string,
    direction: ClockCrossingDirection,
    tickDurationMs: number,
  ): ClockBoundaryEvent {
    const wallMs = Date.now();
    const driftMs = Math.abs(simulationMs - (wallMs - this.lastWallMs));
    const kind: ClockBoundaryKind =
      tier === 'T0' ? 'TIER_T0' :
      tier === 'T1' ? 'TIER_T1' :
      tier === 'T2' ? 'TIER_T2' :
      tier === 'T3' ? 'TIER_T3' :
      'TIER_T4';

    const event: ClockBoundaryEvent = {
      kind,
      simulationMs,
      wallMs,
      tick,
      driftMs,
      direction,
      label: `Tier crossed: ${previousTier} → ${tier}`,
      metadata: {
        tier,
        previousTier,
        tick,
        tickDurationMs,
        direction,
        wallMs,
      },
    };

    this.record(event);
    return event;
  }

  public recordTickMilestone(
    tick: number,
    simulationMs: number,
    label: string,
    tickDurationMs: number,
  ): ClockBoundaryEvent {
    const wallMs = Date.now();
    const driftMs = Math.abs(simulationMs - (wallMs - this.lastWallMs));

    const event: ClockBoundaryEvent = {
      kind: 'TICK_MILESTONE',
      simulationMs,
      wallMs,
      tick,
      driftMs,
      direction: 'STABLE',
      label,
      metadata: {
        tick,
        simulationMs,
        wallMs,
        tickDurationMs,
      },
    };

    this.record(event);
    return event;
  }

  public recordRunStart(simulationMs: number, mode: string): ClockBoundaryEvent {
    this.lastWallMs = Date.now();
    const event: ClockBoundaryEvent = {
      kind: 'RUN_START',
      simulationMs,
      wallMs: this.lastWallMs,
      tick: 0,
      driftMs: 0,
      direction: 'STABLE',
      label: `Run started: mode=${mode}`,
      metadata: {
        mode,
        simulationMs,
        wallMs: this.lastWallMs,
      },
    };
    this.record(event);
    return event;
  }

  public recordRunEnd(simulationMs: number, tick: number, outcome: string): ClockBoundaryEvent {
    const wallMs = Date.now();
    const event: ClockBoundaryEvent = {
      kind: 'RUN_END',
      simulationMs,
      wallMs,
      tick,
      driftMs: 0,
      direction: 'STABLE',
      label: `Run ended: outcome=${outcome}, tick=${String(tick)}`,
      metadata: {
        outcome,
        tick,
        simulationMs,
        wallMs,
        totalWallMs: wallMs - this.lastWallMs,
      },
    };
    this.record(event);
    return event;
  }

  public recordEndgame(simulationMs: number, tick: number, remainingMs: number): ClockBoundaryEvent {
    const wallMs = Date.now();
    const event: ClockBoundaryEvent = {
      kind: 'ENDGAME',
      simulationMs,
      wallMs,
      tick,
      driftMs: 0,
      direction: 'STABLE',
      label: `Endgame entered: remaining=${String(remainingMs)}ms`,
      metadata: {
        tick,
        simulationMs,
        remainingMs,
        wallMs,
      },
    };
    this.record(event);
    return event;
  }

  public listByKind(kind: ClockBoundaryKind): readonly ClockBoundaryEvent[] {
    return Object.freeze(this.events.filter((e) => e.kind === kind));
  }

  public listRecent(limit = 20): readonly ClockBoundaryEvent[] {
    const slice = this.events.slice(Math.max(0, this.events.length - limit));
    return Object.freeze(slice);
  }

  public listAll(): readonly ClockBoundaryEvent[] {
    return Object.freeze([...this.events]);
  }

  public countByKind(): Readonly<Record<ClockBoundaryKind, number>> {
    const counts: Record<string, number> = {};
    for (const event of this.events) {
      counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    }
    return Object.freeze(counts) as Readonly<Record<ClockBoundaryKind, number>>;
  }

  public clear(): void {
    this.events.length = 0;
  }

  public get totalCount(): number {
    return this.events.length;
  }
}

// ---------------------------------------------------------------------------
// ClockDriftMonitor — tracks drift between simulation and wall time
// ---------------------------------------------------------------------------

export interface ClockDriftOptions {
  readonly warnThresholdMs?: number;
  readonly criticalThresholdMs?: number;
  readonly maxRecords?: number;
}

export class ClockDriftMonitor {
  private readonly records: ClockDriftRecord[] = [];
  private readonly warnThresholdMs: number;
  private readonly criticalThresholdMs: number;
  private readonly maxRecords: number;
  private runStartSimMs = 0;
  private runStartWallMs = 0;
  private totalDriftMs = 0;
  private peakDriftMs = 0;
  private warnCount = 0;
  private criticalCount = 0;

  public constructor(options: ClockDriftOptions = {}) {
    this.warnThresholdMs = options.warnThresholdMs ?? 2_000;
    this.criticalThresholdMs = options.criticalThresholdMs ?? 8_000;
    this.maxRecords = options.maxRecords ?? 200;
  }

  public initialize(simMs: number): void {
    this.runStartSimMs = simMs;
    this.runStartWallMs = Date.now();
    this.records.length = 0;
    this.totalDriftMs = 0;
    this.peakDriftMs = 0;
    this.warnCount = 0;
    this.criticalCount = 0;
  }

  public sample(simulationMs: number): ClockDriftRecord {
    const wallMs = Date.now();
    const simElapsed = simulationMs - this.runStartSimMs;
    const wallElapsed = wallMs - this.runStartWallMs;
    const driftMs = Math.abs(simElapsed - wallElapsed);
    const driftRatio = wallElapsed === 0 ? 0 : driftMs / wallElapsed;

    this.totalDriftMs += driftMs;
    if (driftMs > this.peakDriftMs) this.peakDriftMs = driftMs;

    const severity: ClockDriftRecord['severity'] =
      driftMs >= this.criticalThresholdMs ? 'CRITICAL' :
      driftMs >= this.warnThresholdMs ? 'WARN' :
      'OK';

    if (severity === 'WARN') this.warnCount += 1;
    if (severity === 'CRITICAL') this.criticalCount += 1;

    const notes: string[] = [];
    if (severity === 'CRITICAL') {
      notes.push(
        `Critical drift: simulation is ${String(driftMs)}ms away from wall time.`,
        `Ratio: ${String(roundTo(driftRatio, 3))}`,
      );
    } else if (severity === 'WARN') {
      notes.push(`Drift warning: ${String(driftMs)}ms above threshold.`);
    }

    const record: ClockDriftRecord = {
      simulationMs,
      wallMs,
      driftMs,
      driftRatio: roundTo(driftRatio, 4),
      capturedAtMs: wallMs,
      severity,
      notes: Object.freeze(notes),
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }

    return record;
  }

  public get peakDrift(): number {
    return this.peakDriftMs;
  }

  public get avgDrift(): number {
    return this.records.length === 0 ? 0 : roundTo(this.totalDriftMs / this.records.length, 2);
  }

  public get warningSampleCount(): number {
    return this.warnCount;
  }

  public get criticalSampleCount(): number {
    return this.criticalCount;
  }

  public listRecords(limit = 20): readonly ClockDriftRecord[] {
    const slice = this.records.slice(Math.max(0, this.records.length - limit));
    return Object.freeze(slice);
  }

  public listCritical(): readonly ClockDriftRecord[] {
    return Object.freeze(this.records.filter((r) => r.severity === 'CRITICAL'));
  }

  public isHealthy(): boolean {
    return this.criticalCount === 0;
  }

  public reset(): void {
    this.records.length = 0;
    this.totalDriftMs = 0;
    this.peakDriftMs = 0;
    this.warnCount = 0;
    this.criticalCount = 0;
  }
}

// ---------------------------------------------------------------------------
// TickRateAnalyzer — measures and analyzes tick frequency trends
// ---------------------------------------------------------------------------

export interface TickRateAnalyzerOptions {
  readonly expectedIntervalMs?: number;
  readonly outlierThresholdMultiplier?: number;
  readonly maxSamples?: number;
}

export class TickRateAnalyzer {
  private readonly samples: TickRateSample[] = [];
  private readonly expectedIntervalMs: number;
  private readonly outlierThreshold: number;
  private readonly maxSamples: number;
  private lastWallMs = 0;

  public constructor(options: TickRateAnalyzerOptions = {}) {
    this.expectedIntervalMs = options.expectedIntervalMs ?? 8_000;
    this.outlierThreshold = options.outlierThresholdMultiplier ?? 2.0;
    this.maxSamples = options.maxSamples ?? 500;
    this.lastWallMs = Date.now();
  }

  public recordTick(tick: number, simulationMs: number): TickRateSample {
    const wallMs = Date.now();
    const intervalMs = this.samples.length === 0 ? this.expectedIntervalMs : wallMs - this.lastWallMs;
    const deltaFromExpected = intervalMs - this.expectedIntervalMs;

    const sample: TickRateSample = {
      tick,
      simulationMs,
      wallMs,
      intervalMs,
      expectedIntervalMs: this.expectedIntervalMs,
      deltaFromExpected,
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }

    this.lastWallMs = wallMs;
    return sample;
  }

  public buildReport(): TickRateReport {
    if (this.samples.length === 0) {
      return Object.freeze({
        sampleCount: 0,
        avgIntervalMs: 0,
        minIntervalMs: 0,
        maxIntervalMs: 0,
        stdDevMs: 0,
        rateClass: 'UNKNOWN' as TickRateClass,
        outlierCount: 0,
        recentSamples: [],
      });
    }

    const intervals = this.samples.map((s) => s.intervalMs);
    const sum = intervals.reduce((a, b) => a + b, 0);
    const avg = sum / intervals.length;
    const min = Math.min(...intervals);
    const max = Math.max(...intervals);

    const variance = intervals.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    const outlierThreshold = avg * this.outlierThreshold;
    const outlierCount = intervals.filter((v) => v > outlierThreshold).length;

    const rateClass: TickRateClass =
      avg < 5_000 ? 'FAST' :
      avg < 10_000 ? 'STANDARD' :
      avg < 20_000 ? 'SLOW' :
      'STALLED';

    const recentSamples = this.samples.slice(Math.max(0, this.samples.length - 10));

    return Object.freeze({
      sampleCount: this.samples.length,
      avgIntervalMs: roundTo(avg, 2),
      minIntervalMs: min,
      maxIntervalMs: max,
      stdDevMs: roundTo(stdDev, 2),
      rateClass,
      outlierCount,
      recentSamples: Object.freeze(recentSamples),
    });
  }

  public getRateClass(): TickRateClass {
    return this.buildReport().rateClass;
  }

  public reset(): void {
    this.samples.length = 0;
    this.lastWallMs = Date.now();
  }
}

// ---------------------------------------------------------------------------
// ClockMLVectorBuilder — builds 16-feature ML vector from clock state
// ---------------------------------------------------------------------------

export class ClockMLVectorBuilder {
  /**
   * Build a 16-feature normalized ML vector from clock telemetry data.
   * All features are normalized to [0, 1].
   */
  public static build(
    clock: DeterministicClock,
    driftMonitor: ClockDriftMonitor,
    boundaryTracker: ClockBoundaryTracker,
    rateAnalyzer: TickRateAnalyzer,
    seasonBudgetMs: number,
    tick: number,
  ): ClockMLVector {
    const nowMs = clock.now();
    const wallMs = Date.now();
    const rateReport = rateAnalyzer.buildReport();
    const boundaryCounts = boundaryTracker.countByKind();

    const avgDeltaNorm = clock.avgDeltaMs > 0
      ? clamp01(clock.avgDeltaMs / 30_000)
      : 0;
    const minDeltaNorm = clock.minDeltaMs > 0
      ? clamp01(clock.minDeltaMs / 30_000)
      : 0;
    const maxDeltaNorm = clock.maxDeltaMs > 0
      ? clamp01(clock.maxDeltaMs / 30_000)
      : 0;
    const elapsedRatio = seasonBudgetMs > 0 ? clamp01(nowMs / seasonBudgetMs) : 0;
    const advanceCountNorm = clamp01(clock.advanceCount / 500);
    const totalDriftNorm = clamp01(driftMonitor.peakDrift / 60_000);
    const driftRatio = driftMonitor.avgDrift > 0
      ? clamp01(driftMonitor.avgDrift / 10_000)
      : 0;
    const driftSeverityNorm = clamp01(
      (driftMonitor.warningSampleCount * 0.3 + driftMonitor.criticalSampleCount * 1.0) / 20,
    );

    const totalEvents = boundaryTracker.totalCount;
    const phaseCrossings = (boundaryCounts['PHASE_ESCALATION'] ?? 0) + (boundaryCounts['PHASE_SOVEREIGNTY'] ?? 0);
    const tierCrossings = (boundaryCounts['TIER_T1'] ?? 0) + (boundaryCounts['TIER_T2'] ?? 0) +
      (boundaryCounts['TIER_T3'] ?? 0) + (boundaryCounts['TIER_T4'] ?? 0);
    const tickMilestones = boundaryCounts['TICK_MILESTONE'] ?? 0;

    const boundaryRate = tick > 0 ? clamp01(totalEvents / tick) : 0;
    const phaseCrossingRate = tick > 0 ? clamp01(phaseCrossings / Math.max(1, tick / 20)) : 0;
    const tierCrossingRate = tick > 0 ? clamp01(tierCrossings / Math.max(1, tick / 10)) : 0;
    const tickMilestoneRate = tick > 0 ? clamp01(tickMilestones / tick) : 0;

    const endgameProximity = clamp01(
      (seasonBudgetMs > 0 && nowMs > seasonBudgetMs * 0.8)
        ? (nowMs - seasonBudgetMs * 0.8) / (seasonBudgetMs * 0.2)
        : 0,
    );

    const outlierRatio = rateReport.sampleCount > 0
      ? clamp01(rateReport.outlierCount / rateReport.sampleCount)
      : 0;

    const tickRateNorm = rateReport.avgIntervalMs > 0
      ? clamp01(rateReport.avgIntervalMs / 30_000)
      : 0;

    const healthScore = clamp01(
      1.0
      - driftSeverityNorm * 0.3
      - outlierRatio * 0.3
      - totalDriftNorm * 0.2
      - (rateReport.rateClass === 'STALLED' ? 0.2 : 0),
    );

    const features = Object.freeze([
      tickRateNorm,
      avgDeltaNorm,
      minDeltaNorm,
      maxDeltaNorm,
      driftRatio,
      driftSeverityNorm,
      boundaryRate,
      elapsedRatio,
      advanceCountNorm,
      totalDriftNorm,
      phaseCrossingRate,
      tierCrossingRate,
      tickMilestoneRate,
      endgameProximity,
      outlierRatio,
      healthScore,
    ] as const);

    return Object.freeze({
      features,
      featureLabels: CLOCK_ML_FEATURE_LABELS,
      capturedAtSimMs: nowMs,
      capturedAtWallMs: wallMs,
    });
  }
}

// ---------------------------------------------------------------------------
// ClockRegistry — named registry for multi-run / multi-clock management
// ---------------------------------------------------------------------------

export interface ClockRegistryEntry {
  readonly name: string;
  readonly clock: MutableClockSource;
  readonly createdAt: number;
  readonly tags: readonly string[];
}

export class ClockRegistry {
  private readonly entries = new Map<string, ClockRegistryEntry>();

  public register(
    name: string,
    clock: MutableClockSource,
    tags: readonly string[] = [],
  ): this {
    if (this.entries.has(name)) {
      throw new Error(`ClockRegistry: a clock named '${name}' is already registered.`);
    }

    this.entries.set(name, Object.freeze({
      name,
      clock,
      createdAt: Date.now(),
      tags: Object.freeze([...tags]),
    }));

    return this;
  }

  public get(name: string): MutableClockSource {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new Error(`ClockRegistry: no clock named '${name}'.`);
    }
    return entry.clock;
  }

  public maybeGet(name: string): MutableClockSource | null {
    return this.entries.get(name)?.clock ?? null;
  }

  public has(name: string): boolean {
    return this.entries.has(name);
  }

  public unregister(name: string): boolean {
    return this.entries.delete(name);
  }

  public listNames(): readonly string[] {
    return Object.freeze([...this.entries.keys()]);
  }

  public listEntries(): readonly ClockRegistryEntry[] {
    return Object.freeze([...this.entries.values()]);
  }

  public advanceAll(deltaMs: number): void {
    for (const entry of this.entries.values()) {
      entry.clock.advance(deltaMs);
    }
  }

  public nowAll(): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [name, entry] of this.entries.entries()) {
      result[name] = entry.clock.now();
    }
    return Object.freeze(result);
  }

  public reset(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }
}

// ---------------------------------------------------------------------------
// ClockTelemetryBuilder — builds full run telemetry report
// ---------------------------------------------------------------------------

export class ClockTelemetryBuilder {
  public static build(
    runId: string,
    mode: string,
    clock: DeterministicClock,
    driftMonitor: ClockDriftMonitor,
    boundaryTracker: ClockBoundaryTracker,
    rateAnalyzer: TickRateAnalyzer,
    seasonBudgetMs: number,
    tick: number,
  ): ClockTelemetry {
    const rateReport = rateAnalyzer.buildReport();
    const mlVector = ClockMLVectorBuilder.build(
      clock,
      driftMonitor,
      boundaryTracker,
      rateAnalyzer,
      seasonBudgetMs,
      tick,
    );

    return Object.freeze({
      runId,
      mode,
      totalTicks: tick,
      totalSimulationMs: clock.now(),
      totalWallMs: Date.now(),
      avgTickDurationMs: clock.avgDeltaMs,
      minTickDurationMs: clock.minDeltaMs,
      maxTickDurationMs: clock.maxDeltaMs,
      peakDriftMs: driftMonitor.peakDrift,
      avgDriftMs: driftMonitor.avgDrift,
      driftWarningCount: driftMonitor.warningSampleCount,
      driftCriticalCount: driftMonitor.criticalSampleCount,
      boundaryEvents: boundaryTracker.listAll(),
      driftRecords: driftMonitor.listRecords(),
      tickRateReport: rateReport,
      mlVector,
    });
  }
}

// ---------------------------------------------------------------------------
// ClockSyncPolicy — describes how a clock should be synchronized with a
// time policy resolver (wired into EngineOrchestrator + TimePolicyResolver)
// ---------------------------------------------------------------------------

export interface ClockSyncPolicy {
  readonly mode: string;
  readonly tier: string;
  readonly targetTickDurationMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly adaptiveMultiplier: number;
  readonly holdWindowMs: number;
  readonly policyVersion: string;
}

export function buildClockSyncPolicy(
  mode: string,
  tier: string,
  targetMs: number,
  minMs: number,
  maxMs: number,
  adaptiveMultiplier: number,
  holdWindowMs: number,
  policyVersion: string,
): ClockSyncPolicy {
  return Object.freeze({
    mode,
    tier,
    targetTickDurationMs: targetMs,
    minDurationMs: minMs,
    maxDurationMs: maxMs,
    adaptiveMultiplier,
    holdWindowMs,
    policyVersion,
  });
}

export function applySyncPolicyToClock(
  clock: DeterministicClock,
  policy: ClockSyncPolicy,
): number {
  const current = clock.now();
  const target = Math.trunc(
    Math.max(policy.minDurationMs, Math.min(policy.maxDurationMs, policy.targetTickDurationMs * policy.adaptiveMultiplier)),
  );

  if (target > 0 && current === 0) {
    return target;
  }

  return target;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Compute milliseconds remaining in a budget from the simulation clock's
 * current position. Returns 0 if already past budget.
 */
export function remainingBudgetMs(
  clock: ClockSource,
  seasonBudgetMs: number,
  extensionBudgetMs = 0,
): number {
  const totalBudget = seasonBudgetMs + extensionBudgetMs;
  return Math.max(0, totalBudget - clock.now());
}

/**
 * Compute elapsed ratio [0, 1] from the simulation clock vs budget.
 */
export function elapsedRatio(
  clock: ClockSource,
  seasonBudgetMs: number,
  extensionBudgetMs = 0,
): number {
  const totalBudget = seasonBudgetMs + extensionBudgetMs;
  if (totalBudget <= 0) return 1;
  return clamp01(clock.now() / totalBudget);
}

/**
 * Returns true if the simulation clock is in the final 10% of its budget.
 */
export function isEndgameTime(
  clock: ClockSource,
  seasonBudgetMs: number,
  extensionBudgetMs = 0,
  thresholdRatio = 0.9,
): boolean {
  return elapsedRatio(clock, seasonBudgetMs, extensionBudgetMs) >= thresholdRatio;
}

/**
 * Compute wall-drift diagnostic message for logs and telemetry.
 */
export function describeDrift(record: ClockDriftRecord): string {
  return `[${record.severity}] sim=${String(record.simulationMs)}ms wall=${String(record.wallMs)}ms drift=${String(record.driftMs)}ms ratio=${String(record.driftRatio)}`;
}

/**
 * Classify tick duration into a human-readable rate tier.
 */
export function classifyTickDuration(durationMs: number): TickRateClass {
  if (durationMs <= 0) return 'UNKNOWN';
  if (durationMs < 5_000) return 'FAST';
  if (durationMs < 10_000) return 'STANDARD';
  if (durationMs < 20_000) return 'SLOW';
  return 'STALLED';
}

/**
 * Format a simulation timestamp as a human-readable duration string.
 * e.g. 65_000 → "1m 5s"
 */
export function formatSimMs(simulationMs: number): string {
  const totalSeconds = Math.floor(simulationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${String(minutes)}m ${String(seconds)}s`;
  }

  return `${String(seconds)}s`;
}

/**
 * Compute the expected number of ticks before the budget expires.
 */
export function estimateRemainingTicks(
  clock: ClockSource,
  seasonBudgetMs: number,
  extensionBudgetMs: number,
  tickDurationMs: number,
): number {
  const remaining = remainingBudgetMs(clock, seasonBudgetMs, extensionBudgetMs);
  if (tickDurationMs <= 0) return 0;
  return Math.max(0, Math.floor(remaining / tickDurationMs));
}

/**
 * Returns true if two clock snapshots are identical (for replay verification).
 */
export function clockSnapshotsEqual(a: ClockSnapshotState, b: ClockSnapshotState): boolean {
  return (
    a.currentMs === b.currentMs &&
    a.advanceCount === b.advanceCount &&
    a.totalAdvancedMs === b.totalAdvancedMs &&
    a.precision === b.precision
  );
}

/**
 * Build a ClockSyncPolicy from a tier/mode string pair using default values.
 * The authoritative policy values come from TimePolicyContracts at runtime.
 */
export function defaultClockSyncPolicy(mode: string, tier: string): ClockSyncPolicy {
  const targetMs: Record<string, number> = {
    T0: 12_000, T1: 10_000, T2: 8_000, T3: 6_000, T4: 4_000,
  };

  const holdMs: Record<string, number> = {
    T0: 3_000, T1: 3_000, T2: 2_500, T3: 2_000, T4: 1_500,
  };

  return buildClockSyncPolicy(
    mode,
    tier,
    targetMs[tier] ?? 8_000,
    2_000,
    20_000,
    1.0,
    holdMs[tier] ?? 2_500,
    '1.0.0',
  );
}

// ---------------------------------------------------------------------------
// ClockDriftMonitor — tracks wall-clock vs simulation-clock divergence
// ---------------------------------------------------------------------------

export interface ClockDriftSample {
  readonly tick: number;
  readonly simulationMs: number;
  readonly wallMs: number;
  readonly driftMs: number;
  readonly driftRatio: number;
  readonly recordedAt: number;
}

export type ClockDriftSeverity = 'NOMINAL' | 'WARN' | 'CRITICAL';

export interface ClockDriftReport {
  readonly avgDriftMs: number;
  readonly maxDriftMs: number;
  readonly minDriftMs: number;
  readonly sampleCount: number;
  readonly severity: ClockDriftSeverity;
  readonly trend: 'GROWING' | 'SHRINKING' | 'STABLE';
  readonly latestDriftMs: number;
}

export class ClockDriftSampleMonitor {
  private readonly capacity: number;
  private readonly samples: ClockDriftSample[] = [];
  private readonly warnThresholdMs: number;
  private readonly criticalThresholdMs: number;

  public constructor(
    capacity = 60,
    warnThresholdMs = 200,
    criticalThresholdMs = 1_000,
  ) {
    this.capacity = capacity;
    this.warnThresholdMs = warnThresholdMs;
    this.criticalThresholdMs = criticalThresholdMs;
  }

  public record(tick: number, simulationMs: number, wallMs: number): ClockDriftSample {
    const driftMs = wallMs - simulationMs;
    const driftRatio = simulationMs > 0 ? Math.abs(driftMs) / simulationMs : 0;
    const sample: ClockDriftSample = Object.freeze({
      tick, simulationMs, wallMs, driftMs, driftRatio, recordedAt: Date.now(),
    });
    if (this.samples.length >= this.capacity) this.samples.shift();
    this.samples.push(sample);
    return sample;
  }

  public buildReport(): ClockDriftReport {
    if (this.samples.length === 0) {
      return Object.freeze({
        avgDriftMs: 0, maxDriftMs: 0, minDriftMs: 0,
        sampleCount: 0, severity: 'NOMINAL', trend: 'STABLE', latestDriftMs: 0,
      });
    }

    const drifts = this.samples.map(s => Math.abs(s.driftMs));
    const avgDriftMs = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    const maxDriftMs = Math.max(...drifts);
    const minDriftMs = Math.min(...drifts);
    const latestDriftMs = this.samples[this.samples.length - 1].driftMs;

    const severity: ClockDriftSeverity =
      maxDriftMs >= this.criticalThresholdMs ? 'CRITICAL' :
      maxDriftMs >= this.warnThresholdMs ? 'WARN' : 'NOMINAL';

    const half = Math.floor(this.samples.length / 2);
    const recentAvg = drifts.slice(-half).reduce((a, b) => a + b, 0) / Math.max(1, half);
    const olderAvg = drifts.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
    const trend: 'GROWING' | 'SHRINKING' | 'STABLE' =
      recentAvg > olderAvg + 20 ? 'GROWING' :
      recentAvg < olderAvg - 20 ? 'SHRINKING' : 'STABLE';

    return Object.freeze({ avgDriftMs, maxDriftMs, minDriftMs, sampleCount: this.samples.length, severity, trend, latestDriftMs });
  }

  public latestSample(): ClockDriftSample | undefined {
    return this.samples[this.samples.length - 1];
  }

  public all(): ReadonlyArray<ClockDriftSample> { return this.samples; }
  public clear(): void { this.samples.length = 0; }
}

// ---------------------------------------------------------------------------
// ClockTickBudget — tracks per-tick timing budget and violations
// ---------------------------------------------------------------------------

export interface ClockTickBudgetEntry {
  readonly tick: number;
  readonly budgetMs: number;
  readonly actualMs: number;
  readonly overrun: boolean;
  readonly overrunMs: number;
  readonly utilizationRatio: number;
}

export interface ClockTickBudgetReport {
  readonly totalTicks: number;
  readonly violationCount: number;
  readonly violationRate: number;
  readonly avgUtilization: number;
  readonly peakActualMs: number;
  readonly avgOverrunMs: number;
  readonly isHealthy: boolean;
}

export class ClockTickBudget {
  private readonly capacity: number;
  private readonly entries: ClockTickBudgetEntry[] = [];

  public constructor(capacity = 200) {
    this.capacity = capacity;
  }

  public record(tick: number, budgetMs: number, actualMs: number): ClockTickBudgetEntry {
    const overrun = actualMs > budgetMs;
    const overrunMs = overrun ? actualMs - budgetMs : 0;
    const utilizationRatio = budgetMs > 0 ? actualMs / budgetMs : 1;
    const entry: ClockTickBudgetEntry = Object.freeze({
      tick, budgetMs, actualMs, overrun, overrunMs, utilizationRatio,
    });
    if (this.entries.length >= this.capacity) this.entries.shift();
    this.entries.push(entry);
    return entry;
  }

  public buildReport(): ClockTickBudgetReport {
    if (this.entries.length === 0) {
      return Object.freeze({
        totalTicks: 0, violationCount: 0, violationRate: 0,
        avgUtilization: 0, peakActualMs: 0, avgOverrunMs: 0, isHealthy: true,
      });
    }

    const violations = this.entries.filter(e => e.overrun);
    const totalTicks = this.entries.length;
    const violationCount = violations.length;
    const violationRate = violationCount / totalTicks;
    const avgUtilization = this.entries.reduce((s, e) => s + e.utilizationRatio, 0) / totalTicks;
    const peakActualMs = Math.max(...this.entries.map(e => e.actualMs));
    const avgOverrunMs = violations.length > 0
      ? violations.reduce((s, e) => s + e.overrunMs, 0) / violations.length
      : 0;

    return Object.freeze({
      totalTicks, violationCount, violationRate,
      avgUtilization, peakActualMs, avgOverrunMs,
      isHealthy: violationRate < 0.05,
    });
  }

  public recentEntries(limit = 10): ReadonlyArray<ClockTickBudgetEntry> {
    return this.entries.slice(-limit);
  }

  public clear(): void { this.entries.length = 0; }
}

// ---------------------------------------------------------------------------
// ClockTickRateAnalyzer — computes actual tick rate vs target
// ---------------------------------------------------------------------------

export interface ClockTickRateSnapshot {
  readonly tick: number;
  readonly wallMs: number;
  readonly elapsedMs: number;
  readonly ticksPerSecond: number;
}

export interface ClockTickRateReport {
  readonly avgTicksPerSecond: number;
  readonly targetTicksPerSecond: number;
  readonly actualToTargetRatio: number;
  readonly isBelowTarget: boolean;
  readonly sampleCount: number;
}

export class ClockTickRateAnalyzer {
  private readonly snapshots: ClockTickRateSnapshot[] = [];
  private readonly capacity = 60;
  private readonly targetTicksPerSecond: number;

  public constructor(targetTicksPerSecond = 1) {
    this.targetTicksPerSecond = targetTicksPerSecond;
  }

  public record(tick: number, wallMs: number, elapsedMs: number): void {
    const ticksPerSecond = elapsedMs > 0 ? 1000 / elapsedMs : this.targetTicksPerSecond;
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(Object.freeze({ tick, wallMs, elapsedMs, ticksPerSecond }));
  }

  public buildReport(): ClockTickRateReport {
    if (this.snapshots.length === 0) {
      return Object.freeze({
        avgTicksPerSecond: 0, targetTicksPerSecond: this.targetTicksPerSecond,
        actualToTargetRatio: 1, isBelowTarget: false, sampleCount: 0,
      });
    }
    const avg = this.snapshots.reduce((s, r) => s + r.ticksPerSecond, 0) / this.snapshots.length;
    const ratio = this.targetTicksPerSecond > 0 ? avg / this.targetTicksPerSecond : 1;
    return Object.freeze({
      avgTicksPerSecond: avg,
      targetTicksPerSecond: this.targetTicksPerSecond,
      actualToTargetRatio: ratio,
      isBelowTarget: avg < this.targetTicksPerSecond * 0.9,
      sampleCount: this.snapshots.length,
    });
  }

  public clear(): void { this.snapshots.length = 0; }
}

// ---------------------------------------------------------------------------
// ClockPhaseCrossingTracker — records phase/tier crossings anchored to ticks
// ---------------------------------------------------------------------------

export interface ClockPhaseCrossing {
  readonly tick: number;
  readonly simulationMs: number;
  readonly fromPhase: string;
  readonly toPhase: string;
  readonly fromTier: string;
  readonly toTier: string;
  readonly crossingType: 'PHASE' | 'TIER' | 'BOTH';
  readonly isEscalation: boolean;
}

export class ClockPhaseCrossingTracker {
  private readonly crossings: ClockPhaseCrossing[] = [];
  private readonly capacity = 50;
  private lastPhase = 'IDLE';
  private lastTier = 'T0';

  public record(
    tick: number,
    simulationMs: number,
    phase: string,
    tier: string,
  ): ClockPhaseCrossing | undefined {
    const phaseChanged = phase !== this.lastPhase;
    const tierChanged = tier !== this.lastTier;

    if (!phaseChanged && !tierChanged) return undefined;

    const TIER_RANKS: Record<string, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
    const isEscalation = TIER_RANKS[tier] > (TIER_RANKS[this.lastTier] ?? 0);

    const crossing: ClockPhaseCrossing = Object.freeze({
      tick, simulationMs,
      fromPhase: this.lastPhase, toPhase: phase,
      fromTier: this.lastTier, toTier: tier,
      crossingType: phaseChanged && tierChanged ? 'BOTH' : phaseChanged ? 'PHASE' : 'TIER',
      isEscalation,
    });

    if (this.crossings.length >= this.capacity) this.crossings.shift();
    this.crossings.push(crossing);
    this.lastPhase = phase;
    this.lastTier = tier;

    return crossing;
  }

  public recentCrossings(limit = 10): ReadonlyArray<ClockPhaseCrossing> {
    return this.crossings.slice(-limit);
  }

  public escalationCount(): number {
    return this.crossings.filter(c => c.isEscalation).length;
  }

  public reset(): void {
    this.crossings.length = 0;
    this.lastPhase = 'IDLE';
    this.lastTier = 'T0';
  }
}

// ---------------------------------------------------------------------------
// ClockDiagnosticsService — aggregates all clock sub-systems
// ---------------------------------------------------------------------------

export interface ClockDiagnosticsSnapshot {
  readonly driftReport: ClockDriftReport;
  readonly budgetReport: ClockTickBudgetReport;
  readonly tickRateReport: ClockTickRateReport;
  readonly recentCrossings: ReadonlyArray<ClockPhaseCrossing>;
  readonly escalationCount: number;
  readonly isNominal: boolean;
}

export class ClockDiagnosticsService {
  public readonly driftMonitor: ClockDriftSampleMonitor;
  public readonly tickBudget: ClockTickBudget;
  public readonly tickRateAnalyzer: ClockTickRateAnalyzer;
  public readonly phaseCrossingTracker: ClockPhaseCrossingTracker;

  public constructor(
    targetTicksPerSecond = 1,
    budgetCapacity = 200,
    driftCapacity = 60,
  ) {
    this.driftMonitor = new ClockDriftSampleMonitor(driftCapacity);
    this.tickBudget = new ClockTickBudget(budgetCapacity);
    this.tickRateAnalyzer = new ClockTickRateAnalyzer(targetTicksPerSecond);
    this.phaseCrossingTracker = new ClockPhaseCrossingTracker();
  }

  public snapshot(): ClockDiagnosticsSnapshot {
    const driftReport = this.driftMonitor.buildReport();
    const budgetReport = this.tickBudget.buildReport();
    const tickRateReport = this.tickRateAnalyzer.buildReport();
    const recentCrossings = this.phaseCrossingTracker.recentCrossings(5);
    const escalationCount = this.phaseCrossingTracker.escalationCount();

    const isNominal =
      driftReport.severity === 'NOMINAL' &&
      budgetReport.isHealthy &&
      !tickRateReport.isBelowTarget;

    return Object.freeze({ driftReport, budgetReport, tickRateReport, recentCrossings, escalationCount, isNominal });
  }

  public reset(): void {
    this.driftMonitor.clear();
    this.tickBudget.clear();
    this.tickRateAnalyzer.clear();
    this.phaseCrossingTracker.reset();
  }
}

// ---------------------------------------------------------------------------
// Module constants
// ---------------------------------------------------------------------------

export const CLOCK_SOURCE_MODULE_VERSION = '2.0.0' as const;
export const CLOCK_DRIFT_WARN_THRESHOLD_MS = 200 as const;
export const CLOCK_DRIFT_CRITICAL_THRESHOLD_MS = 1_000 as const;
export const CLOCK_TICK_BUDGET_VIOLATION_RATE_WARN = 0.05 as const;
export const CLOCK_DIAGNOSTICS_CAPACITY = 60 as const;
export const CLOCK_SOURCE_MODULE_READY = true;

// ---------------------------------------------------------------------------
// ClockSimulationScheduler — predictive tick scheduling with jitter control
// ---------------------------------------------------------------------------

export interface ClockScheduleEntry {
  readonly scheduledTick: number;
  readonly targetMs: number;
  readonly jitterBudgetMs: number;
  readonly priority: 'REAL_TIME' | 'BEST_EFFORT' | 'DEFERRED';
}

export interface ClockSchedulerStats {
  readonly totalScheduled: number;
  readonly totalFired: number;
  readonly totalDropped: number;
  readonly avgJitterMs: number;
  readonly peakJitterMs: number;
  readonly onTimeRate: number;
}

export class ClockSimulationScheduler {
  private readonly entries: ClockScheduleEntry[] = [];
  private readonly jitterHistory: number[] = [];
  private readonly maxHistory = 100;
  private totalScheduled = 0;
  private totalFired = 0;
  private totalDropped = 0;

  public schedule(
    tick: number,
    targetMs: number,
    jitterBudgetMs = 50,
    priority: ClockScheduleEntry['priority'] = 'BEST_EFFORT',
  ): ClockScheduleEntry {
    const entry: ClockScheduleEntry = Object.freeze({ scheduledTick: tick, targetMs, jitterBudgetMs, priority });
    this.entries.push(entry);
    this.totalScheduled++;
    return entry;
  }

  public fire(tick: number, actualMs: number): boolean {
    const idx = this.entries.findIndex(e => e.scheduledTick === tick);
    if (idx === -1) { this.totalDropped++; return false; }
    const entry = this.entries[idx];
    this.entries.splice(idx, 1);
    const jitter = Math.abs(actualMs - entry.targetMs);
    if (this.jitterHistory.length >= this.maxHistory) this.jitterHistory.shift();
    this.jitterHistory.push(jitter);
    this.totalFired++;
    return jitter <= entry.jitterBudgetMs;
  }

  public stats(): ClockSchedulerStats {
    const avgJitter = this.jitterHistory.length > 0
      ? this.jitterHistory.reduce((a, b) => a + b, 0) / this.jitterHistory.length
      : 0;
    const peakJitter = this.jitterHistory.length > 0 ? Math.max(...this.jitterHistory) : 0;
    const onTimeRate = this.totalFired > 0 ? (this.totalFired - this.totalDropped) / this.totalFired : 1;
    return Object.freeze({ totalScheduled: this.totalScheduled, totalFired: this.totalFired, totalDropped: this.totalDropped, avgJitterMs: avgJitter, peakJitterMs: peakJitter, onTimeRate });
  }

  public pending(): ReadonlyArray<ClockScheduleEntry> { return this.entries; }
  public clear(): void { this.entries.length = 0; }
}

// ---------------------------------------------------------------------------
// ClockComparator — utility for ordering and comparing clock values
// ---------------------------------------------------------------------------

export function clockIsBefore(a: number, b: number): boolean { return a < b; }
export function clockIsAfter(a: number, b: number): boolean { return a > b; }
export function clockIsBetween(t: number, lo: number, hi: number): boolean { return t >= lo && t <= hi; }
export function clockMidpoint(a: number, b: number): number { return Math.floor((a + b) / 2); }
export function clockTicksFromMs(deltaMs: number, tickDurationMs: number): number {
  return tickDurationMs > 0 ? Math.floor(deltaMs / tickDurationMs) : 0;
}
export function clockMsFromTicks(ticks: number, tickDurationMs: number): number {
  return ticks * tickDurationMs;
}

// ---------------------------------------------------------------------------
// ClockReplayValidator — validates that two clock sequences match for replay
// ---------------------------------------------------------------------------

export interface ClockReplayFrame {
  readonly tick: number;
  readonly simulationMs: number;
  readonly advanceCount: number;
}

export interface ClockReplayValidationResult {
  readonly isValid: boolean;
  readonly frameMismatch: number;
  readonly firstMismatchTick: number | undefined;
  readonly totalFrames: number;
}

export class ClockReplayValidator {
  private readonly reference: ClockReplayFrame[] = [];

  public recordReference(frame: ClockReplayFrame): void {
    this.reference.push(Object.freeze(frame));
  }

  public validate(replay: ReadonlyArray<ClockReplayFrame>): ClockReplayValidationResult {
    let frameMismatch = 0;
    let firstMismatchTick: number | undefined;
    const totalFrames = Math.min(this.reference.length, replay.length);

    for (let i = 0; i < totalFrames; i++) {
      const ref = this.reference[i];
      const rep = replay[i];
      if (ref.simulationMs !== rep.simulationMs || ref.advanceCount !== rep.advanceCount) {
        frameMismatch++;
        if (firstMismatchTick === undefined) firstMismatchTick = ref.tick;
      }
    }

    return Object.freeze({
      isValid: frameMismatch === 0 && replay.length === this.reference.length,
      frameMismatch, firstMismatchTick, totalFrames,
    });
  }

  public clearReference(): void { this.reference.length = 0; }
  public referenceLength(): number { return this.reference.length; }
}

// ---------------------------------------------------------------------------
// ClockMLFeatureExtractor — derives ML feature vector from clock state
// ---------------------------------------------------------------------------

export interface ClockMLFeatureVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
}

export const CLOCK_EXTENDED_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'driftSeverityNorm',
  'budgetViolationRate',
  'avgUtilization',
  'tickRateRatio',
  'jitterNorm',
  'escalationCountNorm',
  'isNominal',
  'phaseCrossingRate',
]);

export class ClockMLFeatureExtractor {
  private readonly diagnostics: ClockDiagnosticsService;

  public constructor(diagnostics: ClockDiagnosticsService) {
    this.diagnostics = diagnostics;
  }

  public extract(tick: number): ClockMLFeatureVector {
    const snap = this.diagnostics.snapshot();
    const driftSeverityNorm =
      snap.driftReport.severity === 'CRITICAL' ? 1 :
      snap.driftReport.severity === 'WARN' ? 0.5 : 0;
    const budgetViolationRate = snap.budgetReport.violationRate;
    const avgUtilization = Math.min(1, snap.budgetReport.avgUtilization);
    const tickRateRatio = Math.min(1, snap.tickRateReport.actualToTargetRatio);
    const jitterNorm = Math.min(1, snap.driftReport.avgDriftMs / 1000);
    const escalationNorm = Math.min(1, snap.escalationCount / 10);
    const isNominal = snap.isNominal ? 1 : 0;
    const phaseCrossingRate = Math.min(1, snap.recentCrossings.length / 5);

    return Object.freeze({
      tick,
      features: Object.freeze([
        driftSeverityNorm, budgetViolationRate, avgUtilization, tickRateRatio,
        jitterNorm, escalationNorm, isNominal, phaseCrossingRate,
      ]),
      labels: CLOCK_EXTENDED_ML_FEATURE_LABELS,
    });
  }
}

// ---------------------------------------------------------------------------
// ClockSourceAdapterSuite — all clock sub-systems bundled
// ---------------------------------------------------------------------------

export class ClockSourceAdapterSuite {
  public readonly diagnostics: ClockDiagnosticsService;
  public readonly scheduler: ClockSimulationScheduler;
  public readonly replayValidator: ClockReplayValidator;
  public readonly mlExtractor: ClockMLFeatureExtractor;

  public constructor(targetTicksPerSecond = 1) {
    this.diagnostics = new ClockDiagnosticsService(targetTicksPerSecond);
    this.scheduler = new ClockSimulationScheduler();
    this.replayValidator = new ClockReplayValidator();
    this.mlExtractor = new ClockMLFeatureExtractor(this.diagnostics);
  }

  public onTick(tick: number, simulationMs: number, actualMs: number, budgetMs: number): void {
    this.diagnostics.driftMonitor.record(tick, simulationMs, Date.now());
    this.diagnostics.tickBudget.record(tick, budgetMs, actualMs);
    this.diagnostics.tickRateAnalyzer.record(tick, Date.now(), actualMs);
  }

  public reset(): void { this.diagnostics.reset(); this.scheduler.clear(); }
}

// ---------------------------------------------------------------------------
// Module exports summary
// ---------------------------------------------------------------------------
export const CLOCK_SOURCE_ADAPTER_SUITE_READY = true;
export const CLOCK_EXTENDED_ML_FEATURE_COUNT = CLOCK_EXTENDED_ML_FEATURE_LABELS.length;
export const CLOCK_MODULE_EXPORTS = [
  'ClockDriftSampleMonitor', 'ClockTickBudget', 'ClockTickRateAnalyzer',
  'ClockPhaseCrossingTracker', 'ClockDiagnosticsService', 'ClockSimulationScheduler',
  'ClockReplayValidator', 'ClockMLFeatureExtractor', 'ClockSourceAdapterSuite',
] as const;

// ---------------------------------------------------------------------------
// ClockSnapshotDiffer — computes the diff between two clock snapshots
// ---------------------------------------------------------------------------

export interface ClockSnapshotDiff {
  readonly deltaMs: number;
  readonly deltaAdvanceCount: number;
  readonly deltaTotalAdvancedMs: number;
  readonly precisionChanged: boolean;
  readonly isProgressive: boolean;
}

export function diffClockSnapshots(
  before: ClockSnapshotState,
  after: ClockSnapshotState,
): ClockSnapshotDiff {
  return Object.freeze({
    deltaMs: after.currentMs - before.currentMs,
    deltaAdvanceCount: after.advanceCount - before.advanceCount,
    deltaTotalAdvancedMs: after.totalAdvancedMs - before.totalAdvancedMs,
    precisionChanged: before.precision !== after.precision,
    isProgressive: after.currentMs >= before.currentMs && after.advanceCount >= before.advanceCount,
  });
}

export function serializeClockSnapshot(snap: ClockSnapshotState): string {
  return JSON.stringify({
    currentMs: snap.currentMs,
    advanceCount: snap.advanceCount,
    totalAdvancedMs: snap.totalAdvancedMs,
    precision: snap.precision,
  });
}

export function deserializeClockSnapshot(raw: string): ClockSnapshotState {
  const parsed = JSON.parse(raw) as ClockSnapshotState;
  return Object.freeze({
    currentMs: parsed.currentMs,
    advanceCount: parsed.advanceCount,
    totalAdvancedMs: parsed.totalAdvancedMs,
    lastAdvanceDeltaMs: parsed.lastAdvanceDeltaMs ?? 0,
    minDeltaMs: parsed.minDeltaMs ?? 0,
    maxDeltaMs: parsed.maxDeltaMs ?? 0,
    avgDeltaMs: parsed.avgDeltaMs ?? 0,
    createdAtMs: parsed.createdAtMs ?? Date.now(),
    precision: parsed.precision ?? 'MILLISECOND',
  });
}

export const CLOCK_SNAPSHOT_SERIALIZATION_VERSION = '1.0' as const;
export const CLOCK_SOURCE_COMPLETE = true;
