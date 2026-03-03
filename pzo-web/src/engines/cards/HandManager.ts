//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/HandManager.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — HAND MANAGER
// pzo-web/src/engines/cards/HandManager.ts
//
// Owns the complete hand lifecycle:
//   draw from deck → add to hand → track play queue → resolve discards
//
// Manages the HOLD SLOT system (Empire / GO_ALONE exclusive):
//   A card in a hold slot has its decision timer paused. It is NOT counted toward
//   the active hand size. Only 1 hold slot exists. Only 1 card can be held at a time.
//
// Tracks missed draws for the Missed Opportunity system.
//
// RULES:
//   ✦ Hand never exceeds maxHandSize (forced cards can temporarily exceed it by 1).
//   ✦ Forced cards block all non-forced plays until resolved.
//   ✦ Hold slot is Empire (GO_ALONE) exclusive — ignored in other modes.
//   ✦ MissedOpportunityRecord is created when a card is auto-discarded or expires.
//   ✦ HandManager never emits events — CardUXBridge owns all EventBus output.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  TimingClass,
  type CardInHand,
  type HoldSlot,
  type MissedOpportunityRecord,
  type CardPlayRequest,
} from './types';
import { DrawCursor } from './DeckBuilder';
import { ModeOverlayEngine } from './ModeOverlayEngine';
import { v4 as uuidv4 } from 'uuid';

// ── HAND DRAW RESULT ──────────────────────────────────────────────────────────

export interface DrawResult {
  drawn:     CardInHand | null;  // null if deck exhausted or hand full
  reason:    DrawReason;
  handSize:  number;             // hand size AFTER draw
}

export enum DrawReason {
  SUCCESS        = 'SUCCESS',
  DECK_EXHAUSTED = 'DECK_EXHAUSTED',
  HAND_FULL      = 'HAND_FULL',
  CARD_ILLEGAL   = 'CARD_ILLEGAL',  // overlay rejected the card in this mode
}

// ── DISCARD REASON ────────────────────────────────────────────────────────────

export enum DiscardReason {
  PLAYED            = 'PLAYED',
  AUTO_RESOLVED     = 'AUTO_RESOLVED',
  WINDOW_EXPIRED    = 'WINDOW_EXPIRED',
  FORCED_OVERRIDE   = 'FORCED_OVERRIDE',  // forced card replaced this one
  HOLD_RELEASED     = 'HOLD_RELEASED',    // card released from hold into play
}

