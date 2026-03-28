// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickStepRunner.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickStepRunner.ts
 * VERSION: 2026.03.28
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 *
 * ── CORE DOCTRINE ─────────────────────────────────────────────────────────────
 * One step in, one normalized report out.
 * Step running must preserve backend/core tick law, not reinterpret it.
 * Engine steps, synthetic steps, and finalization steps share one reporting format.
 * Zero may enrich reports, but must not hide skipped, rolled-back, or degraded execution.
 *
 * The 13-step tick sequence is law:
 *   STEP_01_PREPARE → STEP_02_TIME → STEP_03_PRESSURE → STEP_04_TENSION
 *   → STEP_05_BATTLE → STEP_06_SHIELD → STEP_07_CASCADE → STEP_08_MODE_POST
 *   → STEP_09_TELEMETRY → STEP_10_SOVEREIGNTY_SNAPSHOT → STEP_11_OUTCOME_GATE
 *   → STEP_12_EVENT_SEAL → STEP_13_FLUSH
 *
 * ── EXTENDED DOCTRINE (ML / DL ANALYTICS LAYER) ──────────────────────────────
 * Every step execution is observable, measurable, and narrated.
 * The 32-dimensional ML feature vector encodes full step execution posture for
 * real-time inference: phase one-hot, owner one-hot, timing norms, signal
 * density, error rates, budget utilization, and session analytics.
 * The 13-row × 8-column DL tensor encodes the execution profile of every
 * canonical tick step, enabling deep learning over full tick patterns.
 *
 * Health scores are ML-derived from step timing + error density + rollback rates.
 * Trend analysis surfaces step degradation before it becomes critical.
 * Session tracking enables long-arc run intelligence across ticks.
 * Chat signals route companion behavior based on step pressure.
 * Annotation bundles serve proof, replay, and transcript integrity.
 *
 * ── SOCIAL PRESSURE ENGINE ────────────────────────────────────────────────────
 * Step failure is a social signal — not just an engine error.
 * When a step exceeds budget or rolls back, the companion escalates.
 * The witness layer records every execution for proof-bearing transcripts.
 * Mode-native narration adapts to the player's sovereign context.
 *
 * ── FOUR GAME MODES ───────────────────────────────────────────────────────────
 * - Empire   (solo)  — GO ALONE — sovereign dominance, full self-reliance
 * - Predator (pvp)   — HEAD TO HEAD — rivalry pressure, witness enforcement
 * - Syndicate(coop)  — TEAM UP — shared treasury, role-bound step discipline
 * - Phantom  (ghost) — CHASE A LEGEND — legend gap state, execution urgency
 */

// ─── IMPORTS ─────────────────────────────────────────────────────────────────

import type {
  EngineId,
  EngineHealth,
  EngineHealthStatus,
  EngineSignal,
  EngineSignalCategory,
  EngineSignalSeverity,
  EngineStepMetrics,
  EngineStepPolicy,
  SignalAggregatorReport,
  SimulationEngine,
  TickContext,
  TickStepMetrics,
} from '../core/EngineContracts';
import {
  ALL_ENGINE_IDS,
  DEFAULT_ENGINE_STEP_POLICIES,
  ENGINE_STEP_SLOTS,
  EngineSignalAggregator,
  buildEngineStepMetrics,
  buildTickStepMetrics,
  createContractViolationSignal,
  createEngineErrorSignal,
  createEngineHealth,
  createEngineSignal,
  createEngineSignalFull,
  getEngineStepPolicy,
  isEngineEligibleAtStep,
  isEngineRequiredAtStep,
  normalizeEngineTickResult,
} from '../core/EngineContracts';
import { cloneJson, deepFreeze } from '../core/Deterministic';
import { EventBus } from '../core/EventBus';
import type {
  EngineEventMap,
  IntegrityStatus,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
} from '../core/GamePrimitives';
import { MODE_CODES, PRESSURE_TIERS } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  ENGINE_EXECUTION_STEPS,
  TICK_DL_FEATURE_COUNT,
  TICK_DL_FEATURE_LABELS,
  TICK_ML_FEATURE_COUNT,
  TICK_ML_FEATURE_LABELS,
  TICK_SEQUENCE,
  TICK_STEP_BUDGET_MS,
  TICK_STEP_DESCRIPTORS,
  type TickStep,
  type TickStepDescriptor,
  type TickStepOwner,
  type TickStepPhase,
  getTickStepDescriptor,
  isEngineExecutionStep,
} from '../core/TickSequence';
import {
  TickTransactionCoordinator,
  type RuntimeBus,
  type TransactionExecutionResult,
} from './TickTransactionCoordinator';
import {
  ZERO_CANONICAL_TICK_SEQUENCE,
  ZERO_STEP_RUNTIME_OWNERS,
  ZERO_TICK_STEP_DESCRIPTORS,
} from './zero.types';

// ─── MODULE CONSTANTS ─────────────────────────────────────────────────────────

/** Semantic version of this module. */
export const TICK_STEP_RUNNER_MODULE_VERSION = '2026.03.28' as const;

/** Schema identifier for serialization compatibility. */
export const TICK_STEP_RUNNER_SCHEMA = 'tick-step-runner-v1' as const;

/** Runtime readiness flag. Always true after module load. */
export const TICK_STEP_RUNNER_READY = true as const;

/** ML feature vector dimensionality — 32 dimensions. */
export const TICK_STEP_RUNNER_ML_FEATURE_COUNT: number = TICK_ML_FEATURE_COUNT;

/** DL tensor shape — 13 steps × 8 columns. */
export const TICK_STEP_RUNNER_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);

/** DL feature vector dimensionality — 48 dimensions. */
export const TICK_STEP_RUNNER_DL_FEATURE_COUNT: number = TICK_DL_FEATURE_COUNT;

/** Maximum heat multiplier for companion routing. */
export const TICK_STEP_RUNNER_MAX_HEAT = 1.0 as const;

/** Step budget multiplier threshold before a step is flagged as slow. */
export const TICK_STEP_RUNNER_SLOW_MULTIPLIER = 3 as const;

/** Duration (ms) beyond which a step execution report triggers WARNING severity. */
export const TICK_STEP_RUNNER_WARN_DURATION_MS = TICK_STEP_BUDGET_MS * TICK_STEP_RUNNER_SLOW_MULTIPLIER;

/** Event prefix for world event routing. */
export const TICK_STEP_RUNNER_WORLD_EVENT_PREFIX = 'tick_step_runner' as const;

/** Maximum session entries retained per tracker. */
export const TICK_STEP_RUNNER_DEFAULT_SESSION_MAX = 500 as const;

/** Trend window size for health rolling average. */
export const TICK_STEP_RUNNER_TREND_WINDOW_SIZE = 10 as const;

/** Derived from zero.types — canonical tick step count (always 13). */
export const TICK_STEP_RUNNER_STEP_COUNT: number = ZERO_CANONICAL_TICK_SEQUENCE.length;

/** Derived from zero.types — step runtime owner cardinality. */
export const TICK_STEP_RUNNER_OWNER_COUNT: number = ZERO_STEP_RUNTIME_OWNERS.length;

/** Derived from EngineContracts — total engine count (always 7). */
export const TICK_STEP_RUNNER_ENGINE_COUNT: number = ALL_ENGINE_IDS.length;

/** Derived from TickSequence — engine execution step count (always 6). */
export const TICK_STEP_RUNNER_ENGINE_STEP_COUNT: number = ENGINE_EXECUTION_STEPS.length;

/** Canonical mode order for ML one-hot encoding. */
export const TICK_STEP_RUNNER_MODE_ORDER: readonly ModeCode[] = Object.freeze([...MODE_CODES]);

/** Canonical pressure tier order for ML normalization. */
export const TICK_STEP_RUNNER_PRESSURE_TIER_ORDER: readonly PressureTier[] = Object.freeze([
  ...PRESSURE_TIERS,
]);

/**
 * Per-step engine assignment table — authoritative mapping for the 6 engine steps.
 * Steps not in this map execute as synthetic (system-owned) steps.
 */
export const TICK_STEP_ENGINE_ASSIGNMENT: Readonly<Partial<Record<TickStep, EngineId>>> =
  Object.freeze({
    STEP_02_TIME: 'time',
    STEP_03_PRESSURE: 'pressure',
    STEP_04_TENSION: 'tension',
    STEP_05_BATTLE: 'battle',
    STEP_06_SHIELD: 'shield',
    STEP_07_CASCADE: 'cascade',
  } satisfies Partial<Record<TickStep, EngineId>>);

/**
 * Slot count per step — how many actors are registered for each canonical step.
 * Derived live from ENGINE_STEP_SLOTS at module load.
 */
export const TICK_STEP_SLOT_COUNTS: Readonly<Record<TickStep, number>> = Object.freeze(
  Object.fromEntries(
    TICK_SEQUENCE.map((step) => [step, ENGINE_STEP_SLOTS[step].length]),
  ) as Record<TickStep, number>,
);

/**
 * Default max step budget (ms) per engine — derived from DEFAULT_ENGINE_STEP_POLICIES.
 * Used in budget utilization scoring.
 */
export const TICK_STEP_ENGINE_BUDGETS: Readonly<Record<EngineId, number>> = Object.freeze(
  Object.fromEntries(
    ALL_ENGINE_IDS.map((id) => [id, DEFAULT_ENGINE_STEP_POLICIES[id].maxStepMs]),
  ) as Record<EngineId, number>,
);

// ─── SEVERITY + OPERATION KIND + ADAPTER MODE ─────────────────────────────────

/**
 * Step-level severity classification.
 * Drives companion routing, heat multiplier, and chat signal emission.
 *
 * LOW      — nominal execution, advisory optional
 * MEDIUM   — elevated duration or warning density, companion coaching fires
 * HIGH     — over-budget or error density, companion escalates
 * CRITICAL — rollback or contract violation, rescue + max heat fires
 */
export type TickStepRunnerSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Operation kind for annotation and event log routing.
 */
export type TickStepRunnerOperationKind =
  | 'ENGINE_STEP'
  | 'SYNTHETIC_STEP'
  | 'NOOP_STEP'
  | 'ROLLBACK'
  | 'SKIP'
  | 'CONTRACT_VIOLATION'
  | 'BUDGET_EXCEEDED'
  | 'HEALTH_CHANGE';

/**
 * Adapter mode controlling signal emission thresholds.
 *
 * DEFAULT  — emits for MEDIUM/HIGH/CRITICAL
 * STRICT   — emits only for HIGH/CRITICAL
 * VERBOSE  — emits for all including LOW; full ML vector
 */
export type TickStepRunnerAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─── CONTEXT INTERFACES ───────────────────────────────────────────────────────

/**
 * Full run context passed into analytics and narration functions.
 * Carries mode, phase, pressure tier, and optional outcome/snapshot.
 */
export interface TickStepRunnerRunContext {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly outcome: RunOutcome | null;
  readonly snapshot: RunStateSnapshot | null;
  readonly integrityStatus: IntegrityStatus | null;
}

/**
 * Step-level execution context for DL tensor construction and narration.
 */
