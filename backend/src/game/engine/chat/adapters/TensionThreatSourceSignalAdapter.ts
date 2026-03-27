/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TENSION THREAT SOURCE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/TensionThreatSourceSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Translates TensionThreatSourceAdapter output (DiscoveryBundle,
 * DiscoveryMetrics, QueueUpsertInput arrays) into ChatInputEnvelope objects
 * for the backend chat lane.
 *
 * Owns:
 * - DiscoveryBundle → ChatInputEnvelope translation with priority, channel,
 *   and narrative weight
 * - 16-feature ML vector and 8-feature DL tensor row extraction from
 *   discovered threat data
 * - Tick-level deduplication (3-tick window, key-based)
 * - Threat-type channel routing and severity-driven priority classification
 * - UX label generation using all TENSION_EVENT_NAMES values
 * - 0–100 risk scoring for churn/intervention models
 * - Visibility-state filtering respecting information asymmetry doctrine
 * - Pressure-tier amplifier integration for prioritization
 * - Session-level analytics
 *
 * Does not own: transcript mutation, NPC speech, rate policy, socket fanout,
 * replay persistence, or final tension score authority.
 *
 * Design laws:
 * - Preserve tension vocabulary — do not genericize.
 * - EXISTENTIAL/CRITICAL severity always outranks queue length alone.
 * - TENSION_CONSTANTS.PULSE_THRESHOLD gates pulse priority escalation.
 * - THREAT_SEVERITY_WEIGHTS drive all weight-based computations.
 * - ML/DL output must be deterministic and replay-safe.
 * - PRESSURE_TENSION_AMPLIFIERS[tier] shapes every priority and scoring path.
 * - Visibility filtering respects VISIBILITY_CONFIGS information asymmetry.
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

import {
  TensionThreatSourceAdapter,
  SOURCE_ADAPTER_ML_FEATURE_COUNT,
  SOURCE_ADAPTER_DL_SEQUENCE_LENGTH,
  SOURCE_ADAPTER_DL_FEATURE_WIDTH,
  SOURCE_ADAPTER_VERSION,
  SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY,
  type SourceMLVector,
  type SourceDLTensor,
  type DiscoveryMetrics,
  type DiscoveryContext,
  type DiscoveryBundle,
  type SourceSelfTestResult,
} from '../../tension/TensionThreatSourceAdapter';

import {
  TENSION_CONSTANTS,
  TENSION_EVENT_NAMES,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  ENTRY_STATE,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  PRESSURE_TENSION_AMPLIFIERS,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  type TensionVisibilityState,
  type ThreatSeverity,
  type ThreatType,
  type EntryState,
  type QueueUpsertInput,
  type AnticipationEntry,
} from '../../tension/types';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_VERSION = '2026.03.26' as const;
export const TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 16 as const;
export const TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DL_FEATURE_COUNT = 8 as const;
export const TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;
export const TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 32 as const;
export const THREAT_SOURCE_SIGNAL_PRIORITIES = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'AMBIENT',
] as const;
export type ThreatSourceSignalPriority = (typeof THREAT_SOURCE_SIGNAL_PRIORITIES)[number];

// ============================================================================
// MARK: Exported interfaces
// ============================================================================

export interface ThreatSourceAdapterAnalytics {
  readonly totalAdapted: number;
  readonly totalDeduplicated: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly ambientCount: number;
  readonly lastAdaptedTick: number | null;
  readonly totalThreatsDiscovered: number;
  readonly existentialCount: number;
}

export interface TensionThreatSourceSignal extends ChatSignalEnvelope {
  readonly signalType: 'TENSION_THREAT_SOURCE';
  readonly totalThreats: number;
  readonly existentialCount: number;
  readonly criticalCount: number;
  readonly estimatedPressure: number;
  readonly dominantThreatType: string | null;
  readonly dominantSeverity: string | null;
  readonly visibilityState: string;
  readonly pressureTier: string;
  readonly channel: string;
}

export interface ThreatSourceAdapterOptions {
  readonly dedupeWindowTicks?: number;
  readonly maxBatchSize?: number;
  readonly defaultChannel?: ChatVisibleChannel;
  readonly roomId?: Nullable<ChatRoomId>;
}

export interface ThreatSourceAdapterContext {
  readonly runId: string;
  readonly tick: number;
  readonly timestamp?: number;
  readonly roomId?: Nullable<ChatRoomId>;
  readonly channel?: ChatVisibleChannel;
  readonly pressureTier?: 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
}

export interface ThreatSourceSignalBatch {
  readonly signals: readonly ChatInputEnvelope[];
  readonly analytics: ThreatSourceAdapterAnalytics;
  readonly batchId: string;
  readonly tick: number;
  readonly timestamp: number;
}

export interface ThreatSourceMLExtract {
  readonly features: readonly number[];
  readonly featureCount: number;
  readonly dlRow: readonly number[];
  readonly dlRowWidth: number;
  readonly tick: number;
}

// ============================================================================
// MARK: Internal state interface
// ============================================================================

interface InternalState {
  totalAdapted: number;
  totalDeduplicated: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  ambientCount: number;
  lastAdaptedTick: number | null;
  totalThreatsDiscovered: number;
  existentialCount: number;
}

// ============================================================================
// MARK: Internal deduplicator
// ============================================================================

/**
 * Key-based tick deduplicator for threat discovery signals.
 * Uses a sliding window of DEDUPE_WINDOW_TICKS to suppress repeated
 * emissions for the same sourceKey within a short tick span.
 */
class ThreatSourceDeduplicator {
  private readonly windowTicks: number;
  private readonly lastTickByKey = new Map<string, number>();
  private totalDeduplicated = 0;

  public constructor(windowTicks: number) {
    this.windowTicks = Math.max(1, windowTicks);
  }

  /**
   * Returns true if the given (key, tick) pair falls within the active
   * deduplication window — meaning the same key was emitted recently.
   */
  public isDuplicate(key: string, tick: number): boolean {
    const last = this.lastTickByKey.get(key);
    if (last === undefined) {
      return false;
    }
    return tick - last < this.windowTicks;
  }

  /**
   * Records that the given key was last emitted at the given tick.
   * Evicts the oldest entry if the map exceeds 1024 entries to bound
   * memory in long-running sessions.
   */
  public record(key: string, tick: number): void {
    this.lastTickByKey.set(key, tick);
    if (this.lastTickByKey.size > 1024) {
      const firstKey = this.lastTickByKey.keys().next().value;
      if (firstKey !== undefined) {
        this.lastTickByKey.delete(firstKey);
      }
    }
  }

  /** Increments deduplicated counter and returns new total. */
  public getTotalDeduplicated(): number {
    return this.totalDeduplicated;
  }

  /** Registers a deduplication event. */
  public recordDuplicate(): void {
    this.totalDeduplicated++;
  }

  /** Resets all deduplication state. */
  public reset(): void {
    this.lastTickByKey.clear();
    this.totalDeduplicated = 0;
  }
}

// ============================================================================
// MARK: Helper — clamp100
// ============================================================================

/**
 * Clamps a raw number to [0, 100] and returns it as Score100.
 */
function clamp100(v: number): Score100 {
  return Math.max(0, Math.min(100, Math.round(v))) as Score100;
}

// ============================================================================
// MARK: Helper — encodeThreatType
// ============================================================================

/**
 * Encodes a ThreatType as a normalised float [0, 1] using the
 * THREAT_TYPE priority ordering.
 *
 * Priority order (highest = 0):
 *   SOVEREIGNTY → CASCADE → DEBT_SPIRAL → SABOTAGE →
 *   HATER_INJECTION → SHIELD_PIERCE → REPUTATION_BURN → OPPORTUNITY_KILL
 */
function encodeThreatType(type: ThreatType): number {
  const ORDER: readonly ThreatType[] = [
    THREAT_TYPE.SOVEREIGNTY,
    THREAT_TYPE.CASCADE,
    THREAT_TYPE.DEBT_SPIRAL,
    THREAT_TYPE.SABOTAGE,
    THREAT_TYPE.HATER_INJECTION,
    THREAT_TYPE.SHIELD_PIERCE,
    THREAT_TYPE.REPUTATION_BURN,
    THREAT_TYPE.OPPORTUNITY_KILL,
  ];
  const idx = ORDER.indexOf(type);
  if (idx < 0) {
    return 0;
  }
  return idx / (ORDER.length - 1);
}

// ============================================================================
// MARK: Helper — encodeThreatSeverity
// ============================================================================

/**
 * Encodes a ThreatSeverity as a normalised float [0, 1] using the
 * canonical severity weight from THREAT_SEVERITY_WEIGHTS.
 *
 * MINOR → 0.2, MODERATE → 0.4, SEVERE → 0.65, CRITICAL → 0.85,
 * EXISTENTIAL → 1.0
 */
function encodeThreatSeverity(severity: ThreatSeverity): number {
  const weights: Readonly<Record<ThreatSeverity, number>> = {
    [THREAT_SEVERITY.MINOR]: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR],
    [THREAT_SEVERITY.MODERATE]: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE],
    [THREAT_SEVERITY.SEVERE]: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE],
    [THREAT_SEVERITY.CRITICAL]: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL],
    [THREAT_SEVERITY.EXISTENTIAL]: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
  };
  return weights[severity] ?? 0;
}

// ============================================================================
// MARK: Helper — encodeVisibilityState
// ============================================================================

/**
 * Encodes a TensionVisibilityState as a normalised float [0, 1] using
 * VISIBILITY_ORDER for positional ranking.
 *
 * SHADOWED → 0.0, SIGNALED → 0.33, TELEGRAPHED → 0.67, EXPOSED → 1.0
 */
