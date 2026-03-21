/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT CURSOR HANDLER
 * FILE: pzo-server/src/chat/ChatCursorHandler.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file extracts cursor, selection, viewport, and live-read-window ingress
 * out of ChatGateway so cursor transport behavior stays thin, typed, and room
 * scoped rather than leaking into generic socket glue.
 *
 * Cursor doctrine
 * ---------------
 * - Cursor transport is ephemeral and scene-aware.
 * - It may mirror live text selection, caret position, viewport anchors, and
 *   replay window requests.
 * - It may NOT become authoritative replay truth.
 * - It may NOT become authoritative read truth.
 * - It may NOT become authoritative transcript truth.
 * - It forwards normalized cursor intent to backend chat authority and only
 *   fans out accepted cursor deltas.
 *
 * Why this file exists
 * --------------------
 * In Point Zero One, cursor state is not just an editor nicety. It carries:
 * - deal-room pressure when another participant hovers an offer line,
 * - syndicate intimacy when allies are visibly reading the same thread,
 * - global theater when cursor drift signals indecision,
 * - helper intervention timing when a player stalls inside a rescue prompt,
 * - replay anchoring when the user requests chat context around a sequence.
 *
 * Relationship to sibling files
 * -----------------------------
 * - ChatConnectionAuth.ts authenticates the socket.
 * - ChatSessionRegistry.ts resolves admitted session truth.
 * - ChatPresenceHandler.ts owns presence and occupancy ingress.
 * - ChatTypingHandler.ts owns typing cadence and typing leases.
 * - ChatMessageHandler.ts owns message submit/replay ingress.
 * - backend/src/game/engine/chat/replay/* and ChatPresenceState.ts remain
 *   authoritative once transport intent is accepted server-side.
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

export type ChatCursorRoomId = string;
export type ChatCursorChannelId = string;
export type ChatCursorLeaseId = string;
export type ChatCursorEnvelopeId = string;
export type ChatCursorSessionId = string;
export type ChatCursorSocketId = string;
export type ChatCursorRangeMode = 'CARET' | 'SELECTION' | 'BLOCK';
export type ChatCursorAnchorKind = 'MESSAGE' | 'THREAD' | 'TIMESTAMP' | 'SEQUENCE';
export type ChatCursorVisibility = 'VISIBLE' | 'SUBTLE' | 'HIDDEN';
export type ChatCursorViewportMode = 'PINNED' | 'FOLLOWING' | 'FREE_SCROLL';
export type ChatCursorReplayScope =
  | 'AROUND_MESSAGE'
  | 'AROUND_SEQUENCE'
  | 'AROUND_TIMESTAMP'
  | 'LATEST'
  | 'WINDOW';

export type ChatCursorEventKind =
  | 'SET_CURSOR'
  | 'SET_SELECTION'
  | 'SET_VIEWPORT'
  | 'CLEAR_CURSOR'
  | 'PING_CURSOR'
  | 'REQUEST_ROOM_CURSORS'
  | 'REQUEST_HISTORY_WINDOW'
  | 'DISCONNECT_HINT';

export type ChatCursorAckState =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'RATE_LIMITED'
  | 'QUARANTINED';

export type ChatCursorRejectReason =
  | 'NOT_ADMITTED'
  | 'SESSION_NOT_FOUND'
  | 'ROOM_NOT_JOINED'
  | 'CURSOR_RESTRICTED'
  | 'CHANNEL_NOT_ALLOWED'
  | 'SOCKET_MISMATCH'
  | 'MALFORMED_PAYLOAD'
  | 'BACKEND_UNAVAILABLE'
  | 'RANGE_INVALID'
  | 'VIEWPORT_INVALID'
  | 'RATE_LIMITED'
  | 'REQUEST_NOT_ALLOWED'
  | 'HISTORY_NOT_ALLOWED'
  | 'UNSUPPORTED_KIND'
  | 'UNKNOWN';

export interface ChatCursorAnchor {
  readonly anchorKind: ChatCursorAnchorKind;
  readonly messageId: string | null;
  readonly threadId: string | null;
  readonly sequence: number | null;
  readonly timestamp: number | null;
}

export interface ChatCursorRange {
  readonly mode: ChatCursorRangeMode;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly caretBias: 'LEFT' | 'RIGHT' | 'NONE';
}

export interface ChatCursorViewport {
  readonly mode: ChatCursorViewportMode;
  readonly topAnchor: ChatCursorAnchor;
  readonly bottomAnchor: ChatCursorAnchor | null;
  readonly centerSequence: number | null;
  readonly topPixelOffset: number | null;
  readonly heightPx: number | null;
}

export interface ChatCursorPayload {
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly anchor: ChatCursorAnchor;
  readonly range: ChatCursorRange;
  readonly visibility: ChatCursorVisibility;
  readonly issuedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatSelectionPayload {
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly anchor: ChatCursorAnchor;
  readonly range: ChatCursorRange;
  readonly visibility: ChatCursorVisibility;
  readonly semanticLabel: string | null;
  readonly issuedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatViewportPayload {
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly viewport: ChatCursorViewport;
  readonly issuedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorStateRequestPayload {
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly includeSelf: boolean;
  readonly includeViewport: boolean;
  readonly includeSelections: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorHistoryWindowRequestPayload {
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly scope: ChatCursorReplayScope;
  readonly anchor: ChatCursorAnchor;
  readonly before: number;
  readonly after: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorDisconnectHintPayload {
  readonly roomId: ChatCursorRoomId | null;
  readonly channelId: ChatCursorChannelId | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorEnvelope {
  readonly envelopeId: ChatCursorEnvelopeId;
  readonly namespace: string;
  readonly issuedAt: number;
  readonly kind: ChatCursorEventKind;
  readonly roomId: ChatCursorRoomId | null;
  readonly channelId: ChatCursorChannelId | null;
  readonly cursorPayload: ChatCursorPayload | null;
  readonly selectionPayload: ChatSelectionPayload | null;
  readonly viewportPayload: ChatViewportPayload | null;
  readonly stateRequestPayload: ChatCursorStateRequestPayload | null;
  readonly historyWindowRequestPayload: ChatCursorHistoryWindowRequestPayload | null;
  readonly disconnectHintPayload: ChatCursorDisconnectHintPayload | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorLease {
  readonly leaseId: ChatCursorLeaseId;
  readonly sessionId: ChatCursorSessionId;
  readonly userId: string;
  readonly username: string;
  readonly socketId: ChatCursorSocketId;
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly anchor: ChatCursorAnchor;
  readonly range: ChatCursorRange;
  readonly viewport: ChatCursorViewport | null;
  readonly visibility: ChatCursorVisibility;
  readonly semanticLabel: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorMirrorRecord {
  readonly sessionId: ChatCursorSessionId;
  readonly userId: string;
  readonly username: string;
  readonly socketId: ChatCursorSocketId;
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly anchor: ChatCursorAnchor;
  readonly range: ChatCursorRange;
  readonly viewport: ChatCursorViewport | null;
  readonly visibility: ChatCursorVisibility;
  readonly semanticLabel: string | null;
  readonly leaseId: ChatCursorLeaseId;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorBackendEnvelope {
  readonly backendEnvelopeId: string;
  readonly submittedAt: number;
  readonly namespace: string;
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly sessionId: ChatCursorSessionId;
  readonly userId: string;
  readonly username: string;
  readonly authLevel: string;
  readonly socketId: ChatCursorSocketId;
  readonly kind: ChatCursorEventKind;
  readonly leaseId: ChatCursorLeaseId | null;
  readonly payloadHash: string;
  readonly restrictions: readonly ChatConnectionRestrictionCode[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly transportMetadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorBackendResult {
  readonly accepted: boolean;
  readonly backendEnvelopeId: string;
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly state: ChatCursorAckState;
  readonly reason: string | null;
  readonly authoritativeLeaseId: ChatCursorLeaseId | null;
  readonly expiresAt: number | null;
  readonly echoPayload: Readonly<Record<string, unknown>> | null;
  readonly statePayload: Readonly<Record<string, unknown>> | null;
  readonly historyPayload: Readonly<Record<string, unknown>> | null;
  readonly extraMetadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorFanoutEnvelope {
  readonly fanoutId: string;
  readonly roomId: ChatCursorRoomId;
  readonly channelId: ChatCursorChannelId | null;
  readonly emittedAt: number;
  readonly fromUserId: string;
  readonly fromUsername: string;
  readonly leaseId: ChatCursorLeaseId | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ChatCursorAck {
  readonly ackId: string;
  readonly envelopeId: ChatCursorEnvelopeId;
  readonly roomId: ChatCursorRoomId | null;
  readonly channelId: ChatCursorChannelId | null;
  readonly state: ChatCursorAckState;
  readonly reason: ChatCursorRejectReason | null;
  readonly leaseId: ChatCursorLeaseId | null;
  readonly retryAfterMs: number | null;
  readonly expiresAt: number | null;
  readonly statePayload: Readonly<Record<string, unknown>> | null;
  readonly historyPayload: Readonly<Record<string, unknown>> | null;
  readonly issuedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorAuditRecord {
  readonly auditId: string;
  readonly envelopeId: ChatCursorEnvelopeId;
  readonly kind: ChatCursorEventKind;
  readonly sessionId: ChatCursorSessionId | null;
  readonly userId: string;
  readonly roomId: ChatCursorRoomId | null;
  readonly channelId: ChatCursorChannelId | null;
  readonly state: ChatCursorAckState;
  readonly reason: ChatCursorRejectReason | null;
  readonly leaseId: ChatCursorLeaseId | null;
  readonly createdAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatCursorRateWindow {
  readonly windowStartedAt: number;
  readonly eventCount: number;
  readonly requestCount: number;
}

// ============================================================================
// MARK: Dependencies and configuration
// ============================================================================

export interface ChatCursorHandlerConfig {
  readonly leaseTtlMs: number;
  readonly eventRateWindowMs: number;
  readonly maxEventsPerWindow: number;
  readonly maxRequestsPerWindow: number;
  readonly maxOffset: number;
  readonly maxHistoryWindowBefore: number;
  readonly maxHistoryWindowAfter: number;
  readonly auditLimit: number;
  readonly allowRoomCursorRequests: boolean;
  readonly allowHistoryRequests: boolean;
  readonly requireRoomJoin: boolean;
}

export interface ChatCursorHandlerDependencies {
  readonly sessionRegistry: ChatSessionRegistry;
  readonly backend: ChatCursorBackendPort;
  readonly fanout: ChatCursorFanoutPort;
  readonly metrics?: ChatCursorMetricsPort;
  readonly logger?: ChatCursorLogger;
  readonly clock?: () => number;
}

export interface ChatCursorLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface ChatCursorBackendPort {
  submitCursorEnvelope(
    envelope: ChatCursorBackendEnvelope,
  ): Promise<ChatCursorBackendResult>;
}

export interface ChatCursorFanoutPort {
  fanout(envelope: ChatCursorFanoutEnvelope): Promise<void> | void;
}

export interface ChatCursorMetricsPort {
  recordAccepted(kind: ChatCursorEventKind, roomId: string | null): void;
  recordRejected(kind: ChatCursorEventKind, reason: ChatCursorRejectReason, roomId: string | null): void;
  recordRateLimited(kind: ChatCursorEventKind, roomId: string | null): void;
  recordHistoryRequest(roomId: string | null): void;
}

export interface ChatCursorSocketAttachmentOptions {
  readonly socket: Socket;
  readonly auth: ChatGatewayAuthContext;
}

export interface ChatCursorSocketBinding {
  detach(): void;
}

export interface ChatCursorMetricsSnapshot {
  readonly totalReceived: number;
  readonly totalAccepted: number;
  readonly totalRejected: number;
  readonly totalRateLimited: number;
  readonly totalHistoryRequests: number;
  readonly totalFanouts: number;
  readonly activeLeaseCount: number;
  readonly activeMirrorCount: number;
  readonly auditCount: number;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_CHAT_CURSOR_HANDLER_CONFIG: ChatCursorHandlerConfig = {
  leaseTtlMs: 30_000,
  eventRateWindowMs: 12_000,
  maxEventsPerWindow: 72,
  maxRequestsPerWindow: 18,
  maxOffset: 100_000,
  maxHistoryWindowBefore: 150,
  maxHistoryWindowAfter: 150,
  auditLimit: 2_500,
  allowRoomCursorRequests: true,
  allowHistoryRequests: true,
  requireRoomJoin: true,
};

const NOOP_LOGGER: ChatCursorLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// ============================================================================
// MARK: Utilities
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toReadonlyMetadata(value: unknown): Readonly<Record<string, unknown>> {
  return Object.freeze(isRecord(value) ? { ...value } : {});
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeAnchor(payload: unknown): ChatCursorAnchor {
  const record = isRecord(payload) ? payload : {};
  const anchorKind = asString(record.anchorKind);
  return Object.freeze({
    anchorKind:
      anchorKind === 'MESSAGE' ||
      anchorKind === 'THREAD' ||
      anchorKind === 'TIMESTAMP' ||
      anchorKind === 'SEQUENCE'
        ? anchorKind
        : 'MESSAGE',
    messageId: asString(record.messageId),
    threadId: asString(record.threadId),
    sequence: asNumber(record.sequence),
    timestamp: asNumber(record.timestamp),
  });
}

function normalizeRange(payload: unknown, maxOffset: number): ChatCursorRange {
  const record = isRecord(payload) ? payload : {};
  const mode = asString(record.mode);
  const startOffset = clamp(asNumber(record.startOffset) ?? 0, 0, maxOffset);
  const endOffset = clamp(asNumber(record.endOffset) ?? startOffset, 0, maxOffset);
  const caretBias = asString(record.caretBias);

  return Object.freeze({
    mode:
      mode === 'CARET' || mode === 'SELECTION' || mode === 'BLOCK'
        ? mode
        : 'CARET',
    startOffset,
    endOffset,
    caretBias:
      caretBias === 'LEFT' || caretBias === 'RIGHT' || caretBias === 'NONE'
        ? caretBias
        : 'NONE',
  });
}

function normalizeViewport(payload: unknown): ChatCursorViewport {
  const record = isRecord(payload) ? payload : {};
  const mode = asString(record.mode);
  return Object.freeze({
    mode:
      mode === 'PINNED' || mode === 'FOLLOWING' || mode === 'FREE_SCROLL'
        ? mode
        : 'FREE_SCROLL',
    topAnchor: normalizeAnchor(record.topAnchor),
    bottomAnchor: isRecord(record.bottomAnchor) ? normalizeAnchor(record.bottomAnchor) : null,
    centerSequence: asNumber(record.centerSequence),
    topPixelOffset: asNumber(record.topPixelOffset),
    heightPx: asNumber(record.heightPx),
  });
}

function normalizeCursorVisibility(value: unknown): ChatCursorVisibility {
  switch (asString(value)) {
    case 'VISIBLE':
    case 'SUBTLE':
    case 'HIDDEN':
      return value;
    default:
      return 'VISIBLE';
  }
}

function normalizeReplayScope(value: unknown): ChatCursorReplayScope {
  switch (asString(value)) {
    case 'AROUND_MESSAGE':
    case 'AROUND_SEQUENCE':
    case 'AROUND_TIMESTAMP':
    case 'LATEST':
    case 'WINDOW':
      return value;
    default:
      return 'WINDOW';
  }
}

function normalizeCursorPayload(
  payload: unknown,
  config: ChatCursorHandlerConfig,
): ChatCursorPayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    anchor: normalizeAnchor(record.anchor),
    range: normalizeRange(record.range, config.maxOffset),
    visibility: normalizeCursorVisibility(record.visibility),
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeSelectionPayload(
  payload: unknown,
  config: ChatCursorHandlerConfig,
): ChatSelectionPayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    anchor: normalizeAnchor(record.anchor),
    range: normalizeRange(record.range, config.maxOffset),
    visibility: normalizeCursorVisibility(record.visibility),
    semanticLabel: asString(record.semanticLabel),
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeViewportPayload(payload: unknown): ChatViewportPayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    viewport: normalizeViewport(record.viewport),
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeStateRequest(payload: unknown): ChatCursorStateRequestPayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    includeSelf: record.includeSelf === true,
    includeViewport: record.includeViewport !== false,
    includeSelections: record.includeSelections !== false,
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeHistoryRequest(
  payload: unknown,
  config: ChatCursorHandlerConfig,
): ChatCursorHistoryWindowRequestPayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    scope: normalizeReplayScope(record.scope),
    anchor: normalizeAnchor(record.anchor),
    before: clamp(asNumber(record.before) ?? 40, 0, config.maxHistoryWindowBefore),
    after: clamp(asNumber(record.after) ?? 40, 0, config.maxHistoryWindowAfter),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeDisconnectHint(payload: unknown): ChatCursorDisconnectHintPayload {
  const record = isRecord(payload) ? payload : {};
  return Object.freeze({
    roomId: asString(record.roomId),
    channelId: asString(record.channelId),
    reason: asString(record.reason),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeEnvelope(
  kind: ChatCursorEventKind,
  payload: unknown,
  namespace: string,
  config: ChatCursorHandlerConfig,
): ChatCursorEnvelope {
  const record = isRecord(payload) ? payload : {};
  const cursorPayload = normalizeCursorPayload(record.cursorPayload ?? record, config);
  const selectionPayload = normalizeSelectionPayload(record.selectionPayload ?? record, config);
  const viewportPayload = normalizeViewportPayload(record.viewportPayload ?? record);
  const stateRequestPayload = normalizeStateRequest(record.stateRequestPayload ?? record);
  const historyWindowRequestPayload = normalizeHistoryRequest(record.historyWindowRequestPayload ?? record, config);
  const disconnectHintPayload = normalizeDisconnectHint(record.disconnectHintPayload ?? record);

  const roomId =
    asString(record.roomId) ??
    cursorPayload?.roomId ??
    selectionPayload?.roomId ??
    viewportPayload?.roomId ??
    stateRequestPayload?.roomId ??
    historyWindowRequestPayload?.roomId ??
    disconnectHintPayload.roomId ??
    null;

  const channelId =
    asString(record.channelId) ??
    cursorPayload?.channelId ??
    selectionPayload?.channelId ??
    viewportPayload?.channelId ??
    stateRequestPayload?.channelId ??
    historyWindowRequestPayload?.channelId ??
    disconnectHintPayload.channelId ??
    null;

  return Object.freeze({
    envelopeId: asString(record.envelopeId) ?? randomUUID(),
    namespace,
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    kind,
    roomId,
    channelId,
    cursorPayload,
    selectionPayload,
    viewportPayload,
    stateRequestPayload,
    historyWindowRequestPayload,
    disconnectHintPayload,
    metadata: toReadonlyMetadata(record.metadata),
  });
}

// ============================================================================
// MARK: Main handler
// ============================================================================

export class ChatCursorHandler {
  private readonly config: ChatCursorHandlerConfig;
  private readonly sessionRegistry: ChatSessionRegistry;
  private readonly backend: ChatCursorBackendPort;
  private readonly fanout: ChatCursorFanoutPort;
  private readonly metricsPort?: ChatCursorMetricsPort;
  private readonly logger: ChatCursorLogger;
  private readonly now: () => number;

  private readonly leasesByLeaseId = new Map<string, ChatCursorLease>();
  private readonly mirrorsByCompositeKey = new Map<string, ChatCursorMirrorRecord>();
  private readonly rateWindowsBySessionId = new Map<string, ChatCursorRateWindow>();
  private readonly auditTrail: ChatCursorAuditRecord[] = [];

  private totalReceived = 0;
  private totalAccepted = 0;
  private totalRejected = 0;
  private totalRateLimited = 0;
  private totalHistoryRequests = 0;
  private totalFanouts = 0;

  public constructor(
    deps: ChatCursorHandlerDependencies,
    config: Partial<ChatCursorHandlerConfig> = {},
  ) {
    this.config = Object.freeze({
      ...DEFAULT_CHAT_CURSOR_HANDLER_CONFIG,
      ...config,
    });
    this.sessionRegistry = deps.sessionRegistry;
    this.backend = deps.backend;
    this.fanout = deps.fanout;
    this.metricsPort = deps.metrics;
    this.logger = deps.logger ?? NOOP_LOGGER;
    this.now = deps.clock ?? (() => Date.now());
  }

  public attachSocket(
    options: ChatCursorSocketAttachmentOptions,
  ): ChatCursorSocketBinding {
    const { socket, auth } = options;

    const onSetCursor = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'SET_CURSOR', payload));
    };

    const onSetSelection = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'SET_SELECTION', payload));
    };

    const onSetViewport = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'SET_VIEWPORT', payload));
    };

    const onClearCursor = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'CLEAR_CURSOR', payload));
    };

    const onPingCursor = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'PING_CURSOR', payload));
    };

    const onRequestRoomCursors = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'REQUEST_ROOM_CURSORS', payload));
    };

    const onRequestHistoryWindow = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'REQUEST_HISTORY_WINDOW', payload));
    };

    const onDisconnectHint = async (payload: unknown, ack?: (value: unknown) => void) => {
      ack?.(await this.handleTransportEvent(auth, socket.id, 'DISCONNECT_HINT', payload));
    };

    socket.on('chat:cursor:set', onSetCursor);
    socket.on('chat:cursor:set-selection', onSetSelection);
    socket.on('chat:cursor:set-viewport', onSetViewport);
    socket.on('chat:cursor:clear', onClearCursor);
    socket.on('chat:cursor:ping', onPingCursor);
    socket.on('chat:cursor:request-room-state', onRequestRoomCursors);
    socket.on('chat:cursor:request-history-window', onRequestHistoryWindow);
    socket.on('chat:cursor:disconnect-hint', onDisconnectHint);

    return {
      detach: () => {
        socket.off('chat:cursor:set', onSetCursor);
        socket.off('chat:cursor:set-selection', onSetSelection);
        socket.off('chat:cursor:set-viewport', onSetViewport);
        socket.off('chat:cursor:clear', onClearCursor);
        socket.off('chat:cursor:ping', onPingCursor);
        socket.off('chat:cursor:request-room-state', onRequestRoomCursors);
        socket.off('chat:cursor:request-history-window', onRequestHistoryWindow);
        socket.off('chat:cursor:disconnect-hint', onDisconnectHint);
      },
    };
  }

  public getMetricsSnapshot(): ChatCursorMetricsSnapshot {
    this.sweepExpiredLeases();
    return Object.freeze({
      totalReceived: this.totalReceived,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      totalRateLimited: this.totalRateLimited,
      totalHistoryRequests: this.totalHistoryRequests,
      totalFanouts: this.totalFanouts,
      activeLeaseCount: this.leasesByLeaseId.size,
      activeMirrorCount: this.mirrorsByCompositeKey.size,
      auditCount: this.auditTrail.length,
    });
  }

  public exportAuditTrail(): readonly ChatCursorAuditRecord[] {
    return Object.freeze([...this.auditTrail]);
  }

  public sweepExpiredLeases(): void {
    const now = this.now();
    const expired: ChatCursorLease[] = [];
    for (const lease of this.leasesByLeaseId.values()) {
      if (lease.expiresAt <= now) {
        expired.push(lease);
      }
    }

    for (const lease of expired) {
      this.deleteLeaseById(lease.leaseId);
      this.deleteMirror(lease.sessionId, lease.roomId, lease.channelId);
    }
  }

  public async handleTransportEvent(
    auth: ChatGatewayAuthContext,
    socketId: string,
    kind: ChatCursorEventKind,
    payload: unknown,
  ): Promise<ChatCursorAck> {
    this.totalReceived += 1;
    this.sweepExpiredLeases();

    const envelope = normalizeEnvelope(kind, payload, auth.namespace, this.config);
    const snapshot = this.resolveSessionSnapshot(auth);

    if (!snapshot) {
      return this.reject(envelope, null, 'NOT_ADMITTED');
    }

    if (!this.isSocketBound(snapshot, socketId)) {
      return this.reject(envelope, snapshot, 'SOCKET_MISMATCH');
    }

    if (!envelope.roomId && kind !== 'DISCONNECT_HINT') {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    if (envelope.roomId && this.config.requireRoomJoin && !this.isRoomJoined(snapshot, envelope.roomId)) {
      return this.reject(envelope, snapshot, 'ROOM_NOT_JOINED');
    }

    if (this.isCursorRestricted(snapshot)) {
      return this.reject(envelope, snapshot, 'CURSOR_RESTRICTED');
    }

    const rate = this.checkRateWindow(snapshot.sessionId, kind);
    if (!rate.accepted) {
      return this.reject(envelope, snapshot, 'RATE_LIMITED', rate.retryAfterMs);
    }

    switch (kind) {
      case 'SET_CURSOR':
        return this.handleSetCursor(auth, snapshot, socketId, envelope);
      case 'SET_SELECTION':
        return this.handleSetSelection(auth, snapshot, socketId, envelope);
      case 'SET_VIEWPORT':
        return this.handleSetViewport(auth, snapshot, socketId, envelope);
      case 'CLEAR_CURSOR':
        return this.handleClearCursor(auth, snapshot, socketId, envelope);
      case 'PING_CURSOR':
        return this.handlePingCursor(auth, snapshot, socketId, envelope);
      case 'REQUEST_ROOM_CURSORS':
        return this.handleRequestRoomCursors(auth, snapshot, socketId, envelope);
      case 'REQUEST_HISTORY_WINDOW':
        return this.handleRequestHistoryWindow(auth, snapshot, socketId, envelope);
      case 'DISCONNECT_HINT':
        return this.handleDisconnectHint(auth, snapshot, socketId, envelope);
      default:
        return this.reject(envelope, snapshot, 'UNSUPPORTED_KIND');
    }
  }

  private async handleSetCursor(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    const payload = envelope.cursorPayload;
    if (!payload || !envelope.roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const lease = this.buildLease(snapshot, socketId, envelope.roomId, envelope.channelId, payload.anchor, payload.range, null, payload.visibility, null, envelope.metadata);
    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.storeLease(lease);
    this.storeMirror(lease);
    await this.emitFanout(lease, result);
    return this.accept(envelope, snapshot, lease, result, null, null);
  }

  private async handleSetSelection(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    const payload = envelope.selectionPayload;
    if (!payload || !envelope.roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const lease = this.buildLease(snapshot, socketId, envelope.roomId, envelope.channelId, payload.anchor, payload.range, null, payload.visibility, payload.semanticLabel, envelope.metadata);
    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.storeLease(lease);
    this.storeMirror(lease);
    await this.emitFanout(lease, result);
    return this.accept(envelope, snapshot, lease, result, null, null);
  }

  private async handleSetViewport(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    const payload = envelope.viewportPayload;
    if (!payload || !envelope.roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const lease = this.buildLease(
      snapshot,
      socketId,
      envelope.roomId,
      envelope.channelId,
      payload.viewport.topAnchor,
      Object.freeze({ mode: 'CARET', startOffset: 0, endOffset: 0, caretBias: 'NONE' }),
      payload.viewport,
      'SUBTLE',
      null,
      envelope.metadata,
    );

    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.storeLease(lease);
    this.storeMirror(lease);
    await this.emitFanout(lease, result);
    return this.accept(envelope, snapshot, lease, result, null, null);
  }

  private async handleClearCursor(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    const roomId = envelope.roomId;
    if (!roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const mirror = this.findMirror(snapshot.sessionId, roomId, envelope.channelId);
    const lease = mirror
      ? this.rebuildLeaseFromMirror(mirror)
      : this.buildLease(
          snapshot,
          socketId,
          roomId,
          envelope.channelId,
          normalizeAnchor({ anchorKind: 'MESSAGE' }),
          Object.freeze({ mode: 'CARET', startOffset: 0, endOffset: 0, caretBias: 'NONE' }),
          null,
          'HIDDEN',
          null,
          envelope.metadata,
        );

    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.deleteLeaseById(lease.leaseId);
    this.deleteMirror(snapshot.sessionId, roomId, envelope.channelId);
    await this.emitFanout(lease, result);
    return this.accept(envelope, snapshot, lease, result, null, null);
  }

  private async handlePingCursor(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    const roomId = envelope.roomId;
    if (!roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const mirror = this.findMirror(snapshot.sessionId, roomId, envelope.channelId);
    if (!mirror) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const lease = Object.freeze({
      ...this.rebuildLeaseFromMirror(mirror),
      socketId,
      updatedAt: this.now(),
      expiresAt: this.now() + this.config.leaseTtlMs,
    });

    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.storeLease(lease);
    this.storeMirror(lease);
    await this.emitFanout(lease, result);
    return this.accept(envelope, snapshot, lease, result, null, null);
  }

  private async handleRequestRoomCursors(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    if (!this.config.allowRoomCursorRequests) {
      return this.reject(envelope, snapshot, 'REQUEST_NOT_ALLOWED');
    }

    const request = envelope.stateRequestPayload;
    if (!request) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const lease = this.buildLease(
      snapshot,
      socketId,
      request.roomId,
      request.channelId,
      normalizeAnchor({ anchorKind: 'MESSAGE' }),
      Object.freeze({ mode: 'CARET', startOffset: 0, endOffset: 0, caretBias: 'NONE' }),
      null,
      'SUBTLE',
      null,
      envelope.metadata,
    );

    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    const statePayload = result.statePayload ?? this.buildRoomCursorState(request);
    return this.accept(envelope, snapshot, null, result, statePayload, null);
  }

  private async handleRequestHistoryWindow(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    if (!this.config.allowHistoryRequests) {
      return this.reject(envelope, snapshot, 'HISTORY_NOT_ALLOWED');
    }

    const request = envelope.historyWindowRequestPayload;
    if (!request) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    this.totalHistoryRequests += 1;
    this.metricsPort?.recordHistoryRequest(request.roomId);

    const lease = this.buildLease(
      snapshot,
      socketId,
      request.roomId,
      request.channelId,
      request.anchor,
      Object.freeze({ mode: 'CARET', startOffset: 0, endOffset: 0, caretBias: 'NONE' }),
      null,
      'SUBTLE',
      null,
      envelope.metadata,
    );

    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    const historyPayload = result.historyPayload ?? Object.freeze({
      roomId: request.roomId,
      channelId: request.channelId,
      scope: request.scope,
      anchor: request.anchor,
      before: request.before,
      after: request.after,
      generatedAt: this.now(),
    });

    return this.accept(envelope, snapshot, null, result, null, historyPayload);
  }

  private async handleDisconnectHint(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
  ): Promise<ChatCursorAck> {
    const hint = envelope.disconnectHintPayload;
    const targets = hint.roomId
      ? this.listMirrorsForRoom(hint.roomId, hint.channelId)
      : this.listMirrorsForSession(snapshot.sessionId);

    const syntheticLease = this.buildLease(
      snapshot,
      socketId,
      hint.roomId ?? '__none__',
      hint.channelId,
      normalizeAnchor({ anchorKind: 'MESSAGE' }),
      Object.freeze({ mode: 'CARET', startOffset: 0, endOffset: 0, caretBias: 'NONE' }),
      null,
      'HIDDEN',
      null,
      envelope.metadata,
    );

    const result = await this.submitBackendEnvelope(auth, snapshot, socketId, envelope, syntheticLease);
    if (!result.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    for (const mirror of targets) {
      this.deleteLeaseById(mirror.leaseId);
      this.deleteMirror(mirror.sessionId, mirror.roomId, mirror.channelId);
    }

    return this.accept(envelope, snapshot, null, result, null, null);
  }

  private async submitBackendEnvelope(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatCursorEnvelope,
    lease: ChatCursorLease,
  ): Promise<ChatCursorBackendResult> {
    const payload = Object.freeze({
      cursorPayload: envelope.cursorPayload,
      selectionPayload: envelope.selectionPayload,
      viewportPayload: envelope.viewportPayload,
      stateRequestPayload: envelope.stateRequestPayload,
      historyWindowRequestPayload: envelope.historyWindowRequestPayload,
      disconnectHintPayload: envelope.disconnectHintPayload,
      lease,
      envelopeMetadata: envelope.metadata,
    });

    const backendEnvelope: ChatCursorBackendEnvelope = Object.freeze({
      backendEnvelopeId: randomUUID(),
      submittedAt: this.now(),
      namespace: auth.namespace,
      roomId: envelope.roomId ?? lease.roomId,
      channelId: envelope.channelId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      authLevel: snapshot.authLevel,
      socketId,
      kind: envelope.kind,
      leaseId: lease.leaseId,
      payloadHash: sha256(JSON.stringify(payload)),
      restrictions: Object.freeze(snapshot.restrictions.map((item) => item.code)),
      payload,
      transportMetadata: Object.freeze({
        authAuditId: auth.auditId,
        roomIdHint: auth.roomIdHint ?? null,
        sessionIdHint: auth.sessionIdHint ?? null,
      }),
    });

    try {
      return await this.backend.submitCursorEnvelope(backendEnvelope);
    } catch (error) {
      this.logger.error('chat.cursor.backend_submit_failed', {
        envelopeId: envelope.envelopeId,
        sessionId: snapshot.sessionId,
        roomId: envelope.roomId,
        error: error instanceof Error ? error.message : String(error),
      });

      return Object.freeze({
        accepted: false,
        backendEnvelopeId: backendEnvelope.backendEnvelopeId,
        roomId: backendEnvelope.roomId,
        channelId: backendEnvelope.channelId,
        state: 'REJECTED',
        reason: 'backend_exception',
        authoritativeLeaseId: null,
        expiresAt: null,
        echoPayload: null,
        statePayload: null,
        historyPayload: null,
        extraMetadata: Object.freeze({
          error: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }

  private async emitFanout(
    lease: ChatCursorLease,
    result: ChatCursorBackendResult,
  ): Promise<void> {
    const fanout: ChatCursorFanoutEnvelope = Object.freeze({
      fanoutId: randomUUID(),
      roomId: lease.roomId,
      channelId: lease.channelId,
      emittedAt: this.now(),
      fromUserId: lease.userId,
      fromUsername: lease.username,
      leaseId: result.authoritativeLeaseId ?? lease.leaseId,
      payload: Object.freeze({
        anchor: lease.anchor,
        range: lease.range,
        viewport: lease.viewport,
        visibility: lease.visibility,
        semanticLabel: lease.semanticLabel,
        echoPayload: result.echoPayload,
      }),
    });

    await this.fanout.fanout(fanout);
    this.totalFanouts += 1;
  }

  private resolveSessionSnapshot(
    auth: ChatGatewayAuthContext,
  ): ChatSessionAuthoritySnapshot | null {
    const sessionId = this.extractSessionId(auth);
    if (sessionId) {
      const direct = this.sessionRegistry.getAuthoritySnapshot(sessionId);
      if (direct && direct.userId === auth.userId) {
        return direct;
      }
    }

    const candidates = this.sessionRegistry.listAuthoritySnapshotsForUser(auth.userId);
    if (sessionId) {
      const exact = candidates.find((item) => item.sessionId === sessionId);
      if (exact) {
        return exact;
      }
    }

    return candidates[0] ?? null;
  }

  private extractSessionId(auth: ChatGatewayAuthContext): string | null {
    const record = auth as unknown as Record<string, unknown>;
    return asString(record.sessionId) ?? auth.sessionIdHint ?? null;
  }

  private isSocketBound(snapshot: ChatSessionAuthoritySnapshot, socketId: string): boolean {
    return snapshot.socketIds.includes(socketId);
  }

  private isRoomJoined(snapshot: ChatSessionAuthoritySnapshot, roomId: string): boolean {
    return snapshot.roomIds.includes(roomId);
  }

  private isCursorRestricted(snapshot: ChatSessionAuthoritySnapshot): boolean {
    const now = this.now();
    if (snapshot.terminatedAt) {
      return true;
    }
    if (snapshot.mutedUntil && snapshot.mutedUntil > now) {
      return true;
    }
    if (snapshot.quarantinedUntil && snapshot.quarantinedUntil > now) {
      return true;
    }
    if (snapshot.suspendedUntil && snapshot.suspendedUntil > now) {
      return true;
    }

    return snapshot.restrictions.some((restriction) => {
      const code = restriction.code.toUpperCase();
      return code.includes('CURSOR') || code.includes('CHAT') || code.includes('READ_ONLY');
    });
  }

  private checkRateWindow(
    sessionId: string,
    kind: ChatCursorEventKind,
  ): { accepted: true } | { accepted: false; retryAfterMs: number } {
    const now = this.now();
    const window = this.rateWindowsBySessionId.get(sessionId);
    const isRequest = kind === 'REQUEST_ROOM_CURSORS' || kind === 'REQUEST_HISTORY_WINDOW';

    if (!window || now - window.windowStartedAt > this.config.eventRateWindowMs) {
      this.rateWindowsBySessionId.set(sessionId, {
        windowStartedAt: now,
        eventCount: 1,
        requestCount: isRequest ? 1 : 0,
      });
      return { accepted: true };
    }

    const nextEventCount = window.eventCount + 1;
    const nextRequestCount = window.requestCount + (isRequest ? 1 : 0);

    if (nextEventCount > this.config.maxEventsPerWindow || nextRequestCount > this.config.maxRequestsPerWindow) {
      return {
        accepted: false,
        retryAfterMs: Math.max(250, this.config.eventRateWindowMs - (now - window.windowStartedAt)),
      };
    }

    this.rateWindowsBySessionId.set(sessionId, {
      windowStartedAt: window.windowStartedAt,
      eventCount: nextEventCount,
      requestCount: nextRequestCount,
    });
    return { accepted: true };
  }

  private compositeKey(sessionId: string, roomId: string, channelId: string | null): string {
    return `${sessionId}::${roomId}::${channelId ?? '__null__'}`;
  }

  private buildLease(
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    roomId: string,
    channelId: string | null,
    anchor: ChatCursorAnchor,
    range: ChatCursorRange,
    viewport: ChatCursorViewport | null,
    visibility: ChatCursorVisibility,
    semanticLabel: string | null,
    metadata: Readonly<Record<string, unknown>>,
  ): ChatCursorLease {
    const now = this.now();
    const existing = this.findMirror(snapshot.sessionId, roomId, channelId);
    return Object.freeze({
      leaseId: existing?.leaseId ?? randomUUID(),
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId,
      channelId,
      anchor,
      range,
      viewport,
      visibility,
      semanticLabel,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: now + this.config.leaseTtlMs,
      metadata,
    });
  }

  private storeLease(lease: ChatCursorLease): void {
    this.leasesByLeaseId.set(lease.leaseId, lease);
  }

  private deleteLeaseById(leaseId: string): void {
    this.leasesByLeaseId.delete(leaseId);
  }

  private storeMirror(lease: ChatCursorLease): void {
    const record: ChatCursorMirrorRecord = Object.freeze({
      sessionId: lease.sessionId,
      userId: lease.userId,
      username: lease.username,
      socketId: lease.socketId,
      roomId: lease.roomId,
      channelId: lease.channelId,
      anchor: lease.anchor,
      range: lease.range,
      viewport: lease.viewport,
      visibility: lease.visibility,
      semanticLabel: lease.semanticLabel,
      leaseId: lease.leaseId,
      createdAt: lease.createdAt,
      updatedAt: lease.updatedAt,
      expiresAt: lease.expiresAt,
      metadata: lease.metadata,
    });

    this.mirrorsByCompositeKey.set(
      this.compositeKey(lease.sessionId, lease.roomId, lease.channelId),
      record,
    );
  }

  private deleteMirror(sessionId: string, roomId: string, channelId: string | null): void {
    this.mirrorsByCompositeKey.delete(this.compositeKey(sessionId, roomId, channelId));
  }

  private findMirror(sessionId: string, roomId: string, channelId: string | null): ChatCursorMirrorRecord | null {
    return this.mirrorsByCompositeKey.get(this.compositeKey(sessionId, roomId, channelId)) ?? null;
  }

  private listMirrorsForRoom(roomId: string, channelId: string | null): ChatCursorMirrorRecord[] {
    const items: ChatCursorMirrorRecord[] = [];
    for (const mirror of this.mirrorsByCompositeKey.values()) {
      if (mirror.roomId === roomId && mirror.channelId === channelId) {
        items.push(mirror);
      }
    }
    return items;
  }

  private listMirrorsForSession(sessionId: string): ChatCursorMirrorRecord[] {
    const items: ChatCursorMirrorRecord[] = [];
    for (const mirror of this.mirrorsByCompositeKey.values()) {
      if (mirror.sessionId === sessionId) {
        items.push(mirror);
      }
    }
    return items;
  }

  private rebuildLeaseFromMirror(mirror: ChatCursorMirrorRecord): ChatCursorLease {
    return Object.freeze({
      leaseId: mirror.leaseId,
      sessionId: mirror.sessionId,
      userId: mirror.userId,
      username: mirror.username,
      socketId: mirror.socketId,
      roomId: mirror.roomId,
      channelId: mirror.channelId,
      anchor: mirror.anchor,
      range: mirror.range,
      viewport: mirror.viewport,
      visibility: mirror.visibility,
      semanticLabel: mirror.semanticLabel,
      createdAt: mirror.createdAt,
      updatedAt: mirror.updatedAt,
      expiresAt: mirror.expiresAt,
      metadata: mirror.metadata,
    });
  }

  private buildRoomCursorState(
    request: ChatCursorStateRequestPayload,
  ): Readonly<Record<string, unknown>> {
    const items = this.listMirrorsForRoom(request.roomId, request.channelId).map((mirror) =>
      Object.freeze({
        sessionId: mirror.sessionId,
        userId: mirror.userId,
        username: mirror.username,
        roomId: mirror.roomId,
        channelId: mirror.channelId,
        anchor: mirror.anchor,
        range: request.includeSelections ? mirror.range : null,
        viewport: request.includeViewport ? mirror.viewport : null,
        visibility: mirror.visibility,
        semanticLabel: request.includeSelections ? mirror.semanticLabel : null,
        updatedAt: mirror.updatedAt,
        expiresAt: mirror.expiresAt,
      }),
    );

    return Object.freeze({
      roomId: request.roomId,
      channelId: request.channelId,
      generatedAt: this.now(),
      items,
    });
  }

  private accept(
    envelope: ChatCursorEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
    lease: ChatCursorLease | null,
    result: ChatCursorBackendResult,
    statePayload: Readonly<Record<string, unknown>> | null,
    historyPayload: Readonly<Record<string, unknown>> | null,
  ): ChatCursorAck {
    this.totalAccepted += 1;
    this.metricsPort?.recordAccepted(envelope.kind, envelope.roomId);

    const ack: ChatCursorAck = Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: result.state,
      reason: null,
      leaseId: result.authoritativeLeaseId ?? lease?.leaseId ?? null,
      retryAfterMs: null,
      expiresAt: result.expiresAt ?? lease?.expiresAt ?? null,
      statePayload: statePayload ?? result.statePayload,
      historyPayload: historyPayload ?? result.historyPayload,
      issuedAt: this.now(),
      metadata: Object.freeze({
        backendEnvelopeId: result.backendEnvelopeId,
        backendReason: result.reason,
        extraMetadata: result.extraMetadata,
      }),
    });

    this.recordAudit(envelope, snapshot, ack.state, null, ack.leaseId, ack.metadata);
    return ack;
  }

  private reject(
    envelope: ChatCursorEnvelope,
    snapshot: ChatSessionAuthoritySnapshot | null,
    reason: ChatCursorRejectReason,
    retryAfterMs: number | null = null,
  ): ChatCursorAck {
    this.totalRejected += 1;
    if (reason === 'RATE_LIMITED') {
      this.totalRateLimited += 1;
      this.metricsPort?.recordRateLimited(envelope.kind, envelope.roomId);
    } else {
      this.metricsPort?.recordRejected(envelope.kind, reason, envelope.roomId);
    }

    const ack: ChatCursorAck = Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: reason === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'REJECTED',
      reason,
      leaseId: null,
      retryAfterMs,
      expiresAt: null,
      statePayload: null,
      historyPayload: null,
      issuedAt: this.now(),
      metadata: Object.freeze({
        kind: envelope.kind,
        namespace: envelope.namespace,
      }),
    });

    this.recordAudit(envelope, snapshot, ack.state, reason, null, ack.metadata);
    return ack;
  }

  private recordAudit(
    envelope: ChatCursorEnvelope,
    snapshot: ChatSessionAuthoritySnapshot | null,
    state: ChatCursorAckState,
    reason: ChatCursorRejectReason | null,
    leaseId: string | null,
    metadata: Readonly<Record<string, unknown>>,
  ): void {
    const record: ChatCursorAuditRecord = Object.freeze({
      auditId: randomUUID(),
      envelopeId: envelope.envelopeId,
      kind: envelope.kind,
      sessionId: snapshot?.sessionId ?? null,
      userId: snapshot?.userId ?? 'unknown',
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state,
      reason,
      leaseId,
      createdAt: this.now(),
      metadata,
    });

    this.auditTrail.push(record);
    if (this.auditTrail.length > this.config.auditLimit) {
      this.auditTrail.splice(0, this.auditTrail.length - this.config.auditLimit);
    }
  }
}
