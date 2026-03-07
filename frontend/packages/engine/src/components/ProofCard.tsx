/**
 * ProofCard.tsx — Shareable run receipt
 *
 * Props contract (from App.tsx state — no phantom hooks):
 *   seed           number
 *   tick           number
 *   totalTicks     number
 *   cash           number
 *   netWorth       number
 *   income         number
 *   expenses       number
 *   intelligence   IntelligenceState
 *   season         SeasonState
 *   regime         MarketRegime
 *   topEvents      string[]      — last 3 notable events from events[]
 *   className      string?
 *
 * Renders a verifiable run receipt. "Share" copies a text summary to clipboard.
 * Zero phantom imports. Pure props → UI.
 */

import React, { useState, useCallback } from 'react';

// ─── Types (mirrored from App.tsx) ────────────────────────────────────────────

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

export interface SeasonState {
  xp: number;
  passTier: number;
  dominionControl: number;
  nodePressure: number;
  winStreak: number;
  battlePassLevel: number;
  rewardsPending: number;
}

export type MarketRegime = 'Stable' | 'Expansion' | 'Compression' | 'Panic' | 'Euphoria';

export interface ProofCardProps {
  seed: number;
  tick: number;
  totalTicks: number;
  cash: number;
  netWorth: number;
  income: number;
  expenses: number;
  intelligence: IntelligenceState;
  season: SeasonState;
  regime: MarketRegime;
  topEvents: string[];   // pass events.slice(-5) from App.tsx
  className?: string;
}

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

/** Deterministic audit hash derived from run seed + final state */
function buildAuditHash(seed: number, tick: number, netWorth: number): string {
  // FNV-1a 32-bit over concatenated values — matches App.tsx's hashString logic
  let h = 2166136261;
  const input = `${seed}:${tick}:${Math.round(netWorth)}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = ((h >>> 0) >>> 0).toString(16).padStart(8, '0');
  // Format: PZO-XXXX-XXXX
  return `PZO-${hex.slice(0, 4).toUpperCase()}-${hex.slice(4).toUpperCase()}`;
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-xs uppercase tracking-wide">{label}</span>
      <span className={`font-mono font-bold text-sm ${color}`}>{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProofCard({
  seed,
  tick,
  totalTicks,
  cash,
  netWorth,
  income,
  expenses,
  intelligence,
  season,
  regime,
  topEvents,
  className = '',
}: ProofCardProps) {
  const [copied, setCopied] = useState(false);

  const cashflow  = income - expenses;
  const won       = cashflow > 0 && netWorth > 100_000;
  const roi       = ((netWorth - 50_000) / 50_000) * 100;
  const auditHash = buildAuditHash(seed, tick, netWorth);
  const runPct    = Math.round((tick / totalTicks) * 100);

  const shareText = [
    `🎮 POINT ZERO ONE — Run Receipt`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Result:     ${won ? '🏆 FREEDOM' : '💀 WIPE'}`,
    `Net Worth:  ${fmt(netWorth)}`,
    `ROI:        ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`,
    `Cashflow:   ${cashflow >= 0 ? '+' : ''}${fmt(cashflow)}/mo`,
    `AI Alpha:   ${pct(intelligence.alpha)}`,
    `Pass Tier:  T${season.passTier}`,
    `Ticks:      ${tick}/${totalTicks}`,
    `Seed:       ${seed}`,
    `Audit Hash: ${auditHash}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Verify: pointzeroone.gg/verify/${auditHash}`,
  ].join('\n');

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select a hidden textarea
    }
  }, [shareText]);

  return (
    <div className={`bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden ${className}`}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className={`px-5 py-3 flex items-center justify-between border-b border-zinc-800 ${won ? 'bg-emerald-950/40' : 'bg-red-950/30'}`}>
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-0.5">Run Receipt</p>
          <p className={`font-black text-lg tracking-tight ${won ? 'text-emerald-400' : 'text-red-400'}`}>
            {won ? '🏆 FREEDOM UNLOCKED' : '💀 WIPE'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-zinc-600 text-xs font-mono">Seed</p>
          <p className="text-zinc-300 font-mono text-sm">{seed || '—'}</p>
        </div>
      </div>

      {/* ── Core Stats ──────────────────────────────────────────────── */}
      <div className="px-5 py-3">
        <StatRow label="Net Worth"   value={fmt(netWorth)}  color={netWorth > 50_000 ? 'text-emerald-400' : 'text-red-400'} />
        <StatRow label="ROI"         value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} color={roi >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatRow label="Cashflow/mo" value={`${cashflow >= 0 ? '+' : ''}${fmt(cashflow)}`} color={cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatRow label="Final Cash"  value={fmt(cash)}      color={cash > 0 ? 'text-white' : 'text-red-400'} />
        <StatRow label="Regime"      value={regime} />
        <StatRow label="Run Length"  value={`${tick} / ${totalTicks} ticks (${runPct}%)`} />
      </div>

      {/* ── Intelligence Snapshot ───────────────────────────────────── */}
      <div className="px-5 pb-3 grid grid-cols-2 gap-2">
        {[
          ['AI Alpha',    pct(intelligence.alpha),    'text-indigo-300'],
          ['Risk',        pct(intelligence.risk),     'text-red-300'],
          ['Momentum',    pct(intelligence.momentum), 'text-emerald-300'],
          ['Churn Risk',  pct(intelligence.churnRisk),'text-yellow-300'],
          ['Pass Tier',   `T${season.passTier}`,      'text-purple-300'],
          ['Dominion',    `${season.dominionControl}`,'text-cyan-300'],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-zinc-950 rounded px-3 py-2">
            <p className="text-zinc-600 text-xs uppercase tracking-wide">{label}</p>
            <p className={`font-mono font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Top Moments ─────────────────────────────────────────────── */}
      {topEvents.length > 0 && (
        <div className="px-5 pb-3 border-t border-zinc-800 pt-3">
          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Key Moments</p>
          <div className="space-y-1">
            {topEvents.slice(-3).reverse().map((ev, i) => (
              <p key={i} className="text-xs font-mono text-zinc-400 truncate">{ev}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Audit Hash + Share ───────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-between gap-3">
        <div>
          <p className="text-zinc-600 text-xs uppercase tracking-wide mb-0.5">Audit Hash</p>
          <p className="font-mono text-xs text-zinc-300 tracking-widest">{auditHash}</p>
        </div>
        <button
          onClick={handleShare}
          className={`
            flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide
            transition-all duration-200
            ${copied
              ? 'bg-emerald-700 text-emerald-200 border border-emerald-600'
              : 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'}
          `}
        >
          {copied ? '✓ Copied' : '📋 Share'}
        </button>
      </div>
    </div>
  );
}
