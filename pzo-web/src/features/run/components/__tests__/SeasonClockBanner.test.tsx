// FILE: pzo-web/src/features/run/components/__tests__/SeasonClockBanner.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import * as SeasonClockBannerModule from '../SeasonClockBanner';

const SeasonClockBanner =
  ((SeasonClockBannerModule as unknown as Record<string, unknown>).default ??
    (SeasonClockBannerModule as unknown as Record<string, unknown>).SeasonClockBanner) as React.ComponentType<any>;

function pickRoot(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild as HTMLElement | null;
  if (!el) {
    throw new Error('SeasonClockBanner rendered nothing (container.firstElementChild is null).');
  }
  return el;
}

function getBannerEl(container: HTMLElement): HTMLElement {
  return (
    (screen.queryByTestId('season-clock-banner') as HTMLElement | null) ||
    (screen.queryByRole('status') as HTMLElement | null) ||
    pickRoot(container)
  );
}

function renderBanner(overrides: Record<string, unknown> = {}) {
  const seasonSnapshot = {
    seasonId: 'season-07',
    seasonStartMs: Date.now() - 60_000,
    seasonEndMs: Date.now() + 3_600_000,
    nowMs: Date.now(),
    isManifestLoaded: true,
    isSeasonActive: true,
    msUntilSeasonStart: 0,
    msUntilSeasonEnd: 3_600_000,
    seasonProgressPct: 0.42,
    pressureMultiplier: 1.0,
    activeWindows: [],
    hasKickoffWindow: false,
    hasLiveopsWindow: false,
    hasFinaleWindow: false,
    hasArchiveCloseWindow: false,
    hasReengageWindow: false,
    ...overrides,
  };

  return render(<SeasonClockBanner seasonSnapshot={seasonSnapshot} />);
}

describe('SeasonClockBanner', () => {
  it('renders without crashing with a loaded active season', () => {
    const { container } = renderBanner();

    const el = getBannerEl(container as unknown as HTMLElement);

    expect(el).toBeInTheDocument();
    expect((el.textContent ?? '').toLowerCase()).toContain('season');
    expect((el.textContent ?? '').toLowerCase()).toContain('season-07');
  });

  it('surfaces multiplier and active window state when liveops + finale overlap', () => {
    const { container } = renderBanner({
      pressureMultiplier: 1.43,
      hasLiveopsWindow: true,
      hasFinaleWindow: true,
      activeWindows: [
        {
          windowId: 'liveops-1',
          type: 'LIVEOPS_EVENT',
          startsAtMs: Date.now() - 10_000,
          endsAtMs: Date.now() + 50_000,
          pressureMultiplier: 1.1,
        },
        {
          windowId: 'finale-1',
          type: 'SEASON_FINALE',
          startsAtMs: Date.now() - 5_000,
          endsAtMs: Date.now() + 20_000,
          pressureMultiplier: 1.3,
        },
      ],
    });

    const el = getBannerEl(container as unknown as HTMLElement);
    const text = (el.textContent ?? '').toLowerCase();

    expect(text).toContain('1.43');
    expect(text).toContain('liveops');
    expect(text).toContain('finale');
  });

  it('shows an inactive / archive-friendly state when the season is not active', () => {
    const { container } = renderBanner({
      isSeasonActive: false,
      msUntilSeasonStart: 86_400_000,
      msUntilSeasonEnd: 0,
      pressureMultiplier: 1.0,
      activeWindows: [],
    });

    const el = getBannerEl(container as unknown as HTMLElement);
    const text = (el.textContent ?? '').toLowerCase();

    expect(el).toBeInTheDocument();
    expect(text).toContain('season');
    expect(text).toContain('season-07');
  });
});