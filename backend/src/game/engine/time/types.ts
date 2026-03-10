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

import type { PressureTier, RunPhase } from '../core/GamePrimitives';

export const TIER_DURATIONS_MS: Record<PressureTier, number> = {
  T0: 2000,
  T1: 4000,
  T2: 6000,
  T3: 8500,
  T4: 12000,
};

export const PHASE_BOUNDARIES_MS: Array<{ phase: RunPhase; startsAtMs: number }> = [
  { phase: 'FOUNDATION', startsAtMs: 0 },
  { phase: 'ESCALATION', startsAtMs: 4 * 60 * 1000 },
  { phase: 'SOVEREIGNTY', startsAtMs: 8 * 60 * 1000 },
];
