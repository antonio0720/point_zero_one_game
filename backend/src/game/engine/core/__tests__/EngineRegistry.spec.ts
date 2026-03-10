//backend/src/game/engine/core/__tests__/EngineRegistry.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createEngineHealth,
  type EngineHealth,
  type EngineHealthStatus,
  type EngineId,
  type SimulationEngine,
} from '../EngineContracts';
import { EngineRegistry } from '../EngineRegistry';

function createMockEngine(
  engineId: EngineId,
  options: {
    r:contentReference[oaicite:0]{index=0}ing[];
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
      throw new Error(`tick() should not be invoked in EngineRegistry spec for ${engineId}`);
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

  it('registers engines and returns them in canonical execution order instead of insertion order', () => {
    const battle = createMockEngine('battle');
    const time = createMockEngine('time');
    const sovereignty = createMockEngine('sovereignty');
    const pressure = createMockEngine('pressure');

    registry.register(battle.engine);
    registry.register(time.engine);
    registry.register(sovereignty.engine);
    registry.register(pressure.engine);

    expect(registry.size()).toBe(4);
    expect(registry.ids()).toEqual(['time', 'pressure', 'battle', 'sovereignty']);
    expect(registry.all().map((engine) => engine.engineId)).toEqual([
      'time',
      'pressure',
      'battle',
      'sovereignty',
    ]);
    expect(registry.get('time')).toBe(time.engine);
    expect(registry.get('battle')).toBe(battle.engine);
    expect(registry.has('sovereignty')).toBe(true);
    expect(registry.has('shield')).toBe(false);
    expect(registry.maybeGet('shield')).toBeNull();
  });

  it('throws when requesting an engine that is not registered', () => {
    expect(() => registry.get('time')).toThrowError('Engine not registered: time');
  });

  it('throws on duplicate registration unless allowReplace is true', () => {
    const original = createMockEngine('time', {
      status: 'HEALTHY',
      notes: ['original'],
    });
    const replacement = createMockEngine('time', {
      status: 'DEGRADED',
      notes: ['replacement'],
    });

    registry.register(original.engine);

    expect(() => registry.register(replacement.engine)).toThrowError(
      'Engine already registered: time. Pass { allowReplace: true } to replace it.',
    );

    registry.register(replacement.engine, { allowReplace: true });

    expect(registry.size()).toBe(1);
    expect(registry.get('time')).toBe(replacement.engine);
    expect(registry.health()).toEqual([
      createEngineHealth('time', 'DEGRADED', 1_700_000_000_000, ['replacement']),
    ]);
  });

  it('supports registerMany, unregister, and clear', () => {
    const time = createMockEngine('time');
    const pressure = createMockEngine('pressure');
    const tension = createMockEngine('tension');

    registry.registerMany([pressure.engine, tension.engine, time.engine]);

    expect(registry.ids()).toEqual(['time', 'pressure', 'tension']);

    expect(registry.unregister('pressure')).toBe(true);
    expect(registry.unregister('pressure')).toBe(false);
    expect(registry.ids()).toEqual(['time', 'tension']);

    registry.clear();

    expect(registry.size()).toBe(0);
    expect(registry.ids()).toEqual([]);
    expect(registry.all()).toEqual([]);
  });

  it('resets all registered engines in execution order', () => {
    const shield = createMockEngine('shield');
    const time = createMockEngine('time');
    const cascade = createMockEngine('cascade');

    registry.register(shield.engine);
    registry.register(time.engine);
    registry.register(cascade.engine);

    registry.reset();

    expect(time.resetSpy).toHaveBeenCalledTimes(1);
    expect(shield.resetSpy).toHaveBeenCalledTimes(1);
    expect(cascade.resetSpy).toHaveBeenCalledTimes(1);
  });

  it('resets only the requested subset when engineIds are provided', () => {
    const time = createMockEngine('time');
    const pressure = createMockEngine('pressure');
    const shield = createMockEngine('shield');

    registry.registerMany([time.engine, pressure.engine, shield.engine]);

    registry.reset(['shield', 'time']);

    expect(time.resetSpy).toHaveBeenCalledTimes(1);
    expect(shield.resetSpy).toHaveBeenCalledTimes(1);
    expect(pressure.resetSpy).not.toHaveBeenCalled();
  });

  it('assertRegistered and assertComplete fail loudly when required engines are missing', () => {
    registry.register(createMockEngine('time').engine);
    registry.register(createMockEngine('pressure').engine);

    expect(() => registry.assertRegistered(['time', 'pressure'])).not.toThrow();

    expect(() => registry.assertRegistered(['time', 'battle'])).toThrowError(
      'Required engine(s) not registered: battle',
    );

    expect(() => registry.assertComplete()).toThrowError(
      'Required engine(s) not registered: tension, shield, battle, cascade, sovereignty',
    );
  });

  it('produces a snapshot with execution order, missing canonical engines, and extras', () => {
    const time = createMockEngine('time');
    const battle = createMockEngine('battle');

    registry.registerMany([battle.engine, time.engine]);

    const snapshot = registry.snapshot();

    expect(snapshot.registeredIds).toEqual(['battle', 'time']);
    expect(snapshot.executionOrder).toEqual(['time', 'battle']);
    expect(snapshot.size).toBe(2);
    expect(snapshot.missingFromCanonicalOrder).toEqual([
      'pressure',
      'tension',
      'shield',
      'cascade',
      'sovereignty',
    ]);
    expect(snapshot.extraIds).toEqual([]);
  });

  it('degrades health safely when an engine throws during getHealth()', () => {
    const time = createMockEngine('time', {
      status: 'HEALTHY',
      notes: ['nominal'],
    });

    const pressure = createMockEngine('pressure', {
      healthError: 'pressure sensor failure',
    });

    registry.registerMany([time.engine, pressure.engine]);

    const health = registry.health();

    expect(health).toEqual([
      createEngineHealth('time', 'HEALTHY', 1_700_000_000_000, ['nominal']),
      {
        engineId: 'pressure',
        status: 'FAILED',
        updatedAt: expect.any(Number),
        notes: ['pressure sensor failure'],
      },
    ]);
  });

  it('accepts a custom preferred order for executionOrder()', () => {
    const shield = createMockEngine('shield');
    const time = createMockEngine('time');
    const battle = createMockEngine('battle');

    registry.registerMany([shield.engine, battle.engine, time.engine]);

    expect(
      registry.executionOrder(['battle', 'shield', 'time']),
    ).toEqual(['battle', 'shield', 'time']);
  });
});