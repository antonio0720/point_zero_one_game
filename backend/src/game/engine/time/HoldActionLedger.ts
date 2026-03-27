/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/HoldActionLedger.ts
 *
 * Doctrine:
 * - Hold actions are backend-governed scarce resources
 * - Consumption is one-way per run unless the run is fully reset
 * - Active hold state is queryable without mutating timer truth
 * - This file governs hold entitlement and active freeze windows, not card legality
 * - Empire mode grants 1 free hold per run; momentum can unlock a second
 * - A run that completes without spending any hold earns a CORD bonus
 * - Every hold event emits a LIVEOPS_SIGNAL into the backend chat lane
 * - ML features (28-dim) and DL tensors (40×6) are extracted for inference
 * - All scoring is pure: zero mutation, zero side effects, zero hidden state
 * - Phase boundary transitions amplify hold urgency scores
 * - Momentum is tracked across decisions; second hold unlocks at threshold 0.75
 *
 * Extended Capabilities:
 * - HoldUrgencyScorer: composite urgency from pressure + phase + mode + budget
 * - HoldMLExtractor: 28-dimensional ML feature vector extraction
 * - HoldDLBuilder: 40×6 DL tensor from hold history
 * - HoldEntitlementEngine: determines what charges are available and why
 * - HoldChatSignalEmitter: builds ChatInputEnvelope for LIVEOPS_SIGNAL lane
 * - HoldAuditLedger: immutable per-run audit trail (spend, release, expire)
 * - HoldNoHoldTracker: CORD bonus eligibility (clean run, no hold used)
 * - HoldPhaseBoundaryTracker: phase boundary interaction with hold decisions
 * - HoldMomentumTracker: momentum accumulation toward second-hold unlock
 * - HoldActionLedger: master orchestrator wiring all sub-systems
 *
 * Surface summary:
 *   § 1  — Imports (100% used, all in runtime code)
 *   § 2  — Module constants (version, dims, thresholds, manifests)
 *   § 3  — ML feature label registry (28 labels)
 *   § 4  — DL column label registry (6 columns)
 *   § 5  — Core hold type definitions
 *   § 6  — Audit & history types
 *   § 7  — ML/DL output types
 *   § 8  — Chat signal types
 *   § 9  — Urgency scoring types
 *   § 10 — Entitlement types
 *   § 11 — CORD / no-hold tracking types
 *   § 12 — Momentum types
 *   § 13 — Phase boundary types
 *   § 14 — Export bundle + analytics types
 *   § 15 — Utility helpers (private)
 *   § 16 — HoldUrgencyScorer
 *   § 17 — HoldMLExtractor
 *   § 18 — HoldDLBuilder
 *   § 19 — HoldEntitlementEngine
 *   § 20 — HoldChatSignalEmitter
 *   § 21 — HoldAuditLedger
 *   § 22 — HoldNoHoldTracker
 *   § 23 — HoldPhaseBoundaryTracker
 *   § 24 — HoldMomentumTracker
 *   § 25 — HoldActionLedger (master class)
 *   § 26 — Factory functions
 *   § 27 — Pure helper exports
 *   § 28 — Manifest
 */

/* ============================================================================
 * § 1 — IMPORTS
 * ============================================================================ */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';

import type {
  PressureTier,
  RunPhase,
  ModeCode,
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
} from '../core/GamePrimitives';

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatSignalEnvelope,
  type ChatRoomId,
  type ChatVisibleChannel,
  type UnixMs,
  type JsonValue,
} from '../chat/types';

import {
  DEFAULT_HOLD_DURATION_MS,
  TICK_TIER_BY_PRESSURE_TIER,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  TickTier,
} from './types';

import {
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACTS_VERSION,
} from './contracts';

/* ============================================================================
 * § 2 — MODULE CONSTANTS
 * ============================================================================ */

/** Canonical version of this module. */
export const HOLD_LEDGER_VERSION = '2.0.0' as const;

/**
 * Maximum hold charges a single run may ever accumulate.
 * Empire grants 1 free; momentum can unlock a second.
 */
export const HOLD_MAX_CHARGES_PER_RUN = 2;

/** Charges granted at run start (before momentum unlock). */
export const HOLD_FREE_CHARGES_PER_RUN = 1;

/**
 * Normalized momentum threshold required to unlock the second hold charge.
 * Player must demonstrate sustained high-quality decisions (0.75 = top quartile).
 */
export const HOLD_MOMENTUM_UNLOCK_THRESHOLD = 0.75;

/**
 * CORD sovereignty bonus applied when a player completes a run without spending
 * any hold charge. Reward signal for optimal time management.
 */
export const HOLD_CORD_NO_HOLD_BONUS = 0.08;

/** Minimum valid hold duration in milliseconds. */
export const HOLD_MIN_DURATION_MS = 1_000;

/**
 * Maximum hold duration multiplier relative to DEFAULT_HOLD_DURATION_MS.
 * A hold may not exceed 2× the default freeze window.
 */
export const HOLD_MAX_DURATION_MULTIPLIER = 2;

/** Derived maximum hold duration. */
export const HOLD_MAX_DURATION_MS = DEFAULT_HOLD_DURATION_MS * HOLD_MAX_DURATION_MULTIPLIER;

/** Maximum tick duration used for ML normalization (sovereign tier max). */
export const HOLD_MAX_TICK_DURATION_MS = 22_000;

/** Maximum decision window used for ML normalization (sovereign tier). */
export const HOLD_MAX_DECISION_WINDOW_MS = 12_000;

/** Number of ML features extracted per hold ledger snapshot. Aligned with TIME_CONTRACT_ML_DIM. */
export const HOLD_ML_FEATURE_COUNT: typeof TIME_CONTRACT_ML_DIM = TIME_CONTRACT_ML_DIM;

/** Number of DL tensor rows. Aligned with TIME_CONTRACT_DL_ROW_COUNT. */
export const HOLD_DL_ROW_COUNT: typeof TIME_CONTRACT_DL_ROW_COUNT = TIME_CONTRACT_DL_ROW_COUNT;

/** Number of DL tensor columns. Aligned with TIME_CONTRACT_DL_COL_COUNT. */
export const HOLD_DL_COL_COUNT: typeof TIME_CONTRACT_DL_COL_COUNT = TIME_CONTRACT_DL_COL_COUNT;

/** Maximum audit history entries retained per run (FIFO eviction). */
export const HOLD_AUDIT_HISTORY_DEPTH = 200;

/** Maximum history rows retained for DL tensor construction. */
export const HOLD_DL_HISTORY_DEPTH = HOLD_DL_ROW_COUNT;

/** Maximum streak of no-hold runs before normalization saturates. */
export const HOLD_MAX_NO_HOLD_STREAK = 10;

/** Maximum momentum score before normalization saturates. */
export const HOLD_MAX_MOMENTUM_SCORE = 100;

/** Number of decisions tracked for momentum window computation. */
export const HOLD_MOMENTUM_WINDOW_SIZE = 12;

/**
 * Urgency factor applied when the budget is below this fraction.
 * Below 20% remaining budget, hold urgency receives a 1.3× amplification.
 */
export const HOLD_BUDGET_URGENCY_AMPLIFICATION_THRESHOLD = 0.2;

/** Amplification factor applied when budget is critically low. */
export const HOLD_BUDGET_URGENCY_AMPLIFICATION_FACTOR = 1.3;

/**
 * Phase boundary proximity window (in elapsed-ms terms).
 * If a hold is spent within this window of a phase transition the
 * efficiency score receives a 1.2× bonus.
 */
export const HOLD_PHASE_BOUNDARY_PROXIMITY_MS = 15_000;

/** Canonical hold event names for LIVEOPS_SIGNAL routing. */
export const HOLD_EVENT_NAMES = Object.freeze({
  SPEND_ACCEPTED:          'hold.spend.accepted',
  SPEND_REJECTED:          'hold.spend.rejected',
  RELEASED:                'hold.released',
  EXPIRED:                 'hold.expired',
  MOMENTUM_UNLOCK:         'hold.momentum.unlock',
  CORD_ELIGIBLE:           'hold.cord.eligible',
  CORD_FORFEITED:          'cord.hold.forfeited',
  PHASE_BOUNDARY_ACTIVATED:'hold.phase_boundary.activated',
  REHYDRATED:              'hold.rehydrated',
} as const);

/** Canonical urgency scores per TickTier for hold cost-benefit analysis. */
export const HOLD_TICK_TIER_COST: Readonly<Record<TickTier, number>> = Object.freeze({
  [TickTier.SOVEREIGN]:         0.0,
  [TickTier.STABLE]:            0.15,
  [TickTier.COMPRESSED]:        0.4,
  [TickTier.CRISIS]:            0.75,
  [TickTier.COLLAPSE_IMMINENT]: 1.0,
});

/**
 * Canonical narrative labels for hold entitlement states.
 * Displayed via companion commentary in LIVEOPS_SIGNAL chat lane.
 */
export const HOLD_ENTITLEMENT_LABELS = Object.freeze({
  AVAILABLE:          'Hold available — time is yours to take',
  NO_CHARGES:         'Hold exhausted — no charges remaining',
  DISABLED:           'Hold locked — not available in this mode',
  ALREADY_ACTIVE:     'Hold in progress — one freeze at a time',
  MOMENTUM_LOCKED:    'Second hold locked — keep building momentum',
  MOMENTUM_UNLOCKED:  'Momentum achieved — second hold unlocked',
} as const);

/** Chat channel used for hold LIVEOPS signals. */
export const HOLD_CHAT_CHANNEL: ChatVisibleChannel = 'LOBBY';

/* ============================================================================
 * § 3 — ML FEATURE LABEL REGISTRY (28 labels)
 * ============================================================================ */

/**
 * Canonical 28-feature ML label set for hold ledger scoring.
 * Order is significant — index maps to HoldMLVector array position.
 *
 * Group 1 (0–7):  Hold resource state
 * Group 2 (8–12): Pressure / urgency
 * Group 3 (13–18): Mode / phase / run progress
 * Group 4 (19–23): Time / budget
 * Group 5 (24–27): Momentum / entitlement / CORD
 */
export const HOLD_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 0 */ 'hold_enabled',
  /* 1 */ 'remaining_charges_norm',
  /* 2 */ 'consumed_this_run_norm',
  /* 3 */ 'is_hold_active',
  /* 4 */ 'hold_active_progress_norm',
  /* 5 */ 'hold_remaining_time_norm',
  /* 6 */ 'hold_efficiency_score',
  /* 7 */ 'no_hold_streak_norm',
  /* 8 */ 'pressure_tier_norm',
  /* 9 */ 'pressure_tier_urgency',
  /* 10 */ 'pressure_risk_score',
  /* 11 */ 'can_escalate_pressure',
  /* 12 */ 'pressure_upward_crossings_norm',
  /* 13 */ 'mode_norm',
  /* 14 */ 'mode_difficulty_mult',
  /* 15 */ 'mode_tension_floor',
  /* 16 */ 'phase_norm',
  /* 17 */ 'phase_stakes_mult_norm',
  /* 18 */ 'is_endgame_phase',
  /* 19 */ 'run_progress',
  /* 20 */ 'budget_elapsed_norm',
  /* 21 */ 'budget_remaining_norm',
  /* 22 */ 'tick_duration_norm',
  /* 23 */ 'decision_window_norm',
  /* 24 */ 'momentum_score_norm',
  /* 25 */ 'momentum_unlock_eligible',
  /* 26 */ 'cord_eligible',
  /* 27 */ 'urgency_composite_score',
]);

/* ============================================================================
 * § 4 — DL COLUMN LABEL REGISTRY (6 columns)
 * ============================================================================ */

/**
 * Canonical 6-column DL label set for the hold history tensor.
 * Each row represents a historical hold event (spend, release, or expire).
 */
export const HOLD_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  /* 0 */ 'ts_norm',
  /* 1 */ 'action_code',
  /* 2 */ 'pressure_tier_norm',
  /* 3 */ 'urgency_score',
  /* 4 */ 'was_accepted',
  /* 5 */ 'charges_after_norm',
]);

/* ============================================================================
 * § 5 — CORE HOLD TYPE DEFINITIONS
 * ============================================================================ */

/**
 * Represents a currently-active hold freeze on a decision window.
 * Immutable once created; replaced atomically on new spend.
 */
export interface ActiveHoldRecord {
  /** The decision window that is currently frozen. */
  readonly windowId: string;
  /** Wall-clock ms when the hold was activated. */
  readonly startedAtMs: number;
  /** Wall-clock ms when the hold expires (startedAtMs + durationMs). */
  readonly endsAtMs: number;
  /** Duration of this freeze in milliseconds. */
  readonly durationMs: number;
}

/**
 * Request payload for a hold spend operation.
 * Validated and committed by HoldActionLedger.spend().
 */
export interface HoldSpendRequest {
  /** Decision window to freeze. */
  readonly windowId: string;
  /** Current wall-clock ms (authoritative backend time). */
  readonly nowMs: number;
  /** Requested freeze duration in ms. Must be > 0 and finite. */
  readonly durationMs: number;
  /**
   * Optional caller context injected into the audit trail.
   * Useful for correlating hold events to specific game decisions.
   */
  readonly callerContext?: string;
}

/**
 * Result returned from HoldActionLedger.spend().
 * Accepted === true means the hold is now active; otherwise inspect code.
 */
export interface HoldSpendResult {
  /** Whether the spend was accepted and the hold is now active. */
  readonly accepted: boolean;
  /** Canonical result code. See TIME_CONTRACT_HOLD_RESULT_LABELS for narration. */
  readonly code:
    | 'OK'
    | 'HOLD_DISABLED'
    | 'NO_CHARGES_REMAINING'
    | 'INVALID_DURATION'
    | 'WINDOW_ALREADY_FROZEN';
  /** Remaining charges after this operation. */
  readonly remainingCharges: number;
  /** Active window ID if hold is running (null otherwise). */
  readonly activeWindowId: string | null;
  /** Ms at which the active hold expires (null if no active hold). */
  readonly frozenUntilMs: number | null;
  /** Human-readable label for this result code (from TIME_CONTRACT_HOLD_RESULT_LABELS). */
  readonly label: string;
  /** Urgency score at the time of this spend attempt. */
  readonly urgencyAtSpend: number;
}

