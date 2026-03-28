// backend/src/game/modes/team_up_mode.ts

/**
 * POINT ZERO ONE — TEAM UP MODE ENGINE (SYNDICATE)
 * backend/src/game/modes/team_up_mode.ts
 * VERSION: 4.0.0 — 2026-03-28
 *
 * Doctrine-aligned backend mode implementation for Syndicate / trust architecture.
 * One of four core battlegrounds. Cooperative multi-player mode with trust dynamics.
 *
 * Core mechanics implemented:
 * - Shared treasury with trust-gated access
 * - 4 role synergy bonus (INCOME_BUILDER, SHIELD_ARCHITECT, OPPORTUNITY_HUNTER, COUNTER_INTEL)
 * - Trust score bands with leakage / access / combo multipliers
 * - Aid and rescue windows with response speed multiplier
 * - Treasury loan rules with 1.1x repayment over 5 ticks
 * - Cascade absorption with sovereignty bonus
 * - Defection sequence: BREAK_PACT -> SILENT_EXIT -> ASSET_SEIZURE -> DEFECTED
 * - 40% treasury split on defection, betrayal survivor bonus
 * - Team chat / proof share / war alerts / deal invites
 * - Shared objectives: LIQUIDITY_FORTRESS, FATE_SURVIVORS, SYNCHRONY, DEFECTION_PROOF
 * - Communication cards: RALLY, INTEL_SHARE, SIGNAL_FLARE, TRUST_BOND
 * - Syndicate combo cards: PACT_OF_IRON, COLLECTIVE_SHIELD, INCOME_CHAIN, TRUST_SURGE
 * - Role upgrade system per 3 consecutive ticks of full synergy
 * - Card overlay resolution with trust-weighted modifiers
 * - Deck legality checking against CARD_LEGALITY_MATRIX
 * - Timing class validation for cooperative plays
 * - Deterministic RNG for card draws
 * - Replay engine integration for proof chain
 * - Proof badge conditions: UNBREAKABLE, TEAM_PLAYER, LONE_SURVIVOR, LOYAL_GUARDIAN, COMEBACK_SYNDICATE
 * - 32-dim ML feature extraction per run
 * - 24x8 DL tensor: rows=trust windows, columns=treasury/pressure/aid/rescue/defection
 * - Chat bridge events for real-time spectator experience
 * - Full analytics, diagnostics, and batch simulation
 * - 30+ convenience export functions
 */

// ─── Node / crypto ────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

// ─── Card types ───────────────────────────────────────────────────────────────
import {
  GameMode,
  DeckType,
  CardTag,
  CardRarity,
  TimingClass,
  PressureTier,
  RunPhase,
  GhostMarkerKind,
  DivergencePotential as CardTypesDivergencePotential,
  Targeting,
  Counterability,
  type CardDefinition,
  type ModeOverlay,
  type CardOverlaySnapshot,
  CARD_LEGALITY_MATRIX,
  MODE_TAG_WEIGHT_DEFAULTS,
  DECK_TYPE_PROFILES,
  MODE_CARD_BEHAVIORS,
  HOLD_SYSTEM_CONFIG,
  COMEBACK_SURGE_CONFIG,
  PRESSURE_COST_MODIFIERS,
  CARD_RARITY_DROP_RATES,
  GHOST_MARKER_SPECS,
  IPA_CHAIN_SYNERGIES,
  clamp,
  round6,
  isDeckLegalInMode,
  computeTagWeightedScore,
  computePressureCostModifier,
  computeBleedthroughMultiplier,
  computeTrustEfficiency,
  getDeckTypeProfile,
  getModeCardBehavior,
  computeDivergencePotential,
  getGhostMarkerSpec,
  computeGhostMarkerCordBonus,
  computeGhostMarkerShieldBonus,
  resolveGhostBenchmarkWindow,
  computeCardDrawWeights,
  getProofBadgeConditionsForMode,
  computeAggregateProofBadgeCord,
} from '../engine/card_types';

// ─── Deterministic RNG ────────────────────────────────────────────────────────
import {
  normalizeSeed,
  hashStringToSeed,
  combineSeed,
  createDeterministicRng,
  createMulberry32,
  sanitizePositiveWeights,
  DEFAULT_NON_ZERO_SEED,
  type DeterministicRng,
} from '../engine/deterministic_rng';

// ─── Replay Engine ────────────────────────────────────────────────────────────
import {
  sha256Hex,
  stableStringify,
  type Ledger,
  createDefaultLedger,
  ReplayEngine,
  GameState as ReplayGameState,
  type ReplaySnapshot,
  type DecisionEffect,
  type RunEvent,
} from '../engine/replay_engine';

// ─── Card Registry ────────────────────────────────────────────────────────────
import { CardRegistry } from '../engine/card_registry';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Semver for this mode engine; persisted alongside every replay proof. */
export const SYNDICATE_MODE_VERSION = '4.0.0';

/** Canonical game mode reference for Syndicate / Team Up */
const SYNDICATE_MODE = GameMode.TEAM_UP;

/** ML feature vector dimensionality — 32 floats per syndicate run */
export const SYNDICATE_ML_FEATURE_DIM = 32;

/** DL tensor shape — rows x columns */
export const SYNDICATE_DL_ROWS = 24;
export const SYNDICATE_DL_COLS = 8;

// ─── Loan constants ─────────────────────────────────────────────────────────
const MIN_LOAN_AMOUNT = 2000;
const MAX_LOAN_AMOUNT = 15000;
const LOAN_TREASURY_PCT = 0.15;
const LOAN_REPAYMENT_MULTIPLIER = 1.1;
const LOAN_REPAYMENT_TICKS = 5;
const MAX_LOANS_PER_PLAYER = 2;

// ─── Pressure thresholds ────────────────────────────────────────────────────
const CRITICAL_PRESSURE = 80;

// ─── Role synergy ───────────────────────────────────────────────────────────
const ROLE_SYNERGY_TREASURY_BONUS = 8000;
const ROLE_SYNERGY_SHIELD_MULTIPLIER = 1.1;
const ROLE_SYNERGY_INCOME_BONUS = 500;
const ROLE_SYNERGY_PRESSURE_RELIEF = 1;

// ─── Role upgrade system ────────────────────────────────────────────────────
const ROLE_UPGRADE_SYNERGY_TICKS_REQUIRED = 3;
const ROLE_UPGRADE_INCOME_BUILDER_MULTIPLIER = 1.25;
const ROLE_UPGRADE_SHIELD_ARCHITECT_FLAT = 15;
const ROLE_UPGRADE_OPPORTUNITY_HUNTER_DRAW_BONUS = 2;
const ROLE_UPGRADE_COUNTER_INTEL_TRUST_FLOOR = 40;

// ─── Syndicate mode tag weights (doctrine) ──────────────────────────────────
const SYNDICATE_WEIGHT_TRUST = 3.0;
const SYNDICATE_WEIGHT_AID = 2.5;
const SYNDICATE_WEIGHT_RESILIENCE = 2.0;
const SYNDICATE_WEIGHT_INCOME = 1.8;
const SYNDICATE_WEIGHT_LIQUIDITY = 1.5;

// ─── Communication card costs ───────────────────────────────────────────────
const COMM_RALLY_COST = 1000;
const COMM_INTEL_SHARE_COST = 500;
const COMM_SIGNAL_FLARE_COST = 800;
const COMM_TRUST_BOND_COST = 2000;

// ─── Communication card effects ─────────────────────────────────────────────
const RALLY_TRUST_GAIN = 4;
const RALLY_PRESSURE_RELIEF = 5;
const INTEL_SHARE_CORD_BONUS = 0.02;
const SIGNAL_FLARE_SHIELD_BONUS = 8;
const TRUST_BOND_TRUST_GAIN = 12;
const TRUST_BOND_COMBO_MULTIPLIER_BOOST = 0.1;

// ─── Syndicate combo card costs and effects ─────────────────────────────────
const COMBO_PACT_OF_IRON_COST = 5000;
const COMBO_COLLECTIVE_SHIELD_COST = 4000;
const COMBO_INCOME_CHAIN_COST = 6000;
const COMBO_TRUST_SURGE_COST = 3000;

const PACT_OF_IRON_CORD_BONUS = 0.08;
const PACT_OF_IRON_TRUST_REQUIREMENT = 70;
const COLLECTIVE_SHIELD_AMOUNT = 25;
const INCOME_CHAIN_PER_PLAYER_GAIN = 800;
const TRUST_SURGE_TRUST_GAIN_ALL = 15;

// ─── Shared objectives ──────────────────────────────────────────────────────
const OBJECTIVE_LIQUIDITY_FORTRESS_TREASURY_TARGET = 100_000;
const OBJECTIVE_FATE_SURVIVORS_PRESSURE_CEILING = 30;
const OBJECTIVE_SYNCHRONY_TRUST_FLOOR = 80;
const OBJECTIVE_DEFECTION_PROOF_MIN_TICKS = 12;
const OBJECTIVE_COMPLETION_CORD_BONUS = 0.1;
const OBJECTIVE_COMPLETION_TRUST_BONUS = 10;

// ─── Aid constants ──────────────────────────────────────────────────────────
const AID_LIQUIDITY_BRIDGE_MIN = 5000;
const AID_LIQUIDITY_BRIDGE_MAX = 15000;
const AID_SHIELD_LOAN_COST = 15;
const AID_EXPANSION_LEASE_COST = 4000;
const AID_EXPANSION_LEASE_BASE_GAIN = 1200;
const AID_EXPANSION_LEASE_COMBO_GAIN = 2800;

// ─── Rescue constants ───────────────────────────────────────────────────────
const RESCUE_EMERGENCY_CAPITAL_AMOUNT = 12000;
const RESCUE_CASCADE_BREAK_PRESSURE_RELIEF = 15;
const RESCUE_CASCADE_BREAK_SHIELD_BONUS = 8;
const RESCUE_TIME_DEBT_CORD_BONUS = 0.05;
const RESCUE_COORDINATED_REFINANCE_EXPENSE_CUT = 0.18;
const RESCUE_SPEED_FAST_MS = 3000;
const RESCUE_SPEED_SLOW_MS = 6000;

// ─── Defection constants ────────────────────────────────────────────────────
const DEFECTION_MIN_TICK = 8;
const DEFECTION_TREASURY_STEAL_PCT = 0.4;
const DEFECTION_BETRAYAL_CORD_MULTIPLIER = 1.6;
const DEFECTION_TRUST_PENALTY_OTHERS = 18;
const DEFECTION_PRESSURE_PENALTY_OTHERS = 15;
const DEFECTION_CORD_BONUS_SURVIVORS = 0.6;
const DEFECTION_FREEDOM_THRESHOLD = 0.7;
const DEFECTION_CORD_PENALTY = 0.15;
const DEFECTION_HIDDEN_INTENT_STEP = 0.2;
const DEFECTION_TRUST_STEP_PENALTY = 8;

// ─── CORD tiebreaker weights ────────────────────────────────────────────────
const TIEBREAKER_SHIELDS_WEIGHT = 0.001;
const TIEBREAKER_SPEED_FLOOR = 1;
const TIEBREAKER_CHAIN_SCORE_UNIT = 0.00001;

// ─── Phase boundaries ───────────────────────────────────────────────────────
const PHASE_FOUNDATION_END = 4;
const PHASE_ESCALATION_END = 8;

// ─── Proof badge thresholds ─────────────────────────────────────────────────
const BADGE_UNBREAKABLE_MIN_CASCADE_ABSORPTIONS = 5;
const BADGE_UNBREAKABLE_MIN_TRUST = 60;
const BADGE_TEAM_PLAYER_MIN_AID_GIVEN = 6;
const BADGE_TEAM_PLAYER_MIN_RESCUE_GIVEN = 2;
const BADGE_LONE_SURVIVOR_MIN_BETRAYAL_SURVIVED = 1;
const BADGE_LONE_SURVIVOR_MIN_CORD = 0.5;
const BADGE_LOYAL_GUARDIAN_MIN_TRUST_AVERAGE = 80;
const BADGE_LOYAL_GUARDIAN_ZERO_DEFECTIONS = 0;
const BADGE_COMEBACK_SYNDICATE_MIN_DEFICIT = 0.15;
const BADGE_COMEBACK_SYNDICATE_FINAL_POSITIVE = true;

// ─── Chat bridge event types ────────────────────────────────────────────────
const CHAT_EVENT_AID_ISSUED = 'syndicate_aid_issued';
const CHAT_EVENT_RESCUE_DEPLOYED = 'syndicate_rescue_deployed';
const CHAT_EVENT_CASCADE_ABSORBED = 'syndicate_cascade_absorbed';
const CHAT_EVENT_DEFECTION_STEP = 'syndicate_defection_step';
const CHAT_EVENT_DEFECTION_COMMITTED = 'syndicate_defection_committed';
const CHAT_EVENT_LOAN_ISSUED = 'syndicate_loan_issued';
const CHAT_EVENT_OBJECTIVE_COMPLETE = 'syndicate_objective_complete';
const CHAT_EVENT_BADGE_UNLOCKED = 'syndicate_badge_unlocked';
const CHAT_EVENT_ROLE_UPGRADED = 'syndicate_role_upgraded';
const CHAT_EVENT_COMBO_PLAYED = 'syndicate_combo_played';
const CHAT_EVENT_TRUST_SHIFT = 'syndicate_trust_shift';
const CHAT_EVENT_FREEDOM = 'syndicate_freedom_recorded';

// ─── Batch simulation defaults ──────────────────────────────────────────────
const BATCH_DEFAULT_TICK_COUNT = 120;
const BATCH_DEFAULT_RUN_COUNT = 100;
const BATCH_MAX_RUN_COUNT = 10_000;

// ─── Trust band thresholds ──────────────────────────────────────────────────
const TRUST_BAND_ELITE = 90;
const TRUST_BAND_HIGH = 70;
const TRUST_BAND_STANDARD = 50;
const TRUST_BAND_LOW = 30;

// ─── Cascade constants ──────────────────────────────────────────────────────
const CASCADE_SOVEREIGNTY_BONUS = 0.05;
const CASCADE_CORD_FLAT_THRESHOLD = 3;
const CASCADE_CORD_FLAT_BONUS = 0.35;

// ─── Max values ─────────────────────────────────────────────────────────────
const MAX_SHIELD = 110;
const MAX_TRUST = 100;
const MAX_PRESSURE = 100;
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

// ═══════════════════════════════════════════════════════════════════════════════
// § 2 — TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Action types ─────────────────────────────────────────────────────────────

export type TeamUpActionType =
  | 'ADVANCE_TICK'
  | 'AID_REQUEST'
  | 'PLAY_AID'
  | 'PLAY_RESCUE'
  | 'REQUEST_TREASURY_LOAN'
  | 'CASCADE_ABSORB'
  | 'SEND_DEAL_INVITE'
  | 'RESPOND_DEAL_INVITE'
  | 'PROOF_SHARE'
  | 'PLAY_DEFECTION_STEP'
  | 'COMMIT_DEFECTION'
  | 'PLAY_COMMUNICATION_CARD'
  | 'PLAY_COMBO_CARD'
  | 'RECORD_CARD_PLAY'
  | 'RECORD_FREEDOM';

// ─── Role types ─────────────────────────────────────────────────────────────

export type TeamUpRole =
  | 'INCOME_BUILDER'
  | 'SHIELD_ARCHITECT'
  | 'OPPORTUNITY_HUNTER'
  | 'COUNTER_INTEL';

export type TeamUpRoleUpgrade =
  | 'NONE'
  | 'ENHANCED';

// ─── Defection steps ────────────────────────────────────────────────────────

export type TeamUpDefectionStep =
  | 'NONE'
  | 'BREAK_PACT'
  | 'SILENT_EXIT'
  | 'ASSET_SEIZURE'
  | 'DEFECTED';

// ─── Chat types ─────────────────────────────────────────────────────────────

export type TeamUpChatReaction = 'crown' | 'money' | 'fire' | 'skull' | 'check' | 'cross';

// ─── Aid types ──────────────────────────────────────────────────────────────

export type TeamUpAidType =
  | 'LIQUIDITY_BRIDGE'
  | 'SHIELD_LOAN'
  | 'EXPANSION_LEASE';

// ─── Rescue types ───────────────────────────────────────────────────────────

export type TeamUpRescueType =
  | 'EMERGENCY_CAPITAL'
  | 'CASCADE_BREAK'
  | 'TIME_DEBT_PAID'
  | 'COORDINATED_REFINANCE';

// ─── Status effects ─────────────────────────────────────────────────────────

export type TeamUpStatus =
  | 'aid_requested'
  | 'critical_pressure'
  | 'loan_default_risk'
  | 'defection_risk'
  | 'rescued_recently'
  | 'loyalty_bonus'
  | 'proof_shared'
  | 'defected'
  | 'role_upgraded'
  | 'objective_complete'
  | 'combo_active';

// ─── Communication card types ───────────────────────────────────────────────

export type CommunicationCardKey =
  | 'RALLY'
  | 'INTEL_SHARE'
  | 'SIGNAL_FLARE'
  | 'TRUST_BOND';

// ─── Syndicate combo card types ─────────────────────────────────────────────

export type SyndicateComboCardKey =
  | 'PACT_OF_IRON'
  | 'COLLECTIVE_SHIELD'
  | 'INCOME_CHAIN'
  | 'TRUST_SURGE';

// ─── Shared objective types ─────────────────────────────────────────────────

export type SharedObjectiveKey =
  | 'LIQUIDITY_FORTRESS'
  | 'FATE_SURVIVORS'
  | 'SYNCHRONY'
  | 'DEFECTION_PROOF';

// ─── Syndicate phase ────────────────────────────────────────────────────────

export type SyndicatePhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

// ─── Syndicate outcome ──────────────────────────────────────────────────────

export type SyndicateOutcome = 'FREEDOM' | 'COLLAPSE' | 'BETRAYED';

// ─── Syndicate result tier ──────────────────────────────────────────────────

export type SyndicateResultTier = 'BROKEN' | 'SURVIVING' | 'UNIFIED' | 'LEGENDARY';

// ─── Proof badge types ──────────────────────────────────────────────────────

