// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m60a_liability_netting_advisor_cascade_minimization_under_ca.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M60A — Liability Netting Advisor (Cascade Minimization Under Caps)
// Core Pair    : M60
// Family       : market
// Category     : recommender
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
 * M60A — Liability Netting Advisor (Cascade Minimization Under Caps)
 *
 * Primary function:
 *   Advise optimal liability netting sequence to minimize cascade risk while staying within exposure caps
 *
 * What this adds to M60:
 * 1. Advise optimal liability netting sequence to minimize cascade risk.
 * 2. Stays within exposure caps: netting recommendations never violate portfolio heat bounds.
 * 3. Generates cascade minimization receipts for Case File.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M60
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M60ATelemetryInput {
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
  // Extended inputs for M60A (market family)

}

// Telemetry events subscribed by M60A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M60ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M60AOutput extends M60ABaseOutput {
  nettingSequenceRecommendation: unknown;  // netting_sequence_recommendation
  cascadeMinimizationScore: unknown;  // cascade_minimization_score
  capComplianceVerified: unknown;  // cap_compliance_verified
  receipt: unknown;  // receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M60ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M60A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M60ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M60A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M60ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M60A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M60AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M60A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M60APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M60APlacement = 'client' | 'server';

export interface M60AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M60AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M60AEvalContract {
  /** cascade_reduction_rate */
  /** cap_compliance_rate */
  /** netting_optimality */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M60AModelCard {
  modelId:            'M60A';
  coreMechanicPair:   'M60';
  intelligenceSignal: 'risk';
  modelCategory:      'recommender';
  family:             'market';
  tier:               M60ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M60A_ML_CONSTANTS = {
  ML_ID:              'M60A',
  CORE_PAIR:          'M60',
  MODEL_NAME:         'Liability Netting Advisor (Cascade Minimization Under Caps)',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'recommender' as const,
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
  EVAL_FOCUS:         ["cascade_reduction_rate", "cap_compliance_rate", "netting_optimality"],
  PRIMARY_OUTPUTS:    ["netting_sequence_recommendation", "cascade_minimization_score", "cap_compliance_verified", "receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM60aMl
 *
 * Fires after M60 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M60AOutput with signed auditHash
 */
export async function runM60aMl(
  input:     M60ATelemetryInput,
  tier:      M60ATier = 'baseline',
  modelCard: Omit<M60AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M60AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM60aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM60aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M60AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM60aMlFallback(
  _input: M60ATelemetryInput,
): M60AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M60A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    nettingSequenceRecommendation: null,
    cascadeMinimizationScore: null,
    capComplianceVerified: null,
    receipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM60aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
