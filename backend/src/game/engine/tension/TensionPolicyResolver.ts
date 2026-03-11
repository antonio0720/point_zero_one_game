/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND TENSION POLICY RESOLVER
 * /backend/src/game/engine/tension/TensionPolicyResolver.ts
 * ============================================================================
 *
 * Purpose:
 * - centralize Engine 3 policy decisions that should not be scattered across
 *   queue logic, UI adapters, and orchestration surfaces
 * - resolve visibility transitions, arrival timing defaults, action windows,
 *   mitigation defaults, and severity weighting
 *
 * Design:
 * - policy-only utility; no direct engine calls, no state mutation
 * - deterministic and serializable
 * - backend-safe and frontend-contract aware
 * ============================================================================
 */

import type { PressureTier, VisibilityLevel } from '../core/GamePrimitives';
import {
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  PRESSURE_TENSION_AMPLIFIERS,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  VISIBILITY_ORDER,
  type QueueUpsertInput,
  type ThreatSeverity,
  type ThreatType,
  type TensionVisibilityState,
  type VisibilityConfig,
} from './types';

export interface TensionVisibilityPolicyInput {
  readonly pressureTier: PressureTier;
  readonly isNearDeath: boolean;
  readonly currentTick: number;

  readonly currentState?: TensionVisibilityState;
  readonly pendingDowngradeState?: TensionVisibilityState | null;
  readonly pendingDowngradeTicksRemaining?: number;
  readonly lastExposedTick?: number | null;
}

export interface TensionVisibilityPolicyResult {
  readonly state: TensionVisibilityState;
  readonly previousState: TensionVisibilityState | null;
  readonly changed: boolean;

  readonly pendingDowngradeState: TensionVisibilityState | null;
  readonly pendingDowngradeTicksRemaining: number;
  readonly lastExposedTick: number | null;

  readonly awarenessBonus: number;
  readonly visibilityConfig: VisibilityConfig;
  readonly envelopeVisibility: VisibilityLevel;
  readonly stickyExposedApplied: boolean;
}

export interface ThreatSchedulePolicyInput {
  readonly currentTick: number;
  readonly pressureTier: PressureTier;
  readonly threatType: ThreatType;
  readonly preferredArrivalTick?: number | null;
  readonly isCascadeTriggered?: boolean;
}

export interface QueueUpsertBuildInput {
  readonly runId: string;
  readonly sourceKey: string;
  readonly threatId: string;
  readonly source: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly currentTick: number;
  readonly pressureTier: PressureTier;
  readonly preferredArrivalTick?: number | null;
  readonly isCascadeTriggered?: boolean;
  readonly cascadeTriggerEventId?: string | null;
  readonly worstCaseOutcome: string;
  readonly mitigationCardTypes?: readonly string[];
  readonly summary: string;
  readonly severityWeight?: number;
}

