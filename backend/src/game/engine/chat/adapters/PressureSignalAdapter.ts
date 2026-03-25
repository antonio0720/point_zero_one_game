/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT PRESSURE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/PressureSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates pressure-engine truth into
 * authoritative backend chat pressure signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the sovereign backend pressure engine emits pressure state changes,
 *    tier escalations, band crossings, high-persistence milestones, recovery
 *    forecasts, and ML feature vectors, what exact chat-native pressure signal
 *    should the backend chat engine ingest?"
 *
 * This file owns:
 * - PressureState and PressureSignalCollection → ChatInputEnvelope translation
 * - ML feature vector extraction for the chat lane's online inference pipeline
 * - DL tensor construction for the chat lane's sequence model pipeline
 * - Deduplication so pressure spam never floods the transcript
 * - Tier/band change routing to the right chat channel
 * - Narrative weight scoring for companion commentary prioritization
 * - Batch ingestion of multiple pressure events per tick
 * - Priority classification (CRITICAL / HIGH / MEDIUM / LOW / AMBIENT)
 * - UX label generation for companion display
 * - Risk scoring for churn/intervention model features
 * - Adapter analytics and health reporting
 *
 * It does not own:
 * - transcript mutation,
 * - NPC speech selection or hater dialogue,
 * - rate policy or moderation,
 * - socket fanout,
 * - replay persistence,
 * - or final pressure score authority (that is owned by PressureEngine).
 *
 * Design laws
 * -----------
 * - Preserve pressure words. Do not genericize them into "stress" or "tension".
 * - The adapter may describe urgency; ChatDramaOrchestrator decides if it fires.
 * - Tier escalation is always more important than band-only changes.
 * - CRITICAL tier signals must interrupt; lower tiers should not.
 * - Dedupe must prefer silence over spam at the same tier for 3+ ticks.
 * - ML/DL output must be deterministic and replay-safe.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
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

import type { PressureTier } from '../../core/GamePrimitives';
import type { PressureBand, PressureState } from '../../core/RunStateSnapshot';

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
} from '../../pressure/types';

import type {
  PressureAnnotationBundle,
  PressureDLTensor,
  PressureDecayAnalysis,
  PressureEscalationPrediction,
  PressureMLVector,
  PressureRecoveryForecast,
  PressureTrendSummary,
  PressureUXHint,
} from '../../pressure/PressureEngine';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const PRESSURE_SIGNAL_ADAPTER_VERSION = '2026.03.25' as const;
export const PRESSURE_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 48 as const;
export const PRESSURE_SIGNAL_ADAPTER_DL_FEATURE_COUNT = 96 as const;
export const PRESSURE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;
export const PRESSURE_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 32 as const;

/**
 * All event names this adapter can produce.
 * Used by AdapterSuite to route signals to the correct handler.
 */
export const PRESSURE_SIGNAL_ADAPTER_EVENT_NAMES = Object.freeze([
  'pressure.tier.escalated',
  'pressure.tier.deescalated',
  'pressure.band.escalated',
  'pressure.band.deescalated',
  'pressure.critical.entered',
  'pressure.critical.exited',
  'pressure.high.persisted',
  'pressure.watermark.new',
  'pressure.dominant.driver',
  'pressure.full.relief',
  'pressure.spike',
  'pressure.plateau.high',
  'pressure.hater.injection.armed',
  'pressure.shield.drain.active',
  'pressure.recovery.forecast',
  'pressure.escalation.proximity',
  'pressure.ml.emit',
  'pressure.dl.emit',
] as const);

export type PressureSignalAdapterEventName =
  (typeof PRESSURE_SIGNAL_ADAPTER_EVENT_NAMES)[number];

// ============================================================================
// MARK: Compat input types
// ============================================================================

/**
 * Minimal pressure snapshot compat — the adapter accepts this shape
 * so it is not tied to a specific version of RunStateSnapshot.
 */
export interface PressureSnapshotCompat {
  readonly tick: number;
  readonly mode: 'solo' | 'pvp' | 'coop' | 'ghost';
  readonly phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
  readonly pressure: PressureState;
  readonly runId?: string;
  readonly userId?: string;
}

/**
 * Full pressure signal input for a single tick.
 */
export interface PressureSignalInput {
  readonly snapshot: PressureSnapshotCompat;
  readonly collection: PressureSignalCollection;
  readonly mlVector?: PressureMLVector | null;
  readonly dlTensor?: PressureDLTensor | null;
  readonly trendSummary?: PressureTrendSummary | null;
  readonly recoveryForecast?: PressureRecoveryForecast | null;
  readonly decayAnalysis?: PressureDecayAnalysis | null;
  readonly escalationPrediction?: PressureEscalationPrediction | null;
  readonly annotationBundle?: PressureAnnotationBundle | null;
  readonly uxHint?: PressureUXHint | null;
}

// ============================================================================
// MARK: Adapter state, options, context
// ============================================================================

export interface PressureSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly suppressAmbientTiers?: boolean;
  readonly dedupeWindowTicks?: number;
  readonly maxBatchSize?: number;
  readonly enableMLEmit?: boolean;
  readonly enableDLEmit?: boolean;
  readonly logger?: PressureSignalAdapterLogger;
  readonly clock?: PressureSignalAdapterClock;
}

export interface PressureSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface PressureSignalAdapterClock {
  now(): UnixMs;
}

export interface PressureSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface PressureSignalAdapterState {
  readonly totalAdapted: number;
  readonly totalRejected: number;
  readonly totalDeduped: number;
  readonly lastAdaptedTick: number | null;
  readonly lastTierSeen: PressureTier | null;
  readonly lastBandSeen: PressureBand | null;
  readonly lastScoreSeen: number | null;
  readonly consecutiveHighTierTicks: number;
  readonly consecutiveCriticalTicks: number;
  readonly tierEscalationCount: number;
  readonly criticalEnterCount: number;
  readonly fullReliefCount: number;
  readonly dedupeWindowTicks: number;
  readonly mlEmitCount: number;
  readonly dlEmitCount: number;
}

export interface PressureSignalAdapterReport {
  readonly version: typeof PRESSURE_SIGNAL_ADAPTER_VERSION;
  readonly state: PressureSignalAdapterState;
  readonly tierDistribution: Readonly<Record<PressureTier, number>>;
  readonly bandDistribution: Readonly<Record<PressureBand, number>>;
  readonly topPressureDrivers: readonly string[];
  readonly topReliefDrivers: readonly string[];
  readonly averageScore: number;
  readonly maxScoreSeen: number;
  readonly minScoreSeen: number;
  readonly mlFeatureCount: number;
  readonly dlFeatureCount: number;
  readonly defaultWeightSummary: Readonly<Record<PressureSignalKey, number>>;
  readonly defaultLimitSummary: PressureCollectorLimits;
  readonly activeConstraints: readonly string[];
}

export interface PressureSignalAdapterArtifact {
  readonly tick: number;
  readonly eventName: PressureSignalAdapterEventName;
  readonly envelope: ChatInputEnvelope | null;
  readonly signal: ChatSignalEnvelope | null;
  readonly accepted: boolean;
  readonly deduped: boolean;
  readonly rejectionReason: string | null;
  readonly severity: PressureSignalAdapterSeverity;
  readonly priority: PressureSignalAdapterPriority;
  readonly narrativeWeight: PressureSignalAdapterNarrativeWeight;
  readonly channelRecommendation: PressureSignalAdapterChannelRecommendation;
  readonly mlVector: PressureAdapterMLVector | null;
}

export interface PressureSignalAdapterDeduped {
  readonly tick: number;
  readonly eventName: PressureSignalAdapterEventName;
  readonly reason: string;
  readonly previousTick: number;
}

export interface PressureSignalAdapterRejection {
  readonly tick: number;
  readonly eventName: PressureSignalAdapterEventName;
  readonly reason: string;
  readonly severity: PressureSignalAdapterSeverity;
}

export interface PressureSignalAdapterHistoryEntry {
  readonly tick: number;
  readonly eventName: PressureSignalAdapterEventName;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly score: number;
  readonly accepted: boolean;
  readonly deduped: boolean;
}

export type PressureSignalAdapterSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT';
export type PressureSignalAdapterPriority = 'INTERRUPT' | 'URGENT' | 'NOTABLE' | 'AMBIENT' | 'SUPPRESSED';
export type PressureSignalAdapterNarrativeWeight = 'PEAK' | 'MAJOR' | 'MODERATE' | 'MINOR' | 'NEGLIGIBLE';
export type PressureSignalAdapterChannelRecommendation =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'SYSTEM_SHADOW'
  | 'SUPPRESSED';

