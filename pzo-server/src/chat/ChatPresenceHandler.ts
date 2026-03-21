
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT PRESENCE HANDLER
 * FILE: pzo-server/src/chat/ChatPresenceHandler.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file extracts live presence ingress out of ChatGateway so room presence,
 * visibility posture, away/idle status, heartbeat cadence, and room occupancy
 * fanout stop leaking into the gateway layer.
 *
 * Transport doctrine
 * ------------------
 * - This file is transport authority for presence intent normalization only.
 * - It may manage leases, heartbeats, and ephemeral transport-local mirrors.
 * - It may NOT become backend room truth.
 * - It may NOT become transcript truth.
 * - It may NOT decide moderation truth.
 * - It forwards normalized presence intent to backend chat authority and
 *   prepares transport fanout payloads once the backend accepts them.
 *
 * Relationship to sibling files
 * -----------------------------
 * - ChatConnectionAuth.ts decides whether a client may connect and what
 *   connection-level restrictions exist.
 * - ChatSessionRegistry.ts decides whether a live transport session is
 *   admitted, read-only, quarantined, suspended, or terminated.
 * - ChatMessageHandler.ts owns message ingress, dedupe, and message transport
 *   acknowledgements.
 * - ChatTypingHandler.ts will later own typing theater and typing cadence.
 * - ChatRoomRegistry.ts remains low-level room/socket membership authority.
 * - backend/src/game/engine/chat/ChatPresenceState.ts remains authoritative
 *   presence truth.
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

export type ChatPresenceRoomId = string;
export type ChatPresenceChannelId = string;
export type ChatPresenceLeaseId = string;
export type ChatPresenceEnvelopeId = string;
export type ChatPresenceCursor = string;
export type ChatPresenceVisibility =
  | 'VISIBLE'
  | 'HIDDEN'
  | 'SHADOW'
  | 'SPECTATOR_ONLY';

export type ChatPresenceActivityState =
  | 'ACTIVE'
  | 'IDLE'
  | 'AWAY'
  | 'BACKGROUND'
  | 'INACTIVE'
  | 'DISCONNECTED';

export type ChatPresenceRole =
  | 'PLAYER'
  | 'SPECTATOR'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'MODERATOR';

export type ChatPresenceEventKind =
  | 'PANEL_OPENED'
  | 'PANEL_CLOSED'
  | 'ROOM_JOIN_VISIBLE'
  | 'ROOM_LEAVE_VISIBLE'
  | 'SET_ACTIVITY'
  | 'SET_VISIBILITY'
  | 'SET_SPECTATING'
  | 'HEARTBEAT'
  | 'SYNC_ROOM_CURSOR'
  | 'REQUEST_OCCUPANCY'
  | 'CLEAR_ROOM_STATE'
  | 'DISCONNECT_HINT';

export type ChatPresenceAckState =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'RATE_LIMITED'
  | 'QUARANTINED';

export type ChatPresenceRejectReason =
  | 'NOT_ADMITTED'
  | 'SESSION_NOT_FOUND'
  | 'ROOM_NOT_JOINED'
  | 'ROOM_NOT_ALLOWED'
  | 'VISIBILITY_NOT_ALLOWED'
  | 'PRESENCE_RESTRICTED'
  | 'RATE_LIMITED'
  | 'SOCKET_MISMATCH'
  | 'MALFORMED_PAYLOAD'
  | 'BACKEND_UNAVAILABLE'
  | 'UNSUPPORTED_KIND'
  | 'CURSOR_NOT_ALLOWED'
  | 'HEARTBEAT_TOO_FAST'
  | 'OCCUPANCY_NOT_ALLOWED'
  | 'UNKNOWN';

export interface ChatPresenceRoomPointer {
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly modeId: string | null;
  readonly runId: string | null;
  readonly partyId: string | null;
  readonly mountTarget: string | null;
}

