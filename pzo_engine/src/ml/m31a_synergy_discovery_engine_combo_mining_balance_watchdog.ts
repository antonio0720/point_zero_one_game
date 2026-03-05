// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m31a_synergy_discovery_engine_combo_mining_balance_watchdog.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M31A — Synergy Discovery Engine (Combo Mining + Balance Watchdog)
// Core Pair    : M31
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
 * M31A — Synergy Discovery Engine (Combo Mining + Balance Watchdog)
 *
 * Primary function:
 *   Mine discovered synergy combos across all player runs; flag overpowered sets before they dominate the meta
 *
 * What this adds to M31:
 * 1. Mine discovered synergy combos across all player runs to surface unintended power spikes.
 * 2. Flags overpowered sets before they dominate the meta.
 * 3. Generates 'emerging synergy' discoveries for season design reviews.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M31
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M31ATelemetryInput {
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
  // Extended inputs for M31A (balance family)

}

// Telemetry events subscribed by M31A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M31ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M31AOutput extends M31ABaseOutput {
  overpoweredComboFlags: unknown;  // overpowered_combo_flags
  synergyDiscoveryReport: unknown;  // synergy_discovery_report
  metaBalanceDelta: unknown;  // meta_balance_delta
  designReviewDigest: unknown;  // design_review_digest
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M31ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M31A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M31ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M31A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M31ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M31A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M31AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M31A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M31APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M31APlacement = 'server';

export interface M31AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M31AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M31AEvalContract {
  /** overpowered_combo_recall */
  /** false_flag_rate */
  /** meta_diversity_index */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M31AModelCard {
  modelId:            'M31A';
  coreMechanicPair:   'M31';
  intelligenceSignal: 'volatility';
  modelCategory:      'anomaly_detector';
  family:             'balance';
  tier:               M31ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M31A_ML_CONSTANTS = {
  ML_ID:              'M31A',
  CORE_PAIR:          'M31',
  MODEL_NAME:         'Synergy Discovery Engine (Combo Mining + Balance Watchdog)',
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
  EVAL_FOCUS:         ["overpowered_combo_recall", "false_flag_rate", "meta_diversity_index"],
  PRIMARY_OUTPUTS:    ["overpowered_combo_flags", "synergy_discovery_report", "meta_balance_delta", "design_review_digest"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM31aMl
 *
 * Fires after M31 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M31AOutput with signed auditHash
 */
export async function runM31aMl(
  input:     M31ATelemetryInput,
  tier:      M31ATier = 'baseline',
  modelCard: Omit<M31AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M31AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM31aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM31aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M31AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM31aMlFallback(
  _input: M31ATelemetryInput,
): M31AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M31A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    overpoweredComboFlags: null,
    synergyDiscoveryReport: null,
    metaBalanceDelta: null,
    designReviewDigest: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM31aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
