'use client';

import { useEffect, useRef, useState } from 'react';
import {
  bootstrapEngine,
  EmpireGameScreen,
  orchestrator,
  PhantomGameScreen,
  PredatorGameScreen,
  SyndicateGameScreen,
  useEngineStore,
  useRunStore,
} from '@pzo/engine';

const DEFAULT_TICK_RATE_MS = 2_000;
const MIN_TICK_RATE_MS = 50;

type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

interface GameShellProps {
  runContext: {
    runId: string;
    mode: string;
    config: Record<string, any>;
    startedAt: number;
    seed: number;
  };
  onRunEnd: (outcome: string) => void;
  onBackToLobby: () => void;
}

function useTickLoop(): void {
  const tickRate = useEngineStore((s) =>
    s.run.lastTickDurationMs > 0 ? s.run.lastTickDurationMs : DEFAULT_TICK_RATE_MS,
  );
  const runPhase = useRunStore((s) => s.runPhase);

  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const tickRateRef = useRef<number>(tickRate);
  const runPhaseRef = useRef(runPhase);

  tickRateRef.current = Math.max(MIN_TICK_RATE_MS, tickRate || DEFAULT_TICK_RATE_MS);
  runPhaseRef.current = runPhase;

  useEffect(() => {
    if (runPhase !== 'RUNNING') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTickRef.current = performance.now();

    const loop = (ts: number) => {
      if (runPhaseRef.current !== 'RUNNING') return;

      const elapsed = ts - lastTickRef.current;
      if (elapsed >= tickRateRef.current) {
        lastTickRef.current = ts - (elapsed % tickRateRef.current);
        try {
          void orchestrator.executeTick();
        } catch (e) {
          console.error('[GameShell] executeTick failed:', e);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [runPhase]);
}

function renderMode(mode: RunMode) {
  switch (mode) {
    case 'solo':
      return <EmpireGameScreen />;
    case 'asymmetric-pvp':
      return <PredatorGameScreen />;
    case 'co-op':
      return <SyndicateGameScreen />;
    case 'ghost':
      return <PhantomGameScreen />;
    default:
      return <EmpireGameScreen />;
  }
}

export default function GameShell({ runContext, onRunEnd, onBackToLobby }: GameShellProps) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const initRef = useRef(false);
  const notifiedEndRef = useRef(false);

  const runPhase = useRunStore((s) => s.runPhase);
  const outcome = useEngineStore((s) => s.run.outcome);

  useTickLoop();

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      useEngineStore.getState().resetAllSlices();
      useRunStore.getState().reset();
      orchestrator.reset();
      bootstrapEngine({ force: true });

      orchestrator.startRun({
        runId: runContext.runId,
        userId: 'player_01',
        seed: String(runContext.seed),
        seasonTickBudget: 720,
        freedomThreshold: 500_000,
        clientVersion: '4.0.0',
        engineVersion: '4.0.0',
      } as any);

      setReady(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[GameShell] startRun failed:', e);
      setBootError(message);
    }

    return () => {
      try {
        useEngineStore.getState().resetAllSlices();
        useRunStore.getState().reset();
        orchestrator.reset();
      } catch {
        // ignore teardown errors during route transitions / HMR
      }
    };
  }, [runContext]);

  useEffect(() => {
    if (runPhase !== 'ENDED' || notifiedEndRef.current) return;
    notifiedEndRef.current = true;
    onRunEnd(outcome ?? 'ABANDONED');
  }, [runPhase, outcome, onRunEnd]);

  if (bootError) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#030308', color: '#F5C842', fontFamily: 'monospace' }}>
        <div style={{ maxWidth: 760, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.3em', marginBottom: 16 }}>ENGINE BOOT FAILED</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#F0F0FF', opacity: 0.9 }}>{bootError}</div>
          <button
            onClick={onBackToLobby}
            style={{ marginTop: 24, padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#F5C842', fontSize: 11, cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase' }}
          >
            Back To Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#030308', color: '#F5C842', fontFamily: 'monospace' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em' }}>STARTING ENGINE...</div>
      </div>
    );
  }

  return renderMode(runContext.mode as RunMode);
}
