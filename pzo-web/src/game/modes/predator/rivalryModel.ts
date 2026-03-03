// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/rivalryModel.ts
// Sprint 7 — Rivalry Persistence System (fully rebuilt)
//
// Rivalry activates after 3+ consecutive wins against the same opponent.
// Rivalry cards get amplified effects in repeated matchups.
// Rivalry history persists to backend for leaderboard and CORD context.
//
// FIXES FROM SPRINT 4:
//   - Match ID dedup guard added (same match can't count twice)
//   - activeRivalryId is cleared when rival tier drops to NONE
//   - matchHistoryTTLTicks enforced (old matches pruned)
//   - spectatorCount per record added
//   - getTopRival() helper added
//   - CORD input: rivalryTierScore() for predatorCordCalculator
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RivalryTier = 'NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY';

export interface RivalryRecord {
  opponentId:          string;
  opponentDisplayName: string;
  wins:                number;
  losses:              number;
  draws:               number;
  consecutiveWins:     number;
  tier:                RivalryTier;
  extractionsLanded:   number;
  counterplaysBeat:    number;
  /** Up to 20 most recent match IDs — deduped */
  matchIds:            string[];
  firstMatchAt:        number;
  lastMatchAt:         number;
  cardAmplifier:       number;
  /** Current live spectator count for this rivalry pair */
  spectatorCount:      number;
}

export interface RivalryState {
  records:                      Record<string, RivalryRecord>;
  activeRivalryId:              string | null;
  currentMatchOpponentId:       string | null;
  consecutiveWinsThisSession:   number;
  /** Server tick of last TTL pruning run */
  lastPrunedAt:                 number;
}

export const INITIAL_RIVALRY_STATE: RivalryState = {
  records:                    {},
  activeRivalryId:            null,
  currentMatchOpponentId:     null,
  consecutiveWinsThisSession: 0,
  lastPrunedAt:               0,
};

// ── Match Result ──────────────────────────────────────────────────────────────

export function registerMatchResult(
  state:        RivalryState,
  opponentId:   string,
  opponentName: string,
  outcome:      'WIN' | 'LOSS' | 'DRAW',
  matchId:      string,
  serverTick:   number,
): RivalryState {
  const existing = state.records[opponentId] ?? buildNewRecord(opponentId, opponentName, serverTick);

  // ── Dedup guard: same match ID never counted twice ────────────────────────
  if (existing.matchIds.includes(matchId)) return state;

  const wins   = existing.wins   + (outcome === 'WIN'  ? 1 : 0);
  const losses = existing.losses + (outcome === 'LOSS' ? 1 : 0);
  const draws  = existing.draws  + (outcome === 'DRAW' ? 1 : 0);
  const consec = outcome === 'WIN' ? existing.consecutiveWins + 1 : 0;
  const tier   = computeRivalryTier(consec, wins);
  const amplifier = computeCardAmplifier(tier);

  // Keep last 20 match IDs, deduped
  const matchIds = [...new Set([...existing.matchIds, matchId])].slice(-20);

  const updated: RivalryRecord = {
    ...existing,
    wins,
    losses,
    draws,
    consecutiveWins: consec,
    tier,
    cardAmplifier:   amplifier,
    matchIds,
    lastMatchAt:     serverTick,
  };

  // ── activeRivalryId management ────────────────────────────────────────────
  // FIXED: Sprint 4 only SET activeRivalryId, never cleared it.
  let activeRivalryId = state.activeRivalryId;
  if (tier !== 'NONE') {
    activeRivalryId = opponentId;
  } else if (activeRivalryId === opponentId) {
    // Rival's tier dropped to NONE — clear the active pointer
    activeRivalryId = null;
  }

  const consecutiveWinsThisSession = outcome === 'WIN'
    ? state.consecutiveWinsThisSession + 1
    : 0;

  return {
    ...state,
    records:                    { ...state.records, [opponentId]: updated },
    activeRivalryId,
    consecutiveWinsThisSession,
  };
}

// ── Record Events ─────────────────────────────────────────────────────────────

