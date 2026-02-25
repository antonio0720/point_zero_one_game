/**
 * PredatorGameScreen.tsx — ASYMMETRIC PvP mode game screen
 * Theme: Red / Combat. Sabotage cards. Counterplay windows. Hater combo system.
 * Builder vs a relentless Hater. Block or bleed.
 */

import React from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { BattleHUD } from './BattleHUD';
import type { BattlePhase, BattleParticipant } from './BattleHUD';
import { CounterplayModal } from './CounterplayModal';
import type { CounterplayAction } from './CounterplayModal';
import { SabotageImpactPanel } from './SabotageImpactPanel';
import type { ActiveSabotage } from './SabotageImpactPanel';
import ShieldIcons from './ShieldIcons';
import MomentFlash from './MomentFlash';
import type { GameModeState } from '../engines/core/types';

// ─── Sabotage card display data ──────────────────────────────────────────────

const SABOTAGE_CATALOG = [
  { id: 'FREEZE_INCOME',    label: 'FREEZE INCOME',    icon: '🧊', desc: 'Stops income 3 ticks',    cooldown: 36, threat: 'HIGH'   },
  { id: 'PHANTOM_EXPENSE',  label: 'PHANTOM EXPENSE',  icon: '👻', desc: 'Injects surprise cost',    cooldown: 24, threat: 'MED'    },
  { id: 'CREDIT_LOCK',      label: 'CREDIT LOCK',      icon: '🔒', desc: 'Destroys L2 shield',       cooldown: 48, threat: 'HIGH'   },
  { id: 'MARKET_RUMOR',     label: 'MARKET RUMOR',     icon: '📡', desc: 'Raises hater heat +20',    cooldown: 18, threat: 'MED'    },
  { id: 'AUDIT_TRIGGER',    label: 'AUDIT TRIGGER',    icon: '📋', desc: 'Drains cash $5K',          cooldown: 54, threat: 'CRIT'   },
  { id: 'SHIELD_CORRODE',   label: 'SHIELD CORRODE',   icon: '🔥', desc: 'Erodes shields 8/tick',    cooldown: 42, threat: 'CRIT'   },
  { id: 'OPPORTUNITY_SNIPE',label: 'OPP SNIPE',        icon: '🎯', desc: 'Steals income boost',      cooldown: 30, threat: 'MED'    },
  { id: 'DEBT_INJECTION',   label: 'DEBT INJECTION',   icon: '💉', desc: 'Forces negative cashflow', cooldown: 72, threat: 'CRIT'   },
] as const;

