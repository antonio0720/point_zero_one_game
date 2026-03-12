// pzo-web/src/engines/zero/__tests__/ZeroFacade.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMock = {
  getLifecycleState: vi.fn(() => 'IDLE'),
  isPaused: vi.fn(() => false),
  getTransitionJournal: vi.fn(() => []),
  getStatusSnapshot: vi.fn(() => ({ lifecycleState: 'IDLE' })),
  setMode: vi.fn(),
  startRun: vi.fn(),
  executeTick: vi.fn(async () => null),
  executeTicks: vi.fn(async () => []),
  pause: vi.fn(() => true),
  resume: vi.fn(() => true),
  endRun: vi.fn(async () => undefined),
  abandonRun: vi.fn(async () => undefined),
  reset: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
  dispose: vi.fn(),
};

const runtimeStatusMock = {
  getSnapshot: vi.fn(() => ({ lifecycleState: 'IDLE', mode: null })),
};

const diagnosticsMock = {
  getSnapshot: vi.fn(() => ({
    runtime: null,
    recentTicks: [],
    recentStepErrors: [],
  })),
  clearJournals: vi.fn(),
};

const storeBridgeMock = {
  getSnapshot: vi.fn(() => ({
    generatedAt: Date.now(),
    isBound: true,
    eventBusPendingCount: 0,
    eventBusIsFlushing: false,
    registeredChannels: [],
  })),
  syncRunMirrorNow: vi.fn(),
  dispose: vi.fn(),
};

const eventBridgeMock = {
  getMetrics: vi.fn(() => ({
    totalObserved: 0,
    byEventType: {},
    bySourceEngine: {},
    lastObservedAt: null,
  })),
  getObservedHistory: vi.fn(() => []),
  clearObservedHistory: vi.fn(),
};

const testHarnessMock = {
  getSnapshot: vi.fn(() => ({
    lifecycleState: 'IDLE',
    isPaused: false,
    lastTickResult: null,
  })),
  hardReset: vi.fn(),
  destroy: vi.fn(),
};

