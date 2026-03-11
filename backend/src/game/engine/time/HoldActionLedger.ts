/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/HoldActionLedger.ts
 *
 * Doctrine:
 * - hold actions are backend-governed scarce resources
 * - consumption is one-way per run unless the run is fully reset
 * - active hold state is queryable without mutating timer truth
 * - this file governs hold entitlement and active freeze windows, not card legality
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export interface ActiveHoldRecord {
  readonly windowId: string;
  readonly startedAtMs: number;
  readonly endsAtMs: number;
  readonly durationMs: number;
}

export interface HoldSpendRequest {
  readonly windowId: string;
  readonly nowMs: number;
  readonly durationMs: number;
}

export interface HoldSpendResult {
  readonly accepted: boolean;
  readonly code:
    | 'OK'
    | 'HOLD_DISABLED'
    | 'NO_CHARGES_REMAINING'
    | 'INVALID_DURATION'
    | 'WINDOW_ALREADY_FROZEN';
  readonly remainingCharges: number;
  readonly activeWindowId: string | null;
  readonly frozenUntilMs: number | null;
}

export interface HoldLedgerSnapshot {
  readonly enabled: boolean;
  readonly remainingCharges: number;
  readonly activeHold: ActiveHoldRecord | null;
  readonly frozenWindowIds: readonly string[];
  readonly consumedThisRun: number;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export class HoldActionLedger {
  private enabled = true;
  private remainingCharges = 1;
  private consumedThisRun = 0;
  private activeHold: ActiveHoldRecord | null = null;

  public reset(
    remainingCharges = 1,
    enabled = true,
  ): void {
    this.enabled = enabled;
    this.remainingCharges = Math.max(0, Math.trunc(remainingCharges));
    this.consumedThisRun = 0;
    this.activeHold = null;
  }

  public rehydrateFromSnapshot(
    snapshot: RunStateSnapshot,
    holdEndsAtMsByWindowId: Readonly<Record<string, number>> = {},
  ): void {
    this.enabled = snapshot.modeState.holdEnabled;
    this.remainingCharges = Math.max(0, Math.trunc(snapshot.timers.holdCharges));
    this.consumedThisRun = Math.max(0, 1 - this.remainingCharges);
    this.activeHold = null;

    for (const windowId of snapshot.timers.frozenWindowIds) {
      const endsAtMs = holdEndsAtMsByWindowId[windowId];
      if (endsAtMs !== undefined) {
        const nowMs = snapshot.timers.nextTickAtMs ?? snapshot.timers.elapsedMs;
        this.activeHold = Object.freeze({
          windowId,
          startedAtMs: Math.max(0, Math.trunc(nowMs)),
          endsAtMs: Math.max(0, Math.trunc(endsAtMs)),
          durationMs: Math.max(0, Math.trunc(endsAtMs) - Math.max(0, Math.trunc(nowMs))),
        });
        break;
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getRemainingCharges(): number {
    return this.remainingCharges;
  }

  public getConsumedThisRun(): number {
    return this.consumedThisRun;
  }

  public getActiveHold(nowMs: number): ActiveHoldRecord | null {
    this.expireIfNeeded(nowMs);
    return this.activeHold;
  }

  public isWindowFrozen(windowId: string, nowMs: number): boolean {
    this.expireIfNeeded(nowMs);

    return this.activeHold !== null
      && this.activeHold.windowId === windowId
      && nowMs < this.activeHold.endsAtMs;
  }

  public canSpend(nowMs: number): boolean {
    this.expireIfNeeded(nowMs);

    return this.enabled
      && this.remainingCharges > 0
      && this.activeHold === null;
  }

  public spend(request: HoldSpendRequest): HoldSpendResult {
    this.expireIfNeeded(request.nowMs);

    if (!this.enabled) {
      return Object.freeze({
        accepted: false,
        code: 'HOLD_DISABLED',
        remainingCharges: this.remainingCharges,
        activeWindowId: this.activeHold?.windowId ?? null,
        frozenUntilMs: this.activeHold?.endsAtMs ?? null,
      });
    }

    if (request.durationMs <= 0 || !Number.isFinite(request.durationMs)) {
      return Object.freeze({
        accepted: false,
        code: 'INVALID_DURATION',
        remainingCharges: this.remainingCharges,
        activeWindowId: this.activeHold?.windowId ?? null,
        frozenUntilMs: this.activeHold?.endsAtMs ?? null,
      });
    }

    if (this.remainingCharges <= 0) {
      return Object.freeze({
        accepted: false,
        code: 'NO_CHARGES_REMAINING',
        remainingCharges: this.remainingCharges,
        activeWindowId: this.activeHold?.windowId ?? null,
        frozenUntilMs: this.activeHold?.endsAtMs ?? null,
      });
    }

    if (this.activeHold !== null) {
      return Object.freeze({
        accepted: false,
        code: 'WINDOW_ALREADY_FROZEN',
        remainingCharges: this.remainingCharges,
        activeWindowId: this.activeHold.windowId,
        frozenUntilMs: this.activeHold.endsAtMs,
      });
    }

    const startedAtMs = Math.max(0, Math.trunc(request.nowMs));
    const durationMs = Math.max(1, Math.trunc(request.durationMs));
    const endsAtMs = startedAtMs + durationMs;

    this.remainingCharges -= 1;
    this.consumedThisRun += 1;
    this.activeHold = Object.freeze({
      windowId: request.windowId,
      startedAtMs,
      endsAtMs,
      durationMs,
    });

    return Object.freeze({
      accepted: true,
      code: 'OK',
      remainingCharges: this.remainingCharges,
      activeWindowId: this.activeHold.windowId,
      frozenUntilMs: this.activeHold.endsAtMs,
    });
  }

  public release(windowId: string, nowMs: number): boolean {
    this.expireIfNeeded(nowMs);

    if (this.activeHold === null || this.activeHold.windowId !== windowId) {
      return false;
    }

    this.activeHold = null;
    return true;
  }

  public snapshot(nowMs: number): HoldLedgerSnapshot {
    this.expireIfNeeded(nowMs);

    return Object.freeze({
      enabled: this.enabled,
      remainingCharges: this.remainingCharges,
      activeHold: this.activeHold,
      frozenWindowIds: freezeArray(
        this.activeHold !== null ? [this.activeHold.windowId] : [],
      ),
      consumedThisRun: this.consumedThisRun,
    });
  }

  private expireIfNeeded(nowMs: number): void {
    if (this.activeHold === null) {
      return;
    }

    if (Math.trunc(nowMs) >= this.activeHold.endsAtMs) {
      this.activeHold = null;
    }
  }
}