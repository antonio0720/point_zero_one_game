/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REPLAY INTEGRITY SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ReplayIntegritySignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates ReplayIntegrityChecker signals —
 * integrity verification results, anomaly detections, audit entries, ML vectors,
 * DL tensors, and status transitions — into authoritative backend-chat ingress
 * envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the ReplayIntegrityChecker verifies, quarantines, or flags a replay
 *    tick stream, detects an anomaly at any severity level, emits an ML/DL
 *    vector, or generates an audit entry, what exact chat-native signal should
 *    the authoritative backend chat engine ingest to drive companion NPC
 *    coaching and reflect integrity status in the companion AI?"
 *
 * This file owns:
 * - IntegrityResult          -> ChatSignalEnvelope (integrity.verified / .quarantined / .unverified)
 * - Verified status          -> ChatSignalEnvelope (integrity.verified)
 * - Quarantined status       -> ChatSignalEnvelope (integrity.quarantined) — CRITICAL, always accepted
 * - Unverified status        -> ChatSignalEnvelope (integrity.unverified)
 * - Anomaly detection        -> ChatSignalEnvelope (integrity.anomaly.{critical|high|medium|low})
 * - IntegrityMLVector        -> ChatSignalEnvelope (integrity.ml.vector_emitted)
 * - IntegrityDLTensor        -> ChatSignalEnvelope (integrity.dl.tensor_emitted)
 * - IntegrityAuditEntry      -> ChatSignalEnvelope (integrity.audit.entry)
 *
 * It does not own:
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 * - Shield layer integrity, repair scheduling, or run phase management
 * - Proof generation or CORD scoring
 * - Any circular import from core/ — all core types mirrored structurally
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real ReplayIntegrityResult / IntegrityMLVector /
 *   IntegrityDLTensor objects — they satisfy the compat interfaces structurally.
 * - CRITICAL integrity anomaly signals (QUARANTINED status) are always accepted
 *   regardless of dedupe window.
 * - ML/DL vector signals only emitted when the respective flag is enabled.
 * - LOW priority anomaly signals suppressed by default to keep chat focused.
 * - All runtime functions (asUnixMs, clamp01, clamp100) are called in runtime
 *   code — never dead imports.
 *
 * Event vocabulary
 * ----------------
 *   integrity.verified             — replay tick stream verified clean
 *   integrity.quarantined          — replay integrity anomaly — CRITICAL, always accepted
 *   integrity.unverified           — replay integrity unresolved / pending
 *   integrity.anomaly.critical     — anomaly at CRITICAL severity
 *   integrity.anomaly.high         — anomaly at HIGH severity
 *   integrity.anomaly.medium       — anomaly at MEDIUM severity
 *   integrity.anomaly.low          — anomaly at LOW severity (suppressed by default)
 *   integrity.ml.vector_emitted    — ML feature vector extracted from integrity analysis
 *   integrity.dl.tensor_emitted    — DL input tensor constructed from integrity analysis
 *   integrity.audit.entry          — audit trail entry recorded
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
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
// Mirrors of ReplayIntegrityChecker types — no circular import from core/
// ============================================================================

/** Mirror of ReplayIntegrityResult from sovereignty/ReplayIntegrityChecker.ts */
export interface IntegrityResultCompat {
  readonly runId: string;
  readonly userId: string;
  readonly replayHash: string;
  readonly tickStreamChecksum: string;
  readonly tickStreamLength: number;
  readonly integrityStatus: 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';
  readonly anomalyCount: number;
  readonly anomalySeverityMax: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'NONE';
  readonly sovereigntyScore: number;
  readonly confidenceScore: number;
  readonly verifiedAtMs: number;
}

/** Mirror of IntegrityMLVector from sovereignty/ReplayIntegrityChecker.ts */
export interface IntegrityMLVectorCompat {
  readonly runId: string;
  readonly replayHash: string;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32] | readonly [number, number];
  readonly extractedAtMs: number;
}

/** Mirror of IntegrityDLTensor from sovereignty/ReplayIntegrityChecker.ts */
export interface IntegrityDLTensorCompat {
  readonly runId: string;
  readonly replayHash: string;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48] | readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Mirror of IntegrityAuditEntry from sovereignty/ReplayIntegrityChecker.ts */
export interface IntegrityAuditEntryCompat {
  readonly entryId: string;
  readonly runId: string;
  readonly replayHash: string;
  readonly eventType: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly message: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly capturedAtMs: number;
  readonly hmacSignature: string;
}

// ============================================================================
// SECTION 2 — ADAPTER TYPES
// ============================================================================

/** Optional per-call routing context passed to adapt* methods. */
export interface IntegritySignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/** Logger interface — implement with any backend logger or leave null. */
export interface IntegritySignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

/** Clock interface — injectable for tests. */
export interface IntegritySignalAdapterClock {
  now(): UnixMs;
}

