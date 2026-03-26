/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SNAPSHOT ADAPTER SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/SnapshotAdapterSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates SovereigntySnapshotAdapter signals —
 * tick record creation, run summary generation, CORD scoring, delta computation,
 * ML/DL vectors, and audit entries — into authoritative backend-chat ingress
 * envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the SovereigntySnapshotAdapter creates a tick record, generates a run
 *    summary, computes a CORD score, derives a snapshot delta, emits an ML/DL
 *    vector, or records an audit entry, what exact chat-native signal should the
 *    authoritative backend chat engine ingest to drive companion NPC coaching
 *    and reflect snapshot adapter status in the companion AI?"
 *
 * This file owns:
 * - Tick record created   → ChatSignalEnvelope (snapshot.tick_record.created)
 * - Run summary generated → ChatSignalEnvelope (snapshot.run_summary.generated)
 * - CORD score computed   → ChatSignalEnvelope (snapshot.cord.scored)
 * - Snapshot delta        → ChatSignalEnvelope (snapshot.delta.computed)
 * - ML vector emitted     → ChatSignalEnvelope (snapshot.ml.vector_emitted)
 * - DL tensor emitted     → ChatSignalEnvelope (snapshot.dl.tensor_emitted)
 * - Audit entry           → ChatSignalEnvelope (snapshot.audit.entry)
 *
 * It does not own:
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 * - Shield layer integrity, repair scheduling, or run phase management
 * - Proof generation, export pipelines, or artifact building
 * - Any circular import from core/ — all core types mirrored structurally
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types mirrored structurally.
 * - High CORD scores (>= threshold) always accepted — milestone events.
 * - CRITICAL audit entries always accepted (helperBlackout for QUARANTINED).
 * - ML/DL vector signals only emitted when the respective flag is enabled.
 * - All runtime functions (asUnixMs, clamp01, clamp100) called in runtime.
 *
 * Event vocabulary
 * ----------------
 *   snapshot.tick_record.created    — tick record committed to snapshot
 *   snapshot.run_summary.generated  — run summary derived from snapshot state
 *   snapshot.cord.scored            — CORD score computed from run data
 *   snapshot.delta.computed         — snapshot delta between two points
 *   snapshot.ml.vector_emitted      — ML feature vector extracted
 *   snapshot.dl.tensor_emitted      — DL input tensor constructed
 *   snapshot.audit.entry            — audit trail entry recorded
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ============================================================================
// SECTION 1 — STRUCTURAL COMPAT INTERFACES
// ============================================================================

/** Mirror of TickRecord from sovereignty/SovereigntySnapshotAdapter.ts */
export interface TickRecordCompat {
  readonly recordId: string;
  readonly runId: string;
  readonly userId: string;
  readonly tick: number;
  readonly phase: string;
  readonly mode: string;
  readonly netWorth: number;
  readonly shieldIntegrity: number;
  readonly sovereigntyScore: number;
  readonly pressureLevel: number;
  readonly threatCount: number;
  readonly economyHealth: number;
  readonly timestamp: number;
  readonly checksum: string;
}

/** Mirror of RunSummary from sovereignty/SovereigntySnapshotAdapter.ts */
export interface RunSummaryCompat {
  readonly summaryId: string;
  readonly runId: string;
  readonly userId: string;
  readonly mode: string;
  readonly outcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  readonly grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  readonly totalTicks: number;
  readonly peakNetWorth: number;
  readonly finalNetWorth: number;
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly averagePressure: number;
  readonly shieldBreaches: number;
  readonly generatedAtMs: number;
  readonly checksum: string;
}

/** Mirror of SnapshotDelta from sovereignty/SovereigntySnapshotAdapter.ts */
export interface SnapshotDeltaCompat {
  readonly deltaId: string;
  readonly runId: string;
  readonly fromTick: number;
  readonly toTick: number;
  readonly netWorthChange: number;
  readonly sovereigntyChange: number;
  readonly shieldChange: number;
  readonly pressureChange: number;
  readonly economyChange: number;
  readonly threatCountChange: number;
  readonly tickSpan: number;
  readonly computedAtMs: number;
  readonly checksum: string;
}

/** Mirror of AdapterMLVector from sovereignty/SovereigntySnapshotAdapter.ts */
export interface AdapterMLVectorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly extractedAtMs: number;
}

/** Mirror of AdapterDLTensor from sovereignty/SovereigntySnapshotAdapter.ts */
export interface AdapterDLTensorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly shape: readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Mirror of AdapterAuditEntry from sovereignty/SovereigntySnapshotAdapter.ts */
export interface AdapterAuditEntryCompat {
  readonly entryId: string;
  readonly runId: string;
  readonly tick: number;
  readonly eventType: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly message: string;
  readonly integrityStatus: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly hmacSignature: string;
  readonly capturedAtMs: number;
}

// ============================================================================
// SECTION 2 — ADAPTER TYPES
// ============================================================================

/** Optional per-call routing context passed to adapt* methods. */
export interface SnapshotAdapterSignalContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/** Logger interface — implement with any backend logger or leave null. */
export interface SnapshotAdapterSignalLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

/** Clock interface — injectable for tests. */
export interface SnapshotAdapterSignalClock { now(): UnixMs; }

/** Severity classification for adapter events. */
export type SnapshotAdapterSignalSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';

