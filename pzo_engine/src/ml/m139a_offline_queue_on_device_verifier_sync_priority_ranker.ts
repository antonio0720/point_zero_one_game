// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m139a_offline_queue_on_device_verifier_sync_priority_ranker.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M139A — Offline Queue On-Device Verifier + Sync Priority Ranker
// Core Pair    : M139
// Family       : integrity
// Category     : classifier
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL
// Placement    : client, server
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
 * M139A — Offline Queue On-Device Verifier + Sync Priority Ranker
 *
 * Primary function:
 *   Run lightweight on-device verification for offline queue runs; rank sync priority when connectivity restores
 *
 * What this adds to M139:
 * 1. Run lightweight on-device verification for offline queue runs.
 * 2. Rank sync priority when connectivity restores: integrity-critical runs sync first.
 * 3. Generates offline run integrity certificates for server-side full verification.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M139
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M139ATelemetryInput {
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
  // Extended inputs for M139A (integrity family)

}

// Telemetry events subscribed by M139A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M139ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M139AOutput extends M139ABaseOutput {
  onDeviceVerification: unknown;  // on_device_verification
  syncPriorityRank: unknown;  // sync_priority_rank
  integrityCertificate: unknown;  // integrity_certificate
  fullVerifyQueued: unknown;  // full_verify_queued
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M139ATier = 'baseline' | 'sequence_dl';

/** M139A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M139ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M139A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M139ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M139APlacement = 'client' | 'server';

export interface M139AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M139AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M139AEvalContract {
  /** on_device_accuracy */
  /** sync_priority_calibration */
  /** certificate_integrity_pass */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M139AModelCard {
  modelId:            'M139A';
  coreMechanicPair:   'M139';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'classifier';
  family:             'integrity';
  tier:               M139ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M139A_ML_CONSTANTS = {
  ML_ID:              'M139A',
  CORE_PAIR:          'M139',
  MODEL_NAME:         'Offline Queue On-Device Verifier + Sync Priority Ranker',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl'] as const,
  PLACEMENT:          ['client', 'server'] as const,
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
  EVAL_FOCUS:         ["on_device_accuracy", "sync_priority_calibration", "certificate_integrity_pass"],
  PRIMARY_OUTPUTS:    ["on_device_verification", "sync_priority_rank", "integrity_certificate", "full_verify_queued"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM139aMl
 *
 * Fires after M139 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M139AOutput with signed auditHash
 */
export async function runM139aMl(
  input:     M139ATelemetryInput,
  tier:      M139ATier = 'baseline',
  modelCard: Omit<M139AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M139AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM139aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM139aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M139AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM139aMlFallback(
  _input: M139ATelemetryInput,
): M139AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M139A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    onDeviceVerification: null,
    syncPriorityRank: null,
    integrityCertificate: null,
    fullVerifyQueued: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM139aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
