// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m84a_catalyst_pairing_compatibility_model_bridge_safety_dege.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M84A — Catalyst Pairing Compatibility Model (Bridge Safety + Degeneracy Watch)
// Core Pair    : M84
// Family       : balance
// Category     : predictor
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
 * M84A — Catalyst Pairing Compatibility Model (Bridge Safety + Degeneracy Watch)
 *
 * Primary function:
 *   Score catalyst-synergy bridge compatibility; watch for degeneracy before catalyst slots enable game-breaking combos
 *
 * What this adds to M84:
 * 1. Score catalyst-synergy bridge compatibility for safe cross-set bridging.
 * 2. Pre-screen for degeneracy: catalyst pairs that collapse game balance.
 * 3. Generates compatibility receipts for design review.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M84
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M84ATelemetryInput {
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
  // Extended inputs for M84A (balance family)

}

// Telemetry events subscribed by M84A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M84ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M84AOutput extends M84ABaseOutput {
  compatibilityScore: unknown;  // compatibility_score
  degeneracyFlag: unknown;  // degeneracy_flag
  designReviewReceipt: unknown;  // design_review_receipt
  safeBridgeRecommendation: unknown;  // safe_bridge_recommendation
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M84ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M84A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M84ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M84A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M84ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M84A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M84APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M84APlacement = 'server';

export interface M84AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M84AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M84AEvalContract {
  /** degeneracy_recall */
  /** compatibility_calibration */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M84AModelCard {
  modelId:            'M84A';
  coreMechanicPair:   'M84';
  intelligenceSignal: 'volatility';
  modelCategory:      'predictor';
  family:             'balance';
  tier:               M84ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M84A_ML_CONSTANTS = {
  ML_ID:              'M84A',
  CORE_PAIR:          'M84',
  MODEL_NAME:         'Catalyst Pairing Compatibility Model (Bridge Safety + Degeneracy Watch)',
  INTEL_SIGNAL:       'volatility' as const,
  MODEL_CATEGORY:     'predictor' as const,
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
  EVAL_FOCUS:         ["degeneracy_recall", "compatibility_calibration", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["compatibility_score", "degeneracy_flag", "design_review_receipt", "safe_bridge_recommendation"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM84aMl
 *
 * Fires after M84 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M84AOutput with signed auditHash
 */
export async function runM84aMl(
  input:     M84ATelemetryInput,
  tier:      M84ATier = 'baseline',
  modelCard: Omit<M84AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M84AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM84aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM84aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M84AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM84aMlFallback(
  _input: M84ATelemetryInput,
): M84AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M84A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    compatibilityScore: null,
    degeneracyFlag: null,
    designReviewReceipt: null,
    safeBridgeRecommendation: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM84aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
