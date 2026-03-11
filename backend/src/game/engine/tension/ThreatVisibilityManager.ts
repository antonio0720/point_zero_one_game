/* ========================================================================
 * POINT ZERO ONE — BACKEND THREAT VISIBILITY MANAGER
 * /backend/src/game/engine/tension/ThreatVisibilityManager.ts
 * ====================================================================== */

import {
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  VISIBILITY_ORDER,
  type PressureTier,
  type TensionVisibilityState,
} from './types';

export class ThreatVisibilityManager {
  private currentState: TensionVisibilityState =
    TENSION_VISIBILITY_STATE.SHADOWED;

  private previousState: TensionVisibilityState | null = null;

  private pendingDowngrade: TensionVisibilityState | null = null;

  private downgradeCountdownTicks = 0;

  private exposedStickyTicksRemaining = 0;

  public update(
    pressureTier: PressureTier,
    isNearDeath: boolean,
    counterIntelTier = 0,
  ): { state: TensionVisibilityState; changed: boolean } {
    const target = this.computeTargetState(
      pressureTier,
      isNearDeath,
      counterIntelTier,
    );

    if (this.isUpgrade(this.currentState, target)) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      return this.applyTransition(target);
    }

    if (target === this.currentState) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      return {
        state: this.currentState,
        changed: false,
      };
    }

    const adjacentDowngrade = this.getAdjacentLowerState(this.currentState);

    if (adjacentDowngrade === null) {
      return {
        state: this.currentState,
        changed: false,
      };
    }

    if (this.pendingDowngrade !== adjacentDowngrade) {
      this.pendingDowngrade = adjacentDowngrade;
      this.downgradeCountdownTicks =
        VISIBILITY_CONFIGS[this.currentState].visibilityDowngradeDelayTicks;

      return {
        state: this.currentState,
        changed: false,
      };
    }

    this.downgradeCountdownTicks = Math.max(0, this.downgradeCountdownTicks - 1);

    if (this.downgradeCountdownTicks === 0 && this.pendingDowngrade !== null) {
      const nextState = this.pendingDowngrade;
      this.pendingDowngrade = null;
      return this.applyTransition(nextState);
    }

    return {
      state: this.currentState,
      changed: false,
    };
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
      this.exposedStickyTicksRemaining = 1;
      return TENSION_VISIBILITY_STATE.EXPOSED;
    }

    if (
      this.currentState === TENSION_VISIBILITY_STATE.EXPOSED &&
      !isNearDeath &&
      this.exposedStickyTicksRemaining > 0
    ) {
      this.exposedStickyTicksRemaining -= 1;
      return TENSION_VISIBILITY_STATE.EXPOSED;
    }

    this.exposedStickyTicksRemaining = 0;

    const baseState = this.baseStateFromPressure(pressureTier);
    return this.applyCounterIntelPromotion(baseState, counterIntelTier);
  }

  private baseStateFromPressure(pressureTier: PressureTier): TensionVisibilityState {
    switch (pressureTier) {
      case 'T4':
      case 'T3':
      case 'T2':
        return TENSION_VISIBILITY_STATE.TELEGRAPHED;
      case 'T1':
        return TENSION_VISIBILITY_STATE.SIGNALED;
      case 'T0':
      default:
        return TENSION_VISIBILITY_STATE.SHADOWED;
    }
  }

  private applyCounterIntelPromotion(
    baseState: TensionVisibilityState,
    counterIntelTier: number,
  ): TensionVisibilityState {
    const bonusLevels = Math.max(0, Math.floor(counterIntelTier));
    const baseIndex = this.rank(baseState);
    const telegraphedIndex = this.rank(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    const nextIndex = Math.min(baseIndex + bonusLevels, telegraphedIndex);
    return VISIBILITY_ORDER[nextIndex] ?? TENSION_VISIBILITY_STATE.TELEGRAPHED;
  }

  private applyTransition(
    nextState: TensionVisibilityState,
  ): { state: TensionVisibilityState; changed: boolean } {
    if (nextState === this.currentState) {
      return {
        state: this.currentState,
        changed: false,
      };
    }

    this.previousState = this.currentState;
    this.currentState = nextState;

    return {
      state: this.currentState,
      changed: true,
    };
  }

  private getAdjacentLowerState(
    state: TensionVisibilityState,
  ): TensionVisibilityState | null {
    const index = this.rank(state);
    if (index <= 0) {
      return null;
    }
    return VISIBILITY_ORDER[index - 1] ?? null;
  }

  private isUpgrade(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
  ): boolean {
    return this.rank(to) > this.rank(from);
  }

  private rank(state: TensionVisibilityState): number {
    return VISIBILITY_ORDER.indexOf(state);
  }
}