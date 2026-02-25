// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/cardPolicyEngine.ts
// Sprint 2: Card Playability Policy Engine
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// Single source of truth for "can this card be played right now?"
// CardHand calls this before rendering play buttons.
// cardResolver calls this before resolving.

import type { GameCard, CardArchetype } from '../types/cards';
import { CARD_MANUALLY_PLAYABLE } from '../types/cards';
import type { RunState } from '../types/runState';

// ── Policy Result ─────────────────────────────────────────────────────────────
export interface PolicyResult {
  canPlay: boolean;
  reason?: 'INSUFFICIENT_CASH' | 'NOT_MANUALLY_PLAYABLE' | 'HAND_FROZEN' | 'POLICY_DENIED';
  hint?: string;  // shown in UI tooltip
}

export const POLICY_ALLOWED: PolicyResult = { canPlay: true };

// ── Main Policy Check ──────────────────────────────────────────────────────────
export function checkCardPlayable(card: GameCard, state: RunState): PolicyResult {
  // Rule 1: Adversity cards are NEVER manually playable — they enter via forced event pipeline
  if (!CARD_MANUALLY_PLAYABLE[card.type]) {
    return {
      canPlay: false,
      reason:  'NOT_MANUALLY_PLAYABLE',
      hint:    `${card.type} cards are system events — they cannot be manually played.`,
    };
  }

  // Rule 2: Hand is frozen
  if (state.freezeTicks > 0) {
    return {
      canPlay: false,
      reason:  'HAND_FROZEN',
      hint:    `Frozen for ${state.freezeTicks} more ticks.`,
    };
  }

  // Rule 3: Insufficient cash for purchase cards
  if ((card.type === 'OPPORTUNITY' || card.type === 'IPA') && state.cash < (card.energyCost ?? 0)) {
    return {
      canPlay: false,
      reason:  'INSUFFICIENT_CASH',
      hint:    `Need $${((card.energyCost ?? 0) - state.cash).toLocaleString()} more.`,
    };
  }

  return POLICY_ALLOWED;
}

/** Returns only the playable cards from the hand for the current state. */
export function getPlayableHand(hand: GameCard[], state: RunState): Array<{ card: GameCard; policy: PolicyResult }> {
  return hand.map((card) => ({ card, policy: checkCardPlayable(card, state) }));
}
