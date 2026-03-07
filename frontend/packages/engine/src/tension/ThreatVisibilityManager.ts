/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/tension/ThreatVisibilityManager.ts
 * Controls the visibility state based on current pressure tier.
 * Implements 2-tick downgrade delay to prevent flickering.
 *
 * CRITICAL: NEVER imports PressureEngine class.
 * Takes PressureTier as a method argument — value passed in by EngineOrchestrator.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import {
  VisibilityState,
  PressureTier,
  VISIBILITY_CONFIGS,
} from './types';

export class ThreatVisibilityManager {
  private currentState: VisibilityState = VisibilityState.SHADOWED;
  private previousState: VisibilityState | null = null;

  // Downgrade delay tracking
  private pendingDowngrade: VisibilityState | null = null;
  private downgradeCountdownTicks: number = 0;

  // Death proximity — stored for reference, not for state derivation
  private isNearDeath: boolean = false;

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Called each tick by TensionEngine.computeTension().
   *
   * Rules:
   *   UPGRADE  → immediate, always snaps up on the same tick pressure crosses threshold.
   *   DOWNGRADE → delayed by 2 ticks (visibilityDowngradeDelayTicks from config).
   *               Prevents flickering when pressure bounces around a threshold.
   *   EXPOSED  → requires CRITICAL pressure AND isNearDeath (net worth < 25% of bankruptcy threshold).
   *
   * @param pressureTier  Current pressure tier — passed as VALUE, not imported class.
   * @param isNearDeath   True if player net worth < 25% of bankruptcy threshold.
   * @returns             { state, changed } — new visibility state and whether it transitioned.
   */
  public update(
    pressureTier: PressureTier,
    isNearDeath: boolean
  ): { state: VisibilityState; changed: boolean } {
    this.isNearDeath = isNearDeath;
    const target = this.computeTargetState(pressureTier, isNearDeath);

    // ── Upgrade: immediate ─────────────────────────────────────────
    if (this.isUpgrade(this.currentState, target)) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      return this.applyTransition(target);
    }

    // ── Same state: cancel any pending downgrade ───────────────────
    if (target === this.currentState) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      return { state: this.currentState, changed: false };
    }

    // ── Downgrade: delayed ─────────────────────────────────────────
    if (this.isDowngrade(this.currentState, target)) {
      if (this.pendingDowngrade !== target) {
        // New downgrade target — start countdown fresh
        this.pendingDowngrade = target;
        const delayTicks = VISIBILITY_CONFIGS[this.currentState].visibilityDowngradeDelayTicks;
        this.downgradeCountdownTicks = delayTicks;
      } else {
        // Countdown already running for this target — decrement
        this.downgradeCountdownTicks = Math.max(0, this.downgradeCountdownTicks - 1);
        if (this.downgradeCountdownTicks === 0 && this.pendingDowngrade !== null) {
          const finalTarget = this.pendingDowngrade;
          this.pendingDowngrade = null;
          return this.applyTransition(finalTarget);
        }
      }
    }

    return { state: this.currentState, changed: false };
  }

  // ── Target Resolution ──────────────────────────────────────────────────

  private computeTargetState(
    pressureTier: PressureTier,
    isNearDeath: boolean
  ): VisibilityState {
    // EXPOSED: requires CRITICAL + near-death simultaneously
    if (pressureTier === PressureTier.CRITICAL && isNearDeath) {
      return VisibilityState.EXPOSED;
    }
    // TELEGRAPHED: ELEVATED, HIGH, or CRITICAL (without near-death)
    if (
      pressureTier === PressureTier.ELEVATED ||
      pressureTier === PressureTier.HIGH ||
      pressureTier === PressureTier.CRITICAL
    ) {
      return VisibilityState.TELEGRAPHED;
    }
    // SIGNALED: BUILDING
    if (pressureTier === PressureTier.BUILDING) {
      return VisibilityState.SIGNALED;
    }
    // Default: SHADOWED (CALM pressure)
    return VisibilityState.SHADOWED;
  }

  // ── Transition Helpers ─────────────────────────────────────────────────

  private isUpgrade(from: VisibilityState, to: VisibilityState): boolean {
    const order = [
      VisibilityState.SHADOWED,
      VisibilityState.SIGNALED,
      VisibilityState.TELEGRAPHED,
      VisibilityState.EXPOSED,
    ];
    return order.indexOf(to) > order.indexOf(from);
  }

  private isDowngrade(from: VisibilityState, to: VisibilityState): boolean {
    return !this.isUpgrade(from, to) && from !== to;
  }

  private applyTransition(
    target: VisibilityState
  ): { state: VisibilityState; changed: boolean } {
    if (target === this.currentState) {
      return { state: this.currentState, changed: false };
    }
    this.previousState = this.currentState;
    this.currentState = target;
    return { state: target, changed: true };
  }

  // ── Read Accessors ─────────────────────────────────────────────────────

  public getCurrentState(): VisibilityState {
    return this.currentState;
  }

  public getPreviousState(): VisibilityState | null {
    return this.previousState;
  }

  public getPendingDowngrade(): VisibilityState | null {
    return this.pendingDowngrade;
  }

  public getDowngradeCountdown(): number {
    return this.downgradeCountdownTicks;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  public reset(): void {
    this.currentState = VisibilityState.SHADOWED;
    this.previousState = null;
    this.pendingDowngrade = null;
    this.downgradeCountdownTicks = 0;
    this.isNearDeath = false;
  }
}