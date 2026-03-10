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

import type { PressureTier } from '../core/GamePrimitives';

export class BattleBudgetManager {
  public accrue(current: number, tier: PressureTier, cap: number): number {
    const gain = tier === 'T3' || tier === 'T4' ? 4 : tier === 'T1' || tier === 'T2' ? 2 : 1;
    return Math.min(cap, current + gain);
  }
}
