/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT EVENT STREAM WRITER
 * FILE: backend/src/game/engine/chat/telemetry/ChatEventStreamWriter.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable, queryable, append-only-ish event-stream authority for authoritative
 * backend chat telemetry.
 *
 * This file exists because backend telemetry is only half the job. The sink
 * decides which backend-authoritative chat facts deserve telemetry envelopes.
 * The stream writer then turns those envelopes and the surrounding delta /
 * proof / replay context into a deterministic event stream that supports:
 *
 * - analytics,
 * - replay stitching,
 * - learning dataset assembly,
 * - drift inspection,
 * - moderation / proof audit,
 * - transport troubleshooting,
 * - room / session / user reconstruction.
 *
 * Why this file is intentionally large
 * -----------------------------------
 * In a lightweight app, a telemetry writer would be a thin "append JSON line"
 * helper. That is not enough here.
 *
 * Point Zero One chat is being promoted into an authoritative backend lane,
 * which means the event stream must preserve:
 *
 * - ordering,
 * - causality hints,
 * - room / session / user partitions,
 * - replay linkage,
 * - proof linkage,
 * - learning relevance,
 * - retention / compaction behavior,
 * - queryability without depending on donor zones.
 *
 * The writer therefore owns more than append logic:
 *
 * 1. stable record synthesis,
 * 2. deterministic indexing,
 * 3. transaction-driven record expansion,
 * 4. compaction / retention control,
 * 5. diagnostics / integrity verification,
 * 6. NDJSON / snapshot export surfaces.
 *
 * Design doctrine
 * ---------------
 * - The stream follows backend truth; it never invents gameplay state.
 * - The stream writer is not a replacement for transcript or proof-chain.
 * - The stream must remain useful even when some downstream consumers do not
 *   have direct access to transcript or replay stores.
 * - Retention can compact records, but not by violating order semantics.
 * - Stream records are optimized for machine use first, human audit second.
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  asUnixMs,
  clamp01,
  type ChatEngineTransaction,
  type ChatEventId,
  type ChatInferenceId,
  type ChatInferenceSnapshot,
  type ChatMessage,
  type ChatMessageId,
  type ChatNormalizedInput,
  type ChatProofEdge,
  type ChatProofEdgeId,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRoomId,
  type ChatSessionId,
  type ChatStateDelta,
  type ChatTelemetryEnvelope,
  type ChatTelemetryId,
  type ChatUserId,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from '../types';
import {
  deriveUrgency,
  hash32,
  sanitizeEnvelope,
  stableJsonStringify,
  stableSortTelemetryBatch,
  summarizeText,
  type ChatTelemetrySinkUrgency,
} from './ChatTelemetrySink';

// ============================================================================
// MARK: Stream-local contracts
// ============================================================================

export type ChatEventStreamRecordId = string & {
  readonly __brand: 'ChatEventStreamRecordId';
};

export type ChatEventStreamSource =
  | 'TELEMETRY_ENVELOPE'
  | 'TRANSACTION'
  | 'DELTA'
  | 'REPLAY'
  | 'PROOF'
  | 'INFERENCE'
  | 'SYNTHETIC';

export type ChatEventStreamRetentionClass =
  | 'EPHEMERAL'
  | 'SESSION'
  | 'REPLAY'
  | 'LEARNING'
  | 'AUDIT';

export type ChatEventStreamSeverity =
  | 'TRACE'
  | 'NOTICE'
  | 'WARNING'
  | 'CRITICAL';

export interface ChatEventStreamClockPort {
  now(): number;
}

