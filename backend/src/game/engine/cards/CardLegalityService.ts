/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardLegalityService.ts
 *
 * Doctrine:
 * - backend owns final legality
 * - base mode legality and overlay legality are separate checks
 * - timing, targeting, affordability, and mode-sequence rules must all pass
 * - card legality must remain deterministic for the same snapshot
 */

import type {
  CardDefinition,
  CardInstance,
  Targeting,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CardOverlayResolver } from './CardOverlayResolver';
import { CardRegistry } from './CardRegistry';
import { CardTargetingResolver } from './CardTargetingResolver';
import { CardTimingValidator } from './CardTimingValidator';

function isDefectionCard(definitionId: string): boolean {
  return (
    definitionId === 'BREAK_PACT' ||
    definitionId === 'SILENT_EXIT' ||
    definitionId === 'ASSET_SEIZURE'
  );
}

function resolveDefectionStep(definitionId: string): 1 | 2 | 3 | null {
  if (definitionId === 'BREAK_PACT') {
    return 1;
  }

  if (definitionId === 'SILENT_EXIT') {
    return 2;
  }

  if (definitionId === 'ASSET_SEIZURE') {
    return 3;
  }

  return null;
}

export class CardLegalityService {
  private readonly overlay = new CardOverlayResolver();

  private readonly timing = new CardTimingValidator();

  private readonly targeting = new CardTargetingResolver();

  public constructor(private readonly registry: CardRegistry) {}

  public mustResolve(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
  ): CardInstance {
    const base = this.registry.require(definitionId);

    this.assertBaseModeLegal(snapshot, base);
    this.assertOverlayLegal(snapshot, base);

    const card = this.overlay.resolve(snapshot, base);

    this.assertTimingLegal(snapshot, card);
    this.assertTargetLegal(snapshot, card, target);
    this.assertAffordable(snapshot, card);
    this.assertModeSpecificLegal(snapshot, card);

    return card;
  }

  private assertBaseModeLegal(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
  ): void {
    if (!base.modeLegal.includes(snapshot.mode)) {
      throw new Error(
        `Card ${base.id} is not legal in mode ${snapshot.mode}.`,
      );
    }
  }

  private assertOverlayLegal(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
  ): void {
    const overlay = base.modeOverlay?.[snapshot.mode];

    if (overlay?.legal === false) {
      throw new Error(
        `Card ${base.id} is disabled by overlay rules for mode ${snapshot.mode}.`,
      );
    }
  }

  private assertTimingLegal(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): void {
    if (!this.timing.isLegal(snapshot, card)) {
      throw new Error(
        `Card ${card.definitionId} is not legal in the current timing window.`,
      );
    }
  }

  private assertTargetLegal(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    target: Targeting,
  ): void {
    if (!this.targeting.isAllowed(snapshot, card, target)) {
      throw new Error(
        `Card ${card.definitionId} cannot target ${target}.`,
      );
    }
  }

  private assertAffordable(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): void {
    if (snapshot.economy.cash < card.cost) {
      throw new Error(
        `Insufficient cash for ${card.definitionId}. Required ${card.cost}, current ${snapshot.economy.cash}.`,
      );
    }
  }

  private assertModeSpecificLegal(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): void {
    if (isDefectionCard(card.definitionId)) {
      this.assertDefectionSequence(snapshot, card.definitionId);
    }

    if (
      snapshot.mode === 'ghost' &&
      card.card.deckType === 'GHOST' &&
      !snapshot.modeState.legendMarkersEnabled
    ) {
      throw new Error(
        `Ghost card ${card.definitionId} is not legal when legend markers are disabled.`,
      );
    }

    if (
      card.definitionId === 'SYSTEMIC_OVERRIDE' &&
      card.targeting !== 'GLOBAL'
    ) {
      throw new Error(
        `Card ${card.definitionId} must resolve as a GLOBAL effect.`,
      );
    }
  }

  private assertDefectionSequence(
    snapshot: RunStateSnapshot,
    definitionId: string,
  ): void {
    if (snapshot.mode !== 'coop') {
      throw new Error(
        `Defection card ${definitionId} is only legal in coop mode.`,
      );
    }

    const expectedStep = resolveDefectionStep(definitionId);
    if (expectedStep === null) {
      return;
    }

    const actorId = snapshot.userId;
    const currentStep = snapshot.modeState.defectionStepByPlayer[actorId] ?? 0;

    if (expectedStep !== currentStep + 1) {
      throw new Error(
        `Defection card ${definitionId} is out of sequence for actor ${actorId}. Current step ${currentStep}.`,
      );
    }

    if (
      definitionId === 'ASSET_SEIZURE' &&
      !snapshot.modeState.sharedTreasury
    ) {
      throw new Error(
        `Card ${definitionId} requires a shared treasury context.`,
      );
    }
  }
}