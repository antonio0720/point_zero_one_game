/**
 * PhantomGameScreen.tsx — GHOST mode game screen
 * Theme: Purple / Spectral. Live delta vs champion ghost. Divergence points. Proof badge.
 * Race a verified champion who played the exact same market you're facing.
 */

import React, { useMemo } from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { ReplayTimeline } from './ReplayTimeline';
import type { ReplayEvent } from './ReplayTimeline';
import MomentFlash from './MomentFlash';
import type { GameModeState, DivergencePoint } from '../engines/core/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${sign}$${(v / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

const GRADE_COLOR: Record<string, string> = {
  'S': '#FFD700',
  'A': '#00E5C8',
  'B': '#6699FF',
  'C': '#FFDD00',
  'D': '#FF8800',
  'F': '#FF2222',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function DeltaDisplay({
  delta,
  deltaPct,
  localNetWorth,
  ghostNetWorth,
  ghostIsAlive,
}: {
  delta: number;
  deltaPct: number;
  localNetWorth: number;
  ghostNetWorth: number;
  ghostIsAlive: boolean;
}) {
  const ahead  = delta >= 0;
  const accent = ahead ? '#B57BFF' : '#FF4444';

  return (
    <div
      className="rounded-xl border p-6 text-center relative overflow-hidden"
      style={{ background: '#08000D', borderColor: '#B57BFF33' }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${accent}08 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Label */}
        <div className="text-[#B57BFF88] text-xs tracking-widest uppercase mb-2 font-bold">
          {ahead ? 'LEADING CHAMPION' : 'TRAILING CHAMPION'}
        </div>

        {/* Big delta */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-2xl">{ahead ? '▲' : '▼'}</span>
          <span
            className="text-6xl font-black"
            style={{
              color: accent,
              textShadow: `0 0 40px ${accent}66`,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {fmt(Math.abs(delta))}
          </span>
        </div>

        {/* Pct */}
        <div className="text-xl font-black mb-4" style={{ color: accent + 'cc' }}>
          {ahead ? '+' : ''}{deltaPct.toFixed(1)}% vs ghost
        </div>

        {/* Side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0D001A] border border-[#B57BFF22] rounded-lg p-3">
            <div className="text-[#B57BFF88] text-[9px] uppercase tracking-widest mb-1">You</div>
            <div className="font-mono font-bold text-white text-lg">{fmt(localNetWorth)}</div>
          </div>
          <div className="bg-[#0D001A] border border-[#B57BFF22] rounded-lg p-3">
            <div className="text-[#B57BFF88] text-[9px] uppercase tracking-widest mb-1">
              Champion {!ghostIsAlive && '💀'}
            </div>
            <div className="font-mono font-bold text-lg" style={{ color: ghostIsAlive ? '#ddd' : '#666' }}>
              {fmt(ghostNetWorth)}
            </div>
            {!ghostIsAlive && (
              <div className="text-[9px] text-[#666]">bankrupt on this seed</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DualEquityChart({
  localHistory,
  ghostHistory,
  w = 560,
  h = 120,
}: {
  localHistory: number[];
  ghostHistory: number[];
  w?: number;
  h?: number;
}) {
  const { localPoints, ghostPoints } = useMemo(() => {
    const data     = localHistory.length >= ghostHistory.length ? localHistory : ghostHistory;
    const maxLen   = Math.max(localHistory.length, ghostHistory.length, 2);
    const allVals  = [...localHistory, ...ghostHistory].filter(Number.isFinite);
    const min      = Math.min(...allVals);
    const max      = Math.max(...allVals);
    const range    = max - min || 1;
    const pad      = 8;

    const toPoints = (series: number[]) =>
      series
        .map((v, i) => {
          const x = pad + (i / (maxLen - 1)) * (w - pad * 2);
          const y = pad + (1 - (v - min) / range) * (h - pad * 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return {
      localPoints: toPoints(localHistory),
      ghostPoints: toPoints(ghostHistory),
    };
  }, [localHistory, ghostHistory, w, h]);

  return (
    <div className="relative">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
        {/* Ghost line */}
        {ghostHistory.length >= 2 && (
          <polyline
            points={ghostPoints}
            fill="none"
            stroke="#B57BFF"
            strokeWidth={1.5}
            strokeDasharray="4,3"
            strokeOpacity={0.5}
            strokeLinejoin="round"
          />
        )}
        {/* Your line */}
        {localHistory.length >= 2 && (
          <polyline
            points={localPoints}
            fill="none"
            stroke="#00E5C8"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="flex items-center gap-4 mt-1 justify-end text-[10px] font-mono">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-px bg-[#00E5C8]" /> You
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-px bg-[#B57BFF] opacity-50 border-dashed" /> Champion
        </span>
      </div>
    </div>
  );
}

function DivergenceLog({ points }: { points: DivergencePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border p-4" style={{ background: '#08000D', borderColor: '#B57BFF22' }}>
        <div className="text-[#B57BFF] text-xs font-bold tracking-widest uppercase mb-2">Divergence Points</div>
        <div className="text-[#444] text-xs text-center py-4">
          No major divergences yet. Keep playing.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4" style={{ background: '#08000D', borderColor: '#B57BFF22' }}>
      <div className="text-[#B57BFF] text-xs font-bold tracking-widest uppercase mb-3">
        Divergence Points
      </div>
      <div className="space-y-2 max-h-48 overflow-auto">
        {[...points].reverse().map((pt) => (
          <div
            key={`${pt.tick}-${pt.label}`}
            className="flex items-start gap-3 px-3 py-2 rounded-lg border text-xs"
            style={{ borderColor: '#B57BFF22', background: '#B57BFF08' }}
          >
            <span className="text-[#B57BFF66] font-mono shrink-0">T{pt.tick}</span>
            <span className="flex-1 text-[#ccc]">{pt.label}</span>
            <span
              className="font-mono shrink-0 font-bold"
              style={{ color: pt.localDeltaAfter >= 0 ? '#00E5C8' : '#FF4444' }}
            >
              {pt.localDeltaAfter >= 0 ? '+' : ''}{fmt(pt.localDeltaAfter)}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0"
              style={{
                color: pt.impactScore >= 70 ? '#FF4444' : pt.impactScore >= 40 ? '#FF8800' : '#888',
                background: pt.impactScore >= 70 ? '#FF000011' : '#00000022',
                border: `1px solid ${pt.impactScore >= 70 ? '#FF444422' : '#22222222'}`,
              }}
            >
              {pt.impactScore}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofBadgeProgress({
  proofEarned,
  tick,
  totalTicks,
  ghostIsAlive,
  delta,
}: {
  proofEarned: boolean;
  tick: number;
  totalTicks: number;
  ghostIsAlive: boolean;
  delta: number;
}) {
  const pct = (tick / totalTicks) * 100;

  if (proofEarned) {
    return (
      <div
        className="rounded-xl border p-4 text-center"
        style={{ background: '#08000D', borderColor: '#B57BFF66' }}
      >
        <div className="text-4xl mb-2">🏅</div>
        <div className="text-[#B57BFF] font-black text-lg tracking-widest uppercase">
          PROOF BADGE EARNED
        </div>
        <div className="text-[#888] text-xs mt-1">
          You outperformed a verified champion on this seed.
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: '#08000D', borderColor: '#B57BFF22' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#B57BFF] text-xs font-bold tracking-widest uppercase">Proof Badge</span>
        <span className="text-[#888] text-xs">{Math.round(pct)}% complete</span>
      </div>

      <div className="h-2 bg-[#1a001a] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: delta >= 0 ? 'linear-gradient(90deg, #660088, #B57BFF)' : 'linear-gradient(90deg, #440022, #FF4444)',
          }}
        />
      </div>

      <div className="text-[10px] text-[#666] text-center">
        {delta >= 0
          ? '🎯 Ahead of ghost — hold it through the end to earn the badge'
          : '⚠️ Behind ghost — close the gap before tick 720'}
      </div>

      {!ghostIsAlive && (
        <div className="mt-2 text-[10px] text-[#B57BFF88] text-center">
          Ghost bankrupt — any positive net worth at end earns badge
        </div>
      )}
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PhantomGameScreenProps {
  cash: number;
  income: number;
  expenses: number;
  netWorth: number;
  shields: number;
  tick: number;
  totalTicks: number;
  freezeTicks: number;
  regime: MarketRegime;
  intelligence: IntelligenceState;
  equityHistory: number[];
  events: string[];
  replayEvents: ReplayEvent[];
  modeState: GameModeState | null;
  seed: number;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PhantomGameScreen({
  cash, income, expenses, netWorth, shields,
  tick, totalTicks, freezeTicks, regime, intelligence, equityHistory,
  events, replayEvents, modeState, seed,
}: PhantomGameScreenProps) {
  const phantom       = modeState?.phantom;
  const ghostNW       = phantom?.ghostNetWorth   ?? netWorth * 1.15;   // ghost ~15% ahead if no data
  const localNW       = phantom?.localNetWorth   ?? netWorth;
  const delta         = phantom?.delta           ?? (localNW - ghostNW);
  const deltaPct      = phantom?.deltaPct        ?? ((delta / Math.max(1, ghostNW)) * 100);
  const ghostIsAlive  = phantom?.ghostIsAlive    ?? true;
  const proofEarned   = phantom?.proofBadgeEarned ?? false;
  const divergences   = phantom?.divergencePoints ?? [];
  const grade         = phantom?.championGrade   ?? 'A';

  // Build a ghost equity history (approximated from ghostNW + slight offset)
  const ghostHistory = useMemo(() => {
    return equityHistory.map((v, i) => {
      const progress = i / Math.max(1, equityHistory.length - 1);
      return v * (1 + 0.15 * progress);  // ghost 15% better over time
    });
  }, [equityHistory]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #08000D 0%, #0A0012 50%, #060009 100%)' }}
    >
      {/* ── Mode Banner ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ borderColor: '#B57BFF22', background: '#08000D88' }}
      >
        <div
          className="px-3 py-1 rounded text-xs font-black tracking-widest"
          style={{ background: '#B57BFF22', border: '1px solid #B57BFF44', color: '#B57BFF' }}
        >
          👻 PHANTOM
        </div>
        <span className="text-[#888] text-xs">Same market, same events. The only variable is the quality of your decisions.</span>
        <div className="ml-auto flex items-center gap-4 text-xs font-mono">
          <span style={{ color: GRADE_COLOR[grade] ?? '#888' }}>
            CHAMPION GRADE {grade}
          </span>
          <span className="text-[#555]">SEED {seed}</span>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 p-4 space-y-4">

        {/* Delta Display (dominant element) */}
        <DeltaDisplay
          delta={delta}
          deltaPct={deltaPct}
          localNetWorth={localNW}
          ghostNetWorth={ghostNW}
          ghostIsAlive={ghostIsAlive}
        />

        {/* Dual Chart + Divergence */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.6fr] gap-4">
          <div
            className="rounded-xl border p-4"
            style={{ background: '#08000D', borderColor: '#B57BFF22' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#B57BFF] text-xs font-bold tracking-widest uppercase">
                Equity Race — You vs Champion
              </span>
              <span className="text-[#555] text-xs font-mono">T{tick}/{totalTicks}</span>
            </div>
            <DualEquityChart localHistory={equityHistory} ghostHistory={ghostHistory} h={130} />
          </div>

          <DivergenceLog points={divergences} />
        </div>

        {/* Proof badge progress */}
        <ProofBadgeProgress
          proofEarned={proofEarned}
          tick={tick}
          totalTicks={totalTicks}
          ghostIsAlive={ghostIsAlive}
          delta={delta}
        />

        {/* GameBoard (supporting) */}
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

        {/* Replay timeline */}
        {replayEvents.length > 0 && (
          <div className="w-full">
            <ReplayTimeline
              events={replayEvents}
              totalTicks={totalTicks}
              finalNetWorth={netWorth}
              seed={seed}
            />
          </div>
        )}
      </div>

      {/* ── Moment Flash ────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 w-80 z-50 pointer-events-none">
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}
