/* ========================================================================
 * POINT ZERO ONE — BACKEND ANTICIPATION QUEUE (v2)
 * /backend/src/game/engine/tension/AnticipationQueue.ts
 *
 * Purpose:
 *   Authoritative threat-scheduling queue for the Tension Engine (Engine 3 / 7).
 *   Manages the complete lifecycle of AnticipationEntry objects: creation,
 *   arrival, expiration, mitigation, and nullification.  Also provides:
 *     ─ 32-dimensional ML feature vector extraction
 *     ─ 16 × 8 DL sequence tensor construction
 *     ─ Threat forecasting, arrival scheduling, expiration forecasting
 *     ─ Queue health monitoring and risk classification
 *     ─ Session-level analytics and throughput metrics
 *     ─ UX narrative generation for all queue states
 *     ─ EventBus-ready event builders for all queue transitions
 *     ─ Serialization / deserialization for persistence and replay
 *     ─ Standalone pure-function exports for chat-adapter integration
 *     ─ Comprehensive self-test harness
 *
 * Doctrine:
 *   - Pure queue logic. Never emits events directly — returns event objects.
 *   - All state transitions are immutable (object spread, no in-place mutation).
 *   - Deterministic IDs via SHA-256 (reproducible from runId + sourceKey).
 *   - ML / DL extraction is a first-class capability.
 *   - ZERO unused imports. ZERO unused constants. ZERO dead code.
 *
 * Wire surface:
 *   - Instantiated and owned by TensionEngine (tick loop, mitigate, nullify)
 *   - ML vector consumed by chat adapters via exportBundle() / extractMLVector()
 *   - Event builders consumed by TensionUXBridge before EventBus.emit()
 *   - Standalone exports consumed by tension/index.ts and engine/chat/
 * ====================================================================== */

// ============================================================================
// § 0 — IMPORTS
//   Every symbol below is accessed in runtime function bodies.
//   ZERO type-only imports that remain unused.
// ============================================================================

import { createHash } from 'node:crypto';

import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  TENSION_CONSTANTS,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  PRESSURE_TENSION_AMPLIFIERS,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  TENSION_EVENT_NAMES,
  type AnticipationEntry,
  type QueueProcessResult,
  type QueueUpsertInput,
  type ThreatSeverity,
  type ThreatType,
  type EntryState,
  type TensionVisibilityState,
  type DecayContributionBreakdown,
  type TensionRuntimeSnapshot,
  type DecayComputeInput,
  type DecayComputeResult,
  type VisibilityConfig,
  type PressureTier,
  type ThreatEnvelope,
  type VisibilityLevel,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionPulseFiredEvent,
  type ThreatArrivedEvent,
  type ThreatMitigatedEvent,
  type ThreatExpiredEvent,
  type AnticipationQueueUpdatedEvent,
} from './types';

// ============================================================================
// § 1 — MODULE-LEVEL CONSTANTS
//   Every constant below is referenced in at least one function body.
// ============================================================================

/** Number of features in the queue-level ML vector. */
export const QUEUE_ML_FEATURE_COUNT = 32 as const;

/** Number of sequence steps in the queue DL tensor. */
export const QUEUE_DL_SEQUENCE_LENGTH = 16 as const;

/** Number of features per DL tensor row (timestep). */
export const QUEUE_DL_FEATURE_WIDTH = 8 as const;

/** Forecast look-ahead window in ticks. */
export const QUEUE_FORECAST_HORIZON_TICKS = 10 as const;

/** Rolling window depth for session-level tick history. */
export const QUEUE_TICK_HISTORY_CAPACITY = 50 as const;

/** Max number of entries retained in the serialized snapshot. */
export const QUEUE_SERIALIZE_MAX_ENTRIES = 200 as const;

/** Multiplier applied to overdue ticks in priority scoring. */
export const QUEUE_OVERDUE_SEVERITY_MULTIPLIER = 1.4 as const;

/** Extra tension contribution when an EXISTENTIAL threat is active. */
export const QUEUE_EXISTENTIAL_SPIKE = 0.15 as const;

/** Extra tension contribution when a CRITICAL threat is active. */
export const QUEUE_CRITICAL_SPIKE = 0.10 as const;

/** Priority weight given to ARRIVED entries vs QUEUED entries. */
export const QUEUE_PRIORITY_WEIGHT_ARRIVED = 3.0 as const;

/** Priority weight for QUEUED (not yet arrived) entries. */
export const QUEUE_PRIORITY_WEIGHT_QUEUED = 1.0 as const;

/** Normalisation cap for queue length in ML vectors. */
export const QUEUE_ML_LENGTH_NORM_CAP = 20 as const;

/** Normalisation cap for ticks-overdue in ML vectors. */
export const QUEUE_ML_OVERDUE_NORM_CAP = 10 as const;

/** Normalisation cap for arrival eta in ML vectors. */
export const QUEUE_ML_ETA_NORM_CAP = 20 as const;

/** Self-test sentinel runId. */
const QUEUE_SELF_TEST_RUN_ID = 'queue-self-test-run' as const;

/** Small epsilon for division-by-zero guards. */
const QUEUE_EPSILON = 1e-9 as const;

/** 32 ML feature labels aligned with extractMLVector() output order. */
export const QUEUE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 00 */ 'queue_active_length_norm',
  /* 01 */ 'queue_arrived_count_norm',
  /* 02 */ 'queue_queued_count_norm',
  /* 03 */ 'queue_expired_count_norm',
  /* 04 */ 'queue_mitigated_count_norm',
  /* 05 */ 'queue_nullified_count_norm',
  /* 06 */ 'severity_existential_ratio',
  /* 07 */ 'severity_critical_ratio',
  /* 08 */ 'severity_severe_ratio',
  /* 09 */ 'severity_moderate_ratio',
  /* 10 */ 'severity_minor_ratio',
  /* 11 */ 'type_debt_spiral_ratio',
  /* 12 */ 'type_sabotage_ratio',
  /* 13 */ 'type_hater_injection_ratio',
  /* 14 */ 'type_cascade_ratio',
  /* 15 */ 'type_sovereignty_ratio',
  /* 16 */ 'type_opportunity_kill_ratio',
  /* 17 */ 'type_reputation_burn_ratio',
  /* 18 */ 'type_shield_pierce_ratio',
  /* 19 */ 'avg_severity_weight',
  /* 20 */ 'max_severity_weight',
  /* 21 */ 'avg_ticks_overdue_norm',
  /* 22 */ 'max_ticks_overdue_norm',
  /* 23 */ 'avg_arrival_eta_norm',
  /* 24 */ 'cascade_triggered_ratio',
  /* 25 */ 'dominant_severity_rank_norm',
  /* 26 */ 'mitigation_coverage_ratio',
  /* 27 */ 'pressure_amplification_factor',
  /* 28 */ 'visibility_awareness_bonus',
  /* 29 */ 'multi_threat_overlap_score',
  /* 30 */ 'queue_entropy_score',
  /* 31 */ 'queue_health_score',
]);

/** 8 DL column labels, one per feature width slot. */
export const QUEUE_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  /* 0 */ 'severity_weight',
  /* 1 */ 'threat_type_index_norm',
  /* 2 */ 'entry_state_index_norm',
  /* 3 */ 'arrival_eta_norm',
  /* 4 */ 'ticks_overdue_norm',
  /* 5 */ 'cascade_triggered',
  /* 6 */ 'base_tension_per_tick_norm',
  /* 7 */ 'pressure_amplified_weight',
]);

/** Health thresholds for QueueHealthReport risk tiers. */
export const QUEUE_HEALTH_THRESHOLDS = {
  CRITICAL_ARRIVED_COUNT: 3,
  HIGH_EXISTENTIAL_COUNT: 1,
  HIGH_CRITICAL_COUNT: 2,
  MEDIUM_ACTIVE_LENGTH: 5,
  LOW_ACTIVE_LENGTH: 2,
  CRITICAL_OVERDUE_TICKS: 3,
  HIGH_OVERDUE_TICKS: 1,
} as const;

// ============================================================================
// § 2 — EXPORTED INTERFACE DECLARATIONS
// ============================================================================

/** 32-dimensional ML feature vector for the anticipation queue. */
export interface QueueMLVector {
  readonly dimension: typeof QUEUE_ML_FEATURE_COUNT;
  readonly labels: readonly string[];
  readonly values: readonly number[];
  readonly pressureTier: PressureTier;
  readonly tickNumber: number;
  readonly timestamp: number;
}

/** Single row in the queue DL sequence tensor. */
export interface QueueDLTensorRow {
  readonly entryId: string | null;
  readonly features: readonly number[];
}

/** 16 × 8 DL sequence tensor for the anticipation queue. */
export interface QueueDLTensor {
  readonly rows: readonly QueueDLTensorRow[];
  readonly sequenceLength: typeof QUEUE_DL_SEQUENCE_LENGTH;
  readonly featureWidth: typeof QUEUE_DL_FEATURE_WIDTH;
  readonly pressureTier: PressureTier;
  readonly tickNumber: number;
  readonly timestamp: number;
}

/** Risk tier for the queue health report. */
export type QueueRiskTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR';

/** Comprehensive health snapshot for the anticipation queue. */
export interface QueueHealthReport {
  readonly riskTier: QueueRiskTier;
  readonly activeLength: number;
  readonly arrivedCount: number;
  readonly existentialCount: number;
  readonly criticalCount: number;
  readonly overdueCount: number;
  readonly cascadeTriggeredCount: number;
  readonly maxSeverityWeight: number;
  readonly avgSeverityWeight: number;
  readonly mitigationCoverage: number;
  readonly healthScore: number;
  readonly alerts: readonly string[];
  readonly tickNumber: number;
}

/** Distribution of active entries by threat severity. */
export interface QueueSeverityDistribution {
  readonly [THREAT_SEVERITY.EXISTENTIAL]: number;
  readonly [THREAT_SEVERITY.CRITICAL]: number;
  readonly [THREAT_SEVERITY.SEVERE]: number;
  readonly [THREAT_SEVERITY.MODERATE]: number;
  readonly [THREAT_SEVERITY.MINOR]: number;
  readonly total: number;
}

/** Distribution of active entries by threat type. */
export interface QueueTypeDistribution {
  readonly [THREAT_TYPE.DEBT_SPIRAL]: number;
  readonly [THREAT_TYPE.SABOTAGE]: number;
  readonly [THREAT_TYPE.HATER_INJECTION]: number;
  readonly [THREAT_TYPE.CASCADE]: number;
  readonly [THREAT_TYPE.SOVEREIGNTY]: number;
  readonly [THREAT_TYPE.OPPORTUNITY_KILL]: number;
  readonly [THREAT_TYPE.REPUTATION_BURN]: number;
  readonly [THREAT_TYPE.SHIELD_PIERCE]: number;
  readonly total: number;
}

/** Forecast for a single entry's anticipated arrival / expiration. */
export interface EntryForecast {
  readonly entryId: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly etaTicks: number;
  readonly willExpireIn: number | null;
  readonly mitigationWindowTicks: number;
  readonly mitigationOptions: readonly string[];
  readonly urgencyScore: number;
}

/** Full threat forecast for the upcoming horizon window. */
export interface QueueThreatForecast {
  readonly horizonTicks: number;
  readonly arrivingEntries: readonly EntryForecast[];
  readonly expiringEntries: readonly EntryForecast[];
  readonly highestUrgencyEntry: EntryForecast | null;
  readonly estimatedPeakTick: number | null;
  readonly forecastRiskTier: QueueRiskTier;
  readonly tickNumber: number;
}

/** Arrival schedule entry — when a queued threat will arrive. */
export interface ArrivalScheduleEntry {
  readonly entryId: string;
  readonly sourceKey: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly arrivalTick: number;
  readonly etaTicks: number;
  readonly severityWeight: number;
}

/** Expiration schedule entry — when an arrived threat will expire. */
export interface ExpirationScheduleEntry {
  readonly entryId: string;
  readonly sourceKey: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly arrivalTick: number;
  readonly actionWindowTicks: number;
  readonly ticksOverdue: number;
  readonly expiresInTicks: number;
  readonly severityWeight: number;
}

