// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m110a_ui_stall_predictor_auto_default_guard.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M110A — UI Stall Predictor + Auto-Default Guard
// Core Pair    : M110
// Family       : integrity
// Category     : predictor
// IntelSignal  : antiCheat
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
 * M110A — UI Stall Predictor + Auto-Default Guard
 *
 * Primary function:
 *   Predict UI stalls before they occur from session load signals; activate auto-default guard to prevent silent timer expiry
 *
 * What this adds to M110:
 * 1. Predict UI stalls from session load and device signals before they occur.
 * 2. Activate auto-default guard: if stall is predicted, pre-queue a safe default action.
 * 3. Stall forensics: logs stall events for anti-abuse pipeline.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M110
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M110ATelemetryInput {
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
  // Extended inputs for M110A (integrity family)

}

// Telemetry events subscribed by M110A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M110ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M110AOutput extends M110ABaseOutput {
  stallProbability: unknown;  // stall_probability
  autoDefaultAction: unknown;  // auto_default_action
  stallForensicLog: unknown;  // stall_forensic_log
  guardActivationFlag: unknown;  // guard_activation_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M110ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M110A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M110ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M110A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M110ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M110A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M110APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M110APlacement = 'client' | 'server';

export interface M110AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M110AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M110AEvalContract {
  /** stall_prediction_AUC */
  /** auto_default_appropriateness */
  /** stall_forensic_integrity */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M110AModelCard {
  modelId:            'M110A';
  coreMechanicPair:   'M110';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'predictor';
  family:             'integrity';
  tier:               M110ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M110A_ML_CONSTANTS = {
  ML_ID:              'M110A',
  CORE_PAIR:          'M110',
  MODEL_NAME:         'UI Stall Predictor + Auto-Default Guard',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'integrity' as const,
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
  EVAL_FOCUS:         ["stall_prediction_AUC", "auto_default_appropriateness", "stall_forensic_integrity"],
  PRIMARY_OUTPUTS:    ["stall_probability", "auto_default_action", "stall_forensic_log", "guard_activation_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM110aMl
 *
 * Fires after M110 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M110AOutput with signed auditHash
 */
export async function runM110aMl(
  input:     M110ATelemetryInput,
  tier:      M110ATier = 'baseline',
  modelCard: Omit<M110AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M110AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM110aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM110aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M110AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM110aMlFallback(
  _input: M110ATelemetryInput,
): M110AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M110A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    stallProbability: null,
    autoDefaultAction: null,
    stallForensicLog: null,
    guardActivationFlag: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM110aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
