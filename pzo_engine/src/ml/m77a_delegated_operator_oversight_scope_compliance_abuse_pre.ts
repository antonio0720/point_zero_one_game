// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m77a_delegated_operator_oversight_scope_compliance_abuse_pre.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M77A — Delegated Operator Oversight (Scope Compliance + Abuse Predictor)
// Core Pair    : M77
// Family       : integrity
// Category     : anomaly_detector
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
 * M77A — Delegated Operator Oversight (Scope Compliance + Abuse Predictor)
 *
 * Primary function:
 *   Monitor delegated operator actions for scope compliance; predict abuse before it damages the table
 *
 * What this adds to M77:
 * 1. Monitor delegated operator actions for scope compliance in real time.
 * 2. Predict operator abuse trajectories before damage occurs.
 * 3. Generates delegation audit receipts.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M77
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M77ATelemetryInput {
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
  // Extended inputs for M77A (integrity family)

}

// Telemetry events subscribed by M77A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M77ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M77AOutput extends M77ABaseOutput {
  scopeComplianceScore: unknown;  // scope_compliance_score
  abusePrediction: unknown;  // abuse_prediction
  delegationReceipt: unknown;  // delegation_receipt
  interventionRecommendation: unknown;  // intervention_recommendation
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M77ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M77A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M77ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M77A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M77ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M77A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M77APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M77APlacement = 'server';

export interface M77AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M77AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M77AEvalContract {
  /** scope_violation_recall */
  /** abuse_prediction_AUC */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M77AModelCard {
  modelId:            'M77A';
  coreMechanicPair:   'M77';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M77ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M77A_ML_CONSTANTS = {
  ML_ID:              'M77A',
  CORE_PAIR:          'M77',
  MODEL_NAME:         'Delegated Operator Oversight (Scope Compliance + Abuse Predictor)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
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
  EVAL_FOCUS:         ["scope_violation_recall", "abuse_prediction_AUC", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["scope_compliance_score", "abuse_prediction", "delegation_receipt", "intervention_recommendation"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM77aMl
 *
 * Fires after M77 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M77AOutput with signed auditHash
 */
export async function runM77aMl(
  input:     M77ATelemetryInput,
  tier:      M77ATier = 'baseline',
  modelCard: Omit<M77AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M77AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM77aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM77aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M77AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM77aMlFallback(
  _input: M77ATelemetryInput,
): M77AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M77A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    scopeComplianceScore: null,
    abusePrediction: null,
    delegationReceipt: null,
    interventionRecommendation: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM77aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
