/**
 * hooks/useGameLoop.ts — POINT ZERO ONE
 * RAF-driven orchestrator tick loop. Starts/stops with run lifecycle.
 * Uses real Strategy A engine-store fields from the extracted package.
 *
 * FILE LOCATION: frontend/packages/engine/src/hooks/useGameLoop.ts
 * Density6 LLC · Confidential
 */

import { useCallback, useEffect, useRef } from 'react';
import { orchestrator as engineOrchestrator } from '../zero/EngineOrchestrator';
import { useEngineStore } from '../store/engineStore';
import { useRunStore, type RunPhase } from '../store/runStore';

export interface GameLoopState {
  tick: number;
  runPhase: RunPhase;
  isRunning: boolean;
  tickRate: number;
}

const DEFAULT_TICK_RATE_MS = 2_000;
const MIN_TICK_RATE_MS = 50;

export function useGameLoop(): GameLoopState {
  const tick = useEngineStore((s) => s.run.lastTickIndex);
  const tickRate = useEngineStore((s) =>
    s.run.lastTickDurationMs > 0 ? s.run.lastTickDurationMs : DEFAULT_TICK_RATE_MS,
  );
  const runPhase = useRunStore((s) => s.runPhase);

  const rafRef = useRef<number>(0);
  const lastTickTime = useRef<number>(0);
  const tickRateRef = useRef<number>(tickRate);
  const isRunningRef = useRef<boolean>(false);

  tickRateRef.current = Math.max(MIN_TICK_RATE_MS, tickRate || DEFAULT_TICK_RATE_MS);
  isRunningRef.current = runPhase === 'RUNNING';

  const loop = useCallback((timestamp: number) => {
    if (!isRunningRef.current) return;

    const elapsed = timestamp - lastTickTime.current;
    if (elapsed >= tickRateRef.current) {
      lastTickTime.current = timestamp - (elapsed % tickRateRef.current);
      try {
        void engineOrchestrator.executeTick();
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

    lastTickTime.current = performance.now();
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
