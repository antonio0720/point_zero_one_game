/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT PERSISTENCE WRITER SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/PersistenceWriterSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates SovereigntyPersistenceWriter signals —
 * persistence completions, tick writes, run writes, artifact writes, audit writes,
 * batch completions, ML/DL vectors, and audit entries — into authoritative
 * backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the SovereigntyPersistenceWriter completes a persistence operation,
 *    writes a tick, writes a run, persists an artifact, writes an audit record,
 *    completes a batch, emits an ML/DL vector, or records an audit entry, what
 *    exact chat-native signal should the authoritative backend chat engine
 *    ingest to drive companion NPC coaching and reflect persistence status in
 *    the companion AI?"
 *
 * This file owns:
 * - Persistence complete   → ChatSignalEnvelope (persistence.complete)
 * - Tick written           → ChatSignalEnvelope (persistence.tick.written)
 * - Run written            → ChatSignalEnvelope (persistence.run.written)
 * - Artifact written       → ChatSignalEnvelope (persistence.artifact.written)
 * - Audit written          → ChatSignalEnvelope (persistence.audit.written)
 * - Batch complete         → ChatSignalEnvelope (persistence.batch.complete)
 * - ML vector emitted      → ChatSignalEnvelope (persistence.ml.vector_emitted)
 * - DL tensor emitted      → ChatSignalEnvelope (persistence.dl.tensor_emitted)
 * - Audit entry            → ChatSignalEnvelope (persistence.audit.entry)
 *
 * It does not own:
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 * - Shield layer integrity, repair scheduling, or run phase management
 * - Proof generation, CORD scoring, or replay integrity verification
 * - Grade assignment or badge management (owned by RunGradeAssigner)
 * - Any circular import from core/ — all core types mirrored structurally
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real PersistenceEnvelope / PersistenceWriteStats /
 *   PersistenceMLVector / PersistenceDLTensor / PersistenceAuditEntry objects
 *   — they satisfy the compat interfaces structurally.
 * - Persistence complete signals with high record counts are always accepted.
 * - Audit entry signals with CRITICAL-equivalent severity are always accepted.
 * - ML/DL vector signals only emitted when the respective flag is enabled.
 * - All runtime functions (asUnixMs, clamp01, clamp100) are called in runtime
 *   code — never dead imports.
 *
 * Event vocabulary
 * ----------------
 *   persistence.complete           — persistence operation finished
 *   persistence.tick.written       — tick record persisted to storage
 *   persistence.run.written        — run record persisted to storage
 *   persistence.artifact.written   — artifact record persisted to storage
 *   persistence.audit.written      — audit record persisted to storage
 *   persistence.batch.complete     — batch persistence operation completed
 *   persistence.ml.vector_emitted  — ML feature vector (32-dim) extracted
 *   persistence.dl.tensor_emitted  — DL input tensor (48-dim) constructed
 *   persistence.audit.entry        — audit trail entry recorded
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
// Mirrors of SovereigntyPersistenceWriter types — no circular import from core/
// ============================================================================

/** Mirror of PersistenceEnvelope from sovereignty/SovereigntyPersistenceWriter.ts */
export interface PersistenceEnvelopeCompat {
  readonly operationId: string;
  readonly runId: string;
  readonly userId: string;
  readonly mode: string;
  readonly outcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  readonly proofHash: string;
  readonly grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  readonly integrityStatus: 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly finalNetWorth: number;
  readonly ticksWritten: number;
  readonly artifactsWritten: number;
  readonly auditRecordsWritten: number;
  readonly totalRecordsWritten: number;
  readonly durationMs: number;
  readonly storageBackend: string;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly checksum: string;
}

/** Mirror of PersistenceWriteStats from sovereignty/SovereigntyPersistenceWriter.ts */
export interface PersistenceWriteStatsCompat {
  readonly operationId: string;
  readonly runId: string;
  readonly ticksWritten: number;
  readonly runsWritten: number;
  readonly artifactsWritten: number;
  readonly auditRecordsWritten: number;
  readonly totalBytes: number;
  readonly avgWriteLatencyMs: number;
  readonly maxWriteLatencyMs: number;
  readonly errorCount: number;
  readonly retryCount: number;
  readonly completedAtMs: number;
}

/** Mirror of PersistenceMLVector from sovereignty/SovereigntyPersistenceWriter.ts */
export interface PersistenceMLVectorCompat {
  readonly runId: string;
  readonly operationId: string;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly extractedAtMs: number;
}

