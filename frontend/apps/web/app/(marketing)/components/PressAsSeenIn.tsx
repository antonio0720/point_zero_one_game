'use client';
import React from 'react';

export const PressAsSeenIn: React.FC = () => (
  <section style={{ background:'#050505', padding:'4rem 2rem', textAlign:'center',
    borderTop:'1px solid rgba(255,255,255,0.04)' }}>
    <p style={{ fontSize:'0.7rem', letterSpacing:'0.2em', color:'rgba(255,255,255,0.25)',
      textTransform:'uppercase', marginBottom:'2rem' }}>As Seen In</p>
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'3rem', flexWrap:'wrap' }}>
      {['Forbes','TechCrunch','Product Hunt','IndieHackers','Hacker News'].map(n => (
        <span key={n} style={{ fontSize:'1.1rem', fontWeight:700,
          color:'rgba(255,255,255,0.15)', letterSpacing:'0.05em' }}>{n}</span>
      ))}
    </div>
    <p style={{ marginTop:'3rem', fontSize:'0.8rem', color:'rgba(255,255,255,0.15)' }}>
      © {new Date().getFullYear()} Density6 LLC · Point Zero One · All rights reserved
    </p>
  </section>
);
