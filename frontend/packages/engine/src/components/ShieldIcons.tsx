/**
 * ShieldIcons.tsx — Engine-Integrated Shield Layer Display
 * Engine: shield/types · ShieldLayerId · ShieldLayerConfig
 * Scale: 20M concurrent · Mobile-first · Syne + IBM Plex Mono
 * Density6 LLC · Point Zero One · Confidential
 */

import React, { memo } from 'react';
import {
  ShieldLayerId,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
} from '../shield/types';
import type { ShieldLayerConfig } from '../shield/types';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  card:    '#0C0C1E',
  border:  'rgba(255,255,255,0.08)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  red:     '#FF4D4D',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap');`;

// ─── Single Shield Layer Icon ─────────────────────────────────────────────────
interface LayerIconProps {
  config:     ShieldLayerConfig;
  integrity:  number;   // 0 – maxIntegrity
  isBreached: boolean;
  consuming?: boolean;
  size:       'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 36, md: 48, lg: 60 };
const FONT_MAP = { sm: 8, md: 10, lg: 12 };

const LayerIcon = memo(function LayerIcon({
  config, integrity, isBreached, consuming = false, size,
}: LayerIconProps) {
  const dim    = SIZE_MAP[size];
  const fs     = FONT_MAP[size];
  const pct    = Math.round((integrity / config.maxIntegrity) * 100);
  const color  = config.colorHex;
  const alpha  = isBreached ? 0.2 : Math.max(0.3, pct / 100);

  // SVG ring
  const R        = (dim / 2) - 4;
  const circ     = 2 * Math.PI * R;
  const dash     = isBreached ? 0 : (pct / 100) * circ;

  const label = config.name.split(' ')[0]; // 'LIQUIDITY' → show abbreviated

  return (
    <div
      title={`${config.name}: ${pct}% — ${isBreached ? 'BREACHED' : 'Active'}\n${config.breachConsequenceText}`}
      style={{
        position: 'relative', width: dim, height: dim,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        animation: consuming ? 'pzo-breach-flash 0.4s ease-out' : isBreached ? 'pzo-breached-pulse 2s ease-in-out infinite' : 'none',
      }}
    >
      {/* Outer glow */}
      {!isBreached && pct > 60 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          boxShadow: `0 0 ${dim * 0.6}px ${color}22`,
          pointerEvents: 'none',
        }} />
      )}

      {/* SVG ring */}
      <svg
        width={dim} height={dim}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={dim / 2} cy={dim / 2} r={R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={3}
        />
        {/* Progress */}
        <circle
          cx={dim / 2} cy={dim / 2} r={R}
          fill="none"
          stroke={isBreached ? 'rgba(255,77,77,0.3)' : color}
          strokeWidth={isBreached ? 2 : 3}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s cubic-bezier(0.4,0,0.2,1)' }}
          opacity={alpha}
        />
      </svg>

      {/* Center: shield icon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
        <span style={{ fontSize: dim * 0.35, lineHeight: 1, filter: isBreached ? 'grayscale(0.8) opacity(0.4)' : 'none' }}>
          {isBreached ? '💔' : '🛡️'}
        </span>
        {size !== 'sm' && (
          <span style={{
            fontFamily: T.mono, fontSize: fs - 1,
            color: isBreached ? T.red : color,
            fontWeight: 700, marginTop: 1,
            textShadow: isBreached ? 'none' : `0 0 8px ${color}88`,
          }}>
            {pct}%
          </span>
        )}
      </div>

      {/* Breach overlay */}
      {isBreached && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(255,77,77,0.08)',
          border: '2px solid rgba(255,77,77,0.35)',
        }} />
      )}

      {/* Consume flash particle */}
      {consuming && (
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          background: 'rgba(255,77,77,0.25)',
          animation: 'pzo-consume-ring 0.5s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
});

// ─── Compact count-only mode (legacy API compat) ──────────────────────────────
interface CountOnlyProps {
  count:      number;
  consuming?: boolean;
  className?: string;
}