export function recordExtractionLanded(
  state:      RivalryState,
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
  state:      RivalryState,
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

export function updateSpectatorCount(
  state:          RivalryState,
  opponentId:     string,
  spectatorCount: number,
): RivalryState {
  const rec = state.records[opponentId];
  if (!rec) return state;
  return {
    ...state,
    records: {
      ...state.records,
      [opponentId]: { ...rec, spectatorCount },
    },
  };
}

// ── TTL Pruning ───────────────────────────────────────────────────────────────

/**
 * Remove stale rivalries whose last match is beyond matchHistoryTTLTicks.
 * Call periodically (e.g., on session start or every 1000 ticks).
 */
export function pruneStaleRivalries(
  state:      RivalryState,
  serverTick: number,
): RivalryState {
  const ttl    = PREDATOR_CONFIG.matchHistoryTTLTicks;
  const pruned: Record<string, RivalryRecord> = {};

  for (const [id, rec] of Object.entries(state.records)) {
    if (serverTick - rec.lastMatchAt < ttl) {
      pruned[id] = rec;
    }
  }

  // Clear activeRivalryId if the active rival was pruned
  const activeRivalryId = state.activeRivalryId && pruned[state.activeRivalryId]
    ? state.activeRivalryId
    : null;

  return { ...state, records: pruned, activeRivalryId, lastPrunedAt: serverTick };
}

// ── Derived ───────────────────────────────────────────────────────────────────

export function getRivalryAmplifier(state: RivalryState, opponentId: string): number {
  return state.records[opponentId]?.cardAmplifier ?? 1.0;
}

export function isRivalryActive(state: RivalryState, opponentId: string): boolean {
  return !!state.records[opponentId] && state.records[opponentId].tier !== 'NONE';
}

/** Opponent with highest tier / most consecutive wins */
export function getTopRival(state: RivalryState): RivalryRecord | null {
  const recs = Object.values(state.records).filter(r => r.tier !== 'NONE');
  if (!recs.length) return null;
  return recs.sort((a, b) => {
    const tierOrder: Record<RivalryTier, number> = {
      LEGENDARY: 0, INTENSE: 1, ACTIVE: 2, EMERGING: 3, NONE: 4,
    };
    const td = tierOrder[a.tier] - tierOrder[b.tier];
    if (td !== 0) return td;
    return b.consecutiveWins - a.consecutiveWins;
  })[0];
}

/**
 * CORD input: rivalry tier score (0.0–1.0).
 * LEGENDARY = 1.0, NONE = 0.0.
 */
export function rivalryTierScore(state: RivalryState): number {
  const topRival = getTopRival(state);
  if (!topRival) return 0;
  const scores: Record<RivalryTier, number> = {
    NONE: 0, EMERGING: 0.25, ACTIVE: 0.50, INTENSE: 0.75, LEGENDARY: 1.0,
  };
  return scores[topRival.tier];
}

/**
 * Rivalry tier badge colors — aligned to designTokens.ts C.*.
 * All verified WCAG AA+ on C.panel (#0D0D1E).
 */
export function rivalryTierColor(tier: RivalryTier): string {
  const colors: Record<RivalryTier, string> = {
    NONE:      '#6A6A90',   // C.textDim
    EMERGING:  '#4A9EFF',   // C.blue
    ACTIVE:    '#C9A84C',   // C.gold
    INTENSE:   '#FF9B2F',   // C.orange
    LEGENDARY: '#FF1744',   // C.crimson
  };
  return colors[tier];
}

// ── Internal ──────────────────────────────────────────────────────────────────

function buildNewRecord(opponentId: string, opponentName: string, serverTick: number): RivalryRecord {
  return {
    opponentId,
    opponentDisplayName: opponentName,
    wins:                0,
    losses:              0,
    draws:               0,
    consecutiveWins:     0,
    tier:                'NONE',
    extractionsLanded:   0,
    counterplaysBeat:    0,
    matchIds:            [],
    firstMatchAt:        serverTick,
    lastMatchAt:         serverTick,
    cardAmplifier:       1.0,
    spectatorCount:      0,
  };
}

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