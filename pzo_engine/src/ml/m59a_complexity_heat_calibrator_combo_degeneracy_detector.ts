// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m59a_complexity_heat_calibrator_combo_degeneracy_detector.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M59A — Complexity Heat Calibrator (Combo Degeneracy Detector)
// Core Pair    : M59
// Family       : balance
// Category     : anomaly_detector
// IntelSignal  : volatility
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M59A — Complexity Heat Calibrator (Combo Degeneracy Detector)
 *
 * Primary function:
 *   Calibrate complexity heat thresholds; detect degenerate combo stacks that break game balance
 *
 * What this adds to M59:
 * 1. Calibrate complexity heat thresholds per skill band and season.
 * 2. Detect degenerate combo stacks that produce overpowered or unreadable game states.
 * 3. Feeds Synergy Discovery Engine (M31a) with complexity degeneracy signals.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M59
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M59ATelemetryInput {
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
  // Extended inputs for M59A (balance family)

}

// Telemetry events subscribed by M59A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M59ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M59AOutput extends M59ABaseOutput {
  complexityThresholdCalibration: unknown;  // complexity_threshold_calibration
  degeneracyFlag: unknown;  // degeneracy_flag
  synergySignal: unknown;  // synergy_signal
  balanceReport: unknown;  // balance_report
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M59ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M59A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M59ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M59A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M59ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M59A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M59AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M59A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M59APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M59APlacement = 'server';

export interface M59AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M59AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M59AEvalContract {
  /** degeneracy_recall */
  /** balance_impact_accuracy */
  /** calibration_ECE */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M59AModelCard {
  modelId:            'M59A';
  coreMechanicPair:   'M59';
  intelligenceSignal: 'volatility';
  modelCategory:      'anomaly_detector';
  family:             'balance';
  tier:               M59ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M59A_ML_CONSTANTS = {
  ML_ID:              'M59A',
  CORE_PAIR:          'M59',
  MODEL_NAME:         'Complexity Heat Calibrator (Combo Degeneracy Detector)',
  INTEL_SIGNAL:       'volatility' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'balance' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["degeneracy_recall", "balance_impact_accuracy", "calibration_ECE"],
  PRIMARY_OUTPUTS:    ["complexity_threshold_calibration", "degeneracy_flag", "synergy_signal", "balance_report"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM59aMl
 *
 * Fires after M59 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M59AOutput with signed auditHash
 */
export async function runM59aMl(
  input:     M59ATelemetryInput,
  tier:      M59ATier = 'baseline',
  modelCard: Omit<M59AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M59AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM59aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM59aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M59AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM59aMlFallback(
  _input: M59ATelemetryInput,
): M59AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M59A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    complexityThresholdCalibration: null,
    degeneracyFlag: null,
    synergySignal: null,
    balanceReport: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM59aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
