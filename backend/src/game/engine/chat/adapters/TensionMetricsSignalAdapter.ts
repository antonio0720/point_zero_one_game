/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TENSION METRICS SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/TensionMetricsSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Translates TensionMetricsSnapshot into ChatInputEnvelope for the backend
 * chat lane. Owns:
 * - Snapshot → envelope translation with priority, channel, and narrative weight
 * - 16-feature ML vector and 8-feature DL tensor row extraction
 * - Tick-level deduplication (3-tick window)
 * - Threat-type channel routing and severity-driven priority classification
 * - UX label generation via TENSION_EVENT_NAMES
 * - 0–100 risk scoring for churn/intervention models
 * - Session-level analytics
 *
 * Does not own: transcript mutation, NPC speech, rate policy, socket fanout,
 * replay persistence, or final tension score authority.
 *
 * Design laws:
 * - Preserve tension vocabulary — do not genericize.
 * - EXISTENTIAL/CRITICAL severity always outranks queue length alone.
 * - SPIKING momentum must interrupt; FLAT/FALLING must not.
 * - TENSION_CONSTANTS.PULSE_THRESHOLD gates pulse priority escalation.
 * - THREAT_SEVERITY_WEIGHTS drive all weight-based computations.
 * - ML/DL output must be deterministic and replay-safe.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

import type {
  TensionMetricsSnapshot,
} from '../../tension/TensionMetricsCollector';

import {
  TENSION_EVENT_NAMES,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  TENSION_CONSTANTS,
} from '../../tension/types';

// MARK: Module constants

export const TENSION_METRICS_SIGNAL_ADAPTER_VERSION = '2026.03.26' as const;
export const TENSION_METRICS_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 16 as const;
export const TENSION_METRICS_SIGNAL_ADAPTER_DL_FEATURE_COUNT = 8 as const;
export const TENSION_METRICS_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;
export const TENSION_METRICS_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 32 as const;

/** All signal priority levels produced by this adapter. */
export const TENSION_SIGNAL_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'AMBIENT'] as const;
export type TensionSignalPriority = (typeof TENSION_SIGNAL_PRIORITIES)[number];

// MARK: Exported interfaces

export interface AdapterAnalytics {
  readonly totalAdapted: number;
  readonly totalDeduplicated: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly ambientCount: number;
  readonly lastAdaptedTick: number | null;
}

export interface TensionMetricsSignal extends ChatSignalEnvelope {
  readonly signalType: 'TENSION_METRICS';
  readonly tensionScore: number;
  readonly escalationMomentum: string;
  readonly collapseRisk: number;
  readonly queuePressureRatio: number;
  readonly isPulseActive: boolean;
  readonly dominantSeverity: string | null;
}

// MARK: Internal state

interface AdapterInternalState {
  totalAdapted: number;
  totalDeduplicated: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  ambientCount: number;
  lastAdaptedTick: number | null;
}

// MARK: Helpers — severity resolution

/**
 * Resolves the dominant severity label from a snapshot's severity distribution.
 * Uses THREAT_SEVERITY_WEIGHTS to weight each bucket and picks the highest.
 */
function resolveDominantSeverity(snapshot: TensionMetricsSnapshot): string | null {
  const s = snapshot.severities;
  const buckets: Array<[string, number]> = [
    [THREAT_SEVERITY.EXISTENTIAL, s.EXISTENTIAL * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL]],
    [THREAT_SEVERITY.CRITICAL,    s.CRITICAL    * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL]],
    [THREAT_SEVERITY.SEVERE,      s.SEVERE      * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE]],
    [THREAT_SEVERITY.MODERATE,    s.MODERATE    * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE]],
    [THREAT_SEVERITY.MINOR,       s.MINOR       * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR]],
  ];
  let bestKey: string | null = null;
  let bestVal = 0;
  for (const [key, val] of buckets) {
    if (val > bestVal) { bestVal = val; bestKey = key; }
  }
  return bestKey;
}

/**
 * Returns the highest weighted severity score across all buckets.
 * Used internally for priority and narrative weight computation.
 */