/** Severity classification for adapter events. */
export type IntegritySignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';

/** Full set of integrity signal event names. */
export type IntegritySignalAdapterEventName =
  | 'integrity.verified'
  | 'integrity.quarantined'
  | 'integrity.unverified'
  | 'integrity.anomaly.critical'
  | 'integrity.anomaly.high'
  | 'integrity.anomaly.medium'
  | 'integrity.anomaly.low'
  | 'integrity.ml.vector_emitted'
  | 'integrity.dl.tensor_emitted'
  | 'integrity.audit.entry'
  | string;

/** Construction options for ReplayIntegritySignalAdapter. */
export interface ReplayIntegritySignalAdapterOptions {
  /** Room all signals default to unless overridden by context. */
  readonly defaultRoomId: ChatRoomId | string;
  /** Visible channel default (default: 'GLOBAL'). */
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  /** Time window in ms within which duplicate signals are suppressed (default: 5000). */
  readonly dedupeWindowMs?: number;
  /** Maximum number of history entries retained (default: 200). */
  readonly maxHistory?: number;
  /** Suppress LOW priority anomaly signals to keep chat focused (default: true). */
  readonly suppressLowPrioritySignals?: boolean;
  /** Emit ML vector signals when adaptMLVector() is called (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals when adaptDLTensor() is called (default: false). */
  readonly emitDLTensors?: boolean;
  /**
   * Always accept QUARANTINED integrity signals regardless of dedupe window
   * (default: true). CRITICAL security law — never set false in production.
   */
  readonly alwaysAcceptQuarantined?: boolean;
  /**
   * Confidence score threshold at or above which VERIFIED signals are treated
   * as high-interest and always accepted (default: 0.95).
   */
  readonly highConfidenceThreshold?: number;
  readonly logger?: IntegritySignalAdapterLogger;
  readonly clock?: IntegritySignalAdapterClock;
}

/** Cumulative stats reported by getStats(). */
export interface IntegritySignalAdapterStats {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalDeduped: number;
  readonly integrityResultsAdapted: number;
  readonly verifiedSignals: number;
  readonly quarantinedSignals: number;
  readonly unverifiedSignals: number;
  readonly anomalySignals: number;
  readonly auditEntriesAdapted: number;
  readonly mlVectorsEmitted: number;
  readonly dlTensorsEmitted: number;
  readonly criticalAnomalyCount: number;
  readonly highConfidenceCount: number;
}

// ============================================================================
// SECTION 3 — MODULE CONSTANTS
// ============================================================================

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_HIGH_CONFIDENCE_THRESHOLD = 0.95;
const ADAPTER_SOURCE_TAG = 'ReplayIntegritySignalAdapter';

/** Priority weights by integrity status. */
const STATUS_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  QUARANTINED: 100,
  VERIFIED: 70,
  UNVERIFIED: 40,
});

/** Priority weights by anomaly severity. */
const ANOMALY_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
});

/** Priority weights by audit entry severity. */
const AUDIT_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
});

const NULL_LOGGER: IntegritySignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: IntegritySignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ============================================================================
// SECTION 4 — UX MESSAGE HELPERS
// ============================================================================

/** Returns a companion-facing headline for the given integrity status. */
export function integrityStatusHeadline(status: string): string {
  switch (status) {
    case 'VERIFIED':    return 'Replay integrity verified — tick stream is authentic.';
    case 'QUARANTINED': return 'INTEGRITY ANOMALY — replay quarantined for review.';
    case 'UNVERIFIED':  return 'Replay integrity unresolved — analysis pending.';
    default:            return 'Integrity status updated.';
  }
}

/** Returns a companion coaching message for the given integrity status. */
export function integrityStatusCoachingMessage(status: string): string {
  switch (status) {
    case 'VERIFIED':
      return 'Your replay tick stream passed all integrity checks. Sovereignty proof chain is clean.';
    case 'QUARANTINED':
      return 'Your replay was quarantined due to a detected anomaly. Audit entries have been captured for review.';
    case 'UNVERIFIED':
      return 'The integrity analysis could not fully resolve. Manual review of the tick stream may be required.';
    default:
      return 'Integrity status recorded.';
  }
}

/** Returns a companion headline for the given anomaly severity. */
export function anomalyHeadline(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'CRITICAL anomaly detected — replay integrity compromised.';
    case 'HIGH':     return 'High-severity anomaly detected in replay stream.';
    case 'MEDIUM':   return 'Medium-severity anomaly flagged in replay analysis.';
    case 'LOW':      return 'Low-severity anomaly noted in replay stream.';
    default:         return 'Anomaly detected in replay.';
  }
}