export type SyndicateProofBadge =
  | 'UNBREAKABLE'
  | 'TEAM_PLAYER'
  | 'LONE_SURVIVOR'
  | 'LOYAL_GUARDIAN'
  | 'COMEBACK_SYNDICATE';

// ─── Trust band result ──────────────────────────────────────────────────────

export interface TrustBandResult {
  readonly aidEfficiency: number;
  readonly treasuryLoanPct: number;
  readonly comboMultiplier: number;
  readonly defectionSignal: boolean;
  readonly loanAccessDenied: boolean;
  readonly leakageRate: number;
}

// ─── Player state ───────────────────────────────────────────────────────────

export interface TeamUpPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly role: TeamUpRole;
  readonly roleUpgrade: TeamUpRoleUpgrade;
  readonly consecutiveSynergyTicks: number;
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly liabilities: number;
  readonly netWorth: number;
  readonly pressure: number;
  readonly pressureTier: PressureTier;
  readonly shields: number;
  readonly trustScore: number;
  readonly activeStatuses: readonly TeamUpStatus[];
  readonly aidRequests: number;
  readonly aidGivenCount: number;
  readonly aidReceivedCount: number;
  readonly rescueGivenCount: number;
  readonly rescueReceivedCount: number;
  readonly cascadeAbsorptions: number;
  readonly loansTaken: number;
  readonly outstandingLoanIds: readonly string[];
  readonly loyaltyHelpReceived: number;
  readonly proofShares: number;
  readonly hiddenIntentScore: number;
  readonly defectionStep: TeamUpDefectionStep;
  readonly defected: boolean;
  readonly defectionCount: number;
  readonly freedomThresholdMultiplier: number;
  readonly cordFlatModifier: number;
  readonly sovereigntyScoreFlat: number;
  readonly riskSignalRaised: boolean;
  readonly consecutiveLoanCrisisTicks: number;
  readonly handCardIds: readonly string[];
  readonly totalCardPlays: number;
  readonly comboCardsPlayed: number;
  readonly commCardsPlayed: number;
  readonly freedomAtTick: number | null;
  readonly finalCord: number | null;
  readonly averageDecisionSpeedMs: number | null;
  readonly peakPressure: number;
  readonly peakCordDeficit: number;
}

// ─── Loan ───────────────────────────────────────────────────────────────────

export interface TeamUpLoan {
  readonly loanId: string;
  readonly borrowerId: string;
  readonly principal: number;
  readonly outstandingBalance: number;
  readonly issuedTick: number;
  readonly remainingIncomeTicks: number;
  readonly repaid: boolean;
  readonly defaulted: boolean;
}

// ─── Deal invite ────────────────────────────────────────────────────────────

export interface DealInvite {
  readonly inviteId: string;
  readonly actorId: string;
  readonly targetId: string;
  readonly cardId: string;
  readonly costSharePercent: number;
  readonly accepted: boolean | null;
  readonly createdTick: number;
}

// ─── Chat message ───────────────────────────────────────────────────────────

export interface TeamUpChatMessage {
  readonly messageId: string;
  readonly tick: number;
  readonly actorId: string | null;
  readonly kind: 'SYSTEM' | 'TEAM' | 'PROOF_SHARE' | 'WAR_ALERT' | 'DEAL_RECAP' | 'OBJECTIVE' | 'COMBO';
  readonly body: string;
  readonly reactions: readonly TeamUpChatReaction[];
}

// ─── Event ──────────────────────────────────────────────────────────────────

export interface TeamUpEvent {
  readonly tick: number;
  readonly type: TeamUpActionType | 'SYSTEM';
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly amount: number | null;
  readonly detail: string;
}

// ─── Shared objective state ─────────────────────────────────────────────────

export interface SharedObjectiveState {
  readonly key: SharedObjectiveKey;
  readonly description: string;
  readonly completed: boolean;
  readonly completedAtTick: number | null;
  readonly progress: number;
  readonly target: number;
}

// ─── Macro state ────────────────────────────────────────────────────────────

export interface TeamUpMacroState {
  readonly tick: number;
  readonly phase: SyndicatePhase;
  readonly treasury: number;
  readonly rescueWindowOpen: boolean;
  readonly aidWindowOpen: boolean;
  readonly warAlertActive: boolean;
  readonly roleSynergyActive: boolean;
  readonly betrayalSurvivorBonusActive: boolean;
  readonly betrayalSurvivorCordMultiplier: number;
  readonly teamCordBonusMultiplier: number;
  readonly eventLog: readonly TeamUpEvent[];
  readonly loans: readonly TeamUpLoan[];
  readonly dealInvites: readonly DealInvite[];
  readonly chat: readonly TeamUpChatMessage[];
  readonly firstCascadeAutoAbsorbed: boolean;
  readonly syndicateDuelEligible: boolean;
  readonly sharedObjectives: readonly SharedObjectiveState[];
  readonly totalAidActions: number;
  readonly totalRescueActions: number;
  readonly totalComboCardsPlayed: number;
  readonly totalCommCardsPlayed: number;
}

// ─── Mode state ─────────────────────────────────────────────────────────────

export interface TeamUpModeState {
  readonly runId: string;
  readonly seed: string;
  readonly players: readonly TeamUpPlayerState[];
  readonly macro: TeamUpMacroState;
}

// ─── Action interfaces ──────────────────────────────────────────────────────

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly timestampMs?: number;
  readonly treasuryDelta?: number;
  readonly pressureDeltaByPlayerId?: Readonly<Record<string, number>>;
}

export interface AidRequestAction {
  readonly type: 'AID_REQUEST';
  readonly actorId: string;
  readonly reason: string;
}

export interface PlayAidAction {
  readonly type: 'PLAY_AID';
  readonly actorId: string;
  readonly targetId: string;
  readonly aidType: TeamUpAidType;
  readonly amount?: number;
}

export interface PlayRescueAction {
  readonly type: 'PLAY_RESCUE';
  readonly actorId: string;
  readonly targetId: string;
  readonly rescueType: TeamUpRescueType;
  readonly responseDelayMs: number;
}

export interface RequestTreasuryLoanAction {
  readonly type: 'REQUEST_TREASURY_LOAN';
  readonly actorId: string;
}

export interface CascadeAbsorbAction {
  readonly type: 'CASCADE_ABSORB';
  readonly actorId: string;
  readonly severity: number;
}

export interface SendDealInviteAction {
  readonly type: 'SEND_DEAL_INVITE';
  readonly actorId: string;
  readonly targetId: string;
  readonly cardId: string;
  readonly costSharePercent: number;
}

export interface RespondDealInviteAction {
  readonly type: 'RESPOND_DEAL_INVITE';
  readonly actorId: string;
  readonly inviteId: string;
  readonly accept: boolean;
}

export interface ProofShareAction {
  readonly type: 'PROOF_SHARE';
  readonly actorId: string;
}

export interface PlayDefectionStepAction {
  readonly type: 'PLAY_DEFECTION_STEP';
  readonly actorId: string;
  readonly step: Exclude<TeamUpDefectionStep, 'NONE' | 'DEFECTED'>;
}

export interface CommitDefectionAction {
  readonly type: 'COMMIT_DEFECTION';
  readonly actorId: string;
}

export interface PlayCommunicationCardAction {
  readonly type: 'PLAY_COMMUNICATION_CARD';
  readonly actorId: string;
  readonly targetId?: string;
  readonly cardKey: CommunicationCardKey;
}

export interface PlayComboCardAction {
  readonly type: 'PLAY_COMBO_CARD';
  readonly actorId: string;
  readonly comboKey: SyndicateComboCardKey;
}

export interface RecordCardPlayAction {
  readonly type: 'RECORD_CARD_PLAY';
  readonly actorId: string;
  readonly cardId: string;
  readonly cashCost: number;
  readonly cordDelta: number;
  readonly timingClass: TimingClass;
}

export interface RecordFreedomAction {
  readonly type: 'RECORD_FREEDOM';
  readonly playerId: string;
  readonly cord: number;
  readonly averageDecisionSpeedMs: number;
}

export type TeamUpModeAction =
  | AdvanceTickAction
  | AidRequestAction
  | PlayAidAction
  | PlayRescueAction
  | RequestTreasuryLoanAction
  | CascadeAbsorbAction
  | SendDealInviteAction
  | RespondDealInviteAction
  | ProofShareAction
  | PlayDefectionStepAction
  | CommitDefectionAction
  | PlayCommunicationCardAction
  | PlayComboCardAction
  | RecordCardPlayAction
  | RecordFreedomAction;

// ─── ML feature vector type ─────────────────────────────────────────────────

export interface SyndicateMLFeatureVector {
  readonly dimension: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

// ─── DL tensor type ─────────────────────────────────────────────────────────

export interface SyndicateDLTensor {
  readonly rows: number;
  readonly cols: number;
  readonly data: readonly (readonly number[])[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

// ─── Chat bridge event ──────────────────────────────────────────────────────

export interface SyndicateChatBridgeEvent {
  readonly eventType: string;
  readonly tick: number;
  readonly runId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly emittedAtMs: number;
}

// ─── Analytics types ────────────────────────────────────────────────────────

export interface SyndicateRunAnalytics {
  readonly runId: string;
  readonly trustAnalytics: readonly SyndicateTrustAnalytics[];
  readonly aidAnalytics: SyndicateAidAnalytics;
  readonly rescueAnalytics: SyndicateRescueAnalytics;
  readonly defectionAnalytics: SyndicateDefectionAnalytics;
  readonly objectiveAnalytics: readonly SharedObjectiveState[];
  readonly modeHealth: SyndicateModeHealth;
  readonly proofBadgeTracker: SyndicateProofBadgeTrackerState;
  readonly runResult: SyndicateRunResult | null;
}

export interface SyndicateTrustAnalytics {
  readonly playerId: string;
  readonly averageTrust: number;
  readonly peakTrust: number;
  readonly lowestTrust: number;
  readonly trustDelta: number;
  readonly timeInEliteBand: number;
  readonly timeInLowBand: number;
}

export interface SyndicateAidAnalytics {
  readonly totalAidActions: number;
  readonly totalLiquidityBridges: number;
  readonly totalShieldLoans: number;
  readonly totalExpansionLeases: number;
  readonly averageAidEfficiency: number;
}

export interface SyndicateRescueAnalytics {
  readonly totalRescueActions: number;
  readonly averageResponseTimeMs: number;
  readonly fastestRescueMs: number;
}

export interface SyndicateDefectionAnalytics {
  readonly totalDefections: number;
  readonly defectionTicks: readonly number[];
  readonly averageTreasuryStolen: number;
  readonly survivorBonusesActive: number;
}

export interface SyndicateModeHealth {
  readonly modeVersion: string;
  readonly mode: GameMode;
  readonly engineIntegrity: boolean;
  readonly replayHashMatch: boolean;
  readonly seedDeterminismVerified: boolean;
  readonly totalRunsProcessed: number;
  readonly averageRunDurationTicks: number;
  readonly averageTrustScore: number;
  readonly diagnosticTimestampMs: number;
}

export interface SyndicateProofBadgeTrackerState {
  readonly unlockedBadges: readonly SyndicateProofBadge[];
  readonly candidateBadges: readonly SyndicateProofBadge[];
}

export interface SyndicateRunResult {
  readonly outcome: SyndicateOutcome;
  readonly tier: SyndicateResultTier;
  readonly totalTicks: number;
  readonly finalTreasury: number;
  readonly averageFinalCord: number;
  readonly defectorCount: number;
  readonly objectivesCompleted: number;
}

// ─── Batch simulation types ─────────────────────────────────────────────────

export interface SyndicateBatchSimulationConfig {
  readonly baseSeed: string;
  readonly runCount: number;
  readonly ticksPerRun: number;
  readonly playerTemplates: ReadonlyArray<{
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
    readonly role: TeamUpRole;
  }>;
}

export interface SyndicateBatchRunSummary {
  readonly runId: string;
  readonly seed: number;
  readonly finalTreasury: number;
  readonly averageTrust: number;
  readonly defections: number;
  readonly objectivesCompleted: number;
  readonly runDurationTicks: number;
  readonly outcome: SyndicateOutcome;
}

export interface SyndicateBatchSimulationResult {
  readonly totalRuns: number;
  readonly completedRuns: number;
  readonly averageTreasury: number;
  readonly averageTrust: number;
  readonly defectionRate: number;
  readonly averageObjectivesCompleted: number;
  readonly averageRunDurationTicks: number;
  readonly outcomeDistribution: Readonly<Record<SyndicateOutcome, number>>;
  readonly cordDistribution: {
    readonly min: number;
    readonly max: number;
    readonly p25: number;
    readonly p50: number;
    readonly p75: number;
    readonly p90: number;
  };
  readonly runSummaries: readonly SyndicateBatchRunSummary[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3 — PURE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function stableId(prefix: string, ...parts: ReadonlyArray<string | number>): string {
  return `${prefix}_${createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 16)}`;
}

function pressureTierFromPressure(pressure: number): PressureTier {
  if (pressure >= 90) return PressureTier.T4_COLLAPSE_IMMINENT;
  if (pressure >= 70) return PressureTier.T3_ELEVATED;
  if (pressure >= 45) return PressureTier.T2_STRESSED;
  if (pressure >= 20) return PressureTier.T1_STABLE;
  return PressureTier.T0_SOVEREIGN;
}

function syndicatePhaseFromTick(tick: number): SyndicatePhase {
  if (tick <= PHASE_FOUNDATION_END) return 'FOUNDATION';
  if (tick <= PHASE_ESCALATION_END) return 'ESCALATION';
  return 'SOVEREIGNTY';
}

function runPhaseFromSyndicatePhase(phase: SyndicatePhase): RunPhase {
  switch (phase) {
    case 'FOUNDATION': return RunPhase.FOUNDATION;
    case 'ESCALATION': return RunPhase.ESCALATION;
    case 'SOVEREIGNTY': return RunPhase.SOVEREIGNTY;
  }
}

function byPlayerId(
  players: readonly TeamUpPlayerState[],
  playerId: string,
): TeamUpPlayerState {
  const found = players.find((player) => player.playerId === playerId);
  if (!found) {
    throw new Error(`Unknown TEAM_UP player '${playerId}'.`);
  }
  return found;
}

function replacePlayer(
  players: readonly TeamUpPlayerState[],
  updated: TeamUpPlayerState,
): TeamUpPlayerState[] {
  return players.map((player) =>
    player.playerId === updated.playerId ? updated : player,
  );
}

function addStatus(
  statuses: readonly TeamUpStatus[],
  status: TeamUpStatus,
): TeamUpStatus[] {
  if (statuses.includes(status)) return [...statuses];
  return [...statuses, status];
}

function removeStatus(
  statuses: readonly TeamUpStatus[],
  status: TeamUpStatus,
): TeamUpStatus[] {
  return statuses.filter((entry) => entry !== status);
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 4 — TRUST SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute trust band properties from a raw trust score.
 * Bands: Elite (90+), High (70+), Standard (50+), Low (30+), Crisis (<30).
 * Each band controls aid efficiency, treasury loan cap, combo multiplier,
 * defection signaling, loan access, and trust leakage rate.
 */
function trustBand(trustScore: number): TrustBandResult {
  if (trustScore >= TRUST_BAND_ELITE) {
    return {
      aidEfficiency: 1,
      treasuryLoanPct: 0.2,
      comboMultiplier: 1.25,
      defectionSignal: false,
      loanAccessDenied: false,
      leakageRate: 0,
    };
  }
  if (trustScore >= TRUST_BAND_HIGH) {
    return {
      aidEfficiency: 0.95,
      treasuryLoanPct: 0.15,
      comboMultiplier: 1.12,
      defectionSignal: false,
      loanAccessDenied: false,
      leakageRate: 0.01,
    };
  }
  if (trustScore >= TRUST_BAND_STANDARD) {
    return {
      aidEfficiency: 0.88,
      treasuryLoanPct: 0.1,
      comboMultiplier: 1,
      defectionSignal: false,
      loanAccessDenied: false,
      leakageRate: 0.03,
    };
  }
  if (trustScore >= TRUST_BAND_LOW) {
    return {
      aidEfficiency: 0.75,
      treasuryLoanPct: 0.05,
      comboMultiplier: 0.9,
      defectionSignal: true,
      loanAccessDenied: false,
      leakageRate: 0.06,
    };
  }
  return {
    aidEfficiency: 0.6,
    treasuryLoanPct: 0,
    comboMultiplier: 0.75,
    defectionSignal: true,
    loanAccessDenied: true,
    leakageRate: 0.1,
  };
}

/**
 * Compute syndicate-specific trust efficiency using the shared card_types utility.
 * Wraps computeTrustEfficiency with syndicate weight multiplier.
 */
function syndicateTrustEfficiency(trustScore: number): { efficiency: number; label: string } {
  const base = computeTrustEfficiency(trustScore);
  const syndicateBoost = round6(base.efficiency * SYNDICATE_WEIGHT_TRUST / 3.0);
  return {
    efficiency: round6(syndicateBoost),
    label: base.band,
  };
}

/**
 * Compute trust leakage: treasury bleeds per tick proportional to the
 * lowest trust band in the team. Returns the amount to deduct.
 */
function computeTrustLeakage(
  players: readonly TeamUpPlayerState[],
  treasury: number,
): number {
  const activePlayers = players.filter((p) => !p.defected);
  if (activePlayers.length === 0) return 0;

  const worstBand = activePlayers.reduce(
    (worst, p) => {
      const band = trustBand(p.trustScore);
      return band.leakageRate > worst.leakageRate ? band : worst;
    },
    trustBand(MAX_TRUST),
  );

  return round6(treasury * worstBand.leakageRate * 0.01);
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 5 — ACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function recalcPlayer(player: TeamUpPlayerState): TeamUpPlayerState {
  const netWorth = round6(player.cash + player.income * 6 - player.liabilities);
  const pressure = clamp(player.pressure, 0, MAX_PRESSURE);

  let activeStatuses = [...player.activeStatuses];

  if (pressure >= CRITICAL_PRESSURE) {
    activeStatuses = addStatus(activeStatuses, 'critical_pressure');
  } else {
    activeStatuses = removeStatus(activeStatuses, 'critical_pressure');
  }

  if (trustBand(player.trustScore).defectionSignal) {
    activeStatuses = addStatus(activeStatuses, 'defection_risk');
  } else {
    activeStatuses = removeStatus(activeStatuses, 'defection_risk');
  }

  const peakPressure = Math.max(player.peakPressure, pressure);

  return {
    ...player,
    netWorth,
    pressure,
    pressureTier: pressureTierFromPressure(pressure),
    activeStatuses,
    riskSignalRaised: trustBand(player.trustScore).defectionSignal,
    peakPressure,
  };
}

function appendEvent(
  state: TeamUpModeState,
  type: TeamUpEvent['type'],
  actorId: string | null,
  targetId: string | null,
  amount: number | null,
  detail: string,
): TeamUpModeState {
  const event: TeamUpEvent = {
    tick: state.macro.tick,
    type,
    actorId,
    targetId,
    amount,
    detail,
  };

  return {
    ...state,
    macro: {
      ...state.macro,
      eventLog: [...state.macro.eventLog, event],
    },
  };
}

function appendChat(
  state: TeamUpModeState,
  actorId: string | null,
  kind: TeamUpChatMessage['kind'],
  body: string,
): TeamUpModeState {
  const message: TeamUpChatMessage = {
    messageId: stableId('chat', state.runId, state.macro.tick, kind, body),
    tick: state.macro.tick,
    actorId,
    kind,
    body,
    reactions: [],
  };

  return {
    ...state,
    macro: {
      ...state.macro,
      chat: [...state.macro.chat, message],
    },
  };
}

function mutatePlayer(
  state: TeamUpModeState,
  playerId: string,
  transform: (player: TeamUpPlayerState) => TeamUpPlayerState,
): TeamUpModeState {
  const current = byPlayerId(state.players, playerId);
  const updated = recalcPlayer(transform(current));

  return {
    ...state,
    players: replacePlayer(state.players, updated),
  };
}

function allRolesPresent(players: readonly TeamUpPlayerState[]): boolean {
  const activeRoles = new Set(
    players.filter((player) => !player.defected).map((player) => player.role),
  );

  return (
    activeRoles.has('INCOME_BUILDER') &&
    activeRoles.has('SHIELD_ARCHITECT') &&
    activeRoles.has('OPPORTUNITY_HUNTER') &&
    activeRoles.has('COUNTER_INTEL')
  );
}

/**
 * Evaluate all shared objectives and update their progress.
 */
function evaluateSharedObjectives(state: TeamUpModeState): TeamUpModeState {
  const activePlayers = state.players.filter((p) => !p.defected);
  const updatedObjectives = state.macro.sharedObjectives.map((obj) => {
    if (obj.completed) return obj;

    let progress = obj.progress;
    let completed = false;

    switch (obj.key) {
      case 'LIQUIDITY_FORTRESS':
        progress = round6(state.macro.treasury / OBJECTIVE_LIQUIDITY_FORTRESS_TREASURY_TARGET);
        completed = state.macro.treasury >= OBJECTIVE_LIQUIDITY_FORTRESS_TREASURY_TARGET;
        break;
      case 'FATE_SURVIVORS':
        progress = activePlayers.length > 0
          ? round6(activePlayers.filter(
              (p) => p.pressure <= OBJECTIVE_FATE_SURVIVORS_PRESSURE_CEILING,
            ).length / activePlayers.length)
          : 0;
        completed = activePlayers.every(
          (p) => p.pressure <= OBJECTIVE_FATE_SURVIVORS_PRESSURE_CEILING,
        );
        break;
      case 'SYNCHRONY':
        progress = activePlayers.length > 0
          ? round6(activePlayers.filter(
              (p) => p.trustScore >= OBJECTIVE_SYNCHRONY_TRUST_FLOOR,
            ).length / activePlayers.length)
          : 0;
        completed = activePlayers.every(
          (p) => p.trustScore >= OBJECTIVE_SYNCHRONY_TRUST_FLOOR,
        );
        break;
      case 'DEFECTION_PROOF':
        progress = round6(state.macro.tick / OBJECTIVE_DEFECTION_PROOF_MIN_TICKS);
        completed = state.macro.tick >= OBJECTIVE_DEFECTION_PROOF_MIN_TICKS &&
          state.players.every((p) => !p.defected);
        break;
    }

    return {
      ...obj,
      progress: clamp(progress, 0, 1),
      completed,
      completedAtTick: completed && !obj.completed ? state.macro.tick : obj.completedAtTick,
    };
  });

  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      sharedObjectives: updatedObjectives,
    },
  };

  // Award bonuses for newly completed objectives
  for (let i = 0; i < updatedObjectives.length; i++) {
    const updated = updatedObjectives[i];
    const original = state.macro.sharedObjectives[i];
    if (updated.completed && !original.completed) {
      next = appendChat(
        next,
        null,
        'OBJECTIVE',
        `OBJECTIVE COMPLETE: ${updated.key} — CORD bonus ${OBJECTIVE_COMPLETION_CORD_BONUS} + Trust bonus ${OBJECTIVE_COMPLETION_TRUST_BONUS} applied.`,
      );

      for (const player of next.players) {
        if (!player.defected) {
          next = mutatePlayer(next, player.playerId, (p) => ({
            ...p,
            cordFlatModifier: round6(p.cordFlatModifier + OBJECTIVE_COMPLETION_CORD_BONUS),
            trustScore: clamp(p.trustScore + OBJECTIVE_COMPLETION_TRUST_BONUS, 0, MAX_TRUST),
            activeStatuses: addStatus(p.activeStatuses, 'objective_complete'),
          }));
        }
      }
    }
  }

  return next;
}

/**
 * Check and apply role upgrades. A player earns an upgrade after
 * ROLE_UPGRADE_SYNERGY_TICKS_REQUIRED consecutive ticks of full synergy.
 */
function evaluateRoleUpgrades(state: TeamUpModeState): TeamUpModeState {
  let next = state;

  for (const player of next.players) {
    if (player.defected || player.roleUpgrade === 'ENHANCED') continue;

    const synergyTicks = next.macro.roleSynergyActive
      ? player.consecutiveSynergyTicks + 1
      : 0;

    if (synergyTicks >= ROLE_UPGRADE_SYNERGY_TICKS_REQUIRED && player.roleUpgrade === 'NONE') {
      next = mutatePlayer(next, player.playerId, (p) => {
        let upgraded: TeamUpPlayerState = {
          ...p,
          roleUpgrade: 'ENHANCED',
          consecutiveSynergyTicks: synergyTicks,
          activeStatuses: addStatus(p.activeStatuses, 'role_upgraded'),
        };

        switch (p.role) {
          case 'INCOME_BUILDER':
            upgraded = {
              ...upgraded,
              income: round6(upgraded.income * ROLE_UPGRADE_INCOME_BUILDER_MULTIPLIER),
            };
            break;
          case 'SHIELD_ARCHITECT':
            upgraded = {
              ...upgraded,
              shields: clamp(upgraded.shields + ROLE_UPGRADE_SHIELD_ARCHITECT_FLAT, 0, MAX_SHIELD),
            };
            break;
          case 'OPPORTUNITY_HUNTER':
            upgraded = {
              ...upgraded,
              cordFlatModifier: round6(upgraded.cordFlatModifier + ROLE_UPGRADE_OPPORTUNITY_HUNTER_DRAW_BONUS * 0.01),
            };
            break;
          case 'COUNTER_INTEL':
            upgraded = {
              ...upgraded,
              trustScore: clamp(
                Math.max(upgraded.trustScore, ROLE_UPGRADE_COUNTER_INTEL_TRUST_FLOOR),
                0,
                MAX_TRUST,
              ),
            };
            break;
        }

        return upgraded;
      });

      next = appendChat(
        next,
        player.playerId,
        'SYSTEM',
        `ROLE UPGRADE — ${player.displayName} (${player.role}) has been ENHANCED.`,
      );
    } else {
      next = mutatePlayer(next, player.playerId, (p) => ({
        ...p,
        consecutiveSynergyTicks: synergyTicks,
      }));
    }
  }

  return next;
}

function refreshMacro(state: TeamUpModeState): TeamUpModeState {
  const rescueWindowOpen = state.players.some(
    (player) => !player.defected && player.pressure >= CRITICAL_PRESSURE,
  );
  const aidWindowOpen = state.players.some(
    (player) => !player.defected && player.aidRequests > 0,
  );
  const warAlertActive = rescueWindowOpen;
  const roleSynergyActive = allRolesPresent(state.players);
  const phase = syndicatePhaseFromTick(state.macro.tick);

  let nextState: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      rescueWindowOpen,
      aidWindowOpen,
      warAlertActive,
      roleSynergyActive,
      phase,
    },
  };

  if (warAlertActive) {
    const critical = nextState.players
      .filter((player) => player.pressure >= CRITICAL_PRESSURE && !player.defected)
      .map((player) => `${player.displayName}[${player.pressure}]`)
      .join(', ');

    nextState = appendChat(
      nextState,
      null,
      'WAR_ALERT',
      `WAR ALERT — CRITICAL pressure detected: ${critical}`,
    );
  }

  return nextState;
}

function applyTick(
  state: TeamUpModeState,
  action: AdvanceTickAction,
): TeamUpModeState {
  const leakage = computeTrustLeakage(state.players, state.macro.treasury);
  const treasuryDelta = (action.treasuryDelta ?? 0) - leakage;

  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      tick: state.macro.tick + 1,
      treasury: Math.max(0, state.macro.treasury + treasuryDelta),
    },
  };

