// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/empireCardAdapter.ts
// Sprint 2: EMPIRE Mode Card Adapter
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// EMPIRE identity: authored survival, compounding, pressure management.
// Cards reward sequencing, shield timing, survivability, comeback arcs.

import type { GameCard } from '../../types/cards';
import type { RunState } from '../../types/runState';
import type { RunEvent } from '../../types/events';
import type { CardAdapterResult } from '../cardResolver';
import { clamp } from '../../core/math';

export function empireCardAdapter(card: GameCard, state: RunState): CardAdapterResult {
  const sideEffects: RunEvent[] = [];

  // ── Opportunity / IPA — long-game compounding ─────────────────────────
  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend = card.energyCost ?? 0;

    // Isolation tax: solo play incurs a friction cost on large purchases
    // Modeled as a small additional cash deduction (0–5% of purchase)
    const isolationTax = card.modeMetadata?.isolationTaxModifier
      ? spend * (card.modeMetadata.isolationTaxModifier - 1)
      : 0;
    const cashDelta   = -(spend + isolationTax);
    const incomeDelta = card.cashflowMonthly ?? 0;
    const netWorthDelta = card.value ?? 0;

    // Bleed mode amplifier — extra income if played while under distress
    const inBleed = state.cash < state.income * 2;
    const bleedBonus = (inBleed && card.modeMetadata?.bleedAmplifier) ? incomeDelta * 0.25 : 0;

    // Comeback surge — bonus XP for plays made in negative cashflow
    const cashflow = state.income - state.expenses;
    if (cashflow < 0 && incomeDelta > 0) {
      sideEffects.push({ type: 'SEASON_PULSE', xpGained: 15, dominionDelta: 1 });
    }

    // Pressure journal — tag this play for case file generation
    const decisionTag = determineDecisionTag(card, state);
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'empire.card_play',
      payload: {
        cardId: card.id, mode: 'EMPIRE',
        isolationTax: +isolationTax.toFixed(2),
        inBleed, bleedBonus: +bleedBonus.toFixed(2),
        decisionTag,
      },
    });

    // Standard season XP
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 5, dominionDelta: 0 });

    return { cashDelta, incomeDelta: incomeDelta + bleedBonus, netWorthDelta, sideEffects };
  }

  // ── PRIVILEGED — net worth spike ──────────────────────────────────────
  if (card.type === 'PRIVILEGED') {
    const v = card.value ?? 0;
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 10, dominionDelta: 3 });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

function determineDecisionTag(
  card: GameCard,
  state: RunState,
): 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' {
  const cashflow = state.income - state.expenses;
  const spend    = card.energyCost ?? 0;

  if (spend > state.cash * 0.7) return 'RISKY';
  if (cashflow > 0 && spend < state.cash * 0.3) return 'OPTIMAL';
  if (state.freezeTicks > 0) return 'LATE';
  return 'FAST';
}
