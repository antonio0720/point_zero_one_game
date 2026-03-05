// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m42a_prompt_minimalism_controller_when_to_speak_when_to_stay.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M42A — Prompt Minimalism Controller (When to Speak, When to Stay Silent)
// Core Pair    : M42
// Family       : progression
// Category     : controller
// IntelSignal  : personalization
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M42A — Prompt Minimalism Controller (When to Speak, When to Stay Silent)
 *
 * Primary function:
 *   Predict when a guided prompt adds value vs. breaks immersion; enforce minimalism without leaving players lost
 *
 * What this adds to M42:
 * 1. Predict when a guided prompt adds genuine value vs. breaks immersion.
 * 2. Enforces prompt minimalism: fewer, higher-signal prompts.
 * 3. Learns individual tolerance for guidance; respects opt-out permanently.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M42
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M42ATelemetryInput {
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
  // Extended inputs for M42A (progression family)

}

// Telemetry events subscribed by M42A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M42ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M42AOutput extends M42ABaseOutput {
  promptValueScore: unknown;  // prompt_value_score
  immersionBreakRisk: unknown;  // immersion_break_risk
  silenceRecommendation: unknown;  // silence_recommendation
  individualToleranceEstimate: unknown;  // individual_tolerance_estimate
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M42ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M42A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M42ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M42A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M42ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M42A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M42AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M42A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M42APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M42APlacement = 'client';

export interface M42AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M42AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M42AEvalContract {
  /** prompt_acceptance_rate */
  /** immersion_break_rate */
  /** guidance_satisfaction */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M42AModelCard {
  modelId:            'M42A';
  coreMechanicPair:   'M42';
  intelligenceSignal: 'personalization';
  modelCategory:      'controller';
  family:             'progression';
  tier:               M42ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M42A_ML_CONSTANTS = {
  ML_ID:              'M42A',
  CORE_PAIR:          'M42',
  MODEL_NAME:         'Prompt Minimalism Controller (When to Speak, When to Stay Silent)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'progression' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["prompt_acceptance_rate", "immersion_break_rate", "guidance_satisfaction"],
  PRIMARY_OUTPUTS:    ["prompt_value_score", "immersion_break_risk", "silence_recommendation", "individual_tolerance_estimate"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM42aMl
 *
 * Fires after M42 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M42AOutput with signed auditHash
 */
export async function runM42aMl(
  input:     M42ATelemetryInput,
  tier:      M42ATier = 'baseline',
  modelCard: Omit<M42AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M42AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM42aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM42aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M42AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM42aMlFallback(
  _input: M42ATelemetryInput,
): M42AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M42A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    promptValueScore: null,
    immersionBreakRisk: null,
    silenceRecommendation: null,
    individualToleranceEstimate: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM42aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