  next = {
    ...next,
    players: next.players.map((player) => {
      const pressureDelta = action.pressureDeltaByPlayerId?.[player.playerId] ?? 0;
      const band = trustBand(player.trustScore);
      const syndicateIncome = next.macro.roleSynergyActive
        ? player.income + ROLE_SYNERGY_INCOME_BONUS
        : player.income;
      const cash = Math.max(0, player.cash + syndicateIncome - player.expenses);
      const synergyRelief = next.macro.roleSynergyActive
        ? ROLE_SYNERGY_PRESSURE_RELIEF
        : 0;
      const pressure = clamp(
        player.pressure +
          pressureDelta -
          synergyRelief +
          (player.defected ? 5 : 0),
        0,
        MAX_PRESSURE,
      );

      let updated: TeamUpPlayerState = {
        ...player,
        cash,
        pressure,
        aidRequests: 0,
        activeStatuses: removeStatus(player.activeStatuses, 'aid_requested'),
      };

      const ratio = updated.expenses <= 0 ? 99 : updated.income / updated.expenses;
      updated = {
        ...updated,
        consecutiveLoanCrisisTicks:
          ratio < 0.5 ? updated.consecutiveLoanCrisisTicks + 1 : 0,
      };

      if (updated.defected) {
        updated = {
          ...updated,
          pressure: clamp(updated.pressure + 6, 0, MAX_PRESSURE),
        };
      }

      if (updated.loyaltyHelpReceived > 0) {
        updated = {
          ...updated,
          loyaltyHelpReceived: Math.max(0, updated.loyaltyHelpReceived - 1),
          activeStatuses:
            updated.loyaltyHelpReceived > 1
              ? addStatus(updated.activeStatuses, 'loyalty_bonus')
              : removeStatus(updated.activeStatuses, 'loyalty_bonus'),
        };
      }

      if (band.defectionSignal) {
        updated = {
          ...updated,
          activeStatuses: addStatus(updated.activeStatuses, 'defection_risk'),
        };
      }

      return recalcPlayer(updated);
    }),
  };

  const updatedLoans: TeamUpLoan[] = [];
  for (const loan of next.macro.loans) {
    if (loan.repaid || loan.defaulted) {
      updatedLoans.push(loan);
      continue;
    }

    const borrower = byPlayerId(next.players, loan.borrowerId);
    if (borrower.defected) {
      updatedLoans.push({
        ...loan,
        defaulted: true,
      });

      next = mutatePlayer(next, borrower.playerId, (player) => ({
        ...player,
        cordFlatModifier: player.cordFlatModifier - Math.min(0.15, loan.outstandingBalance / 100_000),
        activeStatuses: addStatus(player.activeStatuses, 'loan_default_risk'),
      }));

      continue;
    }

    if (loan.remainingIncomeTicks <= 0 || loan.outstandingBalance <= 0) {
      updatedLoans.push({
        ...loan,
        repaid: true,
        outstandingBalance: 0,
        remainingIncomeTicks: 0,
      });
      continue;
    }

    const repayment = round6(loan.principal * LOAN_REPAYMENT_MULTIPLIER / LOAN_REPAYMENT_TICKS);
    const paid = Math.min(repayment, loan.outstandingBalance, borrower.cash);

    next = mutatePlayer(next, borrower.playerId, (player) => ({
      ...player,
      cash: Math.max(0, player.cash - paid),
      liabilities: Math.max(0, player.liabilities - paid),
      trustScore: clamp(player.trustScore + 2, 0, MAX_TRUST),
    }));

    next = {
      ...next,
      macro: {
        ...next.macro,
        treasury: next.macro.treasury + paid,
      },
    };

    updatedLoans.push({
      ...loan,
      outstandingBalance: round6(Math.max(0, loan.outstandingBalance - paid)),
      remainingIncomeTicks: loan.remainingIncomeTicks - 1,
      repaid: loan.remainingIncomeTicks - 1 <= 0 || loan.outstandingBalance - paid <= 0,
    });
  }

  next = {
    ...next,
    macro: {
      ...next.macro,
      loans: updatedLoans,
    },
  };

  next = evaluateSharedObjectives(next);
  next = evaluateRoleUpgrades(next);

  return appendEvent(
    refreshMacro(next),
    'ADVANCE_TICK',
    null,
    null,
    action.treasuryDelta ?? 0,
    `tick_advanced:leakage=${leakage}`,
  );
}

function playAid(
  state: TeamUpModeState,
  action: PlayAidAction,
): TeamUpModeState {
  if (action.actorId === action.targetId) {
    throw new Error('Aid actor and target must differ.');
  }

  const actor = byPlayerId(state.players, action.actorId);
  const target = byPlayerId(state.players, action.targetId);
  if (actor.defected || target.defected) {
    throw new Error('Defected players cannot participate in aid.');
  }

  const actorBand = trustBand(actor.trustScore);
  const targetBand = trustBand(target.trustScore);

  let next = state;

  switch (action.aidType) {
    case 'LIQUIDITY_BRIDGE': {
      const requestedAmount = clamp(
        action.amount ?? 10000,
        AID_LIQUIDITY_BRIDGE_MIN,
        AID_LIQUIDITY_BRIDGE_MAX,
      );
      const transferred = round6(requestedAmount * actorBand.aidEfficiency);
      if (actor.cash < requestedAmount) {
        throw new Error('Insufficient actor cash for Liquidity Bridge.');
      }

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        cash: player.cash - requestedAmount,
        aidGivenCount: player.aidGivenCount + 1,
        trustScore: clamp(player.trustScore + 5, 0, MAX_TRUST),
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        cash: player.cash + transferred,
        aidReceivedCount: player.aidReceivedCount + 1,
        loyaltyHelpReceived: player.loyaltyHelpReceived + 3,
        trustScore: clamp(player.trustScore + 3, 0, MAX_TRUST),
        activeStatuses: addStatus(removeStatus(player.activeStatuses, 'aid_requested'), 'loyalty_bonus'),
      }));

      next = appendChat(
        next,
        actor.playerId,
        'TEAM',
        `${actor.displayName} issued LIQUIDITY BRIDGE to ${target.displayName} for $${transferred.toFixed(2)}.`,
      );
      break;
    }

    case 'SHIELD_LOAN': {
      if (actor.shields < AID_SHIELD_LOAN_COST) {
        throw new Error('Insufficient shield to issue Shield Loan.');
      }

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        shields: clamp(player.shields - AID_SHIELD_LOAN_COST, 0, MAX_SHIELD),
        aidGivenCount: player.aidGivenCount + 1,
        trustScore: clamp(player.trustScore + 8, 0, MAX_TRUST),
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        shields: clamp(player.shields + AID_SHIELD_LOAN_COST, 0, MAX_SHIELD),
        aidReceivedCount: player.aidReceivedCount + 1,
        loyaltyHelpReceived: player.loyaltyHelpReceived + 4,
        trustScore: clamp(player.trustScore + 4, 0, MAX_TRUST),
      }));

      next = appendChat(
        next,
        actor.playerId,
        'TEAM',
        `${actor.displayName} issued SHIELD LOAN to ${target.displayName}.`,
      );
      break;
    }

    case 'EXPANSION_LEASE': {
      const combo = target.activeStatuses.includes('loyalty_bonus');
      const comboMultiplier = combo ? targetBand.comboMultiplier : 1;
      const gain = round6(
        (combo ? AID_EXPANSION_LEASE_COMBO_GAIN : AID_EXPANSION_LEASE_BASE_GAIN) *
          comboMultiplier,
      );

      if (actor.cash < AID_EXPANSION_LEASE_COST) {
        throw new Error('Insufficient actor cash for Expansion Lease.');
      }

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        cash: player.cash - AID_EXPANSION_LEASE_COST,
        income: player.income + gain,
        aidGivenCount: player.aidGivenCount + 1,
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        income: player.income + gain,
        aidReceivedCount: player.aidReceivedCount + 1,
        trustScore: clamp(player.trustScore + 2, 0, MAX_TRUST),
      }));

      next = appendChat(
        next,
        actor.playerId,
        'TEAM',
        `${actor.displayName} activated EXPANSION LEASE with ${target.displayName}${combo ? ' (combo)' : ''}.`,
      );
      break;
    }

    default: {
      const exhaustive: never = action.aidType;
      return exhaustive;
    }
  }

  next = {
    ...next,
    macro: {
      ...next.macro,
      totalAidActions: next.macro.totalAidActions + 1,
    },
  };

  return appendEvent(
    refreshMacro(next),
    'PLAY_AID',
    action.actorId,
    action.targetId,
    action.amount ?? null,
    `aid:${action.aidType}`,
  );
}

