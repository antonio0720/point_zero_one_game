// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m101a_mutator_draft_recommender_balance_forecaster.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M101A — Mutator Draft Recommender + Balance Forecaster
// Core Pair    : M101
// Family       : balance
// Category     : recommender
// IntelSignal  : recommendationPower
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
 * M101A — Mutator Draft Recommender + Balance Forecaster
 *
 * Primary function:
 *   Recommend mutator combinations that maximize run variety and drama; forecast balance impact before activation
 *
 * What this adds to M101:
 * 1. Recommend mutator combinations that maximize run variety and personal challenge.
 * 2. Forecast balance impact before activation: no mutators that trivialize or destroy.
 * 3. Personalize mutator suggestions to player's revealed blind spots.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M101
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M101ATelemetryInput {
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
  // Extended inputs for M101A (balance family)

}

// Telemetry events subscribed by M101A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M101ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M101AOutput extends M101ABaseOutput {
  mutatorRecommendation: unknown;  // mutator_recommendation
  balanceForecast: unknown;  // balance_forecast
  blindSpotTargeting: unknown;  // blind_spot_targeting
  trivializeFlag: unknown;  // trivialize_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M101ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M101A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M101ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M101A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M101ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M101A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M101APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M101APlacement = 'server';

export interface M101AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M101AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M101AEvalContract {
  /** recommendation_acceptance_rate */
  /** balance_forecast_accuracy */
  /** run_variety_index */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M101AModelCard {
  modelId:            'M101A';
  coreMechanicPair:   'M101';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'recommender';
  family:             'balance';
  tier:               M101ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M101A_ML_CONSTANTS = {
  ML_ID:              'M101A',
  CORE_PAIR:          'M101',
  MODEL_NAME:         'Mutator Draft Recommender + Balance Forecaster',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'recommender' as const,
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
  EVAL_FOCUS:         ["recommendation_acceptance_rate", "balance_forecast_accuracy", "run_variety_index"],
  PRIMARY_OUTPUTS:    ["mutator_recommendation", "balance_forecast", "blind_spot_targeting", "trivialize_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM101aMl
 *
 * Fires after M101 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M101AOutput with signed auditHash
 */
export async function runM101aMl(
  input:     M101ATelemetryInput,
  tier:      M101ATier = 'baseline',
  modelCard: Omit<M101AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M101AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM101aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM101aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M101AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM101aMlFallback(
  _input: M101ATelemetryInput,
): M101AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M101A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    mutatorRecommendation: null,
    balanceForecast: null,
    blindSpotTargeting: null,
    trivializeFlag: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM101aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
