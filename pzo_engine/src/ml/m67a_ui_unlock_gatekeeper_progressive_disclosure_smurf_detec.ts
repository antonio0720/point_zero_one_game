// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m67a_ui_unlock_gatekeeper_progressive_disclosure_smurf_detec.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M67A — UI Unlock Gatekeeper (Progressive Disclosure + Smurf Detection)
// Core Pair    : M67
// Family       : progression
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
 * M67A — UI Unlock Gatekeeper (Progressive Disclosure + Smurf Detection)
 *
 * Primary function:
 *   Gate UI complexity unlocks to match player readiness; detect smurfs bypassing progressive disclosure
 *
 * What this adds to M67:
 * 1. Gate UI complexity unlocks to match genuine player readiness.
 * 2. Detect smurfs: experienced players on new accounts displaying advanced behavior patterns.
 * 3. Personalizes disclosure pacing without exposing power gaps.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M67
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M67ATelemetryInput {
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
  // Extended inputs for M67A (progression family)

}

// Telemetry events subscribed by M67A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M67ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M67AOutput extends M67ABaseOutput {
  unlockReadinessScore: unknown;  // unlock_readiness_score
  smurfProbability: unknown;  // smurf_probability
  disclosurePaceRecommendation: unknown;  // disclosure_pace_recommendation
  powerGapFlag: unknown;  // power_gap_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M67ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M67A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M67ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M67A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M67ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M67A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M67AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M67A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M67APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M67APlacement = 'server';

export interface M67AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M67AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M67AEvalContract {
  /** unlock_readiness_calibration */
  /** smurf_detection_AUC */
  /** overwhelm_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M67AModelCard {
  modelId:            'M67A';
  coreMechanicPair:   'M67';
  intelligenceSignal: 'personalization';
  modelCategory:      'classifier';
  family:             'progression';
  tier:               M67ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M67A_ML_CONSTANTS = {
  ML_ID:              'M67A',
  CORE_PAIR:          'M67',
  MODEL_NAME:         'UI Unlock Gatekeeper (Progressive Disclosure + Smurf Detection)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'progression' as const,
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
  EVAL_FOCUS:         ["unlock_readiness_calibration", "smurf_detection_AUC", "overwhelm_rate"],
  PRIMARY_OUTPUTS:    ["unlock_readiness_score", "smurf_probability", "disclosure_pace_recommendation", "power_gap_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM67aMl
 *
 * Fires after M67 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M67AOutput with signed auditHash
 */
export async function runM67aMl(
  input:     M67ATelemetryInput,
  tier:      M67ATier = 'baseline',
  modelCard: Omit<M67AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M67AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM67aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM67aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M67AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM67aMlFallback(
  _input: M67ATelemetryInput,
): M67AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M67A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    unlockReadinessScore: null,
    smurfProbability: null,
    disclosurePaceRecommendation: null,
    powerGapFlag: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM67aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
