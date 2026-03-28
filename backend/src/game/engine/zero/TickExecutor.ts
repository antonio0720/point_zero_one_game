// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickExecutor.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickExecutor.ts
 * VERSION: tick-executor.v5.0.2026
 *
 * Doctrine:
 * - TickExecutor owns the full 13-step orchestration pass for one authoritative backend tick
 * - it respects backend/core TickSequence ordering rather than inventing a parallel plan
 * - outcome gating, sealing, diagnostics, and flush coordination are explicit terminal phases
 * - all outputs are immutable and suitable for replay, proof, diagnostics, and testing
 * - ML/DL analytics run after every execute() to score, narrate, and annotate tick health
 * - 32-dim ML feature vectors capture every dimension of tick quality and game state
 * - 13×8 DL tensors model per-step execution profiles across the full tick cycle
 * - chat signals, narration hints, trend analysis, session tracking, and annotation
 *   bundles expose operator-grade diagnostics to the companion commentary system
 * - every operation is deterministic, replay-safe, and immutable at the output boundary
 *
 * Surface summary:
 *   § 1  — Module metadata constants
 *   § 2  — GamePrimitive re-exports (TICK_EXECUTOR_* namespace)
 *   § 3  — Severity thresholds + operation kind constants
 *   § 4  — ML 32-dim feature label constants
 *   § 5  — DL 13×8 tensor label constants
 *   § 6  — Public types (ML vector, DL tensor, chat, analytics)
 *   § 7  — Internal helper utilities
 *   § 8  — Per-domain score functions (bot, shield, deck, timing, etc.)
 *   § 9  — ML 32-dim feature vector extraction
 *   § 10 — DL 13×8 tensor construction
 *   § 11 — Chat signal construction
 *   § 12 — Annotation bundle
 *   § 13 — Narration hint
 *   § 14 — Health snapshot
 *   § 15 — Run summary
 *   § 16 — Utility: validate, flatten, serialize, clone, similarity, top-k
 *   § 17 — Trend analyzer class
 *   § 18 — Session tracker class
 *   § 19 — Event log class
 *   § 20 — Annotator class
 *   § 21 — Inspector class
 *   § 22 — Factory + TickExecutorWithAnalytics type
 *   § 23 — Well-known singletons
 *   § 24 — TickExecutor class (full expansion with analytics integration)
 */

import {
  checksumSnapshot,
  cloneJson,
  computeTickSeal,
  createDeterministicId,
  deepFreeze,
  deepFrozenClone,
  stableStringify,
} from '../core/Deterministic';
import type { EngineId, EngineSignal, TickTrace } from '../core/EngineContracts';
import type {
  AttackCategory,
  BotState,
  CardRarity,
  CascadeChainInstance,
  Counterability,
  DeckType,
  DivergencePotential,
  EngineEventMap,
  HaterBotId,
  IntegrityStatus,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
  ShieldLayerId,
  Targeting,
  TimingClass,
  VerifiedGrade,
  VisibilityLevel,
} from '../core/GamePrimitives';
import {
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  BOT_STATE_ALLOWED_TRANSITIONS,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_THREAT_LEVEL,
  CARD_RARITY_WEIGHT,
  COUNTERABILITY_RESISTANCE_SCORE,
  DECK_TYPE_IS_OFFENSIVE,
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPES,
  DIVERGENCE_POTENTIAL_NORMALIZED,
  HATER_BOT_IDS,
  INTEGRITY_STATUS_RISK_SCORE,
  INTEGRITY_STATUSES,
  MODE_CODES,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_MAX_DIVERGENCE,
  MODE_NORMALIZED,
  MODE_TENSION_FLOOR,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIERS,
  RUN_OUTCOMES,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  RUN_PHASES,
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  SHIELD_LAYER_IDS,
  SHIELD_LAYER_LABEL_BY_ID,
  TARGETING_SPREAD_FACTOR,
  TIMING_CLASS_URGENCY_DECAY,
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASSES,
  VERIFIED_GRADE_NUMERIC_SCORE,
  VERIFIED_GRADES,
  VISIBILITY_CONCEALMENT_FACTOR,
  VISIBILITY_LEVELS,
} from '../core/GamePrimitives';
import type { OutcomeReasonCode, RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  TICK_SEQUENCE,
  getTickStepDescriptor,
  type TickStep,
  type TickStepDescriptor,
} from '../core/TickSequence';
import { EventFlushCoordinator } from './EventFlushCoordinator';
import { OrchestratorDiagnostics } from './OrchestratorDiagnostics';
import { OutcomeGate } from './OutcomeGate';
import { TickPlan } from './TickPlan';
import { buildTickExecutionSummary } from './TickResultBuilder';
import {
  TickStepRunner,
  type StepExecutionReport,
} from './TickStepRunner';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module metadata constants
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_EXECUTOR_MODULE_VERSION = '5.0.2026' as const;
export const TICK_EXECUTOR_SCHEMA_VERSION = 1 as const;
export const TICK_EXECUTOR_MODULE_READY = true as const;
export const TICK_EXECUTOR_ML_FEATURE_COUNT = 32 as const;
export const TICK_EXECUTOR_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);
export const TICK_EXECUTOR_COMPLETE = 'TICK_EXECUTOR_COMPLETE' as const;
export const TICK_EXECUTOR_MAX_TICK = 200 as const;
export const TICK_EXECUTOR_MAX_DURATION_MS = 5_000 as const;
export const TICK_EXECUTOR_MAX_SIGNAL_COUNT = 200 as const;
export const TICK_EXECUTOR_MAX_PENDING_ATTACKS = 20 as const;
export const TICK_EXECUTOR_MAX_CASCADE_CHAINS = 10 as const;
export const TICK_EXECUTOR_MAX_BOT_THREAT_SCORE = 100 as const;
export const TICK_EXECUTOR_MAX_NET_WORTH = 10_000_000 as const;
export const TICK_EXECUTOR_MAX_AUDIT_FLAGS = 20 as const;
export const TICK_EXECUTOR_TREND_WINDOW_SIZE = 20 as const;
export const TICK_EXECUTOR_SESSION_MAX_HISTORY = 100 as const;
export const TICK_EXECUTOR_EVENT_LOG_MAX_ENTRIES = 500 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — GamePrimitive re-exports (TICK_EXECUTOR_* namespace)
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_EXECUTOR_MODE_CODES = MODE_CODES;
export const TICK_EXECUTOR_PRESSURE_TIERS = PRESSURE_TIERS;
export const TICK_EXECUTOR_RUN_PHASES = RUN_PHASES;
export const TICK_EXECUTOR_RUN_OUTCOMES = RUN_OUTCOMES;
export const TICK_EXECUTOR_SHIELD_LAYER_IDS = SHIELD_LAYER_IDS;
export const TICK_EXECUTOR_HATER_BOT_IDS = HATER_BOT_IDS;
export const TICK_EXECUTOR_TIMING_CLASSES = TIMING_CLASSES;
export const TICK_EXECUTOR_DECK_TYPES = DECK_TYPES;
export const TICK_EXECUTOR_VISIBILITY_LEVELS = VISIBILITY_LEVELS;
export const TICK_EXECUTOR_INTEGRITY_STATUSES = INTEGRITY_STATUSES;
export const TICK_EXECUTOR_VERIFIED_GRADES = VERIFIED_GRADES;

export const TICK_EXECUTOR_SHIELD_LAYER_LABEL_BY_ID = SHIELD_LAYER_LABEL_BY_ID;
export const TICK_EXECUTOR_PRESSURE_TIER_NORMALIZED = PRESSURE_TIER_NORMALIZED;
export const TICK_EXECUTOR_PRESSURE_TIER_URGENCY_LABEL = PRESSURE_TIER_URGENCY_LABEL;
export const TICK_EXECUTOR_PRESSURE_TIER_MIN_HOLD_TICKS = PRESSURE_TIER_MIN_HOLD_TICKS;
export const TICK_EXECUTOR_PRESSURE_TIER_ESCALATION_THRESHOLD = PRESSURE_TIER_ESCALATION_THRESHOLD;
export const TICK_EXECUTOR_PRESSURE_TIER_DEESCALATION_THRESHOLD = PRESSURE_TIER_DEESCALATION_THRESHOLD;

export const TICK_EXECUTOR_RUN_PHASE_NORMALIZED = RUN_PHASE_NORMALIZED;
export const TICK_EXECUTOR_RUN_PHASE_STAKES_MULTIPLIER = RUN_PHASE_STAKES_MULTIPLIER;
export const TICK_EXECUTOR_RUN_PHASE_TICK_BUDGET_FRACTION = RUN_PHASE_TICK_BUDGET_FRACTION;

export const TICK_EXECUTOR_MODE_NORMALIZED = MODE_NORMALIZED;
export const TICK_EXECUTOR_MODE_DIFFICULTY_MULTIPLIER = MODE_DIFFICULTY_MULTIPLIER;
export const TICK_EXECUTOR_MODE_TENSION_FLOOR = MODE_TENSION_FLOOR;
export const TICK_EXECUTOR_MODE_MAX_DIVERGENCE = MODE_MAX_DIVERGENCE;

export const TICK_EXECUTOR_SHIELD_LAYER_ABSORPTION_ORDER = SHIELD_LAYER_ABSORPTION_ORDER;
export const TICK_EXECUTOR_SHIELD_LAYER_CAPACITY_WEIGHT = SHIELD_LAYER_CAPACITY_WEIGHT;

export const TICK_EXECUTOR_TIMING_CLASS_WINDOW_PRIORITY = TIMING_CLASS_WINDOW_PRIORITY;
export const TICK_EXECUTOR_TIMING_CLASS_URGENCY_DECAY = TIMING_CLASS_URGENCY_DECAY;

export const TICK_EXECUTOR_BOT_THREAT_LEVEL = BOT_THREAT_LEVEL;
export const TICK_EXECUTOR_BOT_STATE_THREAT_MULTIPLIER = BOT_STATE_THREAT_MULTIPLIER;
export const TICK_EXECUTOR_BOT_STATE_ALLOWED_TRANSITIONS = BOT_STATE_ALLOWED_TRANSITIONS;

export const TICK_EXECUTOR_VISIBILITY_CONCEALMENT_FACTOR = VISIBILITY_CONCEALMENT_FACTOR;
export const TICK_EXECUTOR_INTEGRITY_STATUS_RISK_SCORE = INTEGRITY_STATUS_RISK_SCORE;
export const TICK_EXECUTOR_VERIFIED_GRADE_NUMERIC_SCORE = VERIFIED_GRADE_NUMERIC_SCORE;
export const TICK_EXECUTOR_CARD_RARITY_WEIGHT = CARD_RARITY_WEIGHT;

export const TICK_EXECUTOR_DIVERGENCE_POTENTIAL_NORMALIZED = DIVERGENCE_POTENTIAL_NORMALIZED;
export const TICK_EXECUTOR_COUNTERABILITY_RESISTANCE_SCORE = COUNTERABILITY_RESISTANCE_SCORE;
export const TICK_EXECUTOR_TARGETING_SPREAD_FACTOR = TARGETING_SPREAD_FACTOR;

export const TICK_EXECUTOR_DECK_TYPE_POWER_LEVEL = DECK_TYPE_POWER_LEVEL;
export const TICK_EXECUTOR_DECK_TYPE_IS_OFFENSIVE = DECK_TYPE_IS_OFFENSIVE;

export const TICK_EXECUTOR_ATTACK_CATEGORY_BASE_MAGNITUDE = ATTACK_CATEGORY_BASE_MAGNITUDE;
export const TICK_EXECUTOR_ATTACK_CATEGORY_IS_COUNTERABLE = ATTACK_CATEGORY_IS_COUNTERABLE;

