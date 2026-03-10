import { createHash } from 'node:crypto';

/**
 * POINT ZERO ONE — BACKEND CARD EFFECTS EXECUTOR
 * backend/src/game/engine/card_effects_executor.ts
 *
 * Goal:
 * - Bring backend card execution closer to the frontend/doctrine model without importing frontend code.
 * - Support 4 modes, 12 timing classes, mode overlays, deterministic IDs/hashes, and backend-safe execution.
 * - Remain self-contained so it can be used by replay, tests, orchestration, and projections.
 * - Preserve immutable public result contracts while allowing safe internal mutation during execution.
 */

export enum GameMode {
  GO_ALONE = 'GO_ALONE',
  HEAD_TO_HEAD = 'HEAD_TO_HEAD',
  TEAM_UP = 'TEAM_UP',
  CHASE_A_LEGEND = 'CHASE_A_LEGEND',
}

export enum DeckType {
  OPPORTUNITY = 'OPPORTUNITY',
  IPA = 'IPA',
  FUBAR = 'FUBAR',
  MISSED_OPPORTUNITY = 'MISSED_OPPORTUNITY',
  PRIVILEGED = 'PRIVILEGED',
  SO = 'SO',
  SABOTAGE = 'SABOTAGE',
  COUNTER = 'COUNTER',
  AID = 'AID',
  RESCUE = 'RESCUE',
  DISCIPLINE = 'DISCIPLINE',
  TRUST = 'TRUST',
  BLUFF = 'BLUFF',
  GHOST = 'GHOST',
}

export enum TimingClass {
  PRE = 'PRE',
  POST = 'POST',
  FATE = 'FATE',
  CTR = 'CTR',
  RES = 'RES',
  AID = 'AID',
  GBM = 'GBM',
  CAS = 'CAS',
  PHZ = 'PHZ',
  PSK = 'PSK',
  END = 'END',
  ANY = 'ANY',
}

export enum CardTag {
  LIQUIDITY = 'liquidity',
  INCOME = 'income',
  RESILIENCE = 'resilience',
  SCALE = 'scale',
  TEMPO = 'tempo',
  SABOTAGE = 'sabotage',
  COUNTER = 'counter',
  HEAT = 'heat',
  TRUST = 'trust',
  AID = 'aid',
  PRECISION = 'precision',
  DIVERGENCE = 'divergence',
  VARIANCE = 'variance',
  CASCADE = 'cascade',
  MOMENTUM = 'momentum',
}

export enum Targeting {
  SELF = 'SELF',
  OPPONENT = 'OPPONENT',
  TEAMMATE = 'TEAMMATE',
  TEAM = 'TEAM',
  GLOBAL = 'GLOBAL',
  GHOST = 'GHOST',
}

export enum CardEffectOp {
  CASH_DELTA = 'cash_delta',
  INCOME_DELTA = 'income_delta',
  EXPENSE_DELTA = 'expense_delta',
  SHIELD_DELTA = 'shield_delta',
  HEAT_DELTA = 'heat_delta',
  TRUST_DELTA = 'trust_delta',
  DIVERGENCE_DELTA = 'divergence_delta',
  BATTLE_BUDGET_DELTA = 'battle_budget_delta',
  TREASURY_DELTA = 'treasury_delta',
  DRAW_CARDS = 'draw_cards',
  INJECT_CARD = 'inject_card',
  STATUS_ADD = 'status_add',
  STATUS_REMOVE = 'status_remove',
  TIMER_FREEZE = 'timer_freeze',
  CORD_BONUS_FLAT = 'cord_bonus_flat',
  NO_OP = 'no_op',
}

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

type MutableResourceDelta = {
  -readonly [K in keyof ResourceDelta]: ResourceDelta[K];
};

type ResourceDeltaKey = keyof ResourceDelta;

const DEFAULT_MODE_OVERLAY: ModeOverlay = {
  costModifier: 1,
  effectModifier: 1,
  tagWeights: {},
  timingLock: [],
  legal: true,
  cordWeight: 1,
};

