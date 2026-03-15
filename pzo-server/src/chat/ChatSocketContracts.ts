/**
 * ============================================================================
 * POINT ZERO ONE — SERVER CHAT SOCKET CONTRACTS
 * FILE: pzo-server/src/chat/ChatSocketContracts.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical transport-facing socket contract registry for unified chat.
 *
 * This file exists to prevent the exact drift pattern already visible in the
 * donor lanes: frontend chat has a real engine split, server transport is still
 * thin and generic, and backend chat truth is intended to become authoritative.
 * The socket layer therefore needs one explicit contract surface that:
 *
 * - names every accepted inbound and outbound event,
 * - keeps payload law out of ad hoc gateway branches,
 * - defines validation and normalization once,
 * - constrains replay, typing, cursor, presence, control, and metrics traffic,
 * - preserves the transport/backend split,
 * - prevents silent schema drift between gateway, replay, and fanout services,
 * - and gives future ChatGateway.ts / handlers a single source of truth.
 *
 * Design laws
 * -----------
 * - Socket contracts define wire law, not backend truth.
 * - Socket contracts never mutate transcript state.
 * - Socket contracts may accept, reject, normalize, and reshape payloads.
 * - Socket contracts never bypass backend policy.
 * - Socket contracts may be stricter than clients, never looser.
 * - Every event is explicitly versioned by protocol capability, even when the
 *   wire payload stays JSON.
 * - Every validation decision should be explainable and machine-readable.
 *
 * Transport doctrine
 * ------------------
 * Client -> server events should remain intent-shaped.
 * Server -> client events should remain authority-shaped.
 * Replay, metrics, fanout, presence, and control are all first-class lanes.
 *
 * This file is intentionally deep because transport drift is expensive.
 * ============================================================================
 */

import { createHash, randomUUID } from 'crypto';
import type {
  ChatAudienceKind,
  ChatChannelId,
  ChatControlFanoutPayload,
  ChatCursorFanoutPayload,
  ChatFanoutEventName,
  ChatMessageFanoutPayload,
  ChatMetricsFanoutPayload,
  ChatPresenceFanoutPayload,
  ChatPresenceKind,
  ChatRecipientRole,
  ChatReplayFanoutPayload,
  ChatTypingFanoutPayload,
} from './ChatFanoutService';

/**
 * --------------------------------------------------------------------------
 * Protocol constants
 * --------------------------------------------------------------------------
 */

export const CHAT_SOCKET_PROTOCOL_NAME = 'pzo.unified.chat';
export const CHAT_SOCKET_PROTOCOL_VERSION = 1;
export const CHAT_SOCKET_PROTOCOL_REVISION = '2026-03-14.transport.chat.v1';

export const CHAT_SOCKET_MAX_RAW_FRAME_BYTES = 256 * 1024;
export const CHAT_SOCKET_MAX_BODY_LENGTH = 8_000;
export const CHAT_SOCKET_MAX_RENDERED_BODY_LENGTH = 16_000;
export const CHAT_SOCKET_MAX_STATUS_TEXT_LENGTH = 240;
export const CHAT_SOCKET_MAX_PREVIEW_TEXT_LENGTH = 320;
export const CHAT_SOCKET_MAX_TAG_COUNT = 32;
export const CHAT_SOCKET_MAX_BADGE_COUNT = 24;
export const CHAT_SOCKET_MAX_CURSOR_TEXT_LENGTH = 320;
export const CHAT_SOCKET_MAX_CHANNELS_PER_REQUEST = 12;
export const CHAT_SOCKET_MAX_TARGET_SESSIONS_PER_REQUEST = 32;
export const CHAT_SOCKET_MAX_ROOM_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_SESSION_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_EVENT_NAME_LENGTH = 96;
export const CHAT_SOCKET_MAX_CORRELATION_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_TRACE_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_REASON_LENGTH = 240;
export const CHAT_SOCKET_MAX_DIMENSION_TAGS = 24;

export const CHAT_SOCKET_TYPING_TTL_MS = 6_000;
export const CHAT_SOCKET_CURSOR_TTL_MS = 8_000;
export const CHAT_SOCKET_ACK_TIMEOUT_MS = 20_000;
export const CHAT_SOCKET_REPLAY_REQUEST_TIMEOUT_MS = 30_000;
export const CHAT_SOCKET_HEARTBEAT_GRACE_MS = 15_000;

/**
 * --------------------------------------------------------------------------
 * Event names and directionality
 * --------------------------------------------------------------------------
 */

export type ChatSocketInboundEventName =
  | 'chat:hello'
  | 'chat:resume'
  | 'chat:heartbeat'
  | 'chat:room:join'
  | 'chat:room:leave'
  | 'chat:message:send'
  | 'chat:presence:set'
  | 'chat:typing:set'
  | 'chat:cursor:update'
  | 'chat:cursor:clear'
  | 'chat:replay:request'
  | 'chat:replay:cancel'
  | 'chat:metrics:subscribe'
  | 'chat:metrics:unsubscribe'
  | 'chat:ack';

export type ChatSocketOutboundEventName =
  | ChatFanoutEventName
  | 'chat:error'
  | 'chat:ack:server'
  | 'chat:hello:accepted'
  | 'chat:resume:accepted'
  | 'chat:heartbeat:accepted'
  | 'chat:contract:warning';

export type ChatSocketEventName = ChatSocketInboundEventName | ChatSocketOutboundEventName;

export type ChatSocketDirection = 'CLIENT_TO_SERVER' | 'SERVER_TO_CLIENT';

export type ChatSocketCapability =
  | 'HELLO'
  | 'RESUME'
  | 'HEARTBEAT'
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'MESSAGE_SEND'
  | 'PRESENCE_SET'
  | 'TYPING_SET'
  | 'CURSOR_UPDATE'
  | 'CURSOR_CLEAR'
  | 'REPLAY_REQUEST'
  | 'REPLAY_CANCEL'
  | 'METRICS_SUBSCRIBE'
  | 'METRICS_UNSUBSCRIBE'
  | 'ACK'
  | 'MESSAGE_FANOUT'
  | 'PRESENCE_FANOUT'
  | 'TYPING_FANOUT'
  | 'CURSOR_FANOUT'
  | 'REPLAY_FANOUT'
  | 'CONTROL_FANOUT'
  | 'METRICS_FANOUT'
  | 'ERROR_FANOUT'
  | 'WARNING_FANOUT';

export type ChatSocketDeliveryClass =
  | 'INTENT_ONLY'
  | 'ACK_REQUIRED'
  | 'BEST_EFFORT'
  | 'STREAMED'
  | 'CONTROL'
  | 'INTERNAL';

/**
 * --------------------------------------------------------------------------
 * Replay-aligned transport unions
 * --------------------------------------------------------------------------
 */

export type ChatSocketReplayHydrationMode =
  | 'JOIN'
  | 'RESUME'
  | 'AUDIT'
  | 'MANUAL'
  | 'POST_RUN'
  | 'INVASION_REVIEW';

export type ChatSocketReplayAnchorKind =
  | 'TAIL'
  | 'MESSAGE_ID'
  | 'SEQUENCE'
  | 'EVENT_ID'
  | 'TIMESTAMP'
  | 'TURNING_POINT'
  | 'INVASION_START'
  | 'HELPER_INTERVENTION'
  | 'CHANNEL_BOUNDARY';

export type ChatSocketReplayExcerptKind =
  | 'TRANSCRIPT_RANGE'
  | 'SCENE'
  | 'INCURSION'
  | 'HELPER_SEQUENCE'
  | 'HATER_SEQUENCE'
  | 'DEAL_ROOM_WINDOW'
  | 'AUDIT_PROOF_WINDOW'
  | 'POST_RUN_SUMMARY';

/**
 * --------------------------------------------------------------------------
 * Error / rejection vocabulary
 * --------------------------------------------------------------------------
 */

export type ChatSocketErrorCode =
  | 'BAD_JSON'
  | 'BAD_SHAPE'
  | 'UNKNOWN_EVENT'
  | 'UNSUPPORTED_VERSION'
  | 'PAYLOAD_TOO_LARGE'
  | 'BODY_TOO_LARGE'
  | 'PREVIEW_TOO_LARGE'
  | 'STATUS_TOO_LARGE'
  | 'CURSOR_TOO_LARGE'
  | 'INVALID_ROOM_ID'
  | 'INVALID_SESSION_ID'
  | 'INVALID_CHANNEL'
  | 'INVALID_ROLE'
  | 'INVALID_PRESENCE'
  | 'INVALID_BOOLEAN'
  | 'INVALID_NUMBER'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_CURSOR'
  | 'INVALID_REPLAY_MODE'
  | 'INVALID_REPLAY_ANCHOR'
  | 'INVALID_REPLAY_EXCERPT'
  | 'INVALID_TARGETS'
  | 'INVALID_TAGS'
  | 'INVALID_BADGES'
  | 'INVALID_DIMENSIONS'
  | 'INVALID_ACK'
  | 'MISSING_FIELD'
  | 'ROOM_REQUIRED'
  | 'CHANNEL_REQUIRED'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'BACKEND_REJECTED'
  | 'BACKEND_TIMEOUT'
  | 'REPLAY_REJECTED'
  | 'METRICS_FORBIDDEN'
  | 'INTERNAL_ERROR';

export type ChatSocketWarningCode =
  | 'UNKNOWN_FIELDS_STRIPPED'
  | 'PREVIEW_TRUNCATED'
  | 'BODY_TRUNCATED'
  | 'CHANNELS_DEDUPED'
  | 'TARGETS_DEDUPED'
  | 'TAGS_TRUNCATED'
  | 'BADGES_TRUNCATED'
  | 'STALE_TIMESTAMP_NORMALIZED'
  | 'TTL_CLAMPED'
  | 'EXPIRES_NORMALIZED';

export type ChatSocketValidationDisposition =
  | 'ACCEPTED'
  | 'ACCEPTED_WITH_WARNINGS'
  | 'REJECTED';

/**
 * --------------------------------------------------------------------------
 * Envelope metadata
 * --------------------------------------------------------------------------
 */

export interface ChatSocketEnvelopeMeta {
  readonly protocol: typeof CHAT_SOCKET_PROTOCOL_NAME;
  readonly version: number;
  readonly revision: string;
  readonly emittedAtMs: number;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly serverInstanceId?: string;
  readonly sessionId?: string;
  readonly roomId?: string;
  readonly channelId?: ChatChannelId;
}

