// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/sharedOpportunityDeck.ts
// Sprint 4 — Shared Opportunity Deck (H2H)
//
// In Predator mode both players draw from the SAME opportunity pool.
// A card claimed by one is denied to the other.
// First Refusal window = 6 ticks — both see it, first to claim wins.
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

export interface SharedDeckCard {
  id: string;
  title: string;
  type: 'OPPORTUNITY' | 'IPA';
  value: number;
  cashflowMonthly: number;
  energyCost: number;
  /** Tick when card became available */
  availableAtTick: number;
  /** Tick when claim window closes */
  claimWindowExpiresAt: number;
  claimedBy: string | null;
  deniedTo: string | null;
  claimedAtTick: number | null;
  /** Deny value if opponent has higher income need */
  denyValue: number;
}

export interface SharedDeckState {
  available: SharedDeckCard[];
  claimedHistory: SharedDeckCard[];
  denialCount: Record<string, number>;    // playerId → how many times denied
  claimCount:  Record<string, number>;    // playerId → how many times claimed
}

export const INITIAL_SHARED_DECK: SharedDeckState = {
  available: [],
  claimedHistory: [],
  denialCount: {},
  claimCount: {},
};

// ─── Card Arrival ─────────────────────────────────────────────────────────────

export function addCardToSharedDeck(
  state: SharedDeckState,
  card: Omit<SharedDeckCard, 'claimedBy' | 'deniedTo' | 'claimedAtTick' | 'claimWindowExpiresAt'>,
  currentTick: number,
): SharedDeckState {
  const fullCard: SharedDeckCard = {
    ...card,
    claimWindowExpiresAt: currentTick + PREDATOR_CONFIG.deckClaimWindowTicks,
    claimedBy: null,
    deniedTo: null,
    claimedAtTick: null,
  };

  return {
    ...state,
    available: [...state.available, fullCard],
  };
}

// ─── Claim ────────────────────────────────────────────────────────────────────

export interface ClaimResult {
  success: boolean;
  reason?: 'ALREADY_CLAIMED' | 'WINDOW_EXPIRED' | 'NOT_FOUND';
  updatedState: SharedDeckState;
  deniedPlayerId: string | null;
}

export function claimCard(
  state: SharedDeckState,
  cardId: string,
  playerId: string,
  opponentId: string,
  currentTick: number,
): ClaimResult {
  const cardIdx = state.available.findIndex(c => c.id === cardId);
  if (cardIdx === -1) {
    return { success: false, reason: 'NOT_FOUND', updatedState: state, deniedPlayerId: null };
  }

  const card = state.available[cardIdx];

  if (card.claimedBy !== null) {
    return { success: false, reason: 'ALREADY_CLAIMED', updatedState: state, deniedPlayerId: null };
  }

  if (currentTick > card.claimWindowExpiresAt) {
    return { success: false, reason: 'WINDOW_EXPIRED', updatedState: state, deniedPlayerId: null };
  }

  const claimed: SharedDeckCard = {
    ...card,
    claimedBy: playerId,
    deniedTo: opponentId,
    claimedAtTick: currentTick,
  };

  const available = state.available.filter((_, i) => i !== cardIdx);
  const claimedHistory = [...state.claimedHistory, claimed].slice(-50);
  const claimCount = { ...state.claimCount, [playerId]: (state.claimCount[playerId] ?? 0) + 1 };
  const denialCount = { ...state.denialCount, [opponentId]: (state.denialCount[opponentId] ?? 0) + 1 };

  return {
    success: true,
    deniedPlayerId: opponentId,
    updatedState: { ...state, available, claimedHistory, claimCount, denialCount },
  };
}

// ─── Expiry Cleanup ───────────────────────────────────────────────────────────

export function expireClaimWindows(state: SharedDeckState, currentTick: number): SharedDeckState {
  const available = state.available.filter(c => currentTick <= c.claimWindowExpiresAt || c.claimedBy !== null);
  const expired = state.available.filter(c => currentTick > c.claimWindowExpiresAt && c.claimedBy === null);

  // Expired unclaimed cards go to history as denied to nobody (both missed)
  const claimedHistory = [
    ...state.claimedHistory,
    ...expired.map(c => ({ ...c, claimedBy: null, deniedTo: null })),
  ].slice(-50);

  return { ...state, available, claimedHistory };
}

// ─── Deny Value Computation ───────────────────────────────────────────────────

export function computeDenyValue(
  card: SharedDeckCard,
  opponentCash: number,
  opponentIncome: number,
): number {
  // If opponent is cash-strapped, denying them a good card is more valuable
  const cashPressure = Math.max(0, 1 - opponentCash / 28_000);
  const incomePressure = Math.max(0, 1 - opponentIncome / 4_200);
  const denyMultiplier = 0.3 + cashPressure * 0.4 + incomePressure * 0.3;
  return Math.round(card.value * denyMultiplier);
}
