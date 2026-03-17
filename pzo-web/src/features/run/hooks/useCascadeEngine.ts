// pzo-web/src/features/run/hooks/useCascadeEngine.ts

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useEngineStore, type EngineStoreState } from '../../../store/engineStore';
import {
  ChainId,
  CascadeSeverity,
  type ActivePositiveCascade,
  type CascadeChainBrokenEvent,
  type CascadeChainCompletedEvent,
  type CascadeChainInstance,
  type CascadeChainStartedEvent,
  type CascadeLinkFiredEvent,
  type CascadePositiveActivatedEvent,
  type CascadePositiveDissolvedEvent,
  type CascadeSnapshot,
  type NemesisBrokenEvent,
} from '../../../engines/cascade/types';

export interface UseCascadeEngineResult {
  readonly snapshot: CascadeSnapshot | null;

  readonly activeNegativeChains: readonly CascadeChainInstance[];
  readonly activePositiveCascades: readonly ActivePositiveCascade[];

  readonly latestChainStarted: CascadeChainStartedEvent | null;
  readonly latestLinkFired: CascadeLinkFiredEvent | null;
  readonly latestChainBroken: CascadeChainBrokenEvent | null;
  readonly latestChainCompleted: CascadeChainCompletedEvent | null;
  readonly lastCompletedChain: CascadeChainCompletedEvent | null;
  readonly latestPositiveActivated: (CascadePositiveActivatedEvent & {
    readonly cascadeName: string;
  }) | null;
  readonly latestPositiveDissolved: CascadePositiveDissolvedEvent | null;

  readonly nemesisBrokenEvents: readonly NemesisBrokenEvent[];
  readonly nemesisCount: number;
  readonly lastNemesisBroken: NemesisBrokenEvent | null;

  readonly totalLinksDefeated: number;
  readonly totalLinksScheduled: number;
  readonly defeatRate: number;
  readonly defeatRatePct: number;

  readonly queueDepth: number;
  readonly activeChainCount: number;
  readonly positiveCount: number;
  readonly activePositiveCount: number;
  readonly pausedPositiveCount: number;

  readonly highestActiveSeverity: CascadeSeverity | null;
  readonly hasCatastrophicChain: boolean;
  readonly hasSevereChain: boolean;
  readonly hasModerateChain: boolean;

  readonly isCashflowMomentum: boolean;
  readonly isFortified: boolean;
  readonly isStreakMastery: boolean;
  readonly isSovereignMode: boolean;

  readonly isFortifiedPaused: boolean;
  readonly isSovereignPaused: boolean;

  readonly hasAnyActiveChain: boolean;
  readonly hasAnyPositive: boolean;
  readonly isInSpiral: boolean;
  readonly isCatastrophicSpiral: boolean;
  readonly isClean: boolean;
  readonly isTotalSuppression: boolean;
  readonly isMasteryState: boolean;

  readonly isRunActive: boolean;
  readonly tickNumber: number;
}

function safeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function severityRank(
  severity: CascadeSeverity | null | undefined,
): number {
  switch (severity) {
    case CascadeSeverity.CATASTROPHIC:
      return 4;
    case CascadeSeverity.SEVERE:
      return 3;
    case CascadeSeverity.MODERATE:
      return 2;
    case CascadeSeverity.MILD:
      return 1;
    default:
      return 0;
  }
}

function isPositiveActive(
  cascades: readonly ActivePositiveCascade[],
  chainId: ChainId,
): boolean {
  return cascades.some(
    (cascade) => cascade.pchainId === chainId && cascade.isActive && !cascade.isPaused,
  );
}

function isPositivePaused(
  cascades: readonly ActivePositiveCascade[],
  chainId: ChainId,
): boolean {
  return cascades.some(
    (cascade) => cascade.pchainId === chainId && cascade.isPaused,
  );
}

