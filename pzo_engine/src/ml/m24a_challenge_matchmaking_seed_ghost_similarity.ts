// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m24a_challenge_matchmaking_seed_ghost_similarity.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M24A — Challenge Matchmaking (Seed + Ghost Similarity)
// Core Pair    : M24
// Family       : progression
// Category     : embedding_model
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
 * M24A — Challenge Matchmaking (Seed + Ghost Similarity)
 *
 * Primary function:
 *   Match challenge links to players with similar skill profiles using run embeddings; maximize competitive relevance
 *
 * What this adds to M24:
 * 1. Match challenge links to players with similar skill profiles using run embeddings.
 * 2. Maximizes competitive relevance: neither too easy (boring) nor too hard (demoralizing).
 * 3. Anti-smurf: detects deliberate skill misrepresentation in challenge targeting.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M24
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M24ATelemetryInput {
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
  // Extended inputs for M24A (progression family)

}

// Telemetry events subscribed by M24A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M24ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M24AOutput extends M24ABaseOutput {
  challengeMatchScore: unknown;  // challenge_match_score
  skillSimilarity: unknown;  // skill_similarity
  smurfFlag: unknown;  // smurf_flag
  ghostCompatibilityScore: unknown;  // ghost_compatibility_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M24ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M24A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M24ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M24A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M24ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M24A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M24APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M24APlacement = 'server';

export interface M24AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M24AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M24AEvalContract {
  /** match_acceptance_rate */
  /** smurf_detection_AUC */
  /** challenge_completion_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M24AModelCard {
  modelId:            'M24A';
  coreMechanicPair:   'M24';
  intelligenceSignal: 'personalization';
  modelCategory:      'embedding_model';
  family:             'progression';
  tier:               M24ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M24A_ML_CONSTANTS = {
  ML_ID:              'M24A',
  CORE_PAIR:          'M24',
  MODEL_NAME:         'Challenge Matchmaking (Seed + Ghost Similarity)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'embedding_model' as const,
  FAMILY:             'progression' as const,
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
  EVAL_FOCUS:         ["match_acceptance_rate", "smurf_detection_AUC", "challenge_completion_rate"],
  PRIMARY_OUTPUTS:    ["challenge_match_score", "skill_similarity", "smurf_flag", "ghost_compatibility_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM24aMl
 *
 * Fires after M24 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M24AOutput with signed auditHash
 */
export async function runM24aMl(
  input:     M24ATelemetryInput,
  tier:      M24ATier = 'baseline',
  modelCard: Omit<M24AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M24AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM24aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM24aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M24AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM24aMlFallback(
  _input: M24ATelemetryInput,
): M24AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M24A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    challengeMatchScore: null,
    skillSimilarity: null,
    smurfFlag: null,
    ghostCompatibilityScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM24aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
