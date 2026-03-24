/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TELEMETRY SINK
 * FILE: backend/src/game/engine/chat/telemetry/ChatTelemetrySink.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend chat telemetry capture + queue + flush layer.
 *
 * This file is intentionally large because backend telemetry in Point Zero One
 * is not an incidental log sidecar. It is part of chat truth. The sink exists
 * to ensure that only backend-authoritative chat facts are emitted to
 * downstream telemetry, replay stitching, learning, and audit consumers.
 *
 * The sink sits after:
 * - transport admission,
 * - event normalization,
 * - policy enforcement,
 * - deterministic state mutation,
 * - transcript / replay / proof mutation.
 *
 * The sink never treats client intent as authoritative fact.
 *
 * Backend doctrine
 * ----------------
 * - The frontend may predict or pre-queue telemetry, but the backend decides
 *   what actually happened.
 * - Telemetry is derived from accepted authoritative events, deltas, messages,
 *   replay artifacts, inference snapshots, and state transitions.
 * - Queueing must remain deterministic and audit-friendly.
 * - Flushing must preserve order while allowing urgency-based bypass.
 * - Dedupe must avoid spam without collapsing semantically distinct events.
 * - No telemetry path is allowed to mutate transcript truth.
 *
 * Canonical fit in the lane you locked
 * -----------------------------------
 * backend/src/game/engine/chat/telemetry/
 *   ChatTelemetrySink.ts
 *   ChatEventStreamWriter.ts
 *   index.ts
 *
 * This file owns
 * --------------
 * - authoritative telemetry envelope synthesis,
 * - telemetry derivation from engine transactions,
 * - queue admission, dedupe, and overflow control,
 * - state queue application / flush helpers,
 * - urgency classification for downstream dispatch,
 * - safe payload normalization and summarization,
 * - sink diagnostics and capture statistics.
 *
 * This file does not own
 * ----------------------
 * - raw sockets,
 * - UI event capture,
 * - transcript writes,
 * - proof chain writes,
 * - replay artifact assembly,
 * - learning model inference,
 * - persistent event-stream indexing.
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  asUnixMs,
  clamp01,
  type ChatAffectSnapshot,
  type ChatEngineTransaction,
  type ChatEventId,
  type ChatEventKind,
  type ChatFanoutPacket,
  type ChatInferenceSnapshot,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatMessageId,
  type ChatNormalizedInput,
  type ChatPendingRequestState,
  type ChatPresenceSnapshot,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRequestId,
  type ChatRoomId,
  type ChatRoomStageMood,
  type ChatRuntimeConfig,
  type ChatSessionId,
  type ChatState,
  type ChatStateDelta,
  type ChatTelemetryEnvelope,
  type ChatTelemetryId,
  type ChatTypingSnapshot,
  type ChatUserId,
  type JsonValue,
  type Nullable,
  type SequenceNumber,
  type UnixMs,
} from '../types';

// ============================================================================
// MARK: Sink-local contracts
// ============================================================================

export type ChatTelemetrySinkUrgency =
  | 'BACKGROUND'
  | 'STANDARD'
  | 'HIGH'
  | 'CRITICAL';

export type ChatTelemetrySinkFlushReason =
  | 'MANUAL'
  | 'AUTO_IMMEDIATE'
  | 'QUEUE_LIMIT'
  | 'STATE_QUEUE'
  | 'SHUTDOWN'
  | 'TICK';

export type ChatTelemetrySinkCaptureSource =
  | 'ENVELOPE'
  | 'BATCH'
  | 'DELTA'
  | 'TRANSACTION'
  | 'STATE_QUEUE'
  | 'SYSTEM';

export interface ChatTelemetrySinkClockPort {
  now(): number;
}

export interface ChatTelemetrySinkLoggerPort {
  debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, context?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatTelemetrySinkDispatchPort {
  emit(batch: readonly ChatTelemetryEnvelope[]): void | Promise<void>;
}

export interface ChatTelemetrySinkPersistencePort {
  saveTelemetry(batch: readonly ChatTelemetryEnvelope[]): void | Promise<void>;
}

export interface ChatTelemetrySinkQueuePolicy {
  readonly maxBufferedEnvelopes: number;
  readonly maxBatchEmit: number;
  readonly dedupeWindowMs: number;
  readonly queueWarningThreshold: number;
  readonly overflowDropStrategy: 'DROP_OLDEST' | 'DROP_NEWEST';
  readonly flushImmediatelyOn: readonly ChatTelemetryEnvelope['eventName'][];
}

export interface ChatTelemetrySinkPorts {
  readonly clock?: ChatTelemetrySinkClockPort;
  readonly logger?: ChatTelemetrySinkLoggerPort;
  readonly dispatch?: Partial<ChatTelemetrySinkDispatchPort>;
  readonly persistence?: Partial<ChatTelemetrySinkPersistencePort>;
}

export interface ChatTelemetrySinkOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly ports?: ChatTelemetrySinkPorts;
  readonly queuePolicy?: Partial<ChatTelemetrySinkQueuePolicy>;
}

export interface ChatTelemetrySinkFingerprint {
  readonly key: string;
  readonly windowBucket: number;
}

export interface ChatTelemetrySinkBufferedEnvelope {
  readonly envelope: ChatTelemetryEnvelope;
  readonly urgency: ChatTelemetrySinkUrgency;
  readonly fingerprint: ChatTelemetrySinkFingerprint;
  readonly replayWorthy: boolean;
  readonly learningRelevant: boolean;
  readonly source: ChatTelemetrySinkCaptureSource;
  readonly bufferedAt: UnixMs;
}

export interface ChatTelemetrySinkStats {
  readonly created: number;
  readonly queued: number;
  readonly deduped: number;
  readonly dropped: number;
  readonly flushed: number;
  readonly flushCalls: number;
}

export interface ChatTelemetrySinkSnapshot {
  readonly version: typeof BACKEND_CHAT_ENGINE_VERSION;
  readonly bufferedCount: number;
  readonly stats: ChatTelemetrySinkStats;
  readonly pending: readonly ChatTelemetryEnvelope[];
  readonly maxBufferedEnvelopes: number;
  readonly queueWarningThreshold: number;
}