export interface TickStepRunnerStepContext {
  readonly step: TickStep;
  readonly ordinal: number;
  readonly phase: TickStepPhase;
  readonly owner: TickStepOwner;
  readonly engineId: EngineId | 'mode' | 'system' | null;
  readonly durationMs: number;
  readonly budgetMs: number;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly warnCount: number;
  readonly skipped: boolean;
  readonly rolledBack: boolean;
  readonly overBudget: boolean;
}

/**
 * Scored step execution summary for companion routing and ML output.
 */
export interface TickStepRunnerScoreResult {
  readonly severity: TickStepRunnerSeverity;
  readonly healthGrade: number;
  readonly heatMultiplier: number;
  readonly budgetUtilization: number;
  readonly anomalyScore: number;
  readonly narrationKey: string;
  readonly tags: readonly string[];
}

/**
 * ML 32-dim feature vector extracted from a step execution report.
 */
export interface TickStepRunnerMLVector {
  readonly features: Float32Array;
  readonly labels: readonly string[];
  readonly step: TickStep;
  readonly tick: number;
  readonly extractedAtMs: number;
}

/**
 * DL tensor row for a single step in the 13-step tick sequence.
 * Shape: [13 × 8].
 */
export interface TickStepRunnerDLRow {
  readonly stepOrdinalNorm: number;
  readonly durationNorm: number;
  readonly budgetUtilization: number;
  readonly errorRate: number;
  readonly signalDensityNorm: number;
  readonly skippedFlag: number;
  readonly rolledBackFlag: number;
  readonly overBudgetFlag: number;
}

/**
 * Full DL tensor covering all 13 canonical tick steps.
 */
export interface TickStepRunnerDLTensor {
  readonly rows: readonly TickStepRunnerDLRow[];
  readonly shape: readonly [13, 8];
  readonly tick: number;
  readonly builtAtMs: number;
  readonly featureLabels: readonly string[];
}

/**
 * Annotation bundle emitted per step execution.
 * Serves proof, replay, and transcript integrity.
 */
export interface TickStepRunnerAnnotation {
  readonly id: string;
  readonly step: TickStep;
  readonly tick: number;
  readonly runId: string;
  readonly severity: TickStepRunnerSeverity;
  readonly operationKind: TickStepRunnerOperationKind;
  readonly message: string;
  readonly tags: readonly string[];
  readonly mlVector: Float32Array | null;
  readonly durationMs: number;
  readonly signalCount: number;
  readonly createdAtMs: number;
}

/**
 * Session entry tracking a single step execution across the run arc.
 */
export interface TickStepRunnerSessionEntry {
  readonly step: TickStep;
  readonly tick: number;
  readonly durationMs: number;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly skipped: boolean;
  readonly rolledBack: boolean;
  readonly severity: TickStepRunnerSeverity;
  readonly recordedAtMs: number;
}

/**
 * Trend snapshot for a single step over the rolling window.
 */
export interface TickStepRunnerTrendSnapshot {
  readonly step: TickStep;
  readonly windowSize: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly minDurationMs: number;
  readonly errorRate: number;
  readonly rollbackRate: number;
  readonly skipRate: number;
  readonly overBudgetRate: number;
  readonly healthTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly computedAtMs: number;
}

// ─── CORE EXPORTED INTERFACES ─────────────────────────────────────────────────