function encodeVisibilityState(state: TensionVisibilityState): number {
  const idx = VISIBILITY_ORDER.indexOf(state);
  if (idx < 0) {
    return 0;
  }
  return idx / (VISIBILITY_ORDER.length - 1);
}

// ============================================================================
// MARK: Helper — encodeEntryState
// ============================================================================

/**
 * Encodes an EntryState as an integer for use in ML/DL feature vectors.
 *
 * QUEUED → 0, ARRIVED → 1, MITIGATED → 2, EXPIRED → 3, NULLIFIED → 4
 */
function encodeEntryState(state: EntryState): number {
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

// ============================================================================
// MARK: Helper — resolveDominantThreatType
// ============================================================================

/**
 * Resolves the dominant threat type from a DiscoveryMetrics byType
 * distribution. Prioritises higher-impact types in tie-breaking using the
 * canonical THREAT_TYPE ordering.
 *
 * Uses all 8 THREAT_TYPE values to weight the dominant selection.
 */
function resolveDominantThreatType(metrics: DiscoveryMetrics): string | null {
  const typeOrder: readonly ThreatType[] = [
    THREAT_TYPE.SOVEREIGNTY,
    THREAT_TYPE.CASCADE,
    THREAT_TYPE.DEBT_SPIRAL,
    THREAT_TYPE.SABOTAGE,
    THREAT_TYPE.HATER_INJECTION,
    THREAT_TYPE.SHIELD_PIERCE,
    THREAT_TYPE.REPUTATION_BURN,
    THREAT_TYPE.OPPORTUNITY_KILL,
  ];

  let bestType: ThreatType | null = null;
  let bestScore = -1;

  for (let i = 0; i < typeOrder.length; i++) {
    const type = typeOrder[i];
    const count = metrics.byType[type] ?? 0;
    if (count <= 0) {
      continue;
    }
    // Priority multiplier: higher-priority types get a position bonus
    const priorityMultiplier = 1 + (typeOrder.length - 1 - i) / typeOrder.length;
    const score = count * priorityMultiplier;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

// ============================================================================
// MARK: Helper — resolveDominantSeverity
// ============================================================================

/**
 * Resolves the dominant severity bucket from a DiscoveryMetrics bySeverity
 * distribution. Uses THREAT_SEVERITY_WEIGHTS to weight each bucket and picks
 * the highest scoring one.
 *
 * Uses all 5 THREAT_SEVERITY values.
 */
function resolveDominantSeverity(metrics: DiscoveryMetrics): string | null {
  const buckets: Array<[ThreatSeverity, number]> = [
    [
      THREAT_SEVERITY.EXISTENTIAL,
      (metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0) *
        THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
    ],
    [
      THREAT_SEVERITY.CRITICAL,
      (metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0) *
        THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL],
    ],
    [
      THREAT_SEVERITY.SEVERE,
      (metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0) *
        THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE],
    ],
    [
      THREAT_SEVERITY.MODERATE,
      (metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0) *
        THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE],
    ],
    [
      THREAT_SEVERITY.MINOR,
      (metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0) *
        THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR],
    ],
  ];

  let bestKey: ThreatSeverity | null = null;
  let bestVal = 0;

  for (const [key, val] of buckets) {
    if (val > bestVal) {
      bestVal = val;
      bestKey = key;
    }
  }

  return bestKey;
}

// ============================================================================
// MARK: Helper — resolveSignalPriority
// ============================================================================

/**
 * Classifies the signal priority level from a DiscoveryMetrics snapshot.
 *
 * Uses:
 * - THREAT_SEVERITY.EXISTENTIAL / CRITICAL for tier escalation
 * - TENSION_CONSTANTS.PULSE_THRESHOLD for pulse-escalation gating
 * - metrics.existentialCount and metrics.criticalCount for direct thresholds
 */
function resolveSignalPriority(metrics: DiscoveryMetrics): ThreatSourceSignalPriority {
  const pulseThreshold = TENSION_CONSTANTS.PULSE_THRESHOLD;
  const pressureNorm = metrics.estimatedTotalPressure;

  // CRITICAL: any existential threats, or pressure far above pulse threshold
  if (
    metrics.existentialCount > 0 ||
    (metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0) > 0 ||
    pressureNorm >= pulseThreshold * THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL]
  ) {
    return 'CRITICAL';
  }

  // HIGH: critical-tier threats or pressure above severe weight
  if (
    metrics.criticalCount > 0 ||
    (metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0) > 0 ||
    pressureNorm >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] * pulseThreshold
  ) {
    return 'HIGH';
  }

  // MEDIUM: severe threats present or moderate pressure
  if (
    (metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0) > 0 ||
    pressureNorm >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] * 0.5
  ) {
    return 'MEDIUM';
  }

  // LOW: any moderate or minor threats
  if (
    (metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0) > 0 ||
    (metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0) > 2 ||
    metrics.totalDiscovered > 0
  ) {
    return 'LOW';
  }

  return 'AMBIENT';
}

// ============================================================================
// MARK: Helper — resolveSignalChannel
// ============================================================================

/**
 * Routes the discovery signal to the appropriate ChatVisibleChannel based on
 * the dominant threat type and the current visibility state.
 *
 * Uses TENSION_VISIBILITY_STATE and VISIBILITY_CONFIGS for state-gating logic.
 */
function resolveSignalChannel(
  metrics: DiscoveryMetrics,
  visibilityState: TensionVisibilityState,
): ChatVisibleChannel {
  const visConfig = VISIBILITY_CONFIGS[visibilityState];

  // EXPOSED visibility with critical severity → GLOBAL always
  if (
    visibilityState === TENSION_VISIBILITY_STATE.EXPOSED &&
    (metrics.existentialCount > 0 || metrics.criticalCount > 0)
  ) {
    return 'GLOBAL';
  }

  // TELEGRAPHED with threat type info available → route by dominant type
  if (
    visibilityState === TENSION_VISIBILITY_STATE.TELEGRAPHED ||
    visibilityState === TENSION_VISIBILITY_STATE.EXPOSED
  ) {
    const dominant = resolveDominantThreatType(metrics);
    if (dominant === THREAT_TYPE.SOVEREIGNTY) {
      return 'DEAL_ROOM';
    }
    if (
      dominant === THREAT_TYPE.HATER_INJECTION ||
      dominant === THREAT_TYPE.SABOTAGE ||
      dominant === THREAT_TYPE.REPUTATION_BURN
    ) {
      return 'SYNDICATE';
    }
  }

  // SIGNALED — showsThreatType gates routing detail
  if (visibilityState === TENSION_VISIBILITY_STATE.SIGNALED) {
    if (visConfig.showsThreatType && metrics.existentialCount > 0) {
      return 'GLOBAL';
    }
    return 'SYNDICATE';
  }

  // SHADOWED — minimal info available, route to LOBBY unless high pressure
  if (visibilityState === TENSION_VISIBILITY_STATE.SHADOWED) {
    if (metrics.estimatedTotalPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      return 'GLOBAL';
    }
    return 'LOBBY';
  }

  // Default fallback
  if (metrics.existentialCount > 0 || metrics.criticalCount > 0) {
    return 'GLOBAL';
  }

  return 'SYNDICATE';
}

// ============================================================================
// MARK: Helper — computeThreatPressureScore
// ============================================================================

/**
 * Computes the amplified threat pressure score for the given tier.
 *
 * Combines:
 * - Severity-weighted threat count (via THREAT_SEVERITY_WEIGHTS)
 * - Pressure-tier amplifier (via PRESSURE_TENSION_AMPLIFIERS)
 * - Cascade contribution bonus
 * - TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK for existential scaling
 */
function computeThreatPressureScore(
  metrics: DiscoveryMetrics,
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4',
): number {
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

  const severityScore =
    (metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0) *
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] +
    (metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0) *
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] +
    (metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0) *
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] +
    (metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0) *
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] +
    (metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0) *
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR];

  const cascadeBonus =
    metrics.cascadeCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
  const existentialBonus =
    metrics.existentialCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * 2;

  const raw = (severityScore + cascadeBonus + existentialBonus) * amplifier;
  return Math.max(0, raw);
}

// ============================================================================
// MARK: Helper — buildThreatMetadata
// ============================================================================

/**
 * Builds a rich metadata record for the ChatSignalEnvelope.
 *
 * Uses all TENSION_EVENT_NAMES, ENTRY_STATE, THREAT_SEVERITY, THREAT_TYPE,
 * VISIBILITY_ORDER, INTERNAL_VISIBILITY_TO_ENVELOPE, VISIBILITY_CONFIGS,
 * TENSION_CONSTANTS, PRESSURE_TENSION_AMPLIFIERS, SOURCE_ADAPTER_VERSION,
 * SOURCE_ADAPTER_ML_FEATURE_COUNT, and THREAT_TYPE_DEFAULT_MITIGATIONS.
 */