const MODE_TAG_WEIGHT_DEFAULTS: Record<GameMode, Record<CardTag, number>> = {
  [GameMode.GO_ALONE]: {
    [CardTag.LIQUIDITY]: 2.0,
    [CardTag.INCOME]: 2.2,
    [CardTag.RESILIENCE]: 1.8,
    [CardTag.SCALE]: 2.5,
    [CardTag.TEMPO]: 1.0,
    [CardTag.SABOTAGE]: 0.0,
    [CardTag.COUNTER]: 0.0,
    [CardTag.HEAT]: 0.6,
    [CardTag.TRUST]: 0.0,
    [CardTag.AID]: 0.0,
    [CardTag.PRECISION]: 1.2,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]: 1.0,
    [CardTag.CASCADE]: 1.8,
    [CardTag.MOMENTUM]: 2.0,
  },
  [GameMode.HEAD_TO_HEAD]: {
    [CardTag.LIQUIDITY]: 0.8,
    [CardTag.INCOME]: 0.6,
    [CardTag.RESILIENCE]: 1.0,
    [CardTag.SCALE]: 0.5,
    [CardTag.TEMPO]: 2.4,
    [CardTag.SABOTAGE]: 2.8,
    [CardTag.COUNTER]: 2.2,
    [CardTag.HEAT]: 1.5,
    [CardTag.TRUST]: 0.0,
    [CardTag.AID]: 0.0,
    [CardTag.PRECISION]: 0.8,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]: 1.4,
    [CardTag.CASCADE]: 1.2,
    [CardTag.MOMENTUM]: 1.5,
  },
  [GameMode.TEAM_UP]: {
    [CardTag.LIQUIDITY]: 1.5,
    [CardTag.INCOME]: 1.8,
    [CardTag.RESILIENCE]: 2.0,
    [CardTag.SCALE]: 1.3,
    [CardTag.TEMPO]: 1.0,
    [CardTag.SABOTAGE]: 0.2,
    [CardTag.COUNTER]: 0.5,
    [CardTag.HEAT]: 0.8,
    [CardTag.TRUST]: 3.0,
    [CardTag.AID]: 2.5,
    [CardTag.PRECISION]: 1.0,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]: 0.4,
    [CardTag.CASCADE]: 1.6,
    [CardTag.MOMENTUM]: 1.2,
  },
  [GameMode.CHASE_A_LEGEND]: {
    [CardTag.LIQUIDITY]: 1.2,
    [CardTag.INCOME]: 1.0,
    [CardTag.RESILIENCE]: 1.4,
    [CardTag.SCALE]: 0.9,
    [CardTag.TEMPO]: 1.8,
    [CardTag.SABOTAGE]: 0.0,
    [CardTag.COUNTER]: 0.0,
    [CardTag.HEAT]: 1.0,
    [CardTag.TRUST]: 0.0,
    [CardTag.AID]: 0.0,
    [CardTag.PRECISION]: 2.6,
    [CardTag.DIVERGENCE]: 3.0,
    [CardTag.VARIANCE]: 0.3,
    [CardTag.CASCADE]: 1.5,
    [CardTag.MOMENTUM]: 1.0,
  },
};

