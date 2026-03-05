// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m148a_counterparty_freeze_forecast_premium_estimator.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M148A — Counterparty Freeze Forecast + Premium Estimator
// Core Pair    : M148
// Family       : contract
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
 * M148A — Counterparty Freeze Forecast + Premium Estimator
 *
 * Primary function:
 *   Forecast counterparty freeze probability given current market state; estimate insurance premium for freeze protection
 *
 * What this adds to M148:
 * 1. Forecast counterparty freeze probability given current market state.
 * 2. Estimate fair insurance premium for freeze protection — never predatory.
 * 3. Generates freeze risk receipts for contract negotiations.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M148
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M148ATelemetryInput {
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
  // Extended inputs for M148A (contract family)

}

// Telemetry events subscribed by M148A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M148ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M148AOutput extends M148ABaseOutput {
  freezeProbability: unknown;  // freeze_probability
  premiumEstimate: unknown;  // premium_estimate
  freezeReceipt: unknown;  // freeze_receipt
  marketStateSignal: unknown;  // market_state_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M148ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M148A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M148ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M148A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M148ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M148A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M148APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M148APlacement = 'server';

export interface M148AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M148AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M148AEvalContract {
  /** freeze_probability_calibration_ECE */
  /** premium_fairness_rating */
  /** freeze_prediction_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M148AModelCard {
  modelId:            'M148A';
  coreMechanicPair:   'M148';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'contract';
  tier:               M148ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M148A_ML_CONSTANTS = {
  ML_ID:              'M148A',
  CORE_PAIR:          'M148',
  MODEL_NAME:         'Counterparty Freeze Forecast + Premium Estimator',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'contract' as const,
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
  EVAL_FOCUS:         ["freeze_probability_calibration_ECE", "premium_fairness_rating", "freeze_prediction_AUC"],
  PRIMARY_OUTPUTS:    ["freeze_probability", "premium_estimate", "freeze_receipt", "market_state_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM148aMl
 *
 * Fires after M148 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M148AOutput with signed auditHash
 */
export async function runM148aMl(
  input:     M148ATelemetryInput,
  tier:      M148ATier = 'baseline',
  modelCard: Omit<M148AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M148AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM148aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM148aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M148AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM148aMlFallback(
  _input: M148ATelemetryInput,
): M148AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M148A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    freezeProbability: null,
    premiumEstimate: null,
    freezeReceipt: null,
    marketStateSignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM148aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
