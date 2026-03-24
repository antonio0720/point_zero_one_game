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
 * Falls back to 'unknown' if the source type is not one of the built-ins.
 */
export function describeClockSource(clock: ClockSource): string {
  if (clock instanceof WallClockSource)       return 'WallClockSource';
  if (clock instanceof FixedClockSource)      return 'FixedClockSource';
  if (clock instanceof ManualClockSource)     return 'ManualClockSource';
  if (clock instanceof RecordingClockSource)  return `RecordingClockSource(${describeClockSource(clock.getInner())})`;
  if (clock instanceof DriftTrackingClockSource) return `DriftTrackingClockSource(${describeClockSource(clock.getInner())})`;
  if (clock instanceof MonotonicClockSource)  return `MonotonicClockSource(${describeClockSource(clock.getInner())})`;
  if (clock instanceof OffsetClockSource)     return `OffsetClockSource(offset=${clock.getOffset()}, ${describeClockSource(clock.getInner())})`;
  if (clock instanceof ScaledClockSource)     return `ScaledClockSource(scale=${clock.getScale()}, ${describeClockSource(clock.getInner())})`;
  return 'unknown';
}

// ── DriftTrackingClockSource ──────────────────────────────────────────────────

/**
 * Wraps any ClockSource and measures drift from an expected tick interval.
 * After each call to now(), computes the actual elapsed time since the last
 * call and compares it against expectedIntervalMs.
 * Positive drift = tick arrived late. Negative = tick arrived early.
 *
 * @example
 * const clock = new DriftTrackingClockSource(new WallClockSource(), 1000);
 * await sleep(1050);
 * clock.now(); // returns current time; drift ≈ +50ms
 * clock.getLastDriftMs(); // 50
 */
export class DriftTrackingClockSource implements ClockSource {
  private readonly inner:               ClockSource;
  private readonly expectedIntervalMs:  number;
  private lastCallMs:    number | null = null;
  private lastDriftMs:   number        = 0;
  private cumulativeDrift: number      = 0;
  private callCount:     number        = 0;
  private readonly driftHistory: number[] = [];
  private readonly maxDriftHistory: number;

  public constructor(inner: ClockSource, expectedIntervalMs = 1000, maxDriftHistory = 128) {
    this.inner              = inner;
    this.expectedIntervalMs = Math.max(1, expectedIntervalMs);
    this.maxDriftHistory    = Math.max(8, maxDriftHistory);
  }

  public now(): number {
    const current = this.inner.now();
    this.callCount += 1;

    if (this.lastCallMs !== null) {
      const elapsed = current - this.lastCallMs;
      this.lastDriftMs    = elapsed - this.expectedIntervalMs;
      this.cumulativeDrift += this.lastDriftMs;
      this.driftHistory.push(this.lastDriftMs);
      if (this.driftHistory.length > this.maxDriftHistory) {
        this.driftHistory.shift();
      }
    }

    this.lastCallMs = current;
    return current;
  }

  /** Drift (ms) of the most recent interval. Positive = late, negative = early. */
  public getLastDriftMs(): number { return this.lastDriftMs; }

  /** Sum of all drift measurements since construction or last reset(). */
  public getCumulativeDriftMs(): number { return this.cumulativeDrift; }

  /** Average absolute drift over the history window. */
  public getAvgAbsDriftMs(): number {
    if (this.driftHistory.length === 0) return 0;
    return this.driftHistory.reduce((s, d) => s + Math.abs(d), 0) / this.driftHistory.length;
  }

  /** Maximum absolute drift observed in the history window. */
  public getMaxAbsDriftMs(): number {
    return this.driftHistory.reduce((m, d) => Math.max(m, Math.abs(d)), 0);
  }

  /** Full drift history (oldest first). */
  public getDriftHistory(): readonly number[] { return [...this.driftHistory]; }

  /** Total number of now() calls made. */
  public getCallCount(): number { return this.callCount; }

  /** The wrapped inner clock. */
  public getInner(): ClockSource { return this.inner; }

  /** Resets all drift tracking. Does not affect the inner clock. */
  public reset(): void {
    this.lastCallMs      = null;
    this.lastDriftMs     = 0;
    this.cumulativeDrift = 0;
    this.callCount       = 0;
    this.driftHistory.length = 0;
  }
}

// ── MonotonicClockSource ──────────────────────────────────────────────────────

