// pzo-web/src/engines/zero/__tests__/ZeroDiagnostics.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

type EventEnvelope = {
  eventType: string;
  payload?: unknown;
  tickIndex?: number;
  timestamp?: number;
  sourceEngine?: string;
};

function createEventBusMock() {
  const handlers = new Map<string, Set<(event: EventEnvelope) => void>>();

  return {
    on: vi.fn((eventType: string, handler: (event: EventEnvelope) => void) => {
      if (!handlers.has(eventType)) {
        handlers.set(eventType, new Set());
      }
      handlers.get(eventType)!.add(handler);

      return () => {
        handlers.get(eventType)?.delete(handler);
      };
    }),
    emitTo(eventType: string, payload?: unknown, meta?: Partial<EventEnvelope>) {
      for (const handler of handlers.get(eventType) ?? []) {
        handler({
          eventType,
          payload,
          tickIndex: meta?.tickIndex ?? 0,
          timestamp: meta?.timestamp ?? Date.now(),
          sourceEngine: meta?.sourceEngine,
        });
      }
    },
    getHandlerCount(eventType: string) {
      return handlers.get(eventType)?.size ?? 0;
    },
  };
}

function createControllerMock() {
  const orchestrator = {
    getLifecycleState: vi.fn(() => 'ACTIVE'),
    isRunActive: vi.fn(() => true),
    getHealthReport: vi.fn(() => ({
      TIME_ENGINE: 'INITIALIZED',
      PRESSURE_ENGINE: 'INITIALIZED',
      TENSION_ENGINE: 'INITIALIZED',
      SHIELD_ENGINE: 'INITIALIZED',
      BATTLE_ENGINE: 'INITIALIZED',
      CASCADE_ENGINE: 'INITIALIZED',
      SOVEREIGNTY_ENGINE: 'INITIALIZED',
      CARD_ENGINE: 'INITIALIZED',
    })),
    getCurrentRunId: vi.fn(() => 'run_diag_001'),
  };

  return {
    getOrchestrator: vi.fn(() => orchestrator),
    getLifecycleState: vi.fn(() => 'ACTIVE'),
    isPaused: vi.fn(() => false),
    getCurrentMode: vi.fn(() => 'solo_mode'),
    getPauseState: vi.fn(() => ({
      isPaused: false,
      reason: null,
      resumeCount: 0,
    })),
    getTransitionJournal: vi.fn(() => [
      {
        at: 100,
        action: 'START_RUN',
        from: 'IDLE',
        to: 'ACTIVE',
      },
    ]),
  };
}

function createRuntimeStatusMock() {
  return {
    getSnapshot: vi.fn(() => ({
      lifecycleState: 'ACTIVE',
      mode: 'solo_mode',
      freedomThreshold: 1_000_000,
      runId: 'run_diag_001',
      isPaused: false,
    })),
  };
}

function createStoreBridgeMock() {
  return {
    getSnapshot: vi.fn(() => ({
      generatedAt: 999,
      isBound: true,
      engineHandlersWired: true,
      runMirrorWired: true,
      eventBusPendingCount: 0,
      eventBusIsFlushing: false,
      registeredChannels: ['RUN_STARTED', 'RUN_ENDED', 'TICK_COMPLETE'],
      lastRunMirrorSyncAt: 888,
      lastRunMirrorSnapshot: {
        runId: 'run_diag_001',
        userId: 'user_diag_001',
        netWorth: 250_000,
        cashBalance: 30_500,
      },
    })),
  };
}

function createEventBridgeMock() {
  return {
    getMetrics: vi.fn(() => ({
      totalObserved: 4,
      byEventType: {
        RUN_STARTED: 1,
        TICK_COMPLETE: 2,
        TICK_STEP_ERROR: 1,
      },
      bySourceEngine: {
        UNKNOWN: 1,
        TIME_ENGINE: 2,
        SHIELD_ENGINE: 1,
      },
      lastObservedAt: 404,
    })),
    getObservedHistory: vi.fn(() => [
      {
        observedAt: 401,
        scope: 'ALL',
        event: {
          eventType: 'RUN_STARTED',
          tickIndex: 0,
        },
      },
      {
        observedAt: 404,
        scope: 'ALL',
        event: {
          eventType: 'TICK_STEP_ERROR',
          tickIndex: 2,
        },
      },
    ]),
  };
}

