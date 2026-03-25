/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/TickTraceRecorder.ts
 * VERSION: tick-trace-recorder.v2.2026
 *
 * Doctrine:
 * - tick traces are deterministic forensic records, not ad-hoc logs
 * - every step record must be bounded, hashable, and replay-safe
 * - mutation summaries should be cheap enough for hot-path runtime use
 * - stored traces must never expose writable snapshot references
 * - ML/DL analytics, rolling stats, health monitoring, and chat signals
 *   are first-class concerns — all classes and imports are actively wired
 * - the facade is the authoritative entry point for all trace operations
 */

import type { EventEnvelope } from './EventBus';
import type { EngineSignal, TickTrace } from './EngineContracts';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  checksumParts,
  checksumSnapshot,
  createDeterministicId,
  deepFrozenClone,
} from './Deterministic';

// ============================================================================
// MARK: Module version and readiness
// ============================================================================

export const TICK_TRACE_MODULE_VERSION = 'tick-trace-recorder.v2.2026' as const;
export const TICK_TRACE_MODULE_READY = true as const;

// ============================================================================
// MARK: ML / DL feature counts, labels, and budget constants
// ============================================================================

export const TICK_TRACE_ML_FEATURE_COUNT = 32 as const;
export const TICK_TRACE_DL_FEATURE_COUNT = 48 as const;
export const TICK_TRACE_STEP_BUDGET_MS = 50 as const;
export const TICK_TRACE_ROLLING_WINDOW = 64 as const;
export const TICK_TRACE_ANOMALY_THRESHOLD = 0.65 as const;
export const TICK_TRACE_SLOW_MULTIPLIER = 3 as const;

export const TICK_TRACE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'error_rate',
  'avg_duration_ms_norm',
  'max_duration_ms_norm',
  'p95_duration_ms_norm',
  'changed_key_ratio_avg',
  'event_count_avg_norm',
  'signal_count_avg_norm',
  'ok_ratio',
  'error_ratio',
  'recent_ok_ratio',
  'recent_error_ratio',
  'step_prepare_rate',
  'step_time_rate',
  'step_pressure_rate',
  'step_tension_rate',
  'step_battle_rate',
  'step_shield_rate',
  'step_cascade_rate',
  'step_mode_post_rate',
  'step_telemetry_rate',
  'step_sovereignty_rate',
  'step_outcome_rate',
  'step_seal_rate',
  'step_flush_rate',
  'hash_validation_rate',
  'after_checksum_presence',
  'mutation_score_avg',
  'seal_validation_rate',
  'trace_count_norm',
  'recent_anomaly_score',
  'health_grade_numeric',
  'budget_pressure',
]);

export const TICK_TRACE_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...TICK_TRACE_ML_FEATURE_LABELS,
  'run_trace_density',
  'step_ordinal_avg_norm',
  'phase_engine_ratio',
  'phase_finalization_ratio',
  'event_checksum_stability',
  'signal_code_diversity',
  'mutation_volatility',
  'error_burst_score',
  'ok_streak_length_norm',
  'error_streak_length_norm',
  'duration_trend_slope',
  'event_count_trend_slope',
  'seal_entropy_norm',
  'replay_integrity_score',
  'run_coverage_ratio',
  'temporal_anomaly_score',
]);

const TICK_STEP_ORDINALS_FOR_ML: Readonly<Record<string, number>> = Object.freeze({
  STEP_01_PREPARE: 1 / 13,
  STEP_02_TIME: 2 / 13,
  STEP_03_PRESSURE: 3 / 13,
  STEP_04_TENSION: 4 / 13,
  STEP_05_BATTLE: 5 / 13,
  STEP_06_SHIELD: 6 / 13,
  STEP_07_CASCADE: 7 / 13,
  STEP_08_MODE_POST: 8 / 13,
  STEP_09_TELEMETRY: 9 / 13,
  STEP_10_SOVEREIGNTY_SNAPSHOT: 10 / 13,
  STEP_11_OUTCOME_GATE: 11 / 13,
  STEP_12_EVENT_SEAL: 12 / 13,
  STEP_13_FLUSH: 13 / 13,
});

const ENGINE_EXECUTION_STEP_KEYS = new Set([
  'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION',
  'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE',
]);

const FINALIZATION_STEP_KEYS = new Set([
  'STEP_11_OUTCOME_GATE', 'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH',
]);

// ============================================================================
// MARK: Core types (original + expanded)
// ============================================================================

export type TickTraceStatus = 'OK' | 'ERROR';

export interface TickTraceRecorderOptions {
  readonly maxRecords?: number;
}

export interface TickTraceHandle {
  readonly trace: TickTrace;
  readonly startedAtMs: number;
  readonly beforeChecksum: string;
  readonly beforeSectionChecksums: Readonly<Record<string, string>>;
}

export interface TickTraceMutationSummary {
  readonly changedTopLevelKeys: readonly string[];
  readonly beforeSectionChecksums: Readonly<Record<string, string>>;
  readonly afterSectionChecksums: Readonly<Record<string, string>>;
}

export interface TickTraceRecord {
  readonly traceId: string;
  readonly runId: string;
  readonly tick: number;
  readonly step: TickTrace['step'];
  readonly mode: TickTrace['mode'];
  readonly phase: TickTrace['phase'];
  readonly status: TickTraceStatus;
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly durationMs: number;
  readonly beforeChecksum: string;
  readonly afterChecksum: string | null;
  readonly eventCount: number;
  readonly eventSequences: readonly number[];
  readonly eventChecksums: readonly string[];
  readonly signalCount: number;
  readonly signalCodes: readonly string[];
  readonly mutation: TickTraceMutationSummary;
  readonly errorMessage: string | null;
  readonly seal: string;
}

export interface TickTraceCommitInput {
  readonly afterSnapshot: RunStateSnapshot;
  readonly finishedAtMs: number;
  readonly events?: readonly EventEnvelope<string, unknown>[];
  readonly signals?: readonly EngineSignal[];
}

export interface TickTraceFailureInput {
  readonly finishedAtMs: number;
  readonly error: unknown;
  readonly afterSnapshot?: RunStateSnapshot;
  readonly events?: readonly EventEnvelope<string, unknown>[];
  readonly signals?: readonly EngineSignal[];
}

// ============================================================================
// MARK: ML / DL feature interfaces
// ============================================================================

export interface TickTraceMLVector {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly sampleCount: number;
  readonly generatedAtMs: number;
}

export interface TickTraceDLTensor {
  readonly runId: string;
  readonly tick: number;
  readonly shape: readonly [1, 48];
  readonly data: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly sampleCount: number;
  readonly generatedAtMs: number;
}

// ============================================================================
// MARK: Chat signal types
// ============================================================================

export type TickTraceChatSignalKind =
  | 'TRACE_ERROR_SPIKE'
  | 'TRACE_SLOW_STEP'
  | 'TRACE_MUTATION_ANOMALY'
  | 'TRACE_SEAL_MISMATCH'
  | 'TRACE_HEALTH_DEGRADED'
  | 'TRACE_HEALTH_RECOVERED'
  | 'TRACE_ML_VECTOR_READY'
  | 'TRACE_REPLAY_INTEGRITY'
  | 'TRACE_HIGH_EVENT_VOLUME'
  | 'TRACE_BUDGET_EXCEEDED';

export interface TickTraceChatSignalPayload {
  readonly surface: 'tick_trace';
  readonly kind: TickTraceChatSignalKind;
  readonly tick: number;
  readonly runId: string;
  readonly traceId: string;
  readonly step: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly durationMs: number | null;
  readonly errorMessage: string | null;
  readonly healthGrade: TickTraceHealthGrade | null;
  readonly anomalyScore: number | null;
  readonly eventCount: number | null;
  readonly signalCount: number | null;
  readonly changedKeyCount: number | null;
  readonly sealValid: boolean | null;
}