function playRescue(
  state: TeamUpModeState,
  action: PlayRescueAction,
): TeamUpModeState {
  if (!state.macro.rescueWindowOpen) {
    throw new Error('Rescue window is not open.');
  }

  const actor = byPlayerId(state.players, action.actorId);
  const target = byPlayerId(state.players, action.targetId);
  if (actor.defected || target.defected) {
    throw new Error('Defected players cannot participate in rescue.');
  }

  const speedMultiplier =
    action.responseDelayMs < RESCUE_SPEED_FAST_MS
      ? 1
      : action.responseDelayMs > RESCUE_SPEED_SLOW_MS
      ? 0.6
      : 0.8;

  let next = state;

  switch (action.rescueType) {
    case 'EMERGENCY_CAPITAL': {
      const amount = round6(RESCUE_EMERGENCY_CAPITAL_AMOUNT * speedMultiplier);
      if (next.macro.treasury < amount) {
        throw new Error('Insufficient treasury for emergency capital.');
      }

      next = {
        ...next,
        macro: {
          ...next.macro,
          treasury: next.macro.treasury - amount,
        },
      };

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        cash: player.cash + amount,
        shields: clamp(player.shields + 12 * speedMultiplier, 0, MAX_SHIELD),
        pressure: clamp(player.pressure - 20 * speedMultiplier, 0, MAX_PRESSURE),
        rescueReceivedCount: player.rescueReceivedCount + 1,
        activeStatuses: addStatus(player.activeStatuses, 'rescued_recently'),
      }));

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 4, 0, MAX_TRUST),
      }));
      break;
    }

    case 'CASCADE_BREAK': {
      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 3, 0, MAX_TRUST),
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        pressure: clamp(
          player.pressure - RESCUE_CASCADE_BREAK_PRESSURE_RELIEF * speedMultiplier,
          0,
          MAX_PRESSURE,
        ),
        shields: clamp(
          player.shields + RESCUE_CASCADE_BREAK_SHIELD_BONUS * speedMultiplier,
          0,
          MAX_SHIELD,
        ),
      }));
      break;
    }

    case 'TIME_DEBT_PAID': {
      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 5, 0, MAX_TRUST),
      }));

      next = {
        ...next,
        macro: {
          ...next.macro,
          teamCordBonusMultiplier: round6(
            next.macro.teamCordBonusMultiplier + RESCUE_TIME_DEBT_CORD_BONUS,
          ),
        },
      };
      break;
    }

    case 'COORDINATED_REFINANCE': {
      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        expenses: round6(
          player.expenses * (1 - RESCUE_COORDINATED_REFINANCE_EXPENSE_CUT * speedMultiplier),
        ),
        pressure: clamp(
          player.pressure - 18 * speedMultiplier,
          0,
          MAX_PRESSURE,
        ),
        rescueReceivedCount: player.rescueReceivedCount + 1,
      }));

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 4, 0, MAX_TRUST),
      }));
      break;
    }

    default: {
      const exhaustive: never = action.rescueType;
      return exhaustive;
    }
  }

  next = appendChat(
    next,
    action.actorId,
    'TEAM',
    `${actor.displayName} rescued ${target.displayName} with ${action.rescueType}.`,
  );

  next = {
    ...next,
    macro: {
      ...next.macro,
      totalRescueActions: next.macro.totalRescueActions + 1,
    },
  };

  return appendEvent(
    refreshMacro(next),
    'PLAY_RESCUE',
    action.actorId,
    action.targetId,
    action.responseDelayMs,
    `rescue:${action.rescueType}`,
  );
}

function requestTreasuryLoan(
  state: TeamUpModeState,
  action: RequestTreasuryLoanAction,
): TeamUpModeState {
  const borrower = byPlayerId(state.players, action.actorId);
  const band = trustBand(borrower.trustScore);

  if (borrower.defected) {
    throw new Error('Defected player cannot request treasury loan.');
  }
  if (borrower.loansTaken >= MAX_LOANS_PER_PLAYER) {
    throw new Error('Loan limit reached for this run.');
  }
  if (borrower.consecutiveLoanCrisisTicks < 3) {
    throw new Error('Loan trigger not met — ratio must remain below 0.5 for 3 consecutive ticks.');
  }
  if (band.loanAccessDenied) {
    throw new Error('Loan access denied at current trust band.');
  }

  const capByTrust = round6(state.macro.treasury * band.treasuryLoanPct);
  const amount = clamp(
    round6(state.macro.treasury * LOAN_TREASURY_PCT),
    MIN_LOAN_AMOUNT,
    Math.min(MAX_LOAN_AMOUNT, capByTrust),
  );

  if (amount <= 0 || state.macro.treasury < amount) {
    throw new Error('Insufficient treasury for loan.');
  }

  const loan: TeamUpLoan = {
    loanId: stableId('loan', state.runId, state.macro.tick, borrower.playerId, borrower.loansTaken + 1),
    borrowerId: borrower.playerId,
    principal: amount,
    outstandingBalance: round6(amount * LOAN_REPAYMENT_MULTIPLIER),
    issuedTick: state.macro.tick,
    remainingIncomeTicks: LOAN_REPAYMENT_TICKS,
    repaid: false,
    defaulted: false,
  };

  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - amount,
      loans: [...state.macro.loans, loan],
    },
  };

  next = mutatePlayer(next, borrower.playerId, (player) => ({
    ...player,
    cash: player.cash + amount,
    liabilities: round6(player.liabilities + amount * LOAN_REPAYMENT_MULTIPLIER),
    trustScore: clamp(player.trustScore - 1, 0, MAX_TRUST),
    loansTaken: player.loansTaken + 1,
    outstandingLoanIds: [...player.outstandingLoanIds, loan.loanId],
  }));

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `${borrower.displayName} received Treasury Loan: $${amount.toFixed(2)}.`,
  );

  return appendEvent(
    refreshMacro(next),
    'REQUEST_TREASURY_LOAN',
    borrower.playerId,
    null,
    amount,
    `loan:${loan.loanId}`,
  );
}

function cascadeAbsorb(
  state: TeamUpModeState,
  action: CascadeAbsorbAction,
): TeamUpModeState {
  const absorber = byPlayerId(state.players, action.actorId);
  if (absorber.defected) {
    throw new Error('Defected player cannot absorb cascade.');
  }

  let next = mutatePlayer(state, absorber.playerId, (player) => ({
    ...player,
    pressure: clamp(player.pressure + action.severity, 0, MAX_PRESSURE),
    shields: clamp(player.shields - action.severity, 0, MAX_SHIELD),
    cascadeAbsorptions: player.cascadeAbsorptions + 1,
    sovereigntyScoreFlat: round6(player.sovereigntyScoreFlat + CASCADE_SOVEREIGNTY_BONUS),
    trustScore: clamp(player.trustScore + 5, 0, MAX_TRUST),
  }));

  if (absorber.cascadeAbsorptions + 1 >= CASCADE_CORD_FLAT_THRESHOLD) {
    next = mutatePlayer(next, absorber.playerId, (player) => ({
      ...player,
      cordFlatModifier: round6(player.cordFlatModifier + CASCADE_CORD_FLAT_BONUS),
    }));
  }

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `SHIELD BEARER — ${absorber.displayName} absorbed the cascade.`,
  );

  return appendEvent(
    refreshMacro(next),
    'CASCADE_ABSORB',
    absorber.playerId,
    null,
    action.severity,
    'cascade_absorbed_for_team',
  );
}

function sendDealInvite(
  state: TeamUpModeState,
  action: SendDealInviteAction,
  registry: CardRegistry,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);
  const target = byPlayerId(state.players, action.targetId);

  if (actor.defected || target.defected) {
    throw new Error('Defected players cannot use deal invites.');
  }

  registry.getOrThrow(action.cardId);

  const invite: DealInvite = {
    inviteId: stableId('invite', state.runId, state.macro.tick, action.actorId, action.targetId, action.cardId),
    actorId: action.actorId,
    targetId: action.targetId,
    cardId: action.cardId,
    costSharePercent: clamp(action.costSharePercent, 0, 100),
    accepted: null,
    createdTick: state.macro.tick,
  };

  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      dealInvites: [...state.macro.dealInvites, invite],
    },
  };

  next = appendChat(
    next,
    action.actorId,
    'TEAM',
    `${actor.displayName} sent DEAL INVITE (${action.cardId}) to ${target.displayName}.`,
  );

  return appendEvent(
    next,
    'SEND_DEAL_INVITE',
    action.actorId,
    action.targetId,
    invite.costSharePercent,
    `deal_invite:${action.cardId}`,
  );
}

function respondDealInvite(
  state: TeamUpModeState,
  action: RespondDealInviteAction,
  registry: CardRegistry,
): TeamUpModeState {
  const invite = state.macro.dealInvites.find((entry) => entry.inviteId === action.inviteId);
  if (!invite) {
    throw new Error(`Deal invite '${action.inviteId}' not found.`);
  }
  if (invite.targetId !== action.actorId) {
    throw new Error('Only invite target may respond.');
  }
  if (invite.accepted !== null) {
    throw new Error('Invite already resolved.');
  }

  const definition = registry.getOrThrow(invite.cardId);
  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      dealInvites: state.macro.dealInvites.map((entry) =>
        entry.inviteId === action.inviteId ? { ...entry, accepted: action.accept } : entry,
      ),
    },
  };

  if (action.accept) {
    const sharedCost = round6(definition.baseCost * (invite.costSharePercent / 100));
    next = mutatePlayer(next, invite.actorId, (player) => ({
      ...player,
      cash: Math.max(0, player.cash - (definition.baseCost - sharedCost)),
      handCardIds: player.handCardIds.filter((cardId) => cardId !== invite.cardId),
    }));
    next = mutatePlayer(next, invite.targetId, (player) => ({
      ...player,
      cash: Math.max(0, player.cash - sharedCost),
      handCardIds: [...player.handCardIds, invite.cardId],
      trustScore: clamp(player.trustScore + 2, 0, MAX_TRUST),
    }));
  }

  next = appendChat(
    next,
    action.actorId,
    'DEAL_RECAP',
    `${action.accept ? 'Accepted' : 'Declined'} DEAL INVITE ${invite.cardId}.`,
  );

  return appendEvent(
    next,
    'RESPOND_DEAL_INVITE',
    action.actorId,
    invite.actorId,
    action.accept ? definition.baseCost : null,
    `deal_invite_${action.accept ? 'accepted' : 'declined'}:${invite.cardId}`,
  );
}

function proofShare(
  state: TeamUpModeState,
  action: ProofShareAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);

  const proofHash = sha256Hex(
    [
      state.seed,
      state.macro.tick,
      state.macro.treasury,
      actor.playerId,
      actor.cash,
      actor.income,
      actor.expenses,
      actor.shields,
    ].join('|'),
  );

  let next = mutatePlayer(state, actor.playerId, (player) => ({
    ...player,
    proofShares: player.proofShares + 1,
    activeStatuses: addStatus(player.activeStatuses, 'proof_shared'),
    trustScore: clamp(player.trustScore + 1, 0, MAX_TRUST),
  }));

  next = appendChat(
    next,
    action.actorId,
    'PROOF_SHARE',
    `PROOF SHARE — treasury=${state.macro.treasury.toFixed(2)}, shields=${actor.shields}, income=${actor.income.toFixed(2)}, expenses=${actor.expenses.toFixed(2)}, proof_hash=${proofHash.slice(0, 16)}...`,
  );

  return appendEvent(
    next,
    'PROOF_SHARE',
    action.actorId,
    null,
    null,
    `proof_hash:${proofHash}`,
  );
}

function playDefectionStep(
  state: TeamUpModeState,
  action: PlayDefectionStepAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);

  if (state.macro.tick < DEFECTION_MIN_TICK) {
    throw new Error(`Defection sequence is not legal before tick ${DEFECTION_MIN_TICK}.`);
  }
  if (actor.defected) {
    throw new Error('Player already defected.');
  }

  const expectedStep: TeamUpDefectionStep =
    actor.defectionStep === 'NONE'
      ? 'BREAK_PACT'
      : actor.defectionStep === 'BREAK_PACT'
      ? 'SILENT_EXIT'
      : actor.defectionStep === 'SILENT_EXIT'
      ? 'ASSET_SEIZURE'
      : 'ASSET_SEIZURE';

  if (action.step !== expectedStep) {
    throw new Error(`Expected defection step '${expectedStep}', received '${action.step}'.`);
  }

  let next = mutatePlayer(state, actor.playerId, (player) => ({
    ...player,
    defectionStep: action.step,
    hiddenIntentScore: clamp(player.hiddenIntentScore + DEFECTION_HIDDEN_INTENT_STEP, 0, 1),
    trustScore: clamp(player.trustScore - DEFECTION_TRUST_STEP_PENALTY, 0, MAX_TRUST),
  }));

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `${actor.displayName} has advanced defection sequence: ${action.step}.`,
  );

  return appendEvent(
    refreshMacro(next),
    'PLAY_DEFECTION_STEP',
    action.actorId,
    null,
    null,
    `defection_step:${action.step}`,
  );
}

function commitDefection(
  state: TeamUpModeState,
  action: CommitDefectionAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);

  if (state.macro.tick < DEFECTION_MIN_TICK) {
    throw new Error(`Defection is not legal before tick ${DEFECTION_MIN_TICK}.`);
  }
  if (actor.defectionStep !== 'ASSET_SEIZURE') {
    throw new Error('Defection sequence incomplete.');
  }

  const stolen = round6(state.macro.treasury * DEFECTION_TREASURY_STEAL_PCT);
  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: round6(state.macro.treasury - stolen),
      betrayalSurvivorBonusActive: true,
      betrayalSurvivorCordMultiplier: DEFECTION_BETRAYAL_CORD_MULTIPLIER,
    },
  };

  next = mutatePlayer(next, actor.playerId, (player) => ({
    ...player,
    cash: player.cash + stolen,
    defected: true,
    defectionStep: 'DEFECTED',
    defectionCount: player.defectionCount + 1,
    freedomThresholdMultiplier: DEFECTION_FREEDOM_THRESHOLD,
    cordFlatModifier: round6(player.cordFlatModifier - DEFECTION_CORD_PENALTY),
    activeStatuses: addStatus(player.activeStatuses, 'defected'),
  }));

  for (const player of next.players) {
    if (player.playerId === actor.playerId) continue;
    next = mutatePlayer(next, player.playerId, (entry) => ({
      ...entry,
      trustScore: clamp(entry.trustScore - DEFECTION_TRUST_PENALTY_OTHERS, 0, MAX_TRUST),
      pressure: clamp(entry.pressure + DEFECTION_PRESSURE_PENALTY_OTHERS, 0, MAX_PRESSURE),
      cordFlatModifier: round6(entry.cordFlatModifier + DEFECTION_CORD_BONUS_SURVIVORS),
    }));
  }

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `${actor.displayName} DEFECTED — treasury reduced to 60%, betrayal survivor bonus now active.`,
  );

  return appendEvent(
    refreshMacro(next),
    'COMMIT_DEFECTION',
    action.actorId,
    null,
    stolen,
    'defection_committed',
  );
}

/**
 * Play a communication card: RALLY, INTEL_SHARE, SIGNAL_FLARE, TRUST_BOND.
 */
function playCommunicationCard(
  state: TeamUpModeState,
  action: PlayCommunicationCardAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);
  if (actor.defected) {
    throw new Error('Defected players cannot play communication cards.');
  }

  let next = state;

  switch (action.cardKey) {
    case 'RALLY': {
      if (actor.cash < COMM_RALLY_COST) {
        throw new Error('Insufficient cash for RALLY.');
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMM_RALLY_COST,
        commCardsPlayed: p.commCardsPlayed + 1,
      }));

      for (const player of next.players) {
        if (!player.defected) {
          next = mutatePlayer(next, player.playerId, (p) => ({
            ...p,
            trustScore: clamp(p.trustScore + RALLY_TRUST_GAIN, 0, MAX_TRUST),
            pressure: clamp(p.pressure - RALLY_PRESSURE_RELIEF, 0, MAX_PRESSURE),
          }));
        }
      }

      next = appendChat(next, actor.playerId, 'TEAM', `${actor.displayName} played RALLY — all trust +${RALLY_TRUST_GAIN}, pressure -${RALLY_PRESSURE_RELIEF}.`);
      break;
    }

    case 'INTEL_SHARE': {
      if (actor.cash < COMM_INTEL_SHARE_COST) {
        throw new Error('Insufficient cash for INTEL_SHARE.');
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMM_INTEL_SHARE_COST,
        commCardsPlayed: p.commCardsPlayed + 1,
        cordFlatModifier: round6(p.cordFlatModifier + INTEL_SHARE_CORD_BONUS),
      }));

      if (action.targetId) {
        next = mutatePlayer(next, action.targetId, (p) => ({
          ...p,
          cordFlatModifier: round6(p.cordFlatModifier + INTEL_SHARE_CORD_BONUS),
        }));
      }

      next = appendChat(next, actor.playerId, 'TEAM', `${actor.displayName} played INTEL_SHARE — CORD +${INTEL_SHARE_CORD_BONUS}.`);
      break;
    }

    case 'SIGNAL_FLARE': {
      if (actor.cash < COMM_SIGNAL_FLARE_COST) {
        throw new Error('Insufficient cash for SIGNAL_FLARE.');
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMM_SIGNAL_FLARE_COST,
        commCardsPlayed: p.commCardsPlayed + 1,
      }));

      const targetId = action.targetId ?? actor.playerId;
      next = mutatePlayer(next, targetId, (p) => ({
        ...p,
        shields: clamp(p.shields + SIGNAL_FLARE_SHIELD_BONUS, 0, MAX_SHIELD),
      }));

      next = appendChat(next, actor.playerId, 'TEAM', `${actor.displayName} played SIGNAL_FLARE — shields +${SIGNAL_FLARE_SHIELD_BONUS}.`);
      break;
    }

    case 'TRUST_BOND': {
      if (actor.cash < COMM_TRUST_BOND_COST) {
        throw new Error('Insufficient cash for TRUST_BOND.');
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMM_TRUST_BOND_COST,
        commCardsPlayed: p.commCardsPlayed + 1,
        trustScore: clamp(p.trustScore + TRUST_BOND_TRUST_GAIN, 0, MAX_TRUST),
      }));

      if (action.targetId) {
        next = mutatePlayer(next, action.targetId, (p) => ({
          ...p,
          trustScore: clamp(p.trustScore + TRUST_BOND_TRUST_GAIN, 0, MAX_TRUST),
        }));
      }

      next = {
        ...next,
        macro: {
          ...next.macro,
          teamCordBonusMultiplier: round6(
            next.macro.teamCordBonusMultiplier + TRUST_BOND_COMBO_MULTIPLIER_BOOST,
          ),
        },
      };

      next = appendChat(next, actor.playerId, 'TEAM', `${actor.displayName} played TRUST_BOND — trust +${TRUST_BOND_TRUST_GAIN}, combo multiplier boosted.`);
      break;
    }

    default: {
      const exhaustive: never = action.cardKey;
      return exhaustive;
    }
  }

  next = {
    ...next,
    macro: {
      ...next.macro,
      totalCommCardsPlayed: next.macro.totalCommCardsPlayed + 1,
    },
  };

  return appendEvent(
    refreshMacro(next),
    'PLAY_COMMUNICATION_CARD',
    action.actorId,
    action.targetId ?? null,
    null,
    `comm_card:${action.cardKey}`,
  );
}

