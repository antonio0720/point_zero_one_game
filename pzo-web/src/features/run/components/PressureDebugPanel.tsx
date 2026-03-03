/**
 * FILE: src/features/run/components/PressureDebugPanel.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * PressureDebugPanel — dev-only inspector for the Pressure engine
 * - Zero hard dependencies beyond usePressureEngine() and (optionally) PressureGauge
 * - No alias imports (works alongside GameHUD relative structure)
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePressureEngine } from '../hooks/usePressureEngine';
import { PressureGauge } from './PressureGauge';

const PRESSURE_DEBUG_STYLES = `
  .pzo-pressure-debug {
    --bg: #080a0d;
    --panel: #0c0f14;
    --border: #1a2030;
    --amber: #c9a84c;
    --crimson: #c0392b;
    --teal: #1de9b6;
    --text: #8fa0b8;
    --textHi: #c8d8f0;
    --mono: 'Share Tech Mono', monospace;
    --ui: 'Rajdhani', sans-serif;

    position: fixed;
    right: 10px;
    bottom: 10px;
    z-index: 9999;
    width: 360px;
    max-width: calc(100vw - 20px);
    border: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(12,15,20,.96), rgba(8,10,13,.96));
    border-radius: 6px;
    box-shadow: 0 12px 40px rgba(0,0,0,.55);
    overflow: hidden;
    user-select: none;
  }

  .pzo-pressure-debug__hdr {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 8px 10px;
    border-bottom: 1px solid var(--border);
  }

  .pzo-pressure-debug__title {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: .18em;
    color: var(--amber);
    text-transform: uppercase;
    flex: 1;
  }

  .pzo-pressure-debug__btn {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: .12em;
    color: var(--textHi);
    background: #111820;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 6px 8px;
    cursor: pointer;
  }

  .pzo-pressure-debug__btn:hover { border-color: var(--amber); }

  .pzo-pressure-debug__body {
    padding: 10px;
    display: grid;
    gap: 10px;
  }

  .pzo-pressure-debug__grid {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 10px;
    align-items: start;
  }

  .pzo-pressure-debug__kv {
    display: grid;
    gap: 6px;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: .08em;
    color: var(--text);
  }
  .pzo-pressure-debug__kv b { color: var(--textHi); font-weight: 700; letter-spacing: .06em; }

  .pzo-pressure-debug__pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(17,24,32,.8);
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: .12em;
    color: var(--textHi);
    width: fit-content;
  }

  .pzo-pressure-debug__json {
    border: 1px solid var(--border);
    background: rgba(17,24,32,.75);
    border-radius: 6px;
    padding: 8px;
    color: var(--textHi);
    font-family: var(--mono);
    font-size: 9px;
    line-height: 1.35;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

function injectPressureDebugStyles() {
  if (typeof document === 'undefined') return;
  const id = 'pzo-pressure-debug-styles';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = PRESSURE_DEBUG_STYLES;
  document.head.appendChild(el);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export interface PressureDebugPanelProps {
  readonly defaultOpen?: boolean;
  readonly showRawJSON?: boolean;
}

const PressureDebugPanel: React.FC<PressureDebugPanelProps> = ({
  defaultOpen = false,
  showRawJSON = true,
}) => {
  const engine = usePressureEngine();

  useEffect(() => {
    injectPressureDebugStyles();
  }, []);

  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [copied, setCopied] = useState<boolean>(false);

  const tier = (engine as any)?.tier ?? 'CALM';
  const score01 = clamp01((engine as any)?.score ?? 0);
  const score100 = Math.round(score01 * 100);

  const ticksToCalm = (engine as any)?.ticksToCalm ?? 0;
  const isCritical = Boolean((engine as any)?.isCritical || tier === 'CRITICAL');
  const isEscalating = Boolean((engine as any)?.isEscalating);
  const isDecaying = Boolean((engine as any)?.isDecaying);

  const dominantSignal = (engine as any)?.dominantSignal;
  const currentTick = (engine as any)?.currentTick;

  const engineJSON = useMemo(() => {
    try {
      return JSON.stringify(engine, null, 2);
    } catch {
      return '{"error":"engine snapshot not serializable"}';
    }
  }, [engine]);

  const tierColor =
    String(tier) === 'CALM' ? '#4ade80'
    : String(tier) === 'BUILDING' ? '#c9a84c'
    : String(tier) === 'ELEVATED' ? '#f97316'
    : String(tier) === 'HIGH' ? '#ef4444'
    : String(tier) === 'CRITICAL' ? '#ff0000'
    : '#8fa0b8';

  const copyJSON = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(engineJSON);
        setCopied(true);
        setTimeout(() => setCopied(false), 900);
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="pzo-pressure-debug" aria-live="polite">
      <div className="pzo-pressure-debug__hdr">
        <div className="pzo-pressure-debug__title">PRESSURE DEBUG</div>
        <button className="pzo-pressure-debug__btn" onClick={() => setOpen((v) => !v)}>
          {open ? 'HIDE' : 'SHOW'}
        </button>
        {showRawJSON && open && (
          <button className="pzo-pressure-debug__btn" onClick={copyJSON}>
            {copied ? 'COPIED' : 'COPY JSON'}
          </button>
        )}
      </div>

      {open && (
        <div className="pzo-pressure-debug__body">
          <div className="pzo-pressure-debug__grid">
            <div>
              <PressureGauge orientation="vertical" label="PRESSURE" showTicksToCalm />
            </div>

            <div className="pzo-pressure-debug__kv">
              <div className="pzo-pressure-debug__pill" style={{ borderColor: tierColor }}>
                <span style={{ color: tierColor, fontWeight: 700 }}>{String(tier)}</span>
                <span style={{ color: '#8fa0b8' }}>·</span>
                <span>{score100}</span>
                {isEscalating && <span style={{ color: '#ef4444' }}>▲</span>}
                {isDecaying && <span style={{ color: '#4ade80' }}>▼</span>}
                {isCritical && <span style={{ color: '#c0392b' }}>CRIT</span>}
              </div>

              <div><b>SCORE</b> {score01.toFixed(4)} ({score100}%)</div>
              <div><b>TICKS_TO_CALM</b> {String(ticksToCalm)}</div>
              {typeof currentTick === 'number' && <div><b>CURRENT_TICK</b> {String(currentTick)}</div>}
              {typeof dominantSignal === 'string' && <div><b>DOMINANT_SIGNAL</b> {dominantSignal}</div>}
            </div>
          </div>

          {showRawJSON && (
            <pre className="pzo-pressure-debug__json">{engineJSON}</pre>
          )}
        </div>
      )}
    </div>
  );
};

export default PressureDebugPanel;