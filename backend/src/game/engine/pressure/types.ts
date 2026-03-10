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

export const PRESSURE_THRESHOLDS: Array<{ tier: PressureTier; minScore: number }> = [
  { tier: 'T4', minScore: 75 },
  { tier: 'T3', minScore: 55 },
  { tier: 'T2', minScore: 35 },
  { tier: 'T1', minScore: 12 },
  { tier: 'T0', minScore: 0 },
];