// ============================================================================
// MARK: Chat-native compat shapes (consumed by chat engine downstream)
// ============================================================================

export interface PressureChatSignalCompat {
  readonly eventName: PressureSignalAdapterEventName;
  readonly tick: number;
  readonly tier: PressureTier;
  readonly previousTier: PressureTier;
  readonly band: PressureBand;
  readonly previousBand: PressureBand;
  readonly score: number;
  readonly scoreDelta: number;
  readonly isEscalation: boolean;
  readonly isDeescalation: boolean;
  readonly isCritical: boolean;
  readonly isHighTier: boolean;
  readonly allowsHaterInjection: boolean;
  readonly passiveShieldDrain: boolean;
  readonly dominantPressureKey: PressurePositiveSignalKey | null;
  readonly dominantReliefKey: PressureReliefSignalKey | null;
  readonly positiveSignalCount: number;
  readonly reliefSignalCount: number;
  readonly netPressurePolarity: PressureSignalPolarity;
  readonly modeCode: 'solo' | 'pvp' | 'coop' | 'ghost';
  readonly phaseCode: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
  readonly upwardCrossings: number;
  readonly survivedHighPressureTicks: number;
  readonly maxScoreSeen: number;
}

export interface PressureMLVectorCompat {
  readonly tick: number;
  readonly featureCount: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly scoreNormalized: number;
  readonly tierRank: number;
  readonly bandRank: number;
  readonly isHighTier: boolean;
  readonly isCriticalTier: boolean;
  readonly trendVelocity: number;
  readonly trendAcceleration: number;
  readonly escalationProximity: number;
  readonly ticksToCalm: number;
  readonly riskScore: Score01;
  readonly narrativeWeight: PressureSignalAdapterNarrativeWeight;
}

export interface PressureDLTensorCompat {
  readonly tick: number;
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly inputSequenceFlat: readonly number[];
  readonly currentFrame: readonly number[];
  readonly tierOneHot: readonly number[];
  readonly bandOneHot: readonly number[];
  readonly attentionWeights: readonly number[];
  readonly labelVector: readonly number[];
}

export interface PressureForecastCompat {
  readonly tick: number;
  readonly currentTier: PressureTier;
  readonly estimatedTicksToCalm: number;
  readonly estimatedTicksToNextTierDown: number;
  readonly stickyFloor: number;
  readonly maxDropPerTick: number;
  readonly isTierLocked: boolean;
  readonly decayConstraints: readonly string[];
}

export interface PressureUXHintCompat {
  readonly tick: number;
  readonly urgencyLabel: string;
  readonly shortHook: string;
  readonly companionCommentary: string;
  readonly topDriverLabels: readonly string[];
  readonly topReliefLabels: readonly string[];
  readonly weightedExplanation: string;
  readonly chatChannel: ChatVisibleChannel | 'SYSTEM_SHADOW';
  readonly shouldInterrupt: boolean;
  readonly interruptReason: string | null;
  readonly severityClass: 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
}

export interface PressureAnnotationCompat {
  readonly tick: number;
  readonly tierLabel: string;
  readonly bandLabel: string;
  readonly compositeNote: string;
  readonly allowsHaterInjection: boolean;
  readonly passiveShieldDrain: boolean;
  readonly activeSignalCount: number;
  readonly modeSignalCount: number;
  readonly driverAnnotation: string;
  readonly reliefAnnotation: string;
}

// ============================================================================
// MARK: Adapter ML vector (chat-lane specific, not engine ML vector)
// ============================================================================

export interface PressureAdapterMLVector {
  readonly tick: number;
  readonly featureCount: number;
  readonly scoreNormalized: number;
  readonly tierRankNorm: number;
  readonly bandRankNorm: number;
  readonly scoreDeltaNorm: number;
  readonly isHighTier: 1 | 0;
  readonly isCriticalTier: 1 | 0;
  readonly allowsHaterInjection: 1 | 0;
  readonly passiveShieldDrain: 1 | 0;
  readonly positiveSignalCountNorm: number;
  readonly reliefSignalCountNorm: number;
  readonly upwardCrossingsNorm: number;
  readonly survivedHighPressureNorm: number;
  readonly maxScoreSeenNorm: number;
  readonly trendVelocityNorm: number;
  readonly trendAccelerationNorm: number;
  readonly isSpike: 1 | 0;
  readonly isPlateauAtHigh: 1 | 0;
  readonly escalationProximityNorm: number;
  readonly ticksToCalmNorm: number;
  readonly ticksToNextTierNorm: number;
  readonly stickyFloorNorm: number;
  readonly decayRatioNorm: number;
  readonly positiveFeatureVector: readonly number[];
  readonly reliefFeatureVector: readonly number[];
  readonly riskScore: number;
  readonly narrativeWeightScore: number;
  readonly modeCodeNorm: number;
  readonly phaseCodeNorm: number;
}

// ============================================================================
// MARK: Deduplicator
// ============================================================================

class PressureSignalDeduplicator {
  private readonly lastTickByEvent = new Map<PressureSignalAdapterEventName, number>();
  private readonly dedupeWindowTicks: number;
  private readonly dedupeLog: PressureSignalAdapterDeduped[] = [];

  public constructor(dedupeWindowTicks: number) {
    this.dedupeWindowTicks = Math.max(1, dedupeWindowTicks);
  }

  public shouldSuppress(
    eventName: PressureSignalAdapterEventName,
    tick: number,
  ): boolean {
    const last = this.lastTickByEvent.get(eventName);
    if (last === undefined) return false;
    return tick - last < this.dedupeWindowTicks;
  }

  public recordEmitted(
    eventName: PressureSignalAdapterEventName,
    tick: number,
  ): void {
    this.lastTickByEvent.set(eventName, tick);
  }

  public recordDeduped(
    eventName: PressureSignalAdapterEventName,
    tick: number,
  ): void {
    const previousTick = this.lastTickByEvent.get(eventName) ?? tick;
    this.dedupeLog.push({
      tick,
      eventName,
      reason: `Suppressed within ${this.dedupeWindowTicks}-tick dedupe window`,
      previousTick,
    });
    if (this.dedupeLog.length > PRESSURE_HISTORY_DEPTH * 2) {
      this.dedupeLog.shift();
    }
  }

  public getDedupeLog(): readonly PressureSignalAdapterDeduped[] {
    return Object.freeze([...this.dedupeLog]);
  }

  public reset(): void {
    this.lastTickByEvent.clear();
    this.dedupeLog.length = 0;
  }

  /**
   * CRITICAL tier events bypass deduplication — they always fire.
   */
  public isBypassEvent(eventName: PressureSignalAdapterEventName): boolean {
    return (
      eventName === 'pressure.critical.entered' ||
      eventName === 'pressure.critical.exited' ||
      eventName === 'pressure.tier.escalated'
    );
  }
}

// ============================================================================
// MARK: Priority classifier
// ============================================================================

class PressureSignalPriorityClassifier {
  public classify(
    eventName: PressureSignalAdapterEventName,
    tier: PressureTier,
    band: PressureBand,
    collection: PressureSignalCollection,
  ): PressureSignalAdapterPriority {
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);

    if (
      eventName === 'pressure.critical.entered' ||
      (tier === 'T4' && eventName === 'pressure.tier.escalated')
    ) {
      return 'INTERRUPT';
    }

    if (
      tierRank >= 3 &&
      (eventName === 'pressure.tier.escalated' ||
        eventName === 'pressure.high.persisted')
    ) {
      return 'URGENT';
    }

    if (tierRank >= 2 || bandRank >= 3) {
      return 'NOTABLE';
    }

    if (tierRank === 1 || collection.contributions.length > 3) {
      return 'AMBIENT';
    }

    return 'SUPPRESSED';
  }
}

// ============================================================================
// MARK: Narrative weight scorer
// ============================================================================

class PressureSignalNarrativeWeighter {
  public score(
    eventName: PressureSignalAdapterEventName,
    tier: PressureTier,
    band: PressureBand,
    collection: PressureSignalCollection,
    trend: PressureTrendSummary | null,
  ): PressureSignalAdapterNarrativeWeight {
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);
    const hasSpike = trend?.isSpike ?? false;
    const hasPlateauHigh = trend?.plateauAtHighTier ?? false;

    if (
      tier === 'T4' ||
      eventName === 'pressure.critical.entered' ||
      (hasSpike && tierRank >= 3)
    ) {
      return 'PEAK';
    }

    if (
      tierRank >= 3 ||
      (hasPlateauHigh && tierRank >= 2) ||
      eventName === 'pressure.high.persisted'
    ) {
      return 'MAJOR';
    }

