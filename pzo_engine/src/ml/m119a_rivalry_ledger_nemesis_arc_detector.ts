// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m119a_rivalry_ledger_nemesis_arc_detector.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M119A — Rivalry Ledger Nemesis Arc Detector
// Core Pair    : M119
// Family       : social
// Category     : classifier
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
 * M119A — Rivalry Ledger Nemesis Arc Detector
 *
 * Primary function:
 *   Detect emerging nemesis arcs from rivalry ledger patterns; surface rivalry narrative moments for sharing
 *
 * What this adds to M119:
 * 1. Detect emerging nemesis arcs from rivalry ledger patterns.
 * 2. Surface rivalry narrative moments: 'third consecutive loss to same opponent' becomes a shareable arc.
 * 3. Generates rivalry arc summaries for social feed.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M119
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M119ATelemetryInput {
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
  // Extended inputs for M119A (social family)

}

// Telemetry events subscribed by M119A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M119ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M119AOutput extends M119ABaseOutput {
  nemesisArcDetection: unknown;  // nemesis_arc_detection
  narrativeMoments: unknown;  // narrative_moments
  arcSummary: unknown;  // arc_summary
  sharePrompt: unknown;  // share_prompt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M119ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M119A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M119ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M119A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M119ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M119A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M119APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M119APlacement = 'server';

export interface M119AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M119AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M119AEvalContract {
  /** arc_detection_AUC */
  /** narrative_moment_yield */
  /** share_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M119AModelCard {
  modelId:            'M119A';
  coreMechanicPair:   'M119';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'classifier';
  family:             'social';
  tier:               M119ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M119A_ML_CONSTANTS = {
  ML_ID:              'M119A',
  CORE_PAIR:          'M119',
  MODEL_NAME:         'Rivalry Ledger Nemesis Arc Detector',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'classifier' as const,
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
  EVAL_FOCUS:         ["arc_detection_AUC", "narrative_moment_yield", "share_rate"],
  PRIMARY_OUTPUTS:    ["nemesis_arc_detection", "narrative_moments", "arc_summary", "share_prompt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM119aMl
 *
 * Fires after M119 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M119AOutput with signed auditHash
 */
export async function runM119aMl(
  input:     M119ATelemetryInput,
  tier:      M119ATier = 'baseline',
  modelCard: Omit<M119AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M119AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM119aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM119aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M119AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM119aMlFallback(
  _input: M119ATelemetryInput,
): M119AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M119A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    nemesisArcDetection: null,
    narrativeMoments: null,
    arcSummary: null,
    sharePrompt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM119aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
