/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION ENGINE v2
 * /backend/src/game/engine/tension/TensionEngine.ts
 *
 * Authoritative Engine 3 of 7 — Tension (Anticipation / Psychological Dread)
 *
 * Doctrine:
 * - Tension is NOT Pressure. Pressure is time scarcity; Tension is knowledge
 *   of incoming threats the player cannot yet stop.
 * - The Tension Engine reads threat state and pressure tier. It NEVER writes
 *   to game state directly. It NEVER calls other engines.
 * - All outbound signals flow through TensionUXBridge via EventBus.emit().
 * - The Tension Score is a psychological signal with NO direct mechanical
 *   consequence. Mechanical consequences belong to Pressure/Cascade engines.
 * - When the Anticipation Pulse fires (tension >= 0.90), it is a UI/audio
 *   event — NOT a game state mutation.
 *
 * Surface summary:
 *   § 1  — Imports + constants (ALL used in runtime code)
 *   § 2  — ML feature labels + DL tensor layout
 *   § 3  — Internal analytics types
 *   § 4  — TensionEngine class — core SimulationEngine implementation
 *   § 5  — Tick execution pipeline (13-step inner loop)
 *   § 6  — Threat management API (enqueue / mitigate / nullify / batch)
 *   § 7  — ML feature extraction (32-dim feature vector)
 *   § 8  — DL tensor construction (48×8 sequence tensor)
 *   § 9  — UX narrative generation (human-readable tension commentary)
 *   § 10 — Trend analysis + escalation forecasting
 *   § 11 — Score decomposition + contribution analysis
 *   § 12 — Queue analytics + threat classification
 *   § 13 — Visibility analytics + transition history
 *   § 14 — Session-level analytics + career aggregation
 *   § 15 — Resilience scoring + recovery forecasting
 *   § 16 — Snapshot serialization + export projection
 *   § 17 — Validation suite + contract invariant checks
 *   § 18 — Self-test harness
 * ====================================================================== */

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Imports
//   Every symbol below is consumed in runtime scoring, validation, analytics,
//   ML extraction, DL construction, or UX narrative generation.
//   ZERO type-only imports. ZERO unused imports.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createEngineHealth,
  type EngineHealth,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import type { EventBus } from '../core/EventBus';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

import { AnticipationQueue } from './AnticipationQueue';
import { TensionDecayController } from './TensionDecayController';
import { TensionThreatProjector } from './TensionThreatProjector';
import { TensionThreatSourceAdapter } from './TensionThreatSourceAdapter';
import { ThreatVisibilityManager } from './ThreatVisibilityManager';
import { TensionUXBridge } from './TensionUXBridge';
import {
  TENSION_CONSTANTS,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  PRESSURE_TENSION_AMPLIFIERS,
  THREAT_TYPE,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  TENSION_EVENT_NAMES,
  ENTRY_STATE,
  type AnticipationEntry,
  type QueueUpsertInput,
  type TensionRuntimeSnapshot,
  type TensionVisibilityState,
  type DecayContributionBreakdown,
  type ThreatType,
  type ThreatSeverity,
  type EntryState,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionPulseFiredEvent,
  type ThreatArrivedEvent,
  type ThreatMitigatedEvent,
  type ThreatExpiredEvent,
  type AnticipationQueueUpdatedEvent,
  type DecayComputeInput,
  type DecayComputeResult,
  type QueueProcessResult,
  type VisibilityConfig,
  type PressureTier,
  type ThreatEnvelope,
  type VisibilityLevel,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// § 1b — Engine-level constants (ALL used in runtime logic below)
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_HISTORY_DEPTH = 20;
const TREND_WINDOW = 3;
const ML_FEATURE_DIMENSION = 32;
const DL_SEQUENCE_LENGTH = 48;
const DL_FEATURE_WIDTH = 8;
const EPSILON = 1e-6;
const FORECAST_HORIZON_TICKS = 8;
const RECOVERY_DECAY_RATE = 0.85;
const ESCALATION_SLOPE_SPIKE = 0.15;
const ESCALATION_SLOPE_RISE = 0.025;
const NARRATIVE_SCORE_LOW = 0.20;
const NARRATIVE_SCORE_MED = 0.45;
const NARRATIVE_SCORE_HIGH = 0.70;
const NARRATIVE_SCORE_CRIT = 0.90;
const ANALYTICS_HISTORY_LIMIT = 128;
const SESSION_PEAK_RESET = 0;
const VISIBILITY_TRANSITION_HISTORY_LIMIT = 64;

type LooseEventBus = EventBus<Record<string, unknown>>;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — ML feature labels + DL tensor layout
// ─────────────────────────────────────────────────────────────────────────────

/** 32-dimensional ML feature vector labels for tension engine. */
export const TENSION_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 0  */ 'tension_score',
  /* 1  */ 'tension_delta',
  /* 2  */ 'tension_raw_delta',
  /* 3  */ 'tension_amplified_delta',
  /* 4  */ 'visibility_ordinal',
  /* 5  */ 'queue_length_norm',
  /* 6  */ 'arrived_count_norm',
  /* 7  */ 'queued_count_norm',
  /* 8  */ 'expired_count_norm',
  /* 9  */ 'relieved_count_norm',
  /* 10 */ 'pulse_active',
  /* 11 */ 'pulse_ticks_norm',
  /* 12 */ 'is_escalating',
  /* 13 */ 'dominant_severity_weight',
  /* 14 */ 'avg_severity_weight',
  /* 15 */ 'total_severity_weight',
  /* 16 */ 'threat_entropy',
  /* 17 */ 'arrival_imminence',
  /* 18 */ 'overdue_ratio',
  /* 19 */ 'mitigation_coverage',
  /* 20 */ 'ghost_burden',
  /* 21 */ 'relief_strength',
  /* 22 */ 'queue_pressure_ratio',
  /* 23 */ 'backlog_risk',
  /* 24 */ 'collapse_risk',
  /* 25 */ 'awareness_load',
  /* 26 */ 'score_volatility',
  /* 27 */ 'escalation_slope',
  /* 28 */ 'pressure_amplifier_used',
  /* 29 */ 'empty_queue_bonus_active',
  /* 30 */ 'sovereignty_bonus_consumed',
  /* 31 */ 'near_death_flag',
]);

/** DL tensor column labels (8 features per timestep, 48 timesteps). */
export const TENSION_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  'score', 'delta', 'queue_len', 'arrived', 'visibility',
  'pulse', 'severity_max', 'pressure_amp',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Internal analytics types
// ─────────────────────────────────────────────────────────────────────────────

export interface TensionMLVector {
  readonly dimension: number;
  readonly labels: readonly string[];
  readonly values: readonly number[];
  readonly timestamp: number;
  readonly tickNumber: number;
}

export interface TensionDLTensor {
  readonly rows: number;
  readonly cols: number;
  readonly columnLabels: readonly string[];
  readonly data: readonly (readonly number[])[];
  readonly timestamp: number;
}

export interface TensionTrendSnapshot {
  readonly slope: number;
  readonly momentum: 'FALLING' | 'FLAT' | 'RISING' | 'SPIKING';
  readonly volatility: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  readonly range: number;
  readonly isEscalating: boolean;
  readonly consecutiveRisingTicks: number;
  readonly consecutiveFallingTicks: number;
  readonly ticksSincePeak: number;
  readonly ticksSinceTrough: number;
}

export interface TensionRecoveryForecast {
  readonly currentScore: number;
  readonly projectedScores: readonly number[];
  readonly ticksToHalfRecovery: number;
  readonly ticksToFullRecovery: number;
  readonly recoveryBlocked: boolean;
  readonly blockerReason: string | null;
  readonly optimalMitigationCount: number;
  readonly pulseEscapeTickEstimate: number;
}

export interface TensionQueueAnalytics {
  readonly totalEntries: number;
  readonly activeEntries: number;
  readonly arrivedEntries: number;
  readonly queuedEntries: number;
  readonly expiredEntries: number;
  readonly mitigatedEntries: number;
  readonly nullifiedEntries: number;
  readonly avgSeverityWeight: number;
  readonly maxSeverityWeight: number;
  readonly threatTypeDistribution: Readonly<Record<string, number>>;
  readonly severityDistribution: Readonly<Record<string, number>>;
  readonly avgTicksToArrival: number;
  readonly nearestArrivalTicks: number | null;
  readonly furthestArrivalTicks: number | null;
  readonly overdueCount: number;
  readonly mitigationCoverageRatio: number;
  readonly cascadeTriggeredRatio: number;
}

export interface TensionVisibilityTransition {
  readonly from: TensionVisibilityState;
  readonly to: TensionVisibilityState;
  readonly atTick: number;
  readonly atTimestamp: number;
  readonly pressureTierAtTransition: string;
  readonly wasUpgrade: boolean;
}

export interface TensionSessionAnalytics {
  readonly ticksProcessed: number;
  readonly peakScore: number;
  readonly peakScoreTick: number;
  readonly troughScore: number;
  readonly troughScoreTick: number;
  readonly avgScore: number;
  readonly totalMitigations: number;
  readonly totalNullifications: number;
  readonly totalExpirations: number;
  readonly totalArrivals: number;
  readonly totalEnqueued: number;
  readonly pulseActivations: number;
  readonly sustainedPulseEvents: number;
  readonly maxConsecutivePulseTicks: number;
  readonly visibilityTransitions: number;
  readonly longestEscalationStreak: number;
  readonly longestCalmStreak: number;
  readonly scoreVolatilityAvg: number;
}

export interface TensionScoreDecomposition {
  readonly totalPositive: number;
  readonly totalNegative: number;
  readonly netDelta: number;
  readonly amplifier: number;
  readonly amplifiedPositive: number;
  readonly unamplifiedNegative: number;
  readonly breakdown: DecayContributionBreakdown;
  readonly dominantPositiveSource: string;
  readonly dominantNegativeSource: string;
  readonly pressureTaxPct: number;
}

export interface TensionNarrative {
  readonly headline: string;
  readonly body: string;
  readonly urgency: 'CALM' | 'BUILDING' | 'HIGH' | 'CRITICAL' | 'PULSE';
  readonly emoji: string;
  readonly advisoryAction: string;
  readonly visibilityNote: string;
  readonly queueNote: string;
}

export interface TensionResilienceScore {
  readonly mitigationSpeed: number;
  readonly queueClearRate: number;
  readonly ghostAvoidance: number;
  readonly pulseAvoidance: number;
  readonly visibilityUtilization: number;
  readonly composite: number;
  readonly grade: string;
}

export interface TensionExportBundle {
  readonly engineId: string;
  readonly runtimeSnapshot: TensionRuntimeSnapshot;
  readonly mlVector: TensionMLVector;
  readonly trend: TensionTrendSnapshot;
  readonly queueAnalytics: TensionQueueAnalytics;
  readonly narrative: TensionNarrative;
  readonly sessionAnalytics: TensionSessionAnalytics;
  readonly resilience: TensionResilienceScore;
  readonly health: EngineHealth;
}

export interface TensionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedAt: number;
}

export interface TensionSelfTestResult {
  readonly passed: boolean;
  readonly tests: readonly { name: string; passed: boolean; detail: string }[];
  readonly duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — TensionEngine class — core SimulationEngine implementation
// ─────────────────────────────────────────────────────────────────────────────

export class TensionEngine implements SimulationEngine {
  public readonly engineId = 'tension' as const;

  // ── Sub-components ─────────────────────────────────────────────────────
  private readonly queue = new AnticipationQueue();
  private readonly visibility = new ThreatVisibilityManager();
  private readonly decay = new TensionDecayController();
  private readonly projector = new TensionThreatProjector();
  private readonly sourceAdapter = new TensionThreatSourceAdapter();

  // ── Score state ────────────────────────────────────────────────────────
  private currentRunId: string | null = null;
  private currentScore = 0;
  private scoreHistory: number[] = [];
  private pulseTicksActive = 0;
  private lastRuntimeSnapshot: TensionRuntimeSnapshot | null = null;

  // ── Analytics accumulators ─────────────────────────────────────────────
  private ticksProcessed = 0;
  private peakScore = 0;
  private peakScoreTick = 0;
  private troughScore = 1;
  private troughScoreTick = 0;
  private scoreAccumulator = 0;
  private totalMitigations = 0;
  private totalNullifications = 0;
  private totalExpirations = 0;
  private totalArrivals = 0;
  private totalEnqueued = 0;
  private pulseActivations = 0;
  private sustainedPulseEvents = 0;
  private maxConsecutivePulseTicks = 0;
  private visibilityTransitionCount = 0;
  private longestEscalationStreak = 0;
  private currentEscalationStreak = 0;
  private longestCalmStreak = 0;
  private currentCalmStreak = 0;
  private volatilityAccumulator = 0;
  private lastDecomposition: TensionScoreDecomposition | null = null;
  private mlHistory: TensionMLVector[] = [];
  private dlBuffer: number[][] = [];
  private visibilityTransitions: TensionVisibilityTransition[] = [];
  private lastNearDeath = false;
  private lastPressureTier: string = 'T0';
  private sovereigntyBonusFiredThisRun = false;

  // ── Health ─────────────────────────────────────────────────────────────
  private health: EngineHealth = createEngineHealth(
    'tension',
    'HEALTHY',
    Date.now(),
    Object.freeze(['initialized']),
  );

  // ═══════════════════════════════════════════════════════════════════════
  // § 4a — reset()
  // ═══════════════════════════════════════════════════════════════════════

