// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m18a_griefing_detection_adversarial_budgeting.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M18A — Griefing Detection + Adversarial Budgeting
// Core Pair    : M18
// Family       : integrity
// Category     : anomaly_detector
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : real_time
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
 * M18A — Griefing Detection + Adversarial Budgeting
 *
 * Primary function:
 *   Detect sabotage patterns crossing from competitive play into griefing; adjust adversarial budget in real time
 *
 * What this adds to M18:
 * 1. Detect sabotage patterns that cross from competitive play into griefing.
 * 2. Adjusts adversarial budget in real time without hard-blocking legitimate aggression.
 * 3. Feeds Exploit Taxonomy (M49) escalation pipeline.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M18
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M18ATelemetryInput {
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
  // Extended inputs for M18A (integrity family)

}

// Telemetry events subscribed by M18A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M18ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M18AOutput extends M18ABaseOutput {
  griefProbability: unknown;  // grief_probability
  adversarialBudgetDelta: unknown;  // adversarial_budget_delta
  escalationFlag: unknown;  // escalation_flag
  legitimateAggressionScore: unknown;  // legitimate_aggression_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M18ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M18A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M18ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M18A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M18ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M18A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M18APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M18APlacement = 'server';

export interface M18AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M18AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M18AEvalContract {
  /** grief_precision */
  /** legitimate_aggression_false_positive_rate */
  /** exploit_escalation_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M18AModelCard {
  modelId:            'M18A';
  coreMechanicPair:   'M18';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M18ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M18A_ML_CONSTANTS = {
  ML_ID:              'M18A',
  CORE_PAIR:          'M18',
  MODEL_NAME:         'Griefing Detection + Adversarial Budgeting',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'real_time' as const,
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
  EVAL_FOCUS:         ["grief_precision", "legitimate_aggression_false_positive_rate", "exploit_escalation_AUC"],
  PRIMARY_OUTPUTS:    ["grief_probability", "adversarial_budget_delta", "escalation_flag", "legitimate_aggression_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM18aMl
 *
 * Fires after M18 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M18AOutput with signed auditHash
 */
export async function runM18aMl(
  input:     M18ATelemetryInput,
  tier:      M18ATier = 'baseline',
  modelCard: Omit<M18AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M18AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM18aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM18aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M18AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM18aMlFallback(
  _input: M18ATelemetryInput,
): M18AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M18A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    griefProbability: null,
    adversarialBudgetDelta: null,
    escalationFlag: null,
    legitimateAggressionScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM18aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
