// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m17a_bailout_trigger_classifier_clutch_assist_gate.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M17A — Bailout Trigger Classifier (Clutch Assist Gate)
// Core Pair    : M17
// Family       : balance
// Category     : classifier
// IntelSignal  : momentum
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
 * M17A — Bailout Trigger Classifier (Clutch Assist Gate)
 *
 * Primary function:
 *   Classify whether a bailout request is a genuine clutch moment vs. learned helplessness or abuse
 *
 * What this adds to M17:
 * 1. Classify whether a bailout request is a genuine clutch moment or learned helplessness / abuse.
 * 2. Calibrates bailout availability to preserve drama without enabling grinding.
 * 3. Outputs 'clutch assist' label for share-moment detection.
 *
 * Intelligence signal → IntelligenceState.momentum
 * Core mechanic pair  → M17
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M17ATelemetryInput {
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
  // Extended inputs for M17A (balance family)

}

// Telemetry events subscribed by M17A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M17ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M17AOutput extends M17ABaseOutput {
  bailoutLegitimacyScore: unknown;  // bailout_legitimacy_score
  abuseProbability: unknown;  // abuse_probability
  clutchLabel: unknown;  // clutch_label
  helplessnessFlag: unknown;  // helplessness_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M17ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M17A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M17ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M17A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M17ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M17A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M17APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M17APlacement = 'server';

export interface M17AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M17AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M17AEvalContract {
  /** clutch_precision */
  /** abuse_detection_AUC */
  /** bailout_drama_yield */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M17AModelCard {
  modelId:            'M17A';
  coreMechanicPair:   'M17';
  intelligenceSignal: 'momentum';
  modelCategory:      'classifier';
  family:             'balance';
  tier:               M17ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M17A_ML_CONSTANTS = {
  ML_ID:              'M17A',
  CORE_PAIR:          'M17',
  MODEL_NAME:         'Bailout Trigger Classifier (Clutch Assist Gate)',
  INTEL_SIGNAL:       'momentum' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'balance' as const,
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
  EVAL_FOCUS:         ["clutch_precision", "abuse_detection_AUC", "bailout_drama_yield"],
  PRIMARY_OUTPUTS:    ["bailout_legitimacy_score", "abuse_probability", "clutch_label", "helplessness_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM17aMl
 *
 * Fires after M17 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M17AOutput with signed auditHash
 */
export async function runM17aMl(
  input:     M17ATelemetryInput,
  tier:      M17ATier = 'baseline',
  modelCard: Omit<M17AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M17AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM17aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM17aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M17AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM17aMlFallback(
  _input: M17ATelemetryInput,
): M17AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M17A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    bailoutLegitimacyScore: null,
    abuseProbability: null,
    clutchLabel: null,
    helplessnessFlag: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.momentum
// Heuristic substitute (until ML is live):
//   intelligence.momentum = recentDecisionSpeed * clutchWindowCapture
// Replace with: runM17aMl(telemetry, tier, modelCard).then(out => intelligence.momentum = out.score)
