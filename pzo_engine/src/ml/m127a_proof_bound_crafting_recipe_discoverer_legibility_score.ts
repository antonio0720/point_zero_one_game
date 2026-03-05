// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m127a_proof_bound_crafting_recipe_discoverer_legibility_score.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M127A — Proof-Bound Crafting Recipe Discoverer + Legibility Scorer
// Core Pair    : M127
// Family       : economy
// Category     : recommender
// IntelSignal  : recommendationPower
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
 * M127A — Proof-Bound Crafting Recipe Discoverer + Legibility Scorer
 *
 * Primary function:
 *   Discover crafting recipe combinations from verified fragment graph; score recipe legibility before surfacing to player
 *
 * What this adds to M127:
 * 1. Discover crafting recipe combinations from the verified fragment graph.
 * 2. Score recipe legibility: players should understand why a recipe works.
 * 3. Anti-exploit: flags recipes that produce disproportionate economy impact.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M127
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M127ATelemetryInput {
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
  // Extended inputs for M127A (economy family)

}

// Telemetry events subscribed by M127A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M127ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M127AOutput extends M127ABaseOutput {
  recipeDiscoveries: unknown;  // recipe_discoveries
  legibilityScore: unknown;  // legibility_score
  economyImpactFlag: unknown;  // economy_impact_flag
  recipeRecommendation: unknown;  // recipe_recommendation
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M127ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M127A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M127ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M127A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M127ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M127A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M127APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M127APlacement = 'server';

export interface M127AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M127AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M127AEvalContract {
  /** recipe_discovery_recall */
  /** legibility_rating */
  /** economy_impact_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M127AModelCard {
  modelId:            'M127A';
  coreMechanicPair:   'M127';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'recommender';
  family:             'economy';
  tier:               M127ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M127A_ML_CONSTANTS = {
  ML_ID:              'M127A',
  CORE_PAIR:          'M127',
  MODEL_NAME:         'Proof-Bound Crafting Recipe Discoverer + Legibility Scorer',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'economy' as const,
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
  EVAL_FOCUS:         ["recipe_discovery_recall", "legibility_rating", "economy_impact_AUC"],
  PRIMARY_OUTPUTS:    ["recipe_discoveries", "legibility_score", "economy_impact_flag", "recipe_recommendation"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM127aMl
 *
 * Fires after M127 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M127AOutput with signed auditHash
 */
export async function runM127aMl(
  input:     M127ATelemetryInput,
  tier:      M127ATier = 'baseline',
  modelCard: Omit<M127AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M127AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM127aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM127aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M127AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM127aMlFallback(
  _input: M127ATelemetryInput,
): M127AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M127A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    recipeDiscoveries: null,
    legibilityScore: null,
    economyImpactFlag: null,
    recipeRecommendation: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM127aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
