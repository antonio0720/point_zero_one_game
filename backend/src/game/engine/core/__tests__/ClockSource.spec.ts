// pzo-web/src/engines/core/__tests__/ClockSource.spec.ts

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FixedClockSource, WallClockSource } from '../ClockSource';

describe('ClockSource', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WallClockSource', () => {
    it('delegates directly to Date.now() for production wall-clock time', () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_706_000_123_456);

      const clock = new WallClockSource();

      expect(clock.now()).toBe(1_706_000_123_456);
      expect(nowSpy).toHaveBeenCalledTimes(1);
    });

    it('does not memoize values across calls', () => {
      const nowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValueOnce(111)
        .mockReturnValueOnce(222)
        .mockReturnValueOnce(333);

      const clock = new WallClockSource();

      expect(clock.now()).toBe(111);
      expect(clock.now()).toBe(222);
      expect(clock.now()).toBe(333);
      expect(nowSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('FixedClockSource', () => {
    it('uses deterministic defaults: initialMs=0 and tickMs=1000', () => {
      const clock = new FixedClockSource();

      expect(clock.now()).toBe(0);
      expect(clock.now()).toBe(1000);
      expect(clock.now()).toBe(2000);
      expect(clock.now()).toBe(3000);
    });

    it('returns the current value first, then advances by the configured tick size', () => {
      const clock = new FixedClockSource(5_000, 350);

      expect(clock.now()).toBe(5_000);
      expect(clock.now()).toBe(5_350);
      expect(clock.now()).toBe(5_700);
      expect(clock.now()).toBe(6_050);
    });

    it('reset() rewinds the current time without changing the deterministic tick cadence', () => {
      const clock = new FixedClockSource(10_000, 125);

      expect(clock.now()).toBe(10_000);
      expect(clock.now()).toBe(10_125);
      expect(clock.now()).toBe(10_250);

      clock.reset(2_000);

      expect(clock.now()).toBe(2_000);
      expect(clock.now()).toBe(2_125);
      expect(clock.now()).toBe(2_250);
    });

    it('supports zero and negative baselines for replay/test harness edge cases', () => {
      const clock = new FixedClockSource(-500, 50);

      expect(clock.now()).toBe(-500);
      expect(clock.now()).toBe(-450);
      expect(clock.now()).toBe(-400);

      clock.reset(0);

      expect(clock.now()).toBe(0);
      expect(clock.now()).toBe(50);
    });

    it('allows zero tickMs, preserving a frozen deterministic timestamp when desired', () => {
      const clock = new FixedClockSource(42, 0);

      expect(clock.now()).toBe(42);
      expect(clock.now()).toBe(42);
      expect(clock.now()).toBe(42);

      clock.reset(99);

      expect(clock.now()).toBe(99);
      expect(clock.now()).toBe(99);
    });
  });
});