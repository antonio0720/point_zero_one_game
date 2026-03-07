// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — useGameMode HOOK
// pzo-web/src/hooks/useGameMode.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// THE SINGLE BRIDGE between the React layer and the engine layer.
//
// Features never import engine classes. This hook is the ONLY code allowed
// to reach into engines/. Components call this hook. That's the entire
// API surface.
//
// USAGE in App.tsx:
//   const { startRun, endRun, modeState, runOutcome, isRunActive } = useGameMode();
//
//   // In LobbyScreen onStart handler:
//   startRun(mode);  ← replaces the old setRunMode(mode); startRun();
//
// The hook subscribes to EventBus events and re-renders when meaningful
// state changes occur. It exposes a clean, typed modeState for the UI.

import { useState, useCallback, useEffect, useRef } from 'react';
import type { RunMode, RunOutcome, GameModeState, PZOEvent } from '../engines/core/types';
import { orchestrator }                              from '../engines/core/EngineOrchestrator';
import { globalEventBus }                            from '../engines/core/EventBus';
import { ModeRouter, createDefaultConfig }           from '../engines/modes/ModeRouter';
import type { IGameModeEngine }                      from '../engines/core/types';

// ── Hook return type ──────────────────────────────────────────────────────────

export interface UseGameModeReturn {
  /** Starts a run for the given mode. Triggers screen transition. */
  startRun: (mode: RunMode, seed?: number) => Promise<void>;

  /** Ends the current run with a given outcome. */
  endRun: (outcome: RunOutcome) => void;

  /** The active mode (null before first run). */
  activeMode: RunMode | null;

  /** Mode-specific state for UI rendering. */
  modeState: GameModeState | null;

  /** Whether a run is currently active. */
  isRunActive: boolean;

  /** The outcome of the most recently completed run. */
  runOutcome: RunOutcome | null;

  /** Core financial metrics updated each tick. */
  financials: {
    cash:     number;
    income:   number;
    expenses: number;
    netWorth: number;
    tick:     number;
    shields:  number;   // overall shield integrity 0.0–1.0
    haterHeat: number;
    pressureScore: number;
  };

  /** Last event received (for UI to react to notable moments). */
  lastEvent: PZOEvent | null;

  /** Hold action — spend the 1 per-run hold to freeze timer 5 seconds. */
  spendHold: () => boolean;

  holdsRemaining: number;

  /**
   * PREDATOR-specific: fire a sabotage card as the hater player.
   * Returns false if not in predator mode or insufficient cooldown.
   */
  fireSabotage: (cardId: string) => boolean;

  /**
   * PREDATOR-specific: block an incoming sabotage as the builder.
   */
  blockSabotage: (sabotageId: string) => boolean;

  /**
   * SYNDICATE-specific: send rescue capital to distressed partner.
   */
  sendRescue: (amount: number) => boolean;

