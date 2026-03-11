/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND TENSION METRICS COLLECTOR
 * /backend/src/game/engine/tension/TensionMetricsCollector.ts
 * ============================================================================
 *
 * Purpose:
 * - derive higher-order operational metrics from Engine 3 runtime output
 * - keep TensionEngine focused on queue/state transitions, not analytics
 * - produce immutable telemetry-friendly snapshots for dashboards, traces,
 *   replay analysis, anomaly detection, and future adaptive balancing
 *
 * Design:
 * - pure read-model collector, no game-state mutation
 * - accepts runtime snapshot + queue state + run snapshot
 * - maintains a small rolling history for local trend calculations
 * - output is backend-safe, serialization-safe, and mode-agnostic
 * ============================================================================
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  ENTRY_STATE,
  type AnticipationEntry,
  type DecayContributionBreakdown,
  type TensionRuntimeSnapshot,
} from './types';

export interface TensionMetricsInput {
  readonly runState: RunStateSnapshot;
  readonly runtimeSnapshot: TensionRuntimeSnapshot;
  readonly queueEntries?: readonly AnticipationEntry[];
}

export interface TensionSeverityDistribution {
  readonly MINOR: number;
  readonly MODERATE: number;
  readonly SEVERE: number;
  readonly CRITICAL: number;
  readonly EXISTENTIAL: number;
}

export interface TensionTypeDistribution {
  readonly DEBT_SPIRAL: number;
  readonly SABOTAGE: number;
  readonly HATER_INJECTION: number;
  readonly CASCADE: number;
  readonly SOVEREIGNTY: number;
  readonly OPPORTUNITY_KILL: number;
  readonly REPUTATION_BURN: number;
  readonly SHIELD_PIERCE: number;
}

export interface TensionVisibilityDistribution {
  readonly HIDDEN: number;
  readonly SILHOUETTE: number;
  readonly PARTIAL: number;
  readonly EXPOSED: number;
}

export interface TensionMetricsSnapshot {
  readonly runId: string;
  readonly tick: number;
  readonly mode: RunStateSnapshot['mode'];

  readonly score: number;
  readonly previousScore: number;
  readonly delta: number;
  readonly rawDelta: number;
  readonly amplifiedDelta: number;

  readonly queueLength: number;
  readonly queuedCount: number;
  readonly arrivedCount: number;
  readonly expiredCount: number;
  readonly relievedCount: number;

  readonly visibleThreatCount: number;
  readonly hiddenThreatCount: number;
  readonly arrivedThreatRatio: number;
  readonly unresolvedThreatRatio: number;

  readonly avgEtaTicks: number;
  readonly nearestEtaTicks: number | null;
  readonly furthestEtaTicks: number | null;
  readonly overdueCount: number;

  readonly totalSeverityWeight: number;
  readonly averageSeverityWeight: number;
  readonly dominantSeverityWeight: number;
  readonly severityDensity: number;

  readonly mitigationCoverageRatio: number;
  readonly threatEntropy: number;
  readonly queuePressureRatio: number;
  readonly ghostBurden: number;
  readonly reliefStrength: number;
  readonly awarenessLoad: number;
  readonly backlogRisk: number;
  readonly collapseRisk: number;

  readonly isPulseActive: boolean;
  readonly isSustainedPulse: boolean;
  readonly escalationSlope: number;
  readonly escalationMomentum: 'FALLING' | 'FLAT' | 'RISING' | 'SPIKING';

  readonly threatTypes: TensionTypeDistribution;
  readonly severities: TensionSeverityDistribution;
  readonly visibilityLevels: TensionVisibilityDistribution;
  readonly contributionBreakdown: DecayContributionBreakdown;
}

type MutableTensionTypeDistribution = {
  DEBT_SPIRAL: number;
  SABOTAGE: number;
  HATER_INJECTION: number;
  CASCADE: number;
  SOVEREIGNTY: number;
  OPPORTUNITY_KILL: number;
  REPUTATION_BURN: number;
  SHIELD_PIERCE: number;
};

type MutableTensionSeverityDistribution = {
  MINOR: number;
  MODERATE: number;
  SEVERE: number;
  CRITICAL: number;
  EXISTENTIAL: number;
};

type MutableTensionVisibilityDistribution = {
  HIDDEN: number;
  SILHOUETTE: number;
  PARTIAL: number;
  EXPOSED: number;
};

const DEFAULT_HISTORY_LIMIT = 64;
const EPSILON = 0.000001;

export class TensionMetricsCollector {
  private readonly historyLimit: number;
  private history: TensionMetricsSnapshot[] = [];

  public constructor(historyLimit: number = DEFAULT_HISTORY_LIMIT) {
    this.historyLimit = Math.max(8, historyLimit);
  }

