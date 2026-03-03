// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/predatorEventBridge.ts
// Sprint 7 — Predator EventBus Bridge (new)
//
// Registers PREDATOR_* channels on the zero/EventBus and provides typed
// emit helpers for PredatorModeEngine.ts.
//
// CANONICAL BUS: zero/EventBus (matches BattleUXBridge.ts pattern).
// All emit calls must go through this file — no inline bus.emit() in engine files.
//
// NOTE: Add these to PZOEventChannel enum in EventBus.ts:
//   PREDATOR_EXTRACTION_FIRED     = 'PREDATOR_EXTRACTION_FIRED'
//   PREDATOR_EXTRACTION_RESOLVED  = 'PREDATOR_EXTRACTION_RESOLVED'
//   PREDATOR_COUNTERPLAY_OPENED   = 'PREDATOR_COUNTERPLAY_OPENED'
//   PREDATOR_COUNTERPLAY_RESOLVED = 'PREDATOR_COUNTERPLAY_RESOLVED'
//   PREDATOR_TILT_ACTIVATED       = 'PREDATOR_TILT_ACTIVATED'
//   PREDATOR_TILT_RESOLVED        = 'PREDATOR_TILT_RESOLVED'
//   PREDATOR_BB_DEPLETED          = 'PREDATOR_BB_DEPLETED'
//   PREDATOR_BB_ROUND_RESET       = 'PREDATOR_BB_ROUND_RESET'
//   PREDATOR_RIVALRY_TIER_CHANGED = 'PREDATOR_RIVALRY_TIER_CHANGED'
//   PREDATOR_TEMPO_CHAIN_STARTED  = 'PREDATOR_TEMPO_CHAIN_STARTED'
//   PREDATOR_TEMPO_CHAIN_BROKE    = 'PREDATOR_TEMPO_CHAIN_BROKE'
//   PREDATOR_DECK_CLAIMED         = 'PREDATOR_DECK_CLAIMED'
//   PREDATOR_DECK_EXPIRED         = 'PREDATOR_DECK_EXPIRED'
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { ExtractionAction, ExtractionImpact, ExtractionType, CounterplayAction } from './extractionEngine';
import type { CounterplayWindow } from './counterplayWindowEngine';
import type { BattleBudgetState } from './battleBudgetEngine';
import type { RivalryRecord, RivalryTier } from './rivalryModel';
import type { PsycheMeterState } from './psycheMeter';
import type { SharedDeckCard } from './sharedOpportunityDeck';

// ── Channel strings ───────────────────────────────────────────────────────────

export const PREDATOR_CHANNELS = {
  EXTRACTION_FIRED:     'PREDATOR_EXTRACTION_FIRED',
  EXTRACTION_RESOLVED:  'PREDATOR_EXTRACTION_RESOLVED',
  COUNTERPLAY_OPENED:   'PREDATOR_COUNTERPLAY_OPENED',
  COUNTERPLAY_RESOLVED: 'PREDATOR_COUNTERPLAY_RESOLVED',
  TILT_ACTIVATED:       'PREDATOR_TILT_ACTIVATED',
  TILT_RESOLVED:        'PREDATOR_TILT_RESOLVED',
  BB_DEPLETED:          'PREDATOR_BB_DEPLETED',
  BB_ROUND_RESET:       'PREDATOR_BB_ROUND_RESET',
  RIVALRY_TIER_CHANGED: 'PREDATOR_RIVALRY_TIER_CHANGED',
  TEMPO_CHAIN_STARTED:  'PREDATOR_TEMPO_CHAIN_STARTED',
  TEMPO_CHAIN_BROKE:    'PREDATOR_TEMPO_CHAIN_BROKE',
  DECK_CLAIMED:         'PREDATOR_DECK_CLAIMED',
  DECK_EXPIRED:         'PREDATOR_DECK_EXPIRED',
} as const;

// ── Minimal bus interface (mirrors zero/EventBus) ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBus = { emit: (channel: string, payload: object) => void };

// ── Extraction ────────────────────────────────────────────────────────────────

export function emitExtractionFired(
  bus:        AnyBus,
  extraction: ExtractionAction,
  tick:       number,
): void {
  bus.emit(PREDATOR_CHANNELS.EXTRACTION_FIRED, {
    tick,
    extractionId: extraction.id,
    type:         extraction.type,
    attackerId:   extraction.attackerId,
    defenderId:   extraction.defenderId,
    rawCashImpact: extraction.rawCashImpact,
    bbCost:       extraction.bbCost,
    windowTicks:  extraction.expiresAtTick - extraction.firedAtTick,
  });
}

