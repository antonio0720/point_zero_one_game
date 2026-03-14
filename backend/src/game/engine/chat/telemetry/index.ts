/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TELEMETRY MODULE BARREL
 * FILE: backend/src/game/engine/chat/telemetry/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is not a thin barrel.
 *
 * In the lane you locked, telemetry is part of backend chat truth, which means
 * the index surface must do more than `export *`. It has to expose one
 * authoritative telemetry module that composes:
 *
 * - ChatTelemetrySink.ts
 * - ChatEventStreamWriter.ts
 *
 * into one deterministic backend-facing subsystem.
 *
 * Why this file is intentionally large
 * -----------------------------------
 * A normal index file would be short. That would be wrong here.
 *
 * Your backend chat lane is being elevated into the same class of authority as
 * battle, time, pressure, tension, shield, sovereignty, and zero. The public
 * telemetry surface therefore needs to own:
 *
 * 1. subsystem construction,
 * 2. sink + stream orchestration,
 * 3. automatic mirror policy,
 * 4. transaction and delta processing helpers,
 * 5. replay / learning / audit query helpers,
 * 6. stream hydration and NDJSON import/export,
 * 7. room / session / user pulse projections,
 * 8. diagnostics and lifecycle stats.
 *
 * This file therefore acts as the authoritative telemetry lane façade.
 *
 * It does not replace the sink or the writer.
 * It binds them together without flattening their responsibilities.
 *
 * Lane doctrine
 * -------------
 * - The sink remains the authoritative telemetry admission + flush surface.
 * - The stream writer remains the authoritative append/query/index surface.
 * - This module coordinates them without turning either into a donor-zone echo.
 * - Telemetry never mutates transcript truth.
 * - The module respects backend sequencing, replay linkage, proof linkage, and
 *   learning relevance instead of inventing side-channel semantics.
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  asUnixMs,
  clamp01,
  type ChatEngineTransaction,
  type ChatNormalizedInput,
  type ChatRoomId,
  type ChatSessionId,
  type ChatState,
  type ChatStateDelta,
  type ChatTelemetryEnvelope,
  type ChatTelemetryId,
  type ChatUserId,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from '../types';
import {
  buildFingerprint,
  createChatTelemetrySink,
  dedupeTelemetryStable,
  deriveUrgency,
  hash32,
  sanitizeEnvelope,
  stableJsonStringify,
  stableSortTelemetryBatch,
  summarizeText,
  type ChatTelemetryCaptureResult,
  type ChatTelemetryDeltaBuildResult,
  type ChatTelemetryEnvelopeSeed,
  type ChatTelemetryFlushReason,
  type ChatTelemetryFlushResult,
  type ChatTelemetrySinkApi,
  type ChatTelemetrySinkCaptureSource,
  type ChatTelemetrySinkDiagnostics,
  type ChatTelemetrySinkOptions,
  type ChatTelemetrySinkSnapshot,
  type ChatTelemetrySinkUrgency,
  type ChatTelemetryTransactionBuildResult,
} from './ChatTelemetrySink';
import {
  createChatEventStreamWriter,
  stableSortRecords,
  verifySnapshotIntegrity,
  type ChatEventStreamAppendResult,
  type ChatEventStreamCompactionResult,
  type ChatEventStreamDiagnostics,
  type ChatEventStreamRangeRequest,
  type ChatEventStreamRangeResult,
  type ChatEventStreamRecord,
  type ChatEventStreamRecordId,
  type ChatEventStreamRetentionClass,
  type ChatEventStreamSeverity,
  type ChatEventStreamSnapshot,
  type ChatEventStreamSource,
  type ChatEventStreamWriterApi,
  type ChatEventStreamWriterOptions,
} from './ChatEventStreamWriter';

export * from './ChatTelemetrySink';
export * from './ChatEventStreamWriter';

// ============================================================================
// MARK: Public module contracts
// ============================================================================

export type ChatTelemetryMirrorMode =
  | 'MANUAL'
  | 'ON_CAPTURE'
  | 'ON_FLUSH'
  | 'DUAL_WRITE';

export interface ChatTelemetryModulePolicy {
  readonly mirrorMode: ChatTelemetryMirrorMode;
  readonly syntheticTransactionRecords: boolean;
  readonly syntheticDeltaRecords: boolean;
  readonly compactAfterFlush: boolean;
  readonly compactAfterImport: boolean;
  readonly ndjsonImportIgnoreInvalidLines: boolean;
  readonly recentTimelineDefaultLimit: number;
}

export interface ChatTelemetryModuleOptions {
  readonly sink?: ChatTelemetrySinkOptions;
  readonly stream?: ChatEventStreamWriterOptions;
  readonly policy?: Partial<ChatTelemetryModulePolicy>;
}

export interface ChatTelemetryModuleStats {
  readonly processedEnvelopes: number;
  readonly processedTransactions: number;
  readonly processedDeltas: number;
  readonly mirroredEnvelopes: number;
  readonly skippedMirrors: number;
  readonly ndjsonImportedLines: number;
  readonly ndjsonRejectedLines: number;
  readonly compactions: number;
  readonly manualWrites: number;
  readonly flushes: number;
}

export interface ChatTelemetryModuleSnapshot {
  readonly version: typeof BACKEND_CHAT_ENGINE_VERSION;
  readonly sink: ChatTelemetrySinkSnapshot;
  readonly stream: ChatEventStreamSnapshot;
  readonly stats: ChatTelemetryModuleStats;
  readonly mirroredTelemetryIds: readonly ChatTelemetryId[];
  readonly integrityIssues: readonly string[];
  readonly mirrorMode: ChatTelemetryMirrorMode;
}

export interface ChatTelemetryModuleDiagnostics {
  readonly version: typeof BACKEND_CHAT_ENGINE_VERSION;
  readonly sink: ChatTelemetrySinkDiagnostics;
  readonly stream: ChatEventStreamDiagnostics;
  readonly stats: ChatTelemetryModuleStats;
  readonly mirrorCoverage01: number;
  readonly replayCoverage01: number;
  readonly learningCoverage01: number;
  readonly integrityIssues: readonly string[];
}

export interface ChatTelemetryTimelineEntry {
  readonly recordId: ChatEventStreamRecordId;
  readonly eventName: ChatTelemetryEnvelope['eventName'];
  readonly source: ChatEventStreamSource;
  readonly urgency: ChatTelemetrySinkUrgency;
  readonly severity: ChatEventStreamSeverity;
  readonly retention: ChatEventStreamRetentionClass;
  readonly recordedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly replayWorthy: boolean;
  readonly learningRelevant: boolean;
  readonly summary: string;
  readonly tags: readonly string[];
}

export interface ChatTelemetryPulse {
  readonly totalRecords: number;
  readonly replayWorthyCount: number;
  readonly learningRelevantCount: number;
  readonly severityCounts: Readonly<Record<ChatEventStreamSeverity, number>>;
  readonly urgencyCounts: Readonly<Record<ChatTelemetrySinkUrgency, number>>;
  readonly sourceCounts: Readonly<Record<ChatEventStreamSource, number>>;
  readonly eventCounts: Readonly<Record<ChatTelemetryEnvelope['eventName'], number>>;
  readonly oldestRecordedAt: Nullable<UnixMs>;
  readonly newestRecordedAt: Nullable<UnixMs>;
}

