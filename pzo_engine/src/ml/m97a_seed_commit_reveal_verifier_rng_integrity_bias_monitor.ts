// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m97a_seed_commit_reveal_verifier_rng_integrity_bias_monitor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M97A — Seed Commit/Reveal Verifier (RNG Integrity + Bias Monitor)
// Core Pair    : M97
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
 * M97A — Seed Commit/Reveal Verifier (RNG Integrity + Bias Monitor)
 *
 * Primary function:
 *   Verify commit/reveal RNG integrity; detect bias in seed generation patterns indicating predetermination
 *
 * What this adds to M97:
 * 1. Verify commit/reveal RNG integrity across the full seed lifecycle.
 * 2. Detect bias in seed generation patterns indicating predetermination or server-side manipulation.
 * 3. Feeds Replay Forensics (M01a) with RNG integrity signals.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M97
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M97ATelemetryInput {
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
  // Extended inputs for M97A (integrity family)

}

// Telemetry events subscribed by M97A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M97ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M97AOutput extends M97ABaseOutput {
  rngIntegrityScore: unknown;  // rng_integrity_score
  biasDetectionFlag: unknown;  // bias_detection_flag
  predeterminationProbability: unknown;  // predetermination_probability
  forensicSignal: unknown;  // forensic_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M97ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M97A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M97ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M97A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M97ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M97A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M97APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M97APlacement = 'server';

export interface M97AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M97AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M97AEvalContract {
  /** bias_detection_AUC */
  /** rng_integrity_calibration */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M97AModelCard {
  modelId:            'M97A';
  coreMechanicPair:   'M97';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M97ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M97A_ML_CONSTANTS = {
  ML_ID:              'M97A',
  CORE_PAIR:          'M97',
  MODEL_NAME:         'Seed Commit/Reveal Verifier (RNG Integrity + Bias Monitor)',
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
  EVAL_FOCUS:         ["bias_detection_AUC", "rng_integrity_calibration", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["rng_integrity_score", "bias_detection_flag", "predetermination_probability", "forensic_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM97aMl
 *
 * Fires after M97 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M97AOutput with signed auditHash
 */
export async function runM97aMl(
  input:     M97ATelemetryInput,
  tier:      M97ATier = 'baseline',
  modelCard: Omit<M97AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M97AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM97aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM97aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M97AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM97aMlFallback(
  _input: M97ATelemetryInput,
): M97AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M97A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    rngIntegrityScore: null,
    biasDetectionFlag: null,
    predeterminationProbability: null,
    forensicSignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM97aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
