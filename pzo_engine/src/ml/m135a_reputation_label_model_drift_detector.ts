// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m135a_reputation_label_model_drift_detector.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M135A — Reputation Label Model + Drift Detector
// Core Pair    : M135
// Family       : forensics
// Category     : classifier
// IntelSignal  : personalization
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : batch
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
 * M135A — Reputation Label Model + Drift Detector
 *
 * Primary function:
 *   Assign proof-based reputation labels from run history; detect label drift when player behavior changes legitimately
 *
 * What this adds to M135:
 * 1. Assign proof-based reputation labels from verified run history.
 * 2. Detect label drift: legitimate behavior change should update labels, not freeze them.
 * 3. Reversibility engine: bad labels clear when behavior improves.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M135
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M135ATelemetryInput {
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
  // Extended inputs for M135A (forensics family)

}

// Telemetry events subscribed by M135A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M135ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M135AOutput extends M135ABaseOutput {
  labelAssignment: unknown;  // label_assignment
  driftSignal: unknown;  // drift_signal
  reversibilityScore: unknown;  // reversibility_score
  evidenceReceipt: unknown;  // evidence_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M135ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M135A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M135ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M135A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M135ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M135A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M135APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M135APlacement = 'server';

export interface M135AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M135AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M135AEvalContract {
  /** label_accuracy */
  /** drift_detection_AUC */
  /** reversibility_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M135AModelCard {
  modelId:            'M135A';
  coreMechanicPair:   'M135';
  intelligenceSignal: 'personalization';
  modelCategory:      'classifier';
  family:             'forensics';
  tier:               M135ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M135A_ML_CONSTANTS = {
  ML_ID:              'M135A',
  CORE_PAIR:          'M135',
  MODEL_NAME:         'Reputation Label Model + Drift Detector',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'forensics' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'batch' as const,
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
  EVAL_FOCUS:         ["label_accuracy", "drift_detection_AUC", "reversibility_rate"],
  PRIMARY_OUTPUTS:    ["label_assignment", "drift_signal", "reversibility_score", "evidence_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM135aMl
 *
 * Fires after M135 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M135AOutput with signed auditHash
 */
export async function runM135aMl(
  input:     M135ATelemetryInput,
  tier:      M135ATier = 'baseline',
  modelCard: Omit<M135AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M135AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM135aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM135aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M135AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM135aMlFallback(
  _input: M135ATelemetryInput,
): M135AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M135A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    labelAssignment: null,
    driftSignal: null,
    reversibilityScore: null,
    evidenceReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM135aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
