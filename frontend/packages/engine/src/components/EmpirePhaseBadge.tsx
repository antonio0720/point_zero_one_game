/**
 * EmpirePhaseBadge.tsx — Empire Wave / Phase Progress Indicator
 * Shows current phase name, wave number, bot count, and tick position.
 * Compact component for the game screen top bar.
 *
 * Fonts: DM Mono + Barlow Condensed (designTokens.ts)
 * Mobile-first. Touch target aware. clamp() font sizes.
 * Density6 LLC · Confidential
 */

'use client';

import React, { memo, useMemo } from 'react';
import { C, FS } from '../game/modes/shared/designTokens';
import { EMPIRE_WAVES, EMPIRE_PHASE_ACCENTS, type EmpireWaveConfig } from '../game/modes/empire/empireConfig';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EmpirePhaseBadgeProps {
  wave: EmpireWaveConfig;
  tick: number;
  totalTicks: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampMin(n: number, min: number): number {
  if (!Number.isFinite(n)) return min;
  return n < min ? min : n;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EmpirePhaseBadge = memo(function EmpirePhaseBadge({
  wave,
  tick,
  totalTicks,
}: EmpirePhaseBadgeProps) {
  const safeTotalTicks = clampMin(Math.floor(totalTicks), 1);
  const safeTick = clampMin(Math.floor(tick), 0);

  const accent = EMPIRE_PHASE_ACCENTS[wave.phase] ?? C.gold;

  const waveDuration = Math.max(1, (wave.endTick ?? 0) - (wave.startTick ?? 0));
  const waveProgress = clamp01((safeTick - (wave.startTick ?? 0)) / waveDuration);
  const runProgress = clamp01(safeTick / safeTotalTicks);

  // Segment positions for the 5-phase progress strip
  const waveSegments = useMemo(
    () =>
      EMPIRE_WAVES.map((w) => ({
        wave: w.wave,
        phase: w.phase,
        pct: (((w.endTick - w.startTick) / safeTotalTicks) * 100),
        accent: EMPIRE_PHASE_ACCENTS[w.phase] ?? C.gold,
        isActive: w.wave === wave.wave,
        isPast: w.wave < wave.wave,
      })),
    [wave.wave, safeTotalTicks],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
      {/* Phase name + wave badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontFamily: C.display,
            fontSize: FS.xl,
            fontWeight: 800,
            color: accent,
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          {wave.phase}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <span
            style={{
              fontFamily: C.mono,
              fontSize: FS.xs,
              fontWeight: 700,
              color: accent,
              background: `${accent}20`,
              border: `1px solid ${accent}50`,
              padding: '2px 8px',
              borderRadius: 4,
              letterSpacing: '0.10em',
            }}
          >
            WAVE {wave.wave}/5
          </span>

          <span
            style={{
              fontFamily: C.mono,
              fontSize: '10px',
              color: C.textDim,
              letterSpacing: '0.08em',
            }}
          >
            {wave.botCount} {wave.botCount === 1 ? 'ADVERSARY' : 'ADVERSARIES'}
          </span>
        </div>
      </div>

      {/* 5-segment phase progress bar */}
      <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden' }}>
        {waveSegments.map((seg) => {
          const p = (waveProgress * 100).toFixed(1);
          const activeFill = `linear-gradient(to right, ${seg.accent} ${p}%, rgba(255,255,255,0.10) ${p}%)`;

          return (
            <div
              key={seg.wave}
              style={{
                flex: seg.pct,
                height: '100%',
                background: seg.isPast ? seg.accent : seg.isActive ? activeFill : 'rgba(255,255,255,0.08)',
                borderRadius: 2,
                transition: 'background 0.3s',
              }}
            />
          );
        })}
      </div>

      {/* Tick progress text */}
      <div
        style={{
          fontFamily: C.mono,
          fontSize: FS.xs,
          color: C.textDim,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{wave.threatLabel}</span>
        <span style={{ color: C.textSub }}>
          t{safeTick}/{safeTotalTicks} · {(runProgress * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
});

export default EmpirePhaseBadge;