/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardRegistry.ts
 *
 * Doctrine:
 * - registry is a backend-owned canonical card catalog
 * - card definitions must be immutable after boot
 * - lookup paths should be O(1) or close to it under load
 * - validation happens once during construction, not on every read
 */

import { deepFrozenClone } from '../core/Deterministic';
import type {
  CardDefinition,
  DeckType,
  EffectPayload,
  ModeCode,
  TimingClass,
} from '../core/GamePrimitives';

const NUMERIC_EFFECT_KEYS: readonly (keyof EffectPayload)[] = [
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
] as const;

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return output;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export class CardRegistry {
  private readonly cards = new Map<string, CardDefinition>();

  private readonly orderedCards: readonly CardDefinition[];

  private readonly modeIndex = new Map<ModeCode, readonly CardDefinition[]>();

  private readonly deckIndex = new Map<DeckType, readonly CardDefinition[]>();

  private readonly timingIndex = new Map<TimingClass, readonly CardDefinition[]>();

  public constructor() {
    const seeded = this.seed().map((card) => this.finalizeCard(card));

    for (const card of seeded) {
      this.assertValid(card);

      if (this.cards.has(card.id)) {
        throw new Error(`Duplicate card definition id: ${card.id}`);
      }

      this.cards.set(card.id, card);
    }

    this.orderedCards = freezeArray(seeded);
    this.buildIndexes(seeded);
  }

  public get(id: string): CardDefinition | undefined {
    return this.cards.get(id);
  }

  public require(id: string): CardDefinition {
    const card = this.cards.get(id);

    if (!card) {
      throw new Error(`Unknown card definition: ${id}`);
    }

    return card;
  }

  public all(): readonly CardDefinition[] {
    return this.orderedCards;
  }

  public listByMode(mode: ModeCode): readonly CardDefinition[] {
    return this.modeIndex.get(mode) ?? Object.freeze([]);
  }

  public listByDeckType(deckType: DeckType): readonly CardDefinition[] {
    return this.deckIndex.get(deckType) ?? Object.freeze([]);
  }

  public listByTimingClass(timing: TimingClass): readonly CardDefinition[] {
    return this.timingIndex.get(timing) ?? Object.freeze([]);
  }

  private buildIndexes(cards: readonly CardDefinition[]): void {
    const modeBuckets = new Map<ModeCode, CardDefinition[]>();
    const deckBuckets = new Map<DeckType, CardDefinition[]>();
    const timingBuckets = new Map<TimingClass, CardDefinition[]>();

    for (const card of cards) {
      for (const mode of card.modeLegal) {
        const bucket = modeBuckets.get(mode) ?? [];
        bucket.push(card);
        modeBuckets.set(mode, bucket);
      }

      {
        const bucket = deckBuckets.get(card.deckType) ?? [];
        bucket.push(card);
        deckBuckets.set(card.deckType, bucket);
      }

      for (const timing of card.timingClass) {
        const bucket = timingBuckets.get(timing) ?? [];
        bucket.push(card);
        timingBuckets.set(timing, bucket);
      }
    }

    for (const [mode, bucket] of modeBuckets.entries()) {
      this.modeIndex.set(mode, freezeArray(bucket));
    }

    for (const [deck, bucket] of deckBuckets.entries()) {
      this.deckIndex.set(deck, freezeArray(bucket));
    }

    for (const [timing, bucket] of timingBuckets.entries()) {
      this.timingIndex.set(timing, freezeArray(bucket));
    }
  }

  private finalizeCard(card: CardDefinition): CardDefinition {
    const normalized: CardDefinition = {
      ...card,
      tags: uniqueStrings(card.tags),
      timingClass: [...new Set(card.timingClass)],
      modeLegal: [...new Set(card.modeLegal)],
      modeOverlay: card.modeOverlay
        ? {
            ...card.modeOverlay,
          }
        : undefined,
    };

    return deepFrozenClone(normalized);
  }

  private assertValid(card: CardDefinition): void {
    if (card.id.trim().length === 0) {
      throw new Error('Card id cannot be empty.');
    }

    if (card.name.trim().length === 0) {
      throw new Error(`Card ${card.id} has an empty name.`);
    }

    if (!isFiniteNumber(card.baseCost) || card.baseCost < 0) {
      throw new Error(`Card ${card.id} has invalid baseCost.`);
    }

    if (card.tags.length === 0) {
      throw new Error(`Card ${card.id} must have at least one tag.`);
    }

    if (card.timingClass.length === 0) {
      throw new Error(`Card ${card.id} must have at least one timing class.`);
    }

    if (card.modeLegal.length === 0) {
      throw new Error(`Card ${card.id} must be legal in at least one mode.`);
    }

    for (const key of NUMERIC_EFFECT_KEYS) {
      const value = card.baseEffect[key];
      if (value !== undefined && !isFiniteNumber(value)) {
        throw new Error(
          `Card ${card.id} has non-finite numeric effect value for ${String(key)}.`,
        );
      }
    }

    if (
      card.baseEffect.injectCards &&
      !Array.isArray(card.baseEffect.injectCards)
    ) {
      throw new Error(`Card ${card.id} has invalid injectCards.`);
    }

    if (
      card.baseEffect.exhaustCards &&
      !Array.isArray(card.baseEffect.exhaustCards)
    ) {
      throw new Error(`Card ${card.id} has invalid exhaustCards.`);
    }

    if (
      card.baseEffect.grantBadges &&
      !Array.isArray(card.baseEffect.grantBadges)
    ) {
      throw new Error(`Card ${card.id} has invalid grantBadges.`);
    }

    if (card.modeOverlay) {
      for (const [mode, overlay] of Object.entries(card.modeOverlay)) {
        if (!overlay) {
          continue;
        }

        if (
          overlay.costModifier !== undefined &&
          (!isFiniteNumber(overlay.costModifier) || overlay.costModifier < 0)
        ) {
          throw new Error(
            `Card ${card.id} has invalid costModifier for mode ${mode}.`,
          );
        }

        if (
          overlay.effectModifier !== undefined &&
          (!isFiniteNumber(overlay.effectModifier) || overlay.effectModifier < 0)
        ) {
          throw new Error(
            `Card ${card.id} has invalid effectModifier for mode ${mode}.`,
          );
        }

        if (overlay.tagWeights) {
          for (const [tag, weight] of Object.entries(overlay.tagWeights)) {
            if (!isFiniteNumber(weight) || weight < 0) {
              throw new Error(
                `Card ${card.id} has invalid tag weight for tag ${tag} in mode ${mode}.`,
              );
            }
          }
        }
      }
    }
  }

  private seed(): CardDefinition[] {
    return [
      {
        id: 'NETWORK_CALL',
        name: 'Network Call',
        deckType: 'PRIVILEGED',
        baseCost: 2000,
        baseEffect: { cashDelta: 0, incomeDelta: 350, heatDelta: 2 },
        tags: ['liquidity', 'scale', 'heat', 'income'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 6,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        modeOverlay: {
          solo: { costModifier: 1.0, effectModifier: 1.0, legal: true },
          pvp: { costModifier: 1.0, effectModifier: 0.8, legal: true },
          coop: { costModifier: 0.9, effectModifier: 1.1, legal: true },
          ghost: { costModifier: 1.1, effectModifier: 0.9, legal: true },
        },
        educationalTag: 'Your network is your net worth',
      },
      {
        id: 'MOMENTUM_PIVOT',
        name: 'Momentum Pivot',
        deckType: 'OPPORTUNITY',
        baseCost: 0,
        baseEffect: { incomeDelta: 450, cashDelta: 8000 },
        tags: ['income', 'liquidity', 'scale'],
        timingClass: ['PHZ'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5000,
        decayTicks: 5,
        modeLegal: ['solo'],
        educationalTag: 'Strategy must declare itself at the phase boundary',
      },
      {
        id: 'FORTIFY_ORDER',
        name: 'Fortify Order',
        deckType: 'SO',
        baseCost: 6000,
        baseEffect: { shieldDelta: 15 },
        tags: ['resilience', 'tempo'],
        timingClass: ['PHZ'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5000,
        decayTicks: 5,
        modeLegal: ['solo'],
        educationalTag: 'Fortification costs capital and timing',
      },
      {
        id: 'LAST_STAND_PROTOCOL',
        name: 'Last Stand Protocol',
        deckType: 'SO',
        baseCost: 0,
        baseEffect: { cashDelta: 3000, heatDelta: -5 },
        tags: ['liquidity', 'resilience', 'tempo'],
        timingClass: ['PHZ', 'PSK'],
        rarity: 'LEGENDARY',
        autoResolve: true,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 5,
        modeLegal: ['solo'],
        educationalTag: 'The comeback window is real but narrow',
      },
      {
        id: 'CHAIN_RUMOR',
        name: 'Chain Rumor',
        deckType: 'SABOTAGE',
        baseCost: 15,
        baseEffect: { incomeDelta: -250 },
        tags: ['sabotage', 'tempo', 'momentum'],
        timingClass: ['POST', 'ANY'],
        rarity: 'COMMON',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: null,
        decayTicks: 4,
        modeLegal: ['pvp'],
        educationalTag: 'Pressure compounds through repeated low-cost attacks',
      },
      {
        id: 'MEDIA_BLITZ',
        name: 'Media Blitz',
        deckType: 'SABOTAGE',
        baseCost: 35,
        baseEffect: { heatDelta: 3 },
        tags: ['sabotage', 'tempo', 'variance'],
        timingClass: ['ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: null,
        decayTicks: 3,
        modeLegal: ['pvp'],
        educationalTag: 'Groundwork multiplies the attack that follows',
      },
      {
        id: 'REGULATORY_FILING',
        name: 'Regulatory Filing',
        deckType: 'SABOTAGE',
        baseCost: 35,
        baseEffect: { heatDelta: 5 },
        tags: ['sabotage', 'tempo', 'cascade'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: null,
        decayTicks: 4,
        modeLegal: ['pvp'],
        educationalTag: 'Administrative friction is economic warfare',
      },
      {
        id: 'HOSTILE_TAKEOVER',
        name: 'Hostile Takeover',
        deckType: 'SABOTAGE',
        baseCost: 60,
        baseEffect: { incomeDelta: -500, heatDelta: 4 },
        tags: ['sabotage', 'tempo', 'variance', 'heat'],
        timingClass: ['PRE', 'PSK'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'HARD',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: 3000,
        decayTicks: 2,
        modeLegal: ['pvp'],
        educationalTag: 'Visible pressure is part of the attack',
      },
      {
        id: 'BREAK_PACT',
        name: 'Break Pact',
        deckType: 'TRUST',
        baseCost: 0,
        baseEffect: { trustDelta: -5 },
        tags: ['trust', 'tempo'],
        timingClass: ['ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 6,
        modeLegal: ['coop'],
        educationalTag: 'Defection begins before the public break',
      },
      {
        id: 'SILENT_EXIT',
        name: 'Silent Exit',
        deckType: 'TRUST',
        baseCost: 0,
        baseEffect: { trustDelta: -10 },
        tags: ['trust', 'tempo'],
        timingClass: ['ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 6,
        modeLegal: ['coop'],
        educationalTag: 'Defection becomes measurable before it becomes visible',
      },
      {
        id: 'ASSET_SEIZURE',
        name: 'Asset Seizure',
        deckType: 'TRUST',
        baseCost: 0,
        baseEffect: { trustDelta: -20, cashDelta: 0 },
        tags: ['trust', 'tempo', 'liquidity'],
        timingClass: ['ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'HARD',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 2,
        modeLegal: ['coop'],
        educationalTag: 'Betrayal has a sequence and a cost',
      },
      {
        id: 'MARKER_EXPLOIT',
        name: 'Marker Exploit',
        deckType: 'GHOST',
        baseCost: 0,
        baseEffect: { shieldDelta: 12, divergenceDelta: 0.06 },
        tags: ['divergence', 'precision', 'resilience'],
        timingClass: ['GBM'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4000,
        decayTicks: 3,
        modeLegal: ['ghost'],
        educationalTag: 'Exploit the record where excellence cracked',
      },
      {
        id: 'COUNTER_LEGEND_LINE',
        name: 'Counter-Legend Line',
        deckType: 'GHOST',
        baseCost: 3000,
        baseEffect: { incomeDelta: 400, divergenceDelta: 0.08 },
        tags: ['divergence', 'precision', 'variance', 'income'],
        timingClass: ['GBM', 'PRE'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 3,
        modeLegal: ['ghost'],
        educationalTag: 'The ghost cannot adapt. You can.',
      },
      {
        id: 'GHOST_PASS_EXPLOIT',
        name: 'Ghost Pass Exploit',
        deckType: 'GHOST',
        baseCost: 0,
        baseEffect: { incomeDelta: 150, divergenceDelta: 0.04 },
        tags: ['divergence', 'precision', 'income'],
        timingClass: ['GBM'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 2,
        modeLegal: ['ghost'],
        educationalTag: 'You possess the record. Use it.',
      },
      {
        id: 'VARIANCE_LOCK',
        name: 'Variance Lock',
        deckType: 'DISCIPLINE',
        baseCost: 1500,
        baseEffect: { shieldDelta: 4 },
        tags: ['precision', 'resilience', 'variance'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 8,
        modeLegal: ['solo', 'ghost'],
        educationalTag: 'Stability has a price',
      },
      {
        id: 'IRON_DISCIPLINE',
        name: 'Iron Discipline',
        deckType: 'DISCIPLINE',
        baseCost: 5000,
        baseEffect: { shieldDelta: 8 },
        tags: ['precision', 'resilience', 'variance'],
        timingClass: ['ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: null,
        modeLegal: ['solo', 'ghost'],
        educationalTag: 'Eliminate the worst outcome before chasing the best',
      },
      {
        id: 'SOVEREIGN_LEVERAGE',
        name: 'Sovereign Leverage',
        deckType: 'PRIVILEGED',
        baseCost: 0,
        baseEffect: { cashDelta: 6000, incomeDelta: 500 },
        tags: ['scale', 'liquidity', 'income'],
        timingClass: ['ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 2,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        educationalTag: 'Leverage is a tool, not a trait',
      },
      {
        id: 'SYSTEMIC_OVERRIDE',
        name: 'Systemic Override',
        deckType: 'PRIVILEGED',
        baseCost: 0,
        baseEffect: { heatDelta: -50 },
        tags: ['resilience', 'heat'],
        timingClass: ['ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'GLOBAL',
        decisionTimerOverrideMs: null,
        decayTicks: 1,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        educationalTag: 'A reset is not free, but it changes everything',
      },
      {
        id: 'CASCADE_BREAK',
        name: 'Cascade Break',
        deckType: 'SO',
        baseCost: 0,
        baseEffect: { cashDelta: 0 },
        tags: ['resilience', 'cascade'],
        timingClass: ['CAS', 'ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 2,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        educationalTag: 'Breaking the chain changes the future, not the past',
      },
      {
        id: 'TIME_DEBT_PAID',
        name: 'Time Debt Paid',
        deckType: 'PRIVILEGED',
        baseCost: 0,
        baseEffect: { timeDeltaMs: 90000 },
        tags: ['tempo', 'resilience'],
        timingClass: ['END', 'ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 1,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        educationalTag: 'Buying time is sometimes the trade',
      },
    ];
  }
}