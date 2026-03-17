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
import { useShallow } from 'zustand/react/shallow';

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
  readonly totalObservedThreatCount: number;
  readonly queuePressurePct: number;
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
  readonly soonestArrivalTick: number | null;

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

function safeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
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

function resolveVisibilityConfig(visibilityState: VisibilityState): VisibilityConfig {
  return VISIBILITY_CONFIGS[visibilityState] ?? VISIBILITY_CONFIGS.SHADOWED;
}

export function useTensionEngine(): UseTensionEngineResult {
 const tension = useEngineStore(
  useShallow((state: EngineStoreState) => ({
    score: state.tension.score,
    scoreHistory: state.tension.scoreHistory,
    visibilityState: state.tension.visibilityState,
    previousVisibilityState: state.tension.previousVisibilityState,
    queueLength: state.tension.queueLength,
    arrivedCount: state.tension.arrivedCount,
    queuedCount: state.tension.queuedCount,
    expiredCount: state.tension.expiredCount,
    isPulseActive: state.tension.isPulseActive,
    pulseTicksActive: state.tension.pulseTicksActive,
    isSustainedPulse: state.tension.isSustainedPulse,
    isEscalating: state.tension.isEscalating,
    sortedQueue: state.tension.sortedQueue,
    lastArrivedEntry: state.tension.lastArrivedEntry,
    lastExpiredEntry: state.tension.lastExpiredEntry,
    currentTick: state.tension.currentTick,
    isRunActive: state.tension.isRunActive,
  })),
);

  return useMemo<UseTensionEngineResult>(() => {
    const score = clamp01(tension.score);
    const scoreHistory = Object.freeze([...tension.scoreHistory]);
    const visibilityState = tension.visibilityState;
    const visibilityConfig = resolveVisibilityConfig(visibilityState);
    const queueLength = safeInt(tension.queueLength, 0);
    const arrivedCount = safeInt(tension.arrivedCount, 0);
    const queuedCount = safeInt(tension.queuedCount, 0);
    const expiredCount = safeInt(tension.expiredCount, 0);
    const currentTick = safeInt(tension.currentTick, 0);

    const sortedQueue = Object.freeze([...tension.sortedQueue]);
    const dominantEntry = sortedQueue[0] ?? null;
    const nextQueuedEntry = resolveNextQueuedEntry(sortedQueue);
    const nextThreatEta =
      nextQueuedEntry === null
        ? null
        : Math.max(0, nextQueuedEntry.arrivalTick - currentTick);

    const activeThreatCount = queueLength;
    const unresolvedThreatCount = queueLength + expiredCount;
    const totalObservedThreatCount = arrivedCount + queuedCount + expiredCount;
    const queuePressurePct = clamp01(Math.min(1, queueLength / 12));
    const soonestArrivalTick = nextQueuedEntry?.arrivalTick ?? null;

    return {
      score,
      scorePct: score * 100,
      scoreHistory,

      tensionBand: resolveTensionBand(score),
      trend: resolveTrend(scoreHistory),

      visibilityState,
      previousVisibilityState: tension.previousVisibilityState ?? null,
      visibilityConfig,

      queueLength,
      arrivedCount,
      queuedCount,
      expiredCount,

      activeThreatCount,
      unresolvedThreatCount,
      totalObservedThreatCount,
      queuePressurePct,
      hasThreats: queueLength > 0,
      hasQueuedThreats: queuedCount > 0,
      hasArrivedThreats: arrivedCount > 0,
      hasExpiredThreats: expiredCount > 0,

      isPulseActive: Boolean(tension.isPulseActive),
      pulseTicksActive: safeInt(tension.pulseTicksActive, 0),
      isSustainedPulse: Boolean(tension.isSustainedPulse),
      isNearPulse:
        score >= TENSION_CONSTANTS.PULSE_THRESHOLD - 0.1 &&
        score < TENSION_CONSTANTS.PULSE_THRESHOLD,
      isEscalating: Boolean(tension.isEscalating),
      isRunActive: Boolean(tension.isRunActive),

      currentTick,
      threatUrgency: resolveThreatUrgency(
        score,
        queueLength,
        arrivedCount,
        Boolean(tension.isPulseActive),
      ),

      sortedQueue,
      dominantEntry,
      nextQueuedEntry,
      nextThreatEta,
      soonestArrivalTick,

      lastArrivedEntry: tension.lastArrivedEntry ?? null,
      lastExpiredEntry: tension.lastExpiredEntry ?? null,

      canSeeThreatTypes: Boolean(visibilityConfig.showsThreatType),
      canSeeArrivalTicks: Boolean(visibilityConfig.showsArrivalTick),
      canSeeMitigationPaths: Boolean(visibilityConfig.showsMitigationPath),
      canSeeWorstCase: Boolean(visibilityConfig.showsWorstCase),
    };
  }, [tension]);
}

export default useTensionEngine;
