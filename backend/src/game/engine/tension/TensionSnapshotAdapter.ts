/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND TENSION SNAPSHOT ADAPTER
 * /backend/src/game/engine/tension/TensionSnapshotAdapter.ts
 * ============================================================================
 *
 * Purpose:
 * - bridge rich Engine 3 runtime output into the compact backend RunStateSnapshot
 * - convert anticipation queue entries into visibility-safe ThreatEnvelope objects
 * - preserve immutable snapshot semantics required by the backend runtime
 * - expose ML/DL feature extraction surfaces for analytical consumers
 * - provide health reporting, narrative generation, and self-test coverage
 *
 * Design:
 * - adapter only; no queue mutation, no score mutation, no event emission
 * - converts internal tension visibility state to backend envelope visibility
 * - can merge a fresh TensionRuntimeSnapshot into a RunStateSnapshot safely
 * - all public methods are pure or operate on immutable local state
 * - history ring buffer enables DL tensor extraction without external deps
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import type { ThreatEnvelope } from '../core/GamePrimitives';
import type { RunStateSnapshot, TensionState } from '../core/RunStateSnapshot';
import {
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  VISIBILITY_ORDER,
  PRESSURE_TENSION_AMPLIFIERS,
  TENSION_CONSTANTS,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  TENSION_EVENT_NAMES,
  ENTRY_STATE,
  type AnticipationEntry,
  type TensionRuntimeSnapshot,
  type TensionVisibilityState,
  type PressureTier,
  type ThreatSeverity,
  type ThreatType,
  type VisibilityConfig,
  type VisibilityLevel,
  type EntryState,
  type QueueProcessResult,
  type DecayComputeResult,
} from './types';

// ============================================================================
// MARK: Module-level constants
// ============================================================================

export const ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const ADAPTER_DL_SEQUENCE_LENGTH = 16 as const;
export const ADAPTER_DL_FEATURE_WIDTH = 8 as const;
export const ADAPTER_HISTORY_CAPACITY = 64 as const;

export const ADAPTER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'normalized_score',        // 0
  'queue_length',            // 1
  'arrived_count',           // 2
  'visibility_ordinal',      // 3
  'pressure_amplifier',      // 4
  'total_weight',            // 5
  'avg_weight',              // 6
  'dominant_type_priority',  // 7
  'pulse_active',            // 8
  'pulse_ticks_active',      // 9
  'raw_delta',               // 10
  'amplified_delta',         // 11
  'severity_minor',          // 12
  'severity_moderate',       // 13
  'severity_severe',         // 14
  'severity_critical',       // 15
  'severity_existential',    // 16
  'type_debt_spiral',        // 17
  'type_sabotage',           // 18
  'type_hater_injection',    // 19
  'type_cascade',            // 20
  'type_sovereignty',        // 21
  'type_opportunity_kill',   // 22
  'type_reputation_burn',    // 23
  'type_shield_pierce',      // 24
  'mitigation_coverage',     // 25
  'score_vs_max',            // 26
  'escalating_flag',         // 27
  'expired_count',           // 28
  'relieved_count',          // 29
  'tick_normalized',         // 30
  'checksum_byte',           // 31
]);

export const ADAPTER_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  'score',
  'queue_length',
  'arrived_count',
  'visibility_ordinal',
  'total_weight',
  'pulse_active',
  'raw_delta',
  'amplified_delta',
]);

export const ADAPTER_RISK_THRESHOLDS = {
  CLEAR: 0.15,
  LOW: 0.35,
  MEDIUM: 0.55,
  HIGH: 0.75,
  CRITICAL: 0.9,
} as const;

// ============================================================================
// MARK: Exported interfaces
// ============================================================================

export interface TensionSnapshotAdapterInput {
  readonly runState: RunStateSnapshot;
  readonly runtimeSnapshot: TensionRuntimeSnapshot;
  readonly queueEntries?: readonly AnticipationEntry[];
}

export interface AdapterMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
}

export interface AdapterDLTensorRow {
  readonly features: readonly number[];
}

export interface AdapterDLTensor {
  readonly rows: readonly AdapterDLTensorRow[];
  readonly labels: readonly string[];
}

export interface TensionStateAnnotation {
  readonly score: number;
  readonly previousScore: number;
  readonly delta: number;
  readonly normalizedScore: number;
  readonly riskTier: string;
  readonly queuePressure: number;
  readonly dominantThreatType: ThreatType | null;
  readonly mitigationCoverage: number;
  readonly severityDistribution: Readonly<Record<ThreatSeverity, number>>;
  readonly typeDistribution: Readonly<Record<ThreatType, number>>;
}

export interface AdapterHealthReport {
  readonly riskTier: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly adaptedCount: number;
  readonly activeCount: number;
  readonly arrivedCount: number;
  readonly totalWeight: number;
  readonly alerts: readonly string[];
}

export interface AdapterNarrative {
  readonly headline: string;
  readonly body: string;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly mitigationSummary: string;
}

export interface AdapterTickSample {
  readonly tick: number;
  readonly score: number;
  readonly queueLength: number;
  readonly arrivedCount: number;
  readonly visibilityOrdinal: number;
}

export interface AdapterSessionSummary {
  readonly totalAdaptations: number;
  readonly peakScore: number;
  readonly peakQueueLength: number;
  readonly averageScore: number;
  readonly volatility: number;
}

export interface AdapterSerializedState {
  readonly totalAdaptations: number;
  readonly lastAdaptedTick: number;
  readonly checksum: string;
}

export interface AdapterExportBundle {
  readonly mlVector: AdapterMLVector;
  readonly dlTensor: AdapterDLTensor;
  readonly healthReport: AdapterHealthReport;
  readonly narrative: AdapterNarrative;
  readonly sessionSummary: AdapterSessionSummary;
  readonly serialized: AdapterSerializedState;
}