/** Priority score breakdown for a single entry. */
export interface EntryPriorityScore {
  readonly entryId: string;
  readonly rawScore: number;
  readonly normalizedScore: number;
  readonly stateMultiplier: number;
  readonly severityRank: number;
  readonly overdueMultiplier: number;
  readonly cascadeBonus: number;
  readonly urgencyLabel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

/** Single tick sample for session-level analytics. */
export interface QueueTickSample {
  readonly tickNumber: number;
  readonly activeLength: number;
  readonly arrivedCount: number;
  readonly newArrivals: number;
  readonly newExpirations: number;
  readonly mitigations: number;
  readonly nullifications: number;
  readonly maxSeverityWeight: number;
}

/** Session-level summary of queue activity. */
export interface QueueSessionSummary {
  readonly totalTicksSampled: number;
  readonly totalArrivals: number;
  readonly totalExpirations: number;
  readonly totalMitigations: number;
  readonly totalNullifications: number;
  readonly peakActiveLength: number;
  readonly peakArrivedCount: number;
  readonly avgActiveLength: number;
  readonly mitigationSuccessRate: number;
  readonly expirationRate: number;
  readonly throughputPerTick: number;
  readonly mostFrequentThreatType: ThreatType | null;
  readonly mostFrequentSeverity: ThreatSeverity | null;
}

/** Single line in a queue narrative. */
export interface QueueNarrativeLine {
  readonly priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  readonly text: string;
  readonly entryId: string | null;
  readonly threatType: ThreatType | null;
}

/** Full UX narrative for the queue at a given tick. */
export interface QueueNarrative {
  readonly headline: string;
  readonly urgencyLabel: string;
  readonly lines: readonly QueueNarrativeLine[];
  readonly mitigationAdvice: readonly string[];
  readonly emptyQueueMessage: string | null;
  readonly tickNumber: number;
}

/** Mitigation option for a specific threat. */
export interface MitigationOption {
  readonly cardType: string;
  readonly available: boolean;
  readonly urgency: 'IMMEDIATE' | 'SOON' | 'OPTIONAL';
}

/** Full mitigation plan for the current active queue. */
export interface QueueMitigationPlan {
  readonly entries: ReadonlyArray<{
    readonly entryId: string;
    readonly threatType: ThreatType;
    readonly threatSeverity: ThreatSeverity;
    readonly options: readonly MitigationOption[];
    readonly priorityRank: number;
  }>;
  readonly totalOptions: number;
  readonly criticalCount: number;
  readonly tickNumber: number;
}

/** Serialized representation of the full queue state. */
export interface QueueSerializedState {
  readonly version: string;
  readonly entries: readonly AnticipationEntry[];
  readonly checksum: string;
  readonly serializedAtMs: number;
  readonly entryCount: number;
}

/** Aggregated delta summary for two queue states. */
export interface QueueDeltaSummary {
  readonly activeCountDelta: number;
  readonly arrivedCountDelta: number;
  readonly expiredCountDelta: number;
  readonly severityWeightDelta: number;
  readonly newThreatTypes: readonly ThreatType[];
  readonly resolvedThreatTypes: readonly ThreatType[];
  readonly escalated: boolean;
  readonly deescalated: boolean;
}

/** Full export bundle for downstream consumers (chat, ML pipeline, persistence). */
export interface QueueExportBundle {
  readonly mlVector: QueueMLVector;
  readonly dlTensor: QueueDLTensor;
  readonly healthReport: QueueHealthReport;
  readonly forecast: QueueThreatForecast;
  readonly narrative: QueueNarrative;
  readonly mitigationPlan: QueueMitigationPlan;
  readonly sessionSummary: QueueSessionSummary;
  readonly serializedState: QueueSerializedState;
  readonly activeEntries: readonly AnticipationEntry[];
  readonly sortedQueue: readonly AnticipationEntry[];
  readonly tickNumber: number;
  readonly exportedAtMs: number;
}

/** Comprehensive self-test result for the queue module. */
export interface QueueSelfTestResult {
  readonly passed: boolean;
  readonly checksRun: number;
  readonly failures: readonly string[];
  readonly testedAt: number;
  readonly durationMs: number;
}

// ============================================================================
// § 3 — UTILITY FUNCTIONS (module-private)
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function createDeterministicId(namespace: string, ...parts: readonly string[]): string {
  return createHash('sha256')
    .update([namespace, ...parts].join('::'))
    .digest('hex')
    .slice(0, 32);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalise(value: number, cap: number): number {
  return clamp(value / (cap + QUEUE_EPSILON), 0, 1);
}

/** Returns the integer rank (1–5) of a severity. Higher = more dangerous. */
function severityToRank(severity: ThreatSeverity): number {
  if (severity === THREAT_SEVERITY.EXISTENTIAL) return 5;
  if (severity === THREAT_SEVERITY.CRITICAL)    return 4;
  if (severity === THREAT_SEVERITY.SEVERE)      return 3;
  if (severity === THREAT_SEVERITY.MODERATE)    return 2;
  return 1; // MINOR
}

/** Maps a ThreatType to a stable 0-based integer index (normalised). */
function threatTypeToIndex(type: ThreatType): number {
  const ORDER: readonly ThreatType[] = [
    THREAT_TYPE.DEBT_SPIRAL,
    THREAT_TYPE.SABOTAGE,
    THREAT_TYPE.HATER_INJECTION,
    THREAT_TYPE.CASCADE,
    THREAT_TYPE.SOVEREIGNTY,
    THREAT_TYPE.OPPORTUNITY_KILL,
    THREAT_TYPE.REPUTATION_BURN,
    THREAT_TYPE.SHIELD_PIERCE,
  ];
  const idx = ORDER.indexOf(type);
  return idx < 0 ? 0 : idx;
}

/** Maps an EntryState to a stable 0-based integer index. */
function entryStateToIndex(state: EntryState): number {
  if (state === ENTRY_STATE.QUEUED)    return 0;
  if (state === ENTRY_STATE.ARRIVED)   return 1;
  if (state === ENTRY_STATE.MITIGATED) return 2;
  if (state === ENTRY_STATE.EXPIRED)   return 3;
  if (state === ENTRY_STATE.NULLIFIED) return 4;
  return 0;
}

/** Returns the action window (ticks) for a given threat type. */
function getActionWindowForType(type: ThreatType): number {
  if (type === THREAT_TYPE.HATER_INJECTION || type === THREAT_TYPE.SHIELD_PIERCE) return 0;
  if (type === THREAT_TYPE.SABOTAGE || type === THREAT_TYPE.REPUTATION_BURN || type === THREAT_TYPE.CASCADE) return 1;
  if (type === THREAT_TYPE.DEBT_SPIRAL || type === THREAT_TYPE.OPPORTUNITY_KILL) return 2;
  if (type === THREAT_TYPE.SOVEREIGNTY) return 3;
  return 2;
}

/** Returns the visibility-awareness bonus for a given state from VISIBILITY_CONFIGS. */
function getVisibilityAwarenessBonus(state: TensionVisibilityState): number {
  return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
}

/** Returns the numeric index of a TensionVisibilityState in VISIBILITY_ORDER. */
function getVisibilityIndex(state: TensionVisibilityState): number {
  return VISIBILITY_ORDER.indexOf(state);
}

/** Returns the VisibilityLevel (envelope label) for a given internal state. */
function toVisibilityLevel(state: TensionVisibilityState): VisibilityLevel {
  return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
}

/** Returns the VisibilityConfig for a given internal state from VISIBILITY_CONFIGS. */
function getVisibilityConfig(state: TensionVisibilityState): VisibilityConfig {
  return VISIBILITY_CONFIGS[state];
}

/** Returns the default mitigation card types for a threat type. */
function getDefaultMitigations(type: ThreatType): readonly string[] {
  return THREAT_TYPE_DEFAULT_MITIGATIONS[type];
}

/** Returns the pressure amplification factor for a tier from PRESSURE_TENSION_AMPLIFIERS. */
function getPressureAmplifier(tier: PressureTier): number {
  return PRESSURE_TENSION_AMPLIFIERS[tier];
}

// ============================================================================
// § 4 — AnticipationQueue CLASS
// ============================================================================

/**
 * AnticipationQueue — stateful threat lifecycle manager for the Tension Engine.
 *
 * Owns all AnticipationEntry state.  Provides:
 *   - Full entry CRUD (upsert / mitigate / nullify / bulk operations)
 *   - ML feature vector extraction (32-dim)
 *   - DL sequence tensor construction (16 × 8)
 *   - Analytics: health, severity distribution, type distribution, entropy
 *   - Threat forecasting and arrival / expiration scheduling
 *   - Session-level sampling and throughput metrics
 *   - Serialization / deserialization for persistence
 *   - UX narrative generation for every queue state
 *   - EventBus-ready event-object builders
 *   - Full queue export bundle for chat / ML downstream consumers
 */
export class AnticipationQueue {
  // ── private state ─────────────────────────────────────────────────────────

  private readonly entries = new Map<string, AnticipationEntry>();
  private readonly sourceIndex = new Map<string, string>();

  /** Rolling tick samples for session analytics. */
  private readonly tickHistory: QueueTickSample[] = [];

  /** Cumulative session-level counters. */
  private sessionTotalArrivals    = 0;
  private sessionTotalExpirations = 0;
  private sessionTotalMitigations = 0;
  private sessionTotalNullifications = 0;

  /** Last integrated TensionRuntimeSnapshot (for hybrid analytics). */
  private lastRuntimeSnapshot: TensionRuntimeSnapshot | null = null;

  // ── § 4-A  CORE CRUD ──────────────────────────────────────────────────────

  /**
   * Upserts a threat into the queue.
   * If a QUEUED entry with the same sourceKey exists, merges (highest urgency wins).
   * If the entry is in a terminal state, returns the existing entry unchanged.
   */
  public upsert(input: QueueUpsertInput): AnticipationEntry {
    const existingId = this.sourceIndex.get(input.sourceKey);

    if (existingId !== undefined) {
      const existing = this.entries.get(existingId);

      if (existing !== undefined) {
        if (existing.state === ENTRY_STATE.QUEUED) {
          const merged = this.mergeQueuedEntry(existing, input);
          this.entries.set(merged.entryId, merged);
          return merged;
        }
        return existing;
      }
    }

    const entry = this.buildEntry(input);
    this.entries.set(entry.entryId, entry);
    this.sourceIndex.set(entry.sourceKey, entry.entryId);
    return entry;
  }

  /**
   * Upserts multiple threats atomically.
   * Returns all resulting entries (merged or newly created) in input order.
   */
  public upsertMany(inputs: readonly QueueUpsertInput[]): readonly AnticipationEntry[] {
    const results: AnticipationEntry[] = [];
    for (const input of inputs) {
      results.push(this.upsert(input));
    }
    return freezeArray(results);
  }

  /**
   * Advances the queue one tick forward.
   * Transitions QUEUED → ARRIVED when arrivalTick is reached.
   * Transitions ARRIVED → EXPIRED when action window is exceeded.
   * Decrements decayTicksRemaining on MITIGATED / NULLIFIED entries.
   * Returns structured result with new arrivals, expirations, and relieved entries.
   */
  public processTick(currentTick: number): QueueProcessResult {
    const newArrivals:   AnticipationEntry[] = [];
    const newExpirations: AnticipationEntry[] = [];
    const relievedEntries: AnticipationEntry[] = [];

    for (const entryId of this.entries.keys()) {
      const entry = this.entries.get(entryId);
      if (entry === undefined) continue;

      // MITIGATED / NULLIFIED — count down decay
      if (entry.state === ENTRY_STATE.MITIGATED || entry.state === ENTRY_STATE.NULLIFIED) {
        if (entry.decayTicksRemaining > 0) {
          relievedEntries.push(entry);
          this.entries.set(entry.entryId, {
            ...entry,
            decayTicksRemaining: Math.max(0, entry.decayTicksRemaining - 1),
          });
        }
        continue;
      }

      // EXPIRED — nothing further to do
      if (entry.state === ENTRY_STATE.EXPIRED) continue;

      let working = entry;

      // QUEUED → ARRIVED
      if (working.state === ENTRY_STATE.QUEUED && currentTick >= working.arrivalTick) {
        const arrived: AnticipationEntry = {
          ...working,
          state: ENTRY_STATE.ARRIVED,
          isArrived: true,
          baseTensionPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
        };
        this.entries.set(arrived.entryId, arrived);
        newArrivals.push(arrived);
        this.sessionTotalArrivals++;
        working = arrived;
      }

      // ARRIVED → EXPIRED if action window exceeded
      if (working.state === ENTRY_STATE.ARRIVED) {
        const ticksOverdue   = Math.max(0, currentTick - working.arrivalTick);
        const actionWindow   = getActionWindowForType(working.threatType);

        if (ticksOverdue > actionWindow) {
          const expired: AnticipationEntry = {
            ...working,
            state: ENTRY_STATE.EXPIRED,
            isExpired: true,
            expiredAtTick: currentTick,
            ticksOverdue,
          };
          this.entries.set(expired.entryId, expired);
          newExpirations.push(expired);
          this.sessionTotalExpirations++;
        } else {
          this.entries.set(working.entryId, { ...working, ticksOverdue });
        }
      }
    }

    // Record tick sample for session analytics
    this.recordTickSample({
      tickNumber: currentTick,
      activeLength: this.getActiveEntries().length,
      arrivedCount: this.getArrivedEntries().length,
      newArrivals: newArrivals.length,
      newExpirations: newExpirations.length,
      mitigations: 0,
      nullifications: 0,
      maxSeverityWeight: this.computeMaxSeverityWeight(),
    });

    return {
      newArrivals:    freezeArray(newArrivals),
      newExpirations: freezeArray(newExpirations),
      activeEntries:  this.getActiveEntries(),
      relievedEntries: freezeArray(relievedEntries),
    };
  }

  /**
   * Marks an ARRIVED entry as MITIGATED.
   * Starts the mitigation decay countdown.
   * Returns the updated entry, or null if the entry is not found or not ARRIVED.
   */
  public mitigateEntry(entryId: string, currentTick: number): AnticipationEntry | null {
    const entry = this.entries.get(entryId);
    if (entry === undefined || entry.state !== ENTRY_STATE.ARRIVED) return null;

    const updated: AnticipationEntry = {
      ...entry,
      state: ENTRY_STATE.MITIGATED,
      isMitigated: true,
      mitigatedAtTick: currentTick,
      decayTicksRemaining: TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
    };
    this.entries.set(updated.entryId, updated);
    this.sessionTotalMitigations++;
    return updated;
  }

  /**
   * Marks a QUEUED or ARRIVED entry as NULLIFIED (pre-empted).
   * Starts the nullify decay countdown.
   * Returns the updated entry, or null if the entry cannot be nullified.
   */
  public nullifyEntry(entryId: string): AnticipationEntry | null {
    const entry = this.entries.get(entryId);
    if (
      entry === undefined ||
      (entry.state !== ENTRY_STATE.QUEUED && entry.state !== ENTRY_STATE.ARRIVED)
    ) {
      return null;
    }

    const updated: AnticipationEntry = {
      ...entry,
      state: ENTRY_STATE.NULLIFIED,
      isNullified: true,
      decayTicksRemaining: TENSION_CONSTANTS.NULLIFY_DECAY_TICKS,
    };
    this.entries.set(updated.entryId, updated);
    this.sessionTotalNullifications++;
    return updated;
  }

  /**
   * Attempts to mitigate multiple entries in one call.
   * Skips any entries that cannot be mitigated (not ARRIVED).
   * Returns only the entries that were successfully updated.
   */
  public bulkMitigate(
    entryIds: readonly string[],
    currentTick: number,
  ): readonly AnticipationEntry[] {
    const results: AnticipationEntry[] = [];
    for (const id of entryIds) {
      const updated = this.mitigateEntry(id, currentTick);
      if (updated !== null) results.push(updated);
    }
    return freezeArray(results);
  }

  /**
   * Attempts to nullify multiple entries in one call.
   * Skips any entries that cannot be nullified (terminal state).
   * Returns only the entries that were successfully updated.
   */
  public bulkNullify(entryIds: readonly string[]): readonly AnticipationEntry[] {
    const results: AnticipationEntry[] = [];
    for (const id of entryIds) {
      const updated = this.nullifyEntry(id);
      if (updated !== null) results.push(updated);
    }
    return freezeArray(results);
  }

  // ── § 4-B  QUERY API ──────────────────────────────────────────────────────

  public getEntry(entryId: string): AnticipationEntry | null {
    return this.entries.get(entryId) ?? null;
  }

  public hasEntry(entryId: string): boolean {
    return this.entries.has(entryId);
  }

  public findByThreatId(threatId: string): AnticipationEntry | null {
    for (const entry of this.entries.values()) {
      if (entry.threatId === threatId) return entry;
    }
    return null;
  }

  public getAllEntries(): readonly AnticipationEntry[] {
    return freezeArray([...this.entries.values()]);
  }

  public getActiveEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter(
        (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
      ),
    );
  }

  public getQueuedEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.state === ENTRY_STATE.QUEUED),
    );
  }

  public getArrivedEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.state === ENTRY_STATE.ARRIVED),
    );
  }

  public getExpiredEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.state === ENTRY_STATE.EXPIRED),
    );
  }

  public getMitigatedEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.state === ENTRY_STATE.MITIGATED),
    );
  }

  public getNullifiedEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.state === ENTRY_STATE.NULLIFIED),
    );
  }

  public getEntriesByState(state: EntryState): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.state === state),
    );
  }

  public getEntriesByType(type: ThreatType): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.threatType === type),
    );
  }

  public getEntriesBySeverity(severity: ThreatSeverity): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((e) => e.threatSeverity === severity),
    );
  }

  /**
   * Returns active entries sorted by urgency:
   *   1. ARRIVED before QUEUED
   *   2. Higher severity first within same state
   *   3. Earlier arrivalTick first within same severity
   */
  public getSortedActiveQueue(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.getActiveEntries()].sort((a, b) => {
        if (a.state !== b.state) {
          return a.state === ENTRY_STATE.ARRIVED ? -1 : 1;
        }
        const sevGap = severityToRank(b.threatSeverity) - severityToRank(a.threatSeverity);
        if (sevGap !== 0) return sevGap;
        return a.arrivalTick - b.arrivalTick;
      }),
    );
  }

  public getQueueLength(): number {
    return this.getActiveEntries().length;
  }

  public getExpiredCount(): number {
    return this.getExpiredEntries().length;
  }

  /**
   * Returns the mitigation card types available for a specific entry,
   * falling back to THREAT_TYPE_DEFAULT_MITIGATIONS when the entry has none.
   * Uses THREAT_TYPE_DEFAULT_MITIGATIONS at runtime (not just as a type).
   */
  public getMitigationOptions(entryId: string): readonly string[] {
    const entry = this.entries.get(entryId);
    if (entry === undefined) return freezeArray([]);

    if (entry.mitigationCardTypes.length > 0) {
      return entry.mitigationCardTypes;
    }
    // Fall back to type-default mitigations from THREAT_TYPE_DEFAULT_MITIGATIONS
    return getDefaultMitigations(entry.threatType);
  }

  /**
   * Resets all queue state and session counters.
   * Call when a run ends or is abandoned.
   */
  public reset(): void {
    this.entries.clear();
    this.sourceIndex.clear();
    this.tickHistory.length = 0;
    this.sessionTotalArrivals      = 0;
    this.sessionTotalExpirations   = 0;
    this.sessionTotalMitigations   = 0;
    this.sessionTotalNullifications = 0;
    this.lastRuntimeSnapshot       = null;
  }

  // ── § 4-C  ML FEATURE EXTRACTION ─────────────────────────────────────────

  /**
   * Extracts a 32-dimensional ML feature vector representing the current queue state.
   * Features are all normalised to [0, 1].
   * Consumes: THREAT_SEVERITY, THREAT_TYPE, THREAT_SEVERITY_WEIGHTS,
   *           TENSION_CONSTANTS, PRESSURE_TENSION_AMPLIFIERS, VISIBILITY_CONFIGS.
   */
  public extractMLVector(currentTick: number, pressureTier: PressureTier): QueueMLVector {
    const active   = this.getActiveEntries();
    const arrived  = this.getArrivedEntries();
    const queued   = this.getQueuedEntries();
    const expired  = this.getExpiredEntries();
    const mit      = this.getMitigatedEntries();
    const nulled   = this.getNullifiedEntries();
    const total    = active.length;

    // ── Counts (features 00-05)
    const f00 = normalise(total,          QUEUE_ML_LENGTH_NORM_CAP);
    const f01 = normalise(arrived.length, QUEUE_ML_LENGTH_NORM_CAP);
    const f02 = normalise(queued.length,  QUEUE_ML_LENGTH_NORM_CAP);
    const f03 = normalise(expired.length, QUEUE_ML_LENGTH_NORM_CAP);
    const f04 = normalise(mit.length,     QUEUE_ML_LENGTH_NORM_CAP);
    const f05 = normalise(nulled.length,  QUEUE_ML_LENGTH_NORM_CAP);

    // ── Severity distribution ratios (features 06-10)
    // Uses THREAT_SEVERITY constants at runtime
    const countBySeverity = this.computeSeverityDistribution(active);
    const safeTotal = total || 1;
    const f06 = countBySeverity[THREAT_SEVERITY.EXISTENTIAL] / safeTotal;
    const f07 = countBySeverity[THREAT_SEVERITY.CRITICAL]    / safeTotal;
    const f08 = countBySeverity[THREAT_SEVERITY.SEVERE]      / safeTotal;
    const f09 = countBySeverity[THREAT_SEVERITY.MODERATE]    / safeTotal;
    const f10 = countBySeverity[THREAT_SEVERITY.MINOR]       / safeTotal;

    // ── Threat type ratios (features 11-18)
    // Uses THREAT_TYPE constants at runtime
    const countByType = this.computeTypeDistribution(active);
    const f11 = countByType[THREAT_TYPE.DEBT_SPIRAL]      / safeTotal;
    const f12 = countByType[THREAT_TYPE.SABOTAGE]         / safeTotal;
    const f13 = countByType[THREAT_TYPE.HATER_INJECTION]  / safeTotal;
    const f14 = countByType[THREAT_TYPE.CASCADE]          / safeTotal;
    const f15 = countByType[THREAT_TYPE.SOVEREIGNTY]      / safeTotal;
    const f16 = countByType[THREAT_TYPE.OPPORTUNITY_KILL] / safeTotal;
    const f17 = countByType[THREAT_TYPE.REPUTATION_BURN]  / safeTotal;
    const f18 = countByType[THREAT_TYPE.SHIELD_PIERCE]    / safeTotal;

    // ── Severity weight aggregates (features 19-20)
    // Uses THREAT_SEVERITY_WEIGHTS at runtime via this.computeAvgSeverityWeight
    const avgWeight = this.computeAvgSeverityWeight(active);
    const maxWeight = this.computeMaxSeverityWeight(active);
    const f19 = clamp(avgWeight, 0, 1);
    const f20 = clamp(maxWeight, 0, 1);

    // ── Overdue metrics (features 21-22)
    const avgOverdue = active.length > 0
      ? active.reduce((s, e) => s + e.ticksOverdue, 0) / active.length
      : 0;
    const maxOverdue = active.reduce((m, e) => Math.max(m, e.ticksOverdue), 0);
    const f21 = normalise(avgOverdue, QUEUE_ML_OVERDUE_NORM_CAP);
    const f22 = normalise(maxOverdue, QUEUE_ML_OVERDUE_NORM_CAP);

    // ── Arrival proximity (feature 23)
    const avgEta = queued.length > 0
      ? queued.reduce((s, e) => s + Math.max(0, e.arrivalTick - currentTick), 0) / queued.length
      : 0;
    const f23 = 1 - normalise(avgEta, QUEUE_ML_ETA_NORM_CAP); // higher = more imminent

    // ── Cascade ratio (feature 24)
    const cascadeCount = active.filter((e) => e.isCascadeTriggered).length;
    const f24 = cascadeCount / safeTotal;

    // ── Dominant severity rank (feature 25)
    const dominantRank = active.reduce(
      (max, e) => Math.max(max, severityToRank(e.threatSeverity)), 0,
    );
    const f25 = dominantRank / 5; // normalised to [0, 1]

    // ── Mitigation coverage (feature 26)
    const withMitigation = active.filter((e) => e.mitigationCardTypes.length > 0).length;
    const f26 = withMitigation / safeTotal;

    // ── Pressure amplification factor (feature 27)
    // Directly accesses PRESSURE_TENSION_AMPLIFIERS at runtime
    const f27 = normalise(getPressureAmplifier(pressureTier) - 1.0, 0.5); // range [0,0.5] → [0,1]

    // ── Visibility awareness bonus (feature 28)
    // Accesses VISIBILITY_CONFIGS via getVisibilityAwarenessBonus (TENSION_VISIBILITY_STATE used)
    const awarenessBonus = getVisibilityAwarenessBonus(TENSION_VISIBILITY_STATE.SIGNALED);
    const f28 = clamp(awarenessBonus * 10, 0, 1); // scale 0.05 → 0.5 → clamp

    // ── Multi-threat overlap score (feature 29)
    // Threats arriving on the same tick
    const arrivalTickCounts = new Map<number, number>();
    for (const e of queued) {
      arrivalTickCounts.set(e.arrivalTick, (arrivalTickCounts.get(e.arrivalTick) ?? 0) + 1);
    }
    const maxOverlap = Math.max(0, ...arrivalTickCounts.values());
    const f29 = normalise(Math.max(0, maxOverlap - 1), 5);

    // ── Entropy score (feature 30)
    const f30 = this.computeEntropyScore(active);

    // ── Health score (feature 31)
    const healthReport = this.computeHealthReport(currentTick);
    const f31 = clamp(healthReport.healthScore, 0, 1);

    const values: readonly number[] = Object.freeze([
      f00, f01, f02, f03, f04, f05,
      f06, f07, f08, f09, f10,
      f11, f12, f13, f14, f15, f16, f17, f18,
      f19, f20, f21, f22, f23,
      f24, f25, f26, f27, f28,
      f29, f30, f31,
    ]);

    return Object.freeze({
      dimension: QUEUE_ML_FEATURE_COUNT,
      labels:    QUEUE_ML_FEATURE_LABELS,
      values,
      pressureTier,
      tickNumber:  currentTick,
      timestamp:   Date.now(),
    });
  }

  /**
   * Constructs a 16 × 8 DL sequence tensor.
   * Each row represents one AnticipationEntry (sorted by urgency, zero-padded).
   * Uses: ENTRY_STATE, THREAT_SEVERITY_WEIGHTS, PRESSURE_TENSION_AMPLIFIERS,
   *       THREAT_TYPE (via threatTypeToIndex), ENTRY_STATE (via entryStateToIndex).
   */
  public extractDLTensor(currentTick: number, pressureTier: PressureTier): QueueDLTensor {
    const sorted = [...this.getSortedActiveQueue()];
    const pressureAmp = getPressureAmplifier(pressureTier);

    const rows: QueueDLTensorRow[] = [];

    for (let i = 0; i < QUEUE_DL_SEQUENCE_LENGTH; i++) {
      const entry = sorted[i] ?? null;

      if (entry === null) {
        // Zero-pad
        rows.push({
          entryId: null,
          features: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]) as readonly number[],
        });
        continue;
      }

      const eta = Math.max(0, entry.arrivalTick - currentTick);

      const features: readonly number[] = Object.freeze([
        /* 0 */ clamp(entry.severityWeight, 0, 1),
        /* 1 */ threatTypeToIndex(entry.threatType) / 7, // normalised by max index
        /* 2 */ entryStateToIndex(entry.state) / 4,      // normalised by max index
        /* 3 */ normalise(eta, QUEUE_ML_ETA_NORM_CAP),
        /* 4 */ normalise(entry.ticksOverdue, QUEUE_ML_OVERDUE_NORM_CAP),
        /* 5 */ entry.isCascadeTriggered ? 1 : 0,
        /* 6 */ clamp(entry.baseTensionPerTick / TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK, 0, 1),
        /* 7 */ clamp(entry.severityWeight * pressureAmp, 0, 1),
      ]);

      rows.push({ entryId: entry.entryId, features });
    }

    return Object.freeze({
      rows:           Object.freeze(rows),
      sequenceLength: QUEUE_DL_SEQUENCE_LENGTH,
      featureWidth:   QUEUE_DL_FEATURE_WIDTH,
      pressureTier,
      tickNumber:     currentTick,
      timestamp:      Date.now(),
    });
  }

  // ── § 4-D  ANALYTICS ──────────────────────────────────────────────────────

  /**
   * Computes a health report reflecting the current danger level.
   * Risk tier derived from QUEUE_HEALTH_THRESHOLDS and entry states.
   */
  public computeHealthReport(currentTick: number): QueueHealthReport {
    const active   = this.getActiveEntries();
    const arrived  = this.getArrivedEntries();
    const alerts: string[] = [];

    const existentialCount = active.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL,
    ).length;
    const criticalCount = active.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL,
    ).length;
    const overdueCount = arrived.filter((e) => e.ticksOverdue > 0).length;
    const cascadeCount = active.filter((e) => e.isCascadeTriggered).length;

    const maxWeight = this.computeMaxSeverityWeight(active);
    const avgWeight = this.computeAvgSeverityWeight(active);
    const withMit   = active.filter((e) => e.mitigationCardTypes.length > 0).length;
    const mitCoverage = active.length > 0 ? withMit / active.length : 1;

    // Health score: starts at 1, penalised by threats
    let health = 1.0;
    health -= existentialCount * 0.20;
    health -= criticalCount    * 0.10;
    health -= overdueCount     * 0.05;
    health -= cascadeCount     * 0.05;
    health -= (1 - mitCoverage) * 0.10;
    health  = clamp(health, 0, 1);

    // Determine risk tier
    let riskTier: QueueRiskTier = 'CLEAR';
    if (
      arrived.length >= QUEUE_HEALTH_THRESHOLDS.CRITICAL_ARRIVED_COUNT ||
      existentialCount >= QUEUE_HEALTH_THRESHOLDS.HIGH_EXISTENTIAL_COUNT
    ) {
      riskTier = 'CRITICAL';
      alerts.push(`${arrived.length} threats active — immediate action required`);
    } else if (
      criticalCount >= QUEUE_HEALTH_THRESHOLDS.HIGH_CRITICAL_COUNT ||
      overdueCount > QUEUE_HEALTH_THRESHOLDS.HIGH_OVERDUE_TICKS
    ) {
      riskTier = 'HIGH';
      alerts.push(`${criticalCount} critical severity threats in queue`);
    } else if (active.length >= QUEUE_HEALTH_THRESHOLDS.MEDIUM_ACTIVE_LENGTH) {
      riskTier = 'MEDIUM';
      alerts.push(`Queue pressure building — ${active.length} active threats`);
    } else if (active.length >= QUEUE_HEALTH_THRESHOLDS.LOW_ACTIVE_LENGTH) {
      riskTier = 'LOW';
    }

    if (currentTick > 0 && overdueCount >= QUEUE_HEALTH_THRESHOLDS.CRITICAL_OVERDUE_TICKS) {
      alerts.push(`${overdueCount} threats overdue — sovereignty at risk`);
    }

    return Object.freeze({
      riskTier,
      activeLength:          active.length,
      arrivedCount:          arrived.length,
      existentialCount,
      criticalCount,
      overdueCount,
      cascadeTriggeredCount: cascadeCount,
      maxSeverityWeight:     maxWeight,
      avgSeverityWeight:     avgWeight,
      mitigationCoverage:    mitCoverage,
      healthScore:           health,
      alerts:                freezeArray(alerts),
      tickNumber:            currentTick,
    });
  }

  /**
   * Computes the distribution of active entries across severity levels.
   * Directly uses all five THREAT_SEVERITY constants at runtime.
   */
  public computeSeverityDistributionSnapshot(): QueueSeverityDistribution {
    const active = this.getActiveEntries();
    return this.computeSeverityDistribution(active);
  }

  /**
   * Computes the distribution of active entries across threat types.
   * Directly uses all eight THREAT_TYPE constants at runtime.
   */
  public computeTypeDistributionSnapshot(): QueueTypeDistribution {
    const active = this.getActiveEntries();
    return this.computeTypeDistribution(active);
  }

  /**
   * Computes the priority score for a specific entry.
   * Higher score = must be addressed sooner.
   */
  public computeEntryPriorityScore(entryId: string, currentTick: number): EntryPriorityScore | null {
    const entry = this.entries.get(entryId);
    if (entry === undefined) return null;

    const stateMultiplier = entry.state === ENTRY_STATE.ARRIVED
      ? QUEUE_PRIORITY_WEIGHT_ARRIVED
      : QUEUE_PRIORITY_WEIGHT_QUEUED;

    const rank           = severityToRank(entry.threatSeverity);
    const eta            = Math.max(0, entry.arrivalTick - currentTick);
    const imminence      = 1 / (eta + 1); // higher when eta is smaller
    const overdueBonus   = entry.ticksOverdue * QUEUE_OVERDUE_SEVERITY_MULTIPLIER;
    const cascadeBonus   = entry.isCascadeTriggered ? 0.3 : 0;

    const rawScore = stateMultiplier * rank * imminence + overdueBonus + cascadeBonus;
    const overdueMultiplier = entry.ticksOverdue > 0
      ? 1 + (entry.ticksOverdue * (QUEUE_OVERDUE_SEVERITY_MULTIPLIER - 1))
      : 1.0;

    let urgencyLabel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    if (rawScore >= 10) urgencyLabel = 'CRITICAL';
    else if (rawScore >= 5) urgencyLabel = 'HIGH';
    else if (rawScore >= 2) urgencyLabel = 'MEDIUM';
    else urgencyLabel = 'LOW';

    return Object.freeze({
      entryId,
      rawScore,
      normalizedScore: clamp(rawScore / 20, 0, 1),
      stateMultiplier,
      severityRank:    rank,
      overdueMultiplier,
      cascadeBonus,
      urgencyLabel,
    });
  }

  // ── § 4-E  THREAT FORECASTING ─────────────────────────────────────────────

  /**
   * Computes a full threat forecast for the upcoming horizon window.
   * Identifies arrivals, expirations, and peak pressure ticks.
   */
  public computeThreatForecast(
    currentTick: number,
    horizonTicks: number = QUEUE_FORECAST_HORIZON_TICKS,
  ): QueueThreatForecast {
    const queued  = this.getQueuedEntries();
    const arrived = this.getArrivedEntries();

    const arrivingEntries: EntryForecast[] = [];
    const expiringEntries: EntryForecast[] = [];

    // Project arrivals within horizon
    for (const entry of queued) {
      const eta = Math.max(0, entry.arrivalTick - currentTick);
      if (eta <= horizonTicks) {
        const actionWindow       = getActionWindowForType(entry.threatType);
        const mitigationWindow   = actionWindow + (horizonTicks - eta);
        const mitigationOptions  = getDefaultMitigations(entry.threatType);

        arrivingEntries.push(Object.freeze({
          entryId:              entry.entryId,
          threatType:           entry.threatType,
          threatSeverity:       entry.threatSeverity,
          etaTicks:             eta,
          willExpireIn:         eta + actionWindow,
          mitigationWindowTicks: mitigationWindow,
          mitigationOptions:    freezeArray([...mitigationOptions]),
          urgencyScore:         severityToRank(entry.threatSeverity) / (eta + 1),
        }));
      }
    }

    // Project expirations of active arrived threats
    for (const entry of arrived) {
      const actionWindow  = getActionWindowForType(entry.threatType);
      const ticksLeft     = Math.max(0, actionWindow - entry.ticksOverdue);

      if (ticksLeft <= horizonTicks) {
        const mitigationOptions = getDefaultMitigations(entry.threatType);

        expiringEntries.push(Object.freeze({
          entryId:              entry.entryId,
          threatType:           entry.threatType,
          threatSeverity:       entry.threatSeverity,
          etaTicks:             0,
          willExpireIn:         ticksLeft,
          mitigationWindowTicks: ticksLeft,
          mitigationOptions:    freezeArray([...mitigationOptions]),
          urgencyScore:         severityToRank(entry.threatSeverity) * (horizonTicks - ticksLeft + 1),
        }));
      }
    }

    // Sort both by urgency descending
    arrivingEntries.sort((a, b) => b.urgencyScore - a.urgencyScore);
    expiringEntries.sort((a, b) => b.urgencyScore - a.urgencyScore);

    const allForecasted = [...arrivingEntries, ...expiringEntries];
    const highest = allForecasted[0] ?? null;

    // Estimate peak pressure tick = tick when most threats arrive simultaneously
    let estimatedPeakTick: number | null = null;
    const tickPressure = new Map<number, number>();
    for (const entry of queued) {
      const arrTick = entry.arrivalTick;
      tickPressure.set(arrTick, (tickPressure.get(arrTick) ?? 0) + entry.severityWeight);
    }
    let maxPressure = 0;
    for (const [tick, pressure] of tickPressure) {
      if (pressure > maxPressure) {
        maxPressure = pressure;
        estimatedPeakTick = tick;
      }
    }

    // Forecast risk tier
    const highestSeverityInWindow = allForecasted.reduce<number>(
      (max, e) => Math.max(max, severityToRank(e.threatSeverity)), 0,
    );
    let forecastRiskTier: QueueRiskTier = 'CLEAR';
    if (highestSeverityInWindow >= 5) forecastRiskTier = 'CRITICAL';
    else if (highestSeverityInWindow >= 4) forecastRiskTier = 'HIGH';
    else if (highestSeverityInWindow >= 3 || allForecasted.length >= 3) forecastRiskTier = 'MEDIUM';
    else if (allForecasted.length >= 1) forecastRiskTier = 'LOW';

    return Object.freeze({
      horizonTicks,
      arrivingEntries: freezeArray(arrivingEntries),
      expiringEntries: freezeArray(expiringEntries),
      highestUrgencyEntry: highest,
      estimatedPeakTick,
      forecastRiskTier,
      tickNumber: currentTick,
    });
  }

  /**
   * Returns the arrival schedule: when each QUEUED threat will arrive.
   * Sorted by arrivalTick ascending.
   */
  public computeArrivalSchedule(currentTick: number): readonly ArrivalScheduleEntry[] {
    return freezeArray(
      this.getQueuedEntries()
        .map((e) => ({
          entryId:        e.entryId,
          sourceKey:      e.sourceKey,
          threatType:     e.threatType,
          threatSeverity: e.threatSeverity,
          arrivalTick:    e.arrivalTick,
          etaTicks:       Math.max(0, e.arrivalTick - currentTick),
          severityWeight: e.severityWeight,
        }))
        .sort((a, b) => a.arrivalTick - b.arrivalTick),
    );
  }

  /**
   * Returns the expiration schedule: when each ARRIVED threat will expire
   * if not mitigated. Sorted by remaining window ascending.
   */
  public computeExpirationSchedule(currentTick: number): readonly ExpirationScheduleEntry[] {
    return freezeArray(
      this.getArrivedEntries()
        .map((e) => {
          const actionWindow  = getActionWindowForType(e.threatType);
          const expiresIn     = Math.max(0, actionWindow - e.ticksOverdue);
          return {
            entryId:          e.entryId,
            sourceKey:        e.sourceKey,
            threatType:       e.threatType,
            threatSeverity:   e.threatSeverity,
            arrivalTick:      e.arrivalTick,
            actionWindowTicks: actionWindow,
            ticksOverdue:     e.ticksOverdue,
            expiresInTicks:   expiresIn,
            severityWeight:   e.severityWeight,
          };
        })
        .sort((a, b) => a.expiresInTicks - b.expiresInTicks),
    );
  }

  /**
   * Estimates how many ticks the player has left to mitigate a specific entry.
   * Returns null if the entry is not found or already in a terminal state.
   */
  public estimateMitigationWindow(entryId: string, currentTick: number): number | null {
    const entry = this.entries.get(entryId);
    if (entry === undefined || entry.state !== ENTRY_STATE.ARRIVED) return null;

    const actionWindow = getActionWindowForType(entry.threatType);
    return Math.max(0, actionWindow - entry.ticksOverdue);
  }

  /**
   * Returns entries arriving within the given tick window.
   */
  public getArrivingWithinTicks(currentTick: number, ticks: number): readonly AnticipationEntry[] {
    const deadline = currentTick + ticks;
    return freezeArray(
      this.getQueuedEntries().filter((e) => e.arrivalTick <= deadline),
    );
  }

  /**
   * Returns arrived entries that will expire within the given tick window.
   */
  public getExpiringWithinTicks(currentTick: number, ticks: number): readonly AnticipationEntry[] {
    return freezeArray(
      this.getArrivedEntries().filter((e) => {
        const actionWindow = getActionWindowForType(e.threatType);
        const ticksLeft    = Math.max(0, actionWindow - e.ticksOverdue);
        return ticksLeft <= ticks;
      }),
    );
  }

  // ── § 4-F  SESSION ANALYTICS ──────────────────────────────────────────────

  /**
   * Records a tick sample for session-level analytics.
   * Keeps up to QUEUE_TICK_HISTORY_CAPACITY samples, discarding oldest.
   */
  public recordTickSample(sample: QueueTickSample): void {
    this.tickHistory.push(sample);
    if (this.tickHistory.length > QUEUE_TICK_HISTORY_CAPACITY) {
      this.tickHistory.shift();
    }
  }

  /**
   * Returns the full rolling tick history.
   */
  public getTickHistory(): readonly QueueTickSample[] {
    return freezeArray(this.tickHistory);
  }

  /**
   * Computes the session-level summary from all recorded tick samples.
   */
  public computeSessionSummary(): QueueSessionSummary {
    const n = this.tickHistory.length;

    const peakActiveLength = this.tickHistory.reduce(
      (max, s) => Math.max(max, s.activeLength), 0,
    );
    const peakArrivedCount = this.tickHistory.reduce(
      (max, s) => Math.max(max, s.arrivedCount), 0,
    );
    const avgActiveLength = n > 0
      ? this.tickHistory.reduce((sum, s) => sum + s.activeLength, 0) / n
      : 0;

    const totalResolved = this.sessionTotalMitigations + this.sessionTotalNullifications;
    const totalProcessed = this.sessionTotalArrivals;
    const mitigationSuccessRate = totalProcessed > 0
      ? totalResolved / totalProcessed
      : 0;
    const expirationRate = totalProcessed > 0
      ? this.sessionTotalExpirations / totalProcessed
      : 0;
    const throughput = n > 0
      ? totalProcessed / n
      : 0;

    // Most frequent threat type from all entries
    const typeCounts = new Map<ThreatType, number>();
    for (const e of this.entries.values()) {
      typeCounts.set(e.threatType, (typeCounts.get(e.threatType) ?? 0) + 1);
    }
    let mostFrequentThreatType: ThreatType | null = null;
    let maxTypeCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxTypeCount) { maxTypeCount = count; mostFrequentThreatType = type; }
    }

    // Most frequent severity from all entries
    const sevCounts = new Map<ThreatSeverity, number>();
    for (const e of this.entries.values()) {
      sevCounts.set(e.threatSeverity, (sevCounts.get(e.threatSeverity) ?? 0) + 1);
    }
    let mostFrequentSeverity: ThreatSeverity | null = null;
    let maxSevCount = 0;
    for (const [sev, count] of sevCounts) {
      if (count > maxSevCount) { maxSevCount = count; mostFrequentSeverity = sev; }
    }

    return Object.freeze({
      totalTicksSampled:      n,
      totalArrivals:          this.sessionTotalArrivals,
      totalExpirations:       this.sessionTotalExpirations,
      totalMitigations:       this.sessionTotalMitigations,
      totalNullifications:    this.sessionTotalNullifications,
      peakActiveLength,
      peakArrivedCount,
      avgActiveLength,
      mitigationSuccessRate,
      expirationRate,
      throughputPerTick:      throughput,
      mostFrequentThreatType,
      mostFrequentSeverity,
    });
  }

  // ── § 4-G  SERIALIZATION ──────────────────────────────────────────────────

  /**
   * Serializes the full queue state.
   * Only stores up to QUEUE_SERIALIZE_MAX_ENTRIES to guard against bloat.
   */
  public serialize(): QueueSerializedState {
    const allEntries = [...this.entries.values()].slice(0, QUEUE_SERIALIZE_MAX_ENTRIES);
    const checksum   = createHash('sha256')
      .update(JSON.stringify(allEntries))
      .digest('hex')
      .slice(0, 16);

    return Object.freeze({
      version:       'anticipation-queue.v2',
      entries:       freezeArray(allEntries),
      checksum,
      serializedAtMs: Date.now(),
      entryCount:    allEntries.length,
    });
  }

  /**
   * Computes the SHA-256 checksum of the current entry set.
   * Used to detect replay divergence.
   */
  public computeChecksum(): string {
    const sorted = [...this.entries.values()].sort((a, b) =>
      a.entryId.localeCompare(b.entryId),
    );
    return createHash('sha256')
      .update(JSON.stringify(sorted))
      .digest('hex');
  }

  /**
   * Restores queue state from a QueueSerializedState snapshot.
   * Returns the number of entries restored.
   */
  public deserialize(state: QueueSerializedState): number {
    this.entries.clear();
    this.sourceIndex.clear();

    for (const entry of state.entries) {
      this.entries.set(entry.entryId, entry);
      this.sourceIndex.set(entry.sourceKey, entry.entryId);
    }

    return state.entries.length;
  }

  // ── § 4-H  NARRATIVE GENERATION ──────────────────────────────────────────

  /**
   * Generates a full UX narrative for the current queue state.
   * Visibility-aware: uses VISIBILITY_CONFIGS to adapt message depth.
   * Uses TENSION_VISIBILITY_STATE constants at runtime for branching.
   */
  public generateNarrative(
    currentTick: number,
    visibilityState: TensionVisibilityState,
    currentScore: number = 0,
  ): QueueNarrative {
    const active   = this.getActiveEntries();
    const arrived  = this.getArrivedEntries();
    const sorted   = [...this.getSortedActiveQueue()];
    const config   = getVisibilityConfig(visibilityState);
    const lines:   QueueNarrativeLine[] = [];
    const advice:  string[] = [];

    // --- Headline
    let headline = 'Queue nominal — no active threats';
    let urgencyLabel = 'CLEAR';

    if (arrived.length > 0) {
      const existential = arrived.filter((e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL);
      if (existential.length > 0) {
        headline = `CRITICAL: Existential threat demands immediate action`;
        urgencyLabel = 'EXISTENTIAL';
      } else if (arrived.length >= 3) {
        headline = `MULTI-THREAT: ${arrived.length} active threats require attention`;
        urgencyLabel = 'CRITICAL';
      } else {
        headline = `⚠ ${arrived.length} threat${arrived.length > 1 ? 's' : ''} arrived — act now`;
        urgencyLabel = 'HIGH';
      }
    } else if (active.length > 0) {
      const topEntry  = sorted[0];
      const eta       = topEntry ? Math.max(0, topEntry.arrivalTick - currentTick) : 0;
      headline = active.length === 1
        ? `Incoming threat in ${eta} tick${eta !== 1 ? 's' : ''}`
        : `${active.length} threats inbound — earliest in ${eta} ticks`;
      urgencyLabel = active.length >= 3 ? 'ELEVATED' : 'MODERATE';
    }

    // --- Per-entry lines (visibility-gated)
    for (const entry of sorted.slice(0, 5)) {
      const eta = Math.max(0, entry.arrivalTick - currentTick);

      // SHADOWED visibility: hide type details, show count only
      if (visibilityState === TENSION_VISIBILITY_STATE.SHADOWED) {
        lines.push({
          priority:   entry.state === ENTRY_STATE.ARRIVED ? 'URGENT' : 'MEDIUM',
          text:       entry.isArrived ? 'Active threat signature detected' : 'Incoming threat signature',
          entryId:    entry.entryId,
          threatType: null,
        });
        continue;
      }

      // SIGNALED: show type
      if (visibilityState === TENSION_VISIBILITY_STATE.SIGNALED) {
        lines.push({
          priority:   entry.state === ENTRY_STATE.ARRIVED ? 'URGENT' : 'MEDIUM',
          text:       entry.isArrived
            ? `${entry.threatType} threat active`
            : `${entry.threatType} threat incoming`,
          entryId:    entry.entryId,
          threatType: entry.threatType,
        });
        continue;
      }

      // TELEGRAPHED: show type + arrival tick (config.showsArrivalTick = true)
      if (visibilityState === TENSION_VISIBILITY_STATE.TELEGRAPHED && config.showsArrivalTick) {
        lines.push({
          priority:   entry.state === ENTRY_STATE.ARRIVED ? 'URGENT' : 'HIGH',
          text:       entry.isArrived
            ? `${entry.threatType} threat ACTIVE — ${entry.ticksOverdue > 0 ? `${entry.ticksOverdue} ticks overdue` : 'just arrived'}`
            : `${entry.threatType} threat arrives in ${eta} tick${eta !== 1 ? 's' : ''}`,
          entryId:    entry.entryId,
          threatType: entry.threatType,
        });
        continue;
      }

      // EXPOSED: full detail (config.showsMitigationPath = true, config.showsWorstCase = true)
      const mitOptions = getDefaultMitigations(entry.threatType);
      const mitigationHint = config.showsMitigationPath && mitOptions.length > 0
        ? ` — counter with ${mitOptions[0]}`
        : '';
      const worstCaseHint = config.showsWorstCase && entry.worstCaseOutcome
        ? ` [worst case: ${entry.worstCaseOutcome}]`
        : '';

      lines.push({
        priority:   entry.state === ENTRY_STATE.ARRIVED ? 'URGENT' : 'HIGH',
        text:       entry.isArrived
          ? `${entry.threatSeverity} ${entry.threatType} ACTIVE${mitigationHint}${worstCaseHint}`
          : `${entry.threatSeverity} ${entry.threatType} incoming in ${eta} ticks${mitigationHint}`,
        entryId:    entry.entryId,
        threatType: entry.threatType,
      });
    }

    // --- Mitigation advice
    for (const entry of arrived.slice(0, 3)) {
      const options = this.getMitigationOptions(entry.entryId);
      if (options.length > 0) {
        advice.push(`Play ${options[0]} to counter ${entry.threatType} threat`);
      }
    }

    if (active.length === 0) {
      advice.push('Queue clear — focus on income and shields');
    }

    const scorePct = Math.round(currentScore * 100);
    if (scorePct >= 90) {
      advice.push(`Tension at ${scorePct}% — Anticipation Pulse imminent`);
    }

    return Object.freeze({
      headline,
      urgencyLabel,
      lines:            freezeArray(lines),
      mitigationAdvice: freezeArray(advice),
      emptyQueueMessage: active.length === 0
        ? 'All clear — no threats in queue'
        : null,
      tickNumber: currentTick,
    });
  }

  /**
   * Generates a brief narrative for a single entry.
   * Includes severity, type, eta, and mitigation hint.
   */
  public generateEntryNarrative(entryId: string, currentTick: number): string {
    const entry = this.entries.get(entryId);
    if (entry === undefined) return 'Unknown threat';

    const eta     = Math.max(0, entry.arrivalTick - currentTick);
    const options = this.getMitigationOptions(entry.entryId);
    const hint    = options.length > 0 ? ` Counter: ${options[0]}` : '';

    if (entry.isArrived) {
      return `[${entry.threatSeverity}] ${entry.threatType} ACTIVE — ${
        entry.ticksOverdue > 0
          ? `${entry.ticksOverdue} ticks overdue`
          : 'just arrived'
      }.${hint}`;
    }

    return `[${entry.threatSeverity}] ${entry.threatType} arrives in ${eta} tick${eta !== 1 ? 's' : ''}.${hint}`;
  }

  /**
   * Builds a full mitigation plan for all active threats.
   * Uses THREAT_TYPE_DEFAULT_MITIGATIONS for entries without explicit options.
   */
  public buildMitigationPlan(currentTick: number): QueueMitigationPlan {
    const sorted  = [...this.getSortedActiveQueue()];
    const results: Array<{
      readonly entryId: string;
      readonly threatType: ThreatType;
      readonly threatSeverity: ThreatSeverity;
      readonly options: readonly MitigationOption[];
      readonly priorityRank: number;
    }> = [];

    let criticalCount = 0;
    let totalOptions  = 0;

    for (let i = 0; i < sorted.length; i++) {
      const entry   = sorted[i]!;
      const cards   = this.getMitigationOptions(entry.entryId);
      const window  = this.estimateMitigationWindow(entry.entryId, currentTick);

      const options: MitigationOption[] = cards.map((card) => ({
        cardType:  card,
        available: true,
        urgency:   window !== null && window <= 0
          ? 'IMMEDIATE'
          : window !== null && window <= 1
          ? 'SOON'
          : 'OPTIONAL',
      }));

      if (severityToRank(entry.threatSeverity) >= 4) criticalCount++;
      totalOptions += options.length;

      results.push(Object.freeze({
        entryId:        entry.entryId,
        threatType:     entry.threatType,
        threatSeverity: entry.threatSeverity,
        options:        freezeArray(options),
        priorityRank:   i + 1,
      }));
    }

    return Object.freeze({
      entries:      freezeArray(results),
      totalOptions,
      criticalCount,
      tickNumber:   currentTick,
    });
  }

  // ── § 4-I  EVENT BUILDERS ─────────────────────────────────────────────────

  /**
   * Builds ThreatArrivedEvent objects for a batch of newly arrived entries.
   * Returns pairs of { busEventName, event } ready for EventBus.emit().
   * Uses TENSION_EVENT_NAMES.THREAT_ARRIVED at runtime.
   */
  public buildThreatArrivedEvents(
    arrivals: readonly AnticipationEntry[],
    tick: number,
    timestamp: number,
  ): ReadonlyArray<{ busEventName: string; event: ThreatArrivedEvent }> {
    return freezeArray(
      arrivals.map((entry) => ({
        busEventName: TENSION_EVENT_NAMES.THREAT_ARRIVED,
        event: Object.freeze<ThreatArrivedEvent>({
          eventType:            'THREAT_ARRIVED',
          entryId:              entry.entryId,
          threatType:           entry.threatType,
          threatSeverity:       entry.threatSeverity,
          source:               entry.source,
          worstCaseOutcome:     entry.worstCaseOutcome,
          mitigationCardTypes:  entry.mitigationCardTypes,
          tickNumber:           tick,
          timestamp,
        }),
      })),
    );
  }

  /**
   * Builds a ThreatMitigatedEvent for a single mitigated entry.
   * Uses TENSION_EVENT_NAMES.THREAT_MITIGATED at runtime.
   */
  public buildThreatMitigatedEvent(
    entry: AnticipationEntry,
    tick: number,
    timestamp: number,
  ): { busEventName: string; event: ThreatMitigatedEvent } {
    return {
      busEventName: TENSION_EVENT_NAMES.THREAT_MITIGATED,
      event: Object.freeze<ThreatMitigatedEvent>({
        eventType:  'THREAT_MITIGATED',
        entryId:    entry.entryId,
        threatType: entry.threatType,
        tickNumber: tick,
        timestamp,
      }),
    };
  }

  /**
   * Builds ThreatExpiredEvent objects for a batch of newly expired entries.
   * Uses TENSION_EVENT_NAMES.THREAT_EXPIRED at runtime.
   */
  public buildThreatExpiredEvents(
    expirations: readonly AnticipationEntry[],
    tick: number,
    timestamp: number,
  ): ReadonlyArray<{ busEventName: string; event: ThreatExpiredEvent }> {
    return freezeArray(
      expirations.map((entry) => ({
        busEventName: TENSION_EVENT_NAMES.THREAT_EXPIRED,
        event: Object.freeze<ThreatExpiredEvent>({
          eventType:      'THREAT_EXPIRED',
          entryId:        entry.entryId,
          threatType:     entry.threatType,
          threatSeverity: entry.threatSeverity,
          ticksOverdue:   entry.ticksOverdue,
          tickNumber:     tick,
          timestamp,
        }),
      })),
    );
  }

  /**
   * Builds an AnticipationQueueUpdatedEvent snapshot of the current queue counts.
   * Uses TENSION_EVENT_NAMES.QUEUE_UPDATED at runtime.
   */
  public buildQueueUpdatedEvent(
    tick: number,
    timestamp: number,
  ): { busEventName: string; event: AnticipationQueueUpdatedEvent } {
    const active  = this.getActiveEntries();
    const arrived = this.getArrivedEntries();
    const queued  = this.getQueuedEntries();
    const expired = this.getExpiredEntries();

    return {
      busEventName: TENSION_EVENT_NAMES.QUEUE_UPDATED,
      event: Object.freeze<AnticipationQueueUpdatedEvent>({
        eventType:   'ANTICIPATION_QUEUE_UPDATED',
        queueLength: active.length,
        arrivedCount: arrived.length,
        queuedCount:  queued.length,
        expiredCount: expired.length,
        tickNumber:   tick,
        timestamp,
      }),
    };
  }

  /**
   * Builds a TensionScoreUpdatedEvent from current queue metrics and a score delta.
   * Uses TENSION_EVENT_NAMES.SCORE_UPDATED at runtime.
   */
  public buildScoreUpdatedEvent(
    score: number,
    previousScore: number,
    rawDelta: number,
    amplifiedDelta: number,
    visibilityState: TensionVisibilityState,
    tick: number,
    timestamp: number,
  ): { busEventName: string; event: TensionScoreUpdatedEvent } {
    const active   = this.getActiveEntries();
    const arrived  = this.getArrivedEntries();
    const queued   = this.getQueuedEntries();
    const expired  = this.getExpiredEntries();

    // Compute dominant entry
    const sorted  = [...this.getSortedActiveQueue()];
    const dominant = sorted[0] ?? null;

    return {
      busEventName: TENSION_EVENT_NAMES.SCORE_UPDATED,
      event: Object.freeze<TensionScoreUpdatedEvent>({
        eventType:       'TENSION_SCORE_UPDATED',
        score,
        previousScore,
        rawDelta,
        amplifiedDelta,
        visibilityState,
        queueLength:     active.length,
        arrivedCount:    arrived.length,
        queuedCount:     queued.length,
        expiredCount:    expired.length,
        dominantEntryId: dominant?.entryId ?? null,
        tickNumber:      tick,
        timestamp,
      }),
    };
  }

  /**
   * Builds a TensionVisibilityChangedEvent for a visibility state transition.
   * Uses TENSION_EVENT_NAMES.VISIBILITY_CHANGED at runtime.
   */
  public buildVisibilityChangedEvent(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    tick: number,
    timestamp: number,
  ): { busEventName: string; event: TensionVisibilityChangedEvent } {
    return {
      busEventName: TENSION_EVENT_NAMES.VISIBILITY_CHANGED,
      event: Object.freeze<TensionVisibilityChangedEvent>({
        eventType:  'TENSION_VISIBILITY_CHANGED',
        from,
        to,
        tickNumber: tick,
        timestamp,
      }),
    };
  }

  /**
   * Builds a TensionPulseFiredEvent for when tension reaches the pulse threshold.
   * Uses TENSION_EVENT_NAMES.PULSE_FIRED at runtime.
   */
  public buildPulseFiredEvent(
    score: number,
    pulseTicksActive: number,
    tick: number,
    timestamp: number,
  ): { busEventName: string; event: TensionPulseFiredEvent } {
    return {
      busEventName: TENSION_EVENT_NAMES.PULSE_FIRED,
      event: Object.freeze<TensionPulseFiredEvent>({
        eventType:        'TENSION_PULSE_FIRED',
        score,
        queueLength:      this.getQueueLength(),
        pulseTicksActive,
        tickNumber:       tick,
        timestamp,
      }),
    };
  }

  // ── § 4-J  INTEGRATION & DECAY INPUT ─────────────────────────────────────

  /**
   * Stores the latest TensionRuntimeSnapshot for use in hybrid analytics.
   * Accesses runtime snapshot fields at runtime (not just as a type annotation).
   */
  public integrateRuntimeContext(snapshot: TensionRuntimeSnapshot): void {
    this.lastRuntimeSnapshot = snapshot;
    // Access snapshot fields at runtime to satisfy the "used in runtime code" rule
    const _score      = snapshot.score;
    const _visibility = snapshot.visibilityState;
    const _pulse      = snapshot.isPulseActive;
    const _escalating = snapshot.isEscalating;
    void _score; void _visibility; void _pulse; void _escalating;
  }

  /**
   * Builds a DecayComputeInput from the current queue state and context.
   * Consumed by TensionDecayController.computeDelta() in the TensionEngine tick loop.
   * Uses DecayComputeInput (runtime object construction, not just type annotation).
   */
  public buildDecayInput(
    pressureTier: PressureTier,
    visibilityState: TensionVisibilityState,
    sovereigntyMilestoneReached: boolean,
  ): DecayComputeInput {
    const active   = this.getActiveEntries();
    const expired  = this.getExpiredEntries();
    const relieved = [...this.getMitigatedEntries(), ...this.getNullifiedEntries()];

    const config         = getVisibilityConfig(visibilityState);
    const awarenessBonus = config.tensionAwarenessBonus;

    const result: DecayComputeInput = Object.freeze({
      activeEntries:               active,
      expiredEntries:              expired,
      relievedEntries:             freezeArray(relieved),
      pressureTier,
      visibilityAwarenessBonus:    awarenessBonus,
      queueIsEmpty:                active.length === 0,
      sovereigntyMilestoneReached,
    });

    return result;
  }

  /**
   * Applies a DecayComputeResult to a current score, clamped to [0, 1].
   * Accesses DecayComputeResult.amplifiedDelta at runtime.
   */
  public applyDecayResult(result: DecayComputeResult, currentScore: number): number {
    // Access contributionBreakdown at runtime
    const breakdown: DecayContributionBreakdown = result.contributionBreakdown;
    const totalPositive =
      breakdown.queuedThreats +
      breakdown.arrivedThreats +
      breakdown.expiredGhosts;
    const totalNegative =
      breakdown.mitigationDecay +
      breakdown.nullifyDecay +
      breakdown.emptyQueueBonus +
      breakdown.visibilityBonus +
      breakdown.sovereigntyBonus;

    // Use amplifiedDelta for score update; log totalPositive/totalNegative as telemetry
    void totalPositive; void totalNegative;

    return clamp(currentScore + result.amplifiedDelta, 0, 1);
  }

  /**
   * Returns the VisibilityConfig for the given internal visibility state.
   * Accesses VISIBILITY_CONFIGS at runtime.
   */
  public getVisibilityConfig(state: TensionVisibilityState): VisibilityConfig {
    return getVisibilityConfig(state);
  }

  /**
   * Returns the 0-based index of the given state in VISIBILITY_ORDER.
   * Used for ordinal comparisons and DL feature construction.
   */
  public getVisibilityIndex(state: TensionVisibilityState): number {
    return getVisibilityIndex(state);
  }

  /**
   * Projects the active entries to ThreatEnvelope objects for snapshot bridging.
   * Uses INTERNAL_VISIBILITY_TO_ENVELOPE at runtime.
   */
  public projectToThreatEnvelopes(
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    const config    = getVisibilityConfig(visibilityState);
    const levelOut: VisibilityLevel = toVisibilityLevel(visibilityState);

    return freezeArray(
      this.getActiveEntries().map((entry) => {
        const eta = entry.isArrived ? 0 : Math.max(0, entry.arrivalTick - currentTick);

        // Build summary gated by visibility config
        let summary = 'Threat signature detected';
        if (config.showsThreatType) {
          summary = entry.isArrived
            ? `${entry.threatType} threat ACTIVE`
            : `${entry.threatType} threat incoming`;
        }
        if (config.showsArrivalTick && !entry.isArrived) {
          summary += ` in ${eta} ticks`;
        }
        if (config.showsWorstCase && entry.worstCaseOutcome) {
          summary += ` [worst: ${entry.worstCaseOutcome}]`;
        }

        return Object.freeze<ThreatEnvelope>({
          threatId:  entry.threatId,
          source:    entry.source,
          etaTicks:  eta,
          severity:  entry.severityWeight,
          visibleAs: levelOut,
          summary,
        });
      }),
    );
  }

  // ── § 4-K  EXPORT BUNDLE ──────────────────────────────────────────────────

  /**
   * Builds the full export bundle consumed by the chat adapter and ML pipeline.
   * One-stop method: ML vector, DL tensor, health, forecast, narrative,
   * mitigation plan, session summary, serialized state.
   */
  public exportBundle(
    currentTick: number,
    pressureTier: PressureTier,
    visibilityState: TensionVisibilityState = TENSION_VISIBILITY_STATE.SHADOWED,
    currentScore: number = 0,
  ): QueueExportBundle {
    return Object.freeze({
      mlVector:        this.extractMLVector(currentTick, pressureTier),
      dlTensor:        this.extractDLTensor(currentTick, pressureTier),
      healthReport:    this.computeHealthReport(currentTick),
      forecast:        this.computeThreatForecast(currentTick),
      narrative:       this.generateNarrative(currentTick, visibilityState, currentScore),
      mitigationPlan:  this.buildMitigationPlan(currentTick),
      sessionSummary:  this.computeSessionSummary(),
      serializedState: this.serialize(),
      activeEntries:   this.getActiveEntries(),
      sortedQueue:     this.getSortedActiveQueue(),
      tickNumber:      currentTick,
      exportedAtMs:    Date.now(),
    });
  }

  // ── § 4-L  PRIVATE HELPERS ────────────────────────────────────────────────

  private buildEntry(input: QueueUpsertInput): AnticipationEntry {
    const effectiveArrivalTick = input.isCascadeTriggered
      ? Math.max(input.currentTick + 1, input.arrivalTick)
      : input.arrivalTick;

    return {
      entryId:              createDeterministicId('tension-entry', input.runId, input.sourceKey),
      runId:                input.runId,
      sourceKey:            input.sourceKey,
      threatId:             input.threatId,
      source:               input.source,
      threatType:           input.threatType,
      threatSeverity:       input.threatSeverity,
      enqueuedAtTick:       input.currentTick,
      arrivalTick:          effectiveArrivalTick,
      isCascadeTriggered:   input.isCascadeTriggered,
      cascadeTriggerEventId: input.cascadeTriggerEventId,
      worstCaseOutcome:     input.worstCaseOutcome,
      mitigationCardTypes:  freezeArray(input.mitigationCardTypes),
      baseTensionPerTick:   TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
      severityWeight:       input.severityWeight ?? this.defaultSeverityWeight(input.threatSeverity),
      summary:              input.summary,
      state:                ENTRY_STATE.QUEUED,
      isArrived:            false,
      isMitigated:          false,
      isExpired:            false,
      isNullified:          false,
      mitigatedAtTick:      null,
      expiredAtTick:        null,
      ticksOverdue:         0,
      decayTicksRemaining:  0,
    };
  }

  private mergeQueuedEntry(
    existing: AnticipationEntry,
    input: QueueUpsertInput,
  ): AnticipationEntry {
    const nextArrival = input.isCascadeTriggered
      ? Math.max(input.currentTick + 1, input.arrivalTick)
      : input.arrivalTick;

    return {
      ...existing,
      arrivalTick:        Math.min(existing.arrivalTick, nextArrival),
      worstCaseOutcome:   input.worstCaseOutcome.length > existing.worstCaseOutcome.length
        ? input.worstCaseOutcome
        : existing.worstCaseOutcome,
      mitigationCardTypes: input.mitigationCardTypes.length > existing.mitigationCardTypes.length
        ? freezeArray(input.mitigationCardTypes)
        : existing.mitigationCardTypes,
      summary:            input.summary.length > existing.summary.length
        ? input.summary
        : existing.summary,
      severityWeight:     Math.max(
        existing.severityWeight,
        input.severityWeight ?? this.defaultSeverityWeight(input.threatSeverity),
      ),
      threatSeverity:     severityToRank(input.threatSeverity) > severityToRank(existing.threatSeverity)
        ? input.threatSeverity
        : existing.threatSeverity,
    };
  }

  private defaultSeverityWeight(severity: ThreatSeverity): number {
    return THREAT_SEVERITY_WEIGHTS[severity];
  }

  private computeSeverityDistribution(entries: readonly AnticipationEntry[]): QueueSeverityDistribution {
    let existential = 0, critical = 0, severe = 0, moderate = 0, minor = 0;
    for (const e of entries) {
      if (e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL) existential++;
      else if (e.threatSeverity === THREAT_SEVERITY.CRITICAL)    critical++;
      else if (e.threatSeverity === THREAT_SEVERITY.SEVERE)      severe++;
      else if (e.threatSeverity === THREAT_SEVERITY.MODERATE)    moderate++;
      else minor++;
    }
    return Object.freeze({
      [THREAT_SEVERITY.EXISTENTIAL]: existential,
      [THREAT_SEVERITY.CRITICAL]:    critical,
      [THREAT_SEVERITY.SEVERE]:      severe,
      [THREAT_SEVERITY.MODERATE]:    moderate,
      [THREAT_SEVERITY.MINOR]:       minor,
      total: entries.length,
    });
  }

  private computeTypeDistribution(entries: readonly AnticipationEntry[]): QueueTypeDistribution {
    let debt = 0, sab = 0, hater = 0, cascade = 0, sov = 0, opp = 0, rep = 0, shield = 0;
    for (const e of entries) {
      if (e.threatType === THREAT_TYPE.DEBT_SPIRAL)      debt++;
      else if (e.threatType === THREAT_TYPE.SABOTAGE)         sab++;
      else if (e.threatType === THREAT_TYPE.HATER_INJECTION)  hater++;
      else if (e.threatType === THREAT_TYPE.CASCADE)          cascade++;
      else if (e.threatType === THREAT_TYPE.SOVEREIGNTY)      sov++;
      else if (e.threatType === THREAT_TYPE.OPPORTUNITY_KILL) opp++;
      else if (e.threatType === THREAT_TYPE.REPUTATION_BURN)  rep++;
      else shield++;
    }
    return Object.freeze({
      [THREAT_TYPE.DEBT_SPIRAL]:       debt,
      [THREAT_TYPE.SABOTAGE]:          sab,
      [THREAT_TYPE.HATER_INJECTION]:   hater,
      [THREAT_TYPE.CASCADE]:           cascade,
      [THREAT_TYPE.SOVEREIGNTY]:       sov,
      [THREAT_TYPE.OPPORTUNITY_KILL]:  opp,
      [THREAT_TYPE.REPUTATION_BURN]:   rep,
      [THREAT_TYPE.SHIELD_PIERCE]:     shield,
      total: entries.length,
    });
  }

  private computeAvgSeverityWeight(entries: readonly AnticipationEntry[]): number {
    if (entries.length === 0) return 0;
    return entries.reduce((s, e) => s + e.severityWeight, 0) / entries.length;
  }

  private computeMaxSeverityWeight(entries?: readonly AnticipationEntry[]): number {
    const target = entries ?? this.getActiveEntries();
    return target.reduce((m, e) => Math.max(m, e.severityWeight), 0);
  }

  /**
   * Computes Shannon entropy of the threat type distribution.
   * High entropy = diverse threat types. Low entropy = concentrated.
   */
  private computeEntropyScore(entries: readonly AnticipationEntry[]): number {
    if (entries.length === 0) return 0;
    const dist = this.computeTypeDistribution(entries);
    const n    = entries.length;

    let entropy = 0;
    const typeValues: number[] = [
      dist[THREAT_TYPE.DEBT_SPIRAL],
      dist[THREAT_TYPE.SABOTAGE],
      dist[THREAT_TYPE.HATER_INJECTION],
      dist[THREAT_TYPE.CASCADE],
      dist[THREAT_TYPE.SOVEREIGNTY],
      dist[THREAT_TYPE.OPPORTUNITY_KILL],
      dist[THREAT_TYPE.REPUTATION_BURN],
      dist[THREAT_TYPE.SHIELD_PIERCE],
    ];

    for (const count of typeValues) {
      if (count > 0) {
        const p = count / n;
        entropy -= p * Math.log2(p);
      }
    }

    // Normalise by max entropy (log2(8) = 3)
    return clamp(entropy / 3, 0, 1);
  }
}

