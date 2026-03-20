/**
 * ============================================================================
 * POINT ZERO ONE — SERVER CHAT COMPOSITION ROOT + PUBLIC EXPORT SURFACE
 * FILE: pzo-server/src/chat/index.ts
 * VERSION: 2026.03.15
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the canonical public entrypoint for the server-side chat
 * transport lane. It replaces the underbuilt donor `pzo-server/src/index.ts`
 * shape with a true chat composition root that can stand beside your other
 * authoritative engine lanes without collapsing into generic websocket glue.
 *
 * This file intentionally does four jobs at once:
 *
 * 1. It is the stable export surface for every server chat transport module.
 * 2. It is the composition root that wires registries, auth, handlers,
 *    replay, fanout, metrics, and contract law into one server stack.
 * 3. It provides two boot paths so you can evolve without flattening:
 *      - LEGACY_GATEWAY mode for the existing gateway-centric lane.
 *      - HANDLER_RUNTIME mode for the richer socket-contract + handler lane.
 * 4. It gives the repo one place to inspect, bootstrap, and hand off transport
 *    functionality without letting pzo-server become a second backend engine.
 *
 * Governing law
 * -------------
 * - `backend/src/game/engine/chat` remains transcript truth, replay truth,
 *   policy truth, orchestration truth, and learning truth.
 * - `pzo-server/src/chat` remains servant transport, room/session attachment,
 *   socket fanout, replay brokerage, and transport observability.
 * - `pzo-web/src/engines/chat` remains the fast mirror and client-brain lane.
 * - `pzo-web/src/components/chat` remains the thin render shell.
 * - `shared/contracts/chat` remains the shared contract truth.
 *
 * Non-goals
 * ---------
 * - This file does not replace backend chat authority.
 * - This file does not invent transcript truth.
 * - This file does not move ML/DL learning truth into sockets.
 * - This file does not flatten your engine graph into a generic web server.
 *
 * Why this file must be deep instead of thin
 * ------------------------------------------
 * In the donor repo state, `pzo-server/src/ws` is still generic and light,
 * while the new server chat files are intentionally specialized. A thin barrel
 * would throw away the point of that split. The correct `index.ts` is a real
 * systems file: it should know how the pieces fit, how they stay bounded, how
 * to start them, how to inspect them, and how to hand them off safely.
 * ============================================================================
 */

import { randomUUID } from 'node:crypto';
import type { Namespace, Server as SocketServer, Socket } from 'socket.io';

import * as Gateway from './ChatGateway';
import * as RoomRegistry from './ChatRoomRegistry';
import * as SessionRegistry from './ChatSessionRegistry';
import * as ConnectionAuth from './ChatConnectionAuth';
import * as MessageHandler from './ChatMessageHandler';
import * as PresenceHandler from './ChatPresenceHandler';
import * as TypingHandler from './ChatTypingHandler';
import * as CursorHandler from './ChatCursorHandler';
import * as ReplayServiceModule from './ChatReplayService';
import * as Fanout from './ChatFanoutService';
import * as ChatEventFanoutModule from './liveops/ChatEventFanout';
import * as MetricsModule from './ChatMetrics';
import * as SocketContracts from './ChatSocketContracts';

// ============================================================================
// MARK: Namespaced public exports
// ============================================================================

export * as ChatGatewayModule from './ChatGateway';
export * as ChatRoomRegistryModule from './ChatRoomRegistry';
export * as ChatSessionRegistryModule from './ChatSessionRegistry';
export * as ChatConnectionAuthModule from './ChatConnectionAuth';
export * as ChatMessageHandlerModule from './ChatMessageHandler';
export * as ChatPresenceHandlerModule from './ChatPresenceHandler';
export * as ChatTypingHandlerModule from './ChatTypingHandler';
export * as ChatCursorHandlerModule from './ChatCursorHandler';
export * as ChatReplayServiceModule from './ChatReplayService';
export * as ChatFanoutServiceModule from './ChatFanoutService';
export * as ChatEventFanoutModule from './liveops/ChatEventFanout';
export * as ChatMetricsModule from './ChatMetrics';
export * as ChatSocketContractsModule from './ChatSocketContracts';

// ============================================================================
// MARK: Ergonomic direct exports
// ============================================================================

export {
  CHAT_GATEWAY_EVENTS,
  DEFAULT_CHAT_GATEWAY_RUNTIME_CONFIG,
  ChatGateway,
  createChatGateway,
} from './ChatGateway';

export {
  DEFAULT_CHAT_ROOM_REGISTRY_CONFIG,
  ChatRoomRegistry,
  createChatRoomRegistry,
} from './ChatRoomRegistry';

export {
  DEFAULT_CHAT_SESSION_REGISTRY_CONFIG,
  ChatSessionRegistry,
} from './ChatSessionRegistry';

export {
  DEFAULT_CHAT_CONNECTION_AUTH_CONFIG,
  ChatConnectionAuth,
  SignedProofVerifier,
} from './ChatConnectionAuth';

export {
  DEFAULT_CHAT_MESSAGE_HANDLER_CONFIG,
  ChatMessageHandler,
  createChatMessageHandler,
} from './ChatMessageHandler';

export {
  DEFAULT_CHAT_PRESENCE_HANDLER_CONFIG,
  ChatPresenceHandler,
  createChatPresenceHandler,
} from './ChatPresenceHandler';

export {
  DEFAULT_CHAT_TYPING_HANDLER_CONFIG,
  ChatTypingHandler,
  createChatTypingHandler,
} from './ChatTypingHandler';

export {
  DEFAULT_CHAT_CURSOR_HANDLER_CONFIG,
  ChatCursorHandler,
  createChatCursorHandler,
} from './ChatCursorHandler';

export {
  DEFAULT_CHAT_REPLAY_SERVICE_CONFIG,
  ChatReplayService,
} from './ChatReplayService';

export {
  DEFAULT_CHAT_FANOUT_CONFIG,
  ChatFanoutService,
  createChatMessageEnvelope,
  createChatPresenceEnvelope,
  createChatTypingEnvelope,
  createChatCursorEnvelope,
  createChatReplayEnvelope,
  createChatControlEnvelope,
  createChatMetricsEnvelope,
  createGlobalBroadcastPolicy,
  createSyndicateBroadcastPolicy,
  createDealRoomBroadcastPolicy,
  createLobbyBroadcastPolicy,
  createSystemShadowBroadcastPolicy,
  createNpcShadowBroadcastPolicy,
  createRivalryShadowBroadcastPolicy,
  createRescueShadowBroadcastPolicy,
  createLiveopsShadowBroadcastPolicy,
} from './ChatFanoutService';

export {
  CHAT_EVENT_FANOUT_EVENTS,
  DEFAULT_CHAT_EVENT_FANOUT_CONFIG,
  ChatEventFanout,
  createDefaultChatEventFanoutConfig,
  normalizeWorldEventDeliveryWindow,
  createWorldEventFanoutDigest,
  createChatEventFanout,
  createChatEventFanoutNoopEmitter,
} from './liveops/ChatEventFanout';

export {
  CHAT_METRIC_DEFINITIONS,
  ChatMetricsService,
  createChatMetricsService,
  createDefaultChatMetricsConfig,
} from './ChatMetrics';

export {
  CHAT_SOCKET_PROTOCOL_NAME,
  CHAT_SOCKET_PROTOCOL_VERSION,
  CHAT_SOCKET_PROTOCOL_REVISION,
  CHAT_SOCKET_MAX_RAW_FRAME_BYTES,
  CHAT_SOCKET_TYPING_TTL_MS,
  CHAT_SOCKET_CURSOR_TTL_MS,
  CHAT_SOCKET_ACK_TIMEOUT_MS,
  CHAT_SOCKET_REPLAY_REQUEST_TIMEOUT_MS,
  CHAT_SOCKET_HEARTBEAT_GRACE_MS,
  validateInboundSocketFrame,
  serializeSocketFrame,
  createSocketValidationSummary,
} from './ChatSocketContracts';

// ============================================================================
// MARK: Shared composition logger
// ============================================================================

export interface ChatServerTransportLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export const NOOP_CHAT_SERVER_TRANSPORT_LOGGER: ChatServerTransportLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export class ConsoleChatServerTransportLogger
  implements
    ChatServerTransportLogger,
    Fanout.ChatLoggerAdapter,
    ReplayServiceModule.ChatReplayLoggerAdapter,
    Gateway.ChatGatewayLogger,
    MessageHandler.ChatTransportMessageLogger,
    PresenceHandler.ChatPresenceLogger,
    TypingHandler.ChatTypingLogger,
    CursorHandler.ChatCursorLogger,
    ConnectionAuth.ChatConnectionLogger
{
  public debug(message: string, metadata?: Readonly<Record<string, unknown>>): void {
    console.debug(`[chat][debug] ${message}`, metadata ?? {});
  }

  public info(message: string, metadata?: Readonly<Record<string, unknown>>): void {
    console.info(`[chat][info] ${message}`, metadata ?? {});
  }

  public warn(message: string, metadata?: Readonly<Record<string, unknown>>): void {
    console.warn(`[chat][warn] ${message}`, metadata ?? {});
  }

  public error(message: string, metadata?: Readonly<Record<string, unknown>>): void {
    console.error(`[chat][error] ${message}`, metadata ?? {});
  }
}

function ensureLogger(
  logger?: ChatServerTransportLogger | null,
): ChatServerTransportLogger {
  return logger ?? new ConsoleChatServerTransportLogger();
}

function nowMs(): number {
  return Date.now();
}