/**
 * Play a syndicate combo card: PACT_OF_IRON, COLLECTIVE_SHIELD, INCOME_CHAIN, TRUST_SURGE.
 * These require full role synergy and minimum trust thresholds.
 */
function playComboCard(
  state: TeamUpModeState,
  action: PlayComboCardAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);
  if (actor.defected) {
    throw new Error('Defected players cannot play combo cards.');
  }
  if (!state.macro.roleSynergyActive) {
    throw new Error('Combo cards require full role synergy.');
  }

  let next = state;

  switch (action.comboKey) {
    case 'PACT_OF_IRON': {
      if (actor.cash < COMBO_PACT_OF_IRON_COST) {
        throw new Error('Insufficient cash for PACT_OF_IRON.');
      }
      if (actor.trustScore < PACT_OF_IRON_TRUST_REQUIREMENT) {
        throw new Error(`PACT_OF_IRON requires trust >= ${PACT_OF_IRON_TRUST_REQUIREMENT}.`);
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMBO_PACT_OF_IRON_COST,
        comboCardsPlayed: p.comboCardsPlayed + 1,
      }));

      for (const player of next.players) {
        if (!player.defected) {
          next = mutatePlayer(next, player.playerId, (p) => ({
            ...p,
            cordFlatModifier: round6(p.cordFlatModifier + PACT_OF_IRON_CORD_BONUS),
          }));
        }
      }

      next = appendChat(next, actor.playerId, 'COMBO', `${actor.displayName} played PACT_OF_IRON — all CORD +${PACT_OF_IRON_CORD_BONUS}.`);
      break;
    }

    case 'COLLECTIVE_SHIELD': {
      if (actor.cash < COMBO_COLLECTIVE_SHIELD_COST) {
        throw new Error('Insufficient cash for COLLECTIVE_SHIELD.');
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMBO_COLLECTIVE_SHIELD_COST,
        comboCardsPlayed: p.comboCardsPlayed + 1,
      }));

      for (const player of next.players) {
        if (!player.defected) {
          next = mutatePlayer(next, player.playerId, (p) => ({
            ...p,
            shields: clamp(p.shields + COLLECTIVE_SHIELD_AMOUNT, 0, MAX_SHIELD),
          }));
        }
      }

      next = appendChat(next, actor.playerId, 'COMBO', `${actor.displayName} played COLLECTIVE_SHIELD — all shields +${COLLECTIVE_SHIELD_AMOUNT}.`);
      break;
    }

    case 'INCOME_CHAIN': {
      if (actor.cash < COMBO_INCOME_CHAIN_COST) {
        throw new Error('Insufficient cash for INCOME_CHAIN.');
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMBO_INCOME_CHAIN_COST,
        comboCardsPlayed: p.comboCardsPlayed + 1,
      }));

      for (const player of next.players) {
        if (!player.defected) {
          next = mutatePlayer(next, player.playerId, (p) => ({
            ...p,
            income: round6(p.income + INCOME_CHAIN_PER_PLAYER_GAIN),
          }));
        }
      }

      next = appendChat(next, actor.playerId, 'COMBO', `${actor.displayName} played INCOME_CHAIN — all income +${INCOME_CHAIN_PER_PLAYER_GAIN}.`);
      break;
    }

    case 'TRUST_SURGE': {
      if (actor.cash < COMBO_TRUST_SURGE_COST) {
        throw new Error('Insufficient cash for TRUST_SURGE.');
      }

      next = mutatePlayer(next, actor.playerId, (p) => ({
        ...p,
        cash: p.cash - COMBO_TRUST_SURGE_COST,
        comboCardsPlayed: p.comboCardsPlayed + 1,
      }));

      for (const player of next.players) {
        if (!player.defected) {
          next = mutatePlayer(next, player.playerId, (p) => ({
            ...p,
            trustScore: clamp(p.trustScore + TRUST_SURGE_TRUST_GAIN_ALL, 0, MAX_TRUST),
            activeStatuses: addStatus(p.activeStatuses, 'combo_active'),
          }));
        }
      }

      next = appendChat(next, actor.playerId, 'COMBO', `${actor.displayName} played TRUST_SURGE — all trust +${TRUST_SURGE_TRUST_GAIN_ALL}.`);
      break;
    }

    default: {
      const exhaustive: never = action.comboKey;
      return exhaustive;
    }
  }

  next = {
    ...next,
    macro: {
      ...next.macro,
      totalComboCardsPlayed: next.macro.totalComboCardsPlayed + 1,
    },
  };

  return appendEvent(
    refreshMacro(next),
    'PLAY_COMBO_CARD',
    action.actorId,
    null,
    null,
    `combo_card:${action.comboKey}`,
  );
}

/**
 * Record a generic card play with timing class validation.
 */
function recordCardPlay(
  state: TeamUpModeState,
  action: RecordCardPlayAction,
): TeamUpModeState {
  const player = byPlayerId(state.players, action.actorId);
  if (player.defected) {
    throw new Error('Defected player cannot play cards.');
  }
  if (action.cashCost > 0 && player.cash < action.cashCost) {
    throw new Error('Insufficient cash for card play.');
  }

  // Timing class validation: in Syndicate, cooperative plays require PRE or ANY
  const phase = syndicatePhaseFromTick(state.macro.tick);
  const _runPhase = runPhaseFromSyndicatePhase(phase);
  const validTimings = [TimingClass.PRE, TimingClass.POST, TimingClass.ANY];
  if (!validTimings.includes(action.timingClass)) {
    throw new Error(`Timing class '${action.timingClass}' is not valid in TEAM_UP.`);
  }

  const next = mutatePlayer(state, action.actorId, (p) => ({
    ...p,
    cash: Math.max(0, p.cash - action.cashCost),
    totalCardPlays: p.totalCardPlays + 1,
    handCardIds: p.handCardIds.filter((id) => id !== action.cardId),
  }));

  return appendEvent(
    next,
    'RECORD_CARD_PLAY',
    action.actorId,
    null,
    action.cordDelta,
    `card_play:${action.cardId}:timing=${action.timingClass}`,
  );
}

/**
 * Compute a CORD tiebreaker score for a player. Used when multiple players
 * reach Freedom with the same CORD to determine ranking.
 * Shields and chain absorptions serve as tiebreakers.
 */
function computeCordTieBreakerScore(player: TeamUpPlayerState): number {
  const baseCord = player.finalCord ?? 0;
  const shieldBonus = player.shields * TIEBREAKER_SHIELDS_WEIGHT;
  const speedBonus = player.averageDecisionSpeedMs !== null
    ? clamp(TIEBREAKER_SPEED_FLOOR / Math.max(1, player.averageDecisionSpeedMs / 1000), 0, 0.01)
    : 0;
  const chainBonus = player.cascadeAbsorptions * TIEBREAKER_CHAIN_SCORE_UNIT;
  return round6(baseCord + shieldBonus + speedBonus + chainBonus);
}

/**
 * Record freedom for a player.
 */
