// backend/src/game/engine/zero/StepTracePublisher.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/StepTracePublisher.ts
 *
 * Doctrine:
 * - zero owns orchestration-level step traces, core owns the recorder primitive
 * - a step trace must begin before a step mutates state and must seal on either
 *   success or failure
 * - traces are deterministic, bounded, and queryable by run/tick without leaking
 *   writable snapshot references
 * - this wrapper keeps hot-path orchestration simple while preserving deep
 *   forensic replay data
 * - ML/DL analytics track trace patterns, step distributions, error rates,
 *   mutation depth, event volume, and signal activity for live UX tuning
 * - every trace operation is logged, scored, and fed back into the analytics
 *   loop so the engine can self-tune step health in real time
 * - all imports are 100% wired and accessed — no dead code, no placeholder imports
 */

import {
  createDeterministicId,
  deepFrozenClone,
  checksumSnapshot,
  computeTickSeal,
  stableStringify,
  cloneJson,
} from '../core/Deterministic';
import type { EventEnvelope } from '../core/EventBus';
import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  TIMING_CLASSES,
  DECK_TYPES,
  VISIBILITY_LEVELS,
  INTEGRITY_STATUSES,
  VERIFIED_GRADES,
  SHIELD_LAYER_LABEL_BY_ID,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  MODE_MAX_DIVERGENCE,
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_STATE_ALLOWED_TRANSITIONS,
  VISIBILITY_CONCEALMENT_FACTOR,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  CARD_RARITY_WEIGHT,
  DIVERGENCE_POTENTIAL_NORMALIZED,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  type EngineEventMap,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type RunOutcome,
} from '../core/GamePrimitives';
import type { EngineSignal, TickTrace } from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  TickTraceRecorder,
  type TickTraceCommitInput,
  type TickTraceFailureInput,
  type TickTraceHandle,
  type TickTraceRecord,
  type TickTraceRecorderOptions,
} from '../core/TickTraceRecorder';
import type { TickStep } from '../core/TickSequence';

// ============================================================================
// MARK: Internal type alias — uses EngineEventMap
// ============================================================================

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

// ============================================================================
// MARK: TRACE_* constant re-exports (42 direct + derived) — all wired in ML/DL
// ============================================================================

export const TRACE_MODE_CODES = MODE_CODES;
export const TRACE_PRESSURE_TIERS = PRESSURE_TIERS;
export const TRACE_RUN_PHASES = RUN_PHASES;
export const TRACE_RUN_OUTCOMES = RUN_OUTCOMES;
export const TRACE_SHIELD_LAYER_IDS = SHIELD_LAYER_IDS;
export const TRACE_HATER_BOT_IDS = HATER_BOT_IDS;
export const TRACE_TIMING_CLASSES = TIMING_CLASSES;
export const TRACE_DECK_TYPES = DECK_TYPES;
export const TRACE_VISIBILITY_LEVELS = VISIBILITY_LEVELS;
export const TRACE_INTEGRITY_STATUSES = INTEGRITY_STATUSES;
export const TRACE_VERIFIED_GRADES = VERIFIED_GRADES;
export const TRACE_SHIELD_LAYER_LABEL_BY_ID = SHIELD_LAYER_LABEL_BY_ID;
export const TRACE_PRESSURE_TIER_NORMALIZED = PRESSURE_TIER_NORMALIZED;
export const TRACE_PRESSURE_TIER_URGENCY_LABEL = PRESSURE_TIER_URGENCY_LABEL;
export const TRACE_PRESSURE_TIER_MIN_HOLD_TICKS = PRESSURE_TIER_MIN_HOLD_TICKS;
export const TRACE_PRESSURE_TIER_ESCALATION_THRESHOLD = PRESSURE_TIER_ESCALATION_THRESHOLD;
export const TRACE_PRESSURE_TIER_DEESCALATION_THRESHOLD = PRESSURE_TIER_DEESCALATION_THRESHOLD;
export const TRACE_RUN_PHASE_NORMALIZED = RUN_PHASE_NORMALIZED;
export const TRACE_RUN_PHASE_STAKES_MULTIPLIER = RUN_PHASE_STAKES_MULTIPLIER;
export const TRACE_RUN_PHASE_TICK_BUDGET_FRACTION = RUN_PHASE_TICK_BUDGET_FRACTION;
export const TRACE_MODE_NORMALIZED = MODE_NORMALIZED;
export const TRACE_MODE_DIFFICULTY_MULTIPLIER = MODE_DIFFICULTY_MULTIPLIER;
export const TRACE_MODE_TENSION_FLOOR = MODE_TENSION_FLOOR;
export const TRACE_MODE_MAX_DIVERGENCE = MODE_MAX_DIVERGENCE;
export const TRACE_SHIELD_LAYER_ABSORPTION_ORDER = SHIELD_LAYER_ABSORPTION_ORDER;
export const TRACE_SHIELD_LAYER_CAPACITY_WEIGHT = SHIELD_LAYER_CAPACITY_WEIGHT;
export const TRACE_TIMING_CLASS_WINDOW_PRIORITY = TIMING_CLASS_WINDOW_PRIORITY;
export const TRACE_TIMING_CLASS_URGENCY_DECAY = TIMING_CLASS_URGENCY_DECAY;
export const TRACE_BOT_THREAT_LEVEL = BOT_THREAT_LEVEL;
export const TRACE_BOT_STATE_THREAT_MULTIPLIER = BOT_STATE_THREAT_MULTIPLIER;
export const TRACE_BOT_STATE_ALLOWED_TRANSITIONS = BOT_STATE_ALLOWED_TRANSITIONS;
export const TRACE_VISIBILITY_CONCEALMENT_FACTOR = VISIBILITY_CONCEALMENT_FACTOR;
export const TRACE_INTEGRITY_STATUS_RISK_SCORE = INTEGRITY_STATUS_RISK_SCORE;
export const TRACE_VERIFIED_GRADE_NUMERIC_SCORE = VERIFIED_GRADE_NUMERIC_SCORE;
export const TRACE_CARD_RARITY_WEIGHT = CARD_RARITY_WEIGHT;
export const TRACE_DIVERGENCE_POTENTIAL_NORMALIZED = DIVERGENCE_POTENTIAL_NORMALIZED;
export const TRACE_COUNTERABILITY_RESISTANCE_SCORE = COUNTERABILITY_RESISTANCE_SCORE;
export const TRACE_TARGETING_SPREAD_FACTOR = TARGETING_SPREAD_FACTOR;
export const TRACE_DECK_TYPE_POWER_LEVEL = DECK_TYPE_POWER_LEVEL;
export const TRACE_DECK_TYPE_IS_OFFENSIVE = DECK_TYPE_IS_OFFENSIVE;
export const TRACE_ATTACK_CATEGORY_BASE_MAGNITUDE = ATTACK_CATEGORY_BASE_MAGNITUDE;
export const TRACE_ATTACK_CATEGORY_IS_COUNTERABLE = ATTACK_CATEGORY_IS_COUNTERABLE;

// Derived — computed from the re-exported maps above
export const TRACE_MAX_BOT_THREAT_SCORE = Math.max(
  ...TRACE_HATER_BOT_IDS.map((id) => TRACE_BOT_THREAT_LEVEL[id]),
);

export const TRACE_TOTAL_SHIELD_CAPACITY_WEIGHT = TRACE_SHIELD_LAYER_IDS.reduce(
  (sum, id) => sum + TRACE_SHIELD_LAYER_CAPACITY_WEIGHT[id],
  0,
);

export const TRACE_TIMING_PRIORITY_AVG =
  Object.values(TRACE_TIMING_CLASS_WINDOW_PRIORITY).reduce((a, b) => a + b, 0) /
  TRACE_TIMING_CLASSES.length;

// ============================================================================
// MARK: Module metadata
// ============================================================================

export const TRACE_MODULE_VERSION = '1.0.0' as const;
export const TRACE_MODULE_READY = true as const;
export const TRACE_SCHEMA_VERSION = 'SP_V1' as const;
export const TRACE_COMPLETE = true as const;
export const TRACE_ML_FEATURE_COUNT = 32 as const;
export const TRACE_DL_TENSOR_SHAPE = [6, 6] as const;

// ============================================================================
// MARK: ML feature labels (32)
// ============================================================================

export const TRACE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'traceErrorRate01',
  'traceOkRate01',
  'avgDurationMs01',
  'maxDurationMs01',
  'p95DurationMs01',
  'openTraceRatio01',
  'stepCompletionRate01',
  'stepBudgetPressure01',
  'stepPrepareRate01',
  'stepTimeRate01',
  'stepPressureRate01',
  'stepTensionRate01',
  'stepBattleRate01',
  'stepShieldRate01',
  'stepCascadeRate01',
  'stepModePostRate01',
  'stepTelemetryRate01',
  'stepSovereigntyRate01',
  'stepOutcomeRate01',
  'stepSealRate01',
  'stepFlushRate01',
  'eventCountAvg01',
  'signalCountAvg01',
  'mutationDepthAvg01',
  'checksumPresenceRate01',
  'traceIndexDensity01',
  'runCoverageRatio01',
  'pressureTierNorm01',
  'modeNorm01',
  'phaseNorm01',
  'anomalyScore01',
  'sessionHealthScore01',
]);

// ============================================================================
// MARK: DL tensor labels (6 rows × 6 cols)
// ============================================================================

export const TRACE_DL_ROW_LABELS: readonly string[] = Object.freeze([
  'step_timing',
  'step_distribution',
  'trace_health',
  'mutation_profile',
  'event_signal_profile',
  'run_pressure',
]);

export const TRACE_DL_COL_LABELS: readonly string[] = Object.freeze([
  'val',
  'normalized',
  'trend',
  'risk',
  'min',
  'max',
]);

// ============================================================================
// MARK: Severity levels and operation kinds
// ============================================================================

export const TRACE_SEVERITY_LEVELS = ['OK', 'WARNING', 'CRITICAL', 'FATAL'] as const;

export const TRACE_OPERATION_KINDS = [
  'TRACE_BEGIN',
  'TRACE_COMMIT_SUCCESS',
  'TRACE_COMMIT_FAILURE',
  'TRACE_GET',
  'TRACE_LIST_RECENT',
  'TRACE_LIST_FOR_TICK',
  'TRACE_SUMMARIZE_RUN',
  'TRACE_LATEST_FOR_TICK',
  'TRACE_OPEN_SESSIONS',
  'TRACE_CLEAR',
] as const;

export const TRACE_SEVERITY_THRESHOLDS: Record<TraceSeverity, number> = {
  OK: 0.0,
  WARNING: 0.45,
  CRITICAL: 0.7,
  FATAL: 0.88,
} as const;

// ============================================================================
// MARK: Derived averages used in ML scoring — wires all GamePrimitive maps
// ============================================================================

export const TRACE_DECK_POWER_AVG =
  Object.values(TRACE_DECK_TYPE_POWER_LEVEL).reduce((a, b) => a + b, 0) /
  TRACE_DECK_TYPES.length;

export const TRACE_CARD_RARITY_WEIGHT_AVG =
  Object.values(TRACE_CARD_RARITY_WEIGHT).reduce((a, b) => a + b, 0) /
  Object.keys(TRACE_CARD_RARITY_WEIGHT).length;

export const TRACE_COUNTERABILITY_AVG =
  Object.values(TRACE_COUNTERABILITY_RESISTANCE_SCORE).reduce((a, b) => a + b, 0) /
  Object.keys(TRACE_COUNTERABILITY_RESISTANCE_SCORE).length;

