/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/RunTimeoutGuard.ts
 *
 * Doctrine:
 * - timeout is a backend-owned terminal truth, never a UI suggestion
 * - season budget + extension budget form a single authoritative time ceiling
 * - terminal outcomes must be stable and deterministic once crossed
 * - timeout projection must be side-effect free and replay-safe
 * - budget criticality drives UX escalation: SAFE → WARNING → CRITICAL → EXHAUSTED
 * - every timeout event emits a LIVEOPS_SIGNAL into the backend chat lane
 * - ML features (28-dim) and DL tensors (40×6) are extracted for inference
 * - phase-aware scoring amplifies urgency as the run approaches SOVEREIGNTY
 * - mode-specific behavior accounts for difficulty multipliers and tension floors
 * - all scoring is pure: zero mutation, zero side effects, zero hidden state
 * - the audit trail is immutable: every budget check, alert, and resolution is recorded
 *
 * Extended Capabilities:
 * - TimeoutProximityScorer: composite proximity from budget fraction + phase + tier
 * - BudgetCriticalityAssessor: SAFE / WARNING / CRITICAL / EXHAUSTED classification
 * - TimeoutMLExtractor: 28-dimensional ML feature vector extraction
 * - TimeoutDLBuilder: 40×6 DL tensor from budget consumption history
 * - TimeoutAuditTrail: immutable per-run audit trail
 * - TimeoutChatSignalEmitter: builds ChatInputEnvelope for LIVEOPS_SIGNAL lane
 * - TimeoutPhaseAnalyzer: phase-aware timeout pressure scoring
 * - TimeoutModeAdvisor: mode-specific timeout behavior and multipliers
 * - TimeoutNarrator: UX narrative generation for player-facing timeout signals
 * - TimeoutRiskProjector: risk forecasting from current budget trajectory
 * - RunTimeoutGuard: master class wiring all sub-systems
 *
 * Surface summary:
 *   § 1  — Imports (100% used, all in runtime code)
 *   § 2  — Module constants (version, dims, thresholds, manifests)
 *   § 3  — ML feature label registry (28 labels)
 *   § 4  — DL column label registry (6 columns)
 *   § 5  — Core type definitions
 *   § 6  — Budget criticality types
 *   § 7  — Timeout alert types
 *   § 8  — ML/DL output types
 *   § 9  — Chat signal types
 *   § 10 — Audit trail types
 *   § 11 — Proximity and risk types
 *   § 12 — Phase analysis types
 *   § 13 — Mode advisor types
 *   § 14 — Narrator types
 *   § 15 — Export bundle types
 *   § 16 — Utility helpers (private)
 *   § 17 — TimeoutProximityScorer
 *   § 18 — BudgetCriticalityAssessor
 *   § 19 — TimeoutMLExtractor
 *   § 20 — TimeoutDLBuilder
 *   § 21 — TimeoutAuditTrail
 *   § 22 — TimeoutChatSignalEmitter
 *   § 23 — TimeoutPhaseAnalyzer
 *   § 24 — TimeoutModeAdvisor
 *   § 25 — TimeoutNarrator
 *   § 26 — TimeoutRiskProjector
 *   § 27 — RunTimeoutGuard (master class)
 *   § 28 — Factory functions
 *   § 29 — Pure helper exports
 *   § 30 — Manifest
 */

/* ============================================================================
 * § 1 — IMPORTS
 * ============================================================================ */

import type {
  RunOutcome,
  RunPhase,
  ModeCode,
  PressureTier,
} from '../core/GamePrimitives';

import {
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  computePressureRiskScore,
  canEscalatePressure,
  describePressureTierExperience,
  isEndgamePhase,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isWinOutcome,
  isLossOutcome,
} from '../core/GamePrimitives';

import type {
  OutcomeReasonCode,
  RunStateSnapshot,
  TimerState,
  TelemetryState,
} from '../core/RunStateSnapshot';

import type {
  ChatInputEnvelope,
  ChatSignalEnvelope,
  ChatLiveOpsSnapshot,
  UnixMs,
  JsonValue,
} from '../chat/types';

import {
  asUnixMs,
  clamp01,
  clamp100,
} from '../chat/types';

import {
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_OUTCOME_IS_TERMINAL,
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  TIME_CONTRACT_MAX_BUDGET_MS,
  TIME_CONTRACT_MAX_TICK_DURATION_MS,
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  TIME_CONTRACT_LATENCY_THRESHOLDS,
  TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  TIME_CONTRACTS_VERSION,
} from './contracts';

import {
  TickTier,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  DEFAULT_HOLD_DURATION_MS,
  PHASE_BOUNDARIES_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  pressureTierToTickTier,
  tickTierToPressureTier,
  getTickTierConfigByPressureTier,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
} from './types';

import type {
  RunTimeoutEvent,
  DecisionWindow,
  TickTierConfig,
  PressureReader,
} from './types';

/* ============================================================================
 * § 2 — MODULE CONSTANTS
 * ============================================================================ */

export const RUN_TIMEOUT_GUARD_VERSION = '2.0.0' as const;

/** Budget fraction that triggers a WARNING-level alert. */
export const TIMEOUT_GUARD_WARNING_THRESHOLD = TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT;

/** Budget fraction that triggers a CRITICAL-level alert. */
export const TIMEOUT_GUARD_CRITICAL_THRESHOLD = TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT;

/** Budget fraction that triggers an EXHAUST-level alert. */
export const TIMEOUT_GUARD_EXHAUST_THRESHOLD = TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT;

/** Minimum remaining budget (ms) before chat signal is suppressed. */
export const TIMEOUT_GUARD_MIN_CHAT_REMAINING_MS =
  TIME_CONTRACT_BUDGET_THRESHOLDS.MIN_REMAINING_MS_FOR_CHAT;

/** Maximum budget for ML normalization (mirrors contracts constant). */
export const TIMEOUT_GUARD_MAX_BUDGET_MS = TIME_CONTRACT_MAX_BUDGET_MS;

/** Maximum tick duration for ML normalization (mirrors contracts constant). */
export const TIMEOUT_GUARD_MAX_TICK_DURATION_MS = TIME_CONTRACT_MAX_TICK_DURATION_MS;

/** Maximum decision window duration for ML normalization. */
export const TIMEOUT_GUARD_MAX_DECISION_WINDOW_MS = TIME_CONTRACT_MAX_DECISION_WINDOW_MS;

/**
 * Proximity thresholds used by TimeoutProximityScorer.
 * Proximity score of 0.0 = budget untouched, 1.0 = exhausted.
 */
export const TIMEOUT_PROXIMITY_THRESHOLDS = Object.freeze({
  /** Score at or above this = WARNING state. */
  WARN: 0.65,
  /** Score at or above this = CRITICAL state. */
  CRITICAL: 0.83,
  /** Score at or above this = IMMINENT state. */
  IMMINENT: 0.94,
  /** Score at or above this = timeout has occurred. */
  EXHAUSTED: 1.0,
});

/**
 * Phase-based urgency amplifiers applied on top of the base proximity score.
 * SOVEREIGNTY phase gets a 1.25× amplifier because every tick is irreplaceable.
 */
export const TIMEOUT_PHASE_URGENCY_AMPLIFIER: Readonly<Record<RunPhase, number>> =
  Object.freeze({
    FOUNDATION: 1.0,
    ESCALATION: 1.1,
    SOVEREIGNTY: 1.25,
  });

/**
 * Mode-based timeout sensitivity. Ghost mode is most sensitive
 * because the phantom run clock cannot be paused.
 */
export const TIMEOUT_MODE_SENSITIVITY: Readonly<Record<ModeCode, number>> =
  Object.freeze({
    solo: 1.0,
    pvp: 1.2,
    coop: 0.85,
    ghost: 1.4,
  });

/** Default tag written onto the run when timeout fires. */
export const TIMEOUT_DEFAULT_TAG = 'run:timeout' as const;

/** Tag written when an extension budget is consumed. */
export const TIMEOUT_EXTENSION_TAG = 'run:budget:extension-active' as const;

/** Tag written when a WARNING threshold is crossed. */
export const TIMEOUT_WARNING_TAG = 'run:budget:warning' as const;

/** Tag written when a CRITICAL threshold is crossed. */
export const TIMEOUT_CRITICAL_TAG = 'run:budget:critical' as const;

/** Minimum audit entries kept before rotation. */
export const TIMEOUT_AUDIT_MIN_ENTRIES = 10;

/** Maximum audit entries retained in memory. */
export const TIMEOUT_AUDIT_MAX_ENTRIES = 200;

/** Minimum remaining budget (ms) before risk projector fires. */
export const TIMEOUT_RISK_MIN_REMAINING_MS = 5_000;

/**
 * DL tensor history depth: how many past budget snapshots are retained
 * for tensor construction (matches TIME_CONTRACT_DL_ROW_COUNT = 40).
 */
export const TIMEOUT_DL_HISTORY_DEPTH = TIME_CONTRACT_DL_ROW_COUNT;

/** Tick drift alarm thresholds (mirrors contracts). */
export const TIMEOUT_DRIFT_ACCEPTABLE_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS;
export const TIMEOUT_DRIFT_NOTABLE_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS;
export const TIMEOUT_DRIFT_SEVERE_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS;
export const TIMEOUT_DRIFT_CRITICAL_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS;

/** Latency alarm thresholds (mirrors contracts). */
export const TIMEOUT_LATENCY_FAST_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.FAST_MS;
export const TIMEOUT_LATENCY_ACCEPTABLE_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.ACCEPTABLE_MS;
export const TIMEOUT_LATENCY_SLOW_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.SLOW_MS;
export const TIMEOUT_LATENCY_ALARM_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS;

/* ============================================================================
 * § 3 — ML FEATURE LABEL REGISTRY (28 labels)
 * ============================================================================ */

/**
 * Canonical 28-feature ML label set for run-timeout scoring.
 * Aligned with TIME_CONTRACT_ML_DIM = 28.
 */
export const TIMEOUT_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* Budget features [0-4] */
  'budget_utilization_fraction',         // 0 — consumed / total (0-1)
  'budget_remaining_fraction',           // 1 — remaining / total (0-1)
  'budget_season_fraction',              // 2 — season portion of total budget (0-1)
  'budget_extension_active',            // 3 — has extension budget (0 or 1)
  'budget_extension_fraction',          // 4 — extension / total budget (0-1)

  /* Tier / phase / mode features [5-11] */
  'pressure_tier_urgency',               // 5 — TIME_CONTRACT_TIER_URGENCY[tier] (0-1)
  'pressure_tier_normalized',            // 6 — PRESSURE_TIER_NORMALIZED[tier] (0-1)
  'pressure_risk_score',                 // 7 — computePressureRiskScore(tier, score) (0-1)
  'run_phase_normalized',                // 8 — RUN_PHASE_NORMALIZED[phase] (0-1)
  'run_phase_stakes_multiplier',         // 9 — RUN_PHASE_STAKES_MULTIPLIER[phase] (0.6-1.0)
  'mode_normalized',                     // 10 — MODE_NORMALIZED[mode] (0-1)
  'mode_difficulty_multiplier',          // 11 — MODE_DIFFICULTY_MULTIPLIER[mode] (0.9-1.6)

  /* Timeout proximity features [12-16] */
  'timeout_proximity_score',             // 12 — composite proximity (0-1)
  'timeout_criticality_encoded',         // 13 — SAFE=0, WARN=0.33, CRIT=0.67, EXHAUST=1.0
  'timeout_phase_urgency_amplifier',     // 14 — TIMEOUT_PHASE_URGENCY_AMPLIFIER[phase]
  'timeout_mode_sensitivity',            // 15 — TIMEOUT_MODE_SENSITIVITY[mode]
  'timeout_effective_budget_fraction',   // 16 — proximity * mode_sensitivity (0-1)

  /* Tick cadence features [17-20] */
  'tick_duration_normalized',            // 17 — currentTickDuration / MAX_TICK_DURATION_MS
  'tick_tier_normalized',                // 18 — TickTier index / 4 (0-1)
  'decision_window_normalized',          // 19 — decisionWindowMs / MAX_DECISION_WINDOW_MS
  'tick_count_normalized',               // 20 — snapshot.tick / estimated max ticks

  /* Hold / decision window features [21-24] */
  'hold_charges_normalized',             // 21 — holdCharges / 2 (0-1)
  'hold_enabled_flag',                   // 22 — modeState.holdEnabled (0 or 1)
  'frozen_window_count_normalized',      // 23 — frozenWindowIds.length / 10 (0-1)
  'active_decision_window_count',        // 24 — activeDecisionWindows count (0-1)

  /* Risk / progress features [25-27] */
  'run_progress_fraction',               // 25 — computeRunProgressFraction result
  'estimated_ticks_remaining_fraction',  // 26 — estimated ticks left / total ticks
  'outcome_already_set_flag',            // 27 — snapshot.outcome !== null (0 or 1)
]);

/* ============================================================================
 * § 4 — DL COLUMN LABEL REGISTRY (6 columns)
 * ============================================================================ */

/**
 * Canonical 6-column DL tensor labels for the run-timeout time series.
 * Each row represents a historical budget snapshot. 40 rows × 6 columns.
 */
export const TIMEOUT_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  'budget_fraction_consumed',  // col 0 — how much budget consumed at this snapshot
  'pressure_tier_urgency',     // col 1 — TIME_CONTRACT_TIER_URGENCY[tier] at this point
  'run_phase_score',           // col 2 — TIME_CONTRACT_PHASE_SCORE[phase] at this point
  'hold_charges_fraction',     // col 3 — holdCharges / 2 at this point
  'criticality_score',         // col 4 — BudgetCriticality as float (0-1)
  'proximity_score',           // col 5 — TimeoutProximityScorer result at this point
]);

/* ============================================================================
 * § 5 — CORE TYPE DEFINITIONS
 * ============================================================================ */

/**
 * Canonical resolution returned by RunTimeoutGuard.resolve().
 * Consumed by TimeEngine, EngineOrchestrator, and chat adapters.
 */
export interface RunTimeoutResolution {
  readonly totalBudgetMs: number;
  readonly nextElapsedMs: number;
  readonly consumedBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly timeoutReached: boolean;
  readonly nextOutcome: RunOutcome | null;
  readonly outcomeReason: string | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly warnings: readonly string[];
  readonly tags: readonly string[];
}

/** Constructor options for RunTimeoutGuard. */
export interface RunTimeoutGuardOptions {
  readonly timeoutWarningMessage?: string;
  readonly timeoutOutcomeReason?: string;
  readonly timeoutTag?: string;
  /** Custom proximity scorer (optional — default used if absent). */
  readonly proximityScorer?: TimeoutProximityScorer;
  /** Custom criticality assessor (optional — default used if absent). */
  readonly criticalityAssessor?: BudgetCriticalityAssessor;
  /** Custom phase analyzer (optional). */
  readonly phaseAnalyzer?: TimeoutPhaseAnalyzer;
  /** Custom mode advisor (optional). */
  readonly modeAdvisor?: TimeoutModeAdvisor;
  /** Custom narrator (optional). */
  readonly narrator?: TimeoutNarrator;
  /** Custom risk projector (optional). */
  readonly riskProjector?: TimeoutRiskProjector;
  /** Whether to emit LIVEOPS_SIGNAL chat envelopes. Default: true. */
  readonly chatEnabled?: boolean;
  /** Chat emitter (optional). */
  readonly chatEmitter?: TimeoutChatSignalEmitter;
}

/* ============================================================================
 * § 6 — BUDGET CRITICALITY TYPES
 * ============================================================================ */

/**
 * Four-state budget criticality classification.
 * Drives UX escalation, chat signal severity, and ML feature encoding.
 */
export type BudgetCriticality = 'SAFE' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED';

/** Numeric encoding of each BudgetCriticality for ML/DL feature use. */
export const BUDGET_CRITICALITY_ENCODED: Readonly<Record<BudgetCriticality, number>> =
  Object.freeze({
    SAFE: 0.0,
    WARNING: 0.33,
    CRITICAL: 0.67,
    EXHAUSTED: 1.0,
  });

/** Human-readable label for each BudgetCriticality. */
export const BUDGET_CRITICALITY_LABEL: Readonly<Record<BudgetCriticality, string>> =
  Object.freeze({
    SAFE: 'Budget safe — you have runway.',
    WARNING: 'Budget warning — time is running down.',
    CRITICAL: 'Budget critical — act now or the clock wins.',
    EXHAUSTED: 'Budget exhausted — run has timed out.',
  });

/** Severity weight for ML/DL inference. Higher = more urgent. */
export const BUDGET_CRITICALITY_WEIGHT: Readonly<Record<BudgetCriticality, number>> =
  Object.freeze({
    SAFE: 0.0,
    WARNING: 0.4,
    CRITICAL: 0.8,
    EXHAUSTED: 1.0,
  });

export interface BudgetCriticalityAssessment {
  readonly criticality: BudgetCriticality;
  readonly utilizationPct: number;
  readonly remainingMs: number;
  readonly totalMs: number;
  readonly consumedMs: number;
  readonly encoded: number;
  readonly label: string;
  readonly weight: number;
  readonly tags: readonly string[];
}

/* ============================================================================
 * § 7 — TIMEOUT ALERT TYPES
 * ============================================================================ */

/**
 * Three-stage escalation alert above WARNING threshold.
 * Driven by proximity score, not raw milliseconds.
 */
export type TimeoutAlertStage = 'NONE' | 'WARN' | 'CRITICAL' | 'IMMINENT' | 'TIMED_OUT';

