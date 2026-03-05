// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m48a_replay_consistency_model_deterministic_validator_assist.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M48A — Replay Consistency Model (Deterministic Validator Assist)
// Core Pair    : M48
// Family       : integrity
// Category     : classifier
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M48A — Replay Consistency Model (Deterministic Validator Assist)
 *
 * Primary function:
 *   Assist deterministic validator by pre-scoring replay consistency; prioritize verification compute for suspicious runs
 *
 * What this adds to M48:
 * 1. Assist the deterministic validator by pre-scoring replay consistency.
 * 2. Prioritizes verification compute: high-risk runs get validated first.
 * 3. Reduces validator backlog by filtering obviously-clean runs.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M48
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M48ATelemetryInput {
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
  // Extended inputs for M48A (integrity family)

}

// Telemetry events subscribed by M48A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M48ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M48AOutput extends M48ABaseOutput {
  consistencyPreScore: unknown;  // consistency_pre_score
  verificationPriority: unknown;  // verification_priority
  cleanRunFilterPassed: unknown;  // clean_run_filter_passed
  backlogReductionDelta: unknown;  // backlog_reduction_delta
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M48ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M48A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M48ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M48A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M48ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M48A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M48AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M48A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M48APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M48APlacement = 'server';

export interface M48AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M48AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M48AEvalContract {
  /** pre_score_calibration_ECE */
  /** suspicious_recall */
  /** validator_throughput_lift */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M48AModelCard {
  modelId:            'M48A';
  coreMechanicPair:   'M48';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'classifier';
  family:             'integrity';
  tier:               M48ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M48A_ML_CONSTANTS = {
  ML_ID:              'M48A',
  CORE_PAIR:          'M48',
  MODEL_NAME:         'Replay Consistency Model (Deterministic Validator Assist)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["pre_score_calibration_ECE", "suspicious_recall", "validator_throughput_lift"],
  PRIMARY_OUTPUTS:    ["consistency_pre_score", "verification_priority", "clean_run_filter_passed", "backlog_reduction_delta"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM48aMl
 *
 * Fires after M48 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M48AOutput with signed auditHash
 */
export async function runM48aMl(
  input:     M48ATelemetryInput,
  tier:      M48ATier = 'baseline',
  modelCard: Omit<M48AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M48AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM48aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM48aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M48AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM48aMlFallback(
  _input: M48ATelemetryInput,
): M48AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M48A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    consistencyPreScore: null,
    verificationPriority: null,
    cleanRunFilterPassed: null,
    backlogReductionDelta: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM48aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
