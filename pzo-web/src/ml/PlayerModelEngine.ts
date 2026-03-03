/**
 * PlayerModelEngine — src/ml/PlayerModelEngine.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #1: Player Model Transformer
 *
 * Computes real-time intelligence bars from live run state.
 * Replaces static heuristics with derived signal computation.
 *
 * In production: feed action sequences to a server-side Transformer
 * and receive predictions. This module handles:
 *   - Feature extraction from run state
 *   - Client-side fallback computation (deterministic heuristics)
 *   - Output normalization into IntelligenceState shape
 */

import type { SessionAction } from '../types/club';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunSnapshot {
  tick:               number;
  totalTicks:         number;
  cash:               number;
  startingCash:       number;
  monthlyIncome:      number;
  monthlyExpenses:    number;
  fubarHits:          number;
  shieldsUsed:        number;
  hubrisMeter:        number;       // 0–100
  pressureScore:      number;       // 0–100
  tensionScore:       number;       // 0–100
  activeBiasCount:    number;
  windowsMissed:      number;
  windowsResolved:    number;
  recentPlayDelays:   number[];     // last 5 window response times (ms)
  portfolioDiversity: number;       // HHI 0–1 (lower = more diverse)
  obligationCoverage: number;       // income/obligations ratio
}

export interface IntelligenceOutput {
  /** Predictive power of current model for this run (0–1) */
  alpha:               number;
  /** Composite risk score (0–1) */
  risk:                number;
  /** Market volatility signal (0–1) */
  volatility:          number;
  /** Anti-cheat confidence (1 = clean) */
  antiCheat:           number;
  /** Deck personalization fit (0–1) */
  personalization:     number;
  /** Card recommendation confidence (0–1) */
  rewardFit:           number;
  /** Active recommendation confidence (0–1) */
  recommendationPower: number;
  /** Churn risk in next 30 ticks (0–1) */
  churnRisk:           number;
  /** Run trajectory momentum (−1 to +1) */
  momentum:            number;
  /** Cognitive bias activation (0–1) */
  biasScore:           number;
  /** Proximity to optimal play path (0–1) */
  convergenceSignal:   number;
  /** Session-level momentum (0–1) */
  sessionMomentum:     number;

  // ── Extended predictions ──────────────────────────────────────────────────
  /** Probability of bankruptcy in next 60 ticks (0–1) */
  bankruptcyRisk60:    number;
  /** Probability of missing next decision window (0–1) */
  windowFailRisk:      number;
  /** Tilt risk — speed degradation + bad choices (0–1) */
  tiltRisk:            number;
  /** Estimated opportunity cost of passing current window ($/tick) */
  opportunityCostEst:  number;
}

// ─── Feature Extraction ───────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

function movingAvg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ─── Bankruptcy Risk Model ────────────────────────────────────────────────────
// Logistic approximation derived from:
//   - cash runway (months of obligations covered)
//   - obligation coverage ratio
//   - pressure score
//   - fubar rate
function estimateBankruptcyRisk(snap: RunSnapshot): number {
  const monthlyDrain = Math.max(0, snap.monthlyExpenses - snap.monthlyIncome);
  const runway = monthlyDrain > 0 ? snap.cash / monthlyDrain : 99;
  const runwayScore = clamp(1 - runway / 12); // 0 = safe, 1 = 0 months left

  const coverageRisk = clamp(1 - snap.obligationCoverage / 2);
  const pressureRisk = clamp(snap.pressureScore / 100);
  const fubarRate    = snap.tick > 0
    ? clamp(snap.fubarHits / (snap.tick / 12))
    : 0;

  return clamp(
    runwayScore * 0.40 +
    coverageRisk * 0.30 +
    pressureRisk * 0.20 +
    fubarRate * 0.10,
  );
}

