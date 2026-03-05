// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m65a_variety_index_abuse_detector_anti_grind_curve_hardener.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M65A — Variety Index Abuse Detector (Anti-Grind Curve Hardener)
// Core Pair    : M65
// Family       : integrity
// Category     : anomaly_detector
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
// Placement    : server
// Budget       : batch
// Lock-Off     : NO — always active (integrity / anti-cheat)
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
 * M65A — Variety Index Abuse Detector (Anti-Grind Curve Hardener)
 *
 * Primary function:
 *   Detect variety index manipulation used to circumvent anti-grind trophy curves; harden decay curve against farming
 *
 * What this adds to M65:
 * 1. Detect variety index manipulation: players gaming the anti-grind system by artificially varying run patterns.
 * 2. Harden decay curve against sophisticated farming without penalizing genuine variety.
 * 3. Feeds Trophy Economy Balancer (M39a).
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M65
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M65ATelemetryInput {
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
  // Extended inputs for M65A (integrity family)

}

// Telemetry events subscribed by M65A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M65ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M65AOutput extends M65ABaseOutput {
  manipulationFlag: unknown;  // manipulation_flag
  varietyAuthenticityScore: unknown;  // variety_authenticity_score
  curveHardenerDelta: unknown;  // curve_hardener_delta
  economySignal: unknown;  // economy_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M65ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M65A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M65ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M65A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M65ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M65A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M65AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M65A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M65APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M65APlacement = 'server';

export interface M65AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M65AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M65AEvalContract {
  /** manipulation_AUC */
  /** variety_authenticity_calibration */
  /** economy_stability */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M65AModelCard {
  modelId:            'M65A';
  coreMechanicPair:   'M65';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M65ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M65A_ML_CONSTANTS = {
  ML_ID:              'M65A',
  CORE_PAIR:          'M65',
  MODEL_NAME:         'Variety Index Abuse Detector (Anti-Grind Curve Hardener)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'batch' as const,
  CAN_LOCK_OFF:        false,
  GUARDRAILS: {
    determinismPreserved:      true,
    boundedNudges:             true,
    auditabilityRequired:      true,
    privacyEnforced:           true,
    competitiveLockOffAllowed: false,
    scoreCap:                  1.0,
    abstainThreshold:          0.35,
  },
  EVAL_FOCUS:         ["manipulation_AUC", "variety_authenticity_calibration", "economy_stability"],
  PRIMARY_OUTPUTS:    ["manipulation_flag", "variety_authenticity_score", "curve_hardener_delta", "economy_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM65aMl
 *
 * Fires after M65 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M65AOutput with signed auditHash
 */
export async function runM65aMl(
  input:     M65ATelemetryInput,
  tier:      M65ATier = 'baseline',
  modelCard: Omit<M65AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M65AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM65aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM65aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M65AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM65aMlFallback(
  _input: M65ATelemetryInput,
): M65AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M65A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    manipulationFlag: null,
    varietyAuthenticityScore: null,
    curveHardenerDelta: null,
    economySignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM65aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