export function emitExtractionResolved(
  bus:        AnyBus,
  extraction: ExtractionAction,
  impact:     ExtractionImpact,
  blowback:   number,
  tick:       number,
): void {
  bus.emit(PREDATOR_CHANNELS.EXTRACTION_RESOLVED, {
    tick,
    extractionId:     extraction.id,
    type:             extraction.type,
    outcome:          extraction.outcome,
    defenderCashDelta: impact.defenderCashDelta,
    attackerBlowback: blowback,
    psycheHit:        impact.psycheHit,
    attackerBBReward: impact.attackerBBReward,
  });
}

// ── Counterplay ───────────────────────────────────────────────────────────────

export function emitCounterplayOpened(
  bus:     AnyBus,
  window:  CounterplayWindow,
  tick:    number,
): void {
  bus.emit(PREDATOR_CHANNELS.COUNTERPLAY_OPENED, {
    tick,
    windowId:     window.id,
    extractionId: window.extraction.id,
    attackType:   window.extraction.type,
    expiresAt:    window.expiresAtTick,
  });
}

export function emitCounterplayResolved(
  bus:      AnyBus,
  window:   CounterplayWindow,
  action:   CounterplayAction,
  psycheRelief: number,
  tick:     number,
): void {
  bus.emit(PREDATOR_CHANNELS.COUNTERPLAY_RESOLVED, {
    tick,
    windowId:    window.id,
    action,
    wasSuccessful: window.wasSuccessful,
    psycheRelief,
    reflectBlowback: window.reflectDamageTarget?.cashHit ?? 0,
  });
}

// ── Psyche / Tilt ─────────────────────────────────────────────────────────────

export function emitTiltActivated(
  bus:        AnyBus,
  psyche:     PsycheMeterState,
  tick:       number,
): void {
  bus.emit(PREDATOR_CHANNELS.TILT_ACTIVATED, {
    tick,
    psycheValue: psyche.value,
    tiltCount:   psyche.tiltCount,
    drawPenalty: 0,   // caller computes tiltDrawPenalty()
  });
}

export function emitTiltResolved(
  bus:       AnyBus,
  tiltTicks: number,
  tick:      number,
): void {
  bus.emit(PREDATOR_CHANNELS.TILT_RESOLVED, { tick, tiltTicks });
}

// ── Battle Budget ─────────────────────────────────────────────────────────────

export function emitBBDepleted(bus: AnyBus, bb: BattleBudgetState, tick: number): void {
  bus.emit(PREDATOR_CHANNELS.BB_DEPLETED, {
    tick,
    debt:       bb.bbDebt,
    efficiency: bb.efficiency,
  });
}

export function emitBBRoundReset(bus: AnyBus, bb: BattleBudgetState, tick: number): void {
  bus.emit(PREDATOR_CHANNELS.BB_ROUND_RESET, {
    tick,
    roundGenerated: bb.roundGenerated,
    current:        bb.current,
    debtForgiven:   0, // caller computes
  });
}

// ── Rivalry ───────────────────────────────────────────────────────────────────

export function emitRivalryTierChanged(
  bus:        AnyBus,
  record:     RivalryRecord,
  fromTier:   RivalryTier,
  tick:       number,
): void {
  bus.emit(PREDATOR_CHANNELS.RIVALRY_TIER_CHANGED, {
    tick,
    opponentId:  record.opponentId,
    from:        fromTier,
    to:          record.tier,
    amplifier:   record.cardAmplifier,
    totalWins:   record.wins,
  });
}

// ── Tempo Chain ───────────────────────────────────────────────────────────────

export function emitTempoChainStarted(
  bus:   AnyBus,
  depth: number,
  mult:  number,
  tick:  number,
): void {
  bus.emit(PREDATOR_CHANNELS.TEMPO_CHAIN_STARTED, { tick, depth, multiplier: mult });
}

export function emitTempoChainBroke(
  bus:   AnyBus,
  depth: number,
  tick:  number,
): void {
  bus.emit(PREDATOR_CHANNELS.TEMPO_CHAIN_BROKE, { tick, peakDepth: depth });
}

// ── Shared Deck ───────────────────────────────────────────────────────────────

export function emitDeckClaimed(
  bus:       AnyBus,
  card:      SharedDeckCard,
  claimerId: string,
  deniedId:  string,
  tick:      number,
): void {
  bus.emit(PREDATOR_CHANNELS.DECK_CLAIMED, {
    tick,
    cardId:     card.id,
    cardTitle:  card.title,
    claimerId,
    deniedId,
    denyValue:  card.denyValue,
    latency:    card.claimLatencyTicks,
  });
}

export function emitDeckExpired(
  bus:   AnyBus,
  cards: SharedDeckCard[],
  tick:  number,
): void {
  bus.emit(PREDATOR_CHANNELS.DECK_EXPIRED, {
    tick,
    count:    cards.length,
    cardIds:  cards.map(c => c.id),
  });
}