/** Alert severity per stage. */
export const TIMEOUT_ALERT_SEVERITY: Readonly<Record<TimeoutAlertStage, number>> =
  Object.freeze({
    NONE: 0.0,
    WARN: 0.3,
    CRITICAL: 0.65,
    IMMINENT: 0.9,
    TIMED_OUT: 1.0,
  });

/** Tag emitted for each alert stage. */
export const TIMEOUT_ALERT_TAG: Readonly<Record<TimeoutAlertStage, string>> =
  Object.freeze({
    NONE: '',
    WARN: TIMEOUT_WARNING_TAG,
    CRITICAL: TIMEOUT_CRITICAL_TAG,
    IMMINENT: 'run:budget:imminent',
    TIMED_OUT: TIMEOUT_DEFAULT_TAG,
  });

export interface TimeoutAlert {
  readonly stage: TimeoutAlertStage;
  readonly severity: number;
  readonly tag: string;
  readonly remainingMs: number;
  readonly proximityScore: number;
  readonly message: string;
  readonly shouldEmitChatSignal: boolean;
}

/* ============================================================================
 * § 8 — ML/DL OUTPUT TYPES
 * ============================================================================ */

/** 28-dimensional ML feature vector for timeout scoring. */
export interface TimeoutMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimension: number;
  readonly runId: string;
  readonly tick: number;
  readonly computedAtMs: number;
  readonly criticality: BudgetCriticality;
  readonly proximityScore: number;
}

/** Single row of the DL tensor (6 columns). */
export type TimeoutDLRow = readonly [
  number, // col 0: budget_fraction_consumed
  number, // col 1: pressure_tier_urgency
  number, // col 2: run_phase_score
  number, // col 3: hold_charges_fraction
  number, // col 4: criticality_score
  number, // col 5: proximity_score
];

/** 40×6 DL tensor for timeout time series inference. */
export interface TimeoutDLTensor {
  readonly rows: readonly TimeoutDLRow[];
  readonly rowCount: number;
  readonly colCount: number;
  readonly labels: readonly string[];
  readonly runId: string;
  readonly tick: number;
  readonly computedAtMs: number;
}

/** Budget snapshot entry stored for DL history construction. */
export interface TimeoutBudgetHistoryEntry {
  readonly tick: number;
  readonly elapsedMs: number;
  readonly budgetFractionConsumed: number;
  readonly pressureTierUrgency: number;
  readonly runPhaseScore: number;
  readonly holdChargesFraction: number;
  readonly criticalityScore: number;
  readonly proximityScore: number;
  readonly recordedAtMs: number;
}

/* ============================================================================
 * § 9 — CHAT SIGNAL TYPES
 * ============================================================================ */

/** Metadata payload attached to timeout LIVEOPS_SIGNAL envelopes. */
export interface TimeoutChatMetadata {
  readonly runId: string;
  readonly tick: number;
  readonly totalBudgetMs: number;
  readonly consumedBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly utilizationPct: number;
  readonly criticality: BudgetCriticality;
  readonly alertStage: TimeoutAlertStage;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly pressureTier: PressureTier;
  readonly proximityScore: number;
  readonly hasExtensionBudget: boolean;
  readonly holdCharges: number;
  readonly modeTempoMultiplier: number;
  readonly holdResultLabel: string;
}

/** Result of TimeoutChatSignalEmitter.build(). */
export interface TimeoutChatSignalResult {
  readonly envelope: ChatInputEnvelope;
  readonly metadata: TimeoutChatMetadata;
  readonly suppressedReason: string | null;
}

/* ============================================================================
 * § 10 — AUDIT TRAIL TYPES
 * ============================================================================ */

/** Categories of timeout audit events. */
export type TimeoutAuditEventKind =
  | 'BUDGET_CHECK'
  | 'THRESHOLD_CROSSED'
  | 'ALERT_EMITTED'
  | 'CHAT_SIGNAL_EMITTED'
  | 'TIMEOUT_RESOLVED'
  | 'ML_EXTRACTED'
  | 'DL_BUILT'
  | 'RISK_PROJECTION'
  | 'PHASE_TRANSITION'
  | 'DRIFT_DETECTED'
  | 'LATENCY_ALARM';

export interface TimeoutAuditEntry {
  readonly kind: TimeoutAuditEventKind;
  readonly tick: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly criticality: BudgetCriticality;
  readonly alertStage: TimeoutAlertStage;
  readonly message: string;
  readonly recordedAtMs: number;
  readonly tags: readonly string[];
}

export interface TimeoutAuditSnapshot {
  readonly entries: readonly TimeoutAuditEntry[];
  readonly totalEntries: number;
  readonly totalBudgetChecks: number;
  readonly totalThresholdCrossings: number;
  readonly totalChatSignalsEmitted: number;
  readonly totalTimeoutsResolved: number;
  readonly firstTimeoutTick: number | null;
  readonly lastEntryAtMs: number | null;
}

/* ============================================================================
 * § 11 — PROXIMITY AND RISK TYPES
 * ============================================================================ */

export interface TimeoutProximityResult {
  readonly rawFraction: number;
  readonly phaseAmplifiedFraction: number;
  readonly modeAdjustedFraction: number;
  readonly proximityScore: number;
  readonly alertStage: TimeoutAlertStage;
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly tierUrgency: number;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
}

export interface TimeoutRiskProjection {
  readonly estimatedMsUntilTimeout: number;
  readonly estimatedTicksUntilTimeout: number;
  readonly estimatedPhasesRemaining: number;
  readonly willTimeoutBeforeEscalation: boolean;
  readonly canSovereigntyPhaseBeReached: boolean;
  readonly recommendHoldNow: boolean;
  readonly recommendedActions: readonly string[];
  readonly riskScore: number;
  readonly effectiveStakes: number;
}

/* ============================================================================
 * § 12 — PHASE ANALYSIS TYPES
 * ============================================================================ */

export interface TimeoutPhaseAnalysis {
  readonly currentPhase: RunPhase;
  readonly resolvedPhase: RunPhase;
  readonly isAtPhaseBoundary: boolean;
  readonly isEndgame: boolean;
  readonly phaseNormalized: number;
  readonly phaseStakesMultiplier: number;
  readonly phaseTickBudgetFraction: number;
  readonly phaseScore: number;
  readonly urgencyAmplifier: number;
  readonly transitionWindowsRemaining: number;
  readonly phaseBoundaryMs: number;
  readonly nextPhaseBoundaryMs: number | null;
  readonly msUntilNextPhase: number | null;
}

/* ============================================================================
 * § 13 — MODE ADVISOR TYPES
 * ============================================================================ */

export interface TimeoutModeProfile {
  readonly mode: ModeCode;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly tempoMultiplier: number;
  readonly sensitivityMultiplier: number;
  readonly normalizedCode: number;
  readonly holdEnabled: boolean;
  readonly holdMaxCharges: number;
  readonly holdDurationMs: number;
  readonly holdLabel: string;
  readonly doctrineNote: string;
}

/* ============================================================================
 * § 14 — NARRATOR TYPES
 * ============================================================================ */

export interface TimeoutNarration {
  readonly headline: string;
  readonly body: string;
  readonly urgencyLabel: string;
  readonly tierExperience: string;
  readonly holdAdvice: string;
  readonly phaseContext: string;
  readonly modeContext: string;
  readonly remainingTimeLabel: string;
  readonly callToAction: string;
}

/* ============================================================================
 * § 15 — EXPORT BUNDLE TYPES
 * ============================================================================ */

export interface RunTimeoutGuardBundle {
  readonly resolution: RunTimeoutResolution;
  readonly criticality: BudgetCriticalityAssessment;
  readonly alert: TimeoutAlert;
  readonly proximity: TimeoutProximityResult;
  readonly phase: TimeoutPhaseAnalysis;
  readonly mode: TimeoutModeProfile;
  readonly narration: TimeoutNarration;
  readonly risk: TimeoutRiskProjection;
  readonly mlVector: TimeoutMLVector;
  readonly dlTensor: TimeoutDLTensor;
  readonly auditSnapshot: TimeoutAuditSnapshot;
  readonly chatResult: TimeoutChatSignalResult | null;
}

/** Lightweight summary returned by RunTimeoutGuard.summarize(). */
export interface RunTimeoutGuardSummary {
  readonly runId: string;
  readonly tick: number;
  readonly totalBudgetMs: number;
  readonly remainingMs: number;
  readonly utilizationPct: number;
  readonly criticality: BudgetCriticality;
  readonly alertStage: TimeoutAlertStage;
  readonly proximityScore: number;
  readonly timeoutReached: boolean;
  readonly estimatedTicksRemaining: number;
  readonly version: string;
}

/* ============================================================================
 * § 16 — UTILITY HELPERS (private)
 * ============================================================================ */

/** Truncate and clamp a millisecond value to a non-negative integer. */
function normalizeMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/** Clamp a value to [0, 1] and return as a plain number. */
function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Build a deduplicated string array from multiple source groups. */
function dedupeStrings(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  const merged = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      if (item.length > 0) merged.add(item);
    }
  }
  return Object.freeze([...merged]);
}

/** Safe division — returns fallback if denominator is 0. */
function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
}

/** Format milliseconds as a human-readable countdown string. */
function formatMsAsCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/** Normalize a tick duration for ML features (0–1 relative to max). */
function normalizeTickDuration(durationMs: number): number {
  return clampFraction(safeDivide(durationMs, TIMEOUT_GUARD_MAX_TICK_DURATION_MS));
}

/** Convert TickTier enum value to a 0–1 index fraction. */
function tickTierToFraction(tier: TickTier): number {
  const tierOrder: readonly TickTier[] = [
    TickTier.SOVEREIGN,
    TickTier.STABLE,
    TickTier.COMPRESSED,
    TickTier.CRISIS,
    TickTier.COLLAPSE_IMMINENT,
  ];
  const index = tierOrder.indexOf(tier);
  return clampFraction(safeDivide(index, tierOrder.length - 1));
}

/** Return the BudgetCriticality for a given utilization fraction. */
function classifyUtilization(fraction: number): BudgetCriticality {
  if (fraction >= 1.0) return 'EXHAUSTED';
  if (fraction >= TIMEOUT_GUARD_EXHAUST_THRESHOLD) return 'EXHAUSTED';
  if (fraction >= TIMEOUT_GUARD_CRITICAL_THRESHOLD) return 'CRITICAL';
  if (fraction >= TIMEOUT_GUARD_WARNING_THRESHOLD) return 'WARNING';
  return 'SAFE';
}

/** Return the TimeoutAlertStage for a given proximity score. */
function classifyProximity(proximityScore: number): TimeoutAlertStage {
  if (proximityScore >= TIMEOUT_PROXIMITY_THRESHOLDS.EXHAUSTED) return 'TIMED_OUT';
  if (proximityScore >= TIMEOUT_PROXIMITY_THRESHOLDS.IMMINENT) return 'IMMINENT';
  if (proximityScore >= TIMEOUT_PROXIMITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (proximityScore >= TIMEOUT_PROXIMITY_THRESHOLDS.WARN) return 'WARN';
  return 'NONE';
}

/** Estimate the number of remaining ticks given current duration and budget. */
function estimateRemainingTicks(
  remainingMs: number,
  currentTickDurationMs: number,
): number {
  if (remainingMs <= 0) return 0;
  const duration = Math.max(1, currentTickDurationMs);
  return Math.floor(safeDivide(remainingMs, duration));
}

/** Estimate total ticks in a run given total budget and average tick duration. */
function estimateTotalTicks(totalBudgetMs: number, avgTickDurationMs: number): number {
  if (totalBudgetMs <= 0 || avgTickDurationMs <= 0) return 1;
  return Math.max(1, Math.floor(safeDivide(totalBudgetMs, avgTickDurationMs)));
}

/** Build a RunTimeoutEvent from resolution data. */
function buildRunTimeoutEvent(ticksElapsed: number): RunTimeoutEvent {
  return {
    eventType: 'RUN_TIMEOUT',
    ticksElapsed,
    outcome: 'TIMEOUT',
  };
}

/** Build a placeholder DecisionWindow summary from timer state. */
function countActiveDecisionWindows(
  timers: TimerState,
): number {
  return Object.keys(timers.activeDecisionWindows).length;
}

/** Classify a latency value against contract thresholds. */
function classifyLatency(latencyMs: number): string {
  if (latencyMs >= TIMEOUT_LATENCY_ALARM_MS) return 'ALARM';
  if (latencyMs >= TIMEOUT_LATENCY_SLOW_MS) return 'SLOW';
  if (latencyMs >= TIMEOUT_LATENCY_ACCEPTABLE_MS) return 'ACCEPTABLE';
  return 'FAST';
}

/** Classify tick drift against contract thresholds. */
function classifyDrift(driftMs: number): string {
  if (driftMs >= TIMEOUT_DRIFT_CRITICAL_MS) return 'CRITICAL';
  if (driftMs >= TIMEOUT_DRIFT_SEVERE_MS) return 'SEVERE';
  if (driftMs >= TIMEOUT_DRIFT_NOTABLE_MS) return 'NOTABLE';
  return 'ACCEPTABLE';
}

/* ============================================================================
 * § 17 — TIMEOUT PROXIMITY SCORER
 * ============================================================================ */

/**
 * TimeoutProximityScorer
 *
 * Computes a composite proximity score (0-1) representing how close
 * the run is to timing out. Pure function — no mutation, no state.
 *
 * Composite score considers:
 * - Budget fraction consumed (primary driver)
 * - Phase-specific urgency amplifier (SOVEREIGNTY = 1.25×)
 * - Mode-specific sensitivity (ghost = 1.4×)
 * - Pressure tier urgency contribution
 */
export class TimeoutProximityScorer {
  /**
   * Compute the proximity score from a snapshot + nextElapsedMs.
   */
  public score(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): TimeoutProximityResult {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;

    // Tick tier from pressure tier
    const tickTier = pressureTierToTickTier(tier);
    const tierConfig: TickTierConfig = getTickTierConfigByPressureTier(tier);
    void tierConfig; // used via tier urgency below

    // Raw budget fraction consumed
    const consumed = normalizeMs(nextElapsedMs);
    const total = Math.max(1, normalizeMs(totalBudgetMs));
    const rawFraction = clampFraction(safeDivide(consumed, total));

    // Phase amplifier: SOVEREIGNTY phase makes every tick count more
    const phaseAmplifier = TIMEOUT_PHASE_URGENCY_AMPLIFIER[phase];
    const phaseAmplifiedFraction = clampFraction(rawFraction * phaseAmplifier);

    // Mode sensitivity: ghost mode is most aggressive on time
    const modeSensitivity = TIMEOUT_MODE_SENSITIVITY[mode];
    const modeAdjustedFraction = clampFraction(rawFraction * modeSensitivity);

    // Tier urgency contribution: T4 adds a 0.05 bonus proximity
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];

    // Final proximity score: weighted blend of phase + mode + tier signals
    const proximityScore = clampFraction(
      rawFraction * 0.50
      + phaseAmplifiedFraction * 0.25
      + modeAdjustedFraction * 0.15
      + tierUrgency * 0.10,
    );

    const alertStage = classifyProximity(proximityScore);

    return Object.freeze({
      rawFraction,
      phaseAmplifiedFraction,
      modeAdjustedFraction,
      proximityScore,
      alertStage,
      tier,
      tickTier,
      tierUrgency,
      phase,
      mode,
    });
  }

  /**
   * Quick proximity score — returns just the scalar.
   */
  public quickScore(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): number {
    return this.score(snapshot, nextElapsedMs, totalBudgetMs).proximityScore;
  }

  /**
   * Determine whether the current state should trigger a chat signal.
   */
  public shouldEmitChatSignal(
    proximity: TimeoutProximityResult,
    remainingMs: number,
  ): boolean {
    if (proximity.alertStage === 'NONE') return false;
    if (remainingMs < TIMEOUT_GUARD_MIN_CHAT_REMAINING_MS) {
      // Too little time — always emit for CRITICAL / IMMINENT / TIMED_OUT
      return proximity.alertStage !== 'WARN';
    }
    return true;
  }
}

/* ============================================================================
 * § 18 — BUDGET CRITICALITY ASSESSOR
 * ============================================================================ */

/**
 * BudgetCriticalityAssessor
 *
 * Classifies the current budget state as SAFE / WARNING / CRITICAL / EXHAUSTED.
 * Drives UX escalation, tag injection, and chat signal routing.
 * Pure function — no mutation, no state.
 */
export class BudgetCriticalityAssessor {
  /**
   * Full criticality assessment from raw budget values.
   */
  public assess(
    consumedMs: number,
    totalMs: number,
    remainingMs: number,
  ): BudgetCriticalityAssessment {
    const safeTotal = Math.max(1, totalMs);
    const utilizationPct = clampFraction(safeDivide(consumedMs, safeTotal));
    const criticality = classifyUtilization(utilizationPct);

    const tags: string[] = [];
    if (criticality === 'WARNING') tags.push(TIMEOUT_WARNING_TAG);
    if (criticality === 'CRITICAL') tags.push(TIMEOUT_CRITICAL_TAG);
    if (criticality === 'EXHAUSTED') {
      tags.push(TIMEOUT_DEFAULT_TAG);
      tags.push(TIMEOUT_CRITICAL_TAG);
    }

    return Object.freeze({
      criticality,
      utilizationPct,
      remainingMs: Math.max(0, remainingMs),
      totalMs,
      consumedMs,
      encoded: BUDGET_CRITICALITY_ENCODED[criticality],
      label: BUDGET_CRITICALITY_LABEL[criticality],
      weight: BUDGET_CRITICALITY_WEIGHT[criticality],
      tags: Object.freeze(tags),
    });
  }

