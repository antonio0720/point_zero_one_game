/**
 * BankruptcyScreen.tsx — Terminal bankruptcy screen
 *
 * Props contract (from App.tsx — no phantom hooks/stores):
 *   seed           number
 *   tick           number
 *   regime         MarketRegime
 *   intelligence   IntelligenceState
 *   season         SeasonState
 *   events         string[]           — full events[] from App.tsx
 *   equityHistory  number[]           — for final sparkline
 *   onPlayAgain    () => void          — calls setScreen('landing')
 *
 * Zero external deps. Zero phantom imports. Pure props → UI.
 */

import React, { useMemo, useState, useCallback } from 'react';

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

export interface SeasonState {
  xp: number;
  passTier: number;
  dominionControl: number;
  nodePressure: number;
  winStreak: number;
  battlePassLevel: number;
  rewardsPending: number;
}

export interface BankruptcyScreenProps {
  seed: number;
  tick: number;
  regime: MarketRegime;
  intelligence: IntelligenceState;
  season: SeasonState;
  events: string[];
  equityHistory: number[];
  onPlayAgain: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function buildAuditHash(seed: number, tick: number): string {
  let h = 2166136261;
  const input = `${seed}:${tick}:bankrupt`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = ((h >>> 0) >>> 0).toString(16).padStart(8, '0');
  return `PZO-${hex.slice(0, 4).toUpperCase()}-${hex.slice(4).toUpperCase()}`;
}

// ─── Sparkline (inline — no recharts) ────────────────────────────────────────

function DeathSparkline({ data }: { data: number[] }) {
  const points = useMemo(() => {
    if (data.length < 2) return '';
    const w = 280, h = 56;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 4;
    return data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [data]);

  if (!points) return null;

  const lastPt = points.split(' ').at(-1)!.split(',');

  return (
    <svg width={280} height={56} className="w-full overflow-visible opacity-60">
      <polyline points={points} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r={3} fill="#ef4444" stroke="#09090b" strokeWidth={1.5} />
    </svg>
  );
}

// ─── Cause Analysis ───────────────────────────────────────────────────────────

function inferCauseOfDeath(
  events: string[],
  regime: MarketRegime,
  intelligence: IntelligenceState,
  season: SeasonState,
): string[] {
  const causes: string[] = [];
  const last20 = events.slice(-20);

  if (last20.some((e) => /FUBAR hit/i.test(e)))
    causes.push('Unblocked FUBAR events drained cash reserves.');
  if (last20.some((e) => /Recession/i.test(e)))
    causes.push('Recession wave compounded expense obligations.');
  if (last20.some((e) => /Unexpected bill/i.test(e)))
    causes.push('Unexpected bills accelerated the cash burn.');
  if (season.nodePressure > 10)
    causes.push(`Node pressure reached ${season.nodePressure} — systemic fragility was high.`);
  if (intelligence.risk > 0.7)
    causes.push(`AI risk signal hit ${pct(intelligence.risk)} — portfolio was over-leveraged.`);
  if (regime === 'Panic')
    causes.push('Market entered Panic regime at time of collapse.');
  if (intelligence.momentum < 0.2)
    causes.push('Momentum collapsed — insufficient income growth to offset expenses.');

  if (causes.length === 0)
    causes.push('Cash decay outpaced income generation. No shields remained.');

  return causes;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BankruptcyScreen({
  seed,
  tick,
  regime,
  intelligence,
  season,
  events,
  equityHistory,
  onPlayAgain,
}: BankruptcyScreenProps) {
  const [copied, setCopied] = useState(false);
  const auditHash = buildAuditHash(seed, tick);

  const causes = useMemo(
    () => inferCauseOfDeath(events, regime, intelligence, season),
    [events, regime, intelligence, season],
  );

  const handleShare = useCallback(async () => {
    const text = [
      '💀 POINT ZERO ONE — BANKRUPTCY',
      '━━━━━━━━━━━━━━━━━━━━',
      `Tick:     ${tick}`,
      `Regime:   ${regime}`,
      `AI Risk:  ${pct(intelligence.risk)}`,
      `Pressure: ${season.nodePressure}`,
      `Seed:     ${seed}`,
      `Hash:     ${auditHash}`,
      '━━━━━━━━━━━━━━━━━━━━',
      ...causes.map((c) => `• ${c}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [tick, regime, intelligence, season, seed, auditHash, causes]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 gap-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="text-center">
        <div className="text-7xl font-black text-red-500 tracking-tight leading-none mb-2">
          BANKRUPTCY
        </div>
        <p className="text-zinc-500 text-base">
          Cash hit zero. No shields remained. Run terminated at tick {tick}.
        </p>
      </div>

      {/* ── Equity Flatline ───────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-red-900/60 rounded-xl px-6 py-4 w-full max-w-xl">
        <p className="text-zinc-600 text-xs uppercase tracking-wide mb-2">Equity Flatline</p>
        <DeathSparkline data={equityHistory} />
      </div>

      {/* ── Cause of Death ────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-red-900/50 rounded-xl p-5 w-full max-w-xl">
        <p className="text-red-400 text-xs uppercase tracking-wider font-bold mb-3">
          ☠ Forensic Cause of Death
        </p>
        <ul className="space-y-2">
          {causes.map((cause, i) => (
            <li key={i} className="flex gap-2 text-sm text-zinc-400">
              <span className="text-red-600 flex-shrink-0">▸</span>
              {cause}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Run Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-xl">
        {[
          { label: 'Regime',        value: regime,                   color: 'text-orange-400' },
          { label: 'AI Risk',       value: pct(intelligence.risk),   color: 'text-red-400'    },
          { label: 'Node Pressure', value: String(season.nodePressure), color: 'text-orange-300' },
          { label: 'Pass Tier',     value: `T${season.passTier}`,    color: 'text-indigo-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <p className="text-zinc-600 text-xs uppercase tracking-wide mb-1">{label}</p>
            <p className={`font-mono font-bold text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Recent Events ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-full max-w-xl">
        <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Last Events Before Collapse</p>
        <div className="space-y-1">
          {events.slice(-5).reverse().map((ev, i) => (
            <p key={i} className={`text-xs font-mono ${i === 0 ? 'text-red-400' : 'text-zinc-500'}`}>
              {ev}
            </p>
          ))}
        </div>
      </div>

      {/* ── Audit Hash + Actions ──────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xl">
        <div className="text-center">
          <p className="text-zinc-600 text-xs uppercase tracking-wide mb-0.5">Audit Hash</p>
          <p className="font-mono text-zinc-400 tracking-widest text-sm">{auditHash}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              copied
                ? 'bg-emerald-800 border-emerald-700 text-emerald-200'
                : 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700'
            }`}
          >
            {copied ? '✓ Copied' : '📋 Share Run'}
          </button>

          <button
            onClick={onPlayAgain}
            className="px-8 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white transition-all hover:scale-105 active:scale-95"
          >
            Try Again
          </button>
        </div>
      </div>

      <p className="text-zinc-700 text-xs text-center max-w-sm">
        Seed {seed} · Tick {tick} · This run is deterministically replayable
      </p>
    </div>
  );
}