export interface ChatTelemetrySummaryBurst {
  readonly total: number;
  readonly eventCounts: Readonly<Record<ChatTelemetryEnvelope['eventName'], number>>;
  readonly topTags: readonly string[];
  readonly firstRecordedAt: Nullable<UnixMs>;
  readonly lastRecordedAt: Nullable<UnixMs>;
  readonly lines: readonly string[];
}

export interface ChatTelemetryProcessAcceptedBatchResult {
  readonly capture: ChatTelemetryCaptureResult;
  readonly streamAppend: ChatEventStreamAppendResult;
  readonly diagnostics: ChatTelemetryModuleDiagnostics;
}

export interface ChatTelemetryProcessDeltaResult {
  readonly build: ChatTelemetryDeltaBuildResult;
  readonly capture: ChatTelemetryCaptureResult;
  readonly streamAppend: ChatEventStreamAppendResult;
  readonly diagnostics: ChatTelemetryModuleDiagnostics;
}

export interface ChatTelemetryProcessTransactionResult {
  readonly build: ChatTelemetryTransactionBuildResult;
  readonly capture: ChatTelemetryCaptureResult;
  readonly streamAppend: ChatEventStreamAppendResult;
  readonly syntheticAppend: ChatEventStreamAppendResult;
  readonly diagnostics: ChatTelemetryModuleDiagnostics;
}

export interface ChatTelemetrySyncBufferedResult {
  readonly appended: readonly ChatEventStreamRecord[];
  readonly skippedTelemetryIds: readonly ChatTelemetryId[];
  readonly streamAppend: ChatEventStreamAppendResult;
  readonly diagnostics: ChatTelemetryModuleDiagnostics;
}

export interface ChatTelemetryImportNdjsonResult {
  readonly appended: readonly ChatEventStreamRecord[];
  readonly rejectedLines: readonly { readonly lineNumber: number; readonly reason: string }[];
  readonly streamAppend: ChatEventStreamAppendResult;
  readonly compaction: Nullable<ChatEventStreamCompactionResult>;
  readonly diagnostics: ChatTelemetryModuleDiagnostics;
}

export interface ChatTelemetryHydrateStreamResult {
  readonly streamAppend: ChatEventStreamAppendResult;
  readonly diagnostics: ChatTelemetryModuleDiagnostics;
}

export interface ChatTelemetryFlushAndMirrorResult {
  readonly flush: ChatTelemetryFlushResult;
  readonly streamAppend: ChatEventStreamAppendResult;
  readonly compaction: Nullable<ChatEventStreamCompactionResult>;
  readonly diagnostics: ChatTelemetryModuleDiagnostics;
}

export interface ChatTelemetryModuleApi {
  readonly sink: ChatTelemetrySinkApi;
  readonly stream: ChatEventStreamWriterApi;
  readonly snapshot: () => ChatTelemetryModuleSnapshot;
  readonly diagnostics: () => ChatTelemetryModuleDiagnostics;

  readonly createEnvelope: (seed: ChatTelemetryEnvelopeSeed) => ChatTelemetryEnvelope;
  readonly captureEnvelope: (envelope: ChatTelemetryEnvelope) => ChatTelemetryCaptureResult;
  readonly captureBatch: (
    envelopes: readonly ChatTelemetryEnvelope[],
    source?: ChatTelemetrySinkCaptureSource,
  ) => ChatTelemetryCaptureResult;
  readonly captureFromDelta: (
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
    nextState?: ChatState,
  ) => ChatTelemetryCaptureResult;
  readonly captureFromTransaction: (
    transaction: ChatEngineTransaction,
  ) => ChatTelemetryCaptureResult;

  readonly processAcceptedEnvelope: (
    envelope: ChatTelemetryEnvelope,
  ) => ChatTelemetryProcessAcceptedBatchResult;
  readonly processAcceptedBatch: (
    envelopes: readonly ChatTelemetryEnvelope[],
    source?: ChatTelemetrySinkCaptureSource,
  ) => ChatTelemetryProcessAcceptedBatchResult;
  readonly processDelta: (
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
    nextState?: ChatState,
  ) => ChatTelemetryProcessDeltaResult;
  readonly processTransaction: (
    transaction: ChatEngineTransaction,
  ) => ChatTelemetryProcessTransactionResult;

  readonly queueIntoState: (
    state: ChatState,
    envelopes: readonly ChatTelemetryEnvelope[],
  ) => ChatState;
  readonly flushBuffered: (
    reason?: ChatTelemetryFlushReason,
  ) => Promise<ChatTelemetryFlushAndMirrorResult>;
  readonly flushStateQueue: (
    state: ChatState,
    reason?: ChatTelemetryFlushReason,
  ) => Promise<{ readonly state: ChatState; readonly result: ChatTelemetryFlushAndMirrorResult }>;
  readonly syncBufferedToStream: () => ChatTelemetrySyncBufferedResult;

  readonly writeEnvelope: (envelope: ChatTelemetryEnvelope) => ChatEventStreamAppendResult;
  readonly writeTelemetryBatch: (batch: readonly ChatTelemetryEnvelope[]) => ChatEventStreamAppendResult;
  readonly writeTransaction: (transaction: ChatEngineTransaction) => ChatEventStreamAppendResult;
  readonly writeDelta: (
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
  ) => ChatEventStreamAppendResult;
  readonly appendRecords: (records: readonly ChatEventStreamRecord[]) => ChatEventStreamAppendResult;

  readonly hydrateStream: (records: readonly ChatEventStreamRecord[]) => ChatTelemetryHydrateStreamResult;
  readonly importNdjsonLines: (lines: readonly string[]) => ChatTelemetryImportNdjsonResult;
  readonly compact: () => ChatEventStreamCompactionResult;
  readonly exportNdjsonLines: (request?: ChatEventStreamRangeRequest) => readonly string[];

  readonly getRecord: (recordId: ChatEventStreamRecordId) => Nullable<ChatEventStreamRecord>;
  readonly getByRoom: (roomId: ChatRoomId) => readonly ChatEventStreamRecord[];
  readonly getBySession: (sessionId: ChatSessionId) => readonly ChatEventStreamRecord[];
  readonly getByUser: (userId: ChatUserId) => readonly ChatEventStreamRecord[];
  readonly getByEventName: (
    eventName: ChatTelemetryEnvelope['eventName'],
  ) => readonly ChatEventStreamRecord[];
  readonly queryRange: (request: ChatEventStreamRangeRequest) => ChatEventStreamRangeResult;
  readonly getReplayRelevantRecords: (request?: ChatEventStreamRangeRequest) => readonly ChatEventStreamRecord[];
  readonly getLearningRelevantRecords: (request?: ChatEventStreamRangeRequest) => readonly ChatEventStreamRecord[];
  readonly getRecentTimelineByRoom: (
    roomId: ChatRoomId,
    limit?: number,
  ) => readonly ChatTelemetryTimelineEntry[];
  readonly getRecentTimelineBySession: (
    sessionId: ChatSessionId,
    limit?: number,
  ) => readonly ChatTelemetryTimelineEntry[];
  readonly getRecentTimelineByUser: (
    userId: ChatUserId,
    limit?: number,
  ) => readonly ChatTelemetryTimelineEntry[];
  readonly summarizeEventBurst: (request: ChatEventStreamRangeRequest) => ChatTelemetrySummaryBurst;
  readonly buildRoomPulse: (roomId: ChatRoomId) => ChatTelemetryPulse;
  readonly buildSessionPulse: (sessionId: ChatSessionId) => ChatTelemetryPulse;
  readonly buildUserPulse: (userId: ChatUserId) => ChatTelemetryPulse;

