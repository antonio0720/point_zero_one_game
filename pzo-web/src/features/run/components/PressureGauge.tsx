/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/PressureGauge.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * PressureGauge — compact linear gauge (vertical/horizontal) compatible with usePressureEngine()
 * Styling aligns with GameHUD “black glass / amber / crimson” terminal aesthetic.
 */

'use client';

import React, { useEffect, useMemo } from 'react';
import { usePressureEngine } from '../hooks/usePressureEngine';

const PRESSURE_GAUGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');

  .pzo-pressure-gauge {
    --bg: #080a0d;
    --panel: #0c0f14;
    --border: #1a2030;
    --text: #8fa0b8;
    --textHi: #c8d8f0;
    --mono: 'Share Tech Mono', monospace;
    --ui: 'Rajdhani', sans-serif;

    display: grid;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--border);
    background: var(--panel);
    border-radius: 3px;
    clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
    user-select: none;
  }

  .pzo-pressure-gauge__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .pzo-pressure-gauge__lbl {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: .2em;
    color: #c9a84c;
    text-transform: uppercase;
  }

  .pzo-pressure-gauge__meta {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: .12em;
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .pzo-pressure-gauge__meta strong {
    color: var(--textHi);
    font-weight: 700;
  }

  .pzo-pressure-gauge__track {
    position: relative;
    border: 1px solid var(--border);
    background: #111820;
    border-radius: 2px;
    overflow: hidden;
  }

  .pzo-pressure-gauge__track--vertical { width: 14px; height: 86px; }
  .pzo-pressure-gauge__track--horizontal { width: 100%; height: 12px; }

  .pzo-pressure-gauge__fill {
    position: absolute;
    inset: auto 0 0 0;
    border-radius: 1px;
    transition: all 800ms linear;
  }
  .pzo-pressure-gauge__fill--horizontal {
    inset: 0 auto 0 0;
  }

  .pzo-pressure-gauge__cap {
    position: absolute;
    top: 0;
    right: 0;
    width: 2px;
    height: 100%;
    background: rgba(255,255,255,.65);
  }

  .pzo-pressure-gauge__pulse {
    animation: pzoPressurePulse 700ms ease-in-out infinite alternate;
  }

  @keyframes pzoPressurePulse { from { opacity: .75 } to { opacity: 1 } }
`;

function injectPressureGaugeStyles() {
  if (typeof document === 'undefined') return;
  const id = 'pzo-pressure-gauge-styles';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = PRESSURE_GAUGE_STYLES;
  document.head.appendChild(el);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

const TIER_COLORS: Record<string, string> = {
  CALM: '#4ade80',
  BUILDING: '#c9a84c',
  ELEVATED: '#f97316',
  HIGH: '#ef4444',
  CRITICAL: '#ff0000',
};

export type PressureGaugeOrientation = 'vertical' | 'horizontal';

export interface PressureGaugeProps {
  readonly orientation?: PressureGaugeOrientation;
  readonly label?: string;
  readonly showTicksToCalm?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export function PressureGauge({
  orientation = 'vertical',
  label = 'PRESSURE',
  showTicksToCalm = true,
  className,
  style,
}: PressureGaugeProps) {
  const engine = usePressureEngine();

  useEffect(() => {
    injectPressureGaugeStyles();
  }, []);

  const tier = (engine as any)?.tier ?? 'CALM';
  const score01 = clamp01((engine as any)?.score ?? 0);
  const pct = Math.round(score01 * 100);

  const isEscalating = Boolean((engine as any)?.isEscalating);
  const isDecaying = Boolean((engine as any)?.isDecaying);
  const ticksToCalm = (engine as any)?.ticksToCalm ?? 0;
  const isCritical = Boolean((engine as any)?.isCritical || tier === 'CRITICAL');

  const color = TIER_COLORS[String(tier)] ?? '#8fa0b8';

  const barStyle = useMemo<React.CSSProperties>(() => {
    if (orientation === 'horizontal') {
      return {
        width: `${pct}%`,
        height: '100%',
        background: color,
        boxShadow: `0 0 10px ${color}33`,
      };
    }
    return {
      height: `${pct}%`,
      width: '100%',
      background: color,
      boxShadow: `0 0 10px ${color}33`,
    };
  }, [orientation, pct, color]);

  return (
    <div className={`pzo-pressure-gauge ${className ?? ''}`.trim()} style={style}>
      <div className="pzo-pressure-gauge__row">
        <span className="pzo-pressure-gauge__lbl">{label}</span>
        <span className="pzo-pressure-gauge__meta">
          <strong style={{ color }}>{String(tier)}</strong>
          {isEscalating && <span style={{ color: '#ef4444' }}>▲</span>}
          {isDecaying && <span style={{ color: '#4ade80' }}>▼</span>}
          <span style={{ color: 'var(--text)' }}>{pct}</span>
        </span>
      </div>

      <div className={`pzo-pressure-gauge__track pzo-pressure-gauge__track--${orientation}`}>
        <div
          className={[
            'pzo-pressure-gauge__fill',
            orientation === 'horizontal' ? 'pzo-pressure-gauge__fill--horizontal' : '',
            isCritical ? 'pzo-pressure-gauge__pulse' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={barStyle}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Pressure"
        >
          <div className="pzo-pressure-gauge__cap" />
        </div>
      </div>

      {showTicksToCalm && String(tier) !== 'CALM' && (
        <div className="pzo-pressure-gauge__row">
          <span className="pzo-pressure-gauge__meta" style={{ marginLeft: 'auto' }}>
            <span style={{ color: 'var(--text)' }}>TO CALM</span>
            <strong style={{ color: 'var(--textHi)' }}>{String(ticksToCalm)}t</strong>
          </span>
        </div>
      )}
    </div>
  );
}

export default PressureGauge;