const singletonEventBus = createEventBusMock();
const singletonController = createControllerMock();
const singletonRuntimeStatus = createRuntimeStatusMock();
const singletonStoreBridge = createStoreBridgeMock();
const singletonEventBridge = createEventBridgeMock();

vi.mock('../core/EventBus', () => ({
  sharedEventBus: singletonEventBus,
}));

vi.mock('../ZeroLifecycleController', () => ({
  zeroLifecycleController: singletonController,
}));

vi.mock('../ZeroRuntimeStatus', () => ({
  zeroRuntimeStatus: singletonRuntimeStatus,
}));

vi.mock('../ZeroStoreBridge', () => ({
  zeroStoreBridge: singletonStoreBridge,
}));

vi.mock('../ZeroEventBridge', () => ({
  zeroEventBridge: singletonEventBridge,
}));

import { ZeroDiagnostics, zeroDiagnostics } from '../ZeroDiagnostics';

function buildDiagnostics(overrides?: {
  eventBus?: any;
  controller?: any;
  runtimeStatus?: any;
  storeBridge?: any;
  eventBridge?: any;
}) {
  return new ZeroDiagnostics({
    eventBus: overrides?.eventBus ?? createEventBusMock(),
    controller: overrides?.controller ?? createControllerMock(),
    runtimeStatus: overrides?.runtimeStatus ?? createRuntimeStatusMock(),
    storeBridge: overrides?.storeBridge ?? createStoreBridgeMock(),
    eventBridge: overrides?.eventBridge ?? createEventBridgeMock(),
    maxRecentTicks: 4,
    maxRecentStepErrors: 4,
  });
}

describe('ZeroDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a singleton diagnostics instance', () => {
    expect(zeroDiagnostics).toBeInstanceOf(ZeroDiagnostics);
  });

  it('subscribes to tick and error lanes without mutating the repo EventBus contract', () => {
    const bus = createEventBusMock();

    buildDiagnostics({ eventBus: bus as any });

    expect(bus.on).toHaveBeenCalledTimes(4);
    expect(bus.getHandlerCount('RUN_STARTED')).toBe(1);
    expect(bus.getHandlerCount('RUN_ENDED')).toBe(1);
    expect(bus.getHandlerCount('TICK_COMPLETE')).toBe(1);
    expect(bus.getHandlerCount('TICK_STEP_ERROR')).toBe(1);
  });

  it('aggregates controller, orchestrator, runtime-status, store-bridge, and event-bridge state into one snapshot', () => {
    const controller = createControllerMock();
    const runtimeStatus = createRuntimeStatusMock();
    const storeBridge = createStoreBridgeMock();
    const eventBridge = createEventBridgeMock();

    const diagnostics = buildDiagnostics({
      controller: controller as any,
      runtimeStatus: runtimeStatus as any,
      storeBridge: storeBridge as any,
      eventBridge: eventBridge as any,
    });

    const snapshot = diagnostics.getSnapshot();

    expect(snapshot).toEqual({
      runtime: {
        lifecycleState: 'ACTIVE',
        isRunActive: true,
        currentRunId: 'run_diag_001',
        currentMode: 'solo_mode',
        isPaused: false,
        pauseState: {
          isPaused: false,
          reason: null,
          resumeCount: 0,
        },
        healthReport: {
          TIME_ENGINE: 'INITIALIZED',
          PRESSURE_ENGINE: 'INITIALIZED',
          TENSION_ENGINE: 'INITIALIZED',
          SHIELD_ENGINE: 'INITIALIZED',
          BATTLE_ENGINE: 'INITIALIZED',
          CASCADE_ENGINE: 'INITIALIZED',
          SOVEREIGNTY_ENGINE: 'INITIALIZED',
          CARD_ENGINE: 'INITIALIZED',
        },
        runtimeStatus: {
          lifecycleState: 'ACTIVE',
          mode: 'solo_mode',
          freedomThreshold: 1_000_000,
          runId: 'run_diag_001',
          isPaused: false,
        },
        storeBridge: expect.objectContaining({
          isBound: true,
          engineHandlersWired: true,
          runMirrorWired: true,
          lastRunMirrorSnapshot: expect.objectContaining({
            netWorth: 250_000,
            cashBalance: 30_500,
          }),
        }),
        eventMetrics: {
          totalObserved: 4,
          byEventType: {
            RUN_STARTED: 1,
            TICK_COMPLETE: 2,
            TICK_STEP_ERROR: 1,
          },
          bySourceEngine: {
            UNKNOWN: 1,
            TIME_ENGINE: 2,
            SHIELD_ENGINE: 1,
          },
          lastObservedAt: 404,
        },
        transitionJournal: [
          {
            at: 100,
            action: 'START_RUN',
            from: 'IDLE',
            to: 'ACTIVE',
          },
        ],
      },
      recentTicks: [],
      recentStepErrors: [],
    });
  });

  it('records tick-complete history in arrival order and caps it at the configured max', () => {
    const bus = createEventBusMock();
    const diagnostics = new ZeroDiagnostics({
      eventBus: bus as any,
      controller: createControllerMock() as any,
      runtimeStatus: createRuntimeStatusMock() as any,
      storeBridge: createStoreBridgeMock() as any,
      eventBridge: createEventBridgeMock() as any,
      maxRecentTicks: 3,
      maxRecentStepErrors: 3,
    });

    bus.emitTo('TICK_COMPLETE', { tickIndex: 1, tickDurationMs: 80, outcome: null }, { tickIndex: 1, timestamp: 101 });
    bus.emitTo('TICK_COMPLETE', { tickIndex: 2, tickDurationMs: 81, outcome: null }, { tickIndex: 2, timestamp: 102 });
    bus.emitTo('TICK_COMPLETE', { tickIndex: 3, tickDurationMs: 82, outcome: null }, { tickIndex: 3, timestamp: 103 });
    bus.emitTo('TICK_COMPLETE', { tickIndex: 4, tickDurationMs: 83, outcome: 'FREEDOM' }, { tickIndex: 4, timestamp: 104 });

    expect(diagnostics.getSnapshot().recentTicks).toEqual([
      {
        observedAt: 102,
        tickIndex: 2,
        tickDurationMs: 81,
        outcome: null,
      },
      {
        observedAt: 103,
        tickIndex: 3,
        tickDurationMs: 82,
        outcome: null,
      },
      {
        observedAt: 104,
        tickIndex: 4,
        tickDurationMs: 83,
        outcome: 'FREEDOM',
      },
    ]);
  });

  it('records step-error history with engine attribution and preserves later ticks', () => {
    const bus = createEventBusMock();
    const diagnostics = buildDiagnostics({ eventBus: bus as any });

    bus.emitTo(
      'TICK_STEP_ERROR',
      { step: 4, engineId: 'SHIELD_ENGINE', error: 'shield failure' },
      { tickIndex: 7, timestamp: 700, sourceEngine: 'SHIELD_ENGINE' },
    );
    bus.emitTo(
      'TICK_STEP_ERROR',
      { step: 10, engineId: 'PRESSURE_ENGINE', error: 'pressure recompute failure' },
      { tickIndex: 8, timestamp: 800, sourceEngine: 'PRESSURE_ENGINE' },
    );
    bus.emitTo(
      'TICK_COMPLETE',
      { tickIndex: 8, tickDurationMs: 99, outcome: null },
      { tickIndex: 8, timestamp: 801, sourceEngine: 'TIME_ENGINE' },
    );

    const snapshot = diagnostics.getSnapshot();

    expect(snapshot.recentStepErrors).toEqual([
      {
        observedAt: 700,
        tickIndex: 7,
        step: 4,
        engineId: 'SHIELD_ENGINE',
        error: 'shield failure',
        sourceEngine: 'SHIELD_ENGINE',
      },
      {
        observedAt: 800,
        tickIndex: 8,
        step: 10,
        engineId: 'PRESSURE_ENGINE',
        error: 'pressure recompute failure',
        sourceEngine: 'PRESSURE_ENGINE',
      },
    ]);
    expect(snapshot.recentTicks).toEqual([
      {
        observedAt: 801,
        tickIndex: 8,
        tickDurationMs: 99,
        outcome: null,
      },
    ]);
  });

  it('updates lifecycle-only journals from RUN_STARTED and RUN_ENDED for timeline completeness', () => {
    const bus = createEventBusMock();
    const diagnostics = buildDiagnostics({ eventBus: bus as any });

    bus.emitTo('RUN_STARTED', { runId: 'run_diag_002', userId: 'user_diag_002' }, { tickIndex: 0, timestamp: 1 });
    bus.emitTo('RUN_ENDED', { runId: 'run_diag_002', outcome: 'BANKRUPT' }, { tickIndex: 12, timestamp: 2 });

    expect(diagnostics.getLifecycleJournal()).toEqual([
      {
        observedAt: 1,
        eventType: 'RUN_STARTED',
        tickIndex: 0,
        payload: {
          runId: 'run_diag_002',
          userId: 'user_diag_002',
        },
      },
      {
        observedAt: 2,
        eventType: 'RUN_ENDED',
        tickIndex: 12,
        payload: {
          runId: 'run_diag_002',
          outcome: 'BANKRUPT',
        },
      },
    ]);
  });

  it('clears local journals without mutating collaborator-owned runtime surfaces', () => {
    const bus = createEventBusMock();
    const controller = createControllerMock();
    const runtimeStatus = createRuntimeStatusMock();
    const storeBridge = createStoreBridgeMock();
    const eventBridge = createEventBridgeMock();

    const diagnostics = buildDiagnostics({
      eventBus: bus as any,
      controller: controller as any,
      runtimeStatus: runtimeStatus as any,
      storeBridge: storeBridge as any,
      eventBridge: eventBridge as any,
    });

    bus.emitTo(
      'TICK_COMPLETE',
      { tickIndex: 3, tickDurationMs: 77, outcome: null },
      { tickIndex: 3, timestamp: 300 },
    );
    bus.emitTo(
      'TICK_STEP_ERROR',
      { step: 2, engineId: 'TIME_ENGINE', error: 'time fault' },
      { tickIndex: 3, timestamp: 301, sourceEngine: 'TIME_ENGINE' },
    );

    expect(diagnostics.getSnapshot().recentTicks).toHaveLength(1);
    expect(diagnostics.getSnapshot().recentStepErrors).toHaveLength(1);

    diagnostics.clearJournals();

    const snapshot = diagnostics.getSnapshot();

    expect(snapshot.recentTicks).toEqual([]);
    expect(snapshot.recentStepErrors).toEqual([]);
    expect(snapshot.runtime.currentRunId).toBe('run_diag_001');
    expect(controller.getOrchestrator).toHaveBeenCalled();
    expect(runtimeStatus.getSnapshot).toHaveBeenCalled();
    expect(storeBridge.getSnapshot).toHaveBeenCalled();
    expect(eventBridge.getMetrics).toHaveBeenCalled();
  });

  it('dispose() removes EventBus subscriptions for clean singleton teardown', () => {
    const bus = createEventBusMock();
    const diagnostics = buildDiagnostics({ eventBus: bus as any });

    expect(bus.getHandlerCount('TICK_COMPLETE')).toBe(1);
    expect(bus.getHandlerCount('TICK_STEP_ERROR')).toBe(1);

    diagnostics.dispose();

    expect(bus.getHandlerCount('RUN_STARTED')).toBe(0);
    expect(bus.getHandlerCount('RUN_ENDED')).toBe(0);
    expect(bus.getHandlerCount('TICK_COMPLETE')).toBe(0);
    expect(bus.getHandlerCount('TICK_STEP_ERROR')).toBe(0);
  });
});