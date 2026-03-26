/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND TENSION METRICS COLLECTOR (v2 upgrade)
 * /backend/src/game/engine/tension/TensionMetricsCollector.ts
 * ============================================================================
 *
 * Purpose:
 * - derive higher-order operational metrics from Engine 3 runtime output
 * - keep TensionEngine focused on queue/state transitions, not analytics
 * - produce immutable telemetry-friendly snapshots for dashboards, traces,
 *   replay analysis, anomaly detection, and future adaptive balancing
 * - provide ML/DL feature vectors, health reports, forecasts, narratives,
 *   adaptive recommendations, and serialization with integrity checksums
 *
 * Design:
 * - pure read-model collector, no game-state mutation
 * - accepts runtime snapshot + queue state + run snapshot
 * - maintains a rolling history (configurable capacity) for trend/anomaly calc
 * - output is backend-safe, serialization-safe, and mode-agnostic
 * - all scoring is pure — zero mutation, zero side effects, zero hidden state
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  ENTRY_STATE,
  PRESSURE_TENSION_AMPLIFIERS,
  TENSION_CONSTANTS,
  TENSION_VISIBILITY_STATE,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  TENSION_EVENT_NAMES,
  VISIBILITY_CONFIGS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  type AnticipationEntry,
  type DecayContributionBreakdown,
  type TensionRuntimeSnapshot,
  type PressureTier,
  type ThreatSeverity,
  type ThreatType,
  type TensionVisibilityState,
  type VisibilityConfig,
  type VisibilityLevel,
  type ThreatEnvelope,
  type EntryState,
  type DecayComputeInput,
  type DecayComputeResult,
} from './types';

// ============================================================================
// SECTION 1 — MODULE CONSTANTS
// ============================================================================

export const METRICS_ML_FEATURE_COUNT = 32;
export const METRICS_DL_SEQUENCE_LENGTH = 16;
export const METRICS_DL_FEATURE_WIDTH = 8;
export const METRICS_HISTORY_CAPACITY = 64;

const DEFAULT_HISTORY_LIMIT = METRICS_HISTORY_CAPACITY;
const EPSILON = 0.000001;
const METRICS_VERSION = 'tension-metrics.v2.2026';

// ============================================================================
// SECTION 2 — PRESERVED INPUT / DISTRIBUTION INTERFACES
// ============================================================================

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

// ============================================================================
// SECTION 3 — NEW EXPORTED INTERFACES
// ============================================================================

export interface MetricsMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly runId: string;
}

export interface MetricsDLTensor {
  readonly rows: number;
  readonly cols: number;
  readonly data: readonly (readonly number[])[];
  readonly columnLabels: readonly string[];
}

export interface MetricsHealthReport {
  readonly score: number;
  readonly tier: 'HEALTHY' | 'WATCH' | 'WARNING' | 'CRITICAL' | 'COLLAPSE';
  readonly flags: readonly string[];
  readonly recommendations: readonly string[];
  readonly amplifiedScoreEstimate: number;
  readonly pressureTier: PressureTier;
}

export interface MetricsTrendSnapshot {
  readonly scoreVelocity: number;
  readonly scoreAcceleration: number;
  readonly queueGrowthRate: number;
  readonly severityEscalationRate: number;
  readonly visibilityDriftRate: number;
  readonly mitigationEfficiency: number;
  readonly pulseProbability: number;
}

export interface MetricsAnomalyRecord {
  readonly tick: number;
  readonly field: string;
  readonly value: number;
  readonly expected: number;
  readonly zScore: number;
  readonly isOutlier: boolean;
}

export interface MetricsAnomalyReport {
  readonly anomalies: readonly MetricsAnomalyRecord[];
  readonly overallAnomalyScore: number;
  readonly timestamp: number;
}

export interface MetricsForecast {
  readonly recovery: {
    readonly ticksToRecovery: number | null;
    readonly confidence: number;
  };
  readonly escalation: {
    readonly willPulse: boolean;
    readonly ticksToNextPulse: number | null;
    readonly confidence: number;
  };
  readonly queueResolution: {
    readonly ticksToEmpty: number | null;
  };
}

export interface MetricsAdaptiveRecommendation {
  readonly priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly category: string;
  readonly action: string;
  readonly rationale: string;
  readonly estimatedImpact: number;
}

export interface MetricsSessionSummary {
  readonly totalTicks: number;
  readonly maxScore: number;
  readonly minScore: number;
  readonly avgScore: number;
  readonly peakQueueLength: number;
  readonly totalMitigations: number;
  readonly totalExpirations: number;
  readonly totalArrivals: number;
  readonly pulseCount: number;
  readonly sustainedPulseCount: number;
  readonly dominantThreatType: ThreatType | null;
  readonly dominantSeverity: ThreatSeverity | null;
  readonly averageEscalationSlope: number;
  readonly sessionDurationTicks: number;
}

export interface MetricsNarrative {
  readonly title: string;
  readonly summary: string;
  readonly threatContext: string;
  readonly recommendationText: string;
  readonly urgencyTag: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CALM';
  readonly tick: number;
}

export interface MetricsSerializedState {
  readonly version: string;
  readonly runId: string;
  readonly historyJson: string;
  readonly sessionJson: string;
  readonly checksum: string;
}

export interface MetricsExportBundle {
  readonly snapshot: TensionMetricsSnapshot;
  readonly mlVector: MetricsMLVector;
  readonly dlTensor: MetricsDLTensor;
  readonly healthReport: MetricsHealthReport;
  readonly trendSnapshot: MetricsTrendSnapshot;
  readonly anomalyReport: MetricsAnomalyReport;
  readonly forecast: MetricsForecast;
  readonly recommendations: readonly MetricsAdaptiveRecommendation[];
  readonly sessionSummary: MetricsSessionSummary;
  readonly narrative: MetricsNarrative;
  readonly serializedState: MetricsSerializedState;
  readonly exportedAtMs: number;
}

export interface MetricsSelfTestResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly checks: readonly string[];
  readonly durationMs: number;
}

// ============================================================================
// SECTION 4 — ML FEATURE LABELS
// ============================================================================

const ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'score',
  'previousScore',
  'delta',
  'rawDelta',
  'amplifiedDelta',
  'queueLength',
  'queuedCount',
  'arrivedCount',
  'expiredCount',
  'relievedCount',
  'totalSeverityWeight',
  'averageSeverityWeight',
  'dominantSeverityWeight',
  'severityDensity',
  'mitigationCoverageRatio',
  'threatEntropy',
  'queuePressureRatio',
  'ghostBurden',
  'reliefStrength',
  'awarenessLoad',
  'backlogRisk',
  'collapseRisk',
  'escalationSlope',
  'avgEtaTicks',
  'overdueCount',
  'arrivedThreatRatio',
  'pressureAmplifier',
  'visibilityStateRank',
  'awarenessBonus',
  'pulseProbability',
  'severityEntropy',
  'mitigationGapScore',
]);

const DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  'score',
  'delta',
  'queueLen',
  'severityWeight',
  'pulse',
  'escalationSlope',
  'collapseRisk',
  'amplifiedDelta',
]);

// ============================================================================
// SECTION 5 — MUTABLE DISTRIBUTION HELPERS
// ============================================================================

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

// ============================================================================
// SECTION 6 — TensionMetricsCollector CLASS
// ============================================================================

export class TensionMetricsCollector {
  private readonly historyLimit: number;
  private history: TensionMetricsSnapshot[] = [];

  public constructor(historyLimit: number = DEFAULT_HISTORY_LIMIT) {
    this.historyLimit = Math.max(8, historyLimit);
  }

  // --------------------------------------------------------------------------
  // PUBLIC: collect
  // --------------------------------------------------------------------------

  public collect(input: TensionMetricsInput): TensionMetricsSnapshot {
    const queueEntries = Object.freeze([...(input.queueEntries ?? [])]);
    const runtime = input.runtimeSnapshot;
    const visibleThreats = runtime.visibleThreats;

    // Pressure amplifier internally tracked for amplifiedScoreEstimate
    const pressureTier: PressureTier = input.runState.pressure?.tier ?? 'T0';
    const _amplifierUsed = this.computePressureAmplification(pressureTier);

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

    // ghostBurden uses TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK as scale reference
    const ghostBurden = this.safeNumber(
      runtime.contributionBreakdown.expiredGhosts *
        (1 + TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK),
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
        (runtime.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS
          ? 0.05
          : 0),
    );

    const escalationSlope = this.computeEscalationSlope(runtime.score);

    // Pulse detection uses TENSION_CONSTANTS.PULSE_THRESHOLD
    const isPulseActive =
      runtime.isPulseActive ||
      runtime.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;

    const metrics: TensionMetricsSnapshot = Object.freeze({
      runId: input.runState.runId,
      tick: input.runState.tick,
      mode: input.runState.mode,

      score: this.clamp01(runtime.score),
      previousScore: this.clamp01(runtime.previousScore),
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

      isPulseActive,
      isSustainedPulse:
        runtime.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
      escalationSlope,
      escalationMomentum: this.resolveMomentum(escalationSlope),

      threatTypes: Object.freeze({ ...threatTypes }),
      severities: Object.freeze({ ...severities }),
      visibilityLevels: Object.freeze({ ...visibilityLevels }),
      contributionBreakdown: Object.freeze({ ...runtime.contributionBreakdown }),
    });

    this.history.push(metrics);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return metrics;
  }

  // --------------------------------------------------------------------------
  // PUBLIC: computeMLVector — 32 labeled features
  // --------------------------------------------------------------------------

