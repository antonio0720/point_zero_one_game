/**
 * PhantomGameScreen.tsx — CHASE A LEGEND / PHANTOM mode game screen
 * Theme: Spectral Purple. Ghost replay engine. Gap Indicator. Legend markers.
 * Community heat modifier. Dynasty challenge stack. Proof badge preview.
 *
 * Design Tokens: designTokens.ts C.* (DM Mono + Barlow Condensed + DM Sans)
 * Scale: 20M concurrent · Mobile-first · WCAG AA+ · Touch targets 48px · clamp() fonts
 * Engine: PhantomGhostEngine · GapIndicator · LegendDecaySystem
 *
 * FILE LOCATION: src/components/PhantomGameScreen.tsx
 *
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import React, { memo, useMemo, useCallback, useState } from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { C, FS, BP, TOUCH_TARGET, FONT_IMPORT, KEYFRAMES } from '../game/modes/shared/designTokens';

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
${FONT_IMPORT}
${KEYFRAMES}

@keyframes ghostPulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.03); }
}

@keyframes gapBlink {
  0%, 100% { border-color: rgba(155,125,255,0.55); }
  50%       { border-color: rgba(155,125,255,0.15); }
}

@keyframes gainShimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}

@keyframes replayPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(155,125,255,0.60); }
  50%       { opacity: 0.7; box-shadow: 0 0 0 5px rgba(155,125,255,0); }
}

@keyframes divergencePing {
  0%   { box-shadow: 0 0 0 0 rgba(46,232,154,0.55); }
  70%  { box-shadow: 0 0 0 6px rgba(46,232,154,0); }
  100% { box-shadow: 0 0 0 0 rgba(46,232,154,0); }
}

.pgs-root {
  background: #06020E;
  min-height: 100dvh;
  font-family: ${C.body};
  color: ${C.textPrime};
  display: flex;
  flex-direction: column;
}

/* ── Top bar ── */
.pgs-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(6px, 1.5vw, 16px);
  padding: clamp(8px, 2vw, 12px) clamp(10px, 3vw, 20px);
  background: rgba(6,2,14,0.95);
  border-bottom: 1px solid rgba(155,125,255,0.22);
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(12px);
}

/* ── Grid layout ── */
.pgs-grid {
  display: grid;
  gap: clamp(10px, 2vw, 16px);
  padding: clamp(10px, 2vw, 16px);
  grid-template-columns: 1fr;
}

@media ${BP.tablet} {
  .pgs-grid { grid-template-columns: 1fr 1fr; }
}

@media ${BP.desktop} {
  .pgs-grid {
    grid-template-columns: 2fr 1fr 1fr;
    padding: 20px;
    gap: 16px;
  }
  .pgs-col-main  { grid-column: 1; }
  .pgs-col-right { grid-column: 2 / 4; display: flex; flex-direction: column; gap: 14px; }
}

/* ── Panel ── */
.pgs-panel {
  background: rgba(11,5,26,0.95);
  border-radius: 12px;
  border: 1px solid rgba(155,125,255,0.12);
  padding: clamp(12px, 2.5vw, 18px);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.pgs-panel--purple {
  border-color: rgba(155,125,255,0.28);
  box-shadow: 0 0 24px rgba(155,125,255,0.05) inset;
}

.pgs-panel--ahead {
  border-color: rgba(46,232,154,0.28);
  box-shadow: 0 0 24px rgba(46,232,154,0.05) inset;
}

.pgs-panel--behind {
  border-color: rgba(255,155,47,0.28);
  box-shadow: 0 0 20px rgba(255,155,47,0.06) inset;
}

.pgs-panel--critical {
  border-color: rgba(255,77,77,0.38);
  box-shadow: 0 0 28px rgba(255,77,77,0.08) inset;
  animation: gapBlink 2s infinite;
}

/* ── Label ── */
.pgs-label {
  font-family: ${C.mono};
  font-size: ${FS.xs};
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${C.purple};
  margin-bottom: 10px;
}

.pgs-label--dim   { color: ${C.textDim}; }
.pgs-label--green { color: ${C.green}; }
.pgs-label--red   { color: ${C.red}; }

/* ── Stat row ── */
.pgs-stat {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.pgs-stat:last-child { border-bottom: none; }

.pgs-stat-key {
  font-family: ${C.mono};
  font-size: ${FS.xs};
  color: ${C.textSub};
  flex-shrink: 0;
}

.pgs-stat-val {
  font-family: ${C.mono};
  font-size: ${FS.md};
  font-weight: 600;
  color: ${C.textPrime};
  text-align: right;
}

/* ── Marker dot ── */
.pgs-marker-dot {
  width: clamp(8px, 1.5vw, 11px);
  height: clamp(8px, 1.5vw, 11px);
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}

/* ── Button ── */
.pgs-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: ${TOUCH_TARGET}px;
  min-width: ${TOUCH_TARGET}px;
  padding: 0 clamp(12px, 2.5vw, 20px);
  border-radius: 8px;
  border: 1px solid rgba(155,125,255,0.28);
  background: rgba(155,125,255,0.08);
  color: ${C.purple};
  font-family: ${C.mono};
  font-size: ${FS.sm};
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.08s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  touch-action: manipulation;
}

.pgs-btn:active { transform: translateY(1px); }

.pgs-btn:hover, .pgs-btn:focus-visible {
  background: rgba(155,125,255,0.16);
  border-color: ${C.purple};
  outline: 2px solid ${C.purple};
  outline-offset: 2px;
}

/* ── CORD bar ── */
.pgs-cord-bar-track {
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
  position: relative;
}
.pgs-cord-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

/* ── Ghost row ── */
.pgs-ghost-row {
  display: flex;
  align-items: center;
  gap: clamp(6px, 1.5vw, 12px);
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.pgs-ghost-row:last-child { border-bottom: none; }

/* ── Legend marker timeline ── */
.pgs-timeline {
  position: relative;
  height: clamp(32px, 6vw, 44px);
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  overflow: hidden;
}

.pgs-timeline-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(155,125,255,0.15);
  transform: translateY(-50%);
}

.pgs-timeline-fill {
  height: 100%;
  background: ${C.purple};
  border-radius: 2px;
  transition: width 0.3s;
}

.pgs-timeline-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: clamp(8px, 1.5vw, 10px);
  height: clamp(8px, 1.5vw, 10px);
  border-radius: 50%;
  border: 1.5px solid rgba(6,2,14,0.8);
  cursor: pointer;
  transition: transform 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.pgs-timeline-marker:hover { transform: translate(-50%,-50%) scale(1.4); }

/* ── Gap zone pill ── */
.pgs-gap-zone {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: clamp(6px, 1.5vw, 10px) clamp(12px, 2.5vw, 18px);
  border-radius: 8px;
  font-family: ${C.display};
  font-size: ${FS.lg};
  font-weight: 800;
  letter-spacing: 0.05em;
  border: 1.5px solid;
  transition: all 0.3s;
}

/* ── CORD delta display ── */
.pgs-delta-number {
  font-family: ${C.display};
  font-size: ${FS.xxl};
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.02em;
}

/* ── Dynasty badge ── */
.pgs-dynasty-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(201,168,76,0.30);
  background: rgba(201,168,76,0.06);
}

