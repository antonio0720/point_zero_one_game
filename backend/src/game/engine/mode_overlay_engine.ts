// backend/src/game/engine/mode_overlay_engine.ts

/**
 * POINT ZERO ONE — BACKEND MODE OVERLAY ENGINE
 * backend/src/game/engine/mode_overlay_engine.ts
 *
 * Applies doctrine-native mode overlays at draw time.
 * The base card definition remains immutable. Runtime behavior mutates here.
 */

import {
  CardRarity,
  CardTag,
  Counterability,
  DeckType,
  type CardDefinition,
  type CardInHand,
  type CardOverlaySnapshot,
  type CurrencyType,
  DEFAULT_MODE_OVERLAYS,
  type ExecutionContext,
  GameMode,
  type ModeOverlay,
  TimingClass,
  clamp,
  isDeckLegalInMode,
  isTimingClassLegalInMode,
  resolveCurrencyForCard,
  resolveEffectiveTimingClasses,
  round6,
  uniqueTimingClasses,
} from './card_types';

export interface OverlayApplicationOptions {
  readonly instanceIdFactory?: () => string;
  readonly runtimeOverlay?: CardOverlaySnapshot;
}

type CardModeOverrideMap = Readonly<
  Record<string, Readonly<Partial<Record<GameMode, Readonly<Partial<ModeOverlay>>>>>>
>;

const CARD_MODE_OVERRIDES: CardModeOverrideMap = {
  opp_distressed_asset_acquisition_001: {
    [GameMode.GO_ALONE]: {
      effectModifier: 1.2,
      tagWeights: {
        [CardTag.LIQUIDITY]: 2.6,
        [CardTag.INCOME]: 2.4,
        [CardTag.SCALE]: 2.8,
      },
    },
  },
  opp_digital_revenue_stream_001: {
    [GameMode.GO_ALONE]: {
      tagWeights: {
        [CardTag.INCOME]: 2.4,
        [CardTag.SCALE]: 2.7,
        [CardTag.MOMENTUM]: 2.2,
      },
    },
    [GameMode.CHASE_A_LEGEND]: {
      effectModifier: 0.9,
      tagWeights: {
        [CardTag.PRECISION]: 1.2,
      },
    },
  },
  opp_hostile_acquisition_block_001: {
    [GameMode.GO_ALONE]: {
      timingLock: [TimingClass.FATE, TimingClass.PHZ],
      costModifier: 0,
      cordWeight: 1.2,
      tagWeights: {
        [CardTag.RESILIENCE]: 2.2,
        [CardTag.CASCADE]: 2.0,
      },
    },
  },
  ipa_licensing_deal_001: {
    [GameMode.GO_ALONE]: {
      effectModifier: 1.15,
      tagWeights: {
        [CardTag.INCOME]: 2.5,
        [CardTag.SCALE]: 2.2,
      },
    },
    [GameMode.TEAM_UP]: {
      effectModifier: 1.08,
      tagWeights: {
        [CardTag.TRUST]: 1.4,
      },
    },
  },
  disc_variance_lock_001: {
    [GameMode.GO_ALONE]: {
      tagWeights: {
        [CardTag.PRECISION]: 1.6,
        [CardTag.RESILIENCE]: 1.8,
      },
    },
    [GameMode.CHASE_A_LEGEND]: {
      effectModifier: 1.2,
      cordWeight: 1.25,
      tagWeights: {
        [CardTag.PRECISION]: 3.0,
        [CardTag.DIVERGENCE]: 2.8,
        [CardTag.VARIANCE]: 1.6,
      },
    },
  },
  disc_precision_hold_001: {
    [GameMode.CHASE_A_LEGEND]: {
      timingLock: [TimingClass.PRE, TimingClass.GBM],
      costModifier: 0,
      effectModifier: 1.1,
      cordWeight: 1.15,
      tagWeights: {
        [CardTag.PRECISION]: 3.2,
        [CardTag.TEMPO]: 2.1,
        [CardTag.DIVERGENCE]: 2.7,
      },
    },
  },
  disc_iron_discipline_001: {
    [GameMode.GO_ALONE]: {
      tagWeights: {
        [CardTag.PRECISION]: 1.8,
        [CardTag.RESILIENCE]: 2.0,
      },
    },
    [GameMode.CHASE_A_LEGEND]: {
      cordWeight: 1.35,
      tagWeights: {
        [CardTag.PRECISION]: 3.0,
        [CardTag.DIVERGENCE]: 2.4,
      },
    },
  },
  ghost_pass_exploit_001: {
    [GameMode.CHASE_A_LEGEND]: {
      timingLock: [TimingClass.GBM],
      costModifier: 0,
      cordWeight: 1.4,
      tagWeights: {
        [CardTag.DIVERGENCE]: 3.5,
        [CardTag.PRECISION]: 3.2,
        [CardTag.INCOME]: 1.4,
      },
    },
  },
  leg_sovereign_leverage_001: {
    [GameMode.GO_ALONE]: {
      effectModifier: 1.35,
      cordWeight: 1.2,
    },
    [GameMode.HEAD_TO_HEAD]: {
      currencyOverride: 'battle_budget',
      effectModifier: 1.1,
    },
    [GameMode.TEAM_UP]: {
      currencyOverride: 'treasury',
      effectModifier: 1.15,
      tagWeights: {
        [CardTag.TRUST]: 1.8,
      },
    },
    [GameMode.CHASE_A_LEGEND]: {
      cordWeight: 1.5,
      tagWeights: {
        [CardTag.DIVERGENCE]: 2.2,
        [CardTag.PRECISION]: 2.4,
      },
    },
  },
  leg_systemic_override_001: {
    [GameMode.GO_ALONE]: {
      effectModifier: 1.2,
      tagWeights: {
        [CardTag.HEAT]: 1.8,
        [CardTag.RESILIENCE]: 2.0,
      },
    },
    [GameMode.HEAD_TO_HEAD]: {
      effectModifier: 1.1,
      currencyOverride: 'battle_budget',
    },
    [GameMode.TEAM_UP]: {
      effectModifier: 1.15,
      tagWeights: {
        [CardTag.TRUST]: 2.0,
      },
    },
    [GameMode.CHASE_A_LEGEND]: {
      cordWeight: 1.25,
      tagWeights: {
        [CardTag.PRECISION]: 2.5,
        [CardTag.DIVERGENCE]: 2.0,
      },
    },
  },
};