const OP_CORD_COEFFICIENTS: Record<CardEffectOp, number> = {
  [CardEffectOp.CASH_DELTA]: 0.000004,
  [CardEffectOp.INCOME_DELTA]: 0.000005,
  [CardEffectOp.EXPENSE_DELTA]: -0.000003,
  [CardEffectOp.SHIELD_DELTA]: 0.0002,
  [CardEffectOp.HEAT_DELTA]: -0.00015,
  [CardEffectOp.TRUST_DELTA]: 0.000175,
  [CardEffectOp.DIVERGENCE_DELTA]: -0.0002,
  [CardEffectOp.BATTLE_BUDGET_DELTA]: 0.00005,
  [CardEffectOp.TREASURY_DELTA]: 0.00003,
  [CardEffectOp.DRAW_CARDS]: 0.003,
  [CardEffectOp.INJECT_CARD]: 0.002,
  [CardEffectOp.STATUS_ADD]: 0.004,
  [CardEffectOp.STATUS_REMOVE]: 0.004,
  [CardEffectOp.TIMER_FREEZE]: 0.006,
  [CardEffectOp.CORD_BONUS_FLAT]: 1,
  [CardEffectOp.NO_OP]: 0,
};

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
    cash: 0,
    income: 0,
    expense: 0,
    shield: 0,
    heat: 0,
    trust: 0,
    divergence: 0,
    battleBudget: 0,
    treasury: 0,
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
    cash: round6(resourceDelta.cash),
    income: round6(resourceDelta.income),
    expense: round6(resourceDelta.expense),
    shield: round6(resourceDelta.shield),
    heat: round6(resourceDelta.heat),
    trust: round6(resourceDelta.trust),
    divergence: round6(resourceDelta.divergence),
    battleBudget: round6(resourceDelta.battleBudget),
    treasury: round6(resourceDelta.treasury),
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

    const currencyUsed = this.resolveCurrency(card.definition.deckType, context.mode);
    const effectiveCost = round6(card.definition.baseCost * overlay.costModifier);
    this.assertSufficientCurrency(currencyUsed, effectiveCost, context);

    const resourceDelta = emptyResourceDelta();
    this.applyCost(currencyUsed, effectiveCost, resourceDelta);

    const resolvedTargeting = overlay.targetingOverride ?? card.definition.targeting;
    const resolvedTargetId = this.resolveTargetId(resolvedTargeting, request, context);

    const statusesAdded: string[] = [];
    const statusesRemoved: string[] = [];
    const injectedCardIds: string[] = [];
    let drawCount = 0;

    const effects: AppliedEffect[] = card.definition.effects.map((effect) => {
      const finalMagnitude = this.resolveEffectMagnitude(
        effect,
        overlay,
        context,
        card.definition.tags,
      );

      const applied: AppliedEffect = {
        op: effect.op,
        baseMagnitude: effect.magnitude,
        finalMagnitude,
        durationTicks: effect.durationTicks ?? 0,
        targeting: resolvedTargeting,
        resolvedTargetId,
        metadata: effect.metadata,
      };

      this.applyEffectSideEffects(
        applied,
        resourceDelta,
        statusesAdded,
        statusesRemoved,
        injectedCardIds,
        (count) => {
          drawCount += count;
        },
      );

      return applied;
    });

    const totalCordDelta = round6(
      effects.reduce(
        (sum, effect) =>
          sum +
          this.computeCordContribution(
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
      playId: `play_${playId.slice(0, 20)}`,
      deterministicHash: playId,
      cardInstanceId: card.instanceId,
      cardId: card.definition.cardId,
      cardName: card.definition.name,
      mode: context.mode,
      choiceId: request.choiceId,
      appliedAt: context.tickIndex,
      timingClass: timing.requested,
      effectiveCost,
      currencyUsed,
      targeting: resolvedTargeting,
      effects: freezeAppliedEffects(effects),
      totalCordDelta,
      resourceDelta: freezeResourceDelta(resourceDelta),
      drawCount,
      injectedCardIds: freezeUniqueStringArray(injectedCardIds),
      statusesAdded: freezeUniqueStringArray(statusesAdded),
      statusesRemoved: freezeUniqueStringArray(statusesRemoved),
      isOptimalChoice,
      educationalTag: card.definition.educationalTag,
    };
  }

  private resolveOverlay(card: CardInHand, mode: GameMode): ModeOverlay {
    const modeOverlay = card.definition.modeOverlays?.[mode] ?? {};
    const runtimeOverlay = card.overlay ?? {};
    const definitionLegal = card.definition.modeLegal?.includes(mode) ?? true;
    const overlayLegal =
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

  private validateTiming(
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

  private resolveCurrency(deckType: DeckType, mode: GameMode): CurrencyType {
    if (
      mode === GameMode.HEAD_TO_HEAD &&
      (deckType === DeckType.SABOTAGE ||
        deckType === DeckType.COUNTER ||
        deckType === DeckType.BLUFF)
    ) {
      return 'battle_budget';
    }

    if (
      mode === GameMode.TEAM_UP &&
      (deckType === DeckType.AID ||
        deckType === DeckType.RESCUE ||
        deckType === DeckType.TRUST)
    ) {
      return 'treasury';
    }

    if (
      deckType === DeckType.GHOST ||
      deckType === DeckType.DISCIPLINE ||
      deckType === DeckType.OPPORTUNITY ||
      deckType === DeckType.IPA ||
      deckType === DeckType.PRIVILEGED ||
      deckType === DeckType.SO ||
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

    if (!request.targetId) {
      return undefined;
    }

    const allowed = context.availableTargetIds ?? [];
    if (allowed.length > 0 && !allowed.includes(request.targetId)) {
      throw new Error(`Target ${request.targetId} is not legal in this execution context.`);
    }

    return request.targetId;
  }

  private resolveEffectMagnitude(
    effect: CardEffectSpec,
    overlay: ModeOverlay,
    context: ExecutionContext,
    tags: readonly CardTag[],
  ): number {
    if (effect.op === CardEffectOp.NO_OP) {
      return 0;
    }

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

    return round6(effect.magnitude * multiplier);
  }

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
    if (coefficient === 0) {
      return 0;
    }

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
}

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
      results: Object.freeze([...results]),
      totalCordDelta,
      playCount: results.length,
    };
  }

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
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}