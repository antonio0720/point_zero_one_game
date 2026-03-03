// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/cardResolver.ts
// Sprint 3: EventBus-Wired Card Resolution Pipeline
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Pipeline: intent → policyCheck → modeAdapter → RunEvents dispatched
// Now emits to full EventBus with PZO event typing, cascade triggers,
// shield interactions, and telemetry for 20M-scale analytics.
//
// CONCURRENCY CONTRACT:
//   resolveCardPlay is synchronous and mutation-free per call.
//   Each resolution generates an immutable event list dispatched in order.
//   EventBus handles async fan-out. This file never awaits.
//
// App.tsx / GameStore calls resolveCardPlay(cardId, state, dispatch).
// Zero business logic in App.tsx.
// ═══════════════════════════════════════════════════════════════════════════

import type { GameCard }            from '../types/cards';
import type { RunState }            from '../types/runState';
import type { RunEvent }            from '../types/events';
import type { RunStateSnapshot }    from '../../engines/core/types';
import { checkCardPlayable }        from './cardPolicyEngine';
import { scoreCard }                from './cardValuation';
import { empireCardAdapter }        from './modeCardAdapters/empireCardAdapter';
import { predatorCardAdapter }      from './modeCardAdapters/predatorCardAdapter';
import { syndicateCardAdapter }     from './modeCardAdapters/syndicateCardAdapter';
import { phantomCardAdapter }       from './modeCardAdapters/phantomCardAdapter';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DispatchFn = (event: RunEvent) => void;

export interface CardAdapterResult {
  cashDelta:     number;
  incomeDelta:   number;
  netWorthDelta: number;
  sideEffects:   RunEvent[];
}

export interface ResolutionSummary {
  cardId:        string;
  success:       boolean;
  cashDelta:     number;
  incomeDelta:   number;
  netWorthDelta: number;
  eventsEmitted: number;
  scoreTotal:    number;
  resolvedAtTick: number;
}

// ── Telemetry Hook (plugged in by analytics layer; optional) ──────────────────

export type TelemetryFn = (
  type:    string,
  payload: Record<string, unknown>,
  tick:    number,
) => void;

// ── Resolution Entry Point ─────────────────────────────────────────────────────

export function resolveCardPlay(
  cardId:       string,
  state:        RunState,
  dispatch:     DispatchFn,
  telemetryFn?: TelemetryFn,
  engineSnap?:  RunStateSnapshot,
): ResolutionSummary {
  const card = state.hand.find((c) => c.id === cardId);
  const currentTick = engineSnap?.tick ?? state.tick ?? 0;

  if (!card) {
    dispatch({ type: 'CARD_PLAY_REJECTED', cardId, reason: 'CARD_NOT_IN_HAND' });
    return failSummary(cardId, currentTick);
  }

  // ── Step 1: Policy gate ───────────────────────────────────────────────────
  const policy = checkCardPlayable(card, state);
  if (!policy.canPlay) {
    dispatch({
      type:   'CARD_PLAY_REJECTED',
      cardId,
      reason: policy.reason ?? 'POLICY_DENIED',
      hint:   policy.hint,
    });
    telemetryFn?.('cards.rejected', { cardId, reason: policy.reason, mode: state.mode }, currentTick);
    return failSummary(cardId, currentTick);
  }

  // ── Step 2: Score the card (for UI feedback and replay analytics) ─────────
  const scoreCtx = buildScoringContext(card, state, engineSnap);
  const cardScore = scoreCard(card, scoreCtx);

  // ── Step 3: Mode adapter — computes economic deltas and side effects ───────
  const resolution = routeToAdapter(card, state, engineSnap);

  // ── Step 4: Core resolution event ────────────────────────────────────────
  dispatch({
    type:          'CARD_PLAY_RESOLVED',
    card,
    cashDelta:     resolution.cashDelta,
    incomeDelta:   resolution.incomeDelta,
    netWorthDelta: resolution.netWorthDelta,
    tick:          currentTick,
    scoreTotal:    cardScore.total,
    urgencyTag:    policy.urgencyTag,
  });

  // ── Step 5: Side-effect events ────────────────────────────────────────────
  let eventsEmitted = 1; // count the CARD_PLAY_RESOLVED
  for (const sideEffect of resolution.sideEffects) {
    dispatch(sideEffect);
    eventsEmitted++;
  }

  // ── Step 6: Cascade check — certain plays trigger cascade chains ──────────
  const cascadeEvent = computeCascadeTrigger(card, state, resolution, engineSnap);
  if (cascadeEvent) {
    dispatch(cascadeEvent);
    eventsEmitted++;
  }

  // ── Step 7: Shield interaction — shield-synergy plays can repair layers ───
  const shieldEvent = computeShieldRepair(card, state, engineSnap);
  if (shieldEvent) {
    dispatch(shieldEvent);
    eventsEmitted++;
  }

  // ── Step 8: Proof/replay snapshot (every card play is a ledger entry) ─────
  dispatch({
    type:           'CARD_HAND_SNAPSHOT',
    tick:           currentTick,
    playedCardId:   cardId,
    cashAfter:      state.cash + resolution.cashDelta,
    incomeAfter:    state.income + resolution.incomeDelta,
    netWorthAfter:  state.netWorth + resolution.netWorthDelta,
    scoreTotal:     cardScore.total,
    scoreBreakdown: {
      economy:      cardScore.economyGain,
      tempo:        cardScore.tempoValue,
      deny:         cardScore.denyValue,
      shieldBonus:  cardScore.shieldValue,
      pressureBonus: cardScore.pressureBonus,
      botThreat:    cardScore.botThreatBonus,
    },
  });
  eventsEmitted++;

  // ── Step 9: Primary telemetry (async, non-blocking) ───────────────────────
  telemetryFn?.(`cards.play.${card.type.toLowerCase()}`, {
    cardId:         card.id,
    cardType:       card.type,
    energyCost:     card.energyCost ?? 0,
    cashflowMonthly: card.cashflowMonthly ?? 0,
    netWorthDelta:  resolution.netWorthDelta,
    mode:           state.mode,
    scoreTotal:     cardScore.total,
    pressureTier:   engineSnap?.pressureTier ?? 'UNKNOWN',
    tickTier:       engineSnap?.tickTier ?? 'UNKNOWN',
    haterHeat:      engineSnap?.haterHeat ?? 0,
    cascadeModifier: cardScore.cascadeModifier,
  }, currentTick);

  return {
    cardId,
    success:       true,
    cashDelta:     resolution.cashDelta,
    incomeDelta:   resolution.incomeDelta,
    netWorthDelta: resolution.netWorthDelta,
    eventsEmitted,
    scoreTotal:    cardScore.total,
    resolvedAtTick: currentTick,
  };
}

