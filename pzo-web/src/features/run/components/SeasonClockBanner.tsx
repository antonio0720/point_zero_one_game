/**
 * FILE: pzo-web/src/features/run/components/SeasonClockBanner.tsx
 * Engine 1 — Time Engine / SeasonClock UI surface
 *
 * Purpose:
 * - render wall-clock season state above the run surface
 * - expose active season windows, pressure multiplier, and season progress
 * - support finale / liveops / archive urgency states
 *
 * Dependency:
 * - uses useSeasonClock() from the Time UI hook lane
 * - does not import TimeEngine directly
 */

import React, { memo, useMemo } from 'react';
import { useSeasonClock } from '../hooks/useSeasonClock';

export interface SeasonClockBannerProps {
  className?: string;
  compact?: boolean;
  showWhenInactive?: boolean;
  showWindows?: boolean;
  showProgressBar?: boolean;
}

type BannerTone = 'kickoff' | 'liveops' | 'finale' | 'archive' | 'reengage' | 'active' | 'inactive';

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return '—';
  }

  if (ms <= 0) {
    return '0m';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}

function getTone(payload: {
  hasKickoffWindow: boolean;
  hasLiveopsWindow: boolean;
  hasFinaleWindow: boolean;
  hasArchiveCloseWindow: boolean;
  hasReengageWindow: boolean;
  isSeasonActive: boolean;
}): BannerTone {
  if (payload.hasFinaleWindow) return 'finale';
  if (payload.hasArchiveCloseWindow) return 'archive';
  if (payload.hasLiveopsWindow) return 'liveops';
  if (payload.hasKickoffWindow) return 'kickoff';
  if (payload.hasReengageWindow) return 'reengage';
  if (payload.isSeasonActive) return 'active';
  return 'inactive';
}

function getToneStyles(tone: BannerTone): {
  border: string;
  background: string;
  color: string;
  pillBg: string;
  pillBorder: string;
} {
  switch (tone) {
    case 'finale':
      return {
        border: '1px solid rgba(185, 43, 39, 0.42)',
        background: 'linear-gradient(135deg, rgba(48, 11, 11, 0.96), rgba(27, 10, 10, 0.96))',
        color: '#FFD8D6',
        pillBg: 'rgba(185, 43, 39, 0.18)',
        pillBorder: '1px solid rgba(185, 43, 39, 0.42)',
      };
    case 'liveops':
      return {
        border: '1px solid rgba(217, 168, 58, 0.34)',
        background: 'linear-gradient(135deg, rgba(41, 29, 8, 0.96), rgba(22, 18, 9, 0.96))',
        color: '#F4E2A2',
        pillBg: 'rgba(217, 168, 58, 0.16)',
        pillBorder: '1px solid rgba(217, 168, 58, 0.36)',
      };
    case 'kickoff':
      return {
        border: '1px solid rgba(78, 201, 176, 0.34)',
        background: 'linear-gradient(135deg, rgba(11, 33, 31, 0.96), rgba(9, 20, 22, 0.96))',
        color: '#C9FFF6',
        pillBg: 'rgba(78, 201, 176, 0.15)',
        pillBorder: '1px solid rgba(78, 201, 176, 0.34)',
      };
    case 'archive':
      return {
        border: '1px solid rgba(145, 128, 181, 0.34)',
        background: 'linear-gradient(135deg, rgba(27, 21, 38, 0.96), rgba(15, 13, 25, 0.96))',
        color: '#E0D8FF',
        pillBg: 'rgba(145, 128, 181, 0.16)',
        pillBorder: '1px solid rgba(145, 128, 181, 0.34)',
      };
    case 'reengage':
      return {
        border: '1px solid rgba(114, 160, 255, 0.32)',
        background: 'linear-gradient(135deg, rgba(13, 25, 47, 0.96), rgba(11, 16, 31, 0.96))',
        color: '#DDE8FF',
        pillBg: 'rgba(114, 160, 255, 0.14)',
        pillBorder: '1px solid rgba(114, 160, 255, 0.30)',
      };
    case 'active':
      return {
        border: '1px solid rgba(125, 135, 148, 0.26)',
        background: 'linear-gradient(135deg, rgba(18, 22, 29, 0.96), rgba(12, 15, 20, 0.96))',
        color: '#E8EDF3',
        pillBg: 'rgba(125, 135, 148, 0.12)',
        pillBorder: '1px solid rgba(125, 135, 148, 0.24)',
      };
    case 'inactive':
    default:
      return {
        border: '1px solid rgba(96, 104, 116, 0.24)',
        background: 'linear-gradient(135deg, rgba(16, 18, 22, 0.96), rgba(12, 13, 16, 0.96))',
        color: '#C6CDD6',
        pillBg: 'rgba(96, 104, 116, 0.10)',
        pillBorder: '1px solid rgba(96, 104, 116, 0.22)',
      };
  }
}