/** Mirror of PersistenceDLTensor from sovereignty/SovereigntyPersistenceWriter.ts */
export interface PersistenceDLTensorCompat {
  readonly runId: string;
  readonly operationId: string;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly shape: readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Mirror of PersistenceAuditEntry from sovereignty/SovereigntyPersistenceWriter.ts */
export interface PersistenceAuditEntryCompat {
  readonly entryId: string;
  readonly operationId: string;
  readonly runId: string;
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
export interface PersistenceSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/** Logger interface — implement with any backend logger or leave null. */
export interface PersistenceSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

/** Clock interface — injectable for tests. */
export interface PersistenceSignalAdapterClock {
  now(): UnixMs;
}

/** Severity classification for adapter events. */
export type PersistenceSignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';

/** Full set of persistence signal event names. */
export type PersistenceSignalAdapterEventName =
  | 'persistence.complete'
  | 'persistence.tick.written'
  | 'persistence.run.written'
  | 'persistence.artifact.written'
  | 'persistence.audit.written'
  | 'persistence.batch.complete'
  | 'persistence.ml.vector_emitted'
  | 'persistence.dl.tensor_emitted'
  | 'persistence.audit.entry'
  | string;

/** Construction options for PersistenceWriterSignalAdapter. */
export interface PersistenceWriterSignalAdapterOptions {
  /** Room all signals default to unless overridden by context. */
  readonly defaultRoomId: ChatRoomId | string;
  /** Visible channel default (default: 'GLOBAL'). */
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  /** Time window in ms within which duplicate signals are suppressed (default: 5000). */
  readonly dedupeWindowMs?: number;
  /** Maximum number of history entries retained (default: 200). */
  readonly maxHistory?: number;
  /** Always accept persistence complete with high record counts (default: true). */
  readonly alwaysAcceptHighRecordCount?: boolean;
  /** Always accept critical audit entries regardless of dedupe window (default: true). */
  readonly alwaysAcceptCriticalAudit?: boolean;
  /** Suppress LOW priority signals to keep chat focused (default: true). */
  readonly suppressLowPrioritySignals?: boolean;
  /** Emit ML vector signals when adaptMLVector() is called (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals when adaptDLTensor() is called (default: false). */
  readonly emitDLTensors?: boolean;
  /**
   * Total records written at or above this threshold is treated as high-value
   * and always accepted (default: 50).
   */
  readonly highRecordCountThreshold?: number;
  /**
   * Sovereignty score at or above this threshold boosts priority for
   * persistence signals (default: 80).
   */
  readonly highSovereigntyThreshold?: number;
  readonly logger?: PersistenceSignalAdapterLogger;
  readonly clock?: PersistenceSignalAdapterClock;
}

/** Cumulative stats reported by getStats(). */
export interface PersistenceSignalAdapterStats {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalDeduped: number;
  readonly persistenceCompleted: number;
  readonly ticksWritten: number;
  readonly runsWritten: number;
  readonly artifactsWritten: number;
  readonly auditsWritten: number;
  readonly batchesCompleted: number;
  readonly auditEntriesAdapted: number;
  readonly mlVectorsEmitted: number;
  readonly dlTensorsEmitted: number;
  readonly highRecordCountEvents: number;
  readonly criticalAuditCount: number;
}

// ============================================================================
// SECTION 3 — MODULE CONSTANTS
// ============================================================================

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_HIGH_RECORD_COUNT_THRESHOLD = 50;
const DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD = 80;
const ADAPTER_SOURCE_TAG = 'PersistenceWriterSignalAdapter';

/** Priority weights by grade — used to assign envelope priority value. */
const GRADE_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  S: 100,
  A: 95,
  B: 75,
  C: 55,
  D: 40,
  F: 85,
});

/** Priority weights by integrity status. */
const INTEGRITY_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  QUARANTINED: 100,
  VERIFIED:    60,
  UNVERIFIED:  40,
  PENDING:     20,
});

/** Priority weights by audit severity. */
const AUDIT_SEVERITY_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 100,
  HIGH:     75,
  MEDIUM:   50,
  LOW:      25,
});

/** Priority weights by outcome. */
const OUTCOME_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  FREEDOM:   90,
  TIMEOUT:   50,
  BANKRUPT:  80,
  ABANDONED: 30,
});

const NULL_LOGGER: PersistenceSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: PersistenceSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ============================================================================
// SECTION 4 — UX MESSAGE HELPERS
// ============================================================================

/** Returns a companion-facing headline for persistence completion. */
export function persistenceCompleteHeadline(totalRecords: number, outcome: string): string {
  return `Persistence complete — ${totalRecords} records written, outcome: ${outcome}.`;
}

/** Returns a coaching message for persistence completion. */
export function persistenceCoachingMessage(
  totalRecords: number,
  grade: string,
  durationMs: number,
): string {
  const durationSec = (durationMs / 1000).toFixed(1);
  if (totalRecords >= 100) {
    return `Large persistence operation finished: ${totalRecords} records in ${durationSec}s at Grade ${grade}. Full run data secured.`;
  }
  if (totalRecords >= 50) {
    return `Persistence complete: ${totalRecords} records in ${durationSec}s. Grade ${grade} run fully captured.`;
  }
  return `Persistence finished: ${totalRecords} records in ${durationSec}s. Grade ${grade} data stored.`;
}

/** Returns a companion-facing headline for a tick write. */
export function tickWrittenHeadline(ticksWritten: number): string {
  return `Tick data persisted — ${ticksWritten} tick records written.`;
}

/** Returns a coaching message for tick writes. */
export function tickWrittenCoachingMessage(ticksWritten: number, avgLatencyMs: number): string {
  const latencyFmt = avgLatencyMs.toFixed(1);
  if (ticksWritten >= 500) {
    return `${ticksWritten} tick records persisted at ${latencyFmt}ms average write latency. Full tick timeline secured.`;
  }
  if (ticksWritten >= 100) {
    return `${ticksWritten} tick records written at ${latencyFmt}ms average. Tick stream captured for replay.`;
  }
  return `${ticksWritten} tick records stored at ${latencyFmt}ms average write latency.`;
}

/** Returns a companion-facing headline for a run write. */
export function runWrittenHeadline(grade: string, outcome: string): string {
  return `Run record persisted — Grade ${grade}, outcome: ${outcome}.`;
}

/** Returns a coaching message for a run write. */
export function runWrittenCoachingMessage(grade: string, sovereigntyScore: number): string {
  const scorePct = Math.round(sovereigntyScore);
  switch (grade) {
    case 'S': return `Supreme Grade S run persisted at ${scorePct}% sovereignty. Peak performance archived.`;
    case 'A': return `Grade A run persisted at ${scorePct}% sovereignty. Excellence recorded for replay.`;
    case 'B': return `Grade B run persisted at ${scorePct}% sovereignty. Strong performance captured.`;
    case 'C': return `Grade C run persisted at ${scorePct}% sovereignty. Acceptable result stored.`;
    case 'D': return `Grade D run persisted at ${scorePct}% sovereignty. Review data for improvement signals.`;
    case 'F': return `Grade F run persisted at ${scorePct}% sovereignty. Critical failure recorded.`;
    default:  return `Run persisted at ${scorePct}% sovereignty.`;
  }
}

/** Returns a companion-facing headline for an artifact write. */
export function artifactWrittenHeadline(artifactsWritten: number): string {
  if (artifactsWritten === 1) return 'Export artifact persisted — 1 artifact written.';
  return `Export artifacts persisted — ${artifactsWritten} artifacts written.`;
}

/** Returns a companion-facing headline for an audit record write. */
export function auditWrittenHeadline(auditRecords: number): string {
  return `Audit records persisted — ${auditRecords} entries written.`;
}

/** Returns a companion-facing headline for batch completion. */
export function batchCompleteHeadline(batchSize: number, totalRecords: number): string {
  return `Batch persistence complete — ${batchSize} operations, ${totalRecords} total records.`;
}

