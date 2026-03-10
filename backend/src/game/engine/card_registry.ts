// backend/src/game/engine/card_registry.ts

import { createHash } from 'node:crypto';
import {
  CardEffectOp,
  CardRarity,
  CardTag,
  Counterability,
  DeckType,
  type CardDefinition,
  type CardInHand,
  type CardOverlaySnapshot,
  type CurrencyType,
  type ExecutionContext,
  GameMode,
  type ModeCode,
  MODE_CODE_MAP,
  type ModeOverlay,
  Targeting,
  TimingClass,
  resolveCurrencyForCard,
  round6,
} from './card_types';
import { ModeOverlayEngine } from './mode_overlay_engine';

/**
 * POINT ZERO ONE — BACKEND CARD REGISTRY
 * backend/src/game/engine/card_registry.ts
 *
 * Responsibilities:
 * - Authoritative in-memory catalog of backend card definitions.
 * - Deterministic card draw / selection from seed + tick + mode + exclusions.
 * - Runtime card instancing through ModeOverlayEngine at draw-time.
 * - Shared deck utilities for HEAD_TO_HEAD and role/mode filtering for TEAM_UP.
 *
 * This file is intentionally backend-safe and dependency-light.
 */

export interface CardRegistryFilter {
  readonly mode?: GameMode;
  readonly deckTypes?: readonly DeckType[];
  readonly tags?: readonly CardTag[];
  readonly includeLegendary?: boolean;
  readonly includeAutoResolve?: boolean;
  readonly rarity?: readonly CardRarity[];
  readonly educationalTags?: readonly string[];
  readonly excludeCardIds?: readonly string[];
  readonly maxBaseCost?: number;
  readonly onlyTimingClasses?: readonly TimingClass[];
}

export interface CardDrawOptions {
  readonly filter?: CardRegistryFilter;
  readonly runtimeOverlay?: CardOverlaySnapshot;
  readonly excludedIds?: readonly string[];
  readonly forcedCardIds?: readonly string[];
}

export interface DeterministicDrawInput {
  readonly mode: GameMode;
  readonly seed: string;
  readonly tickIndex: number;
  readonly drawIndex?: number;
  readonly context?: ExecutionContext;
  readonly options?: CardDrawOptions;
}

export interface SharedDeckBuildInput {
  readonly seed: string;
  readonly mode: GameMode;
  readonly size: number;
  readonly includeDeckTypes?: readonly DeckType[];
  readonly excludeCardIds?: readonly string[];
}

export interface CardCatalogStats {
  readonly total: number;
  readonly byDeck: Readonly<Record<DeckType, number>>;
  readonly byMode: Readonly<Record<GameMode, number>>;
  readonly legendaries: number;
}

function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hashToUnitFloat(input: string): number {
  const hash = stableHash(input);
  const slice = hash.slice(0, 12);
  const value = parseInt(slice, 16);
  return value / 0xffffffffffff;
}

function deterministicSortKey(...parts: readonly Array<string | number>): string {
  return stableHash(parts.join('|'));
}

function rarityWeight(rarity: CardRarity): number {
  switch (rarity) {
    case CardRarity.COMMON:
      return 100;
    case CardRarity.UNCOMMON:
      return 35;
    case CardRarity.RARE:
      return 10;
    case CardRarity.LEGENDARY:
      return 1;
    default:
      return 1;
  }
}

function pickDeterministically<T>(
  items: readonly T[],
  score: (item: T) => number,
  seed: string,
): T | null {
  if (items.length === 0) {
    return null;
  }

  const total = items.reduce((sum, item) => sum + Math.max(score(item), 0), 0);
  if (total <= 0) {
    return items[0] ?? null;
  }

  const roll = hashToUnitFloat(seed) * total;
  let cursor = 0;

  for (const item of items) {
    cursor += Math.max(score(item), 0);
    if (roll <= cursor) {
      return item;
    }
  }

  return items[items.length - 1] ?? null;
}

function includesAny<T>(source: readonly T[], sought?: readonly T[]): boolean {
  if (!sought || sought.length === 0) {
    return true;
  }

  return sought.some((entry) => source.includes(entry));
}

function hasAll<T>(source: readonly T[], sought?: readonly T[]): boolean {
  if (!sought || sought.length === 0) {
    return true;
  }

  return sought.every((entry) => source.includes(entry));
}

