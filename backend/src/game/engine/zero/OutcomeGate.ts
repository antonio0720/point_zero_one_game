// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/OutcomeGate.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OutcomeGate.ts
 *
 * Doctrine:
 * - zero owns terminal priority ordering
 * - freedom outranks collapse, which outranks timeout
 * - the gate reads snapshot truth and returns a resolution; it does not mutate engines
 * - additive wrapping is preferred over duplicating backend/core outcome primitives
 */

import type { RunOutcome } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { OutcomeGateResolution } from './zero.types';

function resolveBudgetMs(snapshot: RunStateSnapshot): number {
  return Math.max(
    0,
    snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs,
  );
}

function hasTimedOut(snapshot: RunStateSnapshot): boolean {
  const budgetMs = resolveBudgetMs(snapshot);

  if (budgetMs <= 0) {
    return true;
  }

  return snapshot.timers.elapsedMs >= budgetMs;
}

function hasReachedFreedom(snapshot: RunStateSnapshot): boolean {
  return snapshot.economy.netWorth >= snapshot.economy.freedomTarget;
}

function hasCollapsed(snapshot: RunStateSnapshot): boolean {
  return (
    snapshot.economy.netWorth <= 0 ||
    (snapshot.economy.cash < 0 &&
      snapshot.economy.incomePerTick <= snapshot.economy.expensesPerTick)
  );
}

export class OutcomeGate {
  public resolve(snapshot: RunStateSnapshot): OutcomeGateResolution {
    if (snapshot.outcome !== null) {
      return Object.freeze({
        nextOutcome: snapshot.outcome,
        reason: 'UNCHANGED',
      });
    }

    if (hasReachedFreedom(snapshot)) {
      return Object.freeze({
        nextOutcome: 'FREEDOM',
        reason: 'TARGET_REACHED',
      });
    }

    if (hasCollapsed(snapshot)) {
      return Object.freeze({
        nextOutcome: 'BANKRUPT',
        reason: 'NET_WORTH_COLLAPSE',
      });
    }

    if (hasTimedOut(snapshot)) {
      return Object.freeze({
        nextOutcome: 'TIMEOUT',
        reason: 'SEASON_TIMEOUT',
      });
    }

    return Object.freeze({
      nextOutcome: null,
      reason: 'UNCHANGED',
    });
  }

  public isTerminal(snapshot: RunStateSnapshot): boolean {
    return this.resolve(snapshot).nextOutcome !== null;
  }

  public chooseHigherPriority(
    left: RunOutcome | null,
    right: RunOutcome | null,
  ): RunOutcome | null {
    const ranking: Readonly<Record<RunOutcome, number>> = Object.freeze({
      FREEDOM: 4,
      BANKRUPT: 3,
      TIMEOUT: 2,
      ABANDONED: 1,
    });

    if (left === null) {
      return right;
    }

    if (right === null) {
      return left;
    }

    return ranking[left] >= ranking[right] ? left : right;
  }
}