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

import { clamp, computeHash, RUN_TOTAL_TICKS, seededIndex } from '../mechanics/mechanicsUtils';
import { HashFunction } from '../integrity/hash-function';

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
  // Extended inputs for M01A (integrity family)
}

// ── Primary output contract ───────────────────────────────────────────────────
export interface M01ABaseOutput {
  score: number; // 0–1, semantic depends on mechanic
  topFactors: string[];
  recommendation: string;
  auditHash: string; // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M01AOutput extends M01ABaseOutput {
  replayIntegrityScore: unknown; // replay_integrity_score
  tamperProbability: unknown; // tamper_probability
  impossibleSequenceFlags: unknown; // impossible_sequence_flags
  signedReceipt: unknown; // signed_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M01ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

export interface M01ABaselineConfig {
  enabled: boolean;
  modelVersion: string;
  featureSchemaHash: string;
  latencySLOMs: number; // 0 = batch/async
}

export interface M01ASequenceDlConfig {
  enabled: boolean;
  modelVersion: string;
  featureSchemaHash: string;
  latencySLOMs: number; // 0 = batch/async
}

export interface M01APolicyRlConfig {
  enabled: boolean;
  modelVersion: string;
  featureSchemaHash: string;
  latencySLOMs: number; // 0 = batch/async
}

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
  featureSchemaHash: string;
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
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

type IntegrityStatus = 'VERIFIED' | 'UNVERIFIED' | 'TAMPERED' | 'UNKNOWN';

interface ReplayIntegrityScoreV1 {
  version: 'pzo:m01a:replay_integrity_score:v1';
  status: IntegrityStatus;
  anomalyScore: number; // 0..1 (higher = more suspicious)
  confidence: number; // 0..1
  seedShapeOk: boolean;
  tickShapeOk: boolean;
  rulesetShapeOk: boolean;
  macroRegimeShapeOk: boolean;
  schemaHashOk: boolean;
  consentLimited: boolean;
  actionCount: number;
  timelineSampled: boolean;
  proofCommitmentHash: string; // sha256( seed + canonicalActions + rulesetVersion + caps )
  signatureCheck: {
    attempted: boolean;
    keyPresent: boolean;
    checked: number;
    invalid: number;
    missing: number;
  };
  reasons: string[]; // bounded
  flags: string[]; // bounded
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
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  tier: M01ATier;
  modelVersion: string;
  featureSchemaHash: string;
  auditHash: string; // sha256(...)
  proofCommitmentHash: string; // sha256(...)
  score: number; // 0..1
  tamperProbability: number; // 0..1
  status: IntegrityStatus;
  signatureAlg: 'HMAC-SHA256' | 'UNSIGNED';
  signature?: string; // hex
}

// ── Helpers: canonical JSON + privacy filtering ───────────────────────────────
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function canonicalizeJsonValue(v: unknown): JsonValue {
  if (v === null) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(canonicalizeJsonValue);
  if (!isPlainObject(v)) return String(v) as JsonValue;

  const out: Record<string, JsonValue> = {};
  for (const k of Object.keys(v).sort()) out[k] = canonicalizeJsonValue(v[k]);
  return out;
}

function canonicalJson(obj: unknown): string {
  return JSON.stringify(canonicalizeJsonValue(obj));
}

function stripPII(obj: unknown): unknown {
  // Deterministic, conservative PII stripping by key name only.
  const denyKey = (k: string) => {
    const s = k.toLowerCase();
    return (
      s.includes('email') ||
      s.includes('phone') ||
      s.includes('ip') ||
      s.includes('address') ||
      s.includes('ssn') ||
      s.includes('dob') ||
      s.includes('passport') ||
      s.includes('credit') ||
      s.includes('card_number') ||
      s.includes('cardnumber') ||
      s.includes('pan') ||
      s.includes('lat') ||
      s.includes('lng') ||
      s.includes('gps') ||
      s.includes('geolocation')
    );
  };

  const rec = (v: unknown): unknown => {
    if (v === null) return null;
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(rec);
    if (!isPlainObject(v)) return String(v);

    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      if (denyKey(k)) continue;
      out[k] = rec(v[k]);
    }
    return out;
  };

  return rec(obj);
}

function takeFirst<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  return arr.slice(0, n);
}

function deterministicSample<T>(arr: T[], max: number, seed: string): { items: T[]; sampled: boolean } {
  if (arr.length <= max) return { items: arr, sampled: false };
  if (max <= 0) return { items: [], sampled: true };

  // Deterministic reservoir-like sampling: pick evenly spaced indices + a seed-jitter.
  const jitter = seededIndex(seed || 'm01a', arr.length, Math.max(1, Math.min(arr.length, 997)));
  const step = arr.length / max;

  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.min(arr.length - 1, Math.floor(i * step + (jitter % Math.max(1, Math.floor(step)))));
    out.push(arr[idx]);
  }
  return { items: out, sampled: true };
}

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function safeString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  return null;
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