function getTitle(tone: BannerTone): string {
  switch (tone) {
    case 'finale':
      return 'SEASON FINALE';
    case 'liveops':
      return 'LIVEOPS WINDOW';
    case 'kickoff':
      return 'SEASON KICKOFF';
    case 'archive':
      return 'ARCHIVE CLOSING';
    case 'reengage':
      return 'RE-ENGAGE WINDOW';
    case 'active':
      return 'SEASON ACTIVE';
    case 'inactive':
    default:
      return 'SEASON OFFLINE';
  }
}

export const SeasonClockBanner = memo(function SeasonClockBanner({
  className,
  compact = false,
  showWhenInactive = false,
  showWindows = true,
  showProgressBar = true,
}: SeasonClockBannerProps) {
  const season = useSeasonClock();

  const tone = getTone({
    hasKickoffWindow: season.hasKickoffWindow,
    hasLiveopsWindow: season.hasLiveopsWindow,
    hasFinaleWindow: season.hasFinaleWindow,
    hasArchiveCloseWindow: season.hasArchiveCloseWindow,
    hasReengageWindow: season.hasReengageWindow,
    isSeasonActive: season.isSeasonActive,
  });

  const styles = getToneStyles(tone);

  const subtitle = useMemo(() => {
    if (!season.isManifestLoaded) {
      return 'Season manifest not loaded.';
    }

    if (season.hasFinaleWindow) {
      return `Finale pressure active · ${formatDuration(season.msUntilSeasonEnd)} remaining`;
    }

    if (season.isSeasonActive) {
      return `Season ${season.seasonId ?? '—'} active · ${formatDuration(season.msUntilSeasonEnd)} remaining`;
    }

    if (season.msUntilSeasonStart !== Number.POSITIVE_INFINITY && season.msUntilSeasonStart > 0) {
      return `Next season opens in ${formatDuration(season.msUntilSeasonStart)}`;
    }

    return `Season ${season.seasonId ?? '—'} inactive`;
  }, [
    season.hasFinaleWindow,
    season.isManifestLoaded,
    season.isSeasonActive,
    season.msUntilSeasonEnd,
    season.msUntilSeasonStart,
    season.seasonId,
  ]);

  if (!season.isManifestLoaded && !showWhenInactive) {
    return null;
  }

  if (!season.isSeasonActive && !showWhenInactive && tone === 'inactive') {
    return null;
  }

  return (
    <section
      className={className}
      aria-label="Season clock banner"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 10 : 12,
        width: '100%',
        padding: compact ? '12px 14px' : '14px 16px',
        borderRadius: 16,
        border: styles.border,
        background: styles.background,
        color: styles.color,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: compact ? 'flex-start' : 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: compact ? 12 : 13,
              fontWeight: 900,
              letterSpacing: 0.8,
              lineHeight: 1,
            }}
          >
            {getTitle(tone)}
          </div>
          <div
            style={{
              fontSize: compact ? 12 : 13,
              color: 'rgba(255,255,255,0.82)',
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <span
            style={{
              padding: '4px 8px',
              borderRadius: 999,
              background: styles.pillBg,
              border: styles.pillBorder,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.4,
            }}
          >
            {season.seasonId ?? 'SEASON'}
          </span>

          <span
            style={{
              padding: '4px 8px',
              borderRadius: 999,
              background: styles.pillBg,
              border: styles.pillBorder,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.4,
            }}
          >
            ×{season.pressureMultiplier.toFixed(2)} pressure
          </span>
        </div>
      </div>

      {showProgressBar && season.isSeasonActive ? (
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.10)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, season.seasonProgressPct * 100))}%`,
                height: '100%',
                borderRadius: 999,
                background:
                  tone === 'finale'
                    ? 'linear-gradient(90deg, rgba(255,120,120,0.9), rgba(185,43,39,1))'
                    : 'linear-gradient(90deg, rgba(78,201,176,0.85), rgba(201,168,76,0.92))',
                transition: 'width 400ms ease',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            {Math.round(season.seasonProgressPct * 100)}% elapsed
          </div>
        </div>
      ) : null}

      {showWindows && season.activeWindows.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {season.activeWindows.map((window) => (
            <span
              key={window.windowId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 999,
                background: styles.pillBg,
                border: styles.pillBorder,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.25,
              }}
            >
              <span>{window.type}</span>
              <span style={{ opacity: 0.8 }}>×{window.pressureMultiplier.toFixed(2)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
});

export default SeasonClockBanner;