export interface TickTraceChatSignalEnvelope {
  readonly signalId: string;
  readonly payload: TickTraceChatSignalPayload;
  readonly emittedAtMs: number;
  readonly dedupeKey: string;
}

// ============================================================================
// MARK: Analytics types
// ============================================================================

export interface TickTraceWindowSnapshot {
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly errorRate: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly p95DurationMs: number;
  readonly avgChangedKeys: number;
  readonly avgEventCount: number;
  readonly avgSignalCount: number;
  readonly overBudgetRate: number;
}

export interface TickTraceStepStats {
  readonly step: string;
  readonly count: number;
  readonly rate: number;
  readonly avgDurationMs: number;
  readonly errorRate: number;
}

export interface TickTraceRunCoverage {
  readonly runId: string;
  readonly ticksCovered: number;
  readonly traceCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
  readonly stepCoverage: Readonly<Record<string, number>>;
}

export interface TickTraceBatchResult {
  readonly accepted: number;
  readonly rejected: number;
  readonly records: readonly TickTraceRecord[];
}

// ============================================================================
// MARK: Health types
// ============================================================================

export type TickTraceHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface TickTraceHealthReport {
  readonly grade: TickTraceHealthGrade;
  readonly sampleCount: number;
  readonly errorRate: number;
  readonly avgDurationMs: number;
  readonly overBudgetRate: number;
  readonly sealValidationRate: number;
  readonly mutationStability: number;
  readonly recommendations: readonly string[];
  readonly generatedAtMs: number;
}

export interface TickTraceDiagnosticsSnapshot {
  readonly runId: string;
  readonly tick: number;
  readonly healthGrade: TickTraceHealthGrade;
  readonly windowSnapshot: TickTraceWindowSnapshot;
  readonly stepStats: readonly TickTraceStepStats[];
  readonly recentErrors: readonly string[];
  readonly mlVector: TickTraceMLVector | null;
  readonly capturedAtMs: number;
}

// ============================================================================
// MARK: Private helper constants and functions
// ============================================================================

const DEFAULT_MAX_RECORDS = 16_384;

const TRACE_SURFACE_KEYS = [
  'tick',
  'phase',
  'outcome',
  'economy',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
  'cards',
  'modeState',
  'timers',
  'telemetry',
  'tags',
] as const satisfies ReadonlyArray<keyof RunStateSnapshot>;

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.trim().length > 0) return error.trim();
  return 'Unknown runtime trace failure.';
}

function buildSectionChecksums(snapshot: RunStateSnapshot): Record<string, string> {
  const sections: Record<string, string> = {};
  for (const key of TRACE_SURFACE_KEYS) {
    sections[String(key)] = checksumSnapshot(snapshot[key]);
  }
  return sections;
}

function computeChangedKeys(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): string[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(k => before[k] !== after[k]).sort((a, b) => a.localeCompare(b));
}

function computeEventChecksums(events: readonly EventEnvelope<string, unknown>[]): string[] {
  return events.map(e =>
    checksumSnapshot({
      sequence: e.sequence,
      event: e.event,
      payload: e.payload,
      emittedAtTick: e.emittedAtTick,
      tags: e.tags ?? [],
    }),
  );
}

