/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO FACADE
 * pzo-web/src/engines/zero/ZeroFacade.ts
 *
 * Purpose
 * - Provide the single high-level public runtime surface for frontend Engine 0.
 * - Preserve the existing Orchestrator as the only lawful caller of engines.
 * - Centralize run lifecycle, binding orchestration, subscriptions, status, and
 *   mode metadata access behind one production-ready surface.
 *
 * This file is intentionally NOT another orchestrator implementation.
 * It is a sovereign façade over:
 * - EngineOrchestrator
 * - shared EventBus
 * - unified engineStore wiring
 * - runStore mirror wiring
 * - frontend mode catalog / metadata / config projection
 *
 * Density6 LLC · Point Zero One · Engine 0 · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { EngineOrchestrator, type StartRunParams } from './EngineOrchestrator';
import type {
  EngineEvent,
  EngineEventName,
  EngineHealth,
  EngineId,
  RunLifecycleState,
  RunOutcome,
  TickResult,
} from './types';
import type { EventBus } from '../core/EventBus';
import { runStore } from '../../store/runStore';
import {
  frontendModeDirector,
  type FrontendRunMode,
} from '../../game/modes';
import {
  bindZeroRuntime,
  buildZeroRuntimeStatusSnapshot,
  getZeroEventBus,
  getZeroRuntimeBindings,
  markZeroEventBusWiringDirty,
  type ZeroBindingOptions,
  type ZeroRuntimeBindings,
  type ZeroRuntimeStatusSnapshot,
} from './ZeroBindings';

export interface ZeroStartRunOptions
  extends Omit<ZeroBindingOptions, 'orchestrator'> {
  mode?: FrontendRunMode;
  modeSeed?: string | number;
  modeOverrides?: Record<string, unknown>;
}

export class ZeroFacade {
  private readonly orchestrator: EngineOrchestrator;
  private lastTickResult: TickResult | null = null;
  private currentMode: FrontendRunMode | null = null;

  constructor(orchestrator?: EngineOrchestrator) {
    this.orchestrator = orchestrator ?? new EngineOrchestrator();

    bindZeroRuntime({
      orchestrator: this.orchestrator,
      wireStoreHandlers: true,
      wireRunMirror: true,
      registerDefaultChannels: true,
    });
  }

  public bind(options: Omit<ZeroBindingOptions, 'orchestrator'> = {}): ZeroRuntimeBindings {
    return bindZeroRuntime({
      ...options,
      orchestrator: this.orchestrator,
    });
  }

  public getOrchestrator(): EngineOrchestrator {
    return this.orchestrator;
  }

  public getEventBus(): EventBus {
    return getZeroEventBus();
  }

  public getBindings(): ZeroRuntimeBindings {
    return getZeroRuntimeBindings();
  }

  public async startRun(
    params: StartRunParams,
    options: ZeroStartRunOptions = {},
  ): Promise<void> {
    if (options.mode) {
      this.currentMode = options.mode;
    }

    this.bind({
      ...options,
      mode: options.mode,
      modeSeed: options.modeSeed ?? params.seed,
      modeOverrides: options.modeOverrides,
      wireStoreHandlers: options.wireStoreHandlers ?? true,
      wireRunMirror: options.wireRunMirror ?? true,
      registerDefaultChannels: options.registerDefaultChannels ?? true,
    });

    await Promise.resolve((this.orchestrator as any).startRun(params));
  }

  public async executeTick(): Promise<TickResult | null> {
    const result = await Promise.resolve(
      (this.orchestrator as any).executeTick?.(),
    );

    this.lastTickResult = (result ?? null) as TickResult | null;
    return this.lastTickResult;
  }

  public async executeTicks(count: number): Promise<TickResult[]> {
    const results: TickResult[] = [];
    const safeCount = Math.max(0, Math.trunc(count));

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

    return results;
  }

  public async endRun(outcome: RunOutcome): Promise<void> {
    await Promise.resolve((this.orchestrator as any).endRun?.(outcome));
  }

  public reset(options: { rebindAfterReset?: boolean } = {}): void {
    (this.orchestrator as any).reset?.();
    this.lastTickResult = null;

    markZeroEventBusWiringDirty();

    if (options.rebindAfterReset !== false) {
      this.bind({
        wireStoreHandlers: true,
        wireRunMirror: true,
        registerDefaultChannels: true,
      });
    }
  }

  public subscribe<T extends EngineEventName>(
    eventType: T,
    handler: (event: EngineEvent<T>) => void,
  ): () => void {
    return this.getEventBus().on(eventType as any, handler as any);
  }

  public once<T extends EngineEventName>(
    eventType: T,
    handler: (event: EngineEvent<T>) => void,
  ): void {
    this.getEventBus().once(eventType as any, handler as any);
  }

  public getLifecycleState(): RunLifecycleState | 'UNKNOWN' {
    return buildZeroRuntimeStatusSnapshot(this.orchestrator).lifecycleState;
  }

  public isRunActive(): boolean {
    const state = this.getLifecycleState();
    return state === 'ACTIVE' || state === 'TICK_LOCKED' || state === 'STARTING';
  }

  public getHealthReport():
    | Partial<Record<EngineId, EngineHealth>>
    | null {
    return buildZeroRuntimeStatusSnapshot(this.orchestrator).healthReport;
  }

  public getRuntimeStatus(): ZeroRuntimeStatusSnapshot {
    return buildZeroRuntimeStatusSnapshot(this.orchestrator);
  }

  public getRunStoreSnapshot(): ReturnType<typeof runStore.getState> {
    return runStore.getState();
  }

  public getEngineStoreSnapshot(): unknown {
    const api = this.getBindings().getEngineStoreApi();
    return api?.getState ? api.getState() : null;
  }

  public getLastTickResult(): TickResult | null {
    return this.lastTickResult;
  }

  public getCurrentMode(): FrontendRunMode | null {
    return this.getBindings().mode?.runMode ?? this.currentMode;
  }

  public getModeCatalog() {
    return frontendModeDirector.getCatalog();
  }

  public getModeMetadata(mode: FrontendRunMode) {
    return frontendModeDirector.getModeMetadata(mode);
  }

  public createModeEngineConfig(
    mode: FrontendRunMode,
    seed: string | number,
    overrides: Record<string, unknown> = {},
  ) {
    return frontendModeDirector.createEngineConfig(mode, seed, overrides);
  }

  public getModeDirector() {
    return frontendModeDirector;
  }
}

export const zeroFacade = new ZeroFacade();

export default zeroFacade;