/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO LIFECYCLE CONTROLLER
 * pzo-web/src/engines/zero/ZeroLifecycleController.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 * - Provide a zero-owned runtime control surface above EngineOrchestrator.
 * - Preserve the doctrine that only EngineOrchestrator calls engine methods.
 * - Add operator-safe controls for:
 *   - start
 *   - tick
 *   - tick batches
 *   - pause / resume
 *   - abandon
 *   - reset
 *   - status / journal / observers
 *
 * What this controller is
 * - A façade for lifecycle intent.
 * - A stateful operator boundary.
 * - A bridge across orchestrator, stores, event bus, and runtime status.
 *
 * What this controller is not
 * - Not a second orchestrator.
 * - Not a scheduler replacement.
 * - Not a direct engine invoker.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { EventBus, sharedEventBus } from '../core/EventBus';
import { EngineOrchestrator, type StartRunParams } from './EngineOrchestrator';
import type {
  EngineEvent,
  EngineEventName,
  RunLifecycleState,
  RunOutcome,
  TickResult,
} from './types';
import { useEngineStore } from '../../store/engineStore';
import { ZeroStoreBridge, zeroStoreBridge } from './ZeroStoreBridge';
import {
  ZeroRuntimeStatus,
  type ZeroPauseSnapshot,
  type ZeroRuntimeStatusSnapshot,
} from './ZeroRuntimeStatus';
import type { FrontendRunMode } from '../../game/modes';

export type ZeroLifecycleAction =
  | 'START_RUN'
  | 'PAUSE'
  | 'RESUME'
  | 'EXECUTE_TICK'
  | 'EXECUTE_TICKS'
  | 'END_RUN'
  | 'ABANDON_RUN'
  | 'RESET'
  | 'EVENT_RUN_STARTED'
  | 'EVENT_RUN_ENDED'
  | 'EVENT_TICK_COMPLETE'
  | 'EVENT_TICK_STEP_ERROR';

export interface ZeroLifecycleTransitionRecord {
  readonly at: number;
  readonly action: ZeroLifecycleAction;
  readonly from: RunLifecycleState | 'UNKNOWN';
  readonly to: RunLifecycleState | 'UNKNOWN';
  readonly metadata?: Record<string, unknown>;
}

export interface ZeroLifecycleControllerOptions {
  orchestrator?: EngineOrchestrator;
  eventBus?: EventBus;
  storeBridge?: ZeroStoreBridge;
  runtimeStatus?: ZeroRuntimeStatus;
  autoBindStoreBridge?: boolean;
  autoWireEngineHandlers?: boolean;
  autoWireRunMirror?: boolean;
  initialMode?: FrontendRunMode | null;
  initialModeOverrides?: Record<string, unknown>;
}

export interface ZeroStartRunOptions {
  mode?: FrontendRunMode;
  modeOverrides?: Record<string, unknown>;
  bindStoreBridge?: boolean;
  wireEngineHandlers?: boolean;
  wireRunMirror?: boolean;
  resetEngineSlicesBeforeBind?: boolean;
  syncRunMirrorImmediately?: boolean;
}

export interface ZeroPauseState extends ZeroPauseSnapshot {
  readonly resumeCount: number;
}

export class ZeroLifecycleController {
  private readonly orchestrator: EngineOrchestrator;
  private readonly eventBus: EventBus;
  private readonly storeBridge: ZeroStoreBridge;
  private readonly runtimeStatus: ZeroRuntimeStatus;

  private readonly eventUnsubscribers: Array<() => void> = [];
  private readonly transitionJournal: ZeroLifecycleTransitionRecord[] = [];

  private currentMode: FrontendRunMode | null;
  private currentModeOverrides: Record<string, unknown>;
  private lastStartParams: StartRunParams | null = null;

  private isPausedFlag = false;
  private pauseReason: string | null = null;
  private pausedAt: number | null = null;
  private resumeCount = 0;

  public constructor(options: ZeroLifecycleControllerOptions = {}) {
    this.orchestrator = options.orchestrator ?? new EngineOrchestrator();
    this.eventBus = options.eventBus ?? sharedEventBus;
    this.storeBridge = options.storeBridge ?? zeroStoreBridge;

    this.currentMode = options.initialMode ?? null;
    this.currentModeOverrides = { ...(options.initialModeOverrides ?? {}) };

    this.runtimeStatus =
      options.runtimeStatus ??
      new ZeroRuntimeStatus({
        orchestrator: this.orchestrator,
        eventBus: this.eventBus,
        getPauseState: () => this.getPauseState(),
        getMode: () => this.currentMode,
        getModeOverrides: () => ({ ...this.currentModeOverrides }),
        getFreedomThreshold: () => this.lastStartParams?.freedomThreshold ?? 0,
      });

    this.installEventObservers();

    if (options.autoBindStoreBridge !== false) {
      this.storeBridge.bind({
        eventBus: this.eventBus,
        wireEngineHandlers: options.autoWireEngineHandlers ?? true,
        wireRunMirror: options.autoWireRunMirror ?? true,
        syncRunMirrorImmediately: true,
      });
    }
  }

