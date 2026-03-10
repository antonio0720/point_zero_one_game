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

export const CORD_WEIGHTS = {
  decision_speed_score: 0.25,
  shields_maintained_pct: 0.20,
  hater_sabotages_blocked: 0.20,
  cascade_chains_broken: 0.20,
  pressure_survived_score: 0.15,
} as const;

export const OUTCOME_MULTIPLIER = {
  FREEDOM: 1.5,
  TIMEOUT: 0.8,
  BANKRUPT: 0.4,
  ABANDONED: 0.0,
} as const;