export interface ChatSocketEnvelopeBase<TEvent extends ChatSocketEventName, TPayload> {
  readonly event: TEvent;
  readonly meta: ChatSocketEnvelopeMeta;
  readonly payload: TPayload;
}

export interface ChatSocketRawFrame {
  readonly event?: unknown;
  readonly meta?: unknown;
  readonly payload?: unknown;
}

/**
 * --------------------------------------------------------------------------
 * Inbound payloads
 * --------------------------------------------------------------------------
 */

export interface ChatHelloPayload {
  readonly clientSessionId?: string;
  readonly authToken?: string;
  readonly reconnectToken?: string;
  readonly requestedCapabilities?: readonly ChatSocketCapability[];
  readonly viewerRole?: ChatRecipientRole;
  readonly roomId?: string;
  readonly channelId?: ChatChannelId;
  readonly heartbeatIntervalMs?: number;
  readonly transportHints?: Record<string, string | number | boolean>;
}

export interface ChatResumePayload {
  readonly sessionId: string;
  readonly reconnectToken?: string;
  readonly roomId?: string;
  readonly lastSeenAuthoritativeSequence?: number;
  readonly lastSeenEventId?: string;
  readonly resumeReplay?: boolean;
}

export interface ChatHeartbeatPayload {
  readonly clientTimestampMs: number;
  readonly roomId?: string;
  readonly latencyEchoId?: string;
}

export interface ChatRoomJoinPayload {
  readonly roomId: string;
  readonly channelId?: ChatChannelId;
  readonly spectator?: boolean;
  readonly visible?: boolean;
  readonly presence?: ChatPresenceKind;
  readonly hydrateReplay?: boolean;
  readonly hydrateMode?: ChatSocketReplayHydrationMode;
}

export interface ChatRoomLeavePayload {
  readonly roomId: string;
  readonly reason?: string;
}

export interface ChatMessageSendPayload {
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly body: string;
  readonly renderedBody?: string;
  readonly clientMessageId?: string;
  readonly localSequenceHint?: number;
  readonly tags?: readonly string[];
  readonly badges?: readonly string[];
  readonly targetSessionIds?: readonly string[];
  readonly replyToMessageId?: string;
  readonly proofHashHint?: string;
  readonly previewOnly?: boolean;
  readonly sourceTick?: number;
  readonly sourcePressure?: number;
}

export interface ChatPresenceSetPayload {
  readonly roomId: string;
  readonly channelId?: ChatChannelId;
  readonly presence: ChatPresenceKind;
  readonly visible?: boolean;
  readonly statusText?: string;
}

export interface ChatTypingSetPayload {
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly typing: boolean;
  readonly startedAtMs?: number;
  readonly expiresAtMs?: number;
  readonly cadenceClass?: 'FAST' | 'STEADY' | 'QUIET' | 'PREDATORY' | 'THEATRICAL';
}

export interface ChatCursorUpdatePayload {
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly composing: boolean;
  readonly caretStart: number;
  readonly caretEnd: number;
  readonly compositionLength?: number;
  readonly previewText?: string;
  readonly viewportToken?: string;
  readonly expiresAtMs?: number;
}

export interface ChatCursorClearPayload {
  readonly roomId: string;
  readonly channelId: ChatChannelId;
}

export interface ChatReplayRequestPayload {
  readonly roomId: string;
  readonly channelIds?: readonly ChatChannelId[];
  readonly hydrationMode: ChatSocketReplayHydrationMode;
  readonly anchor: {
    readonly kind: ChatSocketReplayAnchorKind;
    readonly value?: string | number;
    readonly channelId?: ChatChannelId;
  };
  readonly beforeCount?: number;
  readonly afterCount?: number;
  readonly includeMessages?: boolean;
  readonly includeEvents?: boolean;
  readonly includeProof?: boolean;
  readonly includeRedacted?: boolean;
  readonly includeShadow?: boolean;
  readonly excerptKind?: ChatSocketReplayExcerptKind;
  readonly targetSessionIds?: readonly string[];
}

export interface ChatReplayCancelPayload {
  readonly requestId: string;
  readonly roomId?: string;
}

export interface ChatMetricsSubscribePayload {
  readonly roomId?: string;
  readonly channelIds?: readonly ChatChannelId[];
  readonly metricNames?: readonly string[];
  readonly audienceKinds?: readonly ChatAudienceKind[];
  readonly live?: boolean;
}

export interface ChatMetricsUnsubscribePayload {
  readonly roomId?: string;
  readonly metricNames?: readonly string[];
}

export interface ChatAckPayload {
  readonly ackId: string;
  readonly event: ChatSocketOutboundEventName;
  readonly authoritativeEventId?: string;
  readonly requestId?: string;
  readonly roomId?: string;
}

/**
 * --------------------------------------------------------------------------
 * Inbound envelopes
 * --------------------------------------------------------------------------
 */

export type ChatHelloFrame = ChatSocketEnvelopeBase<'chat:hello', ChatHelloPayload>;
export type ChatResumeFrame = ChatSocketEnvelopeBase<'chat:resume', ChatResumePayload>;
export type ChatHeartbeatFrame = ChatSocketEnvelopeBase<'chat:heartbeat', ChatHeartbeatPayload>;
export type ChatRoomJoinFrame = ChatSocketEnvelopeBase<'chat:room:join', ChatRoomJoinPayload>;
export type ChatRoomLeaveFrame = ChatSocketEnvelopeBase<'chat:room:leave', ChatRoomLeavePayload>;
export type ChatMessageSendFrame = ChatSocketEnvelopeBase<'chat:message:send', ChatMessageSendPayload>;
export type ChatPresenceSetFrame = ChatSocketEnvelopeBase<'chat:presence:set', ChatPresenceSetPayload>;
export type ChatTypingSetFrame = ChatSocketEnvelopeBase<'chat:typing:set', ChatTypingSetPayload>;
export type ChatCursorUpdateFrame = ChatSocketEnvelopeBase<'chat:cursor:update', ChatCursorUpdatePayload>;
export type ChatCursorClearFrame = ChatSocketEnvelopeBase<'chat:cursor:clear', ChatCursorClearPayload>;
export type ChatReplayRequestFrame = ChatSocketEnvelopeBase<'chat:replay:request', ChatReplayRequestPayload>;
export type ChatReplayCancelFrame = ChatSocketEnvelopeBase<'chat:replay:cancel', ChatReplayCancelPayload>;
export type ChatMetricsSubscribeFrame = ChatSocketEnvelopeBase<'chat:metrics:subscribe', ChatMetricsSubscribePayload>;
export type ChatMetricsUnsubscribeFrame = ChatSocketEnvelopeBase<'chat:metrics:unsubscribe', ChatMetricsUnsubscribePayload>;
export type ChatAckFrame = ChatSocketEnvelopeBase<'chat:ack', ChatAckPayload>;

export type ChatSocketInboundFrame =
  | ChatHelloFrame
  | ChatResumeFrame
  | ChatHeartbeatFrame
  | ChatRoomJoinFrame
  | ChatRoomLeaveFrame
  | ChatMessageSendFrame
  | ChatPresenceSetFrame
  | ChatTypingSetFrame
  | ChatCursorUpdateFrame
  | ChatCursorClearFrame
  | ChatReplayRequestFrame
  | ChatReplayCancelFrame
  | ChatMetricsSubscribeFrame
  | ChatMetricsUnsubscribeFrame
  | ChatAckFrame;

/**
 * --------------------------------------------------------------------------
 * Outbound payloads
 * --------------------------------------------------------------------------
 */

export interface ChatHelloAcceptedPayload {
  readonly sessionId: string;
  readonly roomId?: string;
  readonly acceptedCapabilities: readonly ChatSocketCapability[];
  readonly heartbeatIntervalMs: number;
  readonly serverTimestampMs: number;
}

export interface ChatResumeAcceptedPayload {
  readonly sessionId: string;
  readonly roomId?: string;
  readonly resumed: boolean;
  readonly authoritativeSequence?: number;
  readonly replayRecommended?: boolean;
}

export interface ChatHeartbeatAcceptedPayload {
  readonly serverTimestampMs: number;
  readonly echoClientTimestampMs: number;
  readonly latencyEchoId?: string;
}

export interface ChatAckServerPayload {
  readonly ackId: string;
  readonly accepted: boolean;
  readonly requestId?: string;
  readonly authoritativeEventId?: string;
  readonly message?: string;
}

export interface ChatErrorPayload {
  readonly code: ChatSocketErrorCode;
  readonly message: string;
  readonly event?: ChatSocketInboundEventName | ChatSocketOutboundEventName;
  readonly requestId?: string;
  readonly fieldPath?: string;
  readonly details?: Record<string, unknown>;
  readonly retryable?: boolean;
}

export interface ChatContractWarningPayload {
  readonly warnings: readonly {
    readonly code: ChatSocketWarningCode;
    readonly message: string;
    readonly fieldPath?: string;
  }[];
  readonly event?: ChatSocketInboundEventName;
  readonly requestId?: string;
}

