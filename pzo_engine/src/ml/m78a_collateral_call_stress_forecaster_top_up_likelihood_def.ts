// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m78a_collateral_call_stress_forecaster_top_up_likelihood_def.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M78A — Collateral Call Stress Forecaster (Top-Up Likelihood + Default Path)
// Core Pair    : M78
// Family       : co_op
// Category     : predictor
// IntelSignal  : risk
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

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M78A — Collateral Call Stress Forecaster (Top-Up Likelihood + Default Path)
 *
 * Primary function:
 *   Forecast collateral call top-up likelihood and model default path probability under stress scenarios
 *
 * What this adds to M78:
 * 1. Forecast collateral call top-up likelihood given partner portfolio state.
 * 2. Model default path probability under macro stress scenarios.
 * 3. Generates margin call timing recommendations.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M78
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M78ATelemetryInput {
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
  // Extended inputs for M78A (co_op family)

}

// Telemetry events subscribed by M78A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M78ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M78AOutput extends M78ABaseOutput {
  topupProbability: unknown;  // topup_probability
  defaultPathScore: unknown;  // default_path_score
  marginCallTiming: unknown;  // margin_call_timing
  stressScenarioResults: unknown;  // stress_scenario_results
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M78ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M78A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M78ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M78A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M78ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M78A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M78APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M78APlacement = 'server';

export interface M78AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M78AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M78AEvalContract {
  /** topup_calibration_ECE */
  /** default_path_AUC */
  /** timing_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M78AModelCard {
  modelId:            'M78A';
  coreMechanicPair:   'M78';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'co_op';
  tier:               M78ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M78A_ML_CONSTANTS = {
  ML_ID:              'M78A',
  CORE_PAIR:          'M78',
  MODEL_NAME:         'Collateral Call Stress Forecaster (Top-Up Likelihood + Default Path)',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'co_op' as const,
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
  EVAL_FOCUS:         ["topup_calibration_ECE", "default_path_AUC", "timing_accuracy"],
  PRIMARY_OUTPUTS:    ["topup_probability", "default_path_score", "margin_call_timing", "stress_scenario_results"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM78aMl
 *
 * Fires after M78 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M78AOutput with signed auditHash
 */
export async function runM78aMl(
  input:     M78ATelemetryInput,
  tier:      M78ATier = 'baseline',
  modelCard: Omit<M78AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M78AOutput> {
  // ── TODO: implement M78A — Collateral Call Stress Forecaster (Top-Up Likelihood + Default Path) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M78A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M78A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M78AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: real_time
  // ExecHook:  after_m78_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M78A (Collateral Call Stress Forecaster (Top-Up Likelihood + Default Path)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM78aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M78AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM78aMlFallback(
  _input: M78ATelemetryInput,
): M78AOutput {
  // TODO: implement rule-based fallback for M78A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M78A-specific extended outputs
  throw new Error('M78A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM78aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