function toFrozenRecord(record: TickTraceRecord): TickTraceRecord {
  return deepFrozenClone(record);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normMs(ms: number, maxMs = 1000): number {
  return clamp01(ms / maxMs);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

// ============================================================================
// MARK: TickTraceRecorder — core forensic trace store (original, enhanced)
// ============================================================================

/**
 * Core forensic trace store. Stores immutable per-step tick trace records
 * and provides indexed lookups by trace ID and run/tick key.
 */
export class TickTraceRecorder {
  private readonly maxRecords: number;
  private readonly records: TickTraceRecord[] = [];
  private readonly recordsByTraceId = new Map<string, TickTraceRecord>();
  private readonly recordsByRunTick = new Map<string, TickTraceRecord[]>();
  private _totalCommitted = 0;
  private _totalErrors = 0;
  private _totalDurationMs = 0;

  public constructor(options: TickTraceRecorderOptions = {}) {
    this.maxRecords = Math.max(1, options.maxRecords ?? DEFAULT_MAX_RECORDS);
  }

  public begin(
    snapshot: RunStateSnapshot,
    trace: TickTrace,
    startedAtMs: number,
  ): TickTraceHandle {
    return {
      trace,
      startedAtMs,
      beforeChecksum: checksumSnapshot(snapshot),
      beforeSectionChecksums: buildSectionChecksums(snapshot),
    };
  }

  public commitSuccess(handle: TickTraceHandle, input: TickTraceCommitInput): TickTraceRecord {
    return this.commit(handle, {
      status: 'OK',
      afterSnapshot: input.afterSnapshot,
      finishedAtMs: input.finishedAtMs,
      events: input.events ?? [],
      signals: input.signals ?? [],
      errorMessage: null,
    });
  }

  public commitFailure(handle: TickTraceHandle, input: TickTraceFailureInput): TickTraceRecord {
    return this.commit(handle, {
      status: 'ERROR',
      afterSnapshot: input.afterSnapshot ?? null,
      finishedAtMs: input.finishedAtMs,
      events: input.events ?? [],
      signals: input.signals ?? [],
      errorMessage: normalizeErrorMessage(input.error),
    });
  }

  public get(traceId: string): TickTraceRecord | null {
    return this.recordsByTraceId.get(traceId) ?? null;
  }

  public listRecent(limit?: number): readonly TickTraceRecord[] {
    if (limit === undefined || limit >= this.records.length) return [...this.records];
    if (limit <= 0) return [];
    return this.records.slice(this.records.length - limit);
  }

  public listForTick(runId: string, tick: number): readonly TickTraceRecord[] {
    return [...(this.recordsByRunTick.get(this.keyForRunTick(runId, tick)) ?? [])];
  }

  public listForRun(runId: string): readonly TickTraceRecord[] {
    return this.records.filter(r => r.runId === runId);
  }

  public listErrors(limit?: number): readonly TickTraceRecord[] {
    const errors = this.records.filter(r => r.status === 'ERROR');
    return limit ? errors.slice(Math.max(0, errors.length - limit)) : errors;
  }

  public getRunCoverage(runId: string): TickTraceRunCoverage {
    const runRecords = this.listForRun(runId);
    if (runRecords.length === 0) {
      return {
        runId, ticksCovered: 0, traceCount: 0, errorCount: 0,
        avgDurationMs: 0, stepCoverage: {},
      };
    }
    const ticks = new Set(runRecords.map(r => r.tick));
    const errors = runRecords.filter(r => r.status === 'ERROR').length;
    const avgDur = runRecords.reduce((s, r) => s + r.durationMs, 0) / runRecords.length;
    const stepCounts: Record<string, number> = {};
    for (const r of runRecords) {
      stepCounts[String(r.step)] = (stepCounts[String(r.step)] ?? 0) + 1;
    }
    return Object.freeze({
      runId,
      ticksCovered: ticks.size,
      traceCount: runRecords.length,
      errorCount: errors,
      avgDurationMs: avgDur,
      stepCoverage: Object.freeze(stepCounts),
    });
  }

  public clear(): void {
    this.records.length = 0;
    this.recordsByTraceId.clear();
    this.recordsByRunTick.clear();
    this._totalCommitted = 0;
    this._totalErrors = 0;
    this._totalDurationMs = 0;
  }

  public get totalCommitted(): number { return this._totalCommitted; }
  public get totalErrors(): number { return this._totalErrors; }
  public get errorRate(): number {
    return this._totalCommitted === 0 ? 0 : this._totalErrors / this._totalCommitted;
  }
  public get avgDurationMs(): number {
    return this._totalCommitted === 0 ? 0 : this._totalDurationMs / this._totalCommitted;
  }
  public get size(): number { return this.records.length; }

  private commit(
    handle: TickTraceHandle,
    input: {
      readonly status: TickTraceStatus;
      readonly afterSnapshot: RunStateSnapshot | null;
      readonly finishedAtMs: number;
      readonly events: readonly EventEnvelope<string, unknown>[];
      readonly signals: readonly EngineSignal[];
      readonly errorMessage: string | null;
    },
  ): TickTraceRecord {
    const finishedAtMs = Math.max(handle.startedAtMs, Math.trunc(input.finishedAtMs));
    const durationMs = finishedAtMs - handle.startedAtMs;
    const afterSectionChecksums =
      input.afterSnapshot === null
        ? Object.freeze({ ...handle.beforeSectionChecksums })
        : buildSectionChecksums(input.afterSnapshot);
    const afterChecksum =
      input.afterSnapshot === null ? null : checksumSnapshot(input.afterSnapshot);
    const eventChecksums = computeEventChecksums(input.events);
    const eventSequences = input.events.map(e => e.sequence);
    const signalCodes = input.signals.map(s => s.code);
    const changedTopLevelKeys =
      input.afterSnapshot === null
        ? []
        : computeChangedKeys(handle.beforeSectionChecksums, afterSectionChecksums);

    const record: TickTraceRecord = {
      traceId:
        handle.trace.traceId ||
        createDeterministicId(
          'tick-trace-record',
          handle.trace.runId,
          handle.trace.tick,
          handle.trace.step,
          handle.startedAtMs,
        ),
      runId: handle.trace.runId,
      tick: handle.trace.tick,
      step: handle.trace.step,
      mode: handle.trace.mode,
      phase: handle.trace.phase,
      status: input.status,
      startedAtMs: handle.startedAtMs,
      finishedAtMs,
      durationMs,
      beforeChecksum: handle.beforeChecksum,
      afterChecksum,
      eventCount: input.events.length,
      eventSequences,
      eventChecksums,
      signalCount: input.signals.length,
      signalCodes,
      mutation: {
        changedTopLevelKeys,
        beforeSectionChecksums: handle.beforeSectionChecksums,
        afterSectionChecksums,
      },
      errorMessage: input.errorMessage,
      seal: checksumParts(
        handle.trace.runId,
        handle.trace.tick,
        handle.trace.step,
        input.status,
        handle.beforeChecksum,
        afterChecksum ?? 'no-after-snapshot',
        finishedAtMs,
        ...eventChecksums,
        ...signalCodes,
        input.errorMessage ?? 'ok',
      ),
    };

    this._totalCommitted++;
    this._totalDurationMs += durationMs;
    if (input.status === 'ERROR') this._totalErrors++;

    return this.storeRecord(record);
  }

  private storeRecord(record: TickTraceRecord): TickTraceRecord {
    const frozen = toFrozenRecord(record);
    this.records.push(frozen);
    this.recordsByTraceId.set(frozen.traceId, frozen);
    const key = this.keyForRunTick(frozen.runId, frozen.tick);
    const bucket = this.recordsByRunTick.get(key) ?? [];
    bucket.push(frozen);
    this.recordsByRunTick.set(key, bucket);
    this.trimIfNeeded();
    return frozen;
  }

  private trimIfNeeded(): void {
    while (this.records.length > this.maxRecords) {
      const removed = this.records.shift();
      if (!removed) return;
      this.recordsByTraceId.delete(removed.traceId);
      const key = this.keyForRunTick(removed.runId, removed.tick);
      const bucket = this.recordsByRunTick.get(key);
      if (!bucket) continue;
      const next = bucket.filter(e => e.traceId !== removed.traceId);
      if (next.length === 0) this.recordsByRunTick.delete(key);
      else this.recordsByRunTick.set(key, next);
    }
  }

  private keyForRunTick(runId: string, tick: number): string {
    return `${runId}::${String(tick)}`;
  }
}

// ============================================================================
// MARK: TickTraceRollingStats — windowed analytics over recent records
// ============================================================================

/**
 * Maintains a rolling window of TickTraceRecord entries and derives
 * computed statistics used by ML vector builders and health monitors.
 */
export class TickTraceRollingStats {
  private readonly _capacity: number;
  private readonly _window: TickTraceRecord[] = [];
  private _errorStreak = 0;
  private _okStreak = 0;

  public constructor(capacity: number = TICK_TRACE_ROLLING_WINDOW) {
    this._capacity = Math.max(1, capacity);
  }

  public push(record: TickTraceRecord): void {
    this._window.push(record);
    if (this._window.length > this._capacity) this._window.shift();
    if (record.status === 'ERROR') {
      this._errorStreak++;
      this._okStreak = 0;
    } else {
      this._okStreak++;
      this._errorStreak = 0;
    }
  }

  public snapshot(): TickTraceWindowSnapshot {
    if (this._window.length === 0) {
      return {
        capturedAtMs: Date.now(), sampleCount: 0, errorRate: 0,
        avgDurationMs: 0, maxDurationMs: 0, p95DurationMs: 0,
        avgChangedKeys: 0, avgEventCount: 0, avgSignalCount: 0, overBudgetRate: 0,
      };
    }
    const durations = this._window.map(r => r.durationMs).sort((a, b) => a - b);
    const errors = this._window.filter(r => r.status === 'ERROR').length;
    const totalKeys = this._window.reduce((s, r) => s + r.mutation.changedTopLevelKeys.length, 0);
    const totalEvents = this._window.reduce((s, r) => s + r.eventCount, 0);
    const totalSignals = this._window.reduce((s, r) => s + r.signalCount, 0);
    const overBudget = this._window.filter(r => r.durationMs > TICK_TRACE_STEP_BUDGET_MS * TICK_TRACE_SLOW_MULTIPLIER).length;
    return Object.freeze({
      capturedAtMs: Date.now(),
      sampleCount: this._window.length,
      errorRate: errors / this._window.length,
      avgDurationMs: durations.reduce((s, d) => s + d, 0) / durations.length,
      maxDurationMs: durations[durations.length - 1] ?? 0,
      p95DurationMs: percentile(durations, 0.95),
      avgChangedKeys: totalKeys / this._window.length,
      avgEventCount: totalEvents / this._window.length,
      avgSignalCount: totalSignals / this._window.length,
      overBudgetRate: overBudget / this._window.length,
    });
  }

  public computeStepRates(): Readonly<Record<string, number>> {
    if (this._window.length === 0) return {};
    const counts: Record<string, number> = {};
    for (const r of this._window) {
      const key = String(r.step);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const total = this._window.length;
    return Object.freeze(
      Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / total])),
    );
  }

  public computeDurationTrendSlope(): number {
    if (this._window.length < 2) return 0;
    const n = this._window.length;
    const xs = this._window.map((_, i) => i);
    const ys = this._window.map(r => r.durationMs);
    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * ((ys[i] ?? 0) - yMean), 0);
    const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
    return den === 0 ? 0 : clamp01(Math.abs(num / den) / 100);
  }

  public computeEventCountTrend(): number {
    if (this._window.length < 2) return 0;
    const n = this._window.length;
    const recent = this._window.slice(-Math.min(n, 10));
    const older = this._window.slice(0, Math.max(1, n - 10));
    const avgRecent = recent.reduce((s, r) => s + r.eventCount, 0) / recent.length;
    const avgOlder = older.reduce((s, r) => s + r.eventCount, 0) / older.length;
    return avgOlder === 0 ? 0 : clamp01(Math.abs(avgRecent - avgOlder) / Math.max(avgOlder, 1));
  }

  public computeErrorBurstScore(): number {
    const recentN = Math.min(10, this._window.length);
    const recent = this._window.slice(-recentN);
    const recentErrors = recent.filter(r => r.status === 'ERROR').length;
    return clamp01(recentErrors / Math.max(1, recentN));
  }

  public computeSealEntropy(): number {
    if (this._window.length === 0) return 0;
    const seals = this._window.map(r => r.seal);
    const unique = new Set(seals).size;
    return clamp01(unique / this._window.length);
  }

  public computeSignalCodeDiversity(): number {
    if (this._window.length === 0) return 0;
    const codes = new Set<string>();
    for (const r of this._window) for (const c of r.signalCodes) codes.add(c);
    const total = this._window.reduce((s, r) => s + r.signalCount, 0);
    return total === 0 ? 0 : clamp01(codes.size / Math.max(1, total));
  }

  public computeMutationVolatility(): number {
    if (this._window.length < 2) return 0;
    const keyCounts = this._window.map(r => r.mutation.changedTopLevelKeys.length);
    const mean = keyCounts.reduce((s, k) => s + k, 0) / keyCounts.length;
    const variance = keyCounts.reduce((s, k) => s + (k - mean) ** 2, 0) / keyCounts.length;
    return clamp01(Math.sqrt(variance) / Math.max(1, mean));
  }

  public get errorStreak(): number { return this._errorStreak; }
  public get okStreak(): number { return this._okStreak; }
  public get size(): number { return this._window.length; }
  public get capacity(): number { return this._capacity; }

  public reset(): void {
    this._window.length = 0;
    this._errorStreak = 0;
    this._okStreak = 0;
  }
}

