'use client';
import React, { useState } from 'react';

export const WaitlistCTA: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'done'>('idle');
  const handleSubmit = async () => {
    if (!email || status !== 'idle') return;
    setStatus('loading');
    await new Promise(r => setTimeout(r, 800));
    setStatus('done');
  };
  return (
    <section style={{ background:'linear-gradient(135deg,#060f0a 0%,#080808 100%)',
      padding:'8rem 2rem', textAlign:'center', borderTop:'1px solid rgba(0,200,100,0.08)' }}>
      <div style={{ maxWidth:'600px', margin:'0 auto' }}>
        <div style={{ display:'inline-block', background:'rgba(0,200,100,0.08)',
          border:'1px solid rgba(0,200,100,0.2)', borderRadius:'100px',
          padding:'6px 18px', marginBottom:'2rem', fontSize:'0.75rem',
          letterSpacing:'0.15em', color:'#00c864', textTransform:'uppercase' as const }}>
          Season 0 · Founding Era · Limited Access
        </div>
        <h2 style={{ fontSize:'clamp(2rem,5vw,3.5rem)', fontWeight:900, color:'#fff',
          lineHeight:1.1, letterSpacing:'-0.02em', marginBottom:'1.25rem' }}>
          Get your seat before<br />Season 0 closes
        </h2>
        <p style={{ fontSize:'1.05rem', color:'rgba(255,255,255,0.45)', marginBottom:'2.5rem', lineHeight:1.7 }}>
          Founding players get permanent CORD score multipliers, exclusive Privileged cards,
          and early access to all four game modes.
        </p>
        {status === 'done' ? (
          <div style={{ background:'rgba(0,200,100,0.1)', border:'1px solid rgba(0,200,100,0.3)',
            borderRadius:'12px', padding:'1.5rem', color:'#00c864', fontWeight:700, fontSize:'1.1rem' }}>
            ✓ You're on the list. We'll contact you before launch.
          </div>
        ) : (
          <div style={{ display:'flex', gap:'0.75rem', maxWidth:'480px', margin:'0 auto', flexWrap:'wrap' as const }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ flex:1, minWidth:'200px', background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px',
                padding:'0.875rem 1.25rem', color:'#fff', fontSize:'1rem', outline:'none' }} />
            <button onClick={handleSubmit} disabled={status==='loading'||!email}
              style={{ background:email?'#00c864':'rgba(0,200,100,0.3)', color:'#000',
                fontWeight:700, fontSize:'1rem', padding:'0.875rem 2rem',
                borderRadius:'8px', border:'none', cursor:email?'pointer':'default' }}>
              {status==='loading'?'...':'Join Waitlist'}
            </button>
          </div>
        )}
        <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.25)', marginTop:'1.25rem' }}>
          No spam. No payment info. One email when your spot is ready.
        </p>
      </div>
    </section>
  );
};
