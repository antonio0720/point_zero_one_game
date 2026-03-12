/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TickScheduler.ts
 *
 * Doctrine:
 * - backend scheduling is an edge concern; simulation truth still lives in the runtime + clock
 * - chained setTimeout is allowed here because this file is the adapter-facing cadence shell
 * - callbacks must never overlap; a slow tick cannot create concurrent state mutation
 * - pause/resume must preserve remaining time, not silently restart a full interval
 * - deterministic clocks are injectable for tests and replay harnesses
 */

import type { ClockSource } from '../core/ClockSource';
import { SystemClock } from '../core/ClockSource';
import type { PressureTier } from '../core/GamePrimitives';

export interface TickScheduleRequest {
  readonly durationMs: number;
  readonly tier: PressureTier;
  readonly reason?: string;
}

export interface ScheduledTickEvent {
  readonly tickNumber: number;
  readonly tier: PressureTier;
  readonly scheduledAtMs: number;
  readonly plannedDurationMs: number;
  readonly expectedFireAtMs: number;
  readonly firedAtMs: number;
  readonly driftMs: number;
  readonly reason?: string;
}

export interface TickSchedulerState {
  readonly tickNumber: number;
  readonly currentTier: PressureTier;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly isTickInFlight: boolean;
  readonly scheduledAtMs: number | null;
  readonly nextFireAtMs: number | null;
  readonly remainingMs: number | null;
  readonly lastPlannedDurationMs: number | null;
  readonly lastFiredAtMs: number | null;
}

