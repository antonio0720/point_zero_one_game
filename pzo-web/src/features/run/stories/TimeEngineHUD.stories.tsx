// FILE: pzo-web/src/features/run/stories/TimeEngineHUD.stories.tsx

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import TickCountdownDisplay from '../components/TickCountdownDisplay';
import { TickTier } from '../../../engines/time/types';

import * as SeasonClockBannerModule from '../components/SeasonClockBanner';
import * as RunTimeoutWarningModule from '../components/RunTimeoutWarning';

const SeasonClockBanner =
  ((SeasonClockBannerModule as unknown as Record<string, unknown>).default ??
    (SeasonClockBannerModule as unknown as Record<string, unknown>).SeasonClockBanner) as React.ComponentType<any>;

const RunTimeoutWarning =
  ((RunTimeoutWarningModule as unknown as Record<string, unknown>).default ??
    (RunTimeoutWarningModule as unknown as Record<string, unknown>).RunTimeoutWarning) as React.ComponentType<any>;

type TimeEngineHUDStoryProps = {
  readonly tier: TickTier;
  readonly tickSeconds: number;
  readonly ticksElapsed: number;
  readonly ticksRemaining: number;
  readonly holdsRemaining: number;
  readonly seasonId: string;
  readonly seasonActive: boolean;
  readonly seasonProgressPct: number;
  readonly pressureMultiplier: number;
  readonly liveops: boolean;
  readonly finale: boolean;
  readonly reengage: boolean;
  readonly showTimeoutWarning: boolean;
};