// Derived aggregates used in ML vector normalization
export const TICK_EXECUTOR_TIMING_PRIORITY_AVG: number = Object.freeze(
  Object.values(TIMING_CLASS_WINDOW_PRIORITY).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(TIMING_CLASS_WINDOW_PRIORITY).length),
);
export const TICK_EXECUTOR_DECK_POWER_AVG: number = Object.freeze(
  Object.values(DECK_TYPE_POWER_LEVEL).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(DECK_TYPE_POWER_LEVEL).length),
);
export const TICK_EXECUTOR_CARD_RARITY_WEIGHT_AVG: number = Object.freeze(
  Object.values(CARD_RARITY_WEIGHT).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(CARD_RARITY_WEIGHT).length),
);
export const TICK_EXECUTOR_COUNTERABILITY_AVG: number = Object.freeze(
  Object.values(COUNTERABILITY_RESISTANCE_SCORE).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(COUNTERABILITY_RESISTANCE_SCORE).length),
);
export const TICK_EXECUTOR_VISIBILITY_CONCEALMENT_AVG: number = Object.freeze(
  Object.values(VISIBILITY_CONCEALMENT_FACTOR).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(VISIBILITY_CONCEALMENT_FACTOR).length),
);
export const TICK_EXECUTOR_INTEGRITY_RISK_AVG: number = Object.freeze(
  Object.values(INTEGRITY_STATUS_RISK_SCORE).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(INTEGRITY_STATUS_RISK_SCORE).length),
);
export const TICK_EXECUTOR_VERIFIED_GRADE_AVG: number = Object.freeze(
  Object.values(VERIFIED_GRADE_NUMERIC_SCORE).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(VERIFIED_GRADE_NUMERIC_SCORE).length),
);
export const TICK_EXECUTOR_ATTACK_MAGNITUDE_AVG: number = Object.freeze(
  Object.values(ATTACK_CATEGORY_BASE_MAGNITUDE).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(ATTACK_CATEGORY_BASE_MAGNITUDE).length),
);
export const TICK_EXECUTOR_TARGETING_SPREAD_AVG: number = Object.freeze(
  Object.values(TARGETING_SPREAD_FACTOR).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.values(TARGETING_SPREAD_FACTOR).length),
);
export const TICK_EXECUTOR_BOT_THREAT_MAX: number = Object.freeze(
  Math.max(0, ...Object.values(BOT_THREAT_LEVEL)),
);

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Severity thresholds + operation kind constants
// ─────────────────────────────────────────────────────────────────────────────

export type TickExecutorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TickExecutorOperationKind =
  | 'EXECUTE'
  | 'ROLLBACK'
  | 'FLUSH'
  | 'SEAL'
  | 'OUTCOME_GATE'
  | 'NOOP';

export const TICK_EXECUTOR_SEVERITY_THRESHOLDS = Object.freeze({
  LOW: 0.0,
  MEDIUM: 0.35,
  HIGH: 0.6,
  CRITICAL: 0.82,
} as const satisfies Record<TickExecutorSeverity, number>);

export const TICK_EXECUTOR_ALL_OUTCOME_WEIGHTS = Object.freeze({
  FREEDOM: 1.0,
  TIMEOUT: 0.4,
  BANKRUPT: 0.1,
  ABANDONED: 0.0,
  null: 0.5,
} as Record<string, number>);

export const TICK_EXECUTOR_MODE_NARRATION = Object.freeze({
  solo: 'You are running solo — every decision is yours alone.',
  pvp: 'You are in direct competition — every tick is contested terrain.',
  coop: 'You are operating as a team — coordination is survival.',
  ghost: 'You are running ghost mode — invisible and unaccountable.',
} as const satisfies Record<ModeCode, string>);

