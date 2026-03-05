// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m35a_portfolio_heat_controller_overconcentration_friction_tu.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M35A — Portfolio Heat Controller (Overconcentration + Friction Tuner)
// Core Pair    : M35
// Family       : market
// Category     : controller
// IntelSignal  : risk
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
 * M35A — Portfolio Heat Controller (Overconcentration + Friction Tuner)
 *
 * Primary function:
 *   Control portfolio heat exposure to stay within design bounds; detect overconcentration before it creates unfair failure
 *
 * What this adds to M35:
 * 1. Control portfolio heat exposure to stay within design bounds per skill band.
 * 2. Detects overconcentration before it creates unfair cascade failure.
 * 3. Feeds Exposure Cap warnings (M35) and Complexity Heat Monitor (M59).
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M35
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M35ATelemetryInput {
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
  // Extended inputs for M35A (market family)

}

// Telemetry events subscribed by M35A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M35ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M35AOutput extends M35ABaseOutput {
  heatControlDelta: unknown;  // heat_control_delta
  overconcentrationFlag: unknown;  // overconcentration_flag
  cascadeRiskScore: unknown;  // cascade_risk_score
  skillBandAdjustment: unknown;  // skill_band_adjustment
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M35ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M35A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M35ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M35A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M35ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M35A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M35AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M35A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M35APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M35APlacement = 'server';

export interface M35AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M35AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M35AEvalContract {
  /** heat_calibration_ECE */
  /** overconcentration_recall */
  /** cascade_prevention_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M35AModelCard {
  modelId:            'M35A';
  coreMechanicPair:   'M35';
  intelligenceSignal: 'risk';
  modelCategory:      'controller';
  family:             'market';
  tier:               M35ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M35A_ML_CONSTANTS = {
  ML_ID:              'M35A',
  CORE_PAIR:          'M35',
  MODEL_NAME:         'Portfolio Heat Controller (Overconcentration + Friction Tuner)',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'market' as const,
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
  EVAL_FOCUS:         ["heat_calibration_ECE", "overconcentration_recall", "cascade_prevention_rate"],
  PRIMARY_OUTPUTS:    ["heat_control_delta", "overconcentration_flag", "cascade_risk_score", "skill_band_adjustment"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM35aMl
 *
 * Fires after M35 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M35AOutput with signed auditHash
 */
export async function runM35aMl(
  input:     M35ATelemetryInput,
  tier:      M35ATier = 'baseline',
  modelCard: Omit<M35AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M35AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM35aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM35aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M35AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM35aMlFallback(
  _input: M35ATelemetryInput,
): M35AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M35A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    heatControlDelta: null,
    overconcentrationFlag: null,
    cascadeRiskScore: null,
    skillBandAdjustment: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM35aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
