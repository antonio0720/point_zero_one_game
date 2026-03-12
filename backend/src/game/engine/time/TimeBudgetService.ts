/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeBudgetService.ts
 *
 * Doctrine:
 * - time budget math must stay pure, central, and deterministic
 * - season budget and extension budget are distinct inputs but one run ceiling
 * - elapsed time is authoritative; next-fire planning is projected from it
 * - this service owns arithmetic, not event emission or outcome mutation
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
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

  public getUtilizationPct(snapshot: RunStateSnapshot): number {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);

    if (totalBudgetMs <= 0) {
      return 1;
    }

    return clamp01(this.getElapsedMs(snapshot) / totalBudgetMs);
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
    const utilizationPct =
      totalBudgetMs <= 0 ? 1 : clamp01(consumedBudgetMs / totalBudgetMs);

    const canScheduleNextTick =
      !request.stopScheduling &&
      snapshot.outcome === null &&
      remainingBudgetMs > 0;

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
    });
  }

  public projectTimers(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimerState {
    const projection = this.projectAdvance(snapshot, request);

    return Object.freeze({
      seasonBudgetMs: projection.seasonBudgetMs,
      extensionBudgetMs: projection.extensionBudgetMs,
      elapsedMs: projection.nextElapsedMs,
      currentTickDurationMs: projection.currentTickDurationMs,
      nextTickAtMs: projection.nextTickAtMs,
      holdCharges: request.overrideHoldCharges ?? snapshot.timers.holdCharges,
      activeDecisionWindows:
        request.activeDecisionWindows ?? snapshot.timers.activeDecisionWindows,
      frozenWindowIds:
        request.frozenWindowIds ?? snapshot.timers.frozenWindowIds,
      lastTierChangeTick: snapshot.timers.lastTierChangeTick,
      tierInterpolationRemainingTicks:
        snapshot.timers.tierInterpolationRemainingTicks,
      forcedTierOverride: snapshot.timers.forcedTierOverride,
    });
  }

  public grantExtension(snapshot: RunStateSnapshot, extensionMs: number): TimerState {
    const normalizedExtensionMs = normalizeMs(extensionMs);

    return Object.freeze({
      ...snapshot.timers,
      extensionBudgetMs:
        normalizeMs(snapshot.timers.extensionBudgetMs) + normalizedExtensionMs,
    });
  }

  public replaceSeasonBudget(
    snapshot: RunStateSnapshot,
    seasonBudgetMs: number,
  ): TimerState {
    return Object.freeze({
      ...snapshot.timers,
      seasonBudgetMs: normalizeMs(seasonBudgetMs),
    });
  }
}