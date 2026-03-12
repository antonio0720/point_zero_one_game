/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — TIME EVENT BRIDGE
 * pzo-web/src/store/bridges/timeEventBridge.ts
 *
 * Bridges EventBus emissions from Engine 0 / Engine 1 into the Zustand time
 * slice through the normalized handlers layer.
 *
 * Why this file exists:
 *   - Removes EventBus subscription logic from the monolithic engineStore.
 *   - Centralizes time event compatibility mapping in one place.
 *   - Supports current repo events and the richer Time Engine spec in parallel.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { EventBus } from '../../engines/core/EventBus';
import { useEngineStore } from '../engineStore';
import {
  timeStoreHandlers,
  type DecisionWindowClosedPayloadLike,
  type HoldActionUsedPayloadLike,
  type RunStartedPayloadLike,
  type TickCompletePayloadLike,
  type TickTierChangedPayloadLike,
  type TimeStoreSet,
  type TimeStoreWriteShape,
  type TimeoutPayloadLike,
} from '../handlers/timeHandlers';

export interface TimeEventBridgeBinding {
  detach: () => void;
}

export interface WireTimeEventBridgeOptions<State extends TimeStoreWriteShape = TimeStoreWriteShape> {
  setState?: TimeStoreSet<State>;
}

type Unsubscribe = () => void;

type EventEnvelopeLike<TPayload> = {
  payload?: TPayload;
};

function extractPayload<TPayload>(event: TPayload | EventEnvelopeLike<TPayload>): TPayload {
  if (event && typeof event === 'object' && 'payload' in (event as Record<string, unknown>)) {
    return (event as EventEnvelopeLike<TPayload>).payload as TPayload;
  }
  return event as TPayload;
}

function register(
  eventBus: EventBus,
  eventName: string,
  handler: (payload: any) => void,
): Unsubscribe {
  return eventBus.on(eventName as never, (event: unknown) => {
    handler(extractPayload(event as Record<string, unknown>));
  });
}

export function wireTimeEventBridge<State extends TimeStoreWriteShape = TimeStoreWriteShape>(
  eventBus: EventBus,
  options: WireTimeEventBridgeOptions<State> = {},
): TimeEventBridgeBinding {
  const setState = (options.setState ?? useEngineStore.setState) as TimeStoreSet<State>;
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    register(eventBus, 'RUN_STARTED', (payload: RunStartedPayloadLike) => {
      timeStoreHandlers.onRunStarted(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'RUN_ENDED', () => {
      timeStoreHandlers.onRunEnded(setState);
    }),
  );

  unsubs.push(
    register(eventBus, 'TICK_COMPLETE', (payload: TickCompletePayloadLike) => {
      timeStoreHandlers.onTickComplete(setState, payload);
    }),
  );

  // Compatibility lane for the current frontend TimeEngine implementation.
  unsubs.push(
    register(eventBus, 'TIME_TICK_ADVANCED', (payload: TickCompletePayloadLike) => {
      timeStoreHandlers.onTickComplete(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'TIME_ENGINE_TICK', (payload: TickCompletePayloadLike) => {
      timeStoreHandlers.onTickComplete(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'TICK_TIER_CHANGED', (payload: TickTierChangedPayloadLike) => {
      timeStoreHandlers.onTickTierChanged(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'TIME_TIER_CHANGED', (payload: TickTierChangedPayloadLike) => {
      timeStoreHandlers.onTickTierChanged(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'TICK_TIER_FORCED', (payload: { tier?: unknown }) => {
      timeStoreHandlers.onTickTierForced(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'DECISION_WINDOW_OPENED', (payload: any) => {
      timeStoreHandlers.onDecisionWindowOpened(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'DECISION_WINDOW_EXPIRED', (payload: DecisionWindowClosedPayloadLike) => {
      timeStoreHandlers.onDecisionWindowClosed(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'DECISION_WINDOW_RESOLVED', (payload: DecisionWindowClosedPayloadLike) => {
      timeStoreHandlers.onDecisionWindowClosed(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'HOLD_ACTION_USED', (payload: HoldActionUsedPayloadLike) => {
      timeStoreHandlers.onHoldUsed(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'SEASON_TIMEOUT_IMMINENT', (payload: TimeoutPayloadLike) => {
      timeStoreHandlers.onSeasonTimeoutImminent(setState, payload);
    }),
  );

  // Compatibility lane for the current repo warning/complete events.
  unsubs.push(
    register(eventBus, 'TIME_BUDGET_WARNING', (payload: TimeoutPayloadLike) => {
      timeStoreHandlers.onSeasonTimeoutImminent(setState, payload);
    }),
  );

  unsubs.push(
    register(eventBus, 'TIME_ENGINE_COMPLETE', () => {
      timeStoreHandlers.onRunEnded(setState);
    }),
  );

  return {
    detach: (): void => {
      for (const unsub of unsubs.splice(0, unsubs.length)) {
        try {
          unsub();
        } catch {
          // Silent detach — bridge teardown must never break app shutdown.
        }
      }
    },
  };
}

export function wireTimeEventBridgeToStore(eventBus: EventBus): TimeEventBridgeBinding {
  return wireTimeEventBridge(eventBus, { setState: useEngineStore.setState });
}