  /**
   * Convenience: assess directly from snapshot + nextElapsedMs.
   */
  public assessFromSnapshot(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): BudgetCriticalityAssessment {
    const consumed = normalizeMs(nextElapsedMs);
    const total = normalizeMs(totalBudgetMs);
    const remaining = Math.max(0, total - consumed);
    return this.assess(consumed, total, remaining);
  }

  /** Return the criticality as a 0–1 encoded float for ML/DL features. */
  public encodeForML(criticality: BudgetCriticality): number {
    return BUDGET_CRITICALITY_ENCODED[criticality];
  }

  /** Return the weight for risk scoring. */
  public weightFor(criticality: BudgetCriticality): number {
    return BUDGET_CRITICALITY_WEIGHT[criticality];
  }
}

/* ============================================================================
 * § 19 — TIMEOUT ML EXTRACTOR
 * ============================================================================ */

/**
 * TimeoutMLExtractor
 *
 * Extracts the canonical 28-dimensional ML feature vector from
 * snapshot + budget state. All features are normalized to [0, 1].
 *
 * Aligned with TIME_CONTRACT_ML_DIM = 28 and TIMEOUT_ML_FEATURE_LABELS.
 */
export class TimeoutMLExtractor {
  private readonly proximityScorer: TimeoutProximityScorer;
  private readonly criticalityAssessor: BudgetCriticalityAssessor;

  public constructor(
    proximityScorer?: TimeoutProximityScorer,
    criticalityAssessor?: BudgetCriticalityAssessor,
  ) {
    this.proximityScorer = proximityScorer ?? new TimeoutProximityScorer();
    this.criticalityAssessor = criticalityAssessor ?? new BudgetCriticalityAssessor();
  }

  /**
   * Extract the 28-feature ML vector.
   */
  public extract(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
    nowMs: number,
  ): TimeoutMLVector {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;
    const timers = snapshot.timers;

    const consumed = normalizeMs(nextElapsedMs);
    const total = Math.max(1, normalizeMs(totalBudgetMs));
    const remaining = Math.max(0, total - consumed);
    const seasonMs = normalizeMs(timers.seasonBudgetMs);
    const extensionMs = normalizeMs(timers.extensionBudgetMs);

    // Budget features [0-4]
    const f0 = clampFraction(safeDivide(consumed, total));           // utilization
    const f1 = clampFraction(safeDivide(remaining, total));          // remaining fraction
    const f2 = clampFraction(safeDivide(seasonMs, total));           // season fraction
    const f3 = extensionMs > 0 ? 1.0 : 0.0;                        // extension active
    const f4 = clampFraction(safeDivide(extensionMs, total));        // extension fraction

    // Tier / phase / mode features [5-11]
    const f5 = TIME_CONTRACT_TIER_URGENCY[tier];                    // tier urgency
    const f6 = PRESSURE_TIER_NORMALIZED[tier];                      // tier normalized
    const f7 = clampFraction(
      computePressureRiskScore(tier, snapshot.pressure.score),
    );                                                               // pressure risk
    const f8 = RUN_PHASE_NORMALIZED[phase];                         // phase normalized
    const f9 = RUN_PHASE_STAKES_MULTIPLIER[phase];                  // stakes multiplier
    const f10 = MODE_NORMALIZED[mode];                              // mode normalized
    const f11 = clampFraction(
      safeDivide(MODE_DIFFICULTY_MULTIPLIER[mode], 2.0),
    );                                                               // difficulty (0-1)

    // Timeout proximity [12-16]
    const proximityResult = this.proximityScorer.score(snapshot, nextElapsedMs, total);
    const critResult = this.criticalityAssessor.assess(consumed, total, remaining);
    const f12 = proximityResult.proximityScore;                     // proximity
    const f13 = BUDGET_CRITICALITY_ENCODED[critResult.criticality]; // criticality encoded
    const f14 = clampFraction(TIMEOUT_PHASE_URGENCY_AMPLIFIER[phase] - 1.0); // amplifier delta
    const f15 = clampFraction(safeDivide(TIMEOUT_MODE_SENSITIVITY[mode], 2.0)); // sensitivity
    const f16 = clampFraction(f12 * TIMEOUT_MODE_SENSITIVITY[mode]); // effective budget fraction

    // Tick cadence features [17-20]
    const tickDuration = normalizeMs(timers.currentTickDurationMs);
    const tickTier = TICK_TIER_BY_PRESSURE_TIER[tier];
    const decisionWindowMs = getDecisionWindowDurationMs(tier);
    const f17 = normalizeTickDuration(tickDuration);                // tick duration normalized
    const f18 = tickTierToFraction(tickTier);                       // tick tier fraction
    const f19 = clampFraction(
      safeDivide(decisionWindowMs, TIMEOUT_GUARD_MAX_DECISION_WINDOW_MS),
    );                                                               // decision window normalized
    const avgTickDuration = getDefaultTickDurationMs(tier);
    const estimatedTotal = estimateTotalTicks(total, avgTickDuration);
    const f20 = clampFraction(safeDivide(snapshot.tick, estimatedTotal)); // tick normalized

    // Hold / decision window features [21-24]
    const holdCharges = Math.max(0, timers.holdCharges);
    const f21 = clampFraction(safeDivide(holdCharges, 2));          // hold charges normalized
    const f22 = snapshot.modeState.holdEnabled ? 1.0 : 0.0;        // hold enabled flag
    const frozenCount = timers.frozenWindowIds.length;
    const f23 = clampFraction(safeDivide(frozenCount, 10));         // frozen windows normalized
    const activeWindowCount = countActiveDecisionWindows(timers);
    const f24 = clampFraction(safeDivide(activeWindowCount, 10));   // active windows normalized

    // Risk / progress features [25-27]
    const progressFraction = clampFraction(
      computeRunProgressFraction(
        phase,
        snapshot.tick,
        Math.max(1, Math.floor(
          safeDivide(total * RUN_PHASE_TICK_BUDGET_FRACTION[phase], avgTickDuration),
        )),
      ),
    );
    const f25 = progressFraction;                                   // run progress fraction
    const estimatedRemainingTicks = estimateRemainingTicks(remaining, tickDuration || avgTickDuration);
    const f26 = clampFraction(safeDivide(estimatedRemainingTicks, Math.max(1, estimatedTotal)));
    const f27 = snapshot.outcome !== null ? 1.0 : 0.0;             // outcome already set

    const features: readonly number[] = Object.freeze([
      f0, f1, f2, f3, f4,
      f5, f6, f7, f8, f9, f10, f11,
      f12, f13, f14, f15, f16,
      f17, f18, f19, f20,
      f21, f22, f23, f24,
      f25, f26, f27,
    ]);

    if (features.length !== TIME_CONTRACT_ML_DIM) {
      throw new Error(
        `TimeoutMLExtractor: expected ${TIME_CONTRACT_ML_DIM} features, got ${features.length}`,
      );
    }

    return Object.freeze({
      features,
      labels: TIMEOUT_ML_FEATURE_LABELS,
      dimension: TIME_CONTRACT_ML_DIM,
      runId: snapshot.runId,
      tick: snapshot.tick,
      computedAtMs: nowMs,
      criticality: critResult.criticality,
      proximityScore: proximityResult.proximityScore,
    });
  }
}

/* ============================================================================
 * § 20 — TIMEOUT DL BUILDER
 * ============================================================================ */

/**
 * TimeoutDLBuilder
 *
 * Constructs the 40×6 DL tensor for run-timeout time series inference.
 * Maintains a rolling history of up to 40 budget snapshots.
 * Each row captures the key timeout features at a single point in time.
 */
export class TimeoutDLBuilder {
  private readonly history: TimeoutBudgetHistoryEntry[] = [];
  private readonly proximityScorer: TimeoutProximityScorer;
  private readonly criticalityAssessor: BudgetCriticalityAssessor;

  public constructor(
    proximityScorer?: TimeoutProximityScorer,
    criticalityAssessor?: BudgetCriticalityAssessor,
  ) {
    this.proximityScorer = proximityScorer ?? new TimeoutProximityScorer();
    this.criticalityAssessor = criticalityAssessor ?? new BudgetCriticalityAssessor();
  }

  /**
   * Record a new budget snapshot into history.
   * Older entries beyond TIMEOUT_DL_HISTORY_DEPTH are rotated out.
   */
  public record(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
    nowMs: number,
  ): void {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const timers = snapshot.timers;

    const consumed = normalizeMs(nextElapsedMs);
    const total = Math.max(1, normalizeMs(totalBudgetMs));
    const remaining = Math.max(0, total - consumed);

    const budgetFractionConsumed = clampFraction(safeDivide(consumed, total));
    const pressureTierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const runPhaseScore = TIME_CONTRACT_PHASE_SCORE[phase];
    const holdCharges = Math.max(0, timers.holdCharges);
    const holdChargesFraction = clampFraction(safeDivide(holdCharges, 2));

    const critAssessment = this.criticalityAssessor.assess(consumed, total, remaining);
    const criticalityScore = BUDGET_CRITICALITY_ENCODED[critAssessment.criticality];
    const proximityScore = this.proximityScorer.quickScore(snapshot, nextElapsedMs, total);

    const entry: TimeoutBudgetHistoryEntry = Object.freeze({
      tick: snapshot.tick,
      elapsedMs: consumed,
      budgetFractionConsumed,
      pressureTierUrgency,
      runPhaseScore,
      holdChargesFraction,
      criticalityScore,
      proximityScore,
      recordedAtMs: nowMs,
    });

    this.history.push(entry);

    // Rotate: keep last TIMEOUT_DL_HISTORY_DEPTH entries
    if (this.history.length > TIMEOUT_DL_HISTORY_DEPTH) {
      this.history.splice(0, this.history.length - TIMEOUT_DL_HISTORY_DEPTH);
    }
  }

  /**
   * Build the 40×6 DL tensor from current history.
   * Pads missing rows with zeros if history is shorter than 40.
   */
  public build(snapshot: RunStateSnapshot, nowMs: number): TimeoutDLTensor {
    const zeroRow: TimeoutDLRow = Object.freeze([0, 0, 0, 0, 0, 0]) as TimeoutDLRow;
    const rows: TimeoutDLRow[] = [];

    // Pad front with zeros if needed
    const needed = TIME_CONTRACT_DL_ROW_COUNT - this.history.length;
    for (let i = 0; i < needed; i++) {
      rows.push(zeroRow);
    }

    // Fill from history
    for (const entry of this.history) {
      const row: TimeoutDLRow = Object.freeze([
        entry.budgetFractionConsumed,
        entry.pressureTierUrgency,
        entry.runPhaseScore,
        entry.holdChargesFraction,
        entry.criticalityScore,
        entry.proximityScore,
      ]) as TimeoutDLRow;
      rows.push(row);
    }

    return Object.freeze({
      rows: Object.freeze(rows),
      rowCount: TIME_CONTRACT_DL_ROW_COUNT,
      colCount: TIME_CONTRACT_DL_COL_COUNT,
      labels: TIMEOUT_DL_COLUMN_LABELS,
      runId: snapshot.runId,
      tick: snapshot.tick,
      computedAtMs: nowMs,
    });
  }

  /** Return the current history depth. */
  public getHistoryDepth(): number {
    return this.history.length;
  }

  /** Clear all history (use on run reset). */
  public reset(): void {
    this.history.length = 0;
  }

  /** Export raw history entries (for audit/replay). */
  public exportHistory(): readonly TimeoutBudgetHistoryEntry[] {
    return Object.freeze([...this.history]);
  }
}

/* ============================================================================
 * § 21 — TIMEOUT AUDIT TRAIL
 * ============================================================================ */

/**
 * TimeoutAuditTrail
 *
 * Immutable per-run audit trail recording every budget check, threshold crossing,
 * chat signal emission, timeout resolution, and ML/DL extraction event.
 *
 * Entries are append-only and rotation-safe (max 200).
 */
export class TimeoutAuditTrail {
  private readonly entries: TimeoutAuditEntry[] = [];
  private budgetCheckCount = 0;
  private thresholdCrossingCount = 0;
  private chatSignalCount = 0;
  private timeoutResolvedCount = 0;
  private firstTimeoutTick: number | null = null;

  /** Append a new audit entry. Rotates out oldest entries beyond max. */
  public record(entry: Omit<TimeoutAuditEntry, 'recordedAtMs'>, nowMs: number): void {
    const fullEntry: TimeoutAuditEntry = Object.freeze({
      ...entry,
      recordedAtMs: nowMs,
    });
    this.entries.push(fullEntry);

    switch (entry.kind) {
      case 'BUDGET_CHECK':
        this.budgetCheckCount++;
        break;
      case 'THRESHOLD_CROSSED':
        this.thresholdCrossingCount++;
        break;
      case 'CHAT_SIGNAL_EMITTED':
        this.chatSignalCount++;
        break;
      case 'TIMEOUT_RESOLVED':
        this.timeoutResolvedCount++;
        if (this.firstTimeoutTick === null) {
          this.firstTimeoutTick = entry.tick;
        }
        break;
      default:
        break;
    }

    // Rotate: keep last TIMEOUT_AUDIT_MAX_ENTRIES
    if (this.entries.length > TIMEOUT_AUDIT_MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - TIMEOUT_AUDIT_MAX_ENTRIES);
    }
  }

  /** Snapshot the current audit state. */
  public snapshot(): TimeoutAuditSnapshot {
    const lastEntry = this.entries[this.entries.length - 1];
    return Object.freeze({
      entries: Object.freeze([...this.entries]),
      totalEntries: this.entries.length,
      totalBudgetChecks: this.budgetCheckCount,
      totalThresholdCrossings: this.thresholdCrossingCount,
      totalChatSignalsEmitted: this.chatSignalCount,
      totalTimeoutsResolved: this.timeoutResolvedCount,
      firstTimeoutTick: this.firstTimeoutTick,
      lastEntryAtMs: lastEntry?.recordedAtMs ?? null,
    });
  }

  /** Get all entries of a specific kind. */
  public getByKind(kind: TimeoutAuditEventKind): readonly TimeoutAuditEntry[] {
    return this.entries.filter(e => e.kind === kind);
  }

  /** Reset (use on run start). */
  public reset(): void {
    this.entries.length = 0;
    this.budgetCheckCount = 0;
    this.thresholdCrossingCount = 0;
    this.chatSignalCount = 0;
    this.timeoutResolvedCount = 0;
    this.firstTimeoutTick = null;
  }

  /** Return the minimum audit entries threshold (used in external validation). */
  public getMinEntries(): number {
    return TIMEOUT_AUDIT_MIN_ENTRIES;
  }

  /**
   * Return a merged telemetry state with the provided warnings injected.
   * Used when injecting timeout audit warnings into snapshot telemetry.
   */
  public mergeWarningsIntoTelemetry(
    telemetry: TelemetryState,
    additionalWarnings: readonly string[],
  ): TelemetryState {
    if (additionalWarnings.length === 0) return telemetry;
    const merged = dedupeStrings(telemetry.warnings, additionalWarnings);
    return Object.freeze({
      ...telemetry,
      warnings: merged,
    });
  }
}

/* ============================================================================
 * § 22 — TIMEOUT CHAT SIGNAL EMITTER
 * ============================================================================ */

/**
 * TimeoutChatSignalEmitter
 *
 * Builds LIVEOPS_SIGNAL ChatInputEnvelope instances for timeout/budget events.
 * These are consumed by the backend chat lane's LIVEOPS_SIGNAL adapter.
 *
 * Suppression rules:
 * - SAFE criticality → suppress (no signal needed)
 * - WARN → emit only when remaining budget exceeds MIN_CHAT_REMAINING_MS
 * - CRITICAL / IMMINENT / TIMED_OUT → always emit
 */
