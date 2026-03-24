
/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardRegistry.ts
 *
 * Doctrine:
 * - registry is a backend-owned canonical card catalog
 * - card definitions must be immutable after boot
 * - lookup paths should be O(1) or close to it under load
 * - validation happens once during construction, not on every read
 * - mode-native doctrine belongs in the registry seed, not scattered in callers
 * - shared deck, ghost replay, trust audit, and proof consumers all depend on stable ordering
 */

import { deepFrozenClone } from '../core/Deterministic';
import type {
  CardDefinition,
  CardRarity,
  Counterability,
  DeckType,
  EffectPayload,
  ModeCode,
  ModeOverlay,
  ModeOverlayMap,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import {
  MODE_DECK_PRIORITIES,
  MODE_TAG_WEIGHTS,
} from './types';

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

const ALL_MODES: readonly ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'] as const;

const ALL_TIMING_CLASSES: readonly TimingClass[] = [
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
] as const;

const ALL_DECK_TYPES: readonly DeckType[] = [
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
] as const;

const ALL_RARITIES: readonly CardRarity[] = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'LEGENDARY',
] as const;

const ALL_TARGETING: readonly Targeting[] = [
  'SELF',
  'OPPONENT',
  'TEAMMATE',
  'TEAM',
  'GLOBAL',
] as const;

const ALL_COUNTERABILITIES: readonly Counterability[] = [
  'NONE',
  'SOFT',
  'HARD',
] as const;

const EMPTY_CARD_ARRAY: readonly CardDefinition[] = Object.freeze([]);

const DEFAULT_MODE_OVERLAY: Readonly<ModeOverlay> = Object.freeze({
  costModifier: 1,
  effectModifier: 1,
  tagWeights: Object.freeze({}),
  timingLock: Object.freeze([]),
  legal: true,
});

const RARITY_ORDER: Readonly<Record<CardRarity, number>> = Object.freeze({
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  LEGENDARY: 4,
});

type CardBucketIndex<K extends string> = Map<K, readonly CardDefinition[]>;

export interface CardQuery {
  readonly mode?: ModeCode;
  readonly deckType?: DeckType;
  readonly timingClass?: TimingClass;
  readonly rarity?: CardRarity;
  readonly targeting?: Targeting;
  readonly counterability?: Counterability;
  readonly autoResolve?: boolean;
  readonly decayableOnly?: boolean;
  readonly tagsAll?: readonly string[];
  readonly tagsAny?: readonly string[];
  readonly text?: string;
  readonly educationalTag?: string;
}

export interface ModeCatalogSummary {
  readonly mode: ModeCode;
  readonly totalCards: number;
  readonly byDeckType: Readonly<Record<DeckType, number>>;
  readonly legendaryCount: number;
  readonly autoResolveCount: number;
  readonly reactionWindowCount: number;
  readonly phaseBoundaryCount: number;
  readonly ghostWindowCount: number;
}

export interface RegistryDiagnostics {
  readonly totalCards: number;
  readonly byMode: Readonly<Record<ModeCode, number>>;
  readonly byDeckType: Readonly<Record<DeckType, number>>;
  readonly byRarity: Readonly<Record<CardRarity, number>>;
  readonly timingCoverage: Readonly<Record<TimingClass, number>>;
  readonly sharedAcrossAllModes: readonly string[];
  readonly modeExclusiveIds: Readonly<Record<ModeCode, readonly string[]>>;
}

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

