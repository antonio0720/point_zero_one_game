//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/CardUXBridge.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD UX BRIDGE
// pzo-web/src/engines/cards/CardUXBridge.ts
//
// The ONLY outbound EventBus emitter for all card-layer events.
// Zero calculation logic. Zero state. Zero engine knowledge.
// Every card system event that leaves the engine passes through this file.
//
// ARCHITECTURE RULE:
//   If a card-layer event is emitted anywhere other than CardUXBridge, it is
//   an architectural violation. CardEngine calls CardUXBridge methods.
//   CardUXBridge calls EventBus.emit(). Nothing else emits card events.
//
// EVENT COVERAGE (24 card-layer events):
//   CARD_DRAWN              — card entered the hand
//   CARD_PLAYED             — player resolved a card
//   CARD_DISCARDED          — card left hand (non-play reasons)
//   CARD_HELD               — Empire hold system — card staged
//   CARD_UNHELD             — released from hold
//   CARD_AUTO_RESOLVED      — decision window expired
//   FORCED_CARD_INJECTED    — threat/bot card materialized
//   FORCED_CARD_RESOLVED    — forced card cleared
//   MISSED_OPPORTUNITY      — missed draw logged
//   PHASE_BOUNDARY_CARD_AVAILABLE — Empire phase transition window
//   PHASE_BOUNDARY_WINDOW_CLOSED
//   LEGENDARY_CARD_DRAWN    — 1% drop fanfare
//   BLUFF_CARD_DISPLAYED    — Predator fake threat display
//   COUNTER_WINDOW_OPENED   — Predator 5-sec counter window
//   COUNTER_WINDOW_CLOSED
//   RESCUE_WINDOW_OPENED    — Syndicate crisis window
//   RESCUE_WINDOW_CLOSED
//   DEFECTION_STEP_PLAYED   — betrayal arc step
//   DEFECTION_COMPLETED     — arc complete
//   AID_TERMS_ACTIVATED     — Syndicate contract locked in
//   AID_REPAID
//   AID_DEFAULTED           — trust score penalty
//   GHOST_CARD_ACTIVATED    — Phantom legend marker consumed
//   PROOF_BADGE_CONDITION_MET
//   CARD_HAND_SNAPSHOT      — full state snapshot (every tick)
//   DECISION_WINDOW_OPENED
//   DECISION_WINDOW_EXPIRED
//   DECISION_WINDOW_RESOLVED
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  type CardInHand,
  type ForcedCardEntry,
  type DecisionWindow,
  type DecisionRecord,
  type AidCardTerms,
  type MissedOpportunityRecord,
  type PhaseBoundaryWindow,
  type CardEffectResult,
  type CardEventPayloadMap,
  DefectionStep,
  ForcedCardSource,
  LegendMarkerType,
  RunPhase,
  CardRarity,
} from './types';
import type { EventBus } from '../zero/EventBus';
import type { ExpiredWindowRecord, ResolvedWindowRecord } from './DecisionWindowManager';

// ═══════════════════════════════════════════════════════════════════════════════
// CARD UX BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

export class CardUXBridge {
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HAND LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  public emitCardDrawn(card: CardInHand, tickIndex: number): void {
    this.emit('CARD_DRAWN', {
      instanceId: card.instanceId,
      cardId:     card.definition.cardId,
      deckType:   card.definition.deckType,
      rarity:     card.definition.rarity,
      tickIndex,
    });

    // Legendary cards get a separate high-priority fanfare event
    if (card.isLegendary) {
      this.emitLegendaryDrawn(card, tickIndex);
    }
  }

  public emitCardPlayed(
    card:         CardInHand,
    effectResult: CardEffectResult,
    record:       DecisionRecord,
    tickIndex:    number,
  ): void {
    this.emit('CARD_PLAYED', {
      instanceId:    card.instanceId,
      cardId:        card.definition.cardId,
      choiceId:      effectResult.choiceId,
      resolvedInMs:  record.resolvedInMs,
      wasOptimal:    effectResult.isOptimalChoice,
      cordDelta:     record.cordContribution,
      tickIndex,
    });
  }

  public emitCardDiscarded(card: CardInHand, reason: string, tickIndex: number): void {
    this.emit('CARD_DISCARDED', {
      instanceId: card.instanceId,
      cardId:     card.definition.cardId,
      reason,
      tickIndex,
    });
  }