function normalizeTextChannelId(
  roomId: string,
  requested?: string | null,
): Fanout.ChatChannelId {
  if (requested && requested.trim().length > 0) {
    return requested as Fanout.ChatChannelId;
  }
  return `channel:${roomId}` as Fanout.ChatChannelId;
}

function toRecord(
  value: Readonly<Record<string, unknown>> | null | undefined,
): Record<string, unknown> {
  return value ? { ...value } : {};
}

function toStringArray(value: readonly string[] | undefined | null): string[] {
  return value ? [...value] : [];
}

function inferRoleFromTraits(
  snapshot:
    | RoomRegistry.ChatTransportSessionSnapshot
    | SessionRegistry.ChatSessionAuthoritySnapshot,
): Fanout.ChatRecipientRole {
  const traits =
    'transportSession' in snapshot
      ? snapshot.transportSession.identity.traits ?? []
      : snapshot.identity?.traits ?? [];

  const lower = traits.map((item) => item.toLowerCase());
  if (lower.includes('helper')) return 'HELPER';
  if (lower.includes('hater')) return 'HATER';
  if (lower.includes('npc')) return 'NPC';
  return 'PLAYER';
}

function inferSpectatorFlag(
  session: RoomRegistry.ChatTransportSessionSnapshot,
): boolean {
  const traits = session.identity.traits ?? [];
  return traits.some((item) => item.toLowerCase() === 'spectator');
}

// ============================================================================
// MARK: Backend authority injection contracts
// ============================================================================

export interface ChatServerGatewayAuthorityPort {
  handleGatewayEnvelope(
    envelope: Gateway.ChatGatewayEngineInputEnvelope,
  ): Promise<Gateway.ChatGatewayEngineResult>;
}

export interface ChatServerMessageAuthorityPort {
  submitTransportEnvelope(
    envelope: MessageHandler.ChatTransportBackendEnvelope,
  ): Promise<MessageHandler.ChatTransportBackendSubmissionResult>;

  fetchReplayWindow(
    envelope: MessageHandler.ChatTransportBackendEnvelope,
  ): Promise<MessageHandler.ChatTransportReplayWindowResult>;
}

export interface ChatServerPresenceAuthorityPort {
  submitPresenceEnvelope(
    envelope: PresenceHandler.ChatPresenceBackendEnvelope,
  ): Promise<PresenceHandler.ChatPresenceBackendResult>;
}

export interface ChatServerTypingAuthorityPort {
  submitTypingEnvelope(
    envelope: TypingHandler.ChatTypingBackendEnvelope,
  ): Promise<TypingHandler.ChatTypingBackendResult>;
}

export interface ChatServerCursorAuthorityPort {
  submitCursorEnvelope(
    envelope: CursorHandler.ChatCursorBackendEnvelope,
  ): Promise<CursorHandler.ChatCursorBackendResult>;
}

export interface ChatServerReplayAuthorityPort {
  fetchReplay(
    request: ReplayServiceModule.ChatReplayBridgeRequest,
  ): Promise<ReplayServiceModule.ChatReplaySnapshot>;
}

export interface ChatUnifiedServerAuthorityPort
  extends ChatServerGatewayAuthorityPort,
    ChatServerMessageAuthorityPort,
    ChatServerPresenceAuthorityPort,
    ChatServerTypingAuthorityPort,
    ChatServerCursorAuthorityPort,
    ChatServerReplayAuthorityPort {}

export class RejectingChatUnifiedServerAuthorityPort
  implements ChatUnifiedServerAuthorityPort
{
  public async handleGatewayEnvelope(
    envelope: Gateway.ChatGatewayEngineInputEnvelope,
  ): Promise<Gateway.ChatGatewayEngineResult> {
    return {
      accepted: true,
      code: 'TRANSPORT_ACCEPTED_NO_BACKEND',
      detail: `Gateway transport accepted ${envelope.kind} without injected backend authority`,
      packets: [],
      replayHint: null,
      metadata: {
        authoritative: false,
        reason: 'backend-not-injected',
        envelopeKind: envelope.kind,
      },
    };
  }

  public async submitTransportEnvelope(
    envelope: MessageHandler.ChatTransportBackendEnvelope,
  ): Promise<MessageHandler.ChatTransportBackendSubmissionResult> {
    return {
      accepted: true,
      backendEnvelopeId: `transport-${envelope.envelopeId}`,
      authoritativeMessageId: null,
      authoritativeSequence: null,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: 'ACCEPTED',
      moderationState: null,
      proofRef: null,
      replayRef: null,
      reason: 'No backend authority injected; transport accepted as stub.',
      echoPayload: toRecord(envelope.payload),
      extraMetadata: {
        authoritative: false,
        envelopeKind: envelope.kind,
      },
    };
  }

  public async fetchReplayWindow(
    envelope: MessageHandler.ChatTransportBackendEnvelope,
  ): Promise<MessageHandler.ChatTransportReplayWindowResult> {
    return {
      accepted: true,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      scope: 'AROUND_CURSOR',
      resultId: `replay-window-${envelope.envelopeId}`,
      messages: [],
      hasMoreBefore: false,
      hasMoreAfter: false,
      cursorBefore: null,
      cursorAfter: null,
      reason: 'No backend replay authority injected; returning empty replay window.',
    };
  }

  public async submitPresenceEnvelope(
    envelope: PresenceHandler.ChatPresenceBackendEnvelope,
  ): Promise<PresenceHandler.ChatPresenceBackendResult> {
    return {
      accepted: true,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: 'ACCEPTED',
      occupancySnapshot: null,
      fanoutPayload: toRecord(envelope.payload),
      reason: 'No backend presence authority injected; transport accepted as stub.',
      metadata: {
        authoritative: false,
        envelopeKind: envelope.kind,
      },
    };
  }

  public async submitTypingEnvelope(
    envelope: TypingHandler.ChatTypingBackendEnvelope,
  ): Promise<TypingHandler.ChatTypingBackendResult> {
    return {
      accepted: true,
      backendEnvelopeId: `typing-${envelope.envelopeId}`,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: 'ACCEPTED',
      reason: 'No backend typing authority injected; transport accepted as stub.',
      authoritativeLeaseId: null,
      expiresAt: null,
      echoPayload: toRecord(envelope.payload),
      remoteState: null,
      extraMetadata: {
        authoritative: false,
        envelopeKind: envelope.kind,
      },
    };
  }

  public async submitCursorEnvelope(
    envelope: CursorHandler.ChatCursorBackendEnvelope,
  ): Promise<CursorHandler.ChatCursorBackendResult> {
    return {
      accepted: true,
      backendEnvelopeId: `cursor-${envelope.envelopeId}`,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: 'ACCEPTED',
      reason: 'No backend cursor authority injected; transport accepted as stub.',
      authoritativeLeaseId: null,
      expiresAt: null,
      echoPayload: toRecord(envelope.payload),
      statePayload: null,
      historyPayload: null,
      extraMetadata: {
        authoritative: false,
        envelopeKind: envelope.kind,
      },
    };
  }

  public async fetchReplay(
    request: ReplayServiceModule.ChatReplayBridgeRequest,
  ): Promise<ReplayServiceModule.ChatReplaySnapshot> {
    return {
      replayId: `replay-${request.requestId}`,
      roomId: request.roomId,
      excerptKind: request.excerptKind ?? 'MIXED',
      hydrationMode: request.hydrationMode,
      cursor: {
        roomId: request.roomId,
        channelId: request.channelIds?.[0],
        opaque: 'no-backend-authority',
      },
      messages: [],
      events: [],
      proof: null,
      fetchedAtMs: nowMs(),
      authoritativeSequenceHighWater: 0,
      chunkHintSize: 0,
    };
  }
}

// ============================================================================
// MARK: Gateway / handler backend adapters
// ============================================================================

export class GatewayAuthorityAdapter implements Gateway.ChatGatewayEnginePort {
  public constructor(
    private readonly authority: ChatServerGatewayAuthorityPort,
  ) {}

  public async handleTransportEnvelope(
    envelope: Gateway.ChatGatewayEngineInputEnvelope,
  ): Promise<Gateway.ChatGatewayEngineResult> {
    return this.authority.handleGatewayEnvelope(envelope);
  }
}

export class MessageAuthorityAdapter
  implements MessageHandler.ChatTransportBackendPort
{
  public constructor(
    private readonly authority: ChatServerMessageAuthorityPort,
  ) {}

  public async submitTransportEnvelope(
    envelope: MessageHandler.ChatTransportBackendEnvelope,
  ): Promise<MessageHandler.ChatTransportBackendSubmissionResult> {
    return this.authority.submitTransportEnvelope(envelope);
  }

  public async fetchReplayWindow(
    envelope: MessageHandler.ChatTransportBackendEnvelope,
  ): Promise<MessageHandler.ChatTransportReplayWindowResult> {
    return this.authority.fetchReplayWindow(envelope);
  }
}

export class PresenceAuthorityAdapter
  implements PresenceHandler.ChatPresenceBackendPort
{
  public constructor(
    private readonly authority: ChatServerPresenceAuthorityPort,
  ) {}

  public async submitPresenceEnvelope(
    envelope: PresenceHandler.ChatPresenceBackendEnvelope,
  ): Promise<PresenceHandler.ChatPresenceBackendResult> {
    return this.authority.submitPresenceEnvelope(envelope);
  }
}

export class TypingAuthorityAdapter
  implements TypingHandler.ChatTypingBackendPort
{
  public constructor(
    private readonly authority: ChatServerTypingAuthorityPort,
  ) {}

  public async submitTypingEnvelope(
    envelope: TypingHandler.ChatTypingBackendEnvelope,
  ): Promise<TypingHandler.ChatTypingBackendResult> {
    return this.authority.submitTypingEnvelope(envelope);
  }
}

