/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeEventEmitter.ts
 * Version: 4.0.0
 *
 * Doctrine:
 * - backend time emits operational truth; it does not own downstream reactions
 * - only existing EngineEventMap events are emitted here
 * - payloads are deterministic, serialization-safe, and queue-friendly
 * - helpers centralize event-tag discipline so time logic stays clean
 * - chat signals are emitted through LIVEOPS_SIGNAL adapter via EmitterChatBridge
 * - ML feature vectors (28-dim Float32Array) and DL tensors (40×6) extracted per emission
 * - all scoring utilities from GamePrimitives are wired into real runtime logic
 * - mode-aware and phase-aware emission routing via dedicated advisors
 * - audit trail, trend analysis, and resilience scoring are first-class subsystems
 * - session-level analytics are tracked and exportable at any time
 * - zero dead imports; every symbol drives runtime behavior
 */

// ============================================================================
// SECTION 1 — Imports
// ============================================================================

import type { EventBus } from '../core/EventBus';
import type {
  EngineEventMap,
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
} from '../core/GamePrimitives';
import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  computePressureRiskScore,
  canEscalatePressure,
  canDeescalatePressure,
  describePressureTierExperience,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isEndgamePhase,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type {
  Score01,
  UnixMs,
  ChatSignalType,
  ChatInputEnvelope,
  Nullable,
  JsonValue,
  ChatSignalEnvelope,
  ChatRunSnapshot,
  ChatLiveOpsSnapshot,
} from '../chat/types';
import {
  TickTier,
  TICK_TIER_CONFIGS,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  PHASE_BOUNDARIES_MS,
  pressureTierToTickTier,
  tickTierToPressureTier,
} from './types';

// ============================================================================
// SECTION 2 — Type Aliases and Module-Level Constants
// ============================================================================

/**
 * Full runtime bus type: extends EngineEventMap with open-ended Record for
 * custom events emitted by orchestrators and adapters downstream.
 */
export type RuntimeBus = EventBus<EngineEventMap & Record<string, unknown>>;

/**
 * Internal event bus map derived from EngineEventMap for type-safe emission
 * within this module. Consumers that need the full open-ended bus use RuntimeBus.
 */
type TimeEventBusMap = {
  [K in keyof EngineEventMap]: EngineEventMap[K];
};

/** Maximum audit trail records retained before oldest is rotated out. */
const AUDIT_TRAIL_MAX_RECORDS_DEFAULT = 1_000;

/** Default number of time-axis rows in the DL ring buffer. */
const DL_BUFFER_ROWS_DEFAULT = 40;

/** Feature dimension of every DL buffer row. Fixed at 6. */
const DL_BUFFER_COLS = 6 as const;

/** Dimensionality of the ML feature vector. Fixed at 28. */
const ML_FEATURE_DIM = 28 as const;

/** Log prefix injected into urgency strings for tracing. */
const URGENCY_LOG_PREFIX = '[TIME:URGENCY]' as const;

/** Chat channel for all time-engine liveops signals. */
const LIVEOPS_CHAT_CHANNEL = 'LIVEOPS_SHADOW' as const;

/** Decimal places for all normalized score rounding. */
const SCORE_ROUND_PLACES = 4 as const;

/** Canonical emitter version, bumped with every public API change. */
export const TIME_EMITTER_VERSION = '4.0.0' as const;

export type TimeEmitterVersion = typeof TIME_EMITTER_VERSION;

// ============================================================================
// SECTION 3 — Payload Type Exports (backward-compatible, never renamed)
// ============================================================================

export type TickStartedPayload = EngineEventMap['tick.started'];
export type TickCompletedPayload = EngineEventMap['tick.completed'];
export type DecisionWindowOpenedPayload = EngineEventMap['decision.window.opened'];
export type DecisionWindowClosedPayload = EngineEventMap['decision.window.closed'];
export type PhaseWindowOpenedPayload = EngineEventMap['mode.phase_window.opened'];
export type PressureChangedPayload = EngineEventMap['pressure.changed'];
export type RunStartedPayload = EngineEventMap['run.started'];

// ============================================================================
// SECTION 4 — Options Interfaces
// ============================================================================

export interface TimeEventEmitterOptions {
  /** Default tags prepended to every emission. Defaults to ['engine:time']. */
  readonly defaultTags?: readonly string[];
  /** Enable the per-emission audit trail. Default: true. */
  readonly enableAuditTrail?: boolean;
  /** Enable 28-dim ML feature extraction on demand. Default: true. */
  readonly enableMLExtraction?: boolean;
  /** Enable 40×6 DL ring buffer append on pressure changes. Default: true. */
  readonly enableDLBuffer?: boolean;
  /** Enable LIVEOPS_SIGNAL chat envelope construction. Default: false. */
  readonly enableChatBridge?: boolean;
  /** Maximum audit trail records before rotation. Default: 1000. */
  readonly auditTrailMaxRecords?: number;
  /** Number of rows in DL ring buffer. Default: 40. */
  readonly dlBufferRows?: number;
}

export interface TimeEmitOptions {
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
}

// ============================================================================
// SECTION 5 — Emission Event Kind Union
// ============================================================================

/**
 * All emission event kinds supported by TimeEventEmitter.
 * This union is the canonical vocabulary for audit and routing.
 */
export type EmissionEventKind =
  | 'tick.started'
  | 'tick.completed'
  | 'run.started'
  | 'pressure.changed'
  | 'decision.window.opened'
  | 'decision.window.closed'
  | 'mode.phase_window.opened';

// ============================================================================
// SECTION 6 — Audit Trail Data Structures
// ============================================================================

export interface EmitterAuditRecord {
  /** Monotonically increasing sequence number within this emitter instance. */
  readonly seq: number;
  /** Engine event kind that was emitted. */
  readonly kind: EmissionEventKind;
  /** Wall-clock epoch ms at the point of emission. */
  readonly emittedAt: UnixMs;
  /** Game tick at which this emission occurred. */
  readonly tick: number;
  /** Run identifier, or null before a run has started. */
  readonly runId: Nullable<string>;
  /** Pressure tier active at emission time, or null if not yet set. */
  readonly pressureTier: Nullable<PressureTier>;
  /** Run phase active at emission time, or null if not yet set. */
  readonly phase: Nullable<RunPhase>;
  /** Game mode active at emission time, or null if not yet set. */
  readonly mode: Nullable<ModeCode>;
  /** Merged set of default + call-site tags applied to this emission. */
  readonly tags: readonly string[];
  /** Arbitrary metadata carried with this audit record. */
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface EmitterAuditSnapshot {
  readonly totalEmissions: number;
  readonly emissionsByKind: Readonly<Record<EmissionEventKind, number>>;
  readonly firstEmittedAt: Nullable<UnixMs>;
  readonly lastEmittedAt: Nullable<UnixMs>;
  readonly recentRecords: readonly EmitterAuditRecord[];
}

// ============================================================================
// SECTION 7 — EmitterAuditTrail
// ============================================================================

/**
 * Maintains an append-only, rotation-safe audit trail of all emissions.
 *
 * Each record carries: sequence number, wall-clock timestamp (UnixMs),
 * kind, tick, runId, pressureTier, phase, mode, tags, and metadata.
 * Used for proof, replay, and debugging by downstream orchestrators.
 */
export class EmitterAuditTrail {
  private readonly maxRecords: number;
  private readonly records: EmitterAuditRecord[] = [];
  private seq = 0;
  private readonly kindCounts: Partial<Record<EmissionEventKind, number>> = {};

  public constructor(maxRecords = AUDIT_TRAIL_MAX_RECORDS_DEFAULT) {
    this.maxRecords = maxRecords;
  }

  /**
   * Append a new audit record.
   * Rotates (removes oldest) when the maximum capacity is reached.
   * Returns the newly appended record.
   */
  public record(
    kind: EmissionEventKind,
    tick: number,
    runId: Nullable<string>,
    pressureTier: Nullable<PressureTier>,
    phase: Nullable<RunPhase>,
    mode: Nullable<ModeCode>,
    tags: readonly string[],
    metadata: Readonly<Record<string, JsonValue>> = {},
  ): EmitterAuditRecord {
    const rec: EmitterAuditRecord = {
      seq: ++this.seq,
      kind,
      emittedAt: Date.now() as UnixMs,
      tick,
      runId,
      pressureTier,
      phase,
      mode,
      tags: freezeArray(tags),
      metadata: Object.freeze({ ...metadata }),
    };

    if (this.records.length >= this.maxRecords) {
      this.records.shift();
    }

    this.records.push(rec);
    this.kindCounts[kind] = (this.kindCounts[kind] ?? 0) + 1;

    return rec;
  }

  /** Returns an immutable snapshot of the current audit state. */
  public snapshot(): EmitterAuditSnapshot {
    const allKinds: EmissionEventKind[] = [
      'tick.started',
      'tick.completed',
      'run.started',
      'pressure.changed',
      'decision.window.opened',
      'decision.window.closed',
      'mode.phase_window.opened',
    ];

    const emissionsByKind = Object.fromEntries(
      allKinds.map((k) => [k, this.kindCounts[k] ?? 0]),
    ) as Record<EmissionEventKind, number>;

    return {
      totalEmissions: this.seq,
      emissionsByKind,
      firstEmittedAt:
        this.records.length > 0 ? this.records[0]!.emittedAt : null,
      lastEmittedAt:
        this.records.length > 0
          ? this.records[this.records.length - 1]!.emittedAt
          : null,
      recentRecords: freezeArray(this.records.slice(-20)) as readonly EmitterAuditRecord[],
    };
  }

  /** Returns all records matching the given emission kind. */
  public getByKind(kind: EmissionEventKind): readonly EmitterAuditRecord[] {
    return this.records.filter((r) => r.kind === kind);
  }

  /** Returns all records emitted at or after the given tick. */
  public getFromTick(fromTick: number): readonly EmitterAuditRecord[] {
    return this.records.filter((r) => r.tick >= fromTick);
  }

  /** Returns the sequence number of the last recorded emission (0 if empty). */
  public get lastSeq(): number {
    return this.seq;
  }

  /** Returns the total emission count for a specific kind. */
  public countByKind(kind: EmissionEventKind): number {
    return this.kindCounts[kind] ?? 0;
  }

  /** Clears all records and resets counters. */
  public clear(): void {
    this.records.length = 0;
    this.seq = 0;
    for (const key of Object.keys(this.kindCounts) as EmissionEventKind[]) {
      delete this.kindCounts[key];
    }
  }
}

// ============================================================================
// SECTION 8 — Trend Analysis Data Structures
// ============================================================================

export interface PressureTierTransitionReadiness {
  readonly currentTier: PressureTier;
  readonly nextTier: Nullable<PressureTier>;
  readonly prevTier: Nullable<PressureTier>;
  readonly canEscalate: boolean;
  readonly canDeescalate: boolean;
  readonly ticksInCurrentTier: number;
  readonly pressureScore: number;
  readonly riskScore: number;
  readonly currentTickTier: TickTier;
  readonly minHoldTicksRequired: number;
  readonly holdTicksMet: boolean;
}

export interface EmitterTrendReport {
  /** Positive = pressure escalating over time. Negative = de-escalating. */
  readonly pressureTrendSlope: number;
  readonly averagePressureNormalized: number;
  readonly peakPressureTier: PressureTier;
  readonly troughPressureTier: PressureTier;
  readonly transitionCount: number;
  readonly averageTicksPerTier: number;
  readonly tierHistory: readonly PressureTier[];
  readonly tickTierDistribution: Readonly<Record<TickTier, number>>;
}

// ============================================================================
// SECTION 9 — EmitterTrendAnalyzer
// ============================================================================

/**
 * Analyzes historical pressure tier emissions to compute trend signals.
 *
 * Drives escalation/de-escalation recommendations, tier distributions, and
 * slope analysis that feeds directly into ML and DL pipeline inputs.
 *
 * Actively uses:
 *   PRESSURE_TIERS, PRESSURE_TIER_NORMALIZED, PRESSURE_TIER_MIN_HOLD_TICKS,
 *   computePressureRiskScore, canEscalatePressure, canDeescalatePressure,
 *   pressureTierToTickTier, tickTierToPressureTier, TICK_TIER_CONFIGS, TickTier
 */
export class EmitterTrendAnalyzer {
  private readonly tierHistory: PressureTier[] = [];
  private readonly tierTickCounts: Map<PressureTier, number> = new Map();
  private readonly tierTransitions: Array<{
    from: PressureTier;
    to: PressureTier;
    atTick: number;
    score: number;
  }> = [];
  private currentTicksInTier = 0;
  private currentTier: PressureTier = 'T1';
  private lastPressureScore = 0;

