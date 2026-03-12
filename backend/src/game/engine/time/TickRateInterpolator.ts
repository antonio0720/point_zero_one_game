/* ============================================================================
 * FILE: backend/src/game/engine/time/TickRateInterpolator.ts
 * POINT ZERO ONE — BACKEND ENGINE TIME
 *
 * Doctrine:
 * - backend cadence must not snap violently between pressure tiers
 * - interpolation is deterministic and tick-based, not wall-clock based
 * - if pressure changes again mid-transition, restart from current duration
 * - this class is stateful but resettable for replay / hot-run isolation
 * - forced/admin/tutorial overrides may hard-set a tier with zero interpolation
 * ========================================================================== */

import type { PressureTier } from '../core/GamePrimitives';
import { TIER_DURATIONS_MS, computeInterpolationTickCount } from './types';

interface MutableInterpolationState {
  readonly fromTier: PressureTier;
  readonly toTier: PressureTier;
  readonly fromDurationMs: number;
  readonly toDurationMs: number;
  readonly totalTicks: number;
  ticksRemaining: number;
}

export class TickRateInterpolator {
  private currentTier: PressureTier | null = null;
  private currentDurationMs = TIER_DURATIONS_MS.T1;
  private state: MutableInterpolationState | null = null;

  public constructor(initialTier: PressureTier = 'T1') {
    this.reset(initialTier);
  }

  public reset(initialTier: PressureTier = 'T1'): void {
    this.currentTier = initialTier;
    this.currentDurationMs = TIER_DURATIONS_MS[initialTier];
    this.state = null;
  }

  /**
   * Hard-sets the current tier and duration immediately.
   * Used for tutorial/admin/forced moments that must not interpolate.
   */
  public forceTier(tier: PressureTier): number {
    this.currentTier = tier;
    this.currentDurationMs = TIER_DURATIONS_MS[tier];
    this.state = null;

    return this.currentDurationMs;
  }

  /**
   * Resolves the authoritative duration for the current backend time step.
   * The first call seeds internal state.
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

    const {
      fromDurationMs,
      toDurationMs,
      totalTicks,
      ticksRemaining,
    } = this.state;

    const progress = (totalTicks - ticksRemaining + 1) / totalTicks;
    const interpolated =
      fromDurationMs + ((toDurationMs - fromDurationMs) * progress);

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

  public getTargetTier(): PressureTier | null {
    return this.state?.toTier ?? this.currentTier;
  }

  public getRemainingTransitionTicks(): number {
    return this.state?.ticksRemaining ?? 0;
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