function logistic01(x: number): number {
  // stable enough for our bounded input ranges
  return 1 / (1 + Math.exp(-x));
}

// ── Forensics: ledger signature verification (optional) ────────────────────────
function computeActionAuditHashV1(hash: HashFunction, action: unknown): string {
  // Mirrors pzo_engine/src/integrity/signed-actions.ts:
  // auditHash = SHA-256('pzo:action:v1:' + canonicalJson(action)).slice(0,32)
  return hash.sha256(`pzo:action:v1:${canonicalJson(action)}`).slice(0, 32);
}

function buildSigningPayloadV1(hash: HashFunction, action: unknown): string {
  const auditHash = computeActionAuditHashV1(hash, action);
  return canonicalJson({ action: canonicalizeJsonValue(action), auditHash });
}

function tryVerifyLedgerEvents(
  hash: HashFunction,
  ledgerEvents: Record<string, unknown>[] | undefined,
  key: string | undefined,
  seed: string,
): ReplayIntegrityScoreV1['signatureCheck'] & { invalidReasons: string[] } {
  const base = {
    attempted: false,
    keyPresent: !!(key && key.length >= 16),
    checked: 0,
    invalid: 0,
    missing: 0,
    invalidReasons: [] as string[],
  };

  if (!ledgerEvents || ledgerEvents.length === 0) return base;

  // Only attempt if we have a key; otherwise mark unknown (not an error).
  base.attempted = true;
  if (!base.keyPresent) return base;

  // Heuristic: any event that looks like { action: {...}, signature: 'hex' }.
  for (const ev of ledgerEvents) {
    const action = (ev as Record<string, unknown>).action;
    const sig = (ev as Record<string, unknown>).signature;

    const hasAction = action !== undefined;
    const hasSig = typeof sig === 'string' && sig.length >= 32;

    if (!hasAction && !hasSig) continue;

    if (!hasSig) {
      base.missing += 1;
      continue;
    }
    if (!hasAction) {
      base.invalid += 1;
      base.invalidReasons.push('ledger_event_missing_action');
      continue;
    }

    const payload = buildSigningPayloadV1(hash, action);
    const ok = hash.verifyHmacSha256(payload, String(sig), String(key));
    base.checked += 1;

    if (!ok) {
      base.invalid += 1;
      // Deterministic reason token (no PII)
      base.invalidReasons.push(`sig_mismatch:${computeHash(seed + ':' + base.checked).slice(0, 8)}`);
    }
  }

  return base;
}

// ── Forensics: action timeline anomaly detection ───────────────────────────────
interface TimelineStats {
  actionCount: number;
  uniqueTypeCount: number;
  duplicateRate: number;
  outOfOrderTicks: number;
  duplicateTicks: number;
  timeReversalCount: number;
  implausibleDecisionCount: number;
  burstRate: number; // fraction of ticks with very high action count
  periodicityScore: number; // 0..1 (higher = suspiciously regular)
  entropyScore: number; // 0..1 (lower entropy can be suspicious)
  flags: string[];
  reasons: string[];
}

function extractActionType(a: Record<string, unknown>): string {
  const candidates = [
    a.type,
    a.actionType,
    a.kind,
    a.event,
    a.name,
    a.id,
    a.cardId,
    a.op,
    a.operation,
  ];
  for (const c of candidates) {
    const s = safeString(c);
    if (s && s.length > 0) return s;
  }
  // deterministic fallback: hash of sorted keys
  return `unknown:${computeHash(Object.keys(a).sort().join('|')).slice(0, 8)}`;
}

function extractTick(a: Record<string, unknown>): number | null {
  const candidates = [a.tickIndex, a.tick, a.t, a.turn, a.step];
  for (const c of candidates) {
    const n = safeNumber(c);
    if (n !== null) return Math.floor(n);
  }
  return null;
}

function extractTimestamp(a: Record<string, unknown>): number | null {
  const candidates = [a.timestamp, a.ts, a.time, a.at, a.ms];
  for (const c of candidates) {
    const n = safeNumber(c);
    if (n !== null) return Math.floor(n);
  }
  return null;
}

function extractDecisionFields(a: Record<string, unknown>): { windowMs: number | null; resolvedInMs: number | null; wasAuto: boolean | null } {
  const windowMs = safeNumber(a.decisionWindowMs ?? a.windowMs ?? a.window ?? a.deadlineMs ?? a.timeoutMs);
  const resolvedInMs = safeNumber(a.resolvedInMs ?? a.resolveMs ?? a.latencyMs ?? a.elapsedMs);
  const wasAutoRaw = a.wasAutoResolved ?? a.autoResolved ?? a.autopick ?? a.auto;
  const wasAuto = typeof wasAutoRaw === 'boolean' ? wasAutoRaw : null;
  return { windowMs: windowMs !== null ? Math.floor(windowMs) : null, resolvedInMs: resolvedInMs !== null ? Math.floor(resolvedInMs) : null, wasAuto };
}

