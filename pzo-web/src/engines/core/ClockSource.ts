// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CLOCK SOURCE
// pzo-web/src/engines/core/ClockSource.ts
//
// Clock abstraction for deterministic timestamp injection.
// Architecture law: engines NEVER call Date.now() directly.
// The orchestrator injects a ClockSource at construction time.
//
//  WallClockSource      → production; delegates to Date.now()
//  FixedClockSource     → deterministic; each call advances by tickMs
//  ManualClockSource    → test harness; only advances when advance() is called
//  RecordingClockSource → wraps any ClockSource, records call history
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── Core interface ────────────────────────────────────────────────────────────

/** Minimal contract all clock sources must satisfy. */
export interface ClockSource {
  /** Returns current time in milliseconds. */
  now(): number;
}

// ── Type guard ────────────────────────────────────────────────────────────────

/**
 * Narrows an unknown value to ClockSource.
 * Does not guarantee correctness of the returned number, only structural shape.
 */
export function isClockSource(value: unknown): value is ClockSource {
  return (
    value !== null &&
    typeof value === 'object' &&
    'now' in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>)['now'] === 'function'
  );
}

// ── WallClockSource ──────────────────────────────────────────────────────────

/**
 * Production clock. Delegates to Date.now().
 * No internal state — each call returns a fresh timestamp.
 */
export class WallClockSource implements ClockSource {
  public now(): number {
    return Date.now();
  }
}

// ── FixedClockSource ─────────────────────────────────────────────────────────

/**
 * Deterministic counter-clock for replay and property-based tests.
 * Each call to now() auto-advances by tickMs.
 * Use reset() to reposition the counter between test cases.
 */
export class FixedClockSource implements ClockSource {
  private current: number;
  private readonly tickMs: number;

  public constructor(initialMs = 0, tickMs = 1000) {
    this.current = initialMs;
    this.tickMs = tickMs;
  }

  public now(): number {
    const t = this.current;
    this.current += this.tickMs;
    return t;
  }

  /** Reposition the counter. Call between test cases to get a clean slate. */
  public reset(initialMs = 0): void {
    this.current = initialMs;
  }

  /** Returns the value that the NEXT call to now() will return (non-advancing). */
  public peek(): number {
    return this.current;
  }

  /** Set an explicit absolute value without advancing. */
  public setNow(absoluteMs: number): void {
    this.current = absoluteMs;
  }
}

// ── ManualClockSource ────────────────────────────────────────────────────────

/**
 * Manually-controlled clock for fine-grained test orchestration.
 * Time only moves when advance() is explicitly called.
 * Ideal for tick-by-tick integration tests that need precise control over
 * elapsed time between orchestrator steps.
 *
 * @example
 * const clock = new ManualClockSource(1_000_000);
 * clock.now(); // 1_000_000
 * clock.advance(500);
 * clock.now(); // 1_000_500
 */
export class ManualClockSource implements ClockSource {
  private _current: number;

  public constructor(initialMs = 0) {
    this._current = initialMs;
  }

  public now(): number {
    return this._current;
  }

  /**
   * Advances the clock by the given number of milliseconds.
   * @param deltaMs Must be ≥ 0. Negative values are silently clamped to 0.
   */
  public advance(deltaMs: number): void {
    this._current += Math.max(0, deltaMs);
  }

  /**
   * Jumps the clock to an absolute point in time.
   * Does not validate monotonicity — callers are responsible.
   */
  public jumpTo(absoluteMs: number): void {
    this._current = absoluteMs;
  }

  /** Returns the current time without any side effects. */
  public get currentMs(): number {
    return this._current;
  }

  /** Resets the clock to the given base time. Useful between test suites. */
  public reset(initialMs = 0): void {
    this._current = initialMs;
  }
}

// ── RecordingClockSource ─────────────────────────────────────────────────────

/**
 * Wraps any ClockSource and records every call to now().
 * Useful for asserting exactly when and how often timestamps are sampled.
 *
 * @example
 * const base  = new FixedClockSource(0, 1000);
 * const probe = new RecordingClockSource(base);
 * probe.now(); // returns 0 from base, records call
 * probe.now(); // returns 1000 from base, records call
 * probe.getCallCount(); // 2
 * probe.getHistory();   // [0, 1000]
 */