export type ChatMessageOutboundFrame = ChatSocketEnvelopeBase<'chat:message', ChatMessageFanoutPayload>;
export type ChatMessageRedactedOutboundFrame = ChatSocketEnvelopeBase<'chat:message:redacted', ChatMessageFanoutPayload>;
export type ChatPresenceOutboundFrame = ChatSocketEnvelopeBase<'chat:presence', ChatPresenceFanoutPayload>;
export type ChatTypingOutboundFrame = ChatSocketEnvelopeBase<'chat:typing', ChatTypingFanoutPayload>;
export type ChatCursorOutboundFrame = ChatSocketEnvelopeBase<'chat:cursor', ChatCursorFanoutPayload>;
export type ChatReplayChunkOutboundFrame = ChatSocketEnvelopeBase<'chat:replay:chunk', ChatReplayFanoutPayload>;
export type ChatReplayCompleteOutboundFrame = ChatSocketEnvelopeBase<'chat:replay:complete', ChatReplayFanoutPayload>;
export type ChatReplayErrorOutboundFrame = ChatSocketEnvelopeBase<'chat:replay:error', ChatControlFanoutPayload>;
export type ChatControlOutboundFrame = ChatSocketEnvelopeBase<'chat:control', ChatControlFanoutPayload>;
export type ChatMetricsOutboundFrame = ChatSocketEnvelopeBase<'chat:metrics', ChatMetricsFanoutPayload>;
export type ChatHelperOutboundFrame = ChatSocketEnvelopeBase<'chat:helper', ChatMessageFanoutPayload>;
export type ChatHaterOutboundFrame = ChatSocketEnvelopeBase<'chat:hater', ChatMessageFanoutPayload>;
export type ChatInvasionOutboundFrame = ChatSocketEnvelopeBase<'chat:invasion', ChatControlFanoutPayload>;
export type ChatSystemOutboundFrame = ChatSocketEnvelopeBase<'chat:system', ChatControlFanoutPayload>;
export type ChatDeliveryAckOutboundFrame = ChatSocketEnvelopeBase<'chat:delivery:ack', ChatAckServerPayload>;
export type ChatAckServerFrame = ChatSocketEnvelopeBase<'chat:ack:server', ChatAckServerPayload>;
export type ChatHelloAcceptedFrame = ChatSocketEnvelopeBase<'chat:hello:accepted', ChatHelloAcceptedPayload>;
export type ChatResumeAcceptedFrame = ChatSocketEnvelopeBase<'chat:resume:accepted', ChatResumeAcceptedPayload>;
export type ChatHeartbeatAcceptedFrame = ChatSocketEnvelopeBase<'chat:heartbeat:accepted', ChatHeartbeatAcceptedPayload>;
export type ChatErrorFrame = ChatSocketEnvelopeBase<'chat:error', ChatErrorPayload>;
export type ChatContractWarningFrame = ChatSocketEnvelopeBase<'chat:contract:warning', ChatContractWarningPayload>;

export type ChatSocketOutboundFrame =
  | ChatMessageOutboundFrame
  | ChatMessageRedactedOutboundFrame
  | ChatPresenceOutboundFrame
  | ChatTypingOutboundFrame
  | ChatCursorOutboundFrame
  | ChatReplayChunkOutboundFrame
  | ChatReplayCompleteOutboundFrame
  | ChatReplayErrorOutboundFrame
  | ChatControlOutboundFrame
  | ChatMetricsOutboundFrame
  | ChatHelperOutboundFrame
  | ChatHaterOutboundFrame
  | ChatInvasionOutboundFrame
  | ChatSystemOutboundFrame
  | ChatDeliveryAckOutboundFrame
  | ChatAckServerFrame
  | ChatHelloAcceptedFrame
  | ChatResumeAcceptedFrame
  | ChatHeartbeatAcceptedFrame
  | ChatErrorFrame
  | ChatContractWarningFrame;

/**
 * --------------------------------------------------------------------------
 * Validation structures
 * --------------------------------------------------------------------------
 */

export interface ChatSocketValidationWarning {
  readonly code: ChatSocketWarningCode;
  readonly message: string;
  readonly fieldPath?: string;
}

export interface ChatSocketValidationError {
  readonly code: ChatSocketErrorCode;
  readonly message: string;
  readonly fieldPath?: string;
}

export interface ChatSocketValidationResult<TFrame extends ChatSocketInboundFrame = ChatSocketInboundFrame> {
  readonly disposition: ChatSocketValidationDisposition;
  readonly frame?: TFrame;
  readonly warnings: readonly ChatSocketValidationWarning[];
  readonly errors: readonly ChatSocketValidationError[];
  readonly fingerprint: string;
  readonly rawByteEstimate: number;
}

export interface ChatSocketValidationSummary {
  readonly fingerprint: string;
  readonly disposition: ChatSocketValidationDisposition;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly rawByteEstimate: number;
  readonly event?: ChatSocketInboundEventName;
  readonly requestId?: string;
  readonly roomId?: string;
  readonly channelId?: ChatChannelId;
}

export interface ChatSocketContractDefinition {
  readonly event: ChatSocketEventName;
  readonly direction: ChatSocketDirection;
  readonly capability: ChatSocketCapability;
  readonly deliveryClass: ChatSocketDeliveryClass;
  readonly requiresRoom: boolean;
  readonly requiresChannel: boolean;
  readonly requiresAck: boolean;
  readonly maxPayloadBytes: number;
  readonly notes: readonly string[];
}

/**
 * --------------------------------------------------------------------------
 * Contract registry
 * --------------------------------------------------------------------------
 */

export const CHAT_SOCKET_CONTRACT_REGISTRY: Readonly<Record<ChatSocketEventName, ChatSocketContractDefinition>> = {
  'chat:hello': {
    event: 'chat:hello',
    direction: 'CLIENT_TO_SERVER',
    capability: 'HELLO',
    deliveryClass: 'ACK_REQUIRED',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 32 * 1024,
    notes: ['Initial bind', 'Capability negotiation'],
  },
  'chat:resume': {
    event: 'chat:resume',
    direction: 'CLIENT_TO_SERVER',
    capability: 'RESUME',
    deliveryClass: 'ACK_REQUIRED',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 24 * 1024,
    notes: ['Reconnect path', 'Resume by session'],
  },
  'chat:heartbeat': {
    event: 'chat:heartbeat',
    direction: 'CLIENT_TO_SERVER',
    capability: 'HEARTBEAT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 8 * 1024,
    notes: ['Latency echo', 'Liveness'],
  },
  'chat:room:join': {
    event: 'chat:room:join',
    direction: 'CLIENT_TO_SERVER',
    capability: 'ROOM_JOIN',
    deliveryClass: 'ACK_REQUIRED',
    requiresRoom: true,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 16 * 1024,
    notes: ['Room attach', 'Optional hydration'],
  },
  'chat:room:leave': {
    event: 'chat:room:leave',
    direction: 'CLIENT_TO_SERVER',
    capability: 'ROOM_LEAVE',
    deliveryClass: 'ACK_REQUIRED',
    requiresRoom: true,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 8 * 1024,
    notes: ['Room detach'],
  },
  'chat:message:send': {
    event: 'chat:message:send',
    direction: 'CLIENT_TO_SERVER',
    capability: 'MESSAGE_SEND',
    deliveryClass: 'ACK_REQUIRED',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: true,
    maxPayloadBytes: 64 * 1024,
    notes: ['Intent only', 'Backend moderation still final'],
  },
  'chat:presence:set': {
    event: 'chat:presence:set',
    direction: 'CLIENT_TO_SERVER',
    capability: 'PRESENCE_SET',
    deliveryClass: 'ACK_REQUIRED',
    requiresRoom: true,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 16 * 1024,
    notes: ['Presence intent'],
  },
  'chat:typing:set': {
    event: 'chat:typing:set',
    direction: 'CLIENT_TO_SERVER',
    capability: 'TYPING_SET',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 12 * 1024,
    notes: ['Transient'],
  },
  'chat:cursor:update': {
    event: 'chat:cursor:update',
    direction: 'CLIENT_TO_SERVER',
    capability: 'CURSOR_UPDATE',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 16 * 1024,
    notes: ['Transient', 'Preview bounded'],
  },
  'chat:cursor:clear': {
    event: 'chat:cursor:clear',
    direction: 'CLIENT_TO_SERVER',
    capability: 'CURSOR_CLEAR',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 8 * 1024,
    notes: ['Transient clear'],
  },
  'chat:replay:request': {
    event: 'chat:replay:request',
    direction: 'CLIENT_TO_SERVER',
    capability: 'REPLAY_REQUEST',
    deliveryClass: 'STREAMED',
    requiresRoom: true,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 32 * 1024,
    notes: ['Hydration request', 'Chunked replay response'],
  },
  'chat:replay:cancel': {
    event: 'chat:replay:cancel',
    direction: 'CLIENT_TO_SERVER',
    capability: 'REPLAY_CANCEL',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 8 * 1024,
    notes: ['Cancel replay flow'],
  },
  'chat:metrics:subscribe': {
    event: 'chat:metrics:subscribe',
    direction: 'CLIENT_TO_SERVER',
    capability: 'METRICS_SUBSCRIBE',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 16 * 1024,
    notes: ['Privileged lane'],
  },
  'chat:metrics:unsubscribe': {
    event: 'chat:metrics:unsubscribe',
    direction: 'CLIENT_TO_SERVER',
    capability: 'METRICS_UNSUBSCRIBE',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: true,
    maxPayloadBytes: 8 * 1024,
    notes: ['Privileged lane'],
  },
  'chat:ack': {
    event: 'chat:ack',
    direction: 'CLIENT_TO_SERVER',
    capability: 'ACK',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 8 * 1024,
    notes: ['Client ack to server'],
  },
  'chat:message': {
    event: 'chat:message',
    direction: 'SERVER_TO_CLIENT',
    capability: 'MESSAGE_FANOUT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 96 * 1024,
    notes: ['Authoritative delivery'],
  },
  'chat:message:redacted': {
    event: 'chat:message:redacted',
    direction: 'SERVER_TO_CLIENT',
    capability: 'MESSAGE_FANOUT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 96 * 1024,
    notes: ['Moderation-shaped delivery'],
  },
  'chat:presence': {
    event: 'chat:presence',
    direction: 'SERVER_TO_CLIENT',
    capability: 'PRESENCE_FANOUT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 24 * 1024,
    notes: ['Presence truth'],
  },
  'chat:typing': {
    event: 'chat:typing',
    direction: 'SERVER_TO_CLIENT',
    capability: 'TYPING_FANOUT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 16 * 1024,
    notes: ['Transient truth'],
  },
  'chat:cursor': {
    event: 'chat:cursor',
    direction: 'SERVER_TO_CLIENT',
    capability: 'CURSOR_FANOUT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 24 * 1024,
    notes: ['Transient truth'],
  },
  'chat:replay:chunk': {
    event: 'chat:replay:chunk',
    direction: 'SERVER_TO_CLIENT',
    capability: 'REPLAY_FANOUT',
    deliveryClass: 'STREAMED',
    requiresRoom: true,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 128 * 1024,
    notes: ['Chunked replay'],
  },
  'chat:replay:complete': {
    event: 'chat:replay:complete',
    direction: 'SERVER_TO_CLIENT',
    capability: 'REPLAY_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: true,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 128 * 1024,
    notes: ['Replay completion'],
  },
  'chat:replay:error': {
    event: 'chat:replay:error',
    direction: 'SERVER_TO_CLIENT',
    capability: 'REPLAY_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 24 * 1024,
    notes: ['Replay rejection'],
  },
  'chat:control': {
    event: 'chat:control',
    direction: 'SERVER_TO_CLIENT',
    capability: 'CONTROL_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 24 * 1024,
    notes: ['Control lane'],
  },
  'chat:metrics': {
    event: 'chat:metrics',
    direction: 'SERVER_TO_CLIENT',
    capability: 'METRICS_FANOUT',
    deliveryClass: 'INTERNAL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 24 * 1024,
    notes: ['Metrics lane'],
  },
  'chat:helper': {
    event: 'chat:helper',
    direction: 'SERVER_TO_CLIENT',
    capability: 'MESSAGE_FANOUT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 96 * 1024,
    notes: ['Helper persona fanout'],
  },
  'chat:hater': {
    event: 'chat:hater',
    direction: 'SERVER_TO_CLIENT',
    capability: 'MESSAGE_FANOUT',
    deliveryClass: 'BEST_EFFORT',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 96 * 1024,
    notes: ['Hater persona fanout'],
  },
  'chat:invasion': {
    event: 'chat:invasion',
    direction: 'SERVER_TO_CLIENT',
    capability: 'CONTROL_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: true,
    requiresChannel: true,
    requiresAck: false,
    maxPayloadBytes: 32 * 1024,
    notes: ['Invasion control'],
  },
  'chat:system': {
    event: 'chat:system',
    direction: 'SERVER_TO_CLIENT',
    capability: 'CONTROL_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 24 * 1024,
    notes: ['System notices'],
  },
  'chat:delivery:ack': {
    event: 'chat:delivery:ack',
    direction: 'SERVER_TO_CLIENT',
    capability: 'CONTROL_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 16 * 1024,
    notes: ['Delivery ack'],
  },
  'chat:error': {
    event: 'chat:error',
    direction: 'SERVER_TO_CLIENT',
    capability: 'ERROR_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 24 * 1024,
    notes: ['Transport errors'],
  },
  'chat:ack:server': {
    event: 'chat:ack:server',
    direction: 'SERVER_TO_CLIENT',
    capability: 'ACK',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 16 * 1024,
    notes: ['Server ack'],
  },
  'chat:hello:accepted': {
    event: 'chat:hello:accepted',
    direction: 'SERVER_TO_CLIENT',
    capability: 'HELLO',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 16 * 1024,
    notes: ['Handshake accepted'],
  },
  'chat:resume:accepted': {
    event: 'chat:resume:accepted',
    direction: 'SERVER_TO_CLIENT',
    capability: 'RESUME',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 16 * 1024,
    notes: ['Resume accepted'],
  },
  'chat:heartbeat:accepted': {
    event: 'chat:heartbeat:accepted',
    direction: 'SERVER_TO_CLIENT',
    capability: 'HEARTBEAT',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 12 * 1024,
    notes: ['Heartbeat ack'],
  },
  'chat:contract:warning': {
    event: 'chat:contract:warning',
    direction: 'SERVER_TO_CLIENT',
    capability: 'WARNING_FANOUT',
    deliveryClass: 'CONTROL',
    requiresRoom: false,
    requiresChannel: false,
    requiresAck: false,
    maxPayloadBytes: 16 * 1024,
    notes: ['Normalization warnings'],
  },
};