function TimeEngineHUDStory({
  tier,
  tickSeconds,
  ticksElapsed,
  ticksRemaining,
  holdsRemaining,
  seasonId,
  seasonActive,
  seasonProgressPct,
  pressureMultiplier,
  liveops,
  finale,
  reengage,
  showTimeoutWarning,
}: TimeEngineHUDStoryProps) {
  const nowMs = Date.now();
  const seasonStartMs = nowMs - 1000 * 60 * 60 * 24 * 3;
  const seasonEndMs = nowMs + 1000 * 60 * 60 * 24 * 5;

  const activeWindows = [
    liveops
      ? {
          windowId: 'story-liveops',
          type: 'LIVEOPS_EVENT',
          startsAtMs: nowMs - 1000 * 60 * 10,
          endsAtMs: nowMs + 1000 * 60 * 40,
          pressureMultiplier: 1.1,
        }
      : null,
    finale
      ? {
          windowId: 'story-finale',
          type: 'SEASON_FINALE',
          startsAtMs: nowMs - 1000 * 60 * 5,
          endsAtMs: nowMs + 1000 * 60 * 20,
          pressureMultiplier: 1.3,
        }
      : null,
    reengage
      ? {
          windowId: 'story-reengage',
          type: 'REENGAGE_WINDOW',
          startsAtMs: nowMs - 1000 * 60 * 15,
          endsAtMs: nowMs + 1000 * 60 * 60,
          pressureMultiplier: 1.05,
        }
      : null,
  ].filter(Boolean);

  const seasonSnapshot = {
    seasonId,
    seasonStartMs,
    seasonEndMs,
    nowMs,
    isManifestLoaded: true,
    isSeasonActive: seasonActive,
    msUntilSeasonStart: seasonActive ? 0 : 1000 * 60 * 60,
    msUntilSeasonEnd: seasonActive ? seasonEndMs - nowMs : 0,
    seasonProgressPct,
    pressureMultiplier,
    activeWindows,
    hasKickoffWindow: false,
    hasLiveopsWindow: liveops,
    hasFinaleWindow: finale,
    hasArchiveCloseWindow: false,
    hasReengageWindow: reengage,
  };

  const timeSnapshot = {
    isRunActive: true,
    currentTier: tier,
    ticksElapsed,
    ticksRemaining,
    tickProgressPct:
      ticksElapsed + ticksRemaining > 0 ? ticksElapsed / (ticksElapsed + ticksRemaining) : 0,
    secondsPerTick: tickSeconds,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, rgba(24,32,48,0.90) 0%, rgba(9,12,18,1) 45%, rgba(5,7,11,1) 100%)',
        color: '#e5edf8',
        padding: 24,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          display: 'grid',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 10,
            padding: 20,
            border: '1px solid rgba(100, 134, 182, 0.25)',
            background: 'rgba(12, 16, 24, 0.82)',
            borderRadius: 14,
            boxShadow: '0 18px 50px rgba(0, 0, 0, 0.30)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#8fa0b8',
                }}
              >
                Point Zero One
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                Time Engine HUD
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(201,168,76,0.35)',
                  background: 'rgba(201,168,76,0.10)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                TIER {tier}
              </span>
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(29,233,182,0.28)',
                  background: 'rgba(29,233,182,0.08)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                HOLDS {holdsRemaining}
              </span>
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(143,160,184,0.25)',
                  background: 'rgba(143,160,184,0.08)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {ticksRemaining} TICKS LEFT
              </span>
            </div>
          </div>
        </div>

        <SeasonClockBanner seasonSnapshot={seasonSnapshot} />

        {showTimeoutWarning ? <RunTimeoutWarning timeSnapshot={timeSnapshot} /> : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1fr) minmax(280px, 360px)',
            gap: 18,
          }}
        >
          <div
            style={{
              padding: 20,
              borderRadius: 14,
              border: '1px solid rgba(100, 134, 182, 0.20)',
              background: 'rgba(12, 16, 24, 0.82)',
              display: 'grid',
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#8fa0b8',
              }}
            >
              Countdown Surface
            </div>

            <div style={{ maxWidth: 420 }}>
              <TickCountdownDisplay
                timeLeft={tickSeconds}
                unit="s"
                label="NEXT TICK"
                onTimeUp={() => undefined}
              />
            </div>
          </div>

          <div
            style={{
              padding: 20,
              borderRadius: 14,
              border: '1px solid rgba(100, 134, 182, 0.20)',
              background: 'rgba(12, 16, 24, 0.82)',
              display: 'grid',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 13,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#8fa0b8',
              }}
            >
              Telemetry Snapshot
            </div>

            <div
              style={{
                display: 'grid',
                gap: 8,
                fontSize: 14,
                color: '#d3deef',
              }}
            >
              <div>Season: {seasonId}</div>
              <div>Pressure Multiplier: {pressureMultiplier.toFixed(2)}x</div>
              <div>Ticks Elapsed: {ticksElapsed}</div>
              <div>Ticks Remaining: {ticksRemaining}</div>
              <div>Season Progress: {(seasonProgressPct * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Run/Time Engine HUD',
  component: TimeEngineHUDStory,
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
  args: {
    tier: TickTier.STABLE,
    tickSeconds: 13,
    ticksElapsed: 184,
    ticksRemaining: 116,
    holdsRemaining: 1,
    seasonId: 'season-07',
    seasonActive: true,
    seasonProgressPct: 0.42,
    pressureMultiplier: 1.0,
    liveops: false,
    finale: false,
    reengage: false,
    showTimeoutWarning: false,
  },
  argTypes: {
    tier: {
      control: 'select',
      options: [
        TickTier.SOVEREIGN,
        TickTier.STABLE,
        TickTier.COMPRESSED,
        TickTier.CRISIS,
        TickTier.COLLAPSE_IMMINENT,
      ],
    },
    tickSeconds: { control: { type: 'range', min: 1, max: 20, step: 1 } },
    ticksElapsed: { control: { type: 'range', min: 0, max: 300, step: 1 } },
    ticksRemaining: { control: { type: 'range', min: 0, max: 300, step: 1 } },
    holdsRemaining: { control: { type: 'range', min: 0, max: 1, step: 1 } },
    seasonProgressPct: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    pressureMultiplier: { control: { type: 'range', min: 1, max: 2, step: 0.01 } },
    liveops: { control: 'boolean' },
    finale: { control: 'boolean' },
    reengage: { control: 'boolean' },
    showTimeoutWarning: { control: 'boolean' },
  },
} satisfies Meta<typeof TimeEngineHUDStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StableBoard: Story = {};

export const LiveopsCompression: Story = {
  args: {
    tier: TickTier.COMPRESSED,
    tickSeconds: 8,
    ticksElapsed: 233,
    ticksRemaining: 67,
    pressureMultiplier: 1.1,
    liveops: true,
    showTimeoutWarning: false,
  },
};

export const FinaleCritical: Story = {
  args: {
    tier: TickTier.COLLAPSE_IMMINENT,
    tickSeconds: 2,
    ticksElapsed: 292,
    ticksRemaining: 8,
    holdsRemaining: 0,
    seasonProgressPct: 0.97,
    pressureMultiplier: 1.43,
    liveops: true,
    finale: true,
    reengage: true,
    showTimeoutWarning: true,
  },
};