export interface StepHandlerResult {
  readonly snapshot: RunStateSnapshot;
  readonly signals?: readonly EngineSignal[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type StepHandler = (
  snapshot: RunStateSnapshot,
  context: TickContext,
) => RunStateSnapshot | StepHandlerResult;

export interface TickStepRunnerHandlers {
  readonly STEP_01_PREPARE?: StepHandler;
  readonly STEP_08_MODE_POST?: StepHandler;
  readonly STEP_09_TELEMETRY?: StepHandler;
  readonly STEP_10_SOVEREIGNTY_SNAPSHOT?: StepHandler;
  readonly STEP_11_OUTCOME_GATE?: StepHandler;
  readonly STEP_12_EVENT_SEAL?: StepHandler;
  readonly STEP_13_FLUSH?: StepHandler;
}

export interface TickStepRunnerArgs {
  readonly snapshot: RunStateSnapshot;
  readonly step: TickStep;
  readonly nowMs: number;
  readonly traceId?: string;
}

export interface StepExecutionReport {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
  readonly engineId: EngineId | 'mode' | 'system' | null;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly inputSnapshot: RunStateSnapshot;
  readonly outputSnapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly skipped: boolean;
  readonly rolledBack: boolean;
  readonly metadata: Readonly<Record<string, unknown>> | null;
}

// ─── INTERNAL TYPE ALIASES ────────────────────────────────────────────────────

type StepToEngineMap = Partial<Record<TickStep, EngineId>>;

// ─── MODULE-LEVEL CONSTANTS (INTERNAL) ───────────────────────────────────────

const STEP_TO_ENGINE: StepToEngineMap = Object.freeze({
  STEP_02_TIME: 'time',
  STEP_03_PRESSURE: 'pressure',
  STEP_04_TENSION: 'tension',
  STEP_05_BATTLE: 'battle',
  STEP_06_SHIELD: 'shield',
  STEP_07_CASCADE: 'cascade',
});

// ─── UTILITY FUNCTIONS (INTERNAL) ─────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function toFrozenSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return deepFreeze(cloneJson(snapshot)) as RunStateSnapshot;
}

function defaultSystemSignal(
  step: TickStep,
  tick: number,
  code: string,
  message: string,
): EngineSignal {
  return createEngineSignal(
    'mode',
    'INFO',
    code,
    message,
    tick,
    freezeArray(['zero', `step:${step.toLowerCase()}`]),
  );
}

function clampNorm(value: number): number {
  return Math.min(1, Math.max(0, isFinite(value) ? value : 0));
}

function generateAnnotationId(step: TickStep, tick: number, nowMs: number): string {
  return `tsr_${step.toLowerCase()}_t${tick}_${nowMs.toString(36)}`;
}

function classifyStepSeverity(
  durationMs: number,
  errorCount: number,
  rolledBack: boolean,
  overBudget: boolean,
): TickStepRunnerSeverity {
  if (rolledBack || errorCount >= 3) return 'CRITICAL';
  if (overBudget || errorCount >= 1) return 'HIGH';
  if (durationMs > TICK_STEP_BUDGET_MS) return 'MEDIUM';
  return 'LOW';
}

function resolveStepBudgetMs(engineId: EngineId | 'mode' | 'system' | null): number {
  if (engineId === null || engineId === 'mode' || engineId === 'system') {
    return TICK_STEP_BUDGET_MS;
  }
  const policy = getEngineStepPolicy(engineId);
  return policy.maxStepMs;
}

function countSignalsBySeverity(
  signals: readonly EngineSignal[],
  severity: EngineSignalSeverity,
): number {
  return signals.filter((s) => s.severity === severity).length;
}

function countSignalsByCategory(
  signals: readonly EngineSignal[],
  category: EngineSignalCategory,
): number {
  return signals.filter((s) => s.category === category).length;
}

function buildStepRunnerContext(
  report: StepExecutionReport,
): TickStepRunnerStepContext {
  const descriptor = report.descriptor;
  const engineId = report.engineId;
  const budgetMs = resolveStepBudgetMs(engineId);
  const errorCount = countSignalsBySeverity(report.signals, 'ERROR');
  const warnCount = countSignalsBySeverity(report.signals, 'WARN');
  const overBudget = report.durationMs > budgetMs;

  return {
    step: report.step,
    ordinal: descriptor.ordinal,
    phase: descriptor.phase,
    owner: descriptor.owner,
    engineId,
    durationMs: report.durationMs,
    budgetMs,
    signalCount: report.signals.length,
    errorCount,
    warnCount,
    skipped: report.skipped,
    rolledBack: report.rolledBack,
    overBudget,
  };
}

// ─── ML FEATURE VECTOR EXTRACTION ─────────────────────────────────────────────

/**
 * Extract the 32-dimensional ML feature vector from a step execution report.
 * All values are normalized to [0, 1].
 *
 * Feature layout (mirrors TICK_ML_FEATURE_LABELS):
 *   [0]  step_ordinal_norm
 *   [1]  is_orchestration_phase
 *   [2]  is_engine_phase
 *   [3]  is_mode_phase
 *   [4]  is_observability_phase
 *   [5]  is_finalization_phase
 *   [6]  is_system_owner
 *   [7]  is_time_owner
 *   [8]  is_pressure_owner
 *   [9]  is_tension_owner
 *   [10] is_battle_owner
 *   [11] is_shield_owner
 *   [12] is_cascade_owner
 *   [13] is_mode_owner
 *   [14] is_telemetry_owner
 *   [15] is_sovereignty_owner
 *   [16] mutates_state
 *   [17] is_engine_execution
 *   [18] step_duration_norm
 *   [19] avg_step_duration_norm
 *   [20] max_step_duration_norm
 *   [21] step_error_rate
 *   [22] phase_completion_ratio
 *   [23] sequence_completion_ratio
 *   [24] slow_step_flag
 *   [25] recent_error_count_norm
 *   [26] step_success_rate
 *   [27] health_grade_numeric
 *   [28] engine_execution_load_ratio
 *   [29] anomaly_score
 *   [30] step_since_last_error_norm
 *   [31] phase_error_ratio
 */
export function extractStepMLVector(
  report: StepExecutionReport,
  opts: {
    readonly avgDurationMs?: number;
    readonly maxDurationMs?: number;
    readonly recentErrorCount?: number;
    readonly stepSuccessRate?: number;
    readonly healthGrade?: number;
    readonly phaseCompletionRatio?: number;
    readonly sequenceCompletionRatio?: number;
    readonly stepsSinceLastError?: number;
    readonly phaseErrorRatio?: number;
  } = {},
): TickStepRunnerMLVector {
  const ctx = buildStepRunnerContext(report);
  const descriptor = report.descriptor;
  const budgetMs = ctx.budgetMs;
  const maxBudget = Math.max(budgetMs, 50);

  const avgDurationMs = opts.avgDurationMs ?? report.durationMs;
  const maxDurationMs = opts.maxDurationMs ?? report.durationMs;
  const stepSuccessRate = opts.stepSuccessRate ?? (report.rolledBack ? 0 : 1);
  const healthGrade = clampNorm(opts.healthGrade ?? (report.rolledBack ? 0 : 1 - ctx.errorCount * 0.1));
  const engineExecStepCount = ENGINE_EXECUTION_STEPS.length;
  const totalStepCount = TICK_SEQUENCE.length;
  const engineExecLoadRatio = engineExecStepCount / totalStepCount;

  const features = new Float32Array(TICK_STEP_RUNNER_ML_FEATURE_COUNT);

  // [0] step_ordinal_norm
  features[0] = clampNorm((descriptor.ordinal - 1) / (totalStepCount - 1));
  // [1-5] phase one-hot
  features[1] = descriptor.phase === 'ORCHESTRATION' ? 1 : 0;
  features[2] = descriptor.phase === 'ENGINE' ? 1 : 0;
  features[3] = descriptor.phase === 'MODE' ? 1 : 0;
  features[4] = descriptor.phase === 'OBSERVABILITY' ? 1 : 0;
  features[5] = descriptor.phase === 'FINALIZATION' ? 1 : 0;
  // [6-15] owner one-hot
  features[6] = descriptor.owner === 'system' ? 1 : 0;
  features[7] = descriptor.owner === 'time' ? 1 : 0;
  features[8] = descriptor.owner === 'pressure' ? 1 : 0;
  features[9] = descriptor.owner === 'tension' ? 1 : 0;
  features[10] = descriptor.owner === 'battle' ? 1 : 0;
  features[11] = descriptor.owner === 'shield' ? 1 : 0;
  features[12] = descriptor.owner === 'cascade' ? 1 : 0;
  features[13] = descriptor.owner === 'mode' ? 1 : 0;
  features[14] = descriptor.owner === 'telemetry' ? 1 : 0;
  features[15] = descriptor.owner === 'sovereignty' ? 1 : 0;
  // [16] mutates_state
  features[16] = descriptor.mutatesState ? 1 : 0;
  // [17] is_engine_execution
  features[17] = isEngineExecutionStep(report.step) ? 1 : 0;
  // [18] step_duration_norm
  features[18] = clampNorm(report.durationMs / maxBudget);
  // [19] avg_step_duration_norm
  features[19] = clampNorm(avgDurationMs / maxBudget);
  // [20] max_step_duration_norm
  features[20] = clampNorm(maxDurationMs / maxBudget);
  // [21] step_error_rate
  features[21] = clampNorm(ctx.errorCount / Math.max(1, ctx.signalCount));
  // [22] phase_completion_ratio
  features[22] = clampNorm(opts.phaseCompletionRatio ?? 0);
  // [23] sequence_completion_ratio
  features[23] = clampNorm(opts.sequenceCompletionRatio ?? (descriptor.ordinal / totalStepCount));
  // [24] slow_step_flag
  features[24] = ctx.overBudget ? 1 : 0;
  // [25] recent_error_count_norm
  features[25] = clampNorm((opts.recentErrorCount ?? ctx.errorCount) / 10);
  // [26] step_success_rate
  features[26] = clampNorm(stepSuccessRate);
  // [27] health_grade_numeric
  features[27] = healthGrade;
  // [28] engine_execution_load_ratio
  features[28] = clampNorm(engineExecLoadRatio);
  // [29] anomaly_score
  const anomaly = (ctx.overBudget ? 0.4 : 0) + (report.rolledBack ? 0.5 : 0) + (ctx.errorCount > 0 ? 0.1 : 0);
  features[29] = clampNorm(anomaly);
  // [30] step_since_last_error_norm
  features[30] = clampNorm((opts.stepsSinceLastError ?? totalStepCount) / totalStepCount);
  // [31] phase_error_ratio
  features[31] = clampNorm(opts.phaseErrorRatio ?? (ctx.errorCount > 0 ? 0.2 : 0));

  return Object.freeze({
    features,
    labels: TICK_ML_FEATURE_LABELS,
    step: report.step,
    tick: report.inputSnapshot.tick ?? 0,
    extractedAtMs: Date.now(),
  });
}

// ─── DL TENSOR CONSTRUCTION ───────────────────────────────────────────────────

/**
 * Build a single DL row for a step in the 13-step tick sequence.
 * Used to construct the full 13 × 8 DL tensor for a complete tick.
 */
export function buildStepDLRow(
  report: StepExecutionReport,
  opts: { maxBudgetMs?: number } = {},
): TickStepRunnerDLRow {
  const ctx = buildStepRunnerContext(report);
  const totalSteps = TICK_SEQUENCE.length;
  const maxBudget = opts.maxBudgetMs ?? Math.max(ctx.budgetMs, 50);

  return Object.freeze({
    stepOrdinalNorm: clampNorm((report.descriptor.ordinal - 1) / (totalSteps - 1)),
    durationNorm: clampNorm(report.durationMs / maxBudget),
    budgetUtilization: clampNorm(report.durationMs / ctx.budgetMs),
    errorRate: clampNorm(ctx.errorCount / Math.max(1, ctx.signalCount)),
    signalDensityNorm: clampNorm(ctx.signalCount / 20),
    skippedFlag: report.skipped ? 1 : 0,
    rolledBackFlag: report.rolledBack ? 1 : 0,
    overBudgetFlag: ctx.overBudget ? 1 : 0,
  });
}

/**
 * Build the full DL tensor (13 rows × 8 columns) from a complete set of step
 * execution reports for one tick. Missing steps are filled with zero rows.
 *
 * Feature labels for the 8 columns:
 *   step_ordinal_norm, duration_norm, budget_utilization, error_rate,
 *   signal_density_norm, skipped_flag, rolled_back_flag, over_budget_flag
 */
export function buildTickDLTensor(
  reports: readonly StepExecutionReport[],
  tick: number,
): TickStepRunnerDLTensor {
  const reportByStep = new Map<TickStep, StepExecutionReport>();
  for (const r of reports) {
    reportByStep.set(r.step, r);
  }

  const rows = ZERO_CANONICAL_TICK_SEQUENCE.map((step): TickStepRunnerDLRow => {
    const r = reportByStep.get(step);
    if (!r) {
      const descriptor = ZERO_TICK_STEP_DESCRIPTORS[step];
      const totalSteps = ZERO_CANONICAL_TICK_SEQUENCE.length;
      return Object.freeze({
        stepOrdinalNorm: clampNorm((descriptor.ordinal - 1) / (totalSteps - 1)),
        durationNorm: 0,
        budgetUtilization: 0,
        errorRate: 0,
        signalDensityNorm: 0,
        skippedFlag: 1,
        rolledBackFlag: 0,
        overBudgetFlag: 0,
      });
    }
    return buildStepDLRow(r);
  });

  const dlFeatureLabels = TICK_DL_FEATURE_LABELS.slice(0, 8);

  return Object.freeze({
    rows: Object.freeze(rows),
    shape: Object.freeze([13, 8] as const),
    tick,
    builtAtMs: Date.now(),
    featureLabels: Object.freeze(dlFeatureLabels),
  });
}

// ─── STEP HEALTH SCORING ──────────────────────────────────────────────────────

/**
 * Score a step execution report and return a full score result.
 * Used for companion routing, heat computation, and ML signal emission.
 */
export function scoreStepExecution(
  report: StepExecutionReport,
  opts: { avgDurationMs?: number; maxDurationMs?: number } = {},
): TickStepRunnerScoreResult {
  const ctx = buildStepRunnerContext(report);
  const severity = classifyStepSeverity(
    report.durationMs,
    ctx.errorCount,
    report.rolledBack,
    ctx.overBudget,
  );

  const heatMap: Record<TickStepRunnerSeverity, number> = {
    LOW: 0.1,
    MEDIUM: 0.4,
    HIGH: 0.7,
    CRITICAL: 1.0,
  };
  const heatMultiplier = heatMap[severity];
  const budgetUtilization = clampNorm(report.durationMs / ctx.budgetMs);
  const anomalyScore = clampNorm(
    (ctx.overBudget ? 0.4 : 0) + (report.rolledBack ? 0.5 : 0) + (ctx.errorCount > 0 ? 0.1 : 0),
  );
  const healthGrade = clampNorm(
    1 - ctx.errorCount * 0.2 - (report.rolledBack ? 0.5 : 0) - anomalyScore * 0.3,
  );

  const tags: string[] = ['zero', 'tick_step_runner', `step:${report.step.toLowerCase()}`];
  if (ctx.overBudget) tags.push('over_budget');
  if (report.rolledBack) tags.push('rolled_back');
  if (report.skipped) tags.push('skipped');
  if (ctx.errorCount > 0) tags.push('has_errors');

  const modeMap: Record<TickStepRunnerSeverity, string> = {
    LOW: `step_ok:${report.step}`,
    MEDIUM: `step_slow:${report.step}`,
    HIGH: `step_degraded:${report.step}`,
    CRITICAL: `step_critical:${report.step}`,
  };

  return Object.freeze({
    severity,
    healthGrade,
    heatMultiplier,
    budgetUtilization,
    anomalyScore,
    narrationKey: modeMap[severity],
    tags: freezeArray(tags),
  });
}

// ─── ENGINE STEP VALIDATION HELPERS ──────────────────────────────────────────

/**
 * Validate that an engine is eligible to run at the given step.
 * Returns a contract violation signal if not eligible.
 */
export function validateEngineEligibility(
  engineId: EngineId,
  step: TickStep,
  tick: number,
): EngineSignal | null {
  if (!isEngineEligibleAtStep(engineId, step)) {
    return createContractViolationSignal(
      engineId,
      'ENGINE_ELIGIBILITY',
      `Engine ${engineId} is not eligible to run at ${step}.`,
      tick,
    );
  }
  return null;
}

/**
 * Check whether an engine is required at the given step.
 * Returns an error signal if the engine was absent when required.
 */
export function checkRequiredEnginePresence(
  engineId: EngineId,
  step: TickStep,
  present: boolean,
  tick: number,
): EngineSignal | null {
  if (isEngineRequiredAtStep(engineId, step) && !present) {
    return createEngineErrorSignal(
      engineId,
      'ZERO_REQUIRED_ENGINE_ABSENT',
      `Engine ${engineId} is required at ${step} but is not bound.`,
      tick,
    );
  }
  return null;
}

/**
 * Build a health record for an engine from a step execution result.
 * Status is HEALTHY on success, DEGRADED on error, FAILED on rollback.
 */
export function buildEngineHealthFromReport(
  engineId: EngineId,
  report: StepExecutionReport,
  nowMs: number,
): EngineHealth {
  const errorCount = countSignalsBySeverity(report.signals, 'ERROR');
  let status: EngineHealthStatus;
  const notes: string[] = [];

  if (report.rolledBack) {
    status = 'FAILED';
    notes.push(`Rolled back at ${report.step}.`);
  } else if (errorCount > 0) {
    status = 'DEGRADED';
    notes.push(`${errorCount} error signal(s) at ${report.step}.`);
  } else {
    status = 'HEALTHY';
  }

  return createEngineHealth(engineId, status, nowMs, freezeArray(notes));
}

/**
 * Build an EngineStepMetrics record from a step execution report.
 * Bridges TickStepRunner reporting into the core EngineContracts surface.
 */
export function buildStepMetricsFromReport(
  engineId: EngineId,
  tick: number,
  report: StepExecutionReport,
): EngineStepMetrics {
  const mutated = !report.skipped && !report.rolledBack;
  return buildEngineStepMetrics(
    engineId,
    report.step,
    tick,
    report.startedAtMs,
    report.endedAtMs,
    report.signals,
    report.skipped,
    mutated,
  );
}

/**
 * Build a TickStepMetrics aggregate from an array of step execution reports.
 * Only includes reports that have an EngineId owner (non-system, non-mode).
 */
export function buildTickMetricsFromReports(
  tick: number,
  reports: readonly StepExecutionReport[],
): TickStepMetrics {
  const engineReports = reports.filter(
    (r): r is StepExecutionReport & { engineId: EngineId } =>
      r.engineId !== null && r.engineId !== 'mode' && r.engineId !== 'system',
  );
  const stepMetrics = engineReports.map((r) =>
    buildStepMetricsFromReport(r.engineId as EngineId, tick, r),
  );
  return buildTickStepMetrics(tick, stepMetrics);
}

// ─── SIGNAL ENRICHMENT ────────────────────────────────────────────────────────

/**
 * Emit a full enriched engine signal for a step that exceeded budget.
 * Categorized as 'timing' for downstream routing.
 */
export function buildBudgetExceededSignal(
  step: TickStep,
  engineId: EngineId | 'mode',
  durationMs: number,
  budgetMs: number,
  tick: number,
): EngineSignal {
  return createEngineSignalFull(
    engineId,
    'WARN',
    'ZERO_STEP_OVER_BUDGET',
    `Step ${step} took ${durationMs}ms, exceeding ${budgetMs}ms budget.`,
    tick,
    'timing',
    freezeArray(['zero', 'tick_step_runner', 'over_budget', `step:${step.toLowerCase()}`]),
    durationMs,
    { durationMs, budgetMs, overshootMs: durationMs - budgetMs },
  );
}

/**
 * Emit an ML-category signal for step execution reporting.
 * Used to route step analytics into downstream ML inference pipelines.
 */
export function buildMLEmitSignal(
  step: TickStep,
  tick: number,
  vector: Float32Array,
): EngineSignal {
  return createEngineSignalFull(
    'mode',
    'INFO',
    'ZERO_STEP_ML_EMIT',
    `ML vector emitted for ${step} at tick ${tick}.`,
    tick,
    'ml_emit',
    freezeArray(['zero', 'tick_step_runner', 'ml_emit', `step:${step.toLowerCase()}`]),
    undefined,
    { vectorLength: vector.length, stepOrdinalNorm: vector[0] },
  );
}

/**
 * Build a health-change signal when engine health transitions after a step.
 * Categorized as 'health_change' for downstream routing.
 */
export function buildHealthChangeSignal(
  engineId: EngineId,
  beforeStatus: EngineHealthStatus,
  afterStatus: EngineHealthStatus,
  step: TickStep,
  tick: number,
): EngineSignal {
  const severity: EngineSignalSeverity =
    afterStatus === 'FAILED' ? 'ERROR' : afterStatus === 'DEGRADED' ? 'WARN' : 'INFO';

  return createEngineSignalFull(
    engineId,
    severity,
    'ZERO_HEALTH_CHANGED',
    `Engine ${engineId} health changed from ${beforeStatus} to ${afterStatus} at ${step}.`,
    tick,
    'health_change',
    freezeArray(['zero', 'tick_step_runner', 'health_change', `step:${step.toLowerCase()}`]),
  );
}

/**
 * Build a state-mutation signal indicating that a step produced a new snapshot.
 */
export function buildStateMutationSignal(
  step: TickStep,
  engineId: EngineId | 'mode',
  tick: number,
): EngineSignal {
  return createEngineSignalFull(
    engineId,
    'INFO',
    'ZERO_STATE_MUTATED',
    `State mutated by ${step} at tick ${tick}.`,
    tick,
    'state_mutation',
    freezeArray(['zero', 'tick_step_runner', 'state_mutation', `step:${step.toLowerCase()}`]),
  );
}

// ─── NARRATION HELPERS ────────────────────────────────────────────────────────

/**
 * Mode-native narration hint for a step execution report.
 * Returns a short companion-facing phrase adapted to the player's mode.
 */
export function buildStepNarrationHint(
  report: StepExecutionReport,
  mode: ModeCode,
  severity: TickStepRunnerSeverity,
): string {
  const step = report.step;
  const descriptor = report.descriptor;

  if (report.rolledBack) {
    switch (mode) {
      case 'solo':
        return `Your ${descriptor.owner} engine hit resistance. The system rolled back — reassert.`;
      case 'pvp':
        return `Your opponent's pressure cracked step ${step}. They'll feel this.`;
      case 'coop':
        return `The team's ${descriptor.owner} step rolled back. Coordinate a recovery.`;
      case 'ghost':
        return `The legend didn't face this rollback. You're behind — move.`;
    }
  }

  if (severity === 'CRITICAL') {
    switch (mode) {
      case 'solo': return `Critical pressure on ${step}. Your sovereignty is being tested.`;
      case 'pvp': return `Your rival just gained an edge — ${step} is failing.`;
      case 'coop': return `${step} is critical. Your team needs to act.`;
      case 'ghost': return `The legend cleared this cleanly. Close the gap.`;
    }
  }

  if (severity === 'HIGH') {
    switch (mode) {
      case 'solo': return `${step} is under pressure. Budget exceeded — stabilize.`;
      case 'pvp': return `${step} is slipping. Your opponent is watching.`;
      case 'coop': return `${step} is degraded. Support your team.`;
      case 'ghost': return `You're slower than the legend at ${step}. Step it up.`;
    }
  }

  if (severity === 'MEDIUM') {
    switch (mode) {
      case 'solo': return `${step} completed with friction. Stay disciplined.`;
      case 'pvp': return `${step} is slightly off-pace. Don't let it compound.`;
      case 'coop': return `${step} showed mild friction. Keep the team aligned.`;
      case 'ghost': return `The legend was smoother at ${step}. Tighten up.`;
    }
  }

  // LOW severity — nominal
  switch (mode) {
    case 'solo': return `${step} executed cleanly. Sovereign execution.`;
    case 'pvp': return `${step} cleared. Your edge is intact.`;
    case 'coop': return `${step} clean. Team is in sync.`;
    case 'ghost': return `${step} matches the legend. Stay with it.`;
  }
}

/**
 * Phase-level narration hint for the overall tick execution state.
 */
export function buildPhaseNarrationHint(
  phase: TickStepPhase,
  mode: ModeCode,
  pressureTier: PressureTier,
): string {
  const tierLabel = pressureTier;

  switch (phase) {
    case 'ORCHESTRATION':
      return `Preparing for ${tierLabel} pressure. Mode: ${mode.toUpperCase()}.`;
    case 'ENGINE':
      return `Core engines executing at ${tierLabel}. No interruptions.`;
    case 'MODE':
      return `Mode-native reconciliation active — ${mode.toUpperCase()} rules applied.`;
    case 'OBSERVABILITY':
      return `Telemetry and sovereignty checkpoint recording.`;
    case 'FINALIZATION':
      return `Sealing tick at ${tierLabel}. Outcome gate evaluated.`;
  }
}

/**
 * Outcome narration hint for a terminal step execution.
 */
export function buildOutcomeNarrationHint(
  outcome: RunOutcome,
  mode: ModeCode,
): string {
  switch (outcome) {
    case 'FREEDOM':
      switch (mode) {
        case 'solo': return 'Freedom achieved. You went alone and won.';
        case 'pvp': return 'Freedom claimed. Your rival is defeated.';
        case 'coop': return 'Freedom secured. The team prevailed.';
        case 'ghost': return "Freedom matched — you've caught the legend.";
      }
      break;
    case 'TIMEOUT':
      switch (mode) {
        case 'solo': return 'Time ran out. Recalibrate your execution pace.';
        case 'pvp': return 'Clock expired. Neither side broke through.';
        case 'coop': return "Time's up. The team's windows closed.";
        case 'ghost': return "The legend didn't timeout — recalibrate.";
      }
      break;
    case 'BANKRUPT':
      return `Financial failure — all resources depleted. Rebuild.`;
    case 'ABANDONED':
      return `Run abandoned. The story ends here.`;
  }
  return `Run ended with outcome: ${outcome}.`;
}

// ─── STEP POLICY INSPECTOR ────────────────────────────────────────────────────

/**
 * Inspect the engine step policy for a given engineId and return a diagnostic summary.
 */
export function inspectEngineStepPolicy(engineId: EngineId): {
  policy: EngineStepPolicy;
  slotCount: number;
  isHighRisk: boolean;
  summary: string;
} {
  const policy = getEngineStepPolicy(engineId);
  const allSlots = Object.values(ENGINE_STEP_SLOTS);
  const slotCount = allSlots.filter((slots) => slots.includes(engineId)).length;
  const isHighRisk = policy.failHard && policy.failureThreshold <= 3;

  return {
    policy,
    slotCount,
    isHighRisk,
    summary: `Engine ${engineId}: maxStepMs=${policy.maxStepMs}, failHard=${policy.failHard}, threshold=${policy.failureThreshold}, slots=${slotCount}`,
  };
}

/**
 * Inspect the step slot configuration for all canonical steps.
 * Returns a summary of which engines own each step.
 */
export function inspectAllStepSlots(): readonly {
  step: TickStep;
  slots: readonly (EngineId | 'mode')[];
  slotCount: number;
}[] {
  return TICK_SEQUENCE.map((step) => ({
    step,
    slots: ENGINE_STEP_SLOTS[step],
    slotCount: ENGINE_STEP_SLOTS[step].length,
  }));
}

/**
 * Validate that the STEP_TO_ENGINE internal map matches ENGINE_STEP_SLOTS.
 * Returns a list of any divergences found.
 */
export function validateStepToEngineMap(): readonly string[] {
  const divergences: string[] = [];

  for (const [step, engineId] of Object.entries(TICK_STEP_ENGINE_ASSIGNMENT)) {
    const slots = ENGINE_STEP_SLOTS[step as TickStep] ?? [];
    if (!slots.includes(engineId as EngineId)) {
      divergences.push(
        `STEP_TO_ENGINE maps ${step} → ${engineId} but ENGINE_STEP_SLOTS has [${slots.join(', ')}]`,
      );
    }
  }

  return Object.freeze(divergences);
}

/**
 * Build a full step descriptor lookup from the TICK_STEP_DESCRIPTORS constant.
 * Used in diagnostics to compare against ZERO_TICK_STEP_DESCRIPTORS.
 */
export function buildCoreDescriptorLookup(): Readonly<Record<TickStep, TickStepDescriptor>> {
  return TICK_STEP_DESCRIPTORS;
}

// ─── SIGNAL AGGREGATION HELPERS ───────────────────────────────────────────────

/**
 * Aggregate all signals from an array of step execution reports into a single
 * EngineSignalAggregator and return the report.
 */
export function aggregateReportSignals(
  reports: readonly StepExecutionReport[],
  tick: number,
): SignalAggregatorReport {
  const aggregator = new EngineSignalAggregator(tick);
  for (const r of reports) {
    aggregator.add(...r.signals);
  }
  return aggregator.buildReport();
}

/**
 * Create a fresh EngineSignalAggregator for a given tick.
 * Used by analytics classes to collect signals during step execution.
 */
export function createStepAggregator(tick: number): EngineSignalAggregator {
  return new EngineSignalAggregator(tick);
}

/**
 * Count tick-category signals across all reports.
 */
export function countTickCategorySignals(reports: readonly StepExecutionReport[]): number {
  return reports.reduce(
    (sum, r) => sum + countSignalsByCategory(r.signals, 'tick'),
    0,
  );
}

// ─── NORMALIZEENGINETICKRESDULT BRIDGE ────────────────────────────────────────

/**
 * Bridge helper to normalize an engine tick result for diagnostic display.
 * Uses normalizeEngineTickResult from core to ensure consistent format.
 */
export function normalizeAndSummarizeResult(
  engineId: EngineId,
  tick: number,
  result: RunStateSnapshot | { snapshot: RunStateSnapshot; signals?: readonly EngineSignal[] },
): { signalCount: number; hasErrors: boolean; engineId: EngineId } {
  const normalized = normalizeEngineTickResult(engineId, tick, result);
  const signals = normalized.signals ?? [];
  return {
    signalCount: signals.length,
    hasErrors: signals.some((s) => s.severity === 'ERROR'),
    engineId,
  };
}

// ─── TREND ANALYZER ──────────────────────────────────────────────────────────

/**
 * TickStepRunnerTrendAnalyzer — rolling-window trend analysis per step.
 *
 * Accumulates session entries per step and computes health trend indicators.
 * Window size is configurable; defaults to TICK_STEP_RUNNER_TREND_WINDOW_SIZE.
 * This is the authoritative trend surface for companion coaching triggers.
 */
export class TickStepRunnerTrendAnalyzer {
  private readonly _windows: Map<TickStep, TickStepRunnerSessionEntry[]> = new Map();
  private readonly _windowSize: number;

