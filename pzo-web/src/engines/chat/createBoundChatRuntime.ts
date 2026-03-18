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
  ChatMountTarget,
  ChatRoomId,
  ChatSessionId,
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

  const socket = new ChatSocketClient({
    endpoint: options.websocketUrl,
    autoConnect: false,
  });

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

  const engine = new ChatEngine({
    roomId: options.identity.runId as ChatRoomId,
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

  const unbindEventBus = engine.bindEventBus(options.eventBus);

  registry.registerMount({
    mountId: `chat:${options.identity.runId}:${canonicalMountTarget}` as any,
    mountTarget: canonicalMountTarget,
    roomId: options.identity.runId as ChatRoomId,
    sessionId: options.identity.sessionId as ChatSessionId,
    visibleChannel: defaultVisibleChannel,
  } as any);

  return {
    engine,
    socket,
    registry,
    async destroy() {
      unbindEventBus();
      engine.destroy();
      await transport.disconnect?.('destroyed');
      socket.destroy();
    },
  };
}