    if (tierRank === 2 || bandRank >= 3 || collection.contributions.length >= 4) {
      return 'MODERATE';
    }

    if (tierRank === 1 || collection.contributions.length >= 2) {
      return 'MINOR';
    }

    return 'NEGLIGIBLE';
  }
}

// ============================================================================
// MARK: Channel router
// ============================================================================

class PressureSignalChannelRouter {
  public route(
    tier: PressureTier,
    mode: 'solo' | 'pvp' | 'coop' | 'ghost',
    priority: PressureSignalAdapterPriority,
    options: PressureSignalAdapterOptions,
  ): PressureSignalAdapterChannelRecommendation {
    if (priority === 'SUPPRESSED') return 'SUPPRESSED';

    const tierConfig = PRESSURE_TIER_CONFIGS[tier];

    if (tier === 'T4' || priority === 'INTERRUPT') {
      return 'GLOBAL';
    }

    if (tierConfig.allowsHaterInjection || tier === 'T3') {
      if (mode === 'coop' || mode === 'pvp') return 'SYNDICATE';
      return 'GLOBAL';
    }

    if (tier === 'T2') {
      if (mode === 'coop') return 'SYNDICATE';
      return 'SYSTEM_SHADOW';
    }

    return options.suppressAmbientTiers ? 'SUPPRESSED' : 'SYSTEM_SHADOW';
  }
}

// ============================================================================
// MARK: ML vector builder (chat-lane specific)
// ============================================================================

class PressureAdapterMLVectorBuilder {
  private static readonly MAX_CONTRIBUTIONS = 17;
  private static readonly MAX_RELIEF = 6;

  public build(
    tick: number,
    pressure: PressureState,
    collection: PressureSignalCollection,
    trend: PressureTrendSummary | null,
    forecast: PressureRecoveryForecast | null,
    decay: PressureDecayAnalysis | null,
    escalation: PressureEscalationPrediction | null,
    mode: 'solo' | 'pvp' | 'coop' | 'ghost',
    phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
  ): PressureAdapterMLVector {
    const tier = resolvePressureTier(pressure.score);
    const band = resolvePressureBand(pressure.score);
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];

    const scoreDelta = Number(
      (pressure.score - (pressure.previousTier !== pressure.tier ? 0 : pressure.score)).toFixed(6),
    );

    const positiveFeatureVector = this.buildPositiveFeatureVector(collection);
    const reliefFeatureVector = this.buildReliefFeatureVector(collection);

    const riskScore = this.computeRiskScore(
      pressure,
      collection,
      trend,
      tierConfig,
    );

    const narrativeWeightScore = this.computeNarrativeWeightScore(
      tier,
      band,
      collection,
      trend,
    );

    const modeCodeNorm = this.encodeModeNorm(mode);
    const phaseCodeNorm = this.encodePhaseNorm(phase);

    const maxTicks = 100;
    const ticksToCalm = forecast?.estimatedTicksToCalm ?? 0;
    const ticksToNextTier = forecast?.estimatedTicksToNextTierDown ?? 0;
    const stickyFloor = forecast?.decayProfile.stickyFloor ?? 0;
    const decayRatio = decay?.decayRatio ?? 1.0;

    return Object.freeze({
      tick,
      featureCount: PRESSURE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      scoreNormalized: clampPressureScore(pressure.score),
      tierRankNorm: normalizeWeight(tierRank / 4),
      bandRankNorm: normalizeWeight(bandRank / 4),
      scoreDeltaNorm: clampPressureScore(Math.abs(scoreDelta)),
      isHighTier: (tierRank >= 3) ? 1 : 0,
      isCriticalTier: tier === 'T4' ? 1 : 0,
      allowsHaterInjection: tierConfig.allowsHaterInjection ? 1 : 0,
      passiveShieldDrain: tierConfig.passiveShieldDrain ? 1 : 0,
      positiveSignalCountNorm: normalizeWeight(
        collection.contributions.length / PressureAdapterMLVectorBuilder.MAX_CONTRIBUTIONS,
      ),
      reliefSignalCountNorm: normalizeWeight(
        collection.reliefContributions.length / PressureAdapterMLVectorBuilder.MAX_RELIEF,
      ),
      upwardCrossingsNorm: normalizeWeight(
        Math.min(pressure.upwardCrossings, 20) / 20,
      ),
      survivedHighPressureNorm: normalizeWeight(
        Math.min(pressure.survivedHighPressureTicks, 50) / 50,
      ),
      maxScoreSeenNorm: clampPressureScore(pressure.maxScoreSeen),
      trendVelocityNorm: clampPressureScore(
        Math.abs(trend?.velocity ?? 0) / DEFAULT_MAX_DECAY_PER_TICK,
      ),
      trendAccelerationNorm: clampPressureScore(
        Math.abs(trend?.acceleration ?? 0) / DEFAULT_MAX_DECAY_PER_TICK,
      ),
      isSpike: (trend?.isSpike ?? false) ? 1 : 0,
      isPlateauAtHigh: (trend?.plateauAtHighTier ?? false) ? 1 : 0,
      escalationProximityNorm: clampPressureScore(
        escalation?.escalationProximity ?? 0,
      ),
      ticksToCalmNorm: normalizeWeight(Math.min(ticksToCalm, maxTicks) / maxTicks),
      ticksToNextTierNorm: normalizeWeight(
        Math.min(ticksToNextTier, maxTicks) / maxTicks,
      ),
      stickyFloorNorm: clampPressureScore(stickyFloor),
      decayRatioNorm: clampPressureScore(decayRatio),
      positiveFeatureVector: Object.freeze(positiveFeatureVector),
      reliefFeatureVector: Object.freeze(reliefFeatureVector),
      riskScore,
      narrativeWeightScore,
      modeCodeNorm,
      phaseCodeNorm,
    });
  }

  private buildPositiveFeatureVector(
    collection: PressureSignalCollection,
  ): number[] {
    const zeroMap = createZeroPressureSignalMap();
    return PRESSURE_POSITIVE_SIGNAL_KEYS.map((key) => {
      const raw = collection.pressureBreakdown[key] ?? zeroMap[key];
      const weight = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key];
      return normalizeWeight(raw / Math.max(0.001, weight));
    });
  }

  private buildReliefFeatureVector(
    collection: PressureSignalCollection,
  ): number[] {
    const zeroMap = createZeroPressureSignalMap();
    return PRESSURE_RELIEF_SIGNAL_KEYS.map((key) => {
      const raw = collection.reliefBreakdown[key] ?? zeroMap[key];
      const weight = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key];
      return normalizeWeight(raw / Math.max(0.001, weight));
    });
  }

  private computeRiskScore(
    pressure: PressureState,
    collection: PressureSignalCollection,
    trend: PressureTrendSummary | null,
    tierConfig: PressureTierConfig,
  ): number {
    let risk = clampPressureScore(pressure.score);

    if (tierConfig.allowsHaterInjection) risk = Math.min(1, risk * 1.3);
    if (tierConfig.passiveShieldDrain) risk = Math.min(1, risk * 1.2);
    if (trend?.isSpike) risk = Math.min(1, risk * 1.25);
    if (trend?.plateauAtHighTier) risk = Math.min(1, risk * 1.15);

    const reliefFraction =
      collection.rawPositiveScore > 0
        ? collection.rawReliefScore / collection.rawPositiveScore
        : 0;
    risk = risk * (1 - reliefFraction * 0.4);

    return clampPressureScore(risk) as Score01;
  }

  private computeNarrativeWeightScore(
    tier: PressureTier,
    band: PressureBand,
    collection: PressureSignalCollection,
    trend: PressureTrendSummary | null,
  ): number {
    const tierRank = rankPressureTier(tier) / 4;
    const bandRank = rankPressureBand(band) / 4;
    const spikeBonus = (trend?.isSpike ?? false) ? 0.2 : 0;
    const plateauBonus = (trend?.plateauAtHighTier ?? false) ? 0.1 : 0;
    const driverCount = Math.min(collection.contributions.length, 5) / 5;
    const base = tierRank * 0.5 + bandRank * 0.3 + driverCount * 0.2;
    return clampPressureScore(base + spikeBonus + plateauBonus);
  }

  private encodeModeNorm(mode: 'solo' | 'pvp' | 'coop' | 'ghost'): number {
    switch (mode) {
      case 'solo': return 0;
      case 'pvp': return 0.33;
      case 'coop': return 0.67;
      case 'ghost': return 1.0;
    }
  }

  private encodePhaseNorm(phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY'): number {
    switch (phase) {
      case 'FOUNDATION': return 0;
      case 'ESCALATION': return 0.5;
      case 'SOVEREIGNTY': return 1.0;
    }
  }
}