export interface AdapterSelfTestResult {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly failures: readonly string[];
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function buildZeroSeverityDistribution(): Record<ThreatSeverity, number> {
  return {
    [THREAT_SEVERITY.MINOR]: 0,
    [THREAT_SEVERITY.MODERATE]: 0,
    [THREAT_SEVERITY.SEVERE]: 0,
    [THREAT_SEVERITY.CRITICAL]: 0,
    [THREAT_SEVERITY.EXISTENTIAL]: 0,
  };
}

function buildZeroTypeDistribution(): Record<ThreatType, number> {
  return {
    [THREAT_TYPE.DEBT_SPIRAL]: 0,
    [THREAT_TYPE.SABOTAGE]: 0,
    [THREAT_TYPE.HATER_INJECTION]: 0,
    [THREAT_TYPE.CASCADE]: 0,
    [THREAT_TYPE.SOVEREIGNTY]: 0,
    [THREAT_TYPE.OPPORTUNITY_KILL]: 0,
    [THREAT_TYPE.REPUTATION_BURN]: 0,
    [THREAT_TYPE.SHIELD_PIERCE]: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveRiskTierFromScore(
  score: number,
): 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= ADAPTER_RISK_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= ADAPTER_RISK_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= ADAPTER_RISK_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (score >= ADAPTER_RISK_THRESHOLDS.LOW) return 'LOW';
  return 'CLEAR';
}

function urgencyFromRiskTier(
  tier: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (tier === 'CLEAR') return 'LOW';
  return tier;
}

// ============================================================================
// MARK: TensionSnapshotAdapter class
// ============================================================================

export class TensionSnapshotAdapter {
  // ---- ring-buffer history --------------------------------------------------
  private readonly _history: AdapterTickSample[] = [];
  private _totalAdaptations = 0;
  private _lastAdaptedTick = -1;
  private _lastState: TensionState | null = null;

  // ==========================================================================
  // MARK: Core public API (preserved from original)
  // ==========================================================================

  public adaptState(
    runtimeSnapshot: TensionRuntimeSnapshot,
    queueEntries: readonly AnticipationEntry[],
    previousState?: TensionState,
  ): TensionState {
    const visibleThreats = this.adaptThreatEnvelopes(
      queueEntries,
      runtimeSnapshot.visibilityState,
      runtimeSnapshot.tickNumber,
    );

    const state = Object.freeze({
      score: runtimeSnapshot.score,
      anticipation: runtimeSnapshot.queueLength,
      visibleThreats,
      maxPulseTriggered:
        Boolean(previousState?.maxPulseTriggered) || runtimeSnapshot.isPulseActive,
      lastSpikeTick:
        runtimeSnapshot.lastSpikeTick ?? previousState?.lastSpikeTick ?? null,
    });

    this._totalAdaptations += 1;
    this._lastAdaptedTick = runtimeSnapshot.tickNumber;
    this._lastState = state;

    return state;
  }

  public mergeIntoRunState(input: TensionSnapshotAdapterInput): RunStateSnapshot {
    const queueEntries = Object.freeze([...(input.queueEntries ?? [])]);
    const tensionState = this.adaptState(
      input.runtimeSnapshot,
      queueEntries,
      input.runState.tension,
    );

    return Object.freeze({
      ...input.runState,
      tension: tensionState,
    });
  }

  public adaptThreatEnvelopes(
    queueEntries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    const envelopes = queueEntries
      .filter((entry) => !entry.isMitigated && !entry.isNullified)
      .map((entry) => this.toThreatEnvelope(entry, visibilityState, currentTick));

    return Object.freeze(envelopes);
  }

  public toThreatEnvelope(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): ThreatEnvelope {
    const visibleAs = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    const etaTicks = Math.max(0, entry.arrivalTick - currentTick);
    const severity = this.toEnvelopeSeverity(entry);
    const summary = this.buildSummary(entry, visibilityState, currentTick);

    return Object.freeze({
      threatId: entry.threatId,
      source: entry.source,
      etaTicks,
      severity,
      visibleAs,
      summary,
    });
  }

  // ==========================================================================
  // MARK: Enriched adaptation
  // ==========================================================================

  public adaptStateWithAnnotation(
    runtimeSnapshot: TensionRuntimeSnapshot,
    queueEntries: readonly AnticipationEntry[],
    previousState?: TensionState,
    pressureTier?: PressureTier,
  ): { state: TensionState; annotation: TensionStateAnnotation } {
    const state = this.adaptState(runtimeSnapshot, queueEntries, previousState);
    const annotation = this.buildAnnotations(runtimeSnapshot, queueEntries, pressureTier);
    return { state, annotation };
  }

  public computeAmplifiedTensionState(
    runtimeSnapshot: TensionRuntimeSnapshot,
    pressureTier: PressureTier,
    queueEntries: readonly AnticipationEntry[],
  ): TensionState {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const amplifiedScore = clamp(
      runtimeSnapshot.score * amplifier,
      TENSION_CONSTANTS.MIN_SCORE,
      TENSION_CONSTANTS.MAX_SCORE,
    );

    const visibleThreats = this.adaptThreatEnvelopes(
      queueEntries,
      runtimeSnapshot.visibilityState,
      runtimeSnapshot.tickNumber,
    );

    return Object.freeze({
      score: amplifiedScore,
      anticipation: runtimeSnapshot.queueLength,
      visibleThreats,
      maxPulseTriggered: amplifiedScore >= TENSION_CONSTANTS.PULSE_THRESHOLD,
      lastSpikeTick: runtimeSnapshot.lastSpikeTick,
    });
  }

  // ==========================================================================
  // MARK: Envelope enrichment
  // ==========================================================================

  public enrichEnvelopeWithAdvice(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): ThreatEnvelope & { advice?: readonly string[] } {
    const base = this.toThreatEnvelope(entry, visibilityState, currentTick);
    const advice = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];

    return Object.freeze({
      ...base,
      advice: Object.freeze([...advice]),
    });
  }

  // ==========================================================================
  // MARK: Entry filtering and grouping
  // ==========================================================================

  public filterActiveEntries(
    entries: readonly AnticipationEntry[],
  ): readonly AnticipationEntry[] {
    return Object.freeze(
      entries.filter(
        (e) =>
          e.state === ENTRY_STATE.QUEUED ||
          e.state === ENTRY_STATE.ARRIVED,
      ),
    );
  }

  public filterByState(
    entries: readonly AnticipationEntry[],
    state: EntryState,
  ): readonly AnticipationEntry[] {
    return Object.freeze(entries.filter((e) => e.state === state));
  }

  public groupAdaptedEntriesByType(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatType, readonly AnticipationEntry[]>> {
    const groups: Record<ThreatType, AnticipationEntry[]> = {
      [THREAT_TYPE.DEBT_SPIRAL]: [],
      [THREAT_TYPE.SABOTAGE]: [],
      [THREAT_TYPE.HATER_INJECTION]: [],
      [THREAT_TYPE.CASCADE]: [],
      [THREAT_TYPE.SOVEREIGNTY]: [],
      [THREAT_TYPE.OPPORTUNITY_KILL]: [],
      [THREAT_TYPE.REPUTATION_BURN]: [],
      [THREAT_TYPE.SHIELD_PIERCE]: [],
    };

    for (const entry of entries) {
      const bucket = groups[entry.threatType];
      if (bucket) bucket.push(entry);
    }

    return Object.freeze(
      Object.fromEntries(
        Object.entries(groups).map(([k, v]) => [k, Object.freeze(v)]),
      ) as Record<ThreatType, readonly AnticipationEntry[]>,
    );
  }

  public computeTypeDominance(
    entries: readonly AnticipationEntry[],
  ): ThreatType | null {
    if (entries.length === 0) return null;

    const dist = this.computeTypeDistribution(entries);
    let dominant: ThreatType | null = null;
    let max = 0;

    for (const [type, count] of Object.entries(dist) as [ThreatType, number][]) {
      if (count > max) {
        max = count;
        dominant = type;
      }
    }

    return dominant;
  }

  public computeSeverityDistribution(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatSeverity, number>> {
    const dist = buildZeroSeverityDistribution();

    for (const entry of entries) {
      if (entry.threatSeverity in dist) {
        dist[entry.threatSeverity] += 1;
      }
    }

    return Object.freeze(dist);
  }

  public computeStateDistribution(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<EntryState, number>> {
    const dist: Record<EntryState, number> = {
      [ENTRY_STATE.QUEUED]: 0,
      [ENTRY_STATE.ARRIVED]: 0,
      [ENTRY_STATE.MITIGATED]: 0,
      [ENTRY_STATE.EXPIRED]: 0,
      [ENTRY_STATE.NULLIFIED]: 0,
    };

    for (const entry of entries) {
      if (entry.state in dist) {
        dist[entry.state] += 1;
      }
    }

    return Object.freeze(dist);
  }

  public computeWeightedAdaptationScore(
    entries: readonly AnticipationEntry[],
  ): number {
    if (entries.length === 0) return 0;

    let total = 0;
    for (const entry of entries) {
      const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      total += (entry.severityWeight ?? 0) * severityWeight;
    }

    return total;
  }

  public classifyEnvelopeSeverity(severityWeight: number): ThreatSeverity {
    const w = THREAT_SEVERITY_WEIGHTS;
    if (severityWeight >= w[THREAT_SEVERITY.EXISTENTIAL]) return THREAT_SEVERITY.EXISTENTIAL;
    if (severityWeight >= w[THREAT_SEVERITY.CRITICAL]) return THREAT_SEVERITY.CRITICAL;
    if (severityWeight >= w[THREAT_SEVERITY.SEVERE]) return THREAT_SEVERITY.SEVERE;
    if (severityWeight >= w[THREAT_SEVERITY.MODERATE]) return THREAT_SEVERITY.MODERATE;
    return THREAT_SEVERITY.MINOR;
  }

  // ==========================================================================
  // MARK: Sorting and visibility
  // ==========================================================================

  public sortThreatsByVisibility(
    envelopes: readonly ThreatEnvelope[],
  ): readonly ThreatEnvelope[] {
    const visibilityLevelOrder: readonly string[] = ['HIDDEN', 'SILHOUETTE', 'PARTIAL', 'EXPOSED'];

    return Object.freeze(
      [...envelopes].sort((a, b) => {
        const aIdx = visibilityLevelOrder.indexOf(a.visibleAs);
        const bIdx = visibilityLevelOrder.indexOf(b.visibleAs);
        return bIdx - aIdx; // higher visibility first
      }),
    );
  }

  public visibilityOrdinal(state: TensionVisibilityState): number {
    const idx = VISIBILITY_ORDER.indexOf(state);
    return idx === -1 ? 0 : idx;
  }

  public getVisibilityConfig(state: TensionVisibilityState): VisibilityConfig {
    return VISIBILITY_CONFIGS[state];
  }

  public resolveEnvelopeLevel(state: TensionVisibilityState): VisibilityLevel {
    return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
  }

  // ==========================================================================
  // MARK: Score computation
  // ==========================================================================

  public computeNormalizedScore(score: number): number {
    return clamp(score / TENSION_CONSTANTS.MAX_SCORE, 0, 1);
  }

  // ==========================================================================
  // MARK: Annotations
  // ==========================================================================

  public buildAnnotations(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    pressureTier?: PressureTier,
  ): TensionStateAnnotation {
    const active = this.filterActiveEntries(entries);
    const normalizedScore = this.computeNormalizedScore(runtimeSnapshot.score);
    const riskTierRaw = resolveRiskTierFromScore(normalizedScore);
    const dominantThreatType = this.computeTypeDominance(active);
    const severityDistribution = this.computeSeverityDistribution(active);
    const typeDistribution = this.computeTypeDistribution(entries);
    const mitigationCoverage = this.computeMitigationCoverage(entries);

    const amplifier = pressureTier != null ? PRESSURE_TENSION_AMPLIFIERS[pressureTier] : 1.0;
    const queuePressure = clamp(
      (runtimeSnapshot.queueLength / Math.max(1, TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS)) *
        amplifier,
      0,
      1,
    );

    return Object.freeze({
      score: runtimeSnapshot.score,
      previousScore: runtimeSnapshot.previousScore,
      delta: runtimeSnapshot.rawDelta,
      normalizedScore,
      riskTier: riskTierRaw,
      queuePressure,
      dominantThreatType,
      mitigationCoverage,
      severityDistribution: Object.freeze(severityDistribution),
      typeDistribution: Object.freeze(typeDistribution),
    });
  }

  // ==========================================================================
  // MARK: Queue / decay integration
  // ==========================================================================

  public applyProcessResult(
    processResult: QueueProcessResult,
    tick: number,
  ): { arrivals: readonly ThreatEnvelope[]; expirations: readonly ThreatEnvelope[] } {
    const defaultVisibility = TENSION_VISIBILITY_STATE.EXPOSED;

    const arrivals = Object.freeze(
      processResult.newArrivals.map((e) =>
        this.toThreatEnvelope(e, defaultVisibility, tick),
      ),
    );

    const expirations = Object.freeze(
      processResult.newExpirations.map((e) =>
        this.toThreatEnvelope(e, defaultVisibility, tick),
      ),
    );

    return { arrivals, expirations };
  }

  public applyDecayResult(
    decayResult: DecayComputeResult,
    currentScore: number,
  ): number {
    const adjusted = currentScore + decayResult.amplifiedDelta;
    return clamp(adjusted, TENSION_CONSTANTS.MIN_SCORE, TENSION_CONSTANTS.MAX_SCORE);
  }

  public enrichTensionStateWithDecay(
    state: TensionState,
    decayResult: DecayComputeResult,
  ): TensionState {
    const newScore = this.applyDecayResult(decayResult, state.score);

    return Object.freeze({
      ...state,
      score: newScore,
      maxPulseTriggered:
        state.maxPulseTriggered || newScore >= TENSION_CONSTANTS.PULSE_THRESHOLD,
    });
  }

  public integrateQueueResult(
    runState: RunStateSnapshot,
    queueResult: QueueProcessResult,
    visibilityState: TensionVisibilityState,
    tick: number,
  ): RunStateSnapshot {
    const allEntries = [
      ...queueResult.activeEntries,
      ...queueResult.relievedEntries,
    ];

    const visibleThreats = this.adaptThreatEnvelopes(allEntries, visibilityState, tick);

    const updatedTension: TensionState = Object.freeze({
      ...runState.tension,
      anticipation: queueResult.activeEntries.length,
      visibleThreats,
    });

    return Object.freeze({
      ...runState,
      tension: updatedTension,
    });
  }

  // ==========================================================================
  // MARK: Events
  // ==========================================================================

  public buildStateSyncEvent(tick: number, state: TensionState): object {
    return Object.freeze({
      eventType: TENSION_EVENT_NAMES.SCORE_UPDATED,
      score: state.score,
      anticipation: state.anticipation,
      visibleThreatCount: state.visibleThreats.length,
      maxPulseTriggered: state.maxPulseTriggered,
      lastSpikeTick: state.lastSpikeTick,
      tick,
      timestamp: Date.now(),
    });
  }

  public buildAdapterAnnotation(tick: number, state: TensionState): object {
    const eventName = TENSION_EVENT_NAMES.UPDATED_LEGACY;
    const checksum = this.computeAdapterChecksum(state);

    return Object.freeze({
      event: eventName,
      tick,
      score: state.score,
      checksum,
    });
  }

  // ==========================================================================
  // MARK: Checksum and serialization
  // ==========================================================================

  public computeAdapterChecksum(state: TensionState): string {
    const payload = JSON.stringify({
      score: state.score,
      anticipation: state.anticipation,
      maxPulseTriggered: state.maxPulseTriggered,
      lastSpikeTick: state.lastSpikeTick,
      threatCount: state.visibleThreats.length,
    });

    return createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  public serialize(): AdapterSerializedState {
    const lastState = this._lastState;
    const checksum = lastState != null
      ? this.computeAdapterChecksum(lastState)
      : createHash('sha256').update('empty').digest('hex').slice(0, 16);

    return Object.freeze({
      totalAdaptations: this._totalAdaptations,
      lastAdaptedTick: this._lastAdaptedTick,
      checksum,
    });
  }

  // ==========================================================================
  // MARK: History / tick samples
  // ==========================================================================

  public recordTickSample(
    tick: number,
    state: TensionState,
    queueLength: number,
    arrivedCount: number,
    visibilityState: TensionVisibilityState,
  ): void {
    const sample: AdapterTickSample = Object.freeze({
      tick,
      score: state.score,
      queueLength,
      arrivedCount,
      visibilityOrdinal: this.visibilityOrdinal(visibilityState),
    });

    if (this._history.length >= ADAPTER_HISTORY_CAPACITY) {
      this._history.shift();
    }

    this._history.push(sample);
  }

  public computeSessionSummary(): AdapterSessionSummary {
    if (this._history.length === 0) {
      return Object.freeze({
        totalAdaptations: this._totalAdaptations,
        peakScore: 0,
        peakQueueLength: 0,
        averageScore: 0,
        volatility: 0,
      });
    }

    let peakScore = 0;
    let peakQueueLength = 0;
    let scoreSum = 0;

    for (const sample of this._history) {
      if (sample.score > peakScore) peakScore = sample.score;
      if (sample.queueLength > peakQueueLength) peakQueueLength = sample.queueLength;
      scoreSum += sample.score;
    }

    const averageScore = scoreSum / this._history.length;

    let varianceSum = 0;
    for (const sample of this._history) {
      const diff = sample.score - averageScore;
      varianceSum += diff * diff;
    }
    const volatility = Math.sqrt(varianceSum / this._history.length);

    return Object.freeze({
      totalAdaptations: this._totalAdaptations,
      peakScore,
      peakQueueLength,
      averageScore,
      volatility,
    });
  }

  // ==========================================================================
  // MARK: ML vector
  // ==========================================================================

  public computeMLVector(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
    tick: number,
  ): AdapterMLVector {
    const active = this.filterActiveEntries(entries);
    const normalizedScore = this.computeNormalizedScore(runtimeSnapshot.score);
    const ordinal = this.visibilityOrdinal(visibilityState);
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const totalWeight = active.reduce((s, e) => s + (e.severityWeight ?? 0), 0);
    const avgWeight = active.length > 0 ? totalWeight / active.length : 0;
    const dominant = this.computeTypeDominance(active);
    const dominantPriority = dominant != null ? this.threatTypePriority(dominant) : 0;
    const pulseActive = runtimeSnapshot.isPulseActive ? 1 : 0;

    const severityDist = this.computeSeverityDistribution(active);
    const typeDist = this.computeTypeDistribution(entries);
    const mitigationCoverage = this.computeMitigationCoverage(entries);
    const escalating = runtimeSnapshot.isEscalating ? 1 : 0;

    const checksumHex = this.computeAdapterChecksum({
      score: runtimeSnapshot.score,
      anticipation: runtimeSnapshot.queueLength,
      visibleThreats: runtimeSnapshot.visibleThreats,
      maxPulseTriggered: runtimeSnapshot.isPulseActive,
      lastSpikeTick: runtimeSnapshot.lastSpikeTick,
    });
    const checksumByte = parseInt(checksumHex.slice(0, 2), 16) / 255;

    const features: number[] = [
      normalizedScore,                                          // 0
      runtimeSnapshot.queueLength,                             // 1
      runtimeSnapshot.arrivedCount,                            // 2
      ordinal,                                                 // 3
      amplifier,                                               // 4
      totalWeight,                                             // 5
      avgWeight,                                               // 6
      dominantPriority,                                        // 7
      pulseActive,                                             // 8
      runtimeSnapshot.pulseTicksActive,                        // 9
      runtimeSnapshot.rawDelta,                                // 10
      runtimeSnapshot.amplifiedDelta,                          // 11
      severityDist[THREAT_SEVERITY.MINOR],                     // 12
      severityDist[THREAT_SEVERITY.MODERATE],                  // 13
      severityDist[THREAT_SEVERITY.SEVERE],                    // 14
      severityDist[THREAT_SEVERITY.CRITICAL],                  // 15
      severityDist[THREAT_SEVERITY.EXISTENTIAL],               // 16
      typeDist[THREAT_TYPE.DEBT_SPIRAL],                       // 17
      typeDist[THREAT_TYPE.SABOTAGE],                          // 18
      typeDist[THREAT_TYPE.HATER_INJECTION],                   // 19
      typeDist[THREAT_TYPE.CASCADE],                           // 20
      typeDist[THREAT_TYPE.SOVEREIGNTY],                       // 21
      typeDist[THREAT_TYPE.OPPORTUNITY_KILL],                  // 22
      typeDist[THREAT_TYPE.REPUTATION_BURN],                   // 23
      typeDist[THREAT_TYPE.SHIELD_PIERCE],                     // 24
      mitigationCoverage,                                      // 25
      runtimeSnapshot.score / TENSION_CONSTANTS.MAX_SCORE,     // 26
      escalating,                                              // 27
      runtimeSnapshot.expiredCount,                            // 28
      runtimeSnapshot.relievedCount,                           // 29
      tick / 1000,                                             // 30
      checksumByte,                                            // 31
    ];

    return Object.freeze({
      features: Object.freeze(features),
      labels: ADAPTER_ML_FEATURE_LABELS,
      tick,
    });
  }

  // ==========================================================================
  // MARK: DL tensor
  // ==========================================================================

  public extractDLTensor(
    pressureTier: PressureTier,
    tick: number,
  ): AdapterDLTensor {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const history = [...this._history];

    // pad with zeroes if history shorter than sequence length
    while (history.length < ADAPTER_DL_SEQUENCE_LENGTH) {
      history.unshift(
        Object.freeze({
          tick: 0,
          score: 0,
          queueLength: 0,
          arrivedCount: 0,
          visibilityOrdinal: 0,
        }),
      );
    }

    const window = history.slice(-ADAPTER_DL_SEQUENCE_LENGTH);
    const rows: AdapterDLTensorRow[] = window.map((sample) =>
      Object.freeze({
        features: Object.freeze([
          sample.score,                                // 0 score
          sample.queueLength,                          // 1 queue_length
          sample.arrivedCount,                         // 2 arrived_count
          sample.visibilityOrdinal,                    // 3 visibility_ordinal
          sample.score * amplifier,                    // 4 total_weight (amplified)
          sample.score >= TENSION_CONSTANTS.PULSE_THRESHOLD ? 1 : 0, // 5 pulse_active
          0,                                           // 6 raw_delta (not stored in sample)
          tick / 1000,                                 // 7 amplified_delta proxy
        ] as readonly number[]),
      }),
    );

    return Object.freeze({
      rows: Object.freeze(rows),
      labels: ADAPTER_DL_COLUMN_LABELS,
    });
  }

  // ==========================================================================
  // MARK: Health report
  // ==========================================================================

  public computeHealthReport(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
  ): AdapterHealthReport {
    const active = this.filterActiveEntries(entries);
    const arrived = this.filterByState(entries, ENTRY_STATE.ARRIVED);
    const totalWeight = active.reduce((s, e) => s + (e.severityWeight ?? 0), 0);
    const normalizedScore = this.computeNormalizedScore(runtimeSnapshot.score);
    const riskTier = resolveRiskTierFromScore(normalizedScore);
    const alerts: string[] = [];

    if (riskTier === 'CRITICAL') {
      alerts.push('CRITICAL tension score detected — immediate mitigation required');
    }
    if (runtimeSnapshot.isPulseActive) {
      alerts.push(
        `Max-pulse active for ${runtimeSnapshot.pulseTicksActive} ticks — sovereignty at risk`,
      );
    }
    if (arrived.length > 0) {
      alerts.push(`${arrived.length} threat(s) actively pressuring the run`);
    }
    if (runtimeSnapshot.isEscalating) {
      alerts.push('Tension score is escalating — pressure tier escalation possible');
    }

    return Object.freeze({
      riskTier,
      adaptedCount: entries.length,
      activeCount: active.length,
      arrivedCount: arrived.length,
      totalWeight,
      alerts: Object.freeze(alerts),
    });
  }

  // ==========================================================================
  // MARK: Narrative
  // ==========================================================================

  public generateNarrative(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier?: PressureTier,
  ): AdapterNarrative {
    const config = VISIBILITY_CONFIGS[visibilityState];
    const active = this.filterActiveEntries(entries);
    const dominant = this.computeTypeDominance(active);
    const normalizedScore = this.computeNormalizedScore(runtimeSnapshot.score);
    const riskTier = resolveRiskTierFromScore(normalizedScore);
    const urgency = urgencyFromRiskTier(riskTier);

    const amplifier =
      pressureTier != null ? PRESSURE_TENSION_AMPLIFIERS[pressureTier] : 1.0;
    const amplifiedScore = clamp(
      runtimeSnapshot.score * amplifier,
      TENSION_CONSTANTS.MIN_SCORE,
      TENSION_CONSTANTS.MAX_SCORE,
    );

    let headline: string;
    let body: string;

    if (active.length === 0) {
      headline = 'No active threats in queue';
      body = `Tension score ${amplifiedScore.toFixed(3)} — queue clear. Visibility: ${config.state}.`;
    } else if (dominant != null) {
      headline = `Dominant threat class: ${dominant} (${active.length} active)`;
      body =
        `Amplified tension: ${amplifiedScore.toFixed(3)} at ${config.state} visibility. ` +
        `${active.length} active entr${active.length === 1 ? 'y' : 'ies'} detected. ` +
        `${runtimeSnapshot.isPulseActive ? 'Max-pulse active. ' : ''}` +
        `Awareness bonus: ${config.tensionAwarenessBonus > 0 ? '+' + config.tensionAwarenessBonus : 'none'}.`;
    } else {
      headline = `${active.length} active threat(s) across mixed types`;
      body = `Tension score ${amplifiedScore.toFixed(3)} — mixed threat profile at ${config.state} visibility.`;
    }

    const mitigationSummary = this.buildMitigationSummary(dominant, entries);

    return Object.freeze({ headline, body, urgency, mitigationSummary });
  }

  // ==========================================================================
  // MARK: Extended analytical methods
  // ==========================================================================

  /**
   * Compute the ratio of arrived entries to total active entries.
   * Returns 0 when there are no active entries.
   */
  public computeArrivalPressureRatio(entries: readonly AnticipationEntry[]): number {
    const active = this.filterActiveEntries(entries);
    if (active.length === 0) return 0;
    const arrived = active.filter((e) => e.state === ENTRY_STATE.ARRIVED).length;
    return arrived / active.length;
  }

  /**
   * Compute the cascade exposure ratio — fraction of active entries that were
   * cascade-triggered.
   */
  public computeCascadeExposureRatio(entries: readonly AnticipationEntry[]): number {
    const active = this.filterActiveEntries(entries);
    if (active.length === 0) return 0;
    const cascaded = active.filter((e) => e.isCascadeTriggered).length;
    return cascaded / active.length;
  }

  /**
   * Compute total base tension contribution per tick from all active entries.
   */
  public computeTotalBaseTensionPerTick(entries: readonly AnticipationEntry[]): number {
    const active = this.filterActiveEntries(entries);
    return active.reduce((sum, e) => sum + e.baseTensionPerTick, 0);
  }

  /**
   * Compute the average arrival ETA in ticks for all queued (non-arrived) entries.
   * Returns null when there are no queued entries.
   */
  public computeAverageQueueEta(
    entries: readonly AnticipationEntry[],
    currentTick: number,
  ): number | null {
    const queued = this.filterByState(entries, ENTRY_STATE.QUEUED);
    if (queued.length === 0) return null;
    const totalEta = queued.reduce(
      (sum, e) => sum + Math.max(0, e.arrivalTick - currentTick),
      0,
    );
    return totalEta / queued.length;
  }

  /**
   * Return the entry with the highest severityWeight among active entries.
   * Returns null when there are no active entries.
   */
  public getDominantActiveEntry(
    entries: readonly AnticipationEntry[],
  ): AnticipationEntry | null {
    const active = this.filterActiveEntries(entries);
    if (active.length === 0) return null;
    return active.reduce((best, e) =>
      (e.severityWeight ?? 0) > (best.severityWeight ?? 0) ? e : best,
    );
  }

  /**
   * Compute a pressure heat index — normalized weighted score of active entries
   * amplified by the supplied pressure tier.
   */
  public computePressureHeatIndex(
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
  ): number {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const active = this.filterActiveEntries(entries);
    if (active.length === 0) return 0;

    const totalWeight = active.reduce((s, e) => s + (e.severityWeight ?? 0), 0);
    const avgWeight = totalWeight / active.length;
    const amplifiedIndex = clamp(avgWeight * amplifier, 0, 1);
    return amplifiedIndex;
  }

  /**
   * Compute a compound threat score that accounts for both score magnitude and
   * the quantity/severity of active threats.
   */
  public computeCompoundThreatScore(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
  ): number {
    const normalized = this.computeNormalizedScore(runtimeSnapshot.score);
    const heatIndex = this.computePressureHeatIndex(entries, pressureTier);
    const arrivalRatio = this.computeArrivalPressureRatio(entries);

    return clamp((normalized * 0.5) + (heatIndex * 0.3) + (arrivalRatio * 0.2), 0, 1);
  }

  /**
   * Determine whether the run is in a sustained critical state given the current
   * runtime snapshot and pulse history.
   */
  public isInSustainedCriticalState(runtimeSnapshot: TensionRuntimeSnapshot): boolean {
    return (
      runtimeSnapshot.isPulseActive &&
      runtimeSnapshot.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS
    );
  }

  /**
   * Summarize the types present in the given entries as a sorted tuple of
   * (type, count) pairs, descending by count.
   */
  public summarizeTypePresence(
    entries: readonly AnticipationEntry[],
  ): ReadonlyArray<{ readonly type: ThreatType; readonly count: number }> {
    const dist = this.computeTypeDistribution(entries);
    const pairs = (Object.entries(dist) as [ThreatType, number][])
      .filter(([, count]) => count > 0)
      .map(([type, count]) => Object.freeze({ type, count }))
      .sort((a, b) => b.count - a.count);

    return Object.freeze(pairs);
  }

  /**
   * Compute mitigation depth — total number of mitigation card types available
   * across all active entries.
   */
  public computeMitigationDepth(entries: readonly AnticipationEntry[]): number {
    const active = this.filterActiveEntries(entries);
    return active.reduce((sum, e) => sum + e.mitigationCardTypes.length, 0);
  }

  /**
   * Check whether a given visibility state upgrade is available based on the
   * configured downgrade delay in VISIBILITY_CONFIGS.
   */
  public isVisibilityDowngradeAllowed(
    state: TensionVisibilityState,
    ticksSinceChange: number,
  ): boolean {
    const config = VISIBILITY_CONFIGS[state];
    return ticksSinceChange >= config.visibilityDowngradeDelayTicks;
  }

  /**
   * Produce a threat type affinity map that scores each threat type by its
   * combined severityWeight contribution from active entries.
   */
  public computeThreatTypeAffinityMap(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatType, number>> {
    const active = this.filterActiveEntries(entries);
    const affinity: Record<ThreatType, number> = buildZeroTypeDistribution() as Record<ThreatType, number>;

    for (const entry of active) {
      affinity[entry.threatType] += entry.severityWeight ?? 0;
    }

    // normalize each bucket by the severity weight for its dominant class
    for (const type of Object.keys(affinity) as ThreatType[]) {
      const maxWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
      affinity[type] = clamp(affinity[type] / maxWeight, 0, 1);
    }

    return Object.freeze(affinity);
  }

  /**
   * Determine the recommended mitigation priority list for the current threat
   * profile using THREAT_TYPE_DEFAULT_MITIGATIONS.
   */
  public computeRecommendedMitigationPriority(
    entries: readonly AnticipationEntry[],
  ): readonly string[] {
    const dominant = this.getDominantActiveEntry(entries);
    if (dominant == null) return Object.freeze([]);

    const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[dominant.threatType];
    const entryMitigations = dominant.mitigationCardTypes.length > 0
      ? dominant.mitigationCardTypes
      : defaults;

    const merged = [...new Set([...entryMitigations, ...defaults])];
    return Object.freeze(merged);
  }

  /**
   * Build a compact risk summary string suitable for logging or telemetry.
   */
  public buildRiskSummaryString(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
  ): string {
    const normalized = this.computeNormalizedScore(runtimeSnapshot.score);
    const riskTier = resolveRiskTierFromScore(normalized);
    const compound = this.computeCompoundThreatScore(runtimeSnapshot, entries, pressureTier);
    const active = this.filterActiveEntries(entries);
    const dominant = this.computeTypeDominance(active);
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];

    return (
      `[TENSION] score=${runtimeSnapshot.score.toFixed(3)} ` +
      `norm=${normalized.toFixed(3)} ` +
      `risk=${riskTier} ` +
      `compound=${compound.toFixed(3)} ` +
      `queue=${runtimeSnapshot.queueLength} ` +
      `arrived=${runtimeSnapshot.arrivedCount} ` +
      `pulse=${runtimeSnapshot.isPulseActive ? 'Y' : 'N'} ` +
      `tier=${pressureTier}(x${amplifier}) ` +
      `dominant=${dominant ?? 'NONE'} ` +
      `tick=${runtimeSnapshot.tickNumber}`
    );
  }

  /**
   * Evaluate whether the current tension state warrants an immediate player
   * notification based on visibility and score thresholds.
   */
  public shouldTriggerPlayerAlert(
    runtimeSnapshot: TensionRuntimeSnapshot,
    visibilityState: TensionVisibilityState,
  ): boolean {
    const config = VISIBILITY_CONFIGS[visibilityState];
    const normalized = this.computeNormalizedScore(runtimeSnapshot.score);

    if (!config.showsThreatCount) return false;
    if (normalized >= ADAPTER_RISK_THRESHOLDS.HIGH) return true;
    if (runtimeSnapshot.isPulseActive) return true;
    if (runtimeSnapshot.isEscalating && normalized >= ADAPTER_RISK_THRESHOLDS.MEDIUM) return true;
    return false;
  }

  /**
   * Compute the effective visibility awareness bonus for the given state from
   * VISIBILITY_CONFIGS, returning 0 for states without a bonus.
   */
  public computeVisibilityAwarenessBonus(state: TensionVisibilityState): number {
    return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
  }

  /**
   * Produce a flat list of all distinct mitigation card types available across
   * active entries, de-duplicated.
   */
  public collectDistinctMitigationCards(entries: readonly AnticipationEntry[]): readonly string[] {
    const active = this.filterActiveEntries(entries);
    const seen = new Set<string>();

    for (const entry of active) {
      for (const card of entry.mitigationCardTypes) {
        seen.add(card);
      }
    }

    // also include defaults for dominant type
    const dominant = this.computeTypeDominance(active);
    if (dominant != null) {
      for (const card of THREAT_TYPE_DEFAULT_MITIGATIONS[dominant]) {
        seen.add(card);
      }
    }

    return Object.freeze([...seen]);
  }

  /**
   * Compute the fraction of active entries that have at least one mitigation
   * card type listed.
   */
  public computeMitigationReadiness(entries: readonly AnticipationEntry[]): number {
    const active = this.filterActiveEntries(entries);
    if (active.length === 0) return 1;
    const covered = active.filter((e) => e.mitigationCardTypes.length > 0).length;
    return covered / active.length;
  }

  /**
   * Build a structured diagnostic object for developer tooling, combining
   * all available analytical surfaces into a single report object.
   */
  public buildDiagnosticReport(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
  ): object {
    const normalized = this.computeNormalizedScore(runtimeSnapshot.score);
    const riskTier = resolveRiskTierFromScore(normalized);
    const active = this.filterActiveEntries(entries);
    const compound = this.computeCompoundThreatScore(runtimeSnapshot, entries, pressureTier);
    const heatIndex = this.computePressureHeatIndex(entries, pressureTier);
    const arrivalRatio = this.computeArrivalPressureRatio(entries);
    const cascadeRatio = this.computeCascadeExposureRatio(entries);
    const baseTensionPerTick = this.computeTotalBaseTensionPerTick(entries);
    const mitigationReadiness = this.computeMitigationReadiness(entries);
    const dominant = this.computeTypeDominance(active);
    const affinityMap = this.computeThreatTypeAffinityMap(entries);
    const typePresence = this.summarizeTypePresence(entries);
    const visibilityBonus = this.computeVisibilityAwarenessBonus(visibilityState);
    const sustainedCritical = this.isInSustainedCriticalState(runtimeSnapshot);
    const alertRequired = this.shouldTriggerPlayerAlert(runtimeSnapshot, visibilityState);

    return Object.freeze({
      score: runtimeSnapshot.score,
      normalizedScore: normalized,
      riskTier,
      compoundThreatScore: compound,
      pressureHeatIndex: heatIndex,
      arrivalPressureRatio: arrivalRatio,
      cascadeExposureRatio: cascadeRatio,
      baseTensionPerTick,
      mitigationReadiness,
      dominantThreatType: dominant,
      affinityMap,
      typePresence,
      visibilityAwarenessBonus: visibilityBonus,
      sustainedCriticalState: sustainedCritical,
      alertRequired,
      pressureTier,
      pressureAmplifier: PRESSURE_TENSION_AMPLIFIERS[pressureTier],
      activeCount: active.length,
      totalCount: entries.length,
      tick: runtimeSnapshot.tickNumber,
    });
  }

  // ==========================================================================
  // MARK: Export bundle
  // ==========================================================================

  public exportBundle(
    runtimeSnapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
    tick: number,
  ): AdapterExportBundle {
    const mlVector = this.computeMLVector(
      runtimeSnapshot,
      entries,
      visibilityState,
      pressureTier,
      tick,
    );
    const dlTensor = this.extractDLTensor(pressureTier, tick);
    const healthReport = this.computeHealthReport(runtimeSnapshot, entries);
    const narrative = this.generateNarrative(
      runtimeSnapshot,
      entries,
      visibilityState,
      pressureTier,
    );
    const sessionSummary = this.computeSessionSummary();
    const serialized = this.serialize();

    return Object.freeze({
      mlVector,
      dlTensor,
      healthReport,
      narrative,
      sessionSummary,
      serialized,
    });
  }

  // ==========================================================================
  // MARK: Private helpers
  // ==========================================================================

  private buildSummary(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): string {
    const etaTicks = Math.max(0, entry.arrivalTick - currentTick);
    const countdownLabel =
      etaTicks === 0
        ? entry.ticksOverdue > 0
          ? `ACTIVE +${entry.ticksOverdue}t`
          : 'ACTIVE NOW'
        : `IN ${etaTicks}T`;

    switch (visibilityState) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return 'Threat signature detected. Details suppressed under low-visibility conditions.';

      case TENSION_VISIBILITY_STATE.SIGNALED:
        return `${entry.threatType} incoming. Prepare a category-correct response.`;

      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return `${entry.threatType} ${countdownLabel}. ${entry.summary}`;

      case TENSION_VISIBILITY_STATE.EXPOSED: {
        const mitigation =
          entry.mitigationCardTypes.length > 0
            ? ` Mitigate via ${entry.mitigationCardTypes.join(' / ')}.`
            : '';

        return `${entry.threatType} ${countdownLabel}. ${entry.summary} Worst case: ${entry.worstCaseOutcome}.${mitigation}`;
      }

      default:
        return entry.summary;
    }
  }

  private toEnvelopeSeverity(entry: AnticipationEntry): number {
    const weight = Number.isFinite(entry.severityWeight) ? entry.severityWeight : 0;
    const scaled = Math.round(weight * 10);
    return Math.max(1, Math.min(10, scaled));
  }

  private computeTypeDistribution(
    entries: readonly AnticipationEntry[],
  ): Record<ThreatType, number> {
    const dist = buildZeroTypeDistribution();
    for (const entry of entries) {
      if (entry.threatType in dist) {
        dist[entry.threatType] += 1;
      }
    }
    return dist;
  }

  private computeMitigationCoverage(entries: readonly AnticipationEntry[]): number {
    if (entries.length === 0) return 0;
    const mitigated = entries.filter(
      (e) => e.state === ENTRY_STATE.MITIGATED || e.state === ENTRY_STATE.NULLIFIED,
    ).length;
    return mitigated / entries.length;
  }

  private threatTypePriority(type: ThreatType): number {
    const priorities: Record<ThreatType, number> = {
      [THREAT_TYPE.DEBT_SPIRAL]: 1,
      [THREAT_TYPE.SABOTAGE]: 2,
      [THREAT_TYPE.HATER_INJECTION]: 3,
      [THREAT_TYPE.CASCADE]: 4,
      [THREAT_TYPE.SOVEREIGNTY]: 5,
      [THREAT_TYPE.OPPORTUNITY_KILL]: 6,
      [THREAT_TYPE.REPUTATION_BURN]: 7,
      [THREAT_TYPE.SHIELD_PIERCE]: 8,
    };
    return priorities[type] ?? 0;
  }

  private buildMitigationSummary(
    dominant: ThreatType | null,
    entries: readonly AnticipationEntry[],
  ): string {
    if (dominant == null) return 'No dominant threat type — broad mitigation advised.';

    const defaultMitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[dominant];
    const coverage = this.computeMitigationCoverage(entries);
    const coveragePct = Math.round(coverage * 100);

    return (
      `For ${dominant}: deploy ${defaultMitigations.join(' or ')}. ` +
      `Current mitigation coverage: ${coveragePct}%.`
    );
  }
}

// ============================================================================
// MARK: Standalone exported functions
// ============================================================================

/**
 * Adapt a TensionRuntimeSnapshot and queue entries into a TensionState.
 * Convenience wrapper around a one-shot TensionSnapshotAdapter instance.
 */
export function adaptTensionState(
  runtimeSnapshot: TensionRuntimeSnapshot,
  queueEntries: readonly AnticipationEntry[],
  previousState?: TensionState,
): TensionState {
  return new TensionSnapshotAdapter().adaptState(
    runtimeSnapshot,
    queueEntries,
    previousState,
  );
}

/**
 * Convert anticipation queue entries to visibility-safe ThreatEnvelope objects.
 */
export function adaptThreatEnvelopes(
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
  currentTick: number,
): readonly ThreatEnvelope[] {
  return new TensionSnapshotAdapter().adaptThreatEnvelopes(
    entries,
    visibilityState,
    currentTick,
  );
}

/**
 * Extract the normalized score from a TensionRuntimeSnapshot.
 */
export function computeAdaptedScore(runtimeSnapshot: TensionRuntimeSnapshot): number {
  const adapter = new TensionSnapshotAdapter();
  return adapter.computeNormalizedScore(runtimeSnapshot.score);
}

/**
 * Count active (QUEUED or ARRIVED) entries in the queue.
 */
export function computeAdaptedQueueLength(
  entries: readonly AnticipationEntry[],
): number {
  return entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  ).length;
}

/**
 * Filter entries to those eligible for active adaptation.
 */
export function filterActiveForAdaptation(
  entries: readonly AnticipationEntry[],
): readonly AnticipationEntry[] {
  return new TensionSnapshotAdapter().filterActiveEntries(entries);
}

/**
 * Compute a 32-dimensional ML feature vector from adapter inputs.
 */
export function computeAdapterMLVector(
  runtimeSnapshot: TensionRuntimeSnapshot,
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
  pressureTier: PressureTier,
  tick: number,
): AdapterMLVector {
  return new TensionSnapshotAdapter().computeMLVector(
    runtimeSnapshot,
    entries,
    visibilityState,
    pressureTier,
    tick,
  );
}

/**
 * Compute a scalar [0, 1] adaptation health score combining normalized tension
 * score and active threat pressure.
 */
export function computeAdaptationHealthScore(
  runtimeSnapshot: TensionRuntimeSnapshot,
  entries: readonly AnticipationEntry[],
): number {
  const adapter = new TensionSnapshotAdapter();
  const normalizedScore = adapter.computeNormalizedScore(runtimeSnapshot.score);
  const active = adapter.filterActiveEntries(entries);
  const arrivedRatio =
    active.length > 0
      ? active.filter((e) => e.state === ENTRY_STATE.ARRIVED).length / active.length
      : 0;

  return clamp((normalizedScore + arrivedRatio) / 2, 0, 1);
}

/**
 * Classify adaptation risk tier from a normalized score and arrived count.
 */
export function classifyAdaptationRisk(score: number, arrivedCount: number): string {
  const baseTier = resolveRiskTierFromScore(score);
  if (arrivedCount >= 3 && baseTier !== 'CRITICAL') {
    const tiers: ReadonlyArray<'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = [
      'CLEAR', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL',
    ];
    const idx = tiers.indexOf(baseTier);
    return tiers[Math.min(idx + 1, tiers.length - 1)];
  }
  return baseTier;
}

/**
 * Build a structured context object for chat adapter consumption.
 */
export function buildAdapterChatContext(
  runtimeSnapshot: TensionRuntimeSnapshot,
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
): object {
  const adapter = new TensionSnapshotAdapter();
  const config = VISIBILITY_CONFIGS[visibilityState];
  const active = adapter.filterActiveEntries(entries);
  const dominant = adapter.computeTypeDominance(active);
  const normalizedScore = adapter.computeNormalizedScore(runtimeSnapshot.score);
  const riskTier = resolveRiskTierFromScore(normalizedScore);
  const mitigationCoverage = active.length > 0
    ? entries.filter(
        (e) => e.state === ENTRY_STATE.MITIGATED || e.state === ENTRY_STATE.NULLIFIED,
      ).length / entries.length
    : 0;

  return Object.freeze({
    score: runtimeSnapshot.score,
    normalizedScore,
    riskTier,
    visibilityState,
    visibilityConfig: config,
    queueLength: runtimeSnapshot.queueLength,
    arrivedCount: runtimeSnapshot.arrivedCount,
    dominantThreatType: dominant,
    mitigationCoverage,
    isPulseActive: runtimeSnapshot.isPulseActive,
    isEscalating: runtimeSnapshot.isEscalating,
    eventName: TENSION_EVENT_NAMES.SCORE_UPDATED,
  });
}

/**
 * Merge a TensionState into a RunStateSnapshot.
 */
export function mergeRunStateWithTension(
  runState: RunStateSnapshot,
  tensionState: TensionState,
): RunStateSnapshot {
  return Object.freeze({
    ...runState,
    tension: tensionState,
  });
}

// ============================================================================
// MARK: Self-test
// ============================================================================

/**
 * Run 60+ internal checks verifying adapter correctness against all constants,
 * types, and output shapes defined in this module.
 */
export function runAdapterSelfTest(): AdapterSelfTestResult {
  const checks: string[] = [];
  const failures: string[] = [];

  function check(label: string, condition: boolean): void {
    checks.push(label);
    if (!condition) failures.push(label);
  }

  const adapter = new TensionSnapshotAdapter();

  // ---- build minimal fixtures -----------------------------------------------

  const baseEntry: AnticipationEntry = {
    entryId: 'e001',
    runId: 'run001',
    sourceKey: 'debt-1',
    threatId: 'threat-1',
    source: 'system',
    threatType: THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity: THREAT_SEVERITY.MODERATE,
    enqueuedAtTick: 0,
    arrivalTick: 5,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'Insolvency',
    mitigationCardTypes: ['REFINANCE'],
    baseTensionPerTick: 0.12,
    severityWeight: 0.5,
    summary: 'Debt spiral incoming',
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

  const arrivedEntry: AnticipationEntry = {
    ...baseEntry,
    entryId: 'e002',
    threatType: THREAT_TYPE.SABOTAGE,
    threatSeverity: THREAT_SEVERITY.SEVERE,
    state: ENTRY_STATE.ARRIVED,
    isArrived: true,
    severityWeight: 0.7,
  };

  const mitigatedEntry: AnticipationEntry = {
    ...baseEntry,
    entryId: 'e003',
    threatType: THREAT_TYPE.CASCADE,
    state: ENTRY_STATE.MITIGATED,
    isMitigated: true,
  };

  const expiredEntry: AnticipationEntry = {
    ...baseEntry,
    entryId: 'e004',
    threatType: THREAT_TYPE.REPUTATION_BURN,
    state: ENTRY_STATE.EXPIRED,
    isExpired: true,
  };

  const nullifiedEntry: AnticipationEntry = {
    ...baseEntry,
    entryId: 'e005',
    threatType: THREAT_TYPE.SHIELD_PIERCE,
    state: ENTRY_STATE.NULLIFIED,
    isNullified: true,
  };

  const allEntries = [
    baseEntry,
    arrivedEntry,
    mitigatedEntry,
    expiredEntry,
    nullifiedEntry,
  ] as const;

  const mockContributionBreakdown = {
    queuedThreats: 0.12,
    arrivedThreats: 0.2,
    expiredGhosts: 0,
    mitigationDecay: 0,
    nullifyDecay: 0,
    emptyQueueBonus: 0,
    visibilityBonus: 0,
    sovereigntyBonus: 0,
  };

  const mockRuntimeSnapshot: TensionRuntimeSnapshot = {
    score: 0.65,
    previousScore: 0.55,
    rawDelta: 0.1,
    amplifiedDelta: 0.12,
    visibilityState: TENSION_VISIBILITY_STATE.TELEGRAPHED,
    queueLength: 2,
    arrivedCount: 1,
    queuedCount: 1,
    expiredCount: 1,
    relievedCount: 1,
    visibleThreats: [],
    isPulseActive: false,
    pulseTicksActive: 0,
    isEscalating: true,
    dominantEntryId: 'e001',
    lastSpikeTick: 10,
    tickNumber: 15,
    timestamp: Date.now(),
    contributionBreakdown: mockContributionBreakdown,
  };

  // ---- 1. adaptState output shape -------------------------------------------
  const adapted = adapter.adaptState(mockRuntimeSnapshot, allEntries);
  check('adaptState returns object', typeof adapted === 'object' && adapted !== null);
  check('adaptState has score', typeof adapted.score === 'number');
  check('adaptState.score matches snapshot', adapted.score === mockRuntimeSnapshot.score);
  check('adaptState has anticipation', typeof adapted.anticipation === 'number');
  check('adaptState has visibleThreats array', Array.isArray(adapted.visibleThreats));
  check('adaptState has maxPulseTriggered', typeof adapted.maxPulseTriggered === 'boolean');
  check('adaptState has lastSpikeTick', adapted.lastSpikeTick === 10);

  // ---- 2. mergeIntoRunState preserves runId ---------------------------------
  const mockRunState = {
    schemaVersion: 'engine-run-state.v2' as const,
    runId: 'run-abc-123',
    userId: 'user-1',
    seed: 'seed-1',
    mode: 'solo' as const,
    tick: 15,
    phase: 'ESCALATION' as const,
    outcome: null,
    tags: [],
    economy: {} as never,
    pressure: {} as never,
    tension: adapted,
    shield: {} as never,
    battle: {} as never,
    cascade: {} as never,
    sovereignty: {} as never,
    cards: {} as never,
    modeState: {} as never,
    timers: {} as never,
    telemetry: {} as never,
  } as unknown as RunStateSnapshot;

  const merged = adapter.mergeIntoRunState({
    runState: mockRunState,
    runtimeSnapshot: mockRuntimeSnapshot,
    queueEntries: allEntries,
  });
  check('mergeIntoRunState preserves runId', merged.runId === 'run-abc-123');
  check('mergeIntoRunState has tension.score', typeof merged.tension.score === 'number');

  // ---- 3. ENTRY_STATE values all testable -----------------------------------
  check(
    'filterByState QUEUED',
    adapter.filterByState(allEntries, ENTRY_STATE.QUEUED).length === 1,
  );
  check(
    'filterByState ARRIVED',
    adapter.filterByState(allEntries, ENTRY_STATE.ARRIVED).length === 1,
  );
  check(
    'filterByState MITIGATED',
    adapter.filterByState(allEntries, ENTRY_STATE.MITIGATED).length === 1,
  );
  check(
    'filterByState EXPIRED',
    adapter.filterByState(allEntries, ENTRY_STATE.EXPIRED).length === 1,
  );
  check(
    'filterByState NULLIFIED',
    adapter.filterByState(allEntries, ENTRY_STATE.NULLIFIED).length === 1,
  );

  // ---- 4. filterActiveEntries -----------------------------------------------
  const active = adapter.filterActiveEntries(allEntries);
  check('filterActiveEntries length 2', active.length === 2);

  // ---- 5. THREAT_SEVERITY_WEIGHTS applied ------------------------------------
  const weightedScore = adapter.computeWeightedAdaptationScore(active);
  check('computeWeightedAdaptationScore is number', typeof weightedScore === 'number');
  check('computeWeightedAdaptationScore > 0', weightedScore > 0);

  // test each severity weight is accessible
  check(
    'THREAT_SEVERITY_WEIGHTS.MINOR is 0.2',
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] === 0.2,
  );
  check(
    'THREAT_SEVERITY_WEIGHTS.EXISTENTIAL is 1.0',
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] === 1.0,
  );

  // ---- 6. PRESSURE_TENSION_AMPLIFIERS used ----------------------------------
  const amplifiedState = adapter.computeAmplifiedTensionState(
    mockRuntimeSnapshot,
    'T3',
    allEntries,
  );
  check('computeAmplifiedTensionState returns TensionState', typeof amplifiedState.score === 'number');
  check(
    'amplified score uses PRESSURE_TENSION_AMPLIFIERS T3',
    Math.abs(
      amplifiedState.score - Math.min(mockRuntimeSnapshot.score * PRESSURE_TENSION_AMPLIFIERS.T3, 1),
    ) < 1e-9,
  );

  // ---- 7. VISIBILITY_CONFIGS queried ----------------------------------------
  const config = adapter.getVisibilityConfig(TENSION_VISIBILITY_STATE.EXPOSED);
  check('VISIBILITY_CONFIGS EXPOSED has showsMitigationPath true', config.showsMitigationPath === true);
  check('VISIBILITY_CONFIGS SHADOWED has showsThreatType false', VISIBILITY_CONFIGS.SHADOWED.showsThreatType === false);

  // ---- 8. INTERNAL_VISIBILITY_TO_ENVELOPE mapping ---------------------------
  check(
    'resolveEnvelopeLevel SHADOWED -> HIDDEN',
    adapter.resolveEnvelopeLevel(TENSION_VISIBILITY_STATE.SHADOWED) === 'HIDDEN',
  );
  check(
    'resolveEnvelopeLevel EXPOSED -> EXPOSED',
    adapter.resolveEnvelopeLevel(TENSION_VISIBILITY_STATE.EXPOSED) === 'EXPOSED',
  );

  // ---- 9. TENSION_CONSTANTS used --------------------------------------------
  check(
    'computeNormalizedScore 0.5 => 0.5',
    adapter.computeNormalizedScore(0.5) === 0.5 / TENSION_CONSTANTS.MAX_SCORE,
  );
  check(
    'TENSION_CONSTANTS.MAX_SCORE is 1',
    TENSION_CONSTANTS.MAX_SCORE === 1,
  );
  check(
    'TENSION_CONSTANTS.PULSE_THRESHOLD is 0.9',
    TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9,
  );

  // ---- 10. ML vector = 32 features ------------------------------------------
  const mlVec = adapter.computeMLVector(
    mockRuntimeSnapshot,
    allEntries,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    'T2',
    15,
  );
  check('ML vector feature count = 32', mlVec.features.length === ADAPTER_ML_FEATURE_COUNT);
  check('ML vector label count = 32', mlVec.labels.length === ADAPTER_ML_FEATURE_COUNT);
  check('ML vector tick = 15', mlVec.tick === 15);
  check(
    'ML vector feature[4] = PRESSURE_TENSION_AMPLIFIERS.T2',
    mlVec.features[4] === PRESSURE_TENSION_AMPLIFIERS.T2,
  );
  check('ML vector all features are numbers', mlVec.features.every((f) => typeof f === 'number'));

  // ---- 11. DL tensor = 16×8 -------------------------------------------------
  adapter.recordTickSample(15, adapted, 2, 1, TENSION_VISIBILITY_STATE.TELEGRAPHED);
  const dlTensor = adapter.extractDLTensor('T2', 15);
  check('DL tensor row count = 16', dlTensor.rows.length === ADAPTER_DL_SEQUENCE_LENGTH);
  check(
    'DL tensor feature width = 8',
    dlTensor.rows.every((r) => r.features.length === ADAPTER_DL_FEATURE_WIDTH),
  );
  check('DL tensor label count = 8', dlTensor.labels.length === ADAPTER_DL_FEATURE_WIDTH);

  // ---- 12. health report tiers ----------------------------------------------
  const healthReport = adapter.computeHealthReport(mockRuntimeSnapshot, allEntries);
  check('healthReport has riskTier', typeof healthReport.riskTier === 'string');
  check('healthReport.riskTier is HIGH (score 0.65)', healthReport.riskTier === 'HIGH');
  check('healthReport.adaptedCount = 5', healthReport.adaptedCount === 5);
  check('healthReport.arrivedCount = 1', healthReport.arrivedCount === 1);
  check('healthReport.activeCount = 2', healthReport.activeCount === 2);
  check('healthReport alerts is array', Array.isArray(healthReport.alerts));

  // ---- 13. narrative generation ---------------------------------------------
  const narrative = adapter.generateNarrative(
    mockRuntimeSnapshot,
    allEntries,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    'T2',
  );
  check('narrative has headline string', typeof narrative.headline === 'string');
  check('narrative.headline non-empty', narrative.headline.length > 0);
  check('narrative has body string', typeof narrative.body === 'string');
  check('narrative urgency is valid', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(narrative.urgency));
  check('narrative has mitigationSummary', typeof narrative.mitigationSummary === 'string');
  check(
    'narrative mitigationSummary references default mitigations',
    THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.DEBT_SPIRAL].some((m) =>
      narrative.mitigationSummary.includes(m),
    ),
  );

