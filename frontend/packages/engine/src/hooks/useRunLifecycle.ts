/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — MASTER RUN LIFECYCLE HOOK
 * pzo-web/src/hooks/useRunLifecycle.ts
 *
 * Single integration point for all game screens. Owns:
 *   ✦ run start via ModeRouter.startRunWithCards()
 *   ✦ RAF-driven tick loop via orchestrator.executeTick()
 *   ✦ pause / resume semantics
 *   ✦ best-effort teardown on end / reset / unmount
 *   ✦ runStore + engineStore cleanup for deterministic remounts
 *
 * This hook intentionally supersedes ad-hoc per-screen lifecycle logic.
 *
 * Density6 LLC · Point Zero One · Lifecycle Hook · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ModeRouter,
  createDefaultConfig,
  type RunContext,
} from '../modes/ModeRouter';
import { orchestrator } from '../zero/EngineOrchestrator';
import type {
  RunLifecycleState,
  RunOutcome,
} from '../zero/types';
import { useEngineStore, wireRunStoreMirror } from '../store/engineStore';
import { runStore } from '../store/runStore';

type RunMode = Parameters<typeof createDefaultConfig>[0];
type ModeConfig = Parameters<typeof ModeRouter.startRunWithCards>[1];

const DEFAULT_TICK_RATE_MS = 500;
const MIN_TICK_RATE_MS     = 50;

export interface StartRunLifecycleOptions {
  mode:       RunMode;
  userId?:    string;
  seed?:      number;
  config?:    ModeConfig;
  configure?: (base: ModeConfig) => ModeConfig;
  onStarted?: (context: RunContext) => void | Promise<void>;
}

export interface UseRunLifecycleReturn {
  lifecycleState: RunLifecycleState;
  runId:          string | null;
  tickIndex:      number;
  tickRateMs:     number;
  isRunning:      boolean;
  isPaused:       boolean;
  canStart:       boolean;
  canPause:       boolean;
  canResume:      boolean;
  canEnd:         boolean;

  start:  (options: StartRunLifecycleOptions) => Promise<RunContext | null>;
  pause:  () => void;
  resume: () => void;
  end:    (outcome: RunOutcome) => Promise<void>;
  reset:  () => void;
}