export class CursorAuthorityAdapter
  implements CursorHandler.ChatCursorBackendPort
{
  public constructor(
    private readonly authority: ChatServerCursorAuthorityPort,
  ) {}

  public async submitCursorEnvelope(
    envelope: CursorHandler.ChatCursorBackendEnvelope,
  ): Promise<CursorHandler.ChatCursorBackendResult> {
    return this.authority.submitCursorEnvelope(envelope);
  }
}

export class ReplayAuthorityAdapter
  implements ReplayServiceModule.ChatReplayBridgeAdapter
{
  public constructor(
    private readonly authority: ChatServerReplayAuthorityPort,
  ) {}

  public async fetchReplay(
    request: ReplayServiceModule.ChatReplayBridgeRequest,
  ): Promise<ReplayServiceModule.ChatReplaySnapshot> {
    return this.authority.fetchReplay(request);
  }
}

// ============================================================================
// MARK: Fanout registry adapters
// ============================================================================

export class FanoutRoomRegistryAdapter
  implements Fanout.ChatRoomRegistryAdapter
{
  public constructor(
    private readonly registry: RoomRegistry.ChatRoomRegistry,
  ) {}

  public getRoom(roomId: string): Fanout.ChatRoomSnapshot | undefined {
    const room = this.registry.getRoomSnapshot(roomId as RoomRegistry.ChatRoomId);
    if (!room) {
      return undefined;
    }

    const activeSessionIds = room.memberSessionIds.filter((sessionId) => {
      const session = this.registry.getSessionSnapshot(sessionId);
      return session?.status === 'ACTIVE';
    });

    const visibleSessionIds = room.memberSessionIds.filter((sessionId) => {
      const presence = this.registry.getPresence(sessionId);
      return presence?.visibility !== 'HIDDEN';
    });

    const spectatorSessionIds = room.memberSessionIds.filter((sessionId) => {
      const session = this.registry.getSessionSnapshot(sessionId);
      return session ? inferSpectatorFlag(session) : false;
    });

    const helperSessionIds = room.memberSessionIds.filter((sessionId) => {
      const session = this.registry.getSessionSnapshot(sessionId);
      if (!session) return false;
      return (session.identity.traits ?? []).some((item) => item.toLowerCase() === 'helper');
    });

    const haterSessionIds = room.memberSessionIds.filter((sessionId) => {
      const session = this.registry.getSessionSnapshot(sessionId);
      if (!session) return false;
      return (session.identity.traits ?? []).some((item) => item.toLowerCase() === 'hater');
    });

    const replaySubscriberSessionIds = room.memberSessionIds.filter((sessionId) => {
      const session = this.registry.getSessionSnapshot(sessionId);
      if (!session) return false;
      return (session.transportFeatures ?? []).some((item) =>
        item.toLowerCase().includes('replay'),
      );
    });

    return {
      roomId: room.roomId,
      memberSessionIds: [...room.memberSessionIds],
      activeSessionIds,
      visibleSessionIds,
      spectatorSessionIds,
      helperSessionIds,
      haterSessionIds,
      replaySubscriberSessionIds,
      metadata: toRecord(room.metadata),
    };
  }

  public getMemberSessionIds(roomId: string): readonly string[] {
    return this.getRoom(roomId)?.memberSessionIds ?? [];
  }

  public getVisibleSessionIds(roomId: string): readonly string[] {
    return this.getRoom(roomId)?.visibleSessionIds ?? [];
  }

  public getActiveSessionIds(roomId: string): readonly string[] {
    return this.getRoom(roomId)?.activeSessionIds ?? [];
  }

  public getSpectatorSessionIds(roomId: string): readonly string[] {
    return this.getRoom(roomId)?.spectatorSessionIds ?? [];
  }

  public getHelperSessionIds(roomId: string): readonly string[] {
    return this.getRoom(roomId)?.helperSessionIds ?? [];
  }

  public getHaterSessionIds(roomId: string): readonly string[] {
    return this.getRoom(roomId)?.haterSessionIds ?? [];
  }

  public getReplaySubscriberSessionIds(roomId: string): readonly string[] {
    return this.getRoom(roomId)?.replaySubscriberSessionIds ?? [];
  }
}

export class FanoutSessionRegistryAdapter
  implements Fanout.ChatSessionRegistryAdapter
{
  public constructor(
    private readonly roomRegistry: RoomRegistry.ChatRoomRegistry,
    private readonly sessionRegistry: SessionRegistry.ChatSessionRegistry,
  ) {}

  public getSession(sessionId: string): Fanout.ChatSessionSnapshot | undefined {
    const transport = this.roomRegistry.getSessionSnapshot(
      sessionId as RoomRegistry.ChatSessionId,
    );
    const authority = this.sessionRegistry.getAuthoritySnapshot(
      sessionId as SessionRegistry.ChatSessionId,
    );

    if (!transport && !authority) {
      return undefined;
    }

    const base = transport ?? authority?.transportSession;
    if (!base) {
      return undefined;
    }

    const role = authority ? inferRoleFromTraits(authority) : inferRoleFromTraits(base);
    const traits = base.identity.traits ?? [];
    const lowerTraits = traits.map((item) => item.toLowerCase());
    const firstRoomId = base.roomIds[0] ?? undefined;

    return {
      sessionId: base.sessionId,
      playerId: base.identity.userId,
      username: base.identity.username,
      roomId: firstRoomId,
      socketId: base.socketIds[0],
      role,
      connected: base.status === 'ACTIVE',
      visible: this.roomRegistry.getPresence(base.sessionId)?.visibility !== 'HIDDEN',
      spectator: lowerTraits.includes('spectator'),
      helper: lowerTraits.includes('helper'),
      hater: lowerTraits.includes('hater'),
      npc: lowerTraits.includes('npc'),
      mutedChannels: [],
      hiddenChannels: [],
      subscribedReplayRooms: lowerTraits.includes('replay') && firstRoomId ? [firstRoomId] : [],
      lastSeenAtMs: base.lastSeenAt,
      attachedAtMs: base.connectedAt,
    };
  }

  public getSessions(sessionIds: readonly string[]): readonly Fanout.ChatSessionSnapshot[] {
    return sessionIds
      .map((sessionId) => this.getSession(sessionId))
      .filter((value): value is Fanout.ChatSessionSnapshot => !!value);
  }

  public getSessionsByPlayerIds(playerIds: readonly string[]): readonly Fanout.ChatSessionSnapshot[] {
    const unique = new Map<string, Fanout.ChatSessionSnapshot>();
    for (const playerId of playerIds) {
      const transportSessions = this.roomRegistry.listSessionsForUser(
        playerId as RoomRegistry.ChatUserId,
      );
      for (const session of transportSessions) {
        const snapshot = this.getSession(session.sessionId);
        if (snapshot) {
          unique.set(snapshot.sessionId, snapshot);
        }
      }
    }
    return [...unique.values()];
  }

  public getSessionsByRoomId(roomId: string): readonly Fanout.ChatSessionSnapshot[] {
    const members = this.roomRegistry.listMembersForRoom(
      roomId as RoomRegistry.ChatRoomId,
    );
    return members
      .map((session) => this.getSession(session.sessionId))
      .filter((value): value is Fanout.ChatSessionSnapshot => !!value);
  }
}

export class SocketIoEmitterAdapter implements Fanout.ChatSocketEmitterAdapter {
  public constructor(
    private readonly namespace: Namespace,
  ) {}

  public emitToSocket(
    socketId: string,
    eventName: Fanout.ChatFanoutEventName,
    payload: unknown,
  ): Promise<void> | void {
    this.namespace.to(socketId).emit(eventName, payload);
  }
}

// ============================================================================
// MARK: Transport-local direct fanout bridges
// ============================================================================

export interface ChatTransportLocalFanoutMetricsPort {
  increment(metric: string, value?: number, tags?: Record<string, string | number | boolean>): void;
}

export class ChatTransportLocalFanoutBridge
  implements
    MessageHandler.ChatTransportFanoutPort,
    PresenceHandler.ChatPresenceFanoutPort,
    TypingHandler.ChatTypingFanoutPort,
    CursorHandler.ChatCursorFanoutPort
{
  public constructor(
    private readonly roomRegistry: RoomRegistry.ChatRoomRegistry,
    private readonly namespace: Namespace,
    private readonly logger: ChatServerTransportLogger,
    private readonly metrics?: ChatTransportLocalFanoutMetricsPort,
  ) {}

  public async fanout(
    envelope:
      | MessageHandler.ChatTransportFanoutEnvelope
      | PresenceHandler.ChatPresenceFanoutEnvelope
      | TypingHandler.ChatTypingFanoutEnvelope
      | CursorHandler.ChatCursorFanoutEnvelope,
  ): Promise<void> {
    const targetSessionIds =
      'targets' in envelope && envelope.targets.length > 0
        ? [...envelope.targets]
        : this.roomRegistry.resolveFanoutTarget(
            envelope.roomId as RoomRegistry.ChatRoomId,
          ).sessionIds;

    const socketIds = new Set<string>();
    for (const sessionId of targetSessionIds) {
      const snapshot = this.roomRegistry.getSessionSnapshot(
        sessionId as RoomRegistry.ChatSessionId,
      );
      for (const socketId of snapshot?.socketIds ?? []) {
        socketIds.add(socketId);
      }
    }

    for (const socketId of socketIds) {
      this.namespace.to(socketId).emit(envelope.event, envelope.payload);
    }

    this.metrics?.increment('chat_transport_local_fanout_total', socketIds.size, {
      roomId: envelope.roomId,
      channelId: envelope.channelId ?? 'none',
      event: envelope.event,
    });

    this.logger.debug('Executed transport-local chat fanout', {
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      event: envelope.event,
      sessionCount: targetSessionIds.length,
      socketCount: socketIds.size,
    });
  }
}

