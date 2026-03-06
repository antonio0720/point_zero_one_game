/**
 * hooks/useCardEngine.ts — POINT ZERO ONE
 * Reactive card engine interface for React components.
 * Reads live hand state from the card store slice and surfaces
 * cardEngine imperatives as stable callbacks.
 *
 * FILE LOCATION: pzo-web/src/hooks/useCardEngine.ts
 * Density6 LLC · Confidential
 */

import { useCallback } from 'react';
import { cardEngine } from '../engines/cards/CardEngine';
import { useEngineStore } from '../store/engineStore';
import type { CardInHand, DecisionRecord } from '../engines/cards/types';

// ── Public surface ─────────────────────────────────────────────────────────

export interface CardEngineActions {
  // ── Imperative actions ────────────────────────────────────────────────────
  /**
   * Queue a card for play in the specified zone.
   * Routes through CardEngine.queuePlay() which validates timing class,
   * energy cost, and window state before committing.
   * No-op (with console.warn) if the card is unplayable at the current tick.
   */
  queuePlay: (cardId: string, zoneId: string) => void;

  /**
   * Place a card in the hold slot. Max 1 held card at a time.
   * Held cards are exempt from draw-discard cycling while held.
   */
  holdCard: (cardId: string) => void;

  /**
   * Release a held card back to the active hand.
   */
  releaseHold: (cardId: string) => void;

  /**
   * Return an immutable snapshot of the current hand at call-time.
   * Useful for AI/automation layers that need a point-in-time copy.
   */
  getHandSnapshot: () => CardInHand[];

  // ── Reactive store reads (re-render on change) ────────────────────────────
  /** Live hand from card store slice. Use this for rendering. */
  hand: CardInHand[];

  /** True when a decision window is currently open for card play. */
  windowOpen: boolean;

  /** Ticks remaining in the current decision window. */
  windowTicksLeft: number;

  /** IDs of cards currently in the hold slot. */
  heldCards: string[];

  /** Decision records resolved during the most recent tick. */
  decisionsThisTick: DecisionRecord[];

  /** Whether the card engine is fully initialised and ready. */
  isReady: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useCardEngine
 *
 * Single integration point for all card interactions in game screens.
 * Imperative methods (queuePlay, holdCard, etc.) are stable across renders
 * via useCallback with no deps — they delegate directly to the CardEngine
 * singleton and are side-effect safe to call in event handlers.
 *
 * Reactive state (hand, windowOpen, etc.) is sourced from the Zustand
 * card store slice and triggers component re-renders only on change.
 */
export function useCardEngine(): CardEngineActions {
  // ── Store reads ───────────────────────────────────────────────────────────
  const hand               = useEngineStore(s => s.card.hand);
  const windowOpen         = useEngineStore(s => s.card.windowOpen);
  const windowTicksLeft    = useEngineStore(s => s.card.windowTicksLeft);
  const heldCards          = useEngineStore(s => s.card.heldCards);
  const decisionsThisTick  = useEngineStore(s => s.card.decisionsThisTick);
  const isReady            = useEngineStore(s => s.card.isReady ?? false);

  // ── Stable imperative callbacks ───────────────────────────────────────────

  const queuePlay = useCallback((cardId: string, zoneId: string): void => {
    if (!cardId || !zoneId) {
      console.warn('[useCardEngine] queuePlay: missing cardId or zoneId');
      return;
    }
    try {
      cardEngine.queuePlay(cardId, zoneId);
    } catch (err) {
      console.error('[useCardEngine] queuePlay failed:', err);
    }
  }, []);

  const holdCard = useCallback((cardId: string): void => {
    if (!cardId) {
      console.warn('[useCardEngine] holdCard: missing cardId');
      return;
    }
    try {
      cardEngine.holdCard(cardId);
    } catch (err) {
      console.error('[useCardEngine] holdCard failed:', err);
    }
  }, []);

  const releaseHold = useCallback((cardId: string): void => {
    if (!cardId) {
      console.warn('[useCardEngine] releaseHold: missing cardId');
      return;
    }
    try {
      cardEngine.releaseHold(cardId);
    } catch (err) {
      console.error('[useCardEngine] releaseHold failed:', err);
    }
  }, []);

  const getHandSnapshot = useCallback((): CardInHand[] => {
    try {
      return cardEngine.getHandSnapshot();
    } catch (err) {
      console.error('[useCardEngine] getHandSnapshot failed:', err);
      return [];
    }
  }, []);

  // ── Return surface ────────────────────────────────────────────────────────

  return {
    queuePlay,
    holdCard,
    releaseHold,
    getHandSnapshot,
    hand,
    windowOpen,
    windowTicksLeft,
    heldCards,
    decisionsThisTick,
    isReady,
  };
}