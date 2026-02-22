/**
 * M122 — Weekly Draft League (Snake Draft Rule Modules) — Multiplayer Layer
 * Source spec: mechanics/M122_weekly_draft_league_snake_draft_rule_modules.md
 *
 * Deploy to: pzo_server/src/multiplayer/mechanics/m122.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DraftPhase = 'REGISTRATION' | 'DRAFT_NIGHT' | 'ACTIVE_WEEK' | 'SCORING' | 'CLOSED';

export type RuleModule = {
  moduleId: string;
  name: string;
  category: 'ROUTE' | 'VARIANT'; // never raw power (M122 design law)
  description: string;
};

export interface LeagueSeat {
  accountId: string;
  seatIndex: number;
  pickedModules: RuleModule[];
  autopickEnabled: boolean;
  isConnected: boolean;
}

export interface DraftState {
  leagueId: string;
  seasonId: string;
  weekNumber: number;
  draftSeed: string;           // deterministic; published before draft
  phase: DraftPhase;
  seats: LeagueSeat[];
  pickPool: RuleModule[];
  currentPickIndex: number;    // which overall pick we're on
  pickOrder: number[];         // seatIndex sequence for snake draft
  pickTimerTicks: number;
  pickStartedAtTick: number;
  scoringFormula: string;      // published + deterministic
  scores: Record<string, number>; // accountId → score
}

export interface DraftPickResult {
  leagueId: string;
  seatIndex: number;
  accountId: string;
  moduleId: string;
  pickIndex: number;
  tick: number;
  isAutopick: boolean;
  receiptHash: string;
}

export interface DraftLedgerEvent {
  rule: 'M122';
  rule_version: '1.0';
  eventType: 'DRAFT_PICK' | 'DRAFT_AUTOPICK' | 'DRAFT_COMPLETE' | 'WEEK_SCORES_PUBLISHED';
  leagueId: string;
  tick: number;
  payload: Record<string, unknown>;
  auditHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULES_PER_PLAYER = 4;
const PICK_TIMER_TICKS = 30;        // timer per pick; social moment
const AUTOPICK_TRIGGER_TICKS = 25;  // autopick fires at 25 if no manual pick

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function auditHash(payload: unknown): string {
  return sha256(JSON.stringify(payload)).slice(0, 32);
}

function ledgerEvent(
  eventType: DraftLedgerEvent['eventType'],
  leagueId: string,
  tick: number,
  payload: Record<string, unknown>,
): DraftLedgerEvent {
  return {
    rule: 'M122',
    rule_version: '1.0',
    eventType,
    leagueId,
    tick,
    payload,
    auditHash: auditHash({ eventType, leagueId, tick, payload }),
  };
}

// ─── Snake Draft Mechanics ────────────────────────────────────────────────────

/**
 * Generate snake draft order for N players × MODULES_PER_PLAYER rounds.
 * Snake: round 1 = [0,1,2,...,N-1], round 2 = [N-1,...,1,0], etc.
 */
export function generateSnakeOrder(playerCount: number): number[] {
  const order: number[] = [];
  for (let round = 0; round < MODULES_PER_PLAYER; round++) {
    const seats = Array.from({ length: playerCount }, (_, i) => i);
    if (round % 2 === 1) seats.reverse();
    order.push(...seats);
  }
  return order;
}

/**
 * Deterministic autopick: selects the highest-priority remaining module
 * from the pool using the draft seed + pickIndex as entropy.
 */
