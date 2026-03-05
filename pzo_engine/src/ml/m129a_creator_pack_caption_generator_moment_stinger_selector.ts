// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m129a_creator_pack_caption_generator_moment_stinger_selector.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M129A — Creator Pack Caption Generator + Moment Stinger Selector
// Core Pair    : M129
// Family       : social
// Category     : generator
// IntelSignal  : rewardFit
// Tiers        : BASELINE, SEQUENCE_DL
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
 * M129A — Creator Pack Caption Generator + Moment Stinger Selector
 *
 * Primary function:
 *   Generate contextually accurate captions for creator pack moments; select optimal sound stingers for emotional beat matching
 *
 * What this adds to M129:
 * 1. Generate contextually accurate captions for creator pack moments.
 * 2. Select optimal sound stingers for emotional beat matching to the moment type.
 * 3. Safety filter: captions never contain sensitive thresholds or exploitable information.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M129
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M129ATelemetryInput {
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
  // Extended inputs for M129A (social family)

}

// Telemetry events subscribed by M129A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M129ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M129AOutput extends M129ABaseOutput {
  captionText: unknown;  // caption_text
  stingerSelection: unknown;  // stinger_selection
  safetyFilterPassed: unknown;  // safety_filter_passed
  beatMatchScore: unknown;  // beat_match_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M129ATier = 'baseline' | 'sequence_dl';

/** M129A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M129ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M129A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M129ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M129APlacement = 'client' | 'server';

export interface M129AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M129AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M129AEvalContract {
  /** caption_accuracy */
  /** stinger_appropriateness */
  /** safety_filter_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M129AModelCard {
  modelId:            'M129A';
  coreMechanicPair:   'M129';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'generator';
  family:             'social';
  tier:               M129ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M129A_ML_CONSTANTS = {
  ML_ID:              'M129A',
  CORE_PAIR:          'M129',
  MODEL_NAME:         'Creator Pack Caption Generator + Moment Stinger Selector',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'generator' as const,
  FAMILY:             'social' as const,
  TIERS:              ['baseline', 'sequence_dl'] as const,
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
  EVAL_FOCUS:         ["caption_accuracy", "stinger_appropriateness", "safety_filter_AUC"],
  PRIMARY_OUTPUTS:    ["caption_text", "stinger_selection", "safety_filter_passed", "beat_match_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM129aMl
 *
 * Fires after M129 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M129AOutput with signed auditHash
 */
export async function runM129aMl(
  input:     M129ATelemetryInput,
  tier:      M129ATier = 'baseline',
  modelCard: Omit<M129AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M129AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM129aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM129aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M129AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM129aMlFallback(
  _input: M129ATelemetryInput,
): M129AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M129A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    captionText: null,
    stingerSelection: null,
    safetyFilterPassed: null,
    beatMatchScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM129aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
