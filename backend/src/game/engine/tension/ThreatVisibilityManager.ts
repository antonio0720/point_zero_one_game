/* ========================================================================
 * POINT ZERO ONE — BACKEND THREAT VISIBILITY MANAGER
 * /backend/src/game/engine/tension/ThreatVisibilityManager.ts
 * ====================================================================== */

import type { PressureTier } from '../core/GamePrimitives';
import {
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  VISIBILITY_ORDER,
  type TensionVisibilityState,
} from './types';

export interface VisibilityUpdateResult {
  readonly state: TensionVisibilityState;
  readonly changed: boolean;
  readonly previousState: TensionVisibilityState | null;
}

export class ThreatVisibilityManager {
  private currentState: TensionVisibilityState = TENSION_VISIBILITY_STATE.SHADOWED;
  private previousState: TensionVisibilityState | null = null;
  private pendingDowngrade: TensionVisibilityState | null = null;
  private downgradeCountdownTicks = 0;
  private exposedStickyTicksRemaining = 0;

  public update(
    pressureTier: PressureTier,
    isNearDeath: boolean,
    counterIntelTier: number = 0,
  ): VisibilityUpdateResult {
    const targetState = this.computeTargetState(
      pressureTier,
      isNearDeath,
      counterIntelTier,
    );

    if (
      this.currentState === TENSION_VISIBILITY_STATE.EXPOSED &&
      targetState !== TENSION_VISIBILITY_STATE.EXPOSED &&
      this.exposedStickyTicksRemaining > 0
    ) {
      this.exposedStickyTicksRemaining -= 1;
      return {
        state: this.currentState,
        changed: false,
        previousState: this.previousState,
      };
    }

    if (targetState === this.currentState) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      return {
        state: this.currentState,
        changed: false,
        previousState: this.previousState,
      };
    }

    if (this.isUpgrade(this.currentState, targetState)) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      if (targetState === TENSION_VISIBILITY_STATE.EXPOSED) {
        this.exposedStickyTicksRemaining = 1;
      }
      return this.applyTransition(targetState);
    }

    const nextLowerStep = this.oneStepDown(this.currentState);
    if (this.pendingDowngrade !== nextLowerStep) {
      this.pendingDowngrade = nextLowerStep;
      this.downgradeCountdownTicks =
        VISIBILITY_CONFIGS[this.currentState].visibilityDowngradeDelayTicks;
      return {
        state: this.currentState,
        changed: false,
        previousState: this.previousState,
      };
    }

    if (this.downgradeCountdownTicks > 0) {
      this.downgradeCountdownTicks -= 1;
      return {
        state: this.currentState,
        changed: false,
        previousState: this.previousState,
      };
    }

    this.pendingDowngrade = null;
    return this.applyTransition(nextLowerStep);
  }

  public getCurrentState(): TensionVisibilityState {
    return this.currentState;
  }

  public getPreviousState(): TensionVisibilityState | null {
    return this.previousState;
  }

  public getPendingDowngrade(): TensionVisibilityState | null {
    return this.pendingDowngrade;
  }

  public getDowngradeCountdown(): number {
    return this.downgradeCountdownTicks;
  }

  public getEnvelopeVisibilityLevel() {
    return INTERNAL_VISIBILITY_TO_ENVELOPE[this.currentState];
  }

  public reset(): void {
    this.currentState = TENSION_VISIBILITY_STATE.SHADOWED;
    this.previousState = null;
    this.pendingDowngrade = null;
    this.downgradeCountdownTicks = 0;
    this.exposedStickyTicksRemaining = 0;
  }

  private computeTargetState(
    pressureTier: PressureTier,
    isNearDeath: boolean,
    counterIntelTier: number,
  ): TensionVisibilityState {
    if (pressureTier === 'T4' && isNearDeath) {
      return TENSION_VISIBILITY_STATE.EXPOSED;
    }

    let baseState: TensionVisibilityState;
    switch (pressureTier) {
      case 'T4':
      case 'T3':
      case 'T2':
        baseState = TENSION_VISIBILITY_STATE.TELEGRAPHED;
        break;
      case 'T1':
        baseState = TENSION_VISIBILITY_STATE.SIGNALED;
        break;
      case 'T0':
      default:
        baseState = TENSION_VISIBILITY_STATE.SHADOWED;
        break;
    }

    const promotionSteps =
      counterIntelTier >= 3 ? 2 : counterIntelTier >= 2 ? 1 : 0;
    const baseIndex = VISIBILITY_ORDER.indexOf(baseState);
    const cappedIndex = Math.min(
      VISIBILITY_ORDER.indexOf(TENSION_VISIBILITY_STATE.TELEGRAPHED),
      baseIndex + promotionSteps,
    );

    return VISIBILITY_ORDER[cappedIndex] ?? baseState;
  }

  private isUpgrade(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
  ): boolean {
    return VISIBILITY_ORDER.indexOf(to) > VISIBILITY_ORDER.indexOf(from);
  }

  private oneStepDown(
    state: TensionVisibilityState,
  ): TensionVisibilityState {
    const currentIndex = VISIBILITY_ORDER.indexOf(state);
    const nextIndex = Math.max(0, currentIndex - 1);
    return VISIBILITY_ORDER[nextIndex] ?? TENSION_VISIBILITY_STATE.SHADOWED;
  }

  private applyTransition(
    nextState: TensionVisibilityState,
  ): VisibilityUpdateResult {
    this.previousState = this.currentState;
    this.currentState = nextState;

    return {
      state: this.currentState,
      changed: true,
      previousState: this.previousState,
    };
  }
}