/* ── Divergence meter ── */
.pgs-div-meter-track {
  height: 10px;
  border-radius: 5px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
  position: relative;
}

.pgs-div-meter-player {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
  position: relative;
  z-index: 2;
}

.pgs-div-meter-ghost {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 5px;
  background: rgba(255,255,255,0.16);
  z-index: 1;
  transition: width 0.4s ease;
}

/* ── Ghost replay overlay ── */
.pgs-replay-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.pgs-replay-entry:last-child { border-bottom: none; }

.pgs-replay-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
}

.pgs-replay-pulse--recent {
  animation: replayPulse 1.4s ease-in-out infinite;
}

/* ── Proof card preview ── */
.pgs-proof-card {
  border-radius: 10px;
  border: 1.5px solid rgba(155,125,255,0.30);
  background: linear-gradient(135deg, rgba(155,125,255,0.06) 0%, rgba(11,5,26,0.95) 60%);
  padding: clamp(12px, 2.5vw, 18px);
  position: relative;
  overflow: hidden;
}

.pgs-proof-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(155,125,255,0.06) 50%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: gainShimmer 4s linear infinite;
}

@media (max-width: 539px) {
  .pgs-top-bar  { padding: 8px 10px; }
  .pgs-panel    { padding: 10px; }
  .pgs-label    { font-size: 9px; }
  .pgs-delta-number { font-size: clamp(28px, 7vw, 40px); }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

// ── Constants ─────────────────────────────────────────────────────────────────

const MARKER_COLORS: Record<string, string> = {
  OPPORTUNITY_TAKEN: C.gold,
  OPPORTUNITY_PASSED: C.red,
  HOLD_ACTION: C.purple,
  SHIELD_BREACH: '#C0C0C0',
  CLUTCH_DECISION: '#1A1A1A',
};

const MARKER_LABELS: Record<string, string> = {
  OPPORTUNITY_TAKEN: '🟡 Bought card',
  OPPORTUNITY_PASSED: '🔴 Passed card',
  HOLD_ACTION: '🟣 Used hold',
  SHIELD_BREACH: '⚪ Shield breach + recovery',
  CLUTCH_DECISION: '⚫ Clutch decision (<2s)',
};

const GAP_ZONE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  GAINING: { color: C.green, bg: 'rgba(46,232,154,0.08)', label: 'GAINING', icon: '↑' },
  NEUTRAL: { color: C.purple, bg: 'rgba(155,125,255,0.08)', label: 'NEUTRAL', icon: '→' },
  LOSING: { color: C.orange, bg: 'rgba(255,155,47,0.08)', label: 'LOSING', icon: '↓' },
  CRITICAL: { color: C.crimson, bg: 'rgba(255,23,68,0.10)', label: 'CRITICAL', icon: '⚡' },
};

const PANEL_CLASS_FOR_GAP: Record<string, string> = {
  GAINING: 'pgs-panel pgs-panel--ahead',
  NEUTRAL: 'pgs-panel pgs-panel--purple',
  LOSING: 'pgs-panel pgs-panel--behind',
  CRITICAL: 'pgs-panel pgs-panel--critical',
};

// ── Utilities ────────────────────────────────────────────────────────────────