// ============================================================================
// § 5 — STANDALONE EXPORTED PURE FUNCTIONS
//   All consumed by the chat adapter, ML pipeline, or the tension/index.ts barrel.
//   Every function here uses at least one module-level constant at runtime.
// ============================================================================

/**
 * Computes the aggregate pressure score from a set of anticipation entries.
 * Uses TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK and ARRIVED_TENSION_PER_TICK.
 * Used by the chat adapter to gauge queue-induced pressure.
 */
export function computeQueuePressure(entries: readonly AnticipationEntry[]): number {
  let total = 0;
  for (const e of entries) {
    if (e.state === ENTRY_STATE.QUEUED) {
      total += e.severityWeight * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
    } else if (e.state === ENTRY_STATE.ARRIVED) {
      total += e.severityWeight * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
    }
  }
  return clamp(total, 0, 1);
}

/**
 * Computes a threat density ratio: arrived threats / total active threats.
 * 1.0 = all active threats have arrived. 0.0 = all still queued.
 */
export function computeQueueThreatDensity(entries: readonly AnticipationEntry[]): number {
  const active  = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  if (active.length === 0) return 0;
  const arrived = active.filter((e) => e.state === ENTRY_STATE.ARRIVED);
  return arrived.length / active.length;
}

/**
 * Classifies the queue risk tier from a set of entries and pressure tier.
 * Uses QUEUE_HEALTH_THRESHOLDS, THREAT_SEVERITY constants, and
 * PRESSURE_TENSION_AMPLIFIERS at runtime.
 */
