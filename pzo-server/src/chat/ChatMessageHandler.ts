
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT MESSAGE HANDLER
 * FILE: pzo-server/src/chat/ChatMessageHandler.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file extracts transport-side message handling out of ChatGateway so the
 * gateway stops acting like a hidden message brain.
 *
 * Transport doctrine
 * ------------------
 * - This file is a servant to backend chat authority.
 * - It may validate, normalize, throttle, and forward message intent.
 * - It may acknowledge transport status, dedupe submit attempts, and record
 *   transport-local audit state.
 * - It may NOT become transcript truth.
 * - It may NOT invent moderation truth.
 * - It may NOT persist room truth independently from the room/session layers.
 *
 * Lane boundaries
 * ---------------
 * - ChatConnectionAuth.ts decides who may connect and what restrictions apply.
 * - ChatSessionRegistry.ts decides which transport session is admitted and what
 *   room/session overlays exist.
 * - ChatRoomRegistry.ts remains live room/socket membership truth.
 * - backend/src/game/engine/chat/* remains message truth, moderation truth,
 *   replay truth, proof truth, and learning truth.
 *
 * This file exists because the donor websocket lane in pzo-server/src/ws is
 * intentionally thin and because the unified chat transport layer needs a
 * dedicated message ingress authority before events are handed to the backend.
 * ============================================================================
 */