// ============================================================================
// MARK: Adapter analytics tracker
// ============================================================================

class PressureAdapterAnalytics {
  private totalAdapted = 0;
  private totalRejected = 0;
  private totalDeduped = 0;
  private lastAdaptedTick: number | null = null;
  private lastTierSeen: PressureTier | null = null;
  private lastBandSeen: PressureBand | null = null;
  private lastScoreSeen: number | null = null;
  private consecutiveHighTierTicks = 0;
  private consecutiveCriticalTicks = 0;
  private tierEscalationCount = 0;
  private criticalEnterCount = 0;
  private fullReliefCount = 0;
  private mlEmitCount = 0;
  private dlEmitCount = 0;

  private readonly tierCounts: Record<PressureTier, number> = {
    T0: 0, T1: 0, T2: 0, T3: 0, T4: 0,
  };
  private readonly bandCounts: Record<PressureBand, number> = {
    CALM: 0, BUILDING: 0, ELEVATED: 0, HIGH: 0, CRITICAL: 0,
  };
  private readonly scoreHistory: number[] = [];
  private readonly driverCounts = new Map<string, number>();
  private readonly reliefCounts = new Map<string, number>();
  private readonly dedupeWindowTicks: number;

  public constructor(dedupeWindowTicks: number) {
    this.dedupeWindowTicks = dedupeWindowTicks;
  }

  public recordAdapted(
    tick: number,
    tier: PressureTier,
    band: PressureBand,
    score: number,
    collection: PressureSignalCollection,
    eventName: PressureSignalAdapterEventName,
  ): void {
    this.totalAdapted++;
    this.lastAdaptedTick = tick;
    this.lastTierSeen = tier;
    this.lastBandSeen = band;
    this.lastScoreSeen = score;

    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    if (tierConfig.passiveShieldDrain) {
      this.consecutiveHighTierTicks++;
    } else {
      this.consecutiveHighTierTicks = 0;
    }

    if (tier === 'T4') {
      this.consecutiveCriticalTicks++;
    } else {
      this.consecutiveCriticalTicks = 0;
    }

    if (eventName === 'pressure.tier.escalated') this.tierEscalationCount++;
    if (eventName === 'pressure.critical.entered') this.criticalEnterCount++;
    if (eventName === 'pressure.full.relief') this.fullReliefCount++;

    this.tierCounts[tier]++;
    this.bandCounts[band]++;

    this.scoreHistory.push(score);
    if (this.scoreHistory.length > PRESSURE_HISTORY_DEPTH) this.scoreHistory.shift();

    for (const c of collection.contributions) {
      this.driverCounts.set(c.key, (this.driverCounts.get(c.key) ?? 0) + 1);
    }
    for (const c of collection.reliefContributions) {
      this.reliefCounts.set(c.key, (this.reliefCounts.get(c.key) ?? 0) + 1);
    }
  }

  public recordRejected(): void {
    this.totalRejected++;
  }

  public recordDeduped(): void {
    this.totalDeduped++;
  }

  public recordMLEmit(): void {
    this.mlEmitCount++;
  }

  public recordDLEmit(): void {
    this.dlEmitCount++;
  }

  public getState(): PressureSignalAdapterState {
    return Object.freeze({
      totalAdapted: this.totalAdapted,
      totalRejected: this.totalRejected,
      totalDeduped: this.totalDeduped,
      lastAdaptedTick: this.lastAdaptedTick,
      lastTierSeen: this.lastTierSeen,
      lastBandSeen: this.lastBandSeen,
      lastScoreSeen: this.lastScoreSeen,
      consecutiveHighTierTicks: this.consecutiveHighTierTicks,
      consecutiveCriticalTicks: this.consecutiveCriticalTicks,
      tierEscalationCount: this.tierEscalationCount,
      criticalEnterCount: this.criticalEnterCount,
      fullReliefCount: this.fullReliefCount,
      dedupeWindowTicks: this.dedupeWindowTicks,
      mlEmitCount: this.mlEmitCount,
      dlEmitCount: this.dlEmitCount,
    });
  }

  public getReport(activeDecayConstraints: readonly string[]): PressureSignalAdapterReport {
    const tierDistribution = Object.freeze({ ...this.tierCounts });
    const bandDistribution = Object.freeze({ ...this.bandCounts });

    const topPressureDrivers = [...this.driverCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
      .map(([key]) => key);

    const topReliefDrivers = [...this.reliefCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
      .map(([key]) => key);

    const averageScore =
      this.scoreHistory.length > 0
        ? this.scoreHistory.reduce((s, v) => s + v, 0) / this.scoreHistory.length
        : 0;
    const maxScoreSeen = this.scoreHistory.length > 0 ? Math.max(...this.scoreHistory) : 0;
    const minScoreSeen = this.scoreHistory.length > 0 ? Math.min(...this.scoreHistory) : 0;

    const defaultWeightSummary = Object.freeze(
      Object.fromEntries(
        PRESSURE_SIGNAL_KEYS.map((key) => [
          key,
          DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key],
        ]),
      ) as Record<PressureSignalKey, number>,
    );

    return Object.freeze({
      version: PRESSURE_SIGNAL_ADAPTER_VERSION,
      state: this.getState(),
      tierDistribution,
      bandDistribution,
      topPressureDrivers: Object.freeze(topPressureDrivers),
      topReliefDrivers: Object.freeze(topReliefDrivers),
      averageScore,
      maxScoreSeen,
      minScoreSeen,
      mlFeatureCount: PRESSURE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      dlFeatureCount: PRESSURE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      defaultWeightSummary,
      defaultLimitSummary: DEFAULT_PRESSURE_COLLECTOR_LIMITS,
      activeConstraints: activeDecayConstraints,
    });
  }

  public reset(): void {
    this.totalAdapted = 0;
    this.totalRejected = 0;
    this.totalDeduped = 0;
    this.lastAdaptedTick = null;
    this.lastTierSeen = null;
    this.lastBandSeen = null;
    this.lastScoreSeen = null;
    this.consecutiveHighTierTicks = 0;
    this.consecutiveCriticalTicks = 0;
    this.tierEscalationCount = 0;
    this.criticalEnterCount = 0;
    this.fullReliefCount = 0;
    this.mlEmitCount = 0;
    this.dlEmitCount = 0;
    this.scoreHistory.length = 0;
    this.driverCounts.clear();
    this.reliefCounts.clear();
    for (const tier of Object.keys(this.tierCounts) as PressureTier[]) {
      this.tierCounts[tier] = 0;
    }
    for (const band of Object.keys(this.bandCounts) as PressureBand[]) {
      this.bandCounts[band] = 0;
    }
  }
}

// ============================================================================
// MARK: PressureSignalAdapter — main class
// ============================================================================

/**
 * PressureSignalAdapter translates authoritative pressure engine state into
 * backend-chat-native signals. It is the single ingress point for pressure
 * truth into the chat lane.
 *
 * Usage:
 *   const adapter = createPressureSignalAdapter({ defaultRoomId: '...' });
 *   const artifacts = adapter.adapt(input, context);
 *   const mlVec = adapter.extractMLVector(input);
 *   const dlTensor = adapter.buildDLTensorCompat(input);
 *   const report = adapter.getReport();
 */
export class PressureSignalAdapter {
  private readonly options: Required<PressureSignalAdapterOptions>;
  private readonly deduplicator: PressureSignalDeduplicator;
  private readonly priorityClassifier = new PressureSignalPriorityClassifier();
  private readonly narrativeWeighter = new PressureSignalNarrativeWeighter();
  private readonly channelRouter = new PressureSignalChannelRouter();
  private readonly mlVectorBuilder = new PressureAdapterMLVectorBuilder();
  private readonly analytics: PressureAdapterAnalytics;

  private readonly historyLog: PressureSignalAdapterHistoryEntry[] = [];
  private readonly rejectionLog: PressureSignalAdapterRejection[] = [];
  private lastActiveDecayConstraints: readonly string[] = [];

  public constructor(options: PressureSignalAdapterOptions) {
    const dedupeWindowTicks =
      options.dedupeWindowTicks ?? PRESSURE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS;

    this.options = {
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      suppressAmbientTiers: options.suppressAmbientTiers ?? false,
      dedupeWindowTicks,
      maxBatchSize: options.maxBatchSize ?? PRESSURE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
      enableMLEmit: options.enableMLEmit ?? true,
      enableDLEmit: options.enableDLEmit ?? false,
      logger: options.logger ?? this.buildNoopLogger(),
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
    };

    this.deduplicator = new PressureSignalDeduplicator(dedupeWindowTicks);
    this.analytics = new PressureAdapterAnalytics(dedupeWindowTicks);
  }

