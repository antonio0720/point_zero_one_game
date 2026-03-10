/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/types.ts
 *
 * Doctrine:
 * - card weighting metadata lives here, not inside callers
 * - all mode scoring helpers must be deterministic
 * - ordering rules should be explicit, inspectable, and backend-safe
 * - exports remain additive so existing imports of MODE_TAG_WEIGHTS keep working
 */

import type {
  CardDefinition,
  CardRarity,
  DeckType,
  ModeCode,
} from '../core/GamePrimitives';

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

export const MODE_TAG_WEIGHTS: Readonly<
  Record<ModeCode, Readonly<Record<string, number>>>
> = Object.freeze({
  solo: Object.freeze({
    liquidity: 2.0,
    income: 2.2,
    resilience: 1.8,
    scale: 2.5,
    tempo: 1.0,
    sabotage: 0.0,
    counter: 0.0,
    heat: 0.6,
    trust: 0.0,
    aid: 0.0,
    divergence: 0.4,
    precision: 0.9,
    variance: 0.6,
    cascade: 1.1,
    momentum: 1.6,
  }),
  pvp: Object.freeze({
    liquidity: 0.8,
    income: 0.6,
    resilience: 1.0,
    scale: 0.5,
    tempo: 2.4,
    sabotage: 2.8,
    counter: 2.2,
    heat: 1.5,
    trust: 0.0,
    aid: 0.0,
    divergence: 0.3,
    precision: 1.2,
    variance: 1.8,
    cascade: 1.7,
    momentum: 2.0,
  }),
  coop: Object.freeze({
    liquidity: 1.5,
    income: 1.8,
    resilience: 2.0,
    scale: 1.3,
    tempo: 1.0,
    sabotage: 0.2,
    counter: 0.5,
    heat: 0.8,
    trust: 3.0,
    aid: 3.0,
    divergence: 0.3,
    precision: 0.8,
    variance: 0.5,
    cascade: 1.0,
    momentum: 1.1,
  }),
  ghost: Object.freeze({
    liquidity: 1.2,
    income: 1.0,
    resilience: 1.4,
    scale: 0.9,
    tempo: 1.8,
    sabotage: 0.0,
    counter: 0.0,
    heat: 1.0,
    trust: 0.0,
    aid: 0.0,
    divergence: 3.0,
    precision: 2.5,
    variance: 1.9,
    cascade: 0.9,
    momentum: 1.4,
  }),
});

export const RARITY_WEIGHTS: Readonly<Record<CardRarity, number>> =
  Object.freeze({
    COMMON: 1,
    UNCOMMON: 2,
    RARE: 3,
    LEGENDARY: 4,
  });

export const MODE_DECK_PRIORITIES: Readonly<
  Record<ModeCode, Readonly<Record<DeckType, number>>>
> = Object.freeze({
  solo: Object.freeze({
    OPPORTUNITY: 10,
    PRIVILEGED: 20,
    DISCIPLINE: 30,
    SO: 40,
    COUNTER: 50,
    AID: 60,
    RESCUE: 70,
    TRUST: 80,
    BLUFF: 90,
    SABOTAGE: 100,
    GHOST: 110,
    IPA: 120,
    FUBAR: 130,
    MISSED_OPPORTUNITY: 140,
  }),
  pvp: Object.freeze({
    SABOTAGE: 10,
    COUNTER: 20,
    PRIVILEGED: 30,
    DISCIPLINE: 40,
    SO: 50,
    BLUFF: 60,
    OPPORTUNITY: 70,
    TRUST: 80,
    AID: 90,
    RESCUE: 100,
    GHOST: 110,
    IPA: 120,
    FUBAR: 130,
    MISSED_OPPORTUNITY: 140,
  }),
  coop: Object.freeze({
    AID: 10,
    RESCUE: 20,
    TRUST: 30,
    PRIVILEGED: 40,
    DISCIPLINE: 50,
    SO: 60,
    OPPORTUNITY: 70,
    COUNTER: 80,
    BLUFF: 90,
    SABOTAGE: 100,
    GHOST: 110,
    IPA: 120,
    FUBAR: 130,
    MISSED_OPPORTUNITY: 140,
  }),
  ghost: Object.freeze({
    GHOST: 10,
    DISCIPLINE: 20,
    PRIVILEGED: 30,
    SO: 40,
    OPPORTUNITY: 50,
    COUNTER: 60,
    BLUFF: 70,
    TRUST: 80,
    AID: 90,
    RESCUE: 100,
    SABOTAGE: 110,
    IPA: 120,
    FUBAR: 130,
    MISSED_OPPORTUNITY: 140,
  }),
});

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
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

export function scoreCardForMode(
  card: CardDefinition,
  mode: ModeCode,
): number {
  let score = 0;

  score += RARITY_WEIGHTS[card.rarity] * 100;

  for (const tag of card.tags) {
    score += getModeTagWeight(mode, tag) * 10;
  }

  if (card.autoResolve) {
    score += 8;
  }

  if (card.counterability === 'HARD') {
    score += 10;
  } else if (card.counterability === 'SOFT') {
    score += 4;
  }

  if ((card.baseEffect.divergenceDelta ?? 0) > 0) {
    score += (card.baseEffect.divergenceDelta ?? 0) * 100;
  }

  if ((card.baseEffect.timeDeltaMs ?? 0) > 0) {
    score += Math.min(12, (card.baseEffect.timeDeltaMs ?? 0) / 15_000);
  }

  if (card.baseEffect.cascadeTag) {
    score += 6;
  }

  if ((card.baseEffect.injectCards?.length ?? 0) > 0) {
    score += card.baseEffect.injectCards!.length * 2;
  }

  if ((card.decisionTimerOverrideMs ?? 0) > 0) {
    score += 2;
  }

  score -= card.baseCost / 1_000;

  return round4(score);
}