const THREAT_COLOR: Record<string, string> = {
  'CRIT': '#FF2222',
  'HIGH': '#FF8800',
  'MED':  '#FFDD00',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${sign}$${(v / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ComboMeter({ comboCount }: { comboCount: number }) {
  const pct   = Math.min(100, comboCount * 25);   // 4 combos = 100%
  const label = comboCount === 0 ? 'NO COMBO' : `${comboCount}× COMBO`;
  const color = comboCount >= 3 ? '#FF2222' : comboCount >= 2 ? '#FF8800' : '#FFDD00';

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: '#0D0000', borderColor: '#FF303033' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#FF3030] text-xs font-bold tracking-widest uppercase">Hater Combo</span>
        <span
          className="text-sm font-black"
          style={{ color, textShadow: comboCount >= 3 ? `0 0 16px ${color}` : 'none' }}
        >
          {label}
        </span>
      </div>
      <div className="h-3 bg-[#1a0000] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #882222, ${color})`,
            boxShadow: comboCount > 0 ? `0 0 10px ${color}66` : 'none',
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-[#444] font-mono">
        <span>+0%</span>
        <span>+25%</span>
        <span>+50%</span>
        <span>+75%</span>
        <span className="text-[#FF2222]">+100%</span>
      </div>
      {comboCount >= 2 && (
        <div className="mt-2 text-[10px] text-[#FF6060] text-center animate-pulse">
          EACH UNBLOCKED ATTACK NOW +{comboCount * 25}% DAMAGE
        </div>
      )}
    </div>
  );
}

function SabotageArsenal({
  counterplayOpen,
  counterplayTicksLeft,
}: {
  counterplayOpen: boolean;
  counterplayTicksLeft: number;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: '#0D0000', borderColor: '#FF303033' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#FF3030] text-xs font-bold tracking-widest uppercase">Hater Arsenal</span>
        {counterplayOpen && (
          <span className="text-xs font-black text-[#FF8800] animate-pulse">
            ⚡ COUNTERPLAY {counterplayTicksLeft} TICKS
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SABOTAGE_CATALOG.map((card) => (
          <div
            key={card.id}
            className="rounded-lg p-2 border text-center transition-all hover:scale-[1.02]"
            style={{
              borderColor: THREAT_COLOR[card.threat] + '44',
              background: THREAT_COLOR[card.threat] + '08',
            }}
          >
            <div className="text-2xl mb-1">{card.icon}</div>
            <div
              className="text-[9px] font-black tracking-wider uppercase leading-tight"
              style={{ color: THREAT_COLOR[card.threat] }}
            >
              {card.label}
            </div>
            <div className="text-[8px] text-[#666] mt-1 leading-tight">{card.desc}</div>
            <div
              className="text-[8px] font-mono mt-1 px-1 py-0.5 rounded inline-block"
              style={{
                color: THREAT_COLOR[card.threat] + 'cc',
                background: THREAT_COLOR[card.threat] + '11',
                border: `1px solid ${THREAT_COLOR[card.threat]}33`,
              }}
            >
              {card.threat}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShieldStatus({ shields, shieldConsuming }: { shields: number; shieldConsuming: boolean }) {
  const pct = (shields / 4) * 100;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: '#0D0000', borderColor: shields <= 1 ? '#FF222244' : '#FF303033' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#FF3030] text-xs font-bold tracking-widest uppercase">Shield Status</span>
        <ShieldIcons count={shields} consuming={shieldConsuming} />
      </div>

      {/* Big visual */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {['L1 LIQUIDITY', 'L2 CREDIT', 'L3 ASSET', 'L4 NETWORK'].map((label, i) => {
          const intact = i < shields;
          return (
            <div
              key={label}
              className="rounded-lg p-2 text-center border transition-all"
              style={{
                borderColor: intact ? '#3366FF44' : '#FF222244',
                background: intact ? '#00003D22' : '#1a000022',
              }}
            >
              <div className="text-xl mb-1">{intact ? '🛡️' : '💀'}</div>
              <div className="text-[8px] font-bold" style={{ color: intact ? '#6699FF' : '#FF4444' }}>
                {label.split(' ')[0]}
              </div>
              <div className="text-[8px]" style={{ color: intact ? '#6699FF88' : '#FF444488' }}>
                {intact ? 'INTACT' : 'BREACHED'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-2 bg-[#1a0000] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: shields > 2 ? 'linear-gradient(90deg, #3344CC, #6699FF)'
              : shields > 1 ? 'linear-gradient(90deg, #886600, #FFDD00)'
              : 'linear-gradient(90deg, #882200, #FF4444)',
          }}
        />
      </div>

      {shields === 0 && (
        <div className="mt-2 text-center text-xs font-black text-[#FF2222] animate-pulse">
          ALL SHIELDS BREACHED — ONE HIT = BANKRUPTCY
        </div>
      )}
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PendingCounterplay {
  eventLabel: string;
  eventDescription: string;
  eventEmoji: string;
  ticksToRespond: number;
  actions: CounterplayAction[];
  onChoose: (actionId: string) => void;
  onIgnore: () => void;
}

export interface PredatorGameScreenProps {
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
  events: string[];
  modeState: GameModeState | null;
  battlePhase: BattlePhase;
  battleParticipants: BattleParticipant[];
  battleScore: { local: number; opponent: number };
  battleRound: number;
  activeSabotages: ActiveSabotage[];
  pendingCounterplay: PendingCounterplay | null;
  onForfeit: () => void;
  onCounterplay: (sabotageId: string) => void;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PredatorGameScreen({
  cash, income, expenses, netWorth, shields, shieldConsuming,
  tick, totalTicks, freezeTicks, regime, intelligence, equityHistory,
  events, modeState,
  battlePhase, battleParticipants, battleScore, battleRound,
  activeSabotages, pendingCounterplay,
  onForfeit, onCounterplay,
}: PredatorGameScreenProps) {
  const predator          = modeState?.predator;
  const comboCount        = predator?.haterComboCount       ?? 0;
  const counterplayOpen   = predator?.counterplayWindow     ?? false;
  const counterplayTicks  = predator?.counterplayTicksLeft  ?? 0;
  const phase             = predator?.phase                 ?? 'early';

  const phaseLabel: Record<string, string> = {
    early: 'EARLY GAME',
    mid:   'MID GAME',
    endgame: 'ENDGAME',
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0D0000 0%, #120000 50%, #080000 100%)' }}
    >
      {/* ── Mode Banner ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ borderColor: '#FF303022', background: '#0D000088' }}
      >
        <div
          className="px-3 py-1 rounded text-xs font-black tracking-widest"
          style={{ background: '#FF303022', border: '1px solid #FF303044', color: '#FF3030' }}
        >
          ⚔️ PREDATOR
        </div>
        <span className="text-[#888] text-xs">Your income is a target. Your shields are burning. Block or lose.</span>
        <div className="ml-auto flex items-center gap-4 text-xs font-mono">
          <span
            className="px-2 py-0.5 rounded font-bold"
            style={{
              color: phase === 'endgame' ? '#FF2222' : '#FF8800',
              background: '#FF000011',
              border: '1px solid #FF444422',
            }}
          >
            {phaseLabel[phase] ?? phase.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── Battle HUD (full width, dominant) ───────────────────────── */}
      <div className="px-4 pt-4">
        <BattleHUD
          phase={battlePhase}
          participants={battleParticipants}
          ticksRemaining={Math.max(0, totalTicks - tick)}
          roundNumber={battleRound}
          totalRounds={12}
          localScore={battleScore.local}
          opponentScore={battleScore.opponent}
          onForfeit={onForfeit}
        />
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 p-4 space-y-4">

        {/* Combo + Shield Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ComboMeter comboCount={comboCount} />
          <ShieldStatus shields={shields} shieldConsuming={shieldConsuming} />
        </div>

        {/* Sabotage Arsenal */}
        <SabotageArsenal
          counterplayOpen={counterplayOpen}
          counterplayTicksLeft={counterplayTicks}
        />

        {/* Active Sabotages */}
        {activeSabotages.length > 0 && (
          <div
            className="rounded-xl border p-3"
            style={{ background: '#0D0000', borderColor: '#FF303033' }}
          >
            <SabotageImpactPanel
              activeSabotages={activeSabotages}
              tick={tick}
              onCounterplay={onCounterplay}
            />
          </div>
        )}

        {/* GameBoard */}
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

      {/* ── Counterplay Modal ────────────────────────────────────────── */}
      {pendingCounterplay && (
        <CounterplayModal
          eventLabel={pendingCounterplay.eventLabel}
          eventDescription={pendingCounterplay.eventDescription}
          eventEmoji={pendingCounterplay.eventEmoji}
          ticksToRespond={pendingCounterplay.ticksToRespond}
          actions={pendingCounterplay.actions}
          cash={cash}
          onChoose={pendingCounterplay.onChoose}
          onIgnore={pendingCounterplay.onIgnore}
        />
      )}

      {/* ── Moment Flash ────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 w-80 z-50 pointer-events-none">
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}
