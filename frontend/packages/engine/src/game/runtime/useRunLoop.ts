// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/runtime/useRunLoop.ts
// Sprint 8: Run Loop Hook — Complete Overhaul
// Density6 LLC · Confidential · All Rights Reserved
//
// ML WIRING (Sprint 9):
//   ✦ PlayerModelEngine fires every tick via mlActionsRef — O(1) cost
//   ✦ HaterBotController decision translated to RunEvent when damage > 0
//   ✦ KnowledgeTracer records every CARD_PLAY_RESOLVED via mlDispatch wrapper
//   ✦ All ML calls are ref-guarded — zero stale closure risk
//   ✦ ML failures caught by existing RUNTIME_ERROR guard — non-fatal
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import type { RunStateExt }               from './runReducer';
import type { RunEvent }                  from '../types/events';
import type { GameMode }                  from '../types/modes';
import type { GameCard, CardInHand }      from '../types/cards';
import type { BotAction }                 from '../../ml/HaterBotController';
import { clamp }                          from '../core/math';
import {
  TICK_MS, MONTH_TICKS, DRAW_TICKS, MAX_HAND,
  FATE_TICKS, FATE_FUBAR_PCT, FATE_MISSED_PCT, FATE_SO_PCT,
  MACRO_EVENT_TICKS, SEASON_PULSE_TICKS, GHOST_TICK_INTERVAL,
  INTEGRITY_CHECK_TICKS, BATTLE_ROUND_TICKS,
  RESCUE_WINDOW_INTERVAL, RESCUE_WINDOW_CHANCE, RESCUE_WINDOW_DURATION,
  FREEDOM_THRESHOLD,
  XP_PER_MONTH_CASHFLOW_UNIT, XP_MIN_PER_SETTLEMENT,
  REPLAY_SNAPSHOT_INTERVAL, ML_CONFIDENCE_DECAY_PER_TICK,
  PRESSURE_CRITICAL_THRESHOLD,
} from '../core/constants';
import { useML } from '../../ml/wiring/MLContext';

// ── Hook Interface ─────────────────────────────────────────────────────────────