  /**
   * SYNDICATE-specific: propose an aid contract.
   */
  proposeAid: (
    type: import('../engines/core/types').AidContractRecord['type'],
    amount: number,
    durationTicks: number | null,
  ) => import('../engines/core/types').AidContractRecord | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGameMode(): UseGameModeReturn {
  const [activeMode,  setActiveMode]  = useState<RunMode | null>(null);
  const [isRunActive, setIsRunActive] = useState(false);
  const [runOutcome,  setRunOutcome]  = useState<RunOutcome | null>(null);
  const [modeState,   setModeState]   = useState<GameModeState | null>(null);
  const [lastEvent,   setLastEvent]   = useState<PZOEvent | null>(null);
  const [holdsLeft,   setHoldsLeft]   = useState(1);

  const [financials, setFinancials]   = useState({
    cash: 28_000, income: 2_100, expenses: 4_800,
    netWorth: 28_000, tick: 0, shields: 1.0,
    haterHeat: 0, pressureScore: 0,
  });

  const engineRef = useRef<IGameModeEngine | null>(null);

  // ── Subscribe to EventBus ────────────────────────────────────────────────

  useEffect(() => {
    const unsubs = [
      globalEventBus.on('TICK_END', (e) => {
        // Refresh financials and modeState each tick
        const live = orchestrator.getLiveState();
        if (live) {
          setFinancials({
            cash:          live.cash,
            income:        live.income,
            expenses:      live.expenses,
            netWorth:      live.netWorth,
            tick:          live.tick,
            shields:       live.shields.layers.L4_NETWORK_CORE.current / 200,
            haterHeat:     live.haterHeat,
            pressureScore: live.pressureScore,
          });
        }
        const state = orchestrator.getModeState();
        if (state) setModeState({ ...state });
        setHoldsLeft(orchestrator.getHoldsRemaining());
        setLastEvent(e);
      }),

      globalEventBus.on('RUN_ENDED', (e) => {
        const payload = e.payload as { outcome: RunOutcome };
        setRunOutcome(payload.outcome);
        setIsRunActive(false);
        setLastEvent(e);
      }),

      globalEventBus.on('RUN_STARTED', (e) => {
        setIsRunActive(true);
        setRunOutcome(null);
        setLastEvent(e);
      }),

      // Bubble notable events up to UI
      globalEventBus.on('SHIELD_L4_BREACH',       (e) => setLastEvent(e)),
      globalEventBus.on('BOT_ATTACK_FIRED',        (e) => setLastEvent(e)),
      globalEventBus.on('CASCADE_TRIGGERED',       (e) => setLastEvent(e)),
      globalEventBus.on('SABOTAGE_FIRED',          (e) => setLastEvent(e)),
      globalEventBus.on('SABOTAGE_BLOCKED',        (e) => setLastEvent(e)),
      globalEventBus.on('RESCUE_WINDOW_OPENED',    (e) => setLastEvent(e)),
      globalEventBus.on('PARTNER_DISTRESS',        (e) => setLastEvent(e)),
      globalEventBus.on('GHOST_DELTA_UPDATE',      (e) => setLastEvent(e)),
      globalEventBus.on('PROOF_BADGE_EARNED',      (e) => setLastEvent(e)),
      globalEventBus.on('PRESSURE_TIER_CHANGED',   (e) => setLastEvent(e)),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  // ── startRun ─────────────────────────────────────────────────────────────

  const startRun = useCallback(async (mode: RunMode, seed?: number) => {
    // End any existing run
    if (orchestrator.isRunActive()) {
      orchestrator.endRun('ABANDONED');
    }

    setActiveMode(mode);
    setRunOutcome(null);

    const config = createDefaultConfig(mode, seed);
    const engine = await ModeRouter.startRun(mode, config);
    engineRef.current = engine;

    setIsRunActive(true);
  }, []);

  // ── endRun ────────────────────────────────────────────────────────────────

  const endRun = useCallback((outcome: RunOutcome) => {
    orchestrator.endRun(outcome);
    setIsRunActive(false);
    setRunOutcome(outcome);
  }, []);

  // ── spendHold ─────────────────────────────────────────────────────────────

  const spendHold = useCallback((): boolean => {
    const result = orchestrator.spendHold();
    setHoldsLeft(orchestrator.getHoldsRemaining());
    return result;
  }, []);

  // ── PREDATOR: fireSabotage ────────────────────────────────────────────────

  const fireSabotage = useCallback((cardId: string): boolean => {
    const engine = engineRef.current;
    if (!engine || engine.mode !== 'asymmetric-pvp') return false;
    const predator = engine as import('../engines/modes/PredatorEngine').PredatorEngine;
    const tick     = orchestrator.getLiveState()?.tick ?? 0;
    return predator.fireSabotage(cardId, tick);
  }, []);

  // ── PREDATOR: blockSabotage ───────────────────────────────────────────────

  const blockSabotage = useCallback((sabotageId: string): boolean => {
    const engine = engineRef.current;
    if (!engine || engine.mode !== 'asymmetric-pvp') return false;
    const predator = engine as import('../engines/modes/PredatorEngine').PredatorEngine;
    const tick     = orchestrator.getLiveState()?.tick ?? 0;
    return predator.blockSabotage(sabotageId, tick);
  }, []);

  // ── SYNDICATE: sendRescue ─────────────────────────────────────────────────

  const sendRescue = useCallback((amount: number): boolean => {
    const engine = engineRef.current;
    if (!engine || engine.mode !== 'co-op') return false;
    const syndicate = engine as import('../engines/modes/SyndicateEngine').SyndicateEngine;
    const tick      = orchestrator.getLiveState()?.tick ?? 0;
    return syndicate.sendRescueCapital(amount, tick);
  }, []);

  // ── SYNDICATE: proposeAid ─────────────────────────────────────────────────

  const proposeAid = useCallback((
    type:          import('../engines/core/types').AidContractRecord['type'],
    amount:        number,
    durationTicks: number | null,
  ) => {
    const engine = engineRef.current;
    if (!engine || engine.mode !== 'co-op') return null;
    const syndicate = engine as import('../engines/modes/SyndicateEngine').SyndicateEngine;
    const tick      = orchestrator.getLiveState()?.tick ?? 0;
    return syndicate.proposeAidContract(type, amount, durationTicks, tick);
  }, []);

  return {
    startRun, endRun,
    activeMode, modeState, isRunActive, runOutcome,
    financials, lastEvent,
    spendHold, holdsRemaining: holdsLeft,
    fireSabotage, blockSabotage,
    sendRescue, proposeAid,
  };
}
