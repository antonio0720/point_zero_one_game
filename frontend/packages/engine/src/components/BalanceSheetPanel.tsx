/**
 * BalanceSheetPanel.tsx — PZO Engine-Integrated Truth Layer
 * Engine: pressure/types · shield/types · cascade/types
 * Scale: 20M concurrent · Mobile-first · Syne + IBM Plex Mono
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import React, { memo, useMemo } from 'react';
import type { BalanceSheet, ObligationRecord, PortfolioRecord, MitigationRecord } from '../types/game';
import { liquidityRatio, computeConcentrationScore } from '../types/game';
import type { PressureTier } from '../pressure/types';
import { PRESSURE_TIER_CONFIGS } from '../pressure/types';

// ─── Design Tokens (matches LeagueUI) ────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0C0C1E',
  cardHi:  '#131328',
  cardEl:  '#17172E',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.18)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  greenD:  'rgba(34,221,136,0.12)',
  red:     '#FF4D4D',
  redD:    'rgba(255,77,77,0.12)',
  orange:  '#FF8C00',
  orangeD: 'rgba(255,140,0,0.10)',
  yellow:  '#FFD700',
  yellowD: 'rgba(255,215,0,0.10)',
  indigo:  '#818CF8',
  indigoD: 'rgba(129,140,248,0.12)',
  teal:    '#22D3EE',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', 'Courier New', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');*{box-sizing:border-box;}`;

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000)     return `${s}$${(v / 1e3).toFixed(1)}K`;
  return `${s}$${v.toLocaleString()}`;
}

function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

// ─── Pressure-tier → color mapping (engine-native) ───────────────────────────
function pressureColor(tier: PressureTier | undefined): string {
  if (!tier) return T.green;
  return PRESSURE_TIER_CONFIGS[tier]?.colorHex ?? T.green;
}

// ─── Metric State ─────────────────────────────────────────────────────────────
type MetricState = 'SAFE' | 'WARN' | 'DANGER';

function liqState(r: number): MetricState {
  return r > 0.5 ? 'SAFE' : r > 0.25 ? 'WARN' : 'DANGER';
}
function covState(r: number): MetricState {
  return r >= 1.5 ? 'SAFE' : r >= 1.0 ? 'WARN' : 'DANGER';
}
function hhiState(h: number): MetricState {
  return h < 0.35 ? 'SAFE' : h < 0.6 ? 'WARN' : 'DANGER';
}

const STATE_COLORS: Record<MetricState, { fg: string; bg: string; bar: string }> = {
  SAFE:   { fg: T.green,  bg: 'rgba(34,221,136,0.10)', bar: '#22DD88' },
  WARN:   { fg: '#FFD700', bg: 'rgba(255,215,0,0.10)',  bar: '#FFD700' },
  DANGER: { fg: T.red,    bg: 'rgba(255,77,77,0.10)',   bar: '#FF4D4D' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const MiniBar = memo(function MiniBar({
  value, label, state,
}: { value: number; label: string; state: MetricState }) {
  const { fg, bar } = STATE_COLORS[state];
  const w = `${Math.min(100, Math.max(0, value * 100)).toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: T.textSub,
        width: 90, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em',
        flexShrink: 0,
      }}>{label}</span>
      <div style={{
        flex: 1, height: 5, background: 'rgba(255,255,255,0.06)',
        borderRadius: 99, overflow: 'hidden', minWidth: 0,
      }}>
        <div style={{
          height: '100%', width: w, background: bar,
          borderRadius: 99,
          boxShadow: `0 0 8px ${bar}88`,
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: fg,
        fontWeight: 700, width: 34, textAlign: 'right', flexShrink: 0,
      }}>{Math.round(value * 100)}%</span>
    </div>
  );
});

const StatCell = memo(function StatCell({
  label, value, subValue, state,
}: { label: string; value: string; subValue?: string; state?: MetricState }) {
  const fg = state ? STATE_COLORS[state].fg : T.text;
  return (
    <div style={{ padding: '10px 0 4px' }}>
      <div style={{
        fontFamily: T.mono, fontSize: 9, color: T.textMut,
        textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: fg, lineHeight: 1 }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textSub, marginTop: 3 }}>
          {subValue}
        </div>
      )}
    </div>
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────
export interface BalanceSheetPanelProps {
  balanceSheet: BalanceSheet;
  obligations: ObligationRecord[];
  portfolio: PortfolioRecord[];
  mitigations: MitigationRecord[];
  income: number;
  pressureTier?: PressureTier;
  isExpanded?: boolean;
  onToggle?: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default memo(function BalanceSheetPanel({
  balanceSheet, obligations, portfolio, mitigations, income,
  pressureTier, isExpanded = false, onToggle,
}: BalanceSheetPanelProps) {
  const liqRatio    = useMemo(() => liquidityRatio(balanceSheet), [balanceSheet]);
  const hhi         = useMemo(() => computeConcentrationScore(portfolio), [portfolio]);
  const totalAssets = balanceSheet.cash + balanceSheet.reserves + balanceSheet.illiquidValue;
  const totalOblig  = useMemo(
    () => obligations.reduce((s, o) => s + o.amountPerMonth, 0),
    [obligations],
  );
  const coverage    = income / Math.max(1, totalOblig);

  const liqSt = liqState(liqRatio);
  const covSt = covState(coverage);
  const hhiSt = hhiState(hhi);

  const isUnderwater = coverage < 1.0;
  const isLowCash    = balanceSheet.cash < 5_000;

  return (
    <div style={{
      background: T.card, borderRadius: 14,
      border: `1px solid ${isUnderwater ? 'rgba(255,77,77,0.35)' : T.border}`,
      overflow: 'hidden', fontFamily: T.display,
      boxShadow: isUnderwater ? '0 0 24px rgba(255,77,77,0.10)' : 'none',
    }}>
      <style>{FONT_IMPORT}</style>

      {/* ── Header ── */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '13px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          minHeight: 48,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: T.display }}>
            📊 BALANCE SHEET
          </span>

          <span style={{
            fontFamily: T.mono, fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: 6,
            color: STATE_COLORS[liqSt].fg,
            background: STATE_COLORS[liqSt].bg,
            border: `1px solid ${STATE_COLORS[liqSt].fg}33`,
          }}>
            {pct(liqRatio)} liquid
          </span>

          {isUnderwater && (
            <span style={{
              fontFamily: T.mono, fontSize: 10, fontWeight: 800,
              padding: '3px 8px', borderRadius: 6,
              color: T.red, background: T.redD,
              border: `1px solid rgba(255,77,77,0.35)`,
              animation: 'pzo-pulse 1.4s ease-in-out infinite',
            }}>
              ⚠ UNDERWATER
            </span>
          )}

          {pressureTier && (
            <span style={{
              fontFamily: T.mono, fontSize: 9, fontWeight: 700,
              padding: '2px 7px', borderRadius: 5,
              color: pressureColor(pressureTier),
              background: `${pressureColor(pressureTier)}18`,
              border: `1px solid ${pressureColor(pressureTier)}30`,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {pressureTier}
            </span>
          )}
        </div>

        <span style={{ color: T.textMut, fontSize: 11, lineHeight: 1 }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* ── Stats Grid ── */}
      <div style={{
        padding: '0 16px 14px',
        borderTop: `1px solid ${T.border}`,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0 12px',
      }}>
        <StatCell
          label="Cash" value={fmt(balanceSheet.cash)}
          state={isLowCash ? 'DANGER' : undefined}
          subValue={isLowCash ? '⚠ LOW' : undefined}
        />
        <StatCell label="Reserves" value={fmt(balanceSheet.reserves)} />
        <StatCell label="Illiquid" value={fmt(balanceSheet.illiquidValue)} />
        <StatCell label="Net Worth" value={fmt(totalAssets)} />
        <StatCell
          label="Obligations" value={`${fmt(totalOblig)}/mo`}
          state={totalOblig > income ? 'DANGER' : 'WARN'}
        />
        <StatCell
          label="Coverage" value={`${coverage.toFixed(2)}×`}
          state={covSt}
        />
      </div>

      {/* ── Bars ── */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <MiniBar value={liqRatio} label="Liquidity" state={liqSt} />
        <MiniBar value={Math.min(1, coverage / 2)} label="Coverage" state={covSt} />
        <MiniBar value={1 - hhi} label="Diversification" state={hhiSt} />
      </div>

      {/* ── Expanded Detail ── */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 16px' }}>

          {/* Obligations */}
          {obligations.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: T.mono, fontSize: 9, color: T.textMut,
                textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10,
              }}>
                Obligations ({obligations.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {obligations.map(o => (
                  <div key={o.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', background: T.cardHi,
                    borderRadius: 8, border: `1px solid ${T.border}`,
                  }}>
                    <span style={{ fontFamily: T.display, fontSize: 12, color: T.textSub }}>
                      {o.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.red, fontWeight: 700 }}>
                        −{fmt(o.amountPerMonth)}/mo
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMut }}>
                        {o.ticksRemaining !== null
                          ? `${Math.ceil(o.ticksRemaining / 12)}mo`
                          : '∞'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: T.mono, fontSize: 9, color: T.textMut,
                textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10,
              }}>
                Portfolio ({portfolio.length} assets)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {portfolio.slice(0, 6).map(p => (
                  <div key={p.cardId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', background: T.cardHi,
                    borderRadius: 8, border: `1px solid ${T.border}`,
                  }}>
                    <div>
                      <div style={{ fontFamily: T.display, fontSize: 12, color: T.text }}>
                        {p.cardName}
                      </div>
                      <div style={{
                        fontFamily: T.mono, fontSize: 9, color: T.textMut,
                        textTransform: 'capitalize', marginTop: 2,
                      }}>
                        {p.assetClass}
                      </div>
                    </div>
                    <span style={{ fontFamily: T.mono, fontSize: 12, color: T.green, fontWeight: 700 }}>
                      +{fmt(p.monthlyIncome)}/mo
                    </span>
                  </div>
                ))}
                {portfolio.length > 6 && (
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMut, paddingLeft: 4 }}>
                    +{portfolio.length - 6} more assets
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mitigations */}
          {mitigations.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: T.mono, fontSize: 9, color: T.textMut,
                textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10,
              }}>
                Active Protections
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {mitigations.map(m => (
                  <div key={m.type} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 20,
                    background: T.indigoD, border: `1px solid rgba(129,140,248,0.30)`,
                  }}>
                    <span style={{ fontFamily: T.display, fontSize: 12, color: T.indigo, fontWeight: 700 }}>
                      {m.label}
                    </span>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: '#6366F1' }}>
                      {fmt(m.remainingAbsorption)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concentration Warning */}
          {hhi > 0.6 && (
            <div style={{
              background: T.orangeD, border: `1px solid rgba(255,140,0,0.30)`,
              borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ fontFamily: T.display, fontSize: 12, color: T.orange, fontWeight: 700, marginBottom: 4 }}>
                ⚠ Concentrated Portfolio — {pct(hhi)} HHI
              </div>
              <div style={{ fontFamily: T.display, fontSize: 11, color: '#C07020', lineHeight: 1.5 }}>
                Overconcentration amplifies downside in adverse regimes. Diversify across asset classes to reduce cascade exposure.
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pzo-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
});