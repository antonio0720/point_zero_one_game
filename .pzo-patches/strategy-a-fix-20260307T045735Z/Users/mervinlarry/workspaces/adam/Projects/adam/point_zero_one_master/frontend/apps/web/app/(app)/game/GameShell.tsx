'use client';

import { useEffect, useRef } from 'react';

const VITE_GAME_URL = process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:5173';

interface GameShellProps {
  runContext: { runId: string; mode: string; config: Record<string, any>; startedAt: number; seed: number; };
  onRunEnd: (outcome: string) => void;
  onBackToLobby: () => void;
}

export default function GameShell({ runContext, onRunEnd, onBackToLobby }: GameShellProps) {
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;
    const params = new URLSearchParams({
      runId: runContext.runId, mode: runContext.mode,
      seed: String(runContext.seed), from: 'nextjs',
      goal: runContext.config?.goalTemplate || '',
      profile: runContext.config?.profileTemplate || '',
    });
    window.location.href = `${VITE_GAME_URL}?${params.toString()}`;
  }, [runContext]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#030308', color: '#F0F0FF', fontFamily: 'monospace' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid rgba(245,200,66,0.2)', borderTopColor: '#F5C842', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#F5C842' }}>LAUNCHING ENGINE...</div>
        <button onClick={onBackToLobby} style={{ marginTop: 24, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6A6A90', fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>← Cancel</button>
      </div>
    </div>
  );
}
