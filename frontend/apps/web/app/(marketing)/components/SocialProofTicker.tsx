'use client';
import React from 'react';

const ITEMS = [
  'SLUMLORD_7 wiped at tick 34 — FUBAR cascade',
  'debt_daemon reached Freedom Threshold — Empire Mode',
  'wage_cage joined Season 0 Waitlist',
  'PHANTOM_RUN_0x4a set new leaderboard record',
  'inflation_ghost played LEVERAGE BLOCK — saved $42,000',
  'status_quo_ml defected in Syndicate run',
  'FREEDOM_SEEKER hit $12,400/mo passive income',
  'New Privileged card unlocked: ASYMMETRIC ADVANTAGE',
  'CORD Score 847 — Top 1% verified',
  'head_to_head_7734 activated HATER SHIELD — survived FUBAR',
];

export const SocialProofTicker: React.FC = () => (
  <section style={{ background:'#050505', borderTop:'1px solid rgba(0,200,100,0.1)',
    borderBottom:'1px solid rgba(0,200,100,0.1)', padding:'1.25rem 0', overflow:'hidden' }}>
    <div style={{ display:'flex', animation:'ticker 40s linear infinite', whiteSpace:'nowrap' }}>
      {[...ITEMS,...ITEMS].map((item,i) => (
        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem',
          padding:'0 2rem', fontSize:'0.8rem', color:'rgba(255,255,255,0.45)' }}>
          <span style={{ color:'#00c864', fontWeight:700 }}>●</span>{item}
        </span>
      ))}
    </div>
    <style>{`@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
  </section>
);
