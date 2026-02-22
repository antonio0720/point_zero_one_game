/**
 * M02 — 12-Minute Run Clock + Turn Timer
 * Source spec: mechanics/M02_12_minute_run_clock_turn_timer.md
 *
 * The clock is real-time. Each turn has a decision window; unused time
 * accumulates as Inertia, increasing Missed Opportunity odds. When the
 * run clock hits zero, any unresolved liabilities can trigger a wipe.
 *
 * Deploy to: pzo_engine/src/mechanics/m002.ts
 */

import { createHash } from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Total run duration in seconds (12 minutes). */
export const RUN_DURATION_SECONDS = 720;

/** Default decision window per turn in seconds. */
export const DEFAULT_TURN_WINDOW_SECONDS = 30;

/** Inertia accumulates when a player uses < this fraction of their turn window. */
export const INERTIA_THRESHOLD_FRACTION = 0.40;

/**
 * Each second of unused turn time converts to this many Inertia units.
 * Inertia is consumed by the deck reactor to increase MISSED_OPPORTUNITY draw weight.
 */
export const INERTIA_PER_UNUSED_SECOND = 0.05;

/** Hard cap on Inertia (prevents runaway accumulation). */
export const INERTIA_MAX = 5.0;

/** Macro-decay cash drain per second when run clock < this threshold (last 2 min). */
export const MACRO_DECAY_TRIGGER_SECONDS = 120;

/** Cash drained per second in macro-decay mode (tunable by season module). */
export const MACRO_DECAY_RATE_PER_SECOND = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export type RunPhase =
  | 'WAITING'     // not started
  | 'ACTIVE'      // clock running, turn in progress
  | 'BETWEEN_TURNS' // resolving card; brief gap before next turn
  | 'MACRO_DECAY' // final 2 minutes; cash drains
  | 'FINALIZED';  // run ended (wipe, win, or clock-out)

export interface RunClockState {
  runSeed: string;
  rulesetVersion: string;
  phase: RunPhase;
  runElapsedSeconds: number;
  runRemainingSeconds: number;
  currentTurnNumber: number;
  currentTurnWindowSeconds: number;
  currentTurnElapsedSeconds: number;
  currentTurnRemainingSeconds: number;
  inertia: number;                    // accumulated hesitation score 0–INERTIA_MAX
  macroDecayActive: boolean;
  totalCashDecayed: number;           // cumulative cash drained by macro-decay
  turnHistory: TurnTimingRecord[];
}

export interface TurnTimingRecord {
  turnNumber: number;
  windowSeconds: number;
  usedSeconds: number;
  unusedSeconds: number;
  inertiaAdded: number;
  decisionType: 'PURCHASE' | 'PASS' | 'FORCED' | 'TIMEOUT';
}

export interface ClockTickResult {
  state: RunClockState;
  events: ClockEvent[];
  cashDecayThisTick: number;
}

export type ClockEventType =
  | 'TURN_WINDOW_STARTED'
  | 'TURN_WINDOW_EXPIRED'       // player didn't decide; forced timeout
  | 'INERTIA_ACCUMULATED'
  | 'MACRO_DECAY_STARTED'
  | 'MACRO_DECAY_TICK'
  | 'RUN_CLOCK_EXPIRED'
  | 'RUN_FINALIZED';