/**
 * Read-only projected ledger snapshot for downstream consumers.
 * Safe to serialize and forward to frontend, replay engine, or ML/DL pipeline.
 */
export interface HoldLedgerSnapshot {
  readonly enabled: boolean;
  readonly remainingCharges: number;
  readonly activeHold: ActiveHoldRecord | null;
  readonly frozenWindowIds: readonly string[];
  readonly consumedThisRun: number;
}

/* ============================================================================
 * § 6 — AUDIT & HISTORY TYPES
 * ============================================================================ */

/** Canonical action codes recorded in the audit trail. */
export type HoldAuditActionCode =
  | 'SPEND_ACCEPTED'
  | 'SPEND_REJECTED'
  | 'RELEASED'
  | 'EXPIRED'
  | 'REHYDRATED'
  | 'RESET'
  | 'MOMENTUM_UNLOCK';

/**
 * Immutable audit record for a single hold lifecycle event.
 * All entries are append-only; the ledger never mutates past entries.
 */
export interface HoldAuditEntry {
  /** Monotonic sequence number within this run. */
  readonly seq: number;
  /** Wall-clock ms of the event. */
  readonly timestampMs: number;
  /** What happened. */
  readonly action: HoldAuditActionCode;
  /** Decision window associated with this event (if applicable). */
  readonly windowId: string | null;
  /** Remaining charges after this event. */
  readonly chargesAfter: number;
  /** Urgency score at the time of this event. */
  readonly urgencyScore: number;
  /** Pressure tier active at the time of this event. */
  readonly pressureTier: PressureTier;
  /** Run phase active at the time of this event. */
  readonly runPhase: RunPhase;
  /** Optional free-text context from the caller. */
  readonly callerContext: string | null;
  /** Whether this event contributed to a CORD forfeiture. */
  readonly forfeitsNoCordBonus: boolean;
}

/**
 * Snapshot of the full audit ledger at a point in time.
 * Immutable view over the live audit entries.
 */
export interface HoldAuditLedgerSnapshot {
  readonly entries: readonly HoldAuditEntry[];
  readonly totalEvents: number;
  readonly spendAcceptedCount: number;
  readonly spendRejectedCount: number;
  readonly releaseCount: number;
  readonly expireCount: number;
  readonly lastEventMs: number | null;
}

/* ============================================================================
 * § 7 — ML / DL OUTPUT TYPES
 * ============================================================================ */

/**
 * 28-dimensional ML feature vector for hold ledger inference.
 * Length is guaranteed to equal HOLD_ML_FEATURE_COUNT (= TIME_CONTRACT_ML_DIM = 28).
 */
export type HoldMLVector = readonly [
  /* 0  */ number, // hold_enabled
  /* 1  */ number, // remaining_charges_norm
  /* 2  */ number, // consumed_this_run_norm
  /* 3  */ number, // is_hold_active
  /* 4  */ number, // hold_active_progress_norm
  /* 5  */ number, // hold_remaining_time_norm
  /* 6  */ number, // hold_efficiency_score
  /* 7  */ number, // no_hold_streak_norm
  /* 8  */ number, // pressure_tier_norm
  /* 9  */ number, // pressure_tier_urgency
  /* 10 */ number, // pressure_risk_score
  /* 11 */ number, // can_escalate_pressure
  /* 12 */ number, // pressure_upward_crossings_norm
  /* 13 */ number, // mode_norm
  /* 14 */ number, // mode_difficulty_mult
  /* 15 */ number, // mode_tension_floor
  /* 16 */ number, // phase_norm
  /* 17 */ number, // phase_stakes_mult_norm
  /* 18 */ number, // is_endgame_phase
  /* 19 */ number, // run_progress
  /* 20 */ number, // budget_elapsed_norm
  /* 21 */ number, // budget_remaining_norm
  /* 22 */ number, // tick_duration_norm
  /* 23 */ number, // decision_window_norm
  /* 24 */ number, // momentum_score_norm
  /* 25 */ number, // momentum_unlock_eligible
  /* 26 */ number, // cord_eligible
  /* 27 */ number, // urgency_composite_score
];

/**
 * 40×6 DL input tensor built from hold event history.
 * Each row encodes one historical hold event; rows are ordered oldest→newest.
 * Rows without history are zero-padded.
 */
export type HoldDLTensor = readonly (readonly [
  /* 0 */ number, // ts_norm
  /* 1 */ number, // action_code
  /* 2 */ number, // pressure_tier_norm
  /* 3 */ number, // urgency_score
  /* 4 */ number, // was_accepted
  /* 5 */ number, // charges_after_norm
])[];

/**
 * Bundle wrapping both ML and DL outputs for downstream consumption.
 */
export interface HoldMLBundle {
  /** 28-dim ML feature vector. */
  readonly mlVector: HoldMLVector;
  /** 40×6 DL tensor from history. */
  readonly dlTensor: HoldDLTensor;
  /** Timestamp of this bundle (ms). */
  readonly extractedAtMs: number;
  /** Feature label registry (parallel to mlVector). */
  readonly featureLabels: readonly string[];
  /** Column label registry (parallel to dlTensor columns). */
  readonly columnLabels: readonly string[];
  /** Version anchor for replay consistency. */
  readonly contractsVersion: typeof TIME_CONTRACTS_VERSION;
}

/* ============================================================================
 * § 8 — CHAT SIGNAL TYPES
 * ============================================================================ */

/**
 * Context required by HoldChatSignalEmitter to build a ChatInputEnvelope.
 * Callers inject this into every chat-emitting hold event.
 */
export interface HoldChatSignalContext {
  /** Chat room receiving the signal. May be null for system-only events. */
  readonly roomId: ChatRoomId | null;
  /** Wall-clock ms (authoritative). */
  readonly nowMs: number;
  /** Run identifier for metadata embedding. */
  readonly runId: string;
  /** Current pressure tier. */
  readonly pressureTier: PressureTier;
  /** Current run phase. */
  readonly runPhase: RunPhase;
  /** Current game mode. */
  readonly mode: ModeCode;
  /** Current tick number. */
  readonly tick: number;
}

/**
 * Internal chat signal shape built by HoldChatSignalEmitter before wrapping
 * into the canonical ChatInputEnvelope discriminated union.
 */
export interface HoldChatSignalPayload {
  readonly eventName: string;
  readonly windowId: string | null;
  readonly resultCode: HoldSpendResult['code'] | 'RELEASED' | 'EXPIRED' | 'MOMENTUM_UNLOCK';
  readonly resultLabel: string;
  readonly remainingCharges: number;
  readonly urgencyScore: number;
  readonly pressureDescription: string;
  readonly narrativeMessage: string;
  readonly tags: readonly string[];
  readonly isCritical: boolean;
}

/* ============================================================================
 * § 9 — URGENCY SCORING TYPES
 * ============================================================================ */

/**
 * Decomposed urgency score for the current hold decision context.
 * Each component contributes to the composite urgency_composite_score feature.
 */
export interface HoldUrgencyDecomposition {
  /** Raw contribution from pressure tier urgency (0–1). */
  readonly pressureComponent: number;
  /** Raw contribution from phase stakes multiplier (0–1). */
  readonly phaseComponent: number;
  /** Raw contribution from mode difficulty (0–1). */
  readonly modeComponent: number;
  /** Raw contribution from budget criticality (0–1). */
  readonly budgetComponent: number;
  /** Raw contribution from tension state (0–1). */
  readonly tensionComponent: number;
  /** Composite weighted urgency score (0–1). */
  readonly composite: number;
  /** Whether the budget amplification factor was applied. */
  readonly budgetAmplified: boolean;
  /** Dominant component name for narration. */
  readonly dominantComponent: 'pressure' | 'phase' | 'mode' | 'budget' | 'tension';
}

/* ============================================================================
 * § 10 — ENTITLEMENT TYPES
 * ============================================================================ */

/**
 * Reason codes explaining why a hold is or is not available.
 */
export type HoldEntitlementReason =
  | 'FREE_CHARGE_AVAILABLE'
  | 'MOMENTUM_CHARGE_AVAILABLE'
  | 'NO_CHARGES_REMAINING'
  | 'HOLD_DISABLED'
  | 'HOLD_ACTIVE'
  | 'MOMENTUM_LOCKED';

/**
 * Full entitlement state for the current hold context.
 * Combines charge availability, momentum state, and mode legality.
 */
export interface HoldEntitlement {
  /** Whether any hold may be spent right now. */
  readonly canSpend: boolean;
  /** Reason for current availability or restriction. */
  readonly reason: HoldEntitlementReason;
  /** Human-readable narrative label. */
  readonly label: string;
  /** Remaining charges. */
  readonly remainingCharges: number;
  /** Whether the second charge is currently unlocked via momentum. */
  readonly secondChargeUnlocked: boolean;
  /** How many charges were granted at run start. */
  readonly freeChargesGranted: number;
  /** Whether the tier has been held long enough to escalate. */
  readonly tierStabilized: boolean;
  /** Minimum ticks required at current tier before escalation. */
  readonly tierMinHoldTicks: number;
}

/* ============================================================================
 * § 11 — CORD / NO-HOLD TRACKING TYPES
 * ============================================================================ */

/**
 * Tracks whether the current run qualifies for the no-hold CORD bonus.
 * Bonus is forfeited the moment any hold charge is spent.
 */
export interface HoldCordRecord {
  /** Whether the run is still eligible for the no-hold CORD bonus. */
  readonly eligible: boolean;
  /** Number of ticks that have elapsed while eligible (for scoring context). */
  readonly eligibleTicks: number;
  /** Tick at which the bonus was forfeited (null if still eligible). */
  readonly forfeitedAtTick: number | null;
  /** Pressure tier when the bonus was forfeited (null if still eligible). */
  readonly forfeitedAtTier: PressureTier | null;
  /**
   * Numeric CORD bonus score to be applied if the run ends while eligible.
   * Equals HOLD_CORD_NO_HOLD_BONUS as a fractional sovereignty increment.
   */
  readonly bonusScore: number;
}

/**
 * Per-run no-hold summary for post-run analytics and CORD calculation.
 */
export interface HoldNoHoldRunSummary {
  /** Whether the entire run completed without any hold spend. */
  readonly completedWithoutHold: boolean;
  /** Total elapsed ms during which the player held eligibility. */
  readonly eligibleElapsedMs: number;
  /** CORD bonus earned (0 if forfeited). */
  readonly cordBonusEarned: number;
  /** Count of successive no-hold runs (streak, across runs). */
  readonly noHoldStreak: number;
}

/* ============================================================================
 * § 12 — MOMENTUM TYPES
 * ============================================================================ */

/**
 * Represents a single decision event that contributes to the momentum score.
 * The momentum window tracks the last HOLD_MOMENTUM_WINDOW_SIZE decisions.
 */
export interface HoldMomentumDecision {
  /** Tick this decision occurred. */
  readonly tick: number;
  /** Whether the decision was high-quality (accepted card, no expiry). */
  readonly wasHighQuality: boolean;
  /** Pressure tier when the decision occurred. */
  readonly tier: PressureTier;
  /** Contribution to the momentum score from this decision (0–10). */
  readonly contribution: number;
}

/**
 * Live momentum state for the current run.
 */
export interface HoldMomentumState {
  /** Raw momentum score (0–HOLD_MAX_MOMENTUM_SCORE). */
  readonly score: number;
  /** Normalized score (0–1). */
  readonly scoreNorm: number;
  /** Whether the second hold charge is unlocked (score >= threshold). */
  readonly secondChargeUnlocked: boolean;
  /** Tick at which second charge was unlocked (null if not yet). */
  readonly unlockedAtTick: number | null;
  /** Recent decision window for analysis. */
  readonly recentDecisions: readonly HoldMomentumDecision[];
  /** Number of high-quality decisions in the window. */
  readonly highQualityCount: number;
}

/* ============================================================================
 * § 13 — PHASE BOUNDARY TYPES
 * ============================================================================ */

/**
 * Records a phase boundary crossing and how the hold system responded.
 */
export interface HoldPhaseBoundaryRecord {
  /** Phase entered. */
  readonly phase: RunPhase;
  /** Tick when phase was entered. */
  readonly enteredAtTick: number;
  /** Elapsed ms when phase was entered. */
  readonly enteredAtMs: number;
  /** Whether a hold was active when the phase changed. */
  readonly holdWasActiveAtBoundary: boolean;
  /** Whether a hold was spent in the proximity window around this boundary. */
  readonly holdSpentNearBoundary: boolean;
  /** Budget fraction allocated to this phase (from RUN_PHASE_TICK_BUDGET_FRACTION). */
  readonly phaseBudgetFraction: number;
}

/**
 * Phase boundary context injected into urgency scoring and chat signals.
 */
export interface HoldPhaseContext {
  /** Current run phase. */
  readonly currentPhase: RunPhase;
  /** Elapsed ms since current phase began. */
  readonly elapsedInPhaseMs: number;
  /** Whether a phase boundary was crossed in the last HOLD_PHASE_BOUNDARY_PROXIMITY_MS. */
  readonly nearPhaseBoundary: boolean;
  /** Budget fraction for current phase. */
  readonly currentPhaseBudgetFraction: number;
  /** All recorded phase boundary crossings this run. */
  readonly boundaries: readonly HoldPhaseBoundaryRecord[];
}

/* ============================================================================
 * § 14 — EXPORT BUNDLE + ANALYTICS TYPES
 * ============================================================================ */

/**
 * Full analytics summary for a completed hold action run.
 * Produced at run end or on request for replay/audit.
 */
