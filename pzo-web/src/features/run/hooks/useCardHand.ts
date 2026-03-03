//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useCardHand.ts

// pzo-web/src/features/run/hooks/useCardHand.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — useCardHand
//
// Master hand hook — exposes current hand state, playable cards filtered by
// current timing class, hold slots (Empire), forced card flags, and hand
// replenishment state. Reads from card store slice ONLY — never touches
// engine directly.
//
// RULES:
//   ✦ Zero engine imports. All reads from Zustand/Redux card store slice.
//   ✦ Memoized selectors — no recompute unless relevant slice changes.
//   ✦ Mode-aware derived values: hold slots (GO_ALONE), battle budget costs
//     (HEAD_TO_HEAD), trust modifiers (TEAM_UP), divergence delta (CHASE_A_LEGEND).
//   ✦ Drag-to-play interaction state managed locally (not in store).
//   ✦ Play dispatch sends action to store → engine picks up on next tick.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useCallback, useState } from 'react';
import { useCardStore } from '../store/cardStore';
import {
  GameMode,
  TimingClass,
  BaseDeckType,
  ModeDeckType,
  CardRarity,
  CardTag,
  type CardInHand,
  type HoldSlot,
  type CardPlayRequest,
} from '../../../engines/cards/types';

// ── STORE SLICE TYPES ─────────────────────────────────────────────────────────
// These match the shape that engineStore / cardStore pushes from CARD_HAND_SNAPSHOT
// and CARD_DRAWN / CARD_PLAYED / CARD_HELD / CARD_UNHELD events.

export interface CardStoreSlice {
  hand:              CardInHand[];
  holdSlot:          HoldSlot | null;
  forcedCards:       CardInHand[];
  gameMode:          GameMode;
  battleBudget:      number;          // Predator only
  trustScore:        number;          // Syndicate only
  trustMultiplier:   number;          // Syndicate only
  divergenceScore:   number;          // Phantom only
  currentGap:        number;          // Phantom only
  chainSynergyActive:boolean;         // Empire only
  missedStreak:      number;
  isReplenishing:    boolean;
  phaseBoundaryOpen: boolean;         // Empire — phase boundary window active
  currentPhase:      string;          // Empire — FOUNDATION | ESCALATION | SOVEREIGNTY
}

// ── DERIVED CARD CONTEXT ──────────────────────────────────────────────────────

export interface CardHandContext {
  // Hand contents
  hand:                CardInHand[];
  playableCards:       CardInHand[];       // filtered by timing class + mode
  forcedCards:         CardInHand[];       // must resolve before standard plays
  holdSlot:            HoldSlot | null;    // Empire only

  // Counts
  handSize:            number;
  forcedCount:         number;
  hasForcedPending:    boolean;

  // Mode-specific UI signals
  gameMode:            GameMode;
  battleBudget:        number;             // HEAD_TO_HEAD
  trustScore:          number;             // TEAM_UP
  trustMultiplier:     number;             // TEAM_UP
  divergenceScore:     number;             // CHASE_A_LEGEND
  currentGap:          number;             // CHASE_A_LEGEND (0.0–1.0)
  chainSynergyActive:  boolean;            // GO_ALONE
  phaseBoundaryOpen:   boolean;            // GO_ALONE
  currentPhase:        string;             // GO_ALONE

  // Missed opportunity
  missedStreak:        number;
  isReplenishing:      boolean;

  // Drag interaction state
  draggedCard:         CardInHand | null;
  isDragging:          boolean;

  // Actions
  dispatchPlay:        (request: CardPlayRequest) => void;
  dispatchHold:        (instanceId: string) => void;
  dispatchRelease:     () => void;
  onDragStart:         (card: CardInHand) => void;
  onDragEnd:           () => void;
}

// ── CARD PLAYABILITY FILTER ────────────────────────────────────────────────────

