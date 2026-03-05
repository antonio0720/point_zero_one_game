// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m134a_npc_counterparty_behavioral_emulator_deterministic_pers.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M134A — NPC Counterparty Behavioral Emulator (Deterministic Persona Fidelity)
// Core Pair    : M134
// Family       : market
// Category     : controller
// IntelSignal  : personalization
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
 * M134A — NPC Counterparty Behavioral Emulator (Deterministic Persona Fidelity)
 *
 * Primary function:
 *   Emulate NPC counterparty personas with high behavioral fidelity while maintaining full determinism from run seed
 *
 * What this adds to M134:
 * 1. Emulate NPC counterparty personas with high behavioral fidelity.
 * 2. Maintain full determinism: same seed produces identical NPC behavior.
 * 3. Persona drift detection: NPC behavior never drifts outside defined character bounds.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M134
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M134ATelemetryInput {
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
  // Extended inputs for M134A (market family)

}

// Telemetry events subscribed by M134A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M134ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M134AOutput extends M134ABaseOutput {
  personaBehaviorOutput: unknown;  // persona_behavior_output
  determinismVerification: unknown;  // determinism_verification
  driftFlag: unknown;  // drift_flag
  characterFidelityScore: unknown;  // character_fidelity_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M134ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M134A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M134ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M134A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M134ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M134A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M134APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M134APlacement = 'server';

export interface M134AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M134AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M134AEvalContract {
  /** behavioral_fidelity_accuracy */
  /** determinism_verification_pass */
  /** drift_detection_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M134AModelCard {
  modelId:            'M134A';
  coreMechanicPair:   'M134';
  intelligenceSignal: 'personalization';
  modelCategory:      'controller';
  family:             'market';
  tier:               M134ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M134A_ML_CONSTANTS = {
  ML_ID:              'M134A',
  CORE_PAIR:          'M134',
  MODEL_NAME:         'NPC Counterparty Behavioral Emulator (Deterministic Persona Fidelity)',
  INTEL_SIGNAL:       'personalization' as const,
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
  EVAL_FOCUS:         ["behavioral_fidelity_accuracy", "determinism_verification_pass", "drift_detection_AUC"],
  PRIMARY_OUTPUTS:    ["persona_behavior_output", "determinism_verification", "drift_flag", "character_fidelity_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM134aMl
 *
 * Fires after M134 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M134AOutput with signed auditHash
 */
export async function runM134aMl(
  input:     M134ATelemetryInput,
  tier:      M134ATier = 'baseline',
  modelCard: Omit<M134AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M134AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM134aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM134aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M134AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM134aMlFallback(
  _input: M134ATelemetryInput,
): M134AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M134A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    personaBehaviorOutput: null,
    determinismVerification: null,
    driftFlag: null,
    characterFidelityScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM134aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