export interface UseRunLoopOptions {
  state:             RunStateExt;
  dispatch:          (event: RunEvent) => void;
  rng:               () => number;
  deckPool:          GameCard[];
  onMechanicPulse?: (tick: number, mode: GameMode) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_TICKS_PER_FRAME            = 3;
const BLEED_ACTIVATION_RATIO         = 0.5;
const PSYCHE_DECAY_PER_TICK          = 0.002;
const TRUST_LEAK_PER_MONTH           = 0.01;
const PHANTOM_PRESSURE_GAP_THRESHOLD = 0.30;

// ── ML: Zone → Educational Tag ─────────────────────────────────────────────────

const ZONE_TO_EDU_TAG: Record<string, string> = {
  BUILD:   'cashflow_management',
  SCALE:   'leverage_risk',
  FLIP:    'market_timing',
  RESERVE: 'liquidity_management',
  LEARN:   'due_diligence',
};

const WINDOW_MS_BY_TIER: Record<number, number> = {
  1: 12_000, 2: 9_000, 3: 6_000, 4: 4_000, 5: 2_500,
};

// ── ML: BotAction → RunEvent ───────────────────────────────────────────────────

function dispatchBotAction(
  action:   BotAction,
  damage:   number,
  dispatch: (e: RunEvent) => void,
): void {
  switch (action) {
    case 'INJECT_FUBAR':
      dispatch({ type: 'FUBAR_TRIGGERED', source: 'BOT_HATER', cashHit: damage,
        severity: damage > 8_000 ? 'CRITICAL' : damage > 4_000 ? 'MAJOR' : 'MINOR',
      } as unknown as RunEvent);
      break;
    case 'INJECT_OBLIGATION':
      dispatch({ type: 'OBLIGATION_INJECTED', source: 'BOT_HATER',
        monthlyAmount: Math.round(damage / 12),
      } as unknown as RunEvent);
      break;
    case 'SABOTAGE_CASHFLOW':
      dispatch({ type: 'INCOME_REDUCED', source: 'BOT_HATER',
        incomeDelta: -Math.round(damage / 24),
      } as unknown as RunEvent);
      break;
    case 'TRIGGER_ISOLATION_TAX':
      dispatch({ type: 'ISOLATION_TAX_APPLIED', source: 'BOT_HATER',
        taxAmount: damage, effectiveRate: 0.08,
      } as unknown as RunEvent);
      break;
    case 'FORCE_BIAS_STATE':
      dispatch({ type: 'BIAS_FORCED', source: 'BOT_HATER', biasType: 'RECENCY' } as unknown as RunEvent);
      break;
    case 'ACCELERATE_TICK_TIER':
      dispatch({ type: 'TICK_TIER_FORCED', source: 'BOT_HATER', tierDelta: 1 } as unknown as RunEvent);
      break;
    case 'COUNTERPLAY_BLOCK':
      dispatch({ type: 'COUNTERPLAY_BLOCKED', source: 'BOT_HATER', ticks: 12 } as unknown as RunEvent);
      break;
    case 'BACK_OFF':
    case 'SPAWN_RIVAL_BOT':
    default:
      break;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRunLoop({
  state,
  dispatch,
  rng,
  deckPool,
  onMechanicPulse,
}: UseRunLoopOptions): void {
  const stateRef    = useRef(state);
  const rngRef      = useRef(rng);
  const deckRef     = useRef(deckPool);
  const lastTickAt  = useRef<number>(performance.now());
  const accumulator = useRef<number>(0);

  stateRef.current = state;
  rngRef.current   = rng;
  deckRef.current  = deckPool;

  // ── ML ref — keeps mlActions current inside stable fireTick callback ─────
  const { actions: mlActions } = useML();
  const mlActionsRef = useRef(mlActions);
  mlActionsRef.current = mlActions;

  const fireTick = useCallback(() => {
    const s        = stateRef.current;
    if (s.screen !== 'run') return;

    const nextTick     = s.tick + 1;
    const pressureTier = Math.min(5, Math.max(1, (s as any).pressureTier ?? 1)) as 1|2|3|4|5;

    // ── ML: Intercepting dispatch wrapper ────────────────────────────────
    const mlDispatch = (e: RunEvent): void => {
      dispatch(e);
      if ((e as any).type !== 'CARD_PLAY_RESOLVED') return;

      try {
        const ev          = e as any;
        const card        = ev.card ?? {};
        const notFubar    = card.type !== 'FUBAR';
        const positive    = (ev.cashDelta ?? 0) > 0 || (ev.incomeDelta ?? 0) > 0 || (ev.netWorthDelta ?? 0) > 0;
        const wasCorrect  = pressureTier >= 3 ? notFubar : (notFubar && positive);
        const recentMs    = (s as any).windows?.recentResponseMs ?? [];
        const lastMs      = recentMs[recentMs.length - 1] ?? 3_000;
        const windowMs    = WINDOW_MS_BY_TIER[pressureTier];
        const speedScore  = Math.max(0, Math.min(1, 1 - lastMs / windowMs));
        const tag         =
          card.educationalTag    ??
          card.educational_tag   ??
          (card.zone ? ZONE_TO_EDU_TAG[card.zone as string] : undefined) ??
          'cashflow_management';

        mlActionsRef.current.recordCardPlay({ tag, wasCorrect, pressureTier, tick: nextTick, speedScore });
      } catch {
        // KnowledgeTracer failure must never crash the tick
      }
    };

    try {
      // ── Advance tick counter ──
      dispatch({ type: 'TICK_ADVANCE', tick: nextTick });

      // ── Intelligence update ──
      dispatch({
        type:       'INTELLIGENCE_UPDATE',
        alphaDelta: computeAlphaDelta(s),
        riskDelta:  computeRiskDelta(s),
      });

      // ── FREEDOM check ──
      if (s.netWorth >= FREEDOM_THRESHOLD) {
        dispatch({ type: 'RUN_COMPLETE', outcome: 'FREEDOM', tick: nextTick });
        return;
      }

      // ── Mode engine pulse ──
      onMechanicPulse?.(nextTick, s.mode);

      // ── FREEZE GUARD ──
      if (s.freezeTicks > 0) {
        dispatch({
          type:          'TELEMETRY_EMIT',
          telemetryType: 'tick.frozen',
          payload:       { tick: nextTick, freezeRemaining: s.freezeTicks },
        });
        return;
      }

      // ── Monthly Settlement ──
      if (nextTick % MONTH_TICKS === 0) {
        const cashflow   = s.income - s.expenses;
        const mlMod      = 1 + (s.intelligence.alpha - s.intelligence.risk) * 0.04;
        const settlement = Math.round(cashflow * mlMod);

        dispatch({ type: 'MONTHLY_SETTLEMENT', settlement, cashflow, mlMod });
        dispatch({
          type:          'TELEMETRY_EMIT',
          telemetryType: 'economy.monthly_settlement',
          payload:       { settlement, cashflow, mlMod: +mlMod.toFixed(3), tick: nextTick },
        });

        // SYNDICATE: trust decay on every settlement tick
        if (s.mode === 'TEAM_UP') {
          const newTrust = clamp(s.syndicateExt.trustValue - TRUST_LEAK_PER_MONTH, 0, 1);
          dispatch({
            type:        'SYNDICATE_TRUST_UPDATE',
            newValue:    newTrust,
            leakageRate: s.syndicateExt.leakageRate,
          } as unknown as RunEvent);
          if (newTrust < 0.3) {
            dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'syndicate.trust_critical', payload: { trustValue: newTrust, tick: nextTick } });
          }
        }
      }

      // ── Fate Deck ──
      if (nextTick % FATE_TICKS === 0 && nextTick > 0) {
        fireFateDeck(s, nextTick, rngRef.current, deckRef.current, mlDispatch);
      }

      // ── Card Draw ──
      if (nextTick % DRAW_TICKS === 0 && s.hand.length < MAX_HAND) {
        fireCardDraw(s, rngRef.current, deckRef.current, dispatch);
      }

      // ── Macro Events ──
      if (nextTick % MACRO_EVENT_TICKS === 0 && nextTick > 0) {
        fireMacroEvent(s, rngRef.current, mlDispatch);
      }

      // ── Season Pulse ──
      if (nextTick % SEASON_PULSE_TICKS === 0 && nextTick > 0) {
        const cashflow = s.income - s.expenses;
        const xpGained = Math.max(
          XP_MIN_PER_SETTLEMENT,
          Math.round(Math.max(0, cashflow) / XP_PER_MONTH_CASHFLOW_UNIT),
        );
        dispatch({ type: 'SEASON_PULSE', xpGained, dominionDelta: cashflow > 0 ? 1 : -1 });
        dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'season.pulse', payload: { xp: s.season.xp, tier: s.season.passTier, xpGained, tick: nextTick } });
      }

      // ── Mode-Specific Pulses ──
      switch (s.mode) {
        case 'GO_ALONE':       fireEmpirePulse(s, nextTick, rngRef.current, dispatch); break;
        case 'HEAD_TO_HEAD':   firePredatorPulse(s, nextTick, rngRef.current, mlDispatch); break;
        case 'CHASE_A_LEGEND': firePhantomPulse(s, nextTick, dispatch); break;
      }

      // ── ML TICK ─────────────────────────────────────────────────────────
      {
        const mlSnap = {
          tick:               nextTick,
          totalTicks:         (s as any).totalTicks         ?? 720,
          cash:               s.cash,
          startingCash:       (s as any).startingCash       ?? 10_000,
          monthlyIncome:      s.income,
          monthlyExpenses:    s.expenses,
          fubarHits:          (s as any).fubarHits          ?? (s as any).fubarCount ?? 0,
          shieldsUsed:        (s as any).shieldsUsed        ?? s.shields             ?? 0,
          // RunStateExt doesn't expose hubris/pressure/tension directly — read via any
          hubrisMeter:        (s as any).hubris?.meter      ?? 0,
          pressureScore:      (s as any).pressure?.score    ?? 0,
          tensionScore:       (s as any).tension?.score     ?? 0,
          activeBiasCount:    (s as any).activeBiases?.length ?? (s as any).biases?.active?.length ?? 0,
          windowsMissed:      (s as any).windows?.missed     ?? 0,
          windowsResolved:    (s as any).windows?.resolved   ?? 0,
          recentPlayDelays:   (s as any).windows?.recentResponseMs ?? [],
          portfolioDiversity: (s as any).portfolio?.hhi      ?? 0.5,
          obligationCoverage: (s as any).obligationCoverage  ?? 1,
        };

        try {
          const botDecision = mlActionsRef.current.updateIntel(mlSnap, pressureTier);
          if (botDecision && botDecision.action !== 'BACK_OFF' && botDecision.damage > 0) {
            dispatchBotAction(botDecision.action, botDecision.damage, dispatch);
          }
        } catch {
          // ML failure must never crash the tick — game loop is sovereign
        }
      }

      // ── Checkpoint ──
      if (nextTick % REPLAY_SNAPSHOT_INTERVAL === 0 && nextTick > 0) {
        dispatch({ type: 'CHECKPOINT_SAVED' } as unknown as RunEvent);
        dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'checkpoint.snapshot', payload: { tick: nextTick, cash: s.cash, netWorth: s.netWorth, income: s.income, xp: s.season.xp } });
      }

