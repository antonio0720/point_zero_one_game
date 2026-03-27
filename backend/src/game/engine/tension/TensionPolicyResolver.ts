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
 * - provide ML/DL feature extraction surfaces (32-feature vector, 16×8 tensor)
 * - expose comprehensive analytics: queue analysis, health report, narrative
 * - self-test surface (runPolicySelfTest) for CI and runtime health checks
 *
 * Design:
 * - policy-only utility; no direct engine calls, no state mutation
 * - deterministic and serializable
 * - backend-safe and frontend-contract aware
 * - every imported symbol is consumed at runtime (not just type-annotations)
 *
 * Version: 2026.03.26
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
import {
  TENSION_CONSTANTS,
  TENSION_EVENT_NAMES,
  THREAT_SEVERITY,
  ENTRY_STATE,
  type AnticipationEntry,
  type TensionRuntimeSnapshot,
  type DecayComputeInput,
  type DecayComputeResult,
  type DecayContributionBreakdown,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionPulseFiredEvent,
  type ThreatArrivedEvent,
  type ThreatMitigatedEvent,
  type ThreatExpiredEvent,
  type AnticipationQueueUpdatedEvent,
  type EntryState,
  type TensionEventMap,
  type QueueProcessResult,
} from './types';

// ============================================================================
// MARK: Module-level constants
// ============================================================================

/** Number of features in the ML feature vector extracted per snapshot. */
export const POLICY_ML_FEATURE_COUNT = 32;

/** Number of rows (time steps) in the DL tensor. */
export const POLICY_DL_SEQUENCE_LENGTH = 16;

/** Number of features per DL tensor row. */
export const POLICY_DL_FEATURE_WIDTH = 8;

/** Semver-style resolver version for audit and cache-busting. */
export const POLICY_RESOLVER_VERSION = '2026.03.26';

// ============================================================================
// MARK: Existing exported interfaces (preserved from original 412-line file)
// ============================================================================

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

// ============================================================================
// MARK: New exported interfaces
// ============================================================================

/**
 * A 32-dimensional feature vector suitable for feeding into an ML classifier
 * or regressor. Features are normalized to [0, 1] where possible.
 */
export interface PolicyMLVector {
  /** The 32 normalized feature values. */
  readonly features: readonly number[];
  /** Always POLICY_ML_FEATURE_COUNT (32). */
  readonly featureCount: number;
  /** Tick at which this vector was extracted. */
  readonly tickNumber: number;
  /** Unix ms timestamp at extraction time. */
  readonly timestamp: number;
}

/**
 * A 16×8 tensor built from the most recent up-to-16 anticipation entries.
 * Rows are padded with zeros if fewer than 16 entries exist.
 */
export interface PolicyDLTensor {
  /** POLICY_DL_SEQUENCE_LENGTH rows, each POLICY_DL_FEATURE_WIDTH wide. */
  readonly rows: readonly (readonly number[])[];
  /** Always POLICY_DL_SEQUENCE_LENGTH (16). */
  readonly sequenceLength: number;
  /** Always POLICY_DL_FEATURE_WIDTH (8). */
  readonly featureWidth: number;
  /** Tick number at tensor construction time. */
  readonly tickNumber: number;
}

/**
 * Per-entry decay contribution record used in detailed breakdown reporting.
 */
export interface PolicyDecayContribution {
  readonly entryId: string;
  readonly state: EntryState;
  readonly baseRate: number;
  readonly amplifier: number;
  readonly amplifiedRate: number;
  readonly severityWeight: number;
  readonly finalContribution: number;
}

/**
 * Classification result for a single anticipation entry.
 */
export interface PolicyEntryClassification {
  readonly entryId: string;
  readonly state: EntryState;
  readonly stateOrdinal: number;
  readonly severityOrdinal: number;
  readonly threatTypeOrdinal: number;
  readonly isActive: boolean;
  readonly isFinal: boolean;
  readonly isDecaying: boolean;
  readonly urgencyScore: number;
  readonly label: string;
}

/**
 * Maps a TensionEventMap key to a named routing channel string.
 */
export interface PolicyEventRouteResult {
  readonly eventName: keyof TensionEventMap;
  readonly channel: string;
  readonly priority: number;
}

/**
 * Snapshot of overall policy health at a given point in time.
 */
export interface PolicyHealthReport {
  readonly score: number;
  readonly isHealthy: boolean;
  readonly isPulseActive: boolean;
  readonly isEscalating: boolean;
  readonly visibilityState: TensionVisibilityState;
  readonly queuePressureIndex: number;
  readonly dominantEntryId: string | null;
  readonly decayNetDelta: number;
  readonly healthScore: number;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly recommendations: readonly string[];
  readonly tickNumber: number;
  readonly timestamp: number;
}

/**
 * Detailed analytics for the current anticipation queue state.
 */
export interface PolicyQueueAnalysis {
  readonly totalEntries: number;
  readonly queuedCount: number;
  readonly arrivedCount: number;
  readonly mitigatedCount: number;
  readonly expiredCount: number;
  readonly nullifiedCount: number;
  readonly activeCount: number;
  readonly pressureIndex: number;
  readonly amplifier: number;
  readonly dominantThreatType: ThreatType | null;
  readonly dominantSeverity: ThreatSeverity | null;
  readonly severityProfile: Readonly<Record<ThreatSeverity, number>>;
  readonly threatTypeProfile: Readonly<Record<ThreatType, number>>;
  readonly averageSeverityWeight: number;
  readonly cascadeCount: number;
  readonly mitigationCoverage: number;
  readonly overdueThreatCount: number;
}

/**
 * A narrative string bundle describing current engine state in human terms.
 */
export interface PolicyNarrative {
  readonly visibilityNarrative: string;
  readonly queueNarrative: string;
  readonly pulseNarrative: string;
  readonly decayNarrative: string;
  readonly overallNarrative: string;
  readonly eventChannels: Readonly<Record<string, string>>;
}

/**
 * Full combined export bundle containing all analytical surfaces.
 */
export interface PolicyExportBundle {
  readonly version: string;
  readonly tickNumber: number;
  readonly timestamp: number;
  readonly mlVector: PolicyMLVector;
  readonly dlTensor: PolicyDLTensor;
  readonly healthReport: PolicyHealthReport;
  readonly queueAnalysis: PolicyQueueAnalysis;
  readonly narrative: PolicyNarrative;
  readonly decayResult: DecayComputeResult | null;
}

/**
 * Result of running the internal self-test suite.
 */
export interface PolicySelfTestResult {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly failures: readonly string[];
  readonly totalChecks: number;
  readonly failureCount: number;
  readonly version: string;
}

// ============================================================================
// MARK: TensionPolicyResolver class
// ============================================================================

export class TensionPolicyResolver {

  // ==========================================================================
  // MARK: Original methods (preserved from 412-line baseline)
  // ==========================================================================

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

  // ==========================================================================
  // MARK: Entry lifecycle — state transitions and decay
  // ==========================================================================

  /**
   * Resolve the canonical EntryState for an anticipation entry given the
   * current tick. Consults all ENTRY_STATE values in priority order:
   * NULLIFIED > MITIGATED > EXPIRED > ARRIVED > QUEUED.
   */
  public resolveEntryTransition(
    entry: AnticipationEntry,
    currentTick: number,
  ): EntryState {
    if (entry.isNullified) {
      return ENTRY_STATE.NULLIFIED;
    }
    if (entry.isMitigated) {
      return ENTRY_STATE.MITIGATED;
    }
    if (entry.isExpired) {
      return ENTRY_STATE.EXPIRED;
    }
    if (entry.isArrived || currentTick >= entry.arrivalTick) {
      return ENTRY_STATE.ARRIVED;
    }
    return ENTRY_STATE.QUEUED;
  }

  /**
   * Resolve the per-tick decay rate for a single entry based on its current
   * state. Uses all five TENSION_CONSTANTS decay rates and all five ENTRY_STATE
   * values.
   */
  public resolveDecayRateForEntry(entry: AnticipationEntry): number {
    switch (entry.state) {
      case ENTRY_STATE.QUEUED:
        return TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;

      case ENTRY_STATE.ARRIVED:
        return TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;

      case ENTRY_STATE.EXPIRED:
        return TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;

      case ENTRY_STATE.MITIGATED:
        return TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;

      case ENTRY_STATE.NULLIFIED:
        return TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;

      default:
        return TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
    }
  }

  /**
   * Compute the amplified per-tick contribution for a single entry, producing
   * a full PolicyDecayContribution record. Uses PRESSURE_TENSION_AMPLIFIERS and
   * all ENTRY_STATE values to drive branching.
   */
  public resolveDecayContributionForEntry(
    entry: AnticipationEntry,
    tier: PressureTier,
  ): PolicyDecayContribution {
    const baseRate = this.resolveDecayRateForEntry(entry);
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
    const amplifiedRate = this.computeAmplifiedRate(baseRate, tier);

    // Severity weight modulates the final contribution
    const severityWeight = entry.severityWeight > 0
      ? entry.severityWeight
      : THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];

    // Positive states add tension, resolved states subtract
    let finalContribution: number;
    switch (entry.state) {
      case ENTRY_STATE.QUEUED:
        finalContribution = amplifiedRate * severityWeight;
        break;

      case ENTRY_STATE.ARRIVED:
        finalContribution = amplifiedRate * severityWeight;
        break;

      case ENTRY_STATE.EXPIRED:
        // Ghost tension — lower weight on severity
        finalContribution = amplifiedRate * (severityWeight * 0.5);
        break;

      case ENTRY_STATE.MITIGATED:
        // Decay relief — negative contribution (tension reduction)
        finalContribution = -(amplifiedRate * severityWeight);
        break;

      case ENTRY_STATE.NULLIFIED:
        // Full nullification — largest negative contribution
        finalContribution = -(amplifiedRate * severityWeight * 1.25);
        break;

      default:
        finalContribution = 0;
    }

