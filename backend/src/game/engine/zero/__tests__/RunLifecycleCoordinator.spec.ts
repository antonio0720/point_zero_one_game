// backend/src/game/engine/zero/__tests__/RunLifecycleCoordinator.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';

const engineOrchestratorMock = vi.hoisted(() => {
  const startRun = vi.fn();
  const getSnapshot = vi.fn();
  const playCard = vi.fn();
  const advanceTick = vi.fn();

  const ctor = vi.fn(() => ({
    startRun,
    getSnapshot,
    playCard,
    advanceTick,
  }));

  return {
    ctor,
    startRun,
    getSnapshot,
    playCard,
    advanceTick,
  };
});

vi.mock('../EngineOrchestrator', () => ({
  EngineOrchestrator: engineOrchestratorMock.ctor,
}));

import { RunLifecycleCoordinator } from '../RunLifecycleCoordinator';

function createSnapshot(
  seed: string,
  patch: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: `run-${seed}`,
    userId: 'user-run-lifecycle',
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

describe.sequential('RunLifecycleCoordinator', () => {
  beforeEach(() => {
    engineOrchestratorMock.ctor.mockClear();
    engineOrchestratorMock.startRun.mockReset();
    engineOrchestratorMock.getSnapshot.mockReset();
    engineOrchestratorMock.playCard.mockReset();
    engineOrchestratorMock.advanceTick.mockReset();
  });

  it('start() forwards userId, mode, and seed to EngineOrchestrator.startRun()', () => {
    const started = createSnapshot('lifecycle-start');
    engineOrchestratorMock.startRun.mockReturnValue(started);

    const coordinator = new RunLifecycleCoordinator();
    const result = coordinator.start('user-a', 'solo', 'seed-a');

    expect(engineOrchestratorMock.ctor).toHaveBeenCalledTimes(1);
    expect(engineOrchestratorMock.startRun).toHaveBeenCalledWith({
      userId: 'user-a',
      mode: 'solo',
      seed: 'seed-a',
    });
    expect(result).toEqual(started);
  });

  it('play() forwards targeting and defaults targeting to SELF', () => {
    const afterPlay = createSnapshot('lifecycle-play');
    engineOrchestratorMock.playCard.mockReturnValue(afterPlay);

    const coordinator = new RunLifecycleCoordinator();

    const defaultTargeting = coordinator.play('CARD_ALPHA', 'actor-1');
    expect(engineOrchestratorMock.playCard).toHaveBeenNthCalledWith(
      1,
      'CARD_ALPHA',
      'actor-1',
      'SELF',
    );
    expect(defaultTargeting).toEqual(afterPlay);

    const explicitTargeting = coordinator.play('CARD_BETA', 'actor-2', 'OTHER');
    expect(engineOrchestratorMock.playCard).toHaveBeenNthCalledWith(
      2,
      'CARD_BETA',
      'actor-2',
      'OTHER',
    );
    expect(explicitTargeting).toEqual(afterPlay);
  });

  it('tick() advances the requested number of ticks and stops early on terminal outcome', () => {
    const initial = createSnapshot('lifecycle-tick-initial');
    const tickOne = createSnapshot('lifecycle-tick-1', { tick: 1 });
    const tickTwo = createSnapshot('lifecycle-tick-2', {
      tick: 2,
      outcome: 'FREEDOM',
    });

    engineOrchestratorMock.getSnapshot.mockReturnValue(initial);
    engineOrchestratorMock.advanceTick
      .mockReturnValueOnce(tickOne)
      .mockReturnValueOnce(tickTwo)
      .mockReturnValueOnce(
        createSnapshot('lifecycle-tick-3', { tick: 3, outcome: 'FREEDOM' }),
      );

    const coordinator = new RunLifecycleCoordinator();
    const result = coordinator.tick(10);

    expect(engineOrchestratorMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(engineOrchestratorMock.advanceTick).toHaveBeenCalledTimes(2);
    expect(result).toEqual(tickTwo);
  });

  it('tick() returns the current snapshot immediately when count is zero', () => {
    const current = createSnapshot('lifecycle-zero-count');
    engineOrchestratorMock.getSnapshot.mockReturnValue(current);

    const coordinator = new RunLifecycleCoordinator();
    const result = coordinator.tick(0);

    expect(engineOrchestratorMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(engineOrchestratorMock.advanceTick).not.toHaveBeenCalled();
    expect(result).toEqual(current);
  });

  it('runUntilDone() stops as soon as outcome is non-null', () => {
    const initial = createSnapshot('lifecycle-untildone-initial');
    const live = createSnapshot('lifecycle-untildone-live', { tick: 1 });
    const terminal = createSnapshot('lifecycle-untildone-terminal', {
      tick: 2,
      outcome: 'TIMEOUT',
    });

    engineOrchestratorMock.getSnapshot.mockReturnValue(initial);
    engineOrchestratorMock.advanceTick
      .mockReturnValueOnce(live)
      .mockReturnValueOnce(terminal);

    const coordinator = new RunLifecycleCoordinator();
    const result = coordinator.runUntilDone(100);

    expect(engineOrchestratorMock.advanceTick).toHaveBeenCalledTimes(2);
    expect(result).toEqual(terminal);
  });

  it('runUntilDone() returns the last non-terminal snapshot when maxTicks is exhausted', () => {
    const initial = createSnapshot('lifecycle-max-initial');
    const tickOne = createSnapshot('lifecycle-max-1', { tick: 1 });
    const tickTwo = createSnapshot('lifecycle-max-2', { tick: 2 });
    const tickThree = createSnapshot('lifecycle-max-3', { tick: 3 });

    engineOrchestratorMock.getSnapshot.mockReturnValue(initial);
    engineOrchestratorMock.advanceTick
      .mockReturnValueOnce(tickOne)
      .mockReturnValueOnce(tickTwo)
      .mockReturnValueOnce(tickThree);

    const coordinator = new RunLifecycleCoordinator();
    const result = coordinator.runUntilDone(3);

    expect(engineOrchestratorMock.advanceTick).toHaveBeenCalledTimes(3);
    expect(result).toEqual(tickThree);
  });
});