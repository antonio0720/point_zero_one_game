// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m105a_last_look_window_misclick_guard_regret_amplifier.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M105A — Last Look Window Misclick Guard + Regret Amplifier
// Core Pair    : M105
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
 * M105A — Last Look Window Misclick Guard + Regret Amplifier
 *
 * Primary function:
 *   Detect likely misclick in last-look window; amplify regret signal for post-mortem when a misclick costs the run
 *
 * What this adds to M105:
 * 1. Detect likely misclicks in the last-look window before they become irreversible.
 * 2. Amplify regret signal in post-mortem: 'you misclicked here' with tick evidence.
 * 3. Generates misclick guard receipts for support appeals.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M105
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M105ATelemetryInput {
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
  // Extended inputs for M105A (balance family)

}

// Telemetry events subscribed by M105A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M105ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M105AOutput extends M105ABaseOutput {
  misclickProbability: unknown;  // misclick_probability
  regretAmplificationSignal: unknown;  // regret_amplification_signal
  guardReceipt: unknown;  // guard_receipt
  supportEvidence: unknown;  // support_evidence
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M105ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M105A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M105ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M105A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M105ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M105A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M105APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M105APlacement = 'client';

export interface M105AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M105AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M105AEvalContract {
  /** misclick_detection_AUC */
  /** false_guard_rate */
  /** regret_signal_precision */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M105AModelCard {
  modelId:            'M105A';
  coreMechanicPair:   'M105';
  intelligenceSignal: 'personalization';
  modelCategory:      'classifier';
  family:             'balance';
  tier:               M105ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M105A_ML_CONSTANTS = {
  ML_ID:              'M105A',
  CORE_PAIR:          'M105',
  MODEL_NAME:         'Last Look Window Misclick Guard + Regret Amplifier',
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
  EVAL_FOCUS:         ["misclick_detection_AUC", "false_guard_rate", "regret_signal_precision"],
  PRIMARY_OUTPUTS:    ["misclick_probability", "regret_amplification_signal", "guard_receipt", "support_evidence"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM105aMl
 *
 * Fires after M105 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M105AOutput with signed auditHash
 */
export async function runM105aMl(
  input:     M105ATelemetryInput,
  tier:      M105ATier = 'baseline',
  modelCard: Omit<M105AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M105AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM105aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM105aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M105AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM105aMlFallback(
  _input: M105ATelemetryInput,
): M105AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M105A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    misclickProbability: null,
    regretAmplificationSignal: null,
    guardReceipt: null,
    supportEvidence: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM105aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
