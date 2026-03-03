/**
 * SabotageImpactPanel.tsx — Engine-Integrated Active Sabotage Display
 * Engine: battle/types · AttackType · BotId · BotState
 * Scale: 20M concurrent · Mobile-first · Syne + IBM Plex Mono
 * Density6 LLC · Point Zero One · Confidential
 */

import React, { memo, useMemo } from 'react';
import type { BotId, BotState } from '../engines/battle/types';
import { AttackType } from '../engines/battle/types';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  card:    '#0C0C1E',
  cardHi:  '#131328',
  border:  'rgba(255,255,255,0.08)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  red:     '#FF4D4D',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  indigo:  '#818CF8',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

// ─── Engine-native sabotage kinds (mapped to AttackType) ─────────────────────
export type SabotageKind =
  | 'INCOME_DRAIN'
  | 'CARD_BLOCK'
  | 'INTEL_BLACKOUT'
  | 'FORCED_SELL'
  | 'HATER_BOOST';

// Map SabotageKind → AttackType for engine fidelity
export const SABOTAGE_TO_ATTACK_TYPE: Record<SabotageKind, AttackType> = {
  INCOME_DRAIN:   AttackType.FINANCIAL_SABOTAGE,
  CARD_BLOCK:     AttackType.OPPORTUNITY_KILL,
  INTEL_BLACKOUT: AttackType.REPUTATION_ATTACK,
  FORCED_SELL:    AttackType.ASSET_STRIP,
  HATER_BOOST:    AttackType.HATER_INJECTION,
};

export interface ActiveSabotage {
  id:                string;
  kind:              SabotageKind;
  label:             string;
  severity:          'MINOR' | 'MAJOR' | 'CRITICAL';
  ticksRemaining:    number;
  sourceDisplayName: string;
  sourceBotId?:      BotId;
  sourceBotState?:   BotState;
  impactValue?:      number;  // $/tick drain
}

export interface SabotageImpactPanelProps {
  activeSabotages: ActiveSabotage[];
  tick:            number;
  onCounterplay?:  (id: string) => void;
}

// ─── Kind configs ─────────────────────────────────────────────────────────────
const KIND_CFG: Record<SabotageKind, { emoji: string; label: string; color: string }> = {
  INCOME_DRAIN:   { emoji: '🩸', label: 'INCOME SIPHON',   color: '#FF4D4D' },
  CARD_BLOCK:     { emoji: '🚫', label: 'CARD BLOCK',       color: '#FF8C00' },
  INTEL_BLACKOUT: { emoji: '👁',  label: 'INTEL BLACKOUT',  color: '#818CF8' },
  FORCED_SELL:    { emoji: '💣', label: 'FORCED SELL',      color: '#FF4D4D' },
  HATER_BOOST:    { emoji: '🔥', label: 'HATER AMPLIFIED',  color: '#FF8C00' },
};

const SEV_CFG: Record<ActiveSabotage['severity'], {
  border: string; bg: string; fg: string; badge: string; badgeBg: string;
}> = {
  MINOR: {
    border: 'rgba(255,215,0,0.25)',
    bg:     'rgba(255,215,0,0.05)',
    fg:     '#FFD700',
    badge:  '#FFD700',
    badgeBg:'rgba(255,215,0,0.12)',
  },
  MAJOR: {
    border: 'rgba(255,140,0,0.32)',
    bg:     'rgba(255,140,0,0.07)',
    fg:     '#FF8C00',
    badge:  '#FF8C00',
    badgeBg:'rgba(255,140,0,0.12)',
  },
  CRITICAL: {
    border: 'rgba(255,77,77,0.42)',
    bg:     'rgba(255,77,77,0.09)',
    fg:     '#FF4D4D',
    badge:  '#FF4D4D',
    badgeBg:'rgba(255,77,77,0.14)',
  },
};

// ─── Tick urgency bar ─────────────────────────────────────────────────────────
const TickBar = memo(function TickBar({
  remaining, max = 48, color,
}: { remaining: number; max?: number; color: string }) {
  const pct = Math.min(1, remaining / max);
  return (
    <div style={{
      width: 56, height: 4, background: 'rgba(255,255,255,0.07)',
      borderRadius: 99, overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        height: '100%', width: `${pct * 100}%`,
        background: pct < 0.25 ? '#FF4D4D' : color,
        borderRadius: 99,
        transition: 'width 0.3s ease',
        boxShadow: `0 0 6px ${pct < 0.25 ? '#FF4D4D' : color}88`,
      }} />
    </div>
  );
});

