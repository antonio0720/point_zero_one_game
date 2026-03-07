/**
 * FILE: pzo-web/src/engines/core/ClockSource.ts
 * Clock abstraction for deterministic testing and production time-stamping.
 */

export interface ClockSource {
  /** Returns current timestamp in milliseconds. */
  now(): number;
}

/** Production clock — delegates to Date.now(). */
export class SystemClockSource implements ClockSource {
  public now(): number {
    return Date.now();
  }
}

/**
 * Fixed-step clock for tests and replay.
 * Advances by tickMs on each call to now(), producing fully deterministic timestamps.
 *
 * @param initialTimeMs  Starting time value. Default: 0.
 * @param tickMs         Amount to advance per now() call. Default: 1000.
 *
 * Usage:
 *   const clock = new FixedClockSource(1000, 500);
 *   clock.now() // → 1000
 *   clock.now() // → 1500
 *   clock.now() // → 2000
 */
export class FixedClockSource implements ClockSource {
  private current: number;
  private readonly tickMs: number;

  constructor(initialTimeMs: number = 0, tickMs: number = 1000) {
    this.current = initialTimeMs;
    this.tickMs  = tickMs;
  }

  public now(): number {
    const t = this.current;
    this.current += this.tickMs;
    return t;
  }

  public reset(initialTimeMs: number = 0): void {
    this.current = initialTimeMs;
  }
}
