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

export const MODE_TAG_WEIGHTS = {
  solo: { liquidity: 2.0, income: 2.2, resilience: 1.8, scale: 2.5, tempo: 1.0, sabotage: 0.0, counter: 0.0, heat: 0.6, trust: 0.0, aid: 0.0 },
  pvp: { liquidity: 0.8, income: 0.6, resilience: 1.0, scale: 0.5, tempo: 2.4, sabotage: 2.8, counter: 2.2, heat: 1.5, trust: 0.0, aid: 0.0 },
  coop: { liquidity: 1.5, income: 1.8, resilience: 2.0, scale: 1.3, tempo: 1.0, sabotage: 0.2, counter: 0.5, heat: 0.8, trust: 3.0, aid: 3.0 },
  ghost: { liquidity: 1.2, income: 1.0, resilience: 1.4, scale: 0.9, tempo: 1.8, sabotage: 0.0, counter: 0.0, heat: 1.0, trust: 0.0, aid: 0.0 },
} as const;
