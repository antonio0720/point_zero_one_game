// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m104a_deal_scarcity_anticipation_model.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M104A — Deal Scarcity Anticipation Model
// Core Pair    : M104
// Family       : market
// Category     : predictor
// IntelSignal  : alpha
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
 * M104A — Deal Scarcity Anticipation Model
 *
 * Primary function:
 *   Anticipate deal scarcity transitions before they occur; signal players to act before SCARCITY state locks them out
 *
 * What this adds to M104:
 * 1. Anticipate deal scarcity transitions before they lock the market.
 * 2. Signal players to act within their opportunity window — not after.
 * 3. Tracks deck composition to forecast exhaustion timing.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M104
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M104ATelemetryInput {
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
  // Extended inputs for M104A (market family)

}

// Telemetry events subscribed by M104A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M104ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M104AOutput extends M104ABaseOutput {
  scarcityTransitionEta: unknown;  // scarcity_transition_eta
  deckExhaustionForecast: unknown;  // deck_exhaustion_forecast
  actNowSignal: unknown;  // act_now_signal
  opportunityWindowEstimate: unknown;  // opportunity_window_estimate
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M104ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M104A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M104ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M104A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M104ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M104A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M104APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M104APlacement = 'client' | 'server';

export interface M104AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M104AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M104AEvalContract {
  /** scarcity_prediction_AUC */
  /** signal_timing_accuracy */
  /** false_urgency_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M104AModelCard {
  modelId:            'M104A';
  coreMechanicPair:   'M104';
  intelligenceSignal: 'alpha';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M104ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M104A_ML_CONSTANTS = {
  ML_ID:              'M104A',
  CORE_PAIR:          'M104',
  MODEL_NAME:         'Deal Scarcity Anticipation Model',
  INTEL_SIGNAL:       'alpha' as const,
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
  EVAL_FOCUS:         ["scarcity_prediction_AUC", "signal_timing_accuracy", "false_urgency_rate"],
  PRIMARY_OUTPUTS:    ["scarcity_transition_eta", "deck_exhaustion_forecast", "act_now_signal", "opportunity_window_estimate"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM104aMl
 *
 * Fires after M104 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M104AOutput with signed auditHash
 */
export async function runM104aMl(
  input:     M104ATelemetryInput,
  tier:      M104ATier = 'baseline',
  modelCard: Omit<M104AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M104AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM104aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM104aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M104AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM104aMlFallback(
  _input: M104ATelemetryInput,
): M104AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M104A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    scarcityTransitionEta: null,
    deckExhaustionForecast: null,
    actNowSignal: null,
    opportunityWindowEstimate: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM104aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