/**
 * Wraps any ClockSource and guarantees that now() never returns a value
 * less than or equal to the previous call. Non-monotone inputs are clamped
 * forward by 1ms.
 *
 * Critical for replay integrity: if an inner clock produces a backward jump
 * (e.g. due to NTP sync), this wrapper ensures engines never see time reverse.
 *
 * @example
 * const clock = new MonotonicClockSource(new ManualClockSource(100));
 * (clock.getInner() as ManualClockSource).jumpTo(50); // backward jump!
 * clock.now(); // still returns ≥ 100 (last known value)
 */
export class MonotonicClockSource implements ClockSource {
  private readonly inner:  ClockSource;
  private lastValue:       number;
  private correctionCount: number = 0;

  public constructor(inner: ClockSource, initialValue?: number) {
    this.inner     = inner;
    this.lastValue = initialValue ?? 0;
  }

  public now(): number {
    const raw = this.inner.now();
    if (raw <= this.lastValue) {
      this.correctionCount += 1;
      this.lastValue = this.lastValue + 1;
    } else {
      this.lastValue = raw;
    }
    return this.lastValue;
  }

  /** Number of times a backward-jump was corrected. */
  public getCorrectionCount(): number { return this.correctionCount; }

  /** The wrapped inner clock. */
  public getInner(): ClockSource { return this.inner; }

  /** Resets the last-seen value to a new base. Corrections counter is preserved. */
  public rebase(newBase: number): void { this.lastValue = newBase; }
}

// ── OffsetClockSource ─────────────────────────────────────────────────────────

/**
 * Wraps any ClockSource and adds a fixed offset (positive or negative) to
 * every now() call. Useful for simulating time zones, clock skew, or
 * future/past scenarios in tests.
 *
 * @example
 * const clock = new OffsetClockSource(new WallClockSource(), -3600_000); // 1 hour ago
 */
export class OffsetClockSource implements ClockSource {
  private readonly inner:  ClockSource;
  private offset: number;

  public constructor(inner: ClockSource, offsetMs: number) {
    this.inner  = inner;
    this.offset = offsetMs;
  }

  public now(): number {
    return this.inner.now() + this.offset;
  }

  /** Returns the current offset in milliseconds. */
  public getOffset(): number { return this.offset; }

  /** Updates the offset. Affects all subsequent now() calls. */
  public setOffset(offsetMs: number): void { this.offset = offsetMs; }

  /** Shifts the offset by a delta amount. */
  public shiftOffset(deltaMs: number): void { this.offset += deltaMs; }

  /** The wrapped inner clock. */
  public getInner(): ClockSource { return this.inner; }
}

// ── ScaledClockSource ─────────────────────────────────────────────────────────

/**
 * Wraps any ClockSource and scales the elapsed time relative to a fixed
 * reference point. scale > 1.0 = time dilation (faster). scale < 1.0 = time
 * compression (slower). scale = 1.0 = real time (identity).
 *
 * Perfect for fast-forward replay or slow-motion debugging.
 *
 * @example
 * const base  = new WallClockSource();
 * const fast  = new ScaledClockSource(base, 2.0); // 2× faster
 * const slow  = new ScaledClockSource(base, 0.5); // 2× slower
 */
export class ScaledClockSource implements ClockSource {
  private readonly inner:     ClockSource;
  private scale:              number;
  private readonly refReal:   number;  // wall time at construction
  private readonly refScaled: number;  // virtual time at construction

  public constructor(inner: ClockSource, scale = 1.0) {
    this.inner     = inner;
    this.scale     = Math.max(0.001, scale); // prevent zero/negative scale
    this.refReal   = inner.now();
    this.refScaled = this.refReal;
  }

  public now(): number {
    const elapsed = this.inner.now() - this.refReal;
    return this.refScaled + elapsed * this.scale;
  }

  /** Returns the current time scale factor. */
  public getScale(): number { return this.scale; }

  /**
   * Updates the scale factor. The reference point is reset to the current
   * time so the transition is seamless.
   */
  public setScale(newScale: number): void {
    // Rebase so there is no discontinuity in the virtual timeline
    const currentVirtual = this.now();
    const currentReal    = this.inner.now();
    (this as unknown as { refReal: number }).refReal     = currentReal;
    (this as unknown as { refScaled: number }).refScaled = currentVirtual;
    this.scale = Math.max(0.001, newScale);
  }

  /** The wrapped inner clock. */
  public getInner(): ClockSource { return this.inner; }
}