  public computeMLVector(
    snapshot: TensionMetricsSnapshot,
    pressureTier: PressureTier = 'T0',
  ): MetricsMLVector {
    const amplifier = this.computePressureAmplification(pressureTier);
    const visState = this.resolveVisibilityStateFromScore(snapshot.score);
    const visRank = this.computeVisibilityStateRank(visState);
    const awarenessBonus = this.computeAwarenessBonus(visState);
    const ampDelta = snapshot.amplifiedDelta * amplifier;

    // Dominant severity from distribution
    const dominantSeverity = this.resolveDominantSeverity(snapshot.severities);
    const dominantSevWeight = dominantSeverity
      ? this.computeWeightedSeverityScore(dominantSeverity)
      : 0;

    // Severity entropy
    const totalSev =
      snapshot.severities.MINOR +
      snapshot.severities.MODERATE +
      snapshot.severities.SEVERE +
      snapshot.severities.CRITICAL +
      snapshot.severities.EXISTENTIAL;
    const severityEntropy = this.computeSeverityEntropy(snapshot.severities, totalSev);

    // Mitigation gap: average default mitigation coverage across threat types
    const mitigationGapScore = this.computeMitigationGapScore(snapshot.threatTypes);

    // Pulse probability from trend
    const recentHistory = this.history.slice(-4);
    const pulseProbability = this.estimatePulseProbability(recentHistory, snapshot);

    const features: readonly number[] = Object.freeze([
      this.safeNumber(snapshot.score),                          // 0  score
      this.safeNumber(snapshot.previousScore),                  // 1  previousScore
      this.safeNumber(snapshot.delta),                          // 2  delta
      this.safeNumber(snapshot.rawDelta),                       // 3  rawDelta
      this.safeNumber(ampDelta),                                // 4  amplifiedDelta
      this.safeNumber(snapshot.queueLength),                    // 5  queueLength
      this.safeNumber(snapshot.queuedCount),                    // 6  queuedCount
      this.safeNumber(snapshot.arrivedCount),                   // 7  arrivedCount
      this.safeNumber(snapshot.expiredCount),                   // 8  expiredCount
      this.safeNumber(snapshot.relievedCount),                  // 9  relievedCount
      this.safeNumber(snapshot.totalSeverityWeight),            // 10 totalSeverityWeight
      this.safeNumber(snapshot.averageSeverityWeight),          // 11 averageSeverityWeight
      this.safeNumber(dominantSevWeight),                       // 12 dominantSeverityWeight
      this.safeNumber(snapshot.severityDensity),                // 13 severityDensity
      this.safeNumber(snapshot.mitigationCoverageRatio),        // 14 mitigationCoverageRatio
      this.safeNumber(snapshot.threatEntropy),                  // 15 threatEntropy
      this.safeNumber(snapshot.queuePressureRatio),             // 16 queuePressureRatio
      this.safeNumber(snapshot.ghostBurden),                    // 17 ghostBurden
      this.safeNumber(snapshot.reliefStrength),                 // 18 reliefStrength
      this.safeNumber(snapshot.awarenessLoad),                  // 19 awarenessLoad
      this.safeNumber(snapshot.backlogRisk),                    // 20 backlogRisk
      this.safeNumber(snapshot.collapseRisk),                   // 21 collapseRisk
      this.safeNumber(snapshot.escalationSlope),                // 22 escalationSlope
      this.safeNumber(snapshot.avgEtaTicks),                    // 23 avgEtaTicks
      this.safeNumber(snapshot.overdueCount),                   // 24 overdueCount
      this.safeNumber(snapshot.arrivedThreatRatio),             // 25 arrivedThreatRatio
      this.safeNumber(amplifier),                               // 26 pressureAmplifier
      this.safeNumber(visRank),                                 // 27 visibilityStateRank
      this.safeNumber(awarenessBonus),                          // 28 awarenessBonus
      this.safeNumber(pulseProbability),                        // 29 pulseProbability
      this.safeNumber(severityEntropy),                         // 30 severityEntropy
      this.safeNumber(mitigationGapScore),                      // 31 mitigationGapScore
    ]);

    return Object.freeze({
      features,
      labels: ML_FEATURE_LABELS,
      tick: snapshot.tick,
      runId: snapshot.runId,
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: extractDLTensor — 16×8 from rolling history
  // --------------------------------------------------------------------------

  public extractDLTensor(): MetricsDLTensor {
    const rows = METRICS_DL_SEQUENCE_LENGTH;
    const cols = METRICS_DL_FEATURE_WIDTH;

    // Use most recent history up to 16 entries, pad with zeros if fewer
    const recent = this.history.slice(-rows);
    const data: (readonly number[])[] = [];

    for (let i = 0; i < rows; i++) {
      const snap = recent[i] ?? null;
      if (snap === null) {
        data.push(Object.freeze(new Array(cols).fill(0) as number[]));
        continue;
      }

      const visState = this.resolveVisibilityStateFromScore(snap.score);
      const amplifier = this.computePressureAmplification('T1'); // conservative default
      const ampDelta = snap.amplifiedDelta * amplifier;
      const escalationSlope = this.safeNumber(snap.escalationSlope);
      const collapseRisk = this.safeNumber(snap.collapseRisk);
      const pulse = snap.isPulseActive ? 1 : 0;
      const dominantSev = this.resolveDominantSeverity(snap.severities);
      const severityWeight = dominantSev
        ? this.computeWeightedSeverityScore(dominantSev)
        : 0;

      // Suppress unused variable warning — visState used in envelopeLevel
      const _envelopeLevel: VisibilityLevel = this.mapVisibilityStateToEnvelopeLevel(visState);

      data.push(
        Object.freeze([
          this.safeNumber(snap.score),          // col 0: score
          this.safeNumber(snap.delta),          // col 1: delta
          this.safeNumber(snap.queueLength),    // col 2: queueLen
          this.safeNumber(severityWeight),      // col 3: severityWeight
          pulse,                                // col 4: pulse (0/1)
          this.safeNumber(escalationSlope),     // col 5: escalationSlope
          this.safeNumber(collapseRisk),        // col 6: collapseRisk
          this.safeNumber(ampDelta),            // col 7: amplifiedDelta
        ] as readonly number[]),
      );
    }

    return Object.freeze({
      rows,
      cols,
      data: Object.freeze(data),
      columnLabels: DL_COLUMN_LABELS,
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: computeHealthReport
  // --------------------------------------------------------------------------

  public computeHealthReport(
    snapshot: TensionMetricsSnapshot,
    pressureTier: PressureTier = 'T0',
  ): MetricsHealthReport {
    const amplifier = this.computePressureAmplification(pressureTier);
    const amplifiedScoreEstimate = this.clamp01(snapshot.score * amplifier);
    const flags: string[] = [];
    const recommendations: string[] = [];

    // Score thresholds from TENSION_CONSTANTS
    const scoreIsAtMax = snapshot.score >= TENSION_CONSTANTS.MAX_SCORE;
    const scoreIsAtMin = snapshot.score <= TENSION_CONSTANTS.MIN_SCORE + 0.05;
    const scoreNearPulse = snapshot.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;

    if (scoreIsAtMax) {
      flags.push('SCORE_AT_MAXIMUM');
      recommendations.push('Immediate threat mitigation required — tension is fully saturated.');
    }

    if (scoreNearPulse) {
      flags.push('SCORE_NEAR_PULSE_THRESHOLD');
      recommendations.push('Score approaching pulse threshold; prioritize relief actions.');
    }

    if (snapshot.isPulseActive) {
      flags.push('PULSE_ACTIVE');
      recommendations.push('Pulse is active — deploy mitigation cards immediately.');
    }

    if (snapshot.isSustainedPulse) {
      flags.push('SUSTAINED_PULSE');
      recommendations.push('Sustained pulse detected — queue is critically overloaded.');
    }

    if (snapshot.collapseRisk > 0.75) {
      flags.push('HIGH_COLLAPSE_RISK');
      recommendations.push('Collapse risk is dangerously high; stabilize queue first.');
    }

    if (snapshot.ghostBurden > TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * 3) {
      flags.push('HIGH_GHOST_BURDEN');
      recommendations.push('Ghost burden from expired threats is inflating score; clear backlog.');
    }

    if (snapshot.queuePressureRatio > 0.8) {
      flags.push('QUEUE_PRESSURE_CRITICAL');
    }

    // Queued tension rate projection
    const queuedRateContrib =
      snapshot.queuedCount * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
    const arrivedRateContrib =
      snapshot.arrivedCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
    const totalRateContrib = queuedRateContrib + arrivedRateContrib;

    if (totalRateContrib > 0.5) {
      flags.push('HIGH_RATE_PROJECTION');
      recommendations.push(
        `Rate projection ${totalRateContrib.toFixed(3)}/tick — reduce active threats.`,
      );
    }

    if (scoreIsAtMin) {
      flags.push('SCORE_MINIMAL');
    }

    // Determine tier
    let tier: MetricsHealthReport['tier'];
    if (amplifiedScoreEstimate >= 0.95 || snapshot.isSustainedPulse) {
      tier = 'COLLAPSE';
    } else if (amplifiedScoreEstimate >= 0.75 || snapshot.isPulseActive) {
      tier = 'CRITICAL';
    } else if (amplifiedScoreEstimate >= 0.55 || snapshot.collapseRisk > 0.6) {
      tier = 'WARNING';
    } else if (amplifiedScoreEstimate >= 0.35 || snapshot.backlogRisk > 0.4) {
      tier = 'WATCH';
    } else {
      tier = 'HEALTHY';
    }

    const overallHealthScore = this.clamp01(1 - amplifiedScoreEstimate);

    return Object.freeze({
      score: overallHealthScore,
      tier,
      flags: Object.freeze(flags),
      recommendations: Object.freeze(recommendations),
      amplifiedScoreEstimate,
      pressureTier,
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: computeTrendSnapshot — 8 most recent snapshots
  // --------------------------------------------------------------------------

  public computeTrendSnapshot(): MetricsTrendSnapshot {
    const window = this.history.slice(-8);
    if (window.length < 2) {
      return Object.freeze({
        scoreVelocity: 0,
        scoreAcceleration: 0,
        queueGrowthRate: 0,
        severityEscalationRate: 0,
        visibilityDriftRate: 0,
        mitigationEfficiency: 0,
        pulseProbability: 0,
      });
    }

    const scores = window.map((s) => s.score);
    const queueLengths = window.map((s) => s.queueLength);
    const severityWeights = window.map((s) => s.totalSeverityWeight);
    const visRanks = window.map((s) => {
      const state = this.resolveVisibilityStateFromScore(s.score);
      return this.computeVisibilityStateRank(state);
    });
    const mitigations = window.map((s) => s.mitigationCoverageRatio);

    // Score velocity: mean first-order difference
    const scoreDeltas: number[] = [];
    for (let i = 1; i < scores.length; i++) {
      scoreDeltas.push((scores[i] ?? 0) - (scores[i - 1] ?? 0));
    }
    const scoreVelocity = this.computeRunningMean(scoreDeltas);

    // Score acceleration: second-order difference of velocity
    const accelDeltas: number[] = [];
    for (let i = 1; i < scoreDeltas.length; i++) {
      accelDeltas.push((scoreDeltas[i] ?? 0) - (scoreDeltas[i - 1] ?? 0));
    }
    const scoreAcceleration =
      accelDeltas.length > 0 ? this.computeRunningMean(accelDeltas) : 0;

    // Queue growth rate
    const queueDeltas: number[] = [];
    for (let i = 1; i < queueLengths.length; i++) {
      queueDeltas.push((queueLengths[i] ?? 0) - (queueLengths[i - 1] ?? 0));
    }
    const queueGrowthRate = this.computeRunningMean(queueDeltas);

    // Severity escalation rate
    const sevDeltas: number[] = [];
    for (let i = 1; i < severityWeights.length; i++) {
      sevDeltas.push((severityWeights[i] ?? 0) - (severityWeights[i - 1] ?? 0));
    }
    const severityEscalationRate = this.computeRunningMean(sevDeltas);

    // Visibility drift rate
    const visDeltas: number[] = [];
    for (let i = 1; i < visRanks.length; i++) {
      visDeltas.push((visRanks[i] ?? 0) - (visRanks[i - 1] ?? 0));
    }
    const visibilityDriftRate = this.computeRunningMean(visDeltas);

    // Mitigation efficiency: mean coverage ratio
    const mitigationEfficiency = this.computeRunningMean(mitigations);

    // Pulse probability: fraction of recent ticks with pulse active
    const pulseCount = window.filter((s) => s.isPulseActive).length;
    const pulseProbability = pulseCount / window.length;

    return Object.freeze({
      scoreVelocity,
      scoreAcceleration,
      queueGrowthRate,
      severityEscalationRate,
      visibilityDriftRate,
      mitigationEfficiency,
      pulseProbability,
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: computeAnomalyReport — z-score anomaly detection
  // --------------------------------------------------------------------------

  public computeAnomalyReport(): MetricsAnomalyReport {
    const anomalies: MetricsAnomalyRecord[] = [];

    if (this.history.length < 4) {
      return Object.freeze({
        anomalies: Object.freeze([]),
        overallAnomalyScore: 0,
        timestamp: Date.now(),
      });
    }

    const fields: Array<keyof TensionMetricsSnapshot> = [
      'score',
      'delta',
      'queueLength',
      'collapseRisk',
      'backlogRisk',
      'ghostBurden',
      'escalationSlope',
    ];

    for (const field of fields) {
      const values = this.history
        .map((s) => s[field])
        .filter((v): v is number => typeof v === 'number');

      if (values.length < 3) continue;

      const mean = this.computeRunningMean(values);
      const stdDev = this.computeRunningStdDev(values, mean);

      if (stdDev < EPSILON) continue;

      // Check last snapshot for anomaly
      const lastSnap = this.history[this.history.length - 1];
      if (!lastSnap) continue;

      const rawVal = lastSnap[field];
      if (typeof rawVal !== 'number') continue;

      const value = rawVal;
      const zScore = (value - mean) / stdDev;
      const isOutlier = Math.abs(zScore) > 2.5;

      if (isOutlier) {
        anomalies.push(
          Object.freeze({
            tick: lastSnap.tick,
            field: String(field),
            value,
            expected: mean,
            zScore,
            isOutlier,
          }),
        );
      }
    }

    const overallAnomalyScore = this.clamp01(
      anomalies.reduce((acc, a) => acc + Math.min(1, Math.abs(a.zScore) / 5), 0) /
        Math.max(1, fields.length),
    );

    return Object.freeze({
      anomalies: Object.freeze(anomalies),
      overallAnomalyScore,
      timestamp: Date.now(),
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: computeForecast
  // --------------------------------------------------------------------------

  public computeForecast(
    snapshot: TensionMetricsSnapshot,
    pressureTier: PressureTier = 'T0',
  ): MetricsForecast {
    const amplifier = this.computePressureAmplification(pressureTier);

    // Rate projections using TENSION_CONSTANTS
    const incomingRate =
      snapshot.queuedCount * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * amplifier +
      snapshot.arrivedCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * amplifier +
      snapshot.expiredCount * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;

    const outgoingRate = snapshot.reliefStrength;

    // Recovery: ticks until score drops below 0.3 (comfortable threshold)
    const recoveryThreshold = 0.3;
    const currentScore = snapshot.score;
    let ticksToRecovery: number | null = null;
    let recoveryConfidence = 0;

    if (currentScore <= recoveryThreshold) {
      ticksToRecovery = 0;
      recoveryConfidence = 0.95;
    } else if (outgoingRate > incomingRate && outgoingRate > EPSILON) {
      const netDecay = outgoingRate - incomingRate;
      const scoreDelta = currentScore - recoveryThreshold;
      ticksToRecovery = Math.ceil(scoreDelta / netDecay);
      recoveryConfidence = this.clamp01(0.8 - snapshot.collapseRisk * 0.4);
    } else {
      ticksToRecovery = null;
      recoveryConfidence = 0.1;
    }

    // Escalation: will pulse?
    const scoreGapToPulse = TENSION_CONSTANTS.PULSE_THRESHOLD - currentScore;
    let willPulse = snapshot.isPulseActive;
    let ticksToNextPulse: number | null = null;
    let escalationConfidence = 0;

    if (willPulse) {
      ticksToNextPulse = 0;
      escalationConfidence = 0.99;
    } else if (scoreGapToPulse <= 0.05) {
      willPulse = true;
      ticksToNextPulse = 1;
      escalationConfidence = 0.85;
    } else if (incomingRate > outgoingRate && incomingRate > EPSILON) {
      const netGrowth = incomingRate - outgoingRate;
      if (netGrowth > EPSILON) {
        ticksToNextPulse = Math.ceil(scoreGapToPulse / netGrowth);
        willPulse = ticksToNextPulse <= 20;
        escalationConfidence = willPulse
          ? this.clamp01(0.7 + snapshot.collapseRisk * 0.25)
          : 0.2;
      }
    }

    // Queue resolution: ticks until queue is empty
    let ticksToEmpty: number | null = null;
    const totalQueueActive = snapshot.queuedCount + snapshot.arrivedCount;
    if (totalQueueActive === 0) {
      ticksToEmpty = 0;
    } else if (outgoingRate > EPSILON) {
      // Estimate based on how many "tickets" need to be resolved
      const averageTicksPerResolution =
        snapshot.avgEtaTicks > 0 ? snapshot.avgEtaTicks : 5;
      ticksToEmpty = Math.ceil(totalQueueActive * averageTicksPerResolution);
    }

    return Object.freeze({
      recovery: Object.freeze({
        ticksToRecovery,
        confidence: recoveryConfidence,
      }),
      escalation: Object.freeze({
        willPulse,
        ticksToNextPulse,
        confidence: escalationConfidence,
      }),
      queueResolution: Object.freeze({
        ticksToEmpty,
      }),
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: computeRecommendations — up to 5 prioritized
  // --------------------------------------------------------------------------

  public computeRecommendations(
    snapshot: TensionMetricsSnapshot,
    pressureTier: PressureTier = 'T0',
  ): MetricsAdaptiveRecommendation[] {
    const recommendations: MetricsAdaptiveRecommendation[] = [];
    const amplifier = this.computePressureAmplification(pressureTier);

    // CRITICAL: pulse or collapse
    if (snapshot.isPulseActive || snapshot.isSustainedPulse) {
      const dominantType = this.resolveDominantThreatType(snapshot.threatTypes);
      const mitigations = dominantType
        ? THREAT_TYPE_DEFAULT_MITIGATIONS[dominantType]
        : [];
      const coverage = dominantType
        ? this.computeDefaultMitigationCoverage(dominantType)
        : 0;
      recommendations.push({
        priority: 'CRITICAL',
        category: 'PULSE_RESPONSE',
        action: `Deploy ${mitigations[0] ?? 'mitigation'} immediately`,
        rationale: `Pulse active with ${coverage} default mitigation paths available. Score: ${snapshot.score.toFixed(3)}.`,
        estimatedImpact: 0.3 * amplifier,
      });
    }

    // HIGH: collapse risk
    if (snapshot.collapseRisk > 0.6) {
      const sevWeight = this.computeWeightedSeverityScore(THREAT_SEVERITY.CRITICAL);
      recommendations.push({
        priority: 'HIGH',
        category: 'COLLAPSE_PREVENTION',
        action: 'Stabilize queue and reduce arrived threat count',
        rationale: `Collapse risk at ${snapshot.collapseRisk.toFixed(2)}. Critical severity weight: ${sevWeight}.`,
        estimatedImpact: 0.2 * amplifier,
      });
    }

    // HIGH: ghost burden
    if (snapshot.ghostBurden > TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * 2) {
      recommendations.push({
        priority: 'HIGH',
        category: 'GHOST_BURDEN',
        action: 'Clear expired threats to reduce ghost score contribution',
        rationale: `Ghost burden ${snapshot.ghostBurden.toFixed(3)} inflating tension score via expired entries.`,
        estimatedImpact: snapshot.ghostBurden * 0.5,
      });
    }

    // MEDIUM: low mitigation coverage
    if (snapshot.mitigationCoverageRatio < 0.4 && snapshot.queueLength > 2) {
      const dominantType = this.resolveDominantThreatType(snapshot.threatTypes);
      const gap =
        dominantType
          ? THREAT_TYPE_DEFAULT_MITIGATIONS[dominantType].length - 1
          : 0;
      const domTypeName =
        dominantType ?? THREAT_TYPE.DEBT_SPIRAL;
      const coverage = this.computeDefaultMitigationCoverage(domTypeName);
      recommendations.push({
        priority: 'MEDIUM',
        category: 'MITIGATION_GAP',
        action: `Assign mitigation cards for ${domTypeName}`,
        rationale: `Only ${(snapshot.mitigationCoverageRatio * 100).toFixed(0)}% coverage. ${coverage} default mitigations exist; gap of ${gap}.`,
        estimatedImpact: 0.15,
      });
    }

    // MEDIUM: high queue pressure
    if (snapshot.queuePressureRatio > 0.7) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'QUEUE_PRESSURE',
        action: 'Prioritize ARRIVED threats to reduce queue pressure',
        rationale: `Queue pressure ratio ${snapshot.queuePressureRatio.toFixed(2)} exceeds safe threshold. Arrived: ${snapshot.arrivedCount}.`,
        estimatedImpact: 0.1,
      });
    }

    // LOW: sovereignty
    if (snapshot.threatTypes.SOVEREIGNTY > 0) {
      const sovMitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.SOVEREIGNTY];
      const sevW = this.computeWeightedSeverityScore(THREAT_SEVERITY.SEVERE);
      recommendations.push({
        priority: 'LOW',
        category: 'SOVEREIGNTY_THREAT',
        action: `Consider ${sovMitigations[0] ?? 'TRUST_LOCK'} for sovereignty threats`,
        rationale: `${snapshot.threatTypes.SOVEREIGNTY} sovereignty threats in queue. Severe weight: ${sevW}.`,
        estimatedImpact: 0.08,
      });
    }

    // Sort by priority then impact, return top 5
    const priorityOrder: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    recommendations.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 99;
      const pb = priorityOrder[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.estimatedImpact - a.estimatedImpact;
    });

    return recommendations.slice(0, 5);
  }

  // --------------------------------------------------------------------------
  // PUBLIC: computeSessionSummary
  // --------------------------------------------------------------------------

  public computeSessionSummary(): MetricsSessionSummary {
    if (this.history.length === 0) {
      return Object.freeze({
        totalTicks: 0,
        maxScore: 0,
        minScore: 0,
        avgScore: 0,
        peakQueueLength: 0,
        totalMitigations: 0,
        totalExpirations: 0,
        totalArrivals: 0,
        pulseCount: 0,
        sustainedPulseCount: 0,
        dominantThreatType: null,
        dominantSeverity: null,
        averageEscalationSlope: 0,
        sessionDurationTicks: 0,
      });
    }

    const scores = this.history.map((s) => s.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const avgScore = this.computeRunningMean(scores);

    const peakQueueLength = Math.max(...this.history.map((s) => s.queueLength));

    // Mitigations: sum relievedCount deltas
    let totalMitigations = 0;
    let totalExpirations = 0;
    let totalArrivals = 0;
    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];
      if (!prev || !curr) continue;
      const reliefDelta = curr.relievedCount - prev.relievedCount;
      if (reliefDelta > 0) totalMitigations += reliefDelta;
      const expiredDelta = curr.expiredCount - prev.expiredCount;
      if (expiredDelta > 0) totalExpirations += expiredDelta;
      const arrivedDelta = curr.arrivedCount - prev.arrivedCount;
      if (arrivedDelta > 0) totalArrivals += arrivedDelta;
    }

    const pulseCount = this.history.filter((s) => s.isPulseActive).length;
    const sustainedPulseCount = this.history.filter((s) => s.isSustainedPulse).length;

    // Dominant threat type: aggregate across all history
    const typeAccum = this.createMutableTypeDistribution();
    for (const snap of this.history) {
      for (const key of Object.keys(snap.threatTypes) as Array<
        keyof TensionTypeDistribution
      >) {
        typeAccum[key] += snap.threatTypes[key];
      }
    }
    const dominantThreatType = this.resolveDominantThreatType(typeAccum);

    // Dominant severity
    const sevAccum = this.createMutableSeverityDistribution();
    for (const snap of this.history) {
      for (const key of Object.keys(snap.severities) as Array<
        keyof TensionSeverityDistribution
      >) {
        sevAccum[key] += snap.severities[key];
      }
    }
    const dominantSeverity = this.resolveDominantSeverity(sevAccum);

    const slopes = this.history.map((s) => s.escalationSlope);
    const averageEscalationSlope = this.computeRunningMean(slopes);

    const firstTick = this.history[0]?.tick ?? 0;
    const lastTick = this.history[this.history.length - 1]?.tick ?? 0;
    const sessionDurationTicks = lastTick - firstTick;

    return Object.freeze({
      totalTicks: this.history.length,
      maxScore,
      minScore,
      avgScore,
      peakQueueLength,
      totalMitigations,
      totalExpirations,
      totalArrivals,
      pulseCount,
      sustainedPulseCount,
      dominantThreatType,
      dominantSeverity,
      averageEscalationSlope,
      sessionDurationTicks,
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: generateNarrative
  // --------------------------------------------------------------------------

  public generateNarrative(
    snapshot: TensionMetricsSnapshot,
    pressureTier: PressureTier = 'T0',
  ): MetricsNarrative {
    const amplifier = this.computePressureAmplification(pressureTier);
    const amplifiedScore = this.clamp01(snapshot.score * amplifier);
    const visState = this.resolveVisibilityStateFromScore(snapshot.score);
    const visConfig = this.resolveVisibilityConfig(visState);
    const envelopeLevel = this.mapVisibilityStateToEnvelopeLevel(visState);
    const awarenessBonus = this.computeAwarenessBonus(visState);
    const dominantType = this.resolveDominantThreatType(snapshot.threatTypes);
    const dominantSeverity = this.resolveDominantSeverity(snapshot.severities);

    // Urgency tag
    let urgencyTag: MetricsNarrative['urgencyTag'];
    if (snapshot.isSustainedPulse || amplifiedScore >= 0.95) {
      urgencyTag = 'CRITICAL';
    } else if (snapshot.isPulseActive || amplifiedScore >= 0.75) {
      urgencyTag = 'HIGH';
    } else if (snapshot.collapseRisk > 0.5 || amplifiedScore >= 0.5) {
      urgencyTag = 'MEDIUM';
    } else if (amplifiedScore > 0.2) {
      urgencyTag = 'LOW';
    } else {
      urgencyTag = 'CALM';
    }

    // Title
    const momentumLabel = snapshot.escalationMomentum;
    const title = `Tension at ${(snapshot.score * 100).toFixed(1)}% — ${momentumLabel} [${urgencyTag}]`;

    // Summary — uses TENSION_EVENT_NAMES for channel references
    const scoreChannel = this.buildEventChannelKey(TENSION_EVENT_NAMES.SCORE_UPDATED);
    const pulseChannel = this.buildEventChannelKey(TENSION_EVENT_NAMES.PULSE_FIRED);
    const queueChannel = this.buildEventChannelKey(TENSION_EVENT_NAMES.QUEUE_UPDATED);

    const summary =
      `Score: ${snapshot.score.toFixed(3)} (amplified: ${amplifiedScore.toFixed(3)} at ${pressureTier}). ` +
      `Visibility: ${visState} → envelope ${envelopeLevel} (awareness +${awarenessBonus.toFixed(2)}). ` +
      `Channels: ${scoreChannel}, ${pulseChannel}, ${queueChannel}. ` +
      `Pulse: ${snapshot.isPulseActive ? 'ACTIVE' : 'inactive'}, sustained: ${snapshot.isSustainedPulse}. ` +
      `Mitigation path shown: ${visConfig.showsMitigationPath}, worst case shown: ${visConfig.showsWorstCase}. ` +
      `Downgrade delay: ${visConfig.visibilityDowngradeDelayTicks} ticks.`;

    // Threat context
    const threatArrivedChannel = this.buildEventChannelKey(
      TENSION_EVENT_NAMES.THREAT_ARRIVED,
    );
    const threatMitigatedChannel = this.buildEventChannelKey(
      TENSION_EVENT_NAMES.THREAT_MITIGATED,
    );
    const threatExpiredChannel = this.buildEventChannelKey(
      TENSION_EVENT_NAMES.THREAT_EXPIRED,
    );

    const threatContext =
      `Queue: ${snapshot.queueLength} total (${snapshot.queuedCount} queued, ${snapshot.arrivedCount} arrived, ${snapshot.expiredCount} expired). ` +
      `Dominant type: ${dominantType ?? 'none'}, dominant severity: ${dominantSeverity ?? 'none'}. ` +
      `Severity weight total: ${snapshot.totalSeverityWeight.toFixed(3)}, entropy: ${snapshot.threatEntropy.toFixed(3)}. ` +
      `Ghost burden: ${snapshot.ghostBurden.toFixed(3)}, relief strength: ${snapshot.reliefStrength.toFixed(3)}. ` +
      `Events routed via: ${threatArrivedChannel}, ${threatMitigatedChannel}, ${threatExpiredChannel}.`;

    // Recommendation text
    const mitigationChannel = this.buildEventChannelKey(
      TENSION_EVENT_NAMES.THREAT_MITIGATED,
    );
    const dominantTypeName = dominantType ?? THREAT_TYPE.DEBT_SPIRAL;
    const defaultMits = THREAT_TYPE_DEFAULT_MITIGATIONS[dominantTypeName];
    const mitCount = this.computeDefaultMitigationCoverage(dominantTypeName);

    const recommendationText =
      urgencyTag === 'CRITICAL' || urgencyTag === 'HIGH'
        ? `Immediate action required. Use mitigation channel [${mitigationChannel}]. ` +
          `${mitCount} default mitigations available for ${dominantTypeName}: ${defaultMits.slice(0, 2).join(', ')}.`
        : urgencyTag === 'MEDIUM'
          ? `Monitor queue closely. ${mitCount} mitigation options for ${dominantTypeName}. ` +
            `Collapse risk: ${snapshot.collapseRisk.toFixed(2)}.`
          : `System stable. Maintain current posture. Backlog risk: ${snapshot.backlogRisk.toFixed(2)}.`;

    return Object.freeze({
      title,
      summary,
      threatContext,
      recommendationText,
      urgencyTag,
      tick: snapshot.tick,
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: serialize / deserialize / computeChecksum
  // --------------------------------------------------------------------------

  public serialize(): MetricsSerializedState {
    const runId = this.history[0]?.runId ?? 'unknown';
    const historyJson = JSON.stringify(this.history);
    const sessionJson = JSON.stringify(this.computeSessionSummary());
    const checksum = this.computeChecksum(historyJson + sessionJson);

    return Object.freeze({
      version: METRICS_VERSION,
      runId,
      historyJson,
      sessionJson,
      checksum,
    });
  }

  public deserialize(state: MetricsSerializedState): void {
    const expectedChecksum = this.computeChecksum(
      state.historyJson + state.sessionJson,
    );
    if (expectedChecksum !== state.checksum) {
      throw new Error(
        `TensionMetricsCollector.deserialize: checksum mismatch. Expected ${expectedChecksum}, got ${state.checksum}.`,
      );
    }

    const parsed = JSON.parse(state.historyJson) as TensionMetricsSnapshot[];
    this.history = parsed.slice(-this.historyLimit);
  }

  public computeChecksum(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
  }

  // --------------------------------------------------------------------------
  // PUBLIC: exportBundle
  // --------------------------------------------------------------------------

  public exportBundle(
    input: TensionMetricsInput,
    pressureTier: PressureTier = 'T0',
  ): MetricsExportBundle {
    const snapshot = this.collect(input);
    const mlVector = this.computeMLVector(snapshot, pressureTier);
    const dlTensor = this.extractDLTensor();
    const healthReport = this.computeHealthReport(snapshot, pressureTier);
    const trendSnapshot = this.computeTrendSnapshot();
    const anomalyReport = this.computeAnomalyReport();
    const forecast = this.computeForecast(snapshot, pressureTier);
    const recommendations = this.computeRecommendations(snapshot, pressureTier);
    const sessionSummary = this.computeSessionSummary();
    const narrative = this.generateNarrative(snapshot, pressureTier);
    const serializedState = this.serialize();

    return Object.freeze({
      snapshot,
      mlVector,
      dlTensor,
      healthReport,
      trendSnapshot,
      anomalyReport,
      forecast,
      recommendations: Object.freeze(recommendations),
      sessionSummary,
      narrative,
      serializedState,
      exportedAtMs: Date.now(),
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC: getLastSnapshot / getHistory / reset
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS — constant-backed computations
  // --------------------------------------------------------------------------

  private computePressureAmplification(tier: PressureTier): number {
    return PRESSURE_TENSION_AMPLIFIERS[tier];
  }

  private computeWeightedSeverityScore(severity: ThreatSeverity): number {
    return THREAT_SEVERITY_WEIGHTS[severity];
  }

  private computeDefaultMitigationCoverage(threatType: ThreatType): number {
    return THREAT_TYPE_DEFAULT_MITIGATIONS[threatType].length;
  }

  private computeAwarenessBonus(state: TensionVisibilityState): number {
    return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
  }

  private mapVisibilityStateToEnvelopeLevel(
    state: TensionVisibilityState,
  ): VisibilityLevel {
    return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
  }

  private computeVisibilityStateRank(state: TensionVisibilityState): number {
    return VISIBILITY_ORDER.indexOf(state);
  }

  private resolveVisibilityConfig(state: TensionVisibilityState): VisibilityConfig {
    return VISIBILITY_CONFIGS[state];
  }

  private buildEventChannelKey(eventName: string): string {
    // Maps TENSION_EVENT_NAMES values to routing channel keys
    const channelMap: Record<string, string> = {
      [TENSION_EVENT_NAMES.UPDATED_LEGACY]: 'ch:tension.legacy',
      [TENSION_EVENT_NAMES.SCORE_UPDATED]: 'ch:tension.score',
      [TENSION_EVENT_NAMES.VISIBILITY_CHANGED]: 'ch:tension.visibility',
      [TENSION_EVENT_NAMES.QUEUE_UPDATED]: 'ch:tension.queue',
      [TENSION_EVENT_NAMES.PULSE_FIRED]: 'ch:tension.pulse',
      [TENSION_EVENT_NAMES.THREAT_ARRIVED]: 'ch:threat.arrived',
      [TENSION_EVENT_NAMES.THREAT_MITIGATED]: 'ch:threat.mitigated',
      [TENSION_EVENT_NAMES.THREAT_EXPIRED]: 'ch:threat.expired',
    };
    return channelMap[eventName] ?? `ch:${eventName}`;
  }

  private computeEntryStateWeight(state: EntryState): number {
    // Uses ENTRY_STATE constants for weighted scoring of each state
    switch (state) {
      case ENTRY_STATE.QUEUED:
        return 0.3;
      case ENTRY_STATE.ARRIVED:
        return 0.9;
      case ENTRY_STATE.EXPIRED:
        return 0.6;
      case ENTRY_STATE.MITIGATED:
        return -0.4;
      case ENTRY_STATE.NULLIFIED:
        return -0.2;
      default:
        return 0;
    }
  }

  private computeThreatTypeDomainRisk(threatType: ThreatType): number {
    // Uses THREAT_TYPE constants for domain-specific risk scoring
    switch (threatType) {
      case THREAT_TYPE.DEBT_SPIRAL:
        return 0.85;
      case THREAT_TYPE.SABOTAGE:
        return 0.75;
      case THREAT_TYPE.HATER_INJECTION:
        return 0.6;
      case THREAT_TYPE.CASCADE:
        return 0.95;
      case THREAT_TYPE.SOVEREIGNTY:
        return 0.9;
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return 0.7;
      case THREAT_TYPE.REPUTATION_BURN:
        return 0.65;
      case THREAT_TYPE.SHIELD_PIERCE:
        return 0.8;
      default:
        return 0.5;
    }
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
    if (slope >= 0.15) return 'SPIKING';
    if (slope >= 0.025) return 'RISING';
    if (slope <= -0.025) return 'FALLING';
    return 'FLAT';
  }

  private computeThreatEntropy(
    distribution: Readonly<MutableTensionTypeDistribution>,
    total: number,
  ): number {
    if (total <= 0) return 0;
    const values = Object.values(distribution).filter((count) => count > 0);
    let entropy = 0;
    for (const count of values) {
      const probability = count / total;
      entropy += -(probability * Math.log2(probability));
    }
    return entropy;
  }

  private computeSeverityEntropy(
    distribution: Readonly<MutableTensionSeverityDistribution>,
    total: number,
  ): number {
    if (total <= 0) return 0;
    const values = Object.values(distribution).filter((count) => count > 0);
    let entropy = 0;
    for (const count of values) {
      const probability = count / total;
      entropy += -(probability * Math.log2(probability));
    }
    return entropy;
  }

  private computeMitigationGapScore(
    threatTypes: TensionTypeDistribution,
  ): number {
    let totalGap = 0;
    let totalThreats = 0;

    const types = Object.keys(threatTypes) as Array<keyof TensionTypeDistribution>;
    for (const typeKey of types) {
      const count = threatTypes[typeKey];
      if (count === 0) continue;
      const threatType = typeKey as ThreatType;
      const coverage = this.computeDefaultMitigationCoverage(threatType);
      const domainRisk = this.computeThreatTypeDomainRisk(threatType);
      // Gap = how much risk is uncovered per threat, normalized by coverage
      const gapPerThreat = domainRisk / Math.max(1, coverage);
      totalGap += gapPerThreat * count;
      totalThreats += count;
    }

    return totalThreats === 0 ? 0 : this.clamp01(totalGap / totalThreats);
  }

  private estimatePulseProbability(
    recentHistory: TensionMetricsSnapshot[],
    current: TensionMetricsSnapshot,
  ): number {
    if (recentHistory.length === 0) {
      return current.score >= TENSION_CONSTANTS.PULSE_THRESHOLD ? 1 : 0;
    }
    const pulseCount = recentHistory.filter((s) => s.isPulseActive).length;
    const baseProbability = pulseCount / recentHistory.length;
    const scoreContrib = this.clamp01(
      current.score / TENSION_CONSTANTS.PULSE_THRESHOLD,
    );
    return this.clamp01(baseProbability * 0.6 + scoreContrib * 0.4);
  }

  private resolveVisibilityStateFromScore(
    score: number,
  ): TensionVisibilityState {
    if (score >= 0.75) return TENSION_VISIBILITY_STATE.EXPOSED;
    if (score >= 0.5) return TENSION_VISIBILITY_STATE.TELEGRAPHED;
    if (score >= 0.25) return TENSION_VISIBILITY_STATE.SIGNALED;
    return TENSION_VISIBILITY_STATE.SHADOWED;
  }

  private resolveDominantThreatType(
    distribution: TensionTypeDistribution | MutableTensionTypeDistribution,
  ): ThreatType | null {
    let maxCount = 0;
    let dominant: ThreatType | null = null;
    for (const key of Object.keys(distribution) as Array<
      keyof TensionTypeDistribution
    >) {
      if (distribution[key] > maxCount) {
        maxCount = distribution[key];
        dominant = key as ThreatType;
      }
    }
    return dominant;
  }

  private resolveDominantSeverity(
    distribution:
      | TensionSeverityDistribution
      | MutableTensionSeverityDistribution,
  ): ThreatSeverity | null {
    let maxCount = 0;
    let dominant: ThreatSeverity | null = null;
    for (const key of Object.keys(distribution) as Array<
      keyof TensionSeverityDistribution
    >) {
      if (distribution[key] > maxCount) {
        maxCount = distribution[key];
        dominant = key as ThreatSeverity;
      }
    }
    return dominant;
  }

  private computeRunningMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private computeRunningStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  private clamp01(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  private safeNumber(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
    if (Math.abs(value) < EPSILON) return 0;
    return value;
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
}

// ============================================================================
// SECTION 7 — STANDALONE EXPORTED FUNCTIONS
// ============================================================================

export function createMetricsCollector(
  historyLimit?: number,
): TensionMetricsCollector {
  return new TensionMetricsCollector(historyLimit ?? METRICS_HISTORY_CAPACITY);
}

export function extractMetricsMLFeatures(
  snapshot: TensionMetricsSnapshot,
  pressureTier: PressureTier = 'T0',
): number[] {
  const collector = new TensionMetricsCollector();
  const vector = collector.computeMLVector(snapshot, pressureTier);
  return [...vector.features];
}

export function computeMetricsFeatureLabels(): readonly string[] {
  return ML_FEATURE_LABELS;
}

export function computeMetricsDLColumnLabels(): readonly string[] {
  return DL_COLUMN_LABELS;
}

export function computeSessionHealthScore(
  session: MetricsSessionSummary,
): number {
  if (session.totalTicks === 0) return 1;

  // Invert max score contribution, penalise pulse frequency
  const pulseRate = session.pulseCount / Math.max(1, session.totalTicks);
  const sustainedRate =
    session.sustainedPulseCount / Math.max(1, session.totalTicks);
  const scoreLoad = session.avgScore;

  const health = Math.max(
    0,
    1 - scoreLoad * 0.4 - pulseRate * 0.35 - sustainedRate * 0.25,
  );
  return Math.min(1, health);
}

export function computeAnomalyRiskFromReport(
  report: MetricsAnomalyReport,
): number {
  if (report.anomalies.length === 0) return 0;
  const maxZ = Math.max(
    ...report.anomalies.map((a) => Math.abs(a.zScore)),
  );
  // Normalize: z=2.5 → 0.5, z=5 → 1.0
  return Math.min(1, maxZ / 5);
}

export function buildMetricsNarrativeText(
  snapshot: TensionMetricsSnapshot,
  pressureTier: PressureTier = 'T0',
): string {
  const collector = new TensionMetricsCollector();
  const narrative = collector.generateNarrative(snapshot, pressureTier);
  return `[${narrative.urgencyTag}] ${narrative.title}\n${narrative.summary}\n${narrative.threatContext}\n${narrative.recommendationText}`;
}

// ============================================================================
// SECTION 8 — SELF-TEST
// ============================================================================

export function runMetricsSelfTest(): MetricsSelfTestResult {
  const startMs = Date.now();
  const failures: string[] = [];
  const checks: string[] = [];

  function assert(condition: boolean, label: string): void {
    checks.push(label);
    if (!condition) {
      failures.push(`FAIL: ${label}`);
    }
  }

  // ---- Build mock objects ---------------------------------------------------

  // Minimal mock DecayContributionBreakdown
  const mockBreakdown: DecayContributionBreakdown = {
    queuedThreats: 0.12,
    arrivedThreats: 0.2,
    expiredGhosts: 0.04,
    mitigationDecay: -0.08,
    nullifyDecay: -0.04,
    emptyQueueBonus: 0,
    visibilityBonus: 0.05,
    sovereigntyBonus: 0,
  };

  // Minimal mock ThreatEnvelope
  const mockThreatEnvelope: ThreatEnvelope = {
    threatId: 'threat-001',
    visibleAs: 'PARTIAL',
    source: 'ECONOMY',
    etaTicks: 2,
    severity: 0.4,
    summary: 'Debt spiral incoming',
  };

  // Minimal mock TensionRuntimeSnapshot
  const mockRuntime: TensionRuntimeSnapshot = {
    score: 0.65,
    previousScore: 0.55,
    rawDelta: 0.1,
    amplifiedDelta: 0.12,
    visibilityState: TENSION_VISIBILITY_STATE.TELEGRAPHED,
    queueLength: 4,
    arrivedCount: 2,
    queuedCount: 2,
    expiredCount: 1,
    relievedCount: 1,
    visibleThreats: [mockThreatEnvelope],
    isPulseActive: false,
    pulseTicksActive: 0,
    isEscalating: true,
    dominantEntryId: 'entry-001',
    lastSpikeTick: null,
    tickNumber: 10,
    timestamp: Date.now(),
    contributionBreakdown: mockBreakdown,
  };

  // Minimal mock AnticipationEntry
  const mockEntry: AnticipationEntry = {
    entryId: 'entry-001',
    runId: 'run-test-001',
    sourceKey: 'debt-spiral-1',
    threatId: 'threat-001',
    source: 'ECONOMY',
    threatType: THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity: THREAT_SEVERITY.MODERATE,
    enqueuedAtTick: 5,
    arrivalTick: 12,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'FINANCIAL_COLLAPSE',
    mitigationCardTypes: ['REFINANCE'],
    baseTensionPerTick: 0.12,
    severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE],
    summary: 'Debt spiral approaching',
    state: ENTRY_STATE.QUEUED,
    isArrived: false,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    mitigatedAtTick: null,
    expiredAtTick: null,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
  };

  const mockArrivedEntry: AnticipationEntry = {
    entryId: 'entry-002',
    runId: 'run-test-001',
    sourceKey: 'cascade-1',
    threatId: 'threat-002',
    source: 'CASCADE',
    threatType: THREAT_TYPE.CASCADE,
    threatSeverity: THREAT_SEVERITY.SEVERE,
    enqueuedAtTick: 3,
    arrivalTick: 8,
    isCascadeTriggered: true,
    cascadeTriggerEventId: 'cascade-ev-1',
    worstCaseOutcome: 'CASCADE_MELTDOWN',
    mitigationCardTypes: ['STABILIZE', 'PATCH'],
    baseTensionPerTick: 0.2,
    severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE],
    summary: 'Cascade chain active',
    state: ENTRY_STATE.ARRIVED,
    isArrived: true,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    mitigatedAtTick: null,
    expiredAtTick: null,
    ticksOverdue: 2,
    decayTicksRemaining: 0,
  };

  // Minimal mock RunStateSnapshot (structurally typed)
  const mockRunState: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-test-001',
    userId: 'user-test-001',
    seed: 'seed-abc',
    mode: 'solo',
    tick: 10,
    phase: 'ESCALATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 5000,
      debt: 1000,
      incomePerTick: 100,
      expensesPerTick: 80,
      netWorth: 4000,
      freedomTarget: 10000,
      haterHeat: 0.3,
      opportunitiesPurchased: 2,
      privilegePlays: 1,
    },
    pressure: {
      score: 0.45,
      tier: 'T2',
      band: 'ELEVATED',
      previousTier: 'T1',
      previousBand: 'BUILDING',
      upwardCrossings: 2,
      survivedHighPressureTicks: 5,
      lastEscalationTick: 7,
      maxScoreSeen: 0.5,
    },
    tension: {
      score: 0.65,
      anticipation: 0.4,
      visibleThreats: [mockThreatEnvelope],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers: [],
      weakestLayerId: 'L1',
      weakestLayerRatio: 0.8,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: [],
      battleBudget: 100,
      battleBudgetCap: 500,
      extractionCooldownTicks: 0,
      firstBloodClaimed: false,
      pendingAttacks: [],
      sharedOpportunityDeckCursor: 0,
      rivalryHeatCarry: 0,
      neutralizedBotIds: [],
    },
    cascade: {
      activeChains: [],
      positiveTrackers: [],
      brokenChains: 0,
      completedChains: 0,
      repeatedTriggerCounts: {},
      lastResolvedTick: null,
    },
    sovereignty: {
      integrityStatus: 'VERIFIED',
      tickChecksums: [],
      proofHash: null,
      sovereigntyScore: 0.9,
      verifiedGrade: null,
      proofBadges: [],
      gapVsLegend: 0.1,
      gapClosingRate: 0,
      cordScore: 0.8,
      auditFlags: [],
      lastVerifiedTick: null,
    },
    cards: {
      hand: [],
      discard: [],
      exhaust: [],
      drawHistory: [],
      lastPlayed: [],
      ghostMarkers: [],
      drawPileSize: 20,
      deckEntropy: 0.5,
    },
    modeState: {
      holdEnabled: false,
      loadoutEnabled: true,
      sharedTreasury: false,
      sharedTreasuryBalance: 0,
      trustScores: {},
      roleAssignments: {},
      defectionStepByPlayer: {},
      legendMarkersEnabled: true,
      communityHeatModifier: 0,
      sharedOpportunityDeck: false,
      counterIntelTier: 0,
      spectatorLimit: 0,
      phaseBoundaryWindowsRemaining: 2,
      bleedMode: false,
      handicapIds: [],
      advantageId: null,
      disabledBots: [],
      modePresentation: 'empire',
      roleLockEnabled: false,
      extractionActionsRemaining: 3,
      ghostBaselineRunId: null,
      legendOwnerUserId: null,
    },
    timers: {
      seasonBudgetMs: 600000,
      extensionBudgetMs: 0,
      elapsedMs: 10000,
      currentTickDurationMs: 1000,
      nextTickAtMs: null,
      holdCharges: 0,
      activeDecisionWindows: {},
      frozenWindowIds: [],
    },
    telemetry: {
      decisions: [],
      outcomeReason: null,
      outcomeReasonCode: null,
      lastTickChecksum: null,
      forkHints: [],
      emittedEventCount: 0,
      warnings: [],
    },
  };

  const mockInput: TensionMetricsInput = {
    runState: mockRunState,
    runtimeSnapshot: mockRuntime,
    queueEntries: [mockEntry, mockArrivedEntry],
  };

  // ---- Run tests -----------------------------------------------------------

  const collector = new TensionMetricsCollector();

  // Test 1: collect
  const snapshot = collector.collect(mockInput);
  assert(snapshot.runId === 'run-test-001', 'collect: runId matches');
  assert(snapshot.tick === 10, 'collect: tick matches');
  assert(snapshot.score >= 0 && snapshot.score <= 1, 'collect: score in [0,1]');
  assert(snapshot.queueLength === 4, 'collect: queueLength matches');
  assert(snapshot.queuedCount === 2, 'collect: queuedCount matches');
  assert(snapshot.arrivedCount === 2, 'collect: arrivedCount matches');
  assert(snapshot.expiredCount === 1, 'collect: expiredCount matches');
  assert(snapshot.overdueCount === 1, 'collect: overdueCount from arrived entries');
  assert(
    snapshot.totalSeverityWeight > 0,
    'collect: totalSeverityWeight > 0',
  );
  assert(
    snapshot.mitigationCoverageRatio >= 0 &&
      snapshot.mitigationCoverageRatio <= 1,
    'collect: mitigationCoverageRatio in [0,1]',
  );
  assert(
    snapshot.ghostBurden >= 0,
    'collect: ghostBurden >= 0',
  );
  assert(
    typeof snapshot.escalationMomentum === 'string',
    'collect: escalationMomentum is string',
  );
  assert(
    snapshot.threatTypes.DEBT_SPIRAL === 1,
    'collect: DEBT_SPIRAL count = 1',
  );
  assert(
    snapshot.threatTypes.CASCADE === 1,
    'collect: CASCADE count = 1',
  );
  assert(
    snapshot.severities.MODERATE === 1,
    'collect: MODERATE severity = 1',
  );
  assert(
    snapshot.severities.SEVERE === 1,
    'collect: SEVERE severity = 1',
  );
  assert(
    snapshot.collapseRisk >= 0 && snapshot.collapseRisk <= 1,
    'collect: collapseRisk in [0,1]',
  );
  assert(
    snapshot.backlogRisk >= 0 && snapshot.backlogRisk <= 1,
    'collect: backlogRisk in [0,1]',
  );

  // Test 2: computeMLVector
  const mlVector = collector.computeMLVector(snapshot, 'T2');
  assert(
    mlVector.features.length === METRICS_ML_FEATURE_COUNT,
    `computeMLVector: features length = ${METRICS_ML_FEATURE_COUNT}`,
  );
  assert(
    mlVector.labels.length === METRICS_ML_FEATURE_COUNT,
    `computeMLVector: labels length = ${METRICS_ML_FEATURE_COUNT}`,
  );
  assert(mlVector.tick === 10, 'computeMLVector: tick matches');
  assert(mlVector.runId === 'run-test-001', 'computeMLVector: runId matches');
  assert(
    mlVector.features.every((f) => Number.isFinite(f)),
    'computeMLVector: all features finite',
  );
  assert(
    mlVector.labels[26] === 'pressureAmplifier',
    'computeMLVector: label[26] = pressureAmplifier',
  );
  assert(
    (mlVector.features[26] ?? 0) ===
      PRESSURE_TENSION_AMPLIFIERS['T2'],
    'computeMLVector: pressureAmplifier value matches T2',
  );

  // Test 3: extractDLTensor
  const dlTensor = collector.extractDLTensor();
  assert(
    dlTensor.rows === METRICS_DL_SEQUENCE_LENGTH,
    `extractDLTensor: rows = ${METRICS_DL_SEQUENCE_LENGTH}`,
  );
  assert(
    dlTensor.cols === METRICS_DL_FEATURE_WIDTH,
    `extractDLTensor: cols = ${METRICS_DL_FEATURE_WIDTH}`,
  );
  assert(
    dlTensor.data.length === METRICS_DL_SEQUENCE_LENGTH,
    'extractDLTensor: data rows count correct',
  );
  assert(
    dlTensor.columnLabels.length === METRICS_DL_FEATURE_WIDTH,
    'extractDLTensor: columnLabels length correct',
  );
  assert(
    dlTensor.columnLabels[0] === 'score',
    'extractDLTensor: first column label = score',
  );
  assert(
    dlTensor.columnLabels[4] === 'pulse',
    'extractDLTensor: column label[4] = pulse',
  );
  assert(
    dlTensor.data.every((row) => row.length === METRICS_DL_FEATURE_WIDTH),
    'extractDLTensor: all rows have correct width',
  );

  // Test 4: computeHealthReport
  const health = collector.computeHealthReport(snapshot, 'T2');
  assert(
    health.score >= 0 && health.score <= 1,
    'computeHealthReport: score in [0,1]',
  );
  assert(
    ['HEALTHY', 'WATCH', 'WARNING', 'CRITICAL', 'COLLAPSE'].includes(
      health.tier,
    ),
    'computeHealthReport: tier is valid',
  );
  assert(
    health.pressureTier === 'T2',
    'computeHealthReport: pressureTier matches',
  );
  assert(
    health.amplifiedScoreEstimate >= 0 &&
      health.amplifiedScoreEstimate <= 1,
    'computeHealthReport: amplifiedScoreEstimate in [0,1]',
  );
  assert(
    Array.isArray(health.flags),
    'computeHealthReport: flags is array',
  );
  assert(
    Array.isArray(health.recommendations),
    'computeHealthReport: recommendations is array',
  );

  // Test 5: computeTrendSnapshot (with 1 tick of history)
  const trend = collector.computeTrendSnapshot();
  assert(
    typeof trend.scoreVelocity === 'number',
    'computeTrendSnapshot: scoreVelocity is number',
  );
  assert(
    typeof trend.pulseProbability === 'number',
    'computeTrendSnapshot: pulseProbability is number',
  );
  assert(
    trend.pulseProbability >= 0 && trend.pulseProbability <= 1,
    'computeTrendSnapshot: pulseProbability in [0,1]',
  );

  // Add more history for richer trend tests
  const runtime2: TensionRuntimeSnapshot = {
    ...mockRuntime,
    score: 0.72,
    previousScore: 0.65,
    rawDelta: 0.07,
    amplifiedDelta: 0.084,
    tickNumber: 11,
    isPulseActive: true,
    pulseTicksActive: 1,
  };
  const mockInput2: TensionMetricsInput = {
    runState: { ...mockRunState, tick: 11 },
    runtimeSnapshot: runtime2,
    queueEntries: [mockEntry, mockArrivedEntry],
  };
  const snapshot2 = collector.collect(mockInput2);
  assert(snapshot2.score > 0, 'collect2: score > 0');

  const trend2 = collector.computeTrendSnapshot();
  assert(
    Number.isFinite(trend2.scoreVelocity),
    'computeTrendSnapshot (2 ticks): scoreVelocity finite',
  );
  assert(
    Number.isFinite(trend2.queueGrowthRate),
    'computeTrendSnapshot (2 ticks): queueGrowthRate finite',
  );

  // Test 6: computeAnomalyReport
  const anomalyReport = collector.computeAnomalyReport();
  assert(
    Array.isArray(anomalyReport.anomalies),
    'computeAnomalyReport: anomalies is array',
  );
  assert(
    anomalyReport.overallAnomalyScore >= 0 &&
      anomalyReport.overallAnomalyScore <= 1,
    'computeAnomalyReport: overallAnomalyScore in [0,1]',
  );
  assert(
    typeof anomalyReport.timestamp === 'number',
    'computeAnomalyReport: timestamp is number',
  );

  // Test 7: computeForecast
  const forecast = collector.computeForecast(snapshot, 'T2');
  assert(
    typeof forecast.recovery.confidence === 'number',
    'computeForecast: recovery.confidence is number',
  );
  assert(
    forecast.recovery.confidence >= 0 && forecast.recovery.confidence <= 1,
    'computeForecast: recovery.confidence in [0,1]',
  );
  assert(
    typeof forecast.escalation.willPulse === 'boolean',
    'computeForecast: willPulse is boolean',
  );
  assert(
    typeof forecast.escalation.confidence === 'number',
    'computeForecast: escalation.confidence is number',
  );

  // Test 8: computeRecommendations
  const recs = collector.computeRecommendations(snapshot, 'T2');
  assert(Array.isArray(recs), 'computeRecommendations: returns array');
  assert(recs.length <= 5, 'computeRecommendations: at most 5 recommendations');
  for (const rec of recs) {
    assert(
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rec.priority),
      `computeRecommendations: priority valid for "${rec.action}"`,
    );
    assert(
      rec.estimatedImpact >= 0,
      'computeRecommendations: estimatedImpact >= 0',
    );
  }

  // Test 9: computeSessionSummary
  const session = collector.computeSessionSummary();
  assert(session.totalTicks === 2, 'computeSessionSummary: totalTicks = 2');
  assert(
    session.maxScore >= session.minScore,
    'computeSessionSummary: maxScore >= minScore',
  );
  assert(
    session.avgScore >= 0 && session.avgScore <= 1,
    'computeSessionSummary: avgScore in [0,1]',
  );
  assert(
    session.pulseCount >= 0,
    'computeSessionSummary: pulseCount >= 0',
  );
  assert(
    session.sessionDurationTicks >= 0,
    'computeSessionSummary: sessionDurationTicks >= 0',
  );

  // Test 10: generateNarrative
  const narrative = collector.generateNarrative(snapshot, 'T2');
  assert(typeof narrative.title === 'string', 'generateNarrative: title is string');
  assert(narrative.title.length > 0, 'generateNarrative: title non-empty');
  assert(
    typeof narrative.summary === 'string',
    'generateNarrative: summary is string',
  );
  assert(
    typeof narrative.threatContext === 'string',
    'generateNarrative: threatContext is string',
  );
  assert(
    typeof narrative.recommendationText === 'string',
    'generateNarrative: recommendationText is string',
  );
  assert(
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CALM'].includes(
      narrative.urgencyTag,
    ),
    'generateNarrative: urgencyTag valid',
  );
  assert(narrative.tick === 10, 'generateNarrative: tick matches');
  assert(
    narrative.summary.includes('ch:tension.score'),
    'generateNarrative: summary references score channel',
  );

  // Test 11: serialize / deserialize
  const serialized = collector.serialize();
  assert(
    serialized.version === METRICS_VERSION,
    'serialize: version matches',
  );
  assert(
    typeof serialized.checksum === 'string',
    'serialize: checksum is string',
  );
  assert(
    serialized.checksum.length === 64,
    'serialize: checksum is 64-char SHA-256 hex',
  );
  assert(
    typeof serialized.historyJson === 'string',
    'serialize: historyJson is string',
  );

  const collector2 = new TensionMetricsCollector();
  collector2.deserialize(serialized);
  const restoredHistory = collector2.getHistory();
  assert(
    restoredHistory.length === 2,
    'deserialize: restored history length = 2',
  );
  assert(
    restoredHistory[0]?.runId === 'run-test-001',
    'deserialize: restored runId matches',
  );

  // Test 12: exportBundle
  const bundle = collector.exportBundle(mockInput, 'T1');
  assert(
    typeof bundle.exportedAtMs === 'number',
    'exportBundle: exportedAtMs is number',
  );
  assert(
    bundle.mlVector.features.length === METRICS_ML_FEATURE_COUNT,
    'exportBundle: mlVector feature count correct',
  );
  assert(
    bundle.dlTensor.rows === METRICS_DL_SEQUENCE_LENGTH,
    'exportBundle: dlTensor rows correct',
  );
  assert(
    typeof bundle.healthReport.tier === 'string',
    'exportBundle: healthReport.tier is string',
  );
  assert(
    typeof bundle.narrative.title === 'string',
    'exportBundle: narrative.title is string',
  );
  assert(
    bundle.serializedState.checksum.length === 64,
    'exportBundle: serialized checksum is 64 chars',
  );

  // Test 13: standalone functions
  const featureLabels = computeMetricsFeatureLabels();
  assert(
    featureLabels.length === METRICS_ML_FEATURE_COUNT,
    'computeMetricsFeatureLabels: length correct',
  );
  assert(
    featureLabels[0] === 'score',
    'computeMetricsFeatureLabels: first label = score',
  );

  const dlLabels = computeMetricsDLColumnLabels();
  assert(
    dlLabels.length === METRICS_DL_FEATURE_WIDTH,
    'computeMetricsDLColumnLabels: length correct',
  );

  const mlFeatures = extractMetricsMLFeatures(snapshot, 'T3');
  assert(
    mlFeatures.length === METRICS_ML_FEATURE_COUNT,
    'extractMetricsMLFeatures: length correct',
  );
  assert(
    mlFeatures.every((f) => Number.isFinite(f)),
    'extractMetricsMLFeatures: all finite',
  );

  const sessionHealth = computeSessionHealthScore(session);
  assert(
    sessionHealth >= 0 && sessionHealth <= 1,
    'computeSessionHealthScore: result in [0,1]',
  );

  const anomalyRisk = computeAnomalyRiskFromReport(anomalyReport);
  assert(
    anomalyRisk >= 0 && anomalyRisk <= 1,
    'computeAnomalyRiskFromReport: result in [0,1]',
  );

  const narrativeText = buildMetricsNarrativeText(snapshot, 'T1');
  assert(
    typeof narrativeText === 'string',
    'buildMetricsNarrativeText: returns string',
  );
  assert(
    narrativeText.length > 10,
    'buildMetricsNarrativeText: text non-trivial',
  );

  // Test 14: constants used correctly
  assert(
    PRESSURE_TENSION_AMPLIFIERS['T0'] === 1.0,
    'PRESSURE_TENSION_AMPLIFIERS: T0 = 1.0',
  );
  assert(
    PRESSURE_TENSION_AMPLIFIERS['T4'] === 1.5,
    'PRESSURE_TENSION_AMPLIFIERS: T4 = 1.5',
  );
  assert(
    TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9,
    'TENSION_CONSTANTS: PULSE_THRESHOLD = 0.9',
  );
  assert(
    TENSION_CONSTANTS.MIN_SCORE === 0,
    'TENSION_CONSTANTS: MIN_SCORE = 0',
  );
  assert(
    TENSION_CONSTANTS.MAX_SCORE === 1,
    'TENSION_CONSTANTS: MAX_SCORE = 1',
  );
  assert(
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] === 1.0,
    'THREAT_SEVERITY_WEIGHTS: EXISTENTIAL = 1.0',
  );
  assert(
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] === 0.2,
    'THREAT_SEVERITY_WEIGHTS: MINOR = 0.2',
  );
  assert(
    VISIBILITY_ORDER.length === 4,
    'VISIBILITY_ORDER: length = 4',
  );
  assert(
    VISIBILITY_ORDER[0] === TENSION_VISIBILITY_STATE.SHADOWED,
    'VISIBILITY_ORDER: first = SHADOWED',
  );
  assert(
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.EXPOSED] === 'EXPOSED',
    'INTERNAL_VISIBILITY_TO_ENVELOPE: EXPOSED → EXPOSED',
  );
  assert(
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED] === 'HIDDEN',
    'INTERNAL_VISIBILITY_TO_ENVELOPE: SHADOWED → HIDDEN',
  );
  assert(
    THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE].length === 3,
    'THREAT_TYPE_DEFAULT_MITIGATIONS: CASCADE has 3 mitigations',
  );

  // Test 15: entry state weights (verifies computeEntryStateWeight)
  const helperCollector = new TensionMetricsCollector();
  // Access via type assertion for internal test coverage
  const entryWeightHelper = (
    helperCollector as unknown as {
      computeEntryStateWeight: (s: EntryState) => number;
    }
  ).computeEntryStateWeight;
  if (typeof entryWeightHelper === 'function') {
    const arrivedWeight = entryWeightHelper.call(
      helperCollector,
      ENTRY_STATE.ARRIVED,
    );
    assert(arrivedWeight === 0.9, 'computeEntryStateWeight: ARRIVED = 0.9');
    const mitigatedWeight = entryWeightHelper.call(
      helperCollector,
      ENTRY_STATE.MITIGATED,
    );
    assert(mitigatedWeight < 0, 'computeEntryStateWeight: MITIGATED < 0');
  }

  // Test 16: threat type domain risk (verifies computeThreatTypeDomainRisk)
  const domainRiskHelper = (
    helperCollector as unknown as {
      computeThreatTypeDomainRisk: (t: ThreatType) => number;
    }
  ).computeThreatTypeDomainRisk;
  if (typeof domainRiskHelper === 'function') {
    const cascadeRisk = domainRiskHelper.call(
      helperCollector,
      THREAT_TYPE.CASCADE,
    );
    assert(cascadeRisk === 0.95, 'computeThreatTypeDomainRisk: CASCADE = 0.95');
    const sovereigntyRisk = domainRiskHelper.call(
      helperCollector,
      THREAT_TYPE.SOVEREIGNTY,
    );
    assert(
      sovereigntyRisk === 0.9,
      'computeThreatTypeDomainRisk: SOVEREIGNTY = 0.9',
    );
  }

  // Test 17: createMetricsCollector factory
  const factoryCollector = createMetricsCollector(32);
  assert(
    factoryCollector instanceof TensionMetricsCollector,
    'createMetricsCollector: returns TensionMetricsCollector instance',
  );

  // Test 18: getLastSnapshot / reset
  const lastSnap = collector.getLastSnapshot();
  assert(lastSnap !== null, 'getLastSnapshot: returns non-null after collects');
  assert(
    typeof lastSnap?.runId === 'string',
    'getLastSnapshot: runId is string',
  );

  const historyBefore = collector.getHistory().length;
  assert(historyBefore > 0, 'getHistory: returns non-empty array');
  collector.reset();
  assert(
    collector.getHistory().length === 0,
    'reset: history cleared',
  );
  assert(
    collector.getLastSnapshot() === null,
    'getLastSnapshot: null after reset',
  );

  // Test 19: checksum determinism
  const hashCollector = new TensionMetricsCollector();
  const c1 = hashCollector.computeChecksum('test-data-12345');
  const c2 = hashCollector.computeChecksum('test-data-12345');
  assert(c1 === c2, 'computeChecksum: deterministic for same input');
  assert(c1.length === 64, 'computeChecksum: 64-char hex');
  const c3 = hashCollector.computeChecksum('test-data-different');
  assert(c1 !== c3, 'computeChecksum: different input → different hash');

  // Test 20: TENSION_EVENT_NAMES channel routing
  const channelHelper = (
    helperCollector as unknown as {
      buildEventChannelKey: (s: string) => string;
    }
  ).buildEventChannelKey;
  if (typeof channelHelper === 'function') {
    const pulseKey = channelHelper.call(
      helperCollector,
      TENSION_EVENT_NAMES.PULSE_FIRED,
    );
    assert(
      pulseKey === 'ch:tension.pulse',
      'buildEventChannelKey: PULSE_FIRED → ch:tension.pulse',
    );
    const scoreKey = channelHelper.call(
      helperCollector,
      TENSION_EVENT_NAMES.SCORE_UPDATED,
    );
    assert(
      scoreKey === 'ch:tension.score',
      'buildEventChannelKey: SCORE_UPDATED → ch:tension.score',
    );
    const mitigatedKey = channelHelper.call(
      helperCollector,
      TENSION_EVENT_NAMES.THREAT_MITIGATED,
    );
    assert(
      mitigatedKey === 'ch:threat.mitigated',
      'buildEventChannelKey: THREAT_MITIGATED → ch:threat.mitigated',
    );
  }

  const durationMs = Date.now() - startMs;

  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    checks: Object.freeze(checks),
    durationMs,
  });
}