      // ── Integrity Heartbeat ──
      if (nextTick % INTEGRITY_CHECK_TICKS === 0) {
        const antiCheatDelta = s.hand.length >= MAX_HAND ? -0.002 : 0.001;
        dispatch({ type: 'INTELLIGENCE_UPDATE', alphaDelta: 0, riskDelta: antiCheatDelta });
        dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'integrity.heartbeat', payload: { antiCheat: +s.intelligence.antiCheat.toFixed(3), tick: nextTick } });
      }

      // ── Rescue Window (TEAM_UP / Syndicate) ──
      if (
        nextTick % RESCUE_WINDOW_INTERVAL === 0 && nextTick > 0 &&
        s.mode === 'TEAM_UP' && !s.rescueWindow &&
        rngRef.current() < RESCUE_WINDOW_CHANCE
      ) {
        const rescueeNames = ['CIPHER_9', 'APEX_7', 'DELTA_3', 'NODE_ZERO'];
        const rescueeName  = rescueeNames[Math.floor(rngRef.current() * rescueeNames.length)];
        dispatch({
          type:               'RESCUE_WINDOW_OPENED',
          rescueeDisplayName: rescueeName,
          ticksRemaining:     RESCUE_WINDOW_DURATION,
          windowId:           `RW_${nextTick}_${Math.floor(rngRef.current() * 1e6)}`,
        } as unknown as RunEvent);
      }

    } catch (err: unknown) {
      dispatch({
        type:      'RUNTIME_ERROR',
        errorCode: 'TICK_EXCEPTION',
        message:   err instanceof Error ? err.message : String(err),
      } as unknown as RunEvent);
    }
  }, []); // stable reference — all state accessed via refs

  useEffect(() => {
    if (state.screen !== 'run') return;

    lastTickAt.current  = performance.now();
    accumulator.current = 0;

    const tick = () => {
      const now     = performance.now();
      const elapsed = now - lastTickAt.current;
      lastTickAt.current = now;

      accumulator.current = Math.min(
        accumulator.current + elapsed,
        TICK_MS * MAX_TICKS_PER_FRAME,
      );

      let fired = 0;
      while (accumulator.current >= TICK_MS && fired < MAX_TICKS_PER_FRAME) {
        accumulator.current -= TICK_MS;
        if (stateRef.current.screen === 'run') {
          fireTick();
          fired++;
        } else {
          break;
        }
      }

      timerId.current = window.setTimeout(tick, Math.max(0, TICK_MS - (performance.now() - now)));
    };

    const timerId = { current: window.setTimeout(tick, TICK_MS) };
    return () => { window.clearTimeout(timerId.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, state.mode, fireTick]);
}

// ── EMPIRE (GO_ALONE) Mode Pulse ──────────────────────────────────────────────

function fireEmpirePulse(s: RunStateExt, tick: number, rng: () => number, dispatch: (e: RunEvent) => void): void {
  const bleedThreshold   = s.income * BLEED_ACTIVATION_RATIO;
  const isBleedCondition = s.cash < bleedThreshold && s.income < s.expenses;

  if (isBleedCondition && !s.empireExt.bleedActive) {
    dispatch({ type: 'EMPIRE_BLEED_ACTIVATED', severity: 'WATCH', cash: s.cash, cashflow: s.income - s.expenses } as unknown as RunEvent);
  } else if (!isBleedCondition && s.empireExt.bleedActive) {
    dispatch({ type: 'BLEED_RESOLVED' } as unknown as RunEvent);
  } else if (s.empireExt.bleedActive) {
    const dur             = s.empireExt.bleedDurationTicks;
    const currentSeverity = s.empireExt.bleedSeverity;
    const cashRatio       = s.cash / Math.max(1, s.income);
    if (dur > 60 && cashRatio < 0.1 && currentSeverity !== 'TERMINAL') {
      dispatch({ type: 'EMPIRE_BLEED_ESCALATED', from: currentSeverity, to: 'TERMINAL' } as unknown as RunEvent);
    } else if (dur > 24 && cashRatio < 0.25 && currentSeverity === 'WATCH') {
      dispatch({ type: 'EMPIRE_BLEED_ESCALATED', from: 'WATCH', to: 'CRITICAL' } as unknown as RunEvent);
    }
  }

  if (tick % BATTLE_ROUND_TICKS === 0) {
    const waveConfig = getEmpireWave(tick);
    if (waveConfig.wave !== s.empireExt.currentWave) {
      // Map wave number → RunPhase for type safety
      const toPhase = (w: number): 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY' =>
        w <= 1 ? 'FOUNDATION' : w <= 3 ? 'ESCALATION' : 'SOVEREIGNTY';
      dispatch({
        type: 'EMPIRE_PHASE_CHANGED',
        from: toPhase(s.empireExt.currentWave),
        to:   toPhase(waveConfig.wave),
        wave: waveConfig.wave,
        bots: waveConfig.botActivations,
      } as unknown as RunEvent);
    }
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'empire.counter_budget_reset', payload: { tick, wave: waveConfig.wave, budget: 5 } });
  }
}