/** Returns a coaching message for batch completion. */
export function batchCoachingMessage(batchSize: number, totalRecords: number): string {
  if (batchSize >= 10) {
    return `Large batch of ${batchSize} persistence operations completed. ${totalRecords} total records archived across all runs.`;
  }
  if (batchSize >= 5) {
    return `Batch of ${batchSize} persistence operations finished. ${totalRecords} records stored for replay analysis.`;
  }
  return `Batch of ${batchSize} operations processed. ${totalRecords} records persisted.`;
}

/** Returns a coaching message for a critical audit entry. */
export function criticalAuditCoachingMessage(eventType: string): string {
  return `CRITICAL audit entry detected during persistence: ${eventType}. Data integrity may require investigation.`;
}

/** Returns a headline for an audit trail entry. */
export function auditEntryHeadline(severity: string, eventType: string): string {
  return `Persistence audit recorded — ${severity} severity, event: ${eventType}.`;
}

// ============================================================================
// SECTION 5 — STANDALONE HELPER: buildPersistencePayload
// ============================================================================

/**
 * Standalone helper that builds a base metadata payload from a
 * PersistenceEnvelopeCompat. Used by multiple adapt* methods for consistency.
 *
 * All numeric values are clamped and rounded to prevent payload injection or
 * out-of-range values reaching the chat engine.
 */
export function buildPersistencePayload(
  envelope: PersistenceEnvelopeCompat,
  now: UnixMs,
  overrides?: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const cord01   = clamp01(envelope.cordScore);
  const sov100   = clamp100(envelope.sovereigntyScore);
  const netWorth = Math.round(envelope.finalNetWorth);

  return {
    operationId:           envelope.operationId,
    runId:                 envelope.runId,
    userId:                envelope.userId,
    proofHash:             envelope.proofHash,
    mode:                  envelope.mode,
    outcome:               envelope.outcome,
    grade:                 envelope.grade,
    integrityStatus:       envelope.integrityStatus,
    cordScore01:           parseFloat(cord01.toFixed(6)),
    sovereigntyScore100:   sov100,
    finalNetWorth:         netWorth,
    ticksWritten:          envelope.ticksWritten,
    artifactsWritten:      envelope.artifactsWritten,
    auditRecordsWritten:   envelope.auditRecordsWritten,
    totalRecordsWritten:   envelope.totalRecordsWritten,
    durationMs:            envelope.durationMs,
    storageBackend:        envelope.storageBackend,
    checksum:              envelope.checksum,
    startedAtMs:           envelope.startedAtMs,
    completedAtMs:         envelope.completedAtMs,
    adaptedAtMs:           now as unknown as number,
    persistenceHeadline:   persistenceCompleteHeadline(envelope.totalRecordsWritten, envelope.outcome),
    persistenceCoaching:   persistenceCoachingMessage(envelope.totalRecordsWritten, envelope.grade, envelope.durationMs),
    ...(overrides ?? {}),
  };
}

// ============================================================================
// SECTION 6 — INTERNAL HELPERS
// ============================================================================

/** Determine the adapter severity level from grade. */
function gradeSeverity(grade: string): PersistenceSignalAdapterSeverity {
  switch (grade) {
    case 'S': return 'INFO';
    case 'A': return 'INFO';
    case 'B': return 'INFO';
    case 'C': return 'INFO';
    case 'D': return 'WARN';
    case 'F': return 'CRITICAL';
    default:  return 'DEBUG';
  }
}

/** Determine the adapter severity from an audit entry's severity. */
function auditSeverity(severity: string): PersistenceSignalAdapterSeverity {
  switch (severity) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH':     return 'WARN';
    case 'MEDIUM':   return 'INFO';
    case 'LOW':      return 'DEBUG';
    default:         return 'DEBUG';
  }
}

/** Compute heat multiplier for persistence completion. */
function persistenceCompleteHeat(grade: string, totalRecords: number): Score01 {
  const gradeWeight  = (GRADE_PRIORITY[grade] ?? 50) / 100;
  const recordFactor = Math.min(totalRecords / 200, 1.0);
  return clamp01(gradeWeight * 0.5 + recordFactor * 0.3 + 0.2);
}

/** Compute heat multiplier for tick writes. */
function tickWrittenHeat(ticksWritten: number): Score01 {
  const tickFactor = Math.min(ticksWritten / 500, 1.0);
  return clamp01(0.2 + tickFactor * 0.4);
}

/** Compute heat multiplier for run writes based on grade and outcome. */
function runWrittenHeat(grade: string, outcome: string): Score01 {
  const gradeWeight   = (GRADE_PRIORITY[grade] ?? 50) / 100;
  const outcomeWeight = (OUTCOME_PRIORITY[outcome] ?? 40) / 100;
  return clamp01(gradeWeight * 0.6 + outcomeWeight * 0.4);
}

/** Compute heat multiplier for artifact writes. */
function artifactWrittenHeat(artifactsWritten: number): Score01 {
  const artifactFactor = Math.min(artifactsWritten / 10, 1.0);
  return clamp01(0.3 + artifactFactor * 0.4);
}

/** Compute heat multiplier for batch completion. */
function batchCompleteHeat(batchSize: number, totalRecords: number): Score01 {
  const sizeFactor   = Math.min(batchSize / 20, 1.0);
  const recordFactor = Math.min(totalRecords / 500, 1.0);
  return clamp01(0.2 + sizeFactor * 0.3 + recordFactor * 0.3);
}

/** Build a frozen LIVEOPS ChatSignalEnvelope from persistence signal data. */
function buildPersistenceLiveopsEnvelope(
  eventName: string,
  roomId: ChatRoomId | string | null,
  heatMultiplier: Score01,
  helperBlackout: boolean,
  metadata: Record<string, JsonValue>,
  now: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS' as const,
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: eventName,
      heatMultiplier01: heatMultiplier,
      helperBlackout,
      haterRaidActive: false,
    }),
    metadata: Object.freeze(metadata as Record<string, JsonValue>),
  });
}

// ============================================================================
// SECTION 7 — PersistenceWriterSignalAdapter CLASS
// ============================================================================

