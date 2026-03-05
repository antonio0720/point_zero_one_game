// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m120a_consent_gate_chaos_mode_recommender.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M120A — Consent Gate Chaos Mode Recommender
// Core Pair    : M120
// Family       : social
// Category     : recommender
// IntelSignal  : rewardFit
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
 * M120A — Consent Gate Chaos Mode Recommender
 *
 * Primary function:
 *   Recommend which chaos social tokens are appropriate to offer given both players' consent profiles and play history
 *
 * What this adds to M120:
 * 1. Recommend which chaos tokens are appropriate to offer given consent profiles.
 * 2. Never suggests tokens the target player has rejected previously.
 * 3. Generates consent-aware chaos recommendations.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M120
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M120ATelemetryInput {
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
  // Extended inputs for M120A (social family)

}

// Telemetry events subscribed by M120A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M120ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M120AOutput extends M120ABaseOutput {
  appropriateTokenSet: unknown;  // appropriate_token_set
  rejectionFilterApplied: unknown;  // rejection_filter_applied
  consentRecommendation: unknown;  // consent_recommendation
  chaosImpactEstimate: unknown;  // chaos_impact_estimate
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M120ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M120A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M120ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M120A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M120ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M120A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M120APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M120APlacement = 'server';

export interface M120AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M120AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M120AEvalContract {
  /** consent_compliance_rate */
  /** token_acceptance_rate */
  /** chaos_impact_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M120AModelCard {
  modelId:            'M120A';
  coreMechanicPair:   'M120';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'recommender';
  family:             'social';
  tier:               M120ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M120A_ML_CONSTANTS = {
  ML_ID:              'M120A',
  CORE_PAIR:          'M120',
  MODEL_NAME:         'Consent Gate Chaos Mode Recommender',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'social' as const,
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
  EVAL_FOCUS:         ["consent_compliance_rate", "token_acceptance_rate", "chaos_impact_accuracy"],
  PRIMARY_OUTPUTS:    ["appropriate_token_set", "rejection_filter_applied", "consent_recommendation", "chaos_impact_estimate"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM120aMl
 *
 * Fires after M120 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M120AOutput with signed auditHash
 */
export async function runM120aMl(
  input:     M120ATelemetryInput,
  tier:      M120ATier = 'baseline',
  modelCard: Omit<M120AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M120AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM120aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM120aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M120AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM120aMlFallback(
  _input: M120ATelemetryInput,
): M120AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M120A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    appropriateTokenSet: null,
    rejectionFilterApplied: null,
    consentRecommendation: null,
    chaosImpactEstimate: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM120aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