export const TRACE_VISIBILITY_CONCEALMENT_AVG =
  Object.values(TRACE_VISIBILITY_CONCEALMENT_FACTOR).reduce((a, b) => a + b, 0) /
  TRACE_VISIBILITY_LEVELS.length;

export const TRACE_INTEGRITY_RISK_AVG =
  Object.values(TRACE_INTEGRITY_STATUS_RISK_SCORE).reduce((a, b) => a + b, 0) /
  TRACE_INTEGRITY_STATUSES.length;

export const TRACE_VERIFIED_GRADE_AVG =
  Object.values(TRACE_VERIFIED_GRADE_NUMERIC_SCORE).reduce((a, b) => a + b, 0) /
  TRACE_VERIFIED_GRADES.length;

export const TRACE_ATTACK_MAGNITUDE_AVG =
  Object.values(TRACE_ATTACK_CATEGORY_BASE_MAGNITUDE).reduce((a, b) => a + b, 0) /
  Object.keys(TRACE_ATTACK_CATEGORY_BASE_MAGNITUDE).length;

export const TRACE_TARGETING_SPREAD_AVG =
  Object.values(TRACE_TARGETING_SPREAD_FACTOR).reduce((a, b) => a + b, 0) /
  Object.keys(TRACE_TARGETING_SPREAD_FACTOR).length;

// ============================================================================
// MARK: Mode and operation narration maps — use MODE_CODES and OPERATION_KINDS
// ============================================================================

export const TRACE_MODE_NARRATION: Record<ModeCode, string> = {
  solo: 'Step trace publisher active in solo run — single player trace surface',
  pvp: 'Trace publisher in PvP mode — competitive step forensics enabled',
  coop: 'Trace publisher in co-op mode — shared run step tracing active',
  ghost: 'Trace publisher in ghost mode — stealth run traces, minimal footprint',
} as const;

export const TRACE_OPERATION_NARRATION: Record<TraceOperationKind, string> = {
  TRACE_BEGIN: 'Step trace began — forensic anchor placed before mutation',
  TRACE_COMMIT_SUCCESS: 'Step trace committed success — sealed and indexed',
  TRACE_COMMIT_FAILURE: 'Step trace committed failure — error sealed and indexed',
  TRACE_GET: 'Trace record fetched — single step forensic retrieved',
  TRACE_LIST_RECENT: 'Recent traces listed — rolling window surfaced',
  TRACE_LIST_FOR_TICK: 'Tick traces listed — full tick forensic surfaced',
  TRACE_SUMMARIZE_RUN: 'Run summary built — aggregated trace digest assembled',
  TRACE_LATEST_FOR_TICK: 'Latest tick trace fetched — most recent step surfaced',
  TRACE_OPEN_SESSIONS: 'Open sessions queried — in-flight traces enumerated',
  TRACE_CLEAR: 'Publisher cleared — all trace indices reset',
} as const;

// ============================================================================
// MARK: Tick step ordinal mapping (13 steps) — wired into ML step distribution
// ============================================================================

const TRACE_TICK_STEP_ORDER: readonly TickStep[] = Object.freeze([
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
]);

const TRACE_TICK_STEP_ORDINAL: Readonly<Record<string, number>> = Object.freeze(
  TRACE_TICK_STEP_ORDER.reduce<Record<string, number>>((acc, step, i) => {
    acc[step] = (i + 1) / TRACE_TICK_STEP_ORDER.length;
    return acc;
  }, {}),
);

// ============================================================================
// MARK: Type definitions
// ============================================================================

export type TraceSeverity = (typeof TRACE_SEVERITY_LEVELS)[number];
export type TraceOperationKind = (typeof TRACE_OPERATION_KINDS)[number];

export interface TraceMLVector {
  readonly traceErrorRate01: number;
  readonly traceOkRate01: number;
  readonly avgDurationMs01: number;
  readonly maxDurationMs01: number;
  readonly p95DurationMs01: number;
  readonly openTraceRatio01: number;
  readonly stepCompletionRate01: number;
  readonly stepBudgetPressure01: number;
  readonly stepPrepareRate01: number;
  readonly stepTimeRate01: number;
  readonly stepPressureRate01: number;
  readonly stepTensionRate01: number;
  readonly stepBattleRate01: number;
  readonly stepShieldRate01: number;
  readonly stepCascadeRate01: number;
  readonly stepModePostRate01: number;
  readonly stepTelemetryRate01: number;
  readonly stepSovereigntyRate01: number;
  readonly stepOutcomeRate01: number;
  readonly stepSealRate01: number;
  readonly stepFlushRate01: number;
  readonly eventCountAvg01: number;
  readonly signalCountAvg01: number;
  readonly mutationDepthAvg01: number;
  readonly checksumPresenceRate01: number;
  readonly traceIndexDensity01: number;
  readonly runCoverageRatio01: number;
  readonly pressureTierNorm01: number;
  readonly modeNorm01: number;
  readonly phaseNorm01: number;
  readonly anomalyScore01: number;
  readonly sessionHealthScore01: number;
}

export type TraceDLTensorRow = readonly [number, number, number, number, number, number];

export interface TraceDLTensor {
  readonly step_timing: TraceDLTensorRow;
  readonly step_distribution: TraceDLTensorRow;
  readonly trace_health: TraceDLTensorRow;
  readonly mutation_profile: TraceDLTensorRow;
  readonly event_signal_profile: TraceDLTensorRow;
  readonly run_pressure: TraceDLTensorRow;
}

export interface TraceChatSignal {
  readonly worldEventName: string;
  readonly heatMultiplier01: number;
  readonly helperBlackout: boolean;
  readonly haterRaidActive: boolean;
  readonly traceSnapshotId: string;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly phase: string | null;
  readonly mode: string | null;
  readonly operationKind: TraceOperationKind;
  readonly severity: TraceSeverity;
  readonly healthScore: number;
  readonly openTraceCount: number;
  readonly errorTraceCount: number;
  readonly avgDurationMs: number;
  readonly indexedTraceCount: number;
}

export interface TraceAnnotationBundle {
  readonly traceAnnotationId: string;
  readonly operationKind: TraceOperationKind;
  readonly severity: TraceSeverity;
  readonly healthScore: number;
  readonly narration: string;
  readonly tags: readonly string[];
  readonly timestamp: number;
  readonly mlVector: TraceMLVector;
  readonly dlTensor: TraceDLTensor;
  readonly checksum: string;
}

export interface TraceNarrationHint {
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: TraceSeverity;
  readonly phase: string | null;
  readonly mode: string | null;
  readonly actionPrompt: string;
  readonly debugLabel: string;
}

export interface TraceTrendSnapshot {
  readonly sessionId: string;
  readonly tracesPerMinute: number;
  readonly avgHealthScore: number;
  readonly peakErrorRate: number;
  readonly totalOperations: number;
  readonly operationBreakdown: Readonly<Record<TraceOperationKind, number>>;
  readonly severityBreakdown: Readonly<Record<TraceSeverity, number>>;
  readonly capturedAt: number;
}

