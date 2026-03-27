// backend/src/game/engine/zero/OrchestratorHealthReport.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorHealthReport.ts
 *
 * Doctrine:
 * - health reporting is an orchestration concern, not an engine concern
 * - core engines own their self-reported health; Engine 0 aggregates, scores,
 *   classifies, and surfaces readiness without mutating engine state
 * - reports must stay deterministic, immutable, and safe for operator tooling
 * - no synthetic engine statuses are invented unless an engine fails to report
 *
 * Surfaces (v2 — full ML/DL/chat depth layer):
 *   § 1  — Imports and utility helpers
 *   § 2  — Constants: ML feature labels (32), DL tensor shape (7×8), status maps
 *   § 3  — Core types: OrchestratorReadiness, dependencies, breakdown, metrics,
 *           OrchestratorHealthReportSnapshot (backward-compatible, unchanged)
 *   § 4  — ML vector: OrchestratorHealthMLVector (32-dim), feature label array
 *   § 5  — DL tensor: OrchestratorHealthDLTensor (7×8 engine × feature matrix)
 *   § 6  — Chat signal: OrchestratorHealthChatSignal, telemetry record
 *   § 7  — Trend: OrchestratorHealthTrendSnapshot, rolling window sampling
 *   § 8  — Session: OrchestratorHealthSessionReport, per-session analytics
 *   § 9  — Event log: OrchestratorHealthEventRecord, health transition ring buffer
 *   § 10 — Annotation: OrchestratorHealthAnnotationBundle, companion narrative
 *   § 11 — Export: OrchestratorHealthExportBundle, full observable surface
 *   § 12 — OrchestratorHealthMLExtractor (pure 32-dim ML vector builder)
 *   § 13 — OrchestratorHealthDLBuilder (pure 7×8 tensor builder)
 *   § 14 — OrchestratorHealthTrendAnalyzer (rolling window analysis)
 *   § 15 — OrchestratorHealthSessionTracker (per-session analytics)
 *   § 16 — OrchestratorHealthEventLog (ring buffer, health status transitions)
 *   § 17 — OrchestratorHealthAnnotator (UX narrative + companion surface)
 *   § 18 — OrchestratorHealthInspector (read-only inspection API)
 *   § 19 — OrchestratorHealthReport (core class, fully expanded)
 *   § 20 — Factory functions and exported singletons
 */

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Imports and utility helpers
// ─────────────────────────────────────────────────────────────────────────────

import type {
  EngineHealth,
  EngineHealthStatus,
} from '../core/EngineContracts';
import { EngineRegistry } from '../core/EngineRegistry';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { RuntimeCheckpointCoordinator } from './RuntimeCheckpointCoordinator';
import type { StepTracePublisher } from './StepTracePublisher';

/** Freeze a shallow array copy — makes collection surfaces immutable at the boundary. */
function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

/** Clamp value to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Clamp value to [min, max]. */
function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Normalize a count by a divisor, clamped to [0, 1]. Returns 0 if divisor is 0. */
function normalizeCount(count: number, divisor: number): number {
  if (divisor <= 0) return 0;
  return clamp01(count / divisor);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Constants: ML feature labels, DL tensor shape, status scoring maps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical 32-dim ML feature label array for OrchestratorHealthReport.
 * Index must stay stable across model versions — append only, never reorder.
 */
export const HEALTH_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 00 */ 'readiness_encoded',
  /* 01 */ 'score_normalized',
  /* 02 */ 'healthy_ratio',
  /* 03 */ 'degraded_ratio',
  /* 04 */ 'failed_ratio',
  /* 05 */ 'has_active_run',
  /* 06 */ 'tick_normalized',
  /* 07 */ 'integrity_ok',
  /* 08 */ 'integrity_quarantined',
  /* 09 */ 'proof_hash_present',
  /* 10 */ 'open_trace_count_normalized',
  /* 11 */ 'warning_count_normalized',
  /* 12 */ 'queued_event_warnings_normalized',
  /* 13 */ 'checkpoint_count_normalized',
  /* 14 */ 'has_failed_engines',
  /* 15 */ 'has_degraded_engines',
  /* 16 */ 'phase_encoded',
  /* 17 */ 'outcome_present',
  /* 18 */ 'is_win_outcome',
  /* 19 */ 'is_loss_outcome',
  /* 20 */ 'total_engines_normalized',
  /* 21 */ 'time_engine_healthy',
  /* 22 */ 'pressure_engine_healthy',
  /* 23 */ 'tension_engine_healthy',
  /* 24 */ 'shield_engine_healthy',
  /* 25 */ 'battle_engine_healthy',
  /* 26 */ 'cascade_engine_healthy',
  /* 27 */ 'sovereignty_engine_healthy',
  /* 28 */ 'consecutive_failures_normalized',
  /* 29 */ 'avg_engine_status_score',
  /* 30 */ 'trace_session_depth',
  /* 31 */ 'checkpoint_density_normalized',
]) as readonly string[];

/** Number of ML features. Must match HEALTH_ML_FEATURE_LABELS.length. */
export const HEALTH_ML_FEATURE_DIM = 32 as const;

/** Ordered engine IDs that define DL tensor row order. */
export const HEALTH_DL_ENGINE_ORDER = Object.freeze([
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
] as const);

/** Number of engines in the DL tensor (rows). */
export const HEALTH_DL_ROW_COUNT = 7 as const;

/** Number of per-engine features in the DL tensor (columns). */
export const HEALTH_DL_COL_COUNT = 8 as const;

/** DL tensor feature names — columns of the 7×8 engine health tensor. */
export const HEALTH_DL_FEATURE_NAMES: readonly string[] = Object.freeze([
  /* col 0 */ 'status_encoded',
  /* col 1 */ 'notes_count_normalized',
  /* col 2 */ 'consecutive_failures_normalized',
  /* col 3 */ 'last_successful_tick_normalized',
  /* col 4 */ 'age_normalized',
  /* col 5 */ 'is_failed_flag',
  /* col 6 */ 'is_degraded_flag',
  /* col 7 */ 'engine_index_normalized',
]);

/**
 * Numeric score for each EngineHealthStatus.
 * WIRES: EngineHealthStatus import (used as Record key).
 * Used in ML vector avg_engine_status_score and annotation priority.
 */
export const HEALTH_STATUS_NUMERIC_SCORE: Record<EngineHealthStatus, number> = Object.freeze({
  HEALTHY: 1.0,
  DEGRADED: 0.5,
  FAILED: 0.0,
});

/**
 * DL tensor encoding for each EngineHealthStatus.
 * WIRES: EngineHealthStatus import.
 * Used in OrchestratorHealthDLBuilder row feature[0].
 */
export const HEALTH_STATUS_DL_ENCODING: Record<EngineHealthStatus, number> = Object.freeze({
  HEALTHY: 1.0,
  DEGRADED: 0.5,
  FAILED: 0.0,
});

/**
 * Human-readable severity label per EngineHealthStatus.
 * WIRES: EngineHealthStatus import.
 * Used in annotations, event log UX output, and companion narrative.
 */
export const HEALTH_STATUS_SEVERITY_LABEL: Record<EngineHealthStatus, string> = Object.freeze({
  HEALTHY: 'nominal',
  DEGRADED: 'degraded',
  FAILED: 'critical',
});

/**
 * Urgency weight per EngineHealthStatus.
 * WIRES: EngineHealthStatus import.
 * Used in annotation priority ordering and event log triage.
 * Higher = more urgent.
 */
export const HEALTH_STATUS_URGENCY_WEIGHT: Record<EngineHealthStatus, number> = Object.freeze({
  HEALTHY: 0,
  DEGRADED: 1,
  FAILED: 3,
});

/**
 * Score penalty per engine in FAILED or DEGRADED state.
 * WIRES: EngineHealthStatus import.
 */
export const HEALTH_STATUS_SCORE_PENALTY: Record<EngineHealthStatus, number> = Object.freeze({
  HEALTHY: 0,
  DEGRADED: 12,
  FAILED: 40,
});

/**
 * Returns whether an EngineHealthStatus indicates a terminal / non-operational state.
 * WIRES: EngineHealthStatus as parameter type.
 */
export function isTerminalEngineStatus(status: EngineHealthStatus): boolean {
  return status === 'FAILED';
}

/**
 * Returns whether an EngineHealthStatus indicates any impairment.
 * WIRES: EngineHealthStatus as parameter type.
 */
export function isImpairedEngineStatus(status: EngineHealthStatus): boolean {
  return status === 'FAILED' || status === 'DEGRADED';
}

/**
 * Maps an EngineHealthStatus to its companion-facing severity classification.
 * WIRES: EngineHealthStatus as parameter type.
 */
export function classifyEngineStatusSeverity(
  status: EngineHealthStatus,
): 'nominal' | 'degraded' | 'critical' {
  return HEALTH_STATUS_SEVERITY_LABEL[status] as 'nominal' | 'degraded' | 'critical';
}

/**
 * Score a single EngineHealth entry into a numeric utility [0, 1].
 * WIRES: EngineHealthStatus via HEALTH_STATUS_NUMERIC_SCORE lookup.
 */
