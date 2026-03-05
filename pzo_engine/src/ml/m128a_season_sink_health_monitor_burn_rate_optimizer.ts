// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m128a_season_sink_health_monitor_burn_rate_optimizer.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M128A — Season Sink Health Monitor + Burn Rate Optimizer
// Core Pair    : M128
// Family       : economy
// Category     : controller
// IntelSignal  : volatility
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : batch
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
 * M128A — Season Sink Health Monitor + Burn Rate Optimizer
 *
 * Primary function:
 *   Monitor season sink health metrics; optimize burn rate recommendations to prevent economy devaluation
 *
 * What this adds to M128:
 * 1. Monitor season sink health metrics: inflow vs. outflow balance.
 * 2. Optimize burn rate recommendations to prevent currency devaluation.
 * 3. Generates sink health digest for season design team.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M128
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M128ATelemetryInput {
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
  // Extended inputs for M128A (economy family)

}

// Telemetry events subscribed by M128A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M128ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M128AOutput extends M128ABaseOutput {
  sinkHealthScore: unknown;  // sink_health_score
  burnRateRecommendation: unknown;  // burn_rate_recommendation
  devaluationRisk: unknown;  // devaluation_risk
  designDigest: unknown;  // design_digest
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M128ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M128A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M128ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M128A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M128ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M128A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M128APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M128APlacement = 'server';

export interface M128AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M128AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M128AEvalContract {
  /** sink_health_stability */
  /** devaluation_prediction_AUC */
  /** burn_rate_calibration */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M128AModelCard {
  modelId:            'M128A';
  coreMechanicPair:   'M128';
  intelligenceSignal: 'volatility';
  modelCategory:      'controller';
  family:             'economy';
  tier:               M128ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M128A_ML_CONSTANTS = {
  ML_ID:              'M128A',
  CORE_PAIR:          'M128',
  MODEL_NAME:         'Season Sink Health Monitor + Burn Rate Optimizer',
  INTEL_SIGNAL:       'volatility' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'economy' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'batch' as const,
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
  EVAL_FOCUS:         ["sink_health_stability", "devaluation_prediction_AUC", "burn_rate_calibration"],
  PRIMARY_OUTPUTS:    ["sink_health_score", "burn_rate_recommendation", "devaluation_risk", "design_digest"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM128aMl
 *
 * Fires after M128 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M128AOutput with signed auditHash
 */
export async function runM128aMl(
  input:     M128ATelemetryInput,
  tier:      M128ATier = 'baseline',
  modelCard: Omit<M128AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M128AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM128aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM128aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M128AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM128aMlFallback(
  _input: M128ATelemetryInput,
): M128AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M128A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    sinkHealthScore: null,
    burnRateRecommendation: null,
    devaluationRisk: null,
    designDigest: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM128aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
