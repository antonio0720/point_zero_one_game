/**
 * FILE: pzo-web/src/features/run/hooks/useTimeEngine.ts
 * POINT ZERO ONE — ENGINE 1 TIME HOOK
 *
 * Read-only React hook for Time Engine state.
 * This hook stays faithful to the live engineStore contract:
 * - time.currentTier
 * - time.ticksElapsed
 * - time.seasonTickBudget
 * - time.ticksRemaining
 * - time.holdsRemaining
 * - time.activeDecisionWindows
 * - time.currentTickDurationMs
 * - time.isTierTransitioning
 * - time.seasonTimeoutImminent
 * - time.ticksUntilTimeout
 *
 * It does NOT import the TimeEngine class directly.
 * It reads from Zustand only.
 */

import { useMemo } from 'react';
import { useEngineStore } from '../../../store/engineStore';
import type { TickTier } from '../../../engines/zero/types';

export interface UseTimeEngineResult {
  currentTier: TickTier;
  ticksElapsed: number;
  tickBudget: number;
  ticksRemaining: number;
  tickProgressPct: number;
  holdsLeft: number;
  activeWindows: unknown[];
  activeDecisionWindows: unknown[];
  hasActiveDecision: boolean;
  activeDecisionCount: number;
  tickDurationMs: number;
  secondsPerTick: number;
  isTierTransitioning: boolean;
  seasonTimeoutImminent: boolean;
  ticksUntilTimeout: number;
}

/**
 * Master read-only hook for Engine 1 state.
 * Components should use this instead of reading the store ad hoc.
 */
export function useTimeEngine(): UseTimeEngineResult {
  const currentTier = useEngineStore((s) => s.time.currentTier);
  const ticksElapsed = useEngineStore((s) => s.time.ticksElapsed);
  const tickBudget = useEngineStore((s) => s.time.seasonTickBudget);
  const ticksRemainingFromStore = useEngineStore((s) => s.time.ticksRemaining);
  const holdsLeft = useEngineStore((s) => s.time.holdsRemaining);
  const activeWindows = useEngineStore((s) => s.time.activeDecisionWindows);
  const tickDurationMs = useEngineStore((s) => s.time.currentTickDurationMs);
  const isTierTransitioning = useEngineStore((s) => s.time.isTierTransitioning);
  const seasonTimeoutImminent = useEngineStore((s) => s.time.seasonTimeoutImminent);
  const ticksUntilTimeout = useEngineStore((s) => s.time.ticksUntilTimeout);

  return useMemo<UseTimeEngineResult>(() => {
    const safeTier = (currentTier ?? 'T1') as TickTier;
    const safeTickBudget = Number.isFinite(tickBudget) && tickBudget > 0 ? tickBudget : 0;
    const derivedTicksRemaining =
      safeTickBudget > 0 ? Math.max(0, safeTickBudget - ticksElapsed) : 0;

    const safeTicksRemaining =
      Number.isFinite(ticksRemainingFromStore) && ticksRemainingFromStore >= 0
        ? ticksRemainingFromStore
        : derivedTicksRemaining;

    const safeTickDurationMs =
      Number.isFinite(tickDurationMs) && tickDurationMs > 0 ? tickDurationMs : 3000;

    const progress =
      safeTickBudget > 0 ? Math.min(1, Math.max(0, ticksElapsed / safeTickBudget)) : 0;

    return {
      currentTier: safeTier,
      ticksElapsed,
      tickBudget: safeTickBudget,
      ticksRemaining: safeTicksRemaining,
      tickProgressPct: progress,
      holdsLeft,
      activeWindows,
      activeDecisionWindows: activeWindows,
      hasActiveDecision: activeWindows.length > 0,
      activeDecisionCount: activeWindows.length,
      tickDurationMs: safeTickDurationMs,
      secondsPerTick: Math.max(1, Math.round(safeTickDurationMs / 1000)),
      isTierTransitioning,
      seasonTimeoutImminent,
      ticksUntilTimeout,
    };
  }, [
    activeWindows,
    currentTier,
    holdsLeft,
    isTierTransitioning,
    seasonTimeoutImminent,
    tickBudget,
    tickDurationMs,
    ticksElapsed,
    ticksRemainingFromStore,
    ticksUntilTimeout,
  ]);
}