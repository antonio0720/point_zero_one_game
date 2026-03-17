/**
 * POINT ZERO ONE — bound chat runtime bootstrap
 * point_zero_one_master/pzo-web/src/engines/chat/createBoundChatRuntime.ts
 * Purpose:
 * - create ChatSocketClient
 * - create ChatMountRegistry
 * - initialize ChatEngine with runtime inputs
 * - bind ChatEngine to the game event bus
 *
 * This is the concrete roadmap sequence in one place.
 */

import { ChatEngine, type ChatEngineRuntimeInputs } from './ChatEngine';
import { ChatMountRegistry } from './ChatMountRegistry';
import {
  ChatSocketClient,
  createChatSocketClient,
} from './ChatSocketClient';

export interface ChatRuntimeBootstrapIdentity {
  readonly userId: string;
  readonly displayName: string;
  readonly rank?: string;
  readonly sessionId: string;
  readonly runId: string;
}

export interface ChatRuntimeBootstrapOptions {
  readonly websocketUrl: string;
  readonly mountTarget: 'LOBBY_SCREEN' | 'RUN_SCREEN' | 'BOARD_DOCK' | 'MOBILE_OVERLAY';
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

export function createBoundChatRuntime(
  options: ChatRuntimeBootstrapOptions,
): BoundChatRuntime {
  const socket = createChatSocketClient({
    url: options.websocketUrl,
    identity: {
      userId: options.identity.userId,
      sessionId: options.identity.sessionId,
      runId: options.identity.runId,
    },
  });

  const registry = new ChatMountRegistry();

  const engine = new ChatEngine({
    roomId: options.identity.runId as any,
    sessionId: options.identity.sessionId as any,
    mountTarget: options.mountTarget,
    transport: socket,
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

  // The event bus is the authority that lets chat react to battle, pressure,
  // shield, cascade, sovereignty, and run-lifecycle signals.
  const unbindEventBus = engine.bindEventBus(options.eventBus);

  // Keep the mount registry explicit even if your UI layer resolves surfaces later.
  registry.registerMount({
    mountId: `chat:${options.identity.runId}:${options.mountTarget}` as any,
    mountTarget: options.mountTarget,
    roomId: options.identity.runId as any,
    sessionId: options.identity.sessionId as any,
    visibleChannel: options.mountTarget === 'LOBBY_SCREEN' ? 'LOBBY' : 'GLOBAL',
  } as any);

  return {
    engine,
    socket,
    registry,
    async destroy() {
      unbindEventBus();
      engine.destroy();
      await socket.disconnect?.('runtime_destroy');
    },
  };
}