export interface ChatEventStreamLoggerPort {
  debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, context?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatEventStreamPersistencePort {
  save?(snapshot: ChatEventStreamSnapshot): void | Promise<void>;
  appendNdjson?(lines: readonly string[]): void | Promise<void>;
}

export interface ChatEventStreamWriterPorts {
  readonly clock?: ChatEventStreamClockPort;
  readonly logger?: ChatEventStreamLoggerPort;
  readonly persistence?: Partial<ChatEventStreamPersistencePort>;
}

export interface ChatEventStreamRetentionPolicy {
  readonly maxRecords: number;
  readonly maxRecordsPerRoom: number;
  readonly maxRecordsPerSession: number;
  readonly maxAgeMs: number;
  readonly auditRetentionFloor: number;
}

export interface ChatEventStreamWriterOptions {
  readonly ports?: ChatEventStreamWriterPorts;
  readonly retention?: Partial<ChatEventStreamRetentionPolicy>;
}

export interface ChatEventStreamRecord {
  readonly recordId: ChatEventStreamRecordId;
  readonly recordedAt: UnixMs;
  readonly createdAt: UnixMs;
  readonly source: ChatEventStreamSource;
  readonly telemetryId: Nullable<ChatTelemetryId>;
  readonly eventId: Nullable<ChatEventId>;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly eventName: ChatTelemetryEnvelope['eventName'];
  readonly urgency: ChatTelemetrySinkUrgency;
  readonly severity: ChatEventStreamSeverity;
  readonly retention: ChatEventStreamRetentionClass;
  readonly replayWorthy: boolean;
  readonly learningRelevant: boolean;
  readonly linkedMessageIds: readonly ChatMessageId[];
  readonly linkedReplayIds: readonly ChatReplayId[];
  readonly linkedProofEdgeIds: readonly ChatProofEdgeId[];
  readonly linkedInferenceIds: readonly ChatInferenceId[];
  readonly tags: readonly string[];
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly checksum: string;
}

export interface ChatEventStreamRoomIndexEntry {
  readonly roomId: ChatRoomId;
  readonly recordIds: readonly ChatEventStreamRecordId[];
  readonly firstRecordedAt: Nullable<UnixMs>;
  readonly lastRecordedAt: Nullable<UnixMs>;
  readonly eventCounts: Readonly<Record<ChatTelemetryEnvelope['eventName'], number>>;
}

export interface ChatEventStreamSessionIndexEntry {
  readonly sessionId: ChatSessionId;
  readonly recordIds: readonly ChatEventStreamRecordId[];
  readonly firstRecordedAt: Nullable<UnixMs>;
  readonly lastRecordedAt: Nullable<UnixMs>;
}

export interface ChatEventStreamUserIndexEntry {
  readonly userId: ChatUserId;
  readonly recordIds: readonly ChatEventStreamRecordId[];
  readonly firstRecordedAt: Nullable<UnixMs>;
  readonly lastRecordedAt: Nullable<UnixMs>;
}

export interface ChatEventStreamSnapshot {
  readonly version: typeof BACKEND_CHAT_ENGINE_VERSION;
  readonly recordsById: Readonly<Record<string, ChatEventStreamRecord>>;
  readonly orderedRecordIds: readonly ChatEventStreamRecordId[];
  readonly byRoom: Readonly<Record<string, ChatEventStreamRoomIndexEntry>>;
  readonly bySession: Readonly<Record<string, ChatEventStreamSessionIndexEntry>>;
  readonly byUser: Readonly<Record<string, ChatEventStreamUserIndexEntry>>;
  readonly byEventName: Readonly<Record<ChatTelemetryEnvelope['eventName'], readonly ChatEventStreamRecordId[]>>;
}

export interface ChatEventStreamAppendResult {
  readonly appended: readonly ChatEventStreamRecord[];
  readonly deduped: readonly ChatEventStreamRecord[];
  readonly snapshot: ChatEventStreamSnapshot;
}

export interface ChatEventStreamCompactionResult {
  readonly removedRecordIds: readonly ChatEventStreamRecordId[];
  readonly removedCount: number;
  readonly snapshot: ChatEventStreamSnapshot;
}

export interface ChatEventStreamRangeRequest {
  readonly roomId?: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly userId?: ChatUserId;
  readonly eventNames?: readonly ChatTelemetryEnvelope['eventName'][];
  readonly fromRecordedAt?: UnixMs;
  readonly toRecordedAt?: UnixMs;
  readonly replayWorthyOnly?: boolean;
  readonly learningRelevantOnly?: boolean;
  readonly textQuery?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ChatEventStreamRangeResult {
  readonly request: ChatEventStreamRangeRequest;
  readonly total: number;
  readonly returned: number;
  readonly records: readonly ChatEventStreamRecord[];
}

export interface ChatEventStreamDiagnostics {
  readonly totalRecords: number;
  readonly roomCount: number;
  readonly sessionCount: number;
  readonly userCount: number;
  readonly countsByEventName: Readonly<Record<ChatTelemetryEnvelope['eventName'], number>>;
  readonly oldestRecordedAt: Nullable<UnixMs>;
  readonly newestRecordedAt: Nullable<UnixMs>;
  readonly replayWorthyCount: number;
  readonly learningRelevantCount: number;
  readonly queuePressure01: number;
  readonly integrityIssues: readonly string[];
}

interface ChatEventStreamInternalState {
  readonly snapshot: ChatEventStreamSnapshot;
}

export interface ChatEventStreamWriterApi {
  readonly snapshot: () => ChatEventStreamSnapshot;
  readonly diagnostics: () => ChatEventStreamDiagnostics;
  readonly writeEnvelope: (envelope: ChatTelemetryEnvelope) => ChatEventStreamAppendResult;
  readonly writeTelemetryBatch: (batch: readonly ChatTelemetryEnvelope[]) => ChatEventStreamAppendResult;
  readonly writeTransaction: (transaction: ChatEngineTransaction) => ChatEventStreamAppendResult;
  readonly writeDelta: (
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
  ) => ChatEventStreamAppendResult;
  readonly appendRecords: (records: readonly ChatEventStreamRecord[]) => ChatEventStreamAppendResult;
  readonly getRecord: (recordId: ChatEventStreamRecordId) => Nullable<ChatEventStreamRecord>;
  readonly getByRoom: (roomId: ChatRoomId) => readonly ChatEventStreamRecord[];
  readonly getBySession: (sessionId: ChatSessionId) => readonly ChatEventStreamRecord[];
  readonly getByUser: (userId: ChatUserId) => readonly ChatEventStreamRecord[];
  readonly getByEventName: (
    eventName: ChatTelemetryEnvelope['eventName'],
  ) => readonly ChatEventStreamRecord[];
  readonly queryRange: (request: ChatEventStreamRangeRequest) => ChatEventStreamRangeResult;
  readonly compact: () => ChatEventStreamCompactionResult;
  readonly exportNdjsonLines: (request?: ChatEventStreamRangeRequest) => readonly string[];
  readonly clear: () => void;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: ChatEventStreamClockPort = {
  now: () => Date.now(),
};

const DEFAULT_LOGGER: ChatEventStreamLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_RETENTION: ChatEventStreamRetentionPolicy = Object.freeze({
  maxRecords: 50_000,
  maxRecordsPerRoom: 10_000,
  maxRecordsPerSession: 5_000,
  maxAgeMs: 1000 * 60 * 60 * 24 * 14,
  auditRetentionFloor: 2_000,
});

const EMPTY_SNAPSHOT: ChatEventStreamSnapshot = Object.freeze({
  version: BACKEND_CHAT_ENGINE_VERSION,
  recordsById: Object.freeze({}),
  orderedRecordIds: Object.freeze([]),
  byRoom: Object.freeze({}),
  bySession: Object.freeze({}),
  byUser: Object.freeze({}),
  byEventName: Object.freeze(createEmptyEventNameBuckets()),
});

// ============================================================================
// MARK: Public factory
// ============================================================================

export function createChatEventStreamWriter(
  options: ChatEventStreamWriterOptions = {},
): ChatEventStreamWriterApi {
  const clock = options.ports?.clock ?? DEFAULT_CLOCK;
  const logger = options.ports?.logger ?? DEFAULT_LOGGER;
  const retention = mergeRetention(options.retention);

  let internal: ChatEventStreamInternalState = {
    snapshot: EMPTY_SNAPSHOT,
  };

  const api: ChatEventStreamWriterApi = {
    snapshot,
    diagnostics,
    writeEnvelope,
    writeTelemetryBatch,
    writeTransaction,
    writeDelta,
    appendRecords,
    getRecord,
    getByRoom,
    getBySession,
    getByUser,
    getByEventName,
    queryRange,
    compact,
    exportNdjsonLines,
    clear,
  };

  return api;

  function snapshot(): ChatEventStreamSnapshot {
    return internal.snapshot;
  }

  function diagnostics(): ChatEventStreamDiagnostics {
    const snap = internal.snapshot;
    const records = snap.orderedRecordIds.map((id) => snap.recordsById[String(id)]).filter(Boolean);

    const countsByEventName = createEmptyEventNameBucketsCount();
    let oldest: Nullable<UnixMs> = null;
    let newest: Nullable<UnixMs> = null;
    let replayWorthyCount = 0;
    let learningRelevantCount = 0;

    for (const record of records) {
      countsByEventName[record.eventName] += 1;
      if (oldest === null || Number(record.recordedAt) < Number(oldest)) oldest = record.recordedAt;
      if (newest === null || Number(record.recordedAt) > Number(newest)) newest = record.recordedAt;
      if (record.replayWorthy) replayWorthyCount += 1;
      if (record.learningRelevant) learningRelevantCount += 1;
    }

    return {
      totalRecords: records.length,
      roomCount: Object.keys(snap.byRoom).length,
      sessionCount: Object.keys(snap.bySession).length,
      userCount: Object.keys(snap.byUser).length,
      countsByEventName,
      oldestRecordedAt: oldest,
      newestRecordedAt: newest,
      replayWorthyCount,
      learningRelevantCount,
      queuePressure01: clamp01(records.length / retention.maxRecords),
      integrityIssues: verifySnapshotIntegrity(snap),
    };
  }

  function writeEnvelope(envelope: ChatTelemetryEnvelope): ChatEventStreamAppendResult {
    const record = createRecordFromEnvelope(sanitizeEnvelope(envelope), 'TELEMETRY_ENVELOPE', clock.now());
    return appendRecords([record]);
  }

  function writeTelemetryBatch(batch: readonly ChatTelemetryEnvelope[]): ChatEventStreamAppendResult {
    const records = stableSortTelemetryBatch(batch.map((entry) => sanitizeEnvelope(entry))).map((entry) =>
      createRecordFromEnvelope(entry, 'TELEMETRY_ENVELOPE', clock.now()),
    );
    return appendRecords(records);
  }

  function writeTransaction(transaction: ChatEngineTransaction): ChatEventStreamAppendResult {
    const records = buildRecordsForTransaction(transaction, clock.now());
    return appendRecords(records);
  }

  function writeDelta(
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
  ): ChatEventStreamAppendResult {
    const records = buildRecordsForDelta(event, delta, clock.now());
    return appendRecords(records);
  }

  function appendRecords(records: readonly ChatEventStreamRecord[]): ChatEventStreamAppendResult {
    if (records.length === 0) {
      return {
        appended: [],
        deduped: [],
        snapshot: internal.snapshot,
      };
    }

    const orderedInput = stableSortRecords(records);
    const appended: ChatEventStreamRecord[] = [];
    const deduped: ChatEventStreamRecord[] = [];

    let nextSnapshot = internal.snapshot;

    for (const record of orderedInput) {
      const existing = findExistingRecord(nextSnapshot, record);
      if (existing) {
        deduped.push(existing);
        continue;
      }

      nextSnapshot = appendRecordToSnapshot(nextSnapshot, record);
      appended.push(record);
    }

    internal = {
      snapshot: nextSnapshot,
    };

    if (appended.length > 0) {
      void persistAppend(appended);
    }

    const compaction = compact();
    if (compaction.removedCount > 0) {
      logger.info('Chat event stream compacted records after append.', {
        removedCount: compaction.removedCount,
      });
    }

    return {
      appended,
      deduped,
      snapshot: internal.snapshot,
    };
  }

  function getRecord(recordId: ChatEventStreamRecordId): Nullable<ChatEventStreamRecord> {
    return internal.snapshot.recordsById[String(recordId)] ?? null;
  }

  function getByRoom(roomId: ChatRoomId): readonly ChatEventStreamRecord[] {
    const entry = internal.snapshot.byRoom[String(roomId)];
    if (!entry) return [];
    return entry.recordIds
      .map((recordId) => internal.snapshot.recordsById[String(recordId)])
      .filter(Boolean);
  }

  function getBySession(sessionId: ChatSessionId): readonly ChatEventStreamRecord[] {
    const entry = internal.snapshot.bySession[String(sessionId)];
    if (!entry) return [];
    return entry.recordIds
      .map((recordId) => internal.snapshot.recordsById[String(recordId)])
      .filter(Boolean);
  }

  function getByUser(userId: ChatUserId): readonly ChatEventStreamRecord[] {
    const entry = internal.snapshot.byUser[String(userId)];
    if (!entry) return [];
    return entry.recordIds
      .map((recordId) => internal.snapshot.recordsById[String(recordId)])
      .filter(Boolean);
  }

  function getByEventName(
    eventName: ChatTelemetryEnvelope['eventName'],
  ): readonly ChatEventStreamRecord[] {
    const ids = internal.snapshot.byEventName[eventName] ?? [];
    return ids.map((recordId) => internal.snapshot.recordsById[String(recordId)]).filter(Boolean);
  }

  function queryRange(request: ChatEventStreamRangeRequest): ChatEventStreamRangeResult {
    const candidates = selectCandidateIds(internal.snapshot, request);
    const filtered = candidates
      .map((recordId) => internal.snapshot.recordsById[String(recordId)])
      .filter((record): record is ChatEventStreamRecord => Boolean(record))
      .filter((record) => recordMatchesRequest(record, request));

    const total = filtered.length;
    const offset = Math.max(0, request.offset ?? 0);
    const limit = Math.max(0, request.limit ?? total);
    const records = filtered.slice(offset, offset + limit);

    return {
      request,
      total,
      returned: records.length,
      records,
    };
  }

  function compact(): ChatEventStreamCompactionResult {
    const snap = internal.snapshot;
    const now = asUnixMs(clock.now());
    const records = snap.orderedRecordIds
      .map((recordId) => snap.recordsById[String(recordId)])
      .filter(Boolean);

    const removableIds = new Set<ChatEventStreamRecordId>();

    if (records.length > retention.maxRecords) {
      const overflow = records.length - retention.maxRecords;
      const removable = selectRemovableRecords(records, overflow, retention.auditRetentionFloor, now, retention.maxAgeMs);
      for (const record of removable) removableIds.add(record.recordId);
    }

    for (const [roomKey, entry] of Object.entries(snap.byRoom)) {
      if (entry.recordIds.length <= retention.maxRecordsPerRoom) continue;
      const overflow = entry.recordIds.length - retention.maxRecordsPerRoom;
      const roomRecords = entry.recordIds
        .map((recordId) => snap.recordsById[String(recordId)])
        .filter(Boolean);
      const removable = selectRemovableRecords(roomRecords, overflow, Math.floor(retention.auditRetentionFloor / 4), now, retention.maxAgeMs);
      for (const record of removable) removableIds.add(record.recordId);
      if (roomKey) {
        logger.debug('Room-local telemetry stream compaction evaluated.', {
          roomId: roomKey,
          overflow,
          selected: removable.length,
        });
      }
    }

    for (const entry of Object.values(snap.bySession)) {
      if (entry.recordIds.length <= retention.maxRecordsPerSession) continue;
      const overflow = entry.recordIds.length - retention.maxRecordsPerSession;
      const sessionRecords = entry.recordIds
        .map((recordId) => snap.recordsById[String(recordId)])
        .filter(Boolean);
      const removable = selectRemovableRecords(sessionRecords, overflow, Math.floor(retention.auditRetentionFloor / 8), now, retention.maxAgeMs);
      for (const record of removable) removableIds.add(record.recordId);
    }

    for (const record of records) {
      if (isAgeExpired(record, now, retention.maxAgeMs) && record.retention === 'EPHEMERAL') {
        removableIds.add(record.recordId);
      }
    }

    if (removableIds.size === 0) {
      return {
        removedRecordIds: [],
        removedCount: 0,
        snapshot: internal.snapshot,
      };
    }

    const nextSnapshot = rebuildSnapshotWithout(internal.snapshot, removableIds);
    internal = {
      snapshot: nextSnapshot,
    };

    return {
      removedRecordIds: [...removableIds],
      removedCount: removableIds.size,
      snapshot: nextSnapshot,
    };
  }

  function exportNdjsonLines(request?: ChatEventStreamRangeRequest): readonly string[] {
    const records = request
      ? queryRange(request).records
      : internal.snapshot.orderedRecordIds
          .map((recordId) => internal.snapshot.recordsById[String(recordId)])
          .filter(Boolean);

    return records.map((record) => JSON.stringify(record));
  }

  function clear(): void {
    internal = {
      snapshot: EMPTY_SNAPSHOT,
    };
  }

  async function persistAppend(records: readonly ChatEventStreamRecord[]): Promise<void> {
    try {
      const lines = records.map((record) => JSON.stringify(record));
      await options.ports?.persistence?.appendNdjson?.(lines);
      await options.ports?.persistence?.save?.(internal.snapshot);
    } catch (error) {
      logger.error('Chat event stream persistence failed.', {
        reason: error instanceof Error ? error.message : String(error),
        recordCount: records.length,
      });
    }
  }
}

// ============================================================================
// MARK: Record creation
// ============================================================================

export function createRecordFromEnvelope(
  envelope: ChatTelemetryEnvelope,
  source: ChatEventStreamSource,
  recordedAt: number,
): ChatEventStreamRecord {
  const sanitized = sanitizeEnvelope(envelope);
  const replayWorthy = isReplayWorthyEventName(sanitized.eventName, sanitized.payload);
  const learningRelevant = isLearningRelevantEventName(sanitized.eventName, sanitized.payload);
  const retention = deriveRetentionClass(sanitized.eventName, replayWorthy, learningRelevant);
  const severity = deriveSeverity(sanitized.eventName);
  const linkedMessageIds = collectMessageIdsFromPayload(sanitized.payload);
  const linkedReplayIds = collectReplayIdsFromPayload(sanitized.payload);
  const linkedProofEdgeIds = collectProofEdgeIdsFromPayload(sanitized.payload);
  const linkedInferenceIds = collectInferenceIdsFromPayload(sanitized.payload);
  const tags = deriveTags(sanitized, replayWorthy, learningRelevant);
  const payload = sanitized.payload;
  const checksum = buildRecordChecksum(sanitized, source, linkedMessageIds, linkedReplayIds, linkedProofEdgeIds, linkedInferenceIds);

  return {
    recordId: (`stream_${Number(recordedAt)}_${hash32(`${String(sanitized.telemetryId)}:${checksum}`)}` as ChatEventStreamRecordId),
    recordedAt: asUnixMs(recordedAt),
    createdAt: sanitized.createdAt,
    source,
    telemetryId: sanitized.telemetryId,
    eventId: readNullableString(payload.eventId) as Nullable<ChatEventId>,
    roomId: sanitized.roomId,
    sessionId: sanitized.sessionId,
    userId: sanitized.userId,
    eventName: sanitized.eventName,
    urgency: deriveUrgency(sanitized),
    severity,
    retention,
    replayWorthy,
    learningRelevant,
    linkedMessageIds,
    linkedReplayIds,
    linkedProofEdgeIds,
    linkedInferenceIds,
    tags,
    payload,
    checksum,
  };
}

export function buildRecordsForTransaction(
  transaction: ChatEngineTransaction,
  recordedAt: number,
): readonly ChatEventStreamRecord[] {
  const records: ChatEventStreamRecord[] = [];

  const baseEnvelopes = buildSyntheticTransactionEnvelopes(transaction);
  for (const envelope of baseEnvelopes) {
    records.push(createRecordFromEnvelope(envelope, 'TRANSACTION', recordedAt));
  }

  if (transaction.delta) {
    records.push(...buildRecordsForDelta(transaction.event, transaction.delta, recordedAt));
    records.push(...buildReplayRecordsForDelta(transaction.delta, recordedAt));
    records.push(...buildProofRecordsForDelta(transaction.delta, recordedAt));
    records.push(...buildInferenceRecordsForDelta(transaction.delta, recordedAt));
  }

  return stableSortRecords(records);
}

export function buildRecordsForDelta(
  event: ChatNormalizedInput,
  delta: ChatStateDelta,
  recordedAt: number,
): readonly ChatEventStreamRecord[] {
  const records: ChatEventStreamRecord[] = [];

  for (const envelope of delta.telemetry) {
    records.push(createRecordFromEnvelope(envelope, 'DELTA', recordedAt));
  }

  for (const message of delta.appendedMessages) {
    records.push(createRecordFromMessage(message, event.eventId, recordedAt));
  }

  for (const messageId of delta.redactedMessageIds) {
    records.push(createRedactionRecord(messageId, event.eventId, delta.touchedRoomIds[0] ?? null, recordedAt));
  }

  return stableSortRecords(records);
}

export function createRecordFromMessage(
  message: ChatMessage,
  eventId: ChatEventId,
  recordedAt: number,
): ChatEventStreamRecord {
  const envelope: ChatTelemetryEnvelope = {
    telemetryId: (`tel_${Number(recordedAt)}_${hash32(`message:${String(message.id)}`)}` as ChatTelemetryId),
    eventName: 'message_sent',
    roomId: message.roomId,
    sessionId: message.attribution.authorSessionId,
    userId: message.attribution.authorUserId,
    createdAt: message.createdAt,
    payload: {
      eventId: String(eventId),
      messageId: String(message.id),
      channelId: message.channelId,
      sourceType: message.attribution.sourceType,
      actorId: message.attribution.actorId,
      displayName: message.attribution.displayName,
      npcRole: message.attribution.npcRole,
      botId: message.attribution.botId,
      proofHash: message.proof.proofHash ? String(message.proof.proofHash) : null,
      replayId: message.replay.replayId ? String(message.replay.replayId) : null,
      textSummary: summarizeText(message.plainText),
    },
  };
  return createRecordFromEnvelope(envelope, 'DELTA', recordedAt);
}

export function createRedactionRecord(
  messageId: ChatMessageId,
  eventId: ChatEventId,
  roomId: Nullable<ChatRoomId>,
  recordedAt: number,
): ChatEventStreamRecord {
  const envelope: ChatTelemetryEnvelope = {
    telemetryId: (`tel_${Number(recordedAt)}_${hash32(`redaction:${String(messageId)}`)}` as ChatTelemetryId),
    eventName: 'message_suppressed',
    roomId,
    sessionId: null,
    userId: null,
    createdAt: asUnixMs(recordedAt),
    payload: {
      eventId: String(eventId),
      messageId: String(messageId),
      reason: 'delta.redactedMessageIds',
    },
  };
  return createRecordFromEnvelope(envelope, 'DELTA', recordedAt);
}

export function buildReplayRecordsForDelta(
  delta: ChatStateDelta,
  recordedAt: number,
): readonly ChatEventStreamRecord[] {
  return delta.replayArtifacts.map((artifact) => createRecordFromReplayArtifact(artifact, recordedAt));
}

export function createRecordFromReplayArtifact(
  artifact: ChatReplayArtifact,
  recordedAt: number,
): ChatEventStreamRecord {
  const envelope: ChatTelemetryEnvelope = {
    telemetryId: (`tel_${Number(recordedAt)}_${hash32(`replay:${String(artifact.id)}`)}` as ChatTelemetryId),
    eventName: 'message_sent',
    roomId: artifact.roomId,
    sessionId: null,
    userId: null,
    createdAt: artifact.createdAt,
    payload: {
      replayId: String(artifact.id),
      eventId: String(artifact.eventId),
      label: artifact.label,
      anchorKey: artifact.anchorKey,
      rangeStart: artifact.range.start,
      rangeEnd: artifact.range.end,
      kind: 'replay_artifact',
      metadata: artifact.metadata,
    },
  };
  return createRecordFromEnvelope(envelope, 'REPLAY', recordedAt);
}

export function buildProofRecordsForDelta(
  delta: ChatStateDelta,
  recordedAt: number,
): readonly ChatEventStreamRecord[] {
  return delta.proofEdges.map((edge) => createRecordFromProofEdge(edge, recordedAt));
}

export function createRecordFromProofEdge(
  edge: ChatProofEdge,
  recordedAt: number,
): ChatEventStreamRecord {
  const envelope: ChatTelemetryEnvelope = {
    telemetryId: (`tel_${Number(recordedAt)}_${hash32(`proof:${String(edge.id)}`)}` as ChatTelemetryId),
    eventName: 'learning_updated',
    roomId: edge.roomId,
    sessionId: null,
    userId: null,
    createdAt: edge.createdAt,
    payload: {
      proofEdgeId: String(edge.id),
      edgeType: edge.edgeType,
      fromMessageId: edge.fromMessageId ? String(edge.fromMessageId) : null,
      fromEventId: edge.fromEventId ? String(edge.fromEventId) : null,
      toMessageId: edge.toMessageId ? String(edge.toMessageId) : null,
      toReplayId: edge.toReplayId ? String(edge.toReplayId) : null,
      toTelemetryId: edge.toTelemetryId ? String(edge.toTelemetryId) : null,
      toInferenceId: edge.toInferenceId ? String(edge.toInferenceId) : null,
      hash: String(edge.hash),
      kind: 'proof_edge',
      metadata: edge.metadata,
    },
  };
  return createRecordFromEnvelope(envelope, 'PROOF', recordedAt);
}

export function buildInferenceRecordsForDelta(
  delta: ChatStateDelta,
  recordedAt: number,
): readonly ChatEventStreamRecord[] {
  return delta.inferenceSnapshots.map((snapshot) => createRecordFromInferenceSnapshot(snapshot, recordedAt));
}

export function createRecordFromInferenceSnapshot(
  snapshot: ChatInferenceSnapshot,
  recordedAt: number,
): ChatEventStreamRecord {
  const envelope: ChatTelemetryEnvelope = {
    telemetryId: (`tel_${Number(recordedAt)}_${hash32(`inference:${String(snapshot.inferenceId)}`)}` as ChatTelemetryId),
    eventName: 'learning_updated',
    roomId: snapshot.roomId,
    sessionId: null,
    userId: snapshot.userId,
    createdAt: snapshot.generatedAt,
    payload: {
      inferenceId: String(snapshot.inferenceId),
      source: snapshot.source,
      engagement01: Number(snapshot.engagement01),
      helperTiming01: Number(snapshot.helperTiming01),
      haterTargeting01: Number(snapshot.haterTargeting01),
      toxicityRisk01: Number(snapshot.toxicityRisk01),
      churnRisk01: Number(snapshot.churnRisk01),
      interventionPolicy: snapshot.interventionPolicy,
      kind: 'inference_snapshot',
    },
  };
  return createRecordFromEnvelope(envelope, 'INFERENCE', recordedAt);
}

export function buildSyntheticTransactionEnvelopes(
  transaction: ChatEngineTransaction,
): readonly ChatTelemetryEnvelope[] {
  const event = transaction.event;
  const createdAt = event.emittedAt;
  const basePayload: Readonly<Record<string, JsonValue>> = {
    eventId: String(event.eventId),
    kind: event.kind,
    accepted: transaction.accepted,
    rejected: transaction.rejected,
    rejectionReasons: transaction.rejectionReasons,
    roomId: event.roomId ? String(event.roomId) : null,
  };

  const envelopes: ChatTelemetryEnvelope[] = [];

  if (transaction.rejected) {
    envelopes.push({
      telemetryId: (`tel_${Number(createdAt)}_${hash32(`tx-reject:${String(event.eventId)}`)}` as ChatTelemetryId),
      eventName: mapSyntheticRejectedEventName(event.kind),
      roomId: event.roomId ?? null,
      sessionId: event.sessionId ?? null,
      userId: event.userId ?? null,
      createdAt,
      payload: basePayload,
    });
  }

  if (transaction.accepted && transaction.delta?.telemetry.length === 0) {
    envelopes.push({
      telemetryId: (`tel_${Number(createdAt)}_${hash32(`tx-accepted:${String(event.eventId)}`)}` as ChatTelemetryId),
      eventName: mapSyntheticAcceptedEventName(event.kind),
      roomId: event.roomId ?? null,
      sessionId: event.sessionId ?? null,
      userId: event.userId ?? null,
      createdAt,
      payload: basePayload,
    });
  }

  return envelopes;
}

// ============================================================================
// MARK: Query / index helpers
// ============================================================================

export function selectCandidateIds(
  snapshot: ChatEventStreamSnapshot,
  request: ChatEventStreamRangeRequest,
): readonly ChatEventStreamRecordId[] {
  if (request.roomId) {
    return snapshot.byRoom[String(request.roomId)]?.recordIds ?? [];
  }
  if (request.sessionId) {
    return snapshot.bySession[String(request.sessionId)]?.recordIds ?? [];
  }
  if (request.userId) {
    return snapshot.byUser[String(request.userId)]?.recordIds ?? [];
  }
  if (request.eventNames && request.eventNames.length === 1) {
    return snapshot.byEventName[request.eventNames[0]] ?? [];
  }
  return snapshot.orderedRecordIds;
}

export function recordMatchesRequest(
  record: ChatEventStreamRecord,
  request: ChatEventStreamRangeRequest,
): boolean {
  if (request.roomId && record.roomId !== request.roomId) return false;
  if (request.sessionId && record.sessionId !== request.sessionId) return false;
  if (request.userId && record.userId !== request.userId) return false;
  if (request.eventNames && request.eventNames.length > 0 && !request.eventNames.includes(record.eventName)) {
    return false;
  }
  if (request.fromRecordedAt && Number(record.recordedAt) < Number(request.fromRecordedAt)) return false;
  if (request.toRecordedAt && Number(record.recordedAt) > Number(request.toRecordedAt)) return false;
  if (request.replayWorthyOnly && !record.replayWorthy) return false;
  if (request.learningRelevantOnly && !record.learningRelevant) return false;
  if (request.textQuery) {
    const haystack = buildRecordSearchHaystack(record);
    const normalized = normalizeQuery(request.textQuery);
    if (!haystack.includes(normalized)) return false;
  }
  return true;
}

export function buildRecordSearchHaystack(record: ChatEventStreamRecord): string {
  return normalizeQuery([
    record.eventName,
    ...record.tags,
    stableJsonStringify(record.payload),
  ].join(' '));
}

// ============================================================================
// MARK: Snapshot mutation helpers
// ============================================================================

export function appendRecordToSnapshot(
  snapshot: ChatEventStreamSnapshot,
  record: ChatEventStreamRecord,
): ChatEventStreamSnapshot {
  const recordsById = {
    ...snapshot.recordsById,
    [String(record.recordId)]: record,
  };

  const orderedRecordIds = stableSortRecordIds([
    ...snapshot.orderedRecordIds,
    record.recordId,
  ], recordsById);

  const byRoom = rebuildRoomIndex(recordsById, orderedRecordIds);
  const bySession = rebuildSessionIndex(recordsById, orderedRecordIds);
  const byUser = rebuildUserIndex(recordsById, orderedRecordIds);
  const byEventName = rebuildEventNameIndex(recordsById, orderedRecordIds);

  return {
    version: BACKEND_CHAT_ENGINE_VERSION,
    recordsById,
    orderedRecordIds,
    byRoom,
    bySession,
    byUser,
    byEventName,
  };
}

export function rebuildSnapshotWithout(
  snapshot: ChatEventStreamSnapshot,
  removed: ReadonlySet<ChatEventStreamRecordId>,
): ChatEventStreamSnapshot {
  const recordsById: Record<string, ChatEventStreamRecord> = Object.create(null);
  const orderedRecordIds: ChatEventStreamRecordId[] = [];

  for (const recordId of snapshot.orderedRecordIds) {
    if (removed.has(recordId)) continue;
    const record = snapshot.recordsById[String(recordId)];
    if (!record) continue;
    recordsById[String(recordId)] = record;
    orderedRecordIds.push(recordId);
  }

  return {
    version: BACKEND_CHAT_ENGINE_VERSION,
    recordsById,
    orderedRecordIds,
    byRoom: rebuildRoomIndex(recordsById, orderedRecordIds),
    bySession: rebuildSessionIndex(recordsById, orderedRecordIds),
    byUser: rebuildUserIndex(recordsById, orderedRecordIds),
    byEventName: rebuildEventNameIndex(recordsById, orderedRecordIds),
  };
}

export function rebuildRoomIndex(
  recordsById: Readonly<Record<string, ChatEventStreamRecord>>,
  orderedRecordIds: readonly ChatEventStreamRecordId[],
): Readonly<Record<string, ChatEventStreamRoomIndexEntry>> {
  const out: Record<string, ChatEventStreamRoomIndexEntry> = Object.create(null);

  for (const recordId of orderedRecordIds) {
    const record = recordsById[String(recordId)];
    if (!record?.roomId) continue;
    const key = String(record.roomId);
    const existing = out[key];
    const nextRecordIds = [...(existing?.recordIds ?? []), recordId];
    const nextCounts = { ...(existing?.eventCounts ?? createEmptyEventNameBucketsCount()) };
    nextCounts[record.eventName] = (nextCounts[record.eventName] ?? 0) + 1;

    out[key] = {
      roomId: record.roomId,
      recordIds: nextRecordIds,
      firstRecordedAt: existing?.firstRecordedAt ?? record.recordedAt,
      lastRecordedAt: record.recordedAt,
      eventCounts: nextCounts,
    };
  }

  return out;
}

export function rebuildSessionIndex(
  recordsById: Readonly<Record<string, ChatEventStreamRecord>>,
  orderedRecordIds: readonly ChatEventStreamRecordId[],
): Readonly<Record<string, ChatEventStreamSessionIndexEntry>> {
  const out: Record<string, ChatEventStreamSessionIndexEntry> = Object.create(null);

  for (const recordId of orderedRecordIds) {
    const record = recordsById[String(recordId)];
    if (!record?.sessionId) continue;
    const key = String(record.sessionId);
    const existing = out[key];
    out[key] = {
      sessionId: record.sessionId,
      recordIds: [...(existing?.recordIds ?? []), recordId],
      firstRecordedAt: existing?.firstRecordedAt ?? record.recordedAt,
      lastRecordedAt: record.recordedAt,
    };
  }

  return out;
}

export function rebuildUserIndex(
  recordsById: Readonly<Record<string, ChatEventStreamRecord>>,
  orderedRecordIds: readonly ChatEventStreamRecordId[],
): Readonly<Record<string, ChatEventStreamUserIndexEntry>> {
  const out: Record<string, ChatEventStreamUserIndexEntry> = Object.create(null);

  for (const recordId of orderedRecordIds) {
    const record = recordsById[String(recordId)];
    if (!record?.userId) continue;
    const key = String(record.userId);
    const existing = out[key];
    out[key] = {
      userId: record.userId,
      recordIds: [...(existing?.recordIds ?? []), recordId],
      firstRecordedAt: existing?.firstRecordedAt ?? record.recordedAt,
      lastRecordedAt: record.recordedAt,
    };
  }

  return out;
}

export function rebuildEventNameIndex(
  recordsById: Readonly<Record<string, ChatEventStreamRecord>>,
  orderedRecordIds: readonly ChatEventStreamRecordId[],
): Readonly<Record<ChatTelemetryEnvelope['eventName'], readonly ChatEventStreamRecordId[]>> {
  const out = createEmptyEventNameBuckets();
  for (const recordId of orderedRecordIds) {
    const record = recordsById[String(recordId)];
    if (!record) continue;
    out[record.eventName] = [...out[record.eventName], recordId];
  }
  return out;
}

// ============================================================================
// MARK: Diagnostics / compaction helpers
// ============================================================================

export function findExistingRecord(
  snapshot: ChatEventStreamSnapshot,
  candidate: ChatEventStreamRecord,
): Nullable<ChatEventStreamRecord> {
  const sameTelemetry = candidate.telemetryId
    ? snapshot.orderedRecordIds
        .map((recordId) => snapshot.recordsById[String(recordId)])
        .find((record) => record?.telemetryId === candidate.telemetryId)
    : null;

  if (sameTelemetry) return sameTelemetry;

  return snapshot.orderedRecordIds
    .map((recordId) => snapshot.recordsById[String(recordId)])
    .find((record) => record && record.checksum === candidate.checksum && record.createdAt === candidate.createdAt) ?? null;
}

export function selectRemovableRecords(
  records: readonly ChatEventStreamRecord[],
  targetCount: number,
  auditRetentionFloor: number,
  now: UnixMs,
  maxAgeMs: number,
): readonly ChatEventStreamRecord[] {
  if (targetCount <= 0) return [];

  const eligible = records.filter((record, index) => {
    const reserveTail = records.length - auditRetentionFloor;
    if (index >= reserveTail && record.retention === 'AUDIT') return false;
    if (record.retention === 'AUDIT' && !isAgeExpired(record, now, maxAgeMs * 4)) return false;
    if (record.retention === 'LEARNING' && !isAgeExpired(record, now, maxAgeMs * 2)) return false;
    if (record.replayWorthy && !isAgeExpired(record, now, maxAgeMs * 2)) return false;
    return true;
  });

  return eligible.slice(0, targetCount);
}

export function isAgeExpired(
  record: ChatEventStreamRecord,
  now: UnixMs,
  maxAgeMs: number,
): boolean {
  return Number(now) - Number(record.recordedAt) > maxAgeMs;
}

export function verifySnapshotIntegrity(
  snapshot: ChatEventStreamSnapshot,
): readonly string[] {
  const issues: string[] = [];

  for (const recordId of snapshot.orderedRecordIds) {
    if (!snapshot.recordsById[String(recordId)]) {
      issues.push(`Ordered record id ${String(recordId)} missing from recordsById.`);
    }
  }

  for (const [roomKey, entry] of Object.entries(snapshot.byRoom)) {
    for (const recordId of entry.recordIds) {
      const record = snapshot.recordsById[String(recordId)];
      if (!record) {
        issues.push(`Room index ${roomKey} references missing record ${String(recordId)}.`);
        continue;
      }
      if (String(record.roomId) !== roomKey) {
        issues.push(`Room index ${roomKey} contains record ${String(recordId)} with mismatched room.`);
      }
    }
  }

  for (const [sessionKey, entry] of Object.entries(snapshot.bySession)) {
    for (const recordId of entry.recordIds) {
      const record = snapshot.recordsById[String(recordId)];
      if (!record) {
        issues.push(`Session index ${sessionKey} references missing record ${String(recordId)}.`);
        continue;
      }
      if (String(record.sessionId) !== sessionKey) {
        issues.push(`Session index ${sessionKey} contains mismatched record ${String(recordId)}.`);
      }
    }
  }

  for (const [userKey, entry] of Object.entries(snapshot.byUser)) {
    for (const recordId of entry.recordIds) {
      const record = snapshot.recordsById[String(recordId)];
      if (!record) {
        issues.push(`User index ${userKey} references missing record ${String(recordId)}.`);
        continue;
      }
      if (String(record.userId) !== userKey) {
        issues.push(`User index ${userKey} contains mismatched record ${String(recordId)}.`);
      }
    }
  }

  for (const [eventName, recordIds] of Object.entries(snapshot.byEventName)) {
    for (const recordId of recordIds) {
      const record = snapshot.recordsById[String(recordId)];
      if (!record) {
        issues.push(`Event-name bucket ${eventName} references missing record ${String(recordId)}.`);
        continue;
      }
      if (record.eventName !== eventName) {
        issues.push(`Event-name bucket ${eventName} contains mismatched record ${String(recordId)}.`);
      }
    }
  }

  return issues;
}

// ============================================================================
// MARK: Classification / linking helpers
// ============================================================================

export function deriveRetentionClass(
  eventName: ChatTelemetryEnvelope['eventName'],
  replayWorthy: boolean,
  learningRelevant: boolean,
): ChatEventStreamRetentionClass {
  if (eventName === 'message_rejected' || eventName === 'dropoff_warning') return 'AUDIT';
  if (replayWorthy) return 'REPLAY';
  if (learningRelevant) return 'LEARNING';
  if (eventName === 'chat_opened' || eventName === 'chat_closed') return 'SESSION';
  return 'EPHEMERAL';
}

export function deriveSeverity(
  eventName: ChatTelemetryEnvelope['eventName'],
): ChatEventStreamSeverity {
  switch (eventName) {
    case 'message_rejected':
    case 'dropoff_warning':
    case 'invasion_opened':
    case 'invasion_closed':
      return 'CRITICAL';
    case 'message_suppressed':
    case 'helper_fired':
    case 'hater_escalated':
      return 'WARNING';
    case 'message_sent':
    case 'learning_updated':
    case 'channel_switched':
      return 'NOTICE';
    default:
      return 'TRACE';
  }
}

export function isReplayWorthyEventName(
  eventName: ChatTelemetryEnvelope['eventName'],
  payload: Readonly<Record<string, JsonValue>>,
): boolean {
  if (
    eventName === 'message_sent' ||
    eventName === 'message_suppressed' ||
    eventName === 'helper_fired' ||
    eventName === 'hater_escalated' ||
    eventName === 'invasion_opened' ||
    eventName === 'invasion_closed' ||
    eventName === 'dropoff_warning'
  ) {
    return true;
  }
  return Boolean(payload.replayId || payload.sceneId || payload.momentId || payload.legendId || payload.kind === 'replay_artifact');
}

export function isLearningRelevantEventName(
  eventName: ChatTelemetryEnvelope['eventName'],
  payload: Readonly<Record<string, JsonValue>>,
): boolean {
  if (
    eventName === 'message_sent' ||
    eventName === 'message_suppressed' ||
    eventName === 'message_rejected' ||
    eventName === 'helper_fired' ||
    eventName === 'hater_escalated' ||
    eventName === 'dropoff_warning' ||
    eventName === 'learning_updated'
  ) {
    return true;
  }
  return Boolean(payload.inferenceId || payload.kind === 'inference_snapshot');
}

export function collectMessageIdsFromPayload(
  payload: Readonly<Record<string, JsonValue>>,
): readonly ChatMessageId[] {
  const values = collectStringishIds(payload, ['messageId', 'fromMessageId', 'toMessageId', 'rootMessageId']);
  return values.map((value) => value as ChatMessageId);
}

export function collectReplayIdsFromPayload(
  payload: Readonly<Record<string, JsonValue>>,
): readonly ChatReplayId[] {
  const values = collectStringishIds(payload, ['replayId', 'toReplayId']);
  return values.map((value) => value as ChatReplayId);
}

export function collectProofEdgeIdsFromPayload(
  payload: Readonly<Record<string, JsonValue>>,
): readonly ChatProofEdgeId[] {
  const values = collectStringishIds(payload, ['proofEdgeId']);
  return values.map((value) => value as ChatProofEdgeId);
}

export function collectInferenceIdsFromPayload(
  payload: Readonly<Record<string, JsonValue>>,
): readonly ChatInferenceId[] {
  const values = collectStringishIds(payload, ['inferenceId', 'toInferenceId']);
  return values.map((value) => value as ChatInferenceId);
}

export function collectStringishIds(
  payload: Readonly<Record<string, JsonValue>>,
  keys: readonly string[],
): readonly string[] {
  const out: string[] = [];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) out.push(value);
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim()) out.push(entry);
      }
    }
  }
  return [...new Set(out)];
}

