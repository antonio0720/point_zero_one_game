// backend/src/game/engine/card_effects_executor.ts

/**
 * POINT ZERO ONE — BACKEND CARD EFFECTS EXECUTOR
 * backend/src/game/engine/card_effects_executor.ts
 * VERSION: 2026.03.28
 * AUTHORSHIP: Antonio T. Smith Jr.
 *
 * Responsibilities:
 * ─────────────────
 * • Authoritative card effect execution: timing validation, currency resolution,
 *   resource delta computation, CORD scoring, and immutable result contracts.
 * • 24-dim ML feature vector extraction from every card play signal.
 * • Full ML model scoring pipeline wired through ChatMlModelStack conventions:
 *   engagement → hater → helper → churn → intervention.
 * • Mode-native chat signal emission: social pressure snapshots, witness posture,
 *   audience heat deltas, and proof-bearing transcript edges.
 * • Mode-native chat posture table: Empire / Predator / Syndicate / Phantom.
 * • CardEffectsExecutorHub: master orchestrator wired into engine/index.ts.
 *
 * Doctrine:
 * ─────────
 * • No circular imports with engine/index.ts or any subsystem barrel.
 * • All imports accessed in live code — no placeholder symbols.
 * • All constants wired — none declared and abandoned.
 * • round6 gates every float leaving a scoring or ML surface.
 * • clamp01 gates every feature that must stay in [0, 1].
 * • Depth is social + computational: every score drives a chat decision.
 * • Four modes: Empire (GO_ALONE), Predator (HEAD_TO_HEAD),
 *   Syndicate (TEAM_UP), Phantom (CHASE_A_LEGEND).
 */

// ─── Node / crypto ────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

// ─── Card types — enrichment imports not locally defined ──────────────────────
import {
  RunPhase,
  PressureTier,
  CardRarity,
  Counterability,
  type ModeCode,
  MODE_CODE_MAP,
  resolveCurrencyForCard as resolveCurrencyFromCardTypes,
  TIMING_CLASS_WINDOW_MS,
  CARD_LEGALITY_MATRIX,
  TIMING_CLASS_MODE_MATRIX,
  TIMING_WINDOW_TICKS,
} from './card_types';

// ─── Chat brand types + utilities ─────────────────────────────────────────────
import type {
  Score01,
  UnixMs,
  Nullable,
  ChatRoomId,
  ChatSessionId,
  ChatUserId,
  ChatProofEdgeId,
  ChatProofHash,
  ChatSceneId,
} from './chat/types';
import {
  clamp01,
  asUnixMs,
  asChatProofHash,
} from './chat/types';

// ─── Chat ML inference stack ──────────────────────────────────────────────────
import {
  // Model classes (persistent instances for lifecycle + audit)
  EngagementModel,
  HaterTargetingModel,
  HelperTimingModel,
  ChurnRiskModel,
  InterventionPolicyModel,
  // Factories (deterministic instantiation)
  createEngagementModel,
  createHaterTargetingModel,
  createHelperTimingModel,
  createChurnRiskModel,
  createInterventionPolicyModel,
  // Standalone aggregate scoring (batch / cross-model passes)
  scoreEngagementAggregate,
  scoreHaterTargetingAggregate,
  scoreHelperTimingAggregate,
  scoreChurnRiskAggregate,
  scoreInterventionPolicyAggregate,
  // Engagement interpretation helpers
  engagementBandLabel,
  engagementIsElectric,
  engagementIsFrozen,
  // Churn interpretation helpers
  churnBandLabel,
  churnRiskNeedsRescue,
  // Intervention interpretation helpers
  interventionPolicySummary,
  // Helper interpretation helpers
  helperTimingShouldSpeak,
  // ML store + feature types
  type ChatOnlineFeatureAggregate,
  type ChatFeatureScalarMap,
  type ChatModelFamily,
  // Score result types
  type EngagementModelScore,
  type EngagementBand,
  type HaterTargetingScore,
  type HelperTimingScore,
  type ChurnRiskScore,
  type InterventionPolicyScore,
} from './chat/ml';

// ─── Zero engine social pressure + ML utilities ───────────────────────────────
import {
  computeSocialPressureVector,
  getModeNarrationPrefix,
  scoreModeCompetitiveWeight,
  narrateZeroMoment,
  ZERO_ML_FEATURE_DIMENSION,
  ZERO_ML_FEATURE_LABEL_KEYS,
  type ZeroSocialPressureVector,
} from './zero';

// ─── Core game state (optional enrichment path) ───────────────────────────────
import type { RunStateSnapshot } from './core/RunStateSnapshot';

// =============================================================================
// MARK: SECTION 2 — Exported Enums
// =============================================================================

export enum GameMode {
  GO_ALONE       = 'GO_ALONE',
  HEAD_TO_HEAD   = 'HEAD_TO_HEAD',
  TEAM_UP        = 'TEAM_UP',
  CHASE_A_LEGEND = 'CHASE_A_LEGEND',
}

export enum DeckType {
  OPPORTUNITY        = 'OPPORTUNITY',
  IPA                = 'IPA',
  FUBAR              = 'FUBAR',
  MISSED_OPPORTUNITY = 'MISSED_OPPORTUNITY',
  PRIVILEGED         = 'PRIVILEGED',
  SO                 = 'SO',
  SABOTAGE           = 'SABOTAGE',
  COUNTER            = 'COUNTER',
  AID                = 'AID',
  RESCUE             = 'RESCUE',
  DISCIPLINE         = 'DISCIPLINE',
  TRUST              = 'TRUST',
  BLUFF              = 'BLUFF',
  GHOST              = 'GHOST',
}

export enum TimingClass {
  PRE  = 'PRE',
  POST = 'POST',
  FATE = 'FATE',
  CTR  = 'CTR',
  RES  = 'RES',
  AID  = 'AID',
  GBM  = 'GBM',
  CAS  = 'CAS',
  PHZ  = 'PHZ',
  PSK  = 'PSK',
  END  = 'END',
  ANY  = 'ANY',
}

export enum CardTag {
  LIQUIDITY  = 'liquidity',
  INCOME     = 'income',
  RESILIENCE = 'resilience',
  SCALE      = 'scale',
  TEMPO      = 'tempo',
  SABOTAGE   = 'sabotage',
  COUNTER    = 'counter',
  HEAT       = 'heat',
  TRUST      = 'trust',
  AID        = 'aid',
  PRECISION  = 'precision',
  DIVERGENCE = 'divergence',
  VARIANCE   = 'variance',
  CASCADE    = 'cascade',
  MOMENTUM   = 'momentum',
}

export enum Targeting {
  SELF     = 'SELF',
  OPPONENT = 'OPPONENT',
  TEAMMATE = 'TEAMMATE',
  TEAM     = 'TEAM',
  GLOBAL   = 'GLOBAL',
  GHOST    = 'GHOST',
}

export enum CardEffectOp {
  CASH_DELTA         = 'cash_delta',
  INCOME_DELTA       = 'income_delta',
  EXPENSE_DELTA      = 'expense_delta',
  SHIELD_DELTA       = 'shield_delta',
  HEAT_DELTA         = 'heat_delta',
  TRUST_DELTA        = 'trust_delta',
  DIVERGENCE_DELTA   = 'divergence_delta',
  BATTLE_BUDGET_DELTA = 'battle_budget_delta',
  TREASURY_DELTA     = 'treasury_delta',
  DRAW_CARDS         = 'draw_cards',
  INJECT_CARD        = 'inject_card',
  STATUS_ADD         = 'status_add',
  STATUS_REMOVE      = 'status_remove',
  TIMER_FREEZE       = 'timer_freeze',
  CORD_BONUS_FLAT    = 'cord_bonus_flat',
  NO_OP              = 'no_op',
}

// =============================================================================
// MARK: SECTION 3 — Core Types and Interfaces
// =============================================================================

export type CurrencyType = 'cash' | 'battle_budget' | 'treasury' | 'none';

export interface CardEffectSpec {
  readonly op: CardEffectOp;
  readonly magnitude: number;
  readonly durationTicks?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ModeOverlay {
  readonly costModifier: number;
  readonly effectModifier: number;
  readonly tagWeights: Readonly<Partial<Record<CardTag, number>>>;
  readonly timingLock: readonly TimingClass[];
  readonly legal: boolean;
  readonly targetingOverride?: Targeting;
  readonly cordWeight: number;
}

export interface CardOverlaySnapshot {
  readonly costModifier?: number;
  readonly effectModifier?: number;
  readonly tagWeights?: Readonly<Partial<Record<CardTag, number>>>;
  readonly timingLock?: readonly TimingClass[];
  readonly legal?: boolean;
  readonly targetingOverride?: Targeting;
  readonly cordWeight?: number;
}

export interface CardDefinitionSnapshot {
  readonly cardId: string;
  readonly name: string;
  readonly deckType: DeckType;
  readonly targeting: Targeting;
  readonly baseCost: number;
  readonly timingClasses: readonly TimingClass[];
  readonly tags: readonly CardTag[];
  readonly educationalTag?: string;
  readonly effects: readonly CardEffectSpec[];
  readonly modeLegal?: readonly GameMode[];
  readonly modeOverlays?: Readonly<Partial<Record<GameMode, Partial<ModeOverlay>>>>;
}

/**
 * Enriched snapshot that extends `CardDefinitionSnapshot` with optional
 * rarity and counterability fields from `card_types.ts`. When present,
 * these unlock richer ML feature extraction in the executor hub.
 */
export interface CardDefinitionEnrichedSnapshot extends CardDefinitionSnapshot {
  readonly rarity?: CardRarity;
  readonly counterability?: Counterability;
  readonly autoResolve?: boolean;
  readonly decayTicks?: number | null;
}

export interface CardInHand {
  readonly instanceId: string;
  readonly definition: CardDefinitionSnapshot;
  readonly overlay?: CardOverlaySnapshot;
}

export interface CardPlayRequest {
  readonly instanceId: string;
  readonly choiceId: string;
  readonly timestamp: number;
  readonly timingClass?: TimingClass;
  readonly targetId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionContext {
  readonly mode: GameMode;
  readonly runSeed: string;
  readonly tickIndex: number;
  /** Run phase enrichment from card_types.RunPhase — optional, enhances ML features */
  readonly currentPhase?: RunPhase;
  /** Pressure tier enrichment from card_types.PressureTier — optional */
  readonly currentPressureTier?: PressureTier;
  readonly currentWindow?: TimingClass;
  readonly isFinalTick?: boolean;
  readonly activeFateWindow?: boolean;
  readonly activeCounterWindow?: boolean;
  readonly activeRescueWindow?: boolean;
  readonly activeAidWindow?: boolean;
  readonly activeGhostBenchmarkWindow?: boolean;
  readonly activeCascadeInterceptWindow?: boolean;
  readonly activePhaseBoundaryWindow?: boolean;
  readonly activePressureSpikeWindow?: boolean;
  readonly battleBudget?: number;
  readonly treasury?: number;
  readonly trustScore?: number;
  readonly divergenceScore?: number;
  readonly availableTargetIds?: readonly string[];
  readonly activeStatuses?: Readonly<Record<string, readonly string[]>>;
}

export interface AppliedEffect {
  readonly op: CardEffectOp;
  readonly baseMagnitude: number;
  readonly finalMagnitude: number;
  readonly durationTicks: number;
  readonly targeting: Targeting;
  readonly resolvedTargetId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ResourceDelta {
  readonly cash: number;
  readonly income: number;
  readonly expense: number;
  readonly shield: number;
  readonly heat: number;
  readonly trust: number;
  readonly divergence: number;
  readonly battleBudget: number;
  readonly treasury: number;
}

export interface TimingValidationResult {
  readonly ok: boolean;
  readonly requested: TimingClass;
  readonly effective: readonly TimingClass[];
  readonly reason?: string;
}

export interface CardEffectResult {
  readonly playId: string;
  readonly deterministicHash: string;
  readonly cardInstanceId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly mode: GameMode;
  readonly choiceId: string;
  readonly appliedAt: number;
  readonly timingClass: TimingClass;
  readonly effectiveCost: number;
  readonly currencyUsed: CurrencyType;
  readonly targeting: Targeting;
  readonly effects: readonly AppliedEffect[];
  readonly totalCordDelta: number;
  readonly resourceDelta: ResourceDelta;
  readonly drawCount: number;
  readonly injectedCardIds: readonly string[];
  readonly statusesAdded: readonly string[];
  readonly statusesRemoved: readonly string[];
  readonly isOptimalChoice: boolean;
  readonly educationalTag?: string;
}

export interface CardEffectExecutionItem {
  readonly card: CardInHand;
  readonly request: CardPlayRequest;
  readonly context: ExecutionContext;
  readonly isOptimalChoice?: boolean;
}

export interface CardEffectExecutionBatchResult {
  readonly results: readonly CardEffectResult[];
  readonly totalCordDelta: number;
  readonly playCount: number;
}

// =============================================================================
// MARK: SECTION 4 — Extended ML / Chat / Proof Interfaces
// =============================================================================

/** Dimension of the executor-specific card play ML feature vector. */
export const EXECUTOR_ML_FEATURE_DIMENSION = 24 as const;

/** Labels for each dimension of the executor ML feature vector. */
export const EXECUTOR_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'effective_cost_norm',        // 0  — effectiveCost / 25000 clamped [0, 1]
  'cost_modifier_norm',         // 1  — costModifier clamped [0, 2] → /2 → [0, 1]
  'effect_modifier_norm',       // 2  — effectModifier clamped [0, 2] → /2 → [0, 1]
  'cord_weight_norm',           // 3  — cordWeight clamped [0, 3] → /3 → [0, 1]
  'total_cord_delta_norm',      // 4  — totalCordDelta / 0.1 clamped [0, 1]
  'resource_cash_norm',         // 5  — cash delta mapped to [0, 1] via signed normalization
  'resource_income_norm',       // 6  — income delta mapped to [0, 1]
  'resource_shield_norm',       // 7  — shield delta mapped to [0, 1]
  'resource_heat_norm',         // 8  — heat delta mapped to [0, 1] (negative heat = 0)
  'resource_trust_norm',        // 9  — trust delta mapped to [0, 1]
  'draw_count_norm',            // 10 — drawCount / 5 clamped [0, 1]
  'inject_count_norm',          // 11 — injectedCardIds.length / 3 clamped [0, 1]
  'status_add_count_norm',      // 12 — statusesAdded.length / 5 clamped [0, 1]
  'status_remove_count_norm',   // 13 — statusesRemoved.length / 5 clamped [0, 1]
  'is_optimal_choice',          // 14 — 1 if isOptimalChoice else 0
  'tick_index_norm',            // 15 — tickIndex / 120 clamped [0, 1]
  'battle_budget_norm',         // 16 — battleBudget / 10000 clamped [0, 1]
  'treasury_norm',              // 17 — treasury / 10000 clamped [0, 1]
  'trust_score_norm',           // 18 — trustScore / 100 clamped [0, 1]
  'divergence_score_norm',      // 19 — divergenceScore / 1 clamped [0, 1]
  'mode_go_alone',              // 20 — 1 if GO_ALONE else 0
  'mode_head_to_head',          // 21 — 1 if HEAD_TO_HEAD else 0
  'mode_team_up',               // 22 — 1 if TEAM_UP else 0
  'mode_chase_a_legend',        // 23 — 1 if CHASE_A_LEGEND else 0
]);

/** Input object for ML feature extraction — enriched card definition snapshot. */
export interface ExecutorMLFeatureInput {
  readonly result: CardEffectResult;
  readonly context: ExecutionContext;
  readonly overlay: ModeOverlay;
  /** Optional rarity from CardDefinitionEnrichedSnapshot — when available, enriches feature 14+. */
  readonly rarity?: CardRarity;
  /** Optional counterability — drives suppression/attack scoring when present. */
  readonly counterability?: Counterability;
}

/** Executor-specific 24-dim card play ML feature vector. */
export interface CardExecutorMLFeatureVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimension: number;
  readonly cardId: string;
  readonly playId: string;
  readonly mode: GameMode;
  readonly tickIndex: number;
  readonly extractedAt: number;
  readonly isOptimalChoice: boolean;
  readonly totalCordDelta: number;
}

