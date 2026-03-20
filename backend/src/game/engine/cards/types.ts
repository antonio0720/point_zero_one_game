/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/types.ts
 *
 * Doctrine:
 * - card weighting metadata lives here, not inside callers
 * - all mode scoring helpers must be deterministic
 * - ordering rules should be explicit, inspectable, and backend-safe
 * - exports remain additive so existing imports of MODE_TAG_WEIGHTS keep working
 * - the same base card must feel materially different in Empire, Predator,
 *   Syndicate, and Phantom through inspectable scoring doctrine, not hidden magic
 * - this file is the stable scoring spine for registry, overlay, composition,
 *   audit, proof, replay, and future chat narration surfaces
 */

import type {
  CardDefinition,
  CardRarity,
  Counterability,
  DeckType,
  DivergencePotential,
  EffectPayload,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import { resolveModeOverlay } from '../core/GamePrimitives';

/**
 * Canonical semantic tag families observed in the current backend registry.
 * The scoring layer is deliberately explicit here so weighting remains auditable.
 */
export type CardTag =
  | 'liquidity'
  | 'income'
  | 'resilience'
  | 'scale'
  | 'tempo'
  | 'sabotage'
  | 'counter'
  | 'heat'
  | 'trust'
  | 'aid'
  | 'divergence'
  | 'precision'
  | 'variance'
  | 'cascade'
  | 'momentum';

export type DeckFamily =
  | 'ECONOMY'
  | 'REACTION'
  | 'OFFENSE'
  | 'COOPERATION'
  | 'PRECISION'
  | 'PRESSURE'
  | 'SPECIAL';

export type ScoringAxis =
  | 'LEGALITY'
  | 'RARITY'
  | 'DECK'
  | 'DECK_FAMILY'
  | 'TAG'
  | 'OVERLAY'
  | 'TIMING'
  | 'TARGETING'
  | 'COUNTERABILITY'
  | 'DIVERGENCE_POTENTIAL'
  | 'EFFECT'
  | 'AUTO_RESOLVE'
  | 'DECAY'
  | 'COST'
  | 'MODE_BONUS'
  | 'MODE_PENALTY';

export type EffectFieldKey =
  | 'cashDelta'
  | 'debtDelta'
  | 'incomeDelta'
  | 'expenseDelta'
  | 'shieldDelta'
  | 'heatDelta'
  | 'trustDelta'
  | 'treasuryDelta'
  | 'battleBudgetDelta'
  | 'holdChargeDelta'
  | 'counterIntelDelta'
  | 'timeDeltaMs'
  | 'divergenceDelta';

export interface ModeDoctrineProfile {
  readonly mode: ModeCode;
  readonly codename: string;
  readonly screenName: string;
  readonly doctrineSummary: string;
  readonly primaryDecks: readonly DeckType[];
  readonly secondaryDecks: readonly DeckType[];
  readonly suppressedDecks: readonly DeckType[];
  readonly reactionTimings: readonly TimingClass[];
  readonly premiumTags: readonly CardTag[];
  readonly cautionTags: readonly CardTag[];
  readonly preferredTargeting: readonly Targeting[];
  readonly preferredCounterability: readonly Counterability[];
  readonly preferredDivergence: readonly DivergencePotential[];
  readonly lowCostBias: boolean;
  readonly highCostTolerance: number;
  readonly prefersPersistence: boolean;
  readonly prefersAutoResolve: boolean;
}

export interface ModeScoringTuning {
  readonly legalityPenalty: number;
  readonly deckPriorityFactor: number;
  readonly deckFamilyFactor: number;
  readonly tagFactor: number;
  readonly timingFactor: number;
  readonly targetingFactor: number;
  readonly counterabilityFactor: number;
  readonly rarityFactor: number;
  readonly effectFactor: number;
  readonly overlayFactor: number;
  readonly divergenceFactor: number;
  readonly autoResolveFactor: number;
  readonly decayPenaltyFactor: number;
  readonly costPenaltyDivisor: number;
  readonly lowCostBonusThreshold: number;
  readonly highCostPenaltyThreshold: number;
  readonly lowCostBonus: number;
  readonly highCostPenalty: number;
  readonly premiumDeckBonus: number;
  readonly suppressedDeckPenalty: number;
}

export interface ModeScoreSnapshot {
  readonly mode: ModeCode;
  readonly doctrine: ModeDoctrineProfile;
  readonly tagWeights: Readonly<Record<string, number>>;
  readonly deckPriorities: Readonly<Record<DeckType, number>>;
  readonly timingWeights: Readonly<Record<TimingClass, number>>;
  readonly targetingWeights: Readonly<Record<Targeting, number>>;
  readonly counterabilityWeights: Readonly<Record<Counterability, number>>;
  readonly divergenceWeights: Readonly<Record<DivergencePotential, number>>;
  readonly tuning: ModeScoringTuning;
}

export interface EffectScoreBreakdown {
  readonly total: number;
  readonly numericFields: Readonly<Record<EffectFieldKey, number>>;
  readonly cascadeBonus: number;
  readonly injectCardsBonus: number;
  readonly exhaustCardsBonus: number;
  readonly badgesBonus: number;
  readonly namedActionBonus: number;
}

export interface TagScoreBreakdown {
  readonly total: number;
  readonly contributions: Readonly<Record<string, number>>;
  readonly matchedPremiumTags: readonly CardTag[];
  readonly matchedCautionTags: readonly CardTag[];
}

export interface TimingScoreBreakdown {
  readonly total: number;
  readonly contributions: Readonly<Record<TimingClass, number>>;
  readonly effectiveTimings: readonly TimingClass[];
}

export interface OverlayScoreBreakdown {
  readonly total: number;
  readonly legal: boolean;
  readonly costModifierScore: number;
  readonly effectModifierScore: number;
  readonly targetingOverrideScore: number;
  readonly divergencePotentialScore: number;
  readonly tagWeightScore: number;
  readonly timingLockScore: number;
}

export interface ModeCardScoreBreakdown {
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly finalScore: number;
  readonly legalityScore: number;
  readonly rarityScore: number;
  readonly deckPriorityScore: number;
  readonly deckFamilyScore: number;
  readonly tagScore: number;
  readonly timingScore: number;
  readonly targetingScore: number;
  readonly counterabilityScore: number;
  readonly overlayScore: number;
  readonly divergencePotentialScore: number;
  readonly effectScore: number;
  readonly autoResolveScore: number;
  readonly costPenalty: number;
  readonly decayPenalty: number;
  readonly modeBonus: number;
  readonly modePenalty: number;
  readonly effectBreakdown: EffectScoreBreakdown;
  readonly tagBreakdown: TagScoreBreakdown;
  readonly timingBreakdown: TimingScoreBreakdown;
  readonly overlayBreakdown: OverlayScoreBreakdown;
}

export interface ModeCardAuditRow {
  readonly definitionId: string;
  readonly name: string;
  readonly deckType: DeckType;
  readonly mode: ModeCode;
  readonly score: number;
  readonly rarity: CardRarity;
  readonly baseCost: number;
  readonly effectiveCost: number;
  readonly targeting: Targeting;
  readonly timings: readonly TimingClass[];
  readonly tags: readonly string[];
  readonly premiumTags: readonly CardTag[];
  readonly cautionTags: readonly CardTag[];
}

export interface ModeDeckTypeSummary {
  readonly mode: ModeCode;
  readonly totalCards: number;
  readonly weightedAverageScore: number;
  readonly byDeckType: Readonly<Record<DeckType, number>>;
  readonly weightedByDeckType: Readonly<Record<DeckType, number>>;
  readonly highestScoringCardIds: readonly string[];
}

export interface ModeTagSummary {
  readonly mode: ModeCode;
  readonly byTag: Readonly<Record<string, number>>;
  readonly weightedByTag: Readonly<Record<string, number>>;
  readonly strongestTags: readonly string[];
  readonly weakestTags: readonly string[];
}

export interface ModeBalanceDiagnostics {
  readonly mode: ModeCode;
  readonly totalCards: number;
  readonly missingPrimaryDecks: readonly DeckType[];
  readonly suppressedDeckLeakage: readonly DeckType[];
  readonly premiumTagCoverage: Readonly<Record<CardTag, number>>;
  readonly premiumTagGaps: readonly CardTag[];
  readonly reactionCoverage: Readonly<Record<TimingClass, number>>;
  readonly extremeLowCostCards: number;
  readonly extremeHighCostCards: number;
}

export interface RankedCardResult {
  readonly definition: CardDefinition;
  readonly breakdown: ModeCardScoreBreakdown;
}

export const ALL_DECK_TYPES: readonly DeckType[] = Object.freeze([
  'OPPORTUNITY',
  'IPA',
  'FUBAR',
  'MISSED_OPPORTUNITY',
  'PRIVILEGED',
  'SO',
  'SABOTAGE',
  'COUNTER',
  'AID',
  'RESCUE',
  'DISCIPLINE',
  'TRUST',
  'BLUFF',
  'GHOST',
]);

export const ALL_CARD_TAGS: readonly CardTag[] = Object.freeze([
  'liquidity',
  'income',
  'resilience',
  'scale',
  'tempo',
  'sabotage',
  'counter',
  'heat',
  'trust',
  'aid',
  'divergence',
  'precision',
  'variance',
  'cascade',
  'momentum',
]);

export const ALL_EFFECT_FIELD_KEYS: readonly EffectFieldKey[] = Object.freeze([
  'cashDelta',
  'debtDelta',
  'incomeDelta',
  'expenseDelta',
  'shieldDelta',
  'heatDelta',
  'trustDelta',
  'treasuryDelta',
  'battleBudgetDelta',
  'holdChargeDelta',
  'counterIntelDelta',
  'timeDeltaMs',
  'divergenceDelta',
]);

export const ALL_TIMING_CLASSES: readonly TimingClass[] = Object.freeze([
  'PRE',
  'POST',
  'FATE',
  'CTR',
  'RES',
  'AID',
  'GBM',
  'CAS',
  'PHZ',
  'PSK',
  'END',
  'ANY',
]);

export const ALL_TARGETING: readonly Targeting[] = Object.freeze([
  'SELF',
  'OPPONENT',
  'TEAMMATE',
  'TEAM',
  'GLOBAL',
]);

export const ALL_COUNTERABILITIES: readonly Counterability[] = Object.freeze([
  'NONE',
  'SOFT',
  'HARD',
]);

export const ALL_DIVERGENCE_POTENTIALS: readonly DivergencePotential[] = Object.freeze([
  'LOW',
  'MEDIUM',
  'HIGH',
]);

export const DECK_FAMILY_BY_DECK_TYPE: Readonly<Record<DeckType, DeckFamily>> = Object.freeze({
  OPPORTUNITY: 'ECONOMY',
  IPA: 'ECONOMY',
  FUBAR: 'PRESSURE',
  MISSED_OPPORTUNITY: 'PRESSURE',
  PRIVILEGED: 'SPECIAL',
  SO: 'PRESSURE',
  SABOTAGE: 'OFFENSE',
  COUNTER: 'REACTION',
  AID: 'COOPERATION',
  RESCUE: 'COOPERATION',
  DISCIPLINE: 'PRECISION',
  TRUST: 'COOPERATION',
  BLUFF: 'OFFENSE',
  GHOST: 'PRECISION',
});

export const DECK_TYPES_BY_FAMILY: Readonly<Record<DeckFamily, readonly DeckType[]>> = Object.freeze({
  ECONOMY: freezeArray<DeckType>(['OPPORTUNITY', 'IPA']),
  REACTION: freezeArray<DeckType>(['COUNTER']),
  OFFENSE: freezeArray<DeckType>(['SABOTAGE', 'BLUFF']),
  COOPERATION: freezeArray<DeckType>(['AID', 'RESCUE', 'TRUST']),
  PRECISION: freezeArray<DeckType>(['DISCIPLINE', 'GHOST']),
  PRESSURE: freezeArray<DeckType>(['FUBAR', 'MISSED_OPPORTUNITY', 'SO']),
  SPECIAL: freezeArray<DeckType>(['PRIVILEGED']),
});

export const MODE_TAG_WEIGHTS: Readonly<
  Record<ModeCode, Readonly<Record<string, number>>>
> = Object.freeze({
  solo: Object.freeze({
    liquidity: 2.4,
    income: 2.6,
    resilience: 2.1,
    scale: 2.5,
    tempo: 1.15,
    sabotage: 0.1,
    counter: 0.25,
    heat: 0.45,
    trust: 0.1,
    aid: 0.1,
    divergence: 0.55,
    precision: 1.2,
    variance: 0.75,
    cascade: 1.2,
    momentum: 1.75,
  }),
  pvp: Object.freeze({
    liquidity: 0.9,
    income: 0.8,
    resilience: 1.1,
    scale: 0.65,
    tempo: 2.45,
    sabotage: 2.95,
    counter: 2.5,
    heat: 1.65,
    trust: 0.0,
    aid: 0.0,
    divergence: 0.4,
    precision: 1.45,
    variance: 1.95,
    cascade: 1.85,
    momentum: 2.15,
  }),
  coop: Object.freeze({
    liquidity: 1.45,
    income: 1.8,
    resilience: 2.25,
    scale: 1.3,
    tempo: 1.0,
    sabotage: 0.15,
    counter: 0.45,
    heat: 0.65,
    trust: 3.15,
    aid: 3.1,
    divergence: 0.35,
    precision: 0.95,
    variance: 0.45,
    cascade: 1.15,
    momentum: 1.1,
  }),
  ghost: Object.freeze({
    liquidity: 1.2,
    income: 1.05,
    resilience: 1.45,
    scale: 0.95,
    tempo: 1.65,
    sabotage: 0.0,
    counter: 0.0,
    heat: 0.85,
    trust: 0.0,
    aid: 0.0,
    divergence: 3.2,
    precision: 2.65,
    variance: 2.0,
    cascade: 0.95,
    momentum: 1.5,
  }),
});

export const RARITY_WEIGHTS: Readonly<Record<CardRarity, number>> =
  Object.freeze({
    COMMON: 1,
    UNCOMMON: 2,
    RARE: 3,
    LEGENDARY: 4,
  });

export const MODE_RARITY_WEIGHTS: Readonly<
  Record<ModeCode, Readonly<Record<CardRarity, number>>>
> = Object.freeze({
  solo: Object.freeze({
    COMMON: 1.0,
    UNCOMMON: 2.0,
    RARE: 3.1,
    LEGENDARY: 4.35,
  }),
  pvp: Object.freeze({
    COMMON: 1.0,
    UNCOMMON: 2.15,
    RARE: 3.25,
    LEGENDARY: 4.5,
  }),
  coop: Object.freeze({
    COMMON: 1.0,
    UNCOMMON: 2.0,
    RARE: 3.0,
    LEGENDARY: 4.25,
  }),
  ghost: Object.freeze({
    COMMON: 1.0,
    UNCOMMON: 2.05,
    RARE: 3.2,
    LEGENDARY: 4.6,
  }),
});

export const MODE_DECK_PRIORITIES: Readonly<
  Record<ModeCode, Readonly<Record<DeckType, number>>>
> = Object.freeze({
  solo: Object.freeze({
    OPPORTUNITY: 10,
    IPA: 20,
    PRIVILEGED: 30,
    SO: 40,
    DISCIPLINE: 50,
    FUBAR: 60,
    MISSED_OPPORTUNITY: 70,
    COUNTER: 80,
    SABOTAGE: 90,
    BLUFF: 100,
    AID: 110,
    RESCUE: 120,
    TRUST: 130,
    GHOST: 140,
  }),
  pvp: Object.freeze({
    SABOTAGE: 10,
    COUNTER: 20,
    BLUFF: 30,
    PRIVILEGED: 40,
    OPPORTUNITY: 50,
    IPA: 60,
    SO: 70,
    DISCIPLINE: 80,
    FUBAR: 90,
    MISSED_OPPORTUNITY: 100,
    RESCUE: 110,
    AID: 120,
    TRUST: 130,
    GHOST: 140,
  }),
  coop: Object.freeze({
    AID: 10,
    RESCUE: 20,
    TRUST: 30,
    OPPORTUNITY: 40,
    IPA: 50,
    SO: 60,
    PRIVILEGED: 70,
    COUNTER: 80,
    DISCIPLINE: 90,
    BLUFF: 100,
    SABOTAGE: 110,
    FUBAR: 120,
    MISSED_OPPORTUNITY: 130,
    GHOST: 140,
  }),
  ghost: Object.freeze({
    GHOST: 10,
    DISCIPLINE: 20,
    OPPORTUNITY: 30,
    PRIVILEGED: 40,
    IPA: 50,
    SO: 60,
    FUBAR: 70,
    MISSED_OPPORTUNITY: 80,
    COUNTER: 90,
    BLUFF: 100,
    RESCUE: 110,
    AID: 120,
    TRUST: 130,
    SABOTAGE: 140,
  }),
});

export const MODE_TIMING_WEIGHTS: Readonly<
  Record<ModeCode, Readonly<Record<TimingClass, number>>>
> = Object.freeze({
  solo: Object.freeze({
    PRE: 2.4,
    POST: 1.2,
    FATE: 1.55,
    CTR: 1.1,
    RES: 0.2,
    AID: 0.1,
    GBM: 0.2,
    CAS: 1.4,
    PHZ: 2.55,
    PSK: 1.9,
    END: 2.25,
    ANY: 1.0,
  }),
  pvp: Object.freeze({
    PRE: 1.25,
    POST: 1.7,
    FATE: 2.25,
    CTR: 2.75,
    RES: 0.1,
    AID: 0.0,
    GBM: 0.0,
    CAS: 1.3,
    PHZ: 0.4,
    PSK: 2.2,
    END: 1.2,
    ANY: 1.0,
  }),
  coop: Object.freeze({
    PRE: 1.0,
    POST: 1.15,
    FATE: 1.0,
    CTR: 0.7,
    RES: 2.8,
    AID: 2.4,
    GBM: 0.0,
    CAS: 1.8,
    PHZ: 0.7,
    PSK: 1.3,
    END: 1.1,
    ANY: 1.0,
  }),
  ghost: Object.freeze({
    PRE: 1.2,
    POST: 1.65,
    FATE: 1.0,
    CTR: 0.2,
    RES: 0.0,
    AID: 0.0,
    GBM: 3.0,
    CAS: 1.1,
    PHZ: 0.5,
    PSK: 1.5,
    END: 1.95,
    ANY: 1.0,
  }),
});

export const MODE_TARGETING_WEIGHTS: Readonly<
  Record<ModeCode, Readonly<Record<Targeting, number>>>
> = Object.freeze({
  solo: Object.freeze({
    SELF: 1.85,
    OPPONENT: 0.25,
    TEAMMATE: 0.0,
    TEAM: 0.0,
    GLOBAL: 0.85,
  }),
  pvp: Object.freeze({
    SELF: 1.0,
    OPPONENT: 2.4,
    TEAMMATE: 0.0,
    TEAM: 0.0,
    GLOBAL: 0.9,
  }),
  coop: Object.freeze({
    SELF: 0.85,
    OPPONENT: 0.15,
    TEAMMATE: 2.15,
    TEAM: 2.35,
    GLOBAL: 0.8,
  }),
  ghost: Object.freeze({
    SELF: 1.25,
    OPPONENT: 0.35,
    TEAMMATE: 0.0,
    TEAM: 0.0,
    GLOBAL: 1.0,
  }),
});

export const MODE_COUNTERABILITY_WEIGHTS: Readonly<
  Record<ModeCode, Readonly<Record<Counterability, number>>>
> = Object.freeze({
  solo: Object.freeze({
    NONE: 1.0,
    SOFT: 1.1,
    HARD: 1.3,
  }),
  pvp: Object.freeze({
    NONE: 1.0,
    SOFT: 1.35,
    HARD: 1.85,
  }),
  coop: Object.freeze({
    NONE: 1.0,
    SOFT: 1.1,
    HARD: 1.25,
  }),
  ghost: Object.freeze({
    NONE: 1.0,
    SOFT: 1.2,
    HARD: 1.4,
  }),
});

export const MODE_DIVERGENCE_WEIGHTS: Readonly<
  Record<ModeCode, Readonly<Record<DivergencePotential, number>>>
> = Object.freeze({
  solo: Object.freeze({
    LOW: 1.0,
    MEDIUM: 1.1,
    HIGH: 1.2,
  }),
  pvp: Object.freeze({
    LOW: 1.0,
    MEDIUM: 1.05,
    HIGH: 1.15,
  }),
  coop: Object.freeze({
    LOW: 1.0,
    MEDIUM: 1.05,
    HIGH: 1.1,
  }),
  ghost: Object.freeze({
    LOW: 1.0,
    MEDIUM: 1.35,
    HIGH: 1.9,
  }),
});

export const EFFECT_FIELD_BASE_COEFFICIENTS: Readonly<Record<EffectFieldKey, number>> =
  Object.freeze({
    cashDelta: 0.0025,
    debtDelta: 0.0023,
    incomeDelta: 0.0055,
    expenseDelta: 0.0042,
    shieldDelta: 0.018,
    heatDelta: 0.02,
    trustDelta: 0.14,
    treasuryDelta: 0.006,
    battleBudgetDelta: 0.01,
    holdChargeDelta: 0.035,
    counterIntelDelta: 0.05,
    timeDeltaMs: 0.00035,
    divergenceDelta: 28,
  });

export const MODE_EFFECT_FIELD_MULTIPLIERS: Readonly<
  Record<ModeCode, Readonly<Record<EffectFieldKey, number>>>
> = Object.freeze({
  solo: Object.freeze({
    cashDelta: 1.25,
    debtDelta: 0.95,
    incomeDelta: 1.35,
    expenseDelta: 1.05,
    shieldDelta: 1.2,
    heatDelta: 0.55,
    trustDelta: 0.1,
    treasuryDelta: 0.1,
    battleBudgetDelta: 0.3,
    holdChargeDelta: 1.5,
    counterIntelDelta: 0.3,
    timeDeltaMs: 0.95,
    divergenceDelta: 0.55,
  }),
  pvp: Object.freeze({
    cashDelta: 0.75,
    debtDelta: 1.35,
    incomeDelta: 0.7,
    expenseDelta: 1.15,
    shieldDelta: 0.85,
    heatDelta: 1.3,
    trustDelta: 0.0,
    treasuryDelta: 0.0,
    battleBudgetDelta: 1.55,
    holdChargeDelta: 0.5,
    counterIntelDelta: 1.4,
    timeDeltaMs: 1.25,
    divergenceDelta: 0.45,
  }),
  coop: Object.freeze({
    cashDelta: 0.9,
    debtDelta: 0.6,
    incomeDelta: 1.0,
    expenseDelta: 0.8,
    shieldDelta: 1.1,
    heatDelta: 0.5,
    trustDelta: 1.9,
    treasuryDelta: 1.75,
    battleBudgetDelta: 0.3,
    holdChargeDelta: 0.35,
    counterIntelDelta: 0.7,
    timeDeltaMs: 0.85,
    divergenceDelta: 0.4,
  }),
  ghost: Object.freeze({
    cashDelta: 0.75,
    debtDelta: 0.7,
    incomeDelta: 0.75,
    expenseDelta: 0.7,
    shieldDelta: 0.9,
    heatDelta: 0.65,
    trustDelta: 0.0,
    treasuryDelta: 0.0,
    battleBudgetDelta: 0.25,
    holdChargeDelta: 0.5,
    counterIntelDelta: 0.6,
    timeDeltaMs: 1.05,
    divergenceDelta: 2.8,
  }),
});

export const MODE_SCORING_TUNING: Readonly<Record<ModeCode, ModeScoringTuning>> = Object.freeze({
  solo: Object.freeze({
    legalityPenalty: 400,
    deckPriorityFactor: 3.2,
    deckFamilyFactor: 8,
    tagFactor: 10,
    timingFactor: 9,
    targetingFactor: 7,
    counterabilityFactor: 5,
    rarityFactor: 100,
    effectFactor: 1,
    overlayFactor: 12,
    divergenceFactor: 9,
    autoResolveFactor: 6,
    decayPenaltyFactor: 1.9,
    costPenaltyDivisor: 900,
    lowCostBonusThreshold: 900,
    highCostPenaltyThreshold: 8000,
    lowCostBonus: 5,
    highCostPenalty: 8,
    premiumDeckBonus: 16,
    suppressedDeckPenalty: 18,
  }),
  pvp: Object.freeze({
    legalityPenalty: 450,
    deckPriorityFactor: 3.35,
    deckFamilyFactor: 9,
    tagFactor: 10,
    timingFactor: 10,
    targetingFactor: 8,
    counterabilityFactor: 7,
    rarityFactor: 100,
    effectFactor: 1,
    overlayFactor: 12,
    divergenceFactor: 7,
    autoResolveFactor: 4,
    decayPenaltyFactor: 1.5,
    costPenaltyDivisor: 1250,
    lowCostBonusThreshold: 800,
    highCostPenaltyThreshold: 9000,
    lowCostBonus: 4,
    highCostPenalty: 6,
    premiumDeckBonus: 18,
    suppressedDeckPenalty: 22,
  }),
  coop: Object.freeze({
    legalityPenalty: 425,
    deckPriorityFactor: 3.15,
    deckFamilyFactor: 8,
    tagFactor: 10,
    timingFactor: 10,
    targetingFactor: 7,
    counterabilityFactor: 4,
    rarityFactor: 100,
    effectFactor: 1,
    overlayFactor: 12,
    divergenceFactor: 6,
    autoResolveFactor: 5,
    decayPenaltyFactor: 1.8,
    costPenaltyDivisor: 1050,
    lowCostBonusThreshold: 850,
    highCostPenaltyThreshold: 8500,
    lowCostBonus: 4,
    highCostPenalty: 7,
    premiumDeckBonus: 18,
    suppressedDeckPenalty: 20,
  }),
  ghost: Object.freeze({
    legalityPenalty: 475,
    deckPriorityFactor: 3.25,
    deckFamilyFactor: 8,
    tagFactor: 10,
    timingFactor: 11,
    targetingFactor: 6,
    counterabilityFactor: 4,
    rarityFactor: 100,
    effectFactor: 1,
    overlayFactor: 13,
    divergenceFactor: 14,
    autoResolveFactor: 3,
    decayPenaltyFactor: 1.4,
    costPenaltyDivisor: 1150,
    lowCostBonusThreshold: 700,
    highCostPenaltyThreshold: 9000,
    lowCostBonus: 6,
    highCostPenalty: 7,
    premiumDeckBonus: 20,
    suppressedDeckPenalty: 24,
  }),
});

export const MODE_DOCTRINE_PROFILES: Readonly<Record<ModeCode, ModeDoctrineProfile>> = Object.freeze({
  solo: Object.freeze({
    mode: 'solo',
    codename: 'EMPIRE',
    screenName: 'Go Alone',
    doctrineSummary:
      'Capital allocation hand: opportunity, compounding, resilience, and phase-boundary commitment drive the run.',
    primaryDecks: freezeArray<DeckType>(['OPPORTUNITY', 'IPA', 'PRIVILEGED', 'SO']),
    secondaryDecks: freezeArray<DeckType>(['DISCIPLINE', 'FUBAR', 'MISSED_OPPORTUNITY']),
    suppressedDecks: freezeArray<DeckType>(['SABOTAGE', 'BLUFF', 'AID', 'RESCUE', 'TRUST', 'GHOST']),
    reactionTimings: freezeArray<TimingClass>(['PRE', 'PHZ', 'PSK', 'END', 'CAS']),
    premiumTags: freezeArray<CardTag>(['liquidity', 'income', 'resilience', 'scale', 'momentum']),
    cautionTags: freezeArray<CardTag>(['heat', 'sabotage', 'trust', 'aid']),
    preferredTargeting: freezeArray<Targeting>(['SELF', 'GLOBAL']),
    preferredCounterability: freezeArray<Counterability>(['HARD', 'SOFT']),
    preferredDivergence: freezeArray<DivergencePotential>(['LOW', 'MEDIUM']),
    lowCostBias: false,
    highCostTolerance: 0.85,
    prefersPersistence: true,
    prefersAutoResolve: true,
  }),
  pvp: Object.freeze({
    mode: 'pvp',
    codename: 'PREDATOR',
    screenName: 'Head to Head',
    doctrineSummary:
      'Tactical combat hand: sabotage, counterplay, bluff tempo, and war-chest leverage determine victory.',
    primaryDecks: freezeArray<DeckType>(['SABOTAGE', 'COUNTER', 'BLUFF']),
    secondaryDecks: freezeArray<DeckType>(['PRIVILEGED', 'OPPORTUNITY', 'IPA', 'SO']),
    suppressedDecks: freezeArray<DeckType>(['AID', 'RESCUE', 'TRUST', 'GHOST']),
    reactionTimings: freezeArray<TimingClass>(['CTR', 'FATE', 'POST', 'PSK', 'CAS']),
    premiumTags: freezeArray<CardTag>(['tempo', 'sabotage', 'counter', 'heat', 'momentum']),
    cautionTags: freezeArray<CardTag>(['trust', 'aid', 'scale']),
    preferredTargeting: freezeArray<Targeting>(['OPPONENT', 'GLOBAL']),
    preferredCounterability: freezeArray<Counterability>(['HARD', 'SOFT']),
    preferredDivergence: freezeArray<DivergencePotential>(['LOW', 'MEDIUM']),
    lowCostBias: true,
    highCostTolerance: 0.7,
    prefersPersistence: false,
    prefersAutoResolve: false,
  }),
  coop: Object.freeze({
    mode: 'coop',
    codename: 'SYNDICATE',
    screenName: 'Team Up',
    doctrineSummary:
      'Contract-based cooperation hand: rescue velocity, aid terms, treasury governance, and trust compounding matter.',
    primaryDecks: freezeArray<DeckType>(['AID', 'RESCUE', 'TRUST']),
    secondaryDecks: freezeArray<DeckType>(['OPPORTUNITY', 'IPA', 'SO', 'PRIVILEGED']),
    suppressedDecks: freezeArray<DeckType>(['SABOTAGE', 'BLUFF', 'GHOST']),
    reactionTimings: freezeArray<TimingClass>(['RES', 'AID', 'CAS', 'PSK']),
    premiumTags: freezeArray<CardTag>(['trust', 'aid', 'resilience', 'income', 'liquidity']),
    cautionTags: freezeArray<CardTag>(['sabotage', 'heat', 'variance']),
    preferredTargeting: freezeArray<Targeting>(['TEAMMATE', 'TEAM', 'SELF']),
    preferredCounterability: freezeArray<Counterability>(['SOFT', 'HARD']),
    preferredDivergence: freezeArray<DivergencePotential>(['LOW', 'MEDIUM']),
    lowCostBias: false,
    highCostTolerance: 0.8,
    prefersPersistence: true,
    prefersAutoResolve: false,
  }),
  ghost: Object.freeze({
    mode: 'ghost',
    codename: 'PHANTOM',
    screenName: 'Chase a Legend',
    doctrineSummary:
      'Precision instrument hand: ghost markers, discipline, deterministic execution, and divergence capture define the gap.',
    primaryDecks: freezeArray<DeckType>(['GHOST', 'DISCIPLINE']),
    secondaryDecks: freezeArray<DeckType>(['OPPORTUNITY', 'PRIVILEGED', 'IPA', 'SO']),
    suppressedDecks: freezeArray<DeckType>(['SABOTAGE', 'COUNTER', 'AID', 'RESCUE', 'TRUST']),
    reactionTimings: freezeArray<TimingClass>(['GBM', 'POST', 'END', 'PSK']),
    premiumTags: freezeArray<CardTag>(['divergence', 'precision', 'variance', 'tempo', 'resilience']),
    cautionTags: freezeArray<CardTag>(['aid', 'trust', 'sabotage', 'counter']),
    preferredTargeting: freezeArray<Targeting>(['SELF', 'GLOBAL']),
    preferredCounterability: freezeArray<Counterability>(['HARD', 'SOFT']),
    preferredDivergence: freezeArray<DivergencePotential>(['HIGH', 'MEDIUM']),
    lowCostBias: true,
    highCostTolerance: 0.75,
    prefersPersistence: true,
    prefersAutoResolve: false,
  }),
});

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return freezeArray(output);
}