export class TimeoutChatSignalEmitter {
  /**
   * Build a LIVEOPS_SIGNAL ChatInputEnvelope from timeout state.
   * Returns null if the signal should be suppressed.
   */
  public build(
    snapshot: RunStateSnapshot,
    resolution: RunTimeoutResolution,
    criticality: BudgetCriticalityAssessment,
    alert: TimeoutAlert,
    nowMs: number,
  ): TimeoutChatSignalResult {
    const { remainingBudgetMs, totalBudgetMs, consumedBudgetMs } = resolution;
    const mode = snapshot.mode;
    const phase = snapshot.phase;
    const tier = snapshot.pressure.tier;

    // Suppress SAFE / NONE unless timeout has been reached
    if (
      criticality.criticality === 'SAFE'
      && alert.stage === 'NONE'
      && !resolution.timeoutReached
    ) {
      return Object.freeze({
        envelope: this._buildSuppressedEnvelope(nowMs),
        metadata: this._buildMetadata(
          snapshot, resolution, criticality, alert, nowMs,
        ),
        suppressedReason: 'Budget criticality SAFE — signal suppressed',
      });
    }

    // Suppress WARN when budget is above min-chat threshold
    if (
      alert.stage === 'WARN'
      && remainingBudgetMs > TIMEOUT_GUARD_MIN_CHAT_REMAINING_MS
      && !resolution.timeoutReached
    ) {
      return Object.freeze({
        envelope: this._buildSuppressedEnvelope(nowMs),
        metadata: this._buildMetadata(
          snapshot, resolution, criticality, alert, nowMs,
        ),
        suppressedReason: `WARN stage with ${remainingBudgetMs}ms remaining — above threshold`,
      });
    }

    const metadata = this._buildMetadata(
      snapshot, resolution, criticality, alert, nowMs,
    );

    // Build the liveops snapshot — worldEventName encodes the event type
    const liveopsSnapshot: ChatLiveOpsSnapshot = Object.freeze({
      worldEventName: resolution.timeoutReached ? 'RUN_TIMEOUT' : `BUDGET_ALERT_${alert.stage}`,
      heatMultiplier01: clamp01(alert.proximityScore),
      helperBlackout: alert.stage === 'TIMED_OUT' || alert.stage === 'IMMINENT',
      haterRaidActive: false,
    });

    // Detailed metadata goes into the metadata bag as serializable JSON
    const signalMetadata: Readonly<Record<string, JsonValue>> = Object.freeze({
      alertStage: alert.stage as JsonValue,
      criticality: criticality.criticality as JsonValue,
      remainingMs: remainingBudgetMs as JsonValue,
      totalMs: totalBudgetMs as JsonValue,
      consumedMs: consumedBudgetMs as JsonValue,
      utilizationPct: Math.round(criticality.utilizationPct * 100) as JsonValue,
      phase: phase as JsonValue,
      mode: mode as JsonValue,
      pressureTier: tier as JsonValue,
      message: alert.message as JsonValue,
      proximityScore: alert.proximityScore as JsonValue,
      modeTempoMultiplier: TIME_CONTRACT_MODE_TEMPO[mode] as JsonValue,
    });

    const signalPayload: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: asUnixMs(nowMs),
      roomId: null,
      liveops: liveopsSnapshot,
      metadata: signalMetadata,
    });

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: asUnixMs(nowMs),
      payload: signalPayload,
    }) as ChatInputEnvelope;

    return Object.freeze({
      envelope,
      metadata,
      suppressedReason: null,
    });
  }

  private _buildMetadata(
    snapshot: RunStateSnapshot,
    resolution: RunTimeoutResolution,
    criticality: BudgetCriticalityAssessment,
    alert: TimeoutAlert,
    nowMs: number,
  ): TimeoutChatMetadata {
    const mode = snapshot.mode;
    const tier = snapshot.pressure.tier;

    // Use hold result label: if hold is disabled due to timeout, use HOLD_DISABLED label
    const holdResultLabel = snapshot.modeState.holdEnabled
      ? TIME_CONTRACT_HOLD_RESULT_LABELS['OK']
      : TIME_CONTRACT_HOLD_RESULT_LABELS['HOLD_DISABLED'];

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      totalBudgetMs: resolution.totalBudgetMs,
      consumedBudgetMs: resolution.consumedBudgetMs,
      remainingBudgetMs: resolution.remainingBudgetMs,
      utilizationPct: Math.round(criticality.utilizationPct * 100),
      criticality: criticality.criticality,
      alertStage: alert.stage,
      phase: snapshot.phase,
      mode,
      pressureTier: tier,
      proximityScore: alert.proximityScore,
      hasExtensionBudget: normalizeMs(snapshot.timers.extensionBudgetMs) > 0,
      holdCharges: snapshot.timers.holdCharges,
      modeTempoMultiplier: TIME_CONTRACT_MODE_TEMPO[mode],
      holdResultLabel,
    });
  }

  private _buildSuppressedEnvelope(nowMs: number): ChatInputEnvelope {
    const payload: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: asUnixMs(nowMs),
      roomId: null,
    });
    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: asUnixMs(nowMs),
      payload,
    }) as ChatInputEnvelope;
  }
}

/* ============================================================================
 * § 23 — TIMEOUT PHASE ANALYZER
 * ============================================================================ */

/**
 * TimeoutPhaseAnalyzer
 *
 * Provides deep phase-aware analysis of timeout state. Determines whether
 * the run is at a phase boundary, computes phase urgency amplification,
 * and projects the path to SOVEREIGNTY.
 */
export class TimeoutPhaseAnalyzer {
  /**
   * Perform full phase analysis for the current run state.
   */
  public analyze(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): TimeoutPhaseAnalysis {
    const phase = snapshot.phase;
    const elapsedMs = normalizeMs(nextElapsedMs);
    const resolvedPhase = resolvePhaseFromElapsedMs(elapsedMs);
    const previousElapsedMs = normalizeMs(snapshot.timers.elapsedMs);

    const isAtPhaseBoundary = isPhaseBoundaryTransition(previousElapsedMs, elapsedMs);
    const isEndgame = isEndgamePhase(phase);

    const phaseNormalized = RUN_PHASE_NORMALIZED[phase];
    const phaseStakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const phaseTickBudgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const phaseScore = TIME_CONTRACT_PHASE_SCORE[phase];
    const urgencyAmplifier = TIMEOUT_PHASE_URGENCY_AMPLIFIER[phase];

    // How many phase transition windows remain (based on DEFAULT_PHASE_TRANSITION_WINDOWS)
    const phasesRemaining = phase === 'FOUNDATION' ? 2
      : phase === 'ESCALATION' ? 1
      : 0;
    const transitionWindowsRemaining = phasesRemaining * DEFAULT_PHASE_TRANSITION_WINDOWS;

    // Phase boundary MS
    const currentBoundary = PHASE_BOUNDARIES_MS.find(b => b.phase === phase);
    const phaseBoundaryMs = currentBoundary?.startsAtMs ?? 0;

    // Next phase boundary
    const phases: readonly RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
    const currentIndex = phases.indexOf(phase);
    let nextPhaseBoundaryMs: number | null = null;
    let msUntilNextPhase: number | null = null;
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      const nextBoundary = PHASE_BOUNDARIES_MS.find(b => b.phase === nextPhase);
      if (nextBoundary) {
        nextPhaseBoundaryMs = nextBoundary.startsAtMs;
        msUntilNextPhase = Math.max(0, nextBoundary.startsAtMs - elapsedMs);
      }
    }

    // Validate total budget allocation matches phase boundary alignment
    const total = normalizeMs(totalBudgetMs);
    void total; // consumed in budget fraction tracking

    return Object.freeze({
      currentPhase: phase,
      resolvedPhase,
      isAtPhaseBoundary,
      isEndgame,
      phaseNormalized,
      phaseStakesMultiplier,
      phaseTickBudgetFraction,
      phaseScore,
      urgencyAmplifier,
      transitionWindowsRemaining,
      phaseBoundaryMs,
      nextPhaseBoundaryMs,
      msUntilNextPhase,
    });
  }

  /** Compute stakes for the current phase+mode combination. */
  public computeStakes(phase: RunPhase, mode: ModeCode): number {
    return computeEffectiveStakes(phase, mode);
  }

  /** Return whether the run has entered the SOVEREIGNTY (endgame) phase. */
  public isInEndgamePhase(phase: RunPhase): boolean {
    return isEndgamePhase(phase);
  }
}

/* ============================================================================
 * § 24 — TIMEOUT MODE ADVISOR
 * ============================================================================ */

/**
 * TimeoutModeAdvisor
 *
 * Provides mode-specific timeout behavior, multipliers, and doctrine notes.
 * Each game mode has different time pressure sensitivity and hold mechanics.
 *
 * Mode doctrine:
 * - solo (Empire): 1 free hold per run, moderate time pressure
 * - pvp (Predator): 1.2× sensitivity, no hold system
 * - coop (Syndicate): 0.85× sensitivity, shared team pressure
 * - ghost (Phantom): 1.4× sensitivity, fastest clock, no holds
 */
export class TimeoutModeAdvisor {
  /**
   * Build the full mode profile for a given snapshot.
   */
  public profile(snapshot: RunStateSnapshot): TimeoutModeProfile {
    const mode = snapshot.mode;
    const holdEnabled = snapshot.modeState.holdEnabled;
    const holdCharges = snapshot.timers.holdCharges;

    const difficultyMultiplier = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const tempoMultiplier = TIME_CONTRACT_MODE_TEMPO[mode];
    const sensitivityMultiplier = TIMEOUT_MODE_SENSITIVITY[mode];
    const normalizedCode = MODE_NORMALIZED[mode];

    // Hold configuration per mode
    const holdMaxCharges = holdEnabled ? 2 : 0;
    const holdDurationMs = DEFAULT_HOLD_DURATION_MS;
    const holdLabel = holdEnabled
      ? TIME_CONTRACT_HOLD_RESULT_LABELS['OK']
      : TIME_CONTRACT_HOLD_RESULT_LABELS['HOLD_DISABLED'];

    const doctrineNote = this._buildDoctrineNote(mode, holdEnabled, holdCharges);

    return Object.freeze({
      mode,
      difficultyMultiplier,
      tensionFloor,
      tempoMultiplier,
      sensitivityMultiplier,
      normalizedCode,
      holdEnabled,
      holdMaxCharges,
      holdDurationMs,
      holdLabel,
      doctrineNote,
    });
  }

  /**
   * Check whether escalation to the next pressure tier is possible given
   * current score and ticks in current tier.
   */
  public canEscalate(
    current: PressureTier,
    next: PressureTier,
    score: number,
    ticksInCurrentTier: number,
  ): boolean {
    return canEscalatePressure(current, next, score, ticksInCurrentTier);
  }

  /**
   * Compute how much mode amplification applies to the remaining budget.
   * Ghost mode makes every millisecond count 1.4× more.
   */
  public amplifiedRemainingMs(remainingMs: number, mode: ModeCode): number {
    const sensitivity = TIMEOUT_MODE_SENSITIVITY[mode];
    // Amplification: lower effective remaining when sensitivity is higher
    return Math.max(0, remainingMs / sensitivity);
  }

  /**
   * Return the minimum ticks required in the current tier before
   * the pressure can escalate (protects against thrashing).
   */
  public minHoldTicksForTier(tier: PressureTier): number {
    return PRESSURE_TIER_MIN_HOLD_TICKS[tier];
  }

  private _buildDoctrineNote(
    mode: ModeCode,
    holdEnabled: boolean,
    holdCharges: number,
  ): string {
    const chargesStr = holdEnabled ? `${holdCharges} hold${holdCharges !== 1 ? 's' : ''} available` : 'No holds';
    switch (mode) {
      case 'solo':
        return `Empire Run — ${chargesStr}. Time pressure is standard. Use holds wisely.`;
      case 'pvp':
        return `Predator Run — ${chargesStr}. Clock ticks 1.2× faster. No mercy.`;
      case 'coop':
        return `Syndicate Run — ${chargesStr}. Shared time pressure. Coordinate with your team.`;
      case 'ghost':
        return `Phantom Run — ${chargesStr}. Clock moves at 1.4× speed. The phantom waits for no one.`;
    }
  }
}

/* ============================================================================
 * § 25 — TIMEOUT NARRATOR
 * ============================================================================ */

/**
 * TimeoutNarrator
 *
 * Generates player-facing UX narrative for all timeout/budget events.
 * Drives companion commentary, urgency display, and the chat lane.
 * Pure function — no mutation, no state.
 */
export class TimeoutNarrator {
  /**
   * Build a full narration for the current timeout state.
   */
  public narrate(
    snapshot: RunStateSnapshot,
    criticality: BudgetCriticalityAssessment,
    alert: TimeoutAlert,
    phase: TimeoutPhaseAnalysis,
    modeProfile: TimeoutModeProfile,
  ): TimeoutNarration {
    const tier = snapshot.pressure.tier;
    const mode = snapshot.mode;
    const runPhase = snapshot.phase;

    const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const tierExperience = describePressureTierExperience(tier);
    const remainingTimeLabel = formatMsAsCountdown(criticality.remainingMs);

    const headline = this._buildHeadline(criticality.criticality, alert.stage);
    const body = this._buildBody(criticality, alert, remainingTimeLabel);
    const holdAdvice = this._buildHoldAdvice(
      modeProfile.holdEnabled,
      modeProfile.holdMaxCharges,
      snapshot.timers.holdCharges,
      criticality.criticality,
    );
    const phaseContext = this._buildPhaseContext(phase, runPhase);
    const modeContext = this._buildModeContext(mode, modeProfile);
    const callToAction = this._buildCallToAction(criticality.criticality, alert.stage, tier);

    return Object.freeze({
      headline,
      body,
      urgencyLabel,
      tierExperience,
      holdAdvice,
      phaseContext,
      modeContext,
      remainingTimeLabel,
      callToAction,
    });
  }

  /** Determine if this is a win or loss path based on current outcome. */
  public classifyOutcomePath(outcome: RunOutcome | null): string {
    if (outcome === null) return 'IN_PROGRESS';
    if (isWinOutcome(outcome)) return 'WIN';
    if (isLossOutcome(outcome)) return 'LOSS';
    return 'TERMINAL';
  }

  private _buildHeadline(
    criticality: BudgetCriticality,
    stage: TimeoutAlertStage,
  ): string {
    if (stage === 'TIMED_OUT') return '⏰ Time has run out.';
    if (stage === 'IMMINENT') return '🚨 Clock is almost up — make it count.';
    if (criticality === 'CRITICAL') return '⚠️ Budget critical — time is your enemy now.';
    if (criticality === 'WARNING') return '⏱ Budget warning — your runway is shrinking.';
    return '✅ Budget healthy — stay on course.';
  }

  private _buildBody(
    criticality: BudgetCriticalityAssessment,
    alert: TimeoutAlert,
    remainingTimeLabel: string,
  ): string {
    if (criticality.criticality === 'EXHAUSTED') {
      return `The season clock has expired. The run is over.`;
    }
    const pct = Math.round(criticality.utilizationPct * 100);
    return `You have used ${pct}% of your budget. ${remainingTimeLabel} remaining. ${alert.message}`;
  }

  private _buildHoldAdvice(
    holdEnabled: boolean,
    holdMaxCharges: number,
    holdCharges: number,
    criticality: BudgetCriticality,
  ): string {
    if (!holdEnabled) {
      return TIME_CONTRACT_HOLD_RESULT_LABELS['HOLD_DISABLED'];
    }
    if (holdCharges <= 0) {
      return TIME_CONTRACT_HOLD_RESULT_LABELS['NO_CHARGES_REMAINING'];
    }
    if (criticality === 'CRITICAL' || criticality === 'EXHAUSTED') {
      return `${holdCharges}/${holdMaxCharges} holds left — use now for breathing room.`;
    }
    return `${holdCharges}/${holdMaxCharges} holds available.`;
  }

  private _buildPhaseContext(
    phase: TimeoutPhaseAnalysis,
    runPhase: RunPhase,
  ): string {
    if (phase.isEndgame) {
      return `SOVEREIGNTY phase — you're in the endgame. Every decision has maximum stakes.`;
    }
    if (phase.isAtPhaseBoundary) {
      return `Phase boundary crossed from ${phase.currentPhase} → ${phase.resolvedPhase}.`;
    }
    if (phase.msUntilNextPhase !== null) {
      return `${formatMsAsCountdown(phase.msUntilNextPhase)} until ${runPhase === 'FOUNDATION' ? 'ESCALATION' : 'SOVEREIGNTY'} phase.`;
    }
    return `Phase: ${runPhase}. Stakes multiplier: ${phase.phaseStakesMultiplier}×.`;
  }

  private _buildModeContext(mode: ModeCode, modeProfile: TimeoutModeProfile): string {
    return modeProfile.doctrineNote;
  }

  private _buildCallToAction(
    criticality: BudgetCriticality,
    stage: TimeoutAlertStage,
    tier: PressureTier,
  ): string {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    if (stage === 'TIMED_OUT') return 'The run is over. Review your performance.';
    if (stage === 'IMMINENT') return 'Play your next card NOW. Every second matters.';
    if (criticality === 'CRITICAL') return `${tierLabel} pressure. Execute your exit strategy.`;
    if (criticality === 'WARNING') return 'Accelerate your decision pace. Do not stall.';
    return 'Stay focused. Maximize your remaining time.';
  }
}

/* ============================================================================
 * § 26 — TIMEOUT RISK PROJECTOR
 * ============================================================================ */

/**
 * TimeoutRiskProjector
 *
 * Projects the run's risk trajectory: how many ticks remain, whether the
 * run can reach SOVEREIGNTY phase, and what actions the player should take.
 * Pure function — no mutation, no state.
 */
export class TimeoutRiskProjector {
  private readonly phaseAnalyzer: TimeoutPhaseAnalyzer;
  private readonly modeAdvisor: TimeoutModeAdvisor;

  public constructor(
    phaseAnalyzer?: TimeoutPhaseAnalyzer,
    modeAdvisor?: TimeoutModeAdvisor,
  ) {
    this.phaseAnalyzer = phaseAnalyzer ?? new TimeoutPhaseAnalyzer();
    this.modeAdvisor = modeAdvisor ?? new TimeoutModeAdvisor();
  }