  readonly clear: () => void;
}

// ============================================================================
// MARK: Internal state and defaults
// ============================================================================

interface ChatTelemetryModuleInternalState {
  readonly mirroredTelemetryIds: ReadonlySet<string>;
  readonly stats: ChatTelemetryModuleStats;
}

const DEFAULT_POLICY: ChatTelemetryModulePolicy = Object.freeze({
  mirrorMode: 'DUAL_WRITE',
  syntheticTransactionRecords: true,
  syntheticDeltaRecords: true,
  compactAfterFlush: false,
  compactAfterImport: false,
  ndjsonImportIgnoreInvalidLines: true,
  recentTimelineDefaultLimit: 50,
});

const EMPTY_MODULE_STATS: ChatTelemetryModuleStats = Object.freeze({
  processedEnvelopes: 0,
  processedTransactions: 0,
  processedDeltas: 0,
  mirroredEnvelopes: 0,
  skippedMirrors: 0,
  ndjsonImportedLines: 0,
  ndjsonRejectedLines: 0,
  compactions: 0,
  manualWrites: 0,
  flushes: 0,
});

const STREAM_EMPTY_APPEND: ChatEventStreamAppendResult = Object.freeze({
  appended: Object.freeze([]),
  deduped: Object.freeze([]),
  snapshot: Object.freeze({
    version: BACKEND_CHAT_ENGINE_VERSION,
    recordsById: Object.freeze({}),
    orderedRecordIds: Object.freeze([]),
    byRoom: Object.freeze({}),
    bySession: Object.freeze({}),
    byUser: Object.freeze({}),
    byEventName: Object.freeze({
      chat_opened: Object.freeze([]),
      chat_closed: Object.freeze([]),
      message_sent: Object.freeze([]),
      message_suppressed: Object.freeze([]),
      message_rejected: Object.freeze([]),
      helper_fired: Object.freeze([]),
      hater_escalated: Object.freeze([]),
      invasion_opened: Object.freeze([]),
      invasion_closed: Object.freeze([]),
      channel_switched: Object.freeze([]),
      dropoff_warning: Object.freeze([]),
      presence_updated: Object.freeze([]),
      typing_updated: Object.freeze([]),
      learning_updated: Object.freeze([]),
    }),
  }),
});

// ============================================================================
// MARK: Public factory
// ============================================================================

