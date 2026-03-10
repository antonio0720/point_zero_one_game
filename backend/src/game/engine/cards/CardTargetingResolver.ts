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

export class CardTargetingResolver {
  public isAllowed(snapshot: RunStateSnapshot, card: CardInstance, targeting: Targeting): boolean {
    if (card.targeting === targeting) {
      return true;
    }
    if (snapshot.mode === 'coop' && card.targeting === 'TEAMMATE' && targeting === 'TEAM') {
      return true;
    }
    if (snapshot.mode === 'pvp' && card.targeting === 'OPPONENT' && targeting === 'SELF') {
      return false;
    }
    return false;
  }
}
