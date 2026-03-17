// pzo-web/src/features/run/hooks/useEngineZero.ts

/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/hooks/useEngineZero.ts
 * ============================================================================
 *
 * POINT ZERO ONE — ENGINE 0 AGGREGATE HOOK
 *
 * Purpose:
 * - expose a single high-density Engine 0 façade for run screens, HUD shells,
 *   debug overlays, orchestration panels, and mode-aware containers
 * - compose existing Engine 0 lifecycle, store, runStore mirror, and mode
 *   director surfaces without creating a third orchestrator implementation
 * - provide production-grade derived state: health, risk, mirror freshness,
 *   lifecycle gates, and mode metadata
 * ============================================================================
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import {
  selectEngineStoreMirrorSnapshot,
  useRunStore,
} from '../../../store/runStore';
import { useFrontendModeDirector } from '../../../game/modes/useFrontendModeDirector';
import type { FrontendRunMode } from '../../../game/modes/contracts';
import {
  ZeroFacade,
  type ZeroStartRunOptions,
} from '../../../engines/zero/ZeroFacade';
import type { StartRunParams } from '../../../engines/zero/EngineOrchestrator';
import { PressureTier } from '../../../engines/zero/types';
import type { EngineHealth, EngineId } from '../../../engines/zero/types';

import {
  useRunLifecycle,
  type RunLifecycleController,
  type UseRunLifecycleStartRequest,
} from './useRunLifecycle';

export interface UseEngineZeroOptions {
  facade?: ZeroFacade;
  controller?: RunLifecycleController;
  mode?: FrontendRunMode;
  defaultStartParams?: Partial<StartRunParams>;
  defaultStartOptions?: Partial<ZeroStartRunOptions>;
}

export interface UseEngineZeroResult {
  facade: ZeroFacade | null;
  mode: {
    activeMode: FrontendRunMode;
    metadata: unknown | null;
    catalog: unknown[];
    createEngineConfig: (
      seed: string | number,
      overrides?: Record<string, unknown>,
    ) => Record<string, unknown>;
  };
  lifecycle: ReturnType<typeof useRunLifecycle>;
  run: {
    runId: string | null;
    userId: string | null;
    seed: string | null;
    tickBudget: number;
    lastTickIndex: number;
    lastTickDurationMs: number;
    outcome: ReturnType<typeof useRunLifecycle>['outcome'];
    isInitialized: boolean;
    isMirrorFresh: boolean;
    mirrorAgeMs: number | null;
    financial: {
      netWorth: number;
      cashBalance: number;
      monthlyIncome: number;
      monthlyExpenses: number;
      cashflow: number;
      haterHeat: number;
      activeThreatCardCount: number;
    };
  };
  runtime: ReturnType<typeof selectEngineStoreMirrorSnapshot>;
  time: EngineStoreState['time'];
  pressure: EngineStoreState['pressure'];
  tension: EngineStoreState['tension'];
  shield: EngineStoreState['shield'];
  battle: EngineStoreState['battle'];
  cascade: EngineStoreState['cascade'];
  sovereignty: EngineStoreState['sovereignty'];
  health: {
    report: Partial<Record<EngineId, EngineHealth>> | null;
    healthyEngineCount: number;
    erroredEngineCount: number;
    degradedEngineIds: EngineId[];
    totalReportedEngines: number;
    isHealthy: boolean;
  };
  risk: {
    score: number;
    isElevated: boolean;
    cashflowNegative: boolean;
    pressureCritical: boolean;
    pulseActive: boolean;
    shieldCritical: boolean;
    battleHot: boolean;
    timeoutDanger: boolean;
    activeDecisionWindows: number;
  };
  actions: {
    startRun: (
      request: Omit<UseRunLifecycleStartRequest, keyof Partial<StartRunParams>> &
        Partial<StartRunParams>,
    ) => Promise<void>;
    executeTick: () => Promise<unknown>;
    abandonRun: () => Promise<void>;
    resetRun: () => Promise<void>;
    pauseRun: (reason?: string) => Promise<void>;
    resumeRun: () => Promise<void>;
    clearLastCommandError: () => void;
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isZeroFacade(value: unknown): value is ZeroFacade {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ZeroFacade).startRun === 'function' &&
      typeof (value as ZeroFacade).executeTick === 'function' &&
      typeof (value as ZeroFacade).getCurrentMode === 'function',
  );
}

function resolveOptions(input?: ZeroFacade | UseEngineZeroOptions): UseEngineZeroOptions {
  if (isZeroFacade(input)) {
    return { facade: input };
  }

  return input ?? {};
}

