// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m56a_doctrine_alignment_model_playstyle_consistency_hypocris.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M56A — Doctrine Alignment Model (Playstyle Consistency + Hypocrisy Detector)
// Core Pair    : M56
// Family       : forensics
// Category     : classifier
// IntelSignal  : personalization
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M56A — Doctrine Alignment Model (Playstyle Consistency + Hypocrisy Detector)
 *
 * Primary function:
 *   Score doctrine consistency against player's actual decisions; detect hypocrisy patterns for Case File
 *
 * What this adds to M56:
 * 1. Score doctrine consistency against player's actual in-run decisions.
 * 2. Detect hypocrisy: players who claim a doctrine but consistently violate it.
 * 3. Feeds Case File with doctrine consistency timeline.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M56
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M56ATelemetryInput {
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
  // Extended inputs for M56A (forensics family)

}

// Telemetry events subscribed by M56A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M56ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M56AOutput extends M56ABaseOutput {
  doctrineConsistencyScore: unknown;  // doctrine_consistency_score
  hypocrisyFlag: unknown;  // hypocrisy_flag
  caseFileTimeline: unknown;  // case_file_timeline
  cordModifierInput: unknown;  // cord_modifier_input
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M56ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M56A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M56ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M56A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M56ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M56A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M56AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M56A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M56APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M56APlacement = 'server';

export interface M56AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M56AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M56AEvalContract {
  /** consistency_calibration */
  /** hypocrisy_detection_AUC */
  /** case_file_clarity */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M56AModelCard {
  modelId:            'M56A';
  coreMechanicPair:   'M56';
  intelligenceSignal: 'personalization';
  modelCategory:      'classifier';
  family:             'forensics';
  tier:               M56ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M56A_ML_CONSTANTS = {
  ML_ID:              'M56A',
  CORE_PAIR:          'M56',
  MODEL_NAME:         'Doctrine Alignment Model (Playstyle Consistency + Hypocrisy Detector)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'forensics' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["consistency_calibration", "hypocrisy_detection_AUC", "case_file_clarity"],
  PRIMARY_OUTPUTS:    ["doctrine_consistency_score", "hypocrisy_flag", "case_file_timeline", "cord_modifier_input"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM56aMl
 *
 * Fires after M56 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M56AOutput with signed auditHash
 */
export async function runM56aMl(
  input:     M56ATelemetryInput,
  tier:      M56ATier = 'baseline',
  modelCard: Omit<M56AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M56AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM56aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM56aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M56AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM56aMlFallback(
  _input: M56ATelemetryInput,
): M56AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M56A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    doctrineConsistencyScore: null,
    hypocrisyFlag: null,
    caseFileTimeline: null,
    cordModifierInput: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM56aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
