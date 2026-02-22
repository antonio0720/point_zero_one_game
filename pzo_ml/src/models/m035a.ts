/**
 * M35a — Portfolio Heat Controller (Overconcentration + Friction Escalation)
 * Source spec: ml/M35a_portfolio_heat_controller.md
 * Design law: ML suggests + scores; deterministic rules + ledger decide.
 * Enforce: bounded nudges + audit_hash + ml_enabled kill-switch
 *
 * Deploy to: pzo_ml/src/models/m035a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioSnapshot {
  assets: Array<{
    assetId: string;
    assetKind: 'REAL_ESTATE' | 'BUSINESS' | 'IPA';
    currentValue: number;
    cashflowMonthly: number;
    heatScore: number;     // 0–1
    rungType: 'INSTANT' | 'SHORT' | 'MID' | 'LONG' | 'NONE';
  }>;
  totalValue: number;
  liquidCash: number;
  totalHeat: number;   // pre-computed by engine; 0–1
}

export interface HeatControllerInputs {
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  macroRegime: 'EXPANSION' | 'CONTRACTION' | 'NEUTRAL' | 'SHOCK';
  portfolio: PortfolioSnapshot;
  ledgerEventCount: number;
  integritySignals: {
    desyncMarkers: number;
    validatorAnomalies: number;
  };
  mlEnabled: boolean;   // kill-switch
}

export interface HeatControllerOutputs {
  score: number;                    // 0–1; overall concentration risk
  topFactors: string[];             // ≤5 human-readable factors
  recommendation: HeatRecommendation | null;
  audit_hash: string;               // SHA256(inputs + outputs + rulesetVersion + caps)
  modelId: 'M35a';
  policyVersion: '1.0';
}

export interface HeatRecommendation {
  type:
    | 'NUDGE_DIVERSIFY'        // suggest spreading into uncovered rung
    | 'FRICTION_WARNING'       // warn: next purchase in same class costs more
    | 'HEAT_CAP_APPLIED'       // deterministic cap fired (not ML)
    | 'MONITOR_ONLY';          // no action; log only
  targetRung: 'INSTANT' | 'SHORT' | 'MID' | 'LONG' | null;
  message: string;
  cap: number | null;           // bounded nudge cap (0–1); null = no cap
  cooldownTicks: number;        // 0 = no cooldown
}

// ─── Constants (Guardrails) ───────────────────────────────────────────────────

const MAX_NUDGE_STRENGTH = 0.15;     // bounded: ML cannot move score > 15%
const MAX_FRICTION_MULTIPLIER = 1.3; // max friction cost multiplier from ML
const HIGH_HEAT_THRESHOLD = 0.70;
const OVERCONCENTRATION_THRESHOLD = 0.50; // >50% value in one rung = risk
const POLICY_VERSION = '1.0';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function computeAuditHash(
  inputs: HeatControllerInputs,
  outputs: Omit<HeatControllerOutputs, 'audit_hash'>,
): string {
  return sha256(JSON.stringify({
    inputs: {
      runSeed: inputs.runSeed,
      tickIndex: inputs.tickIndex,
      rulesetVersion: inputs.rulesetVersion,
      totalHeat: inputs.portfolio.totalHeat,
    },
    outputs,
    policy_version: POLICY_VERSION,
    caps: { MAX_NUDGE_STRENGTH, MAX_FRICTION_MULTIPLIER },
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Feature Engineering (deterministic, no hidden state) ────────────────────

function extractFeatures(inputs: HeatControllerInputs): {
  concentrationRatio: number;
  rungCoverage: number;
  liquidityGap: boolean;
  regimeMultiplier: number;
  integrityPenalty: number;
} {
  const { portfolio, macroRegime, integritySignals } = inputs;

  // Concentration: what fraction of value is in the single hottest rung?
  const rungValues: Record<string, number> = {};
  for (const a of portfolio.assets) {
    rungValues[a.rungType] = (rungValues[a.rungType] ?? 0) + a.currentValue;
  }
  const maxRungValue = Math.max(0, ...Object.values(rungValues));
  const concentrationRatio = portfolio.totalValue > 0 ? maxRungValue / portfolio.totalValue : 0;

  // Rung coverage: out of 4 rungs, how many are filled?
  const filledRungs = new Set(portfolio.assets.map(a => a.rungType).filter(r => r !== 'NONE')).size;
  const rungCoverage = filledRungs / 4;

  // Liquidity gap: no INSTANT or SHORT rung
  const hasLiquid = portfolio.assets.some(a => a.rungType === 'INSTANT' || a.rungType === 'SHORT');
  const liquidityGap = !hasLiquid;

  // Macro regime heat multiplier
  const regimeMultiplier = { SHOCK: 1.4, CONTRACTION: 1.2, NEUTRAL: 1.0, EXPANSION: 0.85 }[macroRegime];

  // Integrity penalty: known anomalies increase caution score
  const integrityPenalty = clamp(
    (integritySignals.desyncMarkers * 0.05 + integritySignals.validatorAnomalies * 0.08),
    0, 0.20,
  );

  return { concentrationRatio, rungCoverage, liquidityGap, regimeMultiplier, integrityPenalty };
}

// ─── Scoring (calibrated logistic approximation) ─────────────────────────────

function computeHeatScore(
  baseHeat: number,
  features: ReturnType<typeof extractFeatures>,
): number {
  const { concentrationRatio, rungCoverage, liquidityGap, regimeMultiplier, integrityPenalty } = features;

  let score = baseHeat;
  score += concentrationRatio > OVERCONCENTRATION_THRESHOLD
    ? (concentrationRatio - OVERCONCENTRATION_THRESHOLD) * 0.4
    : 0;
  score -= rungCoverage * 0.15;                 // more coverage = less risk
  score += liquidityGap ? 0.10 : 0;
  score *= regimeMultiplier;
  score += integrityPenalty;

  return clamp(score, 0, 1);
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

function buildRecommendation(
  score: number,
  features: ReturnType<typeof extractFeatures>,
): HeatRecommendation {
  if (score < HIGH_HEAT_THRESHOLD && !features.liquidityGap) {
    return { type: 'MONITOR_ONLY', targetRung: null, message: 'Heat within safe range', cap: null, cooldownTicks: 0 };
  }

  if (features.liquidityGap) {
    return {
      type: 'NUDGE_DIVERSIFY',
      targetRung: 'INSTANT',
      message: 'No liquid rung — missed-bag risk elevated. Consider an INSTANT or SHORT asset.',
      cap: MAX_NUDGE_STRENGTH,
      cooldownTicks: 3,
    };
  }

  if (features.concentrationRatio > OVERCONCENTRATION_THRESHOLD) {
    // Determine which rung is underweight
    const targetRung: HeatRecommendation['targetRung'] = 'MID';
    return {
      type: 'FRICTION_WARNING',
      targetRung,
      message: `Portfolio overconcentrated (${Math.round(features.concentrationRatio * 100)}% in one rung). Next same-class purchase costs more.`,
      cap: clamp(MAX_FRICTION_MULTIPLIER - 1, 0, MAX_NUDGE_STRENGTH),
      cooldownTicks: 5,
    };
  }

  return { type: 'MONITOR_ONLY', targetRung: null, message: 'High heat — monitor required', cap: null, cooldownTicks: 0 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the M35a Portfolio Heat Controller.
 * Returns null recommendation if ml_enabled kill-switch is OFF.
 * Audit hash always emitted regardless of kill-switch.
 */
