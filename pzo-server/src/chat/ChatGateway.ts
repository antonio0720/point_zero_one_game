/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT GATEWAY
 * FILE: pzo-server/src/chat/ChatGateway.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the dedicated transport gateway for the unified authoritative
 * chat stack.
 *
 * It sits in pzo-server/src/chat and obeys one law:
 *
 *   transport is servant, not brain.
 *
 * That means this gateway may:
 *
 * - authenticate and attach connections,
 * - manage socket namespaces,
 * - register / reconnect sessions,
 * - join and leave socket.io rooms,
 * - accept player transport intent,
 * - forward canonical input to backend authority,
 * - fan out authoritative packets,
 * - emit room topology snapshots,
 * - coordinate presence / typing / cursor theater,
 * - expose coarse transport metrics,
 * - preserve reconnect continuity.
 *
 * It may NOT:
 *
 * - become transcript truth,
 * - own moderation truth,
 * - become the hater/helper decision maker,
 * - replace backend replay truth,
 * - replace learning truth,
 * - collapse backend room law into socket listeners.
 *
 * Donor lanes
 * -----------
 * This gateway deliberately wraps and supersedes fragmented donor behavior from:
 *
 * - pzo-server/src/ws/socket-server.ts
 * - pzo-server/src/ws/room-manager.ts
 * - pzo-server/src/ws/action-validator.ts
 * - pzo-server/src/multiplayer/contracts.ts
 * - pzo-server/src/multiplayer/player.ts
 * - pzo-server/src/haters/HaterEngine.ts
 *
 * Those remain references and adapters. This becomes the production socket
 * frontage for authoritative chat.
 * ============================================================================
 */

import { createHash, randomUUID } from 'node:crypto';
import { Server, type Namespace, type Socket } from 'socket.io';

import { ActionValidator } from '../ws/action-validator';
import { CoopContractManager } from '../multiplayer/contracts';
import type { Player } from '../multiplayer/player';
import {
  ChatRoomRegistry,
  DEFAULT_CHAT_ROOM_REGISTRY_CONFIG,
  type ChatChannelId,
  type ChatCursorSnapshot,
  type ChatCursorUpdate,
  type ChatFanoutTarget,
  type ChatJoinRequest,
  type ChatMountTarget,
  type ChatOccupancySnapshot,
  type ChatPresenceSnapshot,
  type ChatPresenceUpdate,
  type ChatRoomId,
  type ChatRoomRegistryConfig,
  type ChatRoomSeed,
  type ChatRoomSnapshot,
  type ChatSessionId,
  type ChatSocketId,
  type ChatTransportAuthLevel,
  type ChatTransportIdentity,
  type ChatTransportMembershipRole,
  type ChatTransportPresenceMode,
  type ChatTransportSessionSeed,
  type ChatTransportSessionSnapshot,
  type ChatTransportTypingMode,
  type ChatTransportVisibility,
  type ChatTypingSnapshot,
  type ChatTypingUpdate,
  type ChatUserId,
  type UnixMs,
} from './ChatRoomRegistry';

// ============================================================================
// MARK: Event surface
// ============================================================================

export const CHAT_GATEWAY_EVENTS = Object.freeze({
  JOIN: 'chat:join',
  LEAVE: 'chat:leave',
  ROOM_LIST: 'chat:rooms:list',
  ROOM_SYNC: 'chat:room:sync',
  ROOM_TOPOLOGY: 'chat:room:topology',
  ROOM_CREATED: 'chat:room:created',
  ROOM_REMOVED: 'chat:room:removed',
  MESSAGE_SUBMIT: 'chat:message:submit',
  MESSAGE_ACK: 'chat:message:ack',
  FANOUT_PACKET: 'chat:fanout',
  PRESENCE_UPDATE: 'chat:presence:update',
  PRESENCE_SNAPSHOT: 'chat:presence:snapshot',
  TYPING_UPDATE: 'chat:typing:update',
  TYPING_SNAPSHOT: 'chat:typing:snapshot',
  CURSOR_UPDATE: 'chat:cursor:update',
  CURSOR_SNAPSHOT: 'chat:cursor:snapshot',
  CONNECTION_READY: 'chat:connection:ready',
  CONNECTION_ERROR: 'chat:connection:error',
  SESSION_SYNC: 'chat:session:sync',
  TRANSPORT_AUDIT: 'chat:transport:audit',
  LEGACY_ACTION_RESULT: 'chat:legacy:action-result',
  REPLAY_HINT: 'chat:replay:hint',
});

export type ChatGatewayInboundEventName =
  (typeof CHAT_GATEWAY_EVENTS)[keyof typeof CHAT_GATEWAY_EVENTS];

