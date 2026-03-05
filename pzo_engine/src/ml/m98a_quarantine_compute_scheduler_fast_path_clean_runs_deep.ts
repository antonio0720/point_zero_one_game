// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m98a_quarantine_compute_scheduler_fast_path_clean_runs_deep.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M98A — Quarantine Compute Scheduler (Fast-Path Clean Runs, Deep-Path Suspicious)
// Core Pair    : M98
// Family       : integrity
// Category     : controller
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
 * M98A — Quarantine Compute Scheduler (Fast-Path Clean Runs, Deep-Path Suspicious)
 *
 * Primary function:
 *   Schedule quarantine compute allocation: fast-path clearly clean runs, deep-check suspicious runs with minimal player disruption
 *
 * What this adds to M98:
 * 1. Schedule quarantine compute: fast-path clean runs, deep-check suspicious runs.
 * 2. Minimizes player disruption: clean runs never feel delayed.
 * 3. Adaptive prioritization: emerging exploit patterns trigger dynamic queue reweighting.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M98
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M98ATelemetryInput {
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
  // Extended inputs for M98A (integrity family)

}

// Telemetry events subscribed by M98A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M98ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M98AOutput extends M98ABaseOutput {
  computeSchedule: unknown;  // compute_schedule
  fastPathFlag: unknown;  // fast_path_flag
  deepCheckPriority: unknown;  // deep_check_priority
  queueReweightingSignal: unknown;  // queue_reweighting_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M98ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M98A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M98ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M98A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M98ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M98A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M98APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M98APlacement = 'server';

export interface M98AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M98AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M98AEvalContract {
  /** throughput_SLO */
  /** false_fast_path_rate */
  /** exploit_detection_speed */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M98AModelCard {
  modelId:            'M98A';
  coreMechanicPair:   'M98';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'controller';
  family:             'integrity';
  tier:               M98ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M98A_ML_CONSTANTS = {
  ML_ID:              'M98A',
  CORE_PAIR:          'M98',
  MODEL_NAME:         'Quarantine Compute Scheduler (Fast-Path Clean Runs, Deep-Path Suspicious)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'integrity' as const,
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
  EVAL_FOCUS:         ["throughput_SLO", "false_fast_path_rate", "exploit_detection_speed"],
  PRIMARY_OUTPUTS:    ["compute_schedule", "fast_path_flag", "deep_check_priority", "queue_reweighting_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM98aMl
 *
 * Fires after M98 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M98AOutput with signed auditHash
 */
export async function runM98aMl(
  input:     M98ATelemetryInput,
  tier:      M98ATier = 'baseline',
  modelCard: Omit<M98AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M98AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM98aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM98aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M98AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM98aMlFallback(
  _input: M98ATelemetryInput,
): M98AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M98A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    computeSchedule: null,
    fastPathFlag: null,
    deepCheckPriority: null,
    queueReweightingSignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM98aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
