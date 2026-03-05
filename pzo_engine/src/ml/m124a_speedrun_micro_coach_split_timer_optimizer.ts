// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m124a_speedrun_micro_coach_split_timer_optimizer.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M124A — Speedrun Micro-Coach + Split Timer Optimizer
// Core Pair    : M124
// Family       : balance
// Category     : controller
// IntelSignal  : personalization
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
 * M124A — Speedrun Micro-Coach + Split Timer Optimizer
 *
 * Primary function:
 *   Micro-coach speedrun decision pacing; optimize split timer targets based on player's revealed capability trajectory
 *
 * What this adds to M124:
 * 1. Micro-coach speedrun decision pacing between split points.
 * 2. Optimize split timer targets based on player's revealed capability, not median population.
 * 3. Detects speedrun farming: deliberately slow runs to manipulate ranking brackets.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M124
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M124ATelemetryInput {
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
  // Extended inputs for M124A (balance family)

}

// Telemetry events subscribed by M124A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M124ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M124AOutput extends M124ABaseOutput {
  pacingCoaching: unknown;  // pacing_coaching
  splitTargetOptimization: unknown;  // split_target_optimization
  farmingFlag: unknown;  // farming_flag
  capabilityTrajectory: unknown;  // capability_trajectory
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M124ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M124A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M124ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M124A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M124ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M124A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M124APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M124APlacement = 'client' | 'server';

export interface M124AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M124AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M124AEvalContract {
  /** split_optimization_accuracy */
  /** farming_detection_AUC */
  /** coaching_acceptance_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M124AModelCard {
  modelId:            'M124A';
  coreMechanicPair:   'M124';
  intelligenceSignal: 'personalization';
  modelCategory:      'controller';
  family:             'balance';
  tier:               M124ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M124A_ML_CONSTANTS = {
  ML_ID:              'M124A',
  CORE_PAIR:          'M124',
  MODEL_NAME:         'Speedrun Micro-Coach + Split Timer Optimizer',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'balance' as const,
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
  EVAL_FOCUS:         ["split_optimization_accuracy", "farming_detection_AUC", "coaching_acceptance_rate"],
  PRIMARY_OUTPUTS:    ["pacing_coaching", "split_target_optimization", "farming_flag", "capability_trajectory"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM124aMl
 *
 * Fires after M124 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M124AOutput with signed auditHash
 */
export async function runM124aMl(
  input:     M124ATelemetryInput,
  tier:      M124ATier = 'baseline',
  modelCard: Omit<M124AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M124AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM124aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM124aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M124AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM124aMlFallback(
  _input: M124ATelemetryInput,
): M124AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M124A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    pacingCoaching: null,
    splitTargetOptimization: null,
    farmingFlag: null,
    capabilityTrajectory: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM124aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
