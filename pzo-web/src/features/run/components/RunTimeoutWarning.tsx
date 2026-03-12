// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/RunTimeoutWarning.tsx

/**
 * FILE: pzo-web/src/features/run/components/RunTimeoutWarning.tsx
 * Engine 1 — Time Engine timeout surface
 *
 * Purpose:
 * - warn the player as the season tick budget approaches TIMEOUT
 * - surface run urgency before the terminal RUN_TIMEOUT event fires
 * - align with the current useTimeEngine() hook contract without mutating the hook
 *
 * Notes:
 * - no engine imports
 * - pure UI component driven by store-derived time state
 * - tolerant of optional legacy fields injected by tests or adapter surfaces
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

type CompatibleTimeSnapshot = ReturnType<typeof useTimeEngine> & {
  isRunActive?: boolean;
  activeWindowCount?: number;
  seasonTickBudget?: number;
};

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
  progressBar: string;
} {
  switch (severity) {
    case 'collapse':
      return {
        border: '1px solid rgba(185, 43, 39, 0.55)',
        background: 'linear-gradient(135deg, rgba(42, 10, 10, 0.97), rgba(24, 7, 7, 0.97))',
        color: '#FFE1DF',
        pillBg: 'rgba(185, 43, 39, 0.18)',
        pillBorder: '1px solid rgba(185, 43, 39, 0.42)',
        progressBar: '#B92B27',
      };
    case 'critical':
      return {
        border: '1px solid rgba(201, 125, 39, 0.48)',
        background: 'linear-gradient(135deg, rgba(42, 23, 8, 0.97), rgba(23, 13, 8, 0.97))',
        color: '#FFE6C4',
        pillBg: 'rgba(201, 125, 39, 0.16)',
        pillBorder: '1px solid rgba(201, 125, 39, 0.36)',
        progressBar: '#C97D27',
      };
    case 'warning':
      return {
        border: '1px solid rgba(201, 168, 76, 0.36)',
        background: 'linear-gradient(135deg, rgba(31, 25, 10, 0.97), rgba(18, 15, 9, 0.97))',
        color: '#F6E9B3',
        pillBg: 'rgba(201, 168, 76, 0.14)',
        pillBorder: '1px solid rgba(201, 168, 76, 0.30)',
        progressBar: '#C9A84C',
      };
    case 'safe':
    default:
      return {
        border: '1px solid rgba(96, 104, 116, 0.24)',
        background: 'linear-gradient(135deg, rgba(16, 18, 22, 0.96), rgba(12, 13, 16, 0.96))',
        color: '#C6CDD6',
        pillBg: 'rgba(96, 104, 116, 0.10)',
        pillBorder: '1px solid rgba(96, 104, 116, 0.22)',
        progressBar: '#606874',
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
  const time = useTimeEngine() as CompatibleTimeSnapshot;

  const isRunActive = time.isRunActive ?? true;
  const currentTier = time.currentTier ?? 'T1';
  const ticksElapsed = Number.isFinite(time.ticksElapsed) ? time.ticksElapsed : 0;
  const ticksRemaining = Number.isFinite(time.ticksRemaining) ? Math.max(0, time.ticksRemaining) : 0;
  const tickBudget = Number.isFinite(time.tickBudget)
    ? time.tickBudget
    : Number.isFinite(time.seasonTickBudget)
      ? (time.seasonTickBudget as number)
      : 0;
  const tickProgressPct = Number.isFinite(time.tickProgressPct)
    ? Math.max(0, Math.min(1, time.tickProgressPct))
    : 0;
  const secondsPerTick = Number.isFinite(time.secondsPerTick) ? Math.max(1, time.secondsPerTick) : 1;
  const activeDecisionCount = Number.isFinite(time.activeDecisionCount)
    ? time.activeDecisionCount
    : Number.isFinite(time.activeWindowCount)
      ? (time.activeWindowCount as number)
      : 0;
  const hasActiveDecision =
    typeof time.hasActiveDecision === 'boolean'
      ? time.hasActiveDecision
      : activeDecisionCount > 0;

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
    <section
      className={className}
      data-testid="run-timeout-warning"
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        borderRadius: 14,
        border: styles.border,
        background: styles.background,
        color: styles.color,
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.55,
        }}
      >
        {getTitle(severity)}
      </div>

      <div
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          opacity: 0.96,
        }}
      >
        {detailText}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: 999,
            background: styles.pillBg,
            border: styles.pillBorder,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {ticksRemaining} ticks left
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Tier {currentTier}
        </span>

        {hasActiveDecision ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {activeDecisionCount} open decisions
          </span>
        ) : null}
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
              height: 5,
              width: '100%',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, tickProgressPct * 100))}%`,
                borderRadius: 999,
                background: styles.progressBar,
                transition: 'width 180ms ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 11,
              color: styles.color,
              opacity: 0.9,
            }}
          >
            <span>
              {ticksElapsed}/{tickBudget} ticks used
            </span>
            <span>≈ {formatEta(approxSecondsRemaining)} remaining</span>
          </div>
        </div>
      ) : null}
    </section>
  );
});

export default RunTimeoutWarning;