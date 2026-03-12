// backend/src/game/engine/core/__tests__/RuntimeOutcomeResolver.spec.ts

import { describe, expect, it } from 'vitest';

import type { RunStateSnapshot } from '../RunStateSnapshot';
import type { RunFactoryInput } from '../RunStateFactory';

import { RuntimeOutcomeResolver } from '../RuntimeOutcomeResolver';
import { createInitialRunState } from '../RunStateFactory';

type Mutable<T> = {
  -readonly [K in keyof T]: Mutable<T[K]>;
};

function baseRunInput(overrides: Partial<RunFactoryInput> = {}): RunFactoryInput {
  return {
    runId: 'run_runtime_outcome_resolver_spec',
    userId: 'user_runtime_outcome_resolver_spec',
    seed: 'seed_runtime_outcome_resolver_spec',
    mode: 'solo',
    seasonBudgetMs: 12_000,
    currentTickDurationMs: 4_000,
    freedomTarget: 100_000,
    initialCash: 10_000,
    initialDebt: 0,
    ...overrides,
  };
}

function buildSnapshot(
  mutate?: (snapshot: Mutable<RunStateSnapshot>) => void,
): RunStateSnapshot {
  const snapshot = JSON.parse(
    JSON.stringify(createInitialRunState(baseRunInput())),
  ) as Mutable<RunStateSnapshot>;

  if (mutate) {
    mutate(snapshot);
  }

  return snapshot as RunStateSnapshot;
}

