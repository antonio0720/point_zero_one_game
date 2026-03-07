/**
 * BattleHUD.tsx — PZO Battle Mode HUD
 * Rebuilt: Syne + IBM Plex Mono · Inline styles · Mobile-first · High contrast
 * Density6 LLC · Confidential
 */

import React from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  card:    '#0C0510',
  border:  'rgba(255,255,255,0.08)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  red:     '#FF4D4D',
  yellow:  '#FFD700',
  orange:  '#FF8C00',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type BattlePhase = 'PREP' | 'ACTIVE' | 'RESOLUTION' | 'ENDED';

export interface BattleParticipant {
  id: string;
  displayName: string;
  netWorth: number;
  haterHeat: number;
  isLocal: boolean;
}

export interface BattleHUDProps {
  phase: BattlePhase;
  participants: BattleParticipant[];
  ticksRemaining: number;
  roundNumber: number;
  totalRounds: number;
  localScore: number;
  opponentScore: number;
  onForfeit?: () => void;
}

const PHASE_META: Record<BattlePhase, { color: string; label: string; bg: string }> = {
  PREP:       { color: T.textSub,  label:'PREP PHASE',    bg:'rgba(144,144,180,0.10)' },
  ACTIVE:     { color: T.green,    label:'BATTLE ACTIVE',  bg:'rgba(34,221,136,0.10)'  },
  RESOLUTION: { color: T.yellow,   label:'RESOLVING',      bg:'rgba(255,215,0,0.10)'   },
  ENDED:      { color: T.red,      label:'BATTLE ENDED',   bg:'rgba(255,77,77,0.10)'   },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n/1e6).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1e3).toFixed(0)}K`;
  return `$${n}`;
}

export function BattleHUD({
  phase, participants, ticksRemaining,
  roundNumber, totalRounds,
  localScore, opponentScore, onForfeit,
}: BattleHUDProps) {
  const local    = participants.find(p => p.isLocal);
  const opponent = participants.find(p => !p.isLocal);
  const meta     = PHASE_META[phase];
  const total    = Math.max(1, localScore + opponentScore);
  const localPct = (localScore / total) * 100;

  return (
    <div style={{
      background: T.card, borderRadius:12,
      border:'1px solid rgba(255,77,77,0.18)',
      overflow:'hidden', fontFamily:T.display,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@400;600;700&display=swap');`}</style>

      {/* ── Header ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px',
        background: meta.bg, borderBottom:'1px solid rgba(255,77,77,0.12)',
        flexWrap:'wrap', gap:8,
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
        }}>
          <div style={{
            width:8, height:8, borderRadius:'50%',
            background: meta.color,
            boxShadow: `0 0 10px ${meta.color}`,
          }} />
          <span style={{ fontSize:11, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.18em', color:meta.color }}>
            {meta.label}
          </span>
        </div>
        <span style={{ fontSize:10, fontFamily:T.mono, color:T.textSub }}>
          R{roundNumber}/{totalRounds} · {ticksRemaining}t left
        </span>
      </div>

      {/* ── Score Bar ── */}
      <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Local score */}
          <span style={{
            fontSize:20, fontWeight:800, fontFamily:T.display, color:T.green,
            width:40, textAlign:'right', flexShrink:0,
          }}>
            {localScore}
          </span>

          {/* Progress bar */}
          <div style={{ flex:1, height:10, background:'rgba(255,77,77,0.25)', borderRadius:6, overflow:'hidden', display:'flex' }}>
            <div style={{
              height:'100%', width:`${localPct}%`,
              background:`linear-gradient(90deg, #11AA66, ${T.green})`,
              borderRadius:'6px 0 0 6px',
              boxShadow:`0 0 12px rgba(34,221,136,0.4)`,
              transition:'width 0.5s ease',
              flexShrink:0,
            }} />
          </div>

          {/* Opponent score */}
          <span style={{
            fontSize:20, fontWeight:800, fontFamily:T.display, color:T.red,
            width:40, textAlign:'left', flexShrink:0,
          }}>
            {opponentScore}
          </span>
        </div>

        {/* Labels */}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
          <span style={{ fontSize:9, fontFamily:T.mono, color:`${T.green}88` }}>YOU</span>
          <span style={{ fontSize:9, fontFamily:T.mono, color:`${T.red}88` }}>OPPONENT</span>
        </div>
      </div>

      {/* ── Participants ── */}
      <div style={{
        display:'grid', gap:1, padding:'10px 14px',
        gridTemplateColumns:'1fr 1fr',
      }}>
        {local && (
          <div style={{
            padding:'10px 12px', borderRadius:8,
            background:'rgba(34,221,136,0.07)',
            border:'1px solid rgba(34,221,136,0.18)',
          }}>
            <div style={{ fontSize:10, fontFamily:T.mono, color:T.green, fontWeight:700, letterSpacing:'0.1em', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {local.displayName}
            </div>
            <div style={{ fontSize:15, fontFamily:T.mono, fontWeight:700, color:T.text, marginBottom:3 }}>
              {fmt(local.netWorth)}
            </div>
            <div style={{ fontSize:10, fontFamily:T.mono, color:T.textSub }}>
              Heat: <span style={{ color: local.haterHeat > 70 ? T.red : T.textSub }}>
                {local.haterHeat}
              </span>
            </div>
          </div>
        )}

        {opponent && (
          <div style={{
            padding:'10px 12px', borderRadius:8,
            background:'rgba(255,77,77,0.07)',
            border:'1px solid rgba(255,77,77,0.18)',
          }}>
            <div style={{ fontSize:10, fontFamily:T.mono, color:T.red, fontWeight:700, letterSpacing:'0.1em', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {opponent.displayName}
            </div>
            <div style={{ fontSize:15, fontFamily:T.mono, fontWeight:700, color:T.text, marginBottom:3 }}>
              {fmt(opponent.netWorth)}
            </div>
            <div style={{ fontSize:10, fontFamily:T.mono, color:T.textSub }}>
              Heat: <span style={{ color: opponent.haterHeat > 70 ? T.red : T.textSub }}>
                {opponent.haterHeat}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Forfeit ── */}
      {onForfeit && phase === 'ACTIVE' && (
        <div style={{ padding:'0 14px 12px' }}>
          <button
            onClick={onForfeit}
            style={{
              width:'100%', padding:'8px', borderRadius:8, cursor:'pointer',
              fontSize:10, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.12em',
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,77,77,0.20)',
              color:T.textMut, transition:'all 0.2s ease',
              minHeight:36,
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,77,77,0.10)';
              (e.target as HTMLButtonElement).style.color = T.red;
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
              (e.target as HTMLButtonElement).style.color = T.textMut;
            }}
          >
            FORFEIT MATCH
          </button>
        </div>
      )}
    </div>
  );
}

export default BattleHUD;