export interface ClockEvent {
  type: ClockEventType;
  tick: number;
  runElapsedSeconds: number;
  payload: Record<string, unknown>;
  auditHash: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildEvent(
  type: ClockEventType,
  state: RunClockState,
  tick: number,
  payload: Record<string, unknown>,
): ClockEvent {
  const auditHash = sha256(JSON.stringify({ type, runSeed: state.runSeed, tick, payload, rulesetVersion: state.rulesetVersion }));
  return { type, tick, runElapsedSeconds: state.runElapsedSeconds, payload, auditHash };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createRunClock(runSeed: string, rulesetVersion: string): RunClockState {
  return {
    runSeed,
    rulesetVersion,
    phase: 'WAITING',
    runElapsedSeconds: 0,
    runRemainingSeconds: RUN_DURATION_SECONDS,
    currentTurnNumber: 0,
    currentTurnWindowSeconds: DEFAULT_TURN_WINDOW_SECONDS,
    currentTurnElapsedSeconds: 0,
    currentTurnRemainingSeconds: DEFAULT_TURN_WINDOW_SECONDS,
    inertia: 0,
    macroDecayActive: false,
    totalCashDecayed: 0,
    turnHistory: [],
  };
}

// ─── Core Clock Tick ──────────────────────────────────────────────────────────

/**
 * Advance the run clock by `deltaSeconds` (usually 1.0 for server tick).
 * Returns updated state + events emitted this tick + cash drained by macro-decay.
 * Caller is responsible for applying cashDecayThisTick to PlayerState.
 */
export function tickClock(
  state: RunClockState,
  deltaSeconds: number,
  tick: number,
): ClockTickResult {
  if (state.phase === 'WAITING' || state.phase === 'FINALIZED') {
    return { state, events: [], cashDecayThisTick: 0 };
  }

  const events: ClockEvent[] = [];
  let cashDecayThisTick = 0;

  let s: RunClockState = {
    ...state,
    runElapsedSeconds: state.runElapsedSeconds + deltaSeconds,
    runRemainingSeconds: Math.max(0, state.runRemainingSeconds - deltaSeconds),
    currentTurnElapsedSeconds: state.currentTurnElapsedSeconds + deltaSeconds,
    currentTurnRemainingSeconds: Math.max(0, state.currentTurnRemainingSeconds - deltaSeconds),
  };

  // ── Macro-Decay Trigger ───────────────────────────────────────────────────
  if (!s.macroDecayActive && s.runRemainingSeconds <= MACRO_DECAY_TRIGGER_SECONDS) {
    s = { ...s, macroDecayActive: true, phase: 'MACRO_DECAY' };
    events.push(buildEvent('MACRO_DECAY_STARTED', s, tick, { runRemainingSeconds: s.runRemainingSeconds }));
  }

  // ── Macro-Decay Cash Drain ────────────────────────────────────────────────
  if (s.macroDecayActive && s.phase !== 'FINALIZED') {
    cashDecayThisTick = MACRO_DECAY_RATE_PER_SECOND * deltaSeconds;
    s = { ...s, totalCashDecayed: s.totalCashDecayed + cashDecayThisTick };
    events.push(buildEvent('MACRO_DECAY_TICK', s, tick, {
      cashDrained: cashDecayThisTick,
      totalCashDecayed: s.totalCashDecayed,
      runRemainingSeconds: s.runRemainingSeconds,
    }));
  }

  // ── Turn Window Expired ───────────────────────────────────────────────────
  if (s.phase === 'ACTIVE' && s.currentTurnRemainingSeconds <= 0) {
    const unusedSeconds = 0; // full window consumed (timeout = window used)
    events.push(buildEvent('TURN_WINDOW_EXPIRED', s, tick, {
      turnNumber: s.currentTurnNumber,
      windowSeconds: s.currentTurnWindowSeconds,
    }));
    // Inertia: full window unused (player timed out) = max inertia add
    const inertiaAdded = clamp(s.currentTurnWindowSeconds * INERTIA_PER_UNUSED_SECOND, 0, INERTIA_MAX - s.inertia);
    s = {
      ...s,
      inertia: clamp(s.inertia + inertiaAdded, 0, INERTIA_MAX),
      phase: 'BETWEEN_TURNS',
    };
    if (inertiaAdded > 0) {
      events.push(buildEvent('INERTIA_ACCUMULATED', s, tick, { inertiaAdded, totalInertia: s.inertia }));
    }
    s = recordTurn(s, unusedSeconds, 'TIMEOUT');
  }

  // ── Run Clock Expired ─────────────────────────────────────────────────────
  if (s.runRemainingSeconds <= 0 && s.phase !== 'FINALIZED') {
    s = { ...s, phase: 'FINALIZED' };
    events.push(buildEvent('RUN_CLOCK_EXPIRED', s, tick, {
      totalTurns: s.currentTurnNumber,
      totalInertia: s.inertia,
      totalCashDecayed: s.totalCashDecayed,
    }));
    events.push(buildEvent('RUN_FINALIZED', s, tick, { reason: 'CLOCK_EXPIRED' }));
  }

  return { state: s, events, cashDecayThisTick };
}

// ─── Turn Management ──────────────────────────────────────────────────────────

/**
 * Start a new turn window. Call after card resolution is complete.
 * Turn window can be shorter in macro-decay phase (urgency).
 */
export function startTurnWindow(
  state: RunClockState,
  tick: number,
  overrideWindowSeconds?: number,
): { state: RunClockState; event: ClockEvent } {
  const windowSeconds = overrideWindowSeconds
    ?? (state.macroDecayActive ? DEFAULT_TURN_WINDOW_SECONDS * 0.6 : DEFAULT_TURN_WINDOW_SECONDS);

  const s: RunClockState = {
    ...state,
    phase: 'ACTIVE',
    currentTurnNumber: state.currentTurnNumber + 1,
    currentTurnWindowSeconds: windowSeconds,
    currentTurnElapsedSeconds: 0,
    currentTurnRemainingSeconds: windowSeconds,
  };

  const event = buildEvent('TURN_WINDOW_STARTED', s, tick, {
    turnNumber: s.currentTurnNumber,
    windowSeconds,
    macroDecay: state.macroDecayActive,
  });

  return { state: s, event };
}

/**
 * Complete a turn with a player decision. Records timing, computes inertia.
 * `decisionType` reflects what the player actually did.
 * Returns updated state + any inertia event.
 */
export function completeTurn(
  state: RunClockState,
  decisionType: TurnTimingRecord['decisionType'],
  tick: number,
): { state: RunClockState; events: ClockEvent[] } {
  const events: ClockEvent[] = [];
  const usedSeconds = state.currentTurnElapsedSeconds;
  const unusedSeconds = Math.max(0, state.currentTurnWindowSeconds - usedSeconds);
  const useFraction = state.currentTurnWindowSeconds > 0 ? usedSeconds / state.currentTurnWindowSeconds : 1;

  let inertiaAdded = 0;
  if (useFraction < INERTIA_THRESHOLD_FRACTION) {
    // Didn't use enough of the window — hesitation penalty
    inertiaAdded = clamp(unusedSeconds * INERTIA_PER_UNUSED_SECOND, 0, INERTIA_MAX - state.inertia);
  } else if (decisionType === 'PURCHASE' && state.inertia > 0) {
    // Decisive purchase drains some inertia (positive reinforcement)
    inertiaAdded = -Math.min(state.inertia, 0.5);
  }

  let s = {
    ...state,
    inertia: clamp(state.inertia + inertiaAdded, 0, INERTIA_MAX),
    phase: 'BETWEEN_TURNS' as RunPhase,
  };

  s = recordTurn(s, unusedSeconds, decisionType);

  if (inertiaAdded > 0) {
    events.push(buildEvent('INERTIA_ACCUMULATED', s, tick, { inertiaAdded, totalInertia: s.inertia, decisionType }));
  }

  return { state: s, events };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function recordTurn(
  state: RunClockState,
  unusedSeconds: number,
  decisionType: TurnTimingRecord['decisionType'],
): RunClockState {
  const record: TurnTimingRecord = {
    turnNumber: state.currentTurnNumber,
    windowSeconds: state.currentTurnWindowSeconds,
    usedSeconds: state.currentTurnElapsedSeconds,
    unusedSeconds,
    inertiaAdded: 0, // computed above and applied separately
    decisionType,
  };
  return { ...state, turnHistory: [...state.turnHistory, record] };
}

// ─── Read Helpers ─────────────────────────────────────────────────────────────

/** How much MISSED_OPPORTUNITY weight Inertia adds to deck draw (0–1). */
export function inertiaToMissedOpportunityWeight(inertia: number): number {
  // Monotonic 0→0.4: max Inertia adds 40% extra draw weight to MISSED_OPPORTUNITY deck
  return clamp((inertia / INERTIA_MAX) * 0.40, 0, 0.40);
}

/** Audit hash over the full clock state — use in ledger events. */
export function clockAuditHash(state: RunClockState): string {
  return sha256(JSON.stringify({
    runSeed: state.runSeed,
    rulesetVersion: state.rulesetVersion,
    runElapsedSeconds: state.runElapsedSeconds,
    currentTurnNumber: state.currentTurnNumber,
    inertia: state.inertia,
    totalCashDecayed: state.totalCashDecayed,
    phase: state.phase,
  })).slice(0, 32);
}

export function isRunExpired(state: RunClockState): boolean {
  return state.phase === 'FINALIZED' || state.runRemainingSeconds <= 0;
}

export function formatRemainingTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