import { createHash, randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';

import type {
  ChatConnectionRestrictionCode,
  ChatGatewayAuthContext,
} from './ChatConnectionAuth';
import type {
  ChatSessionAuthoritySnapshot,
  ChatSessionRegistry,
} from './ChatSessionRegistry';

// ============================================================================
// MARK: Fundamental aliases
// ============================================================================

export type ChatTransportMessageId = string;
export type ChatTransportEnvelopeId = string;
export type ChatTransportClientNonce = string;
export type ChatTransportCommandName = string;
export type ChatTransportReactionValue = string;
export type ChatTransportCursor = string;
export type ChatTransportChannelId = string;
export type ChatTransportRoomId = string;
export type ChatTransportMessageSource =
  | 'PLAYER'
  | 'SYSTEM'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'LIVEOPS'
  | 'SERVER';

export type ChatTransportSubmitKind =
  | 'SEND_MESSAGE'
  | 'SEND_BATCH'
  | 'SEND_COMMAND'
  | 'ACK_DELIVERY'
  | 'ACK_RENDER'
  | 'REACT_MESSAGE'
  | 'REMOVE_REACTION'
  | 'MARK_READ'
  | 'FETCH_REPLAY_WINDOW'
  | 'FETCH_MESSAGE_CONTEXT'
  | 'RESEND_PENDING'
  | 'SYNC_CLIENT_CURSOR';

export type ChatTransportMessageAckState =
  | 'QUEUED'
  | 'ACCEPTED'
  | 'FORWARDED'
  | 'DEFERRED'
  | 'REJECTED'
  | 'DROPPED'
  | 'RATE_LIMITED'
  | 'QUARANTINED';

export type ChatTransportRejectReason =
  | 'NOT_ADMITTED'
  | 'SESSION_NOT_FOUND'
  | 'ROOM_NOT_JOINED'
  | 'CHANNEL_NOT_ALLOWED'
  | 'MESSAGE_TOO_LONG'
  | 'EMPTY_MESSAGE'
  | 'TOO_MANY_ATTACHMENTS'
  | 'PAYLOAD_TOO_LARGE'
  | 'COMMAND_NOT_ALLOWED'
  | 'REACTION_NOT_ALLOWED'
  | 'ACK_NOT_ALLOWED'
  | 'REPLAY_NOT_ALLOWED'
  | 'DEDUPED'
  | 'RATE_LIMITED'
  | 'RESTRICTED'
  | 'UNSUPPORTED_KIND'
  | 'MALFORMED_PAYLOAD'
  | 'BACKEND_UNAVAILABLE'
  | 'SOCKET_MISMATCH'
  | 'CURSOR_REJECTED'
  | 'UNKNOWN';

export type ChatTransportDeliveryStage =
  | 'TRANSPORT_RECEIVED'
  | 'AUTH_VERIFIED'
  | 'SESSION_VERIFIED'
  | 'NORMALIZED'
  | 'FORWARDED_TO_BACKEND'
  | 'FANOUT_PREPARED'
  | 'CLIENT_ACKED'
  | 'CLIENT_RENDERED';

export type ChatTransportAttachmentKind =
  | 'IMAGE'
  | 'AUDIO'
  | 'STICKER'
  | 'PROOF'
  | 'RUN_SNAPSHOT'
  | 'REPLAY_LINK'
  | 'STRUCTURED_CARD'
  | 'OTHER';

export type ChatTransportReadScope =
  | 'ROOM'
  | 'CHANNEL'
  | 'MESSAGE'
  | 'THREAD'
  | 'WINDOW';

export type ChatTransportReplayScope =
  | 'AROUND_MESSAGE'
  | 'AROUND_SEQUENCE'
  | 'AROUND_TIMESTAMP'
  | 'LATEST'
  | 'WINDOW'
  | 'INVASION'
  | 'HELPER_INTERVENTION'
  | 'HATER_SCENE';

export type ChatTransportMessageFlag =
  | 'EPHEMERAL'
  | 'SHADOW_HINT'
  | 'PRIORITY'
  | 'SYSTEM_PIN'
  | 'INVASION_EVENT'
  | 'HELPER_EVENT'
  | 'HATER_EVENT'
  | 'DEALROOM_SENSITIVE'
  | 'NO_PUSH'
  | 'NO_LOCAL_ECHO';

export interface ChatTransportAttachment {
  readonly attachmentId: string;
  readonly kind: ChatTransportAttachmentKind;
  readonly sizeBytes: number;
  readonly mimeType: string | null;
  readonly uri: string | null;
  readonly hash: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationMs: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportCommandPayload {
  readonly command: ChatTransportCommandName;
  readonly args: readonly string[];
  readonly raw: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportReadReceiptPayload {
  readonly scope: ChatTransportReadScope;
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly messageId: ChatTransportMessageId | null;
  readonly sequence: number | null;
  readonly cursor: ChatTransportCursor | null;
  readonly timestamp: number;
}

export interface ChatTransportReplayFetchPayload {
  readonly scope: ChatTransportReplayScope;
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly centerMessageId: ChatTransportMessageId | null;
  readonly centerSequence: number | null;
  readonly centerTimestamp: number | null;
  readonly before: number;
  readonly after: number;
  readonly reason: string | null;
}

export interface ChatTransportReactionPayload {
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly targetMessageId: ChatTransportMessageId;
  readonly reaction: ChatTransportReactionValue;
  readonly remove: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportMessagePayload {
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly clientMessageId: string | null;
  readonly clientNonce: ChatTransportClientNonce | null;
  readonly body: string;
  readonly source: ChatTransportMessageSource;
  readonly replyToMessageId: ChatTransportMessageId | null;
  readonly threadId: string | null;
  readonly attachments: readonly ChatTransportAttachment[];
  readonly command: ChatTransportCommandPayload | null;
  readonly flags: readonly ChatTransportMessageFlag[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportMessageBatchPayload {
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly messages: readonly ChatTransportMessagePayload[];
  readonly batchId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportClientAckPayload {
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly messageId: ChatTransportMessageId;
  readonly stage: Extract<
    ChatTransportDeliveryStage,
    'CLIENT_ACKED' | 'CLIENT_RENDERED'
  >;
  readonly timestamp: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportCursorPayload {
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly cursor: ChatTransportCursor;
  readonly timestamp: number;
}

export interface ChatInboundTransportEnvelope {
  readonly envelopeId: ChatTransportEnvelopeId;
  readonly kind: ChatTransportSubmitKind;
  readonly issuedAt: number;
  readonly namespace: string;
  readonly roomId: ChatTransportRoomId | null;
  readonly channelId: ChatTransportChannelId | null;
  readonly clientNonce: ChatTransportClientNonce | null;
  readonly message: ChatTransportMessagePayload | null;
  readonly batch: ChatTransportMessageBatchPayload | null;
  readonly command: ChatTransportCommandPayload | null;
  readonly deliveryAck: ChatTransportClientAckPayload | null;
  readonly reaction: ChatTransportReactionPayload | null;
  readonly readReceipt: ChatTransportReadReceiptPayload | null;
  readonly replayFetch: ChatTransportReplayFetchPayload | null;
  readonly cursorSync: ChatTransportCursorPayload | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportBackendEnvelope {
  readonly backendEnvelopeId: string;
  readonly submittedAt: number;
  readonly namespace: string;
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly sessionId: string;
  readonly userId: string;
  readonly username: string;
  readonly authLevel: string;
  readonly transportSocketId: string;
  readonly kind: ChatTransportSubmitKind;
  readonly dedupeKey: string;
  readonly hash: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly restrictions: readonly ChatConnectionRestrictionCode[];
  readonly transportMetadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportBackendSubmissionResult {
  readonly accepted: boolean;
  readonly backendEnvelopeId: string;
  readonly authoritativeMessageId: string | null;
  readonly authoritativeSequence: number | null;
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly state: ChatTransportMessageAckState;
  readonly moderationState: string | null;
  readonly proofRef: string | null;
  readonly replayRef: string | null;
  readonly reason: string | null;
  readonly echoPayload: Readonly<Record<string, unknown>> | null;
  readonly extraMetadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportReplayWindowResult {
  readonly accepted: boolean;
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly scope: ChatTransportReplayScope;
  readonly resultId: string;
  readonly messages: readonly Readonly<Record<string, unknown>>[];
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
  readonly cursorBefore: string | null;
  readonly cursorAfter: string | null;
  readonly reason: string | null;
}

export interface ChatTransportFanoutEnvelope {
  readonly event: string;
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly targets: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ChatTransportMessageAck {
  readonly ackId: string;
  readonly envelopeId: ChatTransportEnvelopeId;
  readonly roomId: ChatTransportRoomId | null;
  readonly channelId: ChatTransportChannelId | null;
  readonly state: ChatTransportMessageAckState;
  readonly reason: ChatTransportRejectReason | null;
  readonly transportMessageId: ChatTransportMessageId | null;
  readonly authoritativeMessageId: string | null;
  readonly authoritativeSequence: number | null;
  readonly proofRef: string | null;
  readonly replayRef: string | null;
  readonly issuedAt: number;
  readonly retryAfterMs: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportMessageAuditRecord {
  readonly auditId: string;
  readonly recordedAt: number;
  readonly envelopeId: ChatTransportEnvelopeId;
  readonly dedupeKey: string;
  readonly namespace: string;
  readonly socketId: string;
  readonly sessionId: string | null;
  readonly userId: string | null;
  readonly username: string | null;
  readonly roomId: ChatTransportRoomId | null;
  readonly channelId: ChatTransportChannelId | null;
  readonly kind: ChatTransportSubmitKind;
  readonly accepted: boolean;
  readonly state: ChatTransportMessageAckState;
  readonly rejectReason: ChatTransportRejectReason | null;
  readonly hash: string;
  readonly payloadBytes: number;
  readonly restrictionCodes: readonly ChatConnectionRestrictionCode[];
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTransportPendingSubmission {
  readonly envelopeId: ChatTransportEnvelopeId;
  readonly dedupeKey: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly roomId: ChatTransportRoomId;
  readonly channelId: ChatTransportChannelId | null;
  readonly socketId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly nonce: ChatTransportClientNonce | null;
  readonly hash: string;
}

export interface ChatTransportSubmitWindow {
  readonly startedAt: number;
  readonly count: number;
  readonly bytes: number;
  readonly distinctNonces: number;
}

export interface ChatTransportMessageHandlerMetricsSnapshot {
  readonly totalReceived: number;
  readonly totalAccepted: number;
  readonly totalRejected: number;
  readonly totalRateLimited: number;
  readonly totalDeduped: number;
  readonly totalForwarded: number;
  readonly totalReplayFetches: number;
  readonly totalReactionEvents: number;
  readonly totalReadReceipts: number;
  readonly totalClientAcks: number;
  readonly totalCursorSyncs: number;
  readonly inflightSubmissions: number;
  readonly auditedRecords: number;
}

export interface ChatTransportMessageHandlerConfig {
  readonly maxBodyLength: number;
  readonly maxBatchMessages: number;
  readonly maxAttachmentsPerMessage: number;
  readonly maxAttachmentBytes: number;
  readonly maxEnvelopeBytes: number;
  readonly maxMessagesPerWindow: number;
  readonly maxBytesPerWindow: number;
  readonly submitWindowMs: number;
  readonly inflightTtlMs: number;
  readonly dedupeTtlMs: number;
  readonly auditLimit: number;
  readonly allowReactions: boolean;
  readonly allowReplayFetch: boolean;
  readonly allowReadReceipts: boolean;
  readonly allowClientRenderAck: boolean;
  readonly allowCommandSubmits: boolean;
  readonly allowCursorSyncThroughMessageHandler: boolean;
  readonly dropUnknownKinds: boolean;
  readonly roomJoinRequiredForReplay: boolean;
  readonly roomJoinRequiredForPresenceSensitiveReadMarks: boolean;
}

export interface ChatTransportMessageHandlerDependencies {
  readonly sessionRegistry: ChatSessionRegistry;
  readonly backend: ChatTransportBackendPort;
  readonly fanout: ChatTransportFanoutPort;
  readonly metrics?: ChatTransportMessageMetricsPort;
  readonly clock?: () => number;
  readonly logger?: ChatTransportMessageLogger;
}

export interface ChatTransportMessageLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface ChatTransportBackendPort {
  submitTransportEnvelope(
    envelope: ChatTransportBackendEnvelope,
  ): Promise<ChatTransportBackendSubmissionResult>;
  fetchReplayWindow(
    envelope: ChatTransportBackendEnvelope,
  ): Promise<ChatTransportReplayWindowResult>;
}

export interface ChatTransportFanoutPort {
  fanout(envelope: ChatTransportFanoutEnvelope): Promise<void> | void;
}

export interface ChatTransportMessageMetricsPort {
  recordAccepted(kind: ChatTransportSubmitKind, roomId: string | null): void;
  recordRejected(
    kind: ChatTransportSubmitKind,
    reason: ChatTransportRejectReason,
    roomId: string | null,
  ): void;
  recordForwarded(kind: ChatTransportSubmitKind, roomId: string | null): void;
  recordRateLimited(kind: ChatTransportSubmitKind, roomId: string | null): void;
  recordDedupe(kind: ChatTransportSubmitKind, roomId: string | null): void;
}

export interface ChatSocketMessageAttachmentOptions {
  readonly socket: Socket;
  readonly auth: ChatGatewayAuthContext;
  readonly transportSocketId: string;
}

export interface ChatSocketMessageHandlerBinding {
  detach(): void;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_CHAT_MESSAGE_HANDLER_CONFIG: ChatTransportMessageHandlerConfig = {
  maxBodyLength: 6000,
  maxBatchMessages: 8,
  maxAttachmentsPerMessage: 4,
  maxAttachmentBytes: 5_000_000,
  maxEnvelopeBytes: 64_000,
  maxMessagesPerWindow: 12,
  maxBytesPerWindow: 48_000,
  submitWindowMs: 12_000,
  inflightTtlMs: 90_000,
  dedupeTtlMs: 3 * 60_000,
  auditLimit: 2_500,
  allowReactions: true,
  allowReplayFetch: true,
  allowReadReceipts: true,
  allowClientRenderAck: true,
  allowCommandSubmits: true,
  allowCursorSyncThroughMessageHandler: false,
  dropUnknownKinds: true,
  roomJoinRequiredForReplay: true,
  roomJoinRequiredForPresenceSensitiveReadMarks: true,
};

const NOOP_LOGGER: ChatTransportMessageLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// ============================================================================
// MARK: Utility guards
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableJson(objectValue[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toReadonlyMetadata(
  value: unknown,
): Readonly<Record<string, unknown>> {
  return isRecord(value) ? Object.freeze({ ...value }) : Object.freeze({});
}

function toStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  const normalized = value
    .map((item) => asString(item))
    .filter((item): item is string => !!item);

  return Object.freeze(normalized);
}

// ============================================================================
// MARK: Message normalization
// ============================================================================

function normalizeAttachment(input: unknown): ChatTransportAttachment | null {
  if (!isRecord(input)) {
    return null;
  }

  const attachmentId = asString(input.attachmentId) ?? randomUUID();
  const kind = asString(input.kind) as ChatTransportAttachmentKind | null;
  const sizeBytes = asNumber(input.sizeBytes) ?? 0;
  const mimeType = asString(input.mimeType);
  const uri = asString(input.uri);
  const hash = asString(input.hash);
  const width = asNumber(input.width);
  const height = asNumber(input.height);
  const durationMs = asNumber(input.durationMs);

  if (!kind) {
    return null;
  }

  return Object.freeze({
    attachmentId,
    kind,
    sizeBytes: Math.max(0, sizeBytes),
    mimeType,
    uri,
    hash,
    width,
    height,
    durationMs,
    metadata: toReadonlyMetadata(input.metadata),
  });
}

function normalizeCommandPayload(input: unknown): ChatTransportCommandPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const command = asString(input.command);
  const raw = asString(input.raw) ?? '';
  if (!command) {
    return null;
  }

  return Object.freeze({
    command,
    args: Object.freeze(
      Array.isArray(input.args)
        ? input.args
            .map((item) => asString(item))
            .filter((item): item is string => !!item)
        : [],
    ),
    raw,
    metadata: toReadonlyMetadata(input.metadata),
  });
}

function normalizeMessagePayload(input: unknown): ChatTransportMessagePayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  const body = typeof input.body === 'string' ? input.body : '';
  const source = (asString(input.source) ?? 'PLAYER') as ChatTransportMessageSource;
  if (!roomId) {
    return null;
  }

  const attachments = Array.isArray(input.attachments)
    ? input.attachments
        .map((item) => normalizeAttachment(item))
        .filter((item): item is ChatTransportAttachment => !!item)
    : [];

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    clientMessageId: asString(input.clientMessageId),
    clientNonce: asString(input.clientNonce),
    body,
    source,
    replyToMessageId: asString(input.replyToMessageId),
    threadId: asString(input.threadId),
    attachments: Object.freeze(attachments),
    command: normalizeCommandPayload(input.command),
    flags: toStringArray(input.flags) as readonly ChatTransportMessageFlag[],
    metadata: toReadonlyMetadata(input.metadata),
  });
}

function normalizeBatchPayload(input: unknown): ChatTransportMessageBatchPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  if (!roomId) {
    return null;
  }

  const messages = Array.isArray(input.messages)
    ? input.messages
        .map((item) => normalizeMessagePayload(item))
        .filter((item): item is ChatTransportMessagePayload => !!item)
    : [];

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    messages: Object.freeze(messages),
    batchId: asString(input.batchId),
    metadata: toReadonlyMetadata(input.metadata),
  });
}

function normalizeDeliveryAck(input: unknown): ChatTransportClientAckPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  const messageId = asString(input.messageId);
  const stage = asString(input.stage) as
    | Extract<ChatTransportDeliveryStage, 'CLIENT_ACKED' | 'CLIENT_RENDERED'>
    | null;

  if (!roomId || !messageId || !stage) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    messageId,
    stage,
    timestamp: asNumber(input.timestamp) ?? Date.now(),
    metadata: toReadonlyMetadata(input.metadata),
  });
}

function normalizeReactionPayload(input: unknown): ChatTransportReactionPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  const targetMessageId = asString(input.targetMessageId);
  const reaction = asString(input.reaction);

  if (!roomId || !targetMessageId || !reaction) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    targetMessageId,
    reaction,
    remove: asBoolean(input.remove) ?? false,
    metadata: toReadonlyMetadata(input.metadata),
  });
}

function normalizeReadReceiptPayload(input: unknown): ChatTransportReadReceiptPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const scope = asString(input.scope) as ChatTransportReadScope | null;
  const roomId = asString(input.roomId);
  if (!scope || !roomId) {
    return null;
  }

  return Object.freeze({
    scope,
    roomId,
    channelId: asString(input.channelId),
    messageId: asString(input.messageId),
    sequence: asNumber(input.sequence),
    cursor: asString(input.cursor),
    timestamp: asNumber(input.timestamp) ?? Date.now(),
  });
}

function normalizeReplayFetchPayload(input: unknown): ChatTransportReplayFetchPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const scope = asString(input.scope) as ChatTransportReplayScope | null;
  const roomId = asString(input.roomId);
  if (!scope || !roomId) {
    return null;
  }

  return Object.freeze({
    scope,
    roomId,
    channelId: asString(input.channelId),
    centerMessageId: asString(input.centerMessageId),
    centerSequence: asNumber(input.centerSequence),
    centerTimestamp: asNumber(input.centerTimestamp),
    before: clamp(asNumber(input.before) ?? 25, 0, 200),
    after: clamp(asNumber(input.after) ?? 25, 0, 200),
    reason: asString(input.reason),
  });
}

function normalizeCursorPayload(input: unknown): ChatTransportCursorPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  const cursor = asString(input.cursor);
  if (!roomId || !cursor) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    cursor,
    timestamp: asNumber(input.timestamp) ?? Date.now(),
  });
}

