/**
 * CapabilitiesPanel.tsx — Player capability stats + active objectives
 * Rebuilt: Syne + IBM Plex Mono · Inline styles · Mobile-first · High contrast
 * Density6 LLC · Confidential
 */

'use client';

import React, { useState } from 'react';
import type { CapabilityState, ReputationState, ObjectiveId, GameStateSnapshot } from '../types/game';
import { OBJECTIVE_CONFIGS } from '../types/game';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  card:    '#0C0C1E',
  cardHi:  '#12122A',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.14)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  red:     '#FF4D4D',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  indigo:  '#818CF8',
  purple:  '#A855F7',
  blue:    '#4488FF',
  cyan:    '#22D3EE',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Capability metadata ──────────────────────────────────────────────────────
const CAP_META: Record<keyof CapabilityState, { label: string; icon: string; benefit: string; color: string }> = {
  underwriting: { label:'Underwriting', icon:'📋', benefit:'−4%/lvl FUBAR probability',     color: T.blue    },
  negotiation:  { label:'Negotiation',  icon:'🤝', benefit:'+2%/lvl deal returns',           color: T.green   },
  bookkeeping:  { label:'Bookkeeping',  icon:'📒', benefit:'Reveals hidden costs early',      color: T.indigo  },
  marketing:    { label:'Marketing',    icon:'📣', benefit:'+3%/lvl digital cashflow',        color: T.orange  },
  compliance:   { label:'Compliance',   icon:'⚖️', benefit:'−5%/lvl legal/fraud damage',     color: T.yellow  },
  analytics:    { label:'Analytics',    icon:'📊', benefit:'+10%/lvl ML card power',          color: T.purple  },
  systems:      { label:'Systems',      icon:'⚙️', benefit:'−4%/lvl obligation burden',      color: T.cyan    },
};



