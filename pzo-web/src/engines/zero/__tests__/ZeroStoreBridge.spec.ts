// pzo-web/src/engines/zero/__tests__/ZeroStoreBridge.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

type RunMirrorSnapshot = {
  isInitialized: boolean;
  netWorth: number;
  cashBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  cashflow: number;
  haterHeat: number;
  activeThreatCardCount: number;
  runId: string | null;
  userId: string | null;
  seed: string | null;
  lastUpdated: number | null;
};

const mirrorSnapshotA: RunMirrorSnapshot = {
  isInitialized: true,
  netWorth: 125_000,
  cashBalance: 14_500,
  monthlyIncome: 11_000,
  monthlyExpenses: 5_500,
  cashflow: 5_500,
  haterHeat: 0.22,
  activeThreatCardCount: 2,
  runId: 'run_zero_store_001',
  userId: 'user_zero_store_001',
  seed: 'seed_zero_store_001',
  lastUpdated: 1_700_000_000_001,
};

const mirrorSnapshotB: RunMirrorSnapshot = {
  ...mirrorSnapshotA,
  netWorth: 130_000,
  cashBalance: 16_250,
  haterHeat: 0.31,
  activeThreatCardCount: 3,
  lastUpdated: 1_700_000_000_222,
};

const engineStoreState = {
  resetAllSlices: vi.fn(),
  syncRunMirror: vi.fn(),
};

const useEngineStoreMock = {
  getState: vi.fn(() => engineStoreState),
};

const runStoreState = {
  ...mirrorSnapshotA,
};

const runStoreSubscribeDisposer = vi.fn();

const runStoreMock = {
  getState: vi.fn(() => runStoreState),
  subscribe: vi.fn(() => runStoreSubscribeDisposer),
};

const selectEngineStoreMirrorSnapshotMock = vi.fn(
  (state: typeof runStoreState): RunMirrorSnapshot => ({
    isInitialized: state.isInitialized,
    netWorth: state.netWorth,
    cashBalance: state.cashBalance,
    monthlyIncome: state.monthlyIncome,
    monthlyExpenses: state.monthlyExpenses,
    cashflow: state.cashflow,
    haterHeat: state.haterHeat,
    activeThreatCardCount: state.activeThreatCardCount,
    runId: state.runId,
    userId: state.userId,
    seed: state.seed,
    lastUpdated: state.lastUpdated,
  }),
);

const engineBindingsInstance = {
  bind: vi.fn(),
  dispose: vi.fn(),
  getBindingCount: vi.fn(() => 7),
};

const EngineEventBindingsMock = vi.fn(() => engineBindingsInstance);

const eventBusMock = {
  on: vi.fn(() => () => undefined),
  getPendingCount: vi.fn(() => 0),
  getPendingSnapshot: vi.fn(() => []),
  registerEventChannels: vi.fn(),
  getRegisteredChannels: vi.fn(() => [
    'RUN_STARTED',
    'RUN_ENDED',
    'TICK_COMPLETE',
  ]),
};

vi.mock('../../store/engineStore', () => ({
  useEngineStore: useEngineStoreMock,
}));

vi.mock('../../store/runStore', () => ({
  runStore: runStoreMock,
  selectEngineStoreMirrorSnapshot: selectEngineStoreMirrorSnapshotMock,
}));

vi.mock('../core/EngineEventBindings', () => ({
  EngineEventBindings: EngineEventBindingsMock,
}));

import { ZeroStoreBridge, zeroStoreBridge } from '../ZeroStoreBridge';

function buildBridge() {
  return new ZeroStoreBridge({
    engineStore: useEngineStoreMock as any,
    runStore: runStoreMock as any,
    selectRunMirrorSnapshot: selectEngineStoreMirrorSnapshotMock as any,
    EngineEventBindingsCtor: EngineEventBindingsMock as any,
  });
}

