// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m37a_bounty_failure_forecaster_streak_collapse_predictor.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M37A — Bounty Failure Forecaster (Streak Collapse Predictor)
// Core Pair    : M37
// Family       : economy
// Category     : predictor
// IntelSignal  : churnRisk
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, CAUSAL
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
 * M37A — Bounty Failure Forecaster (Streak Collapse Predictor)
 *
 * Primary function:
 *   Forecast streak collapse probability before bounty commitment; prevent demoralizing bounty failures
 *
 * What this adds to M37:
 * 1. Forecast streak collapse probability before the player commits to a bounty.
 * 2. Surfaces risk of demoralizing bounty failure without preventing player from accepting.
 * 3. Feeds bounty economy balancer (M65a) with failure rate signals.
 *
 * Intelligence signal → IntelligenceState.churnRisk
 * Core mechanic pair  → M37
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M37ATelemetryInput {
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
  // Extended inputs for M37A (economy family)

}

// Telemetry events subscribed by M37A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M37ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M37AOutput extends M37ABaseOutput {
  collapseProbability: unknown;  // collapse_probability
  demoralizationRisk: unknown;  // demoralization_risk
  bountyRiskTier: unknown;  // bounty_risk_tier
  economyBalanceSignal: unknown;  // economy_balance_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M37ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'causal';

/** M37A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M37ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M37A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M37ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M37A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M37AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M37A — Tier: CAUSAL
 *  Causal inference + DiD (counterfactual explanations)
 */
export interface M37ACausalConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M37APlacement = 'server';

export interface M37AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M37AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M37AEvalContract {
  /** collapse_AUC */
  /** demoralization_risk_calibration */
  /** economy_inflation_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M37AModelCard {
  modelId:            'M37A';
  coreMechanicPair:   'M37';
  intelligenceSignal: 'churnRisk';
  modelCategory:      'predictor';
  family:             'economy';
  tier:               M37ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M37A_ML_CONSTANTS = {
  ML_ID:              'M37A',
  CORE_PAIR:          'M37',
  MODEL_NAME:         'Bounty Failure Forecaster (Streak Collapse Predictor)',
  INTEL_SIGNAL:       'churnRisk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'economy' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'causal'] as const,
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
  EVAL_FOCUS:         ["collapse_AUC", "demoralization_risk_calibration", "economy_inflation_rate"],
  PRIMARY_OUTPUTS:    ["collapse_probability", "demoralization_risk", "bounty_risk_tier", "economy_balance_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM37aMl
 *
 * Fires after M37 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M37AOutput with signed auditHash
 */
export async function runM37aMl(
  input:     M37ATelemetryInput,
  tier:      M37ATier = 'baseline',
  modelCard: Omit<M37AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M37AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM37aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM37aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M37AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM37aMlFallback(
  _input: M37ATelemetryInput,
): M37AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M37A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    collapseProbability: null,
    demoralizationRisk: null,
    bountyRiskTier: null,
    economyBalanceSignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.churnRisk
// Heuristic substitute (until ML is live):
//   intelligence.churnRisk = (1 - retentionRate) * ragequitCorrelation
// Replace with: runM37aMl(telemetry, tier, modelCard).then(out => intelligence.churnRisk = out.score)