  // ──────────────────────────────────────────────────────────────────────
  // PUBLIC CONTRACT — adapt, batch, extract
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Primary ingestion method — translate one tick of pressure truth into
   * an array of chat adapter artifacts.
   */
  public adapt(
    input: PressureSignalInput,
    context?: PressureSignalAdapterContext,
  ): readonly PressureSignalAdapterArtifact[] {
    const { snapshot, collection } = input;
    const { tick, pressure, mode, phase } = snapshot;
    const tier = resolvePressureTier(pressure.score);
    const band = resolvePressureBand(pressure.score);
    const nowMs = this.options.clock.now();

    const artifacts: PressureSignalAdapterArtifact[] = [];

    // Build chat-native signal compat
    const chatSignal = this.buildChatSignalCompat(
      snapshot,
      collection,
      tier,
      band,
    );

    // Build adapter ML vector
    const adapterMLVector = this.mlVectorBuilder.build(
      tick,
      pressure,
      collection,
      input.trendSummary ?? null,
      input.recoveryForecast ?? null,
      input.decayAnalysis ?? null,
      input.escalationPrediction ?? null,
      mode,
      phase,
    );

    // Track active decay constraints
    if (input.decayAnalysis) {
      this.lastActiveDecayConstraints = input.decayAnalysis.activeConstraints;
    }

    // ── Tier change event
    if (pressure.tier !== pressure.previousTier) {
      const isEscalation =
        rankPressureTier(tier) > rankPressureTier(pressure.previousTier);
      const eventName: PressureSignalAdapterEventName = isEscalation
        ? 'pressure.tier.escalated'
        : 'pressure.tier.deescalated';

      artifacts.push(
        this.buildArtifact(
          eventName,
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Band change event (when tier unchanged but band crossed)
    if (
      pressure.band !== pressure.previousBand &&
      pressure.tier === pressure.previousTier
    ) {
      const isEscalation =
        rankPressureBand(band) > rankPressureBand(pressure.previousBand);
      const eventName: PressureSignalAdapterEventName = isEscalation
        ? 'pressure.band.escalated'
        : 'pressure.band.deescalated';

      artifacts.push(
        this.buildArtifact(
          eventName,
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Critical tier entered (fire once per run, no dedupe)
    if (tier === 'T4' && pressure.previousTier !== 'T4') {
      artifacts.push(
        this.buildArtifact(
          'pressure.critical.entered',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Critical tier exited
    if (pressure.previousTier === 'T4' && tier !== 'T4') {
      artifacts.push(
        this.buildArtifact(
          'pressure.critical.exited',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── New high watermark
    if (pressure.maxScoreSeen > (this.analytics.getState().lastScoreSeen ?? 0)) {
      artifacts.push(
        this.buildArtifact(
          'pressure.watermark.new',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── High pressure persistence
    if (
      (tier === 'T3' || tier === 'T4') &&
      (pressure.survivedHighPressureTicks === 5 ||
        pressure.survivedHighPressureTicks === 10 ||
        pressure.survivedHighPressureTicks === 20 ||
        pressure.survivedHighPressureTicks === 40)
    ) {
      artifacts.push(
        this.buildArtifact(
          'pressure.high.persisted',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Dominant driver at high pressure
    const topContrib = [...collection.contributions].sort(
      (a, b) => b.amount - a.amount,
    )[0];
    if (topContrib && pressure.score >= 0.55 && topContrib.amount >= 0.10) {
      artifacts.push(
        this.buildArtifact(
          'pressure.dominant.driver',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Full relief
    if (
      pressure.score === 0 &&
      collection.contributions.length === 0
    ) {
      artifacts.push(
        this.buildArtifact(
          'pressure.full.relief',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Trend spike
    if (input.trendSummary?.isSpike) {
      artifacts.push(
        this.buildArtifact(
          'pressure.spike',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── High tier plateau
    if (input.trendSummary?.plateauAtHighTier) {
      artifacts.push(
        this.buildArtifact(
          'pressure.plateau.high',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Hater injection armed
    if (PRESSURE_TIER_CONFIGS[tier].allowsHaterInjection) {
      artifacts.push(
        this.buildArtifact(
          'pressure.hater.injection.armed',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Passive shield drain active
    if (PRESSURE_TIER_CONFIGS[tier].passiveShieldDrain) {
      artifacts.push(
        this.buildArtifact(
          'pressure.shield.drain.active',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Recovery forecast at high tier
    if (input.recoveryForecast && (tier === 'T3' || tier === 'T4')) {
      artifacts.push(
        this.buildArtifact(
          'pressure.recovery.forecast',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── Escalation proximity warning
    if (
      input.escalationPrediction &&
      input.escalationPrediction.escalationProximity > 0.8 &&
      !input.escalationPrediction.atMaxTier
    ) {
      artifacts.push(
        this.buildArtifact(
          'pressure.escalation.proximity',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
    }

    // ── ML emit
    if (this.options.enableMLEmit) {
      artifacts.push(
        this.buildArtifact(
          'pressure.ml.emit',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
      this.analytics.recordMLEmit();
    }

    // ── DL emit
    if (this.options.enableDLEmit && input.dlTensor) {
      artifacts.push(
        this.buildArtifact(
          'pressure.dl.emit',
          tick,
          tier,
          band,
          pressure,
          collection,
          chatSignal,
          adapterMLVector,
          input,
          context,
          nowMs,
        ),
      );
      this.analytics.recordDLEmit();
    }

    // Record to analytics
    const accepted = artifacts.some((a) => a.accepted);
    if (accepted) {
      const firstAccepted = artifacts.find((a) => a.accepted);
      this.analytics.recordAdapted(
        tick,
        tier,
        band,
        pressure.score,
        collection,
        firstAccepted?.eventName ?? 'pressure.ml.emit',
      );
    }

    this.recordHistory(tick, tier, band, pressure.score, artifacts);

    return Object.freeze(artifacts);
  }

  /**
   * Batch-adapt multiple pressure inputs (e.g. replayed ticks).
   */
  public adaptBatch(
    inputs: readonly PressureSignalInput[],
    context?: PressureSignalAdapterContext,
  ): readonly PressureSignalAdapterArtifact[] {
    const limited = inputs.slice(0, this.options.maxBatchSize);
    const all: PressureSignalAdapterArtifact[] = [];
    for (const input of limited) {
      const artifacts = this.adapt(input, context);
      all.push(...artifacts);
    }
    return Object.freeze(all);
  }

  /**
   * Extract the chat-lane ML vector for the online inference pipeline.
   */
  public extractMLVector(input: PressureSignalInput): PressureMLVectorCompat {
    const { snapshot, collection } = input;
    const { pressure, mode, phase } = snapshot;
    const tier = resolvePressureTier(pressure.score);
    const band = resolvePressureBand(pressure.score);
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);

    const adapterMLVector = this.mlVectorBuilder.build(
      snapshot.tick,
      pressure,
      collection,
      input.trendSummary ?? null,
      input.recoveryForecast ?? null,
      input.decayAnalysis ?? null,
      input.escalationPrediction ?? null,
      mode,
      phase,
    );

    const features: number[] = [
      adapterMLVector.scoreNormalized,
      adapterMLVector.tierRankNorm,
      adapterMLVector.bandRankNorm,
      adapterMLVector.scoreDeltaNorm,
      adapterMLVector.isHighTier,
      adapterMLVector.isCriticalTier,
      adapterMLVector.allowsHaterInjection,
      adapterMLVector.passiveShieldDrain,
      adapterMLVector.positiveSignalCountNorm,
      adapterMLVector.reliefSignalCountNorm,
      adapterMLVector.upwardCrossingsNorm,
      adapterMLVector.survivedHighPressureNorm,
      adapterMLVector.maxScoreSeenNorm,
      adapterMLVector.trendVelocityNorm,
      adapterMLVector.trendAccelerationNorm,
      adapterMLVector.isSpike,
      adapterMLVector.isPlateauAtHigh,
      adapterMLVector.escalationProximityNorm,
      adapterMLVector.ticksToCalmNorm,
      adapterMLVector.ticksToNextTierNorm,
      adapterMLVector.stickyFloorNorm,
      adapterMLVector.decayRatioNorm,
      ...adapterMLVector.positiveFeatureVector,
      ...adapterMLVector.reliefFeatureVector,
      adapterMLVector.riskScore,
      adapterMLVector.narrativeWeightScore,
      adapterMLVector.modeCodeNorm,
      adapterMLVector.phaseCodeNorm,
    ];

    const narrativeWeight = this.narrativeWeighter.score(
      'pressure.ml.emit',
      tier,
      band,
      collection,
      input.trendSummary ?? null,
    );

    return Object.freeze({
      tick: snapshot.tick,
      featureCount: PRESSURE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      features: Object.freeze(features),
      featureLabels: this.buildMLFeatureLabels(),
      scoreNormalized: adapterMLVector.scoreNormalized,
      tierRank,
      bandRank,
      isHighTier: tierRank >= 3,
      isCriticalTier: tier === 'T4',
      trendVelocity: input.trendSummary?.velocity ?? 0,
      trendAcceleration: input.trendSummary?.acceleration ?? 0,
      escalationProximity: input.escalationPrediction?.escalationProximity ?? 0,
      ticksToCalm: input.recoveryForecast?.estimatedTicksToCalm ?? 0,
      riskScore: adapterMLVector.riskScore as Score01,
      narrativeWeight,
    });
  }

  /**
   * Build a DL tensor compat for the sequence model pipeline.
   */
  public buildDLTensorCompat(
    input: PressureSignalInput,
  ): PressureDLTensorCompat | null {
    const { dlTensor } = input;
    if (!dlTensor) return null;

    return Object.freeze({
      tick: dlTensor.tick,
      sequenceLength: dlTensor.sequenceLength,
      featureCount: PRESSURE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      inputSequenceFlat: Object.freeze(
        dlTensor.inputSequence.flatMap((frame) => [...frame]),
      ),
      currentFrame: dlTensor.currentFrame,
      tierOneHot: dlTensor.tierOneHot,
      bandOneHot: dlTensor.bandOneHot,
      attentionWeights: dlTensor.attentionWeights,
      labelVector: dlTensor.labelVector,
    });
  }

  /**
   * Build a forecast compat from recovery forecast data.
   */
  public buildForecastCompat(
    input: PressureSignalInput,
  ): PressureForecastCompat | null {
    const { recoveryForecast, snapshot } = input;
    if (!recoveryForecast) return null;

    return Object.freeze({
      tick: snapshot.tick,
      currentTier: recoveryForecast.currentTier,
      estimatedTicksToCalm: recoveryForecast.estimatedTicksToCalm,
      estimatedTicksToNextTierDown: recoveryForecast.estimatedTicksToNextTierDown,
      stickyFloor: recoveryForecast.stickyFloor,
      maxDropPerTick: recoveryForecast.maxDropPerTick,
      isTierLocked: recoveryForecast.isTierLocked,
      decayConstraints: recoveryForecast.decayProfile.reasons,
    });
  }

  /**
   * Build a UX hint compat from the adapter's ux hint.
   */
  public buildUXHintCompat(
    input: PressureSignalInput,
  ): PressureUXHintCompat | null {
    const { uxHint, snapshot } = input;
    if (!uxHint) return null;

    return Object.freeze({
      tick: snapshot.tick,
      urgencyLabel: uxHint.urgencyLabel,
      shortHook: uxHint.shortHook,
      companionCommentary: uxHint.companionCommentary,
      topDriverLabels: uxHint.topDriverLabels,
      topReliefLabels: uxHint.topReliefLabels,
      weightedExplanation: uxHint.weightedExplanation,
      chatChannel: uxHint.chatChannel,
      shouldInterrupt: uxHint.shouldInterrupt,
      interruptReason: uxHint.interruptReason,
      severityClass: uxHint.severityClass,
    });
  }

  /**
   * Build an annotation compat from the annotation bundle.
   */
  public buildAnnotationCompat(
    input: PressureSignalInput,
  ): PressureAnnotationCompat | null {
    const { annotationBundle, snapshot } = input;
    if (!annotationBundle) return null;

    return Object.freeze({
      tick: snapshot.tick,
      tierLabel: annotationBundle.tierLabel,
      bandLabel: annotationBundle.bandLabel,
      compositeNote: annotationBundle.compositeNote,
      allowsHaterInjection: annotationBundle.allowsHaterInjection,
      passiveShieldDrain: annotationBundle.passiveShieldDrain,
      activeSignalCount: annotationBundle.activeSignals.length,
      modeSignalCount: annotationBundle.modeSignals.length,
      driverAnnotation: annotationBundle.driverAnnotation,
      reliefAnnotation: annotationBundle.reliefAnnotation,
    });
  }

  /**
   * Returns the current analytics report.
   */
  public getReport(): PressureSignalAdapterReport {
    return this.analytics.getReport(this.lastActiveDecayConstraints);
  }

  /**
   * Returns the current adapter state.
   */
  public getState(): PressureSignalAdapterState {
    return this.analytics.getState();
  }

  /**
   * Returns the dedupe log.
   */
  public getDedupeLog(): readonly PressureSignalAdapterDeduped[] {
    return this.deduplicator.getDedupeLog();
  }

  /**
   * Returns the history log.
   */
  public getHistoryLog(): readonly PressureSignalAdapterHistoryEntry[] {
    return Object.freeze([...this.historyLog]);
  }

  /**
   * Returns the rejection log.
   */
  public getRejectionLog(): readonly PressureSignalAdapterRejection[] {
    return Object.freeze([...this.rejectionLog]);
  }

  /**
   * Flushes dedupe state without clearing analytics.
   */
  public flushDedupe(): void {
    this.deduplicator.reset();
  }

  /**
   * Full reset — clears all state, history, analytics.
   */
  public reset(): void {
    this.deduplicator.reset();
    this.analytics.reset();
    this.historyLog.length = 0;
    this.rejectionLog.length = 0;
    this.lastActiveDecayConstraints = [];
  }

  // ──────────────────────────────────────────────────────────────────────
  // PRIVATE — artifact construction
  // ──────────────────────────────────────────────────────────────────────

  private buildArtifact(
    eventName: PressureSignalAdapterEventName,
    tick: number,
    tier: PressureTier,
    band: PressureBand,
    pressure: PressureState,
    collection: PressureSignalCollection,
    chatSignal: PressureChatSignalCompat,
    adapterMLVector: PressureAdapterMLVector,
    input: PressureSignalInput,
    context: PressureSignalAdapterContext | undefined,
    nowMs: UnixMs,
  ): PressureSignalAdapterArtifact {
    const priority = this.priorityClassifier.classify(
      eventName,
      tier,
      band,
      collection,
    );

    const narrativeWeight = this.narrativeWeighter.score(
      eventName,
      tier,
      band,
      collection,
      input.trendSummary ?? null,
    );

    const channelRecommendation = this.channelRouter.route(
      tier,
      input.snapshot.mode,
      priority,
      this.options,
    );

    // Check dedupe (bypass for critical events)
    const isBypass = this.deduplicator.isBypassEvent(eventName);
    const shouldDedupe = !isBypass && this.deduplicator.shouldSuppress(eventName, tick);

    if (shouldDedupe) {
      this.deduplicator.recordDeduped(eventName, tick);
      this.analytics.recordDeduped();
      return Object.freeze({
        tick,
        eventName,
        envelope: null,
        signal: null,
        accepted: false,
        deduped: true,
        rejectionReason: `Deduplicated within ${this.options.dedupeWindowTicks}-tick window`,
        severity: this.resolveSeverity(tier, band),
        priority,
        narrativeWeight,
        channelRecommendation,
        mlVector: null,
      });
    }

    // Build envelope
    const envelope = this.buildEnvelope(
      eventName,
      tick,
      tier,
      band,
      pressure,
      collection,
      chatSignal,
      input,
      context,
      channelRecommendation,
      nowMs,
    );

    // Record emission
    this.deduplicator.recordEmitted(eventName, tick);

    return Object.freeze({
      tick,
      eventName,
      envelope,
      signal: this.buildSignalEnvelope(eventName, tick, tier, band, pressure, chatSignal, nowMs),
      accepted: true,
      deduped: false,
      rejectionReason: null,
      severity: this.resolveSeverity(tier, band),
      priority,
      narrativeWeight,
      channelRecommendation,
      mlVector: adapterMLVector,
    });
  }

  private buildEnvelope(
    eventName: PressureSignalAdapterEventName,
    tick: number,
    tier: PressureTier,
    band: PressureBand,
    pressure: PressureState,
    collection: PressureSignalCollection,
    chatSignal: PressureChatSignalCompat,
    input: PressureSignalInput,
    context: PressureSignalAdapterContext | undefined,
    channelRecommendation: PressureSignalAdapterChannelRecommendation,
    nowMs: UnixMs,
  ): ChatInputEnvelope {
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const roomId = (context?.roomId ?? this.options.defaultRoomId) as ChatRoomId;
    const channel = channelRecommendation === 'SUPPRESSED'
      ? this.options.defaultVisibleChannel
      : (channelRecommendation as ChatVisibleChannel);

    const body = this.buildEnvelopeBody(
      eventName,
      tier,
      band,
      pressure,
      collection,
      tierConfig,
      input,
    );

    return Object.freeze({
      source: 'PRESSURE_ENGINE' as const,
      roomId,
      channel,
      body,
      tick,
      emittedAt: nowMs,
      tags: Object.freeze([
        `tier:${tier}`,
        `band:${band}`,
        `event:${eventName}`,
        ...(context?.tags ?? []),
      ]),
      metadata: Object.freeze({
        ...(context?.metadata ?? {}),
        score: pressure.score,
        previousTier: pressure.previousTier,
        previousBand: pressure.previousBand,
        allowsHaterInjection: tierConfig.allowsHaterInjection,
        passiveShieldDrain: tierConfig.passiveShieldDrain,
        dominantDriver: collection.dominantPressureKey ?? null,
        dominantRelief: collection.dominantReliefKey ?? null,
      } as Readonly<Record<string, JsonValue>>),
    } as unknown as ChatInputEnvelope);
  }

  private buildEnvelopeBody(
    eventName: PressureSignalAdapterEventName,
    tier: PressureTier,
    band: PressureBand,
    pressure: PressureState,
    collection: PressureSignalCollection,
    tierConfig: PressureTierConfig,
    input: PressureSignalInput,
  ): string {
    switch (eventName) {
      case 'pressure.tier.escalated':
        return `Pressure escalated to ${tier} (${tierConfig.label}) from ${pressure.previousTier}. Score: ${pressure.score.toFixed(3)}.`;
      case 'pressure.tier.deescalated':
        return `Pressure decreased to ${tier} (${tierConfig.label}) from ${pressure.previousTier}. Score: ${pressure.score.toFixed(3)}.`;
      case 'pressure.band.escalated':
        return `Pressure band escalated to ${band} from ${pressure.previousBand}.`;
      case 'pressure.band.deescalated':
        return `Pressure band eased to ${band} from ${pressure.previousBand}.`;
      case 'pressure.critical.entered':
        return `CRITICAL pressure reached at ${pressure.score.toFixed(3)}.${tierConfig.allowsHaterInjection ? ' Hater injection is now armed.' : ''}`;
      case 'pressure.critical.exited':
        return `Pressure exited CRITICAL tier — now ${tier} at ${pressure.score.toFixed(3)}.`;
      case 'pressure.high.persisted':
        return `High pressure has persisted for ${pressure.survivedHighPressureTicks} tick(s) at tier ${tier}.`;
      case 'pressure.watermark.new':
        return `New pressure high watermark: ${pressure.maxScoreSeen.toFixed(3)}.`;
      case 'pressure.dominant.driver': {
        const top = [...collection.contributions].sort((a, b) => b.amount - a.amount)[0];
        return top
          ? `Dominant pressure driver: ${top.key} at ${top.amount.toFixed(3)} (${top.reason}).`
          : `Dominant pressure driver active at ${pressure.score.toFixed(3)}.`;
      }
      case 'pressure.full.relief':
        return 'Pressure fully resolved — all signals cleared.';
      case 'pressure.spike':
        return `Pressure spike detected — velocity ${(input.trendSummary?.velocity ?? 0).toFixed(4)}.`;
      case 'pressure.plateau.high':
        return `Pressure has plateaued at high tier for ${input.trendSummary?.window ?? 0}-tick window.`;
      case 'pressure.hater.injection.armed':
        return `Tier ${tier} reached — hater injection is armed.`;
      case 'pressure.shield.drain.active':
        return `Tier ${tier} — passive shield drain is active.`;
      case 'pressure.recovery.forecast': {
        const fc = input.recoveryForecast;
        return fc
          ? `Recovery forecast: ~${fc.estimatedTicksToCalm} tick(s) to calm at current decay rate.`
          : `Recovery forecast unavailable at tier ${tier}.`;
      }
      case 'pressure.escalation.proximity': {
        const ep = input.escalationPrediction;
        return ep
          ? `Escalation proximity at ${(ep.escalationProximity * 100).toFixed(0)}% — ${ep.distanceToNextTierEscalation.toFixed(3)} score gap to next tier.`
          : `Escalation proximity warning at score ${pressure.score.toFixed(3)}.`;
      }
      case 'pressure.ml.emit':
        return `Pressure ML signal emitted at tick ${input.snapshot.tick}. Score: ${pressure.score.toFixed(3)}, tier: ${tier}.`;
      case 'pressure.dl.emit':
        return `Pressure DL tensor emitted at tick ${input.snapshot.tick}.`;
      default:
        return `Pressure event at tick ${input.snapshot.tick}: ${tier}/${band}.`;
    }
  }

  private buildSignalEnvelope(
    eventName: PressureSignalAdapterEventName,
    tick: number,
    tier: PressureTier,
    band: PressureBand,
    pressure: PressureState,
    chatSignal: PressureChatSignalCompat,
    nowMs: UnixMs,
  ): ChatSignalEnvelope {
    return Object.freeze({
      source: 'PRESSURE_ENGINE' as const,
      eventName,
      tick,
      emittedAt: nowMs,
      payload: Object.freeze({
        tier,
        band,
        score: pressure.score,
        previousTier: pressure.previousTier,
        previousBand: pressure.previousBand,
        isEscalation: chatSignal.isEscalation,
        isDeescalation: chatSignal.isDeescalation,
        isCritical: chatSignal.isCritical,
        isHighTier: chatSignal.isHighTier,
        dominantPressureKey: chatSignal.dominantPressureKey,
        dominantReliefKey: chatSignal.dominantReliefKey,
      } as unknown as Readonly<Record<string, JsonValue>>),
    } as unknown as ChatSignalEnvelope);
  }

  private buildChatSignalCompat(
    snapshot: PressureSnapshotCompat,
    collection: PressureSignalCollection,
    tier: PressureTier,
    band: PressureBand,
  ): PressureChatSignalCompat {
    const { pressure, mode, phase } = snapshot;
    const tierRank = rankPressureTier(tier);
    const prevTierRank = rankPressureTier(pressure.previousTier);
    const bandRank = rankPressureBand(band);
    const prevBandRank = rankPressureBand(pressure.previousBand);

    const isEscalation =
      tierRank > prevTierRank || (tierRank === prevTierRank && bandRank > prevBandRank);
    const isDeescalation =
      tierRank < prevTierRank || (tierRank === prevTierRank && bandRank < prevBandRank);

    const netPressurePolarity: PressureSignalPolarity =
      collection.rawPositiveScore >= collection.rawReliefScore ? 'PRESSURE' : 'RELIEF';

    return Object.freeze({
      eventName: 'pressure.ml.emit' as const,
      tick: snapshot.tick,
      tier,
      previousTier: pressure.previousTier,
      band,
      previousBand: pressure.previousBand,
      score: pressure.score,
      scoreDelta: Number(
        (pressure.score - (isEscalation ? pressure.score - 0.01 : pressure.score)).toFixed(6),
      ),
      isEscalation,
      isDeescalation,
      isCritical: tier === 'T4',
      isHighTier: tierRank >= 3,
      allowsHaterInjection: PRESSURE_TIER_CONFIGS[tier].allowsHaterInjection,
      passiveShieldDrain: PRESSURE_TIER_CONFIGS[tier].passiveShieldDrain,
      dominantPressureKey: collection.dominantPressureKey,
      dominantReliefKey: collection.dominantReliefKey,
      positiveSignalCount: collection.contributions.length,
      reliefSignalCount: collection.reliefContributions.length,
      netPressurePolarity,
      modeCode: mode,
      phaseCode: phase,
      upwardCrossings: pressure.upwardCrossings,
      survivedHighPressureTicks: pressure.survivedHighPressureTicks,
      maxScoreSeen: pressure.maxScoreSeen,
    });
  }

  private resolveSeverity(
    tier: PressureTier,
    band: PressureBand,
  ): PressureSignalAdapterSeverity {
    if (tier === 'T4') return 'CRITICAL';
    if (tier === 'T3') return 'HIGH';
    if (tier === 'T2' || band === 'ELEVATED') return 'MEDIUM';
    if (tier === 'T1' || band === 'BUILDING') return 'LOW';
    return 'AMBIENT';
  }

  private recordHistory(
    tick: number,
    tier: PressureTier,
    band: PressureBand,
    score: number,
    artifacts: readonly PressureSignalAdapterArtifact[],
  ): void {
    for (const artifact of artifacts) {
      this.historyLog.push({
        tick,
        eventName: artifact.eventName,
        tier,
        band,
        score,
        accepted: artifact.accepted,
        deduped: artifact.deduped,
      });
    }
    if (this.historyLog.length > PRESSURE_HISTORY_DEPTH * 4) {
      this.historyLog.splice(0, this.historyLog.length - PRESSURE_HISTORY_DEPTH * 4);
    }
  }

  private buildMLFeatureLabels(): readonly string[] {
    return Object.freeze([
      'scoreNormalized',
      'tierRankNorm',
      'bandRankNorm',
      'scoreDeltaNorm',
      'isHighTier',
      'isCriticalTier',
      'allowsHaterInjection',
      'passiveShieldDrain',
      'positiveSignalCountNorm',
      'reliefSignalCountNorm',
      'upwardCrossingsNorm',
      'survivedHighPressureNorm',
      'maxScoreSeenNorm',
      'trendVelocityNorm',
      'trendAccelerationNorm',
      'isSpike',
      'isPlateauAtHigh',
      'escalationProximityNorm',
      'ticksToCalmNorm',
      'ticksToNextTierNorm',
      'stickyFloorNorm',
      'decayRatioNorm',
      ...PRESSURE_POSITIVE_SIGNAL_KEYS.map((k) => `pos:${k}`),
      ...PRESSURE_RELIEF_SIGNAL_KEYS.map((k) => `rel:${k}`),
      'riskScore',
      'narrativeWeightScore',
      'modeCodeNorm',
      'phaseCodeNorm',
    ]);
  }

  private buildNoopLogger(): PressureSignalAdapterLogger {
    return {
      debug: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
  }
}

// ============================================================================
// MARK: Factory function
// ============================================================================

/**
 * Factory function for clean construction.
 *
 * Usage:
 *   const adapter = createPressureSignalAdapter({
 *     defaultRoomId: 'room-123',
 *     enableMLEmit: true,
 *     enableDLEmit: false,
 *   });
 */
export function createPressureSignalAdapter(
  options: PressureSignalAdapterOptions,
): PressureSignalAdapter {
  return new PressureSignalAdapter(options);
}

// ============================================================================
// MARK: Standalone extraction helpers (consumed by AdapterSuite)
// ============================================================================

/**
 * Extract a standalone ML vector without constructing a full adapter.
 */
export function extractPressureMLVector(
  input: PressureSignalInput,
  options: Pick<PressureSignalAdapterOptions, 'defaultRoomId'>,
): PressureMLVectorCompat {
  const adapter = new PressureSignalAdapter(options);
  return adapter.extractMLVector(input);
}

/**
 * Score pressure risk from a collection and state — useful for churn/intervention models.
 */
export function scorePressureRisk(
  pressure: PressureState,
  collection: PressureSignalCollection,
  trend: PressureTrendSummary | null,
): Score01 {
  const tier = resolvePressureTier(pressure.score);
  const tierConfig = PRESSURE_TIER_CONFIGS[tier];
  let risk = clampPressureScore(pressure.score);
  if (tierConfig.allowsHaterInjection) risk = Math.min(1, risk * 1.3);
  if (tierConfig.passiveShieldDrain) risk = Math.min(1, risk * 1.2);
  if (trend?.isSpike) risk = Math.min(1, risk * 1.25);
  const reliefFraction =
    collection.rawPositiveScore > 0
      ? collection.rawReliefScore / collection.rawPositiveScore
      : 0;
  risk = risk * (1 - reliefFraction * 0.4);
  return clampPressureScore(risk) as Score01;
}

/**
 * Resolve the chat channel for a pressure state — standalone utility.
 */
export function getPressureChatChannel(
  tier: PressureTier,
  mode: 'solo' | 'pvp' | 'coop' | 'ghost',
): 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'SYSTEM_SHADOW' {
  const tierConfig = PRESSURE_TIER_CONFIGS[tier];
  if (tier === 'T4') return 'GLOBAL';
  if (tierConfig.allowsHaterInjection || tier === 'T3') {
    if (mode === 'coop' || mode === 'pvp') return 'SYNDICATE';
    return 'GLOBAL';
  }
  if (tier === 'T2' && (mode === 'coop' || mode === 'pvp')) return 'SYNDICATE';
  return 'SYSTEM_SHADOW';
}

/**
 * Build a narrative weight from a pressure tier and band.
 */
export function buildPressureNarrativeWeight(
  tier: PressureTier,
  band: PressureBand,
): PressureSignalAdapterNarrativeWeight {
  const tierRank = rankPressureTier(tier);
  const bandRank = rankPressureBand(band);
  if (tier === 'T4') return 'PEAK';
  if (tierRank >= 3 || bandRank >= 4) return 'MAJOR';
  if (tierRank === 2 || bandRank === 3) return 'MODERATE';
  if (tierRank === 1 || bandRank === 2) return 'MINOR';
  return 'NEGLIGIBLE';
}

/**
 * Build a complete threshold boundary report for a given score.
 * Useful for explaining proximity to tier escalation in dossier/chat surfaces.
 */
export function buildPressureThresholdReport(score: number): {
  readonly currentTier: PressureTier;
  readonly currentBand: PressureBand;
  readonly currentTierConfig: PressureTierConfig;
  readonly nextTierThreshold: PressureThreshold<PressureTier> | null;
  readonly nextBandThreshold: PressureThreshold<PressureBand> | null;
  readonly distanceToNextTierEscalation: number;
  readonly distanceToNextBandEscalation: number;
  readonly escalationProximity: number;
  readonly defaultMaxDecayPerTick: number;
  readonly tiersAbove: readonly PressureThreshold<PressureTier>[];
  readonly bandsAbove: readonly PressureThreshold<PressureBand>[];
} {
  const currentTier = resolvePressureTier(score);
  const currentBand = resolvePressureBand(score);
  const currentTierConfig = PRESSURE_TIER_CONFIGS[currentTier];
  const tierRank = rankPressureTier(currentTier);
  const bandRank = rankPressureBand(currentBand);

  const nextTierThreshold = PRESSURE_THRESHOLDS.find(
    (t) => rankPressureTier(t.value) === tierRank + 1,
  ) ?? null;

  const nextBandThreshold = PRESSURE_BAND_THRESHOLDS.find(
    (t) => rankPressureBand(t.value) === bandRank + 1,
  ) ?? null;

  const distanceToNextTierEscalation = nextTierThreshold
    ? Math.max(0, nextTierThreshold.minScore - score)
    : 0;
  const distanceToNextBandEscalation = nextBandThreshold
    ? Math.max(0, nextBandThreshold.minScore - score)
    : 0;

  const tierMinScore = getPressureTierMinScore(currentTier);
  const escalationProximity = nextTierThreshold
    ? clampPressureScore(
        1 -
          distanceToNextTierEscalation /
            Math.max(0.001, nextTierThreshold.minScore - tierMinScore),
      )
    : 0;

  const tiersAbove = PRESSURE_THRESHOLDS.filter(
    (t) => rankPressureTier(t.value) > tierRank,
  );
  const bandsAbove = PRESSURE_BAND_THRESHOLDS.filter(
    (t) => rankPressureBand(t.value) > bandRank,
  );

  return Object.freeze({
    currentTier,
    currentBand,
    currentTierConfig,
    nextTierThreshold,
    nextBandThreshold,
    distanceToNextTierEscalation,
    distanceToNextBandEscalation,
    escalationProximity,
    defaultMaxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
    tiersAbove: Object.freeze(tiersAbove),
    bandsAbove: Object.freeze(bandsAbove),
  });
}

// ============================================================================
// MARK: Module manifest
// ============================================================================

export const PRESSURE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  version: PRESSURE_SIGNAL_ADAPTER_VERSION,
  mlFeatureCount: PRESSURE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount: PRESSURE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  dedupeWindowTicks: PRESSURE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: PRESSURE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  eventNames: PRESSURE_SIGNAL_ADAPTER_EVENT_NAMES,
  positiveSignalCount: PRESSURE_POSITIVE_SIGNAL_KEYS.length,
  reliefSignalCount: PRESSURE_RELIEF_SIGNAL_KEYS.length,
  totalSignalCount: PRESSURE_SIGNAL_KEYS.length,
  tierCount: Object.keys(PRESSURE_TIER_CONFIGS).length,
  trendWindow: PRESSURE_TREND_WINDOW,
  historyDepth: PRESSURE_HISTORY_DEPTH,
  defaultWeights: DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  defaultLimits: DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  defaultMaxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
  topSignalCount: TOP_PRESSURE_SIGNAL_COUNT,
} as const);
