// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m34a_mod_impact_estimator_socket_choice_counterfactual_regre.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M34A — Mod Impact Estimator (Socket Choice + Counterfactual Regret)
// Core Pair    : M34
// Family       : market
// Category     : recommender
// IntelSignal  : alpha
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M34A — Mod Impact Estimator (Socket Choice + Counterfactual Regret)
 *
 * Primary function:
 *   Estimate marginal impact of each mod socket choice; compute counterfactual regret for missed combinations
 *
 * What this adds to M34:
 * 1. Estimate marginal impact of each mod socket choice given current portfolio state.
 * 2. Compute counterfactual regret for missed mod combinations.
 * 3. Feeds asset mod recommendation in Case File.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M34
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M34ATelemetryInput {
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
  // Extended inputs for M34A (market family)

}

// Telemetry events subscribed by M34A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M34ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M34AOutput extends M34ABaseOutput {
  modImpactEstimate: unknown;  // mod_impact_estimate
  counterfactualRegretScore: unknown;  // counterfactual_regret_score
  socketRecommendation: unknown;  // socket_recommendation
  missedComboFlags: unknown;  // missed_combo_flags
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M34ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M34A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M34ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M34A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M34ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M34A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M34AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M34A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M34APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M34APlacement = 'client' | 'server';

export interface M34AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M34AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M34AEvalContract {
  /** impact_estimate_accuracy */
  /** regret_stamp_precision */
  /** recommendation_acceptance_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M34AModelCard {
  modelId:            'M34A';
  coreMechanicPair:   'M34';
  intelligenceSignal: 'alpha';
  modelCategory:      'recommender';
  family:             'market';
  tier:               M34ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M34A_ML_CONSTANTS = {
  ML_ID:              'M34A',
  CORE_PAIR:          'M34',
  MODEL_NAME:         'Mod Impact Estimator (Socket Choice + Counterfactual Regret)',
  INTEL_SIGNAL:       'alpha' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["impact_estimate_accuracy", "regret_stamp_precision", "recommendation_acceptance_rate"],
  PRIMARY_OUTPUTS:    ["mod_impact_estimate", "counterfactual_regret_score", "socket_recommendation", "missed_combo_flags"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM34aMl
 *
 * Fires after M34 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M34AOutput with signed auditHash
 */
export async function runM34aMl(
  input:     M34ATelemetryInput,
  tier:      M34ATier = 'baseline',
  modelCard: Omit<M34AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M34AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM34aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM34aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M34AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM34aMlFallback(
  _input: M34ATelemetryInput,
): M34AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M34A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    modImpactEstimate: null,
    counterfactualRegretScore: null,
    socketRecommendation: null,
    missedComboFlags: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM34aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