/** Full set of snapshot adapter signal event names. */
export type SnapshotAdapterSignalEventName =
  | 'snapshot.tick_record.created' | 'snapshot.run_summary.generated'
  | 'snapshot.cord.scored' | 'snapshot.delta.computed'
  | 'snapshot.ml.vector_emitted' | 'snapshot.dl.tensor_emitted'
  | 'snapshot.audit.entry' | string;

/** Construction options for SnapshotAdapterSignalAdapter. */
export interface SnapshotAdapterSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly alwaysAcceptHighCord?: boolean;
  readonly alwaysAcceptFreedom?: boolean;
  readonly alwaysAcceptCriticalAudit?: boolean;
  readonly suppressLowPrioritySignals?: boolean;
  readonly emitMLVectors?: boolean;
  readonly emitDLTensors?: boolean;
  readonly highSovereigntyThreshold?: number;
  readonly cordScoreHighThreshold?: number;
  readonly highPressureThreshold?: number;
  readonly logger?: SnapshotAdapterSignalLogger;
  readonly clock?: SnapshotAdapterSignalClock;
}

/** Cumulative stats reported by getStats(). */
export interface SnapshotAdapterSignalStats {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalDeduped: number;
  readonly tickRecordsAdapted: number;
  readonly runSummariesAdapted: number;
  readonly cordScoresAdapted: number;
  readonly deltasAdapted: number;
  readonly auditEntriesAdapted: number;
  readonly mlVectorsEmitted: number;
  readonly dlTensorsEmitted: number;
  readonly highCordCount: number;
  readonly criticalAuditCount: number;
  readonly freedomOutcomeCount: number;
  readonly highPressureCount: number;
}

// ============================================================================
// SECTION 3 — MODULE CONSTANTS
// ============================================================================

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD = 80;
const DEFAULT_CORD_HIGH_THRESHOLD = 0.85;
const DEFAULT_HIGH_PRESSURE_THRESHOLD = 0.75;
const SRC = 'SnapshotAdapterSignalAdapter';

const GRADE_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  S: 100, A: 95, B: 75, C: 55, D: 40, F: 85,
});
const OUTCOME_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  FREEDOM: 90, TIMEOUT: 50, BANKRUPT: 80, ABANDONED: 30,
});
const AUDIT_SEV_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25,
});
const PHASE_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRISIS: 95, ENDGAME: 85, MIDGAME: 60, EARLYGAME: 45, SETUP: 30,
});
const NULL_LOGGER: SnapshotAdapterSignalLogger = Object.freeze({
  debug() {}, warn() {}, error() {},
});
const SYS_CLOCK: SnapshotAdapterSignalClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ============================================================================
// SECTION 4 — SEVERITY / HEAT CLASSIFIERS
// ============================================================================

function tickSeverity(pres: number, sov: number, thresh: number): SnapshotAdapterSignalSeverity {
  if (pres >= 0.9 || sov <= 10) return 'CRITICAL';
  if (pres >= thresh || sov <= 30) return 'WARN';
  if (pres >= 0.4 || sov <= 60) return 'INFO';
  return 'DEBUG';
}
function gradeSeverity(g: string): SnapshotAdapterSignalSeverity {
  if (g === 'F') return 'CRITICAL';
  if (g === 'D') return 'WARN';
  if (g === 'S' || g === 'A' || g === 'B' || g === 'C') return 'INFO';
  return 'DEBUG';
}
function auditSeverity(s: string): SnapshotAdapterSignalSeverity {
  if (s === 'CRITICAL') return 'CRITICAL';
  if (s === 'HIGH') return 'WARN';
  if (s === 'MEDIUM') return 'INFO';
  return 'DEBUG';
}
function tickHeat(pres: number, sov: number): Score01 {
  const pf = clamp01(pres); const sd = clamp01(1 - sov / 100);
  return clamp01((pf as number) * 0.6 + (sd as number) * 0.4);
}
function summaryHeat(g: string, o: string): Score01 {
  return clamp01(((GRADE_PRIORITY[g] ?? 50) / 100) * 0.6 + ((OUTCOME_PRIORITY[o] ?? 40) / 100) * 0.4);
}
function cordHeat(cs: number, g: string): Score01 {
  return clamp01((clamp01(cs) as number) * 0.5 + ((GRADE_PRIORITY[g] ?? 50) / 100) * 0.5);
}
function deltaHeat(nw: number, sov: number, pres: number): Score01 {
  const mn = clamp01(Math.abs(nw) / 10_000);
  const ms = clamp01(Math.abs(sov) / 50);
  const mp = clamp01(Math.abs(pres));
  return clamp01((mn as number) * 0.3 + (ms as number) * 0.4 + (mp as number) * 0.3);
}

// ============================================================================
// SECTION 5 — UX MESSAGE HELPERS
// ============================================================================

