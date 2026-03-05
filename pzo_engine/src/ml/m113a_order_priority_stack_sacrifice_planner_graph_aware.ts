// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m113a_order_priority_stack_sacrifice_planner_graph_aware.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M113A — Order Priority Stack Sacrifice Planner (Graph-Aware)
// Core Pair    : M113
// Family       : market
// Category     : rl_policy
// IntelSignal  : momentum
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL
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
 * M113A — Order Priority Stack Sacrifice Planner (Graph-Aware)
 *
 * Primary function:
 *   Plan sacrifice order to minimize cascade loss using portfolio dependency graph; surface highest-leverage protection choices
 *
 * What this adds to M113:
 * 1. Plan sacrifice order to minimize cascade loss using portfolio dependency graph analysis.
 * 2. Surface highest-leverage protection choices under incoming damage.
 * 3. Generates sacrifice plan receipts for Case File.
 *
 * Intelligence signal → IntelligenceState.momentum
 * Core mechanic pair  → M113
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M113ATelemetryInput {
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
  // Extended inputs for M113A (market family)

}

// Telemetry events subscribed by M113A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M113ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M113AOutput extends M113ABaseOutput {
  sacrificeOrderPlan: unknown;  // sacrifice_order_plan
  cascadeMinimizationScore: unknown;  // cascade_minimization_score
  protectionPriority: unknown;  // protection_priority
  caseFileReceipt: unknown;  // case_file_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M113ATier = 'baseline' | 'sequence_dl' | 'graph_dl';

/** M113A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M113ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M113A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M113ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M113A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M113AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M113APlacement = 'client' | 'server';

export interface M113AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M113AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M113AEvalContract {
  /** sacrifice_plan_optimality */
  /** cascade_minimization_AUC */
  /** protection_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M113AModelCard {
  modelId:            'M113A';
  coreMechanicPair:   'M113';
  intelligenceSignal: 'momentum';
  modelCategory:      'rl_policy';
  family:             'market';
  tier:               M113ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M113A_ML_CONSTANTS = {
  ML_ID:              'M113A',
  CORE_PAIR:          'M113',
  MODEL_NAME:         'Order Priority Stack Sacrifice Planner (Graph-Aware)',
  INTEL_SIGNAL:       'momentum' as const,
  MODEL_CATEGORY:     'rl_policy' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl'] as const,
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
  EVAL_FOCUS:         ["sacrifice_plan_optimality", "cascade_minimization_AUC", "protection_accuracy"],
  PRIMARY_OUTPUTS:    ["sacrifice_order_plan", "cascade_minimization_score", "protection_priority", "case_file_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM113aMl
 *
 * Fires after M113 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M113AOutput with signed auditHash
 */
export async function runM113aMl(
  input:     M113ATelemetryInput,
  tier:      M113ATier = 'baseline',
  modelCard: Omit<M113AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M113AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM113aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM113aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M113AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM113aMlFallback(
  _input: M113ATelemetryInput,
): M113AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M113A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    sacrificeOrderPlan: null,
    cascadeMinimizationScore: null,
    protectionPriority: null,
    caseFileReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.momentum
// Heuristic substitute (until ML is live):
//   intelligence.momentum = recentDecisionSpeed * clutchWindowCapture
// Replace with: runM113aMl(telemetry, tier, modelCard).then(out => intelligence.momentum = out.score)
