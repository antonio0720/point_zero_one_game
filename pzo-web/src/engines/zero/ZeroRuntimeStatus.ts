/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO RUNTIME STATUS
 * pzo-web/src/engines/zero/ZeroRuntimeStatus.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 * - Build a deep, read-only runtime status object for HUD panels, diagnostics,
 *   devtools, health overlays, and operator control surfaces.
 * - Project repo-native engineStore + runStore state into a zero-owned status
 *   snapshot without mutating gameplay state.
 * - Surface mode metadata/config and an optional mode-native projection using
 *   FrontendModeDirector without creating a new mode authority.
 *
 * Doctrine
 * - This file is read-only.
 * - No direct engine mutations.
 * - No store mutations.
 * - No direct step execution.
 * - It observes the law; it does not become the law.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { EventBus, sharedEventBus } from '../core/EventBus';
import type { OrchestratorDiagnosticsSnapshot } from '../core/OrchestratorDiagnostics';
import { useEngineStore, type EngineStoreState } from '../../store/engineStore';
import {
  runStore,
  selectEngineStoreMirrorSnapshot,
  type EngineStoreMirrorSnapshot,
  type RunStoreSlice,
} from '../../store/runStore';
import {
  frontendModeDirector,
  type EngineSnapshotLike,
  type FrontendModeState,
  type FrontendRunMode,
} from '../../game/modes';
import { EngineOrchestrator } from './EngineOrchestrator';
import type {
  EngineHealth,
  EngineId,
  RunLifecycleState,
  TickTier,
} from './types';

export type ZeroRuntimeSeverity =
  | 'NOMINAL'
  | 'ELEVATED'
  | 'CRITICAL'
  | 'TERMINAL';

export type ZeroRuntimeWarningCode =
  | 'PAUSED'
  | 'LIFECYCLE_UNKNOWN'
  | 'ENGINE_ERRORS_PRESENT'
  | 'PRESSURE_CRITICAL'
  | 'TENSION_PULSE_ACTIVE'
  | 'SEASON_TIMEOUT_IMMINENT'
  | 'SHIELD_BREACH_CASCADE'
  | 'EVENT_QUEUE_BACKLOG'
  | 'EVENTBUS_FLUSHING'
  | 'RUN_ENDED';

export interface ZeroRuntimeWarning {
  readonly code: ZeroRuntimeWarningCode;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ZeroPauseSnapshot {
  readonly isPaused: boolean;
  readonly reason: string | null;
  readonly pausedAt: number | null;
}

export interface ZeroRuntimeHealthSummary {
  readonly totalTracked: number;
  readonly initialized: number;
  readonly registered: number;
  readonly disabled: number;
  readonly error: number;
  readonly unregistered: number;
}

export interface ZeroRuntimeEventBusStatus {
  readonly pendingCount: number;
  readonly isFlushing: boolean;
  readonly registeredChannels: string[];
}

export interface ZeroRuntimeModeStatus {
  readonly runMode: FrontendRunMode;
  readonly metadata: ReturnType<typeof frontendModeDirector.getModeMetadata>;
  readonly engineConfig: Record<string, unknown>;
  readonly projectionInput: EngineSnapshotLike;
  readonly projectionState: FrontendModeState;
}

export interface ZeroRuntimeStatusSnapshot {
  readonly generatedAt: number;
  readonly lifecycleState: RunLifecycleState | 'UNKNOWN';
  readonly isRunActive: boolean;
  readonly isPaused: boolean;
  readonly pauseReason: string | null;
  readonly severity: ZeroRuntimeSeverity;
  readonly warnings: ZeroRuntimeWarning[];

  readonly healthReport: Partial<Record<EngineId, EngineHealth>> | null;
  readonly healthSummary: ZeroRuntimeHealthSummary;
  readonly eventBus: ZeroRuntimeEventBusStatus;

  readonly run: EngineStoreState['run'];
  readonly time: EngineStoreState['time'];
  readonly pressure: EngineStoreState['pressure'];
  readonly tension: EngineStoreState['tension'];
  readonly shield: EngineStoreState['shield'];
  readonly battle: EngineStoreState['battle'];
  readonly cascade: EngineStoreState['cascade'];
  readonly sovereignty: EngineStoreState['sovereignty'];
  readonly runtime: EngineStoreState['runtime'];
  readonly card: EngineStoreState['card'];
  readonly mechanics: EngineStoreState['mechanics'];