const devtoolsBridgeMock = {
  getSnapshot: vi.fn(() => ({
    enabled: false,
    attached: false,
  })),
  attach: vi.fn(),
  detach: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('../ZeroLifecycleController', () => ({
  ZeroLifecycleController: vi.fn(),
  zeroLifecycleController: controllerMock,
}));

vi.mock('../ZeroRuntimeStatus', () => ({
  ZeroRuntimeStatus: vi.fn(),
  zeroRuntimeStatus: runtimeStatusMock,
}));

vi.mock('../ZeroDiagnostics', () => ({
  ZeroDiagnostics: vi.fn(),
  zeroDiagnostics: diagnosticsMock,
}));

vi.mock('../ZeroStoreBridge', () => ({
  ZeroStoreBridge: vi.fn(),
  zeroStoreBridge: storeBridgeMock,
}));

vi.mock('../ZeroEventBridge', () => ({
  ZeroEventBridge: vi.fn(),
  zeroEventBridge: eventBridgeMock,
}));

vi.mock('../ZeroTestHarness', () => ({
  ZeroTestHarness: vi.fn(),
  zeroTestHarness: testHarnessMock,
}));

vi.mock('../ZeroDevtoolsBridge', () => ({
  ZeroDevtoolsBridge: vi.fn(),
  zeroDevtoolsBridge: devtoolsBridgeMock,
}));

import { ZeroFacade, zeroFacade } from '../ZeroFacade';

function buildFacade() {
  return new ZeroFacade({
    controller: controllerMock as any,
    runtimeStatus: runtimeStatusMock as any,
    diagnostics: diagnosticsMock as any,
    storeBridge: storeBridgeMock as any,
    eventBridge: eventBridgeMock as any,
    testHarness: testHarnessMock as any,
    devtoolsBridge: devtoolsBridgeMock as any,
  });
}

describe('ZeroFacade', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    controllerMock.getLifecycleState.mockReturnValue('IDLE');
    controllerMock.isPaused.mockReturnValue(false);
    controllerMock.getTransitionJournal.mockReturnValue([]);
    controllerMock.getStatusSnapshot.mockReturnValue({ lifecycleState: 'IDLE' });
    controllerMock.executeTick.mockResolvedValue(null);
    controllerMock.executeTicks.mockResolvedValue([]);

    runtimeStatusMock.getSnapshot.mockReturnValue({
      lifecycleState: 'IDLE',
      mode: null,
    });

    diagnosticsMock.getSnapshot.mockReturnValue({
      runtime: null,
      recentTicks: [],
      recentStepErrors: [],
    });

    storeBridgeMock.getSnapshot.mockReturnValue({
      generatedAt: Date.now(),
      isBound: true,
      eventBusPendingCount: 0,
      eventBusIsFlushing: false,
      registeredChannels: [],
    });

    eventBridgeMock.getMetrics.mockReturnValue({
      totalObserved: 0,
      byEventType: {},
      bySourceEngine: {},
      lastObservedAt: null,
    });

    testHarnessMock.getSnapshot.mockReturnValue({
      lifecycleState: 'IDLE',
      isPaused: false,
      lastTickResult: null,
    });

    devtoolsBridgeMock.getSnapshot.mockReturnValue({
      enabled: false,
      attached: false,
    });
  });

  it('exports a singleton facade instance', () => {
    expect(zeroFacade).toBeInstanceOf(ZeroFacade);
  });

  it('exposes collaborator accessors without replacing repo-native ownership', () => {
    const facade = buildFacade();

    expect(facade.getController()).toBe(controllerMock);
    expect(facade.getRuntimeStatus()).toBe(runtimeStatusMock);
    expect(facade.getDiagnostics()).toBe(diagnosticsMock);
    expect(facade.getStoreBridge()).toBe(storeBridgeMock);
    expect(facade.getEventBridge()).toBe(eventBridgeMock);
    expect(facade.getTestHarness()).toBe(testHarnessMock);
    expect(facade.getDevtoolsBridge()).toBe(devtoolsBridgeMock);
  });

  it('delegates lifecycle and tick controls to ZeroLifecycleController', async () => {
    const facade = buildFacade();
    const params = {
      runId: 'run_facade_001',
      userId: 'user_facade_001',
      seed: 'seed_facade_001',
      seasonTickBudget: 120,
      freedomThreshold: 1_000_000,
      clientVersion: 'web-1.0.0',
      engineVersion: 'engine-1.0.0',
    };

    const tickResult = {
      tickIndex: 7,
      pressureScore: 0.42,
      postActionPressure: 0.51,
      attacksFired: [],
      damageResults: [],
      cascadeEffects: [],
      recoveryResults: [],
      runOutcome: null,
      tickDurationMs: 91,
    };

    controllerMock.executeTick.mockResolvedValueOnce(tickResult as any);
    controllerMock.executeTicks.mockResolvedValueOnce([tickResult] as any);

    facade.setMode('solo_mode' as any, { difficulty: 'hard' });
    facade.startRun(params as any, { bindStoreBridge: true } as any);

    expect(controllerMock.setMode).toHaveBeenCalledWith('solo_mode', {
      difficulty: 'hard',
    });
    expect(controllerMock.startRun).toHaveBeenCalledWith(params, {
      bindStoreBridge: true,
    });

    await expect(facade.executeTick()).resolves.toEqual(tickResult);
    await expect(facade.executeTicks(4)).resolves.toEqual([tickResult]);

    expect(controllerMock.executeTick).toHaveBeenCalledTimes(1);
    expect(controllerMock.executeTicks).toHaveBeenCalledWith(4);
  });

  it('delegates pause, resume, end, abandon, reset, and subscription methods', async () => {
    const facade = buildFacade();
    const unsubscribe = vi.fn();

    controllerMock.subscribe.mockReturnValueOnce(unsubscribe as any);

    expect(facade.pause('OPERATOR_PAUSE')).toBe(true);
    expect(facade.resume()).toBe(true);

    await facade.endRun('FREEDOM' as any);
    await facade.abandonRun('PLAYER_LEFT');
    facade.reset({ resetEngineStoreSlices: false } as any);

    const returnedUnsubscribe = facade.subscribe(
      'RUN_STARTED' as any,
      vi.fn(),
    );

    expect(controllerMock.pause).toHaveBeenCalledWith('OPERATOR_PAUSE');
    expect(controllerMock.resume).toHaveBeenCalledTimes(1);
    expect(controllerMock.endRun).toHaveBeenCalledWith('FREEDOM');
    expect(controllerMock.abandonRun).toHaveBeenCalledWith('PLAYER_LEFT');
    expect(controllerMock.reset).toHaveBeenCalledWith({
      resetEngineStoreSlices: false,
    });
    expect(controllerMock.subscribe).toHaveBeenCalledTimes(1);
    expect(returnedUnsubscribe).toBe(unsubscribe);
  });

  it('projects status, diagnostics, store, event, harness, and devtools snapshots', () => {
    const facade = buildFacade();

    expect(facade.getLifecycleState()).toBe('IDLE');
    expect(facade.isPaused()).toBe(false);
    expect(facade.getStatusSnapshot()).toEqual({
      lifecycleState: 'IDLE',
      mode: null,
    });
    expect(facade.getDiagnosticsSnapshot()).toEqual({
      runtime: null,
      recentTicks: [],
      recentStepErrors: [],
    });
    expect(facade.getStoreBridgeSnapshot()).toEqual(
      expect.objectContaining({
        isBound: true,
        eventBusPendingCount: 0,
      }),
    );
    expect(facade.getEventMetrics()).toEqual(
      expect.objectContaining({
        totalObserved: 0,
      }),
    );
    expect(facade.getHarnessSnapshot()).toEqual(
      expect.objectContaining({
        lifecycleState: 'IDLE',
        isPaused: false,
      }),
    );
    expect(facade.getDevtoolsSnapshot()).toEqual({
      enabled: false,
      attached: false,
    });

    expect(runtimeStatusMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(diagnosticsMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(storeBridgeMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(eventBridgeMock.getMetrics).toHaveBeenCalledTimes(1);
    expect(testHarnessMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(devtoolsBridgeMock.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('surfaces transition journal and observed event history without mutating them', () => {
    const facade = buildFacade();

    controllerMock.getTransitionJournal.mockReturnValueOnce([
      {
        at: 1,
        action: 'START_RUN',
        from: 'IDLE',
        to: 'ACTIVE',
      },
    ] as any);

    eventBridgeMock.getObservedHistory.mockReturnValueOnce([
      {
        observedAt: 10,
        scope: 'ALL',
        event: {
          eventType: 'RUN_STARTED',
          payload: { runId: 'run_001' },
          tickIndex: 0,
          timestamp: 10,
        },
      },
    ] as any);

    expect(facade.getTransitionJournal()).toEqual([
      {
        at: 1,
        action: 'START_RUN',
        from: 'IDLE',
        to: 'ACTIVE',
      },
    ]);
    expect(facade.getObservedEvents(32)).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({
          eventType: 'RUN_STARTED',
        }),
      }),
    ]);

    expect(controllerMock.getTransitionJournal).toHaveBeenCalledTimes(1);
    expect(eventBridgeMock.getObservedHistory).toHaveBeenCalledWith(32);
  });

  it('disposes owned bridges and controller cleanly', () => {
    const facade = buildFacade();

    facade.dispose();

    expect(devtoolsBridgeMock.dispose).toHaveBeenCalledTimes(1);
    expect(controllerMock.dispose).toHaveBeenCalledTimes(1);
  });
});