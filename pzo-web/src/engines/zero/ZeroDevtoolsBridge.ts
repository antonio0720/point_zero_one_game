/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO DEVTOOLS BRIDGE
 * pzo-web/src/engines/zero/ZeroDevtoolsBridge.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 * - Expose a hardened, opt-in, browser-side devtools surface for Engine 0.
 * - Publish runtime control and inspection APIs onto window for:
 *   - overlays
 *   - debug consoles
 *   - QA tooling
 *   - operator panels
 * - Keep the interface read-mostly and façade-based:
 *   - lifecycle control routes through ZeroLifecycleController
 *   - event inspection routes through ZeroEventBridge
 *   - diagnostics routes through ZeroDiagnostics
 *   - state inspection routes through ZeroStoreBridge / ZeroRuntimeStatus
 *
 * Doctrine
 * - No direct engine invocations.
 * - No bypass around EngineOrchestrator.
 * - No mutation outside façade/controller/store actions already present.
 * - Safe no-op when window is unavailable.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { EngineEvent, EngineEventName, RunOutcome } from './types';
import type { StartRunParams } from './EngineOrchestrator';
import {
  ZeroLifecycleController,
  zeroLifecycleController,
} from './ZeroLifecycleController';
import {
  ZeroEventBridge,
  zeroEventBridge,
} from './ZeroEventBridge';
import {
  ZeroDiagnostics,
  zeroDiagnostics,
} from './ZeroDiagnostics';
import {
  ZeroStoreBridge,
  zeroStoreBridge,
} from './ZeroStoreBridge';
import {
  ZeroRuntimeStatus,
  zeroRuntimeStatus,
} from './ZeroRuntimeStatus';

export interface ZeroDevtoolsApi {
  readonly version: string;
  readonly createdAt: number;
  readonly lastPublishedAt: number | null;

  startRun(params: StartRunParams): void;
  tick(): Promise<unknown>;
  ticks(count: number): Promise<unknown[]>;
  pause(reason?: string): boolean;
  resume(): boolean;
  endRun(outcome: RunOutcome): Promise<void>;
  abandon(reason?: string): Promise<void>;
  reset(): void;

  bindStoreBridge(): void;

  getStatus(): ReturnType<ZeroRuntimeStatus['getSnapshot']>;
  getDiagnostics(): ReturnType<ZeroDiagnostics['getSnapshot']>;
  getTransitionJournal(): ReturnType<ZeroLifecycleController['getTransitionJournal']>;
  getObservedEvents(limit?: number): ReturnType<ZeroEventBridge['getObservedHistory']>;
  getEventMetrics(): ReturnType<ZeroEventBridge['getMetrics']>;
  getPendingQueueSnapshot(): ReturnType<ZeroEventBridge['getPendingQueueSnapshot']>;
  getEngineStore(): ReturnType<ZeroStoreBridge['getEngineStoreState']>;
  getRunStore(): ReturnType<ZeroStoreBridge['getRunStoreState']>;
  clearObservedEvents(): void;
  clearDiagnosticJournals(): void;

  subscribe<T extends EngineEventName>(
    eventType: T,
    handler: (event: EngineEvent<T>) => void,
  ): () => void;

  publish(): void;
  uninstall(): void;
}

declare global {
  interface Window {
    __PZO_ZERO_DEVTOOLS__?: ZeroDevtoolsApi;
  }
}

const DEVTOOLS_WINDOW_KEY = '__PZO_ZERO_DEVTOOLS__';
const DEVTOOLS_EVENT_NAME = 'pzo:zero-devtools:published';
const DEVTOOLS_VERSION = '1.0.0';

export interface ZeroDevtoolsBridgeOptions {
  controller?: ZeroLifecycleController;
  eventBridge?: ZeroEventBridge;
  diagnostics?: ZeroDiagnostics;
  storeBridge?: ZeroStoreBridge;
  runtimeStatus?: ZeroRuntimeStatus;
  autoInstall?: boolean;
  autoPublishOnTickComplete?: boolean;
}

export class ZeroDevtoolsBridge {
  private readonly controller: ZeroLifecycleController;
  private readonly eventBridge: ZeroEventBridge;
  private readonly diagnostics: ZeroDiagnostics;
  private readonly storeBridge: ZeroStoreBridge;
  private readonly runtimeStatus: ZeroRuntimeStatus;

  private readonly createdAt = Date.now();
  private lastPublishedAt: number | null = null;
  private tickCompleteUnsubscribe: (() => void) | null = null;

