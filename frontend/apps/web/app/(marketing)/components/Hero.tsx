'use client';
import React from 'react';

export interface HeroProps { heroStatement?: string; }

export const Hero: React.FC<HeroProps> = ({
  heroStatement = 'Learn money by surviving it — with friends',
}) => (
  <section style={{
    minHeight:'100vh', background:'linear-gradient(135deg,#0a0a0a 0%,#0d1117 50%,#0a0f1a 100%)',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    padding:'4rem 2rem', textAlign:'center', position:'relative', overflow:'hidden',
  }}>
    <div style={{ position:'absolute', inset:0,
      backgroundImage:'linear-gradient(rgba(0,200,100,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,100,0.03) 1px,transparent 1px)',
      backgroundSize:'60px 60px', pointerEvents:'none' }} />
    <div style={{ position:'relative', zIndex:1, maxWidth:'900px' }}>
      <div style={{ display:'inline-block', background:'rgba(0,200,100,0.1)',
        border:'1px solid rgba(0,200,100,0.3)', borderRadius:'100px',
        padding:'6px 18px', marginBottom:'2rem', fontSize:'0.75rem',
        letterSpacing:'0.15em', color:'#00c864', textTransform:'uppercase' }}>
        Financial Roguelike · Season 0 Now Open
      </div>
      <h1 style={{ fontSize:'clamp(2.5rem,6vw,5rem)', fontWeight:900, color:'#ffffff',
        lineHeight:1.05, letterSpacing:'-0.02em', marginBottom:'1.5rem' }}>
        {heroStatement}
      </h1>
      <p style={{ fontSize:'clamp(1rem,2vw,1.25rem)', color:'rgba(255,255,255,0.5)',
        maxWidth:'600px', margin:'0 auto 3rem', lineHeight:1.7 }}>
        Point Zero One is a real-money strategy game built on the mathematics of financial sovereignty.
        Draw cards. Make decisions. Build wealth or get wiped.
      </p>
      <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
        <a href="/season0" style={{ background:'#00c864', color:'#000', padding:'1rem 2.5rem',
          borderRadius:'8px', fontWeight:700, fontSize:'1rem', textDecoration:'none' }}>
          Join Season 0
        </a>
        <a href="/explorer" style={{ background:'transparent', color:'#fff', padding:'1rem 2.5rem',
          borderRadius:'8px', fontWeight:600, fontSize:'1rem', textDecoration:'none',
          border:'1px solid rgba(255,255,255,0.15)' }}>
          View Leaderboard
        </a>
      </div>
    </div>
  </section>
);
