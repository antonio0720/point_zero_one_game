// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/dynastyChallengeStack.ts
// Sprint 7 — Dynasty Challenge Stack (fully rebuilt)
//
// The dynasty stack tracks multiple challengers queued against a legend.
// When a legend is beaten, the winner faces the next challenger in queue.
// Dynasty cards only appear when the stack has depth >= 2.
//
// FIXES FROM SPRINT 6:
//   - Challenge expiry timeout added (dynastyChallengeTimeoutTicks)
//   - Duplicate guard before joinChallengeStack
//   - Spectator count per entry (for heat display)
//   - pruneExpiredChallenges() for GC
//   - isUserAlreadyQueued() helper
//   - withdrawChallenge() added for user-initiated exit
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChallengeOutcome =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'BEATEN'
  | 'FAILED'
  | 'WITHDRAWN'
  | 'EXPIRED';

export interface ChallengeEntry {
  challengeId:             string;
  challengerUserId:        string;
  challengerDisplayName:   string;
  targetLegendId:          string;
  queuedAtTick:            number;
  /** Tick at which this entry expires if not started. */
  expiresAtTick:           number;
  startedAtTick:           number | null;
  completedAtTick:         number | null;
  outcome:                 ChallengeOutcome;
  finalCordScore:          number | null;
  finalNetWorth:           number | null;
  /** Live spectator count (updated periodically by community heat engine). */
  spectatorCount:          number;
}