function shannonEntropy(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p <= 0) continue;
    h -= p * Math.log2(p);
  }
  return h;
}

function computeTimelineStats(actions: Record<string, unknown>[], seed: string): TimelineStats {
  const flags: string[] = [];
  const reasons: string[] = [];

  const actionCount = actions.length;
  if (actionCount === 0) {
    flags.push('empty_action_timeline');
    reasons.push('No actions recorded (possible disconnect or telemetry disabled).');
    return {
      actionCount: 0,
      uniqueTypeCount: 0,
      duplicateRate: 0,
      outOfOrderTicks: 0,
      duplicateTicks: 0,
      timeReversalCount: 0,
      implausibleDecisionCount: 0,
      burstRate: 0,
      periodicityScore: 0,
      entropyScore: 0,
      flags,
      reasons,
    };
  }

  const typeCounts = new Map<string, number>();
  const seenActionFingerprints = new Map<string, number>();

  let outOfOrderTicks = 0;
  let duplicateTicks = 0;
  let timeReversalCount = 0;
  let implausibleDecisionCount = 0;

  let lastTick: number | null = null;
  let lastTs: number | null = null;

  const perTickCounts = new Map<number, number>();
  const tsDeltas: number[] = [];

  for (const a of actions) {
    const t = extractActionType(a);
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);

    const tick = extractTick(a);
    if (tick !== null) {
      perTickCounts.set(tick, (perTickCounts.get(tick) ?? 0) + 1);
      if (lastTick !== null && tick < lastTick) outOfOrderTicks += 1;
      if (lastTick !== null && tick === lastTick) duplicateTicks += 1;
      lastTick = tick;
    }

    const ts = extractTimestamp(a);
    if (ts !== null) {
      if (lastTs !== null) {
        const d = ts - lastTs;
        if (d < 0) timeReversalCount += 1;
        else tsDeltas.push(d);
      }
      lastTs = ts;
    }

    const dec = extractDecisionFields(a);
    if (dec.windowMs !== null && dec.resolvedInMs !== null) {
      // impossible if negative, or resolved exceeds window by huge margin, or resolved "too fast" at scale.
      if (dec.windowMs < 0 || dec.resolvedInMs < 0) implausibleDecisionCount += 1;
      if (dec.resolvedInMs > dec.windowMs + 60_000) implausibleDecisionCount += 1; // +60s grace
      if (dec.resolvedInMs === 0 && dec.windowMs >= 5_000 && dec.wasAuto === false) implausibleDecisionCount += 1;
    }

    // fingerprint duplicates (exact canonical object)
    const fp = computeHash(canonicalJson(a));
    seenActionFingerprints.set(fp, (seenActionFingerprints.get(fp) ?? 0) + 1);
  }

  const uniqueTypeCount = typeCounts.size;
  const duplicateFp = Array.from(seenActionFingerprints.values()).reduce((acc, c) => acc + Math.max(0, c - 1), 0);
  const duplicateRate = actionCount > 0 ? duplicateFp / actionCount : 0;

  // Burstiness: ticks with unusually high action count (macro spam / injected sequences)
  const tickCounts = Array.from(perTickCounts.values());
  const maxPerTick = tickCounts.length ? Math.max(...tickCounts) : 0;
  const burstTicks = tickCounts.filter(c => c >= 20).length; // 20+ actions in one tick is extreme for real-time input
  const burstRate = tickCounts.length ? burstTicks / tickCounts.length : 0;
  if (maxPerTick >= 40) flags.push('extreme_actions_single_tick');

  // Periodicity: suspiciously regular inter-action timing
  let periodicityScore = 0;
  if (tsDeltas.length >= 8) {
    // Compute coefficient of variation; low variance => suspiciously periodic
    const mean = tsDeltas.reduce((a, b) => a + b, 0) / tsDeltas.length;
    const varr = tsDeltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / tsDeltas.length;
    const sd = Math.sqrt(varr);
    const cv = mean > 0 ? sd / mean : 1;
    periodicityScore = clamp01(1 - clamp(cv, 0, 1)); // cv≈0 => 1 (very periodic)
    if (periodicityScore >= 0.85) flags.push('highly_periodic_timing');
  }

  // Entropy: very low action-type entropy can indicate scripted replay
  const probs = Array.from(typeCounts.values()).map(c => c / actionCount);
  const ent = shannonEntropy(probs);
  const maxEnt = Math.log2(Math.max(1, uniqueTypeCount));
  const entNorm = maxEnt > 0 ? ent / maxEnt : 0;
  const entropyScore = clamp01(entNorm); // 0..1 (higher = healthier variety)
  if (entropyScore <= 0.15 && actionCount >= 30) flags.push('low_action_entropy');

  if (outOfOrderTicks > 0) flags.push('tick_order_violation');
  if (timeReversalCount > 0) flags.push('timestamp_reversal');
  if (duplicateRate > 0.15) flags.push('high_duplicate_actions');
  if (implausibleDecisionCount > 0) flags.push('implausible_decision_timings');
  if (burstRate > 0.10) flags.push('burst_action_rate');

  // Reasons (bounded)
  if (flags.includes('tick_order_violation')) reasons.push(`Action ticks out-of-order (${outOfOrderTicks}).`);
  if (flags.includes('timestamp_reversal')) reasons.push(`Action timestamps move backwards (${timeReversalCount}).`);
  if (flags.includes('high_duplicate_actions')) reasons.push(`Duplicate action payloads detected (${Math.round(duplicateRate * 100)}%).`);
  if (flags.includes('burst_action_rate')) reasons.push(`Burst action density across ticks (rate ${(burstRate * 100).toFixed(1)}%).`);
  if (flags.includes('low_action_entropy')) reasons.push(`Action pattern entropy extremely low (${entropyScore.toFixed(2)}).`);

  // Deterministic additional reason token to ensure stability if empty
  if (reasons.length === 0) reasons.push(`Timeline looks structurally plausible (fp=${computeHash(seed + ':ok').slice(0, 6)}).`);

  return {
    actionCount,
    uniqueTypeCount,
    duplicateRate,
    outOfOrderTicks,
    duplicateTicks,
    timeReversalCount,
    implausibleDecisionCount,
    burstRate,
    periodicityScore,
    entropyScore,
    flags,
    reasons,
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────
interface ScoreComponents {
  anomalyScore: number; // 0..1 (higher = worse)
  tamperProbability: number; // 0..1 (higher = worse)
  confidence: number; // 0..1
  status: IntegrityStatus;
  topFactors: string[];
  recommendation: string;
}

function computeSchemaHash(hash: HashFunction, input: M01ATelemetryInput): string {
  // Hash only the shape (keys), not values.
  const shape = {
    keys: Object.keys(input).sort(),
    portfolioKeys: Object.keys(input.portfolioSnapshot ?? {}).sort(),
    uiKeys: Object.keys(input.uiInteraction ?? {}).sort(),
    optInKeys: Object.keys(input.userOptIn ?? {}).sort(),
    timelineKeys:
      input.actionTimeline && input.actionTimeline.length > 0 ? Object.keys(input.actionTimeline[0] ?? {}).sort() : [],
  };
  return hash.sha256(`pzo:m01a:schema:v1:${canonicalJson(shape)}`).slice(0, 32);
}

function computeConfidence(input: M01ATelemetryInput, timelineStats: TimelineStats, signatureCheck: ReplayIntegrityScoreV1['signatureCheck']): number {
  let c = 0;

  // Required fields present?
  if (typeof input.runSeed === 'string' && input.runSeed.length >= 8) c += 0.20;
  if (typeof input.rulesetVersion === 'string' && input.rulesetVersion.length > 0) c += 0.15;
  if (Number.isFinite(input.tickIndex)) c += 0.10;
  if (Array.isArray(input.actionTimeline)) c += 0.10;

  // Timeline richness
  if (timelineStats.actionCount >= 10) c += 0.15;
  if (timelineStats.actionCount >= 50) c += 0.10;
  if (timelineStats.uniqueTypeCount >= 5) c += 0.05;

  // Signature checks (only increases confidence if actually checked with key)
  if (signatureCheck.attempted && signatureCheck.keyPresent && signatureCheck.checked >= 5) c += 0.15;

  return clamp01(c);
}

function scoreFromSignals(
  input: M01ATelemetryInput,
  tier: M01ATier,
  modelCard: Omit<M01AModelCard, 'modelId' | 'coreMechanicPair'>,
  timelineStats: TimelineStats,
  schemaHashOk: boolean,
  consentLimited: boolean,
  signatureCheck: ReplayIntegrityScoreV1['signatureCheck'] & { invalidReasons?: string[] },
): ScoreComponents {
  // Base anomaly score from deterministic checks.
  let anomaly = 0;

  // Seed shape checks (not cryptographic validity)
  const seedOk = typeof input.runSeed === 'string' && /^[0-9a-fA-F]+$/.test(input.runSeed) && input.runSeed.length >= 8;
  if (!seedOk) anomaly += 0.35;

  // Tick checks
  const tickOk =
    Number.isFinite(input.tickIndex) &&
    input.tickIndex >= 0 &&
    input.tickIndex <= RUN_TOTAL_TICKS * 2; // allow post-run hooks
  if (!tickOk) anomaly += 0.25;

  // Ruleset checks
  const rulesetOk = typeof input.rulesetVersion === 'string' && input.rulesetVersion.trim().length > 0;
  if (!rulesetOk) anomaly += 0.25;

  // Macro regime shape checks
  const regimeOk =
    typeof input.macroRegime === 'string' &&
    ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'].includes(input.macroRegime.toUpperCase());
  if (!regimeOk) anomaly += 0.10;

  // Schema hash mismatch is suspicious in production (telemetry drift)
  if (!schemaHashOk) anomaly += 0.12;

  // Timeline structural anomalies
  if (timelineStats.flags.includes('tick_order_violation')) anomaly += 0.35;
  if (timelineStats.flags.includes('timestamp_reversal')) anomaly += 0.25;
  if (timelineStats.flags.includes('high_duplicate_actions')) anomaly += clamp01(0.10 + timelineStats.duplicateRate);
  if (timelineStats.flags.includes('burst_action_rate')) anomaly += clamp01(0.10 + timelineStats.burstRate);
  if (timelineStats.flags.includes('extreme_actions_single_tick')) anomaly += 0.20;
  if (timelineStats.flags.includes('implausible_decision_timings')) anomaly += 0.20;
  if (timelineStats.flags.includes('highly_periodic_timing')) anomaly += 0.15;

  // Low entropy is weak evidence; weight depends on tier.
  if (timelineStats.flags.includes('low_action_entropy')) {
    anomaly += tier === 'baseline' ? 0.10 : tier === 'sequence_dl' ? 0.18 : 0.14;
  }

  // Consent-limited telemetry: lower confidence, but NOT automatically suspicious.
  if (consentLimited) anomaly += 0.00;

  // Ledger signature verification results (if available)
  const sigAttempted = signatureCheck.attempted && signatureCheck.keyPresent;
  if (sigAttempted) {
    if (signatureCheck.invalid > 0) anomaly += clamp01(0.30 + signatureCheck.invalid / Math.max(1, signatureCheck.checked));
    if (signatureCheck.missing > 0) anomaly += clamp01(0.12 + signatureCheck.missing / Math.max(1, signatureCheck.checked + signatureCheck.missing));
  }

  anomaly = clamp01(anomaly);

  // Convert anomaly -> tamperProbability with thresholds aligned to replay-validator.ts
  // ≥0.85 hard tamper; ≥0.30 suspicious.
  const tamperProb = clamp01(0.02 + 0.98 * logistic01(6.0 * (anomaly - 0.35)));

  const confidence = computeConfidence(input, timelineStats, signatureCheck);

  // Abstain policy: if low confidence, return neutral.
  const abstain = confidence < M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold;

  let status: IntegrityStatus = 'UNKNOWN';
  if (abstain) status = 'UNKNOWN';
  else if (anomaly >= 0.85 || tamperProb >= 0.92) status = 'TAMPERED';
  else if (anomaly >= 0.30 || tamperProb >= 0.60) status = 'UNVERIFIED';
  else status = 'VERIFIED';

  // Score is inverse tamper probability (integrity confidence)
  let score = abstain ? 0.5 : clamp01(1 - tamperProb);

  // Guardrail cap
  score = Math.min(score, M01A_ML_CONSTANTS.GUARDRAILS.scoreCap);

  // Top factors (bounded, deterministic)
  const factors: string[] = [];

  if (abstain) {
    factors.push('Insufficient telemetry confidence (abstain).');
  } else {
    factors.push(`Integrity status: ${status}.`);
  }

  if (!schemaHashOk) factors.push('Telemetry schema hash mismatch (drift).');
  if (timelineStats.flags.includes('tick_order_violation')) factors.push('Tick ordering violation in action stream.');
  if (timelineStats.flags.includes('timestamp_reversal')) factors.push('Timestamp reversal in action stream.');
  if (timelineStats.flags.includes('high_duplicate_actions')) factors.push('High duplicate action payload rate.');
  if (timelineStats.flags.includes('burst_action_rate')) factors.push('Burst-rate action density detected.');
  if (sigAttempted && signatureCheck.invalid > 0) factors.push('Ledger action signature mismatch.');

  // Fill to deterministic minimum if empty
  if (factors.length === 0) factors.push('No integrity anomalies detected.');

  const topFactors = takeFirst(factors, 5);

  const recommendation =
    status === 'TAMPERED'
      ? 'Reject run for ranking; require server-side re-validation and key audit.'
      : status === 'UNVERIFIED'
        ? 'Accept run as recorded, but exclude from ranked ladders; send to review queue.'
        : status === 'VERIFIED'
          ? 'Accept run for ranking; attach integrity receipt to proof artifacts.'
          : 'Record run as unranked; request fuller telemetry or server verification.';

  return {
    anomalyScore: anomaly,
    tamperProbability: tamperProb,
    confidence,
    status,
    topFactors,
    recommendation,
  };
}

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM01aMl
 *
 * Fires after M01 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M01AOutput with signed auditHash
 */
export async function runM01aMl(
  input: M01ATelemetryInput,
  tier: M01ATier = 'baseline',
  modelCard: Omit<M01AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M01AOutput> {
  try {
    const hash = new HashFunction();

    // ── Consent gating (privacy law) ─────────────────────────────────────────
    // Integrity can run without optional telemetry; but we must not mine non-consented sources.
    const optIn = input.userOptIn ?? {};
    const allowUI = optIn.ui !== false && optIn.uiInteraction !== false;
    const allowSocial = optIn.social !== false && optIn.socialEvents !== false;
    const allowContract = optIn.contract !== false && optIn.contractGraph !== false;
    const allowLedger = optIn.ledger !== false && optIn.ledgerEvents !== false;

    const consentLimited = !(allowUI && allowSocial && allowContract && allowLedger);

    // ── Privacy filter (no PII) ──────────────────────────────────────────────
    // Always strip PII by key name; also drop entire sections if not opted-in.
    const safeInput: M01ATelemetryInput = {
      ...input,
      portfolioSnapshot: (stripPII(input.portfolioSnapshot) ?? {}) as Record<string, unknown>,
      actionTimeline: (stripPII(input.actionTimeline) ?? []) as Record<string, unknown>[],
      uiInteraction: (allowUI ? (stripPII(input.uiInteraction) ?? {}) : {}) as Record<string, unknown>,
      socialEvents: (allowSocial ? (stripPII(input.socialEvents) ?? []) : []) as Record<string, unknown>[],
      outcomeEvents: (stripPII(input.outcomeEvents) ?? []) as Record<string, unknown>[],
      ledgerEvents: (allowLedger ? ((stripPII(input.ledgerEvents ?? []) ?? []) as Record<string, unknown>[]) : undefined) as
        | Record<string, unknown>[]
        | undefined,
      contractGraph: (allowContract ? (stripPII(input.contractGraph ?? {}) ?? {}) : undefined) as Record<string, unknown> | undefined,
      userOptIn: (stripPII(input.userOptIn) ?? {}) as Record<string, boolean>,
    };

    // ── Schema hash validation ───────────────────────────────────────────────
    const computedSchemaHash = computeSchemaHash(hash, safeInput);
    const schemaHashOk =
      typeof modelCard.featureSchemaHash === 'string' &&
      modelCard.featureSchemaHash.length > 0 &&
      computedSchemaHash === modelCard.featureSchemaHash;

    // ── Timeline sampling (real-time budget) ─────────────────────────────────
    const MAX_TIMELINE_EVENTS = 2500; // hard cap to preserve real-time budget
    const sampled = deterministicSample(safeInput.actionTimeline ?? [], MAX_TIMELINE_EVENTS, safeInput.runSeed ?? 'm01a');
    const timeline = sampled.items;

    // ── Timeline stats (impossible sequence flags) ───────────────────────────
    const timelineStats = computeTimelineStats(timeline, safeInput.runSeed ?? 'm01a');

    // ── Optional signature verification (server-only; requires key) ─────────
    const key =
      (typeof process !== 'undefined' && (process as unknown as { env?: Record<string, string | undefined> }).env
        ? (process as unknown as { env: Record<string, string | undefined> }).env.PZO_INTEGRITY_HMAC_KEY ||
          (process as unknown as { env: Record<string, string | undefined> }).env.PZO_HMAC_KEY ||
          (process as unknown as { env: Record<string, string | undefined> }).env.PZO_SIGNING_KEY
        : undefined) ?? undefined;

    const sigCheck = tryVerifyLedgerEvents(hash, safeInput.ledgerEvents, key, safeInput.runSeed ?? 'm01a');

    // ── Proof commitment hash (tamper-evident, deterministic) ────────────────
    // Commitment schema: SHA-256('pzo:m01a:commit:v1:' + seed + ':' + ruleset + ':' + canonicalActions + ':' + caps)
    const canonicalActions = canonicalJson(timeline);
    const commitmentCaps = {
      scoreCap: M01A_ML_CONSTANTS.GUARDRAILS.scoreCap,
      abstainThreshold: M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold,
      maxTimelineEvents: MAX_TIMELINE_EVENTS,
    };
    const proofCommitmentHash = hash.sha256(
      `pzo:m01a:commit:v1:${safeInput.runSeed}:${safeInput.rulesetVersion}:${canonicalActions}:${canonicalJson(commitmentCaps)}`,
    );

    // ── Scoring ─────────────────────────────────────────────────────────────
    const scored = scoreFromSignals(
      safeInput,
      tier,
      modelCard,
      timelineStats,
      schemaHashOk,
      consentLimited,
      sigCheck,
    );

    // ── ReplayIntegrityScore envelope ───────────────────────────────────────
    const replayIntegrityScore: ReplayIntegrityScoreV1 = {
      version: 'pzo:m01a:replay_integrity_score:v1',
      status: scored.status,
      anomalyScore: clamp01(scored.anomalyScore),
      confidence: clamp01(scored.confidence),
      seedShapeOk: typeof safeInput.runSeed === 'string' && safeInput.runSeed.length >= 8,
      tickShapeOk: Number.isFinite(safeInput.tickIndex) && safeInput.tickIndex >= 0 && safeInput.tickIndex <= RUN_TOTAL_TICKS * 2,
      rulesetShapeOk: typeof safeInput.rulesetVersion === 'string' && safeInput.rulesetVersion.trim().length > 0,
      macroRegimeShapeOk:
        typeof safeInput.macroRegime === 'string' && ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'].includes(safeInput.macroRegime.toUpperCase()),
      schemaHashOk,
      consentLimited,
      actionCount: timelineStats.actionCount,
      timelineSampled: sampled.sampled,
      proofCommitmentHash,
      signatureCheck: {
        attempted: sigCheck.attempted,
        keyPresent: sigCheck.keyPresent,
        checked: sigCheck.checked,
        invalid: sigCheck.invalid,
        missing: sigCheck.missing,
      },
      reasons: takeFirst(
        [
          ...timelineStats.reasons,
          ...(sigCheck.keyPresent && sigCheck.invalid > 0 ? [`Ledger signature failures: ${sigCheck.invalid}.`] : []),
          ...(schemaHashOk ? [] : [`Schema hash mismatch: expected=${modelCard.featureSchemaHash} got=${computedSchemaHash}`]),
        ],
        8,
      ),
      flags: takeFirst(
        [
          ...timelineStats.flags,
          ...(sigCheck.keyPresent && sigCheck.invalid > 0 ? ['ledger_signature_invalid'] : []),
          ...(sigCheck.keyPresent && sigCheck.missing > 0 ? ['ledger_signature_missing'] : []),
          ...(schemaHashOk ? [] : ['telemetry_schema_mismatch']),
          ...(consentLimited ? ['consent_limited_telemetry'] : []),
        ],
        12,
      ),
      caps: commitmentCaps,
    };

    // ── Audit hash (must bind inputs + outputs + ruleset + caps) ─────────────
    const auditPayload = {
      mlId: M01A_ML_CONSTANTS.ML_ID,
      tier,
      model: {
        modelVersion: modelCard.modelVersion,
        featureSchemaHash: modelCard.featureSchemaHash,
        trainCutDate: modelCard.trainCutDate,
        rulesetVersion: modelCard.rulesetVersion,
      },
      input: {
        runSeed: safeInput.runSeed,
        tickIndex: safeInput.tickIndex,
        rulesetVersion: safeInput.rulesetVersion,
        macroRegime: safeInput.macroRegime,
        // do NOT include raw portfolio snapshots; only include a deterministic commitment
        portfolioCommit: hash.sha256(`pzo:m01a:portfolio:v1:${canonicalJson(safeInput.portfolioSnapshot)}`).slice(0, 32),
        actionTimelineCommit: hash.sha256(`pzo:m01a:timeline:v1:${canonicalActions}`).slice(0, 32),
        outcomeCommit: hash.sha256(`pzo:m01a:outcome:v1:${canonicalJson(safeInput.outcomeEvents)}`).slice(0, 32),
        consentLimited,
      },
      output: {
        status: replayIntegrityScore.status,
        anomalyScore: replayIntegrityScore.anomalyScore,
        confidence: replayIntegrityScore.confidence,
        score: Math.min(1 - scored.tamperProbability, M01A_ML_CONSTANTS.GUARDRAILS.scoreCap),
        tamperProbability: clamp01(scored.tamperProbability),
        proofCommitmentHash: replayIntegrityScore.proofCommitmentHash,
        flags: replayIntegrityScore.flags,
      },
      caps: commitmentCaps,
    };

    const auditHash = hash.sha256(`pzo:m01a:audit:v1:${canonicalJson(auditPayload)}`);

    // ── Signed receipt (server key optional, deterministic) ──────────────────
    const receiptBase: Omit<SignedReceiptV1, 'signatureAlg' | 'signature'> = {
      version: 'pzo:m01a:signed_receipt:v1',
      mlId: 'M01A',
      corePair: 'M01',
      runSeed: safeInput.runSeed,
      tickIndex: safeInput.tickIndex,
      rulesetVersion: safeInput.rulesetVersion,
      tier,
      modelVersion: modelCard.modelVersion,
      featureSchemaHash: modelCard.featureSchemaHash,
      auditHash,
      proofCommitmentHash: replayIntegrityScore.proofCommitmentHash,
      score: clamp01(Math.min(1 - scored.tamperProbability, M01A_ML_CONSTANTS.GUARDRAILS.scoreCap)),
      tamperProbability: clamp01(scored.tamperProbability),
      status: replayIntegrityScore.status,
    };

    let signedReceipt: SignedReceiptV1 = { ...receiptBase, signatureAlg: 'UNSIGNED' };
    const keyPresent = typeof key === 'string' && key.length >= 16;
    if (keyPresent) {
      const receiptPayload = canonicalJson(receiptBase);
      const signature = hash.hmacSha256(`pzo:m01a:receipt:v1:${receiptPayload}`, key!);
      signedReceipt = {
        ...receiptBase,
        signatureAlg: 'HMAC-SHA256',
        signature,
      };
    }

    // ── Output contract ──────────────────────────────────────────────────────
    return {
      score: clamp01(receiptBase.score),
      topFactors: takeFirst(scored.topFactors, 5),
      recommendation: scored.recommendation,
      auditHash,
      replayIntegrityScore,
      tamperProbability: clamp01(scored.tamperProbability),
      impossibleSequenceFlags: takeFirst(replayIntegrityScore.flags, 32),
      signedReceipt,
    };
  } catch (err) {
    // Must never throw.
    return runM01aMlFallback(input);
  }
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM01aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M01AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM01aMlFallback(input: M01ATelemetryInput): M01AOutput {
  try {
    const hash = new HashFunction();

    const safe = stripPII(input) as unknown as M01ATelemetryInput;
    const seed = (safe?.runSeed as string) ?? '';
    const tick = (safe?.tickIndex as number) ?? 0;
    const ruleset = (safe?.rulesetVersion as string) ?? '';

    const fallbackCaps = {
      scoreCap: M01A_ML_CONSTANTS.GUARDRAILS.scoreCap,
      abstainThreshold: M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold,
      maxTimelineEvents: 0,
    };

    const proofCommitmentHash = hash.sha256(`pzo:m01a:fallback:commit:v1:${seed}:${tick}:${ruleset}:${canonicalJson(fallbackCaps)}`);
    const auditHash = hash.sha256(
      `pzo:m01a:fallback:audit:v1:${canonicalJson({
        seed,
        tick,
        ruleset,
        caps: fallbackCaps,
        // deterministic reason token
        fp: computeHash(String(seed) + ':' + String(tick) + ':fallback'),
      })}`,
    );

    const replayIntegrityScore: ReplayIntegrityScoreV1 = {
      version: 'pzo:m01a:replay_integrity_score:v1',
      status: 'UNKNOWN',
      anomalyScore: 0.5,
      confidence: 0.0,
      seedShapeOk: typeof seed === 'string' && seed.length >= 8,
      tickShapeOk: Number.isFinite(tick),
      rulesetShapeOk: typeof ruleset === 'string' && ruleset.trim().length > 0,
      macroRegimeShapeOk: false,
      schemaHashOk: false,
      consentLimited: true,
      actionCount: Array.isArray(safe?.actionTimeline) ? safe.actionTimeline.length : 0,
      timelineSampled: false,
      proofCommitmentHash,
      signatureCheck: { attempted: false, keyPresent: false, checked: 0, invalid: 0, missing: 0 },
      reasons: ['ML unavailable — rule-based fallback active.'],
      flags: ['ml_unavailable_fallback'],
      caps: fallbackCaps,
    };

    const signedReceipt: SignedReceiptV1 = {
      version: 'pzo:m01a:signed_receipt:v1',
      mlId: 'M01A',
      corePair: 'M01',
      runSeed: seed,
      tickIndex: tick,
      rulesetVersion: ruleset,
      tier: 'baseline',
      modelVersion: 'fallback',
      featureSchemaHash: 'fallback',
      auditHash,
      proofCommitmentHash,
      score: 0.5,
      tamperProbability: 0.5,
      status: 'UNKNOWN',
      signatureAlg: 'UNSIGNED',
    };

    return {
      score: 0.5,
      topFactors: ['ML unavailable — rule-based fallback active'],
      recommendation: 'Record run as unranked; request server verification.',
      auditHash,
      replayIntegrityScore,
      tamperProbability: 0.5,
      impossibleSequenceFlags: replayIntegrityScore.flags,
      signedReceipt,
    };
  } catch {
    // Absolute last-resort: deterministic minimal output (no throws).
    const seed = (input?.runSeed as string) ?? '';
    const auditHash = computeHash(`${seed}:${String(input?.tickIndex ?? 0)}:m01a:fallback:min`);
    return {
      score: 0.5,
      topFactors: ['ML unavailable — minimal fallback active'],
      recommendation: 'Record run as unranked; request server verification.',
      auditHash,
      replayIntegrityScore: { status: 'UNKNOWN', anomalyScore: 0.5, flags: ['minimal_fallback'] },
      tamperProbability: 0.5,
      impossibleSequenceFlags: ['minimal_fallback'],
      signedReceipt: { signatureAlg: 'UNSIGNED', auditHash },
    };
  }
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM01aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)