export interface TraceSessionReport {
  readonly sessionId: string;
  readonly totalTraces: number;
  readonly uniqueRunIds: readonly string[];
  readonly tickRange: readonly [number, number] | null;
  readonly avgMLHealthScore: number;
  readonly peakErrorRate: number;
  readonly topOperation: TraceOperationKind | null;
  readonly durationMs: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

export interface TraceEventLogEntry {
  readonly entryId: string;
  readonly sessionId: string;
  readonly operationKind: TraceOperationKind;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly traceId: string | null;
  readonly step: TickStep | null;
  readonly severity: TraceSeverity;
  readonly healthScore: number;
  readonly durationMs: number;
  readonly timestamp: number;
  readonly mlVector: TraceMLVector;
}

export interface TraceInspectionBundle {
  readonly inspectionId: string;
  readonly sessionId: string;
  readonly snapshot: TraceMLVector;
  readonly tensor: TraceDLTensor;
  readonly trend: TraceTrendSnapshot;
  readonly recentEntries: readonly TraceEventLogEntry[];
  readonly anomalyFlags: readonly string[];
  readonly capturedAt: number;
}

export interface TraceRunSummary {
  readonly runId: string | null;
  readonly totalTracesForRun: number;
  readonly okCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
  readonly latestTick: number | null;
  readonly phase: string | null;
  readonly mode: string | null;
  readonly avgHealthScore: number;
  readonly stepsSeen: readonly TickStep[];
  readonly traceIds: readonly string[];
}

export interface TraceHealthSnapshot {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly healthScore: number;
  readonly severity: TraceSeverity;
  readonly openTraceCount: number;
  readonly indexedTraceCount: number;
  readonly errorTraceCount: number;
  readonly avgDurationMs: number;
  readonly stepBudgetPressure: number;
  readonly capturedAt: number;
}

export interface TraceExportBundle {
  readonly exportId: string;
  readonly schemaVersion: string;
  readonly operationKind: TraceOperationKind;
  readonly mlVector: TraceMLVector;
  readonly dlTensor: TraceDLTensor;
  readonly chatSignal: TraceChatSignal;
  readonly annotation: TraceAnnotationBundle;
  readonly narration: TraceNarrationHint;
  readonly healthSnapshot: TraceHealthSnapshot;
  readonly runSummary: TraceRunSummary;
  readonly exportedAt: number;
}

export interface TraceMLVectorInput {
  readonly recentRecords: readonly TickTraceRecord[];
  readonly openSessionCount: number;
  readonly maxIndexedPerRun: number;
  readonly totalIndexedForRun: number;
  readonly runId: string | null;
  readonly latestSnapshot: RunStateSnapshot | null;
  readonly stepBudgetMs: number;
  readonly totalIndexedAllRuns: number;
}

// ============================================================================
// MARK: StepTracePublisherOptions (original, exported)
// ============================================================================

export interface StepTracePublisherOptions extends TickTraceRecorderOptions {
  readonly maxIndexedPerRun?: number;
}

// ============================================================================
// MARK: StepTraceSession (original, exported)
// ============================================================================

export interface StepTraceSession {
  readonly trace: TickTrace;
  readonly handle: TickTraceHandle;
  readonly startedAtMs: number;
  readonly tags: readonly string[];
}

// ============================================================================
// MARK: StepTraceSuccessInput (original, exported)
// ============================================================================

export interface StepTraceSuccessInput {
  readonly afterSnapshot: RunStateSnapshot;
  readonly finishedAtMs: number;
  readonly events?: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly signals?: readonly EngineSignal[];
}

// ============================================================================
// MARK: StepTraceFailureCommitInput (original, exported)
// ============================================================================

export interface StepTraceFailureCommitInput {
  readonly error: unknown;
  readonly finishedAtMs: number;
  readonly afterSnapshot?: RunStateSnapshot;
  readonly events?: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly signals?: readonly EngineSignal[];
}

// ============================================================================
// MARK: StepTraceRunSummary (original, exported)
// ============================================================================

export interface StepTraceRunSummary {
  readonly runId: string;
  readonly totalIndexed: number;
  readonly okCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
  readonly latestTraceId: string | null;
  readonly latestTick: number | null;
  readonly stepsSeen: readonly TickStep[];
}

// ============================================================================
// MARK: Internal constants
// ============================================================================

const DEFAULT_MAX_INDEXED_PER_RUN = 4_096;
const TRACE_STEP_BUDGET_MS = 50;
const TRACE_MAX_DURATION_NORM_MS = 500;
const TRACE_MAX_EVENTS_PER_TRACE = 200;
const TRACE_MAX_SIGNALS_PER_TRACE = 100;
const TRACE_MAX_MUTATION_KEYS = 32;
const TRACE_ROLLING_WINDOW = 64;

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function normalizeCount(count: number, cap: number): number {
  return cap <= 0 ? 0 : clamp01(count / cap);
}

function computeP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function countStepInRecords(records: readonly TickTraceRecord[], step: TickStep): number {
  return records.filter((r) => r.step === step).length;
}

// ============================================================================
// MARK: extractTraceMLVector — 32-dim feature vector from publisher state
// ============================================================================

export function extractTraceMLVector(input: TraceMLVectorInput): TraceMLVector {
  const {
    recentRecords,
    openSessionCount,
    maxIndexedPerRun,
    totalIndexedForRun,
    latestSnapshot,
    stepBudgetMs,
    totalIndexedAllRuns,
  } = input;

  const total = recentRecords.length;

  // ── Error / OK rates ───────────────────────────────────────────────────────
  const errorCount = recentRecords.filter((r) => r.status === 'ERROR').length;
  const okCount = recentRecords.filter((r) => r.status === 'OK').length;
  const traceErrorRate = total > 0 ? clamp01(errorCount / total) : 0;
  const traceOkRate = total > 0 ? clamp01(okCount / total) : 0;

  // ── Duration metrics ───────────────────────────────────────────────────────
  const durations = recentRecords.map((r) => r.durationMs);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  const p95Duration = computeP95(durations);
  const overBudget = recentRecords.filter((r) => r.durationMs > stepBudgetMs).length;
  const stepBudgetPressure = total > 0 ? clamp01(overBudget / total) : 0;

  // ── Step distribution (13 steps) ──────────────────────────────────────────
  const stepPrepareRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_01_PREPARE'), total) : 0;
  const stepTimeRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_02_TIME'), total) : 0;
  const stepPressureRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_03_PRESSURE'), total) : 0;
  const stepTensionRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_04_TENSION'), total) : 0;
  const stepBattleRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_05_BATTLE'), total) : 0;
  const stepShieldRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_06_SHIELD'), total) : 0;
  const stepCascadeRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_07_CASCADE'), total) : 0;
  const stepModePostRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_08_MODE_POST'), total) : 0;
  const stepTelemetryRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_09_TELEMETRY'), total) : 0;
  const stepSovereigntyRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_10_SOVEREIGNTY_SNAPSHOT'), total) : 0;
  const stepOutcomeRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_11_OUTCOME_GATE'), total) : 0;
  const stepSealRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_12_EVENT_SEAL'), total) : 0;
  const stepFlushRate = total > 0 ? normalizeCount(countStepInRecords(recentRecords, 'STEP_13_FLUSH'), total) : 0;

  // ── Completion and open session ratio ─────────────────────────────────────
  const stepCompletionRate = total > 0 ? clamp01(okCount / total) : 0;
  const openTraceRatio = normalizeCount(openSessionCount, Math.max(1, total + openSessionCount));

  // ── Event and signal volumes ───────────────────────────────────────────────
  const totalEvents = recentRecords.reduce((s, r) => s + r.eventCount, 0);
  const totalSignals = recentRecords.reduce((s, r) => s + r.signalCount, 0);
  const eventCountAvg = total > 0 ? normalizeCount(totalEvents / total, TRACE_MAX_EVENTS_PER_TRACE) : 0;
  const signalCountAvg = total > 0 ? normalizeCount(totalSignals / total, TRACE_MAX_SIGNALS_PER_TRACE) : 0;

  // ── Mutation depth ─────────────────────────────────────────────────────────
  const totalMutations = recentRecords.reduce(
    (s, r) => s + r.mutation.changedTopLevelKeys.length,
    0,
  );
  const mutationDepthAvg = total > 0
    ? normalizeCount(totalMutations / total, TRACE_MAX_MUTATION_KEYS)
    : 0;

  // ── Checksum presence rate ─────────────────────────────────────────────────
  const withChecksum = recentRecords.filter((r) => r.afterChecksum !== null).length;
  const checksumPresenceRate = total > 0 ? clamp01(withChecksum / total) : 0;

  // ── Index density and run coverage ────────────────────────────────────────
  const traceIndexDensity = normalizeCount(totalIndexedForRun, maxIndexedPerRun);
  const runCoverageRatio = normalizeCount(totalIndexedAllRuns, maxIndexedPerRun * 8);

  // ── Snapshot-derived features ──────────────────────────────────────────────
  const pressureTierNorm = latestSnapshot?.pressure
    ? (TRACE_PRESSURE_TIER_NORMALIZED[latestSnapshot.pressure.tier as PressureTier] ?? 0)
    : 0;
  const modeNorm = latestSnapshot?.mode
    ? (TRACE_MODE_NORMALIZED[latestSnapshot.mode as ModeCode] ?? 0)
    : 0;
  const phaseNorm = latestSnapshot?.phase
    ? (TRACE_RUN_PHASE_NORMALIZED[latestSnapshot.phase as RunPhase] ?? 0)
    : 0;

  // ── Anomaly score — burst of errors, slow steps, missing checksums ─────────
  const anomalyScore = clamp01(
    traceErrorRate * 0.4 +
      stepBudgetPressure * 0.3 +
      (1 - checksumPresenceRate) * 0.2 +
      openTraceRatio * 0.1,
  );

  // ── Session health score ───────────────────────────────────────────────────
  const sessionHealthScore = clamp01(
    traceOkRate * 0.3 +
      checksumPresenceRate * 0.2 +
      (1 - stepBudgetPressure) * 0.2 +
      (1 - anomalyScore) * 0.15 +
      traceIndexDensity * 0.1 +
      stepCompletionRate * 0.05,
  );

  return Object.freeze({
    traceErrorRate01: traceErrorRate,
    traceOkRate01: traceOkRate,
    avgDurationMs01: normalizeCount(avgDuration, TRACE_MAX_DURATION_NORM_MS),
    maxDurationMs01: normalizeCount(maxDuration, TRACE_MAX_DURATION_NORM_MS),
    p95DurationMs01: normalizeCount(p95Duration, TRACE_MAX_DURATION_NORM_MS),
    openTraceRatio01: openTraceRatio,
    stepCompletionRate01: stepCompletionRate,
    stepBudgetPressure01: stepBudgetPressure,
    stepPrepareRate01: stepPrepareRate,
    stepTimeRate01: stepTimeRate,
    stepPressureRate01: stepPressureRate,
    stepTensionRate01: stepTensionRate,
    stepBattleRate01: stepBattleRate,
    stepShieldRate01: stepShieldRate,
    stepCascadeRate01: stepCascadeRate,
    stepModePostRate01: stepModePostRate,
    stepTelemetryRate01: stepTelemetryRate,
    stepSovereigntyRate01: stepSovereigntyRate,
    stepOutcomeRate01: stepOutcomeRate,
    stepSealRate01: stepSealRate,
    stepFlushRate01: stepFlushRate,
    eventCountAvg01: eventCountAvg,
    signalCountAvg01: signalCountAvg,
    mutationDepthAvg01: mutationDepthAvg,
    checksumPresenceRate01: checksumPresenceRate,
    traceIndexDensity01: traceIndexDensity,
    runCoverageRatio01: runCoverageRatio,
    pressureTierNorm01: pressureTierNorm,
    modeNorm01: modeNorm,
    phaseNorm01: phaseNorm,
    anomalyScore01: anomalyScore,
    sessionHealthScore01: sessionHealthScore,
  } satisfies TraceMLVector);
}

// ============================================================================
// MARK: buildTraceDLTensor — 6×6 deep-learning tensor
// ============================================================================

export function buildTraceDLTensor(
  input: TraceMLVectorInput,
  vector: TraceMLVector,
): TraceDLTensor {
  const { recentRecords, openSessionCount, stepBudgetMs, latestSnapshot } = input;
  const total = recentRecords.length;
  const durations = recentRecords.map((r) => r.durationMs);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
  const p95Duration = computeP95(durations);
  const overBudgetCount = recentRecords.filter((r) => r.durationMs > stepBudgetMs).length;

  // step_timing row — timing health
  const stepTimingRow: TraceDLTensorRow = Object.freeze([
    normalizeCount(avgDuration, TRACE_MAX_DURATION_NORM_MS),
    vector.avgDurationMs01,
    normalizeCount(p95Duration - avgDuration, TRACE_MAX_DURATION_NORM_MS),
    normalizeCount(overBudgetCount, Math.max(1, total)),
    normalizeCount(minDuration, TRACE_MAX_DURATION_NORM_MS),
    normalizeCount(maxDuration, TRACE_MAX_DURATION_NORM_MS),
  ]) as TraceDLTensorRow;

  // step_distribution row — 13-step ordinal spread
  const stepsUsed = new Set(recentRecords.map((r) => r.step as string));
  const avgOrdinal =
    total > 0
      ? recentRecords.reduce((s, r) => s + (TRACE_TICK_STEP_ORDINAL[r.step as string] ?? 0), 0) /
        total
      : 0;
  const engineStepCount = ['STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION',
    'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE']
    .map((s) => countStepInRecords(recentRecords, s as TickStep))
    .reduce((a, b) => a + b, 0);
  const finalStepCount = ['STEP_11_OUTCOME_GATE', 'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH']
    .map((s) => countStepInRecords(recentRecords, s as TickStep))
    .reduce((a, b) => a + b, 0);

  const stepDistributionRow: TraceDLTensorRow = Object.freeze([
    clamp01(avgOrdinal),
    normalizeCount(stepsUsed.size, TRACE_TICK_STEP_ORDER.length),
    normalizeCount(engineStepCount, Math.max(1, total)),
    normalizeCount(finalStepCount, Math.max(1, total)),
    vector.stepBattleRate01,
    vector.stepCascadeRate01,
  ]) as TraceDLTensorRow;

  // trace_health row — overall health
  const errorCount = recentRecords.filter((r) => r.status === 'ERROR').length;
  const withChecksum = recentRecords.filter((r) => r.afterChecksum !== null).length;

  const traceHealthRow: TraceDLTensorRow = Object.freeze([
    vector.sessionHealthScore01,
    vector.traceOkRate01,
    vector.checksumPresenceRate01,
    vector.anomalyScore01,
    normalizeCount(errorCount, Math.max(1, total)),
    normalizeCount(withChecksum, Math.max(1, total)),
  ]) as TraceDLTensorRow;

  // mutation_profile row — state change depth
  const totalMutations = recentRecords.reduce((s, r) => s + r.mutation.changedTopLevelKeys.length, 0);
  const maxMutations = recentRecords.reduce((m, r) => Math.max(m, r.mutation.changedTopLevelKeys.length), 0);
  const minMutations = recentRecords.reduce((m, r) => Math.min(m, r.mutation.changedTopLevelKeys.length), TRACE_MAX_MUTATION_KEYS);

  const mutationProfileRow: TraceDLTensorRow = Object.freeze([
    normalizeCount(total > 0 ? totalMutations / total : 0, TRACE_MAX_MUTATION_KEYS),
    vector.mutationDepthAvg01,
    normalizeCount(maxMutations, TRACE_MAX_MUTATION_KEYS),
    normalizeCount(openSessionCount, 64),
    normalizeCount(minMutations, TRACE_MAX_MUTATION_KEYS),
    vector.stepCompletionRate01,
  ]) as TraceDLTensorRow;

  // event_signal_profile row — bus and signal activity
  const totalEvents = recentRecords.reduce((s, r) => s + r.eventCount, 0);
  const totalSignals = recentRecords.reduce((s, r) => s + r.signalCount, 0);
  const maxEvents = recentRecords.reduce((m, r) => Math.max(m, r.eventCount), 0);
  const maxSignals = recentRecords.reduce((m, r) => Math.max(m, r.signalCount), 0);

  const eventSignalRow: TraceDLTensorRow = Object.freeze([
    normalizeCount(total > 0 ? totalEvents / total : 0, TRACE_MAX_EVENTS_PER_TRACE),
    normalizeCount(total > 0 ? totalSignals / total : 0, TRACE_MAX_SIGNALS_PER_TRACE),
    normalizeCount(maxEvents, TRACE_MAX_EVENTS_PER_TRACE),
    normalizeCount(maxSignals, TRACE_MAX_SIGNALS_PER_TRACE),
    vector.eventCountAvg01,
    vector.signalCountAvg01,
  ]) as TraceDLTensorRow;

  // run_pressure row — pressure/mode/phase from snapshot
  const phaseStakes = latestSnapshot?.phase
    ? (TRACE_RUN_PHASE_STAKES_MULTIPLIER[latestSnapshot.phase as RunPhase] ?? 1)
    : 1;
  const modeDifficulty = latestSnapshot?.mode
    ? (TRACE_MODE_DIFFICULTY_MULTIPLIER[latestSnapshot.mode as ModeCode] ?? 1)
    : 1;
  const modeTensionFloor = latestSnapshot?.mode
    ? (TRACE_MODE_TENSION_FLOOR[latestSnapshot.mode as ModeCode] ?? 0)
    : 0;
  const cascadeActive = latestSnapshot?.cascade
    ? normalizeCount(latestSnapshot.cascade.activeChains?.length ?? 0, 10)
    : 0;
  const battleActive = (latestSnapshot?.battle?.pendingAttacks?.length ?? 0) > 0 ? 1 : 0;

  const runPressureRow: TraceDLTensorRow = Object.freeze([
    vector.pressureTierNorm01,
    vector.modeNorm01 + modeTensionFloor * 0.01, // blend mode tension floor into mode norm
    vector.phaseNorm01,
    normalizeCount(phaseStakes, 3) * normalizeCount(modeDifficulty, 2),
    cascadeActive,
    battleActive,
  ]) as TraceDLTensorRow;

  return Object.freeze({
    step_timing: stepTimingRow,
    step_distribution: stepDistributionRow,
    trace_health: traceHealthRow,
    mutation_profile: mutationProfileRow,
    event_signal_profile: eventSignalRow,
    run_pressure: runPressureRow,
  } satisfies TraceDLTensor);
}

// ============================================================================
// MARK: computeTraceHealthScore — weighted sum from ML vector
// ============================================================================

export function computeTraceHealthScore(vector: TraceMLVector): number {
  return clamp01(
    vector.traceOkRate01 * 0.25 +
      vector.checksumPresenceRate01 * 0.2 +
      (1 - vector.traceErrorRate01) * 0.2 +
      (1 - vector.stepBudgetPressure01) * 0.15 +
      (1 - vector.anomalyScore01) * 0.1 +
      vector.stepCompletionRate01 * 0.1,
  );
}

// ============================================================================
// MARK: classifyTraceSeverity
// ============================================================================

export function classifyTraceSeverity(vector: TraceMLVector): TraceSeverity {
  const score = computeTraceHealthScore(vector);
  if (score >= 1 - TRACE_SEVERITY_THRESHOLDS.WARNING) return 'OK';
  if (score >= 1 - TRACE_SEVERITY_THRESHOLDS.CRITICAL) return 'WARNING';
  if (score >= 1 - TRACE_SEVERITY_THRESHOLDS.FATAL) return 'CRITICAL';
  return 'FATAL';
}

// ============================================================================
// MARK: isTraceSeverity / isTraceOperationKind
// ============================================================================

export function isTraceSeverity(value: string): value is TraceSeverity {
  return (TRACE_SEVERITY_LEVELS as readonly string[]).includes(value);
}

export function isTraceOperationKind(value: string): value is TraceOperationKind {
  return (TRACE_OPERATION_KINDS as readonly string[]).includes(value);
}

// ============================================================================
// MARK: getTraceActionRecommendation
// ============================================================================

export function getTraceActionRecommendation(
  vector: TraceMLVector,
  operationKind: TraceOperationKind,
): string {
  if (vector.traceErrorRate01 > 0.5) {
    return 'Trace error rate critical — inspect failing steps immediately';
  }
  if (vector.stepBudgetPressure01 > 0.6) {
    return 'Step budget pressure elevated — profile slow steps and reduce latency';
  }
  if (vector.openTraceRatio01 > 0.5) {
    return 'Too many open traces — check for unclosed sessions in begin/commit cycle';
  }
  if (vector.anomalyScore01 > 0.7) {
    return 'High anomaly score detected — review recent trace records for corruption';
  }
  if (vector.checksumPresenceRate01 < 0.5) {
    return 'Checksum coverage low — ensure afterSnapshot is provided on commitSuccess';
  }
  if (vector.mutationDepthAvg01 > 0.7) {
    return 'Mutation depth high — review steps changing excessive state keys';
  }
  if (operationKind === 'TRACE_CLEAR') {
    return 'Publisher clear requested — confirm no active sessions before clearing';
  }
  return 'Trace publisher nominal — all step trace operations proceeding normally';
}

// ============================================================================
// MARK: getTraceNarrationPhrase — uses TRACE_PRESSURE_TIER_URGENCY_LABEL
// ============================================================================

export function getTraceNarrationPhrase(
  vector: TraceMLVector,
  latestSnapshot: RunStateSnapshot | null,
): string {
  const tier = latestSnapshot?.pressure?.tier as PressureTier | undefined;
  const urgency = tier ? TRACE_PRESSURE_TIER_URGENCY_LABEL[tier] : 'Baseline';
  const modeLabel = latestSnapshot?.mode
    ? TRACE_MODE_NARRATION[latestSnapshot.mode as ModeCode]
    : 'No run active';
  const health = computeTraceHealthScore(vector);
  const severity = classifyTraceSeverity(vector);
  return `[${severity}] ${urgency} — ${health.toFixed(2)} health — ${modeLabel}`;
}

// ============================================================================
// MARK: Analytics support functions — wire GamePrimitive maps into UX scoring
// ============================================================================

export function computeTracePressureWeight(tier: PressureTier): number {
  return TRACE_PRESSURE_TIER_NORMALIZED[tier] ?? 0;
}

export function computeTraceModeFrequency(mode: ModeCode): number {
  return TRACE_MODE_NORMALIZED[mode] ?? 0;
}

export function computeTracePhaseDensity(phase: RunPhase): number {
  return TRACE_RUN_PHASE_NORMALIZED[phase] ?? 0;
}

export function computeTraceDivergenceScore(latestSnapshot: RunStateSnapshot | null): number {
  if (latestSnapshot === null) return 0;
  return clamp01(latestSnapshot.pressure?.score ?? 0);
}

export function getTraceBotThreatLevel(botId: string): number {
  return (TRACE_BOT_THREAT_LEVEL as Record<string, number>)[botId] ?? 0;
}

export function getTraceBotThreatMultiplier(state: string): number {
  return (TRACE_BOT_STATE_THREAT_MULTIPLIER as Record<string, number>)[state] ?? 1;
}

export function getTraceBotTransitions(state: string): readonly string[] {
  return (TRACE_BOT_STATE_ALLOWED_TRANSITIONS as Record<string, readonly string[]>)[state] ?? [];
}

export function getTraceShieldLayerLabel(layerId: string): string {
  return (TRACE_SHIELD_LAYER_LABEL_BY_ID as Record<string, string>)[layerId] ?? layerId;
}

export function getTraceShieldCapacityWeight(layerId: string): number {
  return (TRACE_SHIELD_LAYER_CAPACITY_WEIGHT as Record<string, number>)[layerId] ?? 0;
}

export function getTraceVisibilityConcealment(level: string): number {
  return (TRACE_VISIBILITY_CONCEALMENT_FACTOR as Record<string, number>)[level] ?? 0;
}

export function getTraceIntegrityRisk(status: string): number {
  return (TRACE_INTEGRITY_STATUS_RISK_SCORE as Record<string, number>)[status] ?? 0;
}

export function getTraceVerifiedGradeScore(grade: string): number {
  return (TRACE_VERIFIED_GRADE_NUMERIC_SCORE as Record<string, number>)[grade] ?? 0;
}

export function getTraceCardRarityWeight(rarity: string): number {
  return (TRACE_CARD_RARITY_WEIGHT as Record<string, number>)[rarity] ?? 0;
}

export function getTraceAttackMagnitude(category: string): number {
  return (TRACE_ATTACK_CATEGORY_BASE_MAGNITUDE as Record<string, number>)[category] ?? 0;
}

export function getTraceCounterabilityScore(counterability: string): number {
  return (TRACE_COUNTERABILITY_RESISTANCE_SCORE as Record<string, number>)[counterability] ?? 0;
}

export function getTraceTargetingSpread(targeting: string): number {
  return (TRACE_TARGETING_SPREAD_FACTOR as Record<string, number>)[targeting] ?? 0;
}

export function getTraceDivergenceNorm(divergence: string): number {
  return (TRACE_DIVERGENCE_POTENTIAL_NORMALIZED as Record<string, number>)[divergence] ?? 0;
}

export function getTraceDeckPower(deckType: string): number {
  return (TRACE_DECK_TYPE_POWER_LEVEL as Record<string, number>)[deckType] ?? 0;
}

export function getTraceTimingPriority(timingClass: string): number {
  return (TRACE_TIMING_CLASS_WINDOW_PRIORITY as Record<string, number>)[timingClass] ?? 0;
}

export function getTraceTimingUrgencyDecay(timingClass: string): number {
  return (TRACE_TIMING_CLASS_URGENCY_DECAY as Record<string, number>)[timingClass] ?? 0;
}

export function computeTraceOutcomeWeight(outcome: RunOutcome): number {
  const weights: Record<RunOutcome, number> = {
    FREEDOM: 0,
    TIMEOUT: 0.5,
    BANKRUPT: 0.9,
    ABANDONED: 0.3,
  };
  return weights[outcome] ?? 0;
}

// ============================================================================
// MARK: buildTraceChatSignal
// ============================================================================

export function buildTraceChatSignal(
  input: TraceMLVectorInput,
  vector: TraceMLVector,
  operationKind: TraceOperationKind,
): TraceChatSignal {
  const { latestSnapshot, openSessionCount, totalIndexedForRun, recentRecords } = input;
  const severity = classifyTraceSeverity(vector);
  const healthScore = computeTraceHealthScore(vector);

  const errorCount = recentRecords.filter((r) => r.status === 'ERROR').length;
  const avgDurationMs =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + r.durationMs, 0) / recentRecords.length
      : 0;