function getEmpireWave(tick: number): { wave: number; botActivations: number } {
  if (tick >= 576) return { wave: 5, botActivations: 5 };
  if (tick >= 432) return { wave: 4, botActivations: 4 };
  if (tick >= 288) return { wave: 3, botActivations: 3 };
  if (tick >= 144) return { wave: 2, botActivations: 2 };
  return { wave: 1, botActivations: 1 };
}

// ── PREDATOR (HEAD_TO_HEAD) Mode Pulse ────────────────────────────────────────

function firePredatorPulse(s: RunStateExt, tick: number, rng: () => number, dispatch: (e: RunEvent) => void): void {
  const ext = s.predatorExt;
  if (!ext.inTilt && ext.psycheValue > 0) {
    const newPsyche = clamp(ext.psycheValue - PSYCHE_DECAY_PER_TICK, 0, 1);
    dispatch({ type: 'PSYCHE_UPDATE', newValue: newPsyche, inTilt: false } as unknown as RunEvent);
  }

  if (s.pendingCounterplay?.active) {
    const offeredAt = s.pendingCounterplay.offeredAtTick;
    if (tick - offeredAt > 6) {
      dispatch({ type: 'CARD_PLAY_RESOLVED', card: { id: 'COUNTERPLAY_MISS', name: 'Missed Counterplay', type: 'FUBAR' } as unknown as CardInHand, cashDelta: s.pendingCounterplay.adjustedHit, incomeDelta: 0, netWorthDelta: 0 });
      dispatch({ type: 'COUNTERPLAY_RESOLVED', actionId: 'EXPIRED', success: false, costSpent: 0 });
      dispatch({ type: 'PSYCHE_UPDATE', newValue: clamp(ext.psycheValue + 0.12, 0, 1), inTilt: clamp(ext.psycheValue + 0.12, 0, 1) >= 0.8 } as unknown as RunEvent);
    }
  }

  if (tick % BATTLE_ROUND_TICKS === 0 && tick > 0) {
    const builderLeads = (s.intelligence.alpha * 0.6 + (1 - s.predatorExt.psycheValue) * 0.4) > 0.5;
    dispatch({ type: 'BATTLE_SCORE_UPDATE', local: s.battleState.score.local + (builderLeads ? 1 : 0), opponent: s.battleState.score.opponent + (builderLeads ? 0 : 1) });
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'predator.battle_round', payload: { tick, local: s.battleState.score.local, opponent: s.battleState.score.opponent } });
  }
}

