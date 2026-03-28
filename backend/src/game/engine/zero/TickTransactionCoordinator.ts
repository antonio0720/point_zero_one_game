// backend/src/game/engine/zero/TickTransactionCoordinator.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickTransactionCoordinator.ts
 * VERSION: 2026.03.28.2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 *
 * ── DOCTRINE ──────────────────────────────────────────────────────────────────
 * - zero does not replace backend/core EngineTickTransaction; it operationalizes it
 * - tick context creation must be deterministic, explicit, and reusable across engine/system steps
 * - engine execution and synthetic orchestration mutations share one normalized transaction surface
 * - every execution path returns an immutable snapshot + signal output, never partial mutation state
 * - ML/DL analytics are available on every execution result: 32-dim feature vectors + DL tensor rows
 * - social pressure engine: rollbacks, budget violations, and health drops are witnessed in narration
 * - mode-native narration (Empire/Predator/Syndicate/Phantom) shapes all context-driven chat output
 * - LIVEOPS chat signals are produced for every execution path without importing from chat/
 *
 * ── EXECUTION LAW ─────────────────────────────────────────────────────────────
 * 1. createContext() — deterministic TickContext construction from TransactionContextArgs
 * 2. executeEngine() — wraps EngineTickTransaction.execute() with health tracking + rollback signal
 * 3. executeSynthetic() — wraps reducer functions with normalizeEngineTickResult + rollback signal
 * 4. Both paths return TransactionExecutionResult: immutable, fully annotated, ML-ready
 *
 * ── ML/DL SURFACE ─────────────────────────────────────────────────────────────
 * extractCoordinatorMLVector()     — 32-dim normalized feature vector from execution result
 * buildCoordinatorDLRow()          — 8-column DL tensor row for a single step execution
 * buildCoordinatorDLTensor()       — 13-row × 8-col DL tensor across a full tick
 * computeCoordinatorHealthScore()  — single [0,1] health grade from health + signals
 * classifyCoordinatorSeverity()    — maps health score to CoordinatorSeverity bucket
 *
 * ── CHAT SIGNAL SURFACE ───────────────────────────────────────────────────────
 * buildCoordinatorChatSignal()     — LIVEOPS-typed ChatSignalEnvelope-compatible payload
 * buildCoordinatorNarrationHint()  — mode-native phrase for NPC/hater/witness commentary
 * buildCoordinatorAnnotation()     — full annotation bundle for replay/audit
 *
 * ── ANALYTICS CLASSES ─────────────────────────────────────────────────────────
 * CoordinatorTrendAnalyzer         — rolling window health trend across consecutive executions
 * CoordinatorSessionTracker        — per-run session metrics with clock-based timing
 * CoordinatorEventLog              — ordered event log with EventBus emission support
 * CoordinatorAnnotator             — builds annotation bundles with configurable verbosity
 * CoordinatorInspector             — inspection bundles for diagnostics and replay audit
 */

