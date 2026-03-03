/**
 * GameBoard.tsx — Live equity chart + macro state display
 * Rebuilt: Syne + IBM Plex Mono · Inline styles · Mobile-first · High contrast
 * FIX: replaced all .at() calls with bracket indexing for ES2021 lib compatibility
 * Density6 LLC · Confidential
 */

import React, { useMemo } from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  card:    '#0C0C1E',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.14)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  red:     '#FF4D4D',
  orange:  '#FF8C00',
  blue:    '#4488FF',
  cyan:    '#22D3EE',
  yellow:  '#FFD700',
  indigo:  '#818CF8',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type MarketRegime = 'Stable' | 'Expansion' | 'Compression' | 'Panic' | 'Euphoria';

export interface IntelligenceState {
  alpha: number;
  risk: number;
  volatility: number;
  antiCheat: number;
  personalization: number;
  rewardFit: number;
  recommendationPower: number;
  churnRisk: number;
  momentum: number;
}

export interface GameBoardProps {
  equityHistory: number[];
  cash: number;
  netWorth: number;
  income: number;
  expenses: number;
  regime: MarketRegime;
  intelligence: IntelligenceState;
  tick: number;
  totalTicks: number;
  freezeTicks: number;
}

// ─── Regime config ────────────────────────────────────────────────────────────
const REGIME_CFG: Record<MarketRegime, { color: string; bg: string; border: string; icon: string }> = {
  Stable:      { color: '#C8C8E0', bg: '#1A1A2E', border: '#3A3A5A', icon: '⚖️'  },
  Expansion:   { color: T.green,   bg: '#001A0E', border: '#004422', icon: '📈'  },
  Compression: { color: T.yellow,  bg: '#1A1400', border: '#443A00', icon: '🗜️'  },
  Panic:       { color: T.red,     bg: '#1A0000', border: '#440000', icon: '🔴'  },
  Euphoria:    { color: T.cyan,    bg: '#001A1A', border: '#004444', icon: '🚀'  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v/1e6).toFixed(2)}M`;
  if (v >= 1_000)     return `${s}$${(v/1e3).toFixed(1)}K`;
  return `${s}$${Math.round(v).toLocaleString()}`;
}

// ─── SVG Equity Chart ─────────────────────────────────────────────────────────
function EquityChart({ data }: { data: number[] }) {
  const W = 560, H = 120, pad = 8;

  const { pts, fill, rising, deltaPct } = useMemo(() => {
    if (data.length < 2) return { pts: '', fill: '', rising: true, deltaPct: 0 };

    const min   = Math.min(...data);
    const max   = Math.max(...data);
    const range = max - min || 1;

    const toXY = (v: number, i: number) => {
      const x = pad + (i / (data.length - 1)) * (W - pad * 2);
      const y = pad + (1 - (v - min) / range) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const pts  = data.map(toXY).join(' ');
    // FIX: replace .at(-1) with [data.length - 1] for ES2021 lib compat
    const lastVal  = data[data.length - 1];
    const lastXY   = toXY(lastVal, data.length - 1).split(',');
    const firstXY  = toXY(data[0], 0).split(',');
    const fill     = `${pts} ${lastXY[0]},${H} ${firstXY[0]},${H}`;
    const rising   = lastVal >= data[0];
    const deltaPct = data[0] !== 0 ? ((lastVal - data[0]) / Math.abs(data[0])) * 100 : 0;

    return { pts, fill, rising, deltaPct };
  }, [data]);

  if (data.length < 2) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 120, color: T.textMut, fontSize: 13, fontFamily: T.mono,
      }}>
        Waiting for equity data…
      </div>
    );
  }

  const lineColor = rising ? T.green : T.red;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="gbGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0"    />
          </linearGradient>
        </defs>
        <polygon points={fill} fill="url(#gbGrad)" />
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round" />
        {/* Dot at last point — FIX: use split on pre-computed pts string */}
        {(() => {
          const allPts = pts.split(' ');
          // FIX: replace .at(-1) with [allPts.length - 1]
          const last = (allPts[allPts.length - 1] ?? '0,0').split(',');
          return (
            <circle cx={last[0]} cy={last[1]} r={4.5} fill={lineColor}
              stroke="#0C0C1E" strokeWidth={2} />
          );
        })()}
      </svg>
      <div style={{
        position: 'absolute', top: 4, right: 4,
        fontSize: 11, fontFamily: T.mono, fontWeight: 700,
        color: rising ? T.green : T.red,
        background: rising ? 'rgba(34,221,136,0.12)' : 'rgba(255,77,77,0.12)',
        border: `1px solid ${rising ? 'rgba(34,221,136,0.28)' : 'rgba(255,77,77,0.28)'}`,
        padding: '3px 8px', borderRadius: 6,
      }}>
        {rising ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
      </div>
    </div>
  );
}

// ─── Intel Bar ────────────────────────────────────────────────────────────────
function IntelBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub, width: 100, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 5, background: '#1A1A2E', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${Math.round(value * 100)}%`,
          background: color,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub, width: 36, textAlign: 'right' }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GameBoard({
  equityHistory, cash, netWorth, income, expenses,
  regime, intelligence, tick, totalTicks, freezeTicks,
}: GameBoardProps) {
  const cashflow = income - expenses;
  const rc       = REGIME_CFG[regime];
  const runPct   = Math.round((tick / Math.max(1, totalTicks)) * 100);

  const metrics = [
    { label: 'Cash',        value: fmt(cash),     color: cash < 5000 ? T.red : T.green },
    { label: 'Net Worth',   value: fmt(netWorth),  color: T.text     },
    { label: 'Cashflow/mo', value: (cashflow >= 0 ? '+' : '') + fmt(cashflow), color: cashflow >= 0 ? T.green : T.red },
    { label: 'Income/mo',   value: fmt(income),    color: '#88EEBB'  },
  ];

  const intelBars = [
    { label: 'AI Alpha',   value: intelligence.alpha,               color: T.indigo },
    { label: 'Risk',       value: intelligence.risk,                color: T.red    },
    { label: 'Volatility', value: intelligence.volatility,          color: T.orange },
    { label: 'Momentum',   value: intelligence.momentum,            color: T.green  },
    { label: 'Reco Power', value: intelligence.recommendationPower, color: T.cyan   },
    { label: 'Churn Risk', value: intelligence.churnRisk,           color: T.yellow },
  ];

  return (
    <div style={{
      background: T.card, borderRadius: 12,
      border: `1px solid ${T.border}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: T.display,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@400;600;700&display=swap');`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: `1px solid ${T.border}`,
        flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.display }}>
          Equity Chart
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {freezeTicks > 0 && (
            <div style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 10,
              fontFamily: T.mono, fontWeight: 700,
              background: 'rgba(255,140,0,0.15)', border: '1px solid rgba(255,140,0,0.35)',
              color: T.orange,
            }}>
              FROZEN {freezeTicks}t
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6, fontSize: 11,
            fontFamily: T.mono, fontWeight: 700,
            background: rc.bg, border: `1px solid ${rc.border}`,
            color: rc.color,
          }}>
            {rc.icon} {regime}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)' }}>
        <EquityChart data={equityHistory} />
      </div>

      {/* Metrics */}
      <div style={{
        display: 'grid', gap: 1,
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        background: T.border,
      }}>
        {metrics.map(({ label, value, color }) => (
          <div key={label} style={{ background: T.card, padding: '12px 16px' }}>
            <div style={{
              fontSize: 9, fontFamily: T.mono, color: T.textSub,
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5,
            }}>
              {label}
            </div>
            <div style={{ fontSize: 'clamp(12px,1.8vw,15px)', fontFamily: T.mono, fontWeight: 700, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Run Progress */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub }}>Run Progress</span>
          <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub }}>
            T{tick} / {totalTicks} ({runPct}%)
          </span>
        </div>
        <div style={{ height: 5, background: '#1A1A2E', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, width: `${runPct}%`,
            background: 'linear-gradient(90deg, #4444AA, #818CF8)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Intelligence */}
      <div style={{
        padding: '12px 16px 14px', borderTop: `1px solid ${T.border}`,
        display: 'grid', gap: 8,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}>
        {intelBars.map((bar) => (
          <IntelBar key={bar.label} {...bar} />
        ))}
      </div>
    </div>
  );
}