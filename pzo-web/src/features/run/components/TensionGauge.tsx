//pzo-web/src/features/run/components/TensionGauge.tsx

'use client';

import React, { useMemo } from 'react';
import '../styles/tension-engine.css';
import { useTensionEngine } from '../hooks/useTensionEngine';

export type TensionGaugeOrientation = 'vertical' | 'horizontal';

export interface TensionGaugeProps {
  readonly orientation?: TensionGaugeOrientation;
  readonly label?: string;
  readonly showHistory?: boolean;
  readonly showQueueStats?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

interface EnhancedTensionViewModel {
  readonly trend?: 'RISING' | 'FALLING' | 'FLAT' | string;
  readonly tensionBand?: 'CALM' | 'RISING' | 'HIGH' | 'CRISIS' | 'PULSE' | string;
  readonly currentTick?: number;
  readonly nextThreatEta?: number | null;
  readonly scoreHistory?: readonly number[];
  readonly dominantEntry?: { readonly threatType: string } | null;
  readonly canSeeThreatTypes?: boolean;
  readonly isSustainedPulse?: boolean;
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function prettifyToken(token: string): string {
  return token.replace(/_/g, ' ').trim();
}

function resolveGaugeColor(score: number): string {
  if (score >= 0.9) return '#ff0055';
  if (score >= 0.75) return '#ff2f7d';
  if (score >= 0.55) return '#d946ef';
  if (score >= 0.3) return '#ad7cff';
  return '#7b5ea7';
}

function buildSparklinePoints(history: readonly number[]): string {
  const width = 160;
  const height = 34;
  const safeHistory = history.length >= 2 ? history : [0, ...(history.length === 1 ? history : [0])];
  const step = safeHistory.length <= 1 ? width : width / (safeHistory.length - 1);

  return safeHistory
    .map((value, index) => {
      const x = index * step;
      const y = height - clamp01(value) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export function TensionGauge({
  orientation = 'vertical',
  label = 'TENSION',
  showHistory = true,
  showQueueStats = true,
  className,
  style,
}: TensionGaugeProps): React.ReactElement {
  const baseEngine = useTensionEngine();
  const engine = baseEngine as typeof baseEngine & EnhancedTensionViewModel;

  const score01 = clamp01(baseEngine.score);
  const pct = Math.round(score01 * 100);
  const gaugeColor = resolveGaugeColor(score01);

  const trend = engine.trend ?? (baseEngine.isEscalating ? 'RISING' : 'FLAT');
  const tensionBand =
    engine.tensionBand ??
    (score01 >= 0.9 ? 'PULSE' : score01 >= 0.75 ? 'CRISIS' : score01 >= 0.55 ? 'HIGH' : score01 >= 0.25 ? 'RISING' : 'CALM');
  const currentTick = typeof engine.currentTick === 'number' ? engine.currentTick : 0;
  const nextThreatEta = typeof engine.nextThreatEta === 'number' ? engine.nextThreatEta : null;
  const scoreHistory = Array.isArray(engine.scoreHistory) ? engine.scoreHistory : [];
  const dominantThreatLabel =
    engine.dominantEntry === null || engine.dominantEntry === undefined
      ? 'NONE'
      : engine.canSeeThreatTypes === false
        ? 'HIDDEN'
        : prettifyToken(engine.dominantEntry.threatType);
  const nextThreatLabel = nextThreatEta === null ? 'NONE' : `${nextThreatEta}T`;

  const sparklinePoints = useMemo(() => buildSparklinePoints(scoreHistory), [scoreHistory]);

  const fillStyle = useMemo<React.CSSProperties>(() => {
    if (orientation === 'horizontal') {
      return {
        width: `${pct}%`,
        height: '100%',
        background: gaugeColor,
        boxShadow: `0 0 12px ${gaugeColor}44`,
      };
    }

    return {
      height: `${pct}%`,
      width: '100%',
      background: gaugeColor,
      boxShadow: `0 0 12px ${gaugeColor}44`,
    };
  }, [gaugeColor, orientation, pct]);

  const trendChipClass =
    trend === 'RISING'
      ? 'pzo-tension-gauge__chip--trend-up'
      : trend === 'FALLING'
        ? 'pzo-tension-gauge__chip--trend-down'
        : 'pzo-tension-gauge__chip--trend-flat';

  return (
    <section
      className={cx(
        'pzo-tension-gauge',
        `pzo-tension-gauge--${orientation}`,
        baseEngine.isPulseActive && 'pzo-tension-gauge--pulse',
        baseEngine.isSustainedPulse && 'pzo-tension-gauge--sustained',
        baseEngine.isEscalating && 'pzo-tension-gauge--escalating',
        className,
      )}
      style={style}
      aria-label={`${label} gauge`}
    >
      <header className='pzo-tension-gauge__header'>
        <div className='pzo-tension-gauge__row'>
          <span className='pzo-tension-gauge__label'>{label}</span>

          <div className='pzo-tension-gauge__meta'>
            <span className='pzo-tension-gauge__chip pzo-tension-gauge__chip--visibility'>
              {baseEngine.visibilityState}
            </span>
            <span className='pzo-tension-gauge__chip pzo-tension-gauge__chip--urgent'>
              {baseEngine.threatUrgency}
            </span>
            <span className={cx('pzo-tension-gauge__chip', trendChipClass)}>{trend}</span>
          </div>
        </div>
      </header>

      <div className='pzo-tension-gauge__body'>
        <div
          className={cx(
            'pzo-tension-gauge__layout',
            orientation === 'horizontal'
              ? 'pzo-tension-gauge__layout--horizontal'
              : 'pzo-tension-gauge__layout--vertical',
          )}
        >
          <div
            className={cx(
              'pzo-tension-gauge__track',
              orientation === 'horizontal'
                ? 'pzo-tension-gauge__track--horizontal'
                : 'pzo-tension-gauge__track--vertical',
            )}
            aria-hidden='true'
          >
            <div
              className={cx(
                'pzo-tension-gauge__fill',
                orientation === 'horizontal' && 'pzo-tension-gauge__fill--horizontal',
                baseEngine.isPulseActive && 'pzo-tension-gauge__fill--pulse',
              )}
              style={fillStyle}
            />
            <div
              className={cx(
                'pzo-tension-gauge__cap',
                orientation === 'vertical' && 'pzo-tension-gauge__cap--vertical',
              )}
              style={
                orientation === 'horizontal'
                  ? { left: `${pct}%` }
                  : { bottom: `${pct}%` }
              }
            />
          </div>

          <div className='pzo-tension-gauge__stats'>
            <div className='pzo-tension-gauge__score-row'>
              <div className='pzo-tension-gauge__score'>
                {pct}
                <small className='pzo-tension-gauge__score-unit'>%</small>
              </div>
              <div className='pzo-tension-gauge__band'>{tensionBand}</div>
            </div>

            {showQueueStats && (
              <div className='pzo-tension-gauge__subgrid'>
                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Queue</span>
                  <span className='pzo-tension-gauge__stat-value'>{baseEngine.queueLength}</span>
                </div>
                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Active</span>
                  <span className='pzo-tension-gauge__stat-value'>{baseEngine.arrivedCount}</span>
                </div>
                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Expired</span>
                  <span className='pzo-tension-gauge__stat-value'>{baseEngine.expiredCount}</span>
                </div>
                <div className='pzo-tension-gauge__stat'>
                  <span className='pzo-tension-gauge__stat-label'>Next ETA</span>
                  <span className='pzo-tension-gauge__stat-value'>{nextThreatLabel}</span>
                </div>
              </div>
            )}

            {showHistory && (
              <div className='pzo-tension-gauge__history'>
                <div className='pzo-tension-gauge__history-head'>
                  <span className='pzo-tension-gauge__history-label'>
                    Last {scoreHistory.length} ticks
                  </span>
                  <span className='pzo-tension-gauge__history-meta'>Tick {currentTick}</span>
                </div>

                <svg
                  className='pzo-tension-gauge__sparkline'
                  viewBox='0 0 160 34'
                  preserveAspectRatio='none'
                  role='img'
                  aria-label='Tension history'
                >
                  <path className='pzo-tension-gauge__sparkline-grid' d='M0 17H160' />
                  <polyline
                    className={cx(
                      'pzo-tension-gauge__sparkline-path',
                      baseEngine.isPulseActive && 'pzo-tension-gauge__sparkline-path--pulse',
                    )}
                    points={sparklinePoints}
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className='pzo-tension-gauge__footer'>
        <span className='pzo-tension-gauge__footer-text'>
          Dominant <strong>{dominantThreatLabel}</strong>
        </span>
        <span className='pzo-tension-gauge__footer-text'>
          Pulse <strong>{baseEngine.isPulseActive ? 'ON' : 'OFF'}</strong> ·{' '}
          <strong>{baseEngine.pulseTicksActive}T</strong>
        </span>
      </footer>
    </section>
  );
}

export default TensionGauge;