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

import type { AttackEvent } from '../core/GamePrimitives';

export class AttackRouter {
  public order(attacks: AttackEvent[]): AttackEvent[] {
    const priority = (category: AttackEvent['category']): number => {
      switch (category) {
        case 'EXTRACTION': return 5;
        case 'BREACH': return 4;
        case 'DEBT': return 3;
        case 'DRAIN': return 2;
        case 'LOCK': return 1;
        default: return 0;
      }
    };
    return [...attacks].sort((left, right) => priority(right.category) - priority(left.category) || right.magnitude - left.magnitude);
  }
}
