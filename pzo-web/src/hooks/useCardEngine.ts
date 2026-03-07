/**
 * hooks/useCardEngine.ts — POINT ZERO ONE
 * Reactive card engine interface for React components.
 * Reads live hand state from the engine store card slice and routes
 * imperative actions through the shared EngineOrchestrator singleton.
 *
 * FILE LOCATION: pzo-web/src/hooks/useCardEngine.ts
 * Density6 LLC · Confidential
 */

import { useCallback, useMemo } from 'react';
import { orchestrator } from '../engines/zero/EngineOrchestrator';
import { useEngineStore } from '../store/engineStore';
import type { CardInHand, DecisionRecord } from '../engines/cards/types';

// ── Public surface ─────────────────────────────────────────────────────────

export interface CardEngineActions {
  /**
   * Queue a card for play.
   *
   * NOTE:
   * The existing external API in this hook still accepts (cardId, zoneId),
   * but the underlying CardEngine/Orchestrator contract expects:
   *   instanceId + choiceId + timestamp
   *
   * Here, "cardId" is treated as the live card instanceId already present
   * in the player hand, and "zoneId" is treated as the selected choiceId.
   */
  queuePlay: (cardId: string, zoneId: string) => void;

  /**
   * Place a card in the hold slot. Max 1 held card at a time.
   */
  holdCard: (cardId: string) => void;

  /**
   * Release the currently held card.
   *
   * The CardEngine API does not require an ID for release, but this hook keeps
   * the old signature for compatibility with existing callers.
   */
  releaseHold: (cardId: string) => void;

  /**
   * Return an immutable snapshot of the current hand at call-time.
   */
  getHandSnapshot: () => CardInHand[];

  // ── Reactive store reads (re-render on change) ────────────────────────────
  hand: CardInHand[];

  /**
   * True when one or more decision windows are open.
   */
  windowOpen: boolean;

  /**
   * Lowest remaining decision window time, in milliseconds.
   *
   * The hook preserves the legacy property name `windowTicksLeft` to avoid
   * downstream UI breakage, but the card slice now tracks remainingMs.
   */
  windowTicksLeft: number;

  /**
   * Instance IDs of cards currently being held.
   */
  heldCards: string[];

  /**
   * Decision records are not currently stored in the card slice.
   * This remains an empty array until a dedicated slice field is added.
   */
  decisionsThisTick: DecisionRecord[];

  /**
   * Derived readiness flag based on Engine 0 lifecycle state.
   */
  isReady: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCardEngine(): CardEngineActions {
  // ── Store reads ───────────────────────────────────────────────────────────
  const hand = useEngineStore((s) => s.card.hand);
  const holdSlot = useEngineStore((s) => s.card.holdSlot);
  const openDecisionWindows = useEngineStore((s) => s.card.openDecisionWindows);
  const lifecycleState = useEngineStore((s) => s.run.lifecycleState);

  // ── Derived reactive state ────────────────────────────────────────────────
  const windowOpen = useMemo(
    () => Object.keys(openDecisionWindows).length > 0,
    [openDecisionWindows],
  );

  const windowTicksLeft = useMemo(() => {
    const windows = Object.values(openDecisionWindows);
    if (windows.length === 0) return 0;

    let minRemaining = Number.POSITIVE_INFINITY;
    for (const window of windows) {
      if (
        typeof window?.remainingMs === 'number' &&
        window.remainingMs < minRemaining
      ) {
        minRemaining = window.remainingMs;
      }
    }

    return Number.isFinite(minRemaining) ? Math.max(0, Math.ceil(minRemaining)) : 0;
  }, [openDecisionWindows]);

  const heldCards = useMemo<string[]>(
    () => (holdSlot?.card?.instanceId ? [holdSlot.card.instanceId] : []),
    [holdSlot],
  );

  const decisionsThisTick = useMemo<DecisionRecord[]>(() => [], []);

  const isReady = useMemo(
    () =>
      lifecycleState === 'ACTIVE' ||
      lifecycleState === 'TICK_LOCKED' ||
      lifecycleState === 'ENDING' ||
      lifecycleState === 'ENDED',
    [lifecycleState],
  );

  // ── Stable imperative callbacks ───────────────────────────────────────────

  const queuePlay = useCallback((cardId: string, zoneId: string): void => {
    if (!cardId || !zoneId) {
      console.warn('[useCardEngine] queuePlay: missing cardId or zoneId');
      return;
    }

    try {
      orchestrator.queueCardPlay({
        instanceId: cardId,
        choiceId: zoneId,
        timestamp: Date.now(),
      });
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
      orchestrator.holdCard(cardId);
    } catch (err) {
      console.error('[useCardEngine] holdCard failed:', err);
    }
  }, []);

  const releaseHold = useCallback((_cardId: string): void => {
    try {
      orchestrator.releaseHold();
    } catch (err) {
      console.error('[useCardEngine] releaseHold failed:', err);
    }
  }, []);

  const getHandSnapshot = useCallback((): CardInHand[] => {
    try {
      return orchestrator.getHandSnapshot();
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