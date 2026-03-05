// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m99a_integrity_challenge_placement_optimizer_non_disruptive.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M99A — Integrity Challenge Placement Optimizer (Non-Disruptive + High-Signal)
// Core Pair    : M99
// Family       : integrity
// Category     : controller
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
 * M99A — Integrity Challenge Placement Optimizer (Non-Disruptive + High-Signal)
 *
 * Primary function:
 *   Optimize placement and timing of integrity challenges to maximize signal value without disrupting legitimate play
 *
 * What this adds to M99:
 * 1. Optimize challenge placement and timing for maximum signal yield.
 * 2. Non-disruptive: challenges feel like natural game moments, not security checks.
 * 3. Adapts challenge difficulty to current device trust tier.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M99
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M99ATelemetryInput {
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
  // Extended inputs for M99A (integrity family)

}

// Telemetry events subscribed by M99A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M99ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M99AOutput extends M99ABaseOutput {
  challengePlacement: unknown;  // challenge_placement
  signalYieldEstimate: unknown;  // signal_yield_estimate
  disruptionScore: unknown;  // disruption_score
  difficultyTier: unknown;  // difficulty_tier
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M99ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M99A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M99ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M99A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M99ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M99A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M99APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M99APlacement = 'server';

export interface M99AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M99AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M99AEvalContract {
  /** signal_yield_AUC */
  /** disruption_rate */
  /** placement_calibration */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M99AModelCard {
  modelId:            'M99A';
  coreMechanicPair:   'M99';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'controller';
  family:             'integrity';
  tier:               M99ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M99A_ML_CONSTANTS = {
  ML_ID:              'M99A',
  CORE_PAIR:          'M99',
  MODEL_NAME:         'Integrity Challenge Placement Optimizer (Non-Disruptive + High-Signal)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'controller' as const,
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
  EVAL_FOCUS:         ["signal_yield_AUC", "disruption_rate", "placement_calibration"],
  PRIMARY_OUTPUTS:    ["challenge_placement", "signal_yield_estimate", "disruption_score", "difficulty_tier"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM99aMl
 *
 * Fires after M99 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M99AOutput with signed auditHash
 */
export async function runM99aMl(
  input:     M99ATelemetryInput,
  tier:      M99ATier = 'baseline',
  modelCard: Omit<M99AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M99AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM99aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM99aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M99AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM99aMlFallback(
  _input: M99ATelemetryInput,
): M99AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M99A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    challengePlacement: null,
    signalYieldEstimate: null,
    disruptionScore: null,
    difficultyTier: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM99aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