  public constructor(windowSize: number = TICK_STEP_RUNNER_TREND_WINDOW_SIZE) {
    this._windowSize = Math.max(1, windowSize);
  }

  /** Record a new session entry for the given step. */
  public record(entry: TickStepRunnerSessionEntry): void {
    const window = this._windows.get(entry.step) ?? [];
    window.push(entry);
    if (window.length > this._windowSize) {
      window.shift();
    }
    this._windows.set(entry.step, window);
  }

  /** Get the trend snapshot for the given step. */
  public getTrend(step: TickStep): TickStepRunnerTrendSnapshot {
    const window = this._windows.get(step) ?? [];
    const nowMs = Date.now();

    if (window.length === 0) {
      return Object.freeze({
        step,
        windowSize: 0,
        avgDurationMs: 0,
        maxDurationMs: 0,
        minDurationMs: 0,
        errorRate: 0,
        rollbackRate: 0,
        skipRate: 0,
        overBudgetRate: 0,
        healthTrend: 'STABLE',
        computedAtMs: nowMs,
      });
    }

    const durations = window.map((e) => e.durationMs);
    const avgDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDurationMs = Math.max(...durations);
    const minDurationMs = Math.min(...durations);
    const errorRate = window.filter((e) => e.errorCount > 0).length / window.length;
    const rollbackRate = window.filter((e) => e.rolledBack).length / window.length;
    const skipRate = window.filter((e) => e.skipped).length / window.length;
    const budgetMs = resolveStepBudgetMs(STEP_TO_ENGINE[step] ?? null);
    const overBudgetRate = window.filter((e) => e.durationMs > budgetMs).length / window.length;

    let healthTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING' = 'STABLE';
    if (window.length >= 4) {
      const firstHalf = window.slice(0, Math.floor(window.length / 2));
      const secondHalf = window.slice(Math.floor(window.length / 2));
      const firstAvg = firstHalf.reduce((a, e) => a + e.durationMs, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, e) => a + e.durationMs, 0) / secondHalf.length;
      if (secondAvg < firstAvg * 0.9) healthTrend = 'IMPROVING';
      else if (secondAvg > firstAvg * 1.1) healthTrend = 'DEGRADING';
    }

