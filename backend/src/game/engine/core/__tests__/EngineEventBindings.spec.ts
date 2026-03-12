// pzo-web/src/engines/core/__tests__/EngineEventBindings.spec.ts

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

const mocked = vi.hoisted(() => {
  const state: {
    __calls: Array<{ handler: string; args: unknown[] }>;
  } = {
    __calls: [],
  };

  const pushCall = (handler: string, ...args: unknown[]) => {
    state.__calls.push({ handler, args });
  };

  const handlers = {
    onRunStartedDraft: vi.fn((draft: unknown, tickBudget: unknown) => {
      pushCall('onRunStartedDraft', draft, tickBudget);
    }),
    onRunEndedDraft: vi.fn((draft: unknown) => {
      pushCall('onRunEndedDraft', draft);
    }),
    onTickTierChangedDraft: vi.fn((draft: unknown, payload: unknown) => {
      pushCall('onTickTierChangedDraft', draft, payload);
    }),
    onTickTierForcedDraft: vi.fn((draft: unknown, payload: unknown) => {
      pushCall('onTickTierForcedDraft', draft, payload);
    }),
    onTickCompleteDraft: vi.fn((draft: unknown, payload: unknown) => {
      pushCall('onTickCompleteDraft', draft, payload);
    }),
    onDecisionWindowOpenedDraft: vi.fn((draft: unknown, payload: unknown) => {
      pushCall('onDecisionWindowOpenedDraft', draft, payload);
    }),
    onDecisionWindowClosedDraft: vi.fn((draft: unknown, identifier: unknown) => {
      pushCall('onDecisionWindowClosedDraft', draft, identifier);
    }),
    onDecisionWindowResolvedDraft: vi.fn((draft: unknown, identifier: unknown) => {
      pushCall('onDecisionWindowResolvedDraft', draft, identifier);
    }),
    onDecisionWindowExpiredDraft: vi.fn((draft: unknown, identifier: unknown) => {
      pushCall('onDecisionWindowExpiredDraft', draft, identifier);
    }),
    onDecisionWindowTickDraft: vi.fn((draft: unknown, payload: unknown) => {
      pushCall('onDecisionWindowTickDraft', draft, payload);
    }),
    onHoldUsedDraft: vi.fn((draft: unknown, payload: unknown) => {
      pushCall('onHoldUsedDraft', draft, payload);
    }),
    onHoldReleasedDraft: vi.fn((draft: unknown, identifier: unknown) => {
      pushCall('onHoldReleasedDraft', draft, identifier);
    }),
    onSeasonTimeoutImminentDraft: vi.fn((draft: unknown, payload: unknown) => {
      pushCall('onSeasonTimeoutImminentDraft', draft, payload);
    }),
  };

  const setState = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      (updater as (draft: typeof state) => void)(state);
    }
    return state;
  });

  return {
    state,
    setState,
    handlers,
  };
});

vi.mock('../../../store/engineStore', () => ({
  useEngineStore: {
    setState: mocked.setState,
  },
}));

vi.mock('../../../store/slices/timeSlice', () => ({
  timeStoreHandlers: mocked.handlers,
}));

import { EngineEventBindings, bindEngineEvents } from '../EngineEventBindings';

type BoundHandler = (event: unknown) => void;

class SubscribeSurfaceBus {
  public readonly registerEventChannels = vi.fn();
  public readonly subscribe = vi.fn((eventName: string, handler: BoundHandler) => {
    let set = this.listeners.get(eventName);
    if (!set) {
      set = new Set();
      this.listeners.set(eventName, set);
    }
    set.add(handler);

    return () => {
      this.listeners.get(eventName)?.delete(handler);
    };
  });

  private readonly listeners = new Map<string, Set<BoundHandler>>();

  public emit(eventName: string, payloadOrEnvelope: unknown): void {
    for (const handler of this.listeners.get(eventName) ?? []) {
      handler(payloadOrEnvelope);
    }
  }