/**
 * --------------------------------------------------------------------------
 * Helper guards
 * --------------------------------------------------------------------------
 */

const CHAT_CHANNEL_IDS: readonly ChatChannelId[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
  'LIVEOPS_SHADOW',
] as const;

const CHAT_RECIPIENT_ROLES: readonly ChatRecipientRole[] = [
  'PLAYER',
  'SPECTATOR',
  'MODERATOR',
  'HELPER',
  'HATER',
  'NPC',
  'SYSTEM',
] as const;

const CHAT_PRESENCE_KINDS: readonly ChatPresenceKind[] = [
  'ONLINE',
  'AWAY',
  'HIDDEN',
  'DISCONNECTED',
  'RECONNECTING',
  'SPECTATING',
  'HELPER_PRESENT',
  'HATER_PRESENT',
  'NPC_PRESENT',
] as const;

const CHAT_REPLAY_HYDRATION_MODES: readonly ChatSocketReplayHydrationMode[] = [
  'JOIN',
  'RESUME',
  'AUDIT',
  'MANUAL',
  'POST_RUN',
  'INVASION_REVIEW',
] as const;

const CHAT_REPLAY_ANCHOR_KINDS: readonly ChatSocketReplayAnchorKind[] = [
  'TAIL',
  'MESSAGE_ID',
  'SEQUENCE',
  'EVENT_ID',
  'TIMESTAMP',
  'TURNING_POINT',
  'INVASION_START',
  'HELPER_INTERVENTION',
  'CHANNEL_BOUNDARY',
] as const;

const CHAT_REPLAY_EXCERPT_KINDS: readonly ChatSocketReplayExcerptKind[] = [
  'TRANSCRIPT_RANGE',
  'SCENE',
  'INCURSION',
  'HELPER_SEQUENCE',
  'HATER_SEQUENCE',
  'DEAL_ROOM_WINDOW',
  'AUDIT_PROOF_WINDOW',
  'POST_RUN_SUMMARY',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function coerceString(
  value: unknown,
  maxLength: number,
  fieldPath: string,
  errors: ChatSocketValidationError[],
  warnings: ChatSocketValidationWarning[],
  options?: { required?: boolean; trim?: boolean; allowEmpty?: boolean },
): string | undefined {
  if (value === undefined || value === null) {
    if (options?.required) {
      errors.push({ code: 'MISSING_FIELD', message: `${fieldPath} is required`, fieldPath });
    }
    return undefined;
  }
  if (!isString(value)) {
    errors.push({ code: 'BAD_SHAPE', message: `${fieldPath} must be a string`, fieldPath });
    return undefined;
  }
  const normalized = options?.trim === false ? value : value.trim();
  if (!options?.allowEmpty && normalized.length === 0) {
    errors.push({ code: 'BAD_SHAPE', message: `${fieldPath} cannot be empty`, fieldPath });
    return undefined;
  }
  if (normalized.length > maxLength) {
    warnings.push({ code: 'BODY_TRUNCATED', message: `${fieldPath} truncated to ${maxLength}`, fieldPath });
    return normalized.slice(0, maxLength);
  }
  return normalized;
}

function coerceNumber(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
  options?: { required?: boolean; min?: number; max?: number; integer?: boolean },
): number | undefined {
  if (value === undefined || value === null) {
    if (options?.required) {
      errors.push({ code: 'MISSING_FIELD', message: `${fieldPath} is required`, fieldPath });
    }
    return undefined;
  }
  if (!isNumber(value)) {
    errors.push({ code: 'INVALID_NUMBER', message: `${fieldPath} must be a finite number`, fieldPath });
    return undefined;
  }
  if (options?.integer && !Number.isInteger(value)) {
    errors.push({ code: 'INVALID_NUMBER', message: `${fieldPath} must be an integer`, fieldPath });
    return undefined;
  }
  if (options?.min !== undefined && value < options.min) {
    errors.push({ code: 'INVALID_NUMBER', message: `${fieldPath} must be >= ${options.min}`, fieldPath });
    return undefined;
  }
  if (options?.max !== undefined && value > options.max) {
    errors.push({ code: 'INVALID_NUMBER', message: `${fieldPath} must be <= ${options.max}`, fieldPath });
    return undefined;
  }
  return value;
}

function coerceBoolean(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
  options?: { required?: boolean; defaultValue?: boolean },
): boolean | undefined {
  if (value === undefined || value === null) {
    if (options?.required) {
      errors.push({ code: 'MISSING_FIELD', message: `${fieldPath} is required`, fieldPath });
      return undefined;
    }
    return options?.defaultValue;
  }
  if (!isBoolean(value)) {
    errors.push({ code: 'INVALID_BOOLEAN', message: `${fieldPath} must be boolean`, fieldPath });
    return undefined;
  }
  return value;
}

function coerceStringArray(
  value: unknown,
  maxItems: number,
  itemMaxLength: number,
  fieldPath: string,
  errors: ChatSocketValidationError[],
  warnings: ChatSocketValidationWarning[],
): readonly string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    errors.push({ code: 'BAD_SHAPE', message: `${fieldPath} must be an array`, fieldPath });
    return undefined;
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const coerced = coerceString(item, itemMaxLength, `${fieldPath}[${index}]`, errors, warnings, { required: true });
    if (!coerced) {
      continue;
    }
    if (seen.has(coerced)) {
      continue;
    }
    seen.add(coerced);
    normalized.push(coerced);
  }
  if (normalized.length > maxItems) {
    warnings.push({ code: 'TARGETS_DEDUPED', message: `${fieldPath} truncated to ${maxItems}`, fieldPath });
    return normalized.slice(0, maxItems);
  }
  return normalized;
}

function coerceChannel(value: unknown, fieldPath: string, errors: ChatSocketValidationError[]): ChatChannelId | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isString(value) || !CHAT_CHANNEL_IDS.includes(value as ChatChannelId)) {
    errors.push({ code: 'INVALID_CHANNEL', message: `${fieldPath} is not a valid channel`, fieldPath });
    return undefined;
  }
  return value as ChatChannelId;
}

function coercePresence(value: unknown, fieldPath: string, errors: ChatSocketValidationError[]): ChatPresenceKind | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isString(value) || !CHAT_PRESENCE_KINDS.includes(value as ChatPresenceKind)) {
    errors.push({ code: 'INVALID_PRESENCE', message: `${fieldPath} is not a valid presence`, fieldPath });
    return undefined;
  }
  return value as ChatPresenceKind;
}

function coerceRole(value: unknown, fieldPath: string, errors: ChatSocketValidationError[]): ChatRecipientRole | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isString(value) || !CHAT_RECIPIENT_ROLES.includes(value as ChatRecipientRole)) {
    errors.push({ code: 'INVALID_ROLE', message: `${fieldPath} is not a valid role`, fieldPath });
    return undefined;
  }
  return value as ChatRecipientRole;
}

function coerceReplayMode(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
): ChatSocketReplayHydrationMode | undefined {
  if (!isString(value) || !CHAT_REPLAY_HYDRATION_MODES.includes(value as ChatSocketReplayHydrationMode)) {
    errors.push({ code: 'INVALID_REPLAY_MODE', message: `${fieldPath} is not a valid replay mode`, fieldPath });
    return undefined;
  }
  return value as ChatSocketReplayHydrationMode;
}

