/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/ShieldStack.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * ShieldStack — 4-layer visual shield display.
 * Reads from useShieldEngine hook only (no engine-type imports).
 *
 * Visual states:
 *   - Fortified: teal badge glow
 *   - Low: amber highlight
 *   - Critical: crimson pulse
 *   - Breached: OFFLINE / BREACHED marker
 */

'use client';

import React, { useEffect, useMemo } from 'react';
import { useShieldEngine } from '../hooks/useShieldEngine';

type ShieldLayerLike = {
  integrityPct?: number; // 0..1
  isLowWarning?: boolean;
  isCriticalWarning?: boolean;
  isBreached?: boolean;
  currentIntegrity?: number;
  maxIntegrity?: number;
};

type ShieldEngineLike = {
  layers?: Record<string, ShieldLayerLike>;
  isFortified?: boolean;
  overallPct?: number;
  overallPct100?: number;
  isInBreachCascade?: boolean;
  cascadeCount?: number;
  isAnyLow?: boolean;
};

const SHIELD_STACK_STYLES = `
  .pzo-shield-stack {
    --hud-bg:           #080a0d;
    --hud-panel:        #0c0f14;
    --hud-border:       #1a2030;
    --hud-amber:        #c9a84c;
    --hud-crimson:      #c0392b;
    --hud-teal:         #1de9b6;
    --hud-text:         #8fa0b8;
    --hud-text-bright:  #c8d8f0;
    --font-mono:        'Share Tech Mono', monospace;

    background: var(--hud-panel);
    border: 1px solid var(--hud-border);
    border-radius: 3px;
    padding: 8px;
    clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
    user-select: none;
  }

  .pzo-shield-stack--critical {
    border-color: var(--hud-crimson);
    box-shadow: 0 0 16px rgba(192,57,43,.2), inset 0 0 24px rgba(192,57,43,.2);
    animation: pzoShieldCritPulse .85s ease-in-out infinite alternate;
  }
  .pzo-shield-stack--warning {
    border-color: var(--hud-amber);
    box-shadow: 0 0 12px rgba(201,168,76,.15), inset 0 0 20px rgba(201,168,76,.12);
  }
  .pzo-shield-stack--fortified {
    border-color: var(--hud-teal);
    box-shadow: 0 0 12px rgba(29,233,182,.15), inset 0 0 20px rgba(29,233,182,.10);
  }

  .pzo-shield-stack__hdr {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  .pzo-shield-stack__title {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--hud-amber);
  }

  .pzo-shield-stack__overall {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
    color: var(--hud-text-bright);
  }

  .pzo-shield-stack__badge {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: .15em;
    padding: 1px 6px;
    border-radius: 2px;
    border: 1px solid var(--hud-teal);
    color: var(--hud-teal);
    animation: pzoShieldFortGlow 1.5s ease-in-out infinite alternate;
  }

  .pzo-shield-stack__cascade {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: .15em;
    color: var(--hud-crimson);
    margin-left: 6px;
    animation: pzoShieldCritPulse .7s ease-in-out infinite alternate;
  }

  .pzo-shield-stack__rows {
    display: grid;
    gap: 6px;
  }

  .pzo-shield-row {
    display: grid;
    grid-template-columns: 34px 1fr 46px;
    align-items: center;
    gap: 6px;
  }

  .pzo-shield-row__id {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .1em;
    color: var(--hud-text);
  }

  .pzo-shield-row__track {
    height: 8px;
    background: #111820;
    border: 1px solid var(--hud-border);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .pzo-shield-row__fill {
    height: 100%;
    border-radius: 1px;
    transition: width .7s ease;
    position: relative;
  }
  .pzo-shield-row__fill::after {
    content:'';
    position:absolute;
    top:0; right:0;
    width:2px; height:100%;
    background: rgba(255,255,255,.6);
  }

  .pzo-shield-row__pct {
    font-family: var(--font-mono);
    font-size: 9px;
    text-align: right;
    letter-spacing: .08em;
    color: var(--hud-text);
  }

  .pzo-shield-row__pct--breached {
    color: var(--hud-crimson);
  }

  .pzo-shield-row__meta {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: .12em;
    color: var(--hud-text);
    opacity: .9;
  }

  .pzo-shield-row__breach {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: .15em;
    color: var(--hud-crimson);
    text-transform: uppercase;
  }

  @keyframes pzoShieldCritPulse { from{opacity:.7} to{opacity:1} }
  @keyframes pzoShieldFortGlow  { from{box-shadow:0 0 4px rgba(29,233,182,.3)} to{box-shadow:0 0 10px rgba(29,233,182,.7)} }
`;