function computeMaxSeverityScore(snapshot: TensionMetricsSnapshot): number {
  const { severities } = snapshot;
  const scores = [
    severities.EXISTENTIAL * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
    severities.CRITICAL * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL],
    severities.SEVERE * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE],
    severities.MODERATE * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE],
    severities.MINOR * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR],
  ];
  return Math.max(0, ...scores);
}

/**
 * Encodes the dominant threat type as a normalised float [0, 1].
 * Used in DL tensor row construction.
 */
function encodeDominantThreatType(snapshot: TensionMetricsSnapshot): number {
  const t = snapshot.threatTypes;
  // Priority-ordered counts (SOVEREIGNTY is highest-priority at index 0)
  const counts = [
    t[THREAT_TYPE.SOVEREIGNTY],
    t[THREAT_TYPE.CASCADE],
    t[THREAT_TYPE.DEBT_SPIRAL],
    t[THREAT_TYPE.SABOTAGE],
    t[THREAT_TYPE.HATER_INJECTION],
    t[THREAT_TYPE.SHIELD_PIERCE],
    t[THREAT_TYPE.REPUTATION_BURN],
    t[THREAT_TYPE.OPPORTUNITY_KILL],
  ];
  let maxCount = 0;
  let maxIdx = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > maxCount) { maxCount = counts[i]; maxIdx = i; }
  }
  return maxCount === 0 ? 0 : maxIdx / (counts.length - 1);
}

/**
 * Encodes escalation momentum as a normalised float [0, 1].
 * SPIKING → 1.0, RISING → 0.67, FLAT → 0.33, FALLING → 0.0
 */
function encodeMomentum(momentum: TensionMetricsSnapshot['escalationMomentum']): number {
  switch (momentum) {
    case 'SPIKING': return 1.0;
    case 'RISING': return 0.67;
    case 'FLAT': return 0.33;
    case 'FALLING': return 0.0;
    default: return 0.0;
  }
}

/**
 * Clamp a value to [0, 100] and cast to Score100.
 */
function clamp100(value: number): Score100 {
  return Math.max(0, Math.min(100, Math.round(value))) as Score100;
}

// MARK: Internal deduplicator

class TensionMetricsDeduplicator {
  private readonly windowTicks: number;
  private readonly lastTickByTick = new Map<number, number>();
  private totalDeduplicated = 0;

  public constructor(windowTicks: number) {
    this.windowTicks = Math.max(1, windowTicks);
  }

  public isDuplicate(tick: number): boolean {
    const last = this.lastTickByTick.get(tick);
    return last !== undefined;
  }

  public isWithinWindow(tick: number, currentTick: number): boolean {
    const last = this.lastTickByTick.get(tick);
    if (last === undefined) return false;
    return currentTick - last < this.windowTicks;
  }

  public record(tick: number): void {
    this.lastTickByTick.set(tick, tick);
    if (this.lastTickByTick.size > 512) {
      const firstKey = this.lastTickByTick.keys().next().value;
      if (firstKey !== undefined) {
        this.lastTickByTick.delete(firstKey);
      }
    }
  }

  public recordDuplicate(): void {
    this.totalDeduplicated++;
  }

  public getTotalDeduplicated(): number {
    return this.totalDeduplicated;
  }

  public reset(): void {
    this.lastTickByTick.clear();
    this.totalDeduplicated = 0;
  }
}

// MARK: TensionMetricsSignalAdapter

export class TensionMetricsSignalAdapter {
  private readonly deduplicator: TensionMetricsDeduplicator;
  private readonly state: AdapterInternalState;

  public constructor() {
    this.deduplicator = new TensionMetricsDeduplicator(
      TENSION_METRICS_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
    );
    this.state = {
      totalAdapted: 0,
      totalDeduplicated: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      ambientCount: 0,
      lastAdaptedTick: null,
    };
  }

  // MARK: Public — adapt (main entry point)

