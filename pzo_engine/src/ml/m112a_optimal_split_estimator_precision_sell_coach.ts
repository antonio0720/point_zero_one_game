// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m112a_optimal_split_estimator_precision_sell_coach.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M112A — Optimal Split Estimator (Precision Sell Coach)
// Core Pair    : M112
// Family       : market
// Category     : recommender
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
 * M112A — Optimal Split Estimator (Precision Sell Coach)
 *
 * Primary function:
 *   Estimate optimal sell split ratio for maximum recovery probability; coach precision split decisions under time pressure
 *
 * What this adds to M112:
 * 1. Estimate optimal sell split ratio for maximum recovery probability.
 * 2. Coach precision split decisions under time pressure without prescribing exact amounts.
 * 3. Counterfactual: 'if you had split 40/60 instead...' in post-mortem.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M112
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M112ATelemetryInput {
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
  // Extended inputs for M112A (market family)

}

// Telemetry events subscribed by M112A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M112ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M112AOutput extends M112ABaseOutput {
  optimalSplitRatio: unknown;  // optimal_split_ratio
  recoveryProbability: unknown;  // recovery_probability
  coachingHint: unknown;  // coaching_hint
  counterfactualSignal: unknown;  // counterfactual_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M112ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M112A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M112ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M112A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M112ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M112A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M112APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M112APlacement = 'client' | 'server';

export interface M112AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M112AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M112AEvalContract {
  /** split_optimality_accuracy */
  /** recovery_calibration_ECE */
  /** coaching_acceptance_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M112AModelCard {
  modelId:            'M112A';
  coreMechanicPair:   'M112';
  intelligenceSignal: 'alpha';
  modelCategory:      'recommender';
  family:             'market';
  tier:               M112ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M112A_ML_CONSTANTS = {
  ML_ID:              'M112A',
  CORE_PAIR:          'M112',
  MODEL_NAME:         'Optimal Split Estimator (Precision Sell Coach)',
  INTEL_SIGNAL:       'alpha' as const,
  MODEL_CATEGORY:     'recommender' as const,
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
  EVAL_FOCUS:         ["split_optimality_accuracy", "recovery_calibration_ECE", "coaching_acceptance_rate"],
  PRIMARY_OUTPUTS:    ["optimal_split_ratio", "recovery_probability", "coaching_hint", "counterfactual_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM112aMl
 *
 * Fires after M112 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M112AOutput with signed auditHash
 */
export async function runM112aMl(
  input:     M112ATelemetryInput,
  tier:      M112ATier = 'baseline',
  modelCard: Omit<M112AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M112AOutput> {
  // ── TODO: implement M112A — Optimal Split Estimator (Precision Sell Coach) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M112A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M112A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M112AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m112_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M112A (Optimal Split Estimator (Precision Sell Coach)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM112aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M112AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM112aMlFallback(
  _input: M112ATelemetryInput,
): M112AOutput {
  // TODO: implement rule-based fallback for M112A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M112A-specific extended outputs
  throw new Error('M112A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM112aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