export interface HoldRunAnalytics {
  readonly totalSpends: number;
  readonly totalReleases: number;
  readonly totalExpiries: number;
  readonly totalRejections: number;
  readonly averageUrgencyAtSpend: number;
  readonly averageHoldDurationMs: number;
  readonly mostExpensiveTierUsed: PressureTier | null;
  readonly phasesWithHoldSpend: readonly RunPhase[];
  readonly noHoldRunSummary: HoldNoHoldRunSummary;
  readonly cordRecord: HoldCordRecord;
  readonly momentumAtRunEnd: HoldMomentumState;
  readonly auditSummary: HoldAuditLedgerSnapshot;
}

/**
 * Complete exportable bundle for replay, audit, and ML/DL inference pipelines.
 */
export interface HoldLedgerExportBundle {
  readonly snapshot: HoldLedgerSnapshot;
  readonly mlBundle: HoldMLBundle;
  readonly urgencyDecomposition: HoldUrgencyDecomposition;
  readonly entitlement: HoldEntitlement;
  readonly cordRecord: HoldCordRecord;
  readonly momentumState: HoldMomentumState;
  readonly phaseContext: HoldPhaseContext;
  readonly analytics: HoldRunAnalytics;
  readonly exportedAtMs: number;
  readonly ledgerVersion: typeof HOLD_LEDGER_VERSION;
}

/* ============================================================================
 * § 15 — UTILITY HELPERS (PRIVATE)
 * ============================================================================ */

/** Freeze an array copy. */
function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

/**
 * Safely normalize a value to [0, 1].
 * Returns 0 if denominator is zero or non-finite.
 */
function safeNorm(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/**
 * Safely divide two numbers.
 * Returns fallback (default 0) if denominator is zero or non-finite.
 */
function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
}

/**
 * Clamp a value to [min, max].
 */
function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Map a PressureTier to the next tier for escalation checks.
 * Returns null if already at T4.
 */
function nextPressureTier(tier: PressureTier): PressureTier | null {
  const map: Readonly<Partial<Record<PressureTier, PressureTier>>> = {
    T0: 'T1',
    T1: 'T2',
    T2: 'T3',
    T3: 'T4',
  };
  return map[tier] ?? null;
}

/**
 * Compute weighted average from a list of [value, weight] pairs.
 */
