// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m26a_co_op_contract_fairness_partner_risk_scorer.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M26A — Co-op Contract Fairness + Partner-Risk Scorer
// Core Pair    : M26
// Family       : contract
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
 * M26A — Co-op Contract Fairness + Partner-Risk Scorer
 *
 * Primary function:
 *   Score contract fairness and partner default risk using contract graph structure; flag exploitative terms
 *
 * What this adds to M26:
 * 1. Score contract fairness and partner default risk using the contract graph structure.
 * 2. Flags exploitative terms (asymmetric liability, hidden clauses) before signing.
 * 3. Learns partner reliability from historical ledger data.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M26
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M26ATelemetryInput {
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
  // Extended inputs for M26A (contract family)

}

// Telemetry events subscribed by M26A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M26ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M26AOutput extends M26ABaseOutput {
  fairnessScore: unknown;  // fairness_score
  partnerDefaultRisk: unknown;  // partner_default_risk
  exploitativeTermFlags: unknown;  // exploitative_term_flags
  reliabilityEmbedding: unknown;  // reliability_embedding
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M26ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M26A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M26ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M26A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M26ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M26A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M26AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M26A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M26APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M26APlacement = 'server';

export interface M26AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M26AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M26AEvalContract {
  /** fairness_calibration */
  /** default_risk_AUC */
  /** exploitative_term_recall */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M26AModelCard {
  modelId:            'M26A';
  coreMechanicPair:   'M26';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'contract';
  tier:               M26ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M26A_ML_CONSTANTS = {
  ML_ID:              'M26A',
  CORE_PAIR:          'M26',
  MODEL_NAME:         'Co-op Contract Fairness + Partner-Risk Scorer',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'contract' as const,
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
  EVAL_FOCUS:         ["fairness_calibration", "default_risk_AUC", "exploitative_term_recall"],
  PRIMARY_OUTPUTS:    ["fairness_score", "partner_default_risk", "exploitative_term_flags", "reliability_embedding"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM26aMl
 *
 * Fires after M26 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M26AOutput with signed auditHash
 */
export async function runM26aMl(
  input:     M26ATelemetryInput,
  tier:      M26ATier = 'baseline',
  modelCard: Omit<M26AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M26AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM26aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM26aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M26AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM26aMlFallback(
  _input: M26ATelemetryInput,
): M26AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M26A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    fairnessScore: null,
    partnerDefaultRisk: null,
    exploitativeTermFlags: null,
    reliabilityEmbedding: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM26aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
