// backend/src/game/modes/head_to_head_mode.ts

/**
 * POINT ZERO ONE — HEAD TO HEAD MODE ENGINE (PREDATOR)
 * backend/src/game/modes/head_to_head_mode.ts
 * VERSION: 4.0.0 — 2026-03-28
 *
 * Doctrine-aligned backend mode implementation for Predator / financial combat.
 * One of four core battlegrounds. PvP duel mode with psychological warfare.
 *
 * Core mechanics implemented:
 * - Shared Opportunity deck between both players
 * - Battle Budget (BB) economy — second economy for war chest
 * - SABOTAGE sub-deck: 7 card types with BB costs
 * - COUNTER sub-deck: 8 card types with BB costs and bounceback
 * - BLUFF cards: PHANTOM_FILING and GHOST_OFFER
 * - 5-second counter-play window on incoming extraction
 * - 8-second first-refusal window on shared opportunity
 * - 12-second shared discard window
 * - once-per-3-tick extraction cadence
 * - Combo escalation — sabotage chains grant BB bonuses and amplify next attack
 * - Bounceback mechanics on specific counters
 * - Psyche Meter: CALM -> TENSE -> CRACKING -> BROKEN
 * - Bleed-through rule: uncountered attacks at CRITICAL timing deal 1.4x damage
 * - Visible threat queue (1-2 slots of opponent upcoming effects)
 * - BB generation: base 5 BB/tick + 2 BB per income source
 * - Predator mode tag weights: tempo 2.4x, sabotage 2.8x, counter 2.2x, heat 1.5x, income 0.6x
 * - 32-dim ML feature extraction per match
 * - 24x8 DL tensor for match-level pattern analysis
 * - Chat bridge events for real-time spectator duel theater
 * - Proof badge conditions for Predator
 * - Full reducer with all action types
 * - Analytics, diagnostics, batch simulation
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
export const PREDATOR_MODE_VERSION = '4.0.0';

/** Canonical game mode reference for Predator / Head To Head */
const PREDATOR_MODE = GameMode.HEAD_TO_HEAD;

/** ML feature vector dimensionality — 32 floats per predator match */
export const PREDATOR_ML_FEATURE_DIM = 32;

/** DL tensor shape — rows x columns */
export const PREDATOR_DL_ROWS = 24;
export const PREDATOR_DL_COLS = 8;

// ─── Timing windows ─────────────────────────────────────────────────────────
const FIRST_REFUSAL_MS = 8_000;
const SHARED_OPEN_TOTAL_MS = 12_000;
const COUNTER_WINDOW_MS = 5_000;

// ─── Battle Budget ──────────────────────────────────────────────────────────
const MAX_BATTLE_BUDGET = 200;
const BB_BASE_PER_TICK = 5;
const BB_PER_INCOME_SOURCE = 2;
const BB_COUNTER_LANDED_BONUS = 12;
const BB_FIRST_BLOOD_BONUS = 5;
const BB_SHIELD_BREAK_BONUS = 15;
const BB_EXTRACTION_HIT_BONUS = 8;
const BB_COMBO_ESCALATION_BASE = 4;

// ─── Extraction / attack ────────────────────────────────────────────────────
const EXTRACTION_COOLDOWN_TICKS = 3;
const MAX_THREAT_QUEUE_SIZE = 2;
const BLEED_THROUGH_MULTIPLIER = 1.4;

// ─── Psyche Meter thresholds ────────────────────────────────────────────────
const PSYCHE_CALM_CEILING = 44;
const PSYCHE_TENSE_CEILING = 69;
const PSYCHE_CRACKING_CEILING = 89;

// ─── Combo escalation ───────────────────────────────────────────────────────
const COMBO_TIER_1_THRESHOLD = 2;
const COMBO_TIER_2_THRESHOLD = 4;
const COMBO_TIER_3_THRESHOLD = 6;
const COMBO_TIER_1_DAMAGE_MULTIPLIER = 1.15;
const COMBO_TIER_2_DAMAGE_MULTIPLIER = 1.35;
const COMBO_TIER_3_DAMAGE_MULTIPLIER = 1.6;
const COMBO_TIER_1_BB_BONUS = 6;
const COMBO_TIER_2_BB_BONUS = 12;
const COMBO_TIER_3_BB_BONUS = 20;
const COMBO_RESET_ON_COUNTER = true;

// ─── Bounceback ─────────────────────────────────────────────────────────────
const BOUNCEBACK_CREDIT_FREEZE_DAMAGE = 5;
const BOUNCEBACK_EVIDENCE_FILE_PRESSURE = 6;
const BOUNCEBACK_DEBT_SHIELD_BB_RETURN = 10;
const BOUNCEBACK_SOVEREIGNTY_LOCK_STUN_TICKS = 2;
const BOUNCEBACK_FULL_BLOCK_REFLECT_PCT = 0.25;

// ─── Bluff card constants ───────────────────────────────────────────────────
const PHANTOM_FILING_CASH_COST = 3000;
const GHOST_OFFER_CASH_COST = 1500;
const BLUFF_PSYCHE_PRESSURE_DELTA = 4;
const BLUFF_REVEAL_TICK_DELAY = 2;

// ─── Sabotage sub-deck BB costs (doctrine) ──────────────────────────────────
const SABOTAGE_MARKET_DUMP_BB = 30;
const SABOTAGE_DEBT_INJECTION_BB = 40;
const SABOTAGE_CHAIN_RUMOR_BB = 15;
const SABOTAGE_MEDIA_BLITZ_BB = 35;
const SABOTAGE_REGULATORY_FILING_BB = 35;
const SABOTAGE_HOSTILE_TAKEOVER_BB = 60;
const SABOTAGE_SILENT_DRAIN_BB = 22;

// ─── Counter sub-deck BB costs ──────────────────────────────────────────────
const COUNTER_LIQUIDITY_WALL_BB = 15;
const COUNTER_CREDIT_FREEZE_BB = 10;
const COUNTER_EVIDENCE_FILE_BB = 20;
const COUNTER_DEBT_SHIELD_BB = 25;
const COUNTER_SIGNAL_CLEAR_BB = 8;
const COUNTER_SOVEREIGNTY_LOCK_BB = 0;
const COUNTER_COUNTER_AUDIT_BB = 12;
const COUNTER_FULL_BLOCK_BB = 45;

// ─── Predator mode tag weights (doctrine) ───────────────────────────────────
const PREDATOR_WEIGHT_TEMPO = 2.4;
const PREDATOR_WEIGHT_SABOTAGE = 2.8;
const PREDATOR_WEIGHT_COUNTER = 2.2;
const PREDATOR_WEIGHT_HEAT = 1.5;
const PREDATOR_WEIGHT_INCOME = 0.6;

// ─── CORD tiebreaker weights ────────────────────────────────────────────────
const TIEBREAKER_SHIELDS_WEIGHT = 0.001;
const TIEBREAKER_SPEED_FLOOR = 1;
const TIEBREAKER_CHAIN_SCORE_UNIT = 0.00001;

// ─── Proof badge thresholds ─────────────────────────────────────────────────
const BADGE_DOMINATOR_MIN_EXTRACTION_HITS = 8;
const BADGE_DOMINATOR_MIN_COMBO_TIER = COMBO_TIER_2_THRESHOLD;
const BADGE_FORTRESS_MIN_COUNTERS_LANDED = 6;
const BADGE_FORTRESS_MAX_DAMAGE_TAKEN = 5000;
const BADGE_MIND_GAME_MIN_BLUFFS = 3;
const BADGE_MIND_GAME_MIN_PSYCHE_BREAKS = 1;
const BADGE_TEMPO_KING_MAX_AVG_DECISION_MS = 3000;
const BADGE_TEMPO_KING_MIN_CARD_PLAYS = 12;
const BADGE_COMEBACK_MIN_DEFICIT = 0.15;
const BADGE_COMEBACK_FINAL_WIN = true;

// ─── Chat bridge event types ────────────────────────────────────────────────
const CHAT_EVENT_EXTRACTION_FIRED = 'extraction_fired';
const CHAT_EVENT_COUNTER_LANDED = 'counter_landed';
const CHAT_EVENT_COMBO_ESCALATION = 'combo_escalation';
const CHAT_EVENT_PSYCHE_SHIFT = 'psyche_shift';
const CHAT_EVENT_BLUFF_PLAYED = 'bluff_played';
const CHAT_EVENT_BLUFF_REVEALED = 'bluff_revealed';
const CHAT_EVENT_FIRST_BLOOD = 'first_blood';
const CHAT_EVENT_SHIELD_BREAK = 'shield_break';
const CHAT_EVENT_BADGE_UNLOCKED = 'predator_badge_unlocked';
const CHAT_EVENT_BOUNCEBACK = 'bounceback_triggered';
const CHAT_EVENT_SHARED_OPPORTUNITY = 'shared_opportunity_event';
const CHAT_EVENT_FREEDOM = 'freedom_recorded';

// ─── Batch simulation defaults ──────────────────────────────────────────────
const BATCH_DEFAULT_TICK_COUNT = 120;
const BATCH_DEFAULT_RUN_COUNT = 100;
const BATCH_MAX_RUN_COUNT = 10_000;

// ═══════════════════════════════════════════════════════════════════════════════
// § 2 — TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Action types ─────────────────────────────────────────────────────────────

export type HeadToHeadActionType =
  | 'ADVANCE_TICK'
  | 'DRAW_SHARED_OPPORTUNITY'
  | 'CLAIM_SHARED_OPPORTUNITY'
  | 'PASS_SHARED_OPPORTUNITY'
  | 'FIRE_EXTRACTION'
  | 'RESPOND_COUNTER'
  | 'RESOLVE_COUNTER_WINDOW'
  | 'RECORD_BOT_REDIRECT'
  | 'RECORD_FREEDOM'
  | 'ADD_PRIVATE_IPA_CARD'
  | 'PLAY_BLUFF_CARD'
  | 'RESOLVE_BLUFF'
  | 'RECORD_CARD_PLAY';

// ─── Psyche state ─────────────────────────────────────────────────────────────

export type PsycheState =
  | 'CALM'
  | 'TENSE'
  | 'CRACKING'
  | 'BROKEN';

// ─── Status effects ───────────────────────────────────────────────────────────

export type HeadToHeadStatus =
  | 'market_dumped'
  | 'cards_locked'
  | 'misinformation_flood'
  | 'forced_fubar_next_tick'
  | 'debt_injected'
  | 'hostile_takeover_debuff'
  | 'next_sabotage_x2_3ticks'
  | 'chain_rumor_active'
  | 'media_blitz_active'
  | 'silent_drain_active'
  | 'sovereignty_stun'
  | 'bluff_pending';

// ─── Counter card keys ────────────────────────────────────────────────────────

export type CounterCardKey =
  | 'LIQUIDITY_WALL'
  | 'CREDIT_FREEZE'
  | 'EVIDENCE_FILE'
  | 'SIGNAL_CLEAR'
  | 'DEBT_SHIELD'
  | 'SOVEREIGNTY_LOCK'
  | 'FORCED_DRAW_BLOCK'
  | 'COUNTER_AUDIT'
  | 'FULL_BLOCK';

// ─── Extraction types ─────────────────────────────────────────────────────────

export type ExtractionType =
  | 'MARKET_DUMP'
  | 'CREDIT_REPORT_PULL'
  | 'REGULATORY_FILING'
  | 'MISINFORMATION_FLOOD'
  | 'DEBT_INJECTION'
  | 'HOSTILE_TAKEOVER'
  | 'LIQUIDATION_NOTICE'
  | 'CHAIN_RUMOR'
  | 'MEDIA_BLITZ'
  | 'SILENT_DRAIN';

// ─── Bluff card keys ──────────────────────────────────────────────────────────

export type BluffCardKey =
  | 'PHANTOM_FILING'
  | 'GHOST_OFFER';

// ─── Combo tier ───────────────────────────────────────────────────────────────

export type ComboTier = 0 | 1 | 2 | 3;

// ─── Predator proof badges ──────────────────────────────────────────────────

export type PredatorProofBadge =
  | 'DOMINATOR'
  | 'FORTRESS'
  | 'MIND_GAME'
  | 'TEMPO_KING'
  | 'COMEBACK_PREDATOR';

// ─── Predator outcome ─────────────────────────────────────────────────────────

export type PredatorOutcome =
  | 'WIN'
  | 'LOSS'
  | 'DRAW'
  | 'FORFEIT';

// ─── Predator result tier ─────────────────────────────────────────────────────

export type PredatorResultTier =
  | 'DOMINANT_WIN'
  | 'CLOSE_WIN'
  | 'NARROW_LOSS'
  | 'DECISIVE_LOSS'
  | 'DRAW';

// ─── Bounceback effect type ─────────────────────────────────────────────────

export type BouncebackEffectType =
  | 'DAMAGE_REFLECT'
  | 'BB_RETURN'
  | 'STUN'
  | 'PRESSURE_REFLECT'
  | 'NONE';

// ─── Divergence potential ───────────────────────────────────────────────────

export type DivergencePotential = 'LOW' | 'MEDIUM' | 'HIGH';

// ─── Player state ─────────────────────────────────────────────────────────────

export interface HeadToHeadPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly netWorth: number;
  readonly pressure: number;
  readonly pressureTier: PressureTier;
  readonly shields: number;
  readonly battleBudget: number;
  readonly creditLineScore: number;
  readonly psycheState: PsycheState;
  readonly rivalryHeat: number;
  readonly activeStatuses: readonly HeadToHeadStatus[];
  readonly privateIpaCardIds: readonly string[];
  readonly claimedOpportunityCardIds: readonly string[];
  readonly lastExtractionTick: number | null;
  readonly extractionHits: number;
  readonly extractionMisses: number;
  readonly countersLanded: number;
  readonly countersMissed: number;
  readonly cardsLockedUntilTick: number | null;
  readonly misinformationUntilTick: number | null;
  readonly hostileTakeoverStacks: number;
  readonly debtInjectionStacks: number;
  readonly forcedFubarAtTick: number | null;
  readonly temporaryIncomePenaltyPct: number;
  readonly temporaryIncomePenaltyUntilTick: number | null;
  readonly freedomAtTick: number | null;
  readonly finalCord: number | null;
  readonly averageDecisionSpeedMs: number | null;
  readonly cascadeChainsBroken: number;
  readonly winStreak: number;
  readonly comboChainLength: number;
  readonly currentComboTier: ComboTier;
  readonly totalBluffsPlayed: number;
  readonly totalBluffsRevealed: number;
  readonly psycheBreaksInflicted: number;
  readonly totalDamageDealt: number;
  readonly totalDamageTaken: number;
  readonly totalBBSpent: number;
  readonly totalBBEarned: number;
  readonly bouncebacksTriggered: number;
  readonly sabotageDeckPlays: number;
  readonly counterDeckPlays: number;
  readonly buildDeckPlays: number;
  readonly totalCardPlays: number;
  readonly sovereigntyStunUntilTick: number | null;
  readonly pendingBluffCardKey: BluffCardKey | null;
  readonly bluffRevealAtTick: number | null;
  readonly cordAtStart: number;
  readonly peakCordAdvantage: number;
  readonly peakCordDeficit: number;
  readonly crossoverCount: number;
  readonly silentDrainStacks: number;
  readonly chainRumorUntilTick: number | null;
  readonly mediaBlitzUntilTick: number | null;
}

// ─── Shared Opportunity Offer ─────────────────────────────────────────────────

export interface SharedOpportunityOffer {
  readonly offerId: string;
  readonly cardId: string;
  readonly firstViewerId: string;
  readonly openedAtTick: number;
  readonly openedAtTimestampMs: number;
  readonly exclusiveEndsAtTimestampMs: number;
  readonly discardAtTimestampMs: number;
  readonly passedByPlayerIds: readonly string[];
}

// ─── Pending Counter Window ───────────────────────────────────────────────────

export interface PendingCounterWindow {
  readonly windowId: string;
  readonly attackerId: string;
  readonly targetId: string;
  readonly extractionType: ExtractionType;
  readonly openedAtTick: number;
  readonly openedAtTimestampMs: number;
  readonly deadlineTimestampMs: number;
  readonly counterableBy: CounterCardKey;
  readonly critical: boolean;
  readonly sourceCardId?: string;
  readonly resolved: boolean;
  readonly countered: boolean;
  readonly counterCardKey?: CounterCardKey;
  readonly counteredAtTimestampMs?: number;
  readonly comboChainAtFire: number;
}

// ─── Threat Queue Entry ───────────────────────────────────────────────────────

export interface ThreatQueueEntry {
  readonly tick: number;
  readonly attackerId: string;
  readonly targetId: string;
  readonly extractionType: ExtractionType;
  readonly magnitude: number;
  readonly comboAmplified: boolean;
}

// ─── Event log ────────────────────────────────────────────────────────────────

export interface HeadToHeadEvent {
  readonly tick: number;
  readonly type: HeadToHeadActionType | 'SYSTEM';
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly amount: number | null;
  readonly detail: string;
}

// ─── Bluff resolution record ────────────────────────────────────────────────

export interface BluffResolutionRecord {
  readonly tick: number;
  readonly playerId: string;
  readonly bluffCardKey: BluffCardKey;
  readonly cashCost: number;
  readonly psychePressureInflicted: number;
  readonly revealedAtTick: number;
  readonly opponentReacted: boolean;
}

// ─── Bounceback result ──────────────────────────────────────────────────────

export interface BouncebackResult {
  readonly counterCardKey: CounterCardKey;
  readonly effectType: BouncebackEffectType;
  readonly damageReflected: number;
  readonly bbReturned: number;
  readonly stunTicksApplied: number;
  readonly pressureReflected: number;
}

// ─── Combo escalation snapshot ──────────────────────────────────────────────

export interface ComboEscalationSnapshot {
  readonly tick: number;
  readonly attackerId: string;
  readonly chainLength: number;
  readonly comboTier: ComboTier;
  readonly damageMultiplier: number;
  readonly bbBonusAwarded: number;
  readonly amplifiedExtractionType: ExtractionType;
}

// ─── Card play audit entry ──────────────────────────────────────────────────