export function deriveTags(
  envelope: ChatTelemetryEnvelope,
  replayWorthy: boolean,
  learningRelevant: boolean,
): readonly string[] {
  const tags = new Set<string>();
  tags.add(envelope.eventName);
  if (envelope.roomId) tags.add(`room:${String(envelope.roomId)}`);
  if (envelope.sessionId) tags.add(`session:${String(envelope.sessionId)}`);
  if (envelope.userId) tags.add(`user:${String(envelope.userId)}`);
  if (replayWorthy) tags.add('replay-worthy');
  if (learningRelevant) tags.add('learning-relevant');
  if (typeof envelope.payload.channelId === 'string') tags.add(`channel:${envelope.payload.channelId}`);
  if (typeof envelope.payload.kind === 'string') tags.add(`kind:${envelope.payload.kind}`);
  return [...tags];
}

export function buildRecordChecksum(
  envelope: ChatTelemetryEnvelope,
  source: ChatEventStreamSource,
  linkedMessageIds: readonly ChatMessageId[],
  linkedReplayIds: readonly ChatReplayId[],
  linkedProofEdgeIds: readonly ChatProofEdgeId[],
  linkedInferenceIds: readonly ChatInferenceId[],
): string {
  const material = [
    source,
    envelope.eventName,
    envelope.roomId ? String(envelope.roomId) : 'room:none',
    envelope.sessionId ? String(envelope.sessionId) : 'session:none',
    envelope.userId ? String(envelope.userId) : 'user:none',
    String(envelope.createdAt),
    stableJsonStringify(envelope.payload),
    linkedMessageIds.map(String).join(','),
    linkedReplayIds.map(String).join(','),
    linkedProofEdgeIds.map(String).join(','),
    linkedInferenceIds.map(String).join(','),
  ].join('|');
  return hash32(material);
}