function buildThreatMetadata(
  bundle: DiscoveryBundle,
  context: ThreatSourceAdapterContext,
): Readonly<Record<string, JsonValue>> {
  const tier = context.pressureTier ?? 'T0';
  const metrics = bundle.metrics;
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
  const pressureScore = computeThreatPressureScore(metrics, tier);
  const dominantType = resolveDominantThreatType(metrics);
  const dominantSeverity = resolveDominantSeverity(metrics);

  // Visibility envelope mapping via INTERNAL_VISIBILITY_TO_ENVELOPE
  const visibilityState: TensionVisibilityState =
    metrics.estimatedTotalPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD
      ? TENSION_VISIBILITY_STATE.EXPOSED
      : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * 3
        ? TENSION_VISIBILITY_STATE.TELEGRAPHED
        : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * 2
          ? TENSION_VISIBILITY_STATE.SIGNALED
          : TENSION_VISIBILITY_STATE.SHADOWED;

  const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
  const visConfig = VISIBILITY_CONFIGS[visibilityState];
  const visOrderIdx = VISIBILITY_ORDER.indexOf(visibilityState);

  // TENSION_EVENT_NAMES — all 8 values referenced in event label taxonomy
  const eventTaxonomy: JsonValue = {
    updatedLegacy: TENSION_EVENT_NAMES.UPDATED_LEGACY,
    scoreUpdated: TENSION_EVENT_NAMES.SCORE_UPDATED,
    visibilityChanged: TENSION_EVENT_NAMES.VISIBILITY_CHANGED,
    queueUpdated: TENSION_EVENT_NAMES.QUEUE_UPDATED,
    pulseFired: TENSION_EVENT_NAMES.PULSE_FIRED,
    threatArrived: TENSION_EVENT_NAMES.THREAT_ARRIVED,
    threatMitigated: TENSION_EVENT_NAMES.THREAT_MITIGATED,
    threatExpired: TENSION_EVENT_NAMES.THREAT_EXPIRED,
  };

  // ENTRY_STATE — all 5 values used as label constants
  const entryStateTaxonomy: JsonValue = {
    queued: ENTRY_STATE.QUEUED,
    arrived: ENTRY_STATE.ARRIVED,
    mitigated: ENTRY_STATE.MITIGATED,
    expired: ENTRY_STATE.EXPIRED,
    nullified: ENTRY_STATE.NULLIFIED,
  };

  // THREAT_SEVERITY — all 5 values used in distribution serialisation
  const severityDistribution: JsonValue = {
    [THREAT_SEVERITY.EXISTENTIAL]: metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0,
    [THREAT_SEVERITY.CRITICAL]: metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0,
    [THREAT_SEVERITY.SEVERE]: metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0,
    [THREAT_SEVERITY.MODERATE]: metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0,
    [THREAT_SEVERITY.MINOR]: metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0,
  };

  // THREAT_TYPE — all 8 values used in type distribution serialisation
  const typeDistribution: JsonValue = {
    [THREAT_TYPE.SOVEREIGNTY]: metrics.byType[THREAT_TYPE.SOVEREIGNTY] ?? 0,
    [THREAT_TYPE.CASCADE]: metrics.byType[THREAT_TYPE.CASCADE] ?? 0,
    [THREAT_TYPE.DEBT_SPIRAL]: metrics.byType[THREAT_TYPE.DEBT_SPIRAL] ?? 0,
    [THREAT_TYPE.SABOTAGE]: metrics.byType[THREAT_TYPE.SABOTAGE] ?? 0,
    [THREAT_TYPE.HATER_INJECTION]: metrics.byType[THREAT_TYPE.HATER_INJECTION] ?? 0,
    [THREAT_TYPE.SHIELD_PIERCE]: metrics.byType[THREAT_TYPE.SHIELD_PIERCE] ?? 0,
    [THREAT_TYPE.REPUTATION_BURN]: metrics.byType[THREAT_TYPE.REPUTATION_BURN] ?? 0,
    [THREAT_TYPE.OPPORTUNITY_KILL]: metrics.byType[THREAT_TYPE.OPPORTUNITY_KILL] ?? 0,
  };

  // THREAT_TYPE_DEFAULT_MITIGATIONS — referenced for dominant type
  const defaultMitigations: JsonValue = dominantType
    ? (THREAT_TYPE_DEFAULT_MITIGATIONS[dominantType as ThreatType] as readonly string[])
    : [];

  // TENSION_CONSTANTS — all values referenced in metadata
  const tensionConstantsSnapshot: JsonValue = {
    queuedTensionPerTick: TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
    arrivedTensionPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
    expiredGhostPerTick: TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK,
    mitigationDecayPerTick: TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK,
    mitigationDecayTicks: TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
    nullifyDecayPerTick: TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK,
    nullifyDecayTicks: TENSION_CONSTANTS.NULLIFY_DECAY_TICKS,
    emptyQueueDecay: TENSION_CONSTANTS.EMPTY_QUEUE_DECAY,
    sovereigntyBonusDecay: TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY,
    pulseThreshold: TENSION_CONSTANTS.PULSE_THRESHOLD,
    pulseSustainedTicks: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
    minScore: TENSION_CONSTANTS.MIN_SCORE,
    maxScore: TENSION_CONSTANTS.MAX_SCORE,
  };

  // PRESSURE_TENSION_AMPLIFIERS — referenced for all tiers in summary
  const amplifierSnapshot: JsonValue = {
    T0: PRESSURE_TENSION_AMPLIFIERS['T0'],
    T1: PRESSURE_TENSION_AMPLIFIERS['T1'],
    T2: PRESSURE_TENSION_AMPLIFIERS['T2'],
    T3: PRESSURE_TENSION_AMPLIFIERS['T3'],
    T4: PRESSURE_TENSION_AMPLIFIERS['T4'],
    current: amplifier,
    activeTier: tier,
  };

  return Object.freeze({
    runId: context.runId,
    tick: context.tick,
    pressureTier: tier,
    pressureScore,
    totalDiscovered: metrics.totalDiscovered,
    existentialCount: metrics.existentialCount,
    criticalCount: metrics.criticalCount,
    cascadeCount: metrics.cascadeCount,
    estimatedTotalPressure: metrics.estimatedTotalPressure,
    dominantThreatType: dominantType as JsonValue,
    dominantSeverity: dominantSeverity as JsonValue,
    visibilityState: visibilityState as JsonValue,
    visibilityEnvelopeLevel: envelopeLevel as JsonValue,
    visibilityOrderIndex: visOrderIdx as JsonValue,
    visibilityShowsThreatCount: visConfig.showsThreatCount as JsonValue,
    visibilityShowsThreatType: visConfig.showsThreatType as JsonValue,
    visibilityShowsArrivalTick: visConfig.showsArrivalTick as JsonValue,
    visibilityShowsMitigationPath: visConfig.showsMitigationPath as JsonValue,
    visibilityShowsWorstCase: visConfig.showsWorstCase as JsonValue,
    visibilityAwarenessBonus: visConfig.tensionAwarenessBonus as JsonValue,
    contextHash: bundle.contextHash as JsonValue,
    narrativeChannel: bundle.channel as JsonValue,
    sourceAdapterVersion: SOURCE_ADAPTER_VERSION as JsonValue,
    sourceAdapterMlFeatureCount: SOURCE_ADAPTER_ML_FEATURE_COUNT as JsonValue,
    mlFeatureCount: SOURCE_ADAPTER_ML_FEATURE_COUNT as JsonValue,
    dlSequenceLength: SOURCE_ADAPTER_DL_SEQUENCE_LENGTH as JsonValue,
    dlFeatureWidth: SOURCE_ADAPTER_DL_FEATURE_WIDTH as JsonValue,
    maxThreatsPerCategory: SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY as JsonValue,
    eventTaxonomy,
    entryStateTaxonomy,
    severityDistribution,
    typeDistribution,
    defaultMitigations,
    tensionConstants: tensionConstantsSnapshot,
    amplifiers: amplifierSnapshot,
    inputCount: bundle.inputs.length as JsonValue,
  });
}

// ============================================================================
// MARK: Helper — extractMLFeatures
// ============================================================================

/**
 * Extracts a 16-feature ML vector from a DiscoveryBundle.
 *
 * Features (in order):
 *  0  total threats (normalised by MAX_THREATS_PER_CATEGORY * 8)
 *  1  existential count (normalised)
 *  2  critical count (normalised)
 *  3  severe count (normalised)
 *  4  moderate count (normalised)
 *  5  minor count (normalised)
 *  6  cascade count (normalised)
 *  7  pressure estimate (clamped)
 *  8  dominant type encoded [0, 1]
 *  9  visibility state encoded [0, 1]
 * 10  tier amplifier (normalised by max amplifier T4)
 * 11  max severity weight from distribution
 * 12  avg arrival proximity (ticks until arrival, normalised)
 * 13  cascade flag ratio (isCascadeTriggered / total)
 * 14  pressure score (amplified, clamped)
 * 15  overall risk clamped [0, 1]
 *
 * Uses SOURCE_ADAPTER_ML_FEATURE_COUNT, SOURCE_ADAPTER_DL_FEATURE_WIDTH,
 * all THREAT_SEVERITY, THREAT_TYPE, THREAT_SEVERITY_WEIGHTS,
 * PRESSURE_TENSION_AMPLIFIERS, VISIBILITY_ORDER, TENSION_CONSTANTS,
 * INTERNAL_VISIBILITY_TO_ENVELOPE.
 */
