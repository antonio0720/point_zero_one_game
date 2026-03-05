// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m75a_integrity_digest_generator_privacy_safe_transparency_au.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M75A — Integrity Digest Generator (Privacy-Safe Transparency Audit)
// Core Pair    : M75
// Family       : forensics
// Category     : generator
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M75A — Integrity Digest Generator (Privacy-Safe Transparency Audit)
 *
 * Primary function:
 *   Generate season-level integrity digest from aggregated ledger data; publish without revealing individual run details
 *
 * What this adds to M75:
 * 1. Generate season-level integrity digest from aggregated ledger data.
 * 2. Publish audit trail without revealing individual player run details.
 * 3. Flags anomaly clusters for designer review without threshold leakage.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M75
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M75ATelemetryInput {
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
  // Extended inputs for M75A (forensics family)

}

// Telemetry events subscribed by M75A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M75ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M75AOutput extends M75ABaseOutput {
  integrityDigest: unknown;  // integrity_digest
  anomalyClusterFlags: unknown;  // anomaly_cluster_flags
  auditTrail: unknown;  // audit_trail
  privacyComplianceScore: unknown;  // privacy_compliance_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M75ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M75A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M75ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M75A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M75ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M75A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M75AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M75A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M75APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M75APlacement = 'server';

export interface M75AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M75AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M75AEvalContract {
  /** digest_accuracy */
  /** privacy_audit_pass */
  /** anomaly_cluster_recall */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M75AModelCard {
  modelId:            'M75A';
  coreMechanicPair:   'M75';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'generator';
  family:             'forensics';
  tier:               M75ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M75A_ML_CONSTANTS = {
  ML_ID:              'M75A',
  CORE_PAIR:          'M75',
  MODEL_NAME:         'Integrity Digest Generator (Privacy-Safe Transparency Audit)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'generator' as const,
  FAMILY:             'forensics' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["digest_accuracy", "privacy_audit_pass", "anomaly_cluster_recall"],
  PRIMARY_OUTPUTS:    ["integrity_digest", "anomaly_cluster_flags", "audit_trail", "privacy_compliance_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM75aMl
 *
 * Fires after M75 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M75AOutput with signed auditHash
 */
export async function runM75aMl(
  input:     M75ATelemetryInput,
  tier:      M75ATier = 'baseline',
  modelCard: Omit<M75AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M75AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM75aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM75aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M75AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM75aMlFallback(
  _input: M75ATelemetryInput,
): M75AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M75A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    integrityDigest: null,
    anomalyClusterFlags: null,
    auditTrail: null,
    privacyComplianceScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM75aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