export class TensionPolicyResolver {
  public resolveVisibility(
    input: TensionVisibilityPolicyInput,
  ): TensionVisibilityPolicyResult {
    const currentState =
      input.currentState ?? TENSION_VISIBILITY_STATE.SHADOWED;
    const pendingDowngradeState = input.pendingDowngradeState ?? null;
    const pendingDowngradeTicksRemaining = Math.max(
      0,
      input.pendingDowngradeTicksRemaining ?? 0,
    );
    const previousState = currentState;
    const stickyExposedApplied =
      currentState === TENSION_VISIBILITY_STATE.EXPOSED &&
      input.lastExposedTick !== null &&
      input.lastExposedTick !== undefined &&
      input.currentTick === input.lastExposedTick + 1 &&
      input.pressureTier === 'T4' &&
      !input.isNearDeath;

    const targetState = stickyExposedApplied
      ? TENSION_VISIBILITY_STATE.EXPOSED
      : this.computeTargetVisibility(input.pressureTier, input.isNearDeath);

    if (this.isUpgrade(currentState, targetState)) {
      return this.buildVisibilityResult({
        state: targetState,
        previousState,
        changed: targetState !== currentState,
        pendingDowngradeState: null,
        pendingDowngradeTicksRemaining: 0,
        lastExposedTick:
          targetState === TENSION_VISIBILITY_STATE.EXPOSED
            ? input.currentTick
            : input.lastExposedTick ?? null,
        stickyExposedApplied,
      });
    }

    if (targetState === currentState) {
      return this.buildVisibilityResult({
        state: currentState,
        previousState: null,
        changed: false,
        pendingDowngradeState: null,
        pendingDowngradeTicksRemaining: 0,
        lastExposedTick:
          currentState === TENSION_VISIBILITY_STATE.EXPOSED
            ? input.lastExposedTick ?? input.currentTick
            : input.lastExposedTick ?? null,
        stickyExposedApplied,
      });
    }

    if (this.isDowngrade(currentState, targetState)) {
      if (pendingDowngradeState !== targetState) {
        return this.buildVisibilityResult({
          state: currentState,
          previousState: null,
          changed: false,
          pendingDowngradeState: targetState,
          pendingDowngradeTicksRemaining:
            VISIBILITY_CONFIGS[currentState].visibilityDowngradeDelayTicks,
          lastExposedTick: input.lastExposedTick ?? null,
          stickyExposedApplied,
        });
      }

      const nextCountdown = Math.max(0, pendingDowngradeTicksRemaining - 1);
      if (nextCountdown > 0) {
        return this.buildVisibilityResult({
          state: currentState,
          previousState: null,
          changed: false,
          pendingDowngradeState,
          pendingDowngradeTicksRemaining: nextCountdown,
          lastExposedTick: input.lastExposedTick ?? null,
          stickyExposedApplied,
        });
      }

      return this.buildVisibilityResult({
        state: targetState,
        previousState,
        changed: true,
        pendingDowngradeState: null,
        pendingDowngradeTicksRemaining: 0,
        lastExposedTick:
          targetState === TENSION_VISIBILITY_STATE.EXPOSED
            ? input.currentTick
            : input.lastExposedTick ?? null,
        stickyExposedApplied,
      });
    }

    return this.buildVisibilityResult({
      state: currentState,
      previousState: null,
      changed: false,
      pendingDowngradeState: null,
      pendingDowngradeTicksRemaining: 0,
      lastExposedTick: input.lastExposedTick ?? null,
      stickyExposedApplied,
    });
  }

  public computeTargetVisibility(
    pressureTier: PressureTier,
    isNearDeath: boolean,
  ): TensionVisibilityState {
    if (pressureTier === 'T4' && isNearDeath) {
      return TENSION_VISIBILITY_STATE.EXPOSED;
    }

    if (pressureTier === 'T2' || pressureTier === 'T3' || pressureTier === 'T4') {
      return TENSION_VISIBILITY_STATE.TELEGRAPHED;
    }

    if (pressureTier === 'T1') {
      return TENSION_VISIBILITY_STATE.SIGNALED;
    }

    return TENSION_VISIBILITY_STATE.SHADOWED;
  }

  public resolveActionWindow(threatType: ThreatType): number {
    switch (threatType) {
      case THREAT_TYPE.HATER_INJECTION:
      case THREAT_TYPE.SHIELD_PIERCE:
        return 0;

      case THREAT_TYPE.SABOTAGE:
      case THREAT_TYPE.REPUTATION_BURN:
      case THREAT_TYPE.CASCADE:
        return 1;

      case THREAT_TYPE.DEBT_SPIRAL:
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return 2;

      case THREAT_TYPE.SOVEREIGNTY:
        return 3;

      default:
        return 2;
    }
  }

  public resolveArrivalTick(input: ThreatSchedulePolicyInput): number {
    const defaultDelay = this.resolveDefaultArrivalDelay(
      input.threatType,
      input.pressureTier,
    );
    const preferredArrivalTick = input.preferredArrivalTick ?? input.currentTick + defaultDelay;
    const cascadeTriggered = input.isCascadeTriggered ?? false;

    if (cascadeTriggered) {
      return Math.max(input.currentTick + 1, preferredArrivalTick);
    }

    return Math.max(input.currentTick, preferredArrivalTick);
  }

  public resolveDefaultArrivalDelay(
    threatType: ThreatType,
    pressureTier: PressureTier,
  ): number {
    switch (threatType) {
      case THREAT_TYPE.HATER_INJECTION:
        return pressureTier === 'T4' ? 0 : 1;

      case THREAT_TYPE.SHIELD_PIERCE:
        return 0;

      case THREAT_TYPE.SABOTAGE:
      case THREAT_TYPE.REPUTATION_BURN:
        return 1;

      case THREAT_TYPE.CASCADE:
        return 1;

      case THREAT_TYPE.SOVEREIGNTY:
        return 6;

      case THREAT_TYPE.OPPORTUNITY_KILL:
        return 3;

      case THREAT_TYPE.DEBT_SPIRAL:
      default:
        return 4;
    }
  }

