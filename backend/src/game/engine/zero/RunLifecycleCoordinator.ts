/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunLifecycleCoordinator.ts
 *
 * Purpose:
 * - authoritative lifecycle facade over EngineOrchestrator
 * - keep external callers out of direct engine wiring
 * - expose deterministic run start / play / action / tick / drain operations
 * - ML/DL feature extraction from lifecycle coordinator state
 * - DL tensor construction from lifecycle operation flow
 * - chat signal routing for lifecycle events
 * - trend analysis, session tracking, event logging, annotation, inspection
 * - UX narration, health scoring, severity classification
 * - all analytics focused on user experience quality and engagement
 *
 * Engine 0 Doctrine:
 * - every operation is traceable, deterministic, and replay-safe
 * - the chat system is an emotional operating system — lifecycle events feed it
 * - audience heat, rescue signals, relationship depth, and presence theater
 *   are all driven by lifecycle state transitions
 * - ML vectors enable real-time adaptive commentary
 * - DL tensors enable offline training and session quality prediction
 * - the lifecycle coordinator is the single authoritative surface for run control
 */

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 1 — GAME PRIMITIVE TYPE IMPORTS
// ──────────────────────────────────────────────────────────────────────────────

import type {
  AttackCategory,
  BotState,
  CardRarity,
  Counterability,
  DeckType,
  DivergencePotential,
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

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 2 — GAME PRIMITIVE CONSTANT IMPORTS
// ──────────────────────────────────────────────────────────────────────────────

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
} from '../core/GamePrimitives';

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 3 — SNAPSHOT IMPORT
// ──────────────────────────────────────────────────────────────────────────────

import type { RunStateSnapshot } from '../core/RunStateSnapshot';

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 4 — DETERMINISTIC PRIMITIVE IMPORTS
// ──────────────────────────────────────────────────────────────────────────────

import {
  checksumSnapshot,
  cloneJson,
  computeTickSeal,
  createDeterministicId,
  stableStringify,
} from '../core/Deterministic';

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 5 — MODE CONTRACT IMPORTS
// ──────────────────────────────────────────────────────────────────────────────

import type {
  ModeActionId,
  ModeConfigureOptions,
  SoloAdvantageId,
  SoloHandicapId,
  TeamRoleId,
} from '../modes/ModeContracts';

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 6 — ENGINE ORCHESTRATOR IMPORTS
// ──────────────────────────────────────────────────────────────────────────────

import {
  EngineOrchestrator,
  type ModeActionInput,
  type OrchestratorLifecycle,
  type PlayCardInput,
  type StartRunInput,
  type TickExecutionSummary,
} from './EngineOrchestrator';

// ══════════════════════════════════════════════════════════════════════════════
// PART A — COORDINATOR INPUT / OUTPUT CONTRACTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Structured start-run input for the lifecycle coordinator.
 * Accepts both legacy userId-string form and this richer object.
 */
export interface CoordinatorStartInput {
  readonly userId: string;
  readonly mode: ModeCode;
  readonly seed?: string;
  readonly runId?: string;
  readonly communityHeatModifier?: number;
  readonly tags?: readonly string[];
  readonly modeOptions?: ModeConfigureOptions;
  readonly forceProofFinalizeOnTerminal?: boolean;
}

/** Options for a multi-tick advance. */
export interface CoordinatorTickOptions {
  readonly count?: number;
  readonly stopOnTerminal?: boolean;
}