  // ---- 14. serialization roundtrip ------------------------------------------
  const serialized = adapter.serialize();
  check('serialized has totalAdaptations', typeof serialized.totalAdaptations === 'number');
  check('serialized has lastAdaptedTick', typeof serialized.lastAdaptedTick === 'number');
  check('serialized has checksum string', typeof serialized.checksum === 'string');
  check('serialized checksum length = 16', serialized.checksum.length === 16);
  check('serialized lastAdaptedTick = 15', serialized.lastAdaptedTick === 15);

  // ---- 15. standalone functions produce valid output ------------------------
  const standaloneState = adaptTensionState(mockRuntimeSnapshot, allEntries);
  check('adaptTensionState returns TensionState', typeof standaloneState.score === 'number');

  const standaloneEnvelopes = adaptThreatEnvelopes(
    allEntries,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    15,
  );
  check('adaptThreatEnvelopes returns array', Array.isArray(standaloneEnvelopes));

  const standaloneScore = computeAdaptedScore(mockRuntimeSnapshot);
  check('computeAdaptedScore returns number', typeof standaloneScore === 'number');
  check('computeAdaptedScore in [0,1]', standaloneScore >= 0 && standaloneScore <= 1);

  const standaloneQueueLength = computeAdaptedQueueLength(allEntries);
  check('computeAdaptedQueueLength = 2', standaloneQueueLength === 2);

