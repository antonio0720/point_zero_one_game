// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m115a_heat_swap_exposure_rebalancer_suggestion.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M115A — Heat-Swap Exposure Rebalancer Suggestion
// Core Pair    : M115
// Family       : market
// Category     : recommender
// IntelSignal  : risk
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
 * M115A — Heat-Swap Exposure Rebalancer Suggestion
 *
 * Primary function:
 *   Suggest heat-swap targets that rebalance exposure without reducing net risk; flag swaps that create hidden concentration
 *
 * What this adds to M115:
 * 1. Suggest heat-swap targets that rebalance exposure distribution.
 * 2. Flag swaps that create hidden concentration risk while appearing balanced.
 * 3. Generates exposure map before and after swap for player visualization.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M115
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M115ATelemetryInput {
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
  // Extended inputs for M115A (market family)

}

// Telemetry events subscribed by M115A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M115ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M115AOutput extends M115ABaseOutput {
  swapTargetSuggestion: unknown;  // swap_target_suggestion
  hiddenConcentrationFlag: unknown;  // hidden_concentration_flag
  exposureMapBefore: unknown;  // exposure_map_before
  exposureMapAfter: unknown;  // exposure_map_after
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M115ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M115A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M115ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M115A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M115ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M115A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M115APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M115APlacement = 'client' | 'server';

export interface M115AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M115AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M115AEvalContract {
  /** rebalance_quality */
  /** concentration_detection_AUC */
  /** suggestion_acceptance_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M115AModelCard {
  modelId:            'M115A';
  coreMechanicPair:   'M115';
  intelligenceSignal: 'risk';
  modelCategory:      'recommender';
  family:             'market';
  tier:               M115ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M115A_ML_CONSTANTS = {
  ML_ID:              'M115A',
  CORE_PAIR:          'M115',
  MODEL_NAME:         'Heat-Swap Exposure Rebalancer Suggestion',
  INTEL_SIGNAL:       'risk' as const,
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
  EVAL_FOCUS:         ["rebalance_quality", "concentration_detection_AUC", "suggestion_acceptance_rate"],
  PRIMARY_OUTPUTS:    ["swap_target_suggestion", "hidden_concentration_flag", "exposure_map_before", "exposure_map_after"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM115aMl
 *
 * Fires after M115 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M115AOutput with signed auditHash
 */
export async function runM115aMl(
  input:     M115ATelemetryInput,
  tier:      M115ATier = 'baseline',
  modelCard: Omit<M115AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M115AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM115aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM115aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M115AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM115aMlFallback(
  _input: M115ATelemetryInput,
): M115AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M115A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    swapTargetSuggestion: null,
    hiddenConcentrationFlag: null,
    exposureMapBefore: null,
    exposureMapAfter: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM115aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