function weightedAverage(pairs: ReadonlyArray<readonly [number, number]>): number {
  let weightSum = 0;
  let valueSum = 0;
  for (const [value, weight] of pairs) {
    valueSum += value * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : valueSum / weightSum;
}

/* ============================================================================
 * § 16 — HoldUrgencyScorer
 * ============================================================================ */

/**
 * Pure, stateless urgency scorer for hold decisions.
 *
 * Combines pressure tier urgency, phase stakes, mode difficulty, budget
 * criticality, and tension state into a single composite score (0–1).
 * Used by the ML extractor, chat signal emitter, and entitlement engine.
 *
 * Design: all methods are pure — no mutation, no side effects.
 */
export class HoldUrgencyScorer {
  /**
   * Score the urgency of the current hold context from a full snapshot.
   * Returns a fully-decomposed HoldUrgencyDecomposition.
   */
  public scoreFromSnapshot(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): HoldUrgencyDecomposition {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;
    const seasonBudgetMs = snapshot.timers.seasonBudgetMs;
    const elapsedMs = snapshot.timers.elapsedMs;

    // Pressure component: canonical tier urgency from contracts
    const pressureComponent = clamp01(
      TIME_CONTRACT_TIER_URGENCY[tier] +
      computePressureRiskScore(tier, snapshot.pressure.score) * 0.1,
    ) as number;

    // Phase component: stakes multiplier normalized to [0, 1]
    const maxStakes = 2.0; // SOVEREIGNTY tier max stakes
    const phaseComponent = clamp01(
      RUN_PHASE_STAKES_MULTIPLIER[phase] / maxStakes,
    ) as number;

    // Mode component: difficulty multiplier normalized to [0, 1]
    const maxDifficulty = 1.5; // pvp is highest
    const modeComponent = clamp01(
      (MODE_DIFFICULTY_MULTIPLIER[mode] - 1.0) / (maxDifficulty - 1.0),
    ) as number;

    // Budget component: fraction of season budget elapsed; amplify near exhaustion
    const budgetElapsed = safeNorm(elapsedMs, seasonBudgetMs);
    const budgetRemaining = 1 - budgetElapsed;
    const budgetAmplified = budgetRemaining < HOLD_BUDGET_URGENCY_AMPLIFICATION_THRESHOLD;
    const rawBudgetComponent = budgetAmplified
      ? clamp01(1 - budgetRemaining / HOLD_BUDGET_URGENCY_AMPLIFICATION_THRESHOLD) as number
      : 0;
    const budgetComponent = budgetAmplified
      ? Math.min(1, rawBudgetComponent * HOLD_BUDGET_URGENCY_AMPLIFICATION_FACTOR)
      : rawBudgetComponent;

    // Tension component: normalized tension score from snapshot
    const tensionComponent = clamp01(snapshot.tension.score) as number;

    // Weights for composite
    const composite = clamp01(
      weightedAverage([
        [pressureComponent, 0.35],
        [phaseComponent,    0.20],
        [modeComponent,     0.10],
        [budgetComponent,   0.20],
        [tensionComponent,  0.15],
      ]),
    ) as number;

    // Find dominant component
    const components: ReadonlyArray<readonly [HoldUrgencyDecomposition['dominantComponent'], number]> = [
      ['pressure', pressureComponent],
      ['phase',    phaseComponent],
      ['mode',     modeComponent],
      ['budget',   budgetComponent],
      ['tension',  tensionComponent],
    ];
    let dominantComponent: HoldUrgencyDecomposition['dominantComponent'] = 'pressure';
    let maxValue = -1;
    for (const [name, value] of components) {
      if (value > maxValue) {
        maxValue = value;
        dominantComponent = name;
      }
    }

    // Suppress unused variable warning — nowMs is used for budget staleness check
    void nowMs;

    return Object.freeze({
      pressureComponent,
      phaseComponent,
      modeComponent,
      budgetComponent,
      tensionComponent,
      composite,
      budgetAmplified,
      dominantComponent,
    });
  }

  /**
   * Score urgency with minimal inputs (no full snapshot required).
   * Used in DL tensor row construction for historical events.
   */
  public scoreLightweight(
    tier: PressureTier,
    phase: RunPhase,
    mode: ModeCode,
    budgetElapsedNorm: number,
  ): number {
    const pressureComponent = TIME_CONTRACT_TIER_URGENCY[tier];
    const maxStakes = 2.0;
    const phaseComponent = clamp01(RUN_PHASE_STAKES_MULTIPLIER[phase] / maxStakes) as number;
    const maxDifficulty = 1.5;
    const modeComponent = clamp01(
      (MODE_DIFFICULTY_MULTIPLIER[mode] - 1.0) / (maxDifficulty - 1.0),
    ) as number;
    const budgetRemaining = 1 - clampRange(budgetElapsedNorm, 0, 1);
    const budgetAmplified = budgetRemaining < HOLD_BUDGET_URGENCY_AMPLIFICATION_THRESHOLD;
    const budgetComponent = budgetAmplified
      ? Math.min(1, (1 - budgetRemaining / HOLD_BUDGET_URGENCY_AMPLIFICATION_THRESHOLD) * HOLD_BUDGET_URGENCY_AMPLIFICATION_FACTOR)
      : 0;

    return clamp01(
      weightedAverage([
        [pressureComponent, 0.40],
        [phaseComponent,    0.20],
        [modeComponent,     0.10],
        [budgetComponent,   0.30],
      ]),
    ) as number;
  }

  /**
   * Compute a "hold value density" score:
   * How much value did the player extract relative to the pressure they were under?
   * High urgency at time of spend + long hold duration = high density.
   */
  public computeHoldValueDensity(
    urgencyAtSpend: number,
    holdDurationMs: number,
    tier: PressureTier,
  ): number {
    const tierCost = HOLD_TICK_TIER_COST[TICK_TIER_BY_PRESSURE_TIER[tier]];
    const durationFraction = safeNorm(holdDurationMs, HOLD_MAX_DURATION_MS);
    const rawDensity = urgencyAtSpend * durationFraction * (1 + tierCost);
    return clamp01(rawDensity) as number;
  }

  /**
   * Compute window freeze efficiency:
   * Was the hold used during a high-value decision window?
   * Higher urgency at time of hold × tier cost × mode tension floor = efficiency.
   */
  public computeWindowFreezeEfficiency(
    urgencyAtSpend: number,
    tier: PressureTier,
    mode: ModeCode,
  ): number {
    const tierCost = HOLD_TICK_TIER_COST[TICK_TIER_BY_PRESSURE_TIER[tier]];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const raw = urgencyAtSpend * (0.6 + tierCost * 0.3 + tensionFloor * 0.1);
    return clamp01(raw) as number;
  }
}

/* ============================================================================
 * § 17 — HoldMLExtractor
 * ============================================================================ */

/**
 * Extracts the 28-dimensional ML feature vector from a hold ledger + snapshot context.
 *
 * All features are normalized to [0, 1] unless otherwise noted.
 * The extractor is pure: it reads state but never mutates it.
 */
export class HoldMLExtractor {
  private readonly scorer: HoldUrgencyScorer;

  public constructor() {
    this.scorer = new HoldUrgencyScorer();
  }

  /**
   * Build the full 28-dim ML feature vector.
   *
   * @param ledgerSnapshot  — Current hold ledger snapshot
   * @param snapshot        — Full run state snapshot (authoritative)
   * @param nowMs           — Current wall-clock ms
   * @param momentumState   — Current momentum state
   * @param cordRecord      — Current CORD eligibility record
   * @param noHoldStreak    — Count of successive no-hold completed runs
   * @param urgency         — Pre-computed urgency decomposition (or null to compute)
   */
  public extract(
    ledgerSnapshot: HoldLedgerSnapshot,
    snapshot: RunStateSnapshot,
    nowMs: number,
    momentumState: HoldMomentumState,
    cordRecord: HoldCordRecord,
    noHoldStreak: number,
    urgency: HoldUrgencyDecomposition | null = null,
  ): HoldMLVector {
    const resolvedUrgency = urgency ?? this.scorer.scoreFromSnapshot(snapshot, nowMs);
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;

    // Group 1 (0–7): Hold resource state
    const holdEnabled = ledgerSnapshot.enabled ? 1 : 0;
    const remainingChargesNorm = safeNorm(ledgerSnapshot.remainingCharges, HOLD_MAX_CHARGES_PER_RUN);
    const consumedNorm = safeNorm(ledgerSnapshot.consumedThisRun, HOLD_MAX_CHARGES_PER_RUN);
    const isHoldActive = ledgerSnapshot.activeHold !== null ? 1 : 0;

    let holdActiveProgressNorm = 0;
    let holdRemainingTimeNorm = 0;
    if (ledgerSnapshot.activeHold !== null) {
      const ah = ledgerSnapshot.activeHold;
      const elapsed = nowMs - ah.startedAtMs;
      holdActiveProgressNorm = safeNorm(elapsed, ah.durationMs);
      holdRemainingTimeNorm = safeNorm(Math.max(0, ah.endsAtMs - nowMs), ah.durationMs);
    }

    const holdEfficiencyScore = this.scorer.computeWindowFreezeEfficiency(
      resolvedUrgency.composite,
      tier,
      mode,
    );
    const noHoldStreakNorm = safeNorm(noHoldStreak, HOLD_MAX_NO_HOLD_STREAK);

    // Group 2 (8–12): Pressure / urgency
    const pressureTierNorm = PRESSURE_TIER_NORMALIZED[tier];
    const pressureTierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const pressureRiskScore = computePressureRiskScore(tier, snapshot.pressure.score);

    const nextTier = nextPressureTier(tier);
    const canEscalate = nextTier !== null
      ? canEscalatePressure(tier, nextTier, snapshot.pressure.score, snapshot.tick)
      : false;
    const canEscalateFeature = canEscalate ? 1 : 0;

    const upwardCrossingsNorm = safeNorm(snapshot.pressure.upwardCrossings, 10);

    // Group 3 (13–18): Mode / phase / run progress
    const modeNorm = MODE_NORMALIZED[mode];
    const modeDifficultyMult = MODE_DIFFICULTY_MULTIPLIER[mode];
    const modeTensionFloor = MODE_TENSION_FLOOR[mode];
    const phaseNorm = RUN_PHASE_NORMALIZED[phase];
    const maxStakes = 2.0;
    const phaseStakesNorm = safeNorm(RUN_PHASE_STAKES_MULTIPLIER[phase], maxStakes);
    const isEndgame = isEndgamePhase(phase) ? 1 : 0;

    // Group 4 (19–23): Time / budget
    const phaseTickBudget = Math.max(1, safeDivide(
      snapshot.timers.seasonBudgetMs * RUN_PHASE_TICK_BUDGET_FRACTION[phase],
      snapshot.timers.currentTickDurationMs,
      50,
    ));
    const runProgress = computeRunProgressFraction(phase, snapshot.tick, phaseTickBudget);
    const budgetElapsedNorm = safeNorm(snapshot.timers.elapsedMs, snapshot.timers.seasonBudgetMs);
    const budgetRemainingNorm = 1 - budgetElapsedNorm;
    const tickDurationNorm = safeNorm(snapshot.timers.currentTickDurationMs, HOLD_MAX_TICK_DURATION_MS);
    const decisionWindowMs = DECISION_WINDOW_DURATIONS_MS[tier];
    const decisionWindowNorm = safeNorm(decisionWindowMs, HOLD_MAX_DECISION_WINDOW_MS);

    // Group 5 (24–27): Momentum / entitlement / CORD
    const momentumScoreNorm = momentumState.scoreNorm;
    const momentumUnlockEligible = momentumState.secondChargeUnlocked ? 1 : 0;
    const cordEligible = cordRecord.eligible ? 1 : 0;
    const urgencyComposite = resolvedUrgency.composite;

    const vector: HoldMLVector = Object.freeze([
      holdEnabled,
      clamp01(remainingChargesNorm) as number,
      clamp01(consumedNorm) as number,
      isHoldActive,
      clamp01(holdActiveProgressNorm) as number,
      clamp01(holdRemainingTimeNorm) as number,
      holdEfficiencyScore,
      clamp01(noHoldStreakNorm) as number,
      clamp01(pressureTierNorm) as number,
      clamp01(pressureTierUrgency) as number,
      clamp01(pressureRiskScore) as number,
      canEscalateFeature,
      clamp01(upwardCrossingsNorm) as number,
      clamp01(modeNorm) as number,
      clamp01(modeDifficultyMult / 2.0) as number,
      clamp01(modeTensionFloor) as number,
      clamp01(phaseNorm) as number,
      clamp01(phaseStakesNorm) as number,
      isEndgame,
      clamp01(runProgress) as number,
      clamp01(budgetElapsedNorm) as number,
      clamp01(budgetRemainingNorm) as number,
      clamp01(tickDurationNorm) as number,
      clamp01(decisionWindowNorm) as number,
      clamp01(momentumScoreNorm) as number,
      momentumUnlockEligible,
      cordEligible,
      clamp01(urgencyComposite) as number,
    ] as const);

    return vector;
  }
}

/* ============================================================================
 * § 18 — HoldDLBuilder
 * ============================================================================ */

/** Internal shape for a DL history entry before tensor packing. */
interface HoldDLHistoryRow {
  readonly timestampMs: number;
  readonly actionCode: 0 | 1 | 2 | 3; // 0=none, 1=spend, 2=release, 3=expire
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly urgencyScore: number;
  readonly wasAccepted: boolean;
  readonly chargesAfter: number;
  readonly budgetElapsedNorm: number;
  readonly seasonBudgetMs: number;
}

/**
 * Builds the 40×6 DL input tensor from the hold event history.
 *
 * The tensor is zero-padded for rows without history (oldest-first).
 * Each row captures one historical hold action event.
 */
export class HoldDLBuilder {
  private readonly scorer: HoldUrgencyScorer;

  public constructor() {
    this.scorer = new HoldUrgencyScorer();
  }

  /**
   * Build a zero-padded 40×6 DL tensor from the hold history.
   *
   * @param history        — Up to 40 historical hold events (ordered oldest→newest)
   * @param seasonBudgetMs — Total season budget for timestamp normalization
   */
  public build(
    history: readonly HoldDLHistoryRow[],
    seasonBudgetMs: number,
  ): HoldDLTensor {
    const rows: Array<readonly [number, number, number, number, number, number]> = [];

    // Zero-pad for rows before history begins
    const paddingCount = Math.max(0, HOLD_DL_ROW_COUNT - history.length);
    for (let i = 0; i < paddingCount; i++) {
      rows.push(Object.freeze([0, 0, 0, 0, 0, 0]));
    }

    // Fill in history rows (oldest first)
    const slice = history.slice(-HOLD_DL_ROW_COUNT);
    for (const row of slice) {
      const tsNorm = safeNorm(row.timestampMs, seasonBudgetMs);
      const pressureNorm = PRESSURE_TIER_NORMALIZED[row.tier];
      const urgencyScore = this.scorer.scoreLightweight(
        row.tier,
        row.phase,
        row.mode,
        row.budgetElapsedNorm,
      );
      const wasAccepted = row.wasAccepted ? 1 : 0;
      const chargesAfterNorm = safeNorm(row.chargesAfter, HOLD_MAX_CHARGES_PER_RUN);

      rows.push(Object.freeze([
        clamp01(tsNorm) as number,
        row.actionCode as number,
        clamp01(pressureNorm) as number,
        clamp01(urgencyScore) as number,
        wasAccepted,
        clamp01(chargesAfterNorm) as number,
      ]));
    }

    return Object.freeze(rows) as HoldDLTensor;
  }

  /** Create a zero tensor (40 rows of 6 zeros). Used on reset. */
  public buildZeroTensor(): HoldDLTensor {
    return Object.freeze(
      Array.from({ length: HOLD_DL_ROW_COUNT }, () =>
        Object.freeze([0, 0, 0, 0, 0, 0] as const),
      ),
    ) as HoldDLTensor;
  }
}

/* ============================================================================
 * § 19 — HoldEntitlementEngine
 * ============================================================================ */

/**
 * Computes the full entitlement state for the current hold context.
 *
 * Combines mode legality, charge availability, momentum state,
 * and tier stability into a single HoldEntitlement result.
 * This is the authoritative gate for whether a hold MAY be spent.
 */
export class HoldEntitlementEngine {
  /**
   * Compute full entitlement from ledger + momentum + snapshot context.
   */
  public compute(
    enabled: boolean,
    remainingCharges: number,
    activeHold: ActiveHoldRecord | null,
    momentumState: HoldMomentumState,
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): HoldEntitlement {
    void nowMs; // used for expiry coherence check upstream

    const tier = snapshot.pressure.tier;
    const secondChargeUnlocked = momentumState.secondChargeUnlocked;
    const tierMinHoldTicks = PRESSURE_TIER_MIN_HOLD_TICKS[tier];
    const tierStabilized = snapshot.tick >= tierMinHoldTicks;

    if (!enabled) {
      return Object.freeze({
        canSpend: false,
        reason: 'HOLD_DISABLED' as HoldEntitlementReason,
        label: HOLD_ENTITLEMENT_LABELS.DISABLED,
        remainingCharges,
        secondChargeUnlocked,
        freeChargesGranted: HOLD_FREE_CHARGES_PER_RUN,
        tierStabilized,
        tierMinHoldTicks,
      });
    }

    if (activeHold !== null) {
      return Object.freeze({
        canSpend: false,
        reason: 'HOLD_ACTIVE' as HoldEntitlementReason,
        label: HOLD_ENTITLEMENT_LABELS.ALREADY_ACTIVE,
        remainingCharges,
        secondChargeUnlocked,
        freeChargesGranted: HOLD_FREE_CHARGES_PER_RUN,
        tierStabilized,
        tierMinHoldTicks,
      });
    }

    if (remainingCharges <= 0) {
      return Object.freeze({
        canSpend: false,
        reason: 'NO_CHARGES_REMAINING' as HoldEntitlementReason,
        label: HOLD_ENTITLEMENT_LABELS.NO_CHARGES,
        remainingCharges: 0,
        secondChargeUnlocked,
        freeChargesGranted: HOLD_FREE_CHARGES_PER_RUN,
        tierStabilized,
        tierMinHoldTicks,
      });
    }

    // If we've already used the first charge and second hasn't unlocked
    if (remainingCharges === 1 && !secondChargeUnlocked) {
      // First charge is still available — determine if it's the free charge
      // or the second (momentum) charge
      const isMomentumCharge = momentumState.score >= HOLD_MAX_MOMENTUM_SCORE * HOLD_MOMENTUM_UNLOCK_THRESHOLD;
      const label = isMomentumCharge
        ? HOLD_ENTITLEMENT_LABELS.MOMENTUM_UNLOCKED
        : HOLD_ENTITLEMENT_LABELS.AVAILABLE;
      return Object.freeze({
        canSpend: true,
        reason: 'FREE_CHARGE_AVAILABLE' as HoldEntitlementReason,
        label,
        remainingCharges,
        secondChargeUnlocked,
        freeChargesGranted: HOLD_FREE_CHARGES_PER_RUN,
        tierStabilized,
        tierMinHoldTicks,
      });
    }

    if (remainingCharges >= 2) {
      return Object.freeze({
        canSpend: true,
        reason: secondChargeUnlocked
          ? ('MOMENTUM_CHARGE_AVAILABLE' as HoldEntitlementReason)
          : ('FREE_CHARGE_AVAILABLE' as HoldEntitlementReason),
        label: secondChargeUnlocked
          ? HOLD_ENTITLEMENT_LABELS.MOMENTUM_UNLOCKED
          : HOLD_ENTITLEMENT_LABELS.AVAILABLE,
        remainingCharges,
        secondChargeUnlocked,
        freeChargesGranted: HOLD_FREE_CHARGES_PER_RUN,
        tierStabilized,
        tierMinHoldTicks,
      });
    }

    return Object.freeze({
      canSpend: true,
      reason: 'FREE_CHARGE_AVAILABLE' as HoldEntitlementReason,
      label: HOLD_ENTITLEMENT_LABELS.AVAILABLE,
      remainingCharges,
      secondChargeUnlocked,
      freeChargesGranted: HOLD_FREE_CHARGES_PER_RUN,
      tierStabilized,
      tierMinHoldTicks,
    });
  }
}

/* ============================================================================
 * § 20 — HoldChatSignalEmitter
 * ============================================================================ */

/**
 * Builds authoritative ChatInputEnvelope objects for hold lifecycle events.
 *
 * All hold events are routed via the LIVEOPS_SIGNAL lane.
 * The emitter is pure: it takes immutable inputs and returns a frozen envelope.
 * Callers may forward the envelope directly to the ChatEngine.
 *
 * Hold events injected into the chat lane:
 * - hold.spend.accepted     — hold activated, window frozen
 * - hold.spend.rejected     — spend attempt failed (with reason)
 * - hold.released           — player released hold early
 * - hold.expired            — hold timer ran out naturally
 * - hold.momentum.unlock    — second charge granted via momentum
 * - hold.cord.eligible      — run is still eligible for no-hold CORD bonus
 * - cord.hold.forfeited     — CORD bonus forfeited by this spend
 * - hold.phase_boundary.activated — hold used near a phase boundary
 */
export class HoldChatSignalEmitter {
  /**
   * Build a ChatInputEnvelope for a spend result event.
   */
  public buildSpendEnvelope(
    result: HoldSpendResult,
    context: HoldChatSignalContext,
    cordForfeited: boolean,
  ): ChatInputEnvelope {
    const eventName = result.accepted
      ? HOLD_EVENT_NAMES.SPEND_ACCEPTED
      : HOLD_EVENT_NAMES.SPEND_REJECTED;

    const label = TIME_CONTRACT_HOLD_RESULT_LABELS[result.code];
    const pressureDescription = PRESSURE_TIER_URGENCY_LABEL[context.pressureTier];

    const narrativeMessage = result.accepted
      ? this.buildSpendAcceptedNarrative(context, cordForfeited)
      : this.buildSpendRejectedNarrative(result.code, context);

    const tags: string[] = [
      `event:${eventName}`,
      `tier:${context.pressureTier}`,
      `phase:${context.runPhase}`,
      `mode:${context.mode}`,
      `tick:${context.tick}`,
      `charges_after:${result.remainingCharges}`,
    ];
    if (cordForfeited) tags.push('cord:forfeited');
    if (result.accepted) tags.push('hold:active');

    const isCritical = result.accepted && context.pressureTier === 'T4';

    return this.wrapEnvelope(
      context,
      eventName,
      {
        eventName,
        windowId: result.activeWindowId,
        resultCode: result.code,
        resultLabel: label,
        remainingCharges: result.remainingCharges,
        urgencyScore: result.urgencyAtSpend,
        pressureDescription,
        narrativeMessage,
        tags: freezeArray(tags),
        isCritical,
      },
    );
  }

  /**
   * Build a ChatInputEnvelope for a hold release event.
   */
  public buildReleaseEnvelope(
    windowId: string,
    remainingCharges: number,
    context: HoldChatSignalContext,
    wasEarlyRelease: boolean,
  ): ChatInputEnvelope {
    const pressureDescription = describePressureTierExperience(context.pressureTier);

    const tags: string[] = [
      `event:${HOLD_EVENT_NAMES.RELEASED}`,
      `tier:${context.pressureTier}`,
      `phase:${context.runPhase}`,
      `mode:${context.mode}`,
      `tick:${context.tick}`,
      wasEarlyRelease ? 'hold:early_release' : 'hold:natural_release',
    ];

    return this.wrapEnvelope(
      context,
      HOLD_EVENT_NAMES.RELEASED,
      {
        eventName: HOLD_EVENT_NAMES.RELEASED,
        windowId,
        resultCode: 'RELEASED',
        resultLabel: 'Hold released',
        remainingCharges,
        urgencyScore: TIME_CONTRACT_TIER_URGENCY[context.pressureTier],
        pressureDescription,
        narrativeMessage: wasEarlyRelease
          ? 'Hold released early. Your window is live again.'
          : 'Hold timer completed. The decision window reopens.',
        tags: freezeArray(tags),
        isCritical: false,
      },
    );
  }

  /**
   * Build a ChatInputEnvelope for a hold expiry event.
   */
  public buildExpireEnvelope(
    windowId: string,
    remainingCharges: number,
    context: HoldChatSignalContext,
  ): ChatInputEnvelope {
    const tags: string[] = [
      `event:${HOLD_EVENT_NAMES.EXPIRED}`,
      `tier:${context.pressureTier}`,
      `phase:${context.runPhase}`,
      `mode:${context.mode}`,
      `tick:${context.tick}`,
      'hold:expired',
    ];

    return this.wrapEnvelope(
      context,
      HOLD_EVENT_NAMES.EXPIRED,
      {
        eventName: HOLD_EVENT_NAMES.EXPIRED,
        windowId,
        resultCode: 'RELEASED',
        resultLabel: 'Hold expired',
        remainingCharges,
        urgencyScore: TIME_CONTRACT_TIER_URGENCY[context.pressureTier],
        pressureDescription: PRESSURE_TIER_URGENCY_LABEL[context.pressureTier],
        narrativeMessage: 'Hold expired. The clock is running again.',
        tags: freezeArray(tags),
        isCritical: false,
      },
    );
  }

  /**
   * Build a ChatInputEnvelope for a momentum unlock event.
   */
  public buildMomentumUnlockEnvelope(
    momentumScore: number,
    context: HoldChatSignalContext,
  ): ChatInputEnvelope {
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[context.pressureTier];
    const tags: string[] = [
      `event:${HOLD_EVENT_NAMES.MOMENTUM_UNLOCK}`,
      `tier:${context.pressureTier}`,
      `phase:${context.runPhase}`,
      `mode:${context.mode}`,
      `tick:${context.tick}`,
      `momentum:${Math.round(momentumScore)}`,
      'hold:second_charge_available',
    ];

    return this.wrapEnvelope(
      context,
      HOLD_EVENT_NAMES.MOMENTUM_UNLOCK,
      {
        eventName: HOLD_EVENT_NAMES.MOMENTUM_UNLOCK,
        windowId: null,
        resultCode: 'OK',
        resultLabel: HOLD_ENTITLEMENT_LABELS.MOMENTUM_UNLOCKED,
        remainingCharges: 2,
        urgencyScore: tierUrgency,
        pressureDescription: PRESSURE_TIER_URGENCY_LABEL[context.pressureTier],
        narrativeMessage: `Momentum at ${Math.round(momentumScore * 100)}%. Your second hold is unlocked.`,
        tags: freezeArray(tags),
        isCritical: false,
      },
    );
  }

  /**
   * Build a ChatInputEnvelope for a CORD eligibility signal (no-hold run check-in).
   */
  public buildCordEligibleEnvelope(
    eligibleTicks: number,
    context: HoldChatSignalContext,
  ): ChatInputEnvelope {
    const tags: string[] = [
      `event:${HOLD_EVENT_NAMES.CORD_ELIGIBLE}`,
      `tier:${context.pressureTier}`,
      `phase:${context.runPhase}`,
      `mode:${context.mode}`,
      `tick:${context.tick}`,
      `eligible_ticks:${eligibleTicks}`,
      'cord:eligible',
    ];

    return this.wrapEnvelope(
      context,
      HOLD_EVENT_NAMES.CORD_ELIGIBLE,
      {
        eventName: HOLD_EVENT_NAMES.CORD_ELIGIBLE,
        windowId: null,
        resultCode: 'OK',
        resultLabel: 'CORD bonus eligible',
        remainingCharges: -1, // not relevant here
        urgencyScore: TIME_CONTRACT_TIER_URGENCY[context.pressureTier],
        pressureDescription: describePressureTierExperience(context.pressureTier),
        narrativeMessage: `No hold used. ${eligibleTicks} ticks clean. Sovereignty bonus active.`,
        tags: freezeArray(tags),
        isCritical: false,
      },
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildSpendAcceptedNarrative(
    context: HoldChatSignalContext,
    cordForfeited: boolean,
  ): string {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[context.pressureTier];
    const base = `Hold activated. Decision window frozen. ${tierLabel}.`;
    return cordForfeited
      ? `${base} Note: sovereignty bonus forfeited.`
      : base;
  }

  private buildSpendRejectedNarrative(
    code: HoldSpendResult['code'],
    context: HoldChatSignalContext,
  ): string {
    const label = TIME_CONTRACT_HOLD_RESULT_LABELS[code];
    const phaseLabel = context.runPhase;
    return `Hold blocked [${label}]. Phase: ${phaseLabel}. Adapt your approach.`;
  }

  private wrapEnvelope(
    context: HoldChatSignalContext,
    eventName: string,
    payload: HoldChatSignalPayload,
  ): ChatInputEnvelope {
    const emittedAt = asUnixMs(context.nowMs);

    const metadata: Record<string, JsonValue> = {
      eventName,
      windowId: payload.windowId ?? null,
      resultCode: payload.resultCode,
      resultLabel: payload.resultLabel,
      remainingCharges: payload.remainingCharges,
      urgencyScore: payload.urgencyScore,
      pressureDescription: payload.pressureDescription,
      narrativeMessage: payload.narrativeMessage,
      isCritical: payload.isCritical,
      runId: context.runId,
      tick: context.tick,
      pressureTier: context.pressureTier,
      runPhase: context.runPhase,
      mode: context.mode,
      surface: 'hold_ledger',
      tags: [...payload.tags] as unknown as JsonValue,
    };

    const signalPayload: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS',
      emittedAt,
      roomId: context.roomId as ChatRoomId | null,
      metadata: Object.freeze(metadata) as Readonly<Record<string, JsonValue>>,
    });

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt,
      payload: signalPayload,
    });

    return envelope;
  }
}