export interface ChatPresenceActivityPayload {
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly state: ChatPresenceActivityState;
  readonly visible: boolean;
  readonly cursor: ChatPresenceCursor | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceVisibilityPayload {
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly visibility: ChatPresenceVisibility;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceSpectatingPayload {
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly spectating: boolean;
  readonly targetUserId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceHeartbeatPayload {
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly activityState: ChatPresenceActivityState | null;
  readonly visibility: ChatPresenceVisibility | null;
  readonly cursor: ChatPresenceCursor | null;
  readonly panelOpen: boolean | null;
  readonly timestamp: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceOccupancyRequestPayload {
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly includeInvisible: boolean;
  readonly includeRoleBreakdown: boolean;
  readonly includeIdleBreakdown: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceCursorPayload {
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly cursor: ChatPresenceCursor;
  readonly timestamp: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceEnvelope {
  readonly envelopeId: ChatPresenceEnvelopeId;
  readonly kind: ChatPresenceEventKind;
  readonly namespace: string;
  readonly issuedAt: number;
  readonly roomId: ChatPresenceRoomId | null;
  readonly channelId: ChatPresenceChannelId | null;
  readonly activity: ChatPresenceActivityPayload | null;
  readonly visibility: ChatPresenceVisibilityPayload | null;
  readonly spectating: ChatPresenceSpectatingPayload | null;
  readonly heartbeat: ChatPresenceHeartbeatPayload | null;
  readonly occupancyRequest: ChatPresenceOccupancyRequestPayload | null;
  readonly cursorSync: ChatPresenceCursorPayload | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceLease {
  readonly leaseId: ChatPresenceLeaseId;
  readonly sessionId: string;
  readonly userId: string;
  readonly username: string;
  readonly socketId: string;
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly activityState: ChatPresenceActivityState;
  readonly visibility: ChatPresenceVisibility;
  readonly panelOpen: boolean;
  readonly spectating: boolean;
  readonly targetUserId: string | null;
  readonly cursor: ChatPresenceCursor | null;
  readonly role: ChatPresenceRole;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceMirrorRecord {
  readonly sessionId: string;
  readonly userId: string;
  readonly username: string;
  readonly socketId: string;
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly activityState: ChatPresenceActivityState;
  readonly visibility: ChatPresenceVisibility;
  readonly panelOpen: boolean;
  readonly spectating: boolean;
  readonly targetUserId: string | null;
  readonly role: ChatPresenceRole;
  readonly cursor: ChatPresenceCursor | null;
  readonly lastHeartbeatAt: number | null;
  readonly lastActivityAt: number;
  readonly lastOccupancyRequestAt: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceBackendEnvelope {
  readonly backendEnvelopeId: string;
  readonly submittedAt: number;
  readonly namespace: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly username: string;
  readonly authLevel: string;
  readonly socketId: string;
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly kind: ChatPresenceEventKind;
  readonly restrictions: readonly ChatConnectionRestrictionCode[];
  readonly payloadHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly transportMetadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceBackendResult {
  readonly accepted: boolean;
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly state: ChatPresenceAckState;
  readonly occupancySnapshot: Readonly<Record<string, unknown>> | null;
  readonly fanoutPayload: Readonly<Record<string, unknown>> | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceAck {
  readonly ackId: string;
  readonly envelopeId: ChatPresenceEnvelopeId;
  readonly roomId: ChatPresenceRoomId | null;
  readonly channelId: ChatPresenceChannelId | null;
  readonly state: ChatPresenceAckState;
  readonly reason: ChatPresenceRejectReason | null;
  readonly issuedAt: number;
  readonly retryAfterMs: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceFanoutEnvelope {
  readonly event: string;
  readonly roomId: ChatPresenceRoomId;
  readonly channelId: ChatPresenceChannelId | null;
  readonly targets: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceAuditRecord {
  readonly auditId: string;
  readonly recordedAt: number;
  readonly envelopeId: ChatPresenceEnvelopeId;
  readonly namespace: string;
  readonly socketId: string;
  readonly sessionId: string | null;
  readonly userId: string | null;
  readonly username: string | null;
  readonly roomId: ChatPresenceRoomId | null;
  readonly channelId: ChatPresenceChannelId | null;
  readonly kind: ChatPresenceEventKind;
  readonly accepted: boolean;
  readonly state: ChatPresenceAckState;
  readonly reason: ChatPresenceRejectReason | null;
  readonly payloadHash: string;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceHandlerConfig {
  readonly leaseTtlMs: number;
  readonly heartbeatMinIntervalMs: number;
  readonly heartbeatGraceMs: number;
  readonly occupancyRequestMinIntervalMs: number;
  readonly activityWindowMs: number;
  readonly auditLimit: number;
  readonly allowHiddenVisibility: boolean;
  readonly allowShadowVisibility: boolean;
  readonly allowSpectating: boolean;
  readonly allowCursorSync: boolean;
  readonly allowOccupancyRequests: boolean;
  readonly requireRoomJoinForVisiblePresence: boolean;
  readonly requireRoomJoinForHeartbeat: boolean;
  readonly roomPresenceRateWindowMs: number;
  readonly maxPresenceEventsPerWindow: number;
}

export interface ChatPresenceHandlerDependencies {
  readonly sessionRegistry: ChatSessionRegistry;
  readonly backend: ChatPresenceBackendPort;
  readonly fanout: ChatPresenceFanoutPort;
  readonly metrics?: ChatPresenceMetricsPort;
  readonly clock?: () => number;
  readonly logger?: ChatPresenceLogger;
}

export interface ChatPresenceLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface ChatPresenceBackendPort {
  submitPresenceEnvelope(
    envelope: ChatPresenceBackendEnvelope,
  ): Promise<ChatPresenceBackendResult>;
}

export interface ChatPresenceFanoutPort {
  fanout(envelope: ChatPresenceFanoutEnvelope): Promise<void> | void;
}

export interface ChatPresenceMetricsPort {
  recordAccepted(kind: ChatPresenceEventKind, roomId: string | null): void;
  recordRejected(kind: ChatPresenceEventKind, reason: ChatPresenceRejectReason, roomId: string | null): void;
  recordRateLimited(kind: ChatPresenceEventKind, roomId: string | null): void;
  recordHeartbeat(roomId: string | null): void;
  recordOccupancyRequest(roomId: string | null): void;
}

export interface ChatPresenceSocketAttachmentOptions {
  readonly socket: Socket;
  readonly auth: ChatGatewayAuthContext;
}

export interface ChatPresenceSocketBinding {
  detach(): void;
}

export interface ChatPresenceMetricsSnapshot {
  readonly totalReceived: number;
  readonly totalAccepted: number;
  readonly totalRejected: number;
  readonly totalRateLimited: number;
  readonly totalHeartbeats: number;
  readonly totalOccupancyRequests: number;
  readonly totalFanouts: number;
  readonly activeLeaseCount: number;
  readonly activeMirrorCount: number;
  readonly auditCount: number;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_CHAT_PRESENCE_HANDLER_CONFIG: ChatPresenceHandlerConfig = {
  leaseTtlMs: 60_000,
  heartbeatMinIntervalMs: 2_000,
  heartbeatGraceMs: 12_000,
  occupancyRequestMinIntervalMs: 2_500,
  activityWindowMs: 30_000,
  auditLimit: 2_500,
  allowHiddenVisibility: true,
  allowShadowVisibility: false,
  allowSpectating: true,
  allowCursorSync: false,
  allowOccupancyRequests: true,
  requireRoomJoinForVisiblePresence: true,
  requireRoomJoinForHeartbeat: true,
  roomPresenceRateWindowMs: 12_000,
  maxPresenceEventsPerWindow: 30,
};

const NOOP_LOGGER: ChatPresenceLogger = {
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
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function toMetadata(
  value: unknown,
): Readonly<Record<string, unknown>> {
  return Object.freeze(isRecord(value) ? { ...value } : {});
}

// ============================================================================
// MARK: Normalization
// ============================================================================

function normalizeActivityPayload(input: unknown): ChatPresenceActivityPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  const state = asString(input.state) as ChatPresenceActivityState | null;

  if (!roomId || !state) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    state,
    visible: asBoolean(input.visible) ?? true,
    cursor: asString(input.cursor),
    metadata: toMetadata(input.metadata),
  });
}

function normalizeVisibilityPayload(input: unknown): ChatPresenceVisibilityPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  const visibility = asString(input.visibility) as ChatPresenceVisibility | null;
  if (!roomId || !visibility) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    visibility,
    metadata: toMetadata(input.metadata),
  });
}

function normalizeSpectatingPayload(input: unknown): ChatPresenceSpectatingPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  const spectating = asBoolean(input.spectating);
  if (!roomId || spectating === null) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    spectating,
    targetUserId: asString(input.targetUserId),
    metadata: toMetadata(input.metadata),
  });
}

function normalizeHeartbeatPayload(input: unknown): ChatPresenceHeartbeatPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    activityState: asString(input.activityState) as ChatPresenceActivityState | null,
    visibility: asString(input.visibility) as ChatPresenceVisibility | null,
    cursor: asString(input.cursor),
    panelOpen: asBoolean(input.panelOpen),
    timestamp: asNumber(input.timestamp) ?? Date.now(),
    metadata: toMetadata(input.metadata),
  });
}

function normalizeOccupancyRequestPayload(input: unknown): ChatPresenceOccupancyRequestPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  const roomId = asString(input.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(input.channelId),
    includeInvisible: asBoolean(input.includeInvisible) ?? false,
    includeRoleBreakdown: asBoolean(input.includeRoleBreakdown) ?? false,
    includeIdleBreakdown: asBoolean(input.includeIdleBreakdown) ?? false,
    metadata: toMetadata(input.metadata),
  });
}

function normalizeCursorPayload(input: unknown): ChatPresenceCursorPayload | null {
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
    metadata: toMetadata(input.metadata),
  });
}

