/**
 * POINT ZERO ONE — ENGINE EVENT BINDINGS
 * File: pzo-web/src/engines/core/EngineEventBindings.ts
 *
 * Purpose:
 * - Centralize EventBus → Zustand wiring for frontend engine state
 * - Remove time-event wiring from ad hoc orchestrator patches
 * - Normalize multiple generations of event names / payload shapes
 *
 * Grounding:
 * - The current repo already carries a compatibility EventBus bridge and a
 *   monolithic in-file time store handler block inside engineStore.ts.
 * - This module extracts the runtime binding concern so EngineOrchestrator can
 *   stay focused on sequencing and deterministic flush behavior.
 */

import type { EventBus, EngineEventName } from './EventBus';
import { useEngineStore } from '../../store/engineStore';
import {
  timeStoreHandlers,
  type DecisionWindowCountdownPayload,
  type DecisionWindowOpenedPayload,
  type HoldUsedPayload,
  type SeasonTimeoutImminentPayload,
  type TimeTickCompletePayload,
  type TimeTierChangedPayload,
  type TimeSliceStateCarrier,
} from '../../store/slices/timeSlice';

type EventEnvelope = {
  type?: string;
  name?: string;
  eventType?: string;
  payload?: unknown;
  tickIndex?: number;
  timestamp?: number;
} & Record<string, unknown>;

type StoreUpdater = Parameters<typeof useEngineStore.setState>[0];

function extractPayload<T>(input: unknown): T {
  if (input && typeof input === 'object' && 'payload' in (input as Record<string, unknown>)) {
    return ((input as EventEnvelope).payload ?? {}) as T;
  }
  return (input ?? {}) as T;
}

function mutateStore(mutator: (state: TimeSliceStateCarrier) => void): void {
  useEngineStore.setState((state) => {
    mutator(state as unknown as TimeSliceStateCarrier);
  });
}

export interface EngineEventBindingsOptions {
  /** Register canonical channels on the compatibility bus before subscribing. */
  registerChannels?: boolean;
  /** Mirror legacy aliases in addition to canonical event names. */
  includeLegacyAliases?: boolean;
  /** Emit debug warnings to console for malformed event payloads. */
  debug?: boolean;
}

type Unsubscribe = () => void;

export class EngineEventBindings {
  private readonly disposers: Unsubscribe[] = [];
  private readonly options: Required<EngineEventBindingsOptions>;
  private isBound = false;

  public constructor(
    private readonly eventBus: EventBus,
    options: EngineEventBindingsOptions = {},
  ) {
    this.options = {
      registerChannels: options.registerChannels ?? true,
      includeLegacyAliases: options.includeLegacyAliases ?? true,
      debug: options.debug ?? false,
    };
  }

  public bind(): void {
    if (this.isBound) return;

    if (this.options.registerChannels && typeof this.eventBus.registerEventChannels === 'function') {
      this.eventBus.registerEventChannels([
        { name: 'RUN_STARTED', description: 'Frontend run lifecycle start' },
        { name: 'RUN_ENDED', description: 'Frontend run lifecycle end' },
        { name: 'TICK_COMPLETE', description: 'Frontend run tick complete' },
        { name: 'TICK_TIER_CHANGED', description: 'Canonical time tier transition' },
        { name: 'TIME_TIER_CHANGED', description: 'Legacy time tier transition alias' },
        { name: 'CARD_WINDOW_OPENED', description: 'Forced-card window opened' },
        { name: 'CARD_WINDOW_CLOSED', description: 'Forced-card window closed' },
        { name: 'CARD_WINDOW_EXPIRED', description: 'Forced-card window expired' },
        { name: 'CARD_HOLD_PLACED', description: 'Decision hold applied' },
        { name: 'CARD_HOLD_RELEASED', description: 'Decision hold released' },
        { name: 'TIME_BUDGET_WARNING', description: 'Season tick budget warning' },
      ]);
    }

    this.bindRunLifecycleEvents();
    this.bindTimeEvents();

    this.isBound = true;
  }

  public dispose(): void {
    while (this.disposers.length > 0) {
      const disposer = this.disposers.pop();
      try {
        disposer?.();
      } catch {
        /* no-op */
      }
    }
    this.isBound = false;
  }

  public getBindingCount(): number {
    return this.disposers.length;
  }

