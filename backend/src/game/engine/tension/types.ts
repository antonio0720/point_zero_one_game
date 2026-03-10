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

import type { PressureTier, VisibilityLevel } from '../core/GamePrimitives';

export const VISIBILITY_BY_TIER: Record<PressureTier, VisibilityLevel> = {
  T0: 'EXPOSED',
  T1: 'EXPOSED',
  T2: 'PARTIAL',
  T3: 'PARTIAL',
  T4: 'SILHOUETTE',
};