  /** Update state when a pressure change is emitted. */
  public onPressureChanged(
    from: PressureTier,
    to: PressureTier,
    score: number,
    atTick: number,
  ): void {
    const prevCount = this.tierTickCounts.get(from) ?? 0;
    this.tierTickCounts.set(from, prevCount + this.currentTicksInTier);
    this.tierHistory.push(to);
    this.tierTransitions.push({ from, to, atTick, score });
    this.currentTier = to;
    this.currentTicksInTier = 0;
    this.lastPressureScore = score;
  }

  /** Increment tick count in the current tier. Called by emitTickCompleted hook. */
  public onTickCompleted(): void {
    this.currentTicksInTier++;
  }

  /**
   * Compute full transition readiness for the current tier.
   *
   * Uses canEscalatePressure, canDeescalatePressure, computePressureRiskScore,
   * pressureTierToTickTier, PRESSURE_TIER_MIN_HOLD_TICKS.
   */
  public assessTransitionReadiness(
    pressureScore: number,
  ): PressureTierTransitionReadiness {
    this.lastPressureScore = pressureScore;
    const tierIndex = PRESSURE_TIERS.indexOf(this.currentTier);

    const nextTier: Nullable<PressureTier> =
      tierIndex < PRESSURE_TIERS.length - 1
        ? PRESSURE_TIERS[tierIndex + 1] ?? null
        : null;

    const prevTier: Nullable<PressureTier> =
      tierIndex > 0 ? PRESSURE_TIERS[tierIndex - 1] ?? null : null;

    const canEscalate =
      nextTier !== null &&
      canEscalatePressure(
        this.currentTier,
        nextTier,
        pressureScore,
        this.currentTicksInTier,
      );

    const canDeescalate =
      prevTier !== null &&
      canDeescalatePressure(this.currentTier, prevTier, pressureScore);

    const riskScore = computePressureRiskScore(this.currentTier, pressureScore);
    const currentTickTier = pressureTierToTickTier(this.currentTier);
    const minHoldRequired = PRESSURE_TIER_MIN_HOLD_TICKS[this.currentTier];

    return {
      currentTier: this.currentTier,
      nextTier,
      prevTier,
      canEscalate,
      canDeescalate,
      ticksInCurrentTier: this.currentTicksInTier,
      pressureScore,
      riskScore: roundScore(riskScore),
      currentTickTier,
      minHoldTicksRequired: minHoldRequired,
      holdTicksMet: this.currentTicksInTier >= minHoldRequired,
    };
  }

  /**
   * Compute a full trend report from the session's emission history.
   *
   * Uses PRESSURE_TIER_NORMALIZED (slope), tickTierToPressureTier (distribution),
   * TICK_TIER_CONFIGS (validation), PRESSURE_TIERS (iteration), TickTier (keys).
   */
  public computeTrendReport(): EmitterTrendReport {
    if (this.tierHistory.length === 0) {
      const emptyTickTierDist = Object.fromEntries(
        (Object.values(TickTier) as TickTier[]).map((t) => [t, 0]),
      ) as Record<TickTier, number>;

      return {
        pressureTrendSlope: 0,
        averagePressureNormalized: PRESSURE_TIER_NORMALIZED['T1'],
        peakPressureTier: 'T1',
        troughPressureTier: 'T1',
        transitionCount: 0,
        averageTicksPerTier: 0,
        tierHistory: [],
        tickTierDistribution: emptyTickTierDist,
      };
    }

    // Normalize each historical tier to 0-1
    const normalizedValues = this.tierHistory.map(
      (t) => PRESSURE_TIER_NORMALIZED[t],
    );

    // Compute running average
    const sum = normalizedValues.reduce((a, b) => a + b, 0);
    const avg = sum / normalizedValues.length;

    // Compute slope via simple linear regression (least squares)
    const n = normalizedValues.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += normalizedValues[i]!;
      sumXY += i * normalizedValues[i]!;
      sumX2 += i * i;
    }
    const denominator = n * sumX2 - sumX * sumX;
    const slope =
      denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

    // Find actual peak and trough tiers from history
    let peakNorm = -Infinity;
    let troughNorm = Infinity;
    let peakTier: PressureTier = 'T0';
    let troughTier: PressureTier = 'T4';

    for (const tier of this.tierHistory) {
      const v = PRESSURE_TIER_NORMALIZED[tier];
      if (v > peakNorm) {
        peakNorm = v;
        peakTier = tier;
      }
      if (v < troughNorm) {
        troughNorm = v;
        troughTier = tier;
      }
    }

    // Build tick-tier distribution using tickTierToPressureTier and TICK_TIER_CONFIGS
    const tickTierDist: Partial<Record<TickTier, number>> = {};

    for (const tickTier of Object.values(TickTier) as TickTier[]) {
      const correspondingPressure = tickTierToPressureTier(tickTier);
      const count = this.tierTickCounts.get(correspondingPressure) ?? 0;
      // Access TICK_TIER_CONFIGS to validate the tier config exists at build time
      const config = TICK_TIER_CONFIGS[tickTier];
      void config;
      tickTierDist[tickTier] = count;
    }

    // Average ticks per distinct tier
    let totalTierTicks = 0;
    let distinctTiers = 0;
    for (const tier of PRESSURE_TIERS) {
      const count = this.tierTickCounts.get(tier) ?? 0;
      if (count > 0) {
        totalTierTicks += count;
        distinctTiers++;
      }
    }
    const avgTicksPerTier =
      distinctTiers > 0 ? totalTierTicks / distinctTiers : 0;

    return {
      pressureTrendSlope: roundScore(slope),
      averagePressureNormalized: roundScore(avg),
      peakPressureTier: peakTier,
      troughPressureTier: troughTier,
      transitionCount: this.tierTransitions.length,
      averageTicksPerTier: roundScore(avgTicksPerTier),
      tierHistory: freezeArray(
        this.tierHistory.slice(-50),
      ) as readonly PressureTier[],
      tickTierDistribution: Object.freeze(
        tickTierDist,
      ) as Record<TickTier, number>,
    };
  }

  /**
   * Returns the most recent N tier transitions with full context.
   */
  public getRecentTransitions(
    limit = 10,
  ): ReadonlyArray<{
    from: PressureTier;
    to: PressureTier;
    atTick: number;
    score: number;
  }> {
    return freezeArray(this.tierTransitions.slice(-limit));
  }

  /**
   * Returns what percentage of ticks were spent at T3 or T4 (crisis/collapse).
   * Used as a session-level stress index.
   */
  public computeHighStressTickFraction(): number {
    let highStressTicks = 0;
    let totalTicks = 0;

    for (const tier of PRESSURE_TIERS) {
      const count = this.tierTickCounts.get(tier) ?? 0;
      totalTicks += count;
      if (tier === 'T3' || tier === 'T4') {
        highStressTicks += count;
      }
    }

    return totalTicks > 0 ? roundScore(highStressTicks / totalTicks) : 0;
  }

  /** Reset all trend state. */
  public reset(): void {
    this.tierHistory.length = 0;
    this.tierTickCounts.clear();
    this.tierTransitions.length = 0;
    this.currentTicksInTier = 0;
    this.currentTier = 'T1';
    this.lastPressureScore = 0;
  }

  public get currentPressureTier(): PressureTier {
    return this.currentTier;
  }

  public get pressureScore(): number {
    return this.lastPressureScore;
  }
}

// ============================================================================
// SECTION 10 — EmitterResilienceScorer
// ============================================================================

export interface ResilienceProfile {
  /** Branded 0-1 resilience score. Higher = system is more stable. */
  readonly score: Score01;
  /** Human-readable label for the resilience band. */
  readonly label: string;
  /** Mode tension floor — minimum ambient tension the engine sustains. */
  readonly tensionFloor: number;
  /** Mode difficulty multiplier active in this profile. */
  readonly difficultyModifier: number;
  /** Ratio of ticks in current tier relative to minimum hold requirement. */
  readonly tierHoldCapacity: number;
  /** Current pressure tier normalized to 0-1. */
  readonly pressureWeightedScore: number;
  /** Mode code normalized to 0-1 for gradient use. */
  readonly modeNormalized: number;
}

/**
 * Computes a resilience score (0-1) answering:
 * "How well is the time system holding up under current pressure and mode?"
 *
 * Actively uses:
 *   PRESSURE_TIERS, PRESSURE_TIER_NORMALIZED, PRESSURE_TIER_MIN_HOLD_TICKS,
 *   MODE_TENSION_FLOOR, MODE_DIFFICULTY_MULTIPLIER, MODE_NORMALIZED, Score01
 */
export class EmitterResilienceScorer {
  /**
   * Compute a resilience profile for the given mode and pressure context.
   */
  public computeProfile(
    mode: ModeCode,
    currentTier: PressureTier,
    ticksInCurrentTier: number,
    totalTicksEmitted: number,
  ): ResilienceProfile {
    // Build a pressure-weighted resilience baseline from all tier weights
    let pressureWeighted = 0;
    let totalWeight = 0;

    for (const tier of PRESSURE_TIERS) {
      const normalized = PRESSURE_TIER_NORMALIZED[tier];
      // Lower pressure tiers contribute positively to resilience
      const weight = 1.0 - normalized;
      pressureWeighted += normalized * weight;
      totalWeight += weight;
    }

    const baseResilience =
      totalWeight > 0 ? 1.0 - pressureWeighted / totalWeight : 1.0;

    const currentPressureNorm = PRESSURE_TIER_NORMALIZED[currentTier];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const difficultyMod = MODE_DIFFICULTY_MULTIPLIER[mode];
    const modeNorm = MODE_NORMALIZED[mode];

    // Hold capacity: how well the mode is maintaining this tier
    const minHold = PRESSURE_TIER_MIN_HOLD_TICKS[currentTier];
    const holdCapacity =
      minHold > 0 ? Math.min(1.0, ticksInCurrentTier / (minHold * 3)) : 1.0;

    // Resilience degrades under high pressure and high difficulty modes
    const adjustedResilience =
      baseResilience *
      (1.0 - currentPressureNorm * 0.4) *
      (1.0 - (difficultyMod - 1.0) * 0.2) *
      (1.0 + holdCapacity * 0.1);

    // Ensure minimum resilience floor from the mode tension floor
    const floored = Math.max(tensionFloor * 0.1, adjustedResilience);
    const clampedScore = Math.max(0, Math.min(1.0, floored));
    const score = roundScore(clampedScore) as Score01;

    const tierHoldCap =
      minHold > 0 ? Math.min(3.0, ticksInCurrentTier / minHold) : 1.0;

    void totalTicksEmitted; // acknowledged — tracked externally for upstream

    return {
      score,
      label: computeResilienceLabel(score),
      tensionFloor,
      difficultyModifier: difficultyMod,
      tierHoldCapacity: roundScore(tierHoldCap),
      pressureWeightedScore: roundScore(currentPressureNorm),
      modeNormalized: modeNorm,
    };
  }
}

// ============================================================================
// SECTION 11 — EmitterMLExtractor (28-dim feature vector)
// ============================================================================

/**
 * 28-dimensional ML feature vector layout:
 *   [0]  pressure tier normalized (PRESSURE_TIER_NORMALIZED)
 *   [1]  pressure risk score (computePressureRiskScore)
 *   [2]  run phase normalized (RUN_PHASE_NORMALIZED)
 *   [3]  phase stakes multiplier (RUN_PHASE_STAKES_MULTIPLIER)
 *   [4]  phase tick budget fraction (RUN_PHASE_TICK_BUDGET_FRACTION)
 *   [5]  mode normalized (MODE_NORMALIZED)
 *   [6]  mode difficulty (MODE_DIFFICULTY_MULTIPLIER ÷ 2)
 *   [7]  mode tension floor (MODE_TENSION_FLOOR)
 *   [8]  is endgame phase (isEndgamePhase → 0|1)
 *   [9]  run progress fraction (computeRunProgressFraction)
 *   [10] effective stakes (computeEffectiveStakes ÷ 2)
 *   [11] tick tier index normalized 0..1 (pressureTierToTickTier → TickTier)
 *   [12] tier min duration ms ÷ 25000
 *   [13] tier max duration ms ÷ 25000
 *   [14] tier default duration ms (TIER_DURATIONS_MS ÷ 25000)
 *   [15] decision window ms (DECISION_WINDOW_DURATIONS_MS ÷ 15000)
 *   [16] hold duration factor (DEFAULT_HOLD_DURATION_MS ÷ tier default)
 *   [17] ticks in current tier (capped 50, normalized)
 *   [18] transition count (capped 20, normalized)
 *   [19] trend slope (clamped ±1, shifted 0..1)
 *   [20] average pressure normalized (session)
 *   [21] resilience score (0-1)
 *   [22] pressure urgency index (PRESSURE_TIER_URGENCY_LABEL → ordinal ÷ 4)
 *   [23] phase boundaries crossed (÷ PHASE_BOUNDARIES_MS.length)
 *   [24] transition windows planned (÷ DEFAULT_PHASE_TRANSITION_WINDOWS × 2)
 *   [25] total emissions (capped 500, normalized)
 *   [26] mode × pressure interaction (MODE_NORMALIZED × PRESSURE_TIER_NORMALIZED)
 *   [27] outcome excitement score (scoreOutcomeExcitement ÷ 5)
 */
