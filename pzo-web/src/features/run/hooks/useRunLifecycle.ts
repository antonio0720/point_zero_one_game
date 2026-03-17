// pzo-web/src/features/run/hooks/useRunLifecycle.ts

/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/hooks/useRunLifecycle.ts
 * ============================================================================
 *
 * POINT ZERO ONE — ENGINE 0 RUN LIFECYCLE HOOK
 *
 * Purpose:
 * - expose Engine 0 lifecycle state to React through existing Zustand surfaces
 * - provide a production-safe action façade for start / tick / abandon / reset
 * - remain compatible with the current repo shape where:
 *   1) engineStore.run is the UI-facing lifecycle source of truth
 *   2) runStore mirrors orchestrator-consumed financial/runtime fields
 *   3) EngineOrchestrator is a class export, not guaranteed to be pre-singletonized
 *
 * Doctrine:
 * - never mutate engineStore slices directly outside published store actions
 * - never require React components to import EngineOrchestrator themselves
 * - permit external controller injection for future tick-scheduler / pause-resume lanes
 * - default to a single global EngineOrchestrator instance when no controller is supplied
 * ============================================================================
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import {
  readEngineStoreMirrorSnapshot,
  selectEngineStoreMirrorSnapshot,
  useRunStore,
} from '../../../store/runStore';
import type { FrontendRunMode } from '../../../game/modes/contracts';
import { zeroFacade, ZeroFacade, type ZeroStartRunOptions } from '../../../engines/zero/ZeroFacade';
import { EngineOrchestrator, type StartRunParams } from '../../../engines/zero/EngineOrchestrator';
import type {
  EngineHealth,
  EngineId,
  RunLifecycleState,
  RunOutcome,
  TickResult,
} from '../../../engines/zero/types';

type MaybePromise<T> = T | Promise<T>;

export interface RunLifecycleController {
  startRun(
    params: StartRunParams,
    options?: Partial<ZeroStartRunOptions>,
  ): MaybePromise<void>;
  executeTick(): MaybePromise<TickResult | null>;
  reset(options?: { resetEngineStoreSlices?: boolean }): MaybePromise<void>;
  endRun?(outcome: RunOutcome): MaybePromise<void>;
  abandonRun?(reason?: string): MaybePromise<void>;
  pause?(reason?: string): MaybePromise<void>;
  resume?(): MaybePromise<void>;
  getLifecycleState?(): RunLifecycleState | 'UNKNOWN';
  isRunActive?(): boolean;
  isPaused?(): boolean;
  getHealthReport?(): Partial<Record<EngineId, EngineHealth>> | null;
  getCurrentMode?(): FrontendRunMode | null;
}

export interface UseRunLifecycleStartRequest extends Partial<StartRunParams> {
  userId: string;
  resetRunStore?: boolean;
  mode?: FrontendRunMode;
  modeSeed?: string | number;
  modeOverrides?: Record<string, unknown>;
  wireStoreHandlers?: boolean;
  wireRunMirror?: boolean;
  registerDefaultChannels?: boolean;
  startOptions?: Partial<ZeroStartRunOptions>;
}

export interface UseRunLifecycleResult {
  lifecycleState: RunLifecycleState | 'UNKNOWN';
  runId: string | null;
  userId: string | null;
  seed: string | null;
  tickBudget: number;
  outcome: RunOutcome | null;
  lastTickIndex: number;
  lastTickDurationMs: number;
  ticksRemaining: number;
  holdsRemaining: number;
  activeDecisionWindowCount: number;
  seasonTimeoutImminent: boolean;
  ticksUntilTimeout: number;
  currentMode: FrontendRunMode | null;
  isInitialized: boolean;
  isRunActive: boolean;
  isPaused: boolean;
  isIdle: boolean;
  isStarting: boolean;
  isActive: boolean;
  isTickLocked: boolean;
  isEnding: boolean;
  isEnded: boolean;
  supportsPause: boolean;
  supportsResume: boolean;
  canStart: boolean;
  canExecuteTick: boolean;
  canAbandon: boolean;
  canReset: boolean;
  canPause: boolean;
  canResume: boolean;
  isCommandPending: boolean;
  pendingCommand:
    | 'IDLE'
    | 'STARTING'
    | 'TICKING'
    | 'ABANDONING'
    | 'RESETTING'
    | 'PAUSING'
    | 'RESUMING';
  lastCommandError: Error | null;
  healthReport: Partial<Record<EngineId, EngineHealth>> | null;
  degradedEngineIds: EngineId[];
  healthyEngineCount: number;
  erroredEngineCount: number;
  mirror: ReturnType<typeof selectEngineStoreMirrorSnapshot>;
  startRun: (request: UseRunLifecycleStartRequest) => Promise<void>;
  executeTick: () => Promise<TickResult | null>;
  abandonRun: () => Promise<void>;
  resetRun: () => Promise<void>;
  pauseRun: (reason?: string) => Promise<void>;
  resumeRun: () => Promise<void>;
  clearLastCommandError: () => void;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

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

function isZeroFacade(value: unknown): value is ZeroFacade {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ZeroFacade).startRun === 'function' &&
      typeof (value as ZeroFacade).executeTick === 'function' &&
      typeof (value as ZeroFacade).reset === 'function',
  );
}