export interface ChatTelemetryCaptureResult {
  readonly source: ChatTelemetrySinkCaptureSource;
  readonly accepted: readonly ChatTelemetryEnvelope[];
  readonly deduped: readonly ChatTelemetryEnvelope[];
  readonly dropped: readonly ChatTelemetryEnvelope[];
  readonly shouldFlushImmediately: boolean;
  readonly state: ChatTelemetrySinkInternalState;
}

export interface ChatTelemetryFlushResult {
  readonly flushed: readonly ChatTelemetryEnvelope[];
  readonly remaining: readonly ChatTelemetryEnvelope[];
  readonly reason: ChatTelemetrySinkFlushReason;
  readonly state: ChatTelemetrySinkInternalState;
}

export interface ChatTelemetryDeltaBuildResult {
  readonly envelopes: readonly ChatTelemetryEnvelope[];
  readonly reasons: readonly string[];
}

export interface ChatTelemetryTransactionBuildResult {
  readonly envelopes: readonly ChatTelemetryEnvelope[];
  readonly reasons: readonly string[];
}

export interface ChatTelemetrySinkDiagnostics {
  readonly snapshot: ChatTelemetrySinkSnapshot;
  readonly countsByEventName: Readonly<Record<ChatTelemetryEnvelope['eventName'], number>>;
  readonly countsByRoom: Readonly<Record<string, number>>;
  readonly countsBySession: Readonly<Record<string, number>>;
  readonly queuePressure01: number;
}

interface ChatTelemetrySinkInternalState {
  readonly buffer: readonly ChatTelemetrySinkBufferedEnvelope[];
  readonly stats: ChatTelemetrySinkStats;
}

export interface ChatTelemetrySinkApi {
  readonly snapshot: () => ChatTelemetrySinkSnapshot;
  readonly diagnostics: () => ChatTelemetrySinkDiagnostics;
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
  readonly buildFromDelta: (
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
    nextState?: ChatState,
  ) => ChatTelemetryDeltaBuildResult;
  readonly buildFromTransaction: (
    transaction: ChatEngineTransaction,
  ) => ChatTelemetryTransactionBuildResult;
  readonly queueIntoState: (
    state: ChatState,
    envelopes: readonly ChatTelemetryEnvelope[],
  ) => ChatState;
  readonly flushBuffered: (
    reason?: ChatTelemetrySinkFlushReason,
  ) => Promise<ChatTelemetryFlushResult>;
  readonly flushStateQueue: (
    state: ChatState,
    reason?: ChatTelemetrySinkFlushReason,
  ) => Promise<{ readonly state: ChatState; readonly result: ChatTelemetryFlushResult }>;
  readonly summarizeEnvelope: (envelope: ChatTelemetryEnvelope) => string;
  readonly summarizeBatch: (batch: readonly ChatTelemetryEnvelope[]) => readonly string[];
  readonly clear: () => void;
}

