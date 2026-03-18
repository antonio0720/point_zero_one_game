/**
 * POINT ZERO ONE — bound chat runtime bootstrap
 * pzo-web/src/engines/chat/createBoundChatRuntime.ts
 *
 * Purpose
 * - create ChatSocketClient
 * - create ChatMountRegistry
 * - initialize ChatEngine with runtime inputs
 * - bind ChatEngine to the game event bus
 *
 * Fixes applied
 * - aligns socket bootstrap with current ChatSocketClient constructor contract
 *   (`endpoint`, `setIdentity`, `bindRoom`) instead of the stale `url` factory arg
 * - adapts ChatSocketClient to ChatEngine's async ChatTransportPort contract
 * - maps legacy local mount aliases into the canonical ChatMountTarget union
 * - normalizes disconnect reasons into the current ChatDisconnectReason union
 * - normalizes legacy typing states into the current ChatTypingState union
 */

import {
  ChatEngine,
  type ChatEngineRuntimeInputs,
  type ChatTransportPort,
} from './ChatEngine';
import { ChatMountRegistry } from './ChatMountRegistry';
import {
  ChatSocketClient,
  type ChatChannel,
  type ChatDisconnectReason,
  type ChatRoomBinding,
  type ChatTypingState,
} from './ChatSocketClient';
import type {
  ChatActorKind,
  ChatAuthoritativeFrame,
  ChatMessage as EngineChatMessage,
  ChatMessageKind as EngineChatMessageKind,
  ChatMountTarget,
  ChatPresenceSnapshot as EngineChatPresenceSnapshot,
  ChatRoomId,
  ChatSessionId,
  ChatTypingSnapshot as EngineChatTypingSnapshot,
  ChatVisibleChannel,
} from './types';

export interface ChatRuntimeBootstrapIdentity {
  readonly userId: string;
  readonly displayName: string;
  readonly rank?: string;
  readonly sessionId: string;
  readonly runId: string;
}

export type LegacyChatRuntimeMountTarget =
  | 'LOBBY_SCREEN'
  | 'RUN_SCREEN'
  | 'BOARD_DOCK'
  | 'MOBILE_OVERLAY';

export interface ChatRuntimeBootstrapOptions {
  readonly websocketUrl: string;
  readonly mountTarget: ChatMountTarget | LegacyChatRuntimeMountTarget;
  readonly eventBus: {
    on(eventType: string, handler: (event: unknown) => void): () => void;
  };
  readonly runtimeInputs: ChatEngineRuntimeInputs;
  readonly identity: ChatRuntimeBootstrapIdentity;
}

export interface BoundChatRuntime {
  readonly engine: ChatEngine;
  readonly socket: ChatSocketClient;
  readonly registry: ChatMountRegistry;
  destroy(): Promise<void>;
}

const LEGACY_TO_CANONICAL_MOUNT_TARGET: Record<LegacyChatRuntimeMountTarget, ChatMountTarget> = {
  LOBBY_SCREEN: 'LOBBY_SCREEN',
  RUN_SCREEN: 'GAME_BOARD',
  BOARD_DOCK: 'GAME_BOARD',
  MOBILE_OVERLAY: 'CLUB_UI',
};

const VALID_DISCONNECT_REASONS: ReadonlySet<ChatDisconnectReason> = new Set([
  'manual_disconnect',
  'socket_disconnect',
  'transport_error',
  'visibility_pause',
  'auth_replaced',
  'destroyed',
  'network_offline',
  'reconnect_exhausted',
  'unknown',
]);

function toCanonicalMountTarget(
  mountTarget: ChatRuntimeBootstrapOptions['mountTarget'],
): ChatMountTarget {
  if (mountTarget in LEGACY_TO_CANONICAL_MOUNT_TARGET) {
    return LEGACY_TO_CANONICAL_MOUNT_TARGET[mountTarget as LegacyChatRuntimeMountTarget];
  }

  return mountTarget as ChatMountTarget;
}