  public getOrchestrator(): EngineOrchestrator {
    return this.orchestrator;
  }

  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public getStoreBridge(): ZeroStoreBridge {
    return this.storeBridge;
  }

  public getRuntimeStatus(): ZeroRuntimeStatus {
    return this.runtimeStatus;
  }

  public getCurrentMode(): FrontendRunMode | null {
    return this.currentMode;
  }

  public setMode(
    mode: FrontendRunMode | null,
    overrides: Record<string, unknown> = {},
  ): void {
    this.currentMode = mode;
    this.currentModeOverrides = { ...overrides };
    this.runtimeStatus.setMode(mode, this.currentModeOverrides);
  }

  public getPauseState(): ZeroPauseState {
    return {
      isPaused: this.isPausedFlag,
      reason: this.pauseReason,
      pausedAt: this.pausedAt,
      resumeCount: this.resumeCount,
    };
  }

  public getLifecycleState(): RunLifecycleState | 'UNKNOWN' {
    try {
      return this.orchestrator.getLifecycleState();
    } catch {
      return 'UNKNOWN';
    }
  }

  public isRunActive(): boolean {
    const state = this.getLifecycleState();
    return state === 'ACTIVE' || state === 'STARTING' || state === 'TICK_LOCKED';
  }

  public isPaused(): boolean {
    return this.isPausedFlag;
  }

  public canExecuteTick(): boolean {
    return this.getLifecycleState() === 'ACTIVE' && !this.isPausedFlag;
  }

  public bindStoreBridge(options: Omit<ZeroStartRunOptions, 'mode' | 'modeOverrides'> = {}): void {
    this.storeBridge.bind({
      eventBus: this.eventBus,
      wireEngineHandlers: options.wireEngineHandlers ?? true,
      wireRunMirror: options.wireRunMirror ?? true,
      resetEngineSlicesBeforeBind: options.resetEngineSlicesBeforeBind ?? false,
      syncRunMirrorImmediately: options.syncRunMirrorImmediately ?? true,
    });
  }

  public startRun(
    params: StartRunParams,
    options: ZeroStartRunOptions = {},
  ): void {
    const before = this.getLifecycleState();

    if (options.mode !== undefined) {
      this.setMode(options.mode, options.modeOverrides ?? {});
    }

    if (options.bindStoreBridge !== false) {
      this.bindStoreBridge({
        wireEngineHandlers: options.wireEngineHandlers,
        wireRunMirror: options.wireRunMirror,
        resetEngineSlicesBeforeBind: options.resetEngineSlicesBeforeBind,
        syncRunMirrorImmediately: options.syncRunMirrorImmediately,
      });
    }

    this.lastStartParams = params;
    this.isPausedFlag = false;
    this.pauseReason = null;
    this.pausedAt = null;
    this.runtimeStatus.setFreedomThreshold(params.freedomThreshold);

    this.orchestrator.startRun(params);
    this.storeBridge.syncRunMirrorNow();

    this.recordTransition('START_RUN', before, this.getLifecycleState(), {
      runId: params.runId,
      userId: params.userId,
      seed: params.seed,
      seasonTickBudget: params.seasonTickBudget,
      freedomThreshold: params.freedomThreshold,
      mode: this.currentMode,
    });
  }

  public pause(reason = 'MANUAL_PAUSE'): boolean {
    if (!this.isRunActive() || this.isPausedFlag) {
      return false;
    }

    const before = this.getLifecycleState();

    this.isPausedFlag = true;
    this.pauseReason = reason;
    this.pausedAt = Date.now();

    this.recordTransition('PAUSE', before, this.getLifecycleState(), {
      reason,
      pausedAt: this.pausedAt,
    });

    return true;
  }

  public resume(): boolean {
    if (!this.isPausedFlag) {
      return false;
    }

    const before = this.getLifecycleState();

    this.isPausedFlag = false;
    this.pauseReason = null;
    this.pausedAt = null;
    this.resumeCount += 1;

    this.recordTransition('RESUME', before, this.getLifecycleState(), {
      resumeCount: this.resumeCount,
    });

    return true;
  }

  public async executeTick(): Promise<TickResult | null> {
    if (!this.canExecuteTick()) {
      return null;
    }

    const before = this.getLifecycleState();
    const result = await this.orchestrator.executeTick();
    this.storeBridge.syncRunMirrorNow();

    this.recordTransition('EXECUTE_TICK', before, this.getLifecycleState(), {
      tickIndex: result?.tickIndex ?? null,
      runOutcome: result?.runOutcome ?? null,
      tickDurationMs: result?.tickDurationMs ?? null,
    });

    if (result?.runOutcome) {
      this.isPausedFlag = false;
      this.pauseReason = null;
      this.pausedAt = null;
    }

    return result;
  }

