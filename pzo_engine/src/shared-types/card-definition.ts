// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD DEFINITION CONTRACT
// pzo_engine/src/shared-types/card-definition.ts
//
// Mirrors pzo-web/src/engines/cards/types.ts exactly for the types consumed
// by pzo_engine's card layer. Kept in sync manually.
//
// WHY IT EXISTS HERE:
//   pzo_engine cannot import from pzo-web at runtime.
//   This file reproduces the enums and interfaces the card catalog needs.
//   Any change to pzo-web/engines/cards/types.ts must be reflected here.
//
// WHAT IS EXCLUDED (pzo_engine doesn't need these):
//   - DecisionWindow, CardPlayRequest, CardEffectResult (execution-layer types)
//   - CardEventName, CardEventPayloadMap (EventBus types — pzo-web only)
//   - TIMING_CLASS_WINDOW_MS (execution timing — not needed for data layer)
//
// RULES:
//   ✦ Zero imports.
//   ✦ Enum values MUST match pzo-web exactly — they are serialized in proof hashes.
//
// Density6 LLC · Point Zero One · Shared Types · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

export enum GameMode {
  GO_ALONE       = 'GO_ALONE',
  HEAD_TO_HEAD   = 'HEAD_TO_HEAD',
  TEAM_UP        = 'TEAM_UP',
  CHASE_A_LEGEND = 'CHASE_A_LEGEND',
}

export enum TimingClass {
  IMMEDIATE            = 'IMMEDIATE',
  REACTIVE             = 'REACTIVE',
  STANDARD             = 'STANDARD',
  HOLD                 = 'HOLD',
  COUNTER_WINDOW       = 'COUNTER_WINDOW',
  RESCUE_WINDOW        = 'RESCUE_WINDOW',
  PHASE_BOUNDARY       = 'PHASE_BOUNDARY',
  FORCED               = 'FORCED',
  LEGENDARY            = 'LEGENDARY',
  BLUFF                = 'BLUFF',
  DEFECTION_STEP       = 'DEFECTION_STEP',
  SOVEREIGNTY_DECISION = 'SOVEREIGNTY_DECISION',
}

export enum BaseDeckType {
  OPPORTUNITY    = 'OPPORTUNITY',
  IPA            = 'IPA',
  FUBAR          = 'FUBAR',
  PRIVILEGED     = 'PRIVILEGED',
  SO             = 'SO',
  PHASE_BOUNDARY = 'PHASE_BOUNDARY',
}

export enum ModeDeckType {
  SABOTAGE   = 'SABOTAGE',
  COUNTER    = 'COUNTER',
  BLUFF      = 'BLUFF',
  AID        = 'AID',
  RESCUE     = 'RESCUE',
  TRUST      = 'TRUST',
  DEFECTION  = 'DEFECTION',
  GHOST      = 'GHOST',
  DISCIPLINE = 'DISCIPLINE',
}

export type DeckType = BaseDeckType | ModeDeckType;

export enum CardTag {
  LIQUIDITY    = 'liquidity',
  INCOME       = 'income',
  COMPOUNDING  = 'compounding',
  RESILIENCE   = 'resilience',
  AUTOMATION   = 'automation',
  TEMPO        = 'tempo',
  LEVERAGE     = 'leverage',
  SABOTAGE     = 'sabotage',
  COUNTER      = 'counter',
  TRUST        = 'trust',
  PRECISION    = 'precision',
  VARIANCE_RED = 'variance_reduction',
  CAPITAL_ALLOC  = 'capital_allocation',
  COMBAT         = 'combat',
  COOPERATIVE    = 'cooperative',
  DETERMINISTIC  = 'deterministic',
  LEGENDARY_TAG  = 'legendary',
  PRIVILEGED_TAG = 'privileged',
  REAL_WORLD_FINANCE = 'real_world_finance',
}

export enum Targeting {
  SELF      = 'SELF',
  OPPONENT  = 'OPPONENT',
  TEAMMATE  = 'TEAMMATE',
  TEAM_ALL  = 'TEAM_ALL',
  GHOST_REF = 'GHOST_REF',
  ENGINE    = 'ENGINE',
}

