/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RuntimeOutcomeResolver.ts
 *
 * Doctrine:
 * - terminal outcome resolution belongs to the backend authority surface
 * - outcomes must be deterministic, explicit, and telemetry-addressable
 * - reason codes are as important as the terminal state itself
 * - applying an outcome must never mutate the caller's snapshot
 */

import type { RunStateSnapshot } from './RunStateSnapshot';
import { cloneJson, deepFreeze } from './Deterministic';

export interface RuntimeOutcomeResolverOptions {
  readonly bankruptOnNegativeCash?: boolean;
  readonly bankruptOnNegativeNetWorth?: boolean;
  readonly quarantineTerminatesRun?: boolean;
  readonly engineAbortWarningsThreshold?: number;
}

export interface RuntimeOutcomeDecision {
  readonly outcome: RunStateSnapshot['outcome'];
  readonly outcomeReason: string | null;
  readonly outcomeReasonCode: RunStateSnapshot['telemetry']['outcomeReasonCode'];
  readonly totalBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly isTerminal: boolean;
}

const DEFAULT_OPTIONS: Required<RuntimeOutcomeResolverOptions> = {
  bankruptOnNegativeCash: true,
  bankruptOnNegativeNetWorth: false,
  quarantineTerminatesRun: true,
  engineAbortWarningsThreshold: 25,
};

function totalBudgetMs(snapshot: RunStateSnapshot): number {
  return snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
}

function hasUserAbandonSignal(snapshot: RunStateSnapshot): boolean {
  return (
    snapshot.outcome === 'ABANDONED' ||
    snapshot.telemetry.outcomeReasonCode === 'USER_ABANDON' ||
    snapshot.telemetry.outcomeReason === 'run.user_abandoned' ||
    snapshot.tags.includes('run:user-abandoned')
  );
}

function hasIntegrityQuarantine(snapshot: RunStateSnapshot): boolean {
  return (
    snapshot.sovereignty.integrityStatus === 'QUARANTINED' ||
    snapshot.telemetry.outcomeReasonCode === 'INTEGRITY_QUARANTINE' ||
    snapshot.telemetry.outcomeReason === 'integrity.quarantined' ||
    snapshot.sovereignty.auditFlags.some((flag) => flag === 'integrity.quarantined')
  );
}

function hasEngineAbortSignal(
  snapshot: RunStateSnapshot,
  threshold: number,
): boolean {
  return (
    snapshot.telemetry.outcomeReasonCode === 'ENGINE_ABORT' ||
    snapshot.telemetry.outcomeReason === 'runtime.engine_abort' ||
    snapshot.tags.includes('run:engine-abort') ||
    snapshot.telemetry.warnings.length >= threshold
  );
}

export class RuntimeOutcomeResolver {
  private readonly options: Required<RuntimeOutcomeResolverOptions>;

  public constructor(options: RuntimeOutcomeResolverOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  public resolve(snapshot: RunStateSnapshot): RuntimeOutcomeDecision {
    const totalBudget = totalBudgetMs(snapshot);
    const remainingBudget = Math.max(0, totalBudget - snapshot.timers.elapsedMs);

    if (hasUserAbandonSignal(snapshot)) {
      return {
        outcome: 'ABANDONED',
        outcomeReason: 'run.user_abandoned',
        outcomeReasonCode: 'USER_ABANDON',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (this.options.quarantineTerminatesRun && hasIntegrityQuarantine(snapshot)) {
      return {
        outcome: 'ABANDONED',
        outcomeReason: 'integrity.quarantined',
        outcomeReasonCode: 'INTEGRITY_QUARANTINE',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (hasEngineAbortSignal(snapshot, this.options.engineAbortWarningsThreshold)) {
      return {
        outcome: 'ABANDONED',
        outcomeReason: 'runtime.engine_abort',
        outcomeReasonCode: 'ENGINE_ABORT',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (snapshot.economy.netWorth >= snapshot.economy.freedomTarget) {
      return {
        outcome: 'FREEDOM',
        outcomeReason: 'economy.freedom_target_reached',
        outcomeReasonCode: 'TARGET_REACHED',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    const negativeCash = this.options.bankruptOnNegativeCash && snapshot.economy.cash < 0;
    const negativeNetWorth =
      this.options.bankruptOnNegativeNetWorth && snapshot.economy.netWorth < 0;

    if (negativeCash || negativeNetWorth) {
      return {
        outcome: 'BANKRUPT',
        outcomeReason: negativeCash
          ? 'economy.cash_below_zero'
          : 'economy.net_worth_below_zero',
        outcomeReasonCode: 'NET_WORTH_COLLAPSE',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (snapshot.timers.elapsedMs >= totalBudget) {
      return {
        outcome: 'TIMEOUT',
        outcomeReason: 'timer.expired',
        outcomeReasonCode: 'SEASON_BUDGET_EXHAUSTED',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: 0,
        isTerminal: true,
      };
    }

    return {
      outcome: null,
      outcomeReason: null,
      outcomeReasonCode: null,
      totalBudgetMs: totalBudget,
      remainingBudgetMs: remainingBudget,
      isTerminal: false,
    };
  }

  public apply(snapshot: RunStateSnapshot): RunStateSnapshot {
    const decision = this.resolve(snapshot);

    if (
      snapshot.outcome === decision.outcome &&
      snapshot.telemetry.outcomeReason === decision.outcomeReason &&
      snapshot.telemetry.outcomeReasonCode === decision.outcomeReasonCode
    ) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as RunStateSnapshot & {
      -readonly [K in keyof RunStateSnapshot]: RunStateSnapshot[K];
    };
    (next as { outcome: RunStateSnapshot['outcome'] }).outcome = decision.outcome;
    (next.telemetry as { outcomeReason: RunStateSnapshot['telemetry']['outcomeReason'] }).outcomeReason = decision.outcomeReason;
    (next.telemetry as { outcomeReasonCode: RunStateSnapshot['telemetry']['outcomeReasonCode'] }).outcomeReasonCode = decision.outcomeReasonCode;
    return deepFreeze(next) as RunStateSnapshot;
  }
}