  public collect(input: TensionMetricsInput): TensionMetricsSnapshot {
    const queueEntries = Object.freeze([...(input.queueEntries ?? [])]);
    const runtime = input.runtimeSnapshot;
    const visibleThreats = runtime.visibleThreats;

    const activeEntries = queueEntries.filter(
      (entry) =>
        entry.state === ENTRY_STATE.QUEUED ||
        entry.state === ENTRY_STATE.ARRIVED,
    );

    const queuedEntries = activeEntries.filter(
      (entry) => entry.state === ENTRY_STATE.QUEUED,
    );

    const arrivedEntries = activeEntries.filter(
      (entry) => entry.state === ENTRY_STATE.ARRIVED,
    );

    const expiredEntries = queueEntries.filter(
      (entry) => entry.state === ENTRY_STATE.EXPIRED,
    );

    const relievedEntries = queueEntries.filter(
      (entry) =>
        entry.state === ENTRY_STATE.MITIGATED ||
        entry.state === ENTRY_STATE.NULLIFIED,
    );

    const etaValues = queuedEntries
      .map((entry) => Math.max(0, entry.arrivalTick - runtime.tickNumber))
      .sort((a, b) => a - b);

    const severityWeights = activeEntries.map((entry) =>
      this.safeNumber(entry.severityWeight),
    );

    const threatTypes = this.createMutableTypeDistribution();
    const severities = this.createMutableSeverityDistribution();
    const visibilityLevels = this.createMutableVisibilityDistribution();

    for (const entry of queueEntries) {
      threatTypes[entry.threatType] += 1;
      severities[entry.threatSeverity] += 1;
    }

    for (const visibleThreat of visibleThreats) {
      switch (visibleThreat.visibleAs) {
        case 'HIDDEN':
          visibilityLevels.HIDDEN += 1;
          break;
        case 'SILHOUETTE':
          visibilityLevels.SILHOUETTE += 1;
          break;
        case 'PARTIAL':
          visibilityLevels.PARTIAL += 1;
          break;
        case 'EXPOSED':
          visibilityLevels.EXPOSED += 1;
          break;
        default:
          break;
      }
    }

    const totalSeverityWeight = severityWeights.reduce(
      (sum, value) => sum + value,
      0,
    );

    const dominantSeverityWeight =
      severityWeights.length > 0 ? Math.max(...severityWeights) : 0;

    const mitigationCoverageRatio =
      activeEntries.length === 0
        ? 1
        : activeEntries.filter((entry) => entry.mitigationCardTypes.length > 0)
            .length / activeEntries.length;

    const avgEtaTicks =
      etaValues.length === 0
        ? 0
        : etaValues.reduce((sum, value) => sum + value, 0) / etaValues.length;

    const nearestEtaTicks = etaValues.length > 0 ? (etaValues[0] ?? null) : null;
    const furthestEtaTicks =
      etaValues.length > 0 ? (etaValues[etaValues.length - 1] ?? null) : null;

    const threatEntropy = this.computeThreatEntropy(
      threatTypes,
      queueEntries.length,
    );

    const awarenessLoad =
      runtime.contributionBreakdown.visibilityBonus +
      visibleThreats.length / Math.max(1, runtime.queueLength);

    const queuePressureRatio = this.clamp01(
      (runtime.queuedCount * 0.4 +
        runtime.arrivedCount * 0.9 +
        runtime.expiredCount * 0.75) /
        Math.max(1, runtime.queueLength + runtime.expiredCount),
    );

    const ghostBurden = this.safeNumber(
      runtime.contributionBreakdown.expiredGhosts,
    );

    const reliefStrength = Math.abs(
      this.safeNumber(runtime.contributionBreakdown.mitigationDecay) +
        this.safeNumber(runtime.contributionBreakdown.nullifyDecay) +
        this.safeNumber(runtime.contributionBreakdown.emptyQueueBonus) +
        this.safeNumber(runtime.contributionBreakdown.sovereigntyBonus),
    );

    const backlogRisk = this.clamp01(
      runtime.arrivedCount * 0.22 +
        runtime.expiredCount * 0.18 +
        runtime.queuedCount * 0.06 +
        (runtime.isPulseActive ? 0.15 : 0),
    );

    const collapseRisk = this.clamp01(
      runtime.score * 0.45 +
        queuePressureRatio * 0.2 +
        ghostBurden * 0.2 +
        (runtime.isPulseActive ? 0.1 : 0) +
        (runtime.pulseTicksActive >= 3 ? 0.05 : 0),
    );

    const escalationSlope = this.computeEscalationSlope(runtime.score);

    const metrics: TensionMetricsSnapshot = Object.freeze({
      runId: input.runState.runId,
      tick: input.runState.tick,
      mode: input.runState.mode,

      score: runtime.score,
      previousScore: runtime.previousScore,
      delta: runtime.score - runtime.previousScore,
      rawDelta: runtime.rawDelta,
      amplifiedDelta: runtime.amplifiedDelta,

      queueLength: runtime.queueLength,
      queuedCount: runtime.queuedCount,
      arrivedCount: runtime.arrivedCount,
      expiredCount: runtime.expiredCount,
      relievedCount: runtime.relievedCount,

      visibleThreatCount: visibleThreats.length,
      hiddenThreatCount: Math.max(0, runtime.queueLength - visibleThreats.length),
      arrivedThreatRatio:
        runtime.queueLength === 0
          ? 0
          : runtime.arrivedCount / runtime.queueLength,
      unresolvedThreatRatio:
        runtime.queueLength === 0
          ? 0
          : (runtime.queueLength + runtime.expiredCount) /
            Math.max(
              1,
              runtime.queueLength +
                runtime.expiredCount +
                runtime.relievedCount,
            ),

      avgEtaTicks,
      nearestEtaTicks,
      furthestEtaTicks,
      overdueCount: arrivedEntries.filter((entry) => entry.ticksOverdue > 0).length,

      totalSeverityWeight,
      averageSeverityWeight:
        severityWeights.length === 0
          ? 0
          : totalSeverityWeight / severityWeights.length,
      dominantSeverityWeight,
      severityDensity:
        runtime.queueLength === 0
          ? 0
          : totalSeverityWeight / runtime.queueLength,

      mitigationCoverageRatio,
      threatEntropy,
      queuePressureRatio,
      ghostBurden,
      reliefStrength,
      awarenessLoad,
      backlogRisk,
      collapseRisk,

      isPulseActive: runtime.isPulseActive,
      isSustainedPulse: runtime.pulseTicksActive >= 3,
      escalationSlope,
      escalationMomentum: this.resolveMomentum(escalationSlope),

      threatTypes: Object.freeze({
        ...threatTypes,
      }),
      severities: Object.freeze({
        ...severities,
      }),
      visibilityLevels: Object.freeze({
        ...visibilityLevels,
      }),
      contributionBreakdown: Object.freeze({
        ...runtime.contributionBreakdown,
      }),
    });

    this.history.push(metrics);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return metrics;
  }