// ============================================================================
// MARK: Metrics bridges
// ============================================================================

export class ChatFanoutMetricsBridge implements Fanout.ChatMetricsAdapter {
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
  ) {}

  public increment(
    metric: string,
    value = 1,
    tags?: Record<string, string | number | boolean>,
  ): void {
    this.metrics.increment('gateway_transport_inbound_total' as never, value as never, tags as never);
  }

  public observe(
    metric: string,
    value: number,
    tags?: Record<string, string | number | boolean>,
  ): void {
    this.metrics.histogram('gateway_handle_duration_ms' as never, value as never, tags as never);
  }
}

export class ChatReplayMetricsBridge
  implements ReplayServiceModule.ChatReplayMetricsAdapter
{
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
  ) {}

  public increment(
    metric: string,
    value = 1,
    tags?: Record<string, string | number | boolean>,
  ): void {
    this.metrics.increment('replay_request_total' as never, value as never, tags as never);
  }

  public observe(
    metric: string,
    value: number,
    tags?: Record<string, string | number | boolean>,
  ): void {
    this.metrics.histogram('replay_request_duration_ms' as never, value as never, tags as never);
  }
}

export class ChatGatewayMetricsBridge implements Gateway.ChatGatewayMetricsPort {
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
  ) {}

  public increment(
    name: string,
    value = 1,
    tags?: Readonly<Record<string, string>>,
  ): void {
    this.metrics.increment('gateway_transport_inbound_total' as never, value as never, tags as never);
  }

  public gauge(
    name: string,
    value: number,
    tags?: Readonly<Record<string, string>>,
  ): void {
    this.metrics.gauge('gateway_active_connections' as never, value as never, tags as never);
  }

  public timing(
    name: string,
    ms: number,
    tags?: Readonly<Record<string, string>>,
  ): void {
    this.metrics.histogram('gateway_handle_duration_ms' as never, ms as never, tags as never);
  }
}

export class ChatMessageHandlerMetricsBridge
  implements MessageHandler.ChatTransportMessageMetricsPort
{
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
  ) {}

  public recordAccepted(
    kind: MessageHandler.ChatTransportSubmitKind,
    roomId: string | null,
  ): void {
    this.metrics.recordMessageIntent(true, {
      roomId: roomId ?? undefined,
      kind,
      channelId: undefined,
      attachmentCount: 0,
      isReplay: kind === 'REPLAY_FETCH',
      isCommand: kind === 'COMMAND',
    });
  }

  public recordRejected(
    kind: MessageHandler.ChatTransportSubmitKind,
    reason: MessageHandler.ChatTransportRejectReason,
    roomId: string | null,
  ): void {
    this.metrics.recordContractReject('MALFORMED_PAYLOAD', undefined, roomId ?? undefined);
    this.metrics.recordMessageIntent(false, {
      roomId: roomId ?? undefined,
      kind,
      channelId: undefined,
      attachmentCount: 0,
      isReplay: kind === 'REPLAY_FETCH',
      isCommand: kind === 'COMMAND',
    });
  }

  public recordForwarded(
    kind: MessageHandler.ChatTransportSubmitKind,
    roomId: string | null,
  ): void {
    this.metrics.increment('gateway_transport_outbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      kind,
      transport: 'message-handler',
    } as never);
  }

  public recordRateLimited(
    kind: MessageHandler.ChatTransportSubmitKind,
    roomId: string | null,
  ): void {
    this.metrics.recordContractReject('RATE_LIMITED', undefined, roomId ?? undefined);
  }

  public recordDedupe(
    kind: MessageHandler.ChatTransportSubmitKind,
    roomId: string | null,
  ): void {
    this.metrics.increment('gateway_transport_inbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      kind,
      transport: 'message-handler-dedupe',
    } as never);
  }
}

export class ChatPresenceHandlerMetricsBridge
  implements PresenceHandler.ChatPresenceMetricsPort
{
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
  ) {}

  public recordAccepted(
    kind: PresenceHandler.ChatPresenceEventKind,
    roomId: string | null,
  ): void {
    this.metrics.recordPresenceIntent(true, roomId ?? '__server__');
  }

  public recordRejected(
    kind: PresenceHandler.ChatPresenceEventKind,
    reason: PresenceHandler.ChatPresenceRejectReason,
    roomId: string | null,
  ): void {
    this.metrics.recordPresenceIntent(false, roomId ?? '__server__');
  }

  public recordRateLimited(
    kind: PresenceHandler.ChatPresenceEventKind,
    roomId: string | null,
  ): void {
    this.metrics.recordContractReject('RATE_LIMITED', undefined, roomId ?? undefined);
  }

  public recordHeartbeat(roomId: string | null): void {
    this.metrics.recordHeartbeatAccepted('presence-heartbeat', 0, roomId ?? undefined);
  }

  public recordOccupancyRequest(roomId: string | null): void {
    this.metrics.increment('gateway_transport_inbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      transport: 'presence-occupancy',
    } as never);
  }

  public recordFanout(roomId: string | null): void {
    this.metrics.increment('gateway_transport_outbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      transport: 'presence-fanout',
    } as never);
  }
}

export class ChatTypingHandlerMetricsBridge
  implements TypingHandler.ChatTypingMetricsPort
{
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
  ) {}

  public recordAccepted(
    kind: TypingHandler.ChatTypingEventKind,
    roomId: string | null,
  ): void {
    this.metrics.recordTypingIntent(true, roomId ?? '__server__', 'unknown' as Fanout.ChatChannelId, true);
  }

  public recordRejected(
    kind: TypingHandler.ChatTypingEventKind,
    reason: TypingHandler.ChatTypingRejectReason,
    roomId: string | null,
  ): void {
    this.metrics.recordTypingIntent(false, roomId ?? '__server__', 'unknown' as Fanout.ChatChannelId, true);
  }

  public recordRateLimited(
    kind: TypingHandler.ChatTypingEventKind,
    roomId: string | null,
  ): void {
    this.metrics.recordContractReject('RATE_LIMITED', undefined, roomId ?? undefined);
  }

  public recordLeaseExpired(roomId: string | null): void {
    this.metrics.increment('gateway_transport_inbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      transport: 'typing-lease-expired',
    } as never);
  }

  public recordRemoteStateRequest(roomId: string | null): void {
    this.metrics.increment('gateway_transport_inbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      transport: 'typing-remote-state-request',
    } as never);
  }

  public recordFanout(roomId: string | null): void {
    this.metrics.increment('gateway_transport_outbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      transport: 'typing-fanout',
    } as never);
  }
}

export class ChatCursorHandlerMetricsBridge
  implements CursorHandler.ChatCursorMetricsPort
{
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
  ) {}

  public recordAccepted(
    kind: CursorHandler.ChatCursorEventKind,
    roomId: string | null,
  ): void {
    this.metrics.recordCursorIntent(true, roomId ?? '__server__', 'unknown' as Fanout.ChatChannelId, false);
  }

  public recordRejected(
    kind: CursorHandler.ChatCursorEventKind,
    reason: CursorHandler.ChatCursorRejectReason,
    roomId: string | null,
  ): void {
    this.metrics.recordCursorIntent(false, roomId ?? '__server__', 'unknown' as Fanout.ChatChannelId, false);
  }

  public recordRateLimited(
    kind: CursorHandler.ChatCursorEventKind,
    roomId: string | null,
  ): void {
    this.metrics.recordContractReject('RATE_LIMITED', undefined, roomId ?? undefined);
  }

  public recordHistoryRequest(roomId: string | null): void {
    this.metrics.increment('gateway_transport_inbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      transport: 'cursor-history-request',
    } as never);
  }

  public recordFanout(roomId: string | null): void {
    this.metrics.increment('gateway_transport_outbound_total' as never, 1 as never, {
      roomId: roomId ?? 'none',
      transport: 'cursor-fanout',
    } as never);
  }
}

// ============================================================================
// MARK: Gateway replay / audit defaults
// ============================================================================

export class GatewayReplayPortAdapter implements Gateway.ChatGatewayReplayPort {
  public async hint(
    hint: Gateway.ChatGatewayReplayHint,
  ): Promise<void> {
    void hint;
  }
}

export class GatewayAuditPortAdapter implements Gateway.ChatGatewayAuditPort {
  public constructor(
    private readonly logger: ChatServerTransportLogger,
  ) {}

  public async publish(
    audit: Gateway.ChatGatewayTransportAudit,
  ): Promise<void> {
    this.logger.debug('Published transport audit snapshot', {
      sessionCount: audit.sessionCount,
      roomCount: audit.roomCount,
      hash: audit.hash,
    });
  }
}

// ============================================================================
// MARK: Contract-frame helpers
// ============================================================================

export interface ChatSocketFrameEmissionPort {
  emit(eventName: string, payload: unknown): void;
}

export class ChatSocketContractRuntime {
  public constructor(
    private readonly metrics: MetricsModule.ChatMetricsService,
    private readonly logger: ChatServerTransportLogger,
  ) {}

  public validate(raw: unknown): SocketContracts.ChatSocketValidationResult {
    const result = SocketContracts.validateInboundSocketFrame(raw);
    this.metrics.recordValidationSummary(
      SocketContracts.createSocketValidationSummary(result),
      0,
    );
    return result;
  }

