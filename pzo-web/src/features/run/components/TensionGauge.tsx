/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/components/TensionGauge.tsx
 * ============================================================================
 *
 * Purpose:
 * - high-fidelity HUD display for Engine 3 — Tension Engine
 * - renders score, pulse state, visibility tier, queue pressure, and short history
 * - visually distinct from PressureGauge while still fitting the repo’s cockpit UI
 *
 * Doctrine:
 * - presentational only
 * - store reads happen via useTensionEngine()
 * - style sheet is injected once at runtime to keep file self-contained
 * ============================================================================
 */

'use client';

import React, { useEffect, useMemo } from 'react';
import { useTensionEngine } from '../hooks/useTensionEngine';

const TENSION_GAUGE_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');

.pzo-tension-gauge {
  --bg: #08090f;
  --panel: #0d0f17;
  --border: #21253a;
  --border-hi: #343a57;
  --text: #97a4c0;
  --text-hi: #d9e3ff;
  --mono: 'Share Tech Mono', monospace;
  --ui: 'Rajdhani', sans-serif;
  --violet: #7b5ea7;
  --violet-hi: #ad7cff;
  --magenta: #d946ef;
  --danger: #ff2f7d;
  --critical: #ff0055;
  --teal: #6ee7f9;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(123,94,167,.10), transparent 35%),
    linear-gradient(180deg, rgba(255,0,85,.05), transparent 100%),
    var(--panel);
  border-radius: 4px;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.02),
    0 0 0 1px rgba(0,0,0,.15);
  user-select: none;
}

.pzo-tension-gauge--pulse {
  border-color: rgba(255,47,125,.55);
  box-shadow:
    0 0 18px rgba(255,47,125,.14),
    inset 0 0 0 1px rgba(255,255,255,.02);
}

.pzo-tension-gauge--sustained {
  animation: pzoTensionShellPulse 450ms ease-in-out infinite alternate;
}

@keyframes pzoTensionShellPulse {
  from { box-shadow: 0 0 14px rgba(255,47,125,.14), inset 0 0 0 1px rgba(255,255,255,.02); }
  to   { box-shadow: 0 0 28px rgba(255,47,125,.26), inset 0 0 0 1px rgba(255,255,255,.05); }
}

.pzo-tension-gauge__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pzo-tension-gauge__label {
  font-family: var(--mono);
  font-size: 9px;
  line-height: 1;
  letter-spacing: .22em;
  color: var(--violet-hi);
  text-transform: uppercase;
}

.pzo-tension-gauge__meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pzo-tension-gauge__chip {
  font-family: var(--mono);
  font-size: 9px;
  line-height: 1;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text);
  border: 1px solid rgba(255,255,255,.08);
  padding: 4px 6px;
  border-radius: 2px;
  background: rgba(255,255,255,.03);
}

.pzo-tension-gauge__chip--visibility {
  color: var(--violet-hi);
  border-color: rgba(173,124,255,.22);
  background: rgba(173,124,255,.08);
}

.pzo-tension-gauge__chip--urgent {
  color: #ffe0ef;
  border-color: rgba(255,47,125,.3);
  background: rgba(255,47,125,.12);
}

.pzo-tension-gauge__chip--trend-up {
  color: #ffd7f7;
  border-color: rgba(217,70,239,.28);
  background: rgba(217,70,239,.12);
}

.pzo-tension-gauge__chip--trend-down {
  color: #c7fff8;
  border-color: rgba(110,231,249,.22);
  background: rgba(110,231,249,.08);
}

.pzo-tension-gauge__body {
  display: grid;
  gap: 10px;
}

.pzo-tension-gauge__layout--vertical {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
}

.pzo-tension-gauge__layout--horizontal {
  display: grid;
  gap: 8px;
}

.pzo-tension-gauge__track {
  position: relative;
  border: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(255,255,255,.035), transparent),
    #0f1320;
  overflow: hidden;
  border-radius: 2px;
}

.pzo-tension-gauge__track--vertical {
  width: 16px;
  min-height: 112px;
}

.pzo-tension-gauge__track--horizontal {
  width: 100%;
  height: 14px;
}

.pzo-tension-gauge__fill {
  position: absolute;
  inset: auto 0 0 0;
  transition: all 800ms linear;
  border-radius: 1px;
}

.pzo-tension-gauge__fill--horizontal {
  inset: 0 auto 0 0;
}

.pzo-tension-gauge__fill--pulse {
  animation: pzoTensionFillPulse 650ms ease-in-out infinite alternate;
}

@keyframes pzoTensionFillPulse {
  from { opacity: .76; filter: saturate(100%); }
  to   { opacity: 1; filter: saturate(150%); }
}

.pzo-tension-gauge__cap {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: rgba(255,255,255,.72);
  mix-blend-mode: screen;
}

.pzo-tension-gauge__cap--vertical {
  inset: auto 0 0 0;
  width: 100%;
  height: 2px;
}