// ── PHANTOM (CHASE_A_LEGEND) Mode Pulse ───────────────────────────────────────

function firePhantomPulse(s: RunStateExt, tick: number, dispatch: (e: RunEvent) => void): void {
  if (tick % GHOST_TICK_INTERVAL === 0 && tick > 0 && s.phantomExt.ghostLoaded) {
    const ghostAdvance   = s.income * 0.95;
    const netWorthGap    = s.netWorth - ghostAdvance;
    const netWorthGapPct = ghostAdvance > 0 ? (netWorthGap / ghostAdvance) * 100 : 0;
    const isAhead        = netWorthGap >= 0;

    dispatch({
      type:              'PHANTOM_GHOST_DELTA_UPDATE',
      netWorthGap,
      netWorthGapPct,
      cordGap:           0,
      isAhead,
      pressureIntensity: isAhead ? 0 : clamp(Math.abs(netWorthGapPct) / 50, 0, 1),
      dominantMarker:    null,
    } as unknown as RunEvent);

    dispatch(
      isAhead
        ? { type: 'PHANTOM_AHEAD_OF_GHOST', netWorthGap, cordGap: 0, ticksRemaining: 0 } as unknown as RunEvent
        : { type: 'PHANTOM_BEHIND_GHOST',   netWorthGap, cordGap: 0, ticksRemaining: 0 } as unknown as RunEvent
    );

    if (!isAhead && Math.abs(netWorthGapPct) / 100 > PHANTOM_PRESSURE_GAP_THRESHOLD) {
      dispatch({ type: 'FORCED_EVENT_TRIGGERED', eventType: 'LEGEND_PRESSURE', cardId: `PHANTOM_PRESSURE_${tick}`, source: 'PHANTOM_ENGINE' as any, deckType: 'LEGEND' as any });
      dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'phantom.legend_pressure', payload: { tick, gapPct: +netWorthGapPct.toFixed(2) } });
    }
  }
}