/**
 * Adapts SovereigntyPersistenceWriter outputs into authoritative backend-chat
 * ingress envelopes.
 *
 * Filtering policy (in priority order):
 * - Persistence complete with high record counts: always accepted
 *   (alwaysAcceptHighRecordCount)
 * - Critical audit entries: always accepted (alwaysAcceptCriticalAudit)
 * - LOW priority signals: suppressed when suppressLowPrioritySignals=true
 * - All other signals: subject to dedupeWindowMs
 * - ML/DL vectors: only emitted when emitMLVectors / emitDLTensors is true
 */
export class PersistenceWriterSignalAdapter {
  private readonly opts: Readonly<Required<PersistenceWriterSignalAdapterOptions>>;
  private readonly logger: PersistenceSignalAdapterLogger;
  private readonly clock: PersistenceSignalAdapterClock;

  private readonly _history: ChatSignalEnvelope[] = [];
  private readonly _lastAcceptedAt: Map<string, UnixMs> = new Map();

  // ── Stats counters ─────────────────────────────────────────────────────────
  private _totalAdapted          = 0;
  private _totalSuppressed       = 0;
  private _totalDeduped          = 0;
  private _persistenceCompleted  = 0;
  private _ticksWritten          = 0;
  private _runsWritten           = 0;
  private _artifactsWritten      = 0;
  private _auditsWritten         = 0;
  private _batchesCompleted      = 0;
  private _auditEntries          = 0;
  private _mlVectors             = 0;
  private _dlTensors             = 0;
  private _highRecordCountEvents = 0;
  private _criticalAuditCount    = 0;