function createControllerFromFacade(facade: ZeroFacade): RunLifecycleController {
  return {
    startRun(params, options) {
      return facade.startRun(params, options);
    },
    executeTick() {
      return facade.executeTick();
    },
    reset() {
      facade.reset();
    },
    endRun(outcome) {
      return facade.endRun(outcome);
    },
    getLifecycleState() {
      return facade.getLifecycleState();
    },
    isRunActive() {
      return facade.isRunActive();
    },
    getHealthReport() {
      return facade.getHealthReport();
    },
    getCurrentMode() {
      return facade.getCurrentMode();
    },
  };
}

function getGlobalEngineZeroScope(): typeof globalThis & {
  __PZO_ENGINE_ZERO_ORCHESTRATOR__?: EngineOrchestrator;
} {
  return globalThis as typeof globalThis & {
    __PZO_ENGINE_ZERO_ORCHESTRATOR__?: EngineOrchestrator;
  };
}

function getSharedEngineZeroOrchestrator(): EngineOrchestrator {
  const scope = getGlobalEngineZeroScope();

  if (!scope.__PZO_ENGINE_ZERO_ORCHESTRATOR__) {
    scope.__PZO_ENGINE_ZERO_ORCHESTRATOR__ = new EngineOrchestrator();
  }

  return scope.__PZO_ENGINE_ZERO_ORCHESTRATOR__;
}

function createDefaultLifecycleController(): RunLifecycleController {
  const facade = isZeroFacade(zeroFacade)
    ? zeroFacade
    : new ZeroFacade(getSharedEngineZeroOrchestrator());

  return createControllerFromFacade(facade);
}

function normalizeStartRequest(request: UseRunLifecycleStartRequest): {
  params: StartRunParams;
  startOptions: Partial<ZeroStartRunOptions>;
} {
  return {
    params: {
      runId: coerceNonEmptyString(request.runId, createRunId()),
      userId: coerceNonEmptyString(request.userId, 'anonymous-user'),
      seed: coerceNonEmptyString(request.seed, createSeed()),
      seasonTickBudget: coercePositiveInt(request.seasonTickBudget, 60),
      freedomThreshold: coerceNonNegativeNumber(request.freedomThreshold, 1_000_000),
      clientVersion: coerceNonEmptyString(request.clientVersion, 'pzo-web'),
      engineVersion: coerceNonEmptyString(request.engineVersion, 'engine-zero'),
    },
    startOptions: {
      ...(request.startOptions ?? {}),
      mode: request.mode ?? request.startOptions?.mode,
      modeSeed: request.modeSeed ?? request.startOptions?.modeSeed,
      modeOverrides: request.modeOverrides ?? request.startOptions?.modeOverrides,
      wireStoreHandlers:
        request.wireStoreHandlers ?? request.startOptions?.wireStoreHandlers,
      wireRunMirror: request.wireRunMirror ?? request.startOptions?.wireRunMirror,
      registerDefaultChannels:
        request.registerDefaultChannels ??
        request.startOptions?.registerDefaultChannels,
    },
  };
}