describe('RuntimeOutcomeResolver', () => {
  it('gives USER_ABANDON absolute precedence over freedom, bankruptcy, timeout, and warnings', () => {
    const resolver = new RuntimeOutcomeResolver();

    const snapshot = buildSnapshot((draft) => {
      draft.economy.netWorth = draft.economy.freedomTarget + 50_000;
      draft.economy.cash = -1;
      draft.timers.elapsedMs = draft.timers.seasonBudgetMs + draft.timers.extensionBudgetMs;
      draft.tags = [...draft.tags, 'run:user-abandoned'];
      draft.telemetry.warnings = Array.from({ length: 40 }, (_, index) => `warning_${index}`);
    });

    expect(resolver.resolve(snapshot)).toEqual({
      outcome: 'ABANDONED',
      outcomeReason: 'run.user_abandoned',
      outcomeReasonCode: 'USER_ABANDON',
      totalBudgetMs: 12_000,
      remainingBudgetMs: 0,
      isTerminal: true,
    });
  });

  it('gives integrity quarantine precedence over engine abort warnings and freedom when quarantine termination is enabled', () => {
    const resolver = new RuntimeOutcomeResolver();

    const snapshot = buildSnapshot((draft) => {
      draft.economy.netWorth = draft.economy.freedomTarget + 1;
      draft.sovereignty.integrityStatus = 'QUARANTINED';
      draft.sovereignty.auditFlags = ['integrity.quarantined'];
      draft.telemetry.warnings = Array.from({ length: 50 }, (_, index) => `warning_${index}`);
    });

    expect(resolver.resolve(snapshot)).toEqual({
      outcome: 'ABANDONED',
      outcomeReason: 'integrity.quarantined',
      outcomeReasonCode: 'INTEGRITY_QUARANTINE',
      totalBudgetMs: 12_000,
      remainingBudgetMs: 12_000,
      isTerminal: true,
    });
  });

  it('allows quarantined runs to continue when quarantineTerminatesRun is disabled', () => {
    const resolver = new RuntimeOutcomeResolver({
      quarantineTerminatesRun: false,
    });

    const snapshot = buildSnapshot((draft) => {
      draft.sovereignty.integrityStatus = 'QUARANTINED';
      draft.sovereignty.auditFlags = ['integrity.quarantined'];
    });

    expect(resolver.resolve(snapshot)).toEqual({
      outcome: null,
      outcomeReason: null,
      outcomeReasonCode: null,
      totalBudgetMs: 12_000,
      remainingBudgetMs: 12_000,
      isTerminal: false,
    });
  });

  it('resolves ENGINE_ABORT once warning volume reaches the configured threshold', () => {
    const resolver = new RuntimeOutcomeResolver({
      engineAbortWarningsThreshold: 2,
    });

    const snapshot = buildSnapshot((draft) => {
      draft.telemetry.warnings = ['pressure degraded', 'battle degraded'];
    });

    expect(resolver.resolve(snapshot)).toEqual({
      outcome: 'ABANDONED',
      outcomeReason: 'runtime.engine_abort',
      outcomeReasonCode: 'ENGINE_ABORT',
      totalBudgetMs: 12_000,
      remainingBudgetMs: 12_000,
      isTerminal: true,
    });
  });

  it('resolves FREEDOM before BANKRUPT and TIMEOUT when all conditions are true at once', () => {
    const resolver = new RuntimeOutcomeResolver();

    const snapshot = buildSnapshot((draft) => {
      draft.economy.netWorth = draft.economy.freedomTarget;
      draft.economy.cash = -500;
      draft.timers.elapsedMs = draft.timers.seasonBudgetMs + draft.timers.extensionBudgetMs;
    });

    expect(resolver.resolve(snapshot)).toEqual({
      outcome: 'FREEDOM',
      outcomeReason: 'economy.freedom_target_reached',
      outcomeReasonCode: 'TARGET_REACHED',
      totalBudgetMs: 12_000,
      remainingBudgetMs: 0,
      isTerminal: true,
    });
  });

  it('resolves BANKRUPT on negative cash by default', () => {
    const resolver = new RuntimeOutcomeResolver();

    const snapshot = buildSnapshot((draft) => {
      draft.economy.cash = -1;
      draft.economy.netWorth = -1;
    });

    expect(resolver.resolve(snapshot)).toEqual({
      outcome: 'BANKRUPT',
      outcomeReason: 'economy.cash_below_zero',
      outcomeReasonCode: 'NET_WORTH_COLLAPSE',
      totalBudgetMs: 12_000,
      remainingBudgetMs: 12_000,
      isTerminal: true,
    });
  });

  it('does not bankrupt on negative net worth unless that option is explicitly enabled', () => {
    const defaultResolver = new RuntimeOutcomeResolver();
    const strictResolver = new RuntimeOutcomeResolver({
      bankruptOnNegativeCash: false,
      bankruptOnNegativeNetWorth: true,
    });

    const snapshot = buildSnapshot((draft) => {
      draft.economy.cash = 250;
      draft.economy.netWorth = -250;
    });

    expect(defaultResolver.resolve(snapshot)).toEqual({
      outcome: null,
      outcomeReason: null,
      outcomeReasonCode: null,
      totalBudgetMs: 12_000,
      remainingBudgetMs: 12_000,
      isTerminal: false,
    });

    expect(strictResolver.resolve(snapshot)).toEqual({
      outcome: 'BANKRUPT',
      outcomeReason: 'economy.net_worth_below_zero',
      outcomeReasonCode: 'NET_WORTH_COLLAPSE',
      totalBudgetMs: 12_000,
      remainingBudgetMs: 12_000,
      isTerminal: true,
    });
  });

  it('uses seasonBudgetMs + extensionBudgetMs as the authoritative timeout budget', () => {
    const resolver = new RuntimeOutcomeResolver();

    const almostExpired = buildSnapshot((draft) => {
      draft.timers.seasonBudgetMs = 10_000;
      draft.timers.extensionBudgetMs = 2_500;
      draft.timers.elapsedMs = 12_499;
    });

    const expired = buildSnapshot((draft) => {
      draft.timers.seasonBudgetMs = 10_000;
      draft.timers.extensionBudgetMs = 2_500;
      draft.timers.elapsedMs = 12_500;
    });

    expect(resolver.resolve(almostExpired)).toEqual({
      outcome: null,
      outcomeReason: null,
      outcomeReasonCode: null,
      totalBudgetMs: 12_500,
      remainingBudgetMs: 1,
      isTerminal: false,
    });

    expect(resolver.resolve(expired)).toEqual({
      outcome: 'TIMEOUT',
      outcomeReason: 'timer.expired',
      outcomeReasonCode: 'SEASON_BUDGET_EXHAUSTED',
      totalBudgetMs: 12_500,
      remainingBudgetMs: 0,
      isTerminal: true,
    });
  });

  it('apply() returns the same snapshot object when outcome fields are already aligned', () => {
    const resolver = new RuntimeOutcomeResolver();

    const snapshot = buildSnapshot((draft) => {
      draft.economy.netWorth = draft.economy.freedomTarget + 1;
      draft.outcome = 'FREEDOM';
      draft.telemetry.outcomeReason = 'economy.freedom_target_reached';
      draft.telemetry.outcomeReasonCode = 'TARGET_REACHED';
    });

    const applied = resolver.apply(snapshot);

    expect(applied).toBe(snapshot);
  });

  it('apply() returns a frozen clone, updates outcome telemetry, and leaves the original snapshot untouched', () => {
    const resolver = new RuntimeOutcomeResolver();

    const snapshot = buildSnapshot((draft) => {
      draft.economy.cash = -100;
      draft.economy.netWorth = -100;
      draft.outcome = null;
      draft.telemetry.outcomeReason = null;
      draft.telemetry.outcomeReasonCode = null;
    });

    const applied = resolver.apply(snapshot);

    expect(applied).not.toBe(snapshot);
    expect(applied.outcome).toBe('BANKRUPT');
    expect(applied.telemetry.outcomeReason).toBe('economy.cash_below_zero');
    expect(applied.telemetry.outcomeReasonCode).toBe('NET_WORTH_COLLAPSE');

    expect(snapshot.outcome).toBeNull();
    expect(snapshot.telemetry.outcomeReason).toBeNull();
    expect(snapshot.telemetry.outcomeReasonCode).toBeNull();

    expect(Object.isFrozen(applied)).toBe(true);
    expect(Object.isFrozen(applied.telemetry)).toBe(true);
    expect(Object.isFrozen(applied.economy)).toBe(true);
  });
});