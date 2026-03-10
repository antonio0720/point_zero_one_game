/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/DeckComposer.ts
 *
 * Doctrine:
 * - deck composition is backend-owned
 * - mode legality must honor both base modeLegal and overlay legality
 * - ordering should be deterministic and doctrine-driven
 * - helpers should remain additive so existing callers of byMode() still work
 */

import type {
  CardDefinition,
  DeckType,
  ModeCode,
} from '../core/GamePrimitives';
import { resolveModeOverlay } from '../core/GamePrimitives';
import { CardRegistry } from './CardRegistry';
import {
  ALL_DECK_TYPES,
  getModeDeckPriority,
  scoreCardForMode,
} from './types';

export class DeckComposer {
  public constructor(
    private readonly registry: CardRegistry = new CardRegistry(),
  ) {}

  public byMode(mode: ModeCode): string[] {
    return this.byModeDefinitions(mode).map((card) => card.id);
  }

  public byModeDefinitions(mode: ModeCode): CardDefinition[] {
    return this.registry
      .all()
      .filter((card) => this.isModeLegal(card, mode))
      .slice()
      .sort((left, right) => this.compareCards(left, right, mode));
  }

  public byModeBuckets(mode: ModeCode): Record<DeckType, string[]> {
    const buckets = this.createEmptyBuckets();

    for (const card of this.byModeDefinitions(mode)) {
      buckets[card.deckType].push(card.id);
    }

    return buckets;
  }

  public composeLimitedDeck(mode: ModeCode, size: number): string[] {
    if (!Number.isFinite(size) || size <= 0) {
      return [];
    }

    return this.byMode(mode).slice(0, Math.floor(size));
  }

  public contains(mode: ModeCode, definitionId: string): boolean {
    const card = this.registry.get(definitionId);

    if (!card) {
      return false;
    }

    return this.isModeLegal(card, mode);
  }

  private isModeLegal(card: CardDefinition, mode: ModeCode): boolean {
    if (!card.modeLegal.includes(mode)) {
      return false;
    }

    return resolveModeOverlay(card, mode).legal;
  }

  private compareCards(
    left: CardDefinition,
    right: CardDefinition,
    mode: ModeCode,
  ): number {
    const leftDeckPriority = getModeDeckPriority(mode, left.deckType);
    const rightDeckPriority = getModeDeckPriority(mode, right.deckType);

    if (leftDeckPriority !== rightDeckPriority) {
      return leftDeckPriority - rightDeckPriority;
    }

    const leftScore = scoreCardForMode(left, mode);
    const rightScore = scoreCardForMode(right, mode);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    if (left.baseCost !== right.baseCost) {
      return left.baseCost - right.baseCost;
    }

    return left.id.localeCompare(right.id);
  }

  private createEmptyBuckets(): Record<DeckType, string[]> {
    return {
      OPPORTUNITY: [],
      IPA: [],
      FUBAR: [],
      MISSED_OPPORTUNITY: [],
      PRIVILEGED: [],
      SO: [],
      SABOTAGE: [],
      COUNTER: [],
      AID: [],
      RESCUE: [],
      DISCIPLINE: [],
      TRUST: [],
      BLUFF: [],
      GHOST: [],
    };
  }
}