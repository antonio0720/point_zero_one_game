/**
 * POINT ZERO ONE — BACKEND CARD EFFECTS EXECUTOR
 * backend/src/game/engine/card_effects_executor.ts
 *
 * Self-contained backend-safe card effect execution layer.
 *
 * Why this file exists:
 * - The pasted file was copied from the pzo-web card engine path, but dropped into backend.
 * - That made it import "./types", which does not exist in this directory.
 * - This replacement is local, deterministic, and compile-safe.
 *
 * Design:
 * - No frontend imports
 * - No fake cross-folder dependencies
 * - Deterministic, pure execution model
 * - Useful for backend simulations, tests, and replay evaluation
 */

export enum CardEffectOp {
  CASH_DELTA = 'cash_delta',
  INCOME_DELTA = 'income_delta',
  EXPENSE_DELTA = 'expense_delta',
  SHIELD_DELTA = 'shield_delta',
  HEAT_DELTA = 'heat_delta',
  TRUST_DELTA = 'trust_delta',
  DIVERGENCE_DELTA = 'divergence_delta',
  CORD_BONUS_FLAT = 'cord_bonus_flat',
  NO_OP = 'no_op',
}

export interface CardEffectSpec {
  readonly op: CardEffectOp;
  readonly magnitude: number;
  readonly durationTicks?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CardOverlaySnapshot {
  readonly effectModifier?: number;
  readonly cordWeight?: number;
}

export interface CardDefinitionSnapshot {
  readonly cardId: string;
  readonly name?: string;
  readonly effects: readonly CardEffectSpec[];
}

export interface CardInHand {
  readonly instanceId: string;
  readonly definition: CardDefinitionSnapshot;
  readonly overlay?: CardOverlaySnapshot;
}

export interface CardPlayRequest {
  readonly instanceId: string;
  readonly choiceId: string;
  readonly targetId?: string;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AppliedEffect {
  readonly op: CardEffectOp;
  readonly baseMagnitude: number;
  readonly finalMagnitude: number;
  readonly durationTicks: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CardEffectResult {
  readonly playId: string;
  readonly cardInstanceId: string;
  readonly cardId: string;
  readonly choiceId: string;
  readonly appliedAt: number;
  readonly effects: readonly AppliedEffect[];
  readonly totalCordDelta: number;
  readonly isOptimalChoice: boolean;
}

export interface CardEffectExecutionItem {
  readonly card: CardInHand;
  readonly request: CardPlayRequest;
  readonly tickIndex: number;
  readonly isOptimalChoice?: boolean;
}

export interface CardEffectExecutionBatchResult {
  readonly results: readonly CardEffectResult[];
  readonly totalCordDelta: number;
  readonly playCount: number;
}

const CORD_PER_CASH = 0.000004;
const CORD_PER_INCOME = 0.000005;
const CORD_PER_EXPENSE = 0.000003;
const CORD_PER_SHIELD = 0.0002;
const CORD_PER_HEAT = 0.00015;
const CORD_PER_TRUST = 0.000175;
const CORD_PER_DIVERGENCE = 0.0002;

let playCounter = 0;

function createPlayId(): string {
  playCounter += 1;
  return `play_${Date.now()}_${playCounter}`;
}

function roundTo6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class CardEffectResolver {
  public resolve(
    card: CardInHand,
    request: CardPlayRequest,
    tickIndex: number,
    isOptimalChoice: boolean,
  ): CardEffectResult {
    const effectModifier = card.overlay?.effectModifier ?? 1;
    const cordWeight = card.overlay?.cordWeight ?? 1;

    const appliedEffects: AppliedEffect[] = card.definition.effects.map((effect) => {
      const finalMagnitude =
        effect.op === CardEffectOp.NO_OP
          ? 0
          : roundTo6(effect.magnitude * effectModifier);

      return {
        op: effect.op,
        baseMagnitude: effect.magnitude,
        finalMagnitude,
        durationTicks: effect.durationTicks ?? 0,
        metadata: effect.metadata,
      };
    });

    const totalCordDelta = roundTo6(
      appliedEffects.reduce((sum, effect) => {
        return sum + this.computeCordContribution(effect);
      }, 0) * cordWeight,
    );

    return {
      playId: createPlayId(),
      cardInstanceId: card.instanceId,
      cardId: card.definition.cardId,
      choiceId: request.choiceId,
      appliedAt: tickIndex,
      effects: appliedEffects,
      totalCordDelta,
      isOptimalChoice,
    };
  }

  private computeCordContribution(effect: AppliedEffect): number {
    switch (effect.op) {
      case CardEffectOp.CASH_DELTA:
        return effect.finalMagnitude * CORD_PER_CASH;

      case CardEffectOp.INCOME_DELTA:
        return effect.finalMagnitude * CORD_PER_INCOME;

      case CardEffectOp.EXPENSE_DELTA:
        return -Math.abs(effect.finalMagnitude) * CORD_PER_EXPENSE;

      case CardEffectOp.SHIELD_DELTA:
        return effect.finalMagnitude * CORD_PER_SHIELD;

      case CardEffectOp.HEAT_DELTA:
        return -effect.finalMagnitude * CORD_PER_HEAT;

      case CardEffectOp.TRUST_DELTA:
        return effect.finalMagnitude * CORD_PER_TRUST;

      case CardEffectOp.DIVERGENCE_DELTA:
        return -effect.finalMagnitude * CORD_PER_DIVERGENCE;

      case CardEffectOp.CORD_BONUS_FLAT:
        return effect.finalMagnitude;

      case CardEffectOp.NO_OP:
      default:
        return 0;
    }
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
      item.tickIndex,
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
      totalCordDelta = roundTo6(totalCordDelta + result.totalCordDelta);
    }

    return {
      results,
      totalCordDelta,
      playCount: results.length,
    };
  }
}