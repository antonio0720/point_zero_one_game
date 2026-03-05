// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m111a_portfolio_macro_synth_safety_verifier.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M111A — Portfolio Macro Synth + Safety Verifier
// Core Pair    : M111
// Family       : market
// Category     : controller
// IntelSignal  : risk
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
 * M111A — Portfolio Macro Synth + Safety Verifier
 *
 * Primary function:
 *   Synthesize portfolio macro rule interactions; verify combined macro safety before activation to prevent runaway autopilot
 *
 * What this adds to M111:
 * 1. Synthesize portfolio macro rule interactions for combined safety verification.
 * 2. Prevent runaway autopilot: combined macros never exceed hard action caps.
 * 3. Generates macro interaction receipts for audit.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M111
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M111ATelemetryInput {
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
  // Extended inputs for M111A (market family)

}

// Telemetry events subscribed by M111A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M111ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M111AOutput extends M111ABaseOutput {
  interactionSynthesis: unknown;  // interaction_synthesis
  safetyVerification: unknown;  // safety_verification
  capComplianceFlag: unknown;  // cap_compliance_flag
  macroReceipt: unknown;  // macro_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M111ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M111A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M111ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M111A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M111ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M111A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M111APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M111APlacement = 'server';

export interface M111AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M111AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M111AEvalContract {
  /** interaction_detection_accuracy */
  /** safety_verification_recall */
  /** cap_compliance_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M111AModelCard {
  modelId:            'M111A';
  coreMechanicPair:   'M111';
  intelligenceSignal: 'risk';
  modelCategory:      'controller';
  family:             'market';
  tier:               M111ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M111A_ML_CONSTANTS = {
  ML_ID:              'M111A',
  CORE_PAIR:          'M111',
  MODEL_NAME:         'Portfolio Macro Synth + Safety Verifier',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'market' as const,
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
  EVAL_FOCUS:         ["interaction_detection_accuracy", "safety_verification_recall", "cap_compliance_rate"],
  PRIMARY_OUTPUTS:    ["interaction_synthesis", "safety_verification", "cap_compliance_flag", "macro_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM111aMl
 *
 * Fires after M111 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M111AOutput with signed auditHash
 */
export async function runM111aMl(
  input:     M111ATelemetryInput,
  tier:      M111ATier = 'baseline',
  modelCard: Omit<M111AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M111AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM111aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM111aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M111AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM111aMlFallback(
  _input: M111ATelemetryInput,
): M111AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M111A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    interactionSynthesis: null,
    safetyVerification: null,
    capComplianceFlag: null,
    macroReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM111aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
