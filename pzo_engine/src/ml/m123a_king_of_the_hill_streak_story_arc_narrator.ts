// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m123a_king_of_the_hill_streak_story_arc_narrator.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M123A — King-of-the-Hill Streak Story Arc Narrator
// Core Pair    : M123
// Family       : social
// Category     : generator
// IntelSignal  : rewardFit
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
 * M123A — King-of-the-Hill Streak Story Arc Narrator
 *
 * Primary function:
 *   Narrate king-of-the-hill streak arcs for social sharing; generate stake rotation fairness signals
 *
 * What this adds to M123:
 * 1. Narrate king-of-the-hill streak arcs as shareable social stories.
 * 2. Generate stake rotation fairness signals: stakes never become prohibitively punishing.
 * 3. Streak legitimacy: verify consecutive wins against collusion patterns.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M123
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M123ATelemetryInput {
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
  // Extended inputs for M123A (social family)

}

// Telemetry events subscribed by M123A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M123ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M123AOutput extends M123ABaseOutput {
  streakNarrative: unknown;  // streak_narrative
  stakeFairnessSignal: unknown;  // stake_fairness_signal
  legitimacyScore: unknown;  // legitimacy_score
  sharePrompt: unknown;  // share_prompt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M123ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M123A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M123ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M123A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M123ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M123A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M123APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M123APlacement = 'server';

export interface M123AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M123AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M123AEvalContract {
  /** narrative_quality_rating */
  /** stake_fairness_calibration */
  /** legitimacy_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M123AModelCard {
  modelId:            'M123A';
  coreMechanicPair:   'M123';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'generator';
  family:             'social';
  tier:               M123ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M123A_ML_CONSTANTS = {
  ML_ID:              'M123A',
  CORE_PAIR:          'M123',
  MODEL_NAME:         'King-of-the-Hill Streak Story Arc Narrator',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'generator' as const,
  FAMILY:             'social' as const,
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
  EVAL_FOCUS:         ["narrative_quality_rating", "stake_fairness_calibration", "legitimacy_AUC"],
  PRIMARY_OUTPUTS:    ["streak_narrative", "stake_fairness_signal", "legitimacy_score", "share_prompt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM123aMl
 *
 * Fires after M123 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M123AOutput with signed auditHash
 */
export async function runM123aMl(
  input:     M123ATelemetryInput,
  tier:      M123ATier = 'baseline',
  modelCard: Omit<M123AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M123AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM123aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM123aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M123AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM123aMlFallback(
  _input: M123ATelemetryInput,
): M123AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M123A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    streakNarrative: null,
    stakeFairnessSignal: null,
    legitimacyScore: null,
    sharePrompt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM123aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