describe('ZeroStoreBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useEngineStoreMock.getState.mockReturnValue(engineStoreState);
    runStoreMock.getState.mockReturnValue(runStoreState);
    runStoreMock.subscribe.mockReturnValue(runStoreSubscribeDisposer);
    selectEngineStoreMirrorSnapshotMock.mockImplementation(
      (state: typeof runStoreState): RunMirrorSnapshot => ({
        isInitialized: state.isInitialized,
        netWorth: state.netWorth,
        cashBalance: state.cashBalance,
        monthlyIncome: state.monthlyIncome,
        monthlyExpenses: state.monthlyExpenses,
        cashflow: state.cashflow,
        haterHeat: state.haterHeat,
        activeThreatCardCount: state.activeThreatCardCount,
        runId: state.runId,
        userId: state.userId,
        seed: state.seed,
        lastUpdated: state.lastUpdated,
      }),
    );
    EngineEventBindingsMock.mockImplementation(() => engineBindingsInstance);

    eventBusMock.getPendingCount.mockReturnValue(0);
    eventBusMock.getPendingSnapshot.mockReturnValue([]);
    eventBusMock.getRegisteredChannels.mockReturnValue([
      'RUN_STARTED',
      'RUN_ENDED',
      'TICK_COMPLETE',
    ]);
  });

  it('exports a singleton bridge instance', () => {
    expect(zeroStoreBridge).toBeInstanceOf(ZeroStoreBridge);
  });

  it('binds engine event handlers and run-store mirror wiring without wiping EventBus subscribers', () => {
    const bridge = buildBridge();

    const binding = bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: true,
      syncRunMirrorImmediately: true,
      eventBindingsOptions: {
        registerChannels: true,
        includeLegacyAliases: true,
        debug: false,
      },
    });

    expect(EngineEventBindingsMock).toHaveBeenCalledWith(eventBusMock, {
      registerChannels: true,
      includeLegacyAliases: true,
      debug: false,
    });
    expect(engineBindingsInstance.bind).toHaveBeenCalledTimes(1);

    expect(engineStoreState.resetAllSlices).toHaveBeenCalledTimes(1);
    expect(selectEngineStoreMirrorSnapshotMock).toHaveBeenCalledWith(runStoreState);
    expect(engineStoreState.syncRunMirror).toHaveBeenCalledWith(mirrorSnapshotA);

    expect(runStoreMock.subscribe).toHaveBeenCalledTimes(1);
    expect(binding).toEqual(
      expect.objectContaining({
        eventBus: eventBusMock,
        engineHandlersWired: true,
        runMirrorWired: true,
      }),
    );
    expect(typeof binding.syncRunMirrorNow).toBe('function');
    expect(typeof binding.getSnapshot).toBe('function');
    expect(typeof binding.dispose).toBe('function');
  });

  it('supports a store-bridge-only bind when engine handler wiring is intentionally disabled', () => {
    const bridge = buildBridge();

    bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: false,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: false,
    });

    expect(EngineEventBindingsMock).not.toHaveBeenCalled();
    expect(engineStoreState.resetAllSlices).not.toHaveBeenCalled();
    expect(engineStoreState.syncRunMirror).not.toHaveBeenCalled();
    expect(runStoreMock.subscribe).toHaveBeenCalledTimes(1);
  });

  it('supports an event-handler-only bind when run-store mirror wiring is intentionally disabled', () => {
    const bridge = buildBridge();

    bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: true,
      wireRunMirror: false,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: false,
    });

    expect(EngineEventBindingsMock).toHaveBeenCalledTimes(1);
    expect(engineBindingsInstance.bind).toHaveBeenCalledTimes(1);
    expect(runStoreMock.subscribe).not.toHaveBeenCalled();
    expect(engineStoreState.syncRunMirror).not.toHaveBeenCalled();
  });

  it('syncs the live run-store mirror into engineStore on demand', () => {
    const bridge = buildBridge();

    bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: false,
      wireRunMirror: false,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: false,
    });

    runStoreMock.getState.mockReturnValueOnce({
      ...runStoreState,
      ...mirrorSnapshotB,
    });

    const synced = bridge.syncRunMirrorNow();

    expect(selectEngineStoreMirrorSnapshotMock).toHaveBeenLastCalledWith({
      ...runStoreState,
      ...mirrorSnapshotB,
    });
    expect(engineStoreState.syncRunMirror).toHaveBeenCalledWith(
      expect.objectContaining({
        netWorth: 130_000,
        cashBalance: 16_250,
        haterHeat: 0.31,
      }),
    );
    expect(synced).toEqual(
      expect.objectContaining({
        netWorth: 130_000,
        cashBalance: 16_250,
        haterHeat: 0.31,
      }),
    );
  });

  it('reuses the existing bind session instead of duplicating subscriptions', () => {
    const bridge = buildBridge();

    bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: false,
    });

    bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: true,
      syncRunMirrorImmediately: true,
    });

    expect(EngineEventBindingsMock).toHaveBeenCalledTimes(1);
    expect(engineBindingsInstance.bind).toHaveBeenCalledTimes(1);
    expect(runStoreMock.subscribe).toHaveBeenCalledTimes(1);
    expect(engineStoreState.resetAllSlices).not.toHaveBeenCalled();
  });

  it('captures a deep operational snapshot for diagnostics and HUD surfaces', () => {
    const bridge = buildBridge();

    bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: true,
    });

    const snapshot = bridge.getSnapshot();

    expect(snapshot).toEqual(
      expect.objectContaining({
        isBound: true,
        engineHandlersWired: true,
        runMirrorWired: true,
        eventBusPendingCount: 0,
        eventBusIsFlushing: false,
        registeredChannels: ['RUN_STARTED', 'RUN_ENDED', 'TICK_COMPLETE'],
        lastRunMirrorSnapshot: expect.objectContaining({
          runId: 'run_zero_store_001',
          userId: 'user_zero_store_001',
          netWorth: 125_000,
        }),
      }),
    );
    expect(typeof snapshot.generatedAt).toBe('number');
    expect(typeof snapshot.lastRunMirrorSyncAt).toBe('number');
  });

  it('derives the flushing flag from either property or getter-style event bus surfaces', () => {
    const bridge = buildBridge();

    const flushingBus = {
      ...eventBusMock,
      isCurrentlyFlushing: true,
      getRegisteredChannels: vi.fn(() => ['RUN_STARTED']),
    };

    bridge.bind({
      eventBus: flushingBus as any,
      wireEngineHandlers: false,
      wireRunMirror: false,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: false,
    });

    expect(bridge.getSnapshot()).toEqual(
      expect.objectContaining({
        eventBusIsFlushing: true,
        registeredChannels: ['RUN_STARTED'],
      }),
    );
  });

  it('disposes event bindings and run-store subscriptions cleanly', () => {
    const bridge = buildBridge();

    bridge.bind({
      eventBus: eventBusMock as any,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: false,
    });

    bridge.dispose();

    expect(engineBindingsInstance.dispose).toHaveBeenCalledTimes(1);
    expect(runStoreSubscribeDisposer).toHaveBeenCalledTimes(1);

    expect(bridge.getSnapshot()).toEqual(
      expect.objectContaining({
        isBound: false,
        engineHandlersWired: false,
        runMirrorWired: false,
      }),
    );
  });
});