function defaultVisibleChannelForMountTarget(
  mountTarget: ChatMountTarget,
): ChatVisibleChannel {
  switch (mountTarget) {
    case 'LOBBY_SCREEN':
      return 'LOBBY';
    case 'POST_RUN_SUMMARY':
      return 'GLOBAL';
    default:
      return 'GLOBAL';
  }
}

function roomScopeForMountTarget(
  mountTarget: ChatMountTarget,
): ChatRoomBinding['scope'] {
  switch (mountTarget) {
    case 'LOBBY_SCREEN':
    case 'CLUB_UI':
      return 'LOBBY';
    default:
      return 'RUN';
  }
}

function normalizeDisconnectReason(reason?: string): ChatDisconnectReason {
  if (reason && VALID_DISCONNECT_REASONS.has(reason as ChatDisconnectReason)) {
    return reason as ChatDisconnectReason;
  }
  return 'manual_disconnect';
}

function normalizeTypingState(
  state?: 'STARTED' | 'PAUSED' | 'STOPPED' | 'SIMULATED' | 'NOT_TYPING',
): ChatTypingState {
  switch (state) {
    case 'STARTED':
    case 'SIMULATED':
      return 'STARTED';
    case 'PAUSED':
    case 'STOPPED':
    case 'NOT_TYPING':
    default:
      return 'STOPPED';
  }
}


function toVisibleChannel(channel?: string): ChatVisibleChannel {
  switch (channel) {
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'DEAL_ROOM':
      return 'DEAL_ROOM';
    case 'LOBBY':
      return 'LOBBY';
    case 'GLOBAL':
    default:
      return 'GLOBAL';
  }
}

function toEngineMessageKind(kind?: string): EngineChatMessageKind {
  switch (kind) {
    case 'PLAYER':
    case 'SYSTEM':
    case 'MARKET_ALERT':
    case 'ACHIEVEMENT':
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
    case 'DEAL_RECAP':
      return kind;
    default:
      return 'PLAYER';
  }
}

function inferActorKindFromSocketMessage(message: {
  readonly senderId?: string;
  readonly kind?: string;
  readonly metadata?: Record<string, unknown>;
}): ChatActorKind {
  if (message.kind === 'SYSTEM' || message.senderId === 'system') return 'SYSTEM';
  const metadata = message.metadata ?? {};
  if (Boolean(metadata.isHelper)) return 'HELPER';
  if (Boolean(metadata.isHater)) return 'HATER';
  if (Boolean(metadata.isNpc)) return 'AMBIENT_NPC';
  return 'PLAYER';
}

function toEngineMessage(
  message: import('./ChatSocketClient').ChatMessage,
  roomId: ChatRoomId,
): EngineChatMessage {
  return {
    id: message.id as EngineChatMessage['id'],
    channel: toVisibleChannel(message.channel),
    kind: toEngineMessageKind(message.kind),
    senderId: message.senderId,
    senderName: message.senderName,
    senderRank: message.senderRank,
    body: message.body,
    emoji: message.emoji,
    ts: message.ts,
    immutable: message.immutable,
    proofHash: message.proofHash,
    sender: {
      actorId: message.senderId,
      actorKind: inferActorKindFromSocketMessage(message),
      displayName: message.senderName,
      rank: message.senderRank,
      playerId: message.senderId,
    },
    meta: {
      requestId: typeof message.metadata?.requestId === 'string' ? message.metadata.requestId : undefined,
      roomId,
      insertedAt: message.ts as any,
    },
    botSource: message.metadata?.botSource as EngineChatMessage['botSource'],
    shieldMeta: message.metadata?.shieldMeta as EngineChatMessage['shieldMeta'],
    cascadeMeta: message.metadata?.cascadeMeta as EngineChatMessage['cascadeMeta'],
    pressureTier: message.pressureTier as EngineChatMessage['pressureTier'],
    tickTier: message.tickTier as EngineChatMessage['tickTier'],
    runOutcome: message.runOutcome as EngineChatMessage['runOutcome'],
  };
}