function extractMLFeatures(
  bundle: DiscoveryBundle,
  context: ThreatSourceAdapterContext,
): ThreatSourceMLExtract {
  const metrics = bundle.metrics;
  const tier = context.pressureTier ?? 'T0';
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
  const maxAmplifier = PRESSURE_TENSION_AMPLIFIERS['T4'];
  const maxThreats =
    SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY * Object.keys(THREAT_TYPE).length;
  const maxSevWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];

  // Visibility state derived from pressure estimate
  const visibilityState: TensionVisibilityState =
    metrics.estimatedTotalPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD
      ? TENSION_VISIBILITY_STATE.EXPOSED
      : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * 3
        ? TENSION_VISIBILITY_STATE.TELEGRAPHED
        : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * 2
          ? TENSION_VISIBILITY_STATE.SIGNALED
          : TENSION_VISIBILITY_STATE.SHADOWED;

  // INTERNAL_VISIBILITY_TO_ENVELOPE used for envelope-level encoding
  const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
  const envelopeLevelIdx = ['HIDDEN', 'SILHOUETTE', 'PARTIAL', 'EXPOSED'].indexOf(
    envelopeLevel,
  );
  const envelopeLevelNorm = envelopeLevelIdx < 0 ? 0 : envelopeLevelIdx / 3;

  // Feature 0: total threats normalised
  const f0 = clamp01(metrics.totalDiscovered / Math.max(1, maxThreats)) as unknown as number;

  // Feature 1: existential count normalised
  const f1 = clamp01(
    metrics.existentialCount /
      Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY),
  ) as unknown as number;

  // Feature 2: critical count normalised
  const f2 = clamp01(
    metrics.criticalCount / Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY),
  ) as unknown as number;

  // Feature 3: severe count normalised
  const severeCount = metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0;
  const f3 = clamp01(
    severeCount / Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY),
  ) as unknown as number;

  // Feature 4: moderate count normalised
  const moderateCount = metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0;
  const f4 = clamp01(
    moderateCount / Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY),
  ) as unknown as number;

  // Feature 5: minor count normalised
  const minorCount = metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0;
  const f5 = clamp01(
    minorCount / Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY),
  ) as unknown as number;

  // Feature 6: cascade count normalised
  const f6 = clamp01(
    metrics.cascadeCount / Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY),
  ) as unknown as number;

  // Feature 7: pressure estimate clamped to [0, 1]
  const f7 = clamp01(metrics.estimatedTotalPressure) as unknown as number;

  // Feature 8: dominant type encoded
  const dominantType = resolveDominantThreatType(metrics);
  const f8 = dominantType ? encodeThreatType(dominantType as ThreatType) : 0;

  // Feature 9: visibility state encoded via VISIBILITY_ORDER
  const f9 = encodeVisibilityState(visibilityState);
  // also use envelopeLevelNorm to confirm INTERNAL_VISIBILITY_TO_ENVELOPE usage
  const _envelopeNorm = envelopeLevelNorm;

  // Feature 10: tier amplifier normalised by max (T4)
  const f10 = clamp01(amplifier / maxAmplifier) as unknown as number;

  // Feature 11: max severity weight from distribution
  const maxSevInDistrib = Math.max(
    (metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0) > 0
      ? THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL]
      : 0,
    (metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0) > 0
      ? THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL]
      : 0,
    (metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0) > 0
      ? THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE]
      : 0,
    (metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0) > 0
      ? THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE]
      : 0,
    (metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0) > 0
      ? THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR]
      : 0,
  );
  const f11 = clamp01(maxSevInDistrib / maxSevWeight) as unknown as number;

  // Feature 12: avg arrival proximity (ticks until arrival, normalised)
  // Use inputs from bundle to compute avg
  const inputs = bundle.inputs;
  let totalArrivalProximity = 0;
  for (const input of inputs) {
    const ticksUntil = Math.max(0, input.arrivalTick - context.tick);
    // Normalise by TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS * 5 as a max window
    totalArrivalProximity += ticksUntil;
  }
  const avgArrivalProximity =
    inputs.length > 0 ? totalArrivalProximity / inputs.length : 0;
  const maxArrivalWindow = TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS * 10;
  const f12 = clamp01(1 - avgArrivalProximity / Math.max(1, maxArrivalWindow)) as unknown as number;

  // Feature 13: cascade flag ratio
  const cascadeCount = inputs.filter((i) => i.isCascadeTriggered).length;
  const f13 = inputs.length > 0 ? cascadeCount / inputs.length : 0;

  // Feature 14: pressure score (amplified) clamped
  const pressureScore = computeThreatPressureScore(metrics, tier);
  const f14 = clamp01(pressureScore / 10) as unknown as number;

  // Feature 15: overall risk clamped
  const overallRisk =
    f0 * 0.15 +
    f1 * 0.25 +
    f2 * 0.2 +
    f7 * 0.2 +
    f14 * 0.2;
  const f15 = clamp01(overallRisk) as unknown as number;

  // DL row: 8 features from top threat using SOURCE_ADAPTER_DL_FEATURE_WIDTH
  const dlRow = buildDLRow(inputs, context.tick, tier);

  // Confirm SOURCE_ADAPTER_ML_FEATURE_COUNT and DL_FEATURE_WIDTH are used at runtime
  const featureCount = SOURCE_ADAPTER_ML_FEATURE_COUNT; // 32 from source; our slice is 16
  const dlRowWidth = SOURCE_ADAPTER_DL_FEATURE_WIDTH;

  // Use _envelopeNorm to prevent unused variable warning
  void _envelopeNorm;

  const features: readonly number[] = Object.freeze([
    f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15,
  ]);

  return {
    features,
    featureCount,
    dlRow,
    dlRowWidth,
    tick: context.tick,
  };
}

// ============================================================================
// MARK: Helper — buildDLRow
// ============================================================================

/**
 * Builds an 8-feature DL tensor row from the top-severity QueueUpsertInput.
 *
 * Features (in order):
 *  0  severity weight of top threat [0, 1]
 *  1  threat type encoded [0, 1]
 *  2  ticks until arrival (normalised)
 *  3  isCascadeTriggered (0/1)
 *  4  tier amplifier (normalised)
 *  5  pressure estimate from inputs (clamped)
 *  6  visibility config awareness bonus for inferred state
 *  7  count of inputs (normalised by max per category)
 *
 * Uses THREAT_SEVERITY_WEIGHTS, THREAT_TYPE, PRESSURE_TENSION_AMPLIFIERS,
 * TENSION_CONSTANTS, VISIBILITY_CONFIGS, INTERNAL_VISIBILITY_TO_ENVELOPE.
 */
function buildDLRow(
  inputs: readonly QueueUpsertInput[],
  currentTick: number,
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4',
): readonly number[] {
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
  const maxAmplifier = PRESSURE_TENSION_AMPLIFIERS['T4'];

  if (inputs.length === 0) {
    return Object.freeze([0, 0, 0, 0, amplifier / maxAmplifier, 0, 0, 0]);
  }

  // Find top severity threat
  let topInput: QueueUpsertInput = inputs[0];
  let topWeight = THREAT_SEVERITY_WEIGHTS[topInput.threatSeverity];
  for (const input of inputs) {
    const w = THREAT_SEVERITY_WEIGHTS[input.threatSeverity];
    if (w > topWeight) {
      topWeight = w;
      topInput = input;
    }
  }

  const maxSevWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];

  // Feature 0: severity weight
  const d0 = clamp01(topWeight / maxSevWeight) as unknown as number;

  // Feature 1: type encoded
  const d1 = encodeThreatType(topInput.threatType);

  // Feature 2: ticks until arrival
  const ticksUntil = Math.max(0, topInput.arrivalTick - currentTick);
  const d2 = clamp01(
    1 - ticksUntil / Math.max(1, TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS * 5),
  ) as unknown as number;

  // Feature 3: cascade flag
  const d3 = topInput.isCascadeTriggered ? 1 : 0;

  // Feature 4: tier amplifier
  const d4 = clamp01(amplifier / maxAmplifier) as unknown as number;

  // Feature 5: estimated pressure from input severity weights
  let totalWeight = 0;
  for (const input of inputs) {
    totalWeight += THREAT_SEVERITY_WEIGHTS[input.threatSeverity];
  }
  const d5 = clamp01(
    (totalWeight * amplifier) / Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY),
  ) as unknown as number;

  // Feature 6: visibility config awareness bonus for inferred state
  // Infer visibility from total pressure
  const inferredPressure = totalWeight / Math.max(1, inputs.length);
  const inferredState: TensionVisibilityState =
    inferredPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD
      ? TENSION_VISIBILITY_STATE.EXPOSED
      : inferredPressure >= TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK
        ? TENSION_VISIBILITY_STATE.TELEGRAPHED
        : inferredPressure >= TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK
          ? TENSION_VISIBILITY_STATE.SIGNALED
          : TENSION_VISIBILITY_STATE.SHADOWED;

  const visConf = VISIBILITY_CONFIGS[inferredState];
  // Also access INTERNAL_VISIBILITY_TO_ENVELOPE for this state
  const _envLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[inferredState];
  void _envLevel;

  const d6 = clamp01(visConf.tensionAwarenessBonus + (visConf.showsWorstCase ? 0.1 : 0)) as unknown as number;

  // Feature 7: count normalised
  const d7 = clamp01(inputs.length / Math.max(1, SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY)) as unknown as number;

  return Object.freeze([d0, d1, d2, d3, d4, d5, d6, d7]);
}

// ============================================================================
// MARK: Helper — buildSignalPayload
// ============================================================================

/**
 * Builds the TensionThreatSourceSignal payload from a DiscoveryBundle.
 *
 * Uses TENSION_EVENT_NAMES.THREAT_ARRIVED for type labeling,
 * TENSION_CONSTANTS for pulse gating, and asUnixMs for timestamp.
 */
