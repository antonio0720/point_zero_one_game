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
 * - safe if no windows are open
 */

import React, { memo, useMemo } from 'react';
import type { DecisionWindow } from '../../../engines/time/types';
import { useTimeEngine } from '../hooks/useTimeEngine';
import { formatCountdown } from '../hooks/useDecisionWindow';
import { DecisionTimerRing } from './DecisionTimerRing';

export interface DecisionWindowStackProps {
  className?: string;
  title?: string;
  maxVisible?: number;
  emptyState?: React.ReactNode;
  onApplyHold?: (window: DecisionWindow) => void | Promise<void>;
  renderWindowActions?: (window: DecisionWindow) => React.ReactNode;
}

function urgencyLabel(window: DecisionWindow): string {
  const ratio = window.durationMs <= 0 ? 0 : window.remainingMs / window.durationMs;

  if (window.isExpired) return 'EXPIRED';
  if (window.isResolved) return 'RESOLVED';
  if (window.isOnHold) return 'HOLD';
  if (ratio <= 0.1) return 'CRITICAL';
  if (ratio <= 0.25) return 'URGENT';
  if (ratio <= 0.5) return 'HOT';
  return 'OPEN';
}

function urgencyColor(window: DecisionWindow): string {
  const ratio = window.durationMs <= 0 ? 0 : window.remainingMs / window.durationMs;

  if (window.isOnHold) return '#4EC9B0';
  if (ratio <= 0.1) return '#FF4D4F';
  if (ratio <= 0.25) return '#FF8A00';
  if (ratio <= 0.5) return '#D6A23D';
  return '#8A8F98';
}

function cardTypeLabel(cardType: DecisionWindow['cardType']): string {
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
  window: DecisionWindow;
  holdsLeft: number;
  onApplyHold?: (window: DecisionWindow) => void | Promise<void>;
  renderWindowActions?: (window: DecisionWindow) => React.ReactNode;
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
        <DecisionTimerRing cardId={window.cardId} size={44} />
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
  const { activeWindows, holdsLeft, currentTier, activeWindowCount, hasActiveDecision } = useTimeEngine();

  const windows = useMemo(() => {
    return [...activeWindows]
      .filter((window) => !window.isResolved && !window.isExpired)
      .sort((a, b) => {
        if (a.remainingMs !== b.remainingMs) return a.remainingMs - b.remainingMs;
        if (a.openedAtMs !== b.openedAtMs) return a.openedAtMs - b.openedAtMs;
        return a.windowId.localeCompare(b.windowId);
      })
      .slice(0, Math.max(1, maxVisible));
  }, [activeWindows, maxVisible]);

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
            <span>{activeWindowCount} active</span>
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