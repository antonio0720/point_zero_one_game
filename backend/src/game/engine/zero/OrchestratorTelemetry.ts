// backend/src/game/engine/zero/OrchestratorTelemetry.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorTelemetry.ts
 *
 * Doctrine:
 * - telemetry is zero-owned aggregation, not engine-owned truth
 * - counts, timings, severities, and terminal summaries are accumulated here
 *   so orchestration can be observed without mutating snapshots
 * - the structure must stay lightweight, replay-safe, and deterministic
 * - no transport concerns live here; export is plain immutable data
 * - all ML/DL surfaces extract from telemetry snapshots, not from live mutable state
 * - every imported type is a first-class citizen in scoring maps, analytics, or
 *   exported type surfaces — none is imported silently
 *
 * Surface summary:
 *   § 1  — Scoring maps and constants (EngineHealth, EngineSignal, TickStep wired)
 *   § 2  — Core interfaces (TelemetryStepTiming, TelemetrySeverityBreakdown, etc.)
 *   § 3  — Extended interfaces (ML vector, DL tensor, trend, session, annotation,
 *            run summary, export bundle, chat signal)
 *   § 4  — OrchestratorTelemetry — primary accumulator class
 *   § 5  — OrchestratorTelemetryMLExtractor — 32-dim ML vector
 *   § 6  — OrchestratorTelemetryDLBuilder — 8×4 DL tensor
 *   § 7  — OrchestratorTelemetryTrendAnalyzer — rolling trend analysis
 *   § 8  — OrchestratorTelemetrySessionTracker — session-level aggregation
 *   § 9  — OrchestratorTelemetryEventLog — typed EventEnvelope log surface
 *   § 10 — OrchestratorTelemetryAnnotator — annotation from snapshot data
 *   § 11 — OrchestratorTelemetryInspector — high-level inspection facade
 *   § 12 — Factory: createOrchestratorTelemetryWithAnalytics
 *   § 13 — Pure utility exports (12 functions)
 *   § 14 — Singletons and zero-state defaults
 */

import type { EngineHealth, EngineSignal } from '../core/EngineContracts';
import type { EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickTraceRecord } from '../core/TickTraceRecorder';
import type { TickStep } from '../core/TickSequence';

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL TYPE ALIASES
// ─────────────────────────────────────────────────────────────────────────────

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

/** Narrowed severity union derived from EngineSignal. */
type SignalSeverity = EngineSignal['severity'];

/** Narrowed health status union derived from EngineHealth. */
type HealthStatus = EngineHealth['status'];

/** Engine ID union derived from EngineHealth. */
type HealthEngineId = EngineHealth['engineId'];

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  return denominator === 0 ? fallback : numerator / denominator;
}