  const standaloneFiltered = filterActiveForAdaptation(allEntries);
  check('filterActiveForAdaptation length = 2', standaloneFiltered.length === 2);

  const standaloneMLVec = computeAdapterMLVector(
    mockRuntimeSnapshot,
    allEntries,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    'T1',
    15,
  );
  check('computeAdapterMLVector features = 32', standaloneMLVec.features.length === 32);

  const standaloneHealthScore = computeAdaptationHealthScore(mockRuntimeSnapshot, allEntries);
  check('computeAdaptationHealthScore in [0,1]', standaloneHealthScore >= 0 && standaloneHealthScore <= 1);

  const standaloneRisk = classifyAdaptationRisk(0.65, 1);
  check('classifyAdaptationRisk returns string', typeof standaloneRisk === 'string');
  check('classifyAdaptationRisk 0.65 = HIGH', standaloneRisk === 'HIGH');

  const standaloneChatCtx = buildAdapterChatContext(
    mockRuntimeSnapshot,
    allEntries,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );
  check('buildAdapterChatContext returns object', typeof standaloneChatCtx === 'object');

  const standaloneMerged = mergeRunStateWithTension(mockRunState, standaloneState);
  check('mergeRunStateWithTension preserves runId', standaloneMerged.runId === 'run-abc-123');
  check('mergeRunStateWithTension sets tension', standaloneMerged.tension === standaloneState);

