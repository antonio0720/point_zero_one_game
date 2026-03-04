// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m108a_partial_fill_probability_timing_tutor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M108A — Partial Fill Probability + Timing Tutor
// Core Pair    : M108
// Family       : market
// Category     : predictor
// IntelSignal  : alpha
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : client, server
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

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M108A — Partial Fill Probability + Timing Tutor
 *
 * Primary function:
 *   Estimate partial fill probability for deal requests; tutor players on timing decisions to maximize fill rate
 *
 * What this adds to M108:
 * 1. Estimate partial fill probability for deal requests given current market state.
 * 2. Tutor timing decisions: earlier often fills more, but context matters.
 * 3. Surfaces fill timing windows for player UI.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M108
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M108ATelemetryInput {
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
  // Extended inputs for M108A (market family)

}

// Telemetry events subscribed by M108A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M108ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M108AOutput extends M108ABaseOutput {
  fillProbability: unknown;  // fill_probability
  timingRecommendation: unknown;  // timing_recommendation
  fillWindowEstimate: unknown;  // fill_window_estimate
  tutorHint: unknown;  // tutor_hint
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M108ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M108A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M108ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M108A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M108ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M108A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M108APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M108APlacement = 'client' | 'server';

export interface M108AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M108AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M108AEvalContract {
  /** fill_probability_calibration_ECE */
  /** timing_recommendation_AUC */
  /** fill_rate_lift */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M108AModelCard {
  modelId:            'M108A';
  coreMechanicPair:   'M108';
  intelligenceSignal: 'alpha';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M108ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M108A_ML_CONSTANTS = {
  ML_ID:              'M108A',
  CORE_PAIR:          'M108',
  MODEL_NAME:         'Partial Fill Probability + Timing Tutor',
  INTEL_SIGNAL:       'alpha' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['client', 'server'] as const,
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
  EVAL_FOCUS:         ["fill_probability_calibration_ECE", "timing_recommendation_AUC", "fill_rate_lift"],
  PRIMARY_OUTPUTS:    ["fill_probability", "timing_recommendation", "fill_window_estimate", "tutor_hint"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM108aMl
 *
 * Fires after M108 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M108AOutput with signed auditHash
 */
export async function runM108aMl(
  input:     M108ATelemetryInput,
  tier:      M108ATier = 'baseline',
  modelCard: Omit<M108AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M108AOutput> {
  // ── TODO: implement M108A — Partial Fill Probability + Timing Tutor ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M108A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M108A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M108AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m108_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M108A (Partial Fill Probability + Timing Tutor) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM108aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M108AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM108aMlFallback(
  _input: M108ATelemetryInput,
): M108AOutput {
  // TODO: implement rule-based fallback for M108A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M108A-specific extended outputs
  throw new Error('M108A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM108aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