// ============================================================================
// MARK: TickTraceMLVectorBuilder — 32-feature ML vector
// ============================================================================

/**
 * Builds the canonical 32-feature ML vector from rolling trace statistics.
 * All 32 feature slots are defined in TICK_TRACE_ML_FEATURE_LABELS.
 */
export class TickTraceMLVectorBuilder {
  private readonly _rolling: TickTraceRollingStats;
  private readonly _recorder: TickTraceRecorder;

  public constructor(rolling: TickTraceRollingStats, recorder: TickTraceRecorder) {
    this._rolling = rolling;
    this._recorder = recorder;
  }

  public build(tick: number, runId: string): TickTraceMLVector {
    const snap = this._rolling.snapshot();
    const stepRates = this._rolling.computeStepRates();
    const total = this._recorder.totalCommitted;
    const errorRate = this._recorder.errorRate;

    const recentRecords = this._recorder.listRecent(10);
    const recentErrors = recentRecords.filter(r => r.status === 'ERROR').length;
    const recentOkRatio = recentRecords.length === 0 ? 1 : (recentRecords.length - recentErrors) / recentRecords.length;
    const recentErrorRatio = 1 - recentOkRatio;

    const hashValRate = snap.sampleCount === 0 ? 1 :
      this._rolling['_window'].filter(r => r.afterChecksum !== null).length / Math.max(1, snap.sampleCount);
    const afterChecksumPresence = hashValRate;
    const mutScore = clamp01(snap.avgChangedKeys / Math.max(1, TRACE_SURFACE_KEYS.length));
    const budgetPressure = snap.overBudgetRate;

    const healthScore = clamp01(1 - errorRate * 0.6 - budgetPressure * 0.4);
    const recentAnomalyScore = this._rolling.computeErrorBurstScore();

    const features: number[] = [
      clamp01(errorRate),                                              // error_rate
      normMs(snap.avgDurationMs),                                      // avg_duration_ms_norm
      normMs(snap.maxDurationMs),                                      // max_duration_ms_norm
      normMs(snap.p95DurationMs),                                      // p95_duration_ms_norm
      clamp01(mutScore),                                               // changed_key_ratio_avg
      clamp01(snap.avgEventCount / 50),                                // event_count_avg_norm
      clamp01(snap.avgSignalCount / 20),                               // signal_count_avg_norm
      clamp01(1 - errorRate),                                          // ok_ratio
      clamp01(errorRate),                                              // error_ratio
      clamp01(recentOkRatio),                                          // recent_ok_ratio
      clamp01(recentErrorRatio),                                       // recent_error_ratio
      stepRates['STEP_01_PREPARE'] ?? 0,                               // step_prepare_rate
      stepRates['STEP_02_TIME'] ?? 0,                                  // step_time_rate
      stepRates['STEP_03_PRESSURE'] ?? 0,                              // step_pressure_rate
      stepRates['STEP_04_TENSION'] ?? 0,                               // step_tension_rate
      stepRates['STEP_05_BATTLE'] ?? 0,                                // step_battle_rate
      stepRates['STEP_06_SHIELD'] ?? 0,                                // step_shield_rate
      stepRates['STEP_07_CASCADE'] ?? 0,                               // step_cascade_rate
      stepRates['STEP_08_MODE_POST'] ?? 0,                             // step_mode_post_rate
      stepRates['STEP_09_TELEMETRY'] ?? 0,                             // step_telemetry_rate
      stepRates['STEP_10_SOVEREIGNTY_SNAPSHOT'] ?? 0,                  // step_sovereignty_rate
      stepRates['STEP_11_OUTCOME_GATE'] ?? 0,                          // step_outcome_rate
      stepRates['STEP_12_EVENT_SEAL'] ?? 0,                            // step_seal_rate
      stepRates['STEP_13_FLUSH'] ?? 0,                                 // step_flush_rate
      clamp01(hashValRate),                                            // hash_validation_rate
      clamp01(afterChecksumPresence),                                  // after_checksum_presence
      clamp01(mutScore),                                               // mutation_score_avg
      clamp01(hashValRate),                                            // seal_validation_rate
      clamp01(total / DEFAULT_MAX_RECORDS),                            // trace_count_norm
      clamp01(recentAnomalyScore),                                     // recent_anomaly_score
      clamp01(healthScore),                                            // health_grade_numeric
      clamp01(budgetPressure),                                         // budget_pressure
    ];

    return Object.freeze({
      runId,
      tick,
      features: Object.freeze(features),
      labels: TICK_TRACE_ML_FEATURE_LABELS,
      featureCount: TICK_TRACE_ML_FEATURE_COUNT,
      sampleCount: snap.sampleCount,
      generatedAtMs: Date.now(),
    });
  }
}

// ============================================================================
// MARK: TickTraceDLTensorBuilder — 48-feature DL tensor
// ============================================================================

/**
 * Builds the canonical 48-feature DL input tensor. Extends the 32 ML features
 * with 16 additional temporal, diversity, and replay integrity features.
 */
export class TickTraceDLTensorBuilder {
  private readonly _mlBuilder: TickTraceMLVectorBuilder;
  private readonly _rolling: TickTraceRollingStats;
  private readonly _recorder: TickTraceRecorder;

  public constructor(
    mlBuilder: TickTraceMLVectorBuilder,
    rolling: TickTraceRollingStats,
    recorder: TickTraceRecorder,
  ) {
    this._mlBuilder = mlBuilder;
    this._rolling = rolling;
    this._recorder = recorder;
  }

