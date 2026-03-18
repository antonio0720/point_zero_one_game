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
 * - uses the current ChatSocketClient factory/helpers instead of a stale inline bootstrap
 * - performs type-safe mount registration through ChatMountRegistry instead of `as any`
 * - keeps socket identity/room binding aligned with run id, mode id, and mount target
 * - groups authoritative frames by visible channel instead of collapsing mixed batches
 * - mirrors window focus/visibility into both registry state and socket presence
 * - forwards moderation, invasion, and sabotage transport signals into canonical system frames
 */

import type { RunMode } from '../core/types';
import {
  ChatEngine,
  type ChatEngineRuntimeInputs,
  type ChatTransportPort,
} from './ChatEngine';
import {
  ChatMountRegistry,
  buildChatMountRuntimeRegistration,
} from './ChatMountRegistry';
import {
  buildChatRoomBinding,
  buildRuntimeSocketIdentity,
  buildVisibilitySnapshot,
  createChatSocketClient,
  type ChatAckPayload,
  type ChatChannel,
  type ChatDisconnectReason,
  type ChatNotification,
  type ChatPresenceDelta,
  type ChatPresenceMember,
  type ChatPresenceSnapshot,
  type ChatReplayResponse,
  type ChatSabotageEvent,
  type ChatSocketClient,
  type ChatTypingSignal,
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
  readonly modeId?: string;
  readonly syndicateId?: string;
  readonly dealId?: string;
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
  readonly runMode: RunMode;
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
): 'RUN' | 'LOBBY' | 'MODE' | 'ACCOUNT' | 'SYNDICATE' | 'DEAL' | 'CUSTOM' {
  switch (mountTarget) {
    case 'LOBBY_SCREEN':
    case 'CLUB_UI':
    case 'LEAGUE_UI':
      return 'LOBBY';
    case 'SYNDICATE_GAME_SCREEN':
      return 'SYNDICATE';
    case 'POST_RUN_SUMMARY':
      return 'MODE';
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
): 'STARTED' | 'STOPPED' {
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

function toSocketChannel(channel?: ChatVisibleChannel): ChatChannel {
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

function inferActorKindFromPresence(member: ChatPresenceMember): ChatActorKind {
  if (member.isHelper) return 'HELPER';
  if (member.isHater) return 'HATER';
  if (member.isNpc) return 'AMBIENT_NPC';
  return 'PLAYER';
}

function toEnginePresenceSnapshots(
  snapshot: ChatPresenceSnapshot,
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
  delta: ChatPresenceDelta,
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
    actorKind: inferActorKindFromPresence(member as ChatPresenceMember),
    channelId: toVisibleChannel((member as ChatPresenceMember).channel ?? delta.channel),
    presence: toEnginePresenceState((member as ChatPresenceMember).state ?? 'OFFLINE'),
    updatedAt: delta.serverTs as any,
    isVisibleToPlayer: !(member as ChatPresenceMember).hidden,
    latencyMs: undefined,
  }));
}

