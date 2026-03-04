// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m10a_exit_timing_model_pulse_sell_flip_optimizer.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M10A — Exit Timing Model (Pulse Sell / Flip Optimizer)
// Core Pair    : M10
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
 * M10A — Exit Timing Model (Pulse Sell / Flip Optimizer)
 *
 * Primary function:
 *   Predict optimal exit timing per asset given macro pulse; highlight flip opportunities without guaranteeing outcomes
 *
 * What this adds to M10:
 * 1. Predict optimal exit timing per asset given the current macro pulse and portfolio composition.
 * 2. Highlights flip opportunities without guaranteeing outcomes (bounded suggestion only).
 * 3. Contributes to 'opportunity flip' share-moment detection.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M10
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M10ATelemetryInput {
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
  // Extended inputs for M10A (market family)

}

// Telemetry events subscribed by M10A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M10ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M10AOutput extends M10ABaseOutput {
  exitTimingScore: unknown;  // exit_timing_score
  flipProbability: unknown;  // flip_probability
  optimalExitTickEstimate: unknown;  // optimal_exit_tick_estimate
  momentFlag: unknown;  // moment_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M10ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M10A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M10ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M10A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M10ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M10A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M10APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M10APlacement = 'client' | 'server';

export interface M10AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M10AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M10AEvalContract {
  /** exit_timing_calibration */
  /** flip_precision */
  /** opportunity_flip_yield */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M10AModelCard {
  modelId:            'M10A';
  coreMechanicPair:   'M10';
  intelligenceSignal: 'alpha';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M10ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M10A_ML_CONSTANTS = {
  ML_ID:              'M10A',
  CORE_PAIR:          'M10',
  MODEL_NAME:         'Exit Timing Model (Pulse Sell / Flip Optimizer)',
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
  EVAL_FOCUS:         ["exit_timing_calibration", "flip_precision", "opportunity_flip_yield"],
  PRIMARY_OUTPUTS:    ["exit_timing_score", "flip_probability", "optimal_exit_tick_estimate", "moment_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM10aMl
 *
 * Fires after M10 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M10AOutput with signed auditHash
 */
export async function runM10aMl(
  input:     M10ATelemetryInput,
  tier:      M10ATier = 'baseline',
  modelCard: Omit<M10AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M10AOutput> {
  // ── TODO: implement M10A — Exit Timing Model (Pulse Sell / Flip Optimizer) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M10A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M10A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M10AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m10_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M10A (Exit Timing Model (Pulse Sell / Flip Optimizer)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM10aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M10AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM10aMlFallback(
  _input: M10ATelemetryInput,
): M10AOutput {
  // TODO: implement rule-based fallback for M10A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M10A-specific extended outputs
  throw new Error('M10A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM10aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
