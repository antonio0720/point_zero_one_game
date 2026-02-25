/**
 * EmpireGameScreen.tsx — SOLO mode game screen
 * Theme: Gold / Imperial. 5 escalating waves. Bot threats. Momentum engine.
 * The sovereign builder vs 5 adversarial systems — alone.
 */

import React, { useMemo } from 'react';
import CardHand from './CardHand';
import type { Card } from './CardHand';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { ThreatRadarPanel } from './ThreatRadarPanel';
import type { Threat } from './ThreatRadarPanel';
import ShieldIcons from './ShieldIcons';
import MomentFlash from './MomentFlash';
import type { GameModeState } from '../engines/core/types';

// ─── Wave config ────────────────────────────────────────────────────────────

const WAVE_DEFS = [
  { wave: 1, label: 'AWAKENING',    startTick: 0,   activeBots: 1, incomeHit: 0,     accent: '#FFB800' },
  { wave: 2, label: 'RESISTANCE',   startTick: 144,  activeBots: 2, incomeHit: -200,  accent: '#FF8C00' },
  { wave: 3, label: 'SIEGE',        startTick: 288,  activeBots: 3, incomeHit: -400,  accent: '#FF6000' },
  { wave: 4, label: 'RECKONING',    startTick: 432,  activeBots: 4, incomeHit: -700,  accent: '#FF3800' },
  { wave: 5, label: 'ANNIHILATION', startTick: 576,  activeBots: 5, incomeHit: -1100, accent: '#FF0000' },
];

function getCurrentWave(tick: number): number {
  for (let i = WAVE_DEFS.length - 1; i >= 0; i--) {
    if (tick >= WAVE_DEFS[i].startTick) return WAVE_DEFS[i].wave;
  }
  return 1;
}

