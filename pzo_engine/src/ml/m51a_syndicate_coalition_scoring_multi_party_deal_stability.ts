// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m51a_syndicate_coalition_scoring_multi_party_deal_stability.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M51A — Syndicate Coalition Scoring (Multi-Party Deal Stability)
// Core Pair    : M51
// Family       : co_op
// Category     : predictor
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
 * M51A — Syndicate Coalition Scoring (Multi-Party Deal Stability)
 *
 * Primary function:
 *   Score multi-party syndicate deal stability using coalition graph analysis; predict collapse before it fires
 *
 * What this adds to M51:
 * 1. Score multi-party syndicate deal stability using coalition graph analysis.
 * 2. Predict coalition collapse before it fires — allows proactive restructuring.
 * 3. Generates deal health receipts for arbitration.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M51
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M51ATelemetryInput {
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
  // Extended inputs for M51A (co_op family)

}

// Telemetry events subscribed by M51A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M51ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M51AOutput extends M51ABaseOutput {
  coalitionStabilityScore: unknown;  // coalition_stability_score
  collapseProbability: unknown;  // collapse_probability
  restructureRecommendation: unknown;  // restructure_recommendation
  dealHealthReceipt: unknown;  // deal_health_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M51ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M51A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M51ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M51A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M51ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M51A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M51AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M51A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M51APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M51APlacement = 'server';

export interface M51AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M51AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M51AEvalContract {
  /** stability_calibration_ECE */
  /** collapse_AUC */
  /** restructure_acceptance_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M51AModelCard {
  modelId:            'M51A';
  coreMechanicPair:   'M51';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'co_op';
  tier:               M51ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M51A_ML_CONSTANTS = {
  ML_ID:              'M51A',
  CORE_PAIR:          'M51',
  MODEL_NAME:         'Syndicate Coalition Scoring (Multi-Party Deal Stability)',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'co_op' as const,
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
  EVAL_FOCUS:         ["stability_calibration_ECE", "collapse_AUC", "restructure_acceptance_rate"],
  PRIMARY_OUTPUTS:    ["coalition_stability_score", "collapse_probability", "restructure_recommendation", "deal_health_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM51aMl
 *
 * Fires after M51 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M51AOutput with signed auditHash
 */
export async function runM51aMl(
  input:     M51ATelemetryInput,
  tier:      M51ATier = 'baseline',
  modelCard: Omit<M51AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M51AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM51aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM51aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M51AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM51aMlFallback(
  _input: M51ATelemetryInput,
): M51AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M51A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    coalitionStabilityScore: null,
    collapseProbability: null,
    restructureRecommendation: null,
    dealHealthReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM51aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