function isPlayable(
  card:               CardInHand,
  gameMode:           GameMode,
  hasForcedPending:   boolean,
  battleBudget:       number,
): boolean {
  // Held cards are not playable from hand
  if (card.isHeld) return false;

  // Forced cards are always shown as needing resolution
  if (card.isForced) return true;

  // LEGENDARY and IMMEDIATE bypass everything
  if (
    card.definition.timingClass === TimingClass.LEGENDARY ||
    card.definition.timingClass === TimingClass.IMMEDIATE
  ) {
    return true;
  }

  // Forced card pending — only IMMEDIATE and LEGENDARY can play
  if (hasForcedPending) return false;

  // Mode-specific gates
  if (
    card.definition.timingClass === TimingClass.BLUFF ||
    card.definition.timingClass === TimingClass.COUNTER_WINDOW
  ) {
    if (gameMode !== GameMode.HEAD_TO_HEAD) return false;
    // Battle Budget check for Predator combat cards
    if (
      card.definition.base_cost > battleBudget &&
      isBudgetCard(card)
    ) return false;
  }

  if (
    card.definition.timingClass === TimingClass.RESCUE_WINDOW &&
    gameMode !== GameMode.TEAM_UP
  ) return false;

  if (
    card.definition.timingClass === TimingClass.DEFECTION_STEP &&
    gameMode !== GameMode.TEAM_UP
  ) return false;

  if (
    card.definition.timingClass === TimingClass.PHASE_BOUNDARY &&
    gameMode !== GameMode.GO_ALONE
  ) return false;

  if (
    card.definition.timingClass === TimingClass.HOLD &&
    gameMode !== GameMode.GO_ALONE
  ) return false;

  return true;
}

function isBudgetCard(card: CardInHand): boolean {
  const bb = new Set<string>([ModeDeckType.SABOTAGE, ModeDeckType.COUNTER, ModeDeckType.BLUFF]);
  return bb.has(card.definition.deckType as string);
}

// ── HOOK ──────────────────────────────────────────────────────────────────────

export function useCardHand(): CardHandContext {
  const {
    hand,
    holdSlot,
    forcedCards,
    gameMode,
    battleBudget,
    trustScore,
    trustMultiplier,
    divergenceScore,
    currentGap,
    chainSynergyActive,
    missedStreak,
    isReplenishing,
    phaseBoundaryOpen,
    currentPhase,
    queuePlay,
    holdCard,
    releaseHold,
  } = useCardStore();

  // ── Drag state ───────────────────────────────────────────────────────────────
  const [draggedCard, setDraggedCard] = useState<CardInHand | null>(null);

  // ── Derived values ───────────────────────────────────────────────────────────
  const hasForcedPending = useMemo(() => forcedCards.length > 0, [forcedCards]);

  const playableCards = useMemo(
    () =>
      hand.filter(card =>
        isPlayable(card, gameMode, hasForcedPending, battleBudget),
      ),
    [hand, gameMode, hasForcedPending, battleBudget],
  );

  // ── Actions ──────────────────────────────────────────────────────────────────
  const dispatchPlay = useCallback(
    (request: CardPlayRequest) => {
      queuePlay(request);
    },
    [queuePlay],
  );

  const dispatchHold = useCallback(
    (instanceId: string) => {
      if (gameMode !== GameMode.GO_ALONE) return;
      holdCard(instanceId);
    },
    [gameMode, holdCard],
  );

  const dispatchRelease = useCallback(() => {
    releaseHold();
  }, [releaseHold]);

  const onDragStart = useCallback((card: CardInHand) => {
    setDraggedCard(card);
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggedCard(null);
  }, []);

  return {
    hand,
    playableCards,
    forcedCards,
    holdSlot,
    handSize:          hand.length,
    forcedCount:       forcedCards.length,
    hasForcedPending,
    gameMode,
    battleBudget,
    trustScore,
    trustMultiplier,
    divergenceScore,
    currentGap,
    chainSynergyActive,
    phaseBoundaryOpen,
    currentPhase,
    missedStreak,
    isReplenishing,
    draggedCard,
    isDragging:        draggedCard !== null,
    dispatchPlay,
    dispatchHold,
    dispatchRelease,
    onDragStart,
    onDragEnd,
  };
}

// ── COST LABEL HELPERS (for UI components) ────────────────────────────────────

/**
 * Returns the display cost string for a card in the current mode.
 * HEAD_TO_HEAD: BB cost for combat cards, cash for others.
 * All other modes: cash cost.
 */
export function getCardCostLabel(card: CardInHand, gameMode: GameMode): string {
  if (
    gameMode === GameMode.HEAD_TO_HEAD &&
    isBudgetCard(card)
  ) {
    return `${Math.floor(card.effectiveCost)} BB`;
  }
  return `$${Math.floor(card.effectiveCost).toLocaleString()}`;
}

/**
 * Returns a trust score modifier string for TEAM_UP mode UI.
 */
export function getTrustModifierLabel(trustMultiplier: number): string {
  const pct = Math.round((trustMultiplier - 1) * 100);
  if (pct > 0) return `+${pct}% Trust`;
  if (pct < 0) return `${pct}% Trust`;
  return '';
}

/**
 * Returns divergence delta display string for CHASE_A_LEGEND.
 */
export function getDivergenceLabel(currentGap: number): string {
  const pct = Math.round(currentGap * 100);
  return `${pct}% behind`;
}