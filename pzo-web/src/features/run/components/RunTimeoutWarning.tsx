/**
 * FILE: pzo-web/src/features/run/components/RunTimeoutWarning.tsx
 * Engine 1 — Time Engine timeout surface
 *
 * Purpose:
 * - warn the player as the season tick budget approaches TIMEOUT
 * - surface run urgency before the terminal RUN_TIMEOUT event fires
 * - align with the adaptive tick-rate model already exposed by useTimeEngine()
 *
 * Notes:
 * - no engine imports
 * - pure UI component driven by store-derived time state
 */

import React, { memo, useMemo } from 'react';
import { useTimeEngine } from '../hooks/useTimeEngine';

export interface RunTimeoutWarningProps {
  className?: string;
  showWhenSafe?: boolean;
  warnAtTicksRemaining?: number;
  criticalAtTicksRemaining?: number;
  collapseAtTicksRemaining?: number;
  showProgressBar?: boolean;
}

type TimeoutSeverity = 'safe' | 'warning' | 'critical' | 'collapse';

function formatEta(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0s';
  }

  if (totalSeconds < 60) {
    return `${Math.max(1, Math.round(totalSeconds))}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function getSeverity(
  ticksRemaining: number,
  collapseAtTicksRemaining: number,
  criticalAtTicksRemaining: number,
  warnAtTicksRemaining: number,
): TimeoutSeverity {
  if (ticksRemaining <= collapseAtTicksRemaining) return 'collapse';
  if (ticksRemaining <= criticalAtTicksRemaining) return 'critical';
  if (ticksRemaining <= warnAtTicksRemaining) return 'warning';
  return 'safe';
}

function getSeverityStyles(severity: TimeoutSeverity): {
  border: string;
  background: string;
  color: string;
  pillBg: string;
  pillBorder: string;
} {
  switch (severity) {
    case 'collapse':
      return {
        border: '1px solid rgba(185, 43, 39, 0.55)',
        background: 'linear-gradient(135deg, rgba(42, 10, 10, 0.97), rgba(24, 7, 7, 0.97))',
        color: '#FFE1DF',
        pillBg: 'rgba(185, 43, 39, 0.18)',
        pillBorder: '1px solid rgba(185, 43, 39, 0.42)',
      };
    case 'critical':
      return {
        border: '1px solid rgba(201, 125, 39, 0.48)',
        background: 'linear-gradient(135deg, rgba(42, 23, 8, 0.97), rgba(23, 13, 8, 0.97))',
        color: '#FFE6C4',
        pillBg: 'rgba(201, 125, 39, 0.16)',
        pillBorder: '1px solid rgba(201, 125, 39, 0.36)',
      };
    case 'warning':
      return {
        border: '1px solid rgba(201, 168, 76, 0.36)',
        background: 'linear-gradient(135deg, rgba(31, 25, 10, 0.97), rgba(18, 15, 9, 0.97))',
        color: '#F6E9B3',
        pillBg: 'rgba(201, 168, 76, 0.14)',
        pillBorder: '1px solid rgba(201, 168, 76, 0.30)',
      };
    case 'safe':
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

function getTitle(severity: TimeoutSeverity): string {
  switch (severity) {
    case 'collapse':
      return 'TIMEOUT IMMINENT';
    case 'critical':
      return 'TIME BUDGET CRITICAL';
    case 'warning':
      return 'TIME BUDGET LOW';
    case 'safe':
    default:
      return 'TIME BUDGET STABLE';
  }
}

export const RunTimeoutWarning = memo(function RunTimeoutWarning({
  className,
  showWhenSafe = false,
  warnAtTicksRemaining = 25,
  criticalAtTicksRemaining = 10,
  collapseAtTicksRemaining = 5,
  showProgressBar = true,
}: RunTimeoutWarningProps) {
  const {
    isRunActive,
    currentTier,
    ticksElapsed,
    ticksRemaining,
    seasonTickBudget,
    tickProgressPct,
    secondsPerTick,
    activeWindowCount,
    hasActiveDecision,
  } = useTimeEngine();

  const severity = getSeverity(
    ticksRemaining,
    collapseAtTicksRemaining,
    criticalAtTicksRemaining,
    warnAtTicksRemaining,
  );

  const styles = getSeverityStyles(severity);

  const approxSecondsRemaining = useMemo(() => {
    return Math.max(0, ticksRemaining * Math.max(1, secondsPerTick));
  }, [secondsPerTick, ticksRemaining]);

  const detailText = useMemo(() => {
    if (severity === 'collapse') {
      return `Run will timeout in about ${formatEta(approxSecondsRemaining)} if you do not close immediately.`;
    }

    if (severity === 'critical') {
      return `You are inside the critical time lane with ${ticksRemaining} ticks left.`;
    }

    if (severity === 'warning') {
      return `Season budget is tightening. Approximate time left: ${formatEta(approxSecondsRemaining)}.`;
    }

    return `Budget remaining: ${ticksRemaining} ticks.`;
  }, [approxSecondsRemaining, severity, ticksRemaining]);

  if (!isRunActive) {
    return null;
  }

  if (severity === 'safe' && !showWhenSafe) {
    return null;
  }

  return (
    <aside
      className={className}
      role="status"
      aria-live={severity === 'collapse' || severity === 'critical' ? 'assertive' : 'polite'}
      aria-label="Run timeout warning"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        borderRadius: 16,
        border: styles.border,
        background: styles.background,
        color: styles.color,
        boxShadow:
          severity === 'collapse'
            ? '0 14px 36px rgba(185, 43, 39, 0.18)'
            : severity === 'critical'
              ? '0 14px 36px rgba(201, 125, 39, 0.16)'
              : '0 12px 28px rgba(0, 0, 0, 0.14)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: 0.8,
            }}
          >
            {getTitle(severity)}
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.4,
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            {detailText}
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
              letterSpacing: 0.35,
            }}
          >
            {ticksRemaining} ticks left
          </span>

          <span
            style={{
              padding: '4px 8px',
              borderRadius: 999,
              background: styles.pillBg,
              border: styles.pillBorder,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.35,
            }}
          >
            Tier {currentTier}
          </span>

          {hasActiveDecision ? (
            <span
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                background: styles.pillBg,
                border: styles.pillBorder,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.35,
              }}
            >
              {activeWindowCount} open decisions
            </span>
          ) : null}
        </div>
      </div>

      {showProgressBar ? (
        <div
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
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.10)',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, tickProgressPct * 100))}%`,
                height: '100%',
                borderRadius: 999,
                background:
                  severity === 'collapse'
                    ? 'linear-gradient(90deg, rgba(255,118,118,0.92), rgba(185,43,39,1))'
                    : severity === 'critical'
                      ? 'linear-gradient(90deg, rgba(255,188,110,0.92), rgba(201,125,39,1))'
                      : 'linear-gradient(90deg, rgba(201,168,76,0.92), rgba(245,197,66,1))',
                transition: 'width 300ms ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 11,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            <span>
              {ticksElapsed}/{seasonTickBudget} ticks used
            </span>
            <span>≈ {formatEta(approxSecondsRemaining)} remaining</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
});

export default RunTimeoutWarning;