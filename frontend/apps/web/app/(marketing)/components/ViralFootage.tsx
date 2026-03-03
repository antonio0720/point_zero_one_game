'use client';
import React from 'react';

export const ViralFootage: React.FC = () => (
  <section style={{ background:'#050505', padding:'6rem 2rem', textAlign:'center' }}>
    <p style={{ fontSize:'0.75rem', letterSpacing:'0.2em', color:'#00c864',
      textTransform:'uppercase', marginBottom:'1rem' }}>Gameplay</p>
    <h2 style={{ fontSize:'clamp(1.75rem,4vw,3rem)', fontWeight:800, color:'#fff',
      marginBottom:'3rem', letterSpacing:'-0.02em' }}>
      Every run is a real financial decision tree
    </h2>
    <div style={{ maxWidth:'900px', margin:'0 auto', aspectRatio:'16/9',
      background:'linear-gradient(135deg,#0d1117,#111820)',
      border:'1px solid rgba(0,200,100,0.15)', borderRadius:'16px',
      display:'flex', alignItems:'center', justifyContent:'center',
      position:'relative', overflow:'hidden', cursor:'pointer' }}>
      <div style={{ width:72, height:72, borderRadius:'50%',
        background:'rgba(0,200,100,0.15)', border:'2px solid rgba(0,200,100,0.4)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#00c864"><path d="M8 5v14l11-7z"/></svg>
      </div>
      <div style={{ position:'absolute', bottom:'1.5rem', left:'1.5rem',
        background:'rgba(0,0,0,0.7)', borderRadius:'6px', padding:'6px 12px',
        fontSize:'0.8rem', color:'rgba(255,255,255,0.7)' }}>
        LIVE RUN · Empire Mode · Tick 47/60
      </div>
    </div>
    <div style={{ display:'flex', justifyContent:'center', gap:'3rem', marginTop:'3rem', flexWrap:'wrap' }}>
      {[['300+','Unique Cards'],['4','Game Modes'],['60','Ticks Per Run'],['∞','Possible Outcomes']].map(([v,l]) => (
        <div key={l} style={{ textAlign:'center' }}>
          <div style={{ fontSize:'2rem', fontWeight:800, color:'#00c864' }}>{v}</div>
          <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.4)', marginTop:'4px' }}>{l}</div>
        </div>
      ))}
    </div>
  </section>
);