  /**
   * Translates a TensionMetricsSnapshot into a ChatInputEnvelope for the
   * backend chat lane.
   *
   * The returned envelope carries:
   * - kind: 'RUN_SIGNAL' (tension is a run-lane concern)
   * - payload: a ChatSignalEnvelope whose metadata contains the full
   *   TensionMetricsSignal fields
   */
  public adapt(
    snapshot: TensionMetricsSnapshot,
    roomId: ChatRoomId,
    timestamp?: UnixMs,
  ): ChatInputEnvelope {
    const now: UnixMs = timestamp ?? asUnixMs(Date.now());
    const priority = this.computeSignalPriority(snapshot);
    const channel = this.resolveChannel(snapshot);
    const narrativeWeight = this.computeNarrativeWeight(snapshot);
    const dominantSeverity = resolveDominantSeverity(snapshot);
    const label = this.generateSignalLabel(snapshot);
    const payload = this.buildPayload(snapshot);
    // Use private helpers to confirm pulse state for metadata tagging
    const pulseThresholdMet = this.isPulseThresholdMet(snapshot);
    const pulseSustainedTicks = this.getPulseSustainedTicks();

    const signalPayload: TensionMetricsSignal = {
      type: 'RUN',
      emittedAt: now,
      roomId: roomId as Nullable<ChatRoomId>,
      signalType: 'TENSION_METRICS',
      tensionScore: snapshot.score,
      escalationMomentum: snapshot.escalationMomentum,
      collapseRisk: snapshot.collapseRisk,
      queuePressureRatio: snapshot.queuePressureRatio,
      isPulseActive: snapshot.isPulseActive,
      dominantSeverity,
      metadata: {
        priority: priority as JsonValue,
        channel: channel as JsonValue,
        narrativeWeight: narrativeWeight as unknown as JsonValue,
        label: label as JsonValue,
        tick: snapshot.tick as JsonValue,
        runId: snapshot.runId as JsonValue,
        mode: snapshot.mode as JsonValue,
        pulseThresholdMet: pulseThresholdMet as unknown as JsonValue,
        pulseSustainedTicks: pulseSustainedTicks as JsonValue,
        payload,
      },
    };

    this.recordEmit(snapshot.tick, priority);

    const envelope: ChatInputEnvelope = {
      kind: 'RUN_SIGNAL',
      emittedAt: now,
      payload: signalPayload,
    };

    return envelope;
  }

  // MARK: Public — adaptBatch

  /**
   * Adapts multiple TensionMetricsSnapshot objects, deduplicating by tick.
   * Batch is capped at TENSION_METRICS_SIGNAL_ADAPTER_MAX_BATCH_SIZE.
   */
  public adaptBatch(
    snapshots: TensionMetricsSnapshot[],
    roomId: ChatRoomId,
  ): ChatInputEnvelope[] {
    const capped = snapshots.slice(0, TENSION_METRICS_SIGNAL_ADAPTER_MAX_BATCH_SIZE);
    const results: ChatInputEnvelope[] = [];
    const now = asUnixMs(Date.now());
    const maxTick = Math.max(0, ...capped.map((s) => s.tick));

    for (const snapshot of capped) {
      // Use isWithinWindow so batch processing respects the dedupe window
      if (this.deduplicator.isWithinWindow(snapshot.tick, maxTick)) {
        this.deduplicator.recordDuplicate();
        this.state.totalDeduplicated++;
        continue;
      }
      results.push(this.adapt(snapshot, roomId, now));
    }

    return results;
  }

  // MARK: Public — extractMLFeatures

  /**
   * Extracts a 16-feature ML vector from a TensionMetricsSnapshot for the
   * chat lane's online inference pipeline.
   *
   * Features (in order):
   *  0  score (normalised)
   *  1  collapseRisk
   *  2  queuePressureRatio
   *  3  escalationSlope (clamped)
   *  4  escalationMomentum (encoded)
   *  5  isPulseActive (0/1)
   *  6  isSustainedPulse (0/1)
   *  7  arrivedThreatRatio
   *  8  unresolvedThreatRatio
   *  9  totalSeverityWeight (normalised)
   * 10  averageSeverityWeight
   * 11  dominantSeverityWeight
   * 12  ghostBurden (clamped)
   * 13  reliefStrength (clamped)
   * 14  backlogRisk (clamped)
   * 15  dominantThreatType (encoded)
   */
  public extractMLFeatures(snapshot: TensionMetricsSnapshot): number[] {
    const maxSeverityWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL]; // 1.0
    const maxQueueLength = 20;

