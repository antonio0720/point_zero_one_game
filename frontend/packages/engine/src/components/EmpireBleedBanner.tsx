/**
 * EmpireBleedBanner.tsx — Bleed Mode Visual Alert
 * Mobile-first full-width banner. Severity-aware: WATCH/CRITICAL/TERMINAL.
 * Pulse animation at CRITICAL+. Countdown timer. Comeback surge indicator.
 *
 * Fonts: DM Mono + Barlow Condensed (designTokens.ts — no local T object)
 * WCAG AA+. Touch target 48px. clamp() font sizes.
 * Density6 LLC · Confidential
 */

import React, { memo } from 'react';
import { C, FS, TOUCH_TARGET } from '../game/modes/shared/designTokens';
import { bleedDurationLabel, computeBleedUrgencyPulse, type BleedModeState, type BleedSeverity } from '../game/modes/empire/bleedMode';
import { BLEED_SEVERITY_COLORS, BLEED_SEVERITY_ICONS, BLEED_SEVERITY_LABELS } from '../game/modes/empire/empireConfig';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EmpireBleedBannerProps {
  bleedState:    BleedModeState;
  cash:          number;
  cashflow:      number;
  survivalTicks: number;  // from estimatedSurvivalTicks()
  /** Optional: show comeback surge eligible indicator */
  comebackEligible?: boolean;
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEV_BG: Record<BleedSeverity, string> = {
  NONE:     'transparent',
  WATCH:    'rgba(255,155,47,0.08)',
  CRITICAL: 'rgba(255,77,77,0.10)',
  TERMINAL: 'rgba(255,23,68,0.14)',
};

const SEV_BORDER: Record<BleedSeverity, string> = {
  NONE:     'transparent',
  WATCH:    'rgba(255,155,47,0.30)',
  CRITICAL: 'rgba(255,77,77,0.40)',
  TERMINAL: 'rgba(255,23,68,0.55)',
};

const SEV_GLOW: Record<BleedSeverity, string> = {
  NONE:     'none',
  WATCH:    'none',
  CRITICAL: '0 0 16px rgba(255,77,77,0.15)',
  TERMINAL: '0 0 24px rgba(255,23,68,0.25)',
};

// ── Survival label ────────────────────────────────────────────────────────────

function formatSurvival(ticks: number): string {
  if (ticks === Infinity) return '∞';
  if (ticks === 0)        return 'NOW';
  if (ticks < 10)         return `${ticks}t !!!`;
  return `~${ticks}t`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EmpireBleedBanner = memo(function EmpireBleedBanner({
  bleedState, cash, cashflow, survivalTicks, comebackEligible = false,
}: EmpireBleedBannerProps) {
  if (!bleedState.active) return null;

  const { severity } = bleedState;
  const color        = BLEED_SEVERITY_COLORS[severity];
  const icon         = BLEED_SEVERITY_ICONS[severity];
  const label        = BLEED_SEVERITY_LABELS[severity];
  const needsPulse   = computeBleedUrgencyPulse(bleedState);
  const durationLbl  = bleedDurationLabel(bleedState);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background:   SEV_BG[severity],
        borderTop:    `2px solid ${SEV_BORDER[severity]}`,
        borderBottom: `2px solid ${SEV_BORDER[severity]}`,
        boxShadow:    SEV_GLOW[severity],
        padding:      '10px 16px',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        flexWrap:     'wrap',
        animation:    needsPulse ? 'pulseRed 2s infinite' : undefined,
        minHeight:    TOUCH_TARGET,
      }}
    >
      {/* Severity badge */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        flexShrink:   0,
      }}>
        <span style={{
          fontFamily:  C.display,
          fontSize:    FS.xl,
          lineHeight:  1,
        }}>
          {icon}
        </span>
        <div>
          <div style={{
            fontFamily:     C.display,
            fontSize:       FS.lg,
            fontWeight:     800,
            color,
            letterSpacing:  '0.05em',
            lineHeight:     1.1,
          }}>
            {label}
          </div>
          <div style={{
            fontFamily:  C.mono,
            fontSize:    FS.xs,
            color:       C.textDim,
            marginTop:   2,
          }}>
            {durationLbl}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: SEV_BORDER[severity], flexShrink: 0 }} />

      {/* Survival countdown */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>
          SURVIVAL EST.
        </div>
        <div style={{
          fontFamily: C.display,
          fontSize:   FS.lg,
          fontWeight: 800,
          color:      survivalTicks < 10 ? C.crimson : survivalTicks < 30 ? C.red : C.orange,
        }}>
          {formatSurvival(survivalTicks)}
        </div>
      </div>

      {/* Cashflow display */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>CASHFLOW</div>
        <div style={{
          fontFamily: C.mono,
          fontSize:   FS.md,
          fontWeight: 700,
          color:      cashflow < 0 ? C.red : C.green,
        }}>
          {cashflow >= 0 ? '+' : ''}{cashflow >= 1_000_000
            ? `$${(cashflow / 1e6).toFixed(1)}M`
            : cashflow >= 1_000
              ? `$${(cashflow / 1e3).toFixed(1)}K`
              : `$${Math.round(cashflow)}`}/mo
        </div>
      </div>

      {/* Comeback surge eligible */}
      {comebackEligible && (
        <>
          <div style={{ width: 1, height: 32, background: SEV_BORDER[severity], flexShrink: 0 }} />
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            fontFamily:   C.mono,
            fontSize:     FS.xs,
            fontWeight:   700,
            color:        C.gold,
            letterSpacing: '0.1em',
            background:   C.goldDim,
            border:       `1px solid ${C.goldBrd}`,
            padding:      '4px 10px',
            borderRadius: 6,
            flexShrink:   0,
          }}>
            ✦ COMEBACK SURGE ELIGIBLE
          </div>
        </>
      )}

      {/* Peak severity indicator */}
      {bleedState.peakSeverity !== severity && (
        <div style={{
          marginLeft:   'auto',
          fontFamily:   C.mono,
          fontSize:     FS.xs,
          color:        C.textDim,
          flexShrink:   0,
        }}>
          Peak: <span style={{ color: BLEED_SEVERITY_COLORS[bleedState.peakSeverity] }}>
            {bleedState.peakSeverity}
          </span>
        </div>
      )}
    </div>
  );
});

export default EmpireBleedBanner;