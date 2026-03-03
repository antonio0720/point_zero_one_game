/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/TickPressureBorder.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * TickPressureBorder — HUD-aligned border overlay that reacts to Pressure + Tension.
 * - Designed to sit behind TickCountdownDisplay (pointer-events none).
 * - Auto severity:
 *    CRITICAL if Pressure.isCritical OR tier=CRITICAL OR Tension.threatUrgency=URGENT
 *    WARNING  if Pressure tier != CALM OR Tension score >= 0.45
 * - Uses HUD CSS vars when present; injects its own CSS.
 */

'use client';

import React, { useEffect, useMemo } from 'react';
import { usePressureEngine } from '../hooks/usePressureEngine';
import { useTensionEngine } from '../hooks/useTensionEngine';

export interface TickPressureBorderProps {
  readonly insetPx?: number;
  readonly radiusPx?: number;
  readonly zIndex?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

type PressureEngineLike = {
  tier?: string;
  score?: number;
  isCritical?: boolean;
};

type TensionEngineLike = {
  threatUrgency?: string;
  score?: number;
};

const STYLES = `
  .pzo-tick-border {
    --hud-border:       var(--hud-border, #1a2030);
    --hud-amber:        var(--hud-amber, #c9a84c);
    --hud-crimson:      var(--hud-crimson, #c0392b);
    --hud-teal:         var(--hud-teal, #1de9b6);

    position: absolute;
    pointer-events: none;
    border: 1px solid var(--hud-border);
    border-radius: 10px;
    background: transparent;
    overflow: hidden;
  }

  .pzo-tick-border::before {
    content:'';
    position:absolute;
    inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,.03), transparent 35%, rgba(0,0,0,.25));
    opacity:.8;
  }

  .pzo-tick-border::after {
    content:'';
    position:absolute;
    inset:-40%;
    background: radial-gradient(circle at 30% 20%, rgba(255,255,255,.05), transparent 35%);
    transform: rotate(12deg);
    opacity:.6;
  }

  .pzo-tick-border--warn {
    border-color: var(--hud-amber);
    box-shadow: 0 0 12px rgba(201,168,76,.18), inset 0 0 18px rgba(201,168,76,.12);
  }

  .pzo-tick-border--crit {
    border-color: var(--hud-crimson);
    box-shadow: 0 0 16px rgba(192,57,43,.22), inset 0 0 24px rgba(192,57,43,.16);
    animation: pzoTickBorderPulse .65s ease-in-out infinite alternate;
  }

  .pzo-tick-border--safe {
    border-color: rgba(29,233,182,.35);
    box-shadow: 0 0 10px rgba(29,233,182,.12), inset 0 0 18px rgba(29,233,182,.08);
  }

  .pzo-tick-border__scanline {
    position:absolute;
    inset:0;
    background: repeating-linear-gradient(
      0deg,
      transparent, transparent 2px,
      rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px
    );
    opacity:.55;
    mix-blend-mode: multiply;
  }

  @keyframes pzoTickBorderPulse { from { opacity:.78 } to { opacity: 1 } }
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  const id = 'pzo-tick-border-styles';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = STYLES;
  document.head.appendChild(el);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export default function TickPressureBorder({
  insetPx = 6,
  radiusPx = 10,
  zIndex = 1,
  className,
  style,
}: TickPressureBorderProps) {
  const p = usePressureEngine() as unknown as PressureEngineLike;
  const t = useTensionEngine() as unknown as TensionEngineLike;

  useEffect(() => {
    injectStyles();
  }, []);

  const severity = useMemo<'safe' | 'warn' | 'crit'>(() => {
    const tier = String(p?.tier ?? 'CALM').toUpperCase();
    const pCrit = Boolean(p?.isCritical) || tier === 'CRITICAL';
    const tUrgent = String(t?.threatUrgency ?? '').toUpperCase() === 'URGENT';

    if (pCrit || tUrgent) return 'crit';

    const pScore = clamp01(p?.score ?? 0);
    const tScore = clamp01(t?.score ?? 0);

    if (tier !== 'CALM' || pScore >= 0.55 || tScore >= 0.45) return 'warn';
    return 'safe';
  }, [p?.tier, p?.isCritical, p?.score, t?.threatUrgency, t?.score]);

  const rootClass = [
    'pzo-tick-border',
    severity === 'crit' ? 'pzo-tick-border--crit' : severity === 'warn' ? 'pzo-tick-border--warn' : 'pzo-tick-border--safe',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <div
      className={rootClass}
      style={{
        inset: insetPx,
        borderRadius: radiusPx,
        zIndex,
        ...style,
      }}
      aria-hidden="true"
      data-severity={severity}
    >
      <div className="pzo-tick-border__scanline" />
    </div>
  );
}