export interface ChatTelemetryEnvelopeSeed {
  readonly telemetryId?: ChatTelemetryId;
  readonly eventName: ChatTelemetryEnvelope['eventName'];
  readonly roomId?: Nullable<ChatRoomId>;
  readonly sessionId?: Nullable<ChatSessionId>;
  readonly userId?: Nullable<ChatUserId>;
  readonly createdAt: UnixMs;
  readonly payload?: Readonly<Record<string, JsonValue>>;
  readonly messageId?: Nullable<ChatMessageId>;
  readonly requestId?: Nullable<ChatRequestId>;
  readonly replayId?: Nullable<ChatReplayId>;
  readonly sequence?: Nullable<SequenceNumber>;
  readonly roomStageMood?: Nullable<ChatRoomStageMood>;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: ChatTelemetrySinkClockPort = {
  now: () => Date.now(),
};

const DEFAULT_LOGGER: ChatTelemetrySinkLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_QUEUE_POLICY: ChatTelemetrySinkQueuePolicy = Object.freeze({
  maxBufferedEnvelopes: 1024,
  maxBatchEmit: 128,
  dedupeWindowMs: 5_000,
  queueWarningThreshold: 768,
  overflowDropStrategy: 'DROP_OLDEST',
  flushImmediatelyOn: [
    'message_rejected',
    'dropoff_warning',
    'invasion_opened',
    'invasion_closed',
    'hater_escalated',
  ] as const,
});

const EMPTY_STATS: ChatTelemetrySinkStats = Object.freeze({
  created: 0,
  queued: 0,
  deduped: 0,
  dropped: 0,
  flushed: 0,
  flushCalls: 0,
});

const TELEMETRY_EVENT_NAMES: readonly ChatTelemetryEnvelope['eventName'][] = Object.freeze([
  'chat_opened',
  'chat_closed',
  'message_sent',
  'message_suppressed',
  'message_rejected',
  'helper_fired',
  'hater_escalated',
  'invasion_opened',
  'invasion_closed',
  'channel_switched',
  'dropoff_warning',
  'presence_updated',
  'typing_updated',
  'learning_updated',
]);

const REPLAY_WORTHY_EVENT_NAMES: ReadonlySet<ChatTelemetryEnvelope['eventName']> = new Set([
  'message_sent',
  'message_suppressed',
  'helper_fired',
  'hater_escalated',
  'invasion_opened',
  'invasion_closed',
  'dropoff_warning',
]);

const LEARNING_RELEVANT_EVENT_NAMES: ReadonlySet<ChatTelemetryEnvelope['eventName']> = new Set([
  'message_sent',
  'message_suppressed',
  'message_rejected',
  'helper_fired',
  'hater_escalated',
  'dropoff_warning',
  'learning_updated',
  'channel_switched',
]);

const CRITICAL_EVENT_NAMES: ReadonlySet<ChatTelemetryEnvelope['eventName']> = new Set([
  'message_rejected',
  'dropoff_warning',
  'invasion_opened',
  'invasion_closed',
]);

const HIGH_EVENT_NAMES: ReadonlySet<ChatTelemetryEnvelope['eventName']> = new Set([
  'helper_fired',
  'hater_escalated',
  'message_suppressed',
  'learning_updated',
]);

// ============================================================================
// MARK: Public factory
// ============================================================================

export function createChatTelemetrySink(
  options: ChatTelemetrySinkOptions = {},
): ChatTelemetrySinkApi {
  const runtime = mergeRuntime(options.runtime);
  const clock = options.ports?.clock ?? DEFAULT_CLOCK;
  const logger = options.ports?.logger ?? DEFAULT_LOGGER;
  const queuePolicy = mergeQueuePolicy(options.queuePolicy);

  let internal: ChatTelemetrySinkInternalState = {
    buffer: [],
    stats: EMPTY_STATS,
  };

  const api: ChatTelemetrySinkApi = {
    snapshot,
    diagnostics,
    createEnvelope,
    captureEnvelope,
    captureBatch,
    captureFromDelta,
    captureFromTransaction,
    buildFromDelta,
    buildFromTransaction,
    queueIntoState,
    flushBuffered,
    flushStateQueue,
    summarizeEnvelope,
    summarizeBatch,
    clear,
  };

  return api;

  function snapshot(): ChatTelemetrySinkSnapshot {
    return {
      version: BACKEND_CHAT_ENGINE_VERSION,
      bufferedCount: internal.buffer.length,
      stats: cloneStats(internal.stats),
      pending: internal.buffer.map((entry) => entry.envelope),
      maxBufferedEnvelopes: queuePolicy.maxBufferedEnvelopes,
      queueWarningThreshold: queuePolicy.queueWarningThreshold,
    };
  }

  function diagnostics(): ChatTelemetrySinkDiagnostics {
    const countsByEventName = createEventNameCounter();
    const countsByRoom: Record<string, number> = Object.create(null);
    const countsBySession: Record<string, number> = Object.create(null);

    for (const entry of internal.buffer) {
      countsByEventName[entry.envelope.eventName] += 1;
      if (entry.envelope.roomId) {
        const key = String(entry.envelope.roomId);
        countsByRoom[key] = (countsByRoom[key] ?? 0) + 1;
      }
      if (entry.envelope.sessionId) {
        const key = String(entry.envelope.sessionId);
        countsBySession[key] = (countsBySession[key] ?? 0) + 1;
      }
    }

    return {
      snapshot: snapshot(),
      countsByEventName,
      countsByRoom,
      countsBySession,
      queuePressure01: clamp01(
        queuePolicy.maxBufferedEnvelopes > 0
          ? internal.buffer.length / queuePolicy.maxBufferedEnvelopes
          : 0,
      ),
    };
  }

  function createEnvelope(seed: ChatTelemetryEnvelopeSeed): ChatTelemetryEnvelope {
    const eventName = seed.eventName;
    const createdAt = seed.createdAt;

    return {
      telemetryId:
        seed.telemetryId ??
        (`tel_${Number(createdAt)}_${hash32(`${eventName}:${randomKeyBase()}`)}` as ChatTelemetryId),
      eventName,
      roomId: seed.roomId ?? null,
      sessionId: seed.sessionId ?? null,
      userId: seed.userId ?? null,
      createdAt,
      payload: normalizePayloadRecord(seed.payload ?? {}),
    };
  }

  function captureEnvelope(
    envelope: ChatTelemetryEnvelope,
  ): ChatTelemetryCaptureResult {
    return captureBatch([envelope], 'ENVELOPE');
  }

  function captureBatch(
    envelopes: readonly ChatTelemetryEnvelope[],
    source: ChatTelemetrySinkCaptureSource = 'BATCH',
  ): ChatTelemetryCaptureResult {
    if (envelopes.length === 0) {
      return {
        source,
        accepted: [],
        deduped: [],
        dropped: [],
        shouldFlushImmediately: false,
        state: internal,
      };
    }

    const normalized = stableSortTelemetryBatch(
      envelopes.map((envelope) => sanitizeEnvelope(envelope)),
    );

    const accepted: ChatTelemetryEnvelope[] = [];
    const deduped: ChatTelemetryEnvelope[] = [];
    const dropped: ChatTelemetryEnvelope[] = [];
    let nextBuffer = [...internal.buffer];
    let shouldFlushImmediately = false;

    for (const envelope of normalized) {
      const urgency = deriveUrgency(envelope);
      const fingerprint = buildFingerprint(envelope, queuePolicy.dedupeWindowMs);
      const replayWorthy = REPLAY_WORTHY_EVENT_NAMES.has(envelope.eventName);
      const learningRelevant = LEARNING_RELEVANT_EVENT_NAMES.has(envelope.eventName);

      if (isDuplicate(nextBuffer, fingerprint, envelope)) {
        deduped.push(envelope);
        continue;
      }

      const buffered: ChatTelemetrySinkBufferedEnvelope = {
        envelope,
        urgency,
        fingerprint,
        replayWorthy,
        learningRelevant,
        source,
        bufferedAt: asUnixMs(clock.now()),
      };

      if (nextBuffer.length >= queuePolicy.maxBufferedEnvelopes) {
        if (queuePolicy.overflowDropStrategy === 'DROP_OLDEST') {
          const removed = nextBuffer[0];
          if (removed) dropped.push(removed.envelope);
          nextBuffer = nextBuffer.slice(1);
          nextBuffer.push(buffered);
          accepted.push(envelope);
        } else {
          dropped.push(envelope);
          continue;
        }
      } else {
        nextBuffer.push(buffered);
        accepted.push(envelope);
      }

      if (queuePolicy.flushImmediatelyOn.includes(envelope.eventName)) {
        shouldFlushImmediately = true;
      }
    }

    internal = {
      buffer: stableSortBuffered(nextBuffer),
      stats: {
        created: internal.stats.created + normalized.length,
        queued: internal.stats.queued + accepted.length,
        deduped: internal.stats.deduped + deduped.length,
        dropped: internal.stats.dropped + dropped.length,
        flushed: internal.stats.flushed,
        flushCalls: internal.stats.flushCalls,
      },
    };

    if (internal.buffer.length >= queuePolicy.queueWarningThreshold) {
      logger.warn('Chat telemetry sink queue reached warning threshold.', {
        bufferedCount: internal.buffer.length,
        threshold: queuePolicy.queueWarningThreshold,
      });
    }

    return {
      source,
      accepted,
      deduped,
      dropped,
      shouldFlushImmediately,
      state: internal,
    };
  }

  function buildFromDelta(
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
    nextState?: ChatState,
  ): ChatTelemetryDeltaBuildResult {
    const createdAt = asUnixMs(extractEventTime(event));
    const roomId = event.roomId ?? delta.touchedRoomIds[0] ?? null;
    const sessionId = event.sessionId ?? null;
    const userId = event.userId ?? null;

    const envelopes: ChatTelemetryEnvelope[] = [];
    const reasons: string[] = [];

    if (delta.appendedMessages.length > 0) {
      for (const message of delta.appendedMessages) {
        envelopes.push(
          createEnvelope({
            eventName: 'message_sent',
            roomId: message.roomId,
            sessionId: message.attribution.authorSessionId,
            userId: message.attribution.authorUserId,
            createdAt: message.createdAt,
            payload: buildMessagePayload(message, delta, nextState),
          }),
        );
      }
      reasons.push('delta.appendedMessages');
    }

    if (delta.redactedMessageIds.length > 0) {
      for (const messageId of delta.redactedMessageIds) {
        envelopes.push(
          createEnvelope({
            eventName: 'message_suppressed',
            roomId,
            sessionId,
            userId,
            createdAt,
            payload: {
              reason: 'delta.redactedMessageIds',
              messageId: String(messageId),
              acceptedEventId: String(delta.acceptedEventId),
            },
          }),
        );
      }
      reasons.push('delta.redactedMessageIds');
    }

    if (delta.replayArtifacts.length > 0) {
      reasons.push('delta.replayArtifacts');
    }

    if (delta.learningProfilesTouched.length > 0 || delta.inferenceSnapshots.length > 0) {
      envelopes.push(
        createEnvelope({
          eventName: 'learning_updated',
          roomId,
          sessionId,
          userId,
          createdAt,
          payload: buildLearningPayload(delta.learningProfilesTouched, delta.inferenceSnapshots),
        }),
      );
      reasons.push('delta.learningProfilesTouched');
    }

    return {
      envelopes: stableSortTelemetryBatch(envelopes),
      reasons,
    };
  }

  function captureFromDelta(
    event: ChatNormalizedInput,
    delta: ChatStateDelta,
    nextState?: ChatState,
  ): ChatTelemetryCaptureResult {
    const build = buildFromDelta(event, delta, nextState);
    return captureBatch(build.envelopes, 'DELTA');
  }

  function buildFromTransaction(
    transaction: ChatEngineTransaction,
  ): ChatTelemetryTransactionBuildResult {
    const event = transaction.event;
    const createdAt = asUnixMs(extractEventTime(event));
    const roomId = event.roomId ?? null;
    const sessionId = event.sessionId ?? null;
    const userId = event.userId ?? null;

    const envelopes: ChatTelemetryEnvelope[] = [];
    const reasons: string[] = [];

    if (transaction.rejected) {
      const rejectedEventName = mapRejectedTransactionEventName(event.kind);
      if (rejectedEventName) {
        envelopes.push(
          createEnvelope({
            eventName: rejectedEventName,
            roomId,
            sessionId,
            userId,
            createdAt,
            payload: {
              eventKind: event.kind,
              rejectionReasons: transaction.rejectionReasons,
              payload: summarizeRejectedPayload(event.payload),
            },
          }),
        );
        reasons.push('transaction.rejected');
      }
    }

    switch (event.kind) {
      case 'SESSION_JOIN_REQUEST': {
        const payload = event.payload as import('../types').ChatJoinRequest;
        envelopes.push(
          createEnvelope({
            eventName: 'chat_opened',
            roomId: payload.roomId,
            sessionId: payload.session.sessionId,
            userId: payload.session.userId,
            createdAt,
            payload: {
              roomKind: payload.roomKind,
              title: payload.title,
              requestedVisibleChannel: payload.requestedVisibleChannel ?? null,
              mountTarget: payload.mountTarget ?? null,
            },
          }),
        );
        reasons.push('event.SESSION_JOIN_REQUEST');
        break;
      }
      case 'SESSION_LEAVE': {
        const payload = event.payload as import('../types').ChatLeaveRequest;
        envelopes.push(
          createEnvelope({
            eventName: 'chat_closed',
            roomId: payload.roomId,
            sessionId: payload.sessionId,
            userId,
            createdAt,
            payload: {
              reason: payload.reason,
            },
          }),
        );
        reasons.push('event.SESSION_LEAVE');
        break;
      }
      case 'PRESENCE_UPDATED': {
        const payload = event.payload as import('../types').ChatPresenceUpdateRequest;
        envelopes.push(
          createEnvelope({
            eventName: 'presence_updated',
            roomId: payload.roomId,
            sessionId: payload.sessionId,
            userId,
            createdAt,
            payload: {
              mode: payload.mode,
              spectating: payload.spectating,
              visibleToRoom: payload.visibleToRoom,
            },
          }),
        );
        reasons.push('event.PRESENCE_UPDATED');
        break;
      }
      case 'TYPING_UPDATED': {
        const payload = event.payload as import('../types').ChatTypingUpdateRequest;
        envelopes.push(
          createEnvelope({
            eventName: 'typing_updated',
            roomId: payload.roomId,
            sessionId: payload.sessionId,
            userId,
            createdAt,
            payload: {
              channelId: payload.channelId,
              mode: payload.mode,
            },
          }),
        );
        reasons.push('event.TYPING_UPDATED');
        break;
      }
      case 'PLAYER_MESSAGE_SUBMIT': {
        const payload = event.payload as import('../types').ChatPlayerMessageSubmitRequest;
        if (transaction.accepted && transaction.delta?.appendedMessages.length) {
          reasons.push('event.PLAYER_MESSAGE_SUBMIT');
        } else if (!transaction.accepted && !transaction.rejected) {
          envelopes.push(
            createEnvelope({
              eventName: 'message_suppressed',
              roomId: payload.roomId,
              sessionId: payload.sessionId,
              userId,
              createdAt,
              payload: {
                reason: 'submit_not_accepted_no_hard_reject',
                requestId: String(payload.requestId),
                channelId: payload.channelId,
                textSummary: summarizeText(payload.text),
              },
            }),
          );
          reasons.push('event.PLAYER_MESSAGE_SUBMIT_SUPPRESSED');
        }
        break;
      }
      default:
        break;
    }

    if (transaction.delta) {
      const deltaBuild = buildFromDelta(transaction.event, transaction.delta, transaction.state);
      envelopes.push(...deltaBuild.envelopes);
      reasons.push(...deltaBuild.reasons.map((reason) => `transaction.${reason}`));
    }

    if (transaction.policy?.channel?.allowed) {
      const activeChannel = roomId ? transaction.state.rooms[roomId as ChatRoomId]?.activeVisibleChannel ?? null : null;
      if (activeChannel && transaction.policy.channel.effectiveChannelId !== activeChannel) {
        envelopes.push(
          createEnvelope({
            eventName: 'channel_switched',
            roomId,
            sessionId,
            userId,
            createdAt,
            payload: {
              activeChannel,
              effectiveChannelId: transaction.policy.channel.effectiveChannelId,
              reasons: transaction.policy.channel.reasons,
            },
          }),
        );
        reasons.push('transaction.policy.channel');
      }
    }

    if (transaction.delta?.appendedMessages.length) {
      for (const message of transaction.delta.appendedMessages) {
        if (message.attribution.npcRole === 'HELPER') {
          envelopes.push(
            createEnvelope({
              eventName: 'helper_fired',
              roomId: message.roomId,
              sessionId: message.attribution.authorSessionId,
              userId: message.attribution.authorUserId,
              createdAt: message.createdAt,
              payload: buildNpcEscalationPayload(message, transaction.event.eventId, 'HELPER'),
            }),
          );
          reasons.push('transaction.appendedMessages.helper');
        }
        if (message.attribution.npcRole === 'HATER') {
          envelopes.push(
            createEnvelope({
              eventName: 'hater_escalated',
              roomId: message.roomId,
              sessionId: message.attribution.authorSessionId,
              userId: message.attribution.authorUserId,
              createdAt: message.createdAt,
              payload: buildNpcEscalationPayload(message, transaction.event.eventId, 'HATER'),
            }),
          );
          reasons.push('transaction.appendedMessages.hater');
        }
      }
    }

    const invasionBuild = buildInvasionTelemetry(transaction);
    envelopes.push(...invasionBuild.envelopes);
    reasons.push(...invasionBuild.reasons);

    const unique = dedupeTelemetryStable(stableSortTelemetryBatch(envelopes));

    return {
      envelopes: unique,
      reasons: uniqueStrings(reasons),
    };
  }

  function captureFromTransaction(
    transaction: ChatEngineTransaction,
  ): ChatTelemetryCaptureResult {
    const build = buildFromTransaction(transaction);
    return captureBatch(build.envelopes, 'TRANSACTION');
  }

  function queueIntoState(
    state: ChatState,
    envelopes: readonly ChatTelemetryEnvelope[],
  ): ChatState {
    if (envelopes.length === 0) return state;

    const merged = stableSortTelemetryBatch(
      dedupeTelemetryStable([
        ...state.telemetryQueue.map((entry) => sanitizeEnvelope(entry)),
        ...envelopes.map((entry) => sanitizeEnvelope(entry)),
      ]),
    );

    const capped = merged.slice(Math.max(0, merged.length - queuePolicy.maxBufferedEnvelopes));

    return {
      ...state,
      telemetryQueue: capped,
    };
  }

  async function flushBuffered(
    reason: ChatTelemetrySinkFlushReason = 'MANUAL',
  ): Promise<ChatTelemetryFlushResult> {
    if (internal.buffer.length === 0) {
      return {
        flushed: [],
        remaining: [],
        reason,
        state: internal,
      };
    }

    const batch = internal.buffer
      .slice(0, queuePolicy.maxBatchEmit)
      .map((entry) => entry.envelope);
    const remainingBuffer = internal.buffer.slice(batch.length);

    await emitBatch(batch);

    internal = {
      buffer: remainingBuffer,
      stats: {
        created: internal.stats.created,
        queued: internal.stats.queued,
        deduped: internal.stats.deduped,
        dropped: internal.stats.dropped,
        flushed: internal.stats.flushed + batch.length,
        flushCalls: internal.stats.flushCalls + 1,
      },
    };

    return {
      flushed: batch,
      remaining: remainingBuffer.map((entry) => entry.envelope),
      reason,
      state: internal,
    };
  }

  async function flushStateQueue(
    state: ChatState,
    reason: ChatTelemetrySinkFlushReason = 'STATE_QUEUE',
  ): Promise<{ readonly state: ChatState; readonly result: ChatTelemetryFlushResult }> {
    const batch = stableSortTelemetryBatch(state.telemetryQueue.map((entry) => sanitizeEnvelope(entry)));
    await emitBatch(batch);

    const nextState: ChatState = {
      ...state,
      telemetryQueue: [],
    };

    const result: ChatTelemetryFlushResult = {
      flushed: batch,
      remaining: [],
      reason,
      state: internal,
    };

    internal = {
      buffer: internal.buffer,
      stats: {
        created: internal.stats.created,
        queued: internal.stats.queued,
        deduped: internal.stats.deduped,
        dropped: internal.stats.dropped,
        flushed: internal.stats.flushed + batch.length,
        flushCalls: internal.stats.flushCalls + 1,
      },
    };

    return {
      state: nextState,
      result,
    };
  }

  function summarizeEnvelope(envelope: ChatTelemetryEnvelope): string {
    const summaryParts = [
      envelope.eventName,
      envelope.roomId ? `room=${String(envelope.roomId)}` : 'room=none',
      envelope.sessionId ? `session=${String(envelope.sessionId)}` : 'session=none',
      envelope.userId ? `user=${String(envelope.userId)}` : 'user=none',
      `payloadKeys=${Object.keys(envelope.payload).length}`,
    ];
    return summaryParts.join(' | ');
  }

  function summarizeBatch(batch: readonly ChatTelemetryEnvelope[]): readonly string[] {
    return batch.map((envelope) => summarizeEnvelope(envelope));
  }

  function clear(): void {
    internal = {
      buffer: [],
      stats: EMPTY_STATS,
    };
  }

  async function emitBatch(batch: readonly ChatTelemetryEnvelope[]): Promise<void> {
    if (batch.length === 0) return;

    try {
      await options.ports?.persistence?.saveTelemetry?.(batch);
    } catch (error) {
      logger.error('Chat telemetry sink persistence save failed.', {
        reason: serializeError(error),
        batchSize: batch.length,
      });
      throw error;
    }

    try {
      await options.ports?.dispatch?.emit?.(batch);
    } catch (error) {
      logger.error('Chat telemetry sink dispatch emit failed.', {
        reason: serializeError(error),
        batchSize: batch.length,
      });
      throw error;
    }
  }
}

// ============================================================================
// MARK: Envelope derivation helpers
// ============================================================================

export function mapRejectedTransactionEventName(
  kind: ChatEventKind,
): Nullable<ChatTelemetryEnvelope['eventName']> {
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
      return null;
  }
}

