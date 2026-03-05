// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m03a_solvency_collapse_predictor_run_death_forecaster.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M03A — Solvency Collapse Predictor (Run Death Forecaster)
// Core Pair    : M03
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
 * M03A — Solvency Collapse Predictor (Run Death Forecaster)
 *
 * Primary function:
 *   Predict probability of wipe in the next N ticks; explain top contributing factors for post-mortems and clutch windows
 *
 * What this adds to M03:
 * 1. Predict probability of wipe in the next N ticks and explain the top contributing factors (fees, debt service, macro squeeze).
 * 2. Feeds post-mortems and 'near-death' clutch windows.
 * 3. Used for tutorial hints ONLY if user opts in; otherwise used silently for balancing and analytics.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M03
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M03ATelemetryInput {
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
  // Extended inputs for M03A (market family)

}

// Telemetry events subscribed by M03A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M03ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M03AOutput extends M03ABaseOutput {
  wipeProbabilityNextNTicks: unknown;  // wipe_probability_next_n_ticks
  topCollapseFactors: unknown;  // top_collapse_factors
  clutchWindowFlag: unknown;  // clutch_window_flag
  tutorialHint: unknown;  // tutorial_hint
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M03ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M03A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M03ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M03A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M03ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M03A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M03APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M03APlacement = 'client' | 'server';

export interface M03AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M03AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M03AEvalContract {
  /** wipe_prediction_AUC */
  /** precision_at_high_recall */
  /** opt_in_hint_acceptance_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M03AModelCard {
  modelId:            'M03A';
  coreMechanicPair:   'M03';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M03ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M03A_ML_CONSTANTS = {
  ML_ID:              'M03A',
  CORE_PAIR:          'M03',
  MODEL_NAME:         'Solvency Collapse Predictor (Run Death Forecaster)',
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
  EVAL_FOCUS:         ["wipe_prediction_AUC", "precision_at_high_recall", "opt_in_hint_acceptance_rate"],
  PRIMARY_OUTPUTS:    ["wipe_probability_next_n_ticks", "top_collapse_factors", "clutch_window_flag", "tutorial_hint"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM03aMl
 *
 * Fires after M03 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M03AOutput with signed auditHash
 */
export async function runM03aMl(
  input:     M03ATelemetryInput,
  tier:      M03ATier = 'baseline',
  modelCard: Omit<M03AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M03AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM03aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM03aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M03AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM03aMlFallback(
  _input: M03ATelemetryInput,
): M03AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M03A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    wipeProbabilityNextNTicks: null,
    topCollapseFactors: null,
    clutchWindowFlag: null,
    tutorialHint: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM03aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