export function autopickModule(
  pool: RuleModule[],
  draftSeed: string,
  pickIndex: number,
): RuleModule {
  if (pool.length === 0) throw new Error('M122: pool is empty');
  const hash = sha256(`${draftSeed}:autopick:${pickIndex}`);
  const idx = parseInt(hash.slice(0, 8), 16) % pool.length;
  return pool[idx];
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Initialize a new draft league for the week.
 */
export function initDraftLeague(
  leagueId: string,
  seasonId: string,
  weekNumber: number,
  accountIds: string[],
  modulePool: RuleModule[],
  draftSeed: string,
  scoringFormula: string,
): DraftState {
  if (accountIds.length < 2) throw new Error('M122: minimum 2 players');

  const seats: LeagueSeat[] = accountIds.map((accountId, i) => ({
    accountId,
    seatIndex: i,
    pickedModules: [],
    autopickEnabled: false,
    isConnected: true,
  }));

  return {
    leagueId,
    seasonId,
    weekNumber,
    draftSeed,
    phase: 'REGISTRATION',
    seats,
    pickPool: [...modulePool],
    currentPickIndex: 0,
    pickOrder: generateSnakeOrder(accountIds.length),
    pickTimerTicks: PICK_TIMER_TICKS,
    pickStartedAtTick: 0,
    scoringFormula,
    scores: {},
  };
}

/**
 * Advance to DRAFT_NIGHT phase. Locks the pool; publishes pick order.
 */
export function openDraftNight(state: DraftState, tick: number): DraftState {
  return { ...state, phase: 'DRAFT_NIGHT', pickStartedAtTick: tick };
}

/**
 * Process a manual pick. Validates: correct seat's turn, module in pool.
 */
export function processPick(
  state: DraftState,
  accountId: string,
  moduleId: string,
  tick: number,
): { state: DraftState; result: DraftPickResult; event: DraftLedgerEvent } | { error: string } {
  if (state.phase !== 'DRAFT_NIGHT') return { error: 'NOT_DRAFT_NIGHT' };

  const currentSeatIndex = state.pickOrder[state.currentPickIndex];
  const seat = state.seats[currentSeatIndex];

  if (seat.accountId !== accountId) {
    return { error: `NOT_YOUR_TURN: it's ${seat.accountId}'s pick` };
  }

  const moduleIdx = state.pickPool.findIndex(m => m.moduleId === moduleId);
  if (moduleIdx === -1) return { error: `MODULE_NOT_IN_POOL: ${moduleId}` };

  const module = state.pickPool[moduleIdx];
  const newPool = state.pickPool.filter((_, i) => i !== moduleIdx);
  const updatedSeat: LeagueSeat = { ...seat, pickedModules: [...seat.pickedModules, module] };
  const updatedSeats = state.seats.map((s, i) => i === currentSeatIndex ? updatedSeat : s);

  const nextPickIndex = state.currentPickIndex + 1;
  const draftComplete = nextPickIndex >= state.pickOrder.length;

  const updatedState: DraftState = {
    ...state,
    seats: updatedSeats,
    pickPool: newPool,
    currentPickIndex: nextPickIndex,
    phase: draftComplete ? 'ACTIVE_WEEK' : 'DRAFT_NIGHT',
    pickStartedAtTick: tick,
  };

  const receiptHash = sha256(`pick:${state.leagueId}:${accountId}:${moduleId}:${tick}`).slice(0, 16);
  const result: DraftPickResult = {
    leagueId: state.leagueId,
    seatIndex: currentSeatIndex,
    accountId,
    moduleId,
    pickIndex: state.currentPickIndex,
    tick,
    isAutopick: false,
    receiptHash,
  };

  const eventType = draftComplete ? 'DRAFT_COMPLETE' : 'DRAFT_PICK';
  const event = ledgerEvent(eventType, state.leagueId, tick, {
    accountId,
    moduleId,
    pickIndex: state.currentPickIndex,
    receiptHash,
    draftComplete,
  });

  return { state: updatedState, result, event };
}

/**
 * Fire autopick if timer expires without a manual pick.
 * Deterministic selection from pool using draftSeed + pickIndex.
 */
export function processAutopick(
  state: DraftState,
  tick: number,
): { state: DraftState; result: DraftPickResult; event: DraftLedgerEvent } | { error: string } {
  if (state.phase !== 'DRAFT_NIGHT') return { error: 'NOT_DRAFT_NIGHT' };
  if (tick - state.pickStartedAtTick < AUTOPICK_TRIGGER_TICKS) return { error: 'TIMER_NOT_EXPIRED' };

  const currentSeatIndex = state.pickOrder[state.currentPickIndex];
  const seat = state.seats[currentSeatIndex];
  const module = autopickModule(state.pickPool, state.draftSeed, state.currentPickIndex);

  const newPool = state.pickPool.filter(m => m.moduleId !== module.moduleId);
  const updatedSeat: LeagueSeat = {
    ...seat,
    pickedModules: [...seat.pickedModules, module],
    autopickEnabled: true,
  };
  const updatedSeats = state.seats.map((s, i) => i === currentSeatIndex ? updatedSeat : s);

  const nextPickIndex = state.currentPickIndex + 1;
  const draftComplete = nextPickIndex >= state.pickOrder.length;

  const updatedState: DraftState = {
    ...state,
    seats: updatedSeats,
    pickPool: newPool,
    currentPickIndex: nextPickIndex,
    phase: draftComplete ? 'ACTIVE_WEEK' : 'DRAFT_NIGHT',
    pickStartedAtTick: tick,
  };

  const receiptHash = sha256(`autopick:${state.leagueId}:${seat.accountId}:${module.moduleId}:${tick}`).slice(0, 16);
  const result: DraftPickResult = {
    leagueId: state.leagueId,
    seatIndex: currentSeatIndex,
    accountId: seat.accountId,
    moduleId: module.moduleId,
    pickIndex: state.currentPickIndex,
    tick,
    isAutopick: true,
    receiptHash,
  };

  const event = ledgerEvent('DRAFT_AUTOPICK', state.leagueId, tick, {
    accountId: seat.accountId,
    moduleId: module.moduleId,
    pickIndex: state.currentPickIndex,
    receiptHash,
    draftComplete,
  });

  return { state: updatedState, result, event };
}

/**
 * Publish final week scores. Scores are deterministic (formula is published).
 * Returns scoring event for ledger.
 */
export function publishWeekScores(
  state: DraftState,
  scores: Record<string, number>,
  tick: number,
): { state: DraftState; event: DraftLedgerEvent } {
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const updatedState: DraftState = { ...state, phase: 'SCORING', scores };
  const event = ledgerEvent('WEEK_SCORES_PUBLISHED', state.leagueId, tick, {
    scores,
    leaderboard: sorted.map(([accountId, score], rank) => ({ rank: rank + 1, accountId, score })),
    scoringFormula: state.scoringFormula,
  });
  return { state: updatedState, event };
}
