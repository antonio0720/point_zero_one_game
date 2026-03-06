/**
 * hooks/useGameLoop.ts — POINT ZERO ONE
 * RAF-driven orchestrator tick loop. Starts/stops with run lifecycle.
 * Reads tickRate from TimeEngine store slice so it respects Tier-based
 * speed scaling without re-registering the loop.
 *
 * FILE LOCATION: pzo-web/src/hooks/useGameLoop.ts
 * Density6 LLC · Confidential
 */

import { useEffect, useRef, useCallback } from 'react';
import { engineOrchestrator } from '../engines/zero/EngineOrchestrator';
import { useEngineStore } from '../store/engineStore';
import { useRunStore } from '../store/runStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RunPhase = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED';

export interface GameLoopState {
  /** Current engine tick index. Sourced from TimeEngine store slice. */
  tick: number;
  /** Current run lifecycle phase. */
  runPhase: RunPhase;
  /** True only when runPhase === 'RUNNING'. Convenience alias. */
  isRunning: boolean;
  /** Milliseconds per tick at the current TimeEngine tier. Live value. */
  tickRate: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fallback tick rate when store hasn't initialised yet (500ms = tier 1). */
const DEFAULT_TICK_RATE_MS = 500;

/** Guard: never execute faster than this regardless of tier math. */
const MIN_TICK_RATE_MS = 50;

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useGameLoop
 *
 * Schedules engineOrchestrator.executeTick() via requestAnimationFrame at the
 * rate defined by the TimeEngine's current tier. The loop starts automatically
 * when runPhase transitions to 'RUNNING' and stops on any other phase.
 *
 * Teardown is handled on unmount — safe to mount in any game screen.
 *
 * @returns GameLoopState — current tick index, run phase, and tick rate.
 */
export function useGameLoop(): GameLoopState {
  // ── Store reads ───────────────────────────────────────────────────────────
  const tick      = useEngineStore(s => s.time.tick);
  const tickRate  = useEngineStore(s => s.time.tickRate ?? DEFAULT_TICK_RATE_MS);
  const runPhase  = useRunStore(s => s.runPhase as RunPhase);

  // ── Refs (stable across renders, no re-render on mutation) ────────────────
  const rafRef        = useRef<number>(0);
  const lastTickTime  = useRef<number>(0);
  const tickRateRef   = useRef<number>(tickRate);
  const isRunningRef  = useRef<boolean>(false);

  // Keep refs in sync with the latest store values without triggering effect
  // re-registration. This allows the RAF callback to read up-to-date values
  // without being recreated every tick.
  tickRateRef.current  = Math.max(MIN_TICK_RATE_MS, tickRate);
  isRunningRef.current = runPhase === 'RUNNING';

  // ── RAF callback (stable reference — created once) ────────────────────────
  const loop = useCallback((timestamp: number) => {
    if (!isRunningRef.current) return;

    const elapsed = timestamp - lastTickTime.current;

    if (elapsed >= tickRateRef.current) {
      // Snap last-tick time to prevent drift accumulation across slow frames.
      // Uses floor to the nearest tickRate boundary so fast frames don't
      // double-fire.
      lastTickTime.current = timestamp - (elapsed % tickRateRef.current);

      try {
        engineOrchestrator.executeTick();
      } catch (err) {
        // Crash isolation: log without killing the RAF loop.
        // The EngineRegistry circuit breaker will quarantine the failing engine.
        console.error('[useGameLoop] executeTick threw:', err);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []); // Empty deps — reads live values through refs

  // ── Lifecycle management ──────────────────────────────────────────────────
  useEffect(() => {
    if (runPhase !== 'RUNNING') {
      // Halt the loop on pause/end/idle.
      cancelAnimationFrame(rafRef.current);
      return;
    }

    // Seed the last-tick timestamp so the first tick fires after one full
    // tickRate interval rather than immediately.
    lastTickTime.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [runPhase, loop]);

  // Teardown on unmount (covers screen transitions).
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