  public emitHelloAccepted(
    target: ChatSocketFrameEmissionPort,
    payload: SocketContracts.ChatHelloAcceptedPayload,
  ): void {
    const frame: SocketContracts.ChatHelloAcceptedFrame = {
      event: 'chat:hello:accepted',
      meta: {
        direction: 'SERVER_TO_CLIENT',
        protocol: SocketContracts.CHAT_SOCKET_PROTOCOL_NAME,
        version: SocketContracts.CHAT_SOCKET_PROTOCOL_VERSION,
        revision: SocketContracts.CHAT_SOCKET_PROTOCOL_REVISION,
        requestId: `hello:${payload.sessionId}`,
        correlationId: payload.sessionId,
        traceId: randomUUID(),
        emittedAt: nowMs(),
      },
      payload,
    };

    target.emit(frame.event, frame);
    this.metrics.recordControlEvent(frame.event, undefined, undefined);
  }

  public emitResumeAccepted(
    target: ChatSocketFrameEmissionPort,
    payload: SocketContracts.ChatResumeAcceptedPayload,
  ): void {
    const frame: SocketContracts.ChatResumeAcceptedFrame = {
      event: 'chat:resume:accepted',
      meta: {
        direction: 'SERVER_TO_CLIENT',
        protocol: SocketContracts.CHAT_SOCKET_PROTOCOL_NAME,
        version: SocketContracts.CHAT_SOCKET_PROTOCOL_VERSION,
        revision: SocketContracts.CHAT_SOCKET_PROTOCOL_REVISION,
        requestId: `resume:${payload.sessionId}`,
        correlationId: payload.sessionId,
        traceId: randomUUID(),
        emittedAt: nowMs(),
      },
      payload,
    };

    target.emit(frame.event, frame);
    this.metrics.recordControlEvent(frame.event, undefined, undefined);
  }

  public emitError(
    target: ChatSocketFrameEmissionPort,
    payload: SocketContracts.ChatErrorPayload,
  ): void {
    const frame: SocketContracts.ChatErrorFrame = {
      event: 'chat:error',
      meta: {
        direction: 'SERVER_TO_CLIENT',
        protocol: SocketContracts.CHAT_SOCKET_PROTOCOL_NAME,
        version: SocketContracts.CHAT_SOCKET_PROTOCOL_VERSION,
        revision: SocketContracts.CHAT_SOCKET_PROTOCOL_REVISION,
        requestId: payload.requestId ?? `error:${randomUUID()}`,
        correlationId: payload.correlationId ?? null,
        traceId: randomUUID(),
        emittedAt: nowMs(),
      },
      payload,
    };

    target.emit(frame.event, frame);
    this.metrics.recordControlEvent(frame.event, undefined, undefined);
  }

  public emitWarning(
    target: ChatSocketFrameEmissionPort,
    payload: SocketContracts.ChatContractWarningPayload,
  ): void {
    const frame: SocketContracts.ChatContractWarningFrame = {
      event: 'chat:warning',
      meta: {
        direction: 'SERVER_TO_CLIENT',
        protocol: SocketContracts.CHAT_SOCKET_PROTOCOL_NAME,
        version: SocketContracts.CHAT_SOCKET_PROTOCOL_VERSION,
        revision: SocketContracts.CHAT_SOCKET_PROTOCOL_REVISION,
        requestId: payload.requestId ?? `warning:${randomUUID()}`,
        correlationId: payload.correlationId ?? null,
        traceId: randomUUID(),
        emittedAt: nowMs(),
      },
      payload,
    };

    target.emit(frame.event, frame);
    this.metrics.recordControlEvent(frame.event, undefined, undefined);
  }
}

// ============================================================================
// MARK: Aggregate config
// ============================================================================

export type ChatServerTransportBootMode =
  | 'NONE'
  | 'LEGACY_GATEWAY'
  | 'HANDLER_RUNTIME';

export interface ChatServerTransportIndexConfig {
  readonly nodeId: string;
  readonly namespace: string;
  readonly bootMode: ChatServerTransportBootMode;
  readonly allowAnonymous: boolean;
  readonly autoJoinRoomHint: boolean;
  readonly emitHelloAcceptedFrames: boolean;
  readonly emitResumeAcceptedFrames: boolean;
  readonly emitErrorsAsContractFrames: boolean;
  readonly disconnectOnAuthFailure: boolean;
  readonly disconnectOnUnhandledHandlerError: boolean;
  readonly serviceMetricsRoomId: string;
  readonly serviceMetricsChannelId: Fanout.ChatChannelId;
  readonly legacyGateway: Partial<Gateway.ChatGatewayRuntimeConfig>;
  readonly roomRegistry: Partial<RoomRegistry.ChatRoomRegistryConfig>;
  readonly sessionRegistry: Partial<SessionRegistry.ChatSessionRegistryConfig>;
  readonly connectionAuth: Partial<ConnectionAuth.ChatConnectionAuthConfig>;
  readonly messageHandler: Partial<MessageHandler.ChatTransportMessageHandlerConfig>;
  readonly presenceHandler: Partial<PresenceHandler.ChatPresenceHandlerConfig>;
  readonly typingHandler: Partial<TypingHandler.ChatTypingHandlerConfig>;
  readonly cursorHandler: Partial<CursorHandler.ChatCursorHandlerConfig>;
  readonly replayService: Partial<ReplayServiceModule.ChatReplayServiceConfig>;
  readonly fanoutService: Partial<Fanout.ChatFanoutServiceConfig>;
  readonly metrics: Partial<MetricsModule.ChatMetricsConfig>;
}

export function createDefaultChatServerTransportIndexConfig(
  partial: Partial<ChatServerTransportIndexConfig> = {},
): ChatServerTransportIndexConfig {
  return {
    nodeId: partial.nodeId ?? `pzo-server-chat:${randomUUID()}`,
    namespace:
      partial.namespace ?? Gateway.DEFAULT_CHAT_GATEWAY_RUNTIME_CONFIG.namespace,
    bootMode: partial.bootMode ?? 'LEGACY_GATEWAY',
    allowAnonymous: partial.allowAnonymous ?? false,
    autoJoinRoomHint: partial.autoJoinRoomHint ?? true,
    emitHelloAcceptedFrames: partial.emitHelloAcceptedFrames ?? true,
    emitResumeAcceptedFrames: partial.emitResumeAcceptedFrames ?? true,
    emitErrorsAsContractFrames: partial.emitErrorsAsContractFrames ?? true,
    disconnectOnAuthFailure: partial.disconnectOnAuthFailure ?? true,
    disconnectOnUnhandledHandlerError:
      partial.disconnectOnUnhandledHandlerError ?? false,
    serviceMetricsRoomId: partial.serviceMetricsRoomId ?? '__server__',
    serviceMetricsChannelId:
      partial.serviceMetricsChannelId ?? ('SYSTEM_SHADOW' as Fanout.ChatChannelId),
    legacyGateway: {
      ...partial.legacyGateway,
      namespace: partial.legacyGateway?.namespace ?? partial.namespace ?? Gateway.DEFAULT_CHAT_GATEWAY_RUNTIME_CONFIG.namespace,
      allowAnonymous:
        partial.legacyGateway?.allowAnonymous ?? partial.allowAnonymous ?? false,
      nodeId: partial.legacyGateway?.nodeId ?? partial.nodeId ?? `pzo-server-chat:${randomUUID()}`,
    },
    roomRegistry: {
      ...partial.roomRegistry,
      defaultNamespace:
        partial.roomRegistry?.defaultNamespace ?? partial.namespace ?? Gateway.DEFAULT_CHAT_GATEWAY_RUNTIME_CONFIG.namespace,
      defaultServerNodeId:
        partial.roomRegistry?.defaultServerNodeId ?? partial.nodeId ?? null,
    },
    sessionRegistry: {
      ...partial.sessionRegistry,
      nodeId:
        partial.sessionRegistry?.nodeId ?? partial.nodeId ?? `pzo-server-chat:${randomUUID()}`,
    },
    connectionAuth: {
      ...partial.connectionAuth,
      allowAnonymousFallback:
        partial.connectionAuth?.allowAnonymousFallback ?? partial.allowAnonymous ?? false,
      expectedNamespace:
        partial.connectionAuth?.expectedNamespace ?? partial.namespace ?? Gateway.DEFAULT_CHAT_GATEWAY_RUNTIME_CONFIG.namespace,
    },
    messageHandler: {
      ...partial.messageHandler,
    },
    presenceHandler: {
      ...partial.presenceHandler,
    },
    typingHandler: {
      ...partial.typingHandler,
    },
    cursorHandler: {
      ...partial.cursorHandler,
    },
    replayService: {
      ...partial.replayService,
    },
    fanoutService: {
      ...partial.fanoutService,
    },
    metrics: {
      ...partial.metrics,
      serviceInstanceId:
        partial.metrics?.serviceInstanceId ?? `pzo-server-chat-metrics:${randomUUID()}`,
      publishRoomId:
        partial.metrics?.publishRoomId ?? partial.serviceMetricsRoomId ?? '__server__',
      publishChannelId:
        partial.metrics?.publishChannelId ??
        partial.serviceMetricsChannelId ??
        ('SYSTEM_SHADOW' as Fanout.ChatChannelId),
    },
  };
}

// ============================================================================
// MARK: Dependency bag
// ============================================================================

