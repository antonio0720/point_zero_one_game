// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m102a_forked_timeline_ghost_outcome_generator.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M102A — Forked Timeline Ghost Outcome Generator
// Core Pair    : M102
// Family       : forensics
// Category     : generator
// IntelSignal  : alpha
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
 * M102A — Forked Timeline Ghost Outcome Generator
 *
 * Primary function:
 *   Generate plausible ghost outcomes for both timeline branches; surface decision quality comparison without hinting at optimal play
 *
 * What this adds to M102:
 * 1. Generate plausible ghost outcomes for both timeline branches.
 * 2. Surface decision quality comparison without hinting at mechanically optimal play.
 * 3. Feeds Case File with branching outcome analysis.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M102
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M102ATelemetryInput {
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
  // Extended inputs for M102A (forensics family)

}

// Telemetry events subscribed by M102A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M102ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M102AOutput extends M102ABaseOutput {
  ghostOutcomeBranchA: unknown;  // ghost_outcome_branch_a
  ghostOutcomeBranchB: unknown;  // ghost_outcome_branch_b
  decisionQualityDelta: unknown;  // decision_quality_delta
  caseFileSignal: unknown;  // case_file_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M102ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M102A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M102ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M102A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M102ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M102A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M102APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M102APlacement = 'server';

export interface M102AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M102AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M102AEvalContract {
  /** outcome_plausibility */
  /** decision_quality_calibration */
  /** exploit_guard_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M102AModelCard {
  modelId:            'M102A';
  coreMechanicPair:   'M102';
  intelligenceSignal: 'alpha';
  modelCategory:      'generator';
  family:             'forensics';
  tier:               M102ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M102A_ML_CONSTANTS = {
  ML_ID:              'M102A',
  CORE_PAIR:          'M102',
  MODEL_NAME:         'Forked Timeline Ghost Outcome Generator',
  INTEL_SIGNAL:       'alpha' as const,
  MODEL_CATEGORY:     'generator' as const,
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
  EVAL_FOCUS:         ["outcome_plausibility", "decision_quality_calibration", "exploit_guard_AUC"],
  PRIMARY_OUTPUTS:    ["ghost_outcome_branch_a", "ghost_outcome_branch_b", "decision_quality_delta", "case_file_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM102aMl
 *
 * Fires after M102 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M102AOutput with signed auditHash
 */
export async function runM102aMl(
  input:     M102ATelemetryInput,
  tier:      M102ATier = 'baseline',
  modelCard: Omit<M102AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M102AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM102aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM102aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M102AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM102aMlFallback(
  _input: M102ATelemetryInput,
): M102AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M102A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    ghostOutcomeBranchA: null,
    ghostOutcomeBranchB: null,
    decisionQualityDelta: null,
    caseFileSignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM102aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
