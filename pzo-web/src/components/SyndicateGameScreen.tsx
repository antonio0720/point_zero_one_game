/**
 * SyndicateGameScreen.tsx — CO-OP / SYNDICATE mode
 * Theme: Teal Alliance. Partner panels. Synergy engine. Rescue windows. Aid contracts.
 * Engine: modeState.syndicate — SyndicateEngine + rescue events
 * Density6 LLC · Confidential
 */

import React, { useState } from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { RescueWindowBanner } from './RescueWindowBanner';
import { AidContractComposer } from './AidContractComposer';
import type { AidContract } from './AidContractComposer';
import ShieldIcons from './ShieldIcons';
import MomentFlash from './MomentFlash';
import type { GameModeState } from '../engines/core/types';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030A08',
  surface: '#06120F',
  card:    '#0A1A16',
  teal:    '#00D4B8',
  tealDim: '#007766',
  green:   '#22DD88',
  red:     '#FF4D4D',
  orange:  '#FF8C00',
  text:    '#F0FFFC',
  textSub: '#6A9A92',
  textMut: '#1E3830',
  mono:    "'IBM Plex Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v/1e6).toFixed(2)}M`;
  if (v >= 1_000)     return `${s}$${(v/1e3).toFixed(1)}K`;
  return `${s}$${Math.round(v).toLocaleString()}`;
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ children, style = {}, accent = T.teal }: {
  children: React.ReactNode; style?: React.CSSProperties; accent?: string;
}) {
  return (
    <div style={{
      background: T.card, borderRadius: 12,
      border: `1px solid rgba(0,212,184,0.12)`,
      padding: 16, ...style,
    }}>
      {children}
    </div>
  );
}

function Label({ children, color = T.teal }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: T.mono, fontWeight: 700,
      letterSpacing: '0.2em', textTransform: 'uppercase',
      color, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ─── Synergy Bar ──────────────────────────────────────────────────────────────
function SynergyBar({ synergyBonus, combinedNW }: { synergyBonus: number; combinedNW: number }) {
  // synergyBonus: 1.0 = neutral, 2.0 = +100% (max)
  const score  = Math.max(0, Math.min(200, (synergyBonus - 1.0) * 200));
  const pct    = score / 2;   // 0–100 display
  const bonus  = Math.max(0, (synergyBonus - 1.0) * 100);
  const color  = score >= 150 ? T.teal : score >= 80 ? '#00BBAA' : score >= 40 ? T.orange : T.red;

  return (
    <Panel>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <Label>Synergy Engine</Label>
        <span style={{ fontSize:11, fontFamily:T.mono, color:T.textSub }}>
          Combined NW: {fmt(combinedNW)}
        </span>
      </div>

      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:14 }}>
        <span style={{
          fontSize:'clamp(2.4rem, 5vw, 3.2rem)', fontWeight:800,
          fontFamily:T.display, color,
          textShadow: score >= 150 ? `0 0 36px ${color}66` : 'none',
          transition:'all 0.5s ease',
        }}>
          {Math.round(score)}
        </span>
        <span style={{ color:T.textMut, fontSize:14, fontFamily:T.mono }}>/ 200</span>
        {bonus > 0 && (
          <span style={{
            fontSize:'clamp(1rem, 2.5vw, 1.3rem)', fontWeight:800, color:T.teal, fontFamily:T.display,
          }}>
            +{Math.round(bonus)}% INCOME
          </span>
        )}
      </div>

      <div style={{ height:12, background:'#001E18', borderRadius:6, overflow:'hidden', marginBottom:6, position:'relative' }}>
        <div style={{
          height:'100%', borderRadius:6, transition:'width 0.7s ease',
          width:`${pct}%`,
          background:`linear-gradient(90deg, #006655, ${color})`,
          boxShadow: score > 100 ? `0 0 18px ${color}55` : 'none',
        }} />
        {/* Neutral line at 50% */}
        <div style={{
          position:'absolute', top:0, left:'50%', height:'100%',
          width:1, background:'rgba(0,212,184,0.28)',
        }} />
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, fontFamily:T.mono, color:T.textMut, marginBottom:10 }}>
        <span>FRICTION</span><span>NEUTRAL</span><span style={{ color:T.teal }}>MAX +30%</span>
      </div>

      <p style={{
        fontSize:11, textAlign:'center', fontFamily:T.mono, lineHeight:1.5,
        color: score >= 100 ? T.teal : T.textSub,
      }}>
        {score >= 150 ? '🔥 APEX SYNERGY — Maximum income amplification active'
          : score >= 80 ? '📈 Strong alliance — synergy bonus building'
          : score >= 40 ? '⚠️ Moderate friction — coordinate your decisions'
          : '❌ Alliance strain — someone is bleeding your economy'}
      </p>
    </Panel>
  );
}

