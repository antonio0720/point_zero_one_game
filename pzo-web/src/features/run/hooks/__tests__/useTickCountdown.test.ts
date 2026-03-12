// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useTickCountdown.ts

/**
 * FILE: pzo-web/src/features/run/hooks/useTickCountdown.ts
 * POINT ZERO ONE — ENGINE 1 TICK COUNTDOWN HOOK
 *
 * Purpose:
 * - provide a repo-native countdown utility for Tick UI surfaces
 * - expose pure helpers that can be consumed by tests and components
 * - avoid importing TimeEngine directly
 * - tolerate SSR / test environments cleanly
 *
 * Notes:
 * - this hook is wall-clock driven
 * - it does not mutate the store
 * - it can be used for next-tick countdowns, timeout warnings, or other run timers
 */

import { useEffect, useMemo, useState } from 'react';

export type CountdownSeverity = 'safe' | 'warning' | 'critical' | 'expired';

export interface TickCountdownSnapshot {
  remainingMs: number;
  progressPct: number;
  severity: CountdownSeverity;
  formatted: string;
  isExpired: boolean;
}

export interface UseTickCountdownOptions {
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

export function buildTickCountdownSnapshot(args: {
  readonly startedAtMs: number;
  readonly nowMs: number;
  readonly durationMs: number;
  readonly warningAtMs?: number;
  readonly criticalAtMs?: number;
}): TickCountdownSnapshot {
  const safeDurationMs = normalizeDurationMs(args.durationMs);
  const elapsedMs = Math.max(0, args.nowMs - args.startedAtMs);
  const remainingMs = Math.max(0, safeDurationMs - elapsedMs);

  return {
    remainingMs,
    progressPct: clamp01(elapsedMs / safeDurationMs),
    severity: getTickCountdownSeverity(
      remainingMs,
      args.warningAtMs,
      args.criticalAtMs,
    ),
    formatted: formatTickCountdown(remainingMs),
    isExpired: remainingMs <= 0,
  };
}

export function useTickCountdown(
  options: UseTickCountdownOptions,
): TickCountdownSnapshot {
  const {
    startedAtMs,
    durationMs,
    warningAtMs = 20_000,
    criticalAtMs = 10_000,
    enabled = true,
    updateIntervalMs = 100,
    nowMs = null,
  } = options;

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

    const safeIntervalMs =
      Number.isFinite(updateIntervalMs) && updateIntervalMs > 0
        ? Math.max(16, Math.round(updateIntervalMs))
        : 100;

    const intervalId = window.setInterval(() => {
      setInternalNowMs(Date.now());
    }, safeIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, nowMs, startedAtMs, updateIntervalMs]);

  return useMemo<TickCountdownSnapshot>(() => {
    const effectiveNowMs =
      typeof nowMs === 'number' && Number.isFinite(nowMs)
        ? nowMs
        : internalNowMs;

    if (!enabled || startedAtMs === null) {
      const safeDurationMs = normalizeDurationMs(durationMs);
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
      durationMs,
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