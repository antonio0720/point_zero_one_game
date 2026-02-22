/**
 * M107a — Refi Ladder (ML/DL Companion: Refi Eligibility Estimator + Term Optimizer)
 * Source spec: ml/M107a_refi_ladder_ml_dl_companion_refi_eligibility_estimator_term_optimizer.md
 *
 * Predicts which refi rung is realistically attainable before the player commits time.
 * Optimizes term/rate/collateral combos under published constraints.
 * Detects 'refi illusion' traps and warns with receipts.
 *
 * Inference: only when refi UI is opened. Budget ≤15ms; timeout → static hints.
 * Privacy: no PII; hashed+bucketed features only.
 *
 * Deploy to: pzo_ml/src/models/m107a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RefiRung = 'RUNG_1_RATE_REDUCTION' | 'RUNG_2_TERM_EXTENSION' | 'RUNG_3_CASH_OUT' | 'RUNG_4_FULL_RESTRUCTURE';
export type RefiFeasibility = 'LOW' | 'MEDIUM' | 'HIGH';
export type RefiIllusionType =
  | 'NEGATIVE_CARRY'           // refi increases monthly cost net of fee
  | 'UNDERWATER_COLLATERAL'    // asset worth less than refi loan amount
  | 'COVENANT_BREACH'          // player violates a debt covenant post-refi
  | 'CLOCK_TOO_LATE';          // not enough run time to recoup refi fees

export interface RefiInput {
  playerId: string;
  runSeed: string;
  rulesetVersion: string;
  tickIndex: number;
  cashflowVolatility: number;    // 0–1; standard deviation of monthly cashflow
  covenantStatus: 'OK' | 'WARNING' | 'BREACH';
  liquidityScore: number;        // 0–1; from M32a
  collateralQuality: number;     // 0–1; exit value / current debt ratio capped
  currentDebtRate: number;       // monthly rate fraction (e.g. 0.008 = 0.8%/mo)
  currentTermRemaining: number;  // turns remaining on current debt
  totalDebt: number;
  assetCurrentValue: number;
  monthlyExpenses: number;
  refiAggressivenessPreference: number; // opt-in: 0 = conservative, 1 = aggressive
}

export interface RefiConfiguration {
  rung: RefiRung;
  newRate: number;               // proposed new monthly rate
  newTerm: number;               // proposed new term in turns
  upfrontFee: number;            // cash cost to refi
  newMonthlyDebtService: number;
  projectedHeat: number;         // 0–1 portfolio heat post-refi
  projectedFees: number;         // total fees over life of new loan
  netCarryImpact: number;        // monthly cashflow delta (positive = savings)
}

export interface RefiReceipt {
  runSeed: string;
  tickIndex: number;
  rungSelected: RefiRung;
  feasibility: RefiFeasibility;
  projectedVsRealized: string;   // set post-refi for accountability
  rationale: string[];
  receiptHash: string;
}

export interface M107aOutput {
  feasibilityScore: number;      // 0–1 (bounded)
  feasibilityLevel: RefiFeasibility;
  optimalTerm: number;           // 0–1 normalized term suggestion
  topConfigurations: RefiConfiguration[];
  illusionWarnings: Array<{ type: RefiIllusionType; description: string }>;
  receipt: RefiReceipt;
  auditHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_NUDGE = 0.15;
const RUN_DURATION_TICKS = 720;

// Rung thresholds: minimum conditions to qualify
const RUNG_THRESHOLDS: Record<RefiRung, { minLiquidity: number; maxVolatility: number; minCollateral: number }> = {
  RUNG_1_RATE_REDUCTION:    { minLiquidity: 0.30, maxVolatility: 0.70, minCollateral: 0.60 },
  RUNG_2_TERM_EXTENSION:    { minLiquidity: 0.40, maxVolatility: 0.60, minCollateral: 0.70 },
  RUNG_3_CASH_OUT:          { minLiquidity: 0.50, maxVolatility: 0.50, minCollateral: 0.80 },
  RUNG_4_FULL_RESTRUCTURE:  { minLiquidity: 0.65, maxVolatility: 0.40, minCollateral: 0.90 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function feasibilityLevel(score: number): RefiFeasibility {
  if (score >= 0.65) return 'HIGH';
  if (score >= 0.35) return 'MEDIUM';
  return 'LOW';
}

// ─── Eligibility Estimation ───────────────────────────────────────────────────

/**
 * Estimate refi rung feasibility score.
 * Features: liquidity, volatility, covenant status, collateral, clock remaining.
 * All bounded [0,1].
 */