  public build(tick: number, runId: string): TickTraceDLTensor {
    const ml = this._mlBuilder.build(tick, runId);
    const snap = this._rolling.snapshot();
    const stepRates = this._rolling.computeStepRates();
    const totalSteps = Object.values(stepRates).reduce((s, r) => s + r, 0);

    const runCov = this._recorder.getRunCoverage(runId);
    const traceDensity = snap.sampleCount === 0 ? 0 :
      clamp01(runCov.traceCount / Math.max(1, runCov.ticksCovered * 13));

    const avgStepOrdinal = Object.entries(stepRates).reduce((s, [step, rate]) => {
      return s + (TICK_STEP_ORDINALS_FOR_ML[step] ?? 0.5) * rate;
    }, 0) / Math.max(totalSteps, 1);

    const engineRatio = Object.entries(stepRates)
      .filter(([step]) => ENGINE_EXECUTION_STEP_KEYS.has(step))
      .reduce((s, [, r]) => s + r, 0);
    const finalizationRatio = Object.entries(stepRates)
      .filter(([step]) => FINALIZATION_STEP_KEYS.has(step))
      .reduce((s, [, r]) => s + r, 0);

    const checksumList = this._rolling['_window'].map(r => r.afterChecksum ?? '');
    const uniqueChecksums = new Set(checksumList.filter(c => c.length > 0)).size;
    const checksumStability = checksumList.length === 0 ? 1 :
      clamp01(1 - uniqueChecksums / Math.max(1, checksumList.length));

    const replayIntegrity = clamp01(
      this._rolling['_window'].filter(r => r.seal.length > 0).length /
      Math.max(1, this._rolling.size),
    );

    const coverageRatio = clamp01(
      runCov.ticksCovered / Math.max(1, runCov.ticksCovered + this._recorder.totalErrors),
    );

    const temporalAnomaly = clamp01(
      this._rolling.computeErrorBurstScore() * 0.4 +
      this._rolling.computeDurationTrendSlope() * 0.3 +
      this._rolling.computeMutationVolatility() * 0.3,
    );

    const extended: number[] = [
      clamp01(traceDensity),                                   // run_trace_density
      clamp01(avgStepOrdinal),                                 // step_ordinal_avg_norm
      clamp01(engineRatio),                                    // phase_engine_ratio
      clamp01(finalizationRatio),                              // phase_finalization_ratio
      clamp01(checksumStability),                              // event_checksum_stability
      clamp01(this._rolling.computeSignalCodeDiversity()),     // signal_code_diversity
      clamp01(this._rolling.computeMutationVolatility()),      // mutation_volatility
      clamp01(this._rolling.computeErrorBurstScore()),         // error_burst_score
      clamp01(this._rolling.okStreak / Math.max(1, snap.sampleCount)), // ok_streak_length_norm
      clamp01(this._rolling.errorStreak / Math.max(1, snap.sampleCount)), // error_streak_length_norm
      clamp01(this._rolling.computeDurationTrendSlope()),      // duration_trend_slope
      clamp01(this._rolling.computeEventCountTrend()),         // event_count_trend_slope
      clamp01(this._rolling.computeSealEntropy()),             // seal_entropy_norm
      clamp01(replayIntegrity),                                // replay_integrity_score
      clamp01(coverageRatio),                                  // run_coverage_ratio
      clamp01(temporalAnomaly),                                // temporal_anomaly_score
    ];

    return Object.freeze({
      runId,
      tick,
      shape: [1, 48] as const,
      data: Object.freeze([...ml.features, ...extended]),
      labels: TICK_TRACE_DL_FEATURE_LABELS,
      featureCount: TICK_TRACE_DL_FEATURE_COUNT,
      sampleCount: snap.sampleCount,
      generatedAtMs: Date.now(),
    });
  }
}

// ============================================================================
// MARK: TickTraceAnalyzer — cross-trace pattern analysis
// ============================================================================

/**
 * Analyzes patterns across multiple trace records — error clustering,
 * duration anomalies, mutation spikes, and replay integrity issues.
 */
export class TickTraceAnalyzer {
  private readonly _rolling: TickTraceRollingStats;
  private readonly _recorder: TickTraceRecorder;

  public constructor(rolling: TickTraceRollingStats, recorder: TickTraceRecorder) {
    this._rolling = rolling;
    this._recorder = recorder;
  }

  public computeAnomalyScore(record: TickTraceRecord): number {
    const snap = this._rolling.snapshot();
    if (snap.sampleCount < 3) return 0;
    const durDev = Math.abs(record.durationMs - snap.avgDurationMs) /
      Math.max(1, snap.avgDurationMs);
    const errorPenalty = record.status === 'ERROR' ? 0.5 : 0;
    const mutPenalty = clamp01(record.mutation.changedTopLevelKeys.length / TRACE_SURFACE_KEYS.length) * 0.3;
    const budgetPenalty = record.durationMs > TICK_TRACE_STEP_BUDGET_MS * TICK_TRACE_SLOW_MULTIPLIER ? 0.3 : 0;
    return clamp01(clamp01(durDev * 0.4) + errorPenalty + mutPenalty + budgetPenalty);
  }

  public detectErrorClusters(): readonly string[] {
    const errors = this._recorder.listErrors(20);
    if (errors.length < 3) return [];
    const clusters: string[] = [];
    const stepCounts: Record<string, number> = {};
    for (const r of errors) {
      const key = String(r.step);
      stepCounts[key] = (stepCounts[key] ?? 0) + 1;
    }
    for (const [step, count] of Object.entries(stepCounts)) {
      if (count >= 3) clusters.push(`Step ${step} has ${count} recent errors`);
    }
    return Object.freeze(clusters);
  }

  public computeReplayIntegrityScore(): number {
    const recent = this._recorder.listRecent(32);
    if (recent.length === 0) return 1;
    const validSeals = recent.filter(r => r.seal.length > 0).length;
    const validAfter = recent.filter(r => r.afterChecksum !== null).length;
    return clamp01((validSeals + validAfter) / (recent.length * 2));
  }

  public getStepStats(runId: string): readonly TickTraceStepStats[] {
    const coverage = this._recorder.getRunCoverage(runId);
    const total = coverage.traceCount;
    if (total === 0) return [];
    return Object.entries(coverage.stepCoverage).map(([step, count]) => {
      const records = this._recorder.listForRun(runId).filter(r => String(r.step) === step);
      const errors = records.filter(r => r.status === 'ERROR').length;
      const avgDur = records.length === 0 ? 0 :
        records.reduce((s, r) => s + r.durationMs, 0) / records.length;
      return Object.freeze({
        step,
        count,
        rate: count / total,
        avgDurationMs: avgDur,
        errorRate: records.length === 0 ? 0 : errors / records.length,
      });
    });
  }

  public computeHealthScore(): number {
    const errorRate = this._recorder.errorRate;
    const replayScore = this.computeReplayIntegrityScore();
    const budgetPressure = this._rolling.snapshot().overBudgetRate;
    return clamp01(1 - errorRate * 0.5 - (1 - replayScore) * 0.3 - budgetPressure * 0.2);
  }
}

// ============================================================================
// MARK: TickTraceHealthMonitor — graded health reporting
// ============================================================================

const TRACE_HEALTH_THRESHOLDS: readonly [TickTraceHealthGrade, number][] = [
  ['S', 0.97],
  ['A', 0.92],
  ['B', 0.82],
  ['C', 0.65],
  ['D', 0.45],
  ['F', 0],
];

/**
 * Derives a letter-grade health report for the trace recorder based on
 * error rates, seal validation, mutation stability, and budget compliance.
 */
export class TickTraceHealthMonitor {
  private readonly _analyzer: TickTraceAnalyzer;
  private readonly _rolling: TickTraceRollingStats;
  private _lastGrade: TickTraceHealthGrade = 'A';
  private _degradationCount = 0;
  private _recoveryCount = 0;

  public constructor(analyzer: TickTraceAnalyzer, rolling: TickTraceRollingStats) {
    this._analyzer = analyzer;
    this._rolling = rolling;
  }

  public computeGrade(): TickTraceHealthGrade {
    const score = this._analyzer.computeHealthScore();
    for (const [grade, threshold] of TRACE_HEALTH_THRESHOLDS) {
      if (score >= threshold) return grade;
    }
    return 'F';
  }