  public constructor(options: ZeroDevtoolsBridgeOptions = {}) {
    this.controller = options.controller ?? zeroLifecycleController;
    this.eventBridge = options.eventBridge ?? zeroEventBridge;
    this.diagnostics = options.diagnostics ?? zeroDiagnostics;
    this.storeBridge = options.storeBridge ?? zeroStoreBridge;
    this.runtimeStatus = options.runtimeStatus ?? zeroRuntimeStatus;

    if (options.autoPublishOnTickComplete !== false) {
      this.tickCompleteUnsubscribe = this.controller.subscribe(
        'TICK_COMPLETE',
        () => {
          this.publish();
        },
      );
    }

    if (options.autoInstall !== false) {
      this.install();
    }
  }

  public install(): void {
    const target = this.getWindow();
    if (!target) {
      return;
    }

    target[DEVTOOLS_WINDOW_KEY] = this.buildApi();
    this.publish();
  }

  public uninstall = (): void => {
    const target = this.getWindow();
    if (target && target[DEVTOOLS_WINDOW_KEY]) {
      delete target[DEVTOOLS_WINDOW_KEY];
    }

    if (this.tickCompleteUnsubscribe) {
      this.tickCompleteUnsubscribe();
      this.tickCompleteUnsubscribe = null;
    }
  };

  public publish(): void {
    const target = this.getWindow();
    if (!target) {
      return;
    }

    target[DEVTOOLS_WINDOW_KEY] = this.buildApi();
    this.lastPublishedAt = Date.now();

    try {
      target.dispatchEvent(
        new CustomEvent(DEVTOOLS_EVENT_NAME, {
          detail: {
            publishedAt: this.lastPublishedAt,
            status: this.runtimeStatus.getSnapshot(),
            diagnostics: this.diagnostics.getSnapshot(),
          },
        }),
      );
    } catch {
      // CustomEvent may be unavailable in certain test hosts.
    }
  }

  public getApi(): ZeroDevtoolsApi {
    return this.buildApi();
  }

  private buildApi(): ZeroDevtoolsApi {
    return {
      version: DEVTOOLS_VERSION,
      createdAt: this.createdAt,
      lastPublishedAt: this.lastPublishedAt,

      startRun: (params) => {
        this.controller.startRun(params, { bindStoreBridge: true });
        this.publish();
      },

      tick: async () => {
        const result = await this.controller.executeTick();
        this.publish();
        return result;
      },

      ticks: async (count) => {
        const results = await this.controller.executeTicks(count);
        this.publish();
        return results;
      },

      pause: (reason) => {
        const result = this.controller.pause(reason);
        this.publish();
        return result;
      },

      resume: () => {
        const result = this.controller.resume();
        this.publish();
        return result;
      },

      endRun: async (outcome) => {
        await this.controller.endRun(outcome);
        this.publish();
      },

      abandon: async (reason) => {
        await this.controller.abandonRun(reason);
        this.publish();
      },

      reset: () => {
        this.controller.reset();
        this.publish();
      },

      bindStoreBridge: () => {
        this.controller.bindStoreBridge();
        this.publish();
      },

      getStatus: () => this.runtimeStatus.getSnapshot(),
      getDiagnostics: () => this.diagnostics.getSnapshot(),
      getTransitionJournal: () => this.controller.getTransitionJournal(),
      getObservedEvents: (limit = 256) => this.eventBridge.getObservedHistory(limit),
      getEventMetrics: () => this.eventBridge.getMetrics(),
      getPendingQueueSnapshot: () => this.eventBridge.getPendingQueueSnapshot(),
      getEngineStore: () => this.storeBridge.getEngineStoreState(),
      getRunStore: () => this.storeBridge.getRunStoreState(),

      clearObservedEvents: () => {
        this.eventBridge.clearObservedHistory();
        this.publish();
      },

      clearDiagnosticJournals: () => {
        this.diagnostics.clearJournals();
        this.publish();
      },

      subscribe: (eventType, handler) =>
        this.controller.subscribe(eventType as any, handler as any),

      publish: () => {
        this.publish();
      },

      uninstall: () => {
        this.uninstall();
      },
    };
  }

  private getWindow(): Window | null {
    return typeof window === 'undefined' ? null : window;
  }
}

export const zeroDevtoolsBridge = new ZeroDevtoolsBridge();

export default zeroDevtoolsBridge;