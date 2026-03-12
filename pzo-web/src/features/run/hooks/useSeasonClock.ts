// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useSeasonClock.ts

/**
 * FILE: pzo-web/src/features/run/hooks/useSeasonClock.ts
 * POINT ZERO ONE — ENGINE 1 SEASON CLOCK HOOK
 *
 * Purpose:
 * - expose real-world season timing state to React without importing TimeEngine
 * - stay faithful to the live engineStore contract while tolerating partial season hydration
 * - return stable, neutral defaults when season manifest fields are not yet present
 * - preserve compatibility with richer future season payloads
 *
 * Notes:
 * - SeasonClock is wall-clock driven, not tick driven
 * - this hook reads from engineStore only
 * - it never mutates store state
 * - it is SSR-safe
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

function asPositiveFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeWindowType(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeWindows(
  rawWindows: readonly SeasonWindowView[] | null | undefined,
  nowMs: number,
): SeasonWindowView[] {
  if (!Array.isArray(rawWindows) || rawWindows.length === 0) {
    return [];
  }

  return rawWindows
    .map((window) => {
      const startsAtMs = Number(window.startsAtMs);
      const endsAtMs = Number(window.endsAtMs);
      const type = normalizeWindowType(window.type) ?? 'UNKNOWN';

      return {
        windowId: String(window.windowId),
        type,
        startsAtMs,
        endsAtMs,
        pressureMultiplier:
          typeof window.pressureMultiplier === 'number' && Number.isFinite(window.pressureMultiplier)
            ? Math.max(0, window.pressureMultiplier)
            : 1.0,
        isActive: Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs)
          ? nowMs >= startsAtMs && nowMs <= endsAtMs
          : false,
      } satisfies SeasonWindowView;
    })
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

function buildActiveTypeSet(
  activeWindows: readonly SeasonWindowView[],
  fallbackTypes: readonly string[] | null | undefined,
): Set<string> {
  const activeTypes = new Set<string>();

  for (const window of activeWindows) {
    const normalized = normalizeWindowType(window.type);

    if (normalized !== null) {
      activeTypes.add(normalized);
    }
  }

  if (Array.isArray(fallbackTypes)) {
    for (const value of fallbackTypes) {
      const normalized = normalizeWindowType(value);

      if (normalized !== null) {
        activeTypes.add(normalized);
      }
    }
  }

  return activeTypes;
}

export function useSeasonClock(): UseSeasonClockResult {
  const timeSlice = useEngineStore(
    (state: EngineStoreState) => state.time,
  ) as EngineStoreState['time'] & ExtendedTimeSeasonState;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const seasonId = asString(timeSlice.seasonId);
  const seasonStartMs = asFiniteNumber(timeSlice.seasonStartMs);
  const seasonEndMs = asFiniteNumber(timeSlice.seasonEndMs);

  const normalizedWindows = useMemo(
    () => normalizeWindows(timeSlice.activeSeasonWindows, nowMs),
    [timeSlice.activeSeasonWindows, nowMs],
  );

  const activeWindows = useMemo(
    () => normalizedWindows.filter((window) => window.isActive),
    [normalizedWindows],
  );

  const activeTypes = useMemo(
    () => buildActiveTypeSet(activeWindows, timeSlice.activeSeasonWindowTypes),
    [activeWindows, timeSlice.activeSeasonWindowTypes],
  );

  const isManifestLoaded =
    seasonId !== null ||
    seasonStartMs !== null ||
    seasonEndMs !== null ||
    normalizedWindows.length > 0 ||
    activeTypes.size > 0;

  useEffect(() => {
    if (!isManifestLoaded || typeof window === 'undefined') {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isManifestLoaded]);

  const isSeasonActive =
    seasonStartMs !== null && seasonEndMs !== null
      ? nowMs >= seasonStartMs && nowMs <= seasonEndMs
      : activeWindows.length > 0 || activeTypes.size > 0;

  const msUntilSeasonStart =
    seasonStartMs === null ? Number.POSITIVE_INFINITY : Math.max(0, seasonStartMs - nowMs);

  const msUntilSeasonEnd =
    seasonEndMs === null ? Number.POSITIVE_INFINITY : Math.max(0, seasonEndMs - nowMs);

  const seasonProgressPct =
    seasonStartMs !== null && seasonEndMs !== null && seasonEndMs > seasonStartMs
      ? clamp01((nowMs - seasonStartMs) / (seasonEndMs - seasonStartMs))
      : 0;

  const derivedPressureMultiplier = product(
    activeWindows.map((window) => window.pressureMultiplier),
  );

  const pressureMultiplier =
    asPositiveFiniteNumber(timeSlice.seasonPressureMultiplier) ??
    derivedPressureMultiplier ??
    1.0;

  return {
    seasonId,
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

export default useSeasonClock;