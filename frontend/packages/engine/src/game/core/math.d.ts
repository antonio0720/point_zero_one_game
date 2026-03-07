/** Clamp n within [min, max] inclusive. */
export declare function clamp(n: number, min: number, max: number): number;
/** Linear interpolation between a and b by t ∈ [0,1]. Clamps t. */
export declare function lerp(a: number, b: number, t: number): number;
/** Smooth step interpolation — ease in/out between 0 and 1. */
export declare function smoothstep(t: number): number;
/** Ease-out cubic: fast start, gradual stop. */
export declare function easeOut(t: number): number;
/** Compute value/total as a [0,1] ratio. Returns 0 when total is 0. */
export declare function pct(value: number, total: number): number;
/** Compute value/total as a [0,100] percentage. Returns 0 when total is 0. */
export declare function pct100(value: number, total: number): number;
/** Round to N decimal places. */
export declare function round(n: number, decimals?: number): number;
/**
 * Exponential decay: value × (1 - rate)^ticks.
 * Equivalent to multiplying by (1-rate) for each tick elapsed.
 */
export declare function exponentialDecay(value: number, rate: number, ticks?: number): number;
/**
 * Linear decay: value - rate × ticks, clamped to 0.
 * Used for shield regen, heat decay, trust leakage.
 */
export declare function linearDecay(value: number, rate: number, ticks?: number): number;
/**
 * Sigmoid function — maps any real number to [0,1].
 * Used for pressure score normalization.
 */
export declare function sigmoid(x: number, steepness?: number): number;
export interface WeightedSignal {
    value: number;
    weight: number;
}
/**
 * Compute weighted average of signals.
 * Returns 0 if total weight is 0.
 */
export declare function weightedAverage(signals: WeightedSignal[]): number;
/**
 * Annualized ROI from monthly cashflow and total cost.
 * Returns 0 when cost is 0.
 */
export declare function annualizedROI(monthlyYield: number, totalCost: number): number;
/**
 * Cashflow Coverage Ratio: income / expenses.
 * 1.0 = break-even. >1 = surplus. <1 = deficit.
 */
export declare function cashflowCoverage(income: number, expenses: number): number;
/**
 * Herfindahl-Hirschman Index for portfolio concentration.
 * Lower = more diversified. 1.0 = fully concentrated.
 * @param shares Array of portfolio weight fractions (should sum to 1.0).
 */
export declare function hhi(shares: number[]): number;
/**
 * Net Worth Growth Rate: (current - previous) / |previous|.
 * Returns 0 when previous is 0.
 */
export declare function growthRate(current: number, previous: number): number;
/** Convert ticks to months (integer). */
export declare function ticksToMonths(ticks: number, ticksPerMonth?: number): number;
/** Convert months to ticks. */
export declare function monthsToTicks(months: number, ticksPerMonth?: number): number;
/** Progress ratio through the season: tick / seasonBudget → [0,1]. */
export declare function seasonProgress(tick: number, seasonBudget: number): number;
/** Extract the numeric suffix from a mechanic ID like 'M042a' → 42. */
export declare function idNum(id: string): number;
/**
 * Roll a weighted outcome from a probability map.
 * Probabilities need not sum to 1 — the function normalizes.
 */
export declare function weightedRoll<T extends string>(weights: Record<T, number>, rng: () => number): T;
/** Bernoulli trial: returns true with probability p using provided rng. */
export declare function bernoulli(p: number, rng: () => number): boolean;
/**
 * Normalize a raw score into [0, maxPoints] range,
 * with an optional soft-cap at softCapAt (above it: diminishing returns).
 */
export declare function normalizeScore(raw: number, maxRaw: number, maxPoints: number, softCapAt?: number): number;
//# sourceMappingURL=math.d.ts.map