export interface ChatServerTransportIndexDependencies {
  readonly io: SocketServer;
  readonly logger?: ChatServerTransportLogger | null;
  readonly config?: Partial<ChatServerTransportIndexConfig>;
  readonly authority?: ChatUnifiedServerAuthorityPort | null;
  readonly gatewayAuthority?: ChatServerGatewayAuthorityPort | null;
  readonly messageAuthority?: ChatServerMessageAuthorityPort | null;
  readonly presenceAuthority?: ChatServerPresenceAuthorityPort | null;
  readonly typingAuthority?: ChatServerTypingAuthorityPort | null;
  readonly cursorAuthority?: ChatServerCursorAuthorityPort | null;
  readonly replayAuthority?: ChatServerReplayAuthorityPort | null;
  readonly tokenVerifier?: ConnectionAuth.ChatConnectionTokenVerifierPort | null;
  readonly trustPolicy?: ConnectionAuth.ChatConnectionTrustPolicyPort | null;
  readonly banPort?: ConnectionAuth.ChatConnectionBanPort | null;
  readonly gatewayAudit?: Gateway.ChatGatewayAuditPort | null;
  readonly gatewayReplay?: Gateway.ChatGatewayReplayPort | null;
}

// ============================================================================
// MARK: Inspection surfaces
// ============================================================================

export interface ChatServerTransportInspectionSnapshot {
  readonly generatedAt: number;
  readonly bootMode: ChatServerTransportBootMode;
  readonly namespace: string;
  readonly roomRegistryMetrics: RoomRegistry.ChatRegistryMetricsSnapshot;
  readonly roomRegistryAudit: RoomRegistry.ChatRegistryAuditSnapshot;
  readonly sessionRegistryAudit: SessionRegistry.ChatSessionAuthorityAuditSnapshot;
  readonly messageMetrics: MessageHandler.ChatTransportMessageHandlerMetricsSnapshot;
  readonly presenceMetrics: PresenceHandler.ChatPresenceMetricsSnapshot;
  readonly typingMetrics: TypingHandler.ChatTypingMetricsSnapshot;
  readonly cursorMetrics: CursorHandler.ChatCursorMetricsSnapshot;
  readonly transportMetrics: MetricsModule.ChatMetricsSnapshot;
  readonly replayCacheRecordCount: number;
  readonly fanoutOutboxRecordCount: number;
  readonly activeNamespaces: readonly string[];
}

export interface ChatServerTransportSocketBindingSet {
  readonly message: MessageHandler.ChatSocketMessageHandlerBinding;
  readonly presence: PresenceHandler.ChatPresenceSocketBinding;
  readonly typing: TypingHandler.ChatTypingSocketBinding;
  readonly cursor: CursorHandler.ChatCursorSocketBinding;
  detach(): void;
}

export interface ChatServerTransportAdmissionRecord {
  readonly auth: ConnectionAuth.ChatConnectionAuthContext;
  readonly admission: SessionRegistry.ChatSessionAdmissionResult;
  readonly bindings: ChatServerTransportSocketBindingSet;
  readonly connectedAt: number;
}

// ============================================================================
// MARK: Handler-runtime namespace binder
// ============================================================================

export class ChatServerHandlerRuntime {
  private namespace: Namespace | null = null;
  private readonly activeBindings = new Map<string, ChatServerTransportAdmissionRecord>();

  public constructor(
    private readonly io: SocketServer,
    private readonly namespaceName: string,
    private readonly connectionAuth: ConnectionAuth.ChatConnectionAuth,
    private readonly sessionRegistry: SessionRegistry.ChatSessionRegistry,
    private readonly roomRegistry: RoomRegistry.ChatRoomRegistry,
    private readonly messageHandler: MessageHandler.ChatMessageHandler,
    private readonly presenceHandler: PresenceHandler.ChatPresenceHandler,
    private readonly typingHandler: TypingHandler.ChatTypingHandler,
    private readonly cursorHandler: CursorHandler.ChatCursorHandler,
    private readonly metrics: MetricsModule.ChatMetricsService,
    private readonly contractRuntime: ChatSocketContractRuntime,
    private readonly logger: ChatServerTransportLogger,
    private readonly config: ChatServerTransportIndexConfig,
  ) {}

  public start(): this {
    if (this.namespace) {
      return this;
    }

    this.namespace = this.io.of(this.namespaceName);
    this.namespace.on('connection', (socket) => {
      void this.handleConnection(socket);
    });

    this.logger.info('Started handler-runtime chat namespace', {
      namespace: this.namespaceName,
      bootMode: 'HANDLER_RUNTIME',
    });

    return this;
  }

  public stop(): void {
    for (const record of this.activeBindings.values()) {
      record.bindings.detach();
    }
    this.activeBindings.clear();
    this.namespace = null;
  }

  public currentNamespace(): Namespace | null {
    return this.namespace;
  }

  public getAdmissionRecord(socketId: string): ChatServerTransportAdmissionRecord | null {
    return this.activeBindings.get(socketId) ?? null;
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const startedAt = nowMs();
    try {
      const auth = await this.connectionAuth.authenticate(socket);
      const admission = await this.sessionRegistry.admit({
        socketId: socket.id,
        namespace: this.namespaceName,
        auth,
        mountTarget: auth.mountTarget ?? null,
        clientVersion: auth.clientVersion ?? null,
        transportFeatures: auth.transportFeatures ?? [],
        serverNodeId: this.config.nodeId,
        metadata: {
          source: 'pzo-server/src/chat/index.ts',
          runtime: 'HANDLER_RUNTIME',
          roomIdHint: auth.roomIdHint ?? null,
        },
      });

      const handlerAuth: ConnectionAuth.ChatGatewayAuthContext = {
        ...auth,
        sessionIdHint: admission.session.sessionId,
      };

      const bindings = this.attachBindings(socket, handlerAuth);
      const record: ChatServerTransportAdmissionRecord = {
        auth: handlerAuth,
        admission,
        bindings,
        connectedAt: nowMs(),
      };
      this.activeBindings.set(socket.id, record);

      this.metrics.recordConnectionOpen(admission.session.sessionId, {
        namespace: this.namespaceName,
        bootMode: 'HANDLER_RUNTIME',
      });
      this.metrics.recordSessionBind(true, admission.session.sessionId, auth.roomIdHint ?? undefined);

      if (this.config.autoJoinRoomHint && auth.roomIdHint) {
        const room = this.roomRegistry.ensureRoom({
          roomId: auth.roomIdHint,
          channelId: normalizeTextChannelId(auth.roomIdHint, null),
          kind: 'LOBBY',
          namespace: this.namespaceName,
          mountTarget: auth.mountTarget ?? 'UNKNOWN',
          modeId: auth.modeId ?? null,
          runId: auth.runId ?? null,
          partyId: auth.partyId ?? null,
          metadata: toRecord(auth.metadata),
        });

        this.roomRegistry.joinRoom({
          sessionId: admission.session.sessionId,
          room: {
            roomId: room.roomId,
            channelId: room.channelId,
            kind: room.kind,
            namespace: room.namespace,
            mountTarget: room.mountTarget,
            modeId: room.modeId,
            runId: room.runId,
            partyId: room.partyId,
          },
          role: 'MEMBER',
          visibility: 'VISIBLE',
          joinedAt: nowMs(),
          metadata: {
            source: 'roomIdHint',
          },
        });

        socket.join(room.socketRoomName);
      }

      if (this.config.emitHelloAcceptedFrames) {
        this.contractRuntime.emitHelloAccepted(socket, {
          sessionId: admission.session.sessionId,
          namespace: this.namespaceName,
          serverNodeId: this.config.nodeId,
          roomIds: [...admission.session.roomIds],
          capabilitySet: toStringArray(auth.transportFeatures),
          connectedAt: record.connectedAt,
        });
      }

      socket.on('disconnect', (reason) => {
        void this.handleDisconnect(socket, reason);
      });

      this.logger.info('Handler-runtime chat connection admitted', {
        socketId: socket.id,
        sessionId: admission.session.sessionId,
        userId: auth.userId,
        namespace: this.namespaceName,
      });
    } catch (error) {
      this.metrics.recordConnectionClose(socket.id, {
        namespace: this.namespaceName,
        accepted: false,
      });

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Handler-runtime chat connection failed', {
        socketId: socket.id,
        namespace: this.namespaceName,
        error: message,
      });

      if (this.config.emitErrorsAsContractFrames) {
        this.contractRuntime.emitError(socket, {
          code: 'AUTH_FAILED',
          message,
          requestId: `connect:${socket.id}`,
          correlationId: socket.id,
        });
      }

      if (this.config.disconnectOnAuthFailure) {
        socket.disconnect(true);
      }
    } finally {
      this.metrics.recordGatewayHandleLatency(
        nowMs() - startedAt,
        'chat:hello',
        undefined,
        undefined,
      );
    }
  }

  private attachBindings(
    socket: Socket,
    auth: ConnectionAuth.ChatGatewayAuthContext,
  ): ChatServerTransportSocketBindingSet {
    const message = this.messageHandler.attachSocket({
      socket,
      auth,
      transportSocketId: socket.id,
    });

    const presence = this.presenceHandler.attachSocket({
      socket,
      auth,
      transportSocketId: socket.id,
    });

    const typing = this.typingHandler.attachSocket({
      socket,
      auth,
      transportSocketId: socket.id,
    });

    const cursor = this.cursorHandler.attachSocket({
      socket,
      auth,
      transportSocketId: socket.id,
    });

    return {
      message,
      presence,
      typing,
      cursor,
      detach: () => {
        message.detach();
        presence.detach();
        typing.detach();
        cursor.detach();
      },
    };
  }

  private async handleDisconnect(socket: Socket, reason: string): Promise<void> {
    const record = this.activeBindings.get(socket.id);
    if (!record) {
      return;
    }

    record.bindings.detach();
    this.activeBindings.delete(socket.id);
    this.sessionRegistry.markDisconnected({
      sessionId: record.admission.session.sessionId,
      socketId: socket.id,
      reason,
    });

    this.metrics.recordConnectionClose(record.admission.session.sessionId, {
      namespace: this.namespaceName,
      accepted: true,
    });

    this.logger.info('Handler-runtime chat connection disconnected', {
      socketId: socket.id,
      sessionId: record.admission.session.sessionId,
      reason,
    });
  }
}

