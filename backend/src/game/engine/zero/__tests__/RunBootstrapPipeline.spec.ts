// backend/src/game/engine/zero/__tests__/RunBootstrapPipeline.spec.ts

import { describe, expect, it, vi } from 'vitest';

import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { RunBootstrapPipeline } from '../RunBootstrapPipeline';

function cloneSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as RunStateSnapshot;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);

    for (const entry of Object.values(value as Record<string, unknown>)) {
      if (entry !== null && typeof entry === 'object' && !Object.isFrozen(entry)) {
        deepFreeze(entry);
      }
    }
  }

  return value;
}

describe('RunBootstrapPipeline', () => {
  it('builds the authoritative initial snapshot from the backend core factory, applies mode bootstrap then cards bootstrap, resets runtime surfaces, and emits run.started', () => {
    const callOrder: string[] = [];

    const registry = {
      reset: vi.fn(() => {
        callOrder.push('registry.reset');
      }),
    };

    const bus = {
      clear: vi.fn(() => {
        callOrder.push('bus.clear');
      }),
      emit: vi.fn(() => {
        callOrder.push('bus.emit');
      }),
    };

    const idFactory = {
      createSeed: vi.fn(() => {
        callOrder.push('idFactory.createSeed');
        return 'seed-solo-001';
      }),
      createRunId: vi.fn((seed: string) => {
        callOrder.push('idFactory.createRunId');
        return `run:${seed}`;
      }),
    };

    const runStateFactory = {
      createInitialRunState: vi.fn((input: Parameters<typeof createInitialRunState>[0]) => {
        callOrder.push('runStateFactory.createInitialRunState');
        return createInitialRunState(input);
      }),
    };

    const modeBootstrapper = {
      bootstrap: vi.fn((snapshot: RunStateSnapshot) => {
        callOrder.push('modeBootstrapper.bootstrap');
        const next = cloneSnapshot(snapshot);
        next.tags = [...next.tags, 'mode:bootstrap-applied'];
        next.modeState.communityHeatModifier = 12;
        next.modeState.phaseBoundaryWindowsRemaining = 4;
        return deepFreeze(next);
      }),
    };

    const cardsBootstrapper = {
      bootstrap: vi.fn((snapshot: RunStateSnapshot) => {
        callOrder.push('cardsBootstrapper.bootstrap');
        const next = cloneSnapshot(snapshot);
        next.cards.hand = [
          {
            instanceId: 'card-inst-001',
            definitionId: 'STARTER_LIQUIDITY_WALL',
            deckType: 'STARTER',
            timingClass: 'DEFENSIVE',
            targeting: 'SELF',
            stackCount: 1,
            exhaustOnPlay: false,
            ephemeral: false,
            decisionTimerOverrideMs: null,
            metadata: {},
          },
        ];
        next.cards.drawPileSize = 23;
        next.cards.deckEntropy = 0.41;
        return deepFreeze(next);
      }),
    };

    const freeze = vi.fn((snapshot: RunStateSnapshot) => {
      callOrder.push('freeze');
      return deepFreeze(cloneSnapshot(snapshot));
    });

    const pipeline = new (RunBootstrapPipeline as any)({
      registry,
      bus,
      idFactory,
      runStateFactory,
      modeBootstrapper,
      cardsBootstrapper,
      freeze,
    });

    const result = pipeline.bootstrap({
      userId: 'user-bootstrap-001',
      mode: 'predator',
      communityHeatModifier: 12,
      disabledBots: ['BOT_04'],
      tags: ['suite:bootstrap'],
    }) as RunStateSnapshot;

    expect(idFactory.createSeed).toHaveBeenCalledWith(
      'user-bootstrap-001',
      'predator',
      expect.any(Number),
    );
    expect(idFactory.createRunId).toHaveBeenCalledWith('seed-solo-001');

    expect(runStateFactory.createInitialRunState).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run:seed-solo-001',
        userId: 'user-bootstrap-001',
        seed: 'seed-solo-001',
        mode: 'predator',
        disabledBots: ['BOT_04'],
        tags: ['suite:bootstrap'],
        communityHeatModifier: 12,
      }),
    );

    expect(modeBootstrapper.bootstrap).toHaveBeenCalledTimes(1);
    expect(cardsBootstrapper.bootstrap).toHaveBeenCalledTimes(1);
    expect(registry.reset).toHaveBeenCalledTimes(1);
    expect(bus.clear).toHaveBeenCalledTimes(1);
    expect(bus.emit).toHaveBeenCalledTimes(1);
    expect(bus.emit).toHaveBeenCalledWith('run.started', {
      runId: 'run:seed-solo-001',
      mode: 'pvp',
      seed: 'seed-solo-001',
    });

    expect(callOrder).toEqual([
      'idFactory.createSeed',
      'idFactory.createRunId',
      'runStateFactory.createInitialRunState',
      'modeBootstrapper.bootstrap',
      'cardsBootstrapper.bootstrap',
      'registry.reset',
      'bus.clear',
      'bus.emit',
      'freeze',
    ]);

    expect(result.runId).toBe('run:seed-solo-001');
    expect(result.seed).toBe('seed-solo-001');
    expect(result.userId).toBe('user-bootstrap-001');
    expect(result.mode).toBe('pvp');
    expect(result.modeState.communityHeatModifier).toBe(12);
    expect(result.modeState.disabledBots).toEqual(['BOT_04']);
    expect(result.tags).toContain('mode:bootstrap-applied');
    expect(result.tags).toContain('suite:bootstrap');
    expect(result.cards.hand).toHaveLength(1);
    expect(result.cards.hand[0].definitionId).toBe('STARTER_LIQUIDITY_WALL');
    expect(result.cards.drawPileSize).toBe(23);
    expect(result.cards.deckEntropy).toBe(0.41);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.tags)).toBe(true);
    expect(Object.isFrozen(result.cards.hand)).toBe(true);
  });

  it('uses a caller-provided seed without regenerating one and preserves ghost bootstrap fields through the initial factory', () => {
    const registry = { reset: vi.fn() };
    const bus = { clear: vi.fn(), emit: vi.fn() };

    const idFactory = {
      createSeed: vi.fn(),
      createRunId: vi.fn((seed: string) => `run:${seed}`),
    };

    const pipeline = new (RunBootstrapPipeline as any)({
      registry,
      bus,
      idFactory,
      runStateFactory: {
        createInitialRunState,
      },
      modeBootstrapper: {
        bootstrap: (snapshot: RunStateSnapshot) => snapshot,
      },
      cardsBootstrapper: {
        bootstrap: (snapshot: RunStateSnapshot) => snapshot,
      },
      freeze: (snapshot: RunStateSnapshot) => snapshot,
    });

    const result = pipeline.bootstrap({
      userId: 'ghost-user-001',
      mode: 'ghost',
      seed: 'legend-seed-009',
      legendRunId: 'legend-run-001',
      legendOwnerUserId: 'legend-owner-001',
      disabledBots: ['BOT_01', 'BOT_05'],
    }) as RunStateSnapshot;

    expect(idFactory.createSeed).not.toHaveBeenCalled();
    expect(idFactory.createRunId).toHaveBeenCalledTimes(1);
    expect(idFactory.createRunId).toHaveBeenCalledWith('legend-seed-009');

    expect(result.seed).toBe('legend-seed-009');
    expect(result.mode).toBe('ghost');
    expect(result.modeState.ghostBaselineRunId).toBe('legend-run-001');
    expect(result.modeState.legendOwnerUserId).toBe('legend-owner-001');
    expect(result.modeState.disabledBots).toEqual(['BOT_01', 'BOT_05']);
  });

  it('fails loudly if downstream bootstrap mutates run identity or seed so startup corruption cannot become authoritative', () => {
    const pipeline = new (RunBootstrapPipeline as any)({
      registry: { reset: vi.fn() },
      bus: { clear: vi.fn(), emit: vi.fn() },
      idFactory: {
        createSeed: () => 'seed-integrity-001',
        createRunId: () => 'run:seed-integrity-001',
      },
      runStateFactory: {
        createInitialRunState,
      },
      modeBootstrapper: {
        bootstrap: (snapshot: RunStateSnapshot) => {
          const next = cloneSnapshot(snapshot);
          next.runId = 'tampered-run-id';
          return deepFreeze(next);
        },
      },
      cardsBootstrapper: {
        bootstrap: (snapshot: RunStateSnapshot) => snapshot,
      },
      freeze: (snapshot: RunStateSnapshot) => snapshot,
    });

    expect(() =>
      pipeline.bootstrap({
        userId: 'user-integrity-001',
        mode: 'solo',
      }),
    ).toThrow(/runId|seed|identity|RunBootstrapPipeline|tamper/i);
  });

  it('rejects a cards bootstrapper that returns a mutable snapshot because initial state must remain freeze-safe for deterministic hashing', () => {
    const pipeline = new (RunBootstrapPipeline as any)({
      registry: { reset: vi.fn() },
      bus: { clear: vi.fn(), emit: vi.fn() },
      idFactory: {
        createSeed: () => 'seed-mutable-001',
        createRunId: () => 'run:seed-mutable-001',
      },
      runStateFactory: {
        createInitialRunState,
      },
      modeBootstrapper: {
        bootstrap: (snapshot: RunStateSnapshot) => snapshot,
      },
      cardsBootstrapper: {
        bootstrap: (snapshot: RunStateSnapshot) => {
          const next = cloneSnapshot(snapshot);
          next.cards.hand = [];
          return next;
        },
      },
      freeze: (snapshot: RunStateSnapshot) => snapshot,
      validateFrozenSnapshot: true,
    });

    expect(() =>
      pipeline.bootstrap({
        userId: 'user-mutable-001',
        mode: 'solo',
      }),
    ).toThrow(/frozen|immutable|cards bootstrap|RunBootstrapPipeline/i);
  });
});