  // ---- 16. applyProcessResult -----------------------------------------------
  const mockQueueResult: QueueProcessResult = {
    newArrivals: [arrivedEntry],
    newExpirations: [expiredEntry],
    activeEntries: [baseEntry, arrivedEntry],
    relievedEntries: [mitigatedEntry],
  };

  const processOutput = adapter.applyProcessResult(mockQueueResult, 15);
  check('applyProcessResult arrivals is array', Array.isArray(processOutput.arrivals));
  check('applyProcessResult arrivals length = 1', processOutput.arrivals.length === 1);
  check('applyProcessResult expirations is array', Array.isArray(processOutput.expirations));

  // ---- 17. applyDecayResult -------------------------------------------------
  const mockDecayResult: DecayComputeResult = {
    rawDelta: -0.05,
    amplifiedDelta: -0.06,
    contributionBreakdown: mockContributionBreakdown,
  };

  const decayedScore = adapter.applyDecayResult(mockDecayResult, 0.5);
  check('applyDecayResult returns number', typeof decayedScore === 'number');
  check('applyDecayResult = 0.44', Math.abs(decayedScore - 0.44) < 1e-9);

  // ---- 18. enrichTensionStateWithDecay -------------------------------------
  const decayEnriched = adapter.enrichTensionStateWithDecay(adapted, mockDecayResult);
  check('enrichTensionStateWithDecay returns TensionState', typeof decayEnriched.score === 'number');
  check(
    'enrichTensionStateWithDecay score updated',
    Math.abs(decayEnriched.score - (adapted.score - 0.06)) < 1e-9,
  );