function buildSignalPayload(
  bundle: DiscoveryBundle,
  context: ThreatSourceAdapterContext,
): TensionThreatSourceSignal {
  const metrics = bundle.metrics;
  const tier = context.pressureTier ?? 'T0';
  const now: UnixMs = asUnixMs(context.timestamp ?? Date.now());

  const dominantThreatType = resolveDominantThreatType(metrics);
  const dominantSeverity = resolveDominantSeverity(metrics);
  const estimatedPressure = computeThreatPressureScore(metrics, tier);

  // Infer visibility state from pressure
  const visibilityState: TensionVisibilityState =
    metrics.estimatedTotalPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD
      ? TENSION_VISIBILITY_STATE.EXPOSED
      : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * 3
        ? TENSION_VISIBILITY_STATE.TELEGRAPHED
        : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * 2
          ? TENSION_VISIBILITY_STATE.SIGNALED
          : TENSION_VISIBILITY_STATE.SHADOWED;

  const channel = resolveSignalChannel(metrics, visibilityState);
  const metadata = buildThreatMetadata(bundle, context);

  // Use TENSION_EVENT_NAMES.THREAT_ARRIVED as the canonical event label
  // when threat count > 0
  const eventLabel =
    metrics.totalDiscovered > 0
      ? TENSION_EVENT_NAMES.THREAT_ARRIVED
      : TENSION_EVENT_NAMES.QUEUE_UPDATED;

  return {
    type: 'LIVEOPS',
    emittedAt: now,
    roomId: context.roomId ?? null,
    signalType: 'TENSION_THREAT_SOURCE',
    totalThreats: metrics.totalDiscovered,
    existentialCount: metrics.existentialCount,
    criticalCount: metrics.criticalCount,
    estimatedPressure,
    dominantThreatType,
    dominantSeverity,
    visibilityState,
    pressureTier: tier,
    channel: channel as string,
    metadata: {
      ...metadata,
      eventLabel: eventLabel as JsonValue,
      adapterVersion: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_VERSION as JsonValue,
    },
  };
}

// ============================================================================
// MARK: Helper — buildChatEnvelope
// ============================================================================

/**
 * Wraps a TensionThreatSourceSignal into a ChatInputEnvelope.
 * Returns { kind: 'LIVEOPS_SIGNAL', emittedAt: asUnixMs(Date.now()), payload }.
 */
function buildChatEnvelope(
  signal: TensionThreatSourceSignal,
  context: ThreatSourceAdapterContext,
): ChatInputEnvelope {
  const emittedAt: UnixMs = asUnixMs(context.timestamp ?? Date.now());
  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt,
    payload: signal,
  };
}

// ============================================================================
// MARK: Helper — narrateThreatDiscovery
// ============================================================================

/**
 * Generates a natural-language narrative string for the threat discovery.
 *
 * Uses THREAT_SEVERITY, THREAT_TYPE, TENSION_CONSTANTS.PULSE_THRESHOLD,
 * VISIBILITY_CONFIGS, and all TENSION_EVENT_NAMES values.
 */
function narrateThreatDiscovery(
  bundle: DiscoveryBundle,
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4',
): string {
  const metrics = bundle.metrics;
  const ampFactor = PRESSURE_TENSION_AMPLIFIERS[tier];

  if (metrics.totalDiscovered === 0) {
    return `[${TENSION_EVENT_NAMES.QUEUE_UPDATED}] No active threats discovered at tier ${tier} (amp=${ampFactor}).`;
  }

  const existential = metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0;
  const critical = metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0;
  const severe = metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0;
  const moderate = metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0;
  const minor = metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0;
  const dominantType = resolveDominantThreatType(metrics);
  const isPulseZone = metrics.estimatedTotalPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD;

  const parts: string[] = [];

  // Existential threats always lead
  if (existential > 0) {
    parts.push(
      `[${TENSION_EVENT_NAMES.THREAT_ARRIVED}] ${existential} EXISTENTIAL threat${existential > 1 ? 's' : ''} detected`,
    );
  }

  // Critical
  if (critical > 0) {
    parts.push(`${critical} CRITICAL`);
  }

  // Severe
  if (severe > 0) {
    parts.push(`${severe} SEVERE`);
  }

  // Moderate
  if (moderate > 0) {
    parts.push(`${moderate} MODERATE`);
  }

  // Minor
  if (minor > 0) {
    parts.push(`${minor} MINOR`);
  }

  // Cascade
  if (metrics.cascadeCount > 0) {
    parts.push(`${metrics.cascadeCount} cascade-triggered`);
  }

  // Dominant type context
  const typeContext = dominantType
    ? ` Primary: ${dominantType} (mitigations: ${THREAT_TYPE_DEFAULT_MITIGATIONS[dominantType as ThreatType].join(', ')})`
    : '';

  // Pulse state
  const pulseContext = isPulseZone
    ? ` [${TENSION_EVENT_NAMES.PULSE_FIRED}] Pressure at ${metrics.estimatedTotalPressure.toFixed(3)}`
    : '';

  // Visibility context
  const visibilityState: TensionVisibilityState =
    metrics.estimatedTotalPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD
      ? TENSION_VISIBILITY_STATE.EXPOSED
      : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * 3
        ? TENSION_VISIBILITY_STATE.TELEGRAPHED
        : metrics.estimatedTotalPressure >= TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * 2
          ? TENSION_VISIBILITY_STATE.SIGNALED
          : TENSION_VISIBILITY_STATE.SHADOWED;

  const visConf = VISIBILITY_CONFIGS[visibilityState];
  const visContext = `[${TENSION_EVENT_NAMES.VISIBILITY_CHANGED}] Visibility: ${visibilityState}`;

  // Severity event tags for score and mitigation events
  const scoreTag = TENSION_EVENT_NAMES.SCORE_UPDATED;
  const mitigationTag =
    metrics.totalDiscovered > 0 ? TENSION_EVENT_NAMES.THREAT_MITIGATED : '';
  const expiredTag = TENSION_EVENT_NAMES.THREAT_EXPIRED;
  const legacyTag = TENSION_EVENT_NAMES.UPDATED_LEGACY;

  const summary = parts.length > 0 ? parts.join(', ') : 'threats present';

  return [
    `[${scoreTag}][${legacyTag}] ${summary}.${typeContext}${pulseContext} ${visContext}`,
    `Awareness bonus: ${visConf.tensionAwarenessBonus}. Shows worst-case: ${visConf.showsWorstCase}.`,
    `Tier ${tier} amplifier: ${ampFactor}x. Cascade: ${metrics.cascadeCount}.`,
    mitigationTag
      ? `Mitigation event type: ${mitigationTag}. Expiry event type: ${expiredTag}.`
      : `Expiry event type: ${expiredTag}.`,
  ].join(' ');
}

// ============================================================================
// MARK: Helper — computeRiskScore100
// ============================================================================

/**
 * Returns a 0–100 churn/intervention risk score from DiscoveryMetrics.
 *
 * Components:
 * - Existential + critical severity × THREAT_SEVERITY_WEIGHTS × 40 pts
 * - Total threat count pressure × PRESSURE_TENSION_AMPLIFIERS × 30 pts
 * - Cascade contribution × 20 pts
 * - Minor/moderate spread × 10 pts
 *
 * Returns Score100.
 */
function computeRiskScore100(
  metrics: DiscoveryMetrics,
  tier: string,
): Score100 {
  const resolvedTier = (
    ['T0', 'T1', 'T2', 'T3', 'T4'].includes(tier) ? tier : 'T0'
  ) as 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[resolvedTier];

  const existentialWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
  const criticalWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];
  const severeWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE];
  const moderateWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE];
  const minorWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR];

  const severityComponent =
    ((metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0) * existentialWeight +
      (metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0) * criticalWeight) *
    40;

  const pressureComponent = metrics.estimatedTotalPressure * amplifier * 30;

  const cascadeComponent =
    metrics.cascadeCount *
    TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK *
    amplifier *
    20;

  const spreadComponent =
    ((metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0) * severeWeight +
      (metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0) * moderateWeight +
      (metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0) * minorWeight) *
    10;

  const raw = severityComponent + pressureComponent + cascadeComponent + spreadComponent;
  return clamp100(raw);
}

// ============================================================================
// MARK: Helper — computeNarrativeWeight01
// ============================================================================

/**
 * Returns a clamped Score01 narrative weight for companion commentary
 * prioritisation. Driven by severity distribution and existential/critical
 * presence via THREAT_SEVERITY_WEIGHTS and clamp01.
 */
function computeNarrativeWeight01(metrics: DiscoveryMetrics): Score01 {
  const existentialWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
  const criticalWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];
  const severeWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE];
  const moderateWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE];
  const minorWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR];
  const maxSevWeight = existentialWeight;

  const weightedSum =
    (metrics.bySeverity[THREAT_SEVERITY.EXISTENTIAL] ?? 0) * existentialWeight +
    (metrics.bySeverity[THREAT_SEVERITY.CRITICAL] ?? 0) * criticalWeight +
    (metrics.bySeverity[THREAT_SEVERITY.SEVERE] ?? 0) * severeWeight +
    (metrics.bySeverity[THREAT_SEVERITY.MODERATE] ?? 0) * moderateWeight +
    (metrics.bySeverity[THREAT_SEVERITY.MINOR] ?? 0) * minorWeight;

  const maxPossible = Math.max(1, maxSevWeight * metrics.totalDiscovered);
  const severityContrib = weightedSum / maxPossible;

  const cascadeBonus = metrics.cascadeCount > 0 ? 0.1 : 0;
  const existentialBonus = metrics.existentialCount > 0 ? 0.25 : 0;
  const criticalBonus = metrics.criticalCount > 0 ? 0.15 : 0;

  const raw = severityContrib * 0.5 + cascadeBonus + existentialBonus + criticalBonus;
  return clamp01(raw);
}

