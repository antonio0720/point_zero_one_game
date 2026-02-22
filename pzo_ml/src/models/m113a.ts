/**
 * M113a — Order Priority Stack (ML/DL Companion: Sacrifice Planner)
 * Source spec: ml/M113a_order_priority_stack_ml_dl_companion_sacrifice_planner.md
 * Design law: ML suggests; player confirms; ledger records.
 * Enforce: bounded nudges + audit_hash + ml_enabled kill-switch
 * Budget: ≤12ms inference
 *
 * Deploy to: pzo_ml/src/models/m113a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HoldingNode {
  assetId: string;
  assetKind: 'REAL_ESTATE' | 'BUSINESS' | 'IPA';
  currentValue: number;
  cashflowMonthly: number;
  debtAmount: number;
  liquidationFeeRate: number;   // 0–1; forced sale cost fraction
  heatScore: number;            // 0–1
  isCoreThesis: boolean;        // player-tagged (opt-in)
  correlations: string[];       // assetIds that move together
}

export interface SacrificeInputs {
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  holdings: HoldingNode[];
  totalLiabilityDue: number;    // must cover with liquidations
  macroRegime: 'EXPANSION' | 'CONTRACTION' | 'NEUTRAL' | 'SHOCK';
  seasonModules: string[];
  tableConsentGates: string[];  // active consent flags
  playerCorePreference: string[]; // opt-in: assetIds player wants to protect
  mlEnabled: boolean;
}

export interface SacrificePlan {
  orderedLiquidationStack: SacrificeStep[];
  estimatedProceeds: number;
  cascadeRiskScore: number;     // 0–1; how bad the chain effects are
  coreThesisPreserved: boolean;
  comparisonToDefault: DefaultOrderComparison;
}

export interface SacrificeStep {
  stepIndex: number;
  assetId: string;
  assetKind: HoldingNode['assetKind'];
  estimatedProceeds: number;
  liquidationFee: number;
  cascadeTriggers: string[];    // correlated assetIds that may also be affected
  rationaleTag: string;         // human-readable coarse tag
}

export interface DefaultOrderComparison {
  defaultProceeds: number;
  suggestedProceeds: number;
  proceedsDelta: number;
  cascadeRiskDelta: number;
}

export interface SacrificePlannerOutputs {
  plan: SacrificePlan | null;   // null if mlEnabled=false
  recommendation: 'PLAN_SUGGESTED' | 'MANUAL_ONLY' | 'ABSTAIN_LOW_CONFIDENCE' | 'ML_OFF';
  topFactors: string[];
  audit_hash: string;
  ledgerReceipt: SacrificeReceipt;
  modelId: 'M113a';
  policyVersion: '1.0';
}

export interface SacrificeReceipt {
  ruleId: 'M113a';
  runSeed: string;
  tickIndex: number;
  stackSet: string[];           // assetIds in order
  liquidationSequenceHash: string;
  auditHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.60;
const MAX_COARSE_INFLUENCE_TAGS = 5;
const POLICY_VERSION = '1.0';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function buildAuditHash(inputs: SacrificeInputs, stack: string[], rulesetVersion: string): string {
  return sha256(JSON.stringify({
    runSeed: inputs.runSeed,
    tickIndex: inputs.tickIndex,
    rulesetVersion,
    stack,
    policy_version: POLICY_VERSION,
  }));
}

// ─── Sacrifice Priority Scoring ───────────────────────────────────────────────

function scoreForSacrifice(holding: HoldingNode, playerCorePreference: string[]): number {
  // Lower score = sacrifice first
  let score = 0;

  // Core thesis: very high cost to sacrifice
  if (holding.isCoreThesis || playerCorePreference.includes(holding.assetId)) score += 100;

  // High cashflow = valuable to keep
  score += Math.min(holding.cashflowMonthly / 1000, 20);

  // High heat = cheaper to drop (already distressed)
  score -= holding.heatScore * 15;

  // High debt relative to value = prefer to drop (avoid shortfall)
  const ltv = holding.debtAmount / Math.max(holding.currentValue, 1);
  if (ltv > 0.80) score -= 10;

  // High liquidation fee = avoid if we have better options
  score -= holding.liquidationFeeRate * 8;

  // IPA: lowest priority to sacrifice (cashflow engine)
  if (holding.assetKind === 'IPA') score += 15;

  return score;
}

function estimateLiquidationProceeds(holding: HoldingNode): number {
  const grossProceeds = holding.currentValue * (1 - holding.liquidationFeeRate);
  const netProceeds = grossProceeds - holding.debtAmount;
  return Math.max(0, Math.round(netProceeds));
}

function detectCascadeTriggers(holding: HoldingNode, allHoldings: HoldingNode[]): string[] {
  // Coarse: any correlated asset that will be affected by this liquidation
  return holding.correlations.filter(id => allHoldings.some(h => h.assetId === id));
}

// ─── Default Order (LIFO by acquisition) ─────────────────────────────────────
// Approximation: sort by assetId lexicographically (server tracks real order)

function buildDefaultOrder(holdings: HoldingNode[]): SacrificeStep[] {
  const sorted = [...holdings].sort((a, b) => b.assetId.localeCompare(a.assetId));
  let cumProceeds = 0;
  return sorted.map((h, i) => {
    const proceeds = estimateLiquidationProceeds(h);
    cumProceeds += proceeds;
    return {
      stepIndex: i,
      assetId: h.assetId,
      assetKind: h.assetKind,
      estimatedProceeds: proceeds,
      liquidationFee: Math.round(h.currentValue * h.liquidationFeeRate),
      cascadeTriggers: detectCascadeTriggers(h, holdings),
      rationaleTag: 'DEFAULT_LIFO',
    };
  });
}

// ─── Sacrifice Planner ────────────────────────────────────────────────────────

function buildOptimizedPlan(inputs: SacrificeInputs): { plan: SacrificePlan; confidence: number } {
  const { holdings, totalLiabilityDue, playerCorePreference } = inputs;

  // Score all holdings; sort lowest first = sacrifice order
  const scored = holdings
    .map(h => ({ holding: h, score: scoreForSacrifice(h, playerCorePreference) }))
    .sort((a, b) => a.score - b.score);

  // Build stack until proceeds cover liability
  const stack: SacrificeStep[] = [];
  let cumulativeProceeds = 0;
  let cascadeRisk = 0;

  for (const { holding } of scored) {
    if (cumulativeProceeds >= totalLiabilityDue) break;
    const proceeds = estimateLiquidationProceeds(holding);
    const cascadeTriggers = detectCascadeTriggers(holding, holdings);
    cascadeRisk += cascadeTriggers.length * 0.1;

    stack.push({
      stepIndex: stack.length,
      assetId: holding.assetId,
      assetKind: holding.assetKind,
      estimatedProceeds: proceeds,
      liquidationFee: Math.round(holding.currentValue * holding.liquidationFeeRate),
      cascadeTriggers,
      rationaleTag: holding.isCoreThesis ? 'PROTECTED_FORCED_SACRIFICE' : holding.heatScore > 0.6 ? 'HIGH_HEAT_FIRST' : 'LOW_VALUE_FIRST',
    });
    cumulativeProceeds += proceeds;
  }

  // Default comparison
  const defaultStack = buildDefaultOrder(holdings);
  const defaultProceeds = defaultStack.slice(0, stack.length).reduce((s, st) => s + st.estimatedProceeds, 0);
  const defaultCascadeRisk = defaultStack.slice(0, stack.length).reduce((s, st) => s + st.cascadeTriggers.length * 0.1, 0);

  const corePreserved = stack.every(s => !playerCorePreference.includes(s.assetId));
  const confidence = clamp(0.5 + (corePreserved ? 0.2 : 0) + (cascadeRisk < 0.3 ? 0.15 : 0) + (cumulativeProceeds >= totalLiabilityDue ? 0.15 : -0.2), 0, 1);

  const plan: SacrificePlan = {
    orderedLiquidationStack: stack,
    estimatedProceeds: cumulativeProceeds,
    cascadeRiskScore: clamp(cascadeRisk, 0, 1),
    coreThesisPreserved: corePreserved,
    comparisonToDefault: {
      defaultProceeds,
      suggestedProceeds: cumulativeProceeds,
      proceedsDelta: cumulativeProceeds - defaultProceeds,
      cascadeRiskDelta: defaultCascadeRisk - cascadeRisk,
    },
  };

  return { plan, confidence };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runSacrificePlanner(inputs: SacrificeInputs): SacrificePlannerOutputs {
  const stackSet: string[] = [];
  let plan: SacrificePlan | null = null;
  let recommendation: SacrificePlannerOutputs['recommendation'];
  const topFactors: string[] = [];

  if (!inputs.mlEnabled) {
    recommendation = 'ML_OFF';
  } else {
    const { plan: optimized, confidence } = buildOptimizedPlan(inputs);

    if (confidence < CONFIDENCE_THRESHOLD) {
      recommendation = 'ABSTAIN_LOW_CONFIDENCE';
      topFactors.push(`confidence:${Math.round(confidence * 100)}%_below_threshold`);
    } else {
      plan = optimized;
      recommendation = 'PLAN_SUGGESTED';
      stackSet.push(...plan.orderedLiquidationStack.map(s => s.assetId));

      if (!plan.coreThesisPreserved) topFactors.push('core_thesis_violated');
      if (plan.cascadeRiskScore > 0.4) topFactors.push(`cascade_risk:${Math.round(plan.cascadeRiskScore * 100)}%`);
      if (plan.comparisonToDefault.proceedsDelta > 0) topFactors.push(`proceeds_improvement:+${plan.comparisonToDefault.proceedsDelta}`);
      if (inputs.macroRegime === 'SHOCK') topFactors.push('macro_shock_context');
    }
  }

  const sequenceHash = sha256(JSON.stringify(stackSet)).slice(0, 24);
  const auditHash = buildAuditHash(inputs, stackSet, inputs.rulesetVersion);

  const ledgerReceipt: SacrificeReceipt = {
    ruleId: 'M113a',
    runSeed: inputs.runSeed,
    tickIndex: inputs.tickIndex,
    stackSet,
    liquidationSequenceHash: sequenceHash,
    auditHash,
  };

  return {
    plan,
    recommendation,
    topFactors: topFactors.slice(0, MAX_COARSE_INFLUENCE_TAGS),
    audit_hash: auditHash,
    ledgerReceipt,
    modelId: 'M113a',
    policyVersion: '1.0',
  };
}
