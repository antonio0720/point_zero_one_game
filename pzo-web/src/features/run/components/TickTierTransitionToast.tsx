/**
 * FILE: pzo-web/src/features/run/components/TickTierTransitionToast.tsx
 * Density6 LLC · Point Zero One · Engine 1 — Time Engine · Confidential
 *
 * TickTierTransitionToast
 * - surfaces Time Engine tier changes as an ephemeral top-center toast
 * - reads only from the existing useTimeEngine() hook
 * - avoids direct engine imports
 * - auto-hides after a short dwell
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TICK_TIER_CONFIGS, TickTier } from '../../../engines/time/types';
import { useTimeEngine } from '../hooks/useTimeEngine';

const TIER_TOAST_STYLES = `
  .pzo-time-toast {
    --bg: #07090d;
    --panel: rgba(12, 15, 20, 0.96);
    --border: rgba(201, 168, 76, 0.28);
    --text: #dfe7f2;
    --muted: #90a0b5;
    --gold: #c9a84c;
    --amber: #b97d27;
    --crimson: #b92b27;
    --teal: #4ec9b0;
    --shadow: 0 18px 42px rgba(0, 0, 0, 0.42);
    position: fixed;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10002;
    pointer-events: none;
    width: min(560px, calc(100vw - 24px));
    display: flex;
    justify-content: center;
  }

  .pzo-time-toast__card {
    width: 100%;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(14, 17, 24, 0.98), var(--panel));
    box-shadow: var(--shadow);
    overflow: hidden;
    opacity: 0;
    transform: translateY(-10px) scale(0.985);
    transition:
      opacity 180ms ease,
      transform 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .pzo-time-toast--visible .pzo-time-toast__card {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .pzo-time-toast__bar {
    height: 3px;
    width: 100%;
    background: linear-gradient(90deg, rgba(201,168,76,0.18), rgba(201,168,76,0.9), rgba(78,201,176,0.8));
  }

  .pzo-time-toast__body {
    display: grid;
    gap: 10px;
    padding: 12px 14px 13px 14px;
  }

  .pzo-time-toast__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .pzo-time-toast__eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gold);
  }

  .pzo-time-toast__headline {
    margin-top: 6px;
    font-size: 15px;
    line-height: 1.15;
    font-weight: 800;
    color: var(--text);
  }

  .pzo-time-toast__sub {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
  }

  .pzo-time-toast__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pzo-time-toast__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 5px 9px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: var(--text);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  .pzo-time-toast__fromto {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pzo-time-toast__tier {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    color: var(--text);
  }

  .pzo-time-toast__arrow {
    font-size: 13px;
    color: var(--gold);
  }

  .pzo-time-toast__meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .pzo-time-toast__meta-card {
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.03);
    padding: 8px 10px;
    display: grid;
    gap: 4px;
  }

  .pzo-time-toast__meta-label {
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  .pzo-time-toast__meta-value {
    font-size: 13px;
    line-height: 1.1;
    font-weight: 800;
    color: var(--text);
  }

  .pzo-time-toast__card--T0 {
    border-color: rgba(201,168,76,0.34);
    box-shadow: 0 18px 42px rgba(201,168,76,0.09);
  }

  .pzo-time-toast__card--T1 {
    border-color: rgba(169,180,198,0.20);
  }

  .pzo-time-toast__card--T2 {
    border-color: rgba(185,125,39,0.34);
    box-shadow: 0 18px 42px rgba(185,125,39,0.10);
  }

  .pzo-time-toast__card--T3 {
    border-color: rgba(185,43,39,0.38);
    box-shadow: 0 18px 42px rgba(185,43,39,0.14);
  }

  .pzo-time-toast__card--T4 {
    border-color: rgba(255,70,70,0.44);
    box-shadow: 0 18px 42px rgba(185,43,39,0.20);
  }

  @media (max-width: 640px) {
    .pzo-time-toast__meta {
      grid-template-columns: 1fr;
    }
  }
`;

function injectTickTierTransitionToastStyles(): void {
  if (typeof document === 'undefined') return;
  const id = 'pzo-time-toast-styles';
  if (document.getElementById(id)) return;

  const styleEl = document.createElement('style');
  styleEl.id = id;
  styleEl.textContent = TIER_TOAST_STYLES;
  document.head.appendChild(styleEl);
}

const FRIENDLY_TIER_NAMES: Record<TickTier, string> = {
  [TickTier.SOVEREIGN]: 'Sovereign',
  [TickTier.STABLE]: 'Stable',
  [TickTier.COMPRESSED]: 'Compressed',
  [TickTier.CRISIS]: 'Crisis',
  [TickTier.COLLAPSE_IMMINENT]: 'Collapse Imminent',
};

const FRIENDLY_TIER_MESSAGES: Record<TickTier, string> = {
  [TickTier.SOVEREIGN]: 'Breathing room restored. The run is granting wider strategic windows.',
  [TickTier.STABLE]: 'The run is operating at baseline tempo. Pressure is controlled for now.',
  [TickTier.COMPRESSED]: 'Time is tightening. Decision windows and tick cadence are beginning to compress.',
  [TickTier.CRISIS]: 'Financial pressure is now actively accelerating the run against the player.',
  [TickTier.COLLAPSE_IMMINENT]: 'Collapse state reached. The clock is now hostile, fast, and unstable.',
};

function formatMsAsSeconds(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0.0s';
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
}

export interface TickTierTransitionToastProps {
  readonly autoHideMs?: number;
  readonly className?: string;
  readonly showMeta?: boolean;
  readonly suppressInitialTier?: boolean;
}

interface ToastSnapshot {
  readonly previousTier: TickTier | null;
  readonly currentTier: TickTier;
  readonly shownAt: number;
}

export default function TickTierTransitionToast({
  autoHideMs = 2400,
  className,
  showMeta = true,
  suppressInitialTier = true,
}: TickTierTransitionToastProps) {
  const {
    currentTier,
    previousTier,
    tierChangedThisTick,
    tickDurationMs,
    decisionWindowMs,
    audioSignal,
  } = useTimeEngine();

  const [snapshot, setSnapshot] = useState<ToastSnapshot | null>(null);
  const [visible, setVisible] = useState(false);
  const lastSeenTierRef = useRef<TickTier | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    injectTickTierTransitionToastStyles();
  }, []);

  useEffect(() => {
    const lastSeenTier = lastSeenTierRef.current;

    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      lastSeenTierRef.current = currentTier;

      if (!suppressInitialTier) {
        setSnapshot({
          previousTier: null,
          currentTier,
          shownAt: Date.now(),
        });
        setVisible(true);
      }

      return;
    }

    const actualPreviousTier = previousTier ?? lastSeenTier;
    const tierActuallyChanged = actualPreviousTier !== null && actualPreviousTier !== currentTier;

    if (tierChangedThisTick || tierActuallyChanged) {
      setSnapshot({
        previousTier: actualPreviousTier,
        currentTier,
        shownAt: Date.now(),
      });
      setVisible(true);
    }

    lastSeenTierRef.current = currentTier;
  }, [currentTier, previousTier, tierChangedThisTick, suppressInitialTier]);

  useEffect(() => {
    if (!snapshot) return;

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, autoHideMs);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [snapshot, autoHideMs]);

  const derived = useMemo(() => {
    if (!snapshot) return null;

    const currentConfig = TICK_TIER_CONFIGS[snapshot.currentTier];
    const previousConfig = snapshot.previousTier ? TICK_TIER_CONFIGS[snapshot.previousTier] : null;

    return {
      headline: `${FRIENDLY_TIER_NAMES[snapshot.currentTier]} Tempo`,
      subline: FRIENDLY_TIER_MESSAGES[snapshot.currentTier],
      currentDurationLabel: formatMsAsSeconds(currentConfig.defaultDurationMs),
      currentDecisionLabel: formatMsAsSeconds(currentConfig.decisionWindowMs),
      deltaLabel:
        previousConfig === null
          ? '—'
          : `${formatMsAsSeconds(previousConfig.defaultDurationMs)} → ${formatMsAsSeconds(currentConfig.defaultDurationMs)}`,
    };
  }, [snapshot]);

  if (!snapshot || !derived) {
    return null;
  }

  return (
    <div
      className={[
        'pzo-time-toast',
        visible ? 'pzo-time-toast--visible' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <div className={`pzo-time-toast__card pzo-time-toast__card--${snapshot.currentTier}`}>
        <div className="pzo-time-toast__bar" />
        <div className="pzo-time-toast__body">
          <div className="pzo-time-toast__top">
            <div>
              <div className="pzo-time-toast__eyebrow">Tick Tier Changed</div>
              <div className="pzo-time-toast__headline">{derived.headline}</div>
              <div className="pzo-time-toast__sub">{derived.subline}</div>
            </div>

            <div className="pzo-time-toast__chips">
              {audioSignal ? (
                <span className="pzo-time-toast__chip">{audioSignal}</span>
              ) : null}
              <span className="pzo-time-toast__chip">{snapshot.currentTier}</span>
            </div>
          </div>

          <div className="pzo-time-toast__fromto">
            {snapshot.previousTier ? (
              <>
                <span className="pzo-time-toast__tier">{FRIENDLY_TIER_NAMES[snapshot.previousTier]}</span>
                <span className="pzo-time-toast__arrow">→</span>
              </>
            ) : null}
            <span className="pzo-time-toast__tier">{FRIENDLY_TIER_NAMES[snapshot.currentTier]}</span>
          </div>

          {showMeta ? (
            <div className="pzo-time-toast__meta">
              <div className="pzo-time-toast__meta-card">
                <div className="pzo-time-toast__meta-label">Tick Duration</div>
                <div className="pzo-time-toast__meta-value">{derived.currentDurationLabel}</div>
              </div>

              <div className="pzo-time-toast__meta-card">
                <div className="pzo-time-toast__meta-label">Decision Window</div>
                <div className="pzo-time-toast__meta-value">{derived.currentDecisionLabel}</div>
              </div>

              <div className="pzo-time-toast__meta-card">
                <div className="pzo-time-toast__meta-label">Delta</div>
                <div className="pzo-time-toast__meta-value">
                  {snapshot.previousTier ? derived.deltaLabel : formatMsAsSeconds(tickDurationMs || decisionWindowMs)}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}