export function deriveUrgency(
  envelope: ChatTelemetryEnvelope,
): ChatTelemetrySinkUrgency {
  if (CRITICAL_EVENT_NAMES.has(envelope.eventName)) return 'CRITICAL';
  if (HIGH_EVENT_NAMES.has(envelope.eventName)) return 'HIGH';
  if (
    envelope.eventName === 'message_sent' ||
    envelope.eventName === 'presence_updated' ||
    envelope.eventName === 'typing_updated'
  ) {
    return 'STANDARD';
  }
  return 'BACKGROUND';
}

export function buildFingerprint(
  envelope: ChatTelemetryEnvelope,
  dedupeWindowMs: number,
): ChatTelemetrySinkFingerprint {
  const payloadKeyMaterial = stableJsonStringify(envelope.payload);
  const bucket = dedupeWindowMs > 0
    ? Math.floor(Number(envelope.createdAt) / dedupeWindowMs)
    : Number(envelope.createdAt);

  const key = [
    envelope.eventName,
    envelope.roomId ? String(envelope.roomId) : 'room:none',
    envelope.sessionId ? String(envelope.sessionId) : 'session:none',
    envelope.userId ? String(envelope.userId) : 'user:none',
    payloadKeyMaterial,
  ].join('|');

  return {
    key,
    windowBucket: bucket,
  };
}