export type TickSchedulerCallback = (
  event: ScheduledTickEvent,
) => TickScheduleRequest | null | void | Promise<TickScheduleRequest | null | void>;

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Tick duration must be finite. Received: ${String(value)}`);
  }

  return Math.max(1, Math.trunc(value));
}

function isTickScheduleRequest(
  value: TickScheduleRequest | null | void,
): value is TickScheduleRequest {
  return value !== null && value !== undefined;
}

export class TickScheduler {
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private onTickCallback: TickSchedulerCallback | null = null;

  private generation = 0;
  private tickNumber = 0;
  private currentTier: PressureTier = 'T1';

  private isRunning = false;
  private isPaused = false;
  private isTickInFlight = false;

  private scheduledAtMs: number | null = null;
  private nextFireAtMs: number | null = null;
  private remainingMs: number | null = null;

  private lastPlannedDurationMs: number | null = null;
  private lastFiredAtMs: number | null = null;
  private lastReason: string | undefined;

  public constructor(private readonly clock: ClockSource = new SystemClock()) {}

  public setOnTick(callback: TickSchedulerCallback): void {
    this.onTickCallback = callback;
  }

  public start(initialRequest: TickScheduleRequest): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.tickNumber = 0;
    this.arm(initialRequest);
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    this.isPaused = true;

    if (this.nextFireAtMs !== null) {
      this.remainingMs = Math.max(0, this.nextFireAtMs - this.clock.now());
    } else {
      this.remainingMs = this.lastPlannedDurationMs;
    }

    this.clearTimer();
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused) {
      return;
    }

    this.isPaused = false;

    const durationMs = this.remainingMs ?? this.lastPlannedDurationMs ?? 1;
    this.arm({
      durationMs,
      tier: this.currentTier,
      reason: this.lastReason ?? 'resume',
    });
  }

  public stop(resetTickCounter = false): void {
    this.clearTimer();

    this.isRunning = false;
    this.isPaused = false;
    this.isTickInFlight = false;
    this.scheduledAtMs = null;
    this.nextFireAtMs = null;
    this.remainingMs = null;
    this.lastPlannedDurationMs = null;
    this.lastFiredAtMs = null;
    this.lastReason = undefined;
    this.generation += 1;

    if (resetTickCounter) {
      this.tickNumber = 0;
    }
  }

  public rearm(request: TickScheduleRequest): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    this.arm(request);
  }

  public getState(): TickSchedulerState {
    return Object.freeze({
      tickNumber: this.tickNumber,
      currentTier: this.currentTier,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isTickInFlight: this.isTickInFlight,
      scheduledAtMs: this.scheduledAtMs,
      nextFireAtMs: this.nextFireAtMs,
      remainingMs: this.remainingMs,
      lastPlannedDurationMs: this.lastPlannedDurationMs,
      lastFiredAtMs: this.lastFiredAtMs,
    });
  }

  public isDue(referenceMs = this.clock.now()): boolean {
    if (!this.isRunning || this.isPaused || this.nextFireAtMs === null) {
      return false;
    }

    return Math.trunc(referenceMs) >= this.nextFireAtMs;
  }

  public getTickNumber(): number {
    return this.tickNumber;
  }

  public getCurrentTier(): PressureTier {
    return this.currentTier;
  }

  public getNextFireAtMs(): number | null {
    return this.nextFireAtMs;
  }

  public getRemainingMs(referenceMs = this.clock.now()): number | null {
    if (this.isPaused) {
      return this.remainingMs;
    }

    if (this.nextFireAtMs === null) {
      return null;
    }

    return Math.max(0, this.nextFireAtMs - Math.trunc(referenceMs));
  }

  public async forceFire(): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    this.clearTimer();
    await this.executeCurrentSchedule();
  }

  private arm(request: TickScheduleRequest): void {
    const durationMs = normalizeDurationMs(request.durationMs);

    this.clearTimer();

    this.currentTier = request.tier;
    this.lastPlannedDurationMs = durationMs;
    this.lastReason = request.reason;
    this.remainingMs = durationMs;
    this.scheduledAtMs = Math.trunc(this.clock.now());
    this.nextFireAtMs = this.scheduledAtMs + durationMs;

    const token = ++this.generation;

    this.timeoutHandle = setTimeout(() => {
      void this.handleTimeout(token);
    }, durationMs);
  }

  private async handleTimeout(token: number): Promise<void> {
    if (token !== this.generation) {
      return;
    }

    await this.executeCurrentSchedule();
  }

  private async executeCurrentSchedule(): Promise<void> {
    if (
      !this.isRunning ||
      this.isPaused ||
      this.isTickInFlight ||
      this.nextFireAtMs === null
    ) {
      return;
    }

    this.isTickInFlight = true;

    const firedAtMs = Math.trunc(this.clock.now());
    const scheduledAtMs = this.scheduledAtMs ?? firedAtMs;
    const plannedDurationMs = this.lastPlannedDurationMs ?? 1;
    const expectedFireAtMs = this.nextFireAtMs;
    const driftMs = firedAtMs - expectedFireAtMs;

    this.tickNumber += 1;
    this.lastFiredAtMs = firedAtMs;
    this.remainingMs = 0;

    try {
      const event: ScheduledTickEvent = Object.freeze({
        tickNumber: this.tickNumber,
        tier: this.currentTier,
        scheduledAtMs,
        plannedDurationMs,
        expectedFireAtMs,
        firedAtMs,
        driftMs,
        reason: this.lastReason,
      });

      const callbackResult: TickScheduleRequest | null | void =
        this.onTickCallback !== null
          ? await this.onTickCallback(event)
          : undefined;

      if (!this.isRunning || this.isPaused) {
        return;
      }

      if (callbackResult === null) {
        this.stop(false);
        return;
      }

      if (callbackResult === undefined) {
        this.arm({
          durationMs: plannedDurationMs,
          tier: this.currentTier,
          reason: this.lastReason ?? 'repeat',
        });
        return;
      }

      if (!isTickScheduleRequest(callbackResult)) {
        this.arm({
          durationMs: plannedDurationMs,
          tier: this.currentTier,
          reason: this.lastReason ?? 'repeat',
        });
        return;
      }

      this.arm({
        durationMs: callbackResult.durationMs,
        tier: callbackResult.tier,
        reason: callbackResult.reason,
      });
    } finally {
      this.isTickInFlight = false;
    }
  }

  private clearTimer(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}