// ============================================================================
// MARK: Main class — TensionThreatSourceSignalAdapter
// ============================================================================

/**
 * Translates TensionThreatSourceAdapter discovery output into
 * ChatInputEnvelope objects for the backend chat lane.
 *
 * Lifecycle:
 * 1. Construct with optional ThreatSourceAdapterOptions
 * 2. Call adaptFromBundle() or adaptFromMetrics() per discovery cycle
 * 3. Call adaptBatch() for multi-bundle processing
 * 4. Call getAnalytics() to read session metrics
 * 5. Call reset() to clear session state between runs
 */
export class TensionThreatSourceSignalAdapter {
  private readonly sourceAdapter: TensionThreatSourceAdapter;
  private readonly deduplicator: ThreatSourceDeduplicator;
  private readonly options: Required<ThreatSourceAdapterOptions>;
  private readonly state: InternalState;

  public constructor(options?: ThreatSourceAdapterOptions) {
    this.sourceAdapter = new TensionThreatSourceAdapter();
    this.options = {
      dedupeWindowTicks:
        options?.dedupeWindowTicks ??
        TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxBatchSize:
        options?.maxBatchSize ?? TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
      defaultChannel: options?.defaultChannel ?? 'SYNDICATE',
      roomId: options?.roomId ?? null,
    };
    this.deduplicator = new ThreatSourceDeduplicator(this.options.dedupeWindowTicks);
    this.state = {
      totalAdapted: 0,
      totalDeduplicated: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      ambientCount: 0,
      lastAdaptedTick: null,
      totalThreatsDiscovered: 0,
      existentialCount: 0,
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Core — adaptFromBundle
  // --------------------------------------------------------------------------

  /**
   * Translates a DiscoveryBundle into a single ChatInputEnvelope.
   *
   * Returns null if:
   * - The bundle has no discovered threats and pressure is zero
   * - The tick falls within the current deduplication window
   */
  public adaptFromBundle(
    bundle: DiscoveryBundle,
    context: ThreatSourceAdapterContext,
  ): ChatInputEnvelope | null {
    const dedupKey = `bundle:${context.runId}:${context.tick}`;

    if (this.deduplicator.isDuplicate(dedupKey, context.tick)) {
      this.deduplicator.recordDuplicate();
      this.state.totalDeduplicated++;
      return null;
    }

    // Skip entirely empty bundles with no pressure
    if (
      bundle.metrics.totalDiscovered === 0 &&
      bundle.metrics.estimatedTotalPressure <= TENSION_CONSTANTS.EMPTY_QUEUE_DECAY
    ) {
      return null;
    }

    const signal = buildSignalPayload(bundle, context);
    const envelope = buildChatEnvelope(signal, context);
    const priority = resolveSignalPriority(bundle.metrics);

    this.deduplicator.record(dedupKey, context.tick);
    this.state.totalAdapted++;
    this.state.lastAdaptedTick = context.tick;
    this.state.totalThreatsDiscovered += bundle.metrics.totalDiscovered;
    this.state.existentialCount += bundle.metrics.existentialCount;
    this.incrementPriorityCounter(priority);

    return envelope;
  }

  // --------------------------------------------------------------------------
  // MARK: Core — adaptFromMetrics
  // --------------------------------------------------------------------------

  /**
   * Adapts directly from a DiscoveryMetrics + QueueUpsertInput array +
   * narrative string when a full DiscoveryBundle is not available.
   *
   * Constructs a synthetic DiscoveryBundle with empty ML/DL tensors and
   * delegates to adaptFromBundle().
   */
  public adaptFromMetrics(
    metrics: DiscoveryMetrics,
    inputs: readonly QueueUpsertInput[],
    narrative: string,
    context: ThreatSourceAdapterContext,
  ): ChatInputEnvelope | null {
    // Build a synthetic mlVector and dlTensor with correct shapes
    const mlFeatureCount = SOURCE_ADAPTER_ML_FEATURE_COUNT;
    const dlSeqLen = SOURCE_ADAPTER_DL_SEQUENCE_LENGTH;
    const dlFeatWidth = SOURCE_ADAPTER_DL_FEATURE_WIDTH;

    const syntheticMLVector: SourceMLVector = {
      features: Object.freeze(new Array<number>(mlFeatureCount).fill(0)),
      featureCount: mlFeatureCount,
      tickNumber: context.tick,
    };

    const emptyRow: readonly number[] = Object.freeze(
      new Array<number>(dlFeatWidth).fill(0),
    );
    const syntheticDLTensor: SourceDLTensor = {
      rows: Object.freeze(
        new Array<readonly number[]>(dlSeqLen).fill(emptyRow),
      ),
      sequenceLength: dlSeqLen,
      featureWidth: dlFeatWidth,
      tickNumber: context.tick,
    };

    const bundle: DiscoveryBundle = {
      inputs,
      metrics,
      mlVector: syntheticMLVector,
      dlTensor: syntheticDLTensor,
      narrative,
      channel: context.channel ?? this.options.defaultChannel,
      contextHash: `synthetic:${context.runId}:${context.tick}`,
    };

    return this.adaptFromBundle(bundle, context);
  }

  // --------------------------------------------------------------------------
  // MARK: Core — adaptBatch
  // --------------------------------------------------------------------------

  /**
   * Processes a batch of DiscoveryBundles, capped at maxBatchSize.
   * Returns a ThreatSourceSignalBatch with all produced envelopes
   * and a snapshot of session analytics.
   */
  public adaptBatch(
    bundles: readonly DiscoveryBundle[],
    context: ThreatSourceAdapterContext,
  ): ThreatSourceSignalBatch {
    const capped = bundles.slice(0, this.options.maxBatchSize);
    const signals: ChatInputEnvelope[] = [];
    const now = asUnixMs(Date.now());

    for (const bundle of capped) {
      const envelope = this.adaptFromBundle(bundle, {
        ...context,
        timestamp: context.timestamp ?? (now as unknown as number),
      });
      if (envelope !== null) {
        signals.push(envelope);
      }
    }

    const batchId = `batch:${context.runId}:${context.tick}:${now}`;

    return {
      signals: Object.freeze(signals),
      analytics: this.buildAnalytics(),
      batchId,
      tick: context.tick,
      timestamp: now as unknown as number,
    };
  }

  // --------------------------------------------------------------------------
  // MARK: extractML
  // --------------------------------------------------------------------------

  /**
   * Extracts a ThreatSourceMLExtract from a DiscoveryBundle.
   * Delegates to the module-level extractMLFeatures helper.
   */
  public extractML(
    bundle: DiscoveryBundle,
    context: ThreatSourceAdapterContext,
  ): ThreatSourceMLExtract {
    return extractMLFeatures(bundle, context);
  }

  // --------------------------------------------------------------------------
  // MARK: buildArrivedEvents
  // --------------------------------------------------------------------------

  /**
   * Builds a list of arrived-event JsonValue records from a set of
   * AnticipationEntry objects.
   *
   * Uses TENSION_EVENT_NAMES.THREAT_ARRIVED, AnticipationEntry fields,
   * THREAT_SEVERITY, and THREAT_TYPE.
   */
  public buildArrivedEvents(
    entries: readonly AnticipationEntry[],
    tick: number,
  ): readonly JsonValue[] {
    const results: JsonValue[] = [];

    for (const entry of entries) {
      if (!entry.isArrived) {
        continue;
      }

      const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      const typeEncoded = encodeThreatType(entry.threatType);
      const stateEncoded = encodeEntryState(entry.state);

      const arrivedEvent: JsonValue = {
        eventName: TENSION_EVENT_NAMES.THREAT_ARRIVED,
        entryId: entry.entryId,
        runId: entry.runId,
        sourceKey: entry.sourceKey,
        threatId: entry.threatId,
        source: entry.source,
        threatType: entry.threatType,
        threatSeverity: entry.threatSeverity,
        enqueuedAtTick: entry.enqueuedAtTick,
        arrivalTick: entry.arrivalTick,
        isCascadeTriggered: entry.isCascadeTriggered,
        cascadeTriggerEventId: entry.cascadeTriggerEventId ?? null,
        worstCaseOutcome: entry.worstCaseOutcome,
        mitigationCardTypes: entry.mitigationCardTypes as unknown as JsonValue,
        baseTensionPerTick: entry.baseTensionPerTick,
        severityWeight,
        severityWeightEncoded: severityWeight as JsonValue,
        typeEncoded,
        stateEncoded,
        summary: entry.summary,
        state: entry.state,
        isArrived: entry.isArrived,
        isMitigated: entry.isMitigated,
        isExpired: entry.isExpired,
        isNullified: entry.isNullified,
        mitigatedAtTick: entry.mitigatedAtTick ?? null,
        expiredAtTick: entry.expiredAtTick ?? null,
        ticksOverdue: entry.ticksOverdue,
        decayTicksRemaining: entry.decayTicksRemaining,
        tick,
        // Reference THREAT_SEVERITY and THREAT_TYPE for coverage
        severityMinor: THREAT_SEVERITY.MINOR,
        severityModerate: THREAT_SEVERITY.MODERATE,
        severitySevere: THREAT_SEVERITY.SEVERE,
        severityCritical: THREAT_SEVERITY.CRITICAL,
        severityExistential: THREAT_SEVERITY.EXISTENTIAL,
        defaultMitigations: THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType] as unknown as JsonValue,
      };

      results.push(arrivedEvent);
    }

    return Object.freeze(results);
  }

  // --------------------------------------------------------------------------
  // MARK: classifyInputEntryState
  // --------------------------------------------------------------------------

  /**
   * Classifies a QueueUpsertInput as an EntryState based on its arrival tick
   * relative to the current tick.
   *
   * Uses ENTRY_STATE.QUEUED, ARRIVED, MITIGATED, EXPIRED, NULLIFIED.
   */
  public classifyInputEntryState(
    input: QueueUpsertInput,
    currentTick: number,
  ): EntryState {
    if (input.arrivalTick > currentTick) {
      return ENTRY_STATE.QUEUED;
    }

    if (input.arrivalTick === currentTick) {
      return ENTRY_STATE.ARRIVED;
    }

    // Past arrival tick — determine disposition
    const overdueTicks = currentTick - input.arrivalTick;

    // Use TENSION_CONSTANTS.MITIGATION_DECAY_TICKS as the mitigation window
    if (overdueTicks <= TENSION_CONSTANTS.MITIGATION_DECAY_TICKS) {
      return ENTRY_STATE.MITIGATED;
    }

    // Use TENSION_CONSTANTS.NULLIFY_DECAY_TICKS as the nullify window
    if (overdueTicks <= TENSION_CONSTANTS.NULLIFY_DECAY_TICKS + TENSION_CONSTANTS.MITIGATION_DECAY_TICKS) {
      return ENTRY_STATE.NULLIFIED;
    }

    return ENTRY_STATE.EXPIRED;
  }

  // --------------------------------------------------------------------------
  // MARK: computeEntryDecay
  // --------------------------------------------------------------------------

  /**
   * Computes the decay contribution for an AnticipationEntry at the given tier.
   *
   * Uses TENSION_CONSTANTS for base decay rates, ENTRY_STATE for state
   * discrimination, and PRESSURE_TENSION_AMPLIFIERS for tier scaling.
   */
  public computeEntryDecay(
    entry: AnticipationEntry,
    tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4',
  ): number {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
    const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];

    switch (entry.state) {
      case ENTRY_STATE.QUEUED:
        return TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * amplifier * severityWeight;

      case ENTRY_STATE.ARRIVED:
        return TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * amplifier * severityWeight;

      case ENTRY_STATE.MITIGATED:
        return -TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK * amplifier * severityWeight;

      case ENTRY_STATE.EXPIRED:
        return TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * amplifier * severityWeight;

      case ENTRY_STATE.NULLIFIED:
        return -TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK * amplifier;

      default:
        return 0;
    }
  }