export function isDuplicate(
  buffer: readonly ChatTelemetrySinkBufferedEnvelope[],
  fingerprint: ChatTelemetrySinkFingerprint,
  envelope: ChatTelemetryEnvelope,
): boolean {
  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    const existing = buffer[index];
    if (!existing) continue;
    if (existing.envelope.eventName !== envelope.eventName) continue;
    if (existing.fingerprint.windowBucket !== fingerprint.windowBucket) continue;
    if (existing.fingerprint.key === fingerprint.key) return true;
  }
  return false;
}

export function buildMessagePayload(
  message: ChatMessage,
  delta: ChatStateDelta,
  nextState?: ChatState,
): Readonly<Record<string, JsonValue>> {
  return {
    messageId: String(message.id),
    channelId: message.channelId,
    sourceType: message.attribution.sourceType,
    displayName: message.attribution.displayName,
    npcRole: message.attribution.npcRole,
    botId: message.attribution.botId,
    moderationOutcome: message.policy.moderationOutcome,
    rateOutcome: message.policy.rateOutcome,
    shadowOnly: message.policy.shadowOnly,
    wasRewritten: message.policy.wasRewritten,
    wasMasked: message.policy.wasMasked,
    replayId: message.replay.replayId ? String(message.replay.replayId) : null,
    sceneId: message.replay.sceneId ? String(message.replay.sceneId) : null,
    momentId: message.replay.momentId ? String(message.replay.momentId) : null,
    legendId: message.replay.legendId ? String(message.replay.legendId) : null,
    proofHash: message.proof.proofHash ? String(message.proof.proofHash) : null,
    causalParentMessageIds: message.proof.causalParentMessageIds.map((value) => String(value)),
    causalParentEventIds: message.proof.causalParentEventIds.map((value) => String(value)),
    tagCount: message.tags.length,
    textSummary: summarizeText(message.plainText),
    replayArtifactsAdded: delta.replayArtifacts.length,
    proofEdgesAdded: delta.proofEdges.length,
    roomMood: nextState?.rooms[message.roomId]?.stageMood ?? null,
  };
}