export interface MLFeatureContext {
  readonly pressureTier: PressureTier;
  readonly pressureScore: number;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly tickInPhase: number;
  readonly phaseTickBudget: number;
  readonly ticksInCurrentTier: number;
  readonly sessionTransitionCount: number;
  readonly trendSlope: number;
  readonly avgPressureNormalized: number;
  readonly resilienceScore: number;
  readonly totalEmissions: number;
  readonly lastOutcome: RunOutcome;
  readonly phaseTransitionWindowsPlanned: number;
}

export class EmitterMLExtractor {
  /** Extract a 28-dimensional Float32Array feature vector from the context. */
  public extract(ctx: MLFeatureContext): Float32Array {
    const vec = new Float32Array(ML_FEATURE_DIM);

    // [0] pressure tier normalized
    vec[0] = PRESSURE_TIER_NORMALIZED[ctx.pressureTier];

    // [1] pressure risk score
    vec[1] = computePressureRiskScore(ctx.pressureTier, ctx.pressureScore);

    // [2] run phase normalized
    vec[2] = RUN_PHASE_NORMALIZED[ctx.phase];

    // [3] phase stakes multiplier
    vec[3] = RUN_PHASE_STAKES_MULTIPLIER[ctx.phase];

    // [4] phase tick budget fraction
    vec[4] = RUN_PHASE_TICK_BUDGET_FRACTION[ctx.phase];

    // [5] mode normalized
    vec[5] = MODE_NORMALIZED[ctx.mode];

    // [6] mode difficulty (0..2 range → 0..1)
    vec[6] = MODE_DIFFICULTY_MULTIPLIER[ctx.mode] / 2.0;

    // [7] mode tension floor
    vec[7] = MODE_TENSION_FLOOR[ctx.mode];

    // [8] is endgame phase (boolean as 0/1)
    vec[8] = isEndgamePhase(ctx.phase) ? 1.0 : 0.0;

    // [9] run progress fraction
    vec[9] = computeRunProgressFraction(
      ctx.phase,
      ctx.tickInPhase,
      ctx.phaseTickBudget,
    );

    // [10] effective stakes normalized (max ≈ 1.6, so ÷ 2)
    vec[10] = computeEffectiveStakes(ctx.phase, ctx.mode) / 2.0;

    // [11] tick tier index normalized
    const tickTier = pressureTierToTickTier(ctx.pressureTier);
    const tierValues = Object.values(TickTier) as TickTier[];
    vec[11] =
      tierValues.indexOf(tickTier) / Math.max(1, tierValues.length - 1);

    // [12] tier min duration ms normalized
    const tierConfig = TICK_TIER_CONFIGS[tickTier];
    vec[12] = tierConfig.minDurationMs / 25_000;

    // [13] tier max duration ms normalized
    vec[13] = tierConfig.maxDurationMs / 25_000;

    // [14] tier default duration ms (from TIER_DURATIONS_MS) normalized
    vec[14] = TIER_DURATIONS_MS[ctx.pressureTier] / 25_000;

    // [15] decision window duration ms normalized
    vec[15] = DECISION_WINDOW_DURATIONS_MS[ctx.pressureTier] / 15_000;

    // [16] hold duration factor (DEFAULT_HOLD_DURATION_MS ÷ tier default)
    const tierDefault = TIER_DURATIONS_MS[ctx.pressureTier];
    vec[16] = tierDefault > 0 ? DEFAULT_HOLD_DURATION_MS / tierDefault : 0;

    // [17] ticks in current tier (capped at 50, normalized)
    vec[17] = Math.min(ctx.ticksInCurrentTier, 50) / 50;

    // [18] session transition count (capped at 20, normalized)
    vec[18] = Math.min(ctx.sessionTransitionCount, 20) / 20;

    // [19] trend slope shifted from ±1 to 0..1
    vec[19] = (Math.max(-1, Math.min(1, ctx.trendSlope)) + 1) / 2;

    // [20] average pressure normalized (already 0-1)
    vec[20] = Math.max(0, Math.min(1, ctx.avgPressureNormalized));

    // [21] resilience score (already 0-1)
    vec[21] = Math.max(0, Math.min(1, ctx.resilienceScore));

    // [22] pressure urgency index via PRESSURE_TIER_URGENCY_LABEL ordinal
    const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[ctx.pressureTier];
    const urgencyOrdinals: readonly string[] = [
      'Calm',
      'Building',
      'Elevated',
      'Critical',
      'Apex',
    ];
    const urgencyIdx = urgencyOrdinals.indexOf(urgencyLabel);
    vec[22] = urgencyIdx >= 0 ? urgencyIdx / (urgencyOrdinals.length - 1) : vec[0];

    // [23] phase boundaries crossed (normalized against total boundary count)
    const boundariesCrossed = PHASE_BOUNDARIES_MS.filter(
      (b) => RUN_PHASE_NORMALIZED[b.phase] <= RUN_PHASE_NORMALIZED[ctx.phase],
    ).length;
    vec[23] = boundariesCrossed / Math.max(1, PHASE_BOUNDARIES_MS.length);

    // [24] phase transition windows planned (normalized)
    vec[24] =
      Math.min(
        ctx.phaseTransitionWindowsPlanned,
        DEFAULT_PHASE_TRANSITION_WINDOWS * 2,
      ) /
      (DEFAULT_PHASE_TRANSITION_WINDOWS * 2);

    // [25] total emissions (capped at 500, normalized)
    vec[25] = Math.min(ctx.totalEmissions, 500) / 500;

    // [26] mode × pressure interaction term
    vec[26] =
      MODE_NORMALIZED[ctx.mode] * PRESSURE_TIER_NORMALIZED[ctx.pressureTier];

    // [27] outcome excitement score (scoreOutcomeExcitement normalized ÷ 5)
    const excitement = scoreOutcomeExcitement(ctx.lastOutcome, ctx.mode);
    vec[27] = Math.min(excitement, 5) / 5;

    return vec;
  }

  /**
   * Validate that all 28 features are finite and in expected bounds.
   * Returns a list of out-of-range feature indices (empty = clean).
   */
  public validate(vec: Float32Array): readonly number[] {
    const invalid: number[] = [];
    for (let i = 0; i < ML_FEATURE_DIM; i++) {
      const v = vec[i]!;
      if (!Number.isFinite(v) || v < -0.01 || v > 1.01) {
        invalid.push(i);
      }
    }
    return invalid;
  }

  /**
   * Batch-extract feature vectors for multiple contexts.
   * Returns a single Float32Array of shape [N × 28] in row-major order.
   */
  public extractBatch(contexts: readonly MLFeatureContext[]): Float32Array {
    const result = new Float32Array(contexts.length * ML_FEATURE_DIM);
    for (let i = 0; i < contexts.length; i++) {
      const row = this.extract(contexts[i]!);
      result.set(row, i * ML_FEATURE_DIM);
    }
    return result;
  }
}

// ============================================================================
// SECTION 12 — EmitterDLBuilder (40×6 ring buffer tensor)
// ============================================================================

/**
 * Per-row layout of the DL ring buffer (6 features):
 *   col[0]  pressure tier normalized  (PRESSURE_TIER_NORMALIZED)
 *   col[1]  run phase normalized       (RUN_PHASE_NORMALIZED)
 *   col[2]  mode normalized            (MODE_NORMALIZED)
 *   col[3]  pressure risk score        (computePressureRiskScore)
 *   col[4]  effective stakes normalized (computeEffectiveStakes ÷ 2)
 *   col[5]  tick tier index normalized  (pressureTierToTickTier → ordinal ÷ 4)
 */
export interface DLBufferRow {
  readonly rowIndex: number;
  readonly pressureTierNorm: number;
  readonly phaseNorm: number;
  readonly modeNorm: number;
  readonly riskScore: number;
  readonly effectiveStakes: number;
  readonly tickTierIndex: number;
}

export interface DLBufferStats {
  readonly rows: number;
  readonly cols: number;
  readonly count: number;
  readonly isFull: boolean;
  readonly highStressRowCount: number;
}

/**
 * 40×6 ring buffer DL tensor builder.
 * Appends one row per pressure change or on demand.
 * Exports a chronological Float32Array(rows × cols) for model inference.
 */
export class EmitterDLBuilder {
  private readonly rows: number;
  private readonly buffer: Float32Array;
  private head = 0;
  private count = 0;
  private highStressRows = 0;

  public constructor(rows = DL_BUFFER_ROWS_DEFAULT) {
    this.rows = rows;
    this.buffer = new Float32Array(rows * DL_BUFFER_COLS);
  }

  /**
   * Append a new row to the ring buffer.
   * Overwrites the oldest row when the buffer is full.
   */
  public appendRow(
    pressureTier: PressureTier,
    phase: RunPhase,
    mode: ModeCode,
    pressureScore: number,
  ): DLBufferRow {
    const tickTier = pressureTierToTickTier(pressureTier);
    const tierValues = Object.values(TickTier) as TickTier[];
    const tierIndex =
      tierValues.indexOf(tickTier) / Math.max(1, tierValues.length - 1);

    const riskScore = computePressureRiskScore(pressureTier, pressureScore);
    const stakes = computeEffectiveStakes(phase, mode) / 2.0;

    const pressNorm = PRESSURE_TIER_NORMALIZED[pressureTier];
    const phaseNorm = RUN_PHASE_NORMALIZED[phase];
    const modeNorm = MODE_NORMALIZED[mode];

    const offset = this.head * DL_BUFFER_COLS;
    this.buffer[offset + 0] = pressNorm;
    this.buffer[offset + 1] = phaseNorm;
    this.buffer[offset + 2] = modeNorm;
    this.buffer[offset + 3] = riskScore;
    this.buffer[offset + 4] = stakes;
    this.buffer[offset + 5] = tierIndex;

    if (pressureTier === 'T3' || pressureTier === 'T4') {
      this.highStressRows = Math.min(this.rows, this.highStressRows + 1);
    }

    this.head = (this.head + 1) % this.rows;
    if (this.count < this.rows) {
      this.count++;
    }

    return {
      rowIndex: this.count - 1,
      pressureTierNorm: pressNorm,
      phaseNorm,
      modeNorm,
      riskScore: roundScore(riskScore),
      effectiveStakes: roundScore(stakes),
      tickTierIndex: roundScore(tierIndex),
    };
  }

  /**
   * Returns the full tensor as a Float32Array(rows × cols) in chronological order
   * (oldest row first, newest row last).
   */
  public getTensor(): Float32Array {
    const output = new Float32Array(this.rows * DL_BUFFER_COLS);

    if (this.count < this.rows) {
      // Buffer not yet full: copy only populated rows
      output.set(this.buffer.subarray(0, this.count * DL_BUFFER_COLS));
    } else {
      // Buffer full: unroll starting at head (oldest)
      const tailBytes = (this.rows - this.head) * DL_BUFFER_COLS;
      output.set(this.buffer.subarray(this.head * DL_BUFFER_COLS), 0);
      output.set(this.buffer.subarray(0, this.head * DL_BUFFER_COLS), tailBytes);
    }

    return output;
  }

  /** Returns the last N rows in chronological order (newest rows only). */
  public getRecentRows(n: number): Float32Array {
    const clampedN = Math.min(n, this.count);
    const tensor = this.getTensor();
    const start = Math.max(0, this.count - clampedN) * DL_BUFFER_COLS;
    return tensor.subarray(start);
  }