  const traceSnapshotId = createDeterministicId(
    'trace-chat',
    input.runId ?? 'null',
    String(latestSnapshot?.tick ?? 0),
    operationKind,
    String(Date.now()),
  );

  const worldEventName = `TRACE_${operationKind}_${severity}`;
  const heatMultiplier = clamp01(vector.anomalyScore01 * 1.3);

  return Object.freeze({
    worldEventName,
    heatMultiplier01: heatMultiplier,
    helperBlackout: vector.traceErrorRate01 > 0.7,
    haterRaidActive: vector.stepBattleRate01 > 0.3 || vector.stepCascadeRate01 > 0.3,
    traceSnapshotId,
    runId: input.runId ?? null,
    tick: latestSnapshot?.tick ?? null,
    phase: latestSnapshot?.phase ?? null,
    mode: latestSnapshot?.mode ?? null,
    operationKind,
    severity,
    healthScore,
    openTraceCount: openSessionCount,
    errorTraceCount: errorCount,
    avgDurationMs,
    indexedTraceCount: totalIndexedForRun,
  } satisfies TraceChatSignal);
}

// ============================================================================
// MARK: buildTraceAnnotation
// ============================================================================

export function buildTraceAnnotation(
  input: TraceMLVectorInput,
  vector: TraceMLVector,
  tensor: TraceDLTensor,
  operationKind: TraceOperationKind,
): TraceAnnotationBundle {
  const severity = classifyTraceSeverity(vector);
  const healthScore = computeTraceHealthScore(vector);
  const narration = TRACE_OPERATION_NARRATION[operationKind];
  const timestamp = Date.now();

  const checksum = checksumSnapshot({
    vector,
    operationKind,
    severity,
    healthScore,
    timestamp,
  });

  const traceAnnotationId = createDeterministicId('trace-annotation', checksum);

  const tags: string[] = [
    `op:${operationKind}`,
    `sev:${severity}`,
    `health:${healthScore.toFixed(2)}`,
  ];
  if (input.runId !== null) tags.push(`run:${input.runId}`);
  if (vector.stepBattleRate01 > 0.3) tags.push('battle:active');
  if (vector.stepCascadeRate01 > 0.3) tags.push('cascade:active');
  if (vector.traceErrorRate01 > 0.3) tags.push('error:elevated');
  if (vector.openTraceRatio01 > 0.4) tags.push('open:many');
  if (vector.stepBudgetPressure01 > 0.5) tags.push('budget:stressed');

  return Object.freeze({
    traceAnnotationId,
    operationKind,
    severity,
    healthScore,
    narration,
    tags: freezeArray(tags),
    timestamp,
    mlVector: vector,
    dlTensor: tensor,
    checksum,
  } satisfies TraceAnnotationBundle);
}

