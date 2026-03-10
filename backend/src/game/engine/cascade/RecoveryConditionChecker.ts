/*
 * POINT ZERO ONE — BACKEND CASCADE RECOVERY CHECKER
 * /backend/src/game/engine/cascade/RecoveryConditionChecker.ts
 *
 * Doctrine:
 * - recovery must be explainable from current authoritative run state
 * - structured recovery conditions take precedence over loose tag checks
 * - legacy tag compatibility is preserved because chain instances currently
 *   only persist recoveryTags, not full template recovery state
 */

import type { CardInstance, CascadeChainInstance, PressureTier } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { CascadeTemplate, RecoveryCondition } from './types';

export class RecoveryConditionChecker {
  public isRecovered(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): boolean {
    if (chain.positive) {
      return false;
    }

    const structuredRecoveryMet =
      template.recovery.length > 0 &&
      template.recovery.every((condition) => this.evaluateCondition(condition, snapshot));

    if (structuredRecoveryMet) {
      return true;
    }

    return this.matchesLegacyRecoveryTags(
      chain.recoveryTags,
      snapshot.cards.hand,
      snapshot.cards.lastPlayed,
    );
  }

  private evaluateCondition(
    condition: RecoveryCondition,
    snapshot: RunStateSnapshot,
  ): boolean {
    switch (condition.kind) {
      case 'CARD_TAG_ANY': {
        const handTags = new Set(
          snapshot.cards.hand.flatMap((card) => card.tags.map((tag) => this.normalize(tag))),
        );
        return condition.tags.some((tag) => handTags.has(this.normalize(tag)));
      }

      case 'LAST_PLAYED_TAG_ANY': {
        const lastPlayed = new Set(snapshot.cards.lastPlayed.map((value) => this.normalize(value)));
        return condition.tags.some((tag) => lastPlayed.has(this.normalize(tag)));
      }

      case 'CASH_MIN':
        return snapshot.economy.cash >= condition.amount;

      case 'WEAKEST_SHIELD_RATIO_MIN':
        return snapshot.shield.weakestLayerRatio >= condition.ratio;

      case 'ALL_SHIELDS_RATIO_MIN':
        return snapshot.shield.layers.every((layer) => layer.integrityRatio >= condition.ratio);

      case 'TRUST_ANY_MIN':
        return Object.values(snapshot.modeState.trustScores).some((score) => score >= condition.score);

      case 'HEAT_MAX':
        return snapshot.economy.haterHeat <= condition.amount;

      case 'PRESSURE_NOT_ABOVE':
        return this.tierRank(snapshot.pressure.tier) <= this.tierRank(condition.tier);

      default: {
        const exhaustive: never = condition;
        return exhaustive;
      }
    }
  }

  private matchesLegacyRecoveryTags(
    recoveryTags: readonly string[],
    hand: readonly CardInstance[],
    lastPlayed: readonly string[],
  ): boolean {
    if (recoveryTags.length === 0) {
      return false;
    }

    const normalizedBag = new Set<string>();

    for (const card of hand) {
      for (const tag of card.tags) {
        normalizedBag.add(this.normalize(tag));
      }
      normalizedBag.add(this.normalize(card.definitionId));
      normalizedBag.add(this.normalize(card.card.name));
    }

    for (const entry of lastPlayed) {
      normalizedBag.add(this.normalize(entry));
    }

    return recoveryTags.some((tag) => normalizedBag.has(this.normalize(tag)));
  }

  private tierRank(tier: PressureTier): number {
    switch (tier) {
      case 'T0':
        return 0;
      case 'T1':
        return 1;
      case 'T2':
        return 2;
      case 'T3':
        return 3;
      case 'T4':
        return 4;
      default:
        return 99;
    }
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }
}