    return Object.freeze({
      step,
      windowSize: window.length,
      avgDurationMs,
      maxDurationMs,
      minDurationMs,
      errorRate,
      rollbackRate,
      skipRate,
      overBudgetRate,
      healthTrend,
      computedAtMs: nowMs,
    });
  }

  /** Get all trend snapshots for all tracked steps. */
  public getAllTrends(): readonly TickStepRunnerTrendSnapshot[] {
    return TICK_SEQUENCE.map((step) => this.getTrend(step));
  }

  /** Check if any step is degrading. Returns degrading step names. */
  public getDegradingSteps(): readonly TickStep[] {
    return TICK_SEQUENCE.filter((step) => this.getTrend(step).healthTrend === 'DEGRADING');
  }

  /** Reset the window for a given step. */
  public resetStep(step: TickStep): void {
    this._windows.delete(step);
  }

  /** Reset all windows. */
  public reset(): void {
    this._windows.clear();
  }

  get windowSize(): number { return this._windowSize; }
  get trackedStepCount(): number { return this._windows.size; }
}

// ─── SESSION TRACKER ──────────────────────────────────────────────────────────

/**
 * TickStepRunnerSessionTracker — long-arc session recording per step.
 *
 * Records execution entries across the full run arc (up to maxEntries).
 * Provides per-step and global summary queries for companion routing and ML.
 */
export class TickStepRunnerSessionTracker {
  private readonly _entries: TickStepRunnerSessionEntry[] = [];
  private readonly _maxEntries: number;

  public constructor(maxEntries: number = TICK_STEP_RUNNER_DEFAULT_SESSION_MAX) {
    this._maxEntries = Math.max(1, maxEntries);
  }

  /** Record a step execution entry. */
  public record(entry: TickStepRunnerSessionEntry): void {
    this._entries.push(entry);
    if (this._entries.length > this._maxEntries) {
      this._entries.shift();
    }
  }

  /** Record a step execution from a StepExecutionReport. */
  public recordFromReport(
    report: StepExecutionReport,
    severity: TickStepRunnerSeverity,
  ): void {
    this.record({
      step: report.step,
      tick: report.inputSnapshot.tick ?? 0,
      durationMs: report.durationMs,
      signalCount: report.signals.length,
      errorCount: countSignalsBySeverity(report.signals, 'ERROR'),
      skipped: report.skipped,
      rolledBack: report.rolledBack,
      severity,
      recordedAtMs: Date.now(),
    });
  }

  /** Get all entries for a given step. */
  public getByStep(step: TickStep): readonly TickStepRunnerSessionEntry[] {
    return this._entries.filter((e) => e.step === step);
  }

  /** Get all entries with a given severity. */
  public getBySeverity(severity: TickStepRunnerSeverity): readonly TickStepRunnerSessionEntry[] {
    return this._entries.filter((e) => e.severity === severity);
  }

  /** Get the last N entries. */
  public getLast(n: number): readonly TickStepRunnerSessionEntry[] {
    return this._entries.slice(-n);
  }

  /** Build per-step EngineStepMetrics for engine-owned steps. */
  public buildTickMetricsSnapshot(tick: number): TickStepMetrics | null {
    const engineEntries = this._entries.filter((e) => {
      const engineId = STEP_TO_ENGINE[e.step];
      return engineId !== undefined;
    });

    if (engineEntries.length === 0) return null;

    const stepMetrics: EngineStepMetrics[] = engineEntries.map((e) => {
      const engineId = STEP_TO_ENGINE[e.step] as EngineId;
      return buildEngineStepMetrics(
        engineId,
        e.step,
        e.tick,
        0,
        e.durationMs,
        [],
        e.skipped,
        !e.skipped && !e.rolledBack,
      );
    });

    return buildTickStepMetrics(tick, stepMetrics);
  }

  /** Return a summary of total executions per step. */
  public getExecutionCounts(): Readonly<Partial<Record<TickStep, number>>> {
    const counts: Partial<Record<TickStep, number>> = {};
    for (const entry of this._entries) {
      counts[entry.step] = (counts[entry.step] ?? 0) + 1;
    }
    return Object.freeze(counts);
  }

  /** Return overall error rate across all recorded entries. */
  get globalErrorRate(): number {
    if (this._entries.length === 0) return 0;
    return this._entries.filter((e) => e.errorCount > 0).length / this._entries.length;
  }

  /** Return overall rollback rate. */
  get globalRollbackRate(): number {
    if (this._entries.length === 0) return 0;
    return this._entries.filter((e) => e.rolledBack).length / this._entries.length;
  }

  /** Return overall skip rate. */
  get globalSkipRate(): number {
    if (this._entries.length === 0) return 0;
    return this._entries.filter((e) => e.skipped).length / this._entries.length;
  }

  get entryCount(): number { return this._entries.length; }
  get maxEntries(): number { return this._maxEntries; }

  /** Clear all entries. */
  public reset(): void {
    this._entries.length = 0;
  }
}

// ─── EVENT LOG ────────────────────────────────────────────────────────────────

/**
 * TickStepRunnerEventLog — structured event recording for step executions.
 *
 * Accumulates TickStepRunnerAnnotation records for proof, replay, and
 * transcript surfaces. Emits aggregated signal reports on demand.
 */
export class TickStepRunnerEventLog {
  private readonly _annotations: TickStepRunnerAnnotation[] = [];
  private readonly _aggregator: EngineSignalAggregator;
  private readonly _maxEntries: number;

  public constructor(tick: number, maxEntries: number = TICK_STEP_RUNNER_DEFAULT_SESSION_MAX) {
    this._aggregator = new EngineSignalAggregator(tick);
    this._maxEntries = Math.max(1, maxEntries);
  }

  /** Record an annotation and register its signals with the aggregator. */
  public record(
    annotation: TickStepRunnerAnnotation,
    signals: readonly EngineSignal[],
  ): void {
    this._annotations.push(annotation);
    if (this._annotations.length > this._maxEntries) {
      this._annotations.shift();
    }
    this._aggregator.add(...signals);
  }

  /** Build an annotation from a step execution report. */
  public recordFromReport(
    report: StepExecutionReport,
    runId: string,
    severity: TickStepRunnerSeverity,
    operationKind: TickStepRunnerOperationKind,
    mlVector: Float32Array | null = null,
  ): TickStepRunnerAnnotation {
    const tick = report.inputSnapshot.tick ?? 0;
    const annotation: TickStepRunnerAnnotation = Object.freeze({
      id: generateAnnotationId(report.step, tick, report.startedAtMs),
      step: report.step,
      tick,
      runId,
      severity,
      operationKind,
      message: `[${severity}] ${report.step} executed in ${report.durationMs}ms — ${operationKind}`,
      tags: freezeArray(['zero', 'tick_step_runner', `step:${report.step.toLowerCase()}`, severity.toLowerCase()]),
      mlVector,
      durationMs: report.durationMs,
      signalCount: report.signals.length,
      createdAtMs: report.startedAtMs,
    });
    this.record(annotation, report.signals);
    return annotation;
  }

  /** Build the aggregated signal report. */
  public buildSignalReport(): SignalAggregatorReport {
    return this._aggregator.buildReport();
  }

  /** Return all annotations for a given step. */
  public getByStep(step: TickStep): readonly TickStepRunnerAnnotation[] {
    return this._annotations.filter((a) => a.step === step);
  }

  /** Return all annotations with CRITICAL severity. */
  public getCritical(): readonly TickStepRunnerAnnotation[] {
    return this._annotations.filter((a) => a.severity === 'CRITICAL');
  }

  /** Return a flat copy of all annotations. */
  public all(): readonly TickStepRunnerAnnotation[] {
    return [...this._annotations];
  }

  get annotationCount(): number { return this._annotations.length; }
  get hasErrors(): boolean { return this._aggregator.hasErrors; }
  get hasWarnings(): boolean { return this._aggregator.hasWarnings; }
}