export interface ChatGatewayJoinPayload {
  readonly room: ChatRoomSeed;
  readonly role?: ChatTransportMembershipRole;
  readonly visibility?: ChatTransportVisibility;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatGatewayLeavePayload {
  readonly roomId: ChatRoomId;
  readonly reason?: string | null;
}

export interface ChatGatewayMessageSubmitPayload {
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly clientMessageId?: string | null;
  readonly text?: string | null;
  readonly body?: readonly unknown[];
  readonly mentions?: readonly string[];
  readonly commands?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly legacyAction?: {
    readonly type: string;
    readonly card?: number;
    readonly targetSymbol?: string;
  } | null;
}

export interface ChatGatewayPresencePayload {
  readonly roomId?: ChatRoomId | null;
  readonly presenceMode: ChatTransportPresenceMode;
  readonly visibility?: ChatTransportVisibility;
  readonly note?: string | null;
}

export interface ChatGatewayTypingPayload {
  readonly roomId: ChatRoomId;
  readonly typingMode: ChatTransportTypingMode;
  readonly cursorToken?: string | null;
}

export interface ChatGatewayCursorPayload {
  readonly roomId: ChatRoomId;
  readonly cursorToken: string;
}

export interface ChatGatewayRoomListPayload {
  readonly includeShadow?: boolean;
  readonly includePrivate?: boolean;
  readonly includeEmpty?: boolean;
  readonly kind?: string;
  readonly modeId?: string | null;
  readonly runId?: string | null;
  readonly partyId?: string | null;
  readonly tag?: string;
}

export interface ChatGatewayAckPayload {
  readonly ok: boolean;
  readonly code: string;
  readonly requestId: string;
  readonly roomId?: ChatRoomId | null;
  readonly sessionId?: ChatSessionId | null;
  readonly detail?: string | null;
  readonly packetCount?: number;
  readonly acceptedAt: UnixMs;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatGatewayFanoutPacket {
  readonly packetId: string;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly packetType:
    | 'ROOM_TOPOLOGY'
    | 'AUTHORITATIVE_MESSAGE'
    | 'PRESENCE'
    | 'TYPING'
    | 'CURSOR'
    | 'SYSTEM_NOTICE'
    | 'REPLAY_HINT'
    | 'TRANSPORT_AUDIT';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: UnixMs;
  readonly causalRequestId?: string | null;
  readonly shadow?: boolean;
}

export interface ChatGatewayReplayHint {
  readonly roomId: ChatRoomId;
  readonly replayId?: string | null;
  readonly messageRange?: readonly string[];
  readonly anchor?: string | null;
  readonly createdAt: UnixMs;
}

export interface ChatGatewayTransportAudit {
  readonly auditId: string;
  readonly generatedAt: UnixMs;
  readonly nodeId: string;
  readonly hash: string;
  readonly roomCount: number;
  readonly sessionCount: number;
  readonly socketCount: number;
}

export interface ChatGatewayRoomSyncPayload {
  readonly session: ChatTransportSessionSnapshot;
  readonly room: ChatRoomSnapshot;
  readonly presence: ChatPresenceSnapshot | null;
  readonly typing: readonly ChatTypingSnapshot[];
  readonly cursors: readonly ChatCursorSnapshot[];
  readonly occupancy: ChatOccupancySnapshot;
  readonly deliveredAt: UnixMs;
}

export interface ChatGatewayConnectionReadyPayload {
  readonly session: ChatTransportSessionSnapshot;
  readonly deliveredAt: UnixMs;
  readonly serverNodeId: string;
}

export interface ChatGatewayConnectionErrorPayload {
  readonly requestId?: string | null;
  readonly code: string;
  readonly message: string;
  readonly deliveredAt: UnixMs;
}

// ============================================================================
// MARK: Ports
// ============================================================================

export interface ChatGatewayLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface ChatGatewayMetricsPort {
  increment(name: string, value?: number, tags?: Readonly<Record<string, string>>): void;
  gauge(name: string, value: number, tags?: Readonly<Record<string, string>>): void;
  timing(name: string, ms: number, tags?: Readonly<Record<string, string>>): void;
}

export interface ChatGatewayReplayPort {
  hint(hint: ChatGatewayReplayHint): Promise<void>;
}

export interface ChatGatewayAuditPort {
  publish(audit: ChatGatewayTransportAudit): Promise<void>;
}

export interface ChatGatewayAuthContext {
  readonly userId: ChatUserId;
  readonly username: string;
  readonly authLevel: ChatTransportAuthLevel;
  readonly mountTarget?: ChatMountTarget | null;
  readonly roomIdHint?: ChatRoomId | null;
  readonly sessionIdHint?: ChatSessionId | null;
  readonly modeId?: string | null;
  readonly runId?: string | null;
  readonly partyId?: string | null;
  readonly traits?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatGatewayAuthPort {
  authenticate(socket: Socket): Promise<ChatGatewayAuthContext>;
}

export interface ChatGatewayEngineInputEnvelope {
  readonly envelopeId: string;
  readonly kind:
    | 'JOIN'
    | 'LEAVE'
    | 'MESSAGE'
    | 'PRESENCE'
    | 'TYPING'
    | 'CURSOR'
    | 'ROOM_SYNC_REQUEST';
  readonly roomId?: ChatRoomId | null;
  readonly sessionId: ChatSessionId;
  readonly userId: ChatUserId;
  readonly namespace: string;
  readonly receivedAt: UnixMs;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ChatGatewayEngineResult {
  readonly accepted: boolean;
  readonly code: string;
  readonly detail?: string | null;
  readonly packets?: readonly ChatGatewayFanoutPacket[];
  readonly replayHint?: ChatGatewayReplayHint | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatGatewayEnginePort {
  handleTransportEnvelope(
    envelope: ChatGatewayEngineInputEnvelope,
  ): Promise<ChatGatewayEngineResult>;
}

export interface ChatGatewayHaterPort {
  onRoomJoin?(context: {
    readonly room: ChatRoomSnapshot;
    readonly session: ChatTransportSessionSnapshot;
  }): Promise<void>;

  onMessageSubmit?(context: {
    readonly room: ChatRoomSnapshot;
    readonly session: ChatTransportSessionSnapshot;
    readonly text: string | null;
  }): Promise<void>;
}

// ============================================================================
// MARK: Runtime config
// ============================================================================

export interface ChatGatewayRuntimeConfig {
  readonly namespace: string;
  readonly allowAnonymous: boolean;
  readonly maxMessageChars: number;
  readonly maxMentionsPerMessage: number;
  readonly maxCommandsPerMessage: number;
  readonly transportRateWindowMs: number;
  readonly maxTransportEventsPerWindow: number;
  readonly maxTransportMessagesPerWindow: number;
  readonly emitTransportAuditEveryMs: number;
  readonly enableLegacyActionValidation: boolean;
  readonly enableReplayHints: boolean;
  readonly enablePresenceSnapshots: boolean;
  readonly enableTypingSnapshots: boolean;
  readonly enableCursorSnapshots: boolean;
  readonly enableRoomTopologyPackets: boolean;
  readonly enableRoomSyncOnJoin: boolean;
  readonly nodeId: string;
}

export const DEFAULT_CHAT_GATEWAY_RUNTIME_CONFIG: Readonly<ChatGatewayRuntimeConfig> = Object.freeze({
  namespace: DEFAULT_CHAT_ROOM_REGISTRY_CONFIG.defaultNamespace,
  allowAnonymous: false,
  maxMessageChars: 1200,
  maxMentionsPerMessage: 12,
  maxCommandsPerMessage: 8,
  transportRateWindowMs: 7_500,
  maxTransportEventsPerWindow: 64,
  maxTransportMessagesPerWindow: 18,
  emitTransportAuditEveryMs: 30_000,
  enableLegacyActionValidation: true,
  enableReplayHints: true,
  enablePresenceSnapshots: true,
  enableTypingSnapshots: true,
  enableCursorSnapshots: true,
  enableRoomTopologyPackets: true,
  enableRoomSyncOnJoin: true,
  nodeId: `chat-node:${randomUUID()}`,
});

// ============================================================================
// MARK: Defaults
// ============================================================================

const NOOP_LOGGER: ChatGatewayLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const NOOP_METRICS: ChatGatewayMetricsPort = {
  increment: () => undefined,
  gauge: () => undefined,
  timing: () => undefined,
};

const NOOP_REPLAY: ChatGatewayReplayPort = {
  hint: async () => undefined,
};

const NOOP_AUDIT: ChatGatewayAuditPort = {
  publish: async () => undefined,
};

class DefaultAuthPort implements ChatGatewayAuthPort {
  public async authenticate(socket: Socket): Promise<ChatGatewayAuthContext> {
    const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    const userId = asNonEmptyString(auth.userId) ?? asNonEmptyString(auth.playerId) ?? `anon:${socket.id}`;
    const username = asNonEmptyString(auth.username) ?? asNonEmptyString(auth.displayName) ?? userId;

    return {
      userId,
      username,
      authLevel: userId.startsWith('anon:') ? 'ANON' : 'AUTHENTICATED',
      mountTarget: asMountTarget(auth.mountTarget),
      roomIdHint: asNullableString(auth.roomId),
      sessionIdHint: asNullableString(auth.sessionId),
      modeId: asNullableString(auth.modeId),
      runId: asNullableString(auth.runId),
      partyId: asNullableString(auth.partyId),
      traits: toStringArray(auth.traits),
      metadata: asRecord(auth.metadata),
    };
  }
}

class RejectingEnginePort implements ChatGatewayEnginePort {
  public async handleTransportEnvelope(
    envelope: ChatGatewayEngineInputEnvelope,
  ): Promise<ChatGatewayEngineResult> {
    return {
      accepted: false,
      code: 'NO_ENGINE_BOUND',
      detail: `No authoritative backend chat engine is bound for ${envelope.kind}`,
      packets: [],
      replayHint: null,
      metadata: {},
    };
  }
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

interface MutableTransportRateBucket {
  startedAt: UnixMs;
  totalEvents: number;
  totalMessages: number;
}

interface GatewaySocketContext {
  readonly sessionId: ChatSessionId;
  readonly auth: ChatGatewayAuthContext;
}

function nowMs(): UnixMs {
  return Date.now();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNullableString(value: unknown): string | null {
  return asNonEmptyString(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.freeze({ ...(value as Record<string, unknown>) });
  }

  return Object.freeze({});
}

function toStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  return Object.freeze(
    value
      .map((entry) => asNonEmptyString(entry))
      .filter((entry): entry is string => Boolean(entry)),
  );
}

function asMountTarget(value: unknown): ChatMountTarget | null {
  const text = asNonEmptyString(value);
  if (!text) {
    return null;
  }

  switch (text) {
    case 'BATTLE_HUD':
    case 'CLUB_UI':
    case 'EMPIRE_SCREEN':
    case 'GAME_BOARD':
    case 'LEAGUE_UI':
    case 'LOBBY_SCREEN':
    case 'PHANTOM_SCREEN':
    case 'PREDATOR_SCREEN':
    case 'SYNDICATE_SCREEN':
    case 'SYSTEM_OVERLAY':
    case 'UNKNOWN':
      return text;
    default:
      return 'UNKNOWN';
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      output[key] = sortKeys(source[key]);
    }
    return output;
  }

  return value;
}

function hashAudit(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function normalizeRoomSeed(input: ChatRoomSeed, auth: ChatGatewayAuthContext, runtime: ChatGatewayRuntimeConfig): ChatRoomSeed {
  return {
    ...input,
    namespace: input.namespace ?? runtime.namespace,
    mountTarget: input.mountTarget ?? auth.mountTarget ?? 'UNKNOWN',
    modeId: input.modeId ?? auth.modeId ?? null,
    runId: input.runId ?? auth.runId ?? null,
    partyId: input.partyId ?? auth.partyId ?? null,
  };
}

function sanitizeMessagePayload(
  payload: ChatGatewayMessageSubmitPayload,
  runtime: ChatGatewayRuntimeConfig,
): ChatGatewayMessageSubmitPayload {
  const text = typeof payload.text === 'string'
    ? payload.text.slice(0, runtime.maxMessageChars)
    : payload.text ?? null;

  return {
    ...payload,
    text,
    mentions: (payload.mentions ?? []).slice(0, runtime.maxMentionsPerMessage),
    commands: (payload.commands ?? []).slice(0, runtime.maxCommandsPerMessage),
  };
}

function coercePlayer(session: ChatTransportSessionSnapshot): Player {
  return {
    id: session.identity.userId,
    username: session.identity.username,
    status: session.identity.status ?? 'ACTIVE',
    sessionStart: session.connectedAt,
    turnsLocked: 0,
  };
}

// ============================================================================
// MARK: ChatGateway
// ============================================================================

export interface ChatGatewayOptions {
  readonly io: Server;
  readonly registry?: ChatRoomRegistry;
  readonly registryConfig?: Partial<ChatRoomRegistryConfig>;
  readonly runtimeConfig?: Partial<ChatGatewayRuntimeConfig>;
  readonly auth?: ChatGatewayAuthPort;
  readonly engine?: ChatGatewayEnginePort;
  readonly replay?: ChatGatewayReplayPort;
  readonly audit?: ChatGatewayAuditPort;
  readonly logger?: ChatGatewayLogger;
  readonly metrics?: ChatGatewayMetricsPort;
  readonly hater?: ChatGatewayHaterPort;
}

export class ChatGateway {
  private readonly io: Server;
  private readonly registry: ChatRoomRegistry;
  private readonly runtime: ChatGatewayRuntimeConfig;
  private readonly auth: ChatGatewayAuthPort;
  private readonly engine: ChatGatewayEnginePort;
  private readonly replay: ChatGatewayReplayPort;
  private readonly audit: ChatGatewayAuditPort;
  private readonly logger: ChatGatewayLogger;
  private readonly metrics: ChatGatewayMetricsPort;
  private readonly hater: ChatGatewayHaterPort | null;

  private readonly rateBuckets = new Map<ChatSessionId, MutableTransportRateBucket>();
  private readonly legacyActionValidator = new ActionValidator(false, '');
  private readonly coopContracts = new CoopContractManager();
  private readonly socketContext = new Map<ChatSocketId, GatewaySocketContext>();

  private namespace: Namespace | null = null;
  private auditTimer: NodeJS.Timeout | null = null;

  public constructor(options: ChatGatewayOptions) {
    this.io = options.io;
    this.registry = options.registry ?? new ChatRoomRegistry(options.registryConfig);
    this.runtime = {
      ...DEFAULT_CHAT_GATEWAY_RUNTIME_CONFIG,
      ...(options.runtimeConfig ?? {}),
    };
    this.auth = options.auth ?? new DefaultAuthPort();
    this.engine = options.engine ?? new RejectingEnginePort();
    this.replay = options.replay ?? NOOP_REPLAY;
    this.audit = options.audit ?? NOOP_AUDIT;
    this.logger = options.logger ?? NOOP_LOGGER;
    this.metrics = options.metrics ?? NOOP_METRICS;
    this.hater = options.hater ?? null;
  }

  // ==========================================================================
  // MARK: Boot / shutdown
  // ==========================================================================

  public start(): this {
    this.namespace = this.io.of(this.runtime.namespace);
    this.namespace.on('connection', (socket) => {
      void this.handleConnection(socket);
    });

    this.scheduleAuditLoop();
    this.logger.info('ChatGateway started', {
      namespace: this.runtime.namespace,
      nodeId: this.runtime.nodeId,
    });
    return this;
  }

  public stop(): void {
    if (this.auditTimer) {
      clearTimeout(this.auditTimer);
      this.auditTimer = null;
    }
  }

  // ==========================================================================
  // MARK: Connection lifecycle
  // ==========================================================================

  private async handleConnection(socket: Socket): Promise<void> {
    const startedAt = nowMs();
    try {
      const auth = await this.auth.authenticate(socket);
      if (auth.authLevel === 'ANON' && !this.runtime.allowAnonymous) {
        throw new Error('Anonymous chat transport is disabled');
      }

      const session = this.registry.registerSession(this.buildSessionSeed(socket, auth));
      this.socketContext.set(socket.id, {
        sessionId: session.sessionId,
        auth,
      });

      this.bindSocketHandlers(socket, session.sessionId);
      this.metrics.increment('chat_gateway.connection.opened');
      this.metrics.gauge('chat_gateway.sessions', this.registry.getMetricsSnapshot().sessionCount);
      this.emitToSocket<ChatGatewayConnectionReadyPayload>(
        socket,
        CHAT_GATEWAY_EVENTS.CONNECTION_READY,
        {
          session,
          deliveredAt: nowMs(),
          serverNodeId: this.runtime.nodeId,
        },
      );

      this.logger.info('ChatGateway connection ready', {
        socketId: socket.id,
        sessionId: session.sessionId,
        userId: auth.userId,
      });

      if (auth.roomIdHint) {
        await this.joinRoom(socket, {
          room: {
            roomId: auth.roomIdHint,
            channelId: `channel:${auth.roomIdHint}`,
            kind: 'LOBBY',
            namespace: this.runtime.namespace,
            mountTarget: auth.mountTarget ?? 'UNKNOWN',
            modeId: auth.modeId ?? null,
            runId: auth.runId ?? null,
            partyId: auth.partyId ?? null,
          },
        }, false);
      }
    } catch (error) {
      this.metrics.increment('chat_gateway.connection.failed');
      this.logger.error('ChatGateway connection failed', {
        socketId: socket.id,
        error: toErrorMessage(error),
      });

      this.emitToSocket<ChatGatewayConnectionErrorPayload>(
        socket,
        CHAT_GATEWAY_EVENTS.CONNECTION_ERROR,
        {
          code: 'AUTH_FAILED',
          message: toErrorMessage(error),
          deliveredAt: nowMs(),
        },
      );

      socket.disconnect(true);
    } finally {
      this.metrics.timing('chat_gateway.connection.handshake_ms', nowMs() - startedAt);
    }
  }

  private bindSocketHandlers(socket: Socket, sessionId: ChatSessionId): void {
    socket.on(CHAT_GATEWAY_EVENTS.JOIN, async (payload: ChatGatewayJoinPayload, ack?: AckFn<ChatGatewayAckPayload>) => {
      const requestId = this.newRequestId('join');
      await this.guardAck(async () => this.joinRoom(socket, payload, true, requestId), ack, requestId);
    });

    socket.on(CHAT_GATEWAY_EVENTS.LEAVE, async (payload: ChatGatewayLeavePayload, ack?: AckFn<ChatGatewayAckPayload>) => {
      const requestId = this.newRequestId('leave');
      await this.guardAck(async () => this.leaveRoom(socket, payload, requestId), ack, requestId);
    });

    socket.on(CHAT_GATEWAY_EVENTS.ROOM_LIST, async (payload: ChatGatewayRoomListPayload, ack?: AckFn<readonly ChatRoomSnapshot[]>) => {
      const requestId = this.newRequestId('list');
      try {
        const rooms = this.listRooms(socket, payload);
        ack?.(rooms);
        this.logger.debug('ChatGateway room list delivered', {
          requestId,
          count: rooms.length,
        });
      } catch (error) {
        this.emitError(socket, requestId, 'ROOM_LIST_FAILED', toErrorMessage(error));
      }
    });

    socket.on(CHAT_GATEWAY_EVENTS.MESSAGE_SUBMIT, async (payload: ChatGatewayMessageSubmitPayload, ack?: AckFn<ChatGatewayAckPayload>) => {
      const requestId = this.newRequestId('message');
      await this.guardAck(async () => this.submitMessage(socket, payload, requestId), ack, requestId);
    });

    socket.on(CHAT_GATEWAY_EVENTS.PRESENCE_UPDATE, async (payload: ChatGatewayPresencePayload, ack?: AckFn<ChatGatewayAckPayload>) => {
      const requestId = this.newRequestId('presence');
      await this.guardAck(async () => this.updatePresence(socket, payload, requestId), ack, requestId);
    });

    socket.on(CHAT_GATEWAY_EVENTS.TYPING_UPDATE, async (payload: ChatGatewayTypingPayload, ack?: AckFn<ChatGatewayAckPayload>) => {
      const requestId = this.newRequestId('typing');
      await this.guardAck(async () => this.updateTyping(socket, payload, requestId), ack, requestId);
    });

    socket.on(CHAT_GATEWAY_EVENTS.CURSOR_UPDATE, async (payload: ChatGatewayCursorPayload, ack?: AckFn<ChatGatewayAckPayload>) => {
      const requestId = this.newRequestId('cursor');
      await this.guardAck(async () => this.updateCursor(socket, payload, requestId), ack, requestId);
    });

    socket.on(CHAT_GATEWAY_EVENTS.ROOM_SYNC, async (_payload: unknown, ack?: AckFn<ChatGatewayAckPayload>) => {
      const requestId = this.newRequestId('sync');
      await this.guardAck(async () => this.syncRoomsForSession(socket, requestId), ack, requestId);
    });

    socket.on('disconnecting', () => {
      void this.handleDisconnecting(socket, sessionId);
    });

    socket.on('disconnect', (reason) => {
      void this.handleDisconnect(socket, sessionId, reason);
    });
  }

  // ==========================================================================
  // MARK: Join / leave
  // ==========================================================================

  private async joinRoom(
    socket: Socket,
    payload: ChatGatewayJoinPayload,
    emitSync = true,
    requestId = this.newRequestId('join'),
  ): Promise<ChatGatewayAckPayload> {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, true);

    const roomSeed = normalizeRoomSeed(payload.room, context.auth, this.runtime);
    const roomSnapshot = this.registry.joinRoom({
      sessionId: context.sessionId,
      room: roomSeed,
      role: payload.role,
      visibility: payload.visibility,
      joinedAt: nowMs(),
      metadata: payload.metadata,
    });

    socket.join(roomSnapshot.socketRoomName);

    const engineResult = await this.engine.handleTransportEnvelope({
      envelopeId: this.newEnvelopeId(),
      kind: 'JOIN',
      roomId: roomSnapshot.roomId,
      sessionId: context.sessionId,
      userId: context.auth.userId,
      namespace: this.runtime.namespace,
      receivedAt: nowMs(),
      payload: {
        requestId,
        room: roomSnapshot,
      },
    });

    await this.publishEngineResult(engineResult, requestId, socket, roomSnapshot.roomId);

    if (emitSync && this.runtime.enableRoomSyncOnJoin) {
      await this.emitRoomSync(socket, roomSnapshot.roomId);
    }

    if (this.runtime.enableRoomTopologyPackets) {
      await this.publishRoomTopology(roomSnapshot.roomId, requestId);
    }

    if (this.hater?.onRoomJoin) {
      const session = this.registry.getSessionSnapshot(context.sessionId)!;
      await this.hater.onRoomJoin({ room: roomSnapshot, session });
    }

    this.metrics.increment('chat_gateway.room.joined');
    this.metrics.gauge('chat_gateway.rooms.active', this.registry.getMetricsSnapshot().activeRoomCount);

    return {
      ok: engineResult.accepted,
      code: engineResult.code,
      requestId,
      roomId: roomSnapshot.roomId,
      sessionId: context.sessionId,
      detail: engineResult.detail ?? null,
      packetCount: engineResult.packets?.length ?? 0,
      acceptedAt: nowMs(),
      metadata: {
        socketRoomName: roomSnapshot.socketRoomName,
      },
    };
  }

  private async leaveRoom(
    socket: Socket,
    payload: ChatGatewayLeavePayload,
    requestId: string,
  ): Promise<ChatGatewayAckPayload> {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, false);

    const snapshot = this.registry.leaveRoom({
      sessionId: context.sessionId,
      roomId: payload.roomId,
      leftAt: nowMs(),
      reason: payload.reason ?? 'client-request',
    });

    if (snapshot) {
      socket.leave(snapshot.socketRoomName);
    }

    const engineResult = await this.engine.handleTransportEnvelope({
      envelopeId: this.newEnvelopeId(),
      kind: 'LEAVE',
      roomId: payload.roomId,
      sessionId: context.sessionId,
      userId: context.auth.userId,
      namespace: this.runtime.namespace,
      receivedAt: nowMs(),
      payload: {
        requestId,
        reason: payload.reason ?? null,
      },
    });

    await this.publishEngineResult(engineResult, requestId, socket, payload.roomId);

    if (snapshot && this.runtime.enableRoomTopologyPackets) {
      await this.publishRoomTopology(snapshot.roomId, requestId);
    }

    this.metrics.increment('chat_gateway.room.left');

    return {
      ok: engineResult.accepted,
      code: engineResult.code,
      requestId,
      roomId: payload.roomId,
      sessionId: context.sessionId,
      detail: engineResult.detail ?? null,
      packetCount: engineResult.packets?.length ?? 0,
      acceptedAt: nowMs(),
      metadata: {},
    };
  }

  // ==========================================================================
  // MARK: Message submit
  // ==========================================================================

  private async submitMessage(
    socket: Socket,
    payload: ChatGatewayMessageSubmitPayload,
    requestId: string,
  ): Promise<ChatGatewayAckPayload> {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, true, true);

    if (!this.registry.hasMembership(context.sessionId, payload.roomId)) {
      throw new Error(`Session is not joined to room "${payload.roomId}"`);
    }

    const room = this.registry.getRoomSnapshot(payload.roomId);
    if (!room) {
      throw new Error(`Room "${payload.roomId}" does not exist`);
    }

    const sanitized = sanitizeMessagePayload(payload, this.runtime);

    if (sanitized.legacyAction && this.runtime.enableLegacyActionValidation) {
      const validation = this.legacyActionValidator.validate({
        type: sanitized.legacyAction.type,
        card: sanitized.legacyAction.card,
        targetSymbol: sanitized.legacyAction.targetSymbol,
      });

      this.emitToSocket(socket, CHAT_GATEWAY_EVENTS.LEGACY_ACTION_RESULT, {
        requestId,
        valid: validation.valid,
        reason: validation.reason ?? null,
        deliveredAt: nowMs(),
      });

      if (!validation.valid) {
        return {
          ok: false,
          code: 'LEGACY_ACTION_REJECTED',
          requestId,
          roomId: room.roomId,
          sessionId: context.sessionId,
          detail: validation.reason ?? 'Legacy action rejected',
          packetCount: 0,
          acceptedAt: nowMs(),
          metadata: {},
        };
      }
    }

    const engineResult = await this.engine.handleTransportEnvelope({
      envelopeId: this.newEnvelopeId(),
      kind: 'MESSAGE',
      roomId: room.roomId,
      sessionId: context.sessionId,
      userId: context.auth.userId,
      namespace: this.runtime.namespace,
      receivedAt: nowMs(),
      payload: {
        requestId,
        channelId: sanitized.channelId ?? room.channelId,
        clientMessageId: sanitized.clientMessageId ?? null,
        text: sanitized.text ?? null,
        body: sanitized.body ?? [],
        mentions: sanitized.mentions ?? [],
        commands: sanitized.commands ?? [],
        metadata: sanitized.metadata ?? {},
      },
    });

    await this.publishEngineResult(engineResult, requestId, socket, room.roomId);

    if (this.hater?.onMessageSubmit) {
      const session = this.registry.getSessionSnapshot(context.sessionId)!;
      await this.hater.onMessageSubmit({
        room,
        session,
        text: sanitized.text ?? null,
      });
    }

    if (this.runtime.enableRoomTopologyPackets) {
      await this.publishRoomTopology(room.roomId, requestId);
    }

    this.metrics.increment('chat_gateway.message.submitted');

    return {
      ok: engineResult.accepted,
      code: engineResult.code,
      requestId,
      roomId: room.roomId,
      sessionId: context.sessionId,
      detail: engineResult.detail ?? null,
      packetCount: engineResult.packets?.length ?? 0,
      acceptedAt: nowMs(),
      metadata: {
        contracts: this.coopContracts.getContracts().length,
      },
    };
  }