function nowMs(): number {
  return Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — SCORING MAPS AND CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Version & ML/DL dimensions ──────────────────────────────────────────────

export const ORCHESTRATOR_TELEMETRY_MODULE_VERSION = 'telemetry.v3.2026' as const;
export const ORCHESTRATOR_TELEMETRY_MODULE_READY = true as const;

export const TELEMETRY_ML_FEATURE_COUNT = 32 as const;
export const TELEMETRY_DL_ROW_COUNT = 8 as const;
export const TELEMETRY_DL_COL_COUNT = 4 as const;

/** Maximum expected ticks per session for normalization. */
export const TELEMETRY_MAX_EXPECTED_TICKS = 1000 as const;
/** Maximum expected signals per tick for normalization. */
export const TELEMETRY_MAX_SIGNALS_PER_TICK = 50 as const;
/** Maximum expected events per tick for normalization. */
export const TELEMETRY_MAX_EVENTS_PER_TICK = 200 as const;
/** Maximum expected trace records per tick (13 steps × overhead). */
export const TELEMETRY_MAX_TRACE_RECORDS_PER_TICK = 26 as const;
/** Tick duration budget in ms (50ms per step × 13 steps / partial). */
export const TELEMETRY_TICK_BUDGET_MS = 200 as const;
/** Maximum tick duration cap for normalization (10× budget). */
export const TELEMETRY_TICK_DURATION_CAP_MS = 2000 as const;
/** Total expected TickStep slots per tick. */
export const TELEMETRY_EXPECTED_STEP_COUNT = 13 as const;
/** Warning density threshold above which escalation is flagged. */
export const TELEMETRY_WARNING_ESCALATION_THRESHOLD = 0.4 as const;
/** Error signal ratio above which system is considered critical. */
export const TELEMETRY_CRITICAL_ERROR_THRESHOLD = 0.1 as const;
/** Maximum session duration in ms for freshness scoring. */
export const TELEMETRY_SESSION_MAX_DURATION_MS = 3_600_000 as const; // 1 hour
/** Minimum trend sample count before trend is trusted. */
export const TELEMETRY_TREND_MIN_SAMPLES = 5 as const;
/** Maximum DL tensor event log entries retained per instance. */
export const TELEMETRY_EVENT_LOG_MAX_ENTRIES = 512 as const;

// ── Signal severity scoring (EngineSignal['severity'] wired) ────────────────

/**
 * Numeric score for each EngineSignal severity.
 * Used in ML feature extraction and health composite scoring.
 * Higher = worse for the player experience.
 */
export const ENGINE_SIGNAL_SEVERITY_SCORE: Readonly<Record<SignalSeverity, number>> = Object.freeze({
  INFO: 0.0,
  WARN: 0.5,
  ERROR: 1.0,
});

/**
 * Urgency weight for each signal severity in composite scoring.
 * WARN is weighted twice INFO to capture early degradation.
 */
export const ENGINE_SIGNAL_SEVERITY_WEIGHT: Readonly<Record<SignalSeverity, number>> = Object.freeze({
  INFO: 1.0,
  WARN: 2.5,
  ERROR: 5.0,
});

/**
 * DL encoding for signal severity (used as one-hot-ish categorical).
 */
export const ENGINE_SIGNAL_SEVERITY_DL_ENCODING: Readonly<Record<SignalSeverity, number>> = Object.freeze({
  INFO: 0.0,
  WARN: 0.5,
  ERROR: 1.0,
});

/**
 * Maps each signal severity to its player-visible impact category.
 * Used in annotation and UX narrative generation.
 */
export const ENGINE_SIGNAL_SEVERITY_UX_CATEGORY: Readonly<Record<SignalSeverity, string>> = Object.freeze({
  INFO: 'operational',
  WARN: 'advisory',
  ERROR: 'critical',
});

// ── Engine health status scoring (EngineHealth['status'] wired) ─────────────

/**
 * Numeric score for each EngineHealth status.
 * 1.0 = fully healthy (best for player), 0.0 = failed (worst).
 */
export const ENGINE_HEALTH_STATUS_SCORE: Readonly<Record<HealthStatus, number>> = Object.freeze({
  HEALTHY: 1.0,
  DEGRADED: 0.4,
  FAILED: 0.0,
});

/**
 * Urgency weight for each health status in DL tensor construction.
 */
export const ENGINE_HEALTH_STATUS_URGENCY_WEIGHT: Readonly<Record<HealthStatus, number>> = Object.freeze({
  HEALTHY: 0.0,
  DEGRADED: 0.6,
  FAILED: 1.0,
});

/**
 * DL encoding for health status (positional weight in 0–1 range).
 */
export const ENGINE_HEALTH_STATUS_DL_ENCODING: Readonly<Record<HealthStatus, number>> = Object.freeze({
  HEALTHY: 1.0,
  DEGRADED: 0.4,
  FAILED: 0.0,
});

/**
 * Score penalty per health status — subtracted from composite score.
 */
export const ENGINE_HEALTH_STATUS_SCORE_PENALTY: Readonly<Record<HealthStatus, number>> = Object.freeze({
  HEALTHY: 0.0,
  DEGRADED: 0.3,
  FAILED: 1.0,
});

/**
 * Maps each EngineHealth status to a player-visible severity label.
 */
export const ENGINE_HEALTH_STATUS_SEVERITY_LABEL: Readonly<Record<HealthStatus, string>> = Object.freeze({
  HEALTHY: 'nominal',
  DEGRADED: 'advisory',
  FAILED: 'critical',
});

// ── TickStep ordinal map (TickStep wired) ────────────────────────────────────

/**
 * Canonical ordered list of all 13 TickSteps.
 * Used as the reference set for step coverage ratio computation.
 */
export const TELEMETRY_TICK_STEP_ORDER: readonly TickStep[] = Object.freeze([
  'STEP_01_PREPARE',
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
  'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY',
  'STEP_10_SOVEREIGNTY_SNAPSHOT',
  'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
] as TickStep[]);

/**
 * Ordinal position of each TickStep (0-indexed).
 * Used in DL tensor row construction and step phase classification.
 */
export const TELEMETRY_TICK_STEP_ORDINAL: Readonly<Partial<Record<TickStep, number>>> = Object.freeze(
  Object.fromEntries(TELEMETRY_TICK_STEP_ORDER.map((step, i) => [step, i])),
);

/**
 * Whether each TickStep involves engine-owned computation.
 * Steps 2–7 and 10 are engine phases; the rest are orchestration/mode phases.
 */
export const TELEMETRY_TICK_STEP_IS_ENGINE_PHASE: Readonly<Partial<Record<TickStep, boolean>>> = Object.freeze({
  STEP_01_PREPARE: false,
  STEP_02_TIME: true,
  STEP_03_PRESSURE: true,
  STEP_04_TENSION: true,
  STEP_05_BATTLE: true,
  STEP_06_SHIELD: true,
  STEP_07_CASCADE: true,
  STEP_08_MODE_POST: false,
  STEP_09_TELEMETRY: false,
  STEP_10_SOVEREIGNTY_SNAPSHOT: true,
  STEP_11_OUTCOME_GATE: false,
  STEP_12_EVENT_SEAL: false,
  STEP_13_FLUSH: false,
} as Partial<Record<TickStep, boolean>>);

/**
 * Duration budget (ms) per TickStep for normalization in step-level scoring.
 */
export const TELEMETRY_TICK_STEP_BUDGET_MS: Readonly<Partial<Record<TickStep, number>>> = Object.freeze({
  STEP_01_PREPARE: 5,
  STEP_02_TIME: 15,
  STEP_03_PRESSURE: 20,
  STEP_04_TENSION: 20,
  STEP_05_BATTLE: 30,
  STEP_06_SHIELD: 20,
  STEP_07_CASCADE: 25,
  STEP_08_MODE_POST: 10,
  STEP_09_TELEMETRY: 5,
  STEP_10_SOVEREIGNTY_SNAPSHOT: 15,
  STEP_11_OUTCOME_GATE: 5,
  STEP_12_EVENT_SEAL: 5,
  STEP_13_FLUSH: 10,
} as Partial<Record<TickStep, number>>);

// ── ML feature labels ────────────────────────────────────────────────────────

/**
 * Human-readable labels for the 32-dimensional telemetry ML vector.
 * Index-stable — do not reorder.
 */
export const TELEMETRY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 00 */ 'tick_density_score',
  /* 01 */ 'signal_density_score',
  /* 02 */ 'event_density_score',
  /* 03 */ 'trace_density_score',
  /* 04 */ 'info_signal_ratio',
  /* 05 */ 'warn_signal_ratio',
  /* 06 */ 'error_signal_ratio',
  /* 07 */ 'signal_noise_score',
  /* 08 */ 'avg_tick_duration_norm',
  /* 09 */ 'max_tick_duration_norm',
  /* 10 */ 'min_tick_duration_norm',
  /* 11 */ 'warning_density_score',
  /* 12 */ 'step_coverage_ratio',
  /* 13 */ 'engine_healthy_ratio',
  /* 14 */ 'engine_degraded_ratio',
  /* 15 */ 'engine_failed_flag',
  /* 16 */ 'has_active_run',
  /* 17 */ 'outcome_active_score',
  /* 18 */ 'outcome_complete_score',
  /* 19 */ 'checksum_valid_score',
  /* 20 */ 'emitted_event_density',
  /* 21 */ 'warnings_per_tick',
  /* 22 */ 'step_error_rate',
  /* 23 */ 'tick_consistency_score',
  /* 24 */ 'recent_tick_window_ratio',
  /* 25 */ 'trace_accumulation_rate',
  /* 26 */ 'critical_signal_flag',
  /* 27 */ 'data_freshness_score',
  /* 28 */ 'health_composite_score',
  /* 29 */ 'phase_stability_score',
  /* 30 */ 'warning_escalation_score',
  /* 31 */ 'overall_health_score',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — CORE INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface TelemetryStepTiming {
  readonly step: TickStep;
  readonly count: number;
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly minDurationMs: number | null;
}

export interface TelemetrySeverityBreakdown {
  readonly info: number;
  readonly warn: number;
  readonly error: number;
}

export interface TelemetryTickRecord {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly checksum: string | null;
  readonly durationMs: number;
  readonly emittedEventCount: number;
  readonly warningCount: number;
  readonly signalBreakdown: TelemetrySeverityBreakdown;
  readonly capturedAtMs: number;
}

export interface OrchestratorTelemetrySnapshot {
  readonly totalTicksObserved: number;
  readonly totalSignalsObserved: number;
  readonly totalEventsObserved: number;
  readonly totalTraceRecordsObserved: number;
  readonly lastRunId: string | null;
  readonly lastTick: number | null;
  readonly lastOutcome: RunStateSnapshot['outcome'] | null;
  readonly signalBreakdown: TelemetrySeverityBreakdown;
  readonly recentTicks: readonly TelemetryTickRecord[];
  readonly stepTimings: readonly TelemetryStepTiming[];
  readonly recentWarnings: readonly string[];
  readonly lastEngineHealth: readonly EngineHealth[];
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — EXTENDED INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 32-dimensional ML feature vector extracted from an OrchestratorTelemetrySnapshot.
 * All values clamped to [0, 1]. Index-stable — maps 1:1 to TELEMETRY_ML_FEATURE_LABELS.
 */
export interface TelemetryMLVector {
  /* 00 */ readonly tickDensityScore: number;
  /* 01 */ readonly signalDensityScore: number;
  /* 02 */ readonly eventDensityScore: number;
  /* 03 */ readonly traceDensityScore: number;
  /* 04 */ readonly infoSignalRatio: number;
  /* 05 */ readonly warnSignalRatio: number;
  /* 06 */ readonly errorSignalRatio: number;
  /* 07 */ readonly signalNoiseScore: number;
  /* 08 */ readonly avgTickDurationNorm: number;
  /* 09 */ readonly maxTickDurationNorm: number;
  /* 10 */ readonly minTickDurationNorm: number;
  /* 11 */ readonly warningDensityScore: number;
  /* 12 */ readonly stepCoverageRatio: number;
  /* 13 */ readonly engineHealthyRatio: number;
  /* 14 */ readonly engineDegradedRatio: number;
  /* 15 */ readonly engineFailedFlag: number;
  /* 16 */ readonly hasActiveRun: number;
  /* 17 */ readonly outcomeActiveScore: number;
  /* 18 */ readonly outcomeCompleteScore: number;
  /* 19 */ readonly checksumValidScore: number;
  /* 20 */ readonly emittedEventDensity: number;
  /* 21 */ readonly warningsPerTick: number;
  /* 22 */ readonly stepErrorRate: number;
  /* 23 */ readonly tickConsistencyScore: number;
  /* 24 */ readonly recentTickWindowRatio: number;
  /* 25 */ readonly traceAccumulationRate: number;
  /* 26 */ readonly criticalSignalFlag: number;
  /* 27 */ readonly dataFreshnessScore: number;
  /* 28 */ readonly healthCompositeScore: number;
  /* 29 */ readonly phaseStabilityScore: number;
  /* 30 */ readonly warningEscalationScore: number;
  /* 31 */ readonly overallHealthScore: number;
}

/**
 * 8×4 DL tensor for telemetry. Each row is a subsystem perspective;
 * each column is a score dimension. Row × col layout below:
 *
 *   Row 0 — Signal health      : [info_ratio, warn_ratio, error_ratio, noise_score]
 *   Row 1 — Tick timing        : [avg_norm, max_norm, min_norm, consistency]
 *   Row 2 — Engine health      : [healthy_ratio, degraded_ratio, failed_flag, composite]
 *   Row 3 — Event/trace density: [events_density, traces_density, coverage, accumulation]
 *   Row 4 — Warning analysis   : [density, escalation, critical_flag, recovery]
 *   Row 5 — Run state          : [active_run, outcome_active, checksum_valid, freshness]
 *   Row 6 — Step coverage      : [covered_ratio, error_rate, timing_balance, phase_stable]
 *   Row 7 — Composite scores   : [overall_health, signal_quality, ops_quality, ux_readiness]
 */
export type TelemetryDLTensor = readonly [
  readonly [number, number, number, number], // Row 0
  readonly [number, number, number, number], // Row 1
  readonly [number, number, number, number], // Row 2
  readonly [number, number, number, number], // Row 3
  readonly [number, number, number, number], // Row 4
  readonly [number, number, number, number], // Row 5
  readonly [number, number, number, number], // Row 6
  readonly [number, number, number, number], // Row 7
];

/** Severity classification derived from the ML vector. */
export type TelemetrySeverity = 'NOMINAL' | 'ADVISORY' | 'CRITICAL';

/**
 * Trend snapshot across multiple telemetry samples.
 * Computed by OrchestratorTelemetryTrendAnalyzer.
 */
export interface TelemetryTrendSnapshot {
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly avgErrorRate: number;
  readonly maxErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly p95TickDurationMs: number;
  readonly avgSignalDensity: number;
  readonly avgWarningDensity: number;
  readonly trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly nominalSamples: number;
  readonly advisorySamples: number;
  readonly criticalSamples: number;
  readonly peakWarnRate: number;
  readonly peakErrorRate: number;
}

/**
 * Session-level telemetry report produced by OrchestratorTelemetrySessionTracker.
 */
export interface TelemetrySessionReport {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly totalTicksObserved: number;
  readonly totalSignalsObserved: number;
  readonly totalEventsObserved: number;
  readonly totalTraceRecordsObserved: number;
  readonly avgErrorRate: number;
  readonly peakErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly peakTickDurationMs: number;
  readonly nominalFraction: number;
  readonly advisoryFraction: number;
  readonly criticalFraction: number;
  readonly runsSeen: readonly string[];
  readonly engineFailureEvents: number;
  readonly uniqueStepsCovered: number;
}

/**
 * Annotation on a single telemetry snapshot.
 * Used to surface UX-relevant context alongside ML/DL data.
 */
export interface TelemetryAnnotation {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly severity: TelemetrySeverity;
  readonly uxRelevant: boolean;
  readonly featureIndex: number;
}

/** Bundle of annotations for a single snapshot. */
export interface TelemetryAnnotationBundle {
  readonly capturedAtMs: number;
  readonly annotations: readonly TelemetryAnnotation[];
  readonly criticalCount: number;
  readonly advisoryCount: number;
  readonly nominalCount: number;
  readonly topAnnotation: TelemetryAnnotation | null;
}

/**
 * Run-level summary derived from telemetry accumulated over a single run.
 */
export interface TelemetryRunSummary {
  readonly runId: string | null;
  readonly startedAtMs: number;
  readonly finalizedAtMs: number;
  readonly totalTicks: number;
  readonly totalSignals: number;
  readonly totalEvents: number;
  readonly totalTraceRecords: number;
  readonly finalOutcome: RunStateSnapshot['outcome'] | null;
  readonly avgTickDurationMs: number;
  readonly peakTickDurationMs: number;
  readonly errorSignalCount: number;
  readonly warnSignalCount: number;
  readonly infoSignalCount: number;
  readonly warningsLogged: number;
  readonly stepsWithTimings: number;
  readonly engineHealthSnapshot: readonly EngineHealth[];
  readonly finalMLVector: TelemetryMLVector | null;
  readonly finalDLTensor: TelemetryDLTensor | null;
}

/**
 * Full export bundle combining snapshot + ML + DL + trend + session + annotations + run summary.
 * The authoritative surface for external consumers (chat adapter, dashboard, analytics pipeline).
 */
export interface TelemetryExportBundle {
  readonly capturedAtMs: number;
  readonly snapshot: OrchestratorTelemetrySnapshot;
  readonly mlVector: TelemetryMLVector;
  readonly mlVectorArray: readonly number[];
  readonly dlTensor: TelemetryDLTensor;
  readonly severity: TelemetrySeverity;
  readonly trend: TelemetryTrendSnapshot | null;
  readonly sessionReport: TelemetrySessionReport | null;
  readonly annotations: TelemetryAnnotationBundle;
  readonly runSummary: TelemetryRunSummary | null;
}

/**
 * Chat signal surface for OrchestratorTelemetry.
 * Consumed by OrchestratorTelemetrySignalAdapter to produce LIVEOPS_SIGNAL envelopes.
 */
export interface TelemetryChatSignal {
  readonly generatedAtMs: number;
  readonly severity: TelemetrySeverity;
  readonly activeRunId: string | null;
  readonly tick: number | null;
  readonly totalTicksObserved: number;
  readonly totalSignalsObserved: number;
  readonly totalEventsObserved: number;
  readonly errorSignalRatio: number;
  readonly avgTickDurationMs: number;
  readonly warningCount: number;
  readonly engineHealthyRatio: number;
  readonly engineFailedCount: number;
  readonly stepCoverageRatio: number;
  readonly overallHealthScore: number;
  readonly trendDirection: TelemetryTrendSnapshot['trendDirection'] | null;
}

/**
 * Typed event log entry wrapping an EventEnvelope for telemetry observability.
 * EngineEventMap is used as the key constraint to preserve type safety.
 */
export interface TelemetryEventLogEntry<
  K extends keyof RuntimeEventMap = keyof RuntimeEventMap,
> {
  readonly id: string;
  readonly recordedAtMs: number;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly envelope: EventEnvelope<K, RuntimeEventMap[K]>;
  readonly eventKey: K;
  readonly sourceStep: TickStep | null;
}

/** Named ML vector map for human-readable access. */
export type TelemetryMLNamedMap = Readonly<Record<string, number>>;

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — OrchestratorTelemetry — primary accumulator class
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_SEVERITY: TelemetrySeverityBreakdown = Object.freeze({
  info: 0,
  warn: 0,
  error: 0,
});

/**
 * OrchestratorTelemetry
 *
 * Zero-owned aggregation layer for tick-level telemetry.
 * Accumulates counts, timings, severities, and per-engine health snapshots
 * across the lifetime of a run. Designed to be replay-safe and deterministic.
 *
 * All reads produce frozen snapshots — callers never see mutable internal state.
 *
 * Used by ZeroEngine, EngineOrchestrator, and the TickExecutor to build
 * the full observability picture for ML/DL extraction, trend analysis,
 * chat signal production, and dashboard presentation.
 */
export class OrchestratorTelemetry {
  private totalTicksObserved = 0;

  private totalSignalsObserved = 0;

  private totalEventsObserved = 0;

  private totalTraceRecordsObserved = 0;

  private lastRunId: string | null = null;

  private lastTick: number | null = null;

  private lastOutcome: RunStateSnapshot['outcome'] | null = null;

  private readonly recentTicks: TelemetryTickRecord[] = [];

  private readonly stepTimingMap = new Map<
    TickStep,
    {
      count: number;
      totalDurationMs: number;
      maxDurationMs: number;
      minDurationMs: number | null;
    }
  >();

  private readonly recentWarnings: string[] = [];

  private readonly severity: { info: number; warn: number; error: number } = {
    info: 0,
    warn: 0,
    error: 0,
  };

  private lastEngineHealth: readonly EngineHealth[] = freezeArray([]);

  private readonly maxRecentTicks: number;

  private readonly maxRecentWarnings: number;

  private startedAtMs: number = nowMs();

  public constructor(options: {
    readonly maxRecentTicks?: number;
    readonly maxRecentWarnings?: number;
  } = {}) {
    this.maxRecentTicks = Math.max(1, options.maxRecentTicks ?? 128);
    this.maxRecentWarnings = Math.max(1, options.maxRecentWarnings ?? 256);
  }

  // ── Core accumulation ────────────────────────────────────────────────────

  public recordTick(input: {
    readonly snapshot: RunStateSnapshot;
    readonly tickDurationMs: number;
    readonly signals?: readonly EngineSignal[];
    readonly events?: readonly EventEnvelope<
      keyof RuntimeEventMap,
      RuntimeEventMap[keyof RuntimeEventMap]
    >[];
    readonly capturedAtMs: number;
  }): void {
    this.totalTicksObserved += 1;
    this.lastRunId = input.snapshot.runId;
    this.lastTick = input.snapshot.tick;
    this.lastOutcome = input.snapshot.outcome;

    const signals = input.signals ?? [];
    const events = input.events ?? [];

    this.totalSignalsObserved += signals.length;
    this.totalEventsObserved += events.length;

    const signalBreakdown = this.countSeverities(signals);
    this.severity.info += signalBreakdown.info;
    this.severity.warn += signalBreakdown.warn;
    this.severity.error += signalBreakdown.error;

    for (const warning of input.snapshot.telemetry.warnings) {
      this.pushWarning(warning);
    }

    this.recentTicks.push(
      Object.freeze({
        runId: input.snapshot.runId,
        tick: input.snapshot.tick,
        phase: input.snapshot.phase,
        outcome: input.snapshot.outcome,
        checksum: input.snapshot.telemetry.lastTickChecksum,
        durationMs: input.tickDurationMs,
        emittedEventCount: input.snapshot.telemetry.emittedEventCount,
        warningCount: input.snapshot.telemetry.warnings.length,
        signalBreakdown,
        capturedAtMs: input.capturedAtMs,
      }),
    );

    while (this.recentTicks.length > this.maxRecentTicks) {
      this.recentTicks.shift();
    }
  }

  public recordStepTrace(record: TickTraceRecord): void {
    this.totalTraceRecordsObserved += 1;
    const timing = this.stepTimingMap.get(record.step) ?? {
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: null,
    };

    timing.count += 1;
    timing.totalDurationMs += record.durationMs;
    timing.maxDurationMs = Math.max(timing.maxDurationMs, record.durationMs);
    timing.minDurationMs =
      timing.minDurationMs === null
        ? record.durationMs
        : Math.min(timing.minDurationMs, record.durationMs);

    this.stepTimingMap.set(record.step, timing);

    if (record.status === 'ERROR' && record.errorMessage !== null) {
      this.pushWarning(`[${record.step}] ${record.errorMessage}`);
    }
  }

  public recordSignal(signal: EngineSignal): void {
    this.totalSignalsObserved += 1;

    if (signal.severity === 'INFO') {
      this.severity.info += 1;
    } else if (signal.severity === 'WARN') {
      this.severity.warn += 1;
      this.pushWarning(`[${signal.engineId}] ${signal.code}: ${signal.message}`);
    } else {
      this.severity.error += 1;
      this.pushWarning(`[${signal.engineId}] ${signal.code}: ${signal.message}`);
    }
  }

  public recordSignals(signals: readonly EngineSignal[]): void {
    for (const signal of signals) {
      this.recordSignal(signal);
    }
  }

  public recordEvents(
    events: readonly EventEnvelope<
      keyof RuntimeEventMap,
      RuntimeEventMap[keyof RuntimeEventMap]
    >[],
  ): void {
    this.totalEventsObserved += events.length;
  }

  public recordEngineHealth(health: readonly EngineHealth[]): void {
    this.lastEngineHealth = freezeArray(health);
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────

  public snapshot(): OrchestratorTelemetrySnapshot {
    return Object.freeze({
      totalTicksObserved: this.totalTicksObserved,
      totalSignalsObserved: this.totalSignalsObserved,
      totalEventsObserved: this.totalEventsObserved,
      totalTraceRecordsObserved: this.totalTraceRecordsObserved,
      lastRunId: this.lastRunId,
      lastTick: this.lastTick,
      lastOutcome: this.lastOutcome,
      signalBreakdown: Object.freeze({
        info: this.severity.info,
        warn: this.severity.warn,
        error: this.severity.error,
      }),
      recentTicks: freezeArray(this.recentTicks),
      stepTimings: this.exportStepTimings(),
      recentWarnings: freezeArray(this.recentWarnings),
      lastEngineHealth: this.lastEngineHealth,
    });
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Total error signal count accumulated across all ticks. */
  public get errorCount(): number {
    return this.severity.error;
  }

  /** Total warn signal count. */
  public get warnCount(): number {
    return this.severity.warn;
  }

  /** Total info signal count. */
  public get infoCount(): number {
    return this.severity.info;
  }

  /** Overall error rate: error signals / total signals. */
  public get errorRate(): number {
    const total = this.severity.info + this.severity.warn + this.severity.error;
    return safeDiv(this.severity.error, total);
  }

  /** Current step coverage ratio: covered steps / 13 expected steps. */
  public get stepCoverageRatio(): number {
    return safeDiv(this.stepTimingMap.size, TELEMETRY_EXPECTED_STEP_COUNT);
  }

  /** Average tick duration in ms (from recent ticks). */
  public get avgTickDurationMs(): number {
    if (this.recentTicks.length === 0) return 0;
    const total = this.recentTicks.reduce((sum, t) => sum + t.durationMs, 0);
    return total / this.recentTicks.length;
  }

  /** Peak tick duration in ms from recent ticks. */
  public get maxTickDurationMs(): number {
    if (this.recentTicks.length === 0) return 0;
    return Math.max(...this.recentTicks.map((t) => t.durationMs));
  }

  /** Minimum tick duration in ms from recent ticks. */
  public get minTickDurationMs(): number | null {
    if (this.recentTicks.length === 0) return null;
    return Math.min(...this.recentTicks.map((t) => t.durationMs));
  }

  /** Count of recent ticks in the sliding window. */
  public get recentTickCount(): number {
    return this.recentTicks.length;
  }

  /** Count of recent warnings. */
  public get recentWarningCount(): number {
    return this.recentWarnings.length;
  }

  /** Returns the latest EngineHealth snapshot for a specific engine. */
  public getEngineHealth(engineId: HealthEngineId): EngineHealth | undefined {
    return this.lastEngineHealth.find((h) => h.engineId === engineId);
  }

  /** Returns the HealthStatus for a specific engine, or null if not found. */
  public getEngineHealthStatus(engineId: HealthEngineId): HealthStatus | null {
    return this.getEngineHealth(engineId)?.status ?? null;
  }

  /** Counts engines in each health status from the last recorded health array. */
  public countEnginesByStatus(): Readonly<Record<HealthStatus, number>> {
    const counts: Record<HealthStatus, number> = { HEALTHY: 0, DEGRADED: 0, FAILED: 0 };
    for (const entry of this.lastEngineHealth) {
      counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    }
    return Object.freeze(counts);
  }

  /** Computes a composite health score from the last engine health array. */
  public computeHealthCompositeScore(): number {
    if (this.lastEngineHealth.length === 0) return 1.0;
    const total = this.lastEngineHealth.reduce(
      (sum, entry) => sum + ENGINE_HEALTH_STATUS_SCORE[entry.status],
      0,
    );
    return clamp01(total / this.lastEngineHealth.length);
  }

  /** Returns true if any engine is in FAILED status. */
  public hasFailedEngine(): boolean {
    return this.lastEngineHealth.some((h) => h.status === 'FAILED');
  }

  /** Returns true if any engine is in DEGRADED or FAILED status. */
  public hasImpairedEngine(): boolean {
    return this.lastEngineHealth.some((h) => h.status !== 'HEALTHY');
  }

  /** Returns the highest-severity EngineHealth entry. */
  public getMostUrgentEngineHealth(): EngineHealth | null {
    if (this.lastEngineHealth.length === 0) return null;
    return [...this.lastEngineHealth].sort(
      (a, b) =>
        ENGINE_HEALTH_STATUS_URGENCY_WEIGHT[b.status] -
        ENGINE_HEALTH_STATUS_URGENCY_WEIGHT[a.status],
    )[0] ?? null;
  }

  /** Returns step timing for a specific TickStep, or null if not yet recorded. */
  public getStepTiming(step: TickStep): TelemetryStepTiming | null {
    const timing = this.stepTimingMap.get(step);
    if (!timing) return null;
    return Object.freeze({
      step,
      count: timing.count,
      totalDurationMs: timing.totalDurationMs,
      avgDurationMs: safeDiv(timing.totalDurationMs, timing.count),
      maxDurationMs: timing.maxDurationMs,
      minDurationMs: timing.minDurationMs,
    });
  }

  /** Returns the N slowest steps by avg duration. */
  public getSlowestSteps(topN = 3): readonly TelemetryStepTiming[] {
    const all = this.exportStepTimings();
    return freezeArray(
      [...all].sort((a, b) => b.avgDurationMs - a.avgDurationMs).slice(0, topN),
    );
  }

  /** Returns count of error trace records (steps that ended with ERROR status). */
  public getStepErrorCount(): number {
    return this.recentWarnings.filter((w) => w.startsWith('[')).length;
  }

  /** Returns step error rate: error steps / total trace records. */
  public getStepErrorRate(): number {
    return safeDiv(this.getStepErrorCount(), this.totalTraceRecordsObserved);
  }

  /** Returns the last N recent warnings (most recent last). */
  public getRecentWarnings(n = 10): readonly string[] {
    return freezeArray(this.recentWarnings.slice(-n));
  }

  /** Returns a filtered list of recent warnings matching a search prefix. */
  public filterWarnings(prefix: string): readonly string[] {
    return freezeArray(this.recentWarnings.filter((w) => w.includes(prefix)));
  }

  /** Returns the proportion of recent ticks that had zero warnings. */
  public getTickConsistencyScore(): number {
    if (this.recentTicks.length === 0) return 1.0;
    const warningFree = this.recentTicks.filter((t) => t.warningCount === 0).length;
    return clamp01(warningFree / this.recentTicks.length);
  }

  /** Returns the proportion of recent ticks that had a valid checksum. */
  public getChecksumValidScore(): number {
    if (this.recentTicks.length === 0) return 1.0;
    const valid = this.recentTicks.filter((t) => t.checksum !== null).length;
    return clamp01(valid / this.recentTicks.length);
  }

  /** Average emitted events per tick across recent ticks. */
  public getAvgEmittedEventsPerTick(): number {
    if (this.recentTicks.length === 0) return 0;
    const total = this.recentTicks.reduce((sum, t) => sum + t.emittedEventCount, 0);
    return total / this.recentTicks.length;
  }

  /** Average warnings per tick across recent ticks. */
  public getAvgWarningsPerTick(): number {
    if (this.recentTicks.length === 0) return 0;
    const total = this.recentTicks.reduce((sum, t) => sum + t.warningCount, 0);
    return total / this.recentTicks.length;
  }

  /** Returns the phase distribution across recent ticks as a frequency map. */
  public getPhaseDistribution(): Readonly<Record<string, number>> {
    const dist: Record<string, number> = {};
    for (const t of this.recentTicks) {
      dist[t.phase] = (dist[t.phase] ?? 0) + 1;
    }
    return Object.freeze(dist);
  }

  /** Returns the dominant phase (most frequently seen) across recent ticks. */
  public getDominantPhase(): RunStateSnapshot['phase'] | null {
    const dist = this.getPhaseDistribution();
    let best: string | null = null;
    let bestCount = 0;
    for (const [phase, count] of Object.entries(dist)) {
      if (count > bestCount) {
        best = phase;
        bestCount = count;
      }
    }
    return best as RunStateSnapshot['phase'] | null;
  }

  /** Phase stability score: proportion of recent ticks in the dominant phase. */
  public getPhaseStabilityScore(): number {
    if (this.recentTicks.length === 0) return 1.0;
    const dist = this.getPhaseDistribution();
    const maxCount = Math.max(...Object.values(dist));
    return clamp01(maxCount / this.recentTicks.length);
  }

  /** Computes step timing balance: std dev of avg durations across covered steps. */
  public getStepTimingBalance(): number {
    const timings = this.exportStepTimings();
    if (timings.length < 2) return 1.0;
    const avg = timings.reduce((s, t) => s + t.avgDurationMs, 0) / timings.length;
    const variance =
      timings.reduce((s, t) => s + Math.pow(t.avgDurationMs - avg, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);
    // Lower std dev = more balanced; normalize against budget
    return clamp01(1 - stdDev / TELEMETRY_TICK_BUDGET_MS);
  }

  /** Returns started-at timestamp. */
  public get sessionStartedAtMs(): number {
    return this.startedAtMs;
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  public clear(): void {
    this.totalTicksObserved = 0;
    this.totalSignalsObserved = 0;
    this.totalEventsObserved = 0;
    this.totalTraceRecordsObserved = 0;
    this.lastRunId = null;
    this.lastTick = null;
    this.lastOutcome = null;
    this.recentTicks.length = 0;
    this.stepTimingMap.clear();
    this.recentWarnings.length = 0;
    this.severity.info = 0;
    this.severity.warn = 0;
    this.severity.error = 0;
    this.lastEngineHealth = freezeArray([]);
    this.startedAtMs = nowMs();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private exportStepTimings(): readonly TelemetryStepTiming[] {
    const timings: TelemetryStepTiming[] = [];

    for (const [step, value] of this.stepTimingMap.entries()) {
      timings.push(
        Object.freeze({
          step,
          count: value.count,
          totalDurationMs: value.totalDurationMs,
          avgDurationMs: value.count > 0 ? value.totalDurationMs / value.count : 0,
          maxDurationMs: value.maxDurationMs,
          minDurationMs: value.minDurationMs,
        }),
      );
    }

    timings.sort((left, right) => left.step.localeCompare(right.step));
    return freezeArray(timings);
  }

  private countSeverities(
    signals: readonly EngineSignal[],
  ): TelemetrySeverityBreakdown {
    let info = 0;
    let warn = 0;
    let error = 0;

    for (const signal of signals) {
      if (signal.severity === 'INFO') {
        info += 1;
      } else if (signal.severity === 'WARN') {
        warn += 1;
      } else {
        error += 1;
      }
    }

    return Object.freeze({ info, warn, error });
  }

  private pushWarning(warning: string): void {
    this.recentWarnings.push(warning);
    while (this.recentWarnings.length > this.maxRecentWarnings) {
      this.recentWarnings.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — OrchestratorTelemetryMLExtractor — 32-dim ML vector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorTelemetryMLExtractor
 *
 * Extracts the 32-dimensional ML feature vector from an OrchestratorTelemetrySnapshot.
 * All features are clamped to [0, 1]. Pure: no state is mutated.
 *
 * The ML vector captures the full health picture of the telemetry layer
 * from the player's perspective: signal quality, tick pacing, engine health,
 * event density, warning patterns, run state, and step coverage.
 */
export class OrchestratorTelemetryMLExtractor {
  /**
   * Extract a 32-dim ML vector from a snapshot.
   */
  public extract(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetryMLVector {
    const ts = nowMsOverride ?? nowMs();
    const totalSignals = snap.signalBreakdown.info + snap.signalBreakdown.warn + snap.signalBreakdown.error;

    // Dimensions 0–3: density scores
    const tickDensityScore = clamp01(
      safeDiv(snap.totalTicksObserved, TELEMETRY_MAX_EXPECTED_TICKS),
    );
    const signalDensityScore = clamp01(
      safeDiv(
        safeDiv(snap.totalSignalsObserved, Math.max(1, snap.totalTicksObserved)),
        TELEMETRY_MAX_SIGNALS_PER_TICK,
      ),
    );
    const eventDensityScore = clamp01(
      safeDiv(
        safeDiv(snap.totalEventsObserved, Math.max(1, snap.totalTicksObserved)),
        TELEMETRY_MAX_EVENTS_PER_TICK,
      ),
    );
    const traceDensityScore = clamp01(
      safeDiv(
        safeDiv(snap.totalTraceRecordsObserved, Math.max(1, snap.totalTicksObserved)),
        TELEMETRY_MAX_TRACE_RECORDS_PER_TICK,
      ),
    );

    // Dimensions 4–7: signal ratios
    const infoSignalRatio = clamp01(safeDiv(snap.signalBreakdown.info, totalSignals));
    const warnSignalRatio = clamp01(safeDiv(snap.signalBreakdown.warn, totalSignals));
    const errorSignalRatio = clamp01(safeDiv(snap.signalBreakdown.error, totalSignals));
    const signalNoiseScore = clamp01(
      safeDiv(snap.signalBreakdown.warn + snap.signalBreakdown.error, Math.max(1, totalSignals)),
    );

    // Dimensions 8–10: tick timing
    const recentDurations = snap.recentTicks.map((t) => t.durationMs);
    const avgDurationMs =
      recentDurations.length > 0
        ? recentDurations.reduce((s, d) => s + d, 0) / recentDurations.length
        : 0;
    const maxDurationMs = recentDurations.length > 0 ? Math.max(...recentDurations) : 0;
    const minDurationMs = recentDurations.length > 0 ? Math.min(...recentDurations) : 0;
    const avgTickDurationNorm = clamp01(avgDurationMs / TELEMETRY_TICK_DURATION_CAP_MS);
    const maxTickDurationNorm = clamp01(maxDurationMs / TELEMETRY_TICK_DURATION_CAP_MS);
    const minTickDurationNorm = clamp01(minDurationMs / TELEMETRY_TICK_BUDGET_MS);

    // Dimension 11: warning density
    const warningDensityScore = clamp01(
      safeDiv(snap.recentWarnings.length, Math.max(1, snap.totalTicksObserved * 10)),
    );

    // Dimension 12: step coverage
    const stepCoverageRatio = clamp01(safeDiv(snap.stepTimings.length, TELEMETRY_EXPECTED_STEP_COUNT));

    // Dimensions 13–15: engine health
    const engineCount = snap.lastEngineHealth.length;
    const healthCounts = { HEALTHY: 0, DEGRADED: 0, FAILED: 0 };
    for (const h of snap.lastEngineHealth) {
      healthCounts[h.status] = (healthCounts[h.status] ?? 0) + 1;
    }
    const engineHealthyRatio = clamp01(safeDiv(healthCounts.HEALTHY, Math.max(1, engineCount)));
    const engineDegradedRatio = clamp01(safeDiv(healthCounts.DEGRADED, Math.max(1, engineCount)));
    const engineFailedFlag = healthCounts.FAILED > 0 ? 1.0 : 0.0;

    // Dimensions 16–18: run state
    // RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED'
    // null outcome means the run is still in progress (active).
    const hasActiveRun = snap.lastRunId !== null ? 1.0 : 0.0;
    const outcomeActiveScore = snap.lastOutcome === null ? 1.0 : 0.0; // null = still running
    const outcomeCompleteScore = snap.lastOutcome !== null ? 1.0 : 0.0;

    // Dimension 19: checksum validity
    const validChecksums = snap.recentTicks.filter((t) => t.checksum !== null).length;
    const checksumValidScore = clamp01(safeDiv(validChecksums, Math.max(1, snap.recentTicks.length)));

    // Dimension 20: emitted event density
    const avgEmittedEvents =
      snap.recentTicks.length > 0
        ? snap.recentTicks.reduce((s, t) => s + t.emittedEventCount, 0) / snap.recentTicks.length
        : 0;
    const emittedEventDensity = clamp01(avgEmittedEvents / TELEMETRY_MAX_EVENTS_PER_TICK);

    // Dimension 21: warnings per tick
    const avgWarnings =
      snap.recentTicks.length > 0
        ? snap.recentTicks.reduce((s, t) => s + t.warningCount, 0) / snap.recentTicks.length
        : 0;
    const warningsPerTick = clamp01(avgWarnings / 20); // normalize to 20 warnings/tick cap

    // Dimension 22: step error rate (from step timings with high duration)
    const overBudgetSteps = snap.stepTimings.filter((st) => {
      const budget = TELEMETRY_TICK_STEP_BUDGET_MS[st.step] ?? 20;
      return st.avgDurationMs > budget * 3;
    }).length;
    const stepErrorRate = clamp01(safeDiv(overBudgetSteps, Math.max(1, snap.stepTimings.length)));

    // Dimension 23: tick consistency (warning-free ticks proportion)
    const warningFreeTicks = snap.recentTicks.filter((t) => t.warningCount === 0).length;
    const tickConsistencyScore = clamp01(safeDiv(warningFreeTicks, Math.max(1, snap.recentTicks.length)));

    // Dimension 24: recent tick window ratio
    const recentTickWindowRatio = clamp01(
      safeDiv(snap.recentTicks.length, 128), // maxRecentTicks default
    );

    // Dimension 25: trace accumulation rate
    const expectedTraces =
      snap.totalTicksObserved * TELEMETRY_EXPECTED_STEP_COUNT;
    const traceAccumulationRate = clamp01(
      safeDiv(snap.totalTraceRecordsObserved, Math.max(1, expectedTraces)),
    );

    // Dimension 26: critical signal flag
    const criticalSignalFlag = errorSignalRatio > TELEMETRY_CRITICAL_ERROR_THRESHOLD ? 1.0 : 0.0;

    // Dimension 27: data freshness score
    const lastCapture =
      snap.recentTicks.length > 0
        ? snap.recentTicks[snap.recentTicks.length - 1]!.capturedAtMs
        : ts - TELEMETRY_SESSION_MAX_DURATION_MS;
    const ageSinceLastTickMs = ts - lastCapture;
    const dataFreshnessScore = clamp01(
      1 - ageSinceLastTickMs / TELEMETRY_SESSION_MAX_DURATION_MS,
    );

    // Dimension 28: health composite score
    const healthCompositeScore =
      engineCount === 0
        ? 1.0
        : clamp01(
            snap.lastEngineHealth.reduce(
              (s, h) => s + ENGINE_HEALTH_STATUS_SCORE[h.status],
              0,
            ) / engineCount,
          );

    // Dimension 29: phase stability
    const phaseDist: Record<string, number> = {};
    for (const t of snap.recentTicks) {
      phaseDist[t.phase] = (phaseDist[t.phase] ?? 0) + 1;
    }
    const maxPhaseCount = Math.max(0, ...Object.values(phaseDist));
    const phaseStabilityScore = clamp01(
      safeDiv(maxPhaseCount, Math.max(1, snap.recentTicks.length)),
    );

    // Dimension 30: warning escalation score
    const recentHalf = snap.recentTicks.slice(-Math.ceil(snap.recentTicks.length / 2));
    const earlyHalf = snap.recentTicks.slice(0, Math.floor(snap.recentTicks.length / 2));
    const recentWarnRate =
      recentHalf.length > 0
        ? recentHalf.reduce((s, t) => s + t.warningCount, 0) / recentHalf.length
        : 0;
    const earlyWarnRate =
      earlyHalf.length > 0
        ? earlyHalf.reduce((s, t) => s + t.warningCount, 0) / earlyHalf.length
        : 0;
    const warningEscalationScore =
      earlyWarnRate === 0
        ? recentWarnRate > 0 ? 1.0 : 0.0
        : clamp01(recentWarnRate / earlyWarnRate / 2); // normalized escalation ratio

    // Dimension 31: overall health score (composite of key dimensions)
    const overallHealthScore = clamp01(
      (healthCompositeScore * 0.35 +
        tickConsistencyScore * 0.20 +
        (1 - signalNoiseScore) * 0.15 +
        checksumValidScore * 0.15 +
        stepCoverageRatio * 0.10 +
        dataFreshnessScore * 0.05) /
      1.0,
    );

    return Object.freeze({
      tickDensityScore,
      signalDensityScore,
      eventDensityScore,
      traceDensityScore,
      infoSignalRatio,
      warnSignalRatio,
      errorSignalRatio,
      signalNoiseScore,
      avgTickDurationNorm,
      maxTickDurationNorm,
      minTickDurationNorm,
      warningDensityScore,
      stepCoverageRatio,
      engineHealthyRatio,
      engineDegradedRatio,
      engineFailedFlag,
      hasActiveRun,
      outcomeActiveScore,
      outcomeCompleteScore,
      checksumValidScore,
      emittedEventDensity,
      warningsPerTick,
      stepErrorRate,
      tickConsistencyScore,
      recentTickWindowRatio,
      traceAccumulationRate,
      criticalSignalFlag,
      dataFreshnessScore,
      healthCompositeScore,
      phaseStabilityScore,
      warningEscalationScore,
      overallHealthScore,
    } satisfies TelemetryMLVector);
  }

  /**
   * Extract ML vector as a flat numeric array (index-stable, 32 elements).
   */
  public extractArray(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): readonly number[] {
    const vec = this.extract(snap, nowMsOverride);
    return freezeArray([
      vec.tickDensityScore,
      vec.signalDensityScore,
      vec.eventDensityScore,
      vec.traceDensityScore,
      vec.infoSignalRatio,
      vec.warnSignalRatio,
      vec.errorSignalRatio,
      vec.signalNoiseScore,
      vec.avgTickDurationNorm,
      vec.maxTickDurationNorm,
      vec.minTickDurationNorm,
      vec.warningDensityScore,
      vec.stepCoverageRatio,
      vec.engineHealthyRatio,
      vec.engineDegradedRatio,
      vec.engineFailedFlag,
      vec.hasActiveRun,
      vec.outcomeActiveScore,
      vec.outcomeCompleteScore,
      vec.checksumValidScore,
      vec.emittedEventDensity,
      vec.warningsPerTick,
      vec.stepErrorRate,
      vec.tickConsistencyScore,
      vec.recentTickWindowRatio,
      vec.traceAccumulationRate,
      vec.criticalSignalFlag,
      vec.dataFreshnessScore,
      vec.healthCompositeScore,
      vec.phaseStabilityScore,
      vec.warningEscalationScore,
      vec.overallHealthScore,
    ]);
  }

  /**
   * Extract named map for human-readable access (label → value).
   */
  public extractNamedMap(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetryMLNamedMap {
    const arr = this.extractArray(snap, nowMsOverride);
    const map: Record<string, number> = {};
    for (let i = 0; i < TELEMETRY_ML_FEATURE_LABELS.length; i++) {
      map[TELEMETRY_ML_FEATURE_LABELS[i]!] = arr[i] ?? 0;
    }
    return Object.freeze(map);
  }

  /**
   * Classify severity from ML vector.
   */
  public classifySeverity(vec: TelemetryMLVector): TelemetrySeverity {
    if (
      vec.engineFailedFlag > 0 ||
      vec.criticalSignalFlag > 0 ||
      vec.overallHealthScore < 0.3
    ) {
      return 'CRITICAL';
    }
    if (
      vec.warningEscalationScore > 0.5 ||
      vec.signalNoiseScore > 0.3 ||
      vec.overallHealthScore < 0.6 ||
      vec.stepErrorRate > 0.2
    ) {
      return 'ADVISORY';
    }
    return 'NOMINAL';
  }

  /**
   * Returns the top N features by value (highest contribution).
   */
  public getTopFeatures(
    vec: TelemetryMLVector,
    topN = 5,
  ): ReadonlyArray<{ readonly label: string; readonly value: number }> {
    const arr = Object.entries(vec as unknown as Record<string, number>);
    arr.sort((a, b) => b[1] - a[1]);
    return freezeArray(
      arr.slice(0, topN).map(([label, value]) => Object.freeze({ label, value })),
    );
  }

  /**
   * Compute L2 similarity between two ML vectors (1 = identical, 0 = maximally different).
   */
  public computeSimilarity(a: TelemetryMLVector, b: TelemetryMLVector): number {
    const aArr = Object.values(a as unknown as Record<string, number>);
    const bArr = Object.values(b as unknown as Record<string, number>);
    let sumSq = 0;
    for (let i = 0; i < aArr.length; i++) {
      sumSq += Math.pow((aArr[i] ?? 0) - (bArr[i] ?? 0), 2);
    }
    const dist = Math.sqrt(sumSq / aArr.length);
    return clamp01(1 - dist);
  }

  /**
   * Validate that all 32 features are in [0, 1].
   */
  public validate(vec: TelemetryMLVector): { valid: boolean; invalidFeatures: readonly string[] } {
    const invalid: string[] = [];
    const entries = Object.entries(vec as unknown as Record<string, number>);
    for (const [key, value] of entries) {
      if (value < 0 || value > 1 || !isFinite(value)) {
        invalid.push(key);
      }
    }
    return { valid: invalid.length === 0, invalidFeatures: freezeArray(invalid) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — OrchestratorTelemetryDLBuilder — 8×4 DL tensor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorTelemetryDLBuilder
 *
 * Constructs the 8×4 DL tensor from a TelemetryMLVector.
 * Each row represents one observability perspective (signal health, tick timing,
 * engine health, event density, warning analysis, run state, step coverage, composites).
 * Each column is a normalized score dimension in [0, 1].
 *
 * The tensor is designed for ML model input and dashboard rendering.
 * All values are clamped to [0, 1]; no side effects.
 */
export class OrchestratorTelemetryDLBuilder {
  private readonly extractor: OrchestratorTelemetryMLExtractor;

  public constructor(extractor?: OrchestratorTelemetryMLExtractor) {
    this.extractor = extractor ?? new OrchestratorTelemetryMLExtractor();
  }

  /**
   * Build the 8×4 DL tensor from a snapshot.
   */
  public build(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetryDLTensor {
    const vec = this.extractor.extract(snap, nowMsOverride);
    return this.buildFromVector(vec);
  }

  /**
   * Build the 8×4 DL tensor directly from a TelemetryMLVector.
   */
  public buildFromVector(vec: TelemetryMLVector): TelemetryDLTensor {
    return Object.freeze([
      // Row 0 — Signal health: [info_ratio, warn_ratio, error_ratio, noise_score]
      Object.freeze([
        vec.infoSignalRatio,
        vec.warnSignalRatio,
        vec.errorSignalRatio,
        vec.signalNoiseScore,
      ]) as readonly [number, number, number, number],

      // Row 1 — Tick timing: [avg_norm, max_norm, min_norm, consistency]
      Object.freeze([
        vec.avgTickDurationNorm,
        vec.maxTickDurationNorm,
        vec.minTickDurationNorm,
        vec.tickConsistencyScore,
      ]) as readonly [number, number, number, number],

      // Row 2 — Engine health: [healthy_ratio, degraded_ratio, failed_flag, composite]
      Object.freeze([
        vec.engineHealthyRatio,
        vec.engineDegradedRatio,
        vec.engineFailedFlag,
        vec.healthCompositeScore,
      ]) as readonly [number, number, number, number],

      // Row 3 — Event/trace density: [events_density, traces_density, coverage, accumulation]
      Object.freeze([
        vec.eventDensityScore,
        vec.traceDensityScore,
        vec.stepCoverageRatio,
        vec.traceAccumulationRate,
      ]) as readonly [number, number, number, number],

      // Row 4 — Warning analysis: [density, escalation, critical_flag, recovery]
      Object.freeze([
        vec.warningDensityScore,
        vec.warningEscalationScore,
        vec.criticalSignalFlag,
        clamp01(1 - vec.warningEscalationScore), // recovery proxy
      ]) as readonly [number, number, number, number],

      // Row 5 — Run state: [active_run, outcome_active, checksum_valid, freshness]
      Object.freeze([
        vec.hasActiveRun,
        vec.outcomeActiveScore,
        vec.checksumValidScore,
        vec.dataFreshnessScore,
      ]) as readonly [number, number, number, number],

      // Row 6 — Step coverage: [covered_ratio, error_rate, timing_balance, phase_stable]
      Object.freeze([
        vec.stepCoverageRatio,
        vec.stepErrorRate,
        clamp01(1 - vec.stepErrorRate), // timing balance proxy
        vec.phaseStabilityScore,
      ]) as readonly [number, number, number, number],

      // Row 7 — Composite scores: [overall_health, signal_quality, ops_quality, ux_readiness]
      Object.freeze([
        vec.overallHealthScore,
        clamp01(vec.infoSignalRatio + (1 - vec.signalNoiseScore) / 2),
        clamp01(vec.tickConsistencyScore * 0.5 + vec.stepCoverageRatio * 0.5),
        clamp01(
          vec.healthCompositeScore * 0.4 +
          vec.checksumValidScore * 0.3 +
          vec.dataFreshnessScore * 0.3,
        ),
      ]) as readonly [number, number, number, number],
    ] as TelemetryDLTensor);
  }

  /**
   * Flatten the DL tensor into a 32-element array (row-major order).
   */
  public flatten(tensor: TelemetryDLTensor): readonly number[] {
    return freezeArray(tensor.flatMap((row) => [...row]));
  }

  /**
   * Extract a single column (0–3) across all 8 rows.
   */
  public extractColumn(tensor: TelemetryDLTensor, colIndex: 0 | 1 | 2 | 3): readonly number[] {
    return freezeArray(tensor.map((row) => row[colIndex]));
  }

  /**
   * Return the row index with the highest mean score (most active/alarming subsystem).
   */
  public getMostActiveRow(tensor: TelemetryDLTensor): number {
    let bestRow = 0;
    let bestMean = -Infinity;
    for (let i = 0; i < tensor.length; i++) {
      const row = tensor[i]!;
      const mean = (row[0] + row[1] + row[2] + row[3]) / 4;
      if (mean > bestMean) {
        bestMean = mean;
        bestRow = i;
      }
    }
    return bestRow;
  }

  /**
   * Returns the row label for a given row index.
   */
  public getRowLabel(rowIndex: number): string {
    const labels = [
      'signal_health',
      'tick_timing',
      'engine_health',
      'event_trace_density',
      'warning_analysis',
      'run_state',
      'step_coverage',
      'composite_scores',
    ];
    return labels[rowIndex] ?? `row_${rowIndex}`;
  }

  /**
   * Returns a human-readable summary of the DL tensor rows.
   */
  public summarize(tensor: TelemetryDLTensor): readonly string[] {
    return freezeArray(
      tensor.map((row, i) => {
        const mean = ((row[0] + row[1] + row[2] + row[3]) / 4).toFixed(3);
        return `${this.getRowLabel(i)}: mean=${mean} [${row.map((v) => v.toFixed(3)).join(', ')}]`;
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — OrchestratorTelemetryTrendAnalyzer — rolling trend analysis
// ─────────────────────────────────────────────────────────────────────────────

interface TelemetryTrendSample {
  readonly capturedAtMs: number;
  readonly errorRate: number;
  readonly avgTickDurationMs: number;
  readonly signalDensity: number;
  readonly warningDensity: number;
  readonly severity: TelemetrySeverity;
  readonly overallHealthScore: number;
}

/**
 * OrchestratorTelemetryTrendAnalyzer
 *
 * Maintains a rolling window of telemetry snapshots and computes trend analysis
 * (improving/stable/degrading), percentile metrics, and escalation detection.
 *
 * Consumed by the TelemetryExportBundle and chat adapter to surface
 * trend-level signals that single-snapshot ML vectors cannot capture.
 */
export class OrchestratorTelemetryTrendAnalyzer {
  private readonly samples: TelemetryTrendSample[] = [];

  private readonly maxSamples: number;

  private readonly extractor: OrchestratorTelemetryMLExtractor;

  public constructor(opts: { maxSamples?: number } = {}) {
    this.maxSamples = Math.max(10, opts.maxSamples ?? 60);
    this.extractor = new OrchestratorTelemetryMLExtractor();
  }

  /**
   * Record a new snapshot sample into the trend window.
   */
  public record(snap: OrchestratorTelemetrySnapshot, nowMsOverride?: number): void {
    const ts = nowMsOverride ?? nowMs();
    const vec = this.extractor.extract(snap, ts);
    const severity = this.extractor.classifySeverity(vec);
    const totalSignals = snap.signalBreakdown.info + snap.signalBreakdown.warn + snap.signalBreakdown.error;
    const recentDurations = snap.recentTicks.map((t) => t.durationMs);
    const avgDuration =
      recentDurations.length > 0
        ? recentDurations.reduce((s, d) => s + d, 0) / recentDurations.length
        : 0;
    const sample: TelemetryTrendSample = {
      capturedAtMs: ts,
      errorRate: safeDiv(snap.signalBreakdown.error, totalSignals),
      avgTickDurationMs: avgDuration,
      signalDensity: safeDiv(snap.totalSignalsObserved, Math.max(1, snap.totalTicksObserved)),
      warningDensity: safeDiv(snap.recentWarnings.length, Math.max(1, snap.totalTicksObserved * 10)),
      severity,
      overallHealthScore: vec.overallHealthScore,
    };
    this.samples.push(sample);
    while (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /**
   * Compute the current trend snapshot. Returns null if too few samples.
   */
  public getTrend(): TelemetryTrendSnapshot | null {
    if (this.samples.length < TELEMETRY_TREND_MIN_SAMPLES) return null;
    const n = this.samples.length;

    const errorRates = this.samples.map((s) => s.errorRate);
    const avgErrorRate = errorRates.reduce((a, b) => a + b, 0) / n;
    const maxErrorRate = Math.max(...errorRates);

    const durations = this.samples.map((s) => s.avgTickDurationMs);
    const avgTickDurationMs = durations.reduce((a, b) => a + b, 0) / n;
    const sorted = [...durations].sort((a, b) => a - b);
    const p95TickDurationMs = sorted[Math.floor(n * 0.95)] ?? sorted[n - 1] ?? 0;

    const signalDensities = this.samples.map((s) => s.signalDensity);
    const avgSignalDensity = signalDensities.reduce((a, b) => a + b, 0) / n;

    const warnDensities = this.samples.map((s) => s.warningDensity);
    const avgWarningDensity = warnDensities.reduce((a, b) => a + b, 0) / n;

    const nominalSamples = this.samples.filter((s) => s.severity === 'NOMINAL').length;
    const advisorySamples = this.samples.filter((s) => s.severity === 'ADVISORY').length;
    const criticalSamples = this.samples.filter((s) => s.severity === 'CRITICAL').length;

    // Trend direction: compare recent half vs early half of health score
    const mid = Math.floor(n / 2);
    const earlyHealth =
      this.samples.slice(0, mid).reduce((s, x) => s + x.overallHealthScore, 0) / Math.max(1, mid);
    const recentHealth =
      this.samples.slice(mid).reduce((s, x) => s + x.overallHealthScore, 0) /
      Math.max(1, n - mid);
    let trendDirection: TelemetryTrendSnapshot['trendDirection'];
    if (recentHealth > earlyHealth + 0.05) {
      trendDirection = 'IMPROVING';
    } else if (recentHealth < earlyHealth - 0.05) {
      trendDirection = 'DEGRADING';
    } else {
      trendDirection = 'STABLE';
    }

    const warnRates = this.samples.map((s) => s.warningDensity);
    const peakWarnRate = Math.max(...warnRates);
    const peakErrorRate = maxErrorRate;

    return Object.freeze({
      capturedAtMs: this.samples[n - 1]!.capturedAtMs,
      sampleCount: n,
      avgErrorRate,
      maxErrorRate,
      avgTickDurationMs,
      p95TickDurationMs,
      avgSignalDensity,
      avgWarningDensity,
      trendDirection,
      nominalSamples,
      advisorySamples,
      criticalSamples,
      peakWarnRate,
      peakErrorRate,
    });
  }

  /** Returns how many samples are currently in the window. */
  public get sampleCount(): number {
    return this.samples.length;
  }

  /** Returns the most recent severity seen. */
  public getLatestSeverity(): TelemetrySeverity | null {
    return this.samples[this.samples.length - 1]?.severity ?? null;
  }

  /**
   * Returns true if the last N samples have all been CRITICAL.
   */
  public isConsistentlyCritical(windowSize = 3): boolean {
    const recent = this.samples.slice(-windowSize);
    return recent.length >= windowSize && recent.every((s) => s.severity === 'CRITICAL');
  }

  /**
   * Returns a recovery forecast score [0, 1].
   * 0 = no recovery expected; 1 = full recovery likely.
   */
  public computeRecoveryForecast(): number {
    if (this.samples.length < TELEMETRY_TREND_MIN_SAMPLES) return 1.0;
    const trend = this.getTrend();
    if (!trend) return 1.0;
    if (trend.trendDirection === 'IMPROVING') return 0.9;
    if (trend.trendDirection === 'STABLE') {
      return clamp01(0.5 + (1 - trend.avgErrorRate) * 0.3);
    }
    return clamp01((1 - trend.avgErrorRate) * 0.4);
  }

  /**
   * Reset trend window.
   */
  public clear(): void {
    this.samples.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — OrchestratorTelemetrySessionTracker — session-level aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorTelemetrySessionTracker
 *
 * Tracks session-level telemetry across multiple snapshots.
 * Computes cumulative metrics (ticks, signals, events, trace records),
 * peak values, error rates, and severity distribution.
 *
 * Used by the AnalyticsBundle and chat adapter to surface session health
 * that persists across individual tick-level snapshots.
 */
export class OrchestratorTelemetrySessionTracker {
  private readonly sessionId: string;

  private readonly startedAtMs: number;

  private sampleCount = 0;

  private totalTicksObserved = 0;

  private totalSignalsObserved = 0;

  private totalEventsObserved = 0;

  private totalTraceRecordsObserved = 0;

  private cumulativeErrorCount = 0;

  private cumulativeTotalSignals = 0;

  private peakErrorRate = 0;

  private totalTickDurationMs = 0;

  private peakTickDurationMs = 0;

  private nominalSamples = 0;

  private advisorySamples = 0;

  private criticalSamples = 0;

  private engineFailureEvents = 0;

  private readonly runsSeen = new Set<string>();

  private uniqueStepsCovered = 0;

  private readonly extractor: OrchestratorTelemetryMLExtractor;

  public constructor(sessionId: string, startedAtMs?: number) {
    this.sessionId = sessionId;
    this.startedAtMs = startedAtMs ?? nowMs();
    this.extractor = new OrchestratorTelemetryMLExtractor();
  }

  /**
   * Record a snapshot into the session tracker.
   */
  public record(snap: OrchestratorTelemetrySnapshot, nowMsOverride?: number): void {
    const ts = nowMsOverride ?? nowMs();
    this.sampleCount += 1;
    this.totalTicksObserved = Math.max(this.totalTicksObserved, snap.totalTicksObserved);
    this.totalSignalsObserved = Math.max(this.totalSignalsObserved, snap.totalSignalsObserved);
    this.totalEventsObserved = Math.max(this.totalEventsObserved, snap.totalEventsObserved);
    this.totalTraceRecordsObserved = Math.max(
      this.totalTraceRecordsObserved,
      snap.totalTraceRecordsObserved,
    );

    const totalSignals = snap.signalBreakdown.info + snap.signalBreakdown.warn + snap.signalBreakdown.error;
    this.cumulativeTotalSignals += totalSignals;
    this.cumulativeErrorCount += snap.signalBreakdown.error;

    const errorRate = safeDiv(snap.signalBreakdown.error, totalSignals);
    this.peakErrorRate = Math.max(this.peakErrorRate, errorRate);

    const recentDurations = snap.recentTicks.map((t) => t.durationMs);
    const avgDuration =
      recentDurations.length > 0
        ? recentDurations.reduce((s, d) => s + d, 0) / recentDurations.length
        : 0;
    this.totalTickDurationMs += avgDuration;

    const maxDuration = recentDurations.length > 0 ? Math.max(...recentDurations) : 0;
    this.peakTickDurationMs = Math.max(this.peakTickDurationMs, maxDuration);

    const vec = this.extractor.extract(snap, ts);
    const severity = this.extractor.classifySeverity(vec);
    if (severity === 'NOMINAL') this.nominalSamples += 1;
    else if (severity === 'ADVISORY') this.advisorySamples += 1;
    else this.criticalSamples += 1;

    if (snap.lastRunId) this.runsSeen.add(snap.lastRunId);
    if (snap.lastEngineHealth.some((h) => h.status === 'FAILED')) {
      this.engineFailureEvents += 1;
    }

    this.uniqueStepsCovered = Math.max(this.uniqueStepsCovered, snap.stepTimings.length);
  }

  /**
   * Generate the session report.
   */
  public getReport(capturedAtMsOverride?: number): TelemetrySessionReport {
    const ts = capturedAtMsOverride ?? nowMs();
    const avgErrorRate = safeDiv(this.cumulativeErrorCount, this.cumulativeTotalSignals);
    const avgTickDurationMs = safeDiv(this.totalTickDurationMs, this.sampleCount);
    const totalSamples = this.nominalSamples + this.advisorySamples + this.criticalSamples;
    const nominalFraction = clamp01(safeDiv(this.nominalSamples, totalSamples));
    const advisoryFraction = clamp01(safeDiv(this.advisorySamples, totalSamples));
    const criticalFraction = clamp01(safeDiv(this.criticalSamples, totalSamples));

    return Object.freeze({
      sessionId: this.sessionId,
      startedAtMs: this.startedAtMs,
      capturedAtMs: ts,
      sampleCount: this.sampleCount,
      totalTicksObserved: this.totalTicksObserved,
      totalSignalsObserved: this.totalSignalsObserved,
      totalEventsObserved: this.totalEventsObserved,
      totalTraceRecordsObserved: this.totalTraceRecordsObserved,
      avgErrorRate,
      peakErrorRate: this.peakErrorRate,
      avgTickDurationMs,
      peakTickDurationMs: this.peakTickDurationMs,
      nominalFraction,
      advisoryFraction,
      criticalFraction,
      runsSeen: freezeArray([...this.runsSeen]),
      engineFailureEvents: this.engineFailureEvents,
      uniqueStepsCovered: this.uniqueStepsCovered,
    });
  }

  public get id(): string {
    return this.sessionId;
  }

  public get samples(): number {
    return this.sampleCount;
  }

  public clear(): void {
    this.sampleCount = 0;
    this.totalTicksObserved = 0;
    this.totalSignalsObserved = 0;
    this.totalEventsObserved = 0;
    this.totalTraceRecordsObserved = 0;
    this.cumulativeErrorCount = 0;
    this.cumulativeTotalSignals = 0;
    this.peakErrorRate = 0;
    this.totalTickDurationMs = 0;
    this.peakTickDurationMs = 0;
    this.nominalSamples = 0;
    this.advisorySamples = 0;
    this.criticalSamples = 0;
    this.engineFailureEvents = 0;
    this.runsSeen.clear();
    this.uniqueStepsCovered = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — OrchestratorTelemetryEventLog — typed EventEnvelope log surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorTelemetryEventLog
 *
 * Typed, bounded log for EventEnvelope entries emitted during tick execution.
 * Uses EngineEventMap as the key constraint — all event keys must belong to
 * the runtime event map, preserving full type safety.
 *
 * Provides queryable access by runId, tick, step, and key.
 * The log is FIFO-bounded to TELEMETRY_EVENT_LOG_MAX_ENTRIES entries.
 */
export class OrchestratorTelemetryEventLog {
  private readonly entries: Array<TelemetryEventLogEntry<keyof RuntimeEventMap>> = [];

  private readonly maxEntries: number;

  private idCounter = 0;

  public constructor(maxEntries?: number) {
    this.maxEntries = maxEntries ?? TELEMETRY_EVENT_LOG_MAX_ENTRIES;
  }

  /**
   * Append an EventEnvelope to the log.
   * Types are constrained to keys of EngineEventMap (via RuntimeEventMap).
   */
  public append<K extends keyof RuntimeEventMap>(
    envelope: EventEnvelope<K, RuntimeEventMap[K]>,
    opts: {
      readonly runId?: string | null;
      readonly tick?: number | null;
      readonly sourceStep?: TickStep | null;
    } = {},
  ): TelemetryEventLogEntry<K> {
    this.idCounter += 1;
    const entry: TelemetryEventLogEntry<K> = Object.freeze({
      id: `evt-${this.idCounter}`,
      recordedAtMs: nowMs(),
      runId: opts.runId ?? null,
      tick: opts.tick ?? null,
      envelope,
      eventKey: envelope.event as K,
      sourceStep: opts.sourceStep ?? null,
    });
    this.entries.push(entry as TelemetryEventLogEntry<keyof RuntimeEventMap>);
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    return entry;
  }

  /**
   * Append multiple EventEnvelopes for a given tick/step batch.
   */
  public appendBatch<K extends keyof RuntimeEventMap>(
    envelopes: ReadonlyArray<EventEnvelope<K, RuntimeEventMap[K]>>,
    opts: {
      readonly runId?: string | null;
      readonly tick?: number | null;
      readonly sourceStep?: TickStep | null;
    } = {},
  ): void {
    for (const envelope of envelopes) {
      this.append(envelope, opts);
    }
  }

  /**
   * Returns all entries for a specific runId.
   */
  public getByRunId(runId: string): readonly TelemetryEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.runId === runId));
  }

  /**
   * Returns all entries for a specific tick.
   */
  public getByTick(tick: number): readonly TelemetryEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.tick === tick));
  }

  /**
   * Returns all entries for a specific TickStep.
   */
  public getByStep(step: TickStep): readonly TelemetryEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.sourceStep === step));
  }

  /**
   * Returns all entries for a specific event key.
   */
  public getByKey(key: keyof RuntimeEventMap): readonly TelemetryEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.eventKey === key));
  }

  /**
   * Returns the N most recent entries.
   */
  public getRecent(n = 20): readonly TelemetryEventLogEntry[] {
    return freezeArray(this.entries.slice(-n));
  }

  /**
   * Returns a summary: unique keys seen, total entries, recent entry count.
   */
  public summarize(): Readonly<{
    totalEntries: number;
    uniqueKeys: number;
    uniqueRuns: number;
    uniqueSteps: number;
    keyDistribution: Readonly<Record<string, number>>;
  }> {
    const keyDist: Record<string, number> = {};
    const runsSeen = new Set<string>();
    const stepsSeen = new Set<string>();
    for (const e of this.entries) {
      const k = String(e.eventKey);
      keyDist[k] = (keyDist[k] ?? 0) + 1;
      if (e.runId) runsSeen.add(e.runId);
      if (e.sourceStep) stepsSeen.add(e.sourceStep);
    }
    return Object.freeze({
      totalEntries: this.entries.length,
      uniqueKeys: Object.keys(keyDist).length,
      uniqueRuns: runsSeen.size,
      uniqueSteps: stepsSeen.size,
      keyDistribution: Object.freeze(keyDist),
    });
  }

  /**
   * Clears all log entries.
   */
  public clear(): void {
    this.entries.length = 0;
    this.idCounter = 0;
  }

  public get size(): number {
    return this.entries.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — OrchestratorTelemetryAnnotator — annotation from snapshot data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorTelemetryAnnotator
 *
 * Generates human-readable, UX-relevant annotations from a telemetry snapshot
 * and its ML vector. Annotations surface the most player-impactful signals
 * without exposing raw numeric telemetry.
 *
 * Output is consumed by dashboard renderers, chat signal metadata,
 * and after-action reports.
 */
export class OrchestratorTelemetryAnnotator {
  private readonly extractor: OrchestratorTelemetryMLExtractor;

  public constructor(extractor?: OrchestratorTelemetryMLExtractor) {
    this.extractor = extractor ?? new OrchestratorTelemetryMLExtractor();
  }

  /**
   * Build a full annotation bundle from a snapshot.
   */
  public annotate(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetryAnnotationBundle {
    const ts = nowMsOverride ?? nowMs();
    const vec = this.extractor.extract(snap, ts);
    const annotations: TelemetryAnnotation[] = [];

    // Engine health annotations
    if (vec.engineFailedFlag > 0) {
      annotations.push(this.makeAnnotation(
        'engine_failed',
        'Engine Failure',
        `${snap.lastEngineHealth.filter((h) => h.status === 'FAILED').length} engine(s) failed`,
        'CRITICAL',
        true,
        15,
      ));
    } else if (vec.engineDegradedRatio > 0) {
      annotations.push(this.makeAnnotation(
        'engine_degraded',
        'Engine Degraded',
        `${snap.lastEngineHealth.filter((h) => h.status === 'DEGRADED').length} engine(s) degraded`,
        'ADVISORY',
        true,
        14,
      ));
    } else if (snap.lastEngineHealth.length > 0) {
      annotations.push(this.makeAnnotation(
        'engine_healthy',
        'All Engines Healthy',
        `${snap.lastEngineHealth.length} engines operating nominally`,
        'NOMINAL',
        false,
        13,
      ));
    }

    // Error signal annotation
    if (vec.criticalSignalFlag > 0) {
      annotations.push(this.makeAnnotation(
        'critical_errors',
        'Critical Error Signals',
        `Error rate ${(vec.errorSignalRatio * 100).toFixed(1)}% exceeds threshold`,
        'CRITICAL',
        true,
        6,
      ));
    } else if (vec.signalNoiseScore > 0.3) {
      annotations.push(this.makeAnnotation(
        'signal_noise',
        'Elevated Signal Noise',
        `${(vec.signalNoiseScore * 100).toFixed(1)}% of signals are warnings/errors`,
        'ADVISORY',
        true,
        7,
      ));
    }

    // Tick timing annotation
    if (vec.avgTickDurationNorm > 0.7) {
      const avgMs = (vec.avgTickDurationNorm * TELEMETRY_TICK_DURATION_CAP_MS).toFixed(0);
      annotations.push(this.makeAnnotation(
        'slow_ticks',
        'Slow Tick Execution',
        `Average tick duration ${avgMs}ms exceeds budget`,
        'ADVISORY',
        true,
        8,
      ));
    }

    // Warning density annotation
    if (vec.warningDensityScore > TELEMETRY_WARNING_ESCALATION_THRESHOLD) {
      annotations.push(this.makeAnnotation(
        'high_warning_density',
        'High Warning Density',
        `Warning density elevated: ${(vec.warningDensityScore * 100).toFixed(1)}%`,
        'ADVISORY',
        true,
        11,
      ));
    }

    // Warning escalation annotation
    if (vec.warningEscalationScore > 0.5) {
      annotations.push(this.makeAnnotation(
        'warning_escalation',
        'Warning Rate Escalating',
        `Recent tick warning rate is trending upward`,
        'ADVISORY',
        true,
        30,
      ));
    }

    // Step coverage annotation
    if (vec.stepCoverageRatio < 0.6) {
      annotations.push(this.makeAnnotation(
        'incomplete_step_coverage',
        'Incomplete Step Coverage',
        `Only ${(vec.stepCoverageRatio * 100).toFixed(0)}% of steps have timing data`,
        'ADVISORY',
        false,
        12,
      ));
    }

    // Checksum validity annotation
    if (vec.checksumValidScore < 0.8) {
      annotations.push(this.makeAnnotation(
        'checksum_failures',
        'Checksum Gaps Detected',
        `${((1 - vec.checksumValidScore) * 100).toFixed(1)}% of recent ticks missing checksum`,
        'ADVISORY',
        true,
        19,
      ));
    }

    // Data freshness annotation
    if (vec.dataFreshnessScore < 0.3) {
      annotations.push(this.makeAnnotation(
        'stale_data',
        'Stale Telemetry Data',
        `Telemetry data may be stale — no recent ticks observed`,
        'ADVISORY',
        true,
        27,
      ));
    }

    // Overall health annotation
    if (vec.overallHealthScore > 0.85) {
      annotations.push(this.makeAnnotation(
        'system_nominal',
        'System Nominal',
        `Overall health score: ${(vec.overallHealthScore * 100).toFixed(0)}%`,
        'NOMINAL',
        false,
        31,
      ));
    }

    const criticalCount = annotations.filter((a) => a.severity === 'CRITICAL').length;
    const advisoryCount = annotations.filter((a) => a.severity === 'ADVISORY').length;
    const nominalCount = annotations.filter((a) => a.severity === 'NOMINAL').length;

    const sorted = [...annotations].sort((a, b) => {
      const order: Record<TelemetrySeverity, number> = { CRITICAL: 0, ADVISORY: 1, NOMINAL: 2 };
      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    });
    const topAnnotation = sorted[0] ?? null;

    return Object.freeze({
      capturedAtMs: ts,
      annotations: freezeArray(sorted),
      criticalCount,
      advisoryCount,
      nominalCount,
      topAnnotation,
    });
  }

  private makeAnnotation(
    key: string,
    label: string,
    value: string,
    severity: TelemetrySeverity,
    uxRelevant: boolean,
    featureIndex: number,
  ): TelemetryAnnotation {
    return Object.freeze({ key, label, value, severity, uxRelevant, featureIndex });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — OrchestratorTelemetryInspector — high-level inspection facade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorTelemetryInspector
 *
 * High-level inspection facade that combines all telemetry analytics surfaces
 * into a single entry point. Integrates ML extraction, DL tensor, trend analysis,
 * session tracking, annotation, run summary generation, and chat signal building.
 *
 * This is the primary entry point for external consumers (ZeroEngine, TickExecutor,
 * OrchestratorDiagnostics) that need the full telemetry picture in one call.
 */
export class OrchestratorTelemetryInspector {
  private readonly mlExtractor: OrchestratorTelemetryMLExtractor;

  private readonly dlBuilder: OrchestratorTelemetryDLBuilder;

  private readonly annotator: OrchestratorTelemetryAnnotator;

  public constructor() {
    this.mlExtractor = new OrchestratorTelemetryMLExtractor();
    this.dlBuilder = new OrchestratorTelemetryDLBuilder(this.mlExtractor);
    this.annotator = new OrchestratorTelemetryAnnotator(this.mlExtractor);
  }

  /**
   * Extract the 32-dim ML vector from a snapshot.
   */
  public extractMLVector(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetryMLVector {
    return this.mlExtractor.extract(snap, nowMsOverride);
  }

  /**
   * Extract ML vector as a flat numeric array.
   */
  public extractMLVectorArray(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): readonly number[] {
    return this.mlExtractor.extractArray(snap, nowMsOverride);
  }

  /**
   * Build the 8×4 DL tensor.
   */
  public buildDLTensor(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetryDLTensor {
    return this.dlBuilder.build(snap, nowMsOverride);
  }

  /**
   * Build the annotation bundle.
   */
  public buildAnnotations(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetryAnnotationBundle {
    return this.annotator.annotate(snap, nowMsOverride);
  }

  /**
   * Classify severity from a snapshot.
   */
  public classifySeverity(
    snap: OrchestratorTelemetrySnapshot,
    nowMsOverride?: number,
  ): TelemetrySeverity {
    const vec = this.mlExtractor.extract(snap, nowMsOverride);
    return this.mlExtractor.classifySeverity(vec);
  }

  /**
   * Build a TelemetryRunSummary from a telemetry instance.
   * Call this at the end of a run to capture the final state.
   */
  public buildRunSummary(
    telemetry: OrchestratorTelemetry,
    finalizedAtMs?: number,
  ): TelemetryRunSummary {
    const snap = telemetry.snapshot();
    const ts = finalizedAtMs ?? nowMs();
    const vec = this.mlExtractor.extract(snap, ts);
    const tensor = this.dlBuilder.buildFromVector(vec);

    const recentDurations = snap.recentTicks.map((t) => t.durationMs);
    const avgDuration =
      recentDurations.length > 0
        ? recentDurations.reduce((s, d) => s + d, 0) / recentDurations.length
        : 0;
    const maxDuration = recentDurations.length > 0 ? Math.max(...recentDurations) : 0;

    return Object.freeze({
      runId: snap.lastRunId,
      startedAtMs: telemetry.sessionStartedAtMs,
      finalizedAtMs: ts,
      totalTicks: snap.totalTicksObserved,
      totalSignals: snap.totalSignalsObserved,
      totalEvents: snap.totalEventsObserved,
      totalTraceRecords: snap.totalTraceRecordsObserved,
      finalOutcome: snap.lastOutcome,
      avgTickDurationMs: avgDuration,
      peakTickDurationMs: maxDuration,
      errorSignalCount: snap.signalBreakdown.error,
      warnSignalCount: snap.signalBreakdown.warn,
      infoSignalCount: snap.signalBreakdown.info,
      warningsLogged: snap.recentWarnings.length,
      stepsWithTimings: snap.stepTimings.length,
      engineHealthSnapshot: snap.lastEngineHealth,
      finalMLVector: vec,
      finalDLTensor: tensor,
    });
  }

  /**
   * Build the TelemetryChatSignal for adapter consumption.
   */
  public buildChatSignal(
    snap: OrchestratorTelemetrySnapshot,
    trendOverride?: TelemetryTrendSnapshot | null,
    nowMsOverride?: number,
  ): TelemetryChatSignal {
    const ts = nowMsOverride ?? nowMs();
    const vec = this.mlExtractor.extract(snap, ts);
    const severity = this.mlExtractor.classifySeverity(vec);

    const engineCount = snap.lastEngineHealth.length;
    const failedCount = snap.lastEngineHealth.filter((h) => h.status === 'FAILED').length;

    const recentDurations = snap.recentTicks.map((t) => t.durationMs);
    const avgDurationMs =
      recentDurations.length > 0
        ? recentDurations.reduce((s, d) => s + d, 0) / recentDurations.length
        : 0;

    return Object.freeze({
      generatedAtMs: ts,
      severity,
      activeRunId: snap.lastRunId,
      tick: snap.lastTick,
      totalTicksObserved: snap.totalTicksObserved,
      totalSignalsObserved: snap.totalSignalsObserved,
      totalEventsObserved: snap.totalEventsObserved,
      errorSignalRatio: vec.errorSignalRatio,
      avgTickDurationMs: avgDurationMs,
      warningCount: snap.recentWarnings.length,
      engineHealthyRatio: clamp01(safeDiv(
        snap.lastEngineHealth.filter((h) => h.status === 'HEALTHY').length,
        Math.max(1, engineCount),
      )),
      engineFailedCount: failedCount,
      stepCoverageRatio: vec.stepCoverageRatio,
      overallHealthScore: vec.overallHealthScore,
      trendDirection: trendOverride?.trendDirection ?? null,
    });
  }

  /**
   * Build the full TelemetryExportBundle.
   */
  public buildExportBundle(
    snap: OrchestratorTelemetrySnapshot,
    opts: {
      readonly trend?: TelemetryTrendSnapshot | null;
      readonly sessionReport?: TelemetrySessionReport | null;
      readonly runSummary?: TelemetryRunSummary | null;
      readonly nowMs?: number;
    } = {},
  ): TelemetryExportBundle {
    const ts = opts.nowMs ?? nowMs();
    const vec = this.mlExtractor.extract(snap, ts);
    const tensor = this.dlBuilder.buildFromVector(vec);
    const severity = this.mlExtractor.classifySeverity(vec);
    const annotations = this.annotator.annotate(snap, ts);

    return Object.freeze({
      capturedAtMs: ts,
      snapshot: snap,
      mlVector: vec,
      mlVectorArray: this.mlExtractor.extractArray(snap, ts),
      dlTensor: tensor,
      severity,
      trend: opts.trend ?? null,
      sessionReport: opts.sessionReport ?? null,
      annotations,
      runSummary: opts.runSummary ?? null,
    });
  }

  /**
   * Validate the ML vector extracted from a snapshot.
   */
  public validateMLVector(snap: OrchestratorTelemetrySnapshot): {
    valid: boolean;
    invalidFeatures: readonly string[];
  } {
    const vec = this.mlExtractor.extract(snap);
    return this.mlExtractor.validate(vec);
  }

  /**
   * Compute similarity between two snapshots' ML vectors.
   */
  public computeSnapshotSimilarity(
    snapA: OrchestratorTelemetrySnapshot,
    snapB: OrchestratorTelemetrySnapshot,
  ): number {
    const a = this.mlExtractor.extract(snapA);
    const b = this.mlExtractor.extract(snapB);
    return this.mlExtractor.computeSimilarity(a, b);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — FACTORY: createOrchestratorTelemetryWithAnalytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full analytics bundle returned by createOrchestratorTelemetryWithAnalytics.
 */
export interface OrchestratorTelemetryAnalyticsBundle {
  readonly telemetry: OrchestratorTelemetry;
  readonly mlExtractor: OrchestratorTelemetryMLExtractor;
  readonly dlBuilder: OrchestratorTelemetryDLBuilder;
  readonly trendAnalyzer: OrchestratorTelemetryTrendAnalyzer;
  readonly sessionTracker: OrchestratorTelemetrySessionTracker;
  readonly eventLog: OrchestratorTelemetryEventLog;
  readonly annotator: OrchestratorTelemetryAnnotator;
  readonly inspector: OrchestratorTelemetryInspector;
  readonly sessionId: string;

  /** Take a snapshot, feed trend/session, and return the export bundle. */
  captureAndRecord(nowMsOverride?: number): TelemetryExportBundle;

  /** Take a snapshot and produce a chat signal immediately. */
  captureAndSignal(nowMsOverride?: number): TelemetryChatSignal;

  /** Extract ML vector from current state. */
  extractMLVector(nowMsOverride?: number): TelemetryMLVector;

  /** Build DL tensor from current state. */
  buildDLTensor(nowMsOverride?: number): TelemetryDLTensor;

  /** Get current trend. */
  getTrend(): TelemetryTrendSnapshot | null;

  /** Get current session report. */
  getSessionReport(nowMsOverride?: number): TelemetrySessionReport;

  /** Build run summary. */
  buildRunSummary(finalizedAtMs?: number): TelemetryRunSummary;
}

/**
 * createOrchestratorTelemetryWithAnalytics
 *
 * Factory that wires all telemetry analytics subsystems together.
 * Returns a single analytics bundle with coordinated ML/DL/trend/session surfaces.
 *
 * This is the preferred entry point for ZeroEngine and TickExecutor.
 *
 * Usage:
 *   const bundle = createOrchestratorTelemetryWithAnalytics();
 *   bundle.telemetry.recordTick({ snapshot, tickDurationMs, capturedAtMs });
 *   const exportBundle = bundle.captureAndRecord();
 *   const mlVec = bundle.extractMLVector();
 *   const tensor = bundle.buildDLTensor();
 *   const signal = bundle.captureAndSignal();
 */
export function createOrchestratorTelemetryWithAnalytics(opts: {
  readonly sessionId?: string;
  readonly maxRecentTicks?: number;
  readonly maxRecentWarnings?: number;
  readonly trendMaxSamples?: number;
  readonly eventLogMaxEntries?: number;
} = {}): OrchestratorTelemetryAnalyticsBundle {
  const sessionId = opts.sessionId ?? `telemetry-session-${nowMs()}`;
  const telemetry = new OrchestratorTelemetry({
    maxRecentTicks: opts.maxRecentTicks,
    maxRecentWarnings: opts.maxRecentWarnings,
  });
  const mlExtractor = new OrchestratorTelemetryMLExtractor();
  const dlBuilder = new OrchestratorTelemetryDLBuilder(mlExtractor);
  const trendAnalyzer = new OrchestratorTelemetryTrendAnalyzer({
    maxSamples: opts.trendMaxSamples,
  });
  const sessionTracker = new OrchestratorTelemetrySessionTracker(sessionId);
  const eventLog = new OrchestratorTelemetryEventLog(opts.eventLogMaxEntries);
  const annotator = new OrchestratorTelemetryAnnotator(mlExtractor);
  const inspector = new OrchestratorTelemetryInspector();

  function captureAndRecord(nowMsOverride?: number): TelemetryExportBundle {
    const ts = nowMsOverride ?? nowMs();
    const snap = telemetry.snapshot();
    trendAnalyzer.record(snap, ts);
    sessionTracker.record(snap, ts);
    const trend = trendAnalyzer.getTrend();
    const sessionReport = sessionTracker.getReport(ts);
    return inspector.buildExportBundle(snap, { trend, sessionReport, nowMs: ts });
  }

  function captureAndSignal(nowMsOverride?: number): TelemetryChatSignal {
    const ts = nowMsOverride ?? nowMs();
    const snap = telemetry.snapshot();
    const trend = trendAnalyzer.getTrend();
    return inspector.buildChatSignal(snap, trend, ts);
  }

  function extractMLVector(nowMsOverride?: number): TelemetryMLVector {
    const snap = telemetry.snapshot();
    return mlExtractor.extract(snap, nowMsOverride);
  }

  function buildDLTensor(nowMsOverride?: number): TelemetryDLTensor {
    const snap = telemetry.snapshot();
    return dlBuilder.build(snap, nowMsOverride);
  }

  function getTrend(): TelemetryTrendSnapshot | null {
    return trendAnalyzer.getTrend();
  }

  function getSessionReport(nowMsOverride?: number): TelemetrySessionReport {
    return sessionTracker.getReport(nowMsOverride);
  }

  function buildRunSummary(finalizedAtMs?: number): TelemetryRunSummary {
    return inspector.buildRunSummary(telemetry, finalizedAtMs);
  }

  return Object.freeze({
    telemetry,
    mlExtractor,
    dlBuilder,
    trendAnalyzer,
    sessionTracker,
    eventLog,
    annotator,
    inspector,
    sessionId,
    captureAndRecord,
    captureAndSignal,
    extractMLVector,
    buildDLTensor,
    getTrend,
    getSessionReport,
    buildRunSummary,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — PURE UTILITY EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the 32-dim ML vector from a snapshot (standalone utility).
 * Uses a fresh extractor instance — suitable for one-off extractions.
 */
export function extractTelemetryMLVector(
  snap: OrchestratorTelemetrySnapshot,
  nowMsOverride?: number,
): TelemetryMLVector {
  return new OrchestratorTelemetryMLExtractor().extract(snap, nowMsOverride);
}

/**
 * Extract ML vector as a flat numeric array.
 */
export function extractTelemetryMLVectorArray(
  snap: OrchestratorTelemetrySnapshot,
  nowMsOverride?: number,
): readonly number[] {
  return new OrchestratorTelemetryMLExtractor().extractArray(snap, nowMsOverride);
}

/**
 * Build the 8×4 DL tensor from a snapshot.
 */
export function buildTelemetryDLTensor(
  snap: OrchestratorTelemetrySnapshot,
  nowMsOverride?: number,
): TelemetryDLTensor {
  const ext = new OrchestratorTelemetryMLExtractor();
  return new OrchestratorTelemetryDLBuilder(ext).build(snap, nowMsOverride);
}

/**
 * Classify severity from a snapshot.
 */
export function classifyTelemetrySeverity(
  snap: OrchestratorTelemetrySnapshot,
  nowMsOverride?: number,
): TelemetrySeverity {
  const ext = new OrchestratorTelemetryMLExtractor();
  const vec = ext.extract(snap, nowMsOverride);
  return ext.classifySeverity(vec);
}

/**
 * Build the TelemetryChatSignal from a snapshot (standalone utility).
 */
export function buildTelemetryChatSignal(
  snap: OrchestratorTelemetrySnapshot,
  trendOverride?: TelemetryTrendSnapshot | null,
  nowMsOverride?: number,
): TelemetryChatSignal {
  return new OrchestratorTelemetryInspector().buildChatSignal(snap, trendOverride, nowMsOverride);
}

/**
 * Build the full annotation bundle from a snapshot.
 */
export function buildTelemetryAnnotations(
  snap: OrchestratorTelemetrySnapshot,
  nowMsOverride?: number,
): TelemetryAnnotationBundle {
  return new OrchestratorTelemetryAnnotator().annotate(snap, nowMsOverride);
}

/**
 * Validate that all 32 ML features are in [0, 1].
 */
export function validateTelemetryMLVector(vec: TelemetryMLVector): {
  valid: boolean;
  invalidFeatures: readonly string[];
} {
  return new OrchestratorTelemetryMLExtractor().validate(vec);
}

/**
 * Flatten the 8×4 DL tensor into a 32-element numeric array (row-major).
 */
export function flattenTelemetryDLTensor(tensor: TelemetryDLTensor): readonly number[] {
  return new OrchestratorTelemetryDLBuilder().flatten(tensor);
}

/**
 * Build a named map (label → value) from a TelemetryMLVector.
 */
export function buildTelemetryMLNamedMap(vec: TelemetryMLVector): TelemetryMLNamedMap {
  const arr = Object.values(vec as unknown as Record<string, number>);
  const map: Record<string, number> = {};
  for (let i = 0; i < TELEMETRY_ML_FEATURE_LABELS.length; i++) {
    map[TELEMETRY_ML_FEATURE_LABELS[i]!] = arr[i] ?? 0;
  }
  return Object.freeze(map);
}

/**
 * Extract a single column (0–3) from the DL tensor.
 */
export function extractTelemetryDLColumn(
  tensor: TelemetryDLTensor,
  colIndex: 0 | 1 | 2 | 3,
): readonly number[] {
  return new OrchestratorTelemetryDLBuilder().extractColumn(tensor, colIndex);
}

/**
 * Compute L2 similarity between two ML vectors (1 = identical, 0 = maximally different).
 */
export function computeTelemetryMLSimilarity(
  a: TelemetryMLVector,
  b: TelemetryMLVector,
): number {
  return new OrchestratorTelemetryMLExtractor().computeSimilarity(a, b);
}

/**
 * Return the top N features by value.
 */
export function getTopTelemetryFeatures(
  vec: TelemetryMLVector,
  topN = 5,
): ReadonlyArray<{ readonly label: string; readonly value: number }> {
  return new OrchestratorTelemetryMLExtractor().getTopFeatures(vec, topN);
}

/**
 * Score a single EngineHealth entry using the health status scoring maps.
 * Returns a [0, 1] score where 1 = fully healthy.
 */
export function scoreTelemetryEngineHealth(entry: EngineHealth): number {
  return ENGINE_HEALTH_STATUS_SCORE[entry.status];
}

/**
 * Returns the severity label for an EngineHealth entry.
 * Uses the ENGINE_HEALTH_STATUS_SEVERITY_LABEL scoring map.
 */
export function getTelemetryEngineHealthSeverityLabel(entry: EngineHealth): string {
  return ENGINE_HEALTH_STATUS_SEVERITY_LABEL[entry.status];
}

/**
 * Returns the urgency weight for a signal severity.
 * Uses ENGINE_SIGNAL_SEVERITY_WEIGHT scoring map.
 */
export function getTelemetrySignalSeverityWeight(severity: SignalSeverity): number {
  return ENGINE_SIGNAL_SEVERITY_WEIGHT[severity];
}

/**
 * Returns the UX category for a signal severity.
 */
export function getTelemetrySignalSeverityUXCategory(severity: SignalSeverity): string {
  return ENGINE_SIGNAL_SEVERITY_UX_CATEGORY[severity];
}

/**
 * Returns the TickStep ordinal (0-based position) from TELEMETRY_TICK_STEP_ORDER.
 */
export function getTelemetryTickStepOrdinal(step: TickStep): number {
  return TELEMETRY_TICK_STEP_ORDINAL[step] ?? -1;
}

/**
 * Returns true if a TickStep is an engine phase (engine-owned computation).
 */
export function isTelemetryEnginePhaseStep(step: TickStep): boolean {
  return TELEMETRY_TICK_STEP_IS_ENGINE_PHASE[step] ?? false;
}

/**
 * Returns the budget in ms for a TickStep.
 */
export function getTelemetryStepBudgetMs(step: TickStep): number {
  return TELEMETRY_TICK_STEP_BUDGET_MS[step] ?? 20;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — SINGLETONS AND ZERO-STATE DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zero-state TelemetryMLVector (all dimensions = 0, except defaults).
 * Used as a safe default before any telemetry is recorded.
 */
export const ZERO_DEFAULT_TELEMETRY_ML_VECTOR: TelemetryMLVector = Object.freeze({
  tickDensityScore: 0,
  signalDensityScore: 0,
  eventDensityScore: 0,
  traceDensityScore: 0,
  infoSignalRatio: 1, // all signals are INFO by default
  warnSignalRatio: 0,
  errorSignalRatio: 0,
  signalNoiseScore: 0,
  avgTickDurationNorm: 0,
  maxTickDurationNorm: 0,
  minTickDurationNorm: 0,
  warningDensityScore: 0,
  stepCoverageRatio: 0,
  engineHealthyRatio: 1, // all engines healthy by default
  engineDegradedRatio: 0,
  engineFailedFlag: 0,
  hasActiveRun: 0,
  outcomeActiveScore: 0,
  outcomeCompleteScore: 0,
  checksumValidScore: 1, // checksum valid by default
  emittedEventDensity: 0,
  warningsPerTick: 0,
  stepErrorRate: 0,
  tickConsistencyScore: 1, // no warnings by default
  recentTickWindowRatio: 0,
  traceAccumulationRate: 0,
  criticalSignalFlag: 0,
  dataFreshnessScore: 0, // no data yet
  healthCompositeScore: 1, // perfect health by default
  phaseStabilityScore: 1, // stable by default
  warningEscalationScore: 0,
  overallHealthScore: 1, // nominal by default
});

/**
 * Zero-state DL tensor (all rows = [1, 0, 0, 1] representing nominal/healthy state).
 */
export const ZERO_DEFAULT_TELEMETRY_DL_TENSOR: TelemetryDLTensor = Object.freeze([
  Object.freeze([1, 0, 0, 0]) as readonly [number, number, number, number], // Row 0 signal: all info
  Object.freeze([0, 0, 0, 1]) as readonly [number, number, number, number], // Row 1 timing: consistent
  Object.freeze([1, 0, 0, 1]) as readonly [number, number, number, number], // Row 2 engines: all healthy
  Object.freeze([0, 0, 0, 0]) as readonly [number, number, number, number], // Row 3 density: zero
  Object.freeze([0, 0, 0, 1]) as readonly [number, number, number, number], // Row 4 warnings: none
  Object.freeze([0, 0, 1, 1]) as readonly [number, number, number, number], // Row 5 run state: no run, checksum ok
  Object.freeze([0, 0, 1, 1]) as readonly [number, number, number, number], // Row 6 steps: no coverage, phase stable
  Object.freeze([1, 1, 1, 1]) as readonly [number, number, number, number], // Row 7 composites: all nominal
] as TelemetryDLTensor);

/**
 * Zero-state chat signal for initialization before any ticks are recorded.
 */
export const ZERO_DEFAULT_TELEMETRY_CHAT_SIGNAL: TelemetryChatSignal = Object.freeze({
  generatedAtMs: 0,
  severity: 'NOMINAL' as TelemetrySeverity,
  activeRunId: null,
  tick: null,
  totalTicksObserved: 0,
  totalSignalsObserved: 0,
  totalEventsObserved: 0,
  errorSignalRatio: 0,
  avgTickDurationMs: 0,
  warningCount: 0,
  engineHealthyRatio: 1,
  engineFailedCount: 0,
  stepCoverageRatio: 0,
  overallHealthScore: 1,
  trendDirection: null,
});

/**
 * Singleton ML extractor for direct utility use across the zero subsystem.
 */
export const ZERO_TELEMETRY_ML_EXTRACTOR = new OrchestratorTelemetryMLExtractor();

/**
 * Singleton DL builder wired to the singleton extractor.
 */
export const ZERO_TELEMETRY_DL_BUILDER = new OrchestratorTelemetryDLBuilder(
  ZERO_TELEMETRY_ML_EXTRACTOR,
);

/**
 * Singleton annotator for quick annotation extraction.
 */
export const ZERO_TELEMETRY_ANNOTATOR = new OrchestratorTelemetryAnnotator(
  ZERO_TELEMETRY_ML_EXTRACTOR,
);

/**
 * Singleton inspector (the recommended external entry point for one-off access).
 */
export const ZERO_TELEMETRY_INSPECTOR = new OrchestratorTelemetryInspector();

// ─────────────────────────────────────────────────────────────────────────────
// Re-export EMPTY_SEVERITY for consumers who need the zero-state breakdown
// ─────────────────────────────────────────────────────────────────────────────

export { EMPTY_SEVERITY as TELEMETRY_EMPTY_SEVERITY_BREAKDOWN };