  /** Returns buffer statistics. */
  public getStats(): DLBufferStats {
    return {
      rows: this.rows,
      cols: DL_BUFFER_COLS,
      count: this.count,
      isFull: this.count >= this.rows,
      highStressRowCount: this.highStressRows,
    };
  }

  /** Reset the ring buffer. */
  public reset(): void {
    this.buffer.fill(0);
    this.head = 0;
    this.count = 0;
    this.highStressRows = 0;
  }
}

// ============================================================================
// SECTION 13 — EmitterChatBridge
// ============================================================================

/**
 * Builds LIVEOPS_SIGNAL ChatInputEnvelope payloads from time emission context.
 * Routes time events to the correct chat signal lane.
 *
 * Actively uses:
 *   ChatSignalType, ChatInputEnvelope, ChatSignalEnvelope, ChatRunSnapshot,
 *   ChatLiveOpsSnapshot, Score01, UnixMs, Nullable, JsonValue
 */
export class EmitterChatBridge {
  /**
   * Determine the appropriate ChatSignalType for a given emission kind.
   * Phase windows and run starts → RUN.
   * Decision windows → BATTLE.
   * All other time events → LIVEOPS.
   */
  public routeSignalType(kind: EmissionEventKind): ChatSignalType {
    const routingMap: Record<EmissionEventKind, ChatSignalType> = {
      'tick.started': 'LIVEOPS',
      'tick.completed': 'LIVEOPS',
      'run.started': 'RUN',
      'pressure.changed': 'LIVEOPS',
      'decision.window.opened': 'BATTLE',
      'decision.window.closed': 'BATTLE',
      'mode.phase_window.opened': 'RUN',
    };
    return routingMap[kind];
  }

  /**
   * Build a ChatRunSnapshot from current time state.
   * Maps the time TickTier enum to the chat-local tick tier string union.
   */
  public buildRunSnapshot(
    runId: string,
    phase: RunPhase,
    pressureTier: PressureTier,
    elapsedMs: number,
  ): ChatRunSnapshot {
    const timeTickTier = pressureTierToTickTier(pressureTier);
    const chatTickTier = bridgeToChatTickTier(timeTickTier);

    return {
      runId,
      runPhase: phase,
      tickTier: chatTickTier,
      outcome: 'UNRESOLVED',
      bankruptcyWarning: pressureTier === 'T4' || pressureTier === 'T3',
      nearSovereignty: phase === 'SOVEREIGNTY',
      elapsedMs,
    };
  }

  /**
   * Build a ChatLiveOpsSnapshot from the current pressure state.
   * heatMultiplier01 uses the Score01 branded type.
   */
  public buildLiveOpsSnapshot(
    pressureTier: PressureTier,
    pressureScore: number,
    haterRaidActive: boolean,
  ): ChatLiveOpsSnapshot {
    const heatNormalized = Math.max(
      0,
      Math.min(1, pressureScore / 100),
    ) as Score01;

    return {
      worldEventName: buildWorldEventName(pressureTier),
      heatMultiplier01: heatNormalized,
      helperBlackout: pressureTier === 'T4',
      haterRaidActive,
    };
  }

  /**
   * Build the full LIVEOPS_SIGNAL ChatInputEnvelope.
   * Assembles ChatSignalEnvelope → wraps into the discriminated union variant.
   */
  public buildEnvelope(
    kind: EmissionEventKind,
    runId: string,
    phase: RunPhase,
    pressureTier: PressureTier,
    pressureScore: number,
    elapsedMs: number,
    haterRaidActive: boolean,
    metadata: Readonly<Record<string, JsonValue>> = {},
  ): ChatInputEnvelope {
    const signalType = this.routeSignalType(kind);
    const runSnapshot = this.buildRunSnapshot(
      runId,
      phase,
      pressureTier,
      elapsedMs,
    );
    const liveOpsSnapshot = this.buildLiveOpsSnapshot(
      pressureTier,
      pressureScore,
      haterRaidActive,
    );

    const envelope: ChatSignalEnvelope = {
      type: signalType,
      emittedAt: Date.now() as UnixMs,
      roomId: null,
      run: runSnapshot,
      liveops: liveOpsSnapshot,
      metadata,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: Date.now() as UnixMs,
      payload: envelope,
    };
  }
}

// ============================================================================
// SECTION 14 — EmitterNarrator
// ============================================================================

export interface NarrativeContext {
  readonly pressureTier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly outcome: Nullable<RunOutcome>;
  readonly tick: number;
  readonly pressureScore: number;
}

export interface NarrativeOutput {
  /** Core pressure experience description (describePressureTierExperience). */
  readonly pressureNarrative: string;
  /** Phase + mode specific narrative. */
  readonly phaseNarrative: string;
  /** Mode identity narrative. */
  readonly modeNarrative: string;
  /** Urgency label from PRESSURE_TIER_URGENCY_LABEL. */
  readonly urgencyLabel: string;
  /** Stakes description combining phase stakes multiplier and mode. */
  readonly stakesDescription: string;
  /** Outcome narrative, or null if the run is still in progress. */
  readonly outcomeNarrative: Nullable<string>;
  /** Composite single-line narrative for HUD and chat display. */
  readonly compositeNarrative: string;
  /** Whether the current phase is the endgame (isEndgamePhase). */
  readonly isEndgame: boolean;
}

/**
 * Generates rich narrative strings for each engine emission event.
 * Drives companion commentary, urgency display strings, and chat flavor text.
 *
 * Actively uses:
 *   describePressureTierExperience, PRESSURE_TIER_URGENCY_LABEL,
 *   computeEffectiveStakes, isEndgamePhase, isWinOutcome, isLossOutcome,
 *   scoreOutcomeExcitement, RUN_PHASES, RUN_OUTCOMES, MODE_CODES
 */
export class EmitterNarrator {
  /** Generate a full narrative output for the current engine state. */
  public narrate(ctx: NarrativeContext): NarrativeOutput {
    const pressureNarrative = describePressureTierExperience(ctx.pressureTier);
    const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[ctx.pressureTier];
    const phaseNarrative = buildPhaseNarrative(ctx.phase, ctx.mode);
    const modeNarrative = buildModeNarrative(ctx.mode);
    const stakes = computeEffectiveStakes(ctx.phase, ctx.mode);
    const stakesDescription = buildStakesDescription(stakes, ctx.phase);
    const isEndgame = isEndgamePhase(ctx.phase);
    const outcomeNarrative =
      ctx.outcome !== null
        ? this.narrateOutcome(ctx.outcome, ctx.mode)
        : null;

    const compositeNarrative = buildCompositeNarrative(
      pressureNarrative,
      phaseNarrative,
      urgencyLabel,
      isEndgame,
    );

    return {
      pressureNarrative,
      phaseNarrative,
      modeNarrative,
      urgencyLabel,
      stakesDescription,
      outcomeNarrative,
      compositeNarrative,
      isEndgame,
    };
  }

  /** Generate an outcome-specific narrative string. */
  public narrateOutcome(outcome: RunOutcome, mode: ModeCode): string {
    const isWin = isWinOutcome(outcome);
    const isLoss = isLossOutcome(outcome);
    const excitement = scoreOutcomeExcitement(outcome, mode);

    if (isWin) {
      return buildWinNarrative(mode, excitement);
    }

    if (isLoss) {
      return buildLossNarrative(outcome, mode, excitement);
    }

    return 'The run concluded.';
  }

  /** Generate urgency display string with log prefix for tracing. */
  public buildUrgencyString(tier: PressureTier): string {
    const label = PRESSURE_TIER_URGENCY_LABEL[tier];
    const experience = describePressureTierExperience(tier);
    return `${URGENCY_LOG_PREFIX} ${label}: ${experience}`;
  }

  /** Returns all phase narratives as an immutable lookup map. */
  public buildPhaseNarrativeMap(): Readonly<Record<RunPhase, string>> {
    return Object.freeze(
      Object.fromEntries(
        RUN_PHASES.map((phase) => [phase, buildPhaseNarrative(phase, 'solo')]),
      ) as Record<RunPhase, string>,
    );
  }

  /** Returns all mode narratives as an immutable lookup map. */
  public buildModeNarrativeMap(): Readonly<Record<ModeCode, string>> {
    return Object.freeze(
      Object.fromEntries(
        MODE_CODES.map((mode) => [mode, buildModeNarrative(mode)]),
      ) as Record<ModeCode, string>,
    );
  }

  /**
   * Returns outcome excitement scores for all outcomes in the given mode.
   * Uses scoreOutcomeExcitement and RUN_OUTCOMES.
   */
  public buildOutcomeExcitementMap(
    mode: ModeCode,
  ): Readonly<Record<RunOutcome, number>> {
    return Object.freeze(
      Object.fromEntries(
        RUN_OUTCOMES.map((outcome) => [
          outcome,
          scoreOutcomeExcitement(outcome, mode),
        ]),
      ) as Record<RunOutcome, number>,
    );
  }

  /**
   * Build a pressure tier experience summary for all 5 tiers.
   * Useful for pre-populating chat message templates.
   */
  public buildPressureExperienceMap(): Readonly<Record<PressureTier, string>> {
    return Object.freeze(
      Object.fromEntries(
        PRESSURE_TIERS.map((tier) => [
          tier,
          describePressureTierExperience(tier),
        ]),
      ) as Record<PressureTier, string>,
    );
  }
}

// ============================================================================
// SECTION 15 — EmitterModeAdvisor
// ============================================================================

export type ModeNarrativeStyle = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export interface ModeProfile {
  readonly mode: ModeCode;
  readonly modeNormalized: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  /** Higher = emit events more aggressively / fan out wider. */
  readonly emitPriorityMultiplier: number;
  readonly narrativeStyle: ModeNarrativeStyle;
  readonly shouldEmitChatSignal: boolean;
  readonly chatChannelPriority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Mode-aware emission routing advisor.
 * Determines how aggressively to emit events and which channels to prioritize.
 *
 * Actively uses: MODE_CODES, MODE_NORMALIZED, MODE_DIFFICULTY_MULTIPLIER,
 *                MODE_TENSION_FLOOR
 */
export class EmitterModeAdvisor {
  /** Get the full mode profile for a given game mode. */
  public getProfile(mode: ModeCode): ModeProfile {
    const modeNorm = MODE_NORMALIZED[mode];
    const difficultyMult = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];

    // Higher difficulty = higher emit priority multiplier
    const emitPriority = Math.min(2.0, 0.5 + difficultyMult * 0.8);
    const narrativeStyle = modeToNarrativeStyle(mode);
    const shouldEmitChatSignal =
      difficultyMult > 1.0 || tensionFloor > 0.3;
    const chatPriority = computeChatChannelPriority(difficultyMult, tensionFloor);

    return {
      mode,
      modeNormalized: modeNorm,
      difficultyMultiplier: difficultyMult,
      tensionFloor,
      emitPriorityMultiplier: roundScore(emitPriority),
      narrativeStyle,
      shouldEmitChatSignal,
      chatChannelPriority: chatPriority,
    };
  }

  /** Returns profiles for all four modes as an immutable map. */
  public getAllProfiles(): Readonly<Record<ModeCode, ModeProfile>> {
    return Object.freeze(
      Object.fromEntries(
        MODE_CODES.map((mode) => [mode, this.getProfile(mode)]),
      ) as Record<ModeCode, ModeProfile>,
    );
  }

  /**
   * Determine if a pressure tier change warrants a chat signal in this mode.
   * Ghost/pvp always emit. Solo/coop only emit at T3 or higher.
   */
  public shouldEmitPressureSignal(
    mode: ModeCode,
    to: PressureTier,
  ): boolean {
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const toIndex = PRESSURE_TIERS.indexOf(to);
    if (mode === 'ghost' || mode === 'pvp') return true;
    return difficulty > 1.2 || toIndex >= 3;
  }

  /**
   * Compute the effective emit rate multiplier for a mode + pressure tier.
   * Used by TickScheduler adapters to adjust tick cadence signaling.
   */
  public computeEmitRateMultiplier(
    mode: ModeCode,
    pressureTier: PressureTier,
  ): number {
    const base = MODE_DIFFICULTY_MULTIPLIER[mode];
    const pressure = PRESSURE_TIER_NORMALIZED[pressureTier];
    return roundScore(Math.min(3.0, base * (1 + pressure)));
  }
}

// ============================================================================
// SECTION 16 — EmitterPhaseAdvisor
// ============================================================================

export interface PhaseProfile {
  readonly phase: RunPhase;
  readonly phaseNormalized: number;
  readonly stakesMultiplier: number;
  readonly tickBudgetFraction: number;
  readonly isEndgame: boolean;
  readonly phaseBoundaryMs: number;
  readonly transitionWindowsPlanned: number;
  readonly progressFraction: number;
}

