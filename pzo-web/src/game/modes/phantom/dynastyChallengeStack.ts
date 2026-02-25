// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/dynastyChallengeStack.ts
// Sprint 6 — Dynasty Challenge Stack
//
// The dynasty stack tracks multiple challengers queued against a legend.
// When a legend is beaten, the winner faces the next challenger in queue.
// Dynasty cards only appear when the stack has depth >= 2.
// Stack depth drives dynasty pressure UI and card unlock thresholds.
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

export interface ChallengeEntry {
  challengeId: string;
  challengerUserId: string;
  challengerDisplayName: string;
  targetLegendId: string;
  queuedAtTick: number;
  startedAtTick: number | null;
  completedAtTick: number | null;
  outcome: 'PENDING' | 'IN_PROGRESS' | 'BEATEN' | 'FAILED' | 'WITHDRAWN';
  finalCordScore: number | null;
  finalNetWorth: number | null;
}

export interface DynastyChallengeStack {
  legendId: string;
  entries: ChallengeEntry[];
  activeChallengerId: string | null;
  depth: number;
  dynastyCardsUnlocked: boolean;
  totalChallenges: number;
  totalBeaten: number;
}

export const createDynastyStack = (legendId: string): DynastyChallengeStack => ({
  legendId,
  entries: [],
  activeChallengerId: null,
  depth: 0,
  dynastyCardsUnlocked: false,
  totalChallenges: 0,
  totalBeaten: 0,
});

// ─── Operations ───────────────────────────────────────────────────────────────

export function joinChallengeStack(
  stack: DynastyChallengeStack,
  challengerId: string,
  displayName: string,
  tick: number,
): DynastyChallengeStack {
  if (stack.depth >= PHANTOM_CONFIG.dynastyStackMaxDepth) return stack;

  const entry: ChallengeEntry = {
    challengeId: `ch-${tick}-${challengerId}`,
    challengerUserId: challengerId,
    challengerDisplayName: displayName,
    targetLegendId: stack.legendId,
    queuedAtTick: tick,
    startedAtTick: null,
    completedAtTick: null,
    outcome: 'PENDING',
    finalCordScore: null,
    finalNetWorth: null,
  };

  const newDepth = stack.depth + 1;
  return {
    ...stack,
    entries: [...stack.entries, entry],
    depth: newDepth,
    dynastyCardsUnlocked: newDepth >= 2,
    totalChallenges: stack.totalChallenges + 1,
  };
}

export function startChallenge(
  stack: DynastyChallengeStack,
  challengerId: string,
  tick: number,
): DynastyChallengeStack {
  const entries = stack.entries.map(e =>
    e.challengerUserId === challengerId && e.outcome === 'PENDING'
      ? { ...e, outcome: 'IN_PROGRESS' as const, startedAtTick: tick }
      : e
  );
  return { ...stack, entries, activeChallengerId: challengerId };
}

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
      : e
  );

  const totalBeaten = stack.totalBeaten + (outcome === 'BEATEN' ? 1 : 0);
  const remainingPending = entries.filter(e => e.outcome === 'PENDING').length;
  const nextChallenger = remainingPending > 0
    ? entries.find(e => e.outcome === 'PENDING')?.challengerUserId ?? null
    : null;

  return {
    ...stack,
    entries,
    activeChallengerId: nextChallenger,
    depth: remainingPending,
    dynastyCardsUnlocked: remainingPending >= 2,
    totalBeaten,
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function getQueuePosition(stack: DynastyChallengeStack, userId: string): number {
  const pending = stack.entries.filter(e => e.outcome === 'PENDING');
  const idx = pending.findIndex(e => e.challengerUserId === userId);
  return idx >= 0 ? idx + 1 : -1;
}

export function isDynastyPressureActive(stack: DynastyChallengeStack): boolean {
  return stack.depth >= 2;
}
