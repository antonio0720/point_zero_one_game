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

import type { AttackCategory, ShieldLayerId } from '../core/GamePrimitives';

export interface RepairJob {
  tick: number;
  layerId: ShieldLayerId | 'ALL';
  amount: number;
}

export interface RoutedAttack {
  attackId: string;
  category: AttackCategory;
  targetLayer: ShieldLayerId | 'DIRECT';
  magnitude: number;
  source: string;
}
