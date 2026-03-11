/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/hooks/useTensionEngine.ts
 * ============================================================================
 *
 * Purpose:
 * - primary frontend read hook for Engine 3 — Tension Engine
 * - centralize all tension slice reads + derived UI-ready selectors
 * - keep components thin and free of repeated threat/tension math
 *
 * Doctrine:
 * - reads from engineStore only
 * - never imports TensionEngine directly
 * - exposes derived signals for gauges, queue panels, HUD badges, and UX state
 * ============================================================================
 */

import { useMemo } from 'react';
import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import {
  TENSION_CONSTANTS,
  VISIBILITY_CONFIGS,
  type AnticipationEntry,
  type VisibilityConfig,
  type VisibilityState,
} from '../../../engines/tension/types';

export type TensionBand =
  | 'CALM'
  | 'RISING'
  | 'HIGH'
  | 'CRISIS'
  | 'PULSE';

export type TensionUrgency =
  | 'CLEAR'
  | 'BUILDING'
  | 'URGENT'
  | 'COLLAPSE_IMMINENT';

export type TensionTrend = 'FALLING' | 'FLAT' | 'RISING';

export interface UseTensionEngineResult {
  readonly score: number;
  readonly scorePct: number;
  readonly scoreHistory: readonly number[];

  readonly tensionBand: TensionBand;
  readonly trend: TensionTrend;

  readonly visibilityState: VisibilityState;
  readonly previousVisibilityState: VisibilityState | null;
  readonly visibilityConfig: VisibilityConfig;

  readonly queueLength: number;
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly expiredCount: number;

  readonly activeThreatCount: number;
  readonly unresolvedThreatCount: number;
  readonly hasThreats: boolean;
  readonly hasQueuedThreats: boolean;
  readonly hasArrivedThreats: boolean;
  readonly hasExpiredThreats: boolean;

  readonly isPulseActive: boolean;
  readonly pulseTicksActive: number;
  readonly isSustainedPulse: boolean;
  readonly isNearPulse: boolean;
  readonly isEscalating: boolean;
  readonly isRunActive: boolean;

  readonly currentTick: number;
  readonly threatUrgency: TensionUrgency;

  readonly sortedQueue: readonly AnticipationEntry[];
  readonly dominantEntry: AnticipationEntry | null;
  readonly nextQueuedEntry: AnticipationEntry | null;
  readonly nextThreatEta: number | null;

  readonly lastArrivedEntry: AnticipationEntry | null;
  readonly lastExpiredEntry: AnticipationEntry | null;

