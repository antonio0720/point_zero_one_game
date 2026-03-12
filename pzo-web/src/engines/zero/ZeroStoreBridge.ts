/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO STORE BRIDGE
 * pzo-web/src/engines/zero/ZeroStoreBridge.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 * - Provide the zero-owned, repo-aligned bridge between EventBus flushes and
 *   Zustand runtime state.
 * - Preserve the existing engineStore/runStore contracts already present in
 *   the repo instead of introducing a competing store abstraction.
 * - Prevent accidental double-wiring of engine handlers on the same EventBus.
 * - Give Engine 0 lifecycle helpers a hardened, single place to:
 *   - wire store handlers
 *   - wire runStore mirror sync
 *   - snapshot runtime state
 *   - synchronize mirror state on demand
 *
 * Important grounding
 * - engineStore.ts already owns the canonical event wiring through
 *   wireAllEngineHandlers(eventBus, set) and wireRunStoreMirror().
 * - Those wiring functions do not return per-event unsubscriber handles for the
 *   engine handler graph, so once a given EventBus is wired, it must be treated
 *   as wired for life.
 * - Orchestrator.startRun() now clears the queue, not all subscribers, so the
 *   safe doctrine is: wire a bus once, then reuse it.
 *
 * Doctrine
 * - No new store contract.
 * - No direct engine method calls.
 * - No duplicate EventBus subscriber trees.
 * - No mutation outside the repo’s existing Zustand actions.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { EventBus, sharedEventBus } from '../core/EventBus';
import {
  useEngineStore,
  wireAllEngineHandlers,
  wireRunStoreMirror,
  type EngineStoreState,
  type ZustandSet,
} from '../../store/engineStore';
import {
  runStore,
  selectEngineStoreMirrorSnapshot,
  type EngineStoreMirrorSnapshot,
  type RunStoreSlice,
} from '../../store/runStore';

export interface ZeroStoreBridgeOptions {
  eventBus?: EventBus;
  wireEngineHandlers?: boolean;
  wireRunMirror?: boolean;
  resetEngineSlicesBeforeBind?: boolean;
  syncRunMirrorImmediately?: boolean;
}

export interface ZeroStoreBridgeSnapshot {
  readonly generatedAt: number;
  readonly isBound: boolean;
  readonly eventBusPendingCount: number;
  readonly eventBusIsFlushing: boolean;
  readonly registeredChannels: string[];
  readonly engineStore: EngineStoreState;
  readonly runMirror: EngineStoreMirrorSnapshot;
  readonly runStore: RunStoreSlice;
}

export interface ZeroStoreBridgeBinding {
  readonly eventBus: EventBus;
  readonly engineHandlersWired: boolean;
  readonly runMirrorWired: boolean;
  readonly syncRunMirrorNow: () => void;
  readonly getSnapshot: () => ZeroStoreBridgeSnapshot;
  readonly dispose: () => void;
}

/**
 * Small helper for stores whose subscribe signature depends on middleware.
 */
type GenericSubscribableStore<TState> = {
  getState(): TState;
  subscribe(listener: (state: TState, prevState: TState) => void): () => void;
};

function safeGetPendingCount(eventBus: EventBus): number {
  const maybe = (eventBus as EventBus & { getPendingCount?: () => number }).getPendingCount;
  return typeof maybe === 'function' ? Number(maybe.call(eventBus) ?? 0) : 0;
}

function safeGetFlushingState(eventBus: EventBus): boolean {
  return Boolean(
    (eventBus as EventBus & { isCurrentlyFlushing?: boolean }).isCurrentlyFlushing,
  );
}

function safeGetRegisteredChannels(eventBus: EventBus): string[] {
  const maybe = (
    eventBus as EventBus & { getRegisteredChannels?: () => string[] }
  ).getRegisteredChannels;

  if (typeof maybe !== 'function') {
    return [];
  }

  try {
    return maybe.call(eventBus) ?? [];
  } catch {
    return [];
  }
}

export class ZeroStoreBridge {
  private readonly wiredEventBuses = new WeakSet<EventBus>();
  private boundEventBus: EventBus | null = null;
  private runMirrorUnsubscribe: (() => void) | null = null;