export enum CardRarity {
  COMMON    = 'COMMON',
  UNCOMMON  = 'UNCOMMON',
  RARE      = 'RARE',
  EPIC      = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export enum CardEffectType {
  INCOME_BOOST         = 'INCOME_BOOST',
  INCOME_REDUCTION     = 'INCOME_REDUCTION',
  EXPENSE_REDUCTION    = 'EXPENSE_REDUCTION',
  EXPENSE_SPIKE        = 'EXPENSE_SPIKE',
  SHIELD_REPAIR        = 'SHIELD_REPAIR',
  SHIELD_FORTIFY       = 'SHIELD_FORTIFY',
  HATER_HEAT_REDUCE    = 'HATER_HEAT_REDUCE',
  HATER_HEAT_SPIKE     = 'HATER_HEAT_SPIKE',
  BOT_NEUTRALIZE       = 'BOT_NEUTRALIZE',
  CASCADE_INTERRUPT    = 'CASCADE_INTERRUPT',
  CASCADE_ACCELERATE   = 'CASCADE_ACCELERATE',
  BATTLE_BUDGET_GRANT  = 'BATTLE_BUDGET_GRANT',
  BATTLE_BUDGET_DRAIN  = 'BATTLE_BUDGET_DRAIN',
  TRUST_SCORE_BOOST    = 'TRUST_SCORE_BOOST',
  TRUST_SCORE_DRAIN    = 'TRUST_SCORE_DRAIN',
  TREASURY_INJECT      = 'TREASURY_INJECT',
  TREASURY_DRAIN       = 'TREASURY_DRAIN',
  DIVERGENCE_REDUCE    = 'DIVERGENCE_REDUCE',
  VARIANCE_LOCK        = 'VARIANCE_LOCK',
  EXTRACTION_FIRE      = 'EXTRACTION_FIRE',
  EXTRACTION_BLOCK     = 'EXTRACTION_BLOCK',
  BLUFF_DISPLAY        = 'BLUFF_DISPLAY',
  PROOF_BADGE_UNLOCK   = 'PROOF_BADGE_UNLOCK',
  CORD_BONUS_FLAT      = 'CORD_BONUS_FLAT',
  HOLD_STAGE           = 'HOLD_STAGE',
  NO_OP                = 'NO_OP',
}

export interface CardBaseEffect {
  effectType:  CardEffectType;
  magnitude:   number;
  duration?:   number;
  secondary?:  CardBaseEffect;
  conditions?: string[];
}

export interface CardDefinition {
  readonly cardId:          string;
  readonly name:            string;
  readonly deckType:        DeckType;
  readonly rarity:          CardRarity;
  readonly timingClass:     TimingClass;
  readonly base_cost:       number;
  readonly base_effect:     CardBaseEffect;
  readonly tags:            CardTag[];
  readonly targeting:       Targeting;
  readonly educational_tag: string;
  readonly lore:            string;
  readonly modes_legal:     GameMode[];
  readonly is_forced:       boolean;
  readonly drop_weight:     number;
}

export const LEGENDARY_DROP_WEIGHT = 1;

export const CARD_LEGALITY_MATRIX: Record<GameMode, DeckType[]> = {
  [GameMode.GO_ALONE]: [
    BaseDeckType.OPPORTUNITY, BaseDeckType.IPA, BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED, BaseDeckType.SO, BaseDeckType.PHASE_BOUNDARY,
  ],
  [GameMode.HEAD_TO_HEAD]: [
    BaseDeckType.OPPORTUNITY, BaseDeckType.IPA, BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED, BaseDeckType.SO,
    ModeDeckType.SABOTAGE, ModeDeckType.COUNTER, ModeDeckType.BLUFF,
  ],
  [GameMode.TEAM_UP]: [
    BaseDeckType.OPPORTUNITY, BaseDeckType.IPA, BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED, BaseDeckType.SO,
    ModeDeckType.AID, ModeDeckType.RESCUE, ModeDeckType.TRUST, ModeDeckType.DEFECTION,
  ],
  [GameMode.CHASE_A_LEGEND]: [
    BaseDeckType.OPPORTUNITY, BaseDeckType.IPA, BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED, BaseDeckType.SO,
    ModeDeckType.GHOST, ModeDeckType.DISCIPLINE,
  ],
};