  public listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }
}

class OnOffSurfaceBus {
  public readonly registerEventChannels = vi.fn();
  public readonly on = vi.fn((eventName: string, handler: BoundHandler) => {
    let set = this.listeners.get(eventName);
    if (!set) {
      set = new Set();
      this.listeners.set(eventName, set);
    }
    set.add(handler);
  });

  public readonly off = vi.fn((eventName: string, handler: BoundHandler) => {
    this.listeners.get(eventName)?.delete(handler);
  });

  private readonly listeners = new Map<string, Set<BoundHandler>>();

  public emit(eventName: string, payloadOrEnvelope: unknown): void {
    for (const handler of this.listeners.get(eventName) ?? []) {
      handler(payloadOrEnvelope);
    }
  }
}

class RegisterSurfaceBus {
  public readonly registerEventChannels = vi.fn();
  public readonly register = vi.fn((eventName: string, handler: BoundHandler) => {
    let set = this.listeners.get(eventName);
    if (!set) {
      set = new Set();
      this.listeners.set(eventName, set);
    }
    set.add(handler);
  });

  public readonly unregister = vi.fn((eventName: string, handler: BoundHandler) => {
    this.listeners.get(eventName)?.delete(handler);
  });

  private readonly listeners = new Map<string, Set<BoundHandler>>();

  public emit(eventName: string, payloadOrEnvelope: unknown): void {
    for (const handler of this.listeners.get(eventName) ?? []) {
      handler(payloadOrEnvelope);
    }
  }
}

