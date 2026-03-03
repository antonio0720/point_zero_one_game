// FILE: src/components/EmpireGameScreen.tsx
/**
 * EmpireGameScreen.tsx — GO ALONE mode game screen
 * Theme: Sovereign Gold. 5-wave adversarial bot escalation. Bleed mode. Isolation tax.
 *
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

// ── Local “runtime state” shape (structural typing) ───────────────────────────
// Avoids import/type drift if you moved engine files around.
export type EmpireRuntimeState = {
  cordScore: number;
  bleed: { active: boolean } & Record<string, unknown>;
  totalIsolationTaxPaid: number;
  totalSpend: number;
  journal: {
    aggregateQuality: number;
    entries: Array<{
      id: string;
      decisionTag: string;
      cardTitle: string;
      incomeDelta: number;
      tick: number;
    }>;
  };
};

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
  .egs-grid .egs-main { grid-column: 1; }
  .egs-grid .egs-right { grid-column: 2 / 4; }
}

.egs-panel {
  background: ${C.panel};
  border-radius: 12px;
  border: 1px solid ${C.brdLow};
  padding: 14px;
  transition: border-color 0.2s;
}

.egs-panel--gold {
  border-color: ${C.goldBrd};
  box-shadow: 0 0 20px rgba(201,168,76,0.06) inset;
}

.egs-panel--urgent {
  border-color: rgba(255,77,77,0.30);
  box-shadow: 0 0 24px rgba(255,77,77,0.08) inset;
}

.egs-label {
  font-family: ${C.mono};
  font-size: ${FS.xs};
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${C.gold};
  margin-bottom: 10px;
}

.egs-label--sub { color: ${C.textDim}; }

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

.egs-btn--danger {
  border-color: rgba(255,77,77,0.28);
  background: rgba(255,77,77,0.10);
  color: ${C.red};
}

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
  .egs-panel { padding: 10px; }
  .egs-label { font-size: 9px; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

// ── Utilities ────────────────────────────────────────────────────────────────

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
  const sign = n >= 0 ? '+' : '';
  return `${sign}${fmt(n)}/mo`;
}

// ── ✅ DecisionTag key guard (fixes TS7053) ────────────────────────────────────

type DecisionTagKey = keyof typeof DECISION_TAG_COLORS;

const hasOwn = (obj: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

function isDecisionTagKey(tag: string): tag is DecisionTagKey {
  return hasOwn(DECISION_TAG_COLORS, tag) && hasOwn(DECISION_TAG_ICONS, tag);
}

// ── Local Phase Badge (no external dependency) ────────────────────────────────

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
  const safeTotal = Math.max(1, Math.floor(Number.isFinite(totalTicks) ? totalTicks : 1));
  const safeTick = Math.max(0, Math.floor(Number.isFinite(tick) ? tick : 0));

  const progressPct = clampPct((safeTick / safeTotal) * 100);
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
      aria-label={`Phase ${phase}, wave ${wave.wave}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: C.display, fontSize: FS.lg, fontWeight: 900, color: accent, lineHeight: 1 }}>
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
          <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.08em' }}>
            {botCount} BOT{botCount === 1 ? '' : 'S'}
          </span>
        </div>

        <div style={{ height: 4, width: 220, background: C.brdLow, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: accent, transition: 'width 0.3s' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontFamily: C.mono, fontSize: '10px', color: C.textDim, letterSpacing: '0.08em' }}>
            t{safeTick}/{safeTotal}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: '10px', color: C.textDim, letterSpacing: '0.08em' }}>
            {progressPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
});

// ── Local Shields UI (fixes ShieldIcons prop mismatch) ────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InjectedCardDisplay {
  id: string;
  cardName: string;
  ticksLeft: number;
  isPersistent: boolean;
}

export interface EmpireGameScreenProps {
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

  empireState: EmpireRuntimeState;
  injectedCards: InjectedCardDisplay[];

  onCardCounterplay?: (cardId: string, actionId: string) => void;
  onIgnoreCard?: (cardId: string) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
        <span className="egs-stat-val" style={{ color, fontSize: FS.xs, letterSpacing: '0.1em' }}>
          {tier}
        </span>
      </div>
    </div>
  );
});

// ✅ JournalFeed (fixed TS7053)
const JournalFeed = memo(function JournalFeed({
  entries,
}: {
  entries: EmpireRuntimeState['journal']['entries'];
}) {
  const recent = useMemo(() => {
    const len = entries.length;
    if (len === 0) return [];
    const start = Math.max(0, len - 6);
    const slice = entries.slice(start, len);
    return slice.reverse();
  }, [entries]);

  if (recent.length === 0) {
    return (
      <div style={{ color: C.textDim, fontFamily: C.mono, fontSize: FS.xs, padding: '12px 0' }}>
        No decisions recorded yet.
      </div>
    );
  }

  return (
    <div aria-label="Decision log recent entries">
      {recent.map((e) => {
        const tag = isDecisionTagKey(e.decisionTag) ? e.decisionTag : null;

        const color = tag ? DECISION_TAG_COLORS[tag] : C.gold;
        const icon = tag ? DECISION_TAG_ICONS[tag] : '•';
        const label = tag ?? 'UNKNOWN';

        return (
          <div key={e.id} className="egs-journal-row">
            <span
              className="egs-decision-tag"
              style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}
              aria-label={`Decision tag ${label}`}
              title={label}
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

            <span style={{ color: e.incomeDelta >= 0 ? C.green : C.red, flexShrink: 0 }}>
              {e.incomeDelta >= 0 ? '+' : ''}
              {fmt(e.incomeDelta)}
            </span>

            <span style={{ color: C.textDim, flexShrink: 0, marginLeft: 4 }}>t{e.tick}</span>
          </div>
        );
      })}
    </div>
  );
});

// ── Main ──────────────────────────────────────────────────────────────────────

export const EmpireGameScreen = memo(function EmpireGameScreen(props: EmpireGameScreenProps) {
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
    empireState,
    injectedCards,
    onCardCounterplay,
    onIgnoreCard,
  } = props;

  const cashflow = income - expenses;

  const wave = useMemo(() => getEmpireWave(tick), [tick]) as unknown as WaveLike & { wave: number };
  const survivalTicks = useMemo(() => estimatedSurvivalTicks(cash, cashflow), [cash, cashflow]);

  const hasInjected = injectedCards.length > 0;

  const taxDisplay = useMemo(() => {
    const totalPaid = empireState.totalIsolationTaxPaid;
    const totalSpend = empireState.totalSpend;
    const currentRate = totalSpend > 0 ? totalPaid / totalSpend : 0;
    return { totalPaid, totalSpend, currentRate };
  }, [empireState.totalIsolationTaxPaid, empireState.totalSpend]);

  const handleCounterplay = useCallback(
    (cardId: string) => onCardCounterplay?.(cardId, 'COUNTER_SABOTAGE'),
    [onCardCounterplay],
  );

  const handleIgnore = useCallback((cardId: string) => onIgnoreCard?.(cardId), [onIgnoreCard]);

  const cordColor =
    empireState.cordScore >= 0.75 ? C.green : empireState.cordScore >= 0.5 ? C.gold : C.orange;

  const journalQualityColor =
    empireState.journal.aggregateQuality >= 0.75
      ? C.green
      : empireState.journal.aggregateQuality >= 0.5
        ? C.gold
        : C.orange;

  return (
    <>
      <style>{STYLES}</style>

      <div className="egs-root">
        {/* Top bar */}
        <div className="egs-top-bar" role="banner">
          <EmpirePhaseBadge wave={wave} tick={tick} totalTicks={totalTicks} />

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>
                CORD
              </span>
              <span style={{ fontFamily: C.display, fontSize: FS.lg, fontWeight: 800, color: cordColor }}>
                {(clamp01(empireState.cordScore) * 100).toFixed(0)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim, letterSpacing: '0.1em' }}>
                TICK
              </span>
              <span style={{ fontFamily: C.mono, fontSize: FS.lg, fontWeight: 700, color: C.textPrime }}>
                {tick}
                <span style={{ color: C.textDim, fontSize: FS.xs }}>/{totalTicks}</span>
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
                🧊 FROZEN {freezeTicks}t
              </div>
            )}
          </div>
        </div>

        {/* Bleed banner */}
        {empireState.bleed?.active && (
          <EmpireBleedBanner
            bleedState={empireState.bleed as any}
            cash={cash}
            cashflow={cashflow}
            survivalTicks={survivalTicks}
          />
        )}

        {/* Main grid */}
        <div className="egs-grid" role="main">
          {/* Left */}
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
                freezeTicks={freezeTicks}
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
                <span className="egs-stat-val" style={{ color: cashflow >= 0 ? C.green : C.red }}>
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

            <div className="egs-panel" aria-label="Shields">
              <div className="egs-label">SHIELDS</div>
              <ShieldPips count={shields} />
            </div>
          </div>

          {/* Right */}
          <div className="egs-right" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className={`egs-panel ${hasInjected ? 'egs-panel--urgent' : ''}`} aria-label="Hostile cards panel">
              <div className="egs-label" style={{ color: hasInjected ? C.red : C.textDim }}>
                HOSTILE CARDS {hasInjected ? `(${injectedCards.length})` : ''}
              </div>

              {injectedCards.length === 0 ? (
                <div style={{ color: C.green, fontFamily: C.mono, fontSize: FS.xs, padding: '8px 0' }}>
                  ✓ No active hostile cards
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {injectedCards.map((card) => (
                    <div
                      key={card.id}
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
                      <span style={{ fontFamily: C.mono, fontSize: FS.sm, color: C.textPrime, flex: 1 }}>
                        {card.cardName}
                      </span>

                      <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: card.isPersistent ? C.red : C.orange }}>
                        {card.isPersistent ? '∞ PERSISTENT' : `${Math.max(0, card.ticksLeft)}t left`}
                      </span>

                      {onCardCounterplay && (
                        <button
                          type="button"
                          className="egs-btn"
                          style={{ minHeight: 36, padding: '0 12px', fontSize: FS.xs }}
                          onClick={() => handleCounterplay(card.id)}
                        >
                          COUNTER
                        </button>
                      )}

                      {onIgnoreCard && !card.isPersistent && (
                        <button
                          type="button"
                          className="egs-btn egs-btn--danger"
                          style={{ minHeight: 36, padding: '0 12px', fontSize: FS.xs }}
                          onClick={() => handleIgnore(card.id)}
                        >
                          IGNORE
                        </button>
                      )}
                    </div>
                  ))}
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
                <span style={{ fontFamily: C.mono, fontSize: FS.xs, color: C.textDim }}>Quality</span>
                <span style={{ fontFamily: C.mono, fontSize: FS.sm, fontWeight: 700, color: journalQualityColor }}>
                  {(clamp01(empireState.journal.aggregateQuality) * 100).toFixed(0)}%
                </span>
              </div>

              <JournalFeed entries={empireState.journal.entries} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export default EmpireGameScreen;