// ============================================================================
// MARK: Aggregate stack
// ============================================================================

export class ChatServerTransportStack {
  public readonly logger: ChatServerTransportLogger;
  public readonly config: ChatServerTransportIndexConfig;
  public readonly authority: ChatUnifiedServerAuthorityPort;
  public readonly roomRegistry: RoomRegistry.ChatRoomRegistry;
  public readonly sessionRegistry: SessionRegistry.ChatSessionRegistry;
  public readonly connectionAuth: ConnectionAuth.ChatConnectionAuth;
  public readonly fanoutService: Fanout.ChatFanoutService;
  public readonly replayService: ReplayServiceModule.ChatReplayService;
  public readonly metricsService: MetricsModule.ChatMetricsService;
  public readonly messageHandler: MessageHandler.ChatMessageHandler;
  public readonly presenceHandler: PresenceHandler.ChatPresenceHandler;
  public readonly typingHandler: TypingHandler.ChatTypingHandler;
  public readonly cursorHandler: CursorHandler.ChatCursorHandler;
  public readonly gateway: Gateway.ChatGateway;
  public readonly contractRuntime: ChatSocketContractRuntime;
  public readonly handlerRuntime: ChatServerHandlerRuntime;

  private readonly io: SocketServer;
  private booted = false;
  private bootMode: ChatServerTransportBootMode = 'NONE';

  public constructor(
    deps: ChatServerTransportIndexDependencies,
  ) {
    this.io = deps.io;
    this.logger = ensureLogger(deps.logger);
    this.config = createDefaultChatServerTransportIndexConfig(deps.config ?? {});

    this.authority =
      deps.authority ??
      new RejectingChatUnifiedServerAuthorityPort();

    this.roomRegistry = new RoomRegistry.ChatRoomRegistry(this.config.roomRegistry);
    this.sessionRegistry = new SessionRegistry.ChatSessionRegistry({
      config: this.config.sessionRegistry,
      registry: this.roomRegistry,
    });

    const fanoutRoomAdapter = new FanoutRoomRegistryAdapter(this.roomRegistry);
    const fanoutSessionAdapter = new FanoutSessionRegistryAdapter(
      this.roomRegistry,
      this.sessionRegistry,
    );

    this.fanoutService = new Fanout.ChatFanoutService({
      config: this.config.fanoutService,
      rooms: fanoutRoomAdapter,
      sessions: fanoutSessionAdapter,
      emitter: new SocketIoEmitterAdapter(this.io.of(this.config.namespace)),
      logger: this.logger,
    });

    this.metricsService = new MetricsModule.ChatMetricsService({
      config: this.config.metrics,
      fanoutService: this.fanoutService,
    });

    this.contractRuntime = new ChatSocketContractRuntime(
      this.metricsService,
      this.logger,
    );

    const trustPolicy = deps.trustPolicy;
    const banPort = deps.banPort;
    const replayAuthority =
      deps.replayAuthority ??
      deps.authority ??
      new RejectingChatUnifiedServerAuthorityPort();

    this.connectionAuth = new ConnectionAuth.ChatConnectionAuth({
      config: this.config.connectionAuth,
      tokenVerifier:
        deps.tokenVerifier ??
        new ConnectionAuth.SignedProofVerifier(
          process.env.PZO_CHAT_SOCKET_SECRET ?? 'pzo-chat-dev-secret',
        ),
      trustPolicy: trustPolicy,
      banPort,
      replayPort: {
        findReplayHint: async () => null,
      },
      audit: {
        publish: async (record) => {
          this.logger.debug('Chat connection auth audit record', {
            auditId: record.auditId,
            verdict: record.verdict,
            userId: record.userId,
            namespace: record.namespace,
          });
        },
      },
      logger: this.logger,
    });

    const handlerLocalFanout = new ChatTransportLocalFanoutBridge(
      this.roomRegistry,
      this.io.of(this.config.namespace),
      this.logger,
      {
        increment: (metric, value, tags) => {
          this.metricsService.increment('gateway_transport_outbound_total' as never, value as never, tags as never);
        },
      },
    );

    this.messageHandler = new MessageHandler.ChatMessageHandler(
      {
        sessionRegistry: this.sessionRegistry,
        backend: new MessageAuthorityAdapter(
          deps.messageAuthority ?? deps.authority ?? new RejectingChatUnifiedServerAuthorityPort(),
        ),
        fanout: handlerLocalFanout,
        metrics: new ChatMessageHandlerMetricsBridge(this.metricsService),
        logger: this.logger,
      },
      this.config.messageHandler,
    );

    this.presenceHandler = new PresenceHandler.ChatPresenceHandler(
      {
        sessionRegistry: this.sessionRegistry,
        backend: new PresenceAuthorityAdapter(
          deps.presenceAuthority ?? deps.authority ?? new RejectingChatUnifiedServerAuthorityPort(),
        ),
        fanout: handlerLocalFanout,
        metrics: new ChatPresenceHandlerMetricsBridge(this.metricsService),
        logger: this.logger,
      },
      this.config.presenceHandler,
    );

    this.typingHandler = new TypingHandler.ChatTypingHandler(
      {
        sessionRegistry: this.sessionRegistry,
        backend: new TypingAuthorityAdapter(
          deps.typingAuthority ?? deps.authority ?? new RejectingChatUnifiedServerAuthorityPort(),
        ),
        fanout: handlerLocalFanout,
        metrics: new ChatTypingHandlerMetricsBridge(this.metricsService),
        logger: this.logger,
      },
      this.config.typingHandler,
    );

    this.cursorHandler = new CursorHandler.ChatCursorHandler(
      {
        sessionRegistry: this.sessionRegistry,
        backend: new CursorAuthorityAdapter(
          deps.cursorAuthority ?? deps.authority ?? new RejectingChatUnifiedServerAuthorityPort(),
        ),
        fanout: handlerLocalFanout,
        metrics: new ChatCursorHandlerMetricsBridge(this.metricsService),
        logger: this.logger,
      },
      this.config.cursorHandler,
    );

    this.replayService = new ReplayServiceModule.ChatReplayService({
      config: this.config.replayService,
      replayBridge: new ReplayAuthorityAdapter(replayAuthority),
      fanout: this.fanoutService,
      metrics: new ChatReplayMetricsBridge(this.metricsService),
      logger: this.logger,
    });

    this.gateway = new Gateway.ChatGateway({
      io: this.io,
      registry: this.roomRegistry,
      runtimeConfig: this.config.legacyGateway,
      auth: deps.gatewayAuthority
        ? ({
            authenticate: async (socket: Socket) => {
              const auth = await this.connectionAuth.authenticate(socket);
              return auth;
            },
          } satisfies Gateway.ChatGatewayAuthPort)
        : ({
            authenticate: async (socket: Socket) => {
              const auth = await this.connectionAuth.authenticate(socket);
              return auth;
            },
          } satisfies Gateway.ChatGatewayAuthPort),
      engine: new GatewayAuthorityAdapter(
        deps.gatewayAuthority ?? deps.authority ?? new RejectingChatUnifiedServerAuthorityPort(),
      ),
      replay: deps.gatewayReplay ?? new GatewayReplayPortAdapter(),
      audit: deps.gatewayAudit ?? new GatewayAuditPortAdapter(this.logger),
      metrics: new ChatGatewayMetricsBridge(this.metricsService),
      logger: this.logger,
    });

    this.handlerRuntime = new ChatServerHandlerRuntime(
      this.io,
      this.config.namespace,
      this.connectionAuth,
      this.sessionRegistry,
      this.roomRegistry,
      this.messageHandler,
      this.presenceHandler,
      this.typingHandler,
      this.cursorHandler,
      this.metricsService,
      this.contractRuntime,
      this.logger,
      this.config,
    );
  }

  public start(
    mode: ChatServerTransportBootMode = this.config.bootMode,
  ): this {
    if (mode === 'NONE') {
      this.bootMode = 'NONE';
      this.booted = true;
      return this;
    }

    if (mode === 'LEGACY_GATEWAY') {
      this.gateway.start();
      this.bootMode = mode;
      this.booted = true;
      this.logger.info('Booted server chat stack in LEGACY_GATEWAY mode', {
        namespace: this.config.namespace,
      });
      return this;
    }

    if (mode === 'HANDLER_RUNTIME') {
      this.handlerRuntime.start();
      this.bootMode = mode;
      this.booted = true;
      this.logger.info('Booted server chat stack in HANDLER_RUNTIME mode', {
        namespace: this.config.namespace,
      });
      return this;
    }

    return this;
  }

  public stop(): void {
    if (!this.booted) {
      return;
    }

    if (this.bootMode === 'LEGACY_GATEWAY') {
      this.gateway.stop();
    }

    if (this.bootMode === 'HANDLER_RUNTIME') {
      this.handlerRuntime.stop();
    }

    this.bootMode = 'NONE';
    this.booted = false;
    this.logger.info('Stopped server chat transport stack', {
      namespace: this.config.namespace,
    });
  }