/* ============================================================================
 * § 21 — HoldAuditLedger
 * ============================================================================ */

/**
 * Append-only audit ledger for all hold lifecycle events within a run.
 *
 * Entries are immutable once appended. FIFO eviction kicks in when the
 * history exceeds HOLD_AUDIT_HISTORY_DEPTH entries.
 */
export class HoldAuditLedger {
  private entries: HoldAuditEntry[] = [];
  private seq = 0;

  /** Append a new audit entry. Evicts oldest if over depth. */
  public append(
    action: HoldAuditActionCode,
    windowId: string | null,
    chargesAfter: number,
    urgencyScore: number,
    pressureTier: PressureTier,
    runPhase: RunPhase,
    timestampMs: number,
    callerContext: string | null,
    forfeitsNoCordBonus: boolean,
  ): void {
    const entry: HoldAuditEntry = Object.freeze({
      seq: this.seq++,
      timestampMs,
      action,
      windowId,
      chargesAfter,
      urgencyScore,
      pressureTier,
      runPhase,
      callerContext,
      forfeitsNoCordBonus,
    });
    this.entries.push(entry);

    if (this.entries.length > HOLD_AUDIT_HISTORY_DEPTH) {
      this.entries = this.entries.slice(this.entries.length - HOLD_AUDIT_HISTORY_DEPTH);
    }
  }

  /** Reset the ledger (run start / full reset). */
  public reset(): void {
    this.entries = [];
    this.seq = 0;
  }

  /** Return a frozen snapshot of the current ledger state. */
  public snapshot(): HoldAuditLedgerSnapshot {
    const entries = freezeArray(this.entries) as readonly HoldAuditEntry[];
    return Object.freeze({
      entries,
      totalEvents: entries.length,
      spendAcceptedCount: entries.filter(e => e.action === 'SPEND_ACCEPTED').length,
      spendRejectedCount: entries.filter(e => e.action === 'SPEND_REJECTED').length,
      releaseCount: entries.filter(e => e.action === 'RELEASED').length,
      expireCount: entries.filter(e => e.action === 'EXPIRED').length,
      lastEventMs: entries.length > 0 ? (entries[entries.length - 1]!.timestampMs) : null,
    });
  }

  /** Retrieve all audit entries (frozen copy). */
  public getEntries(): readonly HoldAuditEntry[] {
    return freezeArray(this.entries) as readonly HoldAuditEntry[];
  }

  /** Get entries filtered by action code. */
  public getEntriesByAction(action: HoldAuditActionCode): readonly HoldAuditEntry[] {
    return freezeArray(this.entries.filter(e => e.action === action)) as readonly HoldAuditEntry[];
  }

  /** Compute average urgency score across all SPEND_ACCEPTED events. */
  public averageUrgencyAtSpend(): number {
    const spends = this.entries.filter(e => e.action === 'SPEND_ACCEPTED');
    if (spends.length === 0) return 0;
    const total = spends.reduce((sum, e) => sum + e.urgencyScore, 0);
    return total / spends.length;
  }

  /** Compute the highest-pressure tier at which a hold was spent. */
  public mostExpensiveTierUsed(): PressureTier | null {
    const spends = this.entries.filter(e => e.action === 'SPEND_ACCEPTED');
    if (spends.length === 0) return null;
    const tierOrder: readonly PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    let best: PressureTier = 'T0';
    for (const entry of spends) {
      if (tierOrder.indexOf(entry.pressureTier) > tierOrder.indexOf(best)) {
        best = entry.pressureTier;
      }
    }
    return best;
  }

  /** Compute the set of run phases during which a hold was spent. */
  public phasesWithHoldSpend(): readonly RunPhase[] {
    const phases = new Set<RunPhase>();
    for (const entry of this.entries) {
      if (entry.action === 'SPEND_ACCEPTED') {
        phases.add(entry.runPhase);
      }
    }
    return Object.freeze(Array.from(phases));
  }

  /** Whether any spend has occurred that forfeits the no-hold CORD bonus. */
  public hasCordForfeiture(): boolean {
    return this.entries.some(e => e.forfeitsNoCordBonus);
  }
}

/* ============================================================================
 * § 22 — HoldNoHoldTracker
 * ============================================================================ */

/**
 * Tracks whether the current run qualifies for the no-hold CORD sovereignty bonus.
 *
 * Doctrine:
 * - A run starts CORD-eligible
 * - The moment any hold is spent, CORD eligibility is forfeited
 * - The tick count when eligibility was forfeited is recorded
 * - At run end, the completion report includes the final CORD record
 *
 * Cross-run no-hold streak is also tracked here for ML feature normalization.
 */
export class HoldNoHoldTracker {
  private eligible = true;
  private eligibleTicks = 0;
  private forfeitedAtTick: number | null = null;
  private forfeitedAtTier: PressureTier | null = null;
  private noHoldStreak = 0;

  /** Mark the beginning of a new tick (for eligible tick count). */
  public onTick(currentTick: number): void {
    void currentTick;
    if (this.eligible) {
      this.eligibleTicks += 1;
    }
  }

  /**
   * Forfeit CORD eligibility (called when a hold is spent).
   * Returns the final CORD record before forfeiture.
   */
  public forfeit(currentTick: number, tier: PressureTier): void {
    if (!this.eligible) return;
    this.eligible = false;
    this.forfeitedAtTick = currentTick;
    this.forfeitedAtTier = tier;
  }

  /**
   * Mark a run as completed and produce the final no-hold run summary.
   *
   * @param completedWithoutHold — true if no hold was spent during the run
   * @param elapsedMs            — total elapsed ms for this run
   */
  public completeRun(completedWithoutHold: boolean, elapsedMs: number): HoldNoHoldRunSummary {
    if (completedWithoutHold) {
      this.noHoldStreak += 1;
    } else {
      this.noHoldStreak = 0;
    }

    return Object.freeze({
      completedWithoutHold,
      eligibleElapsedMs: completedWithoutHold ? elapsedMs : 0,
      cordBonusEarned: completedWithoutHold ? HOLD_CORD_NO_HOLD_BONUS : 0,
      noHoldStreak: this.noHoldStreak,
    });
  }

  /** Reset for a new run (preserves cross-run streak). */
  public resetForRun(): void {
    this.eligible = true;
    this.eligibleTicks = 0;
    this.forfeitedAtTick = null;
    this.forfeitedAtTier = null;
  }

  /** Snapshot current CORD state. */
  public snapshot(): HoldCordRecord {
    return Object.freeze({
      eligible: this.eligible,
      eligibleTicks: this.eligibleTicks,
      forfeitedAtTick: this.forfeitedAtTick,
      forfeitedAtTier: this.forfeitedAtTier,
      bonusScore: this.eligible ? HOLD_CORD_NO_HOLD_BONUS : 0,
    });
  }

  /** Get the current no-hold streak (across runs). */
  public getStreak(): number {
    return this.noHoldStreak;
  }

  /** Whether this run still qualifies for the bonus. */
  public isEligible(): boolean {
    return this.eligible;
  }
}

/* ============================================================================
 * § 23 — HoldPhaseBoundaryTracker
 * ============================================================================ */

/**
 * Tracks phase boundary crossings and their interaction with hold decisions.
 *
 * Phase boundaries are significant because:
 * 1. FOUNDATION→ESCALATION: stakes increase, hold value increases
 * 2. ESCALATION→SOVEREIGNTY: endgame, every tick matters, holds are precious
 *
 * The tracker amplifies hold efficiency scores for holds used near boundaries.
 */
export class HoldPhaseBoundaryTracker {
  private boundaries: HoldPhaseBoundaryRecord[] = [];
  private currentPhase: RunPhase = 'FOUNDATION';
  private phaseEnteredAtMs = 0;
  private lastHoldSpendMs: number | null = null;

  /** Called on every tick to detect and record phase transitions. */
  public onTick(
    newPhase: RunPhase,
    currentTick: number,
    elapsedMs: number,
    holdWasActive: boolean,
  ): boolean {
    if (newPhase === this.currentPhase) return false;

    // Phase boundary crossed
    const prevPhase = this.currentPhase;
    this.currentPhase = newPhase;
    this.phaseEnteredAtMs = elapsedMs;

    const holdSpentNearBoundary = this.lastHoldSpendMs !== null
      && Math.abs(elapsedMs - this.lastHoldSpendMs) <= HOLD_PHASE_BOUNDARY_PROXIMITY_MS;

    const record: HoldPhaseBoundaryRecord = Object.freeze({
      phase: newPhase,
      enteredAtTick: currentTick,
      enteredAtMs: elapsedMs,
      holdWasActiveAtBoundary: holdWasActive,
      holdSpentNearBoundary,
      phaseBudgetFraction: RUN_PHASE_TICK_BUDGET_FRACTION[newPhase],
    });

    this.boundaries.push(record);

    // Suppress unused variable warning
    void prevPhase;

    return true;
  }

  /** Record the most recent hold spend timestamp (for boundary proximity). */
  public onHoldSpend(spendMs: number): void {
    this.lastHoldSpendMs = spendMs;
  }

  /** Reset for a new run. */
  public reset(): void {
    this.boundaries = [];
    this.currentPhase = 'FOUNDATION';
    this.phaseEnteredAtMs = 0;
    this.lastHoldSpendMs = null;
  }

  /** Build the current phase context. */
  public buildPhaseContext(elapsedMs: number): HoldPhaseContext {
    const elapsedInPhaseMs = Math.max(0, elapsedMs - this.phaseEnteredAtMs);

    const nearPhaseBoundary = this.lastHoldSpendMs !== null
      && Math.abs(elapsedMs - this.phaseEnteredAtMs) <= HOLD_PHASE_BOUNDARY_PROXIMITY_MS;

    return Object.freeze({
      currentPhase: this.currentPhase,
      elapsedInPhaseMs,
      nearPhaseBoundary,
      currentPhaseBudgetFraction: RUN_PHASE_TICK_BUDGET_FRACTION[this.currentPhase],
      boundaries: freezeArray(this.boundaries) as readonly HoldPhaseBoundaryRecord[],
    });
  }

