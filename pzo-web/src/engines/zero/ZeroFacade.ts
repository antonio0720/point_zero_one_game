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

export interface ZeroStartRunRequest
  extends Partial<StartRunParams>,
    ZeroStartRunOptions {}

interface NormalizedZeroStartRunRequest {
  readonly params: StartRunParams;
  readonly options: ZeroStartRunOptions;
}

const DEFAULT_SEASON_TICK_BUDGET = 60;
const DEFAULT_FREEDOM_THRESHOLD = 1_000_000;
const DEFAULT_CLIENT_VERSION = 'pzo-web';
const DEFAULT_ENGINE_VERSION = 'engine-zero';
const DEFAULT_USER_ID = 'anonymous-user';
const DEFAULT_OUTCOME: RunOutcome = 'ABANDONED';

function coerceNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function coercePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function coerceNonNegativeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value >= 0 ? value : fallback;
}

function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createSeed(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStartRunParamsLike(value: unknown): value is StartRunParams {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.runId === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.seed === 'string' &&
    typeof value.seasonTickBudget === 'number' &&
    typeof value.freedomThreshold === 'number' &&
    typeof value.clientVersion === 'string' &&
    typeof value.engineVersion === 'string'
  );
}

function normalizeStartRunRequest(
  requestOrParams: StartRunParams | ZeroStartRunRequest,
  options: ZeroStartRunOptions = {},
): NormalizedZeroStartRunRequest {
  const rawRequest = isStartRunParamsLike(requestOrParams)
    ? { ...requestOrParams, ...options }
    : { ...requestOrParams, ...options };

  const params: StartRunParams = {
    runId: coerceNonEmptyString(rawRequest.runId, createRunId()),
    userId: coerceNonEmptyString(rawRequest.userId, DEFAULT_USER_ID),
    seed: coerceNonEmptyString(rawRequest.seed, createSeed()),
    seasonTickBudget: coercePositiveInt(
      rawRequest.seasonTickBudget,
      DEFAULT_SEASON_TICK_BUDGET,
    ),
    freedomThreshold: coerceNonNegativeNumber(
      rawRequest.freedomThreshold,
      DEFAULT_FREEDOM_THRESHOLD,
    ),
    clientVersion: coerceNonEmptyString(
      rawRequest.clientVersion,
      DEFAULT_CLIENT_VERSION,
    ),
    engineVersion: coerceNonEmptyString(
      rawRequest.engineVersion,
      DEFAULT_ENGINE_VERSION,
    ),
  };

  return {
    params,
    options: {
      mode: rawRequest.mode,
      modeSeed: rawRequest.modeSeed,
      modeOverrides: rawRequest.modeOverrides,
      wireStoreHandlers: rawRequest.wireStoreHandlers,
      wireRunMirror: rawRequest.wireRunMirror,
      registerDefaultChannels: rawRequest.registerDefaultChannels,
    },
  };
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
    requestOrParams: StartRunParams | ZeroStartRunRequest,
    options: ZeroStartRunOptions = {},
  ): Promise<void> {
    const normalized = normalizeStartRunRequest(requestOrParams, options);
    const { params, options: startOptions } = normalized;

    this.lastTickResult = null;

    if (startOptions.mode !== undefined) {
      this.currentMode = startOptions.mode;
    }

    this.bind({
      ...startOptions,
      mode: startOptions.mode,
      modeSeed: startOptions.modeSeed ?? params.seed,
      modeOverrides: startOptions.modeOverrides,
      wireStoreHandlers: startOptions.wireStoreHandlers ?? true,
      wireRunMirror: startOptions.wireRunMirror ?? true,
      registerDefaultChannels: startOptions.registerDefaultChannels ?? true,
    });

    await Promise.resolve(this.orchestrator.startRun(params));
  }

  public async executeTick(): Promise<TickResult | null> {
    const result = await Promise.resolve(this.orchestrator.executeTick?.());

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

  private resolveEndRunOutcome(outcome?: RunOutcome | null): RunOutcome {
    if (outcome) {
      return outcome;
    }

    if (this.lastTickResult?.runOutcome) {
      return this.lastTickResult.runOutcome;
    }

    const runtimeOutcome = (this.getRunStoreSnapshot() as Record<string, unknown>)?.outcome;
    return runtimeOutcome === 'FREEDOM' ||
      runtimeOutcome === 'BANKRUPT' ||
      runtimeOutcome === 'TIMEOUT' ||
      runtimeOutcome === 'ABANDONED'
      ? runtimeOutcome
      : DEFAULT_OUTCOME;
  }

  public async endRun(outcome?: RunOutcome | null): Promise<void> {
    await Promise.resolve(this.orchestrator.endRun?.(this.resolveEndRunOutcome(outcome)));
  }

  public reset(options: { rebindAfterReset?: boolean; preserveMode?: boolean } = {}): void {
    this.orchestrator.reset?.();
    this.lastTickResult = null;

    if (options.preserveMode !== true) {
      this.currentMode = null;
    }

    markZeroEventBusWiringDirty();

    if (options.rebindAfterReset !== false) {
      this.bind({
        mode: options.preserveMode ? this.currentMode ?? undefined : undefined,
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

  public getCurrentRunId(): string | null {
    return this.orchestrator.getCurrentRunId?.() ?? null;
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
