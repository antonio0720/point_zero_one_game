// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/HoldActionButton.tsx

/**
 * FILE: pzo-web/src/features/run/components/HoldActionButton.tsx
 * Engine 1 — Time Engine
 *
 * Purpose:
 * - provide a hardened UI surface for the one-per-run hold action
 * - bind to the current Time Engine store shape via useTimeEngine()
 * - support explicit window targeting or automatic selection of the most urgent window
 *
 * Integration:
 * - preferred: pass onApplyHold(windowId, window) from your run screen / orchestrator bridge
 * - fallback: emits browser event "pzo:time:apply-hold" with window context
 *
 * Notes:
 * - no direct TimeEngine imports
 * - safe across the repo's current mixed minimal/rich decision-window shapes
 */

import React, { memo, useMemo, useState } from 'react';
import { useTimeEngine } from '../hooks/useTimeEngine';

type DecisionCardType = 'FORCED_FATE' | 'HATER_INJECTION' | 'CRISIS_EVENT';

export interface HoldActionWindow {
  windowId: string;
  cardId: string;
  cardType: DecisionCardType;
  durationMs: number;
  remainingMs: number;
  openedAtMs: number;
  expiresAtMs: number;
  isOnHold: boolean;
  holdExpiresAtMs: number | null;
  worstOptionIndex: number;
  isExpired: boolean;
  isResolved: boolean;
}

export interface HoldActionButtonProps {
  windowId?: string | null;
  className?: string;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showHint?: boolean;
  preferAutoSelect?: boolean;
  onApplyHold?: (windowId: string, window: HoldActionWindow) => void | Promise<void>;
}

type ButtonTone = 'ready' | 'used' | 'locked' | 'active' | 'busy';

type CompatibleTimeSnapshot = ReturnType<typeof useTimeEngine> & {
  hasHoldAvailable?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function coerceDecisionCardType(value: unknown): DecisionCardType {
  if (
    value === 'FORCED_FATE' ||
    value === 'HATER_INJECTION' ||
    value === 'CRISIS_EVENT'
  ) {
    return value;
  }

  return 'FORCED_FATE';
}

function toDecisionWindow(value: unknown, index: number): HoldActionWindow | null {
  if (!isRecord(value) || typeof value.cardId !== 'string') {
    return null;
  }

  const durationMs =
    typeof value.durationMs === 'number' && Number.isFinite(value.durationMs) && value.durationMs > 0
      ? Math.trunc(value.durationMs)
      : 1;

  const openedAtMs =
    typeof value.openedAtMs === 'number' && Number.isFinite(value.openedAtMs)
      ? Math.trunc(value.openedAtMs)
      : 0;

  const remainingMs =
    typeof value.remainingMs === 'number' && Number.isFinite(value.remainingMs)
      ? Math.max(0, Math.trunc(value.remainingMs))
      : durationMs;

  const expiresAtMs =
    typeof value.expiresAtMs === 'number' && Number.isFinite(value.expiresAtMs)
      ? Math.trunc(value.expiresAtMs)
      : openedAtMs + durationMs;

  const windowId =
    typeof value.windowId === 'string' && value.windowId.length > 0
      ? value.windowId
      : `${value.cardId}::${openedAtMs || index}`;

  return {
    windowId,
    cardId: value.cardId,
    cardType: coerceDecisionCardType(value.cardType),
    durationMs,
    remainingMs,
    openedAtMs,
    expiresAtMs,
    isOnHold: Boolean(value.isOnHold),
    holdExpiresAtMs:
      typeof value.holdExpiresAtMs === 'number' && Number.isFinite(value.holdExpiresAtMs)
        ? Math.trunc(value.holdExpiresAtMs)
        : null,
    worstOptionIndex:
      typeof value.worstOptionIndex === 'number' && Number.isFinite(value.worstOptionIndex)
        ? Math.trunc(value.worstOptionIndex)
        : 0,
    isExpired: Boolean(value.isExpired) || remainingMs <= 0,
    isResolved: Boolean(value.isResolved),
  };
}

function pickMostUrgentWindow(windows: readonly HoldActionWindow[]): HoldActionWindow | null {
  const eligible = windows.filter((window) => !window.isExpired && !window.isResolved);

  if (eligible.length === 0) {
    return null;
  }

  return [...eligible].sort((a, b) => {
    if (a.isOnHold !== b.isOnHold) {
      return a.isOnHold ? 1 : -1;
    }
    if (a.remainingMs !== b.remainingMs) {
      return a.remainingMs - b.remainingMs;
    }
    if (a.openedAtMs !== b.openedAtMs) {
      return a.openedAtMs - b.openedAtMs;
    }
    return a.windowId.localeCompare(b.windowId);
  })[0] ?? null;
}

function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0s';
  }

  return `${Math.max(1, Math.ceil(ms / 1000))}s`;
}