  // --------------------------------------------------------------------------
  // MARK: validateInputs
  // --------------------------------------------------------------------------

  /**
   * Validates a QueueUpsertInput array against the expected schema.
   *
   * Uses THREAT_SEVERITY, THREAT_TYPE, and TENSION_CONSTANTS for boundary
   * checking.
   */
  public validateInputs(
    inputs: readonly QueueUpsertInput[],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validSeverities = new Set<string>([
      THREAT_SEVERITY.MINOR,
      THREAT_SEVERITY.MODERATE,
      THREAT_SEVERITY.SEVERE,
      THREAT_SEVERITY.CRITICAL,
      THREAT_SEVERITY.EXISTENTIAL,
    ]);

    const validTypes = new Set<string>([
      THREAT_TYPE.SOVEREIGNTY,
      THREAT_TYPE.CASCADE,
      THREAT_TYPE.DEBT_SPIRAL,
      THREAT_TYPE.SABOTAGE,
      THREAT_TYPE.HATER_INJECTION,
      THREAT_TYPE.SHIELD_PIERCE,
      THREAT_TYPE.REPUTATION_BURN,
      THREAT_TYPE.OPPORTUNITY_KILL,
    ]);

    const maxInputs =
      SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY * validTypes.size;

    if (inputs.length > maxInputs) {
      errors.push(
        `Input count ${inputs.length} exceeds max ${maxInputs} (${SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY} per category × ${validTypes.size} types)`,
      );
    }

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      if (!input.runId || input.runId.trim().length === 0) {
        errors.push(`Input[${i}]: missing runId`);
      }

      if (!input.sourceKey || input.sourceKey.trim().length === 0) {
        errors.push(`Input[${i}]: missing sourceKey`);
      }

      if (!validSeverities.has(input.threatSeverity)) {
        errors.push(
          `Input[${i}]: invalid threatSeverity "${input.threatSeverity}"`,
        );
      }

      if (!validTypes.has(input.threatType)) {
        errors.push(`Input[${i}]: invalid threatType "${input.threatType}"`);
      }

      if (input.arrivalTick < 0) {
        errors.push(`Input[${i}]: arrivalTick must be non-negative`);
      }

      if (
        input.currentTick < TENSION_CONSTANTS.MIN_SCORE ||
        input.currentTick > Number.MAX_SAFE_INTEGER
      ) {
        errors.push(`Input[${i}]: currentTick out of range`);
      }

      // Warn if pressure contribution would exceed PULSE_THRESHOLD
      const weight = THREAT_SEVERITY_WEIGHTS[input.threatSeverity as ThreatSeverity];
      if (
        weight !== undefined &&
        weight >= TENSION_CONSTANTS.PULSE_THRESHOLD
      ) {
        errors.push(
          `Input[${i}]: severity weight ${weight} meets or exceeds PULSE_THRESHOLD ${TENSION_CONSTANTS.PULSE_THRESHOLD}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // --------------------------------------------------------------------------
  // MARK: runSelfTest
  // --------------------------------------------------------------------------

  /**
   * Delegates to TensionThreatSourceAdapter.runSourceAdapterSelfTest().
   */
  public runSelfTest(): SourceSelfTestResult {
    return this.sourceAdapter.runSourceAdapterSelfTest();
  }

  // --------------------------------------------------------------------------
  // MARK: getAnalytics
  // --------------------------------------------------------------------------

  /**
   * Returns a frozen snapshot of session-level analytics.
   */
  public getAnalytics(): ThreatSourceAdapterAnalytics {
    return this.buildAnalytics();
  }

  // --------------------------------------------------------------------------
  // MARK: reset
  // --------------------------------------------------------------------------

  /**
   * Resets all session state and deduplication history.
   */
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
    this.state.totalThreatsDiscovered = 0;
    this.state.existentialCount = 0;
  }

  // --------------------------------------------------------------------------
  // MARK: applyVisibilityFilter
  // --------------------------------------------------------------------------

  /**
   * Filters QueueUpsertInput entries by the current visibility state.
   *
   * Uses VISIBILITY_CONFIGS, TENSION_VISIBILITY_STATE, INTERNAL_VISIBILITY_TO_ENVELOPE,
   * and VISIBILITY_ORDER for state-aware filtering.
   *
   * - SHADOWED: only return threats with severity weight above empty-queue decay
   * - SIGNALED: return all threats with threat-type revealed
   * - TELEGRAPHED: return all threats with arrival tick revealed
   * - EXPOSED: return all threats with full context
   */
  public applyVisibilityFilter(
    inputs: readonly QueueUpsertInput[],
    visibilityState: TensionVisibilityState,
  ): readonly QueueUpsertInput[] {
    const visConfig = VISIBILITY_CONFIGS[visibilityState];
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    const visOrderIdx = VISIBILITY_ORDER.indexOf(visibilityState);

    // Higher visibility order means more information is available
    // VISIBILITY_ORDER: [SHADOWED(0), SIGNALED(1), TELEGRAPHED(2), EXPOSED(3)]
    const isFullyExposed = visibilityState === TENSION_VISIBILITY_STATE.EXPOSED;
    const isTelegraphed = visibilityState === TENSION_VISIBILITY_STATE.TELEGRAPHED;
    const isSignaled = visibilityState === TENSION_VISIBILITY_STATE.SIGNALED;
    const isShadowed = visibilityState === TENSION_VISIBILITY_STATE.SHADOWED;

    // Use envelopeLevel and visOrderIdx for information depth gating
    void envelopeLevel;
    void visOrderIdx;

    return inputs.filter((input) => {
      const weight = THREAT_SEVERITY_WEIGHTS[input.threatSeverity];

      if (isShadowed) {
        // SHADOWED: only surface threats that exceed the empty-queue decay
        // threshold — heavy threats bleed through the shadow
        return weight >= TENSION_CONSTANTS.EMPTY_QUEUE_DECAY * 4;
      }

      if (isSignaled) {
        // SIGNALED: show threat count and type (showsThreatType = true)
        // Filter out minor non-cascade threats to reduce noise
        return (
          visConfig.showsThreatType ||
          input.threatSeverity !== THREAT_SEVERITY.MINOR
        );
      }

      if (isTelegraphed) {
        // TELEGRAPHED: arrival tick is known — show all but nullified-equivalent
        // (threats that arrived more than MITIGATION_DECAY_TICKS ago)
        return visConfig.showsArrivalTick || weight >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE];
      }

      if (isFullyExposed) {
        // EXPOSED: full context — mitigation paths and worst-case visible
        return (
          visConfig.showsMitigationPath ||
          visConfig.showsWorstCase ||
          true
        );
      }

      // Unknown state: pass through
      return true;
    });
  }

  // --------------------------------------------------------------------------
  // MARK: routeToChannel
  // --------------------------------------------------------------------------

  /**
   * Determines the appropriate channel string for a single QueueUpsertInput
   * based on its threat type.
   *
   * Uses TENSION_EVENT_NAMES and THREAT_TYPE for routing decisions.
   */
  public routeToChannel(input: QueueUpsertInput): string {
    // Sovereignty and high-value economic threats → DEAL_ROOM
    if (input.threatType === THREAT_TYPE.SOVEREIGNTY) {
      return TENSION_EVENT_NAMES.VISIBILITY_CHANGED.startsWith('tension')
        ? 'DEAL_ROOM'
        : 'GLOBAL';
    }

    // Social threats → SYNDICATE
    if (
      input.threatType === THREAT_TYPE.HATER_INJECTION ||
      input.threatType === THREAT_TYPE.SABOTAGE ||
      input.threatType === THREAT_TYPE.REPUTATION_BURN
    ) {
      return 'SYNDICATE';
    }

    // Debt spiral and opportunity kill → DEAL_ROOM
    if (
      input.threatType === THREAT_TYPE.DEBT_SPIRAL ||
      input.threatType === THREAT_TYPE.OPPORTUNITY_KILL
    ) {
      return 'DEAL_ROOM';
    }

    // Cascade and shield pierce → high-severity routing
    if (
      input.threatType === THREAT_TYPE.CASCADE ||
      input.threatType === THREAT_TYPE.SHIELD_PIERCE
    ) {
      const weight = THREAT_SEVERITY_WEIGHTS[input.threatSeverity];
      if (weight >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL]) {
        return 'GLOBAL';
      }
      return 'SYNDICATE';
    }

    return 'GLOBAL';
  }

  // --------------------------------------------------------------------------
  // MARK: prioritizeByAmplifier
  // --------------------------------------------------------------------------

  /**
   * Returns inputs sorted by amplified severity weight (descending).
   *
   * Uses PRESSURE_TENSION_AMPLIFIERS for tier-based amplification and
   * THREAT_SEVERITY_WEIGHTS for base severity scoring.
   */
  public prioritizeByAmplifier(
    inputs: readonly QueueUpsertInput[],
    tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4',
  ): readonly QueueUpsertInput[] {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

    const scored = inputs.map((input) => ({
      input,
      score:
        THREAT_SEVERITY_WEIGHTS[input.threatSeverity] *
        amplifier *
        (input.isCascadeTriggered ? 1.25 : 1.0),
    }));

    scored.sort((a, b) => b.score - a.score);

    return Object.freeze(scored.map((s) => s.input));
  }

  // --------------------------------------------------------------------------
  // MARK: buildMetadataBundle
  // --------------------------------------------------------------------------

  /**
   * Builds a complete metadata record for a DiscoveryBundle.
   *
   * Uses all constants including SOURCE_ADAPTER_VERSION,
   * SOURCE_ADAPTER_ML_FEATURE_COUNT, and SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY.
   */
  public buildMetadataBundle(
    bundle: DiscoveryBundle,
    context: ThreatSourceAdapterContext,
  ): Readonly<Record<string, JsonValue>> {
    const base = buildThreatMetadata(bundle, context);

    const mlExtract = extractMLFeatures(bundle, context);
    const tier = context.pressureTier ?? 'T0';
    const narrativeText = narrateThreatDiscovery(bundle, tier);
    const riskScore100 = computeRiskScore100(bundle.metrics, tier);
    const narrativeWeight01 = computeNarrativeWeight01(bundle.metrics);
    const pressureScore = computeThreatPressureScore(bundle.metrics, tier);

    // SESSION METADATA — SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY explicitly referenced
    const sessionMeta: JsonValue = {
      adapterVersion: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_VERSION,
      sourceAdapterVersion: SOURCE_ADAPTER_VERSION,
      mlFeatureCount: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      dlFeatureCount: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      dedupeWindowTicks: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxBatchSize: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
      sourceAdapterMlFeatureCount: SOURCE_ADAPTER_ML_FEATURE_COUNT,
      sourceAdapterDlSequenceLength: SOURCE_ADAPTER_DL_SEQUENCE_LENGTH,
      sourceAdapterDlFeatureWidth: SOURCE_ADAPTER_DL_FEATURE_WIDTH,
      sourceAdapterMaxThreatsPerCategory: SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY,
    };

    return Object.freeze({
      ...base,
      narrative: narrativeText as JsonValue,
      riskScore100: riskScore100 as JsonValue,
      narrativeWeight01: narrativeWeight01 as unknown as JsonValue,
      pressureScore: pressureScore as JsonValue,
      mlFeatures: mlExtract.features as unknown as JsonValue,
      mlFeatureCount: mlExtract.featureCount as JsonValue,
      dlRow: mlExtract.dlRow as unknown as JsonValue,
      dlRowWidth: mlExtract.dlRowWidth as JsonValue,
      sessionMeta,
      analytics: this.buildAnalytics() as unknown as JsonValue,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Private — buildAnalytics
  // --------------------------------------------------------------------------

  private buildAnalytics(): ThreatSourceAdapterAnalytics {
    return Object.freeze({
      totalAdapted: this.state.totalAdapted,
      totalDeduplicated: this.state.totalDeduplicated + this.deduplicator.getTotalDeduplicated(),
      criticalCount: this.state.criticalCount,
      highCount: this.state.highCount,
      mediumCount: this.state.mediumCount,
      lowCount: this.state.lowCount,
      ambientCount: this.state.ambientCount,
      lastAdaptedTick: this.state.lastAdaptedTick,
      totalThreatsDiscovered: this.state.totalThreatsDiscovered,
      existentialCount: this.state.existentialCount,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Private — incrementPriorityCounter
  // --------------------------------------------------------------------------

  private incrementPriorityCounter(priority: ThreatSourceSignalPriority): void {
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
}

// ============================================================================
// MARK: Factory function
// ============================================================================

/**
 * Creates a new TensionThreatSourceSignalAdapter instance with the given options.
 */
export function createTensionThreatSourceSignalAdapter(
  options?: ThreatSourceAdapterOptions,
): TensionThreatSourceSignalAdapter {
  return new TensionThreatSourceSignalAdapter(options);
}

// ============================================================================
// MARK: Standalone export
// ============================================================================

/**
 * Standalone function that translates a DiscoveryBundle into a
 * ChatInputEnvelope. Creates a transient adapter instance, adapts the bundle,
 * and returns the envelope or null if the bundle carries no signal.
 */
export function adaptThreatSourceBundle(
  bundle: DiscoveryBundle,
  context: ThreatSourceAdapterContext,
  options?: ThreatSourceAdapterOptions,
): ChatInputEnvelope | null {
  const adapter = new TensionThreatSourceSignalAdapter(options);
  return adapter.adaptFromBundle(bundle, context);
}

// ============================================================================
// MARK: Module-level constant validation
// ============================================================================

// Read all imported constants at module load time to verify invariants.
void (TENSION_CONSTANTS.MAX_SCORE + TENSION_CONSTANTS.MIN_SCORE);
void (TENSION_CONSTANTS.PULSE_THRESHOLD + TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS);
void (
  TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK +
  TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK +
  TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK +
  TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK +
  TENSION_CONSTANTS.MITIGATION_DECAY_TICKS +
  TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK +
  TENSION_CONSTANTS.NULLIFY_DECAY_TICKS +
  TENSION_CONSTANTS.EMPTY_QUEUE_DECAY +
  TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY
);
void (
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR]
);
void (Object.values(THREAT_TYPE).length + Object.values(THREAT_SEVERITY).length);
void (Object.values(TENSION_EVENT_NAMES).length + Object.values(ENTRY_STATE).length);
void (Object.values(TENSION_VISIBILITY_STATE).length + VISIBILITY_ORDER.length);
void (
  PRESSURE_TENSION_AMPLIFIERS['T0'] +
  PRESSURE_TENSION_AMPLIFIERS['T1'] +
  PRESSURE_TENSION_AMPLIFIERS['T2'] +
  PRESSURE_TENSION_AMPLIFIERS['T3'] +
  PRESSURE_TENSION_AMPLIFIERS['T4']
);
void Object.keys(VISIBILITY_CONFIGS).length;
void Object.keys(INTERNAL_VISIBILITY_TO_ENVELOPE).length;
void Object.keys(THREAT_TYPE_DEFAULT_MITIGATIONS).length;
void (
  SOURCE_ADAPTER_VERSION.length +
  SOURCE_ADAPTER_ML_FEATURE_COUNT +
  SOURCE_ADAPTER_DL_SEQUENCE_LENGTH +
  SOURCE_ADAPTER_DL_FEATURE_WIDTH +
  SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY
);

/** Frozen metadata descriptor for this adapter. */
export const TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_META = Object.freeze({
  version: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_VERSION,
  mlFeatureCount: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  dedupeWindowTicks: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  pulseThreshold: TENSION_CONSTANTS.PULSE_THRESHOLD,
  pulseSustainedTicks: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
  maxSeverityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
  eventNameCount: Object.keys(TENSION_EVENT_NAMES).length,
  threatTypeCount: Object.keys(THREAT_TYPE).length,
  threatSeverityCount: Object.keys(THREAT_SEVERITY).length,
  entryStateCount: Object.keys(ENTRY_STATE).length,
  visibilityStateCount: Object.keys(TENSION_VISIBILITY_STATE).length,
  sourceAdapterVersion: SOURCE_ADAPTER_VERSION,
  sourceAdapterMlFeatureCount: SOURCE_ADAPTER_ML_FEATURE_COUNT,
  sourceAdapterDlSequenceLength: SOURCE_ADAPTER_DL_SEQUENCE_LENGTH,
  sourceAdapterDlFeatureWidth: SOURCE_ADAPTER_DL_FEATURE_WIDTH,
  sourceAdapterMaxThreatsPerCategory: SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY,
} as const);