export function createChatTelemetryModule(
  options: ChatTelemetryModuleOptions = {},
): ChatTelemetryModuleApi {
  const policy = mergeModulePolicy(options.policy);
  const sink = createChatTelemetrySink(options.sink);
  const stream = createChatEventStreamWriter(options.stream);

  let internal: ChatTelemetryModuleInternalState = {
    mirroredTelemetryIds: new Set<string>(),
    stats: EMPTY_MODULE_STATS,
  };

  const api: ChatTelemetryModuleApi = {
    sink,
    stream,
    snapshot,
    diagnostics,

    createEnvelope,
    captureEnvelope,
    captureBatch,
    captureFromDelta,
    captureFromTransaction,

    processAcceptedEnvelope,
    processAcceptedBatch,
    processDelta,
    processTransaction,

    queueIntoState,
    flushBuffered,
    flushStateQueue,
    syncBufferedToStream,

    writeEnvelope,
    writeTelemetryBatch,
    writeTransaction,
    writeDelta,
    appendRecords,

    hydrateStream,
    importNdjsonLines,
    compact,
    exportNdjsonLines,

    getRecord,
    getByRoom,
    getBySession,
    getByUser,
    getByEventName,
    queryRange,
    getReplayRelevantRecords,
    getLearningRelevantRecords,
    getRecentTimelineByRoom,
    getRecentTimelineBySession,
    getRecentTimelineByUser,
    summarizeEventBurst,
    buildRoomPulse,
    buildSessionPulse,
    buildUserPulse,

    clear,
  };

  return api;

  // --------------------------------------------------------------------------
  // MARK: Snapshots / diagnostics
  // --------------------------------------------------------------------------

  function snapshot(): ChatTelemetryModuleSnapshot {
    const sinkSnap = sink.snapshot();
    const streamSnap = stream.snapshot();
    return {
      version: BACKEND_CHAT_ENGINE_VERSION,
      sink: sinkSnap,
      stream: streamSnap,
      stats: cloneModuleStats(internal.stats),
      mirroredTelemetryIds: Object.freeze(Array.from(internal.mirroredTelemetryIds.values()) as ChatTelemetryId[]),
      integrityIssues: Object.freeze(verifySnapshotIntegrity(streamSnap)),
      mirrorMode: policy.mirrorMode,
    };
  }

  function diagnostics(): ChatTelemetryModuleDiagnostics {
    const sinkDiag = sink.diagnostics();
    const streamDiag = stream.diagnostics();
    const totalKnownTelemetry = Math.max(
      1,
      internal.stats.processedEnvelopes,
      internal.mirroredTelemetryIds.size,
      sinkDiag.snapshot.stats.created,
    );
    const mirrorCoverage01 = clamp01(internal.mirroredTelemetryIds.size / totalKnownTelemetry);
    const replayCoverage01 = clamp01(
      streamDiag.totalRecords === 0 ? 0 : streamDiag.replayWorthyCount / Math.max(1, streamDiag.totalRecords),
    );
    const learningCoverage01 = clamp01(
      streamDiag.totalRecords === 0 ? 0 : streamDiag.learningRelevantCount / Math.max(1, streamDiag.totalRecords),
    );

    return {
      version: BACKEND_CHAT_ENGINE_VERSION,
      sink: sinkDiag,
      stream: streamDiag,
      stats: cloneModuleStats(internal.stats),
      mirrorCoverage01,
      replayCoverage01,
      learningCoverage01,
      integrityIssues: Object.freeze(verifySnapshotIntegrity(stream.snapshot())),
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Creation / direct sink capture
  // --------------------------------------------------------------------------

  function createEnvelope(seed: ChatTelemetryEnvelopeSeed): ChatTelemetryEnvelope {
    return sink.createEnvelope(seed);
  }

  function captureEnvelope(envelope: ChatTelemetryEnvelope): ChatTelemetryCaptureResult {
    const result = sink.captureEnvelope(envelope);
    internal = bumpStats(internal, {
      processedEnvelopes: result.accepted.length,
    });
    maybeMirrorAccepted(result.accepted, 'captureEnvelope');
    return result;
  }

  function captureBatch(
    envelopes: readonly ChatTelemetryEnvelope[],
    source: ChatTelemetrySinkCaptureSource = 'BATCH',
  ): ChatTelemetryCaptureResult {
    const ordered = stableSortTelemetryBatch(dedupeTelemetryStable(envelopes));
    const result = sink.captureBatch(ordered, source);
    internal = bumpStats(internal, {
      processedEnvelopes: result.accepted.length,
    });
    maybeMirrorAccepted(result.accepted, 'captureBatch');
    return result;
  }

  function captureFromDelta(
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
    nextState?: ChatState,
  ): ChatTelemetryCaptureResult {
    const result = sink.captureFromDelta(event, delta, nextState);
    internal = bumpStats(internal, {
      processedEnvelopes: result.accepted.length,
      processedDeltas: 1,
    });
    maybeMirrorAccepted(result.accepted, 'captureFromDelta');
    return result;
  }

  function captureFromTransaction(
    transaction: ChatEngineTransaction,
  ): ChatTelemetryCaptureResult {
    const result = sink.captureFromTransaction(transaction);
    internal = bumpStats(internal, {
      processedEnvelopes: result.accepted.length,
      processedTransactions: 1,
    });
    maybeMirrorAccepted(result.accepted, 'captureFromTransaction');
    return result;
  }

  // --------------------------------------------------------------------------
  // MARK: Processors — sink + stream
  // --------------------------------------------------------------------------

  function processAcceptedEnvelope(
    envelope: ChatTelemetryEnvelope,
  ): ChatTelemetryProcessAcceptedBatchResult {
    return processAcceptedBatch([envelope], 'ENVELOPE');
  }

  function processAcceptedBatch(
    envelopes: readonly ChatTelemetryEnvelope[],
    source: ChatTelemetrySinkCaptureSource = 'BATCH',
  ): ChatTelemetryProcessAcceptedBatchResult {
    const capture = sink.captureBatch(stableSortTelemetryBatch(dedupeTelemetryStable(envelopes)), source);
    internal = bumpStats(internal, {
      processedEnvelopes: capture.accepted.length,
    });

    const streamAppend = shouldMirrorOnCapture(policy.mirrorMode)
      ? mirrorAcceptedToStream(capture.accepted)
      : STREAM_EMPTY_APPEND;

    return {
      capture,
      streamAppend,
      diagnostics: diagnostics(),
    };
  }

  function processDelta(
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
    nextState?: ChatState,
  ): ChatTelemetryProcessDeltaResult {
    const build = sink.buildFromDelta(event, delta, nextState);
    const capture = sink.captureBatch(build.envelopes, 'DELTA');

    internal = bumpStats(internal, {
      processedEnvelopes: capture.accepted.length,
      processedDeltas: 1,
    });

    let streamAppend = shouldMirrorOnCapture(policy.mirrorMode)
      ? mirrorAcceptedToStream(capture.accepted)
      : STREAM_EMPTY_APPEND;

    if (policy.syntheticDeltaRecords) {
      const syntheticAppend = stream.writeDelta(event, delta);
      streamAppend = mergeAppendResults(streamAppend, syntheticAppend, stream.snapshot());
    }

    return {
      build,
      capture,
      streamAppend,
      diagnostics: diagnostics(),
    };
  }

  function processTransaction(
    transaction: ChatEngineTransaction,
  ): ChatTelemetryProcessTransactionResult {
    const build = sink.buildFromTransaction(transaction);
    const capture = sink.captureBatch(build.envelopes, 'TRANSACTION');

    internal = bumpStats(internal, {
      processedEnvelopes: capture.accepted.length,
      processedTransactions: 1,
    });

    const streamAppend = shouldMirrorOnCapture(policy.mirrorMode)
      ? mirrorAcceptedToStream(capture.accepted)
      : STREAM_EMPTY_APPEND;

    const syntheticAppend = policy.syntheticTransactionRecords
      ? stream.writeTransaction(transaction)
      : STREAM_EMPTY_APPEND;

    return {
      build,
      capture,
      streamAppend,
      syntheticAppend,
      diagnostics: diagnostics(),
    };
  }

  // --------------------------------------------------------------------------
  // MARK: State queue + flush orchestration
  // --------------------------------------------------------------------------

  function queueIntoState(
    state: ChatState,
    envelopes: readonly ChatTelemetryEnvelope[],
  ): ChatState {
    return sink.queueIntoState(state, envelopes);
  }

  async function flushBuffered(
    reason: ChatTelemetryFlushReason = 'MANUAL',
  ): Promise<ChatTelemetryFlushAndMirrorResult> {
    const preFlushBatch = shouldMirrorOnFlush(policy.mirrorMode)
      ? collectUnmirroredPendingEnvelopes(sink.snapshot().pending)
      : Object.freeze([]) as readonly ChatTelemetryEnvelope[];

    const flush = await sink.flushBuffered(reason);
    internal = bumpStats(internal, { flushes: 1 });

    let streamAppend = STREAM_EMPTY_APPEND;
    if (preFlushBatch.length > 0) {
      streamAppend = mirrorAcceptedToStream(preFlushBatch);
    }

    let compaction: Nullable<ChatEventStreamCompactionResult> = null;
    if (policy.compactAfterFlush) {
      compaction = stream.compact();
      internal = bumpStats(internal, { compactions: 1 });
    }

    return {
      flush,
      streamAppend,
      compaction,
      diagnostics: diagnostics(),
    };
  }

  async function flushStateQueue(
    state: ChatState,
    reason: ChatTelemetryFlushReason = 'STATE_QUEUE',
  ): Promise<{ readonly state: ChatState; readonly result: ChatTelemetryFlushAndMirrorResult }> {
    const preFlushBatch = shouldMirrorOnFlush(policy.mirrorMode)
      ? collectUnmirroredPendingEnvelopes(state.telemetryQueue ?? [])
      : Object.freeze([]) as readonly ChatTelemetryEnvelope[];

    const flushed = await sink.flushStateQueue(state, reason);
    internal = bumpStats(internal, { flushes: 1 });

    let streamAppend = STREAM_EMPTY_APPEND;
    if (preFlushBatch.length > 0) {
      streamAppend = mirrorAcceptedToStream(preFlushBatch);
    }

    let compaction: Nullable<ChatEventStreamCompactionResult> = null;
    if (policy.compactAfterFlush) {
      compaction = stream.compact();
      internal = bumpStats(internal, { compactions: 1 });
    }

    return {
      state: flushed.state,
      result: {
        flush: flushed.result,
        streamAppend,
        compaction,
        diagnostics: diagnostics(),
      },
    };
  }

  function syncBufferedToStream(): ChatTelemetrySyncBufferedResult {
    const unmirrored = collectUnmirroredPendingEnvelopes(sink.snapshot().pending);
    const skipped = collectMirroredTelemetryIds(sink.snapshot().pending, internal.mirroredTelemetryIds);
    const streamAppend = unmirrored.length > 0
      ? mirrorAcceptedToStream(unmirrored)
      : STREAM_EMPTY_APPEND;

    return {
      appended: streamAppend.appended,
      skippedTelemetryIds: Object.freeze(skipped),
      streamAppend,
      diagnostics: diagnostics(),
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Manual stream writes
  // --------------------------------------------------------------------------

  function writeEnvelope(envelope: ChatTelemetryEnvelope): ChatEventStreamAppendResult {
    internal = bumpStats(internal, { manualWrites: 1 });
    markMirroredTelemetryIds([envelope.telemetryId]);
    return stream.writeEnvelope(sanitizeEnvelope(envelope));
  }

  function writeTelemetryBatch(batch: readonly ChatTelemetryEnvelope[]): ChatEventStreamAppendResult {
    const normalized = stableSortTelemetryBatch(batch.map(sanitizeEnvelope));
    internal = bumpStats(internal, { manualWrites: 1 });
    markMirroredTelemetryIds(normalized.map((item) => item.telemetryId));
    return stream.writeTelemetryBatch(normalized);
  }

  function writeTransaction(transaction: ChatEngineTransaction): ChatEventStreamAppendResult {
    internal = bumpStats(internal, {
      manualWrites: 1,
      processedTransactions: 1,
    });
    return stream.writeTransaction(transaction);
  }

  function writeDelta(
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
  ): ChatEventStreamAppendResult {
    internal = bumpStats(internal, {
      manualWrites: 1,
      processedDeltas: 1,
    });
    return stream.writeDelta(event, delta);
  }

  function appendRecords(records: readonly ChatEventStreamRecord[]): ChatEventStreamAppendResult {
    internal = bumpStats(internal, { manualWrites: 1 });
    return stream.appendRecords(stableSortRecords(records));
  }

  // --------------------------------------------------------------------------
  // MARK: Hydration / import / export / compaction
  // --------------------------------------------------------------------------

  function hydrateStream(records: readonly ChatEventStreamRecord[]): ChatTelemetryHydrateStreamResult {
    const streamAppend = stream.appendRecords(stableSortRecords(records));
    return {
      streamAppend,
      diagnostics: diagnostics(),
    };
  }

  function importNdjsonLines(lines: readonly string[]): ChatTelemetryImportNdjsonResult {
    const parsed: ChatEventStreamRecord[] = [];
    const rejected: { lineNumber: number; reason: string }[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index] ?? '';
      const trimmed = rawLine.trim();
      if (trimmed.length === 0) continue;

      try {
        const parsedValue = JSON.parse(trimmed) as unknown;
        const record = parseStreamRecordFromUnknown(parsedValue);
        parsed.push(record);
      } catch (error) {
        const entry = {
          lineNumber: index + 1,
          reason: error instanceof Error ? error.message : 'invalid NDJSON line',
        };
        rejected.push(entry);
        if (!policy.ndjsonImportIgnoreInvalidLines) {
          break;
        }
      }
    }

    const streamAppend = parsed.length > 0
      ? stream.appendRecords(stableSortRecords(parsed))
      : STREAM_EMPTY_APPEND;

    let compaction: Nullable<ChatEventStreamCompactionResult> = null;
    if (policy.compactAfterImport) {
      compaction = stream.compact();
      internal = bumpStats(internal, { compactions: 1 });
    }

    internal = bumpStats(internal, {
      ndjsonImportedLines: parsed.length,
      ndjsonRejectedLines: rejected.length,
    });

    return {
      appended: streamAppend.appended,
      rejectedLines: Object.freeze(rejected),
      streamAppend,
      compaction,
      diagnostics: diagnostics(),
    };
  }

  function compact(): ChatEventStreamCompactionResult {
    const result = stream.compact();
    internal = bumpStats(internal, { compactions: 1 });
    return result;
  }

  function exportNdjsonLines(request?: ChatEventStreamRangeRequest): readonly string[] {
    return stream.exportNdjsonLines(request);
  }

  // --------------------------------------------------------------------------
  // MARK: Stream query surface
  // --------------------------------------------------------------------------

  function getRecord(recordId: ChatEventStreamRecordId): Nullable<ChatEventStreamRecord> {
    return stream.getRecord(recordId);
  }

  function getByRoom(roomId: ChatRoomId): readonly ChatEventStreamRecord[] {
    return stream.getByRoom(roomId);
  }

  function getBySession(sessionId: ChatSessionId): readonly ChatEventStreamRecord[] {
    return stream.getBySession(sessionId);
  }

  function getByUser(userId: ChatUserId): readonly ChatEventStreamRecord[] {
    return stream.getByUser(userId);
  }

  function getByEventName(
    eventName: ChatTelemetryEnvelope['eventName'],
  ): readonly ChatEventStreamRecord[] {
    return stream.getByEventName(eventName);
  }

  function queryRange(request: ChatEventStreamRangeRequest): ChatEventStreamRangeResult {
    return stream.queryRange(request);
  }

  function getReplayRelevantRecords(
    request: ChatEventStreamRangeRequest = {},
  ): readonly ChatEventStreamRecord[] {
    return stream.queryRange({ ...request, replayWorthyOnly: true }).records;
  }

  function getLearningRelevantRecords(
    request: ChatEventStreamRangeRequest = {},
  ): readonly ChatEventStreamRecord[] {
    return stream.queryRange({ ...request, learningRelevantOnly: true }).records;
  }

  function getRecentTimelineByRoom(
    roomId: ChatRoomId,
    limit: number = policy.recentTimelineDefaultLimit,
  ): readonly ChatTelemetryTimelineEntry[] {
    return buildTimelineEntries(
      selectMostRecent(stream.getByRoom(roomId), limit),
    );
  }

  function getRecentTimelineBySession(
    sessionId: ChatSessionId,
    limit: number = policy.recentTimelineDefaultLimit,
  ): readonly ChatTelemetryTimelineEntry[] {
    return buildTimelineEntries(
      selectMostRecent(stream.getBySession(sessionId), limit),
    );
  }

  function getRecentTimelineByUser(
    userId: ChatUserId,
    limit: number = policy.recentTimelineDefaultLimit,
  ): readonly ChatTelemetryTimelineEntry[] {
    return buildTimelineEntries(
      selectMostRecent(stream.getByUser(userId), limit),
    );
  }

  function summarizeEventBurst(request: ChatEventStreamRangeRequest): ChatTelemetrySummaryBurst {
    const range = stream.queryRange(request);
    const eventCounts = createEventCounters();
    const tagCounts = new Map<string, number>();
    let firstRecordedAt: Nullable<UnixMs> = null;
    let lastRecordedAt: Nullable<UnixMs> = null;

    for (const record of range.records) {
      eventCounts[record.eventName] += 1;
      if (firstRecordedAt === null || Number(record.recordedAt) < Number(firstRecordedAt)) {
        firstRecordedAt = record.recordedAt;
      }
      if (lastRecordedAt === null || Number(record.recordedAt) > Number(lastRecordedAt)) {
        lastRecordedAt = record.recordedAt;
      }
      for (const tag of record.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([tag]) => tag);

    const lines = buildBurstLines(range.records);

    return {
      total: range.total,
      eventCounts,
      topTags: Object.freeze(topTags),
      firstRecordedAt,
      lastRecordedAt,
      lines,
    };
  }

  function buildRoomPulse(roomId: ChatRoomId): ChatTelemetryPulse {
    return buildPulse(stream.getByRoom(roomId));
  }

  function buildSessionPulse(sessionId: ChatSessionId): ChatTelemetryPulse {
    return buildPulse(stream.getBySession(sessionId));
  }

  function buildUserPulse(userId: ChatUserId): ChatTelemetryPulse {
    return buildPulse(stream.getByUser(userId));
  }

  // --------------------------------------------------------------------------
  // MARK: Lifecycle
  // --------------------------------------------------------------------------

  function clear(): void {
    sink.clear();
    stream.clear();
    internal = {
      mirroredTelemetryIds: new Set<string>(),
      stats: EMPTY_MODULE_STATS,
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Internal mirror logic
  // --------------------------------------------------------------------------

  function maybeMirrorAccepted(
    accepted: readonly ChatTelemetryEnvelope[],
    _reason: string,
  ): void {
    if (!shouldMirrorOnCapture(policy.mirrorMode)) return;
    if (accepted.length === 0) return;
    mirrorAcceptedToStream(accepted);
  }

  function mirrorAcceptedToStream(
    accepted: readonly ChatTelemetryEnvelope[],
  ): ChatEventStreamAppendResult {
    const toMirror = collectUnmirroredPendingEnvelopes(accepted);
    if (toMirror.length === 0) {
      internal = bumpStats(internal, { skippedMirrors: accepted.length });
      return STREAM_EMPTY_APPEND;
    }

    const append = stream.writeTelemetryBatch(toMirror);
    markMirroredTelemetryIds(toMirror.map((item) => item.telemetryId));
    internal = bumpStats(internal, {
      mirroredEnvelopes: toMirror.length,
      skippedMirrors: Math.max(0, accepted.length - toMirror.length),
    });
    return append;
  }

  function markMirroredTelemetryIds(ids: readonly ChatTelemetryId[]): void {
    if (ids.length === 0) return;
    const next = new Set<string>(internal.mirroredTelemetryIds);
    for (const id of ids) next.add(String(id));
    internal = {
      ...internal,
      mirroredTelemetryIds: next,
    };
  }
}

// ============================================================================
// MARK: Aliases
// ============================================================================

export const createAuthoritativeChatTelemetryModule = createChatTelemetryModule;
export const createBackendChatTelemetryModule = createChatTelemetryModule;

// ============================================================================
// MARK: Helper utilities — policy / stats
// ============================================================================

export function mergeModulePolicy(
  policy: Partial<ChatTelemetryModulePolicy> | undefined,
): ChatTelemetryModulePolicy {
  return Object.freeze({
    ...DEFAULT_POLICY,
    ...(policy ?? {}),
  });
}

export function cloneModuleStats(stats: ChatTelemetryModuleStats): ChatTelemetryModuleStats {
  return {
    processedEnvelopes: stats.processedEnvelopes,
    processedTransactions: stats.processedTransactions,
    processedDeltas: stats.processedDeltas,
    mirroredEnvelopes: stats.mirroredEnvelopes,
    skippedMirrors: stats.skippedMirrors,
    ndjsonImportedLines: stats.ndjsonImportedLines,
    ndjsonRejectedLines: stats.ndjsonRejectedLines,
    compactions: stats.compactions,
    manualWrites: stats.manualWrites,
    flushes: stats.flushes,
  };
}

export function bumpStats(
  state: ChatTelemetryModuleInternalState,
  delta: Partial<ChatTelemetryModuleStats>,
): ChatTelemetryModuleInternalState {
  return {
    ...state,
    stats: {
      processedEnvelopes: state.stats.processedEnvelopes + (delta.processedEnvelopes ?? 0),
      processedTransactions: state.stats.processedTransactions + (delta.processedTransactions ?? 0),
      processedDeltas: state.stats.processedDeltas + (delta.processedDeltas ?? 0),
      mirroredEnvelopes: state.stats.mirroredEnvelopes + (delta.mirroredEnvelopes ?? 0),
      skippedMirrors: state.stats.skippedMirrors + (delta.skippedMirrors ?? 0),
      ndjsonImportedLines: state.stats.ndjsonImportedLines + (delta.ndjsonImportedLines ?? 0),
      ndjsonRejectedLines: state.stats.ndjsonRejectedLines + (delta.ndjsonRejectedLines ?? 0),
      compactions: state.stats.compactions + (delta.compactions ?? 0),
      manualWrites: state.stats.manualWrites + (delta.manualWrites ?? 0),
      flushes: state.stats.flushes + (delta.flushes ?? 0),
    },
  };
}

export function shouldMirrorOnCapture(mode: ChatTelemetryMirrorMode): boolean {
  return mode === 'ON_CAPTURE' || mode === 'DUAL_WRITE';
}

export function shouldMirrorOnFlush(mode: ChatTelemetryMirrorMode): boolean {
  return mode === 'ON_FLUSH' || mode === 'DUAL_WRITE';
}

// ============================================================================
// MARK: Helper utilities — append result handling
// ============================================================================

export function mergeAppendResults(
  left: ChatEventStreamAppendResult,
  right: ChatEventStreamAppendResult,
  snapshot: ChatEventStreamSnapshot,
): ChatEventStreamAppendResult {
  return {
    appended: Object.freeze(stableSortRecords([...left.appended, ...right.appended])),
    deduped: Object.freeze(stableSortRecords([...left.deduped, ...right.deduped])),
    snapshot,
  };
}

export function collectUnmirroredPendingEnvelopes(
  envelopes: readonly ChatTelemetryEnvelope[],
  mirroredIds: ReadonlySet<string> = new Set<string>(),
): readonly ChatTelemetryEnvelope[] {
  const accepted: ChatTelemetryEnvelope[] = [];
  const seen = new Set<string>();

  for (const envelope of stableSortTelemetryBatch(envelopes.map(sanitizeEnvelope))) {
    const telemetryId = String(envelope.telemetryId);
    if (mirroredIds.has(telemetryId)) continue;
    if (seen.has(telemetryId)) continue;
    seen.add(telemetryId);
    accepted.push(envelope);
  }

  return Object.freeze(accepted);
}

export function collectMirroredTelemetryIds(
  envelopes: readonly ChatTelemetryEnvelope[],
  mirroredIds: ReadonlySet<string>,
): readonly ChatTelemetryId[] {
  const ids: ChatTelemetryId[] = [];
  const seen = new Set<string>();
  for (const envelope of envelopes) {
    const id = String(envelope.telemetryId);
    if (!mirroredIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(envelope.telemetryId);
  }
  return Object.freeze(ids);
}

// ============================================================================
// MARK: Helper utilities — timelines / pulses / bursts
// ============================================================================

export function buildTimelineEntries(
  records: readonly ChatEventStreamRecord[],
): readonly ChatTelemetryTimelineEntry[] {
  return Object.freeze(
    stableSortRecords(records).map((record) => ({
      recordId: record.recordId,
      eventName: record.eventName,
      source: record.source,
      urgency: record.urgency,
      severity: record.severity,
      retention: record.retention,
      recordedAt: record.recordedAt,
      roomId: record.roomId,
      sessionId: record.sessionId,
      userId: record.userId,
      replayWorthy: record.replayWorthy,
      learningRelevant: record.learningRelevant,
      summary: summarizeRecord(record),
      tags: record.tags,
    })),
  );
}

export function buildPulse(records: readonly ChatEventStreamRecord[]): ChatTelemetryPulse {
  const severityCounts = createSeverityCounters();
  const urgencyCounts = createUrgencyCounters();
  const sourceCounts = createSourceCounters();
  const eventCounts = createEventCounters();
  let oldestRecordedAt: Nullable<UnixMs> = null;
  let newestRecordedAt: Nullable<UnixMs> = null;
  let replayWorthyCount = 0;
  let learningRelevantCount = 0;

  for (const record of records) {
    severityCounts[record.severity] += 1;
    urgencyCounts[record.urgency] += 1;
    sourceCounts[record.source] += 1;
    eventCounts[record.eventName] += 1;

    if (record.replayWorthy) replayWorthyCount += 1;
    if (record.learningRelevant) learningRelevantCount += 1;
    if (oldestRecordedAt === null || Number(record.recordedAt) < Number(oldestRecordedAt)) {
      oldestRecordedAt = record.recordedAt;
    }
    if (newestRecordedAt === null || Number(record.recordedAt) > Number(newestRecordedAt)) {
      newestRecordedAt = record.recordedAt;
    }
  }

  return {
    totalRecords: records.length,
    replayWorthyCount,
    learningRelevantCount,
    severityCounts,
    urgencyCounts,
    sourceCounts,
    eventCounts,
    oldestRecordedAt,
    newestRecordedAt,
  };
}

export function buildBurstLines(
  records: readonly ChatEventStreamRecord[],
): readonly string[] {
  return Object.freeze(
    stableSortRecords(records).map((record) => {
      const ts = Number(record.recordedAt);
      const room = record.roomId ? ` room=${record.roomId}` : '';
      const session = record.sessionId ? ` session=${record.sessionId}` : '';
      const user = record.userId ? ` user=${record.userId}` : '';
      const tags = record.tags.length > 0 ? ` tags=${record.tags.join(',')}` : '';
      return `${ts} ${record.eventName} [${record.severity}/${record.urgency}]${room}${session}${user}${tags} :: ${summarizeRecord(record)}`;
    }),
  );
}

export function selectMostRecent(
  records: readonly ChatEventStreamRecord[],
  limit: number,
): readonly ChatEventStreamRecord[] {
  const bounded = Math.max(0, Math.floor(limit));
  if (bounded <= 0) return Object.freeze([]);
  const ordered = stableSortRecords(records);
  if (ordered.length <= bounded) return ordered;
  return Object.freeze(ordered.slice(ordered.length - bounded));
}

export function summarizeRecord(record: ChatEventStreamRecord): string {
  const payload = record.payload;
  const preferred = [
    readStringish(payload['summary']),
    readStringish(payload['messagePreview']),
    readStringish(payload['messageText']),
    readStringish(payload['reason']),
    readStringish(payload['label']),
    readStringish(payload['status']),
  ].filter(Boolean) as string[];

  if (preferred.length > 0) {
    return summarizeText(preferred[0]);
  }

  if (record.linkedMessageIds.length > 0) {
    return `linked messages=${record.linkedMessageIds.length}`;
  }

  if (record.linkedReplayIds.length > 0) {
    return `linked replays=${record.linkedReplayIds.length}`;
  }

  if (record.tags.length > 0) {
    return `tags=${record.tags.join(', ')}`;
  }

  return summarizeText(stableJsonStringify(normalizePayloadForSummary(record.payload)));
}

// ============================================================================
// MARK: Helper utilities — NDJSON import
// ============================================================================

export function parseStreamRecordFromUnknown(value: unknown): ChatEventStreamRecord {
  if (!isRecord(value)) {
    throw new Error('record is not an object');
  }

  const recordId = requireStringField(value, 'recordId') as ChatEventStreamRecordId;
  const eventName = requireEventNameField(value, 'eventName');
  const source = requireSourceField(value, 'source');
  const urgency = requireUrgencyField(value, 'urgency');
  const severity = requireSeverityField(value, 'severity');
  const retention = requireRetentionField(value, 'retention');
  const payload = normalizePayloadRecordField(value['payload']);

  return {
    recordId,
    recordedAt: asUnixMs(requireNumberField(value, 'recordedAt')),
    createdAt: asUnixMs(requireNumberField(value, 'createdAt')),
    source,
    telemetryId: readNullableTelemetryId(value['telemetryId']),
    eventId: readNullableString(value['eventId']) as Nullable<string>,
    roomId: readNullableString(value['roomId']) as Nullable<ChatRoomId>,
    sessionId: readNullableString(value['sessionId']) as Nullable<ChatSessionId>,
    userId: readNullableString(value['userId']) as Nullable<ChatUserId>,
    eventName,
    urgency,
    severity,
    retention,
    replayWorthy: Boolean(value['replayWorthy']),
    learningRelevant: Boolean(value['learningRelevant']),
    linkedMessageIds: freezeStringArray(value['linkedMessageIds']) as readonly string[],
    linkedReplayIds: freezeStringArray(value['linkedReplayIds']) as readonly string[],
    linkedProofEdgeIds: freezeStringArray(value['linkedProofEdgeIds']) as readonly string[],
    linkedInferenceIds: freezeStringArray(value['linkedInferenceIds']) as readonly string[],
    tags: freezeStringArray(value['tags']),
    payload,
    checksum: requireStringField(value, 'checksum'),
  };
}

export function normalizePayloadRecordField(value: unknown): Readonly<Record<string, JsonValue>> {
  if (!isRecord(value)) return Object.freeze({});
  const next: Record<string, JsonValue> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    next[key] = normalizeJsonValueLoose(fieldValue);
  }
  return Object.freeze(next);
}

export function normalizeJsonValueLoose(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValueLoose(item));
  }
  if (isRecord(value)) {
    const record: Record<string, JsonValue> = {};
    for (const [key, fieldValue] of Object.entries(value)) {
      record[key] = normalizeJsonValueLoose(fieldValue);
    }
    return record;
  }
  return String(value);
}

// ============================================================================
// MARK: Helper utilities — counters
// ============================================================================

export function createEventCounters(): Record<ChatTelemetryEnvelope['eventName'], number> {
  return {
    chat_opened: 0,
    chat_closed: 0,
    message_sent: 0,
    message_suppressed: 0,
    message_rejected: 0,
    helper_fired: 0,
    hater_escalated: 0,
    invasion_opened: 0,
    invasion_closed: 0,
    channel_switched: 0,
    dropoff_warning: 0,
    presence_updated: 0,
    typing_updated: 0,
    learning_updated: 0,
  };
}

export function createSeverityCounters(): Record<ChatEventStreamSeverity, number> {
  return {
    TRACE: 0,
    NOTICE: 0,
    WARNING: 0,
    CRITICAL: 0,
  };
}

export function createUrgencyCounters(): Record<ChatTelemetrySinkUrgency, number> {
  return {
    BACKGROUND: 0,
    STANDARD: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
}

export function createSourceCounters(): Record<ChatEventStreamSource, number> {
  return {
    TELEMETRY_ENVELOPE: 0,
    TRANSACTION: 0,
    DELTA: 0,
    REPLAY: 0,
    PROOF: 0,
    INFERENCE: 0,
    SYNTHETIC: 0,
  };
}

// ============================================================================
// MARK: Helper utilities — field parsing / guards
// ============================================================================

export function requireStringField(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new Error(`missing string field: ${key}`);
  }
  return candidate;
}

export function requireNumberField(value: Record<string, unknown>, key: string): number {
  const candidate = value[key];
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
    throw new Error(`missing numeric field: ${key}`);
  }
  return candidate;
}

export function requireEventNameField(
  value: Record<string, unknown>,
  key: string,
): ChatTelemetryEnvelope['eventName'] {
  const candidate = requireStringField(value, key);
  if (!isEventName(candidate)) {
    throw new Error(`invalid telemetry event name: ${candidate}`);
  }
  return candidate;
}

export function requireSourceField(
  value: Record<string, unknown>,
  key: string,
): ChatEventStreamSource {
  const candidate = requireStringField(value, key);
  if (!isStreamSource(candidate)) {
    throw new Error(`invalid stream source: ${candidate}`);
  }
  return candidate;
}

export function requireUrgencyField(
  value: Record<string, unknown>,
  key: string,
): ChatTelemetrySinkUrgency {
  const candidate = requireStringField(value, key);
  if (!isUrgency(candidate)) {
    throw new Error(`invalid urgency: ${candidate}`);
  }
  return candidate;
}

export function requireSeverityField(
  value: Record<string, unknown>,
  key: string,
): ChatEventStreamSeverity {
  const candidate = requireStringField(value, key);
  if (!isSeverity(candidate)) {
    throw new Error(`invalid severity: ${candidate}`);
  }
  return candidate;
}

export function requireRetentionField(
  value: Record<string, unknown>,
  key: string,
): ChatEventStreamRetentionClass {
  const candidate = requireStringField(value, key);
  if (!isRetention(candidate)) {
    throw new Error(`invalid retention: ${candidate}`);
  }
  return candidate;
}

export function readNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readNullableTelemetryId(value: unknown): ChatTelemetryId | null {
  const normalized = readNullableString(value);
  return normalized as Nullable<ChatTelemetryId>;
}

export function freezeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const accepted = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return Object.freeze(Array.from(new Set(accepted)));
}

export function readStringish(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function normalizePayloadForSummary(
  payload: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  const pickedKeys = [
    'summary',
    'messagePreview',
    'messageText',
    'reason',
    'label',
    'status',
    'decision',
    'channel',
    'roomStageMood',
    'sourceType',
  ];

  const next: Record<string, JsonValue> = {};
  for (const key of pickedKeys) {
    if (key in payload) next[key] = payload[key];
  }

  if (Object.keys(next).length > 0) return Object.freeze(next);

  const fallback: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(payload).slice(0, 8)) {
    fallback[key] = value;
  }
  return Object.freeze(fallback);
}

// ============================================================================
// MARK: Helper utilities — discriminators
// ============================================================================

export function isEventName(value: string): value is ChatTelemetryEnvelope['eventName'] {
  return (
    value === 'chat_opened' ||
    value === 'chat_closed' ||
    value === 'message_sent' ||
    value === 'message_suppressed' ||
    value === 'message_rejected' ||
    value === 'helper_fired' ||
    value === 'hater_escalated' ||
    value === 'invasion_opened' ||
    value === 'invasion_closed' ||
    value === 'channel_switched' ||
    value === 'dropoff_warning' ||
    value === 'presence_updated' ||
    value === 'typing_updated' ||
    value === 'learning_updated'
  );
}

export function isStreamSource(value: string): value is ChatEventStreamSource {
  return (
    value === 'TELEMETRY_ENVELOPE' ||
    value === 'TRANSACTION' ||
    value === 'DELTA' ||
    value === 'REPLAY' ||
    value === 'PROOF' ||
    value === 'INFERENCE' ||
    value === 'SYNTHETIC'
  );
}

export function isUrgency(value: string): value is ChatTelemetrySinkUrgency {
  return (
    value === 'BACKGROUND' ||
    value === 'STANDARD' ||
    value === 'HIGH' ||
    value === 'CRITICAL'
  );
}

export function isSeverity(value: string): value is ChatEventStreamSeverity {
  return (
    value === 'TRACE' ||
    value === 'NOTICE' ||
    value === 'WARNING' ||
    value === 'CRITICAL'
  );
}

export function isRetention(value: string): value is ChatEventStreamRetentionClass {
  return (
    value === 'EPHEMERAL' ||
    value === 'SESSION' ||
    value === 'REPLAY' ||
    value === 'LEARNING' ||
    value === 'AUDIT'
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// MARK: Helper utilities — synthetic projections
// ============================================================================

export function buildTelemetryTimelineEntryFromEnvelope(
  envelope: ChatTelemetryEnvelope,
): ChatTelemetryTimelineEntry {
  const summary = buildSummaryFromEnvelope(envelope);
  return {
    recordId: (`telemetry:${String(envelope.telemetryId)}` as unknown) as ChatEventStreamRecordId,
    eventName: envelope.eventName,
    source: 'TELEMETRY_ENVELOPE',
    urgency: deriveUrgency(envelope.eventName),
    severity: deriveSeverityFromEnvelope(envelope),
    retention: deriveRetentionFromEnvelope(envelope),
    recordedAt: envelope.createdAt,
    roomId: envelope.roomId ?? null,
    sessionId: envelope.sessionId ?? null,
    userId: envelope.userId ?? null,
    replayWorthy: isReplayWorthyEnvelope(envelope),
    learningRelevant: isLearningRelevantEnvelope(envelope),
    summary,
    tags: Object.freeze(deriveTagsFromEnvelope(envelope)),
  };
}

export function buildSummaryFromEnvelope(envelope: ChatTelemetryEnvelope): string {
  const payload = envelope.payload ?? {};
  const primary =
    readStringish(payload['summary']) ??
    readStringish(payload['messagePreview']) ??
    readStringish(payload['messageText']) ??
    readStringish(payload['reason']) ??
    readStringish(payload['status']);

  if (primary) return summarizeText(primary);
  return summarizeText(stableJsonStringify(normalizePayloadForSummary(payload)));
}

export function deriveSeverityFromEnvelope(
  envelope: ChatTelemetryEnvelope,
): ChatEventStreamSeverity {
  switch (envelope.eventName) {
    case 'message_rejected':
    case 'dropoff_warning':
    case 'invasion_opened':
    case 'invasion_closed':
      return 'CRITICAL';
    case 'message_suppressed':
    case 'helper_fired':
    case 'hater_escalated':
      return 'WARNING';
    case 'learning_updated':
    case 'channel_switched':
      return 'NOTICE';
    default:
      return 'TRACE';
  }
}

export function deriveRetentionFromEnvelope(
  envelope: ChatTelemetryEnvelope,
): ChatEventStreamRetentionClass {
  switch (envelope.eventName) {
    case 'message_rejected':
    case 'message_suppressed':
      return 'AUDIT';
    case 'message_sent':
    case 'helper_fired':
    case 'hater_escalated':
    case 'invasion_opened':
    case 'invasion_closed':
      return 'REPLAY';
    case 'learning_updated':
    case 'dropoff_warning':
      return 'LEARNING';
    default:
      return 'SESSION';
  }
}

export function deriveTagsFromEnvelope(
  envelope: ChatTelemetryEnvelope,
): readonly string[] {
  const payload = envelope.payload ?? {};
  const tags = new Set<string>();
  tags.add(`event:${envelope.eventName}`);
  if (envelope.roomId) tags.add(`room:${envelope.roomId}`);
  if (envelope.sessionId) tags.add(`session:${envelope.sessionId}`);
  if (envelope.userId) tags.add(`user:${envelope.userId}`);

  const channel = readStringish(payload['channel']);
  const sourceType = readStringish(payload['sourceType']);
  const mood = readStringish(payload['roomStageMood']);
  const status = readStringish(payload['status']);

  if (channel) tags.add(`channel:${channel}`);
  if (sourceType) tags.add(`sourceType:${sourceType}`);
  if (mood) tags.add(`mood:${mood}`);
  if (status) tags.add(`status:${status}`);

  return Object.freeze(Array.from(tags.values()).sort((a, b) => a.localeCompare(b)));
}

export function isReplayWorthyEnvelope(envelope: ChatTelemetryEnvelope): boolean {
  return (
    envelope.eventName === 'message_sent' ||
    envelope.eventName === 'message_suppressed' ||
    envelope.eventName === 'helper_fired' ||
    envelope.eventName === 'hater_escalated' ||
    envelope.eventName === 'invasion_opened' ||
    envelope.eventName === 'invasion_closed' ||
    envelope.eventName === 'dropoff_warning'
  );
}

export function isLearningRelevantEnvelope(envelope: ChatTelemetryEnvelope): boolean {
  return (
    envelope.eventName === 'message_sent' ||
    envelope.eventName === 'message_suppressed' ||
    envelope.eventName === 'message_rejected' ||
    envelope.eventName === 'helper_fired' ||
    envelope.eventName === 'hater_escalated' ||
    envelope.eventName === 'dropoff_warning' ||
    envelope.eventName === 'learning_updated' ||
    envelope.eventName === 'channel_switched'
  );
}