export function useEngineZero(
  input?: ZeroFacade | UseEngineZeroOptions,
): UseEngineZeroResult {
  const {
    facade = null,
    controller,
    defaultStartParams,
    defaultStartOptions,
    mode,
  } = resolveOptions(input);

  const lifecycle = useRunLifecycle(facade ?? controller);
  const modeDirector = useFrontendModeDirector();

  const engine = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      time: state.time,
      pressure: state.pressure,
      tension: state.tension,
      shield: state.shield,
      battle: state.battle,
      cascade: state.cascade,
      sovereignty: state.sovereignty,
    })),
  );

  const runtime = useRunStore(selectEngineStoreMirrorSnapshot);

  const nowMs = Date.now();
  const mirrorAgeMs =
    runtime.lastUpdated === null ? null : Math.max(0, nowMs - runtime.lastUpdated);

  const isMirrorFresh =
    mirrorAgeMs !== null &&
    mirrorAgeMs <= Math.max(2_000, lifecycle.lastTickDurationMs * 2 || 2_000);

  const activeMode =
    lifecycle.currentMode ??
    facade?.getCurrentMode() ??
    mode ??
    'solo';

  const modeMetadata = useMemo(() => {
    try {
      return facade
        ? facade.getModeMetadata(activeMode)
        : modeDirector.getModeMetadata(activeMode);
    } catch {
      return null;
    }
  }, [activeMode, facade, modeDirector]);

  const modeCatalog = useMemo(() => {
    try {
      return facade
        ? (facade.getModeCatalog() as unknown[])
        : (modeDirector.getCatalog() as unknown[]);
    } catch {
      return [];
    }
  }, [facade, modeDirector]);

  const createEngineConfig = useCallback(
    (seed: string | number, overrides: Record<string, unknown> = {}) => {
      try {
        return facade
          ? facade.createModeEngineConfig(activeMode, seed, overrides)
          : modeDirector.createEngineConfig(activeMode, seed, overrides);
      } catch {
        return {
          seed,
          mode: activeMode,
          ...overrides,
        };
      }
    },
    [activeMode, facade, modeDirector],
  );

  const cashflowNegative = runtime.cashflow < 0;
  const pressureCritical =
    engine.pressure.isCritical || engine.pressure.tier === PressureTier.CRITICAL;
  const pulseActive =
    engine.tension.isPulseActive ||
    engine.tension.isSustainedPulse ||
    asFiniteNumber(engine.tension.score) >= 0.9;
  const shieldCritical =
    engine.shield.isInBreachCascade ||
    asFiniteNumber(engine.shield.overallIntegrityPct) <= 0.25;
  const battleHot =
    engine.battle.activeBotsCount > 0 ||
    runtime.activeThreatCardCount > 0 ||
    Math.max(asFiniteNumber(runtime.haterHeat), asFiniteNumber(engine.battle.haterHeat)) >= 0.8;
  const timeoutDanger =
    engine.time.seasonTimeoutImminent || engine.time.ticksRemaining <= 5;

  const rawRiskPoints =
    (cashflowNegative ? 1 : 0) +
    (pressureCritical ? 1 : 0) +
    (pulseActive ? 1 : 0) +
    (shieldCritical ? 1 : 0) +
    (battleHot ? 1 : 0) +
    (timeoutDanger ? 1 : 0);

  const riskScore = clamp01(rawRiskPoints / 6);

  const totalReportedEngines = lifecycle.healthReport
    ? Object.keys(lifecycle.healthReport).length
    : 0;

  const startRun = useCallback(
    async (
      request: Omit<UseRunLifecycleStartRequest, keyof Partial<StartRunParams>> &
        Partial<StartRunParams>,
    ): Promise<void> => {
      await lifecycle.startRun({
        ...defaultStartParams,
        ...request,
        mode:
          request.mode ??
          defaultStartOptions?.mode ??
          activeMode,
        modeSeed:
          request.modeSeed ??
          defaultStartOptions?.modeSeed,
        modeOverrides: {
          ...(defaultStartOptions?.modeOverrides ?? {}),
          ...(request.modeOverrides ?? {}),
        },
        wireStoreHandlers:
          request.wireStoreHandlers ?? defaultStartOptions?.wireStoreHandlers,
        wireRunMirror:
          request.wireRunMirror ?? defaultStartOptions?.wireRunMirror,
        registerDefaultChannels:
          request.registerDefaultChannels ??
          defaultStartOptions?.registerDefaultChannels,
      });
    },
    [activeMode, defaultStartOptions, defaultStartParams, lifecycle],
  );

  return {
    facade,
    mode: {
      activeMode,
      metadata: modeMetadata,
      catalog: modeCatalog,
      createEngineConfig,
    },

    lifecycle,

    run: {
      runId: lifecycle.runId,
      userId: lifecycle.userId,
      seed: lifecycle.seed,
      tickBudget: lifecycle.tickBudget,
      lastTickIndex: lifecycle.lastTickIndex,
      lastTickDurationMs: lifecycle.lastTickDurationMs,
      outcome: lifecycle.outcome,
      isInitialized: lifecycle.isInitialized || runtime.isInitialized,
      isMirrorFresh,
      mirrorAgeMs,
      financial: {
        netWorth: runtime.netWorth,
        cashBalance: runtime.cashBalance,
        monthlyIncome: runtime.monthlyIncome,
        monthlyExpenses: runtime.monthlyExpenses,
        cashflow: runtime.cashflow,
        haterHeat: runtime.haterHeat,
        activeThreatCardCount: runtime.activeThreatCardCount,
      },
    },

    runtime,
    time: engine.time,
    pressure: engine.pressure,
    tension: engine.tension,
    shield: engine.shield,
    battle: engine.battle,
    cascade: engine.cascade,
    sovereignty: engine.sovereignty,

    health: {
      report: lifecycle.healthReport,
      healthyEngineCount: lifecycle.healthyEngineCount,
      erroredEngineCount: lifecycle.erroredEngineCount,
      degradedEngineIds: lifecycle.degradedEngineIds,
      totalReportedEngines,
      isHealthy: lifecycle.erroredEngineCount === 0,
    },

    risk: {
      score: riskScore,
      isElevated: riskScore >= 0.5,
      cashflowNegative,
      pressureCritical,
      pulseActive,
      shieldCritical,
      battleHot,
      timeoutDanger,
      activeDecisionWindows: lifecycle.activeDecisionWindowCount,
    },

    actions: {
      startRun,
      executeTick: lifecycle.executeTick,
      abandonRun: lifecycle.abandonRun,
      resetRun: lifecycle.resetRun,
      pauseRun: lifecycle.pauseRun,
      resumeRun: lifecycle.resumeRun,
      clearLastCommandError: lifecycle.clearLastCommandError,
    },
  };
}

export default useEngineZero;