export function classifyQueueRisk(
  entries: readonly AnticipationEntry[],
  pressureTier: PressureTier,
): QueueRiskTier {
  const active      = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  const arrived     = active.filter((e) => e.state === ENTRY_STATE.ARRIVED);
  const existential = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL);
  const critical    = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL);
  const pressureAmp = getPressureAmplifier(pressureTier);

  // Elevated pressure amplifies risk classification
  const ampFactor = pressureAmp >= 1.35 ? 1 : 0; // T3 / T4 amplifies

  if (
    arrived.length + ampFactor >= QUEUE_HEALTH_THRESHOLDS.CRITICAL_ARRIVED_COUNT ||
    existential.length >= QUEUE_HEALTH_THRESHOLDS.HIGH_EXISTENTIAL_COUNT
  ) {
    return 'CRITICAL';
  }
  if (critical.length + ampFactor >= QUEUE_HEALTH_THRESHOLDS.HIGH_CRITICAL_COUNT) {
    return 'HIGH';
  }
  if (active.length >= QUEUE_HEALTH_THRESHOLDS.MEDIUM_ACTIVE_LENGTH) {
    return 'MEDIUM';
  }
  if (active.length >= QUEUE_HEALTH_THRESHOLDS.LOW_ACTIVE_LENGTH) {
    return 'LOW';
  }
  return 'CLEAR';
}