// ═══════════════════════════════════════════════════════════════════════════════
// HAND MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class HandManager {
  // ── Core state ─────────────────────────────────────────────────────────────
  private hand:       Map<string, CardInHand> = new Map(); // instanceId → card
  private holdSlot:   HoldSlot | null = null;
  private cursor:     DrawCursor | null = null;
  private playQueue:  CardPlayRequest[] = [];

  // ── Missed opportunity tracking ─────────────────────────────────────────────
  private missedOpportunities: MissedOpportunityRecord[] = [];
  private missedOpportunityStreak: number = 0;

  // ── Config ─────────────────────────────────────────────────────────────────
  private readonly maxHandSize:  number;
  private readonly mode:         GameMode;
  private readonly overlayEngine: ModeOverlayEngine;

  constructor(
    mode: GameMode,
    maxHandSize: number,
    overlayEngine: ModeOverlayEngine,
  ) {
    this.mode         = mode;
    this.maxHandSize  = maxHandSize;
    this.overlayEngine = overlayEngine;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  public attachDeck(cursor: DrawCursor): void {
    this.cursor = cursor;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAW
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Draw the next card from the deck into hand.
   *
   * Forced cards bypass the hand-full check — they can temporarily push hand size
   * to maxHandSize + 1. Normal cards respect the cap.
   *
   * @param tickIndex   - Current tick (stamped onto CardInHand.drawnAtTick)
   * @param isForced    - If true, bypasses hand-full check
   */
  public draw(tickIndex: number, isForced: boolean = false): DrawResult {
    if (!this.cursor) {
      return { drawn: null, reason: DrawReason.DECK_EXHAUSTED, handSize: this.hand.size };
    }

    if (this.cursor.isEmpty) {
      return { drawn: null, reason: DrawReason.DECK_EXHAUSTED, handSize: this.hand.size };
    }

    // Normal hand-full check (forced cards bypass)
    if (!isForced && this.hand.size >= this.maxHandSize) {
      return { drawn: null, reason: DrawReason.HAND_FULL, handSize: this.hand.size };
    }

    // Advance the cursor
    const entry = this.cursor.draw()!;

    // Apply mode overlay — may return null if illegal in this mode
    const card = this.overlayEngine.applyOverlay(entry.def, tickIndex);
    if (!card) {
      // Illegal card — skip silently and try again on next replenishment cycle
      return { drawn: null, reason: DrawReason.CARD_ILLEGAL, handSize: this.hand.size };
    }

    this.hand.set(card.instanceId, card);
    return { drawn: card, reason: DrawReason.SUCCESS, handSize: this.hand.size };
  }

  /**
   * Add a materialized CardInHand directly into the hand.
   * Used by ForcedCardQueue to inject pre-built forced cards.
   */
  public injectCard(card: CardInHand): void {
    this.hand.set(card.instanceId, card);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAY QUEUE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enqueue a card play request.
   * CardEngine processes the queue each tick in CardEffectResolver.
   */
  public queuePlay(request: CardPlayRequest): void {
    this.playQueue.push(request);
  }

  /**
   * Consume and return all queued play requests.
   * Called once per tick by CardEngine before effect resolution.
   */
  public flushPlayQueue(): CardPlayRequest[] {
    const queued = [...this.playQueue];
    this.playQueue = [];
    return queued;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCARD / RESOLVE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Remove a card from hand after it has been played or resolved.
   * @returns The removed card, or null if not found.
   */
  public removeCard(instanceId: string, reason: DiscardReason): CardInHand | null {
    const card = this.hand.get(instanceId);
    if (!card) return null;
    this.hand.delete(instanceId);

    // Track missed opportunities on auto-resolution or expiry
    if (
      reason === DiscardReason.AUTO_RESOLVED ||
      reason === DiscardReason.WINDOW_EXPIRED
    ) {
      this.recordMissedOpportunity(card);
    } else {
      // Successful play resets streak
      this.missedOpportunityStreak = 0;
    }

    return card;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOLD SYSTEM (Empire / GO_ALONE exclusive)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Place a card into the hold slot.
   * Timer pauses. Card leaves the active hand.
   * Fails silently if mode is not GO_ALONE or hold slot is occupied.
   *
   * @param instanceId   - Card to hold
   * @param remainingMs  - Time left on the card's decision window (to resume on release)
   * @param heldAtTick   - Current tick
   */
  public holdCard(instanceId: string, remainingMs: number, heldAtTick: number): boolean {
    if (this.mode !== GameMode.GO_ALONE) return false;
    if (this.holdSlot !== null) return false;  // only 1 slot exists

    const card = this.hand.get(instanceId);
    if (!card) return false;

    this.hand.delete(instanceId);

    // Update the isHeld flag on a new CardInHand instance (readonly — create new)
    const heldCard: CardInHand = { ...card, isHeld: true };

    this.holdSlot = {
      card:        heldCard,
      heldAtTick,
      heldAtMs:    Date.now(),
      remainingMs,
    };

    return true;
  }

  /**
   * Release a card from the hold slot back into the active hand.
   * Returns the HoldSlot with remainingMs as it was at hold time.
   */
  public releaseHold(): HoldSlot | null {
    if (!this.holdSlot) return null;

    const slot = this.holdSlot;
    this.holdSlot = null;

    // Return card to active hand (with isHeld = false)
    const releasedCard: CardInHand = { ...slot.card, isHeld: false };
    this.hand.set(releasedCard.instanceId, releasedCard);

    return { ...slot, card: releasedCard };
  }

  /**
   * Is the hold slot currently occupied?
   */
  public get isHoldOccupied(): boolean {
    return this.holdSlot !== null;
  }

  /**
   * Current hold slot contents (null if empty).
   */
  public getHoldSlot(): HoldSlot | null {
    return this.holdSlot;
  }

  /**
   * How many holds remain. Empire has exactly 1 slot — returns 0 if occupied, 1 if free.
   * Non-Empire modes always return 0.
   */
  public getHoldsRemaining(): number {
    if (this.mode !== GameMode.GO_ALONE) return 0;
    return this.holdSlot === null ? 1 : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORCED CARD STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns all currently-held forced cards.
   * Forced cards block all non-forced plays.
   */
  public getForcedCards(): CardInHand[] {
    return Array.from(this.hand.values()).filter(c => c.isForced);
  }

  /**
   * True if any forced card is unresolved in hand.
   */
  public hasForcedCardPending(): boolean {
    return this.getForcedCards().length > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSED OPPORTUNITY TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  private recordMissedOpportunity(card: CardInHand): void {
    this.missedOpportunityStreak += 1;

    const record: MissedOpportunityRecord = {
      cardId:       card.definition.cardId,
      instanceId:   card.instanceId,
      missedAtTick: card.drawnAtTick, // approximate — actual tick stamped at removal
      cordLost:     this.estimateCordLoss(card),
      streakCount:  this.missedOpportunityStreak,
    };

    this.missedOpportunities.push(record);
  }

  /**
   * Rough CORD loss estimate for a missed card.
   * Used for display only — not fed into SovereigntyEngine directly.
   */
  private estimateCordLoss(card: CardInHand): number {
    const baseEffect = card.definition.base_effect.magnitude;
    const modifier   = card.overlay.effect_modifier;
    const cordWeight = card.overlay.cord_weight;
    // Simple linear estimate: effect size → CORD contribution
    return parseFloat((baseEffect * modifier * cordWeight * 0.000_01).toFixed(4));
  }

  public getMissedOpportunityStreak(): number {
    return this.missedOpportunityStreak;
  }

  public getAllMissedOpportunities(): MissedOpportunityRecord[] {
    return [...this.missedOpportunities];
  }

  public resetMissedOpportunityStreak(): void {
    this.missedOpportunityStreak = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ-ONLY ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  public getHand(): ReadonlyMap<string, CardInHand> {
    return this.hand;
  }

  public getCard(instanceId: string): CardInHand | undefined {
    return this.hand.get(instanceId);
  }

  public getHandSize(): number {
    return this.hand.size;
  }

  public getHandArray(): CardInHand[] {
    return Array.from(this.hand.values());
  }

  /** Cards available to play (non-held). Excludes cards in the hold slot. */
  public getPlayableCards(): CardInHand[] {
    return this.getHandArray().filter(c => !c.isHeld);
  }

  /** True if hand has room for another normal draw. */
  public hasRoomForDraw(): boolean {
    return this.hand.size < this.maxHandSize;
  }

  public getDeckRemaining(): number {
    return this.cursor?.remaining ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════════════

  public reset(): void {
    this.hand.clear();
    this.holdSlot   = null;
    this.cursor     = null;
    this.playQueue  = [];
    this.missedOpportunities = [];
    this.missedOpportunityStreak = 0;
  }
}