// ── Intelligence Helpers ───────────────────────────────────────────────────────

function computeAlphaDelta(s: RunStateExt): number {
  const cashflow = s.income - s.expenses;
  return (
    (cashflow > 0 ? 0.004 : -0.003) +
    (s.season.winStreak > 0 ? 0.002 : 0) +
    (s.regime === 'Expansion' ? 0.002 : s.regime === 'Panic' ? -0.004 : 0) -
    ML_CONFIDENCE_DECAY_PER_TICK
  );
}

function computeRiskDelta(s: RunStateExt): number {
  return (
    (s.cash < 10_000 ? 0.006 : -0.002) +
    (s.regime === 'Panic' ? 0.005 : 0) -
    (s.shields > 0 ? 0.002 : 0) +
    (s.activeSabotages.length > 0 ? 0.003 : 0)
  );
}

// ── Fate Deck ─────────────────────────────────────────────────────────────────

function fireFateDeck(s: RunStateExt, tick: number, rng: () => number, deckPool: GameCard[], dispatch: (e: RunEvent) => void): void {
  const r        = rng();
  const fateType = r < FATE_FUBAR_PCT ? 'FUBAR'
    : r < FATE_FUBAR_PCT + FATE_MISSED_PCT ? 'MISSED_OPPORTUNITY'
    : r < FATE_FUBAR_PCT + FATE_MISSED_PCT + FATE_SO_PCT ? 'SO'
    : 'PRIVILEGED';

  const pool = deckPool.filter((c) => c.type === fateType);
  if (!pool.length) return;

  const card = pool[Math.floor(rng() * pool.length)];

  if (fateType === 'FUBAR') {
    const riskScale   = 1.5 + s.intelligence.risk * 0.6 + s.intelligence.volatility * 0.4;
    const adjustedHit = Math.round((card.cashImpact ?? -2_000) * riskScale);
    if (s.shields > 0) {
      dispatch({ type: 'CARD_FUBAR_BLOCKED', cardId: card.id, shieldSpent: true });
    } else if (Math.abs(adjustedHit) > 4_000) {
      dispatch({ type: 'COUNTERPLAY_OFFERED', eventLabel: card.name, adjustedHit });
    } else {
      dispatch({ type: 'CARD_PLAY_RESOLVED', card: card as unknown as CardInHand, cashDelta: adjustedHit, incomeDelta: 0, netWorthDelta: 0 });
      dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.fubar_hit', payload: { cardId: card.id, hit: adjustedHit, tick } });
    }
  } else if (fateType === 'MISSED_OPPORTUNITY') {
    const lost = Math.max(2, (card.turnsLost ?? 1) + Math.floor(rng() * 3));
    dispatch({ type: 'FREEZE_APPLIED', ticks: lost, source: `FATE:${card.name}` });
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.missed', payload: { cardId: card.id, turnsLost: lost, tick } });
  } else if (fateType === 'SO') {
    const expenseHit = Math.round(200 + rng() * 800);
    const soCard: GameCard = { ...card, id: `${card.id}-so-${tick}`, origin: 'FATE', visibility: 'ALL' };
    dispatch({ type: 'CARD_PLAY_RESOLVED', card: soCard as unknown as CardInHand, cashDelta: -expenseHit, incomeDelta: 0, netWorthDelta: -expenseHit });
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.obstacle', payload: { cardId: card.id, expenseHit, tick } });
  } else {
    const v = card.value ?? 0;
    dispatch({ type: 'CARD_PLAY_RESOLVED', card: card as unknown as CardInHand, cashDelta: 0, incomeDelta: 0, netWorthDelta: v });
    dispatch({ type: 'SEASON_PULSE', xpGained: 20, dominionDelta: 0 });
    dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'fate.privilege', payload: { cardId: card.id, value: v, tick } });
  }
}

