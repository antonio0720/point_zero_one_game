// backend/src/game/engine/time/__tests__/SeasonClock.test.ts
import { describe, expect, it } from 'vitest';

import { SeasonClock } from '../SeasonClock';

function createManifest(): any {
  return {
    seasonId: 'season_001',
    metadata: {
      chapter: 'founding-era',
      archived: false,
    },
    startMs: 1_000,
    endMs: 10_000,
    windows: [
      {
        windowId: 'window_kickoff',
        type: 'KICKOFF',
        startsAtMs: 1_000,
        endsAtMs: 3_000,
        isActive: false,
        pressureMultiplier: 1.1,
      },
      {
        windowId: 'window_liveops',
        type: 'LIVEOPS_EVENT',
        startsAtMs: 2_000,
        endsAtMs: 4_000,
        isActive: false,
        pressureMultiplier: 1.2,
      },
      {
        windowId: 'window_finale',
        type: 'SEASON_FINALE',
        startsAtMs: 8_000,
        endsAtMs: 10_000,
        isActive: false,
        pressureMultiplier: 1.3,
      },
    ],
  };
}

describe('backend time/SeasonClock', () => {
  it('returns safe defaults before any season manifest is loaded', () => {
    const clock = new SeasonClock();

    expect(clock.hasManifest()).toBe(false);
    expect(clock.getSeasonId()).toBeNull();
    expect(clock.isSeasonActive(5_000)).toBe(false);
    expect(clock.getActiveWindows(5_000)).toEqual([]);
    expect(clock.getPressureMultiplier(5_000)).toBe(1);
  });

  it('loads a manifest and resolves season identity plus active windows', () => {
    const clock = new SeasonClock();
    clock.loadSeasonManifest(createManifest());

    expect(clock.hasManifest()).toBe(true);
    expect(clock.getSeasonId()).toBe('season_001');
    expect(clock.isSeasonActive(2_500)).toBe(true);

    const activeWindowIds = clock
      .getActiveWindows(2_500)
      .map((window: any) => window.windowId);

    expect(activeWindowIds).toEqual(['window_kickoff', 'window_liveops']);
  });

  it('multiplies overlapping pressure windows instead of adding them', () => {
    const clock = new SeasonClock();
    clock.loadSeasonManifest(createManifest());

    expect(clock.getPressureMultiplier(2_500)).toBeCloseTo(1.32, 2);
    expect(clock.hasWindowType('LIVEOPS_EVENT' as any, 2_500)).toBe(true);
    expect(clock.hasWindowType('SEASON_FINALE' as any, 2_500)).toBe(false);
  });

  it('reports the next upcoming window and remaining season timing accurately', () => {
    const clock = new SeasonClock();
    clock.loadSeasonManifest(createManifest());

    expect(clock.getMsUntilSeasonStart(0)).toBe(1_000);
    expect(clock.getMsUntilSeasonEnd(2_500)).toBe(7_500);
    expect(clock.getNextWindow(0)?.windowId).toBe('window_kickoff');
    expect(clock.getNextWindow(3_500, 'SEASON_FINALE' as any)?.windowId).toBe('window_finale');
  });

  it('resets all loaded season state deterministically', () => {
    const clock = new SeasonClock();
    clock.loadSeasonManifest(createManifest());
    clock.reset();

    expect(clock.hasManifest()).toBe(false);
    expect(clock.getSeasonId()).toBeNull();
    expect(clock.getAllWindows()).toEqual([]);
    expect(clock.getPressureMultiplier(9_000)).toBe(1);
  });
});