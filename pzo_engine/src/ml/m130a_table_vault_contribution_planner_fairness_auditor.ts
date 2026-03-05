// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m130a_table_vault_contribution_planner_fairness_auditor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M130A — Table Vault Contribution Planner + Fairness Auditor
// Core Pair    : M130
// Family       : co_op
// Category     : predictor
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : batch
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
 * M130A — Table Vault Contribution Planner + Fairness Auditor
 *
 * Primary function:
 *   Plan optimal vault contribution strategies for team members; audit vault usage for free-rider patterns
 *
 * What this adds to M130:
 * 1. Plan optimal vault contribution strategies based on team treasury state.
 * 2. Audit vault usage for free-rider patterns: members using vault without contributing.
 * 3. Generates contribution fairness receipts.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M130
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M130ATelemetryInput {
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
  // Extended inputs for M130A (co_op family)

}

// Telemetry events subscribed by M130A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M130ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M130AOutput extends M130ABaseOutput {
  contributionPlan: unknown;  // contribution_plan
  freeRiderFlag: unknown;  // free_rider_flag
  fairnessReceipt: unknown;  // fairness_receipt
  vaultOptimizationScore: unknown;  // vault_optimization_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M130ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M130A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M130ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M130A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M130ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M130A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M130APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M130APlacement = 'server';

export interface M130AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M130AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M130AEvalContract {
  /** contribution_plan_acceptance */
  /** free_rider_AUC */
  /** fairness_calibration */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M130AModelCard {
  modelId:            'M130A';
  coreMechanicPair:   'M130';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'predictor';
  family:             'co_op';
  tier:               M130ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M130A_ML_CONSTANTS = {
  ML_ID:              'M130A',
  CORE_PAIR:          'M130',
  MODEL_NAME:         'Table Vault Contribution Planner + Fairness Auditor',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'co_op' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'batch' as const,
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
  EVAL_FOCUS:         ["contribution_plan_acceptance", "free_rider_AUC", "fairness_calibration"],
  PRIMARY_OUTPUTS:    ["contribution_plan", "free_rider_flag", "fairness_receipt", "vault_optimization_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM130aMl
 *
 * Fires after M130 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M130AOutput with signed auditHash
 */
export async function runM130aMl(
  input:     M130ATelemetryInput,
  tier:      M130ATier = 'baseline',
  modelCard: Omit<M130AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M130AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM130aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM130aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M130AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM130aMlFallback(
  _input: M130ATelemetryInput,
): M130AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M130A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    contributionPlan: null,
    freeRiderFlag: null,
    fairnessReceipt: null,
    vaultOptimizationScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM130aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