// ─── Full layer-aware mode ────────────────────────────────────────────────────
interface LayerAwareProps {
  layers: {
    layerId:    ShieldLayerId;
    integrity:  number;
    consuming?: boolean;
  }[];
  size?:      'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export type ShieldIconsProps = CountOnlyProps | LayerAwareProps;

function isLayerAware(p: ShieldIconsProps): p is LayerAwareProps {
  return 'layers' in p;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default memo(function ShieldIcons(props: ShieldIconsProps) {
  if (isLayerAware(props)) {
    // ── Engine-native: 4-layer display ──
    const { layers, size = 'md', showLabels = false, className = '' } = props;

    const layerMap = new Map(layers.map(l => [l.layerId, l]));

    return (
      <div
        className={className}
        aria-label="Shield layers"
        style={{ display: 'flex', flexDirection: 'column', gap: showLabels ? 12 : 6 }}
      >
        <style>{FONT_IMPORT}</style>
        <style>{`
          @keyframes pzo-breach-flash {
            0%  { transform: scale(1.3); filter: brightness(2); }
            100%{ transform: scale(1);   filter: brightness(1); }
          }
          @keyframes pzo-breached-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.55; }
          }
          @keyframes pzo-consume-ring {
            0%  { transform: scale(1);   opacity: 0.9; }
            100%{ transform: scale(1.8); opacity: 0;   }
          }
        `}</style>

        {SHIELD_LAYER_ORDER.map((layerId, idx) => {
          const cfg    = SHIELD_LAYER_CONFIGS[layerId];
          const entry  = layerMap.get(layerId);
          const integrity  = entry?.integrity ?? 0;
          const consuming  = entry?.consuming ?? false;
          const isBreached = integrity <= 0;

          return (
            <div key={layerId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LayerIcon
                config={cfg}
                integrity={integrity}
                isBreached={isBreached}
                consuming={consuming}
                size={size}
              />
              {showLabels && (
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: T.mono, fontSize: 9,
                    color: isBreached ? T.red : cfg.colorHex,
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em',
                    textShadow: isBreached ? 'none' : `0 0 10px ${cfg.colorHex}55`,
                  }}>
                    {isBreached ? '⚡ BREACHED' : cfg.name}
                  </div>
                  {isBreached && (
                    <div style={{
                      fontFamily: T.display, fontSize: 9, color: T.red,
                      marginTop: 2, lineHeight: 1.4,
                    }}>
                      {cfg.breachConsequenceText}
                    </div>
                  )}
                  {!isBreached && (
                    <div style={{
                      fontFamily: T.mono, fontSize: 9, color: T.textMut, marginTop: 1,
                    }}>
                      {integrity}/{cfg.maxIntegrity} · +{cfg.passiveRegenRate}/tick
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Legacy count-only mode ──
  const { count, consuming = false, className = '' } = props as CountOnlyProps;
  if (count === 0 && !consuming) return null;

  return (
    <div
      className={className}
      aria-label={`${count} shield${count !== 1 ? 's' : ''} active`}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <style>{FONT_IMPORT}</style>
      <style>{`
        @keyframes pzo-consume-ring {
          0%  { transform: scale(1);   opacity: 0.9; }
          100%{ transform: scale(1.8); opacity: 0;   }
        }
      `}</style>

      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <div key={i} style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(234,179,8,0.10)',
          border: '1.5px solid rgba(234,179,8,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px rgba(234,179,8,0.20)',
        }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
        </div>
      ))}

      {count > 5 && (
        <span style={{
          fontFamily: T.mono, fontSize: 11, fontWeight: 700,
          color: '#EAB308',
        }}>
          ×{count}
        </span>
      )}

      {consuming && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,77,77,0.15)',
          border: '1.5px solid rgba(255,77,77,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pzo-consume-ring 0.5s ease-out',
        }}>
          <span style={{ fontSize: 14 }}>💥</span>
        </div>
      )}
    </div>
  );
});