  private bindRunLifecycleEvents(): void {
    this.subscribe('RUN_STARTED', (event) => {
      const payload = extractPayload<{ tickBudget?: number; seasonTickBudget?: number }>(event);
      const tickBudget = payload.tickBudget ?? payload.seasonTickBudget ?? 0;

      mutateStore((state) => {
        timeStoreHandlers.onRunStartedDraft(state, tickBudget);
      });
    });

    this.subscribe('RUN_ENDED', () => {
      mutateStore((state) => {
        timeStoreHandlers.onRunEndedDraft(state);
      });
    });

    this.subscribe('TIME_ENGINE_COMPLETE', () => {
      mutateStore((state) => {
        timeStoreHandlers.onRunEndedDraft(state);
      });
    });
  }

  private bindTimeEvents(): void {
    const tierChangedHandler = (event: unknown): void => {
      const payload = extractPayload<TimeTierChangedPayload>(event);
      mutateStore((state) => {
        timeStoreHandlers.onTickTierChangedDraft(state, payload);
      });
    };

    this.subscribe('TICK_TIER_CHANGED', tierChangedHandler);
    if (this.options.includeLegacyAliases) {
      this.subscribe('TIME_TIER_CHANGED', tierChangedHandler);
    }

    this.subscribe('TICK_TIER_FORCED', (event) => {
      const payload = extractPayload<{ tier: any; durationTicks?: number; newDurationMs?: number }>(event);
      if (!payload?.tier) {
        this.debugWarn('TICK_TIER_FORCED payload missing tier', event);
        return;
      }
      mutateStore((state) => {
        timeStoreHandlers.onTickTierForcedDraft(state, payload);
      });
    });

    this.subscribe('TICK_COMPLETE', (event) => {
      const payload = extractPayload<TimeTickCompletePayload>(event);
      mutateStore((state) => {
        timeStoreHandlers.onTickCompleteDraft(state, payload);
      });
    });

    const onWindowOpened = (event: unknown): void => {
      const payload = extractPayload<DecisionWindowOpenedPayload>(event);
      if (!payload?.cardId || typeof payload.durationMs !== 'number') {
        this.debugWarn('Decision window open payload malformed', event);
        return;
      }
      mutateStore((state) => {
        timeStoreHandlers.onDecisionWindowOpenedDraft(state, payload);
      });
    };

    this.subscribe('CARD_WINDOW_OPENED', onWindowOpened);
    if (this.options.includeLegacyAliases) {
      this.subscribe('decision:window_opened' as EngineEventName, onWindowOpened);
      this.subscribe('DECISION_WINDOW_OPENED' as EngineEventName, onWindowOpened);
    }

    const onWindowClosed = (event: unknown): void => {
      const payload = extractPayload<{ windowId?: string; cardId?: string }>(event);
      const identifier = payload.windowId ?? payload.cardId;
      if (!identifier) {
        this.debugWarn('Decision window close payload missing identifier', event);
        return;
      }
      mutateStore((state) => {
        timeStoreHandlers.onDecisionWindowClosedDraft(state, identifier);
      });
    };

    this.subscribe('CARD_WINDOW_CLOSED', onWindowClosed);
    if (this.options.includeLegacyAliases) {
      this.subscribe('decision:window_closed' as EngineEventName, onWindowClosed);
      this.subscribe('DECISION_WINDOW_RESOLVED' as EngineEventName, (event) => {
        const payload = extractPayload<{ windowId?: string; cardId?: string }>(event);
        const identifier = payload.windowId ?? payload.cardId;
        if (!identifier) return;
        mutateStore((state) => {
          timeStoreHandlers.onDecisionWindowResolvedDraft(state, identifier);
        });
      });
    }

    this.subscribe('CARD_WINDOW_EXPIRED', (event) => {
      const payload = extractPayload<{ windowId?: string; cardId?: string }>(event);
      const identifier = payload.windowId ?? payload.cardId;
      if (!identifier) return;
      mutateStore((state) => {
        timeStoreHandlers.onDecisionWindowExpiredDraft(state, identifier);
      });
    });

    if (this.options.includeLegacyAliases) {
      this.subscribe('DECISION_WINDOW_EXPIRED' as EngineEventName, (event) => {
        const payload = extractPayload<{ windowId?: string; cardId?: string }>(event);
        const identifier = payload.windowId ?? payload.cardId;
        if (!identifier) return;
        mutateStore((state) => {
          timeStoreHandlers.onDecisionWindowExpiredDraft(state, identifier);
        });
      });

      this.subscribe('decision:resolved' as EngineEventName, onWindowClosed);
      this.subscribe('decision:expired' as EngineEventName, (event) => {
        const payload = extractPayload<{ windowId?: string; cardId?: string }>(event);
        const identifier = payload.windowId ?? payload.cardId;
        if (!identifier) return;
        mutateStore((state) => {
          timeStoreHandlers.onDecisionWindowExpiredDraft(state, identifier);
        });
      });

      this.subscribe('decision:countdown_tick' as EngineEventName, (event) => {
        const payload = extractPayload<DecisionWindowCountdownPayload>(event);
        mutateStore((state) => {
          timeStoreHandlers.onDecisionWindowTickDraft(state, payload);
        });
      });
    }

    const onHoldUsed = (event: unknown): void => {
      const payload = extractPayload<HoldUsedPayload>(event);
      mutateStore((state) => {
        timeStoreHandlers.onHoldUsedDraft(state, payload);
      });
    };

    this.subscribe('CARD_HOLD_PLACED', onHoldUsed);
    this.subscribe('TIME_HOLD_USED', onHoldUsed);

    this.subscribe('CARD_HOLD_RELEASED', (event) => {
      const payload = extractPayload<{ windowId?: string; cardId?: string }>(event);
      const identifier = payload.windowId ?? payload.cardId;
      if (!identifier) return;
      mutateStore((state) => {
        timeStoreHandlers.onHoldReleasedDraft(state, identifier);
      });
    });

    this.subscribe('TIME_BUDGET_WARNING', (event) => {
      const payload = extractPayload<SeasonTimeoutImminentPayload & { ticksUntilTimeout?: number }>(event);
      const ticksRemaining = payload.ticksRemaining ?? payload.ticksUntilTimeout ?? 0;
      mutateStore((state) => {
        timeStoreHandlers.onSeasonTimeoutImminentDraft(state, { ticksRemaining });
      });
    });

    this.subscribe('SEASON_TIMEOUT' as EngineEventName, () => {
      mutateStore((state) => {
        timeStoreHandlers.onRunEndedDraft(state);
      });
    });
  }