export function runHeatController(inputs: HeatControllerInputs): HeatControllerOutputs {
  const features = extractFeatures(inputs);
  const rawScore = computeHeatScore(inputs.portfolio.totalHeat, features);

  const topFactors: string[] = [];
  if (features.concentrationRatio > OVERCONCENTRATION_THRESHOLD) topFactors.push(`overconcentration:${Math.round(features.concentrationRatio * 100)}%`);
  if (features.liquidityGap) topFactors.push('no_liquid_rung');
  if (features.regimeMultiplier > 1.1) topFactors.push(`macro_regime:${inputs.macroRegime}`);
  if (inputs.portfolio.totalHeat > HIGH_HEAT_THRESHOLD) topFactors.push(`base_heat:${Math.round(inputs.portfolio.totalHeat * 100)}%`);
  if (features.integrityPenalty > 0) topFactors.push(`integrity_penalty:${Math.round(features.integrityPenalty * 100)}%`);

  const recommendation = inputs.mlEnabled ? buildRecommendation(rawScore, features) : null;

  const outputsWithoutHash: Omit<HeatControllerOutputs, 'audit_hash'> = {
    score: rawScore,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    modelId: 'M35a',
    policyVersion: '1.0',
  };

  const audit_hash = computeAuditHash(inputs, outputsWithoutHash);

  return { ...outputsWithoutHash, audit_hash };
}

/**
 * Apply friction cost multiplier for a new purchase in a concentrated rung.
 * Deterministic; ML provides the base cap; engine applies it.
 * ML never directly sets price — it only provides the bounded adjustment.
 */
export function applyFrictionCost(
  baseCost: number,
  recommendation: HeatRecommendation | null,
): number {
  if (!recommendation || recommendation.type !== 'FRICTION_WARNING' || recommendation.cap === null) {
    return baseCost;
  }
  const multiplier = 1 + clamp(recommendation.cap, 0, MAX_NUDGE_STRENGTH);
  return Math.round(baseCost * multiplier);
}
