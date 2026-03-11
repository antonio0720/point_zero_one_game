/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TickRateInterpolator.ts
 *
 * Doctrine:
 * - backend cadence must not snap violently between pressure tiers
 * - interpolation is deterministic and tick-based, not wall-clock based
 * - if pressure changes again mid-transition, restart from current duration
 * - this class is stateful but resettable for replay / hot-run isolation
 */

import type { PressureTier } from '../core/GamePrimitives';
import { TIER_DURATIONS_MS, computeInterpolationTickCount } from './types';

interface MutableInterpolationState {
  fromTier: PressureTier;
  toTier: PressureTier;
  fromDurationMs: number;
  toDurationMs: number;
  totalTicks: number;
  ticksRemaining: number;
}

export class TickRateInterpolator {
  private currentTier: PressureTier | null = null;
  private currentDurationMs = TIER_DURATIONS_MS.T1;
  private state: MutableInterpolationState | null = null;

  public reset(initialTier: PressureTier = 'T1'): void {
    this.currentTier = initialTier;
    this.currentDurationMs = TIER_DURATIONS_MS[initialTier];
    this.state = null;
  }

  /**
   * Resolves the authoritative duration for the current time step.
   * The first call seeds state.
   * Later calls linearly interpolate when the incoming tier changes.
   */
  public resolveDurationMs(tier: PressureTier): number {
    if (this.currentTier === null) {
      this.reset(tier);
      return this.currentDurationMs;
    }

    if (tier !== this.currentTier) {
      this.beginTransition(tier);
    }

    if (this.state === null) {
      this.currentTier = tier;
      this.currentDurationMs = TIER_DURATIONS_MS[tier];
      return this.currentDurationMs;
    }

    const { fromDurationMs, toDurationMs, totalTicks, ticksRemaining } = this.state;
    const progress = (totalTicks - ticksRemaining + 1) / totalTicks;
    const interpolated = fromDurationMs + ((toDurationMs - fromDurationMs) * progress);

    this.currentDurationMs = Math.round(interpolated);
    this.state.ticksRemaining -= 1;

    if (this.state.ticksRemaining <= 0) {
      this.currentDurationMs = toDurationMs;
      this.currentTier = this.state.toTier;
      this.state = null;
    }

    return this.currentDurationMs;
  }

  public getCurrentDurationMs(): number {
    return this.currentDurationMs;
  }

  public getCurrentTier(): PressureTier | null {
    return this.currentTier;
  }

  public isTransitioning(): boolean {
    return this.state !== null;
  }

  private beginTransition(targetTier: PressureTier): void {
    const targetDurationMs = TIER_DURATIONS_MS[targetTier];

    if (targetDurationMs === this.currentDurationMs) {
      this.currentTier = targetTier;
      this.state = null;
      return;
    }

    const deltaMs = Math.abs(targetDurationMs - this.currentDurationMs);
    const totalTicks = computeInterpolationTickCount(deltaMs);

    this.state = {
      fromTier: this.currentTier ?? targetTier,
      toTier: targetTier,
      fromDurationMs: this.currentDurationMs,
      toDurationMs: targetDurationMs,
      totalTicks,
      ticksRemaining: totalTicks,
    };

    this.currentTier = targetTier;
  }
}