export function tickRecordHeadline(tick: number, phase: string): string {
  return `Tick ${tick} snapshot recorded — phase: ${phase}.`;
}
export function tickRecordCoachingMessage(tick: number, phase: string, pres: number, sov: number): string {
  const sp = Math.round(sov), pp = Math.round(pres * 100);
  if (pres >= 0.85) return `Tick ${tick} in ${phase}: pressure ${pp}%, sovereignty ${sp}%. Shields under duress — prioritize defense.`;
  if (sov >= 80)    return `Tick ${tick} in ${phase}: sovereignty ${sp}%, pressure ${pp}%. Strong standing — maintain discipline.`;
  if (sov <= 30)    return `Tick ${tick} in ${phase}: sovereignty ${sp}%, pressure ${pp}%. Critical deficit — act now.`;
  return `Tick ${tick} in ${phase}: sovereignty ${sp}%, pressure ${pp}%. Monitor shield integrity.`;
}
export function runSummaryHeadline(outcome: string, grade: string): string {
  return `Run summary generated — Grade ${grade}, outcome: ${outcome}.`;
}
export function runSummaryCoachingMessage(outcome: string, grade: string, sov: number, cord: number): string {
  const sp = Math.round(sov), cf = cord.toFixed(3);
  if (outcome === 'FREEDOM') return `FREEDOM achieved at Grade ${grade}, ${sp}% sovereignty, CORD ${cf}. Financial independence confirmed.`;
  if (grade === 'S' || grade === 'A') return `Grade ${grade} summary at ${sp}% sovereignty, CORD ${cf}. Excellent discipline.`;
  if (grade === 'B' || grade === 'C') return `Grade ${grade} summary at ${sp}% sovereignty, CORD ${cf}. Tighten shield management.`;
  return `Grade ${grade} summary at ${sp}% sovereignty, CORD ${cf}. Study pressure exposure and timing.`;
}
export function cordScoreHeadline(cs: number, grade: string): string {
  return `CORD score computed — ${cs.toFixed(3)} at Grade ${grade}.`;
}
export function cordScoreCoachingMessage(cs: number, grade: string): string {
  const cf = cs.toFixed(3);
  if (cs >= 0.9) return `CORD ${cf} at Grade ${grade}: exceptional consistency, resilience, and discipline.`;
  if (cs >= 0.7) return `CORD ${cf} at Grade ${grade}: strong fundamentals — optimize shield timing.`;
  if (cs >= 0.5) return `CORD ${cf} at Grade ${grade}: acceptable but inconsistent — review pressure patterns.`;
  return `CORD ${cf} at Grade ${grade}: significant gaps — analyze tick-by-tick data.`;
}
export function snapshotDeltaHeadline(from: number, to: number): string {
  return `Snapshot delta computed — ticks ${from} to ${to}.`;
}
export function snapshotDeltaCoachingMessage(nwc: number, sovc: number, span: number): string {
  const nwDir = nwc >= 0 ? 'gained' : 'lost', sovDir = sovc >= 0 ? 'gained' : 'lost';
  return `Over ${span} ticks: ${nwDir} ${Math.abs(Math.round(nwc))} net worth, ${sovDir} ${Math.abs(Math.round(sovc * 10) / 10)} sovereignty. ${sovc < -5 ? 'Sovereignty declining — review defensive posture.' : 'Track trajectory.'}`;
}
export function snapshotAuditHeadline(sev: string, evType: string): string {
  return `Snapshot audit — ${sev} severity, event: ${evType}.`;
}
export function snapshotCriticalAuditCoaching(evType: string): string {
  return `CRITICAL audit entry in snapshot adapter: ${evType}. Snapshot integrity may be compromised.`;
}

// ============================================================================
// SECTION 6 — ENVELOPE BUILDER
// ============================================================================

function buildEnvelope(
  eventName: string, roomId: ChatRoomId | string | null,
  heat: Score01, blackout: boolean, meta: Record<string, JsonValue>, now: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS' as const, emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({ worldEventName: eventName, heatMultiplier01: heat, helperBlackout: blackout, haterRaidActive: false }),
    metadata: Object.freeze(meta),
  });
}

// ============================================================================
// SECTION 7 — SnapshotAdapterSignalAdapter CLASS
// ============================================================================

export class SnapshotAdapterSignalAdapter {
  private readonly opts: Readonly<Required<SnapshotAdapterSignalAdapterOptions>>;
  private readonly log: SnapshotAdapterSignalLogger;
  private readonly clk: SnapshotAdapterSignalClock;
  private readonly _hist: ChatSignalEnvelope[] = [];
  private readonly _dup: Map<string, UnixMs> = new Map();

  private _adapted = 0; private _suppressed = 0; private _deduped = 0;
  private _ticks = 0; private _summaries = 0; private _cords = 0; private _deltas = 0;
  private _audits = 0; private _mlVecs = 0; private _dlTens = 0;
  private _hiCord = 0; private _critAudit = 0; private _freedom = 0; private _hiPres = 0;