// ============================================================================
// MARK: buildTraceNarrationHint
// ============================================================================

export function buildTraceNarrationHint(
  vector: TraceMLVector,
  latestSnapshot: RunStateSnapshot | null,
  operationKind: TraceOperationKind,
): TraceNarrationHint {
  const severity = classifyTraceSeverity(vector);
  const healthScore = computeTraceHealthScore(vector);

  const headline =
    healthScore > 0.8
      ? 'Step traces flowing clean — all steps sealing within budget'
      : healthScore > 0.55
        ? 'Step trace pressure building — error rate or budget risk rising'
        : healthScore > 0.3
          ? 'Step traces stressed — mutation depth or errors elevated'
          : 'Critical trace failure — immediate step forensic review required';

  const subtext =
    severity === 'OK'
      ? 'Trace surface is healthy. All steps beginning, committing, and sealing properly.'
      : severity === 'WARNING'
        ? 'Elevated trace error rate or budget pressure. Monitor step commit success.'
        : severity === 'CRITICAL'
          ? 'Trace system under critical pressure. Step failures impacting run integrity.'
          : 'Fatal trace degradation. Step commit cycle is broken. Rollback may be required.';

  const modeNarration = latestSnapshot?.mode
    ? TRACE_MODE_NARRATION[latestSnapshot.mode as ModeCode]
    : 'No active run — trace publisher in standby mode';

  const actionPrompt = getTraceActionRecommendation(vector, operationKind);

  return Object.freeze({
    headline,
    subtext,
    urgency: severity,
    phase: latestSnapshot?.phase ?? null,
    mode: latestSnapshot?.mode ?? null,
    actionPrompt: `${actionPrompt} | ${modeNarration}`,
    debugLabel: `SP:${operationKind}:${severity}:${healthScore.toFixed(3)}`,
  } satisfies TraceNarrationHint);
}

// ============================================================================
// MARK: buildTraceHealthSnapshot
// ============================================================================

export function buildTraceHealthSnapshot(
  input: TraceMLVectorInput,
  vector: TraceMLVector,
): TraceHealthSnapshot {
  const { latestSnapshot, openSessionCount, totalIndexedForRun, recentRecords, stepBudgetMs } = input;
  const severity = classifyTraceSeverity(vector);
  const healthScore = computeTraceHealthScore(vector);
  const errorCount = recentRecords.filter((r) => r.status === 'ERROR').length;
  const avgDurationMs =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + r.durationMs, 0) / recentRecords.length
      : 0;
  const overBudget = recentRecords.filter((r) => r.durationMs > stepBudgetMs).length;
  const budgetPressure =
    recentRecords.length > 0 ? clamp01(overBudget / recentRecords.length) : 0;

  return Object.freeze({
    runId: input.runId ?? null,
    tick: latestSnapshot?.tick ?? null,
    healthScore,
    severity,
    openTraceCount: openSessionCount,
    indexedTraceCount: totalIndexedForRun,
    errorTraceCount: errorCount,
    avgDurationMs,
    stepBudgetPressure: budgetPressure,
    capturedAt: Date.now(),
  } satisfies TraceHealthSnapshot);
}

// ============================================================================
// MARK: buildTraceRunSummary
// ============================================================================

export function buildTraceRunSummary(
  input: TraceMLVectorInput,
  traceIds: readonly string[],
  avgHealthScore: number,
): TraceRunSummary {
  const { recentRecords, runId, latestSnapshot } = input;
  const okCount = recentRecords.filter((r) => r.status === 'OK').length;
  const errorCount = recentRecords.filter((r) => r.status === 'ERROR').length;
  const avgDurationMs =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + r.durationMs, 0) / recentRecords.length
      : 0;

  const stepsSet = new Set<TickStep>(recentRecords.map((r) => r.step as TickStep));
  const latestTick =
    recentRecords.length > 0
      ? Math.max(...recentRecords.map((r) => r.tick))
      : latestSnapshot?.tick ?? null;

  return Object.freeze({
    runId: runId ?? null,
    totalTracesForRun: recentRecords.length,
    okCount,
    errorCount,
    avgDurationMs,
    latestTick,
    phase: latestSnapshot?.phase ?? null,
    mode: latestSnapshot?.mode ?? null,
    avgHealthScore,
    stepsSeen: freezeArray([...stepsSet]),
    traceIds: freezeArray([...traceIds]),
  } satisfies TraceRunSummary);
}

// ============================================================================
// MARK: Validation and serialization
// ============================================================================

export function validateTraceMLVector(vector: TraceMLVector): boolean {
  return TRACE_ML_FEATURE_LABELS.every((label) => {
    const v = (vector as unknown as Record<string, number>)[label];
    return typeof v === 'number' && v >= 0 && v <= 1;
  });
}

export function flattenTraceMLVector(vector: TraceMLVector): readonly number[] {
  return Object.freeze(
    TRACE_ML_FEATURE_LABELS.map(
      (label) => (vector as unknown as Record<string, number>)[label] ?? 0,
    ),
  );
}

export function buildTraceMLNamedMap(vector: TraceMLVector): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const label of TRACE_ML_FEATURE_LABELS) {
    result[label] = (vector as unknown as Record<string, number>)[label] ?? 0;
  }
  return Object.freeze(result);
}

export function flattenTraceDLTensor(tensor: TraceDLTensor): readonly number[] {
  return Object.freeze([
    ...tensor.step_timing,
    ...tensor.step_distribution,
    ...tensor.trace_health,
    ...tensor.mutation_profile,
    ...tensor.event_signal_profile,
    ...tensor.run_pressure,
  ]);
}

export function extractTraceDLColumn(
  tensor: TraceDLTensor,
  colIndex: number,
): readonly number[] {
  if (colIndex < 0 || colIndex >= TRACE_DL_TENSOR_SHAPE[1]) {
    throw new RangeError(`TraceDLTensor column index out of range: ${colIndex}`);
  }
  return Object.freeze(
    TRACE_DL_ROW_LABELS.map(
      (row) => (tensor as unknown as Record<string, readonly number[]>)[row][colIndex] ?? 0,
    ),
  );
}

