// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/rivalryModel.ts
// Sprint 4 — Rivalry Persistence System
//
// Rivalry activates after 3+ consecutive wins against the same opponent.
// Rivalry cards get amplified effects in repeated matchups.
// Rivalry history persists to backend for leaderboard and CORD context.
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

export type RivalryTier = 'NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY';

export interface RivalryRecord {
  opponentId: string;
  opponentDisplayName: string;
  wins: number;
  losses: number;
  draws: number;
  consecutiveWins: number;
  tier: RivalryTier;
  /** Total extractions landed against this opponent */
  extractionsLanded: number;
  /** Total counterplays beaten from this opponent */
  counterplaysBeat: number;
  /** Run IDs this rivalry spans */
  matchIds: string[];
  firstMatchAt: number;
  lastMatchAt: number;
  /** Rivalry card bonus multiplier (1.0 base, up to 1.35 LEGENDARY) */
  cardAmplifier: number;
}

export interface RivalryState {
  records: Record<string, RivalryRecord>;
  activeRivalryId: string | null;
  currentMatchOpponentId: string | null;
  consecutiveWinsThisSession: number;
}

export const INITIAL_RIVALRY_STATE: RivalryState = {
  records: {},
  activeRivalryId: null,
  currentMatchOpponentId: null,
  consecutiveWinsThisSession: 0,
};

// ─── Operations ───────────────────────────────────────────────────────────────

export function registerMatchResult(
  state: RivalryState,
  opponentId: string,
  opponentName: string,
  outcome: 'WIN' | 'LOSS' | 'DRAW',
  matchId: string,
  timestamp: number,
): RivalryState {
  const existing = state.records[opponentId] ?? {
    opponentId,
    opponentDisplayName: opponentName,
    wins: 0, losses: 0, draws: 0,
    consecutiveWins: 0,
    tier: 'NONE' as RivalryTier,
    extractionsLanded: 0,
    counterplaysBeat: 0,
    matchIds: [],
    firstMatchAt: timestamp,
    lastMatchAt: timestamp,
    cardAmplifier: 1.0,
  };

  const wins     = existing.wins     + (outcome === 'WIN'  ? 1 : 0);
  const losses   = existing.losses   + (outcome === 'LOSS' ? 1 : 0);
  const draws    = existing.draws    + (outcome === 'DRAW' ? 1 : 0);
  const consec   = outcome === 'WIN' ? existing.consecutiveWins + 1 : 0;
  const tier     = computeRivalryTier(consec, wins);
  const amplifier = computeCardAmplifier(tier);
  const matchIds = [...existing.matchIds, matchId].slice(-20);

  const updated: RivalryRecord = {
    ...existing, wins, losses, draws,
    consecutiveWins: consec, tier, cardAmplifier: amplifier,
    matchIds, lastMatchAt: timestamp,
  };

  const activeRivalryId = tier !== 'NONE' ? opponentId : state.activeRivalryId;
  const consecutiveWinsThisSession = outcome === 'WIN'
    ? state.consecutiveWinsThisSession + 1
    : 0;

  return {
    ...state,
    records: { ...state.records, [opponentId]: updated },
    activeRivalryId,
    consecutiveWinsThisSession,
  };
}

export function recordExtractionLanded(
  state: RivalryState,
  opponentId: string,
): RivalryState {
  const rec = state.records[opponentId];
  if (!rec) return state;
  return {
    ...state,
    records: {
      ...state.records,
      [opponentId]: { ...rec, extractionsLanded: rec.extractionsLanded + 1 },
    },
  };
}

export function recordCounterplayBeat(
  state: RivalryState,
  opponentId: string,
): RivalryState {
  const rec = state.records[opponentId];
  if (!rec) return state;
  return {
    ...state,
    records: {
      ...state.records,
      [opponentId]: { ...rec, counterplaysBeat: rec.counterplaysBeat + 1 },
    },
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function getRivalryAmplifier(state: RivalryState, opponentId: string): number {
  return state.records[opponentId]?.cardAmplifier ?? 1.0;
}

export function isRivalryActive(state: RivalryState, opponentId: string): boolean {
  const rec = state.records[opponentId];
  return !!rec && rec.tier !== 'NONE';
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeRivalryTier(consecutiveWins: number, totalWins: number): RivalryTier {
  if (consecutiveWins >= 10 || totalWins >= 20) return 'LEGENDARY';
  if (consecutiveWins >= 7  || totalWins >= 12) return 'INTENSE';
  if (consecutiveWins >= 5  || totalWins >= 8)  return 'ACTIVE';
  if (consecutiveWins >= PREDATOR_CONFIG.rivalryWinThreshold) return 'EMERGING';
  return 'NONE';
}

function computeCardAmplifier(tier: RivalryTier): number {
  const map: Record<RivalryTier, number> = {
    NONE: 1.0, EMERGING: 1.08, ACTIVE: 1.15, INTENSE: 1.25, LEGENDARY: 1.35,
  };
  return map[tier];
}