/**
 * Mode-native chat posture for card play broadcast.
 *
 * Empire  (GO_ALONE):       sovereignty, momentum, resilience
 * Predator (HEAD_TO_HEAD):  attack, counter, tempo
 * Syndicate (TEAM_UP):      trust, treasury, rescue
 * Phantom (CHASE_A_LEGEND): divergence, precision, benchmark
 */
export type CardPlayChatPosture =
  | 'EMPIRE_SOVEREIGNTY_CLAIM'
  | 'EMPIRE_MOMENTUM_FLEX'
  | 'EMPIRE_RESILIENCE_LOCK'
  | 'EMPIRE_SCALE_PUSH'
  | 'PREDATOR_ATTACK_BROADCAST'
  | 'PREDATOR_COUNTER_CLAIM'
  | 'PREDATOR_TEMPO_SEIZE'
  | 'PREDATOR_BLUFF_PLAY'
  | 'SYNDICATE_TRUST_OFFER'
  | 'SYNDICATE_TREASURY_SHARE'
  | 'SYNDICATE_RESCUE_COMMIT'
  | 'SYNDICATE_AID_DROP'
  | 'PHANTOM_DIVERGENCE_PUSH'
  | 'PHANTOM_PRECISION_ALIGN'
  | 'PHANTOM_BENCHMARK_CHALLENGE'
  | 'PHANTOM_GHOST_PLAY'
  | 'WITNESS_TRIGGER'
  | 'SILENT_EXECUTION';

/** Chat signal emitted for every card play — drives social pressure and chat broadcast. */
export interface CardPlayChatSignal {
  readonly playId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly mode: GameMode;
  readonly modeCode: string;
  readonly posture: CardPlayChatPosture;
  readonly headline: string;
  readonly subtext: string;
  readonly channel: string;
  readonly heatDelta: number;
  readonly witnessEligible: boolean;
  readonly proofWorthy: boolean;
  readonly tickIndex: number;
  readonly totalCordDelta: number;
  readonly resourceSummary: string;
  readonly suggestInterruptHelper: boolean;
  readonly suggestHaterAttention: boolean;
  readonly engagementSignal: 'electric' | 'rising' | 'stable' | 'frozen' | 'declining';
  readonly competitiveWeight: number;
  readonly narrativePrefix: string;
}

/** Proof-bearing transcript edge — audit, replay, and learning pipeline. */
export interface CardPlayProofEdge {
  readonly proofEdgeId: ChatProofEdgeId;
  readonly playId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly mode: GameMode;
  readonly tickIndex: number;
  readonly deterministicHash: ChatProofHash;
  readonly resourceDelta: ResourceDelta;
  readonly totalCordDelta: number;
  readonly effects: readonly AppliedEffect[];
  readonly isOptimalChoice: boolean;
  readonly chatSignal: CardPlayChatSignal;
  readonly mlFeatureVector: CardExecutorMLFeatureVector;
  readonly socialPressure: ZeroSocialPressureVector;
  readonly narrationText: string;
  readonly timestamp: UnixMs;
}

/** Witness scene — audience visibility record for proof-worthy plays. */
export interface CardPlayWitnessScene {
  readonly sceneId: ChatSceneId;
  readonly playId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly mode: GameMode;
  readonly posture: CardPlayChatPosture;
  readonly headline: string;
  readonly audienceHeat: number;
  readonly witnessCount: number;
  readonly timestamp: UnixMs;
}

/** Full 5-model ML scoring bundle for a single card play. */
export interface CardPlayMLScoreBundle {
  readonly playId: string;
  readonly engagement: EngagementModelScore;
  readonly hater: HaterTargetingScore;
  readonly helper: HelperTimingScore;
  readonly churn: ChurnRiskScore;
  readonly intervention: InterventionPolicyScore;
  readonly engagementLabel: string;
  readonly churnLabel: string;
  readonly interventionSummary: string;
  readonly isElectric: boolean;
  readonly isFrozen: boolean;
  readonly needsRescue: boolean;
  readonly helperShouldSpeak: boolean;
  readonly scoredAt: number;
}

/** A fully enriched execution result — standard result + ML + chat + proof. */
export interface CardEffectExecutionEnriched {
  readonly result: CardEffectResult;
  readonly mlFeatureVector: CardExecutorMLFeatureVector;
  readonly chatSignal: CardPlayChatSignal;
  readonly proofEdge: CardPlayProofEdge;
  readonly witnessScene: CardPlayWitnessScene;
  readonly mlScores: CardPlayMLScoreBundle;
  readonly socialPressure: ZeroSocialPressureVector;
  readonly executionDurationMs: number;
}

/** Batch enriched result — aggregated chat + social + ML across all plays. */
export interface CardEffectExecutionBatchEnriched {
  readonly items: readonly CardEffectExecutionEnriched[];
  readonly totalCordDelta: number;
  readonly playCount: number;
  readonly batchHeatDelta: number;
  readonly batchEngagementLabel: string;
  readonly batchWitnessCount: number;
  readonly batchProofCount: number;
  readonly dominantPosture: CardPlayChatPosture;
  readonly batchNarration: string;
  readonly modeCode: string;
  readonly zeroFeatureDimension: number;
}

/** Model instances held by the executor hub. */
export interface CardExecutorMLModels {
  readonly engagement: EngagementModel;
  readonly hater: HaterTargetingModel;
  readonly helper: HelperTimingModel;
  readonly churn: ChurnRiskModel;
  readonly intervention: InterventionPolicyModel;
}

// =============================================================================
// MARK: SECTION 5 — Constants
// =============================================================================

export const DEFAULT_MODE_OVERLAY: ModeOverlay = {
  costModifier:     1,
  effectModifier:   1,
  tagWeights:       {},
  timingLock:       [],
  legal:            true,
  cordWeight:       1,
};

export const MODE_TAG_WEIGHT_DEFAULTS: Record<GameMode, Record<CardTag, number>> = {
  [GameMode.GO_ALONE]: {
    [CardTag.LIQUIDITY]:  2.0,
    [CardTag.INCOME]:     2.2,
    [CardTag.RESILIENCE]: 1.8,
    [CardTag.SCALE]:      2.5,
    [CardTag.TEMPO]:      1.0,
    [CardTag.SABOTAGE]:   0.0,
    [CardTag.COUNTER]:    0.0,
    [CardTag.HEAT]:       0.6,
    [CardTag.TRUST]:      0.0,
    [CardTag.AID]:        0.0,
    [CardTag.PRECISION]:  1.2,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]:   1.0,
    [CardTag.CASCADE]:    1.8,
    [CardTag.MOMENTUM]:   2.0,
  },
  [GameMode.HEAD_TO_HEAD]: {
    [CardTag.LIQUIDITY]:  0.8,
    [CardTag.INCOME]:     0.6,
    [CardTag.RESILIENCE]: 1.0,
    [CardTag.SCALE]:      0.5,
    [CardTag.TEMPO]:      2.4,
    [CardTag.SABOTAGE]:   2.8,
    [CardTag.COUNTER]:    2.2,
    [CardTag.HEAT]:       1.5,
    [CardTag.TRUST]:      0.0,
    [CardTag.AID]:        0.0,
    [CardTag.PRECISION]:  0.8,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]:   1.4,
    [CardTag.CASCADE]:    1.2,
    [CardTag.MOMENTUM]:   1.5,
  },
  [GameMode.TEAM_UP]: {
    [CardTag.LIQUIDITY]:  1.5,
    [CardTag.INCOME]:     1.8,
    [CardTag.RESILIENCE]: 2.0,
    [CardTag.SCALE]:      1.3,
    [CardTag.TEMPO]:      1.0,
    [CardTag.SABOTAGE]:   0.2,
    [CardTag.COUNTER]:    0.5,
    [CardTag.HEAT]:       0.8,
    [CardTag.TRUST]:      3.0,
    [CardTag.AID]:        2.5,
    [CardTag.PRECISION]:  1.0,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]:   0.4,
    [CardTag.CASCADE]:    1.6,
    [CardTag.MOMENTUM]:   1.2,
  },
  [GameMode.CHASE_A_LEGEND]: {
    [CardTag.LIQUIDITY]:  1.2,
    [CardTag.INCOME]:     1.0,
    [CardTag.RESILIENCE]: 1.4,
    [CardTag.SCALE]:      0.9,
    [CardTag.TEMPO]:      1.8,
    [CardTag.SABOTAGE]:   0.0,
    [CardTag.COUNTER]:    0.0,
    [CardTag.HEAT]:       1.0,
    [CardTag.TRUST]:      0.0,
    [CardTag.AID]:        0.0,
    [CardTag.PRECISION]:  2.6,
    [CardTag.DIVERGENCE]: 3.0,
    [CardTag.VARIANCE]:   0.3,
    [CardTag.CASCADE]:    1.5,
    [CardTag.MOMENTUM]:   1.0,
  },
};

export const OP_CORD_COEFFICIENTS: Record<CardEffectOp, number> = {
  [CardEffectOp.CASH_DELTA]:          0.000004,
  [CardEffectOp.INCOME_DELTA]:        0.000005,
  [CardEffectOp.EXPENSE_DELTA]:      -0.000003,
  [CardEffectOp.SHIELD_DELTA]:        0.0002,
  [CardEffectOp.HEAT_DELTA]:         -0.00015,
  [CardEffectOp.TRUST_DELTA]:         0.000175,
  [CardEffectOp.DIVERGENCE_DELTA]:   -0.0002,
  [CardEffectOp.BATTLE_BUDGET_DELTA]: 0.00005,
  [CardEffectOp.TREASURY_DELTA]:      0.00003,
  [CardEffectOp.DRAW_CARDS]:          0.003,
  [CardEffectOp.INJECT_CARD]:         0.002,
  [CardEffectOp.STATUS_ADD]:          0.004,
  [CardEffectOp.STATUS_REMOVE]:       0.004,
  [CardEffectOp.TIMER_FREEZE]:        0.006,
  [CardEffectOp.CORD_BONUS_FLAT]:     1,
  [CardEffectOp.NO_OP]:               0,
};