describe('EngineEventBindings', () => {
  beforeEach(() => {
    mocked.state.__calls.length = 0;
    mocked.setState.mockClear();

    Object.values(mocked.handlers).forEach((spy) => {
      spy.mockClear();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bindEngineEvents() registers the canonical channels and binds exactly once on the subscribe() surface', () => {
    const bus = new SubscribeSurfaceBus();

    const bindings = bindEngineEvents(bus as never);

    expect(bus.registerEventChannels).toHaveBeenCalledTimes(1);

    const registeredChannels = bus.registerEventChannels.mock.calls[0]?.[0] ?? [];
    const registeredNames = registeredChannels.map((channel: { name: string }) => channel.name);

    expect(registeredNames).toEqual(
      expect.arrayContaining([
        'RUN_STARTED',
        'RUN_ENDED',
        'TICK_COMPLETE',
        'TICK_TIER_CHANGED',
        'TIME_TIER_CHANGED',
        'CARD_WINDOW_OPENED',
        'CARD_WINDOW_CLOSED',
        'CARD_WINDOW_EXPIRED',
        'CARD_HOLD_PLACED',
        'CARD_HOLD_RELEASED',
        'TIME_BUDGET_WARNING',
      ]),
    );

    expect(bindings.getBindingCount()).toBe(23);

    bindings.bind();

    expect(bus.registerEventChannels).toHaveBeenCalledTimes(1);
    expect(bindings.getBindingCount()).toBe(23);
  });

  it('routes canonical lifecycle and time events into the store draft handlers', () => {
    const bus = new SubscribeSurfaceBus();
    const bindings = new EngineEventBindings(bus as never, {
      registerChannels: false,
      includeLegacyAliases: false,
    });

    bindings.bind();

    bus.emit('RUN_STARTED', { payload: { seasonTickBudget: 48 } });
    bus.emit('TICK_TIER_CHANGED', {
      payload: { from: 'T1', to: 'T3', transitionTicks: 2 },
    });
    bus.emit('TICK_TIER_FORCED', {
      payload: { tier: 'T4', durationTicks: 3, newDurationMs: 350 },
    });
    bus.emit('TICK_COMPLETE', {
      payload: { tickIndex: 7, tickDurationMs: 600, outcome: null },
    });
    bus.emit('RUN_ENDED', { payload: { outcome: 'TIMEOUT' } });

    expect(mocked.handlers.onRunStartedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onRunStartedDraft).toHaveBeenCalledWith(mocked.state, 48);

    expect(mocked.handlers.onTickTierChangedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onTickTierChangedDraft).toHaveBeenCalledWith(
      mocked.state,
      expect.objectContaining({ from: 'T1', to: 'T3', transitionTicks: 2 }),
    );

    expect(mocked.handlers.onTickTierForcedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onTickTierForcedDraft).toHaveBeenCalledWith(
      mocked.state,
      expect.objectContaining({ tier: 'T4', durationTicks: 3, newDurationMs: 350 }),
    );

    expect(mocked.handlers.onTickCompleteDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onTickCompleteDraft).toHaveBeenCalledWith(
      mocked.state,
      expect.objectContaining({ tickIndex: 7, tickDurationMs: 600, outcome: null }),
    );

    expect(mocked.handlers.onRunEndedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onRunEndedDraft).toHaveBeenCalledWith(mocked.state);

    expect(mocked.setState).toHaveBeenCalledTimes(5);
  });

  it('routes legacy aliases and mixed envelope shapes into the same deterministic store lane', () => {
    const bus = new SubscribeSurfaceBus();
    const bindings = new EngineEventBindings(bus as never, {
      registerChannels: false,
      includeLegacyAliases: true,
    });

    bindings.bind();

    bus.emit('decision:window_opened', { payload: { cardId: 'card_01', durationMs: 5000 } });
    bus.emit('decision:window_closed', { payload: { windowId: 'window_01' } });
    bus.emit('DECISION_WINDOW_RESOLVED', { payload: { cardId: 'card_01' } });
    bus.emit('CARD_WINDOW_EXPIRED', { payload: { cardId: 'card_02' } });
    bus.emit('DECISION_WINDOW_EXPIRED', { payload: { windowId: 'window_03' } });
    bus.emit('decision:resolved', { payload: { windowId: 'window_04' } });
    bus.emit('decision:expired', { payload: { cardId: 'card_05' } });
    bus.emit('decision:countdown_tick', { payload: { cardId: 'card_06', remainingMs: 1200 } });
    bus.emit('TIME_HOLD_USED', { cardId: 'card_07', holdId: 'hold_01' });
    bus.emit('CARD_HOLD_RELEASED', { payload: { windowId: 'window_08' } });
    bus.emit('TIME_BUDGET_WARNING', { payload: { ticksUntilTimeout: 3 } });
    bus.emit('SEASON_TIMEOUT', null);
    bus.emit('TIME_ENGINE_COMPLETE', null);

    expect(mocked.handlers.onDecisionWindowOpenedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onDecisionWindowOpenedDraft).toHaveBeenCalledWith(
      mocked.state,
      expect.objectContaining({ cardId: 'card_01', durationMs: 5000 }),
    );

    expect(mocked.handlers.onDecisionWindowClosedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onDecisionWindowClosedDraft).toHaveBeenCalledWith(
      mocked.state,
      'window_01',
    );

    expect(mocked.handlers.onDecisionWindowResolvedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onDecisionWindowResolvedDraft).toHaveBeenCalledWith(
      mocked.state,
      'card_01',
    );

    expect(mocked.handlers.onDecisionWindowExpiredDraft).toHaveBeenCalledTimes(4);
    expect(mocked.handlers.onDecisionWindowTickDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onDecisionWindowTickDraft).toHaveBeenCalledWith(
      mocked.state,
      expect.objectContaining({ cardId: 'card_06', remainingMs: 1200 }),
    );

    expect(mocked.handlers.onHoldUsedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onHoldUsedDraft).toHaveBeenCalledWith(
      mocked.state,
      expect.objectContaining({ cardId: 'card_07', holdId: 'hold_01' }),
    );

    expect(mocked.handlers.onHoldReleasedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onHoldReleasedDraft).toHaveBeenCalledWith(
      mocked.state,
      'window_08',
    );

    expect(mocked.handlers.onSeasonTimeoutImminentDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onSeasonTimeoutImminentDraft).toHaveBeenCalledWith(
      mocked.state,
      { ticksRemaining: 3 },
    );

    expect(mocked.handlers.onRunEndedDraft).toHaveBeenCalledTimes(2);
  });

  it('warns on malformed payloads in debug mode and refuses to dispatch shallow time handlers', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bus = new SubscribeSurfaceBus();
    const bindings = new EngineEventBindings(bus as never, {
      registerChannels: false,
      includeLegacyAliases: false,
      debug: true,
    });

    bindings.bind();

    bus.emit('CARD_WINDOW_OPENED', { payload: { cardId: 'card_missing_duration' } });
    bus.emit('TICK_TIER_FORCED', { payload: { durationTicks: 2 } });
    bus.emit('CARD_WINDOW_CLOSED', { payload: {} });

    expect(mocked.handlers.onDecisionWindowOpenedDraft).not.toHaveBeenCalled();
    expect(mocked.handlers.onTickTierForcedDraft).not.toHaveBeenCalled();
    expect(mocked.handlers.onDecisionWindowClosedDraft).not.toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Decision window open payload malformed');
    expect(warnSpy.mock.calls[1]?.[0]).toContain('TICK_TIER_FORCED payload missing tier');
    expect(warnSpy.mock.calls[2]?.[0]).toContain('Decision window close payload missing identifier');
  });

  it('dispose() tears down the subscribe() bindings so post-dispose events cannot mutate store state', () => {
    const bus = new SubscribeSurfaceBus();
    const bindings = new EngineEventBindings(bus as never);

    bindings.bind();
    expect(bindings.getBindingCount()).toBe(23);

    bindings.dispose();

    expect(bindings.getBindingCount()).toBe(0);

    bus.emit('RUN_STARTED', { payload: { tickBudget: 99 } });
    bus.emit('TICK_TIER_CHANGED', { payload: { from: 'T0', to: 'T1' } });
    bus.emit('CARD_WINDOW_OPENED', { payload: { cardId: 'card_99', durationMs: 5000 } });

    expect(mocked.handlers.onRunStartedDraft).not.toHaveBeenCalled();
    expect(mocked.handlers.onTickTierChangedDraft).not.toHaveBeenCalled();
    expect(mocked.handlers.onDecisionWindowOpenedDraft).not.toHaveBeenCalled();
  });

  it('falls back to on()/off() when subscribe() is not available', () => {
    const bus = new OnOffSurfaceBus();
    const bindings = new EngineEventBindings(bus as never, {
      registerChannels: false,
      includeLegacyAliases: false,
    });

    bindings.bind();

    expect(bus.on).toHaveBeenCalledTimes(14);
    expect(bindings.getBindingCount()).toBe(14);

    bus.emit('RUN_STARTED', { payload: { tickBudget: 21 } });

    expect(mocked.handlers.onRunStartedDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onRunStartedDraft).toHaveBeenCalledWith(mocked.state, 21);

    bindings.dispose();

    expect(bus.off).toHaveBeenCalledTimes(14);
  });

  it('falls back to register()/unregister() when neither subscribe() nor on() exists', () => {
    const bus = new RegisterSurfaceBus();
    const bindings = new EngineEventBindings(bus as never, {
      registerChannels: false,
      includeLegacyAliases: false,
    });

    bindings.bind();

    expect(bus.register).toHaveBeenCalledTimes(14);

    bus.emit('TIME_BUDGET_WARNING', { payload: { ticksRemaining: 2 } });

    expect(mocked.handlers.onSeasonTimeoutImminentDraft).toHaveBeenCalledTimes(1);
    expect(mocked.handlers.onSeasonTimeoutImminentDraft).toHaveBeenCalledWith(
      mocked.state,
      { ticksRemaining: 2 },
    );

    bindings.dispose();

    expect(bus.unregister).toHaveBeenCalledTimes(14);
  });
});