// ─── STEP ANNOTATOR ──────────────────────────────────────────────────────────

/**
 * TickStepRunnerAnnotator — enriches step execution reports with narration,
 * ML vectors, DL rows, and severity scores.
 *
 * Used by the TickStepRunner to attach full analytics to every StepExecutionReport
 * before it is dispatched to downstream consumers.
 */
export class TickStepRunnerAnnotator {
  private readonly _mode: TickStepRunnerAdapterMode;
  private readonly _runContext: TickStepRunnerRunContext | null;

  public constructor(
    mode: TickStepRunnerAdapterMode = 'DEFAULT',
    runContext: TickStepRunnerRunContext | null = null,
  ) {
    this._mode = mode;
    this._runContext = runContext;
  }

  /** Annotate a step execution report. Returns a score + narration bundle. */
  public annotate(report: StepExecutionReport): {
    score: TickStepRunnerScoreResult;
    narration: string;
    phaseNarration: string;
    mlVector: TickStepRunnerMLVector | null;
    dlRow: TickStepRunnerDLRow;
    operationKind: TickStepRunnerOperationKind;
    shouldEmit: boolean;
  } {
    const score = scoreStepExecution(report);
    const mode: ModeCode = this._runContext?.mode ?? 'solo';
    const pressureTier: PressureTier = this._runContext?.pressureTier ?? 'T1';
    const narration = buildStepNarrationHint(report, mode, score.severity);
    const phaseNarration = buildPhaseNarrationHint(report.descriptor.phase, mode, pressureTier);
    const dlRow = buildStepDLRow(report);

    let mlVector: TickStepRunnerMLVector | null = null;
    if (this._mode === 'VERBOSE' || score.severity !== 'LOW') {
      mlVector = extractStepMLVector(report);
    }

    const operationKind: TickStepRunnerOperationKind = report.rolledBack
      ? 'ROLLBACK'
      : report.skipped
      ? 'SKIP'
      : isEngineExecutionStep(report.step)
      ? 'ENGINE_STEP'
      : report.signals.length === 0
      ? 'NOOP_STEP'
      : 'SYNTHETIC_STEP';

    const shouldEmit =
      this._mode === 'VERBOSE' ||
      (this._mode === 'DEFAULT' && score.severity !== 'LOW') ||
      (this._mode === 'STRICT' && (score.severity === 'HIGH' || score.severity === 'CRITICAL'));

    return { score, narration, phaseNarration, mlVector, dlRow, operationKind, shouldEmit };
  }

  get mode(): TickStepRunnerAdapterMode { return this._mode; }
  get runContext(): TickStepRunnerRunContext | null { return this._runContext; }
}

// ─── STEP INSPECTOR ──────────────────────────────────────────────────────────

/**
 * TickStepRunnerInspector — diagnostic surface for a collection of step reports.
 *
 * Provides step-level and tick-level summaries, health grades, and
 * ML/DL extraction from a batch of StepExecutionReports.
 * Primarily used in orchestrator diagnostics and replay analysis.
 */
export class TickStepRunnerInspector {
  private readonly _reports: readonly StepExecutionReport[];
  private readonly _tick: number;

  public constructor(reports: readonly StepExecutionReport[], tick: number) {
    this._reports = reports;
    this._tick = tick;
  }

  /** Get the report for a specific step. Returns null if not found. */
  public getReport(step: TickStep): StepExecutionReport | null {
    return this._reports.find((r) => r.step === step) ?? null;
  }

  /** Build a full tick DL tensor from all reports. */
  public buildTensor(): TickStepRunnerDLTensor {
    return buildTickDLTensor(this._reports, this._tick);
  }

  /** Build a signal aggregation report across all reports. */
  public buildSignalReport(): SignalAggregatorReport {
    return aggregateReportSignals(this._reports, this._tick);
  }

  /** Build TickStepMetrics from all engine-owned reports. */
  public buildTickMetrics(): TickStepMetrics {
    return buildTickMetricsFromReports(this._tick, this._reports);
  }

  /** Return all reports where rollback occurred. */
  public getRolledBackReports(): readonly StepExecutionReport[] {
    return this._reports.filter((r) => r.rolledBack);
  }

  /** Return all reports that exceeded their step budget. */
  public getOverBudgetReports(): readonly StepExecutionReport[] {
    return this._reports.filter((r) => {
      const ctx = buildStepRunnerContext(r);
      return ctx.overBudget;
    });
  }

  /** Return all reports with ERROR-severity signals. */
  public getErrorReports(): readonly StepExecutionReport[] {
    return this._reports.filter((r) => countSignalsBySeverity(r.signals, 'ERROR') > 0);
  }

  /** Compute an overall tick health grade (0–1). */
  public computeTickHealthGrade(): number {
    if (this._reports.length === 0) return 1;
    const grades = this._reports.map((r) => {
      const score = scoreStepExecution(r);
      return score.healthGrade;
    });
    return grades.reduce((a, b) => a + b, 0) / grades.length;
  }

  /** Return the most critical step, or null if none are critical. */
  public getMostCriticalStep(): TickStep | null {
    const sorted = [...this._reports].sort((a, b) => {
      const scoreA = scoreStepExecution(a);
      const scoreB = scoreStepExecution(b);
      const order: Record<TickStepRunnerSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
      return order[scoreB.severity] - order[scoreA.severity];
    });
    if (sorted.length === 0) return null;
    const top = scoreStepExecution(sorted[0]);
    return top.severity === 'LOW' ? null : sorted[0].step;
  }

  /** Check whether all 13 canonical steps are represented in the reports. */
  public isTickComplete(): boolean {
    const reportedSteps = new Set(this._reports.map((r) => r.step));
    return ZERO_CANONICAL_TICK_SEQUENCE.every((step) => reportedSteps.has(step));
  }

  /** Validate the step-to-engine mapping against EngineContracts. */
  public validateStepMapping(): readonly string[] {
    return validateStepToEngineMap();
  }

  get reportCount(): number { return this._reports.length; }
  get tick(): number { return this._tick; }
}

// ─── TICK STEP RUNNER CLASS ───────────────────────────────────────────────────

/**
 * TickStepRunner — the authoritative single-step executor for Engine 0.
 *
 * Executes one TickStep against the provided options and returns a normalized
 * StepExecutionReport. Supports both engine steps (dispatched to SimulationEngine
 * instances via TickTransactionCoordinator) and synthetic steps (dispatched to
 * registered StepHandlers).
 *
 * The clock is accessed directly from this.options.clock — never stored as a
 * separate private field to avoid the conditional-type never footgun.
 *
 * The bus is stored as a typed RuntimeBus reference for event dispatch.
 * Both are passed through to TickTransactionCoordinator for each execution.
 */
export class TickStepRunner {
  private readonly bus: RuntimeBus;

  public constructor(
    private readonly options: {
      readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
      readonly clock: Parameters<TickTransactionCoordinator['createContext']>[0]['clock'];
      readonly transactionCoordinator: TickTransactionCoordinator;
      readonly engines: Partial<Record<EngineId, SimulationEngine>>;
      readonly handlers?: TickStepRunnerHandlers;
    },
  ) {
    this.bus = options.bus;
  }

  public run(args: TickStepRunnerArgs): StepExecutionReport {
    const descriptor = getTickStepDescriptor(args.step);
    const startedAtMs = Math.max(0, Math.trunc(args.nowMs));
    const inputSnapshot = toFrozenSnapshot(args.snapshot);

    const execution = isEngineExecutionStep(args.step)
      ? this.runEngineStep(args)
      : this.runSyntheticStep(args);

    const endedAtMs = Math.max(startedAtMs, execution.context.nowMs);

    return Object.freeze({
      step: args.step,
      descriptor,
      engineId: this.resolveOwner(args.step),
      startedAtMs,
      endedAtMs,
      durationMs: Math.max(0, endedAtMs - startedAtMs),
      inputSnapshot,
      outputSnapshot: execution.snapshot,
      signals: freezeArray(execution.signals),
      skipped: execution.skipped,
      rolledBack: execution.rolledBack,
      metadata: this.buildMetadata(execution),
    });
  }

  /**
   * Run the step and return an annotated StepExecutionReport with ML enrichment.
   * The annotator mode controls signal emission thresholds.
   */
  public runAnnotated(
    args: TickStepRunnerArgs,
    annotator: TickStepRunnerAnnotator,
  ): {
    report: StepExecutionReport;
    annotation: ReturnType<TickStepRunnerAnnotator['annotate']>;
  } {
    const report = this.run(args);
    const annotation = annotator.annotate(report);
    return { report, annotation };
  }

  private runEngineStep(args: TickStepRunnerArgs): TransactionExecutionResult {
    const engineId = STEP_TO_ENGINE[args.step];

    if (engineId === undefined) {
      return this.options.transactionCoordinator.executeSynthetic({
        snapshot: args.snapshot,
        step: args.step,
        nowMs: args.nowMs,
        clock: this.options.clock,
        bus: this.bus,
        trace: { traceId: args.traceId },
        owner: 'system',
        label: 'Unmapped engine step noop',
        reducer: (snapshot, context) => ({
          snapshot,
          signals: freezeArray([
            defaultSystemSignal(
              args.step,
              context.trace.tick,
              'ZERO_UNMAPPED_ENGINE_STEP',
              `${args.step} is not mapped to a backend engine in zero.`,
            ),
          ]),
        }),
      });
    }

    const engine = this.options.engines[engineId];

    if (engine === undefined) {
      return this.options.transactionCoordinator.executeSynthetic({
        snapshot: args.snapshot,
        step: args.step,
        nowMs: args.nowMs,
        clock: this.options.clock,
        bus: this.bus,
        trace: { traceId: args.traceId },
        owner: engineId,
        label: 'Missing engine noop',
        reducer: (snapshot, context) => ({
          snapshot,
          signals: freezeArray([
            createEngineSignal(
              engineId,
              'WARN',
              'ZERO_ENGINE_NOT_BOUND',
              `No engine instance is bound for ${args.step}.`,
              context.trace.tick,
              freezeArray(['zero', 'missing-engine', `step:${args.step.toLowerCase()}`]),
            ),
          ]),
        }),
      });
    }

    return this.options.transactionCoordinator.executeEngine({
      snapshot: args.snapshot,
      step: args.step,
      nowMs: args.nowMs,
      clock: this.options.clock,
      bus: this.bus,
      trace: { traceId: args.traceId },
      engine,
    });
  }

  private runSyntheticStep(args: TickStepRunnerArgs): TransactionExecutionResult {
    const handler = this.options.handlers?.[args.step];

    if (handler === undefined) {
      return this.options.transactionCoordinator.executeSynthetic({
        snapshot: args.snapshot,
        step: args.step,
        nowMs: args.nowMs,
        clock: this.options.clock,
        bus: this.bus,
        trace: { traceId: args.traceId },
        owner: 'system',
        label: 'Default synthetic noop',
        reducer: (snapshot, context) => ({
          snapshot,
          signals: freezeArray([
            defaultSystemSignal(
              args.step,
              context.trace.tick,
              'ZERO_SYNTHETIC_NOOP',
              `${args.step} completed with no synthetic handler bound.`,
            ),
          ]),
        }),
      });
    }

    return this.options.transactionCoordinator.executeSynthetic({
      snapshot: args.snapshot,
      step: args.step,
      nowMs: args.nowMs,
      clock: this.options.clock,
      bus: this.bus,
      trace: { traceId: args.traceId },
      owner: args.step === 'STEP_08_MODE_POST' ? 'mode' : 'system',
      label: `Synthetic handler for ${args.step}`,
      reducer: handler,
    });
  }