  public async executeTicks(count: number): Promise<TickResult[]> {
    const safeCount = Math.max(0, Math.trunc(count));
    const results: TickResult[] = [];

    for (let i = 0; i < safeCount; i += 1) {
      const result = await this.executeTick();
      if (!result) {
        break;
      }

      results.push(result);

      if (result.runOutcome !== null) {
        break;
      }
    }

    this.recordTransition('EXECUTE_TICKS', this.getLifecycleState(), this.getLifecycleState(), {
      requestedCount: safeCount,
      completedCount: results.length,
      lastRunOutcome: results.length ? results[results.length - 1].runOutcome : null,
    });

    return results;
  }

  public async endRun(outcome: RunOutcome): Promise<void> {
    const before = this.getLifecycleState();
    await this.orchestrator.endRun(outcome);
    this.storeBridge.syncRunMirrorNow();

    this.isPausedFlag = false;
    this.pauseReason = null;
    this.pausedAt = null;

    this.recordTransition('END_RUN', before, this.getLifecycleState(), {
      outcome,
      runId: this.orchestrator.getCurrentRunId(),
    });
  }

  public async abandonRun(reason = 'USER_ABANDONED'): Promise<void> {
    const before = this.getLifecycleState();

    this.pauseReason = reason;
    this.isPausedFlag = false;
    this.pausedAt = null;

    await this.orchestrator.endRun('ABANDONED');
    this.storeBridge.syncRunMirrorNow();

    this.recordTransition('ABANDON_RUN', before, this.getLifecycleState(), {
      reason,
      runId: this.orchestrator.getCurrentRunId(),
    });
  }

  public reset(options: { resetEngineStoreSlices?: boolean } = {}): void {
    const before = this.getLifecycleState();

    this.orchestrator.reset();
    this.storeBridge.syncRunMirrorNow();

    if (options.resetEngineStoreSlices !== false) {
      useEngineStore.getState().resetAllSlices();
    }

    this.lastStartParams = null;
    this.isPausedFlag = false;
    this.pauseReason = null;
    this.pausedAt = null;

    this.recordTransition('RESET', before, this.getLifecycleState(), {
      resetEngineStoreSlices: options.resetEngineStoreSlices !== false,
    });
  }

  public getStatusSnapshot(): ZeroRuntimeStatusSnapshot {
    return this.runtimeStatus.getSnapshot();
  }

  public getTransitionJournal(): readonly ZeroLifecycleTransitionRecord[] {
    return [...this.transitionJournal];
  }

  public subscribe<T extends EngineEventName>(
    eventType: T,
    handler: (event: EngineEvent<T>) => void,
  ): () => void {
    return this.eventBus.on(eventType as any, handler as any);
  }

  public dispose(): void {
    while (this.eventUnsubscribers.length > 0) {
      const unsubscribe = this.eventUnsubscribers.pop();
      try {
        unsubscribe?.();
      } catch {
        // no-op
      }
    }

    this.storeBridge.dispose();
  }

  private installEventObservers(): void {
    this.eventUnsubscribers.push(
      this.eventBus.on('RUN_STARTED', (event: any) => {
        this.recordTransition(
          'EVENT_RUN_STARTED',
          this.getLifecycleState(),
          this.getLifecycleState(),
          { payload: event?.payload ?? null },
        );
      }),
    );

    this.eventUnsubscribers.push(
      this.eventBus.on('RUN_ENDED', (event: any) => {
        this.recordTransition(
          'EVENT_RUN_ENDED',
          this.getLifecycleState(),
          this.getLifecycleState(),
          { payload: event?.payload ?? null },
        );
      }),
    );

    this.eventUnsubscribers.push(
      this.eventBus.on('TICK_COMPLETE', (event: any) => {
        this.recordTransition(
          'EVENT_TICK_COMPLETE',
          this.getLifecycleState(),
          this.getLifecycleState(),
          { payload: event?.payload ?? null },
        );
      }),
    );

    this.eventUnsubscribers.push(
      this.eventBus.on('TICK_STEP_ERROR', (event: any) => {
        this.recordTransition(
          'EVENT_TICK_STEP_ERROR',
          this.getLifecycleState(),
          this.getLifecycleState(),
          { payload: event?.payload ?? null },
        );
      }),
    );
  }

  private recordTransition(
    action: ZeroLifecycleAction,
    from: RunLifecycleState | 'UNKNOWN',
    to: RunLifecycleState | 'UNKNOWN',
    metadata?: Record<string, unknown>,
  ): void {
    this.transitionJournal.push({
      at: Date.now(),
      action,
      from,
      to,
      metadata,
    });

    while (this.transitionJournal.length > 256) {
      this.transitionJournal.shift();
    }
  }
}

export const zeroLifecycleController = new ZeroLifecycleController();

export default zeroLifecycleController;