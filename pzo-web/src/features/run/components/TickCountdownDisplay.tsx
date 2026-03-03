/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/TickCountdownDisplay.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * TickCountdownDisplay — HUD-aligned countdown (seconds or milliseconds).
 * - No TODOs, no PropTypes.
 * - Accessible (role=status + aria-live).
 * - Uses HUD CSS vars when available; injects its own CSS.
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface TickCountdownDisplayProps {
  readonly timeLeft: number; // seconds by default (or ms if unit="ms")
  readonly onTimeUp: () => void;

  readonly unit?: 's' | 'ms';
  readonly label?: string;
  readonly criticalAtSeconds?: number; // default 10
  readonly warningAtSeconds?: number; // default 20
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');

  .pzo-tick-countdown {
    --hud-panel:        var(--hud-panel, #0c0f14);
    --hud-border:       var(--hud-border, #1a2030);
    --hud-amber:        var(--hud-amber, #c9a84c);
    --hud-crimson:      var(--hud-crimson, #c0392b);
    --hud-teal:         var(--hud-teal, #1de9b6);
    --hud-text:         var(--hud-text, #8fa0b8);
    --hud-text-bright:  var(--hud-text-bright, #c8d8f0);
    --font-mono:        var(--font-mono, 'Share Tech Mono', monospace);

    display: grid;
    gap: 6px;
    padding: 8px 10px;
    background: var(--hud-panel);
    border: 1px solid var(--hud-border);
    border-radius: 3px;
    clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
    user-select: none;
    position: relative;
    overflow: hidden;
  }

  .pzo-tick-countdown::before{
    content:'';
    position:absolute;
    inset:0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px
    );
    pointer-events:none;
    opacity:.55;
  }

  .pzo-tick-countdown__row {
    position: relative;
    z-index: 1;
    display:flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }

  .pzo-tick-countdown__lbl {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--hud-amber);
  }

  .pzo-tick-countdown__time {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: .08em;
    line-height: 1;
    color: var(--hud-text-bright);
    text-shadow: 0 0 10px rgba(201,168,76,.10);
  }

  .pzo-tick-countdown--warn .pzo-tick-countdown__time {
    color: var(--hud-amber);
    text-shadow: 0 0 12px rgba(201,168,76,.25);
  }

  .pzo-tick-countdown--crit {
    border-color: var(--hud-crimson);
    box-shadow: 0 0 16px rgba(192,57,43,.20), inset 0 0 24px rgba(192,57,43,.16);
    animation: pzoTickPulse .65s ease-in-out infinite alternate;
  }
  .pzo-tick-countdown--crit .pzo-tick-countdown__time {
    color: var(--hud-crimson);
    text-shadow: 0 0 14px rgba(192,57,43,.35);
  }

  .pzo-tick-countdown__bar {
    position: relative;
    z-index: 1;
    height: 2px;
    width: 100%;
    background: var(--hud-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .pzo-tick-countdown__barFill {
    height: 100%;
    transition: width 120ms linear;
    border-radius: 2px;
  }

  @keyframes pzoTickPulse { from { opacity: .75 } to { opacity: 1 } }
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  const id = 'pzo-tick-countdown-styles';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = STYLES;
  document.head.appendChild(el);
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function formatTime(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = safe / 1000;

  if (totalSeconds >= 60) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  if (totalSeconds >= 10) {
    return `${Math.ceil(totalSeconds)}`;
  }

  // show tenths under 10 seconds for urgency
  return totalSeconds.toFixed(1);
}

export default function TickCountdownDisplay({
  timeLeft,
  onTimeUp,
  unit = 's',
  label = 'NEXT TICK',
  warningAtSeconds = 20,
  criticalAtSeconds = 10,
  className,
  style,
}: TickCountdownDisplayProps) {
  const initialMs = useMemo(() => {
    const base = Number.isFinite(timeLeft) ? timeLeft : 0;
    return unit === 'ms' ? Math.max(0, base) : Math.max(0, base * 1000);
  }, [timeLeft, unit]);

  const [remainingMs, setRemainingMs] = useState<number>(initialMs);

  const firedRef = useRef(false);
  const endAtRef = useRef<number>(Date.now() + initialMs);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    firedRef.current = false;
    setRemainingMs(initialMs);
    endAtRef.current = Date.now() + initialMs;

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const tick = () => {
      const now = Date.now();
      const next = Math.max(0, endAtRef.current - now);
      setRemainingMs(next);

      if (next <= 0) {
        if (!firedRef.current) {
          firedRef.current = true;
          onTimeUp();
        }
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [initialMs, onTimeUp]);

  const secondsLeft = remainingMs / 1000;
  const isCrit = secondsLeft <= criticalAtSeconds;
  const isWarn = !isCrit && secondsLeft <= warningAtSeconds;

  const rootClass = [
    'pzo-tick-countdown',
    isCrit ? 'pzo-tick-countdown--crit' : isWarn ? 'pzo-tick-countdown--warn' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const progress = useMemo(() => {
    if (initialMs <= 0) return 0;
    return clamp(remainingMs / initialMs, 0, 1);
  }, [remainingMs, initialMs]);

  const barColor = isCrit
    ? 'var(--hud-crimson)'
    : isWarn
      ? 'var(--hud-amber)'
      : 'var(--hud-teal)';

  return (
    <div className={rootClass} style={style} role="status" aria-live="polite" aria-label={`${label} countdown`}>
      <div className="pzo-tick-countdown__row">
        <span className="pzo-tick-countdown__lbl">{label}</span>
        <span className="pzo-tick-countdown__time">{formatTime(remainingMs)}</span>
      </div>

      <div className="pzo-tick-countdown__bar" aria-hidden="true">
        <div
          className="pzo-tick-countdown__barFill"
          style={{ width: `${Math.round(progress * 100)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}