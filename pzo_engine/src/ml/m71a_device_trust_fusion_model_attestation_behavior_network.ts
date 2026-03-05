// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m71a_device_trust_fusion_model_attestation_behavior_network.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M71A — Device Trust Fusion Model (Attestation + Behavior + Network)
// Core Pair    : M71
// Family       : integrity
// Category     : embedding_model
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M71A — Device Trust Fusion Model (Attestation + Behavior + Network)
 *
 * Primary function:
 *   Fuse device attestation signals, behavioral patterns, and network fingerprints into a single trust tier
 *
 * What this adds to M71:
 * 1. Fuse device attestation, behavioral patterns, and network fingerprints into a single trust tier.
 * 2. Detects attestation spoofing: correct certificates but anomalous behavior.
 * 3. Drives competitive eligibility gates without blocking casual play.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M71
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M71ATelemetryInput {
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
  // Extended inputs for M71A (integrity family)

}

// Telemetry events subscribed by M71A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M71ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M71AOutput extends M71ABaseOutput {
  deviceTrustTier: unknown;  // device_trust_tier
  attestationSpoofFlag: unknown;  // attestation_spoof_flag
  networkAnomalyScore: unknown;  // network_anomaly_score
  competitiveEligibility: unknown;  // competitive_eligibility
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M71ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M71A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M71ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M71A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M71ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M71A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M71AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M71A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M71APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M71APlacement = 'server';

export interface M71AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M71AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M71AEvalContract {
  /** trust_tier_accuracy */
  /** spoof_detection_AUC */
  /** false_block_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M71AModelCard {
  modelId:            'M71A';
  coreMechanicPair:   'M71';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'embedding_model';
  family:             'integrity';
  tier:               M71ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M71A_ML_CONSTANTS = {
  ML_ID:              'M71A',
  CORE_PAIR:          'M71',
  MODEL_NAME:         'Device Trust Fusion Model (Attestation + Behavior + Network)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'embedding_model' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["trust_tier_accuracy", "spoof_detection_AUC", "false_block_rate"],
  PRIMARY_OUTPUTS:    ["device_trust_tier", "attestation_spoof_flag", "network_anomaly_score", "competitive_eligibility"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM71aMl
 *
 * Fires after M71 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M71AOutput with signed auditHash
 */
export async function runM71aMl(
  input:     M71ATelemetryInput,
  tier:      M71ATier = 'baseline',
  modelCard: Omit<M71AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M71AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM71aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM71aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M71AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM71aMlFallback(
  _input: M71ATelemetryInput,
): M71AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M71A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    deviceTrustTier: null,
    attestationSpoofFlag: null,
    networkAnomalyScore: null,
    competitiveEligibility: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM71aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
