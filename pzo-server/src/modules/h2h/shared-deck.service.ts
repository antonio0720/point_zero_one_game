// pzo-server/src/modules/h2h/shared-deck.service.ts
// Sprint 4 — Shared Opportunity Deck backend service

import { Injectable } from '@nestjs/common';
import {
  INITIAL_SHARED_DECK, addCardToSharedDeck, claimCard, expireClaimWindows,
} from '../../../../pzo-web/src/game/modes/predator/sharedOpportunityDeck';
import type { SharedDeckState, SharedDeckCard } from '../../../../pzo-web/src/game/modes/predator/sharedOpportunityDeck';

@Injectable()
export class SharedDeckService {
  private decks = new Map<string, SharedDeckState>();

  initDeck(matchId: string) {
    this.decks.set(matchId, INITIAL_SHARED_DECK);
  }

  getDeckState(matchId: string): SharedDeckState {
    return this.decks.get(matchId) ?? INITIAL_SHARED_DECK;
  }

  addCard(matchId: string, card: Omit<SharedDeckCard, 'claimedBy' | 'deniedTo' | 'claimedAtTick' | 'claimWindowExpiresAt'>, tick: number) {
    const state = this.getDeckState(matchId);
    this.decks.set(matchId, addCardToSharedDeck(state, card, tick));
  }

  claimCard(matchId: string, cardId: string, playerId: string, tick: number) {
    const state = this.getDeckState(matchId);
    // Simplified opponent derivation — real impl reads match service
    const result = claimCard(state, cardId, playerId, 'opponent', tick);
    if (result.success) this.decks.set(matchId, result.updatedState);
    return { success: result.success, deniedPlayerId: result.deniedPlayerId };
  }

  expireWindows(matchId: string, tick: number) {
    const state = this.getDeckState(matchId);
    this.decks.set(matchId, expireClaimWindows(state, tick));
  }
}
