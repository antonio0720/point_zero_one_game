// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m91a_first_table_safety_model_social_onboarding_abuse_preven.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M91A — First-Table Safety Model (Social Onboarding Abuse Preventer)
// Core Pair    : M91
// Family       : social
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
 * M91A — First-Table Safety Model (Social Onboarding Abuse Preventer)
 *
 * Primary function:
 *   Screen first-table social sessions for abuse risk; protect new players from toxicity before trust is established
 *
 * What this adds to M91:
 * 1. Screen first-table social sessions for abuse risk before new players are exposed.
 * 2. Detect inviter abuse: experienced players farming invite bonuses via exploitation.
 * 3. Generates safe-session certification for first-table runs.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M91
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M91ATelemetryInput {
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
  // Extended inputs for M91A (social family)

}

// Telemetry events subscribed by M91A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M91ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M91AOutput extends M91ABaseOutput {
  abuseRiskScore: unknown;  // abuse_risk_score
  inviterFarmFlag: unknown;  // inviter_farm_flag
  safeSessionCertification: unknown;  // safe_session_certification
  protectionRecommendation: unknown;  // protection_recommendation
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M91ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M91A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M91ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M91A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M91ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M91A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M91APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M91APlacement = 'server';

export interface M91AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M91AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M91AEvalContract {
  /** abuse_detection_AUC */
  /** farm_precision */
  /** new_player_safety_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M91AModelCard {
  modelId:            'M91A';
  coreMechanicPair:   'M91';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'social';
  tier:               M91ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M91A_ML_CONSTANTS = {
  ML_ID:              'M91A',
  CORE_PAIR:          'M91',
  MODEL_NAME:         'First-Table Safety Model (Social Onboarding Abuse Preventer)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'social' as const,
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
  EVAL_FOCUS:         ["abuse_detection_AUC", "farm_precision", "new_player_safety_rate"],
  PRIMARY_OUTPUTS:    ["abuse_risk_score", "inviter_farm_flag", "safe_session_certification", "protection_recommendation"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM91aMl
 *
 * Fires after M91 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M91AOutput with signed auditHash
 */
export async function runM91aMl(
  input:     M91ATelemetryInput,
  tier:      M91ATier = 'baseline',
  modelCard: Omit<M91AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M91AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM91aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM91aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M91AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM91aMlFallback(
  _input: M91ATelemetryInput,
): M91AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M91A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    abuseRiskScore: null,
    inviterFarmFlag: null,
    safeSessionCertification: null,
    protectionRecommendation: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM91aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
