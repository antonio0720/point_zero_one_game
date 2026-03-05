// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m23a_highlight_detection_auto_clip_dl.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M23A — Highlight Detection (Auto-Clip DL)
// Core Pair    : M23
// Family       : social
// Category     : classifier
// IntelSignal  : rewardFit
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
 * M23A — Highlight Detection (Auto-Clip DL)
 *
 * Primary function:
 *   Detect clip-worthy moments from audio/visual run signals; generate caption suggestions for auto-packager
 *
 * What this adds to M23:
 * 1. Detect clip-worthy moments from run state signals and generate caption suggestions.
 * 2. Learns what the community shares; improves clip quality over time.
 * 3. Privacy-safe: processes in-session signals only, no cross-player content mining.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M23
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M23ATelemetryInput {
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
  // Extended inputs for M23A (social family)

}

// Telemetry events subscribed by M23A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M23ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M23AOutput extends M23ABaseOutput {
  clipStartTick: unknown;  // clip_start_tick
  clipEndTick: unknown;  // clip_end_tick
  captionSuggestion: unknown;  // caption_suggestion
  shareabilityScore: unknown;  // shareability_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M23ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M23A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M23ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M23A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M23ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M23A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M23APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M23APlacement = 'client';

export interface M23AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M23AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M23AEvalContract {
  /** clip_share_rate */
  /** caption_acceptance_rate */
  /** privacy_audit_pass */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M23AModelCard {
  modelId:            'M23A';
  coreMechanicPair:   'M23';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'classifier';
  family:             'social';
  tier:               M23ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M23A_ML_CONSTANTS = {
  ML_ID:              'M23A',
  CORE_PAIR:          'M23',
  MODEL_NAME:         'Highlight Detection (Auto-Clip DL)',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'social' as const,
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
  EVAL_FOCUS:         ["clip_share_rate", "caption_acceptance_rate", "privacy_audit_pass"],
  PRIMARY_OUTPUTS:    ["clip_start_tick", "clip_end_tick", "caption_suggestion", "shareability_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM23aMl
 *
 * Fires after M23 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M23AOutput with signed auditHash
 */
export async function runM23aMl(
  input:     M23ATelemetryInput,
  tier:      M23ATier = 'baseline',
  modelCard: Omit<M23AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M23AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM23aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM23aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M23AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM23aMlFallback(
  _input: M23ATelemetryInput,
): M23AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M23A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    clipStartTick: null,
    clipEndTick: null,
    captionSuggestion: null,
    shareabilityScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM23aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
