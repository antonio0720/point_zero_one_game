/**
 * FILE: pzo-web/src/features/run/hooks/useSeasonClock.ts
 * Engine 1 — SeasonClock React hook
 *
 * Purpose:
 * - expose real-world season timing state to React without importing TimeEngine
 * - tolerate the current repo state shape while being ready for richer season payloads
 * - return neutral defaults when the season manifest has not yet been hydrated
 *
 * Notes:
 * - SeasonClock is wall-clock driven, not tick driven
 * - this hook reads from engineStore only
 * - when richer fields are absent from the store, it safely falls back
 */

import { useEffect, useMemo, useState } from 'react';
import { useEngineStore, type EngineStoreState } from '../../../store/engineStore';

export interface SeasonWindowView {
  windowId: string;
  type: string;
  startsAtMs: number;
  endsAtMs: number;
  pressureMultiplier: number;
  isActive: boolean;
}

interface ExtendedTimeSeasonState {
  seasonId?: string | null;
  seasonStartMs?: number | null;
  seasonEndMs?: number | null;
  seasonPressureMultiplier?: number | null;
  activeSeasonWindowTypes?: readonly string[] | null;
  activeSeasonWindows?: readonly SeasonWindowView[] | null;
}

export interface UseSeasonClockResult {
  seasonId: string | null;
  seasonStartMs: number | null;
  seasonEndMs: number | null;
  nowMs: number;
  isManifestLoaded: boolean;
  isSeasonActive: boolean;
  msUntilSeasonStart: number;
  msUntilSeasonEnd: number;
  seasonProgressPct: number;
  pressureMultiplier: number;
  activeWindows: SeasonWindowView[];
  hasKickoffWindow: boolean;
  hasLiveopsWindow: boolean;
  hasFinaleWindow: boolean;
  hasArchiveCloseWindow: boolean;
  hasReengageWindow: boolean;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeWindows(
  rawWindows: readonly SeasonWindowView[] | null | undefined,
  nowMs: number,
): SeasonWindowView[] {
  if (!rawWindows || rawWindows.length === 0) return [];

  return rawWindows
    .map((window) => ({
      windowId: String(window.windowId),
      type: String(window.type),
      startsAtMs: Number(window.startsAtMs),
      endsAtMs: Number(window.endsAtMs),
      pressureMultiplier:
        typeof window.pressureMultiplier === 'number' && Number.isFinite(window.pressureMultiplier)
          ? window.pressureMultiplier
          : 1.0,
      isActive: nowMs >= Number(window.startsAtMs) && nowMs <= Number(window.endsAtMs),
    }))
    .filter(
      (window) =>
        Number.isFinite(window.startsAtMs) &&
        Number.isFinite(window.endsAtMs) &&
        window.endsAtMs >= window.startsAtMs,
    )
    .sort((a, b) => a.startsAtMs - b.startsAtMs);
}

function product(values: readonly number[]): number {
  return values.reduce((acc, value) => acc * value, 1.0);
}

export function useSeasonClock(): UseSeasonClockResult {
  const timeSlice = useEngineStore((state: EngineStoreState) => state.time) as EngineStoreState['time'] &
    ExtendedTimeSeasonState;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const seasonStartMs = asFiniteNumber(timeSlice.seasonStartMs);
  const seasonEndMs = asFiniteNumber(timeSlice.seasonEndMs);

  useEffect(() => {
    const shouldTick =
      seasonStartMs !== null ||
      seasonEndMs !== null ||
      (Array.isArray(timeSlice.activeSeasonWindows) && timeSlice.activeSeasonWindows.length > 0);

    if (!shouldTick) return;

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [seasonStartMs, seasonEndMs, timeSlice.activeSeasonWindows]);

  const activeWindows = useMemo(
    () => normalizeWindows(timeSlice.activeSeasonWindows, nowMs).filter((window) => window.isActive),
    [timeSlice.activeSeasonWindows, nowMs],
  );

  const isManifestLoaded = seasonStartMs !== null || seasonEndMs !== null || activeWindows.length > 0;
  const isSeasonActive =
    seasonStartMs !== null && seasonEndMs !== null ? nowMs >= seasonStartMs && nowMs <= seasonEndMs : false;

  const msUntilSeasonStart =
    seasonStartMs === null ? Number.POSITIVE_INFINITY : Math.max(0, seasonStartMs - nowMs);

  const msUntilSeasonEnd =
    seasonEndMs === null ? Number.POSITIVE_INFINITY : Math.max(0, seasonEndMs - nowMs);

  const seasonProgressPct =
    seasonStartMs !== null && seasonEndMs !== null && seasonEndMs > seasonStartMs
      ? clamp01((nowMs - seasonStartMs) / (seasonEndMs - seasonStartMs))
      : 0;

  const derivedPressureMultiplier = product(activeWindows.map((window) => window.pressureMultiplier));
  const pressureMultiplier =
    asFiniteNumber(timeSlice.seasonPressureMultiplier) ?? derivedPressureMultiplier ?? 1.0;

  const activeTypes = new Set(
    activeWindows.map((window) => window.type).concat(
      Array.isArray(timeSlice.activeSeasonWindowTypes)
        ? timeSlice.activeSeasonWindowTypes.filter((value): value is string => typeof value === 'string')
        : [],
    ),
  );

  return {
    seasonId: asString(timeSlice.seasonId),
    seasonStartMs,
    seasonEndMs,
    nowMs,
    isManifestLoaded,
    isSeasonActive,
    msUntilSeasonStart,
    msUntilSeasonEnd,
    seasonProgressPct,
    pressureMultiplier,
    activeWindows,
    hasKickoffWindow: activeTypes.has('KICKOFF'),
    hasLiveopsWindow: activeTypes.has('LIVEOPS_EVENT'),
    hasFinaleWindow: activeTypes.has('SEASON_FINALE'),
    hasArchiveCloseWindow: activeTypes.has('ARCHIVE_CLOSE'),
    hasReengageWindow: activeTypes.has('REENGAGE_WINDOW'),
  };
}