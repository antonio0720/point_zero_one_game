// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useTickCountdown.ts

/**
 * FILE: pzo-web/src/features/run/hooks/useTickCountdown.ts
 * Density6 LLC · Point Zero One · Engine 1 — Time Engine · Confidential
 *
 * Purpose:
 * - provide a repo-native countdown utility for Time Engine UI surfaces
 * - expose pure helpers that tests can bind to directly
 * - support wall-clock driven countdown snapshots without importing TimeEngine
 * - remain deterministic under fake timers
 */

import { useEffect, useMemo, useState } from 'react';

export type CountdownSeverity = 'safe' | 'warning' | 'critical' | 'expired';

export interface CountdownSnapshot {
  remainingMs: number;
  progressPct: number;
  severity: CountdownSeverity;
  formatted: string;
  isExpired: boolean;
}

export interface BuildTickCountdownSnapshotArgs {
  readonly startedAtMs: number;
  readonly nowMs: number;
  readonly durationMs: number;
  readonly warningAtMs?: number;
  readonly criticalAtMs?: number;
}

export interface UseTickCountdownArgs {
  readonly startedAtMs: number | null;
  readonly durationMs: number;
  readonly warningAtMs?: number;
  readonly criticalAtMs?: number;
  readonly enabled?: boolean;
  readonly updateIntervalMs?: number;
  readonly nowMs?: number | null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return value;
}

export function formatTickCountdown(remainingMs: number): string {
  const safeRemainingMs =
    typeof remainingMs === 'number' && Number.isFinite(remainingMs)
      ? Math.max(0, remainingMs)
      : 0;

  const totalSeconds = safeRemainingMs / 1000;

  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (totalSeconds >= 10) {
    return `${Math.ceil(totalSeconds)}`;
  }

  return totalSeconds.toFixed(1);
}

export function getTickCountdownSeverity(
  remainingMs: number,
  warningAtMs = 20_000,
  criticalAtMs = 10_000,
): CountdownSeverity {
  const safeRemainingMs =
    typeof remainingMs === 'number' && Number.isFinite(remainingMs)
      ? Math.max(0, remainingMs)
      : 0;

  if (safeRemainingMs <= 0) return 'expired';
  if (safeRemainingMs <= criticalAtMs) return 'critical';
  if (safeRemainingMs <= warningAtMs) return 'warning';
  return 'safe';
}

export function buildTickCountdownSnapshot(
  args: BuildTickCountdownSnapshotArgs,
): CountdownSnapshot {
  const durationMs = normalizeDurationMs(args.durationMs);
  const elapsedMs = Math.max(0, args.nowMs - args.startedAtMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const progressPct = clamp01(elapsedMs / durationMs);

  return {
    remainingMs,
    progressPct,
    severity: getTickCountdownSeverity(
      remainingMs,
      args.warningAtMs,
      args.criticalAtMs,
    ),
    formatted: formatTickCountdown(remainingMs),
    isExpired: remainingMs <= 0,
  };
}

export function useTickCountdown(args: UseTickCountdownArgs): CountdownSnapshot {
  const {
    startedAtMs,
    durationMs,
    warningAtMs = 20_000,
    criticalAtMs = 10_000,
    enabled = true,
    updateIntervalMs = 100,
    nowMs = null,
  } = args;

  const [internalNowMs, setInternalNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (
      !enabled ||
      startedAtMs === null ||
      nowMs !== null ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const safeUpdateIntervalMs =
      Number.isFinite(updateIntervalMs) && updateIntervalMs > 0
        ? Math.max(16, Math.round(updateIntervalMs))
        : 100;

    const intervalId = window.setInterval(() => {
      setInternalNowMs(Date.now());
    }, safeUpdateIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, nowMs, startedAtMs, updateIntervalMs]);

  return useMemo<CountdownSnapshot>(() => {
    const safeDurationMs = normalizeDurationMs(durationMs);
    const effectiveNowMs =
      typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : internalNowMs;

    if (!enabled || startedAtMs === null) {
      return {
        remainingMs: safeDurationMs,
        progressPct: 0,
        severity: getTickCountdownSeverity(
          safeDurationMs,
          warningAtMs,
          criticalAtMs,
        ),
        formatted: formatTickCountdown(safeDurationMs),
        isExpired: false,
      };
    }

    return buildTickCountdownSnapshot({
      startedAtMs,
      nowMs: effectiveNowMs,
      durationMs: safeDurationMs,
      warningAtMs,
      criticalAtMs,
    });
  }, [
    criticalAtMs,
    durationMs,
    enabled,
    internalNowMs,
    nowMs,
    startedAtMs,
    warningAtMs,
  ]);
}

export default useTickCountdown;