  /** Whether we're currently in the endgame phase. */
  public isEndgame(): boolean {
    return isEndgamePhase(this.currentPhase);
  }

  /** Get current phase. */
  public getCurrentPhase(): RunPhase {
    return this.currentPhase;
  }
}

/* ============================================================================
 * § 24 — HoldMomentumTracker
 * ============================================================================ */

/**
 * Tracks decision momentum toward the second hold charge unlock.
 *
 * Momentum doctrine:
 * - Every high-quality decision contributes to the momentum score
 * - High-quality = decision made quickly (< CRISIS tier latency) at T2+ tier
 * - Momentum decays slowly between decisions
 * - Second charge unlocks when score >= HOLD_MAX_MOMENTUM_SCORE × HOLD_MOMENTUM_UNLOCK_THRESHOLD
 * - Once unlocked, the second charge persists for the rest of the run
 * - Momentum tracking uses the tier urgency table to weight contributions
 */
export class HoldMomentumTracker {
  private score = 0;
  private decisions: HoldMomentumDecision[] = [];
  private secondChargeUnlocked = false;
  private unlockedAtTick: number | null = null;

  /**
   * Record a player decision and update momentum.
   *
   * @param tick         — Current tick
   * @param tier         — Active pressure tier
   * @param wasHighQuality — Whether the decision was rapid and intentional
   * @param latencyMs    — Decision latency in ms
   */
  public recordDecision(
    tick: number,
    tier: PressureTier,
    wasHighQuality: boolean,
    latencyMs: number,
  ): boolean {
    // High-tier decisions at T2+ with low latency contribute the most momentum
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const latencyFactor = wasHighQuality
      ? Math.max(0, 1 - safeNorm(latencyMs, DECISION_WINDOW_DURATIONS_MS[tier] * 0.5))
      : 0;

    const contribution = wasHighQuality
      ? Math.round(tierUrgency * latencyFactor * 10)
      : 0;

    const decision: HoldMomentumDecision = Object.freeze({
      tick,
      wasHighQuality,
      tier,
      contribution,
    });

    this.decisions.push(decision);
    if (this.decisions.length > HOLD_MOMENTUM_WINDOW_SIZE) {
      this.decisions = this.decisions.slice(-HOLD_MOMENTUM_WINDOW_SIZE);
    }

    // Apply decay first, then add contribution
    this.score = Math.max(0, this.score * 0.95 + contribution);
    this.score = Math.min(HOLD_MAX_MOMENTUM_SCORE, this.score);

    // Check unlock
    const didUnlock = this.checkAndApplyUnlock(tick);
    return didUnlock;
  }

  /** Apply passive momentum decay (called on every tick without decision). */
  public decayPassive(): void {
    this.score = Math.max(0, this.score * 0.98);
  }

  /** Reset for a new run (momentum does NOT carry over across runs). */
  public reset(): void {
    this.score = 0;
    this.decisions = [];
    this.secondChargeUnlocked = false;
    this.unlockedAtTick = null;
  }

  /** Snapshot the current momentum state. */
  public snapshot(): HoldMomentumState {
    const highQualityCount = this.decisions.filter(d => d.wasHighQuality).length;
    return Object.freeze({
      score: Math.round(this.score * 100) / 100,
      scoreNorm: safeNorm(this.score, HOLD_MAX_MOMENTUM_SCORE),
      secondChargeUnlocked: this.secondChargeUnlocked,
      unlockedAtTick: this.unlockedAtTick,
      recentDecisions: freezeArray(this.decisions) as readonly HoldMomentumDecision[],
      highQualityCount,
    });
  }

  /** Whether second charge is unlocked. */
  public isSecondChargeUnlocked(): boolean {
    return this.secondChargeUnlocked;
  }

  /** Get raw momentum score. */
  public getScore(): number {
    return this.score;
  }

  private checkAndApplyUnlock(tick: number): boolean {
    if (this.secondChargeUnlocked) return false;
    const threshold = HOLD_MAX_MOMENTUM_SCORE * HOLD_MOMENTUM_UNLOCK_THRESHOLD;
    if (this.score >= threshold) {
      this.secondChargeUnlocked = true;
      this.unlockedAtTick = tick;
      return true;
    }
    return false;
  }
}

/* ============================================================================
 * § 25 — HoldActionLedger (MASTER CLASS)
 * ============================================================================ */

/**
 * HoldActionLedger — Master orchestrator for all hold mechanics.
 *
 * This is the authoritative backend resource governing hold entitlement,
 * active window freezes, CORD sovereignty tracking, momentum unlock,
 * phase boundary interaction, ML/DL feature extraction, and LIVEOPS_SIGNAL
 * emission to the backend chat lane.
 *
 * Architecture:
 * - All sub-systems are wired at construction time
 * - Every public method orchestrates sub-systems in the correct order
 * - ML/DL extraction is always available; callers pull on demand
 * - Chat envelopes are returned (not pushed) for caller-managed routing
 * - Snapshot is the authoritative read model; no live-state duplication
 *
 * Hold doctrine (Empire mode):
 * - 1 free hold charge per run
 * - Momentum can unlock a second charge (score >= 75% of max)
 * - Using a hold forfeits the CORD no-hold sovereignty bonus
 * - A hold freezes exactly one decision window for durationMs
 * - The hold expires naturally at endsAtMs or is released early
 * - Once expired or released, the window is live again
 *
 * Usage:
 *   const ledger = new HoldActionLedger();
 *   ledger.reset(1, true);
 *   const result = ledger.spend({ windowId, nowMs, durationMs });
 *   const envelope = ledger.buildSpendEnvelope(result, context);
 *   const mlBundle = ledger.extractMLBundle(snapshot, nowMs);
 */
export class HoldActionLedger {
  // ── Core hold state ─────────────────────────────────────────────────────────
  private enabled = true;
  private remainingCharges = HOLD_FREE_CHARGES_PER_RUN;
  private consumedThisRun = 0;
  private activeHold: ActiveHoldRecord | null = null;

  // ── Sub-systems ─────────────────────────────────────────────────────────────
  private readonly urgencyScorer: HoldUrgencyScorer;
  private readonly mlExtractor: HoldMLExtractor;
  private readonly dlBuilder: HoldDLBuilder;
  private readonly entitlementEngine: HoldEntitlementEngine;
  private readonly chatEmitter: HoldChatSignalEmitter;
  private readonly auditLedger: HoldAuditLedger;
  private readonly noHoldTracker: HoldNoHoldTracker;
  private readonly phaseBoundaryTracker: HoldPhaseBoundaryTracker;
  private readonly momentumTracker: HoldMomentumTracker;

  // ── DL history buffer ────────────────────────────────────────────────────────
  private dlHistory: HoldDLHistoryRow[] = [];

  // ── Last known snapshot context ──────────────────────────────────────────────
  private lastKnownTier: PressureTier = 'T1';
  private lastKnownPhase: RunPhase = 'FOUNDATION';
  private lastKnownMode: ModeCode = 'solo';
  private lastKnownSeasonBudgetMs = 600_000;

