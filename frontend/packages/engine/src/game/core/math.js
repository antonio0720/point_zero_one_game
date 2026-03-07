"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/math.ts
// Sprint 3: Pure Math Utilities — Engine-Complete
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Zero side effects. No imports. Every engine can safely import from here.
// All functions are pure, deterministic, and safe for 20M concurrent calls.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.lerp = lerp;
exports.smoothstep = smoothstep;
exports.easeOut = easeOut;
exports.pct = pct;
exports.pct100 = pct100;
exports.round = round;
exports.exponentialDecay = exponentialDecay;
exports.linearDecay = linearDecay;
exports.sigmoid = sigmoid;
exports.weightedAverage = weightedAverage;
exports.annualizedROI = annualizedROI;
exports.cashflowCoverage = cashflowCoverage;
exports.hhi = hhi;
exports.growthRate = growthRate;
exports.ticksToMonths = ticksToMonths;
exports.monthsToTicks = monthsToTicks;
exports.seasonProgress = seasonProgress;
exports.idNum = idNum;
exports.weightedRoll = weightedRoll;
exports.bernoulli = bernoulli;
exports.normalizeScore = normalizeScore;
// ── Clamping & Interpolation ──────────────────────────────────────────────────
/** Clamp n within [min, max] inclusive. */
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
/** Linear interpolation between a and b by t ∈ [0,1]. Clamps t. */
function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}
/** Smooth step interpolation — ease in/out between 0 and 1. */
function smoothstep(t) {
    const tc = clamp(t, 0, 1);
    return tc * tc * (3 - 2 * tc);
}
/** Ease-out cubic: fast start, gradual stop. */
function easeOut(t) {
    const tc = 1 - clamp(t, 0, 1);
    return 1 - tc * tc * tc;
}
// ── Ratio & Percentage ────────────────────────────────────────────────────────
/** Compute value/total as a [0,1] ratio. Returns 0 when total is 0. */
function pct(value, total) {
    if (total === 0)
        return 0;
    return clamp(value / total, 0, 1);
}
/** Compute value/total as a [0,100] percentage. Returns 0 when total is 0. */
function pct100(value, total) {
    return pct(value, total) * 100;
}
/** Round to N decimal places. */
function round(n, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(n * factor) / factor;
}
// ── Decay Functions (used by Pressure, Tension, ML engines) ──────────────────
/**
 * Exponential decay: value × (1 - rate)^ticks.
 * Equivalent to multiplying by (1-rate) for each tick elapsed.
 */
function exponentialDecay(value, rate, ticks = 1) {
    return value * Math.pow(1 - clamp(rate, 0, 1), ticks);
}
/**
 * Linear decay: value - rate × ticks, clamped to 0.
 * Used for shield regen, heat decay, trust leakage.
 */
function linearDecay(value, rate, ticks = 1) {
    return Math.max(0, value - rate * ticks);
}
/**
 * Sigmoid function — maps any real number to [0,1].
 * Used for pressure score normalization.
 */
function sigmoid(x, steepness = 1) {
    return 1 / (1 + Math.exp(-steepness * x));
}
/**
 * Compute weighted average of signals.
 * Returns 0 if total weight is 0.
 */
function weightedAverage(signals) {
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0)
        return 0;
    const weightedSum = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
    return clamp(weightedSum / totalWeight, 0, 1);
}
// ── Financial Math (CardValuation, Economy Engine) ────────────────────────────
/**
 * Annualized ROI from monthly cashflow and total cost.
 * Returns 0 when cost is 0.
 */
function annualizedROI(monthlyYield, totalCost) {
    if (totalCost === 0)
        return 0;
    return (monthlyYield * 12) / totalCost;
}
/**
 * Cashflow Coverage Ratio: income / expenses.
 * 1.0 = break-even. >1 = surplus. <1 = deficit.
 */
function cashflowCoverage(income, expenses) {
    if (expenses === 0)
        return income > 0 ? 999 : 0;
    return income / expenses;
}
/**
 * Herfindahl-Hirschman Index for portfolio concentration.
 * Lower = more diversified. 1.0 = fully concentrated.
 * @param shares Array of portfolio weight fractions (should sum to 1.0).
 */
function hhi(shares) {
    return shares.reduce((sum, s) => sum + s * s, 0);
}
/**
 * Net Worth Growth Rate: (current - previous) / |previous|.
 * Returns 0 when previous is 0.
 */
function growthRate(current, previous) {
    if (previous === 0)
        return 0;
    return (current - previous) / Math.abs(previous);
}
// ── Tick Math (Time Engine) ────────────────────────────────────────────────────
/** Convert ticks to months (integer). */
function ticksToMonths(ticks, ticksPerMonth = 12) {
    return Math.floor(ticks / ticksPerMonth);
}
/** Convert months to ticks. */
function monthsToTicks(months, ticksPerMonth = 12) {
    return months * ticksPerMonth;
}
/** Progress ratio through the season: tick / seasonBudget → [0,1]. */
function seasonProgress(tick, seasonBudget) {
    return pct(tick, seasonBudget);
}
// ── ID Utilities ──────────────────────────────────────────────────────────────
/** Extract the numeric suffix from a mechanic ID like 'M042a' → 42. */
function idNum(id) {
    const m = id.match(/M(\d+)/i);
    return m ? Number(m[1]) : 0;
}
// ── Probability Helpers ───────────────────────────────────────────────────────
/**
 * Roll a weighted outcome from a probability map.
 * Probabilities need not sum to 1 — the function normalizes.
 */
function weightedRoll(weights, rng) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let threshold = rng() * total;
    for (const [key, w] of entries) {
        threshold -= w;
        if (threshold <= 0)
            return key;
    }
    return entries[entries.length - 1][0];
}
/** Bernoulli trial: returns true with probability p using provided rng. */
function bernoulli(p, rng) {
    return rng() < clamp(p, 0, 1);
}
// ── Score Aggregation (Sovereignty/ProofCard) ─────────────────────────────────
/**
 * Normalize a raw score into [0, maxPoints] range,
 * with an optional soft-cap at softCapAt (above it: diminishing returns).
 */
function normalizeScore(raw, maxRaw, maxPoints, softCapAt) {
    if (maxRaw <= 0)
        return 0;
    const ratio = clamp(raw / maxRaw, 0, 1);
    const softCap = softCapAt ?? 1;
    const adjusted = ratio < softCap
        ? ratio
        : softCap + (ratio - softCap) * 0.5; // diminishing returns above soft cap
    return round(adjusted * maxPoints, 1);
}
//# sourceMappingURL=math.js.map