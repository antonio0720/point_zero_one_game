// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m64a_leaderboard_trust_re_verify_scheduler_proof_weighted_ra.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M64A — Leaderboard Trust & Re-Verify Scheduler (Proof-Weighted Rankings)
// Core Pair    : M64
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
 * M64A — Leaderboard Trust & Re-Verify Scheduler (Proof-Weighted Rankings)
 *
 * Primary function:
 *   Prioritize verification compute for high-impact leaderboard runs; compute trust scores gating competitive eligibility
 *
 * What this adds to M64:
 * 1. Prioritizes verification compute for high-impact runs (top ranks, suspicious deltas, new devices).
 * 2. Computes trust scores that gate markets/boards without blocking core play.
 * 3. Produces explainable 'why pending' and 'why re-verified' receipts for transparency.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M64
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M64ATelemetryInput {
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
  // Extended inputs for M64A (integrity family)

}

// Telemetry events subscribed by M64A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M64ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M64AOutput extends M64ABaseOutput {
  trustScore: unknown;  // trust_score
  verificationPriority: unknown;  // verification_priority
  pendingExplanation: unknown;  // pending_explanation
  reverifyReceipt: unknown;  // reverify_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M64ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M64A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M64ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M64A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M64ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M64A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M64AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M64A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M64APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M64APlacement = 'server';

export interface M64AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M64AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M64AEvalContract {
  /** trust_calibration_ECE */
  /** verification_throughput */
  /** false_pending_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M64AModelCard {
  modelId:            'M64A';
  coreMechanicPair:   'M64';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'classifier';
  family:             'integrity';
  tier:               M64ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M64A_ML_CONSTANTS = {
  ML_ID:              'M64A',
  CORE_PAIR:          'M64',
  MODEL_NAME:         'Leaderboard Trust & Re-Verify Scheduler (Proof-Weighted Rankings)',
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
  EVAL_FOCUS:         ["trust_calibration_ECE", "verification_throughput", "false_pending_rate"],
  PRIMARY_OUTPUTS:    ["trust_score", "verification_priority", "pending_explanation", "reverify_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM64aMl
 *
 * Fires after M64 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M64AOutput with signed auditHash
 */
export async function runM64aMl(
  input:     M64ATelemetryInput,
  tier:      M64ATier = 'baseline',
  modelCard: Omit<M64AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M64AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM64aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM64aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M64AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM64aMlFallback(
  _input: M64ATelemetryInput,
): M64AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M64A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    trustScore: null,
    verificationPriority: null,
    pendingExplanation: null,
    reverifyReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM64aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