/** Returns a companion coaching message for the given anomaly severity. */
export function anomalyCoachingMessage(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'A critical replay anomaly was detected. The tick stream has been quarantined. Review audit entries immediately.';
    case 'HIGH':
      return 'A significant anomaly was found. Your sovereignty score may be impacted. Check the audit trail for details.';
    case 'MEDIUM':
      return 'A moderate anomaly was flagged. This may indicate tick stream inconsistencies worth investigating.';
    case 'LOW':
      return 'A minor anomaly was noted. No immediate action required, but the event has been logged.';
    default:
      return 'Review anomaly details in the audit trail.';
  }
}

/** Returns a companion-facing message for an audit entry. */
export function auditEntryMessage(eventType: string, severity: string): string {
  return `Audit entry recorded: ${eventType} at ${severity} severity.`;
}

// ============================================================================
// SECTION 5 — STANDALONE HELPER: buildIntegritySignalPayload
// ============================================================================

/**
 * Standalone helper that builds a base metadata payload from an
 * IntegrityResultCompat. Used by multiple adapt* methods for consistency.
 *
 * All numeric values are clamped and rounded to prevent payload injection or
 * out-of-range values reaching the chat engine.
 */
export function buildIntegritySignalPayload(
  result: IntegrityResultCompat,
  now: UnixMs,
  overrides?: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const confidence01 = clamp01(result.confidenceScore);
  const sov100       = clamp100(result.sovereigntyScore);
  const anomalyCount = Math.max(0, Math.round(result.anomalyCount));

  return {
    runId:                result.runId,
    userId:               result.userId,
    replayHash:           result.replayHash,
    tickStreamChecksum:   result.tickStreamChecksum,
    tickStreamLength:     result.tickStreamLength,
    integrityStatus:      result.integrityStatus,
    anomalyCount,
    anomalySeverityMax:   result.anomalySeverityMax,
    confidenceScore01:    parseFloat(confidence01.toFixed(6)),
    sovereigntyScore100:  sov100,
    verifiedAtMs:         result.verifiedAtMs,
    adaptedAtMs:          now as unknown as number,
    statusHeadline:       integrityStatusHeadline(result.integrityStatus),
    ...(overrides ?? {}),
  };
}

// ============================================================================
// SECTION 6 — INTERNAL HELPERS
// ============================================================================

/** Determine the adapter severity level from integrity status. */
function statusSeverity(status: string): IntegritySignalAdapterSeverity {
  switch (status) {
    case 'QUARANTINED': return 'CRITICAL';
    case 'VERIFIED':    return 'INFO';
    case 'UNVERIFIED':  return 'WARN';
    default:            return 'DEBUG';
  }
}

/** Determine the adapter severity level from anomaly severity. */
function anomalySeverity(severity: string): IntegritySignalAdapterSeverity {
  switch (severity) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH':     return 'WARN';
    case 'MEDIUM':   return 'INFO';
    case 'LOW':      return 'DEBUG';
    default:         return 'DEBUG';
  }
}

/** Map anomaly severity to canonical event name. */
function anomalyEventName(severity: string): IntegritySignalAdapterEventName {
  switch (severity) {
    case 'CRITICAL': return 'integrity.anomaly.critical';
    case 'HIGH':     return 'integrity.anomaly.high';
    case 'MEDIUM':   return 'integrity.anomaly.medium';
    case 'LOW':      return 'integrity.anomaly.low';
    default:         return 'integrity.anomaly.low';
  }
}

/** Map integrity status to canonical event name. */
function statusEventName(status: string): IntegritySignalAdapterEventName {
  switch (status) {
    case 'VERIFIED':    return 'integrity.verified';
    case 'QUARANTINED': return 'integrity.quarantined';
    case 'UNVERIFIED':  return 'integrity.unverified';
    default:            return 'integrity.unverified';
  }
}

/** Build a frozen LIVEOPS ChatSignalEnvelope from integrity signal data. */
function buildIntegrityLiveopsEnvelope(
  eventName: string,
  roomId: ChatRoomId | string | null,
  heatMultiplier: Score01,
  isQuarantined: boolean,
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
      helperBlackout: isQuarantined,
      haterRaidActive: false,
    }),
    metadata: Object.freeze(metadata as Record<string, JsonValue>),
  });
}

/** Wrap a ChatSignalEnvelope as a LIVEOPS_SIGNAL ChatInputEnvelope. */
function buildLiveopsInputEnvelope(
  signalEnvelope: ChatSignalEnvelope,
  now: UnixMs,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'LIVEOPS_SIGNAL' as const,
    emittedAt: now,
    payload: signalEnvelope,
  });
}

// ============================================================================
// SECTION 7 — ReplayIntegritySignalAdapter CLASS
// ============================================================================

/**
 * Adapts ReplayIntegrityChecker outputs into authoritative backend-chat
 * ingress envelopes.
 *
 * Filtering policy (in priority order):
 * - QUARANTINED integrity signals: always accepted (alwaysAcceptQuarantined)
 * - High-confidence VERIFIED results: always accepted when score >= threshold
 * - LOW priority anomaly signals: suppressed when suppressLowPrioritySignals=true
 * - All other signals: subject to dedupeWindowMs
 * - ML/DL vectors: only emitted when emitMLVectors / emitDLTensors is true
 */