function coerceReplayAnchorKind(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
): ChatSocketReplayAnchorKind | undefined {
  if (!isString(value) || !CHAT_REPLAY_ANCHOR_KINDS.includes(value as ChatSocketReplayAnchorKind)) {
    errors.push({ code: 'INVALID_REPLAY_ANCHOR', message: `${fieldPath} is not a valid replay anchor kind`, fieldPath });
    return undefined;
  }
  return value as ChatSocketReplayAnchorKind;
}

function coerceReplayExcerptKind(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
): ChatSocketReplayExcerptKind | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isString(value) || !CHAT_REPLAY_EXCERPT_KINDS.includes(value as ChatSocketReplayExcerptKind)) {
    errors.push({ code: 'INVALID_REPLAY_EXCERPT', message: `${fieldPath} is not a valid replay excerpt`, fieldPath });
    return undefined;
  }
  return value as ChatSocketReplayExcerptKind;
}

function estimateRawFrameBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return CHAT_SOCKET_MAX_RAW_FRAME_BYTES + 1;
  }
}

function fingerprintFrame(raw: unknown): string {
  const serialized = (() => {
    try {
      return JSON.stringify(raw) ?? '';
    } catch {
      return String(raw);
    }
  })();
  return createHash('sha256').update(serialized).digest('hex');
}

function defaultMeta(partial?: Partial<ChatSocketEnvelopeMeta>): ChatSocketEnvelopeMeta {
  return {
    protocol: CHAT_SOCKET_PROTOCOL_NAME,
    version: CHAT_SOCKET_PROTOCOL_VERSION,
    revision: CHAT_SOCKET_PROTOCOL_REVISION,
    emittedAtMs: Date.now(),
    requestId: partial?.requestId,
    correlationId: partial?.correlationId,
    traceId: partial?.traceId,
    serverInstanceId: partial?.serverInstanceId,
    sessionId: partial?.sessionId,
    roomId: partial?.roomId,
    channelId: partial?.channelId,
  };
}

/**
 * --------------------------------------------------------------------------
 * Meta validation
 * --------------------------------------------------------------------------
 */

function validateMeta(
  rawMeta: unknown,
  warnings: ChatSocketValidationWarning[],
  errors: ChatSocketValidationError[],
): ChatSocketEnvelopeMeta {
  const metaRecord = isRecord(rawMeta) ? rawMeta : {};
  const rawProtocol = coerceString(metaRecord.protocol, 64, 'meta.protocol', errors, warnings, { allowEmpty: false })
    ?? CHAT_SOCKET_PROTOCOL_NAME;
  const protocol = CHAT_SOCKET_PROTOCOL_NAME;
  const version = coerceNumber(metaRecord.version, 'meta.version', errors, { integer: true, min: 1 })
    ?? CHAT_SOCKET_PROTOCOL_VERSION;
  const revision = coerceString(metaRecord.revision, 128, 'meta.revision', errors, warnings, { allowEmpty: false })
    ?? CHAT_SOCKET_PROTOCOL_REVISION;
  const emittedAtMs = coerceNumber(metaRecord.emittedAtMs, 'meta.emittedAtMs', errors, { integer: true, min: 0 })
    ?? Date.now();
  const requestId = coerceString(metaRecord.requestId, CHAT_SOCKET_MAX_CORRELATION_ID_LENGTH, 'meta.requestId', errors, warnings);
  const correlationId = coerceString(metaRecord.correlationId, CHAT_SOCKET_MAX_CORRELATION_ID_LENGTH, 'meta.correlationId', errors, warnings);
  const traceId = coerceString(metaRecord.traceId, CHAT_SOCKET_MAX_TRACE_ID_LENGTH, 'meta.traceId', errors, warnings);
  const serverInstanceId = coerceString(metaRecord.serverInstanceId, 128, 'meta.serverInstanceId', errors, warnings);
  const sessionId = coerceString(metaRecord.sessionId, CHAT_SOCKET_MAX_SESSION_ID_LENGTH, 'meta.sessionId', errors, warnings);
  const roomId = coerceString(metaRecord.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'meta.roomId', errors, warnings);
  const channelId = coerceChannel(metaRecord.channelId, 'meta.channelId', errors);

  return {
    protocol,
    version,
    revision,
    emittedAtMs,
    requestId,
    correlationId,
    traceId,
    serverInstanceId,
    sessionId,
    roomId,
    channelId,
  };
}

/**
 * --------------------------------------------------------------------------
 * Event-specific validators
 * --------------------------------------------------------------------------
 */

function validateHelloPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatHelloPayload {
  const record = isRecord(payload) ? payload : {};
  return {
    clientSessionId: coerceString(record.clientSessionId, CHAT_SOCKET_MAX_SESSION_ID_LENGTH, 'payload.clientSessionId', errors, warnings),
    authToken: coerceString(record.authToken, 8_192, 'payload.authToken', errors, warnings),
    reconnectToken: coerceString(record.reconnectToken, 8_192, 'payload.reconnectToken', errors, warnings),
    requestedCapabilities: coerceStringArray(record.requestedCapabilities, 64, 64, 'payload.requestedCapabilities', errors, warnings) as readonly ChatSocketCapability[] | undefined,
    viewerRole: coerceRole(record.viewerRole, 'payload.viewerRole', errors),
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings),
    channelId: coerceChannel(record.channelId, 'payload.channelId', errors),
    heartbeatIntervalMs: coerceNumber(record.heartbeatIntervalMs, 'payload.heartbeatIntervalMs', errors, { integer: true, min: 1_000, max: 120_000 }),
    transportHints: isRecord(record.transportHints) ? sanitizePrimitiveRecord(record.transportHints, 'payload.transportHints', warnings) : undefined,
  };
}

function validateResumePayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatResumePayload {
  const record = isRecord(payload) ? payload : {};
  const sessionId = coerceString(record.sessionId, CHAT_SOCKET_MAX_SESSION_ID_LENGTH, 'payload.sessionId', errors, warnings, { required: true });
  return {
    sessionId: sessionId ?? '',
    reconnectToken: coerceString(record.reconnectToken, 8_192, 'payload.reconnectToken', errors, warnings),
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings),
    lastSeenAuthoritativeSequence: coerceNumber(record.lastSeenAuthoritativeSequence, 'payload.lastSeenAuthoritativeSequence', errors, { integer: true, min: 0 }),
    lastSeenEventId: coerceString(record.lastSeenEventId, 128, 'payload.lastSeenEventId', errors, warnings),
    resumeReplay: coerceBoolean(record.resumeReplay, 'payload.resumeReplay', errors, { defaultValue: false }),
  };
}

function validateHeartbeatPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatHeartbeatPayload {
  const record = isRecord(payload) ? payload : {};
  return {
    clientTimestampMs: coerceNumber(record.clientTimestampMs, 'payload.clientTimestampMs', errors, { integer: true, min: 0, required: true }) ?? 0,
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings),
    latencyEchoId: coerceString(record.latencyEchoId, 128, 'payload.latencyEchoId', errors, warnings),
  };
}

function validateRoomJoinPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatRoomJoinPayload {
  const record = isRecord(payload) ? payload : {};
  const roomId = coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true });
  return {
    roomId: roomId ?? '',
    channelId: coerceChannel(record.channelId, 'payload.channelId', errors),
    spectator: coerceBoolean(record.spectator, 'payload.spectator', errors, { defaultValue: false }),
    visible: coerceBoolean(record.visible, 'payload.visible', errors, { defaultValue: true }),
    presence: coercePresence(record.presence, 'payload.presence', errors),
    hydrateReplay: coerceBoolean(record.hydrateReplay, 'payload.hydrateReplay', errors, { defaultValue: false }),
    hydrateMode: record.hydrateMode === undefined ? undefined : coerceReplayMode(record.hydrateMode, 'payload.hydrateMode', errors),
  };
}

function validateRoomLeavePayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatRoomLeavePayload {
  const record = isRecord(payload) ? payload : {};
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true }) ?? '',
    reason: coerceString(record.reason, CHAT_SOCKET_MAX_REASON_LENGTH, 'payload.reason', errors, warnings),
  };
}

function validateMessageSendPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatMessageSendPayload {
  const record = isRecord(payload) ? payload : {};
  const roomId = coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true });
  const channelId = coerceChannel(record.channelId, 'payload.channelId', errors);
  const body = coerceString(record.body, CHAT_SOCKET_MAX_BODY_LENGTH, 'payload.body', errors, warnings, { required: true, allowEmpty: false });
  return {
    roomId: roomId ?? '',
    channelId: channelId ?? 'GLOBAL',
    body: body ?? '',
    renderedBody: coerceString(record.renderedBody, CHAT_SOCKET_MAX_RENDERED_BODY_LENGTH, 'payload.renderedBody', errors, warnings),
    clientMessageId: coerceString(record.clientMessageId, 128, 'payload.clientMessageId', errors, warnings),
    localSequenceHint: coerceNumber(record.localSequenceHint, 'payload.localSequenceHint', errors, { integer: true, min: 0 }),
    tags: coerceStringArray(record.tags, CHAT_SOCKET_MAX_TAG_COUNT, 64, 'payload.tags', errors, warnings),
    badges: coerceStringArray(record.badges, CHAT_SOCKET_MAX_BADGE_COUNT, 64, 'payload.badges', errors, warnings),
    targetSessionIds: coerceStringArray(record.targetSessionIds, CHAT_SOCKET_MAX_TARGET_SESSIONS_PER_REQUEST, CHAT_SOCKET_MAX_SESSION_ID_LENGTH, 'payload.targetSessionIds', errors, warnings),
    replyToMessageId: coerceString(record.replyToMessageId, 128, 'payload.replyToMessageId', errors, warnings),
    proofHashHint: coerceString(record.proofHashHint, 256, 'payload.proofHashHint', errors, warnings),
    previewOnly: coerceBoolean(record.previewOnly, 'payload.previewOnly', errors, { defaultValue: false }),
    sourceTick: coerceNumber(record.sourceTick, 'payload.sourceTick', errors, { integer: true, min: 0 }),
    sourcePressure: coerceNumber(record.sourcePressure, 'payload.sourcePressure', errors, { min: 0 }),
  };
}

function validatePresenceSetPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatPresenceSetPayload {
  const record = isRecord(payload) ? payload : {};
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true }) ?? '',
    channelId: coerceChannel(record.channelId, 'payload.channelId', errors),
    presence: coercePresence(record.presence, 'payload.presence', errors) ?? 'ONLINE',
    visible: coerceBoolean(record.visible, 'payload.visible', errors, { defaultValue: true }),
    statusText: coerceString(record.statusText, CHAT_SOCKET_MAX_STATUS_TEXT_LENGTH, 'payload.statusText', errors, warnings),
  };
}

function validateTypingSetPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatTypingSetPayload {
  const record = isRecord(payload) ? payload : {};
  const startedAtMs = coerceNumber(record.startedAtMs, 'payload.startedAtMs', errors, { integer: true, min: 0 });
  let expiresAtMs = coerceNumber(record.expiresAtMs, 'payload.expiresAtMs', errors, { integer: true, min: 0 });
  if (expiresAtMs !== undefined && startedAtMs !== undefined && expiresAtMs < startedAtMs) {
    warnings.push({ code: 'EXPIRES_NORMALIZED', message: 'payload.expiresAtMs normalized to typing TTL', fieldPath: 'payload.expiresAtMs' });
    expiresAtMs = startedAtMs + CHAT_SOCKET_TYPING_TTL_MS;
  }
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true }) ?? '',
    channelId: coerceChannel(record.channelId, 'payload.channelId', errors) ?? 'GLOBAL',
    typing: coerceBoolean(record.typing, 'payload.typing', errors, { required: true }) ?? false,
    startedAtMs,
    expiresAtMs,
    cadenceClass: coerceCadenceClass(record.cadenceClass, 'payload.cadenceClass', errors),
  };
}

function validateCursorUpdatePayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatCursorUpdatePayload {
  const record = isRecord(payload) ? payload : {};
  const caretStart = coerceNumber(record.caretStart, 'payload.caretStart', errors, { integer: true, min: 0, required: true }) ?? 0;
  const caretEnd = coerceNumber(record.caretEnd, 'payload.caretEnd', errors, { integer: true, min: 0, required: true }) ?? 0;
  const compositionLength = coerceNumber(record.compositionLength, 'payload.compositionLength', errors, { integer: true, min: 0 })
    ?? Math.max(0, caretEnd - caretStart);
  let expiresAtMs = coerceNumber(record.expiresAtMs, 'payload.expiresAtMs', errors, { integer: true, min: 0 });
  if (expiresAtMs !== undefined && expiresAtMs > Date.now() + CHAT_SOCKET_CURSOR_TTL_MS) {
    warnings.push({ code: 'TTL_CLAMPED', message: 'payload.expiresAtMs clamped to cursor TTL', fieldPath: 'payload.expiresAtMs' });
    expiresAtMs = Date.now() + CHAT_SOCKET_CURSOR_TTL_MS;
  }
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true }) ?? '',
    channelId: coerceChannel(record.channelId, 'payload.channelId', errors) ?? 'GLOBAL',
    composing: coerceBoolean(record.composing, 'payload.composing', errors, { required: true }) ?? false,
    caretStart,
    caretEnd,
    compositionLength,
    previewText: coerceString(record.previewText, CHAT_SOCKET_MAX_CURSOR_TEXT_LENGTH, 'payload.previewText', errors, warnings),
    viewportToken: coerceString(record.viewportToken, 128, 'payload.viewportToken', errors, warnings),
    expiresAtMs,
  };
}

function validateCursorClearPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatCursorClearPayload {
  const record = isRecord(payload) ? payload : {};
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true }) ?? '',
    channelId: coerceChannel(record.channelId, 'payload.channelId', errors) ?? 'GLOBAL',
  };
}

function validateReplayRequestPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatReplayRequestPayload {
  const record = isRecord(payload) ? payload : {};
  const anchorRecord = isRecord(record.anchor) ? record.anchor : {};
  const hydrationMode = coerceReplayMode(record.hydrationMode, 'payload.hydrationMode', errors) ?? 'JOIN';
  const anchorKind = coerceReplayAnchorKind(anchorRecord.kind, 'payload.anchor.kind', errors) ?? 'TAIL';
  const channelIds = coerceChannelArray(record.channelIds, 'payload.channelIds', errors, warnings);
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings, { required: true }) ?? '',
    channelIds,
    hydrationMode,
    anchor: {
      kind: anchorKind,
      value: normalizeAnchorValue(anchorRecord.value, anchorKind, 'payload.anchor.value', errors),
      channelId: coerceChannel(anchorRecord.channelId, 'payload.anchor.channelId', errors),
    },
    beforeCount: coerceNumber(record.beforeCount, 'payload.beforeCount', errors, { integer: true, min: 0, max: 5_000 }),
    afterCount: coerceNumber(record.afterCount, 'payload.afterCount', errors, { integer: true, min: 0, max: 5_000 }),
    includeMessages: coerceBoolean(record.includeMessages, 'payload.includeMessages', errors, { defaultValue: true }),
    includeEvents: coerceBoolean(record.includeEvents, 'payload.includeEvents', errors, { defaultValue: true }),
    includeProof: coerceBoolean(record.includeProof, 'payload.includeProof', errors, { defaultValue: false }),
    includeRedacted: coerceBoolean(record.includeRedacted, 'payload.includeRedacted', errors, { defaultValue: false }),
    includeShadow: coerceBoolean(record.includeShadow, 'payload.includeShadow', errors, { defaultValue: false }),
    excerptKind: coerceReplayExcerptKind(record.excerptKind, 'payload.excerptKind', errors),
    targetSessionIds: coerceStringArray(record.targetSessionIds, CHAT_SOCKET_MAX_TARGET_SESSIONS_PER_REQUEST, CHAT_SOCKET_MAX_SESSION_ID_LENGTH, 'payload.targetSessionIds', errors, warnings),
  };
}

function validateReplayCancelPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatReplayCancelPayload {
  const record = isRecord(payload) ? payload : {};
  return {
    requestId: coerceString(record.requestId, 128, 'payload.requestId', errors, warnings, { required: true }) ?? '',
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings),
  };
}

function validateMetricsSubscribePayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatMetricsSubscribePayload {
  const record = isRecord(payload) ? payload : {};
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings),
    channelIds: coerceChannelArray(record.channelIds, 'payload.channelIds', errors, warnings),
    metricNames: coerceStringArray(record.metricNames, 128, 128, 'payload.metricNames', errors, warnings),
    audienceKinds: coerceAudienceKindArray(record.audienceKinds, 'payload.audienceKinds', errors, warnings),
    live: coerceBoolean(record.live, 'payload.live', errors, { defaultValue: true }),
  };
}

function validateMetricsUnsubscribePayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatMetricsUnsubscribePayload {
  const record = isRecord(payload) ? payload : {};
  return {
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings),
    metricNames: coerceStringArray(record.metricNames, 128, 128, 'payload.metricNames', errors, warnings),
  };
}

function validateAckPayload(payload: unknown, errors: ChatSocketValidationError[], warnings: ChatSocketValidationWarning[]): ChatAckPayload {
  const record = isRecord(payload) ? payload : {};
  const event = coerceOutboundEventName(record.event, 'payload.event', errors);
  return {
    ackId: coerceString(record.ackId, 128, 'payload.ackId', errors, warnings, { required: true }) ?? '',
    event: event ?? 'chat:error',
    authoritativeEventId: coerceString(record.authoritativeEventId, 128, 'payload.authoritativeEventId', errors, warnings),
    requestId: coerceString(record.requestId, 128, 'payload.requestId', errors, warnings),
    roomId: coerceString(record.roomId, CHAT_SOCKET_MAX_ROOM_ID_LENGTH, 'payload.roomId', errors, warnings),
  };
}

function sanitizePrimitiveRecord(
  record: Record<string, unknown>,
  fieldPath: string,
  warnings: ChatSocketValidationWarning[],
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [key, value] of Object.entries(record)) {
    if (count >= CHAT_SOCKET_MAX_DIMENSION_TAGS) {
      warnings.push({ code: 'UNKNOWN_FIELDS_STRIPPED', message: `${fieldPath} truncated to ${CHAT_SOCKET_MAX_DIMENSION_TAGS} entries`, fieldPath });
      break;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
      count += 1;
    }
  }
  return result;
}

function coerceCadenceClass(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
): ChatTypingFanoutPayload['cadenceClass'] | undefined {
  const allowed: readonly NonNullable<ChatTypingFanoutPayload['cadenceClass']>[] = ['FAST', 'STEADY', 'QUIET', 'PREDATORY', 'THEATRICAL'];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isString(value) || !allowed.includes(value as NonNullable<ChatTypingFanoutPayload['cadenceClass']>)) {
    errors.push({ code: 'BAD_SHAPE', message: `${fieldPath} is invalid`, fieldPath });
    return undefined;
  }
  return value as ChatTypingFanoutPayload['cadenceClass'];
}

function coerceChannelArray(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
  warnings: ChatSocketValidationWarning[],
): readonly ChatChannelId[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    errors.push({ code: 'BAD_SHAPE', message: `${fieldPath} must be an array`, fieldPath });
    return undefined;
  }
  const normalized: ChatChannelId[] = [];
  const seen = new Set<ChatChannelId>();
  for (let index = 0; index < value.length; index += 1) {
    const channel = coerceChannel(value[index], `${fieldPath}[${index}]`, errors);
    if (!channel || seen.has(channel)) {
      continue;
    }
    seen.add(channel);
    normalized.push(channel);
  }
  if (normalized.length > CHAT_SOCKET_MAX_CHANNELS_PER_REQUEST) {
    warnings.push({ code: 'CHANNELS_DEDUPED', message: `${fieldPath} truncated to ${CHAT_SOCKET_MAX_CHANNELS_PER_REQUEST}`, fieldPath });
    return normalized.slice(0, CHAT_SOCKET_MAX_CHANNELS_PER_REQUEST);
  }
  return normalized;
}