// ── ClockSourceRegistry ───────────────────────────────────────────────────────

/**
 * Named registry for multiple ClockSource instances.
 * Allows the orchestrator or test harnesses to swap named clocks without
 * changing every injection site.
 *
 * @example
 * const reg = new ClockSourceRegistry();
 * reg.register('wall', new WallClockSource());
 * reg.register('test', new ManualClockSource(1_000_000));
 * reg.setActive('test');
 * reg.now(); // delegates to the 'test' clock
 */
export class ClockSourceRegistry implements ClockSource {
  private readonly registry: Map<string, ClockSource> = new Map();
  private activeName: string | null = null;

  /** Register a named ClockSource. Overwrites any prior entry with the same name. */
  public register(name: string, clock: ClockSource): void {
    this.registry.set(name, clock);
    if (this.activeName === null) this.activeName = name;
  }

  /** Unregister a named clock. Clears the active name if it matches. */
  public unregister(name: string): void {
    this.registry.delete(name);
    if (this.activeName === name) {
      this.activeName = this.registry.size > 0 ? this.registry.keys().next().value ?? null : null;
    }
  }

  /**
   * Set the active clock by name. Throws if the name is not registered.
   */
  public setActive(name: string): void {
    if (!this.registry.has(name)) {
      throw new Error(`[ClockSourceRegistry] Unknown clock name: "${name}"`);
    }
    this.activeName = name;
  }

  /** Returns the name of the currently active clock. */
  public getActiveName(): string | null { return this.activeName; }

  /** Returns the currently active ClockSource. Throws if none registered. */
  public getActive(): ClockSource {
    if (this.activeName === null || !this.registry.has(this.activeName)) {
      throw new Error('[ClockSourceRegistry] No active clock registered.');
    }
    return this.registry.get(this.activeName)!;
  }

  /** Returns a named ClockSource without making it active. */
  public get(name: string): ClockSource | undefined {
    return this.registry.get(name);
  }

  /** Returns all registered clock names. */
  public getNames(): string[] {
    return Array.from(this.registry.keys());
  }

  /** Returns the total number of registered clocks. */
  public size(): number { return this.registry.size; }

  /** Delegates now() to the currently active clock. */
  public now(): number {
    return this.getActive().now();
  }

  /** Returns true if both registry and named clock contain the given entry. */
  public has(name: string): boolean {
    return this.registry.has(name);
  }
}

// ── Extended factory ──────────────────────────────────────────────────────────

export type ClockSourceKind = 'wall' | 'fixed' | 'manual';

export interface CreateClockSourceOptions {
  kind: ClockSourceKind;
  /** Initial time in ms (fixed/manual only). Default: 0. */
  initialMs?: number;
  /** Auto-advance step for FixedClockSource (ms). Default: 1000. */
  fixedTickMs?: number;
  /** Wrap the created source in a RecordingClockSource for call tracing. */
  record?: boolean;
  /** Wrap in a MonotonicClockSource to guarantee forward-only progression. */
  monotonic?: boolean;
  /** Add a fixed offset (ms) via OffsetClockSource. */
  offsetMs?: number;
  /** Scale time progression via ScaledClockSource. */
  scale?: number;
  /** Wrap in a DriftTrackingClockSource with the given expected interval. */
  trackDriftIntervalMs?: number;
}

/**
 * Factory for all ClockSource variants.
 * Options are composed in this order (innermost → outermost):
 *   base → monotonic → offset → scale → drift-tracking → recording
 *
 * @example
 * const clock = createClockSource({ kind: 'fixed', initialMs: 0, scale: 2.0, record: true });
 */
export function createClockSource(options: CreateClockSourceOptions): ClockSource {
  const {
    kind,
    initialMs = 0,
    fixedTickMs = 1000,
    record = false,
    monotonic = false,
    offsetMs,
    scale,
    trackDriftIntervalMs,
  } = options;

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

  // Compose optional wrappers
  if (monotonic)               base = new MonotonicClockSource(base);
  if (offsetMs !== undefined)  base = new OffsetClockSource(base, offsetMs);
  if (scale !== undefined)     base = new ScaledClockSource(base, scale);
  if (trackDriftIntervalMs)    base = new DriftTrackingClockSource(base, trackDriftIntervalMs);
  if (record)                  base = new RecordingClockSource(base);

  return base;
}

export default createClockSource;
