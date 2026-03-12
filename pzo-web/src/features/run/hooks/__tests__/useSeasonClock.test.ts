/**
 * FILE: pzo-web/src/features/run/hooks/__tests__/useSeasonClock.test.ts
 * Engine 1 — Time Engine
 *
 * Contract coverage:
 * - neutral defaults when no season manifest is hydrated
 * - active window normalization, sorting, and multiplicative pressure
 * - explicit pressure override from store when present
 * - live wall-clock refresh via interval when season timing exists
 */

import { act, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useEngineStoreMock = vi.fn();

vi.mock('../../../store/engineStore', () => {
  return {
    useEngineStore: (selector: (state: unknown) => unknown) => useEngineStoreMock(selector),
  };
});

import { useSeasonClock } from '../useSeasonClock';

interface MockSeasonWindow {
  windowId: string;
  type: string;
  startsAtMs: number;
  endsAtMs: number;
  pressureMultiplier: number;
  isActive?: boolean;
}

interface MockTimeSlice {
  seasonId?: string | null;
  seasonStartMs?: number | null;
  seasonEndMs?: number | null;
  seasonPressureMultiplier?: number | null;
  activeSeasonWindowTypes?: readonly string[] | null;
  activeSeasonWindows?: readonly MockSeasonWindow[] | null;
}

interface MockEngineStoreState {
  time: MockTimeSlice;
}

function createStoreState(time: MockTimeSlice = {}): MockEngineStoreState {
  return {
    time,
  };
}

describe('useSeasonClock', () => {
  let mockState: MockEngineStoreState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00.000Z'));

    mockState = createStoreState();

    useEngineStoreMock.mockImplementation((selector: (state: MockEngineStoreState) => unknown) => {
      return selector(mockState);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns neutral defaults when no season manifest exists', () => {
    const { result } = renderHook(() => useSeasonClock());

    expect(result.current.seasonId).toBeNull();
    expect(result.current.seasonStartMs).toBeNull();
    expect(result.current.seasonEndMs).toBeNull();
    expect(result.current.isManifestLoaded).toBe(false);
    expect(result.current.isSeasonActive).toBe(false);
    expect(result.current.msUntilSeasonStart).toBe(Number.POSITIVE_INFINITY);
    expect(result.current.msUntilSeasonEnd).toBe(Number.POSITIVE_INFINITY);
    expect(result.current.seasonProgressPct).toBe(0);
    expect(result.current.pressureMultiplier).toBe(1.0);
    expect(result.current.activeWindows).toEqual([]);
    expect(result.current.hasKickoffWindow).toBe(false);
    expect(result.current.hasLiveopsWindow).toBe(false);
    expect(result.current.hasFinaleWindow).toBe(false);
    expect(result.current.hasArchiveCloseWindow).toBe(false);
    expect(result.current.hasReengageWindow).toBe(false);
  });

  it('normalizes active windows, sorts them, and multiplies pressure across overlapping windows', () => {
    const nowMs = Date.now();

    mockState = createStoreState({
      seasonId: 'season-7',
      seasonStartMs: nowMs - 60_000,
      seasonEndMs: nowMs + 3_600_000,
      activeSeasonWindowTypes: ['REENGAGE_WINDOW'],
      activeSeasonWindows: [
        {
          windowId: 'w-late',
          type: 'LIVEOPS_EVENT',
          startsAtMs: nowMs - 5_000,
          endsAtMs: nowMs + 50_000,
          pressureMultiplier: 1.1,
        },
        {
          windowId: 'w-invalid',
          type: 'ARCHIVE_CLOSE',
          startsAtMs: nowMs + 2_000,
          endsAtMs: nowMs - 2_000,
          pressureMultiplier: 4.0,
        },
        {
          windowId: 'w-early',
          type: 'SEASON_FINALE',
          startsAtMs: nowMs - 10_000,
          endsAtMs: nowMs + 10_000,
          pressureMultiplier: 1.3,
        },
        {
          windowId: 'w-inactive',
          type: 'KICKOFF',
          startsAtMs: nowMs + 15_000,
          endsAtMs: nowMs + 30_000,
          pressureMultiplier: 2.0,
        },
      ],
    });

    useEngineStoreMock.mockImplementation((selector: (state: MockEngineStoreState) => unknown) => {
      return selector(mockState);
    });

    const { result } = renderHook(() => useSeasonClock());

    expect(result.current.seasonId).toBe('season-7');
    expect(result.current.isManifestLoaded).toBe(true);
    expect(result.current.isSeasonActive).toBe(true);
    expect(result.current.activeWindows).toHaveLength(2);
    expect(result.current.activeWindows.map((window) => window.windowId)).toEqual(['w-early', 'w-late']);
    expect(result.current.pressureMultiplier).toBeCloseTo(1.43, 6);
    expect(result.current.hasFinaleWindow).toBe(true);
    expect(result.current.hasLiveopsWindow).toBe(true);
    expect(result.current.hasReengageWindow).toBe(true);
    expect(result.current.hasKickoffWindow).toBe(false);
    expect(result.current.hasArchiveCloseWindow).toBe(false);
    expect(result.current.seasonProgressPct).toBeGreaterThan(0);
    expect(result.current.seasonProgressPct).toBeLessThan(1);
  });

  it('prefers explicit seasonPressureMultiplier from store when it is finite', () => {
    const nowMs = Date.now();

    mockState = createStoreState({
      seasonId: 'season-override',
      seasonStartMs: nowMs - 1_000,
      seasonEndMs: nowMs + 10_000,
      seasonPressureMultiplier: 1.9,
      activeSeasonWindows: [
        {
          windowId: 'w1',
          type: 'SEASON_FINALE',
          startsAtMs: nowMs - 500,
          endsAtMs: nowMs + 500,
          pressureMultiplier: 1.3,
        },
        {
          windowId: 'w2',
          type: 'LIVEOPS_EVENT',
          startsAtMs: nowMs - 500,
          endsAtMs: nowMs + 500,
          pressureMultiplier: 1.1,
        },
      ],
    });

    useEngineStoreMock.mockImplementation((selector: (state: MockEngineStoreState) => unknown) => {
      return selector(mockState);
    });

    const { result } = renderHook(() => useSeasonClock());

    expect(result.current.pressureMultiplier).toBe(1.9);
    expect(result.current.activeWindows).toHaveLength(2);
  });

  it('refreshes nowMs over time when season timing is present', () => {
    const initialNow = Date.now();

    mockState = createStoreState({
      seasonId: 'season-live',
      seasonStartMs: initialNow - 30_000,
      seasonEndMs: initialNow + 30_000,
      activeSeasonWindows: [],
    });

    useEngineStoreMock.mockImplementation((selector: (state: MockEngineStoreState) => unknown) => {
      return selector(mockState);
    });

    const { result } = renderHook(() => useSeasonClock());

    expect(result.current.nowMs).toBe(initialNow);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(result.current.nowMs).toBe(initialNow + 2_000);
    expect(result.current.msUntilSeasonEnd).toBe(28_000);
  });
});