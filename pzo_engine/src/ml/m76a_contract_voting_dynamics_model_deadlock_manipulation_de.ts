// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m76a_contract_voting_dynamics_model_deadlock_manipulation_de.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M76A — Contract Voting Dynamics Model (Deadlock + Manipulation Detection)
// Core Pair    : M76
// Family       : contract
// Category     : predictor
// IntelSignal  : antiCheat
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
 * M76A — Contract Voting Dynamics Model (Deadlock + Manipulation Detection)
 *
 * Primary function:
 *   Model voting dynamics to predict deadlock probability and detect strategic vote manipulation
 *
 * What this adds to M76:
 * 1. Predict voting deadlock probability and time-to-resolution.
 * 2. Detect strategic manipulation: coordinated voting to block legitimate proposals.
 * 3. Surfaces minority-view confidence for fairer decision outcomes.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M76
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M76ATelemetryInput {
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
  // Extended inputs for M76A (contract family)

}

// Telemetry events subscribed by M76A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M76ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M76AOutput extends M76ABaseOutput {
  deadlockProbability: unknown;  // deadlock_probability
  manipulationFlag: unknown;  // manipulation_flag
  minorityConfidence: unknown;  // minority_confidence
  resolutionEta: unknown;  // resolution_eta
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M76ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M76A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M76ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M76A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M76ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M76A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M76APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M76APlacement = 'server';

export interface M76AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M76AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M76AEvalContract {
  /** deadlock_calibration_ECE */
  /** manipulation_AUC */
  /** resolution_speed_lift */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M76AModelCard {
  modelId:            'M76A';
  coreMechanicPair:   'M76';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'predictor';
  family:             'contract';
  tier:               M76ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M76A_ML_CONSTANTS = {
  ML_ID:              'M76A',
  CORE_PAIR:          'M76',
  MODEL_NAME:         'Contract Voting Dynamics Model (Deadlock + Manipulation Detection)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'contract' as const,
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
  EVAL_FOCUS:         ["deadlock_calibration_ECE", "manipulation_AUC", "resolution_speed_lift"],
  PRIMARY_OUTPUTS:    ["deadlock_probability", "manipulation_flag", "minority_confidence", "resolution_eta"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM76aMl
 *
 * Fires after M76 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M76AOutput with signed auditHash
 */
export async function runM76aMl(
  input:     M76ATelemetryInput,
  tier:      M76ATier = 'baseline',
  modelCard: Omit<M76AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M76AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM76aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM76aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M76AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM76aMlFallback(
  _input: M76ATelemetryInput,
): M76AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M76A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    deadlockProbability: null,
    manipulationFlag: null,
    minorityConfidence: null,
    resolutionEta: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM76aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