function uniqueTiming(values: readonly TimingClass[]): TimingClass[] {
  const seen = new Set<TimingClass>();
  const output: TimingClass[] = [];

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

function isModeCode(value: string): value is ModeCode {
  return (ALL_MODES as readonly string[]).includes(value);
}

function isTimingClass(value: string): value is TimingClass {
  return (ALL_TIMING_CLASSES as readonly string[]).includes(value);
}

function isDeckType(value: string): value is DeckType {
  return (ALL_DECK_TYPES as readonly string[]).includes(value);
}

function isRarity(value: string): value is CardRarity {
  return (ALL_RARITIES as readonly string[]).includes(value);
}

function isTargeting(value: string): value is Targeting {
  return (ALL_TARGETING as readonly string[]).includes(value);
}

function isCounterability(value: string): value is Counterability {
  return (ALL_COUNTERABILITIES as readonly string[]).includes(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function buildEmptyDeckCountRecord(): Record<DeckType, number> {
  return {
    OPPORTUNITY: 0,
    IPA: 0,
    FUBAR: 0,
    MISSED_OPPORTUNITY: 0,
    PRIVILEGED: 0,
    SO: 0,
    SABOTAGE: 0,
    COUNTER: 0,
    AID: 0,
    RESCUE: 0,
    DISCIPLINE: 0,
    TRUST: 0,
    BLUFF: 0,
    GHOST: 0,
  };
}

function buildEmptyModeCountRecord(): Record<ModeCode, number> {
  return {
    solo: 0,
    pvp: 0,
    coop: 0,
    ghost: 0,
  };
}

function buildEmptyRarityCountRecord(): Record<CardRarity, number> {
  return {
    COMMON: 0,
    UNCOMMON: 0,
    RARE: 0,
    LEGENDARY: 0,
  };
}

function buildEmptyTimingCountRecord(): Record<TimingClass, number> {
  return {
    PRE: 0,
    POST: 0,
    FATE: 0,
    CTR: 0,
    RES: 0,
    AID: 0,
    GBM: 0,
    CAS: 0,
    PHZ: 0,
    PSK: 0,
    END: 0,
    ANY: 0,
  };
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function includesAllTags(card: CardDefinition, tags: readonly string[]): boolean {
  for (const tag of tags) {
    if (!card.tags.includes(tag)) {
      return false;
    }
  }

  return true;
}

function includesAnyTags(card: CardDefinition, tags: readonly string[]): boolean {
  for (const tag of tags) {
    if (card.tags.includes(tag)) {
      return true;
    }
  }

  return false;
}

function textMatchesCard(card: CardDefinition, searchText: string): boolean {
  const haystack = [
    card.id,
    card.name,
    card.deckType,
    card.educationalTag,
    ...card.tags,
    ...card.timingClass,
    ...card.modeLegal,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(searchText.toLowerCase());
}

function stableModePriority(card: CardDefinition, mode: ModeCode): number {
  const priorities = MODE_DECK_PRIORITIES[mode];
  return priorities?.[card.deckType] ?? 999;
}

function stableTagWeight(card: CardDefinition, mode: ModeCode): number {
  const weights = MODE_TAG_WEIGHTS[mode];
  let score = 0;

  for (const tag of card.tags) {
    score += weights[tag] ?? 0;
  }

  return score;
}

function compareCardsBase(a: CardDefinition, b: CardDefinition): number {
  const byDeck = compareStrings(a.deckType, b.deckType);
  if (byDeck !== 0) {
    return byDeck;
  }

  const byRarity = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
  if (byRarity !== 0) {
    return byRarity;
  }

  return compareStrings(a.id, b.id);
}

function compareCardsForMode(mode: ModeCode, a: CardDefinition, b: CardDefinition): number {
  const byDeckPriority = stableModePriority(a, mode) - stableModePriority(b, mode);
  if (byDeckPriority !== 0) {
    return byDeckPriority;
  }

  const byTagWeight = stableTagWeight(mode === 'ghost' ? b : a, mode) - stableTagWeight(mode === 'ghost' ? a : b, mode);
  if (byTagWeight !== 0) {
    return byTagWeight;
  }

  const byRarity = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
  if (byRarity !== 0) {
    return byRarity;
  }

  const byCost = a.baseCost - b.baseCost;
  if (byCost !== 0) {
    return byCost;
  }

  return compareStrings(a.id, b.id);
}

function sortCardsForMode(mode: ModeCode, cards: readonly CardDefinition[]): readonly CardDefinition[] {
  const output = [...cards];
  output.sort((a, b) => compareCardsForMode(mode, a, b));
  return freezeArray(output);
}

function sortCardsBase(cards: readonly CardDefinition[]): readonly CardDefinition[] {
  const output = [...cards];
  output.sort(compareCardsBase);
  return freezeArray(output);
}

function normalizeModeOverlay(modeOverlay?: ModeOverlayMap): ModeOverlayMap | undefined {
  if (!modeOverlay) {
    return undefined;
  }

  const normalized: Partial<Record<ModeCode, Partial<ModeOverlay>>> = {};

  for (const mode of ALL_MODES) {
    const overlay = modeOverlay[mode];
    if (!overlay) {
      continue;
    }

    normalized[mode] = {
      costModifier: overlay.costModifier,
      effectModifier: overlay.effectModifier,
      tagWeights: overlay.tagWeights
        ? { ...overlay.tagWeights }
        : undefined,
      timingLock: overlay.timingLock
        ? uniqueTiming(overlay.timingLock)
        : undefined,
      legal: overlay.legal,
      targetingOverride: overlay.targetingOverride,
      divergencePotential: overlay.divergencePotential,
    };
  }

  return normalized;
}

function overlay(
  patch: Partial<ModeOverlay>,
): Partial<ModeOverlay> {
  return patch;
}

function everyModeLegalShared(card: CardDefinition): boolean {
  if (card.modeLegal.length !== ALL_MODES.length) {
    return false;
  }

  return ALL_MODES.every((mode) => card.modeLegal.includes(mode));
}

export class CardRegistry {
  private readonly cards = new Map<string, CardDefinition>();

  private readonly orderedCards: readonly CardDefinition[];

  private readonly modeIndex: CardBucketIndex<ModeCode> = new Map();

  private readonly deckIndex: CardBucketIndex<DeckType> = new Map();

  private readonly timingIndex: CardBucketIndex<TimingClass> = new Map();

  private readonly tagIndex: CardBucketIndex<string> = new Map();

  private readonly rarityIndex: CardBucketIndex<CardRarity> = new Map();

  private readonly counterabilityIndex: CardBucketIndex<Counterability> = new Map();

  private readonly targetingIndex: CardBucketIndex<Targeting> = new Map();

  private readonly educationalTagIndex: CardBucketIndex<string> = new Map();

  private readonly autoResolveCards: readonly CardDefinition[];

  private readonly decayableCards: readonly CardDefinition[];

  private readonly modeDeckIndex = new Map<ModeCode, Map<DeckType, readonly CardDefinition[]>>();

  public constructor() {
    const seeded = this.seed()
      .map((card) => this.finalizeCard(card));

    for (const card of seeded) {
      this.assertValid(card);

      if (this.cards.has(card.id)) {
        throw new Error(`Duplicate card definition id: ${card.id}`);
      }

      this.cards.set(card.id, card);
    }

    this.orderedCards = sortCardsBase(seeded);
    this.autoResolveCards = freezeArray(
      this.orderedCards.filter((card) => card.autoResolve),
    );
    this.decayableCards = freezeArray(
      this.orderedCards.filter((card) => card.decayTicks !== null),
    );

    this.buildIndexes(this.orderedCards);
  }

  public size(): number {
    return this.orderedCards.length;
  }

  public has(id: string): boolean {
    return this.cards.has(id);
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

  public listAutoResolve(): readonly CardDefinition[] {
    return this.autoResolveCards;
  }

  public listDecayable(): readonly CardDefinition[] {
    return this.decayableCards;
  }

  public listByMode(mode: ModeCode): readonly CardDefinition[] {
    return this.modeIndex.get(mode) ?? EMPTY_CARD_ARRAY;
  }

  public listByDeckType(deckType: DeckType): readonly CardDefinition[] {
    return this.deckIndex.get(deckType) ?? EMPTY_CARD_ARRAY;
  }

  public listByTimingClass(timing: TimingClass): readonly CardDefinition[] {
    return this.timingIndex.get(timing) ?? EMPTY_CARD_ARRAY;
  }

  public listByTag(tag: string): readonly CardDefinition[] {
    return this.tagIndex.get(tag) ?? EMPTY_CARD_ARRAY;
  }

  public listByRarity(rarity: CardRarity): readonly CardDefinition[] {
    return this.rarityIndex.get(rarity) ?? EMPTY_CARD_ARRAY;
  }

  public listByCounterability(counterability: Counterability): readonly CardDefinition[] {
    return this.counterabilityIndex.get(counterability) ?? EMPTY_CARD_ARRAY;
  }

  public listByTargeting(targeting: Targeting): readonly CardDefinition[] {
    return this.targetingIndex.get(targeting) ?? EMPTY_CARD_ARRAY;
  }

  public listByEducationalTag(educationalTag: string): readonly CardDefinition[] {
    return this.educationalTagIndex.get(educationalTag) ?? EMPTY_CARD_ARRAY;
  }

  public listByModeAndDeck(mode: ModeCode, deckType: DeckType): readonly CardDefinition[] {
    return this.modeDeckIndex.get(mode)?.get(deckType) ?? EMPTY_CARD_ARRAY;
  }

  public listSharedAcrossAllModes(): readonly CardDefinition[] {
    return freezeArray(
      this.orderedCards.filter((card) => everyModeLegalShared(card)),
    );
  }

  public listModeExclusive(mode: ModeCode): readonly CardDefinition[] {
    return freezeArray(
      this.orderedCards.filter(
        (card) => card.modeLegal.length === 1 && card.modeLegal[0] === mode,
      ),
    );
  }

  public listReactionCardsForMode(mode: ModeCode): readonly CardDefinition[] {
    return freezeArray(
      this.listByMode(mode).filter((card) =>
        card.timingClass.some((timing) =>
          timing === 'FATE' ||
          timing === 'CTR' ||
          timing === 'RES' ||
          timing === 'AID' ||
          timing === 'CAS' ||
          timing === 'PSK',
        ),
      ),
    );
  }

  public listLegendaryByMode(mode: ModeCode): readonly CardDefinition[] {
    return freezeArray(
      this.listByMode(mode).filter((card) => card.rarity === 'LEGENDARY'),
    );
  }

  public listPhaseBoundaryCards(mode: ModeCode): readonly CardDefinition[] {
    return freezeArray(
      this.listByMode(mode).filter((card) => card.timingClass.includes('PHZ')),
    );
  }

  public listGhostBenchmarkCards(): readonly CardDefinition[] {
    return freezeArray(
      this.listByMode('ghost').filter((card) => card.timingClass.includes('GBM')),
    );
  }

  public listSharedOpportunityDeckCandidates(mode: ModeCode): readonly CardDefinition[] {
    return freezeArray(
      this.listByModeAndDeck(mode, 'OPPORTUNITY').filter(
        (card) => !card.timingClass.includes('PHZ'),
      ),
    );
  }

  public query(input: CardQuery): readonly CardDefinition[] {
    let working: readonly CardDefinition[] = this.orderedCards;

    if (input.mode) {
      working = this.listByMode(input.mode);
    }

    if (input.deckType) {
      working = working.filter((card) => card.deckType === input.deckType);
    }

    if (input.timingClass) {
      working = working.filter((card) => card.timingClass.includes(input.timingClass!));
    }

    if (input.rarity) {
      working = working.filter((card) => card.rarity === input.rarity);
    }

    if (input.targeting) {
      working = working.filter((card) => card.targeting === input.targeting);
    }

    if (input.counterability) {
      working = working.filter((card) => card.counterability === input.counterability);
    }

    if (input.autoResolve !== undefined) {
      working = working.filter((card) => card.autoResolve === input.autoResolve);
    }

    if (input.decayableOnly) {
      working = working.filter((card) => card.decayTicks !== null);
    }

    if (input.tagsAll && input.tagsAll.length > 0) {
      working = working.filter((card) => includesAllTags(card, input.tagsAll!));
    }

    if (input.tagsAny && input.tagsAny.length > 0) {
      working = working.filter((card) => includesAnyTags(card, input.tagsAny!));
    }

    if (input.educationalTag) {
      working = working.filter(
        (card) => card.educationalTag === input.educationalTag,
      );
    }

    if (input.text && input.text.trim().length > 0) {
      working = working.filter((card) => textMatchesCard(card, input.text!));
    }

    return freezeArray([...working]);
  }

  public describeModeCatalog(mode: ModeCode): ModeCatalogSummary {
    const cards = this.listByMode(mode);
    const byDeckType = buildEmptyDeckCountRecord();

    let legendaryCount = 0;
    let autoResolveCount = 0;
    let reactionWindowCount = 0;
    let phaseBoundaryCount = 0;
    let ghostWindowCount = 0;

    for (const card of cards) {
      byDeckType[card.deckType] += 1;

      if (card.rarity === 'LEGENDARY') {
        legendaryCount += 1;
      }

      if (card.autoResolve) {
        autoResolveCount += 1;
      }

      if (
        card.timingClass.includes('FATE') ||
        card.timingClass.includes('CTR') ||
        card.timingClass.includes('RES') ||
        card.timingClass.includes('AID') ||
        card.timingClass.includes('CAS') ||
        card.timingClass.includes('PSK')
      ) {
        reactionWindowCount += 1;
      }

      if (card.timingClass.includes('PHZ')) {
        phaseBoundaryCount += 1;
      }

      if (card.timingClass.includes('GBM')) {
        ghostWindowCount += 1;
      }
    }

    return Object.freeze({
      mode,
      totalCards: cards.length,
      byDeckType: Object.freeze(byDeckType),
      legendaryCount,
      autoResolveCount,
      reactionWindowCount,
      phaseBoundaryCount,
      ghostWindowCount,
    });
  }

  public diagnostics(): RegistryDiagnostics {
    const byMode = buildEmptyModeCountRecord();
    const byDeckType = buildEmptyDeckCountRecord();
    const byRarity = buildEmptyRarityCountRecord();
    const timingCoverage = buildEmptyTimingCountRecord();

    for (const card of this.orderedCards) {
      byDeckType[card.deckType] += 1;
      byRarity[card.rarity] += 1;

      for (const mode of card.modeLegal) {
        byMode[mode] += 1;
      }

      for (const timing of card.timingClass) {
        timingCoverage[timing] += 1;
      }
    }

    const modeExclusiveIds: Record<ModeCode, readonly string[]> = {
      solo: freezeArray(this.listModeExclusive('solo').map((card) => card.id)),
      pvp: freezeArray(this.listModeExclusive('pvp').map((card) => card.id)),
      coop: freezeArray(this.listModeExclusive('coop').map((card) => card.id)),
      ghost: freezeArray(this.listModeExclusive('ghost').map((card) => card.id)),
    };

    return Object.freeze({
      totalCards: this.orderedCards.length,
      byMode: Object.freeze(byMode),
      byDeckType: Object.freeze(byDeckType),
      byRarity: Object.freeze(byRarity),
      timingCoverage: Object.freeze(timingCoverage),
      sharedAcrossAllModes: freezeArray(
        this.listSharedAcrossAllModes().map((card) => card.id),
      ),
      modeExclusiveIds: Object.freeze(modeExclusiveIds),
    });
  }

  private buildIndexes(cards: readonly CardDefinition[]): void {
    const modeBuckets = new Map<ModeCode, CardDefinition[]>();
    const deckBuckets = new Map<DeckType, CardDefinition[]>();
    const timingBuckets = new Map<TimingClass, CardDefinition[]>();
    const tagBuckets = new Map<string, CardDefinition[]>();
    const rarityBuckets = new Map<CardRarity, CardDefinition[]>();
    const counterabilityBuckets = new Map<Counterability, CardDefinition[]>();
    const targetingBuckets = new Map<Targeting, CardDefinition[]>();
    const educationalTagBuckets = new Map<string, CardDefinition[]>();

    const modeDeckMutable = new Map<ModeCode, Map<DeckType, CardDefinition[]>>();

    for (const mode of ALL_MODES) {
      modeDeckMutable.set(mode, new Map());
    }

    for (const card of cards) {
      for (const mode of card.modeLegal) {
        const bucket = modeBuckets.get(mode) ?? [];
        bucket.push(card);
        modeBuckets.set(mode, bucket);

        const nested = modeDeckMutable.get(mode)!;
        const nestedBucket = nested.get(card.deckType) ?? [];
        nestedBucket.push(card);
        nested.set(card.deckType, nestedBucket);
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

      for (const tag of card.tags) {
        const bucket = tagBuckets.get(tag) ?? [];
        bucket.push(card);
        tagBuckets.set(tag, bucket);
      }

      {
        const bucket = rarityBuckets.get(card.rarity) ?? [];
        bucket.push(card);
        rarityBuckets.set(card.rarity, bucket);
      }

      {
        const bucket = counterabilityBuckets.get(card.counterability) ?? [];
        bucket.push(card);
        counterabilityBuckets.set(card.counterability, bucket);
      }

      {
        const bucket = targetingBuckets.get(card.targeting) ?? [];
        bucket.push(card);
        targetingBuckets.set(card.targeting, bucket);
      }

      {
        const bucket = educationalTagBuckets.get(card.educationalTag) ?? [];
        bucket.push(card);
        educationalTagBuckets.set(card.educationalTag, bucket);
      }
    }

    for (const [mode, bucket] of modeBuckets.entries()) {
      this.modeIndex.set(mode, sortCardsForMode(mode, bucket));
    }

    for (const [deck, bucket] of deckBuckets.entries()) {
      this.deckIndex.set(deck, sortCardsBase(bucket));
    }

    for (const [timing, bucket] of timingBuckets.entries()) {
      this.timingIndex.set(timing, sortCardsBase(bucket));
    }

    for (const [tag, bucket] of tagBuckets.entries()) {
      this.tagIndex.set(tag, sortCardsBase(bucket));
    }

    for (const [rarity, bucket] of rarityBuckets.entries()) {
      this.rarityIndex.set(rarity, sortCardsBase(bucket));
    }

    for (const [counterability, bucket] of counterabilityBuckets.entries()) {
      this.counterabilityIndex.set(counterability, sortCardsBase(bucket));
    }

    for (const [targeting, bucket] of targetingBuckets.entries()) {
      this.targetingIndex.set(targeting, sortCardsBase(bucket));
    }

    for (const [educationalTag, bucket] of educationalTagBuckets.entries()) {
      this.educationalTagIndex.set(educationalTag, sortCardsBase(bucket));
    }

    for (const mode of ALL_MODES) {
      const mutableNested = modeDeckMutable.get(mode)!;
      const finalized = new Map<DeckType, readonly CardDefinition[]>();

      for (const deckType of ALL_DECK_TYPES) {
        const bucket = mutableNested.get(deckType) ?? [];
        finalized.set(deckType, sortCardsForMode(mode, bucket));
      }

      this.modeDeckIndex.set(mode, finalized);
    }
  }

  private finalizeCard(card: CardDefinition): CardDefinition {
    const normalized: CardDefinition = {
      ...card,
      id: card.id.trim(),
      name: card.name.trim(),
      tags: uniqueStrings(card.tags.map((tag) => tag.trim()).filter(Boolean)),
      timingClass: uniqueTiming(card.timingClass),
      modeLegal: uniqueStrings(card.modeLegal) as ModeCode[],
      modeOverlay: normalizeModeOverlay(card.modeOverlay),
      educationalTag: card.educationalTag.trim(),
    };

    return deepFrozenClone(normalized);
  }

  private assertValid(card: CardDefinition): void {
    if (card.id.length === 0) {
      throw new Error('Card id cannot be empty.');
    }

    if (card.name.length === 0) {
      throw new Error(`Card ${card.id} has an empty name.`);
    }

    if (!isDeckType(card.deckType)) {
      throw new Error(`Card ${card.id} has invalid deckType ${String(card.deckType)}.`);
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

    if (!isRarity(card.rarity)) {
      throw new Error(`Card ${card.id} has invalid rarity ${String(card.rarity)}.`);
    }

    if (!isCounterability(card.counterability)) {
      throw new Error(
        `Card ${card.id} has invalid counterability ${String(card.counterability)}.`,
      );
    }

    if (!isTargeting(card.targeting)) {
      throw new Error(`Card ${card.id} has invalid targeting ${String(card.targeting)}.`);
    }

    if (
      card.decisionTimerOverrideMs !== null &&
      (!isFiniteNumber(card.decisionTimerOverrideMs) || card.decisionTimerOverrideMs < 0)
    ) {
      throw new Error(`Card ${card.id} has invalid decisionTimerOverrideMs.`);
    }

    if (
      card.decayTicks !== null &&
      (!isFiniteNumber(card.decayTicks) || card.decayTicks < 0)
    ) {
      throw new Error(`Card ${card.id} has invalid decayTicks.`);
    }

    if (card.educationalTag.length === 0) {
      throw new Error(`Card ${card.id} must declare an educationalTag.`);
    }

    for (const mode of card.modeLegal) {
      if (!isModeCode(mode)) {
        throw new Error(`Card ${card.id} has invalid modeLegal entry ${mode}.`);
      }
    }

    for (const timing of card.timingClass) {
      if (!isTimingClass(timing)) {
        throw new Error(`Card ${card.id} has invalid timingClass entry ${timing}.`);
      }
    }

    for (const key of NUMERIC_EFFECT_KEYS) {
      const value = card.baseEffect[key];
      if (value !== undefined && !isFiniteNumber(value)) {
        throw new Error(
          `Card ${card.id} has non-finite numeric effect value for ${String(key)}.`,
        );
      }
    }

    if (card.baseEffect.injectCards && !Array.isArray(card.baseEffect.injectCards)) {
      throw new Error(`Card ${card.id} has invalid injectCards.`);
    }

    if (card.baseEffect.exhaustCards && !Array.isArray(card.baseEffect.exhaustCards)) {
      throw new Error(`Card ${card.id} has invalid exhaustCards.`);
    }

    if (card.baseEffect.grantBadges && !Array.isArray(card.baseEffect.grantBadges)) {
      throw new Error(`Card ${card.id} has invalid grantBadges.`);
    }

    if (
      card.baseEffect.namedActionId !== undefined &&
      card.baseEffect.namedActionId !== null &&
      card.baseEffect.namedActionId.trim().length === 0
    ) {
      throw new Error(`Card ${card.id} has empty namedActionId.`);
    }

    this.assertOverlayMapValid(card);
    this.assertDoctrinalModeConsistency(card);
  }

  private assertOverlayMapValid(card: CardDefinition): void {
    if (!card.modeOverlay) {
      return;
    }

    for (const [modeKey, overlayPatch] of Object.entries(card.modeOverlay)) {
      if (!isModeCode(modeKey)) {
        throw new Error(`Card ${card.id} has invalid overlay mode key ${modeKey}.`);
      }

      if (!overlayPatch) {
        continue;
      }

      if (
        overlayPatch.costModifier !== undefined &&
        (!isFiniteNumber(overlayPatch.costModifier) || overlayPatch.costModifier < 0)
      ) {
        throw new Error(
          `Card ${card.id} has invalid costModifier for mode ${modeKey}.`,
        );
      }

      if (
        overlayPatch.effectModifier !== undefined &&
        (!isFiniteNumber(overlayPatch.effectModifier) || overlayPatch.effectModifier < 0)
      ) {
        throw new Error(
          `Card ${card.id} has invalid effectModifier for mode ${modeKey}.`,
        );
      }

      if (overlayPatch.tagWeights) {
        for (const [tag, weight] of Object.entries(overlayPatch.tagWeights)) {
          if (tag.trim().length === 0) {
            throw new Error(`Card ${card.id} has empty overlay tag for mode ${modeKey}.`);
          }

          if (!isFiniteNumber(weight) || weight < 0) {
            throw new Error(
              `Card ${card.id} has invalid tag weight for tag ${tag} in mode ${modeKey}.`,
            );
          }
        }
      }

      if (overlayPatch.timingLock) {
        for (const timing of overlayPatch.timingLock) {
          if (!isTimingClass(timing)) {
            throw new Error(
              `Card ${card.id} has invalid timingLock ${String(timing)} in mode ${modeKey}.`,
            );
          }
        }
      }

      if (
        overlayPatch.targetingOverride !== undefined &&
        !isTargeting(overlayPatch.targetingOverride)
      ) {
        throw new Error(
          `Card ${card.id} has invalid targetingOverride in mode ${modeKey}.`,
        );
      }

      if (overlayPatch.legal === false && card.modeLegal.includes(modeKey)) {
        // allowed, but explicit illegal overlay must remain inspectable for draw denial
      }
    }
  }

  private assertDoctrinalModeConsistency(card: CardDefinition): void {
    if (card.deckType === 'SABOTAGE' || card.deckType === 'COUNTER' || card.deckType === 'BLUFF') {
      if (!(card.modeLegal.length === 1 && card.modeLegal[0] === 'pvp')) {
        throw new Error(
          `Card ${card.id} in deck ${card.deckType} must be pvp-exclusive.`,
        );
      }
    }

    if (card.deckType === 'AID' || card.deckType === 'RESCUE' || card.deckType === 'TRUST') {
      if (!(card.modeLegal.length === 1 && card.modeLegal[0] === 'coop')) {
        throw new Error(
          `Card ${card.id} in deck ${card.deckType} must be coop-exclusive.`,
        );
      }
    }

    if (card.deckType === 'GHOST') {
      if (!(card.modeLegal.length === 1 && card.modeLegal[0] === 'ghost')) {
        throw new Error(`Card ${card.id} in GHOST deck must be ghost-exclusive.`);
      }
    }

    if (card.deckType === 'DISCIPLINE') {
      const legal = new Set(card.modeLegal);
      for (const mode of legal) {
        if (mode !== 'solo' && mode !== 'ghost') {
          throw new Error(
            `Card ${card.id} in DISCIPLINE deck must be solo and/or ghost only.`,
          );
        }
      }
    }

    if (card.timingClass.includes('CTR') && !card.modeLegal.includes('pvp')) {
      throw new Error(
        `Card ${card.id} uses CTR timing but is not legal in pvp.`,
      );
    }

    if ((card.timingClass.includes('RES') || card.timingClass.includes('AID')) && !card.modeLegal.includes('coop')) {
      throw new Error(
        `Card ${card.id} uses team timing but is not legal in coop.`,
      );
    }

    if (card.timingClass.includes('GBM') && !card.modeLegal.includes('ghost')) {
      throw new Error(
        `Card ${card.id} uses GBM timing but is not legal in ghost.`,
      );
    }

    if (card.timingClass.includes('PHZ') && !card.modeLegal.includes('solo')) {
      throw new Error(
        `Card ${card.id} uses PHZ timing but is not legal in solo.`,
      );
    }

    if (card.targeting === 'TEAMMATE' || card.targeting === 'TEAM') {
      if (!card.modeLegal.includes('coop')) {
        throw new Error(
          `Card ${card.id} targets team context but is not legal in coop.`,
        );
      }
    }

    if (card.tags.includes('sabotage') && !card.modeLegal.includes('pvp')) {
      throw new Error(
        `Card ${card.id} uses sabotage tag but is not legal in pvp.`,
      );
    }

    if ((card.tags.includes('trust') || card.tags.includes('aid')) && !card.modeLegal.includes('coop')) {
      throw new Error(
        `Card ${card.id} uses trust/aid semantics but is not legal in coop.`,
      );
    }

    if (card.tags.includes('divergence') && !card.modeLegal.includes('ghost')) {
      throw new Error(
        `Card ${card.id} uses divergence semantics but is not legal in ghost.`,
      );
    }
  }

  private seed(): CardDefinition[] {
    return [
      ...this.seedSharedCoreCards(),
      ...this.seedEmpireCards(),
      ...this.seedPredatorCards(),
      ...this.seedSyndicateCards(),
      ...this.seedPhantomCards(),
    ];
  }

  private seedSharedCoreCards(): CardDefinition[] {
    return [
      {
        id: 'NETWORK_CALL',
        name: 'Network Call',
        deckType: 'PRIVILEGED',
        baseCost: 2000,
        baseEffect: {
          cashDelta: 0,
          incomeDelta: 350,
          heatDelta: 2,
        },
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
          solo: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { heat: 0.6, scale: 2.5 },
          }),
          pvp: overlay({
            costModifier: 1.4,
            effectModifier: 0.8,
            legal: true,
            tagWeights: { heat: 1.5, income: 0.6, tempo: 2.4 },
          }),
          coop: overlay({
            costModifier: 0.9,
            effectModifier: 1.2,
            legal: true,
            tagWeights: { trust: 0.8, income: 1.8, scale: 1.3 },
          }),
          ghost: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { precision: 0.5, divergence: 0.3 },
          }),
        },
        educationalTag: 'Your network is your net worth',
      },
      {
        id: 'VARIANCE_LOCK',
        name: 'Variance Lock',
        deckType: 'DISCIPLINE',
        baseCost: 1500,
        baseEffect: {
          shieldDelta: 4,
          namedActionId: 'SUSPEND_FATE_EVENTS',
        },
        tags: ['precision', 'resilience', 'variance'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 8,
        modeLegal: ['solo', 'ghost'],
        modeOverlay: {
          solo: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { precision: 1.2, resilience: 1.8, variance: 1.0 },
          }),
          ghost: overlay({
            costModifier: 1.0,
            effectModifier: 1.1,
            legal: true,
            tagWeights: { precision: 2.6, divergence: 0.6 },
            divergencePotential: 'MEDIUM',
          }),
        },
        educationalTag: 'Stability has a price',
      },
      {
        id: 'IRON_DISCIPLINE',
        name: 'Iron Discipline',
        deckType: 'DISCIPLINE',
        baseCost: 5000,
        baseEffect: {
          shieldDelta: 8,
          namedActionId: 'AUTO_RESOLVE_SECOND_BEST',
        },
        tags: ['precision', 'resilience', 'variance'],
        timingClass: ['ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: null,
        modeLegal: ['solo', 'ghost'],
        modeOverlay: {
          solo: overlay({
            costModifier: 1.0,
            effectModifier: 1.1,
            legal: true,
            tagWeights: { precision: 1.2, resilience: 1.8, variance: 0.8 },
          }),
          ghost: overlay({
            costModifier: 1.0,
            effectModifier: 1.2,
            legal: true,
            tagWeights: { precision: 2.6, divergence: 1.0 },
            divergencePotential: 'HIGH',
          }),
        },
        educationalTag: 'Eliminate the worst outcome before chasing the best',
      },
      {
        id: 'SOVEREIGN_LEVERAGE',
        name: 'Sovereign Leverage',
        deckType: 'PRIVILEGED',
        baseCost: 0,
        baseEffect: {
          cashDelta: 6000,
          incomeDelta: 500,
          namedActionId: 'HALF_COST_OPPORTUNITY_BUY',
        },
        tags: ['scale', 'liquidity', 'income'],
        timingClass: ['ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 2,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        modeOverlay: {
          solo: overlay({
            costModifier: 1.0,
            effectModifier: 1.1,
            legal: true,
            tagWeights: { scale: 2.5, income: 2.2, liquidity: 2.0 },
          }),
          pvp: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { tempo: 2.0, income: 0.6, heat: 1.5 },
          }),
          coop: overlay({
            costModifier: 0.9,
            effectModifier: 1.2,
            legal: true,
            tagWeights: { aid: 0.5, trust: 0.5, scale: 1.3 },
          }),
          ghost: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { precision: 0.9, divergence: 1.6 },
            divergencePotential: 'HIGH',
          }),
        },
        educationalTag: 'Leverage is a tool, not a trait',
      },
      {
        id: 'SYSTEMIC_OVERRIDE',
        name: 'Systemic Override',
        deckType: 'PRIVILEGED',
        baseCost: 0,
        baseEffect: {
          heatDelta: -50,
          namedActionId: 'RESET_HATER_HEAT',
        },
        tags: ['resilience', 'heat'],
        timingClass: ['ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'GLOBAL',
        decisionTimerOverrideMs: null,
        decayTicks: 1,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        modeOverlay: {
          solo: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { resilience: 1.8, heat: 0.6 },
          }),
          pvp: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { heat: 1.5, tempo: 1.4 },
          }),
          coop: overlay({
            costModifier: 0.9,
            effectModifier: 1.1,
            legal: true,
            targetingOverride: 'TEAM',
            tagWeights: { trust: 0.8, resilience: 2.0 },
          }),
          ghost: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { precision: 0.9, divergence: 1.2 },
            divergencePotential: 'MEDIUM',
          }),
        },
        educationalTag: 'A reset is not free, but it changes everything',
      },
      {
        id: 'CASCADE_BREAK',
        name: 'Cascade Break',
        deckType: 'SO',
        baseCost: 0,
        baseEffect: {
          namedActionId: 'BREAK_ACTIVE_CASCADE_CHAINS',
          cascadeTag: 'BREAK',
        },
        tags: ['resilience', 'cascade'],
        timingClass: ['CAS', 'ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 2,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        modeOverlay: {
          solo: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { cascade: 1.8, resilience: 1.8 },
          }),
          pvp: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { cascade: 1.2, tempo: 2.0 },
          }),
          coop: overlay({
            costModifier: 0.8,
            effectModifier: 1.2,
            legal: true,
            targetingOverride: 'TEAM',
            tagWeights: { cascade: 1.6, trust: 1.0, aid: 0.8 },
          }),
          ghost: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { cascade: 1.5, precision: 1.3, divergence: 1.1 },
            divergencePotential: 'HIGH',
          }),
        },
        educationalTag: 'Breaking the chain changes the future, not the past',
      },
      {
        id: 'TIME_DEBT_PAID',
        name: 'Time Debt Paid',
        deckType: 'PRIVILEGED',
        baseCost: 0,
        baseEffect: {
          timeDeltaMs: 90_000,
        },
        tags: ['tempo', 'resilience'],
        timingClass: ['END', 'ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 1,
        modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
        modeOverlay: {
          solo: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { tempo: 1.0, resilience: 1.8 },
          }),
          pvp: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { tempo: 2.4, resilience: 0.8 },
          }),
          coop: overlay({
            costModifier: 0.9,
            effectModifier: 1.1,
            legal: true,
            targetingOverride: 'TEAM',
            tagWeights: { aid: 1.0, trust: 0.8, tempo: 1.0 },
          }),
          ghost: overlay({
            costModifier: 1.0,
            effectModifier: 1.0,
            legal: true,
            tagWeights: { precision: 1.0, divergence: 1.0, tempo: 1.8 },
            divergencePotential: 'HIGH',
          }),
        },
        educationalTag: 'Buying time is sometimes the trade',
      },
    ];
  }

  private seedEmpireCards(): CardDefinition[] {
    return [
      {
        id: 'DISTRESSED_ASSET_ACQUISITION',
        name: 'Distressed Asset Acquisition',
        deckType: 'OPPORTUNITY',
        baseCost: 18_000,
        baseEffect: {
          incomeDelta: 3_200,
          heatDelta: -12,
        },
        tags: ['liquidity', 'income', 'scale', 'momentum'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 6,
        modeLegal: ['solo'],
        educationalTag: 'Buy fear when others are forced to sell',
      },
      {
        id: 'DIGITAL_REVENUE_STREAM',
        name: 'Digital Revenue Stream',
        deckType: 'OPPORTUNITY',
        baseCost: 8_500,
        baseEffect: {
          incomeDelta: 1_800,
        },
        tags: ['income', 'scale', 'momentum'],
        timingClass: ['PRE', 'PHZ'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['solo'],
        educationalTag: 'Digital income is asymmetric and rewards early deployment',
      },
      {
        id: 'HOSTILE_ACQUISITION_BLOCK',
        name: 'Hostile Acquisition Block',
        deckType: 'SO',
        baseCost: 0,
        baseEffect: {
          shieldDelta: 10,
          cascadeTag: 'LIQUIDATION_BLOCK',
          namedActionId: 'NEGOTIATED_EXIT_90_PERCENT',
        },
        tags: ['resilience', 'liquidity', 'cascade'],
        timingClass: ['FATE'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 1,
        modeLegal: ['solo'],
        educationalTag: 'Negotiated exits beat forced liquidations',
      },
      {
        id: 'LICENSING_DEAL',
        name: 'Licensing Deal',
        deckType: 'IPA',
        baseCost: 12_000,
        baseEffect: {
          incomeDelta: 2_400,
          namedActionId: 'ROYALTY_ESCALATION_TRACK',
        },
        tags: ['income', 'scale', 'resilience'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: null,
        modeLegal: ['solo'],
        educationalTag: 'Licensing compounds without repeated capital outlay',
      },
      {
        id: 'REAL_ESTATE_POSITION',
        name: 'Real Estate Position',
        deckType: 'IPA',
        baseCost: 14_000,
        baseEffect: {
          incomeDelta: 2_100,
          shieldDelta: 6,
        },
        tags: ['income', 'resilience', 'scale', 'momentum'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: null,
        modeLegal: ['solo'],
        educationalTag: 'Real estate buffers shocks while compounding cashflow',
      },
      {
        id: 'EQUITY_POSITION',
        name: 'Equity Position',
        deckType: 'IPA',
        baseCost: 9_000,
        baseEffect: {
          incomeDelta: 1_600,
          cashDelta: 1_000,
        },
        tags: ['income', 'scale', 'momentum'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: null,
        modeLegal: ['solo'],
        educationalTag: 'Paper ownership becomes real only when tied to cashflow discipline',
      },
      {
        id: 'BUSINESS_ACQUISITION',
        name: 'Business Acquisition',
        deckType: 'OPPORTUNITY',
        baseCost: 24_000,
        baseEffect: {
          incomeDelta: 4_000,
          expenseDelta: 700,
        },
        tags: ['income', 'scale', 'momentum', 'variance'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'SELF',
        decisionTimerOverrideMs: 6_000,
        decayTicks: 6,
        modeLegal: ['solo'],
        educationalTag: 'Operational leverage rewards control but punishes sloppiness',
      },
      {
        id: 'CASH_RESERVE_INJECT',
        name: 'Cash Reserve Inject',
        deckType: 'SO',
        baseCost: 3_000,
        baseEffect: {
          cashDelta: 6_000,
          shieldDelta: 5,
        },
        tags: ['liquidity', 'resilience', 'tempo'],
        timingClass: ['ANY', 'PSK'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 3,
        modeLegal: ['solo'],
        educationalTag: 'Liquidity solves timing problems before scale solves wealth problems',
      },
      {
        id: 'COMPLIANCE_SHIELD',
        name: 'Compliance Shield',
        deckType: 'SO',
        baseCost: 4_000,
        baseEffect: {
          shieldDelta: 12,
          namedActionId: 'BLOCK_REGULATORY_SURPRISE',
        },
        tags: ['resilience', 'cascade', 'precision'],
        timingClass: ['FATE', 'CAS'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 2,
        modeLegal: ['solo'],
        educationalTag: 'Administrative preparedness is a cashflow defense',
      },
      {
        id: 'RECESSION_SHIELD',
        name: 'Recession Shield',
        deckType: 'SO',
        baseCost: 5_500,
        baseEffect: {
          shieldDelta: 10,
          expenseDelta: -500,
          namedActionId: 'BLOCK_MARKET_CORRECTION',
        },
        tags: ['resilience', 'liquidity', 'cascade'],
        timingClass: ['FATE', 'PSK'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 3_500,
        decayTicks: 2,
        modeLegal: ['solo'],
        educationalTag: 'Defensive reserves are an offensive advantage during contractions',
      },
      {
        id: 'MOMENTUM_PIVOT',
        name: 'Momentum Pivot',
        deckType: 'OPPORTUNITY',
        baseCost: 0,
        baseEffect: {
          incomeDelta: 450,
          cashDelta: 8_000,
          namedActionId: 'LOCK_EMPIRE_STRATEGY',
        },
        tags: ['income', 'liquidity', 'scale', 'momentum'],
        timingClass: ['PHZ'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['solo'],
        educationalTag: 'Strategy must declare itself at the phase boundary',
      },
      {
        id: 'FORTIFY_ORDER',
        name: 'Fortify Order',
        deckType: 'SO',
        baseCost: 6_000,
        baseEffect: {
          shieldDelta: 15,
        },
        tags: ['resilience', 'tempo'],
        timingClass: ['PHZ'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['solo'],
        educationalTag: 'Fortification costs capital and timing',
      },
      {
        id: 'LAST_STAND_PROTOCOL',
        name: 'Last Stand Protocol',
        deckType: 'SO',
        baseCost: 0,
        baseEffect: {
          cashDelta: 3_000,
          heatDelta: -5,
          grantBadges: ['COMEBACK_ELIGIBLE'],
        },
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
        id: 'REGULATORY_BARRIER',
        name: 'Regulatory Barrier',
        deckType: 'SO',
        baseCost: 4_000,
        baseEffect: {
          shieldDelta: 6,
          namedActionId: 'CONVERT_BARRIER_TO_BADGE',
          grantBadges: ['COMPLIANCE'],
        },
        tags: ['resilience', 'tempo', 'precision'],
        timingClass: ['ANY', 'CAS'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 4,
        modeLegal: ['solo'],
        educationalTag: 'Obstacles can become structural advantage if converted correctly',
      },
      {
        id: 'CREDIT_WALL',
        name: 'Credit Wall',
        deckType: 'SO',
        baseCost: 2_500,
        baseEffect: {
          shieldDelta: 9,
          debtDelta: -1,
        },
        tags: ['resilience', 'liquidity', 'tempo'],
        timingClass: ['ANY', 'PSK'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 4,
        modeLegal: ['solo'],
        educationalTag: 'Credit repair is shield repair in financial combat',
      },
      {
        id: 'LIQUIDITY_TRAP',
        name: 'Liquidity Trap',
        deckType: 'SO',
        baseCost: 3_000,
        baseEffect: {
          cashDelta: 0,
          namedActionId: 'STOP_CASH_DRAIN',
        },
        tags: ['liquidity', 'tempo', 'resilience'],
        timingClass: ['ANY', 'PSK'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 2_500,
        decayTicks: 3,
        modeLegal: ['solo'],
        educationalTag: 'Stopping the leak is sometimes worth more than growing the income',
      },
      {
        id: 'MARKET_GATEKEEPER',
        name: 'Market Gatekeeper',
        deckType: 'SO',
        baseCost: 5_000,
        baseEffect: {
          counterIntelDelta: 1,
          namedActionId: 'BYPASS_OPPORTUNITY_LOCK',
        },
        tags: ['precision', 'scale', 'tempo'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4_500,
        decayTicks: 3,
        modeLegal: ['solo'],
        educationalTag: 'Access determines return before analysis determines quality',
      },
      {
        id: 'MISSED_OPPORTUNITY_LEDGER',
        name: 'Missed Opportunity Ledger',
        deckType: 'MISSED_OPPORTUNITY',
        baseCost: 0,
        baseEffect: {
          heatDelta: 2,
          namedActionId: 'TRACK_OPPORTUNITY_COST',
        },
        tags: ['momentum', 'variance', 'tempo'],
        timingClass: ['POST'],
        rarity: 'COMMON',
        autoResolve: true,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 2,
        modeLegal: ['solo'],
        educationalTag: 'What you do not buy still compounds against you',
      },
      {
        id: 'MOMENTUM_CAPITAL',
        name: 'Momentum Capital',
        deckType: 'PRIVILEGED',
        baseCost: 0,
        baseEffect: {
          cashDelta: 10_000,
        },
        tags: ['liquidity', 'momentum', 'scale'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 1,
        modeLegal: ['solo'],
        educationalTag: 'A strong opening changes the entire capital allocation tree',
      },
    ];
  }

  private seedPredatorCards(): CardDefinition[] {
    return [
      {
        id: 'CHAIN_RUMOR',
        name: 'Chain Rumor',
        deckType: 'SABOTAGE',
        baseCost: 15,
        baseEffect: {
          incomeDelta: -250,
          battleBudgetDelta: -8,
        },
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
        baseEffect: {
          heatDelta: 3,
          namedActionId: 'AMPLIFY_NEXT_SABOTAGE',
        },
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
        baseEffect: {
          heatDelta: 5,
          namedActionId: 'ACTIVATE_BUREAUCRAT_AUDIT',
        },
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
        baseEffect: {
          incomeDelta: -500,
          heatDelta: 4,
          namedActionId: 'PERMANENT_HALF_CASHFLOW_STRIKE',
        },
        tags: ['sabotage', 'tempo', 'variance', 'heat'],
        timingClass: ['PRE', 'PSK'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'HARD',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['pvp'],
        educationalTag: 'Visible pressure is part of the attack',
      },
      {
        id: 'MARKET_DUMP',
        name: 'Market Dump',
        deckType: 'SABOTAGE',
        baseCost: 30,
        baseEffect: {
          incomeDelta: -350,
          namedActionId: 'DEVALUE_BEST_ASSET_FOR_TWO_TICKS',
        },
        tags: ['sabotage', 'tempo', 'income'],
        timingClass: ['PRE', 'POST', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 3,
        modeLegal: ['pvp'],
        educationalTag: 'Value perception can be attacked before value creation can respond',
      },
      {
        id: 'DEBT_INJECTION',
        name: 'Debt Injection',
        deckType: 'SABOTAGE',
        baseCost: 40,
        baseEffect: {
          debtDelta: 1,
          expenseDelta: 12,
          namedActionId: 'INJECT_COMPOUNDING_DEBT',
        },
        tags: ['sabotage', 'cascade', 'tempo'],
        timingClass: ['PRE', 'PSK'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'HARD',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 4,
        modeLegal: ['pvp'],
        educationalTag: 'Debt is a weapon when deployed on hostile timing',
      },
      {
        id: 'SILENT_DRAIN',
        name: 'Silent Drain',
        deckType: 'SABOTAGE',
        baseCost: 22,
        baseEffect: {
          battleBudgetDelta: -2,
          namedActionId: 'STEALTH_BB_DRAIN_OVER_TIME',
        },
        tags: ['sabotage', 'variance', 'tempo'],
        timingClass: ['POST', 'ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: null,
        decayTicks: 4,
        modeLegal: ['pvp'],
        educationalTag: 'Erosion without announcement is still warfare',
      },
      {
        id: 'PHANTOM_FILING',
        name: 'Phantom Filing',
        deckType: 'BLUFF',
        baseCost: 3_000,
        baseEffect: {
          cashDelta: 2_000,
          incomeDelta: 8,
          namedActionId: 'DISGUISE_AS_REGULATORY_FILING',
        },
        tags: ['sabotage', 'tempo', 'variance', 'momentum'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: null,
        decayTicks: 3,
        modeLegal: ['pvp'],
        educationalTag: 'Perception is part of the move before execution becomes visible',
      },
      {
        id: 'GHOST_OFFER',
        name: 'Ghost Offer',
        deckType: 'BLUFF',
        baseCost: 1_500,
        baseEffect: {
          cashDelta: 3_500,
          namedActionId: 'DISGUISE_AS_MARKET_DUMP',
        },
        tags: ['sabotage', 'tempo', 'variance'],
        timingClass: ['ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'SOFT',
        targeting: 'OPPONENT',
        decisionTimerOverrideMs: null,
        decayTicks: 3,
        modeLegal: ['pvp'],
        educationalTag: 'The best feints win whether the opponent reacts or not',
      },
      {
        id: 'LIQUIDITY_WALL',
        name: 'Liquidity Wall',
        deckType: 'COUNTER',
        baseCost: 15,
        baseEffect: {
          shieldDelta: 8,
          namedActionId: 'BLOCK_MARKET_DUMP_AND_BOUNCE',
        },
        tags: ['counter', 'resilience', 'tempo'],
        timingClass: ['CTR'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['pvp'],
        educationalTag: 'Prepared liquidity is stronger than reactive panic',
      },
      {
        id: 'CREDIT_FREEZE',
        name: 'Credit Freeze',
        deckType: 'COUNTER',
        baseCost: 10,
        baseEffect: {
          shieldDelta: 6,
          namedActionId: 'BLOCK_CREDIT_PULL_AND_FREEZE_BB_GAIN',
        },
        tags: ['counter', 'tempo', 'precision'],
        timingClass: ['CTR'],
        rarity: 'COMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['pvp'],
        educationalTag: 'Defending credit is defending future optionality',
      },
      {
        id: 'EVIDENCE_FILE',
        name: 'Evidence File',
        deckType: 'COUNTER',
        baseCost: 20,
        baseEffect: {
          counterIntelDelta: 2,
          namedActionId: 'REDIRECT_AUDIT_BACK_TO_ATTACKER',
        },
        tags: ['counter', 'precision', 'tempo'],
        timingClass: ['CTR'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['pvp'],
        educationalTag: 'Documentation turns pressure back on its source',
      },
      {
        id: 'DEBT_SHIELD',
        name: 'Debt Shield',
        deckType: 'COUNTER',
        baseCost: 25,
        baseEffect: {
          debtDelta: -1,
          cashDelta: 2_000,
          namedActionId: 'FORGIVE_INJECTED_DEBT',
        },
        tags: ['counter', 'resilience', 'liquidity'],
        timingClass: ['CTR'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['pvp'],
        educationalTag: 'The balance sheet can absorb what the panic cannot',
      },
      {
        id: 'SIGNAL_CLEAR',
        name: 'Signal Clear',
        deckType: 'COUNTER',
        baseCost: 8,
        baseEffect: {
          counterIntelDelta: 1,
          namedActionId: 'NULLIFY_MISINFORMATION',
        },
        tags: ['counter', 'precision', 'tempo'],
        timingClass: ['CTR'],
        rarity: 'COMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 4,
        modeLegal: ['pvp'],
        educationalTag: 'Information clarity is a defensive weapon',
      },
      {
        id: 'SOVEREIGNTY_LOCK',
        name: 'Sovereignty Lock',
        deckType: 'COUNTER',
        baseCost: 0,
        baseEffect: {
          battleBudgetDelta: -30,
          namedActionId: 'FULL_BLOCK_HOSTILE_TAKEOVER',
        },
        tags: ['counter', 'resilience', 'precision'],
        timingClass: ['CTR'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 2,
        modeLegal: ['pvp'],
        educationalTag: 'An unblockable move is only unblockable until somebody prepared correctly',
      },
      {
        id: 'COUNTER_AUDIT',
        name: 'Counter Audit',
        deckType: 'COUNTER',
        baseCost: 12,
        baseEffect: {
          counterIntelDelta: 3,
          namedActionId: 'REVEAL_AND_STOP_SILENT_DRAIN',
        },
        tags: ['counter', 'precision', 'tempo'],
        timingClass: ['CTR', 'POST'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 4,
        modeLegal: ['pvp'],
        educationalTag: 'Audit is how invisible theft becomes visible evidence',
      },
      {
        id: 'FULL_BLOCK',
        name: 'Full Block',
        deckType: 'COUNTER',
        baseCost: 45,
        baseEffect: {
          shieldDelta: 10,
          namedActionId: 'UNIVERSAL_COUNTER_WINDOW_BLOCK',
        },
        tags: ['counter', 'resilience', 'tempo'],
        timingClass: ['CTR'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 2,
        modeLegal: ['pvp'],
        educationalTag: 'Universal defense is expensive because it replaces preparation with capital',
      },
    ];
  }

  private seedSyndicateCards(): CardDefinition[] {
    return [
      {
        id: 'BREAK_PACT',
        name: 'Break Pact',
        deckType: 'TRUST',
        baseCost: 0,
        baseEffect: {
          trustDelta: -5,
          namedActionId: 'DEFECTION_STEP_1',
        },
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
        baseEffect: {
          trustDelta: -10,
          namedActionId: 'DEFECTION_STEP_2',
        },
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
        baseEffect: {
          trustDelta: -20,
          treasuryDelta: -40,
          namedActionId: 'DEFECTION_STEP_3_EXECUTE',
        },
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
        id: 'LIQUIDITY_BRIDGE',
        name: 'Liquidity Bridge',
        deckType: 'AID',
        baseCost: 0,
        baseEffect: {
          treasuryDelta: -15_000,
          cashDelta: 15_000,
          trustDelta: 5,
          namedActionId: 'TRANSFER_LIQUIDITY_WITH_REPAYMENT',
        },
        tags: ['aid', 'trust', 'liquidity', 'resilience'],
        timingClass: ['AID', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 4,
        modeLegal: ['coop'],
        educationalTag: 'Every loan is a bet on both solvency and character',
      },
      {
        id: 'SHIELD_LOAN',
        name: 'Shield Loan',
        deckType: 'AID',
        baseCost: 0,
        baseEffect: {
          shieldDelta: 15,
          trustDelta: 8,
          namedActionId: 'TRANSFER_SHIELD_POINTS_TO_TEAMMATE',
        },
        tags: ['aid', 'trust', 'resilience', 'cascade'],
        timingClass: ['AID', 'RES'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 4,
        modeLegal: ['coop'],
        educationalTag: 'Collateral is your risk placed in somebody else’s crisis',
      },
      {
        id: 'EXPANSION_LEASE',
        name: 'Expansion Lease',
        deckType: 'AID',
        baseCost: 4_000,
        baseEffect: {
          incomeDelta: 2_800,
          trustDelta: 4,
          namedActionId: 'DUAL_PARTNER_GROWTH_IF_COMBO',
        },
        tags: ['aid', 'income', 'scale', 'trust'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 5_000,
        decayTicks: 5,
        modeLegal: ['coop'],
        educationalTag: 'Joint ventures amplify what isolated capital cannot',
      },
      {
        id: 'EMERGENCY_CAPITAL',
        name: 'Emergency Capital',
        deckType: 'RESCUE',
        baseCost: 0,
        baseEffect: {
          cashDelta: 8_000,
          trustDelta: 6,
          namedActionId: 'TEAMMATE_CRITICAL_CASH_RESCUE',
        },
        tags: ['aid', 'trust', 'liquidity', 'resilience'],
        timingClass: ['RES'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['coop'],
        educationalTag: 'The speed of rescue changes the size of the rescue',
      },
      {
        id: 'CASCADE_INTERRUPT',
        name: 'Cascade Interrupt',
        deckType: 'RESCUE',
        baseCost: 0,
        baseEffect: {
          trustDelta: 10,
          cascadeTag: 'TEAM_RESCUE_BREAK',
          namedActionId: 'BREAK_TEAMMATE_CASCADE',
        },
        tags: ['resilience', 'cascade', 'trust', 'aid'],
        timingClass: ['RES', 'CAS'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['coop'],
        educationalTag: 'Interrupting a chain early protects more than one balance sheet',
      },
      {
        id: 'SHIELD_EMERGENCY',
        name: 'Shield Emergency',
        deckType: 'RESCUE',
        baseCost: 0,
        baseEffect: {
          shieldDelta: 20,
          trustDelta: 12,
          namedActionId: 'INJECT_L4_TO_TEAMMATE',
        },
        tags: ['resilience', 'aid', 'trust'],
        timingClass: ['RES'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['coop'],
        educationalTag: 'Emergency defense is most valuable before the final breach lands',
      },
      {
        id: 'INCOME_INFUSION',
        name: 'Income Infusion',
        deckType: 'RESCUE',
        baseCost: 0,
        baseEffect: {
          incomeDelta: 2_000,
          trustDelta: 5,
          namedActionId: 'TRANSFER_TWO_TICKS_OF_INCOME',
        },
        tags: ['aid', 'income', 'trust', 'tempo'],
        timingClass: ['RES', 'AID'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['coop'],
        educationalTag: 'The shortest bridge between crises is recurring income',
      },
      {
        id: 'LOYALTY_SIGNAL',
        name: 'Loyalty Signal',
        deckType: 'TRUST',
        baseCost: 0,
        baseEffect: {
          trustDelta: 10,
          namedActionId: 'VOLUNTARY_TRUST_RAISE',
        },
        tags: ['trust'],
        timingClass: ['ANY'],
        rarity: 'COMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: null,
        decayTicks: 5,
        modeLegal: ['coop'],
        educationalTag: 'Relationship capital compounds long before it becomes visible',
      },
      {
        id: 'BETRAYAL_DETECTION',
        name: 'Betrayal Detection',
        deckType: 'TRUST',
        baseCost: 2_000,
        baseEffect: {
          counterIntelDelta: 3,
          namedActionId: 'EARLY_DEFECTION_RISK_ALERT',
        },
        tags: ['trust', 'precision', 'variance'],
        timingClass: ['ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 8,
        modeLegal: ['coop'],
        educationalTag: 'Information asymmetry is partnership defense',
      },
      {
        id: 'TREASURY_LOAN',
        name: 'Treasury Loan',
        deckType: 'AID',
        baseCost: 0,
        baseEffect: {
          treasuryDelta: -15_000,
          cashDelta: 15_000,
          trustDelta: 2,
          namedActionId: 'AUTO_REPAY_TEAM_TREASURY_LOAN',
        },
        tags: ['aid', 'trust', 'liquidity'],
        timingClass: ['AID', 'ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAMMATE',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 3,
        modeLegal: ['coop'],
        educationalTag: 'Shared treasury access is governance, not generosity',
      },
      {
        id: 'CASCADE_ABSORPTION',
        name: 'Cascade Absorption',
        deckType: 'RESCUE',
        baseCost: 0,
        baseEffect: {
          trustDelta: 15,
          namedActionId: 'ABSORB_CHAIN_FOR_TEAM',
          grantBadges: ['SHIELD_BEARER'],
        },
        tags: ['aid', 'trust', 'cascade', 'resilience'],
        timingClass: ['CAS', 'RES'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAM',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['coop'],
        educationalTag: 'Trust becomes visible when somebody carries the damage alone',
      },
      {
        id: 'PACT_RENEWAL',
        name: 'Pact Renewal',
        deckType: 'TRUST',
        baseCost: 1_000,
        baseEffect: {
          trustDelta: 12,
          namedActionId: 'RESET_DEFECTION_RISK_DECAY',
        },
        tags: ['trust', 'precision', 'tempo'],
        timingClass: ['ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'TEAM',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 5,
        modeLegal: ['coop'],
        educationalTag: 'Rebuilding trust is a deliberate action, not a sentiment',
      },
    ];
  }

  private seedPhantomCards(): CardDefinition[] {
    return [
      {
        id: 'MARKER_EXPLOIT',
        name: 'Marker Exploit',
        deckType: 'GHOST',
        baseCost: 0,
        baseEffect: {
          shieldDelta: 12,
          divergenceDelta: 0.06,
        },
        tags: ['divergence', 'precision', 'resilience'],
        timingClass: ['GBM'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 3,
        modeLegal: ['ghost'],
        educationalTag: 'Exploit the record where excellence cracked',
      },
      {
        id: 'COUNTER_LEGEND_LINE',
        name: 'Counter-Legend Line',
        deckType: 'GHOST',
        baseCost: 3_000,
        baseEffect: {
          incomeDelta: 400,
          divergenceDelta: 0.08,
          namedActionId: 'DRAW_ALTERNATIVE_GHOST_OPPORTUNITY',
        },
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
        baseEffect: {
          incomeDelta: 150,
          divergenceDelta: 0.04,
          grantBadges: ['SUPERIOR_DECISION'],
        },
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
        id: 'PRECISION_HOLD',
        name: 'Precision Hold',
        deckType: 'DISCIPLINE',
        baseCost: 0,
        baseEffect: {
          holdChargeDelta: 1,
          timeDeltaMs: 4_000,
          divergenceDelta: 0.03,
          namedActionId: 'TEMPORARY_DECISION_FREEZE',
        },
        tags: ['precision', 'tempo', 'divergence'],
        timingClass: ['PRE', 'GBM'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['ghost'],
        educationalTag: 'Patience is a precision tool, not a weakness',
      },
      {
        id: 'FUBAR_CHAMPION',
        name: 'FUBAR Champion',
        deckType: 'GHOST',
        baseCost: 0,
        baseEffect: {
          divergenceDelta: 0.05,
          grantBadges: ['FUBAR_CHAMPION'],
        },
        tags: ['divergence', 'precision', 'resilience'],
        timingClass: ['FATE', 'GBM'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 1,
        modeLegal: ['ghost'],
        educationalTag: 'Beating history after absorbing chaos is a different class of proof',
      },
      {
        id: 'CLEAN_RUN_OATH',
        name: 'Clean Run Oath',
        deckType: 'DISCIPLINE',
        baseCost: 0,
        baseEffect: {
          divergenceDelta: 0.02,
          grantBadges: ['CLEAN_RUN'],
          namedActionId: 'TRACK_ZERO_PRIVILEGE_RUN',
        },
        tags: ['precision', 'variance', 'divergence'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 5,
        modeLegal: ['ghost'],
        educationalTag: 'Skill proven without privilege is a more durable signal',
      },
      {
        id: 'MINIMALIST_LINE',
        name: 'Minimalist Line',
        deckType: 'DISCIPLINE',
        baseCost: 1_000,
        baseEffect: {
          divergenceDelta: 0.03,
          namedActionId: 'TRACK_FEWER_PLAYS_THAN_GHOST',
          grantBadges: ['MINIMALIST'],
        },
        tags: ['precision', 'tempo', 'divergence'],
        timingClass: ['PRE', 'ANY'],
        rarity: 'UNCOMMON',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: null,
        decayTicks: 5,
        modeLegal: ['ghost'],
        educationalTag: 'Efficiency is not lower output; it is higher signal per move',
      },
      {
        id: 'GHOST_SYNC',
        name: 'Ghost Sync',
        deckType: 'GHOST',
        baseCost: 0,
        baseEffect: {
          divergenceDelta: 0.05,
          namedActionId: 'TRACK_HIGH_DIVERGENCE_SYNC',
          grantBadges: ['GHOST_SYNCED'],
        },
        tags: ['divergence', 'precision', 'tempo'],
        timingClass: ['GBM', 'ANY'],
        rarity: 'RARE',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 3,
        modeLegal: ['ghost'],
        educationalTag: 'Pattern mastery requires matching the timeline before surpassing it',
      },
      {
        id: 'COMEBACK_LEGEND',
        name: 'Comeback Legend',
        deckType: 'GHOST',
        baseCost: 0,
        baseEffect: {
          cashDelta: 3_000,
          divergenceDelta: 0.07,
          grantBadges: ['COMEBACK_LEGEND'],
          namedActionId: 'TRACK_SUB_3K_RECOVERY_VS_GHOST',
        },
        tags: ['divergence', 'liquidity', 'precision', 'resilience'],
        timingClass: ['PSK', 'GBM'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 3_000,
        decayTicks: 2,
        modeLegal: ['ghost'],
        educationalTag: 'Recovery under a documented standard is stronger than recovery in isolation',
      },
      {
        id: 'PHANTOM_LEVERAGE',
        name: 'Phantom Leverage',
        deckType: 'GHOST',
        baseCost: 0,
        baseEffect: {
          divergenceDelta: 0.1,
          namedActionId: 'DYNASTY_GHOST_PASS_CHAIN',
          grantBadges: ['DYNASTY_WINDOW'],
        },
        tags: ['divergence', 'precision', 'scale'],
        timingClass: ['GBM', 'PRE'],
        rarity: 'LEGENDARY',
        autoResolve: false,
        counterability: 'NONE',
        targeting: 'SELF',
        decisionTimerOverrideMs: 4_000,
        decayTicks: 1,
        modeLegal: ['ghost'],
        educationalTag: 'Late-stage ghost leverage is earned, not granted',
      },
    ];
  }

  // ─── Overlay access ────────────────────────────────────────────────────────

  /**
   * Get the effective ModeOverlay for a card in a given mode.
   * Returns the card's mode-specific overlay if defined, or the canonical
   * DEFAULT_MODE_OVERLAY when the card has no mode patch for this mode.
   * Used by deck composition, testing, and AI planning systems.
   */
  public getEffectiveModeOverlay(card: CardDefinition, mode: ModeCode): Readonly<ModeOverlay> {
    if (!card.modeOverlay) {
      return DEFAULT_MODE_OVERLAY;
    }
    const patch = card.modeOverlay[mode];
    if (!patch) {
      return DEFAULT_MODE_OVERLAY;
    }
    return Object.freeze({
      costModifier: patch.costModifier ?? DEFAULT_MODE_OVERLAY.costModifier,
      effectModifier: patch.effectModifier ?? DEFAULT_MODE_OVERLAY.effectModifier,
      tagWeights: patch.tagWeights ? Object.freeze({ ...patch.tagWeights }) : DEFAULT_MODE_OVERLAY.tagWeights,
      timingLock: patch.timingLock ? Object.freeze([...patch.timingLock]) : DEFAULT_MODE_OVERLAY.timingLock,
      legal: patch.legal ?? DEFAULT_MODE_OVERLAY.legal,
      targetingOverride: patch.targetingOverride,
      divergencePotential: patch.divergencePotential,
    });
  }

  /**
   * Get the default mode overlay constants used when no patch is defined.
   * Exposed for overlay inspection tools, test harnesses, and AI planners.
   */
  public getDefaultModeOverlay(): Readonly<ModeOverlay> {
    return DEFAULT_MODE_OVERLAY;
  }

  /**
   * Build a map from mode → effective overlay for a single card.
   * Used by deck audit tools and the AI planner to understand how a card's
   * behavior shifts across all game modes.
   */
  public buildModeOverlayMap(card: CardDefinition): Readonly<Record<ModeCode, Readonly<ModeOverlay>>> {
    const result: Partial<Record<ModeCode, Readonly<ModeOverlay>>> = {};
    for (const mode of ALL_MODES) {
      result[mode] = this.getEffectiveModeOverlay(card, mode);
    }
    return Object.freeze(result as Record<ModeCode, Readonly<ModeOverlay>>);
  }

  // ─── Catalog summaries ─────────────────────────────────────────────────────

  /**
   * Build a comprehensive mode catalog summary for a single mode.
   * The UX catalog screen and AI planner call this to show per-mode card counts
   * and composition breakdowns.
   */
  public buildModeCatalogSummary(mode: ModeCode): ModeCatalogSummary {
    const cards = this.listByMode(mode);
    const byDeckType = buildEmptyDeckCountRecord();

    let legendaryCount = 0;
    let autoResolveCount = 0;
    let reactionWindowCount = 0;
    let phaseBoundaryCount = 0;
    let ghostWindowCount = 0;

    for (const card of cards) {
      byDeckType[card.deckType] = (byDeckType[card.deckType] ?? 0) + 1;
      if (card.rarity === 'LEGENDARY') legendaryCount++;
      if (card.autoResolve) autoResolveCount++;
      if (card.timingClass.some((t) => t === 'CTR' || t === 'RES' || t === 'FATE' || t === 'CAS' || t === 'PSK')) {
        reactionWindowCount++;
      }
      if (card.timingClass.includes('PHZ')) phaseBoundaryCount++;
      if (card.timingClass.includes('GBM')) ghostWindowCount++;
    }

    return Object.freeze({
      mode,
      totalCards: cards.length,
      byDeckType: Object.freeze(byDeckType),
      legendaryCount,
      autoResolveCount,
      reactionWindowCount,
      phaseBoundaryCount,
      ghostWindowCount,
    });
  }

  /**
   * Build catalog summaries for all modes at once.
   */
  public buildAllModeCatalogSummaries(): Readonly<Record<ModeCode, ModeCatalogSummary>> {
    const result: Partial<Record<ModeCode, ModeCatalogSummary>> = {};
    for (const mode of ALL_MODES) {
      result[mode] = this.buildModeCatalogSummary(mode);
    }
    return Object.freeze(result as Record<ModeCode, ModeCatalogSummary>);
  }

  /**
   * Compute full registry diagnostics.
   * Used by boot-time validation, CI health checks, and the admin panel.
   */
  public computeRegistryDiagnostics(): RegistryDiagnostics {
    const byMode = buildEmptyModeCountRecord();
    const byDeckType = buildEmptyDeckCountRecord();
    const byRarity = buildEmptyRarityCountRecord();
    const timingCoverage = buildEmptyTimingCountRecord();

    for (const card of this.orderedCards) {
      for (const mode of card.modeLegal) {
        byMode[mode] = (byMode[mode] ?? 0) + 1;
      }
      byDeckType[card.deckType] = (byDeckType[card.deckType] ?? 0) + 1;
      byRarity[card.rarity] = (byRarity[card.rarity] ?? 0) + 1;
      for (const timing of card.timingClass) {
        timingCoverage[timing] = (timingCoverage[timing] ?? 0) + 1;
      }
    }

    const sharedAcrossAllModes = this.listSharedAcrossAllModes().map((c) => c.id);
    const modeExclusiveIds: Partial<Record<ModeCode, readonly string[]>> = {};
    for (const mode of ALL_MODES) {
      modeExclusiveIds[mode] = freezeArray(this.listModeExclusive(mode).map((c) => c.id));
    }

    return Object.freeze({
      totalCards: this.orderedCards.length,
      byMode: Object.freeze(byMode),
      byDeckType: Object.freeze(byDeckType),
      byRarity: Object.freeze(byRarity),
      timingCoverage: Object.freeze(timingCoverage),
      sharedAcrossAllModes: freezeArray(sharedAcrossAllModes),
      modeExclusiveIds: Object.freeze(modeExclusiveIds as Record<ModeCode, readonly string[]>),
    });
  }

  // ─── Educational catalog ──────────────────────────────────────────────────

  /**
   * Build the educational catalog — all cards sorted by educational tag.
   * The learning system and onboarding flow use this to present cards in
   * pedagogically sequenced order rather than game-balance order.
   */
  public buildEducationalCatalog(): readonly CardEducationalEntry[] {
    const grouped = new Map<string, CardDefinition[]>();

    for (const card of this.orderedCards) {
      const tag = card.educationalTag;
      if (!grouped.has(tag)) grouped.set(tag, []);
      grouped.get(tag)!.push(card);
    }

    const entries: CardEducationalEntry[] = [];
    for (const [educationalTag, cards] of grouped) {
      entries.push(Object.freeze({
        educationalTag,
        cardCount: cards.length,
        cards: freezeArray(cards),
        modes: freezeArray(
          uniqueStrings(cards.flatMap((c) => c.modeLegal)) as ModeCode[],
        ),
        hasPrimer: cards.some((c) => c.autoResolve),
        topRarity: cards.reduce<CardRarity>((best, c) =>
          RARITY_ORDER[c.rarity] > RARITY_ORDER[best] ? c.rarity : best,
          'COMMON',
        ),
      }));
    }

    entries.sort((a, b) => a.educationalTag.localeCompare(b.educationalTag));
    return Object.freeze(entries);
  }

  // ─── Counter resolution ───────────────────────────────────────────────────

  /**
   * Resolve all counter options for a given card in a given mode.
   * Used by the PvP counter-window UX to show the opponent which cards can
   * counter an incoming play, and by the AI to plan counter responses.
   */
  public resolveCounterOptions(
    targetCard: CardDefinition,
    mode: ModeCode,
  ): readonly CardDefinition[] {
    if (targetCard.counterability === 'NONE') {
      return EMPTY_CARD_ARRAY;
    }

    const counterCandidates = this.listByModeAndDeck(mode, 'COUNTER');
    const results: CardDefinition[] = [];

    for (const counter of counterCandidates) {
      // Hard-counterable cards can be countered by any COUNTER deck card
      if (targetCard.counterability === 'HARD') {
        results.push(counter);
        continue;
      }
      // Soft-counterable cards need a HARD-counterability counter card
      if (targetCard.counterability === 'SOFT' && counter.counterability === 'HARD') {
        results.push(counter);
      }
    }

    return freezeArray(results);
  }

  /**
   * Check whether any counter card is available in the registry for a given
   * mode and target card. UX uses this to decide whether to show the counter
   * window prompt at all.
   */
  public hasCounterOption(targetCard: CardDefinition, mode: ModeCode): boolean {
    return this.resolveCounterOptions(targetCard, mode).length > 0;
  }

  // ─── Registry health report ───────────────────────────────────────────────

  /**
   * Build a full registry health report.
   * Used by the boot validator, CI checks, and the admin diagnostic panel.
   * Reports duplicate IDs, missing mode coverage, and orphaned timing classes.
   */
  public buildRegistryHealthReport(): RegistryHealthReport {
    const idSet = new Set<string>();
    const duplicateIds: string[] = [];
    const missingModeCoverage: string[] = [];
    const autoResolveWithDecay: string[] = [];
    const noTimingClass: string[] = [];

    for (const card of this.orderedCards) {
      if (idSet.has(card.id)) {
        duplicateIds.push(card.id);
      } else {
        idSet.add(card.id);
      }

      if (card.modeLegal.length === 0) {
        missingModeCoverage.push(card.id);
      }

      if (card.autoResolve && card.decayTicks !== null) {
        autoResolveWithDecay.push(card.id);
      }

      if (card.timingClass.length === 0) {
        noTimingClass.push(card.id);
      }
    }

    const healthy =
      duplicateIds.length === 0 &&
      missingModeCoverage.length === 0 &&
      noTimingClass.length === 0;

    return Object.freeze({
      totalCards: this.orderedCards.length,
      duplicateIds: freezeArray(duplicateIds),
      missingModeCoverage: freezeArray(missingModeCoverage),
      autoResolveWithDecay: freezeArray(autoResolveWithDecay),
      noTimingClass: freezeArray(noTimingClass),
      healthy,
      summary: healthy
        ? `Registry healthy — ${this.orderedCards.length} cards, zero issues.`
        : `Registry issues found: ${duplicateIds.length} duplicate IDs, ` +
          `${missingModeCoverage.length} missing mode coverage, ` +
          `${noTimingClass.length} missing timing class.`,
    });
  }

  // ─── Tag analysis ─────────────────────────────────────────────────────────

  /**
   * Build a tag frequency map across the full registry.
   * The AI planner uses this to weight tag-based scoring strategies.
   * The UX catalog uses this to show "popular tags" filters.
   */
  public buildTagFrequencyMap(): ReadonlyMap<string, number> {
    const freq = new Map<string, number>();
    for (const card of this.orderedCards) {
      for (const tag of card.tags) {
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
      }
    }
    return freq;
  }

  /**
   * List the most common tags across the registry, sorted descending by count.
   */
  public listTopTags(limit: number = 20): readonly string[] {
    const freq = this.buildTagFrequencyMap();
    const sorted = [...freq.entries()].sort(([, a], [, b]) => b - a);
    return freezeArray(sorted.slice(0, limit).map(([tag]) => tag));
  }

  /**
   * List all unique educational tags across the registry in alphabetical order.
   */
  public listEducationalTags(): readonly string[] {
    const tags = new Set<string>();
    for (const card of this.orderedCards) {
      tags.add(card.educationalTag);
    }
    return freezeArray([...tags].sort());
  }

  // ─── Mode-priority scoring ────────────────────────────────────────────────

  /**
   * Score a card for a given mode using the registry's mode deck priority + tag weight tables.
   * Scores are relative within a mode — higher means the card is more valuable in this mode.
   */
  public scoreCardForMode(card: CardDefinition, mode: ModeCode): number {
    return stableModePriority(card, mode) * -1 + stableTagWeight(card, mode);
  }

  /**
   * Sort a set of cards by mode-native score (descending — best for the mode first).
   */
  public sortCardsByModeScore(
    cards: readonly CardDefinition[],
    mode: ModeCode,
  ): readonly CardDefinition[] {
    return sortCardsForMode(mode, cards);
  }

  /**
   * Build a mode-score leaderboard for the full registry.
   * Returns the top N cards per mode, useful for deck-building defaults and AI seeding.
   */
  public buildModeScoreLeaderboard(
    mode: ModeCode,
    limit: number = 10,
  ): readonly CardDefinition[] {
    return this.sortCardsByModeScore(this.listByMode(mode), mode).slice(0, limit);
  }

  // ─── Numeric effect analysis ──────────────────────────────────────────────

  /**
   * Compute the net numeric effect budget for a card.
   * Sums all numeric effect fields using NUMERIC_EFFECT_KEYS and returns the
   * total delta. Used by the AI planner and by the resource planning UX.
   */
  public computeNumericEffectBudget(card: CardDefinition): number {
    let total = 0;
    for (const key of NUMERIC_EFFECT_KEYS) {
      const value = card.baseEffect[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        total += value;
      }
    }
    return total;
  }

  /**
   * Build the numeric effect profile for a card — a breakdown of each
   * quantified effect field. Used by the card detail panel and AI planner.
   */
  public buildNumericEffectProfile(card: CardDefinition): Readonly<Record<string, number>> {
    const profile: Record<string, number> = {};
    for (const key of NUMERIC_EFFECT_KEYS) {
      const value = card.baseEffect[key];
      if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
        profile[key] = value;
      }
    }
    return Object.freeze(profile);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Exported types for new public APIs
// ═════════════════════════════════════════════════════════════════════════════

export interface CardEducationalEntry {
  readonly educationalTag: string;
  readonly cardCount: number;
  readonly cards: readonly CardDefinition[];
  readonly modes: readonly ModeCode[];
  readonly hasPrimer: boolean;
  readonly topRarity: CardRarity;
}

export interface RegistryHealthReport {
  readonly totalCards: number;
  readonly duplicateIds: readonly string[];
  readonly missingModeCoverage: readonly string[];
  readonly autoResolveWithDecay: readonly string[];
  readonly noTimingClass: readonly string[];
  readonly healthy: boolean;
  readonly summary: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Module-level utility functions (use all imported types)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Get a card from any CardBucketIndex by key, with EMPTY_CARD_ARRAY fallback.
 * Used by external consumers that hold a reference to a registry index.
 */
export function getBucketEntries<K extends string>(
  bucket: CardBucketIndex<K>,
  key: K,
): readonly CardDefinition[] {
  return bucket.get(key) ?? EMPTY_CARD_ARRAY;
}

/**
 * Check whether a string is a valid ModeCode.
 */
export function isValidModeCode(value: string): value is ModeCode {
  return isModeCode(value);
}

/**
 * Check whether a string is a valid TimingClass.
 */
export function isValidTimingClass(value: string): value is TimingClass {
  return isTimingClass(value);
}

/**
 * Check whether a string is a valid DeckType.
 */
export function isValidDeckType(value: string): value is DeckType {
  return isDeckType(value);
}

/**
 * Check whether a string is a valid CardRarity.
 */
export function isValidCardRarity(value: string): value is CardRarity {
  return isRarity(value);
}

/**
 * Check whether a string is a valid Targeting.
 */
export function isValidTargeting(value: string): value is Targeting {
  return isTargeting(value);
}

/**
 * Check whether a string is a valid Counterability.
 */
export function isValidCounterability(value: string): value is Counterability {
  return isCounterability(value);
}

/**
 * List all valid mode codes.
 */
export function listAllModeCodes(): readonly ModeCode[] {
  return ALL_MODES;
}

/**
 * List all valid timing classes.
 */
export function listAllTimingClasses(): readonly TimingClass[] {
  return ALL_TIMING_CLASSES;
}

/**
 * List all valid deck types.
 */
export function listAllDeckTypes(): readonly DeckType[] {
  return ALL_DECK_TYPES;
}

/**
 * List all valid card rarities.
 */
export function listAllCardRarities(): readonly CardRarity[] {
  return ALL_RARITIES;
}

/**
 * List all valid targeting values.
 */
export function listAllTargetingValues(): readonly Targeting[] {
  return ALL_TARGETING;
}

/**
 * List all valid counterability values.
 */
export function listAllCounterabilityValues(): readonly Counterability[] {
  return ALL_COUNTERABILITIES;
}

/**
 * Get the rarity sort order for a card rarity.
 * Higher = more rare. LEGENDARY=4, RARE=3, UNCOMMON=2, COMMON=1.
 */
export function getRarityOrder(rarity: CardRarity): number {
  return RARITY_ORDER[rarity] ?? 0;
}

/**
 * Compare two card rarities. Returns positive if a > b (a is rarer).
 */
export function compareCardRarity(a: CardRarity, b: CardRarity): number {
  return RARITY_ORDER[a] - RARITY_ORDER[b];
}

/**
 * Get the default mode overlay constants.
 * Used by external audit tools that need the baseline overlay state.
 */
export function getDefaultModeOverlayConstants(): Readonly<ModeOverlay> {
  return DEFAULT_MODE_OVERLAY;
}

/**
 * Check whether a card's numeric effect field has any non-zero values.
 */
export function cardHasNumericEffects(card: CardDefinition): boolean {
  for (const key of NUMERIC_EFFECT_KEYS) {
    const value = card.baseEffect[key];
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether a card value at a given numeric effect field is non-zero.
 */
export function getCardNumericEffect(
  card: CardDefinition,
  key: (typeof NUMERIC_EFFECT_KEYS)[number],
): number {
  const value = card.baseEffect[key];
  return typeof value === 'number' && isFiniteNumber(value) ? value : 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// Module Authority Object
// ═════════════════════════════════════════════════════════════════════════════

export const CARD_REGISTRY_MODULE_ID = 'backend.engine.cards.CardRegistry' as const;
export const CARD_REGISTRY_MODULE_VERSION = '2.0.0' as const;

export const CARD_REGISTRY_MODULE_AUTHORITY = Object.freeze({
  moduleId: CARD_REGISTRY_MODULE_ID,
  version: CARD_REGISTRY_MODULE_VERSION,

  CardRegistry: 'class',

  // Exported types
  CardQuery: 'interface',
  ModeCatalogSummary: 'interface',
  RegistryDiagnostics: 'interface',
  CardEducationalEntry: 'interface',
  RegistryHealthReport: 'interface',

  // Module constants
  CARD_REGISTRY_MODULE_ID: 'const',
  CARD_REGISTRY_MODULE_VERSION: 'const',
  CARD_REGISTRY_MODULE_AUTHORITY: 'const',

  // Utility functions
  getBucketEntries: 'function',
  isValidModeCode: 'function',
  isValidTimingClass: 'function',
  isValidDeckType: 'function',
  isValidCardRarity: 'function',
  isValidTargeting: 'function',
  isValidCounterability: 'function',
  listAllModeCodes: 'function',
  listAllTimingClasses: 'function',
  listAllDeckTypes: 'function',
  listAllCardRarities: 'function',
  listAllTargetingValues: 'function',
  listAllCounterabilityValues: 'function',
  getRarityOrder: 'function',
  compareCardRarity: 'function',
  getDefaultModeOverlayConstants: 'function',
  cardHasNumericEffects: 'function',
  getCardNumericEffect: 'function',
} as const);