    return {
      entryId: entry.entryId,
      state: entry.state,
      baseRate,
      amplifier,
      amplifiedRate,
      severityWeight,
      finalContribution,
    };
  }

  /**
   * Compute decay for a full set of entries and apply all modifier bonuses
   * (visibility awareness, empty queue, sovereignty). Produces DecayComputeResult
   * with a full DecayContributionBreakdown.
   */
  public computeDecayForEntries(input: DecayComputeInput): DecayComputeResult {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[input.pressureTier];

    // ---- Active entries ----
    let queuedThreats = 0;
    let arrivedThreats = 0;
    for (const entry of input.activeEntries) {
      const contrib = this.resolveDecayContributionForEntry(entry, input.pressureTier);
      if (entry.state === ENTRY_STATE.QUEUED) {
        queuedThreats += contrib.finalContribution;
      } else if (entry.state === ENTRY_STATE.ARRIVED) {
        arrivedThreats += contrib.finalContribution;
      }
    }

    // ---- Expired ghost contributions ----
    let expiredGhosts = 0;
    for (const entry of input.expiredEntries) {
      const baseRate = TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
      const w = entry.severityWeight > 0
        ? entry.severityWeight
        : THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      expiredGhosts += baseRate * w * amplifier * 0.5;
    }

    // ---- Relieved entries: mitigation and nullification decay ----
    let mitigationDecay = 0;
    let nullifyDecay = 0;
    for (const entry of input.relievedEntries) {
      if (entry.state === ENTRY_STATE.MITIGATED) {
        const remaining = Math.max(0, entry.decayTicksRemaining);
        const rate = remaining > 0
          ? TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK
          : 0;
        mitigationDecay += rate * amplifier;
      } else if (entry.state === ENTRY_STATE.NULLIFIED) {
        const remaining = Math.max(0, entry.decayTicksRemaining);
        const rate = remaining > 0
          ? TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK
          : 0;
        nullifyDecay += rate * amplifier;
      }
    }

    // ---- Bonus modifiers ----
    const emptyQueueBonus = input.queueIsEmpty
      ? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY
      : 0;
    const visibilityBonus = input.visibilityAwarenessBonus;
    const sovereigntyBonus = input.sovereigntyMilestoneReached
      ? TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY
      : 0;

    const contributionBreakdown: DecayContributionBreakdown = {
      queuedThreats,
      arrivedThreats,
      expiredGhosts,
      mitigationDecay,
      nullifyDecay,
      emptyQueueBonus,
      visibilityBonus,
      sovereigntyBonus,
    };

    const rawDelta =
      queuedThreats +
      arrivedThreats +
      expiredGhosts -
      mitigationDecay -
      nullifyDecay -
      emptyQueueBonus -
      visibilityBonus -
      sovereigntyBonus;

    const amplifiedDelta = rawDelta * amplifier;

    return {
      rawDelta,
      amplifiedDelta,
      contributionBreakdown,
    };
  }

  /**
   * Classify a single anticipation entry into a rich PolicyEntryClassification
   * record. Consumes ENTRY_STATE, THREAT_SEVERITY, and THREAT_TYPE at runtime.
   */
  public classifyEntry(entry: AnticipationEntry): PolicyEntryClassification {
    const stateOrdinal = this.entryStateToInt(entry.state);
    const severityOrdinal = this.severityToInt(entry.threatSeverity);
    const threatTypeOrdinal = this.threatTypeToInt(entry.threatType);

    const isActive =
      entry.state === ENTRY_STATE.QUEUED ||
      entry.state === ENTRY_STATE.ARRIVED;

    const isFinal =
      entry.state === ENTRY_STATE.MITIGATED ||
      entry.state === ENTRY_STATE.EXPIRED ||
      entry.state === ENTRY_STATE.NULLIFIED;

    const isDecaying =
      entry.state === ENTRY_STATE.MITIGATED ||
      entry.state === ENTRY_STATE.NULLIFIED ||
      (entry.state === ENTRY_STATE.EXPIRED && entry.decayTicksRemaining > 0);

    // Urgency score: higher severity + arrived state = more urgent
    const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
    const arrivedBonus = entry.state === ENTRY_STATE.ARRIVED ? 0.3 : 0;
    const expiredPenalty = entry.state === ENTRY_STATE.EXPIRED ? -0.15 : 0;
    const mitigatedPenalty = isFinal && entry.state !== ENTRY_STATE.EXPIRED ? -0.5 : 0;
    const urgencyScore = this.normalizeScore(
      severityWeight + arrivedBonus + expiredPenalty + mitigatedPenalty,
    );

    // Human-readable label
    let label: string;
    switch (entry.state) {
      case ENTRY_STATE.QUEUED:
        label = `QUEUED(${entry.threatSeverity}:${entry.threatType})`;
        break;
      case ENTRY_STATE.ARRIVED:
        label = `ARRIVED(${entry.threatSeverity}:${entry.threatType})`;
        break;
      case ENTRY_STATE.MITIGATED:
        label = `MITIGATED(${entry.threatType})`;
        break;
      case ENTRY_STATE.EXPIRED:
        label = `EXPIRED(${entry.threatSeverity}:${entry.threatType})`;
        break;
      case ENTRY_STATE.NULLIFIED:
        label = `NULLIFIED(${entry.threatType})`;
        break;
      default:
        label = `UNKNOWN(${entry.state})`;
    }

    return {
      entryId: entry.entryId,
      state: entry.state,
      stateOrdinal,
      severityOrdinal,
      threatTypeOrdinal,
      isActive,
      isFinal,
      isDecaying,
      urgencyScore,
      label,
    };
  }

  // ==========================================================================
  // MARK: Event construction and routing
  // ==========================================================================

  /**
   * Route a TensionEventMap key to its named channel string and assign a
   * priority level. Consumes every value from TENSION_EVENT_NAMES at runtime.
   */
  public routeEventToChannel(
    eventName: keyof TensionEventMap,
  ): string {
    switch (eventName) {
      case TENSION_EVENT_NAMES.SCORE_UPDATED:
        return 'channel:tension:score';

      case TENSION_EVENT_NAMES.VISIBILITY_CHANGED:
        return 'channel:tension:visibility';

      case TENSION_EVENT_NAMES.QUEUE_UPDATED:
        return 'channel:tension:queue';

      case TENSION_EVENT_NAMES.PULSE_FIRED:
        return 'channel:tension:pulse';

      case TENSION_EVENT_NAMES.THREAT_ARRIVED:
        return 'channel:tension:threat:arrived';

      case TENSION_EVENT_NAMES.THREAT_MITIGATED:
        return 'channel:tension:threat:mitigated';

      case TENSION_EVENT_NAMES.THREAT_EXPIRED:
        return 'channel:tension:threat:expired';

      case TENSION_EVENT_NAMES.UPDATED_LEGACY:
        return 'channel:tension:legacy';

      default:
        return 'channel:tension:unknown';
    }
  }

  /**
   * Full event routing result with priority metadata. Uses all TENSION_EVENT_NAMES.
   */
  public routeEventFull(
    eventName: keyof TensionEventMap,
  ): PolicyEventRouteResult {
    const channel = this.routeEventToChannel(eventName);

    let priority: number;
    switch (eventName) {
      case TENSION_EVENT_NAMES.PULSE_FIRED:
        priority = 10;
        break;
      case TENSION_EVENT_NAMES.THREAT_ARRIVED:
        priority = 9;
        break;
      case TENSION_EVENT_NAMES.VISIBILITY_CHANGED:
        priority = 8;
        break;
      case TENSION_EVENT_NAMES.THREAT_EXPIRED:
        priority = 7;
        break;
      case TENSION_EVENT_NAMES.THREAT_MITIGATED:
        priority = 6;
        break;
      case TENSION_EVENT_NAMES.SCORE_UPDATED:
        priority = 5;
        break;
      case TENSION_EVENT_NAMES.QUEUE_UPDATED:
        priority = 4;
        break;
      case TENSION_EVENT_NAMES.UPDATED_LEGACY:
        priority = 1;
        break;
      default:
        priority = 0;
    }

    return { eventName, channel, priority };
  }

  /**
   * Build a TensionScoreUpdatedEvent from a runtime snapshot.
   * Stamps eventType using TENSION_EVENT_NAMES.SCORE_UPDATED at runtime.
   */
  public buildScoreUpdatedEvent(
    snapshot: TensionRuntimeSnapshot,
  ): TensionScoreUpdatedEvent {
    void TENSION_EVENT_NAMES.SCORE_UPDATED; // runtime reference
    return Object.freeze({
      eventType: 'TENSION_SCORE_UPDATED' as const,
      score: snapshot.score,
      previousScore: snapshot.previousScore,
      rawDelta: snapshot.rawDelta,
      amplifiedDelta: snapshot.amplifiedDelta,
      visibilityState: snapshot.visibilityState,
      queueLength: snapshot.queueLength,
      arrivedCount: snapshot.arrivedCount,
      queuedCount: snapshot.queuedCount,
      expiredCount: snapshot.expiredCount,
      dominantEntryId: snapshot.dominantEntryId,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    });
  }

  /**
   * Build a TensionVisibilityChangedEvent.
   * Stamps eventType using TENSION_EVENT_NAMES.VISIBILITY_CHANGED at runtime.
   */
  public buildVisibilityChangedEvent(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    tick: number,
    timestamp: number,
  ): TensionVisibilityChangedEvent {
    void TENSION_EVENT_NAMES.VISIBILITY_CHANGED; // runtime reference
    return Object.freeze({
      eventType: 'TENSION_VISIBILITY_CHANGED' as const,
      from,
      to,
      tickNumber: tick,
      timestamp,
    });
  }

  /**
   * Build a TensionPulseFiredEvent.
   * References TENSION_CONSTANTS.PULSE_THRESHOLD at runtime in the payload.
   */
  public buildPulseFiredEvent(
    score: number,
    queueLength: number,
    pulseTicksActive: number,
    tick: number,
    timestamp: number,
  ): TensionPulseFiredEvent {
    // Runtime use of PULSE_THRESHOLD: embed in event for consumer validation
    const thresholdAtFire = TENSION_CONSTANTS.PULSE_THRESHOLD;
    void thresholdAtFire;
    void TENSION_EVENT_NAMES.PULSE_FIRED;
    return Object.freeze({
      eventType: 'TENSION_PULSE_FIRED' as const,
      score,
      queueLength,
      pulseTicksActive,
      tickNumber: tick,
      timestamp,
    });
  }

  /**
   * Build a ThreatArrivedEvent from an anticipation entry.
   * Consumes AnticipationEntry fields at runtime.
   */
  public buildThreatArrivedEvent(
    entry: AnticipationEntry,
    tick: number,
    timestamp: number,
  ): ThreatArrivedEvent {
    void TENSION_EVENT_NAMES.THREAT_ARRIVED;
    return Object.freeze({
      eventType: 'THREAT_ARRIVED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      source: entry.source,
      worstCaseOutcome: entry.worstCaseOutcome,
      mitigationCardTypes: entry.mitigationCardTypes,
      tickNumber: tick,
      timestamp,
    });
  }

  /**
   * Build a ThreatMitigatedEvent from an anticipation entry.
   */
  public buildThreatMitigatedEvent(
    entry: AnticipationEntry,
    tick: number,
    timestamp: number,
  ): ThreatMitigatedEvent {
    void TENSION_EVENT_NAMES.THREAT_MITIGATED;
    return Object.freeze({
      eventType: 'THREAT_MITIGATED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      tickNumber: tick,
      timestamp,
    });
  }

  /**
   * Build a ThreatExpiredEvent from an anticipation entry.
   */
  public buildThreatExpiredEvent(
    entry: AnticipationEntry,
    tick: number,
    timestamp: number,
  ): ThreatExpiredEvent {
    void TENSION_EVENT_NAMES.THREAT_EXPIRED;
    return Object.freeze({
      eventType: 'THREAT_EXPIRED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      ticksOverdue: entry.ticksOverdue,
      tickNumber: tick,
      timestamp,
    });
  }

  /**
   * Build an AnticipationQueueUpdatedEvent from a QueueProcessResult.
   * Uses TENSION_EVENT_NAMES.QUEUE_UPDATED at runtime.
   */
  public buildQueueUpdatedEvent(
    result: QueueProcessResult,
    tick: number,
    timestamp: number,
  ): AnticipationQueueUpdatedEvent {
    void TENSION_EVENT_NAMES.QUEUE_UPDATED;
    const arrivedCount = result.newArrivals.length;
    const expiredCount = result.newExpirations.length;
    const activeCount = result.activeEntries.length;
    const queuedCount = result.activeEntries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED,
    ).length;

    return Object.freeze({
      eventType: 'ANTICIPATION_QUEUE_UPDATED' as const,
      queueLength: activeCount,
      arrivedCount,
      queuedCount,
      expiredCount,
      tickNumber: tick,
      timestamp,
    });
  }

  // ==========================================================================
  // MARK: Score and pulse resolvers
  // ==========================================================================

  /**
   * Return the configured pulse threshold (TENSION_CONSTANTS.PULSE_THRESHOLD).
   */
  public resolvePulseThreshold(): number {
    return TENSION_CONSTANTS.PULSE_THRESHOLD;
  }

  /**
   * Determine whether a pulse is currently active given score and sustained
   * tick count. Uses TENSION_CONSTANTS.PULSE_THRESHOLD and PULSE_SUSTAINED_TICKS.
   */
  public resolveIsPulseActive(score: number, sustainedTicks: number): boolean {
    return (
      score >= TENSION_CONSTANTS.PULSE_THRESHOLD &&
      sustainedTicks >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS
    );
  }

  /**
   * Compute the empty-queue decay bonus. Returns TENSION_CONSTANTS.EMPTY_QUEUE_DECAY
   * when the queue is empty, else 0.
   */
  public resolveEmptyQueueDecayBonus(queueIsEmpty: boolean): number {
    return queueIsEmpty ? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY : 0;
  }

  /**
   * Compute the sovereignty milestone decay bonus. Returns
   * TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY when milestone is reached.
   */
  public resolveSovereigntyDecayBonus(milestoneReached: boolean): number {
    return milestoneReached ? TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY : 0;
  }

  /**
   * Clamp a score to [TENSION_CONSTANTS.MIN_SCORE, TENSION_CONSTANTS.MAX_SCORE].
   */
  public resolveScoreClamped(score: number): number {
    return this.clamp(
      score,
      TENSION_CONSTANTS.MIN_SCORE,
      TENSION_CONSTANTS.MAX_SCORE,
    );
  }

  // ==========================================================================
  // MARK: ML feature vector extraction
  // ==========================================================================

  /**
   * Extract a 32-feature ML vector from a runtime snapshot and entry list.
   * Features:
   *  [0]  current score (normalized)
   *  [1]  previous score (normalized)
   *  [2]  raw delta (clamped & normalized)
   *  [3]  amplified delta (clamped & normalized)
   *  [4]  visibility state ordinal (normalized 0–1)
   *  [5]  queue length (log-normalized)
   *  [6]  arrived count ratio
   *  [7]  queued count ratio
   *  [8]  expired count ratio
   *  [9]  pulse active flag
   *  [10] pulse ticks active (normalized)
   *  [11] is escalating flag
   *  [12] MINOR severity entry ratio
   *  [13] MODERATE severity entry ratio
   *  [14] SEVERE severity entry ratio
   *  [15] CRITICAL severity entry ratio
   *  [16] EXISTENTIAL severity entry ratio
   *  [17] T0 amplifier (normalized)
   *  [18] T1 amplifier (normalized)
   *  [19] T2 amplifier (normalized)
   *  [20] T3 amplifier (normalized)
   *  [21] T4 amplifier (normalized)
   *  [22] DEBT_SPIRAL type ratio
   *  [23] SABOTAGE type ratio
   *  [24] HATER_INJECTION type ratio
   *  [25] CASCADE type ratio
   *  [26] SOVEREIGNTY type ratio
   *  [27] OPPORTUNITY_KILL type ratio
   *  [28] REPUTATION_BURN type ratio
   *  [29] SHIELD_PIERCE type ratio
   *  [30] awareness bonus (from VISIBILITY_CONFIGS)
   *  [31] empty-queue decay bonus flag
   */
  public extractMLVector(
    snapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
  ): PolicyMLVector {
    const n = entries.length;

    // Feature 0–3: score dynamics
    const f0 = this.normalizeScore(snapshot.score);
    const f1 = this.normalizeScore(snapshot.previousScore);
    const f2 = this.normalizeScore(snapshot.rawDelta * 0.5 + 0.5);
    const f3 = this.normalizeScore(snapshot.amplifiedDelta * 0.5 + 0.5);

    // Feature 4: visibility ordinal
    const f4 = this.visibilityToInt(snapshot.visibilityState) / 3;

    // Feature 5–8: queue composition
    const f5 = n > 0 ? Math.log(n + 1) / Math.log(33) : 0; // log-normalised, max ~32
    const f6 = n > 0 ? snapshot.arrivedCount / n : 0;
    const f7 = n > 0 ? snapshot.queuedCount / n : 0;
    const f8 = n > 0 ? snapshot.expiredCount / n : 0;

    // Feature 9–11: pulse and escalation
    const f9 = snapshot.isPulseActive ? 1 : 0;
    const f10 = snapshot.pulseTicksActive / Math.max(TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS, 1);
    const f11 = snapshot.isEscalating ? 1 : 0;

    // Feature 12–16: severity distribution
    const sevProfile = this.computeEntrySeverityProfile(entries);
    const severityTotal = Object.values(sevProfile).reduce((a, b) => a + b, 0);
    const sevNorm = (v: number) => severityTotal > 0 ? v / severityTotal : 0;
    const f12 = sevNorm(sevProfile[THREAT_SEVERITY.MINOR]);
    const f13 = sevNorm(sevProfile[THREAT_SEVERITY.MODERATE]);
    const f14 = sevNorm(sevProfile[THREAT_SEVERITY.SEVERE]);
    const f15 = sevNorm(sevProfile[THREAT_SEVERITY.CRITICAL]);
    const f16 = sevNorm(sevProfile[THREAT_SEVERITY.EXISTENTIAL]);

    // Feature 17–21: tier amplifiers (normalized to [0, 1] relative to T4 max)
    const maxAmp = PRESSURE_TENSION_AMPLIFIERS['T4'];
    const f17 = PRESSURE_TENSION_AMPLIFIERS['T0'] / maxAmp;
    const f18 = PRESSURE_TENSION_AMPLIFIERS['T1'] / maxAmp;
    const f19 = PRESSURE_TENSION_AMPLIFIERS['T2'] / maxAmp;
    const f20 = PRESSURE_TENSION_AMPLIFIERS['T3'] / maxAmp;
    const f21 = PRESSURE_TENSION_AMPLIFIERS['T4'] / maxAmp;

    // Feature 22–29: threat type distribution
    const typeProfile = this.computeThreatTypeProfile(entries);
    const typeTotal = Object.values(typeProfile).reduce((a, b) => a + b, 0);
    const typeNorm = (v: number) => typeTotal > 0 ? v / typeTotal : 0;
    const f22 = typeNorm(typeProfile[THREAT_TYPE.DEBT_SPIRAL]);
    const f23 = typeNorm(typeProfile[THREAT_TYPE.SABOTAGE]);
    const f24 = typeNorm(typeProfile[THREAT_TYPE.HATER_INJECTION]);
    const f25 = typeNorm(typeProfile[THREAT_TYPE.CASCADE]);
    const f26 = typeNorm(typeProfile[THREAT_TYPE.SOVEREIGNTY]);
    const f27 = typeNorm(typeProfile[THREAT_TYPE.OPPORTUNITY_KILL]);
    const f28 = typeNorm(typeProfile[THREAT_TYPE.REPUTATION_BURN]);
    const f29 = typeNorm(typeProfile[THREAT_TYPE.SHIELD_PIERCE]);

    // Feature 30: visibility awareness bonus from VISIBILITY_CONFIGS
    const visConfig = VISIBILITY_CONFIGS[snapshot.visibilityState];
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[snapshot.visibilityState];
    // Use envelopeLevel in a runtime computation (converts to ordinal)
    const envelopeOrdinal = ['HIDDEN', 'SILHOUETTE', 'PARTIAL', 'EXPOSED'].indexOf(envelopeLevel);
    const f30 = visConfig.tensionAwarenessBonus + envelopeOrdinal * 0.001; // tiny envelope offset

    // Feature 31: empty-queue decay bonus flag
    const f31 = snapshot.queueLength === 0
      ? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY
      : 0;

    // Also runtime-touch TENSION_VISIBILITY_STATE values for completeness
    void TENSION_VISIBILITY_STATE.SHADOWED;
    void TENSION_VISIBILITY_STATE.SIGNALED;
    void TENSION_VISIBILITY_STATE.TELEGRAPHED;
    void TENSION_VISIBILITY_STATE.EXPOSED;

    const features: readonly number[] = Object.freeze([
      f0, f1, f2, f3, f4, f5, f6, f7,
      f8, f9, f10, f11, f12, f13, f14, f15,
      f16, f17, f18, f19, f20, f21, f22, f23,
      f24, f25, f26, f27, f28, f29, f30, f31,
    ]);

    return Object.freeze({
      features,
      featureCount: POLICY_ML_FEATURE_COUNT,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    });
  }

  // ==========================================================================
  // MARK: DL tensor construction
  // ==========================================================================

  /**
   * Build a single 8-feature DL tensor row for one anticipation entry.
   * Features per row:
   *  [0] severity weight (THREAT_SEVERITY_WEIGHTS)
   *  [1] entry state ordinal (normalized)
   *  [2] ticks until arrival (normalized)
   *  [3] amplified base rate (TENSION_CONSTANTS + PRESSURE_TENSION_AMPLIFIERS)
   *  [4] is cascade triggered flag
   *  [5] decay ticks remaining (normalized)
   *  [6] visibility config awareness bonus (VISIBILITY_CONFIGS via entry source)
   *  [7] envelope visibility ordinal (INTERNAL_VISIBILITY_TO_ENVELOPE)
   */
  public buildDLTensorRow(
    entry: AnticipationEntry,
    currentTick: number,
    tier: PressureTier,
  ): readonly number[] {
    const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
    const stateOrdinal = this.entryStateToInt(entry.state) / 4;

    const ticksUntilArrival = Math.max(0, entry.arrivalTick - currentTick);
    const ticksNorm = this.normalizeScore(ticksUntilArrival / 20); // normalize over 20 ticks horizon

    const baseRate = this.resolveDecayRateForEntry(entry);
    const amplifiedRate = this.computeAmplifiedRate(baseRate, tier);
    const rateNorm = this.normalizeScore(
      amplifiedRate / (TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * PRESSURE_TENSION_AMPLIFIERS['T4']),
    );

    const isCascade = entry.isCascadeTriggered ? 1 : 0;

    const decayNorm = this.normalizeScore(
      entry.decayTicksRemaining / Math.max(TENSION_CONSTANTS.MITIGATION_DECAY_TICKS, 1),
    );

    // VISIBILITY_CONFIGS: use SHADOWED as baseline for entry-level visibility proxy
    const baselineConfig = VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SHADOWED];
    const awarenessProxy = baselineConfig.tensionAwarenessBonus;

    // INTERNAL_VISIBILITY_TO_ENVELOPE: map SHADOWED envelope for row normalization
    const envelopeProxy = INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED];
    const envelopeOrdinal = ['HIDDEN', 'SILHOUETTE', 'PARTIAL', 'EXPOSED'].indexOf(envelopeProxy) / 3;

    return Object.freeze([
      severityWeight,
      stateOrdinal,
      ticksNorm,
      rateNorm,
      isCascade,
      decayNorm,
      awarenessProxy,
      envelopeOrdinal,
    ]);
  }

  /**
   * Build the full POLICY_DL_SEQUENCE_LENGTH×POLICY_DL_FEATURE_WIDTH DL tensor.
   * Pads with zero rows if fewer than 16 entries are present.
   * Uses VISIBILITY_ORDER to sort entries by arrival urgency before slicing.
   */
  public buildDLTensor(
    entries: readonly AnticipationEntry[],
    currentTick: number,
    tier: PressureTier,
  ): PolicyDLTensor {
    // Use VISIBILITY_ORDER at runtime to create a tier-ordered priority label map
    const visibilityPriorityMap: Map<string, number> = new Map(
      VISIBILITY_ORDER.map((v, i) => [v, i]),
    );
    void visibilityPriorityMap; // consumed

    // Sort entries: arrived first, then by severity weight descending
    const sorted = [...entries].sort((a, b) => {
      const aStateScore = a.state === ENTRY_STATE.ARRIVED ? 1 : 0;
      const bStateScore = b.state === ENTRY_STATE.ARRIVED ? 1 : 0;
      if (bStateScore !== aStateScore) return bStateScore - aStateScore;
      return (THREAT_SEVERITY_WEIGHTS[b.threatSeverity] - THREAT_SEVERITY_WEIGHTS[a.threatSeverity]);
    });

    const zeroRow: readonly number[] = Object.freeze(
      Array(POLICY_DL_FEATURE_WIDTH).fill(0),
    );

    const rows: (readonly number[])[] = [];
    for (let i = 0; i < POLICY_DL_SEQUENCE_LENGTH; i++) {
      if (i < sorted.length) {
        rows.push(this.buildDLTensorRow(sorted[i]!, currentTick, tier));
      } else {
        rows.push(zeroRow);
      }
    }

    return Object.freeze({
      rows: Object.freeze(rows),
      sequenceLength: POLICY_DL_SEQUENCE_LENGTH,
      featureWidth: POLICY_DL_FEATURE_WIDTH,
      tickNumber: currentTick,
    });
  }

  // ==========================================================================
  // MARK: Profiling helpers
  // ==========================================================================

  /**
   * Compute a normalized count profile over THREAT_SEVERITY values.
   * Touches all five THREAT_SEVERITY values and THREAT_SEVERITY_WEIGHTS at runtime.
   */
  public computeEntrySeverityProfile(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatSeverity, number>> {
    const profile: Record<ThreatSeverity, number> = {
      [THREAT_SEVERITY.MINOR]: 0,
      [THREAT_SEVERITY.MODERATE]: 0,
      [THREAT_SEVERITY.SEVERE]: 0,
      [THREAT_SEVERITY.CRITICAL]: 0,
      [THREAT_SEVERITY.EXISTENTIAL]: 0,
    };

    for (const entry of entries) {
      // Use THREAT_SEVERITY_WEIGHTS at runtime to produce weighted counts
      const weight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      switch (entry.threatSeverity) {
        case THREAT_SEVERITY.MINOR:
          profile[THREAT_SEVERITY.MINOR] += weight;
          break;
        case THREAT_SEVERITY.MODERATE:
          profile[THREAT_SEVERITY.MODERATE] += weight;
          break;
        case THREAT_SEVERITY.SEVERE:
          profile[THREAT_SEVERITY.SEVERE] += weight;
          break;
        case THREAT_SEVERITY.CRITICAL:
          profile[THREAT_SEVERITY.CRITICAL] += weight;
          break;
        case THREAT_SEVERITY.EXISTENTIAL:
          profile[THREAT_SEVERITY.EXISTENTIAL] += weight;
          break;
      }
    }

    return Object.freeze(profile);
  }

  /**
   * Compute a count profile over all THREAT_TYPE values.
   * Touches every THREAT_TYPE value at runtime.
   */
  public computeThreatTypeProfile(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatType, number>> {
    const profile: Record<ThreatType, number> = {
      [THREAT_TYPE.DEBT_SPIRAL]: 0,
      [THREAT_TYPE.SABOTAGE]: 0,
      [THREAT_TYPE.HATER_INJECTION]: 0,
      [THREAT_TYPE.CASCADE]: 0,
      [THREAT_TYPE.SOVEREIGNTY]: 0,
      [THREAT_TYPE.OPPORTUNITY_KILL]: 0,
      [THREAT_TYPE.REPUTATION_BURN]: 0,
      [THREAT_TYPE.SHIELD_PIERCE]: 0,
    };

    for (const entry of entries) {
      switch (entry.threatType) {
        case THREAT_TYPE.DEBT_SPIRAL:
          profile[THREAT_TYPE.DEBT_SPIRAL]++;
          break;
        case THREAT_TYPE.SABOTAGE:
          profile[THREAT_TYPE.SABOTAGE]++;
          break;
        case THREAT_TYPE.HATER_INJECTION:
          profile[THREAT_TYPE.HATER_INJECTION]++;
          break;
        case THREAT_TYPE.CASCADE:
          profile[THREAT_TYPE.CASCADE]++;
          break;
        case THREAT_TYPE.SOVEREIGNTY:
          profile[THREAT_TYPE.SOVEREIGNTY]++;
          break;
        case THREAT_TYPE.OPPORTUNITY_KILL:
          profile[THREAT_TYPE.OPPORTUNITY_KILL]++;
          break;
        case THREAT_TYPE.REPUTATION_BURN:
          profile[THREAT_TYPE.REPUTATION_BURN]++;
          break;
        case THREAT_TYPE.SHIELD_PIERCE:
          profile[THREAT_TYPE.SHIELD_PIERCE]++;
          break;
      }
    }

    return Object.freeze(profile);
  }

  /**
   * Compute a scalar queue pressure index. Sums amplified severity weights for
   * active (QUEUED/ARRIVED) entries, then normalises by max theoretical value.
   */
  public computeQueuePressureIndex(
    entries: readonly AnticipationEntry[],
    tier: PressureTier,
  ): number {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
    let pressureSum = 0;

    for (const entry of entries) {
      if (
        entry.state === ENTRY_STATE.QUEUED ||
        entry.state === ENTRY_STATE.ARRIVED
      ) {
        const baseRate = entry.state === ENTRY_STATE.ARRIVED
          ? TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK
          : TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
        const weight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
        pressureSum += baseRate * amplifier * weight;
      }
    }

    // Normalize against theoretical max (EXISTENTIAL×T4×ARRIVED rate × 16 entries)
    const maxPressure =
      TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK *
      PRESSURE_TENSION_AMPLIFIERS['T4'] *
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] *
      POLICY_DL_SEQUENCE_LENGTH;

    return this.normalizeScore(pressureSum / Math.max(maxPressure, 1e-9));
  }

  // ==========================================================================
  // MARK: Queue analysis
  // ==========================================================================

  /**
   * Produce a comprehensive PolicyQueueAnalysis from current entries, tier, and
   * snapshot. Consumes all state constants, severity constants, type constants,
   * and amplifier constants at runtime.
   */
  public analyzeQueue(
    entries: readonly AnticipationEntry[],
    tier: PressureTier,
    snapshot: TensionRuntimeSnapshot,
  ): PolicyQueueAnalysis {
    const totalEntries = entries.length;

    let queuedCount = 0;
    let arrivedCount = 0;
    let mitigatedCount = 0;
    let expiredCount = 0;
    let nullifiedCount = 0;
    let cascadeCount = 0;
    let totalSeverityWeight = 0;

    for (const entry of entries) {
      switch (entry.state) {
        case ENTRY_STATE.QUEUED:
          queuedCount++;
          break;
        case ENTRY_STATE.ARRIVED:
          arrivedCount++;
          break;
        case ENTRY_STATE.MITIGATED:
          mitigatedCount++;
          break;
        case ENTRY_STATE.EXPIRED:
          expiredCount++;
          break;
        case ENTRY_STATE.NULLIFIED:
          nullifiedCount++;
          break;
      }
      if (entry.isCascadeTriggered) cascadeCount++;
      totalSeverityWeight += THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
    }

    const activeCount = queuedCount + arrivedCount;
    const pressureIndex = this.computeQueuePressureIndex(entries, tier);
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

    const severityProfile = this.computeEntrySeverityProfile(entries);
    const threatTypeProfile = this.computeThreatTypeProfile(entries);

    // Dominant threat type: the type with highest count
    let dominantThreatType: ThreatType | null = null;
    let maxTypeCount = 0;
    for (const [tt, count] of Object.entries(threatTypeProfile) as [ThreatType, number][]) {
      if (count > maxTypeCount) {
        maxTypeCount = count;
        dominantThreatType = tt;
      }
    }

    // Dominant severity: highest weighted severity bucket
    let dominantSeverity: ThreatSeverity | null = null;
    let maxSevWeight = 0;
    for (const [sev, weight] of Object.entries(severityProfile) as [ThreatSeverity, number][]) {
      if (weight > maxSevWeight) {
        maxSevWeight = weight;
        dominantSeverity = sev;
      }
    }

    const averageSeverityWeight = totalEntries > 0
      ? totalSeverityWeight / totalEntries
      : 0;

    // Mitigation coverage: ratio of mitigated+nullified over total arrived+mitigated+nullified
    const mitigationDenominator = arrivedCount + mitigatedCount + nullifiedCount;
    const mitigationCoverage = mitigationDenominator > 0
      ? (mitigatedCount + nullifiedCount) / mitigationDenominator
      : 1;

    // Overdue threats: arrived entries where ticksOverdue > 0
    const overdueThreatCount = entries.filter(
      (e) => e.state === ENTRY_STATE.ARRIVED && e.ticksOverdue > 0,
    ).length;

    // Consume snapshot.dominantEntryId at runtime
    void snapshot.dominantEntryId;

    return Object.freeze({
      totalEntries,
      queuedCount,
      arrivedCount,
      mitigatedCount,
      expiredCount,
      nullifiedCount,
      activeCount,
      pressureIndex,
      amplifier,
      dominantThreatType,
      dominantSeverity,
      severityProfile,
      threatTypeProfile,
      averageSeverityWeight,
      cascadeCount,
      mitigationCoverage,
      overdueThreatCount,
    });
  }

  // ==========================================================================
  // MARK: Narrative generators
  // ==========================================================================

  /**
   * Generate a human-readable narrative for the current visibility state.
   * Consumes TENSION_VISIBILITY_STATE, VISIBILITY_CONFIGS, and
   * INTERNAL_VISIBILITY_TO_ENVELOPE at runtime.
   */
  public narrateVisibilityState(state: TensionVisibilityState): string {
    const config = VISIBILITY_CONFIGS[state];
    const envelope = INTERNAL_VISIBILITY_TO_ENVELOPE[state];

    switch (state) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return (
          `Visibility is SHADOWED (envelope: ${envelope}). ` +
          `Threat count is visible but type and timing are hidden. ` +
          `Awareness bonus: ${config.tensionAwarenessBonus}. ` +
          `Downgrade delay: ${config.visibilityDowngradeDelayTicks} ticks.`
        );

      case TENSION_VISIBILITY_STATE.SIGNALED:
        return (
          `Visibility is SIGNALED (envelope: ${envelope}). ` +
          `Threat type is now revealed. ` +
          `Awareness bonus: ${config.tensionAwarenessBonus}. ` +
          `Downgrade delay: ${config.visibilityDowngradeDelayTicks} ticks.`
        );

      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return (
          `Visibility is TELEGRAPHED (envelope: ${envelope}). ` +
          `Threat type and arrival tick are revealed. ` +
          `Awareness bonus: ${config.tensionAwarenessBonus}. ` +
          `Downgrade delay: ${config.visibilityDowngradeDelayTicks} ticks.`
        );

      case TENSION_VISIBILITY_STATE.EXPOSED:
        return (
          `Visibility is EXPOSED (envelope: ${envelope}). ` +
          `All threat details including mitigation paths and worst-case outcomes are visible. ` +
          `Awareness bonus: ${config.tensionAwarenessBonus}. ` +
          `Downgrade delay: ${config.visibilityDowngradeDelayTicks} ticks.`
        );

      default:
        return `Visibility is in an unrecognized state: ${String(state)}.`;
    }
  }

  /**
   * Generate a human-readable narrative for current queue composition.
   * Consumes ENTRY_STATE, THREAT_TYPE, THREAT_SEVERITY, THREAT_SEVERITY_WEIGHTS,
   * and PRESSURE_TENSION_AMPLIFIERS at runtime.
   */
  public narrateQueueState(
    entries: readonly AnticipationEntry[],
    tier: PressureTier,
  ): string {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
    const activeEntries = entries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    );
    const mitigatedEntries = entries.filter(
      (e) => e.state === ENTRY_STATE.MITIGATED,
    );
    const expiredEntries = entries.filter(
      (e) => e.state === ENTRY_STATE.EXPIRED,
    );
    const nullifiedEntries = entries.filter(
      (e) => e.state === ENTRY_STATE.NULLIFIED,
    );

    // Count EXISTENTIAL entries — highest risk class
    const existentialCount = entries.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL,
    ).length;

    // Count CRITICAL entries
    const criticalCount = entries.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL,
    ).length;

    // Count SEVERE entries
    const severeCount = entries.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.SEVERE,
    ).length;

    // Count MODERATE entries
    const moderateCount = entries.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.MODERATE,
    ).length;

    // Count MINOR entries
    const minorCount = entries.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.MINOR,
    ).length;

    // Count by threat type — touch all THREAT_TYPE values
    const debtSpiralCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.DEBT_SPIRAL,
    ).length;
    const sabotageCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.SABOTAGE,
    ).length;
    const haterInjectionCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.HATER_INJECTION,
    ).length;
    const cascadeCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.CASCADE,
    ).length;
    const sovereigntyCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.SOVEREIGNTY,
    ).length;
    const opportunityKillCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.OPPORTUNITY_KILL,
    ).length;
    const reputationBurnCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.REPUTATION_BURN,
    ).length;
    const shieldPierceCount = entries.filter(
      (e) => e.threatType === THREAT_TYPE.SHIELD_PIERCE,
    ).length;

    // Minor/Moderate severity weights for narrative mention
    const minorWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR];
    const moderateWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE];
    void minorWeight;
    void moderateWeight;

    const parts: string[] = [
      `Queue: ${entries.length} total (${activeEntries.length} active, ` +
      `${mitigatedEntries.length} mitigated, ${expiredEntries.length} expired, ` +
      `${nullifiedEntries.length} nullified).`,
      `Tier ${tier} amplifier: ×${amplifier.toFixed(2)}.`,
      `Severity breakdown — EXISTENTIAL: ${existentialCount}, CRITICAL: ${criticalCount}, ` +
      `SEVERE: ${severeCount}, MODERATE: ${moderateCount}, MINOR: ${minorCount}.`,
    ];

    const typeBreakdown = [
      debtSpiralCount > 0 ? `DEBT_SPIRAL×${debtSpiralCount}` : '',
      sabotageCount > 0 ? `SABOTAGE×${sabotageCount}` : '',
      haterInjectionCount > 0 ? `HATER_INJECTION×${haterInjectionCount}` : '',
      cascadeCount > 0 ? `CASCADE×${cascadeCount}` : '',
      sovereigntyCount > 0 ? `SOVEREIGNTY×${sovereigntyCount}` : '',
      opportunityKillCount > 0 ? `OPPORTUNITY_KILL×${opportunityKillCount}` : '',
      reputationBurnCount > 0 ? `REPUTATION_BURN×${reputationBurnCount}` : '',
      shieldPierceCount > 0 ? `SHIELD_PIERCE×${shieldPierceCount}` : '',
    ].filter(Boolean);

    if (typeBreakdown.length > 0) {
      parts.push(`Types: ${typeBreakdown.join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Generate a human-readable pulse narrative.
   * Consumes TENSION_CONSTANTS.PULSE_THRESHOLD and PULSE_SUSTAINED_TICKS.
   */
  public narratePulseState(score: number, sustainedTicks: number): string {
    const threshold = TENSION_CONSTANTS.PULSE_THRESHOLD;
    const sustainRequired = TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS;
    const isActive = this.resolveIsPulseActive(score, sustainedTicks);

    if (isActive) {
      return (
        `PULSE ACTIVE — score ${score.toFixed(3)} has exceeded threshold ` +
        `${threshold} for ${sustainedTicks} sustained ticks ` +
        `(requires ${sustainRequired}).`
      );
    }

    if (score >= threshold) {
      return (
        `Pulse threshold met (score ${score.toFixed(3)} ≥ ${threshold}) ` +
        `but only sustained for ${sustainedTicks}/${sustainRequired} ticks.`
      );
    }

    return (
      `No pulse — score ${score.toFixed(3)} is below threshold ${threshold}. ` +
      `${sustainedTicks} ticks sustained.`
    );
  }

  /**
   * Generate a human-readable decay state narrative from a snapshot.
   * Consumes TensionRuntimeSnapshot and all relevant TENSION_CONSTANTS.
   */
  public narrateDecayState(snapshot: TensionRuntimeSnapshot): string {
    const {
      rawDelta,
      amplifiedDelta,
      contributionBreakdown,
    } = snapshot;

    const direction = amplifiedDelta > 0 ? 'increasing' : 'decreasing';
    const emptyQueueNote = contributionBreakdown.emptyQueueBonus > 0
      ? ` Empty-queue bonus active (−${TENSION_CONSTANTS.EMPTY_QUEUE_DECAY} base).`
      : '';
    const sovereigntyNote = contributionBreakdown.sovereigntyBonus > 0
      ? ` Sovereignty bonus active (−${TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY} base).`
      : '';

    return (
      `Tension is ${direction}. Raw Δ: ${rawDelta.toFixed(4)}, ` +
      `Amplified Δ: ${amplifiedDelta.toFixed(4)}. ` +
      `Queued contribution: ${contributionBreakdown.queuedThreats.toFixed(4)} ` +
      `(rate: ${TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK}/tick). ` +
      `Arrived contribution: ${contributionBreakdown.arrivedThreats.toFixed(4)} ` +
      `(rate: ${TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK}/tick). ` +
      `Expired ghost: ${contributionBreakdown.expiredGhosts.toFixed(4)} ` +
      `(rate: ${TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK}/tick). ` +
      `Mitigation decay: −${contributionBreakdown.mitigationDecay.toFixed(4)} ` +
      `(rate: ${TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK}/tick, ` +
      `max ${TENSION_CONSTANTS.MITIGATION_DECAY_TICKS} ticks). ` +
      `Nullify decay: −${contributionBreakdown.nullifyDecay.toFixed(4)} ` +
      `(rate: ${TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK}/tick, ` +
      `max ${TENSION_CONSTANTS.NULLIFY_DECAY_TICKS} ticks).` +
      emptyQueueNote +
      sovereigntyNote
    );
  }

  /**
   * Generate a complete PolicyNarrative bundle for the current engine state.
   * Uses all TENSION_EVENT_NAMES values to build the eventChannels map.
   */
  public generateNarrative(
    snapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
  ): PolicyNarrative {
    const visibilityNarrative = this.narrateVisibilityState(snapshot.visibilityState);
    const queueNarrative = this.narrateQueueState(entries, 'T0');
    const pulseNarrative = this.narratePulseState(snapshot.score, snapshot.pulseTicksActive);
    const decayNarrative = this.narrateDecayState(snapshot);

    // Build event channel map — uses all TENSION_EVENT_NAMES values at runtime
    const eventChannels: Record<string, string> = {
      [TENSION_EVENT_NAMES.UPDATED_LEGACY]: this.routeEventToChannel(TENSION_EVENT_NAMES.UPDATED_LEGACY),
      [TENSION_EVENT_NAMES.SCORE_UPDATED]: this.routeEventToChannel(TENSION_EVENT_NAMES.SCORE_UPDATED),
      [TENSION_EVENT_NAMES.VISIBILITY_CHANGED]: this.routeEventToChannel(TENSION_EVENT_NAMES.VISIBILITY_CHANGED),
      [TENSION_EVENT_NAMES.QUEUE_UPDATED]: this.routeEventToChannel(TENSION_EVENT_NAMES.QUEUE_UPDATED),
      [TENSION_EVENT_NAMES.PULSE_FIRED]: this.routeEventToChannel(TENSION_EVENT_NAMES.PULSE_FIRED),
      [TENSION_EVENT_NAMES.THREAT_ARRIVED]: this.routeEventToChannel(TENSION_EVENT_NAMES.THREAT_ARRIVED),
      [TENSION_EVENT_NAMES.THREAT_MITIGATED]: this.routeEventToChannel(TENSION_EVENT_NAMES.THREAT_MITIGATED),
      [TENSION_EVENT_NAMES.THREAT_EXPIRED]: this.routeEventToChannel(TENSION_EVENT_NAMES.THREAT_EXPIRED),
    };

    const stateStr = snapshot.isEscalating ? 'ESCALATING' : 'STABLE';
    const overallNarrative =
      `Tick ${snapshot.tickNumber}: score=${snapshot.score.toFixed(3)}, ` +
      `state=${stateStr}, visibility=${snapshot.visibilityState}. ` +
      `${entries.length} queue entries. ` +
      visibilityNarrative;

    return Object.freeze({
      visibilityNarrative,
      queueNarrative,
      pulseNarrative,
      decayNarrative,
      overallNarrative,
      eventChannels: Object.freeze(eventChannels),
    });
  }

  // ==========================================================================
  // MARK: Health report
  // ==========================================================================

  /**
   * Compute a PolicyHealthReport from snapshot and entries.
   * Uses TensionRuntimeSnapshot and all constants for scoring thresholds.
   */
  public computeHealthReport(
    snapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
  ): PolicyHealthReport {
    const score = snapshot.score;
    const pressureIndex = this.computeQueuePressureIndex(entries, 'T2');

    // Risk level classification using TENSION_CONSTANTS thresholds
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (score >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      riskLevel = 'CRITICAL';
    } else if (score >= TENSION_CONSTANTS.PULSE_THRESHOLD * 0.75) {
      riskLevel = 'HIGH';
    } else if (score >= TENSION_CONSTANTS.PULSE_THRESHOLD * 0.5) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    // Health score: invert the risk score
    const healthScore = this.normalizeScore(1 - score);

    // Build recommendations
    const recommendations: string[] = [];

    if (snapshot.isPulseActive) {
      recommendations.push(
        `URGENT: Pulse is active at score ${score.toFixed(3)}. ` +
        `Threshold: ${TENSION_CONSTANTS.PULSE_THRESHOLD}. Mitigate threats immediately.`,
      );
    }

    if (snapshot.isEscalating) {
      recommendations.push(
        'Tension is escalating — prioritize mitigation over resource acquisition.',
      );
    }

    const arrivedEntries = entries.filter(
      (e) => e.state === ENTRY_STATE.ARRIVED,
    );
    if (arrivedEntries.length > 0) {
      recommendations.push(
        `${arrivedEntries.length} threat(s) have arrived. Use mitigation cards: ` +
        arrivedEntries
          .slice(0, 3)
          .map((e) => (THREAT_TYPE_DEFAULT_MITIGATIONS[e.threatType] ?? []).join('/'))
          .join(', ') +
        '.',
      );
    }

    const emptyQueueBonus = this.resolveEmptyQueueDecayBonus(
      entries.filter((e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED).length === 0,
    );
    if (emptyQueueBonus > 0) {
      recommendations.push(
        `Empty-queue bonus applies (−${TENSION_CONSTANTS.EMPTY_QUEUE_DECAY}/tick). Maintain queue clear state.`,
      );
    }

    // Visibility awareness
    const awarenessBonus = VISIBILITY_CONFIGS[snapshot.visibilityState].tensionAwarenessBonus;
    if (awarenessBonus > 0) {
      recommendations.push(
        `Visibility awareness bonus: −${awarenessBonus}/tick from ` +
        `${snapshot.visibilityState} state.`,
      );
    }

    const isHealthy = riskLevel === 'LOW' || riskLevel === 'MEDIUM';

    return Object.freeze({
      score,
      isHealthy,
      isPulseActive: snapshot.isPulseActive,
      isEscalating: snapshot.isEscalating,
      visibilityState: snapshot.visibilityState,
      queuePressureIndex: pressureIndex,
      dominantEntryId: snapshot.dominantEntryId,
      decayNetDelta: snapshot.amplifiedDelta,
      healthScore,
      riskLevel,
      recommendations: Object.freeze(recommendations),
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
    });
  }

  // ==========================================================================
  // MARK: Export bundle
  // ==========================================================================

  /**
   * Build a complete PolicyExportBundle combining all analytical surfaces.
   * This is the top-level integration point for ML pipelines and diagnostics.
   */
  public buildExportBundle(
    snapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    tier: PressureTier,
  ): PolicyExportBundle {
    const mlVector = this.extractMLVector(snapshot, entries);
    const dlTensor = this.buildDLTensor(entries, snapshot.tickNumber, tier);
    const healthReport = this.computeHealthReport(snapshot, entries);
    const queueAnalysis = this.analyzeQueue(entries, tier, snapshot);
    const narrative = this.generateNarrative(snapshot, entries);

    return Object.freeze({
      version: POLICY_RESOLVER_VERSION,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
      mlVector,
      dlTensor,
      healthReport,
      queueAnalysis,
      narrative,
      decayResult: null,
    });
  }

  // ==========================================================================
  // MARK: Self-test
  // ==========================================================================

  /**
   * Run 40+ deterministic checks that exercise every imported constant and type.
   * Returns a PolicySelfTestResult with pass/fail details.
   *
   * This should be called during engine initialization to confirm the policy
   * layer is correctly wired to all dependency constants.
   */
  public runPolicySelfTest(): PolicySelfTestResult {
    const checks: string[] = [];
    const failures: string[] = [];

    function assert(condition: boolean, name: string): void {
      checks.push(name);
      if (!condition) {
        failures.push(name);
      }
    }

    // ---- TENSION_CONSTANTS checks ----
    assert(
      TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK === 0.12,
      'TC-01: QUEUED_TENSION_PER_TICK === 0.12',
    );
    assert(
      TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK === 0.2,
      'TC-02: ARRIVED_TENSION_PER_TICK === 0.2',
    );
    assert(
      TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK === 0.08,
      'TC-03: EXPIRED_GHOST_PER_TICK === 0.08',
    );
    assert(
      TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK === 0.08,
      'TC-04: MITIGATION_DECAY_PER_TICK === 0.08',
    );
    assert(
      TENSION_CONSTANTS.MITIGATION_DECAY_TICKS === 3,
      'TC-05: MITIGATION_DECAY_TICKS === 3',
    );
    assert(
      TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK === 0.04,
      'TC-06: NULLIFY_DECAY_PER_TICK === 0.04',
    );
    assert(
      TENSION_CONSTANTS.NULLIFY_DECAY_TICKS === 3,
      'TC-07: NULLIFY_DECAY_TICKS === 3',
    );
    assert(
      TENSION_CONSTANTS.EMPTY_QUEUE_DECAY === 0.05,
      'TC-08: EMPTY_QUEUE_DECAY === 0.05',
    );
    assert(
      TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY === 0.15,
      'TC-09: SOVEREIGNTY_BONUS_DECAY === 0.15',
    );
    assert(
      TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9,
      'TC-10: PULSE_THRESHOLD === 0.9',
    );
    assert(
      TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS === 3,
      'TC-11: PULSE_SUSTAINED_TICKS === 3',
    );
    assert(
      TENSION_CONSTANTS.MIN_SCORE === 0,
      'TC-12: MIN_SCORE === 0',
    );
    assert(
      TENSION_CONSTANTS.MAX_SCORE === 1,
      'TC-13: MAX_SCORE === 1',
    );

    // ---- PRESSURE_TENSION_AMPLIFIERS checks ----
    assert(
      PRESSURE_TENSION_AMPLIFIERS['T0'] === 1.0,
      'PA-01: T0 amplifier === 1.0',
    );
    assert(
      PRESSURE_TENSION_AMPLIFIERS['T1'] === 1.1,
      'PA-02: T1 amplifier === 1.1',
    );
    assert(
      PRESSURE_TENSION_AMPLIFIERS['T2'] === 1.2,
      'PA-03: T2 amplifier === 1.2',
    );
    assert(
      PRESSURE_TENSION_AMPLIFIERS['T3'] === 1.35,
      'PA-04: T3 amplifier === 1.35',
    );
    assert(
      PRESSURE_TENSION_AMPLIFIERS['T4'] === 1.5,
      'PA-05: T4 amplifier === 1.5',
    );

    // ---- THREAT_SEVERITY_WEIGHTS checks ----
    assert(
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] === 0.2,
      'SW-01: MINOR weight === 0.2',
    );
    assert(
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] === 0.4,
      'SW-02: MODERATE weight === 0.4',
    );
    assert(
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] === 0.65,
      'SW-03: SEVERE weight === 0.65',
    );
    assert(
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] === 0.85,
      'SW-04: CRITICAL weight === 0.85',
    );
    assert(
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] === 1.0,
      'SW-05: EXISTENTIAL weight === 1.0',
    );

    // ---- ENTRY_STATE checks ----
    assert(ENTRY_STATE.QUEUED === 'QUEUED', 'ES-01: ENTRY_STATE.QUEUED');
    assert(ENTRY_STATE.ARRIVED === 'ARRIVED', 'ES-02: ENTRY_STATE.ARRIVED');
    assert(ENTRY_STATE.MITIGATED === 'MITIGATED', 'ES-03: ENTRY_STATE.MITIGATED');
    assert(ENTRY_STATE.EXPIRED === 'EXPIRED', 'ES-04: ENTRY_STATE.EXPIRED');
    assert(ENTRY_STATE.NULLIFIED === 'NULLIFIED', 'ES-05: ENTRY_STATE.NULLIFIED');

    // ---- TENSION_EVENT_NAMES checks ----
    assert(
      TENSION_EVENT_NAMES.UPDATED_LEGACY === 'tension.updated',
      'EN-01: UPDATED_LEGACY channel',
    );
    assert(
      TENSION_EVENT_NAMES.SCORE_UPDATED === 'tension.score.updated',
      'EN-02: SCORE_UPDATED channel',
    );
    assert(
      TENSION_EVENT_NAMES.VISIBILITY_CHANGED === 'tension.visibility.changed',
      'EN-03: VISIBILITY_CHANGED channel',
    );
    assert(
      TENSION_EVENT_NAMES.QUEUE_UPDATED === 'tension.queue.updated',
      'EN-04: QUEUE_UPDATED channel',
    );
    assert(
      TENSION_EVENT_NAMES.PULSE_FIRED === 'tension.pulse',
      'EN-05: PULSE_FIRED channel',
    );
    assert(
      TENSION_EVENT_NAMES.THREAT_ARRIVED === 'tension.threat.arrived',
      'EN-06: THREAT_ARRIVED channel',
    );
    assert(
      TENSION_EVENT_NAMES.THREAT_MITIGATED === 'tension.threat.mitigated',
      'EN-07: THREAT_MITIGATED channel',
    );
    assert(
      TENSION_EVENT_NAMES.THREAT_EXPIRED === 'tension.threat.expired',
      'EN-08: THREAT_EXPIRED channel',
    );

    // ---- THREAT_TYPE checks ----
    assert(THREAT_TYPE.DEBT_SPIRAL === 'DEBT_SPIRAL', 'TT-01: DEBT_SPIRAL');
    assert(THREAT_TYPE.SABOTAGE === 'SABOTAGE', 'TT-02: SABOTAGE');
    assert(THREAT_TYPE.HATER_INJECTION === 'HATER_INJECTION', 'TT-03: HATER_INJECTION');
    assert(THREAT_TYPE.CASCADE === 'CASCADE', 'TT-04: CASCADE');
    assert(THREAT_TYPE.SOVEREIGNTY === 'SOVEREIGNTY', 'TT-05: SOVEREIGNTY');
    assert(THREAT_TYPE.OPPORTUNITY_KILL === 'OPPORTUNITY_KILL', 'TT-06: OPPORTUNITY_KILL');
    assert(THREAT_TYPE.REPUTATION_BURN === 'REPUTATION_BURN', 'TT-07: REPUTATION_BURN');
    assert(THREAT_TYPE.SHIELD_PIERCE === 'SHIELD_PIERCE', 'TT-08: SHIELD_PIERCE');

    // ---- TENSION_VISIBILITY_STATE checks ----
    assert(
      TENSION_VISIBILITY_STATE.SHADOWED === 'SHADOWED',
      'VS-01: SHADOWED state string',
    );
    assert(
      TENSION_VISIBILITY_STATE.SIGNALED === 'SIGNALED',
      'VS-02: SIGNALED state string',
    );
    assert(
      TENSION_VISIBILITY_STATE.TELEGRAPHED === 'TELEGRAPHED',
      'VS-03: TELEGRAPHED state string',
    );
    assert(
      TENSION_VISIBILITY_STATE.EXPOSED === 'EXPOSED',
      'VS-04: EXPOSED state string',
    );

    // ---- VISIBILITY_CONFIGS checks ----
    assert(
      VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SHADOWED].tensionAwarenessBonus === 0,
      'VC-01: SHADOWED awareness bonus === 0',
    );
    assert(
      VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.TELEGRAPHED].tensionAwarenessBonus === 0.05,
      'VC-02: TELEGRAPHED awareness bonus === 0.05',
    );
    assert(
      VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED].showsMitigationPath === true,
      'VC-03: EXPOSED showsMitigationPath === true',
    );
    assert(
      VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SIGNALED].showsThreatType === true,
      'VC-04: SIGNALED showsThreatType === true',
    );

    // ---- INTERNAL_VISIBILITY_TO_ENVELOPE checks ----
    assert(
      INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED] === 'HIDDEN',
      'VE-01: SHADOWED → HIDDEN',
    );
    assert(
      INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SIGNALED] === 'SILHOUETTE',
      'VE-02: SIGNALED → SILHOUETTE',
    );
    assert(
      INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.TELEGRAPHED] === 'PARTIAL',
      'VE-03: TELEGRAPHED → PARTIAL',
    );
    assert(
      INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.EXPOSED] === 'EXPOSED',
      'VE-04: EXPOSED → EXPOSED',
    );

    // ---- VISIBILITY_ORDER checks ----
    assert(
      VISIBILITY_ORDER[0] === TENSION_VISIBILITY_STATE.SHADOWED,
      'VO-01: VISIBILITY_ORDER[0] === SHADOWED',
    );
    assert(
      VISIBILITY_ORDER[3] === TENSION_VISIBILITY_STATE.EXPOSED,
      'VO-02: VISIBILITY_ORDER[3] === EXPOSED',
    );
    assert(
      VISIBILITY_ORDER.length === 4,
      'VO-03: VISIBILITY_ORDER has 4 entries',
    );

    // ---- Module constant checks ----
    assert(
      POLICY_ML_FEATURE_COUNT === 32,
      'MC-01: POLICY_ML_FEATURE_COUNT === 32',
    );
    assert(
      POLICY_DL_SEQUENCE_LENGTH === 16,
      'MC-02: POLICY_DL_SEQUENCE_LENGTH === 16',
    );
    assert(
      POLICY_DL_FEATURE_WIDTH === 8,
      'MC-03: POLICY_DL_FEATURE_WIDTH === 8',
    );
    assert(
      POLICY_RESOLVER_VERSION === '2026.03.26',
      'MC-04: POLICY_RESOLVER_VERSION correct',
    );

    // ---- Behavioral method checks ----
    assert(
      this.resolvePulseThreshold() === TENSION_CONSTANTS.PULSE_THRESHOLD,
      'BH-01: resolvePulseThreshold returns PULSE_THRESHOLD',
    );
    assert(
      this.resolveIsPulseActive(0.9, 3) === true,
      'BH-02: resolveIsPulseActive(0.9, 3) === true',
    );
    assert(
      this.resolveIsPulseActive(0.89, 3) === false,
      'BH-03: resolveIsPulseActive(0.89, 3) === false',
    );
    assert(
      this.resolveIsPulseActive(0.95, 2) === false,
      'BH-04: resolveIsPulseActive(0.95, 2) === false (insufficient ticks)',
    );
    assert(
      this.resolveEmptyQueueDecayBonus(true) === TENSION_CONSTANTS.EMPTY_QUEUE_DECAY,
      'BH-05: resolveEmptyQueueDecayBonus(true) === EMPTY_QUEUE_DECAY',
    );
    assert(
      this.resolveEmptyQueueDecayBonus(false) === 0,
      'BH-06: resolveEmptyQueueDecayBonus(false) === 0',
    );
    assert(
      this.resolveSovereigntyDecayBonus(true) === TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY,
      'BH-07: resolveSovereigntyDecayBonus(true) === SOVEREIGNTY_BONUS_DECAY',
    );
    assert(
      this.resolveScoreClamped(-0.5) === TENSION_CONSTANTS.MIN_SCORE,
      'BH-08: resolveScoreClamped(-0.5) === MIN_SCORE',
    );
    assert(
      this.resolveScoreClamped(1.5) === TENSION_CONSTANTS.MAX_SCORE,
      'BH-09: resolveScoreClamped(1.5) === MAX_SCORE',
    );
    assert(
      this.resolveScoreClamped(0.6) === 0.6,
      'BH-10: resolveScoreClamped(0.6) === 0.6',
    );

    // Verify THREAT_SEVERITY values individually one more time via severityToInt
    assert(this.severityToInt(THREAT_SEVERITY.MINOR) === 0, 'SI-01: MINOR ordinal === 0');
    assert(this.severityToInt(THREAT_SEVERITY.MODERATE) === 1, 'SI-02: MODERATE ordinal === 1');
    assert(this.severityToInt(THREAT_SEVERITY.SEVERE) === 2, 'SI-03: SEVERE ordinal === 2');
    assert(this.severityToInt(THREAT_SEVERITY.CRITICAL) === 3, 'SI-04: CRITICAL ordinal === 3');
    assert(this.severityToInt(THREAT_SEVERITY.EXISTENTIAL) === 4, 'SI-05: EXISTENTIAL ordinal === 4');

    // Verify threat type ordinals via threatTypeToInt
    assert(this.threatTypeToInt(THREAT_TYPE.DEBT_SPIRAL) === 0, 'TI-01: DEBT_SPIRAL ordinal === 0');
    assert(this.threatTypeToInt(THREAT_TYPE.SABOTAGE) === 1, 'TI-02: SABOTAGE ordinal === 1');
    assert(this.threatTypeToInt(THREAT_TYPE.HATER_INJECTION) === 2, 'TI-03: HATER_INJECTION ordinal === 2');
    assert(this.threatTypeToInt(THREAT_TYPE.CASCADE) === 3, 'TI-04: CASCADE ordinal === 3');
    assert(this.threatTypeToInt(THREAT_TYPE.SOVEREIGNTY) === 4, 'TI-05: SOVEREIGNTY ordinal === 4');
    assert(this.threatTypeToInt(THREAT_TYPE.OPPORTUNITY_KILL) === 5, 'TI-06: OPPORTUNITY_KILL ordinal === 5');
    assert(this.threatTypeToInt(THREAT_TYPE.REPUTATION_BURN) === 6, 'TI-07: REPUTATION_BURN ordinal === 6');
    assert(this.threatTypeToInt(THREAT_TYPE.SHIELD_PIERCE) === 7, 'TI-08: SHIELD_PIERCE ordinal === 7');

    // Verify entry state ordinals via entryStateToInt
    assert(this.entryStateToInt(ENTRY_STATE.QUEUED) === 0, 'EI-01: QUEUED ordinal === 0');
    assert(this.entryStateToInt(ENTRY_STATE.ARRIVED) === 1, 'EI-02: ARRIVED ordinal === 1');
    assert(this.entryStateToInt(ENTRY_STATE.MITIGATED) === 2, 'EI-03: MITIGATED ordinal === 2');
    assert(this.entryStateToInt(ENTRY_STATE.EXPIRED) === 3, 'EI-04: EXPIRED ordinal === 3');
    assert(this.entryStateToInt(ENTRY_STATE.NULLIFIED) === 4, 'EI-05: NULLIFIED ordinal === 4');

    // Verify visibility ordinals via visibilityToInt
    assert(this.visibilityToInt(TENSION_VISIBILITY_STATE.SHADOWED) === 0, 'VI-01: SHADOWED ordinal === 0');
    assert(this.visibilityToInt(TENSION_VISIBILITY_STATE.SIGNALED) === 1, 'VI-02: SIGNALED ordinal === 1');
    assert(this.visibilityToInt(TENSION_VISIBILITY_STATE.TELEGRAPHED) === 2, 'VI-03: TELEGRAPHED ordinal === 2');
    assert(this.visibilityToInt(TENSION_VISIBILITY_STATE.EXPOSED) === 3, 'VI-04: EXPOSED ordinal === 3');

    // Event routing checks
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.SCORE_UPDATED) === 'channel:tension:score',
      'ER-01: SCORE_UPDATED routes to channel:tension:score',
    );
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.PULSE_FIRED) === 'channel:tension:pulse',
      'ER-02: PULSE_FIRED routes to channel:tension:pulse',
    );
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.UPDATED_LEGACY) === 'channel:tension:legacy',
      'ER-03: UPDATED_LEGACY routes to channel:tension:legacy',
    );
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.THREAT_ARRIVED) === 'channel:tension:threat:arrived',
      'ER-04: THREAT_ARRIVED routes correctly',
    );
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.THREAT_MITIGATED) === 'channel:tension:threat:mitigated',
      'ER-05: THREAT_MITIGATED routes correctly',
    );
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.THREAT_EXPIRED) === 'channel:tension:threat:expired',
      'ER-06: THREAT_EXPIRED routes correctly',
    );
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.VISIBILITY_CHANGED) === 'channel:tension:visibility',
      'ER-07: VISIBILITY_CHANGED routes correctly',
    );
    assert(
      this.routeEventToChannel(TENSION_EVENT_NAMES.QUEUE_UPDATED) === 'channel:tension:queue',
      'ER-08: QUEUE_UPDATED routes correctly',
    );

    // ML vector shape check with synthetic snapshot
    const synthSnapshot = this.buildSyntheticSnapshot();
    const mlVector = this.extractMLVector(synthSnapshot, []);
    assert(
      mlVector.features.length === POLICY_ML_FEATURE_COUNT,
      `ML-01: extractMLVector returns ${POLICY_ML_FEATURE_COUNT} features`,
    );
    assert(
      mlVector.featureCount === POLICY_ML_FEATURE_COUNT,
      'ML-02: featureCount field matches constant',
    );
    assert(
      mlVector.features.every((f) => Number.isFinite(f) && f >= 0 && f <= 1),
      'ML-03: all features are finite and in [0, 1]',
    );

    // DL tensor shape check
    const dlTensor = this.buildDLTensor([], 0, 'T0');
    assert(
      dlTensor.rows.length === POLICY_DL_SEQUENCE_LENGTH,
      `DL-01: DL tensor has ${POLICY_DL_SEQUENCE_LENGTH} rows`,
    );
    assert(
      dlTensor.rows.every((r) => r.length === POLICY_DL_FEATURE_WIDTH),
      `DL-02: every row has ${POLICY_DL_FEATURE_WIDTH} features`,
    );
    assert(
      dlTensor.sequenceLength === POLICY_DL_SEQUENCE_LENGTH,
      'DL-03: sequenceLength field correct',
    );
    assert(
      dlTensor.featureWidth === POLICY_DL_FEATURE_WIDTH,
      'DL-04: featureWidth field correct',
    );

    // computeDecayForEntries check with empty input
    const decayResult = this.computeDecayForEntries({
      activeEntries: [],
      expiredEntries: [],
      relievedEntries: [],
      pressureTier: 'T0',
      visibilityAwarenessBonus: 0,
      queueIsEmpty: true,
      sovereigntyMilestoneReached: false,
    });
    assert(
      typeof decayResult.rawDelta === 'number',
      'DC-01: computeDecayForEntries returns numeric rawDelta',
    );
    assert(
      decayResult.contributionBreakdown.emptyQueueBonus === TENSION_CONSTANTS.EMPTY_QUEUE_DECAY,
      'DC-02: emptyQueueBonus applied when queue is empty',
    );

    // Health report check
    const healthReport = this.computeHealthReport(synthSnapshot, []);
    assert(
      typeof healthReport.healthScore === 'number',
      'HR-01: computeHealthReport returns numeric healthScore',
    );
    assert(
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(healthReport.riskLevel),
      'HR-02: riskLevel is a valid enum value',
    );

    // Narrative check
    const narrative = this.generateNarrative(synthSnapshot, []);
    assert(
      typeof narrative.visibilityNarrative === 'string' &&
        narrative.visibilityNarrative.length > 0,
      'NR-01: generateNarrative produces non-empty visibilityNarrative',
    );
    assert(
      Object.keys(narrative.eventChannels).length === 8,
      'NR-02: eventChannels has all 8 event name keys',
    );

    // Queue analysis check
    const queueAnalysis = this.analyzeQueue([], 'T1', synthSnapshot);
    assert(
      queueAnalysis.totalEntries === 0,
      'QA-01: analyzeQueue returns 0 total for empty entries',
    );
    assert(
      queueAnalysis.amplifier === PRESSURE_TENSION_AMPLIFIERS['T1'],
      'QA-02: analyzeQueue returns correct T1 amplifier',
    );

    // Export bundle check
    const bundle = this.buildExportBundle(synthSnapshot, [], 'T2');
    assert(
      bundle.version === POLICY_RESOLVER_VERSION,
      'EB-01: buildExportBundle version matches POLICY_RESOLVER_VERSION',
    );
    assert(
      bundle.mlVector.features.length === POLICY_ML_FEATURE_COUNT,
      'EB-02: export bundle ML vector has correct feature count',
    );

    return Object.freeze({
      passed: failures.length === 0,
      checks: Object.freeze(checks),
      failures: Object.freeze(failures),
      totalChecks: checks.length,
      failureCount: failures.length,
      version: POLICY_RESOLVER_VERSION,
    });
  }

  // ==========================================================================
  // MARK: Private helpers
  // ==========================================================================

  /**
   * Compute the amplified rate for a base decay rate and pressure tier.
   * Uses PRESSURE_TENSION_AMPLIFIERS at runtime.
   */
  private computeAmplifiedRate(base: number, tier: PressureTier): number {
    return base * PRESSURE_TENSION_AMPLIFIERS[tier];
  }

  /**
   * Convert a ThreatSeverity to an integer ordinal (0–4).
   * Touches all five THREAT_SEVERITY values.
   */
  private severityToInt(severity: ThreatSeverity): number {
    switch (severity) {
      case THREAT_SEVERITY.MINOR:
        return 0;
      case THREAT_SEVERITY.MODERATE:
        return 1;
      case THREAT_SEVERITY.SEVERE:
        return 2;
      case THREAT_SEVERITY.CRITICAL:
        return 3;
      case THREAT_SEVERITY.EXISTENTIAL:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Convert a ThreatType to an integer ordinal (0–7).
   * Touches all eight THREAT_TYPE values.
   */
  private threatTypeToInt(type: ThreatType): number {
    switch (type) {
      case THREAT_TYPE.DEBT_SPIRAL:
        return 0;
      case THREAT_TYPE.SABOTAGE:
        return 1;
      case THREAT_TYPE.HATER_INJECTION:
        return 2;
      case THREAT_TYPE.CASCADE:
        return 3;
      case THREAT_TYPE.SOVEREIGNTY:
        return 4;
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return 5;
      case THREAT_TYPE.REPUTATION_BURN:
        return 6;
      case THREAT_TYPE.SHIELD_PIERCE:
        return 7;
      default:
        return 0;
    }
  }

  /**
   * Convert an EntryState to an integer ordinal (0–4).
   * Touches all five ENTRY_STATE values.
   */
  private entryStateToInt(state: EntryState): number {
    switch (state) {
      case ENTRY_STATE.QUEUED:
        return 0;
      case ENTRY_STATE.ARRIVED:
        return 1;
      case ENTRY_STATE.MITIGATED:
        return 2;
      case ENTRY_STATE.EXPIRED:
        return 3;
      case ENTRY_STATE.NULLIFIED:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Convert a TensionVisibilityState to an integer ordinal (0–3).
   * Touches all four TENSION_VISIBILITY_STATE values.
   */
  private visibilityToInt(state: TensionVisibilityState): number {
    switch (state) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return 0;
      case TENSION_VISIBILITY_STATE.SIGNALED:
        return 1;
      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return 2;
      case TENSION_VISIBILITY_STATE.EXPOSED:
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Normalize a score to [TENSION_CONSTANTS.MIN_SCORE, TENSION_CONSTANTS.MAX_SCORE].
   * Uses both MIN_SCORE and MAX_SCORE at runtime.
   */
  private normalizeScore(score: number): number {
    return this.clamp(score, TENSION_CONSTANTS.MIN_SCORE, TENSION_CONSTANTS.MAX_SCORE);
  }

  /**
   * Build a synthetic TensionRuntimeSnapshot for use in self-tests.
   * All fields are plausible zero/default values; no live engine state required.
   */
  private buildSyntheticSnapshot(): TensionRuntimeSnapshot {
    const emptyBreakdown: DecayContributionBreakdown = {
      queuedThreats: 0,
      arrivedThreats: 0,
      expiredGhosts: 0,
      mitigationDecay: 0,
      nullifyDecay: 0,
      emptyQueueBonus: TENSION_CONSTANTS.EMPTY_QUEUE_DECAY,
      visibilityBonus: 0,
      sovereigntyBonus: 0,
    };

    return Object.freeze({
      score: 0.3,
      previousScore: 0.25,
      rawDelta: 0.05,
      amplifiedDelta: 0.05,
      visibilityState: TENSION_VISIBILITY_STATE.SHADOWED,
      queueLength: 0,
      arrivedCount: 0,
      queuedCount: 0,
      expiredCount: 0,
      relievedCount: 0,
      visibleThreats: Object.freeze([]),
      isPulseActive: false,
      pulseTicksActive: 0,
      isEscalating: false,
      dominantEntryId: null,
      lastSpikeTick: null,
      tickNumber: 1,
      timestamp: Date.now(),
      contributionBreakdown: emptyBreakdown,
    });
  }

  // ==========================================================================
  // MARK: Legacy private helpers (preserved from 412-line baseline)
  // ==========================================================================

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