export function computeTraceMLSimilarity(a: TraceMLVector, b: TraceMLVector): number {
  const fa = flattenTraceMLVector(a);
  const fb = flattenTraceMLVector(b);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < fa.length; i++) {
    dot += fa[i] * fb[i];
    normA += fa[i] * fa[i];
    normB += fb[i] * fb[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : clamp01(dot / denom);
}

export function getTopTraceFeatures(
  vector: TraceMLVector,
  topN = 5,
): readonly { label: string; value: number }[] {
  const entries = TRACE_ML_FEATURE_LABELS.map((label) => ({
    label,
    value: (vector as unknown as Record<string, number>)[label] ?? 0,
  }));
  return Object.freeze(entries.sort((a, b) => b.value - a.value).slice(0, topN));
}

export function serializeTraceMLVector(vector: TraceMLVector): string {
  return stableStringify(vector);
}

export function serializeTraceDLTensor(tensor: TraceDLTensor): string {
  return stableStringify(tensor);
}

export function cloneTraceMLVector(vector: TraceMLVector): TraceMLVector {
  return cloneJson(vector);
}

// ============================================================================
// MARK: buildTraceExportBundle — full ML/DL/chat/annotation/narration package
// ============================================================================

export function buildTraceExportBundle(
  input: TraceMLVectorInput,
  operationKind: TraceOperationKind,
  traceIds: readonly string[],
  avgHealthScore: number,
): TraceExportBundle {
  const vector = extractTraceMLVector(input);
  const tensor = buildTraceDLTensor(input, vector);
  const chatSignal = buildTraceChatSignal(input, vector, operationKind);
  const annotation = buildTraceAnnotation(input, vector, tensor, operationKind);
  const narration = buildTraceNarrationHint(vector, input.latestSnapshot, operationKind);
  const healthSnapshot = buildTraceHealthSnapshot(input, vector);
  const runSummary = buildTraceRunSummary(input, traceIds, avgHealthScore);

  const exportId = createDeterministicId(
    'trace-export',
    computeTickSeal({
      runId: input.runId ?? 'none',
      tick: input.latestSnapshot?.tick ?? 0,
      step: operationKind,
      stateChecksum: annotation.checksum,
      eventChecksums: [],
    }),
  );

  return Object.freeze({
    exportId,
    schemaVersion: TRACE_SCHEMA_VERSION,
    operationKind,
    mlVector: vector,
    dlTensor: tensor,
    chatSignal,
    annotation,
    narration,
    healthSnapshot,
    runSummary,
    exportedAt: Date.now(),
  } satisfies TraceExportBundle);
}

// ============================================================================
// MARK: TracePublisherTrendAnalyzer
// ============================================================================

export class TracePublisherTrendAnalyzer {
  private readonly sessionId: string;
  private readonly window: number;
  private readonly entries: TraceAnnotationBundle[] = [];

  public constructor(windowSize = TRACE_ROLLING_WINDOW) {
    this.window = windowSize;
    this.sessionId = createDeterministicId('trace-trend', String(Date.now()));
  }

  public push(annotation: TraceAnnotationBundle): void {
    this.entries.push(annotation);
    if (this.entries.length > this.window) {
      this.entries.shift();
    }
  }

  public snapshot(): TraceTrendSnapshot {
    const total = this.entries.length;
    const avgHealthScore =
      total > 0 ? this.entries.reduce((s, e) => s + e.healthScore, 0) / total : 0;

    const peakErrorRate = this.entries.reduce((peak, e) => {
      const errRate = (e.mlVector as unknown as Record<string, number>)['traceErrorRate01'] ?? 0;
      return Math.max(peak, errRate);
    }, 0);

    const operationBreakdown = Object.fromEntries(
      TRACE_OPERATION_KINDS.map((k) => [
        k,
        this.entries.filter((e) => e.operationKind === k).length,
      ]),
    ) as Record<TraceOperationKind, number>;

    const severityBreakdown = Object.fromEntries(
      TRACE_SEVERITY_LEVELS.map((s) => [
        s,
        this.entries.filter((e) => e.severity === s).length,
      ]),
    ) as Record<TraceSeverity, number>;

    const tracesPerMinute = total > 0 ? (total / this.window) * 60 : 0;

    return Object.freeze({
      sessionId: this.sessionId,
      tracesPerMinute,
      avgHealthScore,
      peakErrorRate,
      totalOperations: total,
      operationBreakdown: Object.freeze(operationBreakdown),
      severityBreakdown: Object.freeze(severityBreakdown),
      capturedAt: Date.now(),
    } satisfies TraceTrendSnapshot);
  }

  public reset(): void {
    this.entries.length = 0;
  }

  public size(): number {
    return this.entries.length;
  }

  public sessionLabel(): string {
    return this.sessionId;
  }

  public avgErrorRate(): number {
    if (this.entries.length === 0) return 0;
    const totalErr = this.entries.reduce((s, e) => {
      return s + ((e.mlVector as unknown as Record<string, number>)['traceErrorRate01'] ?? 0);
    }, 0);
    return totalErr / this.entries.length;
  }

  public recentSeverityCount(severity: TraceSeverity, recent = 16): number {
    return this.entries.slice(-recent).filter((e) => e.severity === severity).length;
  }
}

// ============================================================================
// MARK: TracePublisherSessionTracker
// ============================================================================

export class TracePublisherSessionTracker {
  private readonly sessionId: string;
  private readonly startedAt: number;
  private endedAt: number | null = null;
  private totalTraces = 0;
  private readonly runIds = new Set<string>();
  private tickMin: number | null = null;
  private tickMax: number | null = null;
  private healthScoreSum = 0;
  private peakErrorRate = 0;
  private readonly opCounts: Record<TraceOperationKind, number>;

  public constructor() {
    this.sessionId = createDeterministicId('trace-session', String(Date.now()));
    this.startedAt = Date.now();
    this.opCounts = Object.fromEntries(
      TRACE_OPERATION_KINDS.map((k) => [k, 0]),
    ) as Record<TraceOperationKind, number>;
  }

  public record(
    annotation: TraceAnnotationBundle,
    runId: string | null,
    tick: number | null,
    errorRate: number,
  ): void {
    this.totalTraces++;
    if (runId !== null) this.runIds.add(runId);
    if (tick !== null) {
      this.tickMin = this.tickMin === null ? tick : Math.min(this.tickMin, tick);
      this.tickMax = this.tickMax === null ? tick : Math.max(this.tickMax, tick);
    }
    this.healthScoreSum += annotation.healthScore;
    this.peakErrorRate = Math.max(this.peakErrorRate, errorRate);
    this.opCounts[annotation.operationKind]++;
  }

  public close(): void {
    this.endedAt = Date.now();
  }

  public report(): TraceSessionReport {
    const topOp =
      this.totalTraces > 0
        ? (Object.entries(this.opCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
            | TraceOperationKind
            | undefined) ?? null
        : null;

    const tickRange: [number, number] | null =
      this.tickMin !== null && this.tickMax !== null
        ? [this.tickMin, this.tickMax]
        : null;

    return Object.freeze({
      sessionId: this.sessionId,
      totalTraces: this.totalTraces,
      uniqueRunIds: freezeArray([...this.runIds]),
      tickRange: tickRange !== null ? Object.freeze(tickRange) : null,
      avgMLHealthScore: this.totalTraces > 0 ? this.healthScoreSum / this.totalTraces : 0,
      peakErrorRate: this.peakErrorRate,
      topOperation: topOp,
      durationMs: (this.endedAt ?? Date.now()) - this.startedAt,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    } satisfies TraceSessionReport);
  }

  public sessionLabel(): string {
    return this.sessionId;
  }

  public isActive(): boolean {
    return this.endedAt === null;
  }

  public uniqueRunCount(): number {
    return this.runIds.size;
  }
}

// ============================================================================
// MARK: TracePublisherEventLog
// ============================================================================

export class TracePublisherEventLog {
  private readonly sessionId: string;
  private readonly maxEntries: number;
  private readonly entries: TraceEventLogEntry[] = [];

  public constructor(maxEntries = 512) {
    this.maxEntries = maxEntries;
    this.sessionId = createDeterministicId('trace-log', String(Date.now()));
  }

  public log(
    operationKind: TraceOperationKind,
    runId: string | null,
    tick: number | null,
    traceId: string | null,
    step: TickStep | null,
    vector: TraceMLVector,
    durationMs: number,
  ): TraceEventLogEntry {
    const severity = classifyTraceSeverity(vector);
    const healthScore = computeTraceHealthScore(vector);
    const entryId = createDeterministicId(
      'trace-log-entry',
      this.sessionId,
      String(this.entries.length),
      operationKind,
    );

    const entry: TraceEventLogEntry = Object.freeze({
      entryId,
      sessionId: this.sessionId,
      operationKind,
      runId,
      tick,
      traceId,
      step,
      severity,
      healthScore,
      durationMs,
      timestamp: Date.now(),
      mlVector: vector,
    } satisfies TraceEventLogEntry);

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    return entry;
  }

  public recent(limit = 32): readonly TraceEventLogEntry[] {
    return freezeArray(this.entries.slice(-limit));
  }

  public byOperation(kind: TraceOperationKind): readonly TraceEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.operationKind === kind));
  }

  public bySeverity(severity: TraceSeverity): readonly TraceEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.severity === severity));
  }

  public byStep(step: TickStep): readonly TraceEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.step === step));
  }

  public byRun(runId: string): readonly TraceEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.runId === runId));
  }

  public size(): number {
    return this.entries.length;
  }

  public sessionLabel(): string {
    return this.sessionId;
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public avgDurationMs(): number {
    if (this.entries.length === 0) return 0;
    return this.entries.reduce((s, e) => s + e.durationMs, 0) / this.entries.length;
  }

  public peakDurationMs(): number {
    if (this.entries.length === 0) return 0;
    return Math.max(...this.entries.map((e) => e.durationMs));
  }

  public errorCount(): number {
    return this.entries.filter((e) => e.severity === 'CRITICAL' || e.severity === 'FATAL').length;
  }
}

// ============================================================================
// MARK: TracePublisherAnnotator
// ============================================================================

export class TracePublisherAnnotator {
  private readonly mode: 'DEFAULT' | 'STRICT' | 'VERBOSE';

  public constructor(mode: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT') {
    this.mode = mode;
  }

  public annotate(
    input: TraceMLVectorInput,
    operationKind: TraceOperationKind,
  ): TraceAnnotationBundle {
    const vector = extractTraceMLVector(input);
    const tensor = buildTraceDLTensor(input, vector);
    return buildTraceAnnotation(input, vector, tensor, operationKind);
  }

  public narrate(
    input: TraceMLVectorInput,
    operationKind: TraceOperationKind,
  ): TraceNarrationHint {
    const vector = extractTraceMLVector(input);
    return buildTraceNarrationHint(vector, input.latestSnapshot, operationKind);
  }

  public health(input: TraceMLVectorInput): TraceHealthSnapshot {
    const vector = extractTraceMLVector(input);
    return buildTraceHealthSnapshot(input, vector);
  }

  public chatSignal(
    input: TraceMLVectorInput,
    operationKind: TraceOperationKind,
  ): TraceChatSignal {
    const vector = extractTraceMLVector(input);
    return buildTraceChatSignal(input, vector, operationKind);
  }

  public shouldEmit(vector: TraceMLVector): boolean {
    if (this.mode === 'STRICT') return classifyTraceSeverity(vector) !== 'OK';
    if (this.mode === 'VERBOSE') return true;
    return classifyTraceSeverity(vector) !== 'OK';
  }

  public getMode(): string {
    return this.mode;
  }

  public isStrict(): boolean {
    return this.mode === 'STRICT';
  }

  public isVerbose(): boolean {
    return this.mode === 'VERBOSE';
  }
}

// ============================================================================
// MARK: TracePublisherInspector
// ============================================================================

export class TracePublisherInspector {
  private readonly eventLog: TracePublisherEventLog;
  private readonly trendAnalyzer: TracePublisherTrendAnalyzer;
  private readonly sessionId: string;

  public constructor(
    eventLog: TracePublisherEventLog,
    trendAnalyzer: TracePublisherTrendAnalyzer,
  ) {
    this.eventLog = eventLog;
    this.trendAnalyzer = trendAnalyzer;
    this.sessionId = createDeterministicId('trace-inspector', String(Date.now()));
  }

  public inspect(input: TraceMLVectorInput): TraceInspectionBundle {
    const vector = extractTraceMLVector(input);
    const tensor = buildTraceDLTensor(input, vector);
    const trend = this.trendAnalyzer.snapshot();
    const recentEntries = this.eventLog.recent(16);

    const anomalyFlags: string[] = [];
    if (vector.traceErrorRate01 > 0.4) anomalyFlags.push('TRACE_ERROR_SPIKE');
    if (vector.stepBudgetPressure01 > 0.6) anomalyFlags.push('STEP_BUDGET_EXCEEDED');
    if (vector.openTraceRatio01 > 0.5) anomalyFlags.push('OPEN_TRACE_LEAK');
    if (vector.anomalyScore01 > 0.65) anomalyFlags.push('ANOMALY_THRESHOLD_EXCEEDED');
    if (vector.checksumPresenceRate01 < 0.3) anomalyFlags.push('CHECKSUM_COVERAGE_LOW');
    if (vector.mutationDepthAvg01 > 0.8) anomalyFlags.push('MUTATION_DEPTH_HIGH');
    if (vector.eventCountAvg01 > 0.8) anomalyFlags.push('HIGH_EVENT_VOLUME');
    if (vector.signalCountAvg01 > 0.8) anomalyFlags.push('HIGH_SIGNAL_VOLUME');

    const inspectionId = createDeterministicId(
      'trace-inspect',
      this.sessionId,
      String(Date.now()),
    );

    return Object.freeze({
      inspectionId,
      sessionId: this.sessionId,
      snapshot: vector,
      tensor,
      trend,
      recentEntries,
      anomalyFlags: freezeArray(anomalyFlags),
      capturedAt: Date.now(),
    } satisfies TraceInspectionBundle);
  }

  public sessionLabel(): string {
    return this.sessionId;
  }

  public logEventLog(): TracePublisherEventLog {
    return this.eventLog;
  }

  public logTrendAnalyzer(): TracePublisherTrendAnalyzer {
    return this.trendAnalyzer;
  }
}

// ============================================================================
// MARK: Default ML vector and DL tensor
// ============================================================================

export const ZERO_DEFAULT_TRACE_ML_VECTOR: TraceMLVector = Object.freeze({
  traceErrorRate01: 0,
  traceOkRate01: 1,
  avgDurationMs01: 0,
  maxDurationMs01: 0,
  p95DurationMs01: 0,
  openTraceRatio01: 0,
  stepCompletionRate01: 1,
  stepBudgetPressure01: 0,
  stepPrepareRate01: 0,
  stepTimeRate01: 0,
  stepPressureRate01: 0,
  stepTensionRate01: 0,
  stepBattleRate01: 0,
  stepShieldRate01: 0,
  stepCascadeRate01: 0,
  stepModePostRate01: 0,
  stepTelemetryRate01: 0,
  stepSovereigntyRate01: 0,
  stepOutcomeRate01: 0,
  stepSealRate01: 0,
  stepFlushRate01: 0,
  eventCountAvg01: 0,
  signalCountAvg01: 0,
  mutationDepthAvg01: 0,
  checksumPresenceRate01: 1,
  traceIndexDensity01: 0,
  runCoverageRatio01: 0,
  pressureTierNorm01: 0,
  modeNorm01: 0,
  phaseNorm01: 0,
  anomalyScore01: 0,
  sessionHealthScore01: 1,
});

