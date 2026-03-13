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

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';

import {
  useRunStore,
  readEngineStoreMirrorSnapshot,
  selectEngineStoreMirrorSnapshot,
} from '../../../store/runStore';

import {
  EngineOrchestrator,
  type StartRunParams,
} from '../../../engines/zero/EngineOrchestrator';

import type {
  EngineHealth,
  EngineId,
  RunLifecycleState,
  RunOutcome,
  TickResult,
} from '../../../engines/zero/types';

/* ============================================================================
 * TYPES
 * ============================================================================
 */

type MaybePromise<T> = T | Promise<T>;

export interface RunLifecycleController {
  startRun(params: StartRunParams): MaybePromise<void>;
  executeTick(): MaybePromise<TickResult | null>;
  reset(): MaybePromise<void>;
  endRun?(outcome: RunOutcome): MaybePromise<void>;
  pause?(): MaybePromise<void>;
  resume?(): MaybePromise<void>;
  getLifecycleState?(): RunLifecycleState;
  isRunActive?(): boolean;
  getHealthReport?(): Partial<Record<EngineId, EngineHealth>>;
}

export interface UseRunLifecycleStartRequest
  extends Partial<StartRunParams> {
  userId: string;
  /**
   * When true or omitted, the hook clears stale runStore financial/runtime state
   * before initializing the next run.
   */
  resetRunStore?: boolean;
}

export interface UseRunLifecycleResult {
  lifecycleState: RunLifecycleState;
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
  isInitialized: boolean;
  isRunActive: boolean;
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
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  clearLastCommandError: () => void;
}

/* ============================================================================
 * GLOBAL ORCHESTRATOR SINGLETON LANE
 * ============================================================================
 */

type GlobalEngineZeroScope = typeof globalThis & {
  __PZO_ENGINE_ZERO_ORCHESTRATOR__?: EngineOrchestrator;
};

function getGlobalEngineZeroScope(): GlobalEngineZeroScope {
  return globalThis as GlobalEngineZeroScope;
}

function getSharedEngineZeroOrchestrator(): EngineOrchestrator {
  const scope = getGlobalEngineZeroScope();

  if (!scope.__PZO_ENGINE_ZERO_ORCHESTRATOR__) {
    scope.__PZO_ENGINE_ZERO_ORCHESTRATOR__ = new EngineOrchestrator();
  }

  return scope.__PZO_ENGINE_ZERO_ORCHESTRATOR__;
}

function createDefaultLifecycleController(): RunLifecycleController {
  const orchestrator = getSharedEngineZeroOrchestrator();

  return {
    startRun(params) {
      orchestrator.startRun(params);
    },

    executeTick() {
      return orchestrator.executeTick();
    },

    reset() {
      orchestrator.reset();
    },

    endRun(outcome) {
      const candidate = orchestrator as EngineOrchestrator & {
        endRun?: (nextOutcome: RunOutcome) => Promise<void>;
      };

      if (!candidate.endRun) {
        throw new Error(
          '[useRunLifecycle] Default controller does not expose endRun().',
        );
      }

      return candidate.endRun(outcome);
    },

    getLifecycleState() {
      const candidate = orchestrator as EngineOrchestrator & {
        getLifecycleState?: () => RunLifecycleState;
      };

      return candidate.getLifecycleState?.() ?? 'IDLE';
    },

    isRunActive() {
      const candidate = orchestrator as EngineOrchestrator & {
        isRunActive?: () => boolean;
      };

      return candidate.isRunActive?.() ?? false;
    },

    getHealthReport() {
      const candidate = orchestrator as EngineOrchestrator & {
        getHealthReport?: () => Partial<Record<EngineId, EngineHealth>>;
      };

      return candidate.getHealthReport?.() ?? {};
    },
  };
}

/* ============================================================================
 * HELPERS
 * ============================================================================
 */

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function coerceNonEmptyString(
  value: unknown,
  fallback: string,
): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function coercePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function coerceNonNegativeNumber(
  value: unknown,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value >= 0 ? value : fallback;
}