function defaultInstanceIdFactory(): string {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `card_${now}_${random}`;
}

function roundCost(value: number): number {
  return Math.max(0, Math.round(value));
}

function additiveMergeTagWeights(
  ...sources: ReadonlyArray<Readonly<Partial<Record<CardTag, number>>> | undefined>
): Readonly<Partial<Record<CardTag, number>>> {
  const merged: Partial<Record<CardTag, number>> = {};

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const [tagKey, weight] of Object.entries(source)) {
      const tag = tagKey as CardTag;
      const existing = merged[tag] ?? 1;
      merged[tag] = round6(existing + (weight - 1));
    }
  }

  return merged;
}

function intersectOrReplaceTiming(
  baseTiming: readonly TimingClass[],
  lockTiming: readonly TimingClass[],
): readonly TimingClass[] {
  if (lockTiming.length === 0) {
    return uniqueTimingClasses(baseTiming);
  }

  const intersection = baseTiming.filter((timingClass) => lockTiming.includes(timingClass));
  return uniqueTimingClasses(intersection.length > 0 ? intersection : lockTiming);
}

function multiplyOrDefault(base: number, override?: number): number {
  return override === undefined ? base : round6(base * override);
}

export class ModeOverlayEngine {
  private readonly mode: GameMode;
  private readonly instanceIdFactory: () => string;

  public constructor(mode: GameMode, options: OverlayApplicationOptions = {}) {
    this.mode = mode;
    this.instanceIdFactory = options.instanceIdFactory ?? defaultInstanceIdFactory;
  }