export function buildLearningPayload(
  profilesTouched: readonly ChatUserId[],
  snapshots: readonly ChatInferenceSnapshot[],
): Readonly<Record<string, JsonValue>> {
  return {
    profilesTouched: profilesTouched.map((profile) => String(profile)),
    inferenceIds: snapshots.map((snapshot) => String(snapshot.inferenceId)),
    churnRisk01Max: snapshots.reduce(
      (max, snapshot) => Math.max(max, Number(snapshot.churnRisk01)),
      0,
    ),
    engagement01Avg:
      snapshots.length > 0
        ? snapshots.reduce((sum, snapshot) => sum + Number(snapshot.engagement01), 0) /
          snapshots.length
        : 0,
  };
}

export function buildNpcEscalationPayload(
  message: ChatMessage,
  sourceEventId: ChatEventId,
  role: 'HATER' | 'HELPER',
): Readonly<Record<string, JsonValue>> {
  return {
    sourceEventId: String(sourceEventId),
    messageId: String(message.id),
    actorId: message.attribution.actorId,
    displayName: message.attribution.displayName,
    botId: message.attribution.botId,
    role,
    channelId: message.channelId,
    replayId: message.replay.replayId ? String(message.replay.replayId) : null,
    proofHash: message.proof.proofHash ? String(message.proof.proofHash) : null,
    textSummary: summarizeText(message.plainText),
  };
}