export interface DynastyChallengeStack {
  legendId:             string;
  entries:              ChallengeEntry[];
  activeChallengerId:   string | null;
  /** Count of PENDING entries (active depth). */
  depth:                number;
  dynastyCardsUnlocked: boolean;
  totalChallenges:      number;
  totalBeaten:          number;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createDynastyStack(legendId: string): DynastyChallengeStack {
  return {
    legendId,
    entries:              [],
    activeChallengerId:   null,
    depth:                0,
    dynastyCardsUnlocked: false,
    totalChallenges:      0,
    totalBeaten:          0,
  };
}

// ─── Join ─────────────────────────────────────────────────────────────────────

export function joinChallengeStack(
  stack: DynastyChallengeStack,
  challengerId: string,
  displayName: string,
  tick: number,
): DynastyChallengeStack {
  // Hard cap
  if (stack.depth >= PHANTOM_CONFIG.dynastyStackMaxDepth) return stack;

  // Duplicate guard — user can only be queued once per legend
  if (isUserAlreadyQueued(stack, challengerId)) return stack;

  const entry: ChallengeEntry = {
    challengeId:           `ch-${tick}-${challengerId}`,
    challengerUserId:      challengerId,
    challengerDisplayName: displayName,
    targetLegendId:        stack.legendId,
    queuedAtTick:          tick,
    expiresAtTick:         tick + PHANTOM_CONFIG.dynastyChallengeTimeoutTicks,
    startedAtTick:         null,
    completedAtTick:       null,
    outcome:               'PENDING',
    finalCordScore:        null,
    finalNetWorth:         null,
    spectatorCount:        0,
  };

  const newDepth = stack.depth + 1;
  return {
    ...stack,
    entries:              [...stack.entries, entry],
    depth:                newDepth,
    dynastyCardsUnlocked: newDepth >= 2,
    totalChallenges:      stack.totalChallenges + 1,
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────

export function startChallenge(
  stack: DynastyChallengeStack,
  challengerId: string,
  tick: number,
): DynastyChallengeStack {
  const entries = stack.entries.map(e =>
    e.challengerUserId === challengerId && e.outcome === 'PENDING'
      ? { ...e, outcome: 'IN_PROGRESS' as const, startedAtTick: tick }
      : e,
  );
  return { ...stack, entries, activeChallengerId: challengerId };
}

// ─── Resolve ──────────────────────────────────────────────────────────────────

export function resolveChallenge(
  stack: DynastyChallengeStack,
  challengerId: string,
  outcome: 'BEATEN' | 'FAILED',
  finalCordScore: number,
  finalNetWorth: number,
  tick: number,
): DynastyChallengeStack {
  const entries = stack.entries.map(e =>
    e.challengerUserId === challengerId && e.outcome === 'IN_PROGRESS'
      ? { ...e, outcome, completedAtTick: tick, finalCordScore, finalNetWorth }
      : e,
  );

  const totalBeaten       = stack.totalBeaten + (outcome === 'BEATEN' ? 1 : 0);
  const remainingPending  = entries.filter(e => e.outcome === 'PENDING');
  const nextChallengerId  = remainingPending[0]?.challengerUserId ?? null;

  return {
    ...stack,
    entries,
    activeChallengerId:   nextChallengerId,
    depth:                remainingPending.length,
    dynastyCardsUnlocked: remainingPending.length >= 2,
    totalBeaten,
  };
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

export function withdrawChallenge(
  stack: DynastyChallengeStack,
  challengerId: string,
): DynastyChallengeStack {
  const entries = stack.entries.map(e =>
    e.challengerUserId === challengerId &&
    (e.outcome === 'PENDING' || e.outcome === 'IN_PROGRESS')
      ? { ...e, outcome: 'WITHDRAWN' as const }
      : e,
  );

  const remainingPending = entries.filter(e => e.outcome === 'PENDING');
  const activeId = stack.activeChallengerId === challengerId
    ? (remainingPending[0]?.challengerUserId ?? null)
    : stack.activeChallengerId;

  return {
    ...stack,
    entries,
    activeChallengerId:   activeId,
    depth:                remainingPending.length,
    dynastyCardsUnlocked: remainingPending.length >= 2,
  };
}

// ─── Expiry / GC ─────────────────────────────────────────────────────────────

/**
 * Mark PENDING entries whose expiresAtTick has passed as EXPIRED.
 * Call once per tick or every N ticks (cheap: filters only PENDING set).
 */
export function pruneExpiredChallenges(
  stack: DynastyChallengeStack,
  currentTick: number,
): DynastyChallengeStack {
  let changed = false;
  const entries = stack.entries.map(e => {
    if (e.outcome === 'PENDING' && currentTick >= e.expiresAtTick) {
      changed = true;
      return { ...e, outcome: 'EXPIRED' as const };
    }
    return e;
  });

  if (!changed) return stack;

  const remainingPending = entries.filter(e => e.outcome === 'PENDING');
  return {
    ...stack,
    entries,
    depth:                remainingPending.length,
    dynastyCardsUnlocked: remainingPending.length >= 2,
  };
}

// ─── Spectators ───────────────────────────────────────────────────────────────

export function updateSpectatorCount(
  stack: DynastyChallengeStack,
  challengeId: string,
  spectatorCount: number,
): DynastyChallengeStack {
  const entries = stack.entries.map(e =>
    e.challengeId === challengeId ? { ...e, spectatorCount } : e,
  );
  return { ...stack, entries };
}

// ─── Queries / Derived ────────────────────────────────────────────────────────

export function getQueuePosition(stack: DynastyChallengeStack, userId: string): number {
  const pending = stack.entries.filter(e => e.outcome === 'PENDING');
  const idx = pending.findIndex(e => e.challengerUserId === userId);
  return idx >= 0 ? idx + 1 : -1;
}

export function isDynastyPressureActive(stack: DynastyChallengeStack): boolean {
  return stack.depth >= 2;
}

export function isUserAlreadyQueued(stack: DynastyChallengeStack, userId: string): boolean {
  return stack.entries.some(
    e => e.challengerUserId === userId &&
         (e.outcome === 'PENDING' || e.outcome === 'IN_PROGRESS'),
  );
}

export function getTotalSpectators(stack: DynastyChallengeStack): number {
  return stack.entries
    .filter(e => e.outcome === 'IN_PROGRESS' || e.outcome === 'PENDING')
    .reduce((sum, e) => sum + e.spectatorCount, 0);
}

export function getActiveEntry(stack: DynastyChallengeStack): ChallengeEntry | null {
  return stack.entries.find(e => e.outcome === 'IN_PROGRESS') ?? null;
}
