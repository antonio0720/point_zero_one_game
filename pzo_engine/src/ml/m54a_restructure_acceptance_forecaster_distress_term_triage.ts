// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m54a_restructure_acceptance_forecaster_distress_term_triage.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M54A — Restructure Acceptance Forecaster (Distress Term Triage)
// Core Pair    : M54
// Family       : contract
// Category     : predictor
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
 * M54A — Restructure Acceptance Forecaster (Distress Term Triage)
 *
 * Primary function:
 *   Forecast restructure proposal acceptance probability; triage distress terms to maximize cooperative outcome
 *
 * What this adds to M54:
 * 1. Forecast restructure proposal acceptance probability given partner state and history.
 * 2. Triage distress terms to maximize cooperative resolution vs. adversarial default.
 * 3. Generates negotiation window recommendations.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M54
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M54ATelemetryInput {
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
  // Extended inputs for M54A (contract family)

}

// Telemetry events subscribed by M54A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M54ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M54AOutput extends M54ABaseOutput {
  acceptanceProbability: unknown;  // acceptance_probability
  distressTriage: unknown;  // distress_triage
  negotiationWindowRecommendation: unknown;  // negotiation_window_recommendation
  cooperativeOutcomeScore: unknown;  // cooperative_outcome_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M54ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M54A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M54ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M54A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M54ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M54A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M54AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M54A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M54APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M54APlacement = 'server';

export interface M54AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M54AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M54AEvalContract {
  /** acceptance_calibration_ECE */
  /** cooperative_resolution_rate */
  /** distress_triage_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M54AModelCard {
  modelId:            'M54A';
  coreMechanicPair:   'M54';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'predictor';
  family:             'contract';
  tier:               M54ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M54A_ML_CONSTANTS = {
  ML_ID:              'M54A',
  CORE_PAIR:          'M54',
  MODEL_NAME:         'Restructure Acceptance Forecaster (Distress Term Triage)',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'contract' as const,
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
  EVAL_FOCUS:         ["acceptance_calibration_ECE", "cooperative_resolution_rate", "distress_triage_accuracy"],
  PRIMARY_OUTPUTS:    ["acceptance_probability", "distress_triage", "negotiation_window_recommendation", "cooperative_outcome_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM54aMl
 *
 * Fires after M54 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M54AOutput with signed auditHash
 */
export async function runM54aMl(
  input:     M54ATelemetryInput,
  tier:      M54ATier = 'baseline',
  modelCard: Omit<M54AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M54AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM54aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM54aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M54AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM54aMlFallback(
  _input: M54ATelemetryInput,
): M54AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M54A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    acceptanceProbability: null,
    distressTriage: null,
    negotiationWindowRecommendation: null,
    cooperativeOutcomeScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM54aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