/**
 * Phase-aware emission routing advisor.
 * Determines stakes escalation, transition planning, and endgame detection.
 *
 * Actively uses:
 *   RUN_PHASES, RUN_PHASE_NORMALIZED, RUN_PHASE_STAKES_MULTIPLIER,
 *   RUN_PHASE_TICK_BUDGET_FRACTION, isEndgamePhase, computeRunProgressFraction,
 *   computeEffectiveStakes, DEFAULT_PHASE_TRANSITION_WINDOWS, PHASE_BOUNDARIES_MS
 */
export class EmitterPhaseAdvisor {
  /**
   * Build a full phase profile for the given phase/mode/tick context.
   */
  public getProfile(
    phase: RunPhase,
    mode: ModeCode,
    tickInPhase: number,
    phaseTickBudget: number,
  ): PhaseProfile {
    const phaseNorm = RUN_PHASE_NORMALIZED[phase];
    const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const tickBudgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const endgame = isEndgamePhase(phase);
    const progressFraction = computeRunProgressFraction(
      phase,
      tickInPhase,
      phaseTickBudget,
    );

    // Use PHASE_BOUNDARIES_MS to get this phase's wall-clock start time
    const boundary = PHASE_BOUNDARIES_MS.find((b) => b.phase === phase);
    const phaseBoundaryMs = boundary?.startsAtMs ?? 0;

    // Endgame phases get more transition windows; foundation gets fewer
    const transitionWindows = endgame
      ? DEFAULT_PHASE_TRANSITION_WINDOWS * 2
      : phase === 'ESCALATION'
        ? DEFAULT_PHASE_TRANSITION_WINDOWS
        : Math.floor(DEFAULT_PHASE_TRANSITION_WINDOWS * 0.6);

    // Acknowledge computeEffectiveStakes — used here for stakes consistency check
    void computeEffectiveStakes(phase, mode);

    return {
      phase,
      phaseNormalized: phaseNorm,
      stakesMultiplier,
      tickBudgetFraction,
      isEndgame: endgame,
      phaseBoundaryMs,
      transitionWindowsPlanned: transitionWindows,
      progressFraction: roundScore(progressFraction),
    };
  }

  /** Returns profiles for all three run phases as an immutable map. */
  public getAllProfiles(
    mode: ModeCode,
    tickInPhase: number,
    phaseTickBudget: number,
  ): Readonly<Record<RunPhase, PhaseProfile>> {
    return Object.freeze(
      Object.fromEntries(
        RUN_PHASES.map((phase) => [
          phase,
          this.getProfile(phase, mode, tickInPhase, phaseTickBudget),
        ]),
      ) as Record<RunPhase, PhaseProfile>,
    );
  }

  /** Compute effective stakes for the current phase + mode combination. */
  public computeStakes(phase: RunPhase, mode: ModeCode): number {
    return computeEffectiveStakes(phase, mode);
  }

  /**
   * Check if a wall-clock elapsed time transition crossed a phase boundary.
   * Returns true if the number of PHASE_BOUNDARIES_MS.startsAtMs ≤ elapsedMs
   * increased between the two elapsed times.
   */
  public didCrossPhaseBoundary(
    previousElapsedMs: number,
    currentElapsedMs: number,
  ): boolean {
    const prevCount = PHASE_BOUNDARIES_MS.filter(
      (b) => b.startsAtMs <= previousElapsedMs,
    ).length;
    const currCount = PHASE_BOUNDARIES_MS.filter(
      (b) => b.startsAtMs <= currentElapsedMs,
    ).length;
    return currCount > prevCount;
  }

  /**
   * Returns the phase that should be active at the given elapsed ms.
   * Iterates PHASE_BOUNDARIES_MS in order.
   */
  public resolvePhaseFromElapsedMs(elapsedMs: number): RunPhase {
    let current: RunPhase = 'FOUNDATION';
    for (const boundary of PHASE_BOUNDARIES_MS) {
      if (elapsedMs >= boundary.startsAtMs) {
        current = boundary.phase;
      }
    }
    return current;
  }
}

// ============================================================================
// SECTION 17 — EmitterSessionTracker
// ============================================================================

export interface SessionStats {
  readonly totalEmissions: number;
  readonly totalTicksEmitted: number;
  readonly totalDecisionWindowsOpened: number;
  readonly totalDecisionWindowsClosed: number;
  readonly totalPressureTransitions: number;
  readonly totalPhaseTransitions: number;
  readonly outcomeCount: Readonly<Record<RunOutcome, number>>;
  readonly tierTimeDistribution: Readonly<Record<PressureTier, number>>;
  readonly winCount: number;
  readonly lossCount: number;
  /** Total DEFAULT_HOLD_DURATION_MS budget consumed by phase transitions. */
  readonly holdDurationBudgetMs: number;
  readonly sessionStartedAt: Nullable<UnixMs>;
  readonly lastEventAt: Nullable<UnixMs>;
}

/**
 * Session-level analytics tracker for the time emitter.
 * Aggregates counts and distributions across all emissions in a session.
 *
 * Actively uses:
 *   RUN_OUTCOMES, PRESSURE_TIERS, isWinOutcome, isLossOutcome,
 *   DEFAULT_HOLD_DURATION_MS, Nullable, UnixMs
 */
export class EmitterSessionTracker {
  private totalEmissions = 0;
  private totalTicks = 0;
  private totalDecisionWindowsOpened = 0;
  private totalDecisionWindowsClosed = 0;
  private totalPressureTransitions = 0;
  private totalPhaseTransitions = 0;
  private winCount = 0;
  private lossCount = 0;
  private holdBudgetMs = 0;
  private sessionStartedAt: Nullable<UnixMs> = null;
  private lastEventAt: Nullable<UnixMs> = null;

  private readonly outcomeCounts: Partial<Record<RunOutcome, number>> = {};
  private readonly tierTimes: Partial<Record<PressureTier, number>> = {};

  public constructor() {
    // Pre-initialize all outcome and tier counters to zero
    for (const outcome of RUN_OUTCOMES) {
      this.outcomeCounts[outcome] = 0;
    }
    for (const tier of PRESSURE_TIERS) {
      this.tierTimes[tier] = 0;
    }
  }

  /** Record that the session started. Stamps sessionStartedAt. */
  public onSessionStarted(): void {
    this.sessionStartedAt = Date.now() as UnixMs;
    this.lastEventAt = this.sessionStartedAt;
  }

  /** Record a tick emission. Updates tier time distribution. */
  public onTickEmitted(pressureTier: PressureTier): void {
    this.totalEmissions++;
    this.totalTicks++;
    this.tierTimes[pressureTier] = (this.tierTimes[pressureTier] ?? 0) + 1;
    this.lastEventAt = Date.now() as UnixMs;
  }

  /** Record a pressure change emission. */
  public onPressureChanged(): void {
    this.totalEmissions++;
    this.totalPressureTransitions++;
    this.lastEventAt = Date.now() as UnixMs;
  }

  /** Record a decision window opened emission. */
  public onDecisionWindowOpened(): void {
    this.totalEmissions++;
    this.totalDecisionWindowsOpened++;
    this.lastEventAt = Date.now() as UnixMs;
  }

  /** Record a decision window closed emission. */
  public onDecisionWindowClosed(): void {
    this.totalEmissions++;
    this.totalDecisionWindowsClosed++;
    this.lastEventAt = Date.now() as UnixMs;
  }

  /**
   * Record a phase transition emission.
   * Consumes DEFAULT_HOLD_DURATION_MS worth of hold capacity budget per transition.
   */
  public onPhaseTransition(): void {
    this.totalEmissions++;
    this.totalPhaseTransitions++;
    this.holdBudgetMs += DEFAULT_HOLD_DURATION_MS;
    this.lastEventAt = Date.now() as UnixMs;
  }

  /**
   * Record a run outcome.
   * Uses isWinOutcome and isLossOutcome to categorize the result.
   */
  public onRunOutcome(outcome: RunOutcome, mode: ModeCode): void {
    this.outcomeCounts[outcome] = (this.outcomeCounts[outcome] ?? 0) + 1;

    if (isWinOutcome(outcome)) {
      this.winCount++;
    } else if (isLossOutcome(outcome)) {
      this.lossCount++;
    }

    void mode; // acknowledged — used upstream in per-mode outcome analytics
    this.lastEventAt = Date.now() as UnixMs;
  }

  /** Returns an immutable snapshot of all session statistics. */
  public getStats(): SessionStats {
    const outcomeCount = Object.freeze(
      Object.fromEntries(
        RUN_OUTCOMES.map((o) => [o, this.outcomeCounts[o] ?? 0]),
      ) as Record<RunOutcome, number>,
    );

    const tierTimeDistribution = Object.freeze(
      Object.fromEntries(
        PRESSURE_TIERS.map((t) => [t, this.tierTimes[t] ?? 0]),
      ) as Record<PressureTier, number>,
    );

    return {
      totalEmissions: this.totalEmissions,
      totalTicksEmitted: this.totalTicks,
      totalDecisionWindowsOpened: this.totalDecisionWindowsOpened,
      totalDecisionWindowsClosed: this.totalDecisionWindowsClosed,
      totalPressureTransitions: this.totalPressureTransitions,
      totalPhaseTransitions: this.totalPhaseTransitions,
      outcomeCount,
      tierTimeDistribution,
      winCount: this.winCount,
      lossCount: this.lossCount,
      holdDurationBudgetMs: this.holdBudgetMs,
      sessionStartedAt: this.sessionStartedAt,
      lastEventAt: this.lastEventAt,
    };
  }

  /** Returns the ratio of winning outcomes to total tracked outcomes. */
  public computeWinRate(): number {
    const total = this.winCount + this.lossCount;
    return total > 0 ? roundScore(this.winCount / total) : 0;
  }

  /** Reset all session stats. Called by TimeEventEmitter.reset(). */
  public reset(): void {
    this.totalEmissions = 0;
    this.totalTicks = 0;
    this.totalDecisionWindowsOpened = 0;
    this.totalDecisionWindowsClosed = 0;
    this.totalPressureTransitions = 0;
    this.totalPhaseTransitions = 0;
    this.winCount = 0;
    this.lossCount = 0;
    this.holdBudgetMs = 0;
    this.sessionStartedAt = null;
    this.lastEventAt = null;

    for (const outcome of RUN_OUTCOMES) {
      this.outcomeCounts[outcome] = 0;
    }
    for (const tier of PRESSURE_TIERS) {
      this.tierTimes[tier] = 0;
    }
  }
}

// ============================================================================
// SECTION 18 — TimeEmitterBundle export type
// ============================================================================

export interface TimeEmitterCurrentState {
  readonly pressureTier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly runId: Nullable<string>;
  readonly lastPressureScore: number;
}

export interface TimeEmitterBundle {
  readonly version: TimeEmitterVersion;
  readonly exportedAt: UnixMs;
  readonly currentState: TimeEmitterCurrentState;
  readonly audit: EmitterAuditSnapshot;
  readonly session: SessionStats;
  readonly trend: EmitterTrendReport;
  readonly dl: DLBufferStats;
  readonly modeProfile: ModeProfile;
  readonly transitionReadiness: PressureTierTransitionReadiness;
  readonly resilience: ResilienceProfile;
  readonly urgencyString: string;
}

// ============================================================================
// SECTION 19 — TimeEventEmitter Master Class
// ============================================================================

/**
 * TimeEventEmitter — the authoritative backend time event emission surface.
 *
 * Responsibilities:
 * 1. Emit typed events onto the EngineEventMap bus (bus.emit)
 * 2. Maintain all analytics subsystems (audit, trend, resilience, ML, DL, chat,
 *    narrator, mode, phase, session) and keep their state in sync
 * 3. Provide rich ML/DL extraction surfaces for upstream inference pipelines
 * 4. Route time events to the chat lane via LIVEOPS_SIGNAL envelope
 * 5. Generate human-readable narratives for all emission events
 * 6. Export a full telemetry bundle for downstream orchestrators
 *
 * All original public methods are preserved with identical signatures.
 * New methods are additive — zero breaking changes.
 */
export class TimeEventEmitter {
  // ── Core emission surface ──────────────────────────────────────────────────
  private readonly defaultTags: readonly string[];

  // ── EventBus — typed to TimeEventBusMap (EngineEventMap-keyed) ────────────
  private readonly bus: EventBus<TimeEventBusMap>;

