// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m28a_handshake_negotiation_coach_timer_window_optimizer.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M28A — Handshake Negotiation Coach (Timer-Window Optimizer)
// Core Pair    : M28
// Family       : contract
// Category     : recommender
// IntelSignal  : recommendationPower
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
 * M28A — Handshake Negotiation Coach (Timer-Window Optimizer)
 *
 * Primary function:
 *   Coach negotiation timing and term selection within handshake windows; maximize mutual agreement probability
 *
 * What this adds to M28:
 * 1. Coach negotiation timing and term selection within handshake windows.
 * 2. Maximizes mutual agreement probability without revealing counterpart strategy.
 * 3. Detects and flags one-sided negotiations approaching exploitation threshold.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M28
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M28ATelemetryInput {
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
  // Extended inputs for M28A (contract family)

}

// Telemetry events subscribed by M28A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M28ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M28AOutput extends M28ABaseOutput {
  negotiationCoachSuggestion: unknown;  // negotiation_coach_suggestion
  agreementProbability: unknown;  // agreement_probability
  exploitationFlag: unknown;  // exploitation_flag
  optimalCounterTerms: unknown;  // optimal_counter_terms
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M28ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M28A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M28ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M28A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M28ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M28A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M28AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M28A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M28APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M28APlacement = 'client' | 'server';

export interface M28AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M28AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M28AEvalContract {
  /** agreement_rate_lift */
  /** exploitation_detection_AUC */
  /** timer_utilization_efficiency */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M28AModelCard {
  modelId:            'M28A';
  coreMechanicPair:   'M28';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'recommender';
  family:             'contract';
  tier:               M28ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M28A_ML_CONSTANTS = {
  ML_ID:              'M28A',
  CORE_PAIR:          'M28',
  MODEL_NAME:         'Handshake Negotiation Coach (Timer-Window Optimizer)',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'contract' as const,
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
  EVAL_FOCUS:         ["agreement_rate_lift", "exploitation_detection_AUC", "timer_utilization_efficiency"],
  PRIMARY_OUTPUTS:    ["negotiation_coach_suggestion", "agreement_probability", "exploitation_flag", "optimal_counter_terms"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM28aMl
 *
 * Fires after M28 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M28AOutput with signed auditHash
 */
export async function runM28aMl(
  input:     M28ATelemetryInput,
  tier:      M28ATier = 'baseline',
  modelCard: Omit<M28AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M28AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM28aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM28aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M28AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM28aMlFallback(
  _input: M28ATelemetryInput,
): M28AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M28A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    negotiationCoachSuggestion: null,
    agreementProbability: null,
    exploitationFlag: null,
    optimalCounterTerms: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM28aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
