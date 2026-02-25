// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/phantomCardAdapter.ts
// Sprint 2: PHANTOM Mode Card Adapter
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM identity: precision, gap-closing, anti-ghost adaptation, community pressure.
// Card value is relative to delta vs legend path — not just immediate economy.
// The player is fighting a recorded excellence path, not other live players.

import type { GameCard } from '../../types/cards';
import type { RunState } from '../../types/runState';
import type { RunEvent } from '../../types/events';
import type { CardAdapterResult } from '../cardResolver';

export function phantomCardAdapter(card: GameCard, state: RunState): CardAdapterResult {
  const sideEffects: RunEvent[] = [];

  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend = card.energyCost ?? 0;
    const incomeDelta   = card.cashflowMonthly ?? 0;
    const netWorthDelta = card.value ?? 0;

    // CORD delta — how much does this card move us toward legend pace?
    const cordDelta = card.modeMetadata?.cordDelta ?? estimateCordDelta(card, state);

    // Legend pressure response — nerve cards stabilize decision speed under ghost pressure
    const nerveMult = card.modeMetadata?.legendPressureResponse ? 1.1 : 1.0;

    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'phantom.card_play',
      payload: {
        cardId: card.id,
        cordDelta: +cordDelta.toFixed(4),
        legendPressureResponse: card.modeMetadata?.legendPressureResponse ?? false,
        nerveMult,
        mode: 'PHANTOM',
      },
    });

    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 7, dominionDelta: 1 });

    return {
      cashDelta:     -spend,
      incomeDelta:   incomeDelta * nerveMult,
      netWorthDelta: netWorthDelta,
      sideEffects,
    };
  }

  if (card.type === 'PRIVILEGED') {
    // In Phantom, privileged cards are dynasty-tier events — only appear in challenge stacks
    const v = card.value ?? 0;
    const cordDelta = 0.05; // dynasty cards give a CORD boost
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 15, dominionDelta: 3 });
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'phantom.dynasty_play',
      payload: { cardId: card.id, value: v, cordDelta },
    });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

/**
 * Estimate CORD basis point delta for a card without explicit metadata.
 * Based on income velocity vs baseline — a rough but functional approximation
 * until Sprint 6 adds the full ghostReplayEngine comparison.
 */
function estimateCordDelta(card: GameCard, state: RunState): number {
  const monthlyYield = card.cashflowMonthly ?? 0;
  const baselinePace = state.income * 0.02;  // 2% monthly income improvement = legend pace
  if (monthlyYield <= 0) return 0;
  return (monthlyYield / (baselinePace + 1)) * 0.01;
}
