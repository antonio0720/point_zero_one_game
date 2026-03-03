/**
 * useMLLoop — src/ml/wiring/useMLLoop.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Call fireMLTick() once per tick, AFTER all engine pulses.
 * Drives PlayerModelEngine → IntelBars + HaterBotController → RunEvents.
 */

import { useCallback } from 'react';
import { useML } from './MLContext';
import type { RunSnapshot } from '../PlayerModelEngine';
import type { BotAction } from '../HaterBotController';

interface RunStateLike {
  tick:               number;
  totalTicks:         number;
  cash:               number;
  income:             number;
  expenses:           number;
  fubarCount:         number;
  shieldsUsed:        number;
  pressureTier:       1 | 2 | 3 | 4 | 5;
  pressure:           { score: number };
  tension:            { score: number };
  hubris:             { meter: number };
  biases:             { active: unknown[] };
  windows:            { missed: number; resolved: number; recentResponseMs: number[] };
  portfolio:          { hhi: number };
  obligationCoverage: number;
}

type DispatchFn = (e: { type: string; [k: string]: unknown }) => void;

function toSnapshot(s: RunStateLike): RunSnapshot {
  return {
    tick: s.tick, totalTicks: s.totalTicks,
    cash: s.cash, startingCash: 10_000,
    monthlyIncome: s.income, monthlyExpenses: s.expenses,
    fubarHits: s.fubarCount, shieldsUsed: s.shieldsUsed,
    hubrisMeter: s.hubris.meter,
    pressureScore: s.pressure.score, tensionScore: s.tension.score,
    activeBiasCount: s.biases.active.length,
    windowsMissed: s.windows.missed, windowsResolved: s.windows.resolved,
    recentPlayDelays: s.windows.recentResponseMs,
    portfolioDiversity: s.portfolio.hhi,
    obligationCoverage: s.obligationCoverage,
  };
}

function dispatchBotAction(action: BotAction, damage: number, dispatch: DispatchFn): void {
  switch (action) {
    case 'INJECT_FUBAR':
      dispatch({ type: 'FUBAR_TRIGGERED', source: 'BOT_HATER', cashHit: damage,
        severity: damage > 8_000 ? 'CRITICAL' : damage > 4_000 ? 'MAJOR' : 'MINOR' });
      break;
    case 'INJECT_OBLIGATION':
      dispatch({ type: 'OBLIGATION_INJECTED', source: 'BOT_HATER', monthlyAmount: Math.round(damage / 12) });
      break;
    case 'SABOTAGE_CASHFLOW':
      dispatch({ type: 'INCOME_REDUCED', source: 'BOT_HATER', incomeDelta: -Math.round(damage / 24) });
      break;
    case 'TRIGGER_ISOLATION_TAX':
      dispatch({ type: 'ISOLATION_TAX_APPLIED', source: 'BOT_HATER', taxAmount: damage, effectiveRate: 0.08 });
      break;
    case 'FORCE_BIAS_STATE':
      dispatch({ type: 'BIAS_FORCED', source: 'BOT_HATER', biasType: 'RECENCY' });
      break;
    case 'ACCELERATE_TICK_TIER':
      dispatch({ type: 'TICK_TIER_FORCED', source: 'BOT_HATER', tierDelta: 1 });
      break;
    case 'COUNTERPLAY_BLOCK':
      dispatch({ type: 'COUNTERPLAY_BLOCKED', source: 'BOT_HATER', ticks: 12 });
      break;
    case 'BACK_OFF':
    default:
      break;
  }
}

export function useMLLoop(state: RunStateLike, dispatch: DispatchFn) {
  const { actions } = useML();

  const fireMLTick = useCallback(() => {
    if (state.tick <= 0) return null;
    const decision = actions.updateIntel(toSnapshot(state), state.pressureTier);
    if (decision && decision.action !== 'BACK_OFF' && decision.damage > 0) {
      dispatchBotAction(decision.action, decision.damage, dispatch);
    }
    return decision;
  }, [state, dispatch, actions]);

  return { fireMLTick };
}