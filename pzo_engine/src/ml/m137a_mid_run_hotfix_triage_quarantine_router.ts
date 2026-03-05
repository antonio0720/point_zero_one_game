// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m137a_mid_run_hotfix_triage_quarantine_router.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M137A — Mid-Run Hotfix Triage + Quarantine Router
// Core Pair    : M137
// Family       : integrity
// Category     : controller
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : real_time
// Lock-Off     : NO — always active (integrity / anti-cheat)
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
 * M137A — Mid-Run Hotfix Triage + Quarantine Router
 *
 * Primary function:
 *   Triage hotfix urgency vs. run-lock integrity; route critical fixes through quarantine without breaking active runs
 *
 * What this adds to M137:
 * 1. Triage hotfix urgency vs. run-lock integrity constraints.
 * 2. Route critical fixes through quarantine: never break active run determinism.
 * 3. Generates hotfix impact assessment for engineering team.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M137
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M137ATelemetryInput {
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
  // Extended inputs for M137A (integrity family)

}

// Telemetry events subscribed by M137A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M137ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M137AOutput extends M137ABaseOutput {
  triageUrgency: unknown;  // triage_urgency
  quarantineRoute: unknown;  // quarantine_route
  runImpactAssessment: unknown;  // run_impact_assessment
  determinismGuardPassed: unknown;  // determinism_guard_passed
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M137ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M137A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M137ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M137A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M137ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M137A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M137APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M137APlacement = 'server';

export interface M137AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M137AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M137AEvalContract {
  /** triage_accuracy */
  /** quarantine_success_rate */
  /** determinism_guard_pass_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M137AModelCard {
  modelId:            'M137A';
  coreMechanicPair:   'M137';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'controller';
  family:             'integrity';
  tier:               M137ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M137A_ML_CONSTANTS = {
  ML_ID:              'M137A',
  CORE_PAIR:          'M137',
  MODEL_NAME:         'Mid-Run Hotfix Triage + Quarantine Router',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'real_time' as const,
  CAN_LOCK_OFF:        false,
  GUARDRAILS: {
    determinismPreserved:      true,
    boundedNudges:             true,
    auditabilityRequired:      true,
    privacyEnforced:           true,
    competitiveLockOffAllowed: false,
    scoreCap:                  1.0,
    abstainThreshold:          0.35,
  },
  EVAL_FOCUS:         ["triage_accuracy", "quarantine_success_rate", "determinism_guard_pass_rate"],
  PRIMARY_OUTPUTS:    ["triage_urgency", "quarantine_route", "run_impact_assessment", "determinism_guard_passed"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM137aMl
 *
 * Fires after M137 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M137AOutput with signed auditHash
 */
export async function runM137aMl(
  input:     M137ATelemetryInput,
  tier:      M137ATier = 'baseline',
  modelCard: Omit<M137AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M137AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM137aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM137aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M137AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM137aMlFallback(
  _input: M137ATelemetryInput,
): M137AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M137A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    triageUrgency: null,
    quarantineRoute: null,
    runImpactAssessment: null,
    determinismGuardPassed: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM137aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