function normalizeEnvelope(
  kind: ChatPresenceEventKind,
  payload: unknown,
  namespace: string,
): ChatPresenceEnvelope {
  const record = isRecord(payload) ? payload : {};

  const activity = normalizeActivityPayload(record.activity ?? record);
  const visibility = normalizeVisibilityPayload(record.visibility ?? record);
  const spectating = normalizeSpectatingPayload(record.spectating ?? record);
  const heartbeat = normalizeHeartbeatPayload(record.heartbeat ?? record);
  const occupancyRequest = normalizeOccupancyRequestPayload(record.occupancyRequest ?? record);
  const cursorSync = normalizeCursorPayload(record.cursorSync ?? record);

  const roomId =
    asString(record.roomId) ??
    activity?.roomId ??
    visibility?.roomId ??
    spectating?.roomId ??
    heartbeat?.roomId ??
    occupancyRequest?.roomId ??
    cursorSync?.roomId ??
    null;

  const channelId =
    asString(record.channelId) ??
    activity?.channelId ??
    visibility?.channelId ??
    spectating?.channelId ??
    heartbeat?.channelId ??
    occupancyRequest?.channelId ??
    cursorSync?.channelId ??
    null;

  return Object.freeze({
    envelopeId: asString(record.envelopeId) ?? randomUUID(),
    kind,
    namespace,
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    roomId,
    channelId,
    activity,
    visibility,
    spectating,
    heartbeat,
    occupancyRequest,
    cursorSync,
    metadata: toMetadata(record.metadata),
  });
}

// ============================================================================
// MARK: Main handler
// ============================================================================

export class ChatPresenceHandler {
  private readonly config: ChatPresenceHandlerConfig;
  private readonly sessionRegistry: ChatSessionRegistry;
  private readonly backend: ChatPresenceBackendPort;
  private readonly fanout: ChatPresenceFanoutPort;
  private readonly metricsPort?: ChatPresenceMetricsPort;
  private readonly logger: ChatPresenceLogger;
  private readonly now: () => number;

  private readonly leasesBySessionRoom = new Map<string, ChatPresenceLease>();
  private readonly mirrorsBySessionRoom = new Map<string, ChatPresenceMirrorRecord>();
  private readonly roomEventWindows = new Map<string, { startedAt: number; count: number }>();
  private readonly occupancyRequestAtBySessionRoom = new Map<string, number>();
  private readonly auditTrail: ChatPresenceAuditRecord[] = [];

  private totalReceived = 0;
  private totalAccepted = 0;
  private totalRejected = 0;
  private totalRateLimited = 0;
  private totalHeartbeats = 0;
  private totalOccupancyRequests = 0;
  private totalFanouts = 0;

