// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m39a_trophy_economy_balancer_inflation_control_anti_farm.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M39A — Trophy Economy Balancer (Inflation Control + Anti-Farm)
// Core Pair    : M39
// Family       : economy
// Category     : controller
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
 * M39A — Trophy Economy Balancer (Inflation Control + Anti-Farm)
 *
 * Primary function:
 *   Balance trophy currency inflation and sink adequacy; detect farm patterns before they degrade the economy
 *
 * What this adds to M39:
 * 1. Balance trophy currency inflation and sink adequacy across the season.
 * 2. Detect farm patterns (repeated low-effort runs for trophy grinding) before they degrade the economy.
 * 3. Generates inflation control recommendations for season design.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M39
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M39ATelemetryInput {
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
  // Extended inputs for M39A (economy family)

}

// Telemetry events subscribed by M39A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M39ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M39AOutput extends M39ABaseOutput {
  inflationIndex: unknown;  // inflation_index
  farmPatternFlags: unknown;  // farm_pattern_flags
  sinkAdequacyScore: unknown;  // sink_adequacy_score
  designRecommendations: unknown;  // design_recommendations
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M39ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M39A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M39ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M39A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M39ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M39A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M39AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M39A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M39APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M39APlacement = 'server';

export interface M39AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M39AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M39AEvalContract {
  /** inflation_stability */
  /** farm_detection_AUC */
  /** sink_adequacy_KPI */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M39AModelCard {
  modelId:            'M39A';
  coreMechanicPair:   'M39';
  intelligenceSignal: 'volatility';
  modelCategory:      'controller';
  family:             'economy';
  tier:               M39ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M39A_ML_CONSTANTS = {
  ML_ID:              'M39A',
  CORE_PAIR:          'M39',
  MODEL_NAME:         'Trophy Economy Balancer (Inflation Control + Anti-Farm)',
  INTEL_SIGNAL:       'volatility' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'economy' as const,
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
  EVAL_FOCUS:         ["inflation_stability", "farm_detection_AUC", "sink_adequacy_KPI"],
  PRIMARY_OUTPUTS:    ["inflation_index", "farm_pattern_flags", "sink_adequacy_score", "design_recommendations"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM39aMl
 *
 * Fires after M39 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M39AOutput with signed auditHash
 */
export async function runM39aMl(
  input:     M39ATelemetryInput,
  tier:      M39ATier = 'baseline',
  modelCard: Omit<M39AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M39AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM39aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM39aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M39AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM39aMlFallback(
  _input: M39ATelemetryInput,
): M39AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M39A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    inflationIndex: null,
    farmPatternFlags: null,
    sinkAdequacyScore: null,
    designRecommendations: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM39aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