function normalizeInboundEnvelope(
  kind: ChatTransportSubmitKind,
  payload: unknown,
  namespace: string,
): ChatInboundTransportEnvelope {
  const payloadRecord = isRecord(payload) ? payload : {};

  const message = normalizeMessagePayload(payloadRecord.message ?? payloadRecord);
  const batch = normalizeBatchPayload(payloadRecord.batch ?? payloadRecord);
  const command = normalizeCommandPayload(payloadRecord.command ?? payloadRecord);
  const deliveryAck = normalizeDeliveryAck(payloadRecord.deliveryAck ?? payloadRecord);
  const reaction = normalizeReactionPayload(payloadRecord.reaction ?? payloadRecord);
  const readReceipt = normalizeReadReceiptPayload(payloadRecord.readReceipt ?? payloadRecord);
  const replayFetch = normalizeReplayFetchPayload(payloadRecord.replayFetch ?? payloadRecord);
  const cursorSync = normalizeCursorPayload(payloadRecord.cursorSync ?? payloadRecord);

  const roomId =
    asString(payloadRecord.roomId) ??
    message?.roomId ??
    batch?.roomId ??
    reaction?.roomId ??
    readReceipt?.roomId ??
    replayFetch?.roomId ??
    cursorSync?.roomId ??
    deliveryAck?.roomId ??
    null;

  const channelId =
    asString(payloadRecord.channelId) ??
    message?.channelId ??
    batch?.channelId ??
    reaction?.channelId ??
    readReceipt?.channelId ??
    replayFetch?.channelId ??
    cursorSync?.channelId ??
    deliveryAck?.channelId ??
    null;

  return Object.freeze({
    envelopeId: asString(payloadRecord.envelopeId) ?? randomUUID(),
    kind,
    issuedAt: asNumber(payloadRecord.issuedAt) ?? Date.now(),
    namespace,
    roomId,
    channelId,
    clientNonce:
      asString(payloadRecord.clientNonce) ??
      message?.clientNonce ??
      null,
    message,
    batch,
    command,
    deliveryAck,
    reaction,
    readReceipt,
    replayFetch,
    cursorSync,
    metadata: toReadonlyMetadata(payloadRecord.metadata),
  });
}

// ============================================================================
// MARK: Main handler
// ============================================================================

export class ChatMessageHandler {
  private readonly config: ChatTransportMessageHandlerConfig;
  private readonly sessionRegistry: ChatSessionRegistry;
  private readonly backend: ChatTransportBackendPort;
  private readonly fanout: ChatTransportFanoutPort;
  private readonly metricsPort?: ChatTransportMessageMetricsPort;
  private readonly logger: ChatTransportMessageLogger;
  private readonly now: () => number;

  private readonly inflightByEnvelopeId = new Map<string, ChatTransportPendingSubmission>();
  private readonly inflightByDedupeKey = new Map<string, ChatTransportPendingSubmission>();
  private readonly seenDedupeKeyExpiry = new Map<string, number>();
  private readonly submitWindowsBySessionId = new Map<string, ChatTransportSubmitWindow>();
  private readonly auditTrail: ChatTransportMessageAuditRecord[] = [];