.pzo-tension-gauge__stats {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.pzo-tension-gauge__score-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.pzo-tension-gauge__score {
  font-family: var(--ui);
  font-size: 22px;
  line-height: .95;
  font-weight: 700;
  color: var(--text-hi);
}

.pzo-tension-gauge__score small {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text);
  margin-left: 6px;
  letter-spacing: .12em;
}

.pzo-tension-gauge__band {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: .14em;
  color: var(--text);
  text-transform: uppercase;
}

.pzo-tension-gauge__subgrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.pzo-tension-gauge__stat {
  padding: 6px 7px;
  border: 1px solid rgba(255,255,255,.06);
  background: rgba(255,255,255,.025);
  border-radius: 2px;
}

.pzo-tension-gauge__stat-label {
  display: block;
  font-family: var(--mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text);
  margin-bottom: 5px;
}

.pzo-tension-gauge__stat-value {
  display: block;
  font-family: var(--ui);
  font-size: 13px;
  line-height: 1;
  font-weight: 600;
  color: var(--text-hi);
}

.pzo-tension-gauge__history {
  border: 1px solid rgba(255,255,255,.06);
  background: rgba(255,255,255,.02);
  border-radius: 2px;
  padding: 5px 6px 4px;
}

.pzo-tension-gauge__history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.pzo-tension-gauge__history-label {
  font-family: var(--mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--text);
}

