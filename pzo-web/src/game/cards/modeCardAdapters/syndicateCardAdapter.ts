// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/syndicateCardAdapter.ts
// Sprint 2: SYNDICATE Mode Card Adapter
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// SYNDICATE identity: contracts, trust, rescue, coordination, betrayal arcs.
// Card effects carry trust impact, recipient-specific previews, and defection signatures.

import type { GameCard } from '../../types/cards';
import type { RunState } from '../../types/runState';
import type { RunEvent } from '../../types/events';
import type { CardAdapterResult } from '../cardResolver';

export function syndicateCardAdapter(card: GameCard, state: RunState): CardAdapterResult {
  const sideEffects: RunEvent[] = [];

  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend = card.energyCost ?? 0;

    // Trust score modulation — plays that benefit self at cost of team lower trust
    const trustImpact = card.modeMetadata?.trustImpact ?? 0;
    const incomeDelta = card.cashflowMonthly ?? 0;

    // Trust leakage: high-trust teams get amplified income; low-trust leaks it
    const trustLeakage = computeTrustLeakage(state, trustImpact);
    const effectiveIncome = incomeDelta * (1 - trustLeakage);

    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'syndicate.card_play',
      payload: {
        cardId: card.id,
        trustImpact,
        trustLeakage: +trustLeakage.toFixed(3),
        effectiveIncome: +effectiveIncome.toFixed(2),
        defectionSignature: card.modeMetadata?.defectionSignature ?? false,
        mode: 'SYNDICATE',
      },
    });

    // Defection sequence detection — if card marks defection chain, emit signal
    if (card.modeMetadata?.defectionSignature) {
      sideEffects.push({
        type: 'TELEMETRY_EMIT',
        telemetryType: 'syndicate.defection_signal',
        payload: { cardId: card.id, tick: state.tick },
      });
    }

    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 6, dominionDelta: 1 });

    return { cashDelta: -spend, incomeDelta: effectiveIncome, netWorthDelta: card.value ?? 0, sideEffects };
  }

  if (card.type === 'PRIVILEGED') {
    const v = card.value ?? 0;
    // In Syndicate, privileged cards increase shared treasury visibility
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 10, dominionDelta: 2 });
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'syndicate.privilege_shared',
      payload: { cardId: card.id, value: v },
    });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

/**
 * Trust leakage rate — 0.0 (no leakage) to 0.35 (heavy leakage).
 * Derived from trust score if available on modeState, otherwise approximate.
 */
function computeTrustLeakage(state: RunState, cardTrustImpact: number): number {
  // If we have trust score from modeState, use it
  const modeState = (state as unknown as { modeState?: { trustScore?: number } }).modeState;
  const trust = modeState?.trustScore ?? 0.75;  // default to decent trust

  // Negative trust impact cards incur extra leakage
  const baseLeak = Math.max(0, (1 - trust) * 0.3);
  const impactLeak = cardTrustImpact < 0 ? Math.abs(cardTrustImpact) * 0.05 : 0;
  return Math.min(0.35, baseLeak + impactLeak);
}