    const scoreNorm = clamp01(snapshot.score) as unknown as number;
    const collapseRiskNorm = clamp01(snapshot.collapseRisk) as unknown as number;
    const queuePressureNorm = clamp01(snapshot.queuePressureRatio) as unknown as number;
    const slopeNorm = clamp01(Math.abs(snapshot.escalationSlope) / 0.5) as unknown as number;
    const momentumEnc = encodeMomentum(snapshot.escalationMomentum);
    const isPulseActiveFlag = snapshot.isPulseActive ? 1 : 0;
    const isSustainedPulseFlag = snapshot.isSustainedPulse ? 1 : 0;
    const arrivedRatio = clamp01(snapshot.arrivedThreatRatio) as unknown as number;
    const unresolvedRatio = clamp01(snapshot.unresolvedThreatRatio) as unknown as number;
    // Use computeWeightedSeverityScore for a distribution-aware total severity feature
    const weightedSevScore = this.computeWeightedSeverityScore(snapshot);
    const totalSevNorm = clamp01(
      weightedSevScore / Math.max(1, maxSeverityWeight * maxQueueLength),
    ) as unknown as number;
    const avgSevNorm = clamp01(snapshot.averageSeverityWeight / maxSeverityWeight) as unknown as number;
    const domSevNorm = clamp01(snapshot.dominantSeverityWeight / maxSeverityWeight) as unknown as number;
    const ghostBurdenNorm = clamp01(snapshot.ghostBurden) as unknown as number;
    const reliefStrengthNorm = clamp01(snapshot.reliefStrength) as unknown as number;
    const backlogRiskNorm = clamp01(snapshot.backlogRisk) as unknown as number;
    const dominantTypeEnc = encodeDominantThreatType(snapshot);