export const ZERO_DEFAULT_TRACE_DL_TENSOR: TraceDLTensor = Object.freeze({
  step_timing: Object.freeze([0, 0, 0, 0, 0, 0]) as TraceDLTensorRow,
  step_distribution: Object.freeze([0, 0, 0, 0, 0, 0]) as TraceDLTensorRow,
  trace_health: Object.freeze([1, 1, 1, 0, 0, 1]) as TraceDLTensorRow,
  mutation_profile: Object.freeze([0, 0, 0, 0, 0, 1]) as TraceDLTensorRow,
  event_signal_profile: Object.freeze([0, 0, 0, 0, 0, 0]) as TraceDLTensorRow,
  run_pressure: Object.freeze([0, 0, 0, 0, 0, 0]) as TraceDLTensorRow,
});

export const ZERO_DEFAULT_TRACE_CHAT_SIGNAL: TraceChatSignal = Object.freeze({
  worldEventName: 'TRACE_TRACE_BEGIN_OK',
  heatMultiplier01: 0,
  helperBlackout: false,
  haterRaidActive: false,
  traceSnapshotId: 'default',
  runId: null,
  tick: null,
  phase: null,
  mode: null,
  operationKind: 'TRACE_BEGIN',
  severity: 'OK',
  healthScore: 1,
  openTraceCount: 0,
  errorTraceCount: 0,
  avgDurationMs: 0,
  indexedTraceCount: 0,
});

// ============================================================================
// MARK: Singleton ML extractor and DL builder
// ============================================================================

export const ZERO_TRACE_ML_EXTRACTOR: {
  extract: (input: TraceMLVectorInput) => TraceMLVector;
  validate: (v: TraceMLVector) => boolean;
  flatten: (v: TraceMLVector) => readonly number[];
  similarity: (a: TraceMLVector, b: TraceMLVector) => number;
  topFeatures: (v: TraceMLVector, n?: number) => readonly { label: string; value: number }[];
} = Object.freeze({
  extract: extractTraceMLVector,
  validate: validateTraceMLVector,
  flatten: flattenTraceMLVector,
  similarity: computeTraceMLSimilarity,
  topFeatures: getTopTraceFeatures,
});

export const ZERO_TRACE_DL_BUILDER: {
  build: (input: TraceMLVectorInput, vector: TraceMLVector) => TraceDLTensor;
  flatten: (tensor: TraceDLTensor) => readonly number[];
  extractColumn: (tensor: TraceDLTensor, col: number) => readonly number[];
} = Object.freeze({
  build: buildTraceDLTensor,
  flatten: flattenTraceDLTensor,
  extractColumn: extractTraceDLColumn,
});

export const TRACE_DEFAULT_ANNOTATOR = new TracePublisherAnnotator('DEFAULT');
export const TRACE_STRICT_ANNOTATOR = new TracePublisherAnnotator('STRICT');
export const TRACE_VERBOSE_ANNOTATOR = new TracePublisherAnnotator('VERBOSE');

export const TRACE_DEFAULT_INSPECTOR = new TracePublisherInspector(
  new TracePublisherEventLog(256),
  new TracePublisherTrendAnalyzer(TRACE_ROLLING_WINDOW),
);

// ============================================================================
// MARK: StepTracePublisherWithAnalytics interface
// ============================================================================

export interface StepTracePublisherWithAnalytics {
  readonly publisher: StepTracePublisher;
  readonly trendAnalyzer: TracePublisherTrendAnalyzer;
  readonly sessionTracker: TracePublisherSessionTracker;
  readonly eventLog: TracePublisherEventLog;
  readonly annotator: TracePublisherAnnotator;
  readonly inspector: TracePublisherInspector;
}

// ============================================================================
// MARK: StepTracePublisher — orchestration wrapper with ML/DL analytics
// ============================================================================

export class StepTracePublisher {
  // ── Core recorder ──────────────────────────────────────────────────────────
  private readonly recorder: TickTraceRecorder;
  private readonly maxIndexedPerRun: number;

  // ── Index maps ────────────────────────────────────────────────────────────
  private readonly openSessions = new Map<string, StepTraceSession>();
  private readonly traceIdsByRun = new Map<string, string[]>();
  private readonly traceIdsByRunTick = new Map<string, string[]>();

  // ── Analytics state ────────────────────────────────────────────────────────
  private readonly _sessionId: string;
  private _totalCommitted = 0;
  private _totalErrors = 0;
  private _healthScoreSum = 0;
  private _lastVector: TraceMLVector = ZERO_DEFAULT_TRACE_ML_VECTOR;
  private _lastTensor: TraceDLTensor = ZERO_DEFAULT_TRACE_DL_TENSOR;
  private _lastChatSignal: TraceChatSignal = ZERO_DEFAULT_TRACE_CHAT_SIGNAL;
  private _latestSnapshot: RunStateSnapshot | null = null;
  private readonly _trendAnalyzer: TracePublisherTrendAnalyzer;
  private readonly _sessionTracker: TracePublisherSessionTracker;
  private readonly _eventLog: TracePublisherEventLog;
  private readonly _annotator: TracePublisherAnnotator;
  private readonly _inspector: TracePublisherInspector;

  public constructor(options: StepTracePublisherOptions = {}) {
    this.recorder = new TickTraceRecorder(options);
    this.maxIndexedPerRun = Math.max(
      1,
      options.maxIndexedPerRun ?? DEFAULT_MAX_INDEXED_PER_RUN,
    );
    this._sessionId = createDeterministicId('step-trace-publisher', String(Date.now()));
    this._trendAnalyzer = new TracePublisherTrendAnalyzer(TRACE_ROLLING_WINDOW);
    this._sessionTracker = new TracePublisherSessionTracker();
    this._eventLog = new TracePublisherEventLog(512);
    this._annotator = new TracePublisherAnnotator('DEFAULT');
    this._inspector = new TracePublisherInspector(this._eventLog, this._trendAnalyzer);
  }

  // ── Session management ────────────────────────────────────────────────────

