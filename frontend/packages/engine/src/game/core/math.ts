// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/math.ts
// Sprint 3: Pure Math Utilities — Engine-Complete
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Zero side effects. No imports. Every engine can safely import from here.
// All functions are pure, deterministic, and safe for 20M concurrent calls.
// ═══════════════════════════════════════════════════════════════════════════

// ── Clamping & Interpolation ──────────────────────────────────────────────────

/** Clamp n within [min, max] inclusive. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Linear interpolation between a and b by t ∈ [0,1]. Clamps t. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Smooth step interpolation — ease in/out between 0 and 1. */
export function smoothstep(t: number): number {
  const tc = clamp(t, 0, 1);
  return tc * tc * (3 - 2 * tc);
}

/** Ease-out cubic: fast start, gradual stop. */
export function easeOut(t: number): number {
  const tc = 1 - clamp(t, 0, 1);
  return 1 - tc * tc * tc;
}

// ── Ratio & Percentage ────────────────────────────────────────────────────────

/** Compute value/total as a [0,1] ratio. Returns 0 when total is 0. */
export function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return clamp(value / total, 0, 1);
}

/** Compute value/total as a [0,100] percentage. Returns 0 when total is 0. */
export function pct100(value: number, total: number): number {
  return pct(value, total) * 100;
}

/** Round to N decimal places. */
export function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

// ── Decay Functions (used by Pressure, Tension, ML engines) ──────────────────

/**
 * Exponential decay: value × (1 - rate)^ticks.
 * Equivalent to multiplying by (1-rate) for each tick elapsed.
 */
export function exponentialDecay(value: number, rate: number, ticks = 1): number {
  return value * Math.pow(1 - clamp(rate, 0, 1), ticks);
}

/**
 * Linear decay: value - rate × ticks, clamped to 0.
 * Used for shield regen, heat decay, trust leakage.
 */
export function linearDecay(value: number, rate: number, ticks = 1): number {
  return Math.max(0, value - rate * ticks);
}

/**
 * Sigmoid function — maps any real number to [0,1].
 * Used for pressure score normalization.
 */
export function sigmoid(x: number, steepness = 1): number {
  return 1 / (1 + Math.exp(-steepness * x));
}

// ── Weighted Composition (Pressure engine score aggregation) ─────────────────

export interface WeightedSignal {
  value:  number;  // raw signal value [0–1]
  weight: number;  // relative weight
}

/**
 * Compute weighted average of signals.
 * Returns 0 if total weight is 0.
 */
export function weightedAverage(signals: WeightedSignal[]): number {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  return clamp(weightedSum / totalWeight, 0, 1);
}

// ── Financial Math (CardValuation, Economy Engine) ────────────────────────────

/**
 * Annualized ROI from monthly cashflow and total cost.
 * Returns 0 when cost is 0.
 */
export function annualizedROI(monthlyYield: number, totalCost: number): number {
  if (totalCost === 0) return 0;
  return (monthlyYield * 12) / totalCost;
}

/**
 * Cashflow Coverage Ratio: income / expenses.
 * 1.0 = break-even. >1 = surplus. <1 = deficit.
 */
export function cashflowCoverage(income: number, expenses: number): number {
  if (expenses === 0) return income > 0 ? 999 : 0;
  return income / expenses;
}

/**
 * Herfindahl-Hirschman Index for portfolio concentration.
 * Lower = more diversified. 1.0 = fully concentrated.
 * @param shares Array of portfolio weight fractions (should sum to 1.0).
 */
export function hhi(shares: number[]): number {
  return shares.reduce((sum, s) => sum + s * s, 0);
}

/**
 * Net Worth Growth Rate: (current - previous) / |previous|.
 * Returns 0 when previous is 0.
 */
export function growthRate(current: number, previous: number): number {
  if (previous === 0) return 0;
  return (current - previous) / Math.abs(previous);
}

// ── Tick Math (Time Engine) ────────────────────────────────────────────────────

/** Convert ticks to months (integer). */
export function ticksToMonths(ticks: number, ticksPerMonth = 12): number {
  return Math.floor(ticks / ticksPerMonth);
}

/** Convert months to ticks. */
export function monthsToTicks(months: number, ticksPerMonth = 12): number {
  return months * ticksPerMonth;
}

/** Progress ratio through the season: tick / seasonBudget → [0,1]. */
export function seasonProgress(tick: number, seasonBudget: number): number {
  return pct(tick, seasonBudget);
}

// ── ID Utilities ──────────────────────────────────────────────────────────────

/** Extract the numeric suffix from a mechanic ID like 'M042a' → 42. */
export function idNum(id: string): number {
  const m = id.match(/M(\d+)/i);
  return m ? Number(m[1]) : 0;
}

// ── Probability Helpers ───────────────────────────────────────────────────────

/**
 * Roll a weighted outcome from a probability map.
 * Probabilities need not sum to 1 — the function normalizes.
 */
export function weightedRoll<T extends string>(
  weights: Record<T, number>,
  rng:     () => number,
): T {
  const entries   = Object.entries(weights) as [T, number][];
  const total     = entries.reduce((sum, [, w]) => sum + w, 0);
  let   threshold = rng() * total;
  for (const [key, w] of entries) {
    threshold -= w;
    if (threshold <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Bernoulli trial: returns true with probability p using provided rng. */
export function bernoulli(p: number, rng: () => number): boolean {
  return rng() < clamp(p, 0, 1);
}

// ── Score Aggregation (Sovereignty/ProofCard) ─────────────────────────────────

/**
 * Normalize a raw score into [0, maxPoints] range,
 * with an optional soft-cap at softCapAt (above it: diminishing returns).
 */
export function normalizeScore(
  raw:        number,
  maxRaw:     number,
  maxPoints:  number,
  softCapAt?: number,
): number {
  if (maxRaw <= 0) return 0;
  const ratio = clamp(raw / maxRaw, 0, 1);
  const softCap = softCapAt ?? 1;
  const adjusted = ratio < softCap
    ? ratio
    : softCap + (ratio - softCap) * 0.5;  // diminishing returns above soft cap
  return round(adjusted * maxPoints, 1);
}