function getPadding(size: NonNullable<HoldActionButtonProps['size']>): string {
  switch (size) {
    case 'sm':
      return '8px 12px';
    case 'lg':
      return '14px 18px';
    case 'md':
    default:
      return '11px 14px';
  }
}

function getFontSize(size: NonNullable<HoldActionButtonProps['size']>): number {
  switch (size) {
    case 'sm':
      return 11;
    case 'lg':
      return 14;
    case 'md':
    default:
      return 12;
  }
}

function getToneStyles(tone: ButtonTone): {
  background: string;
  border: string;
  color: string;
  shadow: string;
} {
  switch (tone) {
    case 'busy':
      return {
        background: 'rgba(78, 201, 176, 0.18)',
        border: '1px solid rgba(78, 201, 176, 0.48)',
        color: '#D8FFF7',
        shadow: '0 0 0 1px rgba(78, 201, 176, 0.08), 0 10px 24px rgba(78, 201, 176, 0.10)',
      };
    case 'active':
      return {
        background: 'rgba(245, 197, 66, 0.16)',
        border: '1px solid rgba(245, 197, 66, 0.42)',
        color: '#F9E7A0',
        shadow: '0 0 0 1px rgba(245, 197, 66, 0.08), 0 10px 24px rgba(245, 197, 66, 0.10)',
      };
    case 'used':
      return {
        background: 'rgba(185, 43, 39, 0.10)',
        border: '1px solid rgba(185, 43, 39, 0.28)',
        color: '#DFA7A5',
        shadow: 'none',
      };
    case 'locked':
      return {
        background: 'rgba(125, 135, 148, 0.10)',
        border: '1px solid rgba(125, 135, 148, 0.22)',
        color: '#9AA3AD',
        shadow: 'none',
      };
    case 'ready':
    default:
      return {
        background: 'rgba(78, 201, 176, 0.14)',
        border: '1px solid rgba(78, 201, 176, 0.38)',
        color: '#B9FFF2',
        shadow: '0 0 0 1px rgba(78, 201, 176, 0.08), 0 12px 28px rgba(78, 201, 176, 0.12)',
      };
  }
}