  // ==========================================================================
  // MARK: Presence / typing / cursor
  // ==========================================================================

  private async updatePresence(
    socket: Socket,
    payload: ChatGatewayPresencePayload,
    requestId: string,
  ): Promise<ChatGatewayAckPayload> {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, false);

    const snapshot = this.registry.setPresence({
      sessionId: context.sessionId,
      roomId: payload.roomId ?? null,
      presenceMode: payload.presenceMode,
      visibility: payload.visibility,
      note: payload.note ?? null,
      observedAt: nowMs(),
    });

    const engineResult = await this.engine.handleTransportEnvelope({
      envelopeId: this.newEnvelopeId(),
      kind: 'PRESENCE',
      roomId: payload.roomId ?? null,
      sessionId: context.sessionId,
      userId: context.auth.userId,
      namespace: this.runtime.namespace,
      receivedAt: nowMs(),
      payload: {
        requestId,
        snapshot,
      },
    });

    if (this.runtime.enablePresenceSnapshots && payload.roomId) {
      await this.publishPresenceSnapshot(payload.roomId);
    }

    await this.publishEngineResult(engineResult, requestId, socket, payload.roomId ?? null);

    return {
      ok: engineResult.accepted,
      code: engineResult.code,
      requestId,
      roomId: payload.roomId ?? null,
      sessionId: context.sessionId,
      detail: engineResult.detail ?? null,
      packetCount: engineResult.packets?.length ?? 0,
      acceptedAt: nowMs(),
      metadata: {},
    };
  }