  public buildReport(): TickTraceHealthReport {
    const grade = this.computeGrade();
    const snap = this._rolling.snapshot();
    const recommendations: string[] = [];
    if (snap.errorRate > 0.1) recommendations.push('Trace error rate exceeds 10%.');
    if (snap.overBudgetRate > 0.2) recommendations.push('Over 20% of traces exceed step budget.');
    const replayScore = this._analyzer.computeReplayIntegrityScore();
    if (replayScore < 0.9) recommendations.push('Replay integrity below 90% — check seal generation.');
    if (grade === 'D' || grade === 'F') recommendations.push('Critical trace health — review engine pipeline.');

    return Object.freeze({
      grade,
      sampleCount: snap.sampleCount,
      errorRate: snap.errorRate,
      avgDurationMs: snap.avgDurationMs,
      overBudgetRate: snap.overBudgetRate,
      sealValidationRate: replayScore,
      mutationStability: clamp01(1 - this._rolling.computeMutationVolatility()),
      recommendations: Object.freeze(recommendations),
      generatedAtMs: Date.now(),
    });
  }

  public observe(grade: TickTraceHealthGrade): void {
    const passing = (g: TickTraceHealthGrade) => g === 'S' || g === 'A' || g === 'B';
    if (passing(this._lastGrade) && !passing(grade)) this._degradationCount++;
    if (!passing(this._lastGrade) && passing(grade)) this._recoveryCount++;
    this._lastGrade = grade;
  }

  public get lastGrade(): TickTraceHealthGrade { return this._lastGrade; }
  public get degradationCount(): number { return this._degradationCount; }
  public get recoveryCount(): number { return this._recoveryCount; }

  public reset(): void {
    this._lastGrade = 'A';
    this._degradationCount = 0;
    this._recoveryCount = 0;
  }
}

// ============================================================================
// MARK: TickTraceChatSignalGenerator — structured chat signal production
// ============================================================================

/**
 * Generates structured chat signals from trace events.
 * Used by TickTraceSignalAdapter to produce backend-chat ingress.
 */
export class TickTraceChatSignalGenerator {
  private readonly _monitor: TickTraceHealthMonitor;
  private readonly _analyzer: TickTraceAnalyzer;
  private _lastEmittedGrade: TickTraceHealthGrade | null = null;

  public constructor(monitor: TickTraceHealthMonitor, analyzer: TickTraceAnalyzer) {
    this._monitor = monitor;
    this._analyzer = analyzer;
  }

  public signalForRecord(record: TickTraceRecord): TickTraceChatSignalEnvelope | null {
    const anomaly = this._analyzer.computeAnomalyScore(record);
    if (anomaly < TICK_TRACE_ANOMALY_THRESHOLD && record.status !== 'ERROR') return null;

    const kind: TickTraceChatSignalKind = record.status === 'ERROR'
      ? 'TRACE_ERROR_SPIKE'
      : record.durationMs > TICK_TRACE_STEP_BUDGET_MS * TICK_TRACE_SLOW_MULTIPLIER
        ? 'TRACE_SLOW_STEP'
        : 'TRACE_MUTATION_ANOMALY';

    const severity = record.status === 'ERROR' ? 'error' :
      anomaly > 0.8 ? 'error' : 'warn';

    return this._buildEnvelope({
      surface: 'tick_trace',
      kind,
      tick: record.tick,
      runId: record.runId,
      traceId: record.traceId,
      step: String(record.step),
      severity,
      message: record.status === 'ERROR'
        ? `Trace error at step ${String(record.step)}: ${record.errorMessage}`
        : `Trace anomaly at step ${String(record.step)} — duration ${record.durationMs.toFixed(1)}ms`,
      durationMs: record.durationMs,
      errorMessage: record.errorMessage,
      healthGrade: this._monitor.computeGrade(),
      anomalyScore: anomaly,
      eventCount: record.eventCount,
      signalCount: record.signalCount,
      changedKeyCount: record.mutation.changedTopLevelKeys.length,
      sealValid: record.seal.length > 0,
    });
  }

  public signalForHealthChange(
    tick: number,
    runId: string,
    traceId: string,
    grade: TickTraceHealthGrade,
  ): TickTraceChatSignalEnvelope | null {
    const passing = (g: TickTraceHealthGrade) => g === 'S' || g === 'A' || g === 'B';
    const wasPassing = this._lastEmittedGrade !== null ? passing(this._lastEmittedGrade) : true;
    const nowPassing = passing(grade);
    let kind: TickTraceChatSignalKind | null = null;
    if (wasPassing && !nowPassing) kind = 'TRACE_HEALTH_DEGRADED';
    if (!wasPassing && nowPassing) kind = 'TRACE_HEALTH_RECOVERED';
    if (!kind) return null;
    this._lastEmittedGrade = grade;

    return this._buildEnvelope({
      surface: 'tick_trace',
      kind,
      tick,
      runId,
      traceId,
      step: 'STEP_09_TELEMETRY',
      severity: nowPassing ? 'info' : (grade === 'F' ? 'error' : 'warn'),
      message: `Tick trace health ${kind === 'TRACE_HEALTH_DEGRADED' ? 'degraded' : 'recovered'}: grade ${grade}`,
      durationMs: null,
      errorMessage: null,
      healthGrade: grade,
      anomalyScore: null,
      eventCount: null,
      signalCount: null,
      changedKeyCount: null,
      sealValid: null,
    });
  }

  public signalForMLVector(
    tick: number,
    runId: string,
    mlVector: TickTraceMLVector,
  ): TickTraceChatSignalEnvelope {
    const traceId = createDeterministicId('trace-ml-signal', runId, tick, 'ml');
    return this._buildEnvelope({
      surface: 'tick_trace',
      kind: 'TRACE_ML_VECTOR_READY',
      tick,
      runId,
      traceId,
      step: 'STEP_09_TELEMETRY',
      severity: 'info',
      message: `ML vector ready for tick ${tick} (${TICK_TRACE_ML_FEATURE_COUNT} features, ${mlVector.sampleCount} samples)`,
      durationMs: null,
      errorMessage: null,
      healthGrade: null,
      anomalyScore: mlVector.features[29] ?? null,
      eventCount: null,
      signalCount: null,
      changedKeyCount: null,
      sealValid: null,
    });
  }

  public signalForReplayIntegrity(
    tick: number,
    runId: string,
    traceId: string,
    integrityScore: number,
  ): TickTraceChatSignalEnvelope | null {
    if (integrityScore >= 0.9) return null;
    return this._buildEnvelope({
      surface: 'tick_trace',
      kind: 'TRACE_REPLAY_INTEGRITY',
      tick,
      runId,
      traceId,
      step: 'STEP_12_EVENT_SEAL',
      severity: integrityScore < 0.5 ? 'error' : 'warn',
      message: `Replay integrity below threshold: ${(integrityScore * 100).toFixed(1)}%`,
      durationMs: null,
      errorMessage: null,
      healthGrade: this._monitor.computeGrade(),
      anomalyScore: clamp01(1 - integrityScore),
      eventCount: null,
      signalCount: null,
      changedKeyCount: null,
      sealValid: integrityScore > 0.5,
    });
  }

  private _buildEnvelope(payload: TickTraceChatSignalPayload): TickTraceChatSignalEnvelope {
    const now = Date.now();
    return Object.freeze({
      signalId: createDeterministicId(
        'tick-trace-chat',
        payload.runId,
        payload.tick,
        payload.traceId,
        payload.kind,
        now,
      ),
      payload: Object.freeze(payload),
      emittedAtMs: now,
      dedupeKey: checksumParts(
        payload.runId,
        payload.tick,
        payload.traceId,
        payload.kind,
        payload.severity,
      ),
    });
  }

