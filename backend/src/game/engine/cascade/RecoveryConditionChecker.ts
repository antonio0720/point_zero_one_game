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

import type { CardInstance } from '../core/GamePrimitives';
import type { CascadeChainInstance } from '../core/GamePrimitives';

export class RecoveryConditionChecker {
  public isRecovered(chain: CascadeChainInstance, hand: CardInstance[], cash: number): boolean {
    if (cash >= 12000 && !chain.positive) {
      return true;
    }
    const tags = new Set(hand.flatMap((card) => card.tags));
    return chain.recoveryTags.some((tag) => tags.has(tag));
  }
}
