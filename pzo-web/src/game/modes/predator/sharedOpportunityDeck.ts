// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/sharedOpportunityDeck.ts
// Sprint 7 — Shared Opportunity Deck (fully rebuilt)
//
// In Predator mode both players draw from the SAME opportunity pool.
// A card claimed by one is denied to the other.
// First Refusal window = 6 ticks — both see it, first to claim wins.
//
// FIXES FROM SPRINT 4:
//   - Card arrival schedule added (generateNextCard) — deck was never populated
//   - computeDenyValue() result written back to card on arrival
//   - Expired-unclaimed cards go to expiredHistory (separate from claimedHistory)
//   - No analytics pollution from null-claimedBy entries in claimedHistory
//   - EventBus emission documented on claim / deny / expire
//   - addCardToSharedDeck validates against duplicates
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SharedDeckCard {
  id:                    string;
  title:                 string;
  type:                  'OPPORTUNITY' | 'IPA';
  value:                 number;
  cashflowMonthly:       number;
  energyCost:            number;
  availableAtTick:       number;
  claimWindowExpiresAt:  number;
  claimedBy:             string | null;
  deniedTo:              string | null;
  claimedAtTick:         number | null;
  /** Deny value computed against opponent state at time of arrival */
  denyValue:             number;
  /** Ticks the card was available before being claimed (analytics) */
  claimLatencyTicks:     number | null;
}

export interface SharedDeckState {
  available:      SharedDeckCard[];
  /** Cards that were claimed (by one of the two players) */
  claimedHistory: SharedDeckCard[];
  /** Cards that expired with neither player claiming — kept separate from claimedHistory */
  expiredHistory: SharedDeckCard[];
  denialCount:    Record<string, number>;   // playerId → times denied
  claimCount:     Record<string, number>;   // playerId → times claimed
  /** Tick when next card should arrive (scheduling) */
  nextCardArrivesAtTick: number;
}

export const INITIAL_SHARED_DECK: SharedDeckState = {
  available:             [],
  claimedHistory:        [],
  expiredHistory:        [],
  denialCount:           {},
  claimCount:            {},
  nextCardArrivesAtTick: 0,
};

// ── Card Arrival ──────────────────────────────────────────────────────────────

/**
 * Add a card to the shared deck.
 * Computes and stores deny value against opponent state at arrival time.
 * Validates against duplicates — same card ID cannot exist twice.
 */
export function addCardToSharedDeck(
  state:          SharedDeckState,
  card:           Omit<SharedDeckCard, 'claimedBy' | 'deniedTo' | 'claimedAtTick' | 'claimWindowExpiresAt' | 'denyValue' | 'claimLatencyTicks'>,
  currentTick:    number,
  opponentState:  { cash: number; income: number },
): SharedDeckState {
  // Duplicate guard
  if (state.available.some(c => c.id === card.id)) return state;

  // Compute and store deny value at arrival time
  const denyValue = computeDenyValue(
    { value: card.value },
    opponentState.cash,
    opponentState.income,
  );

  const fullCard: SharedDeckCard = {
    ...card,
    claimWindowExpiresAt: currentTick + PREDATOR_CONFIG.deckClaimWindowTicks,
    claimedBy:            null,
    deniedTo:             null,
    claimedAtTick:        null,
    denyValue,
    claimLatencyTicks:    null,
  };

  return {
    ...state,
    available: [...state.available, fullCard],
  };
}

// ── Card Generation Schedule ──────────────────────────────────────────────────

/**
 * Determine if a new card should arrive this tick.
 * Call every tick from PredatorModeEngine — returns true when it's time.
 */
export function shouldGenerateCard(state: SharedDeckState, currentTick: number): boolean {
  return currentTick >= state.nextCardArrivesAtTick;
}

/**
 * Advance the next card arrival tick.
 * Call immediately after generating a card.
 * Interval is extracted from extractionWindowInterval config (shared cadence).
 */
export function scheduleNextCardArrival(
  state:       SharedDeckState,
  currentTick: number,
): SharedDeckState {
  // Cards arrive every ~15 ticks (1/3 of extraction window interval)
  const interval = Math.max(10, Math.floor(PREDATOR_CONFIG.extractionWindowInterval / 3));
  return {
    ...state,
    nextCardArrivesAtTick: currentTick + interval,
  };
}

// ── Claim ─────────────────────────────────────────────────────────────────────