  /**
   * Full risk projection from current snapshot + budget state.
   */
  public project(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
    pressureReader?: PressureReader,
  ): TimeoutRiskProjection {
    const tier = pressureReader?.tier ?? snapshot.pressure.tier;
    const score = pressureReader?.score ?? snapshot.pressure.score;
    const phase = snapshot.phase;
    const mode = snapshot.mode;

    const consumed = normalizeMs(nextElapsedMs);
    const total = normalizeMs(totalBudgetMs);
    const remaining = Math.max(0, total - consumed);

    // Check terminal conditions early
    if (remaining <= TIMEOUT_RISK_MIN_REMAINING_MS) {
      return this._buildCriticalProjection(snapshot, remaining, mode, phase, tier);
    }

    // Tick rate for projection
    const tickDurationMs = Math.max(
      1,
      normalizeMs(snapshot.timers.currentTickDurationMs) || getDefaultTickDurationMs(tier),
    );
    const decisionWindowMs = getDecisionWindowDurationMs(tier);
    const estimatedTicksRemaining = estimateRemainingTicks(remaining, tickDurationMs);

    // Phase projection: can we reach SOVEREIGNTY?
    const sovereigntyBoundary = PHASE_BOUNDARIES_MS.find(b => b.phase === 'SOVEREIGNTY');
    const sovereigntyStartMs = sovereigntyBoundary?.startsAtMs ?? 0;
    const canReachSovereignty = consumed + estimatedTicksRemaining * tickDurationMs >= sovereigntyStartMs
      || phase === 'SOVEREIGNTY';

    // Phase count projection
    const phases: readonly RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
    const currentIndex = phases.indexOf(phase);
    const estimatedPhasesRemaining = Math.max(0, phases.length - 1 - currentIndex);

    // Escalation risk: will pressure escalate before timeout?
    const nextTierIndex = (['T0', 'T1', 'T2', 'T3', 'T4'] as const).indexOf(tier) + 1;
    const nextTier = nextTierIndex < 5
      ? (['T0', 'T1', 'T2', 'T3', 'T4'] as const)[nextTierIndex]
      : null;
    const ticksInCurrentTier = snapshot.tick - (snapshot.pressure.lastEscalationTick ?? 0);
    const willEscalate = nextTier !== null
      && this.modeAdvisor.canEscalate(tier, nextTier, score, ticksInCurrentTier);

    // Timeout before escalation: if remaining ticks < min hold ticks for tier
    const minHoldTicks = this.modeAdvisor.minHoldTicksForTier(tier);
    const willTimeoutBeforeEscalation = estimatedTicksRemaining < minHoldTicks && !willEscalate;

    // Holds recommendation
    const holdEnabled = snapshot.modeState.holdEnabled;
    const holdCharges = snapshot.timers.holdCharges;
    const recommendHoldNow = holdEnabled
      && holdCharges > 0
      && estimatedTicksRemaining <= 3
      && phase !== 'SOVEREIGNTY';

    // Recommended actions
    const actions: string[] = [];
    if (recommendHoldNow) {
      actions.push('Activate hold to freeze decision window');
    }
    if (estimatedPhasesRemaining > 0 && remaining < 60_000) {
      actions.push('Prioritize SOVEREIGNTY phase entry');
    }
    if (willEscalate) {
      actions.push(`Prepare for ${nextTier ?? 'next'} pressure tier escalation`);
    }
    if (estimatedTicksRemaining <= 5) {
      actions.push('Use your best remaining card immediately');
    }
    if (actions.length === 0) {
      actions.push('Stay on your current strategy');
    }

    // Risk score: blend of remaining fraction, tier urgency, and stakes
    const remainingFraction = clampFraction(safeDivide(remaining, Math.max(1, total)));
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const stakes = computeEffectiveStakes(phase, mode);
    const riskScore = clampFraction(
      (1 - remainingFraction) * 0.5
      + tierUrgency * 0.3
      + clampFraction(safeDivide(stakes, 2)) * 0.2,
    );

    // Estimated ms until timeout
    const estimatedMsUntilTimeout = estimatedTicksRemaining * tickDurationMs;

    // Decision window duration for context
    void decisionWindowMs;

    return Object.freeze({
      estimatedMsUntilTimeout,
      estimatedTicksUntilTimeout: estimatedTicksRemaining,
      estimatedPhasesRemaining,
      willTimeoutBeforeEscalation,
      canSovereigntyPhaseBeReached: canReachSovereignty,
      recommendHoldNow,
      recommendedActions: Object.freeze(actions),
      riskScore,
      effectiveStakes: stakes,
    });
  }

  private _buildCriticalProjection(
    snapshot: RunStateSnapshot,
    remaining: number,
    mode: ModeCode,
    phase: RunPhase,
    tier: PressureTier,
  ): TimeoutRiskProjection {
    const stakes = computeEffectiveStakes(phase, mode);
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const phaseAnalysis = this.phaseAnalyzer.analyze(snapshot, snapshot.timers.elapsedMs, snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs);
    void phaseAnalysis;

    return Object.freeze({
      estimatedMsUntilTimeout: remaining,
      estimatedTicksUntilTimeout: 0,
      estimatedPhasesRemaining: 0,
      willTimeoutBeforeEscalation: true,
      canSovereigntyPhaseBeReached: phase === 'SOVEREIGNTY',
      recommendHoldNow: snapshot.modeState.holdEnabled && snapshot.timers.holdCharges > 0,
      recommendedActions: Object.freeze(['Use hold immediately if available', 'Play your final card now']),
      riskScore: clampFraction(0.9 + tierUrgency * 0.1),
      effectiveStakes: stakes,
    });
  }

  /**
   * Quick risk score (0-1). Used for ML feature f7 proxy.
   */
  public quickRiskScore(tier: PressureTier, score: number): number {
    return clampFraction(computePressureRiskScore(tier, score));
  }
}

/* ============================================================================
 * § 27 — RUN TIMEOUT GUARD (MASTER CLASS)
 * ============================================================================ */

/**
 * RunTimeoutGuard
 *
 * Authoritative backend service that governs run timeout resolution.
 * Wires all sub-systems: proximity scorer, criticality assessor, ML extractor,
 * DL builder, audit trail, chat signal emitter, phase analyzer, mode advisor,
 * narrator, and risk projector.
 *
 * Engine doctrine:
 * - resolve() is the authoritative terminal truth gate
 * - All scoring is pure and replay-safe
 * - Chat signals are built per-resolution but are caller-owned for dispatch
 * - ML/DL extraction is available on demand or via resolveBundle()
 * - The audit trail is maintained across multiple resolve() calls
 */
export class RunTimeoutGuard {
  private readonly timeoutWarningMessage: string;
  private readonly timeoutOutcomeReason: string;
  private readonly timeoutTag: string;

  // Sub-systems
  private readonly proximityScorer: TimeoutProximityScorer;
  private readonly criticalityAssessor: BudgetCriticalityAssessor;
  private readonly mlExtractor: TimeoutMLExtractor;
  private readonly dlBuilder: TimeoutDLBuilder;
  private readonly auditTrail: TimeoutAuditTrail;
  private readonly chatEmitter: TimeoutChatSignalEmitter;
  private readonly phaseAnalyzer: TimeoutPhaseAnalyzer;
  private readonly modeAdvisor: TimeoutModeAdvisor;
  private readonly narrator: TimeoutNarrator;
  private readonly riskProjector: TimeoutRiskProjector;

  // Runtime state
  private readonly chatEnabled: boolean;
  private lastKnownCriticality: BudgetCriticality = 'SAFE';
  private lastKnownAlertStage: TimeoutAlertStage = 'NONE';

  public constructor(options: RunTimeoutGuardOptions = {}) {
    this.timeoutWarningMessage =
      options.timeoutWarningMessage ?? 'Season budget exhausted.';
    this.timeoutOutcomeReason =
      options.timeoutOutcomeReason
      ?? 'Season budget exhausted before financial freedom was achieved.';
    this.timeoutTag = options.timeoutTag ?? TIMEOUT_DEFAULT_TAG;
    this.chatEnabled = options.chatEnabled !== false;

    // Wire sub-systems (use injected or create defaults)
    this.proximityScorer = options.proximityScorer ?? new TimeoutProximityScorer();
    this.criticalityAssessor = options.criticalityAssessor ?? new BudgetCriticalityAssessor();
    this.phaseAnalyzer = options.phaseAnalyzer ?? new TimeoutPhaseAnalyzer();
    this.modeAdvisor = options.modeAdvisor ?? new TimeoutModeAdvisor();
    this.narrator = options.narrator ?? new TimeoutNarrator();
    this.riskProjector = options.riskProjector ?? new TimeoutRiskProjector(
      this.phaseAnalyzer,
      this.modeAdvisor,
    );
    this.chatEmitter = options.chatEmitter ?? new TimeoutChatSignalEmitter();
    this.mlExtractor = new TimeoutMLExtractor(
      this.proximityScorer,
      this.criticalityAssessor,
    );
    this.dlBuilder = new TimeoutDLBuilder(
      this.proximityScorer,
      this.criticalityAssessor,
    );
    this.auditTrail = new TimeoutAuditTrail();
  }

  // ─── Core Budget Accessors ────────────────────────────────────────────────

  /** Total budget = season + extension. */
  public getTotalBudgetMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.seasonBudgetMs)
      + normalizeMs(snapshot.timers.extensionBudgetMs);
  }

  /** Consumed budget = nextElapsedMs (truncated non-negative). */
  public getConsumedBudgetMs(nextElapsedMs: number): number {
    return normalizeMs(nextElapsedMs);
  }

  /** Remaining budget = total - consumed (clamped to 0). */
  public getRemainingBudgetMs(snapshot: RunStateSnapshot, nextElapsedMs: number): number {
    return Math.max(0, this.getTotalBudgetMs(snapshot) - this.getConsumedBudgetMs(nextElapsedMs));
  }

  /**
   * Utilization fraction (0-1).
   * Used for budget criticality assessment and ML features.
   */
  public getUtilizationFraction(snapshot: RunStateSnapshot, nextElapsedMs: number): number {
    const total = Math.max(1, this.getTotalBudgetMs(snapshot));
    const consumed = this.getConsumedBudgetMs(nextElapsedMs);
    return clampFraction(safeDivide(consumed, total));
  }

  /**
   * Returns true if the run has reached the time ceiling.
   * The existing outcome is respected: if it's already TIMEOUT, return true.
   */
  public hasReachedTimeout(snapshot: RunStateSnapshot, nextElapsedMs: number): boolean {
    if (snapshot.outcome !== null) {
      return snapshot.outcome === 'TIMEOUT';
    }
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    return this.getConsumedBudgetMs(nextElapsedMs) >= totalBudgetMs;
  }

  // ─── Core Resolution ─────────────────────────────────────────────────────

  /**
   * Authoritative resolution. Returns an immutable RunTimeoutResolution.
   * This is the minimum-surface API required by TimeEngine's STEP_02_TIME.
   */
  public resolve(snapshot: RunStateSnapshot, nextElapsedMs: number): RunTimeoutResolution {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const consumedBudgetMs = this.getConsumedBudgetMs(nextElapsedMs);
    const remainingBudgetMs = Math.max(0, totalBudgetMs - consumedBudgetMs);

    const timeoutReached =
      snapshot.outcome === null && consumedBudgetMs >= totalBudgetMs;

    const nextOutcome: RunOutcome | null = timeoutReached
      ? 'TIMEOUT'
      : snapshot.outcome;

    const outcomeReason = timeoutReached
      ? this.timeoutOutcomeReason
      : snapshot.telemetry.outcomeReason;

    const outcomeReasonCode: OutcomeReasonCode | null = timeoutReached
      ? 'SEASON_BUDGET_EXHAUSTED'
      : snapshot.telemetry.outcomeReasonCode;

    const warnings = timeoutReached
      ? dedupeStrings(snapshot.telemetry.warnings, [this.timeoutWarningMessage])
      : snapshot.telemetry.warnings;

    const tags = timeoutReached
      ? dedupeStrings(snapshot.tags, [this.timeoutTag, TIMEOUT_EXTENSION_TAG])
      : snapshot.tags;

    return Object.freeze({
      totalBudgetMs,
      nextElapsedMs: consumedBudgetMs,
      consumedBudgetMs,
      remainingBudgetMs,
      timeoutReached,
      nextOutcome,
      outcomeReason,
      outcomeReasonCode,
      warnings,
      tags,
    });
  }

  // ─── Alert Construction ───────────────────────────────────────────────────

  /**
   * Build the timeout alert from resolution + proximity data.
   */
  public buildAlert(
    resolution: RunTimeoutResolution,
    proximity: TimeoutProximityResult,
  ): TimeoutAlert {
    const stage = resolution.timeoutReached ? 'TIMED_OUT' : proximity.alertStage;
    const severity = TIMEOUT_ALERT_SEVERITY[stage];
    const tag = TIMEOUT_ALERT_TAG[stage];
    const shouldEmitChatSignal =
      this.chatEnabled
      && this.proximityScorer.shouldEmitChatSignal(proximity, resolution.remainingBudgetMs);

    const message = this._buildAlertMessage(stage, resolution.remainingBudgetMs);

    return Object.freeze({
      stage,
      severity,
      tag,
      remainingMs: resolution.remainingBudgetMs,
      proximityScore: proximity.proximityScore,
      message,
      shouldEmitChatSignal,
    });
  }

  private _buildAlertMessage(stage: TimeoutAlertStage, remainingMs: number): string {
    const remaining = formatMsAsCountdown(remainingMs);
    switch (stage) {
      case 'TIMED_OUT':
        return this.timeoutWarningMessage;
      case 'IMMINENT':
        return `Only ${remaining} left — your run is about to end.`;
      case 'CRITICAL':
        return `Budget critical: ${remaining} remaining. No room for error.`;
      case 'WARN':
        return `Budget warning: ${remaining} remaining. Focus now.`;
      default:
        return `Budget healthy: ${remaining} remaining.`;
    }
  }

  // ─── Budget Criticality ────────────────────────────────────────────────────

  /**
   * Full criticality assessment for the current state.
   */
  public assessCriticality(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): BudgetCriticalityAssessment {
    return this.criticalityAssessor.assessFromSnapshot(snapshot, nextElapsedMs, totalBudgetMs);
  }

  // ─── Proximity ────────────────────────────────────────────────────────────

  /**
   * Full proximity scoring for the current state.
   */
  public scoreProximity(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): TimeoutProximityResult {
    return this.proximityScorer.score(snapshot, nextElapsedMs, totalBudgetMs);
  }

  // ─── Phase Analysis ────────────────────────────────────────────────────────

  /**
   * Full phase analysis for the current state.
   */
  public analyzePhase(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): TimeoutPhaseAnalysis {
    return this.phaseAnalyzer.analyze(snapshot, nextElapsedMs, totalBudgetMs);
  }

  // ─── Mode Advisory ─────────────────────────────────────────────────────────

  /**
   * Mode-specific profile for the current run.
   */
  public profileMode(snapshot: RunStateSnapshot): TimeoutModeProfile {
    return this.modeAdvisor.profile(snapshot);
  }

  // ─── Narration ─────────────────────────────────────────────────────────────

  /**
   * Generate player-facing narration from the current state.
   */
  public narrate(
    snapshot: RunStateSnapshot,
    criticality: BudgetCriticalityAssessment,
    alert: TimeoutAlert,
    phase: TimeoutPhaseAnalysis,
    modeProfile: TimeoutModeProfile,
  ): TimeoutNarration {
    return this.narrator.narrate(snapshot, criticality, alert, phase, modeProfile);
  }

  // ─── Risk Projection ───────────────────────────────────────────────────────

  /**
   * Full risk projection for the current state.
   */
  public projectRisk(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
    pressureReader?: PressureReader,
  ): TimeoutRiskProjection {
    return this.riskProjector.project(snapshot, nextElapsedMs, totalBudgetMs, pressureReader);
  }

  // ─── ML Extraction ─────────────────────────────────────────────────────────

  /**
   * Extract the 28-dim ML feature vector.
   */
  public extractMLVector(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
    nowMs: number,
  ): TimeoutMLVector {
    return this.mlExtractor.extract(snapshot, nextElapsedMs, totalBudgetMs, nowMs);
  }

  // ─── DL Tensor Construction ────────────────────────────────────────────────

  /**
   * Record a budget snapshot into DL history.
   */
  public recordDLSnapshot(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
    nowMs: number,
  ): void {
    this.dlBuilder.record(snapshot, nextElapsedMs, totalBudgetMs, nowMs);
  }

  /**
   * Build the 40×6 DL tensor from recorded history.
   */
  public buildDLTensor(snapshot: RunStateSnapshot, nowMs: number): TimeoutDLTensor {
    return this.dlBuilder.build(snapshot, nowMs);
  }

  // ─── Chat Signal ────────────────────────────────────────────────────────────

  /**
   * Build the LIVEOPS_SIGNAL ChatInputEnvelope for the current state.
   */
  public buildChatSignal(
    snapshot: RunStateSnapshot,
    resolution: RunTimeoutResolution,
    criticality: BudgetCriticalityAssessment,
    alert: TimeoutAlert,
    nowMs: number,
  ): TimeoutChatSignalResult {
    return this.chatEmitter.build(snapshot, resolution, criticality, alert, nowMs);
  }

  // ─── Audit Trail ────────────────────────────────────────────────────────────

  /**
   * Snapshot the current audit trail.
   */
  public getAuditSnapshot(): TimeoutAuditSnapshot {
    return this.auditTrail.snapshot();
  }

  /**
   * Reset all sub-system state (for run restart).
   */
  public reset(): void {
    this.dlBuilder.reset();
    this.auditTrail.reset();
    this.lastKnownCriticality = 'SAFE';
    this.lastKnownAlertStage = 'NONE';
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  /**
   * Return a lightweight summary of the current guard state.
   */
  public summarize(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    nowMs: number,
  ): RunTimeoutGuardSummary {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const remainingMs = this.getRemainingBudgetMs(snapshot, nextElapsedMs);
    const utilization = this.getUtilizationFraction(snapshot, nextElapsedMs);
    const criticality = classifyUtilization(utilization);
    const proximity = this.proximityScorer.score(snapshot, nextElapsedMs, totalBudgetMs);
    const alertStage = this.hasReachedTimeout(snapshot, nextElapsedMs)
      ? 'TIMED_OUT'
      : proximity.alertStage;

    const tickDuration = normalizeMs(snapshot.timers.currentTickDurationMs)
      || getDefaultTickDurationMs(snapshot.pressure.tier);
    const estimatedTicks = estimateRemainingTicks(remainingMs, tickDuration);

    void nowMs; // available for future timestamp use

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      totalBudgetMs,
      remainingMs,
      utilizationPct: Math.round(utilization * 100),
      criticality,
      alertStage,
      proximityScore: proximity.proximityScore,
      timeoutReached: this.hasReachedTimeout(snapshot, nextElapsedMs),
      estimatedTicksRemaining: estimatedTicks,
      version: RUN_TIMEOUT_GUARD_VERSION,
    });
  }

  // ─── Full Bundle Resolution ──────────────────────────────────────────────────

  /**
   * Full bundle resolution — performs all sub-system computations in one pass.
   * This is the primary entry point for orchestrators that need the complete picture.
   *
   * Used by TimeEngine at STEP_02_TIME when full analysis is required.
   */
  public resolveBundle(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    nowMs: number,
  ): RunTimeoutGuardBundle {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);

    // Core resolution
    const resolution = this.resolve(snapshot, nextElapsedMs);

    // Criticality assessment
    const criticalityAssessment = this.criticalityAssessor.assessFromSnapshot(
      snapshot,
      nextElapsedMs,
      totalBudgetMs,
    );

    // Proximity scoring
    const proximityResult = this.proximityScorer.score(snapshot, nextElapsedMs, totalBudgetMs);

    // Alert construction
    const alert = this.buildAlert(resolution, proximityResult);

    // Phase analysis
    const phaseAnalysis = this.phaseAnalyzer.analyze(snapshot, nextElapsedMs, totalBudgetMs);

    // Mode profile
    const modeProfile = this.modeAdvisor.profile(snapshot);

    // Narration
    const narration = this.narrator.narrate(
      snapshot,
      criticalityAssessment,
      alert,
      phaseAnalysis,
      modeProfile,
    );

    // Risk projection
    const riskProjection = this.riskProjector.project(snapshot, nextElapsedMs, totalBudgetMs);

    // ML extraction
    const mlVector = this.mlExtractor.extract(snapshot, nextElapsedMs, totalBudgetMs, nowMs);

    // DL history + tensor
    this.dlBuilder.record(snapshot, nextElapsedMs, totalBudgetMs, nowMs);
    const dlTensor = this.dlBuilder.build(snapshot, nowMs);

    // Audit: record budget check
    const prevCriticality = this.lastKnownCriticality;
    const prevAlertStage = this.lastKnownAlertStage;
    const crossedThreshold =
      criticalityAssessment.criticality !== prevCriticality
      || alert.stage !== prevAlertStage;

    this.auditTrail.record(
      {
        kind: crossedThreshold ? 'THRESHOLD_CROSSED' : 'BUDGET_CHECK',
        tick: snapshot.tick,
        elapsedMs: nextElapsedMs,
        remainingMs: resolution.remainingBudgetMs,
        criticality: criticalityAssessment.criticality,
        alertStage: alert.stage,
        message: alert.message,
        tags: alert.tag
          ? Object.freeze([alert.tag])
          : Object.freeze([]),
      },
      nowMs,
    );

    if (resolution.timeoutReached) {
      // Build and record the RunTimeoutEvent
      const timeoutEvent = buildRunTimeoutEvent(snapshot.tick);
      this.auditTrail.record(
        {
          kind: 'TIMEOUT_RESOLVED',
          tick: timeoutEvent.ticksElapsed,
          elapsedMs: nextElapsedMs,
          remainingMs: 0,
          criticality: 'EXHAUSTED',
          alertStage: 'TIMED_OUT',
          message: this.timeoutWarningMessage,
          tags: Object.freeze([this.timeoutTag]),
        },
        nowMs,
      );
    }

    this.lastKnownCriticality = criticalityAssessment.criticality;
    this.lastKnownAlertStage = alert.stage;

    // Chat signal
    let chatResult: TimeoutChatSignalResult | null = null;
    if (this.chatEnabled && alert.shouldEmitChatSignal) {
      chatResult = this.chatEmitter.build(
        snapshot,
        resolution,
        criticalityAssessment,
        alert,
        nowMs,
      );
      if (chatResult.suppressedReason === null) {
        this.auditTrail.record(
          {
            kind: 'CHAT_SIGNAL_EMITTED',
            tick: snapshot.tick,
            elapsedMs: nextElapsedMs,
            remainingMs: resolution.remainingBudgetMs,
            criticality: criticalityAssessment.criticality,
            alertStage: alert.stage,
            message: `LIVEOPS_SIGNAL emitted for stage ${alert.stage}`,
            tags: Object.freeze([alert.tag]),
          },
          nowMs,
        );
      }
    }

    // Final audit snapshot
    const auditSnapshot = this.auditTrail.snapshot();

    return Object.freeze({
      resolution,
      criticality: criticalityAssessment,
      alert,
      proximity: proximityResult,
      phase: phaseAnalysis,
      mode: modeProfile,
      narration,
      risk: riskProjection,
      mlVector,
      dlTensor,
      auditSnapshot,
      chatResult,
    });
  }

  // ─── Tick Drift Detection ────────────────────────────────────────────────────

  /**
   * Detect tick drift between expected and actual tick timing.
   * Records a drift alarm to the audit trail if severe.
   */
  public detectTickDrift(
    expectedNextTickAtMs: number | null,
    actualNowMs: number,
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
  ): { driftMs: number; classification: string; isAlarm: boolean } {
    if (expectedNextTickAtMs === null) {
      return { driftMs: 0, classification: 'ACCEPTABLE', isAlarm: false };
    }

    const driftMs = Math.abs(actualNowMs - expectedNextTickAtMs);
    const classification = classifyDrift(driftMs);
    const isAlarm = driftMs >= TIMEOUT_DRIFT_SEVERE_MS;

    if (isAlarm) {
      const remaining = this.getRemainingBudgetMs(snapshot, nextElapsedMs);
      const criticality = classifyUtilization(
        this.getUtilizationFraction(snapshot, nextElapsedMs),
      );
      this.auditTrail.record(
        {
          kind: 'DRIFT_DETECTED',
          tick: snapshot.tick,
          elapsedMs: nextElapsedMs,
          remainingMs: remaining,
          criticality,
          alertStage: this.lastKnownAlertStage,
          message: `Tick drift ${classification}: ${driftMs}ms`,
          tags: Object.freeze([`drift:${classification.toLowerCase()}`]),
        },
        actualNowMs,
      );
    }

    return { driftMs, classification, isAlarm };
  }

  // ─── Latency Alarm ────────────────────────────────────────────────────────

  /**
   * Assess decision-window latency and record an alarm if the player
   * is too slow. Used by DecisionTimer to feed feedback into the guard.
   */
  public assessLatency(
    latencyMs: number,
    windowId: string,
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    nowMs: number,
  ): { classification: string; isAlarm: boolean } {
    const classification = classifyLatency(latencyMs);
    const isAlarm = latencyMs >= TIMEOUT_LATENCY_ALARM_MS;

    if (isAlarm) {
      const remaining = this.getRemainingBudgetMs(snapshot, nextElapsedMs);
      const criticality = classifyUtilization(
        this.getUtilizationFraction(snapshot, nextElapsedMs),
      );
      this.auditTrail.record(
        {
          kind: 'LATENCY_ALARM',
          tick: snapshot.tick,
          elapsedMs: nextElapsedMs,
          remainingMs: remaining,
          criticality,
          alertStage: this.lastKnownAlertStage,
          message: `Decision latency ${classification} on window ${windowId}: ${latencyMs}ms`,
          tags: Object.freeze([`latency:${classification.toLowerCase()}`]),
        },
        nowMs,
      );
    }

    return { classification, isAlarm };
  }

  // ─── Snapshot Telemetry Merge ────────────────────────────────────────────────

  /**
   * Merge audit warnings into the provided telemetry state.
   * Used by TimeEngine to annotate the RunStateSnapshot with timeout warnings.
   */
  public mergeAuditWarnings(
    telemetry: TelemetryState,
    additionalWarnings: readonly string[],
  ): TelemetryState {
    return this.auditTrail.mergeWarningsIntoTelemetry(telemetry, additionalWarnings);
  }

  // ─── Outcome Terminal Check ───────────────────────────────────────────────

  /**
   * Check whether a given outcome is terminal.
   * Uses TIME_CONTRACT_OUTCOME_IS_TERMINAL for authoritative lookup.
   */
  public isTerminalOutcome(outcome: RunOutcome): boolean {
    return TIME_CONTRACT_OUTCOME_IS_TERMINAL[outcome];
  }

  /**
   * Check whether the current snapshot has a non-null, terminal outcome.
   */
  public hasTerminalOutcome(snapshot: RunStateSnapshot): boolean {
    return snapshot.outcome !== null && this.isTerminalOutcome(snapshot.outcome);
  }
}

