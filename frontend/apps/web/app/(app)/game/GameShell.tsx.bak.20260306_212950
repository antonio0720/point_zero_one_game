/**
 * GameShell.tsx — (app)/game — POINT ZERO ONE
 * ─────────────────────────────────────────────────────────────────────────────
 * STRATEGY B (current): Redirects to the Vite app (pzo-web) running on a
 * separate port. Passes RunContext via URL params since sessionStorage
 * doesn't share across origins.
 *
 * STRATEGY A (future): When frontend/packages/engine is extracted,
 * replace the redirect with direct engine mounting:
 *   import { ModeRouter } from '@pzo/engine/modes/ModeRouter';
 *   import EmpireGameScreen from '@pzo/engine/screens/EmpireGameScreen';
 *
 * FILE LOCATION: frontend/apps/web/app/(app)/game/GameShell.tsx
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * In dev: Vite app runs on port 5173.
 * In production: set NEXT_PUBLIC_GAME_URL to the deployed Vite app URL,
 * or switch to Strategy A (embedded engine) and remove this redirect entirely.
 */
const VITE_GAME_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:5173')
  : 'http://localhost:5173';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunContext {
  runId:      string;
  mode:       string;
  config:     Record<string, any>;
  startedAt:  number;
  seed:       number;
}

interface GameShellProps {
  runContext:    RunContext;
  onRunEnd:     (outcome: string) => void;
  onBackToLobby: () => void;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const T = {
  void:    '#030308',
  text:    '#F0F0FF',
  textDim: '#6A6A90',
  indigo:  '#818CF8',
  mono:    'var(--font-dm-mono, "DM Mono", monospace)',
  display: 'var(--font-barlow, "Barlow Condensed", Impact, system-ui, sans-serif)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GameShell({ runContext, onRunEnd, onBackToLobby }: GameShellProps) {
  const redirected = useRef(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;

    // Build URL params for the Vite app
    const params = new URLSearchParams({
      runId:    runContext.runId,
      mode:     runContext.mode,
      seed:     String(runContext.seed),
      from:     'nextjs',  // tells pzo-web to skip auth/lobby
    });

    // Add optional config params
    if (runContext.config?.goalTemplate) {
      params.set('goal', runContext.config.goalTemplate);
    }
    if (runContext.config?.profileTemplate) {
      params.set('profile', runContext.config.profileTemplate);
    }

    const targetUrl = `${VITE_GAME_URL}?${params.toString()}`;

    // Countdown then redirect
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = targetUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 600);

    return () => clearInterval(timer);
  }, [runContext]);

  // ── Listen for postMessage from Vite app (run end signal) ─────────────────

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only accept messages from our Vite app origin
      if (!event.origin.includes('localhost')) return;
      if (event.data?.type === 'PZO_RUN_ENDED') {
        onRunEnd(event.data.outcome ?? 'UNKNOWN');
      }
      if (event.data?.type === 'PZO_BACK_TO_LOBBY') {
        onBackToLobby();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onRunEnd, onBackToLobby]);

  // ── Render: Launch animation ──────────────────────────────────────────────

  const MODE_LABELS: Record<string, { label: string; accent: string; emoji: string }> = {
    'solo':           { label: 'EMPIRE',    accent: '#F5C842', emoji: '⚡' },
    'asymmetric-pvp': { label: 'PREDATOR',  accent: '#FF4D4D', emoji: '⚔️' },
    'co-op':          { label: 'SYNDICATE', accent: '#00D4B8', emoji: '🤝' },
    'ghost':          { label: 'PHANTOM',   accent: '#A855F7', emoji: '👻' },
  };

  const modeInfo = MODE_LABELS[runContext.mode] ?? MODE_LABELS['solo'];

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: T.void, color: T.text, fontFamily: T.mono,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {/* Spinning ring */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `3px solid rgba(${modeInfo.accent === '#F5C842' ? '245,200,66' : '129,140,248'},0.15)`,
          borderTopColor: modeInfo.accent,
          animation: 'shellSpin 0.8s linear infinite',
          margin: '0 auto 24px',
        }} />
        <style>{`@keyframes shellSpin { to { transform: rotate(360deg); } }`}</style>

        {/* Mode label */}
        <div style={{
          fontSize: 11, letterSpacing: '0.3em',
          textTransform: 'uppercase', color: modeInfo.accent,
          marginBottom: 8,
        }}>
          {modeInfo.emoji} LAUNCHING {modeInfo.label}
        </div>

        {/* Run ID */}
        <div style={{
          fontSize: 10, color: T.textDim, letterSpacing: '0.06em',
          marginBottom: 24,
        }}>
          RUN: {runContext.runId}
        </div>

        {/* Config summary */}
        {(runContext.config?.goalTemplate || runContext.config?.profileTemplate) && (
          <div style={{
            padding: '10px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10, color: T.textDim, lineHeight: 1.8,
            marginBottom: 24,
          }}>
            {runContext.config.goalTemplate && (
              <div>GOAL: <span style={{ color: T.text }}>{runContext.config.goalTemplate}</span></div>
            )}
            {runContext.config.profileTemplate && (
              <div>PROFILE: <span style={{ color: T.text }}>{runContext.config.profileTemplate}</span></div>
            )}
          </div>
        )}

        {/* Status */}
        <div style={{
          fontSize: 12, color: T.text, fontWeight: 600,
          fontFamily: T.display, letterSpacing: '0.1em',
        }}>
          ENGINE INITIALIZING{'.'.repeat(Math.max(0, 3 - countdown))}
        </div>

        {/* Back button */}
        <button
          type="button"
          onClick={onBackToLobby}
          style={{
            marginTop: 32, padding: '8px 20px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: T.textDim, fontSize: 10, fontFamily: T.mono,
            cursor: 'pointer', letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ← Cancel & return to lobby
        </button>

        {/* Dev note */}
        <div style={{
          marginTop: 24, fontSize: 9, color: '#2a2a40',
          letterSpacing: '0.06em',
        }}>
          STRATEGY_B → VITE_APP @ {VITE_GAME_URL}
        </div>
      </div>
    </div>
  );
}
