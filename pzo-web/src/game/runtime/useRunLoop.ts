// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/runtime/useRunLoop.ts
// Sprint 1: Run Loop Hook — extracted from App.tsx
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// Drives the tick engine. Fires RunEvents into the dispatch function.
// App.tsx calls this hook with state + dispatch — it contains ZERO business logic.

import { useEffect, useRef } from 'react';
import type { RunState } from '../types/runState';
import type { RunEvent } from '../types/events';
import type { GameMode } from '../types/modes';
import { clamp } from '../core/math';
import {
  TICK_MS, MONTH_TICKS, DRAW_TICKS, MAX_HAND,
  FATE_TICKS, FATE_FUBAR_PCT, FATE_MISSED_PCT, FATE_SO_PCT,
  MACRO_EVENT_TICKS, SEASON_PULSE_TICKS, GHOST_TICK_INTERVAL,
  INTEGRITY_CHECK_TICKS, BATTLE_ROUND_TICKS,
  RESCUE_WINDOW_INTERVAL, RESCUE_WINDOW_CHANCE,
} from '../core/constants';
import type { GameCard } from '../types/cards';

// ── Hook Interface ─────────────────────────────────────────────────────────────
export interface UseRunLoopOptions {
  state: RunState;
  dispatch: (event: RunEvent) => void;
  rng: () => number;
  deckPool: GameCard[];
  /** Mode engines can inject additional per-tick side-effects here. */
  onMechanicPulse?: (tick: number, mode: GameMode) => void;
}

