// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/__tests__/moment-bridge.test.ts

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

type HostMomentPayload = {
  code: string | undefined;
  tick: number;
  player: string;
};

type MomentBridgeInstance = {
  on: (
    event: 'host_moment_fired',
    listener: (payload: HostMomentPayload) => void,
  ) => unknown;
  listenToGameEngineEvent: (
    event: string,
    tick: number,
    player: string,
  ) => void;
};

type MomentBridgeConstructor = new () => MomentBridgeInstance;

describe('MomentBridge', () => {
  let MomentBridge: MomentBridgeConstructor;

  beforeEach(async () => {
    vi.resetModules();

    // The current service imports ./interfaces at runtime.
    // Mock it here so the test stays isolated even if that file is missing or type-only.
    vi.doMock('../services/interfaces', () => ({}));

    ({ default: MomentBridge } = await import('../services/moment-bridge'));
  });

  it.each([
    ['FUBAR_KILLED_ME', 'B01'],
    ['OPPORTUNITY_FLIP', 'A01'],
    ['MISSED_THE_BAG', 'C01'],
  ])('emits host_moment_fired for %s with code %s', (eventCode, expectedCode) => {
    const bridge = new MomentBridge();
    const listener = vi.fn();

    bridge.on('host_moment_fired', listener);
    bridge.listenToGameEngineEvent(eventCode, 12, 'player_01');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      code: expectedCode,
      tick: 12,
      player: 'player_01',
    });
  });

  it('preserves tick and player in the emitted payload', () => {
    const bridge = new MomentBridge();
    const listener = vi.fn();

    bridge.on('host_moment_fired', listener);
    bridge.listenToGameEngineEvent('OPPORTUNITY_FLIP', 987, 'host_alpha');

    expect(listener).toHaveBeenCalledWith({
      code: 'A01',
      tick: 987,
      player: 'host_alpha',
    });
  });

  it('emits an undefined code for an unmapped event in the current implementation', () => {
    const bridge = new MomentBridge();
    const listener = vi.fn();

    bridge.on('host_moment_fired', listener);
    bridge.listenToGameEngineEvent('UNKNOWN_EVENT', 22, 'player_02');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      code: undefined,
      tick: 22,
      player: 'player_02',
    });
  });

  it('notifies multiple listeners for the same mapped event', () => {
    const bridge = new MomentBridge();
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    bridge.on('host_moment_fired', listenerA);
    bridge.on('host_moment_fired', listenerB);

    bridge.listenToGameEngineEvent('MISSED_THE_BAG', 33, 'player_03');

    expect(listenerA).toHaveBeenCalledWith({
      code: 'C01',
      tick: 33,
      player: 'player_03',
    });

    expect(listenerB).toHaveBeenCalledWith({
      code: 'C01',
      tick: 33,
      player: 'player_03',
    });
  });
});