  private async updateTyping(
    socket: Socket,
    payload: ChatGatewayTypingPayload,
    requestId: string,
  ): Promise<ChatGatewayAckPayload> {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, false);

    const snapshot = this.registry.setTyping({
      sessionId: context.sessionId,
      roomId: payload.roomId,
      typingMode: payload.typingMode,
      observedAt: nowMs(),
      cursorToken: payload.cursorToken ?? null,
    });

    const engineResult = await this.engine.handleTransportEnvelope({
      envelopeId: this.newEnvelopeId(),
      kind: 'TYPING',
      roomId: payload.roomId,
      sessionId: context.sessionId,
      userId: context.auth.userId,
      namespace: this.runtime.namespace,
      receivedAt: nowMs(),
      payload: {
        requestId,
        snapshot,
      },
    });

    if (this.runtime.enableTypingSnapshots) {
      await this.publishTypingSnapshot(payload.roomId);
    }

    await this.publishEngineResult(engineResult, requestId, socket, payload.roomId);

    return {
      ok: engineResult.accepted,
      code: engineResult.code,
      requestId,
      roomId: payload.roomId,
      sessionId: context.sessionId,
      detail: engineResult.detail ?? null,
      packetCount: engineResult.packets?.length ?? 0,
      acceptedAt: nowMs(),
      metadata: {},
    };
  }

