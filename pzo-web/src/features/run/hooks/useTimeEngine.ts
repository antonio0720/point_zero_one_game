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
import { useShallow } from 'zustand/react/shallow';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import { TickTier } from '../../../engines/zero/types';

type ActiveDecisionWindow = EngineStoreState['time']['activeDecisionWindows'][number];

export interface UseTimeEngineResult {
  readonly currentTier: TickTier;
  readonly previousTier: TickTier | null;

  readonly ticksElapsed: number;
  readonly tickBudget: number;
  readonly seasonTickBudget: number;
  readonly ticksRemaining: number;
  readonly tickProgressPct: number;
  readonly remainingPct: number;

  readonly holdsLeft: number;
  readonly holdsRemaining: number;

  readonly activeWindows: readonly ActiveDecisionWindow[];
  readonly activeDecisionWindows: readonly ActiveDecisionWindow[];
  readonly activeDecisionCount: number;
  readonly hasActiveDecision: boolean;
  readonly hasActiveDecisionWindow: boolean;
  readonly nextDecisionWindow: ActiveDecisionWindow | null;
  readonly expiringWindow: ActiveDecisionWindow | null;
  readonly isAnyWindowOnHold: boolean;
  readonly heldWindowCount: number;

  readonly tickDurationMs: number;
  readonly secondsPerTick: number;
  readonly lastTickTimestamp: number | null;

  readonly isTierTransitioning: boolean;
  readonly tierChangedThisTick: boolean;
  readonly isRunActive: boolean;

  readonly seasonTimeoutImminent: boolean;
  readonly ticksUntilTimeout: number;
  readonly isFinalFiveTicks: boolean;
  readonly isFinalTick: boolean;
}

const DEFAULT_TICK_DURATION_MS = 3_000;
const DEFAULT_TIER = TickTier.STABLE;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safePositiveInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function compareDecisionWindows(
  left: ActiveDecisionWindow,
  right: ActiveDecisionWindow,
): number {
  const leftRemaining = Number.isFinite(left.remainingMs) ? left.remainingMs : Number.MAX_SAFE_INTEGER;
  const rightRemaining = Number.isFinite(right.remainingMs) ? right.remainingMs : Number.MAX_SAFE_INTEGER;

  if (leftRemaining !== rightRemaining) return leftRemaining - rightRemaining;

  const leftExpiry = left.expiresAtMs ?? Number.MAX_SAFE_INTEGER;
  const rightExpiry = right.expiresAtMs ?? Number.MAX_SAFE_INTEGER;
  if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;

  return left.cardId.localeCompare(right.cardId);
}

export function useTimeEngine(): UseTimeEngineResult {
  const time = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      currentTier: state.time.currentTier,
      previousTier: state.time.previousTier,
      ticksElapsed: state.time.ticksElapsed,
      seasonTickBudget: state.time.seasonTickBudget,
      ticksRemaining: state.time.ticksRemaining,
      holdsRemaining: state.time.holdsRemaining,
      activeDecisionWindows: state.time.activeDecisionWindows,
      currentTickDurationMs: state.time.currentTickDurationMs,
      isTierTransitioning: state.time.isTierTransitioning,
      seasonTimeoutImminent: state.time.seasonTimeoutImminent,
      ticksUntilTimeout: state.time.ticksUntilTimeout,
      lastTickTimestamp: state.time.lastTickTimestamp,
      tierChangedThisTick: state.time.tierChangedThisTick,
      isRunActive: state.time.isRunActive,
    })),
  );

  return useMemo<UseTimeEngineResult>(() => {
    const currentTier = time.currentTier ?? DEFAULT_TIER;
    const previousTier = time.previousTier ?? null;

    const tickBudget = safePositiveInt(time.seasonTickBudget, 0);
    const ticksElapsed = safePositiveInt(time.ticksElapsed, 0);
    const derivedTicksRemaining = tickBudget > 0 ? Math.max(0, tickBudget - ticksElapsed) : 0;
    const ticksRemaining = safePositiveInt(time.ticksRemaining, derivedTicksRemaining);
    const ticksUntilTimeout = safePositiveInt(time.ticksUntilTimeout, ticksRemaining);

    const tickDurationMs = safePositiveInt(
      time.currentTickDurationMs,
      DEFAULT_TICK_DURATION_MS,
    ) || DEFAULT_TICK_DURATION_MS;

    const tickProgressPct = tickBudget > 0 ? clamp01(ticksElapsed / tickBudget) : 0;
    const remainingPct = tickBudget > 0 ? clamp01(ticksRemaining / tickBudget) : 0;

    const holdsRemaining = safePositiveInt(time.holdsRemaining, 0);

    const activeDecisionWindows = [...time.activeDecisionWindows].sort(compareDecisionWindows);
    const activeDecisionCount = activeDecisionWindows.length;
    const heldWindowCount = activeDecisionWindows.filter((window) => window.isOnHold).length;
    const expiringWindow = activeDecisionWindows[0] ?? null;
    const nextDecisionWindow = activeDecisionWindows.find((window) => !window.isExpired && !window.isResolved) ?? expiringWindow;

    const finalFive = ticksRemaining <= 5 || ticksUntilTimeout <= 5;
    const finalTick = ticksRemaining <= 1 || ticksUntilTimeout <= 1;

    return {
      currentTier,
      previousTier,

      ticksElapsed,
      tickBudget,
      seasonTickBudget: tickBudget,
      ticksRemaining,
      tickProgressPct,
      remainingPct,

      holdsLeft: holdsRemaining,
      holdsRemaining,

      activeWindows: activeDecisionWindows,
      activeDecisionWindows,
      activeDecisionCount,
      hasActiveDecision: activeDecisionCount > 0,
      hasActiveDecisionWindow: activeDecisionCount > 0,
      nextDecisionWindow,
      expiringWindow,
      isAnyWindowOnHold: heldWindowCount > 0,
      heldWindowCount,

      tickDurationMs,
      secondsPerTick: Math.max(1, Math.round(tickDurationMs / 1000)),
      lastTickTimestamp: time.lastTickTimestamp ?? null,

      isTierTransitioning: Boolean(time.isTierTransitioning),
      tierChangedThisTick: Boolean(time.tierChangedThisTick),
      isRunActive: Boolean(time.isRunActive),

      seasonTimeoutImminent: Boolean(time.seasonTimeoutImminent) || finalFive,
      ticksUntilTimeout,
      isFinalFiveTicks: finalFive,
      isFinalTick: finalTick,
    };
  }, [time]);
}

export default useTimeEngine;