  private totalReceived = 0;
  private totalAccepted = 0;
  private totalRejected = 0;
  private totalRateLimited = 0;
  private totalDeduped = 0;
  private totalForwarded = 0;
  private totalReplayFetches = 0;
  private totalReactionEvents = 0;
  private totalReadReceipts = 0;
  private totalClientAcks = 0;
  private totalCursorSyncs = 0;

  public constructor(
    deps: ChatTransportMessageHandlerDependencies,
    config: Partial<ChatTransportMessageHandlerConfig> = {},
  ) {
    this.config = Object.freeze({
      ...DEFAULT_CHAT_MESSAGE_HANDLER_CONFIG,
      ...config,
    });
    this.sessionRegistry = deps.sessionRegistry;
    this.backend = deps.backend;
    this.fanout = deps.fanout;
    this.metricsPort = deps.metrics;
    this.logger = deps.logger ?? NOOP_LOGGER;
    this.now = deps.clock ?? (() => Date.now());
  }

  // ==========================================================================
  // MARK: Socket binding
  // ==========================================================================

  public attachSocket(
    options: ChatSocketMessageAttachmentOptions,
  ): ChatSocketMessageHandlerBinding {
    const { socket, auth } = options;

    const onSendMessage = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'SEND_MESSAGE',
        payload,
      );
      ack?.(result);
    };

    const onSendBatch = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'SEND_BATCH',
        payload,
      );
      ack?.(result);
    };

    const onSendCommand = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'SEND_COMMAND',
        payload,
      );
      ack?.(result);
    };

    const onDeliveryAck = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'ACK_DELIVERY',
        payload,
      );
      ack?.(result);
    };

    const onReact = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'REACT_MESSAGE',
        payload,
      );
      ack?.(result);
    };

    const onRemoveReaction = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'REMOVE_REACTION',
        payload,
      );
      ack?.(result);
    };

    const onMarkRead = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'MARK_READ',
        payload,
      );
      ack?.(result);
    };

    const onReplayFetch = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'FETCH_REPLAY_WINDOW',
        payload,
      );
      ack?.(result);
    };

    const onResendPending = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'RESEND_PENDING',
        payload,
      );
      ack?.(result);
    };

    const onCursorSync = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'SYNC_CLIENT_CURSOR',
        payload,
      );
      ack?.(result);
    };

    socket.on('chat:message:send', onSendMessage);
    socket.on('chat:message:send-batch', onSendBatch);
    socket.on('chat:command:send', onSendCommand);
    socket.on('chat:message:ack', onDeliveryAck);
    socket.on('chat:message:react', onReact);
    socket.on('chat:message:unreact', onRemoveReaction);
    socket.on('chat:message:mark-read', onMarkRead);
    socket.on('chat:replay:fetch', onReplayFetch);
    socket.on('chat:message:resend-pending', onResendPending);
    socket.on('chat:message:cursor-sync', onCursorSync);

    return {
      detach: () => {
        socket.off('chat:message:send', onSendMessage);
        socket.off('chat:message:send-batch', onSendBatch);
        socket.off('chat:command:send', onSendCommand);
        socket.off('chat:message:ack', onDeliveryAck);
        socket.off('chat:message:react', onReact);
        socket.off('chat:message:unreact', onRemoveReaction);
        socket.off('chat:message:mark-read', onMarkRead);
        socket.off('chat:replay:fetch', onReplayFetch);
        socket.off('chat:message:resend-pending', onResendPending);
        socket.off('chat:message:cursor-sync', onCursorSync);
      },
    };
  }

  // ==========================================================================
  // MARK: Public event ingress
  // ==========================================================================

  public async handleTransportEvent(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    kind: ChatTransportSubmitKind,
    payload: unknown,
  ): Promise<ChatTransportMessageAck | ChatTransportReplayWindowResult> {
    const now = this.now();
    this.prune(now);
    this.totalReceived += 1;

    const envelope = normalizeInboundEnvelope(kind, payload, auth.namespace);
    const snapshot = this.resolveSessionSnapshot(auth);
    if (!snapshot) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'SESSION_NOT_FOUND',
        'No admitted transport session matched the auth context.',
      );
    }

    if (!snapshot.socketIds.includes(transportSocketId)) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'SOCKET_MISMATCH',
        'Transport socket does not own this admitted session.',
        snapshot,
      );
    }

    const restrictionReason = this.checkRestrictions(auth, envelope, snapshot);
    if (restrictionReason) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        restrictionReason,
        `Transport restriction blocked ${kind}.`,
        snapshot,
      );
    }

    switch (kind) {
      case 'SEND_MESSAGE':
        return this.handleMessageSubmit(auth, transportSocketId, envelope, snapshot);
      case 'SEND_BATCH':
        return this.handleBatchSubmit(auth, transportSocketId, envelope, snapshot);
      case 'SEND_COMMAND':
        return this.handleCommandSubmit(auth, transportSocketId, envelope, snapshot);
      case 'ACK_DELIVERY':
        return this.handleClientAck(auth, transportSocketId, envelope, snapshot);
      case 'REACT_MESSAGE':
      case 'REMOVE_REACTION':
        return this.handleReaction(auth, transportSocketId, envelope, snapshot);
      case 'MARK_READ':
        return this.handleReadReceipt(auth, transportSocketId, envelope, snapshot);
      case 'FETCH_REPLAY_WINDOW':
        return this.handleReplayFetch(auth, transportSocketId, envelope, snapshot);
      case 'RESEND_PENDING':
        return this.handleResendPending(auth, transportSocketId, envelope, snapshot);
      case 'SYNC_CLIENT_CURSOR':
        return this.handleCursorSync(auth, transportSocketId, envelope, snapshot);
      default:
        return this.rejectEnvelope(
          auth,
          transportSocketId,
          envelope,
          'UNSUPPORTED_KIND',
          `Unsupported message handler kind: ${kind}.`,
          snapshot,
        );
    }
  }

  // ==========================================================================
  // MARK: Core submit flows
  // ==========================================================================

  private async handleMessageSubmit(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    const payload = envelope.message;
    if (!payload) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'SEND_MESSAGE requires a normalized message payload.',
        snapshot,
      );
    }

    const validation = this.validateMessagePayload(payload);
    if (!validation.valid) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        validation.reason,
        validation.message,
        snapshot,
      );
    }

    const rateResult = this.checkRateWindow(snapshot.sessionId, payload);
    if (!rateResult.allowed) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'RATE_LIMITED',
        'Transport submit window blocked the message.',
        snapshot,
        {
          retryAfterMs: rateResult.retryAfterMs,
        },
      );
    }

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, payload);
    if (this.isDuplicate(dedupeKey, envelope.envelopeId)) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'DEDUPED',
        'Transport dedupe rejected a repeated message submit.',
        snapshot,
      );
    }

    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'MESSAGE',
        roomId: payload.roomId,
        channelId: payload.channelId,
        payload: {
          message: payload,
          metadata: envelope.metadata,
        },
      },
    );

    const inflight = this.createPendingSubmission(
      envelope,
      dedupeKey,
      backendEnvelope.hash,
      snapshot,
      transportSocketId,
      payload.roomId,
      payload.channelId,
    );

    try {
      const submissionResult = await this.backend.submitTransportEnvelope(backendEnvelope);
      this.totalForwarded += 1;
      this.totalAccepted += submissionResult.accepted ? 1 : 0;
      this.totalRejected += submissionResult.accepted ? 0 : 1;
      this.metricsPort?.recordForwarded(envelope.kind, payload.roomId);

      if (submissionResult.accepted && submissionResult.echoPayload) {
        await this.fanoutEchoPayload(payload.roomId, payload.channelId, submissionResult.echoPayload);
      }

      this.sealDedupeKey(dedupeKey);
      this.clearPendingSubmission(inflight.envelopeId, inflight.dedupeKey);

      const ack = this.buildAcceptedAck(
        envelope,
        payload.roomId,
        payload.channelId,
        submissionResult,
      );
      this.recordAudit(auth, transportSocketId, envelope, snapshot, ack, backendEnvelope.hash, dedupeKey);
      return ack;
    } catch (error) {
      this.clearPendingSubmission(inflight.envelopeId, inflight.dedupeKey);
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend message submission failed.',
        snapshot,
      );
    }
  }

  private async handleBatchSubmit(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    const batch = envelope.batch;
    if (!batch) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'SEND_BATCH requires a normalized batch payload.',
        snapshot,
      );
    }

    if (batch.messages.length === 0) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'EMPTY_MESSAGE',
        'Batch submit contained no normalized messages.',
        snapshot,
      );
    }

    if (batch.messages.length > this.config.maxBatchMessages) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'PAYLOAD_TOO_LARGE',
        'Batch submit exceeded the allowed message count.',
        snapshot,
      );
    }

    let totalBytes = 0;
    for (const message of batch.messages) {
      const validation = this.validateMessagePayload(message);
      if (!validation.valid) {
        return this.rejectEnvelope(
          auth,
          transportSocketId,
          envelope,
          validation.reason,
          validation.message,
          snapshot,
        );
      }
      totalBytes += Buffer.byteLength(message.body, 'utf8');
    }

    const rateResult = this.checkBatchRateWindow(snapshot.sessionId, totalBytes, batch.messages.length);
    if (!rateResult.allowed) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'RATE_LIMITED',
        'Transport submit window blocked the batch.',
        snapshot,
        {
          retryAfterMs: rateResult.retryAfterMs,
        },
      );
    }

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, batch);
    if (this.isDuplicate(dedupeKey, envelope.envelopeId)) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'DEDUPED',
        'Transport dedupe rejected a repeated batch submit.',
        snapshot,
      );
    }

    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'MESSAGE_BATCH',
        roomId: batch.roomId,
        channelId: batch.channelId,
        payload: {
          batch,
          metadata: envelope.metadata,
        },
      },
    );

    const inflight = this.createPendingSubmission(
      envelope,
      dedupeKey,
      backendEnvelope.hash,
      snapshot,
      transportSocketId,
      batch.roomId,
      batch.channelId,
    );

    try {
      const submissionResult = await this.backend.submitTransportEnvelope(backendEnvelope);
      this.totalForwarded += 1;
      this.totalAccepted += submissionResult.accepted ? 1 : 0;
      this.totalRejected += submissionResult.accepted ? 0 : 1;
      this.metricsPort?.recordForwarded(envelope.kind, batch.roomId);

      if (submissionResult.accepted && submissionResult.echoPayload) {
        await this.fanoutEchoPayload(batch.roomId, batch.channelId, submissionResult.echoPayload);
      }

      this.sealDedupeKey(dedupeKey);
      this.clearPendingSubmission(inflight.envelopeId, inflight.dedupeKey);

      const ack = this.buildAcceptedAck(
        envelope,
        batch.roomId,
        batch.channelId,
        submissionResult,
      );
      this.recordAudit(auth, transportSocketId, envelope, snapshot, ack, backendEnvelope.hash, dedupeKey);
      return ack;
    } catch (error) {
      this.clearPendingSubmission(inflight.envelopeId, inflight.dedupeKey);
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend batch submission failed.',
        snapshot,
      );
    }
  }

  private async handleCommandSubmit(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    if (!this.config.allowCommandSubmits) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'COMMAND_NOT_ALLOWED',
        'Command submits are disabled in transport config.',
        snapshot,
      );
    }

    const command = envelope.command ?? envelope.message?.command;
    const roomId = envelope.roomId ?? envelope.message?.roomId ?? null;
    const channelId = envelope.channelId ?? envelope.message?.channelId ?? null;

    if (!command || !roomId) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'SEND_COMMAND requires a normalized command payload and roomId.',
        snapshot,
      );
    }

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, command);
    if (this.isDuplicate(dedupeKey, envelope.envelopeId)) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'DEDUPED',
        'Transport dedupe rejected a repeated command submit.',
        snapshot,
      );
    }

    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'COMMAND',
        roomId,
        channelId,
        payload: {
          command,
          metadata: envelope.metadata,
        },
      },
    );

    const inflight = this.createPendingSubmission(
      envelope,
      dedupeKey,
      backendEnvelope.hash,
      snapshot,
      transportSocketId,
      roomId,
      channelId,
    );

    try {
      const submissionResult = await this.backend.submitTransportEnvelope(backendEnvelope);
      this.totalForwarded += 1;
      this.totalAccepted += submissionResult.accepted ? 1 : 0;
      this.totalRejected += submissionResult.accepted ? 0 : 1;
      this.metricsPort?.recordForwarded(envelope.kind, roomId);

      if (submissionResult.accepted && submissionResult.echoPayload) {
        await this.fanoutEchoPayload(roomId, channelId, submissionResult.echoPayload);
      }

      this.sealDedupeKey(dedupeKey);
      this.clearPendingSubmission(inflight.envelopeId, inflight.dedupeKey);

      const ack = this.buildAcceptedAck(
        envelope,
        roomId,
        channelId,
        submissionResult,
      );
      this.recordAudit(auth, transportSocketId, envelope, snapshot, ack, backendEnvelope.hash, dedupeKey);
      return ack;
    } catch (error) {
      this.clearPendingSubmission(inflight.envelopeId, inflight.dedupeKey);
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend command submission failed.',
        snapshot,
      );
    }
  }

  // ==========================================================================
  // MARK: Secondary transport flows
  // ==========================================================================

  private async handleClientAck(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    const payload = envelope.deliveryAck;
    if (!payload) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'ACK_DELIVERY requires a normalized delivery-ack payload.',
        snapshot,
      );
    }

    if (payload.stage === 'CLIENT_RENDERED' && !this.config.allowClientRenderAck) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'ACK_NOT_ALLOWED',
        'Client rendered ack is disabled in transport config.',
        snapshot,
      );
    }

    this.totalClientAcks += 1;

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, payload);
    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'CLIENT_ACK',
        roomId: payload.roomId,
        channelId: payload.channelId,
        payload: {
          deliveryAck: payload,
        },
      },
    );

    try {
      const submissionResult = await this.backend.submitTransportEnvelope(backendEnvelope);
      this.totalForwarded += 1;
      this.metricsPort?.recordForwarded(envelope.kind, payload.roomId);
      const ack = this.buildAcceptedAck(
        envelope,
        payload.roomId,
        payload.channelId,
        submissionResult,
      );
      this.recordAudit(auth, transportSocketId, envelope, snapshot, ack, backendEnvelope.hash, dedupeKey);
      return ack;
    } catch (error) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend client ack submission failed.',
        snapshot,
      );
    }
  }

  private async handleReaction(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    if (!this.config.allowReactions) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'REACTION_NOT_ALLOWED',
        'Reactions are disabled in transport config.',
        snapshot,
      );
    }

    const payload = envelope.reaction;
    if (!payload) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'Reaction event requires a normalized reaction payload.',
        snapshot,
      );
    }

    this.totalReactionEvents += 1;

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, payload);
    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'REACTION',
        roomId: payload.roomId,
        channelId: payload.channelId,
        payload: {
          reaction: payload,
          remove: envelope.kind === 'REMOVE_REACTION' || payload.remove,
        },
      },
    );

    try {
      const submissionResult = await this.backend.submitTransportEnvelope(backendEnvelope);
      this.totalForwarded += 1;
      this.metricsPort?.recordForwarded(envelope.kind, payload.roomId);

      if (submissionResult.accepted && submissionResult.echoPayload) {
        await this.fanoutEchoPayload(payload.roomId, payload.channelId, submissionResult.echoPayload);
      }

      const ack = this.buildAcceptedAck(
        envelope,
        payload.roomId,
        payload.channelId,
        submissionResult,
      );
      this.recordAudit(auth, transportSocketId, envelope, snapshot, ack, backendEnvelope.hash, dedupeKey);
      return ack;
    } catch (error) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend reaction submission failed.',
        snapshot,
      );
    }
  }

  private async handleReadReceipt(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    if (!this.config.allowReadReceipts) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'ACK_NOT_ALLOWED',
        'Read receipts are disabled in transport config.',
        snapshot,
      );
    }

    const payload = envelope.readReceipt;
    if (!payload) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'MARK_READ requires a normalized read-receipt payload.',
        snapshot,
      );
    }

    if (
      this.config.roomJoinRequiredForPresenceSensitiveReadMarks &&
      !this.isRoomJoined(snapshot, payload.roomId)
    ) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'ROOM_NOT_JOINED',
        'Read receipt rejected because the session is not joined to the room.',
        snapshot,
      );
    }

    this.totalReadReceipts += 1;

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, payload);
    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'READ_RECEIPT',
        roomId: payload.roomId,
        channelId: payload.channelId,
        payload: {
          readReceipt: payload,
        },
      },
    );

    try {
      const submissionResult = await this.backend.submitTransportEnvelope(backendEnvelope);
      this.totalForwarded += 1;
      this.metricsPort?.recordForwarded(envelope.kind, payload.roomId);
      const ack = this.buildAcceptedAck(
        envelope,
        payload.roomId,
        payload.channelId,
        submissionResult,
      );
      this.recordAudit(auth, transportSocketId, envelope, snapshot, ack, backendEnvelope.hash, dedupeKey);
      return ack;
    } catch (error) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend read receipt submission failed.',
        snapshot,
      );
    }
  }

  private async handleReplayFetch(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportReplayWindowResult> {
    if (!this.config.allowReplayFetch) {
      return {
        accepted: false,
        roomId: envelope.roomId ?? 'unknown',
        channelId: envelope.channelId ?? null,
        scope: envelope.replayFetch?.scope ?? 'WINDOW',
        resultId: randomUUID(),
        messages: Object.freeze([]),
        hasMoreBefore: false,
        hasMoreAfter: false,
        cursorBefore: null,
        cursorAfter: null,
        reason: 'Replay fetch is disabled in transport config.',
      };
    }

    const payload = envelope.replayFetch;
    if (!payload) {
      return {
        accepted: false,
        roomId: envelope.roomId ?? 'unknown',
        channelId: envelope.channelId ?? null,
        scope: 'WINDOW',
        resultId: randomUUID(),
        messages: Object.freeze([]),
        hasMoreBefore: false,
        hasMoreAfter: false,
        cursorBefore: null,
        cursorAfter: null,
        reason: 'Replay fetch requires a normalized replay payload.',
      };
    }

    if (this.config.roomJoinRequiredForReplay && !this.isRoomJoined(snapshot, payload.roomId)) {
      return {
        accepted: false,
        roomId: payload.roomId,
        channelId: payload.channelId,
        scope: payload.scope,
        resultId: randomUUID(),
        messages: Object.freeze([]),
        hasMoreBefore: false,
        hasMoreAfter: false,
        cursorBefore: null,
        cursorAfter: null,
        reason: 'Replay fetch rejected because the session is not joined to the room.',
      };
    }

    this.totalReplayFetches += 1;

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, payload);
    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'REPLAY_FETCH',
        roomId: payload.roomId,
        channelId: payload.channelId,
        payload: {
          replayFetch: payload,
        },
      },
    );

    try {
      const result = await this.backend.fetchReplayWindow(backendEnvelope);
      this.metricsPort?.recordForwarded(envelope.kind, payload.roomId);
      this.recordReplayAudit(auth, transportSocketId, envelope, snapshot, backendEnvelope.hash, dedupeKey, result);
      return result;
    } catch (error) {
      return {
        accepted: false,
        roomId: payload.roomId,
        channelId: payload.channelId,
        scope: payload.scope,
        resultId: randomUUID(),
        messages: Object.freeze([]),
        hasMoreBefore: false,
        hasMoreAfter: false,
        cursorBefore: null,
        cursorAfter: null,
        reason: error instanceof Error ? error.message : 'Replay fetch failed.',
      };
    }
  }

  private async handleResendPending(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    const nonce = envelope.clientNonce;
    if (!nonce) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'RESEND_PENDING requires a clientNonce or message nonce.',
        snapshot,
      );
    }

    const pending = Array.from(this.inflightByEnvelopeId.values()).find((item) => {
      return item.sessionId === snapshot.sessionId && item.nonce === nonce;
    });

    if (!pending) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'UNKNOWN',
        'No inflight submission matched the requested resend nonce.',
        snapshot,
      );
    }

    return Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId: pending.roomId,
      channelId: pending.channelId,
      state: 'QUEUED',
      reason: null,
      transportMessageId: pending.envelopeId,
      authoritativeMessageId: null,
      authoritativeSequence: null,
      proofRef: null,
      replayRef: null,
      issuedAt: this.now(),
      retryAfterMs: 0,
      metadata: Object.freeze({
        inflightEnvelopeId: pending.envelopeId,
        dedupeKey: pending.dedupeKey,
        resendHint: true,
      }),
    });
  }

  private async handleCursorSync(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTransportMessageAck> {
    if (!this.config.allowCursorSyncThroughMessageHandler) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'CURSOR_REJECTED',
        'Cursor sync is reserved for ChatCursorHandler in this transport shape.',
        snapshot,
      );
    }

    const payload = envelope.cursorSync;
    if (!payload) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'SYNC_CLIENT_CURSOR requires a normalized cursor payload.',
        snapshot,
      );
    }

    this.totalCursorSyncs += 1;

    const dedupeKey = this.computeDedupeKey(snapshot, envelope, payload);
    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      transportSocketId,
      envelope,
      dedupeKey,
      {
        transportKind: 'CURSOR_SYNC',
        roomId: payload.roomId,
        channelId: payload.channelId,
        payload: {
          cursorSync: payload,
        },
      },
    );

    try {
      const submissionResult = await this.backend.submitTransportEnvelope(backendEnvelope);
      this.totalForwarded += 1;
      this.metricsPort?.recordForwarded(envelope.kind, payload.roomId);
      const ack = this.buildAcceptedAck(
        envelope,
        payload.roomId,
        payload.channelId,
        submissionResult,
      );
      this.recordAudit(auth, transportSocketId, envelope, snapshot, ack, backendEnvelope.hash, dedupeKey);
      return ack;
    } catch (error) {
      return this.rejectEnvelope(
        auth,
        transportSocketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend cursor submission failed.',
        snapshot,
      );
    }
  }

  // ==========================================================================
  // MARK: Validation and restriction law
  // ==========================================================================

  private validateMessagePayload(
    payload: ChatTransportMessagePayload,
  ): { valid: true } | { valid: false; reason: ChatTransportRejectReason; message: string } {
    const trimmed = payload.body.trim();
    const bodyLength = Buffer.byteLength(trimmed, 'utf8');

    if (!trimmed && !payload.command && payload.attachments.length === 0) {
      return {
        valid: false,
        reason: 'EMPTY_MESSAGE',
        message: 'Message body, command, and attachments were all empty.',
      };
    }

    if (bodyLength > this.config.maxBodyLength) {
      return {
        valid: false,
        reason: 'MESSAGE_TOO_LONG',
        message: 'Message body exceeded transport body length.',
      };
    }

    if (payload.attachments.length > this.config.maxAttachmentsPerMessage) {
      return {
        valid: false,
        reason: 'TOO_MANY_ATTACHMENTS',
        message: 'Message exceeded attachment count limit.',
      };
    }

    let attachmentBytes = 0;
    for (const attachment of payload.attachments) {
      attachmentBytes += attachment.sizeBytes;
      if (attachment.sizeBytes > this.config.maxAttachmentBytes) {
        return {
          valid: false,
          reason: 'PAYLOAD_TOO_LARGE',
          message: 'Attachment exceeded allowed attachment size.',
        };
      }
    }

    if (attachmentBytes > this.config.maxEnvelopeBytes) {
      return {
        valid: false,
        reason: 'PAYLOAD_TOO_LARGE',
        message: 'Attachment payload exceeded allowed transport envelope size.',
      };
    }

    if (payload.command && !this.config.allowCommandSubmits) {
      return {
        valid: false,
        reason: 'COMMAND_NOT_ALLOWED',
        message: 'Embedded commands are disabled in transport config.',
      };
    }

    return { valid: true };
  }

  private checkRestrictions(
    auth: ChatGatewayAuthContext,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): ChatTransportRejectReason | null {
    const restrictionSet = new Set(snapshot.restrictions);
    const connectionRestrictions = new Set(auth.restrictions);

    const roomId = envelope.roomId;
    const channelId = envelope.channelId;

    if (snapshot.authorityState === 'TERMINATED' || snapshot.authorityState === 'SUSPENDED') {
      return 'RESTRICTED';
    }

    if (restrictionSet.has('BLOCK_MESSAGE_SUBMIT')) {
      switch (envelope.kind) {
        case 'SEND_MESSAGE':
        case 'SEND_BATCH':
        case 'SEND_COMMAND':
        case 'REACT_MESSAGE':
        case 'REMOVE_REACTION':
          return 'RESTRICTED';
        default:
          break;
      }
    }

    if (restrictionSet.has('BLOCK_PRIVATE_ROOMS') && roomId?.includes('private')) {
      return 'RESTRICTED';
    }

    if (restrictionSet.has('BLOCK_SHADOW_ROOMS') && channelId?.includes('shadow')) {
      return 'RESTRICTED';
    }

    if (restrictionSet.has('BLOCK_CURSOR') && envelope.kind === 'SYNC_CLIENT_CURSOR') {
      return 'CURSOR_REJECTED';
    }

    if (restrictionSet.has('BLOCK_TYPING') && envelope.kind === 'ACK_DELIVERY') {
      // typing is handled elsewhere; no special message rejection here
    }

    if (connectionRestrictions.has('NO_PRIVATE_ENTRY') && roomId?.includes('private')) {
      return 'RESTRICTED';
    }

    if (connectionRestrictions.has('NO_SHADOW_ENTRY') && channelId?.includes('shadow')) {
      return 'RESTRICTED';
    }

    if (connectionRestrictions.has('NO_DEALROOM_ENTRY') && channelId === 'DEAL_ROOM') {
      return 'RESTRICTED';
    }

    if (connectionRestrictions.has('READ_ONLY')) {
      switch (envelope.kind) {
        case 'SEND_MESSAGE':
        case 'SEND_BATCH':
        case 'SEND_COMMAND':
        case 'REACT_MESSAGE':
        case 'REMOVE_REACTION':
          return 'RESTRICTED';
        default:
          break;
      }
    }

    return null;
  }

  private checkRateWindow(
    sessionId: string,
    payload: ChatTransportMessagePayload,
  ): { allowed: true; retryAfterMs: null } | { allowed: false; retryAfterMs: number } {
    const bytes = Buffer.byteLength(payload.body ?? '', 'utf8');
    return this.consumeRateBudget(sessionId, bytes, 1);
  }

  private checkBatchRateWindow(
    sessionId: string,
    bytes: number,
    count: number,
  ): { allowed: true; retryAfterMs: null } | { allowed: false; retryAfterMs: number } {
    return this.consumeRateBudget(sessionId, bytes, count);
  }

  private consumeRateBudget(
    sessionId: string,
    additionalBytes: number,
    additionalCount: number,
  ): { allowed: true; retryAfterMs: null } | { allowed: false; retryAfterMs: number } {
    const now = this.now();
    const window = this.submitWindowsBySessionId.get(sessionId);

    if (!window || now - window.startedAt >= this.config.submitWindowMs) {
      this.submitWindowsBySessionId.set(sessionId, {
        startedAt: now,
        count: additionalCount,
        bytes: additionalBytes,
        distinctNonces: 0,
      });
      return { allowed: true, retryAfterMs: null };
    }

    if (
      window.count + additionalCount > this.config.maxMessagesPerWindow ||
      window.bytes + additionalBytes > this.config.maxBytesPerWindow
    ) {
      this.totalRateLimited += 1;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, this.config.submitWindowMs - (now - window.startedAt)),
      };
    }

    this.submitWindowsBySessionId.set(sessionId, {
      ...window,
      count: window.count + additionalCount,
      bytes: window.bytes + additionalBytes,
    });

    return { allowed: true, retryAfterMs: null };
  }

  // ==========================================================================
  // MARK: Envelope building
  // ==========================================================================

  private buildBackendEnvelope(
    snapshot: ChatSessionAuthoritySnapshot,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    dedupeKey: string,
    body: {
      readonly transportKind: string;
      readonly roomId: ChatTransportRoomId;
      readonly channelId: ChatTransportChannelId | null;
      readonly payload: Readonly<Record<string, unknown>>;
    },
  ): ChatTransportBackendEnvelope {
    const submittedAt = this.now();

    const payload = Object.freeze({
      transportKind: body.transportKind,
      roomId: body.roomId,
      channelId: body.channelId,
      payload: body.payload,
      transportMetadata: envelope.metadata,
      sourceEnvelopeId: envelope.envelopeId,
    });

    const hash = sha256(
      stableJson({
        namespace: envelope.namespace,
        sessionId: snapshot.sessionId,
        userId: snapshot.userId,
        dedupeKey,
        payload,
      }),
    );

    return Object.freeze({
      backendEnvelopeId: randomUUID(),
      submittedAt,
      namespace: envelope.namespace,
      roomId: body.roomId,
      channelId: body.channelId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      authLevel: snapshot.authLevel,
      transportSocketId,
      kind: envelope.kind,
      dedupeKey,
      hash,
      payload,
      restrictions: Object.freeze([...snapshot.restrictions]),
      transportMetadata: Object.freeze({
        envelopeId: envelope.envelopeId,
        issuedAt: envelope.issuedAt,
        clientNonce: envelope.clientNonce,
      }),
    });
  }

  private createPendingSubmission(
    envelope: ChatInboundTransportEnvelope,
    dedupeKey: string,
    hash: string,
    snapshot: ChatSessionAuthoritySnapshot,
    transportSocketId: string,
    roomId: string,
    channelId: string | null,
  ): ChatTransportPendingSubmission {
    const pending: ChatTransportPendingSubmission = Object.freeze({
      envelopeId: envelope.envelopeId,
      dedupeKey,
      createdAt: this.now(),
      expiresAt: this.now() + this.config.inflightTtlMs,
      roomId,
      channelId,
      socketId: transportSocketId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      nonce: envelope.clientNonce,
      hash,
    });

    this.inflightByEnvelopeId.set(pending.envelopeId, pending);
    this.inflightByDedupeKey.set(pending.dedupeKey, pending);
    return pending;
  }

  private clearPendingSubmission(envelopeId: string, dedupeKey: string): void {
    this.inflightByEnvelopeId.delete(envelopeId);
    this.inflightByDedupeKey.delete(dedupeKey);
  }

  private sealDedupeKey(dedupeKey: string): void {
    this.seenDedupeKeyExpiry.set(dedupeKey, this.now() + this.config.dedupeTtlMs);
  }

  private computeDedupeKey(
    snapshot: ChatSessionAuthoritySnapshot,
    envelope: ChatInboundTransportEnvelope,
    value: unknown,
  ): string {
    const nonce = envelope.clientNonce ?? 'no-nonce';
    const basis = stableJson({
      namespace: envelope.namespace,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      nonce,
      kind: envelope.kind,
      value,
    });

    return sha256(basis);
  }

  private isDuplicate(dedupeKey: string, envelopeId: string): boolean {
    const now = this.now();
    const seenExpiry = this.seenDedupeKeyExpiry.get(dedupeKey);
    if (typeof seenExpiry === 'number' && seenExpiry > now) {
      this.totalDeduped += 1;
      return true;
    }

    const inflight = this.inflightByDedupeKey.get(dedupeKey);
    if (inflight && inflight.envelopeId !== envelopeId && inflight.expiresAt > now) {
      this.totalDeduped += 1;
      return true;
    }

    return false;
  }

  // ==========================================================================
  // MARK: Session and room checks
  // ==========================================================================

  private resolveSessionSnapshot(
    auth: ChatGatewayAuthContext,
  ): ChatSessionAuthoritySnapshot | null {
    const direct = this.sessionRegistry.getAuthoritySnapshot(auth.sessionId);
    if (direct && direct.userId === auth.userId) {
      return direct;
    }

    const byUser = this.sessionRegistry.listAuthoritySnapshotsForUser(auth.userId);
    return byUser.find((item) => item.sessionId === auth.sessionId) ?? null;
  }

  private isRoomJoined(
    snapshot: ChatSessionAuthoritySnapshot,
    roomId: string,
  ): boolean {
    return snapshot.roomIds.includes(roomId);
  }

  // ==========================================================================
  // MARK: Ack construction
  // ==========================================================================

  private buildAcceptedAck(
    envelope: ChatInboundTransportEnvelope,
    roomId: string,
    channelId: string | null,
    submissionResult: ChatTransportBackendSubmissionResult,
  ): ChatTransportMessageAck {
    return Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId,
      channelId,
      state: submissionResult.state,
      reason: submissionResult.accepted ? null : 'UNKNOWN',
      transportMessageId: envelope.message?.clientMessageId ?? envelope.envelopeId,
      authoritativeMessageId: submissionResult.authoritativeMessageId,
      authoritativeSequence: submissionResult.authoritativeSequence,
      proofRef: submissionResult.proofRef,
      replayRef: submissionResult.replayRef,
      issuedAt: this.now(),
      retryAfterMs: null,
      metadata: Object.freeze({
        moderationState: submissionResult.moderationState,
        backendEnvelopeId: submissionResult.backendEnvelopeId,
        extra: submissionResult.extraMetadata,
      }),
    });
  }

  private rejectEnvelope(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    reason: ChatTransportRejectReason,
    message: string,
    snapshot?: ChatSessionAuthoritySnapshot,
    extras: {
      readonly retryAfterMs?: number | null;
    } = {},
  ): ChatTransportMessageAck {
    const roomId = envelope.roomId ?? null;
    this.totalRejected += 1;
    if (reason === 'RATE_LIMITED') {
      this.totalRateLimited += 1;
      this.metricsPort?.recordRateLimited(envelope.kind, roomId);
    } else if (reason === 'DEDUPED') {
      this.totalDeduped += 1;
      this.metricsPort?.recordDedupe(envelope.kind, roomId);
    } else {
      this.metricsPort?.recordRejected(envelope.kind, reason, roomId);
    }

    const ack: ChatTransportMessageAck = Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state:
        reason === 'RATE_LIMITED'
          ? 'RATE_LIMITED'
          : reason === 'RESTRICTED'
            ? 'QUARANTINED'
            : reason === 'DEDUPED'
              ? 'DROPPED'
              : 'REJECTED',
      reason,
      transportMessageId: envelope.message?.clientMessageId ?? envelope.envelopeId,
      authoritativeMessageId: null,
      authoritativeSequence: null,
      proofRef: null,
      replayRef: null,
      issuedAt: this.now(),
      retryAfterMs: extras.retryAfterMs ?? null,
      metadata: Object.freeze({
        message,
      }),
    });

    const hash = sha256(
      stableJson({
        envelope,
        ack,
      }),
    );

    this.recordAudit(
      auth,
      transportSocketId,
      envelope,
      snapshot ?? null,
      ack,
      hash,
      sha256(`${envelope.envelopeId}:${reason}`),
    );

    return ack;
  }

  // ==========================================================================
  // MARK: Audit and metrics
  // ==========================================================================

  private recordAudit(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot | null,
    ack: ChatTransportMessageAck,
    hash: string,
    dedupeKey: string,
  ): void {
    const record: ChatTransportMessageAuditRecord = Object.freeze({
      auditId: randomUUID(),
      recordedAt: this.now(),
      envelopeId: envelope.envelopeId,
      dedupeKey,
      namespace: envelope.namespace,
      socketId: transportSocketId,
      sessionId: snapshot?.sessionId ?? null,
      userId: snapshot?.userId ?? auth.userId ?? null,
      username: snapshot?.username ?? auth.username ?? null,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      kind: envelope.kind,
      accepted: ack.state !== 'REJECTED' && ack.state !== 'DROPPED' && ack.state !== 'QUARANTINED',
      state: ack.state,
      rejectReason: ack.reason,
      hash,
      payloadBytes: Buffer.byteLength(stableJson(envelope), 'utf8'),
      restrictionCodes: Object.freeze([...(auth.restrictions ?? [])]),
      tags: Object.freeze([
        ack.state,
        envelope.kind,
        ack.reason ?? 'NO_REASON',
      ]),
      metadata: Object.freeze({
        ackMetadata: ack.metadata,
      }),
    });

    this.auditTrail.push(record);
    if (this.auditTrail.length > this.config.auditLimit) {
      this.auditTrail.splice(0, this.auditTrail.length - this.config.auditLimit);
    }
  }

  private recordReplayAudit(
    auth: ChatGatewayAuthContext,
    transportSocketId: string,
    envelope: ChatInboundTransportEnvelope,
    snapshot: ChatSessionAuthoritySnapshot | null,
    hash: string,
    dedupeKey: string,
    result: ChatTransportReplayWindowResult,
  ): void {
    const pseudoAck: ChatTransportMessageAck = Object.freeze({
      ackId: result.resultId,
      envelopeId: envelope.envelopeId,
      roomId: result.roomId,
      channelId: result.channelId,
      state: result.accepted ? 'ACCEPTED' : 'REJECTED',
      reason: result.accepted ? null : 'REPLAY_NOT_ALLOWED',
      transportMessageId: null,
      authoritativeMessageId: null,
      authoritativeSequence: null,
      proofRef: null,
      replayRef: result.resultId,
      issuedAt: this.now(),
      retryAfterMs: null,
      metadata: Object.freeze({
        replayScope: result.scope,
        resultCount: result.messages.length,
        reason: result.reason,
      }),
    });

    this.recordAudit(auth, transportSocketId, envelope, snapshot, pseudoAck, hash, dedupeKey);
  }

  public getMetricsSnapshot(): ChatTransportMessageHandlerMetricsSnapshot {
    return Object.freeze({
      totalReceived: this.totalReceived,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      totalRateLimited: this.totalRateLimited,
      totalDeduped: this.totalDeduped,
      totalForwarded: this.totalForwarded,
      totalReplayFetches: this.totalReplayFetches,
      totalReactionEvents: this.totalReactionEvents,
      totalReadReceipts: this.totalReadReceipts,
      totalClientAcks: this.totalClientAcks,
      totalCursorSyncs: this.totalCursorSyncs,
      inflightSubmissions: this.inflightByEnvelopeId.size,
      auditedRecords: this.auditTrail.length,
    });
  }

  public listAuditTrail(): readonly ChatTransportMessageAuditRecord[] {
    return Object.freeze([...this.auditTrail]);
  }

  public listInflightSubmissions(): readonly ChatTransportPendingSubmission[] {
    return Object.freeze([...this.inflightByEnvelopeId.values()]);
  }

  // ==========================================================================
  // MARK: Fanout helpers
  // ==========================================================================

  private async fanoutEchoPayload(
    roomId: string,
    channelId: string | null,
    echoPayload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.fanout.fanout({
      event: 'chat:transport:echo',
      roomId,
      channelId,
      targets: Object.freeze([]),
      payload: echoPayload,
    });
  }

  // ==========================================================================
  // MARK: Maintenance
  // ==========================================================================

  public prune(now: number = this.now()): void {
    for (const [dedupeKey, expiresAt] of this.seenDedupeKeyExpiry.entries()) {
      if (expiresAt <= now) {
        this.seenDedupeKeyExpiry.delete(dedupeKey);
      }
    }

    for (const [envelopeId, pending] of this.inflightByEnvelopeId.entries()) {
      if (pending.expiresAt <= now) {
        this.inflightByEnvelopeId.delete(envelopeId);
        this.inflightByDedupeKey.delete(pending.dedupeKey);
      }
    }

    for (const [sessionId, window] of this.submitWindowsBySessionId.entries()) {
      if (now - window.startedAt >= this.config.submitWindowMs) {
        this.submitWindowsBySessionId.delete(sessionId);
      }
    }
  }

  public resetTransportState(): void {
    this.inflightByEnvelopeId.clear();
    this.inflightByDedupeKey.clear();
    this.seenDedupeKeyExpiry.clear();
    this.submitWindowsBySessionId.clear();
    this.auditTrail.splice(0, this.auditTrail.length);

    this.totalReceived = 0;
    this.totalAccepted = 0;
    this.totalRejected = 0;
    this.totalRateLimited = 0;
    this.totalDeduped = 0;
    this.totalForwarded = 0;
    this.totalReplayFetches = 0;
    this.totalReactionEvents = 0;
    this.totalReadReceipts = 0;
    this.totalClientAcks = 0;
    this.totalCursorSyncs = 0;
  }
}

// ============================================================================
// MARK: Helper exports
// ============================================================================

export function createChatMessageHandler(
  deps: ChatTransportMessageHandlerDependencies,
  config: Partial<ChatTransportMessageHandlerConfig> = {},
): ChatMessageHandler {
  return new ChatMessageHandler(deps, config);
}