  private async updateCursor(
    socket: Socket,
    payload: ChatGatewayCursorPayload,
    requestId: string,
  ): Promise<ChatGatewayAckPayload> {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, false);

    const snapshot = this.registry.setCursor({
      sessionId: context.sessionId,
      roomId: payload.roomId,
      cursorToken: payload.cursorToken,
      observedAt: nowMs(),
    });

    const engineResult = await this.engine.handleTransportEnvelope({
      envelopeId: this.newEnvelopeId(),
      kind: 'CURSOR',
      roomId: payload.roomId,
      sessionId: context.sessionId,
      userId: context.auth.userId,
      namespace: this.runtime.namespace,
      receivedAt: nowMs(),
      payload: {
        requestId,
        snapshot,
      },
    });

    if (this.runtime.enableCursorSnapshots) {
      await this.publishCursorSnapshot(payload.roomId);
    }

    await this.publishEngineResult(engineResult, requestId, socket, payload.roomId);

    return {
      ok: engineResult.accepted,
      code: engineResult.code,
      requestId,
      roomId: payload.roomId,
      sessionId: context.sessionId,
      detail: engineResult.detail ?? null,
      packetCount: engineResult.packets?.length ?? 0,
      acceptedAt: nowMs(),
      metadata: {},
    };
  }