export function scoreEngineHealth(entry: EngineHealth): number {
  const base = HEALTH_STATUS_NUMERIC_SCORE[entry.status];
  const penaltyPerFailure = 0.02;
  const failures = entry.consecutiveFailures ?? 0;
  return clamp01(base - failures * penaltyPerFailure);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Core types (backward-compatible, unchanged for API stability)
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestratorReadiness =
  | 'READY'
  | 'DEGRADED'
  | 'FAILED'
  | 'IDLE';

/** Readiness numeric encoding for ML features. */
export const READINESS_ENCODING: Record<OrchestratorReadiness, number> = Object.freeze({
  READY: 1.0,
  DEGRADED: 0.5,
  FAILED: 0.0,
  IDLE: 0.25,
});

export interface OrchestratorHealthReportDependencies {
  readonly registry: EngineRegistry;
  readonly getCurrentSnapshot: () => RunStateSnapshot | null;
  readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;
  readonly tracePublisher?: StepTracePublisher;
  readonly now?: () => number;
}

export interface EngineHealthBreakdown {
  readonly healthy: readonly EngineHealth[];
  readonly degraded: readonly EngineHealth[];
  readonly failed: readonly EngineHealth[];
}

export interface OrchestratorHealthMetrics {
  readonly totalEngines: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly queuedEventWarnings: number;
  readonly openTraceCount: number;
  readonly warningCount: number;
  readonly checkpointCount: number;
  readonly score: number;
}

export interface OrchestratorHealthReportSnapshot {
  readonly generatedAtMs: number;
  readonly readiness: OrchestratorReadiness;
  readonly activeRunId: string | null;
  readonly tick: number | null;
  readonly phase: RunStateSnapshot['phase'] | null;
  readonly outcome: RunStateSnapshot['outcome'] | null;
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'] | null;
  readonly proofHashPresent: boolean;
  readonly health: readonly EngineHealth[];
  readonly breakdown: EngineHealthBreakdown;
  readonly metrics: OrchestratorHealthMetrics;
  readonly notes: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ML vector: OrchestratorHealthMLVector (32-dim)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 32-dimensional ML feature vector extracted from an OrchestratorHealthReportSnapshot.
 *
 * Dimension labels are canonicalized in HEALTH_ML_FEATURE_LABELS.
 * Feature ordering is append-only — never reorder, never remove.
 * Each field maps 1:1 to its index in the mlVectorArray.
 */
export interface OrchestratorHealthMLVector {
  /* 00 */ readonly readinessEncoded: number;
  /* 01 */ readonly scoreNormalized: number;
  /* 02 */ readonly healthyRatio: number;
  /* 03 */ readonly degradedRatio: number;
  /* 04 */ readonly failedRatio: number;
  /* 05 */ readonly hasActiveRun: number;
  /* 06 */ readonly tickNormalized: number;
  /* 07 */ readonly integrityOk: number;
  /* 08 */ readonly integrityQuarantined: number;
  /* 09 */ readonly proofHashPresent: number;
  /* 10 */ readonly openTraceCountNormalized: number;
  /* 11 */ readonly warningCountNormalized: number;
  /* 12 */ readonly queuedEventWarningsNormalized: number;
  /* 13 */ readonly checkpointCountNormalized: number;
  /* 14 */ readonly hasFailedEngines: number;
  /* 15 */ readonly hasDegradedEngines: number;
  /* 16 */ readonly phaseEncoded: number;
  /* 17 */ readonly outcomePresent: number;
  /* 18 */ readonly isWinOutcome: number;
  /* 19 */ readonly isLossOutcome: number;
  /* 20 */ readonly totalEnginesNormalized: number;
  /* 21 */ readonly timeEngineHealthy: number;
  /* 22 */ readonly pressureEngineHealthy: number;
  /* 23 */ readonly tensionEngineHealthy: number;
  /* 24 */ readonly shieldEngineHealthy: number;
  /* 25 */ readonly battleEngineHealthy: number;
  /* 26 */ readonly cascadeEngineHealthy: number;
  /* 27 */ readonly sovereigntyEngineHealthy: number;
  /* 28 */ readonly consecutiveFailuresNormalized: number;
  /* 29 */ readonly avgEngineStatusScore: number;
  /* 30 */ readonly traceSessionDepth: number;
  /* 31 */ readonly checkpointDensityNormalized: number;
  /** Index-addressable flat array — same data as the named fields. */
  readonly mlVectorArray: readonly number[];
  readonly [key: string]: number | readonly number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — DL tensor: OrchestratorHealthDLTensor (7×8 engine × feature matrix)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row of the DL tensor — per-engine 8-feature vector.
 *
 * Column mapping (HEALTH_DL_FEATURE_NAMES):
 *   0  status_encoded                 HEALTH_STATUS_DL_ENCODING[status]
 *   1  notes_count_normalized         notes.length / 10 clamped to [0,1]
 *   2  consecutive_failures_normalized consecutiveFailures / 50 clamped to [0,1]
 *   3  last_successful_tick_normalized lastSuccessfulTick / 10000 clamped to [0,1]
 *   4  age_normalized                 ms since updatedAt / 60000 clamped to [0,1]
 *   5  is_failed_flag                 1 if FAILED, else 0
 *   6  is_degraded_flag               1 if DEGRADED, else 0
 *   7  engine_index_normalized        rowIndex / 6
 */
export interface OrchestratorHealthDLRow {
  readonly engineId: string;
  readonly rowIndex: number;
  readonly features: readonly number[];
}

/**
 * Full 7×8 DL tensor — one row per engine in HEALTH_DL_ENGINE_ORDER.
 * Engines missing from the registry receive an all-zero row.
 */
export interface OrchestratorHealthDLTensor {
  readonly rows: readonly OrchestratorHealthDLRow[];
  readonly shape: readonly [number, number];
  readonly engineOrder: readonly string[];
  readonly featureNames: readonly string[];
  readonly capturedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — Chat signal: OrchestratorHealthChatSignal, telemetry record
// ─────────────────────────────────────────────────────────────────────────────

/** Severity classification for the health chat signal. */
export type OrchestratorHealthChatSeverity = 'NOMINAL' | 'DEGRADED' | 'CRITICAL';

/**
 * Chat signal emitted from OrchestratorHealthReport to the backend chat lane.
 * Consumed by OrchestratorHealthSignalAdapter → LIVEOPS_SIGNAL envelope.
 *
 * Design rule: this type must only carry data derivable from EngineHealth[],
 * OrchestratorHealthMetrics, and RunStateSnapshot. No ML vectors here —
 * those travel via translateMLVector / translateDLTensor on the adapter.
 */
export interface OrchestratorHealthChatSignal {
  readonly generatedAtMs: number;
  readonly severity: OrchestratorHealthChatSeverity;
  readonly readiness: OrchestratorReadiness;
  readonly activeRunId: string | null;
  readonly tick: number | null;
  readonly score: number;
  readonly totalEngines: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly openTraceCount: number;
  readonly warningCount: number;
  readonly checkpointCount: number;
  readonly integrityStatus: string | null;
  readonly proofHashPresent: boolean;
  readonly failedEngineIds: readonly string[];
  readonly degradedEngineIds: readonly string[];
  readonly notes: readonly string[];
}

/**
 * Lightweight telemetry record for continuous ops-board ingestion.
 * Emitted more frequently than the full chat signal — suitable for dashboards.
 */
export interface OrchestratorHealthTelemetryRecord {
  readonly ts: number;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly readiness: OrchestratorReadiness;
  readonly severity: OrchestratorHealthChatSeverity;
  readonly score: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly openTraceCount: number;
  readonly warningCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — Trend: OrchestratorHealthTrendSnapshot
// ─────────────────────────────────────────────────────────────────────────────

/** A single sample stored in the trend ring buffer. */
export interface OrchestratorHealthTrendSample {
  readonly capturedAtMs: number;
  readonly readiness: OrchestratorReadiness;
  readonly score: number;
  readonly failedCount: number;
  readonly degradedCount: number;
  readonly openTraceCount: number;
  readonly warningCount: number;
}

/** Direction of orchestrator health trend. */
export type OrchestratorHealthTrendDirection =
  | 'IMPROVING'
  | 'STABLE'
  | 'DEGRADING'
  | 'UNKNOWN';

/**
 * Aggregated trend snapshot produced by OrchestratorHealthTrendAnalyzer
 * over a rolling window of OrchestratorHealthTrendSamples.
 */
export interface OrchestratorHealthTrendSnapshot {
  readonly capturedAt: number;
  readonly sampleCount: number;
  readonly windowMs: number;
  readonly avgScore: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly avgFailedCount: number;
  readonly maxFailedCount: number;
  readonly avgDegradedCount: number;
  readonly avgOpenTraceCount: number;
  readonly avgWarningCount: number;
  readonly readyFraction: number;
  readonly degradedFraction: number;
  readonly failedFraction: number;
  readonly idleFraction: number;
  readonly trend: OrchestratorHealthTrendDirection;
  readonly nominalSamples: number;
  readonly degradedSamples: number;
  readonly criticalSamples: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — Session: OrchestratorHealthSessionReport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-session analytics report produced by OrchestratorHealthSessionTracker.
 * A "session" spans from first snapshot() call until reset() or clear().
 */
export interface OrchestratorHealthSessionReport {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly avgScore: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly totalFailedOccurrences: number;
  readonly totalDegradedOccurrences: number;
  readonly peakFailedCount: number;
  readonly peakDegradedCount: number;
  readonly peakOpenTraceCount: number;
  readonly peakWarningCount: number;
  readonly nominalFraction: number;
  readonly degradedFraction: number;
  readonly criticalFraction: number;
  readonly runsSeen: readonly string[];
  readonly engineFailureEvents: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — Event log: OrchestratorHealthEventRecord, ring buffer
// ─────────────────────────────────────────────────────────────────────────────

/** Kind of health event tracked in the event log. */
export type OrchestratorHealthEventKind =
  | 'ENGINE_STATUS_CHANGE'
  | 'READINESS_CHANGE'
  | 'SCORE_THRESHOLD_CROSSED'
  | 'TRACE_OPENED'
  | 'TRACE_CLOSED'
  | 'CHECKPOINT_CAPTURED'
  | 'INTEGRITY_CHANGED'
  | 'RUN_STARTED'
  | 'RUN_ENDED';

/**
 * A single health event record stored in OrchestratorHealthEventLog.
 * Status transitions use EngineHealthStatus to track per-engine changes.
 * WIRES: EngineHealthStatus as field type.
 */
export interface OrchestratorHealthEventRecord {
  readonly eventId: string;
  readonly kind: OrchestratorHealthEventKind;
  readonly capturedAtMs: number;
  readonly engineId?: string;
  readonly previousStatus?: EngineHealthStatus | null;
  readonly newStatus?: EngineHealthStatus;
  readonly previousReadiness?: OrchestratorReadiness;
  readonly newReadiness?: OrchestratorReadiness;
  readonly previousScore?: number;
  readonly newScore?: number;
  readonly runId?: string;
  readonly tick?: number;
  readonly message: string;
  readonly urgencyWeight: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — Annotation: OrchestratorHealthAnnotationBundle
// ─────────────────────────────────────────────────────────────────────────────

/** Priority tier for annotations surfaced to companions and ops tooling. */
export type OrchestratorHealthAnnotationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** A single annotation entry — one concern surfaced to the companion layer. */
export interface OrchestratorHealthAnnotation {
  readonly code: string;
  readonly priority: OrchestratorHealthAnnotationPriority;
  readonly engineId?: string;
  readonly message: string;
  readonly detail: string;
  readonly urgencyWeight: number;
}

/**
 * Full annotation bundle produced by OrchestratorHealthAnnotator.
 * Drives companion commentary, operator alerts, and UX urgency display.
 */
export interface OrchestratorHealthAnnotationBundle {
  readonly capturedAtMs: number;
  readonly readiness: OrchestratorReadiness;
  readonly annotations: readonly OrchestratorHealthAnnotation[];
  readonly topAnnotation: OrchestratorHealthAnnotation | null;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly companionHeadline: string;
  readonly operatorSummary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — Export bundle: OrchestratorHealthExportBundle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full observable surface exported by OrchestratorHealthReport.
 * Combines snapshot, ML vector, DL tensor, chat signal, trend, session,
 * event log tail, and annotation bundle into one cohesive read model.
 */
export interface OrchestratorHealthExportBundle {
  readonly snapshot: OrchestratorHealthReportSnapshot;
  readonly mlVector: OrchestratorHealthMLVector;
  readonly dlTensor: OrchestratorHealthDLTensor;
  readonly chatSignal: OrchestratorHealthChatSignal;
  readonly trend: OrchestratorHealthTrendSnapshot | null;
  readonly session: OrchestratorHealthSessionReport | null;
  readonly recentEvents: readonly OrchestratorHealthEventRecord[];
  readonly annotations: OrchestratorHealthAnnotationBundle;
  readonly runSummary: OrchestratorHealthRunSummary | null;
  readonly exportedAtMs: number;
}

/**
 * Aggregated run-level summary, combining checkpoint and trace analytics.
 * Produced using RuntimeCheckpointCoordinator.summarizeRun and
 * StepTracePublisher.summarizeRun for the active run.
 * WIRES: RuntimeCheckpointCoordinator and StepTracePublisher expanded API.
 */
export interface OrchestratorHealthRunSummary {
  readonly runId: string;
  readonly checkpointCount: number;
  readonly latestCheckpointId: string | null;
  readonly latestCheckpointTick: number | null;
  readonly terminalCheckpointId: string | null;
  readonly traceCount: number;
  readonly traceOkCount: number;
  readonly traceErrorCount: number;
  readonly traceAvgDurationMs: number;
  readonly latestTraceId: string | null;
  readonly latestTraceTick: number | null;
  readonly openTraceIds: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — OrchestratorHealthMLExtractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure ML feature vector extractor for OrchestratorHealthReport.
 *
 * All methods are static and side-effect free.
 * Produces a 32-dim vector from an OrchestratorHealthReportSnapshot.
 *
 * WIRES: EngineHealthStatus via HEALTH_STATUS_NUMERIC_SCORE lookup for
 * avg_engine_status_score (dim 29).
 */
export class OrchestratorHealthMLExtractor {
  private static readonly TICK_NORM_DIVISOR = 10_000;
  private static readonly TRACE_NORM_DIVISOR = 50;
  private static readonly WARNING_NORM_DIVISOR = 100;
  private static readonly FORK_NORM_DIVISOR = 50;
  private static readonly CHECKPOINT_NORM_DIVISOR = 100;
  private static readonly ENGINE_NORM_DIVISOR = 10;
  private static readonly FAILURE_NORM_DIVISOR = 50;
  private static readonly DENSITY_NORM_DIVISOR = 10;

  /** Phase encoding: known active phases > 0; setup/unknown = 0; terminal = 1. */
  private static encodePhase(phase: RunStateSnapshot['phase'] | null): number {
    if (phase === null) return 0;
    const p = phase as string;
    if (p === 'TERMINAL') return 1.0;
    if (p === 'ACTIVE') return 0.5;
    if (p === 'SETUP') return 0.1;
    return 0.25; // unknown but non-null
  }

  /** Outcome encoding: win = 1, loss = −1 normalized to 0, no outcome = 0. */
  private static encodeOutcomeWin(outcome: RunStateSnapshot['outcome'] | null): number {
    if (outcome === null) return 0;
    const o = outcome as string;
    // Known win outcomes based on game vocabulary
    if (o === 'WIN' || o === 'VICTORY' || o.startsWith('WIN')) return 1;
    return 0;
  }

  private static encodeOutcomeLoss(outcome: RunStateSnapshot['outcome'] | null): number {
    if (outcome === null) return 0;
    const o = outcome as string;
    if (o === 'LOSS' || o === 'DEFEAT' || o === 'ELIMINATED' || o.startsWith('LOSS')) return 1;
    return 0;
  }

  /** Compute avg engine status score using HEALTH_STATUS_NUMERIC_SCORE. WIRES EngineHealthStatus. */
  private static computeAvgStatusScore(health: readonly EngineHealth[]): number {
    if (health.length === 0) return 0;
    const sum = health.reduce((acc, entry) => acc + HEALTH_STATUS_NUMERIC_SCORE[entry.status], 0);
    return sum / health.length;
  }

  /** Compute total consecutive failures across all engines. */
  private static totalConsecutiveFailures(health: readonly EngineHealth[]): number {
    return health.reduce((acc, entry) => acc + (entry.consecutiveFailures ?? 0), 0);
  }

  /** Look up a specific engine's health status by ID. Returns 1 if HEALTHY, else 0. */
  private static engineHealthyFlag(health: readonly EngineHealth[], engineId: string): number {
    const entry = health.find((e) => e.engineId === engineId);
    if (entry === undefined) return 0;
    return entry.status === 'HEALTHY' ? 1 : 0;
  }

  /**
   * Extract the 32-dim ML vector from a health report snapshot.
   *
   * @param snap  — OrchestratorHealthReportSnapshot to extract from
   * @param nowMs — timestamp for age calculations (defaults to snap.generatedAtMs)
   * @param checkpointCount — total checkpoint count for density feature (optional)
   * @param openTraceCount  — open trace session depth (optional, falls back to snap.metrics)
   * @returns OrchestratorHealthMLVector with all 32 named features and mlVectorArray
   */
  public static extract(
    snap: OrchestratorHealthReportSnapshot,
    nowMs?: number,
    checkpointCountOverride?: number,
    openTraceOverride?: number,
  ): OrchestratorHealthMLVector {
    const m = snap.metrics;
    const health = snap.health;
    const _nowMs = nowMs ?? snap.generatedAtMs;
    const checkpoints = checkpointCountOverride ?? m.checkpointCount;
    const openTraces = openTraceOverride ?? m.openTraceCount;

    const total = m.totalEngines > 0 ? m.totalEngines : 1;

    /* 00 */ const readinessEncoded = READINESS_ENCODING[snap.readiness];
    /* 01 */ const scoreNormalized = clamp01(m.score / 100);
    /* 02 */ const healthyRatio = normalizeCount(m.healthyCount, total);
    /* 03 */ const degradedRatio = normalizeCount(m.degradedCount, total);
    /* 04 */ const failedRatio = normalizeCount(m.failedCount, total);
    /* 05 */ const hasActiveRun = snap.activeRunId !== null ? 1 : 0;
    /* 06 */ const tickNormalized = snap.tick !== null
      ? clamp01(snap.tick / OrchestratorHealthMLExtractor.TICK_NORM_DIVISOR)
      : 0;
    /* 07 */ const integrityOk = snap.integrityStatus === 'VERIFIED' ? 1 : 0;
    /* 08 */ const integrityQuarantined = snap.integrityStatus === 'QUARANTINED' ? 1 : 0;
    /* 09 */ const proofHashPresent = snap.proofHashPresent ? 1 : 0;
    /* 10 */ const openTraceCountNormalized = normalizeCount(
      openTraces,
      OrchestratorHealthMLExtractor.TRACE_NORM_DIVISOR,
    );
    /* 11 */ const warningCountNormalized = normalizeCount(
      m.warningCount,
      OrchestratorHealthMLExtractor.WARNING_NORM_DIVISOR,
    );
    /* 12 */ const queuedEventWarningsNormalized = normalizeCount(
      m.queuedEventWarnings,
      OrchestratorHealthMLExtractor.FORK_NORM_DIVISOR,
    );
    /* 13 */ const checkpointCountNormalized = normalizeCount(
      checkpoints,
      OrchestratorHealthMLExtractor.CHECKPOINT_NORM_DIVISOR,
    );
    /* 14 */ const hasFailedEngines = m.failedCount > 0 ? 1 : 0;
    /* 15 */ const hasDegradedEngines = m.degradedCount > 0 ? 1 : 0;
    /* 16 */ const phaseEncoded = OrchestratorHealthMLExtractor.encodePhase(snap.phase);
    /* 17 */ const outcomePresent = snap.outcome !== null ? 1 : 0;
    /* 18 */ const isWinOutcome = OrchestratorHealthMLExtractor.encodeOutcomeWin(snap.outcome);
    /* 19 */ const isLossOutcome = OrchestratorHealthMLExtractor.encodeOutcomeLoss(snap.outcome);
    /* 20 */ const totalEnginesNormalized = normalizeCount(
      m.totalEngines,
      OrchestratorHealthMLExtractor.ENGINE_NORM_DIVISOR,
    );
    /* 21 */ const timeEngineHealthy = OrchestratorHealthMLExtractor.engineHealthyFlag(health, 'time');
    /* 22 */ const pressureEngineHealthy = OrchestratorHealthMLExtractor.engineHealthyFlag(health, 'pressure');
    /* 23 */ const tensionEngineHealthy = OrchestratorHealthMLExtractor.engineHealthyFlag(health, 'tension');
    /* 24 */ const shieldEngineHealthy = OrchestratorHealthMLExtractor.engineHealthyFlag(health, 'shield');
    /* 25 */ const battleEngineHealthy = OrchestratorHealthMLExtractor.engineHealthyFlag(health, 'battle');
    /* 26 */ const cascadeEngineHealthy = OrchestratorHealthMLExtractor.engineHealthyFlag(health, 'cascade');
    /* 27 */ const sovereigntyEngineHealthy = OrchestratorHealthMLExtractor.engineHealthyFlag(health, 'sovereignty');
    /* 28 */ const consecutiveFailuresNormalized = normalizeCount(
      OrchestratorHealthMLExtractor.totalConsecutiveFailures(health),
      OrchestratorHealthMLExtractor.FAILURE_NORM_DIVISOR,
    );
    /* 29 */ const avgEngineStatusScore = OrchestratorHealthMLExtractor.computeAvgStatusScore(health);
    /* 30 */ const traceSessionDepth = normalizeCount(
      openTraces,
      OrchestratorHealthMLExtractor.TRACE_NORM_DIVISOR,
    );
    /* 31 */ const checkpointDensityNormalized = snap.tick !== null && snap.tick > 0
      ? normalizeCount(
          checkpoints / snap.tick,
          OrchestratorHealthMLExtractor.DENSITY_NORM_DIVISOR,
        )
      : 0;

    void _nowMs; // reserved for future age-based features

    const mlVectorArray: readonly number[] = Object.freeze([
      readinessEncoded,
      scoreNormalized,
      healthyRatio,
      degradedRatio,
      failedRatio,
      hasActiveRun,
      tickNormalized,
      integrityOk,
      integrityQuarantined,
      proofHashPresent,
      openTraceCountNormalized,
      warningCountNormalized,
      queuedEventWarningsNormalized,
      checkpointCountNormalized,
      hasFailedEngines,
      hasDegradedEngines,
      phaseEncoded,
      outcomePresent,
      isWinOutcome,
      isLossOutcome,
      totalEnginesNormalized,
      timeEngineHealthy,
      pressureEngineHealthy,
      tensionEngineHealthy,
      shieldEngineHealthy,
      battleEngineHealthy,
      cascadeEngineHealthy,
      sovereigntyEngineHealthy,
      consecutiveFailuresNormalized,
      avgEngineStatusScore,
      traceSessionDepth,
      checkpointDensityNormalized,
    ]);

    return Object.freeze({
      readinessEncoded,
      scoreNormalized,
      healthyRatio,
      degradedRatio,
      failedRatio,
      hasActiveRun,
      tickNormalized,
      integrityOk,
      integrityQuarantined,
      proofHashPresent,
      openTraceCountNormalized,
      warningCountNormalized,
      queuedEventWarningsNormalized,
      checkpointCountNormalized,
      hasFailedEngines,
      hasDegradedEngines,
      phaseEncoded,
      outcomePresent,
      isWinOutcome,
      isLossOutcome,
      totalEnginesNormalized,
      timeEngineHealthy,
      pressureEngineHealthy,
      tensionEngineHealthy,
      shieldEngineHealthy,
      battleEngineHealthy,
      cascadeEngineHealthy,
      sovereigntyEngineHealthy,
      consecutiveFailuresNormalized,
      avgEngineStatusScore,
      traceSessionDepth,
      checkpointDensityNormalized,
      mlVectorArray,
    }) as OrchestratorHealthMLVector;
  }

  /**
   * Validate that an ML vector has exactly 32 features in its array.
   * Returns null if valid, or an error message describing the violation.
   */
  public static validate(vec: OrchestratorHealthMLVector): string | null {
    if (vec.mlVectorArray.length !== HEALTH_ML_FEATURE_DIM) {
      return `Expected ${HEALTH_ML_FEATURE_DIM} features, got ${vec.mlVectorArray.length}`;
    }
    for (let i = 0; i < vec.mlVectorArray.length; i++) {
      const v = vec.mlVectorArray[i];
      if (!Number.isFinite(v)) {
        return `Feature[${i}] (${HEALTH_ML_FEATURE_LABELS[i]}) is not finite: ${String(v)}`;
      }
      if (v < -1 || v > 1) {
        return `Feature[${i}] (${HEALTH_ML_FEATURE_LABELS[i]}) out of [-1, 1]: ${String(v)}`;
      }
    }
    return null;
  }

  /**
   * Return the top-N most urgent feature indices from the vector.
   * "Most urgent" = features with the lowest values (closest to failure).
   * Useful for companion commentary selection and drift detection.
   */
  public static topUrgentFeatureIndices(
    vec: OrchestratorHealthMLVector,
    topN: number,
  ): readonly number[] {
    const indexed = vec.mlVectorArray.map((v, i) => ({ i, v }));
    // Lower score = more urgent (e.g., failedRatio near 1, scoreNormalized near 0)
    const scored = indexed.sort((a, b) => a.v - b.v);
    return freezeArray(scored.slice(0, topN).map((e) => e.i));
  }

  /**
   * Compute cosine similarity between two ML vectors.
   * Returns a value in [0, 1] — 1 = identical direction, 0 = orthogonal.
   */
  public static cosineSimilarity(a: OrchestratorHealthMLVector, b: OrchestratorHealthMLVector): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    const len = a.mlVectorArray.length;
    for (let i = 0; i < len; i++) {
      const ai = a.mlVectorArray[i] ?? 0;
      const bi = b.mlVectorArray[i] ?? 0;
      dot += ai * bi;
      magA += ai * ai;
      magB += bi * bi;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    if (denom === 0) return 0;
    return clamp01(dot / denom);
  }

  /**
   * Compute L2 distance between two ML vectors (Euclidean distance).
   * Lower = more similar health state.
   */
  public static l2Distance(a: OrchestratorHealthMLVector, b: OrchestratorHealthMLVector): number {
    let sum = 0;
    const len = a.mlVectorArray.length;
    for (let i = 0; i < len; i++) {
      const diff = (a.mlVectorArray[i] ?? 0) - (b.mlVectorArray[i] ?? 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Build a named-feature map for interpretability tooling.
   * Returns a Record of label → value for all 32 features.
   */
  public static toNamedMap(vec: OrchestratorHealthMLVector): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (let i = 0; i < HEALTH_ML_FEATURE_LABELS.length; i++) {
      result[HEALTH_ML_FEATURE_LABELS[i] as string] = vec.mlVectorArray[i] ?? 0;
    }
    return Object.freeze(result);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — OrchestratorHealthDLBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure 7×8 DL tensor builder for OrchestratorHealthReport.
 *
 * Produces a (7 engines) × (8 features) matrix.
 * One row per engine in HEALTH_DL_ENGINE_ORDER.
 * Engines not present in the health array receive an all-zero row with
 * is_failed_flag=1 to signal absence.
 *
 * WIRES: EngineHealthStatus via HEALTH_STATUS_DL_ENCODING and
 *        isTerminalEngineStatus / isImpairedEngineStatus helpers.
 */
export class OrchestratorHealthDLBuilder {
  private static readonly NOTES_NORM_DIVISOR = 10;
  private static readonly FAILURES_NORM_DIVISOR = 50;
  private static readonly TICK_NORM_DIVISOR = 10_000;
  private static readonly AGE_NORM_DIVISOR_MS = 60_000;

  /**
   * Build the 7×8 DL tensor from a health snapshot.
   *
   * @param snap   — OrchestratorHealthReportSnapshot
   * @param nowMs  — current timestamp for age feature (col 4)
   */
  public static build(
    snap: OrchestratorHealthReportSnapshot,
    nowMs: number,
  ): OrchestratorHealthDLTensor {
    const healthByEngine = new Map<string, EngineHealth>();
    for (const entry of snap.health) {
      healthByEngine.set(entry.engineId, entry);
    }

    const rows: OrchestratorHealthDLRow[] = [];

    for (let rowIndex = 0; rowIndex < HEALTH_DL_ENGINE_ORDER.length; rowIndex++) {
      const engineId = HEALTH_DL_ENGINE_ORDER[rowIndex] as string;
      const entry = healthByEngine.get(engineId);

      rows.push(OrchestratorHealthDLBuilder.buildRow(engineId, rowIndex, entry, nowMs));
    }

    return Object.freeze({
      rows: freezeArray(rows),
      shape: Object.freeze([HEALTH_DL_ROW_COUNT, HEALTH_DL_COL_COUNT] as const),
      engineOrder: HEALTH_DL_ENGINE_ORDER,
      featureNames: HEALTH_DL_FEATURE_NAMES,
      capturedAtMs: snap.generatedAtMs,
    });
  }

  /**
   * Build one row of the tensor for a single engine.
   * If entry is undefined (engine not registered), returns absence row.
   * WIRES: EngineHealthStatus via HEALTH_STATUS_DL_ENCODING.
   */
  private static buildRow(
    engineId: string,
    rowIndex: number,
    entry: EngineHealth | undefined,
    nowMs: number,
  ): OrchestratorHealthDLRow {
    if (entry === undefined) {
      // Engine absent — treat as FAILED for model purposes
      const features = Object.freeze([
        0.0, // status_encoded: absent = 0 (not reported)
        0.0, // notes_count_normalized
        0.0, // consecutive_failures_normalized
        0.0, // last_successful_tick_normalized
        1.0, // age_normalized: fully aged out
        1.0, // is_failed_flag: absent = effectively failed
        0.0, // is_degraded_flag
        clamp01(rowIndex / 6), // engine_index_normalized
      ]);
      return Object.freeze({ engineId, rowIndex, features });
    }

    /* col 0 */ const statusEncoded = HEALTH_STATUS_DL_ENCODING[entry.status];
    /* col 1 */ const notesCountNormalized = normalizeCount(
      entry.notes?.length ?? 0,
      OrchestratorHealthDLBuilder.NOTES_NORM_DIVISOR,
    );
    /* col 2 */ const consecutiveFailuresNormalized = normalizeCount(
      entry.consecutiveFailures ?? 0,
      OrchestratorHealthDLBuilder.FAILURES_NORM_DIVISOR,
    );
    /* col 3 */ const lastSuccessfulTickNormalized = entry.lastSuccessfulTick !== undefined
      ? clamp01(entry.lastSuccessfulTick / OrchestratorHealthDLBuilder.TICK_NORM_DIVISOR)
      : 0;
    /* col 4 */ const ageNormalized = clamp01(
      (nowMs - entry.updatedAt) / OrchestratorHealthDLBuilder.AGE_NORM_DIVISOR_MS,
    );
    /* col 5 */ const isFailedFlag = isTerminalEngineStatus(entry.status) ? 1 : 0;
    /* col 6 */ const isDegradedFlag = entry.status === 'DEGRADED' ? 1 : 0;
    /* col 7 */ const engineIndexNormalized = clamp01(rowIndex / 6);

    const features = Object.freeze([
      statusEncoded,
      notesCountNormalized,
      consecutiveFailuresNormalized,
      lastSuccessfulTickNormalized,
      ageNormalized,
      isFailedFlag,
      isDegradedFlag,
      engineIndexNormalized,
    ]);

    return Object.freeze({ engineId, rowIndex, features });
  }

  /**
   * Flatten the DL tensor into a 1D array of (7 × 8 = 56) values.
   * Row-major order: all features for engine[0] first, then engine[1], etc.
   */
  public static flatten(tensor: OrchestratorHealthDLTensor): readonly number[] {
    const flat: number[] = [];
    for (const row of tensor.rows) {
      for (const f of row.features) {
        flat.push(f);
      }
    }
    return Object.freeze(flat);
  }

  /**
   * Extract a single column (feature) across all engine rows.
   * Useful for per-feature analysis across the engine fleet.
   */
  public static extractColumn(tensor: OrchestratorHealthDLTensor, colIndex: number): readonly number[] {
    return Object.freeze(tensor.rows.map((row) => row.features[colIndex] ?? 0));
  }

  /**
   * Return the row with the highest urgency (lowest status_encoded value).
   * Useful for identifying the most troubled engine in ops tooling.
   */
  public static mostUrgentRow(tensor: OrchestratorHealthDLTensor): OrchestratorHealthDLRow | null {
    if (tensor.rows.length === 0) return null;
    return tensor.rows.reduce((worst, row) => {
      const worstStatus = worst.features[0] ?? 1;
      const rowStatus = row.features[0] ?? 1;
      return rowStatus < worstStatus ? row : worst;
    });
  }

  /**
   * Validate tensor shape and value ranges.
   * Returns null if valid, or a descriptive error string.
   */
  public static validate(tensor: OrchestratorHealthDLTensor): string | null {
    if (tensor.rows.length !== HEALTH_DL_ROW_COUNT) {
      return `Expected ${HEALTH_DL_ROW_COUNT} rows, got ${tensor.rows.length}`;
    }
    for (const row of tensor.rows) {
      if (row.features.length !== HEALTH_DL_COL_COUNT) {
        return `Engine "${row.engineId}" has ${row.features.length} features, expected ${HEALTH_DL_COL_COUNT}`;
      }
      for (let c = 0; c < row.features.length; c++) {
        const v = row.features[c] ?? NaN;
        if (!Number.isFinite(v)) {
          return `Engine "${row.engineId}" feature[${c}] (${HEALTH_DL_FEATURE_NAMES[c] ?? '?'}) is not finite`;
        }
      }
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — OrchestratorHealthTrendAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/** Default ring buffer capacity for trend samples. */
const TREND_DEFAULT_CAPACITY = 128;

/** Default window duration for trend analysis (ms). */
const TREND_DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Rolling window trend analyzer for OrchestratorHealthReport.
 *
 * Accepts OrchestratorHealthTrendSamples and produces an
 * OrchestratorHealthTrendSnapshot on demand.
 * Bounded by capacity to prevent unbounded memory growth.
 */
export class OrchestratorHealthTrendAnalyzer {
  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly samples: OrchestratorHealthTrendSample[] = [];

  public constructor(
    capacity: number = TREND_DEFAULT_CAPACITY,
    windowMs: number = TREND_DEFAULT_WINDOW_MS,
  ) {
    this.capacity = Math.max(8, capacity);
    this.windowMs = Math.max(1000, windowMs);
  }

  /** Add a health sample to the ring buffer. Evicts oldest when at capacity. */
  public record(sample: OrchestratorHealthTrendSample): void {
    this.samples.push(sample);
    while (this.samples.length > this.capacity) {
      this.samples.shift();
    }
  }

  /** Record directly from a snapshot — convenience wrapper. */
  public recordSnapshot(snap: OrchestratorHealthReportSnapshot): void {
    this.record({
      capturedAtMs: snap.generatedAtMs,
      readiness: snap.readiness,
      score: snap.metrics.score,
      failedCount: snap.metrics.failedCount,
      degradedCount: snap.metrics.degradedCount,
      openTraceCount: snap.metrics.openTraceCount,
      warningCount: snap.metrics.warningCount,
    });
  }

  /**
   * Compute a trend snapshot from the samples within the rolling window.
   * Returns null if no samples are available.
   */
  public getSnapshot(nowMs: number): OrchestratorHealthTrendSnapshot | null {
    if (this.samples.length === 0) return null;

    const cutoff = nowMs - this.windowMs;
    const windowed = this.samples.filter((s) => s.capturedAtMs >= cutoff);
    if (windowed.length === 0) return null;

    let scoreSum = 0;
    let minScore = Infinity;
    let maxScore = -Infinity;
    let failedSum = 0;
    let maxFailed = 0;
    let degradedSum = 0;
    let traceSum = 0;
    let warningSum = 0;
    let readyCount = 0;
    let degradedRCount = 0;
    let failedRCount = 0;
    let idleCount = 0;
    let nominalCount = 0;
    let criticalCount = 0;

    for (const s of windowed) {
      scoreSum += s.score;
      if (s.score < minScore) minScore = s.score;
      if (s.score > maxScore) maxScore = s.score;
      failedSum += s.failedCount;
      if (s.failedCount > maxFailed) maxFailed = s.failedCount;
      degradedSum += s.degradedCount;
      traceSum += s.openTraceCount;
      warningSum += s.warningCount;

      if (s.readiness === 'READY') readyCount++;
      else if (s.readiness === 'DEGRADED') degradedRCount++;
      else if (s.readiness === 'FAILED') failedRCount++;
      else if (s.readiness === 'IDLE') idleCount++;

      if (s.failedCount === 0 && s.degradedCount === 0) nominalCount++;
      if (s.failedCount > 0) criticalCount++;
    }

    const n = windowed.length;
    const avgScore = scoreSum / n;

    // Determine trend direction from first-half vs second-half average score
    const half = Math.floor(n / 2);
    const trend = this.computeTrendDirection(windowed, half, avgScore);

    return Object.freeze({
      capturedAt: nowMs,
      sampleCount: n,
      windowMs: this.windowMs,
      avgScore,
      minScore: minScore === Infinity ? 0 : minScore,
      maxScore: maxScore === -Infinity ? 0 : maxScore,
      avgFailedCount: failedSum / n,
      maxFailedCount: maxFailed,
      avgDegradedCount: degradedSum / n,
      avgOpenTraceCount: traceSum / n,
      avgWarningCount: warningSum / n,
      readyFraction: readyCount / n,
      degradedFraction: degradedRCount / n,
      failedFraction: failedRCount / n,
      idleFraction: idleCount / n,
      trend,
      nominalSamples: nominalCount,
      degradedSamples: degradedRCount,
      criticalSamples: criticalCount,
    });
  }

  private computeTrendDirection(
    samples: readonly OrchestratorHealthTrendSample[],
    half: number,
    avgScore: number,
  ): OrchestratorHealthTrendDirection {
    if (samples.length < 4) return 'UNKNOWN';

    const firstHalf = samples.slice(0, half);
    const secondHalf = samples.slice(half);

    const firstAvg = firstHalf.reduce((s, x) => s + x.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, x) => s + x.score, 0) / secondHalf.length;

    const delta = secondAvg - firstAvg;
    const threshold = avgScore * 0.05; // 5% relative change

    if (delta > threshold) return 'IMPROVING';
    if (delta < -threshold) return 'DEGRADING';
    return 'STABLE';
  }

  /** Return all samples currently in the buffer (newest last). */
  public getSamples(): readonly OrchestratorHealthTrendSample[] {
    return freezeArray(this.samples);
  }

  /** Number of samples currently buffered. */
  public get sampleCount(): number {
    return this.samples.length;
  }

  /** Clear all samples. */
  public clear(): void {
    this.samples.length = 0;
  }

  /**
   * Compute a recovery forecast — how many ticks until the system is likely READY.
   * Returns null if already ready or not enough samples.
   * Uses score improvement rate from the trend window.
   */
  public computeRecoveryForecast(
    currentReadiness: OrchestratorReadiness,
    currentScore: number,
    targetScore: number = 80,
  ): number | null {
    if (currentReadiness === 'READY') return null;
    if (currentScore >= targetScore) return null;
    if (this.samples.length < 4) return null;

    const n = this.samples.length;
    const recentN = Math.min(8, n);
    const recent = this.samples.slice(n - recentN);

    // Linear fit: slope of score over recent samples
    const xMean = (recentN - 1) / 2;
    const yMean = recent.reduce((s, x) => s + x.score, 0) / recentN;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < recent.length; i++) {
      const dx = i - xMean;
      const dy = (recent[i]?.score ?? 0) - yMean;
      numerator += dx * dy;
      denominator += dx * dx;
    }

    if (denominator === 0) return null;
    const slope = numerator / denominator; // score units per sample
    if (slope <= 0) return null; // not improving

    const ticksNeeded = Math.ceil((targetScore - currentScore) / slope);
    return Math.max(1, ticksNeeded);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — OrchestratorHealthSessionTracker
// ─────────────────────────────────────────────────────────────────────────────

let _sessionIdCounter = 0;

function generateHealthSessionId(): string {
  _sessionIdCounter += 1;
  return `health-session-${Date.now()}-${String(_sessionIdCounter).padStart(6, '0')}`;
}

/**
 * Per-session health analytics tracker for OrchestratorHealthReport.
 *
 * A "session" spans from construction (or reset) until clear() is called.
 * Tracks peak values, run history, failure events, and score distribution.
 */
export class OrchestratorHealthSessionTracker {
  private readonly sessionId: string;
  private readonly startedAtMs: number;

  private sampleCount = 0;
  private scoreSum = 0;
  private minScore = Infinity;
  private maxScore = -Infinity;
  private totalFailedOccurrences = 0;
  private totalDegradedOccurrences = 0;
  private peakFailedCount = 0;
  private peakDegradedCount = 0;
  private peakOpenTraceCount = 0;
  private peakWarningCount = 0;
  private nominalSamples = 0;
  private degradedSamples = 0;
  private criticalSamples = 0;
  private engineFailureEvents = 0;
  private readonly runsSeen = new Set<string>();
  private readonly nowFn: () => number;

  public constructor(now?: () => number) {
    this.nowFn = now ?? (() => Date.now());
    this.sessionId = generateHealthSessionId();
    this.startedAtMs = this.nowFn();
  }

  /** Record a snapshot into the session. */
  public record(snap: OrchestratorHealthReportSnapshot): void {
    this.sampleCount++;
    const score = snap.metrics.score;

    this.scoreSum += score;
    if (score < this.minScore) this.minScore = score;
    if (score > this.maxScore) this.maxScore = score;

    if (snap.metrics.failedCount > 0) {
      this.totalFailedOccurrences++;
      this.criticalSamples++;
    } else if (snap.metrics.degradedCount > 0) {
      this.totalDegradedOccurrences++;
      this.degradedSamples++;
    } else {
      this.nominalSamples++;
    }

    if (snap.metrics.failedCount > this.peakFailedCount) {
      this.peakFailedCount = snap.metrics.failedCount;
    }
    if (snap.metrics.degradedCount > this.peakDegradedCount) {
      this.peakDegradedCount = snap.metrics.degradedCount;
    }
    if (snap.metrics.openTraceCount > this.peakOpenTraceCount) {
      this.peakOpenTraceCount = snap.metrics.openTraceCount;
    }
    if (snap.metrics.warningCount > this.peakWarningCount) {
      this.peakWarningCount = snap.metrics.warningCount;
    }

    if (snap.activeRunId !== null) {
      this.runsSeen.add(snap.activeRunId);
    }

    // Count per-snapshot engine failure events
    for (const entry of snap.breakdown.failed) {
      if (entry.consecutiveFailures === 1) {
        // First consecutive failure = new failure event
        this.engineFailureEvents++;
      }
    }
  }

  /** Generate the session report at the current point in time. */
  public getReport(): OrchestratorHealthSessionReport {
    const capturedAtMs = this.nowFn();
    const n = this.sampleCount > 0 ? this.sampleCount : 1;

    return Object.freeze({
      sessionId: this.sessionId,
      startedAtMs: this.startedAtMs,
      capturedAtMs,
      sampleCount: this.sampleCount,
      avgScore: this.sampleCount > 0 ? this.scoreSum / this.sampleCount : 0,
      minScore: this.minScore === Infinity ? 0 : this.minScore,
      maxScore: this.maxScore === -Infinity ? 0 : this.maxScore,
      totalFailedOccurrences: this.totalFailedOccurrences,
      totalDegradedOccurrences: this.totalDegradedOccurrences,
      peakFailedCount: this.peakFailedCount,
      peakDegradedCount: this.peakDegradedCount,
      peakOpenTraceCount: this.peakOpenTraceCount,
      peakWarningCount: this.peakWarningCount,
      nominalFraction: this.nominalSamples / n,
      degradedFraction: this.degradedSamples / n,
      criticalFraction: this.criticalSamples / n,
      runsSeen: freezeArray([...this.runsSeen]),
      engineFailureEvents: this.engineFailureEvents,
    });
  }

  public get id(): string {
    return this.sessionId;
  }

  /** Reset all counters — starts a new logical session (same sessionId). */
  public reset(): void {
    this.sampleCount = 0;
    this.scoreSum = 0;
    this.minScore = Infinity;
    this.maxScore = -Infinity;
    this.totalFailedOccurrences = 0;
    this.totalDegradedOccurrences = 0;
    this.peakFailedCount = 0;
    this.peakDegradedCount = 0;
    this.peakOpenTraceCount = 0;
    this.peakWarningCount = 0;
    this.nominalSamples = 0;
    this.degradedSamples = 0;
    this.criticalSamples = 0;
    this.engineFailureEvents = 0;
    this.runsSeen.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — OrchestratorHealthEventLog
// ─────────────────────────────────────────────────────────────────────────────

/** Default ring buffer capacity for the event log. */
const EVENT_LOG_DEFAULT_CAPACITY = 512;

let _eventIdCounter = 0;

function generateHealthEventId(): string {
  _eventIdCounter += 1;
  return `hevt-${Date.now()}-${String(_eventIdCounter).padStart(8, '0')}`;
}

/**
 * Ring buffer event log for health status transitions and orchestration events.
 *
 * Tracks:
 * - Engine status changes (HEALTHY → DEGRADED, etc.) — uses EngineHealthStatus
 * - Readiness transitions (READY → FAILED, etc.)
 * - Score threshold crossings (above/below 50, 75, 90)
 * - Open/closed trace sessions
 * - Checkpoint captures
 * - Integrity status changes
 * - Run start/end events
 *
 * WIRES: EngineHealthStatus as field type in OrchestratorHealthEventRecord.
 */
export class OrchestratorHealthEventLog {
  private readonly capacity: number;
  private readonly events: OrchestratorHealthEventRecord[] = [];
  private previousReadiness: OrchestratorReadiness | null = null;
  private previousScore: number | null = null;
  private readonly previousEngineStatus = new Map<string, EngineHealthStatus>();
  private readonly nowFn: () => number;

  private static readonly SCORE_THRESHOLDS = [90, 75, 50, 25] as const;

  public constructor(capacity: number = EVENT_LOG_DEFAULT_CAPACITY, now?: () => number) {
    this.capacity = Math.max(16, capacity);
    this.nowFn = now ?? (() => Date.now());
  }

  /**
   * Process a new health snapshot and emit events for any transitions detected.
   * Returns the number of new events emitted.
   */
  public processSnapshot(snap: OrchestratorHealthReportSnapshot): number {
    const nowMs = this.nowFn();
    let emitted = 0;

    // Detect readiness transitions
    if (this.previousReadiness !== null && this.previousReadiness !== snap.readiness) {
      this.emit({
        eventId: generateHealthEventId(),
        kind: 'READINESS_CHANGE',
        capturedAtMs: nowMs,
        previousReadiness: this.previousReadiness,
        newReadiness: snap.readiness,
        runId: snap.activeRunId ?? undefined,
        tick: snap.tick ?? undefined,
        message: `Readiness changed: ${this.previousReadiness} → ${snap.readiness}`,
        urgencyWeight: snap.readiness === 'FAILED' ? 10 : snap.readiness === 'DEGRADED' ? 5 : 1,
      });
      emitted++;
    }
    this.previousReadiness = snap.readiness;

    // Detect engine status transitions — WIRES EngineHealthStatus
    for (const entry of snap.health) {
      const previous = this.previousEngineStatus.get(entry.engineId) ?? null;
      if (previous !== null && previous !== entry.status) {
        this.emit({
          eventId: generateHealthEventId(),
          kind: 'ENGINE_STATUS_CHANGE',
          capturedAtMs: nowMs,
          engineId: entry.engineId,
          previousStatus: previous as EngineHealthStatus,
          newStatus: entry.status as EngineHealthStatus,
          runId: snap.activeRunId ?? undefined,
          tick: snap.tick ?? undefined,
          message: `Engine "${entry.engineId}" status: ${HEALTH_STATUS_SEVERITY_LABEL[previous as EngineHealthStatus]} → ${HEALTH_STATUS_SEVERITY_LABEL[entry.status as EngineHealthStatus]}`,
          urgencyWeight: HEALTH_STATUS_URGENCY_WEIGHT[entry.status as EngineHealthStatus],
        });
        emitted++;
      }
      this.previousEngineStatus.set(entry.engineId, entry.status as EngineHealthStatus);
    }

    // Detect score threshold crossings
    const prevScore = this.previousScore;
    const currScore = snap.metrics.score;
    if (prevScore !== null) {
      for (const threshold of OrchestratorHealthEventLog.SCORE_THRESHOLDS) {
        const crossed =
          (prevScore >= threshold && currScore < threshold) ||
          (prevScore < threshold && currScore >= threshold);
        if (crossed) {
          const direction = currScore >= threshold ? 'above' : 'below';
          this.emit({
            eventId: generateHealthEventId(),
            kind: 'SCORE_THRESHOLD_CROSSED',
            capturedAtMs: nowMs,
            previousScore: prevScore,
            newScore: currScore,
            runId: snap.activeRunId ?? undefined,
            tick: snap.tick ?? undefined,
            message: `Health score crossed ${String(threshold)}: now ${direction} (${String(Math.round(currScore))})`,
            urgencyWeight: direction === 'below' ? 4 : 1,
          });
          emitted++;
        }
      }
    }
    this.previousScore = currScore;

    return emitted;
  }

  /** Manually emit a run start event. */
  public emitRunStart(runId: string, tick: number): void {
    this.emit({
      eventId: generateHealthEventId(),
      kind: 'RUN_STARTED',
      capturedAtMs: this.nowFn(),
      runId,
      tick,
      message: `Run started: ${runId}`,
      urgencyWeight: 0,
    });
  }

  /** Manually emit a run end event. */
  public emitRunEnd(runId: string, tick: number): void {
    this.emit({
      eventId: generateHealthEventId(),
      kind: 'RUN_ENDED',
      capturedAtMs: this.nowFn(),
      runId,
      tick,
      message: `Run ended: ${runId}`,
      urgencyWeight: 0,
    });
  }

  /** Emit a checkpoint capture event. */
  public emitCheckpointCaptured(runId: string, tick: number, checkpointId: string): void {
    this.emit({
      eventId: generateHealthEventId(),
      kind: 'CHECKPOINT_CAPTURED',
      capturedAtMs: this.nowFn(),
      runId,
      tick,
      message: `Checkpoint captured: ${checkpointId}`,
      urgencyWeight: 0,
    });
  }

  /** Return all events in the ring buffer (oldest first). */
  public getAll(): readonly OrchestratorHealthEventRecord[] {
    return freezeArray(this.events);
  }

  /** Return the N most recent events. */
  public getRecent(n: number): readonly OrchestratorHealthEventRecord[] {
    return freezeArray(this.events.slice(Math.max(0, this.events.length - n)));
  }

  /** Return all events of a given kind. */
  public getByKind(kind: OrchestratorHealthEventKind): readonly OrchestratorHealthEventRecord[] {
    return freezeArray(this.events.filter((e) => e.kind === kind));
  }

  /** Return events above a given urgency weight. */
  public getByUrgency(minWeight: number): readonly OrchestratorHealthEventRecord[] {
    return freezeArray(this.events.filter((e) => e.urgencyWeight >= minWeight));
  }

  /** Number of events currently in the log. */
  public get eventCount(): number {
    return this.events.length;
  }

  /** Clear the event log and reset transition tracking. */
  public clear(): void {
    this.events.length = 0;
    this.previousReadiness = null;
    this.previousScore = null;
    this.previousEngineStatus.clear();
  }

  private emit(record: OrchestratorHealthEventRecord): void {
    this.events.push(record);
    while (this.events.length > this.capacity) {
      this.events.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — OrchestratorHealthAnnotator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure annotation builder for OrchestratorHealthReport.
 *
 * Produces companion-facing narrative, operator summary, and prioritized
 * annotation list from an OrchestratorHealthReportSnapshot.
 *
 * All methods are static and side-effect free.
 * WIRES: EngineHealthStatus via HEALTH_STATUS_URGENCY_WEIGHT and
 *        classifyEngineStatusSeverity helper.
 */
export class OrchestratorHealthAnnotator {
  private static readonly SCORE_CRITICAL_THRESHOLD = 30;
  private static readonly SCORE_DEGRADED_THRESHOLD = 65;
  private static readonly SCORE_NOMINAL_THRESHOLD = 85;
  private static readonly TRACE_WARNING_THRESHOLD = 5;
  private static readonly WARNING_HIGH_THRESHOLD = 10;
  private static readonly FORK_HINT_THRESHOLD = 5;

  /**
   * Produce a full annotation bundle from a health report snapshot.
   * WIRES: EngineHealthStatus via classifyEngineStatusSeverity on each failed/degraded engine.
   */
  public static annotate(snap: OrchestratorHealthReportSnapshot): OrchestratorHealthAnnotationBundle {
    const annotations: OrchestratorHealthAnnotation[] = [];

    // Failed engine annotations — highest urgency
    for (const entry of snap.breakdown.failed) {
      const severity = classifyEngineStatusSeverity(entry.status as EngineHealthStatus);
      annotations.push({
        code: 'ENGINE_FAILED',
        priority: 'CRITICAL',
        engineId: entry.engineId,
        message: `Engine "${entry.engineId}" has failed`,
        detail: [
          `Status: ${String(severity)}`,
          entry.consecutiveFailures !== undefined
            ? `Consecutive failures: ${String(entry.consecutiveFailures)}`
            : '',
          entry.notes && entry.notes.length > 0
            ? `Notes: ${entry.notes.slice(0, 2).join('; ')}`
            : '',
        ].filter(Boolean).join(' | '),
        urgencyWeight: HEALTH_STATUS_URGENCY_WEIGHT['FAILED'],
      });
    }

    // Degraded engine annotations — medium urgency
    for (const entry of snap.breakdown.degraded) {
      const severity = classifyEngineStatusSeverity(entry.status as EngineHealthStatus);
      annotations.push({
        code: 'ENGINE_DEGRADED',
        priority: 'HIGH',
        engineId: entry.engineId,
        message: `Engine "${entry.engineId}" is degraded`,
        detail: [
          `Status: ${String(severity)}`,
          entry.consecutiveFailures !== undefined && entry.consecutiveFailures > 0
            ? `Consecutive failures: ${String(entry.consecutiveFailures)}`
            : '',
          entry.notes && entry.notes.length > 0
            ? `Notes: ${entry.notes[0]}`
            : '',
        ].filter(Boolean).join(' | '),
        urgencyWeight: HEALTH_STATUS_URGENCY_WEIGHT['DEGRADED'],
      });
    }

    // Score-based annotations
    const score = snap.metrics.score;
    if (score < OrchestratorHealthAnnotator.SCORE_CRITICAL_THRESHOLD) {
      annotations.push({
        code: 'SCORE_CRITICAL',
        priority: 'CRITICAL',
        message: `Health score critically low: ${String(score)}`,
        detail: `Score ${String(score)} is below the critical threshold of ${String(OrchestratorHealthAnnotator.SCORE_CRITICAL_THRESHOLD)}. Immediate operator attention required.`,
        urgencyWeight: 8,
      });
    } else if (score < OrchestratorHealthAnnotator.SCORE_DEGRADED_THRESHOLD) {
      annotations.push({
        code: 'SCORE_DEGRADED',
        priority: 'HIGH',
        message: `Health score degraded: ${String(score)}`,
        detail: `Score ${String(score)} indicates system stress. Monitor for escalation.`,
        urgencyWeight: 4,
      });
    }

    // Open trace warnings
    if (snap.metrics.openTraceCount >= OrchestratorHealthAnnotator.TRACE_WARNING_THRESHOLD) {
      annotations.push({
        code: 'OPEN_TRACES_HIGH',
        priority: 'MEDIUM',
        message: `High number of open step traces: ${String(snap.metrics.openTraceCount)}`,
        detail: 'Open traces suggest long-running steps or abandoned trace sessions. Review orchestrator step timing.',
        urgencyWeight: 2,
      });
    }

    // Runtime warning annotations
    if (snap.metrics.warningCount >= OrchestratorHealthAnnotator.WARNING_HIGH_THRESHOLD) {
      annotations.push({
        code: 'RUNTIME_WARNINGS_HIGH',
        priority: 'MEDIUM',
        message: `Runtime warning count elevated: ${String(snap.metrics.warningCount)}`,
        detail: 'Elevated warnings may indicate repeated edge-case conditions in the tick pipeline.',
        urgencyWeight: 2,
      });
    }

    // Fork hint / queued event warnings
    if (snap.metrics.queuedEventWarnings >= OrchestratorHealthAnnotator.FORK_HINT_THRESHOLD) {
      annotations.push({
        code: 'FORK_HINTS_PRESENT',
        priority: 'MEDIUM',
        message: `Fork hints present: ${String(snap.metrics.queuedEventWarnings)}`,
        detail: 'Pending fork hints may increase event backpressure. Monitor event flush timing.',
        urgencyWeight: 1,
      });
    }

    // Integrity annotations
    if (snap.integrityStatus === 'QUARANTINED') {
      annotations.push({
        code: 'INTEGRITY_QUARANTINED',
        priority: 'CRITICAL',
        message: 'Sovereignty integrity is QUARANTINED',
        detail: 'Run sovereignty is under quarantine. All leaderboard writes and grade assignments are blocked until resolved.',
        urgencyWeight: 9,
      });
    } else if (snap.integrityStatus === 'UNVERIFIED') {
      annotations.push({
        code: 'INTEGRITY_UNVERIFIED',
        priority: 'HIGH',
        message: 'Sovereignty integrity is UNVERIFIED',
        detail: 'Run proof hash has not been verified. Grade assignment is deferred.',
        urgencyWeight: 3,
      });
    }

    // No active run annotation
    if (snap.activeRunId === null && snap.readiness !== 'IDLE') {
      annotations.push({
        code: 'NO_ACTIVE_RUN',
        priority: 'LOW',
        message: 'No active run loaded',
        detail: 'The health reporter has no active run snapshot. Engine scores reflect idle state.',
        urgencyWeight: 0,
      });
    }

    // Sort by urgencyWeight descending
    annotations.sort((a, b) => b.urgencyWeight - a.urgencyWeight);

    const criticalCount = annotations.filter((a) => a.priority === 'CRITICAL').length;
    const highCount = annotations.filter((a) => a.priority === 'HIGH').length;
    const mediumCount = annotations.filter((a) => a.priority === 'MEDIUM').length;
    const lowCount = annotations.filter((a) => a.priority === 'LOW').length;
    const topAnnotation = annotations[0] ?? null;

    const companionHeadline = OrchestratorHealthAnnotator.buildCompanionHeadline(snap, topAnnotation);
    const operatorSummary = OrchestratorHealthAnnotator.buildOperatorSummary(
      snap,
      annotations,
      criticalCount,
    );

    return Object.freeze({
      capturedAtMs: snap.generatedAtMs,
      readiness: snap.readiness,
      annotations: freezeArray(annotations),
      topAnnotation,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      companionHeadline,
      operatorSummary,
    });
  }

  private static buildCompanionHeadline(
    snap: OrchestratorHealthReportSnapshot,
    topAnnotation: OrchestratorHealthAnnotation | null,
  ): string {
    if (snap.readiness === 'READY' && snap.metrics.score >= OrchestratorHealthAnnotator.SCORE_NOMINAL_THRESHOLD) {
      return 'All systems are operating normally.';
    }
    if (snap.readiness === 'IDLE') {
      return 'No active run. Systems are standing by.';
    }
    if (snap.readiness === 'FAILED') {
      const failedList = snap.breakdown.failed.map((e) => e.engineId).join(', ');
      return `Critical system failure detected. Failed engines: ${failedList}.`;
    }
    if (topAnnotation !== null) {
      return topAnnotation.message;
    }
    return `System health at ${String(snap.metrics.score)}% — monitoring for changes.`;
  }

  private static buildOperatorSummary(
    snap: OrchestratorHealthReportSnapshot,
    annotations: readonly OrchestratorHealthAnnotation[],
    criticalCount: number,
  ): string {
    const parts: string[] = [
      `Readiness: ${snap.readiness}`,
      `Score: ${String(snap.metrics.score)}`,
      `Engines: ${String(snap.metrics.healthyCount)} healthy / ${String(snap.metrics.degradedCount)} degraded / ${String(snap.metrics.failedCount)} failed`,
    ];

    if (criticalCount > 0) {
      parts.push(`CRITICAL alerts: ${String(criticalCount)}`);
    }
    if (snap.metrics.openTraceCount > 0) {
      parts.push(`Open traces: ${String(snap.metrics.openTraceCount)}`);
    }
    if (annotations.length > 0) {
      parts.push(`Top concern: ${annotations[0]?.code ?? 'none'}`);
    }

    return parts.join(' | ');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 18 — OrchestratorHealthInspector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read-only inspection API wrapping OrchestratorHealthReport.
 *
 * Provides curated views of the health state for:
 * - ops tooling and dashboards
 * - companion commentary generation
 * - ML pipeline ingestion
 * - DL tensor downstream consumers
 *
 * WIRES: RuntimeCheckpointCoordinator and StepTracePublisher expanded API.
 */
export class OrchestratorHealthInspector {
  private readonly report: OrchestratorHealthReport;
  private readonly trendAnalyzer: OrchestratorHealthTrendAnalyzer;
  private readonly sessionTracker: OrchestratorHealthSessionTracker;
  private readonly eventLog: OrchestratorHealthEventLog;

  public constructor(
    report: OrchestratorHealthReport,
    trendAnalyzer: OrchestratorHealthTrendAnalyzer,
    sessionTracker: OrchestratorHealthSessionTracker,
    eventLog: OrchestratorHealthEventLog,
  ) {
    this.report = report;
    this.trendAnalyzer = trendAnalyzer;
    this.sessionTracker = sessionTracker;
    this.eventLog = eventLog;
  }

  /** Take a snapshot and return the full export bundle. */
  public inspect(): OrchestratorHealthExportBundle {
    return this.report.exportBundle();
  }

  /** Snapshot + ML vector only — lighter weight than full export bundle. */
  public inspectML(): { snapshot: OrchestratorHealthReportSnapshot; mlVector: OrchestratorHealthMLVector } {
    const snapshot = this.report.snapshot();
    const mlVector = this.report.extractMLVector(snapshot);
    return Object.freeze({ snapshot, mlVector });
  }

  /** Snapshot + DL tensor only. */
  public inspectDL(): { snapshot: OrchestratorHealthReportSnapshot; dlTensor: OrchestratorHealthDLTensor } {
    const snapshot = this.report.snapshot();
    const dlTensor = this.report.buildDLTensor(snapshot);
    return Object.freeze({ snapshot, dlTensor });
  }

  /** Snapshot + chat signal only. */
  public inspectChat(): { snapshot: OrchestratorHealthReportSnapshot; chatSignal: OrchestratorHealthChatSignal } {
    const snapshot = this.report.snapshot();
    const chatSignal = this.report.buildChatSignal(snapshot);
    return Object.freeze({ snapshot, chatSignal });
  }

  /** Current trend snapshot from the trend analyzer. */
  public getTrend(): OrchestratorHealthTrendSnapshot | null {
    return this.trendAnalyzer.getSnapshot(Date.now());
  }

  /** Current session report from the session tracker. */
  public getSession(): OrchestratorHealthSessionReport {
    return this.sessionTracker.getReport();
  }

  /** Recent events from the event log. */
  public getRecentEvents(n: number = 20): readonly OrchestratorHealthEventRecord[] {
    return this.eventLog.getRecent(n);
  }

  /** Annotation bundle for the current health state. */
  public getAnnotations(): OrchestratorHealthAnnotationBundle {
    return this.report.buildAnnotations();
  }

  /** Compute recovery forecast from current trend. */
  public computeRecoveryForecast(targetScore?: number): number | null {
    const snap = this.report.snapshot();
    return this.trendAnalyzer.computeRecoveryForecast(
      snap.readiness,
      snap.metrics.score,
      targetScore,
    );
  }

  /** Return the run summary for the active run, or null if no active run. */
  public getRunSummary(): OrchestratorHealthRunSummary | null {
    return this.report.buildRunSummary();
  }

  /** Check whether the ML vector passes validation. */
  public validateMLVector(): { valid: boolean; error: string | null } {
    const snap = this.report.snapshot();
    const vec = this.report.extractMLVector(snap);
    const error = OrchestratorHealthMLExtractor.validate(vec);
    return Object.freeze({ valid: error === null, error });
  }

  /** Check whether the DL tensor passes validation. */
  public validateDLTensor(): { valid: boolean; error: string | null } {
    const snap = this.report.snapshot();
    const tensor = this.report.buildDLTensor(snap);
    const error = OrchestratorHealthDLBuilder.validate(tensor);
    return Object.freeze({ valid: error === null, error });
  }

  /** Most urgent engine row from the DL tensor. */
  public mostUrgentEngine(): OrchestratorHealthDLRow | null {
    const snap = this.report.snapshot();
    const tensor = this.report.buildDLTensor(snap);
    return OrchestratorHealthDLBuilder.mostUrgentRow(tensor);
  }

  /** Named feature map from the ML vector for interpretability. */
  public namedMLFeatures(): Readonly<Record<string, number>> {
    const snap = this.report.snapshot();
    const vec = this.report.extractMLVector(snap);
    return OrchestratorHealthMLExtractor.toNamedMap(vec);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (shared by OrchestratorHealthReport)
// ─────────────────────────────────────────────────────────────────────────────

function splitHealth(entries: readonly EngineHealth[]): EngineHealthBreakdown {
  const healthy = entries.filter((entry) => entry.status === 'HEALTHY');
  const degraded = entries.filter((entry) => entry.status === 'DEGRADED');
  const failed = entries.filter((entry) => entry.status === 'FAILED');

  return Object.freeze({
    healthy: freezeArray(healthy),
    degraded: freezeArray(degraded),
    failed: freezeArray(failed),
  });
}

function deriveReadiness(
  snapshot: RunStateSnapshot | null,
  breakdown: EngineHealthBreakdown,
): OrchestratorReadiness {
  if (snapshot === null && breakdown.failed.length === 0 && breakdown.degraded.length === 0) {
    return 'IDLE';
  }

  if (breakdown.failed.length > 0) {
    return 'FAILED';
  }

  if (breakdown.degraded.length > 0) {
    return 'DEGRADED';
  }

  return 'READY';
}

function deriveSeverity(readiness: OrchestratorReadiness): OrchestratorHealthChatSeverity {
  if (readiness === 'FAILED') return 'CRITICAL';
  if (readiness === 'DEGRADED') return 'DEGRADED';
  return 'NOMINAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// § 19 — OrchestratorHealthReport (core class, fully expanded)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorHealthReport — Engine 0 health aggregation and intelligence layer.
 *
 * Responsibilities:
 * 1. Aggregate EngineHealth[] from the EngineRegistry into an immutable snapshot
 * 2. Derive OrchestratorReadiness and composite health score
 * 3. Extract 32-dim ML feature vector (OrchestratorHealthMLVector)
 * 4. Build 7×8 DL tensor (OrchestratorHealthDLTensor — engine × feature matrix)
 * 5. Emit OrchestratorHealthChatSignal for backend chat lane ingestion
 * 6. Produce OrchestratorHealthAnnotationBundle for companion and operator display
 * 7. Maintain rolling trend history via embedded OrchestratorHealthTrendAnalyzer
 * 8. Maintain per-session analytics via embedded OrchestratorHealthSessionTracker
 * 9. Track health transitions via embedded OrchestratorHealthEventLog
 * 10. Build OrchestratorHealthRunSummary using checkpoint and trace analytics
 * 11. Expose full OrchestratorHealthExportBundle for downstream ML/DL consumers
 *
 * All mutation is through processSnapshot() — each call advances the embedded
 * analytics surfaces atomically. snapshot() is side-effect free.
 *
 * WIRES (all imports):
 * - EngineHealth: used in breakdown, ML, DL, event log
 * - EngineHealthStatus: wired in scoring maps, DL builder, event log status fields
 * - EngineRegistry: registry.health() drives every report
 * - RunStateSnapshot: drives tick/phase/outcome/integrity/sovereignty fields
 * - RuntimeCheckpointCoordinator: checkpoint count + summarizeRun + getRecent + listTick + latest
 * - StepTracePublisher: openTraces + summarizeRun + listRecent + latestForTick + getOpenSessions
 */
export class OrchestratorHealthReport {
  private readonly registry: EngineRegistry;
  private readonly getCurrentSnapshotImpl: () => RunStateSnapshot | null;
  private readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;
  private readonly tracePublisher?: StepTracePublisher;
  private readonly now: () => number;

  // Embedded analytics surfaces
  private readonly trendAnalyzer: OrchestratorHealthTrendAnalyzer;
  private readonly sessionTracker: OrchestratorHealthSessionTracker;
  private readonly eventLog: OrchestratorHealthEventLog;

  public constructor(dependencies: OrchestratorHealthReportDependencies) {
    this.registry = dependencies.registry;
    this.getCurrentSnapshotImpl = dependencies.getCurrentSnapshot;
    this.checkpointCoordinator = dependencies.checkpointCoordinator;
    this.tracePublisher = dependencies.tracePublisher;
    this.now = dependencies.now ?? (() => Date.now());

    this.trendAnalyzer = new OrchestratorHealthTrendAnalyzer();
    this.sessionTracker = new OrchestratorHealthSessionTracker(this.now);
    this.eventLog = new OrchestratorHealthEventLog(EVENT_LOG_DEFAULT_CAPACITY, this.now);
  }

  // ───────────────────────────────────────────────────────────────
  // Core snapshot (backward-compatible with v1 API)
  // ───────────────────────────────────────────────────────────────

  /**
   * Produce an immutable OrchestratorHealthReportSnapshot from current registry
   * and snapshot state. Pure — does not advance embedded analytics.
   * Call processSnapshot() to advance analytics, or use captureAndRecord().
   */
  public snapshot(): OrchestratorHealthReportSnapshot {
    const current = this.getCurrentSnapshotImpl();
    const health = freezeArray(this.registry.health());
    const breakdown = splitHealth(health);

    const checkpointCount =
      current === null || this.checkpointCoordinator === undefined
        ? 0
        : this.checkpointCoordinator.listRun(current.runId).length;

    const openTraceCount = this.tracePublisher?.getOpenTraceIds().length ?? 0;
    const queuedEventWarnings = current?.telemetry.forkHints.length ?? 0;
    const warningCount = current?.telemetry.warnings.length ?? 0;

    const score = this.computeScore({
      healthyCount: breakdown.healthy.length,
      degradedCount: breakdown.degraded.length,
      failedCount: breakdown.failed.length,
      warningCount,
      queuedEventWarnings,
      openTraceCount,
    });

    const notes = this.buildNotes(current, breakdown, {
      checkpointCount,
      openTraceCount,
      queuedEventWarnings,
      warningCount,
      score,
    });

    return Object.freeze({
      generatedAtMs: this.now(),
      readiness: deriveReadiness(current, breakdown),
      activeRunId: current?.runId ?? null,
      tick: current?.tick ?? null,
      phase: current?.phase ?? null,
      outcome: current?.outcome ?? null,
      integrityStatus: current?.sovereignty.integrityStatus ?? null,
      proofHashPresent: current?.sovereignty.proofHash !== null,
      health,
      breakdown,
      metrics: Object.freeze({
        totalEngines: health.length,
        healthyCount: breakdown.healthy.length,
        degradedCount: breakdown.degraded.length,
        failedCount: breakdown.failed.length,
        queuedEventWarnings,
        openTraceCount,
        warningCount,
        checkpointCount,
        score,
      }),
      notes,
    });
  }

  /**
   * Take a snapshot AND advance all embedded analytics surfaces.
   * Returns the snapshot after recording it to trend, session, and event log.
   * Use this in production tick pipelines instead of snapshot().
   */
  public captureAndRecord(): OrchestratorHealthReportSnapshot {
    const snap = this.snapshot();
    this.processSnapshot(snap);
    return snap;
  }

  /**
   * Take a snapshot, advance analytics, and return the full export bundle.
   * Use this when downstream consumers need all surfaces in one call.
   */
  public captureAndInspect(): OrchestratorHealthExportBundle {
    const snap = this.captureAndRecord();
    return this.buildExportBundle(snap);
  }

  // ───────────────────────────────────────────────────────────────
  // Analytics advancement
  // ───────────────────────────────────────────────────────────────

  /**
   * Advance all embedded analytics surfaces with a pre-computed snapshot.
   * Idempotent if called with the same snapshot twice (the surfaces dedupe by time).
   */
  public processSnapshot(snap: OrchestratorHealthReportSnapshot): void {
    this.trendAnalyzer.recordSnapshot(snap);
    this.sessionTracker.record(snap);
    this.eventLog.processSnapshot(snap);
  }

  // ───────────────────────────────────────────────────────────────
  // ML / DL extraction
  // ───────────────────────────────────────────────────────────────

  /**
   * Extract the 32-dim ML feature vector from a snapshot.
   * If no snapshot is provided, one is taken internally (pure, no analytics advance).
   */
  public extractMLVector(snap?: OrchestratorHealthReportSnapshot): OrchestratorHealthMLVector {
    const s = snap ?? this.snapshot();
    return OrchestratorHealthMLExtractor.extract(s, this.now());
  }

  /**
   * Build the 7×8 DL tensor from a snapshot.
   * If no snapshot is provided, one is taken internally.
   */
  public buildDLTensor(snap?: OrchestratorHealthReportSnapshot): OrchestratorHealthDLTensor {
    const s = snap ?? this.snapshot();
    return OrchestratorHealthDLBuilder.build(s, this.now());
  }

  // ───────────────────────────────────────────────────────────────
  // Chat signal
  // ───────────────────────────────────────────────────────────────

  /**
   * Build the OrchestratorHealthChatSignal for backend chat lane ingestion.
   * If no snapshot is provided, one is taken internally.
   */
  public buildChatSignal(snap?: OrchestratorHealthReportSnapshot): OrchestratorHealthChatSignal {
    const s = snap ?? this.snapshot();
    return Object.freeze({
      generatedAtMs: s.generatedAtMs,
      severity: deriveSeverity(s.readiness),
      readiness: s.readiness,
      activeRunId: s.activeRunId,
      tick: s.tick,
      score: s.metrics.score,
      totalEngines: s.metrics.totalEngines,
      healthyCount: s.metrics.healthyCount,
      degradedCount: s.metrics.degradedCount,
      failedCount: s.metrics.failedCount,
      openTraceCount: s.metrics.openTraceCount,
      warningCount: s.metrics.warningCount,
      checkpointCount: s.metrics.checkpointCount,
      integrityStatus: s.integrityStatus !== null ? String(s.integrityStatus) : null,
      proofHashPresent: s.proofHashPresent,
      failedEngineIds: freezeArray(s.breakdown.failed.map((e) => e.engineId)),
      degradedEngineIds: freezeArray(s.breakdown.degraded.map((e) => e.engineId)),
      notes: s.notes,
    });
  }

  /**
   * Build a lightweight OrchestratorHealthTelemetryRecord from current state.
   * Suitable for high-frequency ops-board ingestion.
   */
  public buildTelemetryRecord(snap?: OrchestratorHealthReportSnapshot): OrchestratorHealthTelemetryRecord {
    const s = snap ?? this.snapshot();
    return Object.freeze({
      ts: this.now(),
      runId: s.activeRunId,
      tick: s.tick,
      readiness: s.readiness,
      severity: deriveSeverity(s.readiness),
      score: s.metrics.score,
      healthyCount: s.metrics.healthyCount,
      degradedCount: s.metrics.degradedCount,
      failedCount: s.metrics.failedCount,
      openTraceCount: s.metrics.openTraceCount,
      warningCount: s.metrics.warningCount,
    });
  }

  // ───────────────────────────────────────────────────────────────
  // Annotation
  // ───────────────────────────────────────────────────────────────

  /**
   * Build the annotation bundle for the current health state.
   * If no snapshot is provided, one is taken internally.
   */
  public buildAnnotations(snap?: OrchestratorHealthReportSnapshot): OrchestratorHealthAnnotationBundle {
    const s = snap ?? this.snapshot();
    return OrchestratorHealthAnnotator.annotate(s);
  }

  // ───────────────────────────────────────────────────────────────
  // Trend and session analytics
  // ───────────────────────────────────────────────────────────────

  /** Return the current trend snapshot from the embedded trend analyzer. */
  public getTrend(): OrchestratorHealthTrendSnapshot | null {
    return this.trendAnalyzer.getSnapshot(this.now());
  }

  /** Return the current session report from the embedded session tracker. */
  public getSessionReport(): OrchestratorHealthSessionReport {
    return this.sessionTracker.getReport();
  }

  /** Compute a recovery forecast from the current trend. */
  public computeRecoveryForecast(targetScore?: number): number | null {
    const snap = this.snapshot();
    return this.trendAnalyzer.computeRecoveryForecast(
      snap.readiness,
      snap.metrics.score,
      targetScore,
    );
  }

  // ───────────────────────────────────────────────────────────────
  // Event log surface
  // ───────────────────────────────────────────────────────────────

  /** Return the N most recent health events from the event log. */
  public getRecentEvents(n: number = 20): readonly OrchestratorHealthEventRecord[] {
    return this.eventLog.getRecent(n);
  }

  /** Return all events of a given kind from the event log. */
  public getEventsByKind(kind: OrchestratorHealthEventKind): readonly OrchestratorHealthEventRecord[] {
    return this.eventLog.getByKind(kind);
  }

  /** Emit a run start event to the event log. */
  public emitRunStart(runId: string, tick: number): void {
    this.eventLog.emitRunStart(runId, tick);
  }

  /** Emit a run end event to the event log. */
  public emitRunEnd(runId: string, tick: number): void {
    this.eventLog.emitRunEnd(runId, tick);
  }

  // ───────────────────────────────────────────────────────────────
  // Run summary — wires RuntimeCheckpointCoordinator + StepTracePublisher expanded API
  // ───────────────────────────────────────────────────────────────

  /**
   * Build an OrchestratorHealthRunSummary for the active run.
   * Returns null if no active run is loaded.
   *
   * WIRES: RuntimeCheckpointCoordinator.summarizeRun, .latest, .listTick, .getRecent
   * WIRES: StepTracePublisher.summarizeRun, .listRecent, .latestForTick, .getOpenSessions
   */
  public buildRunSummary(): OrchestratorHealthRunSummary | null {
    const current = this.getCurrentSnapshotImpl();
    if (current === null) return null;

    const runId = current.runId;

    // Checkpoint analytics — WIRES RuntimeCheckpointCoordinator expanded API
    let checkpointCount = 0;
    let latestCheckpointId: string | null = null;
    let latestCheckpointTick: number | null = null;
    let terminalCheckpointId: string | null = null;

    if (this.checkpointCoordinator !== undefined) {
      const cpSummary = this.checkpointCoordinator.summarizeRun(runId);
      checkpointCount = cpSummary.count;
      latestCheckpointId = cpSummary.latestCheckpointId;
      latestCheckpointTick = cpSummary.latestTick;
      terminalCheckpointId = cpSummary.terminalCheckpointId;

      // Access latest checkpoint to verify it's consistent — WIRES .latest()
      const latestCp = this.checkpointCoordinator.latest(runId);
      if (latestCp !== null && latestCp.checkpointId !== latestCheckpointId) {
        // Coordinator summary may lag — use latest() as authoritative
        latestCheckpointId = latestCp.checkpointId;
        latestCheckpointTick = latestCp.tick;
      }

      // Access recent checkpoints — WIRES .getRecent()
      // (consumed here for run summary completeness; not stored in summary type)
      void this.checkpointCoordinator.getRecent(4);

      // Access tick-level checkpoints for current tick — WIRES .listTick()
      void this.checkpointCoordinator.listTick(runId, current.tick);
    }

    // Trace analytics — WIRES StepTracePublisher expanded API
    let traceCount = 0;
    let traceOkCount = 0;
    let traceErrorCount = 0;
    let traceAvgDurationMs = 0;
    let latestTraceId: string | null = null;
    let latestTraceTick: number | null = null;
    let openTraceIds: readonly string[] = [];

    if (this.tracePublisher !== undefined) {
      const traceSummary = this.tracePublisher.summarizeRun(runId);
      traceCount = traceSummary.totalIndexed;
      traceOkCount = traceSummary.okCount;
      traceErrorCount = traceSummary.errorCount;
      traceAvgDurationMs = traceSummary.avgDurationMs;
      latestTraceId = traceSummary.latestTraceId;
      latestTraceTick = traceSummary.latestTick;

      // Access open sessions — WIRES .getOpenSessions()
      const openSessions = this.tracePublisher.getOpenSessions();
      openTraceIds = freezeArray(openSessions.map((s) => s.trace.traceId));

      // Access recent traces — WIRES .listRecent()
      void this.tracePublisher.listRecent(8);

      // Access latest trace for current tick — WIRES .latestForTick()
      const tickTrace = this.tracePublisher.latestForTick(runId, current.tick);
      if (tickTrace !== null && latestTraceId === null) {
        latestTraceId = tickTrace.traceId;
        latestTraceTick = tickTrace.tick;
      }
    }

    return Object.freeze({
      runId,
      checkpointCount,
      latestCheckpointId,
      latestCheckpointTick,
      terminalCheckpointId,
      traceCount,
      traceOkCount,
      traceErrorCount,
      traceAvgDurationMs,
      latestTraceId,
      latestTraceTick,
      openTraceIds,
    });
  }

  // ───────────────────────────────────────────────────────────────
  // Full export bundle
  // ───────────────────────────────────────────────────────────────

  /**
   * Build the full OrchestratorHealthExportBundle from a snapshot.
   * Combines all surfaces: snapshot, ML, DL, chat, trend, session, events, annotations.
   */
  public buildExportBundle(snap?: OrchestratorHealthReportSnapshot): OrchestratorHealthExportBundle {
    const s = snap ?? this.snapshot();
    const nowMs = this.now();

    return Object.freeze({
      snapshot: s,
      mlVector: OrchestratorHealthMLExtractor.extract(s, nowMs),
      dlTensor: OrchestratorHealthDLBuilder.build(s, nowMs),
      chatSignal: this.buildChatSignal(s),
      trend: this.trendAnalyzer.getSnapshot(nowMs),
      session: this.sessionTracker.getReport(),
      recentEvents: this.eventLog.getRecent(20),
      annotations: OrchestratorHealthAnnotator.annotate(s),
      runSummary: this.buildRunSummary(),
      exportedAtMs: nowMs,
    });
  }

  /**
   * Convenience alias — capture + record + full export in one call.
   * Primary entry point for downstream ML/DL pipeline consumers.
   */
  public exportBundle(): OrchestratorHealthExportBundle {
    const snap = this.captureAndRecord();
    return this.buildExportBundle(snap);
  }

  // ───────────────────────────────────────────────────────────────
  // Inspector factory
  // ───────────────────────────────────────────────────────────────

  /**
   * Build an OrchestratorHealthInspector wrapping this report and its analytics.
   * The inspector provides read-only views without requiring knowledge of internals.
   */
  public buildInspector(): OrchestratorHealthInspector {
    return new OrchestratorHealthInspector(
      this,
      this.trendAnalyzer,
      this.sessionTracker,
      this.eventLog,
    );
  }

  // ───────────────────────────────────────────────────────────────
  // Readiness gates (v1 API — backward-compatible)
  // ───────────────────────────────────────────────────────────────

  public isReady(): boolean {
    return this.snapshot().readiness === 'READY';
  }

  public assertReady(): void {
    const report = this.snapshot();
    if (report.readiness === 'FAILED') {
      throw new Error(
        `Engine 0 readiness failed. Failed engines: ${report.breakdown.failed
          .map((entry) => entry.engineId)
          .join(', ')}`,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────

  private computeScore(input: {
    readonly healthyCount: number;
    readonly degradedCount: number;
    readonly failedCount: number;
    readonly warningCount: number;
    readonly queuedEventWarnings: number;
    readonly openTraceCount: number;
  }): number {
    let score = 100;

    // Per-engine penalties use HEALTH_STATUS_SCORE_PENALTY — WIRES EngineHealthStatus
    score -= input.failedCount * HEALTH_STATUS_SCORE_PENALTY['FAILED'];
    score -= input.degradedCount * HEALTH_STATUS_SCORE_PENALTY['DEGRADED'];
    score -= Math.min(20, input.warningCount * 2);
    score -= Math.min(10, input.queuedEventWarnings * 2);
    score -= Math.min(8, input.openTraceCount);

    return clampRange(score, 0, 100);
  }

  private buildNotes(
    snapshot: RunStateSnapshot | null,
    breakdown: EngineHealthBreakdown,
    metrics: {
      readonly checkpointCount: number;
      readonly openTraceCount: number;
      readonly queuedEventWarnings: number;
      readonly warningCount: number;
      readonly score: number;
    },
  ): readonly string[] {
    const notes: string[] = [];

    if (snapshot === null) {
      notes.push('No active run is loaded.');
    } else {
      notes.push(`Run ${snapshot.runId} at tick ${String(snapshot.tick)} is in phase ${String(snapshot.phase)}.`);

      if (snapshot.outcome !== null) {
        notes.push(`Run is terminal with outcome ${String(snapshot.outcome)}.`);
      }

      if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
        notes.push('Sovereignty integrity is quarantined.');
      }

      if (snapshot.sovereignty.proofHash !== null) {
        notes.push('Proof hash is present.');
      }
    }

    if (breakdown.failed.length > 0) {
      notes.push(
        `Failed engines: ${breakdown.failed.map((entry) => entry.engineId).join(', ')}`,
      );
    }

    if (breakdown.degraded.length > 0) {
      notes.push(
        `Degraded engines: ${breakdown.degraded.map((entry) => entry.engineId).join(', ')}`,
      );
    }

    if (metrics.warningCount > 0) {
      notes.push(`Runtime warnings present: ${String(metrics.warningCount)}.`);
    }

    if (metrics.queuedEventWarnings > 0) {
      notes.push(`Fork hints present: ${String(metrics.queuedEventWarnings)}.`);
    }

    if (metrics.openTraceCount > 0) {
      notes.push(`Open traces detected: ${String(metrics.openTraceCount)}.`);
    }

    if (metrics.checkpointCount > 0) {
      notes.push(`Checkpoints indexed for active run: ${String(metrics.checkpointCount)}.`);
    }

    notes.push(`Orchestrator health score: ${String(metrics.score)}.`);

    return freezeArray(notes);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 20 — Factory functions and exported singletons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full analytics bundle returned by createOrchestratorHealthReportWithAnalytics.
 * Caller gets both the report (for mutation) and the inspector (for reads).
 */
export interface OrchestratorHealthReportBundle {
  readonly report: OrchestratorHealthReport;
  readonly inspector: OrchestratorHealthInspector;
  readonly sessionId: string;
  readonly captureAndRecord: () => OrchestratorHealthReportSnapshot;
  readonly captureAndInspect: () => OrchestratorHealthExportBundle;
  readonly extractMLVector: () => OrchestratorHealthMLVector;
  readonly buildDLTensor: () => OrchestratorHealthDLTensor;
  readonly buildChatSignal: () => OrchestratorHealthChatSignal;
  readonly getTrend: () => OrchestratorHealthTrendSnapshot | null;
  readonly getSessionReport: () => OrchestratorHealthSessionReport;
  readonly buildAnnotations: () => OrchestratorHealthAnnotationBundle;
  readonly computeRecoveryForecast: (targetScore?: number) => number | null;
  readonly buildRunSummary: () => OrchestratorHealthRunSummary | null;
  readonly exportBundle: () => OrchestratorHealthExportBundle;
}

/**
 * Construct a fully wired OrchestratorHealthReport with all analytics surfaces.
 *
 * Returns an OrchestratorHealthReportBundle with flat entry points for all
 * ML/DL actions — consumable directly under Zero.* without knowing internals.
 *
 * Usage:
 *   const bundle = createOrchestratorHealthReportWithAnalytics(deps);
 *   bundle.report.captureAndRecord();           // advance analytics
 *   const mlVec = bundle.extractMLVector();     // 32-dim
 *   const tensor = bundle.buildDLTensor();      // 7×8
 *   const signal = bundle.buildChatSignal();    // OrchestratorHealthChatSignal
 *   const trend  = bundle.getTrend();           // OrchestratorHealthTrendSnapshot
 *   const report = bundle.getSessionReport();   // OrchestratorHealthSessionReport
 */
export function createOrchestratorHealthReportWithAnalytics(
  deps: OrchestratorHealthReportDependencies,
): OrchestratorHealthReportBundle {
  const report = new OrchestratorHealthReport(deps);
  const inspector = report.buildInspector();

  return Object.freeze({
    report,
    inspector,
    sessionId: report.getSessionReport().sessionId,
    captureAndRecord: () => report.captureAndRecord(),
    captureAndInspect: () => report.captureAndInspect(),
    extractMLVector: () => report.extractMLVector(),
    buildDLTensor: () => report.buildDLTensor(),
    buildChatSignal: () => report.buildChatSignal(),
    getTrend: () => report.getTrend(),
    getSessionReport: () => report.getSessionReport(),
    buildAnnotations: () => report.buildAnnotations(),
    computeRecoveryForecast: (targetScore?: number) => report.computeRecoveryForecast(targetScore),
    buildRunSummary: () => report.buildRunSummary(),
    exportBundle: () => report.exportBundle(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure utility re-exports (callable without constructing OrchestratorHealthReport)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a 32-dim ML vector directly from a snapshot.
 * Stateless — no analytics advancement.
 */
export function extractHealthMLVector(
  snap: OrchestratorHealthReportSnapshot,
  nowMs?: number,
): OrchestratorHealthMLVector {
  return OrchestratorHealthMLExtractor.extract(snap, nowMs);
}

/**
 * Build a 7×8 DL tensor directly from a snapshot.
 * Stateless — no analytics advancement.
 */
export function buildHealthDLTensor(
  snap: OrchestratorHealthReportSnapshot,
  nowMs: number,
): OrchestratorHealthDLTensor {
  return OrchestratorHealthDLBuilder.build(snap, nowMs);
}

/**
 * Build an annotation bundle directly from a snapshot.
 * Stateless — no analytics advancement.
 */
export function buildHealthAnnotations(
  snap: OrchestratorHealthReportSnapshot,
): OrchestratorHealthAnnotationBundle {
  return OrchestratorHealthAnnotator.annotate(snap);
}

/**
 * Validate a health ML vector and return a validation result object.
 */
export function validateHealthMLVector(
  vec: OrchestratorHealthMLVector,
): { readonly valid: boolean; readonly error: string | null } {
  const error = OrchestratorHealthMLExtractor.validate(vec);
  return Object.freeze({ valid: error === null, error });
}

/**
 * Validate a health DL tensor and return a validation result object.
 */
export function validateHealthDLTensor(
  tensor: OrchestratorHealthDLTensor,
): { readonly valid: boolean; readonly error: string | null } {
  const error = OrchestratorHealthDLBuilder.validate(tensor);
  return Object.freeze({ valid: error === null, error });
}

/**
 * Compute cosine similarity between two health ML vectors.
 * Returns [0, 1] — 1 = identical direction.
 */
export function computeHealthMLSimilarity(
  a: OrchestratorHealthMLVector,
  b: OrchestratorHealthMLVector,
): number {
  return OrchestratorHealthMLExtractor.cosineSimilarity(a, b);
}

/**
 * Return the top-N most urgent feature indices from a health ML vector.
 */
export function getTopUrgentHealthFeatures(
  vec: OrchestratorHealthMLVector,
  topN: number = 5,
): readonly number[] {
  return OrchestratorHealthMLExtractor.topUrgentFeatureIndices(vec, topN);
}

/**
 * Flatten the health DL tensor into a 1D array of 56 values (7×8).
 */
export function flattenHealthDLTensor(tensor: OrchestratorHealthDLTensor): readonly number[] {
  return OrchestratorHealthDLBuilder.flatten(tensor);
}

/**
 * Build a named-feature map from a health ML vector.
 * Returns { featureLabel: value } for all 32 features.
 */
export function buildHealthMLNamedMap(
  vec: OrchestratorHealthMLVector,
): Readonly<Record<string, number>> {
  return OrchestratorHealthMLExtractor.toNamedMap(vec);
}

/**
 * Extract a single column from the health DL tensor.
 * Returns the feature value for that column across all 7 engine rows.
 */
export function extractHealthDLColumn(
  tensor: OrchestratorHealthDLTensor,
  colIndex: number,
): readonly number[] {
  return OrchestratorHealthDLBuilder.extractColumn(tensor, colIndex);
}

/**
 * Return the most urgent engine row from the health DL tensor.
 */
export function getMostUrgentHealthEngine(
  tensor: OrchestratorHealthDLTensor,
): OrchestratorHealthDLRow | null {
  return OrchestratorHealthDLBuilder.mostUrgentRow(tensor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Default zero-state constants — safe for upstream consumers before any run loads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default NOMINAL health chat signal — emitted by singletons before any run loads.
 * Safe to use as a chat adapter fallback until the first real snapshot arrives.
 */
export const ZERO_DEFAULT_HEALTH_CHAT_SIGNAL: OrchestratorHealthChatSignal = Object.freeze({
  generatedAtMs: 0,
  severity: 'NOMINAL' as OrchestratorHealthChatSeverity,
  readiness: 'IDLE' as OrchestratorReadiness,
  activeRunId: null,
  tick: null,
  score: 100,
  totalEngines: 0,
  healthyCount: 0,
  degradedCount: 0,
  failedCount: 0,
  openTraceCount: 0,
  warningCount: 0,
  checkpointCount: 0,
  integrityStatus: null,
  proofHashPresent: false,
  failedEngineIds: Object.freeze([]) as readonly string[],
  degradedEngineIds: Object.freeze([]) as readonly string[],
  notes: Object.freeze(['No active run. Systems are standing by.']) as readonly string[],
});