  public currentBootMode(): ChatServerTransportBootMode {
    return this.bootMode;
  }

  public createInspectionSnapshot(): ChatServerTransportInspectionSnapshot {
    return {
      generatedAt: nowMs(),
      bootMode: this.bootMode,
      namespace: this.config.namespace,
      roomRegistryMetrics: this.roomRegistry.getMetricsSnapshot(),
      roomRegistryAudit: this.roomRegistry.buildAuditSnapshot(),
      sessionRegistryAudit: this.sessionRegistry.exportAuditSnapshot(),
      messageMetrics: this.messageHandler.getMetricsSnapshot(),
      presenceMetrics: this.presenceHandler.getMetricsSnapshot(),
      typingMetrics: this.typingHandler.getMetricsSnapshot(),
      cursorMetrics: this.cursorHandler.getMetricsSnapshot(),
      transportMetrics: this.metricsService.createSnapshot(),
      replayCacheRecordCount: this.replayService.getCacheRecords().length,
      fanoutOutboxRecordCount: this.fanoutService.getOutboxRecords().length,
      activeNamespaces: [this.config.namespace],
    };
  }

  public prune(): void {
    this.messageHandler.prune();
    this.presenceHandler.prune();
    this.typingHandler.sweepExpiredLeases();
    this.cursorHandler.sweepExpiredLeases();
    this.roomRegistry.sweepExpiredState();
    this.sessionRegistry.sweepExpiredState();
    this.fanoutService.clearExpiredOutboxRecords();
  }
}

// ============================================================================
// MARK: Public factories
// ============================================================================

export function createChatServerTransportStack(
  deps: ChatServerTransportIndexDependencies,
): ChatServerTransportStack {
  return new ChatServerTransportStack(deps);
}

export function createLegacyGatewayChatTransportStack(
  deps: ChatServerTransportIndexDependencies,
): ChatServerTransportStack {
  const stack = new ChatServerTransportStack({
    ...deps,
    config: {
      ...(deps.config ?? {}),
      bootMode: 'LEGACY_GATEWAY',
    },
  });
  return stack.start('LEGACY_GATEWAY');
}

export function createHandlerRuntimeChatTransportStack(
  deps: ChatServerTransportIndexDependencies,
): ChatServerTransportStack {
  const stack = new ChatServerTransportStack({
    ...deps,
    config: {
      ...(deps.config ?? {}),
      bootMode: 'HANDLER_RUNTIME',
    },
  });
  return stack.start('HANDLER_RUNTIME');
}

// ============================================================================
// MARK: Inspection helpers
// ============================================================================

export interface ChatServerTransportComponentTableRow {
  readonly component:
    | 'GATEWAY'
    | 'ROOM_REGISTRY'
    | 'SESSION_REGISTRY'
    | 'CONNECTION_AUTH'
    | 'MESSAGE_HANDLER'
    | 'PRESENCE_HANDLER'
    | 'TYPING_HANDLER'
    | 'CURSOR_HANDLER'
    | 'REPLAY_SERVICE'
    | 'FANOUT_SERVICE'
    | 'METRICS_SERVICE'
    | 'HANDLER_RUNTIME';
  readonly active: boolean;
  readonly namespace: string;
  readonly note: string;
  readonly metricA?: number | string | null;
  readonly metricB?: number | string | null;
  readonly metricC?: number | string | null;
}

export function createChatServerTransportComponentTable(
  stack: ChatServerTransportStack,
): readonly ChatServerTransportComponentTableRow[] {
  const inspection = stack.createInspectionSnapshot();
  return [
    {
      component: 'GATEWAY',
      active: stack.currentBootMode() === 'LEGACY_GATEWAY',
      namespace: inspection.namespace,
      note: 'Legacy gateway path is active when namespace is booted through ChatGateway.',
      metricA: inspection.transportMetrics.counterCount,
      metricB: inspection.transportMetrics.gaugeCount,
      metricC: inspection.transportMetrics.histogramCount,
    },
    {
      component: 'ROOM_REGISTRY',
      active: true,
      namespace: inspection.namespace,
      note: 'Socket room/session topology truth for server transport.',
      metricA: inspection.roomRegistryMetrics.roomCount,
      metricB: inspection.roomRegistryMetrics.sessionCount,
      metricC: inspection.roomRegistryMetrics.socketCount,
    },
    {
      component: 'SESSION_REGISTRY',
      active: true,
      namespace: inspection.namespace,
      note: 'Admission, restrictions, reconnect tickets, and authority overlays.',
      metricA: inspection.sessionRegistryAudit.sessionCount,
      metricB: inspection.sessionRegistryAudit.activeCount,
      metricC: inspection.sessionRegistryAudit.reconnectTicketCount,
    },
    {
      component: 'CONNECTION_AUTH',
      active: true,
      namespace: inspection.namespace,
      note: 'Handshake verification, trust policy, and restriction computation.',
      metricA: null,
      metricB: null,
      metricC: null,
    },
    {
      component: 'MESSAGE_HANDLER',
      active: true,
      namespace: inspection.namespace,
      note: 'Ingress for message submit, replay fetch, reactions, and transport ACK state.',
      metricA: inspection.messageMetrics.totalReceived,
      metricB: inspection.messageMetrics.totalAccepted,
      metricC: inspection.messageMetrics.totalRejected,
    },
    {
      component: 'PRESENCE_HANDLER',
      active: true,
      namespace: inspection.namespace,
      note: 'Presence, heartbeat, visibility, occupancy, and room-local presence mirrors.',
      metricA: inspection.presenceMetrics.totalReceived,
      metricB: inspection.presenceMetrics.totalAccepted,
      metricC: inspection.presenceMetrics.totalHeartbeats,
    },
    {
      component: 'TYPING_HANDLER',
      active: true,
      namespace: inspection.namespace,
      note: 'Typing leases, refresh windows, remote state requests, and typing fanout.',
      metricA: inspection.typingMetrics.totalReceived,
      metricB: inspection.typingMetrics.totalAccepted,
      metricC: inspection.typingMetrics.totalLeaseExpirations,
    },
    {
      component: 'CURSOR_HANDLER',
      active: true,
      namespace: inspection.namespace,
      note: 'Cursor ranges, viewports, pings, and requestable history windows.',
      metricA: inspection.cursorMetrics.totalReceived,
      metricB: inspection.cursorMetrics.totalAccepted,
      metricC: inspection.cursorMetrics.totalHistoryRequests,
    },
    {
      component: 'REPLAY_SERVICE',
      active: true,
      namespace: inspection.namespace,
      note: 'Replay query normalization, chunking, caching, and targeted replay control.',
      metricA: inspection.replayCacheRecordCount,
      metricB: inspection.transportMetrics.recentEventCount,
      metricC: null,
    },
    {
      component: 'FANOUT_SERVICE',
      active: true,
      namespace: inspection.namespace,
      note: 'Authoritative room/session emission planning for message, presence, typing, cursor, replay, and control.',
      metricA: inspection.fanoutOutboxRecordCount,
      metricB: inspection.roomRegistryMetrics.socketCount,
      metricC: null,
    },
    {
      component: 'METRICS_SERVICE',
      active: true,
      namespace: inspection.namespace,
      note: 'Transport-side observability, rate windows, validation summary, and health snapshots.',
      metricA: inspection.transportMetrics.counterCount,
      metricB: inspection.transportMetrics.gaugeCount,
      metricC: inspection.transportMetrics.healthScore,
    },
    {
      component: 'HANDLER_RUNTIME',
      active: stack.currentBootMode() === 'HANDLER_RUNTIME',
      namespace: inspection.namespace,
      note: 'Namespace runtime that authenticates, admits, attaches handlers, and optionally joins room hints.',
      metricA: inspection.sessionRegistryAudit.activeCount,
      metricB: inspection.messageMetrics.totalAccepted,
      metricC: inspection.presenceMetrics.totalAccepted,
    },
  ];
}

export function createChatServerTransportStackSummary(
  stack: ChatServerTransportStack,
): Record<string, unknown> {
  const inspection = stack.createInspectionSnapshot();
  return {
    generatedAt: inspection.generatedAt,
    bootMode: inspection.bootMode,
    namespace: inspection.namespace,
    roomCount: inspection.roomRegistryMetrics.roomCount,
    sessionCount: inspection.roomRegistryMetrics.sessionCount,
    socketCount: inspection.roomRegistryMetrics.socketCount,
    activeAuthoritySessions: inspection.sessionRegistryAudit.activeCount,
    reconnectTicketCount: inspection.sessionRegistryAudit.reconnectTicketCount,
    messageReceived: inspection.messageMetrics.totalReceived,
    messageAccepted: inspection.messageMetrics.totalAccepted,
    presenceHeartbeats: inspection.presenceMetrics.totalHeartbeats,
    typingLeaseExpirations: inspection.typingMetrics.totalLeaseExpirations,
    cursorHistoryRequests: inspection.cursorMetrics.totalHistoryRequests,
    fanoutOutboxRecordCount: inspection.fanoutOutboxRecordCount,
    replayCacheRecordCount: inspection.replayCacheRecordCount,
    transportHealthScore: inspection.transportMetrics.healthScore,
  };
}

// ============================================================================
// MARK: Final note inside code
// ============================================================================

/**
 * This file intentionally leaves one hard boundary intact:
 *
 *   transport composition is here,
 *   backend chat truth is not.
 *
 * That means the stack can be fully bootstrapped today while still allowing the
 * future authoritative backend chat lane to be injected cleanly through the
 * backend authority interfaces above without rewriting the transport surface.
 */