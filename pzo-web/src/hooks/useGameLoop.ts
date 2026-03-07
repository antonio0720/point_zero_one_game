// pzo-web/src/hooks/useGameLoop.ts

/**
 * hooks/useGameLoop.ts — POINT ZERO ONE
 * RAF-driven orchestrator tick loop.
 *
 * FIXED TO MATCH CURRENT STORE CONTRACTS:
 * - tick        ← engineStore.run.lastTickIndex
 * - runPhase    ← engineStore.run.lifecycleState
 * - tickRate    ← engineStore.time.currentTickDurationMs
 *
 * FILE LOCATION: pzo-web/src/hooks/useGameLoop.ts
 * Density6 LLC · Confidential
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { engineOrchestrator } from '../engines/zero/EngineOrchestrator';
import { useEngineStore } from '../store/engineStore';

export type RunPhase = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED';

export interface GameLoopState {
  tick: number;
  runPhase: RunPhase;
  isRunning: boolean;
  tickRate: number;
}

const DEFAULT_TICK_RATE_MS = 500;
const MIN_TICK_RATE_MS = 50;

function normalizeRunPhase(value: string | null | undefined): RunPhase {
  switch (value) {
    case 'RUNNING':
    case 'PAUSED':
    case 'ENDED':
    case 'IDLE':
      return value;
    default:
      return 'IDLE';
  }
}

export function useGameLoop(): GameLoopState {
  const tick = useEngineStore((s) => s.run.lastTickIndex ?? 0);
  const tickRate = useEngineStore((s) =>
    Math.max(MIN_TICK_RATE_MS, s.time.currentTickDurationMs ?? DEFAULT_TICK_RATE_MS),
  );
  const runPhase = useEngineStore((s) =>
    normalizeRunPhase((s.run.lifecycleState as string | null | undefined) ?? 'IDLE'),
  );

  const rafRef = useRef(0);
  const lastTickTimeRef = useRef(0);
  const tickRateRef = useRef(tickRate);
  const isRunningRef = useRef(runPhase === 'RUNNING');

  tickRateRef.current = Math.max(MIN_TICK_RATE_MS, tickRate);
  isRunningRef.current = runPhase === 'RUNNING';

  const loop = useCallback((timestamp: number) => {
    if (!isRunningRef.current) return;

    const elapsed = timestamp - lastTickTimeRef.current;
    if (elapsed >= tickRateRef.current) {
      lastTickTimeRef.current = timestamp - (elapsed % tickRateRef.current);

      try {
        engineOrchestrator.executeTick();
      } catch (err) {
        console.error('[useGameLoop] executeTick threw:', err);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (runPhase !== 'RUNNING') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTickTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [runPhase, loop]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    tick,
    runPhase,
    isRunning: runPhase === 'RUNNING',
    tickRate: tickRateRef.current,
  };
}

export default useGameLoop;