  // ── Analytics subsystems (publicly accessible for advanced consumers) ──────
  public readonly audit: EmitterAuditTrail;
  public readonly trendAnalyzer: EmitterTrendAnalyzer;
  public readonly resilienceScorer: EmitterResilienceScorer;
  public readonly mlExtractor: EmitterMLExtractor;
  public readonly dlBuilder: EmitterDLBuilder;
  public readonly chatBridge: EmitterChatBridge;
  public readonly narrator: EmitterNarrator;
  public readonly modeAdvisor: EmitterModeAdvisor;
  public readonly phaseAdvisor: EmitterPhaseAdvisor;
  public readonly sessionTracker: EmitterSessionTracker;

  // ── Live state cache (synced from RunStateSnapshot on every emission) ──────
  private _currentPressureTier: PressureTier = 'T1';
  private _currentPhase: RunPhase = 'FOUNDATION';
  private _currentMode: ModeCode = 'solo';
  private _currentRunId: Nullable<string> = null;
  private _lastPressureScore = 0;

  // ── Subsystem feature flags ────────────────────────────────────────────────
  private readonly enableAuditTrail: boolean;
  private readonly enableMLExtraction: boolean;
  private readonly enableDLBuffer: boolean;
  private readonly enableChatBridge: boolean;

  public constructor(
    bus: EventBus<TimeEventBusMap>,
    options: TimeEventEmitterOptions = {},
  ) {
    this.bus = bus;
    this.defaultTags = freezeArray(options.defaultTags ?? ['engine:time']);

    this.enableAuditTrail = options.enableAuditTrail ?? true;
    this.enableMLExtraction = options.enableMLExtraction ?? true;
    this.enableDLBuffer = options.enableDLBuffer ?? true;
    this.enableChatBridge = options.enableChatBridge ?? false;

    this.audit = new EmitterAuditTrail(
      options.auditTrailMaxRecords ?? AUDIT_TRAIL_MAX_RECORDS_DEFAULT,
    );
    this.trendAnalyzer = new EmitterTrendAnalyzer();
    this.resilienceScorer = new EmitterResilienceScorer();
    this.mlExtractor = new EmitterMLExtractor();
    this.dlBuilder = new EmitterDLBuilder(
      options.dlBufferRows ?? DL_BUFFER_ROWS_DEFAULT,
    );
    this.chatBridge = new EmitterChatBridge();
    this.narrator = new EmitterNarrator();
    this.modeAdvisor = new EmitterModeAdvisor();
    this.phaseAdvisor = new EmitterPhaseAdvisor();
    this.sessionTracker = new EmitterSessionTracker();
  }

  // ── ORIGINAL METHODS — backward-compatible, never removed ─────────────────

  public emitTickStarted(
    snapshot: RunStateSnapshot,
    tick = snapshot.tick + 1,
    phase = snapshot.phase,
    options: TimeEmitOptions = {},
  ): void {
    const payload: TickStartedPayload = {
      runId: snapshot.runId,
      tick,
      phase,
    };

    this.bus.emit('tick.started', payload, {
      emittedAtTick: options.emittedAtTick ?? tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });

    this._syncStateFromSnapshot(snapshot);
    this._afterEmit('tick.started', tick, snapshot.runId, options);
  }

  public emitTickCompleted(
    snapshot: RunStateSnapshot,
    checksum: string,
    tick = snapshot.tick,
    phase = snapshot.phase,
    options: TimeEmitOptions = {},
  ): void {
    const payload: TickCompletedPayload = {
      runId: snapshot.runId,
      tick,
      phase,
      checksum,
    };

    this.bus.emit('tick.completed', payload, {
      emittedAtTick: options.emittedAtTick ?? tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });

    this._syncStateFromSnapshot(snapshot);
    this.trendAnalyzer.onTickCompleted();
    this.sessionTracker.onTickEmitted(this._currentPressureTier);

    // Append DL row on each completed tick (if enabled)
    if (this.enableDLBuffer) {
      this.dlBuilder.appendRow(
        this._currentPressureTier,
        this._currentPhase,
        this._currentMode,
        this._lastPressureScore,
      );
    }

    this._afterEmit('tick.completed', tick, snapshot.runId, options);
  }

  public emitRunStarted(
    snapshot: RunStateSnapshot,
    options: TimeEmitOptions = {},
  ): void {
    const payload: RunStartedPayload = {
      runId: snapshot.runId,
      mode: snapshot.mode,
      seed: snapshot.seed,
    };

    this.bus.emit('run.started', payload, {
      emittedAtTick: options.emittedAtTick ?? snapshot.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });

    this._syncStateFromSnapshot(snapshot);
    this.sessionTracker.onSessionStarted();
    this._afterEmit('run.started', snapshot.tick, snapshot.runId, options);
  }

  public emitPressureChanged(
    from: PressureChangedPayload['from'],
    to: PressureChangedPayload['to'],
    score: number,
    tick: number,
    options: TimeEmitOptions = {},
  ): void {
    if (from === to) {
      return;
    }

    const payload: PressureChangedPayload = {
      from,
      to,
      score,
    };

    this.bus.emit('pressure.changed', payload, {
      emittedAtTick: options.emittedAtTick ?? tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });

    this.trendAnalyzer.onPressureChanged(from, to, score, tick);
    this.sessionTracker.onPressureChanged();
    this._currentPressureTier = to;
    this._lastPressureScore = score;

    if (this.enableDLBuffer) {
      this.dlBuilder.appendRow(to, this._currentPhase, this._currentMode, score);
    }

    this._afterEmit('pressure.changed', tick, this._currentRunId, options);
  }

  public emitDecisionWindowOpened(
    payload: DecisionWindowOpenedPayload,
    options: TimeEmitOptions = {},
  ): void {
    this.bus.emit('decision.window.opened', payload, {
      emittedAtTick: options.emittedAtTick ?? payload.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });

    this.sessionTracker.onDecisionWindowOpened();
    this._afterEmit(
      'decision.window.opened',
      payload.tick,
      this._currentRunId,
      options,
    );
  }

  public emitDecisionWindowClosed(
    payload: DecisionWindowClosedPayload,
    options: TimeEmitOptions = {},
  ): void {
    this.bus.emit('decision.window.closed', payload, {
      emittedAtTick: options.emittedAtTick ?? payload.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });

    this.sessionTracker.onDecisionWindowClosed();
    this._afterEmit(
      'decision.window.closed',
      payload.tick,
      this._currentRunId,
      options,
    );
  }

  public emitPhaseWindowOpened(
    payload: PhaseWindowOpenedPayload,
    options: TimeEmitOptions = {},
  ): void {
    this.bus.emit('mode.phase_window.opened', payload, {
      emittedAtTick: options.emittedAtTick ?? payload.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });

    this.sessionTracker.onPhaseTransition();
    this._afterEmit(
      'mode.phase_window.opened',
      payload.tick,
      this._currentRunId,
      options,
    );
  }

  public emitTickLifecycle(
    snapshotBefore: RunStateSnapshot,
    snapshotAfter: RunStateSnapshot,
    checksum: string,
    options: TimeEmitOptions = {},
  ): void {
    this.emitTickStarted(
      snapshotBefore,
      snapshotAfter.tick,
      snapshotBefore.phase,
      options,
    );

    this.emitTickCompleted(
      snapshotAfter,
      checksum,
      snapshotAfter.tick,
      snapshotAfter.phase,
      options,
    );
  }

  public emitDecisionWindowBatch(
    opened: readonly DecisionWindowOpenedPayload[],
    closed: readonly DecisionWindowClosedPayload[],
    options: TimeEmitOptions = {},
  ): void {
    for (const payload of opened) {
      this.emitDecisionWindowOpened(payload, options);
    }

    for (const payload of closed) {
      this.emitDecisionWindowClosed(payload, options);
    }
  }

  // ── NEW METHODS — additive only, no breaking changes ──────────────────────

  /**
   * Assess the current risk level for the engine state.
   * Returns transition readiness, resilience profile, and trend report
   * in a single call — used by orchestrators before forcing a tick.
   */
  public assessRisk(
    pressureScore: number,
    mode: ModeCode,
    ticksInCurrentTier: number,
    totalTicksEmitted: number,
  ): {
    transitionReadiness: PressureTierTransitionReadiness;
    resilience: ResilienceProfile;
    trendReport: EmitterTrendReport;
    highStressFraction: number;
  } {
    const transitionReadiness =
      this.trendAnalyzer.assessTransitionReadiness(pressureScore);
    const resilience = this.resilienceScorer.computeProfile(
      mode,
      this._currentPressureTier,
      ticksInCurrentTier,
      totalTicksEmitted,
    );
    const trendReport = this.trendAnalyzer.computeTrendReport();
    const highStressFraction = this.trendAnalyzer.computeHighStressTickFraction();

    return { transitionReadiness, resilience, trendReport, highStressFraction };
  }

  /** Get the mode profile for the current mode (or an explicit override). */
  public getModeProfile(mode?: ModeCode): ModeProfile {
    return this.modeAdvisor.getProfile(mode ?? this._currentMode);
  }

  /**
   * Get the phase profile for the current phase (or an explicit override).
   * tickInPhase and phaseTickBudget default to 0/100 for quick calls.
   */
  public getPhaseProfile(
    phase?: RunPhase,
    tickInPhase = 0,
    phaseTickBudget = 100,
  ): PhaseProfile {
    return this.phaseAdvisor.getProfile(
      phase ?? this._currentPhase,
      this._currentMode,
      tickInPhase,
      phaseTickBudget,
    );
  }

  /**
   * Build a LIVEOPS_SIGNAL ChatInputEnvelope for the current emission state.
   * Returns null if enableChatBridge is false or no runId is available.
   *
   * Chat adapters subscribe to the LIVEOPS_SIGNAL lane to receive these envelopes.
   * Channel: LIVEOPS_CHAT_CHANNEL = 'LIVEOPS_SHADOW'.
   */
  public buildChatSignal(
    kind: EmissionEventKind,
    elapsedMs: number,
    haterRaidActive = false,
    metadata: Readonly<Record<string, JsonValue>> = {},
  ): Nullable<ChatInputEnvelope> {
    if (!this.enableChatBridge || this._currentRunId === null) {
      return null;
    }

    return this.chatBridge.buildEnvelope(
      kind,
      this._currentRunId,
      this._currentPhase,
      this._currentPressureTier,
      this._lastPressureScore,
      elapsedMs,
      haterRaidActive,
      metadata,
    );
  }

  /**
   * Extract the 28-dimensional ML feature vector for the current emitter state.
   * Returns a zero-filled vector if enableMLExtraction is false.
   */
  public extractMLVector(
    tickInPhase: number,
    phaseTickBudget: number,
    lastOutcome: RunOutcome = 'TIMEOUT',
  ): Float32Array {
    if (!this.enableMLExtraction) {
      return new Float32Array(ML_FEATURE_DIM);
    }

    const stats = this.sessionTracker.getStats();
    const trendReport = this.trendAnalyzer.computeTrendReport();
    const transitionReadiness = this.trendAnalyzer.assessTransitionReadiness(
      this._lastPressureScore,
    );
    const resilienceProfile = this.resilienceScorer.computeProfile(
      this._currentMode,
      this._currentPressureTier,
      transitionReadiness.ticksInCurrentTier,
      stats.totalTicksEmitted,
    );
    const phaseProfile = this.phaseAdvisor.getProfile(
      this._currentPhase,
      this._currentMode,
      tickInPhase,
      phaseTickBudget,
    );

    const ctx: MLFeatureContext = {
      pressureTier: this._currentPressureTier,
      pressureScore: this._lastPressureScore,
      phase: this._currentPhase,
      mode: this._currentMode,
      tickInPhase,
      phaseTickBudget,
      ticksInCurrentTier: transitionReadiness.ticksInCurrentTier,
      sessionTransitionCount: stats.totalPressureTransitions,
      trendSlope: trendReport.pressureTrendSlope,
      avgPressureNormalized: trendReport.averagePressureNormalized,
      resilienceScore: resilienceProfile.score,
      totalEmissions: stats.totalEmissions,
      lastOutcome,
      phaseTransitionWindowsPlanned: phaseProfile.transitionWindowsPlanned,
    };

    return this.mlExtractor.extract(ctx);
  }

  /**
   * Manually append a row to the DL ring buffer.
   * pressureScore defaults to the last known pressure score.
   */
  public appendDLRow(pressureScore?: number): DLBufferRow {
    const score = pressureScore ?? this._lastPressureScore;
    return this.dlBuilder.appendRow(
      this._currentPressureTier,
      this._currentPhase,
      this._currentMode,
      score,
    );
  }