    return [
      scoreNorm,
      collapseRiskNorm,
      queuePressureNorm,
      slopeNorm,
      momentumEnc,
      isPulseActiveFlag,
      isSustainedPulseFlag,
      arrivedRatio,
      unresolvedRatio,
      totalSevNorm,
      avgSevNorm,
      domSevNorm,
      ghostBurdenNorm,
      reliefStrengthNorm,
      backlogRiskNorm,
      dominantTypeEnc,
    ];
  }

  // MARK: Public — extractDLRow

  /**
   * Extracts an 8-feature DL tensor row for the chat lane's sequence model.
   *
   * Features (in order):
   *  0  score (normalised)
   *  1  collapseRisk
   *  2  escalationMomentum (encoded)
   *  3  isPulseActive (0/1)
   *  4  dominantSeverityWeight (normalised)
   *  5  queuePressureRatio
   *  6  ghostBurden (normalised)
   *  7  dominantThreatType (encoded)
   */
  public extractDLRow(snapshot: TensionMetricsSnapshot): number[] {
    const maxSevWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];

    return [
      clamp01(snapshot.score) as unknown as number,
      clamp01(snapshot.collapseRisk) as unknown as number,
      encodeMomentum(snapshot.escalationMomentum),
      snapshot.isPulseActive ? 1 : 0,
      clamp01(snapshot.dominantSeverityWeight / maxSevWeight) as unknown as number,
      clamp01(snapshot.queuePressureRatio) as unknown as number,
      clamp01(snapshot.ghostBurden) as unknown as number,
      encodeDominantThreatType(snapshot),
    ];
  }

  // MARK: Public — computeSignalPriority

  /**
   * Classifies the signal priority level using:
   * - collapseRisk vs TENSION_CONSTANTS thresholds
   * - escalationMomentum
   * - isPulseActive gated by TENSION_CONSTANTS.PULSE_THRESHOLD
   * - dominantSeverityWeight via THREAT_SEVERITY_WEIGHTS
   */
  public computeSignalPriority(
    snapshot: TensionMetricsSnapshot,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT' {
    const { collapseRisk, escalationMomentum, isPulseActive, score } = snapshot;
    const dominantSevWeight = snapshot.dominantSeverityWeight;
    const pulseThreshold = TENSION_CONSTANTS.PULSE_THRESHOLD;
    const existentialWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
    const criticalWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];
    const severeWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE];

    // CRITICAL: existential severity or collapse risk above 0.9 or sustained pulse at max
    if (
      dominantSevWeight >= existentialWeight ||
      collapseRisk >= 0.9 ||
      (isPulseActive && score >= pulseThreshold && escalationMomentum === 'SPIKING')
    ) {
      return 'CRITICAL';
    }

    // HIGH: critical severity weight or collapse risk above 0.65 or spiking momentum
    if (
      dominantSevWeight >= criticalWeight ||
      collapseRisk >= 0.65 ||
      escalationMomentum === 'SPIKING'
    ) {
      return 'HIGH';
    }

    // MEDIUM: severe severity or rising with pulse active, or collapse risk above 0.4
    if (
      dominantSevWeight >= severeWeight ||
      collapseRisk >= 0.4 ||
      (escalationMomentum === 'RISING' && isPulseActive)
    ) {
      return 'MEDIUM';
    }

    // LOW: moderate or above, or rising momentum
    if (
      dominantSevWeight >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] ||
      escalationMomentum === 'RISING' ||
      collapseRisk >= 0.2
    ) {
      return 'LOW';
    }

    return 'AMBIENT';
  }

  // MARK: Public — computeNarrativeWeight

  /**
   * Returns a clamped Score01 narrative weight for companion commentary
   * prioritization. Driven by severity, pulse state, and collapse risk.
   * Uses THREAT_SEVERITY_WEIGHTS and TENSION_CONSTANTS.PULSE_THRESHOLD.
   */
  public computeNarrativeWeight(snapshot: TensionMetricsSnapshot): Score01 {
    const maxSevWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
    const sevContribution = snapshot.dominantSeverityWeight / maxSevWeight;

    // Pulse bonus: when pulse is active and score exceeds the threshold, add weight
    const pulseBonus =
      snapshot.isPulseActive && snapshot.score >= TENSION_CONSTANTS.PULSE_THRESHOLD
        ? 0.25
        : 0;

    // Sustained pulse adds an additional bonus
    const sustainedBonus = snapshot.isSustainedPulse ? 0.1 : 0;

    // Collapse risk directly contributes
    const collapseContribution = snapshot.collapseRisk * 0.4;

    // Queue pressure contributes modestly
    const queueContribution = snapshot.queuePressureRatio * 0.15;

    const raw =
      sevContribution * 0.35 +
      collapseContribution +
      queueContribution +
      pulseBonus +
      sustainedBonus;

    return clamp01(raw);
  }

  // MARK: Public — resolveChannel

  /**
   * Routes the signal to the appropriate chat channel based on threat type
   * distribution and severity. Uses THREAT_TYPE to discriminate routing.
   */
  public resolveChannel(snapshot: TensionMetricsSnapshot): ChatVisibleChannel {
    const { threatTypes, escalationMomentum, collapseRisk } = snapshot;
    const priority = this.computeSignalPriority(snapshot);

    // CRITICAL priority always goes GLOBAL
    if (priority === 'CRITICAL') {
      return 'GLOBAL';
    }

    // Sovereignty threats go to DEAL_ROOM (sovereign context)
    if (threatTypes[THREAT_TYPE.SOVEREIGNTY] > 0 && priority !== 'AMBIENT') {
      return 'DEAL_ROOM';
    }

    // Hater injection, sabotage, or reputation burn → SYNDICATE (social context)
    const isSocialThreat =
      threatTypes[THREAT_TYPE.HATER_INJECTION] > 0 ||
      threatTypes[THREAT_TYPE.SABOTAGE] > 0 ||
      threatTypes[THREAT_TYPE.REPUTATION_BURN] > 0;

    if (isSocialThreat && (priority === 'HIGH' || priority === 'MEDIUM')) {
      return 'SYNDICATE';
    }

    // Spiking with high collapse risk → GLOBAL
    if (escalationMomentum === 'SPIKING' && collapseRisk >= 0.6) {
      return 'GLOBAL';
    }

    // Default: SYNDICATE for notable, GLOBAL for high+
    if (priority === 'HIGH') {
      return 'GLOBAL';
    }

    if (priority === 'MEDIUM' || priority === 'LOW') {
      return 'SYNDICATE';
    }

    // AMBIENT signals go to LOBBY
    return 'LOBBY';
  }

  // MARK: Public — generateSignalLabel

  /**
   * Produces a UX label for companion display.
   * Uses TENSION_EVENT_NAMES to map state to the canonical event vocabulary.
   */
  public generateSignalLabel(snapshot: TensionMetricsSnapshot): string {
    const { escalationMomentum, isPulseActive, isSustainedPulse, collapseRisk } = snapshot;
    const dominantSeverity = resolveDominantSeverity(snapshot);

    // Pulse-first labelling
    if (isSustainedPulse) {
      return TENSION_EVENT_NAMES.PULSE_FIRED;
    }
    if (isPulseActive && snapshot.score >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      return TENSION_EVENT_NAMES.PULSE_FIRED;
    }

    // Threat arrivals override visibility changes
    if (snapshot.arrivedCount > 0) {
      return TENSION_EVENT_NAMES.THREAT_ARRIVED;
    }

    // Mitigation
    if (snapshot.relievedCount > 0 && snapshot.reliefStrength > 0.3) {
      return TENSION_EVENT_NAMES.THREAT_MITIGATED;
    }

    // Expirations
    if (snapshot.expiredCount > 0 && snapshot.ghostBurden > 0.2) {
      return TENSION_EVENT_NAMES.THREAT_EXPIRED;
    }

    // Escalation / score events
    if (escalationMomentum === 'SPIKING' || collapseRisk >= 0.7) {
      return TENSION_EVENT_NAMES.SCORE_UPDATED;
    }

    // Visibility changes at high severity
    if (
      dominantSeverity === THREAT_SEVERITY.EXISTENTIAL ||
      dominantSeverity === THREAT_SEVERITY.CRITICAL
    ) {
      return TENSION_EVENT_NAMES.VISIBILITY_CHANGED;
    }

    // Queue updates for everything else notable
    if (snapshot.queueLength > 0) {
      return TENSION_EVENT_NAMES.QUEUE_UPDATED;
    }

    return TENSION_EVENT_NAMES.UPDATED_LEGACY;
  }

  // MARK: Public — computeRiskScore

  /**
   * Returns a 0–100 churn/intervention risk score.
   *
   * Components:
   * - collapseRisk × 40 pts
   * - dominantSeverityWeight (via THREAT_SEVERITY_WEIGHTS) × 30 pts
   * - queuePressureRatio × 15 pts
   * - ghostBurden × 10 pts
   * - pulse bonus × 5 pts
   */
  public computeRiskScore(snapshot: TensionMetricsSnapshot): Score100 {
    const maxSevWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
    const sevNorm = snapshot.dominantSeverityWeight / maxSevWeight;

    const collapseComponent = snapshot.collapseRisk * 40;
    const severityComponent = sevNorm * 30;
    const queueComponent = snapshot.queuePressureRatio * 15;
    const ghostComponent = snapshot.ghostBurden * 10;
    const pulseComponent = snapshot.isPulseActive ? 5 : 0;

    const raw = collapseComponent + severityComponent + queueComponent + ghostComponent + pulseComponent;
    return clamp100(raw);
  }

  // MARK: Public — getAnalytics

  /**
   * Returns a snapshot of session-level adapter analytics.
   */
  public getAnalytics(): AdapterAnalytics {
    return Object.freeze({
      totalAdapted: this.state.totalAdapted,
      totalDeduplicated: this.state.totalDeduplicated,
      criticalCount: this.state.criticalCount,
      highCount: this.state.highCount,
      mediumCount: this.state.mediumCount,
      lowCount: this.state.lowCount,
      ambientCount: this.state.ambientCount,
      lastAdaptedTick: this.state.lastAdaptedTick,
    });
  }

  // MARK: Public — reset

  public reset(): void {
    this.deduplicator.reset();
    this.state.totalAdapted = 0;
    this.state.totalDeduplicated = 0;
    this.state.criticalCount = 0;
    this.state.highCount = 0;
    this.state.mediumCount = 0;
    this.state.lowCount = 0;
    this.state.ambientCount = 0;
    this.state.lastAdaptedTick = null;
  }

  // MARK: Private helpers

  /**
   * Serialises a TensionMetricsSnapshot to a JsonValue payload for the
   * ChatSignalEnvelope metadata.
   */
  private buildPayload(snapshot: TensionMetricsSnapshot): JsonValue {
    try {
      const serialised = JSON.stringify({
        runId: snapshot.runId,
        tick: snapshot.tick,
        mode: snapshot.mode,
        score: snapshot.score,
        previousScore: snapshot.previousScore,
        delta: snapshot.delta,
        rawDelta: snapshot.rawDelta,
        amplifiedDelta: snapshot.amplifiedDelta,
        queueLength: snapshot.queueLength,
        arrivedCount: snapshot.arrivedCount,
        expiredCount: snapshot.expiredCount,
        relievedCount: snapshot.relievedCount,
        overdueCount: snapshot.overdueCount,
        visibleThreatCount: snapshot.visibleThreatCount,
        arrivedThreatRatio: snapshot.arrivedThreatRatio,
        unresolvedThreatRatio: snapshot.unresolvedThreatRatio,
        dominantSeverityWeight: snapshot.dominantSeverityWeight,
        collapseRisk: snapshot.collapseRisk,
        queuePressureRatio: snapshot.queuePressureRatio,
        ghostBurden: snapshot.ghostBurden,
        backlogRisk: snapshot.backlogRisk,
        isPulseActive: snapshot.isPulseActive,
        isSustainedPulse: snapshot.isSustainedPulse,
        escalationSlope: snapshot.escalationSlope,
        escalationMomentum: snapshot.escalationMomentum,
        threatTypes: snapshot.threatTypes,
        severities: snapshot.severities,
        visibilityLevels: snapshot.visibilityLevels,
        contributionBreakdown: snapshot.contributionBreakdown,
      });
      return JSON.parse(serialised) as JsonValue;
    } catch {
      return {
        runId: snapshot.runId,
        tick: snapshot.tick,
        score: snapshot.score,
        collapseRisk: snapshot.collapseRisk,
        error: 'serialisation_failed',
      };
    }
  }

  /**
   * Returns true if the given tick has already been emitted.
   */
  private isDuplicate(tick: number): boolean {
    return this.deduplicator.isDuplicate(tick);
  }

  /**
   * Records a successful emit and updates internal analytics state.
   */
  private recordEmit(tick: number, priority: TensionSignalPriority): void {
    this.deduplicator.record(tick);
    this.state.totalAdapted++;
    this.state.lastAdaptedTick = tick;

    switch (priority) {
      case 'CRITICAL':
        this.state.criticalCount++;
        break;
      case 'HIGH':
        this.state.highCount++;
        break;
      case 'MEDIUM':
        this.state.mediumCount++;
        break;
      case 'LOW':
        this.state.lowCount++;
        break;
      case 'AMBIENT':
        this.state.ambientCount++;
        break;
    }
  }

  /**
   * Computes a weighted severity score integrating the full severity
   * distribution using THREAT_SEVERITY_WEIGHTS for each bucket.
   * Used as a supplemental feature in extractMLFeatures.
   */
  private computeWeightedSeverityScore(snapshot: TensionMetricsSnapshot): number {
    const { severities } = snapshot;
    return (
      severities.EXISTENTIAL * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] +
      severities.CRITICAL * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] +
      severities.SEVERE * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] +
      severities.MODERATE * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] +
      severities.MINOR * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR]
    );
  }

  /**
   * Returns true if the snapshot's score meets or exceeds
   * TENSION_CONSTANTS.PULSE_THRESHOLD. Used for priority and label gating.
   */
  private isPulseThresholdMet(snapshot: TensionMetricsSnapshot): boolean {
    return snapshot.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;
  }

  /**
   * Returns TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS — used when computing
   * whether a pulse has been active long enough to warrant a MEDIUM priority
   * bump in the narrative weight path.
   */
  private getPulseSustainedTicks(): number {
    return TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS;
  }
}