const BOT_NAMES = [
  'LIQUIDATOR', 'BUREAUCRAT', 'MANIPULATOR', 'CRASH PROPHET', 'LEGACY HEIR',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${sign}$${(v / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function WaveProgress({ tick, totalTicks }: { tick: number; totalTicks: number }) {
  const currentWave = getCurrentWave(tick);

  return (
    <div className="bg-[#0D0900] border border-[#FFB80033] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#FFB800] text-xs font-bold tracking-widest uppercase">Wave Progression</span>
        <span className="text-[#888] text-xs font-mono">T{tick}/{totalTicks}</span>
      </div>
      <div className="space-y-2">
        {WAVE_DEFS.map((w) => {
          const isActive  = w.wave === currentWave;
          const isPast    = w.wave < currentWave;
          const isFuture  = w.wave > currentWave;
          const progress  = isActive
            ? ((tick - w.startTick) / (WAVE_DEFS[w.wave]?.startTick ?? totalTicks - w.startTick)) * 100
            : isPast ? 100 : 0;

          return (
            <div key={w.wave} className="flex items-center gap-3">
              {/* Wave number */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                style={{
                  background: isPast ? w.accent + '33' : isActive ? w.accent + '22' : '#111',
                  border: `1px solid ${isPast || isActive ? w.accent : '#333'}`,
                  color: isPast ? w.accent : isActive ? w.accent : '#444',
                }}
              >
                {isPast ? '✓' : w.wave}
              </div>

              {/* Bar + label */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span
                    className="text-xs font-bold tracking-widest"
                    style={{ color: isActive ? w.accent : isPast ? '#666' : '#333' }}
                  >
                    {w.label}
                  </span>
                  {w.incomeHit < 0 && (
                    <span className="text-[10px] font-mono" style={{ color: isActive ? '#FF6060' : '#444' }}>
                      {fmt(w.incomeHit)}/mo
                    </span>
                  )}
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, progress)}%`,
                      background: w.accent,
                      boxShadow: isActive ? `0 0 8px ${w.accent}` : 'none',
                    }}
                  />
                </div>
              </div>

              {/* Bot count */}
              <div className="flex gap-0.5 shrink-0">
                {Array.from({ length: w.activeBots }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isPast || isActive ? '#FF4444' : '#222',
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BotStatusGrid({
  modeState,
  activeBotCount,
  haterHeat,
}: {
  modeState: GameModeState | null;
  activeBotCount: number;
  haterHeat: number;
}) {
  const empire = modeState?.empire;

  return (
    <div className="bg-[#0D0900] border border-[#FFB80033] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#FFB800] text-xs font-bold tracking-widest uppercase">Adversarial Systems</span>
        <span className="text-xs font-mono" style={{ color: haterHeat > 70 ? '#FF4444' : '#888' }}>
          HEAT {Math.round(haterHeat)}%
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {BOT_NAMES.map((name, i) => {
          const isActive = i < activeBotCount;
          const isDangerous = empire?.highestBotThreat?.toUpperCase().includes(name.split(' ')[0]);
          return (
            <div
              key={name}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-all"
              style={{
                borderColor: isDangerous ? '#FF444488' : isActive ? '#FF444433' : '#1a1a1a',
                background: isDangerous ? '#FF00001a' : isActive ? '#0D0400' : '#0a0a0a',
              }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: isDangerous ? '#FF2222' : isActive ? '#FF6600' : '#333',
                  boxShadow: isActive ? `0 0 6px ${isDangerous ? '#FF2222' : '#FF6600'}` : 'none',
                }}
              />
              <span
                className="text-xs font-bold tracking-wider flex-1"
                style={{ color: isActive ? '#ddd' : '#444' }}
              >
                {name}
              </span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{
                  color: isDangerous ? '#FF4444' : isActive ? '#FF9900' : '#333',
                  background: isDangerous ? '#FF000022' : isActive ? '#FF660011' : 'transparent',
                  border: `1px solid ${isDangerous ? '#FF444444' : isActive ? '#FF660022' : '#222'}`,
                }}
              >
                {isDangerous ? 'TARGETING' : isActive ? 'ACTIVE' : 'DORMANT'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MomentumEngine({ momentumScore }: { momentumScore: number }) {
  const pct = Math.min(100, Math.max(0, momentumScore));
  const cascadeReady = pct >= 60;

  return (
    <div className="bg-[#0D0900] border border-[#FFB80033] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#FFB800] text-xs font-bold tracking-widest uppercase">Momentum Engine</span>
        {cascadeReady && (
          <span className="text-xs font-bold text-emerald-400 animate-pulse">CASCADE READY</span>
        )}
      </div>

      {/* Big momentum number */}
      <div className="text-center mb-3">
        <span
          className="text-4xl font-black"
          style={{
            color: pct >= 60 ? '#00E5A0' : pct >= 30 ? '#FFB800' : '#FF4444',
            textShadow: pct >= 60 ? '0 0 30px #00E5A055' : 'none',
          }}
        >
          {Math.round(pct)}
        </span>
        <span className="text-[#666] text-sm ml-1">/ 100</span>
      </div>

      {/* Bar */}
      <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 60
              ? 'linear-gradient(90deg, #00B880, #00E5A0)'
              : pct >= 30
              ? 'linear-gradient(90deg, #CC8800, #FFB800)'
              : 'linear-gradient(90deg, #882200, #FF4444)',
            boxShadow: pct >= 60 ? '0 0 12px #00E5A066' : 'none',
          }}
        />
      </div>

      {/* Cascade threshold marker */}
      <div className="relative h-1 mb-2">
        <div className="absolute" style={{ left: '60%', transform: 'translateX(-50%)' }}>
          <div className="w-px h-3 bg-[#FFB80088] -mt-1" />
          <span className="text-[9px] text-[#FFB80088] font-mono whitespace-nowrap -ml-4">CASCADE ≥60</span>
        </div>
      </div>

      <div className="text-[10px] text-[#666] text-center mt-3">
        {pct >= 60 ? 'Positive cascade chain unlocked — income multiplier active'
         : pct >= 30 ? 'Building — sustain positive cashflow to reach cascade threshold'
         : 'Critical — expenses exceeding income. Momentum collapsing.'}
      </div>
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface EmpireGameScreenProps {
  cash: number;
  income: number;
  expenses: number;
  netWorth: number;
  shields: number;
  shieldConsuming: boolean;
  tick: number;
  totalTicks: number;
  freezeTicks: number;
  regime: MarketRegime;
  intelligence: IntelligenceState;
  equityHistory: number[];
  hand: Card[];
  onPlayCard: (cardId: string) => void;
  threats: Threat[];
  onMitigate: (threatId: string) => void;
  events: string[];
  modeState: GameModeState | null;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function EmpireGameScreen({
  cash, income, expenses, netWorth, shields, shieldConsuming,
  tick, totalTicks, freezeTicks, regime, intelligence, equityHistory,
  hand, onPlayCard, threats, onMitigate, events, modeState,
}: EmpireGameScreenProps) {
  const empire       = modeState?.empire;
  const currentWave  = getCurrentWave(tick);
  const activeBots   = empire?.activeBotCount  ?? Math.min(5, currentWave);
  const momentum     = empire?.momentumScore   ?? Math.max(0, ((income - expenses) / Math.max(1, income)) * 100);
  const haterHeat    = empire?.haterHeat       ?? 0;
  const cascadeCount = empire?.cascadeChainCount ?? 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0A0700 0%, #0D0900 50%, #080600 100%)' }}
    >
      {/* ── Mode Banner ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ borderColor: '#FFB80022', background: '#0D090088' }}
      >
        <div
          className="px-3 py-1 rounded text-xs font-black tracking-widest"
          style={{ background: '#FFB80022', border: '1px solid #FFB80044', color: '#FFB800' }}
        >
          ⚡ EMPIRE
        </div>
        <span className="text-[#888] text-xs">Build income that works while you sleep — or lose everything.</span>
        <div className="ml-auto flex items-center gap-4 text-xs font-mono">
          <span style={{ color: cascadeCount > 0 ? '#00E5A0' : '#444' }}>
            {cascadeCount} CASCADE{cascadeCount !== 1 ? 'S' : ''}
          </span>
          <span style={{ color: haterHeat > 60 ? '#FF4444' : '#888' }}>
            HEAT {Math.round(haterHeat)}
          </span>
          <ShieldIcons count={shields} consuming={shieldConsuming} />
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 p-4 space-y-4">

        {/* Top row: Wave + Bots */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WaveProgress tick={tick} totalTicks={totalTicks} />
          <BotStatusGrid
            modeState={modeState}
            activeBotCount={activeBots}
            haterHeat={haterHeat}
          />
        </div>

        {/* Middle row: Momentum + Card Hand */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <MomentumEngine momentumScore={momentum} />

          {/* Card Hand */}
          <div className="bg-[#0D0900] border border-[#FFB80033] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#FFB800] text-xs font-bold tracking-widest uppercase">Strategic Hand</span>
              <span className="text-[#666] text-xs">Play cards to shift cashflow</span>
            </div>
            <CardHand cards={hand} playerEnergy={cash} onPlayCard={onPlayCard} onCardHover={() => {}} />
          </div>
        </div>

        {/* GameBoard + ThreatRadar */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.6fr] gap-4">
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
          <ThreatRadarPanel
            threats={threats}
            tick={tick}
            onMitigate={onMitigate}
          />
        </div>
      </div>

      {/* ── Moment Flash ────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 w-80 z-50 pointer-events-none">
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}