function toEnginePresenceState(state: import('./ChatSocketClient').ChatPresenceState): EngineChatPresenceSnapshot['presence'] {
  switch (state) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'IDLE':
      return 'READING';
    case 'AWAY':
    case 'BACKGROUND':
      return 'WATCHING';
    case 'OFFLINE':
    case 'HIDDEN':
    default:
      return 'OFFLINE';
  }
}

function inferActorKindFromPresence(member: import('./ChatSocketClient').ChatPresenceMember): ChatActorKind {
  if (member.isHelper) return 'HELPER';
  if (member.isHater) return 'HATER';
  if (member.isNpc) return 'AMBIENT_NPC';
  return 'PLAYER';
}

function toEnginePresenceSnapshots(
  snapshot: import('./ChatSocketClient').ChatPresenceSnapshot,
): EngineChatPresenceSnapshot[] {
  return snapshot.members.map((member) => ({
    actorId: member.playerId,
    actorKind: inferActorKindFromPresence(member),
    channelId: toVisibleChannel(member.channel),
    presence: toEnginePresenceState(member.state),
    updatedAt: snapshot.serverTs as any,
    isVisibleToPlayer: !member.hidden,
    latencyMs: undefined,
  }));
}

function toEnginePresenceSnapshotsFromDelta(
  delta: import('./ChatSocketClient').ChatPresenceDelta,
): EngineChatPresenceSnapshot[] {
  const members = [
    ...(delta.joins ?? []),
    ...(delta.updates ?? []),
    ...((delta.leaves ?? []).map((playerId) => ({
      playerId,
      displayName: playerId,
      channel: delta.channel,
      state: 'OFFLINE' as const,
      lastSeenAt: delta.serverTs,
    }))),
  ];

  return members.map((member) => ({
    actorId: member.playerId,
    actorKind: inferActorKindFromPresence(member as any),
    channelId: toVisibleChannel((member as any).channel ?? delta.channel),
    presence: toEnginePresenceState((member as any).state ?? 'OFFLINE'),
    updatedAt: delta.serverTs as any,
    isVisibleToPlayer: !(member as any).hidden,
    latencyMs: undefined,
  }));
}

function toEngineTypingSnapshot(
  signal: import('./ChatSocketClient').ChatTypingSignal,
): EngineChatTypingSnapshot {
  return {
    actorId: signal.playerId,
    actorKind: signal.isHelper ? 'HELPER' : signal.isHater ? 'HATER' : signal.isNpc ? 'AMBIENT_NPC' : 'PLAYER',
    channelId: toVisibleChannel(signal.channel),
    typingState: signal.state === 'STARTED' ? 'STARTED' : 'STOPPED',
    startedAt: signal.state === 'STARTED' ? (signal.ts as any) : undefined,
    expiresAt: signal.expiresAt as any,
    simulatedByPersona: signal.isHelper || signal.isHater || signal.isNpc ? signal.playerId : undefined,
  };
}

function createFrameFromSocketMessages(args: {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly requestId?: string;
  readonly syncedAt: number;
  readonly messages: readonly import('./ChatSocketClient').ChatMessage[];
}): ChatAuthoritativeFrame {
  return {
    requestId: args.requestId as any,
    roomId: args.roomId,
    channelId: args.channelId,
    messages: args.messages.map((message) => toEngineMessage(message, args.roomId)),
    syncedAt: args.syncedAt as any,
  };
}

function queueSocketGameEvent(
  socket: ChatSocketClient,
  eventType: string,
  roomId: string,
  payload: unknown,
): void {
  socket.queueGameEvent({
    event: eventType,
    channel: 'GLOBAL',
    roomId,
    metadata: payload as Record<string, unknown> | undefined,
  });
}

