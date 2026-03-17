///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/usePressureEngine.ts

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import { PressureTier } from '../../../engines/zero/types';

export type PressureTrend = 'RISING' | 'FALLING' | 'FLAT';

export interface PressureBreakdownEntry {
  readonly signal: string;
  readonly weight: number;
  readonly sharePct: number;
  readonly isDominant: boolean;
}

export interface UsePressureEngineResult {
  readonly score: number;
  readonly scorePct: number;

  readonly tier: PressureTier;
  readonly previousTier: PressureTier | null;
  readonly tierRank: number;

  readonly isCritical: boolean;
  readonly isHigh: boolean;
  readonly isEscalating: boolean;
  readonly isDecaying: boolean;
  readonly trend: PressureTrend;

  readonly triggerSignals: readonly string[];
  readonly dominantSignal: string | null;
  readonly breakdown: readonly PressureBreakdownEntry[];

  readonly postActionScore: number;
  readonly postActionDelta: number;
  readonly postActionDeltaPct: number;

  readonly stagnationCount: number;
  readonly tickIndex: number;
  readonly ticksToCalm: number;
  readonly ticksUntilCalm: number;
}

const DEFAULT_TIER = PressureTier.CALM;
const TIER_RANK: Record<PressureTier, number> = {
  CALM: 0,
  BUILDING: 1,
  ELEVATED: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function getTierRank(tier: PressureTier | null | undefined): number {
  if (!tier) return 0;
  return TIER_RANK[tier] ?? 0;
}

function resolveTrend(
  currentRank: number,
  previousRank: number,
  score: number,
  postActionScore: number,
): PressureTrend {
  if (currentRank > previousRank) return 'RISING';
  if (currentRank < previousRank) return 'FALLING';

  const delta = postActionScore - score;
  if (delta > 0.0001) return 'RISING';
  if (delta < -0.0001) return 'FALLING';
  return 'FLAT';
}

function estimateTicksToCalm(
  score: number,
  tier: PressureTier,
  stagnationCount: number,
  trend: PressureTrend,
): number {
  if (tier === 'CALM' || score <= 0.001) return 0;

  const base = Math.ceil(score * 10);
  const tierPenalty = getTierRank(tier);
  const stagnationPenalty = Math.min(5, Math.max(0, stagnationCount - 1));
  const trendPenalty = trend === 'RISING' ? 2 : trend === 'FLAT' ? 1 : 0;

  return Math.max(1, base + tierPenalty + stagnationPenalty + trendPenalty);
}

export function usePressureEngine(): UsePressureEngineResult {
    const pressure = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      score: state.pressure.score,
      tier: state.pressure.tier,
      previousTier: state.pressure.previousTier,
      isCritical: state.pressure.isCritical,
      triggerSignals: state.pressure.triggerSignals,
      postActionScore: state.pressure.postActionScore,
      stagnationCount: state.pressure.stagnationCount,
      tickIndex: state.pressure.tickIndex,
    })),
  );

  return useMemo<UsePressureEngineResult>(() => {
    const score = clamp01(pressure.score);
    const tier = pressure.tier ?? DEFAULT_TIER;
    const previousTier = pressure.previousTier ?? null;
    const postActionScore = clamp01(pressure.postActionScore);
    const triggerSignals = [...pressure.triggerSignals];
    const dominantSignal = triggerSignals[0] ?? null;

    const tierRank = getTierRank(tier);
    const previousTierRank = getTierRank(previousTier);
    const trend = resolveTrend(tierRank, previousTierRank, score, postActionScore);

    const breakdown = triggerSignals.map((signal, index, list) => {
      const share = list.length > 0 ? 1 / list.length : 0;
      return {
        signal,
        weight: share,
        sharePct: share * 100,
        isDominant: index === 0,
      } satisfies PressureBreakdownEntry;
    });

    const ticksToCalm = estimateTicksToCalm(
      score,
      tier,
      safeInt(pressure.stagnationCount, 0),
      trend,
    );

    return {
      score,
      scorePct: score * 100,

      tier,
      previousTier,
      tierRank,

      isCritical: Boolean(pressure.isCritical) || tier === 'CRITICAL',
      isHigh: tier === 'HIGH' || tier === 'CRITICAL',
      isEscalating: trend === 'RISING',
      isDecaying: trend === 'FALLING',
      trend,

      triggerSignals,
      dominantSignal,
      breakdown,

      postActionScore,
      postActionDelta: postActionScore - score,
      postActionDeltaPct: (postActionScore - score) * 100,

      stagnationCount: safeInt(pressure.stagnationCount, 0),
      tickIndex: safeInt(pressure.tickIndex, 0),
      ticksToCalm,
      ticksUntilCalm: ticksToCalm,
    };
  }, [pressure]);
}

export default usePressureEngine;
