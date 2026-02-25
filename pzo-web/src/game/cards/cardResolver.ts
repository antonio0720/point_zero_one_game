// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/cardResolver.ts
// Sprint 2: Card Resolution Pipeline
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// Pipeline: intent → policyCheck → modeAdapter → RunEvents dispatched
// App.tsx calls resolveCardPlay(cardId, state, dispatch).
// Zero business logic in App.tsx.

import type { GameCard } from '../types/cards';
import type { RunState } from '../types/runState';
import type { RunEvent } from '../types/events';
import { checkCardPlayable } from './cardPolicyEngine';
import { empireCardAdapter }    from './modeCardAdapters/empireCardAdapter';
import { predatorCardAdapter }  from './modeCardAdapters/predatorCardAdapter';
import { syndicateCardAdapter } from './modeCardAdapters/syndicateCardAdapter';
import { phantomCardAdapter }   from './modeCardAdapters/phantomCardAdapter';

export type DispatchFn = (event: RunEvent) => void;

// ── Resolution Entry Point ─────────────────────────────────────────────────────
export function resolveCardPlay(
  cardId: string,
  state: RunState,
  dispatch: DispatchFn,
  telemetryFn?: (type: string, payload: Record<string, unknown>) => void,
): void {
  const card = state.hand.find((c) => c.id === cardId);
  if (!card) return;

  // Step 1: Policy check
  const policy = checkCardPlayable(card, state);
  if (!policy.canPlay) {
    dispatch({ type: 'CARD_PLAY_REJECTED', cardId, reason: policy.reason ?? 'POLICY_DENIED' });
    return;
  }

  // Step 2: Mode adapter transform — computes economic deltas
  const resolution = routeToAdapter(card, state);

  // Step 3: Dispatch resolution event
  dispatch({
    type: 'CARD_PLAY_RESOLVED',
    card,
    cashDelta:     resolution.cashDelta,
    incomeDelta:   resolution.incomeDelta,
    netWorthDelta: resolution.netWorthDelta,
  });

  // Step 4: Side-effect events (shields, season, etc.)
  for (const sideEffect of resolution.sideEffects) {
    dispatch(sideEffect);
  }

  // Step 5: Telemetry
  dispatch({
    type: 'TELEMETRY_EMIT',
    telemetryType: `cards.play.${card.type.toLowerCase()}`,
    payload: {
      cardId: card.id,
      cardType: card.type,
      cost: card.energyCost ?? 0,
      cashflowMonthly: card.cashflowMonthly ?? 0,
      mode: state.mode,
    },
  });
}

// ── Adapter Resolution Result ─────────────────────────────────────────────────
export interface CardAdapterResult {
  cashDelta: number;
  incomeDelta: number;
  netWorthDelta: number;
  sideEffects: RunEvent[];
}

// ── Mode Router ────────────────────────────────────────────────────────────────
function routeToAdapter(card: GameCard, state: RunState): CardAdapterResult {
  switch (state.mode) {
    case 'EMPIRE':    return empireCardAdapter(card, state);
    case 'PREDATOR':  return predatorCardAdapter(card, state);
    case 'SYNDICATE': return syndicateCardAdapter(card, state);
    case 'PHANTOM':   return phantomCardAdapter(card, state);
  }
}
