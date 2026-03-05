// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m107a_refi_eligibility_estimator_term_optimizer.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M107A — Refi Eligibility Estimator + Term Optimizer
// Core Pair    : M107
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

import { createHash } from 'node:crypto';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M107A — Refi Eligibility Estimator + Term Optimizer
 *
 * Primary function:
 *   Estimate refi eligibility probability under current macro conditions; optimize term selection for best net cashflow outcome
 *
 * What this adds to M107:
 * 1. Estimate refi eligibility probability under current macro conditions.
 * 2. Optimize term selection for best net cashflow outcome without debt-trap risk.
 * 3. Surfaces refi window timing recommendations.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M107
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M107ATelemetryInput {
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
  // Extended inputs for M107A (market family)

}

// Telemetry events subscribed by M107A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M107ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M107AOutput extends M107ABaseOutput {
  eligibilityProbability: unknown;  // eligibility_probability
  optimizedTerms: unknown;  // optimized_terms
  debtTrapRisk: unknown;  // debt_trap_risk
  windowTiming: unknown;  // window_timing
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M107ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M107A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M107ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M107A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M107ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M107A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M107APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M107APlacement = 'client' | 'server';

export interface M107AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M107AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M107AEvalContract {
  /** eligibility_calibration_ECE */
  /** term_optimization_quality */
  /** debt_trap_recall */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M107AModelCard {
  modelId:            'M107A';
  coreMechanicPair:   'M107';
  intelligenceSignal: 'alpha';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M107ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M107A_ML_CONSTANTS = {
  ML_ID:              'M107A',
  CORE_PAIR:          'M107',
  MODEL_NAME:         'Refi Eligibility Estimator + Term Optimizer',
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
  EVAL_FOCUS:         ["eligibility_calibration_ECE", "term_optimization_quality", "debt_trap_recall"],
  PRIMARY_OUTPUTS:    ["eligibility_probability", "optimized_terms", "debt_trap_risk", "window_timing"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM107aMl
 *
 * Fires after M107 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M107AOutput with signed auditHash
 */
export async function runM107aMl(
  input:     M107ATelemetryInput,
  tier:      M107ATier = 'baseline',
  modelCard: Omit<M107AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M107AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM107aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM107aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M107AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM107aMlFallback(
  _input: M107ATelemetryInput,
): M107AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M107A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    eligibilityProbability: null,
    optimizedTerms: null,
    debtTrapRisk: null,
    windowTiming: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM107aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
