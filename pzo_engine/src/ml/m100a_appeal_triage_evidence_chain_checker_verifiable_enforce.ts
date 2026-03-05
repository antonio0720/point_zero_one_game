// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m100a_appeal_triage_evidence_chain_checker_verifiable_enforce.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M100A — Appeal Triage & Evidence Chain Checker (Verifiable Enforcement)
// Core Pair    : M100
// Family       : forensics
// Category     : classifier
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : batch
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
 * M100A — Appeal Triage & Evidence Chain Checker (Verifiable Enforcement)
 *
 * Primary function:
 *   Triage enforcement appeals by evidence strength; verify evidence chains are complete and tamper-evident before arbitration
 *
 * What this adds to M100:
 * 1. Triage enforcement appeals by evidence strength for expedited resolution.
 * 2. Verify evidence chains are complete, ordered, and tamper-evident.
 * 3. Generates triage receipts for transparency.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M100
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M100ATelemetryInput {
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
  // Extended inputs for M100A (forensics family)

}

// Telemetry events subscribed by M100A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M100ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M100AOutput extends M100ABaseOutput {
  triageScore: unknown;  // triage_score
  evidenceChainIntegrity: unknown;  // evidence_chain_integrity
  tamperFlag: unknown;  // tamper_flag
  triageReceipt: unknown;  // triage_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M100ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M100A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M100ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M100A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M100ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M100A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M100APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M100APlacement = 'server';

export interface M100AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M100AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M100AEvalContract {
  /** triage_accuracy */
  /** evidence_integrity_AUC */
  /** resolution_speed_lift */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M100AModelCard {
  modelId:            'M100A';
  coreMechanicPair:   'M100';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'classifier';
  family:             'forensics';
  tier:               M100ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M100A_ML_CONSTANTS = {
  ML_ID:              'M100A',
  CORE_PAIR:          'M100',
  MODEL_NAME:         'Appeal Triage & Evidence Chain Checker (Verifiable Enforcement)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'forensics' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'batch' as const,
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
  EVAL_FOCUS:         ["triage_accuracy", "evidence_integrity_AUC", "resolution_speed_lift"],
  PRIMARY_OUTPUTS:    ["triage_score", "evidence_chain_integrity", "tamper_flag", "triage_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM100aMl
 *
 * Fires after M100 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M100AOutput with signed auditHash
 */
export async function runM100aMl(
  input:     M100ATelemetryInput,
  tier:      M100ATier = 'baseline',
  modelCard: Omit<M100AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M100AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM100aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM100aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M100AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM100aMlFallback(
  _input: M100ATelemetryInput,
): M100AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M100A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    triageScore: null,
    evidenceChainIntegrity: null,
    tamperFlag: null,
    triageReceipt: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM100aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
