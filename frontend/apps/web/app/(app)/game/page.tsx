/**
 * page.tsx — (app)/game — POINT ZERO ONE
 * ─────────────────────────────────────────────────────────────────────────────
 * The missing route that fixes the 404.
 *
 * CURRENT BEHAVIOR (Strategy B — bridge to Vite app):
 *   1. Reads RunContext from sessionStorage (set by play/page.tsx)
 *   2. Renders GameShell which redirects to the Vite app with params
 *   3. Vite app (pzo-web) reads params, skips auth/lobby, starts run
 *
 * FUTURE BEHAVIOR (Strategy A — embedded engine):
 *   1. Reads RunContext from sessionStorage
 *   2. GameShell imports engine package from frontend/packages/engine
 *   3. Mounts mode-specific GameScreen directly (no redirect)
 *
 * FILE LOCATION: frontend/apps/web/app/(app)/game/page.tsx
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GameShell from './GameShell';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunContext {
  runId:      string;
  mode:       string;
  config:     Record<string, any>;
  startedAt:  number;
  seed:       number;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const T = {
  void:    '#030308',
  text:    '#F0F0FF',
  textSub: '#B8B8D8',
  textDim: '#6A6A90',
  indigo:  '#818CF8',
  mono:    'var(--font-dm-mono, "DM Mono", monospace)',
  display: 'var(--font-barlow, "Barlow Condensed", Impact, system-ui, sans-serif)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const router = useRouter();
  const [runCtx, setRunCtx]   = useState<RunContext | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pzo_run_ctx');
      if (!raw) {
        setError('No run context found. Redirecting to lobby...');
        setTimeout(() => router.replace('/play'), 2000);
        return;
      }
      const ctx: RunContext = JSON.parse(raw);
      if (!ctx.runId || !ctx.mode) {
        setError('Invalid run context. Redirecting to lobby...');
        setTimeout(() => router.replace('/play'), 2000);
        return;
      }
      setRunCtx(ctx);
      setLoading(false);
    } catch (e) {
      setError('Failed to parse run context. Redirecting to lobby...');
      setTimeout(() => router.replace('/play'), 2000);
    }
  }, [router]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading || error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: T.void, color: T.text, fontFamily: T.mono,
      }}>
        <div style={{ textAlign: 'center' }}>
          {error ? (
            <>
              <div style={{ fontSize: 14, color: '#FF4D4D', marginBottom: 8 }}>⚠ {error}</div>
              <div style={{ fontSize: 11, color: T.textDim }}>Returning to play screen...</div>
            </>
          ) : (
            <>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '2px solid rgba(129,140,248,0.2)',
                borderTopColor: T.indigo,
                animation: 'spin 0.9s linear infinite',
                margin: '0 auto 16px',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{
                fontSize: 11, letterSpacing: '0.3em',
                textTransform: 'uppercase', color: T.indigo,
              }}>
                INITIALIZING ENGINE...
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Game shell ────────────────────────────────────────────────────────────

  return (
    <GameShell
      runContext={runCtx!}
      onRunEnd={(outcome) => {
        sessionStorage.removeItem('pzo_run_ctx');
        router.push(`/run/${runCtx!.runId}/after`);
      }}
      onBackToLobby={() => {
        sessionStorage.removeItem('pzo_run_ctx');
        router.push('/play');
      }}
    />
  );
}
