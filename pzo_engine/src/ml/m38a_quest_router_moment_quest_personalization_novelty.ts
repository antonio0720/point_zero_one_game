// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m38a_quest_router_moment_quest_personalization_novelty.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M38A — Quest Router (Moment Quest Personalization + Novelty)
// Core Pair    : M38
// Family       : progression
// Category     : recommender
// IntelSignal  : recommendationPower
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
// Placement    : server
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
 * M38A — Quest Router (Moment Quest Personalization + Novelty)
 *
 * Primary function:
 *   Route moment quests to maximize player novelty and share probability without repeating quest archetypes
 *
 * What this adds to M38:
 * 1. Route moment quests to maximize player novelty and share probability.
 * 2. Avoids repeating quest archetypes the player has already mastered.
 * 3. Feeds quest completion analytics for season design.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M38
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M38ATelemetryInput {
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
  // Extended inputs for M38A (progression family)

}

// Telemetry events subscribed by M38A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M38ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M38AOutput extends M38ABaseOutput {
  questRouteRecommendation: unknown;  // quest_route_recommendation
  noveltyScore: unknown;  // novelty_score
  shareProbability: unknown;  // share_probability
  archetypeMasteryMap: unknown;  // archetype_mastery_map
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M38ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M38A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M38ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M38A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M38ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M38A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M38AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M38A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M38APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M38APlacement = 'server';

export interface M38AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M38AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M38AEvalContract {
  /** quest_completion_rate */
  /** share_yield */
  /** novelty_entropy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M38AModelCard {
  modelId:            'M38A';
  coreMechanicPair:   'M38';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'recommender';
  family:             'progression';
  tier:               M38ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M38A_ML_CONSTANTS = {
  ML_ID:              'M38A',
  CORE_PAIR:          'M38',
  MODEL_NAME:         'Quest Router (Moment Quest Personalization + Novelty)',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'progression' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
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
  EVAL_FOCUS:         ["quest_completion_rate", "share_yield", "novelty_entropy"],
  PRIMARY_OUTPUTS:    ["quest_route_recommendation", "novelty_score", "share_probability", "archetype_mastery_map"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM38aMl
 *
 * Fires after M38 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M38AOutput with signed auditHash
 */
export async function runM38aMl(
  input:     M38ATelemetryInput,
  tier:      M38ATier = 'baseline',
  modelCard: Omit<M38AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M38AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM38aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM38aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M38AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM38aMlFallback(
  _input: M38ATelemetryInput,
): M38AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M38A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    questRouteRecommendation: null,
    noveltyScore: null,
    shareProbability: null,
    archetypeMasteryMap: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM38aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
