/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/ClockSource.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation surface
 * - deterministic clocks drive replayable simulation
 * - wall clock is allowed only at the edge, never as authoritative state
 */

export interface ClockSource {
  now(): number;
}

export interface MutableClockSource extends ClockSource {
  set(nextMs: number): void;
  advance(deltaMs: number): number;
  clone(): MutableClockSource;
}

function assertFiniteTimestamp(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number. Received: ${String(value)}`);
  }
}

function assertFiniteDelta(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Clock delta must be a finite non-negative number. Received: ${String(value)}`);
  }
}

/**
 * SystemClock is for adapters, API edges, logging, and operational timestamps.
 * It must never be treated as the authoritative simulation clock for a run.
 */
export class SystemClock implements ClockSource {
  public now(): number {
    return Date.now();
  }
}

/**
 * DeterministicClock is the canonical simulation clock.
 * It only moves when the runtime advances it.
 */
export class DeterministicClock implements MutableClockSource {
  private current: number;

  public constructor(initialMs = 0) {
    assertFiniteTimestamp(initialMs, 'DeterministicClock.initialMs');
    this.current = Math.trunc(initialMs);
  }

  public now(): number {
    return this.current;
  }

  public set(nextMs: number): void {
    assertFiniteTimestamp(nextMs, 'DeterministicClock.set(nextMs)');

    const normalized = Math.trunc(nextMs);
    if (normalized < this.current) {
      throw new Error(
        `DeterministicClock cannot move backwards. Current=${this.current}, next=${normalized}`,
      );
    }

    this.current = normalized;
  }

  public advance(deltaMs: number): number {
    assertFiniteDelta(deltaMs);

    if (deltaMs === 0) {
      return this.current;
    }

    this.current += Math.trunc(deltaMs);
    return this.current;
  }

  public clone(): MutableClockSource {
    return new DeterministicClock(this.current);
  }
}

/**
 * OffsetClock is useful when an adapter wants a stable simulation-relative view
 * over another clock source without mutating the underlying source.
 */
export class OffsetClock implements ClockSource {
  public constructor(
    private readonly baseClock: ClockSource,
    private readonly offsetMs: number,
  ) {
    assertFiniteTimestamp(offsetMs, 'OffsetClock.offsetMs');
  }

  public now(): number {
    return Math.trunc(this.baseClock.now() + this.offsetMs);
  }
}

/**
 * FrozenClock is a read-only fixed-time source for snapshotting, tests,
 * and deterministic verification paths where mutation is forbidden.
 */
export class FrozenClock implements ClockSource {
  private readonly timestampMs: number;

  public constructor(timestampMs: number) {
    assertFiniteTimestamp(timestampMs, 'FrozenClock.timestampMs');
    this.timestampMs = Math.trunc(timestampMs);
  }

  public now(): number {
    return this.timestampMs;
  }
}