export function useRunLoop({
  state,
  dispatch,
  rng,
  deckPool,
  onMechanicPulse,
}: UseRunLoopOptions): void {
  const stateRef = useRef(state);
  stateRef.current = state;

  const rngRef = useRef(rng);
  rngRef.current = rng;

  const deckRef = useRef(deckPool);
  deckRef.current = deckPool;

  useEffect(() => {
    if (state.screen !== 'run') return;

    const timer = setTimeout(() => {
      const s = stateRef.current;
      if (s.screen !== 'run') return;

      const nextTick = s.tick + 1;
      dispatch({ type: 'TICK_ADVANCE', tick: nextTick });

      // Intelligence update
      dispatch({
        type: 'INTELLIGENCE_UPDATE',
        alphaDelta:  computeAlphaDelta(s),
        riskDelta:   computeRiskDelta(s),
      });

      // Mechanic pulse hook (for engine layer / telemetry)
      onMechanicPulse?.(nextTick, s.mode);

      // ── Freeze tick ──
      // Handled by reducer on TICK_ADVANCE

      // ── Monthly Settlement ──
      if (nextTick % MONTH_TICKS === 0) {
        const cashflow = s.income - s.expenses;
        const mlMod = 1 + (s.intelligence.alpha - s.intelligence.risk) * 0.04;
        const settlement = Math.round(cashflow * mlMod);
        dispatch({ type: 'MONTHLY_SETTLEMENT', settlement, cashflow, mlMod });
        dispatch({
          type: 'TELEMETRY_EMIT',
          telemetryType: 'economy.monthly_settlement',
          payload: { settlement, cashflow, mlMod: +mlMod.toFixed(3), tick: nextTick },
        });
      }

      // ── Fate Deck ──
      if (nextTick % FATE_TICKS === 0 && nextTick > 0) {
        fireFateDeck(s, nextTick, rngRef.current, deckRef.current, dispatch);
      }

      // ── Card Draw ──
      if (nextTick % DRAW_TICKS === 0 && s.hand.length < MAX_HAND && s.freezeTicks <= 0) {
        fireCardDraw(s, rngRef.current, deckRef.current, dispatch);
      }

      // ── Macro Events ──
      if (nextTick % MACRO_EVENT_TICKS === 0 && nextTick > 0) {
        fireMacroEvent(s, rngRef.current, dispatch);
      }

      // ── Season Pulse ──
      if (nextTick % SEASON_PULSE_TICKS === 0 && nextTick > 0) {
        dispatch({ type: 'SEASON_PULSE', xpGained: 12, dominionDelta: 1 });
        dispatch({
          type: 'TELEMETRY_EMIT',
          telemetryType: 'season.pulse',
          payload: { xp: s.season.xp, tier: s.season.passTier, tick: nextTick },
        });
      }

      // ── Battle Round (PvP) ──
      if (nextTick % BATTLE_ROUND_TICKS === 0 && nextTick > 0 && s.mode === 'PREDATOR') {
        const delta = s.intelligence.alpha > s.intelligence.risk ? 1 : -1;
        dispatch({ type: 'BATTLE_PHASE_CHANGED', phase: 'ACTIVE' });
        dispatch({
          type: 'BATTLE_SCORE_UPDATE',
          local:    s.battleState.score.local    + (delta > 0 ? 1 : 0),
          opponent: s.battleState.score.opponent + (delta < 0 ? 1 : 0),
        });
      }

      // ── Rescue Window (Syndicate) ──
      if (
        nextTick % RESCUE_WINDOW_INTERVAL === 0 &&
        nextTick > 0 &&
        s.mode === 'SYNDICATE' &&
        !s.rescueWindow &&
        rngRef.current() < RESCUE_WINDOW_CHANCE
      ) {
        dispatch({ type: 'RESCUE_WINDOW_OPENED', rescueeDisplayName: 'CIPHER_9', ticksRemaining: 30 });
      }

      // ── Integrity Heartbeat ──
      if (nextTick % INTEGRITY_CHECK_TICKS === 0) {
        dispatch({
          type: 'TELEMETRY_EMIT',
          telemetryType: 'integrity.heartbeat',
          payload: { antiCheat: +s.intelligence.antiCheat.toFixed(3), tick: nextTick },
        });
      }
    }, TICK_MS);

    return () => clearTimeout(timer);
  // The tick is the only dependency we need — useRunLoop re-registers each tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, state.tick]);
}

// ── Private Helpers ───────────────────────────────────────────────────────────

function computeAlphaDelta(s: RunState): number {
  const cashflow = s.income - s.expenses;
  return (
    (cashflow > 0 ? 0.004 : -0.003) +
    (s.season.winStreak > 0 ? 0.002 : 0) +
    (s.regime === 'Expansion' ? 0.002 : s.regime === 'Panic' ? -0.004 : 0)
  );
}

function computeRiskDelta(s: RunState): number {
  return (
    (s.cash < 10_000 ? 0.006 : -0.002) +
    (s.regime === 'Panic' ? 0.005 : 0) -
    (s.shields > 0 ? 0.002 : 0)
  );
}

function fireFateDeck(
  s: RunState,
  tick: number,
  rng: () => number,
  deckPool: GameCard[],
  dispatch: (e: RunEvent) => void,
): void {
  const r = rng();
  const fateType: GameCard['type'] =
    r < FATE_FUBAR_PCT ? 'FUBAR' :
    r < FATE_FUBAR_PCT + FATE_MISSED_PCT ? 'MISSED_OPPORTUNITY' :
    r < FATE_FUBAR_PCT + FATE_MISSED_PCT + FATE_SO_PCT ? 'SO' : 'PRIVILEGED';

  const pool = deckPool.filter((c) => c.type === fateType);
  if (!pool.length) return;
  const card = pool[Math.floor(rng() * pool.length)];

  if (fateType === 'FUBAR') {
    const riskScale = 1.5 + s.intelligence.risk * 0.6 + s.intelligence.volatility * 0.4;
    const adjustedHit = Math.round((card.cashImpact ?? -2_000) * riskScale);
    if (s.shields > 0) {
      dispatch({ type: 'CARD_FUBAR_BLOCKED', cardId: card.id, shieldSpent: true });
    } else if (Math.abs(adjustedHit) > 4_000) {
      dispatch({ type: 'COUNTERPLAY_OFFERED', eventLabel: card.name, adjustedHit });
    } else {
      dispatch({ type: 'CARD_PLAY_RESOLVED', card, cashDelta: adjustedHit, incomeDelta: 0, netWorthDelta: 0 });
      dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.fubar_hit', payload: { cardId: card.id, hit: adjustedHit } });
    }
  } else if (fateType === 'MISSED_OPPORTUNITY') {
    const lost = Math.max(2, (card.turnsLost ?? 1) + Math.floor(rng() * 3));
    dispatch({ type: 'FREEZE_APPLIED', ticks: lost, source: `FATE:${card.name}` });
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.missed', payload: { cardId: card.id, turnsLost: lost } });
  } else if (fateType === 'SO') {
    const expenseHit = Math.round(200 + rng() * 500);
    dispatch({ type: 'AID_SUBMITTED', recipientId: 'SYSTEM', aidType: 'EXPENSE_HIT', amount: expenseHit });
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.obstacle', payload: { cardId: card.id, expenseHit } });
  } else {
    // PRIVILEGED
    const v = card.value ?? 0;
    dispatch({ type: 'CARD_PLAY_RESOLVED', card, cashDelta: 0, incomeDelta: 0, netWorthDelta: v });
    dispatch({ type: 'SEASON_PULSE', xpGained: 20, dominionDelta: 0 });
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.privilege', payload: { cardId: card.id, value: v } });
  }
}

function fireCardDraw(
  s: RunState,
  rng: () => number,
  deckPool: GameCard[],
  dispatch: (e: RunEvent) => void,
): void {
  const pool = deckPool.filter((c) => c.type === 'OPPORTUNITY' || c.type === 'IPA');
  let drawn = pool[Math.floor(rng() * pool.length)];
  if (!drawn) return;

  // ML draw reroute
  if (
    drawn.type === 'FUBAR' &&
    (s.intelligence.recommendationPower - s.intelligence.risk) > 0.20 &&
    rng() < 0.55
  ) {
    const rerouted = deckPool.filter((c) => c.type !== 'FUBAR');
    const alt = rerouted[Math.floor(rng() * rerouted.length)];
    if (alt) drawn = alt;
  }

  const card: GameCard = { ...drawn, id: `${drawn.id}-${Math.floor(rng() * 1e9).toString(36)}`, origin: 'PLAYER_DRAW', visibility: 'SELF' };
  dispatch({ type: 'CARD_DRAWN', card });
  dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'cards.draw', payload: { cardId: card.id, cardType: card.type } });
}