function injectShieldStackStyles() {
  if (typeof document === 'undefined') return;
  const id = 'pzo-shield-stack-styles';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = SHIELD_STACK_STYLES;
  document.head.appendChild(el);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

const SHIELD_LABELS: Record<string, string> = {
  LIQUIDITY_BUFFER: 'LIQ',
  CREDIT_LINE: 'CRD',
  ASSET_FLOOR: 'AST',
  NETWORK_CORE: 'NET',
};

const ORDER = ['LIQUIDITY_BUFFER', 'CREDIT_LINE', 'ASSET_FLOOR', 'NETWORK_CORE'];

export function ShieldStack(): JSX.Element | null {
  const shield = useShieldEngine() as unknown as ShieldEngineLike;

  useEffect(() => {
    injectShieldStackStyles();
  }, []);

  const layers = shield.layers ?? null;
  if (!layers) return null;

  const keys = useMemo(() => {
    const present = Object.keys(layers);
    const ordered = ORDER.filter((k) => present.includes(k));
    const rest = present.filter((k) => !ordered.includes(k)).sort();
    return [...ordered, ...rest];
  }, [layers]);

  const overallPct100 =
    typeof shield.overallPct100 === 'number'
      ? shield.overallPct100
      : Math.round(clamp01(shield.overallPct ?? 0) * 100);

  const isCritical = Boolean(shield.isInBreachCascade) || keys.some((k) => Boolean(layers[k]?.isCriticalWarning));
  const isWarning = Boolean(shield.isAnyLow) || keys.some((k) => Boolean(layers[k]?.isLowWarning));

  const className = [
    'pzo-shield-stack',
    shield.isFortified ? 'pzo-shield-stack--fortified' : '',
    isCritical ? 'pzo-shield-stack--critical' : '',
    !isCritical && isWarning ? 'pzo-shield-stack--warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} data-cascade-count={shield.cascadeCount ?? 0}>
      <div className="pzo-shield-stack__hdr">
        <span className="pzo-shield-stack__title">SHIELDS</span>
        <span className="pzo-shield-stack__overall">{overallPct100}%</span>
        {shield.isFortified && <span className="pzo-shield-stack__badge">FORTIFIED</span>}
        {shield.isInBreachCascade && (
          <span className="pzo-shield-stack__cascade">⚡ CASCADE ×{shield.cascadeCount ?? 0}</span>
        )}
      </div>

      <div className="pzo-shield-stack__rows">
        {keys.map((id) => {
          const layer = layers[id] ?? {};
          const hp = clamp01(layer.integrityPct ?? 0);
          const pct = Math.round(hp * 100);

          const color = layer.isBreached
            ? '#334155'
            : layer.isCriticalWarning
              ? 'var(--hud-crimson)'
              : layer.isLowWarning
                ? 'var(--hud-amber)'
                : 'var(--hud-teal)';

          const fillBg = layer.isBreached
            ? '#111820'
            : layer.isCriticalWarning
              ? 'linear-gradient(90deg, rgba(127,29,29,.65), rgba(192,57,43,1))'
              : layer.isLowWarning
                ? 'linear-gradient(90deg, rgba(122,95,31,.65), rgba(201,168,76,1))'
                : 'linear-gradient(90deg, rgba(29,233,182,.55), rgba(29,233,182,1))';

          return (
            <div key={id}>
              <div className="pzo-shield-row" data-layer-id={id}>
                <span className="pzo-shield-row__id">{SHIELD_LABELS[id] ?? id.slice(0, 3)}</span>
                <div className="pzo-shield-row__track">
                  <div
                    className="pzo-shield-row__fill"
                    style={{
                      width: `${pct}%`,
                      background: fillBg,
                      boxShadow: layer.isBreached ? 'none' : `0 0 10px ${String(color)}33`,
                      opacity: layer.isBreached ? 0.65 : 1,
                    }}
                  />
                </div>
                <span className={`pzo-shield-row__pct ${layer.isBreached ? 'pzo-shield-row__pct--breached' : ''}`}>
                  {layer.isBreached ? 'OFF' : `${pct}%`}
                </span>

                <div className="pzo-shield-row__meta">
                  {layer.isBreached ? (
                    <span className="pzo-shield-row__breach">BREACHED</span>
                  ) : (
                    <span>
                      {(typeof layer.currentIntegrity === 'number' ? layer.currentIntegrity : '—')} /{' '}
                      {(typeof layer.maxIntegrity === 'number' ? layer.maxIntegrity : '—')}
                    </span>
                  )}
                  <span style={{ color }}>
                    {layer.isCriticalWarning ? 'CRITICAL' : layer.isLowWarning ? 'LOW' : layer.isBreached ? 'OFFLINE' : 'OK'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShieldStack;