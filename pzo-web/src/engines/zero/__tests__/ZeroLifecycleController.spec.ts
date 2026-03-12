// pzo-web/src/engines/zero/__tests__/ZeroLifecycleController.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

type EventHandler = (event: { payload?: unknown }) => void;

function createEventBusMock() {
  const handlers = new Map<string, Set<EventHandler>>();

  return {
    on: vi.fn((eventType: string, handler: EventHandler) => {
      if (!handlers.has(eventType)) {
        handlers.set(eventType, new Set());
      }
      handlers.get(eventType)!.add(handler);

      return () => {
        handlers.get(eventType)?.delete(handler);
      };
    }),
    emitTo(eventType: string, payload?: unknown) {
      for (const handler of handlers.get(eventType) ?? []) {
        handler({ payload });
      }
    },
    getHandlerCount(eventType: string) {
      return handlers.get(eventType)?.size ?? 0;
    },
  };
}

function createOrchestratorMock(initialLifecycle: string = 'IDLE') {
  let lifecycleState = initialLifecycle;

  return {
    startRun: vi.fn((params: any) => {
      lifecycleState = 'ACTIVE';
      return params;
    }),
    executeTick: vi.fn(async () => ({
      tickIndex: 1,
      pressureScore: 0.25,
      postActionPressure: 0.33,
      attacksFired: [],
      damageResults: [],
      cascadeEffects: [],
      recoveryResults: [],
      runOutcome: null,
      tickDurationMs: 88,
    })),
    endRun: vi.fn(async () => {
      lifecycleState = 'ENDED';
    }),
    reset: vi.fn(() => {
      lifecycleState = 'IDLE';
    }),
    getLifecycleState: vi.fn(() => lifecycleState),
    getCurrentRunId: vi.fn(() => 'run_lifecycle_001'),
    getHealthReport: vi.fn(() => ({
      TIME_ENGINE: 'INITIALIZED',
      PRESSURE_ENGINE: 'INITIALIZED',
      TENSION_ENGINE: 'INITIALIZED',
      SHIELD_ENGINE: 'INITIALIZED',
      BATTLE_ENGINE: 'INITIALIZED',
      CASCADE_ENGINE: 'INITIALIZED',
      SOVEREIGNTY_ENGINE: 'INITIALIZED',
    })),
    __setLifecycleState(next: string) {
      lifecycleState = next;
    },
  };
}

function createStoreBridgeMock() {
  return {
    bind: vi.fn(),
    syncRunMirrorNow: vi.fn(),
    dispose: vi.fn(),
  };
}

function createRuntimeStatusMock() {
  return {
    setMode: vi.fn(),
    setFreedomThreshold: vi.fn(),
    getSnapshot: vi.fn(() => ({
      lifecycleState: 'IDLE',
      mode: null,
      freedomThreshold: 0,
    })),
  };
}

const sharedEventBus = createEventBusMock();
const singletonOrchestrator = createOrchestratorMock();
const singletonStoreBridge = createStoreBridgeMock();
const singletonRuntimeStatus = createRuntimeStatusMock();
const resetAllSlices = vi.fn();

vi.mock('../core/EventBus', () => ({
  EventBus: vi.fn(),
  sharedEventBus,
}));

vi.mock('./EngineOrchestrator', () => ({
  EngineOrchestrator: vi.fn(() => singletonOrchestrator),
}));

vi.mock('./ZeroStoreBridge', () => ({
  ZeroStoreBridge: vi.fn(),
  zeroStoreBridge: singletonStoreBridge,
}));

vi.mock('./ZeroRuntimeStatus', () => ({
  ZeroRuntimeStatus: vi.fn(() => singletonRuntimeStatus),
}));

vi.mock('../../store/engineStore', () => ({
  useEngineStore: {
    getState: vi.fn(() => ({
      resetAllSlices,
    })),
  },
}));

import {
  ZeroLifecycleController,
  zeroLifecycleController,
} from '../ZeroLifecycleController';

function buildController(overrides?: {
  orchestrator?: any;
  eventBus?: any;
  storeBridge?: any;
  runtimeStatus?: any;
}) {
  return new ZeroLifecycleController({
    orchestrator: overrides?.orchestrator ?? createOrchestratorMock(),
    eventBus: overrides?.eventBus ?? createEventBusMock(),
    storeBridge: overrides?.storeBridge ?? createStoreBridgeMock(),
    runtimeStatus: overrides?.runtimeStatus ?? createRuntimeStatusMock(),
    autoBindStoreBridge: true,
    autoWireEngineHandlers: true,
    autoWireRunMirror: true,
  } as any);
}

describe('ZeroLifecycleController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllSlices.mockReset();
  });

  it('exports a singleton controller instance', () => {
    expect(zeroLifecycleController).toBeInstanceOf(ZeroLifecycleController);
  });

  it('auto-binds the store bridge and installs lifecycle event observers at construction', () => {
    const eventBus = createEventBusMock();
    const orchestrator = createOrchestratorMock();
    const storeBridge = createStoreBridgeMock();
    const runtimeStatus = createRuntimeStatusMock();

    const controller = buildController({
      orchestrator,
      eventBus,
      storeBridge,
      runtimeStatus,
    });

    expect(controller.getOrchestrator()).toBe(orchestrator);
    expect(controller.getEventBus()).toBe(eventBus);
    expect(controller.getStoreBridge()).toBe(storeBridge);
    expect(controller.getRuntimeStatus()).toBe(runtimeStatus);

    expect(storeBridge.bind).toHaveBeenCalledWith({
      eventBus,
      wireEngineHandlers: true,
      wireRunMirror: true,
      syncRunMirrorImmediately: true,
    });

    expect(eventBus.on).toHaveBeenCalledTimes(4);
    expect(eventBus.getHandlerCount('RUN_STARTED')).toBe(1);
    expect(eventBus.getHandlerCount('RUN_ENDED')).toBe(1);
    expect(eventBus.getHandlerCount('TICK_COMPLETE')).toBe(1);
    expect(eventBus.getHandlerCount('TICK_STEP_ERROR')).toBe(1);
  });

  it('tracks mode and forwards mode projection into runtime status', () => {
    const controller = buildController();

    controller.setMode('solo_mode' as any, { difficulty: 'legendary' });

    expect(controller.getCurrentMode()).toBe('solo_mode');
    expect(controller.getRuntimeStatus().setMode).toHaveBeenCalledWith(
      'solo_mode',
      { difficulty: 'legendary' },
    );
  });

  it('starts a run through the orchestrator, binds the store bridge, syncs mirrors, and journals the transition', () => {
    const orchestrator = createOrchestratorMock('IDLE');
    const eventBus = createEventBusMock();
    const storeBridge = createStoreBridgeMock();
    const runtimeStatus = createRuntimeStatusMock();
    const controller = buildController({
      orchestrator,
      eventBus,
      storeBridge,
      runtimeStatus,
    });

    const params = {
      runId: 'run_lifecycle_001',
      userId: 'user_lifecycle_001',
      seed: 'seed_lifecycle_001',
      seasonTickBudget: 120,
      freedomThreshold: 900_000,
      clientVersion: 'web-1.0.0',
      engineVersion: 'engine-1.0.0',
    };

    controller.startRun(params as any, {
      mode: 'team_up_mode',
      modeOverrides: { teammates: 3 },
      bindStoreBridge: true,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: true,
    } as any);

    expect(storeBridge.bind).toHaveBeenCalledWith({
      eventBus,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: true,
    });
    expect(runtimeStatus.setFreedomThreshold).toHaveBeenCalledWith(900_000);
    expect(orchestrator.startRun).toHaveBeenCalledWith(params);
    expect(storeBridge.syncRunMirrorNow).toHaveBeenCalledTimes(1);

    const journal = controller.getTransitionJournal();
    expect(journal.at(-1)).toEqual(
      expect.objectContaining({
        action: 'START_RUN',
        from: 'IDLE',
        to: 'ACTIVE',
        metadata: expect.objectContaining({
          runId: 'run_lifecycle_001',
          mode: 'team_up_mode',
        }),
      }),
    );
  });

  it('supports pause and resume only when the lifecycle state allows it', () => {
    const orchestrator = createOrchestratorMock('ACTIVE');
    const controller = buildController({ orchestrator });

    expect(controller.isPaused()).toBe(false);
    expect(controller.pause('OPERATOR_INTERVENTION')).toBe(true);
    expect(controller.isPaused()).toBe(true);
    expect(controller.getPauseState()).toEqual(
      expect.objectContaining({
        isPaused: true,
        reason: 'OPERATOR_INTERVENTION',
        resumeCount: 0,
      }),
    );

    expect(controller.pause('SECOND_PAUSE')).toBe(false);
    expect(controller.resume()).toBe(true);
    expect(controller.isPaused()).toBe(false);
    expect(controller.getPauseState()).toEqual(
      expect.objectContaining({
        isPaused: false,
        reason: null,
        resumeCount: 1,
      }),
    );

    expect(controller.resume()).toBe(false);
  });

  it('refuses live tick execution unless the run is ACTIVE and unpaused', async () => {
    const orchestrator = createOrchestratorMock('IDLE');
    const storeBridge = createStoreBridgeMock();
    const controller = buildController({ orchestrator, storeBridge });

    await expect(controller.executeTick()).resolves.toBeNull();
    expect(orchestrator.executeTick).not.toHaveBeenCalled();

    orchestrator.__setLifecycleState('ACTIVE');
    controller.pause('PAUSED_FOR_TEST');
    await expect(controller.executeTick()).resolves.toBeNull();
    expect(orchestrator.executeTick).not.toHaveBeenCalled();
  });

  it('executes a live tick, syncs the run mirror, and journals result metadata', async () => {
    const orchestrator = createOrchestratorMock('ACTIVE');
    const storeBridge = createStoreBridgeMock();
    const controller = buildController({ orchestrator, storeBridge });

    const tickResult = {
      tickIndex: 11,
      pressureScore: 0.41,
      postActionPressure: 0.58,
      attacksFired: [],
      damageResults: [],
      cascadeEffects: [],
      recoveryResults: [],
      runOutcome: null,
      tickDurationMs: 103,
    };

    orchestrator.executeTick.mockResolvedValueOnce(tickResult);

    await expect(controller.executeTick()).resolves.toEqual(tickResult);

    expect(orchestrator.executeTick).toHaveBeenCalledTimes(1);
    expect(storeBridge.syncRunMirrorNow).toHaveBeenCalledTimes(1);

    const journal = controller.getTransitionJournal();
    expect(journal.at(-1)).toEqual(
      expect.objectContaining({
        action: 'EXECUTE_TICK',
        metadata: expect.objectContaining({
          tickIndex: 11,
          runOutcome: null,
          tickDurationMs: 103,
        }),
      }),
    );
  });

  it('executes tick batches and stops immediately when a terminal outcome is reached', async () => {
    const orchestrator = createOrchestratorMock('ACTIVE');
    const controller = buildController({ orchestrator });

    orchestrator.executeTick
      .mockResolvedValueOnce({
        tickIndex: 1,
        pressureScore: 0.2,
        postActionPressure: 0.25,
        attacksFired: [],
        damageResults: [],
        cascadeEffects: [],
        recoveryResults: [],
        runOutcome: null,
        tickDurationMs: 80,
      })
      .mockResolvedValueOnce({
        tickIndex: 2,
        pressureScore: 0.3,
        postActionPressure: 0.31,
        attacksFired: [],
        damageResults: [],
        cascadeEffects: [],
        recoveryResults: [],
        runOutcome: 'FREEDOM',
        tickDurationMs: 82,
      })
      .mockResolvedValueOnce({
        tickIndex: 3,
        pressureScore: 0.4,
        postActionPressure: 0.41,
        attacksFired: [],
        damageResults: [],
        cascadeEffects: [],
        recoveryResults: [],
        runOutcome: null,
        tickDurationMs: 85,
      });

    const results = await controller.executeTicks(10);

    expect(results).toHaveLength(2);
    expect(results[1].runOutcome).toBe('FREEDOM');
    expect(orchestrator.executeTick).toHaveBeenCalledTimes(2);

    const journal = controller.getTransitionJournal();
    expect(journal.at(-1)).toEqual(
      expect.objectContaining({
        action: 'EXECUTE_TICKS',
        metadata: expect.objectContaining({
          requestedCount: 10,
          completedCount: 2,
          lastRunOutcome: 'FREEDOM',
        }),
      }),
    );
  });

  it('ends and abandons runs through orchestrator endRun while clearing pause state', async () => {
    const orchestrator = createOrchestratorMock('ACTIVE');
    const storeBridge = createStoreBridgeMock();
    const controller = buildController({ orchestrator, storeBridge });

    controller.pause('PRE_END_PAUSE');

    await controller.endRun('BANKRUPT' as any);

    expect(orchestrator.endRun).toHaveBeenCalledWith('BANKRUPT');
    expect(storeBridge.syncRunMirrorNow).toHaveBeenCalledTimes(1);
    expect(controller.isPaused()).toBe(false);

    await controller.abandonRun('WINDOW_CLOSE');

    expect(orchestrator.endRun).toHaveBeenLastCalledWith('ABANDONED');
    expect(storeBridge.syncRunMirrorNow).toHaveBeenCalledTimes(2);

    const journal = controller.getTransitionJournal();
    expect(journal.at(-2)).toEqual(
      expect.objectContaining({
        action: 'END_RUN',
        metadata: expect.objectContaining({
          outcome: 'BANKRUPT',
        }),
      }),
    );
    expect(journal.at(-1)).toEqual(
      expect.objectContaining({
        action: 'ABANDON_RUN',
        metadata: expect.objectContaining({
          reason: 'WINDOW_CLOSE',
        }),
      }),
    );
  });

  it('resets orchestrator state, syncs mirror state, and optionally resets engine slices', () => {
    const orchestrator = createOrchestratorMock('ENDED');
    const storeBridge = createStoreBridgeMock();
    const controller = buildController({ orchestrator, storeBridge });

    controller.reset();

    expect(orchestrator.reset).toHaveBeenCalledTimes(1);
    expect(storeBridge.syncRunMirrorNow).toHaveBeenCalledTimes(1);
    expect(resetAllSlices).toHaveBeenCalledTimes(1);

    controller.reset({ resetEngineStoreSlices: false });

    expect(resetAllSlices).toHaveBeenCalledTimes(1);
  });

  it('records observed event transitions from RUN_STARTED, RUN_ENDED, TICK_COMPLETE, and TICK_STEP_ERROR', () => {
    const eventBus = createEventBusMock();
    const controller = buildController({ eventBus });

    eventBus.emitTo('RUN_STARTED', { runId: 'run_event_001' });
    eventBus.emitTo('TICK_COMPLETE', { tickIndex: 14 });
    eventBus.emitTo('TICK_STEP_ERROR', {
      step: 4,
      engineId: 'SHIELD_ENGINE',
      error: 'shield fault',
    });
    eventBus.emitTo('RUN_ENDED', { outcome: 'TIMEOUT' });

    const journal = controller.getTransitionJournal();

    expect(journal.some((entry) => entry.action === 'EVENT_RUN_STARTED')).toBe(
      true,
    );
    expect(
      journal.some((entry) => entry.action === 'EVENT_TICK_COMPLETE'),
    ).toBe(true);
    expect(
      journal.some((entry) => entry.action === 'EVENT_TICK_STEP_ERROR'),
    ).toBe(true);
    expect(journal.some((entry) => entry.action === 'EVENT_RUN_ENDED')).toBe(
      true,
    );
  });

  it('disposes event subscriptions and store-bridge resources cleanly', () => {
    const eventBus = createEventBusMock();
    const storeBridge = createStoreBridgeMock();
    const controller = buildController({ eventBus, storeBridge });

    expect(eventBus.getHandlerCount('RUN_STARTED')).toBe(1);

    controller.dispose();

    expect(storeBridge.dispose).toHaveBeenCalledTimes(1);
    expect(eventBus.getHandlerCount('RUN_STARTED')).toBe(0);
    expect(eventBus.getHandlerCount('RUN_ENDED')).toBe(0);
    expect(eventBus.getHandlerCount('TICK_COMPLETE')).toBe(0);
    expect(eventBus.getHandlerCount('TICK_STEP_ERROR')).toBe(0);
  });
});