const REP_COLORS: Record<ReputationState['tier'], string> = {
  Unknown:     T.textMut,
  Emerging:    T.blue,
  Established: T.indigo,
  Respected:   T.purple,
  Sovereign:   T.yellow,
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface CapabilitiesPanelProps {
  capabilities: CapabilityState;
  reputation: ReputationState;
  objectives: ObjectiveId[];
  gameStateSnapshot: GameStateSnapshot;
  isExpanded?: boolean;
  onToggle?: () => void;
}

// ─── Capability Bar ───────────────────────────────────────────────────────────
function CapabilityBar({ statKey, value }: { statKey: keyof CapabilityState; value: number }) {
  const [tip, setTip] = useState(false);
  const meta  = CAP_META[statKey];
  const pct   = (value / 10) * 100;
  const color = value >= 7 ? T.purple : value >= 4 ? T.indigo : T.textMut;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:14, flexShrink:0, width:20, textAlign:'center' }}>{meta.icon}</span>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:11, fontFamily:T.mono, color:T.textSub }}>{meta.label}</span>
          <span style={{ fontSize:11, fontFamily:T.mono, color:value > 0 ? T.text : T.textMut, fontWeight:700 }}>
            {value}/10
          </span>
        </div>
        <div style={{ height:5, background:'#1A1A2E', borderRadius:3, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:3, width:`${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            transition:'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Tooltip trigger */}
      <div
        style={{ position:'relative', flexShrink:0 }}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
      >
        <span style={{ fontSize:11, fontFamily:T.mono, color:T.textMut, cursor:'help' }}>?</span>
        {tip && (
          <div style={{
            position:'absolute', right:0, bottom:'100%', marginBottom:6,
            width:180, padding:'8px 10px', borderRadius:8,
            background:'#1A1A30', border:`1px solid ${T.borderM}`,
            fontSize:11, fontFamily:T.mono, color:T.textSub, lineHeight:1.5,
            zIndex:50, pointerEvents:'none', whiteSpace:'normal',
            boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {meta.benefit}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Objective Badge ──────────────────────────────────────────────────────────
function ObjectiveBadge({ id, snapshot }: { id: ObjectiveId; snapshot: GameStateSnapshot }) {
  const config    = OBJECTIVE_CONFIGS[id];
  const completed = config.checkFn(snapshot);

  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:10,
      padding:'10px 12px', borderRadius:8,
      background: completed ? 'rgba(34,221,136,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${completed ? 'rgba(34,221,136,0.25)' : 'rgba(255,255,255,0.07)'}`,
    }}>
      <span style={{ fontSize:16, lineHeight:1, marginTop:1 }}>
        {completed ? '✅' : '🎯'}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:12, fontWeight:700, fontFamily:T.display,
          color: completed ? T.green : T.text, marginBottom:2,
        }}>
          {config.label}
        </div>
        <div style={{ fontSize:10, fontFamily:T.mono, color:T.textSub, lineHeight:1.45 }}>
          {config.description}
        </div>
      </div>
      {completed && (
        <span style={{
          fontSize:10, fontFamily:T.mono, fontWeight:700, flexShrink:0,
          padding:'3px 7px', borderRadius:4,
          background:'rgba(34,221,136,0.12)', border:'1px solid rgba(34,221,136,0.25)',
          color:T.green, whiteSpace:'nowrap',
        }}>
          +{config.bonusXp} XP
        </span>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CapabilitiesPanel({
  capabilities, reputation, objectives,
  gameStateSnapshot, isExpanded = false, onToggle,
}: CapabilitiesPanelProps) {
  const repColor     = REP_COLORS[reputation.tier];
  const totalCaps    = Object.values(capabilities).reduce((s: number, v) => s + (v as number), 0);
  const completedIds = objectives.filter(id => OBJECTIVE_CONFIGS[id].checkFn(gameStateSnapshot));
  const repPct       = Math.min(100, (reputation.score / 1000) * 100);

  return (
    <div style={{
      background: T.card, borderRadius:12,
      border:`1px solid ${T.border}`,
      overflow:'hidden', fontFamily:T.display,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@400;600;700&display=swap');`}</style>

      {/* ── Header (toggle button) ── */}
      <button
        onClick={onToggle}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'11px 14px', cursor:'pointer', background:'transparent', border:'none',
          borderBottom: isExpanded ? `1px solid ${T.border}` : 'none',
          minHeight:44,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = T.cardHi)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, fontWeight:700, color:T.text, fontFamily:T.display }}>
            ⚙️ Capabilities & Objectives
          </span>
          <span style={{ fontSize:11, fontWeight:700, color:repColor, fontFamily:T.mono }}>
            {reputation.tier}
          </span>
          <span style={{ fontSize:10, color:T.textMut, fontFamily:T.mono }}>
            {reputation.score} rep
          </span>
          <span style={{ fontSize:10, color:T.textSub, fontFamily:T.mono }}>
            {completedIds.length}/{objectives.length} objectives
          </span>
        </div>
        <span style={{ fontSize:11, color:T.textMut, flexShrink:0 }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* ── Collapsed: quick icons ── */}
      {!isExpanded && (
        <div style={{ padding:'8px 14px 12px', display:'flex', flexWrap:'wrap', gap:'6px 14px' }}>
          {(Object.entries(capabilities) as [keyof CapabilityState, number][])
            .filter(([, v]) => v > 0)
            .map(([k, v]) => (
              <span key={k} style={{ fontSize:12, fontFamily:T.mono }}>
                {CAP_META[k].icon}{' '}
                <span style={{ color:T.textSub }}>{v}</span>
              </span>
            ))
          }
          {totalCaps === 0 && (
            <span style={{ fontSize:11, fontFamily:T.mono, color:T.textMut }}>
              No capabilities yet — play LEARN zone cards
            </span>
          )}
        </div>
      )}

      {/* ── Expanded ── */}
      {isExpanded && (
        <div style={{ padding:14, display:'flex', flexDirection:'column', gap:20 }}>

          {/* Capability bars */}
          <div>
            <div style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:T.textSub, marginBottom:10 }}>
              Capability Stats
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(Object.entries(capabilities) as [keyof CapabilityState, number][]).map(([k, v]) => (
                <CapabilityBar key={k} statKey={k} value={v} />
              ))}
            </div>
          </div>

          {/* Reputation */}
          <div>
            <div style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:T.textSub, marginBottom:10 }}>
              Reputation
            </div>
            <div style={{
              padding:'12px 14px', borderRadius:10,
              background: T.cardHi, border:`1px solid ${T.border}`,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontWeight:800, fontSize:16, fontFamily:T.display, color:repColor }}>
                  {reputation.tier}
                </span>
                <span style={{ fontSize:12, fontFamily:T.mono, color:T.textSub }}>
                  {reputation.score} / 1000
                </span>
              </div>
              <div style={{ height:7, background:'#1A1A2E', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
                <div style={{
                  height:'100%', borderRadius:4, width:`${repPct}%`,
                  background:'linear-gradient(90deg, #4444AA, #818CF8)',
                  transition:'width 0.5s ease',
                }} />
              </div>
              {reputation.recentEvents.length > 0 && (
                <div style={{ fontSize:10, fontFamily:T.mono, color:T.textSub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
                  {reputation.recentEvents[0]}
                </div>
              )}
              <div style={{ fontSize:10, fontFamily:T.mono, color:T.textMut }}>
                Sovereign tier: +5% CF premium on all plays
              </div>
            </div>
          </div>

          {/* Objectives */}
          {objectives.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:T.textSub, marginBottom:10 }}>
                Run Objectives ({completedIds.length}/{objectives.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {objectives.map(id => (
                  <ObjectiveBadge key={id} id={id} snapshot={gameStateSnapshot} />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}