  // ---- 19. integrateQueueResult ---------------------------------------------
  const integratedRunState = adapter.integrateQueueResult(
    mockRunState,
    mockQueueResult,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    15,
  );
  check('integrateQueueResult runId preserved', integratedRunState.runId === 'run-abc-123');
  check('integrateQueueResult anticipation = 2', integratedRunState.tension.anticipation === 2);

  // ---- 20. visibilityOrdinal ------------------------------------------------
  check('visibilityOrdinal SHADOWED = 0', adapter.visibilityOrdinal(TENSION_VISIBILITY_STATE.SHADOWED) === 0);
  check('visibilityOrdinal EXPOSED = 3', adapter.visibilityOrdinal(TENSION_VISIBILITY_STATE.EXPOSED) === 3);

  // ---- 21. buildStateSyncEvent uses TENSION_EVENT_NAMES ---------------------
  const syncEvent = adapter.buildStateSyncEvent(15, adapted) as Record<string, unknown>;
  check('buildStateSyncEvent has eventType', typeof syncEvent['eventType'] === 'string');
  check(
    'buildStateSyncEvent eventType = tension.score.updated',
    syncEvent['eventType'] === TENSION_EVENT_NAMES.SCORE_UPDATED,
  );

  // ---- 22. computeAdapterChecksum uses createHash --------------------------
  const checksum = adapter.computeAdapterChecksum(adapted);
  check('computeAdapterChecksum returns string', typeof checksum === 'string');
  check('computeAdapterChecksum length = 16', checksum.length === 16);

