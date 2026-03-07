/**
 * FILE: pzo-web/src/engines/pressure/PressureSignalCollector.ts
 * Pure signal aggregation. Reads PressureReadInput, returns raw score + per-signal breakdown.
 * No tier logic. No events. No history. Imports from types.ts only.
 */
import {
  PressureReadInput,
  PressureSignalWeights,
  PressureTuning,
  DEFAULT_SIGNAL_WEIGHTS,
  PRESSURE_TUNING_DEFAULTS,
  DOMINANT_SIGNAL_PRIORITY,
} from './types';

// ── Public utility functions ──────────────────────────────────────────────

/**
 * Validate all weight values.
 * Throws RangeError on any negative or non-finite weight.
 * Call before constructing PressureSignalCollector with custom weights.
 */
export function validateWeights(weights: PressureSignalWeights): void {
  for (const [key, val] of Object.entries(weights)) {
    if (!isFinite(val) || val < 0) {
      throw new RangeError(
        `Invalid weight for signal "${key}": ${val}. All weights must be finite and >= 0.`
      );
    }
  }
}

/**
 * Normalize the 7 positive signal weights so they sum to exactly 1.0.
 * Negative signals (prosperityBonus, fullSecurityBonus) are preserved unchanged.
 * Returns a new weights object — does not mutate the input.
 */
export function normalizePositiveWeights(weights: PressureSignalWeights): PressureSignalWeights {
  const positiveKeys: (keyof PressureSignalWeights)[] = [
    'cashflowNegative', 'lowCashBalance', 'haterHeatHigh',
    'activeThreatCards', 'lowShieldIntegrity', 'stagnationTax', 'activeCascadeChains',
  ];
  const sum = positiveKeys.reduce((acc, k) => acc + weights[k], 0);
  if (sum === 0) return { ...weights };
  const result = { ...weights };
  for (const k of positiveKeys) {
    result[k] = weights[k] / sum;
  }
  return result;
}

// ── Interfaces ────────────────────────────────────────────────────────────

export interface SignalBreakdown {
  cashflowNegative:    number; // binary: expenses > income
  lowCashBalance:      number; // binary: cash < 1 month runway
  haterHeatHigh:       number; // partial: scales above haterHeat=50
  activeThreatCards:   number; // per-card with slope, capped at max weight
  lowShieldIntegrity:  number; // partial: scales below 40% shield
  stagnationTax:       number; // per-tick accumulation, capped at max weight
  activeCascadeChains: number; // per-chain, capped at max weight
  prosperityBonus:     number; // reduction: scales with netWorth/freedomThreshold
  fullSecurityBonus:   number; // reduction: all-or-nothing (perfect shield + 0 threats)
}

export interface CollectorResult {
  rawScore:       number;                        // sum before clamp and decay
  breakdown:      SignalBreakdown;               // per-signal contribution
  dominantSignal: keyof SignalBreakdown | null;  // highest positive contributor (priority tie-break)
}

// ── Class ─────────────────────────────────────────────────────────────────

export class PressureSignalCollector {
  private weights: PressureSignalWeights;
  private tuning:  PressureTuning;

  constructor(
    weights: PressureSignalWeights = DEFAULT_SIGNAL_WEIGHTS,
    tuning:  PressureTuning        = PRESSURE_TUNING_DEFAULTS,
  ) {
    this.weights = { ...weights };
    this.tuning  = { ...tuning };
  }

  /** Update signal weights at runtime (admin/balance tooling only). */
  public setWeights(weights: Partial<PressureSignalWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  public compute(input: PressureReadInput): CollectorResult {
    const w     = this.weights;
    const slope = this.tuning.threatCardSlope;

    const bd: SignalBreakdown = {
      cashflowNegative:    0,
      lowCashBalance:      0,
      haterHeatHigh:       0,
      activeThreatCards:   0,
      lowShieldIntegrity:  0,
      stagnationTax:       0,
      activeCascadeChains: 0,
      prosperityBonus:     0,
      fullSecurityBonus:   0,
    };

    // ── Positive signals ──────────────────────────────────────────────────

    // 1. Cashflow: binary — full weight when expenses exceed income
    if (input.monthlyExpenses > input.monthlyIncome) {
      bd.cashflowNegative = w.cashflowNegative;
    }

    // 2. Low cash: binary — full weight when balance strictly below 1 month runway
    if (input.cashBalance < input.monthlyExpenses) {
      bd.lowCashBalance = w.lowCashBalance;
    }

    // 3. Hater heat: partial scaling above threshold of 50 (exclusive)
    if (input.haterHeat > 50) {
      const excess = Math.min(input.haterHeat - 50, 50); // 0–50 above threshold
      bd.haterHeatHigh = (excess / 50) * w.haterHeatHigh;
    }

    // 4. Active threat cards: slope per card, capped at max weight
    bd.activeThreatCards = Math.min(input.activeThreatCardCount * slope, w.activeThreatCards);

    // 5. Shield integrity: partial scaling below 40% (exact 0.40 → 0 contribution)
    if (input.shieldIntegrityPct < 0.40) {
      const deficit = (0.40 - input.shieldIntegrityPct) / 0.40;
      bd.lowShieldIntegrity = deficit * w.lowShieldIntegrity;
    }

    // 6. Stagnation: +0.01 per consecutive tick without income growth, capped at max weight
    bd.stagnationTax = Math.min(input.ticksWithoutIncomeGrowth * 0.01, w.stagnationTax);

    // 7. Cascade chains: +0.05 per active chain, capped at max weight
    bd.activeCascadeChains = Math.min(input.activeCascadeChainCount * 0.05, w.activeCascadeChains);

    // ── Negative signals (reductions) ────────────────────────────────────

    // 8. Prosperity bonus: partial — scales with netWorth vs 2x freedomThreshold
    if (input.freedomThreshold > 0 && input.netWorth > 0) {
      const ratio = input.netWorth / (2 * input.freedomThreshold);
      bd.prosperityBonus = Math.min(ratio, 1.0) * w.prosperityBonus;
    }

    // 9. Full security bonus: all-or-nothing — perfect shield AND zero threats
    if (input.shieldIntegrityPct >= 1.0 && input.activeThreatCardCount === 0) {
      bd.fullSecurityBonus = w.fullSecurityBonus;
    }

    // ── Sum ───────────────────────────────────────────────────────────────
    const positiveSum =
      bd.cashflowNegative + bd.lowCashBalance + bd.haterHeatHigh +
      bd.activeThreatCards + bd.lowShieldIntegrity + bd.stagnationTax +
      bd.activeCascadeChains;

    const negativeSum = bd.prosperityBonus + bd.fullSecurityBonus;
    const rawScore    = positiveSum - negativeSum;

    // ── Dominant signal: highest positive contributor, priority tie-break ─
    let dominantSignal: keyof SignalBreakdown | null = null;
    let dominantValue = 0;
    for (const key of DOMINANT_SIGNAL_PRIORITY) {
      const val = bd[key as keyof SignalBreakdown];
      if (val > dominantValue) {
        dominantValue = val;
        dominantSignal = key as keyof SignalBreakdown;
      }
      // Equal values: first in DOMINANT_SIGNAL_PRIORITY list wins (strict > only)
    }

    return { rawScore, breakdown: bd, dominantSignal };
  }
}
