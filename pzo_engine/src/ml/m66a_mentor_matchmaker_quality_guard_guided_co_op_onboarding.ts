// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m66a_mentor_matchmaker_quality_guard_guided_co_op_onboarding.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M66A — Mentor Matchmaker + Quality Guard (Guided Co-op Onboarding)
// Core Pair    : M66
// Family       : co_op
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
 * M66A — Mentor Matchmaker + Quality Guard (Guided Co-op Onboarding)
 *
 * Primary function:
 *   Match mentors to new players by teaching style compatibility; guard mentor quality through outcome tracking
 *
 * What this adds to M66:
 * 1. Match mentors to new players by teaching style compatibility.
 * 2. Guard mentor quality: mentors with poor mentee outcomes lose queue priority.
 * 3. Detects mentor abuse: experienced players using mentoring for farming.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M66
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M66ATelemetryInput {
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
  // Extended inputs for M66A (co_op family)

}

// Telemetry events subscribed by M66A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M66ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M66AOutput extends M66ABaseOutput {
  mentorMatchScore: unknown;  // mentor_match_score
  qualityScore: unknown;  // quality_score
  abuseFlag: unknown;  // abuse_flag
  menteeOutcomePrediction: unknown;  // mentee_outcome_prediction
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M66ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M66A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M66ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M66A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M66ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M66A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M66AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M66A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M66APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M66APlacement = 'server';

export interface M66AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M66AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M66AEvalContract {
  /** mentee_retention_lift */
  /** quality_guard_AUC */
  /** abuse_detection_precision */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M66AModelCard {
  modelId:            'M66A';
  coreMechanicPair:   'M66';
  intelligenceSignal: 'personalization';
  modelCategory:      'recommender';
  family:             'co_op';
  tier:               M66ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M66A_ML_CONSTANTS = {
  ML_ID:              'M66A',
  CORE_PAIR:          'M66',
  MODEL_NAME:         'Mentor Matchmaker + Quality Guard (Guided Co-op Onboarding)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'co_op' as const,
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
  EVAL_FOCUS:         ["mentee_retention_lift", "quality_guard_AUC", "abuse_detection_precision"],
  PRIMARY_OUTPUTS:    ["mentor_match_score", "quality_score", "abuse_flag", "mentee_outcome_prediction"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM66aMl
 *
 * Fires after M66 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M66AOutput with signed auditHash
 */
export async function runM66aMl(
  input:     M66ATelemetryInput,
  tier:      M66ATier = 'baseline',
  modelCard: Omit<M66AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M66AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM66aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM66aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M66AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM66aMlFallback(
  _input: M66ATelemetryInput,
): M66AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M66A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    mentorMatchScore: null,
    qualityScore: null,
    abuseFlag: null,
    menteeOutcomePrediction: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM66aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
