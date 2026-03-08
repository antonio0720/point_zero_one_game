/**
 * POINT ZERO ONE — CARD EFFECTS EXECUTOR
 * pzo-web/src/engines/cards/CardEffectsExecutor.ts
 *
 * Thin execution adapter over the repo-native CardEffectResolver.
 * This preserves the "execute a batch" ergonomics from your snippet
 * without introducing a second parallel effect system.
 *
 * RULE:
 * - Do not invent a generic RunState reducer here.
 * - The authoritative effect path remains CardEffectResolver -> EventBus -> engines/store.
 */

import { CardEffectResolver } from './CardEffectResolver';
import type {
  CardEffectResult,
  CardInHand,
  CardPlayRequest,
} from './types';

/**
 * One executable play item.
 */
export interface CardEffectExecutionItem {
  readonly card: CardInHand;
  readonly request: CardPlayRequest;
  readonly tickIndex: number;
  readonly isOptimalChoice?: boolean;
}

/**
 * Batch execution summary.
 */
export interface CardEffectExecutionBatchResult {
  readonly results: readonly CardEffectResult[];
  readonly totalCordDelta: number;
  readonly playCount: number;
}

export class CardEffectsExecutor {
  private readonly resolver: CardEffectResolver;

  public constructor(resolver: CardEffectResolver) {
    this.resolver = resolver;
  }

  /**
   * Execute a single card play through the repo-native resolver.
   */
  public executeOne(item: CardEffectExecutionItem): CardEffectResult {
    return this.resolver.resolve(
      item.card,
      item.request,
      item.tickIndex,
      item.isOptimalChoice ?? false,
    );
  }

  /**
   * Execute multiple card plays in order, preserving deterministic sequencing.
   */
  public executeMany(
    items: readonly CardEffectExecutionItem[],
  ): CardEffectExecutionBatchResult {
    const results: CardEffectResult[] = [];
    let totalCordDelta = 0;

    for (const item of items) {
      const result = this.executeOne(item);
      results.push(result);
      totalCordDelta += result.totalCordDelta;
    }

    return {
      results,
      totalCordDelta,
      playCount: results.length,
    };
  }
}