function estimateRefiScore(input: RefiInput): number {
  // Base score from collateral quality and liquidity
  let score = clamp(input.collateralQuality * 0.40 + input.liquidityScore * 0.30);

  // Volatility penalty: high cashflow volatility → harder to refi
  score -= clamp(input.cashflowVolatility * 0.20);

  // Covenant penalty
  if (input.covenantStatus === 'BREACH') score -= 0.30;
  else if (input.covenantStatus === 'WARNING') score -= 0.10;

  // Clock penalty: late in run → less time to recoup refi fees
  const clockFraction = input.tickIndex / RUN_DURATION_TICKS;
  if (clockFraction > 0.75) score -= 0.20;
  else if (clockFraction > 0.50) score -= 0.10;

  // Aggressiveness preference boost (opt-in only)
  score += input.refiAggressivenessPreference * MAX_NUDGE;

  return clamp(score);
}

// ─── Term Optimization ────────────────────────────────────────────────────────

/**
 * Optimize term given current debt conditions.
 * Returns a normalized 0–1 term suggestion.
 * 0 = shortest feasible term; 1 = maximum term extension.
 */
function optimizeTerm(input: RefiInput): number {
  const ticksRemaining = RUN_DURATION_TICKS - input.tickIndex;
  const debtRatio = input.totalDebt > 0 && input.assetCurrentValue > 0
    ? input.totalDebt / input.assetCurrentValue
    : 0;

  // High debt ratio + low time remaining → shorter term (minimize fees)
  // Low debt ratio + high time remaining → can extend term
  const termScore = clamp(
    (1 - debtRatio) * 0.60 + (ticksRemaining / RUN_DURATION_TICKS) * 0.40,
  );

  // Aggressiveness: aggressive players prefer longer terms for cashflow relief
  return clamp(termScore + input.refiAggressivenessPreference * MAX_NUDGE * 0.5);
}

// ─── Configuration Builder ────────────────────────────────────────────────────

function buildRefiConfiguration(rung: RefiRung, input: RefiInput, score: number): RefiConfiguration {
  const rateReduction = { RUNG_1_RATE_REDUCTION: 0.002, RUNG_2_TERM_EXTENSION: 0.001, RUNG_3_CASH_OUT: 0, RUNG_4_FULL_RESTRUCTURE: 0.003 }[rung];
  const newRate = Math.max(0.003, input.currentDebtRate - rateReduction);
  const termExtension = { RUNG_1_RATE_REDUCTION: 0, RUNG_2_TERM_EXTENSION: 10, RUNG_3_CASH_OUT: 5, RUNG_4_FULL_RESTRUCTURE: 15 }[rung];
  const newTerm = input.currentTermRemaining + termExtension;
  const upfrontFee = input.totalDebt * (rung === 'RUNG_4_FULL_RESTRUCTURE' ? 0.025 : 0.010);
  const newMonthlyDebtService = (input.totalDebt * newRate);
  const currentMonthlyDebtService = (input.totalDebt * input.currentDebtRate);
  const netCarryImpact = currentMonthlyDebtService - newMonthlyDebtService - (upfrontFee / Math.max(newTerm, 1));

  return {
    rung,
    newRate,
    newTerm,
    upfrontFee,
    newMonthlyDebtService,
    projectedHeat: clamp(input.collateralQuality < 0.7 ? 0.75 : 0.40),
    projectedFees: newMonthlyDebtService * newTerm + upfrontFee,
    netCarryImpact,
  };
}

// ─── Illusion Detection ───────────────────────────────────────────────────────

function detectRefillusions(input: RefiInput, configs: RefiConfiguration[]): Array<{ type: RefiIllusionType; description: string }> {
  const warnings: Array<{ type: RefiIllusionType; description: string }> = [];

  for (const cfg of configs) {
    // Negative carry: refi costs more monthly than it saves
    if (cfg.netCarryImpact < 0) {
      warnings.push({
        type: 'NEGATIVE_CARRY',
        description: `${cfg.rung}: Refi increases monthly cost by $${Math.abs(cfg.netCarryImpact).toFixed(0)} — not worth it.`,
      });
    }
  }

  // Underwater collateral
  if (input.assetCurrentValue < input.totalDebt * 0.9) {
    warnings.push({
      type: 'UNDERWATER_COLLATERAL',
      description: `Asset value ($${input.assetCurrentValue.toLocaleString()}) below debt ($${input.totalDebt.toLocaleString()}) — refi lender will reject.`,
    });
  }

  // Covenant breach
  if (input.covenantStatus === 'BREACH') {
    warnings.push({
      type: 'COVENANT_BREACH',
      description: 'Covenant breach active — refi is blocked until resolved.',
    });
  }

  // Clock too late
  const ticksRemaining = RUN_DURATION_TICKS - input.tickIndex;
  const minPaybackTicks = 15;
  if (ticksRemaining < minPaybackTicks) {
    warnings.push({
      type: 'CLOCK_TOO_LATE',
      description: `Only ${ticksRemaining} ticks remain — not enough time to recoup refi fees.`,
    });
  }

  return warnings;
}

