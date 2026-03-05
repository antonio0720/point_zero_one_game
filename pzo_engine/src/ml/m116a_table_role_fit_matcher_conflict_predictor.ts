// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m116a_table_role_fit_matcher_conflict_predictor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M116A — Table Role Fit Matcher + Conflict Predictor
// Core Pair    : M116
// Family       : co_op
// Category     : recommender
// IntelSignal  : personalization
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
 * M116A — Table Role Fit Matcher + Conflict Predictor
 *
 * Primary function:
 *   Match players to table roles by revealed play style; predict role conflict before it degrades team performance
 *
 * What this adds to M116:
 * 1. Match players to table roles by revealed play style and behavioral history.
 * 2. Predict role conflict: duplicate energy types cause real coordination failures.
 * 3. Generates role fit receipts for team formation.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M116
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M116ATelemetryInput {
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
  // Extended inputs for M116A (co_op family)

}

// Telemetry events subscribed by M116A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M116ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M116AOutput extends M116ABaseOutput {
  roleFitScore: unknown;  // role_fit_score
  conflictPrediction: unknown;  // conflict_prediction
  roleReceipt: unknown;  // role_receipt
  synergyBonusEstimate: unknown;  // synergy_bonus_estimate
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M116ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M116A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M116ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M116A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M116ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M116A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M116APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M116APlacement = 'server';

export interface M116AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M116AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M116AEvalContract {
  /** role_fit_calibration */
  /** conflict_prediction_AUC */
  /** synergy_bonus_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M116AModelCard {
  modelId:            'M116A';
  coreMechanicPair:   'M116';
  intelligenceSignal: 'personalization';
  modelCategory:      'recommender';
  family:             'co_op';
  tier:               M116ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M116A_ML_CONSTANTS = {
  ML_ID:              'M116A',
  CORE_PAIR:          'M116',
  MODEL_NAME:         'Table Role Fit Matcher + Conflict Predictor',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'recommender' as const,
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
  EVAL_FOCUS:         ["role_fit_calibration", "conflict_prediction_AUC", "synergy_bonus_accuracy"],
  PRIMARY_OUTPUTS:    ["role_fit_score", "conflict_prediction", "role_receipt", "synergy_bonus_estimate"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM116aMl
 *
 * Fires after M116 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M116AOutput with signed auditHash
 */
export async function runM116aMl(
  input:     M116ATelemetryInput,
  tier:      M116ATier = 'baseline',
  modelCard: Omit<M116AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M116AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM116aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM116aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M116AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM116aMlFallback(
  _input: M116ATelemetryInput,
): M116AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M116A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    roleFitScore: null,
    conflictPrediction: null,
    roleReceipt: null,
    synergyBonusEstimate: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM116aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
