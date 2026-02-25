// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/runtime/runReducer.ts
// Sprint 1: Run State Reducer — pure state machine
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { RunState, IntelligenceState, SeasonState, ActiveSabotage, RescueWindow } from '../types/runState';
import type { GameCard } from '../types/cards';
import type { RunEvent } from '../types/events';
import { clamp } from '../core/math';
import {
  MAX_LOG, MAX_EQUITY_POINTS, SHIELD_BANKRUPTCY_RECOVERY,
  MONTH_TICKS, STARTING_CASH, STARTING_INCOME, STARTING_EXPENSES,
  RUN_TICKS, XP_PER_MONTH_CASHFLOW_UNIT, XP_MIN_PER_SETTLEMENT,
} from '../core/constants';
import { fmtMoney } from '../core/format';

// ── Reducer ───────────────────────────────────────────────────────────────────
export function runReducer(state: RunState, event: RunEvent): RunState {
  switch (event.type) {

    // ── Run Lifecycle ─────────────────────────────────────────────────────
    case 'RUN_START':
      return {
        ...state,
        mode:       event.mode,
        seed:       event.seed,
        screen:     'run',
        cash:       STARTING_CASH,
        income:     STARTING_INCOME,
        expenses:   STARTING_EXPENSES,
        netWorth:   STARTING_CASH,
        equityHistory: [STARTING_CASH],
        tick:       0,
        totalTicks: RUN_TICKS,
        freezeTicks: 0,
        shields:    0,
        shieldConsuming: false,
        hand:       [],
        haterSabotageCount: 0,
        activeSabotages:    [],
        rescueWindow:       null,
        battleState: { phase: 'PREP', score: { local: 0, opponent: 0 }, round: 1 },
        events:     [`🎮 Run started (seed=${event.seed}). Mode: ${event.mode}`],
        telemetry:  [],
      };

    case 'RUN_COMPLETE':
      return { ...state, screen: event.outcome === 'BANKRUPT' ? 'bankrupt' : 'result' };

    case 'SCREEN_TRANSITION':
      return { ...state, screen: event.to };

    // ── Tick ─────────────────────────────────────────────────────────────
    case 'TICK_ADVANCE': {
      const nextTick = event.tick;
      if (nextTick >= state.totalTicks) {
        return { ...state, screen: 'result' };
      }
      const newFreeze = state.freezeTicks > 0 ? state.freezeTicks - 1 : 0;
      // Sabotage countdown
      const newSabotages = state.activeSabotages
        .map((s) => ({ ...s, ticksRemaining: s.ticksRemaining - 1 }))
        .filter((s) => s.ticksRemaining > 0);
      // Rescue window countdown
      let newRescue = state.rescueWindow;
      if (newRescue) {
        if (newRescue.ticksRemaining <= 1) newRescue = null;
        else newRescue = { ...newRescue, ticksRemaining: newRescue.ticksRemaining - 1 };
      }
      return { ...state, tick: nextTick, freezeTicks: newFreeze, activeSabotages: newSabotages, rescueWindow: newRescue };
    }

    // ── Card Resolution ───────────────────────────────────────────────────
    case 'CARD_PLAY_RESOLVED': {
      const { card, cashDelta, incomeDelta, netWorthDelta } = event;
      const newCash     = clamp(state.cash     + cashDelta,     0, Infinity);
      const newIncome   = clamp(state.income   + incomeDelta,   0, Infinity);
      const newNetWorth = state.netWorth + netWorthDelta;
      const newHand = state.hand.filter((c) => c.id !== card.id);
      const msg = `✅ Played: ${card.name}${incomeDelta > 0 ? ` → +${fmtMoney(incomeDelta)}/mo` : ''}`;
      return {
        ...state,
        cash: newCash, income: newIncome, netWorth: newNetWorth,
        hand: newHand,
        events: appendLog(state.events, state.tick, msg),
      };
    }

    case 'CARD_PLAY_REJECTED': {
      const msg = `❌ Card rejected (${event.reason})`;
      return { ...state, events: appendLog(state.events, state.tick, msg) };
    }

    case 'CARD_DRAWN': {
      if (state.hand.length >= 5) return state;
      const msg = `📬 Drew: ${event.card.name}`;
      return {
        ...state,
        hand: [...state.hand, event.card],
        events: appendLog(state.events, state.tick, msg),
      };
    }

    case 'CARD_FUBAR_BLOCKED': {
      const newShields = event.shieldSpent ? Math.max(0, state.shields - 1) : state.shields;
      const msg = `🛡️ Shield blocked: ${event.cardId}`;
      return {
        ...state,
        shields: newShields,
        shieldConsuming: event.shieldSpent,
        events: appendLog(state.events, state.tick, msg),
      };
    }

    // ── Forced Events ─────────────────────────────────────────────────────
    case 'COUNTERPLAY_RESOLVED': {
      const msg = event.success
        ? `✅ Counterplay resolved (${event.actionId})`
        : `❌ Counterplay failed (${event.actionId})`;
      return {
        ...state,
        cash: clamp(state.cash - event.costSpent, 0, Infinity),
        events: appendLog(state.events, state.tick, msg),
      };
    }

    // ── Monthly Settlement ────────────────────────────────────────────────
    case 'MONTHLY_SETTLEMENT': {
      const { settlement, mlMod } = event;
      const newCash = state.cash + settlement;

      // Shield absorption of bankruptcy
      if (newCash <= 0 && state.shields > 0) {
        return {
          ...state,
          cash: SHIELD_BANKRUPTCY_RECOVERY,
          shields: state.shields - 1,
          shieldConsuming: true,
          netWorth: state.netWorth + settlement,
          equityHistory: appendEquity(state.equityHistory, state.netWorth + settlement),
          season: advanceSeason(state.season, settlement),
          events: appendLog(state.events, state.tick, '🛡️ Shield absorbed bankruptcy!'),
        };
      }

      // True bankruptcy — no shields
      if (newCash <= 0 && state.shields === 0) {
        return { ...state, cash: 0, screen: 'bankrupt' };
      }

      return {
        ...state,
        cash: newCash,
        netWorth: state.netWorth + settlement,
        equityHistory: appendEquity(state.equityHistory, state.netWorth + settlement),
        season: advanceSeason(state.season, settlement),
        events: appendLog(
          state.events, state.tick,
          `📊 Settlement: ${settlement >= 0 ? '+' : ''}${fmtMoney(settlement)} (×${mlMod.toFixed(2)} ML mod)`,
        ),
      };
    }

    // ── Regime ────────────────────────────────────────────────────────────
    case 'REGIME_CHANGED':
      return { ...state, regime: event.regime };

    // ── Shield ────────────────────────────────────────────────────────────
    case 'SHIELD_PROC': {
      return {
        ...state,
        shields: state.shields - 1,
        shieldConsuming: true,
        events: appendLog(state.events, state.tick, `🛡️ Shield proc: saved ${fmtMoney(event.cashSaved)}`),
      };
    }

    case 'SHIELD_CONSUMED':
      return { ...state, shieldConsuming: false };

    // ── Freeze ────────────────────────────────────────────────────────────
    case 'FREEZE_APPLIED':
      return {
        ...state,
        freezeTicks: state.freezeTicks + event.ticks,
        events: appendLog(state.events, state.tick, `⏸ Frozen +${event.ticks}t (${event.source})`),
      };

    // ── Sabotage ──────────────────────────────────────────────────────────
    case 'SABOTAGE_RECEIVED': {
      const sab: ActiveSabotage = {
        id: event.sabotageId,
        kind: event.kind,
        label: event.kind.replace(/_/g, ' '),
        severity: event.intensity > 0.7 ? 'CRITICAL' : event.intensity > 0.4 ? 'MAJOR' : 'MINOR',
        ticksRemaining: Math.ceil(24 * event.intensity),
        sourceDisplayName: event.sourceDisplayName,
        impactValue: Math.round(500 * event.intensity),
      };
      return {
        ...state,
        haterSabotageCount: state.haterSabotageCount + 1,
        activeSabotages: [...state.activeSabotages.slice(-4), sab],
        events: appendLog(state.events, state.tick, `💥 Sabotage: ${event.kind} from ${event.sourceDisplayName}`),
      };
    }

    case 'SABOTAGE_COUNTERED':
      return {
        ...state,
        activeSabotages: state.activeSabotages.filter((s) => s.id !== event.sabotageId),
        events: appendLog(state.events, state.tick, `✅ Sabotage countered: ${event.sabotageId}`),
      };

    // ── Battle ────────────────────────────────────────────────────────────
    case 'BATTLE_PHASE_CHANGED':
      return { ...state, battleState: { ...state.battleState, phase: event.phase } };

    case 'BATTLE_SCORE_UPDATE':
      return {
        ...state,
        battleState: {
          ...state.battleState,
          score: { local: event.local, opponent: event.opponent },
          round: state.battleState.round + 1,
        },
      };

    // ── Syndicate ─────────────────────────────────────────────────────────
    case 'RESCUE_WINDOW_OPENED':
      return {
        ...state,
        rescueWindow: {
          rescueeDisplayName: event.rescueeDisplayName,
          rescueeNetWorth: 0,
          ticksRemaining: event.ticksRemaining,
          allianceName: 'APEX SYNDICATE',
          contributionRequired: 10_000,
          totalContributed: 0,
        },
      };

    case 'RESCUE_CONTRIBUTION': {
      if (!state.rescueWindow) return state;
      return {
        ...state,
        cash: clamp(state.cash - event.amount, 0, Infinity),
        rescueWindow: { ...state.rescueWindow, totalContributed: state.rescueWindow.totalContributed + event.amount },
        events: appendLog(state.events, state.tick, `🤝 Contributed ${fmtMoney(event.amount)} to rescue`),
      };
    }

    case 'RESCUE_DISMISSED':
      return { ...state, rescueWindow: null };

    case 'AID_SUBMITTED':
      return {
        ...state,
        cash: event.aidType === 'CASH' ? clamp(state.cash - event.amount, 0, Infinity) : state.cash,
        events: appendLog(state.events, state.tick, `📤 Aid sent: ${event.aidType} ${fmtMoney(event.amount)}`),
      };

    // ── Season ────────────────────────────────────────────────────────────
    case 'SEASON_PULSE': {
      const next = {
        ...state.season,
        xp:              state.season.xp + event.xpGained,
        dominionControl: state.season.dominionControl + event.dominionDelta,
      };
      next.passTier = Math.max(1, Math.floor(next.xp / 100) + 1);
      next.battlePassLevel = next.passTier;
      return { ...state, season: next };
    }

    // ── Telemetry ─────────────────────────────────────────────────────────
    case 'TELEMETRY_EMIT':
      return {
        ...state,
        telemetry: [
          ...state.telemetry.slice(-299),
          { tick: state.tick, type: event.telemetryType, payload: event.payload },
        ],
      };

    default:
      return state;
  }
}

