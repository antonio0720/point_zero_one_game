// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m44a_starter_path_matchmaker_archetype_routing_anti_boredom.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M44A — Starter Path Matchmaker (Archetype Routing + Anti-Boredom)
// Core Pair    : M44
// Family       : progression
// Category     : recommender
// IntelSignal  : personalization
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
 * M44A — Starter Path Matchmaker (Archetype Routing + Anti-Boredom)
 *
 * Primary function:
 *   Match new players to starter archetypes that fit their revealed decision style; prevent boredom via anti-repetition routing
 *
 * What this adds to M44:
 * 1. Match new players to starter archetypes that fit their revealed decision style.
 * 2. Anti-boredom routing: prevents starter path from feeling repetitive after first run.
 * 3. Feeds archetype analytics for game design.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M44
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M44ATelemetryInput {
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
  // Extended inputs for M44A (progression family)

}

// Telemetry events subscribed by M44A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M44ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M44AOutput extends M44ABaseOutput {
  archetypeMatch: unknown;  // archetype_match
  boredomRiskScore: unknown;  // boredom_risk_score
  antiRepetitionRouting: unknown;  // anti_repetition_routing
  designAnalyticsSignal: unknown;  // design_analytics_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M44ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M44A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M44ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M44A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M44ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M44A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M44AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M44A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M44APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M44APlacement = 'server';

export interface M44AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M44AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M44AEvalContract {
  /** archetype_retention_lift */
  /** boredom_detection_AUC */
  /** first_run_completion_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M44AModelCard {
  modelId:            'M44A';
  coreMechanicPair:   'M44';
  intelligenceSignal: 'personalization';
  modelCategory:      'recommender';
  family:             'progression';
  tier:               M44ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M44A_ML_CONSTANTS = {
  ML_ID:              'M44A',
  CORE_PAIR:          'M44',
  MODEL_NAME:         'Starter Path Matchmaker (Archetype Routing + Anti-Boredom)',
  INTEL_SIGNAL:       'personalization' as const,
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
  EVAL_FOCUS:         ["archetype_retention_lift", "boredom_detection_AUC", "first_run_completion_rate"],
  PRIMARY_OUTPUTS:    ["archetype_match", "boredom_risk_score", "anti_repetition_routing", "design_analytics_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM44aMl
 *
 * Fires after M44 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M44AOutput with signed auditHash
 */
export async function runM44aMl(
  input:     M44ATelemetryInput,
  tier:      M44ATier = 'baseline',
  modelCard: Omit<M44AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M44AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM44aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM44aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M44AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM44aMlFallback(
  _input: M44ATelemetryInput,
): M44AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M44A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    archetypeMatch: null,
    boredomRiskScore: null,
    antiRepetitionRouting: null,
    designAnalyticsSignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM44aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