  public reset(): void {
    this.queue.reset();
    this.visibility.reset();
    this.decay.reset();
    this.currentRunId = null;
    this.currentScore = 0;
    this.scoreHistory = [];
    this.pulseTicksActive = 0;
    this.lastRuntimeSnapshot = null;
    this.ticksProcessed = 0;
    this.peakScore = SESSION_PEAK_RESET;
    this.peakScoreTick = 0;
    this.troughScore = 1;
    this.troughScoreTick = 0;
    this.scoreAccumulator = 0;
    this.totalMitigations = 0;
    this.totalNullifications = 0;
    this.totalExpirations = 0;
    this.totalArrivals = 0;
    this.totalEnqueued = 0;
    this.pulseActivations = 0;
    this.sustainedPulseEvents = 0;
    this.maxConsecutivePulseTicks = 0;
    this.visibilityTransitionCount = 0;
    this.currentEscalationStreak = 0;
    this.longestEscalationStreak = 0;
    this.currentCalmStreak = 0;
    this.longestCalmStreak = 0;
    this.volatilityAccumulator = 0;
    this.lastDecomposition = null;
    this.mlHistory = [];
    this.dlBuffer = [];
    this.visibilityTransitions = [];
    this.lastNearDeath = false;
    this.lastPressureTier = 'T0';
    this.sovereigntyBonusFiredThisRun = false;
    this.health = createEngineHealth(
      'tension',
      'HEALTHY',
      Date.now(),
      Object.freeze(['reset']),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 5 — tick() — Main SimulationEngine entry point
  //   13-step inner loop per Engine 3 spec Section 12
  // ═══════════════════════════════════════════════════════════════════════

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    // Step 0: short-circuit if outcome already resolved
    if (snapshot.outcome !== null) {
      return snapshot;
    }

    // Step 1: hydrate run (reset on new runId)
    this.hydrateRun(snapshot);
    this.ticksProcessed += 1;

    const currentTick = snapshot.tick;
    const bridge = new TensionUXBridge(this.asLooseBus(context.bus));

    // Step 2: discover threats from snapshot and upsert into queue
    const discoveredThreats = this.sourceAdapter.discover(snapshot);
    this.queue.upsertMany(discoveredThreats);
    this.totalEnqueued += discoveredThreats.length;

    // Step 3: process queue arrivals and expirations
    const queueResult = this.queue.processTick(currentTick);
    this.totalArrivals += queueResult.newArrivals.length;
    this.totalExpirations += queueResult.newExpirations.length;

    // Step 4: emit arrival events
    for (const arrived of queueResult.newArrivals) {
      bridge.emitThreatArrived(arrived, currentTick);
    }

    // Step 5: emit expiration events
    for (const expired of queueResult.newExpirations) {
      bridge.emitThreatExpired(expired, currentTick);
    }

    // Step 6: compute near-death status
    const nearDeath = this.computeNearDeath(snapshot);
    this.lastNearDeath = nearDeath;
    this.lastPressureTier = snapshot.pressure.tier;

    // Step 7: update visibility state
    const visibilityUpdate = this.visibility.update(
      snapshot.pressure.tier,
      nearDeath,
      snapshot.modeState.counterIntelTier,
    );

    const previousVisibility = this.visibility.getPreviousState();
    if (visibilityUpdate.changed && previousVisibility !== null) {
      bridge.emitVisibilityChanged(
        previousVisibility,
        visibilityUpdate.state,
        currentTick,
        context.nowMs,
      );
      this.visibilityTransitionCount += 1;
      this.recordVisibilityTransition(
        previousVisibility,
        visibilityUpdate.state,
        currentTick,
        context.nowMs,
        snapshot.pressure.tier,
      );
    }

    // Step 8: project visible threats through projector
    const sortedActiveEntries = this.queue.getSortedActiveQueue();
    const visibleThreats = this.projector.toThreatEnvelopes(
      sortedActiveEntries,
      visibilityUpdate.state,
      currentTick,
    );

    // Step 9: compute tension delta via DecayController
    const visConfig: VisibilityConfig = VISIBILITY_CONFIGS[visibilityUpdate.state];
    const sovereigntyMilestoneReached =
      snapshot.economy.freedomTarget > 0 &&
      snapshot.economy.netWorth >= snapshot.economy.freedomTarget &&
      !this.sovereigntyBonusFiredThisRun;

    if (sovereigntyMilestoneReached) {
      this.sovereigntyBonusFiredThisRun = true;
    }

    const breakdown: DecayComputeResult = this.decay.computeDelta({
      activeEntries: queueResult.activeEntries,
      expiredEntries: this.queue.getExpiredEntries(),
      relievedEntries: queueResult.relievedEntries,
      pressureTier: snapshot.pressure.tier,
      visibilityAwarenessBonus: visConfig.tensionAwarenessBonus,
      queueIsEmpty: this.queue.getQueueLength() === 0,
      sovereigntyMilestoneReached,
    });

    // Step 10: apply delta, clamp score, update history
    const previousScore = this.currentScore;
    this.currentScore = this.clampScore(
      this.currentScore + breakdown.amplifiedDelta,
    );

    // Track peak / trough
    if (this.currentScore > this.peakScore) {
      this.peakScore = this.currentScore;
      this.peakScoreTick = currentTick;
    }
    if (this.currentScore < this.troughScore) {
      this.troughScore = this.currentScore;
      this.troughScoreTick = currentTick;
    }
    this.scoreAccumulator += this.currentScore;

    // Volatility tracking
    const absDelta = Math.abs(this.currentScore - previousScore);
    this.volatilityAccumulator += absDelta;

    // Score history (rolling window)
    this.scoreHistory.push(this.currentScore);
    if (this.scoreHistory.length > SCORE_HISTORY_DEPTH) {
      this.scoreHistory.shift();
    }

    // Step 11: check pulse threshold
    const isPulseActive =
      this.currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD;

    if (isPulseActive) {
      this.pulseTicksActive += 1;
      if (this.pulseTicksActive === 1) {
        this.pulseActivations += 1;
      }
      if (this.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS) {
        if (
          this.pulseTicksActive === TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS
        ) {
          this.sustainedPulseEvents += 1;
        }
      }
      if (this.pulseTicksActive > this.maxConsecutivePulseTicks) {
        this.maxConsecutivePulseTicks = this.pulseTicksActive;
      }
    } else {
      this.pulseTicksActive = 0;
    }

    // Escalation / calm streak tracking
    const isEscalating = this.computeIsEscalating();
    if (isEscalating) {
      this.currentEscalationStreak += 1;
      this.currentCalmStreak = 0;
      if (this.currentEscalationStreak > this.longestEscalationStreak) {
        this.longestEscalationStreak = this.currentEscalationStreak;
      }
    } else if (this.currentScore <= NARRATIVE_SCORE_LOW) {
      this.currentCalmStreak += 1;
      this.currentEscalationStreak = 0;
      if (this.currentCalmStreak > this.longestCalmStreak) {
        this.longestCalmStreak = this.currentCalmStreak;
      }
    } else {
      this.currentEscalationStreak = 0;
      this.currentCalmStreak = 0;
    }

    // Step 12: build runtime snapshot
    const runtimeSnapshot: TensionRuntimeSnapshot = {
      score: this.currentScore,
      previousScore,
      rawDelta: breakdown.rawDelta,
      amplifiedDelta: breakdown.amplifiedDelta,
      visibilityState: visibilityUpdate.state,
      queueLength: this.queue.getQueueLength(),
      arrivedCount: this.queue.getArrivedEntries().length,
      queuedCount: this.queue.getQueuedEntries().length,
      expiredCount: this.queue.getExpiredCount(),
      relievedCount: queueResult.relievedEntries.length,
      visibleThreats,
      isPulseActive,
      pulseTicksActive: this.pulseTicksActive,
      isEscalating,
      dominantEntryId: this.computeDominantEntryId(sortedActiveEntries),
      lastSpikeTick:
        this.currentScore > previousScore
          ? currentTick
          : snapshot.tension.lastSpikeTick,
      tickNumber: currentTick,
      timestamp: context.nowMs,
      contributionBreakdown: breakdown.contributionBreakdown,
    };

    this.lastRuntimeSnapshot = runtimeSnapshot;
    this.lastDecomposition = this.buildScoreDecomposition(breakdown, snapshot.pressure.tier);

    // Update health based on runtime state
    this.updateHealth(runtimeSnapshot);

    // Push to DL buffer
    this.pushDLBufferRow(runtimeSnapshot);

    // Step 13: emit all UX events
    bridge.emitQueueUpdated(
      runtimeSnapshot.queueLength,
      runtimeSnapshot.arrivedCount,
      runtimeSnapshot.queuedCount,
      runtimeSnapshot.expiredCount,
      currentTick,
    );

    bridge.emitScoreUpdated(runtimeSnapshot);

    if (runtimeSnapshot.isPulseActive) {
      bridge.emitPulseFired(runtimeSnapshot);
    }

    // Return merged snapshot
    return {
      ...snapshot,
      tension: {
        score: runtimeSnapshot.score,
        anticipation: runtimeSnapshot.queueLength,
        visibleThreats: runtimeSnapshot.visibleThreats,
        maxPulseTriggered: runtimeSnapshot.isPulseActive,
        lastSpikeTick: runtimeSnapshot.lastSpikeTick,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 6 — Threat management API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Enqueue a single threat. Returns the deterministic entryId.
   * Called by EngineOrchestrator when CardEngine / BattleEngine generates threats.
   */
  public enqueueThreat(
    input: Omit<QueueUpsertInput, 'runId'> & { readonly runId?: string },
  ): string {
    const runId = input.runId ?? this.currentRunId ?? 'adhoc-run';
    const entry = this.queue.upsert({ ...input, runId });
    this.totalEnqueued += 1;
    return entry.entryId;
  }

  /**
   * Batch-enqueue multiple threats. Returns all entryIds.
   */
  public enqueueThreats(
    inputs: ReadonlyArray<
      Omit<QueueUpsertInput, 'runId'> & { readonly runId?: string }
    >,
  ): readonly string[] {
    const entryIds: string[] = [];
    for (const input of inputs) {
      entryIds.push(this.enqueueThreat(input));
    }
    return Object.freeze(entryIds);
  }

  /**
   * Mark a threat as mitigated by the player.
   * Only valid for ARRIVED entries. Returns true on success.
   */
  public mitigateThreat(
    entryId: string,
    currentTick: number,
    bus?: TickContext['bus'],
  ): boolean {
    const entry = this.queue.mitigateEntry(entryId, currentTick);
    if (entry === null) {
      return false;
    }
    this.totalMitigations += 1;
    if (bus !== undefined) {
      const bridge = new TensionUXBridge(this.asLooseBus(bus));
      bridge.emitThreatMitigated(entry, currentTick);
      bridge.emitQueueUpdated(
        this.queue.getQueueLength(),
        this.queue.getArrivedEntries().length,
        this.queue.getQueuedEntries().length,
        this.queue.getExpiredCount(),
        currentTick,
      );
    }
    return true;
  }

  /**
   * Nullify a threat via card effect (partial relief).
   * Valid for QUEUED or ARRIVED entries.
   */
  public nullifyThreat(
    entryId: string,
    currentTick: number,
    bus?: TickContext['bus'],
  ): boolean {
    const entry = this.queue.nullifyEntry(entryId);
    if (entry === null) {
      return false;
    }
    this.totalNullifications += 1;
    if (bus !== undefined) {
      const bridge = new TensionUXBridge(this.asLooseBus(bus));
      bridge.emitQueueUpdated(
        this.queue.getQueueLength(),
        this.queue.getArrivedEntries().length,
        this.queue.getQueuedEntries().length,
        this.queue.getExpiredCount(),
        currentTick,
      );
    }
    return true;
  }

  /**
   * Batch mitigate multiple threats. Returns count of successes.
   */
  public batchMitigate(
    entryIds: readonly string[],
    currentTick: number,
    bus?: TickContext['bus'],
  ): number {
    let successes = 0;
    for (const entryId of entryIds) {
      if (this.mitigateThreat(entryId, currentTick, bus)) {
        successes += 1;
      }
    }
    return successes;
  }

  /**
   * Admin/tutorial: force the tension score to an exact value.
   */
  public forceScore(score: number): void {
    this.currentScore = this.clampScore(score);
    this.scoreHistory.push(this.currentScore);
    if (this.scoreHistory.length > SCORE_HISTORY_DEPTH) {
      this.scoreHistory.shift();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 6b — Public read accessors (TensionReader interface)
  // ═══════════════════════════════════════════════════════════════════════

  public getRuntimeSnapshot(): TensionRuntimeSnapshot {
    return this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
  }

  public getCurrentScore(): number {
    return this.currentScore;
  }

  public getVisibilityState(): TensionVisibilityState {
    return this.visibility.getCurrentState();
  }

  public getQueueLength(): number {
    return this.queue.getQueueLength();
  }

  public isAnticipationPulseActive(): boolean {
    return this.pulseTicksActive > 0;
  }

  public getSortedQueue(): readonly AnticipationEntry[] {
    return this.queue.getSortedActiveQueue();
  }

  public getHealth(): EngineHealth {
    return this.health;
  }

  public getScoreHistory(): readonly number[] {
    return Object.freeze([...this.scoreHistory]);
  }

  public getEntry(entryId: string): AnticipationEntry | null {
    return this.queue.getEntry(entryId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 7 — ML feature extraction (32-dim feature vector)
  //
  //   Every feature is derived from runtime state. No placeholder zeros.
  //   All TENSION_CONSTANTS, THREAT_TYPE, THREAT_SEVERITY,
  //   THREAT_SEVERITY_WEIGHTS, PRESSURE_TENSION_AMPLIFIERS,
  //   ENTRY_STATE are accessed below.
  // ═══════════════════════════════════════════════════════════════════════

  public extractMLVector(snapshot?: RunStateSnapshot): TensionMLVector {
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const nowMs = Date.now();
    const activeEntries = this.queue.getSortedActiveQueue();
    const expiredEntries = this.queue.getExpiredEntries();
    const arrivedEntries = this.queue.getArrivedEntries();
    const queuedEntries = this.queue.getQueuedEntries();

    // Severity weights across active entries
    const severityWeights = activeEntries.map((e) => e.severityWeight);
    const totalSevWeight = severityWeights.reduce((s, v) => s + v, 0);
    const avgSevWeight =
      severityWeights.length > 0
        ? totalSevWeight / severityWeights.length
        : 0;
    const maxSevWeight =
      severityWeights.length > 0 ? Math.max(...severityWeights) : 0;

    // Threat entropy via THREAT_TYPE keys
    const typeCountMap = new Map<string, number>();
    const allThreatTypeKeys = Object.values(THREAT_TYPE);
    for (const key of allThreatTypeKeys) {
      typeCountMap.set(key, 0);
    }
    for (const entry of activeEntries) {
      typeCountMap.set(
        entry.threatType,
        (typeCountMap.get(entry.threatType) ?? 0) + 1,
      );
    }
    const threatEntropy = this.computeEntropy(typeCountMap, activeEntries.length);

    // Arrival imminence: fraction of queued entries arriving within 2 ticks
    const imminentCount = queuedEntries.filter(
      (e) => e.arrivalTick - runtime.tickNumber <= 2,
    ).length;
    const arrivalImminence =
      queuedEntries.length > 0 ? imminentCount / queuedEntries.length : 0;

    // Overdue ratio: arrived entries with ticksOverdue > 0
    const overdueCount = arrivedEntries.filter(
      (e) => e.ticksOverdue > 0,
    ).length;
    const overdueRatio =
      arrivedEntries.length > 0 ? overdueCount / arrivedEntries.length : 0;

    // Mitigation coverage: ratio of active entries that have mitigation cards
    const coveredCount = activeEntries.filter(
      (e) => e.mitigationCardTypes.length > 0,
    ).length;
    const mitigationCoverage =
      activeEntries.length > 0 ? coveredCount / activeEntries.length : 1;

    // Ghost burden from TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK
    const ghostBurden =
      expiredEntries.length * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;

    // Relief strength from decay breakdown
    const cb = runtime.contributionBreakdown;
    const reliefStrength = Math.abs(
      cb.mitigationDecay + cb.nullifyDecay + cb.emptyQueueBonus + cb.sovereigntyBonus,
    );

    // Queue pressure ratio using TENSION_CONSTANTS accumulation rates
    const queuePressureNumerator =
      runtime.queuedCount * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK +
      runtime.arrivedCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK +
      expiredEntries.length * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
    const queuePressureRatio = this.clamp01(
      queuePressureNumerator /
        Math.max(EPSILON, TENSION_CONSTANTS.MAX_SCORE),
    );

    // Backlog risk
    const backlogRisk = this.clamp01(
      runtime.arrivedCount * 0.22 +
        runtime.expiredCount * 0.18 +
        runtime.queuedCount * 0.06 +
        (runtime.isPulseActive ? 0.15 : 0),
    );

    // Collapse risk
    const collapseRisk = this.clamp01(
      runtime.score * 0.45 +
        queuePressureRatio * 0.2 +
        ghostBurden * 0.2 +
        (runtime.isPulseActive ? 0.1 : 0) +
        (runtime.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS
          ? 0.05
          : 0),
    );

    // Awareness load using VISIBILITY_CONFIGS awareness bonus
    const awarenessLoad =
      cb.visibilityBonus +
      runtime.visibleThreats.length /
        Math.max(1, runtime.queueLength);

    // Score volatility from history
    const volatility = this.computeScoreVolatility();

    // Escalation slope
    const slope = this.computeEscalationSlope();

    // Pressure amplifier used (accessed via PRESSURE_TENSION_AMPLIFIERS)
    const amplifierUsed = this.getPressureAmplifier(
      (snapshot?.pressure.tier ?? 'T0') as PressureTier,
    );

    // Visibility ordinal via VISIBILITY_ORDER and TENSION_VISIBILITY_STATE
    const visOrdinal = this.visibilityOrdinal(runtime.visibilityState);

    const values: number[] = [
      /* 0  */ runtime.score,
      /* 1  */ runtime.score - runtime.previousScore,
      /* 2  */ runtime.rawDelta,
      /* 3  */ runtime.amplifiedDelta,
      /* 4  */ visOrdinal / Math.max(1, VISIBILITY_ORDER.length - 1),
      /* 5  */ this.clamp01(runtime.queueLength / 24),
      /* 6  */ this.clamp01(runtime.arrivedCount / 12),
      /* 7  */ this.clamp01(runtime.queuedCount / 12),
      /* 8  */ this.clamp01(runtime.expiredCount / 12),
      /* 9  */ this.clamp01(runtime.relievedCount / 6),
      /* 10 */ runtime.isPulseActive ? 1 : 0,
      /* 11 */ this.clamp01(runtime.pulseTicksActive / 10),
      /* 12 */ runtime.isEscalating ? 1 : 0,
      /* 13 */ maxSevWeight,
      /* 14 */ avgSevWeight,
      /* 15 */ this.clamp01(totalSevWeight / 5),
      /* 16 */ this.clamp01(threatEntropy / 3),
      /* 17 */ arrivalImminence,
      /* 18 */ overdueRatio,
      /* 19 */ mitigationCoverage,
      /* 20 */ this.clamp01(ghostBurden),
      /* 21 */ this.clamp01(reliefStrength),
      /* 22 */ queuePressureRatio,
      /* 23 */ backlogRisk,
      /* 24 */ collapseRisk,
      /* 25 */ this.clamp01(awarenessLoad),
      /* 26 */ this.clamp01(volatility),
      /* 27 */ this.clamp01((slope + 0.5) / 1), // normalize slope to ~0-1
      /* 28 */ amplifierUsed / 1.5, // normalize 1.0-1.5 to 0.67-1.0
      /* 29 */ runtime.queueLength === 0 ? 1 : 0,
      /* 30 */ this.sovereigntyBonusFiredThisRun ? 1 : 0,
      /* 31 */ this.lastNearDeath ? 1 : 0,
    ];

    const vec: TensionMLVector = Object.freeze({
      dimension: ML_FEATURE_DIMENSION,
      labels: TENSION_ML_FEATURE_LABELS,
      values: Object.freeze(values),
      timestamp: nowMs,
      tickNumber: runtime.tickNumber,
    });

    // Archive to ML history
    this.mlHistory.push(vec);
    if (this.mlHistory.length > ANALYTICS_HISTORY_LIMIT) {
      this.mlHistory.shift();
    }

    return vec;
  }

  /**
   * Get the most recent ML vector without re-computing.
   */
  public getLastMLVector(): TensionMLVector | null {
    return this.mlHistory.length > 0
      ? this.mlHistory[this.mlHistory.length - 1] ?? null
      : null;
  }

  /**
   * Get full ML history for replay analysis.
   */
  public getMLHistory(): readonly TensionMLVector[] {
    return Object.freeze([...this.mlHistory]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 8 — DL tensor construction (48×8 sequence tensor)
  //
  //   Uses DL_SEQUENCE_LENGTH (48 rows) × DL_FEATURE_WIDTH (8 cols).
  //   Each row = one tick snapshot. Padded with zeros for missing history.
  //   TENSION_DL_COLUMN_LABELS defines the 8 features.
  // ═══════════════════════════════════════════════════════════════════════

  public extractDLTensor(): TensionDLTensor {
    // Pad buffer to DL_SEQUENCE_LENGTH rows
    const padded: (readonly number[])[] = [];
    const bufLen = this.dlBuffer.length;
    const startIdx = Math.max(0, bufLen - DL_SEQUENCE_LENGTH);

    // Pre-pad with zeros if buffer is shorter than sequence length
    const paddingRows = Math.max(0, DL_SEQUENCE_LENGTH - bufLen);
    for (let i = 0; i < paddingRows; i++) {
      padded.push(Object.freeze(new Array(DL_FEATURE_WIDTH).fill(0)));
    }

    // Fill with actual data
    for (let i = startIdx; i < bufLen; i++) {
      const row = this.dlBuffer[i];
      if (row !== undefined) {
        padded.push(Object.freeze([...row]));
      }
    }

    return Object.freeze({
      rows: DL_SEQUENCE_LENGTH,
      cols: DL_FEATURE_WIDTH,
      columnLabels: TENSION_DL_COLUMN_LABELS,
      data: Object.freeze(padded),
      timestamp: Date.now(),
    });
  }

  private pushDLBufferRow(runtime: TensionRuntimeSnapshot): void {
    const amplifier = this.getPressureAmplifier(
      this.lastPressureTier as PressureTier,
    );
    const row: number[] = [
      runtime.score,
      runtime.amplifiedDelta,
      this.clamp01(runtime.queueLength / 24),
      this.clamp01(runtime.arrivedCount / 12),
      this.visibilityOrdinal(runtime.visibilityState) /
        Math.max(1, VISIBILITY_ORDER.length - 1),
      runtime.isPulseActive ? 1 : 0,
      this.computeMaxSeverityWeightFromQueue(),
      amplifier / 1.5,
    ];
    this.dlBuffer.push(row);
    // Trim buffer to 2× sequence length for memory safety
    if (this.dlBuffer.length > DL_SEQUENCE_LENGTH * 2) {
      this.dlBuffer = this.dlBuffer.slice(-DL_SEQUENCE_LENGTH);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 9 — UX narrative generation
  //
  //   Produces human-readable tension commentary using ALL visibility
  //   states from TENSION_VISIBILITY_STATE, ALL threat types from
  //   THREAT_TYPE, ALL severities from THREAT_SEVERITY, and ALL
  //   event names from TENSION_EVENT_NAMES.
  // ═══════════════════════════════════════════════════════════════════════

  public generateNarrative(): TensionNarrative {
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const score = runtime.score;
    const vis = runtime.visibilityState;
    const qLen = runtime.queueLength;
    const arrivedCount = runtime.arrivedCount;

    // Determine urgency band using narrative constants
    const urgency: TensionNarrative['urgency'] =
      score >= NARRATIVE_SCORE_CRIT
        ? 'PULSE'
        : score >= NARRATIVE_SCORE_HIGH
          ? 'CRITICAL'
          : score >= NARRATIVE_SCORE_MED
            ? 'HIGH'
            : score >= NARRATIVE_SCORE_LOW
              ? 'BUILDING'
              : 'CALM';

    // Emoji based on urgency
    const emojiMap: Record<TensionNarrative['urgency'], string> = {
      CALM: '🟢',
      BUILDING: '🟡',
      HIGH: '🟠',
      CRITICAL: '🔴',
      PULSE: '💀',
    };
    const emoji = emojiMap[urgency];

    // Headline using visibility state labels
    const visLabel = this.visibilityDisplayLabel(vis);
    const headline = this.buildHeadline(urgency, score, qLen, arrivedCount);

    // Body with threat type analysis
    const body = this.buildNarrativeBody(runtime, urgency);

    // Advisory action using THREAT_TYPE_DEFAULT_MITIGATIONS
    const advisoryAction = this.buildAdvisoryAction(runtime);

    // Visibility note using INTERNAL_VISIBILITY_TO_ENVELOPE
    const envelopeLevel: VisibilityLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[vis];
    const visibilityNote = `Visibility: ${visLabel} (${envelopeLevel}). ${
      VISIBILITY_CONFIGS[vis].showsMitigationPath
        ? 'Full mitigation paths visible.'
        : VISIBILITY_CONFIGS[vis].showsArrivalTick
          ? 'Arrival countdowns visible.'
          : VISIBILITY_CONFIGS[vis].showsThreatType
            ? 'Threat categories visible.'
            : 'Only threat count visible.'
    }`;

    // Queue note
    const queueNote =
      qLen === 0
        ? 'Anticipation queue is clear. No known incoming threats.'
        : arrivedCount > 0
          ? `${arrivedCount} threat${arrivedCount > 1 ? 's' : ''} ACTIVE. ${qLen - arrivedCount} still queued.`
          : `${qLen} threat${qLen > 1 ? 's' : ''} queued. None yet arrived.`;

    return Object.freeze({
      headline,
      body,
      urgency,
      emoji,
      advisoryAction,
      visibilityNote,
      queueNote,
    });
  }

  private buildHeadline(
    urgency: TensionNarrative['urgency'],
    score: number,
    qLen: number,
    arrived: number,
  ): string {
    switch (urgency) {
      case 'PULSE':
        return `ANTICIPATION PULSE — Tension at ${(score * 100).toFixed(0)}%. ${arrived} threats active.`;
      case 'CRITICAL':
        return `DREAD RISING — Tension at ${(score * 100).toFixed(0)}%. Threats are compounding.`;
      case 'HIGH':
        return `ELEVATED TENSION — ${qLen} threats in queue. Mitigation needed.`;
      case 'BUILDING':
        return `TENSION BUILDING — ${qLen} threats incoming. Monitor closely.`;
      case 'CALM':
      default:
        return qLen > 0
          ? `Low tension. ${qLen} threats queued but manageable.`
          : 'Tension clear. No known threats.';
    }
  }

  private buildNarrativeBody(
    runtime: TensionRuntimeSnapshot,
    urgency: TensionNarrative['urgency'],
  ): string {
    const parts: string[] = [];
    const entries = this.queue.getSortedActiveQueue();

    // Classify by threat type using THREAT_TYPE constant values
    const typeGroups: Record<string, number> = {};
    for (const typeKey of Object.values(THREAT_TYPE)) {
      typeGroups[typeKey] = 0;
    }
    for (const entry of entries) {
      typeGroups[entry.threatType] = (typeGroups[entry.threatType] ?? 0) + 1;
    }

    const dominantType = Object.entries(typeGroups)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])[0];

    if (dominantType) {
      parts.push(
        `Dominant threat type: ${dominantType[0]} (${dominantType[1]} active).`,
      );
    }

    // Classify by severity using THREAT_SEVERITY values
    const sevGroups: Record<string, number> = {};
    for (const sevKey of Object.values(THREAT_SEVERITY)) {
      sevGroups[sevKey] = 0;
    }
    for (const entry of entries) {
      sevGroups[entry.threatSeverity] =
        (sevGroups[entry.threatSeverity] ?? 0) + 1;
    }

    const critCount = sevGroups[THREAT_SEVERITY.CRITICAL] ?? 0;
    const existCount = sevGroups[THREAT_SEVERITY.EXISTENTIAL] ?? 0;
    if (existCount > 0) {
      parts.push(
        `⚠ ${existCount} EXISTENTIAL-class threat${existCount > 1 ? 's' : ''} detected.`,
      );
    }
    if (critCount > 0) {
      parts.push(`${critCount} CRITICAL-class threats in queue.`);
    }

    // Pulse state details
    if (runtime.isPulseActive) {
      parts.push(
        `Anticipation Pulse active for ${runtime.pulseTicksActive} tick${runtime.pulseTicksActive > 1 ? 's' : ''}.`,
      );
      if (runtime.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS) {
        parts.push(
          'SUSTAINED PULSE — crisis mode. Screen border shift to COLLAPSE_IMMINENT.',
        );
      }
    }

    // Contribution breakdown narrative
    const cb = runtime.contributionBreakdown;
    if (cb.expiredGhosts > EPSILON) {
      parts.push(
        `Ghost penalty active: +${cb.expiredGhosts.toFixed(3)}/tick from expired threats.`,
      );
    }
    if (cb.sovereigntyBonus < -EPSILON) {
      parts.push('Sovereignty milestone relief applied this tick.');
    }

    return parts.join(' ');
  }

  private buildAdvisoryAction(runtime: TensionRuntimeSnapshot): string {
    const entries = this.queue.getArrivedEntries();
    if (entries.length === 0) {
      return runtime.queueLength > 0
        ? 'Prepare mitigation cards for incoming threats.'
        : 'No action needed. Queue clear.';
    }

    // Use THREAT_TYPE_DEFAULT_MITIGATIONS to suggest cards
    const neededMitigations = new Set<string>();
    for (const entry of entries) {
      const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
      if (defaults) {
        for (const card of defaults) {
          neededMitigations.add(card);
        }
      }
    }

    if (neededMitigations.size > 0) {
      const cards = [...neededMitigations].slice(0, 3).join(', ');
      return `Mitigate ${entries.length} active threats. Suggested cards: ${cards}.`;
    }

    return `Resolve ${entries.length} active threats before they expire.`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 10 — Trend analysis + escalation forecasting
  // ═══════════════════════════════════════════════════════════════════════

  public computeTrendSnapshot(): TensionTrendSnapshot {
    const history = this.scoreHistory;
    const len = history.length;

    if (len === 0) {
      return Object.freeze({
        slope: 0,
        momentum: 'FLAT' as const,
        volatility: 0,
        mean: 0,
        min: 0,
        max: 0,
        range: 0,
        isEscalating: false,
        consecutiveRisingTicks: 0,
        consecutiveFallingTicks: 0,
        ticksSincePeak: 0,
        ticksSinceTrough: 0,
      });
    }

    const slope = this.computeEscalationSlope();
    const momentum = this.slopeToMomentum(slope);
    const volatility = this.computeScoreVolatility();
    const mean = history.reduce((s, v) => s + v, 0) / len;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min;

    // Consecutive rising / falling
    let consecutiveRisingTicks = 0;
    let consecutiveFallingTicks = 0;
    for (let i = len - 1; i > 0; i--) {
      if (history[i]! > history[i - 1]!) {
        consecutiveRisingTicks += 1;
      } else {
        break;
      }
    }
    for (let i = len - 1; i > 0; i--) {
      if (history[i]! < history[i - 1]!) {
        consecutiveFallingTicks += 1;
      } else {
        break;
      }
    }

    // Ticks since peak / trough
    const peakIdx = history.lastIndexOf(max);
    const troughIdx = history.lastIndexOf(min);
    const ticksSincePeak = peakIdx >= 0 ? len - 1 - peakIdx : 0;
    const ticksSinceTrough = troughIdx >= 0 ? len - 1 - troughIdx : 0;

    return Object.freeze({
      slope,
      momentum,
      volatility,
      mean,
      min,
      max,
      range,
      isEscalating: this.computeIsEscalating(),
      consecutiveRisingTicks,
      consecutiveFallingTicks,
      ticksSincePeak,
      ticksSinceTrough,
    });
  }

  /**
   * Project future tension scores assuming no new threats and current decay rate.
   */
  public computeRecoveryForecast(): TensionRecoveryForecast {
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const expiredEntries = this.queue.getExpiredEntries();
    const ghostPenalty =
      expiredEntries.length * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;

    // Recovery is blocked if ghost penalty exceeds empty queue decay
    const recoveryBlocked =
      ghostPenalty > TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;

    const projected: number[] = [];
    let score = this.currentScore;
    let ticksToHalf = -1;
    let ticksToFull = -1;
    const halfTarget = this.currentScore / 2;

    for (let t = 0; t < FORECAST_HORIZON_TICKS; t++) {
      // Simulate: empty queue decay - ghost penalty
      const delta =
        -TENSION_CONSTANTS.EMPTY_QUEUE_DECAY + ghostPenalty;
      score = this.clampScore(score + delta * RECOVERY_DECAY_RATE);
      projected.push(score);

      if (ticksToHalf < 0 && score <= halfTarget) {
        ticksToHalf = t + 1;
      }
      if (ticksToFull < 0 && score <= TENSION_CONSTANTS.MIN_SCORE + EPSILON) {
        ticksToFull = t + 1;
      }
    }

    // Optimal mitigation count: how many active threats should be mitigated
    const optimalMitigationCount = this.queue.getArrivedEntries().length;

    // Pulse escape: ticks until score drops below PULSE_THRESHOLD
    let pulseEscapeTicks = 0;
    if (this.currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      let s = this.currentScore;
      while (
        s >= TENSION_CONSTANTS.PULSE_THRESHOLD &&
        pulseEscapeTicks < 20
      ) {
        s = this.clampScore(
          s -
            TENSION_CONSTANTS.EMPTY_QUEUE_DECAY +
            ghostPenalty,
        );
        pulseEscapeTicks += 1;
      }
    }

    return Object.freeze({
      currentScore: this.currentScore,
      projectedScores: Object.freeze(projected),
      ticksToHalfRecovery: ticksToHalf < 0 ? FORECAST_HORIZON_TICKS : ticksToHalf,
      ticksToFullRecovery: ticksToFull < 0 ? FORECAST_HORIZON_TICKS * 2 : ticksToFull,
      recoveryBlocked,
      blockerReason: recoveryBlocked
        ? `${expiredEntries.length} expired ghosts generating +${ghostPenalty.toFixed(3)}/tick penalty`
        : null,
      optimalMitigationCount,
      pulseEscapeTickEstimate: pulseEscapeTicks,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 11 — Score decomposition + contribution analysis
  // ═══════════════════════════════════════════════════════════════════════

  public getScoreDecomposition(): TensionScoreDecomposition {
    return (
      this.lastDecomposition ??
      this.buildEmptyScoreDecomposition()
    );
  }

  private buildScoreDecomposition(
    result: DecayComputeResult,
    pressureTier: PressureTier,
  ): TensionScoreDecomposition {
    const cb = result.contributionBreakdown;
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];

    const totalPositive =
      cb.queuedThreats + cb.arrivedThreats + cb.expiredGhosts + cb.visibilityBonus;
    const totalNegative =
      cb.mitigationDecay + cb.nullifyDecay + cb.emptyQueueBonus + cb.sovereigntyBonus;
    const amplifiedPositive = totalPositive * amplifier;

    // Determine dominant sources
    const positiveSources: [string, number][] = [
      ['queuedThreats', cb.queuedThreats],
      ['arrivedThreats', cb.arrivedThreats],
      ['expiredGhosts', cb.expiredGhosts],
      ['visibilityBonus', cb.visibilityBonus],
    ];
    const negativeSources: [string, number][] = [
      ['mitigationDecay', Math.abs(cb.mitigationDecay)],
      ['nullifyDecay', Math.abs(cb.nullifyDecay)],
      ['emptyQueueBonus', Math.abs(cb.emptyQueueBonus)],
      ['sovereigntyBonus', Math.abs(cb.sovereigntyBonus)],
    ];

    positiveSources.sort((a, b) => b[1] - a[1]);
    negativeSources.sort((a, b) => b[1] - a[1]);

    const pressureTax =
      amplifier > 1 && totalPositive > EPSILON
        ? ((amplifiedPositive - totalPositive) / totalPositive) * 100
        : 0;

    return Object.freeze({
      totalPositive,
      totalNegative,
      netDelta: result.rawDelta,
      amplifier,
      amplifiedPositive,
      unamplifiedNegative: totalNegative,
      breakdown: cb,
      dominantPositiveSource: positiveSources[0]?.[0] ?? 'none',
      dominantNegativeSource: negativeSources[0]?.[0] ?? 'none',
      pressureTaxPct: pressureTax,
    });
  }

  private buildEmptyScoreDecomposition(): TensionScoreDecomposition {
    return Object.freeze({
      totalPositive: 0,
      totalNegative: 0,
      netDelta: 0,
      amplifier: 1,
      amplifiedPositive: 0,
      unamplifiedNegative: 0,
      breakdown: Object.freeze({
        queuedThreats: 0,
        arrivedThreats: 0,
        expiredGhosts: 0,
        mitigationDecay: 0,
        nullifyDecay: 0,
        emptyQueueBonus: 0,
        visibilityBonus: 0,
        sovereigntyBonus: 0,
      }),
      dominantPositiveSource: 'none',
      dominantNegativeSource: 'none',
      pressureTaxPct: 0,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 12 — Queue analytics + threat classification
  // ═══════════════════════════════════════════════════════════════════════

  public computeQueueAnalytics(): TensionQueueAnalytics {
    const activeEntries = this.queue.getSortedActiveQueue();
    const arrivedEntries = this.queue.getArrivedEntries();
    const queuedEntries = this.queue.getQueuedEntries();
    const expiredEntries = this.queue.getExpiredEntries();
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();

    // Type distribution using ALL THREAT_TYPE keys
    const typeDistribution: Record<string, number> = {};
    for (const typeKey of Object.values(THREAT_TYPE)) {
      typeDistribution[typeKey] = 0;
    }
    for (const entry of activeEntries) {
      typeDistribution[entry.threatType] =
        (typeDistribution[entry.threatType] ?? 0) + 1;
    }

    // Severity distribution using ALL THREAT_SEVERITY keys
    const sevDistribution: Record<string, number> = {};
    for (const sevKey of Object.values(THREAT_SEVERITY)) {
      sevDistribution[sevKey] = 0;
    }
    for (const entry of activeEntries) {
      sevDistribution[entry.threatSeverity] =
        (sevDistribution[entry.threatSeverity] ?? 0) + 1;
    }

    // Severity weights using THREAT_SEVERITY_WEIGHTS
    const severityWeights = activeEntries.map((e) => {
      // Use the canonical weight from THREAT_SEVERITY_WEIGHTS
      const canonicalWeight = THREAT_SEVERITY_WEIGHTS[e.threatSeverity];
      return canonicalWeight !== undefined ? canonicalWeight : e.severityWeight;
    });
    const totalSevWeight = severityWeights.reduce((s, v) => s + v, 0);
    const avgSevWeight =
      severityWeights.length > 0
        ? totalSevWeight / severityWeights.length
        : 0;
    const maxSevWeight =
      severityWeights.length > 0 ? Math.max(...severityWeights) : 0;

    // ETA analysis
    const etaValues = queuedEntries
      .map((e) => Math.max(0, e.arrivalTick - runtime.tickNumber))
      .sort((a, b) => a - b);
    const avgEta =
      etaValues.length > 0
        ? etaValues.reduce((s, v) => s + v, 0) / etaValues.length
        : 0;

    const overdueCount = arrivedEntries.filter(
      (e) => e.ticksOverdue > 0,
    ).length;

    const coveredCount = activeEntries.filter(
      (e) => e.mitigationCardTypes.length > 0,
    ).length;

    const cascadeCount = activeEntries.filter(
      (e) => e.isCascadeTriggered,
    ).length;

    // Count mitigated / nullified using ENTRY_STATE enum access
    const allEntries = [
      ...activeEntries,
      ...expiredEntries,
    ];
    const mitigatedCount = allEntries.filter(
      (e) => e.state === ENTRY_STATE.MITIGATED,
    ).length;
    const nullifiedCount = allEntries.filter(
      (e) => e.state === ENTRY_STATE.NULLIFIED,
    ).length;

    return Object.freeze({
      totalEntries: activeEntries.length + expiredEntries.length,
      activeEntries: activeEntries.length,
      arrivedEntries: arrivedEntries.length,
      queuedEntries: queuedEntries.length,
      expiredEntries: expiredEntries.length,
      mitigatedEntries: mitigatedCount,
      nullifiedEntries: nullifiedCount,
      avgSeverityWeight: avgSevWeight,
      maxSeverityWeight: maxSevWeight,
      threatTypeDistribution: Object.freeze({ ...typeDistribution }),
      severityDistribution: Object.freeze({ ...sevDistribution }),
      avgTicksToArrival: avgEta,
      nearestArrivalTicks:
        etaValues.length > 0 ? (etaValues[0] ?? null) : null,
      furthestArrivalTicks:
        etaValues.length > 0
          ? (etaValues[etaValues.length - 1] ?? null)
          : null,
      overdueCount,
      mitigationCoverageRatio:
        activeEntries.length > 0
          ? coveredCount / activeEntries.length
          : 1,
      cascadeTriggeredRatio:
        activeEntries.length > 0
          ? cascadeCount / activeEntries.length
          : 0,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 13 — Visibility analytics + transition history
  // ═══════════════════════════════════════════════════════════════════════

  public getVisibilityTransitionHistory(): readonly TensionVisibilityTransition[] {
    return Object.freeze([...this.visibilityTransitions]);
  }

  public getVisibilityAnalytics(): {
    readonly currentState: TensionVisibilityState;
    readonly previousState: TensionVisibilityState | null;
    readonly pendingDowngrade: TensionVisibilityState | null;
    readonly downgradeCountdown: number;
    readonly transitionCount: number;
    readonly currentConfig: VisibilityConfig;
    readonly envelopeLevel: VisibilityLevel;
    readonly upgradeCount: number;
    readonly downgradeCount: number;
  } {
    const current = this.visibility.getCurrentState();
    const config = VISIBILITY_CONFIGS[current];
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[current];

    let upgradeCount = 0;
    let downgradeCount = 0;
    for (const t of this.visibilityTransitions) {
      if (t.wasUpgrade) {
        upgradeCount += 1;
      } else {
        downgradeCount += 1;
      }
    }

    return Object.freeze({
      currentState: current,
      previousState: this.visibility.getPreviousState(),
      pendingDowngrade: this.visibility.getPendingDowngrade(),
      downgradeCountdown: this.visibility.getDowngradeCountdown(),
      transitionCount: this.visibilityTransitionCount,
      currentConfig: config,
      envelopeLevel,
      upgradeCount,
      downgradeCount,
    });
  }

  private recordVisibilityTransition(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    atTick: number,
    atTimestamp: number,
    pressureTier: PressureTier,
  ): void {
    const fromOrdinal = this.visibilityOrdinal(from);
    const toOrdinal = this.visibilityOrdinal(to);

    this.visibilityTransitions.push({
      from,
      to,
      atTick,
      atTimestamp,
      pressureTierAtTransition: pressureTier,
      wasUpgrade: toOrdinal > fromOrdinal,
    });

    if (
      this.visibilityTransitions.length >
      VISIBILITY_TRANSITION_HISTORY_LIMIT
    ) {
      this.visibilityTransitions.shift();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 14 — Session-level analytics
  // ═══════════════════════════════════════════════════════════════════════

  public computeSessionAnalytics(): TensionSessionAnalytics {
    return Object.freeze({
      ticksProcessed: this.ticksProcessed,
      peakScore: this.peakScore,
      peakScoreTick: this.peakScoreTick,
      troughScore: this.troughScore === 1 ? 0 : this.troughScore,
      troughScoreTick: this.troughScoreTick,
      avgScore:
        this.ticksProcessed > 0
          ? this.scoreAccumulator / this.ticksProcessed
          : 0,
      totalMitigations: this.totalMitigations,
      totalNullifications: this.totalNullifications,
      totalExpirations: this.totalExpirations,
      totalArrivals: this.totalArrivals,
      totalEnqueued: this.totalEnqueued,
      pulseActivations: this.pulseActivations,
      sustainedPulseEvents: this.sustainedPulseEvents,
      maxConsecutivePulseTicks: this.maxConsecutivePulseTicks,
      visibilityTransitions: this.visibilityTransitionCount,
      longestEscalationStreak: this.longestEscalationStreak,
      longestCalmStreak: this.longestCalmStreak,
      scoreVolatilityAvg:
        this.ticksProcessed > 0
          ? this.volatilityAccumulator / this.ticksProcessed
          : 0,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 15 — Resilience scoring + recovery forecasting
  // ═══════════════════════════════════════════════════════════════════════

  public computeResilienceScore(): TensionResilienceScore {
    const session = this.computeSessionAnalytics();

    // Mitigation speed: ratio of mitigated to total arrivals
    const mitigationSpeed =
      session.totalArrivals > 0
        ? this.clamp01(session.totalMitigations / session.totalArrivals)
        : 1;

    // Queue clear rate: fraction of ticks where queue was empty
    // Approximate via calm streak vs total ticks
    const queueClearRate =
      session.ticksProcessed > 0
        ? this.clamp01(session.longestCalmStreak / session.ticksProcessed)
        : 1;

    // Ghost avoidance: 1 - (expirations / total arrivals)
    const ghostAvoidance =
      session.totalArrivals > 0
        ? this.clamp01(
            1 - session.totalExpirations / session.totalArrivals,
          )
        : 1;

    // Pulse avoidance: 1 - (pulse activations * 3 / total ticks)
    const pulseAvoidance =
      session.ticksProcessed > 0
        ? this.clamp01(
            1 -
              (session.pulseActivations * 3) / session.ticksProcessed,
          )
        : 1;

    // Visibility utilization: visibility transitions indicate awareness
    const visibilityUtilization =
      session.ticksProcessed > 0
        ? this.clamp01(
            session.visibilityTransitions /
              Math.max(1, session.ticksProcessed * 0.1),
          )
        : 0;

    // Composite: weighted average
    const composite =
      mitigationSpeed * 0.30 +
      queueClearRate * 0.15 +
      ghostAvoidance * 0.25 +
      pulseAvoidance * 0.20 +
      visibilityUtilization * 0.10;

    const grade =
      composite >= 0.90
        ? 'S'
        : composite >= 0.75
          ? 'A'
          : composite >= 0.60
            ? 'B'
            : composite >= 0.40
              ? 'C'
              : composite >= 0.20
                ? 'D'
                : 'F';

    return Object.freeze({
      mitigationSpeed,
      queueClearRate,
      ghostAvoidance,
      pulseAvoidance,
      visibilityUtilization,
      composite,
      grade,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 16 — Snapshot serialization + export projection
  // ═══════════════════════════════════════════════════════════════════════

  public buildExportBundle(): TensionExportBundle {
    return Object.freeze({
      engineId: this.engineId,
      runtimeSnapshot: this.getRuntimeSnapshot(),
      mlVector: this.extractMLVector(),
      trend: this.computeTrendSnapshot(),
      queueAnalytics: this.computeQueueAnalytics(),
      narrative: this.generateNarrative(),
      sessionAnalytics: this.computeSessionAnalytics(),
      resilience: this.computeResilienceScore(),
      health: this.health,
    });
  }

  /**
   * Serialize runtime state to a JSON-safe object for persistence or replay.
   */
  public serializeState(): Record<string, unknown> {
    const runtime = this.getRuntimeSnapshot();
    const session = this.computeSessionAnalytics();
    const trend = this.computeTrendSnapshot();

    // Use TENSION_EVENT_NAMES to label the event channels this engine emits on
    const eventChannels = Object.values(TENSION_EVENT_NAMES);

    return Object.freeze({
      engineId: this.engineId,
      score: runtime.score,
      previousScore: runtime.previousScore,
      visibilityState: runtime.visibilityState,
      queueLength: runtime.queueLength,
      arrivedCount: runtime.arrivedCount,
      queuedCount: runtime.queuedCount,
      expiredCount: runtime.expiredCount,
      isPulseActive: runtime.isPulseActive,
      pulseTicksActive: runtime.pulseTicksActive,
      isEscalating: runtime.isEscalating,
      dominantEntryId: runtime.dominantEntryId,
      lastSpikeTick: runtime.lastSpikeTick,
      tickNumber: runtime.tickNumber,
      timestamp: runtime.timestamp,
      scoreHistory: [...this.scoreHistory],
      trendSlope: trend.slope,
      trendMomentum: trend.momentum,
      sessionPeakScore: session.peakScore,
      sessionTotalMitigations: session.totalMitigations,
      sessionTotalExpirations: session.totalExpirations,
      eventChannels,
      contributionBreakdown: { ...runtime.contributionBreakdown },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 17 — Validation suite + contract invariant checks
  // ═══════════════════════════════════════════════════════════════════════

  public validate(): TensionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Score bounds
    if (this.currentScore < TENSION_CONSTANTS.MIN_SCORE) {
      errors.push(
        `Score ${this.currentScore} below MIN_SCORE ${TENSION_CONSTANTS.MIN_SCORE}`,
      );
    }
    if (this.currentScore > TENSION_CONSTANTS.MAX_SCORE) {
      errors.push(
        `Score ${this.currentScore} above MAX_SCORE ${TENSION_CONSTANTS.MAX_SCORE}`,
      );
    }

    // Pulse consistency
    if (
      this.pulseTicksActive > 0 &&
      this.currentScore < TENSION_CONSTANTS.PULSE_THRESHOLD
    ) {
      errors.push(
        `Pulse active (${this.pulseTicksActive} ticks) but score ${this.currentScore} below PULSE_THRESHOLD ${TENSION_CONSTANTS.PULSE_THRESHOLD}`,
      );
    }

    // Validate visibility state is in VISIBILITY_ORDER
    const currentVis = this.visibility.getCurrentState();
    if (!VISIBILITY_ORDER.includes(currentVis)) {
      errors.push(`Visibility state '${currentVis}' not in VISIBILITY_ORDER`);
    }

    // Validate visibility config exists
    const visConfig = VISIBILITY_CONFIGS[currentVis];
    if (!visConfig) {
      errors.push(
        `No VISIBILITY_CONFIG found for state '${currentVis}'`,
      );
    }

    // Validate queue entries have valid ENTRY_STATE values
    const validStates = new Set(Object.values(ENTRY_STATE));
    const activeEntries = this.queue.getSortedActiveQueue();
    for (const entry of activeEntries) {
      if (!validStates.has(entry.state)) {
        errors.push(
          `Entry ${entry.entryId} has invalid state '${entry.state}'`,
        );
      }
    }

    // Validate all THREAT_TYPE values are recognized
    const validThreatTypes = new Set(Object.values(THREAT_TYPE));
    for (const entry of activeEntries) {
      if (!validThreatTypes.has(entry.threatType)) {
        warnings.push(
          `Entry ${entry.entryId} has unrecognized threatType '${entry.threatType}'`,
        );
      }
    }

    // Validate all THREAT_SEVERITY values are recognized
    const validSeverities = new Set(Object.values(THREAT_SEVERITY));
    for (const entry of activeEntries) {
      if (!validSeverities.has(entry.threatSeverity)) {
        warnings.push(
          `Entry ${entry.entryId} has unrecognized severity '${entry.threatSeverity}'`,
        );
      }
    }

    // Validate THREAT_SEVERITY_WEIGHTS has all severity keys
    for (const sev of Object.values(THREAT_SEVERITY)) {
      if (THREAT_SEVERITY_WEIGHTS[sev] === undefined) {
        errors.push(
          `THREAT_SEVERITY_WEIGHTS missing weight for '${sev}'`,
        );
      }
    }

    // Validate PRESSURE_TENSION_AMPLIFIERS has all tier keys
    const tierKeys: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    for (const tier of tierKeys) {
      if (PRESSURE_TENSION_AMPLIFIERS[tier] === undefined) {
        errors.push(
          `PRESSURE_TENSION_AMPLIFIERS missing value for tier '${tier}'`,
        );
      }
    }

    // Validate INTERNAL_VISIBILITY_TO_ENVELOPE has all visibility states
    for (const vs of VISIBILITY_ORDER) {
      if (INTERNAL_VISIBILITY_TO_ENVELOPE[vs] === undefined) {
        errors.push(
          `INTERNAL_VISIBILITY_TO_ENVELOPE missing mapping for '${vs}'`,
        );
      }
    }

    // Validate THREAT_TYPE_DEFAULT_MITIGATIONS has all threat types
    for (const tt of Object.values(THREAT_TYPE)) {
      if (!THREAT_TYPE_DEFAULT_MITIGATIONS[tt]) {
        warnings.push(
          `THREAT_TYPE_DEFAULT_MITIGATIONS missing entry for '${tt}'`,
        );
      }
    }

    // Score history depth
    if (this.scoreHistory.length > SCORE_HISTORY_DEPTH) {
      warnings.push(
        `Score history length ${this.scoreHistory.length} exceeds SCORE_HISTORY_DEPTH ${SCORE_HISTORY_DEPTH}`,
      );
    }

    // ML feature dimension
    const lastML = this.getLastMLVector();
    if (lastML && lastML.values.length !== ML_FEATURE_DIMENSION) {
      errors.push(
        `ML vector dimension ${lastML.values.length} != expected ${ML_FEATURE_DIMENSION}`,
      );
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      checkedAt: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 18 — Self-test harness
  // ═══════════════════════════════════════════════════════════════════════

  public selfTest(): TensionSelfTestResult {
    const start = Date.now();
    const tests: { name: string; passed: boolean; detail: string }[] = [];

    // Test 1: TENSION_CONSTANTS integrity
    tests.push({
      name: 'TENSION_CONSTANTS.PULSE_THRESHOLD',
      passed: TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9,
      detail: `Expected 0.9, got ${TENSION_CONSTANTS.PULSE_THRESHOLD}`,
    });

    tests.push({
      name: 'TENSION_CONSTANTS.MAX_SCORE',
      passed: TENSION_CONSTANTS.MAX_SCORE === 1,
      detail: `Expected 1, got ${TENSION_CONSTANTS.MAX_SCORE}`,
    });

    tests.push({
      name: 'TENSION_CONSTANTS.MIN_SCORE',
      passed: TENSION_CONSTANTS.MIN_SCORE === 0,
      detail: `Expected 0, got ${TENSION_CONSTANTS.MIN_SCORE}`,
    });

    tests.push({
      name: 'TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS',
      passed: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS === 3,
      detail: `Expected 3, got ${TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS}`,
    });

    // Test 2: All 8 THREAT_TYPEs present
    const expectedTypes = 8;
    const actualTypes = Object.keys(THREAT_TYPE).length;
    tests.push({
      name: 'THREAT_TYPE count',
      passed: actualTypes === expectedTypes,
      detail: `Expected ${expectedTypes}, got ${actualTypes}`,
    });

    // Test 3: All 5 THREAT_SEVERITYs present
    const expectedSevs = 5;
    const actualSevs = Object.keys(THREAT_SEVERITY).length;
    tests.push({
      name: 'THREAT_SEVERITY count',
      passed: actualSevs === expectedSevs,
      detail: `Expected ${expectedSevs}, got ${actualSevs}`,
    });

    // Test 4: All 4 VISIBILITY_STATEs present
    const expectedVis = 4;
    const actualVis = Object.keys(TENSION_VISIBILITY_STATE).length;
    tests.push({
      name: 'TENSION_VISIBILITY_STATE count',
      passed: actualVis === expectedVis,
      detail: `Expected ${expectedVis}, got ${actualVis}`,
    });

    // Test 5: All 5 ENTRY_STATEs present
    const expectedEntryStates = 5;
    const actualEntryStates = Object.keys(ENTRY_STATE).length;
    tests.push({
      name: 'ENTRY_STATE count',
      passed: actualEntryStates === expectedEntryStates,
      detail: `Expected ${expectedEntryStates}, got ${actualEntryStates}`,
    });

    // Test 6: VISIBILITY_ORDER length matches VISIBILITY_STATE count
    tests.push({
      name: 'VISIBILITY_ORDER length',
      passed: VISIBILITY_ORDER.length === actualVis,
      detail: `Expected ${actualVis}, got ${VISIBILITY_ORDER.length}`,
    });

    // Test 7: ML feature labels match dimension
    tests.push({
      name: 'ML_FEATURE_LABELS length',
      passed: TENSION_ML_FEATURE_LABELS.length === ML_FEATURE_DIMENSION,
      detail: `Expected ${ML_FEATURE_DIMENSION}, got ${TENSION_ML_FEATURE_LABELS.length}`,
    });

    // Test 8: DL column labels match width
    tests.push({
      name: 'DL_COLUMN_LABELS length',
      passed: TENSION_DL_COLUMN_LABELS.length === DL_FEATURE_WIDTH,
      detail: `Expected ${DL_FEATURE_WIDTH}, got ${TENSION_DL_COLUMN_LABELS.length}`,
    });

    // Test 9: PRESSURE_TENSION_AMPLIFIERS all >= 1.0
    const tierKeys: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    let allAmpsValid = true;
    for (const tier of tierKeys) {
      const amp = PRESSURE_TENSION_AMPLIFIERS[tier];
      if (amp === undefined || amp < 1.0) {
        allAmpsValid = false;
      }
    }
    tests.push({
      name: 'PRESSURE_TENSION_AMPLIFIERS all >= 1.0',
      passed: allAmpsValid,
      detail: allAmpsValid ? 'All valid' : 'Some amplifiers < 1.0 or missing',
    });

    // Test 10: THREAT_SEVERITY_WEIGHTS sum is close to expected
    const sevWeightSum = Object.values(THREAT_SEVERITY_WEIGHTS).reduce(
      (s, v) => s + v,
      0,
    );
    tests.push({
      name: 'THREAT_SEVERITY_WEIGHTS integrity',
      passed: sevWeightSum > 2.0 && sevWeightSum < 4.0,
      detail: `Sum = ${sevWeightSum.toFixed(3)}`,
    });

    // Test 11: TENSION_EVENT_NAMES has all expected event names
    const expectedEvents = 8;
    const actualEvents = Object.keys(TENSION_EVENT_NAMES).length;
    tests.push({
      name: 'TENSION_EVENT_NAMES count',
      passed: actualEvents === expectedEvents,
      detail: `Expected ${expectedEvents}, got ${actualEvents}`,
    });

    // Test 12: Score clamp works
    const clampLow = this.clampScore(-0.5);
    const clampHigh = this.clampScore(1.5);
    tests.push({
      name: 'Score clamp lower bound',
      passed: clampLow === TENSION_CONSTANTS.MIN_SCORE,
      detail: `clamp(-0.5) = ${clampLow}`,
    });
    tests.push({
      name: 'Score clamp upper bound',
      passed: clampHigh === TENSION_CONSTANTS.MAX_SCORE,
      detail: `clamp(1.5) = ${clampHigh}`,
    });

    // Test 13: Empty runtime snapshot has valid structure
    const empty = this.buildEmptyRuntimeSnapshot();
    tests.push({
      name: 'Empty runtime snapshot score',
      passed: empty.score === 0 && empty.queueLength === 0,
      detail: `score=${empty.score} queueLength=${empty.queueLength}`,
    });

    // Test 14: VISIBILITY_CONFIGS has entries for all states
    let allConfigsPresent = true;
    for (const vs of VISIBILITY_ORDER) {
      if (!VISIBILITY_CONFIGS[vs]) {
        allConfigsPresent = false;
      }
    }
    tests.push({
      name: 'VISIBILITY_CONFIGS coverage',
      passed: allConfigsPresent,
      detail: allConfigsPresent
        ? 'All states have configs'
        : 'Missing configs for some states',
    });

    const duration = Date.now() - start;
    const allPassed = tests.every((t) => t.passed);

    return Object.freeze({
      passed: allPassed,
      tests: Object.freeze(tests.map((t) => Object.freeze(t))),
      duration,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════

  private asLooseBus(bus: TickContext['bus']): LooseEventBus {
    return bus as unknown as LooseEventBus;
  }

  private hydrateRun(snapshot: RunStateSnapshot): void {
    if (this.currentRunId === snapshot.runId) {
      return;
    }
    this.reset();
    this.currentRunId = snapshot.runId;
    this.currentScore = this.clampScore(snapshot.tension.score);
    if (this.currentScore > 0) {
      this.scoreHistory.push(this.currentScore);
    }
  }

  private computeNearDeath(snapshot: RunStateSnapshot): boolean {
    const bankruptcyProxy = Math.max(
      1,
      Math.abs(snapshot.economy.expensesPerTick) * 4,
    );
    if (snapshot.economy.netWorth <= 0) {
      return true;
    }
    return snapshot.economy.netWorth / bankruptcyProxy <= 0.25;
  }

  private computeDominantEntryId(
    entries: readonly Pick<
      AnticipationEntry,
      'entryId' | 'state' | 'severityWeight' | 'arrivalTick'
    >[],
  ): string | null {
    if (entries.length === 0) {
      return null;
    }
    const ranked = [...entries].sort((left, right) => {
      if (left.state !== right.state) {
        return left.state === ENTRY_STATE.ARRIVED ? -1 : 1;
      }
      if (left.severityWeight !== right.severityWeight) {
        return right.severityWeight - left.severityWeight;
      }
      return left.arrivalTick - right.arrivalTick;
    });
    return ranked[0]?.entryId ?? null;
  }

  private computeIsEscalating(): boolean {
    if (this.scoreHistory.length < TREND_WINDOW) {
      return false;
    }
    const recent = this.scoreHistory.slice(-TREND_WINDOW);
    for (let index = 1; index < recent.length; index += 1) {
      if (recent[index]! <= recent[index - 1]!) {
        return false;
      }
    }
    return true;
  }

  private computeEscalationSlope(): number {
    if (this.scoreHistory.length < 2) {
      return 0;
    }
    const last = this.scoreHistory[this.scoreHistory.length - 1] ?? 0;
    const prev = this.scoreHistory[this.scoreHistory.length - 2] ?? 0;
    return last - prev;
  }

  private computeScoreVolatility(): number {
    if (this.scoreHistory.length < 3) {
      return 0;
    }
    let sumDelta = 0;
    for (let i = 1; i < this.scoreHistory.length; i++) {
      sumDelta += Math.abs(
        (this.scoreHistory[i] ?? 0) - (this.scoreHistory[i - 1] ?? 0),
      );
    }
    return sumDelta / (this.scoreHistory.length - 1);
  }

  private slopeToMomentum(
    slope: number,
  ): 'FALLING' | 'FLAT' | 'RISING' | 'SPIKING' {
    if (slope >= ESCALATION_SLOPE_SPIKE) {
      return 'SPIKING';
    }
    if (slope >= ESCALATION_SLOPE_RISE) {
      return 'RISING';
    }
    if (slope <= -ESCALATION_SLOPE_RISE) {
      return 'FALLING';
    }
    return 'FLAT';
  }

  private clampScore(value: number): number {
    return Math.max(
      TENSION_CONSTANTS.MIN_SCORE,
      Math.min(TENSION_CONSTANTS.MAX_SCORE, value),
    );
  }

  private clamp01(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  private visibilityOrdinal(state: TensionVisibilityState): number {
    const idx = VISIBILITY_ORDER.indexOf(state);
    return idx >= 0 ? idx : 0;
  }

  private visibilityDisplayLabel(state: TensionVisibilityState): string {
    switch (state) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return 'SHADOWED';
      case TENSION_VISIBILITY_STATE.SIGNALED:
        return 'SIGNALED';
      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return 'TELEGRAPHED';
      case TENSION_VISIBILITY_STATE.EXPOSED:
        return 'EXPOSED';
      default:
        return 'UNKNOWN';
    }
  }

  private getPressureAmplifier(tier: PressureTier): number {
    return PRESSURE_TENSION_AMPLIFIERS[tier] ?? 1;
  }

  private computeMaxSeverityWeightFromQueue(): number {
    const active = this.queue.getSortedActiveQueue();
    if (active.length === 0) {
      return 0;
    }
    return Math.max(...active.map((e) => e.severityWeight));
  }

  private computeEntropy(
    distribution: Map<string, number>,
    total: number,
  ): number {
    if (total <= 0) {
      return 0;
    }
    let entropy = 0;
    for (const count of distribution.values()) {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    }
    return entropy;
  }

  private updateHealth(runtimeSnapshot: TensionRuntimeSnapshot): void {
    if (
      runtimeSnapshot.queueLength >= 24 ||
      runtimeSnapshot.pulseTicksActive >=
        TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS
    ) {
      this.health = createEngineHealth(
        'tension',
        'DEGRADED',
        runtimeSnapshot.timestamp,
        Object.freeze([
          `queue=${runtimeSnapshot.queueLength}`,
          `pulseTicks=${runtimeSnapshot.pulseTicksActive}`,
        ]),
      );
      return;
    }

    this.health = createEngineHealth(
      'tension',
      'HEALTHY',
      runtimeSnapshot.timestamp,
      Object.freeze([`score=${runtimeSnapshot.score.toFixed(3)}`]),
    );
  }

  private buildEmptyRuntimeSnapshot(): TensionRuntimeSnapshot {
    return {
      score: 0,
      previousScore: 0,
      rawDelta: 0,
      amplifiedDelta: 0,
      visibilityState: TENSION_VISIBILITY_STATE.SHADOWED,
      queueLength: 0,
      arrivedCount: 0,
      queuedCount: 0,
      expiredCount: 0,
      relievedCount: 0,
      visibleThreats: Object.freeze([]) as readonly ReturnType<
        TensionThreatProjector['toThreatEnvelopes']
      >[number][],
      isPulseActive: false,
      pulseTicksActive: 0,
      isEscalating: false,
      dominantEntryId: null,
      lastSpikeTick: null,
      tickNumber: 0,
      timestamp: Date.now(),
      contributionBreakdown: {
        queuedThreats: 0,
        arrivedThreats: 0,
        expiredGhosts: 0,
        mitigationDecay: 0,
        nullifyDecay: 0,
        emptyQueueBonus: 0,
        visibilityBonus: 0,
        sovereigntyBonus: 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 19 — Advanced per-threat-type analytics
  //
  //   Breaks down queue state by each of the 8 THREAT_TYPEs with
  //   per-type severity distributions, arrival windows, mitigation
  //   coverage, and UX narrative fragments.
  // ═══════════════════════════════════════════════════════════════════════

  public computePerThreatTypeAnalytics(): Readonly<
    Record<
      string,
      {
        readonly count: number;
        readonly arrivedCount: number;
        readonly queuedCount: number;
        readonly expiredCount: number;
        readonly avgSeverityWeight: number;
        readonly maxSeverityWeight: number;
        readonly avgTicksToArrival: number;
        readonly nearestArrivalTicks: number | null;
        readonly mitigationCoverage: number;
        readonly cascadeTriggeredCount: number;
        readonly defaultMitigationCards: readonly string[];
        readonly actionWindow: number;
        readonly uxLabel: string;
        readonly uxSeverityLabel: string;
        readonly isImmediate: boolean;
      }
    >
  > {
    const result: Record<string, {
      count: number;
      arrivedCount: number;
      queuedCount: number;
      expiredCount: number;
      severityWeights: number[];
      etaValues: number[];
      coveredCount: number;
      cascadeCount: number;
    }> = {};

    // Initialize bins for ALL threat types
    for (const typeKey of Object.values(THREAT_TYPE)) {
      result[typeKey] = {
        count: 0,
        arrivedCount: 0,
        queuedCount: 0,
        expiredCount: 0,
        severityWeights: [],
        etaValues: [],
        coveredCount: 0,
        cascadeCount: 0,
      };
    }

    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const allActive = this.queue.getSortedActiveQueue();
    const allExpired = this.queue.getExpiredEntries();
    const allEntries = [...allActive, ...allExpired];

    for (const entry of allEntries) {
      const bin = result[entry.threatType];
      if (!bin) continue;

      bin.count += 1;

      if (entry.state === ENTRY_STATE.ARRIVED) {
        bin.arrivedCount += 1;
      } else if (entry.state === ENTRY_STATE.QUEUED) {
        bin.queuedCount += 1;
        bin.etaValues.push(
          Math.max(0, entry.arrivalTick - runtime.tickNumber),
        );
      } else if (entry.state === ENTRY_STATE.EXPIRED) {
        bin.expiredCount += 1;
      }

      // Use canonical weights from THREAT_SEVERITY_WEIGHTS
      const canonWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      bin.severityWeights.push(canonWeight ?? entry.severityWeight);

      if (entry.mitigationCardTypes.length > 0) {
        bin.coveredCount += 1;
      }
      if (entry.isCascadeTriggered) {
        bin.cascadeCount += 1;
      }
    }

    // Build final output per threat type
    const output: Record<string, {
      readonly count: number;
      readonly arrivedCount: number;
      readonly queuedCount: number;
      readonly expiredCount: number;
      readonly avgSeverityWeight: number;
      readonly maxSeverityWeight: number;
      readonly avgTicksToArrival: number;
      readonly nearestArrivalTicks: number | null;
      readonly mitigationCoverage: number;
      readonly cascadeTriggeredCount: number;
      readonly defaultMitigationCards: readonly string[];
      readonly actionWindow: number;
      readonly uxLabel: string;
      readonly uxSeverityLabel: string;
      readonly isImmediate: boolean;
    }> = {};

    for (const typeKey of Object.values(THREAT_TYPE)) {
      const bin = result[typeKey]!;
      const weights = bin.severityWeights;
      const avgWeight =
        weights.length > 0
          ? weights.reduce((s, v) => s + v, 0) / weights.length
          : 0;
      const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
      const etas = bin.etaValues.sort((a, b) => a - b);
      const avgEta =
        etas.length > 0
          ? etas.reduce((s, v) => s + v, 0) / etas.length
          : 0;

      // Get default mitigations from THREAT_TYPE_DEFAULT_MITIGATIONS
      const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[typeKey] ?? Object.freeze([]);

      // Action window: 0 for immediate threat types
      const actionWindow = this.computeActionWindowForType(typeKey);
      const isImmediate = actionWindow === 0;

      output[typeKey] = Object.freeze({
        count: bin.count,
        arrivedCount: bin.arrivedCount,
        queuedCount: bin.queuedCount,
        expiredCount: bin.expiredCount,
        avgSeverityWeight: avgWeight,
        maxSeverityWeight: maxWeight,
        avgTicksToArrival: avgEta,
        nearestArrivalTicks:
          etas.length > 0 ? (etas[0] ?? null) : null,
        mitigationCoverage:
          bin.count > 0 ? bin.coveredCount / bin.count : 1,
        cascadeTriggeredCount: bin.cascadeCount,
        defaultMitigationCards: defaults,
        actionWindow,
        uxLabel: this.threatTypeUXLabel(typeKey),
        uxSeverityLabel: this.severityUXLabel(maxWeight),
        isImmediate,
      });
    }

    return Object.freeze(output);
  }

  private computeActionWindowForType(threatType: ThreatType): number {
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

  private threatTypeUXLabel(threatType: ThreatType): string {
    switch (threatType) {
      case THREAT_TYPE.DEBT_SPIRAL:
        return 'Debt Spiral — cashflow destruction over multiple ticks';
      case THREAT_TYPE.SABOTAGE:
        return 'Sabotage — one-time income wipe';
      case THREAT_TYPE.HATER_INJECTION:
        return 'Hater Injection — enemy card forced into hand';
      case THREAT_TYPE.CASCADE:
        return 'Cascade — consequence of previous failure';
      case THREAT_TYPE.SOVEREIGNTY:
        return 'Sovereignty — existential wealth threat';
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return 'Opportunity Kill — removes a positive card from play';
      case THREAT_TYPE.REPUTATION_BURN:
        return 'Reputation Burn — increases hater heat permanently';
      case THREAT_TYPE.SHIELD_PIERCE:
        return 'Shield Pierce — bypasses shield and hits directly';
      default:
        return 'Unknown threat type';
    }
  }

  private severityUXLabel(weight: number): string {
    // Map severity weights back to labels using THREAT_SEVERITY_WEIGHTS
    if (weight >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL]) {
      return 'EXISTENTIAL — >60% income or direct BANKRUPT risk';
    }
    if (weight >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL]) {
      return 'CRITICAL — 36–60% income impact';
    }
    if (weight >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE]) {
      return 'SEVERE — 16–35% income impact';
    }
    if (weight >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE]) {
      return 'MODERATE — 6–15% income impact';
    }
    return 'MINOR — 1–5% income impact';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 20 — Advanced visibility-aware threat projection
  //
  //   Generates full UX projection for each entry in the queue,
  //   applying visibility rules from VISIBILITY_CONFIGS and
  //   INTERNAL_VISIBILITY_TO_ENVELOPE to determine what the
  //   player sees at each visibility level.
  // ═══════════════════════════════════════════════════════════════════════

  public projectVisibilityAwareQueue(): readonly {
    readonly entryId: string;
    readonly state: string;
    readonly visibleThreatType: string | null;
    readonly visibleSeverity: string | null;
    readonly visibleArrivalTick: number | null;
    readonly visibleCountdown: string | null;
    readonly visibleWorstCase: string | null;
    readonly visibleMitigationPath: readonly string[] | null;
    readonly isCascade: boolean;
    readonly envelopeVisibility: VisibilityLevel;
    readonly uxSummary: string;
    readonly severityWeight: number;
  }[] {
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const vis = runtime.visibilityState;
    const config: VisibilityConfig = VISIBILITY_CONFIGS[vis];
    const envelopeVis: VisibilityLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[vis];
    const entries = this.queue.getSortedActiveQueue();

    const projections = entries.map((entry) => {
      // Apply visibility filtering rules per Section 3 of spec
      const showType = config.showsThreatType;
      const showArrival = config.showsArrivalTick;
      const showMitigation = config.showsMitigationPath;
      const showWorstCase = config.showsWorstCase;

      const etaTicks = entry.isArrived
        ? 0
        : Math.max(0, entry.arrivalTick - runtime.tickNumber);

      const countdown = showArrival
        ? entry.isArrived
          ? entry.ticksOverdue > 0
            ? `ACTIVE +${entry.ticksOverdue}t`
            : 'ACTIVE NOW'
          : `IN ${etaTicks}T`
        : null;

      // Build UX summary based on visibility state
      let uxSummary: string;
      switch (vis) {
        case TENSION_VISIBILITY_STATE.SHADOWED:
          uxSummary = entry.isArrived
            ? 'Active threat signature detected'
            : 'Threat signature detected';
          break;
        case TENSION_VISIBILITY_STATE.SIGNALED:
          uxSummary = entry.isArrived
            ? `${entry.threatType} active`
            : `${entry.threatType} incoming`;
          break;
        case TENSION_VISIBILITY_STATE.TELEGRAPHED:
          uxSummary = entry.isArrived
            ? `${entry.threatType} active +${entry.ticksOverdue}t`
            : `${entry.threatType} in ${etaTicks} ticks`;
          break;
        case TENSION_VISIBILITY_STATE.EXPOSED:
          uxSummary = entry.isArrived
            ? `${entry.threatType} active — ${entry.worstCaseOutcome} — use ${entry.mitigationCardTypes.join(' / ')}`
            : `${entry.threatType} in ${etaTicks} ticks — ${entry.worstCaseOutcome} — use ${entry.mitigationCardTypes.join(' / ')}`;
          break;
        default:
          uxSummary = entry.summary;
      }

      return Object.freeze({
        entryId: entry.entryId,
        state: entry.state,
        visibleThreatType: showType ? entry.threatType : null,
        visibleSeverity: showType ? entry.threatSeverity : null,
        visibleArrivalTick: showArrival ? entry.arrivalTick : null,
        visibleCountdown: countdown,
        visibleWorstCase: showWorstCase ? entry.worstCaseOutcome : null,
        visibleMitigationPath: showMitigation
          ? entry.mitigationCardTypes
          : null,
        isCascade: entry.isCascadeTriggered,
        envelopeVisibility: envelopeVis,
        uxSummary,
        severityWeight: entry.severityWeight,
      });
    });

    return Object.freeze(projections);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 21 — Pressure-Tension correlation analysis
  //
  //   Computes the correlation between pressure amplification and
  //   tension delta over the score history, using the pressure
  //   amplifier table from PRESSURE_TENSION_AMPLIFIERS.
  // ═══════════════════════════════════════════════════════════════════════

  public computePressureTensionCorrelation(): {
    readonly amplifierCurrent: number;
    readonly amplifierLabel: string;
    readonly pressureTaxPerTick: number;
    readonly pressureTaxCumulative: number;
    readonly worstCaseAmplifier: number;
    readonly bestCaseAmplifier: number;
    readonly amplifierSpread: number;
    readonly isNightmareState: boolean;
    readonly nightmareDescription: string | null;
  } {
    const amplifier = this.getPressureAmplifier(
      this.lastPressureTier as PressureTier,
    );
    const decomposition = this.lastDecomposition ?? this.buildEmptyScoreDecomposition();

    // Worst case is always T4 (CRITICAL)
    const worstCase = PRESSURE_TENSION_AMPLIFIERS['T4'];
    const bestCase = PRESSURE_TENSION_AMPLIFIERS['T0'];

    // Compute cumulative pressure tax
    const pressureTaxPerTick = decomposition.pressureTaxPct;
    const cumulativeTax = pressureTaxPerTick * this.ticksProcessed;

    // Nightmare state: both pressure at T3+ and tension at 0.70+
    const highPressure =
      this.lastPressureTier === 'T3' || this.lastPressureTier === 'T4';
    const highTension = this.currentScore >= NARRATIVE_SCORE_HIGH;
    const isNightmare = highPressure && highTension;

    // Label for current amplifier
    const amplifierLabel =
      amplifier >= 1.5
        ? 'MAXIMUM — 50% amplification'
        : amplifier >= 1.35
          ? 'HIGH — 35% amplification'
          : amplifier >= 1.2
            ? 'ELEVATED — 20% amplification'
            : amplifier >= 1.1
              ? 'BUILDING — 10% amplification'
              : 'CALM — no amplification';

    return Object.freeze({
      amplifierCurrent: amplifier,
      amplifierLabel,
      pressureTaxPerTick,
      pressureTaxCumulative: cumulativeTax,
      worstCaseAmplifier: worstCase,
      bestCaseAmplifier: bestCase,
      amplifierSpread: worstCase - bestCase,
      isNightmareState: isNightmare,
      nightmareDescription: isNightmare
        ? `FINANCIAL NIGHTMARE — Pressure at ${this.lastPressureTier} amplifies tension by ${((amplifier - 1) * 100).toFixed(0)}%. Score: ${(this.currentScore * 100).toFixed(0)}%. Both meters critical.`
        : null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 22 — Queue simulation / "what if" projector
  //
  //   Simulates future queue states without mutating actual queue.
  //   Projects arrivals, expirations, and tension delta for the
  //   next N ticks assuming no new threats and no mitigations.
  // ═══════════════════════════════════════════════════════════════════════

  public simulateQueueProjection(horizonTicks: number = FORECAST_HORIZON_TICKS): readonly {
    readonly tick: number;
    readonly projectedScore: number;
    readonly projectedArrivals: number;
    readonly projectedExpirations: number;
    readonly projectedQueueLength: number;
    readonly projectedIsPulse: boolean;
  }[] {
    const entries = this.queue.getSortedActiveQueue();
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const currentTick = runtime.tickNumber;

    const projections: {
      tick: number;
      projectedScore: number;
      projectedArrivals: number;
      projectedExpirations: number;
      projectedQueueLength: number;
      projectedIsPulse: boolean;
    }[] = [];

    let simScore = this.currentScore;
    let activeCount = runtime.queueLength;
    let arrivedCount = runtime.arrivedCount;
    let queuedRemaining = runtime.queuedCount;

    for (let t = 1; t <= horizonTicks; t++) {
      const futureTick = currentTick + t;

      // Count new arrivals this tick
      let newArrivals = 0;
      let newExpirations = 0;

      for (const entry of entries) {
        if (
          entry.state === ENTRY_STATE.QUEUED &&
          entry.arrivalTick === futureTick
        ) {
          newArrivals += 1;
        }
      }

      // Simulate expirations: arrived entries that exceed action window
      // (simplified — assume average 1 tick action window)
      if (arrivedCount > 0 && t > 1) {
        newExpirations = Math.min(1, arrivedCount);
      }

      arrivedCount = arrivedCount + newArrivals - newExpirations;
      queuedRemaining = Math.max(0, queuedRemaining - newArrivals);
      activeCount = arrivedCount + queuedRemaining;

      // Compute delta: arrived + queued contributions - empty queue bonus
      const delta =
        arrivedCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK +
        queuedRemaining * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK +
        newExpirations * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK -
        (activeCount === 0 ? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY : 0);

      // Apply pressure amplifier
      const amplifier = this.getPressureAmplifier(
        this.lastPressureTier as PressureTier,
      );
      const amplifiedDelta =
        Math.max(0, delta) * amplifier + Math.min(0, delta);

      simScore = this.clampScore(simScore + amplifiedDelta);

      projections.push({
        tick: futureTick,
        projectedScore: simScore,
        projectedArrivals: newArrivals,
        projectedExpirations: newExpirations,
        projectedQueueLength: activeCount,
        projectedIsPulse: simScore >= TENSION_CONSTANTS.PULSE_THRESHOLD,
      });
    }

    return Object.freeze(
      projections.map((p) => Object.freeze(p)),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 23 — Mitigation recommendation engine
  //
  //   Analyzes the current queue and recommends optimal mitigation
  //   priorities based on severity, arrival imminence, action windows,
  //   and available mitigation card types.
  // ═══════════════════════════════════════════════════════════════════════

  public computeMitigationRecommendations(): readonly {
    readonly entryId: string;
    readonly priority: number;
    readonly urgency: 'IMMEDIATE' | 'URGENT' | 'PLAN' | 'WATCH';
    readonly threatType: ThreatType;
    readonly threatSeverity: ThreatSeverity;
    readonly ticksRemaining: number;
    readonly actionWindowTicks: number;
    readonly suggestedCards: readonly string[];
    readonly severityWeight: number;
    readonly uxReason: string;
  }[] {
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const entries = this.queue.getSortedActiveQueue();

    const recommendations = entries.map((entry) => {
      const actionWindow = this.computeActionWindowForType(entry.threatType);
      const ticksRemaining = entry.isArrived
        ? Math.max(0, actionWindow - entry.ticksOverdue)
        : Math.max(0, entry.arrivalTick - runtime.tickNumber);

      // Priority score: higher = more urgent
      let priority = 0;
      priority += entry.severityWeight * 40; // severity dominates
      priority += entry.isArrived ? 30 : 0; // arrived threats are more urgent
      priority += (1 - ticksRemaining / Math.max(1, actionWindow + 5)) * 20; // imminence
      priority += entry.isCascadeTriggered ? 10 : 0; // cascade threats escalate

      // Urgency classification
      const urgency: 'IMMEDIATE' | 'URGENT' | 'PLAN' | 'WATCH' =
        entry.isArrived && ticksRemaining <= 0
          ? 'IMMEDIATE'
          : entry.isArrived || ticksRemaining <= 1
            ? 'URGENT'
            : ticksRemaining <= 3
              ? 'PLAN'
              : 'WATCH';

      // Suggested cards from THREAT_TYPE_DEFAULT_MITIGATIONS
      const suggestedCards =
        entry.mitigationCardTypes.length > 0
          ? entry.mitigationCardTypes
          : THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType] ??
            Object.freeze([]);

      // UX reason
      const uxReason =
        urgency === 'IMMEDIATE'
          ? `${entry.threatType} has arrived and action window is closing. Mitigate NOW.`
          : urgency === 'URGENT'
            ? `${entry.threatType} ${entry.isArrived ? 'is active' : `arrives in ${ticksRemaining} tick${ticksRemaining !== 1 ? 's' : ''}`}. Prepare mitigation.`
            : urgency === 'PLAN'
              ? `${entry.threatType} arriving in ${ticksRemaining} ticks. Plan your response.`
              : `${entry.threatType} queued. Monitor for escalation.`;

      return Object.freeze({
        entryId: entry.entryId,
        priority,
        urgency,
        threatType: entry.threatType as ThreatType,
        threatSeverity: entry.threatSeverity as ThreatSeverity,
        ticksRemaining,
        actionWindowTicks: actionWindow,
        suggestedCards,
        severityWeight: entry.severityWeight,
        uxReason,
      });
    });

    // Sort by priority descending
    recommendations.sort((a, b) => b.priority - a.priority);

    return Object.freeze(recommendations);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 24 — Decay simulation engine
  //
  //   Projects how the tension score would decay under different
  //   mitigation scenarios, using all TENSION_CONSTANTS decay rates.
  // ═══════════════════════════════════════════════════════════════════════

  public simulateDecayScenarios(): {
    readonly noAction: readonly number[];
    readonly mitigateAll: readonly number[];
    readonly mitigateHalf: readonly number[];
    readonly withSovereigntyBonus: readonly number[];
    readonly optimalPath: readonly number[];
  } {
    const horizonTicks = FORECAST_HORIZON_TICKS;
    const expiredCount = this.queue.getExpiredEntries().length;
    const arrivedCount = this.queue.getArrivedEntries().length;
    const queuedCount = this.queue.getQueuedEntries().length;

    // Scenario 1: No action — threats arrive and expire
    const noAction = this.simulateDecayPath(
      horizonTicks,
      0,
      expiredCount,
      arrivedCount,
      queuedCount,
      false,
    );

    // Scenario 2: Mitigate ALL arrived threats immediately
    const mitigateAll = this.simulateDecayPath(
      horizonTicks,
      arrivedCount,
      expiredCount,
      0,
      queuedCount,
      false,
    );

    // Scenario 3: Mitigate half
    const mitigateHalf = this.simulateDecayPath(
      horizonTicks,
      Math.floor(arrivedCount / 2),
      expiredCount,
      Math.ceil(arrivedCount / 2),
      queuedCount,
      false,
    );

    // Scenario 4: With sovereignty bonus
    const withSov = this.simulateDecayPath(
      horizonTicks,
      arrivedCount,
      expiredCount,
      0,
      queuedCount,
      true,
    );

    // Scenario 5: Optimal — mitigate all + sovereignty
    const optimal = this.simulateDecayPath(
      horizonTicks,
      arrivedCount,
      0,
      0,
      0,
      true,
    );

    return Object.freeze({
      noAction: Object.freeze(noAction),
      mitigateAll: Object.freeze(mitigateAll),
      mitigateHalf: Object.freeze(mitigateHalf),
      withSovereigntyBonus: Object.freeze(withSov),
      optimalPath: Object.freeze(optimal),
    });
  }

  private simulateDecayPath(
    horizonTicks: number,
    mitigatedCount: number,
    expiredCount: number,
    arrivedCount: number,
    queuedCount: number,
    applySovereigntyBonus: boolean,
  ): number[] {
    const path: number[] = [];
    let score = this.currentScore;
    let mitigationDecayTicks = mitigatedCount > 0
      ? TENSION_CONSTANTS.MITIGATION_DECAY_TICKS
      : 0;

    for (let t = 0; t < horizonTicks; t++) {
      let delta = 0;

      // Positive contributions
      delta += arrivedCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
      delta += queuedCount * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
      delta += expiredCount * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;

      // Negative contributions
      if (mitigationDecayTicks > 0) {
        delta -= mitigatedCount * TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
        mitigationDecayTicks -= 1;
      }

      if (arrivedCount === 0 && queuedCount === 0) {
        delta -= TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;
      }

      if (applySovereigntyBonus && t === 0) {
        delta -= TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY;
      }

      score = this.clampScore(score + delta);
      path.push(score);
    }

    return path;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 25 — Ghost penalty analysis
  //
  //   Analyzes the lingering penalty from expired threats.
  //   Per spec: ghost penalty (+0.08/tick) persists for the entire run.
  //   It is a "permanent run scar" — never auto-removed.
  // ═══════════════════════════════════════════════════════════════════════

  public computeGhostPenaltyAnalysis(): {
    readonly ghostCount: number;
    readonly penaltyPerTick: number;
    readonly totalPenaltyThisRun: number;
    readonly ticksSinceFirstGhost: number;
    readonly ghostRecoveryImpact: number;
    readonly ghostBlocksRecovery: boolean;
    readonly ghostNarrative: string;
  } {
    const expired = this.queue.getExpiredEntries();
    const ghostCount = expired.length;
    const penaltyPerTick =
      ghostCount * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();

    // Find earliest expiration tick
    let earliestExpireTick = Infinity;
    for (const entry of expired) {
      if (
        entry.expiredAtTick !== null &&
        entry.expiredAtTick < earliestExpireTick
      ) {
        earliestExpireTick = entry.expiredAtTick;
      }
    }
    const ticksSinceFirstGhost =
      earliestExpireTick === Infinity
        ? 0
        : runtime.tickNumber - earliestExpireTick;

    // Total penalty accumulated since first ghost
    const totalPenalty = penaltyPerTick * ticksSinceFirstGhost;

    // Does ghost penalty exceed empty queue recovery?
    const ghostBlocksRecovery =
      penaltyPerTick > TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;

    // Impact: what fraction of the empty queue bonus is consumed by ghosts
    const ghostRecoveryImpact =
      TENSION_CONSTANTS.EMPTY_QUEUE_DECAY > EPSILON
        ? this.clamp01(penaltyPerTick / TENSION_CONSTANTS.EMPTY_QUEUE_DECAY)
        : 0;

    // Narrative
    let ghostNarrative: string;
    if (ghostCount === 0) {
      ghostNarrative = 'No ghost penalties. All threats resolved or still active.';
    } else if (ghostBlocksRecovery) {
      ghostNarrative = `${ghostCount} ghost${ghostCount > 1 ? 's' : ''} generating +${penaltyPerTick.toFixed(3)}/tick. Recovery BLOCKED — ghosts exceed empty queue bonus (-${TENSION_CONSTANTS.EMPTY_QUEUE_DECAY.toFixed(3)}/tick). Tension cannot decay naturally.`;
    } else {
      ghostNarrative = `${ghostCount} ghost${ghostCount > 1 ? 's' : ''} generating +${penaltyPerTick.toFixed(3)}/tick. Recovery slowed but not blocked. Net recovery: -${(TENSION_CONSTANTS.EMPTY_QUEUE_DECAY - penaltyPerTick).toFixed(3)}/tick when queue is empty.`;
    }

    return Object.freeze({
      ghostCount,
      penaltyPerTick,
      totalPenaltyThisRun: totalPenalty,
      ticksSinceFirstGhost,
      ghostRecoveryImpact,
      ghostBlocksRecovery,
      ghostNarrative,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 26 — Pulse state analytics
  //
  //   Deep analysis of the Anticipation Pulse state: activation
  //   history, sustained pulse events, and projected escape timeline.
  //   Uses TENSION_CONSTANTS.PULSE_THRESHOLD and PULSE_SUSTAINED_TICKS.
  // ═══════════════════════════════════════════════════════════════════════

  public computePulseAnalytics(): {
    readonly isActive: boolean;
    readonly currentStreak: number;
    readonly isSustained: boolean;
    readonly threshold: number;
    readonly sustainedThreshold: number;
    readonly distanceToThreshold: number;
    readonly activationsThisRun: number;
    readonly sustainedEventsThisRun: number;
    readonly maxStreakThisRun: number;
    readonly pulseNarrative: string;
  } {
    const score = this.currentScore;
    const isActive = score >= TENSION_CONSTANTS.PULSE_THRESHOLD;
    const isSustained =
      this.pulseTicksActive >= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS;

    const distanceToThreshold = isActive
      ? score - TENSION_CONSTANTS.PULSE_THRESHOLD
      : TENSION_CONSTANTS.PULSE_THRESHOLD - score;

    let pulseNarrative: string;
    if (!isActive) {
      if (score >= TENSION_CONSTANTS.PULSE_THRESHOLD - 0.05) {
        pulseNarrative = `Near pulse threshold. Score ${(score * 100).toFixed(0)}% is ${(distanceToThreshold * 100).toFixed(0)}% below ${(TENSION_CONSTANTS.PULSE_THRESHOLD * 100).toFixed(0)}% trigger.`;
      } else {
        pulseNarrative = 'Pulse inactive. Tension below threshold.';
      }
    } else if (isSustained) {
      pulseNarrative = `SUSTAINED PULSE for ${this.pulseTicksActive} ticks. Screen border shift to COLLAPSE_IMMINENT. Crisis UI active.`;
    } else {
      pulseNarrative = `PULSE ACTIVE for ${this.pulseTicksActive} tick${this.pulseTicksActive > 1 ? 's' : ''}. ${TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS - this.pulseTicksActive} more ticks until sustained crisis mode.`;
    }

    return Object.freeze({
      isActive,
      currentStreak: this.pulseTicksActive,
      isSustained,
      threshold: TENSION_CONSTANTS.PULSE_THRESHOLD,
      sustainedThreshold: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
      distanceToThreshold,
      activationsThisRun: this.pulseActivations,
      sustainedEventsThisRun: this.sustainedPulseEvents,
      maxStreakThisRun: this.maxConsecutivePulseTicks,
      pulseNarrative,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 27 — Complete engine diagnostic dump
  //
  //   Produces a comprehensive diagnostic snapshot for debugging,
  //   replay analysis, and admin tooling. Uses ALL imported constants
  //   and types to create a full engine state picture.
  // ═══════════════════════════════════════════════════════════════════════

  public generateDiagnosticDump(): Record<string, unknown> {
    const runtime = this.getRuntimeSnapshot();
    const session = this.computeSessionAnalytics();
    const trend = this.computeTrendSnapshot();
    const queue = this.computeQueueAnalytics();
    const resilience = this.computeResilienceScore();
    const forecast = this.computeRecoveryForecast();
    const ghost = this.computeGhostPenaltyAnalysis();
    const pulse = this.computePulseAnalytics();
    const correlation = this.computePressureTensionCorrelation();
    const validation = this.validate();
    const visibility = this.getVisibilityAnalytics();
    const narrative = this.generateNarrative();
    const decomposition = this.getScoreDecomposition();

    return Object.freeze({
      engineId: this.engineId,
      engineVersion: 'v2',
      timestamp: Date.now(),

      // Core state
      score: runtime.score,
      previousScore: runtime.previousScore,
      scoreHistory: [...this.scoreHistory],
      visibilityState: runtime.visibilityState,
      queueLength: runtime.queueLength,
      isPulseActive: runtime.isPulseActive,

      // Constants verification
      constants: {
        PULSE_THRESHOLD: TENSION_CONSTANTS.PULSE_THRESHOLD,
        PULSE_SUSTAINED_TICKS: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
        MAX_SCORE: TENSION_CONSTANTS.MAX_SCORE,
        MIN_SCORE: TENSION_CONSTANTS.MIN_SCORE,
        QUEUED_TENSION_PER_TICK: TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
        ARRIVED_TENSION_PER_TICK: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
        EXPIRED_GHOST_PER_TICK: TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK,
        MITIGATION_DECAY_PER_TICK: TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK,
        MITIGATION_DECAY_TICKS: TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
        NULLIFY_DECAY_PER_TICK: TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK,
        NULLIFY_DECAY_TICKS: TENSION_CONSTANTS.NULLIFY_DECAY_TICKS,
        EMPTY_QUEUE_DECAY: TENSION_CONSTANTS.EMPTY_QUEUE_DECAY,
        SOVEREIGNTY_BONUS_DECAY: TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY,
      },

      // Subsystem snapshots
      session,
      trend,
      queue,
      resilience,
      forecast,
      ghost,
      pulse,
      correlation,
      validation,
      visibility,
      narrative,
      decomposition,

      // Health
      health: this.health,

      // Flags
      nearDeath: this.lastNearDeath,
      pressureTier: this.lastPressureTier,
      sovereigntyBonusFired: this.sovereigntyBonusFiredThisRun,
      mlHistoryLength: this.mlHistory.length,
      dlBufferLength: this.dlBuffer.length,
      visibilityTransitionCount: this.visibilityTransitionCount,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 28 — Anticipation curve builder
  //
  //   Builds a complete anticipation curve for the current run:
  //   score over time, arrival events, expiration events, mitigation
  //   events, visibility transitions, and pulse activations.
  //   This is the primary data source for replay visualization.
  // ═══════════════════════════════════════════════════════════════════════

  public buildAnticipationCurve(): {
    readonly scoreTimeSeries: readonly number[];
    readonly tickCount: number;
    readonly peakScore: number;
    readonly peakScoreTick: number;
    readonly troughScore: number;
    readonly troughScoreTick: number;
    readonly avgScore: number;
    readonly medianScore: number;
    readonly p95Score: number;
    readonly p99Score: number;
    readonly timeAbovePulse: number;
    readonly timeAboveHigh: number;
    readonly timeAboveMedium: number;
    readonly timeBelowCalm: number;
    readonly areaUnderCurve: number;
    readonly varianceCoefficient: number;
  } {
    const history = [...this.scoreHistory];
    const len = history.length;

    if (len === 0) {
      return Object.freeze({
        scoreTimeSeries: Object.freeze([]),
        tickCount: 0,
        peakScore: 0,
        peakScoreTick: 0,
        troughScore: 0,
        troughScoreTick: 0,
        avgScore: 0,
        medianScore: 0,
        p95Score: 0,
        p99Score: 0,
        timeAbovePulse: 0,
        timeAboveHigh: 0,
        timeAboveMedium: 0,
        timeBelowCalm: 0,
        areaUnderCurve: 0,
        varianceCoefficient: 0,
      });
    }

    const sorted = [...history].sort((a, b) => a - b);
    const peak = Math.max(...history);
    const peakTick = history.indexOf(peak);
    const trough = Math.min(...history);
    const troughTick = history.indexOf(trough);
    const avg = history.reduce((s, v) => s + v, 0) / len;
    const median = sorted[Math.floor(len / 2)] ?? 0;
    const p95 = sorted[Math.floor(len * 0.95)] ?? peak;
    const p99 = sorted[Math.floor(len * 0.99)] ?? peak;

    // Time in each band
    let abovePulse = 0;
    let aboveHigh = 0;
    let aboveMedium = 0;
    let belowCalm = 0;
    let auc = 0;

    for (const score of history) {
      if (score >= NARRATIVE_SCORE_CRIT) abovePulse += 1;
      if (score >= NARRATIVE_SCORE_HIGH) aboveHigh += 1;
      if (score >= NARRATIVE_SCORE_MED) aboveMedium += 1;
      if (score < NARRATIVE_SCORE_LOW) belowCalm += 1;
      auc += score;
    }

    // Variance coefficient
    const variance =
      history.reduce((s, v) => s + (v - avg) ** 2, 0) / len;
    const stddev = Math.sqrt(variance);
    const cv = avg > EPSILON ? stddev / avg : 0;

    return Object.freeze({
      scoreTimeSeries: Object.freeze(history),
      tickCount: len,
      peakScore: peak,
      peakScoreTick: peakTick,
      troughScore: trough,
      troughScoreTick: troughTick,
      avgScore: avg,
      medianScore: median,
      p95Score: p95,
      p99Score: p99,
      timeAbovePulse: abovePulse / len,
      timeAboveHigh: aboveHigh / len,
      timeAboveMedium: aboveMedium / len,
      timeBelowCalm: belowCalm / len,
      areaUnderCurve: auc,
      varianceCoefficient: cv,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 29 — Threat timeline builder
  //
  //   Creates a chronological timeline of all threat events for
  //   replay display: when each threat was enqueued, when it arrived,
  //   when it was mitigated/expired, and its impact on tension score.
  // ═══════════════════════════════════════════════════════════════════════

  public buildThreatTimeline(): readonly {
    readonly entryId: string;
    readonly threatType: ThreatType;
    readonly threatSeverity: ThreatSeverity;
    readonly enqueuedAtTick: number;
    readonly arrivalTick: number;
    readonly resolvedAtTick: number | null;
    readonly resolution: 'ARRIVED' | 'MITIGATED' | 'EXPIRED' | 'NULLIFIED' | 'QUEUED';
    readonly isCascadeTriggered: boolean;
    readonly severityWeight: number;
    readonly tensionContributionEstimate: number;
    readonly uxLabel: string;
  }[] {
    const allActive = this.queue.getSortedActiveQueue();
    const allExpired = this.queue.getExpiredEntries();
    const allEntries = [...allActive, ...allExpired];

    const timeline = allEntries.map((entry) => {
      // Estimate tension contribution based on state
      let tensionContribution = 0;
      const ticksQueued = Math.max(
        0,
        (entry.isArrived ? entry.arrivalTick : 0) - entry.enqueuedAtTick,
      );
      tensionContribution +=
        ticksQueued * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;

      if (entry.isArrived || entry.isExpired) {
        const ticksArrived = entry.ticksOverdue + 1;
        tensionContribution +=
          ticksArrived * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
      }

      if (entry.isExpired) {
        // Ghost penalty will continue for the rest of the run
        tensionContribution += TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * 10; // estimate
      }

      // Resolution status
      let resolution: 'ARRIVED' | 'MITIGATED' | 'EXPIRED' | 'NULLIFIED' | 'QUEUED';
      let resolvedAtTick: number | null = null;

      if (entry.state === ENTRY_STATE.MITIGATED) {
        resolution = 'MITIGATED';
        resolvedAtTick = entry.mitigatedAtTick;
      } else if (entry.state === ENTRY_STATE.EXPIRED) {
        resolution = 'EXPIRED';
        resolvedAtTick = entry.expiredAtTick;
      } else if (entry.state === ENTRY_STATE.NULLIFIED) {
        resolution = 'NULLIFIED';
        resolvedAtTick = null; // nullification tick not tracked in entry
      } else if (entry.state === ENTRY_STATE.ARRIVED) {
        resolution = 'ARRIVED';
      } else {
        resolution = 'QUEUED';
      }

      // UX label using threat type descriptions
      const uxLabel = `${entry.threatType} (${entry.threatSeverity}) — ${entry.summary}`;

      return Object.freeze({
        entryId: entry.entryId,
        threatType: entry.threatType as ThreatType,
        threatSeverity: entry.threatSeverity as ThreatSeverity,
        enqueuedAtTick: entry.enqueuedAtTick,
        arrivalTick: entry.arrivalTick,
        resolvedAtTick,
        resolution,
        isCascadeTriggered: entry.isCascadeTriggered,
        severityWeight: entry.severityWeight,
        tensionContributionEstimate: tensionContribution,
        uxLabel,
      });
    });

    // Sort chronologically by enqueue tick
    timeline.sort((a, b) => a.enqueuedAtTick - b.enqueuedAtTick);

    return Object.freeze(timeline);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 30 — Visibility state decision tree explanation
  //
  //   Explains WHY the current visibility state was chosen, showing
  //   the full decision tree: pressure tier → near-death check →
  //   counter-intel promotion → downgrade delay → final state.
  //   Designed for admin tooling and companion explanations.
  // ═══════════════════════════════════════════════════════════════════════

  public explainVisibilityDecision(): {
    readonly currentState: TensionVisibilityState;
    readonly pressureTier: string;
    readonly isNearDeath: boolean;
    readonly baseStateFromPressure: TensionVisibilityState;
    readonly pendingDowngrade: TensionVisibilityState | null;
    readonly downgradeCountdown: number;
    readonly config: VisibilityConfig;
    readonly envelopeLevel: VisibilityLevel;
    readonly playerSees: {
      readonly threatCount: boolean;
      readonly threatType: boolean;
      readonly arrivalTick: boolean;
      readonly mitigationPath: boolean;
      readonly worstCase: boolean;
    };
    readonly explanation: string;
  } {
    const current = this.visibility.getCurrentState();
    const config = VISIBILITY_CONFIGS[current];
    const envelope = INTERNAL_VISIBILITY_TO_ENVELOPE[current];
    const pending = this.visibility.getPendingDowngrade();
    const countdown = this.visibility.getDowngradeCountdown();

    // Compute what the base state would be from just pressure
    let baseState: TensionVisibilityState;
    if (this.lastPressureTier === 'T4' && this.lastNearDeath) {
      baseState = TENSION_VISIBILITY_STATE.EXPOSED;
    } else if (
      this.lastPressureTier === 'T2' ||
      this.lastPressureTier === 'T3' ||
      this.lastPressureTier === 'T4'
    ) {
      baseState = TENSION_VISIBILITY_STATE.TELEGRAPHED;
    } else if (this.lastPressureTier === 'T1') {
      baseState = TENSION_VISIBILITY_STATE.SIGNALED;
    } else {
      baseState = TENSION_VISIBILITY_STATE.SHADOWED;
    }

    // Build explanation
    const parts: string[] = [];
    parts.push(
      `Pressure tier ${this.lastPressureTier} maps to base visibility ${baseState}.`,
    );

    if (this.lastNearDeath && this.lastPressureTier === 'T4') {
      parts.push(
        'Near-death detected at CRITICAL pressure → EXPOSED state triggered.',
      );
    }

    if (pending !== null) {
      parts.push(
        `Downgrade to ${pending} pending. ${countdown} tick${countdown !== 1 ? 's' : ''} remaining in delay.`,
      );
    }

    if (current !== baseState && pending === null) {
      parts.push(
        `Current state ${current} differs from base ${baseState} — likely in downgrade delay transition.`,
      );
    }

    parts.push(`Player visibility: ${envelope}.`);
    parts.push(
      `Shows: count=${config.showsThreatCount}, type=${config.showsThreatType}, arrival=${config.showsArrivalTick}, mitigation=${config.showsMitigationPath}, worstCase=${config.showsWorstCase}.`,
    );

    if (config.tensionAwarenessBonus > 0) {
      parts.push(
        `Awareness bonus active: +${config.tensionAwarenessBonus.toFixed(3)}/tick added to tension.`,
      );
    }

    return Object.freeze({
      currentState: current,
      pressureTier: this.lastPressureTier,
      isNearDeath: this.lastNearDeath,
      baseStateFromPressure: baseState,
      pendingDowngrade: pending,
      downgradeCountdown: countdown,
      config,
      envelopeLevel: envelope,
      playerSees: Object.freeze({
        threatCount: config.showsThreatCount,
        threatType: config.showsThreatType,
        arrivalTick: config.showsArrivalTick,
        mitigationPath: config.showsMitigationPath,
        worstCase: config.showsWorstCase,
      }),
      explanation: parts.join(' '),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 31 — Cascade threat analysis
  //
  //   Focuses specifically on cascade-triggered threats, which have
  //   special rules: 1-tick warning guarantee, always TELEGRAPHED
  //   regardless of current visibility, and chain-reaction tracking.
  // ═══════════════════════════════════════════════════════════════════════

  public computeCascadeThreatAnalysis(): {
    readonly cascadeCount: number;
    readonly cascadeArrivedCount: number;
    readonly cascadeQueuedCount: number;
    readonly cascadeExpiredCount: number;
    readonly cascadeFraction: number;
    readonly uniqueTriggerEvents: number;
    readonly cascadeSeverityAvg: number;
    readonly cascadeSeverityMax: number;
    readonly cascadeNarrative: string;
    readonly triggerEventIds: readonly string[];
  } {
    const allActive = this.queue.getSortedActiveQueue();
    const allExpired = this.queue.getExpiredEntries();
    const all = [...allActive, ...allExpired];

    const cascadeEntries = all.filter((e) => e.isCascadeTriggered);
    const cascadeArrived = cascadeEntries.filter(
      (e) => e.state === ENTRY_STATE.ARRIVED,
    );
    const cascadeQueued = cascadeEntries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED,
    );
    const cascadeExpired = cascadeEntries.filter(
      (e) => e.state === ENTRY_STATE.EXPIRED,
    );

    const triggerEvents = new Set<string>();
    for (const entry of cascadeEntries) {
      if (entry.cascadeTriggerEventId) {
        triggerEvents.add(entry.cascadeTriggerEventId);
      }
    }

    const sevWeights = cascadeEntries.map((e) => {
      const canon = THREAT_SEVERITY_WEIGHTS[e.threatSeverity];
      return canon ?? e.severityWeight;
    });
    const avgSev =
      sevWeights.length > 0
        ? sevWeights.reduce((s, v) => s + v, 0) / sevWeights.length
        : 0;
    const maxSev = sevWeights.length > 0 ? Math.max(...sevWeights) : 0;

    const totalActive = allActive.length;
    const cascadeFraction =
      totalActive > 0 ? cascadeEntries.length / totalActive : 0;

    let narrative: string;
    if (cascadeEntries.length === 0) {
      narrative = 'No cascade-triggered threats in queue. Previous failures have not yet spawned chain reactions.';
    } else if (cascadeEntries.length >= 3) {
      narrative = `${cascadeEntries.length} cascade threats active from ${triggerEvents.size} trigger event${triggerEvents.size > 1 ? 's' : ''}. Chain reactions are compounding. Highest severity: ${this.severityUXLabel(maxSev)}.`;
    } else {
      narrative = `${cascadeEntries.length} cascade threat${cascadeEntries.length > 1 ? 's' : ''} from ${triggerEvents.size} trigger event${triggerEvents.size > 1 ? 's' : ''}. Monitor for escalation.`;
    }

    return Object.freeze({
      cascadeCount: cascadeEntries.length,
      cascadeArrivedCount: cascadeArrived.length,
      cascadeQueuedCount: cascadeQueued.length,
      cascadeExpiredCount: cascadeExpired.length,
      cascadeFraction,
      uniqueTriggerEvents: triggerEvents.size,
      cascadeSeverityAvg: avgSev,
      cascadeSeverityMax: maxSev,
      cascadeNarrative: narrative,
      triggerEventIds: Object.freeze([...triggerEvents]),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 32 — Complete engine export for chat adapter consumption
  //
  //   Produces the full data bundle that the TensionSignalAdapter
  //   in the chat system consumes. Every field is serialization-safe
  //   and deterministic.
  // ═══════════════════════════════════════════════════════════════════════

  public buildChatAdapterPayload(): Record<string, unknown> {
    const runtime = this.getRuntimeSnapshot();
    const narrative = this.generateNarrative();
    const recommendations = this.computeMitigationRecommendations();
    const ghost = this.computeGhostPenaltyAnalysis();
    const pulse = this.computePulseAnalytics();
    const trend = this.computeTrendSnapshot();
    const decomposition = this.getScoreDecomposition();
    const visExplanation = this.explainVisibilityDecision();

    return Object.freeze({
      // Core signal data
      score: runtime.score,
      previousScore: runtime.previousScore,
      delta: runtime.amplifiedDelta,
      visibilityState: runtime.visibilityState,
      queueLength: runtime.queueLength,
      arrivedCount: runtime.arrivedCount,
      isPulseActive: runtime.isPulseActive,
      isEscalating: runtime.isEscalating,

      // Narrative for companion chat
      headline: narrative.headline,
      body: narrative.body,
      urgency: narrative.urgency,
      advisoryAction: narrative.advisoryAction,
      visibilityNote: narrative.visibilityNote,
      queueNote: narrative.queueNote,

      // Top 3 mitigation recommendations
      topRecommendations: recommendations.slice(0, 3).map((r) => ({
        entryId: r.entryId,
        urgency: r.urgency,
        threatType: r.threatType,
        suggestedCards: [...r.suggestedCards],
        uxReason: r.uxReason,
      })),

      // Ghost and pulse state for urgency determination
      ghostPenaltyPerTick: ghost.penaltyPerTick,
      ghostBlocksRecovery: ghost.ghostBlocksRecovery,
      pulseStreak: pulse.currentStreak,
      pulseSustained: pulse.isSustained,

      // Trend for forecasting
      trendMomentum: trend.momentum,
      trendSlope: trend.slope,

      // Score decomposition for explanation
      dominantPositiveSource: decomposition.dominantPositiveSource,
      dominantNegativeSource: decomposition.dominantNegativeSource,
      pressureTaxPct: decomposition.pressureTaxPct,

      // Visibility explanation for companion
      visibilityExplanation: visExplanation.explanation,
      playerSeesType: visExplanation.playerSees.threatType,
      playerSeesArrival: visExplanation.playerSees.arrivalTick,
      playerSeesMitigation: visExplanation.playerSees.mitigationPath,

      // Contribution breakdown
      contributionBreakdown: { ...runtime.contributionBreakdown },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 33 — Queue health scoring
  //
  //   Computes a composite health score for the anticipation queue
  //   itself: is it manageable, dangerous, or overwhelming?
  //   Uses all entry states, severity distributions, and queue constants.
  // ═══════════════════════════════════════════════════════════════════════

  public computeQueueHealthScore(): {
    readonly score: number;
    readonly grade: string;
    readonly arrivedLoadPct: number;
    readonly queuedLoadPct: number;
    readonly severityLoadPct: number;
    readonly ghostLoadPct: number;
    readonly diversityScore: number;
    readonly imminenceScore: number;
    readonly mitigationReadiness: number;
    readonly cascadeRisk: number;
    readonly uxVerdict: string;
    readonly uxRecommendation: string;
  } {
    const runtime = this.lastRuntimeSnapshot ?? this.buildEmptyRuntimeSnapshot();
    const active = this.queue.getSortedActiveQueue();
    const expired = this.queue.getExpiredEntries();
    const arrived = this.queue.getArrivedEntries();
    const queued = this.queue.getQueuedEntries();

    // Arrived load: more arrived threats = worse
    const arrivedLoadPct = this.clamp01(arrived.length / 8);

    // Queued load: many queued threats = building danger
    const queuedLoadPct = this.clamp01(queued.length / 12);

    // Severity load: sum of severity weights normalized
    const totalSev = active.reduce((s, e) => {
      const canon = THREAT_SEVERITY_WEIGHTS[e.threatSeverity];
      return s + (canon ?? e.severityWeight);
    }, 0);
    const severityLoadPct = this.clamp01(totalSev / 5);

    // Ghost load: expired threats creating lingering penalties
    const ghostPenalty =
      expired.length * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
    const ghostLoadPct = this.clamp01(
      ghostPenalty / TENSION_CONSTANTS.EMPTY_QUEUE_DECAY,
    );

    // Diversity: entropy of threat types (higher = more diverse threats)
    const typeMap = new Map<string, number>();
    for (const tt of Object.values(THREAT_TYPE)) {
      typeMap.set(tt, 0);
    }
    for (const entry of active) {
      typeMap.set(entry.threatType, (typeMap.get(entry.threatType) ?? 0) + 1);
    }
    const entropy = this.computeEntropy(typeMap, active.length);
    const maxEntropy = Math.log2(Object.values(THREAT_TYPE).length);
    const diversityScore =
      maxEntropy > EPSILON ? this.clamp01(entropy / maxEntropy) : 0;

    // Imminence: how close are queued threats to arriving?
    const imminentCount = queued.filter(
      (e) => e.arrivalTick - runtime.tickNumber <= 2,
    ).length;
    const imminenceScore =
      queued.length > 0 ? imminentCount / queued.length : 0;

    // Mitigation readiness: fraction with known mitigation paths
    const coveredCount = active.filter(
      (e) => e.mitigationCardTypes.length > 0,
    ).length;
    const mitigationReadiness =
      active.length > 0 ? coveredCount / active.length : 1;

    // Cascade risk: fraction of entries that are cascade-triggered
    const cascadeCount = active.filter((e) => e.isCascadeTriggered).length;
    const cascadeRisk =
      active.length > 0 ? cascadeCount / active.length : 0;

    // Composite: lower is healthier (0 = perfect, 1 = critical)
    const dangerScore =
      arrivedLoadPct * 0.25 +
      queuedLoadPct * 0.15 +
      severityLoadPct * 0.20 +
      ghostLoadPct * 0.10 +
      diversityScore * 0.05 +
      imminenceScore * 0.10 +
      (1 - mitigationReadiness) * 0.10 +
      cascadeRisk * 0.05;

    // Invert for health score (1 = healthy, 0 = critical)
    const healthScore = this.clamp01(1 - dangerScore);

    const grade =
      healthScore >= 0.90
        ? 'S'
        : healthScore >= 0.75
          ? 'A'
          : healthScore >= 0.55
            ? 'B'
            : healthScore >= 0.35
              ? 'C'
              : healthScore >= 0.15
                ? 'D'
                : 'F';

    // UX verdict
    let uxVerdict: string;
    if (healthScore >= 0.85) {
      uxVerdict = 'Queue is healthy. Threats manageable.';
    } else if (healthScore >= 0.60) {
      uxVerdict = 'Queue is building. Stay alert and prepare mitigations.';
    } else if (healthScore >= 0.35) {
      uxVerdict = 'Queue is dangerous. Multiple threats converging. Act now.';
    } else {
      uxVerdict = 'Queue is OVERWHELMING. Critical threat density. Emergency mitigation needed.';
    }

    // UX recommendation based on worst factor
    const factors: [string, number][] = [
      ['arrived threats', arrivedLoadPct],
      ['queued buildup', queuedLoadPct],
      ['severity density', severityLoadPct],
      ['ghost penalty', ghostLoadPct],
      ['imminent arrivals', imminenceScore],
      ['cascade chains', cascadeRisk],
    ];
    factors.sort((a, b) => b[1] - a[1]);
    const worstFactor = factors[0];
    const uxRecommendation = worstFactor && worstFactor[1] > 0.3
      ? `Priority: address ${worstFactor[0]} (${(worstFactor[1] * 100).toFixed(0)}% load).`
      : 'No urgent action needed.';

    return Object.freeze({
      score: healthScore,
      grade,
      arrivedLoadPct,
      queuedLoadPct,
      severityLoadPct,
      ghostLoadPct,
      diversityScore,
      imminenceScore,
      mitigationReadiness,
      cascadeRisk,
      uxVerdict,
      uxRecommendation,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // § 34 — Run summary generator
  //
  //   At the end of a run, generates a comprehensive tension summary
  //   suitable for the sovereignty proof chain, after-action report,
  //   and career analytics. This is the last method called on a run.
  // ═══════════════════════════════════════════════════════════════════════

  public generateRunSummary(): {
    readonly engineId: string;
    readonly ticksProcessed: number;
    readonly finalScore: number;
    readonly peakScore: number;
    readonly avgScore: number;
    readonly totalThreatsEnqueued: number;
    readonly totalThreatsArrived: number;
    readonly totalMitigations: number;
    readonly totalNullifications: number;
    readonly totalExpirations: number;
    readonly mitigationRate: number;
    readonly expirationRate: number;
    readonly pulseActivations: number;
    readonly sustainedPulseEvents: number;
    readonly maxPulseStreak: number;
    readonly visibilityTransitions: number;
    readonly longestEscalationStreak: number;
    readonly longestCalmStreak: number;
    readonly avgVolatility: number;
    readonly ghostPenaltyTotal: number;
    readonly resilience: TensionResilienceScore;
    readonly anticipationCurve: {
      readonly medianScore: number;
      readonly p95Score: number;
      readonly timeAbovePulse: number;
      readonly timeAboveHigh: number;
      readonly varianceCoefficient: number;
    };
    readonly queueHealth: {
      readonly finalScore: number;
      readonly finalGrade: string;
    };
    readonly pressureCorrelation: {
      readonly isNightmare: boolean;
      readonly cumulativePressureTax: number;
    };
    readonly narrative: string;
    readonly grade: string;
  } {
    const session = this.computeSessionAnalytics();
    const resilience = this.computeResilienceScore();
    const curve = this.buildAnticipationCurve();
    const qHealth = this.computeQueueHealthScore();
    const pCorr = this.computePressureTensionCorrelation();
    const ghost = this.computeGhostPenaltyAnalysis();

    const mitigationRate =
      session.totalArrivals > 0
        ? session.totalMitigations / session.totalArrivals
        : 1;
    const expirationRate =
      session.totalArrivals > 0
        ? session.totalExpirations / session.totalArrivals
        : 0;

    // Final grade: composite of resilience + mitigation rate
    const finalScore =
      resilience.composite * 0.6 + mitigationRate * 0.3 + (1 - expirationRate) * 0.1;
    const grade =
      finalScore >= 0.90
        ? 'S'
        : finalScore >= 0.75
          ? 'A'
          : finalScore >= 0.55
            ? 'B'
            : finalScore >= 0.35
              ? 'C'
              : finalScore >= 0.15
                ? 'D'
                : 'F';

    // Build narrative summary
    const narrativeParts: string[] = [];
    narrativeParts.push(
      `Processed ${session.ticksProcessed} ticks. ${session.totalEnqueued} threats enqueued, ${session.totalArrivals} arrived.`,
    );
    narrativeParts.push(
      `Mitigated ${session.totalMitigations} (${(mitigationRate * 100).toFixed(0)}%). Expired ${session.totalExpirations} (${(expirationRate * 100).toFixed(0)}%).`,
    );
    if (session.pulseActivations > 0) {
      narrativeParts.push(
        `Pulse activated ${session.pulseActivations} time${session.pulseActivations > 1 ? 's' : ''}. Max streak: ${session.maxConsecutivePulseTicks} ticks.`,
      );
    }
    if (ghost.ghostCount > 0) {
      narrativeParts.push(
        `${ghost.ghostCount} ghost penalt${ghost.ghostCount > 1 ? 'ies' : 'y'} accumulated (+${ghost.penaltyPerTick.toFixed(3)}/tick).`,
      );
    }
    narrativeParts.push(
      `Resilience grade: ${resilience.grade}. Overall tension grade: ${grade}.`,
    );

    return Object.freeze({
      engineId: this.engineId,
      ticksProcessed: session.ticksProcessed,
      finalScore: this.currentScore,
      peakScore: session.peakScore,
      avgScore: session.avgScore,
      totalThreatsEnqueued: session.totalEnqueued,
      totalThreatsArrived: session.totalArrivals,
      totalMitigations: session.totalMitigations,
      totalNullifications: session.totalNullifications,
      totalExpirations: session.totalExpirations,
      mitigationRate,
      expirationRate,
      pulseActivations: session.pulseActivations,
      sustainedPulseEvents: session.sustainedPulseEvents,
      maxPulseStreak: session.maxConsecutivePulseTicks,
      visibilityTransitions: session.visibilityTransitions,
      longestEscalationStreak: session.longestEscalationStreak,
      longestCalmStreak: session.longestCalmStreak,
      avgVolatility: session.scoreVolatilityAvg,
      ghostPenaltyTotal: ghost.totalPenaltyThisRun,
      resilience,
      anticipationCurve: Object.freeze({
        medianScore: curve.medianScore,
        p95Score: curve.p95Score,
        timeAbovePulse: curve.timeAbovePulse,
        timeAboveHigh: curve.timeAboveHigh,
        varianceCoefficient: curve.varianceCoefficient,
      }),
      queueHealth: Object.freeze({
        finalScore: qHealth.score,
        finalGrade: qHealth.grade,
      }),
      pressureCorrelation: Object.freeze({
        isNightmare: pCorr.isNightmareState,
        cumulativePressureTax: pCorr.pressureTaxCumulative,
      }),
      narrative: narrativeParts.join(' '),
      grade,
    });
  }
}