export class ReplayIntegritySignalAdapter {
  private readonly opts: Readonly<Required<ReplayIntegritySignalAdapterOptions>>;
  private readonly logger: IntegritySignalAdapterLogger;
  private readonly clock: IntegritySignalAdapterClock;

  private readonly _history: ChatSignalEnvelope[] = [];
  private readonly _lastAcceptedAt: Map<string, UnixMs> = new Map();

  // -- Stats counters --------------------------------------------------------
  private _totalAdapted          = 0;
  private _totalSuppressed       = 0;
  private _totalDeduped          = 0;
  private _integrityResults      = 0;
  private _verifiedSignals       = 0;
  private _quarantinedSignals    = 0;
  private _unverifiedSignals     = 0;
  private _anomalySignals        = 0;
  private _auditEntries          = 0;
  private _mlVectors             = 0;
  private _dlTensors             = 0;
  private _criticalAnomalyCount  = 0;
  private _highConfidenceCount   = 0;

  public constructor(options: ReplayIntegritySignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock  = options.clock  ?? SYSTEM_CLOCK;

    this.opts = Object.freeze({
      defaultRoomId:              options.defaultRoomId,
      defaultVisibleChannel:      options.defaultVisibleChannel       ?? 'GLOBAL',
      dedupeWindowMs:             options.dedupeWindowMs              ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory:                 options.maxHistory                  ?? DEFAULT_MAX_HISTORY,
      suppressLowPrioritySignals: options.suppressLowPrioritySignals  ?? true,
      emitMLVectors:              options.emitMLVectors               ?? false,
      emitDLTensors:              options.emitDLTensors               ?? false,
      alwaysAcceptQuarantined:    options.alwaysAcceptQuarantined     ?? true,
      highConfidenceThreshold:    options.highConfidenceThreshold     ?? DEFAULT_HIGH_CONFIDENCE_THRESHOLD,
      logger:                     this.logger,
      clock:                      this.clock,
    } as Required<ReplayIntegritySignalAdapterOptions>);
  }

