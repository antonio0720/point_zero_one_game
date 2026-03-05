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

import { createHash } from 'node:crypto';

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
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM78aMlFallback(input);
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
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M78A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    topupProbability: null,
    defaultPathScore: null,
    marginCallTiming: null,
    stressScenarioResults: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM78aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