  public emitCardHeld(card: CardInHand, remainingMs: number, tickIndex: number): void {
    this.emit('CARD_HELD', {
      instanceId: card.instanceId,
      cardId:     card.definition.cardId,
      remainingMs,
      tickIndex,
    });
  }

  public emitCardUnheld(card: CardInHand, tickIndex: number): void {
    this.emit('CARD_UNHELD', {
      instanceId: card.instanceId,
      cardId:     card.definition.cardId,
      tickIndex,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-RESOLVE
  // ═══════════════════════════════════════════════════════════════════════════

  public emitCardAutoResolved(
    card:       CardInHand,
    autoChoice: string,
    speedScore: number,
    tickIndex:  number,
  ): void {
    this.emit('CARD_AUTO_RESOLVED', {
      instanceId: card.instanceId,
      cardId:     card.definition.cardId,
      autoChoice,
      speedScore,
      tickIndex,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORCED CARDS
  // ═══════════════════════════════════════════════════════════════════════════

  public emitForcedCardInjected(
    entry:      ForcedCardEntry,
    card:       CardInHand,
    tickIndex:  number,
  ): void {
    this.emit('FORCED_CARD_INJECTED', {
      entryId:    entry.entryId,
      cardId:     entry.cardId,
      source:     entry.sourceEngine,
      instanceId: card.instanceId,
      tickIndex,
    });
  }

  public emitForcedCardResolved(
    entry:      ForcedCardEntry,
    card:       CardInHand,
    tickIndex:  number,
  ): void {
    this.emit('FORCED_CARD_RESOLVED', {
      entryId:    entry.entryId,
      cardId:     entry.cardId,
      instanceId: card.instanceId,
      tickIndex,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSED OPPORTUNITY
  // ═══════════════════════════════════════════════════════════════════════════

  public emitMissedOpportunity(
    record:    MissedOpportunityRecord,
    tickIndex: number,
  ): void {
    this.emit('MISSED_OPPORTUNITY', {
      instanceId:  record.instanceId,
      cardId:      record.cardId,
      cordLost:    record.cordLost,
      streakCount: record.streakCount,
      tickIndex,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE BOUNDARY (Empire)
  // ═══════════════════════════════════════════════════════════════════════════

  public emitPhaseBoundaryAvailable(window: PhaseBoundaryWindow, tickIndex: number): void {
    this.emit('PHASE_BOUNDARY_CARD_AVAILABLE', {
      phase:           window.phase,
      cardsAvailable:  window.cardsAvailable,
      closesAtTick:    window.closesAtTick,
      tickIndex,
    });
  }

  public emitPhaseBoundaryWindowClosed(
    phase:       RunPhase,
    wasConsumed: boolean,
    tickIndex:   number,
  ): void {
    this.emit('PHASE_BOUNDARY_WINDOW_CLOSED', { phase, wasConsumed, tickIndex });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGENDARY
  // ═══════════════════════════════════════════════════════════════════════════

  private emitLegendaryDrawn(card: CardInHand, tickIndex: number): void {
    this.emit('LEGENDARY_CARD_DRAWN', {
      instanceId: card.instanceId,
      cardId:     card.definition.cardId,
      tickIndex,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREDATOR: BLUFF + COUNTER WINDOW
  // ═══════════════════════════════════════════════════════════════════════════

  public emitBluffCardDisplayed(
    card:                CardInHand,
    displayedAsCardId:   string,
    tickIndex:           number,
  ): void {
    this.emit('BLUFF_CARD_DISPLAYED', {
      instanceId:        card.instanceId,
      cardId:            card.definition.cardId,
      displayedAsCardId,
      tickIndex,
    });
  }

  public emitCounterWindowOpened(
    triggerAttackId: string,
    durationMs:      number,
    tickIndex:       number,
  ): void {
    this.emit('COUNTER_WINDOW_OPENED', { triggerAttackId, durationMs, tickIndex });
  }

  public emitCounterWindowClosed(
    triggerAttackId: string,
    wasCountered:    boolean,
    tickIndex:       number,
  ): void {
    this.emit('COUNTER_WINDOW_CLOSED', { triggerAttackId, wasCountered, tickIndex });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNDICATE: RESCUE WINDOW
  // ═══════════════════════════════════════════════════════════════════════════

  public emitRescueWindowOpened(
    teammateId: string,
    durationMs: number,
    tickIndex:  number,
  ): void {
    this.emit('RESCUE_WINDOW_OPENED', { teammateId, durationMs, tickIndex });
  }

  public emitRescueWindowClosed(
    teammateId:             string,
    wasRescued:             boolean,
    effectivenessMultiplier: number,
    tickIndex:              number,
  ): void {
    this.emit('RESCUE_WINDOW_CLOSED', { teammateId, wasRescued, effectivenessMultiplier, tickIndex });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNDICATE: DEFECTION ARC
  // ═══════════════════════════════════════════════════════════════════════════

  public emitDefectionStepPlayed(
    step:       DefectionStep,
    defectorId: string,
    tickIndex:  number,
  ): void {
    this.emit('DEFECTION_STEP_PLAYED', { step, defectorId, tickIndex });
  }

  public emitDefectionCompleted(
    defectorId:  string,
    cordPenalty: number,
    tickIndex:   number,
  ): void {
    this.emit('DEFECTION_COMPLETED', { defectorId, cordPenalty, tickIndex });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNDICATE: AID CARD TERMS
  // ═══════════════════════════════════════════════════════════════════════════

  public emitAidTermsActivated(terms: AidCardTerms, tickIndex: number): void {
    this.emit('AID_TERMS_ACTIVATED', { terms, tickIndex });
  }

  public emitAidRepaid(
    lenderId:   string,
    receiverId: string,
    amount:     number,
    tickIndex:  number,
  ): void {
    this.emit('AID_REPAID', { lenderId, receiverId, amount, tickIndex });
  }

  public emitAidDefaulted(
    receiverId:     string,
    penaltyApplied: number,
    tickIndex:      number,
  ): void {
    this.emit('AID_DEFAULTED', { receiverId, penaltyApplied, tickIndex });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHANTOM: GHOST CARD + PROOF BADGE
  // ═══════════════════════════════════════════════════════════════════════════

  public emitGhostCardActivated(
    card:             CardInHand,
    markerType:       LegendMarkerType,
    divergenceDelta:  number,
    tickIndex:        number,
  ): void {
    this.emit('GHOST_CARD_ACTIVATED', {
      instanceId:      card.instanceId,
      cardId:          card.definition.cardId,
      markerType,
      divergenceDelta,
      tickIndex,
    });
  }

  public emitProofBadgeConditionMet(
    badgeId:   string,
    cardId:    string,
    tickIndex: number,
  ): void {
    this.emit('PROOF_BADGE_CONDITION_MET', { badgeId, cardId, tickIndex });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECISION WINDOWS
  // ═══════════════════════════════════════════════════════════════════════════

  public emitDecisionWindowOpened(
    window:       DecisionWindow,
    tickIndex:    number,
  ): void {
    this.emit('DECISION_WINDOW_OPENED', {
      windowId:          window.windowId,
      cardId:            window.cardId,
      cardInstanceId:    window.cardInstanceId,
      durationMs:        window.durationMs,
      autoResolveChoice: window.autoResolveChoice,
      tickIndex,
    });
  }

  public emitDecisionWindowExpired(expired: ExpiredWindowRecord, tickIndex: number): void {
    this.emit('DECISION_WINDOW_EXPIRED', {
      windowId:       expired.windowId,
      cardId:         expired.cardId,
      cardInstanceId: expired.cardInstanceId,
      autoChoice:     expired.autoChoice,
      speedScore:     expired.speedScore,
      tickIndex,
    });
  }

  public emitDecisionWindowResolved(resolved: ResolvedWindowRecord, wasOptimal: boolean, tickIndex: number): void {
    this.emit('DECISION_WINDOW_RESOLVED', {
      windowId:       resolved.windowId,
      cardId:         resolved.cardId,
      cardInstanceId: resolved.cardInstanceId,
      choiceId:       resolved.choiceId,
      resolvedInMs:   resolved.resolvedInMs,
      wasOptimal,
      tickIndex,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICK SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Emits a full hand state snapshot once per tick.
   * engineStore uses this to update the card slice without re-reading individual events.
   */
  public emitHandSnapshot(
    handSize:       number,
    forcedCount:    number,
    windowsActive:  number,
    tickIndex:      number,
  ): void {
    this.emit('CARD_HAND_SNAPSHOT', { handSize, forcedCount, windowsActive, tickIndex });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: TYPED EMIT WRAPPER
  // ═══════════════════════════════════════════════════════════════════════════

  private emit<K extends keyof CardEventPayloadMap>(
    event:   K,
    payload: CardEventPayloadMap[K],
  ): void {
    this.eventBus.emit(event as any, payload);
  }
}