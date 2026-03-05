// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m81a_synergy_tree_branch_recommender_identity_routing_non_de.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M81A — Synergy Tree Branch Recommender (Identity Routing + Non-Degenerate Paths)
// Core Pair    : M81
// Family       : balance
// Category     : recommender
// IntelSignal  : recommendationPower
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
 * M81A — Synergy Tree Branch Recommender (Identity Routing + Non-Degenerate Paths)
 *
 * Primary function:
 *   Recommend synergy tree branches that match player identity while filtering degenerate meta paths
 *
 * What this adds to M81:
 * 1. Recommend synergy tree branches matching player identity and play style.
 * 2. Filter degenerate meta paths that trivialize game balance.
 * 3. Novelty injection: surfaces under-explored branches.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M81
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M81ATelemetryInput {
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
  // Extended inputs for M81A (balance family)

}

// Telemetry events subscribed by M81A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M81ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M81AOutput extends M81ABaseOutput {
  branchRecommendation: unknown;  // branch_recommendation
  degeneratePathFlag: unknown;  // degenerate_path_flag
  noveltyScore: unknown;  // novelty_score
  identityMatch: unknown;  // identity_match
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M81ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M81A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M81ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M81A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M81ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M81A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M81APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M81APlacement = 'client' | 'server';

export interface M81AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M81AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M81AEvalContract {
  /** recommendation_acceptance_rate */
  /** degenerate_path_recall */
  /** identity_match_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M81AModelCard {
  modelId:            'M81A';
  coreMechanicPair:   'M81';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'recommender';
  family:             'balance';
  tier:               M81ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M81A_ML_CONSTANTS = {
  ML_ID:              'M81A',
  CORE_PAIR:          'M81',
  MODEL_NAME:         'Synergy Tree Branch Recommender (Identity Routing + Non-Degenerate Paths)',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'balance' as const,
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
  EVAL_FOCUS:         ["recommendation_acceptance_rate", "degenerate_path_recall", "identity_match_accuracy"],
  PRIMARY_OUTPUTS:    ["branch_recommendation", "degenerate_path_flag", "novelty_score", "identity_match"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM81aMl
 *
 * Fires after M81 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M81AOutput with signed auditHash
 */
export async function runM81aMl(
  input:     M81ATelemetryInput,
  tier:      M81ATier = 'baseline',
  modelCard: Omit<M81AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M81AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM81aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM81aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M81AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM81aMlFallback(
  _input: M81ATelemetryInput,
): M81AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M81A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    branchRecommendation: null,
    degeneratePathFlag: null,
    noveltyScore: null,
    identityMatch: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM81aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
