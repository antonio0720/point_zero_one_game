/**
 * FILE: pzo-web/src/features/run/hooks/useTimeEngine.ts
 * React hook — read-only access to Time Engine state from engineStore.
 * Components import from here. Never import TimeEngine class directly.
 *
 * Reads from engineStore.time slice — populated by timeStoreHandlers
 * which are wired to EventBus in EngineOrchestrator.
 *
 * Density6 LLC · Point Zero One · Engine 1 of 7 · Confidential
 */
import { useEngineStore, type EngineStoreState } from '../../../store/engineStore';
import { TICK_TIER_CONFIGS } from '../../../engines/time/types';

export function useTimeEngine() {
  const currentTier    = useEngineStore((s: EngineStoreState) => s.time.currentTier);
  const previousTier   = useEngineStore((s: EngineStoreState) => s.time.previousTier);
  const ticksElapsed   = useEngineStore((s: EngineStoreState) => s.time.ticksElapsed);
  const tickBudget     = useEngineStore((s: EngineStoreState) => s.time.seasonTickBudget);
  const tickDurationMs = useEngineStore((s: EngineStoreState) => s.time.currentTickDurationMs);
  const holdsLeft      = useEngineStore((s: EngineStoreState) => s.time.holdsRemaining);
  const activeWindows  = useEngineStore((s: EngineStoreState) => s.time.activeDecisionWindows);
  const isRunActive    = useEngineStore((s: EngineStoreState) => s.time.isRunActive);
  const tierChangedThisTick = useEngineStore((s: EngineStoreState) => s.time.tierChangedThisTick);

  const config = TICK_TIER_CONFIGS[currentTier];

  return {
    // ── Tier ──────────────────────────────────────────────────────
    currentTier,                                  // TickTier enum value e.g. "T0"–"T4"
    previousTier,                                 // TickTier | null — last tier before change
    tierChangedThisTick,                          // true if tier changed during latest tick
    visualBorderClass: config.visualBorderClass,  // CSS class for TickPressureBorder
    screenShake: config.screenShake,              // true only at T4 COLLAPSE_IMMINENT
    audioSignal: config.audioSignal,              // audio cue key or null

    // ── Tick progress ──────────────────────────────────────────────
    ticksElapsed,                                           // ticks completed this run
    ticksRemaining: Math.max(0, tickBudget - ticksElapsed), // ticks left before TIMEOUT
    seasonTickBudget: tickBudget,                           // total tick budget for run
    tickProgressPct: Math.min(1, ticksElapsed / tickBudget),// 0.0 → 1.0

    // ── Timing ────────────────────────────────────────────────────
    tickDurationMs,                                   // current ms between ticks
    secondsPerTick: Math.round(tickDurationMs / 1000),// for countdown display
    decisionWindowMs: config.decisionWindowMs,        // window duration at current tier

    // ── Decision windows ──────────────────────────────────────────
    activeWindows,                           // DecisionWindow[] — all open windows
    hasActiveDecision: activeWindows.length > 0,
    activeWindowCount: activeWindows.length,

    // ── Hold action ───────────────────────────────────────────────
    holdsLeft,          // 0 or 1 — one per run, never restored
    hasHoldAvailable: holdsLeft > 0,

    // ── Run state ─────────────────────────────────────────────────
    isRunActive,
  } as const;
}