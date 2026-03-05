// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m04a_deck_reactor_rl_policy_dynamic_draw_mixing.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M04A — Deck Reactor RL Policy (Dynamic Draw Mixing)
// Core Pair    : M04
// Family       : balance
// Category     : rl_policy
// IntelSignal  : recommendationPower
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
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
 * M04A — Deck Reactor RL Policy (Dynamic Draw Mixing)
 *
 * Primary function:
 *   Learn optimal draw-pool composition per player archetype and macro regime; keep draws surprising yet fair
 *
 * What this adds to M04:
 * 1. Learn optimal draw-pool composition per player archetype and macro regime.
 * 2. Balances surprise vs. fairness: ensures every run has ≥ 3 share moments without rigging outcomes.
 * 3. Adaptive curriculum: shifts pool toward player-skill edges without breaking determinism.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M04
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M04ATelemetryInput {
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
  // Extended inputs for M04A (balance family)

}

// Telemetry events subscribed by M04A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M04ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M04AOutput extends M04ABaseOutput {
  drawPoolWeights: unknown;  // draw_pool_weights
  archetypeEmbedding: unknown;  // archetype_embedding
  surpriseScore: unknown;  // surprise_score
  momentBudgetRemaining: unknown;  // moment_budget_remaining
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M04ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M04A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M04ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M04A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M04ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M04A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M04APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M04APlacement = 'server';

export interface M04AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M04AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M04AEvalContract {
  /** moment_yield_per_run */
  /** draw_entropy */
  /** skill_band_fairness */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M04AModelCard {
  modelId:            'M04A';
  coreMechanicPair:   'M04';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'rl_policy';
  family:             'balance';
  tier:               M04ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M04A_ML_CONSTANTS = {
  ML_ID:              'M04A',
  CORE_PAIR:          'M04',
  MODEL_NAME:         'Deck Reactor RL Policy (Dynamic Draw Mixing)',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'rl_policy' as const,
  FAMILY:             'balance' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["moment_yield_per_run", "draw_entropy", "skill_band_fairness"],
  PRIMARY_OUTPUTS:    ["draw_pool_weights", "archetype_embedding", "surprise_score", "moment_budget_remaining"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM04aMl
 *
 * Fires after M04 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M04AOutput with signed auditHash
 */
export async function runM04aMl(
  input:     M04ATelemetryInput,
  tier:      M04ATier = 'baseline',
  modelCard: Omit<M04AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M04AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM04aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM04aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M04AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM04aMlFallback(
  _input: M04ATelemetryInput,
): M04AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M04A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    drawPoolWeights: null,
    archetypeEmbedding: null,
    surpriseScore: null,
    momentBudgetRemaining: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM04aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
