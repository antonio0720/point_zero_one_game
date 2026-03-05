// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m11a_hesitation_inertia_detector_micro_behavior_dl.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M11A — Hesitation / Inertia Detector (Micro-Behavior DL)
// Core Pair    : M11
// Family       : balance
// Category     : classifier
// IntelSignal  : personalization
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : client
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
 * M11A — Hesitation / Inertia Detector (Micro-Behavior DL)
 *
 * Primary function:
 *   Detect hesitation and decision inertia patterns from UI micro-behavior; flag inertia before Inertia Tax fires
 *
 * What this adds to M11:
 * 1. Detect hesitation and decision inertia patterns from UI hover loops, timer behavior, and action cadence.
 * 2. Flags inertia early so the Inertia Tax (M11) feels earned, not surprising.
 * 3. Feeds adaptive difficulty: persistent inertia → consider reducing noise, not reducing challenge.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M11
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M11ATelemetryInput {
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
  // Extended inputs for M11A (balance family)

}

// Telemetry events subscribed by M11A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M11ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M11AOutput extends M11ABaseOutput {
  inertiaScore: unknown;  // inertia_score
  hesitationPattern: unknown;  // hesitation_pattern
  inertiaTaxWarning: unknown;  // inertia_tax_warning
  adaptiveDifficultySignal: unknown;  // adaptive_difficulty_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M11ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M11A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M11ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M11A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M11ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M11A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M11APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M11APlacement = 'client';

export interface M11AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M11AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M11AEvalContract {
  /** inertia_detection_AUC */
  /** false_positive_on_deliberate_pauses */
  /** adaptive_difficulty_fairness */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M11AModelCard {
  modelId:            'M11A';
  coreMechanicPair:   'M11';
  intelligenceSignal: 'personalization';
  modelCategory:      'classifier';
  family:             'balance';
  tier:               M11ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M11A_ML_CONSTANTS = {
  ML_ID:              'M11A',
  CORE_PAIR:          'M11',
  MODEL_NAME:         'Hesitation / Inertia Detector (Micro-Behavior DL)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'balance' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['client'] as const,
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
  EVAL_FOCUS:         ["inertia_detection_AUC", "false_positive_on_deliberate_pauses", "adaptive_difficulty_fairness"],
  PRIMARY_OUTPUTS:    ["inertia_score", "hesitation_pattern", "inertia_tax_warning", "adaptive_difficulty_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM11aMl
 *
 * Fires after M11 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M11AOutput with signed auditHash
 */
export async function runM11aMl(
  input:     M11ATelemetryInput,
  tier:      M11ATier = 'baseline',
  modelCard: Omit<M11AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M11AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM11aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM11aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M11AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM11aMlFallback(
  _input: M11ATelemetryInput,
): M11AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M11A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    inertiaScore: null,
    hesitationPattern: null,
    inertiaTaxWarning: null,
    adaptiveDifficultySignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM11aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