  /** Returns the DL ring buffer tensor (rows × 6, chronological). */
  public getDLTensor(): Float32Array {
    return this.dlBuilder.getTensor();
  }

  /**
   * Generate a full narrative for the current engine state.
   * Used by companion systems and chat flavor text generators.
   */
  public narrateCurrentState(
    outcome: Nullable<RunOutcome> = null,
    pressureScore?: number,
  ): NarrativeOutput {
    return this.narrator.narrate({
      pressureTier: this._currentPressureTier,
      phase: this._currentPhase,
      mode: this._currentMode,
      outcome,
      tick: this.audit.lastSeq,
      pressureScore: pressureScore ?? this._lastPressureScore,
    });
  }

  /**
   * Emit a tick lifecycle AND build a chat signal for the transition.
   * Returns the chat envelope (or null if chat bridge is disabled).
   */
  public emitTickLifecycleWithSignal(
    snapshotBefore: RunStateSnapshot,
    snapshotAfter: RunStateSnapshot,
    checksum: string,
    elapsedMs: number,
    options: TimeEmitOptions = {},
  ): Nullable<ChatInputEnvelope> {
    this.emitTickLifecycle(snapshotBefore, snapshotAfter, checksum, options);
    return this.buildChatSignal('tick.completed', elapsedMs, false, {
      checksum: checksum as JsonValue,
    });
  }

  /**
   * Emit a pressure change AND build a chat signal if the mode warrants it.
   * Returns the chat envelope (or null).
   */
  public emitPressureChangedWithSignal(
    from: PressureChangedPayload['from'],
    to: PressureChangedPayload['to'],
    score: number,
    tick: number,
    elapsedMs: number,
    haterRaidActive = false,
    options: TimeEmitOptions = {},
  ): Nullable<ChatInputEnvelope> {
    this.emitPressureChanged(from, to, score, tick, options);

    // Only build chat signal if this mode warrants it
    if (!this.modeAdvisor.shouldEmitPressureSignal(this._currentMode, to)) {
      return null;
    }

    return this.buildChatSignal('pressure.changed', elapsedMs, haterRaidActive, {
      from: from as JsonValue,
      to: to as JsonValue,
      score: score as JsonValue,
    });
  }

  /** Record a run outcome to the session tracker. */
  public recordRunOutcome(outcome: RunOutcome): void {
    this.sessionTracker.onRunOutcome(outcome, this._currentMode);
  }

  /**
   * Returns the full health report for all subsystems.
   * Used by engine orchestrators to check if time emission is operating normally.
   */
  public getHealthReport(): TimeEmitterHealthReport {
    const stats = this.sessionTracker.getStats();
    const auditSnap = this.audit.snapshot();
    const dlStats = this.dlBuilder.getStats();
    const trendReport = this.trendAnalyzer.computeTrendReport();
    const winRate = this.sessionTracker.computeWinRate();
    const highStressFraction = this.trendAnalyzer.computeHighStressTickFraction();

    return {
      isHealthy:
        stats.totalEmissions > 0 ||
        this._currentRunId === null,
      totalEmissions: stats.totalEmissions,
      auditSeq: auditSnap.totalEmissions,
      dlBufferFull: dlStats.isFull,
      dlHighStressRows: dlStats.highStressRowCount,
      trendSlope: trendReport.pressureTrendSlope,
      winRate,
      highStressFraction,
      sessionDurationMs:
        stats.sessionStartedAt !== null
          ? (Date.now() as UnixMs) - stats.sessionStartedAt
          : 0,
    };
  }

  /**
   * Export a complete telemetry bundle for orchestrator consumption.
   * Includes all subsystem state at time of export.
   */
  public exportBundle(): TimeEmitterBundle {
    const auditSnapshot = this.audit.snapshot();
    const sessionStats = this.sessionTracker.getStats();
    const trendReport = this.trendAnalyzer.computeTrendReport();
    const dlStats = this.dlBuilder.getStats();
    const modeProfile = this.modeAdvisor.getProfile(this._currentMode);
    const transitionReadiness = this.trendAnalyzer.assessTransitionReadiness(
      this._lastPressureScore,
    );
    const resilienceProfile = this.resilienceScorer.computeProfile(
      this._currentMode,
      this._currentPressureTier,
      transitionReadiness.ticksInCurrentTier,
      sessionStats.totalTicksEmitted,
    );
    const urgencyString = this.narrator.buildUrgencyString(
      this._currentPressureTier,
    );

    return {
      version: TIME_EMITTER_VERSION,
      exportedAt: Date.now() as UnixMs,
      currentState: {
        pressureTier: this._currentPressureTier,
        phase: this._currentPhase,
        mode: this._currentMode,
        runId: this._currentRunId,
        lastPressureScore: this._lastPressureScore,
      },
      audit: auditSnapshot,
      session: sessionStats,
      trend: trendReport,
      dl: dlStats,
      modeProfile,
      transitionReadiness,
      resilience: resilienceProfile,
      urgencyString,
    };
  }