export function buildInvasionTelemetry(
  transaction: ChatEngineTransaction,
): { readonly envelopes: readonly ChatTelemetryEnvelope[]; readonly reasons: readonly string[] } {
  const event = transaction.event;
  const createdAt = asUnixMs(extractEventTime(event));
  const roomId = event.roomId ?? null;
  const sessionId = event.sessionId ?? null;
  const userId = event.userId ?? null;
  const envelopes: ChatTelemetryEnvelope[] = [];
  const reasons: string[] = [];

  if (event.kind === 'INVASION_OPENED') {
    envelopes.push({
      telemetryId: (`tel_${Number(createdAt)}_${hash32(`invasion_open:${String(event.eventId)}`)}` as ChatTelemetryId),
      eventName: 'invasion_opened',
      roomId,
      sessionId,
      userId,
      createdAt,
      payload: normalizePayloadRecord({
        eventId: String(event.eventId),
        metadata: normalizeJsonValue(event.metadata ?? {}),
      }),
    });
    reasons.push('event.INVASION_OPENED');
  }

  if (event.kind === 'INVASION_CLOSED') {
    envelopes.push({
      telemetryId: (`tel_${Number(createdAt)}_${hash32(`invasion_closed:${String(event.eventId)}`)}` as ChatTelemetryId),
      eventName: 'invasion_closed',
      roomId,
      sessionId,
      userId,
      createdAt,
      payload: normalizePayloadRecord({
        eventId: String(event.eventId),
        metadata: normalizeJsonValue(event.metadata ?? {}),
      }),
    });
    reasons.push('event.INVASION_CLOSED');
  }

  return {
    envelopes: envelopes,
    reasons,
  };
}

// ============================================================================
// MARK: Snapshot context payload builder
// ============================================================================

export interface ChatTelemetrySnapshotContext {
  readonly affect?: ChatAffectSnapshot | null;
  readonly learning?: ChatLearningProfile | null;
  readonly presence?: ChatPresenceSnapshot | null;
  readonly typing?: ChatTypingSnapshot | null;
  readonly pendingRequest?: ChatPendingRequestState | null;
  readonly replayArtifact?: ChatReplayArtifact | null;
  readonly fanoutPacket?: ChatFanoutPacket | null;
}

export function buildSnapshotContextPayload(
  context: ChatTelemetrySnapshotContext,
): Readonly<Record<string, JsonValue>> {
  const out: Record<string, JsonValue> = Object.create(null);
  if (context.affect) {
    out.affectActorId = String((context.affect as any).actorId ?? '');
    out.frustration01 = Number((context.affect as any).frustration01 ?? 0);
    out.engagement01 = Number((context.affect as any).engagement01 ?? 0);
    out.desperation01 = Number((context.affect as any).desperation01 ?? 0);
  }
  if (context.learning) {
    out.learningUserId = String((context.learning as any).userId ?? (context.learning as any).actorId ?? '');
    out.churnRisk01 = Number((context.learning as any).churnRisk01 ?? 0);
    out.learningConfidence01 = Number((context.learning as any).confidence01 ?? 0);
  }
  if (context.presence) {
    out.presenceActorId = String((context.presence as any).actorId ?? '');
    out.presenceState = String((context.presence as any).presence ?? (context.presence as any).state ?? '');
    out.presenceLastSeenAt = Number((context.presence as any).lastSeenAt ?? 0);
  }
  if (context.typing) {
    out.typingActorId = String((context.typing as any).actorId ?? '');
    out.isTyping = Boolean((context.typing as any).isTyping ?? false);
    out.typingLastAt = Number((context.typing as any).lastTypingAt ?? 0);
  }
  if (context.pendingRequest) {
    out.pendingRequestId = String((context.pendingRequest as any).requestId ?? '');
    out.pendingRequestKind = String((context.pendingRequest as any).kind ?? '');
  }
  if (context.replayArtifact) {
    out.replayArtifactId = String((context.replayArtifact as any).id ?? '');
    out.replayAnchorKey = String((context.replayArtifact as any).anchorKey ?? '');
  }
  if (context.fanoutPacket) {
    out.fanoutKind = String((context.fanoutPacket as any).kind ?? '');
    out.fanoutRoomId = String((context.fanoutPacket as any).roomId ?? '');
  }
  return normalizePayloadRecord(out);
}

// ============================================================================
// MARK: State and batch helpers
// ============================================================================

export function sanitizeEnvelope(
  envelope: ChatTelemetryEnvelope,
): ChatTelemetryEnvelope {
  return {
    telemetryId: envelope.telemetryId,
    eventName: envelope.eventName,
    roomId: envelope.roomId ?? null,
    sessionId: envelope.sessionId ?? null,
    userId: envelope.userId ?? null,
    createdAt: asUnixMs(Number(envelope.createdAt)),
    payload: normalizePayloadRecord(envelope.payload),
  };
}

export function stableSortTelemetryBatch(
  batch: readonly ChatTelemetryEnvelope[],
): readonly ChatTelemetryEnvelope[] {
  return [...batch].sort((left, right) => {
    if (Number(left.createdAt) !== Number(right.createdAt)) {
      return Number(left.createdAt) - Number(right.createdAt);
    }
    if (String(left.telemetryId) < String(right.telemetryId)) return -1;
    if (String(left.telemetryId) > String(right.telemetryId)) return 1;
    return 0;
  });
}

