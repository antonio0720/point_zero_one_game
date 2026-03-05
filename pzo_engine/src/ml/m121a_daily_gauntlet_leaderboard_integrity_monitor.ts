// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m121a_daily_gauntlet_leaderboard_integrity_monitor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M121A — Daily Gauntlet Leaderboard Integrity Monitor
// Core Pair    : M121
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
 * M121A — Daily Gauntlet Leaderboard Integrity Monitor
 *
 * Primary function:
 *   Monitor daily gauntlet leaderboard for coordinated score manipulation and seed exploitation patterns
 *
 * What this adds to M121:
 * 1. Monitor daily gauntlet leaderboard for coordinated score manipulation.
 * 2. Detect seed exploitation: players sharing optimal move sequences for unfair advantage.
 * 3. Generates daily integrity digest.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M121
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M121ATelemetryInput {
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
  // Extended inputs for M121A (integrity family)

}

// Telemetry events subscribed by M121A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M121ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M121AOutput extends M121ABaseOutput {
  manipulationFlag: unknown;  // manipulation_flag
  seedExploitDetection: unknown;  // seed_exploit_detection
  dailyIntegrityDigest: unknown;  // daily_integrity_digest
  leaderboardTrustScore: unknown;  // leaderboard_trust_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M121ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M121A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M121ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M121A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M121ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M121A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M121APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M121APlacement = 'server';

export interface M121AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M121AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M121AEvalContract {
  /** manipulation_AUC */
  /** seed_exploit_recall */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M121AModelCard {
  modelId:            'M121A';
  coreMechanicPair:   'M121';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M121ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M121A_ML_CONSTANTS = {
  ML_ID:              'M121A',
  CORE_PAIR:          'M121',
  MODEL_NAME:         'Daily Gauntlet Leaderboard Integrity Monitor',
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
  EVAL_FOCUS:         ["manipulation_AUC", "seed_exploit_recall", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["manipulation_flag", "seed_exploit_detection", "daily_integrity_digest", "leaderboard_trust_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM121aMl
 *
 * Fires after M121 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M121AOutput with signed auditHash
 */
export async function runM121aMl(
  input:     M121ATelemetryInput,
  tier:      M121ATier = 'baseline',
  modelCard: Omit<M121AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M121AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM121aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM121aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M121AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM121aMlFallback(
  _input: M121ATelemetryInput,
): M121AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M121A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    manipulationFlag: null,
    seedExploitDetection: null,
    dailyIntegrityDigest: null,
    leaderboardTrustScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM121aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
