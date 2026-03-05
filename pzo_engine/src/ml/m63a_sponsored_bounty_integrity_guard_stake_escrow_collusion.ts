// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m63a_sponsored_bounty_integrity_guard_stake_escrow_collusion.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M63A — Sponsored Bounty Integrity Guard (Stake Escrow + Collusion Detection)
// Core Pair    : M63
// Family       : integrity
// Category     : anomaly_detector
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
 * M63A — Sponsored Bounty Integrity Guard (Stake Escrow + Collusion Detection)
 *
 * Primary function:
 *   Guard sponsored bounties against stake collusion and fake completion; verify winner legitimacy via ledger
 *
 * What this adds to M63:
 * 1. Guard sponsored bounties against stake collusion and fake completion.
 * 2. Verify winner legitimacy using ledger replay consistency.
 * 3. Detects sponsor-winner collusion rings.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M63
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M63ATelemetryInput {
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
  // Extended inputs for M63A (integrity family)

}

// Telemetry events subscribed by M63A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M63ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M63AOutput extends M63ABaseOutput {
  winnerLegitimacyScore: unknown;  // winner_legitimacy_score
  collusionFlag: unknown;  // collusion_flag
  integrityVerified: unknown;  // integrity_verified
  ledgerConsistencyScore: unknown;  // ledger_consistency_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M63ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M63A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M63ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M63A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M63ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M63A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M63AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M63A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M63APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M63APlacement = 'server';

export interface M63AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M63AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M63AEvalContract {
  /** collusion_detection_AUC */
  /** legitimacy_calibration_ECE */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M63AModelCard {
  modelId:            'M63A';
  coreMechanicPair:   'M63';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M63ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M63A_ML_CONSTANTS = {
  ML_ID:              'M63A',
  CORE_PAIR:          'M63',
  MODEL_NAME:         'Sponsored Bounty Integrity Guard (Stake Escrow + Collusion Detection)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
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
  EVAL_FOCUS:         ["collusion_detection_AUC", "legitimacy_calibration_ECE", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["winner_legitimacy_score", "collusion_flag", "integrity_verified", "ledger_consistency_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM63aMl
 *
 * Fires after M63 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M63AOutput with signed auditHash
 */
export async function runM63aMl(
  input:     M63ATelemetryInput,
  tier:      M63ATier = 'baseline',
  modelCard: Omit<M63AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M63AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM63aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM63aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M63AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM63aMlFallback(
  _input: M63ATelemetryInput,
): M63AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M63A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    winnerLegitimacyScore: null,
    collusionFlag: null,
    integrityVerified: null,
    ledgerConsistencyScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM63aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
