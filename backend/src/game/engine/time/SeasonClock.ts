/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/SeasonClock.ts
 *
 * Doctrine:
 * - backend season time is an operational calendar layer, not a per-tick mechanic
 * - real-world season pressure must be queryable without contaminating deterministic run state
 * - the clock source is injectable so adapters can use wall clock while tests use frozen time
 * - season windows must be validated, sortable, and safe for multiplicative pressure stacking
 */

import type { ClockSource } from '../core/ClockSource';
import { SystemClock } from '../core/ClockSource';

export enum SeasonWindowType {
  KICKOFF = 'KICKOFF',
  LIVEOPS_EVENT = 'LIVEOPS_EVENT',
  SEASON_FINALE = 'SEASON_FINALE',
  ARCHIVE_CLOSE = 'ARCHIVE_CLOSE',
  REENGAGE_WINDOW = 'REENGAGE_WINDOW',
}

export type SeasonLifecycleState =
  | 'UNCONFIGURED'
  | 'UPCOMING'
  | 'ACTIVE'
  | 'ENDED';

export interface SeasonTimeWindow {
  readonly windowId: string;
  readonly type: SeasonWindowType;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly isActive: boolean;
  readonly pressureMultiplier: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SeasonTimelineManifest {
  readonly seasonId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly windows: readonly SeasonTimeWindow[];
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SeasonPressureContext {
  readonly seasonId: string | null;
  readonly lifecycle: SeasonLifecycleState;
  readonly nowMs: number;
  readonly activeWindows: readonly SeasonTimeWindow[];
  readonly pressureMultiplier: number;
  readonly msUntilStart: number;
  readonly msUntilEnd: number;
}

export interface SeasonClockSnapshot {
  readonly seasonId: string | null;
  readonly lifecycle: SeasonLifecycleState;
  readonly seasonStartMs: number | null;
  readonly seasonEndMs: number | null;
  readonly windowCount: number;
  readonly activeWindowIds: readonly string[];
  readonly pressureMultiplier: number;
  readonly msUntilStart: number;
  readonly msUntilEnd: number;
}

const MIN_PRESSURE_MULTIPLIER = 0.10;
const MAX_PRESSURE_MULTIPLIER = 4.00;

function assertFiniteTimestamp(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite timestamp. Received: ${String(value)}`);
  }
}

function assertValidRange(startMs: number, endMs: number, label: string): void {
  assertFiniteTimestamp(startMs, `${label}.startMs`);
  assertFiniteTimestamp(endMs, `${label}.endMs`);

  if (Math.trunc(endMs) < Math.trunc(startMs)) {
    throw new Error(`${label} end must be >= start. start=${startMs}, end=${endMs}`);
  }
}

function normalizeMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    return 1.0;
  }

  const rounded = Number(value.toFixed(4));
  return Math.min(MAX_PRESSURE_MULTIPLIER, Math.max(MIN_PRESSURE_MULTIPLIER, rounded));
}

function cloneWindow(window: SeasonTimeWindow): SeasonTimeWindow {
  return Object.freeze({
    windowId: window.windowId,
    type: window.type,
    startsAtMs: Math.trunc(window.startsAtMs),
    endsAtMs: Math.trunc(window.endsAtMs),
    isActive: window.isActive,
    pressureMultiplier: normalizeMultiplier(window.pressureMultiplier),
    metadata: window.metadata ? Object.freeze({ ...window.metadata }) : undefined,
  });
}

function dedupeWindows(windows: readonly SeasonTimeWindow[]): readonly SeasonTimeWindow[] {
  const seen = new Set<string>();
  const deduped: SeasonTimeWindow[] = [];

  for (const window of windows) {
    if (seen.has(window.windowId)) {
      throw new Error(`Duplicate season window id detected: ${window.windowId}`);
    }
    seen.add(window.windowId);
    deduped.push(window);
  }

  return Object.freeze(deduped);
}

export class SeasonClock {
  private seasonId: string | null = null;
  private seasonStartMs: number | null = null;
  private seasonEndMs: number | null = null;
  private windows: readonly SeasonTimeWindow[] = Object.freeze([]);
  private metadata: Readonly<Record<string, string | number | boolean | null>> | null = null;

  public constructor(private readonly clock: ClockSource = new SystemClock()) {}

  public reset(): void {
    this.seasonId = null;
    this.seasonStartMs = null;
    this.seasonEndMs = null;
    this.windows = Object.freeze([]);
    this.metadata = null;
  }

  public loadSeasonManifest(manifest: SeasonTimelineManifest): void {
    if (typeof manifest.seasonId !== 'string' || manifest.seasonId.trim().length === 0) {
      throw new Error('SeasonTimelineManifest.seasonId must be a non-empty string.');
    }

    assertValidRange(manifest.startMs, manifest.endMs, 'SeasonTimelineManifest');

    const normalizedWindows = manifest.windows
      .map((window) => {
        if (typeof window.windowId !== 'string' || window.windowId.trim().length === 0) {
          throw new Error('Season window must have a non-empty windowId.');
        }

        assertValidRange(
          window.startsAtMs,
          window.endsAtMs,
          `SeasonTimelineManifest.windows[${window.windowId}]`,
        );

        return cloneWindow(window);
      })
      .sort((left, right) => {
        if (left.startsAtMs !== right.startsAtMs) {
          return left.startsAtMs - right.startsAtMs;
        }
        return left.windowId.localeCompare(right.windowId);
      });

    this.seasonId = manifest.seasonId;
    this.seasonStartMs = Math.trunc(manifest.startMs);
    this.seasonEndMs = Math.trunc(manifest.endMs);
    this.windows = dedupeWindows(normalizedWindows);
    this.metadata = manifest.metadata ? Object.freeze({ ...manifest.metadata }) : null;
  }

  public hasManifest(): boolean {
    return this.seasonId !== null && this.seasonStartMs !== null && this.seasonEndMs !== null;
  }

  public getSeasonId(): string | null {
    return this.seasonId;
  }

  public getSeasonMetadata(): Readonly<Record<string, string | number | boolean | null>> | null {
    return this.metadata;
  }

  public getLifecycle(referenceMs = this.clock.now()): SeasonLifecycleState {
    if (!this.hasManifest() || this.seasonStartMs === null || this.seasonEndMs === null) {
      return 'UNCONFIGURED';
    }

    const nowMs = Math.trunc(referenceMs);

    if (nowMs < this.seasonStartMs) {
      return 'UPCOMING';
    }

    if (nowMs > this.seasonEndMs) {
      return 'ENDED';
    }

    return 'ACTIVE';
  }

  public isSeasonActive(referenceMs = this.clock.now()): boolean {
    return this.getLifecycle(referenceMs) === 'ACTIVE';
  }

  public getActiveWindows(referenceMs = this.clock.now()): readonly SeasonTimeWindow[] {
    const nowMs = Math.trunc(referenceMs);

    return Object.freeze(
      this.windows.filter((window) => {
        if (!window.isActive) {
          return false;
        }

        return nowMs >= window.startsAtMs && nowMs <= window.endsAtMs;
      }),
    );
  }

  public getAllWindows(): readonly SeasonTimeWindow[] {
    return this.windows;
  }

  public hasWindowType(type: SeasonWindowType, referenceMs = this.clock.now()): boolean {
    return this.getActiveWindows(referenceMs).some((window) => window.type === type);
  }

  public getNextWindow(
    referenceMs = this.clock.now(),
    type?: SeasonWindowType,
  ): SeasonTimeWindow | null {
    const nowMs = Math.trunc(referenceMs);

    const candidates = this.windows.filter((window) => {
      if (window.startsAtMs < nowMs) {
        return false;
      }

      if (type !== undefined && window.type !== type) {
        return false;
      }

      return true;
    });

    return candidates.length > 0 ? candidates[0] : null;
  }

  public getPressureMultiplier(referenceMs = this.clock.now()): number {
    const activeWindows = this.getActiveWindows(referenceMs);

    if (activeWindows.length === 0) {
      return 1.0;
    }

    const product = activeWindows.reduce<number>((accumulator, window) => {
      return accumulator * normalizeMultiplier(window.pressureMultiplier);
    }, 1.0);

    return normalizeMultiplier(product);
  }

  public getMsUntilSeasonStart(referenceMs = this.clock.now()): number {
    if (this.seasonStartMs === null) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, this.seasonStartMs - Math.trunc(referenceMs));
  }

  public getMsUntilSeasonEnd(referenceMs = this.clock.now()): number {
    if (this.seasonEndMs === null) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, this.seasonEndMs - Math.trunc(referenceMs));
  }

  public getPressureContext(referenceMs = this.clock.now()): SeasonPressureContext {
    const nowMs = Math.trunc(referenceMs);
    const activeWindows = this.getActiveWindows(nowMs);

    return Object.freeze({
      seasonId: this.seasonId,
      lifecycle: this.getLifecycle(nowMs),
      nowMs,
      activeWindows,
      pressureMultiplier: this.getPressureMultiplier(nowMs),
      msUntilStart: this.getMsUntilSeasonStart(nowMs),
      msUntilEnd: this.getMsUntilSeasonEnd(nowMs),
    });
  }

  public snapshot(referenceMs = this.clock.now()): SeasonClockSnapshot {
    const nowMs = Math.trunc(referenceMs);
    const activeWindows = this.getActiveWindows(nowMs);

    return Object.freeze({
      seasonId: this.seasonId,
      lifecycle: this.getLifecycle(nowMs),
      seasonStartMs: this.seasonStartMs,
      seasonEndMs: this.seasonEndMs,
      windowCount: this.windows.length,
      activeWindowIds: Object.freeze(activeWindows.map((window) => window.windowId)),
      pressureMultiplier: this.getPressureMultiplier(nowMs),
      msUntilStart: this.getMsUntilSeasonStart(nowMs),
      msUntilEnd: this.getMsUntilSeasonEnd(nowMs),
    });
  }
}