// ─── Window Fail Risk ─────────────────────────────────────────────────────────
function estimateWindowFailRisk(snap: RunSnapshot): number {
  const avgDelay = movingAvg(snap.recentPlayDelays);
  const delayScore = clamp(avgDelay / 8000); // 8s = tier-1 window

  const missRate = snap.windowsMissed + snap.windowsResolved > 0
    ? snap.windowsMissed / (snap.windowsMissed + snap.windowsResolved)
    : 0;

  const pressureComp = clamp(snap.pressureScore / 100) * 0.3;

  return clamp(delayScore * 0.4 + missRate * 0.4 + pressureComp);
}

// ─── Tilt Risk ────────────────────────────────────────────────────────────────
function estimateTiltRisk(snap: RunSnapshot, recentActions: SessionAction[]): number {
  // Speed degradation: recent plays slower than earlier
  const delays = snap.recentPlayDelays;
  const speedDeg = delays.length >= 4
    ? clamp((movingAvg(delays.slice(-2)) - movingAvg(delays.slice(0, 2))) / 5000)
    : 0;

  const biasComp  = clamp(snap.activeBiasCount / 3);
  const hubrisComp = clamp(snap.hubrisMeter / 100);

  // Consecutive bad window choices in last 5 actions
  const badChoices = recentActions
    .filter(a => a.type === 'window_auto_resolved')
    .length / Math.max(1, recentActions.length);

  return clamp(
    speedDeg * 0.25 +
    biasComp * 0.30 +
    hubrisComp * 0.20 +
    badChoices * 0.25,
  );
}

// ─── Opportunity Cost Estimate ────────────────────────────────────────────────
function estimateOpportunityCost(snap: RunSnapshot): number {
  // Simple: if income gap is positive and window is missed, cost = income delta per tick
  const monthlyGap = snap.monthlyIncome - snap.monthlyExpenses;
  const ticksPerMonth = 12;
  return Math.max(0, monthlyGap / ticksPerMonth);
}

// ─── Main Compute ─────────────────────────────────────────────────────────────

export function computeIntelligence(
  snap: RunSnapshot,
  recentActions: SessionAction[] = [],
  sessionRunCount = 1,
): IntelligenceOutput {
  const progressPct   = snap.tick / Math.max(1, snap.totalTicks);
  const cashGrowth    = clamp((snap.cash - snap.startingCash) / Math.max(1, snap.startingCash), -1, 3) / 3;
  const survivalScore = clamp(snap.obligationCoverage / 2);

  const bankruptcyRisk60 = estimateBankruptcyRisk(snap);
  const windowFailRisk   = estimateWindowFailRisk(snap);
  const tiltRisk         = estimateTiltRisk(snap, recentActions);
  const opportunityCostEst = estimateOpportunityCost(snap);

  const risk          = clamp(bankruptcyRisk60 * 0.5 + tiltRisk * 0.3 + clamp(snap.tensionScore / 100) * 0.2);
  const momentum      = clamp(cashGrowth * 0.5 + survivalScore * 0.3 - risk * 0.2, -1, 1);
  const biasScore     = clamp(snap.activeBiasCount / 4 + snap.hubrisMeter / 200);
  const churnRisk     = clamp(tiltRisk * 0.4 + bankruptcyRisk60 * 0.3 + biasScore * 0.3);
  const convergence   = clamp(1 - risk * 0.5 - biasScore * 0.3 - windowFailRisk * 0.2);
  const sessionMom    = clamp(sessionRunCount / 10);
  const alpha         = clamp(0.5 + convergence * 0.3 + progressPct * 0.2);

  return {
    alpha,
    risk,
    volatility:          clamp(snap.pressureScore / 100 * 0.7 + snap.tensionScore / 100 * 0.3),
    antiCheat:           1.0, // overridden by BehavioralAnomalyDetector
    personalization:     clamp(0.6 + convergence * 0.4),
    rewardFit:           clamp(0.5 + survivalScore * 0.3 + convergence * 0.2),
    recommendationPower: clamp(alpha * convergence),
    churnRisk,
    momentum,
    biasScore,
    convergenceSignal:   convergence,
    sessionMomentum:     sessionMom,
    bankruptcyRisk60,
    windowFailRisk,
    tiltRisk,
    opportunityCostEst,
  };
}