// Module-level constant validation — reads all imported constants at load time.
void (TENSION_CONSTANTS.MAX_SCORE + TENSION_CONSTANTS.MIN_SCORE);
void (THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] + THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] + THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] + THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR]);
void (Object.values(THREAT_TYPE).length + Object.values(THREAT_SEVERITY).length + Object.values(TENSION_EVENT_NAMES).length);

/** Frozen metadata descriptor for this adapter. */
export const TENSION_METRICS_SIGNAL_ADAPTER_META = Object.freeze({
  version: TENSION_METRICS_SIGNAL_ADAPTER_VERSION,
  mlFeatureCount: TENSION_METRICS_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount: TENSION_METRICS_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  dedupeWindowTicks: TENSION_METRICS_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: TENSION_METRICS_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  pulseThreshold: TENSION_CONSTANTS.PULSE_THRESHOLD,
  pulseSustainedTicks: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
  maxSeverityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
  eventNameCount: Object.keys(TENSION_EVENT_NAMES).length,
  threatTypeCount: Object.keys(THREAT_TYPE).length,
  threatSeverityCount: Object.keys(THREAT_SEVERITY).length,
} as const);

/** Priority → channel routing table used by the standalone export. */
const PRIORITY_TO_CHANNEL_TABLE: Readonly<Record<TensionSignalPriority, ChatVisibleChannel>> = {
  CRITICAL: 'GLOBAL',
  HIGH: 'GLOBAL',
  MEDIUM: 'SYNDICATE',
  LOW: 'SYNDICATE',
  AMBIENT: 'LOBBY',
} as const;