function uniqueTiming(values: readonly TimingClass[]): readonly TimingClass[] {
  const seen = new Set<TimingClass>();
  const output: TimingClass[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return freezeArray(output);
}

function uniqueDeckTypes(values: readonly DeckType[]): readonly DeckType[] {
  const seen = new Set<DeckType>();
  const output: DeckType[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return freezeArray(output);
}

function uniqueCardTags(values: readonly CardTag[]): readonly CardTag[] {
  const seen = new Set<CardTag>();
  const output: CardTag[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return freezeArray(output);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function absoluteNumber(value: number | null | undefined): number {
  return Math.abs(value ?? 0);
}

function toRounded(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

export function round4(value: number): number {
  return toRounded(value, 4);
}

export function round3(value: number): number {
  return toRounded(value, 3);
}

export function round2(value: number): number {
  return toRounded(value, 2);
}

export function buildEmptyDeckTypeRecord(initialValue = 0): Record<DeckType, number> {
  return {
    OPPORTUNITY: initialValue,
    IPA: initialValue,
    FUBAR: initialValue,
    MISSED_OPPORTUNITY: initialValue,
    PRIVILEGED: initialValue,
    SO: initialValue,
    SABOTAGE: initialValue,
    COUNTER: initialValue,
    AID: initialValue,
    RESCUE: initialValue,
    DISCIPLINE: initialValue,
    TRUST: initialValue,
    BLUFF: initialValue,
    GHOST: initialValue,
  };
}

export function buildEmptyTimingRecord(initialValue = 0): Record<TimingClass, number> {
  return {
    PRE: initialValue,
    POST: initialValue,
    FATE: initialValue,
    CTR: initialValue,
    RES: initialValue,
    AID: initialValue,
    GBM: initialValue,
    CAS: initialValue,
    PHZ: initialValue,
    PSK: initialValue,
    END: initialValue,
    ANY: initialValue,
  };
}

export function buildEmptyTargetingRecord(initialValue = 0): Record<Targeting, number> {
  return {
    SELF: initialValue,
    OPPONENT: initialValue,
    TEAMMATE: initialValue,
    TEAM: initialValue,
    GLOBAL: initialValue,
  };
}

export function buildEmptyCounterabilityRecord(
  initialValue = 0,
): Record<Counterability, number> {
  return {
    NONE: initialValue,
    SOFT: initialValue,
    HARD: initialValue,
  };
}

export function buildEmptyDivergencePotentialRecord(
  initialValue = 0,
): Record<DivergencePotential, number> {
  return {
    LOW: initialValue,
    MEDIUM: initialValue,
    HIGH: initialValue,
  };
}

export function buildEmptyEffectFieldRecord(
  initialValue = 0,
): Record<EffectFieldKey, number> {
  return {
    cashDelta: initialValue,
    debtDelta: initialValue,
    incomeDelta: initialValue,
    expenseDelta: initialValue,
    shieldDelta: initialValue,
    heatDelta: initialValue,
    trustDelta: initialValue,
    treasuryDelta: initialValue,
    battleBudgetDelta: initialValue,
    holdChargeDelta: initialValue,
    counterIntelDelta: initialValue,
    timeDeltaMs: initialValue,
    divergenceDelta: initialValue,
  };
}

export function buildEmptyTagRecord(initialValue = 0): Record<CardTag, number> {
  return {
    liquidity: initialValue,
    income: initialValue,
    resilience: initialValue,
    scale: initialValue,
    tempo: initialValue,
    sabotage: initialValue,
    counter: initialValue,
    heat: initialValue,
    trust: initialValue,
    aid: initialValue,
    divergence: initialValue,
    precision: initialValue,
    variance: initialValue,
    cascade: initialValue,
    momentum: initialValue,
  };
}

export function getDeckFamily(deckType: DeckType): DeckFamily {
  return DECK_FAMILY_BY_DECK_TYPE[deckType];
}

export function isCardTag(value: string): value is CardTag {
  return (ALL_CARD_TAGS as readonly string[]).includes(value);
}

export function getModeDoctrine(mode: ModeCode): ModeDoctrineProfile {
  return MODE_DOCTRINE_PROFILES[mode];
}

export function getModeScoringTuning(mode: ModeCode): ModeScoringTuning {
  return MODE_SCORING_TUNING[mode];
}

export function getModeTagWeight(mode: ModeCode, tag: string): number {
  return MODE_TAG_WEIGHTS[mode][tag] ?? 1;
}

export function getModeDeckPriority(
  mode: ModeCode,
  deckType: DeckType,
): number {
  return MODE_DECK_PRIORITIES[mode][deckType] ?? 999;
}

export function getModeTimingWeight(
  mode: ModeCode,
  timing: TimingClass,
): number {
  return MODE_TIMING_WEIGHTS[mode][timing] ?? 1;
}

export function getModeTargetingWeight(
  mode: ModeCode,
  targeting: Targeting,
): number {
  return MODE_TARGETING_WEIGHTS[mode][targeting] ?? 1;
}

export function getModeCounterabilityWeight(
  mode: ModeCode,
  counterability: Counterability,
): number {
  return MODE_COUNTERABILITY_WEIGHTS[mode][counterability] ?? 1;
}

export function getModeRarityWeight(
  mode: ModeCode,
  rarity: CardRarity,
): number {
  return MODE_RARITY_WEIGHTS[mode][rarity] ?? RARITY_WEIGHTS[rarity] ?? 1;
}

export function getModeDivergenceWeight(
  mode: ModeCode,
  divergencePotential: DivergencePotential,
): number {
  return MODE_DIVERGENCE_WEIGHTS[mode][divergencePotential] ?? 1;
}

export function getEffectiveCostForMode(
  card: CardDefinition,
  mode: ModeCode,
): number {
  const overlay = resolveModeOverlay(card, mode);
  return round3(card.baseCost * overlay.costModifier);
}

export function getEffectiveTargetingForMode(
  card: CardDefinition,
  mode: ModeCode,
): Targeting {
  const overlay = resolveModeOverlay(card, mode);
  return overlay.targetingOverride ?? card.targeting;
}

export function getEffectiveTimingClassesForMode(
  card: CardDefinition,
  mode: ModeCode,
): readonly TimingClass[] {
  const overlay = resolveModeOverlay(card, mode);
  return uniqueTiming([
    ...card.timingClass,
    ...overlay.timingLock,
  ]);
}

export function getEffectiveDivergencePotentialForMode(
  card: CardDefinition,
  mode: ModeCode,
): DivergencePotential {
  const overlay = resolveModeOverlay(card, mode);
  return overlay.divergencePotential ?? 'LOW';
}

export function getEffectiveModeTagWeights(
  card: CardDefinition,
  mode: ModeCode,
): Readonly<Record<string, number>> {
  const overlay = resolveModeOverlay(card, mode);
  const merged: Record<string, number> = {};

  for (const tag of uniqueStrings(card.tags)) {
    merged[tag] = getModeTagWeight(mode, tag) + (overlay.tagWeights[tag] ?? 0);
  }

  for (const [tag, weight] of Object.entries(overlay.tagWeights) as [string, number][]) {
    if (!(tag in merged)) {
      merged[tag] = getModeTagWeight(mode, tag) + weight;
    }
  }

  return Object.freeze(merged);
}

export function buildModeScoreSnapshot(mode: ModeCode): ModeScoreSnapshot {
  return Object.freeze({
    mode,
    doctrine: getModeDoctrine(mode),
    tagWeights: MODE_TAG_WEIGHTS[mode],
    deckPriorities: MODE_DECK_PRIORITIES[mode],
    timingWeights: MODE_TIMING_WEIGHTS[mode],
    targetingWeights: MODE_TARGETING_WEIGHTS[mode],
    counterabilityWeights: MODE_COUNTERABILITY_WEIGHTS[mode],
    divergenceWeights: MODE_DIVERGENCE_WEIGHTS[mode],
    tuning: getModeScoringTuning(mode),
  });
}

export function listPremiumTagsForMode(mode: ModeCode): readonly CardTag[] {
  return MODE_DOCTRINE_PROFILES[mode].premiumTags;
}

export function listCautionTagsForMode(mode: ModeCode): readonly CardTag[] {
  return MODE_DOCTRINE_PROFILES[mode].cautionTags;
}

export function listPrimaryDecksForMode(mode: ModeCode): readonly DeckType[] {
  return MODE_DOCTRINE_PROFILES[mode].primaryDecks;
}

export function listSuppressedDecksForMode(mode: ModeCode): readonly DeckType[] {
  return MODE_DOCTRINE_PROFILES[mode].suppressedDecks;
}

export function isPrimaryDeckForMode(mode: ModeCode, deckType: DeckType): boolean {
  return MODE_DOCTRINE_PROFILES[mode].primaryDecks.includes(deckType);
}

export function isSuppressedDeckForMode(mode: ModeCode, deckType: DeckType): boolean {
  return MODE_DOCTRINE_PROFILES[mode].suppressedDecks.includes(deckType);
}

export function isPreferredTargetingForMode(mode: ModeCode, targeting: Targeting): boolean {
  return MODE_DOCTRINE_PROFILES[mode].preferredTargeting.includes(targeting);
}

export function isPreferredCounterabilityForMode(
  mode: ModeCode,
  counterability: Counterability,
): boolean {
  return MODE_DOCTRINE_PROFILES[mode].preferredCounterability.includes(counterability);
}

export function isPreferredDivergencePotentialForMode(
  mode: ModeCode,
  divergencePotential: DivergencePotential,
): boolean {
  return MODE_DOCTRINE_PROFILES[mode].preferredDivergence.includes(divergencePotential);
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function getKnownTagsForCard(card: CardDefinition): readonly CardTag[] {
  const output: CardTag[] = [];

  for (const tag of card.tags) {
    const normalized = normalizeTag(tag);

    if (isCardTag(normalized)) {
      output.push(normalized);
    }
  }

  return uniqueCardTags(output);
}

export function getUnknownTagsForCard(card: CardDefinition): readonly string[] {
  const output: string[] = [];

  for (const tag of card.tags) {
    const normalized = normalizeTag(tag);

    if (!isCardTag(normalized)) {
      output.push(normalized);
    }
  }

  return uniqueStrings(output);
}

export function buildTagVectorForCard(card: CardDefinition): Readonly<Record<CardTag, number>> {
  const record = buildEmptyTagRecord(0);

  for (const tag of getKnownTagsForCard(card)) {
    record[tag] += 1;
  }

  return Object.freeze(record);
}

export function buildDeckPresence(cards: readonly CardDefinition[]): Readonly<Record<DeckType, number>> {
  const record = buildEmptyDeckTypeRecord(0);

  for (const card of cards) {
    record[card.deckType] += 1;
  }

  return Object.freeze(record);
}

export function buildTagPresence(cards: readonly CardDefinition[]): Readonly<Record<CardTag, number>> {
  const record = buildEmptyTagRecord(0);

  for (const card of cards) {
    for (const tag of getKnownTagsForCard(card)) {
      record[tag] += 1;
    }
  }

  return Object.freeze(record);
}

export function buildTimingPresence(cards: readonly CardDefinition[]): Readonly<Record<TimingClass, number>> {
  const record = buildEmptyTimingRecord(0);

  for (const card of cards) {
    for (const timing of card.timingClass) {
      record[timing] += 1;
    }
  }

  return Object.freeze(record);
}

export function getDeckFamilyWeight(
  mode: ModeCode,
  deckType: DeckType,
): number {
  const family = getDeckFamily(deckType);

  switch (mode) {
    case 'solo': {
      switch (family) {
        case 'ECONOMY':
          return 1.7;
        case 'PRESSURE':
          return 1.3;
        case 'PRECISION':
          return 1.1;
        case 'SPECIAL':
          return 1.25;
        case 'REACTION':
          return 0.75;
        case 'OFFENSE':
          return 0.35;
        case 'COOPERATION':
          return 0.2;
        default:
          return 1;
      }
    }
    case 'pvp': {
      switch (family) {
        case 'OFFENSE':
          return 1.75;
        case 'REACTION':
          return 1.55;
        case 'SPECIAL':
          return 1.25;
        case 'ECONOMY':
          return 0.95;
        case 'PRESSURE':
          return 1.15;
        case 'PRECISION':
          return 1.0;
        case 'COOPERATION':
          return 0.15;
        default:
          return 1;
      }
    }
    case 'coop': {
      switch (family) {
        case 'COOPERATION':
          return 1.8;
        case 'ECONOMY':
          return 1.15;
        case 'PRESSURE':
          return 1.05;
        case 'SPECIAL':
          return 1.0;
        case 'REACTION':
          return 0.9;
        case 'PRECISION':
          return 0.8;
        case 'OFFENSE':
          return 0.25;
        default:
          return 1;
      }
    }
    case 'ghost': {
      switch (family) {
        case 'PRECISION':
          return 1.85;
        case 'ECONOMY':
          return 1.0;
        case 'SPECIAL':
          return 1.1;
        case 'PRESSURE':
          return 0.9;
        case 'REACTION':
          return 0.4;
        case 'COOPERATION':
          return 0.1;
        case 'OFFENSE':
          return 0.15;
        default:
          return 1;
      }
    }
    default:
      return 1;
  }
}

export function scoreEffectPayloadForMode(
  effect: EffectPayload,
  mode: ModeCode,
): EffectScoreBreakdown {
  const fields = buildEmptyEffectFieldRecord(0);
  let total = 0;

  for (const key of ALL_EFFECT_FIELD_KEYS) {
    const magnitude = absoluteNumber(effect[key]);

    if (magnitude <= 0) {
      continue;
    }

    const coefficient = EFFECT_FIELD_BASE_COEFFICIENTS[key];
    const multiplier = MODE_EFFECT_FIELD_MULTIPLIERS[mode][key] ?? 1;
    const contribution = magnitude * coefficient * multiplier;
    fields[key] = round4(contribution);
    total += contribution;
  }

  const cascadeBonus = effect.cascadeTag ? 6 : 0;
  const injectCardsBonus = (effect.injectCards?.length ?? 0) * 2.25;
  const exhaustCardsBonus = (effect.exhaustCards?.length ?? 0) * 1.15;
  const badgesBonus = (effect.grantBadges?.length ?? 0) * 1.75;
  const namedActionBonus = effect.namedActionId ? 1.5 : 0;

  total += cascadeBonus;
  total += injectCardsBonus;
  total += exhaustCardsBonus;
  total += badgesBonus;
  total += namedActionBonus;

  return Object.freeze({
    total: round4(total),
    numericFields: Object.freeze(fields),
    cascadeBonus: round4(cascadeBonus),
    injectCardsBonus: round4(injectCardsBonus),
    exhaustCardsBonus: round4(exhaustCardsBonus),
    badgesBonus: round4(badgesBonus),
    namedActionBonus: round4(namedActionBonus),
  });
}

export function scoreTagsForMode(
  card: CardDefinition,
  mode: ModeCode,
): TagScoreBreakdown {
  const overlayWeights = resolveModeOverlay(card, mode).tagWeights;
  const contributions: Record<string, number> = {};
  const premiumMatches: CardTag[] = [];
  const cautionMatches: CardTag[] = [];
  let total = 0;

  for (const tag of uniqueStrings(card.tags)) {
    const normalized = normalizeTag(tag);
    const baseWeight = getModeTagWeight(mode, normalized);
    const overlayWeight = overlayWeights[normalized] ?? 0;
    const contribution = baseWeight + overlayWeight;

    contributions[normalized] = round4(contribution);
    total += contribution;

    if (isCardTag(normalized) && listPremiumTagsForMode(mode).includes(normalized)) {
      premiumMatches.push(normalized);
      total += 0.75;
    }

    if (isCardTag(normalized) && listCautionTagsForMode(mode).includes(normalized)) {
      cautionMatches.push(normalized);
      total -= 0.35;
    }
  }

  return Object.freeze({
    total: round4(total),
    contributions: Object.freeze(contributions),
    matchedPremiumTags: uniqueCardTags(premiumMatches),
    matchedCautionTags: uniqueCardTags(cautionMatches),
  });
}

export function scoreTimingsForMode(
  card: CardDefinition,
  mode: ModeCode,
): TimingScoreBreakdown {
  const effectiveTimings = getEffectiveTimingClassesForMode(card, mode);
  const contributions = buildEmptyTimingRecord(0);
  let total = 0;

  for (const timing of effectiveTimings) {
    const contribution = getModeTimingWeight(mode, timing);
    contributions[timing] = round4(contribution);
    total += contribution;
  }

  return Object.freeze({
    total: round4(total),
    contributions: Object.freeze(contributions),
    effectiveTimings,
  });
}

export function scoreOverlayForMode(
  card: CardDefinition,
  mode: ModeCode,
): OverlayScoreBreakdown {
  const overlay = resolveModeOverlay(card, mode);
  const costModifierScore = overlay.costModifier >= 1
    ? (overlay.costModifier - 1) * 4
    : (1 - overlay.costModifier) * 2.5;
  const effectModifierScore = overlay.effectModifier >= 1
    ? (overlay.effectModifier - 1) * 6
    : (1 - overlay.effectModifier) * 3;
  const targetingOverrideScore = overlay.targetingOverride
    ? getModeTargetingWeight(mode, overlay.targetingOverride) * 0.65
    : 0;
  const divergencePotentialScore = overlay.divergencePotential
    ? getModeDivergenceWeight(mode, overlay.divergencePotential) * 2
    : 0;
  const tagWeightScore = (Object.values(overlay.tagWeights) as number[])
    .reduce((sum, value) => sum + value, 0);
  const timingLockScore = overlay.timingLock
    .reduce((sum, timing) => sum + getModeTimingWeight(mode, timing), 0)
    * 0.45;

  const total =
    costModifierScore +
    effectModifierScore +
    targetingOverrideScore +
    divergencePotentialScore +
    tagWeightScore +
    timingLockScore;

  return Object.freeze({
    total: round4(total),
    legal: overlay.legal,
    costModifierScore: round4(costModifierScore),
    effectModifierScore: round4(effectModifierScore),
    targetingOverrideScore: round4(targetingOverrideScore),
    divergencePotentialScore: round4(divergencePotentialScore),
    tagWeightScore: round4(tagWeightScore),
    timingLockScore: round4(timingLockScore),
  });
}

export function explainCardScoreForMode(
  card: CardDefinition,
  mode: ModeCode,
): ModeCardScoreBreakdown {
  const tuning = getModeScoringTuning(mode);
  const doctrine = getModeDoctrine(mode);
  const overlay = resolveModeOverlay(card, mode);
  const effectiveTargeting = getEffectiveTargetingForMode(card, mode);
  const effectiveDivergence = getEffectiveDivergencePotentialForMode(card, mode);
  const effectiveCost = getEffectiveCostForMode(card, mode);
  const tagBreakdown = scoreTagsForMode(card, mode);
  const timingBreakdown = scoreTimingsForMode(card, mode);
  const overlayBreakdown = scoreOverlayForMode(card, mode);
  const effectBreakdown = scoreEffectPayloadForMode(card.baseEffect, mode);

  const legalityScore = overlay.legal && card.modeLegal.includes(mode)
    ? 0
    : -tuning.legalityPenalty;

  const rarityScore = getModeRarityWeight(mode, card.rarity) * tuning.rarityFactor;
  const deckPriorityRank = getModeDeckPriority(mode, card.deckType);
  const deckPriorityScore = ((200 - deckPriorityRank) / 10) * tuning.deckPriorityFactor;
  const deckFamilyScore = getDeckFamilyWeight(mode, card.deckType) * tuning.deckFamilyFactor;
  const tagScore = tagBreakdown.total * tuning.tagFactor;
  const timingScore = timingBreakdown.total * tuning.timingFactor;
  const targetingScore = getModeTargetingWeight(mode, effectiveTargeting) * tuning.targetingFactor;
  const counterabilityScore =
    getModeCounterabilityWeight(mode, card.counterability) * tuning.counterabilityFactor;
  const overlayScore = overlayBreakdown.total * tuning.overlayFactor;
  const divergencePotentialScore =
    getModeDivergenceWeight(mode, effectiveDivergence) * tuning.divergenceFactor;
  const effectScore = effectBreakdown.total * tuning.effectFactor;
  const autoResolveScore = card.autoResolve
    ? tuning.autoResolveFactor * (doctrine.prefersAutoResolve ? 1 : 0.65)
    : 0;
  const costPenalty = effectiveCost / tuning.costPenaltyDivisor;
  const decayPenalty = card.decayTicks === null
    ? 0
    : (9 - clamp(card.decayTicks, 0, 9)) * 0.15 * tuning.decayPenaltyFactor;

  let modeBonus = 0;
  let modePenalty = 0;

  if (isPrimaryDeckForMode(mode, card.deckType)) {
    modeBonus += tuning.premiumDeckBonus;
  }

  if (isSuppressedDeckForMode(mode, card.deckType)) {
    modePenalty += tuning.suppressedDeckPenalty;
  }

  if (isPreferredTargetingForMode(mode, effectiveTargeting)) {
    modeBonus += 2.25;
  }

  if (isPreferredCounterabilityForMode(mode, card.counterability)) {
    modeBonus += 1.75;
  }

  if (isPreferredDivergencePotentialForMode(mode, effectiveDivergence)) {
    modeBonus += 1.85;
  }

  if (effectiveCost <= tuning.lowCostBonusThreshold && doctrine.lowCostBias) {
    modeBonus += tuning.lowCostBonus;
  }

  if (effectiveCost >= tuning.highCostPenaltyThreshold && doctrine.highCostTolerance < 0.8) {
    modePenalty += tuning.highCostPenalty;
  }

  if (card.decayTicks === null && doctrine.prefersPersistence) {
    modeBonus += 1.5;
  }

  if ((card.decisionTimerOverrideMs ?? 0) > 0) {
    const timer = card.decisionTimerOverrideMs ?? 0;

    if (mode === 'pvp' && timer <= 4000) {
      modeBonus += 2.2;
    } else if (mode === 'solo' && timer >= 4500) {
      modeBonus += 1.6;
    } else if (mode === 'ghost' && timer <= 3500) {
      modeBonus += 2.4;
    } else if (mode === 'coop' && timer <= 4000) {
      modeBonus += 1.8;
    }
  }

  const finalScore =
    legalityScore +
    rarityScore +
    deckPriorityScore +
    deckFamilyScore +
    tagScore +
    timingScore +
    targetingScore +
    counterabilityScore +
    overlayScore +
    divergencePotentialScore +
    effectScore +
    autoResolveScore +
    modeBonus -
    costPenalty -
    decayPenalty -
    modePenalty;

  return Object.freeze({
    definitionId: card.id,
    mode,
    finalScore: round4(finalScore),
    legalityScore: round4(legalityScore),
    rarityScore: round4(rarityScore),
    deckPriorityScore: round4(deckPriorityScore),
    deckFamilyScore: round4(deckFamilyScore),
    tagScore: round4(tagScore),
    timingScore: round4(timingScore),
    targetingScore: round4(targetingScore),
    counterabilityScore: round4(counterabilityScore),
    overlayScore: round4(overlayScore),
    divergencePotentialScore: round4(divergencePotentialScore),
    effectScore: round4(effectScore),
    autoResolveScore: round4(autoResolveScore),
    costPenalty: round4(costPenalty),
    decayPenalty: round4(decayPenalty),
    modeBonus: round4(modeBonus),
    modePenalty: round4(modePenalty),
    effectBreakdown,
    tagBreakdown,
    timingBreakdown,
    overlayBreakdown,
  });
}

export function scoreCardForMode(
  card: CardDefinition,
  mode: ModeCode,
): number {
  return explainCardScoreForMode(card, mode).finalScore;
}

export function compareCardsForMode(
  left: CardDefinition,
  right: CardDefinition,
  mode: ModeCode,
): number {
  const leftPriority = getModeDeckPriority(mode, left.deckType);
  const rightPriority = getModeDeckPriority(mode, right.deckType);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftScore = scoreCardForMode(left, mode);
  const rightScore = scoreCardForMode(right, mode);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  const leftCost = getEffectiveCostForMode(left, mode);
  const rightCost = getEffectiveCostForMode(right, mode);

  if (leftCost !== rightCost) {
    return leftCost - rightCost;
  }

  const leftRarity = getModeRarityWeight(mode, left.rarity);
  const rightRarity = getModeRarityWeight(mode, right.rarity);

  if (leftRarity !== rightRarity) {
    return rightRarity - leftRarity;
  }

  return left.id.localeCompare(right.id);
}

export function rankCardsForMode(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly RankedCardResult[] {
  return freezeArray(
    [...cards]
      .map((definition) => ({
        definition,
        breakdown: explainCardScoreForMode(definition, mode),
      }))
      .sort((left, right) => {
        if (left.breakdown.finalScore !== right.breakdown.finalScore) {
          return right.breakdown.finalScore - left.breakdown.finalScore;
        }

        return compareCardsForMode(left.definition, right.definition, mode);
      }),
  );
}

export function summarizeDeckTypesForMode(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): ModeDeckTypeSummary {
  const counts = buildEmptyDeckTypeRecord(0);
  const weighted = buildEmptyDeckTypeRecord(0);
  const ranked = rankCardsForMode(cards, mode);
  let totalScore = 0;

  for (const row of ranked) {
    counts[row.definition.deckType] += 1;
    weighted[row.definition.deckType] = round4(
      weighted[row.definition.deckType] + row.breakdown.finalScore,
    );
    totalScore += row.breakdown.finalScore;
  }

  return Object.freeze({
    mode,
    totalCards: cards.length,
    weightedAverageScore: round4(cards.length === 0 ? 0 : totalScore / cards.length),
    byDeckType: Object.freeze(counts),
    weightedByDeckType: Object.freeze(weighted),
    highestScoringCardIds: freezeArray(ranked.slice(0, 10).map((row) => row.definition.id)),
  });
}

export function summarizeTagsForMode(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): ModeTagSummary {
  const counts = buildEmptyTagRecord(0);
  const weighted = buildEmptyTagRecord(0);

  for (const card of cards) {
    const breakdown = explainCardScoreForMode(card, mode);
    const tags = getKnownTagsForCard(card);

    for (const tag of tags) {
      counts[tag] += 1;
      weighted[tag] = round4(weighted[tag] + breakdown.tagBreakdown.contributions[tag]);
    }
  }

  const strongestTags = freezeArray(
    [...ALL_CARD_TAGS]
      .sort((left, right) => weighted[right] - weighted[left] || counts[right] - counts[left])
      .slice(0, 5),
  );

  const weakestTags = freezeArray(
    [...ALL_CARD_TAGS]
      .sort((left, right) => counts[left] - counts[right] || weighted[left] - weighted[right])
      .slice(0, 5),
  );

  return Object.freeze({
    mode,
    byTag: Object.freeze(counts),
    weightedByTag: Object.freeze(weighted),
    strongestTags,
    weakestTags,
  });
}

export function diagnoseModeBalance(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): ModeBalanceDiagnostics {
  const doctrine = getModeDoctrine(mode);
  const presence = buildDeckPresence(cards);
  const premiumCoverage = buildTagPresence(cards);
  const reactionCoverage = buildTimingPresence(cards);
  const missingPrimaryDecks = doctrine.primaryDecks.filter((deckType) => presence[deckType] <= 0);
  const suppressedDeckLeakage = doctrine.suppressedDecks.filter((deckType) => presence[deckType] > 0);
  const premiumTagGaps = doctrine.premiumTags.filter((tag) => premiumCoverage[tag] <= 0);

  let extremeLowCostCards = 0;
  let extremeHighCostCards = 0;

  for (const card of cards) {
    const cost = getEffectiveCostForMode(card, mode);

    if (cost <= 500) {
      extremeLowCostCards += 1;
    }

    if (cost >= 10_000) {
      extremeHighCostCards += 1;
    }
  }

  return Object.freeze({
    mode,
    totalCards: cards.length,
    missingPrimaryDecks: uniqueDeckTypes(missingPrimaryDecks),
    suppressedDeckLeakage: uniqueDeckTypes(suppressedDeckLeakage),
    premiumTagCoverage: Object.freeze(premiumCoverage),
    premiumTagGaps: uniqueCardTags(premiumTagGaps),
    reactionCoverage: Object.freeze(
      Object.fromEntries(
        doctrine.reactionTimings.map((timing) => [timing, reactionCoverage[timing]]),
      ) as Record<TimingClass, number>,
    ),
    extremeLowCostCards,
    extremeHighCostCards,
  });
}

export function toModeCardAuditRow(
  card: CardDefinition,
  mode: ModeCode,
): ModeCardAuditRow {
  const breakdown = explainCardScoreForMode(card, mode);

  return Object.freeze({
    definitionId: card.id,
    name: card.name,
    deckType: card.deckType,
    mode,
    score: breakdown.finalScore,
    rarity: card.rarity,
    baseCost: round3(card.baseCost),
    effectiveCost: getEffectiveCostForMode(card, mode),
    targeting: getEffectiveTargetingForMode(card, mode),
    timings: getEffectiveTimingClassesForMode(card, mode),
    tags: freezeArray([...card.tags]),
    premiumTags: breakdown.tagBreakdown.matchedPremiumTags,
    cautionTags: breakdown.tagBreakdown.matchedCautionTags,
  });
}

export function toModeCardAuditTable(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly ModeCardAuditRow[] {
  return freezeArray(
    rankCardsForMode(cards, mode).map((row) => toModeCardAuditRow(row.definition, mode)),
  );
}

export function sortCardsForMode(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly CardDefinition[] {
  return freezeArray([...cards].sort((left, right) => compareCardsForMode(left, right, mode)));
}

export function bucketCardsByDeckType(
  cards: readonly CardDefinition[],
): Readonly<Record<DeckType, readonly CardDefinition[]>> {
  const working: Record<DeckType, CardDefinition[]> = {
    OPPORTUNITY: [],
    IPA: [],
    FUBAR: [],
    MISSED_OPPORTUNITY: [],
    PRIVILEGED: [],
    SO: [],
    SABOTAGE: [],
    COUNTER: [],
    AID: [],
    RESCUE: [],
    DISCIPLINE: [],
    TRUST: [],
    BLUFF: [],
    GHOST: [],
  };

  for (const card of cards) {
    working[card.deckType].push(card);
  }

  return Object.freeze({
    OPPORTUNITY: freezeArray(working.OPPORTUNITY),
    IPA: freezeArray(working.IPA),
    FUBAR: freezeArray(working.FUBAR),
    MISSED_OPPORTUNITY: freezeArray(working.MISSED_OPPORTUNITY),
    PRIVILEGED: freezeArray(working.PRIVILEGED),
    SO: freezeArray(working.SO),
    SABOTAGE: freezeArray(working.SABOTAGE),
    COUNTER: freezeArray(working.COUNTER),
    AID: freezeArray(working.AID),
    RESCUE: freezeArray(working.RESCUE),
    DISCIPLINE: freezeArray(working.DISCIPLINE),
    TRUST: freezeArray(working.TRUST),
    BLUFF: freezeArray(working.BLUFF),
    GHOST: freezeArray(working.GHOST),
  });
}

export function bucketCardsByKnownTag(
  cards: readonly CardDefinition[],
): Readonly<Record<CardTag, readonly CardDefinition[]>> {
  const working: Record<CardTag, CardDefinition[]> = {
    liquidity: [],
    income: [],
    resilience: [],
    scale: [],
    tempo: [],
    sabotage: [],
    counter: [],
    heat: [],
    trust: [],
    aid: [],
    divergence: [],
    precision: [],
    variance: [],
    cascade: [],
    momentum: [],
  };

  for (const card of cards) {
    for (const tag of getKnownTagsForCard(card)) {
      working[tag].push(card);
    }
  }

  return Object.freeze({
    liquidity: freezeArray(working.liquidity),
    income: freezeArray(working.income),
    resilience: freezeArray(working.resilience),
    scale: freezeArray(working.scale),
    tempo: freezeArray(working.tempo),
    sabotage: freezeArray(working.sabotage),
    counter: freezeArray(working.counter),
    heat: freezeArray(working.heat),
    trust: freezeArray(working.trust),
    aid: freezeArray(working.aid),
    divergence: freezeArray(working.divergence),
    precision: freezeArray(working.precision),
    variance: freezeArray(working.variance),
    cascade: freezeArray(working.cascade),
    momentum: freezeArray(working.momentum),
  });
}

export function listCardsMatchingPrimaryDoctrine(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly CardDefinition[] {
  const doctrine = getModeDoctrine(mode);

  return freezeArray(
    cards.filter((card) => doctrine.primaryDecks.includes(card.deckType)),
  );
}

export function listCardsMatchingReactionDoctrine(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly CardDefinition[] {
  const doctrine = getModeDoctrine(mode);

  return freezeArray(
    cards.filter((card) =>
      getEffectiveTimingClassesForMode(card, mode)
        .some((timing) => doctrine.reactionTimings.includes(timing)),
    ),
  );
}

export function listCardsWithPreferredTargeting(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly CardDefinition[] {
  return freezeArray(
    cards.filter((card) => isPreferredTargetingForMode(mode, getEffectiveTargetingForMode(card, mode))),
  );
}

export function listCardsWithPreferredDivergence(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly CardDefinition[] {
  return freezeArray(
    cards.filter((card) =>
      isPreferredDivergencePotentialForMode(mode, getEffectiveDivergencePotentialForMode(card, mode)),
    ),
  );
}

export function listCardsWithOverlayMutations(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): readonly CardDefinition[] {
  return freezeArray(
    cards.filter((card) => {
      const overlay = resolveModeOverlay(card, mode);

      return (
        overlay.costModifier !== 1 ||
        overlay.effectModifier !== 1 ||
        Object.keys(overlay.tagWeights).length > 0 ||
        overlay.timingLock.length > 0 ||
        overlay.targetingOverride !== undefined ||
        overlay.divergencePotential !== undefined ||
        overlay.legal === false
      );
    }),
  );
}

export function estimateModeScoreSpread(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
} {
  const scores = cards
    .map((card) => scoreCardForMode(card, mode))
    .sort((left, right) => left - right);

  if (scores.length === 0) {
    return Object.freeze({ min: 0, max: 0, mean: 0, median: 0 });
  }

  const min = scores[0];
  const max = scores[scores.length - 1];
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const middle = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 0
    ? (scores[middle - 1] + scores[middle]) / 2
    : scores[middle];

  return Object.freeze({
    min: round4(min),
    max: round4(max),
    mean: round4(mean),
    median: round4(median),
  });
}

export function mergeTagWeights(
  base: Readonly<Record<string, number>>,
  delta: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const merged: Record<string, number> = {};

  for (const [tag, weight] of Object.entries(base)) {
    merged[tag] = weight;
  }

  for (const [tag, weight] of Object.entries(delta)) {
    merged[tag] = (merged[tag] ?? 0) + weight;
  }

  return Object.freeze(merged);
}

export function normalizeTagWeights(
  weights: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const output: Record<string, number> = {};
  const values = Object.values(weights).filter((value) => isFiniteNumber(value));

  if (values.length === 0) {
    return Object.freeze(output);
  }

  const max = Math.max(...values);

  if (max <= 0) {
    for (const [tag, weight] of Object.entries(weights)) {
      output[tag] = round4(weight);
    }

    return Object.freeze(output);
  }

  for (const [tag, weight] of Object.entries(weights)) {
    output[tag] = round4(weight / max);
  }

  return Object.freeze(output);
}

export function buildModeWeightSurface(
  mode: ModeCode,
): {
  readonly tagWeights: Readonly<Record<string, number>>;
  readonly normalizedTagWeights: Readonly<Record<string, number>>;
  readonly deckPriorities: Readonly<Record<DeckType, number>>;
  readonly timingWeights: Readonly<Record<TimingClass, number>>;
  readonly targetingWeights: Readonly<Record<Targeting, number>>;
  readonly counterabilityWeights: Readonly<Record<Counterability, number>>;
  readonly divergenceWeights: Readonly<Record<DivergencePotential, number>>;
} {
  return Object.freeze({
    tagWeights: MODE_TAG_WEIGHTS[mode],
    normalizedTagWeights: normalizeTagWeights(MODE_TAG_WEIGHTS[mode]),
    deckPriorities: MODE_DECK_PRIORITIES[mode],
    timingWeights: MODE_TIMING_WEIGHTS[mode],
    targetingWeights: MODE_TARGETING_WEIGHTS[mode],
    counterabilityWeights: MODE_COUNTERABILITY_WEIGHTS[mode],
    divergenceWeights: MODE_DIVERGENCE_WEIGHTS[mode],
  });
}

export function assertDeckTypeKnown(deckType: DeckType): DeckType {
  if (!ALL_DECK_TYPES.includes(deckType)) {
    throw new Error(`Unknown deck type: ${deckType}`);
  }

  return deckType;
}

export function assertTimingKnown(timing: TimingClass): TimingClass {
  if (!ALL_TIMING_CLASSES.includes(timing)) {
    throw new Error(`Unknown timing class: ${timing}`);
  }

  return timing;
}

export function assertTargetingKnown(targeting: Targeting): Targeting {
  if (!ALL_TARGETING.includes(targeting)) {
    throw new Error(`Unknown targeting: ${targeting}`);
  }

  return targeting;
}

export function assertCounterabilityKnown(counterability: Counterability): Counterability {
  if (!ALL_COUNTERABILITIES.includes(counterability)) {
    throw new Error(`Unknown counterability: ${counterability}`);
  }

  return counterability;
}

export function assertDivergencePotentialKnown(
  divergencePotential: DivergencePotential,
): DivergencePotential {
  if (!ALL_DIVERGENCE_POTENTIALS.includes(divergencePotential)) {
    throw new Error(`Unknown divergence potential: ${divergencePotential}`);
  }

  return divergencePotential;
}

export function buildModeDoctrineDigest(mode: ModeCode): {
  readonly mode: ModeCode;
  readonly codename: string;
  readonly primaryDecks: readonly DeckType[];
  readonly suppressedDecks: readonly DeckType[];
  readonly premiumTags: readonly CardTag[];
  readonly reactionTimings: readonly TimingClass[];
  readonly preferredTargeting: readonly Targeting[];
} {
  const doctrine = getModeDoctrine(mode);

  return Object.freeze({
    mode,
    codename: doctrine.codename,
    primaryDecks: doctrine.primaryDecks,
    suppressedDecks: doctrine.suppressedDecks,
    premiumTags: doctrine.premiumTags,
    reactionTimings: doctrine.reactionTimings,
    preferredTargeting: doctrine.preferredTargeting,
  });
}

export function scoreCardsToMap(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): Readonly<Record<string, number>> {
  const output: Record<string, number> = {};

  for (const card of cards) {
    output[card.id] = scoreCardForMode(card, mode);
  }

  return Object.freeze(output);
}

export function explainCardsToMap(
  cards: readonly CardDefinition[],
  mode: ModeCode,
): Readonly<Record<string, ModeCardScoreBreakdown>> {
  const output: Record<string, ModeCardScoreBreakdown> = {};

  for (const card of cards) {
    output[card.id] = explainCardScoreForMode(card, mode);
  }

  return Object.freeze(output);
}
