// backend/src/game/engine/zero/__tests__/OutcomeGate.spec.ts

import { describe, expect, it } from 'vitest';

import { RuntimeOutcomeResolver } from '../../core/RuntimeOutcomeResolver';
import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { OutcomeGate } from '../OutcomeGate';

function createSnapshot(
  seed: string,
  patch: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: `run-${seed}`,
    userId: 'user-outcome-gate',
    seed,
    mode: 'solo',
  });

  return {
    ...base,
    ...patch,
    economy: patch.economy ? { ...base.economy, ...patch.economy } : base.economy,
    pressure: patch.pressure ? { ...base.pressure, ...patch.pressure } : base.pressure,
    tension: patch.tension ? { ...base.tension, ...patch.tension } : base.tension,
    shield: patch.shield ? { ...base.shield, ...patch.shield } : base.shield,
    battle: patch.battle ? { ...base.battle, ...patch.battle } : base.battle,
    cascade: patch.cascade ? { ...base.cascade, ...patch.cascade } : base.cascade,
    sovereignty: patch.sovereignty
      ? { ...base.sovereignty, ...patch.sovereignty }
      : base.sovereignty,
    cards: patch.cards ? { ...base.cards, ...patch.cards } : base.cards,
    modeState: patch.modeState
      ? { ...base.modeState, ...patch.modeState }
      : base.modeState,
    timers: patch.timers ? { ...base.timers, ...patch.timers } : base.timers,
    telemetry: patch.telemetry
      ? { ...base.telemetry, ...patch.telemetry }
      : base.telemetry,
    tags: patch.tags ? [...patch.tags] : [...base.tags],
  } as RunStateSnapshot;
}

describe('OutcomeGate', () => {
  it('is a no-op when the snapshot is already terminal with matching reason metadata', () => {
    const gate = new (OutcomeGate as any)({
      resolver: new RuntimeOutcomeResolver(),
    });

    const terminal = createSnapshot('outcome-gate-terminal', {
      outcome: 'ABANDONED',
      telemetry: {
        ...createSnapshot('outcome-gate-terminal-base').telemetry,
        outcomeReason: 'run.user_abandoned',
        outcomeReasonCode: 'USER_ABANDON',
      },
      tags: ['run:user-abandoned'],
    });

    const result = gate.apply(terminal);

    expect(result).toBe(terminal);
    expect(result.outcome).toBe('ABANDONED');
  });

  it('applies FREEDOM before bankruptcy when both are simultaneously true', () => {
    const gate = new (OutcomeGate as any)({
      resolver: new RuntimeOutcomeResolver(),
    });

    const snapshot = createSnapshot('outcome-gate-freedom-priority', {
      economy: {
        ...createSnapshot('outcome-gate-freedom-priority-base').economy,
        netWorth: 5_000_000,
        freedomTarget: 4_000_000,
        cash: -25,
      },
    });

    const result = gate.apply(snapshot);

    expect(result).not.toBe(snapshot);
    expect(result.outcome).toBe('FREEDOM');
    expect(result.telemetry.outcomeReason).toBe('economy.freedom_target_reached');
    expect(result.telemetry.outcomeReasonCode).toBe('TARGET_REACHED');
  });

  it('applies ABANDONED for integrity quarantine before freedom, bankruptcy, or timeout', () => {
    const gate = new (OutcomeGate as any)({
      resolver: new RuntimeOutcomeResolver(),
    });

    const snapshot = createSnapshot('outcome-gate-quarantine', {
      economy: {
        ...createSnapshot('outcome-gate-quarantine-base').economy,
        netWorth: 10_000_000,
        freedomTarget: 1_000_000,
      },
      sovereignty: {
        ...createSnapshot('outcome-gate-quarantine-base').sovereignty,
        integrityStatus: 'QUARANTINED',
        auditFlags: ['integrity.quarantined'],
      },
    });

    const result = gate.apply(snapshot);

    expect(result.outcome).toBe('ABANDONED');
    expect(result.telemetry.outcomeReason).toBe('integrity.quarantined');
    expect(result.telemetry.outcomeReasonCode).toBe('INTEGRITY_QUARANTINE');
  });

  it('applies ABANDONED for engine-abort telemetry when warnings cross the configured threshold', () => {
    const gate = new (OutcomeGate as any)({
      resolver: new RuntimeOutcomeResolver({
        engineAbortWarningsThreshold: 3,
      }),
    });

    const snapshot = createSnapshot('outcome-gate-engine-abort', {
      telemetry: {
        ...createSnapshot('outcome-gate-engine-abort-base').telemetry,
        warnings: ['w-1', 'w-2', 'w-3'],
      },
    });

    const result = gate.apply(snapshot);

    expect(result.outcome).toBe('ABANDONED');
    expect(result.telemetry.outcomeReason).toBe('runtime.engine_abort');
    expect(result.telemetry.outcomeReasonCode).toBe('ENGINE_ABORT');
  });

  it('applies TIMEOUT when elapsed time exhausts season plus extension budget', () => {
    const gate = new (OutcomeGate as any)({
      resolver: new RuntimeOutcomeResolver(),
    });

    const base = createSnapshot('outcome-gate-timeout-base');

    const snapshot = createSnapshot('outcome-gate-timeout', {
      timers: {
        ...base.timers,
        elapsedMs: base.timers.seasonBudgetMs + base.timers.extensionBudgetMs,
      },
    });

    const result = gate.apply(snapshot);

    expect(result.outcome).toBe('TIMEOUT');
    expect(result.telemetry.outcomeReason).toBe('timer.expired');
    expect(result.telemetry.outcomeReasonCode).toBe('SEASON_BUDGET_EXHAUSTED');
  });

  it('returns the same snapshot reference when no terminal condition is met', () => {
    const gate = new (OutcomeGate as any)({
      resolver: new RuntimeOutcomeResolver(),
    });

    const snapshot = createSnapshot('outcome-gate-nonterminal');
    const result = gate.apply(snapshot);

    expect(result).toBe(snapshot);
    expect(result.outcome).toBeNull();
    expect(result.telemetry.outcomeReason).toBeNull();
    expect(result.telemetry.outcomeReasonCode).toBeNull();
  });
});