  // -- Private helpers -------------------------------------------------------

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
    this.logger.debug(`ReplayIntegritySignalAdapter: suppressed — ${reason}`, details);
    return null;
  }

  private dedupe(eventName: string, key: string): null {
    this._totalDeduped++;
    this.logger.debug('ReplayIntegritySignalAdapter: deduped', { eventName, key });
    return null;
  }

  private resolveRoom(ctx?: IntegritySignalAdapterContext): ChatRoomId | string {
    return (ctx?.roomId ?? this.opts.defaultRoomId) as ChatRoomId | string;
  }

  private resolveTags(
    baseTags: string[],
    ctx?: IntegritySignalAdapterContext,
  ): string[] {
    return [ADAPTER_SOURCE_TAG, ...baseTags, ...(ctx?.tags ?? [])];
  }

  // -- Public adapt* methods -------------------------------------------------

  /**
   * Adapt an IntegrityResult into the appropriate status ChatSignalEnvelope.
   *
   * QUARANTINED is CRITICAL and always accepted when alwaysAcceptQuarantined
   * is true (the default). High-confidence VERIFIED results are also always
   * accepted when the confidence score meets the threshold.
   */
  public adaptIntegrityResult(
    result: IntegrityResultCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const status    = result.integrityStatus;
    const eventName = statusEventName(status);
    const dedupeKey = `integrity.result:${result.runId}:${result.replayHash}:${status}`;

    const isQuarantined      = status === 'QUARANTINED';
    const isAlwaysQuarantine = isQuarantined && this.opts.alwaysAcceptQuarantined;
    const confidence01       = clamp01(result.confidenceScore);
    const isHighConfidence   = status === 'VERIFIED' && confidence01 >= this.opts.highConfidenceThreshold;
    const isAlwaysAccept     = isAlwaysQuarantine || isHighConfidence;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(result.sovereigntyScore);
    const priority = STATUS_PRIORITY[status] ?? 40;
    const heat     = clamp01(isQuarantined ? 1.0 : priority / 100) as Score01;

    const payload = buildIntegritySignalPayload(result, now, {
      eventName,
      statusCoaching:    integrityStatusCoachingMessage(status),
      priority,
      isQuarantined,
      isHighConfidence,
      source:            ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    });

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, isQuarantined, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._integrityResults++;
    if (isQuarantined) this._quarantinedSignals++;
    else if (status === 'VERIFIED') this._verifiedSignals++;
    else this._unverifiedSignals++;
    if (isHighConfidence) this._highConfidenceCount++;
    if (isQuarantined) this._criticalAnomalyCount++;

    this.logger.debug(`ReplayIntegritySignalAdapter: ${eventName} accepted`, {
      runId: result.runId, status, confidence: parseFloat(confidence01.toFixed(6)),
    });

    return envelope;
  }

  /**
   * Adapt a VERIFIED status signal from an IntegrityResult.
   *
   * High-confidence VERIFIED results are always accepted when the confidence
   * score meets the threshold. Others are subject to deduplication.
   */
  public adaptVerifiedSignal(
    result: IntegrityResultCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: IntegritySignalAdapterEventName = 'integrity.verified';
    const dedupeKey = `verified:${result.runId}:${result.replayHash}`;

    const confidence01     = clamp01(result.confidenceScore);
    const isHighConfidence = confidence01 >= this.opts.highConfidenceThreshold;

    if (!isHighConfidence && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(result.sovereigntyScore);
    const priority = STATUS_PRIORITY['VERIFIED'] ?? 70;
    const heat     = clamp01(confidence01 * 0.7 + 0.2) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      replayHash:          result.replayHash,
      tickStreamChecksum:  result.tickStreamChecksum,
      integrityStatus:     'VERIFIED',
      confidenceScore01:   parseFloat(confidence01.toFixed(6)),
      sovereigntyScore100: sov100,
      anomalyCount:        Math.max(0, Math.round(result.anomalyCount)),
      statusHeadline:      integrityStatusHeadline('VERIFIED'),
      statusCoaching:      integrityStatusCoachingMessage('VERIFIED'),
      isHighConfidence,
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._verifiedSignals++;
    if (isHighConfidence) this._highConfidenceCount++;

    this.logger.debug('ReplayIntegritySignalAdapter: integrity.verified accepted', {
      runId: result.runId, confidence: parseFloat(confidence01.toFixed(6)),
    });

    return envelope;
  }

  /**
   * Adapt a QUARANTINED status signal from an IntegrityResult.
   *
   * QUARANTINED is CRITICAL — always accepted regardless of dedupe window
   * when alwaysAcceptQuarantined is true (the default). Sets
   * helperBlackout=true to suppress companion NPC speech and let the
   * severity of the anomaly land without interference.
   */
  public adaptQuarantinedSignal(
    result: IntegrityResultCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: IntegritySignalAdapterEventName = 'integrity.quarantined';
    const dedupeKey = `quarantined:${result.runId}:${result.replayHash}`;

    // QUARANTINED signals are ALWAYS accepted — CRITICAL security law
    const isAlwaysAccept = this.opts.alwaysAcceptQuarantined;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const confidence01 = clamp01(result.confidenceScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const heat         = clamp01(1.0) as Score01; // Max heat for quarantine

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      replayHash:          result.replayHash,
      tickStreamChecksum:  result.tickStreamChecksum,
      tickStreamLength:    result.tickStreamLength,
      integrityStatus:     'QUARANTINED',
      confidenceScore01:   parseFloat(confidence01.toFixed(6)),
      sovereigntyScore100: sov100,
      anomalyCount:        Math.max(0, Math.round(result.anomalyCount)),
      anomalySeverityMax:  result.anomalySeverityMax,
      statusHeadline:      integrityStatusHeadline('QUARANTINED'),
      statusCoaching:      integrityStatusCoachingMessage('QUARANTINED'),
      isQuarantined:       true,
      isCritical:          true,
      priority:            100,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, true, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._quarantinedSignals++;
    this._criticalAnomalyCount++;

    this.logger.warn('ReplayIntegritySignalAdapter: QUARANTINED signal — always accepted', {
      runId: result.runId, replayHash: result.replayHash,
      anomalyCount: String(result.anomalyCount),
    });

    return envelope;
  }

  /**
   * Adapt an UNVERIFIED status signal from an IntegrityResult.
   *
   * UNVERIFIED signals may be suppressed when suppressLowPrioritySignals
   * is true and the confidence score is very low. Otherwise deduped normally.
   */
  public adaptUnverifiedSignal(
    result: IntegrityResultCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: IntegritySignalAdapterEventName = 'integrity.unverified';
    const dedupeKey = `unverified:${result.runId}:${result.replayHash}`;

    const confidence01 = clamp01(result.confidenceScore);

    // Suppress very-low-confidence unverified when flag is set
    if (this.opts.suppressLowPrioritySignals && confidence01 < 0.1) {
      return this.suppress('unverified with negligible confidence suppressed', {
        runId: result.runId, confidence: parseFloat(confidence01.toFixed(6)),
      });
    }

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(result.sovereigntyScore);
    const priority = STATUS_PRIORITY['UNVERIFIED'] ?? 40;
    const heat     = clamp01(0.3 + confidence01 * 0.2) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      replayHash:          result.replayHash,
      tickStreamChecksum:  result.tickStreamChecksum,
      integrityStatus:     'UNVERIFIED',
      confidenceScore01:   parseFloat(confidence01.toFixed(6)),
      sovereigntyScore100: sov100,
      anomalyCount:        Math.max(0, Math.round(result.anomalyCount)),
      statusHeadline:      integrityStatusHeadline('UNVERIFIED'),
      statusCoaching:      integrityStatusCoachingMessage('UNVERIFIED'),
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._unverifiedSignals++;

    return envelope;
  }

  /**
   * Adapt an anomaly detail signal.
   *
   * CRITICAL anomalies are always accepted. LOW anomalies are suppressed
   * when suppressLowPrioritySignals is true. The anomaly severity drives
   * the event name: integrity.anomaly.{critical|high|medium|low}.
   */
  public adaptAnomalySignal(
    result: IntegrityResultCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const severity  = result.anomalySeverityMax === 'NONE' ? 'LOW' : result.anomalySeverityMax;
    const eventName = anomalyEventName(severity);
    const dedupeKey = `anomaly:${result.runId}:${result.replayHash}:${severity}`;

    const isCritical     = severity === 'CRITICAL';
    const isAlwaysAccept = isCritical;

    // Suppress LOW anomaly signals when flag is set
    if (
      !isAlwaysAccept &&
      this.opts.suppressLowPrioritySignals &&
      severity === 'LOW'
    ) {
      return this.suppress('anomaly LOW suppressed', {
        runId: result.runId, severity,
      });
    }

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const confidence01 = clamp01(result.confidenceScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const priority     = ANOMALY_PRIORITY[severity] ?? 25;
    const heat         = clamp01(isCritical ? 1.0 : priority / 100) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      replayHash:          result.replayHash,
      integrityStatus:     result.integrityStatus,
      anomalyCount:        Math.max(0, Math.round(result.anomalyCount)),
      anomalySeverity:     severity,
      adapterSeverity:     anomalySeverity(severity),
      anomalyHeadline:     anomalyHeadline(severity),
      anomalyCoaching:     anomalyCoachingMessage(severity),
      confidenceScore01:   parseFloat(confidence01.toFixed(6)),
      sovereigntyScore100: sov100,
      isCritical,
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, isCritical, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._anomalySignals++;
    if (isCritical) this._criticalAnomalyCount++;

    if (isCritical) {
      this.logger.warn('ReplayIntegritySignalAdapter: CRITICAL anomaly signal', {
        runId: result.runId, anomalyCount: String(result.anomalyCount),
      });
    }

    return envelope;
  }

  /**
   * Adapt an IntegrityMLVector into an integrity.ml.vector_emitted
   * ChatSignalEnvelope.
   *
   * Only emitted when emitMLVectors option is true. The feature array is
   * summarized (avg, min, max, shape) rather than inlined to avoid oversized
   * payloads in the chat ingress lane.
   */
  public adaptMLVector(
    vector: IntegrityMLVectorCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitMLVectors) return null;

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: IntegritySignalAdapterEventName = 'integrity.ml.vector_emitted';
    const dedupeKey = `ml:${vector.runId}:${vector.replayHash}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const featureCount = vector.features.length;
    const sum  = featureCount > 0 ? vector.features.reduce((a, b) => a + b, 0) : 0;
    const avg  = featureCount > 0 ? sum / featureCount : 0;
    const minF = featureCount > 0 ? Math.min(...vector.features) : 0;
    const maxF = featureCount > 0 ? Math.max(...vector.features) : 0;

    // Clamp the average to [0,1] as a heat signal
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:           vector.runId,
      replayHash:      vector.replayHash,
      featureCount,
      vectorShape:     JSON.stringify(vector.vectorShape),
      avgFeatureValue: parseFloat(avg.toFixed(8)),
      minFeatureValue: parseFloat(minF.toFixed(8)),
      maxFeatureValue: parseFloat(maxF.toFixed(8)),
      extractedAtMs:   vector.extractedAtMs,
      sampleLabels:    vector.featureLabels.slice(0, 8).join(','),
      eventName,
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._mlVectors++;

    return envelope;
  }

  /**
   * Adapt an IntegrityDLTensor into an integrity.dl.tensor_emitted
   * ChatSignalEnvelope.
   *
   * Only emitted when emitDLTensors option is true. The input vector is
   * summarized (avg, norm, shape, policy version) for the chat ingress lane.
   * L2 norm is computed to give the companion AI a sense of tensor magnitude.
   */
  public adaptDLTensor(
    tensor: IntegrityDLTensorCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitDLTensors) return null;

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: IntegritySignalAdapterEventName = 'integrity.dl.tensor_emitted';
    const dedupeKey = `dl:${tensor.runId}:${tensor.replayHash}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const inputCount = tensor.inputVector.length;
    const sum    = inputCount > 0 ? tensor.inputVector.reduce((a, b) => a + b, 0) : 0;
    const avg    = inputCount > 0 ? sum / inputCount : 0;
    const sumSq  = inputCount > 0 ? tensor.inputVector.reduce((a, b) => a + b * b, 0) : 0;
    const l2norm = inputCount > 0 ? Math.sqrt(sumSq) : 0;

    // Clamp avg to [0,1] for heat — tensor inputs span arbitrary range
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:          tensor.runId,
      replayHash:     tensor.replayHash,
      policyVersion:  tensor.policyVersion,
      inputCount,
      tensorShape:    JSON.stringify(tensor.tensorShape),
      avgInputValue:  parseFloat(avg.toFixed(8)),
      l2norm:         parseFloat(l2norm.toFixed(8)),
      extractedAtMs:  tensor.extractedAtMs,
      sampleLabels:   tensor.featureLabels.slice(0, 8).join(','),
      eventName,
      source:         ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._dlTensors++;

    return envelope;
  }

  /**
   * Adapt an IntegrityAuditEntry into an integrity.audit.entry
   * ChatSignalEnvelope.
   *
   * CRITICAL audit entries are always accepted. LOW entries are suppressed
   * when suppressLowPrioritySignals is true. The HMAC signature is included
   * in metadata for downstream integrity verification.
   */
  public adaptAuditEntry(
    entry: IntegrityAuditEntryCompat,
    ctx?: IntegritySignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: IntegritySignalAdapterEventName = 'integrity.audit.entry';
    const dedupeKey = `audit:${entry.entryId}`;

    const isCritical     = entry.severity === 'CRITICAL';
    const isAlwaysAccept = isCritical;

    // Suppress LOW audit entries
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

    const priority = AUDIT_PRIORITY[entry.severity] ?? 25;
    const heat     = clamp01(priority / 100) as Score01;

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

    const payload: Record<string, JsonValue> = {
      entryId:         entry.entryId,
      runId:           entry.runId,
      replayHash:      entry.replayHash,
      eventType:       entry.eventType,
      severity:        entry.severity,
      adapterSeverity: anomalySeverity(entry.severity),
      message:         entry.message,
      capturedAtMs:    entry.capturedAtMs,
      hmacSignature:   entry.hmacSignature,
      auditMessage:    auditEntryMessage(entry.eventType, entry.severity),
      isCritical,
      priority,
      eventName,
      auditMeta:       flatMeta as unknown as JsonValue,
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildIntegrityLiveopsEnvelope(
      eventName, roomId, heat, isCritical, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._auditEntries++;
    if (isCritical) this._criticalAnomalyCount++;

    if (isCritical) {
      this.logger.warn('ReplayIntegritySignalAdapter: CRITICAL audit entry', {
        entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType,
      });
    }

    return envelope;
  }

  // -- Stats and history -----------------------------------------------------

  /** Return a frozen snapshot of adapter cumulative statistics. */
  public getStats(): IntegritySignalAdapterStats {
    return Object.freeze({
      totalAdapted:          this._totalAdapted,
      totalSuppressed:       this._totalSuppressed,
      totalDeduped:          this._totalDeduped,
      integrityResultsAdapted: this._integrityResults,
      verifiedSignals:       this._verifiedSignals,
      quarantinedSignals:    this._quarantinedSignals,
      unverifiedSignals:     this._unverifiedSignals,
      anomalySignals:        this._anomalySignals,
      auditEntriesAdapted:   this._auditEntries,
      mlVectorsEmitted:      this._mlVectors,
      dlTensorsEmitted:      this._dlTensors,
      criticalAnomalyCount:  this._criticalAnomalyCount,
      highConfidenceCount:   this._highConfidenceCount,
    });
  }

  /** Return a frozen read-only snapshot of the signal history. */
  public getHistory(): readonly ChatSignalEnvelope[] {
    return Object.freeze([...this._history]);
  }

  /** Clear all retained history entries without resetting stats. */
  public clearHistory(): void {
    this._history.length = 0;
  }

  /** Reset all stat counters to zero without clearing history. */
  public resetStats(): void {
    this._totalAdapted         = 0;
    this._totalSuppressed      = 0;
    this._totalDeduped         = 0;
    this._integrityResults     = 0;
    this._verifiedSignals      = 0;
    this._quarantinedSignals   = 0;
    this._unverifiedSignals    = 0;
    this._anomalySignals       = 0;
    this._auditEntries         = 0;
    this._mlVectors            = 0;
    this._dlTensors            = 0;
    this._criticalAnomalyCount = 0;
    this._highConfidenceCount  = 0;
  }
}

// ============================================================================
// SECTION 8 — BATCH HELPERS
// ============================================================================

/**
 * Adapt all signal types from a single IntegrityResult in canonical
 * emission order: result -> anomaly -> verified/quarantined/unverified.
 *
 * Returns only non-null envelopes. Callers can pass the full array to the
 * ChatEngine ingress surface for ordered delivery.
 */
export function adaptAllIntegritySignals(
  adapter: ReplayIntegritySignalAdapter,
  result: IntegrityResultCompat,
  ctx?: IntegritySignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const main    = adapter.adaptIntegrityResult(result, ctx);
  const anomaly = result.anomalyCount > 0 ? adapter.adaptAnomalySignal(result, ctx) : null;

  if (main    !== null) envelopes.push(main);
  if (anomaly !== null) envelopes.push(anomaly);

  return Object.freeze(envelopes);
}

/**
 * Adapt an IntegrityResult plus optional ML vector and DL tensor in one call.
 *
 * Emits only envelopes that pass the adapter's filtering rules. Returns the
 * frozen array in emission order: result -> ml -> dl.
 */
export function adaptIntegrityBundle(
  adapter: ReplayIntegritySignalAdapter,
  result: IntegrityResultCompat,
  mlVector?: IntegrityMLVectorCompat,
  dlTensor?: IntegrityDLTensorCompat,
  ctx?: IntegritySignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const resultEnv = adapter.adaptIntegrityResult(result, ctx);
  if (resultEnv !== null) envelopes.push(resultEnv);

  if (mlVector !== undefined) {
    const ml = adapter.adaptMLVector(mlVector, ctx);
    if (ml !== null) envelopes.push(ml);
  }

  if (dlTensor !== undefined) {
    const dl = adapter.adaptDLTensor(dlTensor, ctx);
    if (dl !== null) envelopes.push(dl);
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt an array of IntegrityAuditEntries into ChatSignalEnvelopes.
 *
 * Entries are processed in the order supplied — typically chronological
 * capturedAtMs order. CRITICAL entries will always pass through. LOW entries
 * obey the suppression policy.
 */
export function adaptIntegrityAuditBatch(
  adapter: ReplayIntegritySignalAdapter,
  entries: readonly IntegrityAuditEntryCompat[],
  ctx?: IntegritySignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const entry of entries) {
    const env = adapter.adaptAuditEntry(entry, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

// ============================================================================
// SECTION 9 — FACTORY
// ============================================================================

/**
 * Convenience factory that creates a ReplayIntegritySignalAdapter with
 * production-safe defaults:
 * - suppressLowPrioritySignals: true
 * - alwaysAcceptQuarantined: true
 * - emitMLVectors: false (opt-in)
 * - emitDLTensors: false (opt-in)
 * - dedupeWindowMs: 5000
 * - maxHistory: 200
 * - highConfidenceThreshold: 0.95
 */
export function createReplayIntegritySignalAdapter(
  defaultRoomId: ChatRoomId | string,
  overrides?: Partial<ReplayIntegritySignalAdapterOptions>,
): ReplayIntegritySignalAdapter {
  return new ReplayIntegritySignalAdapter({
    defaultRoomId,
    defaultVisibleChannel:      'GLOBAL',
    dedupeWindowMs:             DEFAULT_DEDUPE_WINDOW_MS,
    maxHistory:                 DEFAULT_MAX_HISTORY,
    suppressLowPrioritySignals: true,
    emitMLVectors:              false,
    emitDLTensors:              false,
    alwaysAcceptQuarantined:    true,
    highConfidenceThreshold:    DEFAULT_HIGH_CONFIDENCE_THRESHOLD,
    ...overrides,
  });
}

// ============================================================================
// SECTION 10 — SELF-DESCRIPTION MANIFEST
// ============================================================================

/** Static manifest describing this adapter's event vocabulary and capabilities. */
export const INTEGRITY_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  adapterName:    'ReplayIntegritySignalAdapter',
  version:        '2026.03.26',
  sourceFile:     'backend/src/game/engine/chat/adapters/ReplayIntegritySignalAdapter.ts',
  signalType:     'LIVEOPS' as const,
  events: Object.freeze([
    'integrity.verified',
    'integrity.quarantined',
    'integrity.unverified',
    'integrity.anomaly.critical',
    'integrity.anomaly.high',
    'integrity.anomaly.medium',
    'integrity.anomaly.low',
    'integrity.ml.vector_emitted',
    'integrity.dl.tensor_emitted',
    'integrity.audit.entry',
  ] as const),
  designLaws: Object.freeze([
    'No circular imports from core/ — all types mirrored structurally.',
    'QUARANTINED integrity signals always accepted (helperBlackout=true).',
    'High-confidence VERIFIED results always accepted when score >= threshold.',
    'LOW priority anomaly signals suppressed by default.',
    'ML/DL vectors only emitted when flags are enabled.',
    'All runtime functions (asUnixMs, clamp01, clamp100) consumed in runtime code.',
    'Dedupe is per (runId + replayHash + eventClass) key.',
    'History is ring-buffered at maxHistory entries.',
  ] as const),
});