  public applyOverlay(
    definition: CardDefinition,
    drawnAtTick: number,
    context?: ExecutionContext,
    options: OverlayApplicationOptions = {},
  ): CardInHand | null {
    const overlay = this.mergeOverlay(definition, context, options.runtimeOverlay);
    if (!overlay.legal) {
      return null;
    }

    const effectiveCurrency = resolveCurrencyForCard(definition.deckType, this.mode, overlay);
    const effectiveCost = roundCost(definition.baseCost * overlay.costModifier);

    return {
      instanceId: options.instanceIdFactory?.() ?? this.instanceIdFactory(),
      definition,
      overlay,
      drawnAtTick,
      effectiveCost,
      effectiveCurrency,
      isForced: overlay.autoResolveOverride ?? definition.autoResolve,
      isHeld: false,
      isLegendary: definition.rarity === CardRarity.LEGENDARY,
      expiresAtTick:
        typeof definition.decayTicks === 'number' && definition.decayTicks >= 0
          ? drawnAtTick + definition.decayTicks
          : undefined,
    };
  }

  public mergeOverlay(
    definition: CardDefinition,
    context?: ExecutionContext,
    runtimeOverlay?: CardOverlaySnapshot,
  ): ModeOverlay {
    const baseOverlay = DEFAULT_MODE_OVERLAYS[this.mode];
    const definitionOverlay = definition.modeOverlays?.[this.mode];
    const cardOverride = CARD_MODE_OVERRIDES[definition.cardId]?.[this.mode];

    const legalByDeck = isDeckLegalInMode(definition.deckType, this.mode);
    const legalByCard = definition.modeLegal ? definition.modeLegal.includes(this.mode) : true;
    const legalByTiming = resolveEffectiveTimingClasses(definition, {
      timingLock:
        runtimeOverlay?.timingLock ??
        cardOverride?.timingLock ??
        definitionOverlay?.timingLock ??
        baseOverlay.timingLock,
    }).every((timingClass) => isTimingClassLegalInMode(timingClass, this.mode));

    let merged: ModeOverlay = {
      costModifier: multiplyOrDefault(
        multiplyOrDefault(baseOverlay.costModifier, definitionOverlay?.costModifier),
        cardOverride?.costModifier,
      ),
      effectModifier: multiplyOrDefault(
        multiplyOrDefault(baseOverlay.effectModifier, definitionOverlay?.effectModifier),
        cardOverride?.effectModifier,
      ),
      tagWeights: additiveMergeTagWeights(
        baseOverlay.tagWeights,
        definitionOverlay?.tagWeights,
        cardOverride?.tagWeights,
        runtimeOverlay?.tagWeights,
      ),
      timingLock: intersectOrReplaceTiming(
        resolveEffectiveTimingClasses(definition, {
          timingLock: definitionOverlay?.timingLock ?? baseOverlay.timingLock,
        }),
        uniqueTimingClasses([
          ...(cardOverride?.timingLock ?? []),
          ...(runtimeOverlay?.timingLock ?? []),
        ]),
      ),
      legal:
        legalByDeck &&
        legalByCard &&
        legalByTiming &&
        baseOverlay.legal &&
        (definitionOverlay?.legal ?? true) &&
        (cardOverride?.legal ?? true) &&
        (runtimeOverlay?.legal ?? true),
      targetingOverride:
        runtimeOverlay?.targetingOverride ??
        cardOverride?.targetingOverride ??
        definitionOverlay?.targetingOverride ??
        baseOverlay.targetingOverride,
      cordWeight: multiplyOrDefault(
        multiplyOrDefault(baseOverlay.cordWeight, definitionOverlay?.cordWeight),
        cardOverride?.cordWeight,
      ),
      currencyOverride:
        runtimeOverlay?.currencyOverride ??
        cardOverride?.currencyOverride ??
        definitionOverlay?.currencyOverride ??
        baseOverlay.currencyOverride,
      holdAllowed:
        runtimeOverlay?.holdAllowed ??
        cardOverride?.holdAllowed ??
        definitionOverlay?.holdAllowed ??
        baseOverlay.holdAllowed,
      autoResolveOverride:
        runtimeOverlay?.autoResolveOverride ??
        cardOverride?.autoResolveOverride ??
        definitionOverlay?.autoResolveOverride ??
        baseOverlay.autoResolveOverride,
    };

    merged = this.applyContextualModifiers(definition, merged, context);

    return Object.freeze(merged);
  }

  public isLegalInMode(definition: CardDefinition, context?: ExecutionContext): boolean {
    return this.mergeOverlay(definition, context).legal;
  }

