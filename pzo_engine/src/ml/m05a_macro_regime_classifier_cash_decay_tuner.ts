// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m05a_macro_regime_classifier_cash_decay_tuner.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M05A — Macro Regime Classifier + Cash Decay Tuner
// Core Pair    : M05
// Family       : market
// Category     : classifier
// IntelSignal  : volatility
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
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
 * M05A — Macro Regime Classifier + Cash Decay Tuner
 *
 * Primary function:
 *   Classify current market regime from run state signals; tune cash decay rate to stay within design bounds
 *
 * What this adds to M05:
 * 1. Classify current market regime in real time and tune cash decay rate within bounded design envelope.
 * 2. Ensures regime transitions feel earned, not arbitrary; detects when macro is too punishing for skill band.
 * 3. Drives Macro Shock Scheduler (M20) pre-computation.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M05
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M05ATelemetryInput {
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
  // Extended inputs for M05A (market family)

}

// Telemetry events subscribed by M05A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M05ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M05AOutput extends M05ABaseOutput {
  regimeClassification: unknown;  // regime_classification
  regimeConfidence: unknown;  // regime_confidence
  decayRateDelta: unknown;  // decay_rate_delta
  transitionProbability: unknown;  // transition_probability
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M05ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M05A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M05ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M05A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M05ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M05A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M05APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M05APlacement = 'server';

export interface M05AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M05AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M05AEvalContract {
  /** regime_classification_accuracy */
  /** false_transition_rate */
  /** decay_calibration_ECE */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M05AModelCard {
  modelId:            'M05A';
  coreMechanicPair:   'M05';
  intelligenceSignal: 'volatility';
  modelCategory:      'classifier';
  family:             'market';
  tier:               M05ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M05A_ML_CONSTANTS = {
  ML_ID:              'M05A',
  CORE_PAIR:          'M05',
  MODEL_NAME:         'Macro Regime Classifier + Cash Decay Tuner',
  INTEL_SIGNAL:       'volatility' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["regime_classification_accuracy", "false_transition_rate", "decay_calibration_ECE"],
  PRIMARY_OUTPUTS:    ["regime_classification", "regime_confidence", "decay_rate_delta", "transition_probability"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM05aMl
 *
 * Fires after M05 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M05AOutput with signed auditHash
 */
export async function runM05aMl(
  input:     M05ATelemetryInput,
  tier:      M05ATier = 'baseline',
  modelCard: Omit<M05AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M05AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM05aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM05aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M05AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM05aMlFallback(
  _input: M05ATelemetryInput,
): M05AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M05A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    regimeClassification: null,
    regimeConfidence: null,
    decayRateDelta: null,
    transitionProbability: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM05aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
