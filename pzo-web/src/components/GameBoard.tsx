/**
 * GameBoard.tsx — Live equity chart + macro state display
 *
 * Props contract (all from App.tsx state — no phantom hooks):
 *   equityHistory  number[]         — netWorth snapshots per month tick
 *   cash           number
 *   netWorth       number
 *   income         number
 *   expenses       number
 *   regime         MarketRegime
 *   intelligence   IntelligenceState
 *   tick           number
 *   totalTicks     number
 *   freezeTicks    number
 *
 * Zero external deps beyond React. SVG chart built inline.
 */

import React, { useMemo } from 'react';

// ─── Types (mirrored from App.tsx — no import needed) ─────────────────────────

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

const REGIME_CONFIG: Record<MarketRegime, { color: string; bg: string; icon: string }> = {
  Stable:      { color: 'text-zinc-300',   bg: 'bg-zinc-800',     icon: '⚖️'  },
  Expansion:   { color: 'text-emerald-400', bg: 'bg-emerald-950',  icon: '📈' },
  Compression: { color: 'text-yellow-400',  bg: 'bg-yellow-950',   icon: '🗜️' },
  Panic:       { color: 'text-red-400',     bg: 'bg-red-950',      icon: '🔴' },
  Euphoria:    { color: 'text-cyan-400',    bg: 'bg-cyan-950',     icon: '🚀' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${sign}$${(v / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ─── SVG Equity Chart ─────────────────────────────────────────────────────────

function EquityChart({ data, w = 560, h = 120 }: { data: number[]; w?: number; h?: number }) {
  const points = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 6;
    return data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = pad + (1 - (v - min) / range) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, w, h]);

  const gradientPoints = useMemo(() => {
    if (!points) return '';
    const first = points.split(' ')[0].split(',');
    const last  = points.split(' ').at(-1)!.split(',');
    return `${points} ${last[0]},${h} ${first[0]},${h}`;
  }, [points, h]);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Waiting for equity data…
      </div>
    );
  }

  const rising = data[data.length - 1] >= data[0];
  const lineColor   = rising ? '#10b981' : '#ef4444';
  const fillColor   = rising ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
  const glowColor   = rising ? '#10b981' : '#ef4444';

  // Latest vs start delta
  const delta    = data[data.length - 1] - data[0];
  const deltaPct = data[0] !== 0 ? (delta / Math.abs(data[0])) * 100 : 0;

  return (
    <div className="relative">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={glowColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <polygon points={gradientPoints} fill="url(#eqGrad)" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Latest dot */}
        {(() => {
          const lastPt = points.split(' ').at(-1)!.split(',');
          return (
            <circle
              cx={lastPt[0]} cy={lastPt[1]}
              r={4}
              fill={lineColor}
              stroke="#09090b"
              strokeWidth={2}
            />
          );
        })()}
      </svg>

      {/* Delta badge */}
      <div className={`absolute top-1 right-2 text-xs font-mono font-bold ${rising ? 'text-emerald-400' : 'text-red-400'}`}>
        {rising ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
      </div>
    </div>
  );
}

// ─── Intelligence Bar ─────────────────────────────────────────────────────────

function IntelBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500 text-xs w-24 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-zinc-400 text-xs font-mono w-8 text-right">{pct(value)}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GameBoard({
  equityHistory,
  cash,
  netWorth,
  income,
  expenses,
  regime,
  intelligence,
  tick,
  totalTicks,
  freezeTicks,
}: GameBoardProps) {
  const cashflow   = income - expenses;
  const regimeCfg  = REGIME_CONFIG[regime];
  const runPct     = Math.round((tick / totalTicks) * 100);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col gap-0">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-sm font-bold text-white">Equity Chart</span>
        <div className="flex items-center gap-3">
          {freezeTicks > 0 && (
            <span className="px-2 py-0.5 rounded bg-orange-900/60 border border-orange-700 text-orange-300 text-xs font-mono animate-pulse">
              FROZEN {freezeTicks}t
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${regimeCfg.bg} ${regimeCfg.color}`}>
            {regimeCfg.icon} {regime}
          </span>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-zinc-950/60">
        <EquityChart data={equityHistory} h={110} />
      </div>

      {/* ── Key Metrics ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800">
        {[
          { label: 'Cash',       value: fmt(cash),     color: cash < 5000 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Net Worth',  value: fmt(netWorth),  color: 'text-white'       },
          { label: 'Cashflow/mo',value: (cashflow >= 0 ? '+' : '') + fmt(cashflow), color: cashflow >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Income/mo',  value: fmt(income),   color: 'text-emerald-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 px-4 py-3">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">{label}</p>
            <p className={`font-mono font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Run Progress ────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-zinc-800">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Run Progress</span>
          <span>T{tick} / {totalTicks} ({runPct}%)</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${runPct}%` }}
          />
        </div>
      </div>

      {/* ── Intelligence Bars ────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-1.5">
        <IntelBar label="AI Alpha"     value={intelligence.alpha}             color="bg-indigo-500" />
        <IntelBar label="Risk"         value={intelligence.risk}              color="bg-red-500"    />
        <IntelBar label="Volatility"   value={intelligence.volatility}        color="bg-orange-500" />
        <IntelBar label="Momentum"     value={intelligence.momentum}          color="bg-emerald-500"/>
        <IntelBar label="Reco Power"   value={intelligence.recommendationPower} color="bg-cyan-500" />
        <IntelBar label="Churn Risk"   value={intelligence.churnRisk}         color="bg-yellow-500" />
      </div>

    </div>
  );
}