  // ---- 23. classifyEnvelopeSeverity ----------------------------------------
  check(
    'classifyEnvelopeSeverity 0.2 = MINOR',
    adapter.classifyEnvelopeSeverity(0.2) === THREAT_SEVERITY.MINOR,
  );
  check(
    'classifyEnvelopeSeverity 1.0 = EXISTENTIAL',
    adapter.classifyEnvelopeSeverity(1.0) === THREAT_SEVERITY.EXISTENTIAL,
  );

  // ---- 24. computeSeverityDistribution keys all present --------------------
  const sevDist = adapter.computeSeverityDistribution(allEntries);
  check('severityDistribution has MINOR', THREAT_SEVERITY.MINOR in sevDist);
  check('severityDistribution has EXISTENTIAL', THREAT_SEVERITY.EXISTENTIAL in sevDist);

  // ---- 25. computeStateDistribution keys all present -----------------------
  const stateDist = adapter.computeStateDistribution(allEntries);
  check('stateDistribution has QUEUED', ENTRY_STATE.QUEUED in stateDist);
  check('stateDistribution has NULLIFIED', ENTRY_STATE.NULLIFIED in stateDist);
  check('stateDistribution.QUEUED = 1', stateDist[ENTRY_STATE.QUEUED] === 1);

  // ---- 26. groupAdaptedEntriesByType ---------------------------------------
  const grouped = adapter.groupAdaptedEntriesByType(allEntries);
  check('grouped DEBT_SPIRAL has 1 entry', grouped[THREAT_TYPE.DEBT_SPIRAL].length === 1);
  check('grouped CASCADE has 1 entry', grouped[THREAT_TYPE.CASCADE].length === 1);

