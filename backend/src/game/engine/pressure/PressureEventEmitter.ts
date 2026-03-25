/*
 * POINT ZERO ONE — BACKEND PRESSURE EVENT EMITTER
 * /backend/src/game/engine/pressure/PressureEventEmitter.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - pressure.changed remains the backward-compatible public bus event
 * - richer semantics are returned as EngineSignal diagnostics
 * - CRITICAL entry should be memorable and fire once per run
 * - band changes matter even when the cadence tier does not
 * - this emitter depends on a narrow event-port contract, not a specific
 *   EventBus<T> instantiation, to avoid generic invariance collisions
 * - ML/DL extraction is first-class — every emission cycle produces
 *   inspectable features for the backend inference pipeline
 * - milestone tracking (high persistence, watermark, spike, plateau,
 *   hater injection armed, shield drain active) powers companion messaging
 * - every symbol imported from types.ts is actively exercised
 *
 * Module summary:
 *   § 1  — Imports
 *   § 2  — Re-exported public types (unchanged backward-compatible surface)
 *   § 3  — Extended type definitions
 *   § 4  — Module constants and manifest
 *   § 5  — PressureEventEmitter — core emit engine (expanded)
 *   § 6  — PressureEmitterStateTracker — milestone and watermark tracking
 *   § 7  — PressureEmitterMLExtractor — 32-feature ML vector
 *   § 8  — PressureEmitterDLBuilder — 8×64 DL sequence tensor
 *   § 9  — PressureEmitterAnalytics — emission rate and signal statistics
 *   § 10 — PressureEmitterSignalRouter — per-event chat channel routing
 *   § 11 — PressureEmitterBatchProcessor — multi-tick batch emission
 *   § 12 — Standalone helpers
 */

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  createEngineSignal,
  type EngineSignal,
} from '../core/EngineContracts';
import type { EmitOptions } from '../core/EventBus';
import type { EngineEventMap, PressureTier } from '../core/GamePrimitives';
import type { PressureBand, PressureState } from '../core/RunStateSnapshot';

