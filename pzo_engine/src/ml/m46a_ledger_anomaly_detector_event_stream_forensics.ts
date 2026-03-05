// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m46a_ledger_anomaly_detector_event_stream_forensics.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M46A — Ledger Anomaly Detector (Event Stream Forensics)
// Core Pair    : M46
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
 * M46A — Ledger Anomaly Detector (Event Stream Forensics)
 *
 * Primary function:
 *   Detect anomalous ledger event sequences indicating state manipulation, replay injection, or clock abuse
 *
 * What this adds to M46:
 * 1. Detect anomalous ledger event sequences indicating state manipulation or replay injection.
 * 2. Clock abuse detection: events arriving out of causal order.
 * 3. Feeds Exploit Taxonomy (M49) with forensic evidence chains.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M46
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M46ATelemetryInput {
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
  // Extended inputs for M46A (integrity family)

}

// Telemetry events subscribed by M46A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M46ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M46AOutput extends M46ABaseOutput {
  anomalyScore: unknown;  // anomaly_score
  manipulationFlag: unknown;  // manipulation_flag
  clockAbuseFlag: unknown;  // clock_abuse_flag
  forensicEvidenceChain: unknown;  // forensic_evidence_chain
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M46ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M46A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M46ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M46A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M46ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M46A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M46AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M46A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M46APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M46APlacement = 'server';

export interface M46AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M46AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M46AEvalContract {
  /** anomaly_detection_AUC */
  /** clock_abuse_recall */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M46AModelCard {
  modelId:            'M46A';
  coreMechanicPair:   'M46';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M46ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M46A_ML_CONSTANTS = {
  ML_ID:              'M46A',
  CORE_PAIR:          'M46',
  MODEL_NAME:         'Ledger Anomaly Detector (Event Stream Forensics)',
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
  EVAL_FOCUS:         ["anomaly_detection_AUC", "clock_abuse_recall", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["anomaly_score", "manipulation_flag", "clock_abuse_flag", "forensic_evidence_chain"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM46aMl
 *
 * Fires after M46 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M46AOutput with signed auditHash
 */
export async function runM46aMl(
  input:     M46ATelemetryInput,
  tier:      M46ATier = 'baseline',
  modelCard: Omit<M46AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M46AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM46aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM46aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M46AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM46aMlFallback(
  _input: M46ATelemetryInput,
): M46AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M46A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    anomalyScore: null,
    manipulationFlag: null,
    clockAbuseFlag: null,
    forensicEvidenceChain: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM46aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
