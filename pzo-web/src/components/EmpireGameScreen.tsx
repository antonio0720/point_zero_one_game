/**
 * EmpireGameScreen.tsx — GO ALONE / EMPIRE mode game screen
 * WIRED: useEngineStore + useRunStore. All engine metrics sourced from store.
 * Displays: pressure score, shield integrity, hater heat, tension,
 *           cascade chains, sovereignty progress, CORD, bleed, isolation tax.
 *
 * FILE LOCATION: pzo-web/src/components/EmpireGameScreen.tsx
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import React, { memo, useCallback, useMemo } from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { EmpireBleedBanner } from './EmpireBleedBanner';
import { C, FS, BP, TOUCH_TARGET, FONT_IMPORT, KEYFRAMES } from '../game/modes/shared/designTokens';
import { DECISION_TAG_COLORS, DECISION_TAG_ICONS } from '../game/modes/empire/pressureJournalEngine';
import { getEmpireWave } from '../game/modes/empire/empireConfig';
import { estimatedSurvivalTicks } from '../game/modes/empire/bleedMode';

// ── Store hooks ───────────────────────────────────────────────────────────────
import { useEngineStore } from '../store/engineStore';
import { useRunStore } from '../store/runStore';
import { useGameLoop } from '../hooks/useGameLoop';

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
  if (v >= 1_000)     return `${neg ? '-' : ''}$${(v / 1e3).toFixed(1)}K`;
  return `${neg ? '-' : ''}$${Math.round(v).toLocaleString()}`;
}

function fmtCf(n: number): string {
  return `${n >= 0 ? '+' : ''}${fmt(n)}/mo`;
}

function fmtPct(n: number): string {
  return `${clampPct(n * 100)}%`;
}

// ── Decision tag type guard ───────────────────────────────────────────────────

type DecisionTagKey = keyof typeof DECISION_TAG_COLORS;

function isDecisionTagKey(tag: string): tag is DecisionTagKey {
  return Object.prototype.hasOwnProperty.call(DECISION_TAG_COLORS, tag) &&
         Object.prototype.hasOwnProperty.call(DECISION_TAG_ICONS, tag);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EmpireGameScreenProps {
  /** Called when player initiates counterplay on a hostile card. */
  onCardCounterplay?: (cardId: string, actionId: string) => void;
  /** Called when player chooses to ignore a non-persistent hostile card. */
  onIgnoreCard?:      (cardId: string) => void;
}

// ── Engine status bar ─────────────────────────────────────────────────────────

