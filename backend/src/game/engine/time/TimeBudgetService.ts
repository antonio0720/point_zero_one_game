/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeBudgetService.ts
 *
 * Doctrine:
 * - time budget math must stay pure, central, and deterministic
 * - season budget and extension budget are distinct inputs but one run ceiling
 * - elapsed time is authoritative; next-fire planning is projected from it
 * - this service owns arithmetic, not event emission or outcome mutation
 * - additive diagnostics are allowed so long as they do not change timer truth
 */

import type { RunStateSnapshot, TimerState } from '../core/RunStateSnapshot';

export interface TimeBudgetProjection {
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly totalBudgetMs: number;
  readonly previousElapsedMs: number;
  readonly nextElapsedMs: number;
  readonly consumedBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly utilizationPct: number;
  readonly currentTickDurationMs: number;
  readonly nextTickAtMs: number | null;
  readonly canScheduleNextTick: boolean;

  /**
   * Additive diagnostics:
   * - budgetExhausted answers the simple boolean question
   * - overflowBudgetMs preserves how far past ceiling the advance went
   * These do not alter authoritative timer math.
   */
  readonly budgetExhausted: boolean;
  readonly overflowBudgetMs: number;
}

export interface TimeAdvanceRequest {
  readonly durationMs: number;
  readonly nowMs: number;
  readonly stopScheduling?: boolean;
  readonly overrideHoldCharges?: number;
  readonly activeDecisionWindows?: TimerState['activeDecisionWindows'];
  readonly frozenWindowIds?: readonly string[];
}

function normalizeMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeNullableMs(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeDecisionWindows(
  windows: TimerState['activeDecisionWindows'],
): TimerState['activeDecisionWindows'] {
  return Object.freeze({ ...windows });
}

export class TimeBudgetService {
  public getSeasonBudgetMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.seasonBudgetMs);
  }

  public getExtensionBudgetMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.extensionBudgetMs);
  }

  public getTotalBudgetMs(snapshot: RunStateSnapshot): number {
    return this.getSeasonBudgetMs(snapshot) + this.getExtensionBudgetMs(snapshot);
  }

  public getElapsedMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.elapsedMs);
  }

  public getRemainingBudgetMs(snapshot: RunStateSnapshot): number {
    return Math.max(0, this.getTotalBudgetMs(snapshot) - this.getElapsedMs(snapshot));
  }

  public getConsumedBudgetMs(snapshot: RunStateSnapshot): number {
    return this.getElapsedMs(snapshot);
  }

  public getBudgetOverflowMs(snapshot: RunStateSnapshot): number {
    return Math.max(0, this.getElapsedMs(snapshot) - this.getTotalBudgetMs(snapshot));
  }

  public isBudgetExhausted(snapshot: RunStateSnapshot): boolean {
    return this.getRemainingBudgetMs(snapshot) <= 0;
  }

  public getUtilizationPct(snapshot: RunStateSnapshot): number {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);

    if (totalBudgetMs <= 0) {
      return 1;
    }

    return clamp01(this.getElapsedMs(snapshot) / totalBudgetMs);
  }

  public willExhaustBudget(
    snapshot: RunStateSnapshot,
    durationMs: number,
  ): boolean {
    const projectedElapsedMs = this.getElapsedMs(snapshot) + normalizeMs(durationMs);
    return projectedElapsedMs >= this.getTotalBudgetMs(snapshot);
  }

  public projectAdvance(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimeBudgetProjection {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const previousElapsedMs = this.getElapsedMs(snapshot);
    const durationMs = normalizeMs(request.durationMs);
    const nowMs = normalizeMs(request.nowMs);

    const nextElapsedMs = previousElapsedMs + durationMs;
    const consumedBudgetMs = nextElapsedMs;
    const remainingBudgetMs = Math.max(0, totalBudgetMs - consumedBudgetMs);
    const overflowBudgetMs = Math.max(0, consumedBudgetMs - totalBudgetMs);
    const budgetExhausted = remainingBudgetMs <= 0;

    const utilizationPct =
      totalBudgetMs <= 0 ? 1 : clamp01(consumedBudgetMs / totalBudgetMs);

    const canScheduleNextTick =
      request.stopScheduling !== true &&
      snapshot.outcome === null &&
      !budgetExhausted;

    return Object.freeze({
      seasonBudgetMs: this.getSeasonBudgetMs(snapshot),
      extensionBudgetMs: this.getExtensionBudgetMs(snapshot),
      totalBudgetMs,
      previousElapsedMs,
      nextElapsedMs,
      consumedBudgetMs,
      remainingBudgetMs,
      utilizationPct,
      currentTickDurationMs: durationMs,
      nextTickAtMs: canScheduleNextTick ? nowMs + durationMs : null,
      canScheduleNextTick,
      budgetExhausted,
      overflowBudgetMs,
    });
  }

  public projectTimers(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimerState {
    const projection = this.projectAdvance(snapshot, request);

    const holdCharges =
      request.overrideHoldCharges === undefined
        ? normalizeCount(snapshot.timers.holdCharges)
        : normalizeCount(request.overrideHoldCharges);

    const activeDecisionWindows =
      request.activeDecisionWindows === undefined
        ? freezeDecisionWindows(snapshot.timers.activeDecisionWindows)
        : freezeDecisionWindows(request.activeDecisionWindows);

    const frozenWindowIds =
      request.frozenWindowIds === undefined
        ? freezeArray(snapshot.timers.frozenWindowIds)
        : freezeArray(request.frozenWindowIds);

    return Object.freeze({
      seasonBudgetMs: projection.seasonBudgetMs,
      extensionBudgetMs: projection.extensionBudgetMs,
      elapsedMs: projection.nextElapsedMs,
      currentTickDurationMs: projection.currentTickDurationMs,
      nextTickAtMs: projection.nextTickAtMs,
      holdCharges,
      activeDecisionWindows,
      frozenWindowIds,
      lastTierChangeTick:
        snapshot.timers.lastTierChangeTick === undefined
          ? undefined
          : normalizeNullableMs(snapshot.timers.lastTierChangeTick),
      tierInterpolationRemainingTicks:
        snapshot.timers.tierInterpolationRemainingTicks === undefined
          ? undefined
          : normalizeCount(snapshot.timers.tierInterpolationRemainingTicks),
      forcedTierOverride:
        snapshot.timers.forcedTierOverride === undefined
          ? undefined
          : snapshot.timers.forcedTierOverride,
    });
  }

  public grantExtension(snapshot: RunStateSnapshot, extensionMs: number): TimerState {
    const normalizedExtensionMs = normalizeMs(extensionMs);

    return Object.freeze({
      ...snapshot.timers,
      extensionBudgetMs:
        normalizeMs(snapshot.timers.extensionBudgetMs) + normalizedExtensionMs,
      activeDecisionWindows: freezeDecisionWindows(snapshot.timers.activeDecisionWindows),
      frozenWindowIds: freezeArray(snapshot.timers.frozenWindowIds),
    });
  }

  public replaceSeasonBudget(
    snapshot: RunStateSnapshot,
    seasonBudgetMs: number,
  ): TimerState {
    return Object.freeze({
      ...snapshot.timers,
      seasonBudgetMs: normalizeMs(seasonBudgetMs),
      activeDecisionWindows: freezeDecisionWindows(snapshot.timers.activeDecisionWindows),
      frozenWindowIds: freezeArray(snapshot.timers.frozenWindowIds),
    });
  }

  public clearNextTickSchedule(snapshot: RunStateSnapshot): TimerState {
    return Object.freeze({
      ...snapshot.timers,
      nextTickAtMs: null,
      activeDecisionWindows: freezeDecisionWindows(snapshot.timers.activeDecisionWindows),
      frozenWindowIds: freezeArray(snapshot.timers.frozenWindowIds),
    });
  }
}