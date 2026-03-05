// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m58a_stress_test_selector_risk_reward_balancer_anti_farm.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M58A — Stress Test Selector (Risk/Reward Balancer + Anti-Farm)
// Core Pair    : M58
// Family       : balance
// Category     : recommender
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M58A — Stress Test Selector (Risk/Reward Balancer + Anti-Farm)
 *
 * Primary function:
 *   Select stress test parameters that maximize CORD yield and proof prestige without enabling farm exploitation
 *
 * What this adds to M58:
 * 1. Select stress test parameters that maximize CORD yield and proof prestige.
 * 2. Anti-farm guard: detects repeated easy stress test selection for reliable bonus farming.
 * 3. Generates stress test difficulty tiers for season design.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M58
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M58ATelemetryInput {
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
  // Extended inputs for M58A (balance family)

}

// Telemetry events subscribed by M58A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M58ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M58AOutput extends M58ABaseOutput {
  stressTestParameters: unknown;  // stress_test_parameters
  farmFlag: unknown;  // farm_flag
  cordYieldEstimate: unknown;  // cord_yield_estimate
  difficultyTier: unknown;  // difficulty_tier
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M58ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M58A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M58ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M58A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M58ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M58A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M58AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M58A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M58APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M58APlacement = 'server';

export interface M58AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M58AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M58AEvalContract {
  /** cord_yield_calibration */
  /** farm_detection_AUC */
  /** proof_prestige_distribution */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M58AModelCard {
  modelId:            'M58A';
  coreMechanicPair:   'M58';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'recommender';
  family:             'balance';
  tier:               M58ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M58A_ML_CONSTANTS = {
  ML_ID:              'M58A',
  CORE_PAIR:          'M58',
  MODEL_NAME:         'Stress Test Selector (Risk/Reward Balancer + Anti-Farm)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'balance' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["cord_yield_calibration", "farm_detection_AUC", "proof_prestige_distribution"],
  PRIMARY_OUTPUTS:    ["stress_test_parameters", "farm_flag", "cord_yield_estimate", "difficulty_tier"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM58aMl
 *
 * Fires after M58 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M58AOutput with signed auditHash
 */
export async function runM58aMl(
  input:     M58ATelemetryInput,
  tier:      M58ATier = 'baseline',
  modelCard: Omit<M58AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M58AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM58aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM58aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M58AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM58aMlFallback(
  _input: M58ATelemetryInput,
): M58AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M58A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    stressTestParameters: null,
    farmFlag: null,
    cordYieldEstimate: null,
    difficultyTier: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM58aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
