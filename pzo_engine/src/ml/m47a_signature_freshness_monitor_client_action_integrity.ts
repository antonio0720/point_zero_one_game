// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m47a_signature_freshness_monitor_client_action_integrity.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M47A — Signature & Freshness Monitor (Client Action Integrity)
// Core Pair    : M47
// Family       : integrity
// Category     : anomaly_detector
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
 * M47A — Signature & Freshness Monitor (Client Action Integrity)
 *
 * Primary function:
 *   Monitor client action signatures for staleness, replay attacks, and signature forgery patterns
 *
 * What this adds to M47:
 * 1. Monitor client action signatures for staleness, replay attacks, and forgery patterns.
 * 2. Detects coordinated signature spoofing across device clusters.
 * 3. Feeds Device Attestation (M71) trust tier scoring.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M47
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M47ATelemetryInput {
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
  // Extended inputs for M47A (integrity family)

}

// Telemetry events subscribed by M47A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M47ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M47AOutput extends M47ABaseOutput {
  signatureFreshnessScore: unknown;  // signature_freshness_score
  replayAttackFlag: unknown;  // replay_attack_flag
  forgeryProbability: unknown;  // forgery_probability
  deviceClusterAnomaly: unknown;  // device_cluster_anomaly
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M47ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M47A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M47ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M47A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M47ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M47A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M47AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M47A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M47APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M47APlacement = 'server';

export interface M47AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M47AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M47AEvalContract {
  /** replay_detection_AUC */
  /** forgery_recall */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M47AModelCard {
  modelId:            'M47A';
  coreMechanicPair:   'M47';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M47ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M47A_ML_CONSTANTS = {
  ML_ID:              'M47A',
  CORE_PAIR:          'M47',
  MODEL_NAME:         'Signature & Freshness Monitor (Client Action Integrity)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
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
  EVAL_FOCUS:         ["replay_detection_AUC", "forgery_recall", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["signature_freshness_score", "replay_attack_flag", "forgery_probability", "device_cluster_anomaly"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM47aMl
 *
 * Fires after M47 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M47AOutput with signed auditHash
 */
export async function runM47aMl(
  input:     M47ATelemetryInput,
  tier:      M47ATier = 'baseline',
  modelCard: Omit<M47AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M47AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM47aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM47aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M47AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM47aMlFallback(
  _input: M47ATelemetryInput,
): M47AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M47A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    signatureFreshnessScore: null,
    replayAttackFlag: null,
    forgeryProbability: null,
    deviceClusterAnomaly: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM47aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