function normalizeExcluded(
  first?: readonly string[],
  second?: readonly string[],
): Set<string> {
  const excluded = new Set<string>();
  for (const value of first ?? []) {
    excluded.add(value);
  }
  for (const value of second ?? []) {
    excluded.add(value);
  }
  return excluded;
}

export class CardRegistry {
  private readonly definitions = new Map<string, CardDefinition>();

  public constructor(initialDefinitions: readonly CardDefinition[] = DEFAULT_CARD_DEFINITIONS) {
    this.registerMany(initialDefinitions);
  }

  public register(definition: CardDefinition): void {
    if (this.definitions.has(definition.cardId)) {
      throw new Error(`Card '${definition.cardId}' is already registered.`);
    }

    this.definitions.set(definition.cardId, Object.freeze({ ...definition }));
  }

  public upsert(definition: CardDefinition): void {
    this.definitions.set(definition.cardId, Object.freeze({ ...definition }));
  }

  public registerMany(definitions: readonly CardDefinition[]): void {
    for (const definition of definitions) {
      this.upsert(definition);
    }
  }

  public has(cardId: string): boolean {
    return this.definitions.has(cardId);
  }

  public get(cardId: string): CardDefinition | undefined {
    return this.definitions.get(cardId);
  }

  public getOrThrow(cardId: string): CardDefinition {
    const card = this.get(cardId);
    if (!card) {
      throw new Error(`Unknown card '${cardId}'.`);
    }
    return card;
  }

  public listAll(): CardDefinition[] {
    return [...this.definitions.values()].sort((left, right) =>
      left.cardId.localeCompare(right.cardId),
    );
  }

  public listByMode(mode: GameMode): CardDefinition[] {
    return this.listAll().filter((definition) => this.isLegalInMode(definition, mode));
  }