  readonly runStore: RunStoreSlice;
  readonly runMirror: EngineStoreMirrorSnapshot;
  readonly mode: ZeroRuntimeModeStatus | null;
  readonly diagnostics: OrchestratorDiagnosticsSnapshot | null;
}

export interface ZeroRuntimeStatusOptions {
  orchestrator?: EngineOrchestrator | null;
  eventBus?: EventBus;
  mode?: FrontendRunMode | null;
  freedomThreshold?: number;
  modeOverrides?: Record<string, unknown>;
  getPauseState?: () => ZeroPauseSnapshot | null;
  getMode?: () => FrontendRunMode | null;
  getFreedomThreshold?: () => number;
  getModeOverrides?: () => Record<string, unknown>;
  getDiagnosticsSnapshot?: () => OrchestratorDiagnosticsSnapshot | null;
}

function safeGetLifecycleState(
  orchestrator: EngineOrchestrator | null | undefined,
): RunLifecycleState | 'UNKNOWN' {
  if (!orchestrator) {
    return 'UNKNOWN';
  }

  try {
    return orchestrator.getLifecycleState();
  } catch {
    return 'UNKNOWN';
  }
}

function safeGetHealthReport(
  orchestrator: EngineOrchestrator | null | undefined,
): Partial<Record<EngineId, EngineHealth>> | null {
  if (!orchestrator) {
    return null;
  }

  try {
    return orchestrator.getHealthReport();
  } catch {
    return null;
  }
}

function safeGetPendingCount(eventBus: EventBus): number {
  const maybe = (eventBus as EventBus & { getPendingCount?: () => number }).getPendingCount;
  return typeof maybe === 'function' ? Number(maybe.call(eventBus) ?? 0) : 0;
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

function buildHealthSummary(
  healthReport: Partial<Record<EngineId, EngineHealth>> | null,
): ZeroRuntimeHealthSummary {
  const values = Object.values(healthReport ?? {});

  return {
    totalTracked: values.length,
    initialized: values.filter((value) => value === 'INITIALIZED').length,
    registered: values.filter((value) => value === 'REGISTERED').length,
    disabled: values.filter((value) => value === 'DISABLED').length,
    error: values.filter((value) => value === 'ERROR').length,
    unregistered: values.filter((value) => value === 'UNREGISTERED').length,
  };
}

function extractShieldValue(
  snapshot: EngineStoreState['shield']['snapshot'],
  names: string[],
  fallback: number,
): number {
  const layers = Array.isArray((snapshot as any)?.layers)
    ? ((snapshot as any).layers as Array<Record<string, unknown>>)
    : [];

  for (const layer of layers) {
    const id = String(layer.id ?? '');
    if (names.some((name) => id.includes(name))) {
      return Number(layer.currentIntegrity ?? fallback);
    }
  }

  return fallback;
}

function buildModeProjectionInput(
  engineState: EngineStoreState,
  runMirror: EngineStoreMirrorSnapshot,
  freedomThreshold: number,
): EngineSnapshotLike {
  const tickTier = (engineState.time.currentTier ?? 'T1') as unknown as EngineSnapshotLike['pressureTier'];
  const tick = engineState.time.ticksElapsed ?? engineState.run.lastTickIndex ?? 0;
  const tickDuration = engineState.time.currentTickDurationMs ?? 0;
  const totalRunMs = tick * tickDuration;

  return {
    runId: runMirror.runId ?? engineState.run.runId ?? 'UNBOUND_RUN',
    seed: runMirror.seed ?? engineState.run.seed ?? 'UNBOUND_SEED',
    tick,
    elapsedMs: engineState.time.lastTickTimestamp ?? totalRunMs,
    totalRunMs,
    cash: runMirror.cashBalance,
    netWorth: runMirror.netWorth,
    incomePerTick: runMirror.monthlyIncome,
    expensePerTick: runMirror.monthlyExpenses,
    freedomThreshold,
    pressureTier: tickTier,
    pressureValue: engineState.pressure.score,
    shields: {
      L1: extractShieldValue(engineState.shield.snapshot, ['LIQUIDITY_BUFFER'], 0),
      L2: extractShieldValue(engineState.shield.snapshot, ['CREDIT_LINE'], 0),
      L3: extractShieldValue(engineState.shield.snapshot, ['ASSET_FLOOR'], 0),
      L4: extractShieldValue(engineState.shield.snapshot, ['NETWORK_CORE'], 0),
    },
    blockedSabotages: engineState.shield.lastDamageResult ? 1 : 0,
    cascadeChainsBroken: engineState.cascade.totalLinksDefeated,
    battleBudget:
      Number(
        (engineState.battle.budget as any)?.remaining ??
          (engineState.battle.budget as any)?.remainingBudget ??
          0,
      ) || undefined,
  };
}

function buildWarnings(
  lifecycleState: RunLifecycleState | 'UNKNOWN',
  pause: ZeroPauseSnapshot,
  engineState: EngineStoreState,
  healthSummary: ZeroRuntimeHealthSummary,
  eventBusStatus: ZeroRuntimeEventBusStatus,
): ZeroRuntimeWarning[] {
  const warnings: ZeroRuntimeWarning[] = [];

  if (pause.isPaused) {
    warnings.push({
      code: 'PAUSED',
      severity: 'info',
      message: pause.reason ? `Runtime is paused: ${pause.reason}` : 'Runtime is paused',
      metadata: { pausedAt: pause.pausedAt },
    });
  }

  if (lifecycleState === 'UNKNOWN') {
    warnings.push({
      code: 'LIFECYCLE_UNKNOWN',
      severity: 'warn',
      message: 'Orchestrator lifecycle state is unavailable',
    });
  }

  if (healthSummary.error > 0) {
    warnings.push({
      code: 'ENGINE_ERRORS_PRESENT',
      severity: 'error',
      message: `${healthSummary.error} engine(s) are currently in ERROR state`,
      metadata: { errorCount: healthSummary.error },
    });
  }

  if (engineState.pressure.isCritical) {
    warnings.push({
      code: 'PRESSURE_CRITICAL',
      severity: 'error',
      message: 'Pressure lane is in critical state',
      metadata: {
        score: engineState.pressure.score,
        tier: engineState.pressure.tier,
        triggerSignals: engineState.pressure.triggerSignals,
      },
    });
  }

  if (engineState.tension.isPulseActive) {
    warnings.push({
      code: 'TENSION_PULSE_ACTIVE',
      severity: 'warn',
      message: 'Tension pulse is active',
      metadata: {
        score: engineState.tension.score,
        pulseTicksActive: engineState.tension.pulseTicksActive,
        queueLength: engineState.tension.queueLength,
      },
    });
  }

  if (engineState.time.seasonTimeoutImminent) {
    warnings.push({
      code: 'SEASON_TIMEOUT_IMMINENT',
      severity: 'warn',
      message: 'Season timeout warning is active',
      metadata: {
        ticksRemaining: engineState.time.ticksRemaining,
        ticksUntilTimeout: engineState.time.ticksUntilTimeout,
      },
    });
  }

  if (engineState.shield.isInBreachCascade) {
    warnings.push({
      code: 'SHIELD_BREACH_CASCADE',
      severity: 'error',
      message: 'Shield breach cascade is active',
      metadata: {
        cascadeCount: engineState.shield.cascadeCount,
        weakestLayerId: engineState.shield.weakestLayerId,
      },
    });
  }

  if (eventBusStatus.pendingCount > 32) {
    warnings.push({
      code: 'EVENT_QUEUE_BACKLOG',
      severity: 'warn',
      message: 'EventBus pending queue is elevated',
      metadata: { pendingCount: eventBusStatus.pendingCount },
    });
  }

  if (eventBusStatus.isFlushing) {
    warnings.push({
      code: 'EVENTBUS_FLUSHING',
      severity: 'info',
      message: 'EventBus is currently flushing',
    });
  }

  if (lifecycleState === 'ENDED') {
    warnings.push({
      code: 'RUN_ENDED',
      severity: 'info',
      message: 'Run has ended',
      metadata: { outcome: engineState.run.outcome },
    });
  }

  return warnings;
}

function deriveSeverity(
  lifecycleState: RunLifecycleState | 'UNKNOWN',
  warnings: ZeroRuntimeWarning[],
): ZeroRuntimeSeverity {
  if (lifecycleState === 'ENDED' || lifecycleState === 'ENDING') {
    return 'TERMINAL';
  }

  if (warnings.some((warning) => warning.severity === 'error')) {
    return 'CRITICAL';
  }

  if (warnings.some((warning) => warning.severity === 'warn')) {
    return 'ELEVATED';
  }

  return 'NOMINAL';
}

export class ZeroRuntimeStatus {
  private readonly orchestrator: EngineOrchestrator | null;
  private readonly eventBus: EventBus;
  private readonly getPauseStateFn: (() => ZeroPauseSnapshot | null) | null;
  private readonly getModeFn: (() => FrontendRunMode | null) | null;
  private readonly getFreedomThresholdFn: (() => number) | null;
  private readonly getModeOverridesFn: (() => Record<string, unknown>) | null;
  private readonly getDiagnosticsSnapshotFn:
    | (() => OrchestratorDiagnosticsSnapshot | null)
    | null;

  private fallbackMode: FrontendRunMode | null;
  private fallbackFreedomThreshold: number;
  private fallbackModeOverrides: Record<string, unknown>;

  constructor(options: ZeroRuntimeStatusOptions = {}) {
    this.orchestrator = options.orchestrator ?? null;
    this.eventBus = options.eventBus ?? sharedEventBus;
    this.getPauseStateFn = options.getPauseState ?? null;
    this.getModeFn = options.getMode ?? null;
    this.getFreedomThresholdFn = options.getFreedomThreshold ?? null;
    this.getModeOverridesFn = options.getModeOverrides ?? null;
    this.getDiagnosticsSnapshotFn = options.getDiagnosticsSnapshot ?? null;

    this.fallbackMode = options.mode ?? null;
    this.fallbackFreedomThreshold = options.freedomThreshold ?? 0;
    this.fallbackModeOverrides = { ...(options.modeOverrides ?? {}) };
  }

  public setMode(
    mode: FrontendRunMode | null,
    overrides: Record<string, unknown> = {},
  ): void {
    this.fallbackMode = mode;
    this.fallbackModeOverrides = { ...overrides };
  }

  public setFreedomThreshold(value: number): void {
    this.fallbackFreedomThreshold = value;
  }

  public getSnapshot(): ZeroRuntimeStatusSnapshot {
    const engineState = useEngineStore.getState();
    const runState = runStore.getState();
    const runMirror = selectEngineStoreMirrorSnapshot(runState);

    const lifecycleState = safeGetLifecycleState(this.orchestrator);
    const healthReport = safeGetHealthReport(this.orchestrator);
    const healthSummary = buildHealthSummary(healthReport);

    const pause = this.getPauseStateFn?.() ?? {
      isPaused: false,
      reason: null,
      pausedAt: null,
    };

    const eventBusStatus: ZeroRuntimeEventBusStatus = {
      pendingCount: safeGetPendingCount(this.eventBus),
      isFlushing: Boolean(
        (this.eventBus as EventBus & { isCurrentlyFlushing?: boolean }).isCurrentlyFlushing,
      ),
      registeredChannels: safeGetRegisteredChannels(this.eventBus),
    };

    const warnings = buildWarnings(
      lifecycleState,
      pause,
      engineState,
      healthSummary,
      eventBusStatus,
    );

    const mode =
      this.getModeFn?.() ??
      this.fallbackMode;

    const freedomThreshold =
      this.getFreedomThresholdFn?.() ??
      this.fallbackFreedomThreshold;

    const modeOverrides =
      this.getModeOverridesFn?.() ??
      this.fallbackModeOverrides;

    let modeStatus: ZeroRuntimeModeStatus | null = null;

    if (mode) {
      const projectionInput = buildModeProjectionInput(
        engineState,
        runMirror,
        freedomThreshold,
      );

      const metadata = frontendModeDirector.getModeMetadata(mode);
      const engineConfig = frontendModeDirector.createEngineConfig(
        mode,
        projectionInput.seed,
        modeOverrides,
      ) as Record<string, unknown>;
      const projectionState = frontendModeDirector.createInitialState(
        mode,
        projectionInput,
        [],
      );

      modeStatus = {
        runMode: mode,
        metadata,
        engineConfig,
        projectionInput,
        projectionState,
      };
    }

    return {
      generatedAt: Date.now(),
      lifecycleState,
      isRunActive:
        lifecycleState === 'ACTIVE' ||
        lifecycleState === 'STARTING' ||
        lifecycleState === 'TICK_LOCKED',
      isPaused: pause.isPaused,
      pauseReason: pause.reason,
      severity: deriveSeverity(lifecycleState, warnings),
      warnings,

      healthReport,
      healthSummary,
      eventBus: eventBusStatus,

      run: engineState.run,
      time: engineState.time,
      pressure: engineState.pressure,
      tension: engineState.tension,
      shield: engineState.shield,
      battle: engineState.battle,
      cascade: engineState.cascade,
      sovereignty: engineState.sovereignty,
      runtime: engineState.runtime,
      card: engineState.card,
      mechanics: engineState.mechanics,

      runStore: runState,
      runMirror,
      mode: modeStatus,
      diagnostics: this.getDiagnosticsSnapshotFn?.() ?? null,
    };
  }
}

export const zeroRuntimeStatus = new ZeroRuntimeStatus();

export function buildZeroRuntimeStatusSnapshot(
  options: ZeroRuntimeStatusOptions = {},
): ZeroRuntimeStatusSnapshot {
  return new ZeroRuntimeStatus(options).getSnapshot();
}

export default zeroRuntimeStatus;