// ── Private Helpers ────────────────────────────────────────────────────────────
function appendLog(events: string[], tick: number, msg: string): string[] {
  return [...events.slice(-(MAX_LOG - 1)), `[T${tick}] ${msg}`];
}

function appendEquity(history: number[], value: number): number[] {
  return [...history.slice(-(MAX_EQUITY_POINTS - 1)), value];
}

function advanceSeason(season: SeasonState, settlement: number): SeasonState {
  const xpGain = Math.max(XP_MIN_PER_SETTLEMENT, Math.round(Math.max(0, settlement) / XP_PER_MONTH_CASHFLOW_UNIT));
  const next = {
    ...season,
    xp:              season.xp + xpGain,
    dominionControl: clamp(season.dominionControl + (settlement > 0 ? 1 : -1), 0, 9999),
    nodePressure:    clamp(season.nodePressure + (settlement < 0 ? 2 : -1), 0, 9999),
    rewardsPending:  season.rewardsPending + (settlement > 0 ? 1 : 0),
    winStreak:       settlement > 0 ? season.winStreak + 1 : 0,
  };
  next.passTier = Math.max(1, Math.floor(next.xp / 100) + 1);
  next.battlePassLevel = next.passTier;
  return next;
}

// Re-import needed type for advanceSeason
type SeasonState = import('../types/runState').SeasonState;