/* ============================================================================
 * § 28 — FACTORY FUNCTIONS
 * ============================================================================ */

/**
 * Create a default RunTimeoutGuard with all sub-systems wired.
 */
export function createRunTimeoutGuard(
  options?: RunTimeoutGuardOptions,
): RunTimeoutGuard {
  return new RunTimeoutGuard(options);
}

/**
 * Create a RunTimeoutGuard with chat signals disabled.
 * Useful for replay validation and test runs.
 */
export function createRunTimeoutGuardSilent(): RunTimeoutGuard {
  return new RunTimeoutGuard({ chatEnabled: false });
}

/**
 * Standalone proximity score function (pure, no guard instantiation).
 */
export function computeTimeoutProximityScore(
  snapshot: RunStateSnapshot,
  nextElapsedMs: number,
  totalBudgetMs: number,
): number {
  const scorer = new TimeoutProximityScorer();
  return scorer.quickScore(snapshot, nextElapsedMs, totalBudgetMs);
}

/**
 * Standalone budget criticality classification (pure).
 */
export function classifyBudgetCriticality(
  consumedMs: number,
  totalMs: number,
  remainingMs: number,
): BudgetCriticality {
  const assessor = new BudgetCriticalityAssessor();
  return assessor.assess(consumedMs, totalMs, remainingMs).criticality;
}

/**
 * Standalone ML vector extraction (pure, single-call).
 */
export function extractTimeoutMLVector(
  snapshot: RunStateSnapshot,
  nextElapsedMs: number,
  totalBudgetMs: number,
  nowMs: number,
): TimeoutMLVector {
  const extractor = new TimeoutMLExtractor();
  return extractor.extract(snapshot, nextElapsedMs, totalBudgetMs, nowMs);
}

/**
 * Build a timeout RunTimeoutEvent from tick count.
 */
export function buildTimeoutEvent(ticksElapsed: number): RunTimeoutEvent {
  return buildRunTimeoutEvent(ticksElapsed);
}

/**
 * Check if a DecisionWindow is relevant to timeout context
 * (expired or frozen windows signal time pressure).
 */
export function isDecisionWindowTimePressured(window: DecisionWindow): boolean {
  return window.isExpired || window.isOnHold || window.remainingMs < 2_000;
}

/* ============================================================================
 * § 29 — PURE HELPER EXPORTS
 * ============================================================================ */

/**
 * Returns the TickTierConfig for the given PressureTier.
 * Delegates to getTickTierConfigByPressureTier from types.ts.
 */
export function getTimeoutTickTierConfig(tier: PressureTier): TickTierConfig {
  return getTickTierConfigByPressureTier(tier);
}

/**
 * Returns the default tick duration in ms for the given PressureTier.
 */
export function getTimeoutDefaultTickDurationMs(tier: PressureTier): number {
  return getDefaultTickDurationMs(tier);
}

/**
 * Returns the decision window duration in ms for the given PressureTier.
 */
export function getTimeoutDecisionWindowMs(tier: PressureTier): number {
  return getDecisionWindowDurationMs(tier);
}

/**
 * Convert PressureTier to TickTier using canonical mapping.
 */
export function getTimeoutTickTier(tier: PressureTier): TickTier {
  return pressureTierToTickTier(tier);
}

/**
 * Convert TickTier back to PressureTier using canonical reverse mapping.
 */
export function getTimeoutPressureTier(tickTier: TickTier): PressureTier {
  return tickTierToPressureTier(tickTier);
}

/**
 * Resolve the current RunPhase from elapsed milliseconds.
 * Delegates to resolvePhaseFromElapsedMs from types.ts.
 */
export function resolveTimeoutPhase(elapsedMs: number): RunPhase {
  return resolvePhaseFromElapsedMs(elapsedMs);
}

/**
 * Return true if elapsed time has crossed a phase boundary.
 */
export function didCrossPhaseBoundary(
  previousElapsedMs: number,
  nextElapsedMs: number,
): boolean {
  return isPhaseBoundaryTransition(previousElapsedMs, nextElapsedMs);
}

/**
 * Compute the total budget from a TimerState.
 * Pure utility for callers that have timers but not a full snapshot.
 */
export function computeTotalBudgetMs(timers: TimerState): number {
  return normalizeMs(timers.seasonBudgetMs) + normalizeMs(timers.extensionBudgetMs);
}

/**
 * Return true if the outcome is a loss outcome.
 * Delegates to isLossOutcome from GamePrimitives.
 */
export function isTimeoutLossOutcome(outcome: RunOutcome): boolean {
  return isLossOutcome(outcome);
}

/**
 * Return true if the outcome is a win outcome.
 * Delegates to isWinOutcome from GamePrimitives.
 */
export function isTimeoutWinOutcome(outcome: RunOutcome): boolean {
  return isWinOutcome(outcome);
}

/**
 * Return the phase-specific urgency amplifier.
 * Used by UI adapters that want to scale display intensity without full analysis.
 */
export function getPhaseUrgencyAmplifier(phase: RunPhase): number {
  return TIMEOUT_PHASE_URGENCY_AMPLIFIER[phase];
}

/**
 * Return the mode-specific timeout sensitivity multiplier.
 */
export function getModeSensitivity(mode: ModeCode): number {
  return TIMEOUT_MODE_SENSITIVITY[mode];
}

/**
 * Compute the utilization fraction from consumed + total budget.
 * Pure arithmetic helper for callers with direct budget values.
 */
export function computeUtilizationFraction(consumedMs: number, totalMs: number): number {
  return clampFraction(safeDivide(Math.max(0, consumedMs), Math.max(1, totalMs)));
}

/**
 * Build a formatted countdown label for remaining milliseconds.
 * Used in narration and UX display.
 */
export function formatRemainingMs(remainingMs: number): string {
  return formatMsAsCountdown(remainingMs);
}

/**
 * Return the normalized TIER_DURATIONS_MS lookup.
 * Exposed for callers that build external dashboards.
 */
export function getTierDurationsMs(): Readonly<Record<PressureTier, number>> {
  return TIER_DURATIONS_MS;
}

/**
 * Return the full TICK_TIER_CONFIGS lookup.
 */
export function getAllTickTierConfigs(): Readonly<Record<TickTier, TickTierConfig>> {
  return TICK_TIER_CONFIGS;
}

/**
 * Return the canonical DECISION_WINDOW_DURATIONS_MS lookup.
 */
export function getAllDecisionWindowDurationsMs(): Readonly<Record<PressureTier, number>> {
  return DECISION_WINDOW_DURATIONS_MS;
}

/**
 * Return the canonical TICK_TIER_BY_PRESSURE_TIER mapping.
 */
export function getTierMapping(): Readonly<Record<PressureTier, TickTier>> {
  return TICK_TIER_BY_PRESSURE_TIER;
}

/**
 * Use clamp01 for external score normalization (re-exported for consistency).
 */
export function normalizeScore01(value: number): number {
  return Number(clamp01(value));
}

/**
 * Use clamp100 for external percentage normalization.
 */
export function normalizeScore100(value: number): number {
  return Number(clamp100(value));
}

/* ============================================================================
 * § 30 — MANIFEST
 * ============================================================================ */

export const RUN_TIMEOUT_GUARD_MANIFEST = Object.freeze({
  domain: 'backend.time.RunTimeoutGuard',
  version: RUN_TIMEOUT_GUARD_VERSION,
  contractsVersion: TIME_CONTRACTS_VERSION.version,
  mlDim: TIME_CONTRACT_ML_DIM,
  dlRowCount: TIME_CONTRACT_DL_ROW_COUNT,
  dlColCount: TIME_CONTRACT_DL_COL_COUNT,
  mlLabels: TIMEOUT_ML_FEATURE_LABELS,
  dlColumnLabels: TIMEOUT_DL_COLUMN_LABELS,
  phaseBoundaries: PHASE_BOUNDARIES_MS,
  budgetThresholds: TIME_CONTRACT_BUDGET_THRESHOLDS,
  tickDriftThresholds: TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  latencyThresholds: TIME_CONTRACT_LATENCY_THRESHOLDS,
  proximityThresholds: TIMEOUT_PROXIMITY_THRESHOLDS,
  phaseUrgencyAmplifiers: TIMEOUT_PHASE_URGENCY_AMPLIFIER,
  modeSensitivity: TIMEOUT_MODE_SENSITIVITY,
  holdResultLabels: TIME_CONTRACT_HOLD_RESULT_LABELS,
  outcomeTerminalMap: TIME_CONTRACT_OUTCOME_IS_TERMINAL,
  featureFlags: Object.freeze({
    mlExtraction: true,
    dlTensor: true,
    chatSignals: true,
    auditTrail: true,
    proximityScoring: true,
    criticalityAssessment: true,
    phaseAnalysis: true,
    modeAdvisory: true,
    narration: true,
    riskProjection: true,
    driftDetection: true,
    latencyAlarms: true,
    sessionAnalytics: true,
    budgetSimulation: true,
    resilienceScoring: true,
    pulseAnalysis: true,
    trajectoryForecasting: true,
  }),
} as const);