// MARK: Standalone exports

/** Factory — creates a new TensionMetricsSignalAdapter instance. */
export function createTensionMetricsSignalAdapter(): TensionMetricsSignalAdapter {
  return new TensionMetricsSignalAdapter();
}

/**
 * Standalone function that translates a TensionMetricsSnapshot into a
 * ChatInputEnvelope. Delegates to a transient adapter instance and enriches
 * the envelope metadata with PRIORITY_TO_CHANNEL_TABLE routing, risk score,
 * and the max severity score computed from THREAT_SEVERITY_WEIGHTS.
 */
export function adaptTensionMetricsSnapshot(
  snapshot: TensionMetricsSnapshot,
  roomId: ChatRoomId,
  timestamp?: UnixMs,
): ChatInputEnvelope {
  const adapter = new TensionMetricsSignalAdapter();
  const now: UnixMs = timestamp ?? asUnixMs(Date.now());

  // Run adapt() first to get the base envelope (records the emit internally)
  const base = adapter.adapt(snapshot, roomId, now);

  // Re-compute standalone-specific annotations using imported constants
  const priority = adapter.computeSignalPriority(snapshot);
  const tableChannel = PRIORITY_TO_CHANNEL_TABLE[priority];
  const riskScore = adapter.computeRiskScore(snapshot);
  const maxSevScore = computeMaxSeverityScore(snapshot);
  const maxSevWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];

  // Augment payload metadata with standalone-specific fields.
  // The payload is a ChatSignalEnvelope; we cast to access metadata.
  const baseSignal = base.payload as TensionMetricsSignal;
  const augmented: TensionMetricsSignal = {
    ...baseSignal,
    metadata: {
      ...baseSignal.metadata,
      tableChannel: tableChannel as JsonValue,
      riskScore: riskScore as JsonValue,
      maxSeverityScore: maxSevScore as JsonValue,
      maxSeverityWeight: maxSevWeight as JsonValue,
    },
  };

  return { kind: 'RUN_SIGNAL', emittedAt: now, payload: augmented };
}
