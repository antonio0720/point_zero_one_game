//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/ShieldStack.tsx

/**
 * FILE: pzo-web/src/features/run/components/ShieldStack.tsx
 * 4-layer visual shield display.
 * Reads from useShieldEngine hook — no direct engine imports.
 *
 * Visual states:
 *   - Fortified: gold shimmer on entire stack
 *   - Low (<30%): flicker animation on fill bar
 *   - Critical (<10%): red pulse animation on fill bar
 *   - Breached (0%): BREACHED label, grey track
 *
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import React from 'react';
import { useShieldEngine } from '../hooks/useShieldEngine';
import { SHIELD_LAYER_ORDER, SHIELD_LAYER_CONFIGS } from '../../../engines/shield/types';

export function ShieldStack(): JSX.Element | null {
  const { layers, isFortified, overallPct100, isAnyCritical, cascadeCount } =
    useShieldEngine();

  if (!layers) return null;

  return (
    <div
      className={[
        'shield-stack',
        isFortified ? 'shield-stack--fortified' : '',
        isAnyCritical ? 'shield-stack--any-critical' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-cascade-count={cascadeCount}
    >
      {/* Header */}
      <div className="shield-stack__header">
        <span className="shield-stack__title">SHIELDS</span>
        <span className="shield-stack__overall">{overallPct100}%</span>
        {isFortified && (
          <span className="shield-fortified-badge">FORTIFIED</span>
        )}
      </div>

      {/* 4-layer stack — rendered outer → inner */}
      {SHIELD_LAYER_ORDER.map(layerId => {
        const layer = layers[layerId];
        const cfg = SHIELD_LAYER_CONFIGS[layerId];
        const pct = Math.round(layer.integrityPct * 100);

        const layerClasses = [
          'shield-layer',
          layer.isBreached       ? 'shield-layer--breached'  : '',
          layer.isCriticalWarning ? 'shield-layer--critical' : '',
          layer.isLowWarning     ? 'shield-layer--low'       : '',
        ]
          .filter(Boolean)
          .join(' ');

        const fillColor = layer.isBreached ? '#444' : cfg.colorHex;

        return (
          <div
            key={layerId}
            className={layerClasses}
            data-layer-id={layerId}
          >
            {/* Label row */}
            <div className="shield-layer__label">
              <span className="shield-layer__name">{cfg.name}</span>
              <span className="shield-layer__pct">
                {layer.isBreached ? 'OFFLINE' : `${pct}%`}
              </span>
            </div>

            {/* Integrity bar */}
            <div className="shield-layer__track">
              <div
                className="shield-layer__fill"
                style={{
                  width: `${pct}%`,
                  background: fillColor,
                  transition: 'width 0.8s ease',
                }}
              />
            </div>

            {/* Pts display */}
            {!layer.isBreached && (
              <div className="shield-layer__pts">
                {layer.currentIntegrity} / {layer.maxIntegrity}
              </div>
            )}

            {/* Breach label */}
            {layer.isBreached && (
              <div className="shield-breach-label">BREACHED</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ShieldStack;