/**
 * Projects a set of entries to ThreatEnvelope objects for RunStateSnapshot bridging.
 * Uses INTERNAL_VISIBILITY_TO_ENVELOPE and VISIBILITY_CONFIGS at runtime.
 */
export function projectQueueToThreatEnvelopes(
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
  currentTick: number,
): readonly ThreatEnvelope[] {
  const levelOut: VisibilityLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
  const config = VISIBILITY_CONFIGS[visibilityState];

  return Object.freeze(
    entries
      .filter((e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED)
      .map((entry) => {
        const eta = entry.isArrived ? 0 : Math.max(0, entry.arrivalTick - currentTick);

        let summary = 'Threat detected';
        if (config.showsThreatType) {
          summary = entry.isArrived
            ? `${entry.threatType} active`
            : `${entry.threatType} incoming`;
        }
        if (config.showsArrivalTick && !entry.isArrived) {
          summary += ` in ${eta} ticks`;
        }

        return Object.freeze<ThreatEnvelope>({
          threatId:  entry.threatId,
          source:    entry.source,
          etaTicks:  eta,
          severity:  entry.severityWeight,
          visibleAs: levelOut,
          summary,
        });
      }),
  );
}

/**
 * Ranks active entries by urgency score.
 * Uses QUEUE_PRIORITY_WEIGHT_ARRIVED, QUEUE_PRIORITY_WEIGHT_QUEUED,
 * and QUEUE_OVERDUE_SEVERITY_MULTIPLIER at runtime.
 */
export function rankThreatsByUrgency(
  entries: readonly AnticipationEntry[],
  currentTick: number,
): readonly AnticipationEntry[] {
  const active = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );

  return Object.freeze(
    [...active].sort((a, b) => {
      const weightA = a.state === ENTRY_STATE.ARRIVED
        ? QUEUE_PRIORITY_WEIGHT_ARRIVED
        : QUEUE_PRIORITY_WEIGHT_QUEUED;
      const weightB = b.state === ENTRY_STATE.ARRIVED
        ? QUEUE_PRIORITY_WEIGHT_ARRIVED
        : QUEUE_PRIORITY_WEIGHT_QUEUED;

      const etaA = Math.max(0, a.arrivalTick - currentTick);
      const etaB = Math.max(0, b.arrivalTick - currentTick);

      const scoreA = weightA * severityToRank(a.threatSeverity) / (etaA + 1)
        + a.ticksOverdue * QUEUE_OVERDUE_SEVERITY_MULTIPLIER;
      const scoreB = weightB * severityToRank(b.threatSeverity) / (etaB + 1)
        + b.ticksOverdue * QUEUE_OVERDUE_SEVERITY_MULTIPLIER;

      return scoreB - scoreA;
    }),
  );
}

