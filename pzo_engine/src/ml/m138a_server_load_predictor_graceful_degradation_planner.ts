// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m138a_server_load_predictor_graceful_degradation_planner.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M138A — Server Load Predictor + Graceful Degradation Planner
// Core Pair    : M138
// Family       : integrity
// Category     : predictor
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : real_time
// Lock-Off     : NO — always active (integrity / anti-cheat)
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
 * M138A — Server Load Predictor + Graceful Degradation Planner
 *
 * Primary function:
 *   Predict server load spikes before they impact runs; plan graceful feature degradation that preserves run integrity
 *
 * What this adds to M138:
 * 1. Predict server load spikes before they impact active runs.
 * 2. Plan graceful feature degradation: shed non-critical features, never run integrity.
 * 3. Generates load shedding receipt for post-incident review.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M138
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M138ATelemetryInput {
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
  // Extended inputs for M138A (integrity family)

}

// Telemetry events subscribed by M138A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M138ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M138AOutput extends M138ABaseOutput {
  loadSpikePrediction: unknown;  // load_spike_prediction
  degradationPlan: unknown;  // degradation_plan
  integrityPreservationVerified: unknown;  // integrity_preservation_verified
  sheddingReceipt: unknown;  // shedding_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M138ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M138A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M138ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M138A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M138ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M138A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M138APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M138APlacement = 'server';

export interface M138AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M138AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M138AEvalContract {
  /** load_prediction_AUC */
  /** degradation_plan_quality */
  /** integrity_preservation_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M138AModelCard {
  modelId:            'M138A';
  coreMechanicPair:   'M138';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'predictor';
  family:             'integrity';
  tier:               M138ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M138A_ML_CONSTANTS = {
  ML_ID:              'M138A',
  CORE_PAIR:          'M138',
  MODEL_NAME:         'Server Load Predictor + Graceful Degradation Planner',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'real_time' as const,
  CAN_LOCK_OFF:        false,
  GUARDRAILS: {
    determinismPreserved:      true,
    boundedNudges:             true,
    auditabilityRequired:      true,
    privacyEnforced:           true,
    competitiveLockOffAllowed: false,
    scoreCap:                  1.0,
    abstainThreshold:          0.35,
  },
  EVAL_FOCUS:         ["load_prediction_AUC", "degradation_plan_quality", "integrity_preservation_rate"],
  PRIMARY_OUTPUTS:    ["load_spike_prediction", "degradation_plan", "integrity_preservation_verified", "shedding_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM138aMl
 *
 * Fires after M138 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M138AOutput with signed auditHash
 */
export async function runM138aMl(
  input:     M138ATelemetryInput,
  tier:      M138ATier = 'baseline',
  modelCard: Omit<M138AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M138AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM138aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM138aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M138AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM138aMlFallback(
  _input: M138ATelemetryInput,
): M138AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M138A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    loadSpikePrediction: null,
    degradationPlan: null,
    integrityPreservationVerified: null,
    sheddingReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM138aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
