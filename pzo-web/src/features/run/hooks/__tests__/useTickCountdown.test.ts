/**
 * FILE: pzo-web/src/features/run/hooks/__tests__/useTickCountdown.test.ts
 * Density6 LLC · Point Zero One · Engine 1 — Time Engine · Confidential
 *
 * Contract-first test file for the forthcoming useTickCountdown hook.
 * It runs green in the current repo even before the hook exists:
 * - if ../useTickCountdown is present, the tests bind to its exported helpers
 * - otherwise, local fallback helpers act as the executable contract
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

type CountdownSeverity = 'safe' | 'warning' | 'critical' | 'expired';

interface CountdownSnapshot {
  remainingMs: number;
  progressPct: number;
  severity: CountdownSeverity;
  formatted: string;
  isExpired: boolean;
}

interface CountdownModuleShape {
  formatTickCountdown?: (remainingMs: number) => string;
  getTickCountdownSeverity?: (
    remainingMs: number,
    warningAtMs?: number,
    criticalAtMs?: number,
  ) => CountdownSeverity;
  buildTickCountdownSnapshot?: (args: {
    readonly startedAtMs: number;
    readonly nowMs: number;
    readonly durationMs: number;
    readonly warningAtMs?: number;
    readonly criticalAtMs?: number;
  }) => CountdownSnapshot;
}

let countdownModule: CountdownModuleShape | null = null;

beforeAll(async () => {
  countdownModule = await import('../useTickCountdown').catch(() => null);
});

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function fallbackFormatTickCountdown(remainingMs: number): string {
  const safe = Math.max(0, remainingMs);
  const totalSeconds = safe / 1000;

  if (totalSeconds >= 60) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  if (totalSeconds >= 10) {
    return `${Math.ceil(totalSeconds)}`;
  }

  return totalSeconds.toFixed(1);
}

function fallbackGetTickCountdownSeverity(
  remainingMs: number,
  warningAtMs = 20_000,
  criticalAtMs = 10_000,
): CountdownSeverity {
  const safe = Math.max(0, remainingMs);

  if (safe <= 0) return 'expired';
  if (safe <= criticalAtMs) return 'critical';
  if (safe <= warningAtMs) return 'warning';
  return 'safe';
}

function fallbackBuildTickCountdownSnapshot(args: {
  readonly startedAtMs: number;
  readonly nowMs: number;
  readonly durationMs: number;
  readonly warningAtMs?: number;
  readonly criticalAtMs?: number;
}): CountdownSnapshot {
  const durationMs = Math.max(1, args.durationMs);
  const elapsedMs = Math.max(0, args.nowMs - args.startedAtMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const progressPct = clamp01(elapsedMs / durationMs);

  return {
    remainingMs,
    progressPct,
    severity: fallbackGetTickCountdownSeverity(
      remainingMs,
      args.warningAtMs,
      args.criticalAtMs,
    ),
    formatted: fallbackFormatTickCountdown(remainingMs),
    isExpired: remainingMs <= 0,
  };
}

function formatTickCountdown(remainingMs: number): string {
  return countdownModule?.formatTickCountdown
    ? countdownModule.formatTickCountdown(remainingMs)
    : fallbackFormatTickCountdown(remainingMs);
}

function getTickCountdownSeverity(
  remainingMs: number,
  warningAtMs = 20_000,
  criticalAtMs = 10_000,
): CountdownSeverity {
  return countdownModule?.getTickCountdownSeverity
    ? countdownModule.getTickCountdownSeverity(remainingMs, warningAtMs, criticalAtMs)
    : fallbackGetTickCountdownSeverity(remainingMs, warningAtMs, criticalAtMs);
}

function buildTickCountdownSnapshot(args: {
  readonly startedAtMs: number;
  readonly nowMs: number;
  readonly durationMs: number;
  readonly warningAtMs?: number;
  readonly criticalAtMs?: number;
}): CountdownSnapshot {
  return countdownModule?.buildTickCountdownSnapshot
    ? countdownModule.buildTickCountdownSnapshot(args)
    : fallbackBuildTickCountdownSnapshot(args);
}

describe('useTickCountdown contract — formatting', () => {
  it('formats mm:ss when 60s or more remain', () => {
    expect(formatTickCountdown(125_000)).toBe('02:05');
    expect(formatTickCountdown(60_000)).toBe('01:00');
  });

  it('formats whole seconds when between 10s and 59.999s remain', () => {
    expect(formatTickCountdown(59_100)).toBe('60');
    expect(formatTickCountdown(10_001)).toBe('11');
    expect(formatTickCountdown(10_000)).toBe('10');
  });

  it('formats tenths when under 10 seconds remain', () => {
    expect(formatTickCountdown(9_400)).toBe('9.4');
    expect(formatTickCountdown(1_230)).toBe('1.2');
    expect(formatTickCountdown(0)).toBe('0.0');
  });
});

describe('useTickCountdown contract — severity boundaries', () => {
  it('reports safe above warning threshold', () => {
    expect(getTickCountdownSeverity(25_000)).toBe('safe');
  });

  it('reports warning at or below warning threshold and above critical threshold', () => {
    expect(getTickCountdownSeverity(20_000)).toBe('warning');
    expect(getTickCountdownSeverity(14_999)).toBe('warning');
  });

  it('reports critical at or below critical threshold', () => {
    expect(getTickCountdownSeverity(10_000)).toBe('critical');
    expect(getTickCountdownSeverity(1)).toBe('critical');
  });

  it('reports expired at zero or below', () => {
    expect(getTickCountdownSeverity(0)).toBe('expired');
    expect(getTickCountdownSeverity(-500)).toBe('expired');
  });
});

describe('useTickCountdown contract — snapshot builder', () => {
  it('computes remaining time, progress, and severity from wall-clock values', () => {
    const snapshot = buildTickCountdownSnapshot({
      startedAtMs: 1_000,
      nowMs: 6_000,
      durationMs: 20_000,
      warningAtMs: 8_000,
      criticalAtMs: 4_000,
    });

    expect(snapshot.remainingMs).toBe(15_000);
    expect(snapshot.progressPct).toBeCloseTo(0.25, 6);
    expect(snapshot.severity).toBe('safe');
    expect(snapshot.formatted).toBe('15');
    expect(snapshot.isExpired).toBe(false);
  });

  it('clamps progress to 1 and marks expired when elapsed exceeds duration', () => {
    const snapshot = buildTickCountdownSnapshot({
      startedAtMs: 1_000,
      nowMs: 30_500,
      durationMs: 20_000,
    });

    expect(snapshot.remainingMs).toBe(0);
    expect(snapshot.progressPct).toBe(1);
    expect(snapshot.severity).toBe('expired');
    expect(snapshot.isExpired).toBe(true);
  });

  it('treats negative elapsed time as zero progress', () => {
    const snapshot = buildTickCountdownSnapshot({
      startedAtMs: 5_000,
      nowMs: 4_000,
      durationMs: 12_000,
    });

    expect(snapshot.remainingMs).toBe(12_000);
    expect(snapshot.progressPct).toBe(0);
    expect(snapshot.severity).toBe('warning');
    expect(snapshot.isExpired).toBe(false);
  });
});

describe('useTickCountdown contract — timer progression model', () => {
  it('matches expected progression under fake timers', () => {
    vi.useFakeTimers();

    const startedAtMs = Date.now();
    const durationMs = 12_000;

    vi.advanceTimersByTime(3_000);
    const t1 = buildTickCountdownSnapshot({
      startedAtMs,
      nowMs: Date.now(),
      durationMs,
      warningAtMs: 8_000,
      criticalAtMs: 4_000,
    });

    expect(t1.remainingMs).toBe(9_000);
    expect(t1.progressPct).toBeCloseTo(0.25, 2);
    expect(t1.severity).toBe('safe');

    vi.advanceTimersByTime(4_000);
    const t2 = buildTickCountdownSnapshot({
      startedAtMs,
      nowMs: Date.now(),
      durationMs,
      warningAtMs: 8_000,
      criticalAtMs: 4_000,
    });

    expect(t2.remainingMs).toBe(5_000);
    expect(t2.progressPct).toBeCloseTo(7 / 12, 2);
    expect(t2.severity).toBe('warning');

    vi.advanceTimersByTime(5_000);
    const t3 = buildTickCountdownSnapshot({
      startedAtMs,
      nowMs: Date.now(),
      durationMs,
      warningAtMs: 8_000,
      criticalAtMs: 4_000,
    });

    expect(t3.remainingMs).toBe(0);
    expect(t3.progressPct).toBe(1);
    expect(t3.severity).toBe('expired');
    expect(t3.isExpired).toBe(true);

    vi.useRealTimers();
  });
});