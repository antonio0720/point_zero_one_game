// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/predatorConfig.ts
// Sprint 7 — Predator (HEAD-TO-HEAD) complete configuration
//
// Single source of truth for ALL Predator mode tuning constants.
// predatorCardAdapter.ts, battleBudgetEngine.ts, and all sub-engines
// import ONLY from here — never declare their own magic numbers.
//
// Performance target: 20M concurrent PvP pairs, <1ms per tick per pair.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

export interface ExtractionCooldowns {
  CASH_SIPHON:  number;
  SHIELD_CRACK: number;
  DEBT_SPIKE:   number;
  HEAT_SPIKE:   number;
  INCOME_DRAIN: number;
}

export interface PredatorCordWeights {
  /** Quality of extraction choices (right type vs opponent state) */
  extractionEfficiency:   number;
  /** Counterplay response rate + choice optimality */
  counterplayQuality:     number;
  /** Rivalry tier at run end (deeper rivalry = higher CORD contribution) */
  rivalryTierBonus:       number;
  /** Penalizes ticks spent in tilt */
  psycheResilience:       number;
  /** Core: cashflow / netWorth consistency under pressure */
  economicConsistency:    number;
}

export interface PredatorConfig {
  // ── Battle Budget ─────────────────────────────────────────────────────────
  /** BB generation rate as fraction of card energy cost */
  bbGenerationRate:            number;
  /** BB cap per round — prevents hoarding */
  bbMaxPerRound:               number;
  /** BB debt forgiven per round reset */
  bbDebtForgivenessPerRound:   number;
  /** Minimum ticks between BB round resets */
  battleRoundTicks:            number;

  // ── Extraction Arsenal ────────────────────────────────────────────────────
  /** Cash siphon rate (fraction of visible opponent cash) */
  extractionSiphonRate:        number;
  /** Fixed cash hit on shield crack extraction */
  extractionShieldCrackCost:   number;
  /** Fraction of opponent income drained per INCOME_DRAIN */
  extractionIncomeDrainRate:   number;
  /** Multiplier on income for DEBT_SPIKE cash hit */
  extractionDebtSpikeRate:     number;
  /** Max concurrent active extractions (prevents spam) */
  maxConcurrentExtractions:    number;
  /** Cooldown ticks per extraction type after use */
  extractionCooldownTicks:     ExtractionCooldowns;
  /** Tension score bump from HEAT_SPIKE */
  heatSpikeTensionBump:        number;
  /** Draw weight penalty applied to opponent from HEAT_SPIKE (ticks) */
  heatSpikeDrawPenaltyTicks:   number;

  // ── Counterplay Windows ───────────────────────────────────────────────────
  /** Ticks the defender has to respond to an extraction */
  counterplayWindowTicks:      number;
  /** REFLECT: fraction of impact bounced back to attacker */
  reflectDamagePct:            number;
  /** DAMPEN: fraction of impact negated */
  dampenReductionPct:          number;
  /** Psyche relief granted on a successful counterplay (non-NONE) */
  counterplayPsycheRelief:     number;
  /** Intervals between forced extraction opportunity windows */
  extractionWindowInterval:    number;
  /** Shared deck claim window ticks */
  deckClaimWindowTicks:        number;

  // ── Psyche Meter ──────────────────────────────────────────────────────────
  /** Passive decay per tick when below tilt */
  psycheMeterDecayRate:        number;
  /** Threshold at which tilt activates */
  tiltActivationThreshold:     number;
  /** Psyche value at which player can exit tilt (must play down to this) */
  tiltExitThreshold:           number;
  /** Psyche value considered "danger zone" (warning before tilt) */
  psycheDangerThreshold:       number;

  // ── Tempo Chain ───────────────────────────────────────────────────────────
  /** Ticks a combo window stays open after last card play */
  tempoChainWindowTicks:       number;
  /** BB multiplier per chain link (1.0 + depth × this) */
  tempoChainBBMultiplierStep:  number;
  /** Max chain depth before diminishing returns floor */
  tempoChainMaxDepth:          number;

  // ── Rivalry ───────────────────────────────────────────────────────────────
  /** Consecutive wins needed to establish EMERGING rivalry */
  rivalryWinThreshold:         number;
  /** Matchmaking history TTL (matches older than N server ticks are dropped) */
  matchHistoryTTLTicks:        number;

  // ── Income Weight ─────────────────────────────────────────────────────────
  /** Income weight multiplier — tempo over compounding */
  incomeWeightMultiplier:      number;

  // ── CORD Weights ─────────────────────────────────────────────────────────
  cordWeights:                 PredatorCordWeights;
}

export const PREDATOR_CONFIG: PredatorConfig = {
  // Battle Budget
  bbGenerationRate:             0.015,
  bbMaxPerRound:                500,
  bbDebtForgivenessPerRound:    50,
  battleRoundTicks:             60,

  // Extraction Arsenal
  extractionSiphonRate:         0.08,
  extractionShieldCrackCost:    3_500,
  extractionIncomeDrainRate:    0.15,
  extractionDebtSpikeRate:      0.80,
  maxConcurrentExtractions:     3,
  extractionCooldownTicks: {
    CASH_SIPHON:  20,
    SHIELD_CRACK: 30,
    DEBT_SPIKE:   40,
    HEAT_SPIKE:   12,
    INCOME_DRAIN: 25,
  },
  heatSpikeTensionBump:         0.12,
  heatSpikeDrawPenaltyTicks:    6,

  // Counterplay Windows
  counterplayWindowTicks:       8,
  reflectDamagePct:             0.50,
  dampenReductionPct:           0.60,
  counterplayPsycheRelief:      0.15,
  extractionWindowInterval:     45,
  deckClaimWindowTicks:         6,

  // Psyche Meter
  psycheMeterDecayRate:         0.02,
  tiltActivationThreshold:      0.80,
  tiltExitThreshold:            0.60,
  psycheDangerThreshold:        0.60,

  // Tempo Chain
  tempoChainWindowTicks:        4,
  tempoChainBBMultiplierStep:   0.12,
  tempoChainMaxDepth:           5,

  // Rivalry
  rivalryWinThreshold:          3,
  matchHistoryTTLTicks:         50_000,

  // Income Weight
  incomeWeightMultiplier:       0.55,

  // CORD Weights (must sum to 1.0)
  cordWeights: {
    extractionEfficiency:  0.30,
    counterplayQuality:    0.25,
    rivalryTierBonus:      0.15,
    psycheResilience:      0.15,
    economicConsistency:   0.15,
  },
};