  /**
   * Bind the current EventBus into the repo’s canonical engineStore + runStore
   * bridge functions.
   *
   * Notes
   * - Engine handlers are wired once per EventBus instance.
   * - runStore mirror may be reattached/disposed because that helper returns
   *   an unsubscribe function.
   */
  public bind(options: ZeroStoreBridgeOptions = {}): ZeroStoreBridgeBinding {
    const eventBus = options.eventBus ?? this.boundEventBus ?? sharedEventBus;

    if (options.resetEngineSlicesBeforeBind) {
      useEngineStore.getState().resetAllSlices();
    }

    if (options.wireEngineHandlers !== false && !this.wiredEventBuses.has(eventBus)) {
      wireAllEngineHandlers(eventBus as any, useEngineStore.setState as ZustandSet);
      this.wiredEventBuses.add(eventBus);
    }

    if (options.wireRunMirror !== false && !this.runMirrorUnsubscribe) {
      this.runMirrorUnsubscribe = wireRunStoreMirror();
    }

    this.boundEventBus = eventBus;

    if (options.syncRunMirrorImmediately !== false) {
      this.syncRunMirrorNow();
    }

    return {
      eventBus,
      engineHandlersWired: this.wiredEventBuses.has(eventBus),
      runMirrorWired: Boolean(this.runMirrorUnsubscribe),
      syncRunMirrorNow: this.syncRunMirrorNow,
      getSnapshot: this.getSnapshot,
      dispose: this.dispose,
    };
  }

  /**
   * Mark an EventBus as already wired.
   * Useful if another bootstrap lane handled canonical wiring before this bridge
   * instance was constructed.
   */
  public markEventBusWired(eventBus: EventBus = this.boundEventBus ?? sharedEventBus): void {
    this.wiredEventBuses.add(eventBus);
    this.boundEventBus = eventBus;
  }

  public isEventBusWired(eventBus: EventBus = this.boundEventBus ?? sharedEventBus): boolean {
    return this.wiredEventBuses.has(eventBus);
  }

  public getEventBus(): EventBus {
    return this.boundEventBus ?? sharedEventBus;
  }

  public isBound(): boolean {
    return this.boundEventBus !== null;
  }

  /**
   * Push the current runStore mirror snapshot into engineStore.runtime.
   */
  public syncRunMirrorNow = (): void => {
    const snapshot = selectEngineStoreMirrorSnapshot(runStore.getState());
    useEngineStore.getState().syncRunMirror(snapshot);
  };

  public getEngineStoreState(): EngineStoreState {
    return useEngineStore.getState();
  }

  public getRunStoreState(): RunStoreSlice {
    return runStore.getState();
  }

  public getRunMirrorSnapshot(): EngineStoreMirrorSnapshot {
    return selectEngineStoreMirrorSnapshot(runStore.getState());
  }

  public getSnapshot = (): ZeroStoreBridgeSnapshot => {
    const eventBus = this.getEventBus();

    return {
      generatedAt: Date.now(),
      isBound: this.isBound(),
      eventBusPendingCount: safeGetPendingCount(eventBus),
      eventBusIsFlushing: safeGetFlushingState(eventBus),
      registeredChannels: safeGetRegisteredChannels(eventBus),
      engineStore: useEngineStore.getState(),
      runMirror: selectEngineStoreMirrorSnapshot(runStore.getState()),
      runStore: runStore.getState(),
    };
  };

  /**
   * Subscribe to the whole engineStore state.
   * This is intentionally broad; zero selectors can be layered on top later.
   */
  public subscribeEngineStore(
    listener: (state: EngineStoreState, prevState: EngineStoreState) => void,
  ): () => void {
    const store = useEngineStore as unknown as GenericSubscribableStore<EngineStoreState>;
    return store.subscribe(listener);
  }

  /**
   * Subscribe to the whole runStore state.
   * runStore uses subscribeWithSelector internally, but the broad state listener
   * form remains safe and deterministic for infrastructure observers.
   */
  public subscribeRunStore(
    listener: (state: RunStoreSlice, prevState: RunStoreSlice) => void,
  ): () => void {
    const store = runStore as unknown as GenericSubscribableStore<RunStoreSlice>;
    return store.subscribe(listener);
  }

  /**
   * Dispose only the detachable mirror lane.
   *
   * Engine handler wiring is intentionally NOT removed because the repo’s
   * canonical wiring function does not return handler-level unsubscribe hooks.
   * That is by design here: wire once per EventBus, then reuse that bus.
   */
  public dispose = (): void => {
    if (this.runMirrorUnsubscribe) {
      this.runMirrorUnsubscribe();
      this.runMirrorUnsubscribe = null;
    }

    this.boundEventBus = null;
  };
}

export const zeroStoreBridge = new ZeroStoreBridge();

export function bindZeroStoreBridge(
  options: ZeroStoreBridgeOptions = {},
): ZeroStoreBridgeBinding {
  return zeroStoreBridge.bind(options);
}

export default zeroStoreBridge;