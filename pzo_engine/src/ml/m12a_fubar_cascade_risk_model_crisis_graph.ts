// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m12a_fubar_cascade_risk_model_crisis_graph.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M12A — FUBAR Cascade Risk Model (Crisis Graph)
// Core Pair    : M12
// Family       : market
// Category     : predictor
// IntelSignal  : risk
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
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
 * M12A — FUBAR Cascade Risk Model (Crisis Graph)
 *
 * Primary function:
 *   Model crisis as an interacting risk graph; predict cascade probability and chain path for legible failures
 *
 * What this adds to M12:
 * 1. Model crisis as a graph of interacting risks; predict cascade probability and likely chain path.
 * 2. Enables dramatic but legible failures: the player can see the dominoes.
 * 3. Supports balancing by identifying overpowered crisis combos.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M12
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M12ATelemetryInput {
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
  // Extended inputs for M12A (market family)

}

// Telemetry events subscribed by M12A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M12ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M12AOutput extends M12ABaseOutput {
  cascadeProbability: unknown;  // cascade_probability
  chainPathPrediction: unknown;  // chain_path_prediction
  overpoweredComboFlag: unknown;  // overpowered_combo_flag
  dominoVisualizationData: unknown;  // domino_visualization_data
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M12ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M12A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M12ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M12A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M12ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M12A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M12APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M12APlacement = 'client' | 'server';

export interface M12AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M12AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M12AEvalContract {
  /** cascade_AUC */
  /** chain_path_accuracy */
  /** combo_balance_flag_precision */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M12AModelCard {
  modelId:            'M12A';
  coreMechanicPair:   'M12';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M12ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M12A_ML_CONSTANTS = {
  ML_ID:              'M12A',
  CORE_PAIR:          'M12',
  MODEL_NAME:         'FUBAR Cascade Risk Model (Crisis Graph)',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["cascade_AUC", "chain_path_accuracy", "combo_balance_flag_precision"],
  PRIMARY_OUTPUTS:    ["cascade_probability", "chain_path_prediction", "overpowered_combo_flag", "domino_visualization_data"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM12aMl
 *
 * Fires after M12 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M12AOutput with signed auditHash
 */
export async function runM12aMl(
  input:     M12ATelemetryInput,
  tier:      M12ATier = 'baseline',
  modelCard: Omit<M12AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M12AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM12aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM12aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M12AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM12aMlFallback(
  _input: M12ATelemetryInput,
): M12AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M12A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    cascadeProbability: null,
    chainPathPrediction: null,
    overpoweredComboFlag: null,
    dominoVisualizationData: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM12aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