  public reset(): void {
    this._lastEmittedGrade = null;
  }
}

// ============================================================================
// MARK: TickTraceBatchRecorder — batch commit surface
// ============================================================================

/**
 * Records multiple tick traces in a single operation, returning a batch
 * result with accepted/rejected counts and stored records.
 */
export class TickTraceBatchRecorder {
  private readonly _recorder: TickTraceRecorder;
  private readonly _rolling: TickTraceRollingStats;
  private _batchCount = 0;
  private _totalAccepted = 0;
  private _totalRejected = 0;

  public constructor(recorder: TickTraceRecorder, rolling: TickTraceRollingStats) {
    this._recorder = recorder;
    this._rolling = rolling;
  }

  public batchCommit(
    handles: readonly TickTraceHandle[],
    inputs: readonly TickTraceCommitInput[],
  ): TickTraceBatchResult {
    const records: TickTraceRecord[] = [];
    let accepted = 0;
    let rejected = 0;

    const len = Math.min(handles.length, inputs.length);
    for (let i = 0; i < len; i++) {
      const handle = handles[i];
      const input = inputs[i];
      if (!handle || !input) { rejected++; continue; }
      try {
        const record = this._recorder.commitSuccess(handle, input);
        this._rolling.push(record);
        records.push(record);
        accepted++;
      } catch {
        rejected++;
      }
    }

    this._batchCount++;
    this._totalAccepted += accepted;
    this._totalRejected += rejected;

    return Object.freeze({
      accepted,
      rejected,
      records: Object.freeze(records),
    });
  }

  public batchCommitFailures(
    handles: readonly TickTraceHandle[],
    inputs: readonly TickTraceFailureInput[],
  ): TickTraceBatchResult {
    const records: TickTraceRecord[] = [];
    let accepted = 0;
    let rejected = 0;

    const len = Math.min(handles.length, inputs.length);
    for (let i = 0; i < len; i++) {
      const handle = handles[i];
      const input = inputs[i];
      if (!handle || !input) { rejected++; continue; }
      try {
        const record = this._recorder.commitFailure(handle, input);
        this._rolling.push(record);
        records.push(record);
        accepted++;
      } catch {
        rejected++;
      }
    }

    this._batchCount++;
    this._totalAccepted += accepted;
    this._totalRejected += rejected;

    return Object.freeze({ accepted, rejected, records: Object.freeze(records) });
  }

  public get batchCount(): number { return this._batchCount; }
  public get totalAccepted(): number { return this._totalAccepted; }
  public get totalRejected(): number { return this._totalRejected; }

  public reset(): void {
    this._batchCount = 0;
    this._totalAccepted = 0;
    this._totalRejected = 0;
  }
}

// ============================================================================
// MARK: TickTraceDiagnosticsService — full per-run diagnostics
// ============================================================================

/**
 * Aggregates all analytics surfaces into a structured diagnostics snapshot.
 * Used by observability pipelines, health dashboards, and chat telemetry.
 */
export class TickTraceDiagnosticsService {
  private readonly _recorder: TickTraceRecorder;
  private readonly _rolling: TickTraceRollingStats;
  private readonly _analyzer: TickTraceAnalyzer;
  private readonly _monitor: TickTraceHealthMonitor;
  private readonly _capacity: number;
  private readonly _snapshots: TickTraceDiagnosticsSnapshot[] = [];

  public constructor(
    recorder: TickTraceRecorder,
    rolling: TickTraceRollingStats,
    analyzer: TickTraceAnalyzer,
    monitor: TickTraceHealthMonitor,
    capacity = 60,
  ) {
    this._recorder = recorder;
    this._rolling = rolling;
    this._analyzer = analyzer;
    this._monitor = monitor;
    this._capacity = Math.max(1, capacity);
  }

  public capture(
    tick: number,
    runId: string,
    mlVector: TickTraceMLVector | null = null,
  ): TickTraceDiagnosticsSnapshot {
    const grade = this._monitor.computeGrade();
    this._monitor.observe(grade);

    const snap = this._rolling.snapshot();
    const stepStats = this._analyzer.getStepStats(runId);
    const errorClusters = this._analyzer.detectErrorClusters();
    const recentErrors = this._recorder.listErrors(5).map(r =>
      `tick ${r.tick} step ${String(r.step)}: ${r.errorMessage ?? 'unknown error'}`,
    );

    const snapshot: TickTraceDiagnosticsSnapshot = Object.freeze({
      runId,
      tick,
      healthGrade: grade,
      windowSnapshot: snap,
      stepStats: Object.freeze(stepStats),
      recentErrors: Object.freeze([...recentErrors, ...errorClusters]),
      mlVector,
      capturedAtMs: Date.now(),
    });

    this._snapshots.push(snapshot);
    if (this._snapshots.length > this._capacity) this._snapshots.shift();
    return snapshot;
  }

  public getLastSnapshot(): TickTraceDiagnosticsSnapshot | null {
    return this._snapshots[this._snapshots.length - 1] ?? null;
  }

  public getRecentSnapshots(n: number): readonly TickTraceDiagnosticsSnapshot[] {
    return this._snapshots.slice(Math.max(0, this._snapshots.length - n));
  }

  public buildHealthSummary(): Readonly<{
    currentGrade: TickTraceHealthGrade;
    degradationCount: number;
    recoveryCount: number;
    totalRecords: number;
    errorRate: number;
    replayIntegrityScore: number;
  }> {
    return Object.freeze({
      currentGrade: this._monitor.computeGrade(),
      degradationCount: this._monitor.degradationCount,
      recoveryCount: this._monitor.recoveryCount,
      totalRecords: this._recorder.totalCommitted,
      errorRate: this._recorder.errorRate,
      replayIntegrityScore: this._analyzer.computeReplayIntegrityScore(),
    });
  }

  public reset(): void {
    this._snapshots.length = 0;
    this._monitor.reset();
  }
}

// ============================================================================
// MARK: TickTraceFacade — authoritative high-level entry point
// ============================================================================

export interface TickTraceFacadeOptions {
  readonly maxRecords?: number;
  readonly rollingWindowCapacity?: number;
  readonly diagnosticsCapacity?: number;
}

export interface TickTraceFacadeCommitResult {
  readonly record: TickTraceRecord;
  readonly mlVector: TickTraceMLVector;
  readonly dlTensor: TickTraceDLTensor;
  readonly chatSignals: readonly TickTraceChatSignalEnvelope[];
  readonly healthGrade: TickTraceHealthGrade;
  readonly anomalyScore: number;
  readonly isAnomaly: boolean;
}

/**
 * The authoritative facade for all tick trace operations. ML/DL vector
 * production, health monitoring, chat signal generation, and batch recording
 * all flow through this class.
 */
export class TickTraceFacade {
  public readonly recorder: TickTraceRecorder;
  private readonly _rolling: TickTraceRollingStats;
  private readonly _analyzer: TickTraceAnalyzer;
  private readonly _monitor: TickTraceHealthMonitor;
  private readonly _mlBuilder: TickTraceMLVectorBuilder;
  private readonly _dlBuilder: TickTraceDLTensorBuilder;
  private readonly _signalGen: TickTraceChatSignalGenerator;
  private readonly _batch: TickTraceBatchRecorder;
  private readonly _diagnostics: TickTraceDiagnosticsService;