export function readNullableString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

// ============================================================================
// MARK: Record ordering + export helpers
// ============================================================================

export function stableSortRecords(
  records: readonly ChatEventStreamRecord[],
): readonly ChatEventStreamRecord[] {
  return [...records].sort((left, right) => {
    if (Number(left.recordedAt) !== Number(right.recordedAt)) {
      return Number(left.recordedAt) - Number(right.recordedAt);
    }
    if (Number(left.createdAt) !== Number(right.createdAt)) {
      return Number(left.createdAt) - Number(right.createdAt);
    }
    if (String(left.recordId) < String(right.recordId)) return -1;
    if (String(left.recordId) > String(right.recordId)) return 1;
    return 0;
  });
}

export function stableSortRecordIds(
  recordIds: readonly ChatEventStreamRecordId[],
  recordsById: Readonly<Record<string, ChatEventStreamRecord>>,
): readonly ChatEventStreamRecordId[] {
  return [...recordIds].sort((left, right) => {
    const a = recordsById[String(left)];
    const b = recordsById[String(right)];
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (Number(a.recordedAt) !== Number(b.recordedAt)) {
      return Number(a.recordedAt) - Number(b.recordedAt);
    }
    if (Number(a.createdAt) !== Number(b.createdAt)) {
      return Number(a.createdAt) - Number(b.createdAt);
    }
    if (String(left) < String(right)) return -1;
    if (String(left) > String(right)) return 1;
    return 0;
  });
}