export function useRunLifecycle(
  controllerOrFacade?: RunLifecycleController | ZeroFacade,
): UseRunLifecycleResult {
  const resolvedController = useMemo<RunLifecycleController>(() => {
    if (isZeroFacade(controllerOrFacade)) {
      return createControllerFromFacade(controllerOrFacade);
    }

    return controllerOrFacade ?? createDefaultLifecycleController();
  }, [controllerOrFacade]);

  const run = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      lifecycleState: state.run.lifecycleState,
      runId: state.run.runId,
      userId: state.run.userId,
      seed: state.run.seed,
      tickBudget: state.run.tickBudget,
      outcome: state.run.outcome,
      lastTickIndex: state.run.lastTickIndex,
      lastTickDurationMs: state.run.lastTickDurationMs,
      healthReport: state.run.healthReport,
    })),
  );

  const time = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      ticksRemaining: state.time.ticksRemaining,
      holdsRemaining: state.time.holdsRemaining,
      activeDecisionWindowCount: state.time.activeDecisionWindows.length,
      seasonTimeoutImminent: state.time.seasonTimeoutImminent,
      ticksUntilTimeout: state.time.ticksUntilTimeout,
      isRunActive: state.time.isRunActive,
    })),
  );

  const resetAllSlices = useEngineStore((state: EngineStoreState) => state.resetAllSlices);
  const syncRunMirror = useEngineStore((state: EngineStoreState) => state.syncRunMirror);

  const isInitialized = useRunStore((state) => state.isInitialized);
  const initializeRunStore = useRunStore((state) => state.initialize);
  const resetRunStore = useRunStore((state) => state.reset);
  const mirror = useRunStore(selectEngineStoreMirrorSnapshot);

  const [pendingCommand, setPendingCommand] = useState<UseRunLifecycleResult['pendingCommand']>('IDLE');
  const [lastCommandError, setLastCommandError] = useState<Error | null>(null);

  const refreshMirror = useCallback(() => {
    syncRunMirror(readEngineStoreMirrorSnapshot());
  }, [syncRunMirror]);

  const healthReport = useMemo(() => {
    if (run.healthReport && Object.keys(run.healthReport).length > 0) {
      return run.healthReport;
    }

    const fallback = resolvedController.getHealthReport?.() ?? null;
    return fallback && Object.keys(fallback).length > 0 ? fallback : null;
  }, [resolvedController, run.healthReport]);

  const degradedEngineIds = useMemo(() => {
    if (!healthReport) return [];

    return (Object.entries(healthReport) as Array<[EngineId, EngineHealth | undefined]>)
      .filter(([, health]) => health === 'ERROR')
      .map(([engineId]) => engineId);
  }, [healthReport]);

  const healthyEngineCount = useMemo(() => {
    if (!healthReport) return 0;

    return Object.values(healthReport).filter((health) => health === 'INITIALIZED').length;
  }, [healthReport]);

  const erroredEngineCount = degradedEngineIds.length;

  const lifecycleState =
    run.lifecycleState ?? resolvedController.getLifecycleState?.() ?? 'IDLE';
  const isPaused = resolvedController.isPaused?.() === true;
  const currentMode = resolvedController.getCurrentMode?.() ?? null;

  const isIdle = lifecycleState === 'IDLE';
  const isStarting = lifecycleState === 'STARTING';
  const isActive = lifecycleState === 'ACTIVE';
  const isTickLocked = lifecycleState === 'TICK_LOCKED';
  const isEnding = lifecycleState === 'ENDING';
  const isEnded = lifecycleState === 'ENDED';

  const isRunActive =
    isActive ||
    isStarting ||
    isTickLocked ||
    Boolean(time.isRunActive) ||
    resolvedController.isRunActive?.() === true;

  const supportsPause = typeof resolvedController.pause === 'function';
  const supportsResume = typeof resolvedController.resume === 'function';

  const canStart = isIdle && pendingCommand === 'IDLE';
  const canExecuteTick = isActive && !isPaused && pendingCommand === 'IDLE';
  const canAbandon = isRunActive && pendingCommand === 'IDLE';
  const canReset = (isIdle || isEnded || isEnding) && pendingCommand === 'IDLE';
  const canPause = supportsPause && isRunActive && !isPaused && pendingCommand === 'IDLE';
  const canResume = supportsResume && isPaused && pendingCommand === 'IDLE';

  const runCommand = useCallback(
    async <T,>(
      commandName: UseRunLifecycleResult['pendingCommand'],
      work: () => Promise<T>,
    ): Promise<T> => {
      setPendingCommand(commandName);
      setLastCommandError(null);

      try {
        return await work();
      } catch (error) {
        const normalized = toError(error);
        setLastCommandError(normalized);
        throw normalized;
      } finally {
        setPendingCommand('IDLE');
      }
    },
    [],
  );

  const startRun = useCallback(
    async (request: UseRunLifecycleStartRequest): Promise<void> => {
      await runCommand('STARTING', async () => {
        const normalized = normalizeStartRequest(request);

        if (request.resetRunStore !== false) {
          resetRunStore();
        }

        resetAllSlices();
        initializeRunStore(
          normalized.params.runId,
          normalized.params.userId,
          normalized.params.seed,
        );
        refreshMirror();

        await Promise.resolve(
          resolvedController.startRun(normalized.params, normalized.startOptions),
        );

        refreshMirror();
      });
    },
    [initializeRunStore, refreshMirror, resetAllSlices, resetRunStore, resolvedController, runCommand],
  );

  const executeTick = useCallback(async (): Promise<TickResult | null> => {
    return runCommand('TICKING', async () => {
      const result = await Promise.resolve(resolvedController.executeTick());
      refreshMirror();
      return result;
    });
  }, [refreshMirror, resolvedController, runCommand]);

  const abandonRun = useCallback(async (): Promise<void> => {
    await runCommand('ABANDONING', async () => {
      if (resolvedController.abandonRun) {
        await Promise.resolve(resolvedController.abandonRun('USER_ABANDONED'));
      } else if (resolvedController.endRun) {
        await Promise.resolve(resolvedController.endRun('ABANDONED'));
      } else {
        throw new Error('[useRunLifecycle] abandonRun() requires abandonRun() or endRun().');
      }
      refreshMirror();
    });
  }, [refreshMirror, resolvedController, runCommand]);

  const resetRun = useCallback(async (): Promise<void> => {
    await runCommand('RESETTING', async () => {
      await Promise.resolve(resolvedController.reset({ resetEngineStoreSlices: true }));
      resetAllSlices();
      resetRunStore();
      refreshMirror();
    });
  }, [refreshMirror, resetAllSlices, resetRunStore, resolvedController, runCommand]);

  const pauseRun = useCallback(async (reason = 'MANUAL_PAUSE'): Promise<void> => {
    await runCommand('PAUSING', async () => {
      if (!resolvedController.pause) {
        throw new Error('[useRunLifecycle] pauseRun() requires controller.pause().');
      }
      await Promise.resolve(resolvedController.pause(reason));
      refreshMirror();
    });
  }, [refreshMirror, resolvedController, runCommand]);

  const resumeRun = useCallback(async (): Promise<void> => {
    await runCommand('RESUMING', async () => {
      if (!resolvedController.resume) {
        throw new Error('[useRunLifecycle] resumeRun() requires controller.resume().');
      }
      await Promise.resolve(resolvedController.resume());
      refreshMirror();
    });
  }, [refreshMirror, resolvedController, runCommand]);

  const clearLastCommandError = useCallback(() => {
    setLastCommandError(null);
  }, []);

  return {
    lifecycleState,
    runId: run.runId,
    userId: run.userId,
    seed: run.seed,
    tickBudget: run.tickBudget,
    outcome: run.outcome,
    lastTickIndex: run.lastTickIndex,
    lastTickDurationMs: run.lastTickDurationMs,
    ticksRemaining: time.ticksRemaining,
    holdsRemaining: time.holdsRemaining,
    activeDecisionWindowCount: time.activeDecisionWindowCount,
    seasonTimeoutImminent: time.seasonTimeoutImminent,
    ticksUntilTimeout: time.ticksUntilTimeout,
    currentMode,
    isInitialized,
    isRunActive,
    isPaused,
    isIdle,
    isStarting,
    isActive,
    isTickLocked,
    isEnding,
    isEnded,
    supportsPause,
    supportsResume,
    canStart,
    canExecuteTick,
    canAbandon,
    canReset,
    canPause,
    canResume,
    isCommandPending: pendingCommand !== 'IDLE',
    pendingCommand,
    lastCommandError,
    healthReport,
    degradedEngineIds,
    healthyEngineCount,
    erroredEngineCount,
    mirror,
    startRun,
    executeTick,
    abandonRun,
    resetRun,
    pauseRun,
    resumeRun,
    clearLastCommandError,
  };
}

export default useRunLifecycle;
