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

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';

import {
  useRunStore,
  selectEngineStoreMirrorSnapshot,
} from '../../../store/runStore';

import { useFrontendModeDirector } from '../../../game/modes/useFrontendModeDirector';
import type { FrontendRunMode } from '../../../game/modes/contracts';

import type { StartRunParams } from '../../../engines/zero/EngineOrchestrator';
import type { EngineId, EngineHealth } from '../../../engines/zero/types';

import {
  useRunLifecycle,
  type RunLifecycleController,
  type UseRunLifecycleStartRequest,
} from './useRunLifecycle';

/* ============================================================================
 * TYPES
 * ============================================================================
 */

export interface UseEngineZeroOptions {
  /**
   * The active frontend mode projection to use for metadata/config helpers.
   * Engine store does not currently persist this, so the caller supplies it.
   */
  mode?: FrontendRunMode;

  /**
   * Optional lifecycle controller injection.
   * When omitted, useRunLifecycle falls back to the shared EngineOrchestrator.
   */
  controller?: RunLifecycleController;

  /**
   * Default start params merged into startRun() calls from this aggregate hook.
   */
  defaultStartParams?: Partial<StartRunParams>;
}

export interface UseEngineZeroResult {
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
    pauseRun: () => Promise<void>;
    resumeRun: () => Promise<void>;
    clearLastCommandError: () => void;
  };
}

/* ============================================================================
 * HELPERS
 * ============================================================================
 */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

/* ============================================================================
 * HOOK
 * ============================================================================
 */

export function useEngineZero(
  options: UseEngineZeroOptions = {},
): UseEngineZeroResult {
  const {
    controller,
    defaultStartParams,
    mode = 'solo',
  } = options;

  const lifecycle = useRunLifecycle(controller);
  const modeDirector = useFrontendModeDirector();

  const time = useEngineStore((state: EngineStoreState) => state.time);
  const pressure = useEngineStore((state: EngineStoreState) => state.pressure);
  const tension = useEngineStore((state: EngineStoreState) => state.tension);
  const shield = useEngineStore((state: EngineStoreState) => state.shield);
  const battle = useEngineStore((state: EngineStoreState) => state.battle);
  const cascade = useEngineStore((state: EngineStoreState) => state.cascade);
  const sovereignty = useEngineStore(
    (state: EngineStoreState) => state.sovereignty,
  );

  const mirror = useRunStore(selectEngineStoreMirrorSnapshot);

  const nowMs = Date.now();
  const mirrorAgeMs =
    mirror.lastUpdated === null ? null : Math.max(0, nowMs - mirror.lastUpdated);

  const isMirrorFresh =
    mirrorAgeMs !== null &&
    mirrorAgeMs <= Math.max(2_000, lifecycle.lastTickDurationMs * 2 || 2_000);

  const modeMetadata = useMemo(() => {
    try {
      return modeDirector.getModeMetadata(mode);
    } catch {
      return null;
    }
  }, [mode, modeDirector]);

  const modeCatalog = useMemo(() => {
    try {
      return modeDirector.getCatalog() as unknown[];
    } catch {
      return [];
    }
  }, [modeDirector]);

  const createEngineConfig = useCallback(
    (seed: string | number, overrides: Record<string, unknown> = {}) => {
      try {
        return modeDirector.createEngineConfig(mode, seed, overrides);
      } catch {
        return {
          seed,
          mode,
          ...overrides,
        };
      }
    },
    [mode, modeDirector],
  );

  const cashflowNegative = mirror.cashflow < 0;
  const pressureCritical = pressure.isCritical || pressure.tier === 'CRITICAL';
  const pulseActive =
    tension.isPulseActive || asFiniteNumber(tension.score) >= 0.9;
  const shieldCritical =
    shield.isInBreachCascade || shield.overallIntegrityPct <= 25;
  const battleHot =
    battle.activeBotsCount > 0 ||
    mirror.activeThreatCardCount > 0 ||
    asFiniteNumber(mirror.haterHeat) >= 0.8;
  const timeoutDanger =
    time.seasonTimeoutImminent || time.ticksRemaining <= 5;

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
      request: Omit<
        UseRunLifecycleStartRequest,
        keyof Partial<StartRunParams>
      > &
        Partial<StartRunParams>,
    ): Promise<void> => {
      await lifecycle.startRun({
        ...defaultStartParams,
        ...request,
      });
    },
    [defaultStartParams, lifecycle],
  );

  return {
    mode: {
      activeMode: mode,
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
      isInitialized: lifecycle.isInitialized,
      isMirrorFresh,
      mirrorAgeMs,
      financial: {
        netWorth: mirror.netWorth,
        cashBalance: mirror.cashBalance,
        monthlyIncome: mirror.monthlyIncome,
        monthlyExpenses: mirror.monthlyExpenses,
        cashflow: mirror.cashflow,
        haterHeat: mirror.haterHeat,
        activeThreatCardCount: mirror.activeThreatCardCount,
      },
    },

    time,
    pressure,
    tension,
    shield,
    battle,
    cascade,
    sovereignty,

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