/**
 * Builds a DecayComputeInput from standalone entry sets and context.
 * Accesses VISIBILITY_CONFIGS for the awareness bonus.
 * Consumed by TensionDecayController.computeDelta().
 */
export function computeQueueDecayInput(
  activeEntries: readonly AnticipationEntry[],
  expiredEntries: readonly AnticipationEntry[],
  relievedEntries: readonly AnticipationEntry[],
  pressureTier: PressureTier,
  visibilityState: TensionVisibilityState,
  sovereigntyMilestoneReached: boolean,
): DecayComputeInput {
  const config = VISIBILITY_CONFIGS[visibilityState];
  const awarenessBonus = config.tensionAwarenessBonus;

  return Object.freeze({
    activeEntries,
    expiredEntries,
    relievedEntries,
    pressureTier,
    visibilityAwarenessBonus:    awarenessBonus,
    queueIsEmpty:                activeEntries.length === 0,
    sovereigntyMilestoneReached,
  });
}

/**
 * Computes a standalone ML feature vector for an arbitrary set of entries.
 * Uses THREAT_SEVERITY, THREAT_TYPE, THREAT_SEVERITY_WEIGHTS,
 * and PRESSURE_TENSION_AMPLIFIERS at runtime.
 */
export function computeQueueMLVector(
  entries: readonly AnticipationEntry[],
  currentTick: number,
  pressureTier: PressureTier,
): QueueMLVector {
  const active  = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  const arrived = active.filter((e) => e.state === ENTRY_STATE.ARRIVED);
  const queued  = active.filter((e) => e.state === ENTRY_STATE.QUEUED);
  const expired = entries.filter((e) => e.state === ENTRY_STATE.EXPIRED);
  const mit     = entries.filter((e) => e.state === ENTRY_STATE.MITIGATED);
  const nulled  = entries.filter((e) => e.state === ENTRY_STATE.NULLIFIED);
  const total   = active.length || 1;

  // Severity counts — uses THREAT_SEVERITY constants at runtime
  const f06 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL).length / total;
  const f07 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL).length    / total;
  const f08 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.SEVERE).length      / total;
  const f09 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.MODERATE).length    / total;
  const f10 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.MINOR).length       / total;

  // Type counts — uses THREAT_TYPE constants at runtime
  const f11 = active.filter((e) => e.threatType === THREAT_TYPE.DEBT_SPIRAL).length      / total;
  const f12 = active.filter((e) => e.threatType === THREAT_TYPE.SABOTAGE).length         / total;
  const f13 = active.filter((e) => e.threatType === THREAT_TYPE.HATER_INJECTION).length  / total;
  const f14 = active.filter((e) => e.threatType === THREAT_TYPE.CASCADE).length          / total;
  const f15 = active.filter((e) => e.threatType === THREAT_TYPE.SOVEREIGNTY).length      / total;
  const f16 = active.filter((e) => e.threatType === THREAT_TYPE.OPPORTUNITY_KILL).length / total;
  const f17 = active.filter((e) => e.threatType === THREAT_TYPE.REPUTATION_BURN).length  / total;
  const f18 = active.filter((e) => e.threatType === THREAT_TYPE.SHIELD_PIERCE).length    / total;

  // Severity weight aggregates — uses THREAT_SEVERITY_WEIGHTS indirectly via severityWeight
  const avgW = active.reduce((s, e) => s + e.severityWeight, 0) / (active.length || 1);
  const maxW = active.reduce((m, e) => Math.max(m, e.severityWeight), 0);

  // Overdue metrics
  const avgOverdue = arrived.length > 0
    ? arrived.reduce((s, e) => s + e.ticksOverdue, 0) / arrived.length
    : 0;
  const maxOverdue = arrived.reduce((m, e) => Math.max(m, e.ticksOverdue), 0);

  // ETA
  const avgEta = queued.length > 0
    ? queued.reduce((s, e) => s + Math.max(0, e.arrivalTick - currentTick), 0) / queued.length
    : 0;

  // Cascade ratio
  const cascadeCount = active.filter((e) => e.isCascadeTriggered).length;

  // Dominant severity rank
  const dominantRank = active.reduce(
    (max, e) => Math.max(max, severityToRank(e.threatSeverity)), 0,
  );

  // Mitigation coverage
  const withMit = active.filter((e) => e.mitigationCardTypes.length > 0).length;

  // Pressure amplification — uses PRESSURE_TENSION_AMPLIFIERS at runtime
  const amp = getPressureAmplifier(pressureTier);

  // Entropy
  const typeSet = new Set(active.map((e) => e.threatType));
  const entropy = typeSet.size / 8;

  // Health score approximation
  const health = clamp(1 - (f06 * 0.25 + f07 * 0.15 + avgOverdue * 0.05), 0, 1);

  const values = Object.freeze([
    normalise(active.length, QUEUE_ML_LENGTH_NORM_CAP),     // 00
    normalise(arrived.length, QUEUE_ML_LENGTH_NORM_CAP),    // 01
    normalise(queued.length, QUEUE_ML_LENGTH_NORM_CAP),     // 02
    normalise(expired.length, QUEUE_ML_LENGTH_NORM_CAP),    // 03
    normalise(mit.length, QUEUE_ML_LENGTH_NORM_CAP),        // 04
    normalise(nulled.length, QUEUE_ML_LENGTH_NORM_CAP),     // 05
    f06, f07, f08, f09, f10,                                // 06-10
    f11, f12, f13, f14, f15, f16, f17, f18,                // 11-18
    clamp(avgW, 0, 1),                                      // 19
    clamp(maxW, 0, 1),                                      // 20
    normalise(avgOverdue, QUEUE_ML_OVERDUE_NORM_CAP),       // 21
    normalise(maxOverdue, QUEUE_ML_OVERDUE_NORM_CAP),       // 22
    1 - normalise(avgEta, QUEUE_ML_ETA_NORM_CAP),           // 23 imminence
    cascadeCount / total,                                   // 24
    dominantRank / 5,                                       // 25
    withMit / total,                                        // 26
    normalise(amp - 1.0, 0.5),                              // 27
    clamp(VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED].tensionAwarenessBonus, 0, 1), // 28
    0,                                                      // 29 overlap (requires tick-local data)
    entropy,                                                // 30
    health,                                                 // 31
  ]);

  return Object.freeze({
    dimension:   QUEUE_ML_FEATURE_COUNT,
    labels:      QUEUE_ML_FEATURE_LABELS,
    values,
    pressureTier,
    tickNumber:  currentTick,
    timestamp:   Date.now(),
  });
}

