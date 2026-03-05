// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m13a_friction_module_tuner_constrained_bandits.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M13A — Friction Module Tuner (Constrained Bandits)
// Core Pair    : M13
// Family       : balance
// Category     : controller
// IntelSignal  : personalization
// Tiers        : BASELINE, POLICY_RL
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
 * M13A — Friction Module Tuner (Constrained Bandits)
 *
 * Primary function:
 *   Tune SO friction module severity within design bounds to keep friction feeling meaningful, not punishing
 *
 * What this adds to M13:
 * 1. Tune SO friction module severity within bounded design envelope.
 * 2. Learns per-skill-band tolerances; prevents friction from feeling punishing vs. meaningful.
 * 3. Feeds season balancing reports.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M13
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M13ATelemetryInput {
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
  // Extended inputs for M13A (balance family)

}

// Telemetry events subscribed by M13A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M13ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M13AOutput extends M13ABaseOutput {
  frictionSeverityDelta: unknown;  // friction_severity_delta
  skillBandTolerance: unknown;  // skill_band_tolerance
  seasonBalanceReportSignal: unknown;  // season_balance_report_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M13ATier = 'baseline' | 'policy_rl';

/** M13A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M13ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M13A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M13APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M13APlacement = 'server';

export interface M13AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M13AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M13AEvalContract {
  /** friction_perceived_fairness */
  /** rage_quit_correlation */
  /** season_stability */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M13AModelCard {
  modelId:            'M13A';
  coreMechanicPair:   'M13';
  intelligenceSignal: 'personalization';
  modelCategory:      'controller';
  family:             'balance';
  tier:               M13ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M13A_ML_CONSTANTS = {
  ML_ID:              'M13A',
  CORE_PAIR:          'M13',
  MODEL_NAME:         'Friction Module Tuner (Constrained Bandits)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'balance' as const,
  TIERS:              ['baseline', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["friction_perceived_fairness", "rage_quit_correlation", "season_stability"],
  PRIMARY_OUTPUTS:    ["friction_severity_delta", "skill_band_tolerance", "season_balance_report_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM13aMl
 *
 * Fires after M13 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M13AOutput with signed auditHash
 */
export async function runM13aMl(
  input:     M13ATelemetryInput,
  tier:      M13ATier = 'baseline',
  modelCard: Omit<M13AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M13AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM13aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM13aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M13AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM13aMlFallback(
  _input: M13ATelemetryInput,
): M13AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M13A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    frictionSeverityDelta: null,
    skillBandTolerance: null,
    seasonBalanceReportSignal: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM13aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