export function useRunLifecycle(): UseRunLifecycleReturn {
  const lifecycleState = useEngineStore((s) => s.run.lifecycleState);
  const runId          = useEngineStore((s) => s.run.runId);
  const tickIndex      = useEngineStore((s) => s.run.lastTickIndex);
  const tickRateMs     = useEngineStore((s) =>
    Math.max(MIN_TICK_RATE_MS, s.time.currentTickDurationMs || DEFAULT_TICK_RATE_MS),
  );

  const [isPaused, setIsPaused] = useState(false);

  const contextRef         = useRef<RunContext | null>(null);
  const rafRef             = useRef<number>(0);
  const lastTickAtRef      = useRef<number>(0);
  const pausedRef          = useRef<boolean>(false);
  const tickRateRef        = useRef<number>(tickRateMs);
  const tickInFlightRef    = useRef<boolean>(false);
  const startInFlightRef   = useRef<boolean>(false);
  const unmountedRef       = useRef<boolean>(false);
  const mirrorUnsubRef     = useRef<(() => void) | null>(null);

  tickRateRef.current = tickRateMs;
  pausedRef.current   = isPaused;

  const stopLoop = useCallback((): void => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const teardownContext = useCallback((): void => {
    try {
      contextRef.current?.teardown();
    } catch (error) {
      console.error('[useRunLifecycle] teardown() failed:', error);
    } finally {
      contextRef.current = null;
    }
  }, []);

  const hardReset = useCallback((): void => {
    stopLoop();
    teardownContext();

    try {
      mirrorUnsubRef.current?.();
    } catch (error) {
      console.error('[useRunLifecycle] runStore mirror unsubscribe failed:', error);
    } finally {
      mirrorUnsubRef.current = null;
    }

    try {
      orchestrator.reset();
    } catch (error) {
      console.error('[useRunLifecycle] orchestrator.reset() failed:', error);
    }

    try {
      runStore.getState().reset();
    } catch (error) {
      console.error('[useRunLifecycle] runStore.reset() failed:', error);
    }

    try {
      useEngineStore.getState().resetAllSlices();
    } catch (error) {
      console.error('[useRunLifecycle] engineStore.resetAllSlices() failed:', error);
    }

    tickInFlightRef.current  = false;
    lastTickAtRef.current    = 0;
    startInFlightRef.current = false;
    pausedRef.current        = false;
    setIsPaused(false);
  }, [stopLoop, teardownContext]);

  const frame = useCallback(async (timestamp: number): Promise<void> => {
    if (unmountedRef.current || pausedRef.current) return;

    const lifecycle = orchestrator.getLifecycleState();
    if (lifecycle !== 'ACTIVE') return;

    if (lastTickAtRef.current === 0) {
      lastTickAtRef.current = timestamp;
    }

    const elapsed = timestamp - lastTickAtRef.current;
    const target  = Math.max(MIN_TICK_RATE_MS, tickRateRef.current);

    if (elapsed >= target && !tickInFlightRef.current) {
      lastTickAtRef.current = timestamp - (elapsed % target);
      tickInFlightRef.current = true;

      try {
        await orchestrator.executeTick();
      } catch (error) {
        console.error('[useRunLifecycle] executeTick() failed:', error);
      } finally {
        tickInFlightRef.current = false;
      }
    }

    if (!unmountedRef.current && !pausedRef.current && orchestrator.getLifecycleState() === 'ACTIVE') {
      rafRef.current = requestAnimationFrame((ts) => {
        void frame(ts);
      });
    }
  }, []);

  const start = useCallback(async (options: StartRunLifecycleOptions): Promise<RunContext | null> => {
    if (startInFlightRef.current) {
      return contextRef.current;
    }

    startInFlightRef.current = true;

    try {
      hardReset();

      const baseConfig = options.config ?? createDefaultConfig(options.mode, options.seed);
      const resolved   = options.configure ? options.configure(baseConfig) : baseConfig;

      const context = await ModeRouter.startRunWithCards(
        options.mode,
        resolved,
        options.userId ?? 'local_player',
      );

      contextRef.current = context;
      mirrorUnsubRef.current = wireRunStoreMirror();

      const startedRun = useEngineStore.getState().run;
      if (startedRun.runId && startedRun.userId && startedRun.seed) {
        runStore.getState().initialize(startedRun.runId, startedRun.userId, startedRun.seed);
      }

      if (options.onStarted) {
        await options.onStarted(context);
      }

      setIsPaused(false);
      pausedRef.current     = false;
      lastTickAtRef.current = 0;

      return context;
    } catch (error) {
      console.error('[useRunLifecycle] start() failed:', error);
      hardReset();
      return null;
    } finally {
      startInFlightRef.current = false;
    }
  }, [hardReset]);

  const pause = useCallback((): void => {
    setIsPaused(true);
    pausedRef.current = true;
    stopLoop();
  }, [stopLoop]);

  const resume = useCallback((): void => {
    if (orchestrator.getLifecycleState() !== 'ACTIVE') return;
    setIsPaused(false);
    pausedRef.current = false;
    lastTickAtRef.current = 0;
    stopLoop();
    rafRef.current = requestAnimationFrame((ts) => {
      void frame(ts);
    });
  }, [frame, stopLoop]);

  const end = useCallback(async (outcome: RunOutcome): Promise<void> => {
    stopLoop();

    try {
      await orchestrator.endRun(outcome);
    } catch (error) {
      console.error('[useRunLifecycle] endRun() failed:', error);
    } finally {
      teardownContext();
      pausedRef.current = false;
      setIsPaused(false);
    }
  }, [stopLoop, teardownContext]);

  const reset = useCallback((): void => {
    hardReset();
  }, [hardReset]);

  useEffect(() => {
    if (lifecycleState !== 'ACTIVE' || isPaused) {
      stopLoop();
      return;
    }

    stopLoop();
    rafRef.current = requestAnimationFrame((ts) => {
      void frame(ts);
    });

    return () => {
      stopLoop();
    };
  }, [frame, isPaused, lifecycleState, stopLoop]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      hardReset();
    };
  }, [hardReset]);

  const flags = useMemo(() => {
    const running = lifecycleState === 'ACTIVE' && !isPaused;
    return {
      isRunning: running,
      canStart:  lifecycleState === 'IDLE' || lifecycleState === 'ENDED',
      canPause:  running,
      canResume: lifecycleState === 'ACTIVE' && isPaused,
      canEnd:    lifecycleState === 'ACTIVE' || lifecycleState === 'TICK_LOCKED',
    };
  }, [isPaused, lifecycleState]);

  return {
    lifecycleState,
    runId,
    tickIndex,
    tickRateMs,
    isRunning: flags.isRunning,
    isPaused,
    canStart:  flags.canStart,
    canPause:  flags.canPause,
    canResume: flags.canResume,
    canEnd:    flags.canEnd,
    start,
    pause,
    resume,
    end,
    reset,
  };
}
