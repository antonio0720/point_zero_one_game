// pzo-web/src/engines/zero/__tests__/ZeroBindings.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharedEventBusMock = {
  on: vi.fn(() => () => undefined),
  getPendingCount: vi.fn(() => 0),
};

const controllerMock = {
  setMode: vi.fn(),
  getCurrentMode: vi.fn(() => null),
};

const storeBridgeMock = {
  bind: vi.fn(() => ({
    eventBus: sharedEventBusMock,
    engineHandlersWired: true,
    runMirrorWired: true,
    syncRunMirrorNow: vi.fn(),
    getSnapshot: vi.fn(),
    dispose: vi.fn(),
  })),
  syncRunMirrorNow: vi.fn(),
  getSnapshot: vi.fn(() => ({
    generatedAt: Date.now(),
    isBound: true,
    eventBusPendingCount: 0,
    eventBusIsFlushing: false,
    registeredChannels: [],
  })),
  dispose: vi.fn(),
};

const runtimeStatusMock = {
  setMode: vi.fn(),
  getSnapshot: vi.fn(() => ({
    lifecycleState: 'IDLE',
    mode: null,
    freedomThreshold: 0,
  })),
};

vi.mock('../core/EventBus', () => ({
  EventBus: vi.fn(),
  sharedEventBus: sharedEventBusMock,
}));

vi.mock('../ZeroLifecycleController', () => ({
  ZeroLifecycleController: vi.fn(),
  zeroLifecycleController: controllerMock,
}));

vi.mock('../ZeroStoreBridge', () => ({
  ZeroStoreBridge: vi.fn(),
  zeroStoreBridge: storeBridgeMock,
}));

vi.mock('../ZeroRuntimeStatus', () => ({
  ZeroRuntimeStatus: vi.fn(),
  zeroRuntimeStatus: runtimeStatusMock,
}));

import { ZeroBindings, zeroBindings } from '../ZeroBindings';

function buildBindings() {
  return new ZeroBindings({
    controller: controllerMock as any,
    storeBridge: storeBridgeMock as any,
    runtimeStatus: runtimeStatusMock as any,
    eventBus: sharedEventBusMock as any,
    initialMode: null,
    initialModeOverrides: {},
  });
}

describe('ZeroBindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    controllerMock.getCurrentMode.mockReturnValue(null);

    storeBridgeMock.bind.mockReturnValue({
      eventBus: sharedEventBusMock,
      engineHandlersWired: true,
      runMirrorWired: true,
      syncRunMirrorNow: vi.fn(),
      getSnapshot: vi.fn(),
      dispose: vi.fn(),
    } as any);

    storeBridgeMock.getSnapshot.mockReturnValue({
      generatedAt: Date.now(),
      isBound: true,
      eventBusPendingCount: 0,
      eventBusIsFlushing: false,
      registeredChannels: [],
    });

    runtimeStatusMock.getSnapshot.mockReturnValue({
      lifecycleState: 'IDLE',
      mode: null,
      freedomThreshold: 0,
    });
  });

  it('exports a singleton bindings instance', () => {
    expect(zeroBindings).toBeInstanceOf(ZeroBindings);
  });

  it('binds the repo-native store bridge against the shared event bus', () => {
    const bindings = buildBindings();

    const result = bindings.bind({
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: true,
    } as any);

    expect(storeBridgeMock.bind).toHaveBeenCalledWith({
      eventBus: sharedEventBusMock,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        eventBus: sharedEventBusMock,
        engineHandlersWired: true,
        runMirrorWired: true,
      }),
    );
    expect(bindings.isBound()).toBe(true);
  });

  it('tracks mode state locally and propagates it to controller/runtime status', () => {
    const bindings = buildBindings();

    bindings.setMode('household_mode' as any, {
      householdSize: 4,
      volatility: 'high',
    });

    expect(bindings.getCurrentMode()).toBe('household_mode');
    expect(bindings.getCurrentModeOverrides()).toEqual({
      householdSize: 4,
      volatility: 'high',
    });

    expect(controllerMock.setMode).toHaveBeenCalledWith('household_mode', {
      householdSize: 4,
      volatility: 'high',
    });
    expect(runtimeStatusMock.setMode).toHaveBeenCalledWith('household_mode', {
      householdSize: 4,
      volatility: 'high',
    });
  });

  it('supports clearing mode state back to the neutral lane', () => {
    const bindings = buildBindings();

    bindings.setMode('solo_mode' as any, { difficulty: 'hard' });
    bindings.clearMode();

    expect(bindings.getCurrentMode()).toBe(null);
    expect(bindings.getCurrentModeOverrides()).toEqual({});
    expect(controllerMock.setMode).toHaveBeenLastCalledWith(null, {});
    expect(runtimeStatusMock.setMode).toHaveBeenLastCalledWith(null, {});
  });

  it('syncs the run-store mirror through the canonical store bridge', () => {
    const bindings = buildBindings();

    bindings.syncRunMirrorNow();

    expect(storeBridgeMock.syncRunMirrorNow).toHaveBeenCalledTimes(1);
  });

  it('builds a deep snapshot from bindings state, store bridge, and runtime status', () => {
    const bindings = buildBindings();

    bindings.bind({ syncRunMirrorImmediately: false } as any);
    bindings.setMode('team_up_mode' as any, { teammates: 2 });

    const snapshot = bindings.getSnapshot();

    expect(snapshot).toEqual({
      isBound: true,
      currentMode: 'team_up_mode',
      currentModeOverrides: { teammates: 2 },
      eventBus: sharedEventBusMock,
      storeBridge: expect.objectContaining({
        isBound: true,
        eventBusPendingCount: 0,
      }),
      runtimeStatus: {
        lifecycleState: 'IDLE',
        mode: null,
        freedomThreshold: 0,
      },
    });

    expect(storeBridgeMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(runtimeStatusMock.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('can be constructed with an initial mode and immediately reflects that mode in snapshots', () => {
    const bindings = new ZeroBindings({
      controller: controllerMock as any,
      storeBridge: storeBridgeMock as any,
      runtimeStatus: runtimeStatusMock as any,
      eventBus: sharedEventBusMock as any,
      initialMode: 'head_to_head_mode' as any,
      initialModeOverrides: { rivalTier: 'elite' },
    });

    expect(bindings.getCurrentMode()).toBe('head_to_head_mode');
    expect(bindings.getCurrentModeOverrides()).toEqual({
      rivalTier: 'elite',
    });
  });

  it('disposes through the store-bridge lane only', () => {
    const bindings = buildBindings();

    bindings.dispose();

    expect(storeBridgeMock.dispose).toHaveBeenCalledTimes(1);
  });
});