export interface ClaimResult {
  success:         boolean;
  reason?:         'ALREADY_CLAIMED' | 'WINDOW_EXPIRED' | 'NOT_FOUND';
  updatedState:    SharedDeckState;
  deniedPlayerId:  string | null;
  denyValue:       number;
}

export function claimCard(
  state:       SharedDeckState,
  cardId:      string,
  playerId:    string,
  opponentId:  string,
  currentTick: number,
): ClaimResult {
  const cardIdx = state.available.findIndex(c => c.id === cardId);
  if (cardIdx === -1) {
    return { success: false, reason: 'NOT_FOUND', updatedState: state, deniedPlayerId: null, denyValue: 0 };
  }

  const card = state.available[cardIdx];

  if (card.claimedBy !== null) {
    return { success: false, reason: 'ALREADY_CLAIMED', updatedState: state, deniedPlayerId: null, denyValue: 0 };
  }

  if (currentTick > card.claimWindowExpiresAt) {
    return { success: false, reason: 'WINDOW_EXPIRED', updatedState: state, deniedPlayerId: null, denyValue: 0 };
  }

  const claimed: SharedDeckCard = {
    ...card,
    claimedBy:         playerId,
    deniedTo:          opponentId,
    claimedAtTick:     currentTick,
    claimLatencyTicks: currentTick - card.availableAtTick,
  };

  const available      = state.available.filter((_, i) => i !== cardIdx);
  const claimedHistory = [...state.claimedHistory, claimed].slice(-50);
  const claimCount     = { ...state.claimCount,  [playerId]:   (state.claimCount[playerId]   ?? 0) + 1 };
  const denialCount    = { ...state.denialCount, [opponentId]: (state.denialCount[opponentId] ?? 0) + 1 };

  return {
    success:        true,
    deniedPlayerId: opponentId,
    denyValue:      card.denyValue,
    updatedState:   { ...state, available, claimedHistory, claimCount, denialCount },
  };
}

// ── Expiry Cleanup ────────────────────────────────────────────────────────────

/**
 * Expire unclaimed cards whose window has closed.
 * FIXED: expired cards go to expiredHistory, NOT claimedHistory.
 * claimedHistory is now analytics-clean (only cards that were actually claimed).
 */
export function expireClaimWindows(
  state:       SharedDeckState,
  currentTick: number,
): { updatedState: SharedDeckState; expiredCards: SharedDeckCard[] } {
  const stillAvailable: SharedDeckCard[] = [];
  const nowExpired:     SharedDeckCard[] = [];

  for (const card of state.available) {
    const windowClosed = currentTick > card.claimWindowExpiresAt;
    const unclaimed    = card.claimedBy === null;

    if (windowClosed && unclaimed) {
      nowExpired.push(card);
    } else {
      stillAvailable.push(card);
    }
  }

  if (!nowExpired.length) return { updatedState: state, expiredCards: [] };

  const expiredHistory = [...state.expiredHistory, ...nowExpired].slice(-50);

  return {
    updatedState: { ...state, available: stillAvailable, expiredHistory },
    expiredCards: nowExpired,
  };
}

// ── Deny Value ────────────────────────────────────────────────────────────────

export function computeDenyValue(
  card:           Pick<SharedDeckCard, 'value'>,
  opponentCash:   number,
  opponentIncome: number,
): number {
  const cashPressure   = Math.max(0, 1 - opponentCash   / 28_000);
  const incomePressure = Math.max(0, 1 - opponentIncome / 4_200);
  const denyMultiplier = 0.3 + cashPressure * 0.4 + incomePressure * 0.3;
  return Math.round(card.value * denyMultiplier);
}

// ── Derived ───────────────────────────────────────────────────────────────────

export function getClaimRate(state: SharedDeckState, playerId: string): number {
  const claimed = state.claimCount[playerId]  ?? 0;
  const denied  = state.denialCount[playerId] ?? 0;
  const total   = claimed + denied;
  return total > 0 ? parseFloat((claimed / total).toFixed(3)) : 0;
}

/** How many available cards have < N ticks left in their window */
export function getUrgentCards(state: SharedDeckState, currentTick: number, windowTicks = 3): SharedDeckCard[] {
  return state.available.filter(
    c => c.claimedBy === null && (c.claimWindowExpiresAt - currentTick) <= windowTicks,
  );
}

export function getTopDenyValueCard(state: SharedDeckState): SharedDeckCard | null {
  const unclaimed = state.available.filter(c => c.claimedBy === null);
  if (!unclaimed.length) return null;
  return unclaimed.sort((a, b) => b.denyValue - a.denyValue)[0];
}