.pzo-tension-gauge__history-meta {
  font-family: var(--mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: .12em;
  color: var(--text);
}

.pzo-tension-gauge__sparkline {
  display: block;
  width: 100%;
  height: 34px;
}

.pzo-tension-gauge__sparkline-grid {
  stroke: rgba(255,255,255,.08);
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.pzo-tension-gauge__sparkline-path {
  fill: none;
  stroke: var(--violet-hi);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 6px rgba(173,124,255,.20));
}

.pzo-tension-gauge__sparkline-path--pulse {
  stroke: var(--danger);
  filter: drop-shadow(0 0 7px rgba(255,47,125,.26));
}

.pzo-tension-gauge__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.pzo-tension-gauge__footer-text {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: .12em;
  color: var(--text);
  text-transform: uppercase;
}

.pzo-tension-gauge__footer-text strong {
  color: var(--text-hi);
  font-weight: 700;
}

@media (max-width: 640px) {
  .pzo-tension-gauge__subgrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;

function injectTensionGaugeStyles(): void {
  if (typeof document === 'undefined') return;

  const id = 'pzo-tension-gauge-styles';
  if (document.getElementById(id) !== null) return;

  const styleTag = document.createElement('style');
  styleTag.id = id;
  styleTag.textContent = TENSION_GAUGE_STYLES;
  document.head.appendChild(styleTag);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function resolveGaugeColor(score: number): string {
  if (score >= 0.9) return '#ff0055';
  if (score >= 0.75) return '#ff2f7d';
  if (score >= 0.55) return '#d946ef';
  if (score >= 0.3) return '#ad7cff';
  return '#7b5ea7';
}

function buildSparklinePoints(history: readonly number[]): string {
  const points = history.length > 1 ? history : [0, ...(history.length === 1 ? history : [0])];
  const width = 160;
  const height = 34;
  const step = points.length <= 1 ? width : width / (points.length - 1);

  return points
    .map((value, index) => {
      const x = index * step;
      const y = height - clamp01(value) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export type TensionGaugeOrientation = 'vertical' | 'horizontal';

export interface TensionGaugeProps {
  readonly orientation?: TensionGaugeOrientation;
  readonly label?: string;
  readonly showHistory?: boolean;
  readonly showQueueStats?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export function TensionGauge({
  orientation = 'vertical',
  label = 'TENSION',
  showHistory = true,
  showQueueStats = true,
  className,
  style,
}: TensionGaugeProps): React.ReactElement {
  const engine = useTensionEngine();

  useEffect(() => {
    injectTensionGaugeStyles();
  }, []);

  const score01 = clamp01(engine.score);
  const pct = Math.round(score01 * 100);
  const color = resolveGaugeColor(score01);

  const fillStyle = useMemo<React.CSSProperties>(() => {
    if (orientation === 'horizontal') {
      return {
        width: `${pct}%`,
        height: '100%',
        background: color,
        boxShadow: `0 0 10px ${color}44`,
      };
    }

    return {
      height: `${pct}%`,
      width: '100%',
      background: color,
      boxShadow: `0 0 10px ${color}44`,
    };
  }, [orientation, pct, color]);

  const sparklinePoints = useMemo<string>(
    () => buildSparklinePoints(engine.scoreHistory),
    [engine.scoreHistory],
  );

  const metaTrendClass =
    engine.trend === 'RISING'
      ? 'pzo-tension-gauge__chip--trend-up'
      : engine.trend === 'FALLING'
        ? 'pzo-tension-gauge__chip--trend-down'
        : '';

  const nextThreatLabel =
    engine.nextThreatEta === null ? 'NONE' : `${engine.nextThreatEta}T`;

  const dominantThreatLabel =
    engine.dominantEntry === null
      ? 'NONE'
      : engine.canSeeThreatTypes
        ? engine.dominantEntry.threatType.replace(/_/g, ' ')
        : 'HIDDEN';

  return (
    <div
      className={[
        'pzo-tension-gauge',
        engine.isPulseActive ? 'pzo-tension-gauge--pulse' : '',
        engine.isSustainedPulse ? 'pzo-tension-gauge--sustained' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-label={`${label} gauge`}
      aria-live='polite'
    >
      <div className='pzo-tension-gauge__row'>
        <span className='pzo-tension-gauge__label'>{label}</span>

        <div className='pzo-tension-gauge__meta'>
          <span className='pzo-tension-gauge__chip pzo-tension-gauge__chip--visibility'>
            {engine.visibilityState}
          </span>

          <span
            className={[
              'pzo-tension-gauge__chip',
              engine.threatUrgency === 'URGENT' ||
              engine.threatUrgency === 'COLLAPSE_IMMINENT'
                ? 'pzo-tension-gauge__chip--urgent'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {engine.threatUrgency}
          </span>

          <span
            className={[
              'pzo-tension-gauge__chip',
              metaTrendClass,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {engine.trend}
          </span>
        </div>
      </div>

      <div className='pzo-tension-gauge__body'>
        <div
          className={
            orientation === 'horizontal'
              ? 'pzo-tension-gauge__layout--horizontal'
              : 'pzo-tension-gauge__layout--vertical'
          }
        >
          <div
            className={[
              'pzo-tension-gauge__track',
              orientation === 'horizontal'
                ? 'pzo-tension-gauge__track--horizontal'
                : 'pzo-tension-gauge__track--vertical',
            ].join(' ')}
          >
            <div
              className={[
                'pzo-tension-gauge__fill',
                orientation === 'horizontal'
                  ? 'pzo-tension-gauge__fill--horizontal'
                  : '',
                engine.isPulseActive ? 'pzo-tension-gauge__fill--pulse' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={fillStyle}
            >
              <div
                className={[
                  'pzo-tension-gauge__cap',
                  orientation === 'vertical'
                    ? 'pzo-tension-gauge__cap--vertical'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </div>
          </div>

          <div className='pzo-tension-gauge__stats'>
            <div className='pzo-tension-gauge__score-row'>
              <div className='pzo-tension-gauge__score'>
                {pct}
                <small>%</small>
              </div>

              <div className='pzo-tension-gauge__band'>
                {engine.tensionBand}
              </div>
            </div>

            {showQueueStats && (
              <div className='pzo-tension-gauge__subgrid'>
                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Queue</span>
                  <span className='pzo-tension-gauge__stat-value'>
                    {engine.queueLength}
                  </span>
                </div>

                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Active</span>
                  <span className='pzo-tension-gauge__stat-value'>
                    {engine.arrivedCount}
                  </span>
                </div>

                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Expired</span>
                  <span className='pzo-tension-gauge__stat-value'>
                    {engine.expiredCount}
                  </span>
                </div>

                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Next ETA</span>
                  <span className='pzo-tension-gauge__stat-value'>
                    {nextThreatLabel}
                  </span>
                </div>
              </div>
            )}

            {showHistory && (
              <div className='pzo-tension-gauge__history'>
                <div className='pzo-tension-gauge__history-head'>
                  <span className='pzo-tension-gauge__history-label'>
                    Last {engine.scoreHistory.length} ticks
                  </span>
                  <span className='pzo-tension-gauge__history-meta'>
                    Tick {engine.currentTick}
                  </span>
                </div>

                <svg
                  className='pzo-tension-gauge__sparkline'
                  viewBox='0 0 160 34'
                  preserveAspectRatio='none'
                  aria-hidden='true'
                >
                  <line
                    className='pzo-tension-gauge__sparkline-grid'
                    x1='0'
                    y1='17'
                    x2='160'
                    y2='17'
                  />
                  <line
                    className='pzo-tension-gauge__sparkline-grid'
                    x1='0'
                    y1='1'
                    x2='160'
                    y2='1'
                  />
                  <line
                    className='pzo-tension-gauge__sparkline-grid'
                    x1='0'
                    y1='33'
                    x2='160'
                    y2='33'
                  />
                  <polyline
                    className={[
                      'pzo-tension-gauge__sparkline-path',
                      engine.isPulseActive
                        ? 'pzo-tension-gauge__sparkline-path--pulse'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    points={sparklinePoints}
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className='pzo-tension-gauge__footer'>
          <span className='pzo-tension-gauge__footer-text'>
            Dominant <strong>{dominantThreatLabel}</strong>
          </span>

          <span className='pzo-tension-gauge__footer-text'>
            Pulse <strong>{engine.isPulseActive ? 'ON' : 'OFF'}</strong>
            {' · '}
            {engine.pulseTicksActive}T
          </span>
        </div>
      </div>
    </div>
  );
}