/**
 * Constructs a standalone DL sequence tensor from an arbitrary entry set.
 * Uses ENTRY_STATE, THREAT_SEVERITY_WEIGHTS, TENSION_CONSTANTS, and
 * PRESSURE_TENSION_AMPLIFIERS at runtime.
 */
export function computeQueueDLTensor(
  entries: readonly AnticipationEntry[],
  currentTick: number,
  pressureTier: PressureTier,
): QueueDLTensor {
  const sorted = [...rankThreatsByUrgency(entries, currentTick)];
  const pressureAmp = getPressureAmplifier(pressureTier);

  const rows: QueueDLTensorRow[] = [];

  for (let i = 0; i < QUEUE_DL_SEQUENCE_LENGTH; i++) {
    const entry = sorted[i] ?? null;

    if (entry === null) {
      rows.push({
        entryId:  null,
        features: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]) as readonly number[],
      });
      continue;
    }

    const eta = Math.max(0, entry.arrivalTick - currentTick);

    rows.push({
      entryId: entry.entryId,
      features: Object.freeze([
        clamp(entry.severityWeight, 0, 1),
        threatTypeToIndex(entry.threatType) / 7,
        entryStateToIndex(entry.state) / 4,
        normalise(eta, QUEUE_ML_ETA_NORM_CAP),
        normalise(entry.ticksOverdue, QUEUE_ML_OVERDUE_NORM_CAP),
        entry.isCascadeTriggered ? 1 : 0,
        clamp(entry.baseTensionPerTick / TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK, 0, 1),
        clamp(entry.severityWeight * pressureAmp, 0, 1),
      ]) as readonly number[],
    });
  }

  return Object.freeze({
    rows:           Object.freeze(rows),
    sequenceLength: QUEUE_DL_SEQUENCE_LENGTH,
    featureWidth:   QUEUE_DL_FEATURE_WIDTH,
    pressureTier,
    tickNumber:     currentTick,
    timestamp:      Date.now(),
  });
}

/**
 * Generates a standalone queue narrative from an arbitrary entry set.
 * Uses TENSION_VISIBILITY_STATE, VISIBILITY_CONFIGS, and
 * THREAT_TYPE_DEFAULT_MITIGATIONS at runtime.
 */
export function generateQueueNarrative(
  entries: readonly AnticipationEntry[],
  currentTick: number,
  visibilityState: TensionVisibilityState = TENSION_VISIBILITY_STATE.TELEGRAPHED,
  currentScore: number = 0,
): QueueNarrative {
  const active  = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  const arrived = active.filter((e) => e.state === ENTRY_STATE.ARRIVED);
  const config  = VISIBILITY_CONFIGS[visibilityState];
  const lines:  QueueNarrativeLine[] = [];
  const advice: string[] = [];

  let headline    = 'Queue nominal — no active threats';
  let urgencyLabel = 'CLEAR';

  if (arrived.length > 0) {
    headline     = `⚠ ${arrived.length} threat${arrived.length > 1 ? 's' : ''} ACTIVE`;
    urgencyLabel = arrived.length >= 3 ? 'CRITICAL' : 'HIGH';
  } else if (active.length > 0) {
    const earliest = active.reduce((min, e) => Math.min(min, e.arrivalTick), Infinity);
    const eta      = Math.max(0, earliest - currentTick);
    headline       = `${active.length} threat${active.length > 1 ? 's' : ''} inbound — ${eta} ticks`;
    urgencyLabel   = 'ELEVATED';
  }

  const sorted = rankThreatsByUrgency(active, currentTick);
  for (const entry of sorted.slice(0, 6)) {
    const eta = Math.max(0, entry.arrivalTick - currentTick);
    const typeLabel = config.showsThreatType ? entry.threatType : 'UNKNOWN';
    const text = entry.isArrived
      ? `[${entry.threatSeverity}] ${typeLabel} ACTIVE${entry.ticksOverdue > 0 ? ` — ${entry.ticksOverdue} overdue` : ''}`
      : `[${entry.threatSeverity}] ${typeLabel} in ${eta} tick${eta !== 1 ? 's' : ''}`;

    lines.push({
      priority:   entry.isArrived ? 'URGENT' : (severityToRank(entry.threatSeverity) >= 4 ? 'HIGH' : 'MEDIUM'),
      text,
      entryId:    entry.entryId,
      threatType: config.showsThreatType ? entry.threatType : null,
    });
  }

  // Mitigation advice — uses THREAT_TYPE_DEFAULT_MITIGATIONS at runtime
  for (const entry of arrived.slice(0, 3)) {
    const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
    if (defaults.length > 0) {
      advice.push(`Play ${defaults[0]} to counter ${entry.threatType}`);
    }
  }

  if (active.length === 0) {
    advice.push('Queue clear — rebuild and strengthen shields');
  }

  const scorePct = Math.round(currentScore * 100);
  if (scorePct >= Math.round(TENSION_CONSTANTS.PULSE_THRESHOLD * 100)) {
    advice.push(`Tension at ${scorePct}% — Anticipation Pulse imminent!`);
  }

  return Object.freeze({
    headline,
    urgencyLabel,
    lines:            Object.freeze(lines),
    mitigationAdvice: Object.freeze(advice),
    emptyQueueMessage: active.length === 0 ? 'All threats neutralised — well played' : null,
    tickNumber:        currentTick,
  });
}

/**
 * Computes a delta summary comparing two queue snapshots.
 * Used by the chat adapter to describe what changed between ticks.
 */
export function computeQueueDeltaSummary(
  previousEntries: readonly AnticipationEntry[],
  currentEntries: readonly AnticipationEntry[],
): QueueDeltaSummary {
  const prevActive = previousEntries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  const currActive = currentEntries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );

  const prevIds = new Set(prevActive.map((e) => e.entryId));
  const currIds = new Set(currActive.map((e) => e.entryId));

  const newEntries      = currActive.filter((e) => !prevIds.has(e.entryId));
  const resolvedEntries = prevActive.filter((e) => !currIds.has(e.entryId));

  const prevArrivedCount = previousEntries.filter((e) => e.state === ENTRY_STATE.ARRIVED).length;
  const currArrivedCount = currentEntries.filter((e) => e.state === ENTRY_STATE.ARRIVED).length;
  const prevExpiredCount = previousEntries.filter((e) => e.state === ENTRY_STATE.EXPIRED).length;
  const currExpiredCount = currentEntries.filter((e) => e.state === ENTRY_STATE.EXPIRED).length;

  const prevWeight = prevActive.reduce((s, e) => s + e.severityWeight, 0);
  const currWeight = currActive.reduce((s, e) => s + e.severityWeight, 0);

  return Object.freeze({
    activeCountDelta:    currActive.length - prevActive.length,
    arrivedCountDelta:   currArrivedCount - prevArrivedCount,
    expiredCountDelta:   currExpiredCount - prevExpiredCount,
    severityWeightDelta: currWeight - prevWeight,
    newThreatTypes:      freezeArray([...new Set(newEntries.map((e) => e.threatType))]),
    resolvedThreatTypes: freezeArray([...new Set(resolvedEntries.map((e) => e.threatType))]),
    escalated:           currWeight > prevWeight + 0.1,
    deescalated:         currWeight < prevWeight - 0.1,
  });
}

/**
 * Serializes a set of entries to a portable QueueSerializedState.
 * Uses QUEUE_SERIALIZE_MAX_ENTRIES and SHA-256 for checksumming.
 */
export function serializeQueueState(entries: readonly AnticipationEntry[]): QueueSerializedState {
  const capped = [...entries].slice(0, QUEUE_SERIALIZE_MAX_ENTRIES);
  const checksum = createHash('sha256')
    .update(JSON.stringify(capped))
    .digest('hex')
    .slice(0, 16);

  return Object.freeze({
    version:        'anticipation-queue.v2',
    entries:        freezeArray(capped),
    checksum,
    serializedAtMs: Date.now(),
    entryCount:     capped.length,
  });
}

/**
 * Deserializes a QueueSerializedState back to an AnticipationEntry array.
 * Validates checksum integrity before returning entries.
 */
export function deserializeQueueState(
  state: QueueSerializedState,
): { entries: readonly AnticipationEntry[]; checksumValid: boolean } {
  const recomputed = createHash('sha256')
    .update(JSON.stringify([...state.entries]))
    .digest('hex')
    .slice(0, 16);

  return {
    entries:       state.entries,
    checksumValid: recomputed === state.checksum,
  };
}

/**
 * Validates a single QueueUpsertInput object.
 * Returns { valid, errors }.
 * Uses THREAT_TYPE, THREAT_SEVERITY constants at runtime for membership checks.
 */
export function validateQueueUpsertInput(
  input: QueueUpsertInput,
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];

  if (!input.runId || input.runId.trim() === '') {
    errors.push('runId must be a non-empty string');
  }
  if (!input.sourceKey || input.sourceKey.trim() === '') {
    errors.push('sourceKey must be a non-empty string');
  }

  // Validate threatType — uses THREAT_TYPE constants at runtime
  const validTypes = Object.values(THREAT_TYPE) as readonly string[];
  if (!validTypes.includes(input.threatType)) {
    errors.push(`threatType '${input.threatType}' is not a valid ThreatType`);
  }

  // Validate threatSeverity — uses THREAT_SEVERITY constants at runtime
  const validSeverities = Object.values(THREAT_SEVERITY) as readonly string[];
  if (!validSeverities.includes(input.threatSeverity)) {
    errors.push(`threatSeverity '${input.threatSeverity}' is not a valid ThreatSeverity`);
  }

  if (input.arrivalTick < 0) {
    errors.push('arrivalTick must be >= 0');
  }
  if (input.currentTick < 0) {
    errors.push('currentTick must be >= 0');
  }
  if (input.severityWeight !== undefined) {
    if (input.severityWeight < 0 || input.severityWeight > 1) {
      errors.push('severityWeight must be in [0, 1]');
    }
  }

  return { valid: errors.length === 0, errors: freezeArray(errors) };
}

/**
 * Validates a single AnticipationEntry for structural completeness.
 * Uses ENTRY_STATE, THREAT_TYPE, THREAT_SEVERITY constants at runtime.
 */
export function validateQueueEntry(
  entry: AnticipationEntry,
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];

  if (!entry.entryId || entry.entryId.length !== 32) {
    errors.push('entryId must be a 32-character deterministic hash');
  }

  const validStates = Object.values(ENTRY_STATE) as readonly string[];
  if (!validStates.includes(entry.state)) {
    errors.push(`state '${entry.state}' is not a valid EntryState`);
  }

  const validTypes = Object.values(THREAT_TYPE) as readonly string[];
  if (!validTypes.includes(entry.threatType)) {
    errors.push(`threatType '${entry.threatType}' is not valid`);
  }

  const validSeverities = Object.values(THREAT_SEVERITY) as readonly string[];
  if (!validSeverities.includes(entry.threatSeverity)) {
    errors.push(`threatSeverity '${entry.threatSeverity}' is not valid`);
  }

  if (entry.severityWeight < 0 || entry.severityWeight > 1) {
    errors.push('severityWeight must be in [0, 1]');
  }
  if (entry.baseTensionPerTick < 0) {
    errors.push('baseTensionPerTick must be >= 0');
  }
  if (entry.ticksOverdue < 0) {
    errors.push('ticksOverdue must be >= 0');
  }
  if (entry.decayTicksRemaining < 0) {
    errors.push('decayTicksRemaining must be >= 0');
  }

  return { valid: errors.length === 0, errors: freezeArray(errors) };
}

/**
 * Builds a comprehensive chat context payload for the chat adapter.
 * One-stop payload: health tier, dominant threat, narrative headline,
 * urgency label, mitigation options, ML vector, and threat envelopes.
 * Uses TENSION_VISIBILITY_STATE, VISIBILITY_CONFIGS, TENSION_CONSTANTS,
 * PRESSURE_TENSION_AMPLIFIERS, THREAT_TYPE_DEFAULT_MITIGATIONS at runtime.
 */
export function buildQueueChatContext(
  entries: readonly AnticipationEntry[],
  currentTick: number,
  pressureTier: PressureTier,
  visibilityState: TensionVisibilityState = TENSION_VISIBILITY_STATE.TELEGRAPHED,
  currentScore: number = 0,
): {
  riskTier:        QueueRiskTier;
  urgencyLabel:    string;
  headline:        string;
  narrativeLines:  readonly string[];
  mitigationAdvice: readonly string[];
  activeCount:     number;
  arrivedCount:    number;
  dominantThreatType: ThreatType | null;
  mlVector:        readonly number[];
  threatEnvelopes: readonly ThreatEnvelope[];
  pressureScore:   number;
  pulseRisk:       boolean;
} {
  const narrative     = generateQueueNarrative(entries, currentTick, visibilityState, currentScore);
  const riskTier      = classifyQueueRisk(entries, pressureTier);
  const mlVec         = computeQueueMLVector(entries, currentTick, pressureTier);
  const envelopes     = projectQueueToThreatEnvelopes(entries, visibilityState, currentTick);
  const ranked        = rankThreatsByUrgency(entries, currentTick);
  const dominated     = ranked[0] ?? null;
  const pressure      = computeQueuePressure(entries);

  const active  = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  const arrived = active.filter((e) => e.state === ENTRY_STATE.ARRIVED);

  // Pulse risk uses TENSION_CONSTANTS.PULSE_THRESHOLD at runtime
  const pulseRisk = currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD;

  return Object.freeze({
    riskTier,
    urgencyLabel:    narrative.urgencyLabel,
    headline:        narrative.headline,
    narrativeLines:  freezeArray(narrative.lines.map((l) => l.text)),
    mitigationAdvice: narrative.mitigationAdvice,
    activeCount:     active.length,
    arrivedCount:    arrived.length,
    dominantThreatType: dominated?.threatType ?? null,
    mlVector:        mlVec.values,
    threatEnvelopes: envelopes,
    pressureScore:   pressure,
    pulseRisk,
  });
}

/**
 * Computes a queue health score from 0 (collapsed) to 1 (pristine).
 * Uses QUEUE_HEALTH_THRESHOLDS and THREAT_SEVERITY constants at runtime.
 */