  public resolveMitigationCardTypes(
    threatType: ThreatType,
    requestedMitigationCardTypes?: readonly string[],
  ): readonly string[] {
    if (requestedMitigationCardTypes && requestedMitigationCardTypes.length > 0) {
      return Object.freeze([...requestedMitigationCardTypes]);
    }

    return Object.freeze([
      ...(THREAT_TYPE_DEFAULT_MITIGATIONS[threatType] ?? []),
    ]);
  }

  public resolveSeverityWeight(
    severity: ThreatSeverity,
    requestedSeverityWeight?: number,
  ): number {
    if (
      typeof requestedSeverityWeight === 'number' &&
      Number.isFinite(requestedSeverityWeight)
    ) {
      return this.clamp(requestedSeverityWeight, 0, 1);
    }

    return THREAT_SEVERITY_WEIGHTS[severity];
  }

  public resolveEnvelopeVisibility(
    state: TensionVisibilityState,
  ): VisibilityLevel {
    return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
  }

  public resolveAwarenessBonus(
    state: TensionVisibilityState,
  ): number {
    return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
  }

  public resolvePressureAmplifier(
    pressureTier: PressureTier,
  ): number {
    return PRESSURE_TENSION_AMPLIFIERS[pressureTier];
  }

  public buildQueueUpsertInput(
    input: QueueUpsertBuildInput,
  ): QueueUpsertInput {
    const mitigationCardTypes = this.resolveMitigationCardTypes(
      input.threatType,
      input.mitigationCardTypes,
    );
    const severityWeight = this.resolveSeverityWeight(
      input.threatSeverity,
      input.severityWeight,
    );
    const arrivalTick = this.resolveArrivalTick({
      currentTick: input.currentTick,
      pressureTier: input.pressureTier,
      threatType: input.threatType,
      preferredArrivalTick: input.preferredArrivalTick ?? null,
      isCascadeTriggered: input.isCascadeTriggered ?? false,
    });

    return Object.freeze({
      runId: input.runId,
      sourceKey: input.sourceKey,
      threatId: input.threatId,
      source: input.source,
      threatType: input.threatType,
      threatSeverity: input.threatSeverity,
      currentTick: input.currentTick,
      arrivalTick,
      isCascadeTriggered: input.isCascadeTriggered ?? false,
      cascadeTriggerEventId: input.cascadeTriggerEventId ?? null,
      worstCaseOutcome: input.worstCaseOutcome,
      mitigationCardTypes,
      summary: input.summary,
      severityWeight,
    });
  }

  private buildVisibilityResult(args: {
    readonly state: TensionVisibilityState;
    readonly previousState: TensionVisibilityState | null;
    readonly changed: boolean;
    readonly pendingDowngradeState: TensionVisibilityState | null;
    readonly pendingDowngradeTicksRemaining: number;
    readonly lastExposedTick: number | null;
    readonly stickyExposedApplied: boolean;
  }): TensionVisibilityPolicyResult {
    const visibilityConfig = VISIBILITY_CONFIGS[args.state];

    return Object.freeze({
      state: args.state,
      previousState: args.previousState,
      changed: args.changed,
      pendingDowngradeState: args.pendingDowngradeState,
      pendingDowngradeTicksRemaining: args.pendingDowngradeTicksRemaining,
      lastExposedTick: args.lastExposedTick,
      awarenessBonus: visibilityConfig.tensionAwarenessBonus,
      visibilityConfig,
      envelopeVisibility: INTERNAL_VISIBILITY_TO_ENVELOPE[args.state],
      stickyExposedApplied: args.stickyExposedApplied,
    });
  }

  private isUpgrade(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
  ): boolean {
    return this.visibilityIndex(to) > this.visibilityIndex(from);
  }

  private isDowngrade(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
  ): boolean {
    return this.visibilityIndex(to) < this.visibilityIndex(from);
  }

  private visibilityIndex(state: TensionVisibilityState): number {
    return VISIBILITY_ORDER.indexOf(state);
  }

  private clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }
}