  public constructor(options: TickTraceFacadeOptions = {}) {
    this.recorder = new TickTraceRecorder({ maxRecords: options.maxRecords });
    this._rolling = new TickTraceRollingStats(options.rollingWindowCapacity);
    this._analyzer = new TickTraceAnalyzer(this._rolling, this.recorder);
    this._monitor = new TickTraceHealthMonitor(this._analyzer, this._rolling);
    this._mlBuilder = new TickTraceMLVectorBuilder(this._rolling, this.recorder);
    this._dlBuilder = new TickTraceDLTensorBuilder(this._mlBuilder, this._rolling, this.recorder);
    this._signalGen = new TickTraceChatSignalGenerator(this._monitor, this._analyzer);
    this._batch = new TickTraceBatchRecorder(this.recorder, this._rolling);
    this._diagnostics = new TickTraceDiagnosticsService(
      this.recorder, this._rolling, this._analyzer, this._monitor,
      options.diagnosticsCapacity,
    );
  }

  public begin(
    snapshot: RunStateSnapshot,
    trace: TickTrace,
    startedAtMs: number,
  ): TickTraceHandle {
    return this.recorder.begin(snapshot, trace, startedAtMs);
  }

  public commitSuccess(
    handle: TickTraceHandle,
    input: TickTraceCommitInput,
  ): TickTraceFacadeCommitResult {
    const record = this.recorder.commitSuccess(handle, input);
    return this._buildResult(record, record.runId, record.tick);
  }

  public commitFailure(
    handle: TickTraceHandle,
    input: TickTraceFailureInput,
  ): TickTraceFacadeCommitResult {
    const record = this.recorder.commitFailure(handle, input);
    return this._buildResult(record, record.runId, record.tick);
  }

  public batchCommit(
    handles: readonly TickTraceHandle[],
    inputs: readonly TickTraceCommitInput[],
  ): TickTraceBatchResult {
    return this._batch.batchCommit(handles, inputs);
  }

  public getDiagnostics(tick: number, runId: string): TickTraceDiagnosticsSnapshot {
    const mlVector = this._mlBuilder.build(tick, runId);
    return this._diagnostics.capture(tick, runId, mlVector);
  }

  public buildHealthReport(): TickTraceHealthReport {
    return this._monitor.buildReport();
  }

  public getMLVector(tick: number, runId: string): TickTraceMLVector {
    return this._mlBuilder.build(tick, runId);
  }

  public getDLTensor(tick: number, runId: string): TickTraceDLTensor {
    return this._dlBuilder.build(tick, runId);
  }

  public resetRun(): void {
    this._diagnostics.reset();
    this._signalGen.reset();
    this._batch.reset();
    this._monitor.reset();
  }

  public get batchStats(): Readonly<{ batchCount: number; totalAccepted: number; totalRejected: number }> {
    return Object.freeze({
      batchCount: this._batch.batchCount,
      totalAccepted: this._batch.totalAccepted,
      totalRejected: this._batch.totalRejected,
    });
  }

  private _buildResult(
    record: TickTraceRecord,
    runId: string,
    tick: number,
  ): TickTraceFacadeCommitResult {
    this._rolling.push(record);
    const mlVector = this._mlBuilder.build(tick, runId);
    const dlTensor = this._dlBuilder.build(tick, runId);
    const healthGrade = this._monitor.computeGrade();
    const anomalyScore = this._analyzer.computeAnomalyScore(record);

    const signals: TickTraceChatSignalEnvelope[] = [];
    const recordSignal = this._signalGen.signalForRecord(record);
    if (recordSignal) signals.push(recordSignal);

    const healthSig = this._signalGen.signalForHealthChange(tick, runId, record.traceId, healthGrade);
    if (healthSig) signals.push(healthSig);

    if (anomalyScore > TICK_TRACE_ANOMALY_THRESHOLD) {
      signals.push(this._signalGen.signalForMLVector(tick, runId, mlVector));
    }

    const replayScore = this._analyzer.computeReplayIntegrityScore();
    const replaySig = this._signalGen.signalForReplayIntegrity(tick, runId, record.traceId, replayScore);
    if (replaySig) signals.push(replaySig);

    return Object.freeze({
      record,
      mlVector,
      dlTensor,
      chatSignals: Object.freeze(signals),
      healthGrade,
      anomalyScore,
      isAnomaly: anomalyScore > TICK_TRACE_ANOMALY_THRESHOLD,
    });
  }
}

// ============================================================================
// MARK: Utility functions
// ============================================================================

/**
 * Returns diagnostic label metadata for external tooling.
 */
export function getTickTraceDiagnosticLabels(): Readonly<{
  mlFeatureCount: number;
  dlFeatureCount: number;
  mlLabels: readonly string[];
  dlLabels: readonly string[];
  surfaceKeyCount: number;
  moduleVersion: string;
  budgetMs: number;
}> {
  return Object.freeze({
    mlFeatureCount: TICK_TRACE_ML_FEATURE_COUNT,
    dlFeatureCount: TICK_TRACE_DL_FEATURE_COUNT,
    mlLabels: TICK_TRACE_ML_FEATURE_LABELS,
    dlLabels: TICK_TRACE_DL_FEATURE_LABELS,
    surfaceKeyCount: TRACE_SURFACE_KEYS.length,
    moduleVersion: TICK_TRACE_MODULE_VERSION,
    budgetMs: TICK_TRACE_STEP_BUDGET_MS,
  });
}

/**
 * Build a performance summary from a set of trace records.
 */
export function buildTracePerformanceSummary(
  records: readonly TickTraceRecord[],
): Readonly<{
  sampleCount: number;
  errorRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  p95DurationMs: number;
  avgChangedKeys: number;
}> {
  if (records.length === 0) {
    return Object.freeze({
      sampleCount: 0, errorRate: 0, avgDurationMs: 0,
      maxDurationMs: 0, p95DurationMs: 0, avgChangedKeys: 0,
    });
  }
  const durations = records.map(r => r.durationMs).sort((a, b) => a - b);
  const errors = records.filter(r => r.status === 'ERROR').length;
  return Object.freeze({
    sampleCount: records.length,
    errorRate: errors / records.length,
    avgDurationMs: durations.reduce((s, d) => s + d, 0) / durations.length,
    maxDurationMs: durations[durations.length - 1] ?? 0,
    p95DurationMs: percentile(durations, 0.95),
    avgChangedKeys:
      records.reduce((s, r) => s + r.mutation.changedTopLevelKeys.length, 0) / records.length,
  });
}

/**
 * Creates a fully-frozen snapshot of a trace record for safe sharing.
 */
export function freezeTraceRecord(record: TickTraceRecord): TickTraceRecord {
  return deepFrozenClone(record);
}

/**
 * Create a standalone facade with default options.
 */
export function createTickTraceFacade(options: TickTraceFacadeOptions = {}): TickTraceFacade {
  return new TickTraceFacade(options);
}

/**
 * Grade a trace health score into a letter grade.
 */
export function gradeTickTraceHealth(score: number): TickTraceHealthGrade {
  for (const [grade, threshold] of TRACE_HEALTH_THRESHOLDS) {
    if (score >= threshold) return grade;
  }
  return 'F';
}

// ============================================================================
// MARK: Module manifest and footer constants
// ============================================================================

export const TICK_TRACE_COMPLETE = true as const;
export const TICK_TRACE_HEALTH_GRADE_THRESHOLDS = Object.freeze(
  TRACE_HEALTH_THRESHOLDS.map(([grade, threshold]) => ({ grade, threshold })),
);

export const TICK_TRACE_MODULE_EXPORTS = Object.freeze([
  'TickTraceRecorder',
  'TickTraceRollingStats',
  'TickTraceMLVectorBuilder',
  'TickTraceDLTensorBuilder',
  'TickTraceAnalyzer',
  'TickTraceHealthMonitor',
  'TickTraceChatSignalGenerator',
  'TickTraceBatchRecorder',
  'TickTraceDiagnosticsService',
  'TickTraceFacade',
]);