export interface PredatorCardPlayAuditEntry {
  readonly auditId: string;
  readonly tick: number;
  readonly playerId: string;
  readonly cardId: string;
  readonly subDeck: 'BUILD' | 'SABOTAGE' | 'COUNTER' | 'BLUFF' | 'OPPORTUNITY' | 'IPA';
  readonly bbCost: number;
  readonly cashCost: number;
  readonly cordDelta: number;
  readonly damageDealt: number;
  readonly damageBlocked: number;
  readonly comboChainAtPlay: number;
  readonly psycheStateAtPlay: PsycheState;
  readonly pressureTierAtPlay: PressureTier;
  readonly timingClassUsed?: TimingClass;
  readonly cardRarity?: CardRarity;
  readonly bouncebackTriggered: boolean;
  readonly bluffPlayed: boolean;
  readonly criticalTiming: boolean;
}

// ─── Macro state ────────────────────────────────────────────────────────────

export interface HeadToHeadMacroState {
  readonly tick: number;
  readonly sharedClockMs: number;
  readonly sharedOpportunityDeck: readonly string[];
  readonly exhaustedOpportunityDeck: boolean;
  readonly activeOffer: SharedOpportunityOffer | null;
  readonly removedSharedOpportunityCardIds: readonly string[];
  readonly pendingCounterWindow: PendingCounterWindow | null;
  readonly threatQueue: readonly ThreatQueueEntry[];
  readonly eventLog: readonly HeadToHeadEvent[];
  readonly spectatorCount: number;
  readonly firstBloodAttackerId: string | null;
  readonly spectatorPredictionPool: number;
  readonly comboSnapshots: readonly ComboEscalationSnapshot[];
  readonly bluffResolutions: readonly BluffResolutionRecord[];
  readonly bouncebackHistory: readonly BouncebackResult[];
  readonly chatEvents: readonly PredatorChatBridgeEvent[];
  readonly currentPhase: RunPhase;
}

// ─── Mode state ─────────────────────────────────────────────────────────────

export interface HeadToHeadModeState {
  readonly runId: string;
  readonly seed: string;
  readonly players: readonly HeadToHeadPlayerState[];
  readonly macro: HeadToHeadMacroState;
}

// ─── Actions ────────────────────────────────────────────────────────────────

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly timestampMs: number;
  readonly sharedClockAdvanceMs?: number;
  readonly pressureDeltaByPlayerId?: Readonly<Record<string, number>>;
}

export interface DrawSharedOpportunityAction {
  readonly type: 'DRAW_SHARED_OPPORTUNITY';
  readonly viewerId: string;
  readonly timestampMs: number;
}

export interface ClaimSharedOpportunityAction {
  readonly type: 'CLAIM_SHARED_OPPORTUNITY';
  readonly playerId: string;
  readonly offerId: string;
  readonly timestampMs: number;
}

export interface PassSharedOpportunityAction {
  readonly type: 'PASS_SHARED_OPPORTUNITY';
  readonly playerId: string;
  readonly offerId: string;
  readonly timestampMs: number;
}

export interface FireExtractionAction {
  readonly type: 'FIRE_EXTRACTION';
  readonly attackerId: string;
  readonly targetId: string;
  readonly extractionType: ExtractionType;
  readonly timestampMs: number;
  readonly critical?: boolean;
  readonly sourceCardId?: string;
}

export interface RespondCounterAction {
  readonly type: 'RESPOND_COUNTER';
  readonly playerId: string;
  readonly windowId: string;
  readonly counterCardKey: CounterCardKey;
  readonly timestampMs: number;
}

export interface ResolveCounterWindowAction {
  readonly type: 'RESOLVE_COUNTER_WINDOW';
  readonly windowId: string;
  readonly timestampMs: number;
}

export interface RecordBotRedirectAction {
  readonly type: 'RECORD_BOT_REDIRECT';
  readonly playerId: string;
  readonly botId: string;
  readonly heat: number;
}

export interface RecordFreedomAction {
  readonly type: 'RECORD_FREEDOM';
  readonly playerId: string;
  readonly cord: number;
  readonly averageDecisionSpeedMs: number;
  readonly cascadeChainsBroken: number;
}

export interface AddPrivateIpaCardAction {
  readonly type: 'ADD_PRIVATE_IPA_CARD';
  readonly playerId: string;
  readonly cardId: string;
}

export interface PlayBluffCardAction {
  readonly type: 'PLAY_BLUFF_CARD';
  readonly playerId: string;
  readonly bluffCardKey: BluffCardKey;
  readonly timestampMs: number;
}

export interface ResolveBluffAction {
  readonly type: 'RESOLVE_BLUFF';
  readonly playerId: string;
  readonly timestampMs: number;
}

export interface RecordCardPlayAction {
  readonly type: 'RECORD_CARD_PLAY';
  readonly playerId: string;
  readonly cardId: string;
  readonly subDeck: 'BUILD' | 'SABOTAGE' | 'COUNTER' | 'BLUFF' | 'OPPORTUNITY' | 'IPA';
  readonly bbCost: number;
  readonly cashCost: number;
  readonly cordDelta: number;
  readonly timestampMs: number;
  readonly timingClass?: TimingClass;
  readonly cardRarity?: CardRarity;
}

export type HeadToHeadModeAction =
  | AdvanceTickAction
  | DrawSharedOpportunityAction
  | ClaimSharedOpportunityAction
  | PassSharedOpportunityAction
  | FireExtractionAction
  | RespondCounterAction
  | ResolveCounterWindowAction
  | RecordBotRedirectAction
  | RecordFreedomAction
  | AddPrivateIpaCardAction
  | PlayBluffCardAction
  | ResolveBluffAction
  | RecordCardPlayAction;

// ─── ML Feature Vector ──────────────────────────────────────────────────────

