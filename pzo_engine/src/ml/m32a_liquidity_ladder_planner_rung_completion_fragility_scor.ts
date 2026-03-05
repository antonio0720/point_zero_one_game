// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m32a_liquidity_ladder_planner_rung_completion_fragility_scor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M32A — Liquidity Ladder Planner (Rung Completion + Fragility Scorer)
// Core Pair    : M32
// Family       : market
// Category     : predictor
// IntelSignal  : risk
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M32A — Liquidity Ladder Planner (Rung Completion + Fragility Scorer)
 *
 * Primary function:
 *   Predict optimal rung completion sequence; score portfolio liquidity fragility under macro stress scenarios
 *
 * What this adds to M32:
 * 1. Predict optimal rung completion sequence given current portfolio and macro outlook.
 * 2. Score portfolio liquidity fragility under stress scenarios.
 * 3. Flags ladder structures vulnerable to cascade liquidation.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M32
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M32ATelemetryInput {
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
  // Extended inputs for M32A (market family)

}

// Telemetry events subscribed by M32A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M32ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M32AOutput extends M32ABaseOutput {
  rungCompletionPlan: unknown;  // rung_completion_plan
  liquidityFragilityScore: unknown;  // liquidity_fragility_score
  cascadeLiquidationRisk: unknown;  // cascade_liquidation_risk
  stressScenarioResults: unknown;  // stress_scenario_results
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M32ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M32A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M32ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M32A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M32ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M32A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M32AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M32A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M32APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M32APlacement = 'client' | 'server';

export interface M32AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M32AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M32AEvalContract {
  /** fragility_score_calibration */
  /** cascade_prediction_AUC */
  /** rung_completion_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M32AModelCard {
  modelId:            'M32A';
  coreMechanicPair:   'M32';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M32ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M32A_ML_CONSTANTS = {
  ML_ID:              'M32A',
  CORE_PAIR:          'M32',
  MODEL_NAME:         'Liquidity Ladder Planner (Rung Completion + Fragility Scorer)',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["fragility_score_calibration", "cascade_prediction_AUC", "rung_completion_rate"],
  PRIMARY_OUTPUTS:    ["rung_completion_plan", "liquidity_fragility_score", "cascade_liquidation_risk", "stress_scenario_results"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM32aMl
 *
 * Fires after M32 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M32AOutput with signed auditHash
 */
export async function runM32aMl(
  input:     M32ATelemetryInput,
  tier:      M32ATier = 'baseline',
  modelCard: Omit<M32AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M32AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM32aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM32aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M32AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM32aMlFallback(
  _input: M32ATelemetryInput,
): M32AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M32A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    rungCompletionPlan: null,
    liquidityFragilityScore: null,
    cascadeLiquidationRisk: null,
    stressScenarioResults: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM32aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
