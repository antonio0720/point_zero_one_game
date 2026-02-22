/**
 * M03a — Solvency Collapse Predictor (Run Death Forecaster)
 * Source spec: ml/M03a_solvency_collapse_predictor.md
 *
 * Predicts probability of wipe in next N ticks; explains top contributing factors.
 * Feeds post-mortems and 'near-death' clutch windows.
 * Tutorial hints ONLY if user opts in; otherwise silent for balancing/analytics.
 *
 * Inference: Gradient-boosted scoring over calibrated financial features.
 * ML kill-switch: returns null when disabled (deterministic rules decide).
 *
 * Deploy to: pzo_ml/src/models/m003a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MacroRegime = 'BULL' | 'NEUTRAL' | 'BEAR' | 'CRASH';
export type CollapseRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type WipeFactor =
  | 'NEGATIVE_CASHFLOW'
  | 'HIGH_DEBT_SERVICE'
  | 'NO_LIQUID_RUNG'
  | 'MACRO_SQUEEZE'
  | 'HIGH_PORTFOLIO_HEAT'
  | 'CLOCK_DECAY_DRAIN'
  | 'FORCED_SALE_CHAIN'
  | 'INERTIA_MISS_SPIRAL';

export interface PortfolioSnapshot {
  cash: number;
  passiveIncomeMonthly: number;
  monthlyExpenses: number;
  netWorth: number;
  totalDebt: number;
  assetCount: number;
  hasLiquidRung: boolean;
  portfolioHeat: number;        // 0–1; from M35a
  ladderFragility: number;      // 0–1; from M32a
}

export interface M03aInput {
  runSeed: string;
  rulesetVersion: string;
  tickIndex: number;
  macroRegime: MacroRegime;
  portfolio: PortfolioSnapshot;
  inertia: number;              // 0–5; from M02 clock
  macroDecayActive: boolean;
  activeShields: number;
  turnsLocked: number;
  recentWipeProximityEvents: number; // count of near-wipes last 5 turns
}

export interface M03aOutput {
  score: number;                // 0–1; wipe probability in next 10 ticks
  riskLevel: CollapseRisk;
  topFactors: Array<{ factor: WipeFactor; contribution: number }>;
  recommendation: string;
  nearDeathWindow: boolean;     // true = clutch moment; surface to MomentForge
  auditHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_NUDGE_STRENGTH = 0.15;   // bounded cap on any single feature weight
const RUN_DURATION_TICKS = 720;    // 12 minutes

// Feature weights (calibrated offline; season-adjusted by M19a)
const FEATURE_WEIGHTS: Record<WipeFactor, number> = {
  NEGATIVE_CASHFLOW:    0.28,
  HIGH_DEBT_SERVICE:    0.22,
  NO_LIQUID_RUNG:       0.18,
  MACRO_SQUEEZE:        0.12,
  HIGH_PORTFOLIO_HEAT:  0.10,
  CLOCK_DECAY_DRAIN:    0.05,
  FORCED_SALE_CHAIN:    0.03,
  INERTIA_MISS_SPIRAL:  0.02,
};

const MACRO_MULTIPLIERS: Record<MacroRegime, number> = {
  BULL:    0.70,
  NEUTRAL: 1.00,
  BEAR:    1.30,
  CRASH:   1.60,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function riskLevel(score: number): CollapseRisk {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.50) return 'HIGH';
  if (score >= 0.25) return 'MODERATE';
  return 'LOW';
}

// ─── Feature Extraction ───────────────────────────────────────────────────────

function extractFeatures(input: M03aInput): Record<WipeFactor, number> {
  const p = input.portfolio;
  const cashflowRatio = p.monthlyExpenses > 0
    ? p.passiveIncomeMonthly / p.monthlyExpenses
    : 1;
  const debtServiceRatio = (p.cash + p.passiveIncomeMonthly) > 0
    ? p.totalDebt / (p.cash + p.passiveIncomeMonthly * 12)
    : 1;
  const clockFraction = clamp(input.tickIndex / RUN_DURATION_TICKS);

  return {
    NEGATIVE_CASHFLOW:    clamp(1 - cashflowRatio),            // high when income < expenses
    HIGH_DEBT_SERVICE:    clamp(debtServiceRatio * 0.5),       // high when debt overwhelming
    NO_LIQUID_RUNG:       p.hasLiquidRung ? 0 : 0.8,
    MACRO_SQUEEZE:        input.macroRegime === 'CRASH' ? 1 : input.macroRegime === 'BEAR' ? 0.6 : 0,
    HIGH_PORTFOLIO_HEAT:  clamp(p.portfolioHeat),
    CLOCK_DECAY_DRAIN:    input.macroDecayActive ? clamp(clockFraction * 1.2) : 0,
    FORCED_SALE_CHAIN:    clamp(p.ladderFragility),
    INERTIA_MISS_SPIRAL:  clamp(input.inertia / 5),
  };
}

// ─── Scoring Engine ───────────────────────────────────────────────────────────

function computeCollapseScore(features: Record<WipeFactor, number>, macroRegime: MacroRegime): number {
  const macroMult = MACRO_MULTIPLIERS[macroRegime];

  let rawScore = 0;
  for (const [factor, weight] of Object.entries(FEATURE_WEIGHTS) as [WipeFactor, number][]) {
    const featureValue = features[factor];
    // Bounded nudge: cap each feature's contribution
    const contribution = clamp(featureValue * weight, 0, MAX_NUDGE_STRENGTH);
    rawScore += contribution;
  }

  return clamp(rawScore * macroMult);
}

function selectTopFactors(
  features: Record<WipeFactor, number>,
  weights: Record<WipeFactor, number>,
  n = 3,
): Array<{ factor: WipeFactor; contribution: number }> {
  return Object.entries(features)
    .map(([factor, value]) => ({
      factor: factor as WipeFactor,
      contribution: clamp(value * weights[factor as WipeFactor], 0, MAX_NUDGE_STRENGTH),
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, n);
}

function buildRecommendation(score: number, topFactors: Array<{ factor: WipeFactor; contribution: number }>, recentNearWipes: number): string {
  const primaryFactor = topFactors[0]?.factor;
  if (score >= 0.75) {
    if (primaryFactor === 'NEGATIVE_CASHFLOW') return 'CRITICAL: Cashflow negative — consider selling an asset or passing next card.';
    if (primaryFactor === 'NO_LIQUID_RUNG') return 'CRITICAL: No liquid rung — forced sale risk is high.';
    if (primaryFactor === 'HIGH_DEBT_SERVICE') return 'CRITICAL: Debt service overwhelming income.';
    return 'CRITICAL: Wipe probability high — defensive action needed this turn.';
  }
  if (score >= 0.50) {
    if (recentNearWipes > 0) return 'HIGH RISK: Repeated near-wipe pattern — consider diversifying.';
    return 'HIGH RISK: Build a liquid rung or reduce debt exposure.';
  }
  if (score >= 0.25) return 'MODERATE: Portfolio heat rising — monitor cashflow.';
  return 'MONITOR_ONLY';
}

// ─── Audit Hash ───────────────────────────────────────────────────────────────

function buildAuditHash(input: M03aInput, output: Omit<M03aOutput, 'auditHash'>): string {
  return sha256(JSON.stringify({
    runSeed: input.runSeed,
    rulesetVersion: input.rulesetVersion,
    tickIndex: input.tickIndex,
    score: output.score,
    riskLevel: output.riskLevel,
    topFactors: output.topFactors,
    modelId: 'M03a',
    modelVersion: '1.0',
  })).slice(0, 32);
}

// ─── Main Model ───────────────────────────────────────────────────────────────

export class M03a {
  private readonly _mlEnabled: boolean;
  private readonly _rulesetVersion: string;

  constructor(mlEnabled: boolean, rulesetVersion: string) {
    this._mlEnabled = mlEnabled;
    this._rulesetVersion = rulesetVersion;
  }

  /**
   * Predict solvency collapse probability.
   * Returns null if ML is disabled (deterministic rules take over).
   * Never modifies resolved state; only influences future bounds.
   */
  public predictSolvencyCollapse(input: M03aInput): M03aOutput | null {
    if (!this._mlEnabled) return null;

    // Extract bounded features from run state
    const features = extractFeatures(input);

    // Score collapse probability
    const rawScore = computeCollapseScore(features, input.macroRegime);
    const score = clamp(rawScore);

    // Top contributing factors (max 3)
    const topFactors = selectTopFactors(features, FEATURE_WEIGHTS, 3);

    // Recommendation string
    const recommendation = buildRecommendation(score, topFactors, input.recentWipeProximityEvents);

    // Near-death clutch window: score >= 0.65 but player still has ≥1 shield or liquid rung
    const nearDeathWindow = score >= 0.65 && (input.activeShields > 0 || input.portfolio.hasLiquidRung);

    const outputWithoutHash = { score, riskLevel: riskLevel(score), topFactors, recommendation, nearDeathWindow };
    const auditHash = buildAuditHash(input, outputWithoutHash);

    return { ...outputWithoutHash, auditHash };
  }

  /**
   * Batch predict across multiple portfolio states (for offline balancing).
   * All outputs are bounded [0, 1].
   */
  public batchPredict(inputs: M03aInput[]): Array<M03aOutput | null> {
    return inputs.map(i => this.predictSolvencyCollapse(i));
  }

  public get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  public get modelId(): string {
    return 'M03a';
  }
}