  // ---- 27. sortThreatsByVisibility uses VISIBILITY_ORDER -------------------
  const envelopes = adapter.adaptThreatEnvelopes(
    [baseEntry, arrivedEntry],
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    15,
  );
  const sorted = adapter.sortThreatsByVisibility(envelopes);
  check('sortThreatsByVisibility returns array', Array.isArray(sorted));
  check('sortThreatsByVisibility length preserved', sorted.length === envelopes.length);

  // ---- 28. enrichEnvelopeWithAdvice uses THREAT_TYPE_DEFAULT_MITIGATIONS ---
  const enriched = adapter.enrichEnvelopeWithAdvice(
    baseEntry,
    TENSION_VISIBILITY_STATE.EXPOSED,
    15,
  );
  check('enrichEnvelopeWithAdvice has advice', Array.isArray(enriched.advice));
  check(
    'enrichEnvelopeWithAdvice DEBT_SPIRAL advice includes REFINANCE',
    (enriched.advice ?? []).includes('REFINANCE'),
  );

  // ---- 29. buildAnnotations -------------------------------------------------
  const annotation = adapter.buildAnnotations(mockRuntimeSnapshot, allEntries, 'T3');
  check('annotation has normalizedScore', typeof annotation.normalizedScore === 'number');
  check('annotation normalizedScore in [0,1]', annotation.normalizedScore >= 0 && annotation.normalizedScore <= 1);
  check('annotation has riskTier', typeof annotation.riskTier === 'string');
  check('annotation has severityDistribution', typeof annotation.severityDistribution === 'object');
  check('annotation has typeDistribution', typeof annotation.typeDistribution === 'object');

  // ---- 30. computeSessionSummary -------------------------------------------
  const summary = adapter.computeSessionSummary();
  check('sessionSummary has totalAdaptations', typeof summary.totalAdaptations === 'number');
  check('sessionSummary has peakScore', typeof summary.peakScore === 'number');
  check('sessionSummary has volatility', typeof summary.volatility === 'number');

  // ---- 31. exportBundle -----------------------------------------------------
  const bundle = adapter.exportBundle(
    mockRuntimeSnapshot,
    allEntries,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    'T2',
    15,
  );
  check('exportBundle has mlVector', typeof bundle.mlVector === 'object');
  check('exportBundle has dlTensor', typeof bundle.dlTensor === 'object');
  check('exportBundle has healthReport', typeof bundle.healthReport === 'object');
  check('exportBundle has narrative', typeof bundle.narrative === 'object');
  check('exportBundle has sessionSummary', typeof bundle.sessionSummary === 'object');
  check('exportBundle has serialized', typeof bundle.serialized === 'object');
  check(
    'exportBundle.mlVector feature count = 32',
    bundle.mlVector.features.length === ADAPTER_ML_FEATURE_COUNT,
  );
  check(
    'exportBundle.dlTensor row count = 16',
    bundle.dlTensor.rows.length === ADAPTER_DL_SEQUENCE_LENGTH,
  );

  // ---- 32. adaptStateWithAnnotation -----------------------------------------
  const { state: annState, annotation: ann } = adapter.adaptStateWithAnnotation(
    mockRuntimeSnapshot,
    allEntries,
    undefined,
    'T2',
  );
  check('adaptStateWithAnnotation state has score', typeof annState.score === 'number');
  check('adaptStateWithAnnotation annotation has riskTier', typeof ann.riskTier === 'string');

  return Object.freeze({
    passed: failures.length === 0,
    checks: Object.freeze([...checks]),
    failures: Object.freeze([...failures]),
  });
}
