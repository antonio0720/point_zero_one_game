// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m117a_table_feed_moment_ranker_auto_highlight_builder.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M117A — Table Feed Moment Ranker + Auto-Highlight Builder
// Core Pair    : M117
// Family       : social
// Category     : recommender
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
 * M117A — Table Feed Moment Ranker + Auto-Highlight Builder
 *
 * Primary function:
 *   Rank run moments by social relevance for the table feed; auto-build highlight reels from ranked moments
 *
 * What this adds to M117:
 * 1. Rank run moments by social relevance for the table feed.
 * 2. Auto-build highlight reels from ranked moments without reproducing full run data.
 * 3. Privacy-safe: ranks only consented, in-session moments.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M117
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M117ATelemetryInput {
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
  // Extended inputs for M117A (social family)

}

// Telemetry events subscribed by M117A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M117ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M117AOutput extends M117ABaseOutput {
  momentRankings: unknown;  // moment_rankings
  highlightReel: unknown;  // highlight_reel
  relevanceScores: unknown;  // relevance_scores
  privacyCompliance: unknown;  // privacy_compliance
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M117ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M117A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M117ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M117A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M117ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M117A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M117APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M117APlacement = 'server';

export interface M117AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M117AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M117AEvalContract {
  /** relevance_ranking_AUC */
  /** highlight_engagement_rate */
  /** privacy_audit_pass */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M117AModelCard {
  modelId:            'M117A';
  coreMechanicPair:   'M117';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'recommender';
  family:             'social';
  tier:               M117ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M117A_ML_CONSTANTS = {
  ML_ID:              'M117A',
  CORE_PAIR:          'M117',
  MODEL_NAME:         'Table Feed Moment Ranker + Auto-Highlight Builder',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'recommender' as const,
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
  EVAL_FOCUS:         ["relevance_ranking_AUC", "highlight_engagement_rate", "privacy_audit_pass"],
  PRIMARY_OUTPUTS:    ["moment_rankings", "highlight_reel", "relevance_scores", "privacy_compliance"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM117aMl
 *
 * Fires after M117 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M117AOutput with signed auditHash
 */
export async function runM117aMl(
  input:     M117ATelemetryInput,
  tier:      M117ATier = 'baseline',
  modelCard: Omit<M117AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M117AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM117aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM117aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M117AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM117aMlFallback(
  _input: M117ATelemetryInput,
): M117AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M117A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    momentRankings: null,
    highlightReel: null,
    relevanceScores: null,
    privacyCompliance: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM117aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