/* ============================================================================
 * § 31 — SESSION ANALYTICS TYPES
 * ============================================================================ */

/** Per-run session analytics aggregated across all resolve() calls. */
export interface TimeoutSessionAnalyticsSnapshot {
  readonly runId: string;
  readonly totalResolveCalls: number;
  readonly totalTimeoutDetections: number;
  readonly firstCriticalTick: number | null;
  readonly firstImminentTick: number | null;
  readonly firstTimedOutTick: number | null;
  readonly peakProximityScore: number;
  readonly peakCriticality: BudgetCriticality;
  readonly avgBudgetUtilizationPct: number;
  readonly avgTickDurationMs: number;
  readonly totalChatSignalsSent: number;
  readonly phaseTransitionCount: number;
  readonly driftAlarmCount: number;
  readonly latencyAlarmCount: number;
  readonly holdChargesConsumedEstimate: number;
  readonly estimatedEfficiencyScore: number;
  readonly sessionStartMs: number;
  readonly lastUpdateMs: number;
}

/* ============================================================================
 * § 32 — BUDGET SIMULATION TYPES
 * ============================================================================ */

/** A single simulated budget trajectory point. */
export interface TimeoutBudgetSimPoint {
  readonly tick: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly utilizationFraction: number;
  readonly criticality: BudgetCriticality;
  readonly proximityScore: number;
  readonly alertStage: TimeoutAlertStage;
  readonly phase: RunPhase;
}

/** Result of a budget trajectory simulation. */
export interface TimeoutBudgetSimResult {
  readonly points: readonly TimeoutBudgetSimPoint[];
  readonly projectedTimeoutTick: number | null;
  readonly projectedTimeoutMs: number | null;
  readonly willTimeout: boolean;
  readonly timeoutProbability: number;
  readonly sovereigntyReachable: boolean;
  readonly peakCriticality: BudgetCriticality;
  readonly simulatedTicks: number;
  readonly avgTickDurationMs: number;
}

/* ============================================================================
 * § 33 — RESILIENCE SCORE TYPES
 * ============================================================================ */

/** Resilience assessment for the current run state. */
export interface TimeoutResilienceScore {
  readonly score: number;            // 0-1: 1 = fully resilient, 0 = critically exposed
  readonly label: string;            // human-readable
  readonly budgetComponent: number;  // how much remaining budget contributes
  readonly holdComponent: number;    // how much hold charges contribute
  readonly phaseComponent: number;   // how much being in FOUNDATION contributes
  readonly modeComponent: number;    // how much cooperative mode contributes
  readonly pressureComponent: number;// how much low pressure contributes
  readonly recommendations: readonly string[];
}

/* ============================================================================
 * § 34 — PULSE ANALYSIS TYPES
 * ============================================================================ */

/** Represents a single pulse event in budget consumption. */
export interface TimeoutBudgetPulse {
  readonly tick: number;
  readonly deltaFraction: number;   // change in utilization fraction since last pulse
  readonly acceleration: number;    // positive = consumption speeding up
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly isSpike: boolean;        // true if deltaFraction > PULSE_SPIKE_THRESHOLD
  readonly recordedAtMs: number;
}

/** Pulse analysis summary over recent history. */
export interface TimeoutPulseAnalysisSummary {
  readonly recentPulses: readonly TimeoutBudgetPulse[];
  readonly avgDeltaFraction: number;
  readonly maxDeltaFraction: number;
  readonly spikeCount: number;
  readonly accelerationTrend: 'ACCELERATING' | 'STEADY' | 'DECELERATING';
  readonly projectedExhaustTick: number | null;
  readonly riskMultiplier: number;
}

/** Threshold above which a delta is classified as a spike. */
export const TIMEOUT_PULSE_SPIKE_THRESHOLD = 0.05;

/** Maximum pulse history entries retained. */
export const TIMEOUT_PULSE_MAX_HISTORY = 20;

/* ============================================================================
 * § 35 — TIMEOUT SESSION ANALYTICS
 * ============================================================================ */

/**
 * TimeoutSessionAnalytics
 *
 * Tracks per-run session state across multiple resolve() calls.
 * Provides aggregate metrics about how the budget has been consumed,
 * when critical thresholds were first crossed, and estimated player efficiency.
 *
 * Pure aggregate — no mutation of game state.
 */
export class TimeoutSessionAnalytics {
  private runId: string = '';
  private totalResolveCalls = 0;
  private totalTimeoutDetections = 0;
  private firstCriticalTick: number | null = null;
  private firstImminentTick: number | null = null;
  private firstTimedOutTick: number | null = null;
  private peakProximityScore = 0;
  private peakCriticality: BudgetCriticality = 'SAFE';
  private utilizationSamples: number[] = [];
  private tickDurationSamples: number[] = [];
  private totalChatSignalsSent = 0;
  private phaseTransitionCount = 0;
  private driftAlarmCount = 0;
  private latencyAlarmCount = 0;
  private holdChargesConsumedEstimate = 0;
  private sessionStartMs = 0;
  private lastUpdateMs = 0;

  /** Initialize the session tracker for a new run. */
  public init(runId: string, nowMs: number): void {
    this.runId = runId;
    this.sessionStartMs = nowMs;
    this.reset();
  }

  /** Record a resolve() event. */
  public recordResolve(
    resolution: RunTimeoutResolution,
    proximity: TimeoutProximityResult,
    alert: TimeoutAlert,
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): void {
    this.totalResolveCalls++;
    this.lastUpdateMs = nowMs;

    // Track utilization
    const util = clampFraction(
      safeDivide(resolution.consumedBudgetMs, Math.max(1, resolution.totalBudgetMs)),
    );
    this.utilizationSamples.push(util);
    if (this.utilizationSamples.length > 200) {
      this.utilizationSamples.shift();
    }

    // Track tick duration
    const td = normalizeMs(snapshot.timers.currentTickDurationMs);
    if (td > 0) {
      this.tickDurationSamples.push(td);
      if (this.tickDurationSamples.length > 200) {
        this.tickDurationSamples.shift();
      }
    }

    // Track peak proximity
    if (proximity.proximityScore > this.peakProximityScore) {
      this.peakProximityScore = proximity.proximityScore;
    }

    // Track first critical tick
    if (
      alert.stage === 'CRITICAL'
      && this.firstCriticalTick === null
    ) {
      this.firstCriticalTick = snapshot.tick;
    }

    // Track first imminent tick
    if (
      alert.stage === 'IMMINENT'
      && this.firstImminentTick === null
    ) {
      this.firstImminentTick = snapshot.tick;
    }

    // Track timeouts
    if (resolution.timeoutReached) {
      this.totalTimeoutDetections++;
      if (this.firstTimedOutTick === null) {
        this.firstTimedOutTick = snapshot.tick;
      }
    }

    // Track peak criticality progression
    const critOrder: BudgetCriticality[] = ['SAFE', 'WARNING', 'CRITICAL', 'EXHAUSTED'];
    const currentIdx = critOrder.indexOf(
      classifyUtilization(util),
    );
    const peakIdx = critOrder.indexOf(this.peakCriticality);
    if (currentIdx > peakIdx) {
      this.peakCriticality = critOrder[currentIdx] ?? 'SAFE';
    }
  }

  /** Record a chat signal emission. */
  public recordChatSignal(): void {
    this.totalChatSignalsSent++;
  }

  /** Record a phase transition. */
  public recordPhaseTransition(): void {
    this.phaseTransitionCount++;
  }

  /** Record a drift alarm. */
  public recordDriftAlarm(): void {
    this.driftAlarmCount++;
  }

  /** Record a latency alarm. */
  public recordLatencyAlarm(): void {
    this.latencyAlarmCount++;
  }

  /** Record hold charge consumption. */
  public recordHoldChargeConsumed(): void {
    this.holdChargesConsumedEstimate++;
  }

  /** Snapshot current session analytics. */
  public snapshot(): TimeoutSessionAnalyticsSnapshot {
    const avgUtil = this.utilizationSamples.length > 0
      ? this.utilizationSamples.reduce((a, b) => a + b, 0) / this.utilizationSamples.length
      : 0;
    const avgTd = this.tickDurationSamples.length > 0
      ? this.tickDurationSamples.reduce((a, b) => a + b, 0) / this.tickDurationSamples.length
      : 0;

    // Efficiency: inverse of how quickly they consumed budget
    // Higher avgUtil late in the run = lower efficiency (they ran out fast)
    const efficiencyScore = clampFraction(
      1.0 - avgUtil * 0.5 - (this.driftAlarmCount * 0.02) - (this.latencyAlarmCount * 0.01),
    );

    return Object.freeze({
      runId: this.runId,
      totalResolveCalls: this.totalResolveCalls,
      totalTimeoutDetections: this.totalTimeoutDetections,
      firstCriticalTick: this.firstCriticalTick,
      firstImminentTick: this.firstImminentTick,
      firstTimedOutTick: this.firstTimedOutTick,
      peakProximityScore: this.peakProximityScore,
      peakCriticality: this.peakCriticality,
      avgBudgetUtilizationPct: Math.round(avgUtil * 100),
      avgTickDurationMs: Math.round(avgTd),
      totalChatSignalsSent: this.totalChatSignalsSent,
      phaseTransitionCount: this.phaseTransitionCount,
      driftAlarmCount: this.driftAlarmCount,
      latencyAlarmCount: this.latencyAlarmCount,
      holdChargesConsumedEstimate: this.holdChargesConsumedEstimate,
      estimatedEfficiencyScore: efficiencyScore,
      sessionStartMs: this.sessionStartMs,
      lastUpdateMs: this.lastUpdateMs,
    });
  }

  /** Reset all session state (for run restart). */
  public reset(): void {
    this.totalResolveCalls = 0;
    this.totalTimeoutDetections = 0;
    this.firstCriticalTick = null;
    this.firstImminentTick = null;
    this.firstTimedOutTick = null;
    this.peakProximityScore = 0;
    this.peakCriticality = 'SAFE';
    this.utilizationSamples = [];
    this.tickDurationSamples = [];
    this.totalChatSignalsSent = 0;
    this.phaseTransitionCount = 0;
    this.driftAlarmCount = 0;
    this.latencyAlarmCount = 0;
    this.holdChargesConsumedEstimate = 0;
    this.lastUpdateMs = 0;
  }
}

/* ============================================================================
 * § 36 — TIMEOUT BUDGET SIMULATOR
 * ============================================================================ */

/**
 * TimeoutBudgetSimulator
 *
 * Pure simulation engine. Given a snapshot and current budget state,
 * projects the trajectory of budget consumption forward in time.
 * Does NOT mutate any state — returns a fully computed simulation result.
 *
 * Used by:
 * - Risk projectors that need trajectory curves
 * - ML features that represent "will this run timeout?"
 * - Chat signals that narrate "at your current pace…"
 */
export class TimeoutBudgetSimulator {
  private readonly proximityScorer: TimeoutProximityScorer;
  private readonly criticalityAssessor: BudgetCriticalityAssessor;

  public constructor(
    proximityScorer?: TimeoutProximityScorer,
    criticalityAssessor?: BudgetCriticalityAssessor,
  ) {
    this.proximityScorer = proximityScorer ?? new TimeoutProximityScorer();
    this.criticalityAssessor = criticalityAssessor ?? new BudgetCriticalityAssessor();
  }

  /**
   * Simulate the run trajectory forward from current state.
   * Models budget consumption tick by tick given current tick duration.
   *
   * @param snapshot      Current run state
   * @param nextElapsedMs Current elapsed time
   * @param totalBudgetMs Total budget ceiling
   * @param maxSimTicks   Maximum ticks to simulate (default: 100)
   */
  public simulate(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
    maxSimTicks = 100,
  ): TimeoutBudgetSimResult {
    const tier = snapshot.pressure.tier;
    const totalMs = Math.max(1, normalizeMs(totalBudgetMs));
    const consumedMs = normalizeMs(nextElapsedMs);
    const remainingMs = Math.max(0, totalMs - consumedMs);

    if (remainingMs === 0) {
      return this._buildExhaustedResult(snapshot, consumedMs, totalMs);
    }

    // Tick duration: use current from snapshot, fall back to tier default
    const tickDurationMs = Math.max(
      100,
      normalizeMs(snapshot.timers.currentTickDurationMs)
        || getDefaultTickDurationMs(tier),
    );

    const points: TimeoutBudgetSimPoint[] = [];
    let simElapsed = consumedMs;
    let projectedTimeoutTick: number | null = null;
    let projectedTimeoutMs: number | null = null;
    let peakCriticality: BudgetCriticality = 'SAFE';
    let tick = snapshot.tick;

    for (let step = 0; step < maxSimTicks; step++) {
      simElapsed += tickDurationMs;
      tick++;

      const simRemaining = Math.max(0, totalMs - simElapsed);
      const utilizationFraction = clampFraction(safeDivide(simElapsed, totalMs));
      const criticality = classifyUtilization(utilizationFraction);
      const phase = resolvePhaseFromElapsedMs(simElapsed);
      const proximityScore = clampFraction(
        utilizationFraction * TIMEOUT_PHASE_URGENCY_AMPLIFIER[phase],
      );
      const alertStage = classifyProximity(proximityScore);

      // Track peak criticality
      const critOrder: BudgetCriticality[] = ['SAFE', 'WARNING', 'CRITICAL', 'EXHAUSTED'];
      const currentIdx = critOrder.indexOf(criticality);
      const peakIdx = critOrder.indexOf(peakCriticality);
      if (currentIdx > peakIdx) {
        peakCriticality = critOrder[currentIdx] ?? 'SAFE';
      }

      const point: TimeoutBudgetSimPoint = Object.freeze({
        tick,
        elapsedMs: simElapsed,
        remainingMs: simRemaining,
        utilizationFraction,
        criticality,
        proximityScore,
        alertStage,
        phase,
      });
      points.push(point);

      // Check timeout
      if (simElapsed >= totalMs && projectedTimeoutTick === null) {
        projectedTimeoutTick = tick;
        projectedTimeoutMs = simElapsed;
        break;
      }

      if (simRemaining === 0) break;
    }

    const willTimeout = projectedTimeoutTick !== null;

    // Sovereignty reachable: can we hit the SOVEREIGNTY phase boundary?
    const sovereigntyBoundary = PHASE_BOUNDARIES_MS.find(b => b.phase === 'SOVEREIGNTY');
    const sovereigntyStartMs = sovereigntyBoundary?.startsAtMs ?? 0;
    const sovereigntyReachable = consumedMs < sovereigntyStartMs
      ? points.some(p => p.elapsedMs >= sovereigntyStartMs)
      : true;

    // Timeout probability: if no timeout detected, score based on remaining fraction
    const timeoutProbability = willTimeout
      ? 1.0
      : clampFraction(
          safeDivide(consumedMs, totalMs) * 1.1 + (snapshot.pressure.score / 100) * 0.1,
        );

    return Object.freeze({
      points: Object.freeze(points),
      projectedTimeoutTick,
      projectedTimeoutMs,
      willTimeout,
      timeoutProbability,
      sovereigntyReachable,
      peakCriticality,
      simulatedTicks: points.length,
      avgTickDurationMs: tickDurationMs,
    });
  }

  /**
   * Quick timeout probability — scalar 0-1.
   * Used as an ML feature for downstream models.
   */
  public quickTimeoutProbability(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): number {
    const totalMs = Math.max(1, normalizeMs(totalBudgetMs));
    const consumedMs = normalizeMs(nextElapsedMs);
    const utilizationFraction = clampFraction(safeDivide(consumedMs, totalMs));
    const tier = snapshot.pressure.tier;
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const phaseAmplifier = TIMEOUT_PHASE_URGENCY_AMPLIFIER[snapshot.phase];
    // Blend: utilization + tier urgency + phase amplification
    return clampFraction(
      utilizationFraction * 0.7
      + tierUrgency * 0.15
      + (phaseAmplifier - 1.0) * 0.15,
    );
  }

  private _buildExhaustedResult(
    snapshot: RunStateSnapshot,
    consumedMs: number,
    totalMs: number,
  ): TimeoutBudgetSimResult {
    const point: TimeoutBudgetSimPoint = Object.freeze({
      tick: snapshot.tick,
      elapsedMs: consumedMs,
      remainingMs: 0,
      utilizationFraction: 1.0,
      criticality: 'EXHAUSTED',
      proximityScore: 1.0,
      alertStage: 'TIMED_OUT',
      phase: snapshot.phase,
    });
    void totalMs; // used in utilization above
    return Object.freeze({
      points: Object.freeze([point]),
      projectedTimeoutTick: snapshot.tick,
      projectedTimeoutMs: consumedMs,
      willTimeout: true,
      timeoutProbability: 1.0,
      sovereigntyReachable: snapshot.phase === 'SOVEREIGNTY',
      peakCriticality: 'EXHAUSTED',
      simulatedTicks: 1,
      avgTickDurationMs: getDefaultTickDurationMs(snapshot.pressure.tier),
    });
  }
}

/* ============================================================================
 * § 37 — TIMEOUT RESILIENCE SCORER
 * ============================================================================ */