export const HoldActionButton = memo(function HoldActionButton({
  windowId = null,
  className,
  label = 'HOLD',
  disabled = false,
  size = 'md',
  showHint = true,
  preferAutoSelect = true,
  onApplyHold,
}: HoldActionButtonProps) {
  const time = useTimeEngine() as CompatibleTimeSnapshot;
  const holdsLeft = Number.isFinite(time.holdsLeft) ? time.holdsLeft : 0;
  const hasHoldAvailable =
    typeof time.hasHoldAvailable === 'boolean' ? time.hasHoldAvailable : holdsLeft > 0;
  const rawActiveWindows = Array.isArray(time.activeWindows) ? time.activeWindows : [];
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const activeWindows = useMemo(() => {
    return rawActiveWindows
      .map((window, index) => toDecisionWindow(window, index))
      .filter((window): window is HoldActionWindow => window !== null);
  }, [rawActiveWindows]);

  const explicitWindow = useMemo(() => {
    if (!windowId) {
      return null;
    }

    return activeWindows.find((window) => window.windowId === windowId) ?? null;
  }, [activeWindows, windowId]);

  const fallbackWindow = useMemo(() => {
    if (!preferAutoSelect) {
      return null;
    }

    return pickMostUrgentWindow(activeWindows);
  }, [activeWindows, preferAutoSelect]);

  const targetWindow = explicitWindow ?? fallbackWindow ?? null;

  const canApplyHold =
    !disabled &&
    !isBusy &&
    hasHoldAvailable &&
    targetWindow !== null &&
    !targetWindow.isOnHold &&
    !targetWindow.isExpired &&
    !targetWindow.isResolved;

  const tone: ButtonTone = isBusy
    ? 'busy'
    : targetWindow?.isOnHold
      ? 'active'
      : !hasHoldAvailable
        ? 'used'
        : targetWindow === null
          ? 'locked'
          : disabled
            ? 'locked'
            : 'ready';

  const toneStyles = getToneStyles(tone);

  const buttonLabel = isBusy
    ? 'APPLYING…'
    : targetWindow?.isOnHold
      ? 'HOLD ACTIVE'
      : !hasHoldAvailable
        ? 'HOLD USED'
        : targetWindow === null
          ? 'NO WINDOW'
          : label;

  const hintText = isBusy
    ? 'Freezing active decision window…'
    : targetWindow?.isOnHold && targetWindow.holdExpiresAtMs
      ? `Frozen until ${new Date(targetWindow.holdExpiresAtMs).toLocaleTimeString()}`
      : !hasHoldAvailable
        ? 'Hold action has already been consumed this run.'
        : targetWindow === null
          ? 'No active forced-decision window is available to freeze.'
          : `Targets ${targetWindow.cardId} · ${formatCountdown(targetWindow.remainingMs)} left`;

  const handleClick = async (): Promise<void> => {
    if (!canApplyHold || !targetWindow) {
      return;
    }

    try {
      setIsBusy(true);

      if (onApplyHold) {
        await onApplyHold(targetWindow.windowId, targetWindow);
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pzo:time:apply-hold', {
            detail: {
              windowId: targetWindow.windowId,
              cardId: targetWindow.cardId,
              cardType: targetWindow.cardType,
              remainingMs: targetWindow.remainingMs,
              timestamp: Date.now(),
            },
          }),
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 6,
      }}
    >
      <button
        type="button"
        onClick={() => {
          void handleClick();
        }}
        disabled={!canApplyHold}
        aria-disabled={!canApplyHold}
        aria-label={buttonLabel}
        title={hintText}
        style={{
          appearance: 'none',
          borderRadius: 12,
          padding: getPadding(size),
          background: toneStyles.background,
          border: toneStyles.border,
          color: toneStyles.color,
          boxShadow: toneStyles.shadow,
          cursor: canApplyHold ? 'pointer' : 'not-allowed',
          fontWeight: 800,
          fontSize: getFontSize(size),
          letterSpacing: 0.6,
          lineHeight: 1,
          minWidth: size === 'lg' ? 140 : size === 'sm' ? 112 : 124,
          minHeight: size === 'lg' ? 48 : size === 'sm' ? 36 : 42,
          opacity: canApplyHold ? 1 : 0.86,
          transition:
            'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>{buttonLabel}</span>
          <span
            style={{
              fontSize: Math.max(10, getFontSize(size) - 1),
              opacity: 0.86,
            }}
          >
            {holdsLeft}/1
          </span>
        </div>
      </button>

      {showHint ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: 11,
            color: tone === 'used' ? '#C79A98' : tone === 'active' ? '#F2D67C' : '#98A2AE',
            lineHeight: 1.35,
            maxWidth: 320,
          }}
        >
          {hintText}
        </div>
      ) : null}
    </div>
  );
});

export default HoldActionButton;