  readonly canSeeThreatTypes: boolean;
  readonly canSeeArrivalTicks: boolean;
  readonly canSeeMitigationPaths: boolean;
  readonly canSeeWorstCase: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function resolveTensionBand(score: number): TensionBand {
  if (score >= TENSION_CONSTANTS.PULSE_THRESHOLD) return 'PULSE';
  if (score >= 0.8) return 'CRISIS';
  if (score >= 0.55) return 'HIGH';
  if (score >= 0.25) return 'RISING';
  return 'CALM';
}

function resolveTrend(history: readonly number[]): TensionTrend {
  if (history.length < 2) return 'FLAT';

  const current = history[history.length - 1] ?? 0;
  const previous = history[history.length - 2] ?? 0;
  const delta = current - previous;

  if (delta > 0.0001) return 'RISING';
  if (delta < -0.0001) return 'FALLING';
  return 'FLAT';
}

function resolveThreatUrgency(
  score: number,
  queueLength: number,
  arrivedCount: number,
  isPulseActive: boolean,
): TensionUrgency {
  if (isPulseActive || score >= 0.95) return 'COLLAPSE_IMMINENT';
  if (arrivedCount > 0 || score >= 0.7) return 'URGENT';
  if (queueLength > 0 || score >= 0.25) return 'BUILDING';
  return 'CLEAR';
}

function resolveNextQueuedEntry(
  sortedQueue: readonly AnticipationEntry[],
): AnticipationEntry | null {
  for (const entry of sortedQueue) {
    if (!entry.isArrived) return entry;
  }
  return null;
}

export function useTensionEngine(): UseTensionEngineResult {
  const score = useEngineStore((s: EngineStoreState) => s.tension.score);
  const scoreHistory = useEngineStore(
    (s: EngineStoreState) => s.tension.scoreHistory,
  );

  const visibilityState = useEngineStore(
    (s: EngineStoreState) => s.tension.visibilityState,
  );
  const previousVisibilityState = useEngineStore(
    (s: EngineStoreState) => s.tension.previousVisibilityState,
  );

  const queueLength = useEngineStore(
    (s: EngineStoreState) => s.tension.queueLength,
  );
  const arrivedCount = useEngineStore(
    (s: EngineStoreState) => s.tension.arrivedCount,
  );
  const queuedCount = useEngineStore(
    (s: EngineStoreState) => s.tension.queuedCount,
  );
  const expiredCount = useEngineStore(
    (s: EngineStoreState) => s.tension.expiredCount,
  );

  const isPulseActive = useEngineStore(
    (s: EngineStoreState) => s.tension.isPulseActive,
  );
  const pulseTicksActive = useEngineStore(
    (s: EngineStoreState) => s.tension.pulseTicksActive,
  );
  const isSustainedPulse = useEngineStore(
    (s: EngineStoreState) => s.tension.isSustainedPulse,
  );
  const isEscalating = useEngineStore(
    (s: EngineStoreState) => s.tension.isEscalating,
  );

  const sortedQueue = useEngineStore(
    (s: EngineStoreState) => s.tension.sortedQueue,
  );
  const lastArrivedEntry = useEngineStore(
    (s: EngineStoreState) => s.tension.lastArrivedEntry,
  );
  const lastExpiredEntry = useEngineStore(
    (s: EngineStoreState) => s.tension.lastExpiredEntry,
  );
  const currentTick = useEngineStore(
    (s: EngineStoreState) => s.tension.currentTick,
  );
  const isRunActive = useEngineStore(
    (s: EngineStoreState) => s.tension.isRunActive,
  );

  return useMemo<UseTensionEngineResult>(() => {
    const safeScore = clamp01(score);
    const scorePct = safeScore * 100;
    const visibilityConfig = VISIBILITY_CONFIGS[visibilityState];
    const dominantEntry = sortedQueue[0] ?? null;
    const nextQueuedEntry = resolveNextQueuedEntry(sortedQueue);
    const nextThreatEta =
      nextQueuedEntry === null
        ? null
        : Math.max(0, nextQueuedEntry.arrivalTick - currentTick);

    const activeThreatCount = queueLength;
    const unresolvedThreatCount = queueLength + expiredCount;

    return {
      score: safeScore,
      scorePct,
      scoreHistory: Object.freeze([...scoreHistory]),

      tensionBand: resolveTensionBand(safeScore),
      trend: resolveTrend(scoreHistory),

      visibilityState,
      previousVisibilityState,
      visibilityConfig,

      queueLength,
      arrivedCount,
      queuedCount,
      expiredCount,

      activeThreatCount,
      unresolvedThreatCount,
      hasThreats: queueLength > 0,
      hasQueuedThreats: queuedCount > 0,
      hasArrivedThreats: arrivedCount > 0,
      hasExpiredThreats: expiredCount > 0,

      isPulseActive,
      pulseTicksActive,
      isSustainedPulse,
      isNearPulse:
        safeScore >= TENSION_CONSTANTS.PULSE_THRESHOLD - 0.1 &&
        safeScore < TENSION_CONSTANTS.PULSE_THRESHOLD,
      isEscalating,
      isRunActive,

      currentTick,
      threatUrgency: resolveThreatUrgency(
        safeScore,
        queueLength,
        arrivedCount,
        isPulseActive,
      ),

      sortedQueue: Object.freeze([...sortedQueue]),
      dominantEntry,
      nextQueuedEntry,
      nextThreatEta,

      lastArrivedEntry,
      lastExpiredEntry,

      canSeeThreatTypes: visibilityConfig.showsThreatType,
      canSeeArrivalTicks: visibilityConfig.showsArrivalTick,
      canSeeMitigationPaths: visibilityConfig.showsMitigationPath,
      canSeeWorstCase: visibilityConfig.showsWorstCase,
    };
  }, [
    score,
    scoreHistory,
    visibilityState,
    previousVisibilityState,
    queueLength,
    arrivedCount,
    queuedCount,
    expiredCount,
    isPulseActive,
    pulseTicksActive,
    isSustainedPulse,
    isEscalating,
    sortedQueue,
    lastArrivedEntry,
    lastExpiredEntry,
    currentTick,
    isRunActive,
  ]);
}