export function stableSortBuffered(
  batch: readonly ChatTelemetrySinkBufferedEnvelope[],
): readonly ChatTelemetrySinkBufferedEnvelope[] {
  return [...batch].sort((left, right) => {
    if (Number(left.envelope.createdAt) !== Number(right.envelope.createdAt)) {
      return Number(left.envelope.createdAt) - Number(right.envelope.createdAt);
    }
    if (String(left.envelope.telemetryId) < String(right.envelope.telemetryId)) return -1;
    if (String(left.envelope.telemetryId) > String(right.envelope.telemetryId)) return 1;
    return 0;
  });
}

export function dedupeTelemetryStable(
  batch: readonly ChatTelemetryEnvelope[],
): readonly ChatTelemetryEnvelope[] {
  const seen = new Set<string>();
  const out: ChatTelemetryEnvelope[] = [];
  for (const envelope of batch) {
    const key = [
      envelope.eventName,
      envelope.roomId ? String(envelope.roomId) : 'room:none',
      envelope.sessionId ? String(envelope.sessionId) : 'session:none',
      envelope.userId ? String(envelope.userId) : 'user:none',
      String(envelope.createdAt),
      stableJsonStringify(envelope.payload),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(envelope);
  }
  return out;
}

export function createEventNameCounter(): Record<ChatTelemetryEnvelope['eventName'], number> {
  const counter = Object.create(null) as Record<ChatTelemetryEnvelope['eventName'], number>;
  for (const name of TELEMETRY_EVENT_NAMES) {
    counter[name] = 0;
  }
  return counter;
}

// ============================================================================
// MARK: Serialization / payload normalization
// ============================================================================

export function normalizePayloadRecord(
  payload: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  const out: Record<string, JsonValue> = Object.create(null);
  const keys = Object.keys(payload).sort();
  for (const key of keys) {
    out[key] = normalizeJsonValue(payload[key]);
  }
  return out;
}

export function normalizeJsonValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry));
  }
  if (isRecord(value)) {
    const source = value as Record<string, unknown>;
    const out: Record<string, JsonValue> = Object.create(null);
    for (const key of Object.keys(source).sort()) {
      out[key] = normalizeJsonValue(source[key]);
    }
    return out;
  }
  return String(value);
}

export function stableJsonStringify(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(',')}]`;
  }
  const source = value as Record<string, JsonValue>;
  const keys = Object.keys(source).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJsonStringify(source[key])}`).join(',')}}`;
}

export function summarizeText(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 120) return collapsed;
  return `${collapsed.slice(0, 117)}...`;
}

export function summarizeRejectedPayload(payload: unknown): JsonValue {
  if (!isRecord(payload)) return normalizeJsonValue(payload);
  const summary: Record<string, JsonValue> = Object.create(null);
  if (typeof payload.roomId === 'string') summary.roomId = payload.roomId;
  if (typeof payload.sessionId === 'string') summary.sessionId = payload.sessionId;
  if (typeof payload.channelId === 'string') summary.channelId = payload.channelId;
  if (typeof payload.requestId === 'string') summary.requestId = payload.requestId;
  if (typeof payload.text === 'string') summary.textSummary = summarizeText(payload.text);
  return summary;
}

// ============================================================================
// MARK: Runtime + utility helpers
// ============================================================================

export function extractEventTime(event: ChatNormalizedInput): number {
  return Number(event.emittedAt ?? Date.now());
}

export function mergeQueuePolicy(
  partial: Partial<ChatTelemetrySinkQueuePolicy> | undefined,
): ChatTelemetrySinkQueuePolicy {
  return {
    ...DEFAULT_QUEUE_POLICY,
    ...partial,
    flushImmediatelyOn: partial?.flushImmediatelyOn ?? DEFAULT_QUEUE_POLICY.flushImmediatelyOn,
  };
}

export function mergeRuntime(
  partial: Partial<ChatRuntimeConfig> | undefined,
): ChatRuntimeConfig {
  return {
    version: BACKEND_CHAT_ENGINE_VERSION,
    allowVisibleChannels: partial?.allowVisibleChannels ?? [],
    allowShadowChannels: partial?.allowShadowChannels ?? [],
    ratePolicy: partial?.ratePolicy ?? {
      perSecondBurstLimit: 0,
      perMinuteLimit: 0,
      typingHeartbeatWindowMs: 0,
      identicalMessageWindowMs: 0,
      identicalMessageMaxCount: 0,
      npcMinimumGapMs: 0,
      helperMinimumGapMs: 0,
      haterMinimumGapMs: 0,
      invasionLockMs: 0,
    },
    moderationPolicy: partial?.moderationPolicy ?? {
      maxCharactersPerMessage: 0,
      maxLinesPerMessage: 0,
      maskBannedLexemes: [],
      rejectBannedLexemes: [],
      maxConsecutiveEmojiRuns: 0,
      maxSuspiciousUrlCount: 0,
      allowSlashCommands: true,
      rewriteAllCapsThreshold: 0,
      shadowModeOnHighRisk: false,
    },
    replayPolicy: partial?.replayPolicy ?? {
      enabled: true,
      maxMessagesPerRoom: 0,
      maxReplayArtifactsPerRoom: 0,
      replayTimeWindowMs: 0,
    },
    learningPolicy: partial?.learningPolicy ?? {
      enabled: true,
      updateOnEveryAcceptedMessage: true,
      coldStartEnabled: true,
      emitInferenceSnapshots: true,
      acceptClientHints: false,
      persistProfiles: true,
    },
    proofPolicy: partial?.proofPolicy ?? {
      enabled: true,
      hashAlgorithm: 'FNV1A32',
      linkModerationEdges: true,
      linkReplayEdges: true,
      linkLearningEdges: true,
    },
    invasionPolicy: partial?.invasionPolicy ?? {
      enabled: true,
      maxActivePerRoom: 0,
      minimumGapMs: 0,
      defaultDurationMs: 0,
      allowShadowPriming: false,
    },
  };
}

export function cloneStats(stats: ChatTelemetrySinkStats): ChatTelemetrySinkStats {
  return {
    created: stats.created,
    queued: stats.queued,
    deduped: stats.deduped,
    dropped: stats.dropped,
    flushed: stats.flushed,
    flushCalls: stats.flushCalls,
  };
}

export function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function randomKeyBase(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function hash32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