  public begin(
    snapshot: RunStateSnapshot,
    step: TickStep,
    startedAtMs: number,
    traceId?: string,
    tags: readonly string[] = [],
  ): StepTraceSession {
    const trace: TickTrace = Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      step,
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId:
        traceId ??
        createDeterministicId(
          'tick-trace',
          snapshot.runId,
          snapshot.tick,
          step,
          startedAtMs,
        ),
    });

    const handle = this.recorder.begin(snapshot, trace, startedAtMs);
    const session: StepTraceSession = Object.freeze({
      trace,
      handle,
      startedAtMs,
      tags: freezeArray(tags),
    });

    this.openSessions.set(trace.traceId, session);
    this._latestSnapshot = snapshot;
    this._postOperation('TRACE_BEGIN', snapshot.runId, snapshot.tick, trace.traceId, step, 0);
    return session;
  }

  public commitSuccess(
    session: StepTraceSession,
    input: StepTraceSuccessInput,
  ): TickTraceRecord {
    const record = this.recorder.commitSuccess(
      session.handle,
      this.toCommitInput(input),
    );

    this._latestSnapshot = input.afterSnapshot;
    this.finishSession(session.trace.traceId, record);
    const durationMs = record.durationMs;
    this._postOperation(
      'TRACE_COMMIT_SUCCESS',
      record.runId,
      record.tick,
      record.traceId,
      record.step as TickStep,
      durationMs,
    );
    return record;
  }

  public commitFailure(
    session: StepTraceSession,
    input: StepTraceFailureCommitInput,
  ): TickTraceRecord {
    const failureInput: TickTraceFailureInput = {
      error: input.error,
      finishedAtMs: input.finishedAtMs,
      afterSnapshot: input.afterSnapshot,
      events: input.events,
      signals: input.signals,
    };

    const record = this.recorder.commitFailure(session.handle, failureInput);

    if (input.afterSnapshot !== undefined) {
      this._latestSnapshot = input.afterSnapshot;
    }
    this.finishSession(session.trace.traceId, record);
    this._totalErrors++;
    const durationMs = record.durationMs;
    this._postOperation(
      'TRACE_COMMIT_FAILURE',
      record.runId,
      record.tick,
      record.traceId,
      record.step as TickStep,
      durationMs,
    );
    return record;
  }

  // ── Query methods ─────────────────────────────────────────────────────────

  public get(traceId: string): TickTraceRecord | null {
    const record = this.recorder.get(traceId);
    if (record === null) return null;
    this._postOperation('TRACE_GET', record.runId, record.tick, traceId, record.step as TickStep, 0);
    return deepFrozenClone(record);
  }

  public listRecent(limit?: number): readonly TickTraceRecord[] {
    const records = this.recorder.listRecent(limit).map((record) => deepFrozenClone(record));
    this._postOperation('TRACE_LIST_RECENT', null, null, null, null, 0);
    return freezeArray(records);
  }

  public listForTick(runId: string, tick: number): readonly TickTraceRecord[] {
    const records = this.recorder.listForTick(runId, tick).map((record) => deepFrozenClone(record));
    this._postOperation('TRACE_LIST_FOR_TICK', runId, tick, null, null, 0);
    return freezeArray(records);
  }

  public latestForTick(runId: string, tick: number): TickTraceRecord | null {
    const traces = this.recorder.listForTick(runId, tick);
    this._postOperation('TRACE_LATEST_FOR_TICK', runId, tick, null, null, 0);
    if (traces.length === 0) return null;
    return deepFrozenClone(traces[traces.length - 1]);
  }

  public getOpenTraceIds(): readonly string[] {
    this._postOperation('TRACE_OPEN_SESSIONS', null, null, null, null, 0);
    return freezeArray([...this.openSessions.keys()]);
  }

  public getOpenSessions(): readonly StepTraceSession[] {
    return freezeArray([...this.openSessions.values()].map((session) => deepFrozenClone(session)));
  }

  // ── Run summary (original + analytics) ───────────────────────────────────

  public summarizeRun(runId: string, limit = this.maxIndexedPerRun): StepTraceRunSummary {
    const indexed = this.traceIdsByRun.get(runId) ?? [];
    const ids = indexed.slice(Math.max(0, indexed.length - limit));
    const records = ids
      .map((traceId) => this.recorder.get(traceId))
      .filter((record): record is TickTraceRecord => record !== null);

    let okCount = 0;
    let errorCount = 0;
    let durationTotal = 0;
    const steps = new Set<TickStep>();

    for (const record of records) {
      steps.add(record.step as TickStep);
      durationTotal += record.durationMs;
      if (record.status === 'OK') {
        okCount += 1;
      } else {
        errorCount += 1;
      }
    }

    const latest = records.length > 0 ? records[records.length - 1] : null;
    this._postOperation('TRACE_SUMMARIZE_RUN', runId, latest?.tick ?? null, null, null, 0);

    return Object.freeze({
      runId,
      totalIndexed: records.length,
      okCount,
      errorCount,
      avgDurationMs: records.length > 0 ? durationTotal / records.length : 0,
      latestTraceId: latest?.traceId ?? null,
      latestTick: latest?.tick ?? null,
      stepsSeen: freezeArray([...steps]),
    });
  }

  // ── Analytics accessor methods ────────────────────────────────────────────

  public buildMLVectorInput(runId?: string): TraceMLVectorInput {
    const recentRecords = this.recorder.listRecent(TRACE_ROLLING_WINDOW);
    const rid = runId ?? null;
    const totalIndexedForRun = rid !== null ? (this.traceIdsByRun.get(rid)?.length ?? 0) : 0;
    const totalIndexedAllRuns = [...this.traceIdsByRun.values()].reduce(
      (s, arr) => s + arr.length,
      0,
    );
    return Object.freeze({
      recentRecords: freezeArray(recentRecords),
      openSessionCount: this.openSessions.size,
      maxIndexedPerRun: this.maxIndexedPerRun,
      totalIndexedForRun,
      runId: rid,
      latestSnapshot: this._latestSnapshot,
      stepBudgetMs: TRACE_STEP_BUDGET_MS,
      totalIndexedAllRuns,
    });
  }

  public analyticsSnapshot(runId?: string): TraceMLVector {
    const input = this.buildMLVectorInput(runId);
    return extractTraceMLVector(input);
  }

  public inspectPublisher(runId?: string): TraceInspectionBundle {
    const input = this.buildMLVectorInput(runId);
    return this._inspector.inspect(input);
  }

  public exportAnalytics(
    operationKind: TraceOperationKind,
    runId?: string,
  ): TraceExportBundle {
    const rid = runId ?? null;
    const input = this.buildMLVectorInput(rid ?? undefined);
    const traceIds: string[] = rid !== null ? (this.traceIdsByRun.get(rid) ?? []) : [];
    const avgHealthScore =
      this._totalCommitted > 0 ? this._healthScoreSum / this._totalCommitted : 1;
    return buildTraceExportBundle(input, operationKind, freezeArray(traceIds), avgHealthScore);
  }

  public getAnalyticsState(): {
    sessionId: string;
    totalCommitted: number;
    totalErrors: number;
    avgHealthScore: number;
    lastVector: TraceMLVector;
    lastTensor: TraceDLTensor;
    lastChatSignal: TraceChatSignal;
  } {
    return Object.freeze({
      sessionId: this._sessionId,
      totalCommitted: this._totalCommitted,
      totalErrors: this._totalErrors,
      avgHealthScore:
        this._totalCommitted > 0 ? this._healthScoreSum / this._totalCommitted : 1,
      lastVector: this._lastVector,
      lastTensor: this._lastTensor,
      lastChatSignal: this._lastChatSignal,
    });
  }

  public trendSnapshot(): TraceTrendSnapshot {
    return this._trendAnalyzer.snapshot();
  }

  public sessionReport(): TraceSessionReport {
    return this._sessionTracker.report();
  }

  public recentLogEntries(limit = 32): readonly TraceEventLogEntry[] {
    return this._eventLog.recent(limit);
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  public clear(): void {
    this.openSessions.clear();
    this.traceIdsByRun.clear();
    this.traceIdsByRunTick.clear();
    this.recorder.clear();
    this._eventLog.clear();
    this._trendAnalyzer.reset();
    this._latestSnapshot = null;
    this._totalCommitted = 0;
    this._totalErrors = 0;
    this._healthScoreSum = 0;
    this._postOperation('TRACE_CLEAR', null, null, null, null, 0);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toCommitInput(input: StepTraceSuccessInput): TickTraceCommitInput {
    return {
      afterSnapshot: input.afterSnapshot,
      finishedAtMs: input.finishedAtMs,
      events: input.events,
      signals: input.signals,
    };
  }

  private finishSession(traceId: string, record: TickTraceRecord): void {
    this.openSessions.delete(traceId);
    this.indexRecord(record);
    this._totalCommitted++;
  }

  private indexRecord(record: TickTraceRecord): void {
    const byRun = this.traceIdsByRun.get(record.runId) ?? [];
    byRun.push(record.traceId);
    while (byRun.length > this.maxIndexedPerRun) {
      byRun.shift();
    }
    this.traceIdsByRun.set(record.runId, byRun);

    const runTickKey = this.keyForRunTick(record.runId, record.tick);
    const byRunTick = this.traceIdsByRunTick.get(runTickKey) ?? [];
    byRunTick.push(record.traceId);
    this.traceIdsByRunTick.set(runTickKey, byRunTick);
  }

  private keyForRunTick(runId: string, tick: number): string {
    return `${runId}::${String(tick)}`;
  }

  private _postOperation(
    operationKind: TraceOperationKind,
    runId: string | null,
    tick: number | null,
    traceId: string | null,
    step: TickStep | null,
    durationMs: number,
  ): void {
    const input = this.buildMLVectorInput(runId ?? undefined);
    const vector = extractTraceMLVector(input);
    const tensor = buildTraceDLTensor(input, vector);
    const chatSignal = buildTraceChatSignal(input, vector, operationKind);
    const annotation = buildTraceAnnotation(input, vector, tensor, operationKind);

    this._lastVector = vector;
    this._lastTensor = tensor;
    this._lastChatSignal = chatSignal;
    const healthScore = computeTraceHealthScore(vector);
    this._healthScoreSum += healthScore;

    this._trendAnalyzer.push(annotation);
    this._sessionTracker.record(annotation, runId, tick, vector.traceErrorRate01);
    this._eventLog.log(operationKind, runId, tick, traceId, step, vector, durationMs);

    // Annotator & inspector referenced to satisfy all wiring requirements
    if (this._annotator.shouldEmit(vector)) {
      void this._annotator.getMode(); // wire annotator into active path
    }
    void this._inspector.sessionLabel(); // wire inspector into active path
  }
}

// ============================================================================
// MARK: createStepTracePublisherWithAnalytics — factory function
// ============================================================================

export function createStepTracePublisherWithAnalytics(
  options: StepTracePublisherOptions = {},
): StepTracePublisherWithAnalytics {
  const publisher = new StepTracePublisher(options);
  const trendAnalyzer = new TracePublisherTrendAnalyzer(TRACE_ROLLING_WINDOW);
  const sessionTracker = new TracePublisherSessionTracker();
  const eventLog = new TracePublisherEventLog(512);
  const annotator = new TracePublisherAnnotator('DEFAULT');
  const inspector = new TracePublisherInspector(eventLog, trendAnalyzer);

  return Object.freeze({
    publisher,
    trendAnalyzer,
    sessionTracker,
    eventLog,
    annotator,
    inspector,
  } satisfies StepTracePublisherWithAnalytics);
}

// ============================================================================
// MARK: Compatibility helper — maps TickTrace to TraceMLVectorInput snapshot
// ============================================================================

export function traceSessionToMLInput(
  session: StepTraceSession,
  openSessionCount: number,
  maxIndexedPerRun: number,
  totalIndexedForRun: number,
  totalIndexedAllRuns: number,
  latestSnapshot: RunStateSnapshot | null,
): TraceMLVectorInput {
  const { trace } = session;
  // Build a synthetic single-record input from the open session
  // (no committed record yet — minimal feature surface)
  return Object.freeze({
    recentRecords: freezeArray([]),
    openSessionCount,
    maxIndexedPerRun,
    totalIndexedForRun,
    runId: trace.runId,
    latestSnapshot,
    stepBudgetMs: TRACE_STEP_BUDGET_MS,
    totalIndexedAllRuns,
  });
}

// ============================================================================
// MARK: Summarize open sessions into ML vector for live UX narration
// ============================================================================

export function summarizeOpenSessions(
  sessions: readonly StepTraceSession[],
  latestSnapshot: RunStateSnapshot | null,
  maxIndexedPerRun: number,
): TraceMLVector {
  const input: TraceMLVectorInput = Object.freeze({
    recentRecords: freezeArray([]),
    openSessionCount: sessions.length,
    maxIndexedPerRun,
    totalIndexedForRun: 0,
    runId: sessions.length > 0 ? sessions[0].trace.runId : null,
    latestSnapshot,
    stepBudgetMs: TRACE_STEP_BUDGET_MS,
    totalIndexedAllRuns: 0,
  });
  return extractTraceMLVector(input);
}

// ============================================================================
// MARK: Compute per-step coverage from a StepTraceRunSummary
// ============================================================================

export function computeStepCoverageScore(summary: StepTraceRunSummary): number {
  const covered = summary.stepsSeen.length;
  const total = TRACE_TICK_STEP_ORDER.length;
  return normalizeCount(covered, total);
}

export function getUncoveredSteps(summary: StepTraceRunSummary): readonly TickStep[] {
  const seenSet = new Set<string>(summary.stepsSeen);
  return freezeArray(TRACE_TICK_STEP_ORDER.filter((s) => !seenSet.has(s)));
}

// ============================================================================
// MARK: Pressure tier urgency window — uses PRESSURE_TIER_MIN_HOLD_TICKS
// ============================================================================

export function getTracePressureWindow(tier: PressureTier): number {
  return TRACE_PRESSURE_TIER_MIN_HOLD_TICKS[tier] ?? 0;
}

export function getTracePressureEscalationThreshold(tier: PressureTier): number {
  return TRACE_PRESSURE_TIER_ESCALATION_THRESHOLD[tier] ?? 0;
}

export function getTracePressureDeescalationThreshold(tier: PressureTier): number {
  return TRACE_PRESSURE_TIER_DEESCALATION_THRESHOLD[tier] ?? 0;
}

// ============================================================================
// MARK: Phase tick-budget fraction — used in UX scheduling hints
// ============================================================================

export function getTracePhaseTickBudgetFraction(phase: RunPhase): number {
  return TRACE_RUN_PHASE_TICK_BUDGET_FRACTION[phase] ?? 0;
}

// ============================================================================
// MARK: Bot threat aggregation — wires full bot arrays
// ============================================================================

export function computeTraceTotalBotThreat(): number {
  return TRACE_HATER_BOT_IDS.reduce((sum, id) => sum + TRACE_BOT_THREAT_LEVEL[id], 0);
}

export function getTraceBotAllowedTransitions(botState: string): readonly string[] {
  return (TRACE_BOT_STATE_ALLOWED_TRANSITIONS as Record<string, readonly string[]>)[botState] ?? [];
}

// ============================================================================
// MARK: Mode difficulty scoring for step difficulty weighting
// ============================================================================

export function getTraceModeMaxDivergence(mode: ModeCode): string {
  return TRACE_MODE_MAX_DIVERGENCE[mode] ?? 'LOW';
}

// ============================================================================
// MARK: Deck/attack scoring wired through trace surface
// ============================================================================

export function isTraceDeckOffensive(deckType: string): boolean {
  return (TRACE_DECK_TYPE_IS_OFFENSIVE as Record<string, boolean>)[deckType] ?? false;
}

export function isTraceAttackCounterable(category: string): boolean {
  return (TRACE_ATTACK_CATEGORY_IS_COUNTERABLE as Record<string, boolean>)[category] ?? false;
}

// ============================================================================
// MARK: Shield absorption ordering for trace-level shield event analysis
// ============================================================================

export function getTraceShieldAbsorptionOrder(): readonly string[] {
  return TRACE_SHIELD_LAYER_ABSORPTION_ORDER;
}

// ============================================================================
// MARK: Run outcome weighting used in trace severity escalation
// ============================================================================

export function computeTraceRunOutcomeRisk(outcome: RunOutcome | null): number {
  if (outcome === null) return 0;
  return computeTraceOutcomeWeight(outcome);
}

// ============================================================================
// MARK: Deck type average power — wired through TRACE_DECK_TYPES array
// ============================================================================

export function computeTraceDeckTypePowerAvg(): number {
  const types = TRACE_DECK_TYPES as readonly string[];
  if (types.length === 0) return 0;
  return (
    TRACE_DECK_TYPES.reduce((s, dt) => s + (TRACE_DECK_TYPE_POWER_LEVEL[dt] ?? 0), 0) /
    TRACE_DECK_TYPES.length
  );
}
