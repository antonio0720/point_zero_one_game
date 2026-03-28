// backend/src/game/engine/zero/__tests__/TickStepRunner.spec.ts

import { describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../core/EventBus';
import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import type { TickStep } from '../../core/TickSequence';
import { TickStepRunner } from '../TickStepRunner';

function createSnapshot(
  seed: string,
  patch: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: `run-${seed}`,
    userId: 'user-tick-step-runner',
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
  } as RunStateSnapshot;
}

function createContext(step: TickStep) {
  return {
    step,
    nowMs: 42_000,
    clock: {
      now: () => 42_000,
    },
    bus: new EventBus<any>(),
  } as const;
}

function createRunner(overrides: Partial<Record<string, unknown>> = {}) {
  return new (TickStepRunner as any)({
    snapshotBuilder: {
      prepare: vi.fn(({ snapshot }: { snapshot: RunStateSnapshot }) => snapshot),
    },
    time: {
      tick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    pressure: {
      tick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    tension: {
      tick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    battle: {
      tick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    shield: {
      tick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    cascade: {
      tick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    modeRuntimeDirector: {
      reconcileTick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    orchestratorTelemetry: {
      project: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    sovereignty: {
      tick: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    outcomeGate: {
      apply: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    eventSealer: {
      seal: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    },
    ...overrides,
  });
}

describe('TickStepRunner', () => {
  it('routes each core engine execution step to the matching repo-native engine and never cross-calls another engine', () => {
    const base = createSnapshot('tick-step-runner-engine-routing');

    const cases: Array<{
      step: TickStep;
      dependencyKey:
        | 'time'
        | 'pressure'
        | 'tension'
        | 'battle'
        | 'shield'
        | 'cascade';
      tickPatch: Partial<RunStateSnapshot>;
    }> = [
      {
        step: 'STEP_02_TIME',
        dependencyKey: 'time',
        tickPatch: {
          tick: 1,
          timers: {
            ...base.timers,
            elapsedMs: base.timers.currentTickDurationMs,
          },
        },
      },
      {
        step: 'STEP_03_PRESSURE',
        dependencyKey: 'pressure',
        tickPatch: {
          pressure: {
            ...base.pressure,
            score: Number((base.pressure.score + 0.12).toFixed(6)),
            tier: 'T2',
          },
        },
      },
      {
        step: 'STEP_04_TENSION',
        dependencyKey: 'tension',
        tickPatch: {
          tension: {
            ...base.tension,
            score: Number((base.tension.score + 0.18).toFixed(6)),
          },
        },
      },
      {
        step: 'STEP_05_BATTLE',
        dependencyKey: 'battle',
        tickPatch: {
          battle: {
            ...base.battle,
            pendingAttacks: [
              ...base.battle.pendingAttacks,
              {
                attackId: 'attack-001',
                source: 'BOT_01' as const,
                targetEntity: 'SELF' as const,
                targetLayer: 'L2' as const,
                category: 'DRAIN' as const,
                magnitude: 9,
                createdAtTick: 0,
                notes: ['test'],
              },
            ],
          },
        },
      },
      {
        step: 'STEP_06_SHIELD',
        dependencyKey: 'shield',
        tickPatch: {
          shield: {
            ...base.shield,
            weakestLayerId: 'L2',
          },
        },
      },
      {
        step: 'STEP_07_CASCADE',
        dependencyKey: 'cascade',
        tickPatch: {
          cascade: {
            ...base.cascade,
            activeChains: [
              ...base.cascade.activeChains,
              {
                chainId: 'chain-001',
                templateId: 'test-template',
                trigger: 'test',
                positive: false,
                status: 'ACTIVE' as const,
                links: [],
                createdAtTick: base.tick,
                recoveryTags: [],
              },
            ],
          },
        },
      },
    ];

    for (const entry of cases) {
      const nextSnapshot = createSnapshot(
        `tick-step-runner-${entry.dependencyKey}`,
        entry.tickPatch,
      );

      const runner = createRunner({
        [entry.dependencyKey]: {
          tick: vi.fn(
            (
              snapshot: RunStateSnapshot,
              context: ReturnType<typeof createContext>,
            ) => {
              expect(snapshot.runId).toBe(base.runId);
              expect(context.step).toBe(entry.step);
              return nextSnapshot;
            },
          ),
        },
      });

      const result = runner.run({
        step: entry.step,
        snapshot: base,
        context: createContext(entry.step),
      });

      expect(result).toEqual(nextSnapshot);

      const dependencyKeys = [
        'time',
        'pressure',
        'tension',
        'battle',
        'shield',
        'cascade',
      ] as const;

      for (const key of dependencyKeys) {
        const fn = runner[key].tick as ReturnType<typeof vi.fn>;
        expect(fn).toHaveBeenCalledTimes(key === entry.dependencyKey ? 1 : 0);
      }
    }
  });

  it('delegates prepare, mode post, telemetry projection, sovereignty snapshot, outcome gate, and event sealing to their dedicated collaborators', () => {
    const base = createSnapshot('tick-step-runner-system-steps');

    const prepared = createSnapshot('tick-step-runner-prepared', {
      telemetry: {
        ...base.telemetry,
        warnings: ['prepared'],
      },
    });
    const modeReconciled = createSnapshot('tick-step-runner-mode-post', {
      modeState: {
        ...base.modeState,
        handicapIds: [...base.modeState.handicapIds, 'mode-post'],
      },
    });
    const telemetered = createSnapshot('tick-step-runner-telemetry', {
      telemetry: {
        ...base.telemetry,
        forkHints: ['telemetry-projector'],
      },
    });
    const sovereigntySnapshotted = createSnapshot(
      'tick-step-runner-sovereignty',
      {
        sovereignty: {
          ...base.sovereignty,
          lastVerifiedTick: 7,
        },
      },
    );
    const gated = createSnapshot('tick-step-runner-outcome-gate', {
      outcome: 'FREEDOM',
      telemetry: {
        ...base.telemetry,
        outcomeReason: 'economy.freedom_target_reached',
        outcomeReasonCode: 'TARGET_REACHED',
      },
    });
    const sealed = createSnapshot('tick-step-runner-event-seal', {
      telemetry: {
        ...base.telemetry,
        lastTickChecksum: 'sealed-checksum-001',
      },
    });

    const snapshotBuilder = {
      prepare: vi.fn(() => prepared),
    };
    const modeRuntimeDirector = {
      reconcileTick: vi.fn(() => modeReconciled),
    };
    const orchestratorTelemetry = {
      project: vi.fn(() => telemetered),
    };
    const sovereignty = {
      tick: vi.fn(() => sovereigntySnapshotted),
    };
    const outcomeGate = {
      apply: vi.fn(() => gated),
    };
    const eventSealer = {
      seal: vi.fn(() => sealed),
    };

    const runner = createRunner({
      snapshotBuilder,
      modeRuntimeDirector,
      orchestratorTelemetry,
      sovereignty,
      outcomeGate,
      eventSealer,
    });

    expect(
      runner.run({
        step: 'STEP_01_PREPARE',
        snapshot: base,
        context: createContext('STEP_01_PREPARE'),
      }),
    ).toEqual(prepared);

    expect(
      runner.run({
        step: 'STEP_08_MODE_POST',
        snapshot: base,
        context: createContext('STEP_08_MODE_POST'),
      }),
    ).toEqual(modeReconciled);

    expect(
      runner.run({
        step: 'STEP_09_TELEMETRY',
        snapshot: base,
        context: createContext('STEP_09_TELEMETRY'),
      }),
    ).toEqual(telemetered);

    expect(
      runner.run({
        step: 'STEP_10_SOVEREIGNTY_SNAPSHOT',
        snapshot: base,
        context: createContext('STEP_10_SOVEREIGNTY_SNAPSHOT'),
      }),
    ).toEqual(sovereigntySnapshotted);

    expect(
      runner.run({
        step: 'STEP_11_OUTCOME_GATE',
        snapshot: base,
        context: createContext('STEP_11_OUTCOME_GATE'),
      }),
    ).toEqual(gated);

    expect(
      runner.run({
        step: 'STEP_12_EVENT_SEAL',
        snapshot: base,
        context: createContext('STEP_12_EVENT_SEAL'),
      }),
    ).toEqual(sealed);

    expect(snapshotBuilder.prepare).toHaveBeenCalledTimes(1);
    expect(modeRuntimeDirector.reconcileTick).toHaveBeenCalledTimes(1);
    expect(orchestratorTelemetry.project).toHaveBeenCalledTimes(1);
    expect(sovereignty.tick).toHaveBeenCalledTimes(1);
    expect(outcomeGate.apply).toHaveBeenCalledTimes(1);
    expect(eventSealer.seal).toHaveBeenCalledTimes(1);
  });

  it('refuses to own STEP_13_FLUSH because EventFlushCoordinator is the only flush boundary', () => {
    const base = createSnapshot('tick-step-runner-flush-refusal');
    const runner = createRunner();

    expect(() =>
      runner.run({
        step: 'STEP_13_FLUSH',
        snapshot: base,
        context: createContext('STEP_13_FLUSH'),
      }),
    ).toThrow(/STEP_13_FLUSH|EventFlushCoordinator|flush/i);
  });

  it('fails loudly on an unsupported step so orchestration drift cannot go silent', () => {
    const base = createSnapshot('tick-step-runner-unsupported');
    const runner = createRunner();

    expect(() =>
      runner.run({
        step: 'STEP_99_FAKE' as TickStep,
        snapshot: base,
        context: createContext('STEP_02_TIME'),
      }),
    ).toThrow(/Unsupported tick step|STEP_99_FAKE/i);
  });
});