function createSocketTransportAdapter(socket: ChatSocketClient): ChatTransportPort {
  return {
    connect: async () => {
      await socket.connect();
    },

    disconnect: async (reason?: string) => {
      socket.disconnect(normalizeDisconnectReason(reason));
    },

    sendMessage: async (request) => {
      const outbound = request as unknown as {
        readonly requestId?: string;
        readonly channelId: ChatVisibleChannel;
        readonly body: string;
        readonly immutable?: boolean;
        readonly proofHash?: string;
      };

      await socket.sendMessage({
        clientMessageId: outbound.requestId,
        channel: outbound.channelId as ChatChannel,
        body: outbound.body,
        immutable: outbound.immutable,
        proofHash: outbound.proofHash,
      });
    },

    sendTyping: async (request) => {
      const typing = request as unknown as {
        readonly channelId: ChatVisibleChannel;
        readonly typingState?: 'STARTED' | 'PAUSED' | 'STOPPED' | 'SIMULATED' | 'NOT_TYPING';
        readonly state?: 'STARTED' | 'PAUSED' | 'STOPPED' | 'SIMULATED' | 'NOT_TYPING';
        readonly expiresAt?: number;
      };

      socket.queueTyping({
        channel: typing.channelId as ChatChannel,
        state: normalizeTypingState(typing.typingState ?? typing.state),
        expiresAt: typing.expiresAt,
      });
    },
  };
}

