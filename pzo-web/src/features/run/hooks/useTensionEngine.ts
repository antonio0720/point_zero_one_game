/**
 * FILE: pzo-web/src/features/run/hooks/useTensionEngine.ts
 * Primary hook for all Tension Engine data.
 * Reads from useEngineStore only — never imports TensionEngine directly.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import { useEngineStore, type EngineStoreState } from '../../../store/engineStore';

export function useTensionEngine() {
  const score        = useEngineStore((s: EngineStoreState) => s.tension.score);
  const visibility   = useEngineStore((s: EngineStoreState) => s.tension.visibilityState);
  const queueLength  = useEngineStore((s: EngineStoreState) => s.tension.queueLength);
  const arrivedCount = useEngineStore((s: EngineStoreState) => s.tension.arrivedCount);
  const queuedCount  = useEngineStore((s: EngineStoreState) => s.tension.queuedCount);
  const expiredCount = useEngineStore((s: EngineStoreState) => s.tension.expiredCount);
  const isPulse      = useEngineStore((s: EngineStoreState) => s.tension.isPulseActive);
  const pulseTicks   = useEngineStore((s: EngineStoreState) => s.tension.pulseTicksActive);
  const isEscalating = useEngineStore((s: EngineStoreState) => s.tension.isEscalating);
  const sortedQueue  = useEngineStore((s: EngineStoreState) => s.tension.sortedQueue);
  const isRunActive  = useEngineStore((s: EngineStoreState) => s.tension.isRunActive);
  const scoreHistory = useEngineStore((s: EngineStoreState) => s.tension.scoreHistory);
  const currentTick  = useEngineStore((s: EngineStoreState) => s.tension.currentTick);

  return {
    // ── Core score ────────────────────────────────────────────────
    score,
    scorePct: score * 100,
    scoreHistory,
    currentTick,

    // ── Visibility ────────────────────────────────────────────────
    visibilityState: visibility,

    // ── Queue counts ──────────────────────────────────────────────
    queueLength,
    arrivedCount,
    queuedCount,
    expiredCount,

    // ── Pulse state ───────────────────────────────────────────────
    isPulseActive:   isPulse,
    pulseTicksActive: pulseTicks,
    isSustainedPulse: pulseTicks >= 3,

    // ── Trend ─────────────────────────────────────────────────────
    isEscalating,

    // ── Queue ─────────────────────────────────────────────────────
    sortedQueue,

    // ── Derived ───────────────────────────────────────────────────
    hasArrivedThreats: arrivedCount > 0,
    threatUrgency: arrivedCount > 0
      ? 'URGENT'
      : queuedCount > 0
        ? 'BUILDING'
        : 'CLEAR',

    // ── Run state ─────────────────────────────────────────────────
    isRunActive,
  } as const;
}