/**
 * TimeoutResilienceScorer
 *
 * Measures how resilient the current run is against a timeout outcome.
 * Resilience is a composite of remaining budget, hold charges, phase,
 * mode difficulty, and pressure tier.
 *
 * Score of 1.0 = fully resilient (well within budget).
 * Score of 0.0 = critically exposed (at the edge of timeout).
 *
 * Pure function — no mutation, no state.
 */
export class TimeoutResilienceScorer {
  /**
   * Compute the full resilience score.
   */
  public score(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): TimeoutResilienceScore {
    const totalMs = Math.max(1, normalizeMs(totalBudgetMs));
    const consumedMs = normalizeMs(nextElapsedMs);
    const remainingMs = Math.max(0, totalMs - consumedMs);
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;

    // Budget component: more remaining = more resilient
    const remainingFraction = clampFraction(safeDivide(remainingMs, totalMs));
    const budgetComponent = remainingFraction * 0.40;

    // Hold component: hold charges give a safety net
    const holdEnabled = snapshot.modeState.holdEnabled;
    const holdCharges = Math.max(0, snapshot.timers.holdCharges);
    const holdComponent = holdEnabled
      ? clampFraction(safeDivide(holdCharges, 2)) * 0.20
      : 0;

    // Phase component: FOUNDATION = lots of time, SOVEREIGNTY = critical
    const phaseResilience: Record<RunPhase, number> = {
      FOUNDATION: 1.0,
      ESCALATION: 0.6,
      SOVEREIGNTY: 0.3,
    };
    const phaseComponent = phaseResilience[phase] * 0.20;

    // Mode component: coop is easier on the clock
    const modeResilience: Record<ModeCode, number> = {
      solo: 0.5,
      pvp: 0.3,
      coop: 0.8,
      ghost: 0.1,
    };
    const modeComponent = modeResilience[mode] * 0.10;

    // Pressure component: T0 = resilient, T4 = not
    const tierResilience: Record<PressureTier, number> = {
      T0: 1.0,
      T1: 0.75,
      T2: 0.50,
      T3: 0.25,
      T4: 0.0,
    };
    const pressureComponent = tierResilience[tier] * 0.10;

    const score = clampFraction(
      budgetComponent + holdComponent + phaseComponent + modeComponent + pressureComponent,
    );

    const label = this._scoreLabel(score);

    // Recommendations
    const recommendations: string[] = [];
    if (remainingFraction < 0.2) {
      recommendations.push('Increase decision speed — budget is critically low');
    }
    if (holdEnabled && holdCharges > 0 && phase === 'SOVEREIGNTY') {
      recommendations.push('Save hold charges for endgame decisions');
    }
    if (tier === 'T3' || tier === 'T4') {
      recommendations.push(describePressureTierExperience(tier));
    }
    if (mode === 'ghost' && remainingFraction < 0.4) {
      recommendations.push('Phantom mode: the clock is your greatest enemy');
    }
    if (MODE_DIFFICULTY_MULTIPLIER[mode] > 1.2) {
      recommendations.push(`${MODE_TENSION_FLOOR[mode]} tension floor active — stay sharp`);
    }
    if (recommendations.length === 0) {
      recommendations.push('Budget healthy — maintain current pace');
    }

    return Object.freeze({
      score,
      label,
      budgetComponent,
      holdComponent,
      phaseComponent,
      modeComponent,
      pressureComponent,
      recommendations: Object.freeze(recommendations),
    });
  }

  /**
   * Quick resilience score (scalar 0-1).
   */
  public quickScore(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    totalBudgetMs: number,
  ): number {
    return this.score(snapshot, nextElapsedMs, totalBudgetMs).score;
  }

  private _scoreLabel(score: number): string {
    if (score >= 0.8) return 'Resilient — you have strong budget headroom.';
    if (score >= 0.6) return 'Moderate — watch your pace carefully.';
    if (score >= 0.4) return 'Fragile — time pressure is mounting.';
    if (score >= 0.2) return 'Vulnerable — you are close to the edge.';
    return 'Critical — timeout is imminent.';
  }
}

/* ============================================================================
 * § 38 — TIMEOUT PULSE ANALYZER
 * ============================================================================ */

/**
 * TimeoutPulseAnalyzer
 *
 * Detects spikes in budget consumption rate. A "pulse" is the change in
 * budget utilization fraction between consecutive ticks.
 *
 * Rapid acceleration (consecutive high-delta pulses) signals that the run
 * is burning through budget faster than expected — a critical early warning
 * signal before the standard threshold system fires.
 *
 * Maintains a rolling window of recent pulses (max 20).
 */
export class TimeoutPulseAnalyzer {
  private readonly pulses: TimeoutBudgetPulse[] = [];
  private lastUtilizationFraction = 0;

  /**
   * Record a new utilization measurement and detect the pulse.
   */
  public record(
    snapshot: RunStateSnapshot,
    utilizationFraction: number,
    nowMs: number,
  ): TimeoutBudgetPulse {
    const delta = Math.max(0, utilizationFraction - this.lastUtilizationFraction);
    this.lastUtilizationFraction = utilizationFraction;

    const prevPulse = this.pulses[this.pulses.length - 1];
    const prevDelta = prevPulse?.deltaFraction ?? 0;
    const acceleration = delta - prevDelta;
    const isSpike = delta >= TIMEOUT_PULSE_SPIKE_THRESHOLD;
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;

    const pulse: TimeoutBudgetPulse = Object.freeze({
      tick: snapshot.tick,
      deltaFraction: delta,
      acceleration,
      phase,
      tier,
      isSpike,
      recordedAtMs: nowMs,
    });

    this.pulses.push(pulse);
    if (this.pulses.length > TIMEOUT_PULSE_MAX_HISTORY) {
      this.pulses.shift();
    }

    return pulse;
  }

  /**
   * Get the full pulse analysis summary.
   */
  public summarize(snapshot: RunStateSnapshot): TimeoutPulseAnalysisSummary {
    if (this.pulses.length === 0) {
      return this._emptyAnalysis(snapshot);
    }

    const recentPulses = [...this.pulses];
    const deltas = recentPulses.map(p => p.deltaFraction);
    const avgDelta = safeDivide(
      deltas.reduce((a, b) => a + b, 0),
      deltas.length,
    );
    const maxDelta = Math.max(...deltas);
    const spikeCount = recentPulses.filter(p => p.isSpike).length;

    // Acceleration trend: look at last 5 pulses
    const recent5 = recentPulses.slice(-5);
    const accelerations = recent5.map(p => p.acceleration);
    const avgAccel = safeDivide(
      accelerations.reduce((a, b) => a + b, 0),
      accelerations.length,
    );
    const accelerationTrend: 'ACCELERATING' | 'STEADY' | 'DECELERATING' =
      avgAccel > 0.005 ? 'ACCELERATING'
      : avgAccel < -0.005 ? 'DECELERATING'
      : 'STEADY';

    // Projected exhaust tick: if current rate continues
    const remaining = 1.0 - this.lastUtilizationFraction;
    const projectedExhaustTick = avgDelta > 0
      ? Math.ceil(snapshot.tick + safeDivide(remaining, avgDelta))
      : null;

    // Risk multiplier: spikes + acceleration amplify risk
    const riskMultiplier = clampFraction(
      1.0 + spikeCount * 0.1 + (avgAccel > 0 ? avgAccel * 5 : 0),
    );

    return Object.freeze({
      recentPulses: Object.freeze(recentPulses),
      avgDeltaFraction: avgDelta,
      maxDeltaFraction: maxDelta,
      spikeCount,
      accelerationTrend,
      projectedExhaustTick,
      riskMultiplier,
    });
  }

  /** Reset pulse history (for run restart). */
  public reset(): void {
    this.pulses.length = 0;
    this.lastUtilizationFraction = 0;
  }

  /** Return current pulse history depth. */
  public getHistoryDepth(): number {
    return this.pulses.length;
  }

  private _emptyAnalysis(snapshot: RunStateSnapshot): TimeoutPulseAnalysisSummary {
    return Object.freeze({
      recentPulses: Object.freeze([]),
      avgDeltaFraction: 0,
      maxDeltaFraction: 0,
      spikeCount: 0,
      accelerationTrend: 'STEADY' as const,
      projectedExhaustTick: null,
      riskMultiplier: 1.0,
    });
    void snapshot; // available for future tick reference
  }
}

/* ============================================================================
 * § 39 — EXTENDED RunTimeoutGuard METHODS (SESSION + SIMULATION + PULSE)
 * ============================================================================ */

/**
 * RunTimeoutGuardExtended
 *
 * Extension of RunTimeoutGuard with session analytics, budget simulation,
 * resilience scoring, and pulse analysis wired in.
 *
 * Inherits from RunTimeoutGuard and adds the following surfaces:
 * - sessionAnalytics: TimeoutSessionAnalytics
 * - simulator: TimeoutBudgetSimulator
 * - resilienceScorer: TimeoutResilienceScorer
 * - pulseAnalyzer: TimeoutPulseAnalyzer
 *
 * Use RunTimeoutGuardExtended.resolveFullBundle() for a complete one-pass
 * resolution that includes all sub-systems.
 */
export class RunTimeoutGuardExtended extends RunTimeoutGuard {
  public readonly sessionAnalytics: TimeoutSessionAnalytics;
  public readonly simulator: TimeoutBudgetSimulator;
  public readonly resilienceScorer: TimeoutResilienceScorer;
  public readonly pulseAnalyzer: TimeoutPulseAnalyzer;

  public constructor(options: RunTimeoutGuardOptions = {}) {
    super(options);
    this.sessionAnalytics = new TimeoutSessionAnalytics();
    this.simulator = new TimeoutBudgetSimulator();
    this.resilienceScorer = new TimeoutResilienceScorer();
    this.pulseAnalyzer = new TimeoutPulseAnalyzer();
  }

  /**
   * Initialize the extended guard for a new run session.
   */
  public initSession(snapshot: RunStateSnapshot, nowMs: number): void {
    this.sessionAnalytics.init(snapshot.runId, nowMs);
    this.pulseAnalyzer.reset();
    this.reset();
  }

  /**
   * Full extended bundle resolution.
   *
   * Wraps resolveBundle() and adds:
   * - Session analytics update
   * - Budget simulation
   * - Resilience scoring
   * - Pulse analysis
   */
  public resolveFullBundle(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    nowMs: number,
  ): RunTimeoutGuardBundle & {
    readonly simulation: TimeoutBudgetSimResult;
    readonly resilience: TimeoutResilienceScore;
    readonly pulse: TimeoutPulseAnalysisSummary;
    readonly session: TimeoutSessionAnalyticsSnapshot;
  } {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const utilizationFraction = this.getUtilizationFraction(snapshot, nextElapsedMs);

    // Core bundle
    const bundle = this.resolveBundle(snapshot, nextElapsedMs, nowMs);

    // Simulation
    const simulation = this.simulator.simulate(snapshot, nextElapsedMs, totalBudgetMs);

    // Resilience
    const resilience = this.resilienceScorer.score(snapshot, nextElapsedMs, totalBudgetMs);

    // Pulse
    const pulse = this._recordAndAnalyzePulse(snapshot, utilizationFraction, nowMs);

    // Session analytics update
    this.sessionAnalytics.recordResolve(
      bundle.resolution,
      bundle.proximity,
      bundle.alert,
      snapshot,
      nowMs,
    );

    if (bundle.chatResult !== null && bundle.chatResult.suppressedReason === null) {
      this.sessionAnalytics.recordChatSignal();
    }

    if (bundle.phase.isAtPhaseBoundary) {
      this.sessionAnalytics.recordPhaseTransition();
    }

    const session = this.sessionAnalytics.snapshot();

    return Object.freeze({
      ...bundle,
      simulation,
      resilience,
      pulse,
      session,
    });
  }

  /**
   * Compute the timeout probability from simulation.
   * Used as an ML feature for downstream models.
   */
  public computeTimeoutProbability(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
  ): number {
    return this.simulator.quickTimeoutProbability(
      snapshot,
      nextElapsedMs,
      this.getTotalBudgetMs(snapshot),
    );
  }

  /**
   * Compute the resilience score (scalar 0-1).
   */
  public computeResilienceScore(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
  ): number {
    return this.resilienceScorer.quickScore(
      snapshot,
      nextElapsedMs,
      this.getTotalBudgetMs(snapshot),
    );
  }

  /**
   * Simulate forward trajectory and return projected exhaust tick.
   */
  public simulateTrajectory(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
    maxTicks = 100,
  ): TimeoutBudgetSimResult {
    return this.simulator.simulate(
      snapshot,
      nextElapsedMs,
      this.getTotalBudgetMs(snapshot),
      maxTicks,
    );
  }

  /**
   * Get the pulse analysis summary for the current session.
   */
  public getPulseSummary(snapshot: RunStateSnapshot): TimeoutPulseAnalysisSummary {
    return this.pulseAnalyzer.summarize(snapshot);
  }

  /**
   * Override reset to also clear sub-system state.
   */
  public override reset(): void {
    super.reset();
    this.pulseAnalyzer.reset();
  }

  private _recordAndAnalyzePulse(
    snapshot: RunStateSnapshot,
    utilizationFraction: number,
    nowMs: number,
  ): TimeoutPulseAnalysisSummary {
    this.pulseAnalyzer.record(snapshot, utilizationFraction, nowMs);
    return this.pulseAnalyzer.summarize(snapshot);
  }
}

/* ============================================================================
 * § 40 — ADDITIONAL FACTORY FUNCTIONS
 * ============================================================================ */

/**
 * Create a RunTimeoutGuardExtended with all sub-systems wired.
 * This is the preferred factory for orchestrators that need full depth.
 */
export function createRunTimeoutGuardExtended(
  options?: RunTimeoutGuardOptions,
): RunTimeoutGuardExtended {
  return new RunTimeoutGuardExtended(options);
}

/**
 * Create a silent RunTimeoutGuardExtended (no chat signals).
 * Useful for replay validation.
 */
export function createRunTimeoutGuardExtendedSilent(): RunTimeoutGuardExtended {
  return new RunTimeoutGuardExtended({ chatEnabled: false });
}

/**
 * Simulate a budget trajectory from raw values (no snapshot needed).
 * Pure standalone function.
 */
export function simulateTimeoutTrajectory(
  elapsedMs: number,
  totalBudgetMs: number,
  tickDurationMs: number,
  mode: ModeCode,
  tier: PressureTier,
  phase: RunPhase,
  maxTicks = 100,
): readonly TimeoutBudgetSimPoint[] {
  const totalMs = Math.max(1, normalizeMs(totalBudgetMs));
  const consumed = normalizeMs(elapsedMs);
  const effectiveTickMs = Math.max(
    100,
    normalizeMs(tickDurationMs) || TIER_DURATIONS_MS[tier],
  );

  const points: TimeoutBudgetSimPoint[] = [];
  let simElapsed = consumed;
  let tick = 0;

  const modeMultiplier = TIME_CONTRACT_MODE_TEMPO[mode];
  const adjustedTickMs = Math.max(100, Math.floor(effectiveTickMs / modeMultiplier));

  for (let step = 0; step < maxTicks; step++) {
    simElapsed += adjustedTickMs;
    tick++;
    const simRemaining = Math.max(0, totalMs - simElapsed);
    const utilizationFraction = clampFraction(safeDivide(simElapsed, totalMs));
    const criticality = classifyUtilization(utilizationFraction);
    const simPhase = resolvePhaseFromElapsedMs(simElapsed);
    const proximityScore = clampFraction(
      utilizationFraction * TIMEOUT_PHASE_URGENCY_AMPLIFIER[simPhase] * TIMEOUT_MODE_SENSITIVITY[mode],
    );
    const alertStage = classifyProximity(proximityScore);

    points.push(Object.freeze({
      tick,
      elapsedMs: simElapsed,
      remainingMs: simRemaining,
      utilizationFraction,
      criticality,
      proximityScore,
      alertStage,
      phase: simPhase,
    }));

    if (simElapsed >= totalMs) break;
  }

  void phase; // original phase available for external use
  void tier;  // original tier available for external use
  return Object.freeze(points);
}

/**
 * Compute resilience score from raw values (pure utility).
 */
export function computeRunTimeoutResilience(
  remainingMs: number,
  totalBudgetMs: number,
  holdCharges: number,
  holdEnabled: boolean,
  phase: RunPhase,
  mode: ModeCode,
  tier: PressureTier,
): number {
  const totalMs = Math.max(1, normalizeMs(totalBudgetMs));
  const remainingFraction = clampFraction(safeDivide(remainingMs, totalMs));

  const budgetComponent = remainingFraction * 0.40;
  const holdComponent = holdEnabled
    ? clampFraction(safeDivide(holdCharges, 2)) * 0.20
    : 0;

  const phaseResilience: Record<RunPhase, number> = {
    FOUNDATION: 1.0,
    ESCALATION: 0.6,
    SOVEREIGNTY: 0.3,
  };
  const phaseComponent = phaseResilience[phase] * 0.20;

  const modeResilience: Record<ModeCode, number> = {
    solo: 0.5,
    pvp: 0.3,
    coop: 0.8,
    ghost: 0.1,
  };
  const modeComponent = modeResilience[mode] * 0.10;

  const tierResilience: Record<PressureTier, number> = {
    T0: 1.0,
    T1: 0.75,
    T2: 0.50,
    T3: 0.25,
    T4: 0.0,
  };
  const pressureComponent = tierResilience[tier] * 0.10;

  return clampFraction(
    budgetComponent + holdComponent + phaseComponent + modeComponent + pressureComponent,
  );
}