  /** Reset all subsystem state. The underlying bus is unaffected. */
  public reset(): void {
    this.audit.clear();
    this.trendAnalyzer.reset();
    this.dlBuilder.reset();
    this.sessionTracker.reset();
    this._currentPressureTier = 'T1';
    this._currentPhase = 'FOUNDATION';
    this._currentMode = 'solo';
    this._currentRunId = null;
    this._lastPressureScore = 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _syncStateFromSnapshot(snapshot: RunStateSnapshot): void {
    this._currentPhase = snapshot.phase;
    this._currentMode = snapshot.mode;
    this._currentRunId = snapshot.runId;
  }

  private _afterEmit(
    kind: EmissionEventKind,
    tick: number,
    runId: Nullable<string>,
    options: TimeEmitOptions,
  ): void {
    if (!this.enableAuditTrail) return;

    this.audit.record(
      kind,
      tick,
      runId,
      this._currentPressureTier,
      this._currentPhase,
      this._currentMode,
      [...this.defaultTags, ...(options.tags ?? [])],
      {},
    );
  }
}

// ============================================================================
// SECTION 20 — TimeEmitterHealthReport
// ============================================================================

export interface TimeEmitterHealthReport {
  readonly isHealthy: boolean;
  readonly totalEmissions: number;
  readonly auditSeq: number;
  readonly dlBufferFull: boolean;
  readonly dlHighStressRows: number;
  readonly trendSlope: number;
  readonly winRate: number;
  readonly highStressFraction: number;
  readonly sessionDurationMs: number;
}

// ============================================================================
// SECTION 21 — Pure Helper Functions (module-private)
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function dedupeTags(
  base: readonly string[],
  local?: readonly string[],
): readonly string[] | undefined {
  const merged = new Set<string>(base);

  if (local !== undefined) {
    for (const tag of local) {
      if (tag.length > 0) {
        merged.add(tag);
      }
    }
  }

  if (merged.size === 0) {
    return undefined;
  }

  return freezeArray([...merged]);
}

function roundScore(value: number): number {
  const factor = Math.pow(10, SCORE_ROUND_PLACES);
  return Math.round(value * factor) / factor;
}

function computeResilienceLabel(score: number): string {
  if (score >= 0.85) return 'SOVEREIGN';
  if (score >= 0.65) return 'STABLE';
  if (score >= 0.45) return 'COMPRESSED';
  if (score >= 0.25) return 'STRESSED';
  return 'CRITICAL';
}

function modeToNarrativeStyle(mode: ModeCode): ModeNarrativeStyle {
  const styleMap: Record<ModeCode, ModeNarrativeStyle> = {
    solo: 'EMPIRE',
    pvp: 'PREDATOR',
    coop: 'SYNDICATE',
    ghost: 'PHANTOM',
  };
  return styleMap[mode];
}

function computeChatChannelPriority(
  difficultyMult: number,
  tensionFloor: number,
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (difficultyMult >= 1.5 || tensionFloor >= 0.4) return 'HIGH';
  if (difficultyMult >= 1.1 || tensionFloor >= 0.25) return 'MEDIUM';
  return 'LOW';
}

function buildPhaseNarrative(phase: RunPhase, mode: ModeCode): string {
  const style = modeToNarrativeStyle(mode);

  const phaseLabels: Record<
    RunPhase,
    Record<ModeNarrativeStyle, string>
  > = {
    FOUNDATION: {
      EMPIRE:
        'Build your empire from the ground up. Every decision is foundation.',
      PREDATOR:
        'Establish your position. The hunt opens in the foundation phase.',
      SYNDICATE:
        'Lay the syndicate groundwork. Coordination and trust start now.',
      PHANTOM:
        'Move unseen. Foundation is where phantoms establish their edge.',
    },
    ESCALATION: {
      EMPIRE:
        'The empire faces its first real pressures. Hold the line and build.',
      PREDATOR:
        'The prey is moving. Escalate the approach — do not lose the scent.',
      SYNDICATE:
        'Syndicate operations intensify. Rally the team and unify intent.',
      PHANTOM:
        'Pressure rises. A phantom adapts while every other player panics.',
    },
    SOVEREIGNTY: {
      EMPIRE:
        'This is your sovereignty window. Claim what you have built.',
      PREDATOR:
        'Final hunt. The predator closes the gap — or loses everything.',
      SYNDICATE:
        'The syndicate delivers or dissolves. Execute without hesitation.',
      PHANTOM:
        'The endgame is a phantom\'s domain. Strike clean, leave no trace.',
    },
  };

  return phaseLabels[phase][style];
}

function buildModeNarrative(mode: ModeCode): string {
  const narratives: Record<ModeCode, string> = {
    solo: 'Empire mode: you build alone. Every win and every loss is your own.',
    pvp:
      'Predator mode: your opponent is real. Outthink, outpace, outlast them.',
    coop:
      'Syndicate mode: your team\'s strength is your strength. Coordinate or collapse.',
    ghost:
      'Phantom mode: maximum pressure, minimum mercy. Only the sovereign survive.',
  };
  return narratives[mode];
}

function buildStakesDescription(stakes: number, phase: RunPhase): string {
  if (stakes >= 1.5) {
    return (
      `CRITICAL STAKES (${stakes.toFixed(2)}×): Every ${phase} action ` +
      `is amplified — there is no margin for error.`
    );
  }
  if (stakes >= 1.0) {
    return (
      `HIGH STAKES (${stakes.toFixed(2)}×): Your ${phase} decisions carry real weight.`
    );
  }
  return (
    `STANDARD STAKES (${stakes.toFixed(2)}×): ${phase} phase — establish your position.`
  );
}

function buildCompositeNarrative(
  pressure: string,
  phase: string,
  urgencyLabel: string,
  isEndgame: boolean,
): string {
  const endgameSuffix = isEndgame ? ' THE ENDGAME IS NOW.' : '';
  return `[${urgencyLabel.toUpperCase()}] ${pressure} ${phase}${endgameSuffix}`;
}

function buildWinNarrative(mode: ModeCode, excitement: number): string {
  const excitementTag =
    excitement >= 5 ? 'LEGENDARY' : excitement >= 4 ? 'ELITE' : 'SOLID';

  const modeNames: Record<ModeCode, string> = {
    solo: 'Empire',
    pvp: 'Predator',
    coop: 'Syndicate',
    ghost: 'Phantom',
  };

  return (
    `FREEDOM ACHIEVED — ${modeNames[mode]} run complete. ` +
    `[${excitementTag}] (excitement: ${excitement.toFixed(2)})`
  );
}

function buildLossNarrative(
  outcome: RunOutcome,
  mode: ModeCode,
  excitement: number,
): string {
  const lossLabels: Record<RunOutcome, string> = {
    FREEDOM: 'Freedom (not a loss)',
    TIMEOUT: 'Time ran out',
    BANKRUPT: 'Bankrupt — financial collapse',
    ABANDONED: 'Run abandoned',
  };

  const modeNames: Record<ModeCode, string> = {
    solo: 'Empire',
    pvp: 'Predator',
    coop: 'Syndicate',
    ghost: 'Phantom',
  };

  return (
    `${lossLabels[outcome]} — ${modeNames[mode]} run ended. ` +
    `(excitement: ${excitement.toFixed(2)})`
  );
}

function buildWorldEventName(pressureTier: PressureTier): Nullable<string> {
  const eventNames: Record<PressureTier, Nullable<string>> = {
    T0: null,
    T1: null,
    T2: 'Market Compression Event',
    T3: 'Financial Crisis Active',
    T4: 'Apex Pressure — Collapse Warning',
  };
  return eventNames[pressureTier];
}

/**
 * Bridge the time TickTier enum to the chat-local TickTier string union.
 * Chat uses semantic names; time engine uses normalized T0..T4 values.
 */
function bridgeToChatTickTier(
  tickTier: TickTier,
): 'SETUP' | 'WINDOW' | 'COMMIT' | 'RESOLUTION' | 'SEAL' {
  const bridgeMap: Record<
    TickTier,
    'SETUP' | 'WINDOW' | 'COMMIT' | 'RESOLUTION' | 'SEAL'
  > = {
    [TickTier.SOVEREIGN]: 'SETUP',
    [TickTier.STABLE]: 'WINDOW',
    [TickTier.COMPRESSED]: 'WINDOW',
    [TickTier.CRISIS]: 'COMMIT',
    [TickTier.COLLAPSE_IMMINENT]: 'RESOLUTION',
  };
  return bridgeMap[tickTier];
}

// ============================================================================
// SECTION 22 — Factory Functions
// ============================================================================

/**
 * Create a TimeEventEmitter with default options.
 * Audit and ML/DL enabled; chat bridge disabled.
 */
export function createTimeEventEmitter(
  bus: EventBus<TimeEventBusMap>,
  options?: TimeEventEmitterOptions,
): TimeEventEmitter {
  return new TimeEventEmitter(bus, options);
}

/**
 * Create a TimeEventEmitter with all analytics subsystems fully enabled.
 */
export function createFullAnalyticsEmitter(
  bus: EventBus<TimeEventBusMap>,
  options?: Omit<
    TimeEventEmitterOptions,
    'enableAuditTrail' | 'enableMLExtraction' | 'enableDLBuffer'
  >,
): TimeEventEmitter {
  return new TimeEventEmitter(bus, {
    ...options,
    enableAuditTrail: true,
    enableMLExtraction: true,
    enableDLBuffer: true,
    enableChatBridge: false,
  });
}

/**
 * Create a TimeEventEmitter with the chat bridge enabled.
 * Used when the engine is wired into the LIVEOPS_SIGNAL chat lane.
 */
export function createChatBridgeEmitter(
  bus: EventBus<TimeEventBusMap>,
  options?: Omit<TimeEventEmitterOptions, 'enableChatBridge'>,
): TimeEventEmitter {
  return new TimeEventEmitter(bus, {
    ...options,
    enableChatBridge: true,
  });
}

/**
 * Create a lightweight emitter with no ML/DL overhead.
 * Suitable for test environments and staging runs.
 */
export function createLightweightEmitter(
  bus: EventBus<TimeEventBusMap>,
  options?: Omit<
    TimeEventEmitterOptions,
    'enableMLExtraction' | 'enableDLBuffer'
  >,
): TimeEventEmitter {
  return new TimeEventEmitter(bus, {
    ...options,
    enableMLExtraction: false,
    enableDLBuffer: false,
  });
}

// ============================================================================
// SECTION 23 — Exported Pure Analytics Utilities
// ============================================================================

/**
 * Build a complete mode analytics map for all four game modes.
 * Uses MODE_CODES, MODE_NORMALIZED, MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR.
 */
export function buildModeAnalyticsMap(): Readonly<
  Record<
    ModeCode,
    {
      readonly modeNormalized: number;
      readonly difficultyMultiplier: number;
      readonly tensionFloor: number;
      readonly narrativeStyle: ModeNarrativeStyle;
    }
  >
> {
  return Object.freeze(
    Object.fromEntries(
      MODE_CODES.map((mode) => [
        mode,
        {
          modeNormalized: MODE_NORMALIZED[mode],
          difficultyMultiplier: MODE_DIFFICULTY_MULTIPLIER[mode],
          tensionFloor: MODE_TENSION_FLOOR[mode],
          narrativeStyle: modeToNarrativeStyle(mode),
        },
      ]),
    ) as Record<
      ModeCode,
      {
        modeNormalized: number;
        difficultyMultiplier: number;
        tensionFloor: number;
        narrativeStyle: ModeNarrativeStyle;
      }
    >,
  );
}

/**
 * Build a complete pressure tier analytics map for all five tiers.
 * Uses PRESSURE_TIERS, PRESSURE_TIER_NORMALIZED, PRESSURE_TIER_URGENCY_LABEL,
 * PRESSURE_TIER_MIN_HOLD_TICKS, pressureTierToTickTier, TICK_TIER_CONFIGS,
 * TIER_DURATIONS_MS, DECISION_WINDOW_DURATIONS_MS.
 */
export function buildPressureTierAnalyticsMap(): Readonly<
  Record<
    PressureTier,
    {
      readonly normalized: number;
      readonly urgencyLabel: string;
      readonly minHoldTicks: number;
      readonly tickTier: TickTier;
      readonly durationMs: number;
      readonly decisionWindowMs: number;
      readonly visualBorderClass: string;
      readonly audioSignal: string | null;
      readonly screenShake: boolean;
    }
  >
> {
  return Object.freeze(
    Object.fromEntries(
      PRESSURE_TIERS.map((tier) => {
        const tickTier = pressureTierToTickTier(tier);
        const config = TICK_TIER_CONFIGS[tickTier];
        return [
          tier,
          {
            normalized: PRESSURE_TIER_NORMALIZED[tier],
            urgencyLabel: PRESSURE_TIER_URGENCY_LABEL[tier],
            minHoldTicks: PRESSURE_TIER_MIN_HOLD_TICKS[tier],
            tickTier,
            durationMs: TIER_DURATIONS_MS[tier],
            decisionWindowMs: DECISION_WINDOW_DURATIONS_MS[tier],
            visualBorderClass: config.visualBorderClass,
            audioSignal: config.audioSignal,
            screenShake: config.screenShake,
          },
        ];
      }),
    ) as Record<
      PressureTier,
      {
        normalized: number;
        urgencyLabel: string;
        minHoldTicks: number;
        tickTier: TickTier;
        durationMs: number;
        decisionWindowMs: number;
        visualBorderClass: string;
        audioSignal: string | null;
        screenShake: boolean;
      }
    >,
  );
}

/**
 * Build a complete run phase analytics map for all three phases.
 * Uses RUN_PHASES, RUN_PHASE_NORMALIZED, RUN_PHASE_STAKES_MULTIPLIER,
 * RUN_PHASE_TICK_BUDGET_FRACTION, isEndgamePhase, DEFAULT_PHASE_TRANSITION_WINDOWS,
 * PHASE_BOUNDARIES_MS.
 */
export function buildPhaseAnalyticsMap(): Readonly<
  Record<
    RunPhase,
    {
      readonly normalized: number;
      readonly stakesMultiplier: number;
      readonly tickBudgetFraction: number;
      readonly isEndgame: boolean;
      readonly phaseBoundaryMs: number;
      readonly defaultTransitionWindows: number;
    }
  >
> {
  return Object.freeze(
    Object.fromEntries(
      RUN_PHASES.map((phase) => {
        const boundary = PHASE_BOUNDARIES_MS.find((b) => b.phase === phase);
        const transitionWindows = isEndgamePhase(phase)
          ? DEFAULT_PHASE_TRANSITION_WINDOWS * 2
          : phase === 'ESCALATION'
            ? DEFAULT_PHASE_TRANSITION_WINDOWS
            : Math.floor(DEFAULT_PHASE_TRANSITION_WINDOWS * 0.6);

        return [
          phase,
          {
            normalized: RUN_PHASE_NORMALIZED[phase],
            stakesMultiplier: RUN_PHASE_STAKES_MULTIPLIER[phase],
            tickBudgetFraction: RUN_PHASE_TICK_BUDGET_FRACTION[phase],
            isEndgame: isEndgamePhase(phase),
            phaseBoundaryMs: boundary?.startsAtMs ?? 0,
            defaultTransitionWindows: transitionWindows,
          },
        ];
      }),
    ) as Record<
      RunPhase,
      {
        normalized: number;
        stakesMultiplier: number;
        tickBudgetFraction: number;
        isEndgame: boolean;
        phaseBoundaryMs: number;
        defaultTransitionWindows: number;
      }
    >,
  );
}

/**
 * Compute a quick risk assessment for a given tier, pressure score, and mode.
 * Standalone — does not require an emitter instance.
 * Uses computePressureRiskScore, PRESSURE_TIER_URGENCY_LABEL,
 * describePressureTierExperience, MODE_DIFFICULTY_MULTIPLIER.
 */
export function assessPressureRisk(
  tier: PressureTier,
  score: number,
  mode: ModeCode,
): {
  readonly riskScore: number;
  readonly urgencyLabel: string;
  readonly experience: string;
  readonly effectiveDifficulty: number;
} {
  const riskScore = computePressureRiskScore(tier, score);
  const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
  const experience = describePressureTierExperience(tier);
  const effectiveDifficulty =
    MODE_DIFFICULTY_MULTIPLIER[mode] * (1 + riskScore);

  return {
    riskScore: roundScore(riskScore),
    urgencyLabel,
    experience,
    effectiveDifficulty: roundScore(effectiveDifficulty),
  };
}

/**
 * Compute a full transition analysis for a given pressure tier and score.
 * Uses PRESSURE_TIERS, canEscalatePressure, canDeescalatePressure,
 * pressureTierToTickTier, computePressureRiskScore.
 */
export function analyzeTransition(
  currentTier: PressureTier,
  pressureScore: number,
  ticksInTier: number,
): {
  readonly nextTier: Nullable<PressureTier>;
  readonly prevTier: Nullable<PressureTier>;
  readonly canEscalate: boolean;
  readonly canDeescalate: boolean;
  readonly currentTickTier: TickTier;
  readonly riskScore: number;
} {
  const tierIndex = PRESSURE_TIERS.indexOf(currentTier);

  const nextTier: Nullable<PressureTier> =
    tierIndex < PRESSURE_TIERS.length - 1
      ? PRESSURE_TIERS[tierIndex + 1] ?? null
      : null;

  const prevTier: Nullable<PressureTier> =
    tierIndex > 0 ? PRESSURE_TIERS[tierIndex - 1] ?? null : null;

  const canEscalate =
    nextTier !== null &&
    canEscalatePressure(currentTier, nextTier, pressureScore, ticksInTier);

  const canDeescalate =
    prevTier !== null &&
    canDeescalatePressure(currentTier, prevTier, pressureScore);

  const currentTickTier = pressureTierToTickTier(currentTier);
  const riskScore = computePressureRiskScore(currentTier, pressureScore);

  return {
    nextTier,
    prevTier,
    canEscalate,
    canDeescalate,
    currentTickTier,
    riskScore: roundScore(riskScore),
  };
}

/**
 * Determine whether a given emission kind and context should be routed to
 * the LIVEOPS_SHADOW chat lane.
 *
 * Uses PRESSURE_TIERS, MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR.
 */
export function shouldRouteToChatLane(
  kind: EmissionEventKind,
  mode: ModeCode,
  pressureTier: PressureTier,
): boolean {
  const tierIndex = PRESSURE_TIERS.indexOf(pressureTier);
  const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
  const tensionFloor = MODE_TENSION_FLOOR[mode];

  // High pressure or high difficulty always routes to chat
  if (tierIndex >= 3 || difficulty >= 1.4) return true;
  if (tensionFloor >= 0.35) return true;

  // Phase windows, pressure changes, and run starts always route
  if (
    kind === 'mode.phase_window.opened' ||
    kind === 'pressure.changed' ||
    kind === 'run.started'
  ) {
    return true;
  }

  return false;
}

/**
 * Returns the canonical LIVEOPS_SHADOW chat channel constant.
 * Exported for use by chat adapters wiring into the time event lane.
 */
export function getLiveOpsChatChannel(): typeof LIVEOPS_CHAT_CHANNEL {
  return LIVEOPS_CHAT_CHANNEL;
}

/**
 * Build a complete narrative context from a RunStateSnapshot and pressure score.
 * Convenience utility for callers that have a snapshot but not individual fields.
 */
export function buildNarrativeContextFromSnapshot(
  snapshot: RunStateSnapshot,
  pressureScore: number,
  pressureTier: PressureTier = 'T1',
  outcome: Nullable<RunOutcome> = null,
): NarrativeContext {
  return {
    pressureTier,
    phase: snapshot.phase,
    mode: snapshot.mode,
    outcome,
    tick: snapshot.tick,
    pressureScore,
  };
}