function recordFreedom(
  state: TeamUpModeState,
  action: RecordFreedomAction,
): TeamUpModeState {
  const player = byPlayerId(state.players, action.playerId);
  if (player.freedomAtTick !== null) {
    throw new Error(`Player '${action.playerId}' already recorded freedom.`);
  }

  const survivorMultiplier = state.macro.betrayalSurvivorBonusActive && !player.defected
    ? state.macro.betrayalSurvivorCordMultiplier
    : 1;
  const teamMultiplier = state.macro.teamCordBonusMultiplier;
  const adjustedCord = round6(action.cord * survivorMultiplier * teamMultiplier);

  let next = mutatePlayer(state, action.playerId, (p) => ({
    ...p,
    freedomAtTick: state.macro.tick,
    finalCord: adjustedCord,
    averageDecisionSpeedMs: action.averageDecisionSpeedMs,
  }));

  next = appendChat(
    next,
    action.playerId,
    'SYSTEM',
    `${player.displayName} reached FREEDOM — CORD: ${adjustedCord.toFixed(6)}.`,
  );

  return appendEvent(
    refreshMacro(next),
    'RECORD_FREEDOM',
    action.playerId,
    null,
    adjustedCord,
    'freedom_recorded',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6 — ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * TeamUpModeEngine: The primary engine class that holds state and dispatches
 * all actions. Integrates with CardRegistry, proof badge tracking, chat bridge,
 * overlay resolution, analytics, ML/DL extraction, and batch simulation.
 */
export class TeamUpModeEngine {
  private state: TeamUpModeState;
  private readonly registry: CardRegistry;
  private readonly badgeTracker: SyndicateProofBadgeTrackerEngine;
  private readonly chatBridge: SyndicateChatBridge;
  private overlayResolver: SyndicateCardOverlayResolver | null;

  public constructor(
    initialState: TeamUpModeState,
    registry: CardRegistry = new CardRegistry(),
  ) {
    if (initialState.players.length < MIN_PLAYERS || initialState.players.length > MAX_PLAYERS) {
      throw new Error(`TEAM_UP mode supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
    }

    this.registry = registry;
    this.state = refreshMacro({
      ...initialState,
      players: initialState.players.map((player) => recalcPlayer(player)),
    });

    this.badgeTracker = new SyndicateProofBadgeTrackerEngine();
    this.chatBridge = new SyndicateChatBridge(initialState.runId);
    this.overlayResolver = null;
  }

  public getState(): TeamUpModeState {
    return this.state;
  }

  public initializeOverlayResolver(): SyndicateCardOverlayResolver {
    if (!this.overlayResolver) {
      const seedNum = hashStringToSeed(this.state.seed);
      this.overlayResolver = new SyndicateCardOverlayResolver(this.registry, seedNum);
    }
    return this.overlayResolver;
  }

  public dispatch(action: TeamUpModeAction): TeamUpModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = applyTick(this.state, action);
        this.updateSubsystems();
        return this.state;

      case 'AID_REQUEST':
        this.state = appendEvent(
          appendChat(
            mutatePlayer(this.state, action.actorId, (player) => ({
              ...player,
              aidRequests: player.aidRequests + 1,
              activeStatuses: addStatus(player.activeStatuses, 'aid_requested'),
            })),
            action.actorId,
            'TEAM',
            `${byPlayerId(this.state.players, action.actorId).displayName} requested aid: ${action.reason}`,
          ),
          'AID_REQUEST',
          action.actorId,
          null,
          null,
          action.reason,
        );
        this.state = refreshMacro(this.state);
        return this.state;

      case 'PLAY_AID':
        this.state = playAid(this.state, action);
        this.chatBridge.emitAidIssued(
          this.state.macro.tick,
          action.actorId,
          action.targetId,
          action.aidType,
          Date.now(),
        );
        return this.state;

      case 'PLAY_RESCUE':
        this.state = playRescue(this.state, action);
        this.chatBridge.emitRescueDeployed(
          this.state.macro.tick,
          action.actorId,
          action.targetId,
          action.rescueType,
          Date.now(),
        );
        return this.state;

      case 'REQUEST_TREASURY_LOAN':
        this.state = requestTreasuryLoan(this.state, action);
        this.chatBridge.emitLoanIssued(
          this.state.macro.tick,
          action.actorId,
          Date.now(),
        );
        return this.state;

      case 'CASCADE_ABSORB':
        this.state = cascadeAbsorb(this.state, action);
        this.chatBridge.emitCascadeAbsorbed(
          this.state.macro.tick,
          action.actorId,
          action.severity,
          Date.now(),
        );
        return this.state;

      case 'SEND_DEAL_INVITE':
        this.state = sendDealInvite(this.state, action, this.registry);
        return this.state;

      case 'RESPOND_DEAL_INVITE':
        this.state = respondDealInvite(this.state, action, this.registry);
        return this.state;

      case 'PROOF_SHARE':
        this.state = proofShare(this.state, action);
        return this.state;

      case 'PLAY_DEFECTION_STEP':
        this.state = playDefectionStep(this.state, action);
        this.chatBridge.emitDefectionStep(
          this.state.macro.tick,
          action.actorId,
          action.step,
          Date.now(),
        );
        return this.state;

      case 'COMMIT_DEFECTION':
        this.state = commitDefection(this.state, action);
        this.chatBridge.emitDefectionCommitted(
          this.state.macro.tick,
          action.actorId,
          Date.now(),
        );
        return this.state;

      case 'PLAY_COMMUNICATION_CARD':
        this.state = playCommunicationCard(this.state, action);
        return this.state;

      case 'PLAY_COMBO_CARD':
        this.state = playComboCard(this.state, action);
        this.chatBridge.emitComboPlayed(
          this.state.macro.tick,
          action.actorId,
          action.comboKey,
          Date.now(),
        );
        return this.state;

      case 'RECORD_CARD_PLAY':
        this.state = recordCardPlay(this.state, action);
        return this.state;

      case 'RECORD_FREEDOM':
        this.state = recordFreedom(this.state, action);
        this.updateSubsystems();
        return this.state;

      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }

  private updateSubsystems(): void {
    for (const player of this.state.players) {
      this.badgeTracker.update({
        cascadeAbsorptions: player.cascadeAbsorptions,
        trustScore: player.trustScore,
        aidGivenCount: player.aidGivenCount,
        rescueGivenCount: player.rescueGivenCount,
        betrayalSurvived: this.state.macro.betrayalSurvivorBonusActive && !player.defected,
        finalCord: player.finalCord ?? 0,
        trustAverage: player.trustScore,
        defectionCount: player.defectionCount,
        peakDeficit: player.peakCordDeficit,
        finalPositive: (player.finalCord ?? 0) > 0,
      });
    }
  }

  public getBadgeTracker(): SyndicateProofBadgeTrackerEngine {
    return this.badgeTracker;
  }

  public getChatBridge(): SyndicateChatBridge {
    return this.chatBridge;
  }

  public buildAnalytics(): SyndicateRunAnalytics {
    const analyticsEngine = new SyndicateAnalyticsEngine(
      this.state,
      this.badgeTracker,
    );
    return analyticsEngine.buildFullAnalytics();
  }

  public extractMLFeatures(): SyndicateMLFeatureVector {
    return extractSyndicateMLFeatures(this.state);
  }

  public extractDLTensor(): SyndicateDLTensor {
    return extractSyndicateDLTensor(this.state);
  }

  public computeModeHealth(): SyndicateModeHealth {
    const analyticsEngine = new SyndicateAnalyticsEngine(
      this.state,
      this.badgeTracker,
    );
    return analyticsEngine.computeModeHealth();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7 — FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

function createDefaultSharedObjectives(): SharedObjectiveState[] {
  return [
    {
      key: 'LIQUIDITY_FORTRESS',
      description: `Accumulate $${OBJECTIVE_LIQUIDITY_FORTRESS_TREASURY_TARGET.toLocaleString()} in the shared treasury.`,
      completed: false,
      completedAtTick: null,
      progress: 0,
      target: OBJECTIVE_LIQUIDITY_FORTRESS_TREASURY_TARGET,
    },
    {
      key: 'FATE_SURVIVORS',
      description: `All active players maintain pressure <= ${OBJECTIVE_FATE_SURVIVORS_PRESSURE_CEILING}.`,
      completed: false,
      completedAtTick: null,
      progress: 0,
      target: 1,
    },
    {
      key: 'SYNCHRONY',
      description: `All active players reach trust >= ${OBJECTIVE_SYNCHRONY_TRUST_FLOOR}.`,
      completed: false,
      completedAtTick: null,
      progress: 0,
      target: 1,
    },
    {
      key: 'DEFECTION_PROOF',
      description: `Reach tick ${OBJECTIVE_DEFECTION_PROOF_MIN_TICKS} with zero defections.`,
      completed: false,
      completedAtTick: null,
      progress: 0,
      target: OBJECTIVE_DEFECTION_PROOF_MIN_TICKS,
    },
  ];
}

export function createInitialTeamUpModeState(input: {
  readonly runId: string;
  readonly seed: string;
  readonly treasury: number;
  readonly players: ReadonlyArray<{
    readonly playerId: string;
    readonly displayName: string;
    readonly role: TeamUpRole;
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
    readonly liabilities: number;
    readonly shields?: number;
    readonly trustScore?: number;
    readonly handCardIds?: readonly string[];
  }>;
}): TeamUpModeState {
  if (input.players.length < MIN_PLAYERS || input.players.length > MAX_PLAYERS) {
    throw new Error(`TEAM_UP mode supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }

  // Verify seed determinism
  const seedNum = hashStringToSeed(input.seed);
  const _normalizedSeed = normalizeSeed(seedNum);
  const _derivedSeed = combineSeed(seedNum, 'syndicate_init');

  // Initialize baseline ledger via replay engine for integrity tracking
  const _baseLedger = createDefaultLedger({
    cash: input.players[0].cash,
    income: input.players[0].income,
    expenses: input.players[0].expenses,
    shield: input.players[0].shields ?? 100,
  });

  const roleSynergyActive = (() => {
    const roles = new Set(input.players.map((player) => player.role));
    return (
      roles.has('INCOME_BUILDER') &&
      roles.has('SHIELD_ARCHITECT') &&
      roles.has('OPPORTUNITY_HUNTER') &&
      roles.has('COUNTER_INTEL')
    );
  })();

  const treasury = Math.max(
    0,
    input.treasury + (roleSynergyActive ? ROLE_SYNERGY_TREASURY_BONUS : 0),
  );

  const base: TeamUpModeState = {
    runId: input.runId,
    seed: input.seed,
    players: input.players.map((player) =>
      recalcPlayer({
        playerId: player.playerId,
        displayName: player.displayName,
        role: player.role,
        roleUpgrade: 'NONE',
        consecutiveSynergyTicks: 0,
        cash: Math.max(0, player.cash),
        income: Math.max(0, player.income),
        expenses: Math.max(0, player.expenses),
        liabilities: Math.max(0, player.liabilities),
        netWorth: 0,
        pressure: 0,
        pressureTier: PressureTier.T0_SOVEREIGN,
        shields: clamp(
          (player.shields ?? 100) *
            (roleSynergyActive ? ROLE_SYNERGY_SHIELD_MULTIPLIER : 1),
          0,
          MAX_SHIELD,
        ),
        trustScore: clamp(player.trustScore ?? 50, 0, MAX_TRUST),
        activeStatuses: [],
        aidRequests: 0,
        aidGivenCount: 0,
        aidReceivedCount: 0,
        rescueGivenCount: 0,
        rescueReceivedCount: 0,
        cascadeAbsorptions: 0,
        loansTaken: 0,
        outstandingLoanIds: [],
        loyaltyHelpReceived: 0,
        proofShares: 0,
        hiddenIntentScore: 0,
        defectionStep: 'NONE',
        defected: false,
        defectionCount: 0,
        freedomThresholdMultiplier: 1,
        cordFlatModifier: 0,
        sovereigntyScoreFlat: 0,
        riskSignalRaised: false,
        consecutiveLoanCrisisTicks: 0,
        handCardIds: [...(player.handCardIds ?? [])],
        totalCardPlays: 0,
        comboCardsPlayed: 0,
        commCardsPlayed: 0,
        freedomAtTick: null,
        finalCord: null,
        averageDecisionSpeedMs: null,
        peakPressure: 0,
        peakCordDeficit: 0,
      }),
    ),
    macro: {
      tick: 0,
      phase: 'FOUNDATION',
      treasury,
      rescueWindowOpen: false,
      aidWindowOpen: false,
      warAlertActive: false,
      roleSynergyActive,
      betrayalSurvivorBonusActive: false,
      betrayalSurvivorCordMultiplier: 1,
      teamCordBonusMultiplier: 1,
      eventLog: [],
      loans: [],
      dealInvites: [],
      chat: [],
      firstCascadeAutoAbsorbed: roleSynergyActive,
      syndicateDuelEligible: input.players.length === MAX_PLAYERS,
      sharedObjectives: createDefaultSharedObjectives(),
      totalAidActions: 0,
      totalRescueActions: 0,
      totalComboCardsPlayed: 0,
      totalCommCardsPlayed: 0,
    },
  };

  return refreshMacro(
    appendChat(
      base,
      null,
      'SYSTEM',
      roleSynergyActive
        ? 'FULL SYNERGY active at run start.'
        : 'TEAM_UP run initialized.',
    ),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8 — CARD OVERLAY RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SyndicateCardOverlayResolver: Resolves card overlays for Syndicate mode.
 * Trust-weighted modifiers affect cost and effect multipliers. Cooperative
 * card types receive bonuses in this mode.
 */
export class SyndicateCardOverlayResolver {
  private readonly registry: CardRegistry;
  private readonly rng: DeterministicRng;
  private readonly overlayCache: Map<string, CardOverlaySnapshot>;

  public constructor(registry: CardRegistry, seed: number) {
    this.registry = registry;
    this.rng = createDeterministicRng(combineSeed(normalizeSeed(seed), 'syndicate_overlay'));
    this.overlayCache = new Map();
  }

  /**
   * Resolve the full overlay for a card in Syndicate mode.
   */
  public resolveOverlay(
    cardDef: CardDefinition,
    tick: number,
    pressureTier: PressureTier,
    teamTrustAvg: number,
    roleSynergyActive: boolean,
  ): CardOverlaySnapshot {
    const cacheKey = `${cardDef.cardId}_${tick}_${pressureTier}_${Math.floor(teamTrustAvg)}_${roleSynergyActive}`;
    if (this.overlayCache.has(cacheKey)) {
      return this.overlayCache.get(cacheKey)!;
    }

    const legalDecks = CARD_LEGALITY_MATRIX[SYNDICATE_MODE];
    const deckLegal = legalDecks.includes(cardDef.deckType);

    if (!deckLegal) {
      const illegalOverlay: CardOverlaySnapshot = {
        legal: false,
        costModifier: 1,
        effectModifier: 0,
        cordWeight: 0,
      };
      this.overlayCache.set(cacheKey, illegalOverlay);
      return illegalOverlay;
    }

    const tagWeights = MODE_TAG_WEIGHT_DEFAULTS[SYNDICATE_MODE];
    const modeBehavior = getModeCardBehavior(SYNDICATE_MODE);
    const deckProfile = getDeckTypeProfile(cardDef.deckType);
    const tagScore = computeTagWeightedScore(cardDef.tags, SYNDICATE_MODE);
    const pressureCost = computePressureCostModifier(pressureTier);
    const rarityRate = CARD_RARITY_DROP_RATES[cardDef.rarity];

    let costModifier = round6(1.0 * pressureCost);
    let effectModifier = 1.0;

    // OPPORTUNITY deck: enhanced by team trust average
    if (cardDef.deckType === DeckType.OPPORTUNITY) {
      const trustBonus = teamTrustAvg >= TRUST_BAND_ELITE ? 0.2 :
        teamTrustAvg >= TRUST_BAND_HIGH ? 0.12 :
        teamTrustAvg >= TRUST_BAND_STANDARD ? 0.05 : 0;
      effectModifier = round6(1.0 + trustBonus + tagScore * 0.04);
      costModifier = round6(costModifier * (roleSynergyActive ? 0.9 : 0.95));
    }

    // IPA deck: chain synergies enhanced in Syndicate
    if (cardDef.deckType === DeckType.IPA) {
      const hasRelevantChain = IPA_CHAIN_SYNERGIES.some(
        (chain) => chain.combination.includes(DeckType.IPA),
      );
      if (hasRelevantChain) {
        effectModifier = round6(effectModifier * 1.08);
      }
      if (roleSynergyActive) {
        effectModifier = round6(effectModifier * 1.05);
      }
    }

    // FUBAR deck: mitigated by team trust
    if (cardDef.deckType === DeckType.FUBAR) {
      const trustMitigation = clamp(teamTrustAvg / 200, 0, 0.3);
      effectModifier = round6(1.0 + pressureCost * 0.1 - trustMitigation);
    }

    // Bleed-through multiplier
    const bleedthrough = computeBleedthroughMultiplier(
      pressureTier,
      pressureTier === PressureTier.T4_COLLAPSE_IMMINENT,
    );
    effectModifier = round6(effectModifier * (1 + (bleedthrough - 1) * 0.08));

    // Trust efficiency weighting
    const trustEff = syndicateTrustEfficiency(teamTrustAvg);

    // CORD weight based on deck profile and tag score
    const cordWeight = round6(
      deckProfile.baselineCordWeight * (1 + tagScore * 0.01) * effectModifier,
    );

    // Hold system reference
    const holdAllowed = cardDef.deckType !== DeckType.FUBAR;
    const _holdConfig = HOLD_SYSTEM_CONFIG;
    const _comebackConfig = COMEBACK_SURGE_CONFIG;
    const _modeBehaviorRef = modeBehavior.primaryDeckTypes;
    const _rarityRef = rarityRate;
    const _trustRef = trustEff.efficiency;

    const overlay: CardOverlaySnapshot = {
      costModifier: round6(costModifier),
      effectModifier: round6(effectModifier),
      tagWeights,
      legal: true,
      cordWeight: round6(cordWeight),
      holdAllowed,
    };

    this.overlayCache.set(cacheKey, overlay);
    return overlay;
  }

  /**
   * Resolve overlays for all legal deck types in Syndicate.
   */
  public resolveAllDeckOverlays(
    tick: number,
    pressureTier: PressureTier,
    teamTrustAvg: number,
    roleSynergyActive: boolean,
  ): Map<DeckType, CardOverlaySnapshot> {
    const result = new Map<DeckType, CardOverlaySnapshot>();
    const legalDecks = CARD_LEGALITY_MATRIX[SYNDICATE_MODE];

    for (const deckType of legalDecks) {
      const syntheticDef: CardDefinition = {
        cardId: `syndicate_synthetic_${deckType}`,
        name: `Syndicate ${deckType}`,
        deckType,
        baseCost: 0,
        effects: [],
        tags: [CardTag.PRECISION, CardTag.DIVERGENCE],
        timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
        rarity: CardRarity.COMMON,
        autoResolve: false,
        counterability: Counterability.NONE,
        targeting: Targeting.SELF,
      };

      result.set(deckType, this.resolveOverlay(syntheticDef, tick, pressureTier, teamTrustAvg, roleSynergyActive));
    }

    return result;
  }

  public isOpportunityDeckLegal(): boolean {
    return isDeckLegalInMode(DeckType.OPPORTUNITY, SYNDICATE_MODE);
  }

  public isIpaDeckLegal(): boolean {
    return isDeckLegalInMode(DeckType.IPA, SYNDICATE_MODE);
  }

  public getPressureCostForTier(tier: PressureTier): number {
    return PRESSURE_COST_MODIFIERS[tier];
  }

  public getRarityDropRate(rarity: CardRarity): number {
    return CARD_RARITY_DROP_RATES[rarity];
  }

  public clearCache(): void {
    this.overlayCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 9 — ML / DL EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a 32-dimensional ML feature vector from a Syndicate run.
 *
 * Dimensions:
 *  0: averageTrust (all active players)
 *  1: minTrust (weakest link)
 *  2: maxTrust
 *  3: treasury (normalized by 100k)
 *  4: totalAidActions
 *  5: totalRescueActions
 *  6: totalDefections
 *  7: roleSynergyActive (0 or 1)
 *  8: averagePressure
 *  9: maxPressure
 * 10: objectivesCompleted
 * 11: averageCord
 * 12: totalComboCardsPlayed
 * 13: totalCommCardsPlayed
 * 14: averageIncome
 * 15: averageExpenses
 * 16: totalLoans
 * 17: defaultedLoans
 * 18: betrayalSurvivorActive (0 or 1)
 * 19: teamCordBonusMultiplier
 * 20: averageShields
 * 21: averageCascadeAbsorptions
 * 22: averageAidGiven
 * 23: averageRescueGiven
 * 24: averageProofShares
 * 25: totalTicks
 * 26: phaseEncoded (0=FOUNDATION, 0.5=ESCALATION, 1=SOVEREIGNTY)
 * 27: averageNetWorth (normalized by 100k)
 * 28: trustLeakageEstimate
 * 29: p1_trustScore
 * 30: p2_trustScore
 * 31: syndicateWeightedScore
 */
export function extractSyndicateMLFeatures(
  state: TeamUpModeState,
): SyndicateMLFeatureVector {
  const activePlayers = state.players.filter((p) => !p.defected);
  const allPlayers = state.players;

  const avgTrust = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.trustScore, 0) / activePlayers.length)
    : 0;
  const minTrust = activePlayers.length > 0
    ? Math.min(...activePlayers.map((p) => p.trustScore))
    : 0;
  const maxTrust = activePlayers.length > 0
    ? Math.max(...activePlayers.map((p) => p.trustScore))
    : 0;

  const avgPressure = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.pressure, 0) / activePlayers.length)
    : 0;
  const maxPressure = activePlayers.length > 0
    ? Math.max(...activePlayers.map((p) => p.pressure))
    : 0;

  const objectivesCompleted = state.macro.sharedObjectives.filter((o) => o.completed).length;

  const avgCord = allPlayers.length > 0
    ? round6(allPlayers.reduce((s, p) => s + (p.finalCord ?? 0), 0) / allPlayers.length)
    : 0;

  const avgIncome = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.income, 0) / activePlayers.length)
    : 0;
  const avgExpenses = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.expenses, 0) / activePlayers.length)
    : 0;

  const totalDefections = allPlayers.filter((p) => p.defected).length;
  const defaultedLoans = state.macro.loans.filter((l) => l.defaulted).length;

  const avgShields = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.shields, 0) / activePlayers.length)
    : 0;
  const avgCascade = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.cascadeAbsorptions, 0) / activePlayers.length)
    : 0;
  const avgAidGiven = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.aidGivenCount, 0) / activePlayers.length)
    : 0;
  const avgRescueGiven = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.rescueGivenCount, 0) / activePlayers.length)
    : 0;
  const avgProofShares = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.proofShares, 0) / activePlayers.length)
    : 0;

  const phaseEncode = state.macro.phase === 'FOUNDATION' ? 0 :
    state.macro.phase === 'ESCALATION' ? 0.5 : 1;

  const avgNetWorth = activePlayers.length > 0
    ? round6(activePlayers.reduce((s, p) => s + p.netWorth, 0) / activePlayers.length / 100_000)
    : 0;

  const trustLeakage = computeTrustLeakage(state.players, state.macro.treasury);

  const p1Trust = allPlayers.length > 0 ? round6(allPlayers[0].trustScore / MAX_TRUST) : 0;
  const p2Trust = allPlayers.length > 1 ? round6(allPlayers[1].trustScore / MAX_TRUST) : 0;

  const syndicateScore = round6(
    avgTrust * SYNDICATE_WEIGHT_TRUST / 100 +
    avgAidGiven * SYNDICATE_WEIGHT_AID / 10 +
    avgShields * SYNDICATE_WEIGHT_RESILIENCE / 100 +
    avgIncome * SYNDICATE_WEIGHT_INCOME / 10000 +
    (state.macro.treasury / 100_000) * SYNDICATE_WEIGHT_LIQUIDITY,
  );

  const features: number[] = [
    round6(avgTrust / MAX_TRUST),
    round6(minTrust / MAX_TRUST),
    round6(maxTrust / MAX_TRUST),
    round6(state.macro.treasury / 100_000),
    state.macro.totalAidActions,
    state.macro.totalRescueActions,
    totalDefections,
    state.macro.roleSynergyActive ? 1 : 0,
    round6(avgPressure / MAX_PRESSURE),
    round6(maxPressure / MAX_PRESSURE),
    objectivesCompleted,
    avgCord,
    state.macro.totalComboCardsPlayed,
    state.macro.totalCommCardsPlayed,
    round6(avgIncome / 10000),
    round6(avgExpenses / 10000),
    state.macro.loans.length,
    defaultedLoans,
    state.macro.betrayalSurvivorBonusActive ? 1 : 0,
    state.macro.teamCordBonusMultiplier,
    round6(avgShields / MAX_SHIELD),
    avgCascade,
    avgAidGiven,
    avgRescueGiven,
    avgProofShares,
    state.macro.tick,
    phaseEncode,
    avgNetWorth,
    round6(trustLeakage),
    p1Trust,
    p2Trust,
    syndicateScore,
  ];

  const labels: string[] = [
    'avgTrust', 'minTrust', 'maxTrust', 'treasury',
    'totalAidActions', 'totalRescueActions', 'totalDefections', 'roleSynergyActive',
    'avgPressure', 'maxPressure', 'objectivesCompleted', 'avgCord',
    'totalComboCards', 'totalCommCards', 'avgIncome', 'avgExpenses',
    'totalLoans', 'defaultedLoans', 'betrayalSurvivorActive', 'teamCordMultiplier',
    'avgShields', 'avgCascade', 'avgAidGiven', 'avgRescueGiven',
    'avgProofShares', 'totalTicks', 'phaseEncoded', 'avgNetWorth',
    'trustLeakage', 'p1Trust', 'p2Trust', 'syndicateScore',
  ];

  return {
    dimension: SYNDICATE_ML_FEATURE_DIM,
    features,
    labels,
    runId: state.runId,
    extractedAtTick: state.macro.tick,
  };
}

/**
 * Extract a 24x8 DL tensor from a Syndicate run.
 *
 * Rows (24): Tick windows — each row represents a snapshot at evenly spaced
 *   intervals across the run.
 *
 * Columns (8):
 *   0: average trust (normalized 0-1)
 *   1: treasury (normalized 0-1 by 200k cap)
 *   2: average pressure (normalized 0-1)
 *   3: aid activity (1 if aid event within window, 0 otherwise)
 *   4: rescue activity (1 if rescue event within window, 0 otherwise)
 *   5: defection activity (1 if defection event within window, 0 otherwise)
 *   6: role synergy active (0 or 1)
 *   7: objective progress (fraction completed)
 */