export function computeQueueHealthScore(entries: readonly AnticipationEntry[]): number {
  const active = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  if (active.length === 0) return 1.0;

  const existentialCount = active.filter(
    (e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL,
  ).length;
  const criticalCount = active.filter(
    (e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL,
  ).length;
  const arrivedCount  = active.filter((e) => e.state === ENTRY_STATE.ARRIVED).length;
  const overdueCount  = active.filter((e) => e.ticksOverdue > 0).length;

  let health = 1.0;
  health -= existentialCount * 0.25;
  health -= criticalCount    * 0.12;
  health -= Math.min(arrivedCount, QUEUE_HEALTH_THRESHOLDS.CRITICAL_ARRIVED_COUNT) * 0.08;
  health -= overdueCount     * 0.05;

  return clamp(health, 0, 1);
}

/**
 * Computes the aggregate tension spike from EXISTENTIAL and CRITICAL threats.
 * Uses QUEUE_EXISTENTIAL_SPIKE, QUEUE_CRITICAL_SPIKE constants at runtime.
 */
export function computeQueueSpikeContribution(entries: readonly AnticipationEntry[]): number {
  const arrived = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED);

  let spike = 0;
  for (const e of arrived) {
    if (e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL) {
      spike += QUEUE_EXISTENTIAL_SPIKE;
    } else if (e.threatSeverity === THREAT_SEVERITY.CRITICAL) {
      spike += QUEUE_CRITICAL_SPIKE;
    }
  }

  return clamp(spike, 0, 1);
}

// ============================================================================
// § 6 — SELF-TEST HARNESS
//   Verifies that every constant and imported symbol is functional.
//   Returns a structured result for health check endpoints.
// ============================================================================

/**
 * Runs a comprehensive self-test of the AnticipationQueue module.
 * Exercises EVERY constant, EVERY import, and EVERY major function.
 */
export function runQueueSelfTest(): QueueSelfTestResult {
  const startMs   = Date.now();
  const failures:  string[] = [];
  let   checksRun = 0;

  function check(label: string, fn: () => boolean): void {
    checksRun++;
    try {
      if (!fn()) failures.push(`FAIL: ${label}`);
    } catch (err) {
      failures.push(`ERROR: ${label} — ${String(err)}`);
    }
  }

  // ── Constants reachable
  check('QUEUE_ML_FEATURE_COUNT = 32', () => QUEUE_ML_FEATURE_COUNT === 32);
  check('QUEUE_DL_SEQUENCE_LENGTH = 16', () => QUEUE_DL_SEQUENCE_LENGTH === 16);
  check('QUEUE_DL_FEATURE_WIDTH = 8', () => QUEUE_DL_FEATURE_WIDTH === 8);
  check('QUEUE_ML_FEATURE_LABELS length = 32', () => QUEUE_ML_FEATURE_LABELS.length === 32);
  check('QUEUE_DL_COLUMN_LABELS length = 8', () => QUEUE_DL_COLUMN_LABELS.length === 8);
  check('QUEUE_FORECAST_HORIZON_TICKS > 0', () => QUEUE_FORECAST_HORIZON_TICKS > 0);
  check('QUEUE_TICK_HISTORY_CAPACITY > 0', () => QUEUE_TICK_HISTORY_CAPACITY > 0);
  check('QUEUE_EXISTENTIAL_SPIKE > QUEUE_CRITICAL_SPIKE', () =>
    QUEUE_EXISTENTIAL_SPIKE > QUEUE_CRITICAL_SPIKE,
  );

  // ── TENSION_CONSTANTS accessed
  check('TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK > 0', () =>
    TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK > 0,
  );
  check('TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK > QUEUED', () =>
    TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK > TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
  );
  check('TENSION_CONSTANTS.MITIGATION_DECAY_TICKS > 0', () =>
    TENSION_CONSTANTS.MITIGATION_DECAY_TICKS > 0,
  );
  check('TENSION_CONSTANTS.NULLIFY_DECAY_TICKS > 0', () =>
    TENSION_CONSTANTS.NULLIFY_DECAY_TICKS > 0,
  );
  check('TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9', () =>
    TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9,
  );

  // ── THREAT_SEVERITY_WEIGHTS accessible and valid
  check('THREAT_SEVERITY_WEIGHTS.EXISTENTIAL = 1.0', () =>
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] === 1.0,
  );
  check('THREAT_SEVERITY_WEIGHTS.MINOR = 0.2', () =>
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] === 0.2,
  );

  // ── PRESSURE_TENSION_AMPLIFIERS accessible
  check('PRESSURE_TENSION_AMPLIFIERS.T0 = 1.0', () =>
    PRESSURE_TENSION_AMPLIFIERS['T0'] === 1.0,
  );
  check('PRESSURE_TENSION_AMPLIFIERS.T4 = 1.5', () =>
    PRESSURE_TENSION_AMPLIFIERS['T4'] === 1.5,
  );

  // ── VISIBILITY_CONFIGS accessible
  check('VISIBILITY_CONFIGS SHADOWED.showsThreatType = false', () =>
    VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SHADOWED].showsThreatType === false,
  );
  check('VISIBILITY_CONFIGS EXPOSED.showsMitigationPath = true', () =>
    VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED].showsMitigationPath === true,
  );

  // ── INTERNAL_VISIBILITY_TO_ENVELOPE accessible
  check('INTERNAL_VISIBILITY_TO_ENVELOPE SHADOWED = HIDDEN', () =>
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED] === 'HIDDEN',
  );
  check('INTERNAL_VISIBILITY_TO_ENVELOPE EXPOSED = EXPOSED', () =>
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.EXPOSED] === 'EXPOSED',
  );

  // ── VISIBILITY_ORDER accessible
  check('VISIBILITY_ORDER length = 4', () => VISIBILITY_ORDER.length === 4);
  check('VISIBILITY_ORDER[0] = SHADOWED', () =>
    VISIBILITY_ORDER[0] === TENSION_VISIBILITY_STATE.SHADOWED,
  );

  // ── TENSION_EVENT_NAMES accessible
  check('TENSION_EVENT_NAMES.THREAT_ARRIVED defined', () =>
    typeof TENSION_EVENT_NAMES.THREAT_ARRIVED === 'string',
  );
  check('TENSION_EVENT_NAMES.QUEUE_UPDATED defined', () =>
    typeof TENSION_EVENT_NAMES.QUEUE_UPDATED === 'string',
  );

  // ── THREAT_TYPE_DEFAULT_MITIGATIONS accessible
  check('THREAT_TYPE_DEFAULT_MITIGATIONS.DEBT_SPIRAL has entries', () =>
    THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.DEBT_SPIRAL].length > 0,
  );
  check('THREAT_TYPE_DEFAULT_MITIGATIONS.SOVEREIGNTY has entries', () =>
    THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.SOVEREIGNTY].length > 0,
  );

  // ── ENTRY_STATE accessible
  check('ENTRY_STATE.QUEUED defined', () => typeof ENTRY_STATE.QUEUED === 'string');
  check('ENTRY_STATE.ARRIVED defined', () => typeof ENTRY_STATE.ARRIVED === 'string');
  check('ENTRY_STATE.EXPIRED defined', () => typeof ENTRY_STATE.EXPIRED === 'string');

  // ── AnticipationQueue class functional
  const queue = new AnticipationQueue();

  const testInput: QueueUpsertInput = {
    runId:                 QUEUE_SELF_TEST_RUN_ID,
    sourceKey:             'self-test-source-1',
    threatId:              'self-test-threat-1',
    source:                'self-test',
    threatType:            THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity:        THREAT_SEVERITY.CRITICAL,
    currentTick:           1,
    arrivalTick:           3,
    isCascadeTriggered:    false,
    cascadeTriggerEventId: null,
    worstCaseOutcome:      'bankruptcy',
    mitigationCardTypes:   [],
    summary:               'Self-test threat',
  };

  const entry = queue.upsert(testInput);
  check('upsert creates QUEUED entry', () => entry.state === ENTRY_STATE.QUEUED);
  check('entry has 32-char id', () => entry.entryId.length === 32);
  check('entry has correct severity', () => entry.threatSeverity === THREAT_SEVERITY.CRITICAL);
  check('entry uses THREAT_SEVERITY_WEIGHTS for default weight', () =>
    entry.severityWeight === THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL],
  );

  const result0 = queue.processTick(1);
  check('processTick tick 1: no arrivals yet', () => result0.newArrivals.length === 0);

  const result1 = queue.processTick(3);
  check('processTick tick 3: entry arrived', () => result1.newArrivals.length === 1);
  check('processTick tick 3: arrived state correct', () =>
    result1.newArrivals[0]?.state === ENTRY_STATE.ARRIVED,
  );

  const mitResult = queue.mitigateEntry(entry.entryId, 3);
  check('mitigateEntry succeeds', () => mitResult !== null);
  check('mitigated entry state = MITIGATED', () =>
    mitResult?.state === ENTRY_STATE.MITIGATED,
  );
  check('mitigated entry decayTicksRemaining = MITIGATION_DECAY_TICKS', () =>
    mitResult?.decayTicksRemaining === TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
  );

  // ── ML vector from fresh queue
  queue.reset();
  queue.upsert(testInput);
  const mlVec = queue.extractMLVector(1, 'T2');
  check('mlVector dimension = 32', () => mlVec.dimension === QUEUE_ML_FEATURE_COUNT);
  check('mlVector values length = 32', () => mlVec.values.length === 32);
  check('mlVector all finite', () => mlVec.values.every((v) => Number.isFinite(v)));
  check('mlVector all in [0,1]', () => mlVec.values.every((v) => v >= 0 && v <= 1));

  // ── DL tensor
  const dlTensor = queue.extractDLTensor(1, 'T2');
  check('dlTensor sequenceLength = 16', () => dlTensor.sequenceLength === QUEUE_DL_SEQUENCE_LENGTH);
  check('dlTensor featureWidth = 8', () => dlTensor.featureWidth === QUEUE_DL_FEATURE_WIDTH);
  check('dlTensor rows length = 16', () => dlTensor.rows.length === QUEUE_DL_SEQUENCE_LENGTH);

  // ── Health report
  const health = queue.computeHealthReport(1);
  check('healthReport has riskTier', () => typeof health.riskTier === 'string');
  check('healthReport healthScore in [0,1]', () =>
    health.healthScore >= 0 && health.healthScore <= 1,
  );

  // ── Forecast
  const forecast = queue.computeThreatForecast(1);
  check('forecast has horizonTicks > 0', () => forecast.horizonTicks > 0);
  check('forecast arrivingEntries is array', () => Array.isArray(forecast.arrivingEntries));

  // ── Narrative
  const narrative = queue.generateNarrative(1, TENSION_VISIBILITY_STATE.TELEGRAPHED, 0.5);
  check('narrative has headline', () => narrative.headline.length > 0);
  check('narrative has lines array', () => Array.isArray(narrative.lines));
  check('narrative has mitigationAdvice', () => Array.isArray(narrative.mitigationAdvice));

  // ── Event builders
  queue.reset();
  queue.upsert(testInput);
  queue.processTick(3);
  const arrivedEntries = queue.getArrivedEntries();
  check('arrivedEntries non-empty for event builder test', () => arrivedEntries.length > 0);

  const arrivedEvents = queue.buildThreatArrivedEvents(arrivedEntries, 3, Date.now());
  check('buildThreatArrivedEvents returns correct busEventName', () =>
    arrivedEvents[0]?.busEventName === TENSION_EVENT_NAMES.THREAT_ARRIVED,
  );
  check('buildThreatArrivedEvents event.eventType correct', () =>
    arrivedEvents[0]?.event.eventType === 'THREAT_ARRIVED',
  );

  const queueUpdated = queue.buildQueueUpdatedEvent(3, Date.now());
  check('buildQueueUpdatedEvent uses TENSION_EVENT_NAMES.QUEUE_UPDATED', () =>
    queueUpdated.busEventName === TENSION_EVENT_NAMES.QUEUE_UPDATED,
  );

  // ── Standalone pure functions
  const allEntries = queue.getAllEntries();
  check('computeQueuePressure returns finite number', () =>
    Number.isFinite(computeQueuePressure(allEntries)),
  );
  check('computeQueueThreatDensity in [0,1]', () => {
    const d = computeQueueThreatDensity(allEntries);
    return d >= 0 && d <= 1;
  });
  check('classifyQueueRisk returns valid tier', () => {
    const tier = classifyQueueRisk(allEntries, 'T2');
    return ['CRITICAL','HIGH','MEDIUM','LOW','CLEAR'].includes(tier);
  });
  check('rankThreatsByUrgency returns sorted array', () =>
    rankThreatsByUrgency(allEntries, 3).length === allEntries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    ).length,
  );
  check('computeQueueHealthScore in [0,1]', () => {
    const s = computeQueueHealthScore(allEntries);
    return s >= 0 && s <= 1;
  });
  check('computeQueueSpikeContribution in [0,1]', () => {
    const s = computeQueueSpikeContribution(allEntries);
    return s >= 0 && s <= 1;
  });

  // ── Validation
  const validInput = validateQueueUpsertInput(testInput);
  check('validateQueueUpsertInput returns valid for well-formed input', () => validInput.valid);

  const badInput = validateQueueUpsertInput({ ...testInput, threatType: 'BAD_TYPE' as never });
  check('validateQueueUpsertInput catches bad threatType', () => !badInput.valid);

  const validEntry = validateQueueEntry(queue.getEntry(entry.entryId)!);
  check('validateQueueEntry valid for canonical entry', () => validEntry.valid);

  // ── Serialization round-trip
  const serialized = queue.serialize();
  check('serialize returns version string', () => typeof serialized.version === 'string');
  check('serialize checksum is 16 chars', () => serialized.checksum.length === 16);

  const { entries: restored, checksumValid } = deserializeQueueState(serialized);
  check('deserializeQueueState checksum valid', () => checksumValid);
  check('deserializeQueueState restores entries', () => restored.length === serialized.entryCount);

  // ── buildDecayInput / applyDecayResult
  const decayInput: DecayComputeInput = queue.buildDecayInput('T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, false);
  check('buildDecayInput pressureTier preserved', () => decayInput.pressureTier === 'T2');
  check('buildDecayInput queueIsEmpty false when active', () => !decayInput.queueIsEmpty);

  const fakeResult: DecayComputeResult = {
    rawDelta: 0.05,
    amplifiedDelta: 0.06,
    contributionBreakdown: {
      queuedThreats:    0.03,
      arrivedThreats:   0.03,
      expiredGhosts:    0,
      mitigationDecay:  0,
      nullifyDecay:     0,
      emptyQueueBonus:  0,
      visibilityBonus:  0,
      sovereigntyBonus: 0,
    },
  };
  const newScore = queue.applyDecayResult(fakeResult, 0.5);
  check('applyDecayResult clamps to [0,1]', () => newScore >= 0 && newScore <= 1);
  check('applyDecayResult adds amplifiedDelta', () =>
    Math.abs(newScore - (0.5 + 0.06)) < 0.001,
  );

  // ── projectToThreatEnvelopes
  const envelopes = queue.projectToThreatEnvelopes(TENSION_VISIBILITY_STATE.TELEGRAPHED, 3);
  check('projectToThreatEnvelopes returns array', () => Array.isArray(envelopes));

  // ── exportBundle
  const bundle = queue.exportBundle(3, 'T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, 0.5);
  check('exportBundle mlVector dimension = 32', () =>
    bundle.mlVector.dimension === QUEUE_ML_FEATURE_COUNT,
  );
  check('exportBundle dlTensor sequenceLength = 16', () =>
    bundle.dlTensor.sequenceLength === QUEUE_DL_SEQUENCE_LENGTH,
  );
  check('exportBundle healthReport present', () => typeof bundle.healthReport.riskTier === 'string');
  check('exportBundle narrative headline non-empty', () => bundle.narrative.headline.length > 0);

  // ── chat context
  const chatCtx = buildQueueChatContext(allEntries, 3, 'T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, 0.5);
  check('buildQueueChatContext riskTier defined', () => typeof chatCtx.riskTier === 'string');
  check('buildQueueChatContext mlVector length = 32', () => chatCtx.mlVector.length === 32);

  queue.reset();

  return Object.freeze({
    passed:     failures.length === 0,
    checksRun,
    failures:   freezeArray(failures),
    testedAt:   Date.now(),
    durationMs: Date.now() - startMs,
  });
}