// ─── Partner Panel ────────────────────────────────────────────────────────────
function PartnerPanel({
  label, cash, income, expenses, netWorth, shieldPct, inDistress, isLocal,
}: {
  label: string; cash?: number; income: number; expenses: number;
  netWorth: number; shieldPct: number; inDistress: boolean; isLocal: boolean;
}) {
  const cashflow = income - expenses;
  const accent   = isLocal ? T.teal : '#7BFFE8';

  return (
    <div style={{
      background: T.card, borderRadius:12, padding:16, position:'relative', overflow:'hidden',
      border:`1px solid ${inDistress ? 'rgba(255,77,77,0.35)' : `rgba(0,212,184,${isLocal ? '0.20' : '0.12'})`}`,
    }}>
      {inDistress && (
        <div style={{
          position:'absolute', inset:0, borderRadius:12, pointerEvents:'none',
          background:'rgba(255,77,77,0.05)',
          border:'2px solid rgba(255,77,77,0.20)',
        }} />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{
          width:8, height:8, borderRadius:'50%',
          background: inDistress ? T.red : accent,
          boxShadow: `0 0 10px ${inDistress ? T.red : accent}`,
        }} />
        <span style={{
          fontSize:11, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.15em',
          color: inDistress ? T.red : accent, flex:1,
        }}>
          {label}
        </span>
        {inDistress && (
          <span style={{
            fontSize:9, fontFamily:T.mono, fontWeight:700, color:T.red,
            padding:'3px 8px', borderRadius:4,
            background:'rgba(255,77,77,0.12)', border:'1px solid rgba(255,77,77,0.28)',
          }}>
            🚨 DISTRESS
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {cash !== undefined && (
          <div style={{
            padding:'10px 12px', borderRadius:8,
            background:'rgba(0,30,22,0.60)', border:'1px solid rgba(0,212,184,0.10)',
          }}>
            <div style={{ fontSize:9, fontFamily:T.mono, color:T.textSub, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Cash</div>
            <div style={{ fontSize:14, fontFamily:T.mono, fontWeight:700, color: cash < 3000 ? T.red : T.text }}>
              {fmt(cash)}
            </div>
          </div>
        )}
        <div style={{
          padding:'10px 12px', borderRadius:8,
          background:'rgba(0,30,22,0.60)', border:'1px solid rgba(0,212,184,0.10)',
        }}>
          <div style={{ fontSize:9, fontFamily:T.mono, color:T.textSub, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Net Worth</div>
          <div style={{ fontSize:14, fontFamily:T.mono, fontWeight:700, color:T.text }}>{fmt(netWorth)}</div>
        </div>
        <div style={{
          padding:'10px 12px', borderRadius:8,
          background:'rgba(0,30,22,0.60)', border:'1px solid rgba(0,212,184,0.10)',
        }}>
          <div style={{ fontSize:9, fontFamily:T.mono, color:T.textSub, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Cashflow</div>
          <div style={{ fontSize:14, fontFamily:T.mono, fontWeight:700, color: cashflow >= 0 ? T.teal : T.red }}>
            {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
          </div>
        </div>
        <div style={{
          padding:'10px 12px', borderRadius:8,
          background:'rgba(0,30,22,0.60)', border:'1px solid rgba(0,212,184,0.10)',
        }}>
          <div style={{ fontSize:9, fontFamily:T.mono, color:T.textSub, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Shields</div>
          <div style={{ height:5, background:'#001510', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
            <div style={{
              height:'100%', borderRadius:3,
              width:`${shieldPct * 100}%`,
              background: shieldPct > 0.5 ? T.teal : shieldPct > 0.25 ? T.orange : T.red,
              transition:'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:accent }}>
            {Math.round(shieldPct * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Aid Contract List ────────────────────────────────────────────────────────
function AidContractList({ contracts }: {
  contracts: Array<{ id:string; type:string; status:string; terms:{ amount:number } }>;
}) {
  if (!contracts.length) return null;
  return (
    <Panel>
      <Label>Active Aid Contracts</Label>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {contracts.map((c) => (
          <div key={c.id} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'8px 12px', borderRadius:8, fontSize:12,
            background:'rgba(0,212,184,0.06)', border:'1px solid rgba(0,212,184,0.14)',
          }}>
            <span style={{ fontFamily:T.mono, fontWeight:700, color:T.teal }}>
              {c.type.replace(/_/g,' ')}
            </span>
            <span style={{ fontFamily:T.mono, color:T.textSub }}>{fmt(c.terms.amount)}</span>
            <span style={{
              fontSize:9, fontFamily:T.mono, fontWeight:700,
              padding:'2px 8px', borderRadius:4,
              color: c.status === 'ACTIVE' ? T.teal : T.textSub,
              background: c.status === 'ACTIVE' ? 'rgba(0,212,184,0.10)' : 'transparent',
              border:`1px solid ${c.status === 'ACTIVE' ? 'rgba(0,212,184,0.22)' : '#1E3830'}`,
            }}>
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AllianceMember { id:string; displayName:string; netWorth:number; }

export interface RescueWindowState {
  rescueeDisplayName:string; rescueeNetWorth:number; ticksRemaining:number;
  allianceName:string; contributionRequired:number; totalContributed:number;
}

export interface SyndicateGameScreenProps {
  cash:number; income:number; expenses:number; netWorth:number;
  shields:number; shieldConsuming:boolean;
  tick:number; totalTicks:number; freezeTicks:number;
  regime:MarketRegime; intelligence:IntelligenceState;
  equityHistory:number[]; events:string[];
  modeState:GameModeState | null;
  rescueWindow:RescueWindowState | null;
  allianceMembers:AllianceMember[];
  onAidSubmit:(c:AidContract)=>void;
  onRescueContribute:()=>void;
  onRescueDismiss:()=>void;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SyndicateGameScreen({
  cash, income, expenses, netWorth, shields, shieldConsuming,
  tick, totalTicks, freezeTicks, regime, intelligence, equityHistory,
  events, modeState, rescueWindow, allianceMembers,
  onAidSubmit, onRescueContribute, onRescueDismiss,
}: SyndicateGameScreenProps) {
  const [showAid, setShowAid] = useState(false);

  const syn           = modeState?.syndicate;
  const partnerIncome = syn?.partnerIncome     ?? 2100;
  const partnerExp    = income * 0.9;
  const partnerNW     = syn?.partnerNetWorth   ?? netWorth * 0.85;
  const partnerShield = syn?.partnerShieldPct  ?? 0.75;
  const partnerDist   = syn?.partnerInDistress ?? false;
  const rescueOpen    = syn?.rescueWindowOpen  ?? !!rescueWindow;
  const rescueTicks   = syn?.rescueWindowTicksLeft ?? rescueWindow?.ticksRemaining ?? 0;
  const synBonus      = syn?.synergyBonus      ?? 1.0;
  const combinedNW    = syn?.combinedNetWorth   ?? netWorth + partnerNW;
  const contracts     = syn?.activeAidContracts ?? [];
  const shieldPct     = shields / 4;
  const cashflow      = income - expenses;

  const localDistress = cash < 3000 || (income / Math.max(1, expenses)) < 0.8;

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      background:'linear-gradient(160deg, #020A08 0%, #040E0C 60%, #030808 100%)',
      fontFamily:T.display,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Sticky Header ── */}
      <header style={{
        position:'sticky', top:0, zIndex:100,
        background:'rgba(2,10,8,0.94)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid rgba(0,212,184,0.12)',
        padding:'10px clamp(12px,4vw,24px)',
        display:'flex', alignItems:'center', flexWrap:'wrap', gap:'8px 20px',
      }}>
        <div style={{
          padding:'5px 12px', borderRadius:6, fontSize:10,
          fontFamily:T.mono, fontWeight:700, letterSpacing:'0.2em',
          background:'rgba(0,212,184,0.10)', border:'1px solid rgba(0,212,184,0.28)',
          color:T.teal,
        }}>
          🤝 SYNDICATE
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 18px', fontSize:12, fontFamily:T.mono }}>
          <span style={{ color: cashflow >= 0 ? T.teal : T.red, fontWeight:700 }}>
            CF {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
          </span>
          <span style={{ color:T.text }}>NW {fmt(netWorth)}</span>
          {(rescueOpen || !!rescueWindow) && (
            <span style={{
              color:T.orange, fontWeight:700, fontFamily:T.mono,
            }}>
              🚨 RESCUE ACTIVE — {rescueTicks} TICKS
            </span>
          )}
        </div>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <ShieldIcons count={shields} consuming={shieldConsuming} />
          <span style={{ fontSize:11, fontFamily:T.mono, color:T.textMut }}>T{tick}/{totalTicks}</span>
        </div>
      </header>

      {/* ── Synergy bar — dominant ── */}
      <div style={{ padding:'14px clamp(12px,3vw,20px) 0' }}>
        <SynergyBar synergyBonus={synBonus} combinedNW={combinedNW} />
      </div>

      {/* ── Main content ── */}
      <div style={{ flex:1, padding:'clamp(12px,3vw,20px)', display:'flex', flexDirection:'column', gap:14 }}>

        {/* Partner panels */}
        <div style={{
          display:'grid', gap:14,
          gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
        }}>
          <PartnerPanel
            label="YOUR EMPIRE" cash={cash} income={income} expenses={expenses}
            netWorth={netWorth} shieldPct={shieldPct}
            inDistress={localDistress} isLocal={true}
          />
          <PartnerPanel
            label="PARTNER" income={partnerIncome} expenses={partnerExp}
            netWorth={partnerNW} shieldPct={partnerShield}
            inDistress={partnerDist} isLocal={false}
          />
        </div>

        {/* Aid contracts */}
        <AidContractList contracts={contracts as any[]} />

        {/* Aid composer toggle */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button
            onClick={() => setShowAid(v => !v)}
            style={{
              padding:'11px 20px', borderRadius:8, cursor:'pointer',
              fontFamily:T.mono, fontWeight:700, fontSize:12, letterSpacing:'0.1em',
              textTransform:'uppercase', minHeight:44,
              background: showAid ? 'rgba(0,212,184,0.15)' : 'rgba(0,34,26,0.80)',
              border:'1px solid rgba(0,212,184,0.30)', color:T.teal,
              transition:'all 0.2s ease',
            }}
          >
            {showAid ? '✕ CLOSE AID COMPOSER' : '📤 SEND ALLIANCE AID'}
          </button>
        </div>

        {showAid && (
          <AidContractComposer
            allianceMembers={allianceMembers} senderCash={cash}
            maxAidPct={0.25}
            onSubmit={(c) => { onAidSubmit(c); setShowAid(false); }}
            onCancel={() => setShowAid(false)}
          />
        )}

        {/* GameBoard */}
        <GameBoard
          equityHistory={equityHistory} cash={cash} netWorth={netWorth}
          income={income} expenses={expenses} regime={regime}
          intelligence={intelligence} tick={tick} totalTicks={totalTicks}
          freezeTicks={freezeTicks}
        />

      </div>

      {/* ── Rescue Window ── */}
      {rescueWindow && (
        <div style={{ position:'fixed', bottom:16, left:16, width:'clamp(280px, 90vw, 360px)', zIndex:200 }}>
          <RescueWindowBanner
            rescueeDisplayName={rescueWindow.rescueeDisplayName}
            rescueeNetWorth={rescueWindow.rescueeNetWorth}
            ticksRemaining={rescueWindow.ticksRemaining}
            allianceName={rescueWindow.allianceName}
            contributionRequired={rescueWindow.contributionRequired}
            totalContributed={rescueWindow.totalContributed}
            onContribute={onRescueContribute}
            onDismiss={onRescueDismiss}
          />
        </div>
      )}

      {/* ── Moment Flash ── */}
      <div style={{ position:'fixed', bottom:16, right:16, width:'clamp(240px, 40vw, 320px)', zIndex:200, pointerEvents:'none' }}>
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}