function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createSeed(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeStartRequest(
  request: UseRunLifecycleStartRequest,
): StartRunParams {
  return {
    runId: coerceNonEmptyString(request.runId, createRunId()),
    userId: coerceNonEmptyString(request.userId, 'anonymous-user'),
    seed: coerceNonEmptyString(request.seed, createSeed()),
    seasonTickBudget: coercePositiveInt(request.seasonTickBudget, 60),
    freedomThreshold: coerceNonNegativeNumber(
      request.freedomThreshold,
      1_000_000,
    ),
    clientVersion: coerceNonEmptyString(request.clientVersion, 'pzo-web'),
    engineVersion: coerceNonEmptyString(request.engineVersion, 'engine-zero'),
  };
}

/* ============================================================================
 * HOOK
 * ============================================================================
 */

export function useRunLifecycle(
  controller?: RunLifecycleController,
): UseRunLifecycleResult {
  const resolvedController = useMemo<RunLifecycleController>(
    () => controller ?? createDefaultLifecycleController(),
    [controller],
  );

  const run = useEngineStore((state: EngineStoreState) => state.run);
  const time = useEngineStore((state: EngineStoreState) => state.time);
  const resetAllSlices = useEngineStore(
    (state: EngineStoreState) => state.resetAllSlices,
  );
  const syncRunMirror = useEngineStore(
    (state: EngineStoreState) => state.syncRunMirror,
  );

  const isInitialized = useRunStore((state) => state.isInitialized);
  const initializeRunStore = useRunStore((state) => state.initialize);
  const resetRunStore = useRunStore((state) => state.reset);
  const mirror = useRunStore(selectEngineStoreMirrorSnapshot);

  const [pendingCommand, setPendingCommand] = useState<
    UseRunLifecycleResult['pendingCommand']
  >('IDLE');

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

    return (Object.entries(healthReport) as Array<
      [EngineId, EngineHealth | undefined]
    >)
      .filter(([, health]) => health === 'ERROR')
      .map(([engineId]) => engineId);
  }, [healthReport]);

  const healthyEngineCount = useMemo(() => {
    if (!healthReport) return 0;

    return Object.values(healthReport).filter(
      (health) => health === 'INITIALIZED',
    ).length;
  }, [healthReport]);

  const erroredEngineCount = degradedEngineIds.length;

  const lifecycleState =
    run.lifecycleState ??
    resolvedController.getLifecycleState?.() ??
    'IDLE';

  const isIdle = lifecycleState === 'IDLE';
  const isStarting = lifecycleState === 'STARTING';
  const isActive = lifecycleState === 'ACTIVE';
  const isTickLocked = lifecycleState === 'TICK_LOCKED';
  const isEnding = lifecycleState === 'ENDING';
  const isEnded = lifecycleState === 'ENDED';

  const isRunActive =
    run.lifecycleState === 'ACTIVE' ||
    time.isRunActive ||
    resolvedController.isRunActive?.() === true;

  const supportsPause = typeof resolvedController.pause === 'function';
  const supportsResume = typeof resolvedController.resume === 'function';

  const canStart = isIdle && pendingCommand === 'IDLE';
  const canExecuteTick = isActive && pendingCommand === 'IDLE';
  const canAbandon =
    (isStarting || isActive || isTickLocked) && pendingCommand === 'IDLE';
  const canReset =
    (isIdle || isEnded || isEnding) && pendingCommand === 'IDLE';
  const canPause = supportsPause && isActive && pendingCommand === 'IDLE';
  const canResume =
    supportsResume &&
    (isTickLocked || isStarting || isEnding === false) &&
    pendingCommand === 'IDLE';

  const runCommand = useCallback(
    async <T,>(
      commandName: UseRunLifecycleResult['pendingCommand'],
      work: () => Promise<T>,
    ): Promise<T> => {
      setPendingCommand(commandName);
      setLastCommandError(null);

      try {
        const result = await work();
        return result;
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
          normalized.runId,
          normalized.userId,
          normalized.seed,
        );
        refreshMirror();

        await Promise.resolve(resolvedController.startRun(normalized));

        refreshMirror();
      });
    },
    [
      initializeRunStore,
      refreshMirror,
      resetAllSlices,
      resetRunStore,
      resolvedController,
      runCommand,
    ],
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
      if (!resolvedController.endRun) {
        throw new Error(
          '[useRunLifecycle] abandonRun() requires controller.endRun().',
        );
      }

      await Promise.resolve(resolvedController.endRun('ABANDONED'));
      refreshMirror();
    });
  }, [refreshMirror, resolvedController, runCommand]);

  const resetRun = useCallback(async (): Promise<void> => {
    await runCommand('RESETTING', async () => {
      await Promise.resolve(resolvedController.reset());
      resetAllSlices();
      resetRunStore();
      refreshMirror();
    });
  }, [refreshMirror, resetAllSlices, resetRunStore, resolvedController, runCommand]);

  const pauseRun = useCallback(async (): Promise<void> => {
    await runCommand('PAUSING', async () => {
      if (!resolvedController.pause) {
        throw new Error(
          '[useRunLifecycle] pauseRun() requires controller.pause().',
        );
      }

      await Promise.resolve(resolvedController.pause());
      refreshMirror();
    });
  }, [refreshMirror, resolvedController, runCommand]);

  const resumeRun = useCallback(async (): Promise<void> => {
    await runCommand('RESUMING', async () => {
      if (!resolvedController.resume) {
        throw new Error(
          '[useRunLifecycle] resumeRun() requires controller.resume().',
        );
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
    activeDecisionWindowCount: time.activeDecisionWindows.length,
    seasonTimeoutImminent: time.seasonTimeoutImminent,
    ticksUntilTimeout: time.ticksUntilTimeout,
    isInitialized,
    isRunActive,
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