  private resolveOwner(step: TickStep): EngineId | 'mode' | 'system' | null {
    if (step === 'STEP_08_MODE_POST') {
      return 'mode';
    }

    if (isEngineExecutionStep(step)) {
      return STEP_TO_ENGINE[step] ?? null;
    }

    return 'system';
  }

  private buildMetadata(
    execution: TransactionExecutionResult,
  ): Readonly<Record<string, unknown>> | null {
    const healthBefore = execution.healthBefore;
    const healthAfter = execution.healthAfter;

    if (healthBefore === undefined && healthAfter === undefined) {
      return null;
    }

    return Object.freeze({
      healthBefore,
      healthAfter,
      traceId: execution.context.trace.traceId,
    });
  }
}

// ─── EXPORT BUNDLE ────────────────────────────────────────────────────────────

/**
 * TickStepRunnerBundle — a fully wired analytics + execution bundle for one run.
 *
 * Combines a TickStepRunner instance with all analytics surfaces:
 * - TrendAnalyzer for rolling health windows
 * - SessionTracker for long-arc session recording
 * - Annotator for ML/DL/narration enrichment
 * - EventLog for proof and replay recording
 * - Inspector factory for batch diagnostics
 *
 * Call .dispose() to reset all mutable state.
 */
export class TickStepRunnerBundle {
  public readonly runner: TickStepRunner;
  public readonly trendAnalyzer: TickStepRunnerTrendAnalyzer;
  public readonly sessionTracker: TickStepRunnerSessionTracker;
  public readonly annotator: TickStepRunnerAnnotator;
  public readonly eventLog: TickStepRunnerEventLog;
  private _currentTick: number;

  public constructor(
    runner: TickStepRunner,
    runContext: TickStepRunnerRunContext | null = null,
    adapterMode: TickStepRunnerAdapterMode = 'DEFAULT',
    tick: number = 0,
  ) {
    this.runner = runner;
    this.trendAnalyzer = new TickStepRunnerTrendAnalyzer(TICK_STEP_RUNNER_TREND_WINDOW_SIZE);
    this.sessionTracker = new TickStepRunnerSessionTracker(TICK_STEP_RUNNER_DEFAULT_SESSION_MAX);
    this.annotator = new TickStepRunnerAnnotator(adapterMode, runContext);
    this.eventLog = new TickStepRunnerEventLog(tick, TICK_STEP_RUNNER_DEFAULT_SESSION_MAX);
    this._currentTick = tick;
  }

  /**
   * Run a single step, annotate it, record in session + trend, log in event log.
   * Returns the full enriched result.
   */
  public runFull(
    args: TickStepRunnerArgs,
    runId: string,
  ): {
    report: StepExecutionReport;
    annotation: ReturnType<TickStepRunnerAnnotator['annotate']>;
    annotationRecord: TickStepRunnerAnnotation;
    score: TickStepRunnerScoreResult;
  } {
    const { report, annotation } = this.runner.runAnnotated(args, this.annotator);
    const { score, operationKind, mlVector } = annotation;

    this.sessionTracker.recordFromReport(report, score.severity);
    this.trendAnalyzer.record({
      step: report.step,
      tick: report.inputSnapshot.tick ?? this._currentTick,
      durationMs: report.durationMs,
      signalCount: report.signals.length,
      errorCount: countSignalsBySeverity(report.signals, 'ERROR'),
      skipped: report.skipped,
      rolledBack: report.rolledBack,
      severity: score.severity,
      recordedAtMs: Date.now(),
    });

    const annotationRecord = this.eventLog.recordFromReport(
      report,
      runId,
      score.severity,
      operationKind,
      mlVector?.features ?? null,
    );

    return { report, annotation, annotationRecord, score };
  }

  /** Build a full tick inspector from the accumulated session entries. */
  public buildInspector(reports: readonly StepExecutionReport[]): TickStepRunnerInspector {
    return new TickStepRunnerInspector(reports, this._currentTick);
  }

  /** Advance the tick counter. Called at the start of each new tick. */
  public advanceTick(tick: number): void {
    this._currentTick = tick;
  }

  /** Dispose all mutable analytics state. */
  public dispose(): void {
    this.trendAnalyzer.reset();
    this.sessionTracker.reset();
    this.eventLog['_annotations'].length = 0;
  }

  get currentTick(): number { return this._currentTick; }
}

// ─── MANIFEST ─────────────────────────────────────────────────────────────────

/**
 * Module-level manifest for the TickStepRunner surface.
 * Used for diagnostics, hot-reload validation, and service registry integration.
 */
export interface TickStepRunnerManifest {
  readonly version: string;
  readonly schema: string;
  readonly ready: boolean;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [13, 8];
  readonly stepCount: number;
  readonly engineStepCount: number;
  readonly ownerCount: number;
  readonly engineCount: number;
  readonly featureLabels: readonly string[];
  readonly dlFeatureLabels: readonly string[];
  readonly adapterModes: readonly TickStepRunnerAdapterMode[];
  readonly severityLevels: readonly TickStepRunnerSeverity[];
  readonly operationKinds: readonly TickStepRunnerOperationKind[];
  readonly stepBudgetMs: number;
  readonly warnDurationMs: number;
  readonly slowMultiplier: number;
  readonly trendWindowSize: number;
  readonly sessionMax: number;
  readonly maxHeat: number;
  readonly worldEventPrefix: string;
  readonly stepEngineAssignment: Readonly<Partial<Record<TickStep, EngineId>>>;
}

export const TICK_STEP_RUNNER_MANIFEST: TickStepRunnerManifest = Object.freeze({
  version: TICK_STEP_RUNNER_MODULE_VERSION,
  schema: TICK_STEP_RUNNER_SCHEMA,
  ready: TICK_STEP_RUNNER_READY,
  mlFeatureCount: TICK_STEP_RUNNER_ML_FEATURE_COUNT,
  dlTensorShape: TICK_STEP_RUNNER_DL_TENSOR_SHAPE,
  stepCount: TICK_STEP_RUNNER_STEP_COUNT,
  engineStepCount: TICK_STEP_RUNNER_ENGINE_STEP_COUNT,
  ownerCount: TICK_STEP_RUNNER_OWNER_COUNT,
  engineCount: TICK_STEP_RUNNER_ENGINE_COUNT,
  featureLabels: TICK_ML_FEATURE_LABELS,
  dlFeatureLabels: TICK_DL_FEATURE_LABELS,
  adapterModes: Object.freeze(['DEFAULT', 'STRICT', 'VERBOSE'] as const),
  severityLevels: Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const),
  operationKinds: Object.freeze([
    'ENGINE_STEP',
    'SYNTHETIC_STEP',
    'NOOP_STEP',
    'ROLLBACK',
    'SKIP',
    'CONTRACT_VIOLATION',
    'BUDGET_EXCEEDED',
    'HEALTH_CHANGE',
  ] as const),
  stepBudgetMs: TICK_STEP_BUDGET_MS,
  warnDurationMs: TICK_STEP_RUNNER_WARN_DURATION_MS,
  slowMultiplier: TICK_STEP_RUNNER_SLOW_MULTIPLIER,
  trendWindowSize: TICK_STEP_RUNNER_TREND_WINDOW_SIZE,
  sessionMax: TICK_STEP_RUNNER_DEFAULT_SESSION_MAX,
  maxHeat: TICK_STEP_RUNNER_MAX_HEAT,
  worldEventPrefix: TICK_STEP_RUNNER_WORLD_EVENT_PREFIX,
  stepEngineAssignment: TICK_STEP_ENGINE_ASSIGNMENT,
});

// ─── FACTORY FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Create a new TickStepRunnerTrendAnalyzer with the default window size.
 */
export function createTrendAnalyzer(
  windowSize?: number,
): TickStepRunnerTrendAnalyzer {
  return new TickStepRunnerTrendAnalyzer(windowSize ?? TICK_STEP_RUNNER_TREND_WINDOW_SIZE);
}

/**
 * Create a new TickStepRunnerSessionTracker with the default max entries.
 */
export function createSessionTracker(
  maxEntries?: number,
): TickStepRunnerSessionTracker {
  return new TickStepRunnerSessionTracker(maxEntries ?? TICK_STEP_RUNNER_DEFAULT_SESSION_MAX);
}

/**
 * Create a new TickStepRunnerAnnotator with the given adapter mode and context.
 */
export function createAnnotator(
  mode: TickStepRunnerAdapterMode = 'DEFAULT',
  runContext: TickStepRunnerRunContext | null = null,
): TickStepRunnerAnnotator {
  return new TickStepRunnerAnnotator(mode, runContext);
}

/**
 * Create a new TickStepRunnerEventLog for the given tick.
 */
export function createEventLog(
  tick: number,
  maxEntries?: number,
): TickStepRunnerEventLog {
  return new TickStepRunnerEventLog(tick, maxEntries ?? TICK_STEP_RUNNER_DEFAULT_SESSION_MAX);
}

/**
 * Create a new TickStepRunnerInspector from a set of step reports.
 */
export function createInspector(
  reports: readonly StepExecutionReport[],
  tick: number,
): TickStepRunnerInspector {
  return new TickStepRunnerInspector(reports, tick);
}

/**
 * Create a fully wired TickStepRunnerBundle from a runner instance.
 */
export function createBundle(
  runner: TickStepRunner,
  runContext: TickStepRunnerRunContext | null = null,
  adapterMode: TickStepRunnerAdapterMode = 'DEFAULT',
  tick: number = 0,
): TickStepRunnerBundle {
  return new TickStepRunnerBundle(runner, runContext, adapterMode, tick);
}

// ─── STEP NARRATION REGISTRY ─────────────────────────────────────────────────

/**
 * Full mode-native narration registry for all 13 canonical tick steps.
 * Each entry maps step + mode → a short companion-facing phrase.
 * Used by the companion routing layer to inject contextual narration.
 */
export const TICK_STEP_NARRATION_REGISTRY: Readonly<
  Record<TickStep, Readonly<Record<ModeCode, string>>>
