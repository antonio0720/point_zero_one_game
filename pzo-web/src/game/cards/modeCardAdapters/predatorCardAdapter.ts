// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/predatorCardAdapter.ts
// Sprint 2: PREDATOR Mode Card Adapter
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// PREDATOR identity: tempo warfare, denial, extraction windows, psych pressure.
// Card value = economy gain + BB gain + deny value + timing window + opponent exploit.
// Income cards are DOWN-WEIGHTED. Tempo and burst are UP-WEIGHTED.

import type { GameCard } from '../../types/cards';
import type { RunState } from '../../types/runState';
import type { RunEvent } from '../../types/events';
import type { CardAdapterResult } from '../cardResolver';

export function predatorCardAdapter(card: GameCard, state: RunState): CardAdapterResult {
  const sideEffects: RunEvent[] = [];

  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend = card.energyCost ?? 0;

    // Income is down-weighted in Predator (short-game, not long compounding)
    // Tempo is up-weighted — immediate positioning over monthly cashflow
    const tempoMult     = 0.65;   // raw income impact reduced
    const incomeDelta   = (card.cashflowMonthly ?? 0) * tempoMult;
    const netWorthDelta = (card.value ?? 0) * 1.1;   // value spike is premium in PvP

    // Battle budget generation: card generates BB as a side effect
    const bbGen = computeBBGeneration(card);
    if (bbGen > 0) {
      sideEffects.push({
        type: 'TELEMETRY_EMIT',
        telemetryType: 'predator.bb_generated',
        payload: { cardId: card.id, bbGen, mode: 'PREDATOR' },
      });
    }

    // Rivalry signal — repeated plays of the same card class fuel rivalry arc
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'predator.card_play',
      payload: {
        cardId: card.id,
        tempoMult,
        bbGen,
        denyValue: card.modeMetadata?.denyValue ?? 0,
        mode: 'PREDATOR',
      },
    });

    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 8, dominionDelta: 1 });

    return { cashDelta: -spend, incomeDelta, netWorthDelta, sideEffects };
  }

  if (card.type === 'PRIVILEGED') {
    // In Predator, privileged cards are extraction prizes — higher net worth spike
    const v = card.value ?? 0;
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 12, dominionDelta: 2 });
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'predator.privilege_extracted',
      payload: { cardId: card.id, value: v },
    });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v * 1.2, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

function computeBBGeneration(card: GameCard): number {
  // Battle budget is fueled by card plays — bigger purchases generate more BB
  if (card.modeMetadata?.bbGeneration != null) return card.modeMetadata.bbGeneration;
  const base = (card.energyCost ?? 0) * 0.015 + (card.cashflowMonthly ?? 0) * 0.5;
  return Math.round(base);
}