/** Baseline audience heat contribution by deck type. */
const DECK_TYPE_HEAT_BASELINE: Record<DeckType, number> = {
  [DeckType.OPPORTUNITY]:        0.05,
  [DeckType.IPA]:                0.04,
  [DeckType.FUBAR]:              0.03,
  [DeckType.MISSED_OPPORTUNITY]: 0.02,
  [DeckType.PRIVILEGED]:         0.06,
  [DeckType.SO]:                 0.05,
  [DeckType.SABOTAGE]:           0.18,
  [DeckType.COUNTER]:            0.14,
  [DeckType.AID]:                0.07,
  [DeckType.RESCUE]:             0.12,
  [DeckType.DISCIPLINE]:         0.08,
  [DeckType.TRUST]:              0.06,
  [DeckType.BLUFF]:              0.15,
  [DeckType.GHOST]:              0.10,
};

/** CORD amplifier by mode — drives audience heat from cord delta. */
const CORD_HEAT_AMPLIFIER: Record<GameMode, number> = {
  [GameMode.GO_ALONE]:       0.8,
  [GameMode.HEAD_TO_HEAD]:   1.6,
  [GameMode.TEAM_UP]:        1.2,
  [GameMode.CHASE_A_LEGEND]: 1.0,
};

/** Mode-native primary channel for card play broadcast. */
const MODE_CHAT_CHANNEL_MAP: Record<GameMode, string> = {
  [GameMode.GO_ALONE]:       'GLOBAL',
  [GameMode.HEAD_TO_HEAD]:   'GLOBAL',
  [GameMode.TEAM_UP]:        'SYNDICATE',
  [GameMode.CHASE_A_LEGEND]: 'GLOBAL',
};

/** Timing window threshold (ms) above which a play is considered high-urgency. */
const TIMING_URGENCY_THRESHOLD_MS = 8_000 as const;

// =============================================================================
// MARK: SECTION 6 — Private Utility Functions
// =============================================================================

type MutableResourceDelta = {
  -readonly [K in keyof ResourceDelta]: ResourceDelta[K];
};

type ResourceDeltaKey = keyof ResourceDelta;

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function uniq<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function stableHash(
  parts: ReadonlyArray<string | number | boolean | undefined>,
): string {
  const payload = parts
    .filter((part): part is string | number | boolean => part !== undefined)
    .join('|');

  return createHash('sha256').update(payload).digest('hex');
}

function emptyResourceDelta(): MutableResourceDelta {
  return {
    cash:         0,
    income:       0,
    expense:      0,
    shield:       0,
    heat:         0,
    trust:        0,
    divergence:   0,
    battleBudget: 0,
    treasury:     0,
  };
}

function addResourceDelta(
  resourceDelta: MutableResourceDelta,
  key: ResourceDeltaKey,
  amount: number,
): void {
  resourceDelta[key] = round6(resourceDelta[key] + amount);
}

function freezeResourceDelta(resourceDelta: MutableResourceDelta): ResourceDelta {
  return Object.freeze({
    cash:         round6(resourceDelta.cash),
    income:       round6(resourceDelta.income),
    expense:      round6(resourceDelta.expense),
    shield:       round6(resourceDelta.shield),
    heat:         round6(resourceDelta.heat),
    trust:        round6(resourceDelta.trust),
    divergence:   round6(resourceDelta.divergence),
    battleBudget: round6(resourceDelta.battleBudget),
    treasury:     round6(resourceDelta.treasury),
  });
}