const EngineStatusBar = memo(function EngineStatusBar({
  pressureScore,
  tensionScore,
  cascadeChains,
  sovereigntyProgress,
  haterHeat,
}: {
  pressureScore:       number;
  tensionScore:        number;
  cascadeChains:       number;
  sovereigntyProgress: number;
  haterHeat:           number;
}) {
  const metrics = [
    {
      label:    'PRESSURE',
      value:    fmtPct(pressureScore),
      barPct:   clamp01(pressureScore) * 100,
      barColor: pressureScore > 0.75 ? C.red : pressureScore > 0.5 ? C.orange : C.gold,
    },
    {
      label:    'TENSION',
      value:    fmtPct(tensionScore),
      barPct:   clamp01(tensionScore) * 100,
      barColor: tensionScore > 0.75 ? C.red : tensionScore > 0.5 ? C.orange : C.gold,
    },
    {
      label:    'HATER HEAT',
      value:    `${Math.round(haterHeat)}`,
      barPct:   Math.min(100, haterHeat),
      barColor: haterHeat > 75 ? C.red : haterHeat > 50 ? C.orange : C.gold,
    },
    {
      label:    'CASCADE',
      value:    `${cascadeChains}x`,
      barPct:   Math.min(100, cascadeChains * 20),
      barColor: cascadeChains >= 4 ? C.red : cascadeChains >= 2 ? C.orange : C.gold,
    },
    {
      label:    'SOVEREIGNTY',
      value:    fmtPct(sovereigntyProgress),
      barPct:   clamp01(sovereigntyProgress) * 100,
      barColor: sovereigntyProgress > 0.8 ? C.green : C.gold,
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
      gap: 10,
      padding: '10px 16px',
      background: C.panel,
      borderBottom: `1px solid ${C.brdLow}`,
    }}>
      {metrics.map(({ label, value, barPct, barColor }) => (
        <div key={label}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 3,
          }}>
            <span style={{ fontFamily: C.mono, fontSize: '9px', color: C.textDim, letterSpacing: '0.12em' }}>
              {label}
            </span>
            <span style={{ fontFamily: C.mono, fontSize: FS.xs, fontWeight: 700, color: barColor }}>
              {value}
            </span>
          </div>
          <div className="egs-bar-track">
            <div style={{
              height: '100%',
              width: `${barPct.toFixed(1)}%`,
              background: barColor,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
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
      <div style={{
        fontFamily: C.mono, fontSize: FS.xs, color: C.red, fontWeight: 700,
      }}>
        ⚠ ALL LAYERS BREACHED
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {['L1 LIQ', 'L2 CRED', 'L3 ASSET', 'L4 NET'].map((layer, i) => {
        const intact = i < n;
        return (
          <div key={layer} style={{
            padding: '6px 10px', borderRadius: 6, textAlign: 'center',
            border: `1px solid ${intact ? 'rgba(201,168,76,0.30)' : 'rgba(255,77,77,0.25)'}`,
            background: intact ? C.goldDim : 'rgba(30,0,0,0.30)',
            flex: 1,
          }}>
            <div style={{ fontSize: 14, marginBottom: 2 }}>{intact ? '🛡' : '💀'}</div>
            <div style={{
              fontSize: 8, fontFamily: C.mono, fontWeight: 700,
              color: intact ? C.gold : C.red, letterSpacing: '0.06em',
            }}>
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
  wave, tick, totalTicks,
}: { wave: WaveLike; tick: number; totalTicks: number }) {
  const safeTotal = Math.max(1, totalTicks);
  const safeTick  = Math.max(0, tick);
  const pct       = clampPct((safeTick / safeTotal) * 100);
  const botCount  = Array.isArray(wave.activeBotIds) ? wave.activeBotIds.length : 0;
  const phase     = (wave.phase || 'PHASE').toUpperCase();

  const accent =
    phase.includes('BLEED') || phase.includes('CRIT') || phase.includes('DEATH') ? C.red :
    phase.includes('SURGE') || phase.includes('ATTACK') ? C.orange :
    phase.includes('SAFE') || phase.includes('STABLE') || phase.includes('RECOVER') ? C.green :
    C.gold;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 10,
      border: `1px solid ${accent}55`, background: `${accent}12`,
      minHeight: TOUCH_TARGET,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: C.display, fontSize: FS.lg, fontWeight: 900, color: accent, lineHeight: 1 }}>
            {phase}
          </span>
          <span style={{
            fontFamily: C.mono, fontSize: FS.xs, fontWeight: 800, color: accent,
            border: `1px solid ${accent}55`, background: `${accent}18`,
            padding: '2px 8px', borderRadius: 6, letterSpacing: '0.10em',
          }}>
            WAVE {wave.wave}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.08em' }}>
            {botCount} BOT{botCount === 1 ? '' : 'S'}
          </span>
        </div>
        <div style={{ height: 4, width: 220, background: C.brdLow, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: accent, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: C.mono, fontSize: '10px', color: C.textDim }}>t{safeTick}/{safeTotal}</span>
          <span style={{ fontFamily: C.mono, fontSize: '10px', color: C.textDim }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
});

// ── Isolation Tax widget ──────────────────────────────────────────────────────

const IsolationTaxWidget = memo(function IsolationTaxWidget({
  totalPaid, totalSpend, currentRate,
}: { totalPaid: number; totalSpend: number; currentRate: number }) {
  const rate = clamp01(currentRate);
  const tier = rate === 0 ? 'NONE' : rate <= 0.01 ? 'LOW' : rate <= 0.025 ? 'MODERATE' : rate <= 0.04 ? 'ELEVATED' : 'MAXIMUM';
  const colors: Record<string, string> = { NONE: C.green, LOW: C.gold, MODERATE: C.orange, ELEVATED: C.red, MAXIMUM: C.crimson };
  const color = colors[tier] ?? C.gold;
  const pct   = totalSpend > 0 ? ((totalPaid / totalSpend) * 100).toFixed(1) : '0.0';

  return (
    <div aria-label="Isolation tax">
      <div className="egs-label egs-label--sub">ISOLATION TAX</div>
      <div className="egs-stat">
        <span className="egs-stat-key">Total Paid</span>
        <span className="egs-stat-val" style={{ color }}>{fmt(totalPaid)}</span>
      </div>
      <div className="egs-stat">
        <span className="egs-stat-key">Burden Rate</span>
        <span className="egs-stat-val" style={{ color }}>{pct}%</span>
      </div>
      <div className="egs-stat">
        <span className="egs-stat-key">Tier</span>
        <span className="egs-stat-val" style={{ color, fontSize: FS.xs, letterSpacing: '0.1em' }}>{tier}</span>
      </div>
    </div>
  );
});

// ── Journal feed ──────────────────────────────────────────────────────────────

interface JournalEntry { id: string; decisionTag: string; cardTitle: string; incomeDelta: number; tick: number; }

const JournalFeed = memo(function JournalFeed({ entries }: { entries: JournalEntry[] }) {
  const recent = useMemo(() => {
    const len = entries.length;
    if (!len) return [];
    return entries.slice(Math.max(0, len - 6)).reverse();
  }, [entries]);

  if (!recent.length) {
    return <div style={{ color: C.textDim, fontFamily: C.mono, fontSize: FS.xs, padding: '12px 0' }}>No decisions recorded yet.</div>;
  }

  return (
    <div>
      {recent.map((e) => {
        const tag   = isDecisionTagKey(e.decisionTag) ? e.decisionTag : null;
        const color = tag ? DECISION_TAG_COLORS[tag] : C.gold;
        const icon  = tag ? DECISION_TAG_ICONS[tag]  : '•';
        const label = tag ?? 'UNKNOWN';
        return (
          <div key={e.id} className="egs-journal-row">
            <span className="egs-decision-tag"
              style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}>
              {icon} {label}
            </span>
            <span style={{ color: C.textSub, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={e.cardTitle}>{e.cardTitle}</span>
            <span style={{ color: e.incomeDelta >= 0 ? C.green : C.red, flexShrink: 0 }}>
              {e.incomeDelta >= 0 ? '+' : ''}{fmt(e.incomeDelta)}
            </span>
            <span style={{ color: C.textDim, flexShrink: 0, marginLeft: 4 }}>t{e.tick}</span>
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

  // ── Game loop (starts/stops automatically with runPhase) ──────────────────
  const { tick, runPhase } = useGameLoop();

  // ── Financial state from run store ────────────────────────────────────────
  const cash           = useRunStore(s => s.cash          ?? 0);
  const netWorth       = useRunStore(s => s.netWorth      ?? 0);
  const income         = useRunStore(s => s.income        ?? 0);
  const expenses       = useRunStore(s => s.expenses      ?? 0);
  const equityHistory  = useRunStore(s => s.equityHistory ?? []);
  const regime         = useRunStore(s => s.regime        ?? 'NEUTRAL') as MarketRegime;
  const intelligence   = useRunStore(s => s.intelligence  ?? { level: 0 }) as IntelligenceState;

  // ── Time engine ───────────────────────────────────────────────────────────
  const totalTicks  = useEngineStore(s => s.time.totalTicks  ?? 720);
  const freezeTicks = useEngineStore(s => s.time.freezeTicks ?? 0);

  // ── Pressure engine ───────────────────────────────────────────────────────
  const pressureScore = useEngineStore(s => s.pressure.score ?? 0);

  // ── Tension engine ────────────────────────────────────────────────────────
  const tensionScore = useEngineStore(s => s.tension.score ?? 0);

  // ── Shield engine ─────────────────────────────────────────────────────────
  const shields = useEngineStore(s => s.shield.integrity ?? 4);

  // ── Battle engine ─────────────────────────────────────────────────────────
  const haterHeat = useEngineStore(s => s.battle.haterHeat ?? 0);

  // ── Cascade engine ────────────────────────────────────────────────────────
  const cascadeChains = useEngineStore(s => s.cascade.chains ?? 0);

  // ── Sovereignty engine ────────────────────────────────────────────────────
  const sovereigntyProgress = useEngineStore(s => s.sovereignty.progress ?? 0);
  const cordScore           = useEngineStore(s => s.sovereignty.cordScore ?? 0);

  // ── Empire-mode state ─────────────────────────────────────────────────────
  const empireBleed           = useEngineStore(s => s.empire?.bleed           ?? { active: false });
  const totalIsolationTaxPaid = useEngineStore(s => s.empire?.totalIsolationTaxPaid ?? 0);
  const totalSpend            = useEngineStore(s => s.empire?.totalSpend      ?? 0);
  const journalEntries        = useEngineStore(s => s.empire?.journal?.entries ?? []) as JournalEntry[];
  const journalQuality        = useEngineStore(s => s.empire?.journal?.aggregateQuality ?? 0);
  const injectedCards         = useEngineStore(s => s.empire?.injectedCards   ?? []) as Array<{
    id: string; cardName: string; ticksLeft: number; isPersistent: boolean;
  }>;

  // ── Derived ───────────────────────────────────────────────────────────────
  const cashflow    = income - expenses;
  const wave        = useMemo(() => getEmpireWave(tick), [tick]) as unknown as WaveLike & { wave: number };
  const survivalTicks = useMemo(() => estimatedSurvivalTicks(cash, cashflow), [cash, cashflow]);
  const taxDisplay  = useMemo(() => {
    const currentRate = totalSpend > 0 ? totalIsolationTaxPaid / totalSpend : 0;
    return { totalPaid: totalIsolationTaxPaid, totalSpend, currentRate };
  }, [totalIsolationTaxPaid, totalSpend]);

  const cordColor   = cordScore >= 0.75 ? C.green : cordScore >= 0.5 ? C.gold : C.orange;
  const journalColor = journalQuality >= 0.75 ? C.green : journalQuality >= 0.5 ? C.gold : C.orange;
  const hasInjected = injectedCards.length > 0;

  const handleCounterplay = useCallback((cardId: string) => onCardCounterplay?.(cardId, 'COUNTER_SABOTAGE'), [onCardCounterplay]);
  const handleIgnore      = useCallback((cardId: string) => onIgnoreCard?.(cardId), [onIgnoreCard]);

  return (
    <>
      <style>{STYLES}</style>
      <div className="egs-root">

        {/* ── Top bar ── */}
        <div className="egs-top-bar" role="banner">
          <EmpirePhaseBadge wave={wave} tick={tick} totalTicks={totalTicks} />

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>CORD</span>
              <span style={{ fontFamily: C.display, fontSize: FS.lg, fontWeight: 800, color: cordColor }}>
                {(clamp01(cordScore) * 100).toFixed(0)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>TICK</span>
              <span style={{ fontFamily: C.mono, fontSize: FS.lg, fontWeight: 700, color: C.textPrime }}>
                {tick}<span style={{ color: C.textDim, fontSize: FS.xs }}>/{totalTicks}</span>
              </span>
            </div>

            {runPhase === 'PAUSED' && (
              <div style={{
                fontFamily: C.mono, fontSize: FS.sm, fontWeight: 700, color: C.gold,
                background: 'rgba(201,168,76,0.12)', border: `1px solid ${C.goldBrd}`,
                padding: '4px 10px', borderRadius: 6,
              }}>
                ⏸ PAUSED
              </div>
            )}

            {freezeTicks > 0 && (
              <div role="status" aria-live="polite" style={{
                fontFamily: C.mono, fontSize: FS.sm, fontWeight: 700, color: C.blue,
                background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.25)',
                padding: '4px 10px', borderRadius: 6, animation: 'pulseBadge 1.5s infinite',
              }}>
                🧊 FROZEN {freezeTicks}t
              </div>
            )}
          </div>
        </div>

        {/* ── Engine status bar ── */}
        <EngineStatusBar
          pressureScore={pressureScore}
          tensionScore={tensionScore}
          cascadeChains={cascadeChains}
          sovereigntyProgress={sovereigntyProgress}
          haterHeat={haterHeat}
        />

        {/* ── Bleed banner ── */}
        {empireBleed?.active && (
          <EmpireBleedBanner
            bleedState={empireBleed as any}
            cash={cash}
            cashflow={cashflow}
            survivalTicks={survivalTicks}
          />
        )}

        {/* ── Main grid ── */}
        <div className="egs-grid" role="main">

          {/* Left column */}
          <div className="egs-main" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="egs-panel egs-panel--gold">
              <div className="egs-label">EQUITY CURVE</div>
              <GameBoard
                equityHistory={equityHistory}
                cash={cash} netWorth={netWorth}
                income={income} expenses={expenses}
                regime={regime} intelligence={intelligence}
                tick={tick} totalTicks={totalTicks}
                freezeTicks={freezeTicks}
              />
            </div>

            <div className="egs-panel" aria-label="Financials">
              <div className="egs-label">FINANCIALS</div>
              <div className="egs-stat">
                <span className="egs-stat-key">Cash</span>
                <span className="egs-stat-val" style={{ color: cash < 0 ? C.red : C.textPrime }}>{fmt(cash)}</span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Net Worth</span>
                <span className="egs-stat-val">{fmt(netWorth)}</span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Monthly Income</span>
                <span className="egs-stat-val" style={{ color: C.green }}>{fmt(income)}</span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Monthly Expenses</span>
                <span className="egs-stat-val" style={{ color: C.red }}>{fmt(expenses)}</span>
              </div>
              <div className="egs-stat">
                <span className="egs-stat-key">Cashflow</span>
                <span className="egs-stat-val" style={{ color: cashflow >= 0 ? C.green : C.red }}>{fmtCf(cashflow)}</span>
              </div>
              {survivalTicks !== Infinity && survivalTicks > 0 && (
                <div className="egs-stat">
                  <span className="egs-stat-key">Survival Est.</span>
                  <span className="egs-stat-val" style={{ color: C.orange }}>{survivalTicks}t</span>
                </div>
              )}
            </div>

            <div className="egs-panel" aria-label="Shield integrity">
              <div className="egs-label">SHIELD INTEGRITY</div>
              <ShieldPips count={shields} />
            </div>
          </div>

          {/* Right column */}
          <div className="egs-right" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Hostile cards */}
            <div className={`egs-panel ${hasInjected ? 'egs-panel--urgent' : ''}`} aria-label="Hostile cards">
              <div className="egs-label" style={{ color: hasInjected ? C.red : C.textDim }}>
                HOSTILE CARDS {hasInjected ? `(${injectedCards.length})` : ''}
              </div>
              {!hasInjected ? (
                <div style={{ color: C.green, fontFamily: C.mono, fontSize: FS.xs, padding: '8px 0' }}>
                  ✓ No active hostile cards
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {injectedCards.map((card) => (
                    <div key={card.id} style={{
                      background: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.22)',
                      borderRadius: 8, padding: 10,
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontFamily: C.mono, fontSize: FS.sm, color: C.textPrime, flex: 1 }}>{card.cardName}</span>
                      <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: card.isPersistent ? C.red : C.orange }}>
                        {card.isPersistent ? '∞ PERSISTENT' : `${Math.max(0, card.ticksLeft)}t left`}
                      </span>
                      {onCardCounterplay && (
                        <button type="button" className="egs-btn"
                          style={{ minHeight: 36, padding: '0 12px', fontSize: FS.xs }}
                          onClick={() => handleCounterplay(card.id)}>
                          COUNTER
                        </button>
                      )}
                      {onIgnoreCard && !card.isPersistent && (
                        <button type="button" className="egs-btn egs-btn--danger"
                          style={{ minHeight: 36, padding: '0 12px', fontSize: FS.xs }}
                          onClick={() => handleIgnore(card.id)}>
                          IGNORE
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Isolation tax */}
            <div className="egs-panel">
              <IsolationTaxWidget
                totalPaid={taxDisplay.totalPaid}
                totalSpend={taxDisplay.totalSpend}
                currentRate={taxDisplay.currentRate}
              />
            </div>

            {/* Decision log */}
            <div className="egs-panel" aria-label="Decision log">
              <div className="egs-label">DECISION LOG</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>Quality</span>
                <span style={{ fontFamily: C.mono, fontSize: FS.sm, fontWeight: 700, color: journalColor }}>
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