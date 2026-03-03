/**
 * ResultScreen.tsx — POINT ZERO ONE
 * End-state screen. Victory / defeat. Mode-aware grade. Proof badge. Replay CTA.
 * Engine: SeasonState + SovereigntyEngine grade + proof hash
 * Density6 LLC · Confidential
 */

import React, { useEffect, useState } from 'react';
import { fmtMoney, fmtPct01 } from '../game/core/format';
import type { SeasonState, IntelligenceState } from '../game/types/runState';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0F0F20',
  text:    '#F2F2FF',
  textSub: '#7777AA',
  textMut: '#33334A',
  mono:    "'IBM Plex Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Grade config ─────────────────────────────────────────────────────────────
const GRADE_META: Record<string, { color: string; label: string; sub: string }> = {
  S: { color:'#FFD700', label:'SOVEREIGN',    sub:'Flawless. You outplayed the system.' },
  A: { color:'#22D3EE', label:'ARCHITECT',    sub:'Elite decision-making under pressure.' },
  B: { color:'#A855F7', label:'BUILDER',      sub:'Solid fundamentals. Execution-grade.' },
  C: { color:'#FFD700', label:'CLIMBER',      sub:'You\'re learning the language of wealth.' },
  D: { color:'#FF8C00', label:'DEVELOPING',   sub:'Real gaps exposed. Now you know.' },
  F: { color:'#FF4D4D', label:'LIQUIDATED',   sub:'The market always collects.' },
};

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding:'clamp(12px,2.5vw,18px)', borderRadius:10,
      background:'rgba(255,255,255,0.04)',
      border:'1px solid rgba(255,255,255,0.08)',
      textAlign:'center',
    }}>
      <div style={{
        fontSize:9, fontFamily:T.mono, fontWeight:600,
        letterSpacing:'0.18em', textTransform:'uppercase',
        color:T.textSub, marginBottom:8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize:'clamp(1rem,3vw,1.4rem)', fontFamily:T.mono, fontWeight:700,
        color: color ?? T.text, lineHeight:1,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ResultScreenProps {
  cash:         number;
  netWorth:     number;
  income:       number;
  expenses:     number;
  season:       SeasonState;
  intelligence: IntelligenceState;
  onRestart:    () => void;
  // Optional enriched props from SovereigntyEngine
  grade?:       string;
  proofHash?:   string;
  runMode?:     string;
  totalTicks?:  number;
  ticksUsed?:   number;
}

// ─── Mode accent ──────────────────────────────────────────────────────────────
const MODE_ACCENTS: Record<string, { accent:string; rgb:string; label:string; icon:string }> = {
  'solo':           { accent:'#F5C842', rgb:'245,200,66',  label:'EMPIRE',    icon:'⚡' },
  'asymmetric-pvp': { accent:'#FF4D4D', rgb:'255,77,77',   label:'PREDATOR',  icon:'⚔️' },
  'co-op':          { accent:'#00D4B8', rgb:'0,212,184',   label:'SYNDICATE', icon:'🤝' },
  'ghost':          { accent:'#A855F7', rgb:'168,85,247',  label:'PHANTOM',   icon:'👻' },
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ResultScreen({
  cash, netWorth, income, expenses, season, intelligence,
  onRestart, grade = 'B', proofHash, runMode, totalTicks, ticksUsed,
}: ResultScreenProps) {
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    setTimeout(() => setRevealed(true), 600);
  }, []);

  const cashflow    = income - expenses;
  const won         = cashflow > 0 && netWorth > 100_000;
  const gradeMeta   = GRADE_META[grade] ?? GRADE_META['F'];
  const modeData    = MODE_ACCENTS[runMode ?? 'solo'] ?? MODE_ACCENTS['solo'];
  const animatedNW  = useCountUp(netWorth, 1400);

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background: `linear-gradient(160deg, ${T.void} 0%, #0A0A18 60%, #060610 100%)`,
      fontFamily:T.display, position:'relative', overflow:'hidden',
      padding:'clamp(20px,5vw,48px) clamp(16px,4vw,32px)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse-ring {
          0%   { transform: scale(0.92); opacity:0.6; }
          50%  { transform: scale(1.04); opacity:1; }
          100% { transform: scale(0.92); opacity:0.6; }
        }
        @keyframes shimmer {
          0%   { opacity: 0.6; }
          50%  { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>

      {/* Background ambient */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: won
          ? `radial-gradient(ellipse 70% 60% at 50% 40%, rgba(34,221,136,0.06) 0%, transparent 70%)`
          : `radial-gradient(ellipse 70% 60% at 50% 40%, rgba(255,77,77,0.06) 0%, transparent 70%)`,
      }} />

      {/* Mode badge */}
      <div style={{
        position:'absolute', top:20, left:'50%', transform:'translateX(-50%)',
        display:'flex', alignItems:'center', gap:8,
        padding:'6px 14px', borderRadius:20,
        background:`rgba(${modeData.rgb},0.10)`,
        border:`1px solid rgba(${modeData.rgb},0.30)`,
        fontSize:10, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.2em',
        color:modeData.accent, textTransform:'uppercase', whiteSpace:'nowrap',
      }}>
        {modeData.icon} {modeData.label} RUN COMPLETE
      </div>

      {/* Main content */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        width:'100%', maxWidth:760, gap:24,
        opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)',
        transition:'opacity 0.55s ease, transform 0.55s ease',
        marginTop:40,
      }}>

        {/* Victory / defeat headline */}
        <div style={{
          textAlign:'center',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'none' : 'scale(0.94)',
          transition:'opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s',
        }}>
          <div style={{
            fontSize:'clamp(3.5rem, 12vw, 8rem)', lineHeight:1, marginBottom:8,
            animation: won ? 'pulse-ring 2.5s ease-in-out infinite' : 'none',
            display:'inline-block',
          }}>
            {won ? '🏆' : '💀'}
          </div>

          <h1 style={{
            fontSize:'clamp(1.8rem, 6vw, 3.5rem)', fontWeight:800,
            letterSpacing:'-0.03em', fontFamily:T.display,
            color: won ? '#22DD88' : '#FF4D4D',
            textShadow: won
              ? '0 0 60px rgba(34,221,136,0.5)'
              : '0 0 60px rgba(255,77,77,0.4)',
            margin: '0 0 8px',
          }}>
            {won ? 'FREEDOM UNLOCKED' : 'LIQUIDATED'}
          </h1>

          <p style={{
            fontSize:'clamp(13px,2vw,16px)', color:T.textSub,
            fontFamily:T.mono, letterSpacing:'0.05em',
          }}>
            {won
              ? 'Passive income exceeds expenses. You built the machine.'
              : 'You ran out of time, capital, or will.'}
          </p>
        </div>

        {/* Grade + Net Worth hero */}
        <div style={{
          display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center',
          gap:24, width:'100%',
          opacity: revealed ? 1 : 0, transition:'opacity 0.5s ease 0.5s',
        }}>
          {/* Grade */}
          <div style={{
            textAlign:'center', padding:'20px 32px', borderRadius:12,
            background:`rgba(${grade === 'S' ? '255,215,0' : grade === 'A' ? '34,211,238' : '168,85,247'},0.08)`,
            border:`1px solid ${gradeMeta.color}33`,
          }}>
            <div style={{ fontSize:10, fontFamily:T.mono, color:T.textSub, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:8 }}>
              Sovereignty Grade
            </div>
            <div style={{
              fontSize:'clamp(3.5rem,10vw,5.5rem)', fontWeight:800, fontFamily:T.display,
              color:gradeMeta.color,
              textShadow:`0 0 40px ${gradeMeta.color}66`,
              lineHeight:0.9,
            }}>
              {grade}
            </div>
            <div style={{
              fontSize:11, fontFamily:T.mono, fontWeight:700, color:gradeMeta.color,
              letterSpacing:'0.15em', textTransform:'uppercase', marginTop:8,
            }}>
              {gradeMeta.label}
            </div>
            <p style={{ fontSize:11, color:T.textSub, marginTop:6, maxWidth:160, lineHeight:1.5, fontFamily:T.mono }}>
              {gradeMeta.sub}
            </p>
          </div>

          {/* Net Worth animated */}
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:10, fontFamily:T.mono, color:T.textSub, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:8 }}>
              Final Net Worth
            </div>
            <div style={{
              fontSize:'clamp(2rem,7vw,4rem)', fontWeight:800,
              fontFamily:T.mono, color:T.text, lineHeight:1,
            }}>
              {fmtMoney(animatedNW)}
            </div>
            {cashflow !== 0 && (
              <div style={{
                marginTop:8, fontSize:14, fontFamily:T.mono, fontWeight:700,
                color: cashflow > 0 ? '#22DD88' : '#FF4D4D',
              }}>
                {cashflow > 0 ? '+' : ''}{fmtMoney(cashflow)}/mo cashflow
              </div>
            )}
          </div>
        </div>

        {/* Stat grid */}
        <div style={{
          display:'grid', gap:10, width:'100%',
          gridTemplateColumns:'repeat(auto-fill, minmax(clamp(130px,20vw,180px), 1fr))',
          opacity: revealed ? 1 : 0, transition:'opacity 0.5s ease 0.7s',
        }}>
          <StatCard label="Final Cash"     value={fmtMoney(cash)}     color={cash > 0 ? '#22DD88' : '#FF4D4D'} />
          <StatCard label="Monthly Income" value={fmtMoney(income)}    color="#22DD88" />
          <StatCard label="Cashflow"       value={`${cashflow >= 0 ? '+' : ''}${fmtMoney(cashflow)}`} color={cashflow >= 0 ? '#22DD88' : '#FF4D4D'} />
          <StatCard label="Battle Pass"    value={`T${season.passTier}`} color="#A855F7" />
          <StatCard label="AI Alpha"       value={fmtPct01(intelligence.alpha)} color="#22D3EE" />
          {ticksUsed !== undefined && totalTicks !== undefined && (
            <StatCard label="Efficiency" value={`${Math.round((ticksUsed / totalTicks) * 100)}%`} color={T.textSub} />
          )}
        </div>

        {/* Proof badge */}
        {proofHash && (
          <div style={{
            width:'100%', padding:'14px 20px', borderRadius:10,
            background:'rgba(255,215,0,0.06)', border:'1px solid rgba(255,215,0,0.22)',
            display:'flex', alignItems:'center', gap:12,
            opacity: revealed ? 1 : 0, transition:'opacity 0.5s ease 0.9s',
          }}>
            <span style={{ fontSize:28 }}>🏅</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, fontFamily:T.mono, fontWeight:700, color:'#FFD700', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:4 }}>
                Proof Badge Minted
              </div>
              <div style={{
                fontSize:9, fontFamily:T.mono, color:T.textMut,
                wordBreak:'break-all', letterSpacing:'0.05em',
              }}>
                {proofHash}
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{
          display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center',
          gap:12, marginTop:4,
          opacity: revealed ? 1 : 0, transition:'opacity 0.5s ease 1s',
        }}>
          <button
            onClick={onRestart}
            style={{
              padding:'clamp(12px,2vw,16px) clamp(28px,5vw,52px)',
              borderRadius:12, cursor:'pointer', border:'none',
              background: modeData.accent, color:'#000000',
              fontSize:'clamp(14px,2vw,16px)', fontWeight:800,
              letterSpacing:'0.12em', textTransform:'uppercase',
              fontFamily:T.display, minHeight:52,
              boxShadow:`0 0 28px rgba(${modeData.rgb},0.4)`,
              transition:'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.transform = 'scale(1.04)';
              (e.target as HTMLButtonElement).style.boxShadow = `0 0 48px rgba(${modeData.rgb},0.6)`;
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.transform = 'scale(1)';
              (e.target as HTMLButtonElement).style.boxShadow = `0 0 28px rgba(${modeData.rgb},0.4)`;
            }}
          >
            PLAY AGAIN
          </button>
          <p style={{ fontSize:11, fontFamily:T.mono, color:T.textMut, maxWidth:200, textAlign:'center', lineHeight:1.5 }}>
            The market doesn't pause. Neither do you.
          </p>
        </div>

      </div>
    </div>
  );
}