function coerceAudienceKindArray(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
  warnings: ChatSocketValidationWarning[],
): readonly ChatAudienceKind[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    errors.push({ code: 'BAD_SHAPE', message: `${fieldPath} must be an array`, fieldPath });
    return undefined;
  }
  const allowed: readonly ChatAudienceKind[] = [
    'ROOM_ALL',
    'ROOM_MEMBERS',
    'ROOM_ACTIVE',
    'ROOM_VISIBLE',
    'ROOM_SPECTATORS',
    'ROOM_NON_SPECTATORS',
    'ROOM_HELPERS',
    'ROOM_HATERS',
    'SESSION_LIST',
    'SESSION_SINGLE',
    'PLAYER_LIST',
    'PLAYER_SINGLE',
    'SHADOW_INTERNAL',
    'REPLAY_SUBSCRIBERS',
  ] as const;
  const normalized: ChatAudienceKind[] = [];
  const seen = new Set<ChatAudienceKind>();
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (!isString(entry) || !allowed.includes(entry as ChatAudienceKind)) {
      errors.push({ code: 'INVALID_DIMENSIONS', message: `${fieldPath}[${index}] is invalid`, fieldPath: `${fieldPath}[${index}]` });
      continue;
    }
    if (seen.has(entry as ChatAudienceKind)) {
      continue;
    }
    seen.add(entry as ChatAudienceKind);
    normalized.push(entry as ChatAudienceKind);
  }
  if (normalized.length > 32) {
    warnings.push({ code: 'UNKNOWN_FIELDS_STRIPPED', message: `${fieldPath} truncated`, fieldPath });
    return normalized.slice(0, 32);
  }
  return normalized;
}

function normalizeAnchorValue(
  value: unknown,
  anchorKind: ChatSocketReplayAnchorKind,
  fieldPath: string,
  errors: ChatSocketValidationError[],
): string | number | undefined {
  switch (anchorKind) {
    case 'TAIL':
      return undefined;
    case 'SEQUENCE':
    case 'TIMESTAMP': {
      return coerceNumber(value, fieldPath, errors, { integer: true, min: 0 });
    }
    default: {
      if (value === undefined || value === null) {
        errors.push({ code: 'MISSING_FIELD', message: `${fieldPath} is required for ${anchorKind}`, fieldPath });
        return undefined;
      }
      if (typeof value === 'string' || typeof value === 'number') {
        return value;
      }
      errors.push({ code: 'INVALID_REPLAY_ANCHOR', message: `${fieldPath} must be string or number`, fieldPath });
      return undefined;
    }
  }
}

function coerceOutboundEventName(
  value: unknown,
  fieldPath: string,
  errors: ChatSocketValidationError[],
): ChatSocketOutboundEventName | undefined {
  if (!isString(value)) {
    errors.push({ code: 'INVALID_ACK', message: `${fieldPath} must be a string`, fieldPath });
    return undefined;
  }
  if (!(value in CHAT_SOCKET_CONTRACT_REGISTRY)) {
    errors.push({ code: 'INVALID_ACK', message: `${fieldPath} is not a known event`, fieldPath });
    return undefined;
  }
  const contract = CHAT_SOCKET_CONTRACT_REGISTRY[value as ChatSocketEventName];
  if (!contract || contract.direction !== 'SERVER_TO_CLIENT') {
    errors.push({ code: 'INVALID_ACK', message: `${fieldPath} must reference a server event`, fieldPath });
    return undefined;
  }
  return value as ChatSocketOutboundEventName;
}

/**
 * --------------------------------------------------------------------------
 * Top-level validation entry point
 * --------------------------------------------------------------------------
 */