function n0(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

function clamp01(v: number): number {
  const x = n0(v, 0);
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function clampPct(v: number): number {
  const x = Math.round(n0(v, 0));
  return x < 0 ? 0 : x > 100 ? 100 : x;
}

function clampMinMax(v: number, min: number, max: number): number {
  const x = n0(v, min);
  return x < min ? min : x > max ? max : x;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const x = n0(n, 0);
  const s = x < 0 ? '-' : '';
  const v = Math.abs(x);

  if (v >= 1_000_000) return `${s}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000) return `${s}$${(v / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(v).toLocaleString()}`;
}

function fmtCord(n: number): string {
  return n0(n, 0).toFixed(1);
}

function fmtDelta(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${fmtCord(n)}`;
}

// ── ✅ Shields (fixes TS2322 by not using ShieldIcons shields=) ───────────────

const ShieldPips = memo(function ShieldPips({ count }: { count: number }) {
  const n = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));

  if (n === 0) {
    return <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>0 shields</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label={`${n} shields`}>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${C.goldBrd}`,
            background: C.goldDim,
            color: C.gold,
            fontFamily: C.mono,
            fontSize: '11px',
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          🛡
        </span>
      ))}
    </div>
  );
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LegendRecord {
  id: string;
  displayName: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  cordScore: number; // 0.0 – 1.50 (design contract)
  finalNetWorth: number;
  decayLevel: number; // 0 = fresh
  communityRunsSince: number;
  effectiveHeatModifier: number; // additive heat from community runs
  isChallengerSlot: boolean; // false = THE Legend, true = Challenger
  challengerRank?: 1 | 2 | 3;
  beatRate: number; // 0.0 – 1.0
  challengeCount: number;
  survivorScore: number; // 1–100
  seasonLabel: string;
  proofHash: string;
}

export interface LegendMarker {
  tick: number;
  type: keyof typeof MARKER_COLORS;
  tickPct: number; // 0–1
}

export interface GhostReplayEntry {
  tick: number;
  cardType: string;         // card type only — outcome hidden per game rules
  zone: string;             // market zone at time of play
  isRecent: boolean;        // true if within last 10 ticks
}

export interface GhostDelta {
  cordGap: number; // negative = behind, positive = ahead
  netWorthGap: number;
  cordGapPct: number; // % of legend's CORD
  isAhead: boolean;
  gapZone: 'GAINING' | 'NEUTRAL' | 'LOSING' | 'CRITICAL';
  closingRate: 'GAINING' | 'NEUTRAL' | 'WIDENING'; // 10-tick direction
  drivingComponent: string; // e.g. "Decision Speed: -0.08"
  closeableWindow: number; // ticks where gap is still closeable
  pressureIntensity: number; // 0–1
}

export interface CordComponentScore {
  label: string;
  playerScore: number;
  ghostScore: number;
  weight: number;
}

export interface PhantomGameScreenProps {
  // Core financials
  cash: number;
  netWorth: number;
  income: number;
  expenses: number;
  regime: MarketRegime;
  intelligence: IntelligenceState;
  tick: number;
  totalTicks: number;
  freezeTicks: number;
  shields: number;
  equityHistory: number[];

  // Phantom-specific
  legend: LegendRecord;
  ghostDelta: GhostDelta;
  markers: LegendMarker[];
  cordComponents: CordComponentScore[];

  // Ghost vision — last card type played by legend (not outcome)
  ghostVisionCardType?: string;
  ghostVisionTick?: number;

  // Ghost replay feed — last N plays (newest first)
  replayFeed?: GhostReplayEntry[];

  // Dynasty stack — challengers also in play
  dynastyChallengers?: Pick<LegendRecord, 'id' | 'displayName' | 'cordScore' | 'challengerRank'>[];
  dynastyBeaten?: string[]; // IDs of challengers already beaten this run

  // Current player CORD (live)
  playerCord: number;

  // Proof preview — what badge you'd earn right now
  wouldEarnProof: boolean;
  proofBadgeType?: 'CHALLENGER' | 'LEGEND' | 'DYNASTY';

  // Callbacks
  onGhostVisionExpand?: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const LegendHeader = memo(function LegendHeader({
  legend,
  playerCord,
  wouldEarnProof,
  proofBadgeType,
}: {
  legend: LegendRecord;
  playerCord: number;
  wouldEarnProof: boolean;
  proofBadgeType?: string;
}) {
  const gradeColor: Record<string, string> = {
    A: C.gold,
    B: C.green,
    C: C.blue,
    D: C.orange,
    F: C.red,
  };

  const decayColor =
    legend.decayLevel === 0
      ? C.green
      : legend.decayLevel <= 2
        ? C.gold
        : legend.decayLevel <= 5
          ? C.orange
          : C.crimson;

  const cordDelta = n0(playerCord, 0) - n0(legend.cordScore, 0);
  const cordDeltaColor = cordDelta >= 0 ? C.green : Math.abs(cordDelta) >= 0.2 ? C.red : C.orange;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flex: 1 }} aria-label="Legend header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontSize: FS.xl,
            lineHeight: 1,
            animation: 'ghostPulse 3s ease-in-out infinite',
            display: 'inline-block',
          }}
          aria-hidden="true"
        >
          👻
        </span>

        <div>
          <div
            style={{
              fontFamily: C.display,
              fontSize: FS.lg,
              fontWeight: 800,
              color: C.purple,
              letterSpacing: '0.04em',
              lineHeight: 1.1,
            }}
          >
            {legend.isChallengerSlot ? `CHALLENGER #${legend.challengerRank}` : 'THE LEGEND'}
          </div>

          <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textSub, letterSpacing: '0.08em' }}>
            {legend.displayName} · {legend.seasonLabel}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(155,125,255,0.08)',
          border: '1px solid rgba(155,125,255,0.20)',
          borderRadius: 8,
          padding: '6px 12px',
          flexShrink: 0,
        }}
        aria-label="Legend cord"
      >
        <span
          style={{
            fontFamily: C.display,
            fontSize: FS.xl,
            fontWeight: 900,
            color: gradeColor[legend.grade] ?? C.textPrime,
            lineHeight: 1,
          }}
        >
          {legend.grade}
        </span>

        <div>
          <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>CORD</div>
          <div style={{ fontFamily: C.mono, fontSize: FS.md, fontWeight: 700, color: C.textPrime }}>
            {fmtCord(legend.cordScore)}
          </div>
        </div>

        <div style={{ marginLeft: 6, textAlign: 'right' }}>
          <div style={{ fontFamily: C.mono, fontSize: '9px', color: C.textDim, letterSpacing: '0.1em' }}>Δ</div>
          <div style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 800, color: cordDeltaColor }}>
            {fmtDelta(cordDelta)}
          </div>
        </div>
      </div>

      {legend.decayLevel > 0 && (
        <div
          style={{
            fontFamily: C.mono,
            fontSize: FS.xs,
            fontWeight: 700,
            color: decayColor,
            background: `${decayColor}15`,
            border: `1px solid ${decayColor}40`,
            padding: '4px 10px',
            borderRadius: 6,
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}
        >
          ☠ DECAY ×{legend.decayLevel}
        </div>
      )}

      {legend.effectiveHeatModifier > 0 && (
        <div
          style={{
            fontFamily: C.mono,
            fontSize: FS.xs,
            color: C.orange,
            background: 'rgba(255,155,47,0.10)',
            border: '1px solid rgba(255,155,47,0.25)',
            padding: '4px 10px',
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          🔥 +{n0(legend.effectiveHeatModifier, 0).toFixed(0)} HEAT
        </div>
      )}

      {wouldEarnProof && proofBadgeType && (
        <div
          style={{
            fontFamily: C.mono,
            fontSize: FS.xs,
            fontWeight: 700,
            color: C.gold,
            background: C.goldDim,
            border: `1px solid ${C.goldBrd}`,
            padding: '4px 10px',
            borderRadius: 6,
            letterSpacing: '0.1em',
            animation: 'pulseBadge 1.5s infinite',
            flexShrink: 0,
          }}
          aria-label="Proof badge incoming"
        >
          ✦ {proofBadgeType} INCOMING
        </div>
      )}
    </div>
  );
});

