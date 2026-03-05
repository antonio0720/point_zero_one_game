// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m114a_timing_tax_reaction_time_coach_window_predictor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M114A — Timing Tax Reaction-Time Coach + Window Predictor
// Core Pair    : M114
// Family       : balance
// Category     : classifier
// IntelSignal  : momentum
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : client
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
 * M114A — Timing Tax Reaction-Time Coach + Window Predictor
 *
 * Primary function:
 *   Coach decision reaction time to maximize timing tax bonuses; predict upcoming decision windows for preparation
 *
 * What this adds to M114:
 * 1. Coach decision reaction time to maximize timing tax bonuses.
 * 2. Predict upcoming decision windows so players can prepare.
 * 3. Distinguishes deliberate slow play from genuine hesitation.
 *
 * Intelligence signal → IntelligenceState.momentum
 * Core mechanic pair  → M114
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M114ATelemetryInput {
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
  // Extended inputs for M114A (balance family)

}

// Telemetry events subscribed by M114A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M114ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M114AOutput extends M114ABaseOutput {
  reactionTimeCoaching: unknown;  // reaction_time_coaching
  windowPrediction: unknown;  // window_prediction
  deliberateVsHesitation: unknown;  // deliberate_vs_hesitation
  timingTaxEstimate: unknown;  // timing_tax_estimate
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M114ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M114A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M114ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M114A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M114ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M114A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M114APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M114APlacement = 'client';

export interface M114AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M114AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M114AEvalContract {
  /** window_prediction_accuracy */
  /** coaching_lift */
  /** hesitation_classification_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M114AModelCard {
  modelId:            'M114A';
  coreMechanicPair:   'M114';
  intelligenceSignal: 'momentum';
  modelCategory:      'classifier';
  family:             'balance';
  tier:               M114ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M114A_ML_CONSTANTS = {
  ML_ID:              'M114A',
  CORE_PAIR:          'M114',
  MODEL_NAME:         'Timing Tax Reaction-Time Coach + Window Predictor',
  INTEL_SIGNAL:       'momentum' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'balance' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['client'] as const,
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
  EVAL_FOCUS:         ["window_prediction_accuracy", "coaching_lift", "hesitation_classification_AUC"],
  PRIMARY_OUTPUTS:    ["reaction_time_coaching", "window_prediction", "deliberate_vs_hesitation", "timing_tax_estimate"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM114aMl
 *
 * Fires after M114 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M114AOutput with signed auditHash
 */
export async function runM114aMl(
  input:     M114ATelemetryInput,
  tier:      M114ATier = 'baseline',
  modelCard: Omit<M114AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M114AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM114aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM114aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M114AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM114aMlFallback(
  _input: M114ATelemetryInput,
): M114AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M114A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    reactionTimeCoaching: null,
    windowPrediction: null,
    deliberateVsHesitation: null,
    timingTaxEstimate: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.momentum
// Heuristic substitute (until ML is live):
//   intelligence.momentum = recentDecisionSpeed * clutchWindowCapture
// Replace with: runM114aMl(telemetry, tier, modelCard).then(out => intelligence.momentum = out.score)