  public listByFilter(filter: CardRegistryFilter = {}): CardDefinition[] {
    const excluded = normalizeExcluded(filter.excludeCardIds);

    return this.listAll().filter((definition) => {
      if (excluded.has(definition.cardId)) {
        return false;
      }

      if (filter.mode && !this.isLegalInMode(definition, filter.mode)) {
        return false;
      }

      if (filter.deckTypes && filter.deckTypes.length > 0 && !filter.deckTypes.includes(definition.deckType)) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0 && !hasAll(definition.tags, filter.tags)) {
        return false;
      }

      if (filter.includeLegendary === false && definition.rarity === CardRarity.LEGENDARY) {
        return false;
      }

      if (filter.includeAutoResolve === false && definition.autoResolve) {
        return false;
      }

      if (filter.rarity && filter.rarity.length > 0 && !filter.rarity.includes(definition.rarity)) {
        return false;
      }

      if (
        filter.educationalTags &&
        filter.educationalTags.length > 0 &&
        !definition.educationalTag
      ) {
        return false;
      }

      if (
        filter.educationalTags &&
        filter.educationalTags.length > 0 &&
        definition.educationalTag &&
        !filter.educationalTags.includes(definition.educationalTag)
      ) {
        return false;
      }

      if (
        typeof filter.maxBaseCost === 'number' &&
        definition.baseCost > filter.maxBaseCost
      ) {
        return false;
      }

      if (
        filter.onlyTimingClasses &&
        filter.onlyTimingClasses.length > 0 &&
        !includesAny(definition.timingClasses, filter.onlyTimingClasses)
      ) {
        return false;
      }

      return true;
    });
  }

  public isLegalInMode(definition: CardDefinition, mode: GameMode): boolean {
    return definition.modeLegal ? definition.modeLegal.includes(mode) : true;
  }

  public instantiateCard(
    cardId: string,
    mode: GameMode,
    drawnAtTick: number,
    context?: ExecutionContext,
    runtimeOverlay?: CardOverlaySnapshot,
  ): CardInHand | null {
    const definition = this.getOrThrow(cardId);
    const overlayEngine = new ModeOverlayEngine(mode);

    return overlayEngine.applyOverlay(definition, drawnAtTick, context, {
      runtimeOverlay,
    });
  }

  public drawDefinition(input: DeterministicDrawInput): CardDefinition | null {
    const filter = input.options?.filter ?? {};
    const excluded = normalizeExcluded(filter.excludeCardIds, input.options?.excludedIds);

    const forcedIds = input.options?.forcedCardIds ?? [];
    if (forcedIds.length > 0) {
      const forcedCandidates = forcedIds
        .map((cardId) => this.get(cardId))
        .filter((definition): definition is CardDefinition => Boolean(definition))
        .filter((definition) => !excluded.has(definition.cardId))
        .filter((definition) => !filter.mode || this.isLegalInMode(definition, input.mode))
        .sort((left, right) => left.cardId.localeCompare(right.cardId));

      if (forcedCandidates.length > 0) {
        const pick = pickDeterministically(
          forcedCandidates,
          (definition) => rarityWeight(definition.rarity),
          deterministicSortKey(
            input.seed,
            input.mode,
            input.tickIndex,
            input.drawIndex ?? 0,
            'forced',
          ),
        );

        return pick;
      }
    }

    const candidates = this.listByFilter({
      ...filter,
      mode: input.mode,
      excludeCardIds: [...excluded],
    });

    if (candidates.length === 0) {
      return null;
    }

    const sorted = [...candidates].sort((left, right) =>
      deterministicSortKey(
        input.seed,
        input.mode,
        input.tickIndex,
        input.drawIndex ?? 0,
        left.cardId,
      ).localeCompare(
        deterministicSortKey(
          input.seed,
          input.mode,
          input.tickIndex,
          input.drawIndex ?? 0,
          right.cardId,
        ),
      ),
    );

    return pickDeterministically(
      sorted,
      (definition) => rarityWeight(definition.rarity),
      deterministicSortKey(
        input.seed,
        input.mode,
        input.tickIndex,
        input.drawIndex ?? 0,
        'pick',
      ),
    );
  }

  public drawCard(input: DeterministicDrawInput): CardInHand | null {
    const definition = this.drawDefinition(input);
    if (!definition) {
      return null;
    }

    return this.instantiateCard(
      definition.cardId,
      input.mode,
      input.tickIndex,
      input.context,
      input.options?.runtimeOverlay,
    );
  }

  public buildSharedDeck(input: SharedDeckBuildInput): string[] {
    const definitions = this.listByFilter({
      mode: input.mode,
      deckTypes: input.includeDeckTypes ?? [DeckType.OPPORTUNITY],
      includeLegendary: true,
      excludeCardIds: input.excludeCardIds,
    });

    const ordered = [...definitions].sort((left, right) =>
      deterministicSortKey(input.seed, input.mode, left.cardId).localeCompare(
        deterministicSortKey(input.seed, input.mode, right.cardId),
      ),
    );

    const chosen: string[] = [];
    for (const definition of ordered) {
      if (chosen.length >= input.size) {
        break;
      }
      chosen.push(definition.cardId);
    }

    return chosen;
  }

  public getCatalogStats(): CardCatalogStats {
    const byDeck: Record<DeckType, number> = {
      [DeckType.OPPORTUNITY]: 0,
      [DeckType.IPA]: 0,
      [DeckType.FUBAR]: 0,
      [DeckType.MISSED_OPPORTUNITY]: 0,
      [DeckType.PRIVILEGED]: 0,
      [DeckType.SO]: 0,
      [DeckType.SABOTAGE]: 0,
      [DeckType.COUNTER]: 0,
      [DeckType.AID]: 0,
      [DeckType.RESCUE]: 0,
      [DeckType.DISCIPLINE]: 0,
      [DeckType.TRUST]: 0,
      [DeckType.BLUFF]: 0,
      [DeckType.GHOST]: 0,
    };

    const byMode: Record<GameMode, number> = {
      [GameMode.GO_ALONE]: 0,
      [GameMode.HEAD_TO_HEAD]: 0,
      [GameMode.TEAM_UP]: 0,
      [GameMode.CHASE_A_LEGEND]: 0,
    };

    let legendaries = 0;

    for (const definition of this.definitions.values()) {
      byDeck[definition.deckType] += 1;

      for (const mode of Object.values(GameMode)) {
        if (this.isLegalInMode(definition, mode)) {
          byMode[mode] += 1;
        }
      }

      if (definition.rarity === CardRarity.LEGENDARY) {
        legendaries += 1;
      }
    }

    return {
      total: this.definitions.size,
      byDeck,
      byMode,
      legendaries,
    };
  }

  public static resolveModeFromCode(code: ModeCode): GameMode {
    return MODE_CODE_MAP[code];
  }
}

function allModes(): readonly GameMode[] {
  return [
    GameMode.GO_ALONE,
    GameMode.HEAD_TO_HEAD,
    GameMode.TEAM_UP,
    GameMode.CHASE_A_LEGEND,
  ] as const;
}

