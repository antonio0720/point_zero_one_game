//backend/src/jobs/streak_reconciliation_job.ts

export type StreakWindow = 'DAILY' | 'WEEKLY';
export type StreakStatus = 'ACTIVE' | 'FROZEN' | 'BROKEN';

export interface StreakActivityEvent {
  readonly userId: string;
  readonly occurredAtMs: number;
  readonly type: string;
  readonly points?: number;
}

export interface StreakSnapshot {
  readonly userId: string;
  readonly window: StreakWindow;
  readonly streakCount: number;
  readonly bestStreak: number;
  readonly totalQualifiedPeriods: number;
  readonly lastQualifiedPeriodKey: string | null;
  readonly lastQualifiedAtMs: number | null;
  readonly freezeTokensRemaining: number;
  readonly status: StreakStatus;
}

export interface StreakPolicy {
  readonly qualifyingEventTypes: readonly string[];
  readonly window: StreakWindow;
  readonly freezeTokenMax: number;
  readonly allowAutoFreeze: boolean;
  readonly minimumPointsPerPeriod: number;
}

export interface StreakReconciliationResult {
  readonly snapshot: StreakSnapshot;
  readonly periodsTouched: readonly string[];
  readonly advanced: boolean;
  readonly frozen: boolean;
  readonly broken: boolean;
}

function utcDayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function utcWeekKey(epochMs: number): string {
  const date = new Date(epochMs);
  const day = date.getUTCDay() || 7;
  const adjusted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  adjusted.setUTCDate(adjusted.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(adjusted.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((adjusted.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${adjusted.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function toPeriodKey(window: StreakWindow, epochMs: number): string {
  return window === 'DAILY' ? utcDayKey(epochMs) : utcWeekKey(epochMs);
}

function comparePeriodKeys(window: StreakWindow, lhs: string, rhs: string): number {
  if (window === 'DAILY') {
    return lhs.localeCompare(rhs);
  }

  const [lhsYear, lhsWeek] = lhs.split('-W');
  const [rhsYear, rhsWeek] = rhs.split('-W');
  const yearDelta = Number(lhsYear) - Number(rhsYear);
  if (yearDelta !== 0) {
    return yearDelta;
  }
  return Number(lhsWeek) - Number(rhsWeek);
}

function nextPeriodKey(window: StreakWindow, current: string): string {
  if (window === 'DAILY') {
    const date = new Date(`${current}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return utcDayKey(date.getTime());
  }

  const [yearPart, weekPart] = current.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);

  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - day + 1);
  monday.setUTCDate(monday.getUTCDate() + week * 7);

  return utcWeekKey(monday.getTime());
}

function collectQualifiedPeriods(
  events: readonly StreakActivityEvent[],
  policy: StreakPolicy,
): Map<string, number> {
  const qualifyingTypes = new Set(policy.qualifyingEventTypes);
  const periods = new Map<string, number>();

  for (const event of events) {
    if (!qualifyingTypes.has(event.type)) {
      continue;
    }

    const periodKey = toPeriodKey(policy.window, event.occurredAtMs);
    periods.set(periodKey, (periods.get(periodKey) ?? 0) + (event.points ?? 1));
  }

  for (const [periodKey, points] of [...periods.entries()]) {
    if (points < policy.minimumPointsPerPeriod) {
      periods.delete(periodKey);
    }
  }

  return periods;
}

function reconcileSnapshot(
  snapshot: StreakSnapshot,
  events: readonly StreakActivityEvent[],
  nowMs: number,
  policy: StreakPolicy,
): StreakReconciliationResult {
  const periods = collectQualifiedPeriods(events, policy);
  const orderedPeriods = [...periods.keys()].sort((lhs, rhs) =>
    comparePeriodKeys(policy.window, lhs, rhs),
  );

  let streakCount = 0;
  let bestStreak = snapshot.bestStreak;
  let totalQualifiedPeriods = 0;
  let lastQualifiedPeriodKey: string | null = null;
  let lastQualifiedAtMs: number | null = null;
  let freezeTokensRemaining = snapshot.freezeTokensRemaining;
  let status: StreakStatus = 'BROKEN';
  let frozen = false;
  let broken = false;

  if (orderedPeriods.length > 0) {
    streakCount = 1;
    bestStreak = Math.max(bestStreak, 1);
    totalQualifiedPeriods = 1;
    lastQualifiedPeriodKey = orderedPeriods[0]!;
    status = 'ACTIVE';

    for (let index = 1; index < orderedPeriods.length; index += 1) {
      const current = orderedPeriods[index]!;
      const expected = nextPeriodKey(policy.window, orderedPeriods[index - 1]!);

      if (current === expected) {
        streakCount += 1;
        totalQualifiedPeriods += 1;
        lastQualifiedPeriodKey = current;
        continue;
      }

      if (
        policy.allowAutoFreeze &&
        freezeTokensRemaining > 0 &&
        current === nextPeriodKey(policy.window, expected)
      ) {
        freezeTokensRemaining -= 1;
        frozen = true;
        streakCount += 1;
        totalQualifiedPeriods += 1;
        lastQualifiedPeriodKey = current;
        continue;
      }

      streakCount = 1;
      totalQualifiedPeriods += 1;
      lastQualifiedPeriodKey = current;
      broken = true;
    }

    bestStreak = Math.max(bestStreak, streakCount);

    const newestEvent = [...events]
      .filter((event) => toPeriodKey(policy.window, event.occurredAtMs) === lastQualifiedPeriodKey)
      .sort((lhs, rhs) => rhs.occurredAtMs - lhs.occurredAtMs)[0];

    lastQualifiedAtMs = newestEvent?.occurredAtMs ?? nowMs;
  }

  const currentPeriod = toPeriodKey(policy.window, nowMs);
  if (lastQualifiedPeriodKey && comparePeriodKeys(policy.window, currentPeriod, lastQualifiedPeriodKey) > 0) {
    const expected = nextPeriodKey(policy.window, lastQualifiedPeriodKey);
    if (currentPeriod !== expected) {
      if (policy.allowAutoFreeze && freezeTokensRemaining > 0) {
        freezeTokensRemaining -= 1;
        status = 'FROZEN';
        frozen = true;
      } else {
        status = 'BROKEN';
        broken = true;
      }
    }
  }

  if (orderedPeriods.length > 0 && status !== 'FROZEN') {
    status = 'ACTIVE';
  }

  const nextSnapshot: StreakSnapshot = {
    userId: snapshot.userId,
    window: snapshot.window,
    streakCount,
    bestStreak,
    totalQualifiedPeriods,
    lastQualifiedPeriodKey,
    lastQualifiedAtMs,
    freezeTokensRemaining,
    status,
  };

  return {
    snapshot: nextSnapshot,
    periodsTouched: orderedPeriods,
    advanced: nextSnapshot.streakCount > snapshot.streakCount,
    frozen,
    broken,
  };
}

export class StreakReconciliationJob {
  private readonly policy: StreakPolicy;

  public constructor(policy: StreakPolicy) {
    this.policy = policy;
  }

  public reconcile(
    snapshots: readonly StreakSnapshot[],
    events: readonly StreakActivityEvent[],
    nowMs = Date.now(),
  ): readonly StreakReconciliationResult[] {
    const eventsByUser = new Map<string, StreakActivityEvent[]>();

    for (const event of events) {
      const bucket = eventsByUser.get(event.userId) ?? [];
      bucket.push(event);
      eventsByUser.set(event.userId, bucket);
    }

    return snapshots.map((snapshot) =>
      reconcileSnapshot(
        snapshot,
        (eventsByUser.get(snapshot.userId) ?? []).sort(
          (lhs, rhs) => lhs.occurredAtMs - rhs.occurredAtMs,
        ),
        nowMs,
        this.policy,
      ),
    );
  }
}

export function createDefaultDailyStreakPolicy(): StreakPolicy {
  return {
    qualifyingEventTypes: ['RUN_COMPLETED', 'DAILY_CHALLENGE_COMPLETED', 'VERIFIED_RUN'],
    window: 'DAILY',
    freezeTokenMax: 3,
    allowAutoFreeze: true,
    minimumPointsPerPeriod: 1,
  };
}