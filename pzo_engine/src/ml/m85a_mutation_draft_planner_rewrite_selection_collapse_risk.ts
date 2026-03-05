// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m85a_mutation_draft_planner_rewrite_selection_collapse_risk.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M85A — Mutation Draft Planner (Rewrite Selection + Collapse Risk Scorer)
// Core Pair    : M85
// Family       : market
// Category     : rl_policy
// IntelSignal  : alpha
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
 * M85A — Mutation Draft Planner (Rewrite Selection + Collapse Risk Scorer)
 *
 * Primary function:
 *   Plan mutation draft selection to maximize CORD upside while scoring collapse risk of each rewrite option
 *
 * What this adds to M85:
 * 1. Plan mutation draft selection to maximize CORD upside.
 * 2. Score collapse risk for each rewrite option before selection.
 * 3. Flags rewrites that create unrecoverable portfolio fragility.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M85
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M85ATelemetryInput {
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
  // Extended inputs for M85A (market family)

}

// Telemetry events subscribed by M85A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M85ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M85AOutput extends M85ABaseOutput {
  draftPlan: unknown;  // draft_plan
  collapseRiskScores: unknown;  // collapse_risk_scores
  cordUpsideEstimate: unknown;  // cord_upside_estimate
  fragilityFlag: unknown;  // fragility_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M85ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M85A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M85ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M85A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M85ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M85A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M85APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M85APlacement = 'client' | 'server';

export interface M85AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M85AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M85AEvalContract {
  /** draft_plan_optimality */
  /** collapse_risk_calibration_ECE */
  /** fragility_recall */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M85AModelCard {
  modelId:            'M85A';
  coreMechanicPair:   'M85';
  intelligenceSignal: 'alpha';
  modelCategory:      'rl_policy';
  family:             'market';
  tier:               M85ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M85A_ML_CONSTANTS = {
  ML_ID:              'M85A',
  CORE_PAIR:          'M85',
  MODEL_NAME:         'Mutation Draft Planner (Rewrite Selection + Collapse Risk Scorer)',
  INTEL_SIGNAL:       'alpha' as const,
  MODEL_CATEGORY:     'rl_policy' as const,
  FAMILY:             'market' as const,
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
  EVAL_FOCUS:         ["draft_plan_optimality", "collapse_risk_calibration_ECE", "fragility_recall"],
  PRIMARY_OUTPUTS:    ["draft_plan", "collapse_risk_scores", "cord_upside_estimate", "fragility_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM85aMl
 *
 * Fires after M85 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M85AOutput with signed auditHash
 */
export async function runM85aMl(
  input:     M85ATelemetryInput,
  tier:      M85ATier = 'baseline',
  modelCard: Omit<M85AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M85AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM85aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM85aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M85AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM85aMlFallback(
  _input: M85ATelemetryInput,
): M85AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M85A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    draftPlan: null,
    collapseRiskScores: null,
    cordUpsideEstimate: null,
    fragilityFlag: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM85aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
