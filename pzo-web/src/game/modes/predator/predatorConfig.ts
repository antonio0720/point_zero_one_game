// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/predatorConfig.ts
// Sprint 4 — Predator (HEAD-TO-HEAD) mode configuration
// ═══════════════════════════════════════════════════════════════════════════

export interface PredatorConfig {
  /** Income weight multiplier — tempo over compounding */
  incomeWeightMultiplier: number;
  /** Battle budget generation rate (% of card value) */
  bbGenerationRate: number;
  /** Battle budget cap per round */
  bbMaxPerRound: number;
  /** Extraction cash siphon rate (% of opponent cash) */
  extractionSiphonRate: number;
  /** Extraction shield crack damage */
  extractionShieldCrackCost: number;
  /** Counterplay window duration in ticks */
  counterplayWindowTicks: number;
  /** Ticks between forced extraction opportunities */
  extractionWindowInterval: number;
  /** Psyche meter decay rate per tick */
  psycheMeterDecayRate: number;
  /** Psyche threshold for tilt state activation */
  tiltActivationThreshold: number;
  /** Rivalry trigger: consecutive wins to register rivalry */
  rivalryWinThreshold: number;
  /** Battle round duration in ticks */
  battleRoundTicks: number;
  /** Shared deck claim window in ticks */
  deckClaimWindowTicks: number;
}

export const PREDATOR_CONFIG: PredatorConfig = {
  incomeWeightMultiplier:     0.55,   // income worth 55% vs empire's 100%
  bbGenerationRate:           0.015,  // 1.5% of card energy cost → BB
  bbMaxPerRound:              500,
  extractionSiphonRate:       0.08,   // 8% of opponent's visible cash
  extractionShieldCrackCost:  3_500,
  counterplayWindowTicks:     8,      // 8 ticks to respond
  extractionWindowInterval:   45,
  psycheMeterDecayRate:       0.02,   // per tick passive decay
  tiltActivationThreshold:    0.80,   // 80% psyche = tilt
  rivalryWinThreshold:        3,      // 3 consecutive wins = rivalry
  battleRoundTicks:           60,
  deckClaimWindowTicks:       6,
};