  public constructor(
    deps: ChatPresenceHandlerDependencies,
    config: Partial<ChatPresenceHandlerConfig> = {},
  ) {
    this.config = Object.freeze({
      ...DEFAULT_CHAT_PRESENCE_HANDLER_CONFIG,
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
    options: ChatPresenceSocketAttachmentOptions,
  ): ChatPresenceSocketBinding {
    const { socket, auth } = options;

    const onPanelOpened = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'PANEL_OPENED', payload);
      ack?.(result);
    };

    const onPanelClosed = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'PANEL_CLOSED', payload);
      ack?.(result);
    };

    const onRoomJoinVisible = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'ROOM_JOIN_VISIBLE', payload);
      ack?.(result);
    };

    const onRoomLeaveVisible = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'ROOM_LEAVE_VISIBLE', payload);
      ack?.(result);
    };

    const onSetActivity = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'SET_ACTIVITY', payload);
      ack?.(result);
    };

    const onSetVisibility = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'SET_VISIBILITY', payload);
      ack?.(result);
    };

    const onSetSpectating = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'SET_SPECTATING', payload);
      ack?.(result);
    };

    const onHeartbeat = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'HEARTBEAT', payload);
      ack?.(result);
    };

    const onCursorSync = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'SYNC_ROOM_CURSOR', payload);
      ack?.(result);
    };

    const onRequestOccupancy = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'REQUEST_OCCUPANCY', payload);
      ack?.(result);
    };

    const onClearRoomState = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'CLEAR_ROOM_STATE', payload);
      ack?.(result);
    };

    const onDisconnectHint = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'DISCONNECT_HINT', payload);
      ack?.(result);
    };

    socket.on('chat:presence:panel-opened', onPanelOpened);
    socket.on('chat:presence:panel-closed', onPanelClosed);
    socket.on('chat:presence:room-join-visible', onRoomJoinVisible);
    socket.on('chat:presence:room-leave-visible', onRoomLeaveVisible);
    socket.on('chat:presence:set-activity', onSetActivity);
    socket.on('chat:presence:set-visibility', onSetVisibility);
    socket.on('chat:presence:set-spectating', onSetSpectating);
    socket.on('chat:presence:heartbeat', onHeartbeat);
    socket.on('chat:presence:cursor-sync', onCursorSync);
    socket.on('chat:presence:request-occupancy', onRequestOccupancy);
    socket.on('chat:presence:clear-room-state', onClearRoomState);
    socket.on('chat:presence:disconnect-hint', onDisconnectHint);

    return {
      detach: () => {
        socket.off('chat:presence:panel-opened', onPanelOpened);
        socket.off('chat:presence:panel-closed', onPanelClosed);
        socket.off('chat:presence:room-join-visible', onRoomJoinVisible);
        socket.off('chat:presence:room-leave-visible', onRoomLeaveVisible);
        socket.off('chat:presence:set-activity', onSetActivity);
        socket.off('chat:presence:set-visibility', onSetVisibility);
        socket.off('chat:presence:set-spectating', onSetSpectating);
        socket.off('chat:presence:heartbeat', onHeartbeat);
        socket.off('chat:presence:cursor-sync', onCursorSync);
        socket.off('chat:presence:request-occupancy', onRequestOccupancy);
        socket.off('chat:presence:clear-room-state', onClearRoomState);
        socket.off('chat:presence:disconnect-hint', onDisconnectHint);
      },
    };
  }

  // ==========================================================================
  // MARK: Public ingress
  // ==========================================================================

  public async handleTransportEvent(
    auth: ChatGatewayAuthContext,
    socketId: string,
    kind: ChatPresenceEventKind,
    payload: unknown,
  ): Promise<ChatPresenceAck | ChatPresenceBackendResult> {
    const now = this.now();
    this.prune(now);
    this.totalReceived += 1;

    const envelope = normalizeEnvelope(kind, payload, auth.namespace);
    const snapshot = this.resolveSessionSnapshot(auth);
    if (!snapshot) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'SESSION_NOT_FOUND',
        'No admitted transport session matched the presence auth context.',
      );
    }

    if (!snapshot.socketIds.includes(socketId)) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'SOCKET_MISMATCH',
        'Transport socket is not attached to this admitted presence session.',
        snapshot,
      );
    }

    const restrictionReason = this.checkRestrictions(auth, envelope, snapshot);
    if (restrictionReason) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        restrictionReason,
        `Presence transport restriction blocked ${kind}.`,
        snapshot,
      );
    }

    switch (kind) {
      case 'PANEL_OPENED':
      case 'PANEL_CLOSED':
      case 'ROOM_JOIN_VISIBLE':
      case 'ROOM_LEAVE_VISIBLE':
      case 'SET_ACTIVITY':
      case 'SET_VISIBILITY':
      case 'SET_SPECTATING':
      case 'CLEAR_ROOM_STATE':
      case 'DISCONNECT_HINT':
        return this.handlePresenceMutation(auth, socketId, envelope, snapshot);
      case 'HEARTBEAT':
        return this.handleHeartbeat(auth, socketId, envelope, snapshot);
      case 'SYNC_ROOM_CURSOR':
        return this.handleCursorSync(auth, socketId, envelope, snapshot);
      case 'REQUEST_OCCUPANCY':
        return this.handleOccupancyRequest(auth, socketId, envelope, snapshot);
      default:
        return this.rejectEnvelope(
          auth,
          socketId,
          envelope,
          'UNSUPPORTED_KIND',
          `Unsupported presence handler kind: ${kind}.`,
          snapshot,
        );
    }
  }

  // ==========================================================================
  // MARK: Mutation flows
  // ==========================================================================

  private async handlePresenceMutation(
    auth: ChatGatewayAuthContext,
    socketId: string,
    envelope: ChatPresenceEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatPresenceAck> {
    const roomId =
      envelope.roomId ??
      envelope.activity?.roomId ??
      envelope.visibility?.roomId ??
      envelope.spectating?.roomId ??
      envelope.heartbeat?.roomId ??
      envelope.cursorSync?.roomId ??
      envelope.occupancyRequest?.roomId;

    if (!roomId) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'Presence mutation requires a roomId.',
        snapshot,
      );
    }

    if (
      this.config.requireRoomJoinForVisiblePresence &&
      !snapshot.roomIds.includes(roomId) &&
      envelope.kind !== 'PANEL_OPENED' &&
      envelope.kind !== 'PANEL_CLOSED'
    ) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'ROOM_NOT_JOINED',
        'Presence mutation requires the session to be joined to the room.',
        snapshot,
      );
    }

    const rate = this.consumeRoomEventWindow(snapshot.sessionId, roomId);
    if (!rate.allowed) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'RATE_LIMITED',
        'Presence rate window rejected the mutation.',
        snapshot,
        rate.retryAfterMs,
      );
    }

    const nextMirror = this.computeNextMirror(snapshot, socketId, envelope);
    const nextLease = this.computeLease(snapshot, nextMirror);
    this.persistMirror(nextMirror);
    this.persistLease(nextLease);

    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      socketId,
      envelope,
      roomId,
      nextMirror.channelId,
      {
        mirror: nextMirror,
        lease: nextLease,
      },
    );

    try {
      const result = await this.backend.submitPresenceEnvelope(backendEnvelope);
      if (result.accepted) {
        this.totalAccepted += 1;
        this.metricsPort?.recordAccepted(envelope.kind, roomId);
        if (result.fanoutPayload) {
          await this.fanoutPresence(roomId, nextMirror.channelId, result.fanoutPayload);
        }
      } else {
        this.totalRejected += 1;
        this.metricsPort?.recordRejected(envelope.kind, 'UNKNOWN', roomId);
      }

      const ack = Object.freeze({
        ackId: randomUUID(),
        envelopeId: envelope.envelopeId,
        roomId,
        channelId: nextMirror.channelId,
        state: result.state,
        reason: result.accepted ? null : 'UNKNOWN',
        issuedAt: this.now(),
        retryAfterMs: null,
        metadata: Object.freeze({
          backendReason: result.reason,
          backendMetadata: result.metadata,
        }),
      }) satisfies ChatPresenceAck;

      this.recordAudit(auth, socketId, envelope, snapshot, ack, backendEnvelope.payloadHash);
      return ack;
    } catch (error) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend presence mutation failed.',
        snapshot,
      );
    }
  }

  private async handleHeartbeat(
    auth: ChatGatewayAuthContext,
    socketId: string,
    envelope: ChatPresenceEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatPresenceAck> {
    const payload = envelope.heartbeat;
    if (!payload) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'Heartbeat event requires a normalized heartbeat payload.',
        snapshot,
      );
    }

    if (this.config.requireRoomJoinForHeartbeat && !snapshot.roomIds.includes(payload.roomId)) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'ROOM_NOT_JOINED',
        'Heartbeat rejected because the session is not joined to the room.',
        snapshot,
      );
    }

    const key = this.key(snapshot.sessionId, payload.roomId, payload.channelId);
    const existingMirror = this.mirrorsBySessionRoom.get(key);
    const now = this.now();

    if (
      existingMirror &&
      existingMirror.lastHeartbeatAt !== null &&
      now - existingMirror.lastHeartbeatAt < this.config.heartbeatMinIntervalMs
    ) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'HEARTBEAT_TOO_FAST',
        'Heartbeat cadence violated the minimum interval.',
        snapshot,
        this.config.heartbeatMinIntervalMs - (now - existingMirror.lastHeartbeatAt),
      );
    }

    this.totalHeartbeats += 1;
    this.metricsPort?.recordHeartbeat(payload.roomId);

    const nextMirror = this.computeHeartbeatMirror(snapshot, socketId, payload, existingMirror);
    const nextLease = this.computeLease(snapshot, nextMirror);
    this.persistMirror(nextMirror);
    this.persistLease(nextLease);

    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      socketId,
      envelope,
      payload.roomId,
      payload.channelId,
      {
        heartbeat: payload,
        mirror: nextMirror,
        lease: nextLease,
      },
    );

    try {
      const result = await this.backend.submitPresenceEnvelope(backendEnvelope);
      if (result.accepted) {
        this.totalAccepted += 1;
        this.metricsPort?.recordAccepted(envelope.kind, payload.roomId);
        if (result.fanoutPayload) {
          await this.fanoutPresence(payload.roomId, payload.channelId, result.fanoutPayload);
        }
      } else {
        this.totalRejected += 1;
        this.metricsPort?.recordRejected(envelope.kind, 'UNKNOWN', payload.roomId);
      }

      const ack = Object.freeze({
        ackId: randomUUID(),
        envelopeId: envelope.envelopeId,
        roomId: payload.roomId,
        channelId: payload.channelId,
        state: result.state,
        reason: result.accepted ? null : 'UNKNOWN',
        issuedAt: this.now(),
        retryAfterMs: null,
        metadata: Object.freeze({
          backendReason: result.reason,
          backendMetadata: result.metadata,
        }),
      }) satisfies ChatPresenceAck;

      this.recordAudit(auth, socketId, envelope, snapshot, ack, backendEnvelope.payloadHash);
      return ack;
    } catch (error) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend heartbeat submission failed.',
        snapshot,
      );
    }
  }

  private async handleCursorSync(
    auth: ChatGatewayAuthContext,
    socketId: string,
    envelope: ChatPresenceEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatPresenceAck> {
    if (!this.config.allowCursorSync) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'CURSOR_NOT_ALLOWED',
        'Cursor sync is disabled in presence transport config.',
        snapshot,
      );
    }

    const payload = envelope.cursorSync;
    if (!payload) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'MALFORMED_PAYLOAD',
        'Cursor sync requires a normalized cursor payload.',
        snapshot,
      );
    }

    if (!snapshot.roomIds.includes(payload.roomId)) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'ROOM_NOT_JOINED',
        'Cursor sync rejected because the session is not joined to the room.',
        snapshot,
      );
    }

    const key = this.key(snapshot.sessionId, payload.roomId, payload.channelId);
    const existingMirror = this.mirrorsBySessionRoom.get(key);

    const nextMirror: ChatPresenceMirrorRecord = Object.freeze({
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId: payload.roomId,
      channelId: payload.channelId,
      activityState: existingMirror?.activityState ?? 'ACTIVE',
      visibility: existingMirror?.visibility ?? 'VISIBLE',
      panelOpen: existingMirror?.panelOpen ?? true,
      spectating: existingMirror?.spectating ?? false,
      targetUserId: existingMirror?.targetUserId ?? null,
      role: existingMirror?.role ?? 'PLAYER',
      cursor: payload.cursor,
      lastHeartbeatAt: existingMirror?.lastHeartbeatAt ?? null,
      lastActivityAt: this.now(),
      lastOccupancyRequestAt: existingMirror?.lastOccupancyRequestAt ?? null,
      metadata: Object.freeze({
        ...(existingMirror?.metadata ?? {}),
        ...payload.metadata,
      }),
    });

    const nextLease = this.computeLease(snapshot, nextMirror);
    this.persistMirror(nextMirror);
    this.persistLease(nextLease);

    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      socketId,
      envelope,
      payload.roomId,
      payload.channelId,
      {
        cursorSync: payload,
        mirror: nextMirror,
      },
    );

    try {
      const result = await this.backend.submitPresenceEnvelope(backendEnvelope);
      if (result.accepted) {
        this.totalAccepted += 1;
        this.metricsPort?.recordAccepted(envelope.kind, payload.roomId);
        if (result.fanoutPayload) {
          await this.fanoutPresence(payload.roomId, payload.channelId, result.fanoutPayload);
        }
      } else {
        this.totalRejected += 1;
        this.metricsPort?.recordRejected(envelope.kind, 'UNKNOWN', payload.roomId);
      }

      const ack = Object.freeze({
        ackId: randomUUID(),
        envelopeId: envelope.envelopeId,
        roomId: payload.roomId,
        channelId: payload.channelId,
        state: result.state,
        reason: result.accepted ? null : 'UNKNOWN',
        issuedAt: this.now(),
        retryAfterMs: null,
        metadata: Object.freeze({
          backendReason: result.reason,
          backendMetadata: result.metadata,
        }),
      }) satisfies ChatPresenceAck;

      this.recordAudit(auth, socketId, envelope, snapshot, ack, backendEnvelope.payloadHash);
      return ack;
    } catch (error) {
      return this.rejectEnvelope(
        auth,
        socketId,
        envelope,
        'BACKEND_UNAVAILABLE',
        error instanceof Error ? error.message : 'Backend cursor presence submission failed.',
        snapshot,
      );
    }
  }

  private async handleOccupancyRequest(
    auth: ChatGatewayAuthContext,
    socketId: string,
    envelope: ChatPresenceEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatPresenceBackendResult> {
    if (!this.config.allowOccupancyRequests) {
      return {
        accepted: false,
        roomId: envelope.roomId ?? 'unknown',
        channelId: envelope.channelId ?? null,
        state: 'REJECTED',
        occupancySnapshot: null,
        fanoutPayload: null,
        reason: 'Occupancy requests are disabled in presence transport config.',
        metadata: Object.freeze({}),
      };
    }

    const payload = envelope.occupancyRequest;
    if (!payload) {
      return {
        accepted: false,
        roomId: envelope.roomId ?? 'unknown',
        channelId: envelope.channelId ?? null,
        state: 'REJECTED',
        occupancySnapshot: null,
        fanoutPayload: null,
        reason: 'Occupancy requests require a normalized occupancy payload.',
        metadata: Object.freeze({}),
      };
    }

    if (!snapshot.roomIds.includes(payload.roomId)) {
      return {
        accepted: false,
        roomId: payload.roomId,
        channelId: payload.channelId,
        state: 'REJECTED',
        occupancySnapshot: null,
        fanoutPayload: null,
        reason: 'Occupancy request rejected because the session is not joined to the room.',
        metadata: Object.freeze({}),
      };
    }

    const key = this.key(snapshot.sessionId, payload.roomId, payload.channelId);
    const lastRequestedAt = this.occupancyRequestAtBySessionRoom.get(key);
    const now = this.now();

    if (
      typeof lastRequestedAt === 'number' &&
      now - lastRequestedAt < this.config.occupancyRequestMinIntervalMs
    ) {
      return {
        accepted: false,
        roomId: payload.roomId,
        channelId: payload.channelId,
        state: 'RATE_LIMITED',
        occupancySnapshot: null,
        fanoutPayload: null,
        reason: 'Occupancy request rate limit exceeded.',
        metadata: Object.freeze({
          retryAfterMs: this.config.occupancyRequestMinIntervalMs - (now - lastRequestedAt),
        }),
      };
    }

    this.occupancyRequestAtBySessionRoom.set(key, now);
    this.totalOccupancyRequests += 1;
    this.metricsPort?.recordOccupancyRequest(payload.roomId);

    const backendEnvelope = this.buildBackendEnvelope(
      snapshot,
      socketId,
      envelope,
      payload.roomId,
      payload.channelId,
      {
        occupancyRequest: payload,
      },
    );

    try {
      const result = await this.backend.submitPresenceEnvelope(backendEnvelope);
      const pseudoAck: ChatPresenceAck = Object.freeze({
        ackId: randomUUID(),
        envelopeId: envelope.envelopeId,
        roomId: payload.roomId,
        channelId: payload.channelId,
        state: result.state,
        reason: result.accepted ? null : 'OCCUPANCY_NOT_ALLOWED',
        issuedAt: this.now(),
        retryAfterMs: null,
        metadata: Object.freeze({
          backendReason: result.reason,
        }),
      });

      this.recordAudit(auth, socketId, envelope, snapshot, pseudoAck, backendEnvelope.payloadHash);
      return result;
    } catch (error) {
      return {
        accepted: false,
        roomId: payload.roomId,
        channelId: payload.channelId,
        state: 'REJECTED',
        occupancySnapshot: null,
        fanoutPayload: null,
        reason: error instanceof Error ? error.message : 'Occupancy request failed.',
        metadata: Object.freeze({}),
      };
    }
  }

  // ==========================================================================
  // MARK: Restriction law
  // ==========================================================================

  private checkRestrictions(
    auth: ChatGatewayAuthContext,
    envelope: ChatPresenceEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): ChatPresenceRejectReason | null {
    const sessionRestrictions = new Set(snapshot.restrictions);
    const connectionRestrictions = new Set(auth.restrictions ?? []);

    if (snapshot.authorityState === 'TERMINATED' || snapshot.authorityState === 'SUSPENDED') {
      return 'PRESENCE_RESTRICTED';
    }

    if (sessionRestrictions.has('BLOCK_TYPING')) {
      // no typing path in this file
    }

    if (sessionRestrictions.has('BLOCK_CURSOR') && envelope.kind === 'SYNC_ROOM_CURSOR') {
      return 'CURSOR_NOT_ALLOWED';
    }

    if (sessionRestrictions.has('BLOCK_ROOM_JOIN')) {
      switch (envelope.kind) {
        case 'ROOM_JOIN_VISIBLE':
        case 'ROOM_LEAVE_VISIBLE':
        case 'PANEL_OPENED':
        case 'SET_VISIBILITY':
          return 'PRESENCE_RESTRICTED';
        default:
          break;
      }
    }

    if (connectionRestrictions.has('READ_ONLY')) {
      switch (envelope.kind) {
        case 'ROOM_JOIN_VISIBLE':
        case 'ROOM_LEAVE_VISIBLE':
        case 'SET_VISIBILITY':
        case 'SET_SPECTATING':
          return 'PRESENCE_RESTRICTED';
        default:
          break;
      }
    }

    if (
      connectionRestrictions.has('NO_PRIVATE_ENTRY') &&
      envelope.roomId?.includes('private')
    ) {
      return 'ROOM_NOT_ALLOWED';
    }

    if (
      connectionRestrictions.has('NO_SHADOW_ENTRY') &&
      envelope.visibility?.visibility === 'SHADOW'
    ) {
      return 'VISIBILITY_NOT_ALLOWED';
    }

    return null;
  }

  private consumeRoomEventWindow(
    sessionId: string,
    roomId: string,
  ): { allowed: true; retryAfterMs: null } | { allowed: false; retryAfterMs: number } {
    const key = `${sessionId}:${roomId}`;
    const now = this.now();
    const current = this.roomEventWindows.get(key);

    if (!current || now - current.startedAt >= this.config.roomPresenceRateWindowMs) {
      this.roomEventWindows.set(key, {
        startedAt: now,
        count: 1,
      });
      return { allowed: true, retryAfterMs: null };
    }

    if (current.count + 1 > this.config.maxPresenceEventsPerWindow) {
      this.totalRateLimited += 1;
      this.metricsPort?.recordRateLimited('SET_ACTIVITY', roomId);
      return {
        allowed: false,
        retryAfterMs: this.config.roomPresenceRateWindowMs - (now - current.startedAt),
      };
    }

    this.roomEventWindows.set(key, {
      startedAt: current.startedAt,
      count: current.count + 1,
    });

    return { allowed: true, retryAfterMs: null };
  }

  // ==========================================================================
  // MARK: Mirror and lease synthesis
  // ==========================================================================

  private computeNextMirror(
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatPresenceEnvelope,
  ): ChatPresenceMirrorRecord {
    const roomId =
      envelope.roomId ??
      envelope.activity?.roomId ??
      envelope.visibility?.roomId ??
      envelope.spectating?.roomId ??
      'unknown';

    const channelId =
      envelope.channelId ??
      envelope.activity?.channelId ??
      envelope.visibility?.channelId ??
      envelope.spectating?.channelId ??
      null;

    const key = this.key(snapshot.sessionId, roomId, channelId);
    const existing = this.mirrorsBySessionRoom.get(key);

    const base: ChatPresenceMirrorRecord = existing ?? Object.freeze({
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId,
      channelId,
      activityState: 'ACTIVE',
      visibility: 'VISIBLE',
      panelOpen: envelope.kind !== 'PANEL_CLOSED',
      spectating: false,
      targetUserId: null,
      role: 'PLAYER',
      cursor: null,
      lastHeartbeatAt: null,
      lastActivityAt: this.now(),
      lastOccupancyRequestAt: null,
      metadata: Object.freeze({}),
    });

    let activityState = base.activityState;
    let visibility = base.visibility;
    let panelOpen = base.panelOpen;
    let spectating = base.spectating;
    let targetUserId = base.targetUserId;
    let cursor = base.cursor;
    let role = base.role;
    let metadata: Readonly<Record<string, unknown>> = Object.freeze({
      ...base.metadata,
      ...envelope.metadata,
    });

    switch (envelope.kind) {
      case 'PANEL_OPENED':
        panelOpen = true;
        activityState = 'ACTIVE';
        break;
      case 'PANEL_CLOSED':
        panelOpen = false;
        activityState = 'BACKGROUND';
        break;
      case 'ROOM_JOIN_VISIBLE':
        panelOpen = true;
        visibility = 'VISIBLE';
        activityState = 'ACTIVE';
        break;
      case 'ROOM_LEAVE_VISIBLE':
        panelOpen = false;
        activityState = 'INACTIVE';
        break;
      case 'SET_ACTIVITY':
        activityState = envelope.activity?.state ?? activityState;
        cursor = envelope.activity?.cursor ?? cursor;
        if ((envelope.activity?.visible ?? true) === false) {
          visibility = 'HIDDEN';
        }
        metadata = Object.freeze({
          ...metadata,
          ...(envelope.activity?.metadata ?? {}),
        });
        break;
      case 'SET_VISIBILITY':
        visibility = envelope.visibility?.visibility ?? visibility;
        metadata = Object.freeze({
          ...metadata,
          ...(envelope.visibility?.metadata ?? {}),
        });
        break;
      case 'SET_SPECTATING':
        spectating = envelope.spectating?.spectating ?? spectating;
        targetUserId = envelope.spectating?.targetUserId ?? targetUserId;
        role = spectating ? 'SPECTATOR' : role;
        metadata = Object.freeze({
          ...metadata,
          ...(envelope.spectating?.metadata ?? {}),
        });
        break;
      case 'CLEAR_ROOM_STATE':
        panelOpen = false;
        activityState = 'INACTIVE';
        cursor = null;
        spectating = false;
        targetUserId = null;
        break;
      case 'DISCONNECT_HINT':
        panelOpen = false;
        activityState = 'DISCONNECTED';
        break;
      default:
        break;
    }

    return Object.freeze({
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId,
      channelId,
      activityState,
      visibility,
      panelOpen,
      spectating,
      targetUserId,
      role,
      cursor,
      lastHeartbeatAt: base.lastHeartbeatAt,
      lastActivityAt: this.now(),
      lastOccupancyRequestAt: base.lastOccupancyRequestAt,
      metadata,
    });
  }

  private computeHeartbeatMirror(
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    payload: ChatPresenceHeartbeatPayload,
    existing: ChatPresenceMirrorRecord | undefined,
  ): ChatPresenceMirrorRecord {
    return Object.freeze({
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId: payload.roomId,
      channelId: payload.channelId,
      activityState: payload.activityState ?? existing?.activityState ?? 'ACTIVE',
      visibility: payload.visibility ?? existing?.visibility ?? 'VISIBLE',
      panelOpen: payload.panelOpen ?? existing?.panelOpen ?? true,
      spectating: existing?.spectating ?? false,
      targetUserId: existing?.targetUserId ?? null,
      role: existing?.role ?? 'PLAYER',
      cursor: payload.cursor ?? existing?.cursor ?? null,
      lastHeartbeatAt: this.now(),
      lastActivityAt: this.now(),
      lastOccupancyRequestAt: existing?.lastOccupancyRequestAt ?? null,
      metadata: Object.freeze({
        ...(existing?.metadata ?? {}),
        ...(payload.metadata ?? {}),
      }),
    });
  }

  private computeLease(
    snapshot: ChatSessionAuthoritySnapshot,
    mirror: ChatPresenceMirrorRecord,
  ): ChatPresenceLease {
    return Object.freeze({
      leaseId: randomUUID(),
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId: mirror.socketId,
      roomId: mirror.roomId,
      channelId: mirror.channelId,
      createdAt: this.now(),
      expiresAt: this.now() + this.config.leaseTtlMs,
      activityState: mirror.activityState,
      visibility: mirror.visibility,
      panelOpen: mirror.panelOpen,
      spectating: mirror.spectating,
      targetUserId: mirror.targetUserId,
      cursor: mirror.cursor,
      role: mirror.role,
      metadata: mirror.metadata,
    });
  }

  private persistMirror(mirror: ChatPresenceMirrorRecord): void {
    this.mirrorsBySessionRoom.set(
      this.key(mirror.sessionId, mirror.roomId, mirror.channelId),
      mirror,
    );
  }

  private persistLease(lease: ChatPresenceLease): void {
    this.leasesBySessionRoom.set(
      this.key(lease.sessionId, lease.roomId, lease.channelId),
      lease,
    );
  }

  // ==========================================================================
  // MARK: Backend envelope
  // ==========================================================================

  private buildBackendEnvelope(
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatPresenceEnvelope,
    roomId: string,
    channelId: string | null,
    payload: Readonly<Record<string, unknown>>,
  ): ChatPresenceBackendEnvelope {
    const body = Object.freeze({
      kind: envelope.kind,
      payload,
      envelopeMetadata: envelope.metadata,
    });

    return Object.freeze({
      backendEnvelopeId: randomUUID(),
      submittedAt: this.now(),
      namespace: envelope.namespace,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      authLevel: snapshot.authLevel,
      socketId,
      roomId,
      channelId,
      kind: envelope.kind,
      restrictions: Object.freeze([...(snapshot.restrictions as readonly string[])]),
      payloadHash: sha256(
        stableJson({
          namespace: envelope.namespace,
          sessionId: snapshot.sessionId,
          roomId,
          channelId,
          body,
        }),
      ),
      payload: body,
      transportMetadata: Object.freeze({
        envelopeId: envelope.envelopeId,
        issuedAt: envelope.issuedAt,
      }),
    });
  }

  // ==========================================================================
  // MARK: Session resolution
  // ==========================================================================

  private resolveSessionSnapshot(
    auth: ChatGatewayAuthContext,
  ): ChatSessionAuthoritySnapshot | null {
    const direct = this.sessionRegistry.getAuthoritySnapshot(auth.sessionIdHint ?? '');
    if (direct && direct.userId === auth.userId) {
      return direct;
    }

    const byUser = this.sessionRegistry.listAuthoritySnapshotsForUser(auth.userId);
    if (auth.sessionIdHint) {
      const exact = byUser.find((item) => item.sessionId === auth.sessionIdHint);
      if (exact) {
        return exact;
      }
    }

    return byUser[0] ?? null;
  }

  // ==========================================================================
  // MARK: Ack and fanout
  // ==========================================================================

  private rejectEnvelope(
    auth: ChatGatewayAuthContext,
    socketId: string,
    envelope: ChatPresenceEnvelope,
    reason: ChatPresenceRejectReason,
    message: string,
    snapshot?: ChatSessionAuthoritySnapshot,
    retryAfterMs?: number,
  ): ChatPresenceAck {
    this.totalRejected += 1;
    if (reason === 'RATE_LIMITED' || reason === 'HEARTBEAT_TOO_FAST') {
      this.totalRateLimited += 1;
      this.metricsPort?.recordRateLimited(envelope.kind, envelope.roomId ?? null);
    } else {
      this.metricsPort?.recordRejected(envelope.kind, reason, envelope.roomId ?? null);
    }

    const ack: ChatPresenceAck = Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state:
        reason === 'RATE_LIMITED' || reason === 'HEARTBEAT_TOO_FAST'
          ? 'RATE_LIMITED'
          : reason === 'PRESENCE_RESTRICTED'
            ? 'QUARANTINED'
            : 'REJECTED',
      reason,
      issuedAt: this.now(),
      retryAfterMs: retryAfterMs ?? null,
      metadata: Object.freeze({
        message,
      }),
    });

    const payloadHash = sha256(stableJson({ envelope, ack }));
    this.recordAudit(auth, socketId, envelope, snapshot ?? null, ack, payloadHash);
    return ack;
  }

  private async fanoutPresence(
    roomId: string,
    channelId: string | null,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    this.totalFanouts += 1;
    await this.fanout.fanout({
      event: 'chat:presence:fanout',
      roomId,
      channelId,
      targets: Object.freeze([]),
      payload,
    });
  }

  // ==========================================================================
  // MARK: Audit
  // ==========================================================================

  private recordAudit(
    auth: ChatGatewayAuthContext,
    socketId: string,
    envelope: ChatPresenceEnvelope,
    snapshot: ChatSessionAuthoritySnapshot | null,
    ack: ChatPresenceAck,
    payloadHash: string,
  ): void {
    const record: ChatPresenceAuditRecord = Object.freeze({
      auditId: randomUUID(),
      recordedAt: this.now(),
      envelopeId: envelope.envelopeId,
      namespace: envelope.namespace,
      socketId,
      sessionId: snapshot?.sessionId ?? auth.sessionIdHint ?? null,
      userId: snapshot?.userId ?? auth.userId,
      username: snapshot?.username ?? auth.username,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      kind: envelope.kind,
      accepted: ack.state === 'ACCEPTED' || ack.state === 'DEFERRED',
      state: ack.state,
      reason: ack.reason,
      payloadHash,
      tags: Object.freeze([
        envelope.kind,
        ack.state,
        ack.reason ?? 'NO_REASON',
      ]),
      metadata: ack.metadata,
    });

    this.auditTrail.push(record);
    if (this.auditTrail.length > this.config.auditLimit) {
      this.auditTrail.splice(0, this.auditTrail.length - this.config.auditLimit);
    }
  }

  public listAuditTrail(): readonly ChatPresenceAuditRecord[] {
    return Object.freeze([...this.auditTrail]);
  }

  public listActiveLeases(): readonly ChatPresenceLease[] {
    return Object.freeze([...this.leasesBySessionRoom.values()]);
  }

  public listPresenceMirrors(): readonly ChatPresenceMirrorRecord[] {
    return Object.freeze([...this.mirrorsBySessionRoom.values()]);
  }

  public getMetricsSnapshot(): ChatPresenceMetricsSnapshot {
    return Object.freeze({
      totalReceived: this.totalReceived,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      totalRateLimited: this.totalRateLimited,
      totalHeartbeats: this.totalHeartbeats,
      totalOccupancyRequests: this.totalOccupancyRequests,
      totalFanouts: this.totalFanouts,
      activeLeaseCount: this.leasesBySessionRoom.size,
      activeMirrorCount: this.mirrorsBySessionRoom.size,
      auditCount: this.auditTrail.length,
    });
  }

  // ==========================================================================
  // MARK: Maintenance
  // ==========================================================================

  public prune(now: number = this.now()): void {
    for (const [key, lease] of this.leasesBySessionRoom.entries()) {
      if (lease.expiresAt <= now) {
        this.leasesBySessionRoom.delete(key);
      }
    }

    for (const [key, mirror] of this.mirrorsBySessionRoom.entries()) {
      const lastSignalAt = mirror.lastHeartbeatAt ?? mirror.lastActivityAt;
      if (now - lastSignalAt > this.config.activityWindowMs + this.config.heartbeatGraceMs) {
        this.mirrorsBySessionRoom.delete(key);
      }
    }

    for (const [key, window] of this.roomEventWindows.entries()) {
      if (now - window.startedAt >= this.config.roomPresenceRateWindowMs) {
        this.roomEventWindows.delete(key);
      }
    }

    for (const [key, lastRequestedAt] of this.occupancyRequestAtBySessionRoom.entries()) {
      if (now - lastRequestedAt > this.config.activityWindowMs) {
        this.occupancyRequestAtBySessionRoom.delete(key);
      }
    }
  }

  public resetTransportState(): void {
    this.leasesBySessionRoom.clear();
    this.mirrorsBySessionRoom.clear();
    this.roomEventWindows.clear();
    this.occupancyRequestAtBySessionRoom.clear();
    this.auditTrail.splice(0, this.auditTrail.length);

    this.totalReceived = 0;
    this.totalAccepted = 0;
    this.totalRejected = 0;
    this.totalRateLimited = 0;
    this.totalHeartbeats = 0;
    this.totalOccupancyRequests = 0;
    this.totalFanouts = 0;
  }

  // ==========================================================================
  // MARK: Key helpers
  // ==========================================================================

  private key(
    sessionId: string,
    roomId: string,
    channelId: string | null,
  ): string {
    return `${sessionId}::${roomId}::${channelId ?? 'default'}`;
  }
}

// ============================================================================
// MARK: Helper export
// ============================================================================

export function createChatPresenceHandler(
  deps: ChatPresenceHandlerDependencies,
  config: Partial<ChatPresenceHandlerConfig> = {},
): ChatPresenceHandler {
  return new ChatPresenceHandler(deps, config);
}