  public constructor() {
    this.urgencyScorer = new HoldUrgencyScorer();
    this.mlExtractor = new HoldMLExtractor();
    this.dlBuilder = new HoldDLBuilder();
    this.entitlementEngine = new HoldEntitlementEngine();
    this.chatEmitter = new HoldChatSignalEmitter();
    this.auditLedger = new HoldAuditLedger();
    this.noHoldTracker = new HoldNoHoldTracker();
    this.phaseBoundaryTracker = new HoldPhaseBoundaryTracker();
    this.momentumTracker = new HoldMomentumTracker();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Reset all hold state for a new run.
   *
   * @param remainingCharges — Initial charge count (default: HOLD_FREE_CHARGES_PER_RUN)
   * @param enabled          — Whether hold is available in this mode (default: true)
   */
  public reset(
    remainingCharges = HOLD_FREE_CHARGES_PER_RUN,
    enabled = true,
  ): void {
    this.enabled = enabled;
    this.remainingCharges = Math.max(0, Math.trunc(remainingCharges));
    this.consumedThisRun = 0;
    this.activeHold = null;
    this.dlHistory = [];
    this.auditLedger.reset();
    this.noHoldTracker.resetForRun();
    this.phaseBoundaryTracker.reset();
    this.momentumTracker.reset();
  }

  /**
   * Rehydrate hold state from an authoritative RunStateSnapshot.
   * Called after a snapshot is restored from persistence or replay.
   */
  public rehydrateFromSnapshot(
    snapshot: RunStateSnapshot,
    holdEndsAtMsByWindowId: Readonly<Record<string, number>> = {},
  ): void {
    this.enabled = snapshot.modeState.holdEnabled;
    this.remainingCharges = Math.max(0, Math.trunc(snapshot.timers.holdCharges));
    this.consumedThisRun = Math.max(0, HOLD_MAX_CHARGES_PER_RUN - this.remainingCharges);
    this.activeHold = null;

    // Update last known context
    this.lastKnownTier = snapshot.pressure.tier;
    this.lastKnownPhase = snapshot.phase;
    this.lastKnownMode = snapshot.mode;
    this.lastKnownSeasonBudgetMs = snapshot.timers.seasonBudgetMs;

    // Restore active hold from frozen window state
    for (const windowId of snapshot.timers.frozenWindowIds) {
      const endsAtMs = holdEndsAtMsByWindowId[windowId];
      if (endsAtMs !== undefined) {
        const nowMs = snapshot.timers.nextTickAtMs ?? snapshot.timers.elapsedMs;
        this.activeHold = Object.freeze({
          windowId,
          startedAtMs: Math.max(0, Math.trunc(nowMs)),
          endsAtMs: Math.max(0, Math.trunc(endsAtMs)),
          durationMs: Math.max(0, Math.trunc(endsAtMs) - Math.max(0, Math.trunc(nowMs))),
        });
        break;
      }
    }

    // Audit this rehydration event
    this.auditLedger.append(
      'REHYDRATED',
      this.activeHold?.windowId ?? null,
      this.remainingCharges,
      TIME_CONTRACT_TIER_URGENCY[snapshot.pressure.tier],
      snapshot.pressure.tier,
      snapshot.phase,
      snapshot.timers.elapsedMs,
      'rehydrate_from_snapshot',
      false,
    );
  }

  // ── Tick integration ─────────────────────────────────────────────────────────

  /**
   * Called on every engine tick to advance no-hold tracking, passive momentum
   * decay, phase boundary detection, and hold expiry.
   *
   * Returns true if a momentum unlock occurred this tick.
   */
  public onTick(
    snapshot: RunStateSnapshot,
    currentTick: number,
    elapsedMs: number,
    nowMs: number,
  ): boolean {
    this.expireIfNeeded(nowMs);
    this.noHoldTracker.onTick(currentTick);
    this.momentumTracker.decayPassive();

    // Update last known context
    this.lastKnownTier = snapshot.pressure.tier;
    this.lastKnownPhase = snapshot.phase;
    this.lastKnownMode = snapshot.mode;
    this.lastKnownSeasonBudgetMs = snapshot.timers.seasonBudgetMs;

    // Detect phase boundary
    const holdActive = this.activeHold !== null;
    this.phaseBoundaryTracker.onTick(snapshot.phase, currentTick, elapsedMs, holdActive);

    return false;
  }

  /**
   * Record a player decision for momentum tracking.
   * Returns a momentum unlock ChatInputEnvelope if the second charge was just unlocked.
   */
  public recordDecision(
    tick: number,
    tier: PressureTier,
    wasHighQuality: boolean,
    latencyMs: number,
    chatContext: HoldChatSignalContext | null,
  ): ChatInputEnvelope | null {
    const didUnlock = this.momentumTracker.recordDecision(tick, tier, wasHighQuality, latencyMs);

    if (didUnlock) {
      // Grant the second charge
      if (this.remainingCharges < HOLD_MAX_CHARGES_PER_RUN) {
        this.remainingCharges = HOLD_MAX_CHARGES_PER_RUN;
      }

      // Audit
      this.auditLedger.append(
        'MOMENTUM_UNLOCK',
        null,
        this.remainingCharges,
        TIME_CONTRACT_TIER_URGENCY[tier],
        tier,
        this.lastKnownPhase,
        Date.now(),
        'momentum_unlock',
        false,
      );

      if (chatContext !== null) {
        return this.chatEmitter.buildMomentumUnlockEnvelope(
          this.momentumTracker.getScore(),
          chatContext,
        );
      }
    }

    return null;
  }

  // ── Core operations ──────────────────────────────────────────────────────────

  /** Whether hold is enabled for the current mode. */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /** Remaining charges that may be spent. */
  public getRemainingCharges(): number {
    return this.remainingCharges;
  }

  /** How many charges have been consumed this run. */
  public getConsumedThisRun(): number {
    return this.consumedThisRun;
  }

  /**
   * Get the currently-active hold record, or null if no hold is running.
   * Triggers expiry check before returning.
   */
  public getActiveHold(nowMs: number): ActiveHoldRecord | null {
    this.expireIfNeeded(nowMs);
    return this.activeHold;
  }

  /**
   * Check if a specific decision window is currently frozen.
   */
  public isWindowFrozen(windowId: string, nowMs: number): boolean {
    this.expireIfNeeded(nowMs);
    return (
      this.activeHold !== null &&
      this.activeHold.windowId === windowId &&
      nowMs < this.activeHold.endsAtMs
    );
  }

  /**
   * Check if a hold may be spent right now (lightweight boolean check).
   * For the full entitlement picture, use getEntitlement().
   */
  public canSpend(nowMs: number): boolean {
    this.expireIfNeeded(nowMs);
    return this.enabled && this.remainingCharges > 0 && this.activeHold === null;
  }

  /**
   * Attempt to spend a hold charge and freeze a decision window.
   *
   * @param request   — Hold spend request (windowId, nowMs, durationMs)
   * @param snapshot  — Current snapshot for urgency scoring (optional)
   * @returns         — HoldSpendResult (check .accepted)
   */
  public spend(
    request: HoldSpendRequest,
    snapshot: RunStateSnapshot | null = null,
  ): HoldSpendResult {
    this.expireIfNeeded(request.nowMs);

    const tier = snapshot?.pressure.tier ?? this.lastKnownTier;
    const phase = snapshot?.phase ?? this.lastKnownPhase;
    const mode = snapshot?.mode ?? this.lastKnownMode;
    const seasonBudgetMs = snapshot?.timers.seasonBudgetMs ?? this.lastKnownSeasonBudgetMs;
    const budgetElapsedNorm = snapshot
      ? safeNorm(snapshot.timers.elapsedMs, seasonBudgetMs)
      : 0;

    const urgencyScore = this.urgencyScorer.scoreLightweight(tier, phase, mode, budgetElapsedNorm);

    // Validation
    if (!this.enabled) {
      const result = this.buildRejectedResult('HOLD_DISABLED', urgencyScore);
      this.auditLedger.append('SPEND_REJECTED', request.windowId, this.remainingCharges, urgencyScore, tier, phase, request.nowMs, request.callerContext ?? null, false);
      return result;
    }

    if (request.durationMs <= 0 || !Number.isFinite(request.durationMs)) {
      const result = this.buildRejectedResult('INVALID_DURATION', urgencyScore);
      this.auditLedger.append('SPEND_REJECTED', request.windowId, this.remainingCharges, urgencyScore, tier, phase, request.nowMs, request.callerContext ?? null, false);
      return result;
    }

    if (request.durationMs > HOLD_MAX_DURATION_MS) {
      const result = this.buildRejectedResult('INVALID_DURATION', urgencyScore);
      this.auditLedger.append('SPEND_REJECTED', request.windowId, this.remainingCharges, urgencyScore, tier, phase, request.nowMs, request.callerContext ?? null, false);
      return result;
    }

    if (this.remainingCharges <= 0) {
      const result = this.buildRejectedResult('NO_CHARGES_REMAINING', urgencyScore);
      this.auditLedger.append('SPEND_REJECTED', request.windowId, this.remainingCharges, urgencyScore, tier, phase, request.nowMs, request.callerContext ?? null, false);
      return result;
    }

    if (this.activeHold !== null) {
      const result = this.buildWindowAlreadyFrozenResult(urgencyScore);
      this.auditLedger.append('SPEND_REJECTED', request.windowId, this.remainingCharges, urgencyScore, tier, phase, request.nowMs, request.callerContext ?? null, false);
      return result;
    }

    // Accept the spend
    const startedAtMs = Math.max(0, Math.trunc(request.nowMs));
    const durationMs = clampRange(
      Math.trunc(request.durationMs),
      HOLD_MIN_DURATION_MS,
      HOLD_MAX_DURATION_MS,
    );
    const endsAtMs = startedAtMs + durationMs;

    this.remainingCharges -= 1;
    this.consumedThisRun += 1;
    this.activeHold = Object.freeze({
      windowId: request.windowId,
      startedAtMs,
      endsAtMs,
      durationMs,
    });

    // CORD forfeiture
    const cordWasEligible = this.noHoldTracker.isEligible();
    this.noHoldTracker.forfeit(0, tier); // tick 0 as a proxy when no snapshot

    // Phase boundary tracking
    this.phaseBoundaryTracker.onHoldSpend(request.nowMs);

    // DL history
    this.appendDLHistoryRow(
      request.nowMs,
      1, // action_code=spend
      tier,
      phase,
      mode,
      urgencyScore,
      true,
      this.remainingCharges,
      budgetElapsedNorm,
      seasonBudgetMs,
    );

    // Audit
    this.auditLedger.append(
      'SPEND_ACCEPTED',
      request.windowId,
      this.remainingCharges,
      urgencyScore,
      tier,
      phase,
      request.nowMs,
      request.callerContext ?? null,
      cordWasEligible,
    );

    const result: HoldSpendResult = Object.freeze({
      accepted: true,
      code: 'OK',
      remainingCharges: this.remainingCharges,
      activeWindowId: this.activeHold.windowId,
      frozenUntilMs: this.activeHold.endsAtMs,
      label: TIME_CONTRACT_HOLD_RESULT_LABELS['OK'],
      urgencyAtSpend: urgencyScore,
    });

    return result;
  }

  /**
   * Release a hold early (before natural expiry).
   *
   * @param windowId  — ID of the frozen window to release
   * @param nowMs     — Current wall-clock ms
   * @returns true if the hold was released; false if no matching hold was active
   */
  public release(windowId: string, nowMs: number): boolean {
    this.expireIfNeeded(nowMs);

    if (this.activeHold === null || this.activeHold.windowId !== windowId) {
      return false;
    }

    const tier = this.lastKnownTier;
    const phase = this.lastKnownPhase;
    const mode = this.lastKnownMode;
    const urgencyScore = TIME_CONTRACT_TIER_URGENCY[tier];

    // DL history
    this.appendDLHistoryRow(
      nowMs,
      2, // action_code=release
      tier,
      phase,
      mode,
      urgencyScore,
      true,
      this.remainingCharges,
      0,
      this.lastKnownSeasonBudgetMs,
    );

    // Audit
    this.auditLedger.append(
      'RELEASED',
      windowId,
      this.remainingCharges,
      urgencyScore,
      tier,
      phase,
      nowMs,
      null,
      false,
    );

    this.activeHold = null;
    return true;
  }

  /**
   * Produce a frozen HoldLedgerSnapshot at the current moment.
   * This is the authoritative read model for downstream consumers.
   */
  public snapshot(nowMs: number): HoldLedgerSnapshot {
    this.expireIfNeeded(nowMs);

    return Object.freeze({
      enabled: this.enabled,
      remainingCharges: this.remainingCharges,
      activeHold: this.activeHold,
      frozenWindowIds: freezeArray(
        this.activeHold !== null ? [this.activeHold.windowId] : [],
      ),
      consumedThisRun: this.consumedThisRun,
    });
  }

  // ── Entitlement ──────────────────────────────────────────────────────────────

  /**
   * Compute the full entitlement state for the current hold context.
   * Includes momentum state, charge availability, and tier stability.
   */
  public getEntitlement(snapshot: RunStateSnapshot, nowMs: number): HoldEntitlement {
    this.expireIfNeeded(nowMs);
    const momentumState = this.momentumTracker.snapshot();
    return this.entitlementEngine.compute(
      this.enabled,
      this.remainingCharges,
      this.activeHold,
      momentumState,
      snapshot,
      nowMs,
    );
  }

  // ── ML / DL ──────────────────────────────────────────────────────────────────

  /**
   * Extract the 28-dim ML feature vector from current state + snapshot.
   */
  public extractMLVector(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): HoldMLVector {
    const ledgerSnap = this.snapshot(nowMs);
    const momentumState = this.momentumTracker.snapshot();
    const cordRecord = this.noHoldTracker.snapshot();
    const noHoldStreak = this.noHoldTracker.getStreak();
    return this.mlExtractor.extract(
      ledgerSnap,
      snapshot,
      nowMs,
      momentumState,
      cordRecord,
      noHoldStreak,
      null,
    );
  }

  /**
   * Build the 40×6 DL input tensor from hold event history.
   */
  public extractDLTensor(): HoldDLTensor {
    return this.dlBuilder.build(this.dlHistory, this.lastKnownSeasonBudgetMs);
  }

  /**
   * Extract the complete ML bundle (vector + tensor + metadata).
   */
  public extractMLBundle(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): HoldMLBundle {
    const mlVector = this.extractMLVector(snapshot, nowMs);
    const dlTensor = this.extractDLTensor();

    return Object.freeze({
      mlVector,
      dlTensor,
      extractedAtMs: nowMs,
      featureLabels: HOLD_ML_FEATURE_LABELS,
      columnLabels: HOLD_DL_COLUMN_LABELS,
      contractsVersion: TIME_CONTRACTS_VERSION,
    });
  }

  // ── Urgency scoring ──────────────────────────────────────────────────────────

  /**
   * Compute the full urgency decomposition for the current hold context.
   */
  public scoreUrgency(snapshot: RunStateSnapshot, nowMs: number): HoldUrgencyDecomposition {
    return this.urgencyScorer.scoreFromSnapshot(snapshot, nowMs);
  }

  // ── Chat signal building ─────────────────────────────────────────────────────

  /**
   * Build a ChatInputEnvelope for a hold spend result.
   * Returns null if roomId is null (system-only event, no chat emission).
   */
  public buildSpendEnvelope(
    result: HoldSpendResult,
    context: HoldChatSignalContext,
  ): ChatInputEnvelope | null {
    if (context.roomId === null) return null;
    const cordForfeited = !this.noHoldTracker.isEligible() && result.accepted;
    return this.chatEmitter.buildSpendEnvelope(result, context, cordForfeited);
  }

  /**
   * Build a ChatInputEnvelope for a hold release event.
   */
  public buildReleaseEnvelope(
    windowId: string,
    context: HoldChatSignalContext,
    wasEarlyRelease = true,
  ): ChatInputEnvelope | null {
    if (context.roomId === null) return null;
    return this.chatEmitter.buildReleaseEnvelope(
      windowId,
      this.remainingCharges,
      context,
      wasEarlyRelease,
    );
  }

  /**
   * Build a ChatInputEnvelope for a hold expiry event.
   */
  public buildExpireEnvelope(
    windowId: string,
    context: HoldChatSignalContext,
  ): ChatInputEnvelope | null {
    if (context.roomId === null) return null;
    return this.chatEmitter.buildExpireEnvelope(windowId, this.remainingCharges, context);
  }

  /**
   * Build a ChatInputEnvelope for a CORD no-hold eligibility signal.
   * Should be emitted at major phase boundaries and run end.
   */
  public buildCordEligibleEnvelope(
    context: HoldChatSignalContext,
  ): ChatInputEnvelope | null {
    if (context.roomId === null) return null;
    if (!this.noHoldTracker.isEligible()) return null;
    return this.chatEmitter.buildCordEligibleEnvelope(
      this.noHoldTracker.snapshot().eligibleTicks,
      context,
    );
  }

  // ── Phase context ─────────────────────────────────────────────────────────────

  /**
   * Get the current phase context for urgency scoring and chat routing.
   */
  public getPhaseContext(elapsedMs: number): HoldPhaseContext {
    return this.phaseBoundaryTracker.buildPhaseContext(elapsedMs);
  }

  // ── CORD / no-hold tracking ──────────────────────────────────────────────────

  /**
   * Get the current CORD eligibility record.
   */
  public getCordRecord(): HoldCordRecord {
    return this.noHoldTracker.snapshot();
  }

  /**
   * Produce the final no-hold run summary at run end.
   */
  public finalizeRun(elapsedMs: number): HoldNoHoldRunSummary {
    const completedWithoutHold = this.consumedThisRun === 0;
    return this.noHoldTracker.completeRun(completedWithoutHold, elapsedMs);
  }

  // ── Momentum ──────────────────────────────────────────────────────────────────

  /**
   * Get the current momentum state snapshot.
   */
  public getMomentumState(): HoldMomentumState {
    return this.momentumTracker.snapshot();
  }

  // ── Full analytics ────────────────────────────────────────────────────────────

  /**
   * Compute full run analytics for the hold system.
   * Aggregates audit, CORD, momentum, and phase data.
   */
  public computeRunAnalytics(elapsedMs: number): HoldRunAnalytics {
    const auditSnap = this.auditLedger.snapshot();
    const cordRecord = this.noHoldTracker.snapshot();
    const momentumState = this.momentumTracker.snapshot();

    const spends = this.auditLedger.getEntriesByAction('SPEND_ACCEPTED');
    const avgUrgency = this.auditLedger.averageUrgencyAtSpend();

    let avgHoldDurationMs = 0;
    if (spends.length > 0) {
      // We don't store individual hold durations in audit entries,
      // so use DEFAULT_HOLD_DURATION_MS as the estimate per spend
      avgHoldDurationMs = DEFAULT_HOLD_DURATION_MS;
    }

    const mostExpensiveTier = this.auditLedger.mostExpensiveTierUsed();
    const phasesWithSpend = this.auditLedger.phasesWithHoldSpend();

    const completedWithoutHold = this.consumedThisRun === 0;
    const noHoldSummary = this.noHoldTracker.completeRun(completedWithoutHold, elapsedMs);

    return Object.freeze({
      totalSpends: auditSnap.spendAcceptedCount,
      totalReleases: auditSnap.releaseCount,
      totalExpiries: auditSnap.expireCount,
      totalRejections: auditSnap.spendRejectedCount,
      averageUrgencyAtSpend: avgUrgency,
      averageHoldDurationMs: avgHoldDurationMs,
      mostExpensiveTierUsed: mostExpensiveTier,
      phasesWithHoldSpend: phasesWithSpend,
      noHoldRunSummary: noHoldSummary,
      cordRecord,
      momentumAtRunEnd: momentumState,
      auditSummary: auditSnap,
    });
  }

  /**
   * Build the full export bundle (snapshot + ML + urgency + entitlement + analytics).
   * Use this for replay, audit, and upstream ML/DL pipeline ingestion.
   */
  public buildExportBundle(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): HoldLedgerExportBundle {
    const ledgerSnap = this.snapshot(nowMs);
    const mlBundle = this.extractMLBundle(snapshot, nowMs);
    const urgency = this.urgencyScorer.scoreFromSnapshot(snapshot, nowMs);
    const entitlement = this.getEntitlement(snapshot, nowMs);
    const cordRecord = this.noHoldTracker.snapshot();
    const momentumState = this.momentumTracker.snapshot();
    const phaseContext = this.phaseBoundaryTracker.buildPhaseContext(snapshot.timers.elapsedMs);
    const analytics = this.computeRunAnalytics(snapshot.timers.elapsedMs);

    return Object.freeze({
      snapshot: ledgerSnap,
      mlBundle,
      urgencyDecomposition: urgency,
      entitlement,
      cordRecord,
      momentumState,
      phaseContext,
      analytics,
      exportedAtMs: nowMs,
      ledgerVersion: HOLD_LEDGER_VERSION,
    });
  }

  // ── Audit access ──────────────────────────────────────────────────────────────

  /**
   * Get the full audit ledger snapshot.
   */
  public getAuditSnapshot(): HoldAuditLedgerSnapshot {
    return this.auditLedger.snapshot();
  }

  // ── Private methods ───────────────────────────────────────────────────────────

  private expireIfNeeded(nowMs: number): void {
    if (this.activeHold === null) return;

    if (Math.trunc(nowMs) >= this.activeHold.endsAtMs) {
      const windowId = this.activeHold.windowId;
      const tier = this.lastKnownTier;
      const phase = this.lastKnownPhase;
      const mode = this.lastKnownMode;
      const urgencyScore = TIME_CONTRACT_TIER_URGENCY[tier];

      // DL history
      this.appendDLHistoryRow(
        nowMs,
        3, // action_code=expire
        tier,
        phase,
        mode,
        urgencyScore,
        true,
        this.remainingCharges,
        0,
        this.lastKnownSeasonBudgetMs,
      );

      // Audit
      this.auditLedger.append(
        'EXPIRED',
        windowId,
        this.remainingCharges,
        urgencyScore,
        tier,
        phase,
        nowMs,
        null,
        false,
      );

      this.activeHold = null;
    }
  }

  private appendDLHistoryRow(
    timestampMs: number,
    actionCode: 0 | 1 | 2 | 3,
    tier: PressureTier,
    phase: RunPhase,
    mode: ModeCode,
    urgencyScore: number,
    wasAccepted: boolean,
    chargesAfter: number,
    budgetElapsedNorm: number,
    seasonBudgetMs: number,
  ): void {
    const row: HoldDLHistoryRow = Object.freeze({
      timestampMs,
      actionCode,
      tier,
      phase,
      mode,
      urgencyScore,
      wasAccepted,
      chargesAfter,
      budgetElapsedNorm,
      seasonBudgetMs,
    });

    this.dlHistory.push(row);
    if (this.dlHistory.length > HOLD_DL_HISTORY_DEPTH) {
      this.dlHistory = this.dlHistory.slice(-HOLD_DL_HISTORY_DEPTH);
    }
  }

  private buildRejectedResult(
    code: Exclude<HoldSpendResult['code'], 'OK'>,
    urgencyScore: number,
  ): HoldSpendResult {
    return Object.freeze({
      accepted: false,
      code,
      remainingCharges: this.remainingCharges,
      activeWindowId: this.activeHold?.windowId ?? null,
      frozenUntilMs: this.activeHold?.endsAtMs ?? null,
      label: TIME_CONTRACT_HOLD_RESULT_LABELS[code],
      urgencyAtSpend: urgencyScore,
    });
  }

  private buildWindowAlreadyFrozenResult(urgencyScore: number): HoldSpendResult {
    return Object.freeze({
      accepted: false,
      code: 'WINDOW_ALREADY_FROZEN',
      remainingCharges: this.remainingCharges,
      activeWindowId: this.activeHold?.windowId ?? null,
      frozenUntilMs: this.activeHold?.endsAtMs ?? null,
      label: TIME_CONTRACT_HOLD_RESULT_LABELS['WINDOW_ALREADY_FROZEN'],
      urgencyAtSpend: urgencyScore,
    });
  }
}

/* ============================================================================
 * § 26 — FACTORY FUNCTIONS
 * ============================================================================ */

/**
 * Create a fresh HoldActionLedger with default settings.
 * Use this for new run initialization in Empire mode.
 */
export function createHoldActionLedger(): HoldActionLedger {
  const ledger = new HoldActionLedger();
  ledger.reset(HOLD_FREE_CHARGES_PER_RUN, true);
  return ledger;
}

/**
 * Create a HoldActionLedger pre-configured for a disabled mode.
 * Use this for non-Empire modes where holds are not available.
 */
export function createDisabledHoldActionLedger(): HoldActionLedger {
  const ledger = new HoldActionLedger();
  ledger.reset(0, false);
  return ledger;
}

/**
 * Create a HoldActionLedger and immediately rehydrate from snapshot.
 * Use this for hot-reload and replay reconstruction paths.
 */
export function createAndRehydrateHoldActionLedger(
  snapshot: RunStateSnapshot,
  holdEndsAtMsByWindowId: Readonly<Record<string, number>> = {},
): HoldActionLedger {
  const ledger = new HoldActionLedger();
  ledger.rehydrateFromSnapshot(snapshot, holdEndsAtMsByWindowId);
  return ledger;
}

/* ============================================================================
 * § 27 — PURE HELPER EXPORTS
 * ============================================================================ */

/**
 * Pure function: compute hold urgency score from minimal inputs.
 * Stateless. Safe for use in any scoring context without a ledger instance.
 */
export function computeHoldUrgencyScore(
  tier: PressureTier,
  phase: RunPhase,
  mode: ModeCode,
  budgetElapsedNorm: number,
): number {
  const scorer = new HoldUrgencyScorer();
  return scorer.scoreLightweight(tier, phase, mode, budgetElapsedNorm);
}

/**
 * Pure function: compute hold value density from a spend event.
 * Useful for post-run analytics and ML training label generation.
 */
export function computeHoldValueDensityFromSpend(
  urgencyAtSpend: number,
  holdDurationMs: number,
  tier: PressureTier,
): number {
  const scorer = new HoldUrgencyScorer();
  return scorer.computeHoldValueDensity(urgencyAtSpend, holdDurationMs, tier);
}

/**
 * Pure function: compute window freeze efficiency.
 * Indicates how valuable a hold was relative to the pressure and mode.
 */
export function computeWindowFreezeEfficiency(
  urgencyAtSpend: number,
  tier: PressureTier,
  mode: ModeCode,
): number {
  const scorer = new HoldUrgencyScorer();
  return scorer.computeWindowFreezeEfficiency(urgencyAtSpend, tier, mode);
}

/**
 * Pure function: determine whether a hold should be recommended based on
 * urgency score, remaining budget, and current phase.
 */
export function shouldRecommendHoldUse(
  urgencyScore: number,
  remainingCharges: number,
  budgetRemainingNorm: number,
  phase: RunPhase,
): boolean {
  if (remainingCharges <= 0) return false;
  // Recommend if urgency is high (T3/T4) and budget is still meaningful
  if (urgencyScore >= 0.7 && budgetRemainingNorm >= 0.15) return true;
  // Recommend in endgame if any charge remains
  if (isEndgamePhase(phase) && remainingCharges > 0) return true;
  return false;
}

/**
 * Pure function: produce a hold UX label for companion display.
 * Used by the frontend and chat companion commentary.
 */
export function buildHoldUXLabel(
  remainingCharges: number,
  isActive: boolean,
  enabled: boolean,
  tier: PressureTier,
): string {
  if (!enabled) return HOLD_ENTITLEMENT_LABELS.DISABLED;
  if (isActive) return HOLD_ENTITLEMENT_LABELS.ALREADY_ACTIVE;
  if (remainingCharges <= 0) return HOLD_ENTITLEMENT_LABELS.NO_CHARGES;
  const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
  return `Hold available (${DEFAULT_HOLD_DURATION_MS / 1_000}s) — ${tierLabel}`;
}

/**
 * Pure function: narrate the hold state for companion output.
 * Returns a single-sentence companion phrase about the current hold situation.
 */
export function narrateHoldState(
  remainingCharges: number,
  isActive: boolean,
  activeHoldEndsAtMs: number | null,
  nowMs: number,
  tier: PressureTier,
): string {
  if (isActive && activeHoldEndsAtMs !== null) {
    const remainingMs = Math.max(0, activeHoldEndsAtMs - nowMs);
    const remainingSec = Math.ceil(remainingMs / 1_000);
    return `Hold active — ${remainingSec}s remaining on your freeze window.`;
  }
  if (remainingCharges <= 0) {
    return `Hold exhausted. No charges remain. ${describePressureTierExperience(tier)}`;
  }
  return `${remainingCharges} hold charge${remainingCharges !== 1 ? 's' : ''} available. ${PRESSURE_TIER_URGENCY_LABEL[tier]}.`;
}

/**
 * Pure function: compute CORD bonus eligibility from a HoldLedgerSnapshot.
 * Returns the fractional CORD bonus that would apply if the run ends now.
 */
export function computeCordBonusEligibility(
  snapshot: HoldLedgerSnapshot,
): number {
  if (snapshot.consumedThisRun === 0) {
    return HOLD_CORD_NO_HOLD_BONUS;
  }
  return 0;
}

/**
 * Pure function: check if the hold system is operating correctly.
 * Returns a list of validation error strings (empty = valid).
 */
export function validateHoldLedgerSnapshot(
  snapshot: HoldLedgerSnapshot,
): readonly string[] {
  const errors: string[] = [];

  if (!Number.isInteger(snapshot.remainingCharges)) {
    errors.push('remainingCharges must be an integer');
  }
  if (snapshot.remainingCharges < 0) {
    errors.push('remainingCharges must be >= 0');
  }
  if (snapshot.remainingCharges > HOLD_MAX_CHARGES_PER_RUN) {
    errors.push(`remainingCharges must be <= ${HOLD_MAX_CHARGES_PER_RUN}`);
  }
  if (!Number.isInteger(snapshot.consumedThisRun)) {
    errors.push('consumedThisRun must be an integer');
  }
  if (snapshot.consumedThisRun < 0) {
    errors.push('consumedThisRun must be >= 0');
  }
  if (snapshot.activeHold !== null) {
    const ah = snapshot.activeHold;
    if (ah.endsAtMs <= ah.startedAtMs) {
      errors.push('activeHold.endsAtMs must be > startedAtMs');
    }
    if (ah.durationMs <= 0) {
      errors.push('activeHold.durationMs must be > 0');
    }
    if (!snapshot.frozenWindowIds.includes(ah.windowId)) {
      errors.push('activeHold.windowId must appear in frozenWindowIds');
    }
  }

  return Object.freeze(errors);
}

/**
 * Pure function: compute the hold efficiency score for a completed hold.
 * High efficiency = hold used at the right moment (T3/T4, endgame, near budget limit).
 */
export function scoreCompletedHoldEfficiency(
  urgencyAtSpend: number,
  holdDurationMs: number,
  tier: PressureTier,
  wasNearPhaseBoundary: boolean,
): number {
  const scorer = new HoldUrgencyScorer();
  const base = scorer.computeHoldValueDensity(urgencyAtSpend, holdDurationMs, tier);
  const boundaryBonus = wasNearPhaseBoundary ? 1.2 : 1.0;
  return clamp01(base * boundaryBonus) as number;
}

/**
 * Pure function: build a lightweight chat signal payload string for hold events.
 * Used when full ChatInputEnvelope construction is not needed (e.g., debug logs).
 */
export function buildHoldChatSummaryString(
  result: HoldSpendResult,
  tier: PressureTier,
  phase: RunPhase,
): string {
  const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
  const urgency = clamp100(result.urgencyAtSpend * 100) as number;
  if (result.accepted) {
    return `[HOLD ACTIVATED] ${phase} / ${tierLabel} / urgency:${urgency}% / charges_left:${result.remainingCharges}`;
  }
  const label = TIME_CONTRACT_HOLD_RESULT_LABELS[result.code];
  return `[HOLD BLOCKED: ${label}] ${phase} / ${tierLabel}`;
}

/**
 * Pure function: determine the optimal hold channel for chat routing.
 * Endgame holds route to GLOBAL; early holds route to LOBBY.
 */
export function resolveHoldChatChannel(
  phase: RunPhase,
  tier: PressureTier,
): ChatVisibleChannel {
  if (isEndgamePhase(phase)) return 'GLOBAL';
  if (tier === 'T4') return 'GLOBAL';
  if (tier === 'T3') return 'DEAL_ROOM';
  return HOLD_CHAT_CHANNEL;
}

/**
 * Pure function: compute the tier duration at which hold was spent.
 * Used in DL tensor feature construction for temporal context.
 */
export function getHoldTierDurationMs(tier: PressureTier): number {
  return TIER_DURATIONS_MS[tier];
}

/**
 * Pure function: get the TickTier for a PressureTier.
 * Used in hold urgency cost computation.
 */
export function getHoldTickTier(tier: PressureTier): TickTier {
  return TICK_TIER_BY_PRESSURE_TIER[tier];
}

/* ============================================================================
 * § 28 — MANIFEST
 * ============================================================================ */

/** Canonical manifest for the HoldActionLedger module. */
export const HOLD_ACTION_LEDGER_MANIFEST = Object.freeze({
  domain: 'HOLD_ACTION_LEDGER',
  version: HOLD_LEDGER_VERSION,
  mlFeatureCount: HOLD_ML_FEATURE_COUNT,
  dlRowCount: HOLD_DL_ROW_COUNT,
  dlColCount: HOLD_DL_COL_COUNT,
  maxChargesPerRun: HOLD_MAX_CHARGES_PER_RUN,
  freeChargesPerRun: HOLD_FREE_CHARGES_PER_RUN,
  momentumUnlockThreshold: HOLD_MOMENTUM_UNLOCK_THRESHOLD,
  cordNoBonusScore: HOLD_CORD_NO_HOLD_BONUS,
  defaultHoldDurationMs: DEFAULT_HOLD_DURATION_MS,
  maxHoldDurationMs: HOLD_MAX_DURATION_MS,
  chatLane: 'LIVEOPS_SIGNAL',
  chatChannel: HOLD_CHAT_CHANNEL,
  contractsVersionNamespace: TIME_CONTRACTS_VERSION.namespace,
  featureFlags: Object.freeze({
    mlEnabled: true,
    dlEnabled: true,
    chatEnabled: true,
    cordTracking: true,
    momentumUnlock: true,
    phaseBoundaryTracking: true,
    auditLedger: true,
  }),
} as const);