export function createBoundChatRuntime(
  options: ChatRuntimeBootstrapOptions,
): BoundChatRuntime {
  const canonicalMountTarget = toCanonicalMountTarget(options.mountTarget);
  const defaultVisibleChannel = defaultVisibleChannelForMountTarget(canonicalMountTarget);
  const roomId = options.identity.runId as ChatRoomId;

  let engine!: ChatEngine;

  const socketCallbacks = {
    onConnect: () => {
      engine.handleTransportConnected(options.identity.sessionId as ChatSessionId);
    },
    onDisconnect: (reason: ChatDisconnectReason, details?: unknown) => {
      engine.handleTransportDisconnected(typeof details === 'string' ? details : reason);
    },
    onError: (error: Error, context?: Record<string, unknown>) => {
      engine.handleTransportError(context?.phase ? `${String(context.phase)}: ${error.message}` : error.message);
    },
    onMessage: (message: import('./ChatSocketClient').ChatMessage) => {
      engine.applyAuthoritativeFrame(
        createFrameFromSocketMessages({
          roomId,
          channelId: toVisibleChannel(message.channel),
          syncedAt: message.ts,
          messages: [message],
        }),
      );
    },
    onMessageBatch: (messages: import('./ChatSocketClient').ChatMessage[]) => {
      if (messages.length === 0) return;
      engine.applyAuthoritativeFrame(
        createFrameFromSocketMessages({
          roomId,
          channelId: toVisibleChannel(messages[messages.length - 1]?.channel),
          syncedAt: Date.now(),
          messages,
        }),
      );
    },
    onReplay: (replay: import('./ChatSocketClient').ChatReplayResponse) => {
      if (replay.messages.length === 0) return;
      engine.applyAuthoritativeFrame(
        createFrameFromSocketMessages({
          roomId,
          channelId: toVisibleChannel(replay.channel),
          syncedAt: replay.serverTs,
          messages: replay.messages,
        }),
      );
    },
    onPresenceSnapshot: (snapshot: import('./ChatSocketClient').ChatPresenceSnapshot) => {
      engine.applyRemotePresence(toEnginePresenceSnapshots(snapshot));
    },
    onPresenceDelta: (delta: import('./ChatSocketClient').ChatPresenceDelta) => {
      engine.applyRemotePresence(toEnginePresenceSnapshotsFromDelta(delta));
    },
    onTyping: (signal: import('./ChatSocketClient').ChatTypingSignal) => {
      engine.applyRemoteTyping([toEngineTypingSnapshot(signal)]);
    },
    onAck: (ack: import('./ChatSocketClient').ChatAckPayload) => {
      if (!ack.accepted) {
        engine.handleTransportError(ack.reason ?? 'chat ack rejected');
        return;
      }
      if (!ack.clientMessageId) return;
      engine.applyAuthoritativeFrame({
        requestId: ack.clientMessageId as any,
        roomId,
        channelId: toVisibleChannel(ack.channel),
        messages: [],
        syncedAt: ack.ackTs as any,
      });
    },
    onNotification: (notification: import('./ChatSocketClient').ChatNotification) => {
      engine.applyAuthoritativeFrame({
        roomId,
        channelId: toVisibleChannel(notification.channel),
        messages: [
          {
            id: `notif:${notification.id}` as any,
            channel: toVisibleChannel(notification.channel),
            kind: 'SYSTEM',
            senderId: 'system:socket',
            senderName: 'SYSTEM',
            body: notification.body,
            ts: notification.ts,
            meta: {
              roomId,
              insertedAt: notification.ts as any,
            },
          },
        ],
        syncedAt: notification.ts as any,
      });
    },
  } satisfies Partial<import('./ChatSocketClient').ChatSocketClientCallbacks>;

  const socket = new ChatSocketClient({
    endpoint: options.websocketUrl,
    autoConnect: false,
  }, socketCallbacks);

  socket.setIdentity({
    playerId: options.identity.userId,
    displayName: options.identity.displayName,
    sessionId: options.identity.sessionId,
    runId: options.identity.runId,
  });

  socket.bindRoom({
    scope: roomScopeForMountTarget(canonicalMountTarget),
    roomId: options.identity.runId,
    channel: defaultVisibleChannel as ChatChannel,
    runId: options.identity.runId,
    allowReplay: true,
  });

  const registry = new ChatMountRegistry();
  const transport = createSocketTransportAdapter(socket);

  engine = new ChatEngine({
    roomId,
    sessionId: options.identity.sessionId as ChatSessionId,
    mountTarget: canonicalMountTarget,
    transport,
    runtimeInputs: options.runtimeInputs,
    playerIdentity: {
      userId: options.identity.userId,
      displayName: options.identity.displayName,
      rank: options.identity.rank,
    },
    autoConnect: true,
    enableOptimisticAmbientLoop: true,
    localEchoWhenTransportMissing: true,
  });


  const relayableEventTypes = [
    'RUN_STARTED',
    'RUN_ENDED',
    'PRESSURE_TIER_CHANGED',
    'TICK_TIER_CHANGED',
    'BOT_STATE_CHANGED',
    'BOT_ATTACK_FIRED',
    'SHIELD_LAYER_BREACHED',
    'SHIELD_FORTIFIED',
    'CASCADE_CHAIN_STARTED',
    'CASCADE_CHAIN_BROKEN',
    'CASCADE_POSITIVE_ACTIVATED',
    'SOVEREIGNTY_APPROACH',
    'SOVEREIGNTY_ACHIEVED',
    'DEAL_PROOF_ISSUED',
    'CARD_PLAYED',
  ] as const;

  const unbindEventBus = engine.bindEventBus(options.eventBus);
  const relayUnsubs = relayableEventTypes.map((eventType) =>
    options.eventBus.on(eventType, (event) => {
      const payload = (event as { payload?: unknown })?.payload ?? event;
      queueSocketGameEvent(socket, eventType, options.identity.runId, payload);
    }),
  );

  registry.registerMount({
    mountId: `chat:${options.identity.runId}:${canonicalMountTarget}` as any,
    mountTarget: canonicalMountTarget,
    roomId,
    sessionId: options.identity.sessionId as ChatSessionId,
    visibleChannel: defaultVisibleChannel,
  } as any);

  return {
    engine,
    socket,
    registry,
    async destroy() {
      for (const unsub of relayUnsubs) {
        unsub();
      }
      unbindEventBus();
      engine.destroy();
      await transport.disconnect?.('destroyed');
      socket.destroy();
    },
  };
}