function baseLegendaryOverlay(): Readonly<Partial<Record<GameMode, Partial<ModeOverlay>>>> {
  return {
    [GameMode.GO_ALONE]: {
      cordWeight: 1.15,
    },
    [GameMode.HEAD_TO_HEAD]: {
      cordWeight: 1.1,
    },
    [GameMode.TEAM_UP]: {
      cordWeight: 1.12,
    },
    [GameMode.CHASE_A_LEGEND]: {
      cordWeight: 1.25,
    },
  };
}

export const DEFAULT_CARD_DEFINITIONS: readonly CardDefinition[] = Object.freeze([
  {
    cardId: 'opp_digital_revenue_stream_001',
    name: 'Digital Revenue Stream',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 8500,
    effects: [{ op: CardEffectOp.INCOME_DELTA, magnitude: 1800 }],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'cashflow > paper gains',
  },
  {
    cardId: 'opp_distressed_asset_acquisition_001',
    name: 'Distressed Asset Acquisition',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 14000,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 2500 },
      { op: CardEffectOp.INCOME_DELTA, magnitude: 900 },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.RESILIENCE],
    timingClasses: [TimingClass.PRE, TimingClass.PHZ, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'buy pain when others panic',
  },
  {
    cardId: 'ipa_licensing_deal_001',
    name: 'Licensing Deal',
    deckType: DeckType.IPA,
    baseCost: 12000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: 2200 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 2 },
    ],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.PRECISION],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'license instead of labor',
  },
  {
    cardId: 'priv_network_call_001',
    name: 'Network Call',
    deckType: DeckType.PRIVILEGED,
    baseCost: 18000,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 9000 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 8 },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.HEAT, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.PSK],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'your network is your net worth',
  },
  {
    cardId: 'so_compliance_maze_001',
    name: 'Compliance Maze',
    deckType: DeckType.SO,
    baseCost: 6500,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 10 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: -3 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.PRECISION],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'systems reward the prepared',
  },
  {
    cardId: 'fubar_tax_lien_001',
    name: 'Tax Lien',
    deckType: DeckType.FUBAR,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: -7000 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 6 },
    ],
    tags: [CardTag.HEAT, CardTag.CASCADE],
    timingClasses: [TimingClass.FATE],
    rarity: CardRarity.COMMON,
    autoResolve: true,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'forced pain compounds when ignored',
  },
  {
    cardId: 'missed_overpriced_hype_001',
    name: 'Overpriced Hype',
    deckType: DeckType.MISSED_OPPORTUNITY,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: -0.02 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 2 },
    ],
    tags: [CardTag.VARIANCE, CardTag.PRECISION],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'opportunity cost is real',
  },

  // HEAD TO HEAD — SABOTAGE / COUNTER / BLUFF

  {
    cardId: 'sab_market_dump_001',
    name: 'Market Dump',
    deckType: DeckType.SABOTAGE,
    baseCost: 30,
    effects: [{ op: CardEffectOp.EXPENSE_DELTA, magnitude: 300 }],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.INCOME],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'control perceived value',
  },
  {
    cardId: 'sab_debt_injection_001',
    name: 'Debt Injection',
    deckType: DeckType.SABOTAGE,
    baseCost: 40,
    effects: [
      {
        op: CardEffectOp.INJECT_CARD,
        magnitude: 1,
        metadata: { cardId: 'fubar_debt_card_001' },
      },
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: 12 },
    ],
    tags: [CardTag.SABOTAGE, CardTag.CASCADE, CardTag.TEMPO],
    timingClasses: [TimingClass.PRE, TimingClass.PSK],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'debt is a weapon when deployed externally',
  },
  {
    cardId: 'sab_chain_rumor_001',
    name: 'Chain Rumor',
    deckType: DeckType.SABOTAGE,
    baseCost: 15,
    effects: [{ op: CardEffectOp.INCOME_DELTA, magnitude: -25 }],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.MOMENTUM],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'small pressure compounds',
  },
  {
    cardId: 'sab_media_blitz_001',
    name: 'Media Blitz',
    deckType: DeckType.SABOTAGE,
    baseCost: 35,
    effects: [
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'next_sabotage_x2_3ticks' },
      },
    ],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.VARIANCE],
    timingClasses: [TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'preparation multiplies execution',
  },
  {
    cardId: 'sab_hostile_takeover_001',
    name: 'Hostile Takeover',
    deckType: DeckType.SABOTAGE,
    baseCost: 60,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: -50 },
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'permanent_best_asset_half_value' },
      },
    ],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.SCALE],
    timingClasses: [TimingClass.PSK, TimingClass.ANY],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'largest attacks are permanent, not loud',
    modeOverlays: baseLegendaryOverlay(),
  },
  {
    cardId: 'ctr_liquidity_wall_001',
    name: 'Liquidity Wall',
    deckType: DeckType.COUNTER,
    baseCost: 18,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 18 },
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'blocked_market_dump' },
      },
    ],
    tags: [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.LIQUIDITY],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'defense is economical',
  },
  {
    cardId: 'ctr_credit_freeze_001',
    name: 'Credit Freeze',
    deckType: DeckType.COUNTER,
    baseCost: 12,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 8 },
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'blocked_credit_pull' },
      },
    ],
    tags: [CardTag.COUNTER, CardTag.PRECISION],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'prepare the file before the audit',
  },
  {
    cardId: 'ctr_evidence_file_001',
    name: 'Evidence File',
    deckType: DeckType.COUNTER,
    baseCost: 20,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 10 },
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'blocked_regulatory_filing' },
      },
    ],
    tags: [CardTag.COUNTER, CardTag.RESILIENCE],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'paperwork is armor',
  },
  {
    cardId: 'ctr_signal_clear_001',
    name: 'Signal Clear',
    deckType: DeckType.COUNTER,
    baseCost: 15,
    effects: [
      {
        op: CardEffectOp.STATUS_REMOVE,
        magnitude: 1,
        metadata: { status: 'misinformation_flood' },
      },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 6 },
    ],
    tags: [CardTag.COUNTER, CardTag.PRECISION],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'clear signal beats panic',
  },
  {
    cardId: 'ctr_debt_shield_001',
    name: 'Debt Shield',
    deckType: DeckType.COUNTER,
    baseCost: 24,
    effects: [
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: -12 },
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'blocked_debt_injection' },
      },
    ],
    tags: [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.CASCADE],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'protect the balance sheet before it compounds',
  },
  {
    cardId: 'bluff_mirror_buyback_001',
    name: 'Mirror Buyback',
    deckType: DeckType.BLUFF,
    baseCost: 5000,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 3500 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: -2 },
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'appears_as_sabotage_to_opponent' },
      },
    ],
    tags: [CardTag.TEMPO, CardTag.VARIANCE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.POST],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'deception changes timing quality',
  },

  // TEAM UP — AID / RESCUE / TRUST

  {
    cardId: 'aid_liquidity_bridge_001',
    name: 'Liquidity Bridge',
    deckType: DeckType.AID,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.TREASURY_DELTA, magnitude: -10000 },
      { op: CardEffectOp.CASH_DELTA, magnitude: 10000 },
      { op: CardEffectOp.TRUST_DELTA, magnitude: 5 },
    ],
    tags: [CardTag.AID, CardTag.TRUST, CardTag.LIQUIDITY, CardTag.RESILIENCE],
    timingClasses: [TimingClass.AID, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'liquidity > vanity',
  },
  {
    cardId: 'aid_shield_loan_001',
    name: 'Shield Loan',
    deckType: DeckType.AID,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 15 },
      { op: CardEffectOp.TRUST_DELTA, magnitude: 8 },
    ],
    tags: [CardTag.AID, CardTag.TRUST, CardTag.RESILIENCE, CardTag.CASCADE],
    timingClasses: [TimingClass.AID, TimingClass.RES],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'collateral is your skin in their game',
  },
  {
    cardId: 'aid_expansion_lease_001',
    name: 'Expansion Lease',
    deckType: DeckType.AID,
    baseCost: 4000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: 1200 },
      { op: CardEffectOp.TRUST_DELTA, magnitude: 3 },
    ],
    tags: [CardTag.AID, CardTag.INCOME, CardTag.SCALE, CardTag.TRUST],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'joint ventures outperform solo risk',
  },
  {
    cardId: 'rescue_emergency_capital_001',
    name: 'Emergency Capital',
    deckType: DeckType.RESCUE,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.TREASURY_DELTA, magnitude: -12000 },
      { op: CardEffectOp.CASH_DELTA, magnitude: 12000 },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 12 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.AID, CardTag.TRUST],
    timingClasses: [TimingClass.RES],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'rescue speed matters more than rescue intent',
  },
  {
    cardId: 'trust_loyalty_signal_001',
    name: 'Loyalty Signal',
    deckType: DeckType.TRUST,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.TRUST_DELTA, magnitude: 10 },
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'loyalty_bonus_3ticks' },
      },
    ],
    tags: [CardTag.TRUST, CardTag.AID, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.POST],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'trust compounds when it is visible',
  },

  // SOLO / PHANTOM — DISCIPLINE / GHOST

  {
    cardId: 'disc_iron_discipline_001',
    name: 'Iron Discipline',
    deckType: DeckType.DISCIPLINE,
    baseCost: 5000,
    effects: [
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'forced_cards_second_best_4run' },
      },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.02 },
    ],
    tags: [CardTag.PRECISION, CardTag.RESILIENCE, CardTag.VARIANCE],
    timingClasses: [TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.GO_ALONE, GameMode.CHASE_A_LEGEND],
    educationalTag: 'professional downside control beats heroism',
  },
  {
    cardId: 'disc_precision_hold_001',
    name: 'Precision Hold',
    deckType: DeckType.DISCIPLINE,
    baseCost: 0,
    effects: [
      {
        op: CardEffectOp.TIMER_FREEZE,
        magnitude: 4,
      },
    ],
    tags: [CardTag.PRECISION, CardTag.TEMPO, CardTag.DIVERGENCE],
    timingClasses: [TimingClass.PRE, TimingClass.GBM],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.CHASE_A_LEGEND],
    educationalTag: 'patience is a precision tool',
  },
  {
    cardId: 'ghost_pass_exploit_001',
    name: 'Ghost Pass',
    deckType: DeckType.GHOST,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.04 },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 12 },
    ],
    tags: [CardTag.DIVERGENCE, CardTag.PRECISION, CardTag.RESILIENCE],
    timingClasses: [TimingClass.GBM],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.GHOST,
    modeLegal: [GameMode.CHASE_A_LEGEND],
    educationalTag: 'play near markers to earn difference',
  },

  // ALL-MODE LEGENDARIES

  {
    cardId: 'leg_sovereign_leverage_001',
    name: 'Sovereign Leverage',
    deckType: DeckType.PRIVILEGED,
    baseCost: 20000,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 10000 },
      { op: CardEffectOp.INCOME_DELTA, magnitude: 2500 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.03 },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.PHZ, TimingClass.GBM],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'leverage is a tool, not a trait',
    modeOverlays: {
      ...baseLegendaryOverlay(),
      [GameMode.HEAD_TO_HEAD]: {
        currencyOverride: 'battle_budget' as CurrencyType,
        cordWeight: 1.12,
      },
      [GameMode.TEAM_UP]: {
        targetingOverride: Targeting.TEAMMATE,
        cordWeight: 1.14,
      },
    },
  },
  {
    cardId: 'leg_systemic_override_001',
    name: 'Systemic Override',
    deckType: DeckType.PRIVILEGED,
    baseCost: 16000,
    effects: [
      { op: CardEffectOp.HEAT_DELTA, magnitude: -100 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.025 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.PRECISION, CardTag.HEAT],
    timingClasses: [TimingClass.ANY, TimingClass.CAS, TimingClass.PSK],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'reset pressure before building again',
    modeOverlays: baseLegendaryOverlay(),
  },
  {
    cardId: 'leg_cascade_break_001',
    name: 'Cascade Break',
    deckType: DeckType.SO,
    baseCost: 9000,
    effects: [
      {
        op: CardEffectOp.STATUS_REMOVE,
        magnitude: 1,
        metadata: { status: 'all_active_cascade_chains' },
      },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 18 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.02 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.CASCADE, CardTag.PRECISION],
    timingClasses: [TimingClass.CAS, TimingClass.ANY],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'intercept the chain before it compounds',
    modeOverlays: {
      ...baseLegendaryOverlay(),
      [GameMode.TEAM_UP]: {
        effectModifier: 1.2,
      },
    },
  },
  {
    cardId: 'leg_time_debt_paid_001',
    name: 'Time Debt Paid',
    deckType: DeckType.PRIVILEGED,
    baseCost: 10000,
    effects: [
      {
        op: CardEffectOp.STATUS_ADD,
        magnitude: 1,
        metadata: { status: 'add_90_seconds' },
      },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.015 },
    ],
    tags: [CardTag.MOMENTUM, CardTag.RESILIENCE, CardTag.PRECISION],
    timingClasses: [TimingClass.END, TimingClass.ANY],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'time can be purchased, but never cheaply',
    modeOverlays: baseLegendaryOverlay(),
  },
] as const);