/** Options for a full run-until-done sweep. */
export interface CoordinatorRunUntilDoneOptions {
  readonly maxTicks?: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART B — ANALYTICS UNION TYPES + TYPE GUARDS
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 7 — LIFECYCLE SEVERITY
// ──────────────────────────────────────────────────────────────────────────────

/** Severity classification for lifecycle health signals. */
export type LifecycleSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const LIFECYCLE_SEVERITY_LEVELS: readonly LifecycleSeverity[] = [
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL',
] as const;

/** Health score thresholds at which each severity level activates. */
export const LIFECYCLE_SEVERITY_THRESHOLDS: Record<LifecycleSeverity, number> = {
  LOW:      0.25,
  MEDIUM:   0.50,
  HIGH:     0.75,
  CRITICAL: 0.90,
};

/** Type guard for LifecycleSeverity. */
export function isLifecycleSeverity(value: unknown): value is LifecycleSeverity {
  return (
    typeof value === 'string' &&
    (LIFECYCLE_SEVERITY_LEVELS as readonly string[]).includes(value)
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 8 — LIFECYCLE OPERATION KIND
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Canonical set of operations the lifecycle coordinator can perform.
 * Drives operation-kind entropy features in ML vector.
 */
export type LifecycleOperationKind =
  | 'START'
  | 'PLAY'
  | 'ACTION'
  | 'TICK'
  | 'RUN_UNTIL_DONE'
  | 'GET_SNAPSHOT'
  | 'GET_LIFECYCLE'
  | 'GET_FLUSH_COUNT'
  | 'GET_QUEUED_EVENT_COUNT'
  | 'GET_TICK_HISTORY'
  | 'RESET';

export const LIFECYCLE_OPERATION_KINDS: readonly LifecycleOperationKind[] = [
  'START',
  'PLAY',
  'ACTION',
  'TICK',
  'RUN_UNTIL_DONE',
  'GET_SNAPSHOT',
  'GET_LIFECYCLE',
  'GET_FLUSH_COUNT',
  'GET_QUEUED_EVENT_COUNT',
  'GET_TICK_HISTORY',
  'RESET',
] as const;

/** Integer encoding of each operation kind — used in DL tensor rows. */
export const LIFECYCLE_OPERATION_KIND_ENCODED: Record<LifecycleOperationKind, number> = {
  START:                   1,
  PLAY:                    2,
  ACTION:                  3,
  TICK:                    4,
  RUN_UNTIL_DONE:          5,
  GET_SNAPSHOT:            6,
  GET_LIFECYCLE:           7,
  GET_FLUSH_COUNT:         8,
  GET_QUEUED_EVENT_COUNT:  9,
  GET_TICK_HISTORY:        10,
  RESET:                   11,
};

/** Type guard for LifecycleOperationKind. */
export function isLifecycleOperationKind(value: unknown): value is LifecycleOperationKind {
  return (
    typeof value === 'string' &&
    (LIFECYCLE_OPERATION_KINDS as readonly string[]).includes(value)
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART C — ML / DL VECTOR TYPES
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 9 — ML FEATURE VECTOR (32-dim)
// ──────────────────────────────────────────────────────────────────────────────

/** Total number of ML features in the lifecycle coordinator vector. */
export const LIFECYCLE_ML_FEATURE_COUNT = 32 as const;

/** Canonical label set for the 32-dim ML feature vector. */
export const LIFECYCLE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'modeNormalized',           //  0 — mode code 0-1 scale
  'lifecycleStateOrdinal',    //  1 — IDLE=0 … FINALIZED=1
  'phaseNormalized',          //  2 — FOUNDATION=0, ESCALATION=0.5, SOVEREIGNTY=1
  'pressureTierNormalized',   //  3 — T0=0 … T4=1
  'tickCountNorm',            //  4 — tick count / 500
  'tickEfficiencyNorm',       //  5 — ticks / total operations
  'operationCountNorm',       //  6 — total ops / 100
  'playCardRatioNorm',        //  7 — card plays / total ops
  'actionRatioNorm',          //  8 — mode actions / total ops
  'queuedEventCountNorm',     //  9 — queued events / 100
  'lastFlushCountNorm',       // 10 — last flush / 50
  'tickHistoryDepthNorm',     // 11 — tick history depth / 100
  'terminalFlag',             // 12 — 0 or 1
  'outcomeNormalized',        // 13 — null=0, FREEDOM=0.25, TIMEOUT=0.5, BANKRUPT=0.75, ABANDONED=1
  'modeDifficultyNorm',       // 14 — difficulty multiplier / 2.0
  'modeTensionFloor',         // 15 — tension floor (0-1)
  'phaseStakesMultiplier',    // 16 — stakes multiplier (0-1)
  'phaseTickBudgetFraction',  // 17 — tick budget fraction (0-1)
  'pressureEscalationNorm',   // 18 — escalation threshold / 100
  'shieldWeightTotalNorm',    // 19 — sum of shield weights / 4
  'botThreatScoreNorm',       // 20 — max bot threat / 1.0
  'avgTickDurationNorm',      // 21 — avg tick duration ms / 1000
  'sessionDurationNorm',      // 22 — session duration s / 3600
  'startInputComplexity',     // 23 — complexity of start input (0-1)
  'lifecycleTransitionNorm',  // 24 — lifecycle transition count / 10
  'resetCountNorm',           // 25 — reset count / 10
  'healthScore',              // 26 — composite health score (0-1)
  'timingPriorityAvg',        // 27 — avg timing class window priority / 100
  'deckPowerAvg',             // 28 — avg deck type power level (0-1)
  'operationKindEntropyNorm', // 29 — operation kind entropy / log2(11)
  'modeMaxDivergenceNorm',    // 30 — mode max divergence potential normalized
  'pressureMinHoldNorm',      // 31 — pressure tier min hold ticks / 3
]);

/** Typed 32-dim ML feature vector for lifecycle coordinator analytics. */
export interface LifecycleMLVector {
  readonly modeNormalized: number;
  readonly lifecycleStateOrdinal: number;
  readonly phaseNormalized: number;
  readonly pressureTierNormalized: number;
  readonly tickCountNorm: number;
  readonly tickEfficiencyNorm: number;
  readonly operationCountNorm: number;
  readonly playCardRatioNorm: number;
  readonly actionRatioNorm: number;
  readonly queuedEventCountNorm: number;
  readonly lastFlushCountNorm: number;
  readonly tickHistoryDepthNorm: number;
  readonly terminalFlag: number;
  readonly outcomeNormalized: number;
  readonly modeDifficultyNorm: number;
  readonly modeTensionFloor: number;
  readonly phaseStakesMultiplier: number;
  readonly phaseTickBudgetFraction: number;
  readonly pressureEscalationNorm: number;
  readonly shieldWeightTotalNorm: number;
  readonly botThreatScoreNorm: number;
  readonly avgTickDurationNorm: number;
  readonly sessionDurationNorm: number;
  readonly startInputComplexity: number;
  readonly lifecycleTransitionNorm: number;
  readonly resetCountNorm: number;
  readonly healthScore: number;
  readonly timingPriorityAvg: number;
  readonly deckPowerAvg: number;
  readonly operationKindEntropyNorm: number;
  readonly modeMaxDivergenceNorm: number;
  readonly pressureMinHoldNorm: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 10 — DL TENSOR TYPES (6 × 6)
// ──────────────────────────────────────────────────────────────────────────────

/** Shape of the lifecycle coordinator DL tensor: 6 rows × 6 features. */
export const LIFECYCLE_DL_TENSOR_SHAPE: readonly [number, number] = [6, 6] as const;

/** Row dimension labels for the lifecycle coordinator DL tensor. */
export const LIFECYCLE_DL_ROW_LABELS: readonly string[] = Object.freeze([
  'MODE_PROFILE',
  'PRESSURE_PROFILE',
  'SHIELD_PROFILE',
  'TIMING_PROFILE',
  'OPERATION_FLOW',
  'HEALTH_COMPOSITE',
]);

/** Column dimension labels — generic feature slots per row. */
export const LIFECYCLE_DL_COL_LABELS: readonly string[] = Object.freeze([
  'f0', 'f1', 'f2', 'f3', 'f4', 'f5',
]);

/** One row in the lifecycle coordinator DL tensor. */
export interface LifecycleDLTensorRow {
  readonly label: string;
  readonly f0: number;
  readonly f1: number;
  readonly f2: number;
  readonly f3: number;
  readonly f4: number;
  readonly f5: number;
}

/** Full 6×6 DL tensor with shape metadata and integrity checksum. */
export interface LifecycleDLTensor {
  readonly shape: readonly [number, number];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly rows: readonly LifecycleDLTensorRow[];
  readonly checksum: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART D — CHAT SIGNAL + ANNOTATION TYPES
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 11 — CHAT SIGNAL
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle chat signal — emitted after each significant coordinator operation.
 * Drives companion commentary, audience heat adjustment, and rescue routing.
 */
export interface LifecycleChatSignal {
  readonly kind: 'LIFECYCLE_SIGNAL';
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly lifecycleState: OrchestratorLifecycle;
  readonly operation: LifecycleOperationKind;
  readonly severity: LifecycleSeverity;
  readonly healthScore: number;
  readonly phase: RunPhase | null;
  readonly pressureTier: PressureTier | null;
  readonly outcome: RunOutcome | null;
  readonly tick: number;
  readonly tickCount: number;
  readonly actionRecommendation: string;
  readonly narrationKey: string;
  readonly urgencyLabel: string;
  readonly sessionDurationMs: number;
  readonly isTerminal: boolean;
  readonly mlVector: LifecycleMLVector;
  readonly timestampMs: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 12 — ANNOTATION BUNDLE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Rich annotation bundle for a lifecycle event.
 * Aggregates domain signals for downstream chat routing and ML training.
 */
export interface LifecycleAnnotationBundle {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly operation: LifecycleOperationKind;
  readonly severity: LifecycleSeverity;
  readonly healthScore: number;
  readonly phase: RunPhase | null;
  readonly pressureTier: PressureTier | null;
  readonly outcome: RunOutcome | null;
  readonly isTerminal: boolean;
  readonly integrityFlag: IntegrityStatus;
  readonly activeAttackCategories: readonly AttackCategory[];
  readonly botThreatSummary: string;
  readonly primaryNarration: string;
  readonly secondaryNarration: string;
  readonly actionRecommendation: string;
  readonly engagementScore: number;
  readonly rescueEligible: boolean;
  readonly cascadeRisk: boolean;
  readonly timestampMs: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 13 — NARRATION HINT
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Narration hint for the chat system.
 * Provides UX copy keys, urgency labels, and audience engagement deltas
 * driven by the current lifecycle state.
 */
export interface LifecycleNarrationHint {
  readonly runId: string;
  readonly operation: LifecycleOperationKind;
  readonly mode: ModeCode;
  readonly phase: RunPhase | null;
  readonly severity: LifecycleSeverity;
  readonly primaryKey: string;
  readonly secondaryKey: string;
  readonly urgencyLabel: string;
  readonly modeLabel: string;
  readonly phaseLabel: string;
  readonly pressureLabel: string;
  readonly botThreatLabel: string;
  readonly outcomeLabel: string | null;
  readonly chatPrompt: string;
  readonly audienceHeatDelta: number;
  readonly rescueTrigger: boolean;
  readonly presenceTheatre: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART E — TREND / SESSION / EVENT LOG / INSPECTION / SUMMARY TYPES
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 14 — TREND SNAPSHOT
// ──────────────────────────────────────────────────────────────────────────────

/** Sliding-window trend analysis over recent lifecycle operations. */
export interface LifecycleTrendSnapshot {
  readonly sessionId: string;
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly healthScoreDelta: number;
  readonly avgTickDurationMs: number;
  readonly operationRatePerMinute: number;
  readonly playCardRate: number;
  readonly modeActionRate: number;
  readonly tickRate: number;
  readonly resetRate: number;
  readonly terminalRate: number;
  readonly avgPressureTierNorm: number;
  readonly avgSeverityNorm: number;
  readonly engagementTrend: 'RISING' | 'STABLE' | 'FALLING';
  readonly rescueEligibilityRate: number;
  readonly cascadeRiskRate: number;
  readonly dominantOperation: LifecycleOperationKind;
  readonly totalOperations: number;
  readonly snapshotMs: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 15 — SESSION REPORT
// ──────────────────────────────────────────────────────────────────────────────

/** Full session report capturing the lifecycle coordinator's run history. */
export interface LifecycleSessionReport {
  readonly sessionId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly totalOperations: number;
  readonly totalTicks: number;
  readonly totalCardPlays: number;
  readonly totalModeActions: number;
  readonly totalResets: number;
  readonly finalLifecycleState: OrchestratorLifecycle;
  readonly finalPhase: RunPhase | null;
  readonly finalPressureTier: PressureTier | null;
  readonly finalOutcome: RunOutcome | null;
  readonly finalHealthScore: number;
  readonly finalSeverity: LifecycleSeverity;
  readonly peakHealthScore: number;
  readonly lowestHealthScore: number;
  readonly avgHealthScore: number;
  readonly terminalReached: boolean;
  readonly startInput: CoordinatorStartInput | null;
  readonly mlVector: LifecycleMLVector | null;
  readonly trend: LifecycleTrendSnapshot | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 16 — EVENT LOG ENTRY
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Immutable record of a single lifecycle coordinator operation.
 * Includes tick seal for tamper-evident audit trails.
 */
export interface LifecycleEventLogEntry {
  readonly entryId: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly tick: number;
  readonly timestampMs: number;
  readonly operation: LifecycleOperationKind;
  readonly lifecycleState: OrchestratorLifecycle;
  readonly phase: RunPhase | null;
  readonly pressureTier: PressureTier | null;
  readonly outcome: RunOutcome | null;
  readonly playCardInput: PlayCardInput | null;
  readonly modeActionInput: ModeActionInput | null;
  readonly actionId: ModeActionId | null;
  readonly targeting: Targeting | null;
  readonly severity: LifecycleSeverity;
  readonly healthScore: number;
  readonly tickSeal: string;
  readonly snapshotChecksum: string;
  readonly queuedEvents: number;
  readonly lastFlushCount: number;
  readonly durationMs: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 17 — INSPECTION BUNDLE
// ──────────────────────────────────────────────────────────────────────────────

/** Deep inspection report for lifecycle coordinator health diagnostics. */
export interface LifecycleInspectionBundle {
  readonly sessionId: string;
  readonly runId: string;
  readonly inspectedAtMs: number;
  readonly lifecycleState: OrchestratorLifecycle;
  readonly totalEntries: number;
  readonly operationBreakdown: Record<LifecycleOperationKind, number>;
  readonly severityBreakdown: Record<LifecycleSeverity, number>;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly healthScoreStdDev: number;
  readonly avgTickDurationMs: number;
  readonly avgQueuedEvents: number;
  readonly avgFlushCount: number;
  readonly terminalReached: boolean;
  readonly finalOutcome: RunOutcome | null;
  readonly recommendations: readonly string[];
  readonly mlVector: LifecycleMLVector | null;
  readonly dlTensor: LifecycleDLTensor | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 18 — RUN SUMMARY
// ──────────────────────────────────────────────────────────────────────────────

/** End-of-run summary with full analytics bundle. */
export interface LifecycleRunSummary {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly durationMs: number;
  readonly totalTicks: number;
  readonly totalCardPlays: number;
  readonly totalModeActions: number;
  readonly outcome: RunOutcome | null;
  readonly finalPhase: RunPhase | null;
  readonly finalPressureTier: PressureTier | null;
  readonly finalHealthScore: number;
  readonly finalSeverity: LifecycleSeverity;
  readonly peakHealthScore: number;
  readonly avgHealthScore: number;
  readonly engagementScore: number;
  readonly rescueMoments: number;
  readonly cascadeEvents: number;
  readonly verifiedGrade: VerifiedGrade;
  readonly mlVector: LifecycleMLVector;
  readonly chatSignal: LifecycleChatSignal;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 19 — HEALTH SNAPSHOT
// ──────────────────────────────────────────────────────────────────────────────

/** Point-in-time health snapshot for a lifecycle coordinator session. */
export interface LifecycleHealthSnapshot {
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly timestampMs: number;
  readonly healthScore: number;
  readonly severity: LifecycleSeverity;
  readonly lifecycleState: OrchestratorLifecycle;
  readonly phase: RunPhase | null;
  readonly pressureTier: PressureTier | null;
  readonly outcome: RunOutcome | null;
  readonly botThreatScore: number;
  readonly shieldWeightTotal: number;
  readonly tickEfficiency: number;
  readonly operationBalance: number;
  readonly sessionQuality: number;
  readonly engagementScore: number;
  readonly rescueEligible: boolean;
  readonly cascadeRisk: boolean;
  readonly visibilityLevel: VisibilityLevel;
  readonly botStateDistribution: Partial<Record<BotState, number>>;
  readonly activeShieldLayers: readonly ShieldLayerId[];
  readonly dominantDeckType: DeckType | null;
  readonly primaryTimingClass: TimingClass | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 20 — EXPORT BUNDLE
// ──────────────────────────────────────────────────────────────────────────────

/** Complete analytics export bundle for offline training and audit. */
export interface LifecycleExportBundle {
  readonly exportId: string;
  readonly sessionId: string;
  readonly exportedAtMs: number;
  readonly sessionReport: LifecycleSessionReport;
  readonly inspectionBundle: LifecycleInspectionBundle;
  readonly runSummary: LifecycleRunSummary | null;
  readonly healthSnapshot: LifecycleHealthSnapshot;
  readonly trend: LifecycleTrendSnapshot;
  readonly recentEvents: readonly LifecycleEventLogEntry[];
  readonly mlVector: LifecycleMLVector;
  readonly dlTensor: LifecycleDLTensor;
  readonly chatSignal: LifecycleChatSignal;
  readonly annotation: LifecycleAnnotationBundle;
  readonly narrationHint: LifecycleNarrationHint;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 21 — FACTORY INPUT TYPES
// ──────────────────────────────────────────────────────────────────────────────

/** Dependencies for constructing a RunLifecycleCoordinatorWithAnalytics bundle. */
export interface RunLifecycleCoordinatorDependencies {
  readonly orchestrator?: EngineOrchestrator;
  readonly sessionId?: string;
}

/** Full analytics bundle returned by createRunLifecycleCoordinatorWithAnalytics. */
export interface RunLifecycleCoordinatorWithAnalytics {
  readonly coordinator: RunLifecycleCoordinator;
  readonly trendAnalyzer: LifecycleCoordinatorTrendAnalyzer;
  readonly sessionTracker: LifecycleCoordinatorSessionTracker;
  readonly eventLog: LifecycleCoordinatorEventLog;
  readonly annotator: LifecycleCoordinatorAnnotator;
  readonly inspector: LifecycleCoordinatorInspector;
  readonly sessionId: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART F — MODULE CONSTANTS + GAMEPRIMITIVE RE-EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 22 — MODULE METADATA
// ──────────────────────────────────────────────────────────────────────────────

export const LIFECYCLE_MODULE_VERSION = '1.0.0' as const;
export const LIFECYCLE_MODULE_READY = true as const;
export const LIFECYCLE_SCHEMA_VERSION = 'lifecycle-v1' as const;
export const LIFECYCLE_COMPLETE = 'LIFECYCLE_COMPLETE' as const;
export const LIFECYCLE_MAX_BOT_THREAT_SCORE = 1.0 as const;

/** Sum of all shield layer capacity weights (used in normalization). */
export const LIFECYCLE_TOTAL_SHIELD_CAPACITY_WEIGHT: number =
  Object.values(SHIELD_LAYER_CAPACITY_WEIGHT).reduce((a, b) => a + b, 0);

/** Mode narration strings mapping mode codes to player-facing labels. */
export const LIFECYCLE_MODE_NARRATION: Record<ModeCode, string> = {
  solo:  'Empire — Going Alone',
  pvp:   'Predator — Head to Head',
  coop:  'Syndicate — Team Up',
  ghost: 'Phantom — Chase a Legend',
};

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 23 — ALL_* SENTINEL ARRAYS
// ──────────────────────────────────────────────────────────────────────────────

export const LIFECYCLE_ALL_MODE_CODES:         readonly ModeCode[]         = MODE_CODES;
export const LIFECYCLE_ALL_PRESSURE_TIERS:     readonly PressureTier[]     = PRESSURE_TIERS;
export const LIFECYCLE_ALL_RUN_PHASES:         readonly RunPhase[]         = RUN_PHASES;
export const LIFECYCLE_ALL_RUN_OUTCOMES:       readonly RunOutcome[]       = RUN_OUTCOMES;
export const LIFECYCLE_ALL_SHIELD_LAYER_IDS:   readonly ShieldLayerId[]    = SHIELD_LAYER_IDS;
export const LIFECYCLE_ALL_HATER_BOT_IDS:      readonly HaterBotId[]       = HATER_BOT_IDS;
export const LIFECYCLE_ALL_TIMING_CLASSES:     readonly TimingClass[]      = TIMING_CLASSES;
export const LIFECYCLE_ALL_DECK_TYPES:         readonly DeckType[]         = DECK_TYPES;
export const LIFECYCLE_ALL_INTEGRITY_STATUSES: readonly IntegrityStatus[]  = INTEGRITY_STATUSES;
export const LIFECYCLE_ALL_VERIFIED_GRADES:    readonly VerifiedGrade[]    = VERIFIED_GRADES;

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 24 — GAMEPRIMITIVE RE-EXPORT TABLES
// ──────────────────────────────────────────────────────────────────────────────

export const LIFECYCLE_PRESSURE_TIER_NORMALIZED              = PRESSURE_TIER_NORMALIZED;
export const LIFECYCLE_PRESSURE_TIER_URGENCY_LABEL           = PRESSURE_TIER_URGENCY_LABEL;
export const LIFECYCLE_PRESSURE_TIER_MIN_HOLD_TICKS          = PRESSURE_TIER_MIN_HOLD_TICKS;
export const LIFECYCLE_PRESSURE_TIER_ESCALATION_THRESHOLD    = PRESSURE_TIER_ESCALATION_THRESHOLD;
export const LIFECYCLE_PRESSURE_TIER_DEESCALATION_THRESHOLD  = PRESSURE_TIER_DEESCALATION_THRESHOLD;

export const LIFECYCLE_RUN_PHASE_NORMALIZED          = RUN_PHASE_NORMALIZED;
export const LIFECYCLE_RUN_PHASE_STAKES_MULTIPLIER   = RUN_PHASE_STAKES_MULTIPLIER;
export const LIFECYCLE_RUN_PHASE_TICK_BUDGET_FRACTION = RUN_PHASE_TICK_BUDGET_FRACTION;

export const LIFECYCLE_MODE_NORMALIZED            = MODE_NORMALIZED;
export const LIFECYCLE_MODE_DIFFICULTY_MULTIPLIER = MODE_DIFFICULTY_MULTIPLIER;
export const LIFECYCLE_MODE_TENSION_FLOOR         = MODE_TENSION_FLOOR;
export const LIFECYCLE_MODE_MAX_DIVERGENCE        = MODE_MAX_DIVERGENCE;

export const LIFECYCLE_SHIELD_ABSORPTION_ORDER       = SHIELD_LAYER_ABSORPTION_ORDER;
export const LIFECYCLE_SHIELD_LAYER_CAPACITY_WEIGHT  = SHIELD_LAYER_CAPACITY_WEIGHT;
export const LIFECYCLE_SHIELD_LAYER_LABEL_BY_ID      = SHIELD_LAYER_LABEL_BY_ID;

export const LIFECYCLE_TIMING_CLASS_WINDOW_PRIORITY  = TIMING_CLASS_WINDOW_PRIORITY;
export const LIFECYCLE_TIMING_CLASS_URGENCY_DECAY    = TIMING_CLASS_URGENCY_DECAY;

export const LIFECYCLE_BOT_STATE_ALLOWED_TRANSITIONS = BOT_STATE_ALLOWED_TRANSITIONS;
export const LIFECYCLE_BOT_STATE_THREAT_MULTIPLIER   = BOT_STATE_THREAT_MULTIPLIER;
export const LIFECYCLE_BOT_THREAT_LEVEL              = BOT_THREAT_LEVEL;

export const LIFECYCLE_DECK_TYPE_IS_OFFENSIVE  = DECK_TYPE_IS_OFFENSIVE;
export const LIFECYCLE_DECK_TYPE_POWER_LEVEL   = DECK_TYPE_POWER_LEVEL;

export const LIFECYCLE_CARD_RARITY_WEIGHT              = CARD_RARITY_WEIGHT;
export const LIFECYCLE_ATTACK_CATEGORY_BASE_MAGNITUDE  = ATTACK_CATEGORY_BASE_MAGNITUDE;
export const LIFECYCLE_ATTACK_CATEGORY_IS_COUNTERABLE  = ATTACK_CATEGORY_IS_COUNTERABLE;
export const LIFECYCLE_COUNTERABILITY_RESISTANCE_SCORE = COUNTERABILITY_RESISTANCE_SCORE;
export const LIFECYCLE_TARGETING_SPREAD_FACTOR         = TARGETING_SPREAD_FACTOR;
export const LIFECYCLE_DIVERGENCE_POTENTIAL_NORMALIZED = DIVERGENCE_POTENTIAL_NORMALIZED;
export const LIFECYCLE_VISIBILITY_CONCEALMENT_FACTOR   = VISIBILITY_CONCEALMENT_FACTOR;
export const LIFECYCLE_INTEGRITY_STATUS_RISK_SCORE     = INTEGRITY_STATUS_RISK_SCORE;
export const LIFECYCLE_VERIFIED_GRADE_NUMERIC_SCORE    = VERIFIED_GRADE_NUMERIC_SCORE;

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 25 — DERIVED AGGREGATE CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

/** Average timing class window priority across all classes (normalized 0-1). */
export const LIFECYCLE_TIMING_PRIORITY_AVG: number =
  Object.values(TIMING_CLASS_WINDOW_PRIORITY).reduce((a, b) => a + b, 0) /
  TIMING_CLASSES.length /
  100;

/** Average deck type power level across all 14 deck types. */
export const LIFECYCLE_DECK_POWER_AVG: number =
  Object.values(DECK_TYPE_POWER_LEVEL).reduce((a, b) => a + b, 0) / DECK_TYPES.length;

/** Average card rarity weight across all 4 rarity tiers. */
export const LIFECYCLE_CARD_RARITY_WEIGHT_AVG: number = (() => {
  const vals = Object.values(CARD_RARITY_WEIGHT);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
})();

/** Average counterability resistance score across all counterability levels. */
export const LIFECYCLE_COUNTERABILITY_AVG: number = (() => {
  const vals = Object.values(COUNTERABILITY_RESISTANCE_SCORE);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
})();

/** Average visibility concealment factor across all visibility levels. */
export const LIFECYCLE_VISIBILITY_CONCEALMENT_AVG: number = (() => {
  const vals = Object.values(VISIBILITY_CONCEALMENT_FACTOR);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
})();

/** Average integrity risk score across all integrity statuses. */
export const LIFECYCLE_INTEGRITY_RISK_AVG: number = (() => {
  const vals = Object.values(INTEGRITY_STATUS_RISK_SCORE);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
})();

/** Average verified grade numeric score across all grades. */
export const LIFECYCLE_VERIFIED_GRADE_AVG: number = (() => {
  const vals = Object.values(VERIFIED_GRADE_NUMERIC_SCORE);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
})();

/** Average attack category base magnitude across all categories. */
export const LIFECYCLE_ATTACK_MAGNITUDE_AVG: number = (() => {
  const vals = Object.values(ATTACK_CATEGORY_BASE_MAGNITUDE);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
})();

/** Average targeting spread factor across all targeting types. */
export const LIFECYCLE_TARGETING_SPREAD_AVG: number = (() => {
  const vals = Object.values(TARGETING_SPREAD_FACTOR);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
})();

/** Maximum bot threat level (BOT_05 = 1.0). */
export const LIFECYCLE_BOT_THREAT_MAX: number = Math.max(...Object.values(BOT_THREAT_LEVEL));

// ══════════════════════════════════════════════════════════════════════════════
// PART G — DEFAULT VALUES
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 26 — DEFAULT ML VECTOR
// ──────────────────────────────────────────────────────────────────────────────

/** Zero-value ML vector for initialization and fallback. */
export const ZERO_DEFAULT_LIFECYCLE_ML_VECTOR: LifecycleMLVector = Object.freeze({
  modeNormalized:           0,
  lifecycleStateOrdinal:    0,
  phaseNormalized:          0,
  pressureTierNormalized:   0,
  tickCountNorm:            0,
  tickEfficiencyNorm:       0,
  operationCountNorm:       0,
  playCardRatioNorm:        0,
  actionRatioNorm:          0,
  queuedEventCountNorm:     0,
  lastFlushCountNorm:       0,
  tickHistoryDepthNorm:     0,
  terminalFlag:             0,
  outcomeNormalized:        0,
  modeDifficultyNorm:       0,
  modeTensionFloor:         0,
  phaseStakesMultiplier:    0,
  phaseTickBudgetFraction:  0,
  pressureEscalationNorm:   0,
  shieldWeightTotalNorm:    0,
  botThreatScoreNorm:       0,
  avgTickDurationNorm:      0,
  sessionDurationNorm:      0,
  startInputComplexity:     0,
  lifecycleTransitionNorm:  0,
  resetCountNorm:           0,
  healthScore:              0,
  timingPriorityAvg:        0,
  deckPowerAvg:             0,
  operationKindEntropyNorm: 0,
  modeMaxDivergenceNorm:    0,
  pressureMinHoldNorm:      0,
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 27 — DEFAULT DL TENSOR
// ──────────────────────────────────────────────────────────────────────────────

function _buildZeroDlRow(label: string): LifecycleDLTensorRow {
  return { label, f0: 0, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0 };
}

/** Zero-value DL tensor for initialization and fallback. */
export const ZERO_DEFAULT_LIFECYCLE_DL_TENSOR: LifecycleDLTensor = Object.freeze({
  shape:     LIFECYCLE_DL_TENSOR_SHAPE,
  rowLabels: LIFECYCLE_DL_ROW_LABELS,
  colLabels: LIFECYCLE_DL_COL_LABELS,
  rows:      Object.freeze(LIFECYCLE_DL_ROW_LABELS.map(_buildZeroDlRow)),
  checksum:  checksumSnapshot({ zero: true, shape: LIFECYCLE_DL_TENSOR_SHAPE }),
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 28 — DEFAULT CHAT SIGNAL
// ──────────────────────────────────────────────────────────────────────────────

/** Zero-value chat signal for initialization and fallback. */
export const ZERO_DEFAULT_LIFECYCLE_CHAT_SIGNAL: LifecycleChatSignal = Object.freeze({
  kind:                 'LIFECYCLE_SIGNAL',
  runId:                'none',
  userId:               'none',
  mode:                 'solo' as ModeCode,
  lifecycleState:       'IDLE' as OrchestratorLifecycle,
  operation:            'GET_SNAPSHOT' as LifecycleOperationKind,
  severity:             'LOW' as LifecycleSeverity,
  healthScore:          0,
  phase:                null,
  pressureTier:         null,
  outcome:              null,
  tick:                 0,
  tickCount:            0,
  actionRecommendation: 'Start a run to begin play.',
  narrationKey:         'lifecycle.idle',
  urgencyLabel:         'Calm',
  sessionDurationMs:    0,
  isTerminal:           false,
  mlVector:             ZERO_DEFAULT_LIFECYCLE_ML_VECTOR,
  timestampMs:          0,
});

// ══════════════════════════════════════════════════════════════════════════════
// PART H — INTERNAL COMPUTATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 29 — LIFECYCLE STATE + OUTCOME ORDINALS
// ──────────────────────────────────────────────────────────────────────────────

/** Map from OrchestratorLifecycle → 0-1 ordinal for ML feature encoding. */
const LIFECYCLE_STATE_ORDINALS: Record<OrchestratorLifecycle, number> = {
  IDLE:                      0.0,
  RUN_STARTED:               0.2,
  IN_TICK:                   0.4,
  TERMINAL_PENDING_FINALIZE: 0.8,
  FINALIZED:                 1.0,
};

/** Map from RunOutcome → 0-1 encoded value for ML feature. */
const OUTCOME_ENCODED: Record<RunOutcome, number> = {
  FREEDOM:   0.25,
  TIMEOUT:   0.50,
  BANKRUPT:  0.75,
  ABANDONED: 1.0,
};

function _getLifecycleStateOrdinal(state: OrchestratorLifecycle): number {
  return LIFECYCLE_STATE_ORDINALS[state] ?? 0;
}

function _getOutcomeEncoded(outcome: RunOutcome | null): number {
  if (!outcome) return 0;
  return OUTCOME_ENCODED[outcome] ?? 0;
}

function _getSeverityNorm(severity: LifecycleSeverity): number {
  const map: Record<LifecycleSeverity, number> = {
    LOW: 0.1, MEDIUM: 0.4, HIGH: 0.7, CRITICAL: 1.0,
  };
  return map[severity];
}

function _getPressureTierNorm(tier: PressureTier | null): number {
  if (!tier) return 0;
  return PRESSURE_TIER_NORMALIZED[tier] ?? 0;
}

function _getPhaseNorm(phase: RunPhase | null): number {
  if (!phase) return 0;
  return RUN_PHASE_NORMALIZED[phase] ?? 0;
}

function _getPhaseStakes(phase: RunPhase | null): number {
  if (!phase) return 0;
  return RUN_PHASE_STAKES_MULTIPLIER[phase] ?? 0;
}

function _getPhaseTickBudget(phase: RunPhase | null): number {
  if (!phase) return 0;
  return RUN_PHASE_TICK_BUDGET_FRACTION[phase] ?? 0;
}

function _getPressureEscalationNorm(tier: PressureTier | null): number {
  if (!tier) return 0;
  return (PRESSURE_TIER_ESCALATION_THRESHOLD[tier] ?? 0) / 100;
}

function _getPressureMinHoldNorm(tier: PressureTier | null): number {
  if (!tier) return 0;
  return (PRESSURE_TIER_MIN_HOLD_TICKS[tier] ?? 0) / 3;
}

function _getModeDivergenceNorm(mode: ModeCode): number {
  const div: DivergencePotential = MODE_MAX_DIVERGENCE[mode];
  return DIVERGENCE_POTENTIAL_NORMALIZED[div] ?? 0;
}

function _computeShieldWeightTotalNorm(): number {
  const total = Object.values(SHIELD_LAYER_CAPACITY_WEIGHT).reduce((a, b) => a + b, 0);
  return total / 4.0; // 4 layers, each max weight 1.0
}

function _computeOperationKindEntropy(
  counts: Partial<Record<LifecycleOperationKind, number>>,
): number {
  const total = Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);
  if (total === 0) return 0;
  let entropy = 0;
  for (const count of Object.values(counts)) {
    const c = count ?? 0;
    if (c === 0) continue;
    const p = c / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(LIFECYCLE_OPERATION_KINDS.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

function _computeStartInputComplexity(input: CoordinatorStartInput | null): number {
  if (!input) return 0;
  let score = 0.1;
  if (input.seed) score += 0.05;
  if (input.runId) score += 0.05;
  if (input.communityHeatModifier) score += 0.05;
  if (input.tags && input.tags.length > 0) {
    score += Math.min(0.1, input.tags.length * 0.02);
  }
  if (input.forceProofFinalizeOnTerminal) score += 0.05;
  if (input.modeOptions) {
    const opts: ModeConfigureOptions = input.modeOptions;
    const advantageId: SoloAdvantageId | null | undefined = opts.advantageId;
    if (advantageId) score += 0.1;
    const handicapIds: readonly SoloHandicapId[] = opts.handicapIds ?? [];
    score += Math.min(0.15, handicapIds.length * 0.025);
    const roleAssignments: Readonly<Record<string, TeamRoleId>> =
      (opts.roleAssignments ?? {}) as Readonly<Record<string, TeamRoleId>>;
    score += Math.min(0.1, Object.keys(roleAssignments).length * 0.025);
    if (opts.disabledBots && opts.disabledBots.length > 0) score += 0.05;
    if (opts.bleedMode) score += 0.1;
    if (opts.legendRunId) score += 0.1;
    if (opts.legendMarkers && opts.legendMarkers.length > 0) score += 0.05;
  }
  return Math.min(1.0, score);
}

function _computeTickHistoryMetrics(history: readonly TickExecutionSummary[]): {
  avgDurationMs: number;
  count: number;
  minDurationMs: number;
  maxDurationMs: number;
} {
  if (history.length === 0) {
    return { avgDurationMs: 0, count: 0, minDurationMs: 0, maxDurationMs: 0 };
  }
  const durations = history.map((t) => t.durationMs);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return {
    avgDurationMs: avg,
    count:         history.length,
    minDurationMs: Math.min(...durations),
    maxDurationMs: Math.max(...durations),
  };
}

function _computeHealthScore(
  severity: LifecycleSeverity,
  lifecycleState: OrchestratorLifecycle,
  operationCount: number,
  tickCount: number,
  isTerminal: boolean,
): number {
  let score = 0.5;
  // Severity penalty
  const severityPenalty: Record<LifecycleSeverity, number> = {
    LOW: 0, MEDIUM: 0.1, HIGH: 0.25, CRITICAL: 0.4,
  };
  score -= severityPenalty[severity];
  // Lifecycle state bonus
  const stateBonus: Record<OrchestratorLifecycle, number> = {
    IDLE:                      0,
    RUN_STARTED:               0.1,
    IN_TICK:                   0.15,
    TERMINAL_PENDING_FINALIZE: 0.05,
    FINALIZED:                 0.2,
  };
  score += stateBonus[lifecycleState];
  // Operation richness bonus
  if (operationCount > 10)  score += 0.05;
  if (operationCount > 50)  score += 0.05;
  if (operationCount > 100) score += 0.05;
  // Tick progress bonus
  if (tickCount > 0)   score += 0.05;
  if (tickCount > 10)  score += 0.05;
  if (tickCount > 100) score += 0.05;
  // Terminal bonus (run reached conclusion)
  if (isTerminal) score += 0.1;
  return Math.max(0, Math.min(1, score));
}

function _classifyBotThreatLabel(botThreatScore: number): string {
  if (botThreatScore >= 0.9) return 'BOT_APEX';
  if (botThreatScore >= 0.7) return 'BOT_HIGH';
  if (botThreatScore >= 0.4) return 'BOT_ELEVATED';
  if (botThreatScore >= 0.1) return 'BOT_WATCHING';
  return 'BOT_DORMANT';
}

function _computeEngagementScore(
  totalCardPlays: number,
  totalModeActions: number,
  totalTicks: number,
  sessionDurationMs: number,
  healthScore: number,
): number {
  const playScore = Math.min(1.0, totalCardPlays / 20);
  const actionScore = Math.min(1.0, totalModeActions / 10);
  const tickScore = Math.min(1.0, totalTicks / 100);
  const timeScore = Math.min(1.0, sessionDurationMs / 300_000); // 5 minutes
  return (playScore * 0.3 + actionScore * 0.2 + tickScore * 0.3 + timeScore * 0.1 + healthScore * 0.1);
}

function _scoreVerifiedGrade(healthScore: number): VerifiedGrade {
  if (healthScore >= 0.9) return 'A';
  if (healthScore >= 0.75) return 'B';
  if (healthScore >= 0.5) return 'C';
  if (healthScore >= 0.25) return 'D';
  return 'F';
}

// ══════════════════════════════════════════════════════════════════════════════
// PART I — ML FEATURE EXTRACTION
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 30 — ML VECTOR INPUT TYPE
// ──────────────────────────────────────────────────────────────────────────────

/** Rich input for ML vector extraction from lifecycle coordinator state. */
export interface LifecycleMLVectorInput {
  readonly snapshot: RunStateSnapshot;
  readonly lifecycleState: OrchestratorLifecycle;
  readonly sessionStartedAtMs: number;
  readonly operationCounts: Partial<Record<LifecycleOperationKind, number>>;
  readonly tickHistory: readonly TickExecutionSummary[];
  readonly startInput: CoordinatorStartInput | null;
  readonly queuedEventCount: number;
  readonly lastFlushCount: number;
  readonly lifecycleTransitionCount: number;
  readonly resetCount: number;
  readonly pressureTier: PressureTier | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 31 — EXTRACT LIFECYCLE ML VECTOR
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract the 32-dim ML feature vector from the lifecycle coordinator state.
 * All features are normalized to [0, 1] for consistent ML inference.
 * Each feature maps to a named field in LifecycleMLVector for traceability.
 */
export function extractLifecycleMLVector(input: LifecycleMLVectorInput): LifecycleMLVector {
  const { snapshot, lifecycleState, sessionStartedAtMs, operationCounts } = input;
  const { tickHistory, startInput, queuedEventCount, lastFlushCount } = input;
  const { lifecycleTransitionCount, resetCount, pressureTier } = input;

  const mode: ModeCode = snapshot.mode;
  const phase: RunPhase = snapshot.phase;
  const outcome: RunOutcome | null = snapshot.outcome;
  const tick: number = snapshot.tick;

  // Aggregate operation counts
  const totalOps = Object.values(operationCounts).reduce<number>((a, b) => a + (b ?? 0), 0);
  const playCardCount = operationCounts.PLAY ?? 0;
  const actionCount = operationCounts.ACTION ?? 0;
  const tickCount = operationCounts.TICK ?? 0;

  // Tick history metrics
  const { avgDurationMs, count: histCount } = _computeTickHistoryMetrics(tickHistory);

  // Session duration
  const nowMs = Date.now();
  const sessionDurationMs = Math.max(0, nowMs - sessionStartedAtMs);

  // Derived scalars
  const isTerminal = outcome !== null;
  const tickEfficiency = totalOps > 0 ? tickCount / totalOps : 0;
  const playRatio = totalOps > 0 ? playCardCount / totalOps : 0;
  const actionRatio = totalOps > 0 ? actionCount / totalOps : 0;

  // Severity classification (derived inline for ML vector)
  const healthEstimate = _computeHealthScore(
    'LOW', lifecycleState, totalOps, histCount, isTerminal,
  );

  const operationKindEntropy = _computeOperationKindEntropy(operationCounts);

  return {
    modeNormalized:           MODE_NORMALIZED[mode],
    lifecycleStateOrdinal:    _getLifecycleStateOrdinal(lifecycleState),
    phaseNormalized:          _getPhaseNorm(phase),
    pressureTierNormalized:   _getPressureTierNorm(pressureTier),
    tickCountNorm:            Math.min(1, tick / 500),
    tickEfficiencyNorm:       Math.min(1, tickEfficiency),
    operationCountNorm:       Math.min(1, totalOps / 100),
    playCardRatioNorm:        Math.min(1, playRatio),
    actionRatioNorm:          Math.min(1, actionRatio),
    queuedEventCountNorm:     Math.min(1, queuedEventCount / 100),
    lastFlushCountNorm:       Math.min(1, lastFlushCount / 50),
    tickHistoryDepthNorm:     Math.min(1, histCount / 100),
    terminalFlag:             isTerminal ? 1 : 0,
    outcomeNormalized:        _getOutcomeEncoded(outcome),
    modeDifficultyNorm:       Math.min(1, MODE_DIFFICULTY_MULTIPLIER[mode] / 2.0),
    modeTensionFloor:         MODE_TENSION_FLOOR[mode],
    phaseStakesMultiplier:    _getPhaseStakes(phase),
    phaseTickBudgetFraction:  _getPhaseTickBudget(phase),
    pressureEscalationNorm:   _getPressureEscalationNorm(pressureTier),
    shieldWeightTotalNorm:    _computeShieldWeightTotalNorm(),
    botThreatScoreNorm:       LIFECYCLE_BOT_THREAT_MAX / LIFECYCLE_MAX_BOT_THREAT_SCORE,
    avgTickDurationNorm:      Math.min(1, avgDurationMs / 1000),
    sessionDurationNorm:      Math.min(1, sessionDurationMs / 3_600_000),
    startInputComplexity:     _computeStartInputComplexity(startInput),
    lifecycleTransitionNorm:  Math.min(1, lifecycleTransitionCount / 10),
    resetCountNorm:           Math.min(1, resetCount / 10),
    healthScore:              healthEstimate,
    timingPriorityAvg:        LIFECYCLE_TIMING_PRIORITY_AVG,
    deckPowerAvg:             LIFECYCLE_DECK_POWER_AVG,
    operationKindEntropyNorm: operationKindEntropy,
    modeMaxDivergenceNorm:    _getModeDivergenceNorm(mode),
    pressureMinHoldNorm:      _getPressureMinHoldNorm(pressureTier),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART J — DL TENSOR CONSTRUCTION
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 32 — BUILD LIFECYCLE DL TENSOR
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build the 6×6 DL tensor from a lifecycle ML vector.
 * Each row captures a distinct analytics domain for deep learning training.
 *
 * Row 0 — MODE_PROFILE:    mode-specific scores
 * Row 1 — PRESSURE_PROFILE: pressure tier metrics
 * Row 2 — SHIELD_PROFILE:  shield layer metrics
 * Row 3 — TIMING_PROFILE:  timing class statistics
 * Row 4 — OPERATION_FLOW:  operation type distribution
 * Row 5 — HEALTH_COMPOSITE: composite health metrics
 */
export function buildLifecycleDLTensor(
  v: LifecycleMLVector,
  mode: ModeCode,
  pressureTier: PressureTier | null,
): LifecycleDLTensor {
  // Row 0 — MODE_PROFILE
  // f0: modeNormalized, f1: modeDifficultyNorm, f2: modeTensionFloor
  // f3: modeMaxDivergenceNorm, f4: phaseStakesMultiplier, f5: phaseTickBudgetFraction
  const modeProfileRow: LifecycleDLTensorRow = {
    label: 'MODE_PROFILE',
    f0: v.modeNormalized,
    f1: v.modeDifficultyNorm,
    f2: v.modeTensionFloor,
    f3: v.modeMaxDivergenceNorm,
    f4: v.phaseStakesMultiplier,
    f5: v.phaseTickBudgetFraction,
  };

  // Row 1 — PRESSURE_PROFILE
  // f0: pressureTierNorm, f1: pressureEscalationNorm, f2: deescalation (norm)
  // f3: pressureMinHoldNorm, f4: urgencyEncoded, f5: terminalFlag
  const deescThresh = pressureTier
    ? (PRESSURE_TIER_DEESCALATION_THRESHOLD[pressureTier] ?? 0) / 100
    : 0;
  const urgencyEncoded = pressureTier
    ? (['T0', 'T1', 'T2', 'T3', 'T4'] as PressureTier[]).indexOf(pressureTier) / 4
    : 0;
  const pressureProfileRow: LifecycleDLTensorRow = {
    label: 'PRESSURE_PROFILE',
    f0: v.pressureTierNormalized,
    f1: v.pressureEscalationNorm,
    f2: deescThresh,
    f3: v.pressureMinHoldNorm,
    f4: urgencyEncoded,
    f5: v.terminalFlag,
  };

  // Row 2 — SHIELD_PROFILE
  // f0-f3: individual layer capacity weights (L1-L4), f4: total norm, f5: absorption order score
  const shieldWeights = SHIELD_LAYER_IDS.map(
    (id: ShieldLayerId) => SHIELD_LAYER_CAPACITY_WEIGHT[id],
  );
  const absorptionOrderScore = SHIELD_LAYER_ABSORPTION_ORDER.reduce(
    (acc, id, i) => acc + (SHIELD_LAYER_CAPACITY_WEIGHT[id] * (1 - i / SHIELD_LAYER_IDS.length)),
    0,
  ) / SHIELD_LAYER_IDS.length;
  const shieldProfileRow: LifecycleDLTensorRow = {
    label: 'SHIELD_PROFILE',
    f0: shieldWeights[0] ?? 0,
    f1: shieldWeights[1] ?? 0,
    f2: shieldWeights[2] ?? 0,
    f3: shieldWeights[3] ?? 0,
    f4: v.shieldWeightTotalNorm,
    f5: absorptionOrderScore,
  };

  // Row 3 — TIMING_PROFILE
  // f0: avgPriorityNorm, f1: avgUrgencyDecay, f2: maxPriorityNorm, f3: minUrgencyDecay
  // f4: prioritySpread, f5: timingClassCount
  const priorities = Object.values(TIMING_CLASS_WINDOW_PRIORITY);
  const decays = Object.values(TIMING_CLASS_URGENCY_DECAY);
  const avgPriorityNorm = priorities.reduce((a, b) => a + b, 0) / priorities.length / 100;
  const avgDecay = decays.reduce((a, b) => a + b, 0) / decays.length;
  const maxPriority = Math.max(...priorities) / 100;
  const minDecay = Math.min(...decays);
  const prioritySpread = (Math.max(...priorities) - Math.min(...priorities)) / 100;
  const timingClassCountNorm = TIMING_CLASSES.length / 12;
  const timingProfileRow: LifecycleDLTensorRow = {
    label: 'TIMING_PROFILE',
    f0: avgPriorityNorm,
    f1: avgDecay,
    f2: maxPriority,
    f3: minDecay,
    f4: prioritySpread,
    f5: timingClassCountNorm,
  };

  // Row 4 — OPERATION_FLOW
  // f0: operationCountNorm, f1: playCardRatioNorm, f2: actionRatioNorm
  // f3: tickCountNorm, f4: operationKindEntropyNorm, f5: resetCountNorm
  const operationFlowRow: LifecycleDLTensorRow = {
    label: 'OPERATION_FLOW',
    f0: v.operationCountNorm,
    f1: v.playCardRatioNorm,
    f2: v.actionRatioNorm,
    f3: v.tickCountNorm,
    f4: v.operationKindEntropyNorm,
    f5: v.resetCountNorm,
  };

  // Row 5 — HEALTH_COMPOSITE
  // f0: healthScore, f1: botThreatScoreNorm, f2: sessionDurationNorm
  // f3: startInputComplexity, f4: lifecycleTransitionNorm, f5: avgTickDurationNorm
  const healthCompositeRow: LifecycleDLTensorRow = {
    label: 'HEALTH_COMPOSITE',
    f0: v.healthScore,
    f1: v.botThreatScoreNorm,
    f2: v.sessionDurationNorm,
    f3: v.startInputComplexity,
    f4: v.lifecycleTransitionNorm,
    f5: v.avgTickDurationNorm,
  };

  const rows: readonly LifecycleDLTensorRow[] = Object.freeze([
    modeProfileRow,
    pressureProfileRow,
    shieldProfileRow,
    timingProfileRow,
    operationFlowRow,
    healthCompositeRow,
  ]);

  // Label accessor validation — uses SHIELD_LAYER_LABEL_BY_ID
  const _l1Label = SHIELD_LAYER_LABEL_BY_ID['L1'];
  const _l2Label = SHIELD_LAYER_LABEL_BY_ID['L2'];
  void _l1Label;
  void _l2Label;

  // Mode label reference
  const _modeLabel = LIFECYCLE_MODE_NARRATION[mode];
  void _modeLabel;

  return {
    shape:     LIFECYCLE_DL_TENSOR_SHAPE,
    rowLabels: LIFECYCLE_DL_ROW_LABELS,
    colLabels: LIFECYCLE_DL_COL_LABELS,
    rows,
    checksum:  checksumSnapshot({ rows }),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART K — ANALYTICS FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 33 — HEALTH SCORE + SEVERITY
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute a composite lifecycle health score (0-1).
 * Higher = healthier session with richer operation flow.
 */
export function computeLifecycleHealthScore(
  lifecycleState: OrchestratorLifecycle,
  totalOperations: number,
  totalTicks: number,
  isTerminal: boolean,
  severity?: LifecycleSeverity,
): number {
  return _computeHealthScore(
    severity ?? 'LOW',
    lifecycleState,
    totalOperations,
    totalTicks,
    isTerminal,
  );
}

/**
 * Classify a health score (0-1) into a LifecycleSeverity level.
 * LOW = good session, CRITICAL = session in severe distress.
 */
export function classifyLifecycleSeverity(healthScore: number): LifecycleSeverity {
  const inverted = 1 - healthScore;
  if (inverted >= LIFECYCLE_SEVERITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (inverted >= LIFECYCLE_SEVERITY_THRESHOLDS.HIGH)     return 'HIGH';
  if (inverted >= LIFECYCLE_SEVERITY_THRESHOLDS.MEDIUM)   return 'MEDIUM';
  return 'LOW';
}

/**
 * Derive an action recommendation string based on lifecycle state.
 * Drives companion commentary and player-facing guidance.
 */
export function getLifecycleActionRecommendation(
  lifecycleState: OrchestratorLifecycle,
  outcome: RunOutcome | null,
  severity: LifecycleSeverity,
  pressureTier: PressureTier | null,
): string {
  if (outcome !== null) {
    const labels: Record<RunOutcome, string> = {
      FREEDOM:   'Run complete — you achieved financial freedom.',
      TIMEOUT:   'Run ended by timeout — push harder next time.',
      BANKRUPT:  'Run ended in bankruptcy — rebuild and try again.',
      ABANDONED: 'Run abandoned — your progress was saved.',
    };
    return labels[outcome];
  }
  if (lifecycleState === 'IDLE') return 'Start a run to begin your journey.';
  if (lifecycleState === 'FINALIZED') return 'Finalized — review your run summary.';
  if (lifecycleState === 'TERMINAL_PENDING_FINALIZE') return 'Terminal state reached — finalizing run.';
  if (severity === 'CRITICAL') return 'Critical: take immediate defensive action — shield or rescue.';
  if (severity === 'HIGH') return 'High pressure: consider a counter play or rescue card.';
  if (pressureTier === 'T4') return 'Apex pressure: this is your defining moment.';
  if (pressureTier === 'T3') return 'Critical tier: play your highest-value cards now.';
  return 'Continue your run — build momentum and advance.';
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 34 — LIFECYCLE METRIC COMPUTATIONS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute tick efficiency — ratio of ticks executed to total operations.
 * High tick efficiency means the session is engine-driven, not UI-driven.
 */
export function computeLifecycleTickEfficiency(
  totalTicks: number,
  totalOperations: number,
): number {
  if (totalOperations === 0) return 0;
  return Math.min(1, totalTicks / totalOperations);
}

/**
 * Compute operation latency score.
 * Lower average tick duration → higher latency score (engine is fast).
 */
export function computeLifecycleOperationLatency(
  avgTickDurationMs: number,
): number {
  if (avgTickDurationMs <= 0) return 1;
  return Math.max(0, 1 - avgTickDurationMs / 1000);
}

/**
 * Compute mode weight — how much the selected mode amplifies session intensity.
 * Combines difficulty multiplier with tension floor.
 */
export function computeLifecycleModeWeight(mode: ModeCode): number {
  const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
  const tension = MODE_TENSION_FLOOR[mode];
  return Math.min(1, (difficulty * 0.6 + tension * 0.4));
}

/**
 * Compute phase tension score for the current run phase.
 * Combines stakes multiplier with tick budget fraction.
 */
export function computeLifecyclePhaseTension(phase: RunPhase): number {
  const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
  const budget = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
  return (stakes * 0.7 + (1 - budget) * 0.3);
}

/**
 * Score the urgency of a pressure tier transition.
 * Used to adjust audience heat delta in chat routing.
 */
export function computeLifecyclePressureUrgency(
  tier: PressureTier,
  sessionTick: number,
): number {
  const normalized = PRESSURE_TIER_NORMALIZED[tier];
  const minHold = PRESSURE_TIER_MIN_HOLD_TICKS[tier];
  const escalation = PRESSURE_TIER_ESCALATION_THRESHOLD[tier] / 100;
  const tickFactor = Math.min(1, sessionTick / 50);
  const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
  const labelBonus = urgencyLabel === 'Apex' ? 0.2 : 0;
  return Math.min(1, normalized * 0.4 + escalation * 0.3 + tickFactor * 0.2 + labelBonus + (minHold > 0 ? 0 : 0.1));
}

/**
 * Compute bot threat score from a bot state distribution.
 * Aggregates threat multiplier × threat level across all active bots.
 */
export function computeLifecycleBotThreatScore(
  botStateDistribution: Partial<Record<HaterBotId, BotState>>,
): number {
  let total = 0;
  for (const [botId, state] of Object.entries(botStateDistribution)) {
    const bid = botId as HaterBotId;
    const threatLevel = BOT_THREAT_LEVEL[bid] ?? 0;
    const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[state as BotState] ?? 0;
    total += threatLevel * stateMultiplier;
  }
  return Math.min(1, total / LIFECYCLE_BOT_THREAT_MAX);
}

/**
 * Compute overall session quality — a composite of engagement, health, and operation balance.
 * Drives the session report grade and post-session analytics.
 */
export function computeLifecycleSessionQuality(
  totalCardPlays: number,
  totalModeActions: number,
  totalTicks: number,
  sessionDurationMs: number,
  healthScore: number,
): number {
  return _computeEngagementScore(
    totalCardPlays, totalModeActions, totalTicks, sessionDurationMs, healthScore,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 35 — VISIBILITY + INTEGRITY HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Classify the visibility level based on session health and lifecycle state.
 * Used in health snapshots to drive UI concealment and reveal mechanics.
 */
export function computeLifecycleVisibilityLevel(
  healthScore: number,
  lifecycleState: OrchestratorLifecycle,
): VisibilityLevel {
  if (lifecycleState === 'IDLE') return 'HIDDEN';
  if (healthScore >= 0.8) return 'EXPOSED';
  if (healthScore >= 0.5) return 'PARTIAL';
  if (healthScore >= 0.2) return 'SILHOUETTE';
  return 'HIDDEN';
}

/**
 * Classify the integrity status for a lifecycle session.
 * Drives annotation bundle integrityFlag for downstream audit.
 */
export function computeLifecycleIntegrityStatus(
  isTerminal: boolean,
  healthScore: number,
  resetCount: number,
): IntegrityStatus {
  if (resetCount > 5) return 'QUARANTINED';
  if (!isTerminal && healthScore < 0.1) return 'UNVERIFIED';
  if (isTerminal && healthScore > 0.5) return 'VERIFIED';
  return 'PENDING';
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 36 — ATTACK CATEGORY HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Derive the active attack categories from a severity level.
 * Used to populate annotation bundles for downstream chat routing.
 */
export function deriveActiveAttackCategories(
  severity: LifecycleSeverity,
  pressureTier: PressureTier | null,
): readonly AttackCategory[] {
  const categories: AttackCategory[] = [];
  if (severity === 'CRITICAL' || severity === 'HIGH') {
    categories.push('BREACH');
    // BREACH is always counterable per ATTACK_CATEGORY_IS_COUNTERABLE
    if (ATTACK_CATEGORY_IS_COUNTERABLE.BREACH) {
      categories.push('DRAIN');
    }
  }
  if (severity === 'HIGH' || severity === 'MEDIUM') {
    categories.push('HEAT');
    const heatMag = ATTACK_CATEGORY_BASE_MAGNITUDE.HEAT;
    if (heatMag > 0.4) categories.push('LOCK');
  }
  if (pressureTier === 'T3' || pressureTier === 'T4') {
    categories.push('EXTRACTION');
    if (ATTACK_CATEGORY_IS_COUNTERABLE.EXTRACTION) {
      categories.push('DEBT');
    }
  }
  return categories;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 37 — DECK TYPE + TIMING HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Identify the dominant deck type most relevant to the current lifecycle state.
 * Used in health snapshots to surface the primary strategic lens.
 */
export function computeLifecycleDominantDeckType(
  isTerminal: boolean,
  severity: LifecycleSeverity,
  outcome: RunOutcome | null,
): DeckType | null {
  if (outcome === 'FREEDOM') return 'OPPORTUNITY';
  if (outcome === 'BANKRUPT') return 'FUBAR';
  if (outcome === 'TIMEOUT') return 'MISSED_OPPORTUNITY';
  if (outcome === 'ABANDONED') return 'GHOST';
  if (isTerminal) return 'DISCIPLINE';
  if (severity === 'CRITICAL') {
    // Highest power offensive deck
    return DECK_TYPE_POWER_LEVEL.GHOST > DECK_TYPE_POWER_LEVEL.SABOTAGE ? 'GHOST' : 'SABOTAGE';
  }
  if (severity === 'HIGH') return 'COUNTER';
  if (severity === 'MEDIUM') return 'RESCUE';
  return 'OPPORTUNITY';
}

/**
 * Identify the primary timing class given lifecycle state and pressure.
 * Used in health snapshots for card play urgency classification.
 */
export function computeLifecyclePrimaryTimingClass(
  lifecycleState: OrchestratorLifecycle,
  pressureTier: PressureTier | null,
): TimingClass | null {
  if (lifecycleState === 'IDLE') return null;
  if (lifecycleState === 'TERMINAL_PENDING_FINALIZE' || lifecycleState === 'FINALIZED') {
    return 'END';
  }
  if (pressureTier === 'T4') {
    // Highest window priority is FATE (100)
    const fatePriority = TIMING_CLASS_WINDOW_PRIORITY.FATE;
    return fatePriority >= 100 ? 'FATE' : 'CTR';
  }
  if (pressureTier === 'T3') return 'CTR';
  if (pressureTier === 'T2') return 'RES';
  if (pressureTier === 'T1') return 'PRE';
  if (lifecycleState === 'IN_TICK') {
    // Lowest urgency decay during a tick is GBM (0.05)
    const gbmDecay = TIMING_CLASS_URGENCY_DECAY.GBM;
    return gbmDecay <= 0.1 ? 'GBM' : 'ANY';
  }
  return 'ANY';
}

// ══════════════════════════════════════════════════════════════════════════════
// PART L — CHAT SIGNAL + ANNOTATION BUILDERS
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 38 — BUILD CHAT SIGNAL
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a LifecycleChatSignal from coordinator state.
 * Drives companion commentary, urgency display, and chat routing decisions.
 */
export function buildLifecycleChatSignal(
  snapshot: RunStateSnapshot,
  lifecycleState: OrchestratorLifecycle,
  operation: LifecycleOperationKind,
  sessionStartedAtMs: number,
  operationCounts: Partial<Record<LifecycleOperationKind, number>>,
  tickHistory: readonly TickExecutionSummary[],
  startInput: CoordinatorStartInput | null,
  queuedEventCount: number,
  lastFlushCount: number,
  lifecycleTransitionCount: number,
  resetCount: number,
  pressureTier: PressureTier | null,
): LifecycleChatSignal {
  const mlInput: LifecycleMLVectorInput = {
    snapshot, lifecycleState, sessionStartedAtMs, operationCounts,
    tickHistory, startInput, queuedEventCount, lastFlushCount,
    lifecycleTransitionCount, resetCount, pressureTier,
  };
  const mlVector = extractLifecycleMLVector(mlInput);
  const healthScore = mlVector.healthScore;
  const severity = classifyLifecycleSeverity(healthScore);
  const outcome = snapshot.outcome;
  const phase = snapshot.phase;
  const nowMs = Date.now();
  const sessionDurationMs = Math.max(0, nowMs - sessionStartedAtMs);
  const isTerminal = outcome !== null;
  const urgencyLabel = pressureTier ? PRESSURE_TIER_URGENCY_LABEL[pressureTier] : 'Calm';
  const actionRecommendation = getLifecycleActionRecommendation(
    lifecycleState, outcome, severity, pressureTier,
  );
  const narrationKey = `lifecycle.${lifecycleState.toLowerCase()}.${operation.toLowerCase()}`;

  return {
    kind:                 'LIFECYCLE_SIGNAL',
    runId:                snapshot.runId,
    userId:               snapshot.userId,
    mode:                 snapshot.mode,
    lifecycleState,
    operation,
    severity,
    healthScore,
    phase,
    pressureTier,
    outcome,
    tick:                 snapshot.tick,
    tickCount:            tickHistory.length,
    actionRecommendation,
    narrationKey,
    urgencyLabel,
    sessionDurationMs,
    isTerminal,
    mlVector,
    timestampMs:          nowMs,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 39 — BUILD ANNOTATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a LifecycleAnnotationBundle from a chat signal.
 * Provides richer semantic context for ML training and companion systems.
 */
export function buildLifecycleAnnotation(
  signal: LifecycleChatSignal,
  resetCount: number,
): LifecycleAnnotationBundle {
  const { runId, userId, mode, operation, severity, healthScore } = signal;
  const { phase, pressureTier, outcome, isTerminal, lifecycleState } = signal;

  const integrityFlag = computeLifecycleIntegrityStatus(isTerminal, healthScore, resetCount);
  const activeAttackCategories = deriveActiveAttackCategories(severity, pressureTier);
  const botThreatScore = signal.mlVector.botThreatScoreNorm;
  const botThreatSummary = _classifyBotThreatLabel(botThreatScore);
  const engagementScore = _computeEngagementScore(
    Math.round(signal.mlVector.playCardRatioNorm * 20),
    Math.round(signal.mlVector.actionRatioNorm * 10),
    Math.round(signal.mlVector.tickCountNorm * 500),
    signal.sessionDurationMs,
    healthScore,
  );

  const modeLabel = LIFECYCLE_MODE_NARRATION[mode];
  const urgencyLabel = pressureTier ? PRESSURE_TIER_URGENCY_LABEL[pressureTier] : 'Calm';

  const primaryNarration = `[${modeLabel}] Lifecycle: ${lifecycleState} — ${severity} severity`;
  const secondaryNarration = `Phase: ${phase ?? 'N/A'} | Pressure: ${urgencyLabel} | Health: ${healthScore.toFixed(2)}`;
  const actionRecommendation = signal.actionRecommendation;
  const rescueEligible = severity === 'HIGH' || severity === 'CRITICAL';
  const cascadeRisk = severity === 'CRITICAL' && (pressureTier === 'T3' || pressureTier === 'T4');

  return {
    runId, userId, mode, operation, severity, healthScore,
    phase, pressureTier, outcome, isTerminal,
    integrityFlag,
    activeAttackCategories,
    botThreatSummary,
    primaryNarration,
    secondaryNarration,
    actionRecommendation,
    engagementScore,
    rescueEligible,
    cascadeRisk,
    timestampMs: signal.timestampMs,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 40 — BUILD NARRATION HINT
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a LifecycleNarrationHint from a chat signal.
 * Provides copy keys, audience heat deltas, and presence theater flags
 * for the chat system's UX routing layer.
 */
export function buildLifecycleNarrationHint(
  signal: LifecycleChatSignal,
): LifecycleNarrationHint {
  const { runId, operation, mode, phase, severity, lifecycleState, pressureTier, outcome } = signal;

  const modeLabel = LIFECYCLE_MODE_NARRATION[mode];
  const phaseLabel = phase ?? 'NO_PHASE';
  const urgencyLabel = pressureTier ? PRESSURE_TIER_URGENCY_LABEL[pressureTier] : 'Calm';
  const botThreatLabel = _classifyBotThreatLabel(signal.mlVector.botThreatScoreNorm);
  const outcomeLabel = outcome ?? null;

  const primaryKey = `lifecycle.narration.${lifecycleState}.${severity}`;
  const secondaryKey = `lifecycle.hint.${operation}.${phase ?? 'nophase'}`;
  const chatPrompt = outcome
    ? `Run ended: ${outcome}. ${signal.actionRecommendation}`
    : `${modeLabel} — ${urgencyLabel} pressure. ${signal.actionRecommendation}`;

  // Audience heat delta: higher severity → more heat
  const heatByseverity: Record<LifecycleSeverity, number> = {
    LOW: 0.02, MEDIUM: 0.05, HIGH: 0.12, CRITICAL: 0.25,
  };
  const audienceHeatDelta = heatBySeconds(signal.sessionDurationMs) + heatByseverity[severity];

  const rescueTrigger = severity === 'CRITICAL' || (severity === 'HIGH' && signal.isTerminal);
  const presenceTheatre = pressureTier === 'T4' || severity === 'CRITICAL';

  return {
    runId, operation, mode, phase, severity,
    primaryKey, secondaryKey, urgencyLabel,
    modeLabel, phaseLabel, pressureLabel: urgencyLabel, botThreatLabel, outcomeLabel,
    chatPrompt, audienceHeatDelta, rescueTrigger, presenceTheatre,
  };
}

function heatBySeconds(sessionDurationMs: number): number {
  const minutes = sessionDurationMs / 60_000;
  return Math.min(0.1, minutes * 0.005);
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 41 — BUILD HEALTH SNAPSHOT
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a point-in-time health snapshot for the lifecycle coordinator session.
 * Used for trend analysis, session reporting, and inspection bundles.
 */
export function buildLifecycleHealthSnapshot(
  signal: LifecycleChatSignal,
  sessionId: string,
  botStateDistribution: Partial<Record<BotState, number>>,
  activeShieldLayers: readonly ShieldLayerId[],
): LifecycleHealthSnapshot {
  const { runId, mode, lifecycleState, phase, pressureTier, outcome } = signal;
  const { healthScore, severity, mlVector, sessionDurationMs, isTerminal } = signal;

  const snapshotId = createDeterministicId(
    'lifecycle-health',
    sessionId, runId, String(signal.timestampMs),
  );

  const botThreatScore = mlVector.botThreatScoreNorm;
  const shieldWeightTotal = _computeShieldWeightTotalNorm() * 4; // un-normalize
  const tickEfficiency = computeLifecycleTickEfficiency(
    Math.round(mlVector.tickCountNorm * 500),
    Math.round(mlVector.operationCountNorm * 100),
  );
  const operationBalance = Math.abs(mlVector.playCardRatioNorm - mlVector.actionRatioNorm);
  const sessionQuality = _computeEngagementScore(
    Math.round(mlVector.playCardRatioNorm * 20),
    Math.round(mlVector.actionRatioNorm * 10),
    Math.round(mlVector.tickCountNorm * 500),
    sessionDurationMs,
    healthScore,
  );
  const engagementScore = sessionQuality;
  const rescueEligible = severity === 'HIGH' || severity === 'CRITICAL';
  const cascadeRisk = severity === 'CRITICAL';
  const visibilityLevel = computeLifecycleVisibilityLevel(healthScore, lifecycleState);
  const dominantDeckType = computeLifecycleDominantDeckType(isTerminal, severity, outcome);
  const primaryTimingClass = computeLifecyclePrimaryTimingClass(lifecycleState, pressureTier);

  return {
    snapshotId,
    sessionId,
    runId,
    timestampMs: signal.timestampMs,
    healthScore,
    severity,
    lifecycleState,
    phase,
    pressureTier,
    outcome,
    botThreatScore,
    shieldWeightTotal,
    tickEfficiency,
    operationBalance: 1 - operationBalance,
    sessionQuality,
    engagementScore,
    rescueEligible,
    cascadeRisk,
    visibilityLevel,
    botStateDistribution,
    activeShieldLayers,
    dominantDeckType,
    primaryTimingClass,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 42 — BUILD RUN SUMMARY
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a LifecycleRunSummary from the session tracker and final chat signal.
 * Consumed by the chat adapter and post-run analytics pipeline.
 */
export function buildLifecycleRunSummary(
  sessionTracker: LifecycleCoordinatorSessionTracker,
  finalSignal: LifecycleChatSignal,
): LifecycleRunSummary {
  const report = sessionTracker.getReport();
  const { healthScore, severity, mlVector, mode } = finalSignal;
  const engagementScore = _computeEngagementScore(
    report.totalCardPlays,
    report.totalModeActions,
    report.totalTicks,
    report.durationMs,
    healthScore,
  );
  const verifiedGrade = _scoreVerifiedGrade(healthScore);

  // Use verified grade numeric score for additional quality check
  const gradeScore = VERIFIED_GRADE_NUMERIC_SCORE[verifiedGrade];
  const rescueMoments = Math.round(engagementScore * 5 * gradeScore);
  const cascadeEvents = severity === 'CRITICAL' ? 3 : severity === 'HIGH' ? 1 : 0;

  return {
    runId:            report.sessionId,
    userId:           report.userId,
    mode,
    startedAtMs:      report.startedAtMs,
    completedAtMs:    report.endedAtMs,
    durationMs:       report.durationMs,
    totalTicks:       report.totalTicks,
    totalCardPlays:   report.totalCardPlays,
    totalModeActions: report.totalModeActions,
    outcome:          report.finalOutcome,
    finalPhase:       report.finalPhase,
    finalPressureTier: report.finalPressureTier,
    finalHealthScore: healthScore,
    finalSeverity:    severity,
    peakHealthScore:  report.peakHealthScore,
    avgHealthScore:   report.avgHealthScore,
    engagementScore,
    rescueMoments,
    cascadeEvents,
    verifiedGrade,
    mlVector,
    chatSignal:       finalSignal,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART M — VECTOR UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 43 — VALIDATE, FLATTEN, NAMED MAP
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a LifecycleMLVector has all 32 features in [0, 1].
 * Returns true if valid, false if any feature is out of range or NaN.
 */
export function validateLifecycleMLVector(v: LifecycleMLVector): boolean {
  for (const [key, val] of Object.entries(v)) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 1) {
      return false;
    }
    void key;
  }
  return Object.keys(v).length === LIFECYCLE_ML_FEATURE_COUNT;
}

/**
 * Flatten a LifecycleMLVector to a plain number array (ordered by label index).
 */
export function flattenLifecycleMLVector(v: LifecycleMLVector): readonly number[] {
  return LIFECYCLE_ML_FEATURE_LABELS.map((label) => {
    const val = (v as unknown as Record<string, number>)[label];
    return typeof val === 'number' ? val : 0;
  });
}

/**
 * Flatten a LifecycleDLTensor to a row-major number array.
 */
export function flattenLifecycleDLTensor(tensor: LifecycleDLTensor): readonly number[] {
  const result: number[] = [];
  for (const row of tensor.rows) {
    result.push(row.f0, row.f1, row.f2, row.f3, row.f4, row.f5);
  }
  return result;
}

/**
 * Build a named map of label → feature value for debugging and logging.
 */
export function buildLifecycleMLNamedMap(v: LifecycleMLVector): Record<string, number> {
  const map: Record<string, number> = {};
  for (const label of LIFECYCLE_ML_FEATURE_LABELS) {
    const val = (v as unknown as Record<string, number>)[label];
    map[label] = typeof val === 'number' ? val : 0;
  }
  return map;
}

/**
 * Extract a specific column from a LifecycleDLTensor by column index (0-5).
 */
export function extractLifecycleDLColumn(
  tensor: LifecycleDLTensor,
  colIndex: number,
): readonly number[] {
  const colKey = `f${colIndex}` as keyof LifecycleDLTensorRow;
  return tensor.rows.map((row) => {
    const val = row[colKey];
    return typeof val === 'number' ? val : 0;
  });
}

/**
 * Compute cosine similarity between two LifecycleMLVectors.
 * Returns 0-1 (1 = identical vectors).
 */
export function computeLifecycleMLSimilarity(
  a: LifecycleMLVector,
  b: LifecycleMLVector,
): number {
  const aFlat = flattenLifecycleMLVector(a);
  const bFlat = flattenLifecycleMLVector(b);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < aFlat.length; i++) {
    dot   += aFlat[i]! * bFlat[i]!;
    normA += aFlat[i]! * aFlat[i]!;
    normB += bFlat[i]! * bFlat[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Return the top-N features by value from a LifecycleMLVector.
 */
export function getTopLifecycleFeatures(
  v: LifecycleMLVector,
  topN: number,
): readonly { label: string; value: number }[] {
  const named = buildLifecycleMLNamedMap(v);
  return Object.entries(named)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([label, value]) => ({ label, value }));
}

/**
 * Serialize a LifecycleMLVector to a canonical JSON string for hashing.
 */
export function serializeLifecycleMLVector(v: LifecycleMLVector): string {
  return stableStringify(v);
}

/**
 * Serialize a LifecycleDLTensor to a canonical JSON string.
 */
export function serializeLifecycleDLTensor(tensor: LifecycleDLTensor): string {
  return stableStringify({ rows: tensor.rows, shape: tensor.shape });
}

/**
 * Deep-clone a LifecycleMLVector (immutably safe copy for mutation tracking).
 */
export function cloneLifecycleMLVector(v: LifecycleMLVector): LifecycleMLVector {
  return cloneJson(v);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART N — ANALYTICS CLASSES
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 44 — LIFECYCLE COORDINATOR TREND ANALYZER
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Sliding-window trend analyzer for lifecycle coordinator analytics.
 * Tracks health score deltas, operation rates, and engagement trends
 * over a configurable window of recent events.
 */
export class LifecycleCoordinatorTrendAnalyzer {
  private readonly windowSize: number;
  private readonly sessionId: string;
  private readonly records: Array<{
    healthScore:    number;
    severity:       LifecycleSeverity;
    operation:      LifecycleOperationKind;
    tickDurationMs: number;
    isTerminal:     boolean;
    rescueEligible: boolean;
    cascadeRisk:    boolean;
    pressureTier:   PressureTier | null;
    timestampMs:    number;
  }> = [];

  public constructor(sessionId: string, windowSize = 50) {
    this.sessionId = sessionId;
    this.windowSize = windowSize;
  }

  public record(
    signal: LifecycleChatSignal,
    tickDurationMs: number,
  ): void {
    this.records.push({
      healthScore:    signal.healthScore,
      severity:       signal.severity,
      operation:      signal.operation,
      tickDurationMs,
      isTerminal:     signal.isTerminal,
      rescueEligible: signal.severity === 'HIGH' || signal.severity === 'CRITICAL',
      cascadeRisk:    signal.severity === 'CRITICAL',
      pressureTier:   signal.pressureTier,
      timestampMs:    signal.timestampMs,
    });
    if (this.records.length > this.windowSize) {
      this.records.shift();
    }
  }

  public getSnapshot(): LifecycleTrendSnapshot {
    const records = this.records;
    const total = records.length;
    if (total === 0) {
      return {
        sessionId:              this.sessionId,
        windowSize:             this.windowSize,
        avgHealthScore:         0,
        healthScoreDelta:       0,
        avgTickDurationMs:      0,
        operationRatePerMinute: 0,
        playCardRate:           0,
        modeActionRate:         0,
        tickRate:               0,
        resetRate:              0,
        terminalRate:           0,
        avgPressureTierNorm:    0,
        avgSeverityNorm:        0,
        engagementTrend:        'STABLE',
        rescueEligibilityRate:  0,
        cascadeRiskRate:        0,
        dominantOperation:      'GET_SNAPSHOT',
        totalOperations:        0,
        snapshotMs:             Date.now(),
      };
    }

    const avgHealth = records.reduce((a, r) => a + r.healthScore, 0) / total;
    const firstHalf = records.slice(0, Math.floor(total / 2));
    const secondHalf = records.slice(Math.floor(total / 2));
    const firstAvg = firstHalf.reduce((a, r) => a + r.healthScore, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((a, r) => a + r.healthScore, 0) / (secondHalf.length || 1);
    const delta = secondAvg - firstAvg;

    const avgTickDuration = records.reduce((a, r) => a + r.tickDurationMs, 0) / total;

    // Time span for rate computation
    const spanMs = total > 1
      ? (records[records.length - 1]!.timestampMs - records[0]!.timestampMs)
      : 60_000;
    const spanMin = Math.max(1, spanMs / 60_000);
    const rate = total / spanMin;

    const plays = records.filter((r) => r.operation === 'PLAY').length;
    const actions = records.filter((r) => r.operation === 'ACTION').length;
    const ticks = records.filter((r) => r.operation === 'TICK').length;
    const resets = records.filter((r) => r.operation === 'RESET').length;
    const terminals = records.filter((r) => r.isTerminal).length;
    const rescues = records.filter((r) => r.rescueEligible).length;
    const cascades = records.filter((r) => r.cascadeRisk).length;

    const avgPressureNorm = records.reduce(
      (a, r) => a + (r.pressureTier ? PRESSURE_TIER_NORMALIZED[r.pressureTier] : 0), 0,
    ) / total;

    const avgSeverityNorm = records.reduce(
      (a, r) => a + _getSeverityNorm(r.severity), 0,
    ) / total;

    // Dominant operation
    const opCounts: Partial<Record<LifecycleOperationKind, number>> = {};
    for (const r of records) {
      opCounts[r.operation] = (opCounts[r.operation] ?? 0) + 1;
    }
    let domOp: LifecycleOperationKind = 'GET_SNAPSHOT';
    let domCount = 0;
    for (const [op, count] of Object.entries(opCounts)) {
      if ((count ?? 0) > domCount) {
        domCount = count ?? 0;
        domOp = op as LifecycleOperationKind;
      }
    }

    const engagementTrend: 'RISING' | 'STABLE' | 'FALLING' =
      delta > 0.05 ? 'RISING' : delta < -0.05 ? 'FALLING' : 'STABLE';

    return {
      sessionId:              this.sessionId,
      windowSize:             this.windowSize,
      avgHealthScore:         avgHealth,
      healthScoreDelta:       delta,
      avgTickDurationMs:      avgTickDuration,
      operationRatePerMinute: rate,
      playCardRate:           plays / spanMin,
      modeActionRate:         actions / spanMin,
      tickRate:               ticks / spanMin,
      resetRate:              resets / spanMin,
      terminalRate:           terminals / total,
      avgPressureTierNorm:    avgPressureNorm,
      avgSeverityNorm,
      engagementTrend,
      rescueEligibilityRate:  rescues / total,
      cascadeRiskRate:        cascades / total,
      dominantOperation:      domOp,
      totalOperations:        total,
      snapshotMs:             Date.now(),
    };
  }

  public clear(): void {
    this.records.length = 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 45 — LIFECYCLE COORDINATOR SESSION TRACKER
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Session tracker for the lifecycle coordinator.
 * Records session-level metrics across the full run lifecycle.
 * Used to produce session reports and post-run analytics.
 */
export class LifecycleCoordinatorSessionTracker {
  public readonly sessionId: string;
  private readonly userId: string;
  private readonly startedAtMs: number;
  private mode: ModeCode = 'solo';
  private startInput: CoordinatorStartInput | null = null;

  private totalOperations = 0;
  private totalTicks = 0;
  private totalCardPlays = 0;
  private totalModeActions = 0;
  private totalResets = 0;

  private finalLifecycleState: OrchestratorLifecycle = 'IDLE';
  private finalPhase: RunPhase | null = null;
  private finalPressureTier: PressureTier | null = null;
  private finalOutcome: RunOutcome | null = null;
  private finalHealthScore = 0;
  private finalSeverity: LifecycleSeverity = 'LOW';

  private peakHealthScore = 0;
  private lowestHealthScore = 1;
  private healthScoreSum = 0;
  private healthScoreCount = 0;

  private latestMLVector: LifecycleMLVector | null = null;
  private latestTrend: LifecycleTrendSnapshot | null = null;

  public constructor(userId: string, sessionId?: string) {
    this.userId = userId;
    this.sessionId = sessionId ?? createDeterministicId('lifecycle-session', userId, String(Date.now()));
    this.startedAtMs = Date.now();
  }

  public setMode(mode: ModeCode): void {
    this.mode = mode;
  }

  public setStartInput(input: CoordinatorStartInput): void {
    this.startInput = input;
  }

  public recordOperation(
    signal: LifecycleChatSignal,
    mlVector: LifecycleMLVector,
  ): void {
    this.totalOperations += 1;
    this.latestMLVector = mlVector;

    // Track by operation kind
    if (signal.operation === 'PLAY')           this.totalCardPlays += 1;
    else if (signal.operation === 'ACTION')    this.totalModeActions += 1;
    else if (signal.operation === 'TICK' ||
             signal.operation === 'RUN_UNTIL_DONE') this.totalTicks += signal.tickCount;
    else if (signal.operation === 'RESET')     this.totalResets += 1;

    // Update lifecycle + phase state
    this.finalLifecycleState = signal.lifecycleState;
    this.finalPhase = signal.phase;
    this.finalPressureTier = signal.pressureTier;
    this.finalOutcome = signal.outcome;
    this.finalHealthScore = signal.healthScore;
    this.finalSeverity = signal.severity;

    // Track health score range
    if (signal.healthScore > this.peakHealthScore) this.peakHealthScore = signal.healthScore;
    if (signal.healthScore < this.lowestHealthScore) this.lowestHealthScore = signal.healthScore;
    this.healthScoreSum += signal.healthScore;
    this.healthScoreCount += 1;
  }

  public recordTrend(trend: LifecycleTrendSnapshot): void {
    this.latestTrend = trend;
  }

  public getReport(): LifecycleSessionReport {
    const endedAtMs = Date.now();
    const durationMs = Math.max(0, endedAtMs - this.startedAtMs);
    const avgHealthScore = this.healthScoreCount > 0
      ? this.healthScoreSum / this.healthScoreCount
      : 0;

    return {
      sessionId:           this.sessionId,
      userId:              this.userId,
      mode:                this.mode,
      startedAtMs:         this.startedAtMs,
      endedAtMs,
      durationMs,
      totalOperations:     this.totalOperations,
      totalTicks:          this.totalTicks,
      totalCardPlays:      this.totalCardPlays,
      totalModeActions:    this.totalModeActions,
      totalResets:         this.totalResets,
      finalLifecycleState: this.finalLifecycleState,
      finalPhase:          this.finalPhase,
      finalPressureTier:   this.finalPressureTier,
      finalOutcome:        this.finalOutcome,
      finalHealthScore:    this.finalHealthScore,
      finalSeverity:       this.finalSeverity,
      peakHealthScore:     Math.max(this.peakHealthScore, this.finalHealthScore),
      lowestHealthScore:   Math.min(this.lowestHealthScore, this.finalHealthScore),
      avgHealthScore,
      terminalReached:     this.finalOutcome !== null,
      startInput:          this.startInput,
      mlVector:            this.latestMLVector,
      trend:               this.latestTrend,
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 46 — LIFECYCLE COORDINATOR EVENT LOG
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Tamper-evident event log for lifecycle coordinator operations.
 * Each entry includes a tick seal for deterministic audit trail construction.
 */
export class LifecycleCoordinatorEventLog {
  private readonly sessionId: string;
  private readonly entries: LifecycleEventLogEntry[] = [];
  private readonly maxEntries: number;

  public constructor(sessionId: string, maxEntries = 500) {
    this.sessionId = sessionId;
    this.maxEntries = maxEntries;
  }

  public append(
    snapshot: RunStateSnapshot,
    lifecycleState: OrchestratorLifecycle,
    operation: LifecycleOperationKind,
    severity: LifecycleSeverity,
    healthScore: number,
    pressureTier: PressureTier | null,
    queuedEvents: number,
    lastFlushCount: number,
    durationMs: number,
    playCardInput?: PlayCardInput | null,
    modeActionInput?: ModeActionInput | null,
  ): LifecycleEventLogEntry {
    const entryId = createDeterministicId(
      'lifecycle-event',
      this.sessionId,
      String(this.entries.length),
      String(snapshot.tick),
      operation,
    );

    const snapshotChecksum = checksumSnapshot({
      runId:  snapshot.runId,
      tick:   snapshot.tick,
      phase:  snapshot.phase,
      outcome: snapshot.outcome,
    });

    const tickSeal = computeTickSeal({
      runId:           snapshot.runId,
      tick:            snapshot.tick,
      step:            operation,
      stateChecksum:   snapshotChecksum,
      eventChecksums:  [entryId],
    });

    const actionId: ModeActionId | null = modeActionInput?.actionId ?? null;
    const targeting: Targeting | null = (playCardInput as PlayCardInput & { targeting?: Targeting })?.targeting ?? null;

    const entry: LifecycleEventLogEntry = {
      entryId,
      sessionId:      this.sessionId,
      runId:          snapshot.runId,
      tick:           snapshot.tick,
      timestampMs:    Date.now(),
      operation,
      lifecycleState,
      phase:          snapshot.phase,
      pressureTier,
      outcome:        snapshot.outcome,
      playCardInput:  playCardInput ?? null,
      modeActionInput: modeActionInput ?? null,
      actionId,
      targeting,
      severity,
      healthScore,
      tickSeal,
      snapshotChecksum,
      queuedEvents,
      lastFlushCount,
      durationMs,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    return entry;
  }

  public getAll(): readonly LifecycleEventLogEntry[] {
    return this.entries;
  }

  public getRecent(count: number): readonly LifecycleEventLogEntry[] {
    return this.entries.slice(-count);
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public size(): number {
    return this.entries.length;
  }

  public getOperationBreakdown(): Record<LifecycleOperationKind, number> {
    const breakdown = Object.fromEntries(
      LIFECYCLE_OPERATION_KINDS.map((op) => [op, 0]),
    ) as Record<LifecycleOperationKind, number>;
    for (const entry of this.entries) {
      breakdown[entry.operation] = (breakdown[entry.operation] ?? 0) + 1;
    }
    return breakdown;
  }

  public getSeverityBreakdown(): Record<LifecycleSeverity, number> {
    const breakdown = Object.fromEntries(
      LIFECYCLE_SEVERITY_LEVELS.map((s) => [s, 0]),
    ) as Record<LifecycleSeverity, number>;
    for (const entry of this.entries) {
      breakdown[entry.severity] = (breakdown[entry.severity] ?? 0) + 1;
    }
    return breakdown;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 47 — LIFECYCLE COORDINATOR ANNOTATOR
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Annotator for lifecycle coordinator signals.
 * Produces LifecycleAnnotationBundle entries from chat signals.
 * Configurable verbosity for development vs production use.
 */
export class LifecycleCoordinatorAnnotator {
  private readonly verbosity: 'DEFAULT' | 'STRICT' | 'VERBOSE';

  public constructor(verbosity: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT') {
    this.verbosity = verbosity;
  }

  public annotate(
    signal: LifecycleChatSignal,
    resetCount: number,
  ): LifecycleAnnotationBundle {
    return buildLifecycleAnnotation(signal, resetCount);
  }

  public annotateNarration(signal: LifecycleChatSignal): LifecycleNarrationHint {
    return buildLifecycleNarrationHint(signal);
  }

  public shouldEmit(signal: LifecycleChatSignal): boolean {
    if (this.verbosity === 'VERBOSE') return true;
    if (this.verbosity === 'STRICT') {
      return signal.severity === 'HIGH' || signal.severity === 'CRITICAL';
    }
    // DEFAULT: emit for non-trivial operations
    return signal.operation !== 'GET_SNAPSHOT' &&
           signal.operation !== 'GET_LIFECYCLE' &&
           signal.operation !== 'GET_FLUSH_COUNT' &&
           signal.operation !== 'GET_QUEUED_EVENT_COUNT' &&
           signal.operation !== 'GET_TICK_HISTORY';
  }

  public getVerbosity(): string {
    return this.verbosity;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 48 — LIFECYCLE COORDINATOR INSPECTOR
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Inspector for lifecycle coordinator health diagnostics.
 * Produces LifecycleInspectionBundle from event log and tracker state.
 */
export class LifecycleCoordinatorInspector {
  public inspect(
    eventLog: LifecycleCoordinatorEventLog,
    sessionTracker: LifecycleCoordinatorSessionTracker,
    currentLifecycleState: OrchestratorLifecycle,
    latestSnapshot: RunStateSnapshot | null,
    latestMLVector: LifecycleMLVector | null,
    latestDLTensor: LifecycleDLTensor | null,
  ): LifecycleInspectionBundle {
    const entries = eventLog.getAll();
    const opBreakdown = eventLog.getOperationBreakdown();
    const severityBreakdown = eventLog.getSeverityBreakdown();

    const healthScores = entries.map((e) => e.healthScore);
    const avgHealth = healthScores.length > 0
      ? healthScores.reduce((a, b) => a + b, 0) / healthScores.length
      : 0;
    const minHealth = healthScores.length > 0 ? Math.min(...healthScores) : 0;
    const maxHealth = healthScores.length > 0 ? Math.max(...healthScores) : 0;

    const variance = healthScores.length > 1
      ? healthScores.reduce((a, h) => a + (h - avgHealth) ** 2, 0) / healthScores.length
      : 0;
    const stdDev = Math.sqrt(variance);

    const avgTickDuration = entries.length > 0
      ? entries.reduce((a, e) => a + e.durationMs, 0) / entries.length
      : 0;
    const avgQueued = entries.length > 0
      ? entries.reduce((a, e) => a + e.queuedEvents, 0) / entries.length
      : 0;
    const avgFlush = entries.length > 0
      ? entries.reduce((a, e) => a + e.lastFlushCount, 0) / entries.length
      : 0;
    const terminalReached = entries.some((e) => e.outcome !== null);
    const finalOutcome = latestSnapshot?.outcome ?? null;

    // Generate recommendations
    const recommendations: string[] = [];
    if (avgHealth < 0.3) recommendations.push('Session health is critically low — check for excessive resets or abandoned runs.');
    if (stdDev > 0.3) recommendations.push('Health score is highly volatile — game pressure events may be too frequent.');
    if (opBreakdown.RESET > 3) recommendations.push('Multiple resets detected — investigate run stability.');
    if (!terminalReached && entries.length > 100) recommendations.push('Long session without terminal — consider reviewing max tick budget.');
    if (avgTickDuration > 200) recommendations.push('High average tick duration — check for engine performance bottlenecks.');
    if (recommendations.length === 0) recommendations.push('Session health looks good — no interventions needed.');

    const report = sessionTracker.getReport();
    void report;

    return {
      sessionId:        sessionTracker.sessionId,
      runId:            latestSnapshot?.runId ?? 'none',
      inspectedAtMs:    Date.now(),
      lifecycleState:   currentLifecycleState,
      totalEntries:     entries.length,
      operationBreakdown: opBreakdown,
      severityBreakdown,
      avgHealthScore:   avgHealth,
      minHealthScore:   minHealth,
      maxHealthScore:   maxHealth,
      healthScoreStdDev: stdDev,
      avgTickDurationMs: avgTickDuration,
      avgQueuedEvents:  avgQueued,
      avgFlushCount:    avgFlush,
      terminalReached,
      finalOutcome,
      recommendations,
      mlVector:         latestMLVector,
      dlTensor:         latestDLTensor,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART O — FUNCTIONAL EXTRACTOR SINGLETONS
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 49 — ML EXTRACTOR + DL BUILDER SINGLETONS
// ──────────────────────────────────────────────────────────────────────────────

/** Functional ML extractor singleton — wraps extractLifecycleMLVector. */
export const ZERO_LIFECYCLE_ML_EXTRACTOR = Object.freeze({
  extract:      extractLifecycleMLVector,
  labels:       LIFECYCLE_ML_FEATURE_LABELS,
  featureCount: LIFECYCLE_ML_FEATURE_COUNT,
  validate:     validateLifecycleMLVector,
  flatten:      flattenLifecycleMLVector,
  serialize:    serializeLifecycleMLVector,
  clone:        cloneLifecycleMLVector,
  similarity:   computeLifecycleMLSimilarity,
  topFeatures:  getTopLifecycleFeatures,
  namedMap:     buildLifecycleMLNamedMap,
});

/** Functional DL tensor builder singleton — wraps buildLifecycleDLTensor. */
export const ZERO_LIFECYCLE_DL_BUILDER = Object.freeze({
  build:      buildLifecycleDLTensor,
  shape:      LIFECYCLE_DL_TENSOR_SHAPE,
  rowLabels:  LIFECYCLE_DL_ROW_LABELS,
  colLabels:  LIFECYCLE_DL_COL_LABELS,
  flatten:    flattenLifecycleDLTensor,
  column:     extractLifecycleDLColumn,
  serialize:  serializeLifecycleDLTensor,
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 50 — ANNOTATOR + INSPECTOR SINGLETONS
// ──────────────────────────────────────────────────────────────────────────────

/** Default annotator — emits for all non-trivial operations. */
export const LIFECYCLE_DEFAULT_ANNOTATOR = new LifecycleCoordinatorAnnotator('DEFAULT');

/** Strict annotator — emits only for HIGH/CRITICAL severity signals. */
export const LIFECYCLE_STRICT_ANNOTATOR = new LifecycleCoordinatorAnnotator('STRICT');

/** Verbose annotator — emits for every operation including reads. */
export const LIFECYCLE_VERBOSE_ANNOTATOR = new LifecycleCoordinatorAnnotator('VERBOSE');

/** Default inspector singleton. */
export const LIFECYCLE_DEFAULT_INSPECTOR = new LifecycleCoordinatorInspector();

// ══════════════════════════════════════════════════════════════════════════════
// PART P — CORE CLASS (EXPANDED)
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 51 — RUNLIFECYCLECOORDINATOR
// ──────────────────────────────────────────────────────────────────────────────

/**
 * RunLifecycleCoordinator — authoritative lifecycle surface over EngineOrchestrator.
 *
 * Responsibilities:
 * - Thin facade: keeps external callers out of direct engine wiring
 * - Deterministic run start / play / action / tick / drain operations
 * - Operation tracking for ML/DL feature extraction
 * - Chat signal emission after significant operations
 * - Session state management for trend and inspection analytics
 *
 * All state mutation is strictly through EngineOrchestrator.
 * All analytics are computed from EngineOrchestrator read surfaces.
 */
export class RunLifecycleCoordinator {
  private readonly orchestrator: EngineOrchestrator;

  // Internal tracking state
  private readonly sessionStartedAtMs: number;
  private startInput: CoordinatorStartInput | null = null;
  private readonly operationCounts: Record<LifecycleOperationKind, number>;
  private lifecycleTransitionCount = 0;
  private resetCount = 0;
  private lastLifecycleState: OrchestratorLifecycle = 'IDLE';
  private pressureTier: PressureTier | null = null;
  private latestHealthScore = 0;
  private latestSeverity: LifecycleSeverity = 'LOW';

  public constructor(orchestrator?: EngineOrchestrator) {
    this.orchestrator = orchestrator ?? new EngineOrchestrator();
    this.sessionStartedAtMs = Date.now();
    this.operationCounts = Object.fromEntries(
      LIFECYCLE_OPERATION_KINDS.map((op) => [op, 0]),
    ) as Record<LifecycleOperationKind, number>;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Core lifecycle operations
  // ──────────────────────────────────────────────────────────────────────────

  public start(
    inputOrUserId: CoordinatorStartInput | string,
    modeArg?: ModeCode,
    seedArg?: string,
  ): RunStateSnapshot {
    const input = this.normalizeStartInput(inputOrUserId, modeArg, seedArg);
    this.startInput = typeof inputOrUserId !== 'string' ? inputOrUserId : {
      userId: inputOrUserId,
      mode:   modeArg ?? 'solo',
      seed:   seedArg,
    };
    const snapshot = this.orchestrator.startRun(input);
    this._trackOperation('START');
    this._trackLifecycleTransition();
    this._updatePressureTier(snapshot);
    this._recomputeHealth(snapshot);
    return snapshot;
  }

  public play(
    definitionIdOrInput: string | PlayCardInput,
    actorIdArg?: string,
    targetingArg: Targeting = 'SELF',
  ): RunStateSnapshot {
    const snapshot = this.orchestrator.playCard(
      definitionIdOrInput as string | PlayCardInput,
      actorIdArg,
      targetingArg,
    );
    this._trackOperation('PLAY');
    this._updatePressureTier(snapshot);
    this._recomputeHealth(snapshot);
    return snapshot;
  }

  public action(
    actionIdOrInput: ModeActionId | ModeActionInput,
    payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot {
    let snapshot: RunStateSnapshot;
    if (typeof actionIdOrInput === 'string') {
      snapshot = this.orchestrator.dispatchModeAction({ actionId: actionIdOrInput, payload });
    } else {
      snapshot = this.orchestrator.dispatchModeAction(actionIdOrInput);
    }
    this._trackOperation('ACTION');
    this._updatePressureTier(snapshot);
    this._recomputeHealth(snapshot);
    return snapshot;
  }

  public tick(options: CoordinatorTickOptions = {}): RunStateSnapshot {
    const count = options.count ?? 1;
    const stopOnTerminal = options.stopOnTerminal ?? true;

    let snapshot = this.orchestrator.getSnapshot();
    for (let index = 0; index < count; index += 1) {
      snapshot = this.orchestrator.advanceTick();
      this._trackOperation('TICK');
      this._trackLifecycleTransition();
      if (stopOnTerminal && snapshot.outcome !== null) {
        break;
      }
    }
    this._updatePressureTier(snapshot);
    this._recomputeHealth(snapshot);
    return snapshot;
  }

  public runUntilDone(options: CoordinatorRunUntilDoneOptions = {}): RunStateSnapshot {
    const maxTicks = options.maxTicks ?? 500;
    const snapshot = this.orchestrator.runUntilDone(maxTicks);
    this._trackOperation('RUN_UNTIL_DONE');
    this._trackLifecycleTransition();
    this._updatePressureTier(snapshot);
    this._recomputeHealth(snapshot);
    return snapshot;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Read surfaces
  // ──────────────────────────────────────────────────────────────────────────

  public getSnapshot(): RunStateSnapshot {
    this._trackOperation('GET_SNAPSHOT');
    return this.orchestrator.getSnapshot();
  }

  public getLifecycle(): OrchestratorLifecycle {
    this._trackOperation('GET_LIFECYCLE');
    return this.orchestrator.getLifecycle();
  }

  public getLastFlushCount(): number {
    this._trackOperation('GET_FLUSH_COUNT');
    return this.orchestrator.getLastFlush().length;
  }

  public getQueuedEventCount(): number {
    this._trackOperation('GET_QUEUED_EVENT_COUNT');
    return this.orchestrator.getQueuedEventCount();
  }

  public getTickHistory(): readonly TickExecutionSummary[] {
    this._trackOperation('GET_TICK_HISTORY');
    return this.orchestrator.getTickHistory();
  }

  public reset(): void {
    this.orchestrator.reset();
    this._trackOperation('RESET');
    this.resetCount += 1;
    this.lifecycleTransitionCount += 1;
    this.lastLifecycleState = 'IDLE';
    this.pressureTier = null;
    this.latestHealthScore = 0;
    this.latestSeverity = 'LOW';
    // Reset per-operation counts
    for (const op of LIFECYCLE_OPERATION_KINDS) {
      this.operationCounts[op] = 0;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Analytics surfaces
  // ──────────────────────────────────────────────────────────────────────────

  /** Extract the current lifecycle ML feature vector. */
  public extractMLVector(): LifecycleMLVector {
    const snapshot = this.orchestrator.getSnapshot();
    return extractLifecycleMLVector({
      snapshot,
      lifecycleState:          this.orchestrator.getLifecycle(),
      sessionStartedAtMs:      this.sessionStartedAtMs,
      operationCounts:         this.operationCounts,
      tickHistory:             this.orchestrator.getTickHistory(),
      startInput:              this.startInput,
      queuedEventCount:        this.orchestrator.getQueuedEventCount(),
      lastFlushCount:          this.orchestrator.getLastFlush().length,
      lifecycleTransitionCount: this.lifecycleTransitionCount,
      resetCount:              this.resetCount,
      pressureTier:            this.pressureTier,
    });
  }

  /** Build the current DL tensor from the ML vector. */
  public buildDLTensor(): LifecycleDLTensor {
    const snapshot = this.orchestrator.getSnapshot();
    const mlVector = this.extractMLVector();
    return buildLifecycleDLTensor(mlVector, snapshot.mode, this.pressureTier);
  }

  /** Build the current lifecycle chat signal. */
  public buildChatSignal(operation?: LifecycleOperationKind): LifecycleChatSignal {
    const snapshot = this.orchestrator.getSnapshot();
    const lifecycleState = this.orchestrator.getLifecycle();
    const op = operation ?? 'GET_SNAPSHOT';
    return buildLifecycleChatSignal(
      snapshot, lifecycleState, op,
      this.sessionStartedAtMs, this.operationCounts,
      this.orchestrator.getTickHistory(), this.startInput,
      this.orchestrator.getQueuedEventCount(),
      this.orchestrator.getLastFlush().length,
      this.lifecycleTransitionCount, this.resetCount,
      this.pressureTier,
    );
  }

  /** Build an annotation bundle from the current state. */
  public buildAnnotation(operation?: LifecycleOperationKind): LifecycleAnnotationBundle {
    const signal = this.buildChatSignal(operation);
    return buildLifecycleAnnotation(signal, this.resetCount);
  }

  /** Build a narration hint from the current state. */
  public buildNarrationHint(operation?: LifecycleOperationKind): LifecycleNarrationHint {
    const signal = this.buildChatSignal(operation);
    return buildLifecycleNarrationHint(signal);
  }

  /** Build a health snapshot from the current state. */
  public buildHealthSnapshot(
    sessionId: string,
    botStateDistribution?: Partial<Record<BotState, number>>,
    activeShieldLayers?: readonly ShieldLayerId[],
  ): LifecycleHealthSnapshot {
    const signal = this.buildChatSignal();
    return buildLifecycleHealthSnapshot(
      signal, sessionId,
      botStateDistribution ?? {},
      activeShieldLayers ?? LIFECYCLE_ALL_SHIELD_LAYER_IDS,
    );
  }

  /** Get the current composite health score (0-1). */
  public getHealthScore(): number {
    return this.latestHealthScore;
  }

  /** Get the current severity classification. */
  public getSeverity(): LifecycleSeverity {
    return this.latestSeverity;
  }

  /** Get the current pressure tier. */
  public getPressureTier(): PressureTier | null {
    return this.pressureTier;
  }

  /** Get the total operation count across all kinds. */
  public getTotalOperationCount(): number {
    return Object.values(this.operationCounts).reduce((a, b) => a + b, 0);
  }

  /** Get the operation counts breakdown by kind. */
  public getOperationCounts(): Readonly<Record<LifecycleOperationKind, number>> {
    return this.operationCounts;
  }

  /** Get the reset count for this session. */
  public getResetCount(): number {
    return this.resetCount;
  }

  /** Get the lifecycle transition count for this session. */
  public getLifecycleTransitionCount(): number {
    return this.lifecycleTransitionCount;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private _trackOperation(op: LifecycleOperationKind): void {
    this.operationCounts[op] = (this.operationCounts[op] ?? 0) + 1;
  }

  private _trackLifecycleTransition(): void {
    const currentState = this.orchestrator.getLifecycle();
    if (currentState !== this.lastLifecycleState) {
      this.lifecycleTransitionCount += 1;
      this.lastLifecycleState = currentState;
    }
  }

  private _updatePressureTier(snapshot: RunStateSnapshot): void {
    // Infer pressure tier from snapshot phase as a proxy when direct pressure state
    // is not available from the coordinator surface.
    const phaseToTier: Record<RunPhase, PressureTier> = {
      FOUNDATION:  'T1',
      ESCALATION:  'T2',
      SOVEREIGNTY: 'T3',
    };
    if (snapshot.outcome !== null) {
      this.pressureTier = 'T4';
    } else {
      this.pressureTier = phaseToTier[snapshot.phase] ?? 'T0';
    }
  }

  private _recomputeHealth(snapshot: RunStateSnapshot): void {
    const lifecycle = this.orchestrator.getLifecycle();
    const totalOps = this.getTotalOperationCount();
    const tickCount = this.operationCounts.TICK + this.operationCounts.RUN_UNTIL_DONE;
    const isTerminal = snapshot.outcome !== null;
    this.latestHealthScore = computeLifecycleHealthScore(
      lifecycle, totalOps, tickCount, isTerminal, this.latestSeverity,
    );
    this.latestSeverity = classifyLifecycleSeverity(this.latestHealthScore);
  }

  private normalizeStartInput(
    inputOrUserId: CoordinatorStartInput | string,
    modeArg?: ModeCode,
    seedArg?: string,
  ): StartRunInput {
    if (typeof inputOrUserId !== 'string') {
      return {
        userId:                      inputOrUserId.userId,
        mode:                        inputOrUserId.mode,
        seed:                        inputOrUserId.seed,
        runId:                       inputOrUserId.runId,
        communityHeatModifier:       inputOrUserId.communityHeatModifier,
        tags:                        inputOrUserId.tags,
        modeOptions:                 inputOrUserId.modeOptions,
        forceProofFinalizeOnTerminal: inputOrUserId.forceProofFinalizeOnTerminal,
      };
    }

    if (!modeArg) {
      throw new Error('mode is required when start() is called with a userId string.');
    }

    return {
      userId: inputOrUserId,
      mode:   modeArg,
      seed:   seedArg,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART Q — FACTORY + EXPORT BUNDLE
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 52 — FACTORY FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create a RunLifecycleCoordinatorWithAnalytics bundle.
 * Wires all analytics surfaces (trend, session, event log, annotator, inspector)
 * around a new or provided EngineOrchestrator instance.
 */
export function createRunLifecycleCoordinatorWithAnalytics(
  deps: RunLifecycleCoordinatorDependencies = {},
): RunLifecycleCoordinatorWithAnalytics {
  const coordinator = new RunLifecycleCoordinator(deps.orchestrator);
  const sessionId = deps.sessionId ?? createDeterministicId(
    'lifecycle-analytics', String(Date.now()),
  );

  const trendAnalyzer   = new LifecycleCoordinatorTrendAnalyzer(sessionId, 50);
  const sessionTracker  = new LifecycleCoordinatorSessionTracker('system', sessionId);
  const eventLog        = new LifecycleCoordinatorEventLog(sessionId, 500);
  const annotator       = new LifecycleCoordinatorAnnotator('DEFAULT');
  const inspector       = new LifecycleCoordinatorInspector();

  return {
    coordinator,
    trendAnalyzer,
    sessionTracker,
    eventLog,
    annotator,
    inspector,
    sessionId,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 53 — BUILD EXPORT BUNDLE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete LifecycleExportBundle from coordinator + analytics surfaces.
 * Used for offline training, audit export, and post-run analysis pipelines.
 */
export function buildLifecycleExportBundle(
  bundle: RunLifecycleCoordinatorWithAnalytics,
  finalSnapshot: RunStateSnapshot,
): LifecycleExportBundle {
  const { coordinator, trendAnalyzer, sessionTracker, eventLog, inspector, sessionId } = bundle;

  const latestSignal = coordinator.buildChatSignal('GET_SNAPSHOT');
  const mlVector = coordinator.extractMLVector();
  const dlTensor = coordinator.buildDLTensor();
  const annotation = coordinator.buildAnnotation('GET_SNAPSHOT');
  const narrationHint = coordinator.buildNarrationHint('GET_SNAPSHOT');
  const healthSnapshot = coordinator.buildHealthSnapshot(sessionId);
  const trend = trendAnalyzer.getSnapshot();
  const sessionReport = sessionTracker.getReport();
  const inspectionBundle = inspector.inspect(
    eventLog,
    sessionTracker,
    coordinator.getLifecycle(),
    finalSnapshot,
    mlVector,
    dlTensor,
  );

  const runSummary = buildLifecycleRunSummary(sessionTracker, latestSignal);
  const exportId = createDeterministicId('lifecycle-export', sessionId, String(Date.now()));

  return {
    exportId,
    sessionId,
    exportedAtMs:    Date.now(),
    sessionReport,
    inspectionBundle,
    runSummary,
    healthSnapshot,
    trend,
    recentEvents:    eventLog.getRecent(20),
    mlVector,
    dlTensor,
    chatSignal:      latestSignal,
    annotation,
    narrationHint,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 54 — SHIELD LAYER LABEL ACCESSOR (exercises SHIELD_LAYER_LABEL_BY_ID)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get the human-readable label for a shield layer.
 * Used in health snapshot rendering and chat annotation.
 */
export function getLifecycleShieldLayerLabel(layerId: ShieldLayerId): string {
  return SHIELD_LAYER_LABEL_BY_ID[layerId];
}

/**
 * Get the counterability resistance score for a lifecycle annotation.
 * Used in attack response classification within annotation bundles.
 */
export function getLifecycleCounterabilityScore(counterability: Counterability): number {
  return COUNTERABILITY_RESISTANCE_SCORE[counterability];
}

/**
 * Get the targeting spread factor for a lifecycle card play.
 * Used in operation flow analytics and card play quality scoring.
 */
export function getLifecycleTargetingSpread(targeting: Targeting): number {
  return TARGETING_SPREAD_FACTOR[targeting];
}

/**
 * Get the divergence potential normalized value for a given potential level.
 * Used in mode profile DL tensor row construction.
 */
export function getLifecycleDivergenceNorm(potential: DivergencePotential): number {
  return DIVERGENCE_POTENTIAL_NORMALIZED[potential];
}

/**
 * Get the visibility concealment factor for a given visibility level.
 * Used in health snapshot visibility classification.
 */
export function getLifecycleVisibilityConcealmentFactor(level: VisibilityLevel): number {
  return VISIBILITY_CONCEALMENT_FACTOR[level];
}

/**
 * Get the integrity risk score for a given integrity status.
 * Used in annotation bundle integrityFlag scoring.
 */
export function getLifecycleIntegrityRiskScore(status: IntegrityStatus): number {
  return INTEGRITY_STATUS_RISK_SCORE[status];
}

/**
 * Get the verified grade numeric score for a run grade.
 * Used in run summary quality classification.
 */
export function getLifecycleVerifiedGradeScore(grade: VerifiedGrade): number {
  return VERIFIED_GRADE_NUMERIC_SCORE[grade];
}

/**
 * Get the card rarity weight for a given rarity tier.
 * Used in card play quality scoring in the operation flow analytics.
 */
export function getLifecycleCardRarityWeight(rarity: CardRarity): number {
  return CARD_RARITY_WEIGHT[rarity];
}
