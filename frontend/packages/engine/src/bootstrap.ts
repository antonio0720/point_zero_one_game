/**
 * bootstrap.ts — Strategy A one-time wiring for @pzo/engine
 *
 * Re-wires EventBus → Zustand stores after EngineOrchestrator.reset(),
 * and avoids duplicate runStore mirror subscriptions across HMR cycles.
 */

import { sharedEventBus } from './zero/EventBus';
import { useEngineStore, wireAllEngineHandlers, wireRunStoreMirror } from './store/engineStore';

interface BootstrapState {
  initialized: boolean;
  mirrorUnsub: (() => void) | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __PZO_ENGINE_BOOTSTRAP_STATE__: BootstrapState | undefined;
}

function getBootstrapState(): BootstrapState {
  if (!globalThis.__PZO_ENGINE_BOOTSTRAP_STATE__) {
    globalThis.__PZO_ENGINE_BOOTSTRAP_STATE__ = {
      initialized: false,
      mirrorUnsub: null,
    };
  }

  return globalThis.__PZO_ENGINE_BOOTSTRAP_STATE__;
}

export function bootstrapEngine(opts?: { force?: boolean }): void {
  const state = getBootstrapState();
  const force = opts?.force === true;

  if (state.initialized && !force) {
    return;
  }

  if (state.mirrorUnsub) {
    try {
      state.mirrorUnsub();
    } catch {
      // ignore stale unsubscribe closures during HMR / route transitions
    }
    state.mirrorUnsub = null;
  }

  wireAllEngineHandlers(sharedEventBus, useEngineStore.setState as any);
  state.mirrorUnsub = wireRunStoreMirror();
  state.initialized = true;

  if (process.env.NODE_ENV !== 'production') {
    console.info('[PZO] bootstrapEngine complete');
  }
}
