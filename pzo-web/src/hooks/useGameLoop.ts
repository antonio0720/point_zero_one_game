/**
 * hooks/useGameLoop.ts — POINT ZERO ONE
 * RAF-driven orchestrator tick loop. Starts/stops with run lifecycle.
 * Reads tick rate from the unified engine store so cadence tracks the
 * active TimeEngine tier contract without re-registering the loop.
 *
 * FILE LOCATION: pzo-web/src/hooks/useGameLoop.ts
 * Density6 LLC · Confidential
 */

import { useEffect, useRef, useCallback } from 'react';
import { orchestrator } from '../engines/zero/EngineOrchestrator';
import type { RunLifecycleState } from '../engines/zero/types';
import { useEngineStore } from '../store/engineStore';

// ── Public UI-facing phases ───────────────────────────────────────────────────

export type RunPhase = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED';

export interface GameLoopState {
  /** Current engine tick index. */
  tick: number;
  /** UI-normalized lifecycle phase. */
  runPhase: RunPhase;
  /** True only when the engine is actively ticking. */
  isRunning: boolean;
  /** Milliseconds per tick at the current cadence. */
  tickRate: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fallback tick duration before store initialization. */
const DEFAULT_TICK_RATE_MS = 500;

/** Hard safety floor to prevent pathological over-ticking. */
const MIN_TICK_RATE_MS = 50;

// ── Mapping helpers ───────────────────────────────────────────────────────────

function normalizeRunPhase(state: RunLifecycleState | null | undefined): RunPhase {
  switch (state) {
    case 'ACTIVE':
    case 'TICK_LOCKED':
      return 'RUNNING';

    case 'ENDING':
      return 'PAUSED';

    case 'ENDED':
      return 'ENDED';

    case 'STARTING':
    case 'IDLE':
    default:
      return 'IDLE';
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGameLoop(): GameLoopState {
  // Unified engine-store reads only. No runStore dependency here.
  const tick = useEngineStore((s) => {
    const runTick = s.run.lastTickIndex;
    const timeTick = s.time.ticksElapsed;
    return Number.isFinite(runTick) ? runTick : Number.isFinite(timeTick) ? timeTick : 0;
  });

  const tickRate = useEngineStore((s) => {
    const raw = s.time.currentTickDurationMs;
    return Math.max(MIN_TICK_RATE_MS, raw ?? DEFAULT_TICK_RATE_MS);
  });

  const runPhase = useEngineStore((s) => normalizeRunPhase(s.run.lifecycleState));

  // Stable refs for RAF loop internals.
  const rafRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(0);
  const tickRateRef = useRef<number>(tickRate);
  const isRunningRef = useRef<boolean>(runPhase === 'RUNNING');

  // Keep live values current without rebuilding the callback every render.
  tickRateRef.current = Math.max(MIN_TICK_RATE_MS, tickRate);
  isRunningRef.current = runPhase === 'RUNNING';

  const loop = useCallback((timestamp: number) => {
    if (!isRunningRef.current) return;

    const elapsed = timestamp - lastTickTimeRef.current;

    if (elapsed >= tickRateRef.current) {
      // Prevent long-frame drift accumulation while preserving cadence.
      lastTickTimeRef.current = timestamp - (elapsed % tickRateRef.current);

      void orchestrator.executeTick().catch((err) => {
        console.error('[useGameLoop] executeTick threw:', err);
      });
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