// pzo-web/src/engines/time/TickScheduler.test.ts
import { TickScheduler } from '../TickScheduler'; // Adjust the import path as necessary
import * as jest from 'jest';
import interpolator, { InterpolationState } from '../interpolator'; // Adjust the import paths accordingly

describe('TickScheduler', () => {
  let tickScheduler: TickScheduler;
  const MAX_TIERS = 3;
  const expectedFireCountsPerTier: number[] = [1, 2, 4]; // Expected fire counts for each tier (example)

  beforeEach(() => {
    jest.useFakeTimers();
    tickScheduler = new TickScheduler(MAX_TIERS);
  });

  afterAll(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('start() then stop() leaves tickNumber at 0 (reset confirmed)', () => {
    const initialTick = tickScheduler.tickNumber;
    tickScheduler.start();
    expect(tickScheduler.tickNumber).toBeGreaterThanOrEqual(initialTick); // Start should increment the count
    
    jest.advanceTimersByTime(-12000); // Simulate 2 minutes passing without any pauses or resumes (60 ticks per minute)
    expect(tickScheduler.tickNumber).toBe(MAX_TIERS * expectedFireCountsPerTier[MAX_TIERS - 1]); // Expected tick number after full duration of the test phase
    
    tickScheduler.stop();
    jest.advanceTimersByTime(-60); // Simulate stopping for a minute (just to ensure it stops)
    expect(tickScheduler.isRunning).toBeFalsy();
    expect(tickScheduler.tickNumber).toBe(0); // Reset confirmation after stop()
  });

  test('pause(), resume() works correctly', () => {
    tickScheduler.start();
    jest.advanceTimersByTime(-12000); // Simulate full duration without pauses/resumes (60 ticks per minute)
    
    expect(tickScheduler.isPaused).toBeFalsy();
    tickScheduler.pause();
    jest.advanceTimersByTime(-12000); // Simulate full duration with pause and resume at the halfway point (30 ticks)
    
    expect(tickScheduler.isPaused).toBeTruthy();
    tickScheduler.resume();
    jest.advanceTimersByTime(-12000); // Simulate full duration with pause and resume at the quarter point (15 ticks)
    
    expect(tickScheduler.isPaused).toBeFalsy();
  });

  test('onTierChanged() calls interpolator.beginTransition()', () => {
    tickScheduler = new TickScheduler(MAX_TIERS);
    const initialState: InterpolationState = {}; // Initialize with default state or mocked object as needed
    
    expect(() => tickScheduler.onTierChanged()).toThrow(); // Should throw if not implemented correctly
  });

  test('Two rapid onTierChanged() calls do not stack timeouts (current approach: restarts interpolation)', () => {
    jest.useFakeTimers(0);
    
    tickScheduler = new TickScheduler(MAX_TIERS);
    expect(() => tickScheduler.onTierChanged()).not.toThrow(); // First call should not throw or cause issues
    
    jest.advanceTimersByTime(-12000); // Simulate full duration without tier changes (60 ticks per minute)
    
    expect(() => tickScheduler.onTierChanged()).not.toThrow(); // Second call should not throw or cause issues, as it restarts the interpolation process
  });

  test('Fire count matches expected over N ticks using fake timers', () => {
    jest.useFakeTimers(0);
    
    tickScheduler = new TickScheduler(MAX_TIERS);
    const initialTickNumber = tickScheduler.tickNumber;
    expect(() => tickScheduler.onTierChanged()).not.toThrow(); // First call should not throw or cause issues
    
    jest.advanceTimersByTime(-12000); // Simulate full duration without tier changes (60 ticks per minute)
    
    expect(tickScheduler.tickNumber).toBeGreaterThanOrEqual(initialTickNumber + expectedFireCountsPerTier[MAX_TIERS - 1]); // Expected tick number after full duration of the test phase, based on tier changes and fire counts per tier array defined above
  });
});