  public getLastSnapshot(): TensionMetricsSnapshot | null {
    return this.history.length > 0
      ? (this.history[this.history.length - 1] ?? null)
      : null;
  }

  public getHistory(): readonly TensionMetricsSnapshot[] {
    return Object.freeze([...this.history]);
  }

  public reset(): void {
    this.history = [];
  }

  private computeEscalationSlope(currentScore: number): number {
    const last = this.getLastSnapshot();
    if (!last) {
      return 0;
    }

    return currentScore - last.score;
  }

  private resolveMomentum(
    slope: number,
  ): 'FALLING' | 'FLAT' | 'RISING' | 'SPIKING' {
    if (slope >= 0.15) {
      return 'SPIKING';
    }
    if (slope >= 0.025) {
      return 'RISING';
    }
    if (slope <= -0.025) {
      return 'FALLING';
    }
    return 'FLAT';
  }

  private computeThreatEntropy(
    distribution: Readonly<MutableTensionTypeDistribution>,
    total: number,
  ): number {
    if (total <= 0) {
      return 0;
    }

    const values = Object.values(distribution).filter((count) => count > 0);
    let entropy = 0;

    for (const count of values) {
      const probability = count / total;
      entropy += -(probability * Math.log2(probability));
    }

    return entropy;
  }

  private createMutableTypeDistribution(): MutableTensionTypeDistribution {
    return {
      DEBT_SPIRAL: 0,
      SABOTAGE: 0,
      HATER_INJECTION: 0,
      CASCADE: 0,
      SOVEREIGNTY: 0,
      OPPORTUNITY_KILL: 0,
      REPUTATION_BURN: 0,
      SHIELD_PIERCE: 0,
    };
  }

  private createMutableSeverityDistribution(): MutableTensionSeverityDistribution {
    return {
      MINOR: 0,
      MODERATE: 0,
      SEVERE: 0,
      CRITICAL: 0,
      EXISTENTIAL: 0,
    };
  }

  private createMutableVisibilityDistribution(): MutableTensionVisibilityDistribution {
    return {
      HIDDEN: 0,
      SILHOUETTE: 0,
      PARTIAL: 0,
      EXPOSED: 0,
    };
  }

  private clamp01(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(1, value));
  }

  private safeNumber(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }

    if (Math.abs(value) < EPSILON) {
      return 0;
    }

    return value;
  }
}