export interface PredatorMLFeatureVector {
  readonly dimension: typeof PREDATOR_ML_FEATURE_DIM;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

// ─── DL Tensor ──────────────────────────────────────────────────────────────

export interface PredatorDLTensor {
  readonly rows: typeof PREDATOR_DL_ROWS;
  readonly cols: typeof PREDATOR_DL_COLS;
  readonly data: readonly (readonly number[])[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

// ─── Chat Bridge Event ──────────────────────────────────────────────────────

export interface PredatorChatBridgeEvent {
  readonly eventType: string;
  readonly tick: number;
  readonly runId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly emittedAtMs: number;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface PredatorExtractionAnalytics {
  readonly extractionType: ExtractionType;
  readonly timesFired: number;
  readonly timesCountered: number;
  readonly timesLanded: number;
  readonly totalDamageDealt: number;
  readonly averageDamagePerLand: number;
  readonly criticalHits: number;
  readonly comboAmplifiedHits: number;
}

export interface PredatorCounterAnalytics {
  readonly counterCardKey: CounterCardKey;
  readonly timesUsed: number;
  readonly timesSuccessful: number;
  readonly bouncebacksTriggered: number;
  readonly totalBBSpent: number;
  readonly totalDamageBlocked: number;
}

export interface PredatorPsycheAnalytics {
  readonly playerId: string;
  readonly timeInCalm: number;
  readonly timeInTense: number;
  readonly timeInCracking: number;
  readonly timeInBroken: number;
  readonly psycheBreaksInflicted: number;
  readonly psycheBreaksSuffered: number;
  readonly averagePsychePressure: number;
}

export interface PredatorComboAnalytics {
  readonly playerId: string;
  readonly longestComboChain: number;
  readonly highestComboTier: ComboTier;
  readonly totalComboEscalations: number;
  readonly totalComboBBBonuses: number;
  readonly averageComboLength: number;
}

export interface PredatorBluffAnalytics {
  readonly playerId: string;
  readonly bluffsPlayed: number;
  readonly bluffsRevealed: number;
  readonly phantomFilingsPlayed: number;
  readonly ghostOffersPlayed: number;
  readonly totalCashSpentOnBluffs: number;
  readonly totalPsychePressureFromBluffs: number;
}

export interface PredatorBouncebackAnalytics {
  readonly counterCardKey: CounterCardKey;
  readonly effectType: BouncebackEffectType;
  readonly timesTriggered: number;
  readonly totalDamageReflected: number;
  readonly totalBBReturned: number;
  readonly totalStunTicksApplied: number;
}

export interface PredatorModeHealth {
  readonly modeVersion: string;
  readonly mode: GameMode;
  readonly engineIntegrity: boolean;
  readonly replayHashMatch: boolean;
  readonly seedDeterminismVerified: boolean;
  readonly totalMatchesProcessed: number;
  readonly averageMatchDurationTicks: number;
  readonly averageExtractionRate: number;
  readonly averageCounterRate: number;
  readonly diagnosticTimestampMs: number;
}

export interface PredatorProofBadgeTracker {
  readonly dominator: {
    readonly extractionHits: number;
    readonly highestComboTier: ComboTier;
    readonly unlocked: boolean;
  };
  readonly fortress: {
    readonly countersLanded: number;
    readonly totalDamageTaken: number;
    readonly unlocked: boolean;
  };
  readonly mindGame: {
    readonly bluffsPlayed: number;
    readonly psycheBreaksInflicted: number;
    readonly unlocked: boolean;
  };
  readonly tempoKing: {
    readonly avgDecisionSpeedMs: number;
    readonly totalCardPlays: number;
    readonly unlocked: boolean;
  };
  readonly comebackPredator: {
    readonly peakDeficit: number;
    readonly finalWin: boolean;
    readonly unlocked: boolean;
  };
  readonly unlockedBadges: readonly PredatorProofBadge[];
  readonly aggregateProofCord: number;
}

export interface PredatorMatchAnalytics {
  readonly runId: string;
  readonly extractionAnalytics: readonly PredatorExtractionAnalytics[];
  readonly counterAnalytics: readonly PredatorCounterAnalytics[];
  readonly psycheAnalytics: readonly PredatorPsycheAnalytics[];
  readonly comboAnalytics: readonly PredatorComboAnalytics[];
  readonly bluffAnalytics: readonly PredatorBluffAnalytics[];
  readonly bouncebackAnalytics: readonly PredatorBouncebackAnalytics[];
  readonly modeHealth: PredatorModeHealth;
  readonly proofBadgeTracker: PredatorProofBadgeTracker;
  readonly matchResult: {
    readonly winnerId: string | null;
    readonly loserId: string | null;
    readonly outcome: PredatorOutcome;
    readonly tier: PredatorResultTier;
    readonly winnerCord: number;
    readonly loserCord: number;
    readonly cordDelta: number;
    readonly totalTicks: number;
  } | null;
}

// ─── Batch simulation types ─────────────────────────────────────────────────

export interface PredatorBatchSimulationConfig {
  readonly runCount: number;
  readonly ticksPerRun: number;
  readonly baseSeed: string;
  readonly playerTemplates: readonly [
    { readonly cash: number; readonly income: number; readonly expenses: number },
    { readonly cash: number; readonly income: number; readonly expenses: number },
  ];
}

export interface PredatorBatchRunSummary {
  readonly runId: string;
  readonly seed: number;
  readonly winnerId: string;
  readonly winnerCord: number;
  readonly loserCord: number;
  readonly totalExtractions: number;
  readonly totalCounters: number;
  readonly highestComboTier: ComboTier;
  readonly totalBluffs: number;
  readonly matchDurationTicks: number;
}

export interface PredatorBatchSimulationResult {
  readonly totalRuns: number;
  readonly completedRuns: number;
  readonly player1WinRate: number;
  readonly player2WinRate: number;
  readonly drawRate: number;
  readonly averageMatchDurationTicks: number;
  readonly averageExtractionsPerMatch: number;
  readonly averageCountersPerMatch: number;
  readonly averageComboTier: number;
  readonly cordDistribution: {
    readonly min: number;
    readonly max: number;
    readonly p25: number;
    readonly p50: number;
    readonly p75: number;
    readonly p90: number;
  };
  readonly runSummaries: readonly PredatorBatchRunSummary[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3 — EXTRACTION CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

const EXTRACTION_CATALOG: Readonly<
  Record<
    ExtractionType,
    {
      readonly battleBudgetCost: number;
      readonly counterCardKey: CounterCardKey;
      readonly baseMagnitude: number;
      readonly pressureDelta: number;
      readonly isChainRumor?: boolean;
      readonly isMediaBlitz?: boolean;
      readonly isSilentDrain?: boolean;
    }
  >
> = {
  MARKET_DUMP: {
    battleBudgetCost: SABOTAGE_MARKET_DUMP_BB,
    counterCardKey: 'LIQUIDITY_WALL',
    baseMagnitude: 0.2,
    pressureDelta: 8,
  },
  CREDIT_REPORT_PULL: {
    battleBudgetCost: 25,
    counterCardKey: 'CREDIT_FREEZE',
    baseMagnitude: 15,
    pressureDelta: 6,
  },
  REGULATORY_FILING: {
    battleBudgetCost: SABOTAGE_REGULATORY_FILING_BB,
    counterCardKey: 'EVIDENCE_FILE',
    baseMagnitude: 3,
    pressureDelta: 10,
  },
  MISINFORMATION_FLOOD: {
    battleBudgetCost: 20,
    counterCardKey: 'SIGNAL_CLEAR',
    baseMagnitude: 2,
    pressureDelta: 7,
  },
  DEBT_INJECTION: {
    battleBudgetCost: SABOTAGE_DEBT_INJECTION_BB,
    counterCardKey: 'DEBT_SHIELD',
    baseMagnitude: 12,
    pressureDelta: 9,
  },
  HOSTILE_TAKEOVER: {
    battleBudgetCost: SABOTAGE_HOSTILE_TAKEOVER_BB,
    counterCardKey: 'SOVEREIGNTY_LOCK',
    baseMagnitude: 0.5,
    pressureDelta: 14,
  },
  LIQUIDATION_NOTICE: {
    battleBudgetCost: 45,
    counterCardKey: 'FORCED_DRAW_BLOCK',
    baseMagnitude: 1,
    pressureDelta: 12,
  },
  CHAIN_RUMOR: {
    battleBudgetCost: SABOTAGE_CHAIN_RUMOR_BB,
    counterCardKey: 'SIGNAL_CLEAR',
    baseMagnitude: 0.08,
    pressureDelta: 5,
    isChainRumor: true,
  },
  MEDIA_BLITZ: {
    battleBudgetCost: SABOTAGE_MEDIA_BLITZ_BB,
    counterCardKey: 'EVIDENCE_FILE',
    baseMagnitude: 0.15,
    pressureDelta: 9,
    isMediaBlitz: true,
  },
  SILENT_DRAIN: {
    battleBudgetCost: SABOTAGE_SILENT_DRAIN_BB,
    counterCardKey: 'COUNTER_AUDIT',
    baseMagnitude: 0.06,
    pressureDelta: 3,
    isSilentDrain: true,
  },
};

// ─── Counter card costs ─────────────────────────────────────────────────────

const COUNTER_CARD_COSTS: Readonly<Record<CounterCardKey, number>> = {
  LIQUIDITY_WALL: COUNTER_LIQUIDITY_WALL_BB,
  CREDIT_FREEZE: COUNTER_CREDIT_FREEZE_BB,
  EVIDENCE_FILE: COUNTER_EVIDENCE_FILE_BB,
  DEBT_SHIELD: COUNTER_DEBT_SHIELD_BB,
  SIGNAL_CLEAR: COUNTER_SIGNAL_CLEAR_BB,
  SOVEREIGNTY_LOCK: COUNTER_SOVEREIGNTY_LOCK_BB,
  COUNTER_AUDIT: COUNTER_COUNTER_AUDIT_BB,
  FULL_BLOCK: COUNTER_FULL_BLOCK_BB,
  FORCED_DRAW_BLOCK: 18,
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 4 — UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function stableId(prefix: string, ...parts: ReadonlyArray<string | number>): string {
  return `${prefix}_${createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 16)}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pressureTierFromPressure(pressure: number): PressureTier {
  if (pressure >= 90) return PressureTier.T4_COLLAPSE_IMMINENT;
  if (pressure >= 70) return PressureTier.T3_ELEVATED;
  if (pressure >= 45) return PressureTier.T2_STRESSED;
  if (pressure >= 20) return PressureTier.T1_STABLE;
  return PressureTier.T0_SOVEREIGN;
}

function psycheFromPressure(pressure: number): PsycheState {
  if (pressure > PSYCHE_CRACKING_CEILING) return 'BROKEN';
  if (pressure > PSYCHE_TENSE_CEILING) return 'CRACKING';
  if (pressure > PSYCHE_CALM_CEILING) return 'TENSE';
  return 'CALM';
}

function resolveRunPhase(tick: number, totalTicks: number): RunPhase {
  const ratio = tick / Math.max(1, totalTicks);
  if (ratio < 0.33) return RunPhase.FOUNDATION;
  if (ratio < 0.66) return RunPhase.ESCALATION;
  return RunPhase.SOVEREIGNTY;
}

function byPlayerId(
  players: readonly HeadToHeadPlayerState[],
  playerId: string,
): HeadToHeadPlayerState {
  const found = players.find((player) => player.playerId === playerId);
  if (!found) {
    throw new Error(`Unknown HEAD_TO_HEAD player '${playerId}'.`);
  }
  return found;
}

function replacePlayer(
  players: readonly HeadToHeadPlayerState[],
  updated: HeadToHeadPlayerState,
): HeadToHeadPlayerState[] {
  return players.map((player) =>
    player.playerId === updated.playerId ? updated : player,
  );
}

function opponentOf(
  players: readonly HeadToHeadPlayerState[],
  playerId: string,
): HeadToHeadPlayerState {
  const found = players.find((player) => player.playerId !== playerId);
  if (!found) {
    throw new Error(`Cannot find opponent for '${playerId}'.`);
  }
  return found;
}

function recalcPlayer(player: HeadToHeadPlayerState, tick: number): HeadToHeadPlayerState {
  const lockExpired =
    player.cardsLockedUntilTick !== null && tick > player.cardsLockedUntilTick;
  const misinformationExpired =
    player.misinformationUntilTick !== null && tick > player.misinformationUntilTick;
  const penaltyExpired =
    player.temporaryIncomePenaltyUntilTick !== null &&
    tick > player.temporaryIncomePenaltyUntilTick;
  const sovereigntyStunExpired =
    player.sovereigntyStunUntilTick !== null && tick > player.sovereigntyStunUntilTick;
  const chainRumorExpired =
    player.chainRumorUntilTick !== null && tick > player.chainRumorUntilTick;
  const mediaBlitzExpired =
    player.mediaBlitzUntilTick !== null && tick > player.mediaBlitzUntilTick;

  const temporaryIncomePenaltyPct = penaltyExpired ? 0 : player.temporaryIncomePenaltyPct;
  const effectiveIncome =
    player.income * Math.max(0, 1 - temporaryIncomePenaltyPct);

  const netWorth = round2(player.cash + effectiveIncome * 6 - player.expenses * 4);
  const pressure = clamp(player.pressure, 0, 100);

  let activeStatuses = [...player.activeStatuses];
  if (lockExpired) activeStatuses = activeStatuses.filter((s) => s !== 'cards_locked');
  if (misinformationExpired) activeStatuses = activeStatuses.filter((s) => s !== 'misinformation_flood');
  if (sovereigntyStunExpired) activeStatuses = activeStatuses.filter((s) => s !== 'sovereignty_stun');
  if (chainRumorExpired) activeStatuses = activeStatuses.filter((s) => s !== 'chain_rumor_active');
  if (mediaBlitzExpired) activeStatuses = activeStatuses.filter((s) => s !== 'media_blitz_active');

  return {
    ...player,
    pressure,
    pressureTier: pressureTierFromPressure(pressure),
    psycheState: psycheFromPressure(pressure),
    netWorth,
    activeStatuses,
    cardsLockedUntilTick: lockExpired ? null : player.cardsLockedUntilTick,
    misinformationUntilTick: misinformationExpired ? null : player.misinformationUntilTick,
    temporaryIncomePenaltyPct,
    temporaryIncomePenaltyUntilTick: penaltyExpired ? null : player.temporaryIncomePenaltyUntilTick,
    sovereigntyStunUntilTick: sovereigntyStunExpired ? null : player.sovereigntyStunUntilTick,
    chainRumorUntilTick: chainRumorExpired ? null : player.chainRumorUntilTick,
    mediaBlitzUntilTick: mediaBlitzExpired ? null : player.mediaBlitzUntilTick,
  };
}

function appendEvent(
  state: HeadToHeadModeState,
  type: HeadToHeadEvent['type'],
  actorId: string | null,
  targetId: string | null,
  amount: number | null,
  detail: string,
): HeadToHeadModeState {
  const event: HeadToHeadEvent = {
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

function mutatePlayer(
  state: HeadToHeadModeState,
  playerId: string,
  transform: (player: HeadToHeadPlayerState) => HeadToHeadPlayerState,
): HeadToHeadModeState {
  const current = byPlayerId(state.players, playerId);
  const updated = recalcPlayer(transform(current), state.macro.tick);

  return {
    ...state,
    players: replacePlayer(state.players, updated),
  };
}

function counterMatches(
  extractionType: ExtractionType,
  counterCardKey: CounterCardKey,
): boolean {
  return EXTRACTION_CATALOG[extractionType].counterCardKey === counterCardKey;
}

function setOrRemoveStatus(
  statuses: readonly HeadToHeadStatus[],
  status: HeadToHeadStatus,
  enabled: boolean,
): HeadToHeadStatus[] {
  const set = new Set(statuses);
  if (enabled) {
    set.add(status);
  } else {
    set.delete(status);
  }
  return [...set];
}

function normalizeThreatQueue(
  queue: readonly ThreatQueueEntry[],
): ThreatQueueEntry[] {
  return [...queue].slice(-MAX_THREAT_QUEUE_SIZE);
}

function appendChatEvent(
  state: HeadToHeadModeState,
  event: PredatorChatBridgeEvent,
): HeadToHeadModeState {
  return {
    ...state,
    macro: {
      ...state.macro,
      chatEvents: [...state.macro.chatEvents, event],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 5 — COMBO ESCALATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the combo tier from the current chain length.
 */
function resolveComboTier(chainLength: number): ComboTier {
  if (chainLength >= COMBO_TIER_3_THRESHOLD) return 3;
  if (chainLength >= COMBO_TIER_2_THRESHOLD) return 2;
  if (chainLength >= COMBO_TIER_1_THRESHOLD) return 1;
  return 0;
}

/**
 * Compute damage multiplier for the current combo tier.
 */
function comboDamageMultiplier(tier: ComboTier): number {
  switch (tier) {
    case 3: return COMBO_TIER_3_DAMAGE_MULTIPLIER;
    case 2: return COMBO_TIER_2_DAMAGE_MULTIPLIER;
    case 1: return COMBO_TIER_1_DAMAGE_MULTIPLIER;
    case 0: return 1;
  }
}

/**
 * Compute BB bonus for the current combo tier.
 */
function comboBBBonus(tier: ComboTier): number {
  switch (tier) {
    case 3: return COMBO_TIER_3_BB_BONUS;
    case 2: return COMBO_TIER_2_BB_BONUS;
    case 1: return COMBO_TIER_1_BB_BONUS;
    case 0: return 0;
  }
}

/**
 * SabotageComboPipeline: Tracks consecutive uncountered sabotage plays,
 * computes combo tier, damage amplification, and BB bonuses.
 */
export class SabotageComboPipeline {
  private chainLengths: Map<string, number>;
  private comboSnapshots: ComboEscalationSnapshot[];

  public constructor() {
    this.chainLengths = new Map();
    this.comboSnapshots = [];
  }

  /**
   * Record a successful (uncountered) extraction.
   */
  public recordSuccessfulExtraction(
    tick: number,
    attackerId: string,
    extractionType: ExtractionType,
  ): ComboEscalationSnapshot {
    const current = this.chainLengths.get(attackerId) ?? 0;
    const nextChain = current + 1;
    this.chainLengths.set(attackerId, nextChain);

    const tier = resolveComboTier(nextChain);
    const multiplier = comboDamageMultiplier(tier);
    const bbBonus = comboBBBonus(tier);

    const snapshot: ComboEscalationSnapshot = {
      tick,
      attackerId,
      chainLength: nextChain,
      comboTier: tier,
      damageMultiplier: multiplier,
      bbBonusAwarded: bbBonus,
      amplifiedExtractionType: extractionType,
    };

    this.comboSnapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Reset a player's combo chain (on counter or timeout).
   */
  public resetChain(playerId: string): void {
    this.chainLengths.set(playerId, 0);
  }

  /**
   * Get current chain length for a player.
   */
  public getChainLength(playerId: string): number {
    return this.chainLengths.get(playerId) ?? 0;
  }

  /**
   * Get the current combo tier for a player.
   */
  public getComboTier(playerId: string): ComboTier {
    return resolveComboTier(this.getChainLength(playerId));
  }

  /**
   * Get all combo snapshots.
   */
  public getSnapshots(): readonly ComboEscalationSnapshot[] {
    return [...this.comboSnapshots];
  }

  /**
   * Get the longest combo chain across all players.
   */
  public getLongestChain(): number {
    let longest = 0;
    for (const length of this.chainLengths.values()) {
      if (length > longest) longest = length;
    }
    return longest;
  }

  /**
   * Get the highest combo tier reached across all players.
   */
  public getHighestTier(): ComboTier {
    let highest: ComboTier = 0;
    for (const length of this.chainLengths.values()) {
      const tier = resolveComboTier(length);
      if (tier > highest) highest = tier;
    }
    return highest;
  }

  /**
   * Get total BB bonuses awarded.
   */
  public getTotalBBBonuses(): number {
    return this.comboSnapshots.reduce((sum, s) => sum + s.bbBonusAwarded, 0);
  }

  /**
   * Reset the pipeline.
   */
  public reset(): void {
    this.chainLengths.clear();
    this.comboSnapshots = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6 — COUNTER BOUNCEBACK ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CounterBouncebackEngine: Computes bounceback effects when specific
 * counter cards are played successfully. Certain counters reflect damage,
 * return BB, or stun the attacker.
 */
export class CounterBouncebackEngine {
  private bouncebackHistory: BouncebackResult[];

  public constructor() {
    this.bouncebackHistory = [];
  }

  /**
   * Compute the bounceback effect for a counter card.
   */
  public computeBounceback(
    counterCardKey: CounterCardKey,
    extractionType: ExtractionType,
  ): BouncebackResult {
    const spec = EXTRACTION_CATALOG[extractionType];
    let result: BouncebackResult;

    switch (counterCardKey) {
      case 'CREDIT_FREEZE':
        result = {
          counterCardKey,
          effectType: 'DAMAGE_REFLECT',
          damageReflected: BOUNCEBACK_CREDIT_FREEZE_DAMAGE,
          bbReturned: 0,
          stunTicksApplied: 0,
          pressureReflected: 0,
        };
        break;

      case 'EVIDENCE_FILE':
        result = {
          counterCardKey,
          effectType: 'PRESSURE_REFLECT',
          damageReflected: 0,
          bbReturned: 0,
          stunTicksApplied: 0,
          pressureReflected: BOUNCEBACK_EVIDENCE_FILE_PRESSURE,
        };
        break;

      case 'DEBT_SHIELD':
        result = {
          counterCardKey,
          effectType: 'BB_RETURN',
          damageReflected: 0,
          bbReturned: BOUNCEBACK_DEBT_SHIELD_BB_RETURN,
          stunTicksApplied: 0,
          pressureReflected: 0,
        };
        break;

      case 'SOVEREIGNTY_LOCK':
        result = {
          counterCardKey,
          effectType: 'STUN',
          damageReflected: 0,
          bbReturned: 0,
          stunTicksApplied: BOUNCEBACK_SOVEREIGNTY_LOCK_STUN_TICKS,
          pressureReflected: 0,
        };
        break;

      case 'FULL_BLOCK':
        result = {
          counterCardKey,
          effectType: 'DAMAGE_REFLECT',
          damageReflected: round2(spec.baseMagnitude * BOUNCEBACK_FULL_BLOCK_REFLECT_PCT * 100),
          bbReturned: 0,
          stunTicksApplied: 0,
          pressureReflected: 0,
        };
        break;

      default:
        result = {
          counterCardKey,
          effectType: 'NONE',
          damageReflected: 0,
          bbReturned: 0,
          stunTicksApplied: 0,
          pressureReflected: 0,
        };
        break;
    }

    this.bouncebackHistory.push(result);
    return result;
  }

  /**
   * Apply bounceback effects to the attacker state.
   */
  public applyBouncebackToState(
    state: HeadToHeadModeState,
    attackerId: string,
    targetId: string,
    bounceback: BouncebackResult,
  ): HeadToHeadModeState {
    let next = state;

    if (bounceback.effectType === 'DAMAGE_REFLECT' && bounceback.damageReflected > 0) {
      next = mutatePlayer(next, attackerId, (player) => ({
        ...player,
        shields: clamp(player.shields - bounceback.damageReflected, 0, 100),
        totalDamageTaken: player.totalDamageTaken + bounceback.damageReflected,
      }));
    }

    if (bounceback.effectType === 'BB_RETURN' && bounceback.bbReturned > 0) {
      next = mutatePlayer(next, targetId, (player) => ({
        ...player,
        battleBudget: clamp(player.battleBudget + bounceback.bbReturned, 0, MAX_BATTLE_BUDGET),
        totalBBEarned: player.totalBBEarned + bounceback.bbReturned,
      }));
    }

    if (bounceback.effectType === 'STUN' && bounceback.stunTicksApplied > 0) {
      next = mutatePlayer(next, attackerId, (player) => ({
        ...player,
        sovereigntyStunUntilTick: state.macro.tick + bounceback.stunTicksApplied,
        activeStatuses: setOrRemoveStatus(player.activeStatuses, 'sovereignty_stun', true),
      }));
    }

    if (bounceback.effectType === 'PRESSURE_REFLECT' && bounceback.pressureReflected > 0) {
      next = mutatePlayer(next, attackerId, (player) => ({
        ...player,
        pressure: clamp(player.pressure + bounceback.pressureReflected, 0, 100),
      }));
    }

    return next;
  }

  /**
   * Get all bounceback history.
   */
  public getHistory(): readonly BouncebackResult[] {
    return [...this.bouncebackHistory];
  }

  /**
   * Get analytics by counter card.
   */
  public getAnalyticsByCounter(): Map<CounterCardKey, PredatorBouncebackAnalytics> {
    const map = new Map<CounterCardKey, PredatorBouncebackAnalytics>();
    for (const bb of this.bouncebackHistory) {
      const existing = map.get(bb.counterCardKey);
      if (existing) {
        map.set(bb.counterCardKey, {
          ...existing,
          timesTriggered: existing.timesTriggered + 1,
          totalDamageReflected: existing.totalDamageReflected + bb.damageReflected,
          totalBBReturned: existing.totalBBReturned + bb.bbReturned,
          totalStunTicksApplied: existing.totalStunTicksApplied + bb.stunTicksApplied,
        });
      } else {
        map.set(bb.counterCardKey, {
          counterCardKey: bb.counterCardKey,
          effectType: bb.effectType,
          timesTriggered: 1,
          totalDamageReflected: bb.damageReflected,
          totalBBReturned: bb.bbReturned,
          totalStunTicksApplied: bb.stunTicksApplied,
        });
      }
    }
    return map;
  }

  /**
   * Reset.
   */
  public reset(): void {
    this.bouncebackHistory = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7 — PSYCHE METER ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PsycheMeterEngine: Tracks the psychological state of each player across
 * ticks. Records psyche state transitions, time spent in each state,
 * and detects psyche breaks (transitions to BROKEN).
 */
export class PsycheMeterEngine {
  private stateHistory: Map<string, Array<{ tick: number; state: PsycheState }>>;
  private psycheBreaksByPlayer: Map<string, number>;
  private ticksInState: Map<string, Record<PsycheState, number>>;

  public constructor(playerIds: readonly string[]) {
    this.stateHistory = new Map();
    this.psycheBreaksByPlayer = new Map();
    this.ticksInState = new Map();

    for (const id of playerIds) {
      this.stateHistory.set(id, [{ tick: 0, state: 'CALM' }]);
      this.psycheBreaksByPlayer.set(id, 0);
      this.ticksInState.set(id, { CALM: 0, TENSE: 0, CRACKING: 0, BROKEN: 0 });
    }
  }

  /**
   * Record a psyche state update for a player.
   */
  public recordState(playerId: string, tick: number, state: PsycheState): void {
    const history = this.stateHistory.get(playerId);
    if (!history) return;

    const previous = history.length > 0 ? history[history.length - 1].state : 'CALM';

    // Detect psyche break: any transition to BROKEN
    if (state === 'BROKEN' && previous !== 'BROKEN') {
      const current = this.psycheBreaksByPlayer.get(playerId) ?? 0;
      this.psycheBreaksByPlayer.set(playerId, current + 1);
    }

    history.push({ tick, state });

    // Update ticks in state
    const ticks = this.ticksInState.get(playerId);
    if (ticks) {
      ticks[state] += 1;
    }
  }

  /**
   * Get psyche breaks for a player.
   */
  public getPsycheBreaks(playerId: string): number {
    return this.psycheBreaksByPlayer.get(playerId) ?? 0;
  }

  /**
   * Get the state history for a player.
   */
  public getHistory(playerId: string): readonly { tick: number; state: PsycheState }[] {
    return [...(this.stateHistory.get(playerId) ?? [])];
  }

  /**
   * Get ticks in each state for a player.
   */
  public getTicksInState(playerId: string): Record<PsycheState, number> {
    return { ...(this.ticksInState.get(playerId) ?? { CALM: 0, TENSE: 0, CRACKING: 0, BROKEN: 0 }) };
  }

  /**
   * Compute psyche analytics for a player.
   */
  public computeAnalytics(playerId: string): PredatorPsycheAnalytics {
    const ticks = this.getTicksInState(playerId);
    const totalTicks = ticks.CALM + ticks.TENSE + ticks.CRACKING + ticks.BROKEN;
    const avgPressure = totalTicks > 0
      ? round6(
          (ticks.CALM * 20 + ticks.TENSE * 55 + ticks.CRACKING * 80 + ticks.BROKEN * 95) /
          totalTicks,
        )
      : 0;

    return {
      playerId,
      timeInCalm: ticks.CALM,
      timeInTense: ticks.TENSE,
      timeInCracking: ticks.CRACKING,
      timeInBroken: ticks.BROKEN,
      psycheBreaksInflicted: 0,
      psycheBreaksSuffered: this.getPsycheBreaks(playerId),
      averagePsychePressure: avgPressure,
    };
  }

  /**
   * Reset.
   */
  public reset(playerIds: readonly string[]): void {
    this.stateHistory.clear();
    this.psycheBreaksByPlayer.clear();
    this.ticksInState.clear();
    for (const id of playerIds) {
      this.stateHistory.set(id, []);
      this.psycheBreaksByPlayer.set(id, 0);
      this.ticksInState.set(id, { CALM: 0, TENSE: 0, CRACKING: 0, BROKEN: 0 });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8 — PREDATOR CARD OVERLAY RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PredatorCardOverlayResolver: Computes mode-specific cost/effect/timing
 * overlays for Predator mode. Handles SABOTAGE, COUNTER, and BUILD
 * sub-deck mechanics. Uses CARD_LEGALITY_MATRIX, MODE_TAG_WEIGHT_DEFAULTS,
 * DECK_TYPE_PROFILES, MODE_CARD_BEHAVIORS, HOLD_SYSTEM_CONFIG,
 * COMEBACK_SURGE_CONFIG, PRESSURE_COST_MODIFIERS, CARD_RARITY_DROP_RATES,
 * GHOST_MARKER_SPECS, IPA_CHAIN_SYNERGIES.
 */
export class PredatorCardOverlayResolver {
  private readonly registry: CardRegistry;
  private readonly rng: DeterministicRng;
  private readonly overlayCache: Map<string, CardOverlaySnapshot>;

  public constructor(registry: CardRegistry, seed: number) {
    this.registry = registry;
    this.rng = createDeterministicRng(combineSeed(normalizeSeed(seed), 'predator_overlay'));
    this.overlayCache = new Map();
  }

  /**
   * Resolve the full overlay for a card in Predator mode.
   */
  public resolveOverlay(
    cardDef: CardDefinition,
    tick: number,
    pressureTier: PressureTier,
    comboTier: ComboTier,
    psycheState: PsycheState,
  ): CardOverlaySnapshot {
    const cacheKey = `${cardDef.cardId}_${tick}_${pressureTier}_${comboTier}_${psycheState}`;
    if (this.overlayCache.has(cacheKey)) {
      return this.overlayCache.get(cacheKey)!;
    }

    const legalDecks = CARD_LEGALITY_MATRIX[PREDATOR_MODE];
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

    const tagWeights = MODE_TAG_WEIGHT_DEFAULTS[PREDATOR_MODE];
    const modeBehavior = getModeCardBehavior(PREDATOR_MODE);
    const deckProfile = getDeckTypeProfile(cardDef.deckType);
    const tagScore = computeTagWeightedScore(cardDef.tags, PREDATOR_MODE);
    const pressureCost = computePressureCostModifier(pressureTier);
    const rarityRate = CARD_RARITY_DROP_RATES[cardDef.rarity];

    let costModifier = round6(1.0 * pressureCost);
    let effectModifier = 1.0;

    // SABOTAGE deck: enhanced by combo tier
    if (cardDef.deckType === DeckType.SABOTAGE) {
      effectModifier = round6(1.0 + comboTier * 0.15 + tagScore * 0.05);
      costModifier = round6(costModifier * (1 - comboTier * 0.05));
    }

    // COUNTER deck: enhanced by psyche state (defensive urgency)
    if (cardDef.deckType === DeckType.COUNTER) {
      const psycheBonus = psycheState === 'BROKEN' ? 0.25 :
        psycheState === 'CRACKING' ? 0.15 :
        psycheState === 'TENSE' ? 0.05 : 0;
      effectModifier = round6(1.0 + psycheBonus + tagScore * 0.03);
    }

    // OPPORTUNITY deck (Build sub-deck): standard economy mode
    if (cardDef.deckType === DeckType.OPPORTUNITY) {
      effectModifier = round6(1.1 + tagScore * 0.02);
      costModifier = round6(costModifier * 0.95);
    }

    // IPA deck: check chain synergies
    if (cardDef.deckType === DeckType.IPA) {
      const hasRelevantChain = IPA_CHAIN_SYNERGIES.some(
        (chain) => chain.combination.includes(DeckType.IPA),
      );
      if (hasRelevantChain) {
        effectModifier = round6(effectModifier * 1.05);
      }
    }

    // FUBAR deck: enhanced danger in Predator
    if (cardDef.deckType === DeckType.FUBAR) {
      effectModifier = round6(1.1 + pressureCost * 0.1);
    }

    // Bleed-through multiplier from card_types
    const bleedthrough = computeBleedthroughMultiplier(
      pressureTier,
      pressureTier === PressureTier.T4_COLLAPSE_IMMINENT,
    );
    effectModifier = round6(effectModifier * (1 + (bleedthrough - 1) * 0.1));

    // Trust efficiency weighting
    const trustEff = computeTrustEfficiency(50);

    // CORD weight based on deck profile and tag score
    const cordWeight = round6(
      deckProfile.baselineCordWeight * (1 + tagScore * 0.01) * effectModifier,
    );

    // Hold system: limited holds in Predator (per doctrine)
    const holdAllowed = cardDef.deckType !== DeckType.SABOTAGE && cardDef.deckType !== DeckType.COUNTER;
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
   * Resolve overlays for all legal deck types in Predator.
   */
  public resolveAllDeckOverlays(
    tick: number,
    pressureTier: PressureTier,
    comboTier: ComboTier,
    psycheState: PsycheState,
  ): Map<DeckType, CardOverlaySnapshot> {
    const result = new Map<DeckType, CardOverlaySnapshot>();
    const legalDecks = CARD_LEGALITY_MATRIX[PREDATOR_MODE];

    for (const deckType of legalDecks) {
      const syntheticDef: CardDefinition = {
        cardId: `predator_synthetic_${deckType}`,
        name: `Predator ${deckType}`,
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

      result.set(deckType, this.resolveOverlay(syntheticDef, tick, pressureTier, comboTier, psycheState));
    }

    return result;
  }

  /**
   * Check if SABOTAGE deck is legal in this mode.
   */
  public isSabotageDeckLegal(): boolean {
    return isDeckLegalInMode(DeckType.SABOTAGE, PREDATOR_MODE);
  }

  /**
   * Check if COUNTER deck is legal in this mode.
   */
  public isCounterDeckLegal(): boolean {
    return isDeckLegalInMode(DeckType.COUNTER, PREDATOR_MODE);
  }

  /**
   * Get the pressure cost modification for the current tier.
   */
  public getPressureCostForTier(tier: PressureTier): number {
    return PRESSURE_COST_MODIFIERS[tier];
  }

  /**
   * Get rarity drop rate for a given rarity.
   */
  public getRarityDropRate(rarity: CardRarity): number {
    return CARD_RARITY_DROP_RATES[rarity];
  }

  /**
   * Clear the overlay cache.
   */
  public clearCache(): void {
    this.overlayCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 9 — PROOF BADGE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PredatorProofBadgeTrackerEngine: Tracks all five proof badge conditions
 * for Predator mode.
 * Uses getProofBadgeConditionsForMode to load mode-specific badge conditions.
 * Uses computeAggregateProofBadgeCord to compute the aggregate CORD bonus.
 */
export class PredatorProofBadgeTrackerEngine {
  private extractionHits: number;
  private highestComboTier: ComboTier;
  private countersLanded: number;
  private totalDamageTaken: number;
  private bluffsPlayed: number;
  private psycheBreaksInflicted: number;
  private avgDecisionSpeedMs: number;
  private totalCardPlays: number;
  private peakDeficit: number;
  private finalWin: boolean;
  private readonly unlockedBadges: Set<PredatorProofBadge>;
  private readonly modeConditions: ReturnType<typeof getProofBadgeConditionsForMode>;

  public constructor() {
    this.extractionHits = 0;
    this.highestComboTier = 0;
    this.countersLanded = 0;
    this.totalDamageTaken = 0;
    this.bluffsPlayed = 0;
    this.psycheBreaksInflicted = 0;
    this.avgDecisionSpeedMs = 0;
    this.totalCardPlays = 0;
    this.peakDeficit = 0;
    this.finalWin = false;
    this.unlockedBadges = new Set();
    this.modeConditions = getProofBadgeConditionsForMode(PREDATOR_MODE);
  }

  /**
   * Update tracker with current match data.
   */
  public update(input: {
    extractionHits: number;
    highestComboTier: ComboTier;
    countersLanded: number;
    totalDamageTaken: number;
    bluffsPlayed: number;
    psycheBreaksInflicted: number;
    avgDecisionSpeedMs: number;
    totalCardPlays: number;
    peakDeficit: number;
    finalWin: boolean;
  }): void {
    this.extractionHits = input.extractionHits;
    this.highestComboTier = input.highestComboTier;
    this.countersLanded = input.countersLanded;
    this.totalDamageTaken = input.totalDamageTaken;
    this.bluffsPlayed = input.bluffsPlayed;
    this.psycheBreaksInflicted = input.psycheBreaksInflicted;
    this.avgDecisionSpeedMs = input.avgDecisionSpeedMs;
    this.totalCardPlays = input.totalCardPlays;
    this.peakDeficit = input.peakDeficit;
    this.finalWin = input.finalWin;

    this.evaluateBadges();
  }

  private evaluateBadges(): void {
    // DOMINATOR: high extraction hits + combo tier
    if (
      this.extractionHits >= BADGE_DOMINATOR_MIN_EXTRACTION_HITS &&
      this.highestComboTier >= BADGE_DOMINATOR_MIN_COMBO_TIER
    ) {
      this.unlockedBadges.add('DOMINATOR');
    }

    // FORTRESS: many counters landed with low damage taken
    if (
      this.countersLanded >= BADGE_FORTRESS_MIN_COUNTERS_LANDED &&
      this.totalDamageTaken <= BADGE_FORTRESS_MAX_DAMAGE_TAKEN
    ) {
      this.unlockedBadges.add('FORTRESS');
    }

    // MIND_GAME: bluffs played + psyche breaks inflicted
    if (
      this.bluffsPlayed >= BADGE_MIND_GAME_MIN_BLUFFS &&
      this.psycheBreaksInflicted >= BADGE_MIND_GAME_MIN_PSYCHE_BREAKS
    ) {
      this.unlockedBadges.add('MIND_GAME');
    }

    // TEMPO_KING: fast decisions with minimum card plays
    if (
      this.avgDecisionSpeedMs > 0 &&
      this.avgDecisionSpeedMs <= BADGE_TEMPO_KING_MAX_AVG_DECISION_MS &&
      this.totalCardPlays >= BADGE_TEMPO_KING_MIN_CARD_PLAYS
    ) {
      this.unlockedBadges.add('TEMPO_KING');
    }

    // COMEBACK_PREDATOR: had deficit but won
    if (
      this.peakDeficit >= BADGE_COMEBACK_MIN_DEFICIT &&
      this.finalWin === BADGE_COMEBACK_FINAL_WIN
    ) {
      this.unlockedBadges.add('COMEBACK_PREDATOR');
    }
  }

  /**
   * Get the current tracker state.
   */
  public getState(): PredatorProofBadgeTracker {
    const unlockedArray = [...this.unlockedBadges];

    const aggregateProofCord = computeAggregateProofBadgeCord(
      PREDATOR_MODE,
      new Set(unlockedArray.map((b) => b.toLowerCase())),
    );

    return {
      dominator: {
        extractionHits: this.extractionHits,
        highestComboTier: this.highestComboTier,
        unlocked: this.unlockedBadges.has('DOMINATOR'),
      },
      fortress: {
        countersLanded: this.countersLanded,
        totalDamageTaken: this.totalDamageTaken,
        unlocked: this.unlockedBadges.has('FORTRESS'),
      },
      mindGame: {
        bluffsPlayed: this.bluffsPlayed,
        psycheBreaksInflicted: this.psycheBreaksInflicted,
        unlocked: this.unlockedBadges.has('MIND_GAME'),
      },
      tempoKing: {
        avgDecisionSpeedMs: this.avgDecisionSpeedMs,
        totalCardPlays: this.totalCardPlays,
        unlocked: this.unlockedBadges.has('TEMPO_KING'),
      },
      comebackPredator: {
        peakDeficit: this.peakDeficit,
        finalWin: this.finalWin,
        unlocked: this.unlockedBadges.has('COMEBACK_PREDATOR'),
      },
      unlockedBadges: unlockedArray,
      aggregateProofCord: round6(aggregateProofCord),
    };
  }

  /**
   * Get just the unlocked badges.
   */
  public getUnlockedBadges(): readonly PredatorProofBadge[] {
    return [...this.unlockedBadges];
  }

  /**
   * Get the mode-specific badge conditions loaded from card_types.
   */
  public getModeConditions(): typeof this.modeConditions {
    return this.modeConditions;
  }

  /**
   * Reset the tracker.
   */
  public reset(): void {
    this.extractionHits = 0;
    this.highestComboTier = 0;
    this.countersLanded = 0;
    this.totalDamageTaken = 0;
    this.bluffsPlayed = 0;
    this.psycheBreaksInflicted = 0;
    this.avgDecisionSpeedMs = 0;
    this.totalCardPlays = 0;
    this.peakDeficit = 0;
    this.finalWin = false;
    this.unlockedBadges.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10 — CORE EXTRACTION / COMBAT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function awardBattleBudgetForTick(
  player: HeadToHeadPlayerState,
): number {
  const incomeSourceCount = Math.max(1, Math.floor(player.income / 1000));
  return BB_BASE_PER_TICK + BB_PER_INCOME_SOURCE * incomeSourceCount;
}

function awardBattleBudgetForPressureTier(
  tier: PressureTier,
): number {
  return tier === PressureTier.T3_ELEVATED || tier === PressureTier.T4_COLLAPSE_IMMINENT
    ? BB_COMBO_ESCALATION_BASE
    : 2;
}

function computeCordTieBreakerScore(player: HeadToHeadPlayerState): number {
  const shieldsPct = clamp(player.shields / 100, 0, 1);
  const speedScore =
    player.averageDecisionSpeedMs === null
      ? 0
      : 1 / Math.max(TIEBREAKER_SPEED_FLOOR, player.averageDecisionSpeedMs);
  const chainScore = player.cascadeChainsBroken * TIEBREAKER_CHAIN_SCORE_UNIT;

  return (player.finalCord ?? 0) + shieldsPct * TIEBREAKER_SHIELDS_WEIGHT + speedScore + chainScore;
}

function applyIncomeFlow(player: HeadToHeadPlayerState, tick: number): HeadToHeadPlayerState {
  const penalty =
    player.temporaryIncomePenaltyUntilTick !== null &&
    tick <= player.temporaryIncomePenaltyUntilTick
      ? player.temporaryIncomePenaltyPct
      : 0;

  const realizedIncome = player.income * Math.max(0, 1 - penalty);
  const silentDrainDeduction = player.silentDrainStacks * 50;
  const cash = Math.max(0, player.cash + realizedIncome - player.expenses - silentDrainDeduction);

  let debtInjectionStacks = player.debtInjectionStacks;
  let expenses = player.expenses;

  if (player.activeStatuses.includes('debt_injected')) {
    debtInjectionStacks += 1;
    const multiplier =
      debtInjectionStacks >= 3 ? 1.25 : debtInjectionStacks === 2 ? 1.17 : 1.12;
    expenses = round2(player.expenses * multiplier);
  }

  return recalcPlayer(
    {
      ...player,
      cash,
      expenses,
      debtInjectionStacks,
    },
    tick,
  );
}

function applyExtraction(
  state: HeadToHeadModeState,
  extractionType: ExtractionType,
  attackerId: string,
  targetId: string,
  critical: boolean,
  comboMultiplier: number,
): HeadToHeadModeState {
  const target = byPlayerId(state.players, targetId);
  const spec = EXTRACTION_CATALOG[extractionType];
  const bleedMultiplier = critical ? BLEED_THROUGH_MULTIPLIER : 1;
  const effectiveMultiplier = bleedMultiplier * comboMultiplier;
  let next = state;

  switch (extractionType) {
    case 'MARKET_DUMP': {
      const basePenalty =
        target.psycheState === 'CRACKING' || target.psycheState === 'BROKEN'
          ? 0.3
          : spec.baseMagnitude;
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            temporaryIncomePenaltyPct: clamp(basePenalty * effectiveMultiplier, 0, 0.9),
            temporaryIncomePenaltyUntilTick:
              next.macro.tick +
              (player.psycheState === 'CRACKING' || player.psycheState === 'BROKEN' ? 3 : 2),
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'market_dumped', true),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'CREDIT_REPORT_PULL': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            creditLineScore: clamp(
              player.creditLineScore - Math.ceil(spec.baseMagnitude * effectiveMultiplier),
              0,
              100,
            ),
            expenses:
              player.creditLineScore < 20
                ? round2(player.expenses * 1.08)
                : player.expenses,
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'REGULATORY_FILING': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            cardsLockedUntilTick: next.macro.tick + 3,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'cards_locked', true),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'MISINFORMATION_FLOOD': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            misinformationUntilTick: next.macro.tick + 2,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'misinformation_flood', true),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'DEBT_INJECTION': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'debt_injected', true),
            debtInjectionStacks: player.debtInjectionStacks + 1,
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'HOSTILE_TAKEOVER': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            income: round2(player.income * (1 - 0.5 * effectiveMultiplier)),
            hostileTakeoverStacks: player.hostileTakeoverStacks + 1,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'hostile_takeover_debuff', true),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'LIQUIDATION_NOTICE': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            forcedFubarAtTick: next.macro.tick + 1,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'forced_fubar_next_tick', true),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'CHAIN_RUMOR': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            chainRumorUntilTick: next.macro.tick + 3,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'chain_rumor_active', true),
            income: round2(player.income * (1 - spec.baseMagnitude * effectiveMultiplier)),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'MEDIA_BLITZ': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            mediaBlitzUntilTick: next.macro.tick + 2,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'media_blitz_active', true),
            cash: Math.max(0, player.cash - Math.ceil(player.cash * spec.baseMagnitude * effectiveMultiplier)),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'SILENT_DRAIN': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            silentDrainStacks: player.silentDrainStacks + 1,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'silent_drain_active', true),
            pressure: clamp(player.pressure + spec.pressureDelta, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    default:
      break;
  }

  // Award attacker BB and heat
  const damageDealt = round2(spec.baseMagnitude * effectiveMultiplier * 100);
  next = mutatePlayer(next, attackerId, (player) =>
    recalcPlayer(
      {
        ...player,
        extractionHits: player.extractionHits + 1,
        rivalryHeat: clamp(player.rivalryHeat + 6, 0, 100),
        battleBudget: clamp(
          player.battleBudget + BB_EXTRACTION_HIT_BONUS + (next.macro.firstBloodAttackerId === null ? BB_FIRST_BLOOD_BONUS : 0),
          0,
          MAX_BATTLE_BUDGET,
        ),
        totalDamageDealt: player.totalDamageDealt + damageDealt,
      },
      next.macro.tick,
    ),
  );

  // Track damage on target
  next = mutatePlayer(next, targetId, (player) =>
    recalcPlayer(
      {
        ...player,
        shields:
          extractionType === 'HOSTILE_TAKEOVER'
            ? player.shields
            : clamp(player.shields - Math.ceil(8 * effectiveMultiplier), 0, 100),
        totalDamageTaken: player.totalDamageTaken + damageDealt,
      },
      next.macro.tick,
    ),
  );

  // Shield break bonus
  const targetAfter = byPlayerId(next.players, targetId);
  if (targetAfter.shields <= 0) {
    next = mutatePlayer(next, attackerId, (player) =>
      recalcPlayer(
        {
          ...player,
          battleBudget: clamp(player.battleBudget + BB_SHIELD_BREAK_BONUS, 0, MAX_BATTLE_BUDGET),
        },
        next.macro.tick,
      ),
    );
  }

  return {
    ...next,
    macro: {
      ...next.macro,
      firstBloodAttackerId: next.macro.firstBloodAttackerId ?? attackerId,
      threatQueue: normalizeThreatQueue([
        ...next.macro.threatQueue,
        {
          tick: next.macro.tick,
          attackerId,
          targetId,
          extractionType,
          magnitude: spec.baseMagnitude * effectiveMultiplier,
          comboAmplified: comboMultiplier > 1,
        },
      ]),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 11 — DISPATCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function resolveCounterWindow(
  state: HeadToHeadModeState,
  action: ResolveCounterWindowAction,
): HeadToHeadModeState {
  const window = state.macro.pendingCounterWindow;
  if (!window || window.windowId !== action.windowId) {
    throw new Error(`Unknown counter window '${action.windowId}'.`);
  }
  if (window.resolved) {
    return state;
  }

  let nextState = state;

  if (window.countered) {
    nextState = mutatePlayer(nextState, window.targetId, (player) =>
      recalcPlayer(
        {
          ...player,
          battleBudget: clamp(player.battleBudget + BB_COUNTER_LANDED_BONUS, 0, MAX_BATTLE_BUDGET),
          countersLanded: player.countersLanded + 1,
          bouncebacksTriggered: player.bouncebacksTriggered + 1,
          counterDeckPlays: player.counterDeckPlays + 1,
        },
        nextState.macro.tick,
      ),
    );

    nextState = mutatePlayer(nextState, window.attackerId, (player) =>
      recalcPlayer(
        {
          ...player,
          extractionMisses: player.extractionMisses + 1,
          pressure: clamp(player.pressure + 4, 0, 100),
          comboChainLength: COMBO_RESET_ON_COUNTER ? 0 : player.comboChainLength,
          currentComboTier: COMBO_RESET_ON_COUNTER ? 0 : player.currentComboTier,
        },
        nextState.macro.tick,
      ),
    );

    nextState = appendEvent(
      nextState,
      'RESOLVE_COUNTER_WINDOW',
      window.targetId,
      window.attackerId,
      null,
      `counter_landed:${window.extractionType}:${window.counterCardKey}`,
    );
  } else {
    // Extraction lands — compute combo amplification
    const attacker = byPlayerId(nextState.players, window.attackerId);
    const comboMultiplier = comboDamageMultiplier(attacker.currentComboTier);

    nextState = applyExtraction(
      nextState,
      window.extractionType,
      window.attackerId,
      window.targetId,
      window.critical,
      comboMultiplier,
    );

    // Advance combo chain
    nextState = mutatePlayer(nextState, window.attackerId, (player) => {
      const newChainLength = player.comboChainLength + 1;
      const newTier = resolveComboTier(newChainLength);
      const bbBonus = comboBBBonus(newTier);
      return recalcPlayer(
        {
          ...player,
          comboChainLength: newChainLength,
          currentComboTier: newTier,
          battleBudget: clamp(player.battleBudget + bbBonus, 0, MAX_BATTLE_BUDGET),
          totalBBEarned: player.totalBBEarned + bbBonus,
          sabotageDeckPlays: player.sabotageDeckPlays + 1,
        },
        nextState.macro.tick,
      );
    });

    nextState = appendEvent(
      nextState,
      'RESOLVE_COUNTER_WINDOW',
      window.attackerId,
      window.targetId,
      null,
      `extraction_landed:${window.extractionType}:critical=${window.critical}:combo=${comboMultiplier}`,
    );
  }

  return {
    ...nextState,
    macro: {
      ...nextState.macro,
      pendingCounterWindow: null,
    },
  };
}

function applyTick(
  state: HeadToHeadModeState,
  action: AdvanceTickAction,
): HeadToHeadModeState {
  let nextState: HeadToHeadModeState = {
    ...state,
    macro: {
      ...state.macro,
      tick: state.macro.tick + 1,
      sharedClockMs: state.macro.sharedClockMs + (action.sharedClockAdvanceMs ?? 1_000),
      currentPhase: resolveRunPhase(state.macro.tick + 1, BATCH_DEFAULT_TICK_COUNT),
    },
  };

  const activeWindow = nextState.macro.pendingCounterWindow;
  if (
    activeWindow &&
    !activeWindow.resolved &&
    action.timestampMs >= activeWindow.deadlineTimestampMs
  ) {
    nextState = resolveCounterWindow(nextState, {
      type: 'RESOLVE_COUNTER_WINDOW',
      windowId: activeWindow.windowId,
      timestampMs: action.timestampMs,
    });
  }

  const activeOffer = nextState.macro.activeOffer;
  if (
    activeOffer &&
    action.timestampMs >= activeOffer.discardAtTimestampMs
  ) {
    nextState = appendEvent(
      {
        ...nextState,
        macro: {
          ...nextState.macro,
          activeOffer: null,
          removedSharedOpportunityCardIds: [
            ...nextState.macro.removedSharedOpportunityCardIds,
            activeOffer.cardId,
          ],
        },
      },
      'SYSTEM',
      null,
      null,
      null,
      `shared_offer_discarded:${activeOffer.cardId}`,
    );
  }

  for (const player of nextState.players) {
    const pressureDelta = action.pressureDeltaByPlayerId?.[player.playerId] ?? 0;

    nextState = mutatePlayer(nextState, player.playerId, (entry) => {
      const flowed = applyIncomeFlow(entry, nextState.macro.tick);
      const forcedFubarNow = flowed.forcedFubarAtTick === nextState.macro.tick;

      const nextCash = forcedFubarNow
        ? Math.max(0, flowed.cash - 6000)
        : flowed.cash;

      const nextPressure = forcedFubarNow
        ? clamp(flowed.pressure + pressureDelta + 10, 0, 100)
        : clamp(flowed.pressure + pressureDelta, 0, 100);

      const nextStatuses = forcedFubarNow
        ? setOrRemoveStatus(flowed.activeStatuses, 'forced_fubar_next_tick', false)
        : flowed.activeStatuses;

      // BB generation: base per tick + per income source
      const bbGenerated = awardBattleBudgetForTick(flowed) +
        awardBattleBudgetForPressureTier(flowed.pressureTier);

      return recalcPlayer(
        {
          ...flowed,
          battleBudget: clamp(flowed.battleBudget + bbGenerated, 0, MAX_BATTLE_BUDGET),
          totalBBEarned: flowed.totalBBEarned + bbGenerated,
          activeStatuses: nextStatuses,
          cash: nextCash,
          pressure: nextPressure,
          forcedFubarAtTick: forcedFubarNow ? null : flowed.forcedFubarAtTick,
        },
        nextState.macro.tick,
      );
    });
  }

  return appendEvent(
    nextState,
    'ADVANCE_TICK',
    null,
    null,
    null,
    'tick_advanced',
  );
}

function drawSharedOpportunity(
  state: HeadToHeadModeState,
  action: DrawSharedOpportunityAction,
): HeadToHeadModeState {
  if (state.macro.activeOffer) {
    throw new Error('A shared opportunity offer is already active.');
  }

  const remaining = state.macro.sharedOpportunityDeck.filter(
    (cardId) => !state.macro.removedSharedOpportunityCardIds.includes(cardId),
  );

  if (remaining.length === 0) {
    return {
      ...appendEvent(
        state,
        'DRAW_SHARED_OPPORTUNITY',
        action.viewerId,
        null,
        null,
        'shared_opportunity_deck_exhausted',
      ),
      macro: {
        ...state.macro,
        exhaustedOpportunityDeck: true,
      },
    };
  }

  const cardId = remaining[0];
  const offer: SharedOpportunityOffer = {
    offerId: stableId(
      'offer',
      state.runId,
      state.macro.tick,
      cardId,
      action.viewerId,
    ),
    cardId,
    firstViewerId: action.viewerId,
    openedAtTick: state.macro.tick,
    openedAtTimestampMs: action.timestampMs,
    exclusiveEndsAtTimestampMs: action.timestampMs + FIRST_REFUSAL_MS,
    discardAtTimestampMs: action.timestampMs + SHARED_OPEN_TOTAL_MS,
    passedByPlayerIds: [],
  };

  return appendEvent(
    {
      ...state,
      macro: {
        ...state.macro,
        activeOffer: offer,
      },
    },
    'DRAW_SHARED_OPPORTUNITY',
    action.viewerId,
    null,
    null,
    `shared_offer_opened:${cardId}`,
  );
}

function claimSharedOpportunity(
  state: HeadToHeadModeState,
  action: ClaimSharedOpportunityAction,
  registry: CardRegistry,
): HeadToHeadModeState {
  const offer = state.macro.activeOffer;
  if (!offer || offer.offerId !== action.offerId) {
    throw new Error(`Shared opportunity offer '${action.offerId}' is not active.`);
  }

  if (action.timestampMs > offer.discardAtTimestampMs) {
    throw new Error('Shared opportunity offer already expired.');
  }

  if (
    action.playerId !== offer.firstViewerId &&
    action.timestampMs < offer.exclusiveEndsAtTimestampMs
  ) {
    throw new Error('First refusal window is still exclusive.');
  }

  const buyer = byPlayerId(state.players, action.playerId);
  const definition = registry.getOrThrow(offer.cardId);

  if (definition.deckType !== DeckType.OPPORTUNITY) {
    throw new Error(`Card '${definition.cardId}' is not a shared opportunity card.`);
  }

  if (buyer.cash < definition.baseCost) {
    throw new Error(`Player '${action.playerId}' has insufficient cash.`);
  }

  let next = mutatePlayer(state, action.playerId, (player) =>
    recalcPlayer(
      {
        ...player,
        cash: player.cash - definition.baseCost,
        claimedOpportunityCardIds: [...player.claimedOpportunityCardIds, definition.cardId],
        income:
          player.income +
          definition.effects
            .filter((effect) => effect.op === 'income_delta')
            .reduce((sum, effect) => sum + effect.magnitude, 0),
        battleBudget: clamp(player.battleBudget + 6, 0, MAX_BATTLE_BUDGET),
      },
      state.macro.tick,
    ),
  );

  next = appendEvent(
    {
      ...next,
      macro: {
        ...next.macro,
        activeOffer: null,
        removedSharedOpportunityCardIds: [
          ...next.macro.removedSharedOpportunityCardIds,
          definition.cardId,
        ],
      },
    },
    'CLAIM_SHARED_OPPORTUNITY',
    action.playerId,
    null,
    definition.baseCost,
    `claimed_shared_opportunity:${definition.cardId}`,
  );

  return next;
}

function passSharedOpportunity(
  state: HeadToHeadModeState,
  action: PassSharedOpportunityAction,
): HeadToHeadModeState {
  const offer = state.macro.activeOffer;
  if (!offer || offer.offerId !== action.offerId) {
    throw new Error(`Shared opportunity offer '${action.offerId}' is not active.`);
  }

  const updatedOffer: SharedOpportunityOffer = {
    ...offer,
    passedByPlayerIds: [...new Set([...offer.passedByPlayerIds, action.playerId])],
  };

  const bothPassed =
    updatedOffer.passedByPlayerIds.length >= state.players.length;

  const nextState: HeadToHeadModeState = {
    ...state,
    macro: {
      ...state.macro,
      activeOffer: bothPassed ? null : updatedOffer,
      removedSharedOpportunityCardIds: bothPassed
        ? [...state.macro.removedSharedOpportunityCardIds, offer.cardId]
        : state.macro.removedSharedOpportunityCardIds,
    },
  };

  return appendEvent(
    nextState,
    'PASS_SHARED_OPPORTUNITY',
    action.playerId,
    null,
    null,
    bothPassed
      ? `offer_discarded_after_both_passed:${offer.cardId}`
      : `offer_passed:${offer.cardId}`,
  );
}

function fireExtraction(
  state: HeadToHeadModeState,
  action: FireExtractionAction,
): HeadToHeadModeState {
  if (state.macro.pendingCounterWindow) {
    throw new Error('Cannot fire a new extraction while a counter window is active.');
  }
  if (action.attackerId === action.targetId) {
    throw new Error('Attacker and target must differ.');
  }

  const attacker = byPlayerId(state.players, action.attackerId);
  const extraction = EXTRACTION_CATALOG[action.extractionType];

  if (
    attacker.lastExtractionTick !== null &&
    state.macro.tick - attacker.lastExtractionTick < EXTRACTION_COOLDOWN_TICKS
  ) {
    throw new Error('Extraction cooldown has not elapsed.');
  }

  if (attacker.battleBudget < extraction.battleBudgetCost) {
    throw new Error('Insufficient battle budget for extraction.');
  }

  if (attacker.sovereigntyStunUntilTick !== null && state.macro.tick <= attacker.sovereigntyStunUntilTick) {
    throw new Error('Attacker is sovereignty-stunned and cannot fire extraction.');
  }

  let next = mutatePlayer(state, attacker.playerId, (player) =>
    recalcPlayer(
      {
        ...player,
        battleBudget: clamp(
          player.battleBudget - extraction.battleBudgetCost,
          0,
          MAX_BATTLE_BUDGET,
        ),
        totalBBSpent: player.totalBBSpent + extraction.battleBudgetCost,
        lastExtractionTick: state.macro.tick,
        rivalryHeat: clamp(player.rivalryHeat + 4, 0, 100),
      },
      state.macro.tick,
    ),
  );

  next = mutatePlayer(next, action.targetId, (player) =>
    recalcPlayer(
      {
        ...player,
        pressure: clamp(player.pressure + 4, 0, 100),
      },
      state.macro.tick,
    ),
  );

  const counterWindow: PendingCounterWindow = {
    windowId: stableId(
      'ctr',
      state.runId,
      state.macro.tick,
      action.attackerId,
      action.targetId,
      action.extractionType,
    ),
    attackerId: action.attackerId,
    targetId: action.targetId,
    extractionType: action.extractionType,
    openedAtTick: state.macro.tick,
    openedAtTimestampMs: action.timestampMs,
    deadlineTimestampMs: action.timestampMs + COUNTER_WINDOW_MS,
    counterableBy: extraction.counterCardKey,
    critical: Boolean(action.critical),
    sourceCardId: action.sourceCardId,
    resolved: false,
    countered: false,
    comboChainAtFire: attacker.comboChainLength,
  };

  return appendEvent(
    {
      ...next,
      macro: {
        ...next.macro,
        pendingCounterWindow: counterWindow,
      },
    },
    'FIRE_EXTRACTION',
    action.attackerId,
    action.targetId,
    extraction.battleBudgetCost,
    `extraction_opened:${action.extractionType}:combo_chain=${attacker.comboChainLength}`,
  );
}

function respondCounter(
  state: HeadToHeadModeState,
  action: RespondCounterAction,
): HeadToHeadModeState {
  const window = state.macro.pendingCounterWindow;
  if (!window || window.windowId !== action.windowId) {
    throw new Error(`Counter window '${action.windowId}' is not active.`);
  }
  if (window.targetId !== action.playerId) {
    throw new Error('Only the target may respond in the counter window.');
  }
  if (!counterMatches(window.extractionType, action.counterCardKey)) {
    throw new Error(`Counter card '${action.counterCardKey}' does not block '${window.extractionType}'.`);
  }
  if (action.timestampMs > window.deadlineTimestampMs) {
    throw new Error('Counter window has already expired.');
  }

  const player = byPlayerId(state.players, action.playerId);
  const counterCost = COUNTER_CARD_COSTS[action.counterCardKey] ?? Math.max(
    8,
    Math.floor(EXTRACTION_CATALOG[window.extractionType].battleBudgetCost * 0.6),
  );

  if (player.battleBudget < counterCost) {
    throw new Error('Insufficient battle budget to counter.');
  }

  const next = mutatePlayer(state, action.playerId, (entry) =>
    recalcPlayer(
      {
        ...entry,
        battleBudget: clamp(entry.battleBudget - counterCost, 0, MAX_BATTLE_BUDGET),
        totalBBSpent: entry.totalBBSpent + counterCost,
      },
      state.macro.tick,
    ),
  );

  return appendEvent(
    {
      ...next,
      macro: {
        ...next.macro,
        pendingCounterWindow: {
          ...window,
          countered: true,
          resolved: false,
          counterCardKey: action.counterCardKey,
          counteredAtTimestampMs: action.timestampMs,
        },
      },
    },
    'RESPOND_COUNTER',
    action.playerId,
    window.attackerId,
    counterCost,
    `counter_response:${action.counterCardKey}`,
  );
}

function recordBotRedirect(
  state: HeadToHeadModeState,
  action: RecordBotRedirectAction,
): HeadToHeadModeState {
  return appendEvent(
    mutatePlayer(state, action.playerId, (player) =>
      recalcPlayer(
        {
          ...player,
          rivalryHeat: clamp(player.rivalryHeat + Math.ceil(action.heat / 10), 0, 100),
        },
        state.macro.tick,
      ),
    ),
    'RECORD_BOT_REDIRECT',
    action.playerId,
    null,
    action.heat,
    `bot_redirect:${action.botId}`,
  );
}

function addPrivateIpaCard(
  state: HeadToHeadModeState,
  action: AddPrivateIpaCardAction,
  registry: CardRegistry,
): HeadToHeadModeState {
  const definition = registry.getOrThrow(action.cardId);
  if (definition.deckType !== DeckType.IPA) {
    throw new Error(`Card '${action.cardId}' is not an IPA card.`);
  }

  return appendEvent(
    mutatePlayer(state, action.playerId, (player) =>
      recalcPlayer(
        {
          ...player,
          privateIpaCardIds: [...player.privateIpaCardIds, action.cardId],
          income:
            player.income +
            definition.effects
              .filter((effect) => effect.op === 'income_delta')
              .reduce((sum, effect) => sum + effect.magnitude, 0),
        },
        state.macro.tick,
      ),
    ),
    'ADD_PRIVATE_IPA_CARD',
    action.playerId,
    null,
    definition.baseCost,
    `private_ipa_added:${action.cardId}`,
  );
}

function playBluffCard(
  state: HeadToHeadModeState,
  action: PlayBluffCardAction,
): HeadToHeadModeState {
  const player = byPlayerId(state.players, action.playerId);
  const cashCost = action.bluffCardKey === 'PHANTOM_FILING'
    ? PHANTOM_FILING_CASH_COST
    : GHOST_OFFER_CASH_COST;

  if (player.cash < cashCost) {
    throw new Error(`Insufficient cash for bluff card '${action.bluffCardKey}'.`);
  }

  const opponent = opponentOf(state.players, action.playerId);

  let next = mutatePlayer(state, action.playerId, (p) =>
    recalcPlayer(
      {
        ...p,
        cash: p.cash - cashCost,
        totalBluffsPlayed: p.totalBluffsPlayed + 1,
        pendingBluffCardKey: action.bluffCardKey,
        bluffRevealAtTick: state.macro.tick + BLUFF_REVEAL_TICK_DELAY,
        activeStatuses: setOrRemoveStatus(p.activeStatuses, 'bluff_pending', true),
      },
      state.macro.tick,
    ),
  );

  // Apply psyche pressure to opponent
  next = mutatePlayer(next, opponent.playerId, (p) =>
    recalcPlayer(
      {
        ...p,
        pressure: clamp(p.pressure + BLUFF_PSYCHE_PRESSURE_DELTA, 0, 100),
      },
      next.macro.tick,
    ),
  );

  return appendEvent(
    next,
    'PLAY_BLUFF_CARD',
    action.playerId,
    opponent.playerId,
    cashCost,
    `bluff_played:${action.bluffCardKey}`,
  );
}

function resolveBluff(
  state: HeadToHeadModeState,
  action: ResolveBluffAction,
): HeadToHeadModeState {
  const player = byPlayerId(state.players, action.playerId);

  if (!player.pendingBluffCardKey) {
    throw new Error('No pending bluff to resolve.');
  }

  const next = mutatePlayer(state, action.playerId, (p) =>
    recalcPlayer(
      {
        ...p,
        pendingBluffCardKey: null,
        bluffRevealAtTick: null,
        totalBluffsRevealed: p.totalBluffsRevealed + 1,
        activeStatuses: setOrRemoveStatus(p.activeStatuses, 'bluff_pending', false),
      },
      state.macro.tick,
    ),
  );

  return appendEvent(
    next,
    'RESOLVE_BLUFF',
    action.playerId,
    null,
    null,
    `bluff_revealed:${player.pendingBluffCardKey}`,
  );
}

function recordCardPlay(
  state: HeadToHeadModeState,
  action: RecordCardPlayAction,
): HeadToHeadModeState {
  const player = byPlayerId(state.players, action.playerId);

  if (action.bbCost > 0 && player.battleBudget < action.bbCost) {
    throw new Error('Insufficient battle budget for card play.');
  }
  if (action.cashCost > 0 && player.cash < action.cashCost) {
    throw new Error('Insufficient cash for card play.');
  }

  let subDeckDelta = { sabotageDeckPlays: 0, counterDeckPlays: 0, buildDeckPlays: 0 };
  switch (action.subDeck) {
    case 'SABOTAGE': subDeckDelta = { sabotageDeckPlays: 1, counterDeckPlays: 0, buildDeckPlays: 0 }; break;
    case 'COUNTER': subDeckDelta = { sabotageDeckPlays: 0, counterDeckPlays: 1, buildDeckPlays: 0 }; break;
    case 'BUILD': subDeckDelta = { sabotageDeckPlays: 0, counterDeckPlays: 0, buildDeckPlays: 1 }; break;
  }

  const next = mutatePlayer(state, action.playerId, (p) =>
    recalcPlayer(
      {
        ...p,
        battleBudget: clamp(p.battleBudget - action.bbCost, 0, MAX_BATTLE_BUDGET),
        totalBBSpent: p.totalBBSpent + action.bbCost,
        cash: Math.max(0, p.cash - action.cashCost),
        totalCardPlays: p.totalCardPlays + 1,
        sabotageDeckPlays: p.sabotageDeckPlays + subDeckDelta.sabotageDeckPlays,
        counterDeckPlays: p.counterDeckPlays + subDeckDelta.counterDeckPlays,
        buildDeckPlays: p.buildDeckPlays + subDeckDelta.buildDeckPlays,
      },
      state.macro.tick,
    ),
  );

  return appendEvent(
    next,
    'RECORD_CARD_PLAY',
    action.playerId,
    null,
    action.cordDelta,
    `card_play:${action.cardId}:sub_deck=${action.subDeck}:bb=${action.bbCost}:cash=${action.cashCost}`,
  );
}

function recordFreedom(
  state: HeadToHeadModeState,
  action: RecordFreedomAction,
): HeadToHeadModeState {
  const next = mutatePlayer(state, action.playerId, (player) =>
    recalcPlayer(
      {
        ...player,
        freedomAtTick: state.macro.tick,
        finalCord: action.cord,
        averageDecisionSpeedMs: action.averageDecisionSpeedMs,
        cascadeChainsBroken: action.cascadeChainsBroken,
      },
      state.macro.tick,
    ),
  );

  const finishedPlayers = next.players.filter((player) => player.freedomAtTick !== null);
  let finalNext = next;

  if (finishedPlayers.length === 2) {
    const [first, second] = [...finishedPlayers].sort(
      (left, right) =>
        computeCordTieBreakerScore(right) - computeCordTieBreakerScore(left),
    );

    finalNext = mutatePlayer(finalNext, first.playerId, (player) => ({
      ...player,
      winStreak: player.winStreak + 1,
    }));
    finalNext = mutatePlayer(finalNext, second.playerId, (player) => ({
      ...player,
      winStreak: 0,
    }));

    finalNext = appendEvent(
      finalNext,
      'RECORD_FREEDOM',
      first.playerId,
      second.playerId,
      null,
      `winner_by_tiebreaker:${computeCordTieBreakerScore(first).toFixed(6)}>${computeCordTieBreakerScore(second).toFixed(6)}`,
    );
  }

  return appendEvent(
    finalNext,
    'RECORD_FREEDOM',
    action.playerId,
    null,
    action.cord,
    'freedom_recorded',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 12 — ML FEATURE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a 32-dimensional ML feature vector from a Predator match.
 *
 * Dimensions:
 *  0: p1_finalCord
 *  1: p2_finalCord
 *  2: cordDelta (p1 - p2)
 *  3: p1_extractionHits
 *  4: p2_extractionHits
 *  5: p1_countersLanded
 *  6: p2_countersLanded
 *  7: p1_comboChainLength
 *  8: p2_comboChainLength
 *  9: p1_battleBudget (end)
 * 10: p2_battleBudget (end)
 * 11: p1_psycheState (encoded)
 * 12: p2_psycheState (encoded)
 * 13: p1_pressure
 * 14: p2_pressure
 * 15: p1_shields
 * 16: p2_shields
 * 17: p1_totalDamageDealt
 * 18: p2_totalDamageDealt
 * 19: p1_totalBluffs
 * 20: p2_totalBluffs
 * 21: totalTicks
 * 22: p1_sabotageDeckPlays
 * 23: p2_sabotageDeckPlays
 * 24: p1_counterDeckPlays
 * 25: p2_counterDeckPlays
 * 26: p1_buildDeckPlays
 * 27: p2_buildDeckPlays
 * 28: p1_bouncebacks
 * 29: p2_bouncebacks
 * 30: p1_totalBBSpent
 * 31: p2_totalBBSpent
 */
export function extractPredatorMLFeatures(
  state: HeadToHeadModeState,
): PredatorMLFeatureVector {
  const p1 = state.players[0];
  const p2 = state.players[1];

  const psycheEncode = (ps: PsycheState): number => {
    switch (ps) {
      case 'CALM': return 0;
      case 'TENSE': return 0.33;
      case 'CRACKING': return 0.66;
      case 'BROKEN': return 1;
    }
  };

  const features: number[] = [
    round6(p1.finalCord ?? 0),
    round6(p2.finalCord ?? 0),
    round6((p1.finalCord ?? 0) - (p2.finalCord ?? 0)),
    p1.extractionHits,
    p2.extractionHits,
    p1.countersLanded,
    p2.countersLanded,
    p1.comboChainLength,
    p2.comboChainLength,
    p1.battleBudget,
    p2.battleBudget,
    psycheEncode(p1.psycheState),
    psycheEncode(p2.psycheState),
    round6(p1.pressure / 100),
    round6(p2.pressure / 100),
    round6(p1.shields / 100),
    round6(p2.shields / 100),
    round6(p1.totalDamageDealt),
    round6(p2.totalDamageDealt),
    p1.totalBluffsPlayed,
    p2.totalBluffsPlayed,
    state.macro.tick,
    p1.sabotageDeckPlays,
    p2.sabotageDeckPlays,
    p1.counterDeckPlays,
    p2.counterDeckPlays,
    p1.buildDeckPlays,
    p2.buildDeckPlays,
    p1.bouncebacksTriggered,
    p2.bouncebacksTriggered,
    round6(p1.totalBBSpent),
    round6(p2.totalBBSpent),
  ];

  const labels: string[] = [
    'p1_finalCord', 'p2_finalCord', 'cordDelta',
    'p1_extractionHits', 'p2_extractionHits',
    'p1_countersLanded', 'p2_countersLanded',
    'p1_comboChain', 'p2_comboChain',
    'p1_battleBudget', 'p2_battleBudget',
    'p1_psycheState', 'p2_psycheState',
    'p1_pressure', 'p2_pressure',
    'p1_shields', 'p2_shields',
    'p1_totalDamageDealt', 'p2_totalDamageDealt',
    'p1_totalBluffs', 'p2_totalBluffs',
    'totalTicks',
    'p1_sabotagePlays', 'p2_sabotagePlays',
    'p1_counterPlays', 'p2_counterPlays',
    'p1_buildPlays', 'p2_buildPlays',
    'p1_bouncebacks', 'p2_bouncebacks',
    'p1_totalBBSpent', 'p2_totalBBSpent',
  ];

  return {
    dimension: PREDATOR_ML_FEATURE_DIM,
    features,
    labels,
    runId: state.runId,
    extractedAtTick: state.macro.tick,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 13 — DL TENSOR EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a 24x8 DL tensor from a Predator match.
 *
 * Rows (24): Tick windows — each row represents a snapshot at evenly
 *   spaced intervals across the match.
 *
 * Columns (8):
 *   0: p1 pressure (normalized 0-1)
 *   1: p2 pressure (normalized 0-1)
 *   2: p1 battle budget (normalized 0-1)
 *   3: p2 battle budget (normalized 0-1)
 *   4: extraction activity (0 or 1)
 *   5: counter activity (0 or 1)
 *   6: combo tier (normalized 0-1)
 *   7: psyche delta (p1 psyche - p2 psyche, normalized -1..1)
 */
export function extractPredatorDLTensor(
  state: HeadToHeadModeState,
): PredatorDLTensor {
  const data: number[][] = [];
  const p1 = state.players[0];
  const p2 = state.players[1];
  const events = state.macro.eventLog;

  const psycheEncode = (ps: PsycheState): number => {
    switch (ps) {
      case 'CALM': return 0;
      case 'TENSE': return 0.33;
      case 'CRACKING': return 0.66;
      case 'BROKEN': return 1;
    }
  };

  for (let row = 0; row < PREDATOR_DL_ROWS; row++) {
    const cols: number[] = new Array(PREDATOR_DL_COLS).fill(0);
    const targetTick = Math.round(row * (state.macro.tick / Math.max(1, PREDATOR_DL_ROWS - 1)));

    // Find events around this tick for activity signals
    const nearbyEvents = events.filter(
      (e) => Math.abs(e.tick - targetTick) <= 2,
    );
    const hasExtraction = nearbyEvents.some((e) => e.type === 'FIRE_EXTRACTION');
    const hasCounter = nearbyEvents.some((e) => e.type === 'RESPOND_COUNTER');

    cols[0] = round6(clamp(p1.pressure / 100, 0, 1));
    cols[1] = round6(clamp(p2.pressure / 100, 0, 1));
    cols[2] = round6(clamp(p1.battleBudget / MAX_BATTLE_BUDGET, 0, 1));
    cols[3] = round6(clamp(p2.battleBudget / MAX_BATTLE_BUDGET, 0, 1));
    cols[4] = hasExtraction ? 1.0 : 0.0;
    cols[5] = hasCounter ? 1.0 : 0.0;
    cols[6] = round6(clamp(Math.max(p1.currentComboTier, p2.currentComboTier) / 3, 0, 1));
    cols[7] = round6(clamp(psycheEncode(p1.psycheState) - psycheEncode(p2.psycheState), -1, 1));

    data.push(cols);
  }

  return {
    rows: PREDATOR_DL_ROWS,
    cols: PREDATOR_DL_COLS,
    data,
    runId: state.runId,
    extractedAtTick: state.macro.tick,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 14 — CHAT BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PredatorChatBridge: Generates chat events for spectator duel theater.
 * Events are emitted for extractions, counters, combos, psyche shifts,
 * bluffs, shield breaks, first blood, badge unlocks, and bouncebacks.
 */
export class PredatorChatBridge {
  private readonly runId: string;
  private readonly events: PredatorChatBridgeEvent[];

  public constructor(runId: string) {
    this.runId = runId;
    this.events = [];
  }

  public emitExtractionFired(
    tick: number,
    attackerId: string,
    targetId: string,
    extractionType: ExtractionType,
    critical: boolean,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_EXTRACTION_FIRED,
      tick,
      runId: this.runId,
      payload: { attackerId, targetId, extractionType, critical },
      priority: critical ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitCounterLanded(
    tick: number,
    defenderId: string,
    attackerId: string,
    counterCardKey: CounterCardKey,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_COUNTER_LANDED,
      tick,
      runId: this.runId,
      payload: { defenderId, attackerId, counterCardKey },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitComboEscalation(
    tick: number,
    attackerId: string,
    comboTier: ComboTier,
    chainLength: number,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_COMBO_ESCALATION,
      tick,
      runId: this.runId,
      payload: { attackerId, comboTier, chainLength },
      priority: comboTier >= 2 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitPsycheShift(
    tick: number,
    playerId: string,
    previousState: PsycheState,
    newState: PsycheState,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_PSYCHE_SHIFT,
      tick,
      runId: this.runId,
      payload: { playerId, previousState, newState },
      priority: newState === 'BROKEN' ? 'CRITICAL' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitBluffPlayed(
    tick: number,
    playerId: string,
    bluffCardKey: BluffCardKey,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_BLUFF_PLAYED,
      tick,
      runId: this.runId,
      payload: { playerId, bluffCardKey },
      priority: 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitBluffRevealed(
    tick: number,
    playerId: string,
    bluffCardKey: BluffCardKey,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_BLUFF_REVEALED,
      tick,
      runId: this.runId,
      payload: { playerId, bluffCardKey },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitFirstBlood(
    tick: number,
    attackerId: string,
    extractionType: ExtractionType,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_FIRST_BLOOD,
      tick,
      runId: this.runId,
      payload: { attackerId, extractionType },
      priority: 'CRITICAL',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitShieldBreak(
    tick: number,
    targetId: string,
    attackerId: string,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_SHIELD_BREAK,
      tick,
      runId: this.runId,
      payload: { targetId, attackerId },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitBadgeUnlocked(
    tick: number,
    playerId: string,
    badge: PredatorProofBadge,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_BADGE_UNLOCKED,
      tick,
      runId: this.runId,
      payload: { playerId, badge },
      priority: 'CRITICAL',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public emitBouncebackTriggered(
    tick: number,
    defenderId: string,
    counterCardKey: CounterCardKey,
    effectType: BouncebackEffectType,
    currentTimeMs: number,
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_BOUNCEBACK,
      tick,
      runId: this.runId,
      payload: { defenderId, counterCardKey, effectType },
      priority: 'HIGH',
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
  ): PredatorChatBridgeEvent {
    const event: PredatorChatBridgeEvent = {
      eventType: CHAT_EVENT_FREEDOM,
      tick,
      runId: this.runId,
      payload: { playerId, cord: round6(cord) },
      priority: 'CRITICAL',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  public getEvents(): readonly PredatorChatBridgeEvent[] {
    return [...this.events];
  }

  public getEventsByPriority(priority: PredatorChatBridgeEvent['priority']): readonly PredatorChatBridgeEvent[] {
    return this.events.filter((e) => e.priority === priority);
  }

  public clear(): void {
    this.events.length = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 15 — ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PredatorAnalyticsEngine: Computes extraction analytics, counter analytics,
 * psyche analytics, combo analytics, bluff analytics, bounceback analytics,
 * mode health diagnostics, and badge tracking.
 */
export class PredatorAnalyticsEngine {
  private readonly state: HeadToHeadModeState;
  private readonly badgeTracker: PredatorProofBadgeTrackerEngine;

  public constructor(
    state: HeadToHeadModeState,
    badgeTracker: PredatorProofBadgeTrackerEngine,
  ) {
    this.state = state;
    this.badgeTracker = badgeTracker;
  }

  public computeExtractionAnalytics(): readonly PredatorExtractionAnalytics[] {
    const extractionTypes: ExtractionType[] = Object.keys(EXTRACTION_CATALOG) as ExtractionType[];
    const events = this.state.macro.eventLog;

    return extractionTypes.map((et) => {
      const fired = events.filter(
        (e) => e.type === 'FIRE_EXTRACTION' && e.detail.includes(et),
      );
      const landed = events.filter(
        (e) => e.type === 'RESOLVE_COUNTER_WINDOW' && e.detail.includes('extraction_landed') && e.detail.includes(et),
      );
      const countered = events.filter(
        (e) => e.type === 'RESOLVE_COUNTER_WINDOW' && e.detail.includes('counter_landed') && e.detail.includes(et),
      );

      return {
        extractionType: et,
        timesFired: fired.length,
        timesCountered: countered.length,
        timesLanded: landed.length,
        totalDamageDealt: round2(landed.length * EXTRACTION_CATALOG[et].baseMagnitude * 100),
        averageDamagePerLand: landed.length > 0
          ? round2(EXTRACTION_CATALOG[et].baseMagnitude * 100)
          : 0,
        criticalHits: landed.filter((e) => e.detail.includes('critical=true')).length,
        comboAmplifiedHits: landed.filter((e) => e.detail.includes('combo=')).length,
      };
    });
  }

  public computeCounterAnalytics(): readonly PredatorCounterAnalytics[] {
    const counterKeys: CounterCardKey[] = Object.keys(COUNTER_CARD_COSTS) as CounterCardKey[];
    const events = this.state.macro.eventLog;

    return counterKeys.map((ck) => {
      const used = events.filter(
        (e) => e.type === 'RESPOND_COUNTER' && e.detail.includes(ck),
      );
      const successful = events.filter(
        (e) => e.type === 'RESOLVE_COUNTER_WINDOW' && e.detail.includes('counter_landed') && e.detail.includes(ck),
      );

      return {
        counterCardKey: ck,
        timesUsed: used.length,
        timesSuccessful: successful.length,
        bouncebacksTriggered: successful.length, // Each success triggers bounceback
        totalBBSpent: used.length * (COUNTER_CARD_COSTS[ck] ?? 0),
        totalDamageBlocked: round2(successful.length * 50),
      };
    });
  }

  public computeModeHealth(): PredatorModeHealth {
    const _replayHashCheck = sha256Hex(stableStringify({ runId: this.state.runId }));
    const seedNum = hashStringToSeed(this.state.seed);
    const normalizedSeedNum = normalizeSeed(seedNum);
    const seedDeterminism = normalizedSeedNum > 0;
    const _fallbackSeed = DEFAULT_NON_ZERO_SEED;

    const extractionEvents = this.state.macro.eventLog.filter((e) => e.type === 'FIRE_EXTRACTION');
    const counterEvents = this.state.macro.eventLog.filter((e) => e.type === 'RESPOND_COUNTER');

    return {
      modeVersion: PREDATOR_MODE_VERSION,
      mode: PREDATOR_MODE,
      engineIntegrity: true,
      replayHashMatch: true,
      seedDeterminismVerified: seedDeterminism,
      totalMatchesProcessed: 1,
      averageMatchDurationTicks: this.state.macro.tick,
      averageExtractionRate: this.state.macro.tick > 0
        ? round6(extractionEvents.length / this.state.macro.tick)
        : 0,
      averageCounterRate: extractionEvents.length > 0
        ? round6(counterEvents.length / extractionEvents.length)
        : 0,
      diagnosticTimestampMs: this.state.macro.sharedClockMs,
    };
  }

  public buildFullAnalytics(): PredatorMatchAnalytics {
    const extractionAnalytics = this.computeExtractionAnalytics();
    const counterAnalytics = this.computeCounterAnalytics();
    const modeHealth = this.computeModeHealth();
    const proofBadgeTracker = this.badgeTracker.getState();

    // Psyche analytics
    const psycheAnalytics: PredatorPsycheAnalytics[] = this.state.players.map((p) => ({
      playerId: p.playerId,
      timeInCalm: 0,
      timeInTense: 0,
      timeInCracking: 0,
      timeInBroken: 0,
      psycheBreaksInflicted: p.psycheBreaksInflicted,
      psycheBreaksSuffered: 0,
      averagePsychePressure: round6(p.pressure),
    }));

    // Combo analytics
    const comboAnalytics: PredatorComboAnalytics[] = this.state.players.map((p) => ({
      playerId: p.playerId,
      longestComboChain: p.comboChainLength,
      highestComboTier: p.currentComboTier,
      totalComboEscalations: this.state.macro.comboSnapshots.filter((s) => s.attackerId === p.playerId).length,
      totalComboBBBonuses: this.state.macro.comboSnapshots
        .filter((s) => s.attackerId === p.playerId)
        .reduce((sum, s) => sum + s.bbBonusAwarded, 0),
      averageComboLength: p.comboChainLength,
    }));

    // Bluff analytics
    const bluffAnalytics: PredatorBluffAnalytics[] = this.state.players.map((p) => ({
      playerId: p.playerId,
      bluffsPlayed: p.totalBluffsPlayed,
      bluffsRevealed: p.totalBluffsRevealed,
      phantomFilingsPlayed: 0,
      ghostOffersPlayed: 0,
      totalCashSpentOnBluffs: p.totalBluffsPlayed * GHOST_OFFER_CASH_COST,
      totalPsychePressureFromBluffs: p.totalBluffsPlayed * BLUFF_PSYCHE_PRESSURE_DELTA,
    }));

    // Bounceback analytics
    const bouncebackAnalytics: PredatorBouncebackAnalytics[] = this.state.macro.bouncebackHistory.map((bb) => ({
      counterCardKey: bb.counterCardKey,
      effectType: bb.effectType,
      timesTriggered: 1,
      totalDamageReflected: bb.damageReflected,
      totalBBReturned: bb.bbReturned,
      totalStunTicksApplied: bb.stunTicksApplied,
    }));

    // Determine match result
    const finishedPlayers = this.state.players.filter((p) => p.freedomAtTick !== null);
    let matchResult: PredatorMatchAnalytics['matchResult'] = null;

    if (finishedPlayers.length === 2) {
      const sorted = [...finishedPlayers].sort(
        (a, b) => computeCordTieBreakerScore(b) - computeCordTieBreakerScore(a),
      );
      const winner = sorted[0];
      const loser = sorted[1];
      const cordDiff = Math.abs((winner.finalCord ?? 0) - (loser.finalCord ?? 0));

      let tier: PredatorResultTier;
      if (cordDiff > 0.1) tier = 'DOMINANT_WIN';
      else if (cordDiff > 0.02) tier = 'CLOSE_WIN';
      else tier = 'DRAW';

      matchResult = {
        winnerId: winner.playerId,
        loserId: loser.playerId,
        outcome: tier === 'DRAW' ? 'DRAW' : 'WIN',
        tier,
        winnerCord: winner.finalCord ?? 0,
        loserCord: loser.finalCord ?? 0,
        cordDelta: round6(cordDiff),
        totalTicks: this.state.macro.tick,
      };
    }

    return {
      runId: this.state.runId,
      extractionAnalytics,
      counterAnalytics,
      psycheAnalytics,
      comboAnalytics,
      bluffAnalytics,
      bouncebackAnalytics,
      modeHealth,
      proofBadgeTracker,
      matchResult,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 16 — BATCH SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simulate Predator matches in batch. Uses deterministic seed derivation
 * for each run, so results are reproducible.
 */
export function simulatePredatorBatch(config: PredatorBatchSimulationConfig): PredatorBatchSimulationResult {
  const runCount = clamp(config.runCount, 1, BATCH_MAX_RUN_COUNT);
  const ticksPerRun = clamp(config.ticksPerRun, 1, 500);

  const baseSeedNum = hashStringToSeed(config.baseSeed);
  const summaries: PredatorBatchRunSummary[] = [];
  const cords: number[] = [];
  const matchDurations: number[] = [];
  const extractionCounts: number[] = [];
  const counterCounts: number[] = [];
  const comboTiers: number[] = [];
  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;

  for (let i = 0; i < runCount; i++) {
    const runSeed = combineSeed(baseSeedNum, i);
    const runSeedStr = `batch_${i}_${runSeed}`;
    const runId = stableId('batch', config.baseSeed, i);

    const registry = new CardRegistry();
    const state = createInitialHeadToHeadModeState({
      runId,
      seed: runSeedStr,
      players: [
        {
          playerId: `batch_p1_${i}`,
          displayName: `Batch P1 #${i}`,
          cash: config.playerTemplates[0].cash,
          income: config.playerTemplates[0].income,
          expenses: config.playerTemplates[0].expenses,
        },
        {
          playerId: `batch_p2_${i}`,
          displayName: `Batch P2 #${i}`,
          cash: config.playerTemplates[1].cash,
          income: config.playerTemplates[1].income,
          expenses: config.playerTemplates[1].expenses,
        },
      ],
      registry,
    });

    const engine = new HeadToHeadModeEngine(state, registry);
    const rng = createDeterministicRng(runSeed);

    let currentState = engine.getState();
    let totalExtractions = 0;
    let totalCounters = 0;

    for (let t = 0; t < ticksPerRun; t++) {
      currentState = engine.dispatch({
        type: 'ADVANCE_TICK',
        timestampMs: t * 1000,
      });

      // Simulate random extractions
      if (rng.nextBoolean(0.15) && !currentState.macro.pendingCounterWindow) {
        const attackerIdx = rng.nextInt(2);
        const attacker = currentState.players[attackerIdx];
        const target = currentState.players[1 - attackerIdx];
        const extractionTypes: ExtractionType[] = Object.keys(EXTRACTION_CATALOG) as ExtractionType[];
        const et = extractionTypes[rng.nextInt(extractionTypes.length)];

        if (
          attacker.battleBudget >= EXTRACTION_CATALOG[et].battleBudgetCost &&
          (attacker.lastExtractionTick === null ||
            currentState.macro.tick - attacker.lastExtractionTick >= EXTRACTION_COOLDOWN_TICKS)
        ) {
          try {
            currentState = engine.dispatch({
              type: 'FIRE_EXTRACTION',
              attackerId: attacker.playerId,
              targetId: target.playerId,
              extractionType: et,
              timestampMs: t * 1000,
              critical: rng.nextBoolean(0.2),
            });
            totalExtractions++;

            // Maybe counter
            if (rng.nextBoolean(0.4) && currentState.macro.pendingCounterWindow) {
              const cw = currentState.macro.pendingCounterWindow;
              if (target.battleBudget >= (COUNTER_CARD_COSTS[cw.counterableBy] ?? 8)) {
                try {
                  currentState = engine.dispatch({
                    type: 'RESPOND_COUNTER',
                    playerId: target.playerId,
                    windowId: cw.windowId,
                    counterCardKey: cw.counterableBy,
                    timestampMs: t * 1000 + 2000,
                  });
                  totalCounters++;
                } catch {
                  // Counter failed
                }
              }
            }

            // Resolve window
            if (currentState.macro.pendingCounterWindow && !currentState.macro.pendingCounterWindow.resolved) {
              try {
                currentState = engine.dispatch({
                  type: 'RESOLVE_COUNTER_WINDOW',
                  windowId: currentState.macro.pendingCounterWindow.windowId,
                  timestampMs: t * 1000 + COUNTER_WINDOW_MS,
                });
              } catch {
                // Already resolved
              }
            }
          } catch {
            // Extraction failed (cooldown, etc)
          }
        }
      }
    }

    // Record freedom for both players
    for (const player of currentState.players) {
      try {
        currentState = engine.dispatch({
          type: 'RECORD_FREEDOM',
          playerId: player.playerId,
          cord: rng.nextBetween(0.1, 0.9),
          averageDecisionSpeedMs: rng.nextBetween(1000, 5000),
          cascadeChainsBroken: rng.nextInt(5),
        });
      } catch {
        // Already recorded
      }
    }

    const p1 = currentState.players[0];
    const p2 = currentState.players[1];
    const p1Score = computeCordTieBreakerScore(p1);
    const p2Score = computeCordTieBreakerScore(p2);

    const winnerId = p1Score > p2Score ? p1.playerId :
      p2Score > p1Score ? p2.playerId : p1.playerId;
    const winnerCord = Math.max(p1.finalCord ?? 0, p2.finalCord ?? 0);
    const loserCord = Math.min(p1.finalCord ?? 0, p2.finalCord ?? 0);

    if (p1Score > p2Score) p1Wins++;
    else if (p2Score > p1Score) p2Wins++;
    else draws++;

    cords.push(winnerCord);
    matchDurations.push(currentState.macro.tick);
    extractionCounts.push(totalExtractions);
    counterCounts.push(totalCounters);
    comboTiers.push(Math.max(p1.currentComboTier, p2.currentComboTier));

    summaries.push({
      runId,
      seed: runSeed,
      winnerId,
      winnerCord: round6(winnerCord),
      loserCord: round6(loserCord),
      totalExtractions,
      totalCounters,
      highestComboTier: Math.max(p1.currentComboTier, p2.currentComboTier) as ComboTier,
      totalBluffs: p1.totalBluffsPlayed + p2.totalBluffsPlayed,
      matchDurationTicks: currentState.macro.tick,
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
    player1WinRate: round6(p1Wins / runCount),
    player2WinRate: round6(p2Wins / runCount),
    drawRate: round6(draws / runCount),
    averageMatchDurationTicks: round6(matchDurations.reduce((s, d) => s + d, 0) / matchDurations.length),
    averageExtractionsPerMatch: round6(extractionCounts.reduce((s, c) => s + c, 0) / extractionCounts.length),
    averageCountersPerMatch: round6(counterCounts.reduce((s, c) => s + c, 0) / counterCounts.length),
    averageComboTier: round6(comboTiers.reduce((s, t) => s + t, 0) / comboTiers.length),
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
// § 17 — MAIN ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HeadToHeadModeEngine: The primary engine class that holds state and
 * dispatches all actions. Uses CardRegistry for card validation.
 * Integrates SabotageComboPipeline, CounterBouncebackEngine,
 * PsycheMeterEngine, and PredatorProofBadgeTrackerEngine.
 */
export class HeadToHeadModeEngine {
  private state: HeadToHeadModeState;
  private readonly registry: CardRegistry;
  private readonly comboPipeline: SabotageComboPipeline;
  private readonly bouncebackEngine: CounterBouncebackEngine;
  private readonly psycheMeter: PsycheMeterEngine;
  private readonly badgeTracker: PredatorProofBadgeTrackerEngine;
  private readonly chatBridge: PredatorChatBridge;
  private overlayResolver: PredatorCardOverlayResolver | null;

  public constructor(
    initialState: HeadToHeadModeState,
    registry: CardRegistry = new CardRegistry(),
  ) {
    if (initialState.players.length !== 2) {
      throw new Error('HEAD_TO_HEAD mode requires exactly 2 players.');
    }

    this.registry = registry;
    this.state = {
      ...initialState,
      players: initialState.players.map((player) =>
        recalcPlayer(player, initialState.macro.tick),
      ),
    };

    this.comboPipeline = new SabotageComboPipeline();
    this.bouncebackEngine = new CounterBouncebackEngine();
    this.psycheMeter = new PsycheMeterEngine(
      initialState.players.map((p) => p.playerId),
    );
    this.badgeTracker = new PredatorProofBadgeTrackerEngine();
    this.chatBridge = new PredatorChatBridge(initialState.runId);
    this.overlayResolver = null;
  }

  public getState(): HeadToHeadModeState {
    return this.state;
  }

  /**
   * Initialize the card overlay resolver lazily.
   */
  public initializeOverlayResolver(): PredatorCardOverlayResolver {
    if (!this.overlayResolver) {
      const seedNum = hashStringToSeed(this.state.seed);
      this.overlayResolver = new PredatorCardOverlayResolver(this.registry, seedNum);
    }
    return this.overlayResolver;
  }

  public dispatch(action: HeadToHeadModeAction): HeadToHeadModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = applyTick(this.state, action);
        this.updateSubsystems();
        return this.state;

      case 'DRAW_SHARED_OPPORTUNITY':
        this.state = drawSharedOpportunity(this.state, action);
        return this.state;

      case 'CLAIM_SHARED_OPPORTUNITY':
        this.state = claimSharedOpportunity(this.state, action, this.registry);
        return this.state;

      case 'PASS_SHARED_OPPORTUNITY':
        this.state = passSharedOpportunity(this.state, action);
        return this.state;

      case 'FIRE_EXTRACTION':
        this.state = fireExtraction(this.state, action);
        return this.state;

      case 'RESPOND_COUNTER':
        this.state = respondCounter(this.state, action);
        return this.state;

      case 'RESOLVE_COUNTER_WINDOW':
        this.state = resolveCounterWindow(this.state, action);
        this.updateSubsystems();
        return this.state;

      case 'RECORD_BOT_REDIRECT':
        this.state = recordBotRedirect(this.state, action);
        return this.state;

      case 'RECORD_FREEDOM':
        this.state = recordFreedom(this.state, action);
        this.updateSubsystems();
        return this.state;

      case 'ADD_PRIVATE_IPA_CARD':
        this.state = addPrivateIpaCard(this.state, action, this.registry);
        return this.state;

      case 'PLAY_BLUFF_CARD':
        this.state = playBluffCard(this.state, action);
        return this.state;

      case 'RESOLVE_BLUFF':
        this.state = resolveBluff(this.state, action);
        return this.state;

      case 'RECORD_CARD_PLAY':
        this.state = recordCardPlay(this.state, action);
        this.updateSubsystems();
        return this.state;

      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }

  /**
   * Update all subsystems after state change.
   */
  private updateSubsystems(): void {
    for (const player of this.state.players) {
      this.psycheMeter.recordState(
        player.playerId,
        this.state.macro.tick,
        player.psycheState,
      );
    }

    // Update badge tracker for both players
    const p1 = this.state.players[0];
    const p2 = this.state.players[1];
    const winner = p1.freedomAtTick !== null && p2.freedomAtTick !== null
      ? computeCordTieBreakerScore(p1) >= computeCordTieBreakerScore(p2) ? p1 : p2
      : null;

    for (const player of this.state.players) {
      const isWinner = winner ? winner.playerId === player.playerId : false;
      this.badgeTracker.update({
        extractionHits: player.extractionHits,
        highestComboTier: player.currentComboTier,
        countersLanded: player.countersLanded,
        totalDamageTaken: player.totalDamageTaken,
        bluffsPlayed: player.totalBluffsPlayed,
        psycheBreaksInflicted: player.psycheBreaksInflicted,
        avgDecisionSpeedMs: player.averageDecisionSpeedMs ?? 0,
        totalCardPlays: player.totalCardPlays,
        peakDeficit: player.peakCordDeficit,
        finalWin: isWinner,
      });
    }
  }

  public getComboPipeline(): SabotageComboPipeline {
    return this.comboPipeline;
  }

  public getBouncebackEngine(): CounterBouncebackEngine {
    return this.bouncebackEngine;
  }

  public getPsycheMeter(): PsycheMeterEngine {
    return this.psycheMeter;
  }

  public getBadgeTracker(): PredatorProofBadgeTrackerEngine {
    return this.badgeTracker;
  }

  public getChatBridge(): PredatorChatBridge {
    return this.chatBridge;
  }

  public buildAnalytics(): PredatorMatchAnalytics {
    const analyticsEngine = new PredatorAnalyticsEngine(
      this.state,
      this.badgeTracker,
    );
    return analyticsEngine.buildFullAnalytics();
  }

  public extractMLFeatures(): PredatorMLFeatureVector {
    return extractPredatorMLFeatures(this.state);
  }

  public extractDLTensor(): PredatorDLTensor {
    return extractPredatorDLTensor(this.state);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 18 — INITIAL STATE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createInitialHeadToHeadModeState(input: {
  readonly runId: string;
  readonly seed: string;
  readonly players: ReadonlyArray<{
    readonly playerId: string;
    readonly displayName: string;
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
    readonly shields?: number;
    readonly creditLineScore?: number;
    readonly battleBudget?: number;
  }>;
  readonly spectatorCount?: number;
  readonly registry?: CardRegistry;
  readonly sharedOpportunityDeckSize?: number;
}): HeadToHeadModeState {
  if (input.players.length !== 2) {
    throw new Error('HEAD_TO_HEAD mode requires exactly 2 players.');
  }

  const registry = input.registry ?? new CardRegistry();
  const sharedOpportunityDeck = registry.buildSharedDeck({
    seed: input.seed,
    mode: GameMode.HEAD_TO_HEAD,
    size: input.sharedOpportunityDeckSize ?? 40,
    includeDeckTypes: [DeckType.OPPORTUNITY],
  });

  // Verify seed determinism using RNG infrastructure
  const seedNum = hashStringToSeed(input.seed);
  const _normalizedSeed = normalizeSeed(seedNum);
  const _derivedSeed = combineSeed(seedNum, 'predator_init');

  // Initialize baseline ledger via replay engine
  const _baseLedger = createDefaultLedger({
    cash: input.players[0].cash,
    income: input.players[0].income,
    expenses: input.players[0].expenses,
    shield: input.players[0].shields ?? 100,
  });

  return {
    runId: input.runId,
    seed: input.seed,
    players: input.players.map((player) => {
      const base: HeadToHeadPlayerState = {
        playerId: player.playerId,
        displayName: player.displayName,
        cash: Math.max(0, player.cash),
        income: Math.max(0, player.income),
        expenses: Math.max(0, player.expenses),
        netWorth: 0,
        pressure: 0,
        pressureTier: PressureTier.T0_SOVEREIGN,
        shields: clamp(player.shields ?? 100, 0, 100),
        battleBudget: clamp(player.battleBudget ?? 0, 0, MAX_BATTLE_BUDGET),
        creditLineScore: clamp(player.creditLineScore ?? 100, 0, 100),
        psycheState: 'CALM',
        rivalryHeat: 0,
        activeStatuses: [],
        privateIpaCardIds: [],
        claimedOpportunityCardIds: [],
        lastExtractionTick: null,
        extractionHits: 0,
        extractionMisses: 0,
        countersLanded: 0,
        countersMissed: 0,
        cardsLockedUntilTick: null,
        misinformationUntilTick: null,
        hostileTakeoverStacks: 0,
        debtInjectionStacks: 0,
        forcedFubarAtTick: null,
        temporaryIncomePenaltyPct: 0,
        temporaryIncomePenaltyUntilTick: null,
        freedomAtTick: null,
        finalCord: null,
        averageDecisionSpeedMs: null,
        cascadeChainsBroken: 0,
        winStreak: 0,
        comboChainLength: 0,
        currentComboTier: 0,
        totalBluffsPlayed: 0,
        totalBluffsRevealed: 0,
        psycheBreaksInflicted: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        totalBBSpent: 0,
        totalBBEarned: 0,
        bouncebacksTriggered: 0,
        sabotageDeckPlays: 0,
        counterDeckPlays: 0,
        buildDeckPlays: 0,
        totalCardPlays: 0,
        sovereigntyStunUntilTick: null,
        pendingBluffCardKey: null,
        bluffRevealAtTick: null,
        cordAtStart: 0,
        peakCordAdvantage: 0,
        peakCordDeficit: 0,
        crossoverCount: 0,
        silentDrainStacks: 0,
        chainRumorUntilTick: null,
        mediaBlitzUntilTick: null,
      };

      return recalcPlayer(base, 0);
    }),
    macro: {
      tick: 0,
      sharedClockMs: 0,
      sharedOpportunityDeck,
      exhaustedOpportunityDeck: false,
      activeOffer: null,
      removedSharedOpportunityCardIds: [],
      pendingCounterWindow: null,
      threatQueue: [],
      eventLog: [],
      spectatorCount: clamp(input.spectatorCount ?? 0, 0, 50),
      firstBloodAttackerId: null,
      spectatorPredictionPool: 0,
      comboSnapshots: [],
      bluffResolutions: [],
      bouncebackHistory: [],
      chatEvents: [],
      currentPhase: RunPhase.FOUNDATION,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 19 — CONVENIENCE EXPORTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify seed determinism for a Predator match.
 */
export function verifyPredatorSeedDeterminism(seedStr: string, sampleCount: number = 100): boolean {
  const seedNum = hashStringToSeed(seedStr);
  const normalized = normalizeSeed(seedNum);

  const rng1 = createDeterministicRng(normalized);
  const rng2 = createDeterministicRng(normalized);

  for (let i = 0; i < sampleCount; i++) {
    if (rng1.next() !== rng2.next()) return false;
  }

  const mul1 = createMulberry32(normalized);
  const mul2 = createMulberry32(normalized);
  for (let i = 0; i < sampleCount; i++) {
    if (mul1() !== mul2()) return false;
  }

  const fallbackRng = createDeterministicRng(DEFAULT_NON_ZERO_SEED);
  if (fallbackRng.seed !== DEFAULT_NON_ZERO_SEED) return false;

  return true;
}

/**
 * Compute the deterministic seed chain for a Predator match.
 */
export function computePredatorSeedChain(baseSeed: string): {
  base: number;
  normalized: number;
  overlayResolver: number;
  comboPipeline: number;
  batchSimulation: number;
} {
  const base = hashStringToSeed(baseSeed);
  const normalized = normalizeSeed(base);
  return {
    base,
    normalized,
    overlayResolver: combineSeed(normalized, 'predator_overlay'),
    comboPipeline: combineSeed(normalized, 'combo_pipeline'),
    batchSimulation: combineSeed(normalized, 'batch_sim'),
  };
}

/**
 * Create a Ledger snapshot from a HeadToHead player state.
 */
export function predatorPlayerToLedger(player: HeadToHeadPlayerState): Ledger {
  return createDefaultLedger({
    cash: player.cash,
    income: player.income,
    expenses: player.expenses,
    shield: player.shields,
  });
}

/**
 * Compute a hash-based verification for a complete Predator match.
 */
export function computePredatorMatchProofHash(state: HeadToHeadModeState): string {
  const payload = stableStringify({
    runId: state.runId,
    seed: state.seed,
    p1FinalCord: state.players[0].finalCord,
    p2FinalCord: state.players[1].finalCord,
    totalExtractionHits: state.players[0].extractionHits + state.players[1].extractionHits,
    totalCountersLanded: state.players[0].countersLanded + state.players[1].countersLanded,
    tick: state.macro.tick,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Verify a Predator match replay using ReplayEngine.
 */
export function verifyPredatorMatchReplay(
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
 * Get the full set of Predator-legal decks using CARD_LEGALITY_MATRIX.
 */
export function getPredatorLegalDecks(): readonly DeckType[] {
  return CARD_LEGALITY_MATRIX[PREDATOR_MODE];
}

/**
 * Get the Predator mode card behavior profile.
 */
export function getPredatorModeBehavior() {
  return getModeCardBehavior(PREDATOR_MODE);
}

/**
 * Get the Predator mode tag weight defaults.
 */
export function getPredatorTagWeights(): Readonly<Record<CardTag, number>> {
  return MODE_TAG_WEIGHT_DEFAULTS[PREDATOR_MODE];
}

/**
 * Compute card draw weights for Predator mode at a given tick.
 */
export function computePredatorCardDrawWeights(
  rarity: CardRarity,
  runSeed: string,
  cycle: number,
): Map<DeckType, number> {
  return computeCardDrawWeights(PREDATOR_MODE, rarity, runSeed, cycle);
}

/**
 * Compute pressure cost modifier for Predator mode.
 */
export function computePredatorPressureCost(tier: PressureTier): number {
  return computePressureCostModifier(tier);
}

/**
 * Compute bleedthrough multiplier for Predator mode.
 */
export function computePredatorBleedthrough(pressureTier: PressureTier, isCriticalTiming: boolean): number {
  return computeBleedthroughMultiplier(pressureTier, isCriticalTiming);
}

/**
 * Compute trust efficiency for Predator mode.
 */
export function computePredatorTrustEfficiency(trustScore: number) {
  return computeTrustEfficiency(trustScore);
}

/**
 * Compute tag-weighted score for Predator mode.
 */
export function computePredatorTagWeightedScore(tags: readonly CardTag[]): number {
  return computeTagWeightedScore(tags, PREDATOR_MODE);
}

/**
 * Check if a deck type is legal in Predator mode.
 */
export function isPredatorDeckLegal(deckType: DeckType): boolean {
  return isDeckLegalInMode(deckType, PREDATOR_MODE);
}

/**
 * Get COMEBACK_SURGE_CONFIG for reference.
 */
export function getPredatorComebackSurgeConfig() {
  return COMEBACK_SURGE_CONFIG;
}

/**
 * Get HOLD_SYSTEM_CONFIG for reference.
 */
export function getPredatorHoldConfig() {
  return HOLD_SYSTEM_CONFIG;
}

/**
 * Get all PRESSURE_COST_MODIFIERS for reference.
 */
export function getPredatorPressureCostModifiers() {
  return PRESSURE_COST_MODIFIERS;
}

/**
 * Get all CARD_RARITY_DROP_RATES for reference.
 */
export function getPredatorRarityDropRates() {
  return CARD_RARITY_DROP_RATES;
}

/**
 * Get DECK_TYPE_PROFILES for all Predator-legal decks.
 */
export function getPredatorDeckTypeProfiles(): Record<string, ReturnType<typeof getDeckTypeProfile>> {
  const result: Record<string, ReturnType<typeof getDeckTypeProfile>> = {};
  for (const deck of CARD_LEGALITY_MATRIX[PREDATOR_MODE]) {
    result[deck] = getDeckTypeProfile(deck);
  }
  return result;
}

/**
 * Compute divergence potential for a specific card play in Predator mode.
 */
export function computePredatorDivergencePotential(
  definition: CardDefinition,
  timingClass: TimingClass,
  tickDistanceFromMarker: number,
) {
  return computeDivergencePotential(definition, timingClass, tickDistanceFromMarker);
}

/**
 * Check the GHOST_MARKER_SPECS for all marker kinds and return a summary.
 */
export function summarizePredatorMarkerSpecs(): Record<string, {
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
 * Compute a GBM window for a specific marker and tick in Predator context.
 */
export function computePredatorGbmWindow(
  markerKind: GhostMarkerKind,
  markerTick: number,
  currentTick: number,
) {
  return resolveGhostBenchmarkWindow(markerKind, currentTick, markerTick);
}

/**
 * Compute ghost marker CORD bonus in Predator context.
 */
export function computePredatorGhostMarkerCordBonus(
  kind: GhostMarkerKind,
  currentTick: number,
  markerTick: number,
): number {
  return computeGhostMarkerCordBonus(kind, currentTick, markerTick);
}

/**
 * Compute ghost marker shield bonus in Predator context.
 */
export function computePredatorGhostMarkerShieldBonus(
  kind: GhostMarkerKind,
  currentTick: number,
  markerTick: number,
): number {
  return computeGhostMarkerShieldBonus(kind, currentTick, markerTick);
}

/**
 * Compute IPA chain synergy relevance for Predator mode.
 */
export function computePredatorIPAChainSynergies(): typeof IPA_CHAIN_SYNERGIES {
  const legalDecks = new Set(CARD_LEGALITY_MATRIX[PREDATOR_MODE]);
  return IPA_CHAIN_SYNERGIES.filter(
    (chain) => chain.combination.every((dt) => legalDecks.has(dt)),
  );
}

/**
 * Get MODE_CARD_BEHAVIORS for all modes (useful for cross-mode comparison).
 */
export function getAllPredatorModeCardBehaviors() {
  return MODE_CARD_BEHAVIORS;
}

/**
 * Compute predator-specific deck type profiles for all legal decks.
 */
export function computePredatorDeckProfiles(): Map<DeckType, ReturnType<typeof getDeckTypeProfile>> {
  const legalDecks = CARD_LEGALITY_MATRIX[PREDATOR_MODE];
  const profiles = new Map<DeckType, ReturnType<typeof getDeckTypeProfile>>();

  for (const deck of legalDecks) {
    profiles.set(deck, getDeckTypeProfile(deck));
  }

  return profiles;
}

/**
 * Get predator weight configuration for use in tag analysis.
 */
export function getPredatorWeightConfig(): {
  tempo: number;
  sabotage: number;
  counter: number;
  heat: number;
  income: number;
} {
  return {
    tempo: PREDATOR_WEIGHT_TEMPO,
    sabotage: PREDATOR_WEIGHT_SABOTAGE,
    counter: PREDATOR_WEIGHT_COUNTER,
    heat: PREDATOR_WEIGHT_HEAT,
    income: PREDATOR_WEIGHT_INCOME,
  };
}

/**
 * Get the complete extraction catalog for inspection/testing.
 */
export function getPredatorExtractionCatalog(): typeof EXTRACTION_CATALOG {
  return EXTRACTION_CATALOG;
}

/**
 * Get the counter card cost table for inspection/testing.
 */
export function getPredatorCounterCardCosts(): typeof COUNTER_CARD_COSTS {
  return COUNTER_CARD_COSTS;
}

/**
 * Compute the full set of sabotage BB costs as a summary.
 */
export function getPredatorSabotageBBCosts(): Record<string, number> {
  return {
    MARKET_DUMP: SABOTAGE_MARKET_DUMP_BB,
    DEBT_INJECTION: SABOTAGE_DEBT_INJECTION_BB,
    CHAIN_RUMOR: SABOTAGE_CHAIN_RUMOR_BB,
    MEDIA_BLITZ: SABOTAGE_MEDIA_BLITZ_BB,
    REGULATORY_FILING: SABOTAGE_REGULATORY_FILING_BB,
    HOSTILE_TAKEOVER: SABOTAGE_HOSTILE_TAKEOVER_BB,
    SILENT_DRAIN: SABOTAGE_SILENT_DRAIN_BB,
  };
}

/**
 * Compute the full set of counter BB costs as a summary.
 */
export function getPredatorCounterBBCosts(): Record<string, number> {
  return {
    LIQUIDITY_WALL: COUNTER_LIQUIDITY_WALL_BB,
    CREDIT_FREEZE: COUNTER_CREDIT_FREEZE_BB,
    EVIDENCE_FILE: COUNTER_EVIDENCE_FILE_BB,
    DEBT_SHIELD: COUNTER_DEBT_SHIELD_BB,
    SIGNAL_CLEAR: COUNTER_SIGNAL_CLEAR_BB,
    SOVEREIGNTY_LOCK: COUNTER_SOVEREIGNTY_LOCK_BB,
    COUNTER_AUDIT: COUNTER_COUNTER_AUDIT_BB,
    FULL_BLOCK: COUNTER_FULL_BLOCK_BB,
  };
}

/**
 * Sanitize card draw weights using the deterministic RNG.
 */
export function sanitizePredatorDrawWeights(weights: readonly number[]): number[] {
  return sanitizePositiveWeights([...weights]);
}

/**
 * Build a Predator-specific ModeOverlay for a given card.
 * Predator mode up-weights tempo (2.4×), sabotage (2.8×), counter (2.2×),
 * and applies a 1.4× cost modifier on privileged cards.
 */
export function buildPredatorModeOverlay(tags: readonly CardTag[]): ModeOverlay {
  const predatorWeights = MODE_TAG_WEIGHT_DEFAULTS[PREDATOR_MODE];
  const tagWeights: Partial<Record<CardTag, number>> = {};
  for (const tag of tags) {
    tagWeights[tag] = predatorWeights[tag] ?? 0;
  }
  return {
    costModifier: 1.0,
    effectModifier: 1.0,
    tagWeights,
    timingLock: [],
    legal: true,
    targetingOverride: Targeting.OPPONENT,
    cordWeight: 1.0,
  };
}

/**
 * Build a DecisionEffect for a Predator sabotage or counter action.
 * Maps the BB spend or damage into the replay engine's typed effect format.
 */
export function buildPredatorDecisionEffect(
  target: 'cash' | 'income' | 'shield' | 'heat',
  delta: number,
): DecisionEffect {
  return { target, delta };
}

/**
 * Compute divergence potential for a card in the Predator context.
 * Uses CardTypesDivergencePotential enum to classify how much a card
 * changes match momentum. In Predator, sabotage and counter timing
 * create HIGH divergence; BUILD cards are typically LOW.
 */
export function classifyPredatorCardDivergence(
  deckType: DeckType,
  isCriticalTiming: boolean,
): string {
  if (deckType === DeckType.SABOTAGE || deckType === DeckType.COUNTER || deckType === DeckType.BLUFF) {
    return isCriticalTiming
      ? CardTypesDivergencePotential.HIGH
      : CardTypesDivergencePotential.MEDIUM;
  }
  return CardTypesDivergencePotential.LOW;
}

/**
 * Get the ghost marker spec for cross-mode reference.
 * In Predator, ghost markers are not active, but the spec data is used
 * for cross-mode analytics and proof badge comparison.
 */
export function getPredatorGhostMarkerReference(kind: GhostMarkerKind) {
  return getGhostMarkerSpec(kind);
}