  private subscribe(eventName: EngineEventName, handler: (event: unknown) => void): void {
    const bus = this.eventBus as unknown as {
      subscribe?: (event: string, handler: (event: unknown) => void) => (() => void) | void;
      on?: (event: string, handler: (event: unknown) => void) => (() => void) | void;
      unregister?: (event: string, handler: (event: unknown) => void) => void;
      off?: (event: string, handler: (event: unknown) => void) => void;
      register?: (event: string, handler: (event: unknown) => void) => void;
    };

    if (typeof bus.subscribe === 'function') {
      const maybeDisposer = bus.subscribe(eventName, handler);
      this.disposers.push(typeof maybeDisposer === 'function' ? maybeDisposer : () => {
        if (typeof bus.unregister === 'function') {
          bus.unregister(eventName, handler);
        }
      });
      return;
    }

    if (typeof bus.on === 'function') {
      const maybeDisposer = bus.on(eventName, handler);
      this.disposers.push(typeof maybeDisposer === 'function' ? maybeDisposer : () => {
        if (typeof bus.off === 'function') {
          bus.off(eventName, handler);
        } else if (typeof bus.unregister === 'function') {
          bus.unregister(eventName, handler);
        }
      });
      return;
    }

    if (typeof bus.register === 'function') {
      bus.register(eventName, handler);
      this.disposers.push(() => {
        if (typeof bus.unregister === 'function') {
          bus.unregister(eventName, handler);
        }
      });
      return;
    }

    this.debugWarn(`EventBus has no subscribe/on/register surface for ${eventName}`, null);
  }

  private debugWarn(message: string, event: unknown): void {
    if (!this.options.debug) return;
    // eslint-disable-next-line no-console
    console.warn(`[EngineEventBindings] ${message}`, event);
  }
}

export function bindEngineEvents(
  eventBus: EventBus,
  options?: EngineEventBindingsOptions,
): EngineEventBindings {
  const bindings = new EngineEventBindings(eventBus, options);
  bindings.bind();
  return bindings;
}

export default EngineEventBindings;
