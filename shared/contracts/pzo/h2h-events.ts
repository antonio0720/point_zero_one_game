// shared/contracts/pzo/h2h-events.ts

import type { ExtractionType, CounterplayAction, ExtractionOutcome } from '../../pzo-web/src/game/modes/predator/extractionEngine';

// ─── Client → Server ──────────────────────────────────────────────────────────

export interface H2HJoinEvent {
  event: 'h2h.match.join';
  matchId: string;
  userId: string;
}

export interface H2HDeckClaimEvent {
  event: 'h2h.deck.claim.request';
  matchId: string;
  playerId: string;
  cardId: string;
  tick: number;
}

export interface H2HExtractionFireEvent {
  event: 'h2h.extraction.fire';
  matchId: string;
  attackerId: string;
  extractionType: ExtractionType;
  tick: number;
}

export interface H2HCounterplaySubmitEvent {
  event: 'h2h.counterplay.submit';
  matchId: string;
  defenderId: string;
  counterplayWindowId: string;
  action: CounterplayAction;
  tick: number;
}

export interface H2HStatePatchEvent {
  event: 'h2h.state.patch';
  matchId: string;
  playerId: string;
  tick: number;
  cash: number;
  income: number;
  netWorth: number;
  shields: number;
  bbCurrent: number;
}

// ─── Server → Client ──────────────────────────────────────────────────────────

export interface H2HDeckClaimResolvedEvent {
  event: 'h2h.deck.claim.resolved';
  cardId: string;
  claimedBy: string;
  deniedTo: string | null;
  tick: number;
}

export interface H2HCounterplayWindowOpenEvent {
  event: 'h2h.counterplay.window.open';
  windowId: string;
  attackerId: string;
  extractionType: ExtractionType;
  rawCashImpact: number;
  rawIncomeImpact: number;
  expiresAtTick: number;
}

export interface H2HExtractionResolvedEvent {
  event: 'h2h.extraction.resolved';
  extractionId: string;
  outcome: ExtractionOutcome;
  cashDelta: number;
  incomeDelta: number;
  shieldDelta: number;
  attackerBBReward: number;
}

export type H2HClientEvent =
  | H2HJoinEvent
  | H2HDeckClaimEvent
  | H2HExtractionFireEvent
  | H2HCounterplaySubmitEvent
  | H2HStatePatchEvent;

export type H2HServerEvent =
  | H2HDeckClaimResolvedEvent
  | H2HCounterplayWindowOpenEvent
  | H2HExtractionResolvedEvent;