// ── Cascade Trigger Computation ───────────────────────────────────────────────

function computeCascadeTrigger(
  card:       GameCard,
  state:      RunState,
  resolution: CardAdapterResult,
  snap?:      RunStateSnapshot,
): RunEvent | null {
  if (!snap) return null;

  // Large income gains during CRITICAL pressure can trigger positive cascade
  if (
    snap.pressureTier === 'CRITICAL' &&
    resolution.incomeDelta > state.income * 0.3
  ) {
    return {
      type:     'CASCADE_TRIGGERED',
      chainId:  'PCHAIN_SUSTAINED_CASHFLOW',
      source:   `card:${card.id}`,
      tick:     snap.tick,
      severity: 'MODERATE',
    } as RunEvent;
  }

  // High haterHeat + net worth spike → Nemesis pattern exploitation chain
  if (snap.haterHeat > 75 && resolution.netWorthDelta > 10_000) {
    return {
      type:     'CASCADE_TRIGGERED',
      chainId:  'CHAIN_PATTERN_EXPLOITATION',
      source:   `card:${card.id}`,
      tick:     snap.tick,
      severity: 'HIGH',
    } as RunEvent;
  }

  return null;
}

// ── Shield Repair Computation ─────────────────────────────────────────────────

function computeShieldRepair(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
): RunEvent | null {
  if (!snap) return null;
  if (!card.synergies?.includes('SHIELD')) return null;

  const l4 = snap.shields.layers['L4_NETWORK_CORE'];
  const l3 = snap.shields.layers['L3_ASSET_FLOOR'];

  const targetLayer =
    l4?.breached ? 'L4_NETWORK_CORE' :
    l3?.breached ? 'L3_ASSET_FLOOR'  : null;

  if (!targetLayer) return null;

  return {
    type:        'SHIELD_REPAIRED',
    layer:       targetLayer,
    repairAmount: 15,
    source:      `card:${card.id}`,
    tick:        snap.tick,
  } as RunEvent;
}

// ── Scoring Context Builder ───────────────────────────────────────────────────

function buildScoringContext(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
) {
  return {
    mode:            state.mode,
    cash:            state.cash,
    income:          state.income,
    expenses:        state.expenses,
    shields:         state.shields ?? 0,
    pressureScore:   snap?.pressureScore ?? 0,
    inBleedMode:     state.cash < state.income * 2,
    opponentCash:    (state as any).opponentCash ?? null,
    cordGap:         (state as any).cordGap ?? null,
    engineSnapshot:  snap,
    haterHeat:       snap?.haterHeat ?? 0,
    seasonMomentum:  (state as any).momentumScore ?? 0,
  };
}

// ── Mode Router ────────────────────────────────────────────────────────────────

function routeToAdapter(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
): CardAdapterResult {
  switch (state.mode) {
    case 'EMPIRE':    return empireCardAdapter(card, state, snap);
    case 'PREDATOR':  return predatorCardAdapter(card, state, snap);
    case 'SYNDICATE': return syndicateCardAdapter(card, state, snap);
    case 'PHANTOM':   return phantomCardAdapter(card, state, snap);
    default: return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects: [] };
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function failSummary(cardId: string, tick: number): ResolutionSummary {
  return { cardId, success: false, cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, eventsEmitted: 1, scoreTotal: 0, resolvedAtTick: tick };
}
