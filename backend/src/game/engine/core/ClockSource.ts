/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/core/ClockSource.ts
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

export interface ClockSource {
  now(): number;
}

export class SystemClock implements ClockSource {
  public now(): number {
    return Date.now();
  }
}

export class DeterministicClock implements ClockSource {
  public constructor(private current: number = 0) {}

  public now(): number {
    return this.current;
  }

  public advance(ms: number): void {
    this.current += ms;
  }
}
