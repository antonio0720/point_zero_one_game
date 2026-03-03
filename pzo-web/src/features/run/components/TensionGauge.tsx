/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/TensionGauge.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * TensionGauge — compact gauge aligned with GameHUD terminal aesthetic.
 * - Reads from useTensionEngine only (cast-safe to avoid hook type drift).
 * - Injects its own CSS (no external stylesheet dependency).
 * - Uses HUD CSS variables when present; falls back to sane defaults.
 */

'use client';

import React, { useEffect, useMemo } from 'react';
import { useTensionEngine } from '../hooks/useTensionEngine';

export type TensionGaugeOrientation = 'vertical' | 'horizontal';

export interface TensionGaugeProps {
  readonly orientation?: TensionGaugeOrientation;
  readonly showLabel?: boolean;
  readonly showBadges?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

type ThreatUrgency = 'CALM' | 'BUILDING' | 'URGENT' | string;

type TensionEngineLike = {
  score?: number; // 0..1
  scorePct?: number; // 0..100
  visibilityState?: string;

  queueLength?: number;
  arrivedCount?: number;
  queuedCount?: number;

  isPulseActive?: boolean;
  isSustainedPulse?: boolean;
  isEscalating?: boolean;

  threatUrgency?: ThreatUrgency;

  // optional extras that may exist in your engine
  pulseTicksActive?: number;
  expiredCount?: number;
  currentTick?: number;
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');

  .pzo-tension-gauge {
    --hud-panel:        var(--hud-panel, #0c0f14);
    --hud-border:       var(--hud-border, #1a2030);
    --hud-amber:        var(--hud-amber, #c9a84c);
    --hud-crimson:      var(--hud-crimson, #c0392b);
    --hud-teal:         var(--hud-teal, #1de9b6);
    --hud-text:         var(--hud-text, #8fa0b8);
    --hud-text-bright:  var(--hud-text-bright, #c8d8f0);
    --hud-muted:        var(--hud-muted, #3a4a60);
    --font-mono:        var(--font-mono, 'Share Tech Mono', monospace);
    --font-ui:          var(--font-ui, 'Rajdhani', sans-serif);

    display: grid;
    gap: 8px;
    padding: 8px;
    background: var(--hud-panel);
    border: 1px solid var(--hud-border);
    border-radius: 3px;
    clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
    user-select: none;
    position: relative;
    overflow: hidden;
  }

  .pzo-tension-gauge::before {
    content:'';
    position:absolute;
    inset:0;
    background: repeating-linear-gradient(
      0deg,
      transparent, transparent 2px,
      rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px
    );
    pointer-events:none;
    opacity:.55;
  }

  .pzo-tension-gauge__top {
    position: relative;
    z-index: 1;
    display:flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }

  .pzo-tension-gauge__label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .2em;
    color: var(--hud-amber);
    text-transform: uppercase;
    display:flex;
    align-items:center;
    gap:8px;
  }
  .pzo-tension-gauge__label::after{
    content:'';
    width: 44px;
    height: 1px;
    background: linear-gradient(to right, rgba(201,168,76,.55), transparent);
  }

  .pzo-tension-gauge__score {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--hud-text-bright);
  }

  .pzo-tension-gauge__meta {
    position: relative;
    z-index: 1;
    display:flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .pzo-tension-chip {
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: .15em;
    padding: 2px 6px;
    border-radius: 2px;
    text-transform: uppercase;
    border: 1px solid var(--hud-border);
    background: rgba(255,255,255,0.02);
    color: var(--hud-text);
  }

  .pzo-tension-chip--urgent {
    border-color: var(--hud-crimson);
    color: var(--hud-crimson);
    background: rgba(192,57,43,.12);
    animation: pzoTensionPulse .65s ease-in-out infinite alternate;
  }

  .pzo-tension-chip--building {
    border-color: var(--hud-amber);
    color: var(--hud-amber);
    background: rgba(201,168,76,.10);
  }

  .pzo-tension-chip--calm {
    border-color: rgba(29,233,182,.35);
    color: var(--hud-teal);
    background: rgba(29,233,182,.06);
  }

  .pzo-tension-chip--pulse {
    border-color: var(--hud-crimson);
    color: var(--hud-crimson);
    background: rgba(192,57,43,.08);
    animation: pzoTensionPulse .55s ease-in-out infinite alternate;
  }

  .pzo-tension-chip--rise {
    border-color: rgba(255,255,255,.15);
    color: var(--hud-text-bright);
  }

  .pzo-tension-track {
    position: relative;
    z-index: 1;
    border: 1px solid var(--hud-border);
    background: #111820;
    border-radius: 2px;
    overflow: hidden;
  }

  .pzo-tension-track--vertical { width: 14px; height: 86px; justify-self: start; }
  .pzo-tension-track--horizontal { width: 100%; height: 12px; }

  .pzo-tension-fill {
    position:absolute;
    inset:auto 0 0 0;
    border-radius: 1px;
    transition: all 900ms linear;
  }
  .pzo-tension-fill--horizontal { inset: 0 auto 0 0; }

  .pzo-tension-fill::after {
    content:'';
    position:absolute;
    top:0;
    right:0;
    width:2px;
    height:100%;
    background: rgba(255,255,255,.65);
  }

  .pzo-tension-fill--urgent {
    filter: drop-shadow(0 0 10px rgba(192,57,43,.45));
    animation: pzoTensionPulse .65s ease-in-out infinite alternate;
  }

  .pzo-tension-foot {
    position: relative;
    z-index: 1;
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 6px;
    border-top: 1px solid var(--hud-border);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .10em;
    color: var(--hud-text);
  }

  @keyframes pzoTensionPulse { from { opacity:.75 } to { opacity: 1 } }
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  const id = 'pzo-tension-gauge-styles';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = STYLES;
  document.head.appendChild(el);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const clampInt = (n: unknown, d = 0) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : d;
};

const tensionFillColor = (score01: number, urgency: ThreatUrgency) => {
  const s = clamp01(score01);
  if (String(urgency).toUpperCase() === 'URGENT') return 'linear-gradient(90deg, rgba(127,29,29,.65), rgba(192,57,43,1))';
  if (s >= 0.85) return 'linear-gradient(90deg, rgba(236,72,153,.65), rgba(236,72,153,1))'; // hot magenta
  if (s >= 0.55) return 'linear-gradient(90deg, rgba(168,85,247,.55), rgba(168,85,247,1))'; // violet
  return 'linear-gradient(90deg, rgba(124,58,237,.50), rgba(124,58,237,1))'; // deep violet
};

export function TensionGauge({
  orientation = 'vertical',
  showLabel = true,
  showBadges = true,
  className,
  style,
}: TensionGaugeProps): React.ReactElement {
  const t = useTensionEngine() as unknown as TensionEngineLike;

  useEffect(() => {
    injectStyles();
  }, []);

  const urgency: ThreatUrgency = t.threatUrgency ?? 'CALM';
  const score01 = clamp01(t.score ?? 0);
  const pct = useMemo(() => {
    if (typeof t.scorePct === 'number' && Number.isFinite(t.scorePct)) return Math.round(Math.max(0, Math.min(100, t.scorePct)));
    return Math.round(score01 * 100);
  }, [t.scorePct, score01]);

  const queueLength = clampInt(t.queueLength, 0);
  const arrivedCount = clampInt(t.arrivedCount, 0);
  const queuedCount = clampInt(t.queuedCount, queueLength);

  const isPulseActive = Boolean(t.isPulseActive);
  const isSustainedPulse = Boolean(t.isSustainedPulse);
  const isEscalating = Boolean(t.isEscalating);

  const isUrgent = String(urgency).toUpperCase() === 'URGENT';
  const isBuilding = String(urgency).toUpperCase() === 'BUILDING';

  const trackClass = `pzo-tension-track pzo-tension-track--${orientation}`;
  const fillClass = [
    'pzo-tension-fill',
    orientation === 'horizontal' ? 'pzo-tension-fill--horizontal' : '',
    isUrgent ? 'pzo-tension-fill--urgent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const fillStyle: React.CSSProperties =
    orientation === 'vertical'
      ? { height: `${pct}%`, width: '100%', background: tensionFillColor(score01, urgency) }
      : { width: `${pct}%`, height: '100%', background: tensionFillColor(score01, urgency) };

  const rootClass = [
    'pzo-tension-gauge',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const visibility = t.visibilityState ? String(t.visibilityState).toUpperCase() : null;

  return (
    <div
      className={rootClass}
      style={style}
      role="meter"
      aria-label="Tension"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      data-urgency={urgency}
      data-pulse={isPulseActive ? '1' : '0'}
    >
      <div className="pzo-tension-gauge__top">
        {showLabel ? (
          <div className="pzo-tension-gauge__label">
            TENSION
          </div>
        ) : (
          <div />
        )}
        <div className="pzo-tension-gauge__score" style={{ color: isUrgent ? 'var(--hud-crimson)' : 'var(--hud-text-bright)' }}>
          {pct}
        </div>
      </div>

      <div className="pzo-tension-gauge__meta" aria-hidden={!showBadges}>
        {showBadges && (
          <span
            className={[
              'pzo-tension-chip',
              isUrgent ? 'pzo-tension-chip--urgent' : isBuilding ? 'pzo-tension-chip--building' : 'pzo-tension-chip--calm',
            ].join(' ')}
            title="Threat urgency"
          >
            {String(urgency).toUpperCase()}
          </span>
        )}

        {showBadges && visibility && (
          <span className="pzo-tension-chip" title="Visibility state">
            VIS {visibility}
          </span>
        )}

        {showBadges && isPulseActive && (
          <span className="pzo-tension-chip pzo-tension-chip--pulse" title="Pulse active">
            PULSE{typeof t.pulseTicksActive === 'number' ? `×${Math.max(0, Math.trunc(t.pulseTicksActive))}` : ''}
          </span>
        )}

        {showBadges && isSustainedPulse && (
          <span className="pzo-tension-chip pzo-tension-chip--pulse" title="Sustained pulse">
            SUSTAINED
          </span>
        )}

        {showBadges && isEscalating && (
          <span className="pzo-tension-chip pzo-tension-chip--rise" title="Tension rising">
            ▲ RISING
          </span>
        )}
      </div>

      <div className={trackClass}>
        <div className={fillClass} style={fillStyle} />
      </div>

      <div className="pzo-tension-foot">
        <span title="Arrived / queued / total">
          {arrivedCount}↓ {queuedCount}⏳ {queueLength}Σ
        </span>
        <span title="Score (0..1)">
          {(score01 * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default TensionGauge;