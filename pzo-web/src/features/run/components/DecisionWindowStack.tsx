// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/DecisionWindowStack.tsx

/**
 * FILE: pzo-web/src/features/run/components/DecisionWindowStack.tsx
 * Engine 1 — multi-window stack surface
 *
 * Purpose:
 * - render all currently active Time Engine decision windows in one place
 * - show urgency ordering, hold availability, and per-window timer rings
 * - support T4 multi-window pressure without forcing players to hunt the board
 *
 * Design:
 * - read-only from useTimeEngine
 * - action wiring is callback-based so this component remains store-agnostic
 * - safe across the repo's current mixed minimal/rich decision-window shapes
 */

import React, { memo, useMemo } from 'react';
import { useTimeEngine } from '../hooks/useTimeEngine';
import { DecisionTimerRing } from './DecisionTimerRing';

type DecisionCardType = 'FORCED_FATE' | 'HATER_INJECTION' | 'CRISIS_EVENT';

export interface DecisionWindowStackWindow {
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

export interface DecisionWindowStackProps {
  className?: string;
  title?: string;
  maxVisible?: number;
  emptyState?: React.ReactNode;
  onApplyHold?: (window: DecisionWindowStackWindow) => void | Promise<void>;
  renderWindowActions?: (window: DecisionWindowStackWindow) => React.ReactNode;
}

type CompatibleTimeSnapshot = ReturnType<typeof useTimeEngine> & {
  activeWindowCount?: number;
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

function toDecisionWindow(value: unknown, index: number): DecisionWindowStackWindow | null {
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

function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0s';
  }

  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

function urgencyLabel(window: DecisionWindowStackWindow): string {
  const ratio = window.durationMs <= 0 ? 0 : window.remainingMs / window.durationMs;

  if (window.isExpired) return 'EXPIRED';
  if (window.isResolved) return 'RESOLVED';
  if (window.isOnHold) return 'HOLD';
  if (ratio <= 0.1) return 'CRITICAL';
  if (ratio <= 0.25) return 'URGENT';
  if (ratio <= 0.5) return 'HOT';
  return 'OPEN';
}

function urgencyColor(window: DecisionWindowStackWindow): string {
  const ratio = window.durationMs <= 0 ? 0 : window.remainingMs / window.durationMs;

  if (window.isOnHold) return '#4EC9B0';
  if (ratio <= 0.1) return '#FF4D4F';
  if (ratio <= 0.25) return '#FF8A00';
  if (ratio <= 0.5) return '#D6A23D';
  return '#8A8F98';
}

function cardTypeLabel(cardType: DecisionWindowStackWindow['cardType']): string {
  switch (cardType) {
    case 'FORCED_FATE':
      return 'Forced Fate';
    case 'HATER_INJECTION':
      return 'Hater Injection';
    case 'CRISIS_EVENT':
      return 'Crisis Event';
    default:
      return String(cardType);
  }
}

interface DecisionWindowRowProps {
  window: DecisionWindowStackWindow;
  holdsLeft: number;
  onApplyHold?: (window: DecisionWindowStackWindow) => void | Promise<void>;
  renderWindowActions?: (window: DecisionWindowStackWindow) => React.ReactNode;
}

const DecisionWindowRow = memo(function DecisionWindowRow({
  window,
  holdsLeft,
  onApplyHold,
  renderWindowActions,
}: DecisionWindowRowProps) {
  const canHold =
    holdsLeft > 0 &&
    !window.isOnHold &&
    !window.isExpired &&
    !window.isResolved &&
    typeof onApplyHold === 'function';

  const pillColor = urgencyColor(window);

  return (
    <div
      className="decision-window-stack__row"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${pillColor}33`,
        background: 'rgba(12, 14, 18, 0.92)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
      }}
    >
      <div
        className="decision-window-stack__ring"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <DecisionTimerRing cardInstanceId={window.cardId}>
          <span aria-hidden="true" />
        </DecisionTimerRing>
      </div>

      <div
        className="decision-window-stack__content"
        style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 8px',
              borderRadius: 999,
              background: `${pillColor}22`,
              border: `1px solid ${pillColor}55`,
              color: pillColor,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            {urgencyLabel(window)}
          </span>

          <span
            style={{
              fontSize: 11,
              color: '#A7AFBA',
              fontWeight: 600,
              letterSpacing: 0.35,
              textTransform: 'uppercase',
            }}
          >
            {cardTypeLabel(window.cardType)}
          </span>

          <span
            style={{
              fontSize: 11,
              color: '#7D8794',
              whiteSpace: 'nowrap',
            }}
          >
            {window.windowId}
          </span>
        </div>

        <div
          style={{
            fontSize: 14,
            color: '#F5F7FA',
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={window.cardId}
        >
          {window.cardId}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: 12,
            color: '#B6BEC9',
          }}
        >
          <span>Remaining: {formatCountdown(window.remainingMs)}</span>
          <span>Total: {formatCountdown(window.durationMs)}</span>
          {window.isOnHold && window.holdExpiresAtMs ? (
            <span>Hold until: {new Date(window.holdExpiresAtMs).toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>

      <div
        className="decision-window-stack__actions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        {canHold ? (
          <button
            type="button"
            onClick={() => {
              void onApplyHold?.(window);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(78, 201, 176, 0.45)',
              background: 'rgba(78, 201, 176, 0.12)',
              color: '#B9FFF2',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Apply Hold
          </button>
        ) : (
          <div
            style={{
              fontSize: 11,
              color: holdsLeft > 0 ? '#7D8794' : '#A15656',
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {window.isOnHold ? 'Hold active' : holdsLeft > 0 ? 'Hold unavailable' : 'No holds left'}
          </div>
        )}

        {renderWindowActions?.(window)}
      </div>
    </div>
  );
});

export const DecisionWindowStack = memo(function DecisionWindowStack({
  className,
  title = 'Decision Windows',
  maxVisible = 6,
  emptyState = null,
  onApplyHold,
  renderWindowActions,
}: DecisionWindowStackProps) {
  const time = useTimeEngine() as CompatibleTimeSnapshot;
  const holdsLeft = Number.isFinite(time.holdsLeft) ? time.holdsLeft : 0;
  const currentTier = time.currentTier ?? 'T1';
  const rawActiveWindows = Array.isArray(time.activeWindows) ? time.activeWindows : [];
  const activeDecisionCount = Number.isFinite(time.activeDecisionCount)
    ? time.activeDecisionCount
    : Number.isFinite(time.activeWindowCount)
      ? (time.activeWindowCount as number)
      : rawActiveWindows.length;
  const hasActiveDecision =
    typeof time.hasActiveDecision === 'boolean'
      ? time.hasActiveDecision
      : activeDecisionCount > 0;

  const typedWindows = useMemo(() => {
    return rawActiveWindows
      .map((window, index) => toDecisionWindow(window, index))
      .filter((window): window is DecisionWindowStackWindow => window !== null);
  }, [rawActiveWindows]);

  const windows = useMemo(() => {
    return [...typedWindows]
      .filter((window) => !window.isResolved && !window.isExpired)
      .sort((a, b) => {
        if (a.remainingMs !== b.remainingMs) return a.remainingMs - b.remainingMs;
        if (a.openedAtMs !== b.openedAtMs) return a.openedAtMs - b.openedAtMs;
        return a.windowId.localeCompare(b.windowId);
      })
      .slice(0, Math.max(1, maxVisible));
  }, [typedWindows, maxVisible]);

  if (!hasActiveDecision || windows.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <section
      className={className ?? 'decision-window-stack'}
      aria-label="Active decision windows"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.1,
              color: '#F5F7FA',
            }}
          >
            {title}
          </h3>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: 12,
              color: '#A7AFBA',
            }}
          >
            <span>{activeDecisionCount} active</span>
            <span>{holdsLeft} hold left</span>
            <span>Tier {currentTier}</span>
          </div>
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {windows.map((window) => (
          <DecisionWindowRow
            key={window.windowId}
            window={window}
            holdsLeft={holdsLeft}
            onApplyHold={onApplyHold}
            renderWindowActions={renderWindowActions}
          />
        ))}
      </div>
    </section>
  );
});