> = Object.freeze({
  STEP_01_PREPARE: Object.freeze({
    solo: 'Preparing your sovereign run. Lock inputs, normalize state.',
    pvp: 'Pre-battle prep — your opponent is watching.',
    coop: 'Team prep underway. Align before the engine runs.',
    ghost: 'Legend trace loaded. Prepare to match the ghost.',
  }),
  STEP_02_TIME: Object.freeze({
    solo: 'Time engine advancing. Your cadence is sovereign.',
    pvp: "Clock tick — your rival's window is closing.",
    coop: "Team's shared timeline advancing.",
    ghost: "Legend's tick clock aligning.",
  }),
  STEP_03_PRESSURE: Object.freeze({
    solo: 'Pressure engine computing. Your tier is your truth.',
    pvp: 'Pressure building. Rivalry escalation in play.',
    coop: 'Team pressure recalibrated.',
    ghost: "Pressure gap vs legend — close it.",
  }),
  STEP_04_TENSION: Object.freeze({
    solo: 'Tension engine refreshing. Anticipation windows updating.',
    pvp: 'Tension rising. Threat envelopes visible.',
    coop: 'Team tension synchronized.',
    ghost: "Legend's tension profile — match it.",
  }),
  STEP_05_BATTLE: Object.freeze({
    solo: 'Battle engine resolving. Bots moving.',
    pvp: 'PvP battle step — attacks in flight.',
    coop: 'Team battle coordination.',
    ghost: "Legend's battle posture — study it.",
  }),
  STEP_06_SHIELD: Object.freeze({
    solo: 'Shield engine applying. Layers absorbing.',
    pvp: 'Your shield is tested. Breach has consequences.',
    coop: 'Team shield integrity recalculated.',
    ghost: "Legend's shield was stronger here. Fortify.",
  }),
  STEP_07_CASCADE: Object.freeze({
    solo: 'Cascade engine progressing. Chains advancing.',
    pvp: 'Cascade chains active. Sequences in play.',
    coop: 'Team cascade synchronized.',
    ghost: "Legend's cascade pattern — learn it.",
  }),
  STEP_08_MODE_POST: Object.freeze({
    solo: 'Mode post-processing. Solo rules applied.',
    pvp: 'PvP reconciliation — extraction and cooldowns.',
    coop: 'Team trust and role updates applied.',
    ghost: 'Ghost mode divergence gap updated.',
  }),
  STEP_09_TELEMETRY: Object.freeze({
    solo: 'Telemetry materializing. Decision audit recorded.',
    pvp: 'Match telemetry captured. Evidence logged.',
    coop: 'Team decision log updated.',
    ghost: 'Ghost comparison telemetry recorded.',
  }),
  STEP_10_SOVEREIGNTY_SNAPSHOT: Object.freeze({
    solo: 'Sovereignty checkpoint. Proof hash computed.',
    pvp: 'Match snapshot sealed. Integrity verified.',
    coop: 'Team snapshot anchored.',
    ghost: 'Legend comparison snapshot frozen.',
  }),
  STEP_11_OUTCOME_GATE: Object.freeze({
    solo: 'Freedom gate evaluated. Terminal conditions checked.',
    pvp: 'Victory/defeat gate evaluated.',
    coop: 'Team outcome gate checked.',
    ghost: 'Legend gap evaluated. Freedom within reach?',
  }),
  STEP_12_EVENT_SEAL: Object.freeze({
    solo: 'Events sealed for proof replay.',
    pvp: 'Match events locked for scoring.',
    coop: 'Team events canonicalized.',
    ghost: 'Legend comparison events sealed.',
  }),
  STEP_13_FLUSH: Object.freeze({
    solo: 'Tick boundary flushed. Next cycle ready.',
    pvp: 'Round boundary flushed. Next tick.',
    coop: 'Team tick flushed. Cycle resets.',
    ghost: 'Ghost tick flushed. Legend chasing continues.',
  }),
});

// ─── STEP POLICY SUMMARY TABLE ────────────────────────────────────────────────

/**
 * Pre-computed step policy summary for all 7 engines.
 * Used in diagnostics, manifest builds, and companion routing.
 */
export const TICK_STEP_RUNNER_POLICY_TABLE: Readonly<Record<EngineId, {
  maxStepMs: number;
  failHard: boolean;
  failureThreshold: number;
  requiredStepCount: number;
  optionalStepCount: number;
}>> = Object.freeze(
  Object.fromEntries(
    ALL_ENGINE_IDS.map((id) => {
      const p = DEFAULT_ENGINE_STEP_POLICIES[id];
      return [
        id,
        Object.freeze({
          maxStepMs: p.maxStepMs,
          failHard: p.failHard,
          failureThreshold: p.failureThreshold,
          requiredStepCount: p.requiredSteps.length,
          optionalStepCount: p.optionalSteps.length,
        }),
      ];
    }),
  ) as Record<EngineId, {
    maxStepMs: number;
    failHard: boolean;
    failureThreshold: number;
    requiredStepCount: number;
    optionalStepCount: number;
  }>,
);

// ─── PRESSURE TIER SCORING ────────────────────────────────────────────────────

/**
 * Score a pressure tier as a normalized [0,1] value.
 * T0=0.0, T1=0.25, T2=0.5, T3=0.75, T4=1.0.
 */
export function scorePressureTier(tier: PressureTier): number {
  const index = TICK_STEP_RUNNER_PRESSURE_TIER_ORDER.indexOf(tier);
  if (index < 0) return 0;
  return index / (TICK_STEP_RUNNER_PRESSURE_TIER_ORDER.length - 1);
}

/**
 * Score a mode as a normalized [0,1] value.
 * solo=0.0, pvp=0.33, coop=0.67, ghost=1.0.
 */
export function scoreModeNorm(mode: ModeCode): number {
  const index = TICK_STEP_RUNNER_MODE_ORDER.indexOf(mode);
  if (index < 0) return 0;
  return index / (TICK_STEP_RUNNER_MODE_ORDER.length - 1);
}

// ─── TYPE GUARDS ──────────────────────────────────────────────────────────────

/** Type guard: true if value is a valid TickStepRunnerSeverity. */
export function isTickStepRunnerSeverity(value: unknown): value is TickStepRunnerSeverity {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';
}

/** Type guard: true if value is a valid TickStepRunnerAdapterMode. */
export function isTickStepRunnerAdapterMode(value: unknown): value is TickStepRunnerAdapterMode {
  return value === 'DEFAULT' || value === 'STRICT' || value === 'VERBOSE';
}

/** Type guard: true if the report represents a terminal step execution (rollback/skip). */
export function isTerminalStepReport(report: StepExecutionReport): boolean {
  return report.rolledBack || (report.skipped && !isEngineExecutionStep(report.step));
}

// ─── SINGLETONS ───────────────────────────────────────────────────────────────

/**
 * Default singleton annotator — DEFAULT mode, no run context.
 * Use when a per-run annotator is not yet available.
 */
export const TICK_STEP_RUNNER_DEFAULT_ANNOTATOR: TickStepRunnerAnnotator =
  new TickStepRunnerAnnotator('DEFAULT', null);

/**
 * Strict singleton annotator — emits only HIGH/CRITICAL signals.
 */
export const TICK_STEP_RUNNER_STRICT_ANNOTATOR: TickStepRunnerAnnotator =
  new TickStepRunnerAnnotator('STRICT', null);

/**
 * Verbose singleton annotator — emits all signals with full ML vector.
 */
export const TICK_STEP_RUNNER_VERBOSE_ANNOTATOR: TickStepRunnerAnnotator =
  new TickStepRunnerAnnotator('VERBOSE', null);

/**
 * Default singleton trend analyzer — window size TICK_STEP_RUNNER_TREND_WINDOW_SIZE.
 */
export const TICK_STEP_RUNNER_DEFAULT_TREND_ANALYZER: TickStepRunnerTrendAnalyzer =
  new TickStepRunnerTrendAnalyzer(TICK_STEP_RUNNER_TREND_WINDOW_SIZE);

/**
 * Default singleton session tracker — max TICK_STEP_RUNNER_DEFAULT_SESSION_MAX entries.
 */
export const TICK_STEP_RUNNER_DEFAULT_SESSION_TRACKER: TickStepRunnerSessionTracker =
  new TickStepRunnerSessionTracker(TICK_STEP_RUNNER_DEFAULT_SESSION_MAX);

// ─── RE-EXPORTS OF USED CONSTANTS ────────────────────────────────────────────

/**
 * Re-export of TICK_ML_FEATURE_LABELS for consumers who want the full 32-label set.
 */
export { TICK_ML_FEATURE_LABELS, TICK_DL_FEATURE_LABELS };

/**
 * Re-export of ENGINE_EXECUTION_STEPS for consumers who need the 6-step list.
 */
export { ENGINE_EXECUTION_STEPS, TICK_SEQUENCE };

/**
 * Re-export of ALL_ENGINE_IDS for consumers who enumerate engine slots.
 */
export { ALL_ENGINE_IDS };

/**
 * Re-export of ZERO_CANONICAL_TICK_SEQUENCE and ZERO_TICK_STEP_DESCRIPTORS.
 */
export { ZERO_CANONICAL_TICK_SEQUENCE, ZERO_TICK_STEP_DESCRIPTORS };

// ─── FINAL EXPORT ALIAS ───────────────────────────────────────────────────────

/**
 * Canonical export alias for the full TickStepRunner module surface.
 * Used by backend/engine/zero/index.ts and by the chat adapter layer.
 */
export const TICK_STEP_RUNNER_BUNDLE_SUITE = Object.freeze({
  manifest: TICK_STEP_RUNNER_MANIFEST,
  policyTable: TICK_STEP_RUNNER_POLICY_TABLE,
  narrationRegistry: TICK_STEP_NARRATION_REGISTRY,
  stepSlotCounts: TICK_STEP_SLOT_COUNTS,
  engineBudgets: TICK_STEP_ENGINE_BUDGETS,
  defaultAnnotator: TICK_STEP_RUNNER_DEFAULT_ANNOTATOR,
  strictAnnotator: TICK_STEP_RUNNER_STRICT_ANNOTATOR,
  verboseAnnotator: TICK_STEP_RUNNER_VERBOSE_ANNOTATOR,
  defaultTrendAnalyzer: TICK_STEP_RUNNER_DEFAULT_TREND_ANALYZER,
  defaultSessionTracker: TICK_STEP_RUNNER_DEFAULT_SESSION_TRACKER,

  // factory functions
  createTrendAnalyzer,
  createSessionTracker,
  createAnnotator,
  createEventLog,
  createInspector,
  createBundle,

  // analytics functions
  extractStepMLVector,
  buildStepDLRow,
  buildTickDLTensor,
  scoreStepExecution,
  buildBudgetExceededSignal,
  buildMLEmitSignal,
  buildHealthChangeSignal,
  buildStateMutationSignal,
  buildStepNarrationHint,
  buildPhaseNarrationHint,
  buildOutcomeNarrationHint,
  aggregateReportSignals,
  buildEngineHealthFromReport,
  buildStepMetricsFromReport,
  buildTickMetricsFromReports,
  normalizeAndSummarizeResult,
  validateEngineEligibility,
  checkRequiredEnginePresence,
  inspectEngineStepPolicy,
  inspectAllStepSlots,
  validateStepToEngineMap,
  buildCoreDescriptorLookup,
  scorePressureTier,
  scoreModeNorm,

  // type guards
  isTickStepRunnerSeverity,
  isTickStepRunnerAdapterMode,
  isTerminalStepReport,

  // version info
  version: TICK_STEP_RUNNER_MODULE_VERSION,
  schema: TICK_STEP_RUNNER_SCHEMA,
  ready: TICK_STEP_RUNNER_READY,
} as const);