function toEngineTypingSnapshot(
  signal: ChatTypingSignal,
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

function createSystemFrame(args: {
  roomId: ChatRoomId;
  channel: ChatVisibleChannel;
  body: string;
  ts: number;
  id: string;
  metadata?: Record<string, unknown>;
}): ChatAuthoritativeFrame {
  return {
    roomId: args.roomId,
    channelId: args.channel,
    messages: [
      {
        id: args.id as any,
        channel: args.channel,
        kind: 'SYSTEM',
        senderId: 'system:socket',
        senderName: 'SYSTEM',
        body: args.body,
        ts: args.ts,
        meta: {
          roomId: args.roomId,
          insertedAt: args.ts as any,
          ...(args.metadata ? { source: args.metadata.source } : {}),
        },
      },
    ],
    syncedAt: args.ts as any,
  };
}

function applyFramesForMessages(
  engine: ChatEngine,
  roomId: ChatRoomId,
  messages: readonly import('./ChatSocketClient').ChatMessage[],
  syncedAt: number,
): void {
  const byChannel = new Map<ChatVisibleChannel, import('./ChatSocketClient').ChatMessage[]>();

  for (const message of messages) {
    const channel = toVisibleChannel(message.channel);
    const bucket = byChannel.get(channel);
    if (bucket) {
      bucket.push(message);
    } else {
      byChannel.set(channel, [message]);
    }
  }

  for (const [channelId, channelMessages] of byChannel.entries()) {
    engine.applyAuthoritativeFrame(
      createFrameFromSocketMessages({
        roomId,
        channelId,
        syncedAt,
        messages: channelMessages,
      }),
    );
  }
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
    metadata: payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : payload === undefined
        ? undefined
        : { value: payload },
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
        channel: toSocketChannel(outbound.channelId),
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
        channel: toSocketChannel(typing.channelId),
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
      applyFramesForMessages(engine, roomId, [message], message.ts);
    },
    onMessageBatch: (messages: import('./ChatSocketClient').ChatMessage[]) => {
      if (messages.length === 0) return;
      applyFramesForMessages(engine, roomId, messages, Date.now());
    },
    onReplay: (replay: ChatReplayResponse) => {
      if (replay.messages.length === 0) return;
      applyFramesForMessages(engine, roomId, replay.messages, replay.serverTs);
    },
    onPresenceSnapshot: (snapshot: ChatPresenceSnapshot) => {
      engine.applyRemotePresence(toEnginePresenceSnapshots(snapshot));
    },
    onPresenceDelta: (delta: ChatPresenceDelta) => {
      engine.applyRemotePresence(toEnginePresenceSnapshotsFromDelta(delta));
    },
    onTyping: (signal: ChatTypingSignal) => {
      engine.applyRemoteTyping([toEngineTypingSnapshot(signal)]);
    },
    onAck: (ack: ChatAckPayload) => {
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
    onNotification: (notification: ChatNotification) => {
      engine.applyAuthoritativeFrame(
        createSystemFrame({
          roomId,
          channel: toVisibleChannel(notification.channel),
          body: notification.body,
          ts: notification.ts,
          id: `notif:${notification.id}`,
          metadata: { source: 'notification' },
        }),
      );
    },
    onModeration: (event) => {
      engine.applyAuthoritativeFrame(
        createSystemFrame({
          roomId,
          channel: toVisibleChannel(event.channel ?? 'GLOBAL'),
          body: event.reason
            ? `MODERATION: ${event.code} — ${event.reason}`
            : `MODERATION: ${event.code}`,
          ts: event.ts,
          id: `moderation:${event.code}:${event.ts}`,
          metadata: { source: 'moderation' },
        }),
      );
    },
    onInvasion: (event) => {
      engine.applyAuthoritativeFrame(
        createSystemFrame({
          roomId,
          channel: toVisibleChannel(event.channel),
          body: event.body || event.title,
          ts: event.ts,
          id: `invasion:${event.id}`,
          metadata: { source: 'invasion' },
        }),
      );
    },
    onSabotage: (event: ChatSabotageEvent) => {
      engine.applyAuthoritativeFrame(
        createSystemFrame({
          roomId,
          channel: 'GLOBAL',
          body: event.dialogue
            ?? `${event.botName ?? 'HATER'} triggered ${event.attackType ?? 'SABOTAGE'} on ${event.targetLayer ?? 'a shield layer'}.`,
          ts: event.ts ?? Date.now(),
          id: `sabotage:${event.botId ?? 'unknown'}:${event.ts ?? Date.now()}`,
          metadata: { source: 'sabotage' },
        }),
      );
    },
  } satisfies Partial<import('./ChatSocketClient').ChatSocketClientCallbacks>;

  const identity = buildRuntimeSocketIdentity({
    playerId: options.identity.userId,
    displayName: options.identity.displayName,
    sessionId: options.identity.sessionId,
    runId: options.identity.runId,
    modeId: options.identity.modeId ?? options.runMode,
    syndicateId: options.identity.syndicateId,
    dealId: options.identity.dealId,
  });

  const socket = createChatSocketClient({
    endpoint: options.websocketUrl,
    playerId: identity.playerId,
    displayName: identity.displayName,
    sessionId: identity.sessionId,
    runId: identity.runId,
    modeId: identity.modeId,
    syndicateId: identity.syndicateId,
    dealId: identity.dealId,
    room: buildChatRoomBinding({
      scope: roomScopeForMountTarget(canonicalMountTarget),
      roomId: options.identity.runId,
      channel: toSocketChannel(defaultVisibleChannel),
      runId: options.identity.runId,
      modeId: options.identity.modeId ?? options.runMode,
      syndicateId: options.identity.syndicateId,
      dealId: options.identity.dealId,
      allowReplay: true,
    }),
    activeChannel: toSocketChannel(defaultVisibleChannel),
    callbacks: socketCallbacks,
    config: {
      autoConnect: false,
    },
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

  const registrationId = registry.registerMount(
    buildChatMountRuntimeRegistration({
      mountTarget: canonicalMountTarget,
      mode: options.runMode,
      isVisible: true,
      isFocused: true,
      collapsed: false,
      containerId: `chat:${options.identity.runId}:${canonicalMountTarget}`,
      sceneTag: canonicalMountTarget.toLowerCase(),
    }),
  );

  const syncWindowState = (): void => {
    const isWindowVisible =
      typeof document === 'undefined' ? true : document.visibilityState !== 'hidden';
    const isWindowFocused =
      typeof document !== 'undefined' && typeof document.hasFocus === 'function'
        ? document.hasFocus()
        : true;
    const activeChannel = socket.getStateSnapshot().activeChannel ?? toSocketChannel(defaultVisibleChannel);

    socket.setVisibility(
      buildVisibilitySnapshot({
        isWindowVisible,
        isWindowFocused,
        isChatOpen: true,
        activeChannel,
      }),
    );

    registry.updateMount(registrationId, {
      isVisible: isWindowVisible,
      isFocused: isWindowFocused,
      sceneTag: canonicalMountTarget.toLowerCase(),
    });
  };

  const handleVisibilityChange = (): void => {
    syncWindowState();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  syncWindowState();

  const unsubEngine = engine.subscribe((state) => {
    const activeChannel = toSocketChannel(state.activeVisibleChannel);
    socket.setVisibility(
      buildVisibilitySnapshot({
        isWindowVisible:
          typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
        isWindowFocused:
          typeof document !== 'undefined' && typeof document.hasFocus === 'function'
            ? document.hasFocus()
            : true,
        isChatOpen: true,
        activeChannel,
      }),
    );
  });

  return {
    engine,
    socket,
    registry,
    async destroy() {
      unsubEngine();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityChange);
        window.removeEventListener('blur', handleVisibilityChange);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      for (const unsub of relayUnsubs) {
        unsub();
      }
      unbindEventBus();
      registry.unregisterMount(registrationId);
      engine.destroy();
      await transport.disconnect?.('destroyed');
      socket.destroy();
    },
  };
}
