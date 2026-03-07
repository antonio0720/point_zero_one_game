// pzo-web/src/components/EmpireGameScreen.tsx

/**
 * EmpireGameScreen.tsx — GO ALONE / EMPIRE mode game screen
 * ADAPTED TO CURRENT REPO STORE CONTRACTS.
 *
 * SOURCE OF TRUTH:
 * - Financials come from runStore: cashBalance / monthlyIncome / monthlyExpenses / netWorth
 * - Engine metrics come from engineStore:
 *   pressure.score
 *   tension.score
 *   shield.overallIntegrityPct
 *   battle.haterHeat / battle.injectedCards
 *   cascade.activeNegativeChains
 *   sovereignty.sovereigntyScore
 *   time.seasonTickBudget
 *   run.lastTickIndex / run.lifecycleState
 *
 * FILE LOCATION: pzo-web/src/components/EmpireGameScreen.tsx
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { EmpireBleedBanner } from './EmpireBleedBanner';
import {
  C,
  FS,
  BP,
  TOUCH_TARGET,
  FONT_IMPORT,
  KEYFRAMES,
} from '../game/modes/shared/designTokens';
import {
  DECISION_TAG_COLORS,
  DECISION_TAG_ICONS,
  inferDecisionTagFromInjectionType,
} from '../game/modes/empire/pressureJournalEngine';
import { getEmpireWave } from '../game/modes/empire/empireConfig';
import {
  computeBleedModeState,
  estimatedSurvivalTicks,
  maxBleedSeverity,
  type BleedSeverity,
} from '../game/modes/empire/bleedMode';

// ── Store hooks ───────────────────────────────────────────────────────────────
import { useEngineStore } from '../store/engineStore';
import { useRunStore } from '../store/runStore';
import { useGameLoop } from '../hooks/useGameLoop';

// ── Battle types ──────────────────────────────────────────────────────────────
import type { InjectedCard } from '../engines/battle/types';

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
${FONT_IMPORT}
${KEYFRAMES}

.egs-root {
  background: ${C.void};
  min-height: 100dvh;
  font-family: ${C.body};
  color: ${C.textPrime};
  display: flex;
  flex-direction: column;
  gap: 0;
}

.egs-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  background: ${C.panel};
  border-bottom: 1px solid ${C.goldBrd};
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(12px);
}

.egs-grid {
  display: grid;
  gap: 12px;
  padding: 12px;
  grid-template-columns: 1fr;
}

@media ${BP.tablet} {
  .egs-grid { grid-template-columns: 1fr 1fr; }
}

@media ${BP.desktop} {
  .egs-grid {
    grid-template-columns: 2fr 1fr 1fr;
    padding: 16px;
    gap: 16px;
  }
  .egs-grid .egs-main  { grid-column: 1; }
  .egs-grid .egs-right { grid-column: 2 / 4; }
}

.egs-panel {
  background: ${C.panel};
  border-radius: 12px;
  border: 1px solid ${C.brdLow};
  padding: 14px;
  transition: border-color 0.2s;
}

.egs-panel--gold   { border-color: ${C.goldBrd}; box-shadow: 0 0 20px rgba(201,168,76,0.06) inset; }
.egs-panel--urgent { border-color: rgba(255,77,77,0.30); box-shadow: 0 0 24px rgba(255,77,77,0.08) inset; }
.egs-panel--warn   { border-color: rgba(255,140,0,0.30); box-shadow: 0 0 18px rgba(255,140,0,0.06) inset; }

.egs-label {
  font-family: ${C.mono};
  font-size: ${FS.xs};
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${C.gold};
  margin-bottom: 10px;
}
.egs-label--sub  { color: ${C.textDim}; }
.egs-label--red  { color: ${C.red}; }
.egs-label--green{ color: ${C.green}; }

.egs-stat {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid ${C.brdLow};
}
.egs-stat:last-child { border-bottom: none; }

.egs-stat-key {
  font-family: ${C.mono};
  font-size: ${FS.xs};
  color: ${C.textSub};
  flex-shrink: 0;
}

.egs-stat-val {
  font-family: ${C.mono};
  font-size: ${FS.md};
  font-weight: 600;
  color: ${C.textPrime};
  text-align: right;
}

.egs-bar-track {
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}

.egs-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: ${TOUCH_TARGET}px;
  min-width: ${TOUCH_TARGET}px;
  padding: 0 18px;
  border-radius: 8px;
  border: 1px solid ${C.goldBrd};
  background: ${C.goldDim};
  color: ${C.gold};
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
.egs-btn:active { transform: translateY(1px); }
.egs-btn:hover, .egs-btn:focus-visible {
  background: rgba(201,168,76,0.18);
  border-color: ${C.gold};
  outline: 2px solid ${C.gold};
  outline-offset: 2px;
}
.egs-btn--danger { border-color: rgba(255,77,77,0.28); background: rgba(255,77,77,0.10); color: ${C.red}; }
.egs-btn--danger:hover, .egs-btn--danger:focus-visible {
  background: rgba(255,77,77,0.16);
  border-color: rgba(255,77,77,0.55);
  outline: 2px solid rgba(255,77,77,0.70);
}

.egs-journal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid ${C.brdLow};
  font-family: ${C.mono};
  font-size: ${FS.xs};
}
.egs-journal-row:last-child { border-bottom: none; }

.egs-decision-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ${C.mono};
  font-size: ${FS.xs};
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.08em;
}

@media (max-width: 539px) {
  .egs-top-bar { gap: 4px; padding: 8px 10px; }
  .egs-panel   { padding: 10px; }
  .egs-label   { font-size: 9px; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

// ── Utilities ─────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n);
  return v < 0 ? 0 : v > 100 ? 100 : v;
}

function fmt(n: number): string {
  const neg = n < 0;
  const v = Math.abs(n);
  if (!Number.isFinite(v)) return '$0';
  if (v >= 1_000_000) return `${neg ? '-' : ''}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000) return `${neg ? '-' : ''}$${(v / 1e3).toFixed(1)}K`;
  return `${neg ? '-' : ''}$${Math.round(v).toLocaleString()}`;
}

function fmtCf(n: number): string {
  return `${n >= 0 ? '+' : ''}${fmt(n)}/mo`;
}

function fmtPct(n: number): string {
  return `${clampPct(n * 100)}%`;
}

function normalizeScore(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) return 0;
  const safe = value ?? 0;
  if (safe <= 1 && safe >= 0) return safe;
  return clamp01(safe / 100);
}

function normalizeHeat(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) return 0;
  const safe = value ?? 0;
  if (safe <= 1 && safe >= 0) return safe;
  return clamp01(safe / 100);
}

function deriveMarketRegime(
  pressureScore: number,
  tensionScore: number,
  heatScore: number,
  sovereigntyProgress: number,
  cashflow: number,
  cash: number,
): MarketRegime {
  if (pressureScore >= 0.82 || tensionScore >= 0.8 || heatScore >= 0.75 || (cashflow < 0 && cash <= 0)) {
    return 'Panic';
  }
  if (sovereigntyProgress >= 0.85 && pressureScore <= 0.35 && tensionScore <= 0.4 && cashflow >= 0) {
    return 'Euphoria';
  }
  if (pressureScore >= 0.58 || tensionScore >= 0.6 || heatScore >= 0.5) {
    return 'Compression';
  }
  if (cashflow >= 0 && sovereigntyProgress >= 0.45) {
    return 'Expansion';
  }
  return 'Stable';
}

function buildDerivedIntelligenceState(
  pressureScore: number,
  tensionScore: number,
  heatScore: number,
  sovereigntyProgress: number,
  shieldRatio: number,
  cashflow: number,
): IntelligenceState {
  return {
    alpha: clamp01(0.35 + sovereigntyProgress * 0.65),
    risk: clamp01(pressureScore),
    volatility: clamp01((tensionScore + heatScore) / 2),
    antiCheat: clamp01(shieldRatio),
    personalization: clamp01(0.45 + sovereigntyProgress * 0.55),
    rewardFit: clamp01((sovereigntyProgress + shieldRatio) / 2),
    recommendationPower: clamp01(0.35 + (1 - pressureScore) * 0.65),
    churnRisk: clamp01(Math.max(pressureScore, tensionScore, heatScore)),
    momentum: clamp01((sovereigntyProgress + (cashflow >= 0 ? 0.8 : 0.2)) / 2),
  };
}

function estimateInjectionIncomeDelta(card: InjectedCard): number {
  switch (card.injectionType) {
    case 'FORCED_SALE':
      return -7_500;
    case 'REGULATORY_HOLD':
      return -4_000;
    case 'INVERSION_CURSE':
      return -6_000;
    case 'EXPENSE_SPIKE':
      return -3_500;
    case 'DILUTION_NOTICE':
      return -8_500;
    case 'HATER_HEAT_SURGE':
      return -2_000;
    default:
      return -1_500;
  }
}

// ── Decision tag type guard ───────────────────────────────────────────────────

type DecisionTagKey = Extract<keyof typeof DECISION_TAG_COLORS, string>;

function isDecisionTagKey(tag: string): tag is DecisionTagKey {
  return (
    Object.prototype.hasOwnProperty.call(DECISION_TAG_COLORS, tag) &&
    Object.prototype.hasOwnProperty.call(DECISION_TAG_ICONS, tag)
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EmpireGameScreenProps {
  onCardCounterplay?: (cardId: string, actionId: string) => void;
  onIgnoreCard?: (cardId: string) => void;
}

// ── Engine status bar ─────────────────────────────────────────────────────────

const EngineStatusBar = memo(function EngineStatusBar({
  pressureScore,
  tensionScore,
  cascadeChains,
  sovereigntyProgress,
  haterHeat,
}: {
  pressureScore: number;
  tensionScore: number;
  cascadeChains: number;
  sovereigntyProgress: number;
  haterHeat: number;
}) {
  const metrics = [
    {
      label: 'PRESSURE',
      value: fmtPct(pressureScore),
      barPct: clamp01(pressureScore) * 100,
      barColor: pressureScore > 0.75 ? C.red : pressureScore > 0.5 ? C.orange : C.gold,
    },
    {
      label: 'TENSION',
      value: fmtPct(tensionScore),
      barPct: clamp01(tensionScore) * 100,
      barColor: tensionScore > 0.75 ? C.red : tensionScore > 0.5 ? C.orange : C.gold,
    },
    {
      label: 'HATER HEAT',
      value: `${Math.round(haterHeat)}`,
      barPct: Math.min(100, haterHeat),
      barColor: haterHeat > 75 ? C.red : haterHeat > 50 ? C.orange : C.gold,
    },
    {
      label: 'CASCADE',
      value: `${cascadeChains}x`,
      barPct: Math.min(100, cascadeChains * 20),
      barColor: cascadeChains >= 4 ? C.red : cascadeChains >= 2 ? C.orange : C.gold,
    },
    {
      label: 'SOVEREIGNTY',
      value: fmtPct(sovereigntyProgress),
      barPct: clamp01(sovereigntyProgress) * 100,
      barColor: sovereigntyProgress > 0.8 ? C.green : C.gold,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: 10,
        padding: '10px 16px',
        background: C.panel,
        borderBottom: `1px solid ${C.brdLow}`,
      }}
    >
      {metrics.map(({ label, value, barPct, barColor }) => (
        <div key={label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontFamily: C.mono,
                fontSize: '9px',
                color: C.textDim,
                letterSpacing: '0.12em',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: C.mono,
                fontSize: FS.xs,
                fontWeight: 700,
                color: barColor,
              }}
            >
              {value}
            </span>
          </div>
          <div className="egs-bar-track">
            <div
              style={{
                height: '100%',
                width: `${barPct.toFixed(1)}%`,
                background: barColor,
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
});

// ── Shield pips ───────────────────────────────────────────────────────────────

const ShieldPips = memo(function ShieldPips({ count }: { count: number }) {
  const n = Math.max(0, Math.min(4, Math.floor(count)));
  if (n === 0) {
    return (
      <div
        style={{
          fontFamily: C.mono,
          fontSize: FS.xs,
          color: C.red,
          fontWeight: 700,
        }}
      >
        ⚠ ALL LAYERS BREACHED
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {['L1 LIQ', 'L2 CRED', 'L3 ASSET', 'L4 NET'].map((layer, i) => {
        const intact = i < n;
        return (
          <div
            key={layer}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              textAlign: 'center',
              border: `1px solid ${
                intact ? 'rgba(201,168,76,0.30)' : 'rgba(255,77,77,0.25)'
              }`,
              background: intact ? C.goldDim : 'rgba(30,0,0,0.30)',
              flex: 1,
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 2 }}>{intact ? '🛡' : '💀'}</div>
            <div
              style={{
                fontSize: 8,
                fontFamily: C.mono,
                fontWeight: 700,
                color: intact ? C.gold : C.red,
                letterSpacing: '0.06em',
              }}
            >
              {layer}
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ── Phase badge ───────────────────────────────────────────────────────────────

type WaveLike = { wave: number; phase: string; activeBotIds?: readonly string[] };

const EmpirePhaseBadge = memo(function EmpirePhaseBadge({
  wave,
  tick,
  totalTicks,
}: {
  wave: WaveLike;
  tick: number;
  totalTicks: number;
}) {
  const safeTotal = Math.max(1, totalTicks);
  const safeTick = Math.max(0, tick);
  const pct = clampPct((safeTick / safeTotal) * 100);
  const botCount = Array.isArray(wave.activeBotIds) ? wave.activeBotIds.length : 0;
  const phase = (wave.phase || 'PHASE').toUpperCase();

  const accent =
    phase.includes('BLEED') || phase.includes('CRIT') || phase.includes('DEATH')
      ? C.red
      : phase.includes('SURGE') || phase.includes('ATTACK')
        ? C.orange
        : phase.includes('SAFE') || phase.includes('STABLE') || phase.includes('RECOVER')
          ? C.green
          : C.gold;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 10,
        border: `1px solid ${accent}55`,
        background: `${accent}12`,
        minHeight: TOUCH_TARGET,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: C.display,
              fontSize: FS.lg,
              fontWeight: 900,
              color: accent,
              lineHeight: 1,
            }}
          >
            {phase}
          </span>
          <span
            style={{
              fontFamily: C.mono,
              fontSize: FS.xs,
              fontWeight: 800,
              color: accent,
              border: `1px solid ${accent}55`,
              background: `${accent}18`,
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: '0.10em',
            }}
          >
            WAVE {wave.wave}
          </span>
          <span
            style={{
              fontFamily: C.mono,
              fontSize: FS.xs,
              color: C.textDim,
              letterSpacing: '0.08em',
            }}
          >
            {botCount} BOT{botCount === 1 ? '' : 'S'}
          </span>
        </div>
        <div
          style={{
            height: 4,
            width: 220,
            background: C.brdLow,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: accent,
              transition: 'width 0.3s',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: C.mono, fontSize: '10px', color: C.textDim }}>
            t{safeTick}/{safeTotal}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: '10px', color: C.textDim }}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
});

// ── Isolation Tax widget ──────────────────────────────────────────────────────

const IsolationTaxWidget = memo(function IsolationTaxWidget({
  totalPaid,
  totalSpend,
  currentRate,
}: {
  totalPaid: number;
  totalSpend: number;
  currentRate: number;
}) {
  const rate = clamp01(currentRate);
  const tier =
    rate === 0
      ? 'NONE'
      : rate <= 0.01
        ? 'LOW'
        : rate <= 0.025
          ? 'MODERATE'
          : rate <= 0.04
            ? 'ELEVATED'
            : 'MAXIMUM';
  const colors: Record<string, string> = {
    NONE: C.green,
    LOW: C.gold,
    MODERATE: C.orange,
    ELEVATED: C.red,
    MAXIMUM: C.crimson,
  };
  const color = colors[tier] ?? C.gold;
  const pct = totalSpend > 0 ? ((totalPaid / totalSpend) * 100).toFixed(1) : '0.0';

  return (
    <div aria-label="Isolation tax">
      <div className="egs-label egs-label--sub">ISOLATION TAX</div>
      <div className="egs-stat">
        <span className="egs-stat-key">Total Paid</span>
        <span className="egs-stat-val" style={{ color }}>
          {fmt(totalPaid)}
        </span>
      </div>
      <div className="egs-stat">
        <span className="egs-stat-key">Burden Rate</span>
        <span className="egs-stat-val" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="egs-stat">
        <span className="egs-stat-key">Tier</span>
        <span
          className="egs-stat-val"
          style={{ color, fontSize: FS.xs, letterSpacing: '0.1em' }}
        >
          {tier}
        </span>
      </div>
    </div>
  );
});

// ── Journal feed ──────────────────────────────────────────────────────────────

interface JournalEntry {
  id: string;
  decisionTag: string;
  cardTitle: string;
  incomeDelta: number;
  tick: number;
}

const JournalFeed = memo(function JournalFeed({ entries }: { entries: JournalEntry[] }) {
  const recent = useMemo(() => {
    const len = entries.length;
    if (!len) return [];
    return entries.slice(Math.max(0, len - 6)).reverse();
  }, [entries]);

  if (!recent.length) {
    return (
      <div
        style={{
          color: C.textDim,
          fontFamily: C.mono,
          fontSize: FS.xs,
          padding: '12px 0',
        }}
      >
        No decisions recorded yet.
      </div>
    );
  }

  return (
    <div>
      {recent.map((e) => {
        const tag = isDecisionTagKey(e.decisionTag) ? e.decisionTag : null;
        const color = tag ? DECISION_TAG_COLORS[tag] : C.gold;
        const icon = tag ? DECISION_TAG_ICONS[tag] : '•';
        const label = tag ?? 'UNKNOWN';

        return (
          <div key={e.id} className="egs-journal-row">
            <span
              className="egs-decision-tag"
              style={{
                background: `${color}20`,
                color,
                border: `1px solid ${color}50`,
              }}
            >
              {icon} {label}
            </span>
            <span
              style={{
                color: C.textSub,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={e.cardTitle}
            >
              {e.cardTitle}
            </span>
            <span
              style={{
                color: e.incomeDelta >= 0 ? C.green : C.red,
                flexShrink: 0,
              }}
            >
              {e.incomeDelta >= 0 ? '+' : ''}
              {fmt(e.incomeDelta)}
            </span>
            <span style={{ color: C.textDim, flexShrink: 0, marginLeft: 4 }}>
              t{e.tick}
            </span>
          </div>
        );
      })}
    </div>
  );
});

// ── Main ──────────────────────────────────────────────────────────────────────

export const EmpireGameScreen = memo(function EmpireGameScreen({
  onCardCounterplay,
  onIgnoreCard,
}: EmpireGameScreenProps) {
  const { tick, runPhase } = useGameLoop();

  // ── Financial state from run store ────────────────────────────────────────
  const cash = useRunStore((s) => s.cashBalance ?? 0);
  const netWorth = useRunStore((s) => s.netWorth ?? 0);
  const income = useRunStore((s) => s.monthlyIncome ?? 0);
  const expenses = useRunStore((s) => s.monthlyExpenses ?? 0);

  // ── Time / lifecycle state ────────────────────────────────────────────────
  const totalTicks = useEngineStore((s) => {
    if (s.time.seasonTickBudget > 0) return s.time.seasonTickBudget;
    if (s.run.tickBudget > 0) return s.run.tickBudget;
    return 720;
  });
  const decisionWindows = useEngineStore((s) => s.time.activeDecisionWindows.length ?? 0);

  // ── Engine metrics ────────────────────────────────────────────────────────
  const pressureScore = useEngineStore((s) => normalizeScore(s.pressure.score));
  const tensionScore = useEngineStore((s) => normalizeScore(s.tension.score));
  const haterHeatRaw = useEngineStore((s) => s.battle.haterHeat ?? 0);
  const cascadeChains = useEngineStore((s) => s.cascade.activeNegativeChains.length ?? 0);
  const sovereigntyRaw = useEngineStore((s) => s.sovereignty.sovereigntyScore ?? 0);
  const shieldIntegrityPct = useEngineStore((s) => s.shield.overallIntegrityPct ?? 0);
  const injectedCards = useEngineStore((s) => s.battle.injectedCards ?? []) as InjectedCard[];
  const activeBotIds = useEngineStore((s) =>
    s.battle.activeBots.map((bot) => String(bot.profileId)),
  );

  // ── Derived store adapters ────────────────────────────────────────────────
  const haterHeatDisplay = useMemo(
    () => (haterHeatRaw > 1 ? haterHeatRaw : haterHeatRaw * 100),
    [haterHeatRaw],
  );
  const haterHeatScore = useMemo(() => normalizeHeat(haterHeatRaw), [haterHeatRaw]);
  const sovereigntyProgress = useMemo(
    () => normalizeScore(sovereigntyRaw),
    [sovereigntyRaw],
  );
  const cordScore = sovereigntyProgress;
  const shieldRatio = clamp01(shieldIntegrityPct / 100);
  const shields = useMemo(
    () => Math.max(0, Math.min(4, Math.ceil((shieldIntegrityPct || 0) / 25))),
    [shieldIntegrityPct],
  );

  const cashflow = income - expenses;

  const regime = useMemo<MarketRegime>(() => {
    return deriveMarketRegime(
      pressureScore,
      tensionScore,
      haterHeatScore,
      sovereigntyProgress,
      cashflow,
      cash,
    );
  }, [
    pressureScore,
    tensionScore,
    haterHeatScore,
    sovereigntyProgress,
    cashflow,
    cash,
  ]);

  const intelligence = useMemo<IntelligenceState>(() => {
    return buildDerivedIntelligenceState(
      pressureScore,
      tensionScore,
      haterHeatScore,
      sovereigntyProgress,
      shieldRatio,
      cashflow,
    );
  }, [
    pressureScore,
    tensionScore,
    haterHeatScore,
    sovereigntyProgress,
    shieldRatio,
    cashflow,
  ]);

  const [equityHistory, setEquityHistory] = useState<number[]>([]);
  useEffect(() => {
    setEquityHistory((prev) => {
      const value = Number.isFinite(netWorth) ? netWorth : 0;
      if (prev.length === 0) return [value];
      if (prev[prev.length - 1] === value) return prev;
      const maxPoints = Math.max(24, Math.min(totalTicks, 180));
      const next = [...prev, value];
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [netWorth, totalTicks]);

  const survivalTicks = useMemo(
    () => estimatedSurvivalTicks(cash, cashflow),
    [cash, cashflow],
  );

  // ── Empire bleed adapter (derived until a dedicated empire slice exists) ──
  const baseBleed = useMemo(
    () => computeBleedModeState({ cash, cashflow, tick }),
    [cash, cashflow, tick],
  );
  const [peakBleedSeverity, setPeakBleedSeverity] = useState<BleedSeverity>('NONE');
  const [bleedStartedAtTick, setBleedStartedAtTick] = useState<number | null>(null);

  useEffect(() => {
    if (!baseBleed.active) {
      setPeakBleedSeverity('NONE');
      setBleedStartedAtTick(null);
      return;
    }
    setBleedStartedAtTick((prev) => prev ?? tick);
    setPeakBleedSeverity((prev) => maxBleedSeverity(prev, baseBleed.severity));
  }, [baseBleed.active, baseBleed.severity, tick]);

  const empireBleed = useMemo(() => {
    if (!baseBleed.active) {
      return {
        ...baseBleed,
        peakSeverity: 'NONE' as BleedSeverity,
        enteredAtTick: null,
      };
    }
    return {
      ...baseBleed,
      peakSeverity: maxBleedSeverity(baseBleed.severity, peakBleedSeverity),
      enteredAtTick: bleedStartedAtTick ?? tick,
    };
  }, [baseBleed, peakBleedSeverity, bleedStartedAtTick, tick]);

  // ── Empire tax adapter (derived until a dedicated empire tax ledger exists) ─
  const taxDisplay = useMemo(() => {
    const totalPaid = Math.max(0, -cashflow);
    const totalSpend = Math.max(1, income);
    const currentRate = totalSpend > 0 ? totalPaid / totalSpend : 0;
    return { totalPaid, totalSpend, currentRate };
  }, [cashflow, income]);

  // ── Journal adapter ────────────────────────────────────────────────────────
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  useEffect(() => {
    setJournalEntries((prev) => {
      const existing = new Set(prev.map((entry) => entry.id));
      const additions = injectedCards
        .filter((card) => !existing.has(card.injectionId))
        .map<JournalEntry>((card) => ({
          id: card.injectionId,
          decisionTag: inferDecisionTagFromInjectionType(card.injectionType),
          cardTitle: card.cardName,
          incomeDelta: estimateInjectionIncomeDelta(card),
          tick,
        }));

      if (!additions.length) return prev;

      const next = [...prev, ...additions];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }, [injectedCards, tick]);

  const journalQuality = useMemo(() => {
    const resilience = shieldRatio;
    const order = 1 - pressureScore;
    const sovereignty = sovereigntyProgress;
    return clamp01((resilience + order + sovereignty) / 3);
  }, [shieldRatio, pressureScore, sovereigntyProgress]);

  const wave = useMemo(() => {
    return {
      ...getEmpireWave(tick, totalTicks),
      activeBotIds,
    };
  }, [tick, totalTicks, activeBotIds]);

  const hasInjected = injectedCards.length > 0;

  const handleCounterplay = useCallback(
    (cardId: string) => onCardCounterplay?.(cardId, 'COUNTER_SABOTAGE'),
    [onCardCounterplay],
  );

  const handleIgnore = useCallback(
    (cardId: string) => onIgnoreCard?.(cardId),
    [onIgnoreCard],
  );

  return (
    <>
      <style>{STYLES}</style>
      <div className="egs-root">
        <div className="egs-top-bar" role="banner">
          <EmpirePhaseBadge wave={wave} tick={tick} totalTicks={totalTicks} />

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: FS.xs,
                  color: C.textDim,
                  letterSpacing: '0.1em',
                }}
              >
                CORD
              </span>
              <span
                style={{
                  fontFamily: C.display,
                  fontSize: FS.lg,
                  fontWeight: 800,
                  color: cordScore >= 0.75 ? C.green : cordScore >= 0.5 ? C.gold : C.orange,
                }}
              >
                {(clamp01(cordScore) * 100).toFixed(0)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: FS.xs,
                  color: C.textDim,
                  letterSpacing: '0.1em',
                }}
              >
                TICK
              </span>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: FS.lg,
                  fontWeight: 700,
                  color: C.textPrime,
                }}
              >
                {tick}
                <span style={{ color: C.textDim, fontSize: FS.xs }}>/{totalTicks}</span>
              </span>
            </div>

            {runPhase === 'PAUSED' && (
              <div
                style={{
                  fontFamily: C.mono,
                  fontSize: FS.sm,
                  fontWeight: 700,
                  color: C.gold,
                  background: 'rgba(201,168,76,0.12)',
                  border: `1px solid ${C.goldBrd}`,
                  padding: '4px 10px',
                  borderRadius: 6,
                }}
              >
                ⏸ PAUSED
              </div>
            )}

            {decisionWindows > 0 && (
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
                }}
              >
                ⏳ CHOICES OPEN {decisionWindows}
              </div>
            )}
          </div>
        </div>

        <EngineStatusBar
          pressureScore={pressureScore}
          tensionScore={tensionScore}
          cascadeChains={cascadeChains}
          sovereigntyProgress={sovereigntyProgress}
          haterHeat={haterHeatDisplay}
        />

        {empireBleed.active && (
          <EmpireBleedBanner
            bleedState={empireBleed}
            cash={cash}
            cashflow={cashflow}
            survivalTicks={survivalTicks}
            comebackEligible={empireBleed.comebackEligible}
          />
        )}

        <div className="egs-grid" role="main">
          <div className="egs-main" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="egs-panel egs-panel--gold">
              <div className="egs-label">EQUITY CURVE</div>
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
                freezeTicks={0}
              />
            </div>

            <div className="egs-panel" aria-label="Financials">
              <div className="egs-label">FINANCIALS</div>
              <div className="egs-stat">
                <span className="egs-stat-key">Cash</span>
                <span className="egs-stat-val" style={{ color: cash < 0 ? C.red : C.textPrime }}>
                  {fmt(cash)}
                </span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Net Worth</span>
                <span className="egs-stat-val">{fmt(netWorth)}</span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Monthly Income</span>
                <span className="egs-stat-val" style={{ color: C.green }}>
                  {fmt(income)}
                </span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Monthly Expenses</span>
                <span className="egs-stat-val" style={{ color: C.red }}>
                  {fmt(expenses)}
                </span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Cashflow</span>
                <span
                  className="egs-stat-val"
                  style={{ color: cashflow >= 0 ? C.green : C.red }}
                >
                  {fmtCf(cashflow)}
                </span>
              </div>
              {survivalTicks !== Infinity && survivalTicks > 0 && (
                <div className="egs-stat">
                  <span className="egs-stat-key">Survival Est.</span>
                  <span className="egs-stat-val" style={{ color: C.orange }}>
                    {survivalTicks}t
                  </span>
                </div>
              )}
            </div>

            <div className="egs-panel" aria-label="Shield integrity">
              <div className="egs-label">SHIELD INTEGRITY</div>
              <ShieldPips count={shields} />
            </div>
          </div>

          <div className="egs-right" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              className={`egs-panel ${hasInjected ? 'egs-panel--urgent' : ''}`}
              aria-label="Hostile cards"
            >
              <div className="egs-label" style={{ color: hasInjected ? C.red : C.textDim }}>
                HOSTILE CARDS {hasInjected ? `(${injectedCards.length})` : ''}
              </div>

              {!hasInjected ? (
                <div
                  style={{
                    color: C.green,
                    fontFamily: C.mono,
                    fontSize: FS.xs,
                    padding: '8px 0',
                  }}
                >
                  ✓ No active hostile cards
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {injectedCards.map((card) => {
                    const isPersistent = card.timerTicks <= 0;
                    return (
                      <div
                        key={card.injectionId}
                        style={{
                          background: 'rgba(255,77,77,0.06)',
                          border: '1px solid rgba(255,77,77,0.22)',
                          borderRadius: 8,
                          padding: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: C.mono,
                            fontSize: FS.sm,
                            color: C.textPrime,
                            flex: 1,
                          }}
                        >
                          {card.cardName}
                        </span>
                        <span
                          style={{
                            fontFamily: C.mono,
                            fontSize: FS.xs,
                            color: isPersistent ? C.red : C.orange,
                          }}
                        >
                          {isPersistent ? '∞ PERSISTENT' : `${Math.max(0, card.ticksRemaining)}t left`}
                        </span>

                        {onCardCounterplay && (
                          <button
                            type="button"
                            className="egs-btn"
                            style={{ minHeight: 36, padding: '0 12px', fontSize: FS.xs }}
                            onClick={() => handleCounterplay(card.injectionId)}
                          >
                            COUNTER
                          </button>
                        )}

                        {onIgnoreCard && !isPersistent && (
                          <button
                            type="button"
                            className="egs-btn egs-btn--danger"
                            style={{ minHeight: 36, padding: '0 12px', fontSize: FS.xs }}
                            onClick={() => handleIgnore(card.injectionId)}
                          >
                            IGNORE
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="egs-panel">
              <IsolationTaxWidget
                totalPaid={taxDisplay.totalPaid}
                totalSpend={taxDisplay.totalSpend}
                currentRate={taxDisplay.currentRate}
              />
            </div>

            <div className="egs-panel" aria-label="Decision log">
              <div className="egs-label">DECISION LOG</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>
                  Quality
                </span>
                <span
                  style={{
                    fontFamily: C.mono,
                    fontSize: FS.sm,
                    fontWeight: 700,
                    color:
                      journalQuality >= 0.75
                        ? C.green
                        : journalQuality >= 0.5
                          ? C.gold
                          : C.orange,
                  }}
                >
                  {(clamp01(journalQuality) * 100).toFixed(0)}%
                </span>
              </div>
              <JournalFeed entries={journalEntries} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export default EmpireGameScreen;