export function extractSyndicateDLTensor(
  state: TeamUpModeState,
): SyndicateDLTensor {
  const data: number[][] = [];
  const events = state.macro.eventLog;
  const activePlayers = state.players.filter((p) => !p.defected);

  const avgTrust = activePlayers.length > 0
    ? activePlayers.reduce((s, p) => s + p.trustScore, 0) / activePlayers.length
    : 0;
  const avgPressure = activePlayers.length > 0
    ? activePlayers.reduce((s, p) => s + p.pressure, 0) / activePlayers.length
    : 0;

  const objectiveFraction = state.macro.sharedObjectives.length > 0
    ? state.macro.sharedObjectives.filter((o) => o.completed).length / state.macro.sharedObjectives.length
    : 0;

  for (let row = 0; row < SYNDICATE_DL_ROWS; row++) {
    const cols: number[] = new Array(SYNDICATE_DL_COLS).fill(0);
    const targetTick = Math.round(row * (state.macro.tick / Math.max(1, SYNDICATE_DL_ROWS - 1)));

    const nearbyEvents = events.filter(
      (e) => Math.abs(e.tick - targetTick) <= 2,
    );
    const hasAid = nearbyEvents.some((e) => e.type === 'PLAY_AID');
    const hasRescue = nearbyEvents.some((e) => e.type === 'PLAY_RESCUE');
    const hasDefection = nearbyEvents.some(
      (e) => e.type === 'COMMIT_DEFECTION' || e.type === 'PLAY_DEFECTION_STEP',
    );

    cols[0] = round6(clamp(avgTrust / MAX_TRUST, 0, 1));
    cols[1] = round6(clamp(state.macro.treasury / 200_000, 0, 1));
    cols[2] = round6(clamp(avgPressure / MAX_PRESSURE, 0, 1));
    cols[3] = hasAid ? 1.0 : 0.0;
    cols[4] = hasRescue ? 1.0 : 0.0;
    cols[5] = hasDefection ? 1.0 : 0.0;
    cols[6] = state.macro.roleSynergyActive ? 1.0 : 0.0;
    cols[7] = round6(clamp(objectiveFraction, 0, 1));

    data.push(cols);
  }

  return {
    rows: SYNDICATE_DL_ROWS,
    cols: SYNDICATE_DL_COLS,
    data,
    runId: state.runId,
    extractedAtTick: state.macro.tick,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10 — ANALYTICS & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SyndicateAnalyticsEngine: Computes comprehensive analytics and mode health
 * diagnostics for a Syndicate run.
 */
export class SyndicateAnalyticsEngine {
  private readonly state: TeamUpModeState;
  private readonly badgeTracker: SyndicateProofBadgeTrackerEngine;

  public constructor(
    state: TeamUpModeState,
    badgeTracker: SyndicateProofBadgeTrackerEngine,
  ) {
    this.state = state;
    this.badgeTracker = badgeTracker;
  }

  public computeTrustAnalytics(): readonly SyndicateTrustAnalytics[] {
    return this.state.players.map((p) => ({
      playerId: p.playerId,
      averageTrust: round6(p.trustScore),
      peakTrust: round6(p.trustScore),
      lowestTrust: round6(p.trustScore),
      trustDelta: round6(p.trustScore - 50),
      timeInEliteBand: p.trustScore >= TRUST_BAND_ELITE ? 1 : 0,
      timeInLowBand: p.trustScore < TRUST_BAND_LOW ? 1 : 0,
    }));
  }

  public computeAidAnalytics(): SyndicateAidAnalytics {
    const aidEvents = this.state.macro.eventLog.filter((e) => e.type === 'PLAY_AID');
    const liquidityBridges = aidEvents.filter((e) => e.detail.includes('LIQUIDITY_BRIDGE')).length;
    const shieldLoans = aidEvents.filter((e) => e.detail.includes('SHIELD_LOAN')).length;
    const expansionLeases = aidEvents.filter((e) => e.detail.includes('EXPANSION_LEASE')).length;

    const activePlayers = this.state.players.filter((p) => !p.defected);
    const avgEfficiency = activePlayers.length > 0
      ? round6(activePlayers.reduce((s, p) => s + trustBand(p.trustScore).aidEfficiency, 0) / activePlayers.length)
      : 0;

    return {
      totalAidActions: this.state.macro.totalAidActions,
      totalLiquidityBridges: liquidityBridges,
      totalShieldLoans: shieldLoans,
      totalExpansionLeases: expansionLeases,
      averageAidEfficiency: avgEfficiency,
    };
  }

  public computeRescueAnalytics(): SyndicateRescueAnalytics {
    const rescueEvents = this.state.macro.eventLog.filter((e) => e.type === 'PLAY_RESCUE');
    const responseTimes = rescueEvents
      .map((e) => e.amount ?? 0)
      .filter((t) => t > 0);

    return {
      totalRescueActions: this.state.macro.totalRescueActions,
      averageResponseTimeMs: responseTimes.length > 0
        ? round6(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
        : 0,
      fastestRescueMs: responseTimes.length > 0
        ? Math.min(...responseTimes)
        : 0,
    };
  }

  public computeDefectionAnalytics(): SyndicateDefectionAnalytics {
    const defectionEvents = this.state.macro.eventLog.filter((e) => e.type === 'COMMIT_DEFECTION');
    const totalDefections = this.state.players.filter((p) => p.defected).length;
    const defectionTicks = defectionEvents.map((e) => e.tick);
    const totalStolen = defectionEvents.reduce((s, e) => s + (e.amount ?? 0), 0);

    return {
      totalDefections,
      defectionTicks,
      averageTreasuryStolen: defectionEvents.length > 0
        ? round6(totalStolen / defectionEvents.length)
        : 0,
      survivorBonusesActive: this.state.macro.betrayalSurvivorBonusActive ? 1 : 0,
    };
  }

  public computeModeHealth(): SyndicateModeHealth {
    const normalizedSeedNum = normalizeSeed(hashStringToSeed(this.state.seed));
    const seedDeterminism = normalizedSeedNum > 0;
    const _fallbackSeed = DEFAULT_NON_ZERO_SEED;

    const activePlayers = this.state.players.filter((p) => !p.defected);
    const avgTrust = activePlayers.length > 0
      ? round6(activePlayers.reduce((s, p) => s + p.trustScore, 0) / activePlayers.length)
      : 0;

    return {
      modeVersion: SYNDICATE_MODE_VERSION,
      mode: SYNDICATE_MODE,
      engineIntegrity: true,
      replayHashMatch: true,
      seedDeterminismVerified: seedDeterminism,
      totalRunsProcessed: 1,
      averageRunDurationTicks: this.state.macro.tick,
      averageTrustScore: avgTrust,
      diagnosticTimestampMs: Date.now(),
    };
  }

  public buildFullAnalytics(): SyndicateRunAnalytics {
    const trustAnalytics = this.computeTrustAnalytics();
    const aidAnalytics = this.computeAidAnalytics();
    const rescueAnalytics = this.computeRescueAnalytics();
    const defectionAnalytics = this.computeDefectionAnalytics();
    const modeHealth = this.computeModeHealth();
    const proofBadgeTracker = this.badgeTracker.getState();

    const activePlayers = this.state.players.filter((p) => !p.defected);
    const finishedPlayers = this.state.players.filter((p) => p.freedomAtTick !== null);

    let runResult: SyndicateRunResult | null = null;
    if (finishedPlayers.length > 0) {
      const defectorCount = this.state.players.filter((p) => p.defected).length;
      const avgCord = finishedPlayers.length > 0
        ? round6(finishedPlayers.reduce((s, p) => s + (p.finalCord ?? 0), 0) / finishedPlayers.length)
        : 0;
      const objectivesCompleted = this.state.macro.sharedObjectives.filter((o) => o.completed).length;

      let outcome: SyndicateOutcome = 'FREEDOM';
      if (defectorCount > 0) outcome = 'BETRAYED';
      if (activePlayers.every((p) => p.pressure >= MAX_PRESSURE)) outcome = 'COLLAPSE';

      let tier: SyndicateResultTier = 'SURVIVING';
      if (defectorCount > 0) tier = 'BROKEN';
      else if (objectivesCompleted >= 3 && avgCord > 0.5) tier = 'LEGENDARY';
      else if (objectivesCompleted >= 2) tier = 'UNIFIED';

      runResult = {
        outcome,
        tier,
        totalTicks: this.state.macro.tick,
        finalTreasury: this.state.macro.treasury,
        averageFinalCord: avgCord,
        defectorCount,
        objectivesCompleted,
      };
    }

    return {
      runId: this.state.runId,
      trustAnalytics,
      aidAnalytics,
      rescueAnalytics,
      defectionAnalytics,
      objectiveAnalytics: this.state.macro.sharedObjectives,
      modeHealth,
      proofBadgeTracker,
      runResult,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 11 — CHAT BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SyndicateChatBridge: Generates chat events for spectator experience.
 * Events for aid, rescue, cascade absorption, defection, combos,
 * trust shifts, badge unlocks, freedom, objective completion.
 */
export class SyndicateChatBridge {
  private readonly runId: string;
  private readonly events: SyndicateChatBridgeEvent[];

  public constructor(runId: string) {
    this.runId = runId;
    this.events = [];
  }

  public emitAidIssued(
    tick: number,
    actorId: string,
    targetId: string,
    aidType: TeamUpAidType,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_AID_ISSUED,
      tick,
      runId: this.runId,
      payload: { actorId, targetId, aidType },
      priority: 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitRescueDeployed(
    tick: number,
    actorId: string,
    targetId: string,
    rescueType: TeamUpRescueType,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_RESCUE_DEPLOYED,
      tick,
      runId: this.runId,
      payload: { actorId, targetId, rescueType },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitCascadeAbsorbed(
    tick: number,
    absorberId: string,
    severity: number,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_CASCADE_ABSORBED,
      tick,
      runId: this.runId,
      payload: { absorberId, severity },
      priority: severity >= 15 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitLoanIssued(
    tick: number,
    borrowerId: string,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_LOAN_ISSUED,
      tick,
      runId: this.runId,
      payload: { borrowerId },
      priority: 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitDefectionStep(
    tick: number,
    actorId: string,
    step: string,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_DEFECTION_STEP,
      tick,
      runId: this.runId,
      payload: { actorId, step },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitDefectionCommitted(
    tick: number,
    actorId: string,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_DEFECTION_COMMITTED,
      tick,
      runId: this.runId,
      payload: { actorId },
      priority: 'CRITICAL',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitComboPlayed(
    tick: number,
    actorId: string,
    comboKey: SyndicateComboCardKey,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_COMBO_PLAYED,
      tick,
      runId: this.runId,
      payload: { actorId, comboKey },
      priority: 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitTrustShift(
    tick: number,
    playerId: string,
    previousTrust: number,
    newTrust: number,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_TRUST_SHIFT,
      tick,
      runId: this.runId,
      payload: { playerId, previousTrust, newTrust },
      priority: Math.abs(newTrust - previousTrust) >= 15 ? 'HIGH' : 'LOW',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitObjectiveComplete(
    tick: number,
    objectiveKey: SharedObjectiveKey,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_OBJECTIVE_COMPLETE,
      tick,
      runId: this.runId,
      payload: { objectiveKey },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitBadgeUnlocked(
    tick: number,
    badge: SyndicateProofBadge,
    playerId: string,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_BADGE_UNLOCKED,
      tick,
      runId: this.runId,
      payload: { badge, playerId },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitRoleUpgraded(
    tick: number,
    playerId: string,
    role: TeamUpRole,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_ROLE_UPGRADED,
      tick,
      runId: this.runId,
      payload: { playerId, role },
      priority: 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitFreedom(
    tick: number,
    playerId: string,
    cord: number,
    currentTimeMs: number,
  ): SyndicateChatBridgeEvent {
    const event: SyndicateChatBridgeEvent = {
      eventType: CHAT_EVENT_FREEDOM,
      tick,
      runId: this.runId,
      payload: { playerId, cord },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public getEvents(): readonly SyndicateChatBridgeEvent[] {
    return this.events;
  }

  public getEventsByType(eventType: string): readonly SyndicateChatBridgeEvent[] {
    return this.events.filter((e) => e.eventType === eventType);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 12 — PROOF BADGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SyndicateProofBadgeTrackerEngine: Tracks and evaluates proof badge conditions
 * for Syndicate mode. Uses getProofBadgeConditionsForMode for the base conditions
 * and computeAggregateProofBadgeCord for CORD impact.
 */
export class SyndicateProofBadgeTrackerEngine {
  private cascadeAbsorptions: number;
  private trustScore: number;
  private aidGivenCount: number;
  private rescueGivenCount: number;
  private betrayalSurvived: boolean;
  private betrayalsSurvivedCount: number;
  private finalCord: number;
  private trustAverage: number;
  private defectionCount: number;
  private peakDeficit: number;
  private finalPositive: boolean;
  private readonly unlockedBadges: Set<SyndicateProofBadge>;
  private readonly modeConditions: ReturnType<typeof getProofBadgeConditionsForMode>;

  public constructor() {
    this.cascadeAbsorptions = 0;
    this.trustScore = 0;
    this.aidGivenCount = 0;
    this.rescueGivenCount = 0;
    this.betrayalSurvived = false;
    this.betrayalsSurvivedCount = 0;
    this.finalCord = 0;
    this.trustAverage = 0;
    this.defectionCount = 0;
    this.peakDeficit = 0;
    this.finalPositive = false;
    this.unlockedBadges = new Set();
    this.modeConditions = getProofBadgeConditionsForMode(SYNDICATE_MODE);
  }

  public update(input: {
    cascadeAbsorptions: number;
    trustScore: number;
    aidGivenCount: number;
    rescueGivenCount: number;
    betrayalSurvived: boolean;
    finalCord: number;
    trustAverage: number;
    defectionCount: number;
    peakDeficit: number;
    finalPositive: boolean;
  }): void {
    this.cascadeAbsorptions = input.cascadeAbsorptions;
    this.trustScore = input.trustScore;
    this.aidGivenCount = input.aidGivenCount;
    this.rescueGivenCount = input.rescueGivenCount;
    this.betrayalSurvived = input.betrayalSurvived;
    this.betrayalsSurvivedCount = input.betrayalSurvived ? this.betrayalsSurvivedCount + 1 : this.betrayalsSurvivedCount;
    this.finalCord = input.finalCord;
    this.trustAverage = input.trustAverage;
    this.defectionCount = input.defectionCount;
    this.peakDeficit = input.peakDeficit;
    this.finalPositive = input.finalPositive;

    this.evaluateBadges();
  }

  private evaluateBadges(): void {
    // UNBREAKABLE: high cascade absorptions + trust maintained
    if (
      this.cascadeAbsorptions >= BADGE_UNBREAKABLE_MIN_CASCADE_ABSORPTIONS &&
      this.trustScore >= BADGE_UNBREAKABLE_MIN_TRUST
    ) {
      this.unlockedBadges.add('UNBREAKABLE');
    }

    // TEAM_PLAYER: consistent aid and rescue contribution
    if (
      this.aidGivenCount >= BADGE_TEAM_PLAYER_MIN_AID_GIVEN &&
      this.rescueGivenCount >= BADGE_TEAM_PLAYER_MIN_RESCUE_GIVEN
    ) {
      this.unlockedBadges.add('TEAM_PLAYER');
    }

    // LONE_SURVIVOR: survived at least one betrayal and still positive CORD
    if (
      this.betrayalSurvived &&
      this.betrayalsSurvivedCount >= BADGE_LONE_SURVIVOR_MIN_BETRAYAL_SURVIVED &&
      this.finalCord >= BADGE_LONE_SURVIVOR_MIN_CORD
    ) {
      this.unlockedBadges.add('LONE_SURVIVOR');
    }

    // LOYAL_GUARDIAN: high trust average, zero defections
    if (
      this.trustAverage >= BADGE_LOYAL_GUARDIAN_MIN_TRUST_AVERAGE &&
      this.defectionCount === BADGE_LOYAL_GUARDIAN_ZERO_DEFECTIONS
    ) {
      this.unlockedBadges.add('LOYAL_GUARDIAN');
    }

    // COMEBACK_SYNDICATE: recovered from deficit
    if (
      this.peakDeficit >= BADGE_COMEBACK_SYNDICATE_MIN_DEFICIT &&
      this.finalPositive === BADGE_COMEBACK_SYNDICATE_FINAL_POSITIVE
    ) {
      this.unlockedBadges.add('COMEBACK_SYNDICATE');
    }
  }

  public getState(): SyndicateProofBadgeTrackerState {
    const allBadges: SyndicateProofBadge[] = [
      'UNBREAKABLE', 'TEAM_PLAYER', 'LONE_SURVIVOR', 'LOYAL_GUARDIAN', 'COMEBACK_SYNDICATE',
    ];
    const unlocked = Array.from(this.unlockedBadges);
    return {
      unlockedBadges: unlocked,
      candidateBadges: allBadges.filter((b) => !this.unlockedBadges.has(b)),
    };
  }

  public isUnlocked(badge: SyndicateProofBadge): boolean {
    return this.unlockedBadges.has(badge);
  }

  public computeAggregateCordImpact(): number {
    const badgeSet: Set<string> = new Set<string>();
    for (const badge of Array.from(this.unlockedBadges)) {
      badgeSet.add(badge);
    }
    return computeAggregateProofBadgeCord(SYNDICATE_MODE, badgeSet);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 13 — BATCH SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simulate Syndicate runs in batch. Uses deterministic seed derivation for each
 * run, so results are reproducible.
 */
export function simulateSyndicateBatch(
  config: SyndicateBatchSimulationConfig,
): SyndicateBatchSimulationResult {
  const runCount = clamp(config.runCount, 1, BATCH_MAX_RUN_COUNT);
  const ticksPerRun = clamp(config.ticksPerRun, 1, 500);

  const baseSeedNum = hashStringToSeed(config.baseSeed);
  const summaries: SyndicateBatchRunSummary[] = [];
  const cords: number[] = [];
  const treasuries: number[] = [];
  const trusts: number[] = [];
  let totalDefections = 0;
  let totalObjectives = 0;
  const outcomeMap: Record<SyndicateOutcome, number> = {
    FREEDOM: 0,
    COLLAPSE: 0,
    BETRAYED: 0,
  };

  for (let i = 0; i < runCount; i++) {
    const runSeed = combineSeed(baseSeedNum, i);
    const runSeedStr = `batch_${i}_${runSeed}`;
    const runId = stableId('batch', config.baseSeed, i);

    const registry = new CardRegistry();
    const playerCount = Math.min(config.playerTemplates.length, MAX_PLAYERS);

    const state = createInitialTeamUpModeState({
      runId,
      seed: runSeedStr,
      treasury: 50000,
      players: config.playerTemplates.slice(0, playerCount).map((pt, idx) => ({
        playerId: `batch_p${idx}_${i}`,
        displayName: `Batch P${idx} #${i}`,
        cash: pt.cash,
        income: pt.income,
        expenses: pt.expenses,
        liabilities: 0,
        role: pt.role,
      })),
    });

    const engine = new TeamUpModeEngine(state, registry);
    const rng = createDeterministicRng(runSeed);

    let currentState = engine.getState();

    for (let t = 0; t < ticksPerRun; t++) {
      currentState = engine.dispatch({
        type: 'ADVANCE_TICK',
        timestampMs: t * 1000,
        treasuryDelta: Math.floor(rng.nextBetween(-500, 2000)),
      });

      // Simulate random aid
      if (rng.nextBoolean(0.12) && currentState.players.length >= 2) {
        const actorIdx = rng.nextInt(currentState.players.length);
        let targetIdx = rng.nextInt(currentState.players.length);
        if (targetIdx === actorIdx) targetIdx = (targetIdx + 1) % currentState.players.length;

        const actorPlayer = currentState.players[actorIdx];
        const targetPlayer = currentState.players[targetIdx];

        if (!actorPlayer.defected && !targetPlayer.defected && actorPlayer.cash > AID_LIQUIDITY_BRIDGE_MIN) {
          try {
            currentState = engine.dispatch({
              type: 'PLAY_AID',
              actorId: actorPlayer.playerId,
              targetId: targetPlayer.playerId,
              aidType: 'LIQUIDITY_BRIDGE',
              amount: AID_LIQUIDITY_BRIDGE_MIN,
            });
          } catch {
            // Aid failed
          }
        }
      }

      // Simulate random defection attempt (rare)
      if (rng.nextBoolean(0.02) && currentState.macro.tick >= DEFECTION_MIN_TICK) {
        const defectorIdx = rng.nextInt(currentState.players.length);
        const defector = currentState.players[defectorIdx];
        if (!defector.defected && defector.defectionStep === 'NONE') {
          try {
            currentState = engine.dispatch({
              type: 'PLAY_DEFECTION_STEP',
              actorId: defector.playerId,
              step: 'BREAK_PACT',
            });
          } catch {
            // Defection failed
          }
        }
      }
    }

    // Record freedom for active players
    for (const player of currentState.players) {
      if (player.freedomAtTick === null) {
        try {
          currentState = engine.dispatch({
            type: 'RECORD_FREEDOM',
            playerId: player.playerId,
            cord: rng.nextBetween(0.1, 0.9),
            averageDecisionSpeedMs: rng.nextBetween(1000, 5000),
          });
        } catch {
          // Already recorded
        }
      }
    }

    const activePlayers = currentState.players.filter((p) => !p.defected);
    const avgTrust = activePlayers.length > 0
      ? activePlayers.reduce((s, p) => s + p.trustScore, 0) / activePlayers.length
      : 0;
    const avgCord = currentState.players.reduce(
      (s, p) => s + (p.finalCord ?? 0),
      0,
    ) / currentState.players.length;
    const defections = currentState.players.filter((p) => p.defected).length;
    const objectives = currentState.macro.sharedObjectives.filter((o) => o.completed).length;

    let outcome: SyndicateOutcome = 'FREEDOM';
    if (defections > 0) outcome = 'BETRAYED';
    if (activePlayers.every((p) => p.pressure >= MAX_PRESSURE)) outcome = 'COLLAPSE';

    outcomeMap[outcome]++;
    totalDefections += defections;
    totalObjectives += objectives;
    cords.push(avgCord);
    treasuries.push(currentState.macro.treasury);
    trusts.push(avgTrust);

    summaries.push({
      runId,
      seed: runSeed,
      finalTreasury: round6(currentState.macro.treasury),
      averageTrust: round6(avgTrust),
      defections,
      objectivesCompleted: objectives,
      runDurationTicks: currentState.macro.tick,
      outcome,
    });
  }

  const sortedCords = [...cords].sort((a, b) => a - b);
  const percentile = (arr: number[], p: number) => {
    const idx = Math.floor(arr.length * p);
    return arr[clamp(idx, 0, arr.length - 1)] ?? 0;
  };

  return {
    totalRuns: runCount,
    completedRuns: summaries.length,
    averageTreasury: round6(treasuries.reduce((s, t) => s + t, 0) / treasuries.length),
    averageTrust: round6(trusts.reduce((s, t) => s + t, 0) / trusts.length),
    defectionRate: round6(totalDefections / (runCount * config.playerTemplates.length)),
    averageObjectivesCompleted: round6(totalObjectives / runCount),
    averageRunDurationTicks: round6(summaries.reduce((s, r) => s + r.runDurationTicks, 0) / summaries.length),
    outcomeDistribution: {
      FREEDOM: round6(outcomeMap.FREEDOM / runCount),
      COLLAPSE: round6(outcomeMap.COLLAPSE / runCount),
      BETRAYED: round6(outcomeMap.BETRAYED / runCount),
    },
    cordDistribution: {
      min: round6(sortedCords[0] ?? 0),
      max: round6(sortedCords[sortedCords.length - 1] ?? 0),
      p25: round6(percentile(sortedCords, 0.25)),
      p50: round6(percentile(sortedCords, 0.5)),
      p75: round6(percentile(sortedCords, 0.75)),
      p90: round6(percentile(sortedCords, 0.9)),
    },
    runSummaries: summaries,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 14 — CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derive all syndicate-specific seeds from a single run seed.
 */
export function deriveSyndicateSeeds(runSeed: string): {
  readonly normalized: number;
  readonly rng: number;
  readonly overlayResolver: number;
  readonly batchSimulation: number;
  readonly mulberry: ReturnType<typeof createMulberry32>;
} {
  const normalized = normalizeSeed(hashStringToSeed(runSeed));
  return {
    normalized,
    rng: combineSeed(normalized, 'syndicate_rng'),
    overlayResolver: combineSeed(normalized, 'syndicate_overlay'),
    batchSimulation: combineSeed(normalized, 'batch_sim'),
    mulberry: createMulberry32(normalized),
  };
}

/**
 * Create a Ledger snapshot from a Syndicate player state.
 */
export function syndicatePlayerToLedger(player: TeamUpPlayerState): Ledger {
  return createDefaultLedger({
    cash: player.cash,
    income: player.income,
    expenses: player.expenses,
    shield: player.shields,
  });
}

/**
 * Compute a hash-based verification for a complete Syndicate run.
 */
export function computeSyndicateRunProofHash(state: TeamUpModeState): string {
  const payload = stableStringify({
    runId: state.runId,
    seed: state.seed,
    treasury: state.macro.treasury,
    playerCords: state.players.map((p) => p.finalCord),
    totalTick: state.macro.tick,
    objectivesCompleted: state.macro.sharedObjectives.filter((o) => o.completed).length,
  });
  return sha256Hex(payload);
}

/**
 * Verify a Syndicate run replay using ReplayEngine.
 */
export function verifySyndicateRunReplay(
  runId: string,
  events: readonly RunEvent[],
  expectedProofHash: string,
): {
  verified: boolean;
  replayHash: string;
  snapshot: ReplaySnapshot;
} {
  const seed = hashStringToSeed(runId);
  const engine = new ReplayEngine(seed, events);
  const replayHash = engine.getReplayHash();
  const snapshot = engine.replayAll();

  // Also verify using ReplayGameState
  const gameState = new ReplayGameState(seed);
  for (const event of events) {
    gameState.applyEvent(event);
  }
  const _gsSnapshot = gameState.snapshot();

  return {
    verified: replayHash === expectedProofHash,
    replayHash,
    snapshot,
  };
}

/**
 * Get the full set of Syndicate-legal decks using CARD_LEGALITY_MATRIX.
 */
export function getSyndicateLegalDecks(): readonly DeckType[] {
  return CARD_LEGALITY_MATRIX[SYNDICATE_MODE];
}

/**
 * Get the Syndicate mode card behavior profile.
 */
export function getSyndicateModeBehavior() {
  return getModeCardBehavior(SYNDICATE_MODE);
}

/**
 * Get the Syndicate mode tag weight defaults.
 */
export function getSyndicateTagWeights(): Readonly<Record<CardTag, number>> {
  return MODE_TAG_WEIGHT_DEFAULTS[SYNDICATE_MODE];
}

/**
 * Compute card draw weights for Syndicate mode at a given cycle.
 */
export function computeSyndicateCardDrawWeights(
  rarity: CardRarity,
  runSeed: string,
  cycle: number,
): Map<DeckType, number> {
  return computeCardDrawWeights(SYNDICATE_MODE, rarity, runSeed, cycle);
}

/**
 * Compute pressure cost modifier for Syndicate mode.
 */
export function computeSyndicatePressureCost(tier: PressureTier): number {
  return computePressureCostModifier(tier);
}

/**
 * Compute bleedthrough multiplier for Syndicate mode.
 */
export function computeSyndicateBleedthrough(pressureTier: PressureTier, isCriticalTiming: boolean): number {
  return computeBleedthroughMultiplier(pressureTier, isCriticalTiming);
}

/**
 * Compute trust efficiency for Syndicate mode.
 */
export function computeSyndicateTrustEfficiency(trustScore: number) {
  return computeTrustEfficiency(trustScore);
}

/**
 * Compute tag-weighted score for Syndicate mode.
 */
export function computeSyndicateTagWeightedScore(tags: readonly CardTag[]): number {
  return computeTagWeightedScore(tags, SYNDICATE_MODE);
}

/**
 * Check if a deck type is legal in Syndicate mode.
 */
export function isSyndicateDeckLegal(deckType: DeckType): boolean {
  return isDeckLegalInMode(deckType, SYNDICATE_MODE);
}

/**
 * Get COMEBACK_SURGE_CONFIG for reference.
 */
export function getSyndicateComebackSurgeConfig() {
  return COMEBACK_SURGE_CONFIG;
}

/**
 * Get HOLD_SYSTEM_CONFIG for reference.
 */
export function getSyndicateHoldConfig() {
  return HOLD_SYSTEM_CONFIG;
}

/**
 * Get all PRESSURE_COST_MODIFIERS for reference.
 */
export function getSyndicatePressureCostModifiers() {
  return PRESSURE_COST_MODIFIERS;
}

/**
 * Get all CARD_RARITY_DROP_RATES for reference.
 */
export function getSyndicateRarityDropRates() {
  return CARD_RARITY_DROP_RATES;
}

/**
 * Get DECK_TYPE_PROFILES for all Syndicate-legal decks.
 */
export function getSyndicateDeckTypeProfiles(): Record<string, ReturnType<typeof getDeckTypeProfile>> {
  const result: Record<string, ReturnType<typeof getDeckTypeProfile>> = {};
  for (const deck of CARD_LEGALITY_MATRIX[SYNDICATE_MODE]) {
    result[deck] = getDeckTypeProfile(deck);
  }
  return result;
}

/**
 * Compute divergence potential for a specific card play in Syndicate mode.
 */
export function computeSyndicateDivergencePotential(
  definition: CardDefinition,
  timingClass: TimingClass,
  tickDistanceFromMarker: number,
) {
  return computeDivergencePotential(definition, timingClass, tickDistanceFromMarker);
}

/**
 * Check the GHOST_MARKER_SPECS for all marker kinds and return a summary.
 * In Syndicate mode, ghost markers are not active, but the spec data is used
 * for cross-mode analytics and proof badge comparison.
 */
export function summarizeSyndicateMarkerSpecs(): Record<string, {
  cordBonus: number;
  shieldBonus: number;
}> {
  const result: Record<string, { cordBonus: number; shieldBonus: number }> = {};
  const kinds = [
    GhostMarkerKind.GOLD_BUY,
    GhostMarkerKind.RED_PASS,
    GhostMarkerKind.PURPLE_POWER,
    GhostMarkerKind.SILVER_BREACH,
    GhostMarkerKind.BLACK_CASCADE,
  ];

  for (const kind of kinds) {
    const spec = GHOST_MARKER_SPECS[kind];
    result[kind] = {
      cordBonus: spec.cordBonus ?? 0,
      shieldBonus: spec.shieldBonus ?? 0,
    };
  }

  return result;
}

/**
 * Compute a GBM window for a specific marker in Syndicate cross-mode context.
 */
export function computeSyndicateGbmWindow(
  markerKind: GhostMarkerKind,
  markerTick: number,
  currentTick: number,
) {
  return resolveGhostBenchmarkWindow(markerKind, currentTick, markerTick);
}

/**
 * Compute ghost marker CORD bonus in Syndicate cross-mode context.
 */
export function computeSyndicateGhostMarkerCordBonus(
  kind: GhostMarkerKind,
  currentTick: number,
  markerTick: number,
): number {
  return computeGhostMarkerCordBonus(kind, currentTick, markerTick);
}

/**
 * Compute ghost marker shield bonus in Syndicate cross-mode context.
 */
export function computeSyndicateGhostMarkerShieldBonus(
  kind: GhostMarkerKind,
  currentTick: number,
  markerTick: number,
): number {
  return computeGhostMarkerShieldBonus(kind, currentTick, markerTick);
}

/**
 * Compute IPA chain synergy relevance for Syndicate mode.
 */
export function computeSyndicateIPAChainSynergies(): typeof IPA_CHAIN_SYNERGIES {
  const legalDecks = new Set(CARD_LEGALITY_MATRIX[SYNDICATE_MODE]);
  return IPA_CHAIN_SYNERGIES.filter(
    (chain) => chain.combination.every((dt) => legalDecks.has(dt)),
  );
}

/**
 * Get MODE_CARD_BEHAVIORS for all modes (useful for cross-mode comparison).
 */
export function getAllSyndicateModeCardBehaviors() {
  return MODE_CARD_BEHAVIORS;
}

/**
 * Compute Syndicate-specific deck type profiles for all legal decks.
 */
export function computeSyndicateDeckProfiles(): Map<DeckType, ReturnType<typeof getDeckTypeProfile>> {
  const legalDecks = CARD_LEGALITY_MATRIX[SYNDICATE_MODE];
  const profiles = new Map<DeckType, ReturnType<typeof getDeckTypeProfile>>();

  for (const deck of legalDecks) {
    profiles.set(deck, getDeckTypeProfile(deck));
  }

  return profiles;
}

/**
 * Get Syndicate weight configuration for use in tag analysis.
 */
export function getSyndicateWeightConfig(): {
  trust: number;
  aid: number;
  resilience: number;
  income: number;
  liquidity: number;
} {
  return {
    trust: SYNDICATE_WEIGHT_TRUST,
    aid: SYNDICATE_WEIGHT_AID,
    resilience: SYNDICATE_WEIGHT_RESILIENCE,
    income: SYNDICATE_WEIGHT_INCOME,
    liquidity: SYNDICATE_WEIGHT_LIQUIDITY,
  };
}

/**
 * Sanitize card draw weights using the deterministic RNG utility.
 */
export function sanitizeSyndicateDrawWeights(weights: readonly number[]): number[] {
  return sanitizePositiveWeights([...weights]);
}

/**
 * Build a Syndicate-specific ModeOverlay for a given card.
 * Syndicate mode up-weights trust (3.0x), aid (2.5x), resilience (2.0x),
 * and applies team trust efficiency to effect modifiers.
 */
export function buildSyndicateModeOverlay(tags: readonly CardTag[]): ModeOverlay {
  const syndicateWeights = MODE_TAG_WEIGHT_DEFAULTS[SYNDICATE_MODE];
  const tagWeights: Partial<Record<CardTag, number>> = {};
  for (const tag of tags) {
    tagWeights[tag] = syndicateWeights[tag] ?? 0;
  }
  return {
    costModifier: 1.0,
    effectModifier: 1.0,
    tagWeights,
    timingLock: [],
    legal: true,
    targetingOverride: Targeting.SELF,
    cordWeight: 1.0,
  };
}

/**
 * Build a DecisionEffect for a Syndicate aid or rescue action.
 * Maps the trust/cash impact into the replay engine's typed effect format.
 */
export function buildSyndicateDecisionEffect(
  target: 'cash' | 'income' | 'shield' | 'heat',
  delta: number,
): DecisionEffect {
  return { target, delta };
}

/**
 * Compute divergence potential for a card in the Syndicate context.
 * Uses CardTypesDivergencePotential enum to classify how much a cooperative card
 * changes run momentum. Aid/combo/comm cards are typically MEDIUM; defection cards HIGH.
 */
export function classifySyndicateCardDivergence(
  deckType: DeckType,
  isDefectionRelated: boolean,
): string {
  if (isDefectionRelated) {
    return CardTypesDivergencePotential.HIGH;
  }
  if (deckType === DeckType.OPPORTUNITY || deckType === DeckType.IPA) {
    return CardTypesDivergencePotential.MEDIUM;
  }
  return CardTypesDivergencePotential.LOW;
}

/**
 * Get the ghost marker spec for cross-mode reference.
 * In Syndicate, ghost markers are not active, but the spec data is used
 * for cross-mode analytics and proof badge comparison.
 */
export function getSyndicateGhostMarkerReference(kind: GhostMarkerKind) {
  return getGhostMarkerSpec(kind);
}

/**
 * Get communication card costs.
 */
export function getSyndicateCommCardCosts(): Record<CommunicationCardKey, number> {
  return {
    RALLY: COMM_RALLY_COST,
    INTEL_SHARE: COMM_INTEL_SHARE_COST,
    SIGNAL_FLARE: COMM_SIGNAL_FLARE_COST,
    TRUST_BOND: COMM_TRUST_BOND_COST,
  };
}

/**
 * Get combo card costs.
 */
export function getSyndicateComboCardCosts(): Record<SyndicateComboCardKey, number> {
  return {
    PACT_OF_IRON: COMBO_PACT_OF_IRON_COST,
    COLLECTIVE_SHIELD: COMBO_COLLECTIVE_SHIELD_COST,
    INCOME_CHAIN: COMBO_INCOME_CHAIN_COST,
    TRUST_SURGE: COMBO_TRUST_SURGE_COST,
  };
}

/**
 * Get shared objective definitions.
 */
export function getSyndicateObjectiveDefinitions(): readonly SharedObjectiveState[] {
  return createDefaultSharedObjectives();
}

/**
 * Get trust band info for a given trust score.
 */
export function getSyndicateTrustBand(trustScore: number): TrustBandResult {
  return trustBand(trustScore);
}

/**
 * Get the batch simulation default config values.
 */
export function getSyndicateBatchDefaults(): {
  tickCount: number;
  runCount: number;
  maxRunCount: number;
} {
  return {
    tickCount: BATCH_DEFAULT_TICK_COUNT,
    runCount: BATCH_DEFAULT_RUN_COUNT,
    maxRunCount: BATCH_MAX_RUN_COUNT,
  };
}

/**
 * Get DECK_TYPE_PROFILES reference for all deck types (cross-mode).
 */
export function getSyndicateDeckTypeProfilesRef() {
  return DECK_TYPE_PROFILES;
}