export function useCascadeEngine(): UseCascadeEngineResult {
  const cascade = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      snapshot: state.cascade.snapshot,
      activeNegativeChains: state.cascade.activeNegativeChains,
      activePositiveCascades: state.cascade.activePositiveCascades,
      latestChainStarted: state.cascade.latestChainStarted,
      latestLinkFired: state.cascade.latestLinkFired,
      latestChainBroken: state.cascade.latestChainBroken,
      latestChainCompleted: state.cascade.latestChainCompleted,
      latestPositiveActivated: state.cascade.latestPositiveActivated,
      latestPositiveDissolved: state.cascade.latestPositiveDissolved,
      nemesisBrokenEvents: state.cascade.nemesisBrokenEvents,
      totalLinksDefeated: state.cascade.totalLinksDefeated,
      isRunActive: state.cascade.isRunActive,
      tickNumber: state.cascade.tickNumber,
    })),
  );

  return useMemo<UseCascadeEngineResult>(() => {
    const snapshot = cascade.snapshot ?? null;
    const activeNegativeChains = [...(cascade.activeNegativeChains ?? [])];
    const activePositiveCascades = [...(cascade.activePositiveCascades ?? [])];
    const nemesisBrokenEvents = [...(cascade.nemesisBrokenEvents ?? [])];

    const queueDepth = safeInt(snapshot?.queueDepth ?? activeNegativeChains.length, 0);
    const positiveCount = safeInt(
      snapshot?.positiveCount ??
        activePositiveCascades.filter((cascadeEntry) => cascadeEntry.isActive).length,
      0,
    );

    const highestActiveSeverity = snapshot?.highestActiveSeverity ?? null;
    const hasCatastrophicChain = Boolean(snapshot?.hasCatastrophicChain);

    const hasSevereChain =
      severityRank(highestActiveSeverity) >= severityRank(CascadeSeverity.SEVERE);
    const hasModerateChain =
      severityRank(highestActiveSeverity) >= severityRank(CascadeSeverity.MODERATE);

    const totalLinksScheduled = safeInt(snapshot?.totalLinksScheduled ?? 0, 0);
    const totalLinksDefeated = safeInt(
      snapshot?.totalLinksDefeated ?? cascade.totalLinksDefeated,
      0,
    );
    const defeatRate =
      totalLinksScheduled > 0 ? totalLinksDefeated / totalLinksScheduled : 0;

    const activePositiveCount = activePositiveCascades.filter(
      (cascadeEntry) => cascadeEntry.isActive && !cascadeEntry.isPaused,
    ).length;

    const pausedPositiveCount = activePositiveCascades.filter(
      (cascadeEntry) => cascadeEntry.isPaused,
    ).length;

    const isCashflowMomentum = isPositiveActive(
      activePositiveCascades,
      ChainId.PCHAIN_SUSTAINED_CASHFLOW,
    );
    const isFortified = isPositiveActive(
      activePositiveCascades,
      ChainId.PCHAIN_FORTIFIED_SHIELDS,
    );
    const isStreakMastery = isPositiveActive(
      activePositiveCascades,
      ChainId.PCHAIN_STREAK_MASTERY,
    );
    const isSovereignMode = isPositiveActive(
      activePositiveCascades,
      ChainId.PCHAIN_SOVEREIGN_APPROACH,
    );

    const isFortifiedPaused = isPositivePaused(
      activePositiveCascades,
      ChainId.PCHAIN_FORTIFIED_SHIELDS,
    );
    const isSovereignPaused = isPositivePaused(
      activePositiveCascades,
      ChainId.PCHAIN_SOVEREIGN_APPROACH,
    );

    const latestPositiveActivated = cascade.latestPositiveActivated
      ? {
          ...cascade.latestPositiveActivated,
          cascadeName: cascade.latestPositiveActivated.chainName,
        }
      : null;

    const nemesisCount = nemesisBrokenEvents.length;
    const lastNemesisBroken =
      nemesisBrokenEvents[nemesisBrokenEvents.length - 1] ?? null;

    return {
      snapshot,

      activeNegativeChains,
      activePositiveCascades,

      latestChainStarted: cascade.latestChainStarted ?? null,
      latestLinkFired: cascade.latestLinkFired ?? null,
      latestChainBroken: cascade.latestChainBroken ?? null,
      latestChainCompleted: cascade.latestChainCompleted ?? null,
      lastCompletedChain: cascade.latestChainCompleted ?? null,
      latestPositiveActivated,
      latestPositiveDissolved: cascade.latestPositiveDissolved ?? null,

      nemesisBrokenEvents,
      nemesisCount,
      lastNemesisBroken,

      totalLinksDefeated,
      totalLinksScheduled,
      defeatRate,
      defeatRatePct: Math.round(defeatRate * 100),

      queueDepth,
      activeChainCount: activeNegativeChains.length,
      positiveCount,
      activePositiveCount,
      pausedPositiveCount,

      highestActiveSeverity,
      hasCatastrophicChain,
      hasSevereChain,
      hasModerateChain,

      isCashflowMomentum,
      isFortified,
      isStreakMastery,
      isSovereignMode,

      isFortifiedPaused,
      isSovereignPaused,

      hasAnyActiveChain: queueDepth > 0,
      hasAnyPositive: positiveCount > 0,
      isInSpiral: queueDepth >= 2,
      isCatastrophicSpiral: hasCatastrophicChain && queueDepth >= 3,
      isClean: queueDepth === 0 && positiveCount > 0,
      isTotalSuppression: hasCatastrophicChain,
      isMasteryState: isCashflowMomentum && isFortified && isStreakMastery,

      isRunActive: Boolean(cascade.isRunActive),
      tickNumber: safeInt(snapshot?.tickNumber ?? cascade.tickNumber, 0),
    };
  }, [cascade]);
}

export function useHasCatastrophicChain(): boolean {
  return useEngineStore((state) => state.cascade.snapshot?.hasCatastrophicChain ?? false);
}

export function useCascadeQueueDepth(): number {
  return useEngineStore((state) => state.cascade.snapshot?.queueDepth ?? 0);
}

export function useActivePositiveCascades(): ActivePositiveCascade[] {
  return useEngineStore((state) => state.cascade.activePositiveCascades ?? []);
}

export function useCascadeLatestChainStarted(): CascadeChainStartedEvent | null {
  return useEngineStore((state) => state.cascade.latestChainStarted ?? null);
}

export function useCascadeLatestLinkFired(): CascadeLinkFiredEvent | null {
  return useEngineStore((state) => state.cascade.latestLinkFired ?? null);
}

export function useCascadeLatestChainBroken(): CascadeChainBrokenEvent | null {
  return useEngineStore((state) => state.cascade.latestChainBroken ?? null);
}

export function useNemesisBrokenEvents(): NemesisBrokenEvent[] {
  return useEngineStore((state) => state.cascade.nemesisBrokenEvents ?? []);
}

export function useCascadeSnapshot(): CascadeSnapshot | null {
  return useEngineStore((state) => state.cascade.snapshot ?? null);
}

export default useCascadeEngine;