export class RecordingClockSource implements ClockSource {
  private readonly history: number[] = [];
  private readonly inner: ClockSource;
  private readonly maxHistory: number;

  public constructor(inner: ClockSource, maxHistory = 1024) {
    this.inner = inner;
    this.maxHistory = Math.max(1, maxHistory);
  }

  public now(): number {
    const t = this.inner.now();
    this.history.push(t);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    return t;
  }

  /** Returns a copy of all recorded timestamps (oldest first). */
  public getHistory(): readonly number[] {
    return [...this.history];
  }

  /** Total number of calls to now() since construction or last clearHistory(). */
  public getCallCount(): number {
    return this.history.length;
  }

  /** Returns the most recently recorded timestamp, or null if never called. */
  public getLastRecorded(): number | null {
    return this.history.length > 0 ? this.history[this.history.length - 1]! : null;
  }

  /** Returns the earliest recorded timestamp, or null if never called. */
  public getFirstRecorded(): number | null {
    return this.history.length > 0 ? this.history[0]! : null;
  }

  /**
   * Total elapsed time between first and last recorded call.
   * Returns 0 if fewer than two calls have been made.
   */
  public getTotalElapsed(): number {
    if (this.history.length < 2) return 0;
    return (this.history[this.history.length - 1]!) - this.history[0]!;
  }

  /** Clears the history without affecting the inner clock. */
  public clearHistory(): void {
    this.history.length = 0;
  }

  /** Returns the wrapped inner clock source. */
  public getInner(): ClockSource {
    return this.inner;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export type ClockSourceKind = 'wall' | 'fixed' | 'manual';

export interface CreateClockSourceOptions {
  kind: ClockSourceKind;
  /** Initial time in ms (fixed/manual only). Default: 0. */
  initialMs?: number;
  /** Auto-advance step for FixedClockSource (ms). Default: 1000. */
  fixedTickMs?: number;
  /** Wrap the created source in a RecordingClockSource for call tracing. */
  record?: boolean;
}

/**
 * Factory for all ClockSource variants.
 * When record: true, the returned source is a RecordingClockSource wrapping
 * the requested kind. Cast to RecordingClockSource to access history.
 *
 * @example
 * const clock = createClockSource({ kind: 'fixed', initialMs: 1_000_000, fixedTickMs: 500 });
 * clock.now(); // 1_000_000
 * clock.now(); // 1_000_500
 *
 * const probe = createClockSource({ kind: 'wall', record: true }) as RecordingClockSource;
 * probe.now();
 * probe.getCallCount(); // 1
 */
export function createClockSource(options: CreateClockSourceOptions): ClockSource {
  const { kind, initialMs = 0, fixedTickMs = 1000, record = false } = options;

  let base: ClockSource;
  switch (kind) {
    case 'wall':
      base = new WallClockSource();
      break;
    case 'fixed':
      base = new FixedClockSource(initialMs, fixedTickMs);
      break;
    case 'manual':
      base = new ManualClockSource(initialMs);
      break;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      base = new WallClockSource();
    }
  }

  return record ? new RecordingClockSource(base) : base;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if the two clock sources are structurally the same instance.
 * Used in diagnostics to detect accidental aliasing of shared clocks.
 */
export function isSameClock(a: ClockSource, b: ClockSource): boolean {
  return a === b;
}

/**
 * Returns a human-readable label for the kind of clock source provided.
 * Falls back to 'unknown' if the source type is not one of the 4 built-ins.
 */
export function describeClockSource(clock: ClockSource): string {
  if (clock instanceof WallClockSource) return 'WallClockSource';
  if (clock instanceof FixedClockSource) return 'FixedClockSource';
  if (clock instanceof ManualClockSource) return 'ManualClockSource';
  if (clock instanceof RecordingClockSource) return `RecordingClockSource(${describeClockSource(clock.getInner())})`;
  return 'unknown';
}

export default createClockSource;