  // ==========================================================================
  // MARK: Sync / list / topology
  // ==========================================================================

  private listRooms(
    socket: Socket,
    payload: ChatGatewayRoomListPayload,
  ): readonly ChatRoomSnapshot[] {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, false);

    return this.registry.listRooms({
      includeShadow: payload.includeShadow ?? false,
      includePrivate: payload.includePrivate ?? true,
      includeEmpty: payload.includeEmpty ?? false,
      kind: isRoomKind(payload.kind) ? payload.kind : undefined,
      modeId: payload.modeId ?? undefined,
      runId: payload.runId ?? undefined,
      partyId: payload.partyId ?? undefined,
      tag: payload.tag,
    });
  }

  private async syncRoomsForSession(
    socket: Socket,
    requestId: string,
  ): Promise<ChatGatewayAckPayload> {
    const context = this.requireSocketContext(socket);
    this.bumpRate(context.sessionId, false);

    const rooms = this.registry.listRoomsForSession(context.sessionId);
    for (const room of rooms) {
      await this.emitRoomSync(socket, room.roomId);
    }

    const engineResult = await this.engine.handleTransportEnvelope({
      envelopeId: this.newEnvelopeId(),
      kind: 'ROOM_SYNC_REQUEST',
      roomId: null,
      sessionId: context.sessionId,
      userId: context.auth.userId,
      namespace: this.runtime.namespace,
      receivedAt: nowMs(),
      payload: {
        requestId,
        roomIds: rooms.map((room) => room.roomId),
      },
    });

    await this.publishEngineResult(engineResult, requestId, socket, null);

    return {
      ok: engineResult.accepted,
      code: engineResult.code,
      requestId,
      roomId: null,
      sessionId: context.sessionId,
      detail: engineResult.detail ?? null,
      packetCount: engineResult.packets?.length ?? 0,
      acceptedAt: nowMs(),
      metadata: {
        roomCount: rooms.length,
      },
    };
  }

  private async emitRoomSync(socket: Socket, roomId: ChatRoomId): Promise<void> {
    const context = this.requireSocketContext(socket);
    const room = this.registry.getRoomSnapshot(roomId);
    const session = this.registry.getSessionSnapshot(context.sessionId);

    if (!room || !session) {
      return;
    }

    const payload: ChatGatewayRoomSyncPayload = {
      session,
      room,
      presence: this.registry.getPresence(context.sessionId),
      typing: this.registry.listTypingForRoom(roomId),
      cursors: this.registry.listCursorsForRoom(roomId),
      occupancy: this.registry.roomOccupancy(roomId),
      deliveredAt: nowMs(),
    };

    this.emitToSocket(socket, CHAT_GATEWAY_EVENTS.ROOM_SYNC, payload);
  }

  private async publishRoomTopology(roomId: ChatRoomId, requestId: string): Promise<void> {
    const room = this.registry.getRoomSnapshot(roomId);
    if (!room) {
      return;
    }

    const target = this.registry.resolveFanoutTarget(roomId, {
      onlyReadable: true,
      includeShadowMembers: true,
    });

    const packet: ChatGatewayFanoutPacket = {
      packetId: this.newPacketId(),
      roomId: room.roomId,
      channelId: room.channelId,
      packetType: 'ROOM_TOPOLOGY',
      payload: {
        requestId,
        room,
        occupancy: this.registry.roomOccupancy(room.roomId),
      },
      createdAt: nowMs(),
      causalRequestId: requestId,
      shadow: room.isShadow,
    };

    this.publishPacketToTarget(packet, target);
  }

  private async publishPresenceSnapshot(roomId: ChatRoomId): Promise<void> {
    const room = this.registry.getRoomSnapshot(roomId);
    if (!room) {
      return;
    }

    const target = this.registry.resolveFanoutTarget(roomId, {
      onlyReadable: true,
      includeShadowMembers: true,
    });

    const members = this.registry.listMembersForRoom(roomId);
    const snapshots = members
      .map((member) => this.registry.getPresence(member.sessionId))
      .filter((snapshot): snapshot is ChatPresenceSnapshot => Boolean(snapshot));

    this.publishPacketToTarget({
      packetId: this.newPacketId(),
      roomId: room.roomId,
      channelId: room.channelId,
      packetType: 'PRESENCE',
      payload: {
        roomId,
        snapshots,
        deliveredAt: nowMs(),
      },
      createdAt: nowMs(),
      shadow: room.isShadow,
    }, target);

    this.emitToRoom(room.socketRoomName, CHAT_GATEWAY_EVENTS.PRESENCE_SNAPSHOT, snapshots);
  }

  private async publishTypingSnapshot(roomId: ChatRoomId): Promise<void> {
    const room = this.registry.getRoomSnapshot(roomId);
    if (!room) {
      return;
    }

    const snapshots = this.registry.listTypingForRoom(roomId);
    this.emitToRoom(room.socketRoomName, CHAT_GATEWAY_EVENTS.TYPING_SNAPSHOT, snapshots);
  }

  private async publishCursorSnapshot(roomId: ChatRoomId): Promise<void> {
    const room = this.registry.getRoomSnapshot(roomId);
    if (!room) {
      return;
    }

    const snapshots = this.registry.listCursorsForRoom(roomId);
    this.emitToRoom(room.socketRoomName, CHAT_GATEWAY_EVENTS.CURSOR_SNAPSHOT, snapshots);
  }

  // ==========================================================================
  // MARK: Engine result / fanout
  // ==========================================================================

  private async publishEngineResult(
    result: ChatGatewayEngineResult,
    requestId: string,
    socket: Socket,
    roomId: ChatRoomId | null,
  ): Promise<void> {
    for (const packet of result.packets ?? []) {
      if (packet.roomId.startsWith('session:')) {
        const sessionId = packet.roomId.replace('session:', '') as ChatSessionId;
        const target = this.registry.resolveDirectFanoutForSession(sessionId);
        this.publishPacketToTarget(packet, target);
        continue;
      }

      if (roomId && packet.roomId === roomId) {
        const target = this.registry.resolveFanoutTarget(roomId, {
          onlyReadable: true,
          includeShadowMembers: true,
        });
        this.publishPacketToTarget(packet, target);
        continue;
      }

      if (this.registry.hasRoom(packet.roomId)) {
        const target = this.registry.resolveFanoutTarget(packet.roomId, {
          onlyReadable: true,
          includeShadowMembers: true,
        });
        this.publishPacketToTarget(packet, target);
      }
    }

    if (result.replayHint && this.runtime.enableReplayHints) {
      await this.replay.hint(result.replayHint);
      this.emitToSocket(socket, CHAT_GATEWAY_EVENTS.REPLAY_HINT, result.replayHint);
    }
  }

  private publishPacketToTarget(packet: ChatGatewayFanoutPacket, target: ChatFanoutTarget): void {
    if (target.socketRoomNames.length > 0) {
      for (const roomName of target.socketRoomNames) {
        this.emitToRoom(roomName, CHAT_GATEWAY_EVENTS.FANOUT_PACKET, packet);
      }
    }

    for (const sessionId of target.sessionIds) {
      const sessionTarget = this.registry.resolveDirectFanoutForSession(sessionId);
      for (const socketId of sessionTarget.socketIds) {
        this.emitToSocketId(socketId, CHAT_GATEWAY_EVENTS.FANOUT_PACKET, packet);
      }
    }

    this.metrics.increment('chat_gateway.fanout.packet');
    this.metrics.gauge('chat_gateway.fanout.audience', target.audienceSize);
  }

  // ==========================================================================
  // MARK: Disconnect lifecycle
  // ==========================================================================

  private async handleDisconnecting(socket: Socket, sessionId: ChatSessionId): Promise<void> {
    const rooms = this.registry.listRoomsForSession(sessionId);
    for (const room of rooms) {
      socket.leave(room.socketRoomName);
    }
  }

  private async handleDisconnect(socket: Socket, sessionId: ChatSessionId, reason: string): Promise<void> {
    try {
      this.registry.detachSocket(socket.id);
      const snapshot = this.registry.markDisconnected(sessionId);
      this.socketContext.delete(socket.id);
      this.metrics.increment('chat_gateway.connection.closed');
      this.metrics.gauge('chat_gateway.sessions', this.registry.getMetricsSnapshot().sessionCount);

      this.logger.info('ChatGateway disconnected', {
        socketId: socket.id,
        sessionId,
        reason,
      });

      for (const roomId of snapshot.roomIds) {
        if (this.runtime.enablePresenceSnapshots) {
          await this.publishPresenceSnapshot(roomId);
        }
        if (this.runtime.enableRoomTopologyPackets) {
          await this.publishRoomTopology(roomId, this.newRequestId('disconnect'));
        }
      }
    } catch (error) {
      this.logger.error('ChatGateway disconnect handling failed', {
        socketId: socket.id,
        sessionId,
        reason,
        error: toErrorMessage(error),
      });
    }
  }

  // ==========================================================================
  // MARK: Transport audit loop
  // ==========================================================================

  private scheduleAuditLoop(): void {
    if (this.auditTimer) {
      clearTimeout(this.auditTimer);
      this.auditTimer = null;
    }

    this.auditTimer = setTimeout(() => {
      void this.emitTransportAuditLoop();
    }, this.runtime.emitTransportAuditEveryMs);
  }

  private async emitTransportAuditLoop(): Promise<void> {
    try {
      const metrics = this.registry.getMetricsSnapshot();
      const payloadBase = {
        generatedAt: nowMs(),
        nodeId: this.runtime.nodeId,
        roomCount: metrics.roomCount,
        sessionCount: metrics.sessionCount,
        socketCount: metrics.socketCount,
      };

      const audit: ChatGatewayTransportAudit = {
        auditId: this.newPacketId(),
        ...payloadBase,
        hash: hashAudit(payloadBase),
      };

      await this.audit.publish(audit);

      if (this.namespace) {
        this.emitToNamespace(CHAT_GATEWAY_EVENTS.TRANSPORT_AUDIT, audit);
      }
    } finally {
      this.scheduleAuditLoop();
    }
  }

  // ==========================================================================
  // MARK: Rate / guard / emit helpers
  // ==========================================================================

  private bumpRate(sessionId: ChatSessionId, countEvent: boolean, countMessage = false): void {
    const timestamp = nowMs();
    let bucket = this.rateBuckets.get(sessionId);

    if (!bucket || timestamp - bucket.startedAt >= this.runtime.transportRateWindowMs) {
      bucket = {
        startedAt: timestamp,
        totalEvents: 0,
        totalMessages: 0,
      };
      this.rateBuckets.set(sessionId, bucket);
    }

    if (countEvent) {
      bucket.totalEvents += 1;
    }

    if (countMessage) {
      bucket.totalMessages += 1;
    }

    if (bucket.totalEvents > this.runtime.maxTransportEventsPerWindow) {
      throw new Error('Transport rate limit exceeded');
    }

    if (bucket.totalMessages > this.runtime.maxTransportMessagesPerWindow) {
      throw new Error('Transport message rate limit exceeded');
    }
  }

  private requireSocketContext(socket: Socket): GatewaySocketContext {
    const context = this.socketContext.get(socket.id);
    if (!context) {
      throw new Error('Socket context is not registered');
    }
    return context;
  }

  private buildSessionSeed(socket: Socket, auth: ChatGatewayAuthContext): ChatTransportSessionSeed {
    return {
      sessionId: auth.sessionIdHint ?? undefined,
      socketId: socket.id,
      namespace: this.runtime.namespace,
      identity: {
        userId: auth.userId,
        username: auth.username,
        authLevel: auth.authLevel,
        status: 'ACTIVE',
        partyId: auth.partyId ?? null,
        modeId: auth.modeId ?? null,
        runId: auth.runId ?? null,
        traits: auth.traits ?? [],
        metadata: auth.metadata ?? {},
      },
      connectedAt: nowMs(),
      reconnectOf: auth.sessionIdHint ?? null,
      serverNodeId: this.runtime.nodeId,
      mountTarget: auth.mountTarget ?? null,
      clientVersion: asNullableString(socket.handshake.auth?.clientVersion),
      transportFeatures: toStringArray(socket.handshake.auth?.transportFeatures),
      metadata: {
        address: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'] ?? null,
      },
    };
  }

  private emitError(socket: Socket, requestId: string, code: string, message: string): void {
    this.emitToSocket<ChatGatewayConnectionErrorPayload>(
      socket,
      CHAT_GATEWAY_EVENTS.CONNECTION_ERROR,
      {
        requestId,
        code,
        message,
        deliveredAt: nowMs(),
      },
    );
  }

  private emitToNamespace<T>(event: string, payload: T): void {
    this.namespace?.emit(event, payload);
  }

  private emitToRoom<T>(roomName: string, event: string, payload: T): void {
    this.namespace?.to(roomName).emit(event, payload);
  }

  private emitToSocketId<T>(socketId: ChatSocketId, event: string, payload: T): void {
    this.namespace?.to(socketId).emit(event, payload);
  }

  private emitToSocket<T>(socket: Socket, event: string, payload: T): void {
    socket.emit(event, payload);
  }

  private newRequestId(prefix: string): string {
    return `${prefix}:${randomUUID()}`;
  }

  private newEnvelopeId(): string {
    return `env:${randomUUID()}`;
  }

  private newPacketId(): string {
    return `pkt:${randomUUID()}`;
  }

  private async guardAck(
    operation: () => Promise<ChatGatewayAckPayload>,
    ack: AckFn<ChatGatewayAckPayload> | undefined,
    requestId: string,
  ): Promise<void> {
    try {
      const payload = await operation();
      ack?.(payload);
    } catch (error) {
      const payload: ChatGatewayAckPayload = {
        ok: false,
        code: 'TRANSPORT_ERROR',
        requestId,
        roomId: null,
        sessionId: null,
        detail: toErrorMessage(error),
        packetCount: 0,
        acceptedAt: nowMs(),
        metadata: {},
      };
      ack?.(payload);
    }
  }
}

// ============================================================================
// MARK: Type guards and helpers
// ============================================================================

type AckFn<T> = (payload: T) => void;

function isRoomKind(value: unknown): value is Parameters<ChatRoomRegistry['listRooms']>[0] extends infer Q
  ? Q extends { kind?: infer K }
    ? K
    : never
  : never {
  return value === 'GLOBAL'
    || value === 'SYNDICATE'
    || value === 'DEAL_ROOM'
    || value === 'LOBBY'
    || value === 'DIRECT'
    || value === 'SYSTEM'
    || value === 'RUN'
    || value === 'BATTLE'
    || value === 'SPECTATOR';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    return stableJson(error);
  }

  return 'Unknown transport error';
}

// ============================================================================
// MARK: Factories
// ============================================================================

export function createChatGateway(options: ChatGatewayOptions): ChatGateway {
  return new ChatGateway(options);
}
