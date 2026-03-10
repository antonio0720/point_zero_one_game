/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { CardInstance, Targeting } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CardRegistry } from './CardRegistry';
import { CardOverlayResolver } from './CardOverlayResolver';
import { CardTimingValidator } from './CardTimingValidator';
import { CardTargetingResolver } from './CardTargetingResolver';

export class CardLegalityService {
  private readonly overlay = new CardOverlayResolver();
  private readonly timing = new CardTimingValidator();
  private readonly targeting = new CardTargetingResolver();

  public constructor(private readonly registry: CardRegistry) {}

  public mustResolve(snapshot: RunStateSnapshot, definitionId: string, target: Targeting): CardInstance {
    const base = this.registry.require(definitionId);
    if (!base.modeLegal.includes(snapshot.mode)) {
      throw new Error(`Card ${definitionId} is not legal in mode ${snapshot.mode}.`);
    }
    const card = this.overlay.resolve(snapshot, base);
    if (!this.timing.isLegal(snapshot, card)) {
      throw new Error(`Card ${definitionId} is not legal in the current timing window.`);
    }
    if (!this.targeting.isAllowed(snapshot, card, target)) {
      throw new Error(`Card ${definitionId} cannot target ${target}.`);
    }
    if (snapshot.economy.cash < card.cost) {
      throw new Error(`Insufficient cash for ${definitionId}.`);
    }
    return card;
  }
}
