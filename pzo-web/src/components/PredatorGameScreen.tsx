/**
 * PredatorGameScreen.tsx — ASYMMETRIC PvP / PREDATOR mode
 * Theme: Blood Red / Combat. Sabotage arsenal. Counterplay windows. Combo system.
 * Engine: modeState.predator — wired to BattleEngine + ShieldEngine
 * Density6 LLC · Confidential
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030005',
  surface: '#0A0008',
  card:    '#100008',
  red:     '#FF4D4D',
  redDim:  '#CC1111',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  green:   '#22DD88',
  blue:    '#4488FF',
  text:    '#F2F2FF',
  textSub: '#AA8888',
  textMut: '#4A2828',
  mono:    "'IBM Plex Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Sabotage catalog ─────────────────────────────────────────────────────────
const SABOTAGE_CATALOG = [
  { id:'FREEZE_INCOME',    icon:'🧊', label:'FREEZE INCOME',    desc:'Stops income 3 ticks',    threat:'HIGH' },
  { id:'PHANTOM_EXPENSE',  icon:'👻', label:'PHANTOM EXPENSE',  desc:'Injects surprise cost',    threat:'MED'  },
  { id:'CREDIT_LOCK',      icon:'🔒', label:'CREDIT LOCK',      desc:'Destroys L2 shield',       threat:'HIGH' },
  { id:'MARKET_RUMOR',     icon:'📡', label:'MARKET RUMOR',     desc:'Raises hater heat +20',    threat:'MED'  },
  { id:'AUDIT_TRIGGER',    icon:'📋', label:'AUDIT TRIGGER',    desc:'Drains cash $5K',          threat:'CRIT' },
  { id:'SHIELD_CORRODE',   icon:'🔥', label:'SHIELD CORRODE',   desc:'Erodes shields 8/tick',    threat:'CRIT' },
  { id:'OPPORTUNITY_SNIPE',icon:'🎯', label:'OPP SNIPE',        desc:'Steals income boost',      threat:'MED'  },
  { id:'DEBT_INJECTION',   icon:'💉', label:'DEBT INJECTION',   desc:'Forces negative cashflow', threat:'CRIT' },
] as const;

const THREAT_COLORS: Record<string, string> = {
  CRIT: '#FF2222', HIGH: '#FF8800', MED: '#FFD700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v/1e6).toFixed(2)}M`;
  if (v >= 1_000)     return `${s}$${(v/1e3).toFixed(1)}K`;
  return `${s}$${Math.round(v).toLocaleString()}`;
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ children, style = {}, urgent = false }: {
  children: React.ReactNode; style?: React.CSSProperties; urgent?: boolean;
}) {
  return (
    <div style={{
      background: T.card, borderRadius:12,
      border: `1px solid ${urgent ? 'rgba(255,77,77,0.30)' : 'rgba(255,77,77,0.10)'}`,
      padding: 16,
      boxShadow: urgent ? '0 0 24px rgba(255,77,77,0.08) inset' : 'none',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Label({ children, color = T.red }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize:10, fontFamily:T.mono, fontWeight:700,
      letterSpacing:'0.2em', textTransform:'uppercase',
      color, marginBottom:12,
    }}>
      {children}
    </div>
  );
}

// ─── Combo Meter ──────────────────────────────────────────────────────────────
function ComboMeter({ comboCount }: { comboCount: number }) {
  const pct   = Math.min(100, comboCount * 25);
  const color = comboCount >= 3 ? '#FF2222' : comboCount >= 2 ? '#FF8800' : '#FFD700';
  const label = comboCount === 0 ? 'NO COMBO' : `${comboCount}× COMBO`;

  return (
    <Panel urgent={comboCount >= 2}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <Label>Hater Combo</Label>
        <span style={{
          fontSize:14, fontWeight:800, fontFamily:T.display, color,
          textShadow: comboCount >= 3 ? `0 0 20px ${color}` : 'none',
          transition:'all 0.3s ease',
        }}>
          {label}
        </span>
      </div>

      <div style={{ height:10, background:'#1A000A', borderRadius:6, overflow:'hidden', marginBottom:8 }}>
        <div style={{
          height:'100%', borderRadius:6,
          width:`${pct}%`,
          background:`linear-gradient(90deg, #882222, ${color})`,
          boxShadow: comboCount > 0 ? `0 0 12px ${color}55` : 'none',
          transition:'width 0.5s ease',
        }} />
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, fontFamily:T.mono, color:T.textMut }}>
        <span>+0%</span><span>+25%</span><span>+50%</span><span>+75%</span>
        <span style={{ color:'#FF2222' }}>+100%</span>
      </div>

      {comboCount >= 2 && (
        <div style={{
          marginTop:10, fontSize:11, color:'#FF7070', textAlign:'center',
          fontFamily:T.mono, fontWeight:600,
        }}>
          ⚠ Each unblocked attack now deals +{comboCount * 25}% damage
        </div>
      )}
    </Panel>
  );
}

// ─── Sabotage Arsenal ─────────────────────────────────────────────────────────
function SabotageArsenal({
  counterplayOpen, counterplayTicksLeft,
}: {
  counterplayOpen: boolean; counterplayTicksLeft: number;
}) {
  return (
    <Panel>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <Label>Hater Arsenal</Label>
        {counterplayOpen && (
          <span style={{
            fontSize:11, fontFamily:T.mono, fontWeight:700, color:T.orange,
            padding:'4px 10px', borderRadius:6,
            background:'rgba(255,140,0,0.12)', border:'1px solid rgba(255,140,0,0.30)',
          }}>
            ⚡ COUNTERPLAY — {counterplayTicksLeft} TICKS
          </span>
        )}
      </div>

      <div style={{
        display:'grid', gap:8,
        gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))',
      }}>
        {SABOTAGE_CATALOG.map((card) => {
          const col = THREAT_COLORS[card.threat];
          return (
            <div key={card.id} style={{
              padding:'10px 12px', borderRadius:8,
              border:`1px solid ${col}33`,
              background:`${col}08`,
              transition:'transform 0.15s ease',
            }}>
              <div style={{ fontSize:22, marginBottom:6, lineHeight:1 }}>{card.icon}</div>
              <div style={{
                fontSize:9, fontFamily:T.mono, fontWeight:700,
                letterSpacing:'0.08em', textTransform:'uppercase',
                color:col, marginBottom:4, lineHeight:1.3,
              }}>
                {card.label}
              </div>
              <div style={{ fontSize:10, color:T.textSub, lineHeight:1.4, marginBottom:6 }}>
                {card.desc}
              </div>
              <div style={{
                display:'inline-block', fontSize:8, fontFamily:T.mono, fontWeight:700,
                padding:'2px 6px', borderRadius:3,
                color:`${col}CC`, background:`${col}14`, border:`1px solid ${col}28`,
              }}>
                {card.threat}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Shield Status ────────────────────────────────────────────────────────────
function ShieldStatus({ shields, shieldConsuming }: { shields: number; shieldConsuming: boolean }) {
  const LAYERS = ['L1 LIQUIDITY', 'L2 CREDIT', 'L3 ASSET', 'L4 NETWORK'];
  const pct    = (shields / 4) * 100;
  const barColor = shields > 2
    ? 'linear-gradient(90deg, #224488, #4488FF)'
    : shields > 1
    ? 'linear-gradient(90deg, #886600, #FFD700)'
    : 'linear-gradient(90deg, #882200, #FF4444)';

  return (
    <Panel urgent={shields === 0}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <Label>Shield Status</Label>
        <ShieldIcons count={shields} consuming={shieldConsuming} />
      </div>

      <div style={{
        display:'grid', gap:8, marginBottom:12,
        gridTemplateColumns:'repeat(4, 1fr)',
      }}>
        {LAYERS.map((name, i) => {
          const intact = i < shields;
          return (
            <div key={name} style={{
              padding:'10px 6px', borderRadius:8, textAlign:'center',
              border:`1px solid ${intact ? 'rgba(68,136,255,0.30)' : 'rgba(255,34,34,0.25)'}`,
              background: intact ? 'rgba(0,0,80,0.20)' : 'rgba(30,0,0,0.30)',
            }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{intact ? '🛡' : '💀'}</div>
              <div style={{
                fontSize:8, fontFamily:T.mono, fontWeight:700,
                color: intact ? '#6699FF' : '#FF5555',
                letterSpacing:'0.08em',
              }}>
                {name.split(' ')[0]}
              </div>
              <div style={{ fontSize:8, color: intact ? '#4466BB' : '#882222', fontFamily:T.mono }}>
                {intact ? 'INTACT' : 'BREACH'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height:6, background:'#1A0010', borderRadius:4, overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:4, width:`${pct}%`,
          background: barColor, transition:'width 0.7s ease',
        }} />
      </div>

      {shields === 0 && (
        <div style={{
          marginTop:10, textAlign:'center', fontSize:12,
          fontFamily:T.mono, fontWeight:700, color:'#FF2222',
          letterSpacing:'0.05em',
        }}>
          ⚠ ALL SHIELDS BREACHED — ONE HIT = BANKRUPTCY
        </div>
      )}
    </Panel>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface PendingCounterplay {
  eventLabel: string; eventDescription: string; eventEmoji: string;
  ticksToRespond: number; actions: CounterplayAction[];
  onChoose: (actionId: string) => void; onIgnore: () => void;
}

export interface PredatorGameScreenProps {
  cash: number; income: number; expenses: number; netWorth: number;
  shields: number; shieldConsuming: boolean;
  tick: number; totalTicks: number; freezeTicks: number;
  regime: MarketRegime; intelligence: IntelligenceState;
  equityHistory: number[]; events: string[];
  modeState: GameModeState | null;
  battlePhase: BattlePhase; battleParticipants: BattleParticipant[];
  battleScore: { local: number; opponent: number }; battleRound: number;
  activeSabotages: ActiveSabotage[]; pendingCounterplay: PendingCounterplay | null;
  onForfeit: () => void; onCounterplay: (id: string) => void;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PredatorGameScreen({
  cash, income, expenses, netWorth, shields, shieldConsuming,
  tick, totalTicks, freezeTicks, regime, intelligence, equityHistory,
  events, modeState, battlePhase, battleParticipants,
  battleScore, battleRound, activeSabotages, pendingCounterplay,
  onForfeit, onCounterplay,
}: PredatorGameScreenProps) {
  const predator      = modeState?.predator;
  const combo         = predator?.haterComboCount      ?? 0;
  const cpOpen        = predator?.counterplayWindow    ?? false;
  const cpTicks       = predator?.counterplayTicksLeft ?? 0;
  const phase         = predator?.phase                ?? 'early';
  const cashflow      = income - expenses;

  const phaseLabel: Record<string, string> = {
    early: 'EARLY GAME', mid: 'MID GAME', endgame: 'ENDGAME',
  };
  const phaseColor = phase === 'endgame' ? T.red : T.orange;

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      background:'linear-gradient(160deg, #050002 0%, #0A0005 60%, #060003 100%)',
      fontFamily:T.display,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Sticky Header ── */}
      <header style={{
        position:'sticky', top:0, zIndex:100,
        background:'rgba(5,0,2,0.94)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid rgba(255,77,77,0.14)',
        padding:'10px clamp(12px,4vw,24px)',
        display:'flex', alignItems:'center', flexWrap:'wrap', gap:'8px 20px',
      }}>
        <div style={{
          padding:'5px 12px', borderRadius:6, fontSize:10,
          fontFamily:T.mono, fontWeight:700, letterSpacing:'0.2em',
          background:'rgba(255,77,77,0.12)', border:'1px solid rgba(255,77,77,0.30)',
          color:T.red,
        }}>
          ⚔️ PREDATOR
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 18px', fontSize:12, fontFamily:T.mono }}>
          <span style={{ color: cashflow >= 0 ? T.green : T.red, fontWeight:700 }}>
            CF {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
          </span>
          <span style={{ color:T.text }}>NW {fmt(netWorth)}</span>
          <span style={{ color: combo >= 2 ? T.red : T.textSub }}>
            COMBO {combo}×
          </span>
        </div>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{
            fontSize:11, fontFamily:T.mono, fontWeight:700,
            color: phaseColor, padding:'3px 8px', borderRadius:4,
            background:`${phaseColor}14`, border:`1px solid ${phaseColor}28`,
          }}>
            {phaseLabel[phase]}
          </span>
          <span style={{ fontSize:11, fontFamily:T.mono, color:T.textMut }}>
            T{tick}/{totalTicks}
          </span>
        </div>
      </header>

      {/* ── Battle HUD ── */}
      <div style={{ padding:'14px clamp(12px,3vw,20px) 0' }}>
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

      {/* ── Main content ── */}
      <div style={{ flex:1, padding:'clamp(12px,3vw,20px)', display:'flex', flexDirection:'column', gap:14 }}>

        {/* Combo + Shield */}
        <div style={{
          display:'grid', gap:14,
          gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
        }}>
          <ComboMeter comboCount={combo} />
          <ShieldStatus shields={shields} shieldConsuming={shieldConsuming} />
        </div>

        {/* Sabotage arsenal */}
        <SabotageArsenal counterplayOpen={cpOpen} counterplayTicksLeft={cpTicks} />

        {/* Active sabotages */}
        {activeSabotages.length > 0 && (
          <Panel>
            <SabotageImpactPanel
              activeSabotages={activeSabotages}
              tick={tick}
              onCounterplay={onCounterplay}
            />
          </Panel>
        )}

        {/* GameBoard */}
        <GameBoard
          equityHistory={equityHistory} cash={cash} netWorth={netWorth}
          income={income} expenses={expenses} regime={regime}
          intelligence={intelligence} tick={tick} totalTicks={totalTicks}
          freezeTicks={freezeTicks}
        />

      </div>

      {/* ── Counterplay Modal ── */}
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

      {/* ── Moment Flash ── */}
      <div style={{
        position:'fixed', bottom:16, right:16, width:320, zIndex:200, pointerEvents:'none',
      }}>
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}