// ─── Single sabotage card ─────────────────────────────────────────────────────
const SabotageCard = memo(function SabotageCard({
  sab, onCounterplay,
}: { sab: ActiveSabotage; onCounterplay?: (id: string) => void }) {
  const sev  = SEV_CFG[sab.severity];
  const kind = KIND_CFG[sab.kind];

  const impactStr = sab.impactValue !== undefined
    ? sab.impactValue >= 1000
      ? `-$${(sab.impactValue / 1000).toFixed(1)}K/t`
      : `-$${sab.impactValue}/t`
    : null;

  return (
    <div style={{
      background: sev.bg, border: `1px solid ${sev.border}`,
      borderRadius: 12, padding: '12px 14px',
      fontFamily: T.display,
    }}>
      {/* Row 1: kind + severity badge + ticks */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{kind.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: T.mono, fontSize: 11, fontWeight: 700,
              color: sev.fg, letterSpacing: '0.06em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {sab.label}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textMut, marginTop: 2 }}>
              {SABOTAGE_TO_ATTACK_TYPE[sab.kind]}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Severity pill */}
          <span style={{
            fontFamily: T.mono, fontSize: 9, fontWeight: 800,
            padding: '3px 7px', borderRadius: 5,
            color: sev.badge, background: sev.badgeBg,
            textTransform: 'uppercase', letterSpacing: '0.10em',
          }}>
            {sab.severity}
          </span>
        </div>
      </div>

      {/* Row 2: source + ticks + impact + counterplay */}
      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMut }}>
            from:{' '}
            <span style={{ color: T.textSub, fontWeight: 600 }}>{sab.sourceDisplayName}</span>
            {sab.sourceBotState && (
              <span style={{
                marginLeft: 5, color: sev.fg, opacity: 0.7,
              }}>
                [{sab.sourceBotState}]
              </span>
            )}
          </span>

          <TickBar remaining={sab.ticksRemaining} color={sev.fg} />

          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textSub }}>
            {sab.ticksRemaining}t left
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {impactStr && (
            <span style={{
              fontFamily: T.mono, fontSize: 11, fontWeight: 700,
              color: '#FF4D4D',
            }}>
              {impactStr}
            </span>
          )}

          {onCounterplay && (
            <button
              onClick={() => onCounterplay(sab.id)}
              style={{
                fontFamily: T.mono, fontSize: 9, fontWeight: 800,
                padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                color: sev.fg, background: sev.badgeBg,
                border: `1px solid ${sev.border}`,
                letterSpacing: '0.10em', textTransform: 'uppercase',
                transition: 'opacity 0.15s, transform 0.1s',
                minHeight: 32,
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.75'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}
            >
              COUNTER →
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export const SabotageImpactPanel = memo(function SabotageImpactPanel({
  activeSabotages, tick, onCounterplay,
}: SabotageImpactPanelProps) {
  if (activeSabotages.length === 0) return null;

  const criticalCount = useMemo(
    () => activeSabotages.filter(s => s.severity === 'CRITICAL').length,
    [activeSabotages],
  );

  const totalDrain = useMemo(
    () => activeSabotages.reduce((s, a) => s + (a.impactValue ?? 0), 0),
    [activeSabotages],
  );

  // Sort: CRITICAL first, then MAJOR, then MINOR
  const sorted = useMemo(() => [...activeSabotages].sort((a, b) => {
    const o = { CRITICAL: 0, MAJOR: 1, MINOR: 2 };
    return o[a.severity] - o[b.severity];
  }), [activeSabotages]);

  return (
    <div style={{ fontFamily: T.display }}>
      <style>{FONT_IMPORT}</style>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: T.mono, fontSize: 10, fontWeight: 800,
            color: '#FF4D4D', textTransform: 'uppercase', letterSpacing: '0.14em',
            animation: 'pzo-attack-pulse 1.2s ease-in-out infinite',
          }}>
            ⚠ UNDER ATTACK
          </span>

          <span style={{
            fontFamily: T.mono, fontSize: 9, fontWeight: 700,
            color: '#FF4D4D', background: 'rgba(255,77,77,0.12)',
            border: '1px solid rgba(255,77,77,0.30)',
            padding: '2px 7px', borderRadius: 5,
          }}>
            {activeSabotages.length} active
          </span>

          {criticalCount > 0 && (
            <span style={{
              fontFamily: T.mono, fontSize: 9, fontWeight: 800,
              color: '#FF4D4D', background: 'rgba(255,77,77,0.18)',
              border: '1px solid rgba(255,77,77,0.45)',
              padding: '2px 7px', borderRadius: 5,
              animation: 'pzo-attack-pulse 0.9s ease-in-out infinite',
            }}>
              {criticalCount} CRITICAL
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalDrain > 0 && (
            <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: '#FF4D4D' }}>
              −${totalDrain >= 1000 ? `${(totalDrain / 1000).toFixed(1)}K` : totalDrain}/tick
            </span>
          )}
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMut }}>
            T+{tick}
          </span>
        </div>
      </div>

      {/* ── Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(sab => (
          <SabotageCard key={sab.id} sab={sab} onCounterplay={onCounterplay} />
        ))}
      </div>

      <style>{`
        @keyframes pzo-attack-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
});

export default SabotageImpactPanel;