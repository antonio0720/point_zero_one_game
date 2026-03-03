'use client';
import React from 'react';

const MODES = [
  { id:'GO_ALONE',       name:'Empire',    tagline:'Build your empire alone',       color:'#00c864', icon:'⚡',
    description:'Solo financial run. 60 ticks. Build cashflow, dodge FUBAR cards, hit Freedom Threshold.' },
  { id:'HEAD_TO_HEAD',   name:'Predator',  tagline:'Destroy your opponent',         color:'#ff4444', icon:'⚔️',
    description:'PvP sabotage mode. Play FUBAR and COUNTER cards against a live opponent. First to wipe loses.' },
  { id:'TEAM_UP',        name:'Syndicate', tagline:'Win together or lose together', color:'#7c3aed', icon:'🤝',
    description:'Co-op 2v2. Share resources, play AID cards, manage trust scores. Defection is legal.' },
  { id:'CHASE_A_LEGEND', name:'Phantom',   tagline:'Chase a ghost of perfection',   color:'#f59e0b', icon:'👻',
    description:'Race a replay of the highest-scoring verified run. Ghost cards haunt every decision.' },
];

export const GameModes: React.FC = () => (
  <section style={{ background:'#080808', padding:'6rem 2rem' }}>
    <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
      <div style={{ textAlign:'center', marginBottom:'4rem' }}>
        <p style={{ fontSize:'0.75rem', letterSpacing:'0.2em', color:'#00c864',
          textTransform:'uppercase', marginBottom:'1rem' }}>Game Modes</p>
        <h2 style={{ fontSize:'clamp(1.75rem,4vw,3rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>
          Four ways to play. One way to win.
        </h2>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'1.5rem' }}>
        {MODES.map(m => (
          <div key={m.id} style={{ background:'#0d1117', border:`1px solid ${m.color}22`,
            borderRadius:'12px', padding:'2rem' }}>
            <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>{m.icon}</div>
            <div style={{ fontSize:'0.7rem', letterSpacing:'0.15em', color:m.color,
              textTransform:'uppercase', marginBottom:'0.5rem' }}>{m.name}</div>
            <h3 style={{ fontSize:'1.2rem', fontWeight:700, color:'#fff', marginBottom:'0.75rem' }}>{m.tagline}</h3>
            <p style={{ fontSize:'0.9rem', color:'rgba(255,255,255,0.45)', lineHeight:1.6 }}>{m.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