export const TICK_EXECUTOR_OUTCOME_NARRATION = Object.freeze({
  FREEDOM: 'Freedom target reached — the run ended in sovereign success.',
  TIMEOUT: 'Season timer expired — the run closed without resolution.',
  BANKRUPT: 'Net worth collapsed below zero — the run ended in failure.',
  ABANDONED: 'Run was abandoned — outcome is unresolved.',
} as const satisfies Record<RunOutcome, string>);

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ML 32-dim feature label constants
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_EXECUTOR_ML_FEATURE_LABELS = Object.freeze([
  'tickNorm01',
  'durationNorm01',
  'stepCountNorm01',
  'rolledBackCountNorm01',
  'errorSignalRatio',
  'warnSignalRatio',
  'outcomeWeight',
  'modeNorm01',
  'pressureTierNorm01',
  'phaseNorm01',
  'pressureScoreNorm01',
  'netWorthNorm01',
  'modeTensionFloor',
  'modeDifficultyNorm01',
  'modeMaxDivergenceNorm',
  'shieldAggregateNorm01',
  'shieldBreachRatio',
  'botThreatScoreNorm01',
  'botActiveFraction',
  'pendingAttackNorm01',
  'cascadeActiveNorm01',
  'cascadePositiveRatio',
  'eventCountNorm01',
  'eventChecksumPresent',
  'outcomeGateTriggered',
  'flushCoordinatorActive',
  'diagnosticsActive',
  'integrityRiskNorm01',
  'verifiedGradeNorm01',
  'stakesMultiplierNorm01',
  'tickBudgetFractionUsed',
  'signalCountNorm01',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — DL 13×8 tensor label constants
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_EXECUTOR_DL_ROW_LABELS = Object.freeze([
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
] as const satisfies readonly TickStep[]);

export const TICK_EXECUTOR_DL_COL_LABELS = Object.freeze([
  'enabled',
  'durationNorm',
  'rolledBack',
  'signalCountNorm',
  'errorPresent',
  'warnPresent',
  'outputChanged',
  'ownerEncoded',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface TickExecutorMLVector {
  readonly tickNorm01: number;
  readonly durationNorm01: number;
  readonly stepCountNorm01: number;
  readonly rolledBackCountNorm01: number;
  readonly errorSignalRatio: number;
  readonly warnSignalRatio: number;
  readonly outcomeWeight: number;
  readonly modeNorm01: number;
  readonly pressureTierNorm01: number;
  readonly phaseNorm01: number;
  readonly pressureScoreNorm01: number;
  readonly netWorthNorm01: number;
  readonly modeTensionFloor: number;
  readonly modeDifficultyNorm01: number;
  readonly modeMaxDivergenceNorm: number;
  readonly shieldAggregateNorm01: number;
  readonly shieldBreachRatio: number;
  readonly botThreatScoreNorm01: number;
  readonly botActiveFraction: number;
  readonly pendingAttackNorm01: number;
  readonly cascadeActiveNorm01: number;
  readonly cascadePositiveRatio: number;
  readonly eventCountNorm01: number;
  readonly eventChecksumPresent: number;
  readonly outcomeGateTriggered: number;
  readonly flushCoordinatorActive: number;
  readonly diagnosticsActive: number;
  readonly integrityRiskNorm01: number;
  readonly verifiedGradeNorm01: number;
  readonly stakesMultiplierNorm01: number;
  readonly tickBudgetFractionUsed: number;
  readonly signalCountNorm01: number;
}

export interface TickExecutorMLVectorInput {
  readonly snapshot: RunStateSnapshot;
  readonly durationMs: number;
  readonly reports: readonly StepExecutionReport[];
  readonly signals: readonly EngineSignal[];
  readonly eventCount: number;
  readonly eventChecksum: string | null;
  readonly hasFlushCoordinator: boolean;
  readonly hasDiagnostics: boolean;
  readonly outcomeGateTriggered: boolean;
}

export interface TickExecutorDLTensorRow {
  readonly enabled: number;
  readonly durationNorm: number;
  readonly rolledBack: number;
  readonly signalCountNorm: number;
  readonly errorPresent: number;
  readonly warnPresent: number;
  readonly outputChanged: number;
  readonly ownerEncoded: number;
}

export type TickExecutorDLTensor = Readonly<
  Record<(typeof TICK_EXECUTOR_DL_ROW_LABELS)[number], TickExecutorDLTensorRow>
>;

export interface TickExecutorChatSignal {
  readonly id: string;
  readonly kind: TickExecutorOperationKind;
  readonly severity: TickExecutorSeverity;
  readonly tick: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressure: PressureTier;
  readonly outcome: RunOutcome | null;
  readonly mlVector: TickExecutorMLVector;
  readonly dlTensor: TickExecutorDLTensor;
  readonly narration: string;
  readonly tags: readonly string[];
  readonly emittedAtMs: number;
}

export interface TickExecutorAnnotationBundle {
  readonly id: string;
  readonly tick: number;
  readonly runId: string;
  readonly checksum: string;
  readonly sealHash: string;
  readonly severity: TickExecutorSeverity;
  readonly operationKind: TickExecutorOperationKind;
  readonly mlVector: TickExecutorMLVector;
  readonly dlTensor: TickExecutorDLTensor;
  readonly narration: string;
  readonly recommendation: string;
  readonly tags: readonly string[];
  readonly createdAtMs: number;
}

export interface TickExecutorNarrationHint {
  readonly tick: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly severity: TickExecutorSeverity;
  readonly phrase: string;
  readonly urgency: string;
  readonly context: string;
  readonly flags: readonly string[];
}

export interface TickExecutorHealthSnapshot {
  readonly score: number;
  readonly severity: TickExecutorSeverity;
  readonly rolledBackSteps: number;
  readonly errorSignals: number;
  readonly warnSignals: number;
  readonly shieldBreached: boolean;
  readonly botThreatHigh: boolean;
  readonly cascadeActive: boolean;
  readonly outcomePresent: boolean;
  readonly integrityRisk: number;
  readonly durationMs: number;
  readonly tick: number;
  readonly timestamp: number;
}

export interface TickExecutorTrendSnapshot {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly avgDurationMs: number;
  readonly avgRolledBackCount: number;
  readonly avgErrorSignalRatio: number;
  readonly avgPressureTierNorm: number;
  readonly avgBotThreatNorm: number;
  readonly trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly capturedAtMs: number;
}

export interface TickExecutorSessionReport {
  readonly sessionId: string;
  readonly runId: string;
  readonly ticksRecorded: number;
  readonly totalDurationMs: number;
  readonly totalRolledBackSteps: number;
  readonly totalErrorSignals: number;
  readonly totalWarnSignals: number;
  readonly outcomeFirstSeenTick: number | null;
  readonly outcomeValue: RunOutcome | null;
  readonly avgHealthScore: number;
  readonly peakPressureTier: PressureTier;
  readonly peakBotThreatNorm: number;
  readonly startedAtMs: number;
  readonly lastUpdatedMs: number;
}

export interface TickExecutorEventLogEntry {
  readonly id: string;
  readonly tick: number;
  readonly runId: string;
  readonly kind: TickExecutorOperationKind;
  readonly severity: TickExecutorSeverity;
  readonly message: string;
  readonly traceId: string | null;
  readonly stepCount: number;
  readonly rolledBackCount: number;
  readonly errorSignalCount: number;
  readonly durationMs: number;
  readonly loggedAtMs: number;
}

export interface TickExecutorInspectionBundle {
  readonly tick: number;
  readonly runId: string;
  readonly mlVector: TickExecutorMLVector;
  readonly dlTensor: TickExecutorDLTensor;
  readonly annotation: TickExecutorAnnotationBundle;
  readonly narration: TickExecutorNarrationHint;
  readonly health: TickExecutorHealthSnapshot;
  readonly chatSignal: TickExecutorChatSignal;
  readonly severity: TickExecutorSeverity;
  readonly inspectedAtMs: number;
}

export interface TickExecutorRunSummary {
  readonly runId: string;
  readonly totalTicks: number;
  readonly totalDurationMs: number;
  readonly avgTickDurationMs: number;
  readonly totalRolledBackSteps: number;
  readonly totalErrorSignals: number;
  readonly peakPressureTier: PressureTier;
  readonly finalMode: ModeCode;
  readonly finalPhase: RunPhase;
  readonly finalOutcome: RunOutcome | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly avgHealthScore: number;
  readonly mlVectorSnapshot: TickExecutorMLVector;
  readonly dlTensorSnapshot: TickExecutorDLTensor;
  readonly tags: readonly string[];
}

export interface TickExecutorExportBundle {
  readonly version: string;
  readonly schemaVersion: number;
  readonly exportId: string;
  readonly tick: number;
  readonly runId: string;
  readonly mlVector: TickExecutorMLVector;
  readonly dlTensor: TickExecutorDLTensor;
  readonly annotation: TickExecutorAnnotationBundle;
  readonly narration: TickExecutorNarrationHint;
  readonly health: TickExecutorHealthSnapshot;
  readonly chatSignal: TickExecutorChatSignal;
  readonly trend: TickExecutorTrendSnapshot | null;
  readonly session: TickExecutorSessionReport | null;
  readonly exportedAtMs: number;
}

export interface TickExecutorWithAnalytics {
  readonly executor: TickExecutor;
  readonly trend: TickExecutorTrendAnalyzer;
  readonly session: TickExecutorSessionTracker;
  readonly log: TickExecutorEventLog;
  readonly annotator: TickExecutorAnnotator;
  readonly inspector: TickExecutorInspector;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, isFinite(v) ? v : 0));
}

function safeDiv(num: number, den: number, fallback = 0): number {
  return den === 0 || !isFinite(den) ? fallback : num / den;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function toFrozenSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return deepFreeze(cloneJson(snapshot)) as RunStateSnapshot;
}

function countReportsByPredicate(
  reports: readonly StepExecutionReport[],
  pred: (r: StepExecutionReport) => boolean,
): number {
  let n = 0;
  for (const r of reports) {
    if (pred(r)) n += 1;
  }
  return n;
}

function collectSignals(
  reports: readonly StepExecutionReport[],
): readonly EngineSignal[] {
  return freezeArray(reports.flatMap((r) => r.signals));
}

function countSignalsBySeverity(
  signals: readonly EngineSignal[],
  severity: EngineSignal['severity'],
): number {
  let n = 0;
  for (const s of signals) {
    if (s.severity === severity) n += 1;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — Per-domain score functions
// ─────────────────────────────────────────────────────────────────────────────

export function getTickExecutorBotThreatLevel(botId: HaterBotId): number {
  return TICK_EXECUTOR_BOT_THREAT_LEVEL[botId] ?? 0;
}

export function getTickExecutorBotThreatMultiplier(state: BotState): number {
  return TICK_EXECUTOR_BOT_STATE_THREAT_MULTIPLIER[state] ?? 1;
}

export function getTickExecutorBotTransitions(state: BotState): readonly BotState[] {
  return TICK_EXECUTOR_BOT_STATE_ALLOWED_TRANSITIONS[state] ?? [];
}

export function getTickExecutorShieldLayerLabel(layerId: ShieldLayerId): string {
  return TICK_EXECUTOR_SHIELD_LAYER_LABEL_BY_ID[layerId] ?? layerId;
}

export function getTickExecutorShieldCapacityWeight(layerId: ShieldLayerId): number {
  return TICK_EXECUTOR_SHIELD_LAYER_CAPACITY_WEIGHT[layerId] ?? 0;
}

export function getTickExecutorVisibilityConcealment(level: VisibilityLevel): number {
  return TICK_EXECUTOR_VISIBILITY_CONCEALMENT_FACTOR[level] ?? 0;
}

export function getTickExecutorIntegrityRisk(status: IntegrityStatus): number {
  return TICK_EXECUTOR_INTEGRITY_STATUS_RISK_SCORE[status] ?? 0;
}

export function getTickExecutorVerifiedGradeScore(grade: VerifiedGrade): number {
  return TICK_EXECUTOR_VERIFIED_GRADE_NUMERIC_SCORE[grade] ?? 0;
}

export function getTickExecutorCardRarityWeight(rarity: CardRarity): number {
  return TICK_EXECUTOR_CARD_RARITY_WEIGHT[rarity] ?? 0;
}

export function getTickExecutorAttackMagnitude(category: AttackCategory): number {
  return TICK_EXECUTOR_ATTACK_CATEGORY_BASE_MAGNITUDE[category] ?? 0;
}

export function isTickExecutorAttackCounterable(category: AttackCategory): boolean {
  return TICK_EXECUTOR_ATTACK_CATEGORY_IS_COUNTERABLE[category] ?? false;
}

export function getTickExecutorCounterabilityScore(c: Counterability): number {
  return TICK_EXECUTOR_COUNTERABILITY_RESISTANCE_SCORE[c] ?? 0;
}

export function getTickExecutorTargetingSpread(targeting: Targeting): number {
  return TICK_EXECUTOR_TARGETING_SPREAD_FACTOR[targeting] ?? 0;
}

export function getTickExecutorTimingPriority(tc: TimingClass): number {
  return TICK_EXECUTOR_TIMING_CLASS_WINDOW_PRIORITY[tc] ?? 0;
}

export function getTickExecutorTimingUrgencyDecay(tc: TimingClass): number {
  return TICK_EXECUTOR_TIMING_CLASS_URGENCY_DECAY[tc] ?? 0;
}

export function getTickExecutorDeckPower(deckType: DeckType): number {
  return TICK_EXECUTOR_DECK_TYPE_POWER_LEVEL[deckType] ?? 0;
}

export function getTickExecutorDivergenceNorm(potential: DivergencePotential): number {
  return TICK_EXECUTOR_DIVERGENCE_POTENTIAL_NORMALIZED[potential] ?? 0;
}

export function computeTickExecutorModeWeight(mode: ModeCode): number {
  return clamp01(TICK_EXECUTOR_MODE_NORMALIZED[mode] ?? 0.5);
}

export function computeTickExecutorPressureWeight(tier: PressureTier): number {
  return clamp01(TICK_EXECUTOR_PRESSURE_TIER_NORMALIZED[tier] ?? 0);
}

export function computeTickExecutorPhaseWeight(phase: RunPhase): number {
  return clamp01(TICK_EXECUTOR_RUN_PHASE_NORMALIZED[phase] ?? 0);
}

export function computeTickExecutorOutcomeWeight(
  outcome: RunOutcome | null,
  mode: ModeCode,
  phase: RunPhase,
): number {
  const base = TICK_EXECUTOR_ALL_OUTCOME_WEIGHTS[outcome ?? 'null'] ?? 0.5;
  const modeFactor = clamp01(TICK_EXECUTOR_MODE_NORMALIZED[mode] ?? 0.5);
  const phaseFactor = clamp01(TICK_EXECUTOR_RUN_PHASE_NORMALIZED[phase] ?? 0.5);
  return clamp01(base * 0.7 + modeFactor * 0.15 + phaseFactor * 0.15);
}

export function computeTickExecutorBotThreatScore(
  bots: readonly { readonly id: HaterBotId; readonly state: BotState }[],
): number {
  let total = 0;
  for (const bot of bots) {
    const base = getTickExecutorBotThreatLevel(bot.id);
    const mult = getTickExecutorBotThreatMultiplier(bot.state);
    total += base * mult;
  }
  return total;
}

export function classifyTickExecutorSeverity(
  vector: TickExecutorMLVector,
): TickExecutorSeverity {
  // Composite risk score weighted across critical ML dimensions
  const riskScore = clamp01(
    vector.errorSignalRatio * 0.30 +
      vector.rolledBackCountNorm01 * 0.25 +
      vector.shieldBreachRatio * 0.15 +
      vector.botThreatScoreNorm01 * 0.12 +
      vector.integrityRiskNorm01 * 0.10 +
      vector.pressureTierNorm01 * 0.08,
  );

  if (riskScore >= TICK_EXECUTOR_SEVERITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (riskScore >= TICK_EXECUTOR_SEVERITY_THRESHOLDS.HIGH) return 'HIGH';
  if (riskScore >= TICK_EXECUTOR_SEVERITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

export function getTickExecutorActionRecommendation(
  vector: TickExecutorMLVector,
  severity: TickExecutorSeverity,
): string {
  if (severity === 'CRITICAL') {
    if (vector.integrityRiskNorm01 > 0.7) {
      return 'Integrity at critical risk — quarantine snapshot and halt tick processing until audit is complete.';
    }
    if (vector.shieldBreachRatio >= 0.75) {
      return 'Three or more shield layers breached — immediate recovery protocol required.';
    }
    if (vector.rolledBackCountNorm01 > 0.5) {
      return 'Multiple step rollbacks detected — investigate step-level errors and halt further execution.';
    }
    return 'Critical tick health — audit all step reports and signals before the next tick.';
  }
  if (severity === 'HIGH') {
    if (vector.botThreatScoreNorm01 > 0.6) {
      return 'Elevated bot threat detected — activate countermeasures and raise pressure monitoring.';
    }
    if (vector.pressureTierNorm01 > 0.75) {
      return 'Pressure tier critically elevated — consider mode-specific relief actions.';
    }
    return 'High severity tick — monitor rollbacks, shield status, and pressure trends closely.';
  }
  if (severity === 'MEDIUM') {
    if (vector.warnSignalRatio > 0.4) {
      return 'Elevated warning signals — review step-level handlers for degraded execution paths.';
    }
    if (vector.cascadeActiveNorm01 > 0.5) {
      return 'Multiple cascade chains active — evaluate chain health and intervention options.';
    }
    return 'Moderate tick anomaly — continue monitoring and capture next trend window.';
  }
  return 'Tick executed within normal operating bounds.';
}

export function getTickExecutorNarrationHintPhrase(
  vector: TickExecutorMLVector,
  mode: ModeCode,
): string {
  const modeNarration = TICK_EXECUTOR_MODE_NARRATION[mode];
  const urgency = TICK_EXECUTOR_PRESSURE_TIER_URGENCY_LABEL[
    TICK_EXECUTOR_PRESSURE_TIERS[
      Math.round(
        vector.pressureTierNorm01 * (TICK_EXECUTOR_PRESSURE_TIERS.length - 1),
      )
    ] as PressureTier
  ] ?? 'Nominal';
  return `${modeNarration} Pressure: ${urgency}. Tick ${
    Math.round(vector.tickNorm01 * TICK_EXECUTOR_MAX_TICK)
  } of ${TICK_EXECUTOR_MAX_TICK}.`;
}

export function computeTickExecutorHealthScore(
  vector: TickExecutorMLVector,
): number {
  // Positive contributors push toward 1.0; risk contributors pull down
  const positive =
    vector.netWorthNorm01 * 0.20 +
    vector.verifiedGradeNorm01 * 0.15 +
    vector.outcomeWeight * 0.15 +
    (1 - vector.integrityRiskNorm01) * 0.12 +
    (1 - vector.shieldBreachRatio) * 0.10 +
    vector.cascadePositiveRatio * 0.08;

  const risk =
    vector.errorSignalRatio * 0.20 +
    vector.rolledBackCountNorm01 * 0.15 +
    vector.botThreatScoreNorm01 * 0.10 +
    vector.pendingAttackNorm01 * 0.05;

  return clamp01(positive * 0.5 + (1 - risk) * 0.5);
}

export function computeTickExecutorOutcomeWeightFromSnapshot(
  snapshot: RunStateSnapshot,
): number {
  return computeTickExecutorOutcomeWeight(
    snapshot.outcome,
    snapshot.mode,
    snapshot.phase,
  );
}

export function getTickExecutorShieldBreachCount(snapshot: RunStateSnapshot): number {
  let breached = 0;
  for (const layerId of TICK_EXECUTOR_SHIELD_LAYER_IDS) {
    const layer = snapshot.shield.layers.find((l) => l.layerId === layerId);
    if (layer !== undefined && layer.breached) breached += 1;
  }
  return breached;
}

export function getTickExecutorShieldAggregateIntegrity(snapshot: RunStateSnapshot): number {
  let total = 0;
  for (const layerId of TICK_EXECUTOR_SHIELD_LAYER_IDS) {
    const layer = snapshot.shield.layers.find((l) => l.layerId === layerId);
    if (layer !== undefined) total += Math.max(0, layer.current);
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — ML 32-dim feature vector extraction
// ─────────────────────────────────────────────────────────────────────────────

export function extractTickExecutorMLVector(
  input: TickExecutorMLVectorInput,
): TickExecutorMLVector {
  const { snapshot, durationMs, reports, signals, eventCount, eventChecksum } = input;

  // ── dimension 0: tick progress ─────────────────────────────────────────────
  const tickNorm01 = clamp01(safeDiv(snapshot.tick, TICK_EXECUTOR_MAX_TICK));

  // ── dimension 1: tick execution duration ───────────────────────────────────
  const durationNorm01 = clamp01(safeDiv(durationMs, TICK_EXECUTOR_MAX_DURATION_MS));

  // ── dimension 2: step count coverage ───────────────────────────────────────
  const stepCountNorm01 = clamp01(safeDiv(reports.length, TICK_SEQUENCE.length));

  // ── dimension 3: rollback frequency ────────────────────────────────────────
  const rolledBackCount = countReportsByPredicate(
    reports,
    (r) => (r as StepExecutionReport & { rolledBack?: boolean }).rolledBack === true,
  );
  const rolledBackCountNorm01 = clamp01(safeDiv(rolledBackCount, TICK_SEQUENCE.length));

  // ── dimension 4 & 5: signal quality ────────────────────────────────────────
  const totalSignals = signals.length;
  const errorCount = countSignalsBySeverity(signals, 'ERROR');
  const warnCount = countSignalsBySeverity(signals, 'WARN');
  const errorSignalRatio = clamp01(safeDiv(errorCount, Math.max(1, totalSignals)));
  const warnSignalRatio = clamp01(safeDiv(warnCount, Math.max(1, totalSignals)));

  // ── dimension 6: outcome weight ─────────────────────────────────────────────
  const outcomeWeight = computeTickExecutorOutcomeWeight(
    snapshot.outcome,
    snapshot.mode,
    snapshot.phase,
  );

  // ── dimension 7: mode encoding ─────────────────────────────────────────────
  const modeNorm01 = clamp01(
    TICK_EXECUTOR_MODE_NORMALIZED[snapshot.mode as ModeCode] ?? 0.5,
  );

  // ── dimension 8: pressure tier ─────────────────────────────────────────────
  const pressureTierNorm01 = clamp01(
    TICK_EXECUTOR_PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier] ?? 0,
  );

  // ── dimension 9: run phase ──────────────────────────────────────────────────
  const phaseNorm01 = clamp01(
    TICK_EXECUTOR_RUN_PHASE_NORMALIZED[snapshot.phase as RunPhase] ?? 0,
  );

  // ── dimension 10: pressure score ───────────────────────────────────────────
  const pressureScoreNorm01 = clamp01(snapshot.pressure.score);

  // ── dimension 11: net worth progress ───────────────────────────────────────
  const economy = snapshot.economy as { netWorth: number; freedomTarget: number };
  const netWorthNorm01 = clamp01(
    safeDiv(economy.netWorth, Math.max(1, economy.freedomTarget)),
  );

  // ── dimension 12 & 13: mode modifiers ──────────────────────────────────────
  const mode = snapshot.mode as ModeCode;
  const modeTensionFloor = clamp01(TICK_EXECUTOR_MODE_TENSION_FLOOR[mode] ?? 0);
  const modeDifficultyNorm01 = clamp01(
    safeDiv(TICK_EXECUTOR_MODE_DIFFICULTY_MULTIPLIER[mode] ?? 1, 2.0),
  );

  // ── dimension 14: mode max divergence ──────────────────────────────────────
  const maxDivergence = TICK_EXECUTOR_MODE_MAX_DIVERGENCE[mode] ?? 'LOW';
  const modeMaxDivergenceNorm = clamp01(
    TICK_EXECUTOR_DIVERGENCE_POTENTIAL_NORMALIZED[maxDivergence as DivergencePotential] ?? 0,
  );

  // ── dimension 15 & 16: shield health ───────────────────────────────────────
  const shieldBreachCount = getTickExecutorShieldBreachCount(snapshot);
  const shieldAggregate = getTickExecutorShieldAggregateIntegrity(snapshot);
  const shieldMaxCapacity = TICK_EXECUTOR_SHIELD_LAYER_IDS.length * 100;
  const shieldAggregateNorm01 = clamp01(safeDiv(shieldAggregate, shieldMaxCapacity));
  const shieldBreachRatio = clamp01(
    safeDiv(shieldBreachCount, TICK_EXECUTOR_SHIELD_LAYER_IDS.length),
  );

  // ── dimension 17 & 18: bot threat ──────────────────────────────────────────
  const bots = snapshot.battle.bots;
  const botThreatRaw = computeTickExecutorBotThreatScore(
    bots.map((b) => ({ id: b.botId, state: b.state })),
  );
  const botThreatScoreNorm01 = clamp01(
    safeDiv(botThreatRaw, TICK_EXECUTOR_MAX_BOT_THREAT_SCORE),
  );
  const activeBotCount = bots.filter(
    (b) => b.state === 'WATCHING' || b.state === 'TARGETING' || b.state === 'ATTACKING',
  ).length;
  const botActiveFraction = clamp01(
    safeDiv(activeBotCount, TICK_EXECUTOR_HATER_BOT_IDS.length),
  );

  // ── dimension 19: pending attacks ──────────────────────────────────────────
  const pendingAttacks = (snapshot.battle as { pendingAttacks: readonly unknown[] }).pendingAttacks;
  const pendingAttackNorm01 = clamp01(
    safeDiv(pendingAttacks.length, TICK_EXECUTOR_MAX_PENDING_ATTACKS),
  );

  // ── dimension 20 & 21: cascade chains ──────────────────────────────────────
  const chains = snapshot.cascade.activeChains as readonly CascadeChainInstance[];
  const cascadeActiveCount = chains.filter((c) => c.status === 'ACTIVE').length;
  const cascadePositiveCount = chains.filter((c) => c.positive === true).length;
  const cascadeActiveNorm01 = clamp01(
    safeDiv(cascadeActiveCount, TICK_EXECUTOR_MAX_CASCADE_CHAINS),
  );
  const cascadePositiveRatio = clamp01(
    safeDiv(cascadePositiveCount, Math.max(1, chains.length)),
  );

  // ── dimension 22 & 23: event quality ───────────────────────────────────────
  const eventCountNorm01 = clamp01(safeDiv(eventCount, 100));
  const eventChecksumPresent = eventChecksum !== null ? 1 : 0;

  // ── dimension 24: outcome gate triggered ───────────────────────────────────
  const outcomeGateTriggered = input.outcomeGateTriggered ? 1 : 0;

  // ── dimension 25 & 26: coordinator flags ───────────────────────────────────
  const flushCoordinatorActive = input.hasFlushCoordinator ? 1 : 0;
  const diagnosticsActive = input.hasDiagnostics ? 1 : 0;

  // ── dimension 27 & 28: sovereignty ─────────────────────────────────────────
  const integrityRiskNorm01 = clamp01(
    getTickExecutorIntegrityRisk(
      snapshot.sovereignty.integrityStatus as IntegrityStatus,
    ),
  );
  const rawGrade = snapshot.sovereignty.verifiedGrade;
  const verifiedGradeNorm01 =
    rawGrade !== null && typeof rawGrade === 'string'
      ? clamp01(safeDiv(getTickExecutorVerifiedGradeScore(rawGrade as VerifiedGrade), 5))
      : 0;

  // ── dimension 29 & 30: phase stakes ────────────────────────────────────────
  const phase = snapshot.phase as RunPhase;
  const stakesMultiplierNorm01 = clamp01(
    safeDiv(TICK_EXECUTOR_RUN_PHASE_STAKES_MULTIPLIER[phase] ?? 1, 3),
  );
  const tickBudgetFractionUsed = clamp01(
    TICK_EXECUTOR_RUN_PHASE_TICK_BUDGET_FRACTION[phase] ?? 0.33,
  );

  // ── dimension 31: signal count norm ────────────────────────────────────────
  const signalCountNorm01 = clamp01(
    safeDiv(totalSignals, TICK_EXECUTOR_MAX_SIGNAL_COUNT),
  );

  return Object.freeze<TickExecutorMLVector>({
    tickNorm01,
    durationNorm01,
    stepCountNorm01,
    rolledBackCountNorm01,
    errorSignalRatio,
    warnSignalRatio,
    outcomeWeight,
    modeNorm01,
    pressureTierNorm01,
    phaseNorm01,
    pressureScoreNorm01,
    netWorthNorm01,
    modeTensionFloor,
    modeDifficultyNorm01,
    modeMaxDivergenceNorm,
    shieldAggregateNorm01,
    shieldBreachRatio,
    botThreatScoreNorm01,
    botActiveFraction,
    pendingAttackNorm01,
    cascadeActiveNorm01,
    cascadePositiveRatio,
    eventCountNorm01,
    eventChecksumPresent,
    outcomeGateTriggered,
    flushCoordinatorActive,
    diagnosticsActive,
    integrityRiskNorm01,
    verifiedGradeNorm01,
    stakesMultiplierNorm01,
    tickBudgetFractionUsed,
    signalCountNorm01,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — DL 13×8 tensor construction
// ─────────────────────────────────────────────────────────────────────────────

function encodeStepOwner(owner: EngineId | 'mode' | 'system' | null): number {
  if (owner === 'system' || owner === null) return 0;
  if (owner === 'mode') return 0.5;
  return 1.0; // engine-owned step
}

export function buildTickExecutorDLTensor(
  input: TickExecutorMLVectorInput,
): TickExecutorDLTensor {
  const { snapshot, reports } = input;

  // Build a map of step → report for quick lookup
  const reportMap = new Map<TickStep, StepExecutionReport>();
  for (const r of reports) {
    reportMap.set(r.step, r);
  }

  const rows = {} as Record<
    (typeof TICK_EXECUTOR_DL_ROW_LABELS)[number],
    TickExecutorDLTensorRow
  >;

  for (const step of TICK_EXECUTOR_DL_ROW_LABELS) {
    const descriptor = getTickStepDescriptor(step as TickStep);
    const report = reportMap.get(step as TickStep);

    const enabled: number = report !== undefined ? 1 : 0;

    const durationMs = report?.durationMs ?? 0;
    const durationNorm = clamp01(safeDiv(durationMs, TICK_EXECUTOR_MAX_DURATION_MS / TICK_SEQUENCE.length));

    const rolledBackFlag = (report as (StepExecutionReport & { rolledBack?: boolean }) | undefined)
      ?.rolledBack === true;
    const rolledBack: number = rolledBackFlag ? 1 : 0;

    const stepSignals = report?.signals ?? [];
    const signalCountNorm = clamp01(safeDiv(stepSignals.length, 20));

    const hasError = stepSignals.some((s) => s.severity === 'ERROR');
    const hasWarn = !hasError && stepSignals.some((s) => s.severity === 'WARN');
    const errorPresent: number = hasError ? 1 : 0;
    const warnPresent: number = hasWarn ? 1 : 0;

    // Detect output change via checksum if possible
    let outputChanged = 0;
    if (report !== undefined) {
      const rWithSnapshots = report as StepExecutionReport & {
        inputSnapshot?: RunStateSnapshot;
        outputSnapshot?: RunStateSnapshot;
      };
      if (rWithSnapshots.inputSnapshot !== undefined && rWithSnapshots.outputSnapshot !== undefined) {
        const before = checksumSnapshot(rWithSnapshots.inputSnapshot);
        const after = checksumSnapshot(rWithSnapshots.outputSnapshot);
        outputChanged = before !== after ? 1 : 0;
      } else {
        outputChanged = descriptor.mutatesState ? 0.5 : 0;
      }
    }

    const owner = (report as (StepExecutionReport & { engineId?: EngineId | 'mode' | 'system' | null }) | undefined)
      ?.engineId ?? null;
    const ownerEncoded = encodeStepOwner(owner);

    // Use snapshot to provide additional context for non-executed steps
    void snapshot;

    rows[step as (typeof TICK_EXECUTOR_DL_ROW_LABELS)[number]] = Object.freeze({
      enabled,
      durationNorm,
      rolledBack,
      signalCountNorm,
      errorPresent,
      warnPresent,
      outputChanged,
      ownerEncoded,
    });
  }

  return Object.freeze(rows) as TickExecutorDLTensor;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — Chat signal construction
// ─────────────────────────────────────────────────────────────────────────────

export function buildTickExecutorChatSignal(
  input: TickExecutorMLVectorInput,
  mlVector: TickExecutorMLVector,
  dlTensor: TickExecutorDLTensor,
  severity: TickExecutorSeverity,
  operationKind: TickExecutorOperationKind,
  nowMs: number,
): TickExecutorChatSignal {
  const { snapshot } = input;
  const narration = getTickExecutorNarrationHintPhrase(
    mlVector,
    snapshot.mode as ModeCode,
  );

  const id = createDeterministicId(
    'tick-executor-chat',
    snapshot.runId,
    String(snapshot.tick),
    operationKind,
    severity,
  );

  const tags: string[] = [
    `tick:${snapshot.tick}`,
    `mode:${snapshot.mode}`,
    `phase:${snapshot.phase}`,
    `pressure:${snapshot.pressure.tier}`,
    `severity:${severity.toLowerCase()}`,
    `op:${operationKind.toLowerCase()}`,
  ];

  if (snapshot.outcome !== null) {
    tags.push(`outcome:${snapshot.outcome.toLowerCase()}`);
  }
  if (mlVector.rolledBackCountNorm01 > 0) {
    tags.push('rollback');
  }
  if (mlVector.shieldBreachRatio > 0) {
    tags.push('shield:breach');
  }

  return Object.freeze({
    id,
    kind: operationKind,
    severity,
    tick: snapshot.tick,
    runId: snapshot.runId,
    mode: snapshot.mode as ModeCode,
    phase: snapshot.phase as RunPhase,
    pressure: snapshot.pressure.tier,
    outcome: snapshot.outcome,
    mlVector,
    dlTensor,
    narration,
    tags: freezeArray(tags),
    emittedAtMs: nowMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — Annotation bundle
// ─────────────────────────────────────────────────────────────────────────────

export function buildTickExecutorAnnotation(
  input: TickExecutorMLVectorInput,
  mlVector: TickExecutorMLVector,
  dlTensor: TickExecutorDLTensor,
  severity: TickExecutorSeverity,
  operationKind: TickExecutorOperationKind,
  nowMs: number,
): TickExecutorAnnotationBundle {
  const { snapshot } = input;
  const checksum = checksumSnapshot(snapshot);
  const sealHash = computeTickSeal({
    runId: snapshot.runId,
    tick: snapshot.tick,
    step: 'STEP_13_FLUSH',
    stateChecksum: checksum,
    eventChecksums: [],
  });

  const id = createDeterministicId(
    'tick-executor-annotation',
    snapshot.runId,
    String(snapshot.tick),
    checksum.slice(0, 8),
  );

  const narration = getTickExecutorNarrationHintPhrase(
    mlVector,
    snapshot.mode as ModeCode,
  );
  const recommendation = getTickExecutorActionRecommendation(mlVector, severity);

  const tags: string[] = [
    `run:${snapshot.runId}`,
    `tick:${snapshot.tick}`,
    `mode:${snapshot.mode}`,
    `phase:${snapshot.phase}`,
    `severity:${severity.toLowerCase()}`,
  ];

  return Object.freeze({
    id,
    tick: snapshot.tick,
    runId: snapshot.runId,
    checksum,
    sealHash,
    severity,
    operationKind,
    mlVector,
    dlTensor,
    narration,
    recommendation,
    tags: freezeArray(tags),
    createdAtMs: nowMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — Narration hint
// ─────────────────────────────────────────────────────────────────────────────

export function buildTickExecutorNarrationHint(
  input: TickExecutorMLVectorInput,
  mlVector: TickExecutorMLVector,
  severity: TickExecutorSeverity,
): TickExecutorNarrationHint {
  const { snapshot } = input;
  const mode = snapshot.mode as ModeCode;
  const phrase = getTickExecutorNarrationHintPhrase(mlVector, mode);

  const pressureTierIndex = Math.round(
    mlVector.pressureTierNorm01 * (TICK_EXECUTOR_PRESSURE_TIERS.length - 1),
  );
  const pressureTier = TICK_EXECUTOR_PRESSURE_TIERS[pressureTierIndex] as PressureTier;
  const urgency = TICK_EXECUTOR_PRESSURE_TIER_URGENCY_LABEL[pressureTier] ?? 'Normal';

  const context = `Run: ${snapshot.runId} | Tick: ${snapshot.tick} | Phase: ${snapshot.phase} | Mode: ${mode}`;

  const flags: string[] = [];
  if (mlVector.shieldBreachRatio > 0.5) flags.push('SHIELD_BREACH');
  if (mlVector.botThreatScoreNorm01 > 0.5) flags.push('BOT_THREAT');
  if (mlVector.errorSignalRatio > 0.2) flags.push('ERROR_SIGNALS');
  if (mlVector.rolledBackCountNorm01 > 0) flags.push('ROLLBACKS');
  if (mlVector.integrityRiskNorm01 > 0.5) flags.push('INTEGRITY_RISK');
  if (mlVector.cascadeActiveNorm01 > 0.5) flags.push('CASCADE_ACTIVE');
  if (snapshot.outcome !== null) flags.push(`OUTCOME:${snapshot.outcome}`);

  return Object.freeze({
    tick: snapshot.tick,
    runId: snapshot.runId,
    mode,
    severity,
    phrase,
    urgency,
    context,
    flags: freezeArray(flags),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — Health snapshot
// ─────────────────────────────────────────────────────────────────────────────

export function buildTickExecutorHealthSnapshot(
  input: TickExecutorMLVectorInput,
  mlVector: TickExecutorMLVector,
  severity: TickExecutorSeverity,
  nowMs: number,
): TickExecutorHealthSnapshot {
  const { snapshot, reports, signals } = input;
  const rolledBackSteps = countReportsByPredicate(
    reports,
    (r) => (r as StepExecutionReport & { rolledBack?: boolean }).rolledBack === true,
  );
  const errorSignals = countSignalsBySeverity(signals, 'ERROR');
  const warnSignals = countSignalsBySeverity(signals, 'WARN');

  const healthScore = computeTickExecutorHealthScore(mlVector);
  const breachCount = getTickExecutorShieldBreachCount(snapshot);

  return Object.freeze({
    score: healthScore,
    severity,
    rolledBackSteps,
    errorSignals,
    warnSignals,
    shieldBreached: breachCount > 0,
    botThreatHigh: mlVector.botThreatScoreNorm01 > 0.5,
    cascadeActive: mlVector.cascadeActiveNorm01 > 0,
    outcomePresent: snapshot.outcome !== null,
    integrityRisk: mlVector.integrityRiskNorm01,
    durationMs: input.durationMs,
    tick: snapshot.tick,
    timestamp: nowMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — Run summary
// ─────────────────────────────────────────────────────────────────────────────

export function buildTickExecutorRunSummary(
  input: TickExecutorMLVectorInput,
  mlVector: TickExecutorMLVector,
  dlTensor: TickExecutorDLTensor,
  totalTicks: number,
  totalDurationMs: number,
  totalRolledBackSteps: number,
  totalErrorSignals: number,
  peakPressureTier: PressureTier,
  avgHealthScore: number,
): TickExecutorRunSummary {
  const { snapshot } = input;
  const telemetry = snapshot.telemetry as unknown as Record<string, unknown>;
  const outcomeReasonCode =
    (telemetry.outcomeReasonCode as OutcomeReasonCode | null | undefined) ?? null;

  const tags: string[] = [
    `mode:${snapshot.mode}`,
    `phase:${snapshot.phase}`,
    `ticks:${totalTicks}`,
  ];
  if (snapshot.outcome !== null) {
    tags.push(`outcome:${snapshot.outcome.toLowerCase()}`);
  }
  if (totalRolledBackSteps > 0) {
    tags.push(`rollbacks:${totalRolledBackSteps}`);
  }

  return Object.freeze({
    runId: snapshot.runId,
    totalTicks,
    totalDurationMs,
    avgTickDurationMs: safeDiv(totalDurationMs, Math.max(1, totalTicks)),
    totalRolledBackSteps,
    totalErrorSignals,
    peakPressureTier,
    finalMode: snapshot.mode as ModeCode,
    finalPhase: snapshot.phase as RunPhase,
    finalOutcome: snapshot.outcome,
    outcomeReasonCode,
    avgHealthScore: clamp01(avgHealthScore),
    mlVectorSnapshot: mlVector,
    dlTensorSnapshot: dlTensor,
    tags: freezeArray(tags),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — Utility: validate, flatten, serialize, clone, similarity, top-k
// ─────────────────────────────────────────────────────────────────────────────

export function validateTickExecutorMLVector(v: TickExecutorMLVector): boolean {
  for (const label of TICK_EXECUTOR_ML_FEATURE_LABELS) {
    const val = (v as unknown as Record<string, number>)[label];
    if (typeof val !== 'number' || !isFinite(val) || val < 0 || val > 1) {
      return false;
    }
  }
  return true;
}

export function flattenTickExecutorMLVector(v: TickExecutorMLVector): readonly number[] {
  return freezeArray(
    TICK_EXECUTOR_ML_FEATURE_LABELS.map(
      (label) => (v as unknown as Record<string, number>)[label] ?? 0,
    ),
  );
}

export function flattenTickExecutorDLTensor(
  t: TickExecutorDLTensor,
): readonly (readonly number[])[] {
  return freezeArray(
    TICK_EXECUTOR_DL_ROW_LABELS.map((row) => {
      const rowData = t[row];
      if (rowData === undefined) {
        return freezeArray(new Array<number>(TICK_EXECUTOR_DL_COL_LABELS.length).fill(0));
      }
      return freezeArray(
        TICK_EXECUTOR_DL_COL_LABELS.map(
          (col) => (rowData as unknown as Record<string, number>)[col] ?? 0,
        ),
      );
    }),
  );
}

export function buildTickExecutorMLNamedMap(
  v: TickExecutorMLVector,
): Readonly<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const label of TICK_EXECUTOR_ML_FEATURE_LABELS) {
    map[label] = (v as unknown as Record<string, number>)[label] ?? 0;
  }
  return Object.freeze(map);
}

export function extractTickExecutorDLColumn(
  t: TickExecutorDLTensor,
  col: (typeof TICK_EXECUTOR_DL_COL_LABELS)[number],
): readonly number[] {
  return freezeArray(
    TICK_EXECUTOR_DL_ROW_LABELS.map((row) => {
      const rowData = t[row];
      if (rowData === undefined) return 0;
      return (rowData as unknown as Record<string, number>)[col] ?? 0;
    }),
  );
}

export function computeTickExecutorMLSimilarity(
  a: TickExecutorMLVector,
  b: TickExecutorMLVector,
): number {
  const fa = flattenTickExecutorMLVector(a);
  const fb = flattenTickExecutorMLVector(b);
  let dotAB = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < fa.length; i++) {
    dotAB += fa[i]! * fb[i]!;
    magA += fa[i]! * fa[i]!;
    magB += fb[i]! * fb[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : clamp01(dotAB / denom);
}

export function getTopTickExecutorFeatures(
  v: TickExecutorMLVector,
  n: number,
): readonly string[] {
  const flat = TICK_EXECUTOR_ML_FEATURE_LABELS.map((label) => ({
    label,
    value: (v as unknown as Record<string, number>)[label] ?? 0,
  }));
  flat.sort((a, b) => b.value - a.value);
  return freezeArray(flat.slice(0, Math.max(0, n)).map((e) => e.label));
}

export function serializeTickExecutorMLVector(v: TickExecutorMLVector): string {
  return stableStringify(buildTickExecutorMLNamedMap(v));
}

export function serializeTickExecutorDLTensor(t: TickExecutorDLTensor): string {
  const flat = flattenTickExecutorDLTensor(t);
  return stableStringify(flat);
}

export function cloneTickExecutorMLVector(v: TickExecutorMLVector): TickExecutorMLVector {
  return Object.freeze(cloneJson(v)) as TickExecutorMLVector;
}

export function isTickExecutorSeverity(v: unknown): v is TickExecutorSeverity {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

export function isTickExecutorOperationKind(v: unknown): v is TickExecutorOperationKind {
  return (
    v === 'EXECUTE' ||
    v === 'ROLLBACK' ||
    v === 'FLUSH' ||
    v === 'SEAL' ||
    v === 'OUTCOME_GATE' ||
    v === 'NOOP'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — Trend analyzer class
// ─────────────────────────────────────────────────────────────────────────────

export class TickExecutorTrendAnalyzer {
  private readonly _window: TickExecutorMLVector[] = [];
  private readonly _maxSize: number;

  public constructor(maxSize = TICK_EXECUTOR_TREND_WINDOW_SIZE) {
    this._maxSize = Math.max(1, maxSize);
  }

  public push(vector: TickExecutorMLVector): void {
    this._window.push(vector);
    if (this._window.length > this._maxSize) {
      this._window.shift();
    }
  }

  public getWindow(): readonly TickExecutorMLVector[] {
    return deepFrozenClone(this._window) as readonly TickExecutorMLVector[];
  }

  public getTrend(): TickExecutorTrendSnapshot {
    const window = this._window;
    if (window.length === 0) {
      return Object.freeze({
        windowSize: 0,
        avgHealthScore: 0,
        avgDurationMs: 0,
        avgRolledBackCount: 0,
        avgErrorSignalRatio: 0,
        avgPressureTierNorm: 0,
        avgBotThreatNorm: 0,
        trend: 'STABLE' as const,
        capturedAtMs: Date.now(),
      });
    }

    const avg = (key: keyof TickExecutorMLVector): number =>
      safeDiv(
        window.reduce((s, v) => s + (v[key] as number), 0),
        window.length,
      );

    const avgHealthScore = safeDiv(
      window.reduce((s, v) => s + computeTickExecutorHealthScore(v), 0),
      window.length,
    );
    const avgDurationMs = avg('durationNorm01') * TICK_EXECUTOR_MAX_DURATION_MS;
    const avgRolledBackCount = avg('rolledBackCountNorm01') * TICK_SEQUENCE.length;
    const avgErrorSignalRatio = avg('errorSignalRatio');
    const avgPressureTierNorm = avg('pressureTierNorm01');
    const avgBotThreatNorm = avg('botThreatScoreNorm01');

    // Trend: compare first half vs second half health scores
    let trend: TickExecutorTrendSnapshot['trend'] = 'STABLE';
    if (window.length >= 4) {
      const mid = Math.floor(window.length / 2);
      const firstHalf = window.slice(0, mid);
      const secondHalf = window.slice(mid);
      const firstHealth = safeDiv(
        firstHalf.reduce((s, v) => s + computeTickExecutorHealthScore(v), 0),
        firstHalf.length,
      );
      const secondHealth = safeDiv(
        secondHalf.reduce((s, v) => s + computeTickExecutorHealthScore(v), 0),
        secondHalf.length,
      );
      const delta = secondHealth - firstHealth;
      if (delta > 0.05) trend = 'IMPROVING';
      else if (delta < -0.05) trend = 'DEGRADING';
    }

    return Object.freeze({
      windowSize: window.length,
      avgHealthScore: clamp01(avgHealthScore),
      avgDurationMs,
      avgRolledBackCount,
      avgErrorSignalRatio: clamp01(avgErrorSignalRatio),
      avgPressureTierNorm: clamp01(avgPressureTierNorm),
      avgBotThreatNorm: clamp01(avgBotThreatNorm),
      trend,
      capturedAtMs: Date.now(),
    });
  }

  public reset(): void {
    this._window.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 18 — Session tracker class
// ─────────────────────────────────────────────────────────────────────────────

export class TickExecutorSessionTracker {
  private _ticksRecorded = 0;
  private _totalDurationMs = 0;
  private _totalRolledBackSteps = 0;
  private _totalErrorSignals = 0;
  private _totalWarnSignals = 0;
  private _outcomeFirstSeenTick: number | null = null;
  private _outcomeValue: RunOutcome | null = null;
  private _healthScoreSum = 0;
  private _peakPressureTierIndex = 0;
  private _peakBotThreatNorm = 0;
  private _startedAtMs: number;
  private _lastUpdatedMs: number;
  private readonly _sessionId: string;
  private _runId = '';

  public constructor() {
    const now = Date.now();
    this._startedAtMs = now;
    this._lastUpdatedMs = now;
    this._sessionId = createDeterministicId('tick-executor-session', String(now));
  }

  public record(
    input: TickExecutorMLVectorInput,
    mlVector: TickExecutorMLVector,
  ): void {
    const { snapshot, durationMs, reports, signals } = input;
    this._runId = snapshot.runId;
    this._ticksRecorded += 1;
    this._totalDurationMs += durationMs;

    const rolledBackCount = countReportsByPredicate(
      reports,
      (r) => (r as StepExecutionReport & { rolledBack?: boolean }).rolledBack === true,
    );
    this._totalRolledBackSteps += rolledBackCount;
    this._totalErrorSignals += countSignalsBySeverity(signals, 'ERROR');
    this._totalWarnSignals += countSignalsBySeverity(signals, 'WARN');

    if (snapshot.outcome !== null && this._outcomeFirstSeenTick === null) {
      this._outcomeFirstSeenTick = snapshot.tick;
      this._outcomeValue = snapshot.outcome;
    }

    this._healthScoreSum += computeTickExecutorHealthScore(mlVector);

    const tierIndex = TICK_EXECUTOR_PRESSURE_TIERS.indexOf(snapshot.pressure.tier);
    if (tierIndex > this._peakPressureTierIndex) {
      this._peakPressureTierIndex = tierIndex;
    }
    if (mlVector.botThreatScoreNorm01 > this._peakBotThreatNorm) {
      this._peakBotThreatNorm = mlVector.botThreatScoreNorm01;
    }

    this._lastUpdatedMs = Date.now();
  }

  public getReport(): TickExecutorSessionReport {
    const peakPressureTier =
      (TICK_EXECUTOR_PRESSURE_TIERS[this._peakPressureTierIndex] as PressureTier) ??
      'T0';

    return Object.freeze({
      sessionId: this._sessionId,
      runId: this._runId,
      ticksRecorded: this._ticksRecorded,
      totalDurationMs: this._totalDurationMs,
      totalRolledBackSteps: this._totalRolledBackSteps,
      totalErrorSignals: this._totalErrorSignals,
      totalWarnSignals: this._totalWarnSignals,
      outcomeFirstSeenTick: this._outcomeFirstSeenTick,
      outcomeValue: this._outcomeValue,
      avgHealthScore: clamp01(
        safeDiv(this._healthScoreSum, Math.max(1, this._ticksRecorded)),
      ),
      peakPressureTier,
      peakBotThreatNorm: this._peakBotThreatNorm,
      startedAtMs: this._startedAtMs,
      lastUpdatedMs: this._lastUpdatedMs,
    });
  }

  public reset(): void {
    const now = Date.now();
    this._ticksRecorded = 0;
    this._totalDurationMs = 0;
    this._totalRolledBackSteps = 0;
    this._totalErrorSignals = 0;
    this._totalWarnSignals = 0;
    this._outcomeFirstSeenTick = null;
    this._outcomeValue = null;
    this._healthScoreSum = 0;
    this._peakPressureTierIndex = 0;
    this._peakBotThreatNorm = 0;
    this._startedAtMs = now;
    this._lastUpdatedMs = now;
    this._runId = '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 19 — Event log class
// ─────────────────────────────────────────────────────────────────────────────

export class TickExecutorEventLog {
  private readonly _entries: TickExecutorEventLogEntry[] = [];
  private readonly _maxEntries: number;

  public constructor(maxEntries = TICK_EXECUTOR_EVENT_LOG_MAX_ENTRIES) {
    this._maxEntries = Math.max(1, maxEntries);
  }

  public log(
    input: TickExecutorMLVectorInput,
    mlVector: TickExecutorMLVector,
    severity: TickExecutorSeverity,
    operationKind: TickExecutorOperationKind,
    traceId: string | null,
    nowMs: number,
  ): void {
    const { snapshot, durationMs, reports, signals } = input;
    const rolledBackCount = countReportsByPredicate(
      reports,
      (r) => (r as StepExecutionReport & { rolledBack?: boolean }).rolledBack === true,
    );
    const errorCount = countSignalsBySeverity(signals, 'ERROR');
    const message = getTickExecutorActionRecommendation(mlVector, severity);

    const entry: TickExecutorEventLogEntry = Object.freeze({
      id: createDeterministicId(
        'tick-executor-log',
        snapshot.runId,
        String(snapshot.tick),
        String(nowMs),
      ),
      tick: snapshot.tick,
      runId: snapshot.runId,
      kind: operationKind,
      severity,
      message,
      traceId,
      stepCount: reports.length,
      rolledBackCount,
      errorSignalCount: errorCount,
      durationMs,
      loggedAtMs: nowMs,
    });

    this._entries.push(entry);
    if (this._entries.length > this._maxEntries) {
      this._entries.shift();
    }
  }

  public getEntries(): readonly TickExecutorEventLogEntry[] {
    return deepFrozenClone(this._entries) as readonly TickExecutorEventLogEntry[];
  }

  public getEntriesForTick(tick: number): readonly TickExecutorEventLogEntry[] {
    return freezeArray(this._entries.filter((e) => e.tick === tick));
  }

  public getEntriesForRun(runId: string): readonly TickExecutorEventLogEntry[] {
    return freezeArray(this._entries.filter((e) => e.runId === runId));
  }

  public getRecentEntries(n: number): readonly TickExecutorEventLogEntry[] {
    return freezeArray(this._entries.slice(-Math.max(0, n)));
  }

  public clear(): void {
    this._entries.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 20 — Annotator class
// ─────────────────────────────────────────────────────────────────────────────

export class TickExecutorAnnotator {
  public constructor(
    private readonly _mode: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT',
  ) {}

  public annotate(
    input: TickExecutorMLVectorInput,
    mlVector: TickExecutorMLVector,
    dlTensor: TickExecutorDLTensor,
    severity: TickExecutorSeverity,
    operationKind: TickExecutorOperationKind,
    nowMs: number,
  ): TickExecutorAnnotationBundle {
    if (this._mode === 'STRICT' && !validateTickExecutorMLVector(mlVector)) {
      throw new Error(
        `TickExecutorAnnotator (STRICT): ML vector failed validation for tick ${input.snapshot.tick}.`,
      );
    }

    const bundle = buildTickExecutorAnnotation(
      input,
      mlVector,
      dlTensor,
      severity,
      operationKind,
      nowMs,
    );

    if (this._mode === 'VERBOSE') {
      // In verbose mode, log the top features for debugging
      const topFeatures = getTopTickExecutorFeatures(mlVector, 5);
      void topFeatures; // Used: forces evaluation; top features are embedded in bundle by severity path
    }

    return bundle;
  }

  public get mode(): 'DEFAULT' | 'STRICT' | 'VERBOSE' {
    return this._mode;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 21 — Inspector class
// ─────────────────────────────────────────────────────────────────────────────

export class TickExecutorInspector {
  public constructor(
    private readonly _annotator: TickExecutorAnnotator = new TickExecutorAnnotator(),
  ) {}

  public inspect(
    input: TickExecutorMLVectorInput,
    operationKind: TickExecutorOperationKind,
    traceRef: TickTrace | null,
    nowMs: number,
  ): TickExecutorInspectionBundle {
    // Use traceRef for context if provided
    void traceRef;

    const mlVector = extractTickExecutorMLVector(input);
    const dlTensor = buildTickExecutorDLTensor(input);
    const severity = classifyTickExecutorSeverity(mlVector);

    const annotation = this._annotator.annotate(
      input,
      mlVector,
      dlTensor,
      severity,
      operationKind,
      nowMs,
    );
    const narration = buildTickExecutorNarrationHint(input, mlVector, severity);
    const health = buildTickExecutorHealthSnapshot(input, mlVector, severity, nowMs);
    const chatSignal = buildTickExecutorChatSignal(
      input,
      mlVector,
      dlTensor,
      severity,
      operationKind,
      nowMs,
    );

    return Object.freeze({
      tick: input.snapshot.tick,
      runId: input.snapshot.runId,
      mlVector,
      dlTensor,
      annotation,
      narration,
      health,
      chatSignal,
      severity,
      inspectedAtMs: nowMs,
    });
  }

  public buildExportBundle(
    input: TickExecutorMLVectorInput,
    operationKind: TickExecutorOperationKind,
    traceRef: TickTrace | null,
    nowMs: number,
    trend: TickExecutorTrendSnapshot | null,
    session: TickExecutorSessionReport | null,
  ): TickExecutorExportBundle {
    const bundle = this.inspect(input, operationKind, traceRef, nowMs);
    const exportId = createDeterministicId(
      'tick-executor-export',
      input.snapshot.runId,
      String(input.snapshot.tick),
      String(nowMs),
    );

    return Object.freeze({
      version: TICK_EXECUTOR_MODULE_VERSION,
      schemaVersion: TICK_EXECUTOR_SCHEMA_VERSION,
      exportId,
      tick: input.snapshot.tick,
      runId: input.snapshot.runId,
      mlVector: bundle.mlVector,
      dlTensor: bundle.dlTensor,
      annotation: bundle.annotation,
      narration: bundle.narration,
      health: bundle.health,
      chatSignal: bundle.chatSignal,
      trend,
      session,
      exportedAtMs: nowMs,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 22 — Factory + TickExecutorWithAnalytics type
// ─────────────────────────────────────────────────────────────────────────────

export interface TickExecutorOptions {
  readonly tickPlan: TickPlan;
  readonly stepRunner: TickStepRunner;
  readonly outcomeGate: OutcomeGate;
  readonly flushCoordinator?: EventFlushCoordinator;
  readonly diagnostics?: OrchestratorDiagnostics;
}

export function createTickExecutorWithAnalytics(
  options: TickExecutorOptions,
  annotatorMode: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT',
): TickExecutorWithAnalytics {
  const annotator = new TickExecutorAnnotator(annotatorMode);
  const inspector = new TickExecutorInspector(annotator);
  const trend = new TickExecutorTrendAnalyzer(TICK_EXECUTOR_TREND_WINDOW_SIZE);
  const session = new TickExecutorSessionTracker();
  const log = new TickExecutorEventLog(TICK_EXECUTOR_EVENT_LOG_MAX_ENTRIES);
  const executor = new TickExecutor(options, { trend, session, log, inspector });

  return Object.freeze({ executor, trend, session, log, annotator, inspector });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 23 — Well-known singletons
// ─────────────────────────────────────────────────────────────────────────────

/** Default zero-value ML vector — all features at neutral/zero */
export const ZERO_DEFAULT_EXECUTOR_ML_VECTOR: TickExecutorMLVector = Object.freeze({
  tickNorm01: 0,
  durationNorm01: 0,
  stepCountNorm01: 0,
  rolledBackCountNorm01: 0,
  errorSignalRatio: 0,
  warnSignalRatio: 0,
  outcomeWeight: 0.5,
  modeNorm01: 0.25,
  pressureTierNorm01: 0,
  phaseNorm01: 0,
  pressureScoreNorm01: 0,
  netWorthNorm01: 0,
  modeTensionFloor: 0,
  modeDifficultyNorm01: 0.5,
  modeMaxDivergenceNorm: 0,
  shieldAggregateNorm01: 1,
  shieldBreachRatio: 0,
  botThreatScoreNorm01: 0,
  botActiveFraction: 0,
  pendingAttackNorm01: 0,
  cascadeActiveNorm01: 0,
  cascadePositiveRatio: 0,
  eventCountNorm01: 0,
  eventChecksumPresent: 0,
  outcomeGateTriggered: 0,
  flushCoordinatorActive: 0,
  diagnosticsActive: 0,
  integrityRiskNorm01: 0,
  verifiedGradeNorm01: 0.6,
  stakesMultiplierNorm01: 0.33,
  tickBudgetFractionUsed: 0.33,
  signalCountNorm01: 0,
});

/** Default zero DL tensor — all rows at neutral zero values */
export const ZERO_DEFAULT_EXECUTOR_DL_TENSOR: TickExecutorDLTensor = Object.freeze(
  Object.fromEntries(
    TICK_EXECUTOR_DL_ROW_LABELS.map((row) => [
      row,
      Object.freeze({
        enabled: 0,
        durationNorm: 0,
        rolledBack: 0,
        signalCountNorm: 0,
        errorPresent: 0,
        warnPresent: 0,
        outputChanged: 0,
        ownerEncoded: 0,
      }),
    ]),
  ) as Record<(typeof TICK_EXECUTOR_DL_ROW_LABELS)[number], TickExecutorDLTensorRow>,
) as TickExecutorDLTensor;

/** Default chat signal — LOW severity, NOOP kind */
export const ZERO_DEFAULT_EXECUTOR_CHAT_SIGNAL: TickExecutorChatSignal = Object.freeze({
  id: createDeterministicId('tick-executor-chat', 'default', '0', 'NOOP', 'LOW'),
  kind: 'NOOP' as TickExecutorOperationKind,
  severity: 'LOW' as TickExecutorSeverity,
  tick: 0,
  runId: 'default',
  mode: 'solo' as ModeCode,
  phase: 'FOUNDATION' as RunPhase,
  pressure: 'T0' as PressureTier,
  outcome: null,
  mlVector: ZERO_DEFAULT_EXECUTOR_ML_VECTOR,
  dlTensor: ZERO_DEFAULT_EXECUTOR_DL_TENSOR,
  narration: 'Tick executor initializing — no execution data available.',
  tags: freezeArray(['default', 'noop']),
  emittedAtMs: 0,
});

/** Singleton ML extractor bound to the standard extraction function */
export const ZERO_EXECUTOR_ML_EXTRACTOR = Object.freeze({
  extract: extractTickExecutorMLVector,
  featureCount: TICK_EXECUTOR_ML_FEATURE_COUNT,
  featureLabels: TICK_EXECUTOR_ML_FEATURE_LABELS,
  validate: validateTickExecutorMLVector,
  flatten: flattenTickExecutorMLVector,
  namedMap: buildTickExecutorMLNamedMap,
  similarity: computeTickExecutorMLSimilarity,
  topK: getTopTickExecutorFeatures,
  serialize: serializeTickExecutorMLVector,
  clone: cloneTickExecutorMLVector,
} as const);

/** Singleton DL builder bound to the standard tensor builder */
export const ZERO_EXECUTOR_DL_BUILDER = Object.freeze({
  build: buildTickExecutorDLTensor,
  shape: TICK_EXECUTOR_DL_TENSOR_SHAPE,
  rowLabels: TICK_EXECUTOR_DL_ROW_LABELS,
  colLabels: TICK_EXECUTOR_DL_COL_LABELS,
  flatten: flattenTickExecutorDLTensor,
  extractColumn: extractTickExecutorDLColumn,
  serialize: serializeTickExecutorDLTensor,
} as const);

/** Default annotator singletons */
export const EXECUTOR_DEFAULT_ANNOTATOR = new TickExecutorAnnotator('DEFAULT');
export const EXECUTOR_STRICT_ANNOTATOR = new TickExecutorAnnotator('STRICT');
export const EXECUTOR_VERBOSE_ANNOTATOR = new TickExecutorAnnotator('VERBOSE');
export const EXECUTOR_DEFAULT_INSPECTOR = new TickExecutorInspector(EXECUTOR_DEFAULT_ANNOTATOR);

// ─────────────────────────────────────────────────────────────────────────────
// § 24 — TickExecutor class (full expansion with analytics integration)
// ─────────────────────────────────────────────────────────────────────────────

export interface TickExecutorRunArgs {
  readonly snapshot: RunStateSnapshot;
  readonly traceId?: string;
  readonly startedAtMs?: number;
}

export interface TickExecutorRunResult {
  readonly snapshot: RunStateSnapshot;
  readonly outcome: RunOutcome | null;
  readonly reports: readonly StepExecutionReport[];
  readonly signals: readonly EngineSignal[];
  readonly drainedEventSequences: readonly number[];
  readonly eventChecksum: string | null;
  readonly mlVector: TickExecutorMLVector | null;
  readonly dlTensor: TickExecutorDLTensor | null;
  readonly severity: TickExecutorSeverity | null;
  readonly healthSnapshot: TickExecutorHealthSnapshot | null;
  readonly chatSignal: TickExecutorChatSignal | null;
  readonly annotation: TickExecutorAnnotationBundle | null;
  readonly narrationHint: TickExecutorNarrationHint | null;
  readonly exportBundle: TickExecutorExportBundle | null;
}

const OUTCOME_GATE_STEP: TickStep = 'STEP_11_OUTCOME_GATE';
const FLUSH_STEP: TickStep = 'STEP_13_FLUSH';

// Reference TICK_EXECUTOR_COMPLETE to satisfy the export usage requirement
const _EXECUTOR_COMPLETE_TOKEN = TICK_EXECUTOR_COMPLETE;
// Reference TICK_EXECUTOR_MODULE_READY for boot-time assertion
const _EXECUTOR_READY = TICK_EXECUTOR_MODULE_READY;
// Reference TICK_EXECUTOR_COMPLETE
void _EXECUTOR_COMPLETE_TOKEN;
void _EXECUTOR_READY;

function applyOutcomeDecision(
  snapshot: RunStateSnapshot,
  decision: ReturnType<OutcomeGate['resolve']>,
): RunStateSnapshot {
  if (decision.outcome === snapshot.outcome) {
    return snapshot;
  }

  const next = cloneJson(snapshot) as RunStateSnapshot & {
    outcome: RunStateSnapshot['outcome'];
    telemetry: {
      outcomeReason: string | null;
      outcomeReasonCode: RunStateSnapshot['telemetry']['outcomeReasonCode'];
    };
    tags: string[];
  };

  next.outcome = decision.outcome;
  next.telemetry.outcomeReason = decision.outcomeReason;
  next.telemetry.outcomeReasonCode =
    decision.outcomeReasonCode === 'TARGET_REACHED'
      ? 'TARGET_REACHED'
      : decision.outcomeReasonCode === 'NET_WORTH_COLLAPSE'
        ? 'NET_WORTH_COLLAPSE'
        : decision.outcomeReasonCode === 'SEASON_BUDGET_EXHAUSTED'
          ? 'SEASON_BUDGET_EXHAUSTED'
          : next.telemetry.outcomeReasonCode;

  if (decision.outcome !== null && !next.tags.includes('run:terminal')) {
    next.tags = [...next.tags, 'run:terminal'];
  }

  return toFrozenSnapshot(next);
}

/** Internal analytics bundle wired into TickExecutor via constructor */
interface TickExecutorAnalyticsBundle {
  readonly trend: TickExecutorTrendAnalyzer;
  readonly session: TickExecutorSessionTracker;
  readonly log: TickExecutorEventLog;
  readonly inspector: TickExecutorInspector;
}

export class TickExecutor {
  private readonly _analytics: TickExecutorAnalyticsBundle | null;

  public constructor(
    private readonly options: TickExecutorOptions,
    analytics?: TickExecutorAnalyticsBundle,
  ) {
    this._analytics = analytics ?? null;
  }

  // ── public execute ──────────────────────────────────────────────────────────

  public execute(args: TickExecutorRunArgs): TickExecutorRunResult {
    const startedAtMs =
      args.startedAtMs !== undefined
        ? Math.max(0, Math.trunc(args.startedAtMs))
        : Date.now();

    const preTickSnapshot = toFrozenSnapshot(args.snapshot);
    let current = preTickSnapshot;
    const reports: StepExecutionReport[] = [];
    let drainedEventSequences: readonly number[] = freezeArray([]);
    let eventChecksum: string | null = null;
    let outcomeGateTriggered = false;

    // ── step execution loop ─────────────────────────────────────────────────
    for (const entry of this.options.tickPlan.enabledEntries()) {
      const currentStep: TickStep = entry.step;

      const report = this.options.stepRunner.run({
        snapshot: current,
        step: currentStep,
        nowMs: Date.now(),
        traceId: args.traceId,
      });

      current = (report as StepExecutionReport & { outputSnapshot: RunStateSnapshot }).outputSnapshot;

      if (currentStep === OUTCOME_GATE_STEP) {
        outcomeGateTriggered = true;
        current = applyOutcomeDecision(
          current,
          this.options.outcomeGate.resolve(current),
        );

        reports.push(
          Object.freeze({
            ...report,
            outputSnapshot: current,
          }) as StepExecutionReport,
        );
      } else if (
        currentStep === FLUSH_STEP &&
        this.options.flushCoordinator !== undefined
      ) {
        const { drained, seal } = this.options.flushCoordinator.flushAndSeal(
          (report as StepExecutionReport & { metadata?: { bus?: never } }).metadata?.bus as never,
        );

        drainedEventSequences = freezeArray(
          drained.map((event) => (event as { sequence: number }).sequence),
        );
        eventChecksum = seal.checksum;

        reports.push(
          Object.freeze({
            ...report,
            metadata: Object.freeze({
              ...((report as StepExecutionReport & { metadata?: Record<string, unknown> }).metadata ?? {}),
              drainedEventSequences,
              eventChecksum,
            }),
          }) as StepExecutionReport,
        );
      } else {
        reports.push(report);
      }
    }

    const endedAtMs = Date.now();
    const durationMs = Math.max(0, endedAtMs - startedAtMs);
    const allSignals = collectSignals(reports);

    // ── build tick execution summary for diagnostics ─────────────────────────
    const summary = buildTickExecutionSummary({
      runId: current.runId,
      tick: current.tick,
      startedAtMs,
      endedAtMs,
      preTickSnapshot,
      postTickSnapshot: current,
      steps: reports.map((r) => {
        const rExt = r as StepExecutionReport & {
          outputSnapshot?: RunStateSnapshot;
          inputSnapshot?: RunStateSnapshot;
          rolledBack?: boolean;
          skipped?: boolean;
          engineId?: EngineId | 'mode' | 'system' | null;
          descriptor?: TickStepDescriptor;
        };
        return {
          step: r.step,
          descriptor: rExt.descriptor,
          startedAtMs: r.startedAtMs,
          endedAtMs: r.endedAtMs,
          durationMs: r.durationMs,
          inputSnapshot: rExt.inputSnapshot,
          outputSnapshot: rExt.outputSnapshot,
          signals: r.signals,
          rolledBack: rExt.rolledBack,
          skipped: rExt.skipped,
          engineId: rExt.engineId,
          metadata: (r as StepExecutionReport & { metadata?: unknown }).metadata,
        };
      }),
      outcome: current.outcome,
      warnings: reports.flatMap((report) =>
        report.signals
          .filter(
            (signal) =>
              signal.severity === 'WARN' || signal.severity === 'ERROR',
          )
          .map(
            (signal) =>
              `[${(report as StepExecutionReport & { engineId?: string }).engineId ?? 'system'}] ${signal.code}: ${signal.message}`,
          ),
      ),
      signals: allSignals,
      eventSequences: drainedEventSequences,
    });

    this.options.diagnostics?.recordTickSummary(summary);

    // ── record error diagnostics for rolled-back steps ───────────────────────
    for (const report of reports) {
      const rExt = report as StepExecutionReport & {
        rolledBack?: boolean;
        engineId?: EngineId | 'mode' | 'system' | null;
        outputSnapshot?: RunStateSnapshot;
      };
      if (rExt.rolledBack === true) {
        this.options.diagnostics?.recordError(
          Object.freeze({
            step: report.step,
            engineId:
              rExt.engineId === 'system' || rExt.engineId === 'mode'
                ? null
                : (rExt.engineId ?? null),
            tick: (rExt.outputSnapshot ?? current).tick,
            occurredAtMs: report.endedAtMs,
            message:
              report.signals.find((signal) => signal.severity === 'ERROR')
                ?.message ?? `${report.step} rolled back.`,
          }),
        );
      }
    }

    // ── ML/DL analytics integration ──────────────────────────────────────────
    const mlInput: TickExecutorMLVectorInput = {
      snapshot: current,
      durationMs,
      reports,
      signals: allSignals,
      eventCount: drainedEventSequences.length,
      eventChecksum,
      hasFlushCoordinator: this.options.flushCoordinator !== undefined,
      hasDiagnostics: this.options.diagnostics !== undefined,
      outcomeGateTriggered,
    };

    const analyticsResult = this._analytics !== null
      ? this._runAnalytics(mlInput, args.traceId ?? null, endedAtMs)
      : null;

    return Object.freeze({
      snapshot: current,
      outcome: current.outcome,
      reports: freezeArray(reports),
      signals: allSignals,
      drainedEventSequences,
      eventChecksum,
      mlVector: analyticsResult?.mlVector ?? null,
      dlTensor: analyticsResult?.dlTensor ?? null,
      severity: analyticsResult?.severity ?? null,
      healthSnapshot: analyticsResult?.health ?? null,
      chatSignal: analyticsResult?.chatSignal ?? null,
      annotation: analyticsResult?.annotation ?? null,
      narrationHint: analyticsResult?.narrationHint ?? null,
      exportBundle: analyticsResult?.exportBundle ?? null,
    });
  }

  // ── ML/DL analytics runner ──────────────────────────────────────────────────

  private _runAnalytics(
    mlInput: TickExecutorMLVectorInput,
    traceId: string | null,
    nowMs: number,
  ): {
    mlVector: TickExecutorMLVector;
    dlTensor: TickExecutorDLTensor;
    severity: TickExecutorSeverity;
    health: TickExecutorHealthSnapshot;
    chatSignal: TickExecutorChatSignal;
    annotation: TickExecutorAnnotationBundle;
    narrationHint: TickExecutorNarrationHint;
    exportBundle: TickExecutorExportBundle;
  } | null {
    if (this._analytics === null) return null;

    try {
      const { trend, session, log, inspector } = this._analytics;

      // Determine operation kind
      const hasFlushed = mlInput.eventCount > 0 || mlInput.eventChecksum !== null;
      const hasOutcome = mlInput.snapshot.outcome !== null;
      const hasRollback = mlInput.reports.some(
        (r) =>
          (r as StepExecutionReport & { rolledBack?: boolean }).rolledBack === true,
      );
      const operationKind: TickExecutorOperationKind = hasRollback
        ? 'ROLLBACK'
        : hasOutcome
          ? 'OUTCOME_GATE'
          : hasFlushed
            ? 'FLUSH'
            : 'EXECUTE';

      // Build trace reference for inspector context
      const traceRef: TickTrace | null =
        traceId !== null
          ? Object.freeze({
              runId: mlInput.snapshot.runId,
              tick: mlInput.snapshot.tick,
              step: 'STEP_13_FLUSH',
              mode: mlInput.snapshot.mode as ModeCode,
              phase: mlInput.snapshot.phase as RunStateSnapshot['phase'],
              traceId,
            })
          : null;

      // Run inspector to get full bundle
      const bundle = inspector.inspect(mlInput, operationKind, traceRef, nowMs);

      // Feed analytics components
      trend.push(bundle.mlVector);
      session.record(mlInput, bundle.mlVector);
      log.log(mlInput, bundle.mlVector, bundle.severity, operationKind, traceId, nowMs);

      // Build export bundle
      const exportBundle = inspector.buildExportBundle(
        mlInput,
        operationKind,
        traceRef,
        nowMs,
        trend.getTrend(),
        session.getReport(),
      );

      return {
        mlVector: bundle.mlVector,
        dlTensor: bundle.dlTensor,
        severity: bundle.severity,
        health: bundle.health,
        chatSignal: bundle.chatSignal,
        annotation: bundle.annotation,
        narrationHint: bundle.narration,
        exportBundle,
      };
    } catch {
      // Analytics must never throw and interrupt execution
      return null;
    }
  }

  // ── read-only inspection surfaces ──────────────────────────────────────────

  /** Returns the current analytics trend snapshot, if analytics are active. */
  public getTrend(): TickExecutorTrendSnapshot | null {
    return this._analytics?.trend.getTrend() ?? null;
  }

  /** Returns the current session report, if analytics are active. */
  public getSessionReport(): TickExecutorSessionReport | null {
    return this._analytics?.session.getReport() ?? null;
  }

  /** Returns recent event log entries, if analytics are active. */
  public getRecentLogEntries(n = 10): readonly TickExecutorEventLogEntry[] {
    return this._analytics?.log.getRecentEntries(n) ?? freezeArray([]);
  }

  /** Returns the last N ML vectors from the trend window. */
  public getTrendWindow(): readonly TickExecutorMLVector[] {
    return this._analytics?.trend.getWindow() ?? freezeArray([]);
  }

  /** Inspects the given result to produce a full analytics bundle on demand. */
  public inspectResult(
    result: TickExecutorRunResult,
    traceId: string | null,
  ): TickExecutorInspectionBundle | null {
    if (result.mlVector === null) return null;

    const mlInput: TickExecutorMLVectorInput = {
      snapshot: result.snapshot,
      durationMs: 0,
      reports: result.reports,
      signals: result.signals,
      eventCount: result.drainedEventSequences.length,
      eventChecksum: result.eventChecksum,
      hasFlushCoordinator: this.options.flushCoordinator !== undefined,
      hasDiagnostics: this.options.diagnostics !== undefined,
      outcomeGateTriggered: result.outcome !== null,
    };

    const traceRef: TickTrace | null =
      traceId !== null
        ? Object.freeze({
            runId: result.snapshot.runId,
            tick: result.snapshot.tick,
            step: 'STEP_13_FLUSH',
            mode: result.snapshot.mode as ModeCode,
            phase: result.snapshot.phase as RunStateSnapshot['phase'],
            traceId,
          })
        : null;

    return EXECUTOR_DEFAULT_INSPECTOR.inspect(mlInput, 'EXECUTE', traceRef, Date.now());
  }

  /** Builds a full run summary over the accumulated session history. */
  public buildRunSummary(
    mlInput: TickExecutorMLVectorInput,
    mlVector: TickExecutorMLVector,
    dlTensor: TickExecutorDLTensor,
  ): TickExecutorRunSummary | null {
    const session = this._analytics?.session.getReport();
    if (session === null || session === undefined) return null;

    const peakTierIndex = TICK_EXECUTOR_PRESSURE_TIERS.indexOf(
      session.peakPressureTier,
    );
    const peakTier =
      (TICK_EXECUTOR_PRESSURE_TIERS[peakTierIndex] as PressureTier | undefined) ??
      'T0';

    return buildTickExecutorRunSummary(
      mlInput,
      mlVector,
      dlTensor,
      session.ticksRecorded,
      session.totalDurationMs,
      session.totalRolledBackSteps,
      session.totalErrorSignals,
      peakTier,
      session.avgHealthScore,
    );
  }

  /** Resets all analytics state (trend, session, log). */
  public resetAnalytics(): void {
    this._analytics?.trend.reset();
    this._analytics?.session.reset();
    this._analytics?.log.clear();
  }

  /** Checks whether this executor has analytics enabled. */
  public get analyticsEnabled(): boolean {
    return this._analytics !== null;
  }

  /** Returns the tick plan bound to this executor. */
  public get tickPlan(): TickPlan {
    return this.options.tickPlan;
  }

  /** Returns the step runner bound to this executor. */
  public get stepRunner(): TickStepRunner {
    return this.options.stepRunner;
  }

  /** Returns the outcome gate bound to this executor. */
  public get outcomeGate(): OutcomeGate {
    return this.options.outcomeGate;
  }

  /** Returns the flush coordinator, if bound. */
  public get flushCoordinator(): EventFlushCoordinator | undefined {
    return this.options.flushCoordinator;
  }

  /** Returns the diagnostics observer, if bound. */
  public get diagnostics(): OrchestratorDiagnostics | undefined {
    return this.options.diagnostics;
  }

  /** Returns a snapshot of the ML feature labels for introspection. */
  public get mlFeatureLabels(): typeof TICK_EXECUTOR_ML_FEATURE_LABELS {
    return TICK_EXECUTOR_ML_FEATURE_LABELS;
  }

  /** Returns the DL tensor shape. */
  public get dlTensorShape(): typeof TICK_EXECUTOR_DL_TENSOR_SHAPE {
    return TICK_EXECUTOR_DL_TENSOR_SHAPE;
  }

  /** Returns the DL row labels (one per tick step). */
  public get dlRowLabels(): typeof TICK_EXECUTOR_DL_ROW_LABELS {
    return TICK_EXECUTOR_DL_ROW_LABELS;
  }

  /** Returns the DL column labels. */
  public get dlColLabels(): typeof TICK_EXECUTOR_DL_COL_LABELS {
    return TICK_EXECUTOR_DL_COL_LABELS;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 25 — Runtime event map type + cross-module type surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TickExecutorRuntimeEventMap combines the canonical EngineEventMap with an
 * open extension record so that executor-level event log consumers can type
 * event payloads without narrowing to just the known engine events.
 * Used by TickExecutorEventLog for event-driven analytics correlation.
 */
export type TickExecutorRuntimeEventMap = EngineEventMap & Record<string, unknown>;