export function validateInboundSocketFrame(raw: unknown): ChatSocketValidationResult {
  const warnings: ChatSocketValidationWarning[] = [];
  const errors: ChatSocketValidationError[] = [];
  const rawByteEstimate = estimateRawFrameBytes(raw);
  const fingerprint = fingerprintFrame(raw);

  if (rawByteEstimate > CHAT_SOCKET_MAX_RAW_FRAME_BYTES) {
    errors.push({ code: 'PAYLOAD_TOO_LARGE', message: `Frame exceeds ${CHAT_SOCKET_MAX_RAW_FRAME_BYTES} bytes` });
    return {
      disposition: 'REJECTED',
      warnings,
      errors,
      fingerprint,
      rawByteEstimate,
    };
  }

  if (!isRecord(raw)) {
    errors.push({ code: 'BAD_SHAPE', message: 'Frame must be an object' });
    return {
      disposition: 'REJECTED',
      warnings,
      errors,
      fingerprint,
      rawByteEstimate,
    };
  }

  const eventValue = raw.event;
  if (!isString(eventValue)) {
    errors.push({ code: 'UNKNOWN_EVENT', message: 'Frame event must be a string', fieldPath: 'event' });
    return {
      disposition: 'REJECTED',
      warnings,
      errors,
      fingerprint,
      rawByteEstimate,
    };
  }

  const contract = CHAT_SOCKET_CONTRACT_REGISTRY[eventValue as ChatSocketEventName];
  if (!contract || contract.direction !== 'CLIENT_TO_SERVER') {
    errors.push({ code: 'UNKNOWN_EVENT', message: `Unsupported inbound event: ${eventValue}`, fieldPath: 'event' });
    return {
      disposition: 'REJECTED',
      warnings,
      errors,
      fingerprint,
      rawByteEstimate,
    };
  }

  const meta = validateMeta(raw.meta, warnings, errors);
  if ((raw.meta && isRecord(raw.meta) && typeof raw.meta.protocol === 'string' ? raw.meta.protocol : CHAT_SOCKET_PROTOCOL_NAME) !== CHAT_SOCKET_PROTOCOL_NAME) {
    errors.push({ code: 'UNSUPPORTED_VERSION', message: `Unsupported protocol: ${String((raw.meta && isRecord(raw.meta) ? raw.meta.protocol : 'unknown'))}`, fieldPath: 'meta.protocol' });
  }
  if (meta.version !== CHAT_SOCKET_PROTOCOL_VERSION) {
    errors.push({ code: 'UNSUPPORTED_VERSION', message: `Unsupported version: ${meta.version}`, fieldPath: 'meta.version' });
  }

  let frame: ChatSocketInboundFrame | undefined;
  switch (eventValue as ChatSocketInboundEventName) {
    case 'chat:hello':
      frame = { event: 'chat:hello', meta, payload: validateHelloPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:resume':
      frame = { event: 'chat:resume', meta, payload: validateResumePayload(raw.payload, errors, warnings) };
      break;
    case 'chat:heartbeat':
      frame = { event: 'chat:heartbeat', meta, payload: validateHeartbeatPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:room:join':
      frame = { event: 'chat:room:join', meta, payload: validateRoomJoinPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:room:leave':
      frame = { event: 'chat:room:leave', meta, payload: validateRoomLeavePayload(raw.payload, errors, warnings) };
      break;
    case 'chat:message:send':
      frame = { event: 'chat:message:send', meta, payload: validateMessageSendPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:presence:set':
      frame = { event: 'chat:presence:set', meta, payload: validatePresenceSetPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:typing:set':
      frame = { event: 'chat:typing:set', meta, payload: validateTypingSetPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:cursor:update':
      frame = { event: 'chat:cursor:update', meta, payload: validateCursorUpdatePayload(raw.payload, errors, warnings) };
      break;
    case 'chat:cursor:clear':
      frame = { event: 'chat:cursor:clear', meta, payload: validateCursorClearPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:replay:request':
      frame = { event: 'chat:replay:request', meta, payload: validateReplayRequestPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:replay:cancel':
      frame = { event: 'chat:replay:cancel', meta, payload: validateReplayCancelPayload(raw.payload, errors, warnings) };
      break;
    case 'chat:metrics:subscribe':
      frame = { event: 'chat:metrics:subscribe', meta, payload: validateMetricsSubscribePayload(raw.payload, errors, warnings) };
      break;
    case 'chat:metrics:unsubscribe':
      frame = { event: 'chat:metrics:unsubscribe', meta, payload: validateMetricsUnsubscribePayload(raw.payload, errors, warnings) };
      break;
    case 'chat:ack':
      frame = { event: 'chat:ack', meta, payload: validateAckPayload(raw.payload, errors, warnings) };
      break;
    default:
      errors.push({ code: 'UNKNOWN_EVENT', message: `No validator registered for ${eventValue}`, fieldPath: 'event' });
      break;
  }

  if (errors.length > 0) {
    return {
      disposition: 'REJECTED',
      warnings,
      errors,
      fingerprint,
      rawByteEstimate,
    };
  }

  return {
    disposition: warnings.length > 0 ? 'ACCEPTED_WITH_WARNINGS' : 'ACCEPTED',
    frame,
    warnings,
    errors,
    fingerprint,
    rawByteEstimate,
  };
}

/**
 * --------------------------------------------------------------------------
 * Outbound frame builders
 * --------------------------------------------------------------------------
 */

export function buildSocketErrorFrame(input: {
  code: ChatSocketErrorCode;
  message: string;
  requestId?: string;
  event?: ChatSocketInboundEventName | ChatSocketOutboundEventName;
  fieldPath?: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
  meta?: Partial<ChatSocketEnvelopeMeta>;
}): ChatErrorFrame {
  return {
    event: 'chat:error',
    meta: defaultMeta({ ...input.meta, requestId: input.requestId }),
    payload: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
      event: input.event,
      fieldPath: input.fieldPath,
      details: input.details,
      retryable: input.retryable,
    },
  };
}

export function buildSocketWarningFrame(input: {
  warnings: readonly ChatSocketValidationWarning[];
  requestId?: string;
  event?: ChatSocketInboundEventName;
  meta?: Partial<ChatSocketEnvelopeMeta>;
}): ChatContractWarningFrame {
  return {
    event: 'chat:contract:warning',
    meta: defaultMeta({ ...input.meta, requestId: input.requestId }),
    payload: {
      warnings: input.warnings.map((warning) => ({
        code: warning.code,
        message: warning.message,
        fieldPath: warning.fieldPath,
      })),
      requestId: input.requestId,
      event: input.event,
    },
  };
}

export function buildServerAckFrame(input: {
  ackId?: string;
  accepted: boolean;
  requestId?: string;
  authoritativeEventId?: string;
  message?: string;
  meta?: Partial<ChatSocketEnvelopeMeta>;
}): ChatAckServerFrame {
  return {
    event: 'chat:ack:server',
    meta: defaultMeta({ ...input.meta, requestId: input.requestId }),
    payload: {
      ackId: input.ackId ?? randomUUID(),
      accepted: input.accepted,
      requestId: input.requestId,
      authoritativeEventId: input.authoritativeEventId,
      message: input.message,
    },
  };
}

export function buildHelloAcceptedFrame(input: {
  sessionId: string;
  roomId?: string;
  acceptedCapabilities: readonly ChatSocketCapability[];
  heartbeatIntervalMs: number;
  serverTimestampMs?: number;
  meta?: Partial<ChatSocketEnvelopeMeta>;
}): ChatHelloAcceptedFrame {
  return {
    event: 'chat:hello:accepted',
    meta: defaultMeta({ ...input.meta, sessionId: input.sessionId, roomId: input.roomId }),
    payload: {
      sessionId: input.sessionId,
      roomId: input.roomId,
      acceptedCapabilities: [...input.acceptedCapabilities],
      heartbeatIntervalMs: input.heartbeatIntervalMs,
      serverTimestampMs: input.serverTimestampMs ?? Date.now(),
    },
  };
}

export function buildResumeAcceptedFrame(input: {
  sessionId: string;
  roomId?: string;
  resumed: boolean;
  authoritativeSequence?: number;
  replayRecommended?: boolean;
  meta?: Partial<ChatSocketEnvelopeMeta>;
}): ChatResumeAcceptedFrame {
  return {
    event: 'chat:resume:accepted',
    meta: defaultMeta({ ...input.meta, sessionId: input.sessionId, roomId: input.roomId }),
    payload: {
      sessionId: input.sessionId,
      roomId: input.roomId,
      resumed: input.resumed,
      authoritativeSequence: input.authoritativeSequence,
      replayRecommended: input.replayRecommended,
    },
  };
}

export function buildHeartbeatAcceptedFrame(input: {
  echoClientTimestampMs: number;
  latencyEchoId?: string;
  meta?: Partial<ChatSocketEnvelopeMeta>;
}): ChatHeartbeatAcceptedFrame {
  return {
    event: 'chat:heartbeat:accepted',
    meta: defaultMeta(input.meta),
    payload: {
      serverTimestampMs: Date.now(),
      echoClientTimestampMs: input.echoClientTimestampMs,
      latencyEchoId: input.latencyEchoId,
    },
  };
}

export function buildMessageOutboundFrame(
  event: 'chat:message' | 'chat:message:redacted' | 'chat:helper' | 'chat:hater',
  payload: ChatMessageFanoutPayload,
  meta?: Partial<ChatSocketEnvelopeMeta>,
): ChatMessageOutboundFrame | ChatMessageRedactedOutboundFrame | ChatHelperOutboundFrame | ChatHaterOutboundFrame {
  return {
    event,
    meta: defaultMeta(meta),
    payload,
  };
}

export function buildPresenceOutboundFrame(payload: ChatPresenceFanoutPayload, meta?: Partial<ChatSocketEnvelopeMeta>): ChatPresenceOutboundFrame {
  return {
    event: 'chat:presence',
    meta: defaultMeta(meta),
    payload,
  };
}

export function buildTypingOutboundFrame(payload: ChatTypingFanoutPayload, meta?: Partial<ChatSocketEnvelopeMeta>): ChatTypingOutboundFrame {
  return {
    event: 'chat:typing',
    meta: defaultMeta(meta),
    payload,
  };
}

export function buildCursorOutboundFrame(payload: ChatCursorFanoutPayload, meta?: Partial<ChatSocketEnvelopeMeta>): ChatCursorOutboundFrame {
  return {
    event: 'chat:cursor',
    meta: defaultMeta(meta),
    payload,
  };
}

export function buildReplayOutboundFrame(
  event: 'chat:replay:chunk' | 'chat:replay:complete',
  payload: ChatReplayFanoutPayload,
  meta?: Partial<ChatSocketEnvelopeMeta>,
): ChatReplayChunkOutboundFrame | ChatReplayCompleteOutboundFrame {
  return {
    event,
    meta: defaultMeta(meta),
    payload,
  };
}

export function buildControlOutboundFrame(
  event: 'chat:control' | 'chat:replay:error' | 'chat:invasion' | 'chat:system',
  payload: ChatControlFanoutPayload,
  meta?: Partial<ChatSocketEnvelopeMeta>,
): ChatControlOutboundFrame | ChatReplayErrorOutboundFrame | ChatInvasionOutboundFrame | ChatSystemOutboundFrame {
  return {
    event,
    meta: defaultMeta(meta),
    payload,
  };
}

export function buildMetricsOutboundFrame(payload: ChatMetricsFanoutPayload, meta?: Partial<ChatSocketEnvelopeMeta>): ChatMetricsOutboundFrame {
  return {
    event: 'chat:metrics',
    meta: defaultMeta(meta),
    payload,
  };
}

/**
 * --------------------------------------------------------------------------
 * Serialization
 * --------------------------------------------------------------------------
 */

export function serializeSocketFrame(frame: ChatSocketInboundFrame | ChatSocketOutboundFrame): string {
  return JSON.stringify(frame);
}

export function deserializeSocketFrame(raw: string): ChatSocketRawFrame | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed as ChatSocketRawFrame : undefined;
  } catch {
    return undefined;
  }
}

export function estimateSerializedSocketFrameBytes(frame: ChatSocketInboundFrame | ChatSocketOutboundFrame): number {
  return Buffer.byteLength(serializeSocketFrame(frame), 'utf8');
}

/**
 * --------------------------------------------------------------------------
 * Frame conversion helpers from fanout payloads
 * --------------------------------------------------------------------------
 */

export function fromFanoutEvent(
  event: ChatFanoutEventName,
  payload:
    | ChatMessageFanoutPayload
    | ChatPresenceFanoutPayload
    | ChatTypingFanoutPayload
    | ChatCursorFanoutPayload
    | ChatReplayFanoutPayload
    | ChatControlFanoutPayload
    | ChatMetricsFanoutPayload
    | ChatAckServerPayload,
  meta?: Partial<ChatSocketEnvelopeMeta>,
): ChatSocketOutboundFrame {
  switch (event) {
    case 'chat:message':
    case 'chat:message:redacted':
    case 'chat:helper':
    case 'chat:hater':
      return buildMessageOutboundFrame(event, payload as ChatMessageFanoutPayload, meta);
    case 'chat:presence':
      return buildPresenceOutboundFrame(payload as ChatPresenceFanoutPayload, meta);
    case 'chat:typing':
      return buildTypingOutboundFrame(payload as ChatTypingFanoutPayload, meta);
    case 'chat:cursor':
      return buildCursorOutboundFrame(payload as ChatCursorFanoutPayload, meta);
    case 'chat:replay:chunk':
    case 'chat:replay:complete':
      return buildReplayOutboundFrame(event, payload as ChatReplayFanoutPayload, meta);
    case 'chat:replay:error':
    case 'chat:control':
    case 'chat:invasion':
    case 'chat:system':
      return buildControlOutboundFrame(event, payload as ChatControlFanoutPayload, meta);
    case 'chat:metrics':
      return buildMetricsOutboundFrame(payload as ChatMetricsFanoutPayload, meta);
    case 'chat:delivery:ack':
      return {
        event: 'chat:delivery:ack',
        meta: defaultMeta(meta),
        payload: payload as ChatAckServerPayload,
      };
    default:
      return buildSocketErrorFrame({
        code: 'INTERNAL_ERROR',
        message: `Unsupported fanout event: ${String(event)}`,
        meta,
      });
  }
}

/**
 * --------------------------------------------------------------------------
 * Convenience type guards
 * --------------------------------------------------------------------------
 */

export function isInboundSocketFrame(frame: ChatSocketInboundFrame | ChatSocketOutboundFrame): frame is ChatSocketInboundFrame {
  return CHAT_SOCKET_CONTRACT_REGISTRY[frame.event].direction === 'CLIENT_TO_SERVER';
}

export function isOutboundSocketFrame(frame: ChatSocketInboundFrame | ChatSocketOutboundFrame): frame is ChatSocketOutboundFrame {
  return CHAT_SOCKET_CONTRACT_REGISTRY[frame.event].direction === 'SERVER_TO_CLIENT';
}

export function isReplayRequestFrame(frame: ChatSocketInboundFrame): frame is ChatReplayRequestFrame {
  return frame.event === 'chat:replay:request';
}

export function isTypingFrame(frame: ChatSocketInboundFrame): frame is ChatTypingSetFrame {
  return frame.event === 'chat:typing:set';
}

export function isCursorFrame(frame: ChatSocketInboundFrame): frame is ChatCursorUpdateFrame | ChatCursorClearFrame {
  return frame.event === 'chat:cursor:update' || frame.event === 'chat:cursor:clear';
}

export function isMessageSendFrame(frame: ChatSocketInboundFrame): frame is ChatMessageSendFrame {
  return frame.event === 'chat:message:send';
}

/**
 * --------------------------------------------------------------------------
 * Export helpers for gateway / handlers
 * --------------------------------------------------------------------------
 */

export function getSocketContractDefinition(event: ChatSocketEventName): ChatSocketContractDefinition {
  return CHAT_SOCKET_CONTRACT_REGISTRY[event];
}

export function listInboundSocketContracts(): readonly ChatSocketContractDefinition[] {
  return Object.values(CHAT_SOCKET_CONTRACT_REGISTRY).filter((contract) => contract.direction === 'CLIENT_TO_SERVER');
}

export function listOutboundSocketContracts(): readonly ChatSocketContractDefinition[] {
  return Object.values(CHAT_SOCKET_CONTRACT_REGISTRY).filter((contract) => contract.direction === 'SERVER_TO_CLIENT');
}

export function createSocketValidationSummary(result: ChatSocketValidationResult): ChatSocketValidationSummary {
  return {
    fingerprint: result.fingerprint,
    disposition: result.disposition,
    warningCount: result.warnings.length,
    errorCount: result.errors.length,
    rawByteEstimate: result.rawByteEstimate,
    event: result.frame?.event,
    requestId: result.frame?.meta.requestId,
    roomId: result.frame?.meta.roomId ?? ('roomId' in (result.frame?.payload ?? {}) ? (result.frame?.payload as Record<string, unknown>).roomId as string | undefined : undefined),
    channelId: result.frame?.meta.channelId ?? ('channelId' in (result.frame?.payload ?? {}) ? (result.frame?.payload as Record<string, unknown>).channelId as ChatChannelId | undefined : undefined),
  };
}