// ── Card Draw ─────────────────────────────────────────────────────────────────

function fireCardDraw(s: RunStateExt, rng: () => number, deckPool: GameCard[], dispatch: (e: RunEvent) => void): void {
  let pool = deckPool.filter((c) => c.type === 'OPPORTUNITY' || c.type === 'IPA');

  const alphaEdge = s.intelligence.recommendationPower - s.intelligence.risk;
  if (alphaEdge > 0.20 && rng() < 0.55) {
    const highValue = pool.filter((c) => (c.value ?? 0) > 2_000 || ((c as any).incomeEffect ?? 0) > 300);
    if (highValue.length > 0) pool = highValue;
  }

  // PREDATOR (HEAD_TO_HEAD): weaken draws while in tilt
  if (s.mode === 'HEAD_TO_HEAD' && s.predatorExt.inTilt) {
    const weakPool = pool.filter((c) => (c.value ?? 0) < 1_000);
    if (weakPool.length > 0) pool = weakPool;
  }

  if (!pool.length) return;

  const drawn = pool[Math.floor(rng() * pool.length)];
  const card: GameCard = { ...drawn, id: `${drawn.id}-${Math.floor(rng() * 1e9).toString(36)}`, origin: 'PLAYER_DRAW', visibility: 'SELF' };

  dispatch({
    type: 'CARD_DRAWN',
    card: card as unknown as CardInHand,
    deckType: card.type as any, // or use a mapping if needed
    rarity: (card as any).rarity ?? 'COMMON', // default to 'COMMON' if not present
  });

  const cardValue = card.value ?? 0;
  if (cardValue > 5_000 || ((card as any).incomeEffect ?? 0) > 500) {
    dispatch({ type: 'MECHANIC_TOUCHED', mechanicId: `DRAW_HIGH_VALUE_${card.type}`, signal: Math.min(1, cardValue / 20_000) });
  }

  dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'cards.draw', payload: { cardId: card.id, cardType: card.type } });
}

// ── Macro Events ──────────────────────────────────────────────────────────────

function fireMacroEvent(s: RunStateExt, rng: () => number, dispatch: (e: RunEvent) => void): void {
  type MacroDef = { id: string; label: string; fire: () => void };

  const macroEvents: MacroDef[] = [
    { id: 'bull',      label: '📈 Bull run! Income assets +10%', fire: () => dispatch({ type: 'REGIME_CHANGED', regime: 'Expansion' }) },
    { id: 'recession', label: '📉 Recession hits. Expenses +12%', fire: () => dispatch({ type: 'REGIME_CHANGED', regime: 'Compression' }) },
    { id: 'rally',     label: '💹 Market rally. Net worth +8%', fire: () => dispatch({ type: 'REGIME_CHANGED', regime: 'Euphoria' }) },
    {
      id:    'bill',
      label: '🔥 Unexpected bill. -$2,000',
      fire: () => {
        const billAmount = Math.round(1_000 + rng() * 2_000);
        const billCard: GameCard = { id: `MACRO_BILL_${Date.now()}`, name: 'Unexpected Bill', type: 'FUBAR', origin: 'MACRO', visibility: 'ALL' } as GameCard;
        dispatch({ type: 'CARD_PLAY_RESOLVED', card: billCard as unknown as CardInHand, cashDelta: -billAmount, incomeDelta: 0, netWorthDelta: -billAmount });
      },
    },
    { id: 'integrity', label: '🛡️ Integrity sweep. +1 Shield.', fire: () => dispatch({ type: 'REGIME_CHANGED', regime: 'Stable' }) },
  ];

  const ev = macroEvents[Math.floor(rng() * macroEvents.length)];
  ev.fire();
  dispatch({ type: 'TELEMETRY_EMIT', telemetryType: 'macro.event', payload: { id: ev.id, label: ev.label } });
}