// ─── Audit + Receipt ──────────────────────────────────────────────────────────

function buildAuditHash(input: RefiInput, score: number, optimalTerm: number): string {
  return sha256(JSON.stringify({
    playerId: input.playerId,
    runSeed: input.runSeed,
    rulesetVersion: input.rulesetVersion,
    tickIndex: input.tickIndex,
    score,
    optimalTerm,
    modelId: 'M107a',
    modelVersion: '1.0',
  })).slice(0, 32);
}

function buildReceipt(input: RefiInput, bestRung: RefiRung, feasibility: RefiFeasibility, rationale: string[]): RefiReceipt {
  const receiptHash = sha256(JSON.stringify({
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rungSelected: bestRung,
    feasibility,
  })).slice(0, 24);

  return {
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rungSelected: bestRung,
    feasibility,
    projectedVsRealized: 'PENDING',  // updated post-refi by run engine
    rationale,
    receiptHash,
  };
}

// ─── Main Model ───────────────────────────────────────────────────────────────

export class M107a {
  private readonly _auditHash: string;
  private readonly _mlEnabled: boolean;

  constructor(auditHash: string, mlEnabled: boolean) {
    this._auditHash = auditHash;
    this._mlEnabled = mlEnabled;
  }

  public getAuditHash(): string { return this._auditHash; }
  public isMlEnabled(): boolean { return this._mlEnabled; }

  /**
   * Estimate refi eligibility for the current player state.
   * Returns null if ML disabled → caller shows static rung hints.
   */
  public estimateRefiEligibility(input: RefiInput): M107aOutput | null {
    if (!this._mlEnabled) return null;

    // Feasibility score
    const rawScore = estimateRefiScore(input);
    const feasibilityScore = clamp(rawScore);
    const level = feasibilityLevel(feasibilityScore);

    // Optimal term
    const rawTerm = optimizeTerm(input);
    const optimalTerm = clamp(rawTerm);

    // Build top 2 configurations (rungs ordered by difficulty)
    const rungs: RefiRung[] = ['RUNG_1_RATE_REDUCTION', 'RUNG_2_TERM_EXTENSION', 'RUNG_3_CASH_OUT', 'RUNG_4_FULL_RESTRUCTURE'];
    const feasibleRungs = rungs.filter(r => {
      const thresh = RUNG_THRESHOLDS[r];
      return input.liquidityScore >= thresh.minLiquidity
        && input.cashflowVolatility <= thresh.maxVolatility
        && input.collateralQuality >= thresh.minCollateral;
    });

    const topConfigurations = feasibleRungs.slice(0, 2).map(r => buildRefiConfiguration(r, input, feasibilityScore));
    const illusionWarnings = detectRefillusions(input, topConfigurations);

    const bestRung = feasibleRungs[0] ?? 'RUNG_1_RATE_REDUCTION';
    const rationale = [
      `Collateral quality: ${(input.collateralQuality * 100).toFixed(0)}%`,
      `Liquidity score: ${(input.liquidityScore * 100).toFixed(0)}%`,
      `Cashflow volatility: ${(input.cashflowVolatility * 100).toFixed(0)}%`,
      input.covenantStatus !== 'OK' ? `Covenant: ${input.covenantStatus}` : '',
    ].filter(Boolean);

    const receipt = buildReceipt(input, bestRung, level, rationale);
    const auditHash = buildAuditHash(input, feasibilityScore, optimalTerm);

    return { feasibilityScore, feasibilityLevel: level, optimalTerm, topConfigurations, illusionWarnings, receipt, auditHash };
  }

  /**
   * Convenience: returns just the feasibility score (0–1) or null.
   */
  public estimateRefiScore(inputData: Record<string, number>): number | null {
    if (!this._mlEnabled) return null;
    const score = clamp(
      (inputData['collateralQuality'] ?? 0.5) * 0.40
      + (inputData['liquidityScore'] ?? 0.5) * 0.30
      - (inputData['cashflowVolatility'] ?? 0.5) * 0.20,
    );
    return clamp(score);
  }

  /**
   * Convenience: returns just the optimal term (0–1) or null.
   */
  public optimizeTermSimple(inputData: Record<string, number>): number | null {
    if (!this._mlEnabled) return null;
    const debtRatio = inputData['debtRatio'] ?? 0.5;
    const clockFraction = inputData['clockFraction'] ?? 0.5;
    return clamp((1 - debtRatio) * 0.60 + (1 - clockFraction) * 0.40);
  }
}
