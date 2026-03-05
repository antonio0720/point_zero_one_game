// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m109a_macro_news_burst_impact_synth_regime_detector.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M109A — Macro News Burst Impact Synth + Regime Detector
// Core Pair    : M109
// Family       : market
// Category     : predictor
// IntelSignal  : volatility
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
 * M109A — Macro News Burst Impact Synth + Regime Detector
 *
 * Primary function:
 *   Synthesize macro news burst impact on portfolio; detect regime transitions embedded in headline sequences
 *
 * What this adds to M109:
 * 1. Synthesize macro news burst impact on portfolio state in real time.
 * 2. Detect regime transitions embedded in headline sequences before M05 fires.
 * 3. Generates narrative-driven macro summaries for Pressure Journal.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M109
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M109ATelemetryInput {
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
  // Extended inputs for M109A (market family)

}

// Telemetry events subscribed by M109A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M109ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M109AOutput extends M109ABaseOutput {
  impactSynthesis: unknown;  // impact_synthesis
  regimeTransitionSignal: unknown;  // regime_transition_signal
  portfolioDeltaForecast: unknown;  // portfolio_delta_forecast
  narrativeSummary: unknown;  // narrative_summary
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M109ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M109A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M109ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M109A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M109ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M109A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M109APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M109APlacement = 'server';

export interface M109AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M109AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M109AEvalContract {
  /** regime_detection_lead_time */
  /** impact_synthesis_accuracy */
  /** narrative_clarity */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M109AModelCard {
  modelId:            'M109A';
  coreMechanicPair:   'M109';
  intelligenceSignal: 'volatility';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M109ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M109A_ML_CONSTANTS = {
  ML_ID:              'M109A',
  CORE_PAIR:          'M109',
  MODEL_NAME:         'Macro News Burst Impact Synth + Regime Detector',
  INTEL_SIGNAL:       'volatility' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'market' as const,
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
  EVAL_FOCUS:         ["regime_detection_lead_time", "impact_synthesis_accuracy", "narrative_clarity"],
  PRIMARY_OUTPUTS:    ["impact_synthesis", "regime_transition_signal", "portfolio_delta_forecast", "narrative_summary"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM109aMl
 *
 * Fires after M109 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M109AOutput with signed auditHash
 */
export async function runM109aMl(
  input:     M109ATelemetryInput,
  tier:      M109ATier = 'baseline',
  modelCard: Omit<M109AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M109AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM109aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM109aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M109AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM109aMlFallback(
  _input: M109ATelemetryInput,
): M109AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M109A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    impactSynthesis: null,
    regimeTransitionSignal: null,
    portfolioDeltaForecast: null,
    narrativeSummary: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM109aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