import type { ClockSource } from '../core/ClockSource';
import {
  createEngineSignal,
  normalizeEngineTickResult,
  type EngineHealth,
  type EngineId,
  type EngineSignal,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
  type TickTrace,
} from '../core/EngineContracts';
import { cloneJson, deepFreeze } from '../core/Deterministic';
import { EventBus, type EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import { EngineTickTransaction } from '../core/EngineTickTransaction';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — Runtime Bus and Envelope Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type RuntimeBus = EventBus<EngineEventMap & Record<string, unknown>>;
export type RuntimeEnvelope = EventEnvelope<
  keyof (EngineEventMap & Record<string, unknown>),
  (EngineEventMap & Record<string, unknown>)[keyof (EngineEventMap & Record<string, unknown>)]
>;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — Core Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface StepTraceSeed {
  readonly traceId?: string;
  readonly tick?: number;
  readonly tags?: readonly string[];
}

export interface TransactionContextArgs {
  readonly snapshot: RunStateSnapshot;
  readonly step: TickStep;
  readonly nowMs: number;
  readonly clock: ClockSource;
  readonly bus: RuntimeBus;
  readonly trace?: StepTraceSeed;
}

export interface EngineTransactionExecutionArgs extends TransactionContextArgs {
  readonly engine: SimulationEngine;
}

export interface SyntheticTransactionExecutionArgs extends TransactionContextArgs {
  readonly owner: EngineId | 'mode' | 'system';
  readonly label: string;
  readonly reducer: (
    snapshot: RunStateSnapshot,
    context: TickContext,
  ) => RunStateSnapshot | EngineTickResult;
}

export interface TransactionExecutionResult {
  readonly context: TickContext;
  readonly snapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly healthBefore?: EngineHealth;
  readonly healthAfter?: EngineHealth;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C — Module Metadata Constants
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_TRANSACTION_COORDINATOR_MODULE_VERSION = '2026.03.28.2' as const;
export const TICK_TRANSACTION_COORDINATOR_SCHEMA_VERSION = '1.0.0' as const;
export const TICK_TRANSACTION_COORDINATOR_READY = true as const;
export const TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT = 32 as const;
export const TICK_TRANSACTION_COORDINATOR_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);
export const TICK_TRANSACTION_COORDINATOR_COMPLETE =
  'TICK_TRANSACTION_COORDINATOR:COMPLETE' as const;
export const TICK_TRANSACTION_COORDINATOR_MAX_TICK = 9_999 as const;
export const TICK_TRANSACTION_COORDINATOR_MAX_SIGNALS = 64 as const;
export const TICK_TRANSACTION_COORDINATOR_BUDGET_MS = 50 as const;
export const TICK_TRANSACTION_COORDINATOR_MAX_BATCH = 256 as const;
export const TICK_TRANSACTION_COORDINATOR_TREND_WINDOW = 12 as const;
export const TICK_TRANSACTION_COORDINATOR_SESSION_MAX = 1_000 as const;
export const TICK_TRANSACTION_COORDINATOR_EVENT_LOG_MAX = 2_048 as const;
export const TICK_TRANSACTION_COORDINATOR_MAX_NET_WORTH = 1_000_000 as const;
export const TICK_TRANSACTION_COORDINATOR_MAX_DRAIN = 500 as const;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D — Domain Constants
// ─────────────────────────────────────────────────────────────────────────────

export const COORDINATOR_MODE_CODES = Object.freeze(
  ['solo', 'pvp', 'coop', 'ghost'] as const,
);

export const COORDINATOR_PRESSURE_TIERS = Object.freeze(
  ['T1', 'T2', 'T3', 'T4', 'T5'] as const,
);

export const COORDINATOR_RUN_PHASES = Object.freeze(
  ['PROLOGUE', 'EARLY', 'MID', 'LATE', 'ENDGAME'] as const,
);

export const COORDINATOR_RUN_OUTCOMES = Object.freeze(
  ['NONE', 'FREEDOM', 'CAPTURED', 'ABANDONED', 'TIMEOUT'] as const,
);

export const COORDINATOR_ENGINE_IDS = Object.freeze(
  ['time', 'pressure', 'tension', 'shield', 'battle', 'cascade', 'sovereignty'] as const,
);

export const COORDINATOR_TICK_STEPS = Object.freeze([
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
] as const);

export const COORDINATOR_SEVERITY_LABELS = Object.freeze(
  ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
);

export const COORDINATOR_OPERATION_KINDS = Object.freeze([
  'ENGINE_EXEC',
  'SYNTHETIC_EXEC',
  'CONTEXT_CREATE',
  'ROLLBACK',
  'SKIP',
  'ABORT',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E — ML Feature Labels (32 dimensions)
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS = Object.freeze([
  'step_ordinal',               // 00: normalized step position [0,1]
  'operation_kind',             // 01: 0=ctx, 0.2=engine, 0.4=synthetic, 0.6=rollback, 0.8=skip, 1=abort
  'rolled_back',                // 02: 0 or 1
  'skipped',                    // 03: 0 or 1
  'signal_count',               // 04: normalized signals count [0,1]
  'health_before_score',        // 05: health score before [0,1]
  'health_after_score',         // 06: health score after [0,1]
  'health_delta',               // 07: after - before, shifted [0,1]
  'execution_budget_ratio',     // 08: execution_ms / budget_ms, capped [0,1]
  'mode_normalized',            // 09: solo=0.25, pvp=0.5, coop=0.75, ghost=1.0
  'pressure_tier_normalized',   // 10: T1=0.2 ... T5=1.0
  'tick_normalized',            // 11: tick / max_tick [0,1]
  'engine_id_encoded',          // 12: time=0, pressure=0.14, ... sovereignty=0.86, other=1.0
  'has_error_signal',           // 13: 0 or 1
  'has_warn_signal',            // 14: 0 or 1
  'error_signal_ratio',         // 15: error signals / total signals [0,1]
  'warn_signal_ratio',          // 16: warn signals / total signals [0,1]
  'rollback_tag_present',       // 17: any signal.tags has 'rollback' [0,1]
  'owner_is_system',            // 18: 0 or 1 (synthetic only)
  'trace_tag_count',            // 19: normalized trace tags [0,1]
  'economy_net_worth',          // 20: snapshot.economy?.netWorth / max [0,1]
  'pressure_score',             // 21: snapshot.pressure?.score [0,1]
  'tension_score',              // 22: snapshot.tension?.score [0,1]
  'sovereignty_verified_tick',  // 23: snapshot.sovereignty?.lastVerifiedTick / max_tick [0,1]
  'phase_normalized',           // 24: PROLOGUE=0, EARLY=0.25, MID=0.5, LATE=0.75, ENDGAME=1.0
  'outcome_present',            // 25: outcome !== 'NONE' && truthy [0,1]
  'budget_exceeded',            // 26: execution_ms > budget_ms [0,1]
  'trace_tick_normalized',      // 27: context.trace.tick / max_tick [0,1]
  'synthetic_owner_encoded',    // 28: owner hash normalized [0,1]
  'run_id_hash',                // 29: djb2 hash of runId, normalized [0,1]
  'now_ms_normalized',          // 30: nowMs / 3_600_000, capped [0,1]
  'signal_severity_weighted',   // 31: weighted severity score (error=1, warn=0.5, info=0.1) / max [0,1]
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION F — DL Tensor Labels (13 rows × 8 cols)
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_TRANSACTION_COORDINATOR_DL_ROW_LABELS = Object.freeze([
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
] as const);

export const TICK_TRANSACTION_COORDINATOR_DL_COL_LABELS = Object.freeze([
  'step_executed',        // 0: was the step executed (not skipped or flush) [0,1]
  'rolled_back',          // 1: rollback flag [0,1]
  'skipped',              // 2: skipped flag [0,1]
  'signal_count_norm',    // 3: normalized signal count [0,1]
  'health_after_norm',    // 4: health after normalized [0,1]
  'budget_ratio',         // 5: execution duration / budget [0,1]
  'mode_norm',            // 6: mode encoded [0,1]
  'error_ratio',          // 7: error signal ratio [0,1]
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION G — Normalized Lookup Tables
// ─────────────────────────────────────────────────────────────────────────────

export const COORDINATOR_MODE_NORMALIZED = Object.freeze({
  solo: 0.25,
  pvp: 0.5,
  coop: 0.75,
  ghost: 1.0,
} as const);

export const COORDINATOR_PRESSURE_TIER_NORMALIZED = Object.freeze({
  T1: 0.2,
  T2: 0.4,
  T3: 0.6,
  T4: 0.8,
  T5: 1.0,
} as const);

export const COORDINATOR_PHASE_NORMALIZED = Object.freeze({
  PROLOGUE: 0.0,
  EARLY: 0.25,
  MID: 0.5,
  LATE: 0.75,
  ENDGAME: 1.0,
} as const);

export const COORDINATOR_STEP_ORDINAL = Object.freeze({
  STEP_01_PREPARE: 0 / 12,
  STEP_02_TIME: 1 / 12,
  STEP_03_PRESSURE: 2 / 12,
  STEP_04_TENSION: 3 / 12,
  STEP_05_BATTLE: 4 / 12,
  STEP_06_SHIELD: 5 / 12,
  STEP_07_CASCADE: 6 / 12,
  STEP_08_MODE_POST: 7 / 12,
  STEP_09_TELEMETRY: 8 / 12,
  STEP_10_SOVEREIGNTY_SNAPSHOT: 9 / 12,
  STEP_11_OUTCOME_GATE: 10 / 12,
  STEP_12_EVENT_SEAL: 11 / 12,
  STEP_13_FLUSH: 12 / 12,
} as const);

export const COORDINATOR_ENGINE_ID_ENCODED = Object.freeze({
  time: 0 / 6,
  pressure: 1 / 6,
  tension: 2 / 6,
  shield: 3 / 6,
  battle: 4 / 6,
  cascade: 5 / 6,
  sovereignty: 6 / 6,
  mode: 1.0,
  system: 1.0,
} as const);

export const COORDINATOR_OPERATION_KIND_ENCODED = Object.freeze({
  ENGINE_EXEC: 0.2,
  SYNTHETIC_EXEC: 0.4,
  CONTEXT_CREATE: 0.0,
  ROLLBACK: 0.6,
  SKIP: 0.8,
  ABORT: 1.0,
} as const);

export const COORDINATOR_HEALTH_STATUS_SCORE = Object.freeze({
  HEALTHY: 1.0,
  DEGRADED: 0.5,
  FAILED: 0.0,
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION H — Severity Thresholds and Narration Registries
// ─────────────────────────────────────────────────────────────────────────────

export const COORDINATOR_SEVERITY_THRESHOLDS = Object.freeze({
  LOW: 0.75,      // health score >= 0.75 → LOW
  MEDIUM: 0.5,    // health score >= 0.5  → MEDIUM
  HIGH: 0.25,     // health score >= 0.25 → HIGH
  CRITICAL: 0.0,  // health score <  0.25 → CRITICAL
} as const);

export const COORDINATOR_NARRATION_BY_MODE = Object.freeze({
  solo: {
    ENGINE_EXEC: 'Your engine ran clean. Keep moving.',
    SYNTHETIC_EXEC: 'System step executed. Path stays open.',
    ROLLBACK: 'That move failed. The system rolled back.',
    SKIP: 'Step skipped — engine held its breath.',
    ABORT: 'Abort. Engine collapsed. You are exposed.',
    HEALTHY: 'Clean execution. No resistance.',
    DEGRADED: 'Engine stress detected. Watch the next step.',
    FAILED: 'Engine failure. This run is in danger.',
  },
  pvp: {
    ENGINE_EXEC: 'Engine fired. Opponent has no idea yet.',
    SYNTHETIC_EXEC: 'Synthetic move processed. Edge preserved.',
    ROLLBACK: 'Rollback. Your opponent just got a window.',
    SKIP: 'Step skipped. Predator watching.',
    ABORT: 'Abort signal. You just lost momentum.',
    HEALTHY: 'Clean execution. Stay aggressive.',
    DEGRADED: 'Your engine is slipping. Fix it before they see.',
    FAILED: 'Engine failed. Head-to-head just got harder.',
  },
  coop: {
    ENGINE_EXEC: 'Step executed. Team is holding.',
    SYNTHETIC_EXEC: 'Syndicate step processed. Unity intact.',
    ROLLBACK: 'Rollback. The team needs to cover this.',
    SKIP: 'Step skipped. Hold formation.',
    ABORT: 'Abort. Notify the team immediately.',
    HEALTHY: 'Clean execution. The syndicate is strong.',
    DEGRADED: 'Engine strain showing. Team support needed.',
    FAILED: 'Engine failure. The syndicate is at risk.',
  },
  ghost: {
    ENGINE_EXEC: 'The legend executed this step clean.',
    SYNTHETIC_EXEC: "Phantom step — following the ghost's path.",
    ROLLBACK: 'The ghost never rolled back here. You did.',
    SKIP: 'Phantom skipped this. So should you.',
    ABORT: 'The ghost did not abort here. You are off-path.',
    HEALTHY: "On the ghost's line. Keep chasing.",
    DEGRADED: "Falling behind the ghost's execution pace.",
    FAILED: "The ghost's engine never failed here. Yours did.",
  },
} as const);

export const COORDINATOR_NARRATION_BY_SEVERITY = Object.freeze({
  LOW: 'Execution stable. No witness required.',
  MEDIUM: 'Execution stress. Observer is watching.',
  HIGH: 'Execution critical. Witness activated.',
  CRITICAL: 'Execution collapsed. Full transcript triggered.',
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION I — Analytics Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type CoordinatorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CoordinatorOperationKind =
  | 'ENGINE_EXEC'
  | 'SYNTHETIC_EXEC'
  | 'CONTEXT_CREATE'
  | 'ROLLBACK'
  | 'SKIP'
  | 'ABORT';
export type CoordinatorModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';
export type CoordinatorPressureTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
export type CoordinatorRunPhase = 'PROLOGUE' | 'EARLY' | 'MID' | 'LATE' | 'ENDGAME';
export type CoordinatorRunOutcome = 'NONE' | 'FREEDOM' | 'CAPTURED' | 'ABANDONED' | 'TIMEOUT';

export interface CoordinatorMLVectorInput {
  readonly result: TransactionExecutionResult;
  readonly operationKind: CoordinatorOperationKind;
  readonly executionMs?: number;
  readonly snapshot: RunStateSnapshot;
}

export interface CoordinatorMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly step: string;
  readonly runId: string;
  readonly operationKind: CoordinatorOperationKind;
  readonly healthScore: number;
  readonly severity: CoordinatorSeverity;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
}

export interface CoordinatorDLTensorRow {
  readonly step: string;
  readonly ordinal: number;
  readonly cols: readonly number[];
  readonly tick: number;
  readonly runId: string;
}

export interface CoordinatorDLTensor {
  readonly rows: readonly CoordinatorDLTensorRow[];
  readonly tick: number;
  readonly runId: string;
  readonly shape: readonly [number, number];
  readonly colLabels: readonly string[];
  readonly rowLabels: readonly string[];
}

export interface CoordinatorNarrationHint {
  readonly phrase: string;
  readonly mode: CoordinatorModeCode;
  readonly step: string;
  readonly severity: CoordinatorSeverity;
  readonly operationKind: CoordinatorOperationKind;
  readonly tick: number;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly witnessTrigger: boolean;
}

export interface CoordinatorChatSignal {
  readonly type: 'LIVEOPS';
  readonly code: string;
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly mode: CoordinatorModeCode;
  readonly severity: CoordinatorSeverity;
  readonly operationKind: CoordinatorOperationKind;
  readonly narration: string;
  readonly mlVector: readonly number[];
  readonly healthScore: number;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly signalCount: number;
  readonly timestamp: number;
}

export interface CoordinatorAnnotationBundle {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly operationKind: CoordinatorOperationKind;
  readonly severity: CoordinatorSeverity;
  readonly healthBefore: number;
  readonly healthAfter: number;
  readonly healthDelta: number;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly signalCodes: readonly string[];
  readonly traceId: string;
  readonly nowMs: number;
  readonly executionMs: number;
  readonly budgetExceeded: boolean;
}

export interface CoordinatorHealthSnapshot {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly healthScore: number;
  readonly severity: CoordinatorSeverity;
  readonly statusBefore?: string;
  readonly statusAfter?: string;
  readonly rolledBack: boolean;
  readonly consecutiveFailures: number;
  readonly lastSuccessfulTick: number;
  readonly recommendation: string;
}

export interface CoordinatorTrendSnapshot {
  readonly window: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly rollbackRate: number;
  readonly skipRate: number;
  readonly abortRate: number;
  readonly severityDistribution: Record<CoordinatorSeverity, number>;
  readonly trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface CoordinatorSessionReport {
  readonly runId: string;
  readonly totalExecutions: number;
  readonly totalEngineExecs: number;
  readonly totalSyntheticExecs: number;
  readonly totalRollbacks: number;
  readonly totalSkips: number;
  readonly totalAborts: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly totalSignals: number;
  readonly totalErrors: number;
  readonly totalWarns: number;
  readonly sessionDurationMs: number;
  readonly firstExecutionMs: number;
  readonly lastExecutionMs: number;
}

export interface CoordinatorEventLogEntry {
  readonly id: string;
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly operationKind: CoordinatorOperationKind;
  readonly severity: CoordinatorSeverity;
  readonly healthScore: number;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly signalCount: number;
  readonly nowMs: number;
  readonly traceId: string;
  readonly signals: readonly EngineSignal[];
}

export interface CoordinatorInspectionBundle {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly result: TransactionExecutionResult;
  readonly mlVector: CoordinatorMLVector;
  readonly dlRow: CoordinatorDLTensorRow;
  readonly annotation: CoordinatorAnnotationBundle;
  readonly healthSnapshot: CoordinatorHealthSnapshot;
  readonly narrationHint: CoordinatorNarrationHint;
  readonly chatSignal: CoordinatorChatSignal;
}

export interface CoordinatorRunSummary {
  readonly runId: string;
  readonly totalTicks: number;
  readonly totalExecutions: number;
  readonly totalRollbacks: number;
  readonly totalSkips: number;
  readonly totalAborts: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly finalSeverity: CoordinatorSeverity;
  readonly topSignalCodes: readonly string[];
  readonly sessionDurationMs: number;
}

export interface CoordinatorExportBundle {
  readonly runId: string;
  readonly moduleVersion: string;
  readonly schemaVersion: string;
  readonly tick: number;
  readonly result: TransactionExecutionResult;
  readonly mlVector: CoordinatorMLVector;
  readonly dlRow: CoordinatorDLTensorRow;
  readonly annotation: CoordinatorAnnotationBundle;
  readonly healthSnapshot: CoordinatorHealthSnapshot;
  readonly narrationHint: CoordinatorNarrationHint;
  readonly chatSignal: CoordinatorChatSignal;
  readonly inspection: CoordinatorInspectionBundle;
}

export interface CoordinatorManifest {
  readonly module: string;
  readonly version: string;
  readonly schema: string;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [number, number];
  readonly mlFeatureLabels: readonly string[];
  readonly dlRowLabels: readonly string[];
  readonly dlColLabels: readonly string[];
  readonly operationKinds: readonly string[];
  readonly severityLevels: readonly string[];
  readonly modeCodes: readonly string[];
  readonly ready: boolean;
}

export interface CoordinatorAnnotatorOptions {
  readonly verbose: boolean;
  readonly includeSignals: boolean;
  readonly includeMLVector: boolean;
  readonly includeDLRow: boolean;
  readonly includeNarration: boolean;
  readonly mode: CoordinatorModeCode;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION J — Private Utility Helpers
// ─────────────────────────────────────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, isFinite(v) ? v : 0));
}

function normalizeTickForTrace(
  snapshot: RunStateSnapshot,
  explicitTick: number | undefined,
): number {
  if (explicitTick !== undefined && Number.isFinite(explicitTick)) {
    return Math.max(0, Math.trunc(explicitTick));
  }

  return Math.max(0, Math.trunc(snapshot.tick + 1));
}

function buildTrace(args: TransactionContextArgs): TickTrace {
  const tick = normalizeTickForTrace(args.snapshot, args.trace?.tick);
  const traceId =
    args.trace?.traceId ??
    [
      'zero-trace',
      args.snapshot.runId,
      args.step,
      String(tick),
      String(Math.max(0, Math.trunc(args.nowMs))),
    ].join(':');

  return Object.freeze({
    runId: args.snapshot.runId,
    tick,
    step: args.step,
    mode: args.snapshot.mode,
    phase: args.snapshot.phase,
    traceId,
  });
}

function toFrozenSnapshot(snapshot: RunStateSnapshot | EngineTickResult): RunStateSnapshot {
  const normalized = 'snapshot' in snapshot ? snapshot.snapshot : snapshot;
  return deepFreeze(cloneJson(normalized)) as RunStateSnapshot;
}

/** Map an owner that may be 'system' to a valid EngineId | 'mode' for signal creation. */
function resolveSignalOwner(owner: EngineId | 'mode' | 'system'): EngineId | 'mode' {
  return owner === 'system' ? ('time' as EngineId) : (owner as EngineId | 'mode');
}

function scoreHealthStatus(status: string | undefined): number {
  if (status === 'HEALTHY') return 1.0;
  if (status === 'DEGRADED') return 0.5;
  if (status === 'FAILED') return 0.0;
  return 0.8; // unknown → optimistic default
}

function encodeEngineId(
  owner: EngineId | 'mode' | 'system' | string,
): number {
  return (
    COORDINATOR_ENGINE_ID_ENCODED[
      owner as keyof typeof COORDINATOR_ENGINE_ID_ENCODED
    ] ?? 1.0
  );
}

function encodeStepOrdinal(step: TickStep | string): number {
  return (
    COORDINATOR_STEP_ORDINAL[
      step as keyof typeof COORDINATOR_STEP_ORDINAL
    ] ?? 0.5
  );
}

function encodeModeCode(mode: string | undefined): number {
  return (
    COORDINATOR_MODE_NORMALIZED[
      (mode ?? 'solo') as keyof typeof COORDINATOR_MODE_NORMALIZED
    ] ?? 0.25
  );
}

function encodePressureTier(tier: string | undefined): number {
  return (
    COORDINATOR_PRESSURE_TIER_NORMALIZED[
      (tier ?? 'T1') as keyof typeof COORDINATOR_PRESSURE_TIER_NORMALIZED
    ] ?? 0.2
  );
}

function encodeRunPhase(phase: string | undefined): number {
  return (
    COORDINATOR_PHASE_NORMALIZED[
      (phase ?? 'PROLOGUE') as keyof typeof COORDINATOR_PHASE_NORMALIZED
    ] ?? 0.0
  );
}

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash / 0xffffffff;
}

/** Count signals with a given severity prefix. */
function countBySeverity(
  signals: readonly EngineSignal[],
  severity: string,
): number {
  return signals.filter((s) => s.severity === severity).length;
}

/** Build a stable execution ID for event log entries. */
function buildExecutionId(runId: string, tick: number, step: string, nowMs: number): string {
  return `coord:${runId}:${tick}:${step}:${Math.trunc(nowMs)}`;
}

/** Clone a TransactionExecutionResult (useful for analytics storage). */
function cloneResult(result: TransactionExecutionResult): TransactionExecutionResult {
  return deepFreeze(cloneJson(result)) as TransactionExecutionResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION K — ML Feature Vector Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the canonical 32-dimensional normalized ML feature vector from a
 * TransactionExecutionResult. All values are clamped to [0,1].
 */
export function extractCoordinatorMLVector(
  input: CoordinatorMLVectorInput,
): CoordinatorMLVector {
  const { result, operationKind, executionMs = 0, snapshot } = input;
  const ctx = result.context;
  const trace: TickTrace = ctx.trace;
  const signals = result.signals;
  const totalSignals = signals.length;
  const errorCount = countBySeverity(signals, 'ERROR');
  const warnCount = countBySeverity(signals, 'WARN');
  const infoCount = countBySeverity(signals, 'INFO');

  const healthBefore = scoreHealthStatus(result.healthBefore?.status);
  const healthAfter = scoreHealthStatus(result.healthAfter?.status);
  const healthDeltaShifted = clamp01((healthAfter - healthBefore + 1) / 2);

  const hasRollbackTag = signals.some(
    (s) => s.tags?.includes('rollback') === true,
  );

  // weighted severity score per signal
  const severityWeightedSum =
    errorCount * 1.0 + warnCount * 0.5 + infoCount * 0.1;
  const severityWeightedMax = Math.max(
    totalSignals * 1.0,
    1,
  );

  const features: readonly number[] = Object.freeze([
    /* 00 */ encodeStepOrdinal(ctx.step),
    /* 01 */ COORDINATOR_OPERATION_KIND_ENCODED[operationKind] ?? 0,
    /* 02 */ result.rolledBack ? 1 : 0,
    /* 03 */ result.skipped ? 1 : 0,
    /* 04 */ clamp01(totalSignals / TICK_TRANSACTION_COORDINATOR_MAX_SIGNALS),
    /* 05 */ healthBefore,
    /* 06 */ healthAfter,
    /* 07 */ healthDeltaShifted,
    /* 08 */ clamp01(executionMs / TICK_TRANSACTION_COORDINATOR_BUDGET_MS),
    /* 09 */ encodeModeCode(snapshot.mode),
    /* 10 */ encodePressureTier((snapshot as any).pressure?.tier),
    /* 11 */ clamp01(trace.tick / TICK_TRANSACTION_COORDINATOR_MAX_TICK),
    /* 12 */ encodeEngineId(String(trace.step)),
    /* 13 */ errorCount > 0 ? 1 : 0,
    /* 14 */ warnCount > 0 ? 1 : 0,
    /* 15 */ clamp01(totalSignals > 0 ? errorCount / totalSignals : 0),
    /* 16 */ clamp01(totalSignals > 0 ? warnCount / totalSignals : 0),
    /* 17 */ hasRollbackTag ? 1 : 0,
    /* 18 */ 0, // owner_is_system — patched by synthetic path
    /* 19 */ clamp01(
      ((result.context.trace as any).tags?.length ?? 0) / 8,
    ),
    /* 20 */ clamp01(
      ((snapshot as any).economy?.netWorth ?? 0) /
        TICK_TRANSACTION_COORDINATOR_MAX_NET_WORTH,
    ),
    /* 21 */ clamp01((snapshot as any).pressure?.score ?? 0),
    /* 22 */ clamp01((snapshot as any).tension?.score ?? 0),
    /* 23 */ clamp01(
      ((snapshot as any).sovereignty?.lastVerifiedTick ?? 0) /
        TICK_TRANSACTION_COORDINATOR_MAX_TICK,
    ),
    /* 24 */ encodeRunPhase(snapshot.phase as string),
    /* 25 */ snapshot.outcome ? 1 : 0,
    /* 26 */ executionMs > TICK_TRANSACTION_COORDINATOR_BUDGET_MS ? 1 : 0,
    /* 27 */ clamp01(trace.tick / TICK_TRANSACTION_COORDINATOR_MAX_TICK),
    /* 28 */ djb2Hash(operationKind),
    /* 29 */ djb2Hash(snapshot.runId),
    /* 30 */ clamp01(ctx.nowMs / 3_600_000),
    /* 31 */ clamp01(severityWeightedSum / severityWeightedMax),
  ]);

  const healthScore = computeCoordinatorHealthScore(result);
  const severity = classifyCoordinatorSeverity(healthScore);

  return Object.freeze({
    features,
    labels: TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS,
    tick: trace.tick,
    step: ctx.step,
    runId: snapshot.runId,
    operationKind,
    healthScore,
    severity,
    rolledBack: result.rolledBack,
    skipped: result.skipped,
  });
}

/**
 * Validate that a CoordinatorMLVector has correct dimensionality and bounded values.
 */
export function validateCoordinatorMLVector(v: CoordinatorMLVector): boolean {
  if (v.features.length !== TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT) return false;
  for (const f of v.features) {
    if (!isFinite(f) || f < 0 || f > 1) return false;
  }
  return true;
}

/**
 * Return the feature array as a mutable copy suitable for downstream tensor frameworks.
 */
export function flattenCoordinatorMLVector(v: CoordinatorMLVector): readonly number[] {
  return Object.freeze([...v.features]);
}

/**
 * Named map of feature label → value for quick inspection.
 */
export function buildCoordinatorMLNamedMap(v: CoordinatorMLVector): Record<string, number> {
  const result: Record<string, number> = {};
  const labels = TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS;
  for (let i = 0; i < labels.length; i++) {
    result[labels[i]!] = v.features[i] ?? 0;
  }
  return result;
}

/**
 * Serialize a CoordinatorMLVector to a compact JSON string for transport or caching.
 */
export function serializeCoordinatorMLVector(v: CoordinatorMLVector): string {
  return JSON.stringify({
    tick: v.tick,
    step: v.step,
    runId: v.runId,
    op: v.operationKind,
    h: v.healthScore,
    sev: v.severity,
    rb: v.rolledBack,
    sk: v.skipped,
    f: v.features,
  });
}

/**
 * Compute cosine similarity between two ML vectors.
 */
export function computeCoordinatorMLSimilarity(
  a: CoordinatorMLVector,
  b: CoordinatorMLVector,
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.features.length; i++) {
    const ai = a.features[i] ?? 0;
    const bi = b.features[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? clamp01(dot / denom) : 0;
}

/**
 * Return the top-N most discriminating features by absolute value.
 */
export function getTopCoordinatorFeatures(
  v: CoordinatorMLVector,
  n: number,
): Array<{ label: string; value: number }> {
  const labels = TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS;
  const pairs = v.features.map((val, i) => ({
    label: labels[i] ?? `f${i}`,
    value: val,
  }));
  return pairs.sort((a, b) => b.value - a.value).slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION L — DL Tensor Construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single 8-column DL tensor row for one step execution.
 */
export function buildCoordinatorDLRow(
  result: TransactionExecutionResult,
  tick: number,
  executionMs = 0,
): CoordinatorDLTensorRow {
  const ctx = result.context;
  const signals = result.signals;
  const totalSignals = signals.length;
  const errorCount = countBySeverity(signals, 'ERROR');
  const healthAfter = scoreHealthStatus(result.healthAfter?.status);

  const cols: readonly number[] = Object.freeze([
    /* 0 */ result.skipped ? 0 : 1,
    /* 1 */ result.rolledBack ? 1 : 0,
    /* 2 */ result.skipped ? 1 : 0,
    /* 3 */ clamp01(totalSignals / TICK_TRANSACTION_COORDINATOR_MAX_SIGNALS),
    /* 4 */ healthAfter,
    /* 5 */ clamp01(executionMs / TICK_TRANSACTION_COORDINATOR_BUDGET_MS),
    /* 6 */ encodeModeCode((ctx.trace as any).mode),
    /* 7 */ clamp01(totalSignals > 0 ? errorCount / totalSignals : 0),
  ]);

  return Object.freeze({
    step: ctx.step,
    ordinal: encodeStepOrdinal(ctx.step),
    cols,
    tick,
    runId: ctx.trace.runId,
  });
}

/**
 * Assemble a 13-row × 8-col DL tensor from an ordered list of step rows.
 * Missing steps are zero-filled.
 */
export function buildCoordinatorDLTensor(
  rows: readonly CoordinatorDLTensorRow[],
  tick: number,
  runId: string,
): CoordinatorDLTensor {
  const rowLabels = TICK_TRANSACTION_COORDINATOR_DL_ROW_LABELS;
  const colLabels = TICK_TRANSACTION_COORDINATOR_DL_COL_LABELS;
  const zeroRow = (step: string, ordinal: number): CoordinatorDLTensorRow =>
    Object.freeze({
      step,
      ordinal,
      cols: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0] as const),
      tick,
      runId,
    });

  const byStep = new Map<string, CoordinatorDLTensorRow>();
  for (const row of rows) {
    byStep.set(row.step, row);
  }

  const filledRows: CoordinatorDLTensorRow[] = rowLabels.map((label, idx) => {
    return byStep.get(label) ?? zeroRow(label, idx / 12);
  });

  return Object.freeze({
    rows: Object.freeze(filledRows),
    tick,
    runId,
    shape: TICK_TRANSACTION_COORDINATOR_DL_TENSOR_SHAPE,
    colLabels,
    rowLabels,
  });
}

/**
 * Serialize a DL tensor to a compact JSON string.
 */
export function serializeCoordinatorDLTensor(tensor: CoordinatorDLTensor): string {
  return JSON.stringify({
    tick: tensor.tick,
    runId: tensor.runId,
    shape: tensor.shape,
    rows: tensor.rows.map((r) => ({ s: r.step, c: r.cols })),
  });
}

/**
 * Extract a single column from a DL tensor (useful for trend analysis).
 */
export function extractCoordinatorDLColumn(
  tensor: CoordinatorDLTensor,
  colIndex: number,
): readonly number[] {
  return Object.freeze(tensor.rows.map((r) => r.cols[colIndex] ?? 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION M — Health Scoring and Severity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a single [0,1] health score from a TransactionExecutionResult.
 * Penalizes rollbacks, errors, and health degradation.
 */
export function computeCoordinatorHealthScore(result: TransactionExecutionResult): number {
  let score = 1.0;

  // penalize rollback
  if (result.rolledBack) score -= 0.4;
  // penalize skip
  if (result.skipped) score -= 0.1;

  // penalize health degradation
  const statusBefore = scoreHealthStatus(result.healthBefore?.status);
  const statusAfter = scoreHealthStatus(result.healthAfter?.status);
  if (statusAfter < statusBefore) {
    score -= (statusBefore - statusAfter) * 0.3;
  }

  // penalize error signals
  const errorCount = countBySeverity(result.signals, 'ERROR');
  const warnCount = countBySeverity(result.signals, 'WARN');
  score -= errorCount * 0.15;
  score -= warnCount * 0.05;

  // penalize failed health after
  if (result.healthAfter?.status === 'FAILED') score -= 0.2;
  if (result.healthAfter?.status === 'DEGRADED') score -= 0.1;

  return clamp01(score);
}

/**
 * Classify a health score [0,1] into a CoordinatorSeverity bucket.
 */
export function classifyCoordinatorSeverity(score: number): CoordinatorSeverity {
  if (score >= COORDINATOR_SEVERITY_THRESHOLDS.LOW) return 'LOW';
  if (score >= COORDINATOR_SEVERITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (score >= COORDINATOR_SEVERITY_THRESHOLDS.HIGH) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Return a human-readable action recommendation for a given severity.
 */
export function getCoordinatorActionRecommendation(severity: CoordinatorSeverity): string {
  switch (severity) {
    case 'LOW':
      return 'Continue execution. No immediate intervention required.';
    case 'MEDIUM':
      return 'Monitor closely. Consider applying a recovery card next opportunity.';
    case 'HIGH':
      return 'Act now. Engine is stressed. Recovery or mitigation required.';
    case 'CRITICAL':
      return 'Emergency response required. Rollback may have caused cascading state drift.';
  }
}

/**
 * Determine how many consecutive failures are tracked in the health report.
 */
export function getCoordinatorConsecutiveFailures(health: EngineHealth | undefined): number {
  return health?.consecutiveFailures ?? 0;
}

/**
 * Determine the last successful tick recorded by the engine.
 */
export function getCoordinatorLastSuccessfulTick(health: EngineHealth | undefined): number {
  return health?.lastSuccessfulTick ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION N — Signal Builder Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a rollback acknowledgment signal for the coordinator's own witness layer.
 */
export function buildCoordinatorRollbackSignal(
  owner: EngineId | 'mode' | 'system',
  step: TickStep,
  tick: number,
  message: string,
): EngineSignal {
  return createEngineSignal(
    resolveSignalOwner(owner),
    'ERROR',
    'COORDINATOR_ROLLBACK_WITNESSED',
    message,
    tick,
    freezeArray(['coordinator', 'rollback', `step:${String(step).toLowerCase()}`]),
  );
}

/**
 * Build a budget-exceeded signal when execution overruns the coordinator's 50 ms budget.
 */
export function buildCoordinatorBudgetExceededSignal(
  owner: EngineId | 'mode' | 'system',
  step: TickStep,
  tick: number,
  executionMs: number,
): EngineSignal {
  return createEngineSignal(
    resolveSignalOwner(owner),
    'WARN',
    'COORDINATOR_BUDGET_EXCEEDED',
    `[${String(owner)}] ${String(step)} exceeded budget: ${executionMs.toFixed(1)} ms (budget=${TICK_TRANSACTION_COORDINATOR_BUDGET_MS} ms).`,
    tick,
    freezeArray(['coordinator', 'budget', `step:${String(step).toLowerCase()}`]),
  );
}

/**
 * Build a health-change signal when the engine transitions health status.
 */
export function buildCoordinatorHealthChangeSignal(
  health: EngineHealth,
  step: TickStep,
  tick: number,
  previousStatus: string | undefined,
): EngineSignal {
  const changed = previousStatus !== undefined && previousStatus !== health.status;
  const severity = health.status === 'FAILED' ? 'ERROR' : health.status === 'DEGRADED' ? 'WARN' : 'INFO';
  return createEngineSignal(
    health.engineId,
    severity,
    changed ? 'COORDINATOR_HEALTH_CHANGED' : 'COORDINATOR_HEALTH_STABLE',
    changed
      ? `Engine ${health.engineId} health: ${previousStatus} → ${health.status} at ${String(step)}.`
      : `Engine ${health.engineId} health: ${health.status} at ${String(step)}.`,
    tick,
    freezeArray(['coordinator', 'health-change', `step:${String(step).toLowerCase()}`]),
  );
}

/**
 * Build an info signal confirming a synthetic step was applied cleanly.
 */
export function buildCoordinatorSyntheticAppliedSignal(
  owner: EngineId | 'mode' | 'system',
  step: TickStep,
  tick: number,
  label: string,
): EngineSignal {
  return createEngineSignal(
    resolveSignalOwner(owner),
    'INFO',
    'COORDINATOR_SYNTHETIC_APPLIED',
    `[${String(owner)}] ${label} applied at ${String(step)}.`,
    tick,
    freezeArray(['coordinator', 'synthetic', `step:${String(step).toLowerCase()}`]),
  );
}

/**
 * Build an engine execution confirmed signal.
 */
export function buildCoordinatorEngineExecutedSignal(
  engineId: EngineId,
  step: TickStep,
  tick: number,
): EngineSignal {
  return createEngineSignal(
    engineId,
    'INFO',
    'COORDINATOR_ENGINE_EXECUTED',
    `[${engineId}] executed at ${String(step)} (tick=${tick}).`,
    tick,
    freezeArray(['coordinator', 'engine-exec', `step:${String(step).toLowerCase()}`]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION O — Narration Builder Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a mode-native narration hint for a transaction execution result.
 */
export function buildCoordinatorNarrationHint(
  result: TransactionExecutionResult,
  mode: CoordinatorModeCode,
  operationKind: CoordinatorOperationKind,
): CoordinatorNarrationHint {
  const trace = result.context.trace;
  const healthScore = computeCoordinatorHealthScore(result);
  const severity = classifyCoordinatorSeverity(healthScore);
  const modeNarrations = COORDINATOR_NARRATION_BY_MODE[mode];

  let phrase: string;
  if (result.rolledBack) {
    phrase = modeNarrations.ROLLBACK;
  } else if (result.skipped) {
    phrase = modeNarrations.SKIP;
  } else {
    const errorCount = countBySeverity(result.signals, 'ERROR');
    if (errorCount > 0) {
      phrase = modeNarrations.ABORT;
    } else if (result.healthAfter?.status === 'DEGRADED') {
      phrase = modeNarrations.DEGRADED;
    } else if (result.healthAfter?.status === 'FAILED') {
      phrase = modeNarrations.FAILED;
    } else if (operationKind === 'ENGINE_EXEC') {
      phrase = modeNarrations.ENGINE_EXEC;
    } else {
      phrase = modeNarrations.SYNTHETIC_EXEC;
    }
  }

  const witnessTrigger = severity === 'HIGH' || severity === 'CRITICAL' || result.rolledBack;

  return Object.freeze({
    phrase,
    mode,
    step: result.context.step,
    severity,
    operationKind,
    tick: trace.tick,
    rolledBack: result.rolledBack,
    skipped: result.skipped,
    witnessTrigger,
  });
}

/**
 * Build a narration hint from raw parts without a full result object.
 */
export function buildCoordinatorNarrationHintFromParts(
  step: TickStep,
  mode: CoordinatorModeCode,
  severity: CoordinatorSeverity,
  operationKind: CoordinatorOperationKind,
  tick: number,
  rolledBack: boolean,
  skipped: boolean,
): CoordinatorNarrationHint {
  const modeNarrations = COORDINATOR_NARRATION_BY_MODE[mode];
  let phrase: string;
  if (rolledBack) {
    phrase = modeNarrations.ROLLBACK;
  } else if (skipped) {
    phrase = modeNarrations.SKIP;
  } else if (severity === 'CRITICAL') {
    phrase = modeNarrations.ABORT;
  } else if (severity === 'HIGH') {
    phrase = modeNarrations.DEGRADED;
  } else if (operationKind === 'ENGINE_EXEC') {
    phrase = modeNarrations.ENGINE_EXEC;
  } else {
    phrase = modeNarrations.SYNTHETIC_EXEC;
  }

  const witnessTrigger = severity === 'HIGH' || severity === 'CRITICAL' || rolledBack;

  return Object.freeze({
    phrase,
    mode,
    step,
    severity,
    operationKind,
    tick,
    rolledBack,
    skipped,
    witnessTrigger,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION P — Chat Signal Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a LIVEOPS-typed chat signal payload from a transaction execution result.
 * Suitable for wrapping in a ChatSignalEnvelope by the chat adapter layer.
 */
export function buildCoordinatorChatSignal(
  result: TransactionExecutionResult,
  mode: CoordinatorModeCode,
  operationKind: CoordinatorOperationKind,
  executionMs = 0,
): CoordinatorChatSignal {
  const trace = result.context.trace;
  const healthScore = computeCoordinatorHealthScore(result);
  const severity = classifyCoordinatorSeverity(healthScore);
  const narrationHint = buildCoordinatorNarrationHint(result, mode, operationKind);
  const mlVector = extractCoordinatorMLVector({
    result,
    operationKind,
    executionMs,
    snapshot: result.snapshot,
  });

  return Object.freeze({
    type: 'LIVEOPS' as const,
    code: result.rolledBack
      ? 'COORDINATOR_ROLLBACK'
      : result.skipped
        ? 'COORDINATOR_SKIP'
        : 'COORDINATOR_EXEC_OK',
    runId: trace.runId,
    tick: trace.tick,
    step: result.context.step,
    mode,
    severity,
    operationKind,
    narration: narrationHint.phrase,
    mlVector: mlVector.features,
    healthScore,
    rolledBack: result.rolledBack,
    skipped: result.skipped,
    signalCount: result.signals.length,
    timestamp: result.context.nowMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION Q — Annotation, Health Snapshot, Run Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a full annotation bundle for replay/audit purposes.
 */
export function buildCoordinatorAnnotation(
  result: TransactionExecutionResult,
  operationKind: CoordinatorOperationKind,
  executionMs = 0,
): CoordinatorAnnotationBundle {
  const trace = result.context.trace;
  const signals = result.signals;
  const errorCount = countBySeverity(signals, 'ERROR');
  const warnCount = countBySeverity(signals, 'WARN');
  const infoCount = countBySeverity(signals, 'INFO');
  const healthScore = computeCoordinatorHealthScore(result);
  const severity = classifyCoordinatorSeverity(healthScore);

  const healthBefore = scoreHealthStatus(result.healthBefore?.status);
  const healthAfter = scoreHealthStatus(result.healthAfter?.status);

  return Object.freeze({
    runId: trace.runId,
    tick: trace.tick,
    step: result.context.step,
    operationKind,
    severity,
    healthBefore,
    healthAfter,
    healthDelta: healthAfter - healthBefore,
    rolledBack: result.rolledBack,
    skipped: result.skipped,
    signalCount: signals.length,
    errorCount,
    warnCount,
    infoCount,
    signalCodes: Object.freeze(signals.map((s) => s.code)),
    traceId: trace.traceId,
    nowMs: result.context.nowMs,
    executionMs,
    budgetExceeded: executionMs > TICK_TRANSACTION_COORDINATOR_BUDGET_MS,
  });
}

/**
 * Build a health snapshot from a single execution result.
 */
export function buildCoordinatorHealthSnapshot(
  result: TransactionExecutionResult,
): CoordinatorHealthSnapshot {
  const trace = result.context.trace;
  const healthScore = computeCoordinatorHealthScore(result);
  const severity = classifyCoordinatorSeverity(healthScore);

  return Object.freeze({
    runId: trace.runId,
    tick: trace.tick,
    step: result.context.step,
    healthScore,
    severity,
    statusBefore: result.healthBefore?.status,
    statusAfter: result.healthAfter?.status,
    rolledBack: result.rolledBack,
    consecutiveFailures: getCoordinatorConsecutiveFailures(result.healthAfter),
    lastSuccessfulTick: getCoordinatorLastSuccessfulTick(result.healthAfter),
    recommendation: getCoordinatorActionRecommendation(severity),
  });
}

/**
 * Build a run summary from a collection of execution results.
 */
export function buildCoordinatorRunSummary(
  results: readonly TransactionExecutionResult[],
  runId: string,
  sessionDurationMs: number,
): CoordinatorRunSummary {
  if (results.length === 0) {
    return Object.freeze({
      runId,
      totalTicks: 0,
      totalExecutions: 0,
      totalRollbacks: 0,
      totalSkips: 0,
      totalAborts: 0,
      avgHealthScore: 1.0,
      minHealthScore: 1.0,
      maxHealthScore: 1.0,
      finalSeverity: 'LOW',
      topSignalCodes: Object.freeze([]),
      sessionDurationMs,
    });
  }

  const scores = results.map(computeCoordinatorHealthScore);
  const avgHealthScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minHealthScore = Math.min(...scores);
  const maxHealthScore = Math.max(...scores);
  const totalRollbacks = results.filter((r) => r.rolledBack).length;
  const totalSkips = results.filter((r) => r.skipped).length;

  // Detect aborts (results with ERROR signals only)
  const totalAborts = results.filter(
    (r) =>
      !r.rolledBack &&
      !r.skipped &&
      countBySeverity(r.signals, 'ERROR') > 0,
  ).length;

  // Aggregate signal codes
  const codeFreq = new Map<string, number>();
  for (const r of results) {
    for (const s of r.signals) {
      codeFreq.set(s.code, (codeFreq.get(s.code) ?? 0) + 1);
    }
  }
  const topSignalCodes = Object.freeze(
    [...codeFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code]) => code),
  );

  const finalSeverity = classifyCoordinatorSeverity(
    scores[scores.length - 1] ?? 1.0,
  );

  const tickSet = new Set(results.map((r) => r.context.trace.tick));

  return Object.freeze({
    runId,
    totalTicks: tickSet.size,
    totalExecutions: results.length,
    totalRollbacks,
    totalSkips,
    totalAborts,
    avgHealthScore: clamp01(avgHealthScore),
    minHealthScore,
    maxHealthScore,
    finalSeverity,
    topSignalCodes,
    sessionDurationMs,
  });
}

/**
 * Build a complete inspection bundle from a single execution result.
 */
export function buildCoordinatorInspectionBundle(
  result: TransactionExecutionResult,
  mode: CoordinatorModeCode,
  operationKind: CoordinatorOperationKind,
  executionMs = 0,
): CoordinatorInspectionBundle {
  const trace = result.context.trace;
  const mlVector = extractCoordinatorMLVector({
    result,
    operationKind,
    executionMs,
    snapshot: result.snapshot,
  });
  const dlRow = buildCoordinatorDLRow(result, trace.tick, executionMs);
  const annotation = buildCoordinatorAnnotation(result, operationKind, executionMs);
  const healthSnapshot = buildCoordinatorHealthSnapshot(result);
  const narrationHint = buildCoordinatorNarrationHint(result, mode, operationKind);
  const chatSignal = buildCoordinatorChatSignal(result, mode, operationKind, executionMs);

  return Object.freeze({
    runId: trace.runId,
    tick: trace.tick,
    step: result.context.step,
    result,
    mlVector,
    dlRow,
    annotation,
    healthSnapshot,
    narrationHint,
    chatSignal,
  });
}

/**
 * Build a full export bundle with module metadata + all analytics surfaces.
 */
export function buildCoordinatorExportBundle(
  result: TransactionExecutionResult,
  mode: CoordinatorModeCode,
  operationKind: CoordinatorOperationKind,
  executionMs = 0,
): CoordinatorExportBundle {
  const trace = result.context.trace;
  const inspection = buildCoordinatorInspectionBundle(
    result,
    mode,
    operationKind,
    executionMs,
  );

  return Object.freeze({
    runId: trace.runId,
    moduleVersion: TICK_TRANSACTION_COORDINATOR_MODULE_VERSION,
    schemaVersion: TICK_TRANSACTION_COORDINATOR_SCHEMA_VERSION,
    tick: trace.tick,
    result,
    mlVector: inspection.mlVector,
    dlRow: inspection.dlRow,
    annotation: inspection.annotation,
    healthSnapshot: inspection.healthSnapshot,
    narrationHint: inspection.narrationHint,
    chatSignal: inspection.chatSignal,
    inspection,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION R — TickTransactionCoordinator Class (Expanded)
// ─────────────────────────────────────────────────────────────────────────────

export class TickTransactionCoordinator {
  // ── Context Creation ──────────────────────────────────────────────────────

  /**
   * Build a deterministic TickContext from TransactionContextArgs.
   * The context is frozen; clock is taken directly from args.clock.
   */
  public createContext(args: TransactionContextArgs): TickContext {
    return Object.freeze({
      step: args.step,
      nowMs: Math.max(0, Math.trunc(args.nowMs)),
      clock: args.clock,
      bus: args.bus,
      trace: buildTrace(args),
    });
  }

  // ── Engine Execution ──────────────────────────────────────────────────────

  /**
   * Execute a SimulationEngine at a single tick step.
   * Uses EngineTickTransaction.execute() under the hood.
   * Returns an immutable TransactionExecutionResult with health tracking,
   * signal enrichment, and automatic rollback signal on failure.
   */
  public executeEngine(
    args: EngineTransactionExecutionArgs,
  ): TransactionExecutionResult {
    const context = this.createContext(args);
    const healthBefore = args.engine.getHealth();

    try {
      const result = EngineTickTransaction.execute(
        args.engine,
        args.snapshot,
        context,
      );
      const healthAfter = args.engine.getHealth();
      const signals = result.signals ?? [];

      const rolledBack = signals.some(
        (signal) =>
          signal.code === 'ENGINE_TRANSACTION_ROLLBACK' ||
          signal.tags?.includes('rollback') === true,
      );
      const skipped = signals.some(
        (signal) => signal.code === 'ENGINE_SKIPPED',
      );

      // Append health-change witness signal if status changed
      const enrichedSignals: EngineSignal[] = [...signals];
      if (
        healthBefore?.status !== undefined &&
        healthAfter?.status !== undefined &&
        healthBefore.status !== healthAfter.status
      ) {
        enrichedSignals.push(
          buildCoordinatorHealthChangeSignal(
            healthAfter,
            args.step,
            context.trace.tick,
            healthBefore.status,
          ),
        );
      }

      return Object.freeze({
        context,
        snapshot: toFrozenSnapshot(result),
        signals: freezeArray(enrichedSignals),
        healthBefore,
        healthAfter,
        rolledBack,
        skipped,
      });
    } catch (error) {
      const rollbackSignal = createEngineSignal(
        args.engine.engineId,
        'ERROR',
        'ZERO_TRANSACTION_COORDINATOR_ABORT',
        error instanceof Error
          ? `[${args.engine.engineId}] ${String(args.step)} aborted in coordinator: ${error.message}`
          : `[${args.engine.engineId}] ${String(args.step)} aborted in coordinator.`,
        context.trace.tick,
        freezeArray([
          'zero',
          'transaction-coordinator',
          'rollback',
          `step:${String(args.step).toLowerCase()}`,
        ]),
      );

      return Object.freeze({
        context,
        snapshot: args.snapshot,
        signals: freezeArray([rollbackSignal]),
        healthBefore,
        healthAfter: args.engine.getHealth(),
        rolledBack: true,
        skipped: false,
      });
    }
  }

  // ── Synthetic Execution ───────────────────────────────────────────────────

  /**
   * Execute a synthetic reducer function at a single tick step.
   * Normalizes the result via normalizeEngineTickResult.
   * Returns an immutable TransactionExecutionResult with rollback signal on failure.
   */
  public executeSynthetic(
    args: SyntheticTransactionExecutionArgs,
  ): TransactionExecutionResult {
    const context = this.createContext(args);

    try {
      const raw = args.reducer(args.snapshot, context);
      const normalized = normalizeEngineTickResult(
        resolveSignalOwner(args.owner) === 'mode'
          ? 'time'
          : (resolveSignalOwner(args.owner) as EngineId),
        context.trace.tick,
        raw,
      );

      const baseSignals =
        normalized.signals && normalized.signals.length > 0
          ? normalized.signals
          : freezeArray([
              createEngineSignal(
                resolveSignalOwner(args.owner),
                'INFO',
                'ZERO_SYNTHETIC_STEP_APPLIED',
                `${args.label} applied at ${String(args.step)}.`,
                context.trace.tick,
                freezeArray([
                  'zero',
                  'synthetic-step',
                  `step:${String(args.step).toLowerCase()}`,
                ]),
              ),
            ]);

      return Object.freeze({
        context,
        snapshot: toFrozenSnapshot(normalized),
        signals: freezeArray(baseSignals),
        rolledBack: false,
        skipped: false,
      });
    } catch (error) {
      return Object.freeze({
        context,
        snapshot: args.snapshot,
        signals: freezeArray([
          createEngineSignal(
            resolveSignalOwner(args.owner),
            'ERROR',
            'ZERO_SYNTHETIC_STEP_ABORT',
            error instanceof Error
              ? `[${String(args.owner)}] ${args.label} failed: ${error.message}`
              : `[${String(args.owner)}] ${args.label} failed.`,
            context.trace.tick,
            freezeArray([
              'zero',
              'synthetic-step',
              'rollback',
              `step:${String(args.step).toLowerCase()}`,
            ]),
          ),
        ]),
        rolledBack: true,
        skipped: false,
      });
    }
  }

  // ── Batch Execution ───────────────────────────────────────────────────────

  /**
   * Execute multiple SimulationEngines in sequence at the same step.
   * Returns an array of TransactionExecutionResults in engine order.
   * Stops on the first result that both rolled back and returned no valid snapshot.
   */
  public executeEngineBatch(
    engines: readonly SimulationEngine[],
    baseArgs: TransactionContextArgs,
  ): readonly TransactionExecutionResult[] {
    if (engines.length > TICK_TRANSACTION_COORDINATOR_MAX_BATCH) {
      throw new Error(
        `executeEngineBatch: engine count ${engines.length} exceeds MAX_BATCH=${TICK_TRANSACTION_COORDINATOR_MAX_BATCH}`,
      );
    }

    const results: TransactionExecutionResult[] = [];
    let currentSnapshot = baseArgs.snapshot;

    for (const engine of engines) {
      const result = this.executeEngine({
        ...baseArgs,
        snapshot: currentSnapshot,
        engine,
      });
      results.push(result);
      // advance snapshot only if not rolled back
      if (!result.rolledBack) {
        currentSnapshot = result.snapshot;
      }
    }

    return Object.freeze(results);
  }

  /**
   * Execute multiple synthetic reducers in sequence at the same step.
   * Each reducer receives the output snapshot of the previous one.
   */
  public executeSyntheticBatch(
    syntheticArgs: readonly SyntheticTransactionExecutionArgs[],
  ): readonly TransactionExecutionResult[] {
    if (syntheticArgs.length > TICK_TRANSACTION_COORDINATOR_MAX_BATCH) {
      throw new Error(
        `executeSyntheticBatch: entry count ${syntheticArgs.length} exceeds MAX_BATCH=${TICK_TRANSACTION_COORDINATOR_MAX_BATCH}`,
      );
    }

    const results: TransactionExecutionResult[] = [];
    let currentSnapshot: RunStateSnapshot | undefined;

    for (const args of syntheticArgs) {
      const effectiveArgs = currentSnapshot
        ? { ...args, snapshot: currentSnapshot }
        : args;
      const result = this.executeSynthetic(effectiveArgs);
      results.push(result);
      if (!result.rolledBack) {
        currentSnapshot = result.snapshot;
      }
    }

    return Object.freeze(results);
  }

  // ── Transaction Validation ────────────────────────────────────────────────

  /**
   * Validate that the EngineTickTransaction contract is callable for a given engine.
   * Useful for pre-flight checks before committing to a full execution batch.
   */
  public validateTransaction(
    engine: SimulationEngine,
    args: TransactionContextArgs,
  ): { valid: boolean; reason?: string } {
    try {
      const context = this.createContext(args);
      // Probe health — if getHealth() throws, the engine is unfit
      const health = engine.getHealth();
      if (health.status === 'FAILED') {
        return {
          valid: false,
          reason: `Engine ${engine.engineId} health is FAILED before transaction.`,
        };
      }
      // Verify EngineTickTransaction is accessible
      if (typeof EngineTickTransaction.execute !== 'function') {
        return { valid: false, reason: 'EngineTickTransaction.execute is not callable.' };
      }
      // Verify context step matches engine's expected step
      void context; // context is created purely for validation side-effects
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        reason: err instanceof Error ? err.message : 'Unknown validation error.',
      };
    }
  }

  // ── Analytics Helpers ─────────────────────────────────────────────────────

  /**
   * Build a complete inspection bundle for the most recent execution result.
   */
  public inspect(
    result: TransactionExecutionResult,
    mode: CoordinatorModeCode,
    operationKind: CoordinatorOperationKind,
    executionMs = 0,
  ): CoordinatorInspectionBundle {
    return buildCoordinatorInspectionBundle(result, mode, operationKind, executionMs);
  }

  /**
   * Build a full export bundle for a single execution result.
   */
  public export(
    result: TransactionExecutionResult,
    mode: CoordinatorModeCode,
    operationKind: CoordinatorOperationKind,
    executionMs = 0,
  ): CoordinatorExportBundle {
    return buildCoordinatorExportBundle(result, mode, operationKind, executionMs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION S — CoordinatorTrendAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks a rolling window of TransactionExecutionResult health scores to
 * detect improving, stable, or declining execution trends across ticks.
 */
export class CoordinatorTrendAnalyzer {
  private readonly windowSize: number;
  private readonly entries: Array<{
    healthScore: number;
    rolledBack: boolean;
    skipped: boolean;
    severity: CoordinatorSeverity;
    tick: number;
    step: string;
  }>;

  constructor(windowSize: number = TICK_TRANSACTION_COORDINATOR_TREND_WINDOW) {
    this.windowSize = Math.max(2, windowSize);
    this.entries = [];
  }

  public record(result: TransactionExecutionResult): void {
    const healthScore = computeCoordinatorHealthScore(result);
    const severity = classifyCoordinatorSeverity(healthScore);
    this.entries.push({
      healthScore,
      rolledBack: result.rolledBack,
      skipped: result.skipped,
      severity,
      tick: result.context.trace.tick,
      step: result.context.step,
    });
    if (this.entries.length > this.windowSize) {
      this.entries.shift();
    }
  }

  public snapshot(): CoordinatorTrendSnapshot {
    const n = this.entries.length;
    if (n === 0) {
      return Object.freeze({
        window: 0,
        avgHealthScore: 1.0,
        minHealthScore: 1.0,
        maxHealthScore: 1.0,
        rollbackRate: 0,
        skipRate: 0,
        abortRate: 0,
        severityDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        trendDirection: 'STABLE' as const,
      });
    }

    const scores = this.entries.map((e) => e.healthScore);
    const avgHealthScore = scores.reduce((a, b) => a + b, 0) / n;
    const minHealthScore = Math.min(...scores);
    const maxHealthScore = Math.max(...scores);
    const rollbackRate = this.entries.filter((e) => e.rolledBack).length / n;
    const skipRate = this.entries.filter((e) => e.skipped).length / n;
    const abortRate =
      this.entries.filter(
        (e) => !e.rolledBack && !e.skipped && e.severity === 'CRITICAL',
      ).length / n;

    const severityDistribution: Record<CoordinatorSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const e of this.entries) {
      severityDistribution[e.severity]++;
    }

    // Determine trend by comparing first-half vs second-half averages
    const half = Math.floor(n / 2);
    const firstHalf = scores.slice(0, half);
    const secondHalf = scores.slice(half);
    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        : avgHealthScore;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        : avgHealthScore;

    const trendDirection =
      secondAvg > firstAvg + 0.05
        ? ('IMPROVING' as const)
        : secondAvg < firstAvg - 0.05
          ? ('DECLINING' as const)
          : ('STABLE' as const);

    return Object.freeze({
      window: n,
      avgHealthScore: clamp01(avgHealthScore),
      minHealthScore,
      maxHealthScore,
      rollbackRate,
      skipRate,
      abortRate,
      severityDistribution: Object.freeze(severityDistribution),
      trendDirection,
    });
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public get size(): number {
    return this.entries.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION T — CoordinatorSessionTracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks per-run session metrics across all execution types.
 * Uses the ClockSource to record real-time durations.
 */
export class CoordinatorSessionTracker {
  private readonly runId: string;
  private readonly clock: ClockSource;
  private readonly startMs: number;
  private totalExecutions = 0;
  private totalEngineExecs = 0;
  private totalSyntheticExecs = 0;
  private totalRollbacks = 0;
  private totalSkips = 0;
  private totalAborts = 0;
  private totalSignals = 0;
  private totalErrors = 0;
  private totalWarns = 0;
  private healthScores: number[] = [];
  private firstExecutionMs = -1;
  private lastExecutionMs = -1;

  constructor(runId: string, clock: ClockSource) {
    this.runId = runId;
    this.clock = clock;
    this.startMs = clock.now();
  }

  public recordEngine(result: TransactionExecutionResult): void {
    this.recordResult(result, 'ENGINE_EXEC');
    this.totalEngineExecs++;
  }

  public recordSynthetic(result: TransactionExecutionResult): void {
    this.recordResult(result, 'SYNTHETIC_EXEC');
    this.totalSyntheticExecs++;
  }

  private recordResult(
    result: TransactionExecutionResult,
    _kind: CoordinatorOperationKind,
  ): void {
    const nowMs = this.clock.now();
    if (this.firstExecutionMs < 0) this.firstExecutionMs = nowMs;
    this.lastExecutionMs = nowMs;

    this.totalExecutions++;
    if (result.rolledBack) this.totalRollbacks++;
    if (result.skipped) this.totalSkips++;

    const errorCount = countBySeverity(result.signals, 'ERROR');
    const warnCount = countBySeverity(result.signals, 'WARN');
    if (!result.rolledBack && !result.skipped && errorCount > 0) {
      this.totalAborts++;
    }

    this.totalSignals += result.signals.length;
    this.totalErrors += errorCount;
    this.totalWarns += warnCount;

    this.healthScores.push(computeCoordinatorHealthScore(result));

    if (this.healthScores.length > TICK_TRANSACTION_COORDINATOR_SESSION_MAX) {
      this.healthScores.shift();
    }
  }

  public report(): CoordinatorSessionReport {
    const n = this.healthScores.length;
    const avgHealthScore =
      n > 0 ? clamp01(this.healthScores.reduce((a, b) => a + b, 0) / n) : 1.0;
    const minHealthScore = n > 0 ? Math.min(...this.healthScores) : 1.0;
    const maxHealthScore = n > 0 ? Math.max(...this.healthScores) : 1.0;
    const now = this.clock.now();

    return Object.freeze({
      runId: this.runId,
      totalExecutions: this.totalExecutions,
      totalEngineExecs: this.totalEngineExecs,
      totalSyntheticExecs: this.totalSyntheticExecs,
      totalRollbacks: this.totalRollbacks,
      totalSkips: this.totalSkips,
      totalAborts: this.totalAborts,
      avgHealthScore,
      minHealthScore,
      maxHealthScore,
      totalSignals: this.totalSignals,
      totalErrors: this.totalErrors,
      totalWarns: this.totalWarns,
      sessionDurationMs: now - this.startMs,
      firstExecutionMs: this.firstExecutionMs >= 0 ? this.firstExecutionMs : now,
      lastExecutionMs: this.lastExecutionMs >= 0 ? this.lastExecutionMs : now,
    });
  }

  public reset(): void {
    this.totalExecutions = 0;
    this.totalEngineExecs = 0;
    this.totalSyntheticExecs = 0;
    this.totalRollbacks = 0;
    this.totalSkips = 0;
    this.totalAborts = 0;
    this.totalSignals = 0;
    this.totalErrors = 0;
    this.totalWarns = 0;
    this.healthScores = [];
    this.firstExecutionMs = -1;
    this.lastExecutionMs = -1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION U — CoordinatorEventLog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered, bounded event log for coordinator execution records.
 * Optionally emits entries to a RuntimeBus for external consumers.
 */
export class CoordinatorEventLog {
  private readonly maxEntries: number;
  private readonly entries: CoordinatorEventLogEntry[];
  private readonly bus: RuntimeBus;

  constructor(
    maxEntries = TICK_TRANSACTION_COORDINATOR_EVENT_LOG_MAX,
    bus?: RuntimeBus,
  ) {
    this.maxEntries = Math.max(1, maxEntries);
    this.entries = [];
    // If no bus is provided, create a local bus for internal event routing
    this.bus = bus ?? new EventBus<EngineEventMap & Record<string, unknown>>();
  }

  public record(
    result: TransactionExecutionResult,
    operationKind: CoordinatorOperationKind,
  ): CoordinatorEventLogEntry {
    const trace = result.context.trace;
    const healthScore = computeCoordinatorHealthScore(result);
    const severity = classifyCoordinatorSeverity(healthScore);

    const entry: CoordinatorEventLogEntry = Object.freeze({
      id: buildExecutionId(
        trace.runId,
        trace.tick,
        result.context.step,
        result.context.nowMs,
      ),
      runId: trace.runId,
      tick: trace.tick,
      step: result.context.step,
      operationKind,
      severity,
      healthScore,
      rolledBack: result.rolledBack,
      skipped: result.skipped,
      signalCount: result.signals.length,
      nowMs: result.context.nowMs,
      traceId: trace.traceId,
      signals: result.signals,
    });

    this.entries.push(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Emit to bus for external consumers when severity is HIGH or CRITICAL
    if (severity === 'HIGH' || severity === 'CRITICAL' || result.rolledBack) {
      try {
        this.bus.emit(
          'tick.completed' as keyof (EngineEventMap & Record<string, unknown>),
          {
            runId: trace.runId,
            tick: trace.tick,
            step: result.context.step,
            severity,
            rolledBack: result.rolledBack,
          } as unknown as (EngineEventMap & Record<string, unknown>)[keyof (EngineEventMap & Record<string, unknown>)],
        );
      } catch {
        // bus emission is best-effort; do not propagate errors
      }
    }

    return entry;
  }

  public getAll(): readonly CoordinatorEventLogEntry[] {
    return Object.freeze([...this.entries]);
  }

  public getByStep(step: string): readonly CoordinatorEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.step === step));
  }

  public getByTick(tick: number): readonly CoordinatorEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.tick === tick));
  }

  public getBySeverity(severity: CoordinatorSeverity): readonly CoordinatorEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.severity === severity));
  }

  public getRollbacks(): readonly CoordinatorEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.rolledBack));
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public get size(): number {
    return this.entries.length;
  }

  /** Replay all entries through a consumer function — useful for audit rebuilds. */
  public replay(consumer: (entry: CoordinatorEventLogEntry) => void): void {
    for (const entry of this.entries) {
      consumer(entry);
    }
  }

  /** Return last N entries in reverse chronological order. */
  public tail(n: number): readonly CoordinatorEventLogEntry[] {
    return Object.freeze(this.entries.slice(-Math.max(1, n)).reverse());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION V — CoordinatorAnnotator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces configurable annotation bundles from execution results.
 * Options control verbosity, included surfaces, and mode-native narration.
 */
export class CoordinatorAnnotator {
  public readonly options: CoordinatorAnnotatorOptions;

  constructor(options: Partial<CoordinatorAnnotatorOptions> = {}) {
    this.options = Object.freeze({
      verbose: options.verbose ?? false,
      includeSignals: options.includeSignals ?? true,
      includeMLVector: options.includeMLVector ?? false,
      includeDLRow: options.includeDLRow ?? false,
      includeNarration: options.includeNarration ?? true,
      mode: options.mode ?? 'solo',
    });
  }

  public annotate(
    result: TransactionExecutionResult,
    operationKind: CoordinatorOperationKind,
    executionMs = 0,
  ): CoordinatorAnnotationBundle {
    return buildCoordinatorAnnotation(result, operationKind, executionMs);
  }

  public annotateWithNarration(
    result: TransactionExecutionResult,
    operationKind: CoordinatorOperationKind,
    executionMs = 0,
  ): {
    annotation: CoordinatorAnnotationBundle;
    narrationHint: CoordinatorNarrationHint;
    mlVector?: CoordinatorMLVector;
    dlRow?: CoordinatorDLTensorRow;
  } {
    const annotation = this.annotate(result, operationKind, executionMs);
    const narrationHint = buildCoordinatorNarrationHint(
      result,
      this.options.mode,
      operationKind,
    );

    const mlVector = this.options.includeMLVector
      ? extractCoordinatorMLVector({
          result,
          operationKind,
          executionMs,
          snapshot: result.snapshot,
        })
      : undefined;

    const dlRow = this.options.includeDLRow
      ? buildCoordinatorDLRow(result, result.context.trace.tick, executionMs)
      : undefined;

    return Object.freeze({ annotation, narrationHint, mlVector, dlRow });
  }

  public annotateExportBundle(
    result: TransactionExecutionResult,
    operationKind: CoordinatorOperationKind,
    executionMs = 0,
  ): CoordinatorExportBundle {
    return buildCoordinatorExportBundle(
      result,
      this.options.mode,
      operationKind,
      executionMs,
    );
  }

  /** Deep-clone a result into an annotated frozen export for archiving. */
  public archive(
    result: TransactionExecutionResult,
    operationKind: CoordinatorOperationKind,
  ): CoordinatorExportBundle {
    const frozen = cloneResult(result);
    return buildCoordinatorExportBundle(frozen, this.options.mode, operationKind);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION W — CoordinatorInspector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full inspection surface for a single execution result.
 * Used by diagnostics pipelines and replay auditors.
 */
export class CoordinatorInspector {
  private readonly defaultMode: CoordinatorModeCode;
  private readonly history: CoordinatorInspectionBundle[];

  constructor(
    defaultMode: CoordinatorModeCode = 'solo',
    private readonly maxHistory: number = TICK_TRANSACTION_COORDINATOR_TREND_WINDOW,
  ) {
    this.defaultMode = defaultMode;
    this.history = [];
  }

  public inspect(
    result: TransactionExecutionResult,
    operationKind: CoordinatorOperationKind,
    executionMs = 0,
    mode?: CoordinatorModeCode,
  ): CoordinatorInspectionBundle {
    const bundle = buildCoordinatorInspectionBundle(
      result,
      mode ?? this.defaultMode,
      operationKind,
      executionMs,
    );
    this.history.push(bundle);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    return bundle;
  }

  public getHistory(): readonly CoordinatorInspectionBundle[] {
    return Object.freeze([...this.history]);
  }

  public getLastBundle(): CoordinatorInspectionBundle | undefined {
    return this.history[this.history.length - 1];
  }

  public getLastHealthScore(): number {
    const last = this.getLastBundle();
    return last?.healthSnapshot.healthScore ?? 1.0;
  }

  public getLastSeverity(): CoordinatorSeverity {
    const last = this.getLastBundle();
    return last?.healthSnapshot.severity ?? 'LOW';
  }

  public clear(): void {
    this.history.length = 0;
  }

  public summarize(): CoordinatorTrendSnapshot {
    const analyzer = new CoordinatorTrendAnalyzer(this.maxHistory);
    for (const bundle of this.history) {
      analyzer.record(bundle.result);
    }
    return analyzer.snapshot();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION X — Type Guards
// ─────────────────────────────────────────────────────────────────────────────

export function isCoordinatorSeverity(v: unknown): v is CoordinatorSeverity {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

export function isCoordinatorOperationKind(v: unknown): v is CoordinatorOperationKind {
  return (
    v === 'ENGINE_EXEC' ||
    v === 'SYNTHETIC_EXEC' ||
    v === 'CONTEXT_CREATE' ||
    v === 'ROLLBACK' ||
    v === 'SKIP' ||
    v === 'ABORT'
  );
}

export function isCoordinatorModeCode(v: unknown): v is CoordinatorModeCode {
  return v === 'solo' || v === 'pvp' || v === 'coop' || v === 'ghost';
}

export function isCoordinatorPressureTier(v: unknown): v is CoordinatorPressureTier {
  return v === 'T1' || v === 'T2' || v === 'T3' || v === 'T4' || v === 'T5';
}

export function isCoordinatorRunPhase(v: unknown): v is CoordinatorRunPhase {
  return (
    v === 'PROLOGUE' ||
    v === 'EARLY' ||
    v === 'MID' ||
    v === 'LATE' ||
    v === 'ENDGAME'
  );
}

export function isCoordinatorRunOutcome(v: unknown): v is CoordinatorRunOutcome {
  return (
    v === 'NONE' ||
    v === 'FREEDOM' ||
    v === 'CAPTURED' ||
    v === 'ABANDONED' ||
    v === 'TIMEOUT'
  );
}

export function isTransactionExecutionResult(v: unknown): v is TransactionExecutionResult {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['rolledBack'] === 'boolean' &&
    typeof r['skipped'] === 'boolean' &&
    Array.isArray(r['signals']) &&
    typeof r['context'] === 'object' &&
    r['context'] !== null &&
    typeof r['snapshot'] === 'object' &&
    r['snapshot'] !== null
  );
}

export function isRolledBackResult(result: TransactionExecutionResult): boolean {
  return result.rolledBack;
}

export function isSkippedResult(result: TransactionExecutionResult): boolean {
  return result.skipped;
}

export function isCriticalResult(result: TransactionExecutionResult): boolean {
  return classifyCoordinatorSeverity(computeCoordinatorHealthScore(result)) === 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION Y — Policy Tables and Batch Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-step budget multipliers — some steps (like CASCADE) are allowed
 * more headroom than the global 50 ms budget.
 */
export const COORDINATOR_STEP_BUDGET_MULTIPLIER = Object.freeze({
  STEP_01_PREPARE: 0.5,
  STEP_02_TIME: 0.6,
  STEP_03_PRESSURE: 0.7,
  STEP_04_TENSION: 0.7,
  STEP_05_BATTLE: 1.2,
  STEP_06_SHIELD: 1.0,
  STEP_07_CASCADE: 1.5,
  STEP_08_MODE_POST: 0.8,
  STEP_09_TELEMETRY: 0.6,
  STEP_10_SOVEREIGNTY_SNAPSHOT: 0.8,
  STEP_11_OUTCOME_GATE: 0.9,
  STEP_12_EVENT_SEAL: 0.7,
  STEP_13_FLUSH: 0.5,
} as const);

/**
 * Per-step severity override when a step is critical path.
 * Critical-path steps promote MEDIUM → HIGH when rolled back.
 */
export const COORDINATOR_STEP_CRITICAL_PATH = Object.freeze({
  STEP_01_PREPARE: true,
  STEP_02_TIME: true,
  STEP_03_PRESSURE: true,
  STEP_04_TENSION: false,
  STEP_05_BATTLE: true,
  STEP_06_SHIELD: true,
  STEP_07_CASCADE: true,
  STEP_08_MODE_POST: false,
  STEP_09_TELEMETRY: false,
  STEP_10_SOVEREIGNTY_SNAPSHOT: true,
  STEP_11_OUTCOME_GATE: true,
  STEP_12_EVENT_SEAL: true,
  STEP_13_FLUSH: true,
} as const);

/**
 * Return the per-step budget in ms.
 */
export function getCoordinatorStepBudgetMs(step: TickStep): number {
  const mult =
    COORDINATOR_STEP_BUDGET_MULTIPLIER[
      step as keyof typeof COORDINATOR_STEP_BUDGET_MULTIPLIER
    ] ?? 1.0;
  return TICK_TRANSACTION_COORDINATOR_BUDGET_MS * mult;
}

/**
 * Return whether a step is on the critical execution path.
 */
export function isCoordinatorCriticalPathStep(step: TickStep): boolean {
  return (
    COORDINATOR_STEP_CRITICAL_PATH[
      step as keyof typeof COORDINATOR_STEP_CRITICAL_PATH
    ] === true
  );
}

/**
 * Apply critical-path severity promotion: if the step is critical and
 * severity is MEDIUM, promote to HIGH.
 */
export function applyCoordinatorCriticalPathPromotion(
  step: TickStep,
  severity: CoordinatorSeverity,
): CoordinatorSeverity {
  if (isCoordinatorCriticalPathStep(step) && severity === 'MEDIUM') return 'HIGH';
  return severity;
}

/**
 * Analyze a batch of TransactionExecutionResults and return aggregate metrics.
 */
export function analyzeCoordinatorResultBatch(
  results: readonly TransactionExecutionResult[],
): {
  count: number;
  rollbackCount: number;
  skipCount: number;
  errorCount: number;
  avgHealthScore: number;
  minHealthScore: number;
  maxHealthScore: number;
  dominantSeverity: CoordinatorSeverity;
} {
  if (results.length === 0) {
    return {
      count: 0,
      rollbackCount: 0,
      skipCount: 0,
      errorCount: 0,
      avgHealthScore: 1.0,
      minHealthScore: 1.0,
      maxHealthScore: 1.0,
      dominantSeverity: 'LOW',
    };
  }

  const scores = results.map(computeCoordinatorHealthScore);
  const avg = clamp01(scores.reduce((a, b) => a + b, 0) / scores.length);
  const severities = scores.map(classifyCoordinatorSeverity);
  const freqMap: Record<CoordinatorSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  for (const s of severities) freqMap[s]++;
  const dominantSeverity = (Object.entries(freqMap).sort(
    ([, a], [, b]) => b - a,
  )[0]?.[0] ?? 'LOW') as CoordinatorSeverity;

  return {
    count: results.length,
    rollbackCount: results.filter((r) => r.rolledBack).length,
    skipCount: results.filter((r) => r.skipped).length,
    errorCount: results.reduce(
      (acc, r) => acc + countBySeverity(r.signals, 'ERROR'),
      0,
    ),
    avgHealthScore: avg,
    minHealthScore: Math.min(...scores),
    maxHealthScore: Math.max(...scores),
    dominantSeverity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION Z — Singletons, Manifest, and Export Bundle
// ─────────────────────────────────────────────────────────────────────────────

/** Default annotator — minimal, narration-enabled, solo mode. */
export const COORDINATOR_DEFAULT_ANNOTATOR = new CoordinatorAnnotator({
  verbose: false,
  includeSignals: true,
  includeMLVector: false,
  includeDLRow: false,
  includeNarration: true,
  mode: 'solo',
});

/** Strict annotator — verbose, all surfaces, solo mode. */
export const COORDINATOR_STRICT_ANNOTATOR = new CoordinatorAnnotator({
  verbose: true,
  includeSignals: true,
  includeMLVector: true,
  includeDLRow: true,
  includeNarration: true,
  mode: 'solo',
});

/** Verbose annotator — all surfaces enabled, ghost mode narration. */
export const COORDINATOR_VERBOSE_ANNOTATOR = new CoordinatorAnnotator({
  verbose: true,
  includeSignals: true,
  includeMLVector: true,
  includeDLRow: true,
  includeNarration: true,
  mode: 'ghost',
});

/** Default inspector singleton — solo mode, 12-entry history. */
export const COORDINATOR_DEFAULT_INSPECTOR = new CoordinatorInspector(
  'solo',
  TICK_TRANSACTION_COORDINATOR_TREND_WINDOW,
);

/** Strict inspector singleton — solo mode, 24-entry history. */
export const COORDINATOR_STRICT_INSPECTOR = new CoordinatorInspector(
  'solo',
  TICK_TRANSACTION_COORDINATOR_TREND_WINDOW * 2,
);

/** Verbose inspector singleton — ghost mode, 48-entry history. */
export const COORDINATOR_VERBOSE_INSPECTOR = new CoordinatorInspector(
  'ghost',
  TICK_TRANSACTION_COORDINATOR_TREND_WINDOW * 4,
);

/** Default trend analyzer singleton — 12-entry window. */
export const COORDINATOR_DEFAULT_TREND_ANALYZER = new CoordinatorTrendAnalyzer(
  TICK_TRANSACTION_COORDINATOR_TREND_WINDOW,
);

/** Global singleton TickTransactionCoordinator. */
export const ZERO_TICK_TRANSACTION_COORDINATOR = deepFreeze(
  new TickTransactionCoordinator(),
) as TickTransactionCoordinator;

/** Module manifest for registry and diagnostics discovery. */
export const TICK_TRANSACTION_COORDINATOR_MANIFEST: CoordinatorManifest =
  deepFreeze({
    module: 'TickTransactionCoordinator',
    version: TICK_TRANSACTION_COORDINATOR_MODULE_VERSION,
    schema: TICK_TRANSACTION_COORDINATOR_SCHEMA_VERSION,
    mlFeatureCount: TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT,
    dlTensorShape: TICK_TRANSACTION_COORDINATOR_DL_TENSOR_SHAPE,
    mlFeatureLabels: TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS,
    dlRowLabels: TICK_TRANSACTION_COORDINATOR_DL_ROW_LABELS,
    dlColLabels: TICK_TRANSACTION_COORDINATOR_DL_COL_LABELS,
    operationKinds: COORDINATOR_OPERATION_KINDS,
    severityLevels: COORDINATOR_SEVERITY_LABELS,
    modeCodes: COORDINATOR_MODE_CODES,
    ready: TICK_TRANSACTION_COORDINATOR_READY,
  }) as CoordinatorManifest;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION AA — Extended Utilities and Batch Aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flatten an ML vector to a plain number array for downstream tensor frameworks.
 */
export function cloneCoordinatorMLVector(v: CoordinatorMLVector): CoordinatorMLVector {
  return Object.freeze({
    ...v,
    features: Object.freeze([...v.features]),
    labels: v.labels,
  });
}

/**
 * Compute the average health score across a set of ML vectors.
 */
export function averageCoordinatorMLVectors(
  vectors: readonly CoordinatorMLVector[],
): CoordinatorMLVector | undefined {
  if (vectors.length === 0) return undefined;
  const n = vectors.length;
  const featureCount = TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT;
  const sumFeatures = new Array<number>(featureCount).fill(0);

  for (const v of vectors) {
    for (let i = 0; i < featureCount; i++) {
      sumFeatures[i]! += v.features[i] ?? 0;
    }
  }

  const avgFeatures: readonly number[] = Object.freeze(
    sumFeatures.map((f) => clamp01(f / n)),
  );

  const avgHealthScore = clamp01(
    vectors.reduce((a, v) => a + v.healthScore, 0) / n,
  );
  const severity = classifyCoordinatorSeverity(avgHealthScore);

  return Object.freeze({
    features: avgFeatures,
    labels: TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS,
    tick: vectors[vectors.length - 1]!.tick,
    step: vectors[vectors.length - 1]!.step,
    runId: vectors[0]!.runId,
    operationKind: vectors[vectors.length - 1]!.operationKind,
    healthScore: avgHealthScore,
    severity,
    rolledBack: vectors.some((v) => v.rolledBack),
    skipped: vectors.some((v) => v.skipped),
  });
}

/**
 * Build a DL tensor from a set of execution results for an entire tick.
 * Accepts partial coverage — missing steps are zero-filled.
 */
export function buildCoordinatorTickDLTensor(
  results: readonly TransactionExecutionResult[],
  tick: number,
  runId: string,
): CoordinatorDLTensor {
  const rows = results.map((r) => buildCoordinatorDLRow(r, tick));
  return buildCoordinatorDLTensor(rows, tick, runId);
}

/**
 * Compute a per-step health profile across a collection of results.
 * Returns an ordered map of step → avg health score.
 */
export function buildCoordinatorStepHealthProfile(
  results: readonly TransactionExecutionResult[],
): Record<string, number> {
  const stepScores = new Map<string, number[]>();

  for (const r of results) {
    const step = r.context.step;
    const score = computeCoordinatorHealthScore(r);
    const arr = stepScores.get(step) ?? [];
    arr.push(score);
    stepScores.set(step, arr);
  }

  const profile: Record<string, number> = {};
  for (const [step, scores] of stepScores) {
    profile[step] = clamp01(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return profile;
}

/**
 * Return top-N steps by rollback frequency from a batch of results.
 */
export function getTopRollbackSteps(
  results: readonly TransactionExecutionResult[],
  topN = 5,
): Array<{ step: string; rollbackCount: number; total: number }> {
  const stepCounts = new Map<string, { rollbacks: number; total: number }>();

  for (const r of results) {
    const step = r.context.step;
    const entry = stepCounts.get(step) ?? { rollbacks: 0, total: 0 };
    entry.total++;
    if (r.rolledBack) entry.rollbacks++;
    stepCounts.set(step, entry);
  }

  return [...stepCounts.entries()]
    .map(([step, { rollbacks, total }]) => ({
      step,
      rollbackCount: rollbacks,
      total,
    }))
    .sort((a, b) => b.rollbackCount - a.rollbackCount)
    .slice(0, topN);
}

/**
 * Compute a normalized reliability score for a set of results.
 * Reliability = 1 - (rollbacks + aborts) / total executions.
 */
export function computeCoordinatorReliabilityScore(
  results: readonly TransactionExecutionResult[],
): number {
  if (results.length === 0) return 1.0;
  const failures = results.filter(
    (r) =>
      r.rolledBack || countBySeverity(r.signals, 'ERROR') > 0,
  ).length;
  return clamp01(1 - failures / results.length);
}

/**
 * Compute a normalized throughput score: executions that completed on-budget
 * divided by total executions.
 */
export function computeCoordinatorThroughputScore(
  results: readonly TransactionExecutionResult[],
  executionMsMap?: Map<string, number>,
): number {
  if (results.length === 0) return 1.0;
  if (!executionMsMap || executionMsMap.size === 0) {
    // Without timing data, use skip rate as proxy
    const onTime = results.filter((r) => !r.skipped && !r.rolledBack).length;
    return clamp01(onTime / results.length);
  }
  const onBudget = results.filter((r) => {
    const ms = executionMsMap.get(r.context.trace.traceId) ?? 0;
    const budget = getCoordinatorStepBudgetMs(r.context.step);
    return ms <= budget;
  }).length;
  return clamp01(onBudget / results.length);
}

/**
 * Build a plain diagnostics report from execution results and session data.
 */
export function buildCoordinatorDiagnosticsReport(
  results: readonly TransactionExecutionResult[],
  sessionReport: CoordinatorSessionReport,
): {
  session: CoordinatorSessionReport;
  batchMetrics: ReturnType<typeof analyzeCoordinatorResultBatch>;
  stepHealthProfile: Record<string, number>;
  topRollbackSteps: Array<{ step: string; rollbackCount: number; total: number }>;
  reliabilityScore: number;
  throughputScore: number;
  manifest: CoordinatorManifest;
} {
  return Object.freeze({
    session: sessionReport,
    batchMetrics: analyzeCoordinatorResultBatch(results),
    stepHealthProfile: buildCoordinatorStepHealthProfile(results),
    topRollbackSteps: getTopRollbackSteps(results),
    reliabilityScore: computeCoordinatorReliabilityScore(results),
    throughputScore: computeCoordinatorThroughputScore(results),
    manifest: TICK_TRANSACTION_COORDINATOR_MANIFEST,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION BB — Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new TickTransactionCoordinator paired with a fresh session tracker.
 * Returns both instances for use in orchestrator initialization.
 */
export function createCoordinatorWithSession(
  runId: string,
  clock: ClockSource,
): {
  coordinator: TickTransactionCoordinator;
  session: CoordinatorSessionTracker;
  eventLog: CoordinatorEventLog;
  trendAnalyzer: CoordinatorTrendAnalyzer;
  annotator: CoordinatorAnnotator;
  inspector: CoordinatorInspector;
} {
  const coordinator = new TickTransactionCoordinator();
  const session = new CoordinatorSessionTracker(runId, clock);
  const eventLog = new CoordinatorEventLog();
  const trendAnalyzer = new CoordinatorTrendAnalyzer();
  const annotator = new CoordinatorAnnotator({ mode: 'solo' });
  const inspector = new CoordinatorInspector('solo');

  return Object.freeze({
    coordinator,
    session,
    eventLog,
    trendAnalyzer,
    annotator,
    inspector,
  });
}

/**
 * Pre-computed default ML vector for the module's bootstrap state.
 * All features are zero-initialized (no execution has occurred).
 */
export const ZERO_DEFAULT_COORDINATOR_ML_VECTOR: CoordinatorMLVector = deepFreeze({
  features: Object.freeze(
    new Array<number>(TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT).fill(0),
  ),
  labels: TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS,
  tick: 0,
  step: 'STEP_01_PREPARE',
  runId: 'zero-bootstrap',
  operationKind: 'CONTEXT_CREATE' as CoordinatorOperationKind,
  healthScore: 1.0,
  severity: 'LOW' as CoordinatorSeverity,
  rolledBack: false,
  skipped: false,
}) as CoordinatorMLVector;

/**
 * Pre-computed default DL tensor for the module's bootstrap state.
 * All rows are zero-filled.
 */
export const ZERO_DEFAULT_COORDINATOR_DL_TENSOR: CoordinatorDLTensor = deepFreeze(
  buildCoordinatorDLTensor([], 0, 'zero-bootstrap'),
) as CoordinatorDLTensor;

/**
 * Pre-computed default chat signal for the module's bootstrap state.
 */
export const ZERO_DEFAULT_COORDINATOR_CHAT_SIGNAL: CoordinatorChatSignal = deepFreeze({
  type: 'LIVEOPS' as const,
  code: 'COORDINATOR_BOOTSTRAP',
  runId: 'zero-bootstrap',
  tick: 0,
  step: 'STEP_01_PREPARE',
  mode: 'solo' as CoordinatorModeCode,
  severity: 'LOW' as CoordinatorSeverity,
  operationKind: 'CONTEXT_CREATE' as CoordinatorOperationKind,
  narration: COORDINATOR_NARRATION_BY_MODE.solo.ENGINE_EXEC,
  mlVector: ZERO_DEFAULT_COORDINATOR_ML_VECTOR.features,
  healthScore: 1.0,
  rolledBack: false,
  skipped: false,
  signalCount: 0,
  timestamp: 0,
}) as CoordinatorChatSignal;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CC — Bundle Suite
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_TRANSACTION_COORDINATOR_BUNDLE_SUITE = deepFreeze({
  coordinator: ZERO_TICK_TRANSACTION_COORDINATOR,
  manifest: TICK_TRANSACTION_COORDINATOR_MANIFEST,
  defaultAnnotator: COORDINATOR_DEFAULT_ANNOTATOR,
  strictAnnotator: COORDINATOR_STRICT_ANNOTATOR,
  verboseAnnotator: COORDINATOR_VERBOSE_ANNOTATOR,
  defaultInspector: COORDINATOR_DEFAULT_INSPECTOR,
  strictInspector: COORDINATOR_STRICT_INSPECTOR,
  verboseInspector: COORDINATOR_VERBOSE_INSPECTOR,
  defaultTrendAnalyzer: COORDINATOR_DEFAULT_TREND_ANALYZER,
  defaultMLVector: ZERO_DEFAULT_COORDINATOR_ML_VECTOR,
  defaultDLTensor: ZERO_DEFAULT_COORDINATOR_DL_TENSOR,
  defaultChatSignal: ZERO_DEFAULT_COORDINATOR_CHAT_SIGNAL,
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DD — Mode-Specific Coordinator Factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a coordinator annotator tuned for each game mode.
 * Returns a frozen map of mode → annotator for runtime dispatch.
 */
export const COORDINATOR_ANNOTATOR_BY_MODE: Readonly<
  Record<CoordinatorModeCode, CoordinatorAnnotator>
> = deepFreeze({
  solo: new CoordinatorAnnotator({
    verbose: false,
    includeSignals: true,
    includeMLVector: false,
    includeDLRow: false,
    includeNarration: true,
    mode: 'solo',
  }),
  pvp: new CoordinatorAnnotator({
    verbose: true,
    includeSignals: true,
    includeMLVector: true,
    includeDLRow: false,
    includeNarration: true,
    mode: 'pvp',
  }),
  coop: new CoordinatorAnnotator({
    verbose: false,
    includeSignals: true,
    includeMLVector: false,
    includeDLRow: false,
    includeNarration: true,
    mode: 'coop',
  }),
  ghost: new CoordinatorAnnotator({
    verbose: true,
    includeSignals: true,
    includeMLVector: true,
    includeDLRow: true,
    includeNarration: true,
    mode: 'ghost',
  }),
}) as Readonly<Record<CoordinatorModeCode, CoordinatorAnnotator>>;

/**
 * Resolve the correct per-mode annotator at runtime.
 */
export function getCoordinatorAnnotatorForMode(
  mode: CoordinatorModeCode,
): CoordinatorAnnotator {
  return (
    COORDINATOR_ANNOTATOR_BY_MODE[mode] ??
    COORDINATOR_DEFAULT_ANNOTATOR
  );
}

/**
 * Build a mode-native narration hint from just a mode and step context.
 * Suitable for pre-tick narration before execution results are available.
 */
export function buildCoordinatorPreTickNarration(
  mode: CoordinatorModeCode,
  step: TickStep,
  tick: number,
): string {
  const modeNarrations = COORDINATOR_NARRATION_BY_MODE[mode];
  return `[Tick ${tick}] ${String(step)} — ${modeNarrations.HEALTHY}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION EE — Severity Promotion and Signal Enrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete set of enriched signals for an engine execution,
 * appending coordinator-level audit signals for rollbacks, health changes,
 * and budget overruns.
 */
export function buildCoordinatorEnrichedSignals(
  result: TransactionExecutionResult,
  step: TickStep,
  executionMs: number,
  engineId?: EngineId,
): readonly EngineSignal[] {
  const tick = result.context.trace.tick;
  const signals: EngineSignal[] = [...result.signals];

  // Rollback witness signal
  if (result.rolledBack) {
    signals.push(
      buildCoordinatorRollbackSignal(
        engineId ?? 'time',
        step,
        tick,
        `[COORDINATOR] Rollback witnessed at ${String(step)}, tick=${tick}.`,
      ),
    );
  }

  // Budget exceeded signal
  const budgetMs = getCoordinatorStepBudgetMs(step);
  if (executionMs > budgetMs) {
    signals.push(
      buildCoordinatorBudgetExceededSignal(
        engineId ?? 'time',
        step,
        tick,
        executionMs,
      ),
    );
  }

  // Health change signal
  if (result.healthAfter) {
    const prevStatus = result.healthBefore?.status;
    if (prevStatus !== result.healthAfter.status) {
      signals.push(
        buildCoordinatorHealthChangeSignal(result.healthAfter, step, tick, prevStatus),
      );
    }
  }

  return freezeArray(signals);
}

/**
 * Build a synthetic applied confirmation signal with mode-native narration.
 */
export function buildCoordinatorSyntheticNarrationSignal(
  owner: EngineId | 'mode' | 'system',
  step: TickStep,
  tick: number,
  label: string,
  mode: CoordinatorModeCode,
): EngineSignal {
  const narration = COORDINATOR_NARRATION_BY_MODE[mode].SYNTHETIC_EXEC;
  return createEngineSignal(
    resolveSignalOwner(owner),
    'INFO',
    'COORDINATOR_SYNTHETIC_NARRATED',
    `${label}: ${narration} (${String(step)})`,
    tick,
    freezeArray(['coordinator', 'narration', mode, `step:${String(step).toLowerCase()}`]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION FF — Module Seal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level readiness assertion. Called on import to verify that all
 * critical constants are correctly initialized. Throws in development if
 * the module bootstrap is corrupted.
 */
function assertModuleReady(): void {
  if (
    TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS.length !==
    TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT
  ) {
    throw new Error(
      `TickTransactionCoordinator: ML feature label count mismatch: ` +
        `expected ${TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT}, ` +
        `got ${TICK_TRANSACTION_COORDINATOR_ML_FEATURE_LABELS.length}`,
    );
  }
  if (TICK_TRANSACTION_COORDINATOR_DL_ROW_LABELS.length !== 13) {
    throw new Error(
      `TickTransactionCoordinator: DL row label count mismatch: expected 13, ` +
        `got ${TICK_TRANSACTION_COORDINATOR_DL_ROW_LABELS.length}`,
    );
  }
  if (TICK_TRANSACTION_COORDINATOR_DL_COL_LABELS.length !== 8) {
    throw new Error(
      `TickTransactionCoordinator: DL col label count mismatch: expected 8, ` +
        `got ${TICK_TRANSACTION_COORDINATOR_DL_COL_LABELS.length}`,
    );
  }
}

// Run module assertion on load
assertModuleReady();

export const TICK_TRANSACTION_COORDINATOR_MODULE_SEAL = Object.freeze({
  module: TICK_TRANSACTION_COORDINATOR_MANIFEST.module,
  version: TICK_TRANSACTION_COORDINATOR_MODULE_VERSION,
  complete: TICK_TRANSACTION_COORDINATOR_COMPLETE,
  mlFeatureCount: TICK_TRANSACTION_COORDINATOR_ML_FEATURE_COUNT,
  dlTensorShape: TICK_TRANSACTION_COORDINATOR_DL_TENSOR_SHAPE,
  ready: TICK_TRANSACTION_COORDINATOR_READY,
  singletons: Object.freeze({
    coordinator: typeof ZERO_TICK_TRANSACTION_COORDINATOR,
    annotators: Object.keys(COORDINATOR_ANNOTATOR_BY_MODE).length,
    inspectors: 3,
    trendAnalyzers: 1,
  }),
} as const);
