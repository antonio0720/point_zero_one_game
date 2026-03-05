// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo_engine/src/ml/m01a_seed_integrity_deterministic_replay_forensics.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M01A — Seed Integrity + Deterministic Replay Forensics
// Core Pair    : M01
// Family       : integrity
// Category     : anomaly_detector
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
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

import { HashFunction } from '../integrity/hash-function';
import { MLStore } from '../persistence/ml-store';

import { canonicalJson } from './runtime/canonical-json';
import { redactLikelyPII, hashRedactedPayload } from './runtime/privacy';
import { clamp } from './runtime/math';
import { extractM01AFeatures, type TickSnapshotLite } from './runtime/m01a-features';
import {
  applyQueuedFeedbackAndPersist,
  computeM01AFeatureSchemaHash,
  loadOrInitM01AModel,
  predictTamperProbability,
  type M01ATier,
} from './runtime/m01a-runtime';

export { recordM01AFeedback, type M01AFeedbackLabel } from './runtime/m01a-feedback';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M01A — Seed Integrity + Deterministic Replay Forensics
 *
 * Primary function:
 *   Detect replay/seed tampering and impossible action sequences; output a signed Replay Integrity Score
 *
 * What this adds to M01:
 * 1. Detect replay/seed tampering and impossible action sequences while keeping runs deterministic.
 * 2. Uses lightweight anomaly detection over action timelines + consistency checks against the deterministic simulator.
 * 3. Outputs a signed 'Replay Integrity Score' for challenges, leaderboards, and share links.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M01
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M01ATelemetryInput {
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  macroRegime: string;

  portfolioSnapshot: Record<string, unknown>;
  actionTimeline: Record<string, unknown>[];

  uiInteraction: Record<string, unknown>;
  socialEvents: Record<string, unknown>[];
  outcomeEvents: Record<string, unknown>[];

  ledgerEvents?: Record<string, unknown>[];
  contractGraph?: Record<string, unknown>;

  userOptIn: Record<string, boolean>;

  // Extended inputs (optional; enables stronger signals from moment 1)
  runId?: string; // if you have a canonical run id, provide it; else runSeed is used
  tickSnapshots?: TickSnapshotLite[];
  expectedTickCount?: number;

  // Placement/ops metadata (optional)
  playerId?: string;
  mode?: string;
}