export function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ============================================================================
// MARK: Synthetic event mapping helpers
// ============================================================================

export function mapSyntheticRejectedEventName(
  kind: ChatNormalizedInput['kind'],
): ChatTelemetryEnvelope['eventName'] {
  switch (kind) {
    case 'PLAYER_MESSAGE_SUBMIT':
      return 'message_rejected';
    case 'SESSION_JOIN_REQUEST':
      return 'chat_closed';
    case 'PRESENCE_UPDATED':
      return 'presence_updated';
    case 'TYPING_UPDATED':
      return 'typing_updated';
    default:
      return 'message_suppressed';
  }
}

export function mapSyntheticAcceptedEventName(
  kind: ChatNormalizedInput['kind'],
): ChatTelemetryEnvelope['eventName'] {
  switch (kind) {
    case 'SESSION_JOIN_REQUEST':
      return 'chat_opened';
    case 'SESSION_LEAVE':
      return 'chat_closed';
    case 'PRESENCE_UPDATED':
      return 'presence_updated';
    case 'TYPING_UPDATED':
      return 'typing_updated';
    case 'PLAYER_MESSAGE_SUBMIT':
      return 'message_sent';
    default:
      return 'learning_updated';
  }
}

// ============================================================================
// MARK: Empty buckets / merge helpers
// ============================================================================

export function createEmptyEventNameBuckets(): Record<ChatTelemetryEnvelope['eventName'], readonly ChatEventStreamRecordId[]> {
  return {
    chat_opened: [],
    chat_closed: [],
    message_sent: [],
    message_suppressed: [],
    message_rejected: [],
    helper_fired: [],
    hater_escalated: [],
    invasion_opened: [],
    invasion_closed: [],
    channel_switched: [],
    dropoff_warning: [],
    presence_updated: [],
    typing_updated: [],
    learning_updated: [],
  };
}

export function createEmptyEventNameBucketsCount(): Record<ChatTelemetryEnvelope['eventName'], number> {
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

export function mergeRetention(
  partial: Partial<ChatEventStreamRetentionPolicy> | undefined,
): ChatEventStreamRetentionPolicy {
  return {
    ...DEFAULT_RETENTION,
    ...partial,
  };
}
