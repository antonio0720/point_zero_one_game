// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m149a_regulatory_window_compliance_planner_cost_minimizer.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M149A — Regulatory Window Compliance Planner + Cost Minimizer
// Core Pair    : M149
// Family       : contract
// Category     : predictor
// IntelSignal  : risk
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : client, server
// Budget       : real_time
// Lock-Off     : YES — competitive mode can disable balance nudges
//
// ML Design Laws (non-negotiable):
//   ✦ ML can suggest; rules decide — NEVER rewrite resolved ledger history
//   ✦ Bounded nudges — all outputs have explicit caps + monotonic constraints
//   ✦ Auditability — every inference writes (ruleset_version, seed, tick, cap, output)
//   ✦ Privacy — no contact-graph mining; in-session signals only
//
// Density6 LLC · Point Zero One · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M149A — Regulatory Window Compliance Planner + Cost Minimizer
 *
 * Primary function:
 *   Plan compliance actions for regulatory windows to minimize ongoing penalty cost; forecast non-compliance cascade
 *
 * What this adds to M149:
 * 1. Plan compliance actions for regulatory windows to minimize ongoing penalty cost.
 * 2. Forecast non-compliance cascade: what happens if the window is missed.
 * 3. Generates compliance plan receipts for Case File.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M149
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M149ATelemetryInput {
  runSeed:           string;
  tickIndex:         number;
  rulesetVersion:    string;
  macroRegime:       string;
  portfolioSnapshot: Record<string, unknown>;
  actionTimeline:    Record<string, unknown>[];
  uiInteraction:     Record<string, unknown>;
  socialEvents:      Record<string, unknown>[];
  outcomeEvents:     Record<string, unknown>[];
  ledgerEvents?:     Record<string, unknown>[];
  contractGraph?:    Record<string, unknown>;
  userOptIn:         Record<string, boolean>;
  // Extended inputs for M149A (contract family)

}

// Telemetry events subscribed by M149A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M149ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M149AOutput extends M149ABaseOutput {
  compliancePlan: unknown;  // compliance_plan
  penaltyCostEstimate: unknown;  // penalty_cost_estimate
  nonComplianceCascade: unknown;  // non_compliance_cascade
  complianceReceipt: unknown;  // compliance_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M149ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M149A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M149ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M149A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M149ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M149A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M149APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M149APlacement = 'client' | 'server';

export interface M149AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M149AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M149AEvalContract {
  /** compliance_plan_quality */
  /** penalty_estimate_accuracy */
  /** cascade_prediction_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M149AModelCard {
  modelId:            'M149A';
  coreMechanicPair:   'M149';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'contract';
  tier:               M149ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M149A_ML_CONSTANTS = {
  ML_ID:              'M149A',
  CORE_PAIR:          'M149',
  MODEL_NAME:         'Regulatory Window Compliance Planner + Cost Minimizer',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'contract' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['client', 'server'] as const,
  BUDGET:             'real_time' as const,
  CAN_LOCK_OFF:        true,
  GUARDRAILS: {
    determinismPreserved:      true,
    boundedNudges:             true,
    auditabilityRequired:      true,
    privacyEnforced:           true,
    competitiveLockOffAllowed: true,
    scoreCap:                  1.0,
    abstainThreshold:          0.35,
  },
  EVAL_FOCUS:         ["compliance_plan_quality", "penalty_estimate_accuracy", "cascade_prediction_AUC"],
  PRIMARY_OUTPUTS:    ["compliance_plan", "penalty_cost_estimate", "non_compliance_cascade", "compliance_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM149aMl
 *
 * Fires after M149 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M149AOutput with signed auditHash
 */
export async function runM149aMl(
  input:     M149ATelemetryInput,
  tier:      M149ATier = 'baseline',
  modelCard: Omit<M149AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M149AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM149aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM149aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M149AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM149aMlFallback(
  _input: M149ATelemetryInput,
): M149AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M149A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    compliancePlan: null,
    penaltyCostEstimate: null,
    nonComplianceCascade: null,
    complianceReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM149aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