  public getEffectiveCost(definition: CardDefinition, context?: ExecutionContext): number {
    return roundCost(definition.baseCost * this.mergeOverlay(definition, context).costModifier);
  }

  public getEffectiveCurrency(definition: CardDefinition, context?: ExecutionContext): CurrencyType {
    const overlay = this.mergeOverlay(definition, context);
    return resolveCurrencyForCard(definition.deckType, this.mode, overlay);
  }

  public getEffectiveTimingClasses(definition: CardDefinition, context?: ExecutionContext): readonly TimingClass[] {
    return resolveEffectiveTimingClasses(definition, this.mergeOverlay(definition, context));
  }

  public getTagWeight(definition: CardDefinition, tag: CardTag, context?: ExecutionContext): number {
    return this.mergeOverlay(definition, context).tagWeights[tag] ?? 1;
  }

  private applyContextualModifiers(
    definition: CardDefinition,
    overlay: ModeOverlay,
    context?: ExecutionContext,
  ): ModeOverlay {
    if (!context) {
      return overlay;
    }

    let nextOverlay = overlay;

    if (
      this.mode === GameMode.GO_ALONE &&
      context.currentPhase === 'FOUNDATION' &&
      (definition.deckType === DeckType.OPPORTUNITY || definition.deckType === DeckType.IPA) &&
      (definition.tags.includes(CardTag.INCOME) || definition.tags.includes(CardTag.SCALE))
    ) {
      nextOverlay = {
        ...nextOverlay,
        effectModifier: round6(nextOverlay.effectModifier * 1.05),
      };
    }

    if (
      this.mode === GameMode.GO_ALONE &&
      context.currentPhase === 'SOVEREIGNTY' &&
      definition.rarity === CardRarity.LEGENDARY
    ) {
      nextOverlay = {
        ...nextOverlay,
        cordWeight: round6(nextOverlay.cordWeight * 1.1),
      };
    }

    if (
      this.mode === GameMode.HEAD_TO_HEAD &&
      context.activeCounterWindow &&
      (definition.tags.includes(CardTag.COUNTER) || definition.tags.includes(CardTag.TEMPO))
    ) {
      nextOverlay = {
        ...nextOverlay,
        effectModifier: round6(nextOverlay.effectModifier * 1.1),
      };
    }

    if (
      this.mode === GameMode.TEAM_UP &&
      (definition.tags.includes(CardTag.TRUST) || definition.tags.includes(CardTag.AID))
    ) {
      const trustScalar = clamp((context.trustScore ?? 50) / 75, 0.75, 1.5);
      nextOverlay = {
        ...nextOverlay,
        effectModifier: round6(nextOverlay.effectModifier * trustScalar),
        costModifier: round6(nextOverlay.costModifier * clamp(1.15 - ((context.trustScore ?? 50) / 250), 0.8, 1.15)),
      };
    }

    if (
      this.mode === GameMode.CHASE_A_LEGEND &&
      (definition.tags.includes(CardTag.PRECISION) || definition.tags.includes(CardTag.DIVERGENCE))
    ) {
      const divergenceScalar = 1 + clamp((context.divergenceScore ?? 0) * 0.5, 0, 0.5);
      const ghostWindowBoost = context.activeGhostBenchmarkWindow ? 1.15 : 1;

      nextOverlay = {
        ...nextOverlay,
        effectModifier: round6(nextOverlay.effectModifier * divergenceScalar),
        cordWeight: round6(nextOverlay.cordWeight * ghostWindowBoost),
      };
    }

    if (
      context.currentPressureTier === undefined ||
      definition.rarity === CardRarity.LEGENDARY ||
      definition.counterability === Counterability.HARD
    ) {
      return nextOverlay;
    }

    const pressureCostMultiplier: Record<NonNullable<ExecutionContext['currentPressureTier']>, number> = {
      T0_SOVEREIGN: 1,
      T1_STABLE: 1,
      T2_STRESSED: 1.03,
      T3_ELEVATED: 1.08,
      T4_COLLAPSE_IMMINENT: 1.15,
    };

    return {
      ...nextOverlay,
      costModifier: round6(nextOverlay.costModifier * pressureCostMultiplier[context.currentPressureTier]),
    };
  }
}