const DivergenceMeter = memo(function DivergenceMeter({
  components,
  playerCord,
  legendCord,
}: {
  components: CordComponentScore[];
  playerCord: number;
  legendCord: number;
}) {
  const player = clamp01(n0(playerCord, 0) / Math.max(0.01, n0(legendCord, 0.01)));
  const ghost = 1.0; // legend is always the ceiling
  const isAhead = player >= ghost;

  const delta = n0(playerCord, 0) - n0(legendCord, 0);
  const deltaColor = delta >= 0 ? C.green : Math.abs(delta) >= 0.2 ? C.red : C.orange;
  const deltaArrow = delta > 0.02 ? '↑ GAINING' : delta < -0.02 ? '↓ WIDENING' : '→ NEUTRAL';
  const arrowColor = delta > 0.02 ? C.green : delta < -0.02 ? C.red : C.textDim;

  return (
    <div className="pgs-panel pgs-panel--purple" aria-label="Divergence meter">
      <div className="pgs-label">DIVERGENCE METER — CORD vs GHOST</div>

      {/* Main dual-bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>YOUR CORD</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: C.mono, fontSize: FS.md, fontWeight: 700, color: deltaColor }}>
              {fmtDelta(delta)}
            </span>
            <span style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 700, color: arrowColor }}>
              {deltaArrow}
            </span>
          </div>
        </div>

        <div className="pgs-div-meter-track">
          {/* Ghost bar (background, full-width = legend score) */}
          <div
            className="pgs-div-meter-ghost"
            style={{ width: '100%' }}
            aria-hidden="true"
          />
          {/* Player bar (foreground, proportional) */}
          <div
            className={`pgs-div-meter-player${isAhead ? ' pgs-div-meter-player--ahead' : ''}`}
            style={{
              width: `${clamp01(player) * 100}%`,
              background: isAhead ? C.green : C.purple,
            }}
            aria-label={`Your CORD: ${fmtCord(playerCord)} of ${fmtCord(legendCord)}`}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: isAhead ? C.green : C.purple }}>
            {fmtCord(playerCord)}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: 'rgba(255,255,255,0.25)' }}>
            Ghost: {fmtCord(legendCord)}
          </span>
        </div>
      </div>

      {/* Per-component breakdown */}
      {components.map((comp) => {
        const p = clamp01(comp.playerScore);
        const g = clamp01(comp.ghostScore);
        const ahead = p >= g;

        return (
          <div key={comp.label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textSub }}>{comp.label}</span>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 700, color: ahead ? C.green : C.orange }}>
                {(p * 100).toFixed(0)}{' '}
                <span style={{ color: C.textDim }}>/ {(g * 100).toFixed(0)}</span>
              </span>
            </div>

            <div className="pgs-div-meter-track" style={{ height: 6 }}>
              {/* Ghost tick line */}
              <div
                style={{
                  position: 'absolute',
                  left: `${g * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1.5,
                  background: 'rgba(155,125,255,0.45)',
                  zIndex: 3,
                }}
                aria-hidden="true"
              />
              {/* Player fill */}
              <div
                style={{
                  width: `${p * 100}%`,
                  height: '100%',
                  borderRadius: 5,
                  background: ahead ? C.green : C.purple,
                  transition: 'width 0.4s ease',
                  position: 'relative',
                  zIndex: 2,
                }}
              />
            </div>
          </div>
        );
      })}

      <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, marginTop: 6 }}>
        Purple line = Ghost score per component
      </div>
    </div>
  );
});

const GapIndicatorPanel = memo(function GapIndicatorPanel({ delta }: { delta: GhostDelta }) {
  const zoneCfg = GAP_ZONE_CONFIG[delta.gapZone] ?? GAP_ZONE_CONFIG.NEUTRAL;
  const panelClass = PANEL_CLASS_FOR_GAP[delta.gapZone] ?? 'pgs-panel pgs-panel--purple';

  const cordGap = n0(delta.cordGap, 0);
  const cordGapPctAbs = Math.abs(n0(delta.cordGapPct, 0) * 100);
  const isAhead = !!delta.isAhead;

  const deltaColor = isAhead ? C.green : Math.abs(cordGap) > 0.2 ? C.red : C.orange;

  const closingArrow = delta.closingRate === 'GAINING' ? '↑' : delta.closingRate === 'WIDENING' ? '↓' : '→';
  const closingColor = delta.closingRate === 'GAINING' ? C.green : delta.closingRate === 'WIDENING' ? C.red : C.textDim;

  const closeableWindow = Math.max(0, Math.floor(n0(delta.closeableWindow, 0)));
  const windowColor =
    closeableWindow > 60 ? C.green : closeableWindow > 30 ? C.gold : closeableWindow > 10 ? C.orange : C.crimson;

  return (
    <div className={panelClass} aria-label="Gap indicator">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="pgs-label pgs-label--dim">CORD DELTA</div>
          <div className="pgs-delta-number" style={{ color: deltaColor }}>
            {fmtDelta(cordGap)}
          </div>
          <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, marginTop: 4 }}>
            {isAhead ? 'AHEAD OF GHOST' : 'BEHIND GHOST'} · {cordGapPctAbs.toFixed(1)}%
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div
            className="pgs-gap-zone"
            style={{ color: zoneCfg.color, background: zoneCfg.bg, borderColor: `${zoneCfg.color}50` }}
            aria-label={`Gap zone ${zoneCfg.label}`}
          >
            <span aria-hidden="true">{zoneCfg.icon}</span>
            {zoneCfg.label}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>CLOSING RATE</span>
            <span style={{ fontFamily: C.display, fontSize: FS.lg, fontWeight: 800, color: closingColor }}>{closingArrow}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'rgba(155,125,255,0.06)',
          borderRadius: 6,
          border: '1px solid rgba(155,125,255,0.10)',
        }}
      >
        <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, marginBottom: 3 }}>DRIVING GAP</div>
        <div style={{ fontFamily: C.mono, fontSize: FS.sm, color: C.textPrime, fontWeight: 600 }}>{delta.drivingComponent}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>CLOSEABLE WINDOW</span>
        <span style={{ fontFamily: C.mono, fontSize: FS.md, fontWeight: 700, color: windowColor }}>
          {closeableWindow > 0 ? `${closeableWindow}t` : 'CLOSED'}
        </span>
      </div>

      {/* Pressure intensity bar */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.10em' }}>
            PRESSURE INTENSITY
          </span>
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 700, color: C.textSub }}>
            {clampPct(n0(delta.pressureIntensity, 0) * 100)}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
            position: 'relative',
          }}
          aria-label={`Pressure ${clampPct(n0(delta.pressureIntensity, 0) * 100)}%`}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 3,
              width: `${clampPct(n0(delta.pressureIntensity, 0) * 100)}%`,
              background: `linear-gradient(90deg, ${C.purple} 0%, ${C.orange} 60%, ${C.crimson} 100%)`,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
});

const CordComponentBreakdown = memo(function CordComponentBreakdown({
  components,
  playerCord,
  legendCord,
}: {
  components: CordComponentScore[];
  playerCord: number;
  legendCord: number;
}) {
  const safeLegendCord = Math.max(0.01, n0(legendCord, 0.01));
  const safePlayerCord = Math.max(0, n0(playerCord, 0));

  const overallPct = clampMinMax((safePlayerCord / safeLegendCord) * 100, 0, 100);

  return (
    <div className="pgs-panel" aria-label="CORD breakdown">
      <div className="pgs-label">CORD BREAKDOWN — YOU vs LEGEND</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>YOUR CORD</span>
          <span style={{ fontFamily: C.mono, fontSize: FS.md, fontWeight: 700, color: C.purple }}>
            {fmtCord(safePlayerCord)} <span style={{ color: C.textDim, fontSize: FS.xs }}>/ {fmtCord(safeLegendCord)}</span>
          </span>
        </div>

        <div className="pgs-cord-bar-track" aria-label="Overall CORD bar">
          <div
            className="pgs-cord-bar-fill"
            style={{
              width: `${overallPct.toFixed(1)}%`,
              background: safePlayerCord >= safeLegendCord ? C.green : C.purple,
            }}
          />
        </div>
      </div>

      {components.map((comp) => {
        const p = clamp01(comp.playerScore);
        const g = clamp01(comp.ghostScore);

        const pct = clampMinMax(p * 100, 0, 100);
        const gPct = clampMinMax(g * 100, 0, 100);

        const isAhead = p >= g;
        const barColor = isAhead ? C.green : C.orange;

        return (
          <div key={comp.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textSub }}>{comp.label}</span>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 700, color: isAhead ? C.green : C.orange }}>
                {pct.toFixed(0)} <span style={{ color: C.textDim }}>/ {gPct.toFixed(0)}</span>
              </span>
            </div>

            <div className="pgs-cord-bar-track" aria-label={`${comp.label} bar`}>
              <div
                style={{
                  position: 'absolute',
                  left: `${gPct}%`,
                  top: 0,
                  bottom: 0,
                  width: 1.5,
                  background: 'rgba(155,125,255,0.40)',
                  zIndex: 2,
                }}
                aria-hidden="true"
              />
              <div className="pgs-cord-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
            </div>
          </div>
        );
      })}

      <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, marginTop: 8 }}>
        Purple line = Ghost score per component
      </div>
    </div>
  );
});

const LegendMarkerTimeline = memo(function LegendMarkerTimeline({
  markers,
  tick,
  totalTicks,
  onMarkerHover,
}: {
  markers: LegendMarker[];
  tick: number;
  totalTicks: number;
  onMarkerHover?: (marker: LegendMarker | null) => void;
}) {
  const safeTotal = Math.max(1, Math.floor(n0(totalTicks, 1)));
  const safeTick = clampMinMax(Math.floor(n0(tick, 0)), 0, safeTotal);

  const progressPct = clampMinMax((safeTick / safeTotal) * 100, 0, 100);

  const sortedMarkers = useMemo(() => {
    const ms = Array.isArray(markers) ? markers.slice() : [];
    ms.sort((a, b) => n0(a.tick, 0) - n0(b.tick, 0));
    return ms;
  }, [markers]);

  return (
    <div className="pgs-panel pgs-panel--purple" aria-label="Legend markers timeline">
      <div className="pgs-label">LEGEND MARKERS — GHOST TIMELINE</div>

      <div className="pgs-timeline">
        <div className="pgs-timeline-track">
          <div className="pgs-timeline-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: `${progressPct}%`,
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 2,
            height: '80%',
            background: C.purple,
            borderRadius: 1,
            zIndex: 3,
          }}
          aria-hidden="true"
        />

        {sortedMarkers.map((m) => {
          const leftPct = clampMinMax(n0(m.tickPct, 0) * 100, 0, 100);
          const markerColor = MARKER_COLORS[m.type] ?? C.textDim;
          const isPast = n0(m.tick, 0) <= safeTick;

          return (
            <div
              key={`${m.tick}-${m.type}`}
              className="pgs-timeline-marker"
              title={MARKER_LABELS[m.type] ?? m.type}
              style={{ left: `${leftPct}%`, background: markerColor, opacity: isPast ? 1 : 0.4 }}
              onMouseEnter={() => onMarkerHover?.(m)}
              onMouseLeave={() => onMarkerHover?.(null)}
              onFocus={() => onMarkerHover?.(m)}
              onBlur={() => onMarkerHover?.(null)}
              tabIndex={0}
              role="button"
              aria-label={MARKER_LABELS[m.type] ?? m.type}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 10 }}>
        {Object.entries(MARKER_LABELS).map(([type, label]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="pgs-marker-dot" style={{ background: MARKER_COLORS[type] ?? C.textDim, flexShrink: 0 }} />
            <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

const GhostReplayOverlay = memo(function GhostReplayOverlay({
  replayFeed,
  onExpand,
}: {
  replayFeed: GhostReplayEntry[];
  onExpand?: () => void;
}) {
  const entries = Array.isArray(replayFeed) ? replayFeed.slice(0, 8) : [];

  return (
    <div className="pgs-panel pgs-panel--purple" aria-label="Ghost replay overlay">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="pgs-label" style={{ marginBottom: 0 }}>👁 GHOST REPLAY — LEGEND PLAYS</div>
        {onExpand && (
          <button
            type="button"
            className="pgs-btn"
            style={{ minHeight: 32, padding: '0 10px', fontSize: FS.xs }}
            onClick={onExpand}
          >
            EXPAND
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, padding: '8px 0' }}>
          No legend plays visible yet. Intelligence unlocks at t10.
        </div>
      ) : (
        entries.map((entry, i) => (
          <div key={`${entry.tick}-${i}`} className="pgs-replay-entry">
            <div
              className={`pgs-replay-pulse${entry.isRecent ? ' pgs-replay-pulse--recent' : ''}`}
              style={{ background: entry.isRecent ? C.purple : C.textDim }}
              aria-hidden="true"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 700, color: C.purple }}>
                  {entry.cardType}
                </span>
                <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, flexShrink: 0 }}>
                  t{Math.max(0, Math.floor(n0(entry.tick, 0)))}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textSub }}>
                  Zone: {entry.zone}
                </span>
                {entry.isRecent && (
                  <span style={{ fontFamily: C.mono, fontSize: '9px', color: C.purple, letterSpacing: '0.08em' }}>
                    RECENT
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop: 8, fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>
        Outcome hidden. Card type is intelligence only.
      </div>
    </div>
  );
});

const DynastyPanel = memo(function DynastyPanel({
  challengers,
  beaten,
  playerCord,
}: {
  challengers: Pick<LegendRecord, 'id' | 'displayName' | 'cordScore' | 'challengerRank'>[];
  beaten: string[];
  playerCord: number;
}) {
  if (challengers.length === 0) return null;

  const player = n0(playerCord, 0);
  const beatenSet = useMemo(() => new Set(beaten), [beaten]);

  return (
    <div className="pgs-panel" aria-label="Dynasty challenge">
      <div className="pgs-label">DYNASTY CHALLENGE</div>

      <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, marginBottom: 10 }}>
        Beat ALL challengers + Legend to claim Dynasty Badge
      </div>

      {challengers.map((c) => {
        const isBeat = beatenSet.has(c.id);
        const gap = player - n0(c.cordScore, 0);
        const isAhead = gap > 0;

        return (
          <div key={c.id} className="pgs-ghost-row">
            <span
              style={{
                fontFamily: C.mono,
                fontSize: FS.xs,
                fontWeight: 700,
                color: isBeat ? C.green : C.textDim,
                background: isBeat ? 'rgba(46,232,154,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isBeat ? 'rgba(46,232,154,0.25)' : C.brdLow}`,
                padding: '3px 8px',
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              {isBeat ? '✓ BEATEN' : `#${c.challengerRank}`}
            </span>

            <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textSub, flex: 1 }}>{c.displayName}</span>

            <span style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 600, color: isAhead ? C.green : C.orange }}>
              {fmtDelta(gap)}
            </span>
          </div>
        );
      })}

      {beaten.length === challengers.length && (
        <div className="pgs-dynasty-badge" style={{ marginTop: 10 }}>
          <span style={{ fontSize: FS.lg }} aria-hidden="true">
            🏆
          </span>
          <div>
            <div style={{ fontFamily: C.display, fontSize: FS.md, fontWeight: 800, color: C.gold }}>DYNASTY WINDOW OPEN</div>
            <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, marginTop: 2 }}>
              Beat The Legend to claim Dynasty Badge
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const ProofCardPreview = memo(function ProofCardPreview({
  legend,
  playerCord,
  proofBadgeType,
  wouldEarnProof,
}: {
  legend: LegendRecord;
  playerCord: number;
  proofBadgeType?: string;
  wouldEarnProof: boolean;
}) {
  const legendCord = Math.max(0.01, n0(legend.cordScore, 0.01));
  const player = n0(playerCord, 0);
  const gapPct = ((player - legendCord) / legendCord) * 100;

  return (
    <div className={`pgs-proof-card ${wouldEarnProof ? 'pgs-panel--purple' : ''}`} aria-label="Proof card preview">
      <div className="pgs-label" style={{ marginBottom: 8 }}>
        {wouldEarnProof ? '✦ PROOF BADGE — WOULD EARN' : 'PROOF CARD PREVIEW'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>VS LEGEND</div>
          <div style={{ fontFamily: C.mono, fontSize: FS.md, fontWeight: 700, color: gapPct >= 0 ? C.green : C.orange }}>
            {gapPct >= 0 ? '+' : ''}
            {gapPct.toFixed(1)}%
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>BADGE TYPE</div>
          <div style={{ fontFamily: C.display, fontSize: FS.lg, fontWeight: 800, color: proofBadgeType === 'DYNASTY' ? C.gold : C.purple }}>
            {proofBadgeType ?? 'NONE'}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          fontFamily: C.mono,
          fontSize: '9px',
          color: C.textDim,
          letterSpacing: '0.12em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={legend.proofHash}
      >
        GHOST: {String(legend.proofHash ?? '').slice(0, 32)}…
      </div>
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export const PhantomGameScreen = memo(function PhantomGameScreen(props: PhantomGameScreenProps) {
  const {
    cash,
    netWorth,
    income,
    expenses,
    regime,
    intelligence,
    tick,
    totalTicks,
    freezeTicks,
    shields,
    equityHistory,
    legend,
    ghostDelta,
    markers,
    cordComponents,
    ghostVisionCardType,
    ghostVisionTick,
    replayFeed = [],
    dynastyChallengers = [],
    dynastyBeaten = [],
    playerCord,
    wouldEarnProof,
    proofBadgeType,
    onGhostVisionExpand,
  } = props;

  const [hoveredMarker, setHoveredMarker] = useState<LegendMarker | null>(null);
  const cashflow = useMemo(() => n0(income, 0) - n0(expenses, 0), [income, expenses]);

  const handleGhostExpand = useCallback(() => {
    onGhostVisionExpand?.();
  }, [onGhostVisionExpand]);

  const handleMarkerHover = useCallback((m: LegendMarker | null) => {
    setHoveredMarker(m);
  }, []);

  const beatRate = clamp01(n0(legend.beatRate, 0));
  const beatRateColor = beatRate < 0.05 ? C.crimson : beatRate < 0.15 ? C.red : beatRate < 0.35 ? C.orange : C.green;

  const safeTick = Math.max(0, Math.floor(n0(tick, 0)));
  const safeTotal = Math.max(1, Math.floor(n0(totalTicks, 1)));

  return (
    <>
      <style>{STYLES}</style>

      <div className="pgs-root">
        <div className="pgs-top-bar" role="banner">
          <LegendHeader legend={legend} playerCord={playerCord} wouldEarnProof={wouldEarnProof} proofBadgeType={proofBadgeType} />

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>YOUR CORD</span>
              <span style={{ fontFamily: C.display, fontSize: FS.lg, fontWeight: 800, color: n0(playerCord, 0) >= n0(legend.cordScore, 0) ? C.green : C.purple }}>
                {fmtCord(playerCord)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>TICK</span>
              <span style={{ fontFamily: C.mono, fontSize: FS.lg, fontWeight: 700, color: C.textPrime }}>
                {safeTick}
                <span style={{ color: C.textDim, fontSize: FS.xs }}>/{safeTotal}</span>
              </span>
            </div>

            {freezeTicks > 0 && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  fontFamily: C.mono,
                  fontSize: FS.sm,
                  fontWeight: 700,
                  color: C.blue,
                  background: 'rgba(74,158,255,0.12)',
                  border: '1px solid rgba(74,158,255,0.25)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  animation: 'pulseBadge 1.5s infinite',
                }}
              >
                🧊 {Math.max(0, Math.floor(n0(freezeTicks, 0)))}t
              </div>
            )}
          </div>
        </div>

        <div className="pgs-grid" role="main">
          <div className="pgs-col-main" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="pgs-panel pgs-panel--purple">
              <div className="pgs-label">EQUITY CURVE</div>
              <GameBoard
                equityHistory={equityHistory}
                cash={cash}
                netWorth={netWorth}
                income={income}
                expenses={expenses}
                regime={regime}
                intelligence={intelligence}
                tick={tick}
                totalTicks={totalTicks}
                freezeTicks={freezeTicks}
              />
            </div>

            <LegendMarkerTimeline markers={markers} tick={tick} totalTicks={totalTicks} onMarkerHover={handleMarkerHover} />

            {hoveredMarker && (
              <div className="pgs-panel" style={{ borderColor: 'rgba(155,125,255,0.22)', background: 'rgba(155,125,255,0.05)' }} aria-label="Marker detail">
                <div className="pgs-label pgs-label--dim">MARKER</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: C.mono, fontSize: FS.sm, color: C.textPrime, fontWeight: 700 }}>
                    {MARKER_LABELS[hoveredMarker.type] ?? hoveredMarker.type}
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: FS.sm, color: C.textDim }}>
                    t{Math.max(0, Math.floor(n0(hoveredMarker.tick, 0)))}
                  </div>
                </div>
              </div>
            )}

            <div className="pgs-panel" aria-label="Financials">
              <div className="pgs-label pgs-label--dim">FINANCIALS</div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Cash</span>
                <span className="pgs-stat-val" style={{ color: n0(cash, 0) < 0 ? C.red : C.textPrime }}>
                  {fmt(cash)}
                </span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Net Worth</span>
                <span className="pgs-stat-val">{fmt(netWorth)}</span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Income</span>
                <span className="pgs-stat-val" style={{ color: C.green }}>
                  {fmt(income)}
                </span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Expenses</span>
                <span className="pgs-stat-val" style={{ color: C.red }}>
                  {fmt(expenses)}
                </span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Cashflow</span>
                <span className="pgs-stat-val" style={{ color: cashflow >= 0 ? C.green : C.red }}>
                  {cashflow >= 0 ? '+' : ''}
                  {fmt(cashflow)}/mo
                </span>
              </div>
            </div>

            <div className="pgs-panel" aria-label="Shields">
              <div className="pgs-label pgs-label--dim">SHIELDS</div>
              <ShieldPips count={shields} />
            </div>
          </div>

          <div className="pgs-col-right">
            <GapIndicatorPanel delta={ghostDelta} />

            <DivergenceMeter
              components={cordComponents}
              playerCord={playerCord}
              legendCord={legend.cordScore}
            />

            <CordComponentBreakdown components={cordComponents} playerCord={playerCord} legendCord={legend.cordScore} />

            <GhostReplayOverlay replayFeed={replayFeed} onExpand={onGhostVisionExpand} />

            {dynastyChallengers.length > 0 && <DynastyPanel challengers={dynastyChallengers} beaten={dynastyBeaten} playerCord={playerCord} />}

            <div className="pgs-panel" aria-label="Legend record">
              <div className="pgs-label pgs-label--dim">LEGEND RECORD</div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Final Net Worth</span>
                <span className="pgs-stat-val">{fmt(legend.finalNetWorth)}</span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Beat Rate</span>
                <span className="pgs-stat-val" style={{ color: beatRateColor }}>
                  {(beatRate * 100).toFixed(1)}%
                </span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Total Challenges</span>
                <span className="pgs-stat-val">{Math.max(0, Math.floor(n0(legend.challengeCount, 0))).toLocaleString()}</span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Difficulty Score</span>
                <span
                  className="pgs-stat-val"
                  style={{
                    color:
                      n0(legend.survivorScore, 0) >= 80
                        ? C.crimson
                        : n0(legend.survivorScore, 0) >= 60
                          ? C.red
                          : n0(legend.survivorScore, 0) >= 40
                            ? C.orange
                            : C.gold,
                  }}
                >
                  {Math.max(0, Math.floor(n0(legend.survivorScore, 0)))}/100
                </span>
              </div>

              <div className="pgs-stat">
                <span className="pgs-stat-key">Community Heat +</span>
                <span className="pgs-stat-val" style={{ color: C.orange }}>
                  +{n0(legend.effectiveHeatModifier, 0).toFixed(0)}
                </span>
              </div>
            </div>

            <ProofCardPreview legend={legend} playerCord={playerCord} proofBadgeType={proofBadgeType} wouldEarnProof={wouldEarnProof} />
          </div>
        </div>
      </div>
    </>
  );
});

export default PhantomGameScreen;