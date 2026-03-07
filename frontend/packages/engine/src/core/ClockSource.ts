/**
 * FILE: pzo-web/src/engines/core/ClockSource.ts
 * Clock abstraction for deterministic timestamp injection.
 * Production: WallClockSource → Date.now()
 * Test/Replay: FixedClockSource → deterministic counter
 */

export interface ClockSource {
  /** Returns current time in milliseconds. */
  now(): number;
}

/** Production clock: delegates to Date.now(). */
export class WallClockSource implements ClockSource {
  public now(): number {
    return Date.now();
  }
}

/**
 * Deterministic clock for test/replay.
 * Each call to now() advances by tickMs.
 */
export class FixedClockSource implements ClockSource {
  private current: number;
  private readonly tickMs: number;

  constructor(initialMs: number = 0, tickMs: number = 1000) {
    this.current = initialMs;
    this.tickMs = tickMs;
  }

  public now(): number {
    const t = this.current;
    this.current += this.tickMs;
    return t;
  }

  /** Reset to initial time — useful between test cases. */
  public reset(initialMs: number = 0): void {
    this.current = initialMs;
  }
}