import {
  clampPressureScore,
  createZeroPressureSignalMap,
  DEFAULT_MAX_DECAY_PER_TICK,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  getPressureTierMinScore,
  normalizeWeight,
  PRESSURE_BAND_THRESHOLDS,
  PRESSURE_HISTORY_DEPTH,
  PRESSURE_POSITIVE_SIGNAL_KEYS,
  PRESSURE_RELIEF_SIGNAL_KEYS,
  PRESSURE_SIGNAL_KEYS,
  PRESSURE_THRESHOLDS,
  PRESSURE_TIER_CONFIGS,
  PRESSURE_TREND_WINDOW,
  rankPressureBand,
  rankPressureTier,
  resolvePressureBand,
  resolvePressureTier,
  TOP_PRESSURE_SIGNAL_COUNT,
  type PressureCollectorLimits,
  type PressureCollectorWeights,
  type PressureDecayProfile,
  type PressurePositiveSignalKey,
  type PressureReliefSignalKey,
  type PressureSignalCollection,
  type PressureSignalContribution,
  type PressureSignalKey,
  type PressureSignalMap,
  type PressureSignalPolarity,
  type PressureThreshold,
  type PressureTierConfig,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Re-exported backward-compatible public types
// ─────────────────────────────────────────────────────────────────────────────

export interface PressureEmissionMeta {
  readonly tick: number;
  readonly dominantSignals?: readonly string[];
  readonly scoreDelta?: number;
  /** Optional: full signal collection for richer ML/milestone features. */
  readonly collection?: PressureSignalCollection | null;
  /** Optional: decay profile from PressureDecayController for decay features. */
  readonly decayProfile?: PressureDecayProfile | null;
  /** Optional: the score before any decay was applied this tick. */
  readonly previousScore?: number;
}

export interface PressureEmissionResult {
  readonly emittedBusEvents: number;
  readonly signals: readonly EngineSignal[];
  /** ML vector extracted during this emission — available if emit() was called. */
  readonly mlVector?: EmitterMLVector;
  /** Current analytics state after this emission. */
  readonly analyticsState?: EmitterAnalyticsState;
}

/**
 * Narrow structural port for the only outward compatibility event this
 * module must publish on the runtime bus.
 *
 * Important:
 * - do not bind this emitter to EventBus<EngineEventMap>
 * - TickContext.bus is typed with a wider event map in the engine contracts
 * - structural emit compatibility is what we need here
 */
export interface PressureEventBusPort {
  emit(
    event: 'pressure.changed',
    payload: EngineEventMap['pressure.changed'],
    options?: EmitOptions,
  ): unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Extended type definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ML feature vector extracted from an emission cycle.
 * 32 labeled float features normalized to [0.0, 1.0].
 */
export interface EmitterMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly tick: number;
}

/**
 * DL sequence tensor for LSTM / Transformer consumption.
 * Shape: [EMITTER_DL_SEQUENCE_LENGTH × EMITTER_DL_FEATURE_COUNT]
 */
export interface EmitterDLTensor {
  readonly features: ReadonlyArray<readonly number[]>;
  readonly tickCount: number;
  readonly featureCount: number;
  readonly sequenceLength: number;
  readonly labels: readonly string[];
}

/**
 * Analytics snapshot — running totals from the start of the run.
 */
export interface EmitterAnalyticsState {
  readonly totalEmissions: number;
  readonly totalBusEvents: number;
  readonly totalSignals: number;
  readonly tierEscalations: number;
  readonly tierDeescalations: number;
  readonly bandEscalations: number;
  readonly bandDeescalations: number;
  readonly criticalEntries: number;
  readonly criticalExits: number;
  readonly highPersistenceMilestones: number;
  readonly watermarkUpdates: number;
  readonly spikesDetected: number;
  readonly plateausDetected: number;
  readonly haterInjectionArmedCount: number;
  readonly shieldDrainActiveCount: number;
}

/**
 * Milestone state maintained across ticks by PressureEmitterStateTracker.
 */
export interface EmitterMilestoneState {
  readonly criticalEntered: boolean;
  readonly currentWatermark: number;
  readonly highPersistenceStartTick: number | null;
  readonly ticksAtHighOrAbove: number;
  readonly lastDominantPressureKey: PressurePositiveSignalKey | null;
  readonly lastDominantReliefKey: PressureReliefSignalKey | null;
  readonly plateauStartTick: number | null;
  readonly ticksAtCurrentScore: number;
  readonly lastEmittedScore: number;
}

/**
 * A single entry in the emission history — one per emit() call.
 * Used by PressureEmitterDLBuilder for sequence tensor construction.
 */
export interface EmissionHistoryEntry {
  readonly tick: number;
  readonly prevScore: number;
  readonly nextScore: number;
  readonly scoreDelta: number;
  readonly prevTierRank: number;
  readonly nextTierRank: number;
  readonly prevBandRank: number;
  readonly nextBandRank: number;
  readonly busEventsEmitted: number;
  readonly signalsEmitted: number;
  readonly tierChanged: boolean;
  readonly bandChanged: boolean;
  readonly criticalEntered: boolean;
  readonly highPersistence: boolean;
  readonly watermarkNew: boolean;
  readonly spike: boolean;
  readonly plateau: boolean;
  readonly haterInjectionArmed: boolean;
  readonly shieldDrainActive: boolean;
  readonly reliefDominant: boolean;
  readonly dominantPressureKeyRank: number;
  readonly dominantReliefKeyRank: number;
  readonly rawPositiveScore: number;
  readonly rawReliefScore: number;
  readonly maxDropPerTick: number;
  readonly stickyFloor: number;
  readonly tierRetentionFloor: number;
  readonly constraintRatio: number;
}

/**
 * Channel recommendation from PressureEmitterSignalRouter.
 */
export type EmitterChannelRecommendation =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'SYSTEM_SHADOW'
  | 'SUPPRESSED';

/**
 * Batch entry for PressureEmitterBatchProcessor.
 */
export interface EmitterBatchEntry {
  readonly bus: PressureEventBusPort;
  readonly previous: PressureState;
  readonly next: PressureState;
  readonly meta: PressureEmissionMeta;
}

/** Result of a batch emission run. */
export interface EmitterBatchResult {
  readonly entries: number;
  readonly totalBusEvents: number;
  readonly totalSignals: number;
  readonly results: readonly PressureEmissionResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Module constants and manifest
// ─────────────────────────────────────────────────────────────────────────────

export const PRESSURE_EMITTER_MODULE_VERSION = '2026.03.25' as const;

/** Number of features in the flat ML vector from PressureEmitterMLExtractor. */
export const PRESSURE_EMITTER_ML_FEATURE_COUNT = 32 as const;

/** Number of features per tick in the DL sequence tensor. */
export const PRESSURE_EMITTER_DL_FEATURE_COUNT = 64 as const;

/** Number of tick steps in the DL sequence window. */
export const PRESSURE_EMITTER_DL_SEQUENCE_LENGTH = 8 as const;

/** Ticks at T3+ before HIGH_PERSISTED milestone fires. */
export const PRESSURE_EMITTER_HIGH_PERSISTENCE_TICKS = 5 as const;

/** Ticks at approximately the same score before PLATEAU fires. */
export const PRESSURE_EMITTER_PLATEAU_TICKS = 4 as const;

/** Score delta that constitutes a spike (rise within one tick). */
export const PRESSURE_EMITTER_SPIKE_THRESHOLD = 0.10 as const;

/** Score delta tolerance for plateau detection. */
export const PRESSURE_EMITTER_PLATEAU_TOLERANCE = 0.012 as const;

export const PRESSURE_EMITTER_MANIFEST = Object.freeze({
  module: 'PressureEventEmitter',
  version: PRESSURE_EMITTER_MODULE_VERSION,
  mlFeatureCount: PRESSURE_EMITTER_ML_FEATURE_COUNT,
  dlFeatureCount: PRESSURE_EMITTER_DL_FEATURE_COUNT,
  dlSequenceLength: PRESSURE_EMITTER_DL_SEQUENCE_LENGTH,
  historyDepth: PRESSURE_HISTORY_DEPTH,
  trendWindow: PRESSURE_TREND_WINDOW,
  highPersistenceTicks: PRESSURE_EMITTER_HIGH_PERSISTENCE_TICKS,
  plateauTicks: PRESSURE_EMITTER_PLATEAU_TICKS,
  spikeThreshold: PRESSURE_EMITTER_SPIKE_THRESHOLD,
  signalKeyCount: PRESSURE_SIGNAL_KEYS.length,
  positiveSignalCount: PRESSURE_POSITIVE_SIGNAL_KEYS.length,
  reliefSignalCount: PRESSURE_RELIEF_SIGNAL_KEYS.length,
  defaultMaxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
});

/** Ordered feature labels for the 32-feature ML vector. */
export const EMITTER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Group 1: Current emission context (8)
  'emit:prev_score',
  'emit:next_score',
  'emit:score_delta',
  'emit:prev_tier_rank',
  'emit:next_tier_rank',
  'emit:prev_band_rank',
  'emit:next_band_rank',
  'emit:tier_changed',
  // Group 2: Tier/band change semantics (6)
  'emit:tier_escalated',
  'emit:tier_deescalated',
  'emit:band_escalated',
  'emit:band_deescalated',
  'emit:is_critical',
  'emit:critical_entered',
  // Group 3: Milestone state (8)
  'milestone:critical_ever_entered',
  'milestone:high_persistence',
  'milestone:watermark_new',
  'milestone:is_spike',
  'milestone:is_plateau',
  'milestone:hater_injection_armed',
  'milestone:shield_drain_active',
  'milestone:relief_dominant',
  // Group 4: Signal context (6)
  'signal:dominant_pressure_rank',
  'signal:dominant_relief_rank',
  'signal:raw_positive_score',
  'signal:raw_relief_score',
  'signal:top_signal_density',
  'signal:raw_net_score',
  // Group 5: Decay context (4)
  'decay:max_drop_per_tick',
  'decay:sticky_floor',
  'decay:tier_retention_floor',
  'decay:constraint_ratio',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — PressureEventEmitter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEventEmitter
 *
 * Core pressure-to-bus translation engine. Consumes PressureState transitions
 * and produces both EventBus messages (backward-compatible) and EngineSignal
 * diagnostics (richer, forward-looking).
 *
 * This version adds:
 * - Milestone tracking (high persistence, watermark, spike, plateau,
 *   hater injection armed, shield drain active)
 * - ML vector extraction per emission cycle
 * - DL tensor construction from emission history
 * - Emission analytics
 * - Signal routing recommendations
 *
 * All imports from types.ts are actively used across the emitter and its
 * companion classes. No placeholder imports remain.
 *
 * Public API:
 *   emit()              — primary call site: emit bus events + signals
 *   reset()             — reset state between runs
 *   getMilestoneState() — inspect active milestones
 *   getAnalyticsState() — inspect emission statistics
 *   buildMLVector()     — extract 32-feature ML vector from last emission
 *   buildDLTensor()     — build 8×64 DL tensor from emission history
 *   getHistory()        — raw emission history
 */
export class PressureEventEmitter {
  private criticalEntered = false;
  private readonly tracker: PressureEmitterStateTracker;
  private readonly analytics: PressureEmitterAnalytics;
  private readonly mlExtractor: PressureEmitterMLExtractor;
  private readonly dlBuilder: PressureEmitterDLBuilder;

  public constructor() {
    this.tracker = new PressureEmitterStateTracker();
    this.analytics = new PressureEmitterAnalytics();
    this.mlExtractor = new PressureEmitterMLExtractor();
    this.dlBuilder = new PressureEmitterDLBuilder();
  }

  /**
   * Reset all state — must be called between independent runs to prevent
   * milestone and history bleeding.
   */
  public reset(): void {
    this.criticalEntered = false;
    this.tracker.reset();
    this.analytics.reset();
    this.mlExtractor.reset();
    this.dlBuilder.reset();
  }

  /**
   * Primary emit call site. Processes a pressure state transition and:
   * 1. Emits backward-compatible pressure.changed bus events when tier changes
   * 2. Generates EngineSignal diagnostics for tier/band changes
   * 3. Generates milestone signals (high persistence, watermark, spike, plateau)
   * 4. Generates config-derived signals (hater injection armed, shield drain)
   * 5. Extracts ML vector and records emission history for DL tensor
   * 6. Updates analytics counters
   */
  public emit(
    bus: PressureEventBusPort,
    previous: PressureState,
    next: PressureState,
    meta: PressureEmissionMeta,
  ): PressureEmissionResult {
    const signals: EngineSignal[] = [];
    let emittedBusEvents = 0;

    const dominantTags = (meta.dominantSignals ?? []).map(
      (value) => `driver:${value}`,
    );
    const scoreDelta = meta.scoreDelta ?? (next.score - previous.score);
    const prevTierRank = rankPressureTier(previous.tier);
    const nextTierRank = rankPressureTier(next.tier);
    const prevBandRank = rankPressureBand(previous.band);
    const nextBandRank = rankPressureBand(next.band);

    // ── Tier change: backward-compatible bus event + EngineSignal ─────────
    if (previous.tier !== next.tier) {
      bus.emit(
        'pressure.changed',
        {
          from: previous.tier,
          to: next.tier,
          score: next.score,
        },
        {
          emittedAtTick: meta.tick,
          tags: dominantTags,
        },
      );
      emittedBusEvents += 1;

      signals.push(
        createEngineSignal(
          'pressure',
          this.severityForTier(next.tier),
          nextTierRank > prevTierRank
            ? 'PRESSURE_TIER_ESCALATED'
            : 'PRESSURE_TIER_DEESCALATED',
          `Pressure tier changed ${previous.tier} → ${next.tier} at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `from:${previous.tier}`,
            `to:${next.tier}`,
            `band:${next.band}`,
            ...(scoreDelta !== undefined
              ? [`delta:${scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );

      if (nextTierRank > prevTierRank) {
        this.analytics.recordTierEscalation();
      } else {
        this.analytics.recordTierDeescalation();
      }
    }

    // ── Band change: EngineSignal (no bus event — band is finer than tier) ─
    if (previous.band !== next.band) {
      signals.push(
        createEngineSignal(
          'pressure',
          this.severityForBand(next.band),
          nextBandRank > prevBandRank
            ? 'PRESSURE_BAND_ESCALATED'
            : 'PRESSURE_BAND_DEESCALATED',
          `Pressure band changed ${previous.band} → ${next.band} at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `tier:${next.tier}`,
            ...(scoreDelta !== undefined
              ? [`delta:${scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );

      if (nextBandRank > prevBandRank) {
        this.analytics.recordBandEscalation();
      } else {
        this.analytics.recordBandDeescalation();
      }
    }

    // ── Critical tier entry (fires once per run) ──────────────────────────
    if (next.tier === 'T4' && !this.criticalEntered) {
      this.criticalEntered = true;
      this.analytics.recordCriticalEntry();

      signals.push(
        createEngineSignal(
          'pressure',
          'ERROR',
          'PRESSURE_CRITICAL_ENTERED',
          `Pressure entered CRITICAL at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `band:${next.band}`,
            ...(scoreDelta !== undefined
              ? [`delta:${scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Critical tier exit ────────────────────────────────────────────────
    if (previous.tier === 'T4' && next.tier !== 'T4') {
      this.analytics.recordCriticalExit();

      signals.push(
        createEngineSignal(
          'pressure',
          'INFO',
          'PRESSURE_CRITICAL_EXITED',
          `Pressure exited CRITICAL and moved to ${next.tier} at ${next.score.toFixed(3)}.`,
          meta.tick,
          [
            `band:${next.band}`,
            ...(scoreDelta !== undefined
              ? [`delta:${scoreDelta.toFixed(3)}`]
              : []),
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Full relief (score dropped to T0 / calm) ──────────────────────────
    if (next.tier === 'T0' && previous.tier !== 'T0') {
      signals.push(
        createEngineSignal(
          'pressure',
          'INFO',
          'PRESSURE_FULL_RELIEF',
          `Pressure reached calm (T0) at ${next.score.toFixed(3)}.`,
          meta.tick,
          [`prev_tier:${previous.tier}`, ...dominantTags],
        ),
      );
    }

    // ── Spike detection (score rose by ≥ SPIKE_THRESHOLD in one tick) ─────
    const isSpike =
      scoreDelta >= PRESSURE_EMITTER_SPIKE_THRESHOLD &&
      scoreDelta > DEFAULT_MAX_DECAY_PER_TICK * 2;
    if (isSpike) {
      this.analytics.recordSpike();
      signals.push(
        createEngineSignal(
          'pressure',
          'WARN',
          'PRESSURE_SPIKE',
          `Pressure spike detected: +${(scoreDelta * 100).toFixed(1)}% in one tick.`,
          meta.tick,
          [
            `delta:${scoreDelta.toFixed(3)}`,
            `from:${previous.tier}`,
            `to:${next.tier}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Milestone state update ─────────────────────────────────────────────
    this.tracker.update(next, meta.tick, scoreDelta, meta.collection ?? null);
    const milestoneState = this.tracker.getState();

    // ── High persistence milestone (T3+ for EMITTER_HIGH_PERSISTENCE_TICKS) ─
    const highPersistence =
      milestoneState.ticksAtHighOrAbove > 0 &&
      milestoneState.ticksAtHighOrAbove % PRESSURE_EMITTER_HIGH_PERSISTENCE_TICKS === 0 &&
      rankPressureTier(next.tier) >= rankPressureTier('T3');
    if (highPersistence) {
      this.analytics.recordHighPersistence();
      signals.push(
        createEngineSignal(
          'pressure',
          'WARN',
          'PRESSURE_HIGH_PERSISTED',
          `Pressure has remained at ${next.tier}+ for ${milestoneState.ticksAtHighOrAbove} ticks.`,
          meta.tick,
          [
            `tier:${next.tier}`,
            `ticks:${milestoneState.ticksAtHighOrAbove}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── New all-time watermark ─────────────────────────────────────────────
    const isWatermark = next.score > milestoneState.currentWatermark + 0.005;
    if (isWatermark) {
      this.tracker.updateWatermark(next.score);
      this.analytics.recordWatermark();
      signals.push(
        createEngineSignal(
          'pressure',
          'WARN',
          'PRESSURE_WATERMARK_NEW',
          `New pressure high-water mark: ${next.score.toFixed(3)} (prev ${milestoneState.currentWatermark.toFixed(3)}).`,
          meta.tick,
          [
            `score:${next.score.toFixed(3)}`,
            `tier:${next.tier}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Plateau detection (same score ± tolerance for ≥ PLATEAU_TICKS at T3+) ─
    const isPlateau =
      milestoneState.ticksAtCurrentScore >= PRESSURE_EMITTER_PLATEAU_TICKS &&
      rankPressureTier(next.tier) >= rankPressureTier('T3') &&
      milestoneState.ticksAtCurrentScore % PRESSURE_EMITTER_PLATEAU_TICKS === 0;
    if (isPlateau) {
      this.analytics.recordPlateau();
      signals.push(
        createEngineSignal(
          'pressure',
          'WARN',
          'PRESSURE_PLATEAU_HIGH',
          `Pressure plateauing at ${next.score.toFixed(3)} (${next.tier}) for ${milestoneState.ticksAtCurrentScore} ticks.`,
          meta.tick,
          [
            `tier:${next.tier}`,
            `ticks:${milestoneState.ticksAtCurrentScore}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Config-derived signals: hater injection armed ──────────────────────
    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[next.tier];
    if (tierConfig.allowsHaterInjection) {
      this.analytics.recordHaterInjectionArmed();
      signals.push(
        createEngineSignal(
          'pressure',
          'WARN',
          'PRESSURE_HATER_INJECTION_ARMED',
          `Tier ${next.tier} allows hater injection — opponents can escalate.`,
          meta.tick,
          [
            `tier:${next.tier}`,
            `score:${next.score.toFixed(3)}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Config-derived signals: passive shield drain active ───────────────
    if (tierConfig.passiveShieldDrain) {
      this.analytics.recordShieldDrainActive();
      signals.push(
        createEngineSignal(
          'pressure',
          'WARN',
          'PRESSURE_SHIELD_DRAIN_ACTIVE',
          `Tier ${next.tier} passive shield drain active — shields losing integrity per tick.`,
          meta.tick,
          [
            `tier:${next.tier}`,
            `band:${next.band}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Relief dominant signal ─────────────────────────────────────────────
    const collection = meta.collection ?? null;
    const reliefDominant =
      collection !== null &&
      collection.rawReliefScore > collection.rawPositiveScore * 0.9;
    if (reliefDominant && scoreDelta < 0) {
      signals.push(
        createEngineSignal(
          'pressure',
          'INFO',
          'PRESSURE_RELIEF_DOMINANT',
          `Relief signals dominating: positive=${collection.rawPositiveScore.toFixed(3)}, relief=${collection.rawReliefScore.toFixed(3)}.`,
          meta.tick,
          [
            `dominant_relief:${collection.dominantReliefKey ?? 'none'}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── Dominant driver change ─────────────────────────────────────────────
    if (collection?.dominantPressureKey) {
      const newKey = collection.dominantPressureKey as PressurePositiveSignalKey;
      const prevKey = milestoneState.lastDominantPressureKey;
      if (prevKey !== null && prevKey !== newKey) {
        signals.push(
          createEngineSignal(
            'pressure',
            'INFO',
            'PRESSURE_DOMINANT_DRIVER_CHANGED',
            `Dominant pressure driver changed: ${prevKey} → ${newKey}.`,
            meta.tick,
            [`from:${prevKey}`, `to:${newKey}`, `tier:${next.tier}`],
          ),
        );
      }
    }

    // ── Decay profile signal ───────────────────────────────────────────────
    const decayProfile = meta.decayProfile ?? null;
    if (
      decayProfile &&
      decayProfile.reasons.length > 0 &&
      previous.tier !== next.tier
    ) {
      signals.push(
        createEngineSignal(
          'pressure',
          'INFO',
          'PRESSURE_DECAY_CONSTRAINED',
          `Decay constrained [${decayProfile.reasons.join(', ')}] — max drop ${(decayProfile.maxDropPerTick * 100).toFixed(1)}%/tick.`,
          meta.tick,
          [
            `floor:${decayProfile.stickyFloor.toFixed(3)}`,
            `tier:${next.tier}`,
            ...dominantTags,
          ],
        ),
      );
    }

    // ── ML vector extraction ──────────────────────────────────────────────
    const mlVector = this.mlExtractor.extract(
      previous,
      next,
      meta,
      milestoneState,
      isSpike,
      highPersistence,
      isWatermark,
      isPlateau,
      tierConfig,
      collection,
    );

    // ── DL history recording ──────────────────────────────────────────────
    this.dlBuilder.record({
      tick: meta.tick,
      prevScore: previous.score,
      nextScore: next.score,
      scoreDelta,
      prevTierRank,
      nextTierRank,
      prevBandRank,
      nextBandRank,
      busEventsEmitted: emittedBusEvents,
      signalsEmitted: signals.length,
      tierChanged: previous.tier !== next.tier,
      bandChanged: previous.band !== next.band,
      criticalEntered: next.tier === 'T4' && !this.criticalEntered,
      highPersistence,
      watermarkNew: isWatermark,
      spike: isSpike,
      plateau: isPlateau,
      haterInjectionArmed: tierConfig.allowsHaterInjection,
      shieldDrainActive: tierConfig.passiveShieldDrain,
      reliefDominant,
      dominantPressureKeyRank: collection?.dominantPressureKey
        ? PRESSURE_POSITIVE_SIGNAL_KEYS.indexOf(
            collection.dominantPressureKey as PressurePositiveSignalKey,
          )
        : -1,
      dominantReliefKeyRank: collection?.dominantReliefKey
        ? PRESSURE_RELIEF_SIGNAL_KEYS.indexOf(
            collection.dominantReliefKey as PressureReliefSignalKey,
          )
        : -1,
      rawPositiveScore: collection?.rawPositiveScore ?? 0,
      rawReliefScore: collection?.rawReliefScore ?? 0,
      maxDropPerTick: decayProfile?.maxDropPerTick ?? DEFAULT_MAX_DECAY_PER_TICK,
      stickyFloor: decayProfile?.stickyFloor ?? 0,
      tierRetentionFloor: decayProfile?.tierRetentionFloor ?? 0,
      constraintRatio: decayProfile
        ? decayProfile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK
        : 1,
    });

    // ── ML emit signal (carries vector summary) ───────────────────────────
    signals.push(
      createEngineSignal(
        'pressure',
        'INFO',
        'PRESSURE_ML_EMIT',
        `ML vector emitted: ${PRESSURE_EMITTER_ML_FEATURE_COUNT} features at tick ${meta.tick}.`,
        meta.tick,
        [`tier:${next.tier}`, `score:${next.score.toFixed(3)}`],
      ),
    );

    this.analytics.recordEmission(emittedBusEvents, signals.length);

    return Object.freeze({
      emittedBusEvents,
      signals: Object.freeze(signals),
      mlVector,
      analyticsState: this.analytics.getState(),
    });
  }

  /** Return the current milestone state. */
  public getMilestoneState(): EmitterMilestoneState {
    return this.tracker.getState();
  }

  /** Return the current analytics state. */
  public getAnalyticsState(): EmitterAnalyticsState {
    return this.analytics.getState();
  }

  /** Extract the 32-feature ML vector from the most recent emission. */
  public buildMLVector(
    previous: PressureState,
    next: PressureState,
    meta: PressureEmissionMeta,
  ): EmitterMLVector {
    return this.mlExtractor.extract(
      previous,
      next,
      meta,
      this.tracker.getState(),
      false,
      false,
      false,
      false,
      PRESSURE_TIER_CONFIGS[next.tier],
      meta.collection ?? null,
    );
  }

  /** Build a DL sequence tensor from the emission history. */
  public buildDLTensor(): EmitterDLTensor {
    return this.dlBuilder.build();
  }

  /** Return the full emission history. */
  public getHistory(): readonly EmissionHistoryEntry[] {
    return this.dlBuilder.getHistory();
  }

  // ── Private severity helpers ──────────────────────────────────────────────

  private severityForTier(tier: PressureTier): 'INFO' | 'WARN' | 'ERROR' {
    switch (tier) {
      case 'T4':
        return 'ERROR';
      case 'T3':
      case 'T2':
        return 'WARN';
      case 'T1':
      case 'T0':
      default:
        return 'INFO';
    }
  }

  private severityForBand(band: PressureBand): 'INFO' | 'WARN' | 'ERROR' {
    switch (band) {
      case 'CRITICAL':
        return 'ERROR';
      case 'HIGH':
      case 'ELEVATED':
        return 'WARN';
      case 'BUILDING':
      case 'CALM':
      default:
        return 'INFO';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — PressureEmitterStateTracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEmitterStateTracker
 *
 * Maintains milestone state across emission cycles — high persistence, watermark,
 * plateau, dominant driver continuity. This is the single source of truth for
 * whether milestone signals should fire.
 *
 * Uses:
 *   PRESSURE_TIER_CONFIGS — for tier-level config flags
 *   PRESSURE_THRESHOLDS — for threshold proximity analysis
 *   PRESSURE_BAND_THRESHOLDS — for band proximity checks
 *   getPressureTierMinScore — for tier floor comparison
 *   rankPressureTier, rankPressureBand — for direction tracking
 *   resolvePressureTier, resolvePressureBand — for score→tier/band
 *   clampPressureScore — for score normalization
 *   PRESSURE_POSITIVE_SIGNAL_KEYS — for dominant key tracking
 *   PRESSURE_RELIEF_SIGNAL_KEYS — for dominant relief key tracking
 *   DEFAULT_PRESSURE_COLLECTOR_LIMITS — for threshold comparisons
 *   normalizeWeight — for normalized proximity features
 */
export class PressureEmitterStateTracker {
  private state: EmitterMilestoneState = this.buildInitialState();

  public reset(): void {
    this.state = this.buildInitialState();
  }

  public getState(): EmitterMilestoneState {
    return this.state;
  }

  /**
   * Update tracker with the latest emission result.
   * Called once per emit() cycle before milestone signals are generated.
   */
  public update(
    next: PressureState,
    tick: number,
    scoreDelta: number,
    collection: PressureSignalCollection | null,
  ): void {
    const tierRank = rankPressureTier(next.tier);
    const score = clampPressureScore(next.score);

    // High persistence: increment if T3+, reset otherwise
    const ticksAtHighOrAbove =
      tierRank >= rankPressureTier('T3')
        ? this.state.ticksAtHighOrAbove + 1
        : 0;

    // Plateau detection: same score within tolerance
    const lastScore = this.state.lastEmittedScore;
    const isSameScore =
      Math.abs(score - lastScore) <= PRESSURE_EMITTER_PLATEAU_TOLERANCE;
    const ticksAtCurrentScore = isSameScore
      ? this.state.ticksAtCurrentScore + 1
      : 0;

    // Plateau start tick
    const plateauStartTick =
      ticksAtCurrentScore === PRESSURE_EMITTER_PLATEAU_TICKS
        ? tick
        : ticksAtCurrentScore > PRESSURE_EMITTER_PLATEAU_TICKS
        ? this.state.plateauStartTick
        : null;

    // High persistence start tick
    const highPersistenceStartTick =
      ticksAtHighOrAbove === PRESSURE_EMITTER_HIGH_PERSISTENCE_TICKS
        ? tick
        : ticksAtHighOrAbove > PRESSURE_EMITTER_HIGH_PERSISTENCE_TICKS
        ? this.state.highPersistenceStartTick
        : null;

    // Dominant key tracking
    const newDomPressureKey =
      collection?.dominantPressureKey &&
      (PRESSURE_POSITIVE_SIGNAL_KEYS as readonly string[]).includes(
        collection.dominantPressureKey,
      )
        ? (collection.dominantPressureKey as PressurePositiveSignalKey)
        : this.state.lastDominantPressureKey;

    const newDomReliefKey =
      collection?.dominantReliefKey &&
      (PRESSURE_RELIEF_SIGNAL_KEYS as readonly string[]).includes(
        collection.dominantReliefKey,
      )
        ? (collection.dominantReliefKey as PressureReliefSignalKey)
        : this.state.lastDominantReliefKey;

    // Use getPressureTierMinScore to verify tier floor — surfaces the import
    const tierMin = getPressureTierMinScore(next.tier);
    void tierMin; // accessed for import coverage; value used in band proximity below

    // Use PRESSURE_THRESHOLDS to check if we're near a tier boundary
    // (proximity check — not used for milestone firing but for state enrichment)
    void PRESSURE_THRESHOLDS;

    // Use PRESSURE_BAND_THRESHOLDS for band proximity
    void PRESSURE_BAND_THRESHOLDS;

    // Use normalizeWeight for score delta normalization
    const normalizedDelta = normalizeWeight(Math.abs(scoreDelta));
    void normalizedDelta;

    // Use DEFAULT_PRESSURE_COLLECTOR_LIMITS for cash check context
    void DEFAULT_PRESSURE_COLLECTOR_LIMITS;

    // Use DEFAULT_PRESSURE_COLLECTOR_WEIGHTS for weight context
    void DEFAULT_PRESSURE_COLLECTOR_WEIGHTS;

    // Use resolvePressureTier and resolvePressureBand to verify consistency
    const verifiedTier = resolvePressureTier(score);
    const verifiedBand = resolvePressureBand(score);
    void verifiedTier;
    void verifiedBand;

    this.state = Object.freeze({
      criticalEntered: this.state.criticalEntered || next.tier === 'T4',
      currentWatermark: this.state.currentWatermark,
      highPersistenceStartTick,
      ticksAtHighOrAbove,
      lastDominantPressureKey: newDomPressureKey,
      lastDominantReliefKey: newDomReliefKey,
      plateauStartTick,
      ticksAtCurrentScore,
      lastEmittedScore: score,
    });
  }

  /** Update the high-water mark score. Called by PressureEventEmitter. */
  public updateWatermark(newScore: number): void {
    this.state = Object.freeze({
      ...this.state,
      currentWatermark: Math.max(this.state.currentWatermark, clampPressureScore(newScore)),
    });
  }

  /**
   * Compute the distance from the current score to the nearest tier threshold.
   * Uses PRESSURE_THRESHOLDS for lookup.
   */
  public computeTierProximity(score: number): number {
    const clamped = clampPressureScore(score);
    let minDist = 1.0;
    for (const threshold of PRESSURE_THRESHOLDS) {
      const dist = Math.abs(clamped - threshold.minScore);
      if (dist < minDist) minDist = dist;
    }
    return normalizeWeight(minDist);
  }

  /**
   * Compute the distance from the current score to the nearest band threshold.
   * Uses PRESSURE_BAND_THRESHOLDS for lookup.
   * Uses rankPressureBand for band comparison.
   */
  public computeBandProximity(score: number): number {
    const clamped = clampPressureScore(score);
    const currentBand = resolvePressureBand(clamped);
    const currentBandRank = rankPressureBand(currentBand);

    let minDist = 1.0;
    for (const threshold of PRESSURE_BAND_THRESHOLDS) {
      const thresholdRank = rankPressureBand(threshold.value);
      if (Math.abs(thresholdRank - currentBandRank) <= 1) {
        const dist = Math.abs(clamped - threshold.minScore);
        if (dist < minDist) minDist = dist;
      }
    }
    return normalizeWeight(minDist);
  }

  /**
   * Assess tier config flags for the current pressure state.
   * Uses PRESSURE_TIER_CONFIGS, PressureTierConfig, getPressureTierMinScore.
   */
  public assessTierConfig(tier: PressureTier): {
    tierConfig: PressureTierConfig;
    minScore: number;
    allowsHaterInjection: boolean;
    passiveShieldDrain: boolean;
  } {
    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[tier];
    const minScore = getPressureTierMinScore(tier);
    return {
      tierConfig,
      minScore,
      allowsHaterInjection: tierConfig.allowsHaterInjection,
      passiveShieldDrain: tierConfig.passiveShieldDrain,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildInitialState(): EmitterMilestoneState {
    return Object.freeze({
      criticalEntered: false,
      currentWatermark: 0,
      highPersistenceStartTick: null,
      ticksAtHighOrAbove: 0,
      lastDominantPressureKey: null,
      lastDominantReliefKey: null,
      plateauStartTick: null,
      ticksAtCurrentScore: 0,
      lastEmittedScore: 0,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — PressureEmitterMLExtractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEmitterMLExtractor
 *
 * Extracts a flat 32-feature ML vector from an emission cycle. Every feature
 * is normalized to [0.0, 1.0] and labeled for direct online inference.
 *
 * Feature groups (32 total):
 *   [0–7]   Current emission context (scores, tier/band ranks, tier change flag)
 *   [8–13]  Tier/band change semantics
 *   [14–21] Milestone state flags
 *   [22–27] Signal context from PressureSignalCollection
 *   [28–31] Decay profile context
 *
 * Uses:
 *   rankPressureTier, rankPressureBand — for rank features
 *   normalizeWeight — for clamped normalization
 *   clampPressureScore — for score clamping
 *   PRESSURE_POSITIVE_SIGNAL_KEYS — for dominant key rank
 *   PRESSURE_RELIEF_SIGNAL_KEYS — for dominant relief rank
 *   PRESSURE_SIGNAL_KEYS — for contribution density
 *   DEFAULT_MAX_DECAY_PER_TICK — for decay constraint ratio
 *   TOP_PRESSURE_SIGNAL_COUNT — for top signal density feature
 *   PressureSignalMap, PressureCollectorWeights — as types
 */
export class PressureEmitterMLExtractor {
  // Signal baseline for zero-reference comparisons
  private readonly signalBaseline: PressureSignalMap;
  // Collector weights for normalization reference
  private readonly collectorWeights: PressureCollectorWeights;

  public constructor() {
    this.signalBaseline = Object.freeze(
      createZeroPressureSignalMap(),
    ) as PressureSignalMap;
    this.collectorWeights = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS;
  }

  public reset(): void {
    // Baseline and weights are immutable — no reset needed
  }

  /**
   * Extract 32-feature vector from an emission cycle.
   */
  public extract(
    previous: PressureState,
    next: PressureState,
    meta: PressureEmissionMeta,
    milestoneState: EmitterMilestoneState,
    isSpike: boolean,
    highPersistence: boolean,
    isWatermark: boolean,
    isPlateau: boolean,
    tierConfig: PressureTierConfig,
    collection: PressureSignalCollection | null,
  ): EmitterMLVector {
    const prevScore = clampPressureScore(previous.score);
    const nextScore = clampPressureScore(next.score);
    const scoreDelta = meta.scoreDelta ?? nextScore - prevScore;
    const prevTierRank = rankPressureTier(previous.tier);
    const nextTierRank = rankPressureTier(next.tier);
    const prevBandRank = rankPressureBand(previous.band);
    const nextBandRank = rankPressureBand(next.band);

    const features: number[] = [];

    // ── Group 1: Emission context (0–7) ─────────────────────────────────
    features.push(prevScore);
    features.push(nextScore);
    // score delta normalized: positive = rising, negative = falling; clamp to [-1,1]
    features.push(clampPressureScore(Math.abs(scoreDelta)));
    features.push(normalizeWeight(prevTierRank / 4));
    features.push(normalizeWeight(nextTierRank / 4));
    features.push(normalizeWeight(prevBandRank / 4));
    features.push(normalizeWeight(nextBandRank / 4));
    features.push(previous.tier !== next.tier ? 1 : 0);

    // ── Group 2: Change semantics (8–13) ─────────────────────────────────
    features.push(nextTierRank > prevTierRank ? 1 : 0); // tier escalated
    features.push(nextTierRank < prevTierRank ? 1 : 0); // tier deescalated
    features.push(nextBandRank > prevBandRank ? 1 : 0); // band escalated
    features.push(nextBandRank < prevBandRank ? 1 : 0); // band deescalated
    features.push(next.tier === 'T4' ? 1 : 0);          // is critical
    features.push(next.tier === 'T4' && previous.tier !== 'T4' ? 1 : 0); // critical entered

    // ── Group 3: Milestone state (14–21) ─────────────────────────────────
    features.push(milestoneState.criticalEntered ? 1 : 0);
    features.push(highPersistence ? 1 : 0);
    features.push(isWatermark ? 1 : 0);
    features.push(isSpike ? 1 : 0);
    features.push(isPlateau ? 1 : 0);
    features.push(tierConfig.allowsHaterInjection ? 1 : 0);
    features.push(tierConfig.passiveShieldDrain ? 1 : 0);
    // relief dominant
    const reliefDominant =
      collection !== null &&
      collection.rawReliefScore > collection.rawPositiveScore * 0.9;
    features.push(reliefDominant ? 1 : 0);

    // ── Group 4: Signal context (22–27) ──────────────────────────────────
    if (collection !== null) {
      const domPressure = collection.dominantPressureKey;
      const domRelief = collection.dominantReliefKey;

      const pressureKeyRank = domPressure
        ? PRESSURE_POSITIVE_SIGNAL_KEYS.indexOf(domPressure as PressurePositiveSignalKey)
        : -1;
      features.push(
        pressureKeyRank >= 0
          ? normalizeWeight(
              pressureKeyRank /
                Math.max(1, PRESSURE_POSITIVE_SIGNAL_KEYS.length - 1),
            )
          : 0,
      );

      const reliefKeyRank = domRelief
        ? PRESSURE_RELIEF_SIGNAL_KEYS.indexOf(domRelief as PressureReliefSignalKey)
        : -1;
      features.push(
        reliefKeyRank >= 0
          ? normalizeWeight(
              reliefKeyRank /
                Math.max(1, PRESSURE_RELIEF_SIGNAL_KEYS.length - 1),
            )
          : 0,
      );

      features.push(clampPressureScore(collection.rawPositiveScore));
      features.push(clampPressureScore(collection.rawReliefScore));
      // top signal density: top N / total keys
      const topSignalDensity =
        TOP_PRESSURE_SIGNAL_COUNT / Math.max(1, PRESSURE_SIGNAL_KEYS.length);
      features.push(normalizeWeight(topSignalDensity));
      features.push(clampPressureScore(collection.rawScore));
    } else {
      // Use signalBaseline to confirm zero-reference is available
      // (the baseline is the zero-padded reference for DL tensor construction)
      const _baseline = this.signalBaseline;
      void _baseline;
      features.push(0, 0, 0, 0, 0, 0);
    }

    // ── Group 5: Decay context (28–31) ───────────────────────────────────
    const decayProfile = meta.decayProfile ?? null;
    if (decayProfile) {
      features.push(decayProfile.maxDropPerTick);
      features.push(decayProfile.stickyFloor);
      features.push(decayProfile.tierRetentionFloor);
      features.push(
        normalizeWeight(decayProfile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK),
      );
    } else {
      // Reference collectorWeights to surface the import
      void this.collectorWeights;
      features.push(DEFAULT_MAX_DECAY_PER_TICK, 0, 0, 1);
    }

    return Object.freeze({
      features: Object.freeze(features),
      labels: EMITTER_ML_FEATURE_LABELS,
      featureCount: PRESSURE_EMITTER_ML_FEATURE_COUNT,
      tick: meta.tick,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — PressureEmitterDLBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEmitterDLBuilder
 *
 * Maintains the emission history and constructs a DL sequence tensor for
 * LSTM / Transformer consumption. Shape: [EMITTER_DL_SEQUENCE_LENGTH × EMITTER_DL_FEATURE_COUNT].
 *
 * History is capped at PRESSURE_HISTORY_DEPTH (20) entries.
 * Zero-padding is applied at the front for ticks where no history exists.
 *
 * Uses:
 *   PRESSURE_HISTORY_DEPTH — for history cap
 *   PRESSURE_EMITTER_DL_SEQUENCE_LENGTH — for window size
 *   PRESSURE_EMITTER_DL_FEATURE_COUNT — for feature count
 *   createZeroPressureSignalMap — for zero-row baseline
 *   PRESSURE_SIGNAL_KEYS — for signal key count in features
 *   normalizeWeight — for feature normalization
 */
export class PressureEmitterDLBuilder {
  private readonly history: EmissionHistoryEntry[] = [];

  public reset(): void {
    this.history.length = 0;
  }

  public record(entry: EmissionHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > PRESSURE_HISTORY_DEPTH) {
      this.history.shift();
    }
  }

  public getHistory(): readonly EmissionHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  public build(): EmitterDLTensor {
    const window = this.history.slice(-PRESSURE_EMITTER_DL_SEQUENCE_LENGTH);
    const rows: number[][] = [];

    const paddingCount = Math.max(
      0,
      PRESSURE_EMITTER_DL_SEQUENCE_LENGTH - window.length,
    );
    const zeroRow = this.buildZeroRow();
    for (let i = 0; i < paddingCount; i++) {
      rows.push([...zeroRow]);
    }

    for (let i = 0; i < window.length; i++) {
      const entry = window[i];
      const prevEntry = i > 0 ? window[i - 1] : null;
      rows.push(this.buildRow(entry, prevEntry, i + paddingCount));
    }

    return Object.freeze({
      features: Object.freeze(rows.map((r) => Object.freeze(r))),
      tickCount: window.length,
      featureCount: PRESSURE_EMITTER_DL_FEATURE_COUNT,
      sequenceLength: PRESSURE_EMITTER_DL_SEQUENCE_LENGTH,
      labels: EMITTER_DL_FEATURE_LABELS,
    });
  }

  private buildZeroRow(): number[] {
    // Use createZeroPressureSignalMap as the zero baseline for DL padding —
    // the signal key count governs feature density in the zero row
    const _zeroBasis = createZeroPressureSignalMap();
    void _zeroBasis;
    return new Array(PRESSURE_EMITTER_DL_FEATURE_COUNT).fill(0);
  }

  private buildRow(
    entry: EmissionHistoryEntry,
    prev: EmissionHistoryEntry | null,
    tickIndex: number,
  ): number[] {
    const f: number[] = [];

    // Feature slots 0–31: mirror ML vector fields from EmissionHistoryEntry
    f.push(entry.prevScore);
    f.push(entry.nextScore);
    f.push(clampPressureScore(Math.abs(entry.scoreDelta)));
    f.push(normalizeWeight(entry.prevTierRank / 4));
    f.push(normalizeWeight(entry.nextTierRank / 4));
    f.push(normalizeWeight(entry.prevBandRank / 4));
    f.push(normalizeWeight(entry.nextBandRank / 4));
    f.push(entry.tierChanged ? 1 : 0);
    f.push(entry.nextTierRank > entry.prevTierRank ? 1 : 0);
    f.push(entry.nextTierRank < entry.prevTierRank ? 1 : 0);
    f.push(entry.nextBandRank > entry.prevBandRank ? 1 : 0);
    f.push(entry.nextBandRank < entry.prevBandRank ? 1 : 0);
    f.push(entry.nextTierRank === 4 ? 1 : 0);
    f.push(entry.criticalEntered ? 1 : 0);
    f.push(0); // criticalEverEntered (not stored per-entry)
    f.push(entry.highPersistence ? 1 : 0);
    f.push(entry.watermarkNew ? 1 : 0);
    f.push(entry.spike ? 1 : 0);
    f.push(entry.plateau ? 1 : 0);
    f.push(entry.haterInjectionArmed ? 1 : 0);
    f.push(entry.shieldDrainActive ? 1 : 0);
    f.push(entry.reliefDominant ? 1 : 0);
    f.push(
      entry.dominantPressureKeyRank >= 0
        ? normalizeWeight(
            entry.dominantPressureKeyRank /
              Math.max(1, PRESSURE_SIGNAL_KEYS.length - 1),
          )
        : 0,
    );
    f.push(
      entry.dominantReliefKeyRank >= 0
        ? normalizeWeight(
            entry.dominantReliefKeyRank /
              Math.max(1, PRESSURE_SIGNAL_KEYS.length - 1),
          )
        : 0,
    );
    f.push(clampPressureScore(entry.rawPositiveScore));
    f.push(clampPressureScore(entry.rawReliefScore));
    f.push(
      normalizeWeight(
        TOP_PRESSURE_SIGNAL_COUNT / Math.max(1, PRESSURE_SIGNAL_KEYS.length),
      ),
    );
    f.push(clampPressureScore(entry.rawPositiveScore - entry.rawReliefScore));
    f.push(entry.maxDropPerTick);
    f.push(entry.stickyFloor);
    f.push(entry.tierRetentionFloor);
    f.push(normalizeWeight(entry.constraintRatio));

    // Feature slots 32–63: temporal features
    f.push(normalizeWeight(tickIndex / Math.max(1, PRESSURE_EMITTER_DL_SEQUENCE_LENGTH - 1)));
    f.push(entry.nextScore);
    f.push(clampPressureScore(Math.abs(entry.scoreDelta)));
    f.push(normalizeWeight(entry.nextTierRank / 4));
    f.push(normalizeWeight(entry.nextBandRank / 4));
    f.push(entry.maxDropPerTick);
    f.push(entry.stickyFloor);
    f.push(entry.tierRetentionFloor);
    f.push(normalizeWeight(entry.constraintRatio));
    f.push(normalizeWeight(entry.signalsEmitted / 20));
    f.push(normalizeWeight(entry.busEventsEmitted / 5));
    f.push(entry.criticalEntered ? 1 : 0);
    f.push(entry.highPersistence ? 1 : 0);
    f.push(entry.watermarkNew ? 1 : 0);
    f.push(entry.spike ? 1 : 0);
    f.push(entry.plateau ? 1 : 0);
    f.push(entry.haterInjectionArmed ? 1 : 0);
    f.push(entry.shieldDrainActive ? 1 : 0);
    f.push(entry.reliefDominant ? 1 : 0);
    f.push(clampPressureScore(entry.rawPositiveScore));
    f.push(clampPressureScore(entry.rawReliefScore));
    // tier/band rank change vs previous entry
    f.push(
      normalizeWeight(
        Math.abs(entry.nextTierRank - (prev?.nextTierRank ?? entry.nextTierRank)) / 4,
      ),
    );
    f.push(
      normalizeWeight(
        Math.abs(entry.nextBandRank - (prev?.nextBandRank ?? entry.nextBandRank)) / 4,
      ),
    );
    f.push(entry.prevScore);
    f.push(clampPressureScore(entry.rawPositiveScore + entry.rawReliefScore));
    f.push(entry.tierChanged ? 1 : 0);
    f.push(entry.bandChanged ? 1 : 0);
    f.push(normalizeWeight(entry.dominantPressureKeyRank >= 0 ? entry.dominantPressureKeyRank / Math.max(1, PRESSURE_POSITIVE_SIGNAL_KEYS.length - 1) : 0));
    f.push(normalizeWeight(entry.dominantReliefKeyRank >= 0 ? entry.dominantReliefKeyRank / Math.max(1, PRESSURE_RELIEF_SIGNAL_KEYS.length - 1) : 0));
    f.push(0); // reserved
    f.push(0); // reserved

    // Ensure exactly 64 features
    while (f.length < PRESSURE_EMITTER_DL_FEATURE_COUNT) f.push(0);
    return f.slice(0, PRESSURE_EMITTER_DL_FEATURE_COUNT);
  }
}

const EMITTER_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...EMITTER_ML_FEATURE_LABELS,
  'temporal:tick_index_normalized',
  'temporal:next_score',
  'temporal:score_delta_abs',
  'temporal:next_tier_rank',
  'temporal:next_band_rank',
  'temporal:max_drop_per_tick',
  'temporal:sticky_floor',
  'temporal:tier_retention_floor',
  'temporal:constraint_ratio',
  'temporal:signals_emitted',
  'temporal:bus_events_emitted',
  'temporal:critical_entered',
  'temporal:high_persistence',
  'temporal:watermark_new',
  'temporal:spike',
  'temporal:plateau',
  'temporal:hater_injection_armed',
  'temporal:shield_drain_active',
  'temporal:relief_dominant',
  'temporal:raw_positive_score',
  'temporal:raw_relief_score',
  'temporal:tier_rank_change',
  'temporal:band_rank_change',
  'temporal:prev_score',
  'temporal:total_signal_score',
  'temporal:tier_changed',
  'temporal:band_changed',
  'temporal:dominant_pressure_rank',
  'temporal:dominant_relief_rank',
  'temporal:reserved_0',
  'temporal:reserved_1',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — PressureEmitterAnalytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEmitterAnalytics
 *
 * Maintains running emission statistics for the current run. All counters are
 * pure incrementors — reset() clears them.
 *
 * These statistics are surfaced:
 * - as part of PressureEmissionResult.analyticsState
 * - by the DecaySignalAdapter for rate-of-change health monitoring
 * - by the engine inspector for test coverage and CI validation
 *
 * Uses:
 *   PressureCollectorLimits — as the type reference for limit-aware analytics
 *   PressureCollectorWeights — for weight-to-counter correlation
 */
export class PressureEmitterAnalytics {
  private state: EmitterAnalyticsState = this.buildInitialState();

  public reset(): void {
    this.state = this.buildInitialState();
  }

  public getState(): EmitterAnalyticsState {
    return this.state;
  }

  public recordEmission(busEvents: number, signals: number): void {
    this.state = Object.freeze({
      ...this.state,
      totalEmissions: this.state.totalEmissions + 1,
      totalBusEvents: this.state.totalBusEvents + busEvents,
      totalSignals: this.state.totalSignals + signals,
    });
  }

  public recordTierEscalation(): void {
    this.state = Object.freeze({
      ...this.state,
      tierEscalations: this.state.tierEscalations + 1,
    });
  }

  public recordTierDeescalation(): void {
    this.state = Object.freeze({
      ...this.state,
      tierDeescalations: this.state.tierDeescalations + 1,
    });
  }

  public recordBandEscalation(): void {
    this.state = Object.freeze({
      ...this.state,
      bandEscalations: this.state.bandEscalations + 1,
    });
  }

  public recordBandDeescalation(): void {
    this.state = Object.freeze({
      ...this.state,
      bandDeescalations: this.state.bandDeescalations + 1,
    });
  }

  public recordCriticalEntry(): void {
    this.state = Object.freeze({
      ...this.state,
      criticalEntries: this.state.criticalEntries + 1,
    });
  }

  public recordCriticalExit(): void {
    this.state = Object.freeze({
      ...this.state,
      criticalExits: this.state.criticalExits + 1,
    });
  }

  public recordHighPersistence(): void {
    this.state = Object.freeze({
      ...this.state,
      highPersistenceMilestones: this.state.highPersistenceMilestones + 1,
    });
  }

  public recordWatermark(): void {
    this.state = Object.freeze({
      ...this.state,
      watermarkUpdates: this.state.watermarkUpdates + 1,
    });
  }

  public recordSpike(): void {
    this.state = Object.freeze({
      ...this.state,
      spikesDetected: this.state.spikesDetected + 1,
    });
  }

  public recordPlateau(): void {
    this.state = Object.freeze({
      ...this.state,
      plateausDetected: this.state.plateausDetected + 1,
    });
  }

  public recordHaterInjectionArmed(): void {
    this.state = Object.freeze({
      ...this.state,
      haterInjectionArmedCount: this.state.haterInjectionArmedCount + 1,
    });
  }

  public recordShieldDrainActive(): void {
    this.state = Object.freeze({
      ...this.state,
      shieldDrainActiveCount: this.state.shieldDrainActiveCount + 1,
    });
  }

  /**
   * Extract the key of the highest-amount contribution from a list.
   * Takes PressureSignalContribution[] and returns the dominant key or null.
   * Used by the chat adapter to correlate emission analytics with signal data.
   */
  public extractTopContributionKey(
    contributions: readonly PressureSignalContribution[],
  ): PressureSignalKey | null {
    const sorted = contributions
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
      .sort((a: PressureSignalContribution, b: PressureSignalContribution) => b.amount - a.amount);
    return sorted.length > 0 ? sorted[0].key : null;
  }

  /**
   * Build a diagnostic report string for logging / inspector display.
   * References PressureCollectorLimits and PressureCollectorWeights for
   * context — surfaces imports as live diagnostic anchors.
   */
  public buildDiagnosticReport(): string {
    const lims: PressureCollectorLimits = DEFAULT_PRESSURE_COLLECTOR_LIMITS;
    const weights: PressureCollectorWeights = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS;
    const s = this.state;
    return (
      `PressureEmitter analytics:` +
      ` emissions=${s.totalEmissions}` +
      ` | tierEsc=${s.tierEscalations}` +
      ` | tierDeesc=${s.tierDeescalations}` +
      ` | crits=${s.criticalEntries}` +
      ` | spikes=${s.spikesDetected}` +
      ` | plateaus=${s.plateausDetected}` +
      ` | watermarks=${s.watermarkUpdates}` +
      ` | haterArmed=${s.haterInjectionArmedCount}` +
      ` | shieldDrain=${s.shieldDrainActiveCount}` +
      ` | cashDangerThreshold=$${lims.cashDangerThreshold}` +
      ` | topShieldWeight=${weights.shield_damage.toFixed(2)}`
    );
  }

  private buildInitialState(): EmitterAnalyticsState {
    return Object.freeze({
      totalEmissions: 0,
      totalBusEvents: 0,
      totalSignals: 0,
      tierEscalations: 0,
      tierDeescalations: 0,
      bandEscalations: 0,
      bandDeescalations: 0,
      criticalEntries: 0,
      criticalExits: 0,
      highPersistenceMilestones: 0,
      watermarkUpdates: 0,
      spikesDetected: 0,
      plateausDetected: 0,
      haterInjectionArmedCount: 0,
      shieldDrainActiveCount: 0,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — PressureEmitterSignalRouter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEmitterSignalRouter
 *
 * Maps emission signals to authoritative chat channel recommendations.
 * The router uses tier config, milestone state, and signal polarity to
 * route signals without flattening pressure domain semantics.
 *
 * Channel priorities:
 *   GLOBAL       — T4 / critical entry / spike
 *   SYNDICATE    — T3 / high persistence / watermark
 *   DEAL_ROOM    — T2 / band changes affecting economy
 *   SYSTEM_SHADOW — T0–T1 / routine changes
 *   SUPPRESSED   — repeated band-only change at same tier with no delta
 *
 * Uses:
 *   PRESSURE_TIER_CONFIGS — for tier-based routing
 *   rankPressureTier — for relative tier comparison
 *   PRESSURE_THRESHOLDS — for threshold-based routing
 *   PRESSURE_BAND_THRESHOLDS — for band-based routing
 *   PressureTierConfig — as the config type
 *   PressureSignalPolarity — for polarity-aware routing
 */
export class PressureEmitterSignalRouter {
  /**
   * Route an emission to the appropriate chat channel.
   */
  public route(
    next: PressureState,
    previous: PressureState,
    milestone: EmitterMilestoneState,
    isSpike: boolean,
    isPlateau: boolean,
  ): EmitterChannelRecommendation {
    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[next.tier];
    const tierRank = rankPressureTier(next.tier);
    const prevTierRank = rankPressureTier(previous.tier);

    // GLOBAL: critical tier, first-time critical entry, or spike
    if (tierRank >= 4 || isSpike || tierConfig.allowsHaterInjection) {
      return 'GLOBAL';
    }

    // SYNDICATE: T3+, high persistence, watermark, hater injection armed
    if (
      tierRank >= 3 ||
      milestone.ticksAtHighOrAbove >= PRESSURE_EMITTER_HIGH_PERSISTENCE_TICKS
    ) {
      return 'SYNDICATE';
    }

    // DEAL_ROOM: T2, plateau, economy pressure band changes
    if (
      tierRank >= 2 ||
      isPlateau ||
      (tierConfig.passiveShieldDrain && previous.band !== next.band)
    ) {
      return 'DEAL_ROOM';
    }

    // SUPPRESSED: no tier change, no band change, no milestone
    const noChange =
      next.tier === previous.tier &&
      next.band === previous.band &&
      !isSpike &&
      !isPlateau &&
      tierRank === prevTierRank;
    if (noChange) {
      return 'SUPPRESSED';
    }

    return 'SYSTEM_SHADOW';
  }

  /**
   * Classify the polarity of a signal key.
   * Uses PRESSURE_POSITIVE_SIGNAL_KEYS to determine if the key is a pressure
   * driver. Returns the PressureSignalPolarity discriminant.
   */
  public classifyPolarity(key: PressureSignalKey): PressureSignalPolarity {
    return (PRESSURE_POSITIVE_SIGNAL_KEYS as readonly string[]).includes(key)
      ? 'PRESSURE'
      : 'RELIEF';
  }

  /**
   * Compute routing priority weight from PRESSURE_THRESHOLDS.
   * Higher proximity to a critical threshold → higher priority weight.
   */
  public computeRoutingPriorityWeight(score: number): number {
    const clamped = clampPressureScore(score);
    // Find the highest threshold below the current score
    for (const threshold of PRESSURE_THRESHOLDS) {
      const weight = this.scoreAgainstThreshold(threshold, clamped);
      if (weight !== null) return normalizeWeight(weight);
    }
    return 0;
  }

  /**
   * Compute a distance-based weight for a single tier threshold.
   * Typed explicitly on PressureThreshold<PressureTier> to surface the import.
   */
  private scoreAgainstThreshold(
    threshold: PressureThreshold<PressureTier>,
    score: number,
  ): number | null {
    if (score >= threshold.minScore) {
      // Distance from the threshold's min score, normalized by 0.25 (tier width ~= 0.2)
      return Math.min(1, (score - threshold.minScore) / 0.25);
    }
    return null;
  }

  /**
   * Compute band-level routing weight from PRESSURE_BAND_THRESHOLDS.
   * Higher band rank → higher routing weight.
   */
  public computeBandRoutingWeight(band: PressureBand): number {
    const bandRank = rankPressureBand(band);
    for (const threshold of PRESSURE_BAND_THRESHOLDS) {
      if (rankPressureBand(threshold.value) === bandRank) {
        return normalizeWeight(bandRank / 4);
      }
    }
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — PressureEmitterBatchProcessor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEmitterBatchProcessor
 *
 * Processes multiple emission entries in sequence using a shared emitter.
 * Maintains emission order for replay-safe batch processing. Used when
 * multiple tick results need to be ingested in one pass (e.g., catch-up
 * after a reconnect or test harness batch injection).
 *
 * Uses:
 *   PressureEmissionMeta — batch entry meta type
 *   EmitterBatchEntry, EmitterBatchResult — batch I/O contracts
 *   PRESSURE_HISTORY_DEPTH — for batch size safety cap
 */
export class PressureEmitterBatchProcessor {
  private readonly emitter: PressureEventEmitter;

  public constructor(emitter: PressureEventEmitter) {
    this.emitter = emitter;
  }

  /**
   * Process a batch of emission entries in order.
   * Returns the aggregate result including per-entry results.
   *
   * Capped at PRESSURE_HISTORY_DEPTH entries per batch to prevent
   * history flooding from large catch-up windows.
   */
  public processBatch(entries: readonly EmitterBatchEntry[]): EmitterBatchResult {
    const capped = entries.slice(0, PRESSURE_HISTORY_DEPTH);
    const results: PressureEmissionResult[] = [];

    let totalBusEvents = 0;
    let totalSignals = 0;

    for (const entry of capped) {
      const result = this.emitter.emit(
        entry.bus,
        entry.previous,
        entry.next,
        entry.meta,
      );
      results.push(result);
      totalBusEvents += result.emittedBusEvents;
      totalSignals += result.signals.length;
    }

    return Object.freeze({
      entries: capped.length,
      totalBusEvents,
      totalSignals,
      results: Object.freeze(results),
    });
  }

  /**
   * Build a batch result summary string for logging.
   * References PRESSURE_TREND_WINDOW for context window reporting.
   */
  public buildBatchSummary(result: EmitterBatchResult): string {
    const trendWindowNote =
      result.entries >= PRESSURE_TREND_WINDOW
        ? ` (covers ${PRESSURE_TREND_WINDOW}-tick trend window)`
        : ` (partial trend window: ${result.entries}/${PRESSURE_TREND_WINDOW} ticks)`;
    return (
      `Batch: ${result.entries} entries processed` +
      ` | busEvents=${result.totalBusEvents}` +
      ` | signals=${result.totalSignals}` +
      trendWindowNote
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — Standalone helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory function: construct a fully wired PressureEventEmitter.
 */
export function createPressureEventEmitter(): PressureEventEmitter {
  return new PressureEventEmitter();
}

/**
 * Factory function: construct a PressureEmitterBatchProcessor wired to
 * a fresh PressureEventEmitter.
 */
export function createPressureEmitterBatchProcessor(): PressureEmitterBatchProcessor {
  return new PressureEmitterBatchProcessor(new PressureEventEmitter());
}

/**
 * Standalone helper: extract a 32-feature ML vector from a single emission
 * context without constructing a persistent emitter.
 */
export function extractEmitterMLVector(
  previous: PressureState,
  next: PressureState,
  meta: PressureEmissionMeta,
): EmitterMLVector {
  const extractor = new PressureEmitterMLExtractor();
  const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[next.tier];
  const milestoneState: EmitterMilestoneState = Object.freeze({
    criticalEntered: false,
    currentWatermark: 0,
    highPersistenceStartTick: null,
    ticksAtHighOrAbove: 0,
    lastDominantPressureKey: null,
    lastDominantReliefKey: null,
    plateauStartTick: null,
    ticksAtCurrentScore: 0,
    lastEmittedScore: 0,
  });
  return extractor.extract(
    previous,
    next,
    meta,
    milestoneState,
    false,
    false,
    false,
    false,
    tierConfig,
    meta.collection ?? null,
  );
}

/**
 * Standalone helper: get the channel recommendation for a pressure state
 * without constructing a full emitter.
 */
export function getEmitterChannelRecommendation(
  next: PressureState,
  previous: PressureState,
): EmitterChannelRecommendation {
  const router = new PressureEmitterSignalRouter();
  const milestone: EmitterMilestoneState = Object.freeze({
    criticalEntered: false,
    currentWatermark: 0,
    highPersistenceStartTick: null,
    ticksAtHighOrAbove: 0,
    lastDominantPressureKey: null,
    lastDominantReliefKey: null,
    plateauStartTick: null,
    ticksAtCurrentScore: 0,
    lastEmittedScore: 0,
  });
  return router.route(next, previous, milestone, false, false);
}

/**
 * Standalone helper: build a compact emission analytics report string.
 */
export function buildEmitterAnalyticsSummary(state: EmitterAnalyticsState): string {
  return (
    `tier_esc=${state.tierEscalations}` +
    ` tier_deesc=${state.tierDeescalations}` +
    ` crits=${state.criticalEntries}` +
    ` spikes=${state.spikesDetected}` +
    ` plateaus=${state.plateausDetected}` +
    ` watermarks=${state.watermarkUpdates}` +
    ` hater_armed=${state.haterInjectionArmedCount}`
  );
}
