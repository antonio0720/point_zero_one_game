//backend/src/game/engine/core/__tests__/EngineRegistry.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createEngineHealth,
  type EngineHealth,
  type EngineId,
  type SimulationEngine,
} from '../EngineContracts';
import { EngineRegistry } from '../EngineRegistry';

function createMockEngine(
  engineId: EngineId,
  options: {
    readonly status?: EngineHealth['status'];
    readonly notes?: readonly string[];
    readonly updatedAt?: number;
    readonly healthError?: string | null;
  } = {},
): {
  readonly engine: SimulationEngine;
  readonly resetSpy: ReturnType<typeof vi.fn>;
  readonly getHealthSpy: ReturnType<typeof vi.fn>;
} {
  const resetSpy = vi.fn();

  const getHealthSpy = vi.fn((): EngineHealth => {
    if (options.healthError) {
      throw new Error(options.healthError);
    }

    return createEngineHealth(
      engineId,
      options.status ?? 'HEALTHY',
      options.updatedAt ?? 1_700_000_000_000,
      options.notes ?? [],
    );
  });

  const engine: SimulationEngine = {
    engineId,
    reset: resetSpy,
    tick: () => {
      throw new Error(
        `tick() should not be invoked in EngineRegistry spec for ${engineId}`,
      );
    },
    getHealth: getHealthSpy,
  };

  return {
    engine,
    resetSpy,
    getHealthSpy,
  };
}

describe('EngineRegistry', () => {
  let registry: EngineRegistry;

  beforeEach(() => {
    registry = new EngineRegistry();
  });

  it('registers engines and returns them in insertion order', () => {
    const battle = createMockEngine('battle');
    const time = createMockEngine('time');
    const sovereignty = createMockEngine('sovereignty');

    registry.register(battle.engine);
    registry.register(time.engine);
    registry.register(sovereignty.engine);

    const engines = registry.all();

    expect(engines).toHaveLength(3);
    expect(engines.map((engine) => engine.engineId)).toEqual([
      'battle',
      'time',
      'sovereignty',
    ]);
    expect(registry.get('battle')).toBe(battle.engine);
    expect(registry.get('time')).toBe(time.engine);
    expect(registry.get('sovereignty')).toBe(sovereignty.engine);
  });

  it('throws when requesting an engine that is not registered', () => {
    expect(() => registry.get('time')).toThrowError(
      'Engine not registered: time',
    );
  });

  it('does not duplicate order entries when the same engine id is registered twice', () => {
    const first = createMockEngine('time', {
      status: 'HEALTHY',
      notes: ['first'],
    });

    const second = createMockEngine('time', {
      status: 'DEGRADED',
      notes: ['second'],
    });

    registry.register(first.engine);
    registry.register(second.engine);

    const engines = registry.all();

    expect(engines).toHaveLength(1);
    expect(engines[0]).toBe(second.engine);
    expect(engines[0].engineId).toBe('time');
  });

  it('reset() calls reset on every registered engine', () => {
    const shield = createMockEngine('shield');
    const time = createMockEngine('time');
    const cascade = createMockEngine('cascade');

    registry.register(shield.engine);
    registry.register(time.engine);
    registry.register(cascade.engine);

    registry.reset();

    expect(shield.resetSpy).toHaveBeenCalledTimes(1);
    expect(time.resetSpy).toHaveBeenCalledTimes(1);
    expect(cascade.resetSpy).toHaveBeenCalledTimes(1);
  });

  it('reset() does nothing when no engines are registered', () => {
    expect(() => registry.reset()).not.toThrow();
    expect(registry.all()).toEqual([]);
  });

  it('health() returns the health of all registered engines in registry order', () => {
    const tension = createMockEngine('tension', {
      status: 'HEALTHY',
      notes: ['stable'],
      updatedAt: 1_700_000_000_100,
    });

    const pressure = createMockEngine('pressure', {
      status: 'DEGRADED',
      notes: ['high load'],
      updatedAt: 1_700_000_000_200,
    });

    registry.register(tension.engine);
    registry.register(pressure.engine);

    expect(registry.health()).toEqual([
      createEngineHealth(
        'tension',
        'HEALTHY',
        1_700_000_000_100,
        ['stable'],
      ),
      createEngineHealth(
        'pressure',
        'DEGRADED',
        1_700_000_000_200,
        ['high load'],
      ),
    ]);
  });

  it('health() propagates engine health errors in the current implementation', () => {
    const time = createMockEngine('time');
    const pressure = createMockEngine('pressure', {
      healthError: 'pressure sensor failure',
    });

    registry.register(time.engine);
    registry.register(pressure.engine);

    expect(() => registry.health()).toThrowError('pressure sensor failure');
  });

  it('all() returns the currently registered engine instances', () => {
    const time = createMockEngine('time');
    const pressure = createMockEngine('pressure');

    registry.register(time.engine);
    registry.register(pressure.engine);

    const all = registry.all();

    expect(all).toHaveLength(2);
    expect(all[0]).toBe(time.engine);
    expect(all[1]).toBe(pressure.engine);
  });
});