function freezeStringArray(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

function freezeUniqueStringArray(values: readonly string[]): readonly string[] {
  return Object.freeze(uniq(values));
}

function freezeAppliedEffects(values: readonly AppliedEffect[]): readonly AppliedEffect[] {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Maps a signed delta to [0, 1] via (delta / scale + 1) / 2. */
function signedNorm(delta: number, scale: number): number {
  return clamp((delta / Math.max(scale, 1) + 1) / 2, 0, 1);
}

/** Converts GameMode to the ModeCode string for zero-engine utility calls. */
function modeToModeCode(mode: GameMode): ModeCode {
  const entries = Object.entries(MODE_CODE_MAP) as Array<[ModeCode, GameMode]>;
  const found = entries.find(([, gm]) => gm === mode);
  return found ? found[0] : 'solo';
}

/** Maps CardRarity to a weight in [0, 1] for ML feature extraction. */
function rarityMLWeight(rarity: CardRarity): number {
  switch (rarity) {
    case CardRarity.COMMON:    return 0.10;
    case CardRarity.UNCOMMON:  return 0.35;
    case CardRarity.RARE:      return 0.65;
    case CardRarity.LEGENDARY: return 1.00;
    default:                   return 0.10;
  }
}

/** Maps Counterability to a suppression weight [0, 1] for ML feature extraction. */
function counterabilityMLWeight(counterability: Counterability): number {
  switch (counterability) {
    case Counterability.NONE: return 1.00;
    case Counterability.SOFT: return 0.60;
    case Counterability.HARD: return 0.20;
    default:                  return 0.60;
  }
}

/** Returns the current pressure tier severity in [0, 1] for ML. */
function pressureTierMLWeight(tier: PressureTier): number {
  switch (tier) {
    case PressureTier.T0_SOVEREIGN:         return 0.00;
    case PressureTier.T1_STABLE:            return 0.20;
    case PressureTier.T2_STRESSED:          return 0.50;
    case PressureTier.T3_ELEVATED:          return 0.75;
    case PressureTier.T4_COLLAPSE_IMMINENT: return 1.00;
    default:                                return 0.20;
  }
}

/** Returns the run phase position in [0, 1] for ML. */
function runPhaseMLWeight(phase: RunPhase): number {
  switch (phase) {
    case RunPhase.FOUNDATION:   return 0.00;
    case RunPhase.ESCALATION:   return 0.50;
    case RunPhase.SOVEREIGNTY:  return 1.00;
    default:                    return 0.25;
  }
}

/** Returns a human-readable description of a run phase. */
function describeRunPhase(phase: RunPhase): string {
  switch (phase) {
    case RunPhase.FOUNDATION:  return 'Foundation — building the base';
    case RunPhase.ESCALATION:  return 'Escalation — pressure mounting';
    case RunPhase.SOVEREIGNTY: return 'Sovereignty — final push to freedom';
    default:                   return 'Unknown phase';
  }
}

/** Returns a human-readable description of a pressure tier. */
function describePressureTier(tier: PressureTier): string {
  switch (tier) {
    case PressureTier.T0_SOVEREIGN:         return 'T0 Sovereign — zero pressure, dominant';
    case PressureTier.T1_STABLE:            return 'T1 Stable — normal operating range';
    case PressureTier.T2_STRESSED:          return 'T2 Stressed — elevated, attention needed';
    case PressureTier.T3_ELEVATED:          return 'T3 Elevated — high risk, intervention window';
    case PressureTier.T4_COLLAPSE_IMMINENT: return 'T4 Collapse Imminent — emergency rescue required';
    default:                                return 'Unknown tier';
  }
}

/** Returns the timing window duration in ms for a given TimingClass. */
function getTimingWindowMs(timingClass: TimingClass): number {
  return TIMING_CLASS_WINDOW_MS[timingClass] ?? 0;
}

/** Returns the timing window in ticks for a given TimingClass. */
function getTimingWindowTicks(timingClass: TimingClass): number {
  return TIMING_WINDOW_TICKS[timingClass] ?? 0;
}

/** Returns true if the timing class is legal for the given mode. */
function isTimingLegalForMode(timingClass: TimingClass, mode: GameMode): boolean {
  return TIMING_CLASS_MODE_MATRIX[timingClass]?.includes(mode) ?? false;
}

/** Returns deck types that are legal for a given mode. */
function getDeckTypesForMode(mode: GameMode): readonly DeckType[] {
  return CARD_LEGALITY_MATRIX[mode] ?? [];
}

/** Checks if a play is high urgency based on its timing window. */
function isHighUrgencyTiming(timingClass: TimingClass): boolean {
  return getTimingWindowMs(timingClass) <= TIMING_URGENCY_THRESHOLD_MS
    && timingClass !== TimingClass.ANY
    && timingClass !== TimingClass.PRE
    && timingClass !== TimingClass.POST;
}

/** Resolves currency using the richer card_types.ts helper with overlay support. */
function resolveCurrencyWithOverride(
  deckType: DeckType,
  mode: GameMode,
  currencyOverride?: CurrencyType,
): CurrencyType {
  if (currencyOverride) return currencyOverride;
  return resolveCurrencyFromCardTypes(deckType, mode);
}

// =============================================================================
// MARK: SECTION 7 — ML Feature Extraction
// =============================================================================

/**
 * Builds a `ChatOnlineFeatureAggregate` from a card play result and context.
 * This is the feature surface fed into the 5-model chat ML scoring pipeline.
 */
function buildCardPlayAggregate(
  result: CardEffectResult,
  context: ExecutionContext,
  nowMs: number,
): ChatOnlineFeatureAggregate {
  const rd = result.resourceDelta;

  const heatStress01      = clamp01(Math.abs(rd.heat) / 20);
  const cashStress01      = clamp01(Math.max(0, -rd.cash) / 50_000);
  const incomeBoost01     = clamp01(rd.income / 5_000);
  const shieldBoost01     = clamp01(rd.shield / 30);
  const trustBoost01      = clamp01(rd.trust / 20);
  const cordMomentum01    = clamp01(result.totalCordDelta / 0.10);
  const drawBoost01       = clamp01(result.drawCount / 5);
  const injectBoost01     = clamp01(result.injectedCardIds.length / 3);
  const statusPressure01  = clamp01((result.statusesAdded.length + result.statusesRemoved.length) / 8);
  const trustScore01      = clamp01((context.trustScore ?? 50) / 100);
  const divergence01      = clamp01(context.divergenceScore ?? 0);
  const battleBudget01    = clamp01((context.battleBudget ?? 0) / 10_000);
  const treasury01        = clamp01((context.treasury ?? 0) / 10_000);
  const tickNorm01        = clamp01(context.tickIndex / 120);
  const isOptimal01       = result.isOptimalChoice ? 1 : 0;
  const modePvp01         = context.mode === GameMode.HEAD_TO_HEAD ? 1 : 0;
  const modeCoop01        = context.mode === GameMode.TEAM_UP ? 1 : 0;
  const modeGhost01       = context.mode === GameMode.CHASE_A_LEGEND ? 1 : 0;
  const helpNeeded01      = clamp01(cashStress01 * 0.5 + heatStress01 * 0.3 + (1 - cordMomentum01) * 0.2);
  const hostileMomentum01 = clamp01(modePvp01 * 0.6 + heatStress01 * 0.4);
  const frustration01     = clamp01(heatStress01 * 0.5 + cashStress01 * 0.3 + (1 - isOptimal01) * 0.2);
  const pressureTierNorm  = context.currentPressureTier
    ? pressureTierMLWeight(context.currentPressureTier)
    : 0.2;
  const runPhaseNorm      = context.currentPhase
    ? runPhaseMLWeight(context.currentPhase)
    : 0.25;
  const rankingPressure   = modePvp01 * 0.8 + modeGhost01 * 0.4;

  const scalarFeatures: ChatFeatureScalarMap = {
    roomHeat01:                   clamp01(hostileMomentum01 * 0.6 + heatStress01 * 0.4),
    hostileMomentum01,
    churnRisk01:                  clamp01(cashStress01 * 0.6 + frustration01 * 0.4),
    responseCadence01:            clamp01(1 - frustration01),
    recentPlayerShare01:          0.5,
    recentNpcShare01:             clamp01(hostileMomentum01 * 0.7),
    helperReceptivity01:          clamp01(helpNeeded01 * 0.9),
    helperIgnore01:               clamp01(1 - helpNeeded01),
    rescueOpportunity01:          clamp01(cashStress01 * 0.7 + helpNeeded01 * 0.3),
    visibilityExposure01:         clamp01(hostileMomentum01 * 0.5 + cordMomentum01 * 0.5),
    switchStress01:               clamp01(pressureTierNorm * 0.5 + frustration01 * 0.5),
    averageMessageLength01:       0.5,
    helperDensity01:              clamp01(helpNeeded01 * 0.6),
    haterDensity01:               clamp01(hostileMomentum01 * 0.8 + heatStress01 * 0.2),
    roomCrowding01:               clamp01(modePvp01 * 0.7 + modeCoop01 * 0.3),
    confidence01:                 clamp01(cordMomentum01 * 0.5 + isOptimal01 * 0.5),
    frustration01,
    intimidation01:               clamp01(hostileMomentum01 * 0.8),
    attachment01:                 clamp01(modeCoop01 * 0.8 + trustScore01 * 0.2),
    curiosity01:                  clamp01(injectBoost01 * 0.6 + drawBoost01 * 0.4),
    embarrassment01:              clamp01(frustration01 * 0.6 + cashStress01 * 0.4),
    relief01:                     clamp01(shieldBoost01 * 0.5 + incomeBoost01 * 0.5),
    affinityGlobal01:             0.5,
    affinitySyndicate01:          modeCoop01,
    affinityDealRoom01:           modePvp01 * 0.7,
    affinityLobby01:              0.3,
    battleRescueWindowOpen01:     clamp01(helpNeeded01 * 0.8),
    battleShieldIntegrity01:      clamp01(shieldBoost01 * 0.9 + 0.1),
    runNearSovereignty01:         clamp01(runPhaseNorm > 0.8 ? 0.9 : runPhaseNorm),
    runBankruptcyWarning01:       clamp01(cashStress01 > 0.7 ? 0.8 : cashStress01),
    multiplayerRankingPressure01: rankingPressure,
    economyLiquidityStress01:     clamp01(cashStress01 * 0.6 + (1 - incomeBoost01) * 0.4),
    economyOverpayRisk01:         clamp01(cashStress01 * 0.7),
    economyBluffRisk01:           modePvp01 * 0.5,
    liveopsHeatMultiplier01:      0.3,
    liveopsHelperBlackout01:      0,
    liveopsHaterRaid01:           clamp01(heatStress01 * 0.5),
    toxicityRisk01:               clamp01(hostileMomentum01 * 0.6 + frustration01 * 0.4),
    silenceConcern01:             clamp01(helpNeeded01 * 0.5),
    battleLastAttackRecent01:     clamp01(heatStress01 * 0.7),
    trustDeficit01:               clamp01(1 - trustScore01),
    divergenceScore01:            divergence01,
    modeGhost01,
    modePvp01,
    modeCoop01,
    cordMomentum01,
    statusPressure01,
    drawBoost01,
    injectBoost01,
    trustBoost01,
    battleBudget01,
    treasury01,
    tickNorm01,
    pressureTierNorm,
    runPhaseNorm,
  };

  const categoricalFeatures: Record<string, string> = {
    silenceBand:        frustration01 > 0.7 ? 'HARD' : frustration01 > 0.4 ? 'STALE' : 'FRESH',
    roomSwarmDirection: hostileMomentum01 > 0.6 ? 'NEGATIVE' : 'NEUTRAL',
    contributorBand:    frustration01 < 0.3 ? 'QUIET' : frustration01 > 0.7 ? 'SWARM' : 'ACTIVE',
    sourceEventKind:    'CARD_PLAY',
    sourceChannel:      MODE_CHAT_CHANNEL_MAP[context.mode] ?? 'GLOBAL',
    roomStageMood:      context.mode === GameMode.HEAD_TO_HEAD ? 'PREDATOR' :
                        context.mode === GameMode.TEAM_UP ? 'SYNDICATE' :
                        context.mode === GameMode.CHASE_A_LEGEND ? 'PHANTOM' : 'EMPIRE',
    runMode:            context.mode,
    runPhase:           context.currentPhase ?? 'ESCALATION',
    invasionState:      hostileMomentum01 > 0.6 ? 'ACTIVE' : 'CLEAR',
    timingClass:        result.timingClass,
    currencyUsed:       result.currencyUsed,
  };

  const family: ChatModelFamily = 'ENGAGEMENT';

  return Object.freeze({
    family,
    entityKeys:           Object.freeze([result.playId]),
    roomId:               null as Nullable<ChatRoomId>,
    sessionId:            null as Nullable<ChatSessionId>,
    userId:               null as Nullable<ChatUserId>,
    generatedAt:          asUnixMs(nowMs),
    freshnessMs:          0,
    dominantChannel:      MODE_CHAT_CHANNEL_MAP[context.mode] ?? 'GLOBAL',
    tags:                 Object.freeze(['card_play', context.mode, result.cardId]),
    rows:                 Object.freeze([]) as never[],
    latestRow:            null,
    scalarFeatures:       Object.freeze(scalarFeatures) as ChatFeatureScalarMap,
    categoricalFeatures:  Object.freeze(categoricalFeatures),
    canonicalSnapshot:    null,
  });
}

/**
 * Extracts a 24-dim ML feature vector from a card play execution result.
 * Used for training data generation, pattern recognition, and real-time scoring.
 */
export function extractExecutorMLFeatureVector(
  input: ExecutorMLFeatureInput,
): CardExecutorMLFeatureVector {
  const { result, context, overlay, rarity, counterability } = input;
  const rd = result.resourceDelta;

  const features: number[] = [
    /* 0  */ clamp01(result.effectiveCost / 25_000),
    /* 1  */ clamp01(overlay.costModifier / 2),
    /* 2  */ clamp01(overlay.effectModifier / 2),
    /* 3  */ clamp01(overlay.cordWeight / 3),
    /* 4  */ clamp01(result.totalCordDelta / 0.1),
    /* 5  */ signedNorm(rd.cash, 25_000),
    /* 6  */ signedNorm(rd.income, 5_000),
    /* 7  */ signedNorm(rd.shield, 30),
    /* 8  */ signedNorm(rd.heat, 20),
    /* 9  */ signedNorm(rd.trust, 20),
    /* 10 */ clamp01(result.drawCount / 5),
    /* 11 */ clamp01(result.injectedCardIds.length / 3),
    /* 12 */ clamp01(result.statusesAdded.length / 5),
    /* 13 */ clamp01(result.statusesRemoved.length / 5),
    /* 14 */ result.isOptimalChoice ? 1 : 0,
    /* 15 */ clamp01(context.tickIndex / 120),
    /* 16 */ clamp01((context.battleBudget ?? 0) / 10_000),
    /* 17 */ clamp01((context.treasury ?? 0) / 10_000),
    /* 18 */ clamp01((context.trustScore ?? 50) / 100),
    /* 19 */ clamp01(context.divergenceScore ?? 0),
    /* 20 */ context.mode === GameMode.GO_ALONE ? 1 : 0,
    /* 21 */ context.mode === GameMode.HEAD_TO_HEAD ? 1 : 0,
    /* 22 */ context.mode === GameMode.TEAM_UP ? 1 : 0,
    /* 23 */ context.mode === GameMode.CHASE_A_LEGEND ? 1 : 0,
  ];

  // Optional enrichments — when available from CardDefinitionEnrichedSnapshot
  if (rarity !== undefined) {
    // Encode rarity weight into feature 0 blend (does not change dimension)
    features[0] = round6(features[0]! * 0.7 + rarityMLWeight(rarity) * 0.3);
  }
  if (counterability !== undefined) {
    // Encode counterability suppression into feature 4 blend
    features[4] = round6(features[4]! * counterabilityMLWeight(counterability));
  }

  return Object.freeze({
    features:       Object.freeze(features.map(round6)),
    labels:         EXECUTOR_ML_FEATURE_LABELS,
    dimension:      EXECUTOR_ML_FEATURE_DIMENSION,
    cardId:         result.cardId,
    playId:         result.playId,
    mode:           result.mode,
    tickIndex:      context.tickIndex,
    extractedAt:    Date.now(),
    isOptimalChoice: result.isOptimalChoice,
    totalCordDelta: result.totalCordDelta,
  });
}

// =============================================================================
// MARK: SECTION 8 — ML Scoring Pipeline
// =============================================================================

/**
 * Scores a card play against the full 5-model chat ML pipeline.
 * Returns a `CardPlayMLScoreBundle` with all score types and interpretation labels.
 */
export function scoreCardPlayMLBundle(
  result: CardEffectResult,
  context: ExecutionContext,
  nowMs = Date.now(),
): CardPlayMLScoreBundle {
  const aggregate = buildCardPlayAggregate(result, context, nowMs);

  const engagement  = scoreEngagementAggregate(aggregate);
  const hater       = scoreHaterTargetingAggregate(aggregate);
  const helper      = scoreHelperTimingAggregate(aggregate);
  const churn       = scoreChurnRiskAggregate({ aggregate });
  const intervention = scoreInterventionPolicyAggregate({ aggregate }).score;

  const engagementLabel   = engagementBandLabel(engagement.band as EngagementBand);
  const churnLabel        = churnBandLabel(churn);
  const interventionSumm  = interventionPolicySummary(intervention);
  const isElectric        = engagementIsElectric(engagement);
  const isFrozen          = engagementIsFrozen(engagement);
  const needsRescue       = churnRiskNeedsRescue(churn);
  const helperSpeak       = helperTimingShouldSpeak(helper);

  return Object.freeze({
    playId:              result.playId,
    engagement,
    hater,
    helper,
    churn,
    intervention,
    engagementLabel,
    churnLabel,
    interventionSummary: interventionSumm,
    isElectric,
    isFrozen,
    needsRescue,
    helperShouldSpeak:  helperSpeak,
    scoredAt:           nowMs,
  });
}

// =============================================================================
// MARK: SECTION 9 — Chat Signal Generation
// =============================================================================

/**
 * Resolves the mode-native chat posture for a card play based on:
 * - mode (Empire / Predator / Syndicate / Phantom)
 * - dominant card tags
 * - ML scores (engagement, hater)
 * - CORD delta magnitude
 */
function resolveCardPlayPosture(
  result: CardEffectResult,
  context: ExecutionContext,
  mlScores: CardPlayMLScoreBundle,
): CardPlayChatPosture {
  const { mode } = context;
  const tags = result.effects.flatMap((e) => Object.values(e.metadata ?? {}));
  const heatRising = result.resourceDelta.heat > 3;
  const highCord   = result.totalCordDelta > 0.03;

  // Witness trigger: heat spike or electric engagement
  if (heatRising && mlScores.isElectric) return 'WITNESS_TRIGGER';
  // Frozen / needs rescue: suppress broadcast
  if (mlScores.isFrozen && mlScores.needsRescue) return 'SILENT_EXECUTION';

  switch (mode) {
    case GameMode.GO_ALONE: {
      const defn = result.effects[0];
      if (defn?.op === CardEffectOp.SHIELD_DELTA && defn.finalMagnitude > 0) return 'EMPIRE_RESILIENCE_LOCK';
      if (defn?.op === CardEffectOp.INCOME_DELTA && defn.finalMagnitude > 0) return 'EMPIRE_SOVEREIGNTY_CLAIM';
      if (defn?.op === CardEffectOp.CASH_DELTA && highCord) return 'EMPIRE_SCALE_PUSH';
      return 'EMPIRE_MOMENTUM_FLEX';
    }

    case GameMode.HEAD_TO_HEAD: {
      if (result.timingClass === TimingClass.CTR) return 'PREDATOR_COUNTER_CLAIM';
      if (
        result.resourceDelta.battleBudget < 0 &&
        (result.effects.some((e) => e.op === CardEffectOp.STATUS_ADD))
      ) return 'PREDATOR_ATTACK_BROADCAST';
      if (result.timingClass === TimingClass.PSK) return 'PREDATOR_TEMPO_SEIZE';
      if (result.currencyUsed === 'battle_budget' && !highCord) return 'PREDATOR_BLUFF_PLAY';
      return 'PREDATOR_TEMPO_SEIZE';
    }

    case GameMode.TEAM_UP: {
      if (result.timingClass === TimingClass.RES) return 'SYNDICATE_RESCUE_COMMIT';
      if (result.timingClass === TimingClass.AID) return 'SYNDICATE_AID_DROP';
      if (result.resourceDelta.trust > 0) return 'SYNDICATE_TRUST_OFFER';
      if (result.resourceDelta.treasury < 0) return 'SYNDICATE_TREASURY_SHARE';
      return 'SYNDICATE_TRUST_OFFER';
    }

    case GameMode.CHASE_A_LEGEND: {
      if (result.timingClass === TimingClass.GBM) return 'PHANTOM_BENCHMARK_CHALLENGE';
      if (result.resourceDelta.divergence > 0) return 'PHANTOM_DIVERGENCE_PUSH';
      if (result.timingClass === TimingClass.PHZ) return 'PHANTOM_PRECISION_ALIGN';
      if (result.currencyUsed === 'cash' && result.effects.some((e) => e.op === CardEffectOp.DRAW_CARDS)) {
        return 'PHANTOM_GHOST_PLAY';
      }
      return 'PHANTOM_PRECISION_ALIGN';
    }

    default:
      return tags.length > 2 ? 'WITNESS_TRIGGER' : 'SILENT_EXECUTION';
  }
}

/**
 * Generates a mode-native headline for the chat signal.
 * Each posture maps to a short broadcast string (≤ 80 characters).
 */
function buildCardPlayHeadline(
  result: CardEffectResult,
  posture: CardPlayChatPosture,
  narrativePrefix: string,
): string {
  const name = result.cardName;
  const cord = result.totalCordDelta > 0
    ? `+${round6(result.totalCordDelta * 100).toFixed(2)}% CORD`
    : `${round6(result.totalCordDelta * 100).toFixed(2)}% CORD`;

  switch (posture) {
    case 'EMPIRE_SOVEREIGNTY_CLAIM':
      return `${narrativePrefix} ${name} — income locked. ${cord}`;
    case 'EMPIRE_MOMENTUM_FLEX':
      return `${narrativePrefix} ${name} momentum compounding. ${cord}`;
    case 'EMPIRE_RESILIENCE_LOCK':
      return `${narrativePrefix} Shield raised — ${name} absorbed. ${cord}`;
    case 'EMPIRE_SCALE_PUSH':
      return `${narrativePrefix} ${name} scaling the empire. ${cord}`;
    case 'PREDATOR_ATTACK_BROADCAST':
      return `${narrativePrefix} ${name} — ATTACK LAUNCHED. ${cord}`;
    case 'PREDATOR_COUNTER_CLAIM':
      return `${narrativePrefix} COUNTERED with ${name}. ${cord}`;
    case 'PREDATOR_TEMPO_SEIZE':
      return `${narrativePrefix} ${name} takes tempo. ${cord}`;
    case 'PREDATOR_BLUFF_PLAY':
      return `${narrativePrefix} ${name} — the bluff is set. ${cord}`;
    case 'SYNDICATE_TRUST_OFFER':
      return `${narrativePrefix} ${name} — trust extended. ${cord}`;
    case 'SYNDICATE_TREASURY_SHARE':
      return `${narrativePrefix} Treasury deployed — ${name}. ${cord}`;
    case 'SYNDICATE_RESCUE_COMMIT':
      return `${narrativePrefix} RESCUE: ${name} committed. ${cord}`;
    case 'SYNDICATE_AID_DROP':
      return `${narrativePrefix} Aid delivered — ${name}. ${cord}`;
    case 'PHANTOM_DIVERGENCE_PUSH':
      return `${narrativePrefix} ${name} diverges from the legend. ${cord}`;
    case 'PHANTOM_PRECISION_ALIGN':
      return `${narrativePrefix} ${name} aligning to benchmark. ${cord}`;
    case 'PHANTOM_BENCHMARK_CHALLENGE':
      return `${narrativePrefix} GHOST BENCHMARK challenged — ${name}. ${cord}`;
    case 'PHANTOM_GHOST_PLAY':
      return `${narrativePrefix} ${name} — ghost draw activated. ${cord}`;
    case 'WITNESS_TRIGGER':
      return `${narrativePrefix} WITNESS: ${name} ignites the room. ${cord}`;
    case 'SILENT_EXECUTION':
      return `${name} executed silently. ${cord}`;
    default:
      return `${name} played. ${cord}`;
  }
}

/**
 * Generates contextual subtext for the chat signal.
 * Includes timing window info, resource summary, and mode coaching.
 */
function buildCardPlaySubtext(
  result: CardEffectResult,
  context: ExecutionContext,
  posture: CardPlayChatPosture,
  mlScores: CardPlayMLScoreBundle,
): string {
  const timing         = result.timingClass;
  const windowMs       = getTimingWindowMs(timing);
  const windowTicks    = getTimingWindowTicks(timing);
  const urgency        = isHighUrgencyTiming(timing) ? '⚡ HIGH URGENCY' : 'standard window';
  const mlLabel        = mlScores.engagementLabel.split('—')[0]?.trim() ?? 'Active';
  const interventionHint = mlScores.helperShouldSpeak ? ' | Helper standing by.' : '';
  const rescueHint     = mlScores.needsRescue ? ' | RESCUE WINDOW OPEN.' : '';
  const phaseHint      = context.currentPhase
    ? ` | ${describeRunPhase(context.currentPhase)}`
    : '';
  const tierHint       = context.currentPressureTier
    ? ` | ${describePressureTier(context.currentPressureTier)}`
    : '';
  const legalModesCount = getDeckTypesForMode(context.mode).length;
  const timingLegal    = isTimingLegalForMode(timing, context.mode)
    ? 'timing legal'
    : 'timing overridden';

  switch (posture) {
    case 'EMPIRE_SOVEREIGNTY_CLAIM':
    case 'EMPIRE_SCALE_PUSH':
      return `${timing} (${urgency}, ${windowMs}ms / ${windowTicks}t) | ${mlLabel}${phaseHint}${tierHint} | ${legalModesCount} deck types legal.`;
    case 'PREDATOR_ATTACK_BROADCAST':
    case 'PREDATOR_COUNTER_CLAIM':
      return `${timing} (${urgency}) | ${timingLegal} | Battle budget: ${context.battleBudget ?? 0}${interventionHint}`;
    case 'SYNDICATE_RESCUE_COMMIT':
    case 'SYNDICATE_AID_DROP':
      return `${timing} | Treasury: ${context.treasury ?? 0} | Trust: ${context.trustScore ?? 50}${rescueHint}${tierHint}`;
    case 'PHANTOM_DIVERGENCE_PUSH':
    case 'PHANTOM_BENCHMARK_CHALLENGE':
      return `${timing} | Divergence: ${round6(context.divergenceScore ?? 0)} | ${mlLabel}${phaseHint}`;
    case 'WITNESS_TRIGGER':
      return `AUDIENCE HEAT SPIKE — ${mlLabel} | ${timing} ${urgency}${tierHint}${rescueHint}`;
    case 'SILENT_EXECUTION':
      return `Quiet play — ${timing} | ${mlLabel}${interventionHint}`;
    default:
      return `${timing} (${urgency}) | ${mlLabel}${phaseHint}${interventionHint}`;
  }
}

/** Builds a compact human-readable resource summary for chat display. */
function buildResourceSummary(resourceDelta: ResourceDelta): string {
  const parts: string[] = [];
  if (resourceDelta.cash !== 0)       parts.push(`cash ${resourceDelta.cash > 0 ? '+' : ''}${resourceDelta.cash}`);
  if (resourceDelta.income !== 0)     parts.push(`income ${resourceDelta.income > 0 ? '+' : ''}${resourceDelta.income}`);
  if (resourceDelta.shield !== 0)     parts.push(`shield ${resourceDelta.shield > 0 ? '+' : ''}${resourceDelta.shield}`);
  if (resourceDelta.heat !== 0)       parts.push(`heat ${resourceDelta.heat > 0 ? '+' : ''}${resourceDelta.heat}`);
  if (resourceDelta.trust !== 0)      parts.push(`trust ${resourceDelta.trust > 0 ? '+' : ''}${resourceDelta.trust}`);
  if (resourceDelta.divergence !== 0) parts.push(`div ${resourceDelta.divergence > 0 ? '+' : ''}${resourceDelta.divergence}`);
  if (resourceDelta.battleBudget !== 0) parts.push(`bb ${resourceDelta.battleBudget > 0 ? '+' : ''}${resourceDelta.battleBudget}`);
  if (resourceDelta.treasury !== 0)   parts.push(`tsy ${resourceDelta.treasury > 0 ? '+' : ''}${resourceDelta.treasury}`);
  return parts.length > 0 ? parts.join(' | ') : 'no resource change';
}

/**
 * Computes the audience heat delta for a card play signal.
 * Considers: deck type baseline, CORD magnitude, mode amplifier, and ML scores.
 */
function computeCardPlayHeatDelta(
  result: CardEffectResult,
  context: ExecutionContext,
  mlScores: CardPlayMLScoreBundle,
): number {
  const deckType  = result.effects.length > 0 ? DeckType.OPPORTUNITY : DeckType.OPPORTUNITY;
  const baseline  = DECK_TYPE_HEAT_BASELINE[deckType] ?? 0.05;
  const cordAmp   = CORD_HEAT_AMPLIFIER[context.mode] ?? 1;
  const cordHeat  = result.totalCordDelta * cordAmp * 100;
  const mlBoost   = mlScores.isElectric ? 0.15 : mlScores.isFrozen ? -0.05 : 0;
  const optBoost  = result.isOptimalChoice ? 0.05 : 0;
  const heatDelta = baseline + cordHeat + mlBoost + optBoost;
  return round6(clamp(heatDelta, -0.5, 1.0));
}

/**
 * Generates the full `CardPlayChatSignal` for a card play execution result.
 * Wires narrative prefix from zero engine, ML scores from chat ML pipeline.
 */
export function generateCardPlayChatSignal(
  result: CardEffectResult,
  context: ExecutionContext,
  overlay: ModeOverlay,
  mlScores: CardPlayMLScoreBundle,
): CardPlayChatSignal {
  const modeCode        = modeToModeCode(context.mode);
  const narrativePrefix = getModeNarrationPrefix(modeCode);
  const competitiveWt   = scoreModeCompetitiveWeight(modeCode);
  const posture         = resolveCardPlayPosture(result, context, mlScores);
  const headline        = buildCardPlayHeadline(result, posture, narrativePrefix);
  const subtext         = buildCardPlaySubtext(result, context, posture, mlScores);
  const resourceSummary = buildResourceSummary(result.resourceDelta);
  const heatDelta       = computeCardPlayHeatDelta(result, context, mlScores);
  const channel         = MODE_CHAT_CHANNEL_MAP[context.mode] ?? 'GLOBAL';

  const witnessEligible = posture === 'WITNESS_TRIGGER' ||
    (result.isOptimalChoice && result.totalCordDelta > 0.02) ||
    mlScores.isElectric;

  const proofWorthy = result.totalCordDelta > 0.01 ||
    result.isOptimalChoice ||
    posture === 'PHANTOM_BENCHMARK_CHALLENGE' ||
    posture === 'PREDATOR_COUNTER_CLAIM' ||
    posture === 'SYNDICATE_RESCUE_COMMIT';

  const engagementSignal: CardPlayChatSignal['engagementSignal'] =
    mlScores.isElectric   ? 'electric'  :
    mlScores.isFrozen     ? 'frozen'    :
    mlScores.engagement.engagement01 > 0.65 ? 'rising'   :
    mlScores.engagement.engagement01 > 0.40 ? 'stable'   : 'declining';

  return Object.freeze({
    playId:                result.playId,
    cardId:                result.cardId,
    cardName:              result.cardName,
    mode:                  result.mode,
    modeCode,
    posture,
    headline,
    subtext,
    channel,
    heatDelta,
    witnessEligible,
    proofWorthy,
    tickIndex:             context.tickIndex,
    totalCordDelta:        result.totalCordDelta,
    resourceSummary,
    suggestInterruptHelper: mlScores.helperShouldSpeak,
    suggestHaterAttention:  mlScores.hater.targeting01 > 0.6,
    engagementSignal,
    competitiveWeight:     round6(competitiveWt),
    narrativePrefix,
  });
}

// =============================================================================
// MARK: SECTION 10 — Social Pressure + Narration
// =============================================================================

/**
 * Builds a minimal fallback `ZeroSocialPressureVector` when no `RunStateSnapshot`
 * is available. Derives heuristic pressure from the card play result.
 */
function buildFallbackSocialPressureVector(
  result: CardEffectResult,
  context: ExecutionContext,
): ZeroSocialPressureVector {
  const heatStress      = clamp01(Math.abs(result.resourceDelta.heat) / 20);
  const cordMomentum    = clamp01(result.totalCordDelta / 0.1);
  const modePvpFactor   = context.mode === GameMode.HEAD_TO_HEAD ? 0.7 : 0;
  const aggregatePosture = clamp01(heatStress * 0.6 + modePvpFactor * 0.4);
  const socialPressureIndex = clamp01(aggregatePosture * 0.6 + cordMomentum * 0.2 + 0.2);

  const witnessLabel =
    socialPressureIndex > 0.75 ? 'CRITICAL_SIEGE'     :
    socialPressureIndex > 0.55 ? 'ACTIVE_PRESSURE'    :
    socialPressureIndex > 0.35 ? 'BUILDING_TENSION'   :
    socialPressureIndex > 0.15 ? 'WATCHING_FROM_COVER' :
                                 'DORMANT_FIELD';

  return Object.freeze({
    haterAggregatePosture:  round6(aggregatePosture),
    haterPresenceCount:     context.mode === GameMode.HEAD_TO_HEAD ? 1 : 0,
    haterPressureByBot:     Object.freeze({
      BOT_01: round6(modePvpFactor * 0.8),
      BOT_02: round6(modePvpFactor * 0.4),
      BOT_03: 0,
      BOT_04: 0,
      BOT_05: 0,
    }) as ZeroSocialPressureVector['haterPressureByBot'],
    threatConvergenceScore: round6(heatStress * 0.5),
    extractionRiskScore:    round6(modePvpFactor * 0.3),
    breachRiskScore:        round6(heatStress * 0.4 + modePvpFactor * 0.3),
    socialPressureIndex:    round6(socialPressureIndex),
    witnessLabel,
  });
}

/**
 * Computes a `ZeroSocialPressureVector` for a card play.
 * Uses the authoritative `computeSocialPressureVector` when a `RunStateSnapshot`
 * is provided; falls back to heuristic derivation otherwise.
 */
export function computeCardPlaySocialPressure(
  result: CardEffectResult,
  context: ExecutionContext,
  snapshot?: RunStateSnapshot,
): ZeroSocialPressureVector {
  if (snapshot) {
    return computeSocialPressureVector(snapshot);
  }
  return buildFallbackSocialPressureVector(result, context);
}

/**
 * Generates a narration text string for the card play.
 * Uses `narrateZeroMoment` when a `RunStateSnapshot` is provided;
 * falls back to a mode-native template otherwise.
 */
export function computeCardPlayNarration(
  result: CardEffectResult,
  context: ExecutionContext,
  snapshot?: RunStateSnapshot,
): string {
  if (snapshot) {
    const line = narrateZeroMoment(snapshot, context.tickIndex);
    return line.text;
  }
  const modeCode = modeToModeCode(context.mode);
  const prefix   = getModeNarrationPrefix(modeCode);
  const cord     = result.totalCordDelta >= 0
    ? `+${round6(result.totalCordDelta * 100).toFixed(3)}% CORD`
    : `${round6(result.totalCordDelta * 100).toFixed(3)}% CORD`;
  return `${prefix} ${result.cardName} at tick ${context.tickIndex} — ${cord}.`;
}

// =============================================================================
// MARK: SECTION 11 — Proof Edge + Witness Scene Builders
// =============================================================================

/**
 * Builds a `CardPlayProofEdge` — the authoritative proof-bearing transcript entry
 * for a card play event. Drives audit, replay, and learning pipeline ingestion.
 */
export function buildCardPlayProofEdge(
  result: CardEffectResult,
  chatSignal: CardPlayChatSignal,
  mlFeatureVector: CardExecutorMLFeatureVector,
  socialPressure: ZeroSocialPressureVector,
  narrationText: string,
  nowMs = Date.now(),
): CardPlayProofEdge {
  const hashInput = stableHash([
    result.playId,
    result.cardId,
    result.deterministicHash,
    result.totalCordDelta,
    chatSignal.posture,
    mlFeatureVector.features.join(','),
    socialPressure.socialPressureIndex,
    narrationText,
  ]);

  const proofEdgeId = `proof_${hashInput.slice(0, 20)}` as unknown as ChatProofEdgeId;
  const deterministicHash = asChatProofHash(hashInput);
  const timestamp = asUnixMs(nowMs);

  return Object.freeze({
    proofEdgeId,
    playId:             result.playId,
    cardId:             result.cardId,
    cardName:           result.cardName,
    mode:               result.mode,
    tickIndex:          result.appliedAt,
    deterministicHash,
    resourceDelta:      result.resourceDelta,
    totalCordDelta:     result.totalCordDelta,
    effects:            result.effects,
    isOptimalChoice:    result.isOptimalChoice,
    chatSignal,
    mlFeatureVector,
    socialPressure,
    narrationText,
    timestamp,
  });
}

/**
 * Builds a `CardPlayWitnessScene` — the audience visibility record for
 * proof-worthy plays eligible for witness-layer broadcast.
 */
export function buildCardPlayWitnessScene(
  result: CardEffectResult,
  chatSignal: CardPlayChatSignal,
  nowMs = Date.now(),
): CardPlayWitnessScene {
  const sceneHash = stableHash([result.playId, chatSignal.posture, nowMs]);
  const sceneId   = `scene_${sceneHash.slice(0, 16)}` as unknown as ChatSceneId;

  return Object.freeze({
    sceneId,
    playId:       result.playId,
    cardId:       result.cardId,
    cardName:     result.cardName,
    mode:         result.mode,
    posture:      chatSignal.posture,
    headline:     chatSignal.headline,
    audienceHeat: round6(chatSignal.heatDelta),
    witnessCount: chatSignal.witnessEligible ? 1 : 0,
    timestamp:    asUnixMs(nowMs),
  });
}

// =============================================================================
// MARK: SECTION 12 — CardEffectResolver
// =============================================================================

/**
 * `CardEffectResolver` — deterministic single-card execution engine.
 *
 * Responsibilities:
 * - Overlay resolution (runtime + definition + defaults)
 * - Timing class validation per mode window state
 * - Currency resolution + sufficiency assertion
 * - Resource delta computation per effect op
 * - CORD contribution computation using OP_CORD_COEFFICIENTS + MODE_TAG_WEIGHT_DEFAULTS
 * - Deterministic play ID via stableHash
 *
 * The resolver is PURE — no ML, no chat, no side effects.
 * All enrichment happens in `CardEffectsExecutorHub`.
 */
export class CardEffectResolver {
  public resolve(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
    isOptimalChoice: boolean,
  ): CardEffectResult {
    const overlay = this.resolveOverlay(card, context.mode);
    if (!overlay.legal) {
      throw new Error(`Card ${card.definition.cardId} is illegal in mode ${context.mode}.`);
    }

    const timing = this.validateTiming(card, request, context, overlay);
    if (!timing.ok) {
      throw new Error(
        `Card ${card.definition.cardId} timing invalid for ${timing.requested}: ${timing.reason ?? 'unknown reason'}.`,
      );
    }

    const currencyUsed  = this.resolveCurrency(card.definition.deckType, context.mode);
    const effectiveCost = round6(card.definition.baseCost * overlay.costModifier);
    this.assertSufficientCurrency(currencyUsed, effectiveCost, context);

    const resourceDelta = emptyResourceDelta();
    this.applyCost(currencyUsed, effectiveCost, resourceDelta);

    const resolvedTargeting  = overlay.targetingOverride ?? card.definition.targeting;
    const resolvedTargetId   = this.resolveTargetId(resolvedTargeting, request, context);

    const statusesAdded: string[]     = [];
    const statusesRemoved: string[]   = [];
    const injectedCardIds: string[]   = [];
    let drawCount = 0;

    const effects: AppliedEffect[] = card.definition.effects.map((effect) => {
      const finalMagnitude = this.resolveEffectMagnitude(
        effect,
        overlay,
        context,
        card.definition.tags,
      );

      const applied: AppliedEffect = {
        op:              effect.op,
        baseMagnitude:   effect.magnitude,
        finalMagnitude,
        durationTicks:   effect.durationTicks ?? 0,
        targeting:       resolvedTargeting,
        resolvedTargetId,
        metadata:        effect.metadata,
      };

      this.applyEffectSideEffects(
        applied,
        resourceDelta,
        statusesAdded,
        statusesRemoved,
        injectedCardIds,
        (count) => { drawCount += count; },
      );

      return applied;
    });

    const totalCordDelta = round6(
      effects.reduce(
        (sum, effect) =>
          sum + this.computeCordContribution(
            effect,
            card.definition.tags,
            context.mode,
            overlay,
          ),
        0,
      ) * (isOptimalChoice ? 1.03 : 1),
    );

    const playId = stableHash([
      context.runSeed,
      context.mode,
      context.tickIndex,
      card.instanceId,
      card.definition.cardId,
      request.choiceId,
      request.timestamp,
      request.targetId,
    ]);

    return {
      playId:          `play_${playId.slice(0, 20)}`,
      deterministicHash: playId,
      cardInstanceId:  card.instanceId,
      cardId:          card.definition.cardId,
      cardName:        card.definition.name,
      mode:            context.mode,
      choiceId:        request.choiceId,
      appliedAt:       context.tickIndex,
      timingClass:     timing.requested,
      effectiveCost,
      currencyUsed,
      targeting:       resolvedTargeting,
      effects:         freezeAppliedEffects(effects),
      totalCordDelta,
      resourceDelta:   freezeResourceDelta(resourceDelta),
      drawCount,
      injectedCardIds: freezeUniqueStringArray(injectedCardIds),
      statusesAdded:   freezeUniqueStringArray(statusesAdded),
      statusesRemoved: freezeUniqueStringArray(statusesRemoved),
      isOptimalChoice,
      educationalTag:  card.definition.educationalTag,
    };
  }

  /**
   * Resolves the effective `ModeOverlay` by merging:
   *   1. `DEFAULT_MODE_OVERLAY` (lowest priority)
   *   2. card definition's `modeOverlays[mode]` (mid priority)
   *   3. card instance runtime `overlay` (highest priority)
   *
   * Legality is the conjunction of:
   *   - card definition `modeLegal` (if present)
   *   - definition overlay's `legal`
   *   - runtime overlay's `legal`
   */
  public resolveOverlay(card: CardInHand, mode: GameMode): ModeOverlay {
    const modeOverlay     = card.definition.modeOverlays?.[mode] ?? {};
    const runtimeOverlay  = card.overlay ?? {};
    const definitionLegal = card.definition.modeLegal?.includes(mode) ?? true;
    const overlayLegal    =
      runtimeOverlay.legal ??
      modeOverlay.legal ??
      DEFAULT_MODE_OVERLAY.legal;

    return {
      costModifier:
        runtimeOverlay.costModifier ??
        modeOverlay.costModifier ??
        DEFAULT_MODE_OVERLAY.costModifier,
      effectModifier:
        runtimeOverlay.effectModifier ??
        modeOverlay.effectModifier ??
        DEFAULT_MODE_OVERLAY.effectModifier,
      tagWeights: {
        ...DEFAULT_MODE_OVERLAY.tagWeights,
        ...(modeOverlay.tagWeights ?? {}),
        ...(runtimeOverlay.tagWeights ?? {}),
      },
      timingLock:
        runtimeOverlay.timingLock ??
        modeOverlay.timingLock ??
        DEFAULT_MODE_OVERLAY.timingLock,
      legal: Boolean(definitionLegal && overlayLegal),
      targetingOverride:
        runtimeOverlay.targetingOverride ??
        modeOverlay.targetingOverride ??
        DEFAULT_MODE_OVERLAY.targetingOverride,
      cordWeight:
        runtimeOverlay.cordWeight ??
        modeOverlay.cordWeight ??
        DEFAULT_MODE_OVERLAY.cordWeight,
    };
  }

  /**
   * Validates timing class legality for the current window state.
   * Mode-gated windows (CTR, RES, AID, GBM, PHZ) must also match mode.
   */
  public validateTiming(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
    overlay: ModeOverlay,
  ): TimingValidationResult {
    const requested = request.timingClass ?? context.currentWindow ?? TimingClass.ANY;
    const effectiveTiming =
      overlay.timingLock.length > 0
        ? [...overlay.timingLock]
        : [...card.definition.timingClasses];

    if (effectiveTiming.includes(TimingClass.ANY)) {
      return {
        ok: true,
        requested,
        effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
      };
    }

    if (!effectiveTiming.includes(requested)) {
      return {
        ok: false,
        requested,
        effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
        reason: `requested timing ${requested} is not legal for this card`,
      };
    }

    switch (requested) {
      case TimingClass.FATE:
        return {
          ok: Boolean(context.activeFateWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason: context.activeFateWindow ? undefined : 'fate window is not open',
        };

      case TimingClass.CTR:
        return {
          ok: context.mode === GameMode.HEAD_TO_HEAD && Boolean(context.activeCounterWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason:
            context.mode !== GameMode.HEAD_TO_HEAD
              ? 'counter timing only exists in HEAD_TO_HEAD'
              : 'counter window is not open',
        };

      case TimingClass.RES:
        return {
          ok: context.mode === GameMode.TEAM_UP && Boolean(context.activeRescueWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason:
            context.mode !== GameMode.TEAM_UP
              ? 'rescue timing only exists in TEAM_UP'
              : 'rescue window is not open',
        };

      case TimingClass.AID:
        return {
          ok: context.mode === GameMode.TEAM_UP && Boolean(context.activeAidWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason:
            context.mode !== GameMode.TEAM_UP
              ? 'aid timing only exists in TEAM_UP'
              : 'aid window is not open',
        };

      case TimingClass.GBM:
        return {
          ok: context.mode === GameMode.CHASE_A_LEGEND && Boolean(context.activeGhostBenchmarkWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason:
            context.mode !== GameMode.CHASE_A_LEGEND
              ? 'ghost benchmark timing only exists in CHASE_A_LEGEND'
              : 'ghost benchmark window is not open',
        };

      case TimingClass.CAS:
        return {
          ok: Boolean(context.activeCascadeInterceptWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason: context.activeCascadeInterceptWindow ? undefined : 'cascade intercept window is not open',
        };

      case TimingClass.PHZ:
        return {
          ok: context.mode === GameMode.GO_ALONE && Boolean(context.activePhaseBoundaryWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason:
            context.mode !== GameMode.GO_ALONE
              ? 'phase boundary timing only exists in GO_ALONE'
              : 'phase boundary window is not open',
        };

      case TimingClass.PSK:
        return {
          ok: Boolean(context.activePressureSpikeWindow),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason: context.activePressureSpikeWindow ? undefined : 'pressure spike window is not open',
        };

      case TimingClass.END:
        return {
          ok: Boolean(context.isFinalTick),
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
          reason: context.isFinalTick ? undefined : 'end timing requires final tick',
        };

      case TimingClass.PRE:
      case TimingClass.POST:
      case TimingClass.ANY:
      default:
        return {
          ok: true,
          requested,
          effective: freezeStringArray(effectiveTiming) as readonly TimingClass[],
        };
    }
  }

  /**
   * Resolves currency type for the card play.
   * HEAD_TO_HEAD combat cards → battle_budget
   * TEAM_UP care cards → treasury
   * All others → cash
   */
  public resolveCurrency(deckType: DeckType, mode: GameMode): CurrencyType {
    if (
      mode === GameMode.HEAD_TO_HEAD &&
      (deckType === DeckType.SABOTAGE ||
       deckType === DeckType.COUNTER  ||
       deckType === DeckType.BLUFF)
    ) {
      return 'battle_budget';
    }

    if (
      mode === GameMode.TEAM_UP &&
      (deckType === DeckType.AID    ||
       deckType === DeckType.RESCUE ||
       deckType === DeckType.TRUST)
    ) {
      return 'treasury';
    }

    if (
      deckType === DeckType.GHOST       ||
      deckType === DeckType.DISCIPLINE  ||
      deckType === DeckType.OPPORTUNITY ||
      deckType === DeckType.IPA         ||
      deckType === DeckType.PRIVILEGED  ||
      deckType === DeckType.SO          ||
      deckType === DeckType.MISSED_OPPORTUNITY ||
      deckType === DeckType.FUBAR
    ) {
      return 'cash';
    }

    return mode === GameMode.TEAM_UP ? 'treasury' : 'cash';
  }

  private assertSufficientCurrency(
    currency: CurrencyType,
    effectiveCost: number,
    context: ExecutionContext,
  ): void {
    if (currency === 'battle_budget' && (context.battleBudget ?? 0) < effectiveCost) {
      throw new Error(
        `Insufficient battle budget: required=${effectiveCost}, available=${context.battleBudget ?? 0}`,
      );
    }

    if (currency === 'treasury' && (context.treasury ?? 0) < effectiveCost) {
      throw new Error(
        `Insufficient treasury: required=${effectiveCost}, available=${context.treasury ?? 0}`,
      );
    }
  }

  private applyCost(
    currency: CurrencyType,
    effectiveCost: number,
    resourceDelta: MutableResourceDelta,
  ): void {
    switch (currency) {
      case 'battle_budget':
        addResourceDelta(resourceDelta, 'battleBudget', -effectiveCost);
        break;
      case 'treasury':
        addResourceDelta(resourceDelta, 'treasury', -effectiveCost);
        break;
      case 'cash':
        addResourceDelta(resourceDelta, 'cash', -effectiveCost);
        break;
      case 'none':
      default:
        break;
    }
  }

  private resolveTargetId(
    targeting: Targeting,
    request: CardPlayRequest,
    context: ExecutionContext,
  ): string | undefined {
    if (targeting === Targeting.SELF || targeting === Targeting.GLOBAL) {
      return request.targetId;
    }

    if (!request.targetId) return undefined;

    const allowed = context.availableTargetIds ?? [];
    if (allowed.length > 0 && !allowed.includes(request.targetId)) {
      throw new Error(`Target ${request.targetId} is not legal in this execution context.`);
    }

    return request.targetId;
  }

  /**
   * Resolves the final effect magnitude, applying:
   * - overlay effectModifier
   * - TEAM_UP trust/aid scaling (by trustScore)
   * - CHASE_A_LEGEND divergence bonus
   * - HEAD_TO_HEAD tempo/counter window bonus
   */
  private resolveEffectMagnitude(
    effect: CardEffectSpec,
    overlay: ModeOverlay,
    context: ExecutionContext,
    tags: readonly CardTag[],
  ): number {
    if (effect.op === CardEffectOp.NO_OP) return 0;

    let multiplier = overlay.effectModifier;

    if (
      context.mode === GameMode.TEAM_UP &&
      (tags.includes(CardTag.TRUST) || tags.includes(CardTag.AID))
    ) {
      const trustScale = clamp((context.trustScore ?? 50) / 100, 0.4, 1.6);
      multiplier *= trustScale;
    }

    if (
      context.mode === GameMode.CHASE_A_LEGEND &&
      (tags.includes(CardTag.DIVERGENCE) || tags.includes(CardTag.PRECISION))
    ) {
      const divergenceBonus = 1 + clamp((context.divergenceScore ?? 0) * 0.5, 0, 0.5);
      multiplier *= divergenceBonus;
    }

    if (
      context.mode === GameMode.HEAD_TO_HEAD &&
      tags.includes(CardTag.TEMPO) &&
      context.activeCounterWindow
    ) {
      multiplier *= 1.1;
    }

    // PSK timing grants a flat +8% bonus to all magnitudes
    if (context.activePressureSpikeWindow && tags.includes(CardTag.MOMENTUM)) {
      multiplier *= 1.08;
    }

    return round6(effect.magnitude * multiplier);
  }

  /** Applies all side effects of an `AppliedEffect` to the mutable resource delta. */
  private applyEffectSideEffects(
    effect: AppliedEffect,
    resourceDelta: MutableResourceDelta,
    statusesAdded: string[],
    statusesRemoved: string[],
    injectedCardIds: string[],
    addDrawCount: (count: number) => void,
  ): void {
    switch (effect.op) {
      case CardEffectOp.CASH_DELTA:
        addResourceDelta(resourceDelta, 'cash', effect.finalMagnitude);
        break;
      case CardEffectOp.INCOME_DELTA:
        addResourceDelta(resourceDelta, 'income', effect.finalMagnitude);
        break;
      case CardEffectOp.EXPENSE_DELTA:
        addResourceDelta(resourceDelta, 'expense', effect.finalMagnitude);
        break;
      case CardEffectOp.SHIELD_DELTA:
        addResourceDelta(resourceDelta, 'shield', effect.finalMagnitude);
        break;
      case CardEffectOp.HEAT_DELTA:
        addResourceDelta(resourceDelta, 'heat', effect.finalMagnitude);
        break;
      case CardEffectOp.TRUST_DELTA:
        addResourceDelta(resourceDelta, 'trust', effect.finalMagnitude);
        break;
      case CardEffectOp.DIVERGENCE_DELTA:
        addResourceDelta(resourceDelta, 'divergence', effect.finalMagnitude);
        break;
      case CardEffectOp.BATTLE_BUDGET_DELTA:
        addResourceDelta(resourceDelta, 'battleBudget', effect.finalMagnitude);
        break;
      case CardEffectOp.TREASURY_DELTA:
        addResourceDelta(resourceDelta, 'treasury', effect.finalMagnitude);
        break;
      case CardEffectOp.DRAW_CARDS:
        addDrawCount(Math.max(0, Math.round(effect.finalMagnitude)));
        break;
      case CardEffectOp.INJECT_CARD: {
        const injectedId =
          typeof effect.metadata?.cardId === 'string'
            ? effect.metadata.cardId
            : `injected_${Math.abs(Math.round(effect.finalMagnitude))}`;
        injectedCardIds.push(injectedId);
        break;
      }
      case CardEffectOp.STATUS_ADD: {
        const status =
          typeof effect.metadata?.status === 'string'
            ? effect.metadata.status
            : `status_${Math.abs(Math.round(effect.finalMagnitude))}`;
        statusesAdded.push(status);
        break;
      }
      case CardEffectOp.STATUS_REMOVE: {
        const status =
          typeof effect.metadata?.status === 'string'
            ? effect.metadata.status
            : `status_${Math.abs(Math.round(effect.finalMagnitude))}`;
        statusesRemoved.push(status);
        break;
      }
      case CardEffectOp.TIMER_FREEZE:
      case CardEffectOp.CORD_BONUS_FLAT:
      case CardEffectOp.NO_OP:
      default:
        break;
    }
  }

  /**
   * Computes the CORD contribution of a single applied effect using:
   * - `OP_CORD_COEFFICIENTS` for op-level coefficient
   * - `MODE_TAG_WEIGHT_DEFAULTS` for mode-native tag weights
   * - overlay tag weights for runtime overrides
   * - `overlay.cordWeight` as the final multiplier
   */
  private computeCordContribution(
    effect: AppliedEffect,
    tags: readonly CardTag[],
    mode: GameMode,
    overlay: ModeOverlay,
  ): number {
    if (effect.op === CardEffectOp.CORD_BONUS_FLAT) {
      return effect.finalMagnitude;
    }

    const coefficient = OP_CORD_COEFFICIENTS[effect.op];
    if (coefficient === 0) return 0;

    const baseContribution = effect.finalMagnitude * coefficient;
    const weight =
      tags.length === 0
        ? 1
        : tags.reduce((sum, tag) => {
            const modeWeight =
              overlay.tagWeights[tag] ??
              MODE_TAG_WEIGHT_DEFAULTS[mode][tag] ??
              1;
            return sum + modeWeight;
          }, 0) / tags.length;

    return round6(baseContribution * weight * overlay.cordWeight);
  }

  /**
   * Validates whether the card's deck type is legal for the given mode,
   * using the authoritative `CARD_LEGALITY_MATRIX`.
   */
  public isDeckTypeLegalForMode(deckType: DeckType, mode: GameMode): boolean {
    return getDeckTypesForMode(mode).includes(deckType);
  }

  /**
   * Returns the timing window in ms for a given TimingClass.
   * Exposes the `TIMING_CLASS_WINDOW_MS` lookup on the resolver.
   */
  public getTimingWindowMs(timingClass: TimingClass): number {
    return getTimingWindowMs(timingClass);
  }
}

// =============================================================================
// MARK: SECTION 13 — CardEffectsExecutor
// =============================================================================

/**
 * `CardEffectsExecutor` — the primary batch card execution engine.
 *
 * Wraps `CardEffectResolver` with batch orchestration:
 * - `executeOne` — single item execution
 * - `executeMany` — ordered batch execution
 * - `executeDeterministicSorted` — tick → timestamp → instanceId sort before batch
 * - `executeOneEnriched` — single item + ML + chat (requires `CardEffectsExecutorHub`)
 *
 * For full ML/chat enrichment, use `CardEffectsExecutorHub` directly.
 */
export class CardEffectsExecutor {
  private readonly resolver: CardEffectResolver;

  public constructor(resolver: CardEffectResolver = new CardEffectResolver()) {
    this.resolver = resolver;
  }

  public executeOne(item: CardEffectExecutionItem): CardEffectResult {
    return this.resolver.resolve(
      item.card,
      item.request,
      item.context,
      item.isOptimalChoice ?? false,
    );
  }

  public executeMany(
    items: readonly CardEffectExecutionItem[],
  ): CardEffectExecutionBatchResult {
    const results: CardEffectResult[] = [];
    let totalCordDelta = 0;

    for (const item of items) {
      const result = this.executeOne(item);
      results.push(result);
      totalCordDelta = round6(totalCordDelta + result.totalCordDelta);
    }

    return {
      results:       Object.freeze([...results]),
      totalCordDelta,
      playCount:     results.length,
    };
  }

  /**
   * Sorts items by tick → timestamp → instanceId, then batch-executes.
   * Guarantees deterministic output ordering for replay and audit.
   */
  public executeDeterministicSorted(
    items: readonly CardEffectExecutionItem[],
  ): CardEffectExecutionBatchResult {
    const sorted = [...items].sort((left, right) => {
      if (left.context.tickIndex !== right.context.tickIndex) {
        return left.context.tickIndex - right.context.tickIndex;
      }
      if (left.request.timestamp !== right.request.timestamp) {
        return left.request.timestamp - right.request.timestamp;
      }
      return left.card.instanceId.localeCompare(right.card.instanceId);
    });

    return this.executeMany(sorted);
  }

  /** Validates timing legality without executing the card. */
  public validateTimingOnly(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
  ): TimingValidationResult {
    const overlay = this.resolver.resolveOverlay(card, context.mode);
    return this.resolver.validateTiming(card, request, context, overlay);
  }

  /** Returns true if the deck type is legal for the given mode. */
  public isDeckTypeLegal(deckType: DeckType, mode: GameMode): boolean {
    return this.resolver.isDeckTypeLegalForMode(deckType, mode);
  }

  /** Returns the timing window in ms for a timing class. */
  public getTimingWindowMs(timingClass: TimingClass): number {
    return this.resolver.getTimingWindowMs(timingClass);
  }

  /** Returns the currency type for a deck type + mode combination. */
  public resolveCurrency(deckType: DeckType, mode: GameMode): CurrencyType {
    return this.resolver.resolveCurrency(deckType, mode);
  }
}

// =============================================================================
// MARK: SECTION 14 — CardEffectsExecutorHub
// =============================================================================

/**
 * `CardEffectsExecutorHub` — the master orchestrator for card effects execution.
 *
 * This is the authority surface wired into `engine/index.ts`.
 *
 * It wires:
 * - `CardEffectsExecutor` (pure execution engine)
 * - ML model stack (engagement, hater, helper, churn, intervention)
 * - Chat signal generation (mode-native posture, headline, subtext, heat)
 * - Social pressure vector (zero engine or fallback heuristic)
 * - Proof-bearing transcript edges (audit + replay + learning)
 * - Witness scene generation (audience visibility records)
 * - Zero engine ML feature dimension metadata
 * - Mode code utilities (MODE_CODE_MAP, getModeNarrationPrefix)
 * - Timing utilities (TIMING_CLASS_WINDOW_MS, TIMING_WINDOW_TICKS)
 * - Deck legality utilities (CARD_LEGALITY_MATRIX, TIMING_CLASS_MODE_MATRIX)
 * - Currency override resolution (resolveCurrencyFromCardTypes with overlay)
 *
 * Usage:
 * ```typescript
 * const hub = CardEffectsExecutorHub.create();
 * const enriched = hub.executeAndEnrich(item);
 * const batch    = hub.executeBatchAndEnrich(items);
 * ```
 */
export class CardEffectsExecutorHub {
  private readonly executor: CardEffectsExecutor;
  private readonly models: CardExecutorMLModels;

  private constructor(
    executor: CardEffectsExecutor,
    models: CardExecutorMLModels,
  ) {
    this.executor = executor;
    this.models   = models;
  }

  /**
   * Creates a new `CardEffectsExecutorHub` with fresh ML model instances.
   * All 5 ML models are instantiated via their canonical factory functions.
   */
  public static create(): CardEffectsExecutorHub {
    const executor = new CardEffectsExecutor();
    const models: CardExecutorMLModels = {
      engagement:   createEngagementModel(),
      hater:        createHaterTargetingModel(),
      helper:       createHelperTimingModel(),
      churn:        createChurnRiskModel(),
      intervention: createInterventionPolicyModel(),
    };
    return new CardEffectsExecutorHub(executor, models);
  }

  /** Returns the underlying ML model stack. Useful for audit/health checks. */
  public getModels(): CardExecutorMLModels {
    return this.models;
  }

  /**
   * Executes a single card play and returns the full enriched result:
   * - Standard `CardEffectResult`
   * - 24-dim ML feature vector
   * - Chat signal (mode-native posture + headline + heat)
   * - 5-model ML score bundle
   * - Social pressure vector
   * - Proof-bearing transcript edge
   * - Witness scene (if witness-eligible)
   *
   * @param snapshot Optional `RunStateSnapshot` from zero engine.
   *   When provided, enables full social pressure computation and narration.
   */
  public executeAndEnrich(
    item: CardEffectExecutionItem,
    snapshot?: RunStateSnapshot,
  ): CardEffectExecutionEnriched {
    const startMs = Date.now();
    const result  = this.executor.executeOne(item);
    const overlay = this.executor['resolver'].resolveOverlay(item.card, item.context.mode);

    const mlScores          = scoreCardPlayMLBundle(result, item.context, startMs);
    const socialPressure    = computeCardPlaySocialPressure(result, item.context, snapshot);
    const narrationText     = computeCardPlayNarration(result, item.context, snapshot);
    const chatSignal        = generateCardPlayChatSignal(result, item.context, overlay, mlScores);
    const mlFeatureVector   = extractExecutorMLFeatureVector({
      result,
      context:         item.context,
      overlay,
      rarity:          (item.card.definition as CardDefinitionEnrichedSnapshot).rarity,
      counterability:  (item.card.definition as CardDefinitionEnrichedSnapshot).counterability,
    });
    const proofEdge         = buildCardPlayProofEdge(
      result,
      chatSignal,
      mlFeatureVector,
      socialPressure,
      narrationText,
      startMs,
    );
    const witnessScene      = buildCardPlayWitnessScene(result, chatSignal, startMs);
    const executionDurationMs = Date.now() - startMs;

    return Object.freeze({
      result,
      mlFeatureVector,
      chatSignal,
      proofEdge,
      witnessScene,
      mlScores,
      socialPressure,
      executionDurationMs,
    });
  }

  /**
   * Executes a batch of card plays and returns enriched results for each,
   * plus aggregate signals: heat delta, dominant posture, narration, engagement label.
   */
  public executeBatchAndEnrich(
    items: readonly CardEffectExecutionItem[],
    snapshot?: RunStateSnapshot,
  ): CardEffectExecutionBatchEnriched {
    const enrichedItems: CardEffectExecutionEnriched[] = [];
    let totalCordDelta = 0;
    let batchHeatDelta = 0;
    let batchWitnessCount = 0;
    let batchProofCount = 0;
    const postureCounts: Partial<Record<CardPlayChatPosture, number>> = {};

    for (const item of items) {
      const enriched = this.executeAndEnrich(item, snapshot);
      enrichedItems.push(enriched);
      totalCordDelta  = round6(totalCordDelta + enriched.result.totalCordDelta);
      batchHeatDelta  = round6(batchHeatDelta + enriched.chatSignal.heatDelta);
      if (enriched.chatSignal.witnessEligible) batchWitnessCount++;
      if (enriched.chatSignal.proofWorthy) batchProofCount++;
      const p = enriched.chatSignal.posture;
      postureCounts[p] = (postureCounts[p] ?? 0) + 1;
    }

    const dominantPosture = this.findDominantPosture(postureCounts);
    const batchEngagementLabel = enrichedItems.length > 0
      ? enrichedItems[enrichedItems.length - 1]!.mlScores.engagementLabel
      : 'No plays';
    const modeCode = enrichedItems.length > 0
      ? enrichedItems[0]!.chatSignal.modeCode
      : 'solo';
    const batchNarration = enrichedItems.length > 0
      ? enrichedItems[enrichedItems.length - 1]!.proofEdge.narrationText
      : 'No card plays this batch.';

    return Object.freeze({
      items:               Object.freeze(enrichedItems),
      totalCordDelta,
      playCount:           enrichedItems.length,
      batchHeatDelta,
      batchEngagementLabel,
      batchWitnessCount,
      batchProofCount,
      dominantPosture,
      batchNarration,
      modeCode,
      zeroFeatureDimension: ZERO_ML_FEATURE_DIMENSION,
    });
  }

  /**
   * Scores a card play without executing it.
   * Builds a synthetic result using the provided context + card data
   * and runs it through the full ML scoring pipeline.
   */
  public scoreCardPlay(
    item: CardEffectExecutionItem,
    nowMs = Date.now(),
  ): CardPlayMLScoreBundle {
    const result = this.executor.executeOne(item);
    return scoreCardPlayMLBundle(result, item.context, nowMs);
  }

  /**
   * Validates timing for a card play without executing it.
   * Returns a `TimingValidationResult`.
   */
  public validateTiming(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
  ): TimingValidationResult {
    return this.executor.validateTimingOnly(card, request, context);
  }

  /**
   * Executes deterministically sorted batch and returns enriched results.
   * Sort order: tickIndex → timestamp → instanceId.
   */
  public executeSortedAndEnrich(
    items: readonly CardEffectExecutionItem[],
    snapshot?: RunStateSnapshot,
  ): CardEffectExecutionBatchEnriched {
    const sorted = [...items].sort((a, b) => {
      if (a.context.tickIndex !== b.context.tickIndex) {
        return a.context.tickIndex - b.context.tickIndex;
      }
      if (a.request.timestamp !== b.request.timestamp) {
        return a.request.timestamp - b.request.timestamp;
      }
      return a.card.instanceId.localeCompare(b.card.instanceId);
    });
    return this.executeBatchAndEnrich(sorted, snapshot);
  }

  /**
   * Returns the social pressure vector for a card play result.
   * Uses the authoritative zero engine when snapshot is provided.
   */
  public getSocialPressure(
    result: CardEffectResult,
    context: ExecutionContext,
    snapshot?: RunStateSnapshot,
  ): ZeroSocialPressureVector {
    return computeCardPlaySocialPressure(result, context, snapshot);
  }

  /**
   * Returns the zero ML feature dimension and label keys.
   * Used for hub diagnostic output and dashboard metadata.
   */
  public getZeroMLFeatureInfo(): { dimension: number; labels: readonly string[] } {
    return {
      dimension: ZERO_ML_FEATURE_DIMENSION,
      labels:    ZERO_ML_FEATURE_LABEL_KEYS,
    };
  }

  /**
   * Returns the executor ML feature dimension and labels.
   */
  public getExecutorMLFeatureInfo(): { dimension: number; labels: readonly string[] } {
    return {
      dimension: EXECUTOR_ML_FEATURE_DIMENSION,
      labels:    EXECUTOR_ML_FEATURE_LABELS,
    };
  }

  /**
   * Returns the narrative prefix for a given mode (wraps zero engine utility).
   */
  public getModeNarrativePrefix(mode: GameMode): string {
    return getModeNarrationPrefix(modeToModeCode(mode));
  }

  /**
   * Returns the competitive weight for a given mode (wraps zero engine utility).
   */
  public getModeCompetitiveWeight(mode: GameMode): number {
    return scoreModeCompetitiveWeight(modeToModeCode(mode));
  }

  /**
   * Returns the timing window in ms for a given timing class.
   * Exposes `TIMING_CLASS_WINDOW_MS` from `card_types.ts`.
   */
  public getTimingWindowMs(timingClass: TimingClass): number {
    return getTimingWindowMs(timingClass);
  }

  /**
   * Returns the timing window in ticks for a given timing class.
   * Exposes `TIMING_WINDOW_TICKS` from `card_types.ts`.
   */
  public getTimingWindowTicks(timingClass: TimingClass): number {
    return getTimingWindowTicks(timingClass);
  }

  /**
   * Returns whether a timing class is legal for the given mode.
   * Uses `TIMING_CLASS_MODE_MATRIX` from `card_types.ts`.
   */
  public isTimingLegalForMode(timingClass: TimingClass, mode: GameMode): boolean {
    return isTimingLegalForMode(timingClass, mode);
  }

  /**
   * Returns all deck types legal for a given mode.
   * Uses `CARD_LEGALITY_MATRIX` from `card_types.ts`.
   */
  public getDeckTypesForMode(mode: GameMode): readonly DeckType[] {
    return getDeckTypesForMode(mode);
  }

  /**
   * Returns the ModeCode string for a given GameMode.
   * Uses `MODE_CODE_MAP` from `card_types.ts`.
   */
  public getModeCode(mode: GameMode): ModeCode {
    return modeToModeCode(mode);
  }

  /**
   * Resolves currency with overlay override support.
   * Delegates to `resolveCurrencyFromCardTypes` for the richer resolution path.
   */
  public resolveCurrencyWithOverride(
    deckType: DeckType,
    mode: GameMode,
    currencyOverride?: CurrencyType,
  ): CurrencyType {
    return resolveCurrencyWithOverride(deckType, mode, currencyOverride);
  }

  /**
   * Returns whether a deck type is legal for a given mode.
   * Uses `CARD_LEGALITY_MATRIX` via `getDeckTypesForMode`.
   */
  public isDeckTypeLegal(deckType: DeckType, mode: GameMode): boolean {
    return getDeckTypesForMode(mode).includes(deckType);
  }

  /**
   * Returns a human-readable run phase description.
   * Uses `RunPhase` from `card_types.ts`.
   */
  public describeRunPhase(phase: RunPhase): string {
    return describeRunPhase(phase);
  }

  /**
   * Returns a human-readable pressure tier description.
   * Uses `PressureTier` from `card_types.ts`.
   */
  public describePressureTier(tier: PressureTier): string {
    return describePressureTier(tier);
  }

  /**
   * Produces a hub diagnostic snapshot for dashboard + logging.
   */
  public getDiagnostics(): {
    executorMLDimension: number;
    zeroMLDimension: number;
    zeroMLLabelCount: number;
    availableModes: readonly string[];
    availableDeckTypes: readonly string[];
    availableTimingClasses: readonly string[];
    modelFamilies: readonly string[];
  } {
    return Object.freeze({
      executorMLDimension:    EXECUTOR_ML_FEATURE_DIMENSION,
      zeroMLDimension:        ZERO_ML_FEATURE_DIMENSION,
      zeroMLLabelCount:       ZERO_ML_FEATURE_LABEL_KEYS.length,
      availableModes:         Object.values(GameMode),
      availableDeckTypes:     Object.values(DeckType),
      availableTimingClasses: Object.values(TimingClass),
      modelFamilies:          ['engagement', 'hater', 'helper', 'churn', 'intervention'],
    });
  }

  /**
   * Generates a standalone chat signal from a card play result
   * without requiring an execution item. Useful for replay and preview.
   */
  public generateChatSignalFromResult(
    result: CardEffectResult,
    context: ExecutionContext,
    overlay: ModeOverlay,
    nowMs = Date.now(),
  ): CardPlayChatSignal {
    const mlScores = scoreCardPlayMLBundle(result, context, nowMs);
    return generateCardPlayChatSignal(result, context, overlay, mlScores);
  }

  /**
   * Extracts the ML feature vector from a play result and context.
   * Optionally accepts rarity and counterability for enriched extraction.
   */
  public extractMLFeatures(
    result: CardEffectResult,
    context: ExecutionContext,
    overlay: ModeOverlay,
    rarity?: CardRarity,
    counterability?: Counterability,
  ): CardExecutorMLFeatureVector {
    return extractExecutorMLFeatureVector({ result, context, overlay, rarity, counterability });
  }

  /**
   * Computes the CORD delta for a card play item without executing it.
   * Uses `DEFAULT_MODE_OVERLAY` if no overlay is provided.
   */
  public previewCordDelta(
    item: CardEffectExecutionItem,
    overlayOverride?: ModeOverlay,
  ): number {
    const overlay = overlayOverride
      ?? this.executor['resolver'].resolveOverlay(item.card, item.context.mode);
    const competitiveWt = scoreModeCompetitiveWeight(modeToModeCode(item.context.mode));
    const totalTagWeight = item.card.definition.tags.length > 0
      ? average(
          item.card.definition.tags.map(
            (tag) => overlay.tagWeights[tag] ?? MODE_TAG_WEIGHT_DEFAULTS[item.context.mode][tag] ?? 1,
          ),
        )
      : 1;
    const baseCordContrib = item.card.definition.effects.reduce((sum, effect) => {
      const coeff = OP_CORD_COEFFICIENTS[effect.op] ?? 0;
      return sum + effect.magnitude * coeff;
    }, 0);
    return round6(baseCordContrib * totalTagWeight * overlay.cordWeight * competitiveWt);
  }

  /**
   * Returns the average score across all N enriched items for a scalar field.
   * Used for session-level analytics.
   */
  public averageMLScore(
    items: readonly CardEffectExecutionEnriched[],
    field: keyof Pick<CardPlayMLScoreBundle, 'isElectric' | 'isFrozen' | 'needsRescue' | 'helperShouldSpeak'>,
  ): number {
    if (items.length === 0) return 0;
    return round6(
      items.filter((i) => i.mlScores[field]).length / items.length,
    );
  }

  /**
   * Finds the dominant posture in a set of enriched items.
   */
  public dominantPostureInBatch(
    items: readonly CardEffectExecutionEnriched[],
  ): CardPlayChatPosture {
    const counts: Partial<Record<CardPlayChatPosture, number>> = {};
    for (const item of items) {
      const p = item.chatSignal.posture;
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return this.findDominantPosture(counts);
  }

  private findDominantPosture(
    postureCounts: Partial<Record<CardPlayChatPosture, number>>,
  ): CardPlayChatPosture {
    let maxCount = 0;
    let dominant: CardPlayChatPosture = 'SILENT_EXECUTION';

    for (const [posture, count] of Object.entries(postureCounts) as Array<[CardPlayChatPosture, number]>) {
      if (count > maxCount) {
        maxCount  = count;
        dominant  = posture;
      }
    }

    return dominant;
  }
}

// =============================================================================
// MARK: SECTION 15 — Module Exports and Singleton
// =============================================================================

/**
 * Default singleton hub instance.
 * Use `CardEffectsExecutorHub.create()` for isolated instances.
 */
export const defaultCardEffectsExecutorHub = CardEffectsExecutorHub.create();