function fireMacroEvent(
  s: RunState,
  rng: () => number,
  dispatch: (e: RunEvent) => void,
): void {
  type MacroEventDef = {
    id: string;
    label: string;
    regime: import('../types/runState').MarketRegime;
    event: RunEvent;
  };

  const macroEvents: MacroEventDef[] = [
    { id: 'bull',      label: '📈 Bull run! Income assets +10%',   regime: 'Expansion',   event: { type: 'REGIME_CHANGED', regime: 'Expansion' } },
    { id: 'recession', label: '📉 Recession hits. Expenses +12%',  regime: 'Compression', event: { type: 'REGIME_CHANGED', regime: 'Compression' } },
    { id: 'rally',     label: '💹 Market rally. Net worth +8%',    regime: 'Euphoria',    event: { type: 'REGIME_CHANGED', regime: 'Euphoria' } },
    { id: 'bill',      label: '🔥 Unexpected bill. -$2,000',       regime: 'Panic',       event: { type: 'FREEZE_APPLIED', ticks: 0, source: 'MACRO:bill' } },
    { id: 'integrity', label: '🛡️ Integrity sweep. +1 Shield.',   regime: 'Stable',      event: { type: 'REGIME_CHANGED', regime: 'Stable' } },
  ];

  const ev = macroEvents[Math.floor(rng() * macroEvents.length)];
  dispatch(ev.event);
  dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'macro.event', payload: { id: ev.id, label: ev.label, regime: ev.regime } });
}

// Ensure types are available
type RunState = import('../types/runState').RunState;
type GameCard = import('../types/cards').GameCard;
type RunEvent = import('../types/events').RunEvent;
type GameMode = import('../types/modes').GameMode;