  public constructor(o: SnapshotAdapterSignalAdapterOptions) {
    this.log = o.logger ?? NULL_LOGGER;
    this.clk = o.clock  ?? SYS_CLOCK;
    this.opts = Object.freeze({
      defaultRoomId: o.defaultRoomId,
      defaultVisibleChannel:     o.defaultVisibleChannel      ?? 'GLOBAL',
      dedupeWindowMs:            o.dedupeWindowMs             ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory:                o.maxHistory                 ?? DEFAULT_MAX_HISTORY,
      alwaysAcceptHighCord:      o.alwaysAcceptHighCord       ?? true,
      alwaysAcceptFreedom:       o.alwaysAcceptFreedom        ?? true,
      alwaysAcceptCriticalAudit: o.alwaysAcceptCriticalAudit  ?? true,
      suppressLowPrioritySignals: o.suppressLowPrioritySignals ?? true,
      emitMLVectors:             o.emitMLVectors              ?? false,
      emitDLTensors:             o.emitDLTensors              ?? false,
      highSovereigntyThreshold:  o.highSovereigntyThreshold   ?? DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
      cordScoreHighThreshold:    o.cordScoreHighThreshold     ?? DEFAULT_CORD_HIGH_THRESHOLD,
      highPressureThreshold:     o.highPressureThreshold      ?? DEFAULT_HIGH_PRESSURE_THRESHOLD,
      logger: this.log, clock: this.clk,
    } as Required<SnapshotAdapterSignalAdapterOptions>);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private isDup(k: string, now: UnixMs): boolean {
    const l = this._dup.get(k);
    return l !== undefined && (now - (l as unknown as number)) < this.opts.dedupeWindowMs;
  }
  private accept(k: string, env: ChatSignalEnvelope, now: UnixMs): void {
    this._dup.set(k, now); this._adapted++;
    this._hist.push(env);
    if (this._hist.length > this.opts.maxHistory) this._hist.shift();
  }
  private sup(reason: string, d: Record<string, JsonValue>): null {
    this._suppressed++; this.log.debug(`${SRC}: suppressed — ${reason}`, d); return null;
  }
  private dup(ev: string, k: string): null {
    this._deduped++; this.log.debug(`${SRC}: deduped`, { eventName: ev, key: k }); return null;
  }
  private room(c?: SnapshotAdapterSignalContext): ChatRoomId | string {
    return (c?.roomId ?? this.opts.defaultRoomId) as ChatRoomId | string;
  }
  private chan(c?: SnapshotAdapterSignalContext): ChatVisibleChannel {
    return c?.routeChannel ?? this.opts.defaultVisibleChannel;
  }
  private tags(base: string[], c?: SnapshotAdapterSignalContext): string[] {
    return [SRC, ...base, ...(c?.tags ?? [])];
  }

  // ── Public adapt* ──────────────────────────────────────────────────────────

  /** Adapt a TickRecord into a snapshot.tick_record.created envelope. */
  public adaptTickRecordCreated(record: TickRecordCompat, ctx?: SnapshotAdapterSignalContext): ChatSignalEnvelope | null {
    const now = this.clk.now(), rm = this.room(ctx);
    const ev: SnapshotAdapterSignalEventName = 'snapshot.tick_record.created';
    const dk = `snapshot.tick:${record.runId}:${String(record.tick)}`;
    if (this.isDup(dk, now)) return this.dup(ev, dk);

    const sov100 = clamp100(record.sovereigntyScore);
    const pres   = clamp01(record.pressureLevel);
    const sev    = tickSeverity(record.pressureLevel, record.sovereigntyScore, this.opts.highPressureThreshold);
    const ht     = tickHeat(record.pressureLevel, record.sovereigntyScore);
    const hiSov  = sov100 >= this.opts.highSovereigntyThreshold;
    const hiP    = (pres as number) >= this.opts.highPressureThreshold;
    const bp     = PHASE_PRIORITY[record.phase] ?? 50;

    const payload: Record<string, JsonValue> = {
      recordId: record.recordId, runId: record.runId, userId: record.userId,
      tick: record.tick, phase: record.phase, mode: record.mode,
      netWorth: Math.round(record.netWorth),
      shieldIntegrity: parseFloat((clamp01(record.shieldIntegrity) as number).toFixed(6)),
      sovereigntyScore100: sov100, pressureLevel01: parseFloat((pres as number).toFixed(6)),
      threatCount: record.threatCount,
      economyHealth01: parseFloat((clamp01(record.economyHealth) as number).toFixed(6)),
      checksum: record.checksum, timestamp: record.timestamp,
      adaptedAtMs: now as unknown as number, eventName: ev,
      channel: this.chan(ctx) as unknown as string,
      priority: hiSov ? Math.min(bp + 15, 100) : bp,
      adapterSeverity: sev, isHighSovereignty: hiSov, isHighPressure: hiP,
      tickHeadline: tickRecordHeadline(record.tick, record.phase),
      tickCoaching: tickRecordCoachingMessage(record.tick, record.phase, record.pressureLevel, record.sovereigntyScore),
      source: ctx?.source ?? SRC,
      tags: this.tags(['tick', record.phase.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };
    const envelope = buildEnvelope(ev, rm, ht, sev === 'CRITICAL', payload, now);
    this.accept(dk, envelope, now); this._ticks++;
    if (hiP) this._hiPres++;
    this.log.debug(`${SRC}: ${ev} accepted`, { runId: record.runId, tick: record.tick as unknown as JsonValue });
    return envelope;
  }

  /** Adapt a RunSummary into a snapshot.run_summary.generated envelope. */
  public adaptRunSummaryGenerated(summary: RunSummaryCompat, ctx?: SnapshotAdapterSignalContext): ChatSignalEnvelope | null {
    const now = this.clk.now(), rm = this.room(ctx);
    const ev: SnapshotAdapterSignalEventName = 'snapshot.run_summary.generated';
    const dk = `snapshot.summary:${summary.runId}:${summary.summaryId}`;
    const isAA = summary.outcome === 'FREEDOM' && this.opts.alwaysAcceptFreedom;
    if (!isAA && this.isDup(dk, now)) return this.dup(ev, dk);

    const cord01 = clamp01(summary.cordScore);
    const sov100 = clamp100(summary.sovereigntyScore);
    const sev = gradeSeverity(summary.grade);
    const ht  = summaryHeat(summary.grade, summary.outcome);
    const hiSov = sov100 >= this.opts.highSovereigntyThreshold;
    const bp = GRADE_PRIORITY[summary.grade] ?? 55;

    const payload: Record<string, JsonValue> = {
      summaryId: summary.summaryId, runId: summary.runId, userId: summary.userId,
      mode: summary.mode, outcome: summary.outcome, grade: summary.grade,
      totalTicks: summary.totalTicks, peakNetWorth: Math.round(summary.peakNetWorth),
      finalNetWorth: Math.round(summary.finalNetWorth), sovereigntyScore100: sov100,
      cordScore01: parseFloat((cord01 as number).toFixed(6)),
      averagePressure01: parseFloat((clamp01(summary.averagePressure) as number).toFixed(6)),
      shieldBreaches: summary.shieldBreaches, checksum: summary.checksum,
      generatedAtMs: summary.generatedAtMs, adaptedAtMs: now as unknown as number,
      eventName: ev, channel: this.chan(ctx) as unknown as string,
      priority: hiSov ? Math.min(bp + 10, 100) : bp,
      adapterSeverity: sev, isHighSovereignty: hiSov, isFreedom: summary.outcome === 'FREEDOM',
      summaryHeadline: runSummaryHeadline(summary.outcome, summary.grade),
      summaryCoaching: runSummaryCoachingMessage(summary.outcome, summary.grade, summary.sovereigntyScore, summary.cordScore),
      source: ctx?.source ?? SRC,
      tags: this.tags(['summary', summary.outcome.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };
    const envelope = buildEnvelope(ev, rm, ht, summary.grade === 'F', payload, now);
    this.accept(dk, envelope, now); this._summaries++;
    if (summary.outcome === 'FREEDOM') this._freedom++;
    this.log.debug(`${SRC}: ${ev} accepted`, { runId: summary.runId, grade: summary.grade });
    return envelope;
  }

  /** Adapt a CORD score computation into a snapshot.cord.scored envelope. */
  public adaptCordScoreComputed(cordScore: number, grade: string, ctx?: SnapshotAdapterSignalContext): ChatSignalEnvelope | null {
    const now = this.clk.now(), rm = this.room(ctx);
    const ev: SnapshotAdapterSignalEventName = 'snapshot.cord.scored';
    const c01 = clamp01(cordScore);
    const dk = `snapshot.cord:${(c01 as number).toFixed(4)}:${grade}`;
    const hiC = (c01 as number) >= this.opts.cordScoreHighThreshold;
    const isAA = hiC && this.opts.alwaysAcceptHighCord;
    if (!isAA && this.isDup(dk, now)) return this.dup(ev, dk);

    const ht = cordHeat(cordScore, grade);
    const sev: SnapshotAdapterSignalSeverity = hiC ? 'INFO' : 'DEBUG';
    const payload: Record<string, JsonValue> = {
      cordScore01: parseFloat((c01 as number).toFixed(6)), cordScoreRaw: parseFloat(cordScore.toFixed(6)),
      grade, adaptedAtMs: now as unknown as number, eventName: ev,
      channel: this.chan(ctx) as unknown as string,
      priority: hiC ? 85 : (GRADE_PRIORITY[grade] ?? 55),
      adapterSeverity: sev, isHighCord: hiC,
      cordHeadline: cordScoreHeadline(cordScore, grade),
      cordCoaching: cordScoreCoachingMessage(cordScore, grade),
      source: ctx?.source ?? SRC,
      tags: this.tags(['cord', grade.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };
    const envelope = buildEnvelope(ev, rm, ht, false, payload, now);
    this.accept(dk, envelope, now); this._cords++;
    if (hiC) this._hiCord++;
    this.log.debug(`${SRC}: ${ev} accepted`, { cordScore01: parseFloat((c01 as number).toFixed(6)), grade });
    return envelope;
  }

  /** Adapt a SnapshotDelta into a snapshot.delta.computed envelope. */
  public adaptSnapshotDelta(delta: SnapshotDeltaCompat, ctx?: SnapshotAdapterSignalContext): ChatSignalEnvelope | null {
    const now = this.clk.now(), rm = this.room(ctx);
    const ev: SnapshotAdapterSignalEventName = 'snapshot.delta.computed';
    const dk = `snapshot.delta:${delta.runId}:${String(delta.fromTick)}:${String(delta.toTick)}`;
    if (this.isDup(dk, now)) return this.dup(ev, dk);

    const ht = deltaHeat(delta.netWorthChange, delta.sovereigntyChange, delta.pressureChange);
    const isSevDrop = delta.sovereigntyChange <= -10;
    const sev: SnapshotAdapterSignalSeverity = isSevDrop ? 'WARN' : 'INFO';
    const payload: Record<string, JsonValue> = {
      deltaId: delta.deltaId, runId: delta.runId,
      fromTick: delta.fromTick, toTick: delta.toTick, tickSpan: delta.tickSpan,
      netWorthChange: Math.round(delta.netWorthChange),
      sovereigntyChange: parseFloat(delta.sovereigntyChange.toFixed(4)),
      shieldChange: parseFloat((clamp01(Math.abs(delta.shieldChange)) as number).toFixed(6)),
      pressureChange: parseFloat(delta.pressureChange.toFixed(6)),
      economyChange: parseFloat(delta.economyChange.toFixed(6)),
      threatCountChange: delta.threatCountChange, checksum: delta.checksum,
      computedAtMs: delta.computedAtMs, adaptedAtMs: now as unknown as number,
      eventName: ev, channel: this.chan(ctx) as unknown as string,
      priority: isSevDrop ? 80 : 50, adapterSeverity: sev, isSovereigntyDrop: isSevDrop,
      deltaHeadline: snapshotDeltaHeadline(delta.fromTick, delta.toTick),
      deltaCoaching: snapshotDeltaCoachingMessage(delta.netWorthChange, delta.sovereigntyChange, delta.tickSpan),
      source: ctx?.source ?? SRC,
      tags: this.tags(['delta', isSevDrop ? 'sov-drop' : 'normal'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };
    const envelope = buildEnvelope(ev, rm, ht, isSevDrop, payload, now);
    this.accept(dk, envelope, now); this._deltas++;
    this.log.debug(`${SRC}: ${ev} accepted`, { runId: delta.runId, fromTick: delta.fromTick, toTick: delta.toTick });
    return envelope;
  }

  /** Adapt an ML vector into a snapshot.ml.vector_emitted envelope. Gated by emitMLVectors. */
  public adaptMLVector(vector: AdapterMLVectorCompat, ctx?: SnapshotAdapterSignalContext): ChatSignalEnvelope | null {
    if (!this.opts.emitMLVectors) return this.sup('ML vectors disabled', { dimensionality: vector.dimensionality });
    const now = this.clk.now(), rm = this.room(ctx);
    const ev: SnapshotAdapterSignalEventName = 'snapshot.ml.vector_emitted';
    const dk = `snapshot.ml:${vector.runId}:${vector.checksum}`;
    if (this.isDup(dk, now)) return this.dup(ev, dk);

    const n = vector.features.length;
    const sum = n > 0 ? vector.features.reduce((a, b) => a + b, 0) : 0;
    const avg = n > 0 ? sum / n : 0;
    const minF = n > 0 ? Math.min(...vector.features) : 0;
    const maxF = n > 0 ? Math.max(...vector.features) : 0;
    const ht = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId: vector.runId, tick: vector.tick, featureCount: n, dimensionality: vector.dimensionality,
      avgFeatureValue: parseFloat(avg.toFixed(8)), minFeatureValue: parseFloat(minF.toFixed(8)),
      maxFeatureValue: parseFloat(maxF.toFixed(8)), checksum: vector.checksum,
      extractedAtMs: vector.extractedAtMs, adaptedAtMs: now as unknown as number,
      sampleLabels: vector.featureLabels.slice(0, 8).join(','),
      eventName: ev, channel: this.chan(ctx) as unknown as string, priority: 30,
      source: ctx?.source ?? SRC, tags: this.tags(['ml', 'vector'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };
    const envelope = buildEnvelope(ev, rm, ht, false, payload, now);
    this.accept(dk, envelope, now); this._mlVecs++;
    this.log.debug(`${SRC}: ${ev} accepted`, { runId: vector.runId, dimensionality: vector.dimensionality });
    return envelope;
  }

  /** Adapt a DL tensor into a snapshot.dl.tensor_emitted envelope. Gated by emitDLTensors. */
  public adaptDLTensor(tensor: AdapterDLTensorCompat, ctx?: SnapshotAdapterSignalContext): ChatSignalEnvelope | null {
    if (!this.opts.emitDLTensors) return this.sup('DL tensors disabled', { dimensionality: tensor.dimensionality });
    const now = this.clk.now(), rm = this.room(ctx);
    const ev: SnapshotAdapterSignalEventName = 'snapshot.dl.tensor_emitted';
    const dk = `snapshot.dl:${tensor.runId}:${tensor.checksum}`;
    if (this.isDup(dk, now)) return this.dup(ev, dk);

    const n = tensor.features.length;
    const sum = n > 0 ? tensor.features.reduce((a, b) => a + b, 0) : 0;
    const avg = n > 0 ? sum / n : 0;
    const sumSq = n > 0 ? tensor.features.reduce((a, b) => a + b * b, 0) : 0;
    const l2 = n > 0 ? Math.sqrt(sumSq) : 0;
    const ht = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId: tensor.runId, tick: tensor.tick, policyVersion: tensor.policyVersion,
      inputCount: n, dimensionality: tensor.dimensionality,
      tensorShape: JSON.stringify(tensor.shape),
      avgInputValue: parseFloat(avg.toFixed(8)), l2norm: parseFloat(l2.toFixed(8)),
      checksum: tensor.checksum, extractedAtMs: tensor.extractedAtMs,
      adaptedAtMs: now as unknown as number,
      sampleLabels: tensor.featureLabels.slice(0, 8).join(','),
      eventName: ev, channel: this.chan(ctx) as unknown as string, priority: 25,
      source: ctx?.source ?? SRC, tags: this.tags(['dl', 'tensor'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };
    const envelope = buildEnvelope(ev, rm, ht, false, payload, now);
    this.accept(dk, envelope, now); this._dlTens++;
    this.log.debug(`${SRC}: ${ev} accepted`, { runId: tensor.runId, dimensionality: tensor.dimensionality });
    return envelope;
  }

  /** Adapt an audit entry into a snapshot.audit.entry envelope. CRITICAL always accepted. */
  public adaptAuditEntry(entry: AdapterAuditEntryCompat, ctx?: SnapshotAdapterSignalContext): ChatSignalEnvelope | null {
    const now = this.clk.now(), rm = this.room(ctx);
    const ev: SnapshotAdapterSignalEventName = 'snapshot.audit.entry';
    const dk = `snapshot.audit:${entry.entryId}`;
    const isCrit = entry.severity === 'CRITICAL';
    const isAA = isCrit && this.opts.alwaysAcceptCriticalAudit;

    if (!isAA && this.opts.suppressLowPrioritySignals && entry.severity === 'LOW') {
      return this.sup('audit LOW suppressed', { entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType });
    }
    if (!isAA && this.isDup(dk, now)) return this.dup(ev, dk);

    const pri = AUDIT_SEV_PRIORITY[entry.severity] ?? 25;
    const ht = clamp01(pri / 100) as Score01;
    const sev = auditSeverity(entry.severity);
    const flatMeta: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(entry.metadata)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        flatMeta[k] = v as JsonValue;
      }
    }
    const isQ = entry.integrityStatus === 'QUARANTINED';
    const payload: Record<string, JsonValue> = {
      entryId: entry.entryId, runId: entry.runId, tick: entry.tick,
      eventType: entry.eventType, severity: entry.severity, adapterSeverity: sev,
      message: entry.message, integrityStatus: entry.integrityStatus,
      capturedAtMs: entry.capturedAtMs, hmacSignature: entry.hmacSignature,
      adaptedAtMs: now as unknown as number, priority: pri, eventName: ev,
      isQuarantined: isQ, isCritical: isCrit,
      auditHeadline: snapshotAuditHeadline(entry.severity, entry.eventType),
      auditCoaching: isCrit ? snapshotCriticalAuditCoaching(entry.eventType) : null,
      auditMeta: flatMeta as unknown as JsonValue,
      source: ctx?.source ?? SRC,
      tags: this.tags(['audit', entry.severity.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };
    const envelope = buildEnvelope(ev, rm, ht, isQ, payload, now);
    this.accept(dk, envelope, now); this._audits++;
    if (isCrit) { this._critAudit++; this.log.warn(`${SRC}: CRITICAL audit`, { entryId: entry.entryId, runId: entry.runId }); }
    else this.log.debug(`${SRC}: ${ev} accepted`, { entryId: entry.entryId, severity: entry.severity });
    return envelope;
  }

  // ── State query ────────────────────────────────────────────────────────────

  public getStats(): SnapshotAdapterSignalStats {
    return Object.freeze({
      totalAdapted: this._adapted, totalSuppressed: this._suppressed, totalDeduped: this._deduped,
      tickRecordsAdapted: this._ticks, runSummariesAdapted: this._summaries,
      cordScoresAdapted: this._cords, deltasAdapted: this._deltas,
      auditEntriesAdapted: this._audits, mlVectorsEmitted: this._mlVecs,
      dlTensorsEmitted: this._dlTens, highCordCount: this._hiCord,
      criticalAuditCount: this._critAudit, freedomOutcomeCount: this._freedom,
      highPressureCount: this._hiPres,
    });
  }
  public getHistory(): readonly ChatSignalEnvelope[] { return Object.freeze([...this._hist]); }
  public clearHistory(): void {
    this._hist.length = 0; this._dup.clear();
    this.log.debug(`${SRC}: history cleared`, {});
  }
  public resetStats(): void {
    this._adapted = 0; this._suppressed = 0; this._deduped = 0;
    this._ticks = 0; this._summaries = 0; this._cords = 0; this._deltas = 0;
    this._audits = 0; this._mlVecs = 0; this._dlTens = 0;
    this._hiCord = 0; this._critAudit = 0; this._freedom = 0; this._hiPres = 0;
    this.log.debug(`${SRC}: stats reset`, {});
  }
}

// ============================================================================
// SECTION 8 — BATCH HELPERS
// ============================================================================

/** Adapt summary + CORD in canonical order: summary → cord. */
export function adaptSnapshotSummarySignals(
  adapter: SnapshotAdapterSignalAdapter, summary: RunSummaryCompat, ctx?: SnapshotAdapterSignalContext,
): readonly ChatSignalEnvelope[] {
  const out: ChatSignalEnvelope[] = [];
  const s = adapter.adaptRunSummaryGenerated(summary, ctx);
  const c = adapter.adaptCordScoreComputed(summary.cordScore, summary.grade, ctx);
  if (s !== null) out.push(s);
  if (c !== null) out.push(c);
  return Object.freeze(out);
}

/** Adapt full bundle: summary → cord → ml → dl → audits. */
export function adaptSnapshotBundle(
  adapter: SnapshotAdapterSignalAdapter, summary: RunSummaryCompat,
  ml?: AdapterMLVectorCompat, dl?: AdapterDLTensorCompat,
  audits?: readonly AdapterAuditEntryCompat[], ctx?: SnapshotAdapterSignalContext,
): readonly ChatSignalEnvelope[] {
  const out: ChatSignalEnvelope[] = [];
  for (const e of adaptSnapshotSummarySignals(adapter, summary, ctx)) out.push(e);
  if (ml) { const v = adapter.adaptMLVector(ml, ctx); if (v) out.push(v); }
  if (dl) { const v = adapter.adaptDLTensor(dl, ctx); if (v) out.push(v); }
  if (audits) for (const a of audits) { const v = adapter.adaptAuditEntry(a, ctx); if (v) out.push(v); }
  return Object.freeze(out);
}

/** Adapt a batch of tick records. */
export function adaptTickRecordBatch(
  adapter: SnapshotAdapterSignalAdapter, records: readonly TickRecordCompat[], ctx?: SnapshotAdapterSignalContext,
): readonly ChatSignalEnvelope[] {
  const out: ChatSignalEnvelope[] = [];
  for (const r of records) { const e = adapter.adaptTickRecordCreated(r, ctx); if (e) out.push(e); }
  return Object.freeze(out);
}

/** Adapt a batch of deltas. */
export function adaptSnapshotDeltaBatch(
  adapter: SnapshotAdapterSignalAdapter, deltas: readonly SnapshotDeltaCompat[], ctx?: SnapshotAdapterSignalContext,
): readonly ChatSignalEnvelope[] {
  const out: ChatSignalEnvelope[] = [];
  for (const d of deltas) { const e = adapter.adaptSnapshotDelta(d, ctx); if (e) out.push(e); }
  return Object.freeze(out);
}

/** Adapt a batch of audit entries. */
export function adaptSnapshotAuditBatch(
  adapter: SnapshotAdapterSignalAdapter, entries: readonly AdapterAuditEntryCompat[], ctx?: SnapshotAdapterSignalContext,
): readonly ChatSignalEnvelope[] {
  const out: ChatSignalEnvelope[] = [];
  for (const a of entries) { const e = adapter.adaptAuditEntry(a, ctx); if (e) out.push(e); }
  return Object.freeze(out);
}

/** Adapt a batch of ML vectors. Only emits when emitMLVectors is true. */
export function adaptSnapshotMLBatch(
  adapter: SnapshotAdapterSignalAdapter, vectors: readonly AdapterMLVectorCompat[], ctx?: SnapshotAdapterSignalContext,
): readonly ChatSignalEnvelope[] {
  const out: ChatSignalEnvelope[] = [];
  for (const v of vectors) { const e = adapter.adaptMLVector(v, ctx); if (e) out.push(e); }
  return Object.freeze(out);
}

/** Adapt a batch of DL tensors. Only emits when emitDLTensors is true. */
export function adaptSnapshotDLBatch(
  adapter: SnapshotAdapterSignalAdapter, tensors: readonly AdapterDLTensorCompat[], ctx?: SnapshotAdapterSignalContext,
): readonly ChatSignalEnvelope[] {
  const out: ChatSignalEnvelope[] = [];
  for (const t of tensors) { const e = adapter.adaptDLTensor(t, ctx); if (e) out.push(e); }
  return Object.freeze(out);
}

// ============================================================================
// SECTION 9 — FACTORY
// ============================================================================

/**
 * Factory with production-safe defaults: dedupeWindowMs 5000, maxHistory 200,
 * alwaysAcceptHighCord/Freedom/CriticalAudit true, suppressLow true,
 * ML/DL vectors off, sovereignty threshold 80, CORD threshold 0.85,
 * pressure threshold 0.75.
 */
export function createSnapshotAdapterSignalAdapter(
  defaultRoomId: ChatRoomId | string,
  overrides?: Partial<SnapshotAdapterSignalAdapterOptions>,
): SnapshotAdapterSignalAdapter {
  return new SnapshotAdapterSignalAdapter({
    defaultRoomId,
    defaultVisibleChannel:      'GLOBAL',
    dedupeWindowMs:             DEFAULT_DEDUPE_WINDOW_MS,
    maxHistory:                 DEFAULT_MAX_HISTORY,
    alwaysAcceptHighCord:       true,
    alwaysAcceptFreedom:        true,
    alwaysAcceptCriticalAudit:  true,
    suppressLowPrioritySignals: true,
    emitMLVectors:              false,
    emitDLTensors:              false,
    highSovereigntyThreshold:   DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
    cordScoreHighThreshold:     DEFAULT_CORD_HIGH_THRESHOLD,
    highPressureThreshold:      DEFAULT_HIGH_PRESSURE_THRESHOLD,
    ...overrides,
  });
}

// ============================================================================
// SECTION 10 — SELF-DESCRIPTION MANIFEST
// ============================================================================

export const SNAPSHOT_ADAPTER_SIGNAL_MANIFEST = Object.freeze({
  adapterName:    'SnapshotAdapterSignalAdapter',
  version:        '2026.03.26',
  sourceFile:     'backend/src/game/engine/chat/adapters/SnapshotAdapterSignalAdapter.ts',
  signalType:     'LIVEOPS' as const,
  events: Object.freeze([
    'snapshot.tick_record.created',
    'snapshot.run_summary.generated',
    'snapshot.cord.scored',
    'snapshot.delta.computed',
    'snapshot.ml.vector_emitted',
    'snapshot.dl.tensor_emitted',
    'snapshot.audit.entry',
  ] as const),
  designLaws: Object.freeze([
    'No circular imports from core/ — all types mirrored structurally.',
    'High CORD scores always accepted (milestone coaching events).',
    'FREEDOM outcome run summaries always accepted.',
    'CRITICAL audit entries always accepted (helperBlackout for QUARANTINED).',
    'LOW priority signals suppressed by default.',
    'ML/DL vectors only emitted when flags are enabled.',
    'All runtime functions (asUnixMs, clamp01, clamp100) consumed in runtime code.',
    'Dedupe is per (runId + eventClass + identifier) key.',
    'History is ring-buffered at maxHistory entries.',
  ] as const),
});
