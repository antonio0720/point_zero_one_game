//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/TensionGauge.tsx

/**
 * FILE: pzo-web/src/features/run/components/TensionGauge.tsx
 * Primary tension display: score bar, pulse indicator, queue count badges.
 * Purple palette — visually distinct from the gold/red Pressure gauge.
 *
 * No game logic in this file. Reads from useTensionEngine hook only.
 * CSS lives in: pzo-web/src/styles/tension-engine.css
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import React from 'react';
import { useTensionEngine } from '../hooks/useTensionEngine';

interface Props {
  orientation?: 'vertical' | 'horizontal';
  showLabel?: boolean;
  showBadges?: boolean;
}

export function TensionGauge({
  orientation = 'vertical',
  showLabel = true,
  showBadges = true,
}: Props): React.ReactElement {
  const {
    score,
    scorePct,
    visibilityState,
    queueLength,
    arrivedCount,
    isPulseActive,
    isSustainedPulse,
    isEscalating,
    threatUrgency,
  } = useTensionEngine();

  const pct = Math.min(100, Math.max(0, Math.round(scorePct)));

  // Purple → hot pink as tension rises
  // 0.0–0.39  → base purple   #7B5EA7
  // 0.40–0.69 → mid purple    #9B4EA7
  // 0.70–0.89 → deep magenta  #B92B7A
  // 0.90+     → crisis red    #FF0066
  const fillColor =
    score < 0.4  ? '#7B5EA7'
    : score < 0.7  ? '#9B4EA7'
    : score < 0.9  ? '#B92B7A'
    : '#FF0066';

  const barStyle: React.CSSProperties =
    orientation === 'vertical'
      ? { height: `${pct}%`, width: '100%' }
      : { width: `${pct}%`, height: '100%' };

  const containerClasses = [
    'tension-gauge',
    `tension-gauge--${orientation}`,
    isPulseActive    ? 'tension-pulse-active'    : '',
    isSustainedPulse ? 'tension-pulse-sustained' : '',
    threatUrgency === 'URGENT' ? 'tension-gauge--urgent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="meter" aria-label="Tension Score" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>

      {/* Score bar */}
      <div className="tension-gauge__track">
        <div
          className="tension-gauge__fill"
          style={{
            ...barStyle,
            background: fillColor,
            transition: 'all 1s linear',
          }}
        />
      </div>

      {/* Label row */}
      {showLabel && (
        <div className="tension-gauge__label">
          <span className="tension-label">TENSION</span>
          {isEscalating && (
            <span className="tension-escalating" title="Tension is rising">▲</span>
          )}
        </div>
      )}

      {/* Visibility state badge */}
      <div className="tension-visibility-badge" title={`Visibility: ${visibilityState}`}>
        {visibilityState}
      </div>

      {/* Queue badges — mutually exclusive display */}
      {showBadges && arrivedCount > 0 && (
        <div className="tension-arrived-badge" role="status" aria-live="polite">
          {arrivedCount} ACTIVE
        </div>
      )}
      {showBadges && queueLength > 0 && arrivedCount === 0 && (
        <div className="tension-queue-badge">
          {queueLength} QUEUED
        </div>
      )}
      {showBadges && queueLength === 0 && (
        <div className="tension-queue-badge tension-queue-badge--clear">
          CLEAR
        </div>
      )}
    </div>
  );
}

export default TensionGauge;