// ── Primary output contract ───────────────────────────────────────────────────
export interface M01ABaseOutput {
  score: number; // 0–1 (1 = high integrity)
  topFactors: string[];
  recommendation: string;
  auditHash: string; // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M01AOutput extends M01ABaseOutput {
  replayIntegrityScore: unknown; // ReplayIntegrityScoreV1
  tamperProbability: unknown; // 0..1
  impossibleSequenceFlags: unknown; // string[]
  signedReceipt: unknown; // SignedReceiptV1
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type { M01ATier };

// ── Inference placement ───────────────────────────────────────────────────────
export type M01APlacement = 'client' | 'server';

export interface M01AInferencePlacement {
  client: boolean;
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M01AGuardrails {
  determinismPreserved: true;
  boundedNudges: true;
  auditabilityRequired: true;
  privacyEnforced: true;
  competitiveLockOffAllowed: false;
  scoreCap: 1.0;
  abstainThreshold: number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M01AEvalContract {
  momentYieldMinimum: 3;
  maxRiggedReportRate: number;
  maxFairnessDrift: number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M01AModelCard {
  modelId: 'M01A';
  coreMechanicPair: 'M01';
  intelligenceSignal: 'antiCheat';
  modelCategory: 'anomaly_detector';
  family: 'integrity';
  tier: M01ATier;
  modelVersion: string;
  trainCutDate: string;
  featureSchemaHash: string; // must match computeM01AFeatureSchemaHash()
  rulesetVersion: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M01A_ML_CONSTANTS = {
  ML_ID: 'M01A',
  CORE_PAIR: 'M01',
  MODEL_NAME: 'Seed Integrity + Deterministic Replay Forensics',
  INTEL_SIGNAL: 'antiCheat' as const,
  MODEL_CATEGORY: 'anomaly_detector' as const,
  FAMILY: 'integrity' as const,
  TIERS: ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT: ['client', 'server'] as const,
  BUDGET: 'real_time' as const,
  CAN_LOCK_OFF: false,
  GUARDRAILS: {
    determinismPreserved: true,
    boundedNudges: true,
    auditabilityRequired: true,
    privacyEnforced: true,
    competitiveLockOffAllowed: false,
    scoreCap: 1.0,
    abstainThreshold: 0.35,
  },
  EVAL_FOCUS: ['false_positive_rate_on_lag_spikes', 'tamper_detection_AUC', 'replay_consistency_delta'],
  PRIMARY_OUTPUTS: ['replay_integrity_score', 'tamper_probability', 'impossible_sequence_flags', 'signed_receipt'],
  TELEMETRY_EVENTS: [],
} as const;

// ── Internal types ────────────────────────────────────────────────────────────
type IntegrityStatus = 'VERIFIED' | 'UNVERIFIED' | 'TAMPERED' | 'UNKNOWN';

interface ReplayIntegrityScoreV1 {
  version: 'pzo:m01a:replay_integrity_score:v1';
  status: IntegrityStatus;
  anomalyScore: number; // 0..1 (higher = more suspicious)
  confidence: number; // 0..1
  schemaHashOk: boolean;
  consentLimited: boolean;
  actionCount: number;
  flags: string[]; // bounded
  reasons: string[]; // bounded
  caps: {
    scoreCap: number;
    abstainThreshold: number;
    maxTimelineEvents: number;
  };
}

interface SignedReceiptV1 {
  version: 'pzo:m01a:signed_receipt:v1';
  mlId: 'M01A';
  corePair: 'M01';
  runId: string;
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  tier: M01ATier;
  modelVersion: string;
  featureSchemaHash: string;
  rulesetVersionResolved: string;
  auditHash: string;
  score: number;
  tamperProbability: number;
  status: IntegrityStatus;
  signatureAlg: 'HMAC-SHA256' | 'UNSIGNED';
  keyId?: string;
  signature?: string;
  signedAt: number;
  step: number;
}

// =============================================================================
// Main inference
// =============================================================================

/**
 * runM01aMl
 *
 * Fires after M01 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Integrity signals always run regardless of lock-off state.
 */
export async function runM01aMl(
  input: M01ATelemetryInput,
  tier: M01ATier = 'baseline',
  modelCard: Omit<M01AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M01AOutput> {
  const hf = new HashFunction();

  // ── Consent gating (privacy) ───────────────────────────────────────────────
  const optIn = input.userOptIn ?? {};
  const allowUI = optIn.ui !== false && optIn.uiInteraction !== false;
  const allowSocial = optIn.social !== false && optIn.socialEvents !== false;
  const allowContract = optIn.contract !== false && optIn.contractGraph !== false;
  const allowLedger = optIn.ledger !== false && optIn.ledgerEvents !== false;
  const consentLimited = !(allowUI && allowSocial && allowContract && allowLedger);

  // ── Feature schema hard gate ───────────────────────────────────────────────
  const computedFeatureSchemaHash = computeM01AFeatureSchemaHash();
  const expectedFeatureSchemaHash = modelCard.featureSchemaHash || computedFeatureSchemaHash;
  const schemaHashOk = computedFeatureSchemaHash === expectedFeatureSchemaHash;

  if (!schemaHashOk) {
    return buildAbstainOutput(hf, input, tier, modelCard, {
      computedFeatureSchemaHash,
      expectedFeatureSchemaHash,
      consentLimited,
      reason: `Feature schema mismatch: expected=${expectedFeatureSchemaHash} computed=${computedFeatureSchemaHash}`,
    });
  }

  // ── Redact/shape input for hashing & features (defense-in-depth) ───────────
  const runId = input.runId ?? input.runSeed;
  const redacted = redactLikelyPII({
    runId,
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rulesetVersion: input.rulesetVersion,
    macroRegime: input.macroRegime,

    portfolioSnapshot: input.portfolioSnapshot ?? {},
    actionTimeline: input.actionTimeline ?? [],

    uiInteraction: allowUI ? (input.uiInteraction ?? {}) : {},
    socialEvents: allowSocial ? (input.socialEvents ?? []) : [],
    outcomeEvents: input.outcomeEvents ?? [],

    ledgerEvents: allowLedger ? (input.ledgerEvents ?? []) : [],
    contractGraph: allowContract ? (input.contractGraph ?? {}) : {},

    userOptIn: input.userOptIn ?? {},

    tickSnapshots: input.tickSnapshots ?? [],
    expectedTickCount: input.expectedTickCount ?? 0,

    playerId: input.playerId ?? '',
    mode: input.mode ?? '',
  });

  // ── Online learning (server-grade): apply queued feedback BEFORE scoring ───
  // Deterministic update order is guaranteed inside applyQueuedFeedbackAndPersist().
  const model = applyQueuedFeedbackAndPersist({
    model: loadOrInitM01AModel({
      tier,
      rulesetVersion: modelCard.rulesetVersion,
      modelVersion: modelCard.modelVersion,
      featureSchemaHash: computedFeatureSchemaHash,
    }),
    maxBatch: 32,
  });

  // ── Feature extraction (moment-0 safe) ─────────────────────────────────────
  const feat = extractM01AFeatures({
    actionTimeline: (redacted as any).actionTimeline ?? [],
    tickSnapshots: (redacted as any).tickSnapshots ?? [],
    expectedTickCount: (redacted as any).expectedTickCount ?? 0,
    macroRegime: (redacted as any).macroRegime ?? '',
  });

  // ── Tamper probability + integrity score (bounded) ─────────────────────────
  const tamperProbability = predictTamperProbability(model, feat.x, feat.heuristicAnomaly);
  let score = clamp(1 - tamperProbability, 0, 1);

  // Confidence proxy: distance from 0.5 (closer = less confident)
  const confidence = clamp(Math.abs(score - 0.5) * 2, 0, 1);

  const caps = {
    scoreCap: M01A_ML_CONSTANTS.GUARDRAILS.scoreCap,
    abstainThreshold: M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold,
    maxTimelineEvents: 0, // feature extractor handles this implicitly; schema tracks it elsewhere
  } as const;

  // Abstain if low confidence (never enforce)
  const abstain = confidence < M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold;
  if (abstain) score = 0.5;

  // Cap score
  score = Math.min(score, M01A_ML_CONSTANTS.GUARDRAILS.scoreCap);

  const status: IntegrityStatus = abstain
    ? 'UNKNOWN'
    : tamperProbability >= 0.92
      ? 'TAMPERED'
      : tamperProbability >= 0.60
        ? 'UNVERIFIED'
        : 'VERIFIED';

  const topFactors = rankTopFactors(feat.featureNames, feat.x, model.weights, feat.flags, abstain);
  const recommendation = buildRecommendation(score, status, feat.flags, abstain);

  // ── ReplayIntegrityScore envelope (auditable, bounded) ─────────────────────
  const replayIntegrityScore: ReplayIntegrityScoreV1 = {
    version: 'pzo:m01a:replay_integrity_score:v1',
    status,
    anomalyScore: clamp(feat.heuristicAnomaly, 0, 1),
    confidence,
    schemaHashOk: true,
    consentLimited,
    actionCount: Array.isArray((redacted as any).actionTimeline) ? (redacted as any).actionTimeline.length : 0,
    flags: takeFirst(
      [
        ...(abstain ? ['ABSTAIN_LOW_CONFIDENCE'] : []),
        ...(consentLimited ? ['CONSENT_LIMITED'] : []),
        ...feat.flags,
      ],
      32,
    ),
    reasons: takeFirst(buildReasons(status, feat.flags, consentLimited, abstain), 12),
    caps,
  };

  // ── Audit hash (bind inputs+features+outputs+caps+model identity) ──────────
  const auditPayload = {
    schema: 'pzo:ml:m01a:audit:v1',
    mlId: M01A_ML_CONSTANTS.ML_ID,
    tier,
    model: {
      modelVersion: modelCard.modelVersion,
      trainCutDate: modelCard.trainCutDate,
      featureSchemaHash: computedFeatureSchemaHash,
      rulesetVersion: modelCard.rulesetVersion,
      step: model.step,
    },
    input: {
      runId,
      runSeed: input.runSeed,
      tickIndex: input.tickIndex,
      rulesetVersion: input.rulesetVersion,
      macroRegime: input.macroRegime,
      consentLimited,
      redactedInputHash32: hf.sha256(`pzo:ml:m01a:redacted_input:${hashRedactedPayload(redacted)}`).slice(0, 32),
    },
    features: {
      schemaVersion: feat.schemaVersion,
      x: feat.x,
      flags: feat.flags,
      heuristicAnomaly: feat.heuristicAnomaly,
    },
    output: {
      status,
      score,
      tamperProbability,
      confidence,
      replayIntegrityScore,
    },
    caps,
  };

  const auditHash = hf.sha256(`pzo:ml:m01a:audit:${canonicalJson(auditPayload)}`).slice(0, 64);

  // ── Signed receipt (optional HMAC) ─────────────────────────────────────────
  const { key: hmacKey, keyId } = getMlHmacKey();
  const signedAt = Date.now();

  const receiptBase: Omit<SignedReceiptV1, 'signatureAlg' | 'signature' | 'keyId'> = {
    version: 'pzo:m01a:signed_receipt:v1',
    mlId: 'M01A',
    corePair: 'M01',
    runId,
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rulesetVersion: input.rulesetVersion,
    tier,
    modelVersion: modelCard.modelVersion,
    featureSchemaHash: computedFeatureSchemaHash,
    rulesetVersionResolved: modelCard.rulesetVersion,
    auditHash,
    score,
    tamperProbability,
    status,
    signedAt,
    step: model.step,
  };

  const signature = hmacKey ? hmacSha256Maybe(hf, `pzo:ml:m01a:receipt:${canonicalJson(receiptBase)}`, hmacKey) : undefined;

  const signedReceipt: SignedReceiptV1 = signature
    ? {
        ...receiptBase,
        signatureAlg: 'HMAC-SHA256',
        signature,
        keyId: keyId || 'default',
      }
    : {
        ...receiptBase,
        signatureAlg: 'UNSIGNED',
      };

  // ── Persist observation (safe: numeric features + bounded outputs only) ─────
  // If persistence is unavailable in a given runtime, inference still succeeds.
  try {
    const store = new MLStore();
    store.insertObservation({
      ml_id: 'M01A',
      tier,
      run_id: runId,
      tick_index: input.tickIndex,
      features_json: JSON.stringify(feat.x),
      output_json: JSON.stringify({
        score,
        tamperProbability,
        status,
        confidence,
        flags: replayIntegrityScore.flags,
        heuristicAnomaly: feat.heuristicAnomaly,
        step: model.step,
      }),
      audit_hash: auditHash,
      created_at: signedAt,
    });
  } catch {
    // no-throw: persistence may be disabled in some embeddings/tests
  }

  return {
    score,
    topFactors,
    recommendation,
    auditHash,
    replayIntegrityScore,
    tamperProbability,
    impossibleSequenceFlags: replayIntegrityScore.flags,
    signedReceipt,
  };
}

// =============================================================================
// Fallback (never throws)
// =============================================================================

export function runM01aMlFallback(input: M01ATelemetryInput): M01AOutput {
  const hf = new HashFunction();

  const runId = input.runId ?? input.runSeed;
  const consentLimited = true;

  const redacted = redactLikelyPII({
    runId,
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rulesetVersion: input.rulesetVersion,
    macroRegime: input.macroRegime,
    portfolioSnapshot: input.portfolioSnapshot ?? {},
    actionTimeline: input.actionTimeline ?? [],
    uiInteraction: {},
    socialEvents: [],
    outcomeEvents: input.outcomeEvents ?? [],
    ledgerEvents: [],
    contractGraph: {},
    userOptIn: input.userOptIn ?? {},
    tickSnapshots: input.tickSnapshots ?? [],
    expectedTickCount: input.expectedTickCount ?? 0,
  });

  const feat = extractM01AFeatures({
    actionTimeline: (redacted as any).actionTimeline ?? [],
    tickSnapshots: (redacted as any).tickSnapshots ?? [],
    expectedTickCount: (redacted as any).expectedTickCount ?? 0,
    macroRegime: (redacted as any).macroRegime ?? '',
  });

  const tamperProbability = clamp(0.10 + (feat.heuristicAnomaly * 0.85), 0.001, 0.999);
  const score = clamp(1 - tamperProbability, 0, 1);
  const confidence = clamp(Math.abs(score - 0.5) * 2, 0, 1);

  const status: IntegrityStatus =
    tamperProbability >= 0.92 ? 'TAMPERED' : tamperProbability >= 0.60 ? 'UNVERIFIED' : 'UNKNOWN';

  const caps = {
    scoreCap: 1.0,
    abstainThreshold: M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold,
    maxTimelineEvents: 0,
  } as const;

  const replayIntegrityScore: ReplayIntegrityScoreV1 = {
    version: 'pzo:m01a:replay_integrity_score:v1',
    status,
    anomalyScore: clamp(feat.heuristicAnomaly, 0, 1),
    confidence,
    schemaHashOk: false,
    consentLimited,
    actionCount: Array.isArray((redacted as any).actionTimeline) ? (redacted as any).actionTimeline.length : 0,
    flags: takeFirst(['ML_FALLBACK', ...feat.flags], 32),
    reasons: takeFirst(buildReasons(status, feat.flags, consentLimited, false), 12),
    caps,
  };

  const auditPayload = {
    schema: 'pzo:ml:m01a:fallback_audit:v1',
    mlId: 'M01A',
    runId,
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rulesetVersion: input.rulesetVersion,
    redactedInputHash32: hf.sha256(`pzo:ml:m01a:redacted_input:${hashRedactedPayload(redacted)}`).slice(0, 32),
    features: { schemaVersion: feat.schemaVersion, x: feat.x, flags: feat.flags, heuristicAnomaly: feat.heuristicAnomaly },
    output: { score, tamperProbability, status, confidence, caps },
  };

  const auditHash = hf.sha256(`pzo:ml:m01a:audit:${canonicalJson(auditPayload)}`).slice(0, 64);

  const signedReceipt: SignedReceiptV1 = {
    version: 'pzo:m01a:signed_receipt:v1',
    mlId: 'M01A',
    corePair: 'M01',
    runId,
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rulesetVersion: input.rulesetVersion,
    tier: 'baseline',
    modelVersion: 'fallback',
    featureSchemaHash: 'fallback',
    rulesetVersionResolved: input.rulesetVersion,
    auditHash,
    score,
    tamperProbability,
    status,
    signatureAlg: 'UNSIGNED',
    signedAt: Date.now(),
    step: 0,
  };

  return {
    score,
    topFactors: takeFirst(['ML unavailable — fallback active', ...feat.flags], 5),
    recommendation: 'Use deterministic integrity pipeline for enforcement; ML fallback is advisory only.',
    auditHash,
    replayIntegrityScore,
    tamperProbability,
    impossibleSequenceFlags: replayIntegrityScore.flags,
    signedReceipt,
  };
}

// =============================================================================
// Abstain output (schema mismatch / hard gate)
// =============================================================================

function buildAbstainOutput(
  hf: HashFunction,
  input: M01ATelemetryInput,
  tier: M01ATier,
  modelCard: Omit<M01AModelCard, 'modelId' | 'coreMechanicPair'>,
  ctx: {
    computedFeatureSchemaHash: string;
    expectedFeatureSchemaHash: string;
    consentLimited: boolean;
    reason: string;
  },
): M01AOutput {
  const runId = input.runId ?? input.runSeed;

  const caps = {
    scoreCap: M01A_ML_CONSTANTS.GUARDRAILS.scoreCap,
    abstainThreshold: M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold,
    maxTimelineEvents: 0,
  } as const;

  const replayIntegrityScore: ReplayIntegrityScoreV1 = {
    version: 'pzo:m01a:replay_integrity_score:v1',
    status: 'UNKNOWN',
    anomalyScore: 0.5,
    confidence: 0.0,
    schemaHashOk: false,
    consentLimited: ctx.consentLimited,
    actionCount: Array.isArray(input.actionTimeline) ? input.actionTimeline.length : 0,
    flags: ['ABSTAIN_SCHEMA_MISMATCH'],
    reasons: [ctx.reason],
    caps,
  };

  const auditPayload = {
    schema: 'pzo:ml:m01a:abstain_audit:v1',
    mlId: 'M01A',
    tier,
    runId,
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rulesetVersion: input.rulesetVersion,
    model: {
      modelVersion: modelCard.modelVersion,
      trainCutDate: modelCard.trainCutDate,
      rulesetVersion: modelCard.rulesetVersion,
      expectedFeatureSchemaHash: ctx.expectedFeatureSchemaHash,
      computedFeatureSchemaHash: ctx.computedFeatureSchemaHash,
    },
    reason: ctx.reason,
    caps,
  };

  const auditHash = hf.sha256(`pzo:ml:m01a:audit:${canonicalJson(auditPayload)}`).slice(0, 64);

  const signedReceipt: SignedReceiptV1 = {
    version: 'pzo:m01a:signed_receipt:v1',
    mlId: 'M01A',
    corePair: 'M01',
    runId,
    runSeed: input.runSeed,
    tickIndex: input.tickIndex,
    rulesetVersion: input.rulesetVersion,
    tier,
    modelVersion: modelCard.modelVersion,
    featureSchemaHash: ctx.computedFeatureSchemaHash,
    rulesetVersionResolved: modelCard.rulesetVersion,
    auditHash,
    score: 0.5,
    tamperProbability: 0.5,
    status: 'UNKNOWN',
    signatureAlg: 'UNSIGNED',
    signedAt: Date.now(),
    step: 0,
  };

  return {
    score: 0.5,
    topFactors: takeFirst(['Abstain: schema mismatch', ctx.reason], 5),
    recommendation: 'Abstained — do not enforce; run deterministic integrity verification.',
    auditHash,
    replayIntegrityScore,
    tamperProbability: 0.5,
    impossibleSequenceFlags: replayIntegrityScore.flags,
    signedReceipt,
  };
}

// =============================================================================
// Helpers (deterministic, bounded)
// =============================================================================

function takeFirst<T>(arr: readonly T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  return arr.slice(0, n) as T[];
}

function rankTopFactors(
  names: readonly string[],
  x: readonly number[],
  w: readonly number[],
  flags: readonly string[],
  abstain: boolean,
): string[] {
  const scored: { k: string; v: number }[] = [];

  const m = Math.min(names.length, x.length, w.length);
  for (let i = 0; i < m; i++) {
    const contrib = Math.abs((x[i] ?? 0) * (w[i] ?? 0));
    if (contrib > 1e-10) scored.push({ k: `${names[i]} contribution`, v: contrib });
  }

  for (const f of flags) scored.push({ k: `Flag: ${f}`, v: 9.0 });
  if (abstain) scored.push({ k: 'Abstain: low-confidence signal', v: 10.0 });

  scored.sort((a, b) => b.v - a.v);

  const out: string[] = [];
  for (const s of scored) {
    out.push(s.k);
    if (out.length >= 5) break;
  }

  if (out.length === 0) out.push('No significant integrity factors detected');
  return out;
}

function buildRecommendation(
  score: number,
  status: IntegrityStatus,
  flags: readonly string[],
  abstain: boolean,
): string {
  if (abstain) return 'Insufficient confidence — route to deterministic verification; do not rank.';
  if (status === 'TAMPERED') return 'Reject run for ranking; quarantine proof; require server replay verification and key audit.';
  if (status === 'UNVERIFIED') return 'Keep run unranked; route to review queue; require deterministic replay verification.';
  if (flags.includes('TICK_GAP') || flags.includes('DUP_TICK_HASH')) {
    return 'High-risk integrity flags — keep unranked until deterministic verification passes.';
  }
  if (score >= 0.85) return 'Integrity looks strong — proceed normally; attach receipt to proof artifacts.';
  if (score >= 0.60) return 'Minor anomalies — proceed but keep unranked until verification completes.';
  return 'Suspicious patterns — require deterministic verification; consider human review if repeated.';
}

function buildReasons(
  status: IntegrityStatus,
  flags: readonly string[],
  consentLimited: boolean,
  abstain: boolean,
): string[] {
  const reasons: string[] = [];

  if (abstain) reasons.push('Low-confidence — abstained (advisory only).');
  if (consentLimited) reasons.push('Telemetry consent limited; confidence may be reduced.');
  if (status === 'TAMPERED') reasons.push('Tamper probability exceeded hard threshold.');
  if (status === 'UNVERIFIED') reasons.push('Suspicious patterns exceed review threshold.');
  if (status === 'VERIFIED') reasons.push('No significant integrity anomalies detected.');

  for (const f of flags) {
    if (f === 'TICK_GAP') reasons.push('Tick snapshot gaps detected (possible missing/edited frames).');
    if (f === 'DUP_TICK_HASH') reasons.push('Duplicate tick hashes detected (possible replay splice).');
    if (f === 'FAST_BURST') reasons.push('High-frequency burst action timing detected.');
    if (f === 'DUP_ACTION_SIGNATURES') reasons.push('Duplicate action signatures detected (possible injected sequence).');
    if (f === 'NET_WORTH_JUMP') reasons.push('Large net-worth jumps detected (possible economy violation).');
    if (f === 'SHIELD_JUMP') reasons.push('Large shield recovery jumps detected (possible state tamper).');
    if (f === 'HATER_HEAT_JUMP') reasons.push('Large hater heat jumps detected (possible telemetry spoof).');
  }

  if (reasons.length === 0) reasons.push('No additional reasons provided.');
  return reasons;
}

function getMlHmacKey(): { key: string; keyId: string } {
  const env = safeEnv();
  const key = env['PZO_ML_HMAC_KEY'] ?? '';
  const keyId = env['PZO_ML_HMAC_KEY_ID'] ?? 'default';
  return { key, keyId };
}

function safeEnv(): Record<string, string | undefined> {
  try {
    const p = (globalThis as any).process;
    if (p && p.env && typeof p.env === 'object') return p.env as Record<string, string | undefined>;
  } catch {
    // ignore
  }
  return {};
}

function hmacSha256Maybe(hf: HashFunction, payload: string, key: string): string {
  const anyHf = hf as any;
  if (typeof anyHf.hmacSha256 === 'function') return String(anyHf.hmacSha256(payload, key));
  // Fallback: still deterministic, but UNSIGNED should be used if no HMAC exists.
  return hf.sha256(`pzo:ml:m01a:weak_sig:${key}:${payload}`);
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM01aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)