  public constructor(options: PersistenceWriterSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock  = options.clock  ?? SYSTEM_CLOCK;

    this.opts = Object.freeze({
      defaultRoomId:              options.defaultRoomId,
      defaultVisibleChannel:      options.defaultVisibleChannel       ?? 'GLOBAL',
      dedupeWindowMs:             options.dedupeWindowMs              ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory:                 options.maxHistory                  ?? DEFAULT_MAX_HISTORY,
      alwaysAcceptHighRecordCount: options.alwaysAcceptHighRecordCount ?? true,
      alwaysAcceptCriticalAudit:  options.alwaysAcceptCriticalAudit   ?? true,
      suppressLowPrioritySignals: options.suppressLowPrioritySignals  ?? true,
      emitMLVectors:              options.emitMLVectors               ?? false,
      emitDLTensors:              options.emitDLTensors               ?? false,
      highRecordCountThreshold:   options.highRecordCountThreshold    ?? DEFAULT_HIGH_RECORD_COUNT_THRESHOLD,
      highSovereigntyThreshold:   options.highSovereigntyThreshold    ?? DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
      logger:                     this.logger,
      clock:                      this.clock,
    } as Required<PersistenceWriterSignalAdapterOptions>);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private isDeduped(key: string, now: UnixMs): boolean {
    const last = this._lastAcceptedAt.get(key);
    return last !== undefined && (now - (last as unknown as number)) < this.opts.dedupeWindowMs;
  }

  private markAccepted(key: string, envelope: ChatSignalEnvelope, now: UnixMs): void {
    this._lastAcceptedAt.set(key, now);
    this._totalAdapted++;
    this._history.push(envelope);
    if (this._history.length > this.opts.maxHistory) {
      this._history.shift();
    }
  }

  private suppress(reason: string, details: Record<string, JsonValue>): null {
    this._totalSuppressed++;
    this.logger.debug(`PersistenceWriterSignalAdapter: suppressed — ${reason}`, details);
    return null;
  }

  private dedupe(eventName: string, key: string): null {
    this._totalDeduped++;
    this.logger.debug('PersistenceWriterSignalAdapter: deduped', { eventName, key });
    return null;
  }

  private resolveRoom(ctx?: PersistenceSignalAdapterContext): ChatRoomId | string {
    return (ctx?.roomId ?? this.opts.defaultRoomId) as ChatRoomId | string;
  }

  private resolveTags(
    baseTags: string[],
    ctx?: PersistenceSignalAdapterContext,
  ): string[] {
    return [ADAPTER_SOURCE_TAG, ...baseTags, ...(ctx?.tags ?? [])];
  }

  // ── Public adapt* methods ───────────────────────────────────────────────────

  /**
   * Adapt a PersistenceEnvelope into a persistence.complete ChatSignalEnvelope.
   *
   * Always accepted when totalRecordsWritten >= highRecordCountThreshold and
   * alwaysAcceptHighRecordCount is true. High sovereignty scores boost priority.
   * The persistence complete signal is the primary event for a finished write
   * operation.
   */
  public adaptPersistenceComplete(
    envelope: PersistenceEnvelopeCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.complete';
    const dedupeKey = `persistence.complete:${envelope.runId}:${envelope.operationId}`;

    // Always-accept rules
    const isHighRecordCount = envelope.totalRecordsWritten >= this.opts.highRecordCountThreshold
      && this.opts.alwaysAcceptHighRecordCount;
    const isAlwaysAccept = isHighRecordCount;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(envelope.sovereigntyScore);
    const heat     = persistenceCompleteHeat(envelope.grade, envelope.totalRecordsWritten);
    const isHighSov = sov100 >= this.opts.highSovereigntyThreshold;
    const basePriority = GRADE_PRIORITY[envelope.grade] ?? 55;

    const payload = buildPersistencePayload(envelope, now, {
      eventName,
      channel:             (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:            isHighSov ? Math.min(basePriority + 10, 100) : basePriority,
      adapterSeverity:     gradeSeverity(envelope.grade),
      isHighRecordCount,
      isHighSovereignty:   isHighSov,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                this.resolveTags(['persistence', envelope.outcome.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    });

    const isGradeF = envelope.grade === 'F';
    const envelope_ = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, isGradeF, payload, now,
    );

    this.markAccepted(dedupeKey, envelope_, now);
    this._persistenceCompleted++;
    if (isHighRecordCount) this._highRecordCountEvents++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.complete accepted', {
      runId: envelope.runId, operationId: envelope.operationId,
      totalRecords: envelope.totalRecordsWritten, grade: envelope.grade,
    });

    return envelope_;
  }

  /**
   * Adapt a tick write event from a PersistenceWriteStats into a
   * persistence.tick.written ChatSignalEnvelope.
   *
   * Tick writes are high-volume, low-priority signals. Suppressed when
   * suppressLowPrioritySignals is true and ticksWritten is low. Subject to
   * deduplication.
   */
  public adaptTickWritten(
    stats: PersistenceWriteStatsCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.tick.written';
    const dedupeKey = `persistence.tick:${stats.runId}:${stats.operationId}`;

    // Suppress very low tick counts as noise
    if (
      this.opts.suppressLowPrioritySignals &&
      stats.ticksWritten < 10
    ) {
      return this.suppress('tick count too low for chat signal', {
        runId: stats.runId, ticksWritten: stats.ticksWritten,
      });
    }

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const heat = tickWrittenHeat(stats.ticksWritten);

    const payload: Record<string, JsonValue> = {
      operationId:         stats.operationId,
      runId:               stats.runId,
      ticksWritten:        stats.ticksWritten,
      avgWriteLatencyMs:   parseFloat(stats.avgWriteLatencyMs.toFixed(2)),
      maxWriteLatencyMs:   parseFloat(stats.maxWriteLatencyMs.toFixed(2)),
      totalBytes:          stats.totalBytes,
      errorCount:          stats.errorCount,
      retryCount:          stats.retryCount,
      completedAtMs:       stats.completedAtMs,
      adaptedAtMs:         now as unknown as number,
      eventName,
      channel:             (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:            stats.ticksWritten >= 500 ? 60 : stats.ticksWritten >= 100 ? 45 : 30,
      tickHeadline:        tickWrittenHeadline(stats.ticksWritten),
      tickCoaching:        tickWrittenCoachingMessage(stats.ticksWritten, stats.avgWriteLatencyMs),
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                this.resolveTags(['tick', 'write'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._ticksWritten++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.tick.written accepted', {
      runId: stats.runId, ticksWritten: stats.ticksWritten,
    });

    return envelope;
  }

  /**
   * Adapt a run write event from a PersistenceEnvelope into a
   * persistence.run.written ChatSignalEnvelope.
   *
   * Run writes are important milestone signals. Grade A/S runs have boosted
   * priority. Subject to deduplication by runId.
   */
  public adaptRunWritten(
    envelope: PersistenceEnvelopeCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.run.written';
    const dedupeKey = `persistence.run:${envelope.runId}:${envelope.operationId}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(envelope.cordScore);
    const sov100   = clamp100(envelope.sovereigntyScore);
    const heat     = runWrittenHeat(envelope.grade, envelope.outcome);
    const priority = GRADE_PRIORITY[envelope.grade] ?? 55;

    const payload: Record<string, JsonValue> = {
      operationId:           envelope.operationId,
      runId:                 envelope.runId,
      userId:                envelope.userId,
      proofHash:             envelope.proofHash,
      grade:                 envelope.grade,
      outcome:               envelope.outcome,
      mode:                  envelope.mode,
      integrityStatus:       envelope.integrityStatus,
      cordScore01:           parseFloat(cord01.toFixed(6)),
      sovereigntyScore100:   sov100,
      finalNetWorth:         Math.round(envelope.finalNetWorth),
      storageBackend:        envelope.storageBackend,
      completedAtMs:         envelope.completedAtMs,
      adaptedAtMs:           now as unknown as number,
      eventName,
      channel:               (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority,
      runHeadline:           runWrittenHeadline(envelope.grade, envelope.outcome),
      runCoaching:           runWrittenCoachingMessage(envelope.grade, envelope.sovereigntyScore),
      adapterSeverity:       gradeSeverity(envelope.grade),
      source:                ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                  this.resolveTags(['run', envelope.grade.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const isGradeF = envelope.grade === 'F';
    const result = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, isGradeF, payload, now,
    );

    this.markAccepted(dedupeKey, result, now);
    this._runsWritten++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.run.written accepted', {
      runId: envelope.runId, grade: envelope.grade, outcome: envelope.outcome,
    });

    return result;
  }

  /**
   * Adapt an artifact write event from a PersistenceEnvelope into a
   * persistence.artifact.written ChatSignalEnvelope.
   *
   * Subject to deduplication. Artifact persistence confirms that export
   * artifacts have been durably stored.
   */
  public adaptArtifactWritten(
    envelope: PersistenceEnvelopeCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.artifact.written';
    const dedupeKey = `persistence.artifact:${envelope.runId}:${envelope.operationId}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100 = clamp100(envelope.sovereigntyScore);
    const heat   = artifactWrittenHeat(envelope.artifactsWritten);

    const payload: Record<string, JsonValue> = {
      operationId:           envelope.operationId,
      runId:                 envelope.runId,
      userId:                envelope.userId,
      proofHash:             envelope.proofHash,
      grade:                 envelope.grade,
      outcome:               envelope.outcome,
      artifactsWritten:      envelope.artifactsWritten,
      integrityStatus:       envelope.integrityStatus,
      sovereigntyScore100:   sov100,
      storageBackend:        envelope.storageBackend,
      checksum:              envelope.checksum,
      completedAtMs:         envelope.completedAtMs,
      adaptedAtMs:           now as unknown as number,
      eventName,
      channel:               (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:              envelope.artifactsWritten >= 3 ? 65 : 50,
      artifactHeadline:      artifactWrittenHeadline(envelope.artifactsWritten),
      source:                ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                  this.resolveTags(['artifact', 'write'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const result = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, result, now);
    this._artifactsWritten++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.artifact.written accepted', {
      runId: envelope.runId, artifactsWritten: envelope.artifactsWritten,
    });

    return result;
  }

  /**
   * Adapt an audit write event from a PersistenceEnvelope into a
   * persistence.audit.written ChatSignalEnvelope.
   *
   * Subject to deduplication. Audit persistence confirms that audit records
   * have been durably stored for compliance and replay.
   */
  public adaptAuditWritten(
    envelope: PersistenceEnvelopeCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.audit.written';
    const dedupeKey = `persistence.audit.written:${envelope.runId}:${envelope.operationId}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(envelope.sovereigntyScore);
    const priority = INTEGRITY_PRIORITY[envelope.integrityStatus] ?? 40;
    const heat     = clamp01(priority / 100);
    const isQuarantined = envelope.integrityStatus === 'QUARANTINED';

    const payload: Record<string, JsonValue> = {
      operationId:           envelope.operationId,
      runId:                 envelope.runId,
      userId:                envelope.userId,
      proofHash:             envelope.proofHash,
      grade:                 envelope.grade,
      integrityStatus:       envelope.integrityStatus,
      auditRecordsWritten:   envelope.auditRecordsWritten,
      sovereigntyScore100:   sov100,
      storageBackend:        envelope.storageBackend,
      completedAtMs:         envelope.completedAtMs,
      adaptedAtMs:           now as unknown as number,
      eventName,
      channel:               (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority,
      isQuarantined,
      auditHeadline:         auditWrittenHeadline(envelope.auditRecordsWritten),
      source:                ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                  this.resolveTags(['audit', 'write'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const result = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, isQuarantined, payload, now,
    );

    this.markAccepted(dedupeKey, result, now);
    this._auditsWritten++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.audit.written accepted', {
      runId: envelope.runId, auditRecordsWritten: envelope.auditRecordsWritten,
    });

    return result;
  }

  /**
   * Adapt a batch completion event into a persistence.batch.complete
   * ChatSignalEnvelope.
   *
   * Subject to normal deduplication. Batch completions inform the companion
   * about the overall persistence pipeline status.
   */
  public adaptBatchComplete(
    batchSize: number,
    totalRecords: number,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.batch.complete';
    const dedupeKey = `persistence.batch:${batchSize}:${now as unknown as number}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const clampedBatch   = Math.max(0, Math.round(batchSize));
    const clampedRecords = Math.max(0, Math.round(totalRecords));
    const heat = batchCompleteHeat(clampedBatch, clampedRecords);
    const priority = clampedBatch >= 10 ? 70 : clampedBatch >= 5 ? 55 : 40;

    const payload: Record<string, JsonValue> = {
      eventName,
      batchSize:            clampedBatch,
      totalRecords:         clampedRecords,
      adaptedAtMs:          now as unknown as number,
      channel:              (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority,
      batchHeadline:        batchCompleteHeadline(clampedBatch, clampedRecords),
      batchCoaching:        batchCoachingMessage(clampedBatch, clampedRecords),
      source:               ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                 this.resolveTags(['batch'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._batchesCompleted++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.batch.complete accepted', {
      batchSize: clampedBatch, totalRecords: clampedRecords,
    });

    return envelope;
  }

  /**
   * Adapt a PersistenceMLVector into a persistence.ml.vector_emitted
   * ChatSignalEnvelope.
   *
   * Gated — only emitted when emitMLVectors is true. ML vectors are diagnostic
   * signals for offline analytics and model training, not for companion coaching.
   * The feature array is summarized (avg, min, max, shape) rather than inlined
   * to avoid oversized payloads in the chat ingress lane.
   */
  public adaptMLVector(
    vector: PersistenceMLVectorCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitMLVectors) {
      return this.suppress('ML vectors disabled', { dimensionality: vector.dimensionality });
    }

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.ml.vector_emitted';
    const dedupeKey = `persistence.ml.vector:${vector.runId}:${vector.checksum}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const featureCount = vector.features.length;
    const sum  = featureCount > 0 ? vector.features.reduce((a, b) => a + b, 0) : 0;
    const avg  = featureCount > 0 ? sum / featureCount : 0;
    const minF = featureCount > 0 ? Math.min(...vector.features) : 0;
    const maxF = featureCount > 0 ? Math.max(...vector.features) : 0;

    // Clamp the average to [0,1] as a heat signal — feature values may exceed unit range
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:              vector.runId,
      operationId:        vector.operationId,
      featureCount,
      dimensionality:     vector.dimensionality,
      avgFeatureValue:    parseFloat(avg.toFixed(8)),
      minFeatureValue:    parseFloat(minF.toFixed(8)),
      maxFeatureValue:    parseFloat(maxF.toFixed(8)),
      checksum:           vector.checksum,
      extractedAtMs:      vector.extractedAtMs,
      adaptedAtMs:        now as unknown as number,
      sampleLabels:       vector.featureLabels.slice(0, 8).join(','),
      eventName,
      channel:            (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:           30,
      source:             ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:               this.resolveTags(['ml', 'vector'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._mlVectors++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.ml.vector_emitted accepted', {
      runId: vector.runId, dimensionality: vector.dimensionality, featureCount,
    });

    return envelope;
  }

  /**
   * Adapt a PersistenceDLTensor into a persistence.dl.tensor_emitted
   * ChatSignalEnvelope.
   *
   * Gated — only emitted when emitDLTensors is true. DL tensors are deep-learning
   * input vectors for offline model training, not for companion coaching.
   * L2 norm is computed to give the companion AI a sense of tensor magnitude.
   */
  public adaptDLTensor(
    tensor: PersistenceDLTensorCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitDLTensors) {
      return this.suppress('DL tensors disabled', { dimensionality: tensor.dimensionality });
    }

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.dl.tensor_emitted';
    const dedupeKey = `persistence.dl.tensor:${tensor.runId}:${tensor.checksum}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const inputCount = tensor.features.length;
    const sum    = inputCount > 0 ? tensor.features.reduce((a, b) => a + b, 0) : 0;
    const avg    = inputCount > 0 ? sum / inputCount : 0;
    const sumSq  = inputCount > 0 ? tensor.features.reduce((a, b) => a + b * b, 0) : 0;
    const l2norm = inputCount > 0 ? Math.sqrt(sumSq) : 0;

    // Clamp avg to [0,1] for heat — tensor inputs span arbitrary range
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:              tensor.runId,
      operationId:        tensor.operationId,
      policyVersion:      tensor.policyVersion,
      inputCount,
      dimensionality:     tensor.dimensionality,
      tensorShape:        JSON.stringify(tensor.shape),
      avgInputValue:      parseFloat(avg.toFixed(8)),
      l2norm:             parseFloat(l2norm.toFixed(8)),
      checksum:           tensor.checksum,
      extractedAtMs:      tensor.extractedAtMs,
      adaptedAtMs:        now as unknown as number,
      sampleLabels:       tensor.featureLabels.slice(0, 8).join(','),
      eventName,
      channel:            (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:           25,
      source:             ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:               this.resolveTags(['dl', 'tensor'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._dlTensors++;

    this.logger.debug('PersistenceWriterSignalAdapter: persistence.dl.tensor_emitted accepted', {
      runId: tensor.runId, dimensionality: tensor.dimensionality, inputCount,
    });

    return envelope;
  }

  /**
   * Adapt a PersistenceAuditEntry into a persistence.audit.entry
   * ChatSignalEnvelope.
   *
   * CRITICAL audit entries are always accepted when alwaysAcceptCriticalAudit is
   * true. LOW entries are suppressed when suppressLowPrioritySignals is true.
   * All other entries are subject to deduplication.
   *
   * The HMAC signature is included in metadata for downstream integrity
   * verification — it is not displayed to the player.
   */
  public adaptAuditEntry(
    entry: PersistenceAuditEntryCompat,
    ctx?: PersistenceSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: PersistenceSignalAdapterEventName = 'persistence.audit.entry';
    const dedupeKey = `persistence.audit.entry:${entry.entryId}`;

    const isCritical     = entry.severity === 'CRITICAL';
    const isAlwaysAccept = isCritical && this.opts.alwaysAcceptCriticalAudit;

    // Suppress LOW audit signals
    if (
      !isAlwaysAccept &&
      this.opts.suppressLowPrioritySignals &&
      entry.severity === 'LOW'
    ) {
      return this.suppress('audit LOW suppressed', {
        entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType,
      });
    }

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const priority = AUDIT_SEVERITY_PRIORITY[entry.severity] ?? 25;
    const heat     = clamp01(priority / 100) as Score01;
    const severity = auditSeverity(entry.severity);

    // Flatten audit metadata — only include JsonValue-compatible fields
    const flatMeta: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(entry.metadata)) {
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        v === null
      ) {
        flatMeta[k] = v as JsonValue;
      }
    }

    const isQuarantined = entry.integrityStatus === 'QUARANTINED';

    const payload: Record<string, JsonValue> = {
      entryId:             entry.entryId,
      operationId:         entry.operationId,
      runId:               entry.runId,
      eventType:           entry.eventType,
      severity:            entry.severity,
      adapterSeverity:     severity,
      message:             entry.message,
      integrityStatus:     entry.integrityStatus,
      capturedAtMs:        entry.capturedAtMs,
      hmacSignature:       entry.hmacSignature,
      adaptedAtMs:         now as unknown as number,
      priority,
      eventName,
      isQuarantined,
      isCritical,
      auditHeadline:       auditEntryHeadline(entry.severity, entry.eventType),
      auditMeta:           flatMeta as unknown as JsonValue,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                this.resolveTags(['audit', entry.severity.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildPersistenceLiveopsEnvelope(
      eventName, roomId, heat, isQuarantined, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._auditEntries++;
    if (isCritical) this._criticalAuditCount++;

    if (isCritical) {
      this.logger.warn('PersistenceWriterSignalAdapter: CRITICAL audit entry', {
        entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType,
      });
    } else {
      this.logger.debug('PersistenceWriterSignalAdapter: persistence.audit.entry accepted', {
        entryId: entry.entryId, severity: entry.severity,
      });
    }

    return envelope;
  }

  // ── State query methods ────────────────────────────────────────────────────

  /** Returns cumulative adapter stats. */
  public getStats(): PersistenceSignalAdapterStats {
    return Object.freeze({
      totalAdapted:           this._totalAdapted,
      totalSuppressed:        this._totalSuppressed,
      totalDeduped:           this._totalDeduped,
      persistenceCompleted:   this._persistenceCompleted,
      ticksWritten:           this._ticksWritten,
      runsWritten:            this._runsWritten,
      artifactsWritten:       this._artifactsWritten,
      auditsWritten:          this._auditsWritten,
      batchesCompleted:       this._batchesCompleted,
      auditEntriesAdapted:    this._auditEntries,
      mlVectorsEmitted:       this._mlVectors,
      dlTensorsEmitted:       this._dlTensors,
      highRecordCountEvents:  this._highRecordCountEvents,
      criticalAuditCount:     this._criticalAuditCount,
    });
  }

  /** Returns the history ring buffer (most recent entries last). */
  public getHistory(): readonly ChatSignalEnvelope[] {
    return Object.freeze([...this._history]);
  }

  /** Clears the history buffer. Does not reset stats. */
  public clearHistory(): void {
    this._history.length = 0;
    this._lastAcceptedAt.clear();
    this.logger.debug('PersistenceWriterSignalAdapter: history cleared', {});
  }

  /** Resets all stats counters to zero. Does not clear history. */
  public resetStats(): void {
    this._totalAdapted          = 0;
    this._totalSuppressed       = 0;
    this._totalDeduped          = 0;
    this._persistenceCompleted  = 0;
    this._ticksWritten          = 0;
    this._runsWritten           = 0;
    this._artifactsWritten      = 0;
    this._auditsWritten         = 0;
    this._batchesCompleted      = 0;
    this._auditEntries          = 0;
    this._mlVectors             = 0;
    this._dlTensors             = 0;
    this._highRecordCountEvents = 0;
    this._criticalAuditCount    = 0;
    this.logger.debug('PersistenceWriterSignalAdapter: stats reset', {});
  }
}

// ============================================================================
// SECTION 8 — BATCH HELPERS
// ============================================================================

/**
 * Adapt all signal types from a single PersistenceEnvelope in canonical
 * emission order: complete → tick → run → artifact → audit.
 *
 * Returns only non-null envelopes. Callers can pass the full array to the
 * ChatEngine ingress surface for ordered delivery.
 *
 * The adapter's dedupe state ensures downstream idempotence even if this
 * function is called multiple times for the same runId/operationId pair.
 */
export function adaptAllPersistenceSignals(
  adapter: PersistenceWriterSignalAdapter,
  envelope: PersistenceEnvelopeCompat,
  stats?: PersistenceWriteStatsCompat,
  ctx?: PersistenceSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const complete  = adapter.adaptPersistenceComplete(envelope, ctx);
  if (complete !== null) envelopes.push(complete);

  if (stats !== undefined) {
    const tick = adapter.adaptTickWritten(stats, ctx);
    if (tick !== null) envelopes.push(tick);
  }

  const run = adapter.adaptRunWritten(envelope, ctx);
  if (run !== null) envelopes.push(run);

  const artifact = adapter.adaptArtifactWritten(envelope, ctx);
  if (artifact !== null) envelopes.push(artifact);

  const audit = adapter.adaptAuditWritten(envelope, ctx);
  if (audit !== null) envelopes.push(audit);

  return Object.freeze(envelopes);
}

/**
 * Adapt a persistence envelope + optional ML vector + optional DL tensor +
 * optional audit entries in one call.
 *
 * Emits only envelopes that pass the adapter's filtering rules. Returns the
 * frozen array in emission order:
 *   complete → tick → run → artifact → audit → ml → dl → audit entries
 */
export function adaptPersistenceBundle(
  adapter: PersistenceWriterSignalAdapter,
  envelope: PersistenceEnvelopeCompat,
  stats?: PersistenceWriteStatsCompat,
  mlVector?: PersistenceMLVectorCompat,
  dlTensor?: PersistenceDLTensorCompat,
  auditEntries?: readonly PersistenceAuditEntryCompat[],
  ctx?: PersistenceSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  // Core signals
  const coreSignals = adaptAllPersistenceSignals(adapter, envelope, stats, ctx);
  for (const env of coreSignals) {
    envelopes.push(env);
  }

  // ML vector
  if (mlVector !== undefined) {
    const ml = adapter.adaptMLVector(mlVector, ctx);
    if (ml !== null) envelopes.push(ml);
  }

  // DL tensor
  if (dlTensor !== undefined) {
    const dl = adapter.adaptDLTensor(dlTensor, ctx);
    if (dl !== null) envelopes.push(dl);
  }

  // Audit entries
  if (auditEntries !== undefined) {
    for (const entry of auditEntries) {
      const auditEnv = adapter.adaptAuditEntry(entry, ctx);
      if (auditEnv !== null) envelopes.push(auditEnv);
    }
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt an array of PersistenceAuditEntries into ChatSignalEnvelopes.
 *
 * Entries are processed in the order supplied — typically chronological
 * capturedAtMs order as emitted by the SovereigntyPersistenceWriter audit
 * trail. CRITICAL entries will always pass through. LOW entries obey the
 * suppression policy.
 */
export function adaptPersistenceAuditBatch(
  adapter: PersistenceWriterSignalAdapter,
  entries: readonly PersistenceAuditEntryCompat[],
  ctx?: PersistenceSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const entry of entries) {
    const env = adapter.adaptAuditEntry(entry, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

/**
 * Adapt multiple ML vectors from a persistence batch into ChatSignalEnvelopes.
 *
 * Only emits envelopes when emitMLVectors is true. Returns the frozen array.
 */
export function adaptPersistenceMLBatch(
  adapter: PersistenceWriterSignalAdapter,
  vectors: readonly PersistenceMLVectorCompat[],
  ctx?: PersistenceSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const vector of vectors) {
    const env = adapter.adaptMLVector(vector, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

/**
 * Adapt multiple DL tensors from a persistence batch into ChatSignalEnvelopes.
 *
 * Only emits envelopes when emitDLTensors is true. Returns the frozen array.
 */
export function adaptPersistenceDLBatch(
  adapter: PersistenceWriterSignalAdapter,
  tensors: readonly PersistenceDLTensorCompat[],
  ctx?: PersistenceSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const tensor of tensors) {
    const env = adapter.adaptDLTensor(tensor, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

// ============================================================================
// SECTION 9 — FACTORY
// ============================================================================

/**
 * Convenience factory that creates a PersistenceWriterSignalAdapter with
 * production-safe defaults:
 * - alwaysAcceptHighRecordCount: true
 * - alwaysAcceptCriticalAudit: true
 * - suppressLowPrioritySignals: true
 * - emitMLVectors: false (opt-in)
 * - emitDLTensors: false (opt-in)
 * - dedupeWindowMs: 5000
 * - maxHistory: 200
 * - highRecordCountThreshold: 50
 * - highSovereigntyThreshold: 80
 */
export function createPersistenceWriterSignalAdapter(
  defaultRoomId: ChatRoomId | string,
  overrides?: Partial<PersistenceWriterSignalAdapterOptions>,
): PersistenceWriterSignalAdapter {
  return new PersistenceWriterSignalAdapter({
    defaultRoomId,
    defaultVisibleChannel:       'GLOBAL',
    dedupeWindowMs:              DEFAULT_DEDUPE_WINDOW_MS,
    maxHistory:                  DEFAULT_MAX_HISTORY,
    alwaysAcceptHighRecordCount: true,
    alwaysAcceptCriticalAudit:   true,
    suppressLowPrioritySignals:  true,
    emitMLVectors:               false,
    emitDLTensors:               false,
    highRecordCountThreshold:    DEFAULT_HIGH_RECORD_COUNT_THRESHOLD,
    highSovereigntyThreshold:    DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
    ...overrides,
  });
}

// ============================================================================
// SECTION 10 — SELF-DESCRIPTION MANIFEST
// ============================================================================

/** Static manifest describing this adapter's event vocabulary and capabilities. */
export const PERSISTENCE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  adapterName:    'PersistenceWriterSignalAdapter',
  version:        '2026.03.26',
  sourceFile:     'backend/src/game/engine/chat/adapters/PersistenceWriterSignalAdapter.ts',
  signalType:     'LIVEOPS' as const,
  events: Object.freeze([
    'persistence.complete',
    'persistence.tick.written',
    'persistence.run.written',
    'persistence.artifact.written',
    'persistence.audit.written',
    'persistence.batch.complete',
    'persistence.ml.vector_emitted',
    'persistence.dl.tensor_emitted',
    'persistence.audit.entry',
  ] as const),
  designLaws: Object.freeze([
    'No circular imports from core/ — all types mirrored structurally.',
    'Persistence complete with high record counts always accepted.',
    'CRITICAL audit entries always accepted (helperBlackout=true for QUARANTINED).',
    'LOW priority signals suppressed by default.',
    'ML/DL vectors only emitted when flags are enabled.',
    'All runtime functions (asUnixMs, clamp01, clamp100) consumed in runtime code